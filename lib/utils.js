'use strict'

function Logger (opts) {
  var levels = {
    'ERROR': 1,
    'INFO': 2,
    'DEBUG': 3
  }
  var level = levels['ERROR']

  var _log = function (method, args) {
    var ts = new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000).toISOString().replace(/T(.*)Z$/, ' $1')
    var str = ts + ': ' + args[0]
    if (args.length > 1) {
      console[method](str)
      var rest = args.slice(1)
      for (var i in rest) {
        console[method](rest[i])
      }
    } else {
      console[method](str)
    }
  }

  var debug = function () {
    if (level < 3) { return }
    _log('log', Array.prototype.slice.call(arguments, 0))
  }

  var error = function () {
    if (level < 1) { return }
    _log('error', Array.prototype.slice.call(arguments, 0))
  }

  var setLevel = function (val) {
    level = levels[val] || levels['ERROR']
  }

  return {
    setLevel: setLevel,
    debug: debug,
    error: error
  }
}

module.exports = {
  Logger
}
