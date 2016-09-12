/** munge test results for easier comparison
* not used as an optimisation, default or otherwise
* mutates passed-in object
*/

var _ = require('lodash');
var common = require('./common.js');
var parameters = require('./parameters.js');

module.exports = {

	munge : function(src,options) {
		if ((!src.securityDefinitions) || (Object.keys(src.securityDefinitions).length<=0)) {
			delete src.securityDefinitions;
			src.securityDefinitions = {}; // forces add at end of properties
		}

		common.forEachAction(src,function(action){
			if (!action.produces) {
				action.produces = src.produces;
			}
			if (!action.consumes) {
				action.consumes = src.consumes;
			}
			var deprecated = (typeof action.deprecated == 'undefined' ? false : action.deprecated);

			var produces = _.cloneDeep(action.produces);
			var consumes = _.cloneDeep(action.consumes);
			delete action.produces;
			delete action.consumes;
			action.produces = produces;
			action.consumes = consumes;
			delete action.deprecated;
			action.deprecated = deprecated;

		});

		for (var p in src.parameters) {
			src.parameters[p] = parameters.transform(src.parameters[p]);
		}

		common.forEachPath(src,function(path){
			for (var p in path.parameters) {
				path.parameters[p] = parameters.transform(path.parameters[p]);
			}
		});

		common.forEachAction(src,function(action){
			for (var p in action.parameters) {
				action.parameters[p] = parameters.transform(action.parameters[p]);
			}
		});

		return src;
	}

};
