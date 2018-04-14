const chai = require('chai');
const sinon = require('sinon');
const pull = require('pull-stream');
const assign = require('object-assign');
const Bluebird = require('bluebird');
Bluebird.config({
  cancellable: true
});

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
const expect = chai.expect;

const wrapStreamAssert = require('../test_utils').wrapStreamAssert;
const ptlp = require("../../lib/persistent_longpoll");

const response = {
  ts: 10,
  updates: [[80, 10]]
};
const config = {
  server: 'test',
  key: 'test2',
  ts: 10
};

describe("Persistent longpoll", () => {
  it("creates lp stream that works", (done) => {
    const api = {
      call: sinon.spy((test, obk) => {
        return Promise.resolve(config)
      }),
      config: {
        groupId: 1
      }
    };
    const rp = sinon.spy((test) => {
      return Promise.resolve(JSON.stringify(response))
    });
    pull(ptlp.createPersistentLonpgollStream(api, rp), wrapStreamAssert(done, (data => {
      expect(data).to.eql([[80, 10]])
      return false;
    }), () => {
      expect(rp).to.be.calledWith('test?act=a_check&key=test2&ts=10&wait=25');
      expect(api.call).to.be.calledWith('groups.getLongPollServer', {
        group_id: 1
      });
    }))
  });

  it("not requesting creds on normal run", (done) => {
    const api = {
      call: sinon.spy((test, obk) => {
        return Promise.resolve(config)
      }),
      config: {
        groupId: 1
      }
    };
    const rp = sinon.spy((test) => {
      return Promise.resolve(JSON.stringify(response))
    });
    let times = 0;
    pull(ptlp.createPersistentLonpgollStream(api, rp), wrapStreamAssert(done, (data => {
      expect(data).to.eql([[80, 10]])
      if (++times > 1) {
        return false;
      }
    }), () => {
      expect(rp).to.be.calledWith('test?act=a_check&key=test2&ts=10&wait=25');
      expect(api.call).to.be.calledWith('groups.getLongPollServer', {
        group_id: 1
      });
      expect(rp).to.be.calledTwice;
      expect(api.call).to.be.calledOnce;
    }))
  });

  it("handles failed: 1", (done) => {
    const api = {
      call: sinon.spy((test, obk) => {
        return Promise.resolve(config)
      }),
      config: {
        groupId: 1
      }
    };
    let times = 0;
    const rp = sinon.spy((test) => {
      times++
      if (times > 1) {
        return Promise.resolve(JSON.stringify(response));
      }
      return Promise.resolve(JSON.stringify({
        ts: 11,
        failed: 1
      }))
    });
    pull(ptlp.createPersistentLonpgollStream(api, rp, 20, 20), wrapStreamAssert(done, (data => {
      expect(data).to.eql([[80, 10]])
      return false;
    }), (end) => {
      expect(rp).to.be.calledWith('test?act=a_check&key=test2&ts=10&wait=25');
      expect(rp).to.be.calledWith('test?act=a_check&key=test2&ts=11&wait=25');
      expect(api.call).to.be.calledWith('groups.getLongPollServer', {
        group_id: 1
      });
      expect(api.call).to.be.calledOnce;
      expect(rp).to.have.been.calledTwice;
    }))
  });

  it("handles failed: 2", (done) => {
    let times = 0;
    const api = {
      call: sinon.spy((test, obk) => {
        if (times > 0) {
          return Promise.resolve(assign({}, config, {
            ts: 11,
            key: 'test3'
          }));
        }
        return Promise.resolve(config)
      }),
      config: {
        groupId: 1
      }
    };
    const rp = sinon.spy((test) => {
      times++
      if (times > 1) {
        return Promise.resolve(JSON.stringify(response));
      }
      return Promise.resolve(JSON.stringify({
        failed: 2
      }))
    });
    pull(ptlp.createPersistentLonpgollStream(api, rp, 20, 20), wrapStreamAssert(done, (data => {
      expect(data).to.eql([[80, 10]])
      return false;
    }), (end) => {
      expect(rp).to.be.calledWith('test?act=a_check&key=test2&ts=10&wait=25');
      expect(rp).to.be.calledWith('test?act=a_check&key=test3&ts=11&wait=25');
      expect(api.call).to.be.calledWith('groups.getLongPollServer', {
        group_id: 1
      });
      expect(api.call).to.be.calledTwice;
      expect(rp).to.have.been.calledTwice;
    }))
  });

  it("handles unkown lp errors", (done) => {
    const api = {
      call: sinon.spy((test, obk) => {
        return Promise.resolve(config)
      }),
      config: {
        groupId: 1
      }
    };
    let times = 0;
    const rp = sinon.spy((test) => {
      times++
      if (times > 1) {
        return Promise.resolve(JSON.stringify(response));
      }
      return Promise.reject(new Error('Network error!'));
    });
    pull(ptlp.createPersistentLonpgollStream(api, rp, 20, 20), wrapStreamAssert(done, (data => {
      expect(data).to.eql([[80, 10]])
      return false;
    }), (end) => {
      expect(rp).to.be.calledWith('test?act=a_check&key=test2&ts=10&wait=25');
      expect(api.call).to.be.calledWith('groups.getLongPollServer', {
        group_id: 1
      });
      expect(api.call).to.be.calledOnce;
      expect(rp).to.have.been.calledTwice;
    }))
  });

  it("handles unkown api errors", (done) => {
    let times = 0;
    const api = {
      call: sinon.spy(() => {
        if (++times > 1) {
          return Promise.resolve(config)
        }
        return Promise.reject(new Error('Internal server error!'));
      }),
      config: {
        groupId: 1
      }
    };
    const rp = sinon.spy((test) => {
      return Promise.resolve(JSON.stringify(response));
    });
    pull(ptlp.createPersistentLonpgollStream(api, rp, 20, 20), wrapStreamAssert(done, (data => {
      expect(data).to.eql([[80, 10]])
      return false;
    }), (end) => {
      expect(rp).to.be.calledWith('test?act=a_check&key=test2&ts=10&wait=25');
      expect(api.call).to.be.calledWith('groups.getLongPollServer', {
        group_id: 1
      });
      expect(api.call).to.be.calledTwice;
      expect(rp).to.have.been.calledOnce;
    }))
  });

  it("handles abort", (done) => {
    let times = 0;
    let promise;
    const api = {
      call: sinon.spy(() => {
        promise = new Bluebird((resolve) => {
          setTimeout(() => resolve(config), 1000);
        });
        return promise;
      }),
      config: {
        groupId: 1
      }
    };
    const rp = sinon.spy((test) => {
      return Promise.resolve(JSON.stringify(response));
    });
    const drain = wrapStreamAssert(done, (data => {
      throw new Error('Should not emit data!')
    }), (end) => {
      expect(end).to.be.null;
      expect(api.call).to.be.calledWith('groups.getLongPollServer', {
        group_id: 1
      });
      expect(api.call).to.be.calledOnce;
      expect(rp).to.have.not.been.called;
    });
    pull(ptlp.createPersistentLonpgollStream(api, rp, 20, 20), drain);
    setTimeout(() => {
      drain.abort();
      if (promise.isCancelled()) {
        done();
      } else {
        done(new Error('Not cancelled request!'));
      }
    }, 10);
  });

  it('inits longpoll with init function', (done) => {
    const api = {
      call: sinon.spy(() => {
        return Promise.resolve(config)
      }),
      config: {
        groupId: 1
      }
    };
    const rp = sinon.spy((test) => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(JSON.stringify(response)), 100);
      });
    });

    const { abort, sink, } = ptlp.init(api, rp);
    let ending;
    sink.on('data', (data) => {
      if (ending) {
        done(new Error('Continue after abort called!'));
      }
      ending = true;
      abort();
      expect(data).to.eql([[80, 10]])
      setTimeout(() => {
        done();
      }, 200)
    })
  });
});
