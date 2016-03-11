var chai = require('chai');
var sinon = require('sinon');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
var expect = chai.expect;

var module = require('../../lib/vk');
var Chain = require('../../lib/chain').Chain;

describe('vk', () => {
  describe("#constructor", () => {

    it("creates instance with default values", () => {
      var inst = new module.vk({
        token: 1
      });

      expect(inst.config).to.deep.equal({
        token: 1,
        timeout: module.DEFAULT_TIMEOUT,
        api_url: module.DEFAULTAPI,
        version: module.CURRRENT_VERSION
      })
    });

    it("creates instance with custom values", () => {
      var conf = {
        token: 1,
        timeout: 100,
        api_url: "http://google.com",
        version: "5.43"
      };
      var inst = new module.vk(conf);

      expect(inst.config).to.deep.equal(conf);
    })
  });

  describe("#setToken", () => {
    it("sets token", () => {
      var inst = new module.vk({
        token: 1
      });
      inst.setToken(2);

      expect(inst.config.token).to.equal(2);
    });
  });

  describe("#chain", () => {
    it("returns initialized chain object", () => {
      var inst = new module.vk({ token: 2 });
      var chain = inst.chain();
      expect(chain.api).to.equal(inst);
      expect(chain).to.be.instanceof(Chain)
    })
  });
});
