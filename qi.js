/*
**  Copyright (C) Aldebaran Robotics
**  See COPYING for the license
**  Author(s):
**   - Laurent LEC    <llec@aldebaran-robotics.com>
**  Modified by:
**   - Coder Coded OY
*/

// Tested to work in at least
// Firefox 48, Chrome 51 and Safari 9.1.1
var defer = function () {
  var resolve
  var reject
  var promise = new Promise(function () {
    resolve = arguments[0]
    reject = arguments[1]
  })
  return {
    resolve: resolve,
    reject: reject,
    promise: promise
  }
}

var uuidv4 = function(a,b){for(b=a='';a++<36;b+=a*51&52?(a^15?8^Math.random()*(a^20?16:4):4).toString(16):'-');return b} // eslint-disable-line
var noop = function () {}

function isPojo (obj) {
  if (obj === null || typeof obj !== 'object') {
    return false
  }
  return Object.getPrototypeOf(obj) === Object.prototype
}

module.exports = function (io) {
  /**
   * @callback onConnect
   * @param {function} session - The QiSession
   */

  /**
   * @callback onDisconnect
   * @param {string} reason - The reason for disconnect
   */

  /**
   * @callback onError
   */

  /**
   * Create a new qi session
   * @param {Object} opts
   * @param {string} opts.host - Hostname
   * @param {boolean} opts.debug - Print debug info
   * @param {onConnect} opts.onConnect - onConnect callback handler
   * @param {onDisconnect} opts.onDisconnect - onDisconnect callback handler
   * @param {onError} opts.onError - onError callback handler
   * @return QiSession object that can be used to access Pepper services
   */
  return function QiSession (opts) {
    if (!isPojo(opts)) {
      throw new Error('First argument must be an object')
    }

    if (!opts.hasOwnProperty('host')) {
      throw new Error('Missing \'host\' property in the options')
    }

    var handleConnect = opts.onConnect || noop
    var handleDisconnect = opts.onDisconnect || noop
    var handleError = opts.onError || noop

    var api = {
      debug: opts.debug
    }

    var pepper = io.connect('http://' + opts.host, {
      'resource': 'libs/qimessaging/2/socket.io',
      'force new connection': true,
      'transports': ['websocket'],
      'connect timeout': 5000,
      'try multiple transports': false,
      'auto connect': false,
      'reconnect': false
    })

    var _deferred = {}
    var _sigs = {} // Signals
    var _idm = 0  // Counter for response-reply ids so we can resolve the correct promise
    var uid = uuidv4()

    function debug () {
      if (!api.debug) { return }
      var ts = new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000).toISOString().replace(/T(.*)Z/, ' $1')
      var args = Array.prototype.slice.call(arguments, 0)
      var str = ts + ': ' + args[0]
      if (args.length > 1) {
        if (isPojo(args[1])) {
          console.log(str, '')
          console.log(args[1])
          return
        }
        console.log.apply(console, [str].concat(args[1]))
      } else {
        console.log(str)
      }
    }

    pepper.socket.on('connecting', function () {
      debug('Socket connecting...')
    })

    pepper.socket.on('reconnecting', function (delay, attempts) {
      debug('Socket reconnecting...')
      debug('Delay: %d', delay)
      debug('Attempt #%d', attempts)
    })

    pepper.socket.on('reconnect_failed', function () {
      debug('reconnect_failed')
    })

    pepper.socket.on('connect_failed', function () {
      debug('connect_failed')
    })

    pepper.socket.on('connect_error', function (data) {
      debug('connect_error %s', data)
    })

    pepper.socket.on('connect_timeout', function (data) {
      debug('connect_timeout %s', data)
    })

    pepper.socket.on('reconnect', function (data) {
      debug('Socket attempting reconnect')
      debug('reconnect %s', data)
    })

    pepper.socket.on('disconnect', function (reason) {
      debug('Socket disconnect')
      debug('Reason: %s', reason)
    })

    pepper.on('reply', function (data) {
      var idm = data.idm
      var i
      if (data.result != null && data.result.metaobject != null) {
        debug('Received metaobject reply!')
        // debug('Metaobject reply %s', data.result.metaobject)
        var o = {}
        o.__MetaObject = data.result.metaobject
        var pyobj = data.result.pyobject
        _sigs[pyobj] = {}

        var methods = o.__MetaObject.methods
        for (i in methods) {
          var methodName = methods[i].name
          o[methodName] = createMetaCall(pyobj, methodName)
        }

        var signals = o.__MetaObject.signals
        for (i in signals) {
          var signalName = signals[i].name
          o[signalName] = createMetaSignal(pyobj, signalName, false)
        }

        var properties = o.__MetaObject.properties
        for (i in properties) {
          var propertyName = properties[i].name
          o[propertyName] = createMetaSignal(pyobj, propertyName, true)
        }

        _deferred[idm].resolve(o)
      } else {
        // debug('Command reply', util.inspect(data, {depth: null}))
        if (_deferred[idm].__cbi != null) {
          var cbi = _deferred[idm].__cbi
          _sigs[cbi.obj][cbi.signal][data.result] = cbi.cb
        }

        debug('Resolving the pending promise for idm %s', idm)
        _deferred[idm].resolve(data.result)
      }
      delete _deferred[idm]
    })

    pepper.on('error', function (data) {
      console.error('Socket error!!!')
      console.error(data)
      // if (handleError) handleError(data)

      if (data.idm != null && _deferred[data.idm] != null) {
        _deferred[data.idm].reject(data.result)
        delete _deferred[data.idm]
      } else if (typeof handleError === 'function') {
        // There was no promise attached to this request so pass it to
        // error handler
        handleError()
      }
    })

    pepper.on('signal', function (data) {
      debug('signal %s', data)
      var res = data.result
      var callback = _sigs[res.obj][res.signal][res.link]
      if (callback != null) {
        callback.apply(this, res.data)
      }
    })

    pepper.on('disconnect', function (reason) {
      debug('Triggered socket.io disconnect event handler')
      debug('Reason for disconnect was "%s"', reason)

      for (var idm in _deferred) {
        _deferred[idm].reject('Call ' + idm + ' canceled: disconnected')
        delete _deferred[idm]
      }

      if (handleDisconnect) {
        handleDisconnect(reason)
      }
    })

    function createMetaCall (obj, member, data) {
      return function metaCall (/* args */) {
        var idm = ++_idm
        var args = Array.prototype.slice.call(arguments, 0)

        _deferred[idm] = defer()
        // var promise = new Promise(function (resolve, reject) {
        //   _deferred[idm] = { resolve: resolve, reject: reject }
        // })
        if (args[0] === 'connect') {
          _deferred[idm].__cbi = data
        }

        var callData = { idm: idm, params: { obj: obj, member: member, args: args } }

        debug('callData: %s', callData)

        pepper.emit('call', callData)
        return _deferred[idm].promise
      }
    }

    function createMetaSignal (obj, signal, isProperty) {
      var s = {}
      _sigs[obj][signal] = {}

      s.connect = function (cb) {
        return createMetaCall(obj, signal, { obj: obj, signal: signal, cb: cb })('connect')
      }

      s.disconnect = function (link) {
        debug('Triggered Aldebaran disconnect handler')
        delete _sigs[obj][signal][link]
        return createMetaCall(obj, signal)('disconnect', link)
      }

      if (!isProperty) {
        return s
      }

      s.setValue = function () {
        var args = Array.prototype.slice.call(arguments, 0)
        return createMetaCall(obj, signal).apply(this, ['setValue'].concat(args))
      }

      s.value = function () {
        return createMetaCall(obj, signal)('value')
      }

      return s
    }

    api.service = createMetaCall('ServiceDirectory', 'service')

    api.disconnect = function () {
      debug('Calling disconnect on pepper socket')
      try {
        // pepper.socket.reconnecting = false
        pepper.disconnect()
      } catch (e) {
        debug('Error while disconnecting')
        debug(e)
        handleError(e)
      }
    }

    api.connect = function () {
      if (pepper.socket.reconnecting) {
        debug('Already attempting reconnect, ignoring connect call')
        return
      }
      if (pepper.socket.connecting) {
        debug('Already attempting connect, ignoring connect call')
        return
      }
      pepper.socket.connect()
    }

    pepper.on('connect', function () {
      debug('Connect event fired')
      if (handleConnect) {
        handleConnect(api)
      }
    })

    api.pepper = pepper

    api.connect()

    return api
  }
}
