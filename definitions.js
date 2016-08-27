var common = require('./common.js');

module.exports = {

	optimise : function(src) {
		common.clean(src.definitions,'definitions');
		return src;
	}

};