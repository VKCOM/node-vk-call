var chai = require('chai');
var sinon = require('sinon');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
var expect = chai.expect;

var module = require('../../lib/api_caller');

const RESPONSE = [{
    id: 1,
    first_name: 'Павел',
    last_name: 'Дуров'
}];

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
  return Promise.resolve({ response: RESPONSE });
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
      timeout: 1,
      version: '5.45'
    }, false, spy)).eventually.deep.equal(RESPONSE);

    expect(spy).to.have.been.calledWith({
      baseUrl: "test",
      uri: '/method/users.get',
      body: "ids=1&access_token=0&v=5.45",
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
    }, false, returnFail)).be.rejectedWith(/Failure/);
  });

  it("handles errors", () => {
    return expect(module.apiCall("users.get", { ids: '1' }, {
      token: 0,
      api_url: "test",
      timeout: 1
    }, false, returnError)).be.rejectedWith(/Domain error/);
  });
});

describe('fn#execute', () => {

  const USERS_GET = [{
    id: 1,
    first_name: 'Павел',
    last_name: 'Дуров'
  }];

  const GROUPS_GET = [{
    id: 1,
    name: 'ВКонтакте API',
    screen_name: 'apiclub',
    is_closed: 0,
    type: 'group',
    is_admin: 0,
    is_member: 0,
    photo_50: 'https://pp.vk.me/...0001/e_5ba03323.jpg',
    photo_100: 'https://pp.vk.me/...0001/d_7bfe2183.jpg',
    photo_200: 'https://pp.vk.me/...0001/d_7bfe2183.jpg'
  }];

  const EXECUTE_ERROR = {
    error: {
      error_code: 12,
      error_msg: `Unable to compile code: ')' expected, ']' found in line 4`,
      request_params: [{
        key: 'oauth',
        value: '1'
      }, {
        key: 'method',
        value: 'execute'
      }, {
        key: 'code',
        value: `return [
          API.users.get({user_ids: 1}),
          API.groups.getById({grps_ids: 1}
        ];`
      }, {
        key: 'v',
        value: '5.50'
      }, {
        key: '_dev',
        value: '1'
      }]
    }
  };

  const GROUP_ERROR = {
    method: 'groups.getById',
    error_code: 100,
    error_msg: 'One of the parameters specified was missing or invalid: group_ids is undefined'
  };

  function returnOk() {
    return Promise.resolve({
      response: [USERS_GET, GROUPS_GET]
    })
  }

  function returnPartialOk() {
    return Promise.resolve({
      response: [USERS_GET, false],
      execute_errors: [GROUP_ERROR, {
        method: 'execute',
        error_code: 100,
        error_msg: 'One of the parameters specified was missing or invalid: group_ids is undefined'
      }]
    })
  }

  function returnFullError() {
    return Promise.resolve(EXECUTE_ERROR);
  }

  function returnFail() {
    return Promise.reject(new Error("timeout"));
  }

  var chainData, pr1, pr2, config, spy;

  beforeEach(() => {
    var res1, rej1, res2, rej2;

    pr1 = new Promise((res, rej) => {
      res1 = res;
      rej1 = rej;
    })

    config =  {
      token: 0,
      api_url: "test",
      timeout: 1,
      version: '5.45'
    };

    pr2 = new Promise((res, rej) => {
      res2 = res;
      rej2 = rej;
    })

    chainData = [{
      method: "users.get",
      params: { user_ids: 1 },
      resolve: res1,
      reject: rej1
    }, {
      method: "groups.getById",
      params: {
        group_ids: 1
      },
      resolve: res2,
      reject: rej2
    }];
  });

  it("makes batch request", () => {
    var spy = sinon.spy(returnOk);

    var result = module.execute(chainData, config, spy);
    var code = encodeURIComponent(`return [API.users.get({"user_ids":1}),API.groups.getById({"group_ids":1})];`);
    expect(spy).to.have.been.calledWith(({
      baseUrl: "test",
      uri: '/method/execute',
      body: `code=${code}&access_token=0&v=5.45`,
      method: 'POST',
      timeout: 1
    }));

    return Promise.all([
      expect(result).to.eventually.deep.equal([USERS_GET, GROUPS_GET]),
      expect(pr1).to.eventually.deep.equal(USERS_GET),
      expect(pr2).to.eventually.deep.equal(GROUPS_GET),
    ]);
  });

  it("correctly works with partial results", () => {
    var spy = sinon.spy(returnPartialOk);

    var result = module.execute(chainData, config, spy);
    return Promise.all([
      expect(result).to.eventually.deep.equal([USERS_GET, GROUP_ERROR]),
      expect(pr1).to.eventually.deep.equal(USERS_GET),
      expect(pr2).to.be.eventually.rejectedWith(/Domain error/)
    ]);
  });

  it("is correctly works with error result", () => {
    var spy = sinon.spy(returnFullError);
    var result = module.execute(chainData, config, spy);
    return Promise.all([
      expect(result).to.eventually.rejectedWith(/Domain error/),
      expect(pr1).to.eventually.rejectedWith(/Domain error/),
      expect(pr2).to.eventually.rejectedWith(/Domain error/)
    ]);
  });

  it("handles fails", () => {
    var spy = sinon.spy(returnFail);

    var result = module.execute(chainData, config, spy);

    return Promise.all([
      expect(result).to.eventually.rejectedWith(/Failure/),
      expect(pr1).to.eventually.rejectedWith(/Failure/),
      expect(pr2).to.eventually.rejectedWith(/Failure/)
    ]);
  });
});
