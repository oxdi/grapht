import Query from './query';
import defaults from './defaults';

const QUERY = "query";
const EXEC = "exec";
const LOGIN = "login";
const ERROR = "error";
const COMMIT = "commit";
const DATA = "data";
const SUBSCRIBE = "subscribe";
const TOKEN = "token";

function log(...args){
	if( typeof console == 'object' && console.log ){
		console.log(...args);
	}
}

export default class Connection {

	constructor(cfg){
		this.cfg = cfg;
		this.promises = {};
		this.subscriptions = {};
		this.n = 0;
		if( !this.cfg.host ){
			this.cfg.host = defaults.host;
		}
	}

	connect(credentials){
		return this.authenticate(credentials).then(() => this)
	}

	socket(){
		if( this._socket ){
			return this._socket;
		}
		this._socket = new Promise((resolve, reject) => {
			let ws = new WebSocket(`ws://${this.cfg.host}/api/connect`);
			ws.onmessage = this.handleMessage;
			ws.onopen = () => {
				resolve(ws);
			}
			ws.onerror = (err) => {
				reject(err);
			}
			ws.onclose = () => {
				this.socket = () => Promise.reject(new Error('socket closed'));
				if( this.onClose ){
					this.onClose();
				}
			}
		})
		return this._socket;
	}

	close(){
		return this.socket().then((ws) => {
			ws.close();
		})
	}

	nextTag(){
		this.n++;
		return (this.n).toString();
	}

	send(msg){
		return this.socket().then((ws) => {
			return this._send(ws, msg)
		})
	}

	_send(ws, msg){
		return new Promise((resolve, reject) => {
			msg.tag = this.nextTag();
			this.promises[msg.tag] = resolve;
			ws.send(JSON.stringify(msg), (err) => {
				if( err ){
					reject(err)
				}
			});
		});
	}

	authenticate(credentials){
		return this.send(this.authMessage(credentials)).then((msg) => {
			this.cfg.token = msg.token;
			return msg.token;
		})
	}

	authMessage(credentials){
		if( credentials.token ){
			return {
				type: TOKEN,
				token: credentials.token
			}
		}
		return {
			type: LOGIN,
			username: credentials.username,
			password: credentials.password,
			appID: credentials.appID
		}
	}

	handleMessage = (evt) => {
		var msg = JSON.parse(evt.data);
		if( this.promises[msg.tag] ){
			this.handlePromiseMessage(msg)
		} else if( this.subscriptions[msg.subscription] ){
			this.handleSubscriptionMessage(msg);
		} else {
			throw new Error('unhandled msg', evt.data);
		}
	}

	handlePromiseMessage(msg){
		var handler = this.promises[msg.tag];
		if( msg.type == ERROR ){
			handler(Promise.reject(new Error(msg.error)));
		} else {
			handler(msg);
		}
		delete this.promises[msg.tag];
	}

	handleSubscriptionMessage(msg){
		var query = this.subscriptions[msg.subscription];
		if( msg.type == ERROR ){
			query._onError(msg.error);
		} else if( msg.type == DATA ){
			query._onData(msg);
		} else {
			throw new Error('query subscription cannot handle msg type:'+msg.type);
		}
	}

	normalizeQuery(query){
		if( !(/^\s*query\s/.test(query)) ){
			query = `query { ${query} }`;
		}
		return query;
	}

	query(query,params){
		return this.do(QUERY, this.normalizeQuery(query), params);
	}

	subscribe(name, query, params){
		var q = new Query(name, query, params);
		return this._subscribe(q);
	}

	_subscribe(query){
		if( !query.id ){
			return Promise.reject(new Error('subscribe: name is required'));
		}
		if( !query.query ){
			return Promise.reject(new Error('subscribe: query is required'));
		}
		return this.send({
			type:"subscribe",
			subscription: query.id,
			query: this.normalizeQuery(query.query),
			params: query.params || {},
		}).then((msg) => {
			this.subscriptions[query.id] = query;
			return query;
		});
	}

	unsubscribe(id){
		return this.send({
			type:"unsubscribe",
			subscription: id,
		}).then((msg) => {
			delete this.subscriptions[id]
			return msg;
		});
	}

	buildQuery(kind, name, query, paramTypes, params){
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

	mutation(args){
		var q = this.buildQuery("mutation", "M", args.query, args.input, args.params);
		return this.do(EXEC, q, args.params);
	}

	do(kind, query,args){
		return this.send({
			type:kind,
			query:query,
			params:args || {},
		}).then((msg) => {
			if( !msg.data ){
				return Promise.reject(new Error('no result data'));
			}
			if( msg.data.errors && msg.data.errors.length > 0 ){
				return Promise.reject(new Error(msg.data.errors.map(err => err.message).join(' AND ')));
			}
			return msg.data.data;
		});
	}

	toPlaceholders(args){
		var placeholders = [];
		for( var k in args ){
			placeholders.push(`${k}: $${k}`);
		}
		return placeholders.join(', ');
	}

	setType(args, returning){
		if( !returning ){
			returning = `name`;
		}
		return this.mutation({
			input: {
				name: 'String!',
				fields: '[FieldArg]'
			},
			query: `
				type:defineType(${this.toPlaceholders(args)}) {
					${returning}
				}
			`,
			params: args
		})
		.then((data) => {
			return data.type;
		});
	}

	// example setNode({id:"0001", type:"Page", values:{name:"my page"}})
	setNode(args, returning){
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
		return this.mutation({
			input: {
				id: 'String!',
				type: 'String!',
				attrs: '[AttrArg]'
			},
			query: `
				node:set(${this.toPlaceholders(node)}) {
					${returning || 'id'}
				}
			`,
			params: node
		})
		.then((data) => {
			return data.node;
		});
	}

	removeNodes(args, returning){
		if( !returning ){
			returning = `id`;
		}
		return this.mutation({
			input: {
				id: 'String!',
			},
			query: `
				node:remove(${this.toPlaceholders(args)}) {
					${returning}
				}
			`,
			params: args
		})
		.then((data) => {
			return data.node;
		});
	}

	setEdge(args, returning){
		if( !returning ){
			returning = `
				from {id}
				to {id}
				name
			`;
		}
		return this.mutation({
			input: {
				to: 'String!',
				from: 'String!',
				name: 'String!',
			},
			query: `
				edge:connect(${this.toPlaceholders(args)}) {
					${returning}
				}
			`,
			params: args
		})
		.then((data) => {
			return data.edge;
		});
	}

	removeEdges(args, returning){
		if( !returning ){
			returning = `
				from {id}
				to {id}
				name
			`;
		}
		return this.mutation({
			input: {
				to: 'String!',
				from: 'String!',
				name: 'String!',
			},
			query: `
				edges:disconnect(${this.toPlaceholders(args)}) {
					${returning}
				}
			`,
			params: args
		})
		.then((data) => {
			return data.edges;
		});
	}

	commit(){
		return this.send({
			type: COMMIT,
		}).then((msg) => {
			if( msg.type != 'ok' ){
				return Promise.reject(new Error('expected ok got:'+JSON.stringify(msg)));
			}
		})
	}
}

