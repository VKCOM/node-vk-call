var vk = require('./lib/vk');

module.exports = {
  VK: vk.VK,
  DEFAULT_TIMEOUT: vk.DEFAULT_TIMEOUT,
  DEFAULTAPI: vk.DEFAULTAPI,
  CURRRENT_VERSION: vk.CURRRENT_VERSION,
  errors: require('./lib/vk_error')
};
