var assign = require('object-assign');
var rp = require('request-promise');
var caller = require('./api_caller');
var Chain = require('./chain').Chain;
var longpoll = require('./persistent_longpoll');

const DEFAULT_TIMEOUT = 5000;
const DEFAULTAPI = 'https://api.vk.com';
const CURRRENT_VERSION = '5.75';

exports.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;
exports.DEFAULTAPI = DEFAULTAPI;
exports.CURRRENT_VERSION = CURRRENT_VERSION;

exports.VK = function(config) {
  this.config = assign({}, {
    timeout: DEFAULT_TIMEOUT,
    api_url: DEFAULTAPI,
    version: CURRRENT_VERSION,
    groupId: null
  }, config);
}

exports.VK.prototype = {
  setToken(token) {
    this.config.token = token;
  },

  persistentLongpoll() {
    if (!this.config.groupId) {
      return Promise.reject(new Error("Only for group token usage only"));
    }
    return longpoll.init(this, rp);
  },

  call(method, params) {
    return caller.apiCall(method, params, this.config, false, rp);
  },

  execute(chainData) {
    return caller.execute(chainData, this.config, rp);
  },

  chain() {
    return new Chain(this);
  }
}
