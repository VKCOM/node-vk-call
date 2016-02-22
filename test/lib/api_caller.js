var chai = require('chai');
var sinon = require('sinon');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
var expect = chai.expect;

var module = require('../../lib/api_caller');
var construct = require('../../lib/vk_error').construct;
var VKError = require('../../lib/vk_error').VKError;

const RESPONSE = {
  response: [{
    id: 1,
    first_name: 'Павел',
    last_name: 'Дуров'
  }]
}

const ERROR = {
  error: {
    error_code: 7,
    error_msg: 'Permission to perform this action is denied: you are not allowed to send messages to community with id 70034991',
    request_params: [{
      key: 'oauth',
      value: '1'
    }, {
      key: 'method',
      value: 'messages.send'
    }, {
      key: 'message',
      value: 'Test message'
    }, {
      key: 'notification',
      value: '0'
      }, {
      key: 'peer_id',
      value: '-70034991'
    }, {
      key: 'v',
      value: '5.45'
    }, {
      key: '_dev',
      value: '1'
    }]
  }
}

function returnOk() {
  return Promise.resolve(RESPONSE);
}

function returnFail() {
  return Promise.reject(new Error('test error'));
}

function returnError() {
  return Promise.resolve(ERROR);
}

describe('fn#apiCall', () => {
  var spy = sinon.spy(returnOk);

  it("make correct request", () => {
    var req = expect(module.apiCall("users.get", { ids: '1' }, {
      token: 0,
      api_url: "test",
      timeout: 1
    }, spy)).eventually.deep.equal(RESPONSE);

    expect(spy).to.have.been.calledWith({
      baseUrl: "test",
      uri: '/method/users.get',
      body: "ids=1&token=0",
      method: 'POST',
      timeout: 1
    });

    return req;
  });

  it("handles failures", () => {
    return expect(module.apiCall("users.get", { ids: '1' }, {
      token: 0,
      api_url: "test",
      timeout: 1
    }, returnFail)).be.rejectedWith(/Failure/);
  });

  it("handles errors", () => {
    return expect(module.apiCall("users.get", { ids: '1' }, {
      token: 0,
      api_url: "test",
      timeout: 1
    }, returnError)).be.rejectedWith(/Domain error/);
  });
});
