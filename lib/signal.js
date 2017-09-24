'use strict'

module.exports = function SignalManager () {
  var handlers = {}

  var uid = function (obj, signal, link) {
    return [obj, signal, link].join('_')
  }

  var register = function (obj, signal, link, cb) {
    handlers[uid(obj, signal, link)] = cb
  }

  var unregister = function (obj, signal, link) {
    delete handlers[uid(obj, signal, link)]
  }

  var unregisterAll = function () {
    handlers = {}
  }

  var trigger = function (obj, signal, link, data) {
    var handler = handlers[uid(obj, signal, link)]
    if (handler != null) {
      handler.apply(undefined, data)
    }
  }

  return {
    register: register,
    unregister: unregister,
    unregisterAll: unregisterAll,
    trigger: trigger
  }
}
