import React from 'react';
import { render } from 'react-dom';
import { Router, Route, Link, browserHistory } from 'react-router'
import WebFont from 'webfontloader';

import {NavigationDrawer} from 'react-md';
import {IconButton} from 'react-md';

WebFont.load({
	google: {
		  families: ['Roboto:300,400,500,700', 'Material Icons'],
	},
});

import {Store,register} from 'grapht';
let store = new Store({});

class App extends React.Component {

	static contextTypes = {
		router: React.PropTypes.object.isRequired,
	};

	state = {data: null, loading: true};

	componentDidMount(){
		if( !this.state.credentials ){
			let credentials = this.loadCredentials();
			if( credentials ){
				this.connect(credentials)
					.then(() => this.setState({loading:false}))
					.catch(() => this.setState({loading:false}))
				return;
			}
		}
		this.setState({loading:false});
	}

	loadCredentials(){
		try{
			let credentials = localStorage.getItem('credentials');
			if( credentials ){
				return JSON.parse(credentials);
			}
			return null;
		}catch(err){
			console.error(err);
			return null;
		}
	}

	onError = (err) => {
		this.setState({error: err});
		console.error('onError', err);
	}

	onQueryData = (data) => {
		this.setState({data: data});
	}

	onQueryError = (err) => {
		this.setState({error: err});
		console.error('onQueryError', err);
	}

	onConnectionStateChange = (online) => {
		let data = this.state.data;
		if( !online ){
			data = null;
		}
		this.setState({
			online,
			data
		});
	}

	onAuthStateChange = (credentials) => {
		this.setState({credentials: credentials});
		localStorage.setItem('credentials', JSON.stringify(credentials));
	}

	register = (details) => {
		return register(details)
			.then((credentials) => {
				this.connect(credentials);
			})
			.catch(this.onError)
	}

	connect = (credentials) => {
		return store.connect(credentials)
			.then(() => {
				this.onAuthStateChange(credentials);
				this.onConnectionStateChange(true);
				store.router = this.context.router;
				store.onAuthStateChange = this.onAuthStateChange
				store.onConnectionStateChange = this.onConnectionStateChange
				return store.subscribe('main', `
					types {
						name
					}
				`)
			})
			.then((query) => {
				query.on('data', this.onQueryData);
				query.on('error', this.onQueryError);
			})
			.catch((err) => {
				this.onError(err);
				this.onAuthStateChange(null);
				this.onConnectionStateChange(false);
			})
	}

	logout(){
		store.close().then(() => {
			this.setState({credentials: null});
			localStorage.setItem('credentials', null);
		})
	}


	sidebarItems(){
		let router = this.context.router;
		return [{
			primaryText: 'Types',
			onClick: () => store.navigate('/types'),
		},{
			primaryText: 'Content',
			onClick: () => store.navigate('/content'),
		},{
			primaryText: 'Settings',
			onClick: () => store.navigate('/settings'),
		},{
			primaryText: 'logout',
			onClick: () => this.logout(),
		}]
	}

	toolbarItems(){
		return (
			<IconButton
				tooltipLabel="Close Demo"
				tooltipPosition="left"
				className="md-navigation-drawer-btn fr"
			>
				close
			</IconButton>
		);
	}

	render(){
		if( this.state.loading ){
			return <div>loading</div>;
		}
		if( !this.state.credentials ){
			return (
				<div>
					<button onClick={() => this.connect({username:"guest",password:"guest",appID:"example"})}>login</button>
					<button onClick={() => this.register({username:"admin",password:"admin",appID:"example",email:"admin@example.com"})}>register</button>
				</div>
			);
		}
		if( !this.state.online ){
			return <div>OFFLINE</div>;
		}
		if( !this.state.data ){
			return <div>NO DATA</div>;
		}
		if( !this.props.children ){
			return <div>NO CHILDREN?</div>;
		}
		let section = React.cloneElement(this.props.children, {
			data: this.state.data,
			online: this.state.online,
		});
		let onlineMessage = this.state.online ? 'online' : 'offline';
		return (
			<NavigationDrawer
				drawerTitle="Structura"
				toolbarTitle={onlineMessage}
				tabletDrawerType={NavigationDrawer.DrawerType.PERSISTENT_MINI}
				desktopDrawerType={NavigationDrawer.DrawerType.PERSISTENT_MINI}
				navItems={this.sidebarItems()}
				toolbarChildren={this.toolbarItems()}>
				{section}
			</NavigationDrawer>
		);
	}
}

const Types = ({params,data,location}) => (
	<div>{data.types.map(t => <div key={t.name}>{t.name}</div>)}</div>
);

const Content = () => (
	<div>Content</div>
);

const NoMatch = () => (
	<div>NoMatch</div>
);

render((
	<Router history={browserHistory}>
		<Route path="/" component={App}>
			<Route path="types" component={Types}/>
			<Route path="content" component={Content}/>
		</Route>
		<Route path="*" component={NoMatch}/>
 	</Router>
), document.getElementById('app'))
