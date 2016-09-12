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

module.exports = {

	expand : function(src,options) {

		var logger = common.logger(options.verbose);
		var circles = circular.getCircularRefs(src,options);

		var lib = _.cloneDeep(src);
		delete src.parameters;
		src.definitions = {};

		var skip = [];
		for (var c in circles) {
			var circle = circles[c];
			for (var cc in circle.children) {
				var child = circle.children[cc];
				if (circle.ref.startsWith('#/definitions')) {
					var ref = child.ref.replace('#/definitions/','');
					if ((lib.definitions[ref]) && (!src.definitions[ref])) {
						logger.log('Reinstating circular reference '+circle.ref+ ' -> '+child.ref);
						src.definitions[ref] = lib.definitions[ref];
						skip.push(child.ref);
					}
				}
			}
		}

		// expand within definitions
		logger.info('Phase 1');
		var changes = 1;
		while (changes>=1) {
			changes = 0;
			var iState = {};
			iState.path = '#/definitions';
			common.recurse(lib.definitions,iState,function(obj,state){
				if ((state.key == '$ref') && (typeof obj === 'string')) {
					var reference = obj;
					if (skip.indexOf(reference)<0) {
						logger.debug(obj+' @ '+state.path);
						var result = _.cloneDeep(jptr.jptr(lib,reference));
						state.parents[state.parents.length-2][state.keys[state.keys.length-2]] = result;
						changes++;
					}
				}
			});
		}

		// expand use of definitions
		logger.info('Phase 2');
		var changes = 1;
		while (changes>=1) {
			changes = 0;

			common.recurse(src,{},function(obj,state){
				if ((state.key == '$ref') && (typeof obj === 'string')) {
					var reference = obj;

					if (skip.indexOf(reference)<0) {
						var result = jptr.jptr(lib,reference); //_.cloneDeep(
						state.parents[state.parents.length-2][state.keys[state.keys.length-2]] = result;
						changes++;
					}
				}
			});
		}

		// like object.assign but for arrays
		common.forEachAction(src,function(action,ptr,index,path){
			if ((path.parameters) && (action.parameters)) {
				logger.log('Merging path-level parameters to action @ '+ptr);
				action.parameters = _.unionWith(action.parameters,path.parameters,function(a,b){
					return ((a.name == b.name) && (a["in"] == b["in"]));
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
