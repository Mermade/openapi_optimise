/* openApi (swagger 2.0) optimiser */

var common = require('./common.js');
var _ = require('lodash');

function uniq(params,name) {
	var suffix = '';
	while (params && params[name+suffix]) {
		suffix = (suffix ? suffix+1 : 1);
	}
	return name+suffix;
}

function store(state,param,name,p,action,pa,common) {
	var found = false;
	for (var e in state.cache) {
		var entry = state.cache[e];
		if (_.isEqual(entry.definition,param)) {
			var location = {};
			location.path = p;
			location.action = action;
			location.index = pa;
			entry.locations.push(location);
			found = true;
			if (common) {
				console.log('Info: common parameters '+entry.name+' and '+name+' are identical');
				var dupe = {};
				dupe["from"] = name;
				dupe["to"] = entry.name;
				state.rename.push(dupe);
			}
		}
		else if (_.isMatch(entry.definition,param)) {
			console.log('Info: parameter subset detected');
			console.log('  '+entry.name+ ' @ '+entry.locations[0].action+' '+entry.locations[0].path);
			console.log('  '+name+' @ '+action+' '+p);
		}
	}
	if (!found) {
		var entry = {};
		entry.definition = param;
		entry.name = name;
		entry.common = common;
		entry.locations = [];
		var location = {};
		location.path = p;
		location.action = action;
		location.index = pa;
		entry.locations.push(location);
		state.cache.push(entry);
	}
	if (common) {
		var cp = {};
		cp.name = name;
		cp.seen = 0;
		state.common.push(cp);
	}
}

module.exports = {

	optimise : function(src) {

		var state = {};
		state.cache = [];
		state.rename = [];
		state.common = [];

		for (var p in src.parameters) {
			var param = src.parameters[p];
			store(state,param,p,'#/parameters/'+p,'all',-1,true);
		}

		for (var p in src.paths) {
			var path = src.paths[p];
			for (var a in common.actions) {
				var action = path[common.actions[a]];
				if (action) {

					for (var pa in action.parameters) {
						var param = action.parameters[pa];

						if (param["$ref"]) {
							var refName = param["$ref"].replace('#/parameters/','');
							for (var c in state.common) {
								var cp = state.common[c];
								if (cp.name == refName) {
									duplicate = false;
									for (var r in state.rename) {
										var dupe = state.rename[r];
										if (dupe["from"] == refName) duplicate = true;
									}
									if (!duplicate) cp.seen++;
								}
							}
						}
						else {
							store(state,param,param.name,p,common.actions[a],pa,false);
						}
					}
				}
			}
		}

		for (var e in state.cache) {
			var entry = state.cache[e];
			if (entry.locations.length>1) {
				var newName = entry.name;
				if (!entry.common) {
					newName = uniq(src.parameters,entry.definition.name);
					if (!src.parameters) {
						src.parameters = {};
					}
				}
				src.parameters[newName] = entry.definition;
				console.log('The following parameters can be merged into #/parameters/'+newName);
				for (var l in entry.locations) {
					var location = entry.locations[l];
					console.log('  '+entry.definition.name+' @ '+location.action+' '+location.path);
					if (location.action != 'all') {
						var newDef = {};
						newDef["$ref"] = '#/parameters/'+newName;
						src.paths[location.path][location.action].parameters[location.index] = newDef;
					}
				}
			}
		}

		if (state.rename.length>0) {
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
								for (var r in state.rename) {
									var ren = state.rename[r];
									if (ren["from"] == refName) {
										param["$ref"] = '#/parameters/'+ren["to"];
									}
								}
							}
						}
					}
				}
			}
		}

		if (state.common.length>0) {
			console.log('Checking common parameters are used');
			for (var c in state.common) {
				var cp = state.common[c];
				if (cp.seen <= 0) {
					console.log('  Deleting '+cp.name);
					delete src.parameters[cp.name];
				}
			}
		}
		common.clean(src.parameters,'parameters');

		return src;

	}

};
