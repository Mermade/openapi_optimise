'use strict';

var fs = require('fs');
var path = require('path');
var rr = require('recursive-readdir');
var yaml = require('js-yaml');
var _ = require('lodash');
var oao = require('./index.js');
var common = require('./common.js');
var sd = require('./schema_deref.js');
var empty = require('./empty.js');
var tags = require('./tags.js');
var security = require('./security.js');
var munge = require('./munge.js');

var argv = require('yargs')
	.usage('testRunner [options] [{path-to-specs}]')
	.count('verbose')
	.alias('v','verbose')
	.describe('verbose','increase verbosity')
	.boolean('dump')
	.alias('d','dump')
	.describe('dump','dump expanded specs to a.json and b.json')
	.boolean('no-blacklist')
	.alias('b','no-blacklist')
	.describe('no-blacklist','turn off the blacklist')
	.boolean('validate')
	.describe('validate','use swagger-parser to validate specs')
	//.boolean('alternative')
	//.describe('alternative','use alternative dereferencing algorithm')
	//.alias('a','alternative')
	.help('h')
    .alias('h', 'help')
	.strict()
	.version(function() {
		return require('../package.json').version;
	})
	.argv;

var SwaggerParser = require('swagger-parser');

var red = '\x1b[31m';
var green = '\x1b[32m';
var normal = '\x1b[0m';

var pass = 0;
var fail = 0;
var invalid = 0;
var pending = 0;
var failures = [];

var blacklist = require(path.resolve('./blacklist.json'));

var pathspec = argv._.length>0 ? argv._[0] : '../openapi-directory/APIs/';

var options = {};
options.verbose = argv.verbose;
options.preserveTags = true;

function processSpec(src){
	var result = false;
	var exp = _.cloneDeep(src);
	exp = empty.optimise(exp,options); // as not a reversible operation
	exp = tags.optimise(exp,options); // as not a reversible operation
	exp = security.optimise(exp,options); // as not a reversible operation
	exp = sd.expand(exp,options);
	exp = munge.munge(exp,options); // (re)instates optional objects/arrays
	var expStr = JSON.stringify(exp,null,2);
	var expSha1 = common.sha1(expStr);

	var defo = _.cloneDeep(src);
	defo = oao.defaultOptimisations(defo,options);
	//if (argv.alternative) {
		// hmm, takes a callback
		// could use async library:series http://stackoverflow.com/a/9884496/139404
		//defo = SwaggerParser.dereference(defo, [options], [callback]);
	//}
	//else {
		defo = sd.expand(defo,options);
	//}
	defo = munge.munge(defo,options); // (re)instates optional objects/arrays
	var defoStr = JSON.stringify(defo,null,2);
	var defoSha1 = common.sha1(defoStr);

	if (expSha1 == defoSha1) {
		console.log(green+'  Matches when expanded'+normal);
		pass++;
		result = true;
	}
	else {
		console.log(red+'  Mismatch of expanded versions'+normal);
		fail++;
		if (argv.dump) {
			fs.writeFileSync('./a.json',expStr,'utf8');
			fs.writeFileSync('./b.json',defoStr,'utf8');
		}
	}
	return result;
}

function check(file) {
	var result = true;
	var components = file.split('\\');

	if ((components[components.length-1] == 'swagger.yaml') || (components[components.length-1] == 'swagger.json')) {
		console.log(file);

		var srcStr = fs.readFileSync(path.resolve(file),'utf8');
		var src;
		if (components[components.length-1] == 'swagger.yaml') {
			src = yaml.safeLoad(srcStr);
		}
		else {
			src = JSON.parse(srcStr);
		}
		console.log('  %s %s',src.info.title,src.info.version);
		console.log('  %s',src.host);

		if (!argv.noBlacklist) {
			for (var b in blacklist) {
				if ((src.info.title == blacklist[b].title) && (src.info.version === blacklist[b].version) &&
					(src.host == blacklist[b].host)) {
					console.log(red+'  Blacklisted'+normal);
					pending++;
					return true; // so we don't lump in with the final failure list
				}
			}
		}

		if (argv.validate) {
			var validator = new SwaggerParser();
			validator.validate(_.cloneDeep(src), function(err, api) {
				if (validator.api) console.log("API name: %s, Version: %s", validator.api.info.title, validator.api.info.version);
				if (err) {
					console.log(err);
					invalid++;
				}
				else {
					result = processSpec(src);
				}
			});
		}
		else {
			result = processSpec(src);
		}
	}
	return result;
}

rr(pathspec, function (err, files) {
	for (var i in files) {
		if (!check(files[i])) {
			failures.push(files[i]);
		}
	}
});

process.on('exit',function(code) {
	if (failures.length>0) {
		console.log(red);
		for (var f in failures) {
			console.log(red+failures[f]);
		}
		console.log(normal);
	}
	console.log('Tests: %s passing, %s failing, %s invalid, %s pending',pass,fail,invalid,pending);
});
