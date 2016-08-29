/* swagger deref
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

		var circles = circular.getCircularRefs(src);

		var lib = _.cloneDeep(src);
		delete src.parameters;
		src.definitions = {};

		for (var c in circles) {
			var circle = circles[c];
			for (var cc in circle.children) {
				var child = circle.children[cc];
				var ref = child.ref.replace('#/definitions/','');
				if ((lib.definitions[ref]) && (!src.definitions[ref])) {
					console.log('Circular reference '+child.ref+ '-> '+circle.ref);
					src.definitions[ref] = lib.definitions[ref];
				}
			}
		}

		// expand within definitions
		var changes = 1;
		while (changes>=1) {
			changes = 0;
			common.recurse(lib.definitions,{},function(obj,state){
				if (state.key == '$ref') {
					var reference = obj;

					if (!circular.isCircular(circles,reference)) {
						var result = jptr.jptr(lib,reference);
						state.parents[state.parents.length-2][state.keys[state.keys.length-2]] = result;
						changes++;
					}
				}
			});
		}

		// expand use of definitions
		var changes = 1;
		while (changes>=1) {
			changes = 0;

			common.recurse(src,{},function(obj,state){
				if (state.key == '$ref') {
					var reference = obj;

					if (!circular.isCircular(circles,reference)) {
						var result = _.cloneDeep(jptr.jptr(lib,reference));
						state.parents[state.parents.length-2][state.keys[state.keys.length-2]] = result;
						changes++;
					}
				}
			});
		}

		common.clean(src,'definitions');

		return src;
	}

};
