var fs = require('fs');
var path = require('path');
var rr = require('recursive-readdir');
var yaml = require('js-yaml');
var _ = require('lodash');
var oao = require('./index.js');
var common = require('./common.js');
var sd = require('./schema_deref.js')

var red = '\x1b[31m';
var green = '\x1b[32m';
var normal = '\x1b[0m';

var pass = 0;
var fail = 0;

// https://raw.githubusercontent.com/APIs-guru/openapi-directory/master/APIs/botify.com/1.0.0/swagger.yaml

function check(file) {
	var components = file.split('\\');
	if (components[components.length-1] == 'swagger.yaml') {
		console.log(file);
		var srcStr = fs.readFileSync(path.resolve(file),'utf8');
		src = yaml.safeLoad(srcStr);

		var exp = _.cloneDeep(src);
		exp = sd.expand(exp,{});
		expSha1 = common.sha1(JSON.stringify(exp));

		var defo = _.cloneDeep(src);
		defo = oao.defaultOptimisations(defo,{});
		defo = sd.expand(defo,{});
		defoSha1 = common.sha1(JSON.stringify(defo));

		if (expSha1 == defoSha1) {
			console.log(green+'  Matches when expanded'+normal);
			pass++;
		}
		else {
			console.log(red+'  Mismatch of expanded versions'+normal);
			fail++;
		}
	}
}

var pathspec = '../openapi-directory/APIs';

rr(pathspec, function (err, files) {
	for (var i in files) {
		check(files[i]);
	}
});

process.on('exit',function(code) {
	console.log(pass+' passing, '+fail+' failing');
});