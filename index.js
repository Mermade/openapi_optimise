var _ = require('lodash');
var parameters = require('./parameters.js');
var responses = require('./responses.js');
var tags = require('./tags.js');
var prodcons = require('./prodcons.js');
var definitions = require('./definitions.js');
var empty = require('./empty.js');
var models = require('./models.js');

module.exports = {

	defaultOptimisations : function(swagger,options) {
		var opt = _.cloneDeep(swagger);

		opt = empty.optimise(opt,options);
		opt = parameters.optimise(opt,options);
		opt = responses.optimise(opt,options);
		opt = tags.optimise(opt,options);
		opt = prodcons.optimise(opt,options);
		opt = definitions.optimise(opt,options);

		return opt;
	},
	nonDefaultOptimisations: function(swagger,options) {
		var opt = _.cloneDeep(swagger);

		opt = models.optimise(opt,options);

		return opt;
	}

};