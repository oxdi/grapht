var spawn = require('child_process').spawn;

module.exports.run = function(fn){
	var proc = spawn('./bin/grapht',{
		cwd: '../../../'
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
		return fn();
	}).then(function(){
		console.log('killing');
		proc.kill();
	});

}

