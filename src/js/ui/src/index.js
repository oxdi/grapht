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



let store = new Store({
	host:'toolbox.oxdi.eu:8282',
});

class App extends React.Component {

	static contextTypes = {
		router: React.PropTypes.object.isRequired,
	};

	state = {data: null}

	onData = (data) => {
		this.setState({data: data});
	}

	onDataError = (err) => {
		this.setState({dataError: err});
	}

	onReadyStateChange = (state) => {
		this.setState({connection: state});
	}

	componentDidMount(){
		store.router = this.context.router;
		store.onAuthStateChange = this.onAuthStateChange
		store.onConnectionStateChange = this.onConnectionStateChange
		this.query = store.subscribe(`
			types {
				name
			}
		`)
		this.query.on('data', this.onData);
		this.query.on('error', this.onDataError);
	}

	componentWillUnmount(){
		store.router = null;
		if( this.query ){
			this.query.unsubscribe();
		}
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
		if( this.state.connection == 
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
