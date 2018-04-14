const debug = require('debug');

/**
 * Through stream that remembers first value it got
 * and repeats it, propagates errors in both ways.
 */
function cacher() {
  let cache = false;
  return function(read) {
    return function readable(end, cb) {
      if (end === null && cache) {
        cb(null, cache);
      } else {
        read(end, function (end, data) {
          cache = data;
          cb(end, data)
        });
      }
    }
  }
}

/**
 * Simple through stream until it encounters
 * an error from downstream. Than it asks handleError:
 * if it returns true, than it will go for retry. Each consecutive retry
 * will double timeout until next retry with max value as maxTimeout.
 *
 * After first successful retry timeout will become defaultTimeout.
 *
 * It will always propagate upwards errrors to downstream.
 */
function repeater(handleError, defaultTimeout, maxTimeout) {
  let currentTimeout = defaultTimeout;
  return function(read) {
    return function readable(end, cb) {
      let propogate = end !== null ? handleError(end) : true;
      if (propogate) {
        currentTimeout = defaultTimeout;
        read(end, function (end, data) {
          cb(end, data)
        });
      } else {
        setTimeout(function() {
          read(null, function (end, data) {
            cb(end, data)
          });
        }, currentTimeout);
        currentTimeout = Math.min(currentTimeout * 2, maxTimeout);
      }
    }
  }
}

/**
 * This is like asyncMap, but it receives a function that returns promise.
 * And also it can recover from errors which was thrown by map function.
 *
 * After recieving an error, it will try to propagate this error upstream,
 * and only if upstream returns an error back, it will propagate it downstream.
 */
function asyncMapRecover(map) {
  return function(read) {
    let mapping = false;
    return function readable(end, cb) {
      read(end, function (end, data) {
        if (!end) {
          mapping = map(data)
            .then(function(data) {
              mapping = false;
              cb(null, data);
            }).catch(function(err) {
              mapping = false;
              setTimeout(() => {
                readable(err, cb);
              });
              return true;
            });
        } else {
          if (end === true && mapping) {
            mapping.cancel();
          }
          cb(end, data);
        }
      });
    }
  }
}

function probe(name) {
  var log = debug(name)

  return function (read) {
    log('received read function, returning source function')
    return function (abort, cb) {
      log('source(%O' + (cb ? ',[' + (typeof cb) + ']' : '') + ')', abort)
      read(abort, function next (err, data) {
        log('sink(%O, ' + (!err ? ', %O' : '') + ')', err, data)
        if (err) return cb(err)
        cb(err, data)
      })
    }
  }
}

module.exports = {
  probe: probe,
  repeater: repeater,
  cacher: cacher,
  asyncMapRecover: asyncMapRecover
};
