exports.NOT_DOMAIN_ERROR = -1;

exports.UKNOWN_ERROR = 1;
exports.APP_SWITCHED_OFF = 2;
exports.UNKNOWN_METHOD = 3;
exports.WRONG_SIGNATURE = 4;
exports.AUTH_FAILURE = 5;
exports.TOO_MANY_REQUESTS = 6;
exports.SCOPE_NEEDED = 7;
exports.INCORRECT_REQUEST = 8;
exports.TOO_MANY_SIMILAR_ACTIONS = 9;
exports.INTERNAL_ERROR = 10;
exports.TEST_MODE = 11;
exports.CAPTCHA_REQUIRED = 14;
exports.ACCESS_DENIED = 15;
exports.HTTPS_ONLY = 16;
exports.USER_VALIDATION_REQUIRED = 17;
exports.STANDALONE_ONLY = 20;
exports.STANDALONE_AND_OPEN_API_ONLY = 21;
exports.METHOD_DISABLED = 23;
exports.WRONG_PARAMETER = 100;
exports.INCORRECT_API_ID = 101;
exports.INCORRECT_USER_ID = 113;
exports.INCORRECT_TIME = 150;
exports.ALBUM_ACCESS_DENIED = 200;
exports.AUDIO_ACCESS_DENIED = 201;
exports.GROUP_ACCESS_DENIED = 203;
exports.ALBUM_OVERFLOW = 300;
exports.PAYMENTS_DISABLED = 500;
exports.COMMERCIAL_ACCESS_DENIED = 600;
exports.COMMERCIAL_ERROR = 603;

exports.NOT_DOMAIN_NAME = "not_domain_error";
exports.DOMAIN_NAME = "domain_name";

function VKError(opts) {
  if (opts.type === exports.NOT_DOMAIN_ERROR) {
    this.type = opts.type;
    this.name = exports.NOT_DOMAIN_NAME;
    this.stack = opts.originalError.stack;
    this.message = 'Failure: ' + opts.originalError.message;
  } else {
    this.type = opts.type;
    this.name = exports.DOMAIN_NAME;
    this.message = 'Domain error: ' + opts.message;
  }
  this.originalError = opts.originalError;
}

VKError.prototype = Error.prototype;

exports.VKError = VKError;
exports.construct = function(error) {
  if (error instanceof Error) {
    return new VKError({ type: exports.NOT_DOMAIN_ERROR, originalError: error });
  } else {
    return new VKError({
      type: error.error_code,
      message: error.error_msg,
      method: error.method,
      originalError: error
    });
  }
}
