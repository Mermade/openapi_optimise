/*
* optimise schema objects (models) within openapi / swagger specifications
*/

var _ = require('lodash');
var common = require('./common.js');
var deref = require('./schema_deref.js');
var jptr = require('reftools/lib/jptr.js');

var MIN_LENGTH = '{"$ref": "#/definitions/m"},{"m": {}'.length;
var logger;

function analyse(gState,definition,models,base,key) {
	var state = {};
	state.path = base+jptr.jpescape(key);
	state.key = key;
	state.parent = definition;
	common.recurse(definition,state,function(obj,key,state){
		var model = {};
		if (common.isEmpty(obj[key])) {
			model.definition = {};
		}
		else {
			model.definition = obj[key];
		}
		model.name = key;
		model.path = state.path; //path+'/'+key;
		var json = JSON.stringify(obj[key]);
		model.parent = state.parent; // a direct object reference is smaller than storing another JSON pointer etc
		if ((json.length >= MIN_LENGTH) && (model.definition.type) ) {
			//&& ((model.definition.type == 'object') || (model.definition.type == 'array'))) {
			model.hash = common.sha1(json);
			model.length = json.length;
			models.push(model);
		}
		if ((key === "$ref") && (typeof obj[key] === 'string')) {
			var ref = obj[key];
			if (ref.startsWith('#/definitions/')) {
				ref = ref.replace('#/definitions/','');
				var sd = _.find(gState.definitions,function(o) { return o.name == ref;} );
				if (sd) {
					sd.seen++;
				}
			}
		}

	});
}

function extractModels(state,src,depth) {
	var models = [];

	if ((state.depth === 0) && (src.definitions)) {
		for (var d in src.definitions) {
			var definition = src.definitions[d];
			if (!definition["$ref"]) {
				analyse(state,definition,models,'#/definitions/',d);
			}
		}
	}

	common.forEachPath(src,function(path,pptr,name){
		for (var p in path.parameters) {
			var param = path.parameters[p];
			if (param.schema) {
				analyse(state,param.schema,models,pptr+'/parameters/',p);
			}
		}
	});

	common.forEachAction(src,function(action,aptr,name){

		for (var p in action.parameters) {
			var param = action.parameters[p];
			if (param.schema) {
				var pptr = aptr + '/parameters/';
				analyse(state,param.schema,models,pptr,p);
			}
		}

		for (var r in action.responses) {
			var response = action.responses[r];
			if (response.schema) {
				var rptr = aptr + '/responses/';
				analyse(state,response.schema,models,rptr,r);
			}
		}

	});

	if (src.parameters) {
		var cptr = '#/parameters';
		for (var p in src.parameters) {
			var param = src.parameters[p];
			if (param.schema) {
				var pptr = cptr + '/';
				analyse(state,param.schema,models,pptr,p);
			}
		}
	}

	if (src.responses) {
		var cptr = '#/responses';
		for (var r in src.responses) {
			var response = src.responses[r];
			if (response.schema) {
				var rptr = cptr + '/' + r; // r is an HTTP response status code, does not need escaping
				analyse(state,response.schema,models,rptr,r);
			}
		}
	}

	return models;
}

