/* openApi (swagger 2.0) optimiser */

var _ = require('lodash');

function uniq(params,name) {
	var suffix = '';
	while (params && params[name+suffix]) {
		suffix = (suffix ? suffix+1 : 1);
	}
	return name+suffix;
}

function store(cache,param,name,p,action,pa,warn) {
	var found = false;
	for (var e in cache) {
		var entry = cache[e];
		if (_.isEqual(entry.definition,param)) {
			if (entry.name == name) {
				var location = {};
				location.path = p;
				location.action = action;
				location.index = pa;
				entry.locations.push(location);
				found = true;
				break;
			}
			if (warn) {
				console.log('Info: common parameters '+entry.name+' and '+name+' are identical');
			}
		}
		else if (_.isMatch(entry.definition,param)) {
			console.log('Info: subset detected '+name);
		}
	}
	if (!found) {
		var entry = {};
		entry.definition = param;
		entry.name = param.name;
		entry.locations = [];
		var location = {};
		location.path = p;
		location.action = action;
		location.index = pa;
		entry.locations.push(location);
		cache.push(entry);
	}
}

module.exports = {

	optimise : function(src) {

		var actions = ['get','head','post','put','delete','patch','options','trace','connect'];

		var cache = [];

		for (var p in src.parameters) {
			var param = src.parameters[p];
			store(cache,param,p,'#','all',-1,true);
		}

		for (var p in src.paths) {
			var path = src.paths[p];
			for (var a in actions) {
				var action = path[actions[a]];
				if (action) {
					for (var pa in action.parameters) {
						var param = action.parameters[pa];

						if (!param["$ref"]) {
							store(cache,param,param.name,p,actions[a],pa,false);
						}
					}
				}
			}
		}

		var dest = _.clone(src);

		for (var e in cache) {
			var entry = cache[e];
			if (entry.locations.length>1) {
				var newName = uniq(dest.parameters,entry.name);
				if (!dest.parameters) {
					dest.parameters = {};
				}
				dest.parameters[newName] = entry.definition;
				console.log('The following parameters can be merged into #/'+newName);
				for (var l in entry.locations) {
					var location = entry.locations[l];
					console.log('  '+entry.name+' '+location.action+' '+location.path);
					var newDef = {};
					newDef["$ref"] = '#/parameters/'+newName;
					dest.paths[location.path][location.action].parameters[location.index] = newDef;
				}
			}
		}

		if (dest.produces || dest.consumes) {
			console.log('Optimising produces and consumes');

			for (var p in dest.paths) {
				var path = dest.paths[p];
				for (var a in actions) {
					if (path[actions[a]]) {
						var action = path[actions[a]];
						if (dest.produces && action.produces && _.isEqual(dest.produces,action.produces)) {
							delete action.produces;
						}
						if (dest.consumes && action.consumes && _.isEqual(dest.consumes,action.consumes)) {
							delete action.consumes;
						}
					}
				}
			}
		}

		return dest;

	}

};