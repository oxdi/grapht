import Connection from './connection';
import Store from './store';
import defaults from './defaults';
import 'whatwg-fetch';

function register({host,username,email,password,appID}){
	if( !host ){
		host = defaults.host;
	}
	return fetch(`//${host}/api/create`, {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			username,
			email,
			password,
			appID,
		})
	}).then(function(res){
		if( res.status != 201 ){
			return res.text().then(function(err){
				return Promise.reject(new Error(err));
			})
		}
		return res.json();
	}).then(function(msg){
		if( !msg.token ){
			return Promise.reject(new Error('failed to authenticate after create'));
		}
		return {token: msg.token};
	});
}

function connect(cfg){
	let store = new Store(cfg);
	return store.connect();
}

let Grapht = {
	register,
	connect
}

export {
	Grapht as default,
	Store,
	Connection,
	register,
	connect,
}