function getBestName(state,match) {
	var result = '';
	for (var l=match.locations.length-1;l>=0;l--) { // in reverse order
		var location = match.locations[l];
		if (isNaN(parseInt(location.name,10))) { // don't use result codes as model names
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

function deepCompare(state) {
	var index = 0;
	while (index<state.models.length) {
		var compare = index+1;
		while ((compare<state.models.length) && (state.models[index].length==state.models[compare].length)) {
			if (state.models[index].hash != state.models[compare].hash) {
				if (_.isEqual(state.models[index].definition,state.models[compare].definition)) {
					var reset = compare;
					while ((reset<state.models.length) && (state.models[reset].length == state.models[index].length)) {
						if (state.models[reset].hash == state.models[compare].hash) {
							logger.log('  Equivalent '+state.models[reset].hash+' and '+state.models[index].hash);
							state.models[reset].hash = state.models[index].hash;
						}
						reset++;
					}
				}
			}
			compare++;
		}
		index=compare;
	}
}

function matchModels(state) {
	var percent = -1;
	logger.log('Matching models');

	var mIndex = 0;
	while (mIndex<state.models.length-2) {
		var model = state.models[mIndex];
		var compare = state.models[mIndex+1];

		// TODO check for off-by-one errors
		while (compare && (model.length==compare.length) && (model.hash==compare.hash)) {

			//logger.log('Match '+model.hash+' '+model.length+' '+model.path);

			var matchLocn = -1;
			for (var h=state.matches.length-1;h>=0;h--) {
				var match = state.matches[h];
				if ((match.model.length!=model.length) || (match.model.hash != model.hash)) break; // break out early if length or hash changes
				if (_.isEqual(match.model.definition,model.definition)) {
					matchLocn = h;
					var locn = {};
					locn.path = compare.path;
					locn.parent = compare.parent;
					locn.name = compare.name;
					match.locations.push(locn);
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

			mIndex++;
			compare = state.models[mIndex+1];
		}
		mIndex++;

	}

	logger.log('\r100%');
}

module.exports = {

	optimise : function(src,options) {

		logger = new common.logger(options.verbose);
		var state = {};

		// we could always expand all existing $ref's here, but it is unlikely we would do a better job of renaming them all
		// when compressing again. It is also time and memory costly. This is available by setting options.expand = true
		if (options.expand) {
			src = deref.expand(src,options);
		}

		// always create #/definitions once, outside the loop, if no referencees are extracted, we delete it again later
		if (!src.definitions) {
			src.definitions = {};
		}
		var newDefs = {};

		var changes = 1;
		state.depth = 0;
		var oModels = -1;
		while (changes>0) {
			changes = 0;
			state.matches = [];

			state.definitions = [];
			for (var d in src.definitions) {
				var entry = {};
				entry.name = d;
				entry.seen = 0;
				state.definitions.push(entry);
			}

			logger.log('Extracting models');
			state.models = extractModels(state,src);

			logger.log('Sorting models ('+state.models.length+')'); // in reverse size, then hash order
			state.models = state.models.sort(function(a,b){
				if (a.length<b.length) return +1; // reverse
				if (a.length>b.length) return -1; // reverse
				//if (a.length>b.length) return +1; // standard sort
				//if (a.length<b.length) return -1; // standard sort
				if (a.hash>b.hash) return +1;
				if (a.hash<b.hash) return -1;
				return 0;
			});

			if (state.depth === 0) {
				logger.log('Removing unused definitions');
				for (var d in state.definitions) {
					var def = state.definitions[d];
					if (def.seen<=0) {
						logger.log('  #/definition/'+def.name);
						delete src.definitions[def.name];
					}
				}
			}

			if ((state.models.length>0) && (state.models.length!=oModels)) {
				deepCompare(state);
				matchModels(state);

				logger.log('Processing matches');
				for (var h in state.matches) {
					var match = state.matches[h];
					var newName = getBestName(state,match);

					logger.debug('  Match '+match.model.hash+' '+match.model.length+' * '+match.locations.length+' => '+newName);
					logger.debug(JSON.stringify(match.model.definition));

					var stillThere = jptr.jptr(src,match.locations[0].path);

					// this is where we create the new definition
					var stop = 1;
					if ((!options.inline) || (!stillThere)) {
						newDefs[newName] = _.clone(match.model.definition);
						stop = 0;
					}

					for (var l=match.locations.length-1;l>=stop;l--) {
						var location = match.locations[l];
						logger.debug('  @ '+location.path);

						// this is where the matching model is actually replaced by its $ref
						var newDef = {};
						if ((options.inline) && (stillThere)) {
							newDef["$ref"] = match.locations[0].path;
						}
						else {
							newDef["$ref"] = '#/definitions/'+newName;
						}
						location.parent[location.name] = newDef;
						changes++;
						stillThere = jptr.jptr(src,match.locations[0].path);
					}
				}
			}
			state.depth++;
			oModels = state.models.length;
		}

		src.definitions = Object.assign({},src.definitions,newDefs); // names are unique over state.definitions which is kept in sync

		common.clean(src,'definitions');

		return src;
	}

};
