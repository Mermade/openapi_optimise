var common = require('./common.js');

module.exports = {

	optimise : function(src,options){
		common.forEachAction(src,function(action){
			if (action.deprecated === false) delete action.deprecated;
		});
		return src;
	}

};