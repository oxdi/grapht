
export default class Query {

	constructor(name, query,params){
		this.id = name;
		this.query = query;
		this.params = params;
	}

	set(query, params){
	}

	on(name, fn){
		if( name == 'data' ){
			this.onData = fn;
		} else if( name == 'error' ){
			this.onError = fn;
		}
	}

	_onData(msg){
		if( !msg.data ){
			this._onError(new Error('no result data'));
		}else if( msg.data.errors && msg.data.errors.length > 0 ){
			this._onError(new Error(msg.data.errors.map(function(err){ return err.message}).join(' AND ')));
		} else if( this.onData ){
			try{
				this.onData(msg.data.data);
			}catch(err){
				this._onError(err);
			}
		}
	}

	_onError(err){
		if( this.onError ){
			this.onError(err);
		}
	}

}

module.exports = Query;
