const EventEmitter = require('events');
const rp = require('request-promise');
const assign = require('object-assign');
const pull = require('pull-stream');
const debug = require('debug');

const DEFAULT_TIMEOUT = 1000;
const MAX_TIME_OUT = 16000;

const ERROR_TYPE_UNKNOWN = 'error_unknown';
const ERROR_TYPE_TS = 'error_ts';
const ERROR_TYPE_CREDS = 'error_creds';

const LP_ERROR_FAIL_TS = 1;
const LP_ERROR_FAIL_KEY = 2;

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

function makeUrl(creds) {
  return `${creds.server}?act=a_check&key=${creds.key}&ts=${creds.ts}&wait=25`;
}

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
              cb(err, null);
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

/**
 * This stream requests API for longpoll credentials.
 */
const credentialsStream = asyncMapRecover(function(api) {
  return api.call("groups.getLongPollServer", {
    group_id: api.config.groupId
  }).catch((error) => {
    return Promise.reject({
      type: ERROR_TYPE_UNKNOWN,
      error: error
    });
  });
});

/**
 * Stream that requests longpoll and processes its data. Can throw errors in case
 * longpoll request returned error, or if failed parameter present in response.
 */
function longpollStream(http, mutable) {
  return asyncMapRecover(function(creds) {
    return http(makeUrl(assign({}, creds, mutable))).then(function(body) {
      return JSON.parse(body);
    }).then(function(response) {
      switch (response.failed) {
        case LP_ERROR_FAIL_TS:
          mutable.ts = response.ts;
          return Promise.reject({ type: ERROR_TYPE_TS })
        case LP_ERROR_FAIL_KEY:
          return Promise.reject({ type: ERROR_TYPE_CREDS })
        default:
          mutable.ts = response.ts;
          return response.updates;
      }
    }).catch((error) => {
      return Promise.reject({
        type: ERROR_TYPE_UNKNOWN,
        error: error
      });
    });
  });
}

function isEnd(end) {
  return end === true;
}

function isCredsError(error) {
  return error && error.type === ERROR_TYPE_CREDS || isEnd(error);
}

module.exports = function init(api) {
  const sink = new EventEmitter();
  const drain = pull.drain(function(data) {
    sink.emit('data', data);
  });
  pull(
    pull.infinite(function() { return api; }),
    repeater(isEnd, DEFAULT_TIMEOUT, MAX_TIME_OUT),
    probe('creds'),
    credentialsStream,
    cacher(),
    repeater(isCredsError, DEFAULT_TIMEOUT, MAX_TIME_OUT),
    probe('lp'),
    longpollStream(rp, {}),
    probe('data'),
    drain
  );
  return { sink: sink, abort: function() { drain.abort(); } };
}
