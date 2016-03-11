var assign = require('object-assign');
var rp = require('request-promise');
var caller = require('./api_caller');
var Chain = require('./chain').Chain;

const DEFAULT_TIMEOUT = 5000;
const DEFAULTAPI = 'https://api.vk.com';
const CURRRENT_VERSION = '5.45';

exports.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;
exports.DEFAULTAPI = DEFAULTAPI;
exports.CURRRENT_VERSION = CURRRENT_VERSION;

exports.vk = function(config) {
  this.config = assign({}, {
    timeout: DEFAULT_TIMEOUT,
    api_url: DEFAULTAPI,
    version: CURRRENT_VERSION
  }, config);
}

exports.vk.prototype = {
  setToken(token) {
    this.config.token = token;
  },

  call(method, params) {
    return caller.apiCall(method, params, config, rp);
  },

  execute(chainData) {
    return caller.execute(chainData, this.config, rp);
  },

  chain() {
    return new Chain(this);
  }
}
