var _ = require('lodash');
var common = require('./common.js');

var logger;
var state = {};
state.responses = [];

function gatherResponses(src) {
	for (var t in src.responses) {
		var response = {};
		response.definition = src.responses[t];
		response.seen = 0;
		state.responses.push(response);
	}
	common.forEachAction(src,function(action){
		for (var t in action.responses) {
			var response = action.responses[t];
			for (var st in state.responses) {
				var sresponse = state.responses[st];
				if (sresponse.definition.name == response) {
					sresponse.seen++;
				}
			}
		}
	});
	return state.responses;
}

module.exports = {
	optimise : function(src,options) {
		logger = new common.logger(options.verbose);
		if (src.responses) {
			logger.log('Removing unused responses');
			state.responses = gatherResponses(src);
			for (var t in state.responses) {
				var response = state.responses[t];
				if (response.seen<=0) {
					logger.log('  Deleting '+response.definition.name);
					_.remove(src.responses,function(o){
						return (o.name == response.name);
					});
				}
			}
			common.clean(src,'responses');
		}
		return src;
	}
};

