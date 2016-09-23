import React from 'react';
import {PureComponent,PropTypes} from 'react';
import CSSTransitionGroup from 'react-addons-css-transition-group';
import classnames from 'classnames';
import { render } from 'react-dom';
import { Router, Route, Link, browserHistory, IndexRoute } from 'react-router'
import WebFont from 'webfontloader';
import uuid from 'node-uuid';

const MAIN_WIDTH = 380;
const FIELD_FRAGMENT = `
	name
	type
	required
	edgeName
	edgeToType
	textMarkup
	textLines
	textLineLimit
	textCharLimit
	hint
	friendlyName
	unit
`;

import {
	IconButton,
	FlatButton,
	FloatingButton,
	RaisedButton,
	FontIcon,
	Dialog,
	Avatar,
	Chip,
	Toolbar,
	TextField,
	Switch,
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
import Autocomplete from 'react-md/lib/Autocompletes';

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
	// 'BcryptText',
	'HasOne',
	'HasMany',
	'DataTable',
	'File',
	'Image',
];

import UNITS from './units';
const BASE_UNITS = ['none'].concat(UNITS.sections["SI Base Units"].map(o => o.val));

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

window.conns = 0;
class Component extends React.Component {

	static contextTypes = {
		userToken: PropTypes.string.isRequired,
		appID: PropTypes.string.isRequired,
		onError: PropTypes.func.isRequired,
		router: PropTypes.object.isRequired,
		mobile: PropTypes.bool.isRequired,
		tablet: PropTypes.bool.isRequired,
		desktop: PropTypes.bool.isRequired,
	}

	state = {}

	componentDidMount(){
		this.subscribe();
	}

	componentWillUnmount() {
		this.conn().then(conn => {
			conn.unsubscribe('main');
			console.log(this.constructor.name, 'unsubscribed and disconnected')
			window.conns--;
			return conn.close();
		})
	}

