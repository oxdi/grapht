
// var WebSocket = require('ws');
var test = require('blue-tape')
var Grapht = require('../index.js');

var host = "localhost:8282";
var appID = "jstest";
var conn;
var conn2;

test("create a database", function(t){
	return Promise.resolve()
	.then(function(){
		return Grapht.register({
			host: host,
			email: "admin@example.com",
			username: "admin",
			password: "p4sswerd%",
			appID: appID,
		})
	})
	.then(function(c){
		t.ok(c,'expected register to return connection');
		t.ok(c.cfg);
		t.ok(c.cfg.token);
		conn = c;
		return conn.query(`
			types {
				name
			}
		`);
	})
	.then(function(res){
		t.same(res, {
			types: [
				{name:"User"}
			]
		});
	})
})

test("connect to database using user/pass", function(t){
	return Grapht.connect({
		host: host,
		username: "admin",
		password: "p4sswerd%",
		appID: appID
	}).then(function(c){
		t.ok(c.cfg.token);
		conn2 = c;
	})
})

test("create an Author type", function(t){
	return conn.setType({
		name:"Author",
		fields:[
			{name:"name",type:"Text"},
			{name:"age",type:"Int"},
			{name:"height", type:"Float"},
			{name:"admin", type:"Boolean"},
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
				{name: "age", type:"Int", toType:null},
				{name: "height", type:"Float", toType:null},
				{name: "admin", type:"Boolean", toType:null},
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

test("give alice a full name, age, height and admin flag", function(t){
	return conn.setNode({
		id:"alice",
		type:"Author",
		values: {
			name: "alice alison",
			age: 52,
			height: 1.6,
			admin: true,
		}
	},`
		...on Author {
			name
			age
			height
			admin
		}
	`)
	.then(function(res){
		return t.same(res, {
			name: "alice alison",
			age: 52,
			height: 1.6,
			admin: true,
		})
	})
});

test("create an Author node called bob", function(t){
	return conn.setNode({
		id:"bob",
		type:"Author",
		values: {
			name:"bobby bobbington"
		}
	})
	.then(function(res){
		return t.same(res, {
			id: "bob",
		})
	})
});

test("create a Post about cheddar", function(t){
	return conn.setNode({
		id:"cheddar-post",
		type:"Post",
		values: {
			title: "about cheddar",
			body: "cheddar comes from the moon",
		}
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
		values: {
			title: "about stilton",
			body: "stilton is the bluest of cheeses",
		}
	},`
		...on Post {
			title
		}

	`)
	.then(function(res){
		return t.same(res, {
			title: "about stilton",
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
		values: {
			name: "CHEESE",
		}
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
				{name:"name", value: JSON.stringify("CHEESE")}
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
				{id: "guest"},
				{id: "admin"},
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

test("filter nodes by single type using variable", function(t){
	return conn.query(`
		query Q($kind:[TypeEnum]) {
			nodes(type:$kind) {
				id
			}
		}
	`,{
		kind: "Author"
	}).then(function(data){
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

test("conn2 should be unaffected so far", function(t){
	return conn2.query(`
		nodes {
			id
		}
		types {
			name
		}
	`)
	.then(function(data){
		return t.same(data, {nodes:[
			{id: "guest"},
			{id: "admin"},
		],types:[
			{name:"User"}
		]})
	})
});

test("commit changes", function(t){
	return conn.commit()
});


test("conn2 should now reflect all changes", function(t){
	return conn2.query(`
		nodes {
			id
		}
		types {
			name
		}
	`)
	.then(function(data){
		return t.same(data, {
			nodes:[
				{id: "guest"},
				{id: "admin"},
				{id:"bob"},
				{id:"cheddar-post"},
				{id:"stilton-post"},
				{id:"cheese-tag"},
			],
			types:[
				{name:"User"},
				{name:"Author"},
				{name:"Post"},
				{name:"Tag"},
			]})
	})
});


test("subscribed query should update after setNode", function(t){
	return new Promise(function(resolve){
		var state = {dataCount: 0};
		var query = conn.subscribe(`
			nodes(type:Tag){
				...on Tag {
					name
				}
			}
		`);
		query.on('data', function(data){
			state.dataCount++;
			switch(state.dataCount){
			case 1:
				t.same(data, {
					nodes: [
						{name: "CHEESE"}
					]
				});
				conn.setNode({
					id: "cheese-tag",
					type: "Tag",
					values: {
						name: "CHEESEY"
					}
				}).catch(t.threw)
				break;
			case 2:
				t.same(data, {
					nodes: [
						{name: "CHEESEY"}
					]
				});
				query.unsubscribe();
				break;
			default:
				resolve(Promise.reject(new Error('received more data than expected')))
			}
		});
		query.on('error', function(err){
			resolve(Promise.reject(new Error(err)))
		});
		query.on('unsubscribe', function(){
			t.equal(state.dataCount, 2);
			resolve(true);
		});
	})
})

test("subscription should update on conn2.commit", function(t){
	return new Promise(function(resolve){
		var state = {dataCount: 0};
		var query = conn.subscribe(`
			nodes(type:Tag){
				...on Tag {
					name
				}
			}
		`);
		query.on('data', function(data){
			state.dataCount++;
			switch(state.dataCount){
			case 1:
				t.same(data, {
					nodes: [
						{name: "CHEESEY"}
					]
				});
				conn2.setNode({
					id: "cheese-tag",
					type: "Tag",
					values: {
						name: "cheese"
					}
				}).then(function(){
					return conn2.commit();
				}).catch(t.threw)
				break;
			case 2:
				t.same(data, {
					nodes: [
						{name: "cheese"}
					]
				});
				query.unsubscribe();
				break;
			default:
				resolve(Promise.reject(new Error('received more data than expected')))
			}
		});
		query.on('error', function(err){
			t.equal(state.dataCount, 2);
			resolve(Promise.reject(new Error(err)))
		});
		query.on('unsubscribe', function(){
			resolve(true);
		});
	})

})
