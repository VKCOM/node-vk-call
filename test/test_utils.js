const pull = require('pull-stream');

function wrapStreamAssert(done, assertcb, onEnd) {
  let calledDone = false;
  if (!onEnd) {
    onEnd = function() {};
  }
  if (!assertcb) {
    assertcb = function() {};
  }
  return pull.drain((data) => {
    try {
      const result = assertcb(data);
      if (result === false) {
        return false;
      }
    } catch(err) {
      calledDone = true;
      done(err);
      return false;
    }
  }, (end) => {
    try {
      if (!calledDone) {
        onEnd(end);
        done();
      }
    } catch(err) {
      done(err);
    }
  });
}

module.exports = {
  wrapStreamAssert: wrapStreamAssert
};
