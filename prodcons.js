var _ = require('lodash');
var common = require('./common.js');

var logger;

module.exports = {

	optimise : function(src,options) {
		logger = common.logger(options.verbose);
		if (src.produces || src.consumes) {
			logger.log('Optimising produces/consumes');
			common.forEachAction(src,function(action){
				if (src.produces && action.produces && _.isEqual(src.produces,action.produces)) {
					delete action.produces;
				}
				if (src.consumes && action.consumes && _.isEqual(src.consumes,action.consumes)) {
					delete action.consumes;
				}

			});
		}
		return src;
	}
};