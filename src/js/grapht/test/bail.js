// This is a process will parse the faucet output and only
// display the first failure
// ... it's like tap-bail but doesn't actually stop the tests
// and actually works with tape-run
//
// usage: browserify test.js | tape-run | node bail.js
var readline = require('readline');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false
});

var bailing = false;
var bail = false;
var plan;
rl.on('line', function(line){
	if( bail ){
		return;
	}
	if( bailing ){
		if( /^\s\s\.\.\./.test(line) ){
			bail = true;
		}
	} else {
		if( /^not ok/.test(line) ){
			var matches = line.match(/^not ok (\d+)/);
			plan = "1.." + matches[1];
			bailing = true;
		}
	}
	console.log(line);
	if( bail ){
		console.log("Bail out!");
		console.log(plan);
	}
})
