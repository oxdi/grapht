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

import Grapht from 'grapht'
let store = Grapht.connect({appID:"example"});
window.store = store;
store.navigate = function(path,params){
	if( !store.router ){
		return;
	}
	store.router.push(path);
}

class App extends React.Component {

	static contextTypes = {
		router: React.PropTypes.object.isRequired
	};

	state = {data: null}

	onData = (data) => {
		this.setState({data: data});
	}

	onDataError = (err) => {
		this.setState({dataError: err});
	}

	onOnline = (err) => {
		this.setState({online: true});
	}

	onOffline = (err) => {
		this.setState({online: false});
	}

	componentDidMount(){
		store.onOnline = this.onOnline;
		store.onOffline = this.onOffline;
		store.router = this.context.router;
		this.query = store.subscribe(`
			types {
				name
			}
		`)
		this.query.on('data', this.onData);
		this.query.on('error', this.onDataError);
	}

	componentWillUnmount(){
		this.query.unsubscribe();
	}

	sidebarItems(){
		let router = this.context.router;
		return [{
			primaryText: 'Types',
			onClick: () => router.push('/types'),
		},{
			primaryText: 'Content',
			onClick: () => router.push('/content'),
		},{
			primaryText: 'Settings',
			onClick: () => router.push('/settings'),
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
		if( !this.state.data ){
			return <div>loading</div>;
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
