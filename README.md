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

## $async

Defines whether this module needs to be started async.

*Default:* false

```js
module.exports = myService;
module.exports.$async = true;

function myService(services, done) {
	// either return a promise or use done
}
```