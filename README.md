# AsyncIoC for Node JS

Asyncronous IoC and dependency injection for Node JS.

## Usage

First create a container:

```js
var ioc = require('async-ioc').createContainer();
```

Then register services on that container:

```js
ioc.register('service', someFunction);
ioc.register('anotherService', require('./anotherservice'));
```

You can specify dependencies for a service:

```js
ioc.register('serviceThree', serviceThreeFactory, ['service', 'anotherService']);
```

Load an entire folder:
```js
ioc.registerAll('/path/to/services');
```
...all registered services will be named by the file/folder unless the $implement attribute is set.

And start a service with dependency injection:
```js
ioc.start('serviceThree');
```

You can also chain the methods:

```js
require('async-ioc').createContainer()
	.register('service', someFunction)
	.register('anotherService', require('./anotherservice'))
	.register('serviceThree', serviceThreeFactory, ['service', 'anotherService'])
	.start('serviceThree')
	.then(function(serviceThree) {
		// do something with serviceThree
	});
```

## Service Signature

The factory/function for the service should have the following signature:

```js
var someService = function(services) {
	// ...
	// service initialization logic
	// ...

	return theService;
};
```

Typically you would expose this in a module:

```js
module.exports = function(services) { };
```

... where services is an object containing the injected services

## Attributes

### $implement

Alias of $implements

### $implements

Defines the service or interface name this module implements.

*Type:* String or Array[String]

*Default:* The file or folder name.

*Notes:* A module can implement multiple services or interfaces.

```js
// implement a service or interface
module.exports = function(services) { };
module.exports.$implements = 'serviceName';
```

```js
// implement multiple services or interfaces
module.exports = function(services) { };
module.exports.$implements = ['service1', 'service2'];
```

### $inject

Defines the services to be injected for this service. These should be supplied as an array of string values containing the service names.

*Default:* No services ([])

```js
module.exports = myService;
module.exports.$inject = ['dependencyOne', 'dependencyTwo'];

function myService(services) {
	services.dependencyOne.someMethod();
}
```

## Asyncronous Services

### Method 1: Promises

Simply return a promise from the service factory.

```js
module.exports = myService;

function myService(services) {
	var deferred = Q.defer();

	// this service will finish loading in 1 second
	setTimeout(function() {
		deferred.resolve();
	},1000);

	return deferred.promise;
}
```

### Method 2: start() method

Return an object that defines a ```.start()``` method that accepts a Node-style callback (ie: ```function(err)```) to be called on completion. The start method will be called before injecting into the first service.

```js
module.exports = myService;

function myService(services) {

	return {
		start: function(done) {

			// if an error occurs, call done() with the error
			if (someErrorOccurred) done(someErrorOccurred);

			// this service will finish loading in 1 second
			setTimeout(function() {
				done();
			},1000);
		}
	};

}
```

### Shutdown / Stop process

TODO:

## Method Summary

All container methods are chainable.

- debug
- logTo
- register
- registerAll
- start
- stopOn
- get
- reset
- stopTimeout

