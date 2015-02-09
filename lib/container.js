'use strict';

var fs = require('fs');
var Q = require('q');
var jsInterface = require('jsinterface');
var lifecycles = require('./lifecycles');

/** IoC container class */
function Container() {
  this._registrations = {};
  this._modules = {};
  this._lastModuleId = 0;
  this._interfaces = {};
  this._stopSequence = [];
  this._isDebug = false;
  this._stopTimeout = 10000;
  this._logger = console.log.bind(console);
}

/**
 * Sets a new timeout period for which the shutdown sequence will wait for any single service to shutdown.
 * Default = 10000 (10 seconds)
 * 
 * @param  {Number} newTimeout [description]
 */
Container.prototype.stopTimeout = function(newTimeout) {
  this._stopTimeout = newTimeout;
};

/**
 * Enables or disables debug mode (more verbose logging)
 * 
 * @param {Boolean} enable
 */
Container.prototype.debug = function(enable) {
  this._isDebug = enable;
  return this;
};

/**
 * Replace the logger for this container to redirect log output.
 * Default outputs to console.log.
 * To disable logging use logTo(null).
 * 
 * @param  {[type]} logMethod [description]
 * @return {[type]}           [description]
 */
Container.prototype.logTo = function(logMethod) {
  this._logger = logMethod;
  return this;
};

/**
 * Resets (clears) all registered services
 */
Container.prototype.reset = function() {
  this._registrations = {};
  this._modules = {};
  this._interfaces = {};
  this._stopSequence = [];
  this._lastModuleId = 0;
  return this;
};

Container.prototype.define = function(interfaceName, methods, properties) {
  var iface = (typeof interfaceName === 'object') ?
    interfaceName :
    {
      name: interfaceName,
      methods: methods || [],
      properties: properties || []
    };

  this._interfaces[iface.name] = jsInterface.define(iface);

  return this;
};

Container.prototype.defineAll = function(path) {
  var self = this;

  var files = fs.readdirSync(path);

  files.forEach(function(file) {
    // ignnore ds_store files
    if (file === '.DS_Store') return;

    var iface = require(path + '/' + file);
    self.define(iface);
  });

  return self;
};

/**
 * Registers a single service
 * @param  {string|Array} serviceNames
 * @param  {function} factory
 * @param  {string|Array} [dependencies]
 * @param  {object} [options]
 */
Container.prototype.register = function(serviceNames, factory, dependencies, options) {
  var self = this;

  if (!Array.isArray(serviceNames)) serviceNames = [serviceNames];

  // TODO: more intelligent representation for multiple services
  var name = serviceNames[0];

  // ensure optional params won't break anything
  dependencies = dependencies || [];
  options = options || {};
  if (!Array.isArray(dependencies)) dependencies = [dependencies];

  // self.log('Registering service "' + serviceName + '" with ' + dependencies.length + ' dependencies ');

  if (typeof factory !== 'function') throw new Error('Unsupported factory type for service: ' + name + ' - ' + typeof factory );
  var lifecycle = options.lifecycle || 'singleton';

  var moduleFactory = self._createLifecycleFactory(factory, dependencies, lifecycle);
  self._modules[self._lastModuleId++] = moduleFactory;

  serviceNames.forEach(function(serviceName) {
    // we can only override a registration if replace option is set
    if (self._registrations[serviceName] && !options.replace) {
      throw new Error(serviceName + ' has already been registered');
    }

    // wrap in factory that will load with an interface definition when first used
    // this allows for late definition of interface types
    self._registrations[serviceName] = 
      self._createInterfaceWrapperFactory(moduleFactory, serviceName, lifecycle);
  });

  return self;
};

/**p
 * Registers all services contained in a folder using defaults
 * @param  {string} folderName
 */
Container.prototype.registerAll = function(path) {
  var self = this;

  var files = fs.readdirSync(path);

  files.forEach(function(file) {
    // ignnore ds_store files
    if (file === '.DS_Store') return;

    if (file === 'models' || file === 'services') {
      self.registerFolder(path + '/' + file);
      return;
    }
    var service = require(path + '/' + file);
    self.register(
      service.$implements || service.$implement || file.replace('.js',''),
      service,
      service.$inject || []);
  });

  return self;
};

