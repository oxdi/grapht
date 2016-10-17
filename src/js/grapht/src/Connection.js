import Query from './Query';
import jwtDecode from 'jwt-decode';

const QUERY = "query";
const EXEC = "exec";
const LOGIN = "login";
const ERROR = "error";
const COMMIT = "commit";
const DATA = "data";
const SUBSCRIBE = "subscribe";
const TOKEN = "token";

// value encoding types
const STRING_ENCODING = "string";

function log(...args){
	if( typeof console == 'object' && console.log ){
		console.log(...args);
	}
}

const OFFLINE = new Error('Offline');

export default class Connection {

	constructor(ws, sessionToken){
		this.sessionToken = sessionToken;
		this.claims = jwtDecode(sessionToken);
		this.socket = () => Promise.resolve(ws);
		ws.onmessage = this.handleMessage;
		ws.onclose = () => {
			this.socket = () => Promise.reject(OFFLINE);
			this.onClose();
		}
		this.promises = {};
		this.subscriptions = {};
		this.n = 0;
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

	handleMessage = (evt) => {
		var msg = JSON.parse(evt.data);
		if( this.promises[msg.tag] ){
			this.handlePromiseMessage(msg)
		} else if( this.subscriptions[msg.subscription] ){
			this.handleSubscriptionMessage(msg);
		} else {
			throw new Error('unhandled msg: '+evt.data);
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
					} else if( typeof params[k] == 'boolean' ){
						paramType = 'Boolean!';
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

	markDirty(){
		this.dirty = true;
		this.onDirty();
	}

	markClean(){
		this.dirty = false;
		this.onClean();
	}

	onDirty(){
		// set by user
	}

	onClean(){
		// set by user
	}

	onClose(){
		// set by user
	}

	setType(args, returning){
		if( !returning ){
			returning = `id`;
		}
		return this.mutation({
			input: {
				name: 'String!',
				fields: '[FieldArg]'
			},
			query: `
				type:setType(${this.toPlaceholders(args)}) {
					${returning}
				}
			`,
			params: args
		})
		.then((data) => {
			this.markDirty();
			return data.type;
		});
	}

	// example setNode({id:"0001", type:"Page", values:{name:"my page"}})
	setNode(args, returning){
		var node = args;
		return this.mutation({
			input: {
				id: 'String!',
				type: 'String!',
				attrs: '[AttrArg]'
			},
			query: `
				node:setNode(${this.toPlaceholders(node)}) {
					${returning || 'id'}
				}
			`,
			params: node
		})
		.then((data) => {
			this.markDirty();
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
				node:removeNodes(${this.toPlaceholders(args)}) {
					${returning}
				}
			`,
			params: args
		})
		.then((data) => {
			this.markDirty();
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
				edge:setEdge(${this.toPlaceholders(args)}) {
					${returning}
				}
			`,
			params: args
		})
		.then((data) => {
			this.markDirty();
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
				edges:removeEdges(${this.toPlaceholders(args)}) {
					${returning}
				}
			`,
			params: args
		})
		.then((data) => {
			this.markDirty();
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
			this.markClean();
		})
	}
}

