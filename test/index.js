var asyncIoc = require('../');
var Q = require('q');
require('should');

describe('AsyncIoC', function() {
	var container = asyncIoc.createContainer()
			.debug(false)
			.logTo(null);

	beforeEach(function() {
		container.reset();
	});

	it('should inject syncronous methods', function(done) {
		// arrange
		var ioc = container
			.register('dependency', syncMethod)
			.register('test', testMethod, ['dependency']);

		// act
		ioc.start('test').fail(getFailHandler(done));

		// assert
		function testMethod(services) {
			services.dependency.name.should.equal('syncMethod');
			done();
		}
		function handleFail(err) {
			done(err);
		}
	});

	it('should inject asyncronous methods', function(done) {
		// arrange
		var ioc = container
			.register('dependency', createAsyncMethod('asyncMethod', 10))
			.register('test', testMethod, ['dependency']);

		// act
		ioc.start('test').fail(getFailHandler(done));

		// assert
		function testMethod(services) {
			services.dependency.name.should.equal('asyncMethod');
			done();
		}
		function handleFail(err) {
			done(err);
		}
	});

	it('should load async dependencies in parallel', function(done) {
		// arrange
		var delay = 15;
		var start = new Date();
		var ioc = container
			.register('one', createAsyncMethod('One', delay))
			.register('two', createAsyncMethod('Two', delay))
			.register('test', testMethod, ['one', 'two']);

		// act
		ioc.start('test').fail(getFailHandler(done));

		// assert
		function testMethod(services) {
			var end = new Date();
			services.one.name.should.equal('One');
			services.two.name.should.equal('Two');
			var diff = end.getTime() - start.getTime();
			diff.should.be.above(delay);
			diff.should.be.below(2*delay);
			done();
		}
	});

	it('should chain nested async dependencies', function(done) {
		// arrange
		var delay = 15;
		var start = new Date();
		var ioc = container
			.register('one', createAsyncMethod('One', delay))
			.register('two', createAsyncMethod('Two', delay), ['one'])
			.register('test', testMethod, ['one', 'two']);

		// act
		ioc.start('test').fail(getFailHandler(done));

		// assert
		function testMethod(services) {
			var end = new Date();
			services.one.name.should.equal('One');
			services.two.name.should.equal('Two');
			var diff = end.getTime() - start.getTime();
			diff.should.be.above(2*delay);
			diff.should.be.below(3*delay);
			done();
		}
	});

	it('should fail if an unregistered dependency is called', function(done) {
		// arrange
		var ioc = container
			.register('dependency', syncMethod)
			.register('test', testMethod, ['fakeDependency']);

		// act
		ioc.start('test').fail(handleFail);

		// assert
		function handleFail(err) {
			done();
		}
		function testMethod(services) {
			done(new Error('This should have failed'));
		}
	});
});








function getFailHandler(done) {
	return function (err) {
		done(err);
	};
}

function syncMethod(services) {
	return {name:'syncMethod'};
}

function createAsyncMethod(name, delay) {
	return function(services) {
		var service = {
			name: name
		};
		return Q.resolve()
			.delay(delay)
			.then(function() {
				return service;
			});
	};
}
