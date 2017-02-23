# vk-call [![Build Status](https://travis-ci.org/VKCOM/node-vk-call.svg?branch=master)](https://travis-ci.org/VKCOM/node-vk-call)

> Simple API wrapper for VK.com social network.
> Inspired by [node-vk-sdk](https://github.com/gavr-pavel/node-vk-sdk).

# Installation

```npm install vk-call```

# Usage

## VK object

```javascript
var vk = require('vk-call').vk;
```

### constructor(config: Object)

config options: 
* ```token``` — OAuth token for authorized requests
* ```timeout``` — request timeout in milliseconds
* ```version``` — API version
* ```api_url``` — base url for api calls

### vk.call(method: String, params: Object) : Promise

Single api call, returns promise.

* ```method``` — method name, i.e. 'users.get'
* ```params``` — method parameters, i.e. ```{ id: 1 }```

Example:
```javascript
var vk = require('vk-call').vk;

var api = new vk({
  token: "YOUR TOKEN HERE",
  version: "5.50",
  timeout: 10000
});

api.call("users.get", { user_ids: 1 })
  .then(users => console.log(users));

```

### vk.chain() : Chain

Intitializes and returns `Chain` object

## Chain object

This object is responsible for chaining api calls and batching them with the help of 
[execute](https://vk.com/dev/execute) method. It allows you to legally get around some of request rate limits.
However, remember that you can't chain more than 25 api calls.

It's better to create ```Chain``` object via ```vk.chain``` method. 

### constructor(api: vk)
* ```api``` — initialized instance of vk

### append(method: String, params: Object) : Promise

This method is very similar to ```vk.call```, but used for chaining.
Returned promise will be resolved after successfull ```execute``` call. 
Promise will return value as if it is a single api call. 
It means, that only data returned single for this request will be supplied.

You can't call ```Chain.append``` after you called ```Chain.done```, you have to create new ```Chain```.

### done() : Promise

You must call this method, when you appended enough requests.

This method will return an array of results for chained methods in the same order in which you appended calls.

Empty chain will return ```Promise([])```.

Exmaple: 
```javascript

var vk = require('vk-call');

var api = new vk({
  token: "YOUR TOKEN",
  version: "5.50"
});

var chain = api.chain();

chain.append("users.get", { user_ids: 1 })
  .then((users) => console.log(users));
  
chain.append("groups.getById", { group_ids: 1 })
  .then(groups => console.log(groups));
  
chain.done()
  .then((result) => {
    var users = result[0];
    var groups = result[1];
    console.log(users, groups);
  });
  
chain.append("users.get", { user_ids: 2 });

// Throws error, because chain ended after done

```

## Errors

All errors are wrapped with VKError object wich you can request as:
```javascript
var VKError = require('vk-call').errors.VKError;
```

There are two type of errors:
* domain errors — all errors, that returned by VK API
* failures (not domain errors) — all other errors (timeouts, no internet, code issues etc.)

Most of error codes that can be returned by VK API are represented by constants:
```javascript
var errors = require('vk-call').errors;
assert(errors.NOT_DOMAIN_ERROR === -1);
assert(errors.UKNOWN_ERROR === 1);
assert(errors.UNKNOWN_METHOD === 3);
```
This codes are stored in ```type``` property of ```VKError``` instance.
You can find the whole list of constants [here](https://github.com/Termina1/node-vk-call/blob/master/lib/vk_error.js).

There is also ```name``` property, it can have two values:
```javascript
var errors = require('vk-call').errors;
errors.NOT_DOMAIN_NAME
errors.DOMAIN_NAME
```
This property is handy for distinguishing API errors from any other failures.

Also there is an ```originalError``` property were you can get the original error (json or Error object).

## Tests

This library is mostly covered with tests. To run test, use ```npm test``` command.
For developing, use ```npm test-watch``` command.

We use [mocha](https://github.com/mochajs/mocha) for testing. All test files are stored in ```test/**/*```.

## License

Distributed under [MIT LICENSE](LICENSE)
