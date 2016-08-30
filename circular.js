var jptr = require('jgexml/jpath.js');
var common = require('./common.js');

function dump(defs,title) {
	if (defs.length>0) console.log(title);
	for (var d in defs) {
		var def = defs[d];
		console.log(def.ref+' '+def.seen+' '+def.children.length);
		for (var c in def.children) {
			console.log('  '+def.children[c].ref);
		}
	}
}

function topoSort(src) {
	// https://en.wikipedia.org/wiki/Topological_sorting

	var defs = [];

	common.recurse(src,{},function(obj,state){
		if (state.key == '$ref') {

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

			//console.log(ref+' '+JSON.stringify(restart));

			var parent = state.parents[state.parents.length-1];
			var newState = {};

			common.recurse(restart,newState,function(obj,state) {
				if (state.key == '$ref') {
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

	//dump(defs,' one');

	var changes = 1;
	while (changes>0) {
		changes = 0;
		for (var d in defs) {
			var def = defs[d];
			if ((def.seen<=1) || (def.children.length<=0)) {

				for (var dd in defs) {
					var compare = defs[dd];
					for (var c in compare.children) {
						var child = compare.children[c];
						if (child.ref == def.ref) {
							compare.children.splice(c,1);
							changes++;
						}
					}
				}

				defs.splice(d,1);
				changes++;
			}
		}

		//dump(defs,' subsequent');
	}

	dump(defs,'Circular refs:');
	return defs;
}

module.exports = {

	getCircularRefs : topoSort,

	isCircular : function (circles,ref) {
		var result = false;
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
