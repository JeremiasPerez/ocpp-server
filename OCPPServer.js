
const { RPCServer, createRPCError } = require('ocpp-rpc')


class OCPPServer {
    constructor() {
        this._server = new RPCServer({
            protocols: ['ocpp1.6'], // server accepts ocpp1.6 subprotocol
            strictMode: false,       // enable strict validation of requests & responses
        })

        this._clients = {}
    }
    async init() {
        let that = this
        this._server.auth((accept, reject, handshake) => {
            // accept the incoming client
            accept({
                // anything passed to accept() will be attached as a 'session' property of the client.
                sessionId: 'XYZ123'
            })
        })

        this._server.on('client', async (client) => {
            console.log(`${client.session.sessionId} connected!`) // `XYZ123 connected!`


            // create a specific handler for handling BootNotification requests
            client.handle('BootNotification', ({params}) => {
                if (client.identity == null) return
                console.log(`Server got BootNotification from ${client.identity}:`, params)

                if (this._clients[client.identity] != null){
                    return {
                        status: "Rejected"
                    }
                }
                this._clients[client.identity] = {client: client, connectors: {}, lastTransactionId: 1}

                client.on('close', (e) => {
                    console.log("client closed")
                    delete this._clients[client.identity]
                })

                client.on('disconnect', () => {
                    console.log("client disconnected")
                    delete this._clients[client.identity]
                })

                // respond to accept the client
                return {
                    status: "Accepted",
                    interval: 300,
                    currentTime: new Date().toISOString()
                }
            })

            // create a specific handler for handling Heartbeat requests
            client.handle('Heartbeat', ({params}) => {
                console.log(`Server got Heartbeat from ${client.identity}:`, params)

                // respond with the server's current time.
                return {
                    currentTime: new Date().toISOString()
                }
            })

            // create a specific handler for handling StatusNotification requests
            client.handle('StatusNotification', ({params}) => {
                console.log(`Server got StatusNotification from ${client.identity}:`, params)
            })

            // create a specific handler for handling StartTransaction requests
            client.handle('StartTransaction', ({params}) => {
                console.log(`Server got StartTransaction from ${client.identity}:`, params)
                const cli = this._clients[client.identity]

                /*const transactionId = cli.transactions.reduce((t,v) => Math.max(t.id, v), 0) + 1
                cli.transactions.push({id: transactionId, connectorId: params.connectorId, status: 'Accepted'})

                this._currentTransactionIdByClient[client.identity][params.connectorId] = transactionId*/
                const connector = cli.connectors[params.connectorId]
                let transactionId = cli.lastTransactionId
                if(connector == null){
                    cli.connectors[params.connectorId] = {activeTransaction: transactionId}
                } else {
                    connector.activeTransaction = transactionId
                }
                cli.lastTransactionId++
                return {
                    transactionId: transactionId,
                    idTagInfo: {
                        status: 'Accepted'
                    }
                }
            })

            // create a specific handler for handling StartTransaction requests
            client.handle('StopTransaction', ({params}) => {
                console.log(`Server got StopTransaction from ${client.identity}:`, params)
                return {
                    idTagInfo: {
                        status: 'Accepted'
                    }
                }
            })

            // create a wildcard handler to handle any RPC method
            client.handle(({method, params}) => {
                // This handler will be called if the incoming method cannot be handled elsewhere.
                console.log(`Server got ${method} from ${client.identity}:`, params)

                // throw an RPC error to inform the server that we don't understand the request.
                //throw createRPCError("NotImplemented")
            })
        })
        await this._server.listen(9000)
        console.log("OCPP Server started!")
    }
    async remoteStartTransaction(identity, idTag, connectorId) {
        const cli = this._clients[identity]
        if(cli == null){
            console.log('Charger not found')
            return {status: 'error', message: 'charger not found'}
        }
        const connector = cli.connectors[connectorId]
        if(connector == null){
            cli.connectors[connectorId] = {activeTransaction: null}
        }

        try{
            console.log(`sending remote start to ${identity} in tag ${idTag} to connector ${connectorId}`)
            let response = await cli.client.call('RemoteStartTransaction',{idTag: idTag, connectorId: connectorId})
            console.log(response)
            if(response.status != null || response.status == 'Accepted') return {status: 'ok'}
            else return {status: 'error', message: 'Charger refused transaction'}
        } catch(error){
            return {status: 'error', message: error.message}
        }
    }
    async remoteStopTransaction(identity, connectorId) {
        const cli = this._clients[identity]
        if(cli == null){
            console.log('Charger not found')
            return {status: 'error', message: 'charger not found'}
        }
        const connector = cli.connectors[connectorId]
        if(connector == null){
            console.log('Connector not found')
            return {status: 'error', message: 'connector not found'}
        }
        const transactionId = connector.activeTransaction
        if (transactionId == null){
            return {status: 'error', message: 'No active transaction in charger'}
        }

        try{
            console.log(`send remote stop to ${identity} of transaction ${transactionId}`)
            let response = await cli.client.call('RemoteStopTransaction',{transactionId: transactionId})
            if(response.status == 'Accepted'){
                connector.activeTransaction = null
                return {status: 'ok'}
            }
            else return {status: 'error', message: 'Charger rejected the operation'}
        } catch(error){
            return {status: 'error', message: error.message}
        }
    }

}

module.exports = OCPPServer


