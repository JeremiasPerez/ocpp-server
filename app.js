const express = require('express')
const app = express()
const port = 5000

const OCPPServer = require('./OCPPServer')

const server = new OCPPServer()

server.init().then(() => {
  app.get('/start', (req, res) => {
    server.remoteStartTransaction('EVB-P20261797','abc',1)
  })

  app.get('/stop', (req, res) => {
    server.remoteStopTransaction('EVB-P20261797')
  })

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
  })

})

