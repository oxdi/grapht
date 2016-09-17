var readline = require('readline');
var spawnSync = require('child_process').spawnSync;
var spawn = require('child_process').spawn;

function log(s,color){
	var _log = function(s){
		console.log(s);
	}
	var hr = '';
	for(var i=0; i<s.length; i++){
		hr += '-';
	}
	_log('\n');
	_log('+-'+hr+'-+');
	_log('| '+s+' |');
	_log('+-'+hr+'-+');
	_log('\n');
}

function commiserate(s){
	log(s);
}

function celebrate(s){
	log(s);
}

function make(target){
	var args = [];
	if( target ){
		args.push(target);
	}
	var res = spawnSync('make', args, {
		stdio: 'inherit',
		shell: true,
	});
	var ok = res.status == 0;
	if( ok ){
		celebrate('built '+target);
	} else {
		commiserate('failed to make '+target);
	}
	return ok;
}

var server;
function startServer(){
	server = spawn('./bin/grapht-debug', {
		stdio: 'inherit',
		shell: true,
	});
	celebrate('started server');
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
	console.log(line);
	if( /bytes written/.test(line) ){
		if( !server ){
			if( !make('bin/grapht-debug') ){
				return
			}
			startServer();
		} else {
			if( !make('assets/index.html.gz') ){
				return
			}
		}
	}
})
