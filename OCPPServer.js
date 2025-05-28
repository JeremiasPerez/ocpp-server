
const { RPCServer, createRPCError } = require('ocpp-rpc')


class OCPPServer {
    constructor() {
        this._server = new RPCServer({
            protocols: ['ocpp1.6'], // server accepts ocpp1.6 subprotocol
            strictMode: true,       // enable strict validation of requests & responses
        })

        this._clients = []
        this._lastTransactionId = 0;
        this._currentTransactionIdByClient = {}
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
            this._clients.push(client)
            this._currentTransactionIdByClient[client.identity] = {}

            console.log(`${client.session.sessionId} connected!`) // `XYZ123 connected!`

            // create a specific handler for handling BootNotification requests
            client.handle('BootNotification', ({params}) => {
                console.log(`Server got BootNotification from ${client.identity}:`, params)

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
                return {}
            })

            // create a specific handler for handling StartTransaction requests
            client.handle('StartTransaction', ({params}) => {
                console.log(`Server got StartTransaction from ${client.identity}:`, params)
                let transactionId = that._lastTransactionId
                this._currentTransactionIdByClient[client.identity][params.connectorId] = transactionId
                that._lastTransactionId++
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
        console.log(`send remote start to ${identity} in tag ${idTag} to connector ${connectorId}`)
        const cli = this._clients.find((c) => c.identity === identity)
        if(cli == null){
            console.log('Charger not found')
            return {status: 'error', message: 'charger not found'}
        }
        try{
            let response = await cli.call('RemoteStartTransaction',{idTag: idTag, connectorId: connectorId})
            console.log(response)
            if(response.status != null || response.status == 'Accepted') return {status: 'ok'}
            else return {status: 'error', message: 'Charger refused transaction'}
        } catch(error){
            return {status: 'error', message: error.message}
        }

    }
    async remoteStopTransaction(identity, connectorId) {
        const cli = this._clients.find((c) => c.identity === identity)
        if(cli == null){
            console.log('Charger not found')
            return {status: 'error', message: 'charger not found'}
        }
        let transactionId = this._currentTransactionIdByClient[cli.identity][connectorId]
        if (transactionId == null){
            return {status: 'error', message: 'No active transaction in charger'}
        }
        try{
            console.log(`send remote stop to ${identity} of transaction ${transactionId}`)
            let response = await cli.call('RemoteStopTransaction',{transactionId: transactionId})
            if(response.status == 'Accepted'){
                delete this._currentTransactionIdByClient[cli.identity][connectorId]
                return {status: 'ok'}
            }
            else return {status: 'error', message: 'Charger rejected the operation'}
        } catch(error){
            return {status: 'error', message: error.message}
        }
    }

}

module.exports = OCPPServer


