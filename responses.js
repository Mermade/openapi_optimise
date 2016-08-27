var common = require('./common.js');

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
}

module.exports = {
	optimise : function(src) {
		if (src.responses) {
			console.log('Removing unused responses');
			state.responses = gatherResponses(src);
			for (var t in state.responses) {
				var response = state.responses[t];
				if (response.seen<=0) {
					console.log('  Deleting '+response.definition.name);
					src.responses.splice(t,1);
				}
			}
			common.clean(src,'responses');
		}
		return src;
	}
};