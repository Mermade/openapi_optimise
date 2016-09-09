var fs = require('fs');
var path = require('path');
var rr = require('recursive-readdir');
var yaml = require('js-yaml');
var _ = require('lodash');
var oao = require('./index.js');
var common = require('./common.js');
var sd = require('./schema_deref.js')
var empty = require('./empty.js');
var munge = require('./munge.js');

var red = '\x1b[31m';
var green = '\x1b[32m';
var normal = '\x1b[0m';

var pass = 0;
var fail = 0;
var pending = 0;

var pathspec = (process.argv.length>2 ? process.argv[2] : '../openapi-directory/APIs');
var dump = (process.argv.length>3);

function check(file) {
	var components = file.split('\\');

	if (components[components.length-1] == 'swagger.yaml') {
		console.log(file);

		// blacklist
		for (var c in components) {
			var comp = components[c];
			if ((comp.startsWith('arm-network')) || (comp.startsWith('arm-machinelearning-webservices')) ||
				(comp.startsWith('dataflow')) || (comp.startsWith('datastore'))) {
				console.log(red+'  Blacklisted'+normal);
				pending++;
				return false;
			}
		}

		var srcStr = fs.readFileSync(path.resolve(file),'utf8');
		src = yaml.safeLoad(srcStr);

		var exp = _.cloneDeep(src);
		exp = empty.optimise(exp,{});
		exp = sd.expand(exp,{}); // as not a reversible operation
		exp = munge.munge(exp,{});  // (re)instates optional objects/arrays
		var expStr = JSON.stringify(exp,null,2);
		expSha1 = common.sha1(expStr);

		var defo = _.cloneDeep(src);
		defo = oao.defaultOptimisations(defo,{});
		defo = empty.optimise(defo,{}); // as not a reversible operation
		defo = munge.munge(defo,{}); // (re)instates optional objects/arrays
		defo = sd.expand(defo,{});
		var defoStr = JSON.stringify(defo,null,2);
		defoSha1 = common.sha1(defoStr);

		if (expSha1 == defoSha1) {
			console.log(green+'  Matches when expanded'+normal);
			pass++;
		}
		else {
			console.log(red+'  Mismatch of expanded versions'+normal);
			fail++;
			if (dump) {
				fs.writeFileSync('./a.json',expStr,'utf8');
				fs.writeFileSync('./b.json',defoStr,'utf8');
			}
		}
	}
}

rr(pathspec, function (err, files) {
	for (var i in files) {
		check(files[i]);
	}
});

process.on('exit',function(code) {
	console.log(pass+' passing, '+fail+' failing, '+pending+' pending');
});