# libqi-js
Modified node.js version of [Aldebaran's libqi-js v2](https://github.com/aldebaran/libqi-js).

See COPYING for license

## Usage
For server-side nodejs usage use `require('libqi')`.

To use with webpack `require('libqi/browser')`
or configure an [alias](https://webpack.js.org/configuration/resolve/#resolve-alias) to point `'libqi'` to `'socket.io-client/dist/socket.io'`  

### Example

```javascript
var QiSession = require('libqi')

var session = QiSession({
  debug: true,
  host: '192.168.10.3', // Pepper's IP and port (defaults to 80)
  onConnect: function (/* session */) {
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
```
