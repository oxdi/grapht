import Connection from './connection.js';
import 'whatwg-fetch';

var Grapht = {
	connect: function(cfg){
		var c = new Connection(cfg);
		return c.connect();
	},
	register: function({host,username,email,password,appID}){
		return fetch(`http://${host}/api/create`, {
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
		}).then(function(t){
			if( !t || !t.token ){
				return Promise.reject(new Error('failed to connect to new database'));
			}
			return Grapht.connect({
				host: host,
				token: t.token,
			});
		})
	}
};
module.exports = Grapht;

