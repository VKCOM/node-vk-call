'use strict';

class Chain {
  constructor(api) {
    this.api = api;
    this.chainData = [];
  }

  append(method, params) {
    if (this.end) {
      throw new Error(`Can't append call after done`);
    }
    var resolver, rejecter;
    var promise = new Promise((res, rej) => {
      resolver = res;
      rejecter = rej;
    })

    this.chainData.push({
      resolve: resolver,
      reject: rejecter,
      method: method,
      params: params
    });

    return promise;
  }

  done() {
    this.end = true;

    if (this.chainData.length === 0) {
      return Promise.resolve([]);
    }

    return this.api.execute(this.chainData)
  }
}

exports.Chain = Chain;
