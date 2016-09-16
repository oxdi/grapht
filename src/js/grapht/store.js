import Connection from './connection';

export default class Store {

	constructor({host,credentials}){
		this.host = host;
		this.credentials = credentials;
		this.connected = false;
		this.authenticated = false;
		this.subscriptions = {};
	}

	onLostConnection = () => {
		this.conn = null;
		if( this.onConnectionStateChange ){
			this.onConnectionStateChange(false);
		}
		setTimeout(() => {
			this.connect().catch((err) => {
				console.error('failed to reconnect',err);
			})
		}, 2000);
	}

	connect(credentials){
		if( credentials ){
			this.credentials = credentials;
		}
		if( !this.conn ){
			if( !this.credentials ){
				return Promise.reject(new Error('no credentials'));
			}
			let conn = new Connection({
				host: this.host
			});
			conn.onClose = this.onLostConnection;
			this.conn = conn.connect(this.credentials)
				.then((conn) => {
					for(let id in this.subscriptions){
						conn._subscribe(this.subscriptions[id]);
					}
					if( this.onConnectionStateChange ){
						this.onConnectionStateChange(true);
					}
					return conn;
				})
				.catch((err) => {
					this.conn = null;
					return Promise.reject(err);
				})
		}
		return Promise.resolve(this.conn);
	}

	subscribe(...args){
		let conn;
		return this.connect()
			.then((c) => {
				conn = c;
				return conn.subscribe(...args);
			})
			.then((query) => {
				this.subscriptions = conn.subscriptions;
				return query;
			})
	}

	setType(...args){
		return this.connect()
			.then((conn) => conn.setType(...args))
			.then((res) => this.commit().then(() => res))
	}

	commit(){
		return this.connect().then((conn) => conn.commit())
	}

	navigate(path,params){
		if( !this.router ){
			return;
		}
		this.router.push(path);
	}

	close(){
		return this.connect()
			.then((c) => c.close())
	}
}
