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

// import 'react-md/dist/react-md.min.css';
import MyAwesomeComponent from './MyAwesomeComponent';

const App = ({children},{router}) => (
	<NavigationDrawer
		drawerTitle="Structura"
		toolbarTitle=""
		tabletDrawerType={NavigationDrawer.DrawerType.PERSISTENT_MINI}
		desktopDrawerType={NavigationDrawer.DrawerType.PERSISTENT_MINI}
		navItems={[{
			primaryText: 'Types',
			onClick: () => router.push('/types'),
		}, {
			primaryText: 'Content',
			onClick: () => router.push('/content'),
		}, {
			primaryText: 'Settings',
			onClick: () => router.push('/settings'),
		}]}
		toolbarChildren={
			<IconButton
				tooltipLabel="Close Demo"
				tooltipPosition="left"
				className="md-navigation-drawer-btn fr"
			>
				close
			</IconButton>
		}
	>
		{children}
	</NavigationDrawer>
);

App.contextTypes = {
	router: React.PropTypes.object.isRequired
};

const Types = () => (
	<div>TYPES</div>
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
