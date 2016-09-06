var t = require('tap')
var Grapht = require('../index.js');
var server = require('./server.js');


t.test('connection', function(t){
	return server.run(function(info){
		var conn = Grapht.connect({appID: info.appID});
		var conn2 = Grapht.connect({appID: info.appID});
		var eq = function(t, json){
			return function(result){
				t.same(result, json);
				return;
			}
		}
		var tests = [];
		var test = function(name, fn){
			tests.push(t.test(name, fn));
		}

		test("defineType", function(t){
			return conn.defineType({
				name:"User",
				fields:[
					{name:"username",type:"Text"}
				]
			})
			.then(function(res){
				return t.same(res, {name: "User"})
			})
			.then(function(){
				// conn should return the new type
				return conn.query(`
					types {
						name
						fields {
							name
							type
						}
					}
				`)
				.then(function(data){
					return t.same(data, {
						types: [
							{name:"User", fields:[{name:"username",type:"Text"}]}
						]
					})
				})
			})
			.then(function(){
				// .. but conn2 should be unaffected
				return conn2.query(`
					types {
						name
					}
				`)
				.then(function(data){
					return t.same(data, {
						types: []
					})
				})
			})
			.then(function(){
				return conn.commit()
			})
			.then(function(){
				// conn2 should now reflect the changes
				return conn2.query(`
					types {
						name
						fields {
							name
							type
						}
					}
				`)
				.then(function(data){
					return t.same(data, {
						types: [
							{name:"User", fields:[{name:"username",type:"Text"}]}
						]
					})
				})
			})
		});

		test("set", function(t){
			return conn.set({
				id:"alice",
				type:"User",
				attrs: [
					{name:"username",value:"alice1"}
				]
			})
			.then(function(res){
				return t.same(res, {
					id: "alice",
					type: {
						name: "User"
					}
				})
			})
			.then(function(){
				return conn.query(`
					alice:node(id:"alice") {
						id
						...on User {
							username
						}
					}
				`)
			})
			.then(function(data){
				return t.same(data, {
					alice: {
						id: "alice",
						username: "alice1"
					}
				})
			})
		});


		// test("subscribe query", function(t){
		// 	var query = connection.subscribe(`query{}`);
		// 	query.on('data', function(data){
		// 		console.log('data', data);
		// 	});
		// 	query.on('error', function(err){
		// 		console.log('error', err);
		// 	});
		// 	query.on('unsubscribe', function(){
		// 		console.log('no longer listening');
		// 	});
		// 	query.update(`query{}`);

		// })


		console.log('begin the wait')
		return Promise.all(tests).then(function(){
			console.log('all tests done')
			conn.close();
		}).catch(t.threw);

	})
})
