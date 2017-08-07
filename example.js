var QiSession = require('./node')

var session = QiSession({
  debug: true,
  host: '192.168.10.3', // Pepper's IP
  onConnect: function () {
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
