'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

const rr = require('recursive-readdir');
const yaml = require('js-yaml');
const _ = require('lodash');
const oao = require('./index.js');
const common = require('./common.js');
const sd = require('./schema_deref.js');
const empty = require('./empty.js');
const tags = require('./tags.js');
const security = require('./security.js');
const munge = require('./munge.js');

const argv = require('yargs')
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
	.boolean('compress')
	.alias('c','compress')
	.describe('compress','compress models')
	.boolean('inline')
	.alias('i','inline')
	.describe('inline','inline $refs where possible')
	.help('h')
	.alias('h', 'help')
	.strict()
	.version()
	.argv;

var SwaggerParser = require('swagger-parser');

var red = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[31m';
var green = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[32m';
var normal = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[0m';

var pass = 0;
var fail = 0;
var invalid = 0;
var pending = 0;
var failures = [];

var blacklist = require(path.resolve('./blacklist.json'));

var pathspec = argv._.length>0 ? argv._[0] : '../openapi-directory/APIs/';

var options = argv;
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

	var defo = _.cloneDeep(src);
	defo = oao.defaultOptimisations(defo,options);
	if (argv.compress) {
		defo = oao.nonDefaultOptimisations(defo,options);
	}
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

	if (_.isEqual(defo,exp)) {
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
	var components = file.split(path.sep);

	if ((components[components.length-1].endsWith('.yaml')) || (components[components.length-1].endsWith('.json'))) {
		console.log(file);

		var srcStr = fs.readFileSync(path.resolve(file),'utf8');
		var src;
		try {
			src = yaml.safeLoad(srcStr,{json:true});
		}
		catch (ex) {
			console.log(red+ex.message);
			return true;
		}
		if (!src.swagger && !src.openapi) {
			return true;
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
		failures.sort();
		console.log(red);
		for (var f in failures) {
			console.log(failures[f]);
		}
		console.log(normal);
	}
	console.log('Tests: %s passing, %s failing, %s invalid, %s pending',pass,fail,invalid,pending);
	process.exitCode = ((fail === 0) && (pass > 0)) ? 0 : 1;
});
