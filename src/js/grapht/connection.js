const Query = require('./query');
const QUERY = "query";
const EXEC = "exec";
const LOGIN = "login";
const ERROR = "error";
const COMMIT = "commit";
const DATA = "data";
const SUBSCRIBE = "subscribe";
const TOKEN = "token";

function Connection(cfg){
	this.cfg = cfg;
	this.promises = {};
	this.subscriptions = {};
	this.n = 0;
	if( !this.cfg.WebSocket ){
		this.cfg.WebSocket = WebSocket;
	}
	if( !this.cfg.host ){
		this.cfg.host = 'toolbox.oxdi.eu:8282';
	}
}

Connection.prototype.connect = function(){
	var conn = this;
	if( conn.ws ){
		return Promise.resolve(conn);
	}
	if( conn.connecting ){
		return conn.connecting;
	}
	conn.connecting = new Promise(function(resolve){
		var reconnect = function(){
			try{
				conn.log('attempting connection...');
				var ws = new conn.cfg.WebSocket(`ws://${conn.cfg.host}/api/connect`, conn.cfg.socketCfg);
				ws.onopen = function() {
					conn.log('connection opened');
					conn.ws = ws;
					conn.connecting = null;
					ws.onclose = function() {
						conn.ws = null;
						conn.log('connection closed');
						conn.onOffline();
						setTimeout(function(){
							conn.connecting = conn.connect();
						}, 2000);
					};
					ws.onmessage = conn.onMessage.bind(conn);
					// send auth msg, activate any existing subscriptions and return socket
					resolve(conn.authenticate().then(function(){
						conn.connecting = null;
						for( var id in conn.subscriptions ){
							conn.subscriptions[id].subscribe();
						}
						conn.onOnline();
					}).then(() => conn));

				};
				ws.onerror = function(e) {
					conn.log('connection error', e);
					setTimeout(reconnect,2000);
				};
			}catch(e){
				conn.log('fatal connection error', e);
				setTimeout(function(){
					conn.connecting = conn.connect();
				}, 2000);
			}
		}
		reconnect();
	})
	return conn.connecting;
}

Connection.prototype.onOnline = function(){
	var conn = this;
	conn.log('online');
}

Connection.prototype.onOffline = function(){
	var conn = this;
	conn.log('offline');
}

Connection.prototype.close = function(){
	var conn = this;
	var ws = this.ws;
	if( ws ){
		return new Promise(function(resolve){
			ws.onclose = function(){
				conn.ws = null;
				resolve('closed');
			}
			ws.onerror = function(err){
				conn.ws = null;
				resolve(Promise.reject(err));
			}
			ws.close();
			ws.onclose();
		})
	}
	return Promise.resolve('closed');
}

Connection.prototype.log = function(...args){
	if( this.debug && typeof console == 'object' && console.log ){
		console.log(...args);
	}
}

Connection.prototype.authenticate = function(){
	var conn = this;
	if( conn.cfg.token ){
		conn.log('authenticating using token...');
		return conn._send({
			type: TOKEN,
			token: conn.cfg.token
		}).then(function(msg){
			conn.cfg.token = msg.token;
			conn.log('authenticated', conn.cfg.token);
			return conn.cfg.token;
		});
	}
	conn.log('authenticating using user/pass...');
	return conn._send({
		type: LOGIN,
		username: conn.cfg.username,
		password: conn.cfg.password,
		appID: conn.cfg.appID
	}).then(function(msg){
		conn.cfg.token = msg.token;
		conn.cfg.username = null;
		conn.cfg.password = null;
		conn.log('authenticated', conn.cfg.token);
		return conn.cfg.token;
	});
}

Connection.prototype.onMessage = function(evt){
	var json = evt.data;
	var msg = JSON.parse(json);
	if( this.promises[msg.tag] ){
		this.log('onMessage -> promise', json);
		var handler = this.promises[msg.tag];
		if( msg.type == ERROR ){
			handler(Promise.reject(new Error(msg.error)));
		} else {
			handler(msg);
		}
		delete this.promises[msg.tag];
	} else if( this.subscriptions[msg.subscription] ){
		this.log('onMessage -> subscription', json);
		var query = this.subscriptions[msg.subscription];
		if( msg.type == ERROR ){
			query.onError(msg.error);
		} else if( msg.type == DATA ){
			query._onData(msg);
		} else {
			throw new Error('query subscription cannot handle msg type:'+msg.type);
		}
	} else {
		this.log('onMessage -> Unhandled msg tag', json);
	}
}

Connection.prototype.send = function(msg){
	var conn = this;
	return this.connect().then(function(){
		return conn._send(msg)
	})
}

Connection.prototype._send = function(msg){
	var conn = this;
	if( !conn.ws ){
		return Promise.reject(new Error('not connected'));
	}
	return new Promise(function(resolve, reject){
		try {
			conn.n++;
			msg.tag = msg.tag || (conn.n).toString();
			conn.promises[msg.tag] = resolve;
			var data = JSON.stringify(msg);
			conn.log('sending', data);
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
		subscription: id.toString(),
		query: query,
		params: args,
		conn: this,
	});
	this.subscriptions[id.toString()] = query;
	if( this.ws ){
		query.subscribe();
	}
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
	conn.log('performing do('+kind+','+query+','+JSON.stringify(args||{}));
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

// example setNode({id:"0001", type:"Page", values:{name:"my page"}})
Connection.prototype.setNode = function(args, returning){
	var conn = this;
	var node = {
		id: args.id,
		type: args.type,
		attrs: [],
	};
	if( !node.id ){
		return Promise.reject(new Error('setNode requires id'));
	}
	if( !node.type ){
		return Promise.reject(new Error('setNode requires type'));
	}
	// serialize values to attrs
	if( args.values ){
		for( var k in args.values ){
			var v = args.values[k];
			if( v.toString ){
				v = v.toString();
			}
			node.attrs.push({
				name: k,
				value: v,
			});
		}
	}
	return conn.mutation({
		input: {
			id: 'String!',
			type: 'String!',
			attrs: '[AttrArg]'
		},
		query: `
			node:set(${conn.toPlaceholders(node)}) {
				${returning || 'id'}
			}
		`,
		params: node
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
