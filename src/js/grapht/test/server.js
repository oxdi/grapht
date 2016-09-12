var spawn = require('child_process').spawn;
var fs = require('fs');
var cwd = '../../../';
var dataDir = cwd+'data/';

var run = require('tape-run');
var browserify = require('browserify');

var appID = 'jstest';
var testDB = dataDir+appID;
fs.writeFileSync(testDB, '');

function bundleAndRun(){
	return new Promise(function(resolve, reject){
		browserify(__dirname + '/connection_test.js')
			.bundle()
			.pipe(run({}))
			.on('results', console.log)
			.pipe(process.stdout)
			.on('error', function(err){
				reject(err);
			})
			.on('end', function(){
				resolve(true);
			})
	});
	var proc = spawn(['./node_modules/.bin/browserify', 'test/connection_test.js', ],{
		cwd: cwd
	});
	var started = false;

	proc.on('close', function(){
		console.log("browserify exited")
	});
	return new Promise(function(resolve, reject){
		proc.stdout.on('data', function(data){
			console.log("\nSERVER SAID:", data.toString(), "\n")
			if( started ){
				return
			}
			if( /serving/.test(data.toString()) ){
				started = true;
				resolve(proc);
			}
		});
	})
}

function startServer(){
	var proc = spawn('./bin/grapht',{
		cwd: cwd
	});
	var started = false;

	proc.on('close', function(){
		console.log("SERVER EXITED!")
	});
	return new Promise(function(resolve, reject){
		proc.stdout.on('data', function(data){
			console.log("\nSERVER SAID:", data.toString(), "\n")
			if( started ){
				return
			}
			if( /serving/.test(data.toString()) ){
				started = true;
				resolve(proc);
			}
		});
	})
}

startServer().then(function(proc){
	console.log('running fn()');
	return bundleAndRun().then(function(){
		return proc;
	})
}).then(function(){
	console.log('stopping server');
	proc.kill();
	fs.unlinkSync(testDB);
});


