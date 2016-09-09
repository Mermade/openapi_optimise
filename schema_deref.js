/** swagger deref
* Used to pre-process specifications prior to shrinking (if required)
* Also used by tests to validate shrunk specifications are functionally equivalent to originals
*
* See https://github.com/bojand/json-schema-deref-sync as a possible alternative
*/

var _ = require('lodash');
var jptr = require('jgexml/jpath.js');
var common = require('./common.js');
var circular = require('./circular.js');

var logger;

module.exports = {

	expand : function(src,options) {

		logger = common.logger(options.verbose);
		var circles = circular.getCircularRefs(src,options);

		var lib = _.cloneDeep(src);
		delete src.parameters;
		src.definitions = {};

		for (var c in circles) {
			var circle = circles[c];
			for (var cc in circle.children) {
				var child = circle.children[cc];
				var ref = child.ref.replace('#/definitions/','');
				if ((lib.definitions[ref]) && (!src.definitions[ref])) {
					logger.log('Circular reference '+child.ref+ '-> '+circle.ref);
					src.definitions[ref] = lib.definitions[ref];
				}
			}
		}

		// expand within definitions
		var changes = 1;
		while (changes>=1) {
			changes = 0;
			var iState = {};
			iState.path = '#/definitions';
			common.recurse(lib.definitions,iState,function(obj,state){
				if ((state.key == '$ref') && (typeof obj === 'string')) {
					var reference = obj;
					var hmm = (state.path.startsWith(reference+'/'));
					if (!circular.isCircular(circles,reference)) {
						if (hmm) {
							console.log('@: '+state.path);
							console.log('$: '+reference);
						}
						else {
							var result = jptr.jptr(lib,reference);
							try {
								//var resultStr = JSON.stringify(result);
								//state.parents[state.parents.length-2][state.keys[state.keys.length-2]] = _.cloneDeep(result);
								state.parents[state.parents.length-2][state.keys[state.keys.length-2]] = result;
								changes++;
							}
							catch (ex) {
								console.log('Unhandled circular reference @ '+state.path);
							}
						}
					}
				}
			});
		}

		// expand use of definitions
		var changes = 1;
		while (changes>=1) {
			changes = 0;

			common.recurse(src,{},function(obj,state){
				if ((state.key == '$ref') && (typeof obj === 'string')) {
					var reference = obj;
					//console.log('two: '+reference);

					if (!circular.isCircular(circles,reference)) {
						var result = _.cloneDeep(jptr.jptr(lib,reference));
						state.parents[state.parents.length-2][state.keys[state.keys.length-2]] = result;
						changes++;
					}
				}
			});
		}

		// like object.assign but for arrays
		common.forEachAction(src,function(action,ptr,index,path){
			if ((path.parameters) && (action.parameters)) {
				action.parameters = _.unionWith(path.parameters,action.parameters,function(a,b){
					if (a.name>b.name) return +1;
					if (a.name<b.name) return -1;
					if (a["in"]>b["in"]) return +1;
					if (a["in"]<b["in"]) return -1;
					return 0;
				});
			}
		});
		common.forEachPath(src,function(path){
			if (path.parameters) delete path.parameters;
		});

		common.clean(src,'definitions');

		return src;
	}

};
