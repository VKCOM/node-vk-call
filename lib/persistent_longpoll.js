const EventEmitter = require('events');
const assign = require('object-assign');
const pull = require('pull-stream');
const streamUtils = require('./stream_utils');
const probe = streamUtils.probe;
const repeater = streamUtils.repeater;
const cacher = streamUtils.cacher;
const asyncMapRecover = streamUtils.asyncMapRecover;

const DEFAULT_TIMEOUT = 1000;
const MAX_TIME_OUT = 16000;

const LONGPOLL_TIMEOUT = 35000;

const ERROR_TYPE_UNKNOWN = 'error_unknown';
const ERROR_TYPE_TS = 'error_ts';
const ERROR_TYPE_CREDS = 'error_creds';

const LP_ERROR_FAIL_TS = 1;
const LP_ERROR_FAIL_KEY = 2;

function makeUrl(creds) {
  return `${creds.server}?act=a_check&key=${creds.key}&ts=${creds.ts}&wait=25`;
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
    return http({
      timeout: LONGPOLL_TIMEOUT,
      url: makeUrl(assign({}, creds, mutable))
    }).then(function(body) {
      return JSON.parse(body);
    }).catch((error) => {
      return Promise.reject({
        type: ERROR_TYPE_UNKNOWN,
        error: error
      });
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
    });
  });
}

function isEnd(end) {
  return end === true;
}

function isCredsError(error) {
  return error && error.type === ERROR_TYPE_CREDS || isEnd(error);
}

function createPersistentLonpgollStream(api, rp, defaultTimeout = DEFAULT_TIMEOUT, maxTimeout = MAX_TIME_OUT) {
  return pull(
    pull.infinite(function() { return api; }),
    repeater(isEnd, defaultTimeout, maxTimeout),
    probe('creds'),
    credentialsStream,
    cacher(),
    probe('lp'),
    repeater(isCredsError, defaultTimeout, maxTimeout),
    longpollStream(rp, {}),
    probe('data')
  );
}

module.exports = {
  createPersistentLonpgollStream: createPersistentLonpgollStream,
  init(api, rp) {
    const sink = new EventEmitter();
    const drain = pull.drain(function(data) {
      sink.emit('data', data);
    });
    pull(
      createPersistentLonpgollStream(api, rp),
      drain
    );
    return { sink: sink, abort: function() { drain.abort(); } };
  }
}
