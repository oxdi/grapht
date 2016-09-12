
function Query(cfg){
	this.cfg = cfg;
	this.onData = function(){}
	this.onError = function(){}
	this.onUnsubscribe = function(){}
}

Query.prototype.on = function(evt, fn){
	switch(evt){
	case "data":
		this.onData = fn;
		break;
	case "error":
		this.onError = fn;
		break;
	case "unsubscribe":
		this.onUnsubscribe = fn;
		break;
	default:
		throw new Error('unknown event name: '+evt);
	}
}

Query.prototype._onData = function(msg){
	if( !msg.data ){
		this.onError(new Error('no result data'));
	}else if( msg.data.errors && msg.data.errors.length > 0 ){
		this.onError(new Error(msg.data.errors.map(function(err){ return err.message}).join(' AND ')));
	} else {
		this.onData(msg.data.data);
	}
}

Query.prototype.unsubscribe = function(){
	var query = this;
	var conn = this.cfg.conn;
	return conn._send({
		type:"unsubscribe",
		subscription: this.cfg.subscription,
	}).then(function(msg){
		query.onUnsubscribe();
	}).catch(function(err){
		query.onError(err);
	});
}

Query.prototype.subscribe = function(){
	var query = this;
	var conn = this.cfg.conn;
	return conn._send({
		type:"subscribe",
		subscription: query.cfg.subscription,
		query: `query { ${query.cfg.query} }`,
		params: query.cfg.params || {},
	}).then(function(msg){
		return query;
	}).catch(function(err){
		query.onError(err);
	});
}

Query.prototype.set = function(query,params){
	this.cfg.query = query;
	this.cfg.params = params || {};
	return this.subscribe();
}

module.exports = Query;
