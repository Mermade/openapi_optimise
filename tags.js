var common = require('./common.js');

var state = {};
state.tags = [];

function gatherTags(src) {
	for (var t in src.tags) {
		var tag = {};
		tag.definition = src.tags[t];
		tag.seen = 0;
		state.tags.push(tag);
	}
	common.forEachAction(src,function(action){
		for (var t in action.tags) {
			var tag = action.tags[t];
			for (var st in state.tags) {
				var stag = state.tags[st];
				if (stag.definition.name == tag) {
					stag.seen++;
				}
			}
		}
	});
}

module.exports = {
	optimise : function(src) {
		if (src.tags) {
			console.log('Removing unused tags');
			state.tags = gatherTags(src);
			for (var t in state.tags) {
				var tag = state.tags[t];
				if (tag.seen<=0) {
					console.log('  Deleting '+tag.definition.name);
					src.tags.splice(t,1);
				}
			}
			common.clean(src,'tags');
		}
		return src;
	}
};