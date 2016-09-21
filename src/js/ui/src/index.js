import React from 'react';
import {PureComponent,PropTypes} from 'react';
import CSSTransitionGroup from 'react-addons-css-transition-group';
import classnames from 'classnames';
import { render } from 'react-dom';
import { Router, Route, Link, browserHistory, IndexRoute } from 'react-router'
import WebFont from 'webfontloader';
import uuid from 'node-uuid';

import {
	IconButton,
	FlatButton,
	FloatingButton,
	RaisedButton,
	FontIcon,
	Dialog,
	Avatar,
	Toolbar,
	TextField,
	SelectField,
	Card, CardTitle, CardMedia,
	LinearProgress,
	TableRow,TableColumn,TableHeader,TableBody,DataTable,
	Tabs,
	Tab,
	Snackbar,
	List, ListItem,
} from 'react-md';
import {
	ExpansionPanel,
	ExpansionList
} from 'react-md/lib/ExpansionPanels';

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

import {Client} from 'grapht';
let client = new Client({host:'toolbox.oxdi.eu:8282'});
window.graphtClient = client;

class Component extends React.Component {

	static contextTypes = {
		base: PropTypes.object.isRequired,
		router: React.PropTypes.object,
		conn: React.PropTypes.object,
	}

	addToast(err,action){
		console.log('adding toast', this.context, err);
		this.context.base.addToast(err, action);
	}

	go(path, params){
		this.context.router.push(path);
	}

	store(tx){
		let conn = this.context.conn;
		return tx(conn).then(() => {
			conn.commit();
		}).catch(err => {
			this.addToast(err);
		});
	}

}

class App extends Component {

	static propTypes = {
		conn: PropTypes.object.isRequired,
	}

	state = {data: null};

	componentDidMount(){
		this.subscribe();
	}

	componentWillReceiveProps(nextProps){
		if( nextProps.conn != this.props.conn ){
			this.subscribe();
		}
	}

	subscribe(){
		return this.props.conn.subscribe('main', this.getQuery()).then((query) => {
			query.on('data', this._onQueryData);
			query.on('error', this._onQueryError);
		}).catch((err) => {
			this.addToast(err);
		})
	}

	_onQueryData = (data) => {
		this.setState({data: data});
	}

