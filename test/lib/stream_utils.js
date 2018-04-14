const chai = require('chai');
const sinon = require('sinon');
const pull = require('pull-stream');
const Bluebird = require('bluebird');
Bluebird.config({
  cancellation: true
});

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
const expect = chai.expect;

const utils = require("../../lib/stream_utils");
const wrapStreamAssert = require('../test_utils').wrapStreamAssert;

function aborter(abort) {
  return function (read) {
    return function (end, cb) {
      let myend;
      try {
        myend = abort(end);
      } catch(err) {
        myend = err;
      }
      return read(myend, function (end, data) {
        cb(end, data);
      })
    }
  }
}

function recoveringSource(values, onError) {
  let i = 0;
  return function(end, cb) {
    if (end === true) {
      cb(end, null);
    } else {
      i++;
      if (end && onError) {
        try {
          onError(end);
        } catch(e) {
          cb(e, null);
          return;
        }
      }
      if (values.length < i) {
        cb(true, null);
      } else {
        cb(null, values[i - 1]);
      }
    }
  };
}

describe("Stream utils", () => {
  describe("cacher stream", () => {
    it("propagates pull only first time", (done) => {
      let times = 0;
      pull(
        pull.values([1, 2]),
        utils.cacher(),
        wrapStreamAssert(done, (data) => {
          if (times < 2){
            expect(data).to.equal(1);
          } else {
            return false;
          }
          times++;
        })
      )
    });

    it("propagates errors and end", (done) => {
      let times = 0;
      pull(
        pull.values([1, 2]),
        utils.cacher(),
        aborter(() => {
          times++;
          return times > 2 ? 'error!' : null;
        }),
        wrapStreamAssert(done, null, (end) => {
          expect(end).to.equal('error!');
        })
      )
    });

    it("propagates errors and supports recover", (done) => {
      let times = 0;
      pull(
        recoveringSource([1, 2]),
        utils.cacher(),
        aborter(() => {
          times++;
          return times > 1 ? 'error!' : null;
        }),
        wrapStreamAssert(done, (data) => {
          expect(data).to.equal(times);
        }, (end) => {
          expect(end).to.be.null;
          expect(times).to.equal(3);
        })
      )
    });
  });

  describe("repeater", () => {
    it("is just a dumb through stream, while no errors", (done) => {
      let times = 0;
      pull(
        pull.values([1, 2]),
        utils.repeater(),
        wrapStreamAssert(done, (data) => {
          expect(data).to.equal(++times);
        }, (end) => {
          expect(end).to.be.null;
        })
      )
    });

    it("doubles timeout on each error, but respects maxTimeout and propagates end", (done) => {
      let times = 0;
      let prevTime = Date.now();
      pull(
        pull.values([1, 2, 3, 4, 5, 6, 7]),
        utils.repeater((end) => end !== 'error', 50, 100),
        aborter((end) => {
          const now = Date.now();
          const diff = now - prevTime;
          prevTime = now;
          times++;
          if (times > 0 && times < 4) {
            expect(diff).to.be.lt(Math.pow(2, times) * 50 + 30)
            expect(diff).to.be.lt(110)
            return 'error';
          } else if (times === 5) {
            return null;
          } else if (times === 6) {
            return 'error';
          } else if (times === 7) {
            expect(diff).to.be.lt(Math.pow(2, times) * 50 + 30);
            expect(diff).to.be.gt(10);
          }
        }),
        wrapStreamAssert(done, (data) => {
          expect(data).to.equal(times);
        }, (end) => {
          if (end !== true && end !== null) {
            throw end;
          }
        })
      );
    });

    it("it propagates unknown errors to top", (done) => {
      pull(
        pull.values([1, 2]),
        utils.repeater((end) => end !== 'error', 50, 100),
        aborter((end) => 'error!'),
        wrapStreamAssert(done, (data) => {
          throw Error('Should not emit any data!');
        }, (end) => {
          expect(end).to.equal('error!');
        })
      )
    });

    it("it recovers from unknown errors", (done) => {
      let times = 0;
      pull(
        recoveringSource([1, 2], (end) => expect(end).to.equal('error!')),
        utils.repeater((end) => end !== 'error', 50, 100),
        aborter((end) => {
          if (times === 0) {
            return 'error!';
          }
        }),
        wrapStreamAssert(done, (data) => {
          times++;
        }, (end) => {
          if (end !== true && end !== null) {
            throw end;
          }
          expect(times).to.equal(2);
        })
      )
    });
  });

  describe("asyncMapRecover", () => {
    it("it just maps data with promises, propagates end", (done) => {
      let times = 1;
      pull(
        pull.values([1, 2]),
        utils.asyncMapRecover((data) => Promise.resolve(data * 2)),
        wrapStreamAssert(done, (data) => {
          expect(data).to.equal(times * 2);
          times++
        }, (end) => {
          expect(end).to.be.null;
        })
      )
    });

    it("it handles promise errors", (done) => {
      pull(
        pull.values([1, 2]),
        utils.asyncMapRecover((data) => Promise.reject("error!")),
        wrapStreamAssert(done, (data) => {
          throw new Error("Should not emit data!");
        }, (end) => {
          expect(end).to.equal("error!")
        })
      )
    });

    it("it propagates upstream errors", (done) => {
      pull(
        pull.values([1, 2]),
        utils.asyncMapRecover((data) => Promise.reject("Should not call mapper!")),
        aborter((end) => 'error!'),
        wrapStreamAssert(done, (data) => {
          throw new Error("Should not emit data!");
        }, (end) => {
          expect(end).to.equal("error!")
        })
      )
    });

    it("recovers from errors", (done) => {
      let times = 1;
      pull(
        recoveringSource([1, 2]),
        utils.asyncMapRecover((data) => Promise.resolve(data * 2)),
        aborter((end) => 'error!'),
        wrapStreamAssert(done, (data) => {
          expect(data).to.equal(times * 2);
          times++
        }, (end) => {
          expect(times).to.equal(3);
          expect(end).to.be.null;
        })
      )
    });

    it("recovers from self-induced errors", (done) => {
      let times = 1;
      pull(
        recoveringSource([1, 2]),
        utils.asyncMapRecover((data) => {
          if (times === 1) {
            times++;
            return Promise.reject('error!')
          }
          return Promise.resolve(data * 2)
        }),
        wrapStreamAssert(done, (data) => {
          expect(data).to.equal(times * 2);
          times++
        }, (end) => {
          expect(times).to.equal(3);
          expect(end).to.be.null;
        })
      )
    });

    it("cancels promises when stream aborted", (done) => {
      let promise;
      let times = 1;
      let drain = wrapStreamAssert(done, (data) => {
        expect(data).to.equal(times * 2);
        times++;
      }, (end) => {
        if (end) {
          throw end;
        }
      });
      pull(
        recoveringSource([1, 2]),
        utils.asyncMapRecover((data) =>{
          promise = new Bluebird((resolve, reject, onCancel) => {
            let timeout = setTimeout(() => reject(new Error('Promise should be canceled!')), 1000);
            onCancel(() => clearTimeout(timeout));
          })
          return promise;
        }),
        drain
      );
      setTimeout(() => {
        drain.abort()
        if (promise.isCancelled()) {
          done();
        } else {
          done(new Error('Promise was not cancelled!'));
        }
      });
    });
  });
});
