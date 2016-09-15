
var IMAGE_DATA = "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAABlBMVEUAAAD///+l2Z/dAAAAM0lEQVR4nGP4/5/h/1+G/58ZDrAz3D/McH8yw83NDDeNGe4Ug9C9zwz3gVLMDA/A6P9/AFGGFyjOXZtQAAAAAElFTkSuQmCC";
// var WebSocket = require('ws');
var test = require('blue-tape')
var Grapht = require('../index.js');

var host = "localhost:8282";
var appID = "jstest";
var admin;
var guest;



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
	.then(function(token){
		t.ok(token,'expected a token');
		return Grapht.connect({
			host: host,
			credentials:{token:token}
		});
	})
	.then(function(store){
		admin = store;
		return admin.query(`
			user:node(id:"admin") {
				id
			}
			types {
				name
				fields {
					name
					type
				}
			}
		`);
	})
	.then(function(res){
		t.same(res, {
			user: {
				id: "admin"
			},
			types: [
				{name:"User", fields: [
					{name:"email", type:"Text"},
					{name:"password", type:"Text"},
				]}
			]
		});
	})
})

test("fail to connect to database using invalid user", function(t){
	return Grapht.connect({
		host: host,
		credentials: {
			username: "adminnnn",
			password: "p4sswerd%",
			appID: appID
		}
	}).then(function(c){
		t.fail('should have rejected invalid user/pass');
	}).catch(function(err){
		t.ok(err);
	});
})

test("fail to connect to database using invalid pass", function(t){
	return Grapht.connect({
		host: host,
		credentials: {
			username: "admin",
			password: "p4ssw",
			appID: appID
		}
	}).then(function(c){
		t.fail('should have rejected invalid user/pass');
	}).catch(function(err){
		t.ok(err);
	});
})

test("connect to database using guest user/pass", function(t){
	return Grapht.connect({
		host: host,
		credentials: {
			username: "guest",
			password: "guest",
			appID: appID
		}
	}).then(function(c){
		t.ok(c.cfg.token);
		guest = c;
	})
})

test("create an Author type", function(t){
	return admin.setType({
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
	return admin.setType({
		name:"Post",
		fields:[
			{name:"title",type:"Text"},
			{name:"image",type:"Image"},
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
				{name: "image", type:"Image", edge:null, toType:null},
				{name: "body", type:"Text", edge:null, toType:null},
				{name: "author", type:"HasOne", edge:"author",toType:"Author"},
				{name: "tags", type:"HasMany", edge:"tagged",toType:"Tag"},

			]
		})
	})
});

