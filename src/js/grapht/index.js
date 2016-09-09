var Connection = require('./connection.js');
var Grapht = {
	connect: function(args){
		var c = new Connection(args);
		c.connect()
		return c;
	}
};
module.exports = Grapht;

