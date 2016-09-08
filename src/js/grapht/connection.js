const WebSocket = require('ws');
const Query = require('./query');
const QUERY = "query";
const EXEC = "exec";
const LOGIN = "login";
const ERROR = "error";
const COMMIT = "commit";
const DATA = "data";
const SUBSCRIBE = "subscribe";

function Connection(cfg){
	this.cfg = cfg;
	this.promises = {};
	this.subscriptions = {};
	this.n = 0;
}

Connection.prototype._connect = function(query,args){
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
	if( this.promises[msg.tag] ){
		console.log('onMessage -> promise', json);
		var handler = this.promises[msg.tag];
		if( msg.type == ERROR ){
			handler(Promise.reject(new Error(msg.error)));
		} else {
			handler(msg);
		}
		delete this.promises[msg.tag];
	} else if( this.subscriptions[msg.tag] ){
		console.log('onMessage -> subscription', json);
		var query = this.subscriptions[msg.tag];
		if( msg.type == ERROR ){
			query.onError(msg.error);
		} else if( msg.type == DATA ){
			query._onData(msg);
		} else {
			throw new Error('query subscription cannot handle msg type:'+msg.type);
		}
	} else {
		console.log('onMessage -> Unhandled msg tag', json);
	}
}

Connection.prototype.send = function(msg){
	var conn = this;
	return this._connect().then(function(){
		return conn._send(msg);
	})
}

Connection.prototype._send = function(msg){
	var conn = this;
	return new Promise(function(resolve, reject){
		try {
			conn.n++;
			msg.tag = msg.tag || (conn.n).toString();
			conn.promises[msg.tag] = resolve;
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

Connection.prototype.query = function(query,params){
	if( !(/^\s*query\s/.test(query)) ){
		query = `query { ${query} }`;
	}
	return this.do(QUERY, query, params);
}

Connection.prototype.subscribe = function(query,args){
	var id = ++this.n;
	var query = new Query({
		tag: id.toString(),
		query: query,
		params: args,
		conn: this,
	});
	this.subscriptions[id.toString()] = query;
	return query;
}

Connection.prototype.buildQuery = function(kind, name, query, paramTypes, params){
	var definition = name;
	if( params ){
		var types = [];
		for( var k in params ){
			var paramType = paramTypes[k];
			if( !paramType ){
				if( typeof params[k] == 'string' ){
					paramType = 'String!';
				} else {
					throw new Error('invalid param: no paramType given');
				}
			}
			types.push(`$${k}: ${paramType}`);
		}
		definition = `${name}(${types.join(',')})`;
	}
	return `${kind} ${definition} { ${query} }`;
}

Connection.prototype.mutation = function(args){
	var q = this.buildQuery("mutation", "M", args.query, args.input, args.params);
	return this.do(EXEC, q, args.params);
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

Connection.prototype.setType = function(args, returning){
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

Connection.prototype.setNode = function(args, returning){
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

Connection.prototype.removeNodes = function(args, returning){
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

Connection.prototype.setEdge = function(args, returning){
	var conn = this;
	if( !returning ){
		returning = `
			from {id}
			to {id}
			name
		`;
	}
	return conn.mutation({
		input: {
			to: 'String!',
			from: 'String!',
			name: 'String!',
		},
		query: `
			edge:connect(${conn.toPlaceholders(args)}) {
				${returning}
			}
		`,
		params: args
	})
	.then(function(data){
		return data.edge;
	});
}

Connection.prototype.removeEdges = function(args, returning){
	var conn = this;
	if( !returning ){
		returning = `
			from {id}
			to {id}
			name
		`;
	}
	return conn.mutation({
		input: {
			to: 'String!',
			from: 'String!',
			name: 'String!',
		},
		query: `
			edges:disconnect(${conn.toPlaceholders(args)}) {
				${returning}
			}
		`,
		params: args
	})
	.then(function(data){
		return data.edges;
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
