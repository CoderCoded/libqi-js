'use strict'
/*
**  Copyright (C) Aldebaran Robotics
**  See COPYING for the license
**  Author(s):
**   - Laurent LEC    <llec@aldebaran-robotics.com>
**  Modified by:
**   - Coder Coded Oy
*/
var utils = require('./utils')
var DeferredManager = require('./deferred')
var SignalManager = require('./signal')

var Logger = utils.Logger

module.exports = function (io) {
  /**
   * @callback onConnect
   * @param {Object} session - The QiSession object
   */

  /**
   * @callback onDisconnect
   * @param {string} reason - The reason for disconnect
   */

  /**
   * Create a new qi session
   * @param {Object} opts
   * @param {string} opts.host - Hostname
   * @param {boolean} opts.debug - Print debug info
   * @param {onConnect} opts.onConnect - onConnect callback handler
   * @param {onDisconnect} opts.onDisconnect - onDisconnect callback handler
   * @return QiSession object that can be used to access Pepper services
   */
  return function QiSession (opts) {
    opts = opts || {}
    if (!('host' in opts)) {
      throw new Error('Missing \'host\' property in options')
    }

    var handleConnect = opts.onConnect || function () {}
    var handleDisconnect = opts.onDisconnect || function () {}

    var qi = {}

    var socketio = io.connect('http://' + opts.host, {
      'resource': 'libs/qimessaging/2/socket.io',
      'force new connection': true,
      'transports': ['websocket'],
      'connect timeout': 5000,
      'try multiple transports': false,
      'auto connect': false,
      'reconnect': ('reconnect' in opts) ? opts.reconnect : true
    })

    var deferredManager = DeferredManager()
    var signalManager = SignalManager()
    var log = Logger()
    log.setLevel(opts.debug ? 'DEBUG' : 'ERROR')
    var debug = log.debug

    function createMetaCall (obj, member) {
      return function metaCall (/* ...args */) {
        var args = Array.prototype.slice.call(arguments, 0)

        var deferred = deferredManager.create()

        var callData = {
          idm: deferred.idm, // The unique id so we can match the call response later
          params: {
            obj: obj,
            member: member,
            args: args
          }
        }

        debug('callData:', callData)

        socketio.emit('call', callData)
        return deferred.promise
      }
    }

    function createMetaSignal (obj, signal, isProperty) {
      var s = {}

      s.connect = function (cb) {
        return createMetaCall(obj, signal)('connect')
          .then(function (link) {
            // This gets called when Pepper acknowledges the Service.signal.connect() call
            // and returns an unique subscription link id
            signalManager.register(obj, signal, link, cb)
            return link
          })
      }

      s.disconnect = function (link) {
        return createMetaCall(obj, signal)('disconnect', link)
          .then(function (res) {
            signalManager.unregister(obj, signal, link)
            return res
          })
      }

      if (!isProperty) {
        return s
      }

      s.setValue = function () {
        var args = Array.prototype.slice.call(arguments, 0)
        return createMetaCall(obj, signal).apply(undefined, ['setValue'].concat(args))
      }

      s.value = function () {
        return createMetaCall(obj, signal)('value')
      }

      return s
    }

    /**
     * Parse service metadata into a Javascript object
     * @param {Object} data
     * @param {string} data.pyobject - The unique identifier for Pepper's internal service object
     * @param {Object} data.metaobject - Object containing service methods, signals and properties
     */
    function parseMetaObject (data) {
      var i
      var obj = {}
      var pyobj = data.pyobject
      var methods = data.metaobject.methods

      // Save the raw metaobject as metadata
      obj.__MetaObject = data.metaobject

      for (i in methods) {
        var methodName = methods[i].name
        obj[methodName] = createMetaCall(pyobj, methodName)
      }

      var signals = data.metaobject.signals
      for (i in signals) {
        var signalName = signals[i].name
        obj[signalName] = createMetaSignal(pyobj, signalName, false)
      }

      var properties = data.metaobject.properties
      for (i in properties) {
        var propertyName = properties[i].name
        obj[propertyName] = createMetaSignal(pyobj, propertyName, true)
      }

      return obj
    }

    function handleReply (data) {
      var idm = data.idm

      if (data.result != null && data.result.metaobject != null) {
        debug('Received metaobject reply for object ' + data.result.pyobject)
        deferredManager.resolve(idm, parseMetaObject(data.result))
      } else {
        debug('Resolving pending promise for idm ' + idm)
        deferredManager.resolve(idm, data.result)
      }
    }

    function handleError (data) {
      if (!deferredManager.reject(data.idm, new Error(data.result))) {
        // There was no promise attached to this request and the
        // promise could not be resolved. Raise an error.
        log.error('Error with no promise attached!')
        log.error(data)
        // Call disconnect handler since this error most
        // likely occurred so that the connection was lost
        handleDisconnect(data)
      }
    }

    function handleSignal (data) {
      debug('Signal triggered ', data)
      var d = data.result
      signalManager.trigger(d.obj, d.signal, d.link, d.data)
    }

    function handleSocketConnect () {
      debug('Connect event fired')
      handleConnect(qi)
    }

    function handleSocketDisconnect (reason) {
      debug('Disconnect event fired. Reason for disconnect was "' + reason + '"')

      deferredManager.rejectAll(new Error('disconnected'))
      signalManager.unregisterAll()

      handleDisconnect(reason)
    }

    function handleSocketConnecting (transport) {
      debug('Socketio connecting through ' + transport + ' ...')
    }

    function handleSocketReconnecting (delay, attempts) {
      debug('Reconnecting...\n    Delay: ' + delay + 'ms\n    Attempts: ' + attempts)
    }

    // Command replies from Pepper
    socketio.on('reply', handleReply)
    // Command (and initial connection) errors from Pepper
    socketio.on('error', handleError)
    // Signals from Pepper
    socketio.on('signal', handleSignal)

    // Socket events
    socketio.on('connect', handleSocketConnect)
    socketio.on('disconnect', handleSocketDisconnect)
    socketio.socket.on('reconnecting', handleSocketReconnecting)
    socketio.socket.on('connecting', handleSocketConnecting)

    /*
     * QiSession API
     */
    qi.service = createMetaCall('ServiceDirectory', 'service')

    qi.disconnect = function () {
      debug('Calling disconnect on pepper socket')
      try {
        socketio.disconnect()
      } catch (e) {
        log.error('Error while disconnecting')
        handleDisconnect(e)
      }
    }

    // Just a wrapper for the internal socket.connect()
    qi.connect = function () {
      if (socketio.socket.connected || socketio.socket.connecting || socketio.socket.reconnecting) {
        debug('Already connecting/connected...')
        return
      }
      socketio.socket.connect()
    }

    // Call connect automatically
    qi.connect()

    return qi
  }
}
