import React from 'react';
import {PureComponent,PropTypes} from 'react';
import CSSTransitionGroup from 'react-addons-css-transition-group';
import classnames from 'classnames';
import { render } from 'react-dom';
import { Router, Route, Link, browserHistory, IndexRoute } from 'react-router'
import WebFont from 'webfontloader';
import uuid from 'node-uuid';

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
			primaryText: 'Audit Trail',
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
	constructor(...args){
		super(...args);
		this.state = {
			node: {
				id: uuid.v4(),
				values: {},
			}
		};
	}

	set = (k,v) => {
		let node = this.state.node;
		node.values[k] = v;
		this.setState({node: node});
	}

	setType = (v) => {
		let node = this.state.node;
		node.type = v;
		this.setState({node: node});
	}

	setID = (v) => {
		let node = this.state.node;
		node.id = v;
		this.setState({node: node});
	}

	onSubmit = () => {
		store.setNode(this.state.node)
			.then(this.onCreate)
			.catch(this.onError)
	}

	onCreate = () => {
		store.dialog();
		store.navigate(`/content/${this.state.node.id}`);
	}

	onError = (err) => {
		this.setState({error: err.toString()});
	}

	render(){
		let types = this.props.types;
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
					value={this.state.node.type}
					onChange={this.setType}
					adjustMinWidth
					floatingLabel
					fullWidth
				/>
			</div>
			<div>
				<UI.TextField
					ref="id"
					label="ID"
					value={this.state.node.id}
					onChange={this.setID}
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

const TextField = ({node,field,value,onChange}) => {
	return (
		<UI.TextField
			label={field.name}
			value={value}
			onChange={onChange}
			fullWidth
			helpText={field.hint}
		/>
	)
}

const BooleanField = ({node,field,value,onChange}) => {
	const on = value === true ||
		value === 1 ||
		(/^(true|yes|y|t|on)$/i).test((value || '').toString());
	return (
		<UI.Switch
			label={field.name}
			toggled={on}
			onChange={onChange} />
	)
}

class UploadedImageCard extends PureComponent {
	render() {
		const title = <UI.CardTitle
			key="title"
			title="Image Filename here"
			subtitle={`Other image info here`}
		/>

		return <UI.Card>
			<UI.CardMedia overlay={title}>
			<UI.IconButton data-name={name} className="close-btn">close</UI.IconButton>
				<img src={this.props.url} />
			</UI.CardMedia>
		</UI.Card>;
	}
}

class ImageField extends PureComponent {
	constructor(...args) {
		super(...args);
		this.state = {};
		this._timeout = null;
	}

	componentWillUnmount() {
		this._timeout && clearTimeout(this._timeout);
	}

	_onLoad = (file, uploadResult) => {
		const { name, size, type, lastModifiedDate } = file;
		this.props.onChange(uploadResult);

		this._timeout = setTimeout(() => {
			this._timeout = null;
			this.setState({ progress: null });
		}, 2000);

		this.setState({ file, progress: 100 });
	};

	_setFile = (file) => {
		this.setState({ file });
	};

	_handleProgress = (file, progress) => {
		// The progress event can sometimes happen once more after the abort
		// has been called. So this just a sanity check
		if (this.state.file === file) {
			this.setState({ progress });
		}
	};

	_abortUpload = () => {
		this.refs.upload.abort();
		this.setState({ file: null, progress: null });
	};


	render() {
		let img;
		if( this.props.value ){
			img = <UploadedImageCard url={this.props.value} />;
		}

		let stats;
		if (typeof progress === 'number') {
			stats = [
				<UI.LinearProgress key="progress" value={progress} />,
				<UI.RaisedButton key="abort" label="Abort Upload" onClick={this._abortUpload} />,
			];
		}

		return <div>
			{stats}
			<CSSTransitionGroup
				component="output"
				className="md-card-list"
				transitionName="upload"
				transitionEnterTimeout={150}
				transitionLeaveTimeout={150}
				onClick={this._handleListClick}
			>
				{img}
			</CSSTransitionGroup>
			<UI.FileUpload
				multiple={false}
				secondary
				ref="upload"
				label="Select image"
				onLoadStart={this._setFile}
				onProgress={this._handleProgress}
				onLoad={this._onLoad}
			/>
		</div>;
	}
}

class Field extends React.Component {
	render(){
		switch( this.props.field.type ){
		case 'Text':      return <TextField {...this.props} />;
		case 'Int':       return <TextField {...this.props} type="number" />;
		case 'Float':     return <TextField {...this.props} type="number" />;
		case 'Boolean':   return <BooleanField {...this.props} />;
		case 'Image':     return <ImageField {...this.props} />;
		// TODO: HasOne, Collections
		default:          return <div>UNKNOWN FIELD TYPE {this.props.field.type}</div>;
		}
	}
}

class ContentEditPane extends React.Component {

	constructor(...args){
		super(...args);
		this.node = this.props.data.nodes.filter(t => t.id == this.props.params.id)[0];
		let fields = this.node.type.fields.reduce((fs, f) => {
			fs[f.name] = f;
			return fs;
		}, {});
		this.state = {
			values:	this.node.attrs.reduce((vs,v) => {
				if( fields[v.name] ){
					vs[v.name] = v.value
				}
				return vs
			}, {}),
			dirty: false,
			errors: [],
		};
	}

	set = (field, v) => {
		let dirty = true;
		let values = this.state.values;
		values[field.name] = v;
		this.setState({values,dirty})
	}
	// todo: add ye olde numbers
	// todo: DataTable
	// 	-> add/remove cols
	// 	-> add/remove rows
	// 	-> array-array-string
	// 	-> first row is
	// todo: ALL si units
	// todo: sidebar only
	// todo: switch back to encoding image info as json
	// 	-> filename
	// 	-> default focus (x/y)
	// 	-> default resize algo

	onSave = () => {
		this.setState({errors:null});
		console.log('saving ...', this.state.values, this.node);
		store.setNode({
			id: this.node.id,
			type: this.node.type.name,
			values: this.state.values,
		})
		.then(this.afterSave)
		.catch((err) => this.setState({errors:[err.toString()]}));
	}

	afterSave = () => {
		this.setState({dirty: false});
	}

	fieldItems(){
		let node = this.node;
		return node.type.fields.map(f => {
			return <UI.Card key={`${node.id}__${f.name}`}>
				<div style={{margin:20}}>
					<Field ref={f.name} field={f} node={node} value={this.state.values[f.name]} onChange={this.set.bind(this,f)} />
				</div>
			</UI.Card>
		})
	}

	render(){
		let toasts = (this.state.errors || []).map(e => {
			return {text: e};
		})
		return (
			<div style={{margin:40}}>
				<div className="md-card-list">
					{this.fieldItems()}
					<UI.Card>
						<div style={{margin:20}}>
							<UI.FlatButton primary iconBefore={false} label="Save" disabled={!this.state.dirty} onClick={this.onSave} />
						</div>
					</UI.Card>
				</div>
				<UI.Snackbar
					toasts={toasts}
					autohide
					dismiss={() => this.setState({errors:[]})}
				/>
			</div>
		);
	}
};

const ContentRow = ({node,onClick}) => {
	const values = node.attrs.reduce((vs,attr) => {
		vs[attr.name] = attr.value;
		return vs;
	},{})
	return <UI.TableRow onClick={onClick}>
		<UI.TableColumn>{node.id}</UI.TableColumn>
		<UI.TableColumn>{node.type.name}</UI.TableColumn>
		<UI.TableColumn>{values.name || values.title || 'unnamed'}</UI.TableColumn>
	</UI.TableRow>;
}

const ContentPane = ({params,data,location}) => (
	<div>
		<UI.DataTable>
			<UI.TableHeader>
				<UI.TableRow>
					<UI.TableColumn>ID</UI.TableColumn>
					<UI.TableColumn>Type</UI.TableColumn>
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
			onClick={() => store.dialog(<CreateContentDialog types={data.types} />)}
		>add</UI.FloatingButton>
	</div>
);

const ErrorPane = ({err}) => (
	<div>Error {err}</div>
);

const Home = () => (
	<div>HOMEY</div>
);

render((
	<Router history={browserHistory}>
		<Route path="/" component={App}>
			<IndexRoute component={Home}/>
			<Route path="types" component={TypesPane}/>
			<Route path="types/:name" component={TypeEditPane}/>
			<Route path="content" component={ContentPane}/>
			<Route path="content/:id" component={ContentEditPane}/>
		</Route>
		<Route path="*" component={ErrorPane}/>
 	</Router>
), document.getElementById('app'))
