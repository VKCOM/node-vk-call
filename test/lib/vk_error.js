var chai = require('chai');
var sinon = require('sinon');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
var expect = chai.expect;

var module = require("../../lib/vk_error");

describe("VKError", () => {
  describe("construct", () => {

    it("return not domain error on failure", () => {
      var err = new Error("test");
      var cerror = module.construct(err);
      expect(cerror.type).to.equal(module.NOT_DOMAIN_ERROR);
      expect(cerror.name).to.equal(module.NOT_DOMAIN_NAME);
      expect(cerror.stack).to.equal(err.stack);
      expect(cerror.message).to.equal("Failure: test");
      expect(cerror.originalError).to.equal(err);
    });

    it("return domain error on error from API", () => {
      var err = {
        method: 'groups.getById',
        error_code: 100,
        error_msg: 'test'
      };

      var cerror = module.construct(err);
      expect(cerror.type).to.equal(module.WRONG_PARAMETER);
      expect(cerror.name).to.equal(module.DOMAIN_NAME);
      expect(cerror.message).to.equal("Domain error: test");
      expect(cerror.originalError).to.equal(err);
    });

  });
});
