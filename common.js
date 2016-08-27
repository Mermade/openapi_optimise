/* common functions
*
*/

var _ = require('lodash');
var jptr = require('jgexml/jpath');

var actions = ['get','head','post','put','delete','patch','options','trace','connect'];

var empty = [];
empty.push({});
var e2 = {};
e2.type = 'object';
empty.push(e2);
var e3 = {};
e3.type = 'object';
e3.additionalProperties = true;
empty.push(e3);
var e4 = {};
e4.type = 'object';
e4.properties = {};
e4.additionalProperties = true;
empty.push(e4);

/* state object contains
* options (input)
* parents,keys,paths (output)
*
* Initially you can pass in an empty object
*/
function recurse(obj,state,callback) {

	if (!state.parents) {
		state.parents = [];
		state.depth = 0;
	}
	if (!state.keys) state.keys = [];
	if (!state.paths) state.paths = [];
	if (!state.options) state.options = {}; // Object.assign with defaults

	if (typeof obj !== 'string') {
		for (var key in obj) {
			// skip loop if the property is from prototype
			if (!obj.hasOwnProperty(key)) continue;

			if (state.options.depthFirst) callback(obj,state);

			if (typeof obj[key] === 'object') {
				state.parents.push(obj);
				state.keys.push(key);
				state.paths.push(state.paths[state.paths.length-1]+'/'+jptr.jpescape(key));
				state.depth++;
				recurse(obj[key],state,callback);
				state.parents.pop();
				state.keys.pop();
				state.paths.pop();
				state.depth--;

			}

			if (!state.options.depthFirst) callback(obj,state);
		}
	}

	return obj;
}

module.exports = {

	recurse : recurse,

	clean : function(obj,description) {
		if (Object.keys(obj).length<=0) {
			console.log('No '+description+' required');
			delete obj;
		}
	},

	actions : actions,

	empty : empty,

	isEmpty : function(obj) {
		for (var e in empty) {
			if (_.isEqual(empty[e],obj)) return true;
		}
		return false;
	},

	forEachAction : function(src,callback) {
		for (var p in src.paths) {
			var path = src.paths[p];
			for (var a in actions) {
				if (path[actions[a]]) {
					callback(path[actions[a]]);
				}
			}
		}
	}

};
