/* swagger deref
* Used to pre-process specifications prior to shrinking (if required)
* Also used by tests to validate shrunk specifications are functionally equivalent to originals
*
* See https://github.com/bojand/json-schema-deref-sync as a possible alternative
*/

var _ = require('lodash');
var common = require('./common.js');
var jptr = require('jgexml/jpath.js');

function dump(defs,title) {
	console.log(title);
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

	//dump(defs,' final');
	return defs;
}

function isCircular(circles,ref) {
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

module.exports = {

	expand : function(src,options) {

		var circles = topoSort(src);

		var lib = _.cloneDeep(src);
		delete src.parameters;
		src.definitions = {};

		for (var c in circles) {
			var circle = circles[c];
			for (var cc in circle.children) {
				var child = circle.children[cc];
				var ref = child.ref.replace('#/definitions/','');
				if ((lib.definitions[ref]) && (!src.definitions[ref])) {
					console.log('Circular reference '+child.ref+ '-> '+circle.ref);
					src.definitions[ref] = lib.definitions[ref];
				}
			}
		}

		// expand within definitions
		var changes = 1;
		while (changes>=1) {
			changes = 0;
			common.recurse(lib.definitions,{},function(obj,state){
				if (state.key == '$ref') {
					var reference = obj;

					if (!isCircular(circles,reference)) {
						var result = jptr.jptr(lib,reference);
						state.parents[state.parents.length-2][state.keys[state.keys.length-2]] = result;
						changes++;
					}
				}
			});
		}

		// expand use of definitions
		var changes = 1;
		while (changes>=1) {
			changes = 0;

			common.recurse(src,{},function(obj,state){
				if (state.key == '$ref') {
					var reference = obj;

					if (!isCircular(circles,reference)) {
						var result = _.cloneDeep(jptr.jptr(lib,reference));
						state.parents[state.parents.length-2][state.keys[state.keys.length-2]] = result;
						changes++;
					}
				}
			});
		}

		common.clean(src,'definitions');

		return src;
	}

};
