const WebSocket = require('ws');
const QUERY = "query";
const EXEC = "exec";
const LOGIN = "login";
const ERROR = "error";
const COMMIT = "commit";

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
		appID: conn.cfg.appID
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
	return this.do(QUERY, `query { ${query} }`, args);
}

Connection.prototype.mutation = function(args){
	var name = 'M';
	if( args.params ){
		var types = [];
		for( var k in args.params ){
			var typedef = args.input[k];
			if( !typedef ){
				throw new Error('invalid argument to mutation: no typedef');
			}
			types.push(`$${k}: ${typedef}`);
		}
		name = `M(${types.join(',')})`;
	}
	return this.do(EXEC, `mutation ${name} { ${args.query} }`, args.params);
}

Connection.prototype.do = function(kind, query,args){
	var conn = this;
	return conn.authenticate().then(function(){
		console.log('performing do('+kind+','+query+','+JSON.stringify(args||{}));
		return conn.send({
			type:kind,
			query:query,
			params:args || {},
		}).then(function(msg){
			if( !msg.data ){
				return Promise.reject(new Error('no result data'));
			}
			if( msg.data.errors && msg.data.errors.length > 0 ){
				return Promise.reject(new Error(msg.data.errors.map(function(err){ return err.message}).join(' AND ')));
			}
			return msg.data.data;
		});
	});
}

Connection.prototype.toPlaceholders = function(args){
	var placeholders = [];
	for( var k in args ){
		placeholders.push(`${k}: $${k}`);
	}
	return placeholders.join(', ');
}

Connection.prototype.defineType = function(args, returning){
	var conn = this;
	if( !returning ){
		returning = `name`;
	}
	return conn.mutation({
		input: {
			name: 'String!',
			fields: '[FieldArg]'
		},
		query: `
			type:defineType(${conn.toPlaceholders(args)}) {
				${returning}
			}
		`,
		params: args
	})
	.then(function(data){
		return data.type;
	});
}

Connection.prototype.set = function(args, returning){
	var conn = this;
	if( !returning ){
		returning = `id`;
	}
	return conn.mutation({
		input: {
			id: 'String!',
			type: 'String!',
			attrs: '[AttrArg]'
		},
		query: `
			node:set(${conn.toPlaceholders(args)}) {
				${returning}
			}
		`,
		params: args
	})
	.then(function(data){
		return data.node;
	});
}

Connection.prototype.remove = function(args, returning){
	var conn = this;
	if( !returning ){
		returning = `id`;
	}
	return conn.mutation({
		input: {
			id: 'String!',
		},
		query: `
			node:remove(${conn.toPlaceholders(args)}) {
				${returning}
			}
		`,
		params: args
	})
	.then(function(data){
		return data.node;
	});
}

Connection.prototype.commit = function(){
	var conn = this;
	return conn.send({
		type: COMMIT,
	}).then(function(msg){
		if( msg.type != 'ok' ){
			return Promise.reject(new Error('expected ok got:'+JSON.stringify(msg)));
		}
	})
}

module.exports = Connection;
