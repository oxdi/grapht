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
	Card, CardTitle, CardMedia,
	LinearProgress,
	TableRow,TableColumn,TableHeader,TableBody,DataTable,
	Tabs,
	Tab,
	Snackbar,
	List, ListItem,
	NavigationDrawer,
	Paper,
	CircularProgress,
	Subheader,
	Divider,
} from 'react-md';
import {
	ExpansionPanel,
	ExpansionList
} from 'react-md/lib/ExpansionPanels';
import SelectField from 'react-md/lib/SelectFields';

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

const FloatingAddButton = (props) => <FloatingButton
	style={{position:'absolute'}}
	primary
	fixed
	tooltipPosition="top"
	{...props}
>add</FloatingButton>;

class Component extends React.Component {

	static contextTypes = {
		addToast: PropTypes.func.isRequired,
		router: PropTypes.object,
		conn: PropTypes.object,
		mobile: PropTypes.bool.isRequired,
		tablet: PropTypes.bool.isRequired,
		desktop: PropTypes.bool.isRequired,
	}

	state = {data:null}

	componentDidMount(){
		this.subscribe();
	}

	componentWillUnmount() {
		this.unsubscribe();
	}

	componentWillReceiveProps(nextProps){
		if( nextProps.conn != this.props.conn ){
			this.subscribe();
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

	getQuery(){
		return this.props.query;
	}

	unsubscribe(){
		let conn = this.conn();
		if( !conn ){
			return;
		}
		conn.unsubscribe('main')
			.catch(err => this.addToast(err))
	}

	subscribe(){
		let query = this.getQuery();
		if( !query ){
			return;
		}
		let conn = this.conn();
		if( !conn ){
			return;
		}
		return conn.subscribe('main', query).then((query) => {
			query.on('data', this._onQueryData);
			query.on('error', this._onQueryError);
		}).catch((err) => {
			this.addToast(err);
		})
		console.log('subscribe', query);
	}

	_onQueryData = (data) => {
		console.log(this, 'incoming data', data);
		this.setState({data});
	}

	_onQueryError = (err) => {
		this.addToast(err);
	}

	addToast(err,action){
		this.context.addToast(err, action);
	}

	go(path, params){
		this.context.router.push(path);
	}

	store(tx){
		let conn = this.conn();
		let res = tx(conn).then(() => {
			return conn.commit();
		})
		res.catch(err => {
			this.addToast(err);
		});
		return res;
	}

	conn(){
		return this.context.conn;
	}

}

class App extends Component {

	state = {data: null, preview:true}

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

	sidebarIsOverlay(){
		return this.isMobile() || this.isTablet();
	}

	sidebarIsVisible(){
		return this.state.sidebar;
	}

	previewIsVisible(){
		// force hide if screen too small for preview
		if( this.isMobile() ){
			return false;
		}
		return this.state.preview;
	}

	_toggleSidebar = () => {
		let sidebar = !this.state.sidebar;
		this.setState({sidebar});
	}

	_togglePreview = () => {
		let preview = !this.state.preview;
		this.setState({preview});
	}

	_captureClick = () => {
		if( !this.sidebarIsOverlay() ){
			return;
		}
		if( this.state.sidebar ){
			this.setState({sidebar: false});
		}
	}

	_clickTypes = () => {
		this.go('/types')
	}

	_clickContent = (type) => {
		this.go(`/types/${type.name}/nodes`)
	}

	styles(){
		let styles = {
			container: {
				display: 'flex',
				position: 'absolute',
				top: 0,
				bottom: 0,
				right: 0,
				left: 0,
				transition: 'all 0.3s cubic-bezier(.25,.8,.25,1)',
			},
			sidebar: {
				position: 'relative',
				flex: '0 0 258px',
				width: 258,
				backgroundColor: '#fff',
				zIndex: 3,
				borderRight: '1px #ccc',
				borderTopRightRadius: 2,
				borderBottomRightRadius: 2,
				transition: 'all 0.3s cubic-bezier(.25,.8,.25,1)',
				boxShadow: '0 0 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)',
			},
			main: {
				position: 'relative',
				backgroundColor: '#fff',
				flex: '0 0 320px',
				zIndex: 2,
				borderRight: '1px #ccc',
				borderTopRightRadius: 2,
				borderBottomRightRadius: 2,
				transition: 'all 0.3s cubic-bezier(.25,.8,.25,1)',
				boxShadow: '0 0 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)',
			},
			preview: {
				position: 'relative',
				backgroundColor: '#fff',
				flex: '1',
				zIndex: 1,
				transition: 'all 0.3s cubic-bezier(.25,.8,.25,1)',
			},
			clip: {
				position: 'absolute',
				top:0,
				right:0,
				bottom:0,
				left:0,
				overflow: 'hidden',
			}
		}
		// modify styles for when sidebar is an overlay (mobile)
		if( this.sidebarIsOverlay() ){
			// mobile sidebar floats over main pane
			styles.sidebar = Object.assign(styles.sidebar,{
				position: 'absolute',
				flex: 'none',
				left: 0,
				top: 0,
				bottom: 0,
			});
		}
		// modifiy styles for when sidebar is hidden
		if( !this.sidebarIsVisible() ){
			styles.sidebar.boxShadow = 'none';
			if( this.sidebarIsOverlay() ){
				styles.sidebar = Object.assign(styles.sidebar,{
					left: -258,
				});
			} else {
				styles.container = Object.assign(styles.container,{
					left: -258,
				});
			}
		}
		// hide preview
		if( !this.previewIsVisible() ){
			styles.preview = Object.assign(styles.preview,{
				display: 'none',
			});
			styles.main = Object.assign(styles.main,{
				flex: 1,
			});
		}
		return styles;
	}

	render(){
		if( !this.state.data ){
			return <CircularProgress />;
		}
		let section = this.props.children ? React.cloneElement(this.props.children,{
			onToggleSidebar: this._toggleSidebar,
			onTogglePreview: this._togglePreview,
		}) : <div>NO CHILD</div>;
		let styles = this.styles();
		return <div style={styles.container}>
			<div style={styles.sidebar}>
				<div style={styles.clip}>
					<List>
						<ListItem primaryText="Content" leftIcon={<FontIcon>collections</FontIcon>} initiallyOpen={true} nestedItems={this.state.data.types.map(t =>
							<ListItem key={t.name} primaryText={t.name} onClick={this._clickContent.bind(this, t)} />
						)} />
						<ListItem primaryText="Settings" leftIcon={<FontIcon>settings</FontIcon>} initiallyOpen={false} nestedItems={[
							<ListItem key="types" primaryText="Types" onClick={this._clickTypes} />,
						]} />
						<ListItem primaryText="History" leftIcon={<FontIcon>restore</FontIcon>} />
						<ListItem primaryText="Logout" leftIcon={<FontIcon>exit_to_app</FontIcon>} onClick={this._logout} />
						<ListItem primaryText="Switch App" leftIcon={<FontIcon>shuffle</FontIcon>} onClick={this._closeSession} />
					</List>
				</div>
			</div>
			<div style={styles.main} onClickCapture={this._captureClick}>
				{section}
			</div>
			<div style={styles.preview} onClickCapture={this._captureClick}>
				<div>iframe</div>
			</div>
		</div>;
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
		this.go(`/nodes/${this.state.node.id}`);
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

class FieldExpansionPanel extends React.Component {

	static propTypes = {
		field: PropTypes.object.isRequired,
		onChange: PropTypes.func.isRequired,
	}

	state = {}

	_onSave = () => {
		let field = this.getField();
		this.props.onChange(this.props.field, field);
	}

	_setName = (name) => {
		this.setState({name});
	}

	_setType = (type) => {
		this.setState({type});
	}

	getField(){
		return Object.assign({}, this.props.field, this.state)
	}

	render(){
		let field = this.getField();
		return (
			<ExpansionPanel
				label={field.name}
				secondaryLabel={[
					field.type,
				]}
				onSave={this._onSave}
			>
				<form>
					<div>
						<TextField
							ref="name"
							label="Name"
							value={field.name}
							onChange={this._setName}
							fullWidth
							helpText="The name of the field"
						/>
					</div>
					<div>
						<SelectField
							ref="type"
							label="Type"
							value={field.type}
							onChange={this._setType}
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

const Scroll = (props) => {
	let style = {
		position: 'absolute',
		top:0,
		left:0,
		bottom:0,
		right:0,
		overflow: 'scroll',
	};
	return <div style={style}>
		{props.children}
	</div>;
}


class TypeEditPane extends Component {

	static propTypes = {
		onToggleSidebar: PropTypes.func,
		onTogglePreview: PropTypes.func,
	}

	static title = 'Edit Type';

	state = {}

	isNew(){
		return this.props.route.isNew
	}

	getQuery(){
		if( this.isNew() ){
			return;
		}
		let name = this.props.params.name;
		if( !name || name == 'new' ){
			return
		}
		return `
			type(name:"${name}"){
				name
				fields {
					name
					type
				}
			}
		`;
	}

	getType(){
		let existing = this.state.data ? this.state.data.type || {} : {};
		let modified = this.state.type || {};
		return Object.assign({fields:[]}, existing, modified);
	}

	_clickAdd = () => {
		let merged = this.getType();
		let modified = this.state.type || {};
		let type = Object.assign({}, modified, {
			fields: merged.fields.concat({
				name: `newField${merged.fields.length+1}`,
				type: 'Text',
			}),
		});
		this.setState({type});
	}

	_setField = (oldField, newField) => {
		let merged = this.getType();
		let modified = this.state.type || {};
		let type = Object.assign({}, modified, {
			fields: merged.fields.slice().map(f => {
				if( f.name == oldField.name ){
					return newField;
				}
				return f;
			})
		});
		this.setState({type});
	}

	_save = () => {
		let type = this.getType();
		this.store(conn => {
			return conn.setType(type);
		}).then(() => {
			this.go('/types');
		})
	}

	_setName = (name) => {
		let modified = this.state.type || {};
		let type = Object.assign({}, modified, {
			name: name
		})
		this.setState({type});
	}

	render(){
		if( !this.isNew() && !this.state.data ){
			return <CircularProgress />;
		}
		let type = this.getType();
		return (
			<div style={{margin:40}}>
				<Scroll>
					<Toolbar
						actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
						title="Edit Type"
						actionsRight={<div style={{marginLeft:'auto'}}>
							<IconButton onClick={this._save}>done</IconButton>
						</div>}
					/>
					<div>
						<TextField
							ref="name"
							label="Name"
							block
							value={type.name}
							onChange={this._setName}
							fullWidth
							helpText="The name of the type"
						/>
					</div>
					<Divider />
					<List>
						<Subheader primaryText="Fields" />
					</List>
					<ExpansionList>
						{type.fields.map(f => <FieldExpansionPanel key={`${type.name}__${f.name}`} field={f} onChange={this._setField} />)}
					</ExpansionList>
					<div style={{height:80}}> </div>
				</Scroll>
				<FloatingAddButton onClick={this._clickAdd} />
			</div>
		);
	}
}

class TypesPane extends Component {

	static title = 'Types'

	getQuery(){
		return `
			types {
				name
				fields {
					name
					type
				}
			}
		`
	}

	_clickAdd = () => {
		this.go('/types/new');
	}

	typeItem(t){
		return <ListItem
			key={t.name}
			leftIcon={<FontIcon>assignment</FontIcon>}
			primaryText={t.name}
			secondaryText="Custom Type"
			onClick={() => this.go(`/types/${t.name}`)}
		/>
	}


	render(){
		if( !this.state.data ){
			return <CircularProgress />;
		}
		let data = this.state.data;
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title="Types"
				/>
				<List>
					{data.types.map(t => this.typeItem(t) )}
				</List>
			</Scroll>
			<FloatingAddButton onClick={this._clickAdd} />
		</div>
	}
}

const TextAttr = ({node,field,attr,onChange}) => {
	return (
		<TextField
			label={field.name}
			value={attr.value}
			onChange={(v) => onChange({name:field.name,value:v,encoding:'string'})}
			fullWidth
			helpText={field.hint}
		/>
	)
}

const BooleanAttr = ({node,field,attr,onChange}) => {
	let on = false;
       	if( attr ){
		on = attr.value === true ||
			attr.value === 1 ||
			(/^(true|yes|y|t|on)$/i).test((attr.value || '').toString());
	}
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

class ImageAttr extends PureComponent {
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
		let value = this.props.attr ? this.props.attr.value : '';
		let img;
		if( this.props.value ){
			img = <UploadedImageCard url={value} />;
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

class Attr extends React.Component {
	render(){
		switch( this.props.field.type ){
		case 'Text':      return <TextAttr {...this.props} />;
		case 'Int':       return <TextAttr {...this.props} type="number" />;
		case 'Float':     return <TextAttr {...this.props} type="number" />;
		case 'Boolean':   return <BooleanAttr {...this.props} />;
		case 'Image':     return <ImageAttr {...this.props} />;
		// TODO: HasOne, Collections
		default:          return <div>UNKNOWN FIELD TYPE {this.props.field.type}</div>;
		}
	}
}

class NodeEditPane extends Component {

	state = {attrs: {}}

	isNew(){
		return !!this.props.route.isNew;
	}

	getID(){
		if( this.state.id ){
			return this.state.id;
		}
		let id = this.props.params.id;
		if( id == 'new' ){
			return;
		}
		return;
	}

	getTypeName(){
		return this.props.params.name;
	}

	getQuery(){
		let q = '';
		let type = this.getTypeName();
		let typeFragment = `
			name
			fields {
				name
				type
			}
		`;
		if( type ){
			q = `${q}
				type(name:"${type}"){
					${typeFragment}
				}
			`;
		}
		if( !this.isNew() ){
			q += `${q}
				node(id:"${this.getID()}"){
					id
					type {
						${typeFragment}
					}
					attrs {
						name
						value
						encoding
					}
				}
			`
		}
		if( !q ){
			console.error('no query for NodeEdit');
		}
		return q;
	}

	getNode(){
		let node = this.state.data.node || {attrs:[]};
		let mergedNode = Object.assign({}, node);
		let type = this.state.data.type;
		if( type ){
			mergedNode.type = type;
		}
		// merge any pending attrs
		let existingValues = node.attrs.reduce((attrs, attr) => {
			attrs[attr.name] = attr;
			return attrs;
		},{});
		let pendingValues = this.state.attrs;
		let mergedValues = Object.assign({}, existingValues, pendingValues);
		mergedNode.attrs = Object.keys(mergedValues).map(k => mergedValues[k]);
		// return merged node
		return mergedNode;
	}

	getAttr(node, name){
		let attr = node.attrs.find(attr => attr.name == name);
		return attr || {};
	}

	_setAttr = (attr) => {
		console.log('_setAttr', attr);
		if( !attr ){
			return;
		}
		if( !attr.name ){
			console.error('_setAttr: missing attr.name');
			return;
		}
		if( !attr.value ){
			console.error('_setAttr: missing attr.name');
			return;
		}
		let attrs = Object.assign({}, this.state.attrs, {
			[attr.name]: attr
		});
		this.setState({attrs})
	}

	_save = () => {
		this.store(conn => {
			let values = {
				id: this.isNew() ? uuid.v4() : this.getID(),
				attrs: Object.keys(this.state.attrs).reduce((attrs,attr) => {
					attrs.push(attr);
					return attrs;
				},[]),
			};
			return this.isNew() ?
				conn.setNode(values) :
				conn.mergeNode(values);
		}).then(() => {
			this.go(`/nodes/${id}`)
		})
	}

	render(){
		if( !this.state.data ){
			return <CircularProgress />;
		}
		let node = this.getNode();
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title={node.name || `New ${node.type.name}`}
					actionsRight={<div style={{marginLeft:'auto'}}>
						<IconButton onClick={this._save}>done</IconButton>
					</div>}
				/>
				<div style={{margin:40}}>
					<div className="md-card-list">
						{node.type.fields.map(f =>
							<Card key={f.name}>
								<div style={{margin:20}}>
									<Attr ref={f.name} node={node} field={f} attr={this.getAttr(node,f.name)} onChange={this._setAttr} />
								</div>
							</Card>
						)}
					</div>
				</div>
			</Scroll>
		</div>
	}
}

class NodeListPane extends Component {

	static propTypes = {
		params: PropTypes.object.isRequired,
		onToggleSidebar: PropTypes.func,
	}

	getTypeName(){
		return this.props.type || this.props.params.name;
	}

	getQuery(){
		let typeName = this.getTypeName();
		if( !typeName ){
			console.error('no type name')
			return
		}
		return `
			type(name:"${typeName}"){
				name
				fields {
					name
				}
			}
			nodes(type:${typeName}){
				id
				attrs {
					name
					value
				}
			}
		`;
	}

	attr(node,fieldName){
		let attr = node.attrs.find(attr => attr.name == fieldName);
		if( !attr ){
			return
		}
		return attr.value;
	}

	_clickAdd = () => {
		this.go(`/types/${this.getTypeName()}/nodes/new`)
	}

	_clickRow = (node) => {
		this.go(`/nodes/${node.id}`)
	}

	render(){
		if( !this.state.data ){
			return <CircularProgress />
		}
		let type = this.state.data.type;
		let nodes = this.state.data.nodes;
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title={type.name}
					actionsRight={<div style={{marginLeft:'auto'}}>
						<IconButton onClick={this._save}>done</IconButton>
					</div>}
				/>
				<DataTable>
					<TableHeader>
						<TableRow>
							<TableColumn>ID</TableColumn>
							{type.fields.map(f =>
								<TableColumn ref={f.name}>{f.name}</TableColumn>
							)}
						</TableRow>
					</TableHeader>
					<TableBody>
						{nodes.map(n =>
							<TableRow ref={n.id} onClick={this._clickRow.bind(this, n)}>
								<TableColumn>{n.id}</TableColumn>
								{type.fields.map(f =>
									<TableColumn ref={f.name}>{this.attr(n,f.name)}</TableColumn>
								)}
							</TableRow>
						)}
					</TableBody>
				</DataTable>
			</Scroll>
			<FloatingAddButton onClick={this._clickAdd} />
		</div>;
	}
}

const ErrorPane = ({err}) => (
	<div>Error {err}</div>
);

const Home = () => (
	<div>HOMEY</div>
);
Home.title = "Home";

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

	static childContextTypes = {
		conn: PropTypes.object,
	}

	state = {user: null}

	componentDidMount(){
		this.refreshApps();
	}

	refreshApps(){
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

	getChildContext(){
		return {
			conn: this.state.conn
		}
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
			return this.refreshApps()
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
			return <CircularProgress />;
		}
		if( this.state.conn ){
			return <App onCloseSession={this._closeSession}>
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

// the app "chrome" sets up the context for the app
// stuff like error message displays, dialogs, breakpoints etc
class Chrome extends React.Component {

	static childContextTypes = {
		addToast: PropTypes.func.isRequired,
		mobile: PropTypes.bool.isRequired,
		tablet: PropTypes.bool.isRequired,
		desktop: PropTypes.bool.isRequired,
	};

	state = {toasts: []}

	componentWillUnmount() {
		if( this.unlisten ){
			this.unlisten.forEach(fn => fn());
			this.unlisten = null;
		}
	}

	componentDidMount(){
		const mq = {
			mobile: window.matchMedia(`(min-width: 0px) and (max-width: 400px)`),
			tablet: window.matchMedia(`(min-width: 400px) and (max-width: 800px)`),
			desktop: window.matchMedia(`(min-width: 800px)`),
		};
		this.unlisten = Object.keys(mq).map(name => {
			let fn = () => {
				this.setState({ [name]: mq[name].matches });
			};
			fn();
			mq[name].addListener(fn);
			return () => {
				mq[name].removeListener(fn);
			}
		})
	}

	getChildContext(){
		return {
			addToast: this._addToast,
			mobile: !!this.state.mobile,
			tablet: !!this.state.tablet,
			desktop: !!this.state.desktop,
		}
	}


	_dismissToast = () => {
		const toasts = this.state.toasts.slice();
		toasts.shift();
		this.setState({ toasts });
	}

	_addToast = (msg, action) => {
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
		<Route path="types/new" isNew={true} component={TypeEditPane}/>
		<Route path="types/:name" component={TypeEditPane}/>
		<Route path="types/:name/nodes" component={NodeListPane}/>
		<Route path="types/:name/nodes/new" isNew={true} component={NodeEditPane}/>
		<Route path="nodes/:id" component={NodeEditPane}/>
	</Route>
</Router>;

let localUserToken = localStorage.getItem('userToken');
let localSessionToken = localStorage.getItem('sessionToken');
render(<AppRouter userToken={localUserToken} sessionToken={localSessionToken} />, document.getElementById('app'))

