var assign = require('object-assign');
var constructError = require('./vk_error').construct;

var encode = encodeURIComponent;

function prepareQs(params, config) {
  if (typeof config.token !== 'undefined') {
    params.access_token = config.token;
  }

  params.v = config.version;
  return Object.keys(params)
    .map(key => encode(key) + '=' + encode(params[key]))
    .join('&');
}

function toApiCall(inst) {
  return `API.${inst.method}(${JSON.stringify(inst.params)})`;
}

function chainToCode(chain) {
  return `return [${chain.map(toApiCall).join(',')}];`;
}

exports.apiCall = function(method, params, config, raw, rp) {
  return rp({
    baseUrl: config.api_url,
    uri: '/method/' + method,
    body: prepareQs(params, config),
    method: 'POST',
    timeout: config.timeout
  }).then((res) => {
    if (typeof res === 'string') {
      return JSON.parse(res);
    }
    return res;
  }).catch(error => {
    throw constructError(error);
  }).then(data => {
    if (data.error) {
      throw constructError(data.error);
    }
    return raw ? data : data.response;
  });
}

exports.execute = function(chain, config, rp) {
  var code = chainToCode(chain);
  return exports.apiCall('execute', { code: code }, config, true, rp)
    .then(data => {
      var errors = 0;
      return data.response.map((el, i) => {
        var resp;
        if (el) {
          resp = el;
          setImmediate(_ => chain[i].resolve(el));
        } else {
          resp = data.execute_errors[errors++];
          setImmediate(_ => chain[i].reject(constructError(resp)));
        }
        return resp;
      });
    }).catch(error => {
      chain.forEach(inst => setImmediate(_ => inst.reject(error)));
      throw error;
    });
}
