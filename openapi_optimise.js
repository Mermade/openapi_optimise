'use strict';
var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var yaml = require('js-yaml');
var j2y = require('jgexml/json2yaml.js');

var common = require('./common.js');
var opt = require('./index.js');
var deref = require('./schema_deref.js');
var circular = require('./circular.js');

var argv = require('yargs')
	.usage('openapi_optimise {source} [{target}]')
	.count('verbose')
	.alias('v','verbose')
	.alias('n','nondefault')
	.describe('nondefault','apply non-default operations')
	.boolean('nondefault')
	.describe('verbose','verbosity level, repeat for more logging')
	.alias('u','unindent')
	.boolean('unindent')
	.describe('unindent','no indentation/linefeeds')
	.boolean('analyse')
	.alias('a','analyse')
	.describe('analyse','analyse structure of specification')
	.boolean('expand')
	.alias('e','expand')
	.describe('expand','expand all local $refs before any model compression')
	.boolean('inline')
	.alias('i','inline')
	.describe('inline','inline $refs rather than moving to #/definitions')
	.boolean('force')
	.alias('f','force')
	.describe('force','allow overwriting of source with target')
	.boolean('jsyaml')
	.alias('j','jsyaml')
	.describe('jsyaml','use jsyaml for output, default jgexml')
	.boolean('skip-defaults')
	.alias('s','skip-defaults')
	.describe('skip-defaults','do not perform default optimisations')
	.boolean('preserve-tags')
	.alias('t','preserve-tags')
	.describe('preserve-tags','preserve tags with vendor extensions')
	.boolean('yaml')
	.alias('y','yaml')
	.describe('yaml','read and write specification in yaml format (default JSON)')
	.boolean('yamlread')
	.alias('r','yamlread')
	.describe('yamlread','read specification in yaml format')
	.boolean('yamlwrite')
	.alias('w','yamlwrite')
	.describe('yamlwrite','write specification in yaml format')
	.boolean('debug')
	.alias('d','debug')
	.describe('debug','debug options')
	.demand(1)
	.strict()
	.help('h')
    .alias('h', 'help')
	.version(function() {
		return require('../package.json').version;
	})
	.argv;

var logger = new common.logger(argv.verbose);

if (argv.analyse) {
	if (argv.verbose<2) argv.verbose = 2;
	argv.skipDefaults = true;
}
if (argv.debug) {
	logger.write(JSON.stringify(argv,null,2));
	process.exit();
}

var infile = argv._[0];
var outfile = (argv._.length>1 ? argv._[1] : '');

if ((infile === outfile) && (!argv.force)) {
	logger.write('source and target are same, use --force if sure');
	process.exit(1);
}

var src;
if ((argv.yaml) || (argv.yamlread)) {
	var srcStr = fs.readFileSync(path.resolve(infile),'utf8');
	src = yaml.safeLoad(srcStr);
}
else {
	src = require(path.resolve(infile));
}

var dest;
if (argv.skipDefaults) {
	dest = _.cloneDeep(src);
	if (argv.analyse) {
		var circles = circular.getCircularRefs(dest,argv);
		console.log('Circular references %s',circles.length);
	}
}
else {
	dest = opt.defaultOptimisations(src,argv);
}

if ((argv.expand) && (!argv.nondefault)) {
	dest = deref.expand(dest,argv);
}
if (argv.nondefault) {
	dest = opt.nonDefaultOptimisations(dest,argv);
}

var outStr;
if ((argv.yaml) || (argv.yamlwrite)) {
	if (argv.jsyaml) {
		outStr = yaml.safeDump(dest);
	}
	else {
		outStr = j2y.getYaml(dest);
	}
}
else {
	var indent = (argv.unindent ? '' : '\t');
	outStr = JSON.stringify(dest,null,indent);
}

if (outfile) {
	fs.writeFileSync(outfile,outStr,'utf8');
}
else {
	if (!argv.analyse) logger.write(outStr);
}
