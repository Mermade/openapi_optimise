var common = require('./common.js');

module.exports = {

	optimise : function(src,options) {

		common.recurse(src,{},function(obj,key,state){
			if (common.isEmpty(obj)) {
                state.parent[state.pkey] = {};
			}
		});

		return src;
	}

};
