var _ = require('lodash');
var common = require('./common.js');

module.exports = {

	optimise : function(src) {
		if (src.produces || src.consumes) {
			console.log('Optimising produces/consumes');
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