
function Query(cfg){
	this.cfg = cfg;
	this.onData = function(){}
	this.onError = function(){}
	this.onUnsubscribe = function(){}
	this.ready = this.subscribe();
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
	return conn.send({
		type:"unsubscribe",
		tag: this.cfg.tag,
	}).then(function(msg){
		query.onUnsubscribe();
		this.ready = Promise.reject(new Error('not subscribed'));
	}).catch(function(err){
		query.onError(err);
	});
}

Query.prototype.subscribe = function(){
	var query = this;
	var conn = this.cfg.conn;
	return conn.send({
		type:"subscribe",
		tag: this.cfg.tag,
		query: `query { ${this.cfg.query} }`,
		params:this.cfg.params || {},
	}).then(function(msg){
		return query;
	}).catch(function(err){
		query.onError(err);
	});
}

Query.prototype.set = function(query,params){
	this.cfg.query = query;
	this.cfg.params = params || {};
	this.ready = this.subscribe();
	return this.ready;
}

module.exports = Query;
