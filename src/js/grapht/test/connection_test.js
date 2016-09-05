var t = require('tap')
var Grapht = require('../index.js');
var server = require('./server.js');


t.test('connection', function(t){
	return server.run(function(){
		var connection = Grapht.connect({});
		var eq = function(t, json){
			return function(result){
				t.same(result, json);
				return;
			}
		}
		var tests = [];
		var query = function(query,json,args){
			tests.push(t.test(query, function(t){
				return connection.query(query,args)
					.then(eq(t,json))
					.catch(t.threw);
			}))
		}
		var exec = function(query,json,args){
			tests.push(t.test(query, function(t){
				return connection.exec(query,args)
					.then(eq(t,json))
					.catch(t.threw);
			}))
		}

		exec(`
			type:defineType(name:"User"){
				name
			}
		`,{
			type: {
				name: "User"
			}
		})

		console.log('begin the wait')
		return Promise.all(tests).then(function(){
			console.log('all tests done')
			connection.close();
		}).catch(t.threw);

	})
})
