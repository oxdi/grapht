
import Connection from './Connection';
import 'whatwg-fetch';

const REQUEST_HEADERS = {
	'Accept': 'application/json',
	'Content-Type': 'application/json'
};

export default class Client {

	constructor(cfg){
		this.host = cfg.host || 'toolbox.oxdi.eu:8282';
	}

	register(o){ // returns Promise<UserToken>
		return this._post(`/register`, o)
			.then(() => this.authenticate({
				id: o.id,
				password: o.password,
			}));
	}

	authenticate(o){ // returns Promise<UserToken>
		return this._post(`/authenticate`, o)
	}

	createApp(o){
		return this._post(`/apps`, o)
	}

	getUser({userToken}){
		return this._get(`/user`, {userToken})
	}

	connect({userID,password,appID,sessionToken,userToken}){
		if( sessionToken ){
			return this.connectSession({sessionToken});
		}
		return (userToken ?
			Promise.resolve(userToken) :
			this.authenticate({id: userID, password: password})
		).then(({userToken}) =>  {
			return this.createSession({
				appID,
				userToken,
			})
		}).then(({sessionToken}) => {
			return this.connectSession({sessionToken});
		});
	}

	connectSession({sessionToken}){ // returns Promise<Connection>
		if( !sessionToken ){
			return Promise.reject(new Error('sessionToken is required'));
		}
		if( typeof sessionToken != 'string' ){
			return Promise.reject(new Error('sessionToken is required to be a string'));
		}
		let url = this._abs(`/connect?sessionToken=${sessionToken}`);
		return new Promise((resolve, reject) => {
			let ws;
			try{
				ws = new WebSocket(`ws:${url}`);
			}catch(e){
				reject(e);
				return;
			}
			ws.onmessage = (evt) => {
				let msg = JSON.parse(evt.data);
				if( msg.type == 'fatal' ){
					reject(new Error(msg.error))
				} else if( msg.type == 'ok' ){
					let conn = new Connection(ws);
					resolve(conn);
				}
			}
			ws.onerror = () => {
				reject(new Error('connection failed'));
			}
		})
	}

	createSession(o){ // returns Promise<Session>
		return this._post(`/sessions`, o)
	}

	_abs(path){
		return `//${this.host}${path}`;
	}

	_responseTextError(res){
		return res.text().then((err) => {
			return Promise.reject(new Error(err));
		});
	}

	_fetch(method, path, data){
		let opts = {
			method: method,
			headers: REQUEST_HEADERS,
			body: JSON.stringify(data),
		};
		if( data ){
			if( data.userToken ){
				let userToken = data.userToken;
				delete data.userToken;
				opts.headers = Object.assign(opts.headers,{
					Authorization: `Bearer ${userToken}`
				});
			}
			if( method != 'GET' ){
				opts.body = JSON.stringify(data);
			}
		}
		return fetch(this._abs(path), opts).then((res) => {
			if( res.status >= 200 && res.status < 300 ){
				return res.json();
			} else {
				return this._responseTextError(res)
			}
		});
	}

	_post(path, data){
		return this._fetch('POST', path, data);
	}

	_get(path, data){
		return this._fetch('GET', path);
	}
}



