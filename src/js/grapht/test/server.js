var spawn = require('child_process').spawn;
var fs = require('fs');
var cwd = '../../../';
var dataDir = cwd+'data/';

module.exports.run = function(fn){
	var appID = 'jstest';
	var testDB = dataDir+appID;
	fs.writeFileSync(testDB, '');
	var proc = spawn('./bin/grapht',{
		cwd: cwd
	});
	var started = false;

	proc.on('close', function(){
		console.log("SERVER EXITED!")
	});

	var serving = new Promise(function(resolve, reject){
		proc.stdout.on('data', function(data){
			console.log("\nSERVER SAID:", data.toString(), "\n")
			if( started ){
				return
			}
			if( /serving/.test(data.toString()) ){
				started = true;
				resolve();
			}
		});
	})

	return serving.then(function(){
		console.log('running fn()');
		return fn({appID: appID});
	}).then(function(){
		console.log('killing');
		proc.kill();
		fs.unlinkSync(testDB);
	});

}