	_onQueryError = (err) => {
		this.addToast(err);
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

	_logout = () => {
		localStorage.clear();
		this._closeSession();
	}

	_closeSession = () => {
		this.props.onCloseSession();
	}

	sidebarItems(){
		let router = this.context.router;
		return [{
			primaryText: 'Types',
			onClick: () => this.go('/types'),
		},{
			primaryText: 'Content',
			onClick: () => this.go('/content'),
		},{
			primaryText: 'Settings',
			onClick: () => this.go('/settings'),
		},{
			primaryText: 'Audit Trail',
			onClick: () => this.go('/settings'),
		},{
			primaryText: 'Switch Apps',
			onClick: this._closeSession,
		},{
			primaryText: 'logout',
			onClick: this._logout,
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
			return <div>NO DATA</div>;
		}
		if( !this.props.children ){
			return <div>NO CHILDREN?</div>;
		}
		let section = React.cloneElement(this.props.children, {
			data: this.state.data,
			online: this.state.online,
		});
		return section;
	}
}

const TypeIcon = ({type}) => {
	if( type.name == 'User' ){
		return <Icon name="face" />;
	}
	return <Icon name="collections"/>;
}

class CreateTypeDialog extends Component {

	state = {error: null};

	_onSubmit = () => {
		this.store(conn => {
			return conn.setType({
				name: this.refs.name.state.value,
			})
		})
	}

	render(){
		return <Dialog modal isOpen
			title="Create Type"
			close={() => console.log('close')}
			dialogStyle={{ maxWidth: 320 }}
			actions={[{
				onClick: () => {},
				label: 'Cancel',
			}, {
				onClick: this._onSubmit,
				primary: true,
				label: 'OK',
			}]}
		>
			<TextField ref="name" label="Name" errorText={this.state.error} />
		</Dialog>
	}
}

class CreateFieldDialog extends Component {

	state = {error: null};

	onSubmit = () => {
		let type = this.props.type;
		console.log(this.refs);
		type.fields.push({
			name: this.refs.name.state.value,
			type: this.refs.type.state.value,
		})
		this.store(conn => {
			return conn.setType(type)
		})
	}

	render(){
		let type = this.props.type;
		return <Dialog modal isOpen
			title="Create Field"
			close={() => console.log('close')}
			dialogStyle={{ maxWidth: 320 }}
			actions={[{
				onClick: () => {},
				label: 'Cancel',
			}, {
				onClick: this._onSubmit,
				primary: true,
				label: 'OK',
			}]}
		>
			<div>
				<SelectField
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
				<TextField
					ref="name"
					label="Name"
					fullWidth
					errorText={this.state.error}
				/>
			</div>
			<div style={{width:500,height:50}}>
			</div>
		</Dialog>
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

	_onSubmit = () => {
		this.store(conn => {
			return conn.setNode(this.state.node)
				.then(this._onCreate)
		})
	}

	_onCreate = () => {
		this.go(`/content/${this.state.node.id}`);
	}

	_onError = (err) => {
		this.setState({error: err.toString()});
	}

	render(){
		let types = this.props.types;
		return <Dialog modal isOpen
			title="Create Content"
			close={() => console.log('close')}
			dialogStyle={{ maxWidth: 320 }}
			actions={[{
				onClick: () => {},
				label: 'Cancel',
			}, {
				onClick: this._onSubmit,
				primary: true,
				label: 'OK',
			}]}
		>
			<div>
				<SelectField
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
				<TextField
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
		</Dialog>
	}
}

const TypeItem = ({type}) => (
	<ListItem
		leftAvatar={<Avatar icon={<TypeIcon type={type} />} />}
		rightIcon={<FontIcon>info</FontIcon>}
		primaryText={type.name}
		secondaryText="Custom Type"
		onClick={() => this.go(`/types/${type.name}`)}
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
		this.store(conn => {
			return conn.setType(this.props.type);
		})
	}

	render(){
		let field = this.state.field;
		return (
			<ExpansionPanel
				label={this.props.field.name}
				secondaryLabel={[
					this.props.field.type,
				]}
				onSave={this._onSave}
			>
				<form>
					<div>
						<TextField
							ref="name"
							label="Name"
							value={field.name}
							onChange={this.set.bind(this,'name')}
							fullWidth
							helpText="The name of the field"
						/>
					</div>
					<div>
						<SelectField
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
			</ExpansionPanel>
		);
	}
}


const TypeEditPane = ({params,data,location}) => {
	let type = data.types.filter(t => t.name == params.name)[0]
	return (
		<div style={{margin:40}}>
			<ExpansionList>
				{type.fields.map(f => <FieldExpansionPanel key={`${type.name}__${f.name}`} field={f} type={type} />)}
			</ExpansionList>
			<FloatingButton
				primary
				fixed
				tooltipPosition="top"
				tooltipLabel="Add Field"
			>add</FloatingButton>
		</div>
	);
};

const TypesPane = ({params,data,location}) => (
	<div>
		<List>
			{data.types.map(t => <TypeItem key={t.name} type={t} />)}
		</List>
		<FloatingButton
			primary
			fixed
			tooltipPosition="top"
			tooltipLabel="Add Type"
		>add</FloatingButton>
	</div>
);

const TextControl = ({node,field,value,onChange}) => {
	return (
		<TextField
			label={field.name}
			value={value}
			onChange={onChange}
			fullWidth
			helpText={field.hint}
		/>
	)
}

const BooleanControl = ({node,field,value,onChange}) => {
	const on = value === true ||
		value === 1 ||
		(/^(true|yes|y|t|on)$/i).test((value || '').toString());
	return (
		<Switch
			label={field.name}
			toggled={on}
			onChange={onChange} />
	)
}

class UploadedImageCard extends PureComponent {
	render() {
		const title = <CardTitle
			key="title"
			title="Image Filename here"
			subtitle={`Other image info here`}
		/>

		return <Card>
			<CardMedia overlay={title}>
			<IconButton data-name={name} className="close-btn">close</IconButton>
				<img src={this.props.url} />
			</CardMedia>
		</Card>;
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
				<LinearProgress key="progress" value={progress} />,
				<RaisedButton key="abort" label="Abort Upload" onClick={this._abortUpload} />,
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
			<FileUpload
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

class Control extends React.Component {
	render(){
		switch( this.props.field.type ){
		case 'Text':      return <TextControl {...this.props} />;
		case 'Int':       return <TextControl {...this.props} type="number" />;
		case 'Float':     return <TextControl {...this.props} type="number" />;
		case 'Boolean':   return <BooleanControl {...this.props} />;
		case 'Image':     return <ImageControl {...this.props} />;
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

	_onSave = () => {
		this.setState({errors:null});
		console.log('saving ...', this.state.values, this.node);
		this.store(conn => {
			return conn.setNode({
				id: this.node.id,
				type: this.node.type.name,
				values: this.state.values,
			})
			.then(this._afterSave)
			.catch((err) => this.setState({errors:[err.toString()]}));
		})
	}

	_afterSave = () => {
		this.setState({dirty: false});
	}

	fieldItems(){
		let node = this.node;
		return node.type.fields.map(f => {
			return <Card key={`${node.id}__${f.name}`}>
				<div style={{margin:20}}>
					<Control ref={f.name} field={f} node={node} value={this.state.values[f.name]} onChange={this.set.bind(this,f)} />
				</div>
			</Card>
		})
	}

	render(){
		return (
			<div style={{margin:40}}>
				<div className="md-card-list">
					{this.fieldItems()}
					<Card>
						<div style={{margin:20}}>
							<FlatButton primary iconBefore={false} label="Save" disabled={!this.state.dirty} onClick={this._onSave} />
						</div>
					</Card>
				</div>
			</div>
		);
	}
};

const ContentRow = ({node,onClick}) => {
	const values = node.attrs.reduce((vs,attr) => {
		vs[attr.name] = attr.value;
		return vs;
	},{})
	return <TableRow onClick={onClick}>
		<TableColumn>{node.id}</TableColumn>
		<TableColumn>{node.type.name}</TableColumn>
		<TableColumn>{values.name || values.title || 'unnamed'}</TableColumn>
	</TableRow>;
}

const ContentPane = ({params,data,location}) => (
	<div>
		<DataTable>
			<TableHeader>
				<TableRow>
					<TableColumn>ID</TableColumn>
					<TableColumn>Type</TableColumn>
					<TableColumn numeric>Name</TableColumn>
				</TableRow>
			</TableHeader>
			<TableBody>
				{data.nodes.map(n => <ContentRow key={n.id} node={n} onClick={() => this.go(`/content/${n.id}`)} />)}
			</TableBody>
		</DataTable>
		<FloatingButton
			primary
			fixed
			tooltipPosition="top"
			tooltipLabel="Add Type"
		>add</FloatingButton>
	</div>
);

const ErrorPane = ({err}) => (
	<div>Error {err}</div>
);

const Home = () => (
	<div>HOMEY</div>
);

class SelectApp extends Component {

	static propTypes = {
		onCreate: PropTypes.func.isRequired,
		onStartSession: PropTypes.func.isRequired,
		apps: PropTypes.arrayOf(PropTypes.string),
	}

	state = {tab:0}

	_submit = (e) => {
		if( e.preventDefault ){
			e.preventDefault();
		}
		this.props.onCreate({
			id: this.state.appID
		})
	}

	_select = (id) => {
		this.props.onStartSession({id})
	}

	_onChangeAppID = (v) => {
		this.setState({appID: v})
	}

	_setTab = (idx) => {
		this.setState({tab: idx})
	}

	renderActions(){
		let cancel;
		if( this.props.onCancel ){
			cancel = <FlatButton type="submit" className="md-toolbar-item" primary label="Create" onClick={this._submit}/>;
		}
		return <div style={{marginLeft:'auto'}}>
			<FlatButton type="submit" className="md-toolbar-item" primary label="Create" onClick={this._submit}/>
			{cancel}
		</div>;
	}

	renderCreateTab(){
		return <div>
			<p style={{margin:20}}>
				Create a new application.
			</p>
			<div>
				<TextField fullWidth label="Site Name" value={this.state.appID} onChange={this._onChangeAppID} />
			</div>
			<div>
				<Toolbar primary={false} actionsRight={this.renderActions()} />
			</div>
		</div>;
	}

	renderSelectTab(){
		let apps = this.props.apps;
		if( !apps || apps.length == 0 ){
			return <div style={{margin:30}}>
				<p>You do not currently have any sites. Click on the 'new' tab</p>
			</div>;
		}
		return <List>
			{apps.map(id => <ListItem key={id} primaryText={id} onClick={this._select.bind(this,id)} />)}
		</List>;
	}

	renderTab(){
		if( this.state.tab == 0 ){
			console.log(this.state);
			return this.renderSelectTab();
		}
		return this.renderCreateTab();
	}

	render(){
		return <form className="md-card-list" onSubmit={this._submit}>
			<Dialog isOpen close={() => {}} modal>
				<Tabs centered fixedWidth primary>
					<Tab label="Open Site" icon={<FontIcon>collections</FontIcon>} onChange={this._setTab} />
					<Tab label="Create Site" icon={<FontIcon>edit</FontIcon>} onChange={this._setTab} />
				</Tabs>
				{this.renderTab()}
			</Dialog>
		</form>;
	}

}

class Connection extends Component {

	static propTypes = {
		userToken: PropTypes.string.isRequired,
		sessionToken: PropTypes.string,
	}

	state = {user: null}

	componentDidMount(){
		this.refresh();
	}

	refresh(){
		let userToken = this.props.userToken;
		let sessionToken = this.props.sessionToken;
		return client.getUser({userToken}).then((u) => {
			this.setState({user: u})
		}).then((u) => {
			if( sessionToken ){
				return client.connectSession({sessionToken})
					.then(this._onConnect)
			}
		}).catch(err => {
			this.addToast(err);
		})
	}

	getApps(){
		let u = this.state.user;
		let apps = u && u.apps ? u.apps : [];
		return Object.keys(apps.reduce((as,a) => {
			as[a.id] = a;
			return as;
		},{}));
	}

	_onConnect = (conn) => {
		this.setState({conn})
	}

	_createApp = ({id}) => {
		return client.createApp({
			userToken: this.props.userToken,
			id,
		}).then(() => {
			return this.refresh()
		}).then(() => {
			return this._startSession({id})
		}).catch(err => {
			this.addToast(`Failed to create app: ${err.message}`);
		})
	}

	_closeSession = () => {
		// return client.closeSession({
		// 	sessionToken: this.state.sessionToken
		// })
		this.setState({conn: null});
	}

	_startSession = ({id}) => {
		return client.createSession({
			appID: id,
			userToken: this.props.userToken,
		})
		.then(({sessionToken}) => {
			return client.connectSession({sessionToken}).then(conn => {
				localStorage.setItem('sessionToken', sessionToken);
				return conn;
			})
		})
		.then(this._onConnect)
		.catch(err => {
			this.addToast(`Failed to create session: ${err.message}`);
		})
	}

	render(){
		let user = this.state.user;
		if( !user ){
			return <div>fetching apps</div>;
		}
		if( this.state.conn ){
			return <App conn={this.state.conn} onCloseSession={this._closeSession}>
				{this.props.children}
			</App>;
		}
		return <SelectApp apps={this.getApps()} onStartSession={this._startSession} onCreate={this._createApp}/>
	}
}

class Session extends Component {

	static propTypes = {
		userToken: PropTypes.string,
		sessionToken: PropTypes.string,
	}

	state = {userToken: null, tab:0}

	getUserToken(){
		return this.props.userToken || this.state.userToken;
	}

	setUserToken(userToken){
		localStorage.setItem('userToken', userToken);
		this.setState({userToken});
	}

	setError(msg){
		this.addToast(msg);
	}

	_login = (e) => {
		if( e.preventDefault ){
			e.preventDefault();
		}
		client.authenticate({
			id: this.state.username,
			password: this.state.password,
		}).then(({userToken}) => {
			this.setUserToken(userToken);
		}).catch(err => {
			this.setError(`Authentication failed: ${err.message}`)
		})
	}

	_register = (e) => {
		if( e.preventDefault ){
			e.preventDefault();
		}
		client.register({
			id: this.state.username,
			email: this.state.email,
			password: this.state.password,
		}).then(({userToken}) => {
			return client.createApp({
				userToken,
				id: this.state.appID,
			}).catch(err => {
				this.setError(`Failed to create app: ${err.message}`);
			}).then(() => {
				this.setUserToken(userToken);
			})
		}).catch(err => {
			this.setError(`Login failed: ${err.message}`)
		})
	}

	_onChangeUsername = (v) => {
		this.setState({username: v})
	}

	_onChangePassword = (v) => {
		this.setState({password: v})
	}

	_onChangeEmail = (v) => {
		this.setState({email: v})
	}

	_onChangeAppID = (v) => {
		this.setState({appID: v})
	}

	_setTab = (idx) => {
		this.setState({tab: idx})
	}

	renderLoginForm(){
		let actions = <div style={{marginLeft:'auto'}}>
			<FlatButton type="submit" className="md-toolbar-item" primary label="Login" onClick={this._login}/>
		</div>;
		return <form onSubmit={this._login}>
			<div>
				<TextField label="Username" fullWidth value={this.state.username} onChange={this._onChangeUsername} />
			</div>
			<div>
				<TextField label="Password" rightIcon={<i></i>} fullWidth errorText={this.state.loginError} type="password" value={this.state.password} onChange={this._onChangePassword} />
			</div>
			<div>
				<Toolbar primary={false} actionsRight={actions} />
			</div>
		</form>;
	}

	renderRegisterForm(){
		let actions = <div style={{marginLeft:'auto'}}>
			<FlatButton type="submit" className="md-toolbar-item" primary label="Register Now" onClick={this._register}/>
		</div>;
		return <div>
			<div>
				<TextField fullWidth label="Username" value={this.state.username} onChange={this._onChangeUsername} />
			</div>
			<div>
				<TextField fullWidth label="Password" rightIcon={<i></i>} type="password" value={this.state.password} onChange={this._onChangePassword} />
			</div>
			<div>
				<TextField fullWidth label="Email" value={this.state.email} onChange={this._onChangeEmail} />
			</div>
			<div>
				<TextField fullWidth label="Site Name" value={this.state.appID} onChange={this._onChangeAppID} />
			</div>
			<div>
				<Toolbar primary={false} actionsRight={actions} />
			</div>
		</div>;
	}

	renderForm(){
		return this.state.tab == 0 ?
			this.renderLoginForm() :
			this.renderRegisterForm();
	}

	renderLoginDialog(){
		return <div className="md-card-list">
			<Dialog isOpen close={() => {}} modal>
				<Tabs centered fixedWidth primary>
					<Tab label="Login" icon={<FontIcon>face</FontIcon>} onChange={this._setTab} />
					<Tab label="Register" icon={<FontIcon>edit</FontIcon>} onChange={this._setTab} />
				</Tabs>
				{this.renderForm()}
			</Dialog>
		</div>;
	}

	render(){
		let token = this.getUserToken();
		if( !token ){
			return this.renderLoginDialog();
		}
		return <Connection sessionToken={this.props.sessionToken} userToken={token}>{this.props.children}</Connection>;
	}
}

// the app "chrome" is the global stuff that every component has available
// stuff like error message displays, dialogs etc
class Chrome extends React.Component {

	static childContextTypes = {
		base: PropTypes.object,
	};

	getChildContext(){
		return {
			base: this,
		}
	}

	state = {toasts: []}

	_dismissToast = () => {
		const toasts = this.state.toasts.slice();
		toasts.shift();
		this.setState({ toasts });
	}

	addToast(msg, action){
		if( !msg ){
			return;
		}
		if( msg.message ){
			msg = msg.message;
		}
		console.error('TOAST', msg);
		const toasts = this.state.toasts.slice();
		toasts.push({
			key: Date.now(),
			text: msg,
			action,
		});
		this.setState({toasts});
	}

	render(){
		return <div>
			<Session userToken={this.props.route.userToken} sessionToken={this.props.route.sessionToken}>
				{this.props.children}
			</Session>
			<Snackbar
				toasts={this.state.toasts}
				dismiss={this._dismissToast}
				autohide={true}
			/>
		</div>;
	}
}

const AppRouter = (props) => <Router history={browserHistory}>
	<Route path="/" {...props} component={Chrome}>
		<IndexRoute component={Home}/>
		<Route path="types" component={TypesPane}/>
		<Route path="types/:name" component={TypeEditPane}/>
		<Route path="content" component={ContentPane}/>
		<Route path="content/:id" component={ContentEditPane}/>
	</Route>
</Router>;

let localUserToken = localStorage.getItem('userToken');
let localSessionToken = localStorage.getItem('sessionToken');
render(<AppRouter userToken={localUserToken} sessionToken={localSessionToken} />, document.getElementById('app'))
