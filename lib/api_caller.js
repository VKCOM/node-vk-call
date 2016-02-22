var assign = require('object-assign');
var constructError = require('./vk_error').construct;

var encode = encodeURIComponent;

function prepareQs(params, config) {
  params = assign({}, params, {
    token: config.token
  });

  return Object.keys(params)
    .map(key => encode(key) + '=' + encode(params[key]))
    .join('&');
}

function toApiCall(inst) {
  return `API.${inst.method}(${JSON.stringify(inst.params)})`;
}

function chainToCode(chain) {
  return `return [
    ${chain.map(toApiCall).join(',')}
  ];`;
}

exports.apiCall = function(method, params, config, rp) {
  return rp({
    baseUrl: config.api_url,
    uri: '/method/' + method,
    body: prepareQs(params, config),
    method: 'POST',
    timeout: config.timeout
  }).catch(error => {
    throw constructError(error);
  }).then(data => {
    if (data.error) {
      throw constructError(data.error);
    }
    return data;
  });
}

exports.execute = function(chain, config, rp) {
  var code = chainToCode(chain);
  return apiCall('execute', { code: code }, config, rp)
    .then(data => {
      var erros = 0;
      return data.response.map((el, i) => {
        var resp;
        if (el) {
          resp = el;
          setImmediate(_ => chain[i].resolve(el));
        } else {
          resp = data.execute_errors[errors++];
          setImmediate(_ => chain[i].reject(resp));
        }
        return resp;
      });
    }).catch(error => {
      chain.forEach(inst => setImmediate(_ => inst.reject(error)));
      throw error;
    });
}
