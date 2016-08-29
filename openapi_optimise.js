var fs = require('fs');
var path = require('path');

var yaml = require('js-yaml');
var j2y = require('jgexml/json2yaml.js');

var opt = require('./index.js');
var deref = require('./schema_deref.js')

var argv = require('yargs')
	.usage('openapi_optimise {infile} [{outfile}]')
	.count('verbose')
	.alias('v', 'verbose')
	.alias('n', 'nondefault')
	.describe('nondefault','apply non-default operations')
	.boolean('nondefault')
	.describe('verbose','verbosity level, repeat for more logging')
	.boolean('expand')
	.alias('e','expand')
	.describe('expand','expand all local $refs before any model compression')
	.alias('d','deindent')
	.boolean('deindent')
	.describe('deindent','no indentation/linefeeds')
	.boolean('yaml')
	.alias('y','yaml')
	.describe('yaml','read and write specification in yaml format (default JSON)')
	.boolean('yamlinput')
	.alias('i','yamlinput')
	.describe('yamlinput','read specification in yaml format')
	.boolean('yamloutput')
	.alias('o','yamloutput')
	.describe('yamloutput','write specification in yaml format')
	.demand(1)
	.help('h')
    .alias('h', 'help')
	.argv;

var infile = argv._[0];

var src;
if ((argv.yaml) || (argv.yamlinput)) {
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
if ((argv.yaml) || (argv.yamloutput)) {
	outStr = j2y.getYaml(dest);
}
else {
	var indent = (argv.deindent ? '' : '\t');
	outStr = JSON.stringify(dest,null,indent);
}

if (outfile) {
	fs.writeFileSync(outfile,outStr,'utf8');
}
else {
	console.log(outStr);
}
