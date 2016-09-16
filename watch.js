var readline = require('readline');
var spawnSync = require('child_process').spawnSync;
var spawn = require('child_process').spawn;

function make(){
	var res = spawnSync('make', ['assets/index.html.gz'], {
		stdio: 'inherit',
		shell: true,
	});
	return res.status == 0;
}

var server;
function startServer(){
	server = spawn('./bin/grapht', {
		stdio: 'inherit',
		shell: true,
	});
}

function restartServer(){
	if( !server ){
		return startServer();
	}
	server.on('close', function(){
		startServer();
	});
	server.kill();
}

process.on('exit', (code) => {
	if( server ){
		server.kill();
	}
});

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false
});

rl.on('line', function(line){
	console.log('WATCHER', line);
	if( /bytes written/.test(line) ){
		console.log('Rebuilding...')
		if( !make() ){
			console.log('make failed');
			return
		}
		if( !server ){
			startServer();
		} else {
			// restartServer()
		}
	}
})
