/**
simplify json schema

Useful for schemas automatically generated from multiple input JSON files
*/

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var common = require('../common.js');

var argv = require('yargs')
	.usage('ajs [options] {source} [{target}]')
	.demand(2)
	.strict()
	.help('h')
    .alias('h', 'help')
	.alias('d','depth')
	.describe('depth','maximum depth to output')
	.alias('p','properties')
	.describe('properties','maximum number of properties to allow before coalescing')
	.default('depth',Math.MAX_VALUE)
	.version(function() {
		return require('../package.json').version;
	})
	.argv;

function process(src) {
	var changes = 0;
	common.recurse(src,{},function(obj,state) {
		if ((state.key == 'type') && (obj == '*')) {
			delete state.parents[state.parents.length-1][state.key];
		}
		if (state.depth>argv.depth) {
			state.parents[state.parents.length-1][state.key] = {};
			changes++;
		}
		else if ((!Array.isArray(obj)) && (Object.keys(obj).length>argv.properties)) {
			console.log('  %s',state.key);
			var newObj = {};
			newObj.patternProperties = {};
			var ppp = {};
			for (var p in obj) {
				// TODO we want the minimal common set of 'required' here
				if (typeof obj[p] === 'object') {
					ppp = _.mergeWith(ppp,obj[p],function(objValue, srcValue, key, object, source, stack){
						if ((key == 'type') && (typeof objValue == 'string') && (objValue != srcValue)) {
							return '*';
						}
						if ((key == 'required') && (Array.isArray(objValue))) {
							return _.intersection(objValue,srcValue);
						}
						return undefined;
					});
				}
			}
			newObj.patternProperties["^.*$"] = ppp; //.properties
			newObj.properties = {};
			newObj.type = 'object';
			newObj.required = _.cloneDeep(ppp.required);
			delete ppp.required;
			state.parents[state.parents.length-1].patternProperties = newObj.patternProperties;
			delete state.parents[state.parents.length-1].properties;
			changes++;
		}
	});
	return changes;
}

var src = require(path.resolve(argv._[0]));

var loop = 1;
var pass = 1;
while (loop>0) {
	console.log('Pass %s',pass++);
	loop = process(src);
}

if (!src["$schema"]) src["$schema"] = 'http://json-schema.org/draft-04/schema#';

fs.writeFileSync(path.resolve(argv._[1]),JSON.stringify(src,null,2),'utf8');
