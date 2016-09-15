import Connection from './connection';

export default class Store {

	constructor({host,credentials}){
		this.host = host;
		this.credentials = credentials;
		this.connected = false;
		this.authenticated = false;
	}

	onLostConnection = () => {
		console.log('connection lost');
		this.conn = null;
		setTimeout(() => {
			console.log('reconnecting');
			this.connect();
		}, 2000);
	}

	connect(){
		if( !this.conn ){
			if( !this.credentials ){
				return Promise.reject(new Error('no credentials'));
			}
			let conn = new Connection({
				host: this.host
			});
			conn.onClose = this.onLostConnection;
			this.conn = conn.connect(this.credentials)
				.catch((err) => {
					this.conn = null;
					return Promise.reject(err);
				})
		}
		return Promise.resolve(this.conn);
	}

	subscribe(){
		return this.connect().then((conn) => {
			return conn.subscribe();
		})
	}

	navigate(path,params){
		if( !this.router ){
			return;
		}
		this.router.push(path);
	}
}
