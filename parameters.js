/* openApi (swagger 2.0) optimiser */

var common = require('./common.js');
var _ = require('lodash');

var state = {};

function transform(param) {
	newParam = _.cloneDeep(param);
	if ((newParam["in"] != 'path') && (newParam.required === false)) {
		delete newParam.required;
	}
	if (newParam.allowEmptyValue === false) {
		delete newParam.allowEmptyValue;
	}
	if (newParam.collectionFormat == 'csv') {
		delete newParam.collectionFormat;
	}
	if (newParam.exclusiveMaximum === false) {
		delete newParam.exclusiveMaximum;
	}
	if (newParam.exclusiveMinimum === false) {
		delete newParam.exclusiveMinimum;
	}
	if (newParam.minLength === 0) {
		delete newParam.minLength;
	}
	if (newParam.minItems === 0) {
		delete newParam.minItems;
	}
	if (newParam.uniqueItems === false) {
		delete newParam.uniqueItems;
	}
	return newParam;
}

function uniq(params,name) {
	var suffix = '';
	while (params && params[name+suffix]) {
		suffix = (suffix ? suffix+1 : 1);
	}
	return name+suffix;
}

function store(state,param,name,p,action,pa,level) {
	if (param["$ref"]) {
		var refName = param["$ref"].replace('#/parameters/','');
		for (var c in state.cache) {
			var cp = state.cache[c];
			for (var l in cp.locations) {
				var locn = cp.locations[l];
				if ((locn.level==0) && (cp.name == refName)) {
					cp.seen = true;
				}
			}
		}
	}
	else {
		var found = false;
		var newp = transform(param);
		for (var e in state.cache) {
			var entry = state.cache[e];
			if (_.isEqual(entry.definition,newp)) {
				if (state.options.v>=2) {
					console.log('Info: Level ' + level + ' parameters '+entry.name+' and '+name+' are identical');
				}
				var location = {};
				location.name = name;
				location.path = p;
				location.action = action;
				location.index = pa;
				location.level = level;
				location.operations = 0;
				entry.locations.push(location);
				found = true;
			}
			else if (_.isMatch(entry.definition,param)) {
				console.log('Info: parameter subset detected');
				console.log('  '+entry.name+ ' @ '+entry.locations[0].action+' '+entry.locations[0].path);
				console.log('  '+name+' @ '+action+' '+p);
			}
		}
		if (!found) {
			var entry = {};
			entry.definition = newp;
			entry.name = name;
			entry.locations = [];
			entry.seen = (level>0);
			var location = {};
			location.name = name;
			location.path = p;
			location.action = action;
			location.index = pa;
			location.level = level;
			location.operations = 0;
			entry.locations.push(location);
			state.cache.push(entry);
		}
	}
}

module.exports = {

	optimise : function(src,options) {

		state.options = options;
		state.cache = [];
		state.paths = [];

		for (var p in src.parameters) {
			var param = src.parameters[p];
			store(state,param,p,'#/parameters/'+p,'all',-1,0);
		}

		for (var p in src.paths) {
			var path = src.paths[p];

			for (var pa in path.parameters) {
				var param = path.parameters[pa];
				store(state,param,param.name,p,'all',-1,1);
			}

			var operations = 0;
			for (var a in common.actions) {
				var action = path[common.actions[a]];
				if (action) {
					operations++;
					for (var pa in action.parameters) {
						var param = action.parameters[pa];
						store(state,param,param.name,p,common.actions[a],pa,2);
					}
				}
			}
			var spath = {};
			spath.path = p;
			spath.operations = operations;
			state.paths.push(spath);
		}

		for (var e in state.cache) {
			var entry = state.cache[e];
			if (entry.locations.length>1) {
				var newName = entry.name;
				if (entry.locations[0].level==2) {
					newName = uniq(src.parameters,entry.definition.name);
					if (!src.parameters) {
						src.parameters = {};
					}
				}
				src.parameters[newName] = entry.definition; // will apply transforms
				console.log('The following parameters can be merged into #/parameters/'+newName);
				for (var l in entry.locations) {
					var location = entry.locations[l];
					console.log('  '+entry.definition.name+' @ '+location.action+' '+location.path);
					if (location.action != 'all') {
						if (entry.locations[0].level == 1) {
							// redundant duplication (override with no differences) of path-level parameter
							delete src.paths[location.path][location.action].parameters[location.index];
						}
						else {
							var newDef = {};
							newDef["$ref"] = '#/parameters/'+newName;
							src.paths[location.path][location.action].parameters[location.index] = newDef;
						}
					}
				}
			}
		}

		console.log('Promoting common required parameters to path-level');
		common.forEachPath(src,function(path,jptr,name){
			var spath = _.find(state.paths,function(o) { return o.path == name});
			if (spath.operations>1) {
				for (var e in state.cache) {
					var entry = state.cache[e];
					for (var l in entry.locations) {
						var locn = entry.locations[l];
						if ((locn.level == 2) && (entry.definition.required) && (locn.operations >= spath.operations)) {
							src.paths[path].parameters.push(entry.definition);
							src.paths[p][locn.action].parameters.splice(locn.index,1);
						}
					}
				}
			}
		});

		console.log('Renaming duplicated common parameters');
		for (var p in src.paths) {
			var path = src.paths[p];
			for (var a in common.actions) {
				var action = path[common.actions[a]];
				if (action) {
					for (var pa in action.parameters) {
						var param = action.parameters[pa];

						if (param["$ref"]) {
							var refName = param["$ref"].replace('#/parameters/','');

							var matchName = '';
							for (var e in state.cache) {
								var entry = state.cache[e];
								if (entry.name == refName) {
									matchName = refName;
									break;
								}
								else {
									for (var l in entry.locations) {
										var locn = entry.locations[l];
										if ((locn.level == 0) && (locn.name == refName)) {
											matchName = entry.name; // not locn.name
											break;
										}
									}
								}
								if (matchName) break;
							}

							if (matchName) {
								param["$ref"] = '#/parameters/'+matchName;
							}
						}
					}
				}
			}
		}

		console.log('Checking common parameters are used');
		for (var p in state.cache) {
			var entry = state.cache[p];
			if ((entry.locations[0].level==0) && (!entry.seen)) {
				console.log('  Deleting '+entry.name);
				delete src.parameters[entry.name];
			}
		}
		common.clean(src,'parameters');
		common.forEachPath(src,function(path){
			common.clean(path,'parameters');
		});

		return src;

	}

};
