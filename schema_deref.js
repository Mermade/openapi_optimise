/* swagger deref
* Used to pre-process specifications prior to shrinking (if required)
* Also used by tests to validate shrunk specifications are functionally equivalent to originals
*/

var _ = require('lodash');
var jptr = require('jgexml/jpath.js');

function recurse(obj,parent,oldkey,path,options,callback) {

	if (typeof obj != 'string') {
		for (var key in obj) {
			// skip loop if the property is from prototype
			if (!obj.hasOwnProperty(key)) continue;

			if (!options.depthFirst) callback(obj,parent,key,oldkey,path);

			//var array = Array.isArray(obj[key]);

			if (typeof obj[key] === 'object') {
				//if (array) {
				//	for (var i in obj[key]) {
				//		recurse(obj[key][i],obj[key],path+'/'+key+'['+i+']',options,callback);
				//	}
				//}
				recurse(obj[key],obj,key,path+'/'+jptr.jpescape(key),options,callback);
			}

			if (options.depthFirst) callback(obj,parent,key,oldkey,path);
		}
	}

	return obj;
}

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

	recurse(src,{},'','#',{},function(obj,parent,key,oldkey,path){
		if (key == '$ref') {

			var entry = {};
			var found = false;
			for (var d in defs) {
				var def = defs[d];
				if (def.ref == obj[key]) {
					found = true;
					def.seen++;
					entry = def;
				}
				if (found) break;
			}
			if (!found) {
				entry.ref = obj[key];
				entry.seen = 1;
				entry.children = [];
				defs.push(entry);
			}

			var ref = obj[key];
			var restart = jptr.jptr(src,ref);

			//console.log(ref+' '+JSON.stringify(restart));

			recurse(restart,parent,oldkey,path,{},function(obj,parent,key,oldkey,path) {
				if (key == '$ref') {
					var child = {};
					child.ref = obj[key];

					var found = false;
					for (var c in entry.children) {
						var compare = entry.children[c];
						if (compare.ref == obj[key]) {
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
		var dest = _.clone(src);

		var circles = topoSort(dest);

		var lib = {};
		lib.parameters = dest.parameters;
		lib.definitions = dest.definitions;
		delete dest.parameters;
		delete dest.definitions;

		var changes = 1;
		var abort = false;
		while ((changes>=1) && (!abort)) {
			changes = 0;
			recurse(dest,{},'','#',{},function(obj,parent,key,oldkey,path){
				if (key == '$ref') {
					var reference = obj[key];

					if (!isCircular(circles,reference)) {
						var result = _.cloneDeep(jptr.jptr(lib,reference));
						//console.log(reference+' @ '+path);
						//console.log(JSON.stringify(result));

						abort = false;
						recurse(result,{},'',path,{},function(obj,parent,key,oldkey,path){
							if (key == '$ref') {
								var newRef = obj[key];
								//console.log(newRef + ' =? '+reference);
								//console.log(JSON.stringify(parent));
								//console.log(JSON.stringify(obj));
								if (newRef == reference) {
									console.log('Monkeypatching self reference to '+reference);
									//abort = true;
									obj[key] = path;
								}
							}
						});

						if (result) {
							// this is where the expansion actually happens
							parent[oldkey] = result;
							changes++;
						}
					}
					else {
						console.log('Avoided derefencing '+reference);
					}
				}
			});
		}

		return dest;
	}

};