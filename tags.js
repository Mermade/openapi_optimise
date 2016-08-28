var _ = require('lodash');
var common = require('./common.js');

var state = {};
state.tags = [];

// TODO option to preserve tags with vendor-extensions

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
	return state.tags;
}

module.exports = {
	optimise : function(src,options) {
		if (src.tags) {
			console.log('Removing unused tags');
			state.tags = gatherTags(src);
			for (var t in state.tags) {
				var tag = state.tags[t];
				if (tag.seen<=0) {
					console.log('  Deleting '+tag.definition.name);
					_.remove(src.tags,function(o){
						return (o.name == tag.definition.name);
					});
				}
			}
			common.clean(src,'tags');
		}
		return src;
	}
};