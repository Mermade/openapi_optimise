var _ = require('lodash');
var jptr = require('jgexml/jpath.js');
var common = require('./common.js');

function dump(defs,title,logger) {
	if (defs.length>0) logger.log(title);
	for (var d in defs) {
		var def = defs[d];
		logger.log(def.ref+' '+def.seen+' '+def.children.length);
		for (var c in def.children) {
			logger.log('  '+def.children[c].ref);
		}
	}
}

function topoSort(src,options) {
	// https://en.wikipedia.org/wiki/Topological_sorting

	var defs = [];
	var logger = common.logger(options.verbose);

	common.recurse(src,{},function(obj,state){
		if ((state.key == '$ref') && (typeof obj === 'string')) {

			if (obj == state.path) {
				logger.write('  Direct circular reference!');
			}

			var entry = {};
			var found = false;
			for (var d in defs) {
				var def = defs[d];
				if (def.ref == obj) {
					found = true;
					def.seen++;
					entry = def;
				}
				if (found) break;
			}
			if (!found) {
				entry.ref = obj;
				entry.seen = 1;
				entry.children = [];
				defs.push(entry);
			}

			var ref = obj;
			var restart = jptr.jptr(src,ref);

			var parent = state.parents[state.parents.length-1];
			var newState = {};

			common.recurse(restart,newState,function(obj,state) {
				if ((state.key == '$ref') && (typeof obj === 'string')) {
					var child = {};
					child.ref = obj;

					var found = false;
					for (var c in entry.children) {
						var compare = entry.children[c];
						if (compare.ref == obj) {
							found = true;
						}
					}
					if (!found) {
						entry.children.push(child);
					}
					if (child.ref == entry.ref) {
						entry.seen++;
					}
				}
			});

		}
	});

	var changes = 1;
	while (changes>0) {
		changes = 0;
		for (var d in defs) {
			var def = defs[d];
			if ((def.seen<=0) || (def.children.length<=0)) {

				// remove all references to 'empty' this $ref as children

				for (var dd in defs) {
					var compare = defs[dd];
					_.remove(compare.children, function(c){
						var result = (c.ref == def.ref);
						if (result) {
							def.seen--;
							changes++;
						}
						return result;
					});
				}

				// remove the $ref itself
				defs.splice(d,1);
				changes++;
			}
		}

	}

	dump(defs,'Circular refs:',logger);
	return defs;
}

module.exports = {

	getCircularRefs : topoSort,

	isCircular : function (circles,ref) {
		for (var c in circles) {
			var circle = circles[c];
			for (var cc in circle.children) {
				var child = circle.children[cc];
				if (child.ref == ref) return true;
			}
		}
		return false;
	}

};
