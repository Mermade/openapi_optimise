var fs = require('fs');
var path = require('path');
var rr = require('recursive-readdir');
var yaml = require('js-yaml');
var _ = require('lodash');
var oao = require('./index.js');
var common = require('./common.js');
var sd = require('./schema_deref.js')
var empty = require('./empty.js');
var tags = require('./tags.js');
var security = require('./security.js');
var munge = require('./munge.js');

var argv = require('yargs')
	.usage('testRunner [options] [{path-to-specs}]')
	.count('verbose')
	.alias('v','verbose')
	.boolean('dump')
	.alias('d','dump')
	.describe('dump','dump expanded specs to a.json and b.json')
	.boolean('no-blacklist')
	.alias('b','no-blacklist')
	.describe('no-blacklist','turn off the blacklist')
	.boolean('validate')
	.describe('validate','use swagger-parser to validate specs')
	.help('h')
    .alias('h', 'help')
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

var blacklist = require(path.resolve('./blacklist.json'));

var pathspec = argv._.length>0 ? argv._[0] : '../openapi-directory/APIs/';

function processSpec(src){
	var exp = _.cloneDeep(src);
	exp = empty.optimise(exp,{});
	exp = tags.optimise(exp,{"preserveTags": true}); // as not a reversible operation
	exp = security.optimise(exp,{}); // as not a reversible operation
	exp = sd.expand(exp,{}); // as not a reversible operation
	exp = munge.munge(exp,{});  // (re)instates optional objects/arrays
	var expStr = JSON.stringify(exp,null,2);
	expSha1 = common.sha1(expStr);

	var defo = _.cloneDeep(src);
	defo = oao.defaultOptimisations(defo,{});
	//defo = empty.optimise(defo,{}); // as not a reversible operation
	//defo = tags.optimise(defo,{"preserveTags": true}); // as not a reversible operation
	//defo = security.optimise(defo,{}); // as not a reversible operation
	defo = sd.expand(defo,{});
	defo = munge.munge(defo,{}); // (re)instates optional objects/arrays
	var defoStr = JSON.stringify(defo,null,2);
	defoSha1 = common.sha1(defoStr);

	if (expSha1 == defoSha1) {
		console.log(green+'  Matches when expanded'+normal);
		pass++;
	}
	else {
		console.log(red+'  Mismatch of expanded versions'+normal);
		fail++;
		if (argv.dump) {
			fs.writeFileSync('./a.json',expStr,'utf8');
			fs.writeFileSync('./b.json',defoStr,'utf8');
		}
	}
}

function check(file) {
	var result = false;
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
					return false;
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
		check(files[i]);
	}
});

process.on('exit',function(code) {
	console.log('Tests: %s passing, %s failing, %s invalid, %s pending',pass,fail,invalid,pending);
});