/**
 * Stops (shuts down) when the supplied process events are received
 * what == ['SIGINT']
 */
Container.prototype.stopOn = function(what) {
  var self = this;

  if (typeof what === 'string') {
    bindStopEvent(what);
  } else {
    what.forEach(function(item) {
      bindStopEvent(item);
    });
  }
  return self;

  function bindStopEvent(item) {
    self._debug('Watching for close event: "' + item + '"');
    process.on(item, function() {
      self._log('Stopping - ' + self._stopSequence.length + ' services to stop...');
      self._stopNext()
      .then(function() {
        //process.exit();
      })
      .fail(function(err) {
        self._log('ERR', err.stack);
        process.exit(1);
      });
    });
  }
};

/**
 * Gets and starts a service
 * @param  {[type]} serviceName [description]
 * @return {[type]}             [description]
 */
Container.prototype.start = Container.prototype.get = function(serviceName) {
  var self = this;

  return Q.try(function() {
    self._debug('Getting service "' + serviceName + '"');
    
    var registration = self._registrations[serviceName];

    if (!registration) throw new Error('No registration found for service: "' + serviceName + '"');

    var service = registration.call();
    return service;
  });
};

Container.prototype._createInterfaceWrapperFactory = function(moduleFactory, interfaceName, lifecycle) {
  var self = this;

  if (!lifecycles[lifecycle]) {
    throw new Error('Unsupported lifecycle: "' + lifecycle + '"');
  }

  return lifecycles[lifecycle](_wrapInstance);

  function _wrapInstance() {
    return moduleFactory()
      .then(function(module) {
        var definition = self._interfaces[interfaceName];
        return (definition) ?
          definition.wrap(module) :
          module;
      });
  }
};

Container.prototype._createLifecycleFactory = function(factory, dependencies, lifecycle) {

  var self = this;
  
  if (!lifecycles[lifecycle]) {
    throw new Error('Unsupported lifecycle: "' + lifecycle + '"');
  }

  return lifecycles[lifecycle](_callModuleFactory);

  function _callModuleFactory() {
    return self._getDependencies(dependencies)
      .then(function(inject) {

        // inject services & get result
        var service = factory(inject);

        // no object returned? skip
        if (!service) return service;

        // if the service has a stop method add it to the list of things that need to be shut down
        if (service.stop) {
          self._stopSequence.push(service);
        }

        // make sure we always return a Q promise
        if (Q.isPromise(service)) {

          return service;

        } else if (Q.isPromiseAlike(service)) {

          // wrap non-Q promise in Q
          return Q(service);

        } else if (service.start) {

          // call the start method
          return Q.ninvoke(service, 'start')
            .then(function() {
              return service;
            });

        } else {

          return service;

        }
      })
      .fail(function(err) {
        self._log(err);
        throw err;
      });
  }
};

Container.prototype._stopNext = function() {
  var self = this;

  if (self._stopSequence.length === 0) return Q.resolve();

  var next = self._stopSequence.pop();

  return Q.ninvoke(next, 'stop')
    .timeout(self._stopTimeout)
    .fail(function(err) {
      self._log('Could not stop service: ' + err.message);
    })
    .then(function() {
      return self._stopNext();
    });
};

Container.prototype._getDependencies = function(dependencies) {
  var self = this;

  if (!dependencies) return Q.resolve({});
  
  self._debug('Getting ' + dependencies.length + ' dependencies');
  
  var inject = {};
  var promises = [];

  dependencies.forEach(function(serviceName) {
    self._debug('Getting dependency: "' + serviceName + '"');
    promises.push(
      self.get(serviceName)
      .then(function(service) {
        self._debug('Service loaded "' + serviceName + '"');
        inject[serviceName] = service;
      })
    );
  });
  
  if (dependencies.length > 0) self._debug('Waiting for dependencies to start: ' + dependencies.join(', '));

  return Q.all(promises)
    .then(function() {
      self._debug('Dependencies started');
      return inject;
    });
};

Container.prototype._log = function() {
  if (this._logger) this._logger.apply(this, arguments);
};

Container.prototype._debug = function(message) {
  if (this._isDebug) this._log(message);  
};


module.exports = exports = Container;
