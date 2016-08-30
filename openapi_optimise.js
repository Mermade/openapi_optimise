var fs = require('fs');
var path = require('path');

var yaml = require('js-yaml');
var j2y = require('jgexml/json2yaml.js');

var opt = require('./index.js');
var deref = require('./schema_deref.js')

var argv = require('yargs')
	.usage('openapi_optimise {infile} [{outfile}]')
	.count('verbose')
	.alias('v','verbose')
	.alias('n','nondefault')
	.describe('nondefault','apply non-default operations')
	.boolean('nondefault')
	.describe('verbose','verbosity level, repeat for more logging')
	.alias('d','deindent')
	.boolean('deindent')
	.describe('deindent','no indentation/linefeeds')
	.boolean('expand')
	.alias('e','expand')
	.describe('expand','expand all local $refs before any model compression')
	.boolean('inline')
	.alias('i','inline')
	.describe('inline','inline $refs rather than moving to #/definitions')
	.boolean('jsyaml')
	.alias('j','jsyaml')
	.describe('jsyaml','use jsyaml for output, default jgexml')
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
	.boolean('show')
	.alias('s','show')
	.demand(1)
	.help('h')
    .alias('h', 'help')
	.argv;

if (argv.show) {
	logger.log(JSON.stringify(argv,null,2));
	process.exit();
}

var infile = argv._[0];

var src;
if ((argv.yaml) || (argv.yamlread)) {
	var srcStr = fs.readFileSync(path.resolve(infile),'utf8');
	src = yaml.safeLoad(srcStr);
}
else {
	src = require(path.resolve(infile));
}

var dest = opt.defaultOptimisations(src,argv);

if (argv.expand) {
	dest = deref.expand(dest,argv);
}
if (argv.nondefault) {
	dest = opt.nonDefaultOptimisations(dest,argv);
}

var outfile = (argv._.length>1 ? argv._[1] : '');

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
	var indent = (argv.deindent ? '' : '\t');
	outStr = JSON.stringify(dest,null,indent);
}

if (outfile) {
	fs.writeFileSync(outfile,outStr,'utf8');
}
else {
	logger.log(outStr);
}
