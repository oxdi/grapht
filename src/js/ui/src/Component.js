import React from 'react';
import { PropTypes } from 'react';
import { CircularProgress } from 'react-md';

export default class Component extends React.Component {

	static propTypes = {
		query: PropTypes.string,
	}

	static contextTypes = {
		userToken: PropTypes.string.isRequired,
		appID: PropTypes.string.isRequired,
		onError: PropTypes.func.isRequired,
		onSetPane: PropTypes.func.isRequired,
		mobile: PropTypes.bool.isRequired,
		tablet: PropTypes.bool.isRequired,
		desktop: PropTypes.bool.isRequired,
		conn: PropTypes.object.isRequired,
	}

	constructor(...args){
		super(...args);
		this.uniqueID = `${this.constructor.name}_${Date.now()}`;
		this.mounted = true;
		this.__render = this.render;
		this.render = () => {
			if( !this.isConnected() ){
				return <CircularProgress />;
			}
			let q = this.props.query;
			if( q && !this.state.data ){
				return <CircularProgress />;
			}
			return this.__render();
		}
	}

	state = {}

	componentDidMount(){
		this.subscribe(this.props.query);
	}

	componentWillUnmount(){
		this.mounted = false;
		this.unsubscribe();
	}

	componentWillReceiveProps(nextProps,nextContext){
		if( this.props.query != nextProps.query ){
			this.unsubscribe().then(() => this.subscribe(nextProps.query));
		}
	}

	isMobile(){
		return this.context.mobile;
	}

	isTablet(){
		return this.context.tablet;
	}

	isDesktop(){
		return this.context.desktop;
	}

	getAppID(){
		return this.context.appID;
	}

	getQueryName(){
		return this.uniqueID;
	}

	unsubscribe(){
		if( !this.query ){
			return Promise.resolve();
		}
		return this.conn()
			.then(this._unsubscribe)
			.catch(this._toast)
	}

	subscribe(q){
		if( !q ){
			return Promise.resolve();
		}
		return this.conn()
			.then(this._subscribe)
			.catch(this._toast)
	}

	go(name, params){
		this.context.onSetPane(name, params);
	}

	isConnected(){
		return !!this.context.conn;
	}

	conn(){
		if( !this.isConnected() ){
			throw new Error('not connected');
		}
		if( !this.context.conn ){
			throw new Error('no conn in context');
		}
		return this.context.conn;
	}

	toast(msg,action){
		this.context.onError(msg, action);
	}

	_unsubscribe = (conn) => {
		return conn.unsubscribe(this.getQueryName())
			.then(this._onUnsubscribe)
			.catch(this._toast)
	}

	_onUnsubscribe = () => {
		this.query = null;
		if( this.mounted ){
			this.setState({data:null});
		}
	}


	_subscribe = (conn) => {
		let q = this.props.query;
		return conn.subscribe(this.getQueryName(), q)
			.then(this._onSubscribe)
			.catch(this._toast)
	}

	_onSubscribe = (query) => {
		query.on('data', this._onQueryData);
		query.on('error', this._onQueryError);
		this.query = query;

	}

	_onQueryData = (data) => {
		this.setState({data}, this._afterUpdateData);
		if( this.onQueryData ){
			this.onQueryData(data);
		}
	}

	_onQueryError = (err) => {
		this.toast(err)
	}

	_afterUpdateData() {
		// FIXME: Sticky needs to update after an update, but this is a hack!
		if( this.refs && this.refs.sticky && this.refs.sticky.updateBounds ){
			setTimeout(() => {
				this.refs.sticky.updateBounds();
			},1000);
		}
	}

	_toast = (msg,action) => {
		this.toast(msg, action);
	}

}
