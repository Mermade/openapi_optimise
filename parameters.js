/* openApi (swagger 2.0) optimiser */

'use strict';

const util = require('util');

const common = require('./common.js');
const _ = require('lodash');

var state = {};
var logger;

function minimum(param) {
	let newParam = _.cloneDeep(param);
	if ((newParam["in"] !== 'path') && (newParam.required === false)) {
		delete newParam.required;
	}
    return newParam;
}

function transform(param) {
	let newParam = _.cloneDeep(param);
	var numeric = ((newParam.type == 'integer') || (newParam.type == 'number'));
	if (newParam.description === '') {
		delete newParam.description;
	}
	if ((newParam["in"] !== 'path') && (newParam.required === false)) {
		delete newParam.required;
	}
	if (newParam.allowEmptyValue === false) {
		delete newParam.allowEmptyValue; // applies only to in:query or in:formdata parameters
	}
	if (newParam.collectionFormat == 'csv') {
		delete newParam.collectionFormat;
	}
	// TODO collectionFormat:multi applies only to in:query or in:formdata parameters
	if (!numeric) {
		delete newParam.minimum;
		delete newParam.maximum;
		delete newParam.exclusiveMinimum;
		delete newParam.exclusiveMaximum;
		delete newParam.multipleOf;
	}
	if (newParam.type !== 'string') {
		delete newParam.pattern;
		delete newParam.minLength;
		delete newParam.maxLength;
	}
	if (newParam.type !== 'array') {
		delete newParam.uniqueItems;
		delete newParam.minItems;
		delete newParam.maxItems;
	}
	if (newParam.type == 'boolean') {
		delete newParam["enum"]; // not prohibited by JSON Schema 4 but should be redundant
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
	if (typeof newParam.format !== 'undefined') {
		var allowedFormats = [];
		if (newParam.type == 'integer') allowedFormats = ['int32','int64'];
		if (newParam.type == 'number') allowedFormats = ['float','double'];
		if (newParam.type == 'string') allowedFormats = ['byte','binary','date','date-time','password'];
		if (allowedFormats.indexOf(newParam.format)<0) {
			delete newParam.format;
		}
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

function store(state,param,name,p,action,pa,level,options) {
	if (param["$ref"]) {
		var refName = options.openapi ? param["$ref"].replace('#/components/parameters/','') :
            param["$ref"].replace('#/parameters/','');
		for (var c in state.cache) {
			var cp = state.cache[c];
			for (var l in cp.locations) {
				var locn = cp.locations[l];
				if ((locn.level === 0) && (cp.name === refName)) {
					cp.seen = true;
				}
			}
		}
		return param;
	}
	else {
		var found = false;
		var newp = options.transform(param);
		for (var e in state.cache) {
			var entry = state.cache[e];
			if (_.isEqual(entry.definition,newp)) {
				logger.info('Level ' + level + ' parameters '+entry.name+':'+entry.in+' and '+name+':'+newp.in+' are identical');
				var location = {};
				location.name = name;
				location.path = p;
				location.action = action;
				location.index = pa;
				location.level = level;
				location.operations = 0;
                location.in = newp.in;
				entry.locations.push(location);
				found = true;
			}
			else if (_.isMatch(entry.definition,param)) {
				logger.info('Parameter subset detected');
				logger.info('  '+entry.name+ ' @ '+entry.locations[0].action+' '+entry.locations[0].path);
				logger.info('  '+name+' @ '+action+' '+p);
			}
		}
		if (!found) {
			var entry = {};
			entry.definition = newp;
			entry.name = name;
            entry.in = param.in;
			entry.locations = [];
			entry.seen = (level>0);
            entry.initial = level;
			var location = {};
			location.name = name;
			location.path = p;
			location.action = action;
			location.index = pa;
			location.level = level;
			location.operations = 0;
            location.in = newp.in;
			entry.locations.push(location);
			state.cache.push(entry);
		}
		return newp;
	}
}

module.exports = {

	transform : transform,

    minimum : minimum,

	optimise : function(src,options) {

        if (options.minimum) options.transform = minimum
        else options.transform = transform;

        options.openapi = !!src.openapi;

		logger = new common.logger(options.verbose);

		state.options = options;
		state.cache = [];
		state.paths = [];

		for (var p in src.parameters) {
			var param = src.parameters[p];
			param = store(state,param,p,'#/parameters/'+p,'all',-1,0,options);
		}

	 	if (src.components && src.components.parameters) {
			for (var p in src.components.parameters) {
				var param = src.components.parameters[p];
				param = store(state,param,p,'#/components/parameters/'+p,'all',-1,0,options);
			}
		}

		for (var p in src.paths) {
			var path = src.paths[p];

			for (var pa in path.parameters) {
				var param = path.parameters[pa];
				param = store(state,param,param.name,p,'all',-1,1,options);
			}

			var operations = 0;
			for (var a in common.actions) {
				var action = path[common.actions[a]];
				if (action) {
					operations++;
					for (var pa in action.parameters) {
						var param = action.parameters[pa];
						param = store(state,param,param.name,p,common.actions[a],pa,2,options);
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
				if (entry.locations[0].level>=1) { // was == 2
					newName = uniq(src.parameters,entry.definition.name);
				}
				if (!src.parameters) {
					src.parameters = {};
				}
				src.parameters[newName] = entry.definition; // will apply transforms
                logger.log('The following parameters can be merged into #/parameters/'+newName);

				for (var l in entry.locations) {
					var location = entry.locations[l];
                    logger.log('  '+entry.definition.name+':'+entry.definition.in+' @ '+location.action+' '+location.path);
					if ((location.action != 'all') && (entry.locations[0].in === location.in) && (location.in === entry.in)) {
						if ((entry.locations[0].level == 1) && (entry.locations[0].path == location.path)) {
							// redundant duplication (override with no differences) of path-level parameter
							src.paths[location.path][location.action].parameters.splice(location.index,1);
							entry.seen = true; // new
						}
						else {
							var newDef = {};
							newDef["$ref"] = '#/parameters/'+newName;
							src.paths[location.path][location.action].parameters[location.index] = newDef;
							entry.seen = true; // new
						}
					}
				}
			}
		}

		logger.log('Promoting common required parameters to path-level');
		common.forEachPath(src,function(path,jptr,name){
			var spath = _.find(state.paths,function(o) { return o.path == name; });
			if (spath.operations>1) {
				for (var e in state.cache) {
					var entry = state.cache[e];
					for (var l in entry.locations) {
						var locn = entry.locations[l];
						if ((locn.level == 3) && (entry.definition.required) && (locn.operations >= spath.operations)) {
                            src.paths[path].parameters.push(entry.definition);
							src.paths[p][locn.action].parameters.splice(locn.index,1);
						}
					}
				}
			}
		});

		logger.log('Renaming duplicated common parameters');
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
								if ((entry.name === refName) && (entry.initial === 0)) {
									matchName = refName;
									break;
								}
								else {
									for (var l in entry.locations) {
										var locn = entry.locations[l];
										if ((locn.level === 0) && (locn.name == refName)) {
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

        // handle azure $refs from within x- extensions
        common.recurse(src,{},function(obj,key,rstate){
            if ((key == '$ref') && (typeof obj[key] === 'string')) {
                if (obj[key].indexOf('/parameters/')>=0) {
                    let p = obj[key].split('/').pop();
                    for (var e in state.cache) {
                        let entry = state.cache[e];
                        if ((entry.initial === 0) && (entry.name === p)) {
                            entry.seen++;
                        }
                    }
                }
            }
        });

		logger.log('Checking common parameters are used');
		for (var p in state.cache) {
			var entry = state.cache[p];
			if ((entry.locations[0].level === 0) && (!entry.seen)) {
				logger.log('  Deleting '+entry.name);
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
