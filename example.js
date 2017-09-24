var QiSession = require('./index')

var session = QiSession({
  debug: true,
  reconnect: false,
  host: '192.168.10.3', // Pepper's IP
  onConnect: function (/* session is also returned here */) {
    console.log('Connected...')
    session
      .service('ALTextToSpeech')
      .then(function (tts) {
        return tts.say('Hello World!')
      })
      .then(function () {
        console.log('Done...')
        session.disconnect()
      })
  },
  onDisconnect: function () {
    console.log('Disconnected. Bye!')
  }
})
