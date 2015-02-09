'use strict';

var Container = require('./container');

/** 
 * Creates a new IoC container
 */
exports.createContainer = function () {
  return new Container();
};

exports.addLifecycle = function(name, fn) {
  var lifecycles = require('./lifecycles');
  lifecycles[name] = fn;
};
