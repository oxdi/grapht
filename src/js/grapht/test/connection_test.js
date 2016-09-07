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
			return conn.setType({
				name:"Author",
				fields:[
					{name:"name",type:"Text"},
					{name:"posts",type:"HasMany",edge:"author", toType:"Post"}
				]
			}, `
				name
				fields {
					name
					type
					toType
				}
			`)
			.then(function(res){
				return t.same(res, {
					name: "Author",
					fields: [
						{name: "name", type:"Text", toType:null},
						{name: "posts", type:"HasMany", toType:"Post"}
					]
				})
			})
		});

		test("create a Post type", function(t){
			return conn.setType({
				name:"Post",
				fields:[
					{name:"title",type:"Text"},
					{name:"body",type:"Text"},
					{name:"author", type:"HasOne", edge:"author", toType:"Author"},
					{name:"tags", type:"HasMany", edge:"tagged", toType:"Tag"}
				]
			},`
				name
				fields {
					name
					type
					edge
					toType
				}
			`)
			.then(function(res){
				return t.same(res, {
					name: "Post",
					fields: [
						{name: "title", type:"Text", edge:null, toType:null},
						{name: "body", type:"Text", edge:null, toType:null},
						{name: "author", type:"HasOne", edge:"author",toType:"Author"},
						{name: "tags", type:"HasMany", edge:"tagged",toType:"Tag"},

					]
				})
			})
		});

		test("create a Tag type", function(t){
			return conn.setType({
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
			return conn.setNode({
				id:"alice",
				type:"Author",
				attrs: [
					{name:"name",value:"alice alison"}
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
			return conn.setNode({
				id:"bob",
				type:"Author",
				attrs: [
					{name:"name",value:"bobby bobbington"}
				]
			})
			.then(function(res){
				return t.same(res, {
					id: "bob",
				})
			})
		});

		test("create an Post about cheddar", function(t){
			return conn.setNode({
				id:"cheddar-post",
				type:"Post",
				attrs: [
					{name:"title",value:"about cheddar"},
					{name:"body",value:"cheddar comes from the moon"},
				]
			},`
				id
				type {
					name
				}
			`)
			.then(function(res){
				return t.same(res, {
					id: "cheddar-post",
					type: {
						name: "Post"
					}
				})
			})
		});

		test("create an Post about stilton", function(t){
			return conn.setNode({
				id:"stilton-post",
				type:"Post",
				attrs: [
					{name:"title",value:"about stilton"},
					{name:"body",value:"stilton is the bluest of cheeses"},
				]
			},`
				id
			`)
			.then(function(res){
				return t.same(res, {
					id: "stilton-post",
				})
			})
		});

		test("connect alice to cheddar-post as author", function(t){
			return conn.setEdge({
				from: "cheddar-post",
				to: "alice",
				name: "author"
			})
			.then(function(res){
				return t.same(res, {
					from: {id: "cheddar-post"},
					to: {id: "alice"},
					name: "author"
				})
			})
		});

		test("connect alice to stilton-post as author", function(t){
			return conn.setEdge({
				from: "stilton-post",
				to: "alice",
				name: "author"
			},`
				from {
					...on Post {
						title
					}
				}
				to {
					...on Author {
						name
					}
				}
				name
			`)
			.then(function(res){
				return t.same(res, {
					from: {title: "about stilton"},
					to: {name: "alice alison"},
					name: "author"
				})
			})
		});

		test("create a Cheese tag", function(t){
			return conn.setNode({
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

		test("fetch cheddar-post with author", function(t){
			return conn.query(`
				post:node(id:"cheddar-post") {
					id
					...on Post {
						title
						body
						author {
							...on Author {
								id
								name
							}
						}
					}
				}
			`)
			.then(function(data){
				return t.same(data, {
					post: {
						id: "cheddar-post",
						title: "about cheddar",
						body: "cheddar comes from the moon",
						author: {
							id: "alice",
							name: "alice alison"
						}
					}
				})
			})
		});

		test("fetch alice's posts (reverse of HasOne)", function(t){
			return conn.query(`
				alice:node(id:"alice") {
					posts:in(name:"author") {
						...on Post {
							id
							title
						}
					}
				}
			`)
			.then(function(data){
				return t.same(data, {
					alice: {
						posts: [
							{id:"cheddar-post", title:"about cheddar"},
							{id:"stilton-post", title:"about stilton"}
						]
					}
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
						{id: "cheddar-post"},
						{id: "stilton-post"},
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

		test("filter nodes by multiple types", function(t){
			return conn.query(`
				nodes(type:[Post,Tag]) {
					id
				}
			`)
			.then(function(data){
				return t.same(data, {
					nodes: [
						{id: "cheddar-post"},
						{id: "stilton-post"},
						{id: "cheese-tag"},
					]
				})
			})
		});

		test("disconnect alice as author of cheddar-post", function(t){
			return conn.removeEdges({
				from: "cheddar-post",
				to: "alice",
				name: "author"
			})
			.then(function(res){
				return t.same(res, [
						{
							to: {id: "alice"},
							from: {id:"cheddar-post"},
							name: "author"
						}
				])
			})
		})

		test("check alice not author of cheddar-post anymore ", function(t){
			return conn.query(`
				node(id:"cheddar-post") {
					...on Post {
						author {
							id
						}
					}
				}
			`)
			.then(function(data){
				return t.same(data, {node:{author:null}})
			})
		});

		test("remove Author Alice", function(t){
			return conn.removeNodes({
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
