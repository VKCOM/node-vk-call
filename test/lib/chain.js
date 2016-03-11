var chai = require('chai');
var sinon = require('sinon');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
var expect = chai.expect;

var Chain = require('../../lib/chain').Chain;

describe("Chain", () => {
  var api;
  beforeEach(() => {
    api = { execute: sinon.spy(() => Promise.resolve("test")) };
  })

  describe("#constructor", () => {
    it("initialzies chain", () => {
      var api = {t: 1};
      var inst = new Chain(api);
      expect(inst.api).to.equal(api);
      expect(inst.chainData).to.deep.equal([]);
    });
  });

  describe("#append", () => {

    it("appends data to chain", () => {
      var chain = new Chain(api);
      chain.append("users.get", { id: 1 });
      expect(chain.chainData[0].method).to.equal("users.get");
      expect(chain.chainData[0].params).to.deep.equal({ id: 1 });
    });

    it("fails to append, if done was called", () => {
      var chain = new Chain(api);
      chain.append("users.get", { id: 1 });
      chain.done();
      expect(() => {
        chain.append("groups.getById", {group_ids: 1});
      }).to.throw(Error, /Can't append call after done/);
    });

  })

  describe("#done", () => {
    it("closes chain and sends execute request", () => {
      var chain = new Chain(api);
      chain.append("users.get", { id: 1 });
      var result = expect(chain.done()).to.eventually.equal("test");
      expect(api.execute).to.be.called;
      expect(chain.end).to.be.true;
      return result;
    })

    it("returns empty array on empty chain", () => {
      var chain = new Chain(api);
      return expect(chain.done()).to.eventually.deep.equal([]);
    });
  });
})
