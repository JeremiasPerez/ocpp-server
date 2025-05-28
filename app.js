const express = require('express')
const app = express()
const port = 5000

const OCPPServer = require('./OCPPServer')

const server = new OCPPServer()

server.init().then(() => {
  app.post('/start', async (req, res) => {
    console.log("start received")
    let response = await server.remoteStartTransaction('EVB-P20261797','abc',1)
    res.json(response)
  })

  app.post('/stop', async (req, res) => {
    let response = await server.remoteStopTransaction('EVB-P20261797',1)
    res.json(response)
  })

  app.listen(port, () => {
    console.log(`HTTP Server listening on port ${port}`)
  })

})

