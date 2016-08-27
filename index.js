var _ = require('lodash');
var parameters = require('./parameters.js');
var responses = require('./responses.js');
var tags = require('./tags.js');
var prodcons = require('./prodcons.js');
var definitions = require('./definitions.js');
var models = require('./models.js');

module.exports = {

	defaultOptimisations : function(swagger,options) {
		var opt = _.cloneDeep(swagger);

		opt = parameters.optimise(opt);
		opt = responses.optimise(opt);
		opt = tags.optimise(opt);
		opt = prodcons.optimise(opt);
		opt = definitions.optimise(opt);

		return opt;
	},
	nonDefaultOptimisations: function(swagger,options) {
		var opt = _.cloneDeep(swagger);

		opt = models.optimise(opt,{});

		return opt;
	}

};