var io = require('socket.io-client')
var qi = require('./lib/qi')(io)

module.exports = qi
