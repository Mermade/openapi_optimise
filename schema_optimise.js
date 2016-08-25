/*
* optimise schema objects within openapi / swagger specifications
* to be expanded to handle generic JSON Schemas
*/

var crypto = require('crypto');
var _ = require('lodash');
var deref = require('./schema_deref.js');
var jptr = require('jgexml/jpath.js');

var empty = [];
empty.push({});
var e2 = {};
e2.type = 'object';
empty.push(e2);
var e3 = {};
e3.type = 'object';
e3.additionalProperties = 'true';
empty.push(e3);

var MIN_LENGTH = '{"$ref": "#/definitions/foo"}'.length;

function isEmpty(obj) {
	for (var e in empty) {
		if (_.isEqual(empty[e],obj)) return true;
	}
	return false;
}

function sha1(s) {
	var shasum = crypto.createHash('sha1');
	shasum.update(s);
	return shasum.digest('hex');
}

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

function analyse(definition,models,base,key) {
	recurse(definition,{},base+key,{},function(obj,parent,key,path){
		if (!obj["$ref"]) {
			var model = {};
			if (isEmpty(obj[key])) {
				model.definition = {};
			}
			else {
				model.definition = obj[key];
			}
			model.name = key;
			model.path = path+'/'+key;
			var json = JSON.stringify(obj[key]);
			model.hash = sha1(json);
			model.length = json.length;
			model.parent = obj; // a direct ref is smaller than storing the path via JSON pointer etc
			models.push(model);
		}
	});
}

function extractModels(src) {
	var models = [];

	if (src.definitions) {
		for (var d in src.definitions) {
			var definition = src.definitions[d];
			if (!definition["$ref"]) {
				analyse(definition,models,'#/definitions/',d);
			}
		}
	}

	if (src.paths) {
		for (var s in src.paths) {
			var ptr = '#/'+jptr.jpescape(s);
			for (var a in src.paths[s]) {
				ptr += '/' + jptr.jpescape(a);
				for (var r in src.paths[s][a].responses) {
					var response = src.paths[s][a].responses[r];
					if (response.schema) {
						ptr += '/' + r;
						analyse(response.schema,models,ptr,r);
					}
				}
			}
		}
	}

	// TODO extract body payloads etc

	return models;
}

function getBestName(state,match) {
	var result = '';
	for (var l in match.locations) {
		var location = match.locations[l];
		if (isNaN(parseInt(location.name,10))) {
			if ((location.name.length<result.length) || (!result)) {
				result = location.name;
			}
		}
	}

	var suffix = '';
	while (state.definitions.indexOf(result+suffix)>=0) {
		suffix = (suffix ? suffix+1 : 1);
	}
	result = result+suffix;
	state.definitions.push(result);
	return result;
}

module.exports = {

	shrink : function(src,options) {

		var state = {};
		var dest;

		// we could always expand all existing $ref's here, but it is unlikely we would do a better job of renaming them all
		// when compressing again. This is available by setting options.expand = true

		// Whether to extract the first occurrence of a model and $ref it, or to leave it in place and all the others
		// to the original, should also be an option TODO

		if (options.expand) {
			dest = deref.expand(src);
		}
		else {
			dest = _.clone(src);
		}

		console.log('Extracting models');
		state.models = extractModels(dest);
		state.matches = [];
		state.definitions = [];

		for (var d in dest.definitions) {
			state.definitions.push(d);
		}

		console.log('Matching models');
		for (var m in state.models) {
			var model = state.models[m];

			for (var c in state.models) {
				var compare = state.models[c];

				if (model.path != compare.path) {
					if (_.isEqual(model.definition,compare.definition)) {
						found = false;
						for (var h in state.matches) {
							var match = state.matches[h];
							if (_.isEqual(match.definition,model.definition)) {
								found = true;
								var location = {};
								location.path = compare.path;
								location.parent = compare.parent;
								location.name = compare.name;
								match.locations.push(location);
								break;
							}
						}

						if (!found) {
							var newMatch = {};
							newMatch.definition = model.definition;
							newMatch.length = Math.min(model.length,compare.length);
							newMatch.hash = model.hash; // even though they may not hash to same value, useful for output
							newMatch.name = model.name;
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

		for (var h in state.matches) {
			var match = state.matches[h];
			if ((match.length >= MIN_LENGTH) && (match.definition.type) && (match.definition.type == 'object')) {
				var newName = getBestName(state,match);
				console.log('Got a match '+match.hash+' '+match.length+' would name it '+newName);
				console.log(JSON.stringify(match.definition));
				for (var l in match.locations) {
					var location = match.locations[l];
					console.log('  @ '+location.path);

					if (!dest.definitions) {
						dest.definitions = {};
					}
					dest.definitions[newName] = _.cloneDeep(match.definition);
					var newDef = {};
					newDef["$ref"] = '#/definitions/'+newName;
					location.parent[location.name] = newDef;

				}
			}
		}

		return dest;
	}

};
