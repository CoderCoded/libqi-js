'use strict'

function Deferred (idm) {
  this.idm = idm

  var resolve
  var reject
  var promise = new Promise(function () {
    resolve = arguments[0]
    reject = arguments[1]
  })

  this.resolve = resolve
  this.reject = reject
  this.promise = promise
}

module.exports = function DeferredManager () {
  var idmCounter = 0
  var deferredMap = {}

  var create = function () {
    var idm = ++idmCounter
    deferredMap[idm] = new Deferred(idm)
    return deferredMap[idm]
  }

  var get = function (idm) {
    return deferredMap[idm]
  }

  var remove = function (deferred) {
    if (typeof deferred === 'object' && deferred.idm) {
      deferred = deferred.idm
    }
    delete deferredMap[deferred]
  }

  var resolve = function (idm, data) {
    var deferred = get(idm)
    if (deferred != null) {
      deferred.resolve(data)
      remove(deferred)
      return true
    }
    return false
  }

  var reject = function (idm, data) {
    var deferred = get(idm)
    if (deferred != null) {
      deferred.reject(data)
      remove(deferred)
      return true
    }
    return false
  }

  var rejectAll = function (reason) {
    for (var idm in deferredMap) {
      reject(idm)
    }
  }

  return {
    create: create,
    resolve: resolve,
    reject: reject,
    get: get,
    remove: remove,
    rejectAll: rejectAll
  }
}
