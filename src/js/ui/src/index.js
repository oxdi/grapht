import React from 'react';
import { render } from 'react-dom';
import { Router, Route, Link, browserHistory } from 'react-router'
import WebFont from 'webfontloader';

import UI from 'react-md/lib';
import {ExpansionPanel, ExpansionList} from 'react-md/lib/ExpansionPanels';
UI.ExpansionPanel = ExpansionPanel;
UI.ExpansionList = ExpansionList;

WebFont.load({
	google: {
		  families: ['Roboto:300,400,500,700', 'Material Icons'],
	},
});

const FIELD_TYPES = [
	'Text',
	'Int',
	'Float',
	'Boolean',
	'BcryptText',
	'HasOne',
	'HasMany',
	'DataTable',
	'File',
	'Image',
];

import {Store,register} from 'grapht';
let store = new Store({});
window.store = store;

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
			// debug
			this.onConnectionStateChange = function(online){
				if( online ){
					window.location.reload();
				}
			}
			// end debug
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

	dialog = (el) => {
		this.setState({dialog: el});
	}

	connect = (credentials) => {
		return store.connect(credentials)
			.then(() => {
				this.onAuthStateChange(credentials);
				this.onConnectionStateChange(true);
				store.router = this.context.router;
				store.dialog = this.dialog
				store.onAuthStateChange = this.onAuthStateChange
				store.onConnectionStateChange = this.onConnectionStateChange
				return store.subscribe('main', this.getQuery())
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

	getQuery(){
		return `
			types {
				name
				fields {
					name
					type
				}
			}
			nodes {
				type {
					name
					fields {
						name
						type
					}
				}
				id
				attrs {
					name
					value
				}
				edges {
					name
					from {
						id
					}
					to {
						id
					}
				}
			}
		`
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
			<UI.IconButton
				tooltipLabel="Close Demo"
				tooltipPosition="left"
				className="md-navigation-drawer-btn fr"
			>
				close
			</UI.IconButton>
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
			<UI.NavigationDrawer
				drawerTitle="Structura"
				toolbarTitle={onlineMessage}
				tabletDrawerType={UI.NavigationDrawer.DrawerType.PERSISTENT_MINI}
				desktopDrawerType={UI.NavigationDrawer.DrawerType.PERSISTENT_MINI}
				navItems={this.sidebarItems()}
				toolbarChildren={this.toolbarItems()}>
				{this.state.dialog}
				{section}
			</UI.NavigationDrawer>
		);
	}
}

const CardList = ({children}) => (
	<div className="md-card-list">
		{children}
	</div>
)

const TypeIcon = ({type}) => {
	if( type.name == 'User' ){
		return <UI.FontIcon>face</UI.FontIcon>;
	}
	return <UI.FontIcon>collections</UI.FontIcon>;
}

class CreateTypeDialog extends React.Component {

	state = {error: null};

	onSubmit = () => {
		store.setType({
			name: this.refs.name.state.value,
		})
		.then(this.onCreate)
		.catch(this.onError)
	}

	onCreate = () => {
		store.dialog();
	}

	onError = (err) => {
		this.setState({error: err.toString()});
	}

	render(){
		return <UI.Dialog modal isOpen
			title="Create Type"
			close={() => console.log('close')}
			dialogStyle={{ maxWidth: 320 }}
			actions={[{
				onClick: () => store.dialog(),
				label: 'Cancel',
			}, {
				onClick: this.onSubmit,
				primary: true,
				label: 'OK',
			}]}
		>
			<UI.TextField ref="name" label="Name" errorText={this.state.error} />
		</UI.Dialog>
	}
}

class CreateFieldDialog extends React.Component {

	state = {error: null};

	onSubmit = () => {
		let type = this.props.type;
		console.log(this.refs);
		type.fields.push({
			name: this.refs.name.state.value,
			type: this.refs.type.state.value,
		})
		store.setType(type)
			.then(this.onCreate)
			.catch(this.onError)
	}

	onCreate = () => {
		store.dialog();
	}

	onError = (err) => {
		this.setState({error: err.toString()});
	}

	render(){
		let type = this.props.type;
		return <UI.Dialog modal isOpen
			title="Create Field"
			close={() => console.log('close')}
			dialogStyle={{ maxWidth: 320 }}
			actions={[{
				onClick: () => store.dialog(),
				label: 'Cancel',
			}, {
				onClick: this.onSubmit,
				primary: true,
				label: 'OK',
			}]}
		>
			<div>
				<UI.SelectField
					ref="type"
					label="Type"
					menuItems={FIELD_TYPES}
					itemLabel="type"
					adjustMinWidth
					floatingLabel
					fullWidth
				/>
			</div>
			<div>
				<UI.TextField
					ref="name"
					label="Name"
					fullWidth
					errorText={this.state.error}
				/>
			</div>
			<div style={{width:500,height:50}}>
			</div>
		</UI.Dialog>
	}
}

class CreateContentDialog extends React.Component {

	state = {error: null};

	onSubmit = () => {
		let type = this.props.type;
		console.log(this.refs);
		type.fields.push({
			name: this.refs.name.state.value,
			type: this.refs.type.state.value,
		})
		store.setType(type)
			.then(this.onCreate)
			.catch(this.onError)
	}

	onCreate = () => {
		store.dialog();
	}

	onError = (err) => {
		this.setState({error: err.toString()});
	}

	render(){
		let types = this.props.types;
		let type = this.props.type;
		return <UI.Dialog modal isOpen
			title="Create Content"
			close={() => console.log('close')}
			dialogStyle={{ maxWidth: 320 }}
			actions={[{
				onClick: () => store.dialog(),
				label: 'Cancel',
			}, {
				onClick: this.onSubmit,
				primary: true,
				label: 'OK',
			}]}
		>
			<div>
				<UI.SelectField
					ref="type"
					label="Type"
					menuItems={types.map(t => t.name)}
					itemLabel="type"
					adjustMinWidth
					floatingLabel
					fullWidth
				/>
			</div>
			<div>
				<UI.TextField
					ref="name"
					label="Name"
					fullWidth
					errorText={this.state.error}
				/>
			</div>
			<div style={{width:500,height:50}}>
			</div>
		</UI.Dialog>
	}
}

const TypeItem = ({type}) => (
	<UI.ListItem
		leftAvatar={<UI.Avatar icon={<TypeIcon type={type} />} />}
		rightIcon={<UI.FontIcon>info</UI.FontIcon>}
		primaryText={type.name}
		secondaryText="Custom Type"
		onClick={() => store.navigate(`/types/${type.name}`)}
	/>
)

class FieldExpansionPanel extends React.Component {

	constructor(...args){
		super(...args);
		this.state = {field:{}};
		for(let k in this.props.field){
			this.state.field[k] = this.props.field[k];
		}
	}

	set = (name, v) => {
		let field = this.state.field;
		field[name] = v;
		this.setState({field});
	}

	onSave = () => {
		let f = this.props.field;
		for(let k in this.state.field){
			f[k] = this.state.field[k];
		}
		store.setType(this.props.type);
	}

	render(){
		let field = this.state.field;
		return (
			<UI.ExpansionPanel
				label={this.props.field.name}
				secondaryLabel={[
					this.props.field.type,
				]}
				onSave={this.onSave}
			>
				<form>
					<div>
						<UI.TextField
							ref="name"
							label="Name"
							value={field.name}
							onChange={this.set.bind(this,'name')}
							fullWidth
							helpText="The name of the field"
						/>
					</div>
					<div>
						<UI.SelectField
							ref="type"
							label="Type"
							value={field.type}
							onChange={this.set.bind(this,'type')}
							menuItems={FIELD_TYPES}
							itemLabel="type"
							adjustMinWidth
							floatingLabel
							fullWidth
						/>
					</div>
				</form>
			</UI.ExpansionPanel>
		);
	}
}


const TypeEditPane = ({params,data,location}) => {
	let type = data.types.filter(t => t.name == params.name)[0]
	return (
		<div style={{margin:40}}>
			<UI.ExpansionList>
				{type.fields.map(f => <FieldExpansionPanel key={`${type.name}__${f.name}`} field={f} type={type} />)}
			</UI.ExpansionList>
			<UI.FloatingButton
				primary
				fixed
				tooltipPosition="top"
				tooltipLabel="Add Field"
				onClick={() => store.dialog(<CreateFieldDialog type={type} />)}
			>add</UI.FloatingButton>
		</div>
	);
};

const TypesPane = ({params,data,location}) => (
	<div>
		<UI.List>
			{data.types.map(t => <TypeItem key={t.name} type={t} />)}
		</UI.List>
		<UI.FloatingButton
			primary
			fixed
			tooltipPosition="top"
			tooltipLabel="Add Type"
			onClick={() => store.dialog(<CreateTypeDialog />)}
		>add</UI.FloatingButton>
	</div>
);

const ContentRow = ({node,onClick}) => (
	<UI.TableRow onClick={onClick}>
		<UI.TableColumn>{node.id}</UI.TableColumn>
		<UI.TableColumn numeric>{node.name || node.title || 'unnamed'}</UI.TableColumn>
	</UI.TableRow>
)

const TextField = ({node,field}) => (
	<div>
		<UI.TextField
			ref="name"
			label={field.name}
			value={node[field.name]}
			fullWidth
			helpText={field.hint}
		/>
	</div>
)

const Field = ({node,field}) => {
	let props = {node,field};
	switch( field.type ){
	case 'Text':      return <TextField {...props} />;
	default:          return <div>UNKNOWN FIELD TYPE</div>;
	}
}

const ContentEditPane = ({params,data,location}) => {
	let node = data.nodes.filter(t => t.id == params.id)[0];
	return (
		<div style={{margin:40}}>
			<div className="md-card-list">
				{node.type.fields.map(f => <UI.Card key={`${node.id}__${f.name}`}><Field field={f} node={node} /></UI.Card>)}
			</div>
			<UI.FloatingButton
				primary
				fixed
				tooltipPosition="top"
				tooltipLabel="Add Field"
				onClick={() => store.dialog(<CreateFieldDialog type={type} />)}
			>add</UI.FloatingButton>
		</div>
	);
};

const ContentPane = ({params,data,location}) => (
	<div>
		<UI.DataTable>
			<UI.TableHeader>
				<UI.TableRow>
					<UI.TableColumn>ID</UI.TableColumn>
					<UI.TableColumn numeric>Name</UI.TableColumn>
				</UI.TableRow>
			</UI.TableHeader>
			<UI.TableBody>
				{data.nodes.map(n => <ContentRow key={n.id} node={n} onClick={() => store.navigate(`/content/${n.id}`)} />)}
			</UI.TableBody>
		</UI.DataTable>
		<UI.FloatingButton
			primary
			fixed
			tooltipPosition="top"
			tooltipLabel="Add Type"
			onClick={() => store.dialog()}
		>add</UI.FloatingButton>
	</div>
);

const ErrorPane = ({err}) => (
	<div>Error {err}</div>
);

render((
	<Router history={browserHistory}>
		<Route path="/" component={App}>
			<Route path="types" component={TypesPane}/>
			<Route path="types/:name" component={TypeEditPane}/>
			<Route path="content" component={ContentPane}/>
			<Route path="content/:id" component={ContentEditPane}/>
			<Route path="*" component={ErrorPane}/>
		</Route>
 	</Router>
), document.getElementById('app'))
