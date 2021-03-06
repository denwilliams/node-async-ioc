'use strict';

module.exports = exports = function(factory) {

  if (typeof factory !== 'function') {
    throw new Error('Invalid factory type: ' + (typeof factory));
  }

  var singleton;

  return function() {
    if (!singleton) singleton = factory();
    return singleton;
  };
};
