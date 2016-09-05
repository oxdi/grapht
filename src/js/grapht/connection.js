const WebSocket = require('ws');
const QUERY = "query";
const EXEC = "exec";
const LOGIN = "login";
const ERROR = "error";

function Connection(cfg){
	this.cfg = cfg;
	this.tags = {};
	this.n = 0;
}

Connection.prototype.connect = function(query,args){
	var conn = this;
	if( !conn.connected ){
		conn.connected = new Promise(function(resolve, reject){
			console.log('connecting...');
			try{
				conn.ws =  new WebSocket('ws://localhost:8282/api/connect',{
						origin: 'http://localhost:8282'
				});
				conn.ws.on('open', function() {
					console.log('connection opened');
					resolve(conn.ws);
				});
				conn.ws.on('error', function(e) {
					console.log('connection error', e);
					reject(e);
				});
				conn.ws.on('close', function() {
					console.log('connection closed');
					reject();
				});
				conn.ws.on('message', conn.onMessage.bind(conn));
			}catch(e){
				console.log('wtf', e);
				reject(e)
			}
		})
	}
	return conn.connected;
}

Connection.prototype.close = function(query,args){
	if( this.ws ){
		this.ws.close();
	}
}

Connection.prototype.authenticate = function(){
	var conn = this;
	console.log('authenticating');
	if( conn.token ){
		return Promise.resolve(conn.token);
	}
	return conn.send({
		type: LOGIN,
		username: "",
		password: "",
		appID: "jstest"
	}).then(function(msg){
		conn.token = msg.token;
		console.log('authenticated', conn.token);
		return conn.token;
	});
}

Connection.prototype.onMessage = function(json){
	var msg = JSON.parse(json);
	console.log('onMessage', msg);
	var handler = this.tags[msg.tag];
	if( handler ){
		if( msg.type == ERROR ){
			handler(Promise.reject(new Error(msg.error)));
		} else {
			handler(msg);
		}
		delete this.tags[msg.tag];
	} else {
		console.log('invalid msg tag', msg, msg['tag'], this.tags);
	}
}

Connection.prototype.send = function(msg){
	var conn = this;
	return this.connect().then(function(){
		return conn._send(msg);
	})
}

Connection.prototype._send = function(msg){
	var conn = this;
	return new Promise(function(resolve, reject){
		try {
			var tag = ++conn.n;
			msg.tag = tag.toString();
			conn.tags[msg.tag] = resolve;
			var data = JSON.stringify(msg);
			console.log('sending', data);
			conn.ws.send(data, function ack(err){
				if( err ){
					reject(err)
				}
			});
		}catch(e){
			reject(e);
		}
	});
}

Connection.prototype.query = function(query,args){
	var conn = this;
	return conn.authenticate().then(function(){
		console.log('querying...');
		return conn.send({
			type:QUERY,
			query:query,
			params:args || {},
		});
	});
}

Connection.prototype.exec = function(query,args){
	var conn = this;
	return conn.authenticate().then(function(){
		console.log('execing...');
		return conn.send({
			type:EXEC,
			query:query,
			params:args || {},
		}).then(function(msg){
			return msg.data.data;
		});
	});
}

module.exports = Connection;
