const express = require('express')
const app = express()
app.use(express.json())
const port = 5000

const OCPPServer = require('./OCPPServer')

const server = new OCPPServer()
server.init().then(() => {
  app.post('/start', async (req, res) => {
    console.log("start received")
    const chargePointId = req.body?.chargePointId || 'EVB-P20261797'
    const connectorId = req.body?.connectorId || 1
    const tag = req.body?.tag || 'abc'
    let response = await server.remoteStartTransaction(chargePointId,tag,connectorId)
    res.json(response)
  })

  app.post('/stop', async (req, res) => {
    const chargePointId = req.body?.chargePointId || 'EVB-P20261797'
    const connectorId = req.body?.connectorId || 1
    let response = await server.remoteStopTransaction(chargePointId,connectorId)
    res.json(response)
  })

  app.listen(port, () => {
    console.log(`HTTP Server listening on port ${port}`)
  })
})




