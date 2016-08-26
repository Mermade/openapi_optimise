var fs = require('fs');
var path = require('path');

if (process.argv.length>2) {
	var infile = process.argv[2];
	var src = require(path.resolve(infile));

	var outfile = (process.argv.length>3 ? process.argv[3] : '');

	if (outfile) {
		fs.writeFileSync(outfile,JSON.stringify(src),'utf8');
	}
	else {
		console.log(JSON.stringify(src));
	}
}
else {
	console.log('Usage: detab {infile} [{outfile}]');
}
