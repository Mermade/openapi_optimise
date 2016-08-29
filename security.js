var common = require('./common.js');

function gatherSecurity(src) {
	var security = [];
	// TODO
	return security;
}

module.exports = {

	optimise : function(src,options) {

		var state = {};
		state.security = gatherSecurity(src);

		common.forEachAction(src,function(action){

		});

		common.clean(src,'security');
		return src;
	}

};
