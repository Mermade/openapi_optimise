/*
* optimise schema objects (models) within openapi / swagger specifications
* TODO expand to handle generic JSON Schemas (though there are other tools for this)
*/

var crypto = require('crypto');
var _ = require('lodash');
var common = require('./common.js');
var deref = require('./schema_deref.js');
var jptr = require('jgexml/jpath.js');

var MIN_LENGTH = '{"$ref": "#/definitions/m"},{"m": {'.length;

function sha1(s) {
	var shasum = crypto.createHash('sha1');
	shasum.update(s);
	return shasum.digest('hex');
}

// TODO move recurse into its own module once function signature settles. Fold parameters into a state object
function recurse(obj,parent,path,options,callback) {

	if (typeof obj != 'string') {
		for (var key in obj) {
			// skip loop if the property is from prototype
			if (!obj.hasOwnProperty(key)) continue;

			if (!options.depthFirst) callback(obj,parent,key,path);

			//var array = Array.isArray(obj[key]);

			if (typeof obj[key] === 'object') {
				//if (array) {
				//	for (var i in obj[key]) {
				//		recurse(obj[key][i],obj[key],path+'/'+key+'['+i+']',options,callback);
				//	}
				//}
				recurse(obj[key],obj,path+'/'+key,options,callback);
			}

			if (options.depthFirst) callback(obj,parent,key,path);
		}
	}

	return obj;
}

function analyse(state,definition,models,base,key) {
	recurse(definition,{},base+key,{},function(obj,parent,key,path){
		//if (!obj["$ref"]) {
			var model = {};
			if (common.isEmpty(obj[key])) {
				model.definition = {};
			}
			else {
				model.definition = obj[key];
			}
			model.name = key;
			model.path = path+'/'+key;
			var json = JSON.stringify(obj[key]);
			model.parent = obj; // a direct object reference is smaller than storing the another JSON pointer etc
			if ((json.length >= MIN_LENGTH) && (model.definition.type) //) {
				&& ((model.definition.type == 'object') || (model.definition.type == 'array'))) {
				model.hash = sha1(json);
				model.length = json.length;
				models.push(model);
				console.log(model.hash + ' ' + model.length + ' ' + model.path);
			}
			if (obj["$ref"]) {
				var ref = obj["$ref"];
				if (ref.startsWith('#/definitions/')) {
					ref = ref.replace('#/definitions/','');
					var sd = _.find(state.definitions,function(o) { return o.name == ref;} );
					if (sd) {
						sd.seen++;
					}
				}
			}

		//}
	});
}

function extractModels(state,src) {
	var models = [];

	if (src.definitions) {
		for (var d in src.definitions) {
			var definition = src.definitions[d];
			if (!definition["$ref"]) {
				analyse(state,definition,models,'#/definitions/',d);
			}
		}
	}

	if (src.paths) {
		for (var s in src.paths) {
			var sptr = '#/'+jptr.jpescape(s);
			for (var a in src.paths[s]) {
				var aptr = sptr + '/' + jptr.jpescape(a);

				for (var p in src.paths[s][a].parameters) {
					var param = src.paths[s][a].parameters[p];
					if ((param.schema)) {//&& (!param.schema["$ref"])) {
						var pptr = aptr + '/' + p; // p is an array index, does not need escaping
						analyse(state,param.schema,models,pptr,p);
					}
				}

				for (var r in src.paths[s][a].responses) {
					var response = src.paths[s][a].responses[r];
					if (response.schema) {//&& (!response.schema["$ref"])) {
						var rptr = aptr + '/' + r; // r is an HTTP response status code, does not need escaping
						analyse(state,response.schema,models,rptr,r);
					}
				}

			}
		}
	}

	if (src.parameters) {
		var cptr = '#/parameters';
		for (var p in src.parameters) {
			var param = src.parameters[p];
			if ((param.schema) && (!param.schema["$ref"])) {
				var pptr = cptr + '/' + jptr.jpescape(p);
				analyse(state,param.schema,models,pptr,p);
			}
		}
	}

	if (src.responses) {
		var cptr = '#/responses';
		for (var r in src.responses) {
			var response = src.responses[r];
			if ((response.schema) && (!response.schema["$ref"])) {
				var rptr = cptr + '/' + r; // r is an HTTP response status code, does not need escaping
				analyse(state,response.schema.models,rptr,r);
			}
		}
	}

	return models;
}

