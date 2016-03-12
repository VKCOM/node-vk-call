# vk-call

> Simple API wrapper for VK.com social network.
> Inspired by [node-vk-sdk](https://github.com/gavr-pavel/node-vk-sdk).

## VK object

```javascript
var vk = require('vk-call').vk;
```

### constructor(config: Object)

config options: 
* ```token``` — OAuth token for authorized requests
* ```timeout``` — request timeout
* ```version``` — API version
* ```api_url``` — base url for api calls

### vk.call(method: String, params: Object) : Promise

Single api call, returns promise.

* ```method``` — method name, i.e. 'users.get'
* ```params``` — method parameters, i.e. ```{ id: 1 }```

### vk.chain() : Chain

Intitializes ant returns ``Chain``` object

Example:
```javascript
var vk = require('vk-call').vk;

var api = new vk({
  token: "YOUR TOKEN HERE",
  version: "5.50",
  timeout: 10
});

api.call("users.get", { user_ids: 1 })
  .then(users => console.log(users));

```

## Chain object

This object is responsible for chaining api calls and batching them with the help of 
[execute](https://vk.com/dev/execute) method. It allows you to legally get around some of request rate limits.
However, remember that you can't chain more than 25 api calls.

It's better to create ```Chain``` object via ```vk.chain``` method. 

### constructor(api: vk)
* ```api``` — initialized instance of vk

### append(method, params) : Promise

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
