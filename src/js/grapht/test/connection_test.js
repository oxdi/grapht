var t = require('tap')
var Grapht = require('../index.js');
var server = require('./server.js');


t.test('create a blog engine', function(t){
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

		test("create an Author type", function(t){
			return conn.defineType({
				name:"Author",
				fields:[
					{name:"name",type:"Text"}
				]
			}, `
				name
				fields {
					name
					type
				}
			`)
			.then(function(res){
				return t.same(res, {
					name: "Author",
					fields: [
						{name: "name", type:"Text"}
					]
				})
			})
		});

		test("create a Post type", function(t){
			return conn.defineType({
				name:"Post",
				fields:[
					{name:"title",type:"Text"},
					{name:"body",type:"Text"},
					{name:"author", type:"HasOne",edge:"author"}
				]
			},`
				name
				fields {
					name
					type
					edge
				}
			`)
			.then(function(res){
				return t.same(res, {
					name: "Post",
					fields: [
						{name: "title", type:"Text", edge:null},
						{name: "body", type:"Text", edge:null},
						{name: "author", type:"HasOne", edge:"author"}
					]
				})
			})
		});

		test("create a Tag type", function(t){
			return conn.defineType({
				name:"Tag",
				fields:[
					{name:"name",type:"Text"},
					{name:"posts", type:"HasMany",edge:"tagged"}
				]
			})
			.then(function(res){
				return t.same(res, {
					name: "Tag",
				})
			})
		});

		test("create an Author node called alice", function(t){
			return conn.set({
				id:"alice",
				type:"Author",
				attrs: [
					{name:"username",value:"alice1"}
				]
			},`
				id
				type {
					name
				}
			`)
			.then(function(res){
				return t.same(res, {
					id: "alice",
					type: {
						name: "Author"
					}
				})
			})
		});

		test("create an Author node called bob", function(t){
			return conn.set({
				id:"bob",
				type:"Author",
				attrs: [
					{name:"name",value:"bob1"}
				]
			})
			.then(function(res){
				return t.same(res, {
					id: "bob",
				})
			})
		});

		test("create an Post about cheese", function(t){
			return conn.set({
				id:"cheese-post",
				type:"Post",
				attrs: [
					{name:"title",value:"about cheese"},
					{name:"body",value:"cheese comes from the moon"},
				]
			},`
				id
				type {
					name
				}
			`)
			.then(function(res){
				return t.same(res, {
					id: "cheese-post",
					type: {
						name: "Post"
					}
				})
			})
		});

		test("create an Cheese tag", function(t){
			return conn.set({
				id:"cheese-tag",
				type:"Tag",
				attrs: [
					{name:"name",value:"CHEESE"},
				]
			},`
				id
				attrs {
					name
					value
				}
			`)
			.then(function(res){
				return t.same(res, {
					id: "cheese-tag",
					attrs: [
						{name:"name", value:"CHEESE"}
					]
				})
			})
		});


		test("list all nodes", function(t){
			return conn.query(`
				nodes {
					id
				}
			`)
			.then(function(data){
				return t.same(data, {
					nodes: [
						{id: "alice"},
						{id: "bob"},
						{id: "cheese-post"},
						{id: "cheese-tag"},
					]
				})
			})
		});

		test("filter nodes by single type", function(t){
			return conn.query(`
				nodes(type:Author) {
					id
				}
			`)
			.then(function(data){
				return t.same(data, {
					nodes: [
						{id: "alice"},
						{id: "bob"},
					]
				})
			})
		});

		test("remove Author Alice", function(t){
			return conn.remove({
				id:"alice",
			})
			.then(function(res){
				return t.same(res, {id: "alice"})
			})
		})

		test("check alice was deleted", function(t){
			return conn.query(`
				node(id:"alice") {
					id
				}
			`)
			.then(function(data){
				return t.same(data, {node:null})
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
