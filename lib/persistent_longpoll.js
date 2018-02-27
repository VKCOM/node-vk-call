const EventEmitter = require('events');
const rp = require('request-promise');
const assign = require('object-assign');

function makeUrl(creds) {
  return `${creds.server}?act=a_check&key=${creds.key}&ts=${creds.ts}&wait=25`;
}

function updateCreds(api) {
  return api.call("groups.getLongPollServer", {
    group_id: api.config.groupId
  });
}

const DEFAULT_TIMEOUT = 2;

function getNextTimeout(timeout) {
  return Math.min(60, timeout * 2);
}

function wait(fn, secs) {
  setTimeout(fn, secs * 1000);
}

function updateCredsAndPoll(api, sink, timeout) {
  return updateCreds(api).then((result) => {
    startPolling(api, result, sink, timeout);
    return sink;
  }).catch((error) => {
    sink.emit('error', error);
    return new Promise((resolve, reject) => {
      wait(() => {
        updateCredsAndPoll(api, sink, getNextTimeout(timeout))
          .then(resolve)
          .catch(reject);
      }, timeout);
    });
  })
}

function startPolling(api, creds, sink, timeout) {
  const newTimeout = getNextTimeout(timeout);
  const url = makeUrl(creds);
  return rp(url).then((body) => {
    const result = JSON.parse(body);
    if (result.failed) {
      sink.emit('lp_error', result);
      wait(updateCredsAndPoll.bind(null, api, sink, newTimeout), timeout);
    } else {
      sink.emit('data', result);
      const newCreds = assign(creds, {
        ts: result.ts
      });
      setImmediate(startPolling.bind(null, api, newCreds, sink, DEFAULT_TIMEOUT));
    }
  }).catch((error) => {
    sink.emit('error', error);
    wait(startPolling.bind(null, api, creds, sink, newTimeout), timeout);
  });
}

module.exports = function init(api) {
  const sink = new EventEmitter();
  return updateCredsAndPoll(api, sink, DEFAULT_TIMEOUT);
}
