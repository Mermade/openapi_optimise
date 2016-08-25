/* swagger deref
* Used to pre-process specifications prior to shrinking (if required)
* Also used by tests to validate shrunk specifications are functionally equivalent to originals
*/

var _ = require('lodash');
var jptr = require('jgexml/jpath.js');

function recurse(obj,parent,oldkey,path,options,callback) {

	if (typeof obj != 'string') {
		for (var key in obj) {
			// skip loop if the property is from prototype
			if (!obj.hasOwnProperty(key)) continue;

			if (!options.depthFirst) callback(obj,parent,key,oldkey,path);

			//var array = Array.isArray(obj[key]);

			if (typeof obj[key] === 'object') {
				//if (array) {
				//	for (var i in obj[key]) {
				//		recurse(obj[key][i],obj[key],path+'/'+key+'['+i+']',options,callback);
				//	}
				//}
				recurse(obj[key],obj,key,path+'/'+jptr.jpescape(key),options,callback);
			}

			if (options.depthFirst) callback(obj,parent,key,oldkey,path);
		}
	}

	return obj;
}


module.exports = {

	expand : function(src,options) {
		var dest = _.clone(src);

		var lib = {};
		lib.parameters = dest.parameters;
		lib.definitions = dest.definitions;
		delete dest.parameters;
		delete dest.definitions;

		var changes = 1;
		var circular = false;
		while ((changes>=1) && (!circular)) {
			changes = 0;
			recurse(dest,{},'','#',{},function(obj,parent,key,oldkey,path){
				if (key == '$ref') {
					var reference = obj[key];
					//console.log(reference+' @ '+path);
					//console.log(JSON.stringify(result));
					var result = _.cloneDeep(jptr.jptr(lib,obj[key]));

					circular = false;
					recurse(result,{},'',path,{},function(obj,parent,key,oldkey,path){
						if (key == '$ref') {
							if (obj[key] == reference) {
								console.log('Monkeypatching circular reference to '+path);
								//circular = true;
								obj[key] = path;
							}
						}
					});

					if (result) {
						parent[oldkey] = result;
						changes++;
					}
				}
			});
		}

		return dest;
	}

};