function getBestName(state,match) {
	var result = '';
	for (var l=match.locations.length-1;l>=0;l--) { // in reverse order
		var location = match.locations[l];
		if (isNaN(parseInt(location.name,10))) {
			if ((location.name.length<result.length) || (!result)) {
				result = location.name;
			}
		}
	}
	if (!result) result = 'm'; // for model

	var suffix = '';
	while (_.findIndex(state.definitions, function(o) { return o.name == result+suffix; }) >= 0) {
		suffix = (suffix ? suffix+1 : 1);
	}
	result = result+suffix;
	var newDef = {};
	newDef.name = result;
	newDef.seen = 1;
	state.definitions.push(newDef);
	return result;
}

function matchModels(state) {
	var percent = -1;
	console.log('Matching models');
	for (var m=0;m<state.models.length;m++) {
		var model = state.models[m];

		var newPercent = Math.floor((m/state.models.length)*100.0);
		if (newPercent != percent) {
			process.stdout.write('\r'+newPercent+'%');
			percent = newPercent;
		}

		for (var c=m+1;((c<state.models.length) && (state.models[c].length==model.length));c++) {
			var compare = state.models[c];

			if (model.path != compare.path) {
				if ((model.hash == compare.hash) && (_.isEqual(model.definition,compare.definition))) {
					var matchLocn = -1;
					for (var h=state.matches.length-1;h>=0;h--) {
						var match = state.matches[h];
						if ((match.model.length!=model.length) || (match.model.hash != model.hash)) break; // break out early if length or hash changes
						if (_.isEqual(match.model.definition,model.definition)) {
							matchLocn = h;
							var location = {};
							location.path = compare.path;
							location.parent = compare.parent;
							location.name = compare.name;
							match.locations.push(location);
							break;
						}
					}

					if (matchLocn<0) {
						var newMatch = {};
						newMatch.model = model;
						newMatch.locations = [];

						var orgLocn = {};
						orgLocn.path = model.path;
						orgLocn.parent = model.parent;
						orgLocn.name = model.name;

						var matchLocn = {};
						matchLocn.path = compare.path;
						matchLocn.parent = compare.parent;
						matchLocn.name = compare.name;

						newMatch.locations.push(orgLocn);
						newMatch.locations.push(matchLocn);

						state.matches.push(newMatch);
					}

				}
			}

		}

	}
	console.log('\r100%');
}

module.exports = {

	optimise : function(src,options) {

		var state = {};

		// we could always expand all existing $ref's here, but it is unlikely we would do a better job of renaming them all
		// when compressing again. It is also time and memory costly. This is available by setting options.expand = true

		// TODO, it should be an option whether to extract the first occurrence of a model and $ref it (the default),
		// or to leave it in place and all the others to the original

		if (options.expand) {
			src = deref.expand(src);
		}

		state.matches = [];
		state.definitions = [];

		for (var d in src.definitions) {
			var entry = {};
			entry.name = d;
			entry.seen = 0;
			state.definitions.push(entry);
		}

		console.log('Extracting models');
		state.models = extractModels(state,src);

		console.log('Sorting models ('+state.models.length+')'); // in reverse size, then hash order
		state.models = state.models.sort(function(a,b){
			if (a.length<b.length) return +1; // reverse
			if (a.length>b.length) return -1; // reverse
			//if (a.length>b.length) return +1; // standard sort
			//if (a.length<b.length) return -1; // standard sort
			if (a.hash>b.hash) return +1;
			if (a.hash<b.hash) return -1;
			return 0;
		});

		matchModels(state);

		// always create #/definitions once, outside the loop, if no referencees are extracted, we delete it again later
		if (!src.definitions) {
			src.definitions = {};
		}

		console.log('Processing matches');
		for (var h in state.matches) {
			var match = state.matches[h];
			var newName = getBestName(state,match);

			console.log('  Match '+match.model.hash+' '+match.model.length+' * '+match.locations.length+' => '+newName);
			if (options.verbose>1) console.log(JSON.stringify(match.model.definition));

			src.definitions[newName] = _.clone(match.model.definition); //was cloneDeep

			for (var l=match.locations.length-1;l>=0;l--) {
				var location = match.locations[l];
				//if (options.verbose>1)
				console.log('  @ '+location.path);

				// this is where the matching model is actually replaced by its $ref
				var newDef = {};
				newDef["$ref"] = '#/definitions/'+newName;
				location.parent[location.name] = newDef;
			}
		}

		console.log('Removing unused definitions');
		for (var d in state.definitions) {
			var def = state.definitions[d];
			if (def.seen<=0) {
				console.log('  #/definition/'+def.name);
				delete src.definitions[def.name];
			}
		}
		common.clean(src.definitions,'definitions');

		return src;
	}

};
