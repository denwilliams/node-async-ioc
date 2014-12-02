'use strict';

var fs = require('fs');
var Q = require('q');

/** 
 * Creates an IoC container
 */
exports.createContainer = function () {
  var registrations = {};
  var stopSequence = [];
  var isDebug = false;
  var logger = console.log.bind(console);

  /** Public methods for the container */
  var container = {
    debug: setDebug,
    logTo: logTo,
    register: register,
    registerAll: registerFolder,
    start: start,
    stopOn: stopOn,
    get: get,
    reset: resetContainer
  };

  return container;

  // ---- private ----

  /**
   * Enables or disables debug mode
   * @param {Boolean} enable
   */
  function setDebug(enable) {
    isDebug = enable;
    return container;
  }

  function logTo(logMethod) {
    logger = logMethod;
    return container;
  }

  /**
   * Resets (clears) all registered services
   */
  function resetContainer() {
    registrations = [];
    stopSequence = [];
    return container;
  }

  /**
   * Registers a single service
   * @param  {string} serviceName
   * @param  {function} factory
   * @param  {Array} dependencies
   * @param  {object} options
   */
  function register(serviceName, factory, dependencies, options) {
    dependencies = dependencies || [];
    log('Registering service "' + serviceName + '" with ' + dependencies.length + ' dependencies ');

    if (typeof factory !== 'function') throw new Error('Unsupported factory type for service: ' + serviceName + ' - ' + typeof factory );
    options = options || {};
    var lifecycle = options.lifecycle || 'singleton';
    if (registrations[serviceName]) {
      if (!options.replace) {
        throw new Error(serviceName + ' has already been registered');
      }
    }

    registrations[serviceName] = createLifecycleFactory(factory, dependencies, lifecycle);

    return container;
  }

  /**
   * Registers all services contained in a folder using defaults
   * @param  {string} folderName
   */
  function registerFolder(path) {
    var files = fs.readdirSync(path);
    files.forEach(function(file) {
      if (file === 'models' || file === 'services') {
        registerFolder(path + '/' + file);
        return;
      }
      var service = require(path + '/' + file);
      register(service.$implement || file.replace('.js',''), service, service.$inject || []);
    });

    return container;
  }

  /**
   * [start description]
   * @param  {string} serviceName
   * @return {[type]}             [description]
   */
  function start(serviceName) {
    log('Starting service: ' + serviceName);

    return Q.try(function() {
      // note: the service will be started when we get it
      return get(serviceName);
    })
    .then(function() {
      // but return the container, not the service
      return container;
    });
  }

  /**
   * Stops (shuts down) when the supplied process events are received
   * what == ['SIGINT']
   */
  function stopOn(what) {
    if (typeof what === 'string') {
      bindStopEvent(what);
    } else {
      what.forEach(function(item) {
        bindStopEvent(item);
      });
    }
    return container;

    function bindStopEvent(item) {
      debug('Watching for close event: "' + item + '"');
      process.on(item, function() {
        log('Stopping - ' + stopSequence.length + ' services to stop...');
        stopNext()
        .then(function() {
          //process.exit();
        })
        .fail(function(err) {
          console.log('ERR', err.stack);
          process.exit(1);
        });
      });
    }
  }

  /**
   * Gets a service
   * @param  {[type]} serviceName [description]
   * @return {[type]}             [description]
   */
  function get(serviceName) {
    debug('Getting service "' + serviceName + '"');
    
    var registration = registrations[serviceName];
    if (!registration) throw new Error('No registration found for service: "' + serviceName + '"');

    var service = registration.call();
    return service;
  }

  function createLifecycleFactory(factory, dependencies, lifecycle) {
    // TODO: support other than singleton
    
    switch(lifecycle) {

    case 'singleton':
      var instancePromise;
      return function() {
        if (instancePromise) return instancePromise;
        
        instancePromise = getDependencies(dependencies)
        .then(function(inject) {
          // inject services & get result
          var service = factory(inject);

          // no object returned? skip
          if (!service) return service;

          // if the service has a stop method add it to the list of things that need to be shut down
          if (service.stop) {
            stopSequence.push(service);
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
          log(err);
          throw err;
        });

        return instancePromise;
      };

    // case 'transient':
    //  return function() {
    //    var inject = getDependencies(dependencies);
    //    return factory(inject);
    //  };
    }

    throw new Error('Unsupported lifecycle: "' + lifecycle + '"');
  }

  function stopNext() {
    if (stopSequence.length === 0) return Q.resolve();

    var next = stopSequence.pop();

    return Q.ninvoke(next, 'stop')
    .then(function() {
      return stopNext();
    });
  }

  function getDependencies(dependencies) {
    if (!dependencies) return Q.resolve({});
    debug('Getting ' + dependencies.length + ' dependencies');
    
    var inject = {};
    var promises = [];

    dependencies.forEach(function(serviceName) {
      debug('Getting dependency: "' + serviceName + '"');
      promises.push(
        get(serviceName)
        .then(function(service) {
          debug('Service loaded "' + serviceName + '"');
          inject[serviceName] = service;
        })
      );
    });
    if (dependencies.length > 0) debug('Waiting for dependencies to start: ' + dependencies.join(', '));
    return Q.all(promises)
    .then(function() {
      debug('Dependencies started');
      return inject;
    });
  }

  function log() {
    if (logger) logger.apply(container, arguments);
  }

  function debug(message) {
    if (isDebug) log(message);
  }
};