	componentWillReceiveProps(nextProps,nextContext){
		// TODO: fix this! react-router is being a PITA
		if( this.antiRouterHack ){
			this.unsubscribe().then(() => this.subscribe())
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
		return;
	}

	unsubscribe(){
		if( !this.state.query ){
			return Promise.resolve();
		}
		return this.conn()
			.then(this._unsubscribe)
			.catch(this._onError)
	}

	subscribe(){
		let q = this.getQuery();
		if( !q ){
			return Promise.resolve();
		}
		return this.conn()
			.then(this._subscribe)
			.catch(this._onError)
	}

	go(path, params){
		this.context.router.push(path);
	}

	store(tx){
		let res = this.conn()
			.then(conn => tx(conn).then(() => conn.commit()));
		res.catch(this._onError);
		return res;
	}

	conn(){
		if( this._conn ){
			return this._conn.catch(this._toast);
		}
		this._conn = client.connect({
			userToken: this.context.userToken,
			appID: this.context.appID,
		}).then((conn) => {
			console.log(this.constructor.name, 'connected');
			window.conns++;
			return conn;
		}).catch(this._onError)
		return this._conn;
	}

	_unsubscribe = (conn) => {
		return conn.unsubscribe('main')
			.then(this._onUnsubscribe)
			.catch(this._onError)
	}

	_onUnsubscribe = () => {
		console.log(this.constructor.name, 'unsubscribed');
		this.setState({query:null,data:null});
	}


	_subscribe = (conn) => {
		let q = this.getQuery();
		return conn.subscribe('main', q)
			.then(this._onSubscribe)
			.catch(this._onError)
	}

	_onSubscribe = (query) => {
		query.on('data', this._onQueryData);
		query.on('error', this._onQueryError);
		this.setState({query})
		console.log(this.constructor.name, 'subscribed');

	}

	_onQueryData = (data) => {
		console.log(this.constructor.name, 'incoming data', data);
		this.setState({data});
	}

	_onQueryError = (err) => {
		this._onError(err)
	}

	_onError = (err,action) => {
		this.context.onError(err, action);
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

class AppLayout extends Component {

	static propTypes = {
		sidebar: PropTypes.node.isRequired,
		children: PropTypes.node.isRequired,
		preview: PropTypes.node,
	}

	state = {preview:true}

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
				flex: `0 0 ${MAIN_WIDTH}px`,
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
		let main = this.props.children ? React.cloneElement(this.props.children,{
			onToggleSidebar: this._toggleSidebar,
			onTogglePreview: this._togglePreview,
		}) : <div>NO CHILD</div>;
		let styles = this.styles();
		return <div style={styles.container}>
			<div style={styles.sidebar}>
				{this.props.sidebar}
			</div>
			<div style={styles.main} onClickCapture={this._captureClick}>
				{main}
			</div>
			<div style={styles.preview} onClickCapture={this._captureClick}>
				{this.props.preview}
			</div>
		</div>;
	}
}

class AppSidebar extends Component {

	static propTypes = {
		onClickLogout: PropTypes.func.isRequired,
		onClickClose: PropTypes.func.isRequired,
	}

	getQuery(){
		return `
			types {
				name
			}
		`
	}

	_clickLogout = () => {
		this.props.onClickLogout()
	}

	_clickClose = () => {
		this.props.onClickClose()
	}

	_clickTypes = () => {
		this.go('/types')
	}

	_clickContent = (type) => {
		this.go(`/types/${type.name}/nodes`)
	}

	render(){
		if( !this.state.data ){
			return <CircularProgress />;
		}
		return <Scroll>
			<List>
				<ListItem primaryText="Content" leftIcon={<FontIcon>collections</FontIcon>} initiallyOpen={true} nestedItems={this.state.data.types.map(t =>
					<ListItem key={t.name} primaryText={t.name} onClick={this._clickContent.bind(this, t)} />
				)} />
				<ListItem primaryText="Settings" leftIcon={<FontIcon>settings</FontIcon>} initiallyOpen={false} nestedItems={[
					<ListItem key="types" primaryText="Types" onClick={this._clickTypes} />,
				]} />
				<ListItem primaryText="History" leftIcon={<FontIcon>restore</FontIcon>} />
				<ListItem primaryText="Logout" leftIcon={<FontIcon>exit_to_app</FontIcon>} onClick={this._clickLogout} />
				<ListItem primaryText="Switch App" leftIcon={<FontIcon>shuffle</FontIcon>} onClick={this._clickClose} />
			</List>
		</Scroll>;
	}
}

class FieldExpansionPanel extends React.Component {

	static propTypes = {
		field: PropTypes.object.isRequired,
		onChange: PropTypes.func.isRequired,
	}

	state = {expanded: false}

	_toggleExpanded = (expanded) => {
		this.setState({expanded})
	}

	_collapse = () => {
		this.setState({expanded:false})
	}

	_setName = (name) => {
		this.setFieldState({name});
	}

	_setRequired = (required) => {
		this.setFieldState({required});
	}

	_setHint = (hint) => {
		this.setFieldState({hint});
	}

	_setType = (type) => {
		this.setFieldState({type});
	}

	_setEdgeName = (edgeName) => {
		this.setFieldState({edgeName});
	}

	_setUnit = (unit) => {
		if( unit == 'none' ){
			unit = '';
		}
		this.setFieldState({unit});
	}

	_setTextCharLimit = (textCharLimit) => {
		this.setFieldState({textCharLimit});
	}

	_setTextLineLimit = (textLineLimit) => {
		this.setFieldState({textLineLimit});
	}

	_setFriendlyName = (friendlyName) => {
		this.setFieldState({friendlyName});
	}

	_setMultiline = (on) => {
		let lines = 5;
		if( this.props.textLines > lines ){
			lines = this.props.textLines;
		}
		this.setFieldState({textLines: on ? lines : 0});
	}

	setFieldState(state){
		let newField = Object.assign({}, this.props.field, state);
		this.props.onChange(this.props.field, newField)
	}

	renderTextOptions(field){
		let lineLimit = field.textLines > 1 ? <div>
			<TextField
				label="Line limt"
				value={field.textLineLimit}
				onChange={this._setTextLineLimit}
				fullWidth
				helpText="Restrict how many lines of text this field can grow to accomodate"
				type="number"
			/>
		</div> : null;
		return <div>
			<div>
				<Switch
					label="Multiline"
					toggled={field.textLines > 1}
					onChange={this._setMultiline}
				/>
			</div>
			{lineLimit}
			<div>
				<TextField
					label="Character limit"
					value={field.textCharLimit}
					onChange={this._setTextCharLimit}
					fullWidth
					helpText="Restrict how much text can go into this field. Set to zero for no limit"
					type="number"
				/>
			</div>
		</div>;
	}

	renderOptions(field){
		switch(field.type){
			case 'Text': return this.renderTextOptions(field);
			default: return;
		}
	}

	render(){
		let field = this.props.field;
		let labels = this.state.expanded ? {} : {
			secondaryLabel: [field.type]
		};
		return (
			<ExpansionPanel
				saveLabel="done"
				onSave={this._collapse}
				onCancel={this._collapse}
				cancelLabel=""
				expanded={this.state.expanded}
				onExpandToggle={this._toggleExpanded}
				label={field.friendlyName || ' '}
				{...labels}
			>
				<form>
					<div>
						<TextField
							label="Name"
							value={field.friendlyName}
							onChange={this._setFriendlyName}
							fullWidth
							helpText="A friendly name for the field to show to humans"
						/>
					</div>
					<div>
						<SelectField
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
					{field.type == "HasOne" || field.type == "HasMany" ? <div>
						<TextField
							label="Edge Name"
							value={field.edgeName || ''}
							onChange={this._setEdgeName}
							fullWidth
							helpText="The name of the connection"
						/>
					</div> : null}
					{this.renderOptions(field)}
					{field.type == "Int" || field.type == "Float" ? <div>
						<SelectField
							label="SI Unit"
							value={field.unit || ''}
							onChange={this._setUnit}
							menuItems={BASE_UNITS}
							adjustMinWidth
							floatingLabel
							fullWidth
						/>
					</div> : null}
					<div>
						<TextField
							label="API field name"
							value={field.name}
							onChange={this._setName}
							fullWidth
							helpText="API field names are seen by machines and developers. They should be camelcase without spaces (wheelsOnBus not wheels_on_bus)"
						/>
					</div>
					<div>
						<Switch
							label="Field is manditory"
							toggled={field.required}
							onChange={this._setRequired}
						/>
					</div>
					<div>
						<TextField
							label="hint"
							value={field.hint || ''}
							onChange={this._setHint}
							fullWidth
							helpText="Helpful text to help guide people filling in the data. Just like this!"
						/>
					</div>
				</form>
			</ExpansionPanel>
		);
	}
}


class TypeEditPane extends Component {

	static propTypes = {
		onToggleSidebar: PropTypes.func,
		onTogglePreview: PropTypes.func,
		route: PropTypes.object,
	}

	static title = 'Edit Type';

	antiRouterHack = true;

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
					${FIELD_FRAGMENT}
				}
			}
		`;
	}

	getType(){
		let existing = this.state.data ? this.state.data.type || {} : {};
		let modified = ehis.state.type || {};
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
			console.log('setType', type);
			return conn.setType(type);
		}).then(() => {
			this.go('/types');
		}).catch(err => {
			// no op
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
						{type.fields.map((f,idx) => <FieldExpansionPanel key={idx} field={f} onChange={this._setField} />)}
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

	antiRouterHack = true;

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

const TextAttr = ({node,field,onSetAttr,type}) => {
	let opts = {};
	if( field.textLines > 1 ){
		opts.rows = field.textLines;
		opts.maxRows = field.textLineLimit > 1 ? field.textLineLimit : -1;
	}
	if( type ){
		opts.type = type;
	}
	let attr = node.attrs.find(attr => attr.name == field.name) || {};
	return (
		<TextField
			onChange={(v) => onSetAttr({name:field.name,value:v,enc:'UTF8'})}
			label={field.friendlyName}
			value={attr.value || ''}
			maxLength={field.textCharLimit}
			fullWidth
			helpText={field.hint}
			required={field.required}
			{...opts}
		/>
	)
}

const BooleanAttr = ({node,field,onSetAttr}) => {
	let attr = node.attrs.find(attr => attr.name == field.name) || {};
	let on = false;
       	if( attr ){
		on = attr.value === true ||
			attr.value === 1 ||
			(/^(true|yes|y|t|on|1)$/i).test((attr.value || '').toString());
	}
	return (
		<Switch
			label={field.friendlyName}
			toggled={on}
			onChange={(v) => onSetAttr({name:field.name,value:v,enc:'UTF8'})} />
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
		this.props.onSetAttr({
			name: this.props.field.name,
			value: uploadResult,
			enc: 'DataURI',
		});

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
		let attr = this.props.node.attrs.find(attr => attr.name == field.name) || {};
		let value = attr || '';
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


class EdgeAttr extends Component {

	static propTypes = {
		node: PropTypes.object.isRequired,
		field: PropTypes.object.isRequired,
		onSetEdge: PropTypes.func.isRequired,
		onRemoveEdge: PropTypes.func.isRequired,
	}

	getQuery(){
		return `
			nodes {
				id
			}
		`
	}

	_remove = (id) => {
		const {node, field} = this.props;
		this.props.onRemoveEdge({
			from: node.id,
			to: id,
			name: field.edgeName,
		})
	}

	_add = (id) => {
		const {node, field} = this.props;
		this.props.onSetEdge({
			from: node.id,
			to: id,
			name: field.edgeName,
		})
	}

	render() {
		const { data } = this.state;
		if( !data ){
			return <CircularProgress />;
		}
		const {node, field} = this.props;
		const ids = node.edges.filter(e => {
			if( e.name != field.edgeName ){ // ignore other edges
				return false;
			}
			return e.from.id == node.id; // only from us to them ...HasMany / outbound
		}).map(e => e.to.id);
		const chips = ids.map(id =>
			<NodeChip key={id} id={id} onRemove={this._remove} />
		);
		return <CSSTransitionGroup
			transitionName="opacity"
			transitionEnterTimeout={150}
			transitionLeaveTimeout={150}
			component="div"
			className="chip-list">
				{chips}
				<Autocomplete
					label="Select a node"
					data={data.nodes}
					dataLabel="id"
					onAutocomplete={this._add}
					clearOnAutocomplete
					fullWidth
					deleteKeys="abbreviation"
				/>
		</CSSTransitionGroup>;
	}
}

export default class NodeChip extends PureComponent {
	static propTypes = {
		id: PropTypes.string.isRequired,
		onRemove: PropTypes.func.isRequired,
	};

	state = {};

	_remove = () => {
		this.props.onRemove(this.props.id);
	};

	render() {
		return <Chip
			label={this.props.id}
			remove={this._remove}
		>
			<Avatar random>{this.props.id.charAt(0)}</Avatar>
		</Chip>;
	}
}

class Attr extends React.Component {

	static propTypes = {
		node: PropTypes.object.isRequired,
		field: PropTypes.object.isRequired,
		onSetEdge: PropTypes.func.isRequired,
		onSetAttr: PropTypes.func.isRequired,
		onRemoveEdge: PropTypes.func.isRequired,
	}

	render(){
		switch( this.props.field.type ){
		case 'Text':      return <TextAttr {...this.props} />;
		case 'Int':       return <TextAttr {...this.props} type="number" />;
		case 'Float':     return <TextAttr {...this.props} type="number" />;
		case 'Boolean':   return <BooleanAttr {...this.props} />;
		case 'Image':     return <ImageAttr {...this.props} />;
		case 'HasOne':
		case 'HasMany':   return <EdgeAttr {...this.props} />;
		default:          return <div>UNKNOWN FIELD TYPE {this.props.field.type}</div>;
		}
	}
}

class NodeEditPane extends Component {

	static propTypes = {
		route: PropTypes.object.isRequired,
		params: PropTypes.object.isRequired,
	}

	render(){
		return <NodeEdit id={this.props.params.id} type={this.props.params.name} />;
	}

}

class NodeEdit extends Component {

	static propTypes = {
		id: PropTypes.string.isRequired,
		type: PropTypes.string.isRequired,
	}

	state = {attrs: {}}

	antiRouterHack = true;

	getQuery(){
		const { id, type } = this.props;
		return `
			type(name:"${type}"){
				name
				fields {
					${FIELD_FRAGMENT}
				}
			}
			node(id:"${id}"){
				id
				attrs {
					name
					value
					enc
				}
				edges {
					to {
						id
					}
					from {
						id
					}
					name
				}
			}
		`
	}

	getNode(){
		return Object.assign({
			id: this.props.id,
			attrs: [],
			edges: [],
		}, this.state.data.node || {}, {
			type: this.state.data.type,
		});
	}

	_setAttr = (attr) => {
		return this.conn().then(conn => conn.mergeNode({
			id: this.props.id,
			type: this.props.type,
			attrs: [attr],
		})).catch(this._onError);
	}

	_setEdge = (edge) => {
		this.conn().then(conn => conn.setEdge(edge));
	}

	_removeEdge = (matcher) => {
		this.conn().then(conn => conn.removeEdges(matcher));
	}

	_save = () => {
		return this.conn()
			.then(conn => conn.commit())
			.then(this._afterSave)
			.catch(this._onError);
	}

	_afterSave = () => {
		let node = this.getNode();
		this.go(`/types/${node.type.name}/nodes`)
	}

	render(){
		if( !this.state.data ){
			return <CircularProgress />;
		}
		let node = this.getNode();
		if( !node.type ){
			return <p>no type</p>;
		}
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title="Edit"
					actionsRight={<div style={{marginLeft:'auto'}}>
						<IconButton onClick={this._save}>done</IconButton>
					</div>}
				/>
				{node.type.fields.map(f =>
					<Attr ref={f.name}
						node={node}
						field={f}
						onSetAttr={this._setAttr}
						onSetEdge={this._setEdge}
						onRemoveEdge={this._removeEdge}
					/>
				)}
			</Scroll>
		</div>
	}
}

class NodeListPane extends Component {

	static propTypes = {
		params: PropTypes.object.isRequired,
		onToggleSidebar: PropTypes.func,
	}

	antiRouterHack = true;

	getTypeName(){
		return this.props.params.name;
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
		this.go(`/types/${this.getTypeName()}/nodes/${uuid.v4()}`)
	}

	_clickRow = (node) => {
		this.go(`/types/${this.getTypeName()}/nodes/${node.id}`)
	}

	render(){
		if( !this.state.data ){
			return <CircularProgress />
		}
		if( !this.state.data.type ){
			return <div>'waiting on type'</div>;
		}
		let type = this.state.data.type;
		let nodes = this.state.data.nodes;
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title={type.name}
					actionsRight={<div ref="right" style={{marginLeft:'auto'}}>
						<IconButton onClick={this._save}>done</IconButton>
					</div>}
				/>
				<DataTable>
					<TableHeader>
						<TableRow>
							<TableColumn>ID</TableColumn>
							<TableColumn>Name</TableColumn>
						</TableRow>
					</TableHeader>
					<TableBody>
						{nodes.map(n =>
							<TableRow ref={n.id} onClick={this._clickRow.bind(this, n)}>
								<TableColumn>{n.id}</TableColumn>
								<TableColumn>someval</TableColumn>
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

class SelectApp extends React.Component {

	static propTypes = {
		userToken: PropTypes.string.isRequired,
		onSelect: PropTypes.func.isRequired,
		onCreate: PropTypes.func.isRequired,
		onError: PropTypes.func.isRequired,
	}

	state = {tab:0}

	componentDidMount(){
		this.fetchApps();
	}

	fetchApps(){
		let userToken = this.props.userToken;
		let sessionToken = this.props.sessionToken;
		return client.getUser({userToken})
			.then(this._load)
			.catch(this._error);
	}

	_load = (user) => {
		let perms = user.apps || [];
		let apps = Object.keys(perms.reduce((as,a) => {
			as[a.id] = a;
			return as;
		},{}));
		this.setState({apps})
	}

	_submit = (e) => {
		if( e.preventDefault ){
			e.preventDefault();
		}
		this.props.onCreate({
			id: this.state.appID
		})
	}

	_select = (id) => {
		this.props.onSelect({id})
	}

	_onChangeAppID = (v) => {
		this.setState({appID: v})
	}

	_setTab = (idx) => {
		this.setState({tab: idx})
	}

	_error = (err) => {
		this.props.onError(err)
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
		if( this.state.apps.length === 0 ){
			return <div style={{margin:30}}>
				<p>You do not currently have any sites. Click on the 'new' tab</p>
			</div>;
		}
		return <List>
			{this.state.apps.map(id => <ListItem key={id} primaryText={id} onClick={this._select.bind(this,id)} />)}
		</List>;
	}

	renderTab(){
		if( this.state.tab == 0 ){
			return this.renderSelectTab();
		} else {
			return this.renderCreateTab();
		}
	}

	render(){
		if( !this.state.apps ){
			return <CircularProgress />;
		}
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

class Login extends React.Component {

	static propTypes = {
		onAuthenticated: PropTypes.func,
		onError: PropTypes.func,
	}

	onAuthenticated(userToken){
		this.props.onAuthenticated(userToken)
	}

	onError(msg){
		this.props.onError(msg);
	}

	_login = (e) => {
		if( e.preventDefault ){
			e.preventDefault();
		}
		client.authenticate({
			id: this.state.username,
			password: this.state.password,
		}).then(({userToken}) => {
			this.onAuthenticated(userToken);
		}).catch(err => {
			this.onError(`Authentication failed: ${err.message}`)
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
				this.onError(`Failed to create app: ${err.message}`);
			}).then(() => {
				this.onAuthenticated(userToken);
			})
		}).catch(err => {
			this.onError(`Login failed: ${err.message}`)
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

	render(){
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

}


class App extends React.Component {

	static propTypes = {
		id: PropTypes.string.isRequired,
		userToken: PropTypes.string.isRequired,
		onClickClose: PropTypes.func.isRequired,
		onClickLogout: PropTypes.func.isRequired,
		onError: PropTypes.func.isRequired,
	}

	static childContextTypes = {
		onError: PropTypes.func.isRequired,
		userToken: PropTypes.string.isRequired,
		appID: PropTypes.string.isRequired,
	}

	getChildContext(){
		return {
			onError: this.props.onError,
			userToken: this.props.userToken,
			appID: this.props.id,
		};
	}

	render(){
		return <AppLayout
			sidebar={<AppSidebar
				onClickClose={this.props.onClickClose}
				onClickLogout={this.props.onClickLogout} />}
			preview={<p>preview</p>}
		>{this.props.children}</AppLayout>;
	}
}

// the app "chrome" sets up the context for the app
// stuff like error message displays, dialogs, breakpoints etc
class Chrome extends React.Component {

	static childContextTypes = {
		mobile: PropTypes.bool.isRequired,
		tablet: PropTypes.bool.isRequired,
		desktop: PropTypes.bool.isRequired,
	};

	constructor(props,...args){
		super(props, ...args);
		this.state = {toasts:[]};
		if( props.route ){
			this.state.userToken = props.route.userToken;
			this.state.appID = props.route.appID;
		}
	}

	componentWillUnmount() {
		if( this.unlisten ){
			this.unlisten.forEach(fn => fn());
			this.unlisten = null;
		}
	}

	// TODO: do this propperly
	// This is currently required as I misunderstood how react-router keeps previously
	// mounted components... the propper way to handle this is to have each Component
	// perform it's own check rather than re-rendering the entire chrome
	componentWillReceiveProps(nextProps){
		if( nextProps.location.pathname != this.props.location.pathname ){
			this.setState({pathname: nextProps.location.pathname});
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

	_toast = (msg, action) => {
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

	_createApp = ({id}) => {
		return client.createApp({
			userToken: this.state.userToken,
			id,
		})
		.then(this._selectApp)
		.catch(this._toast)
	}

	_selectApp = ({id}) => {
		this.setState({appID: id})
	}

	_removeAppID = () => {
		this.setState({appID: null})
	}

	_removeUserToken = () => {
		this.setState({userToken: null})
	}

	_authenticated = (userToken) => {
		this.setState({userToken});
	}

	renderMain(){
		if( !this.state.userToken ){
			return <Login onAuthenticated={this._authenticated} onError={this._toast} />
		}
		if( !this.state.appID ){
			return <SelectApp userToken={this.state.userToken} onSelect={this._selectApp} onCreate={this._createApp} onError={this._toast}/>
		}
		return <App id={this.state.appID} userToken={this.state.userToken} onClickClose={this._removeAppID} onClickLogout={this._removeUserToken} onError={this._toast}>
			{this.props.children}
		</App>;
	}

	render(){
		return <div>
			{this.renderMain()}
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
		<IndexRoute component={Home} />
		<Route path="types" component={TypesPane} />
		<Route path="types/new" isNew={true} component={TypeEditPane} />
		<Route path="types/:name" component={TypeEditPane} />
		<Route path="types/:name/nodes" component={NodeListPane} />
		<Route path="types/:name/nodes/:id" component={NodeEditPane} />
	</Route>
</Router>;

let localUserToken = localStorage.getItem('userToken');
let loadAppID = localStorage.getItem('appID');
render(<AppRouter userToken={localUserToken} appID={loadAppID} />, document.getElementById('app'))

