'use strict';

/** common functions
*
*/

const crypto = require('crypto');
const _ = require('lodash');
const jptr = require('reftools/lib/jptr.js');
const recurse = require('reftools/lib/recurse.js').recurse;

const actions = ['get','head','post','put','delete','patch','options','trace']; //,'connect'];

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

var commonLogger;

function logger(verbosity) {
	this.verbosity = verbosity;
	this.write = function(s) {
		console.log(s);
	}
	this.log = function(s) {
		if (this.verbosity>0) console.log(s);
	};
	this.info = function(s) {
		if (this.verbosity>1) console.log(s);
	};
	this.debug = function(s) {
		if (this.verbosity>2) console.log(s);
	};
	commonLogger = this;
}

module.exports = {

	recurse : recurse,

	clean : function(parent,name) {
		if ((parent[name]) && (Object.keys(parent[name]).length<=0)) {
			commonLogger.log('No '+name+' required');
			delete parent[name];
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

	forEachPath : function(src,callback) {
		for (var p in src.paths) {
			var pptr = '#/'+jptr.jpescape(p);
			callback(src.paths[p],pptr,p);
		}
	},

	forEachAction : function(src,callback) {
		for (var p in src.paths) {
			var path = src.paths[p];
			for (var a in actions) {
				if (path[actions[a]]) {
					var aptr = '#/'+jptr.jpescape(p)+'/'+actions[a];
					callback(path[actions[a]],aptr,actions[a],path);
				}
			}
		}
	},

	logger : function(verbosity) {
		return new logger(verbosity);
	},

	sha1 : function(s) {
		var shasum = crypto.createHash('sha1');
		shasum.update(s);
		return shasum.digest('hex');
	},

	locations : function(api) {
		if (api.swagger) {
			return {
				parameters:'#/parameters',
				schemas:'#/definitions'
			};
		}
		if (api.openapi) {
			return {
				parameters:'#/components/parameters',
				schemas:'#/components/schemas'
			};
		}
		return {
			parameters:'#/',
			schemas:'#/'
		}
	}

};
