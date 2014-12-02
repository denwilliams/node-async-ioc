# AsyncIoC for Node JS

Asyncronous IoC and dependency injection for Node JS.

# Module Signature

```js
module.exports = function(services) { };
```

... where services is an object containing the injected services

# Attributes

## $implement

Defines the service or interface name this module implements.

*Default:* The file or folder name.

```js
module.exports = function(services) { };
module.exports.$implement = 'serviceName';

```

## $inject

Defines the services to be injected for this service. These should be supplied as an array of string values containing the service names.

*Default:* No services ([])

```js
module.exports = myService;
module.exports.$inject = ['dependencyOne', 'dependencyTwo'];

function myService(services) {
	services.dependencyOne.someMethod();
}
```

# Asyncronous Services

## Method 1: Promises

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

## Method 2: start() method

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
