var io = require('socket.io-client/dist/socket.io')
var qi = require('./lib/qi')(io)

module.exports = qi
