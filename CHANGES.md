# Changelog

These releases follow [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 1.0.0

Changed how the project is imported.  
Rewrote most of the original code to be more clear.

### Breaking Changes
- Project is now imported by using require('libqi') instead of require('libqi/node')
- See README for usage with Webpack

### Changes

- Added reconnect option (default: true)
- Removed onError option. This does not affect promise rejection.
- onDisconnect will now be called when an unhandled error is emitted by socketio.  
  This only happens when the connection drops unexpectedly.
- Changed all rejected promises to return Error wrapped objects
- Other minor fixes


## 0.0.3

Initial stable version
