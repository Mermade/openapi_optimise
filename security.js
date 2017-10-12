var _ = require('lodash');
var common = require('./common.js');

var logger;

function gatherSecurity(src) {
	var security = _.cloneDeep(src.securityDefinitions);
	for (var s in security) {
		security[s].seen = 0;
	}
	return security;
}

module.exports = {

	optimise : function(src,options) {

		logger = new common.logger(options.verbose);

		var state = {};
		state.security = gatherSecurity(src);
		if (state.security && (Object.keys(state.security).length>0)) {
			logger.log('Optimising security definitions');
		}

		if (src.security) {
			for (var s in src.security){
				var sec = src.security[s];
				for (var p in sec) {
					if (state.security && state.security[p]) {
						state.security[p].seen++;
					}
				}
			}
		}

		common.forEachAction(src,function(action,path,index){
		  if (action.security) {
		    for (var s in action.security){
			  var sec = action.security[s];
			  for (var p in sec) {
				if (state.security && state.security[p]) {
					state.security[p].seen++;
				}
			  }
			}
		  }
		});

		for (var s in state.security) {
			var secdef = state.security[s];
			if (secdef.seen<=0) {
				delete src.securityDefinitions[s];
			}
		}

		common.clean(src,'securityDefinitions');
		return src;
	}

};
