var common = require('./common.js');

module.exports = {

	optimise : function(src,options) {

		common.recurse(src,{},function(obj,state){
			if (common.isEmpty(obj)) {
				state.parents[state.parents.length-1][state.key] = {};
			}
		});

		return src;
	}

};
