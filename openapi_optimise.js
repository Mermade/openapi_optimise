var fs = require('fs');
var path = require('path');
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
	.describe('expand','expand all local $refs before compression')
	.demand(1)
	.help('h')
    .alias('h', 'help')
	.argv;

var infile = argv._[0];
var src = require(path.resolve(infile));

var dest = opt.defaultOptimisations(src,argv);

if (argv.expand) {
	dest = deref.expand(dest,argv);
}
if (argv.nondefault) {
	dest = opt.nonDefaultOptimisations(dest,argv);
}

var outfile = (argv._.length>1 ? argv._[1] : '');

if (outfile) {
	fs.writeFileSync(outfile,JSON.stringify(dest,null,'\t'),'utf8');
}
else {
	console.log(JSON.stringify(dest,null,'\t'));
}