test("create a Tag type", function(t){
	return admin.setType({
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
	return admin.setNode({
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
	return admin.setNode({
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
		t.same(res, {
			name: "alice alison",
			age: 52,
			height: 1.6,
			admin: true,
		})
	})
});

test("create an Author node called bob", function(t){
	return admin.setNode({
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
	return admin.setNode({
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
	return admin.setNode({
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
	return admin.setEdge({
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
	return admin.setEdge({
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
	return admin.setNode({
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
				{name:"name", value: "CHEESE"}
			]
		})
	})
});

test("fetch cheddar-post with author", function(t){
	return admin.query(`
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
				image {
					url
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
				},
				image: null
			}
		})
	})
});

test("fetch alice's posts (reverse of HasOne)", function(t){
	return admin.query(`
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
	return admin.query(`
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
	return admin.query(`
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
	return admin.query(`
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
	return admin.query(`
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

test("set image on cheddar-post", function(t){
	return admin.setNode({
		id: "cheddar-post",
		type: "Post",
		values: {
			image: IMAGE_DATA
		}
	})
});

test("fetch image url (data-uri by default)", function(t){
	return admin.query(`
		post:node(id:"cheddar-post") {
			...on Post {
				image {
					url
				}
			}
		}
	`)
	.then(function(data){
		return t.same(data, {
			post: {
				image: {
					url: `data:${IMAGE_DATA}`,
				}
			}
		})
	})
});

test("fetch image url and contentType", function(t){
	return admin.query(`
		post:node(id:"cheddar-post") {
			...on Post {
				image {
					contentType
					url(scheme:DATA)
				}
			}
		}
	`)
	.then(function(data){
		return t.same(data, {
			post: {
				image: {
					contentType: "image/png",
					url: `data:${IMAGE_DATA}`,
				}
			}
		})
	})
});

test("fetch image as regular (scheme:HTTP)", function(t){
	return admin.query(`
		post:node(id:"cheddar-post") {
			...on Post {
				image {
					url(scheme:HTTP)
				}
			}
		}
	`)
	.then(function(data){
		return t.same(data, {
			post: {
				image: {
					url: `//fixme.com/image.jpg`,
				}
			}
		})
	})
});

test("resize image (default: fill with jpeg output format)", function(t){
	return admin.query(`
		post:node(id:"cheddar-post") {
			...on Post {
				image(width:50, height:50) {
					contentType
					url
				}
			}
		}
	`)
	.then(function(data){
		return t.same(data, {
			post: {
				image: {
					contentType: "image/jpeg",
					url: 'data:image/jpeg;base64,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'
				}
			}
		})
	})
});


test("disconnect alice as author of cheddar-post", function(t){
	return admin.removeEdges({
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
	return admin.query(`
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
	return admin.removeNodes({
		id:"alice",
	})
	.then(function(res){
		return t.same(res, {id: "alice"})
	})
})

test("check alice was deleted", function(t){
	return admin.query(`
		node(id:"alice") {
			id
		}
	`)
	.then(function(data){
		return t.same(data, {node:null})
	})
});

test("guest connection should be unaffected so far", function(t){
	return guest.query(`
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

test.skip("reconnecting admin should keep connection state", function(t){
	return admin.close()
		.then(function(){
			return admin.connect({
				host: host,
				username: "admin",
				password: "p4sswerd%",
				appID: appID
			})
		})
		.then(function(conn){
			admin = conn;
			return conn.query(`
				nodes {
					id
				}
			`)
		})
		.then(function(res){
			t.same(res, {
				nodes:[
					{id: "guest"},
					{id: "admin"},
					{id:"bob"},
					{id:"stilton-post"},
					{id:"cheese-tag"},
					{id:"cheddar-post"},
				],
			});
		});
});

test("commit admin changes", function(t){
	return admin.commit()
});


test("guest connection  should now reflect all changes", function(t){
	return guest.query(`
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
				{id:"stilton-post"},
				{id:"cheese-tag"},
				{id:"cheddar-post"},
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
	return admin.subscribe("main", `
		nodes(type:Tag){
			...on Tag {
				name
			}
		}
	`)
	.then((query) => {
		return new Promise(function(resolve){
			var state = {dataCount: 0};
			query.on('data', function(data){
				state.dataCount++;
				switch(state.dataCount){
				case 1:
					t.same(data, {
						nodes: [
							{name: "CHEESE"}
						]
					});
					admin.setNode({
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
					t.equal(state.dataCount, 2);
					resolve(true);
					break;
				default:
					resolve(Promise.reject(new Error('received more data than expected')))
				}
			});
			query.on('error', function(err){
				resolve(Promise.reject(new Error(err)))
			});
		})
	})
})

test("subscription should update on guest.commit", function(t){
	var state = {dataCount: 0};
	return admin.subscribe("main", `
		nodes(type:Tag){
			...on Tag {
				name
			}
		}
	`)
	.then((query) => {
		return new Promise(function(resolve){
			query.on('data', function(data){
				state.dataCount++;
				switch(state.dataCount){
				case 1:
					t.same(data, {
						nodes: [
							{name: "CHEESEY"}
						]
					});
					guest.setNode({
						id: "cheese-tag",
						type: "Tag",
						values: {
							name: "cheese"
						}
					}).then(function(){
						return guest.commit();
					}).catch(t.threw)
					break;
				case 2:
					t.same(data, {
						nodes: [
							{name: "cheese"}
						]
					});
					resolve(true);
					break;
				default:
					resolve(Promise.reject(new Error('received more data than expected')))
				}
			});
			query.on('error', function(err){
				t.equal(state.dataCount, 2);
				resolve(Promise.reject(new Error(err)))
			});
		})
	})

})
