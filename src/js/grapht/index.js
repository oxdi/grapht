var Connection = require('./connection.js');
var Grapht = {
	connect: function(args){
		return new Connection(args);
	}
};
module.exports = Grapht;

