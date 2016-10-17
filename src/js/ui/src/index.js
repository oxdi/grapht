import React from 'react';
import {PureComponent,PropTypes} from 'react';
import CSSTransitionGroup from 'react-addons-css-transition-group';
import classnames from 'classnames';
import { render } from 'react-dom';
import WebFont from 'webfontloader';
import uuid from 'node-uuid';
import moment from 'moment';

import RichTextAttr from './RichTextAttr';
import AttrToolbar from './AttrToolbar';
import Sticky from './Sticky';

const MAIN_WIDTH = 380;
const FIELD_FRAGMENT = `
	name
	type
	required
	edgeName
	edgeToTypeID
	edgeToType {
		id
		name
	}
	edgeDirection
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
	NavigationDrawer,
	Paper,
	CircularProgress,
	Subheader,
	Divider,
} from 'react-md';
import { List, ListItem, ListItemControl } from 'react-md/lib/Lists';
import {
	ExpansionPanel,
	ExpansionList
} from 'react-md/lib/ExpansionPanels';
import SelectField from 'react-md/lib/SelectFields';
import Autocomplete from 'react-md/lib/Autocompletes';
import { FileUpload } from 'react-md/lib/FileInputs';
import Component from './Component';

WebFont.load({
	google: {
		  families: ['Roboto:300,400,500,700', 'Material Icons'],
	},
});

const FIELD_TYPES = [
	'Text',
	'RichText',
	'Int',
	'Float',
	'Boolean',
	// 'BcryptText',
	'Edge',
	'DataTable',
	'File',
	'Image',
];

import UNITS from './units';
const BASE_UNITS = ['none'].concat(UNITS.sections["SI Base Units"].map(o => o.val));

import {Client} from 'grapht';
let client = new Client({host:window.location.host});
window.graphtClient = client;
// FIXME: this probably should not be here!
// returns appid
function bootstrap(userToken, appID){
	return client.connect({userToken, appID}).then(conn => {
		return conn.setType({
			id: uuid.v1(),
			name: "App",
			fields: [
				{name:"name", friendlyName:"Name", type:"Text", hint:"Global name of the project"},
			]
		})
		.then(({id}) => conn.setNode({
			id: uuid.v1(),
			type: "App",
		}))
		.then(() => conn.setType({
			id: uuid.v1(),
			name: "Image",
			fields: [
				{name:"name", friendlyName:"Title", type:"Text", hint:"The title of the image (defaults to the original filename of the uploaded image if available)"},
				{name:"data", friendlyName:"Image Data", type:"Image", hint:"The actual image data"},
				{name:"caption", friendlyName:"Caption", type:"Text", hint:"Short description of the image, may be used in galleries or as alt text"},
			]
		}))
		.then(() => conn.commit())
		.then(() => conn.close())
		.then(() => {
			return {id:appID};
		});
	});
}

const FloatingAddButton = (props) => <FloatingButton
	style={{position:'absolute'}}
	primary
	fixed
	tooltipPosition="top"
	{...props}
>add</FloatingButton>;

const Scroll = (props) => {
	let style = {
		position: 'absolute',
		top:0,
		left:0,
		bottom:0,
		right:0,
		overflow: 'auto',
		WebkitOverflowScrolling: 'touch',
	};
	return <div style={style}>
		{props.children}
	</div>;
}

class AppLayout extends Component {

	static propTypes = {
		sidebar: PropTypes.node.isRequired,
		main: PropTypes.node.isRequired,
		preview: PropTypes.node.isRequired,
		containerStyle: PropTypes.object,
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

	_closeSidebarIfFloating = () => {
		if( this.sidebarIsOverlay() && this.sidebarIsVisible() ){
			this.setState({sidebar: false});
		}
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
		const containerStyle = this.props.containerStyle || {};
		let styles = {
			container: {
				display: 'flex',
				position: 'absolute',
				top: 0,
				bottom: 0,
				right: 0,
				left: 0,
				transition: 'all 0.3s cubic-bezier(.25,.8,.25,1)',
				...containerStyle,
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
		let main = React.cloneElement(this.props.main,{
			onToggleSidebar: this._toggleSidebar,
			onTogglePreview: this._togglePreview,
		});
		let sidebar = this.props.sidebar && React.cloneElement(this.props.sidebar, {
			closeSidebarIfFloating: this._closeSidebarIfFloating,
		});
		let styles = this.styles();
		return <div style={styles.container}>
			<div style={styles.sidebar}>
				{sidebar}
			</div>
			<div style={styles.main} onClickCapture={this._captureClick}>
				{main}
			</div>
			<div style={styles.preview} onClickCapture={this._captureClick}>
				<div>
					{this.props.preview}
				</div>
			</div>
		</div>;
	}
}

class AppSidebar extends Component {

	static propTypes = {
		onClickLogout: PropTypes.func.isRequired,
		onClickClose: PropTypes.func.isRequired,
		closeSidebarIfFloating: PropTypes.func,
		query: PropTypes.string.isRequired,
	}

	_clickLogout = () => {
		this.props.onClickLogout();
	}

	_clickClose = () => {
		this.props.onClickClose();
	}

	_clickTypes = () => {
		this.go('TYPE_LIST');
		this.props.closeSidebarIfFloating();
	}

	_clickHistory = () => {
		this.go('MUTATION_LIST');
		this.props.closeSidebarIfFloating();
	}

	_clickTokens = () => {
		this.go('TOKEN_LIST');
		this.props.closeSidebarIfFloating();
	}

	_clickContent = (type) => {
		this.go('NODE_LIST', {typeID: type.id});
		this.props.closeSidebarIfFloating();
	}

	_clickGlobals = (type) => {
		this.go('GLOBAL_EDIT');
		this.props.closeSidebarIfFloating();
	}

	render(){
		const contentTypes = this.state.data.types.sort((a,b) => a.name > b.name).filter(t => {
			return t.name != "App";
		}).map(t =>
			 <ListItem key={t.id} primaryText={t.name} onClick={this._clickContent.bind(this, t)} />
		);
		return <Scroll>
			<List>
				<ListItem primaryText="Content" leftIcon={<FontIcon>collections</FontIcon>} initiallyOpen={true} nestedItems={contentTypes} />
				<ListItem primaryText="Setup" leftIcon={<FontIcon>settings</FontIcon>} initiallyOpen={false} nestedItems={[
					<ListItem key="options" primaryText="Options" onClick={this._clickGlobals} />,
					<ListItem key="types" primaryText="Types" onClick={this._clickTypes} />,
				]} />
				<ListItem primaryText="History" leftIcon={<FontIcon>restore</FontIcon>} onClick={this._clickHistory} />
				<ListItem primaryText="Tokens" leftIcon={<FontIcon>code</FontIcon>} onClick={this._clickTokens} />
				<ListItem primaryText="Logout" leftIcon={<FontIcon>exit_to_app</FontIcon>} onClick={this._clickLogout} />
				<ListItem primaryText="Switch App" leftIcon={<FontIcon>shuffle</FontIcon>} onClick={this._clickClose} />
			</List>
		</Scroll>;
	}
}

class FieldExpansionPanel extends React.Component {

	static propTypes = {
		types: PropTypes.array.isRequired,
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

	_setEdgeDirection = ({value}) => {
		this.setFieldState({edgeDirection: value});
	}

	_setEdgeToTypeID = ({id}) => {
		this.setFieldState({edgeToTypeID: id});
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

	render(){
		const {field, types} = this.props;
		let labels = this.state.expanded ? {} : {
			secondaryLabel: [field.type]
		};
		const edgeToType = types.find(t => t.id == field.edgeToTypeID);
		return (
			<ExpansionPanel
				className="field"
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
					{field.type == "Edge" ? <div>
						<TextField
							label="Edge Name"
							value={field.edgeName || ''}
							onChange={this._setEdgeName}
							fullWidth
							helpText="The name of the connection"
						/>
						<SelectField
							label="Edge Direction"
							value={field.edgeDirection || 'Any'}
							onChange={this._setEdgeDirection}
							menuItems={[
								{name:'Any',value:''},
								{name:'Out',value:'Out'},
								{name:'In',value:'In'},
							]}
							itemLabel="name"
							adjustMinWidth
							floatingLabel
							fullWidth
						/>
						<SelectField
							label="Target Type"
							value={edgeToType ? edgeToType.name : ''}
							onChange={this._setEdgeToTypeID}
							menuItems={[{name:'',id:null}].concat(types)}
							itemLabel="name"
							adjustMinWidth
							floatingLabel
							fullWidth
						/>
					</div> : null}
					{field.type == "Text" ? <div>
						<div>
							<Switch
								label="Multiline"
								toggled={field.textLines > 1}
								onChange={this._setMultiline}
							/>
						</div>
						{field.textLines > 1 ? <div>
							<TextField
								label="Line limt"
								value={field.textLineLimit}
								onChange={this._setTextLineLimit}
								fullWidth
								helpText="Restrict how many lines of text this field can grow to accomodate"
								type="number"
							/>
						</div> : null}
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
					</div> : null}
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
		query: PropTypes.string.isRequired,
		id: PropTypes.string.isRequired,
	}

	state = {}

	_clickAdd = () => {
		const { type } = this.state.data;
		this.mergeType({
			fields: type.fields.concat({
				name: `newField${type.fields.length+1}`,
				type: 'Text',
			})
		})
	}

	_setField = (oldField, newField) => {
		const { type } = this.state.data;
		this.mergeType({
			fields: type.fields.slice().map(f => {
				if( f.name == oldField.name ){
					delete newField.edgeToType;
					return newField;
				}
				return f;
			})
		})
	}

	_setName = (name) => {
		this.mergeType({name});
	}

	mergeType(changes){
		const { type } = this.state.data;
		this.conn().then(conn => {
			let t = Object.assign({}, type, changes);
			if( t.fields && t.fields.length > 0 ){
				t.fields = t.fields.map(f => {
					let f2 = Object.assign({}, f);
					delete f2.edgeToType;
					return f2;
				})
			}
			return conn.setType(t);
		}).catch(this._toast);
	}

	_done = () => {
		this.go('TYPE_LIST');
	}

	render(){
		const { type, types } = this.state.data;
		return (
			<div style={{margin:40}}>
				<Scroll>
					<Toolbar
						actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
						title="Edit Type"
						actionsRight={<div style={{marginLeft:'auto'}}>
							<IconButton onClick={this._done}>done</IconButton>
						</div>}
					/>
					<div>
						<TextField
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
						{type.fields.map((f,idx) => <FieldExpansionPanel types={types} key={idx} field={f} onChange={this._setField} />)}
					</ExpansionList>
					<div style={{height:80}}> </div>
				</Scroll>
				<FloatingAddButton onClick={this._clickAdd} />
			</div>
		);
	}
}

class TokensPane extends Component {

	render(){
		const {tokens} = this.state.data;
		const rows = tokens.map(t =>
			<TableRow key={t.role}>
				<TableColumn>{t.role}</TableColumn>
				<TableColumn>{moment(t.expires).fromNow()}</TableColumn>
				<TableColumn><code>{t.jwt}</code></TableColumn>
			</TableRow>
		);
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title="Tokens"
				/>
				<DataTable>
					<TableHeader>
						<TableRow>
							<TableColumn>Role</TableColumn>
							<TableColumn>Expires</TableColumn>
							<TableColumn>Token</TableColumn>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows}
					</TableBody>
				</DataTable>
			</Scroll>
		</div>
	}
}
class MutationListPane extends Component {

	getActionName(query){
		const re = /{\s*(?:[a-zA-Z0-9]+:)?([a-zA-Z0-9]+)/;
		const matches = query.match(re);
		if( matches ){
			return matches[1];
		}
		return '';
	}

	render(){
		const {mutations} = this.state.data;
		const rows = mutations.map(m =>
			<TableRow key={m.time}>
				<TableColumn>{moment(m.time).fromNow()}</TableColumn>
				<TableColumn>{m.uid}</TableColumn>
				<TableColumn>{this.getActionName(m.query)}</TableColumn>
			</TableRow>
		);
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title="History"
				/>
				<DataTable>
					<TableHeader>
						<TableRow>
							<TableColumn>Time</TableColumn>
							<TableColumn>User</TableColumn>
							<TableColumn>Action</TableColumn>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows}
					</TableBody>
				</DataTable>
			</Scroll>
		</div>
	}
}

class TypeListPane extends Component {

	_clickAdd = () => {
		this.conn().then(conn => {
			return conn.setType({
				id: uuid.v1(),
				name: 'NewType',
				fields: [
					{name:"name", friendlyName:"Name", type:"Text"},
				]
			})
		}).then(type => {
			this.go('TYPE_EDIT', {id: type.id});
		}).catch(this._toast)
	}

	typeItem(t){
		return <ListItem
			key={t.id}
			leftIcon={<FontIcon>assignment</FontIcon>}
			primaryText={t.name || t.id}
			secondaryText="Custom Type"
			onClick={() => this.go('TYPE_EDIT', {id:t.id})}
		/>
	}


	render(){
		let data = this.state.data;
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title="Types"
				/>
				<List>
					{data.types.sort((a,b) => a.name > b.name).map(t => this.typeItem(t) )}
				</List>
			</Scroll>
			<FloatingAddButton onClick={this._clickAdd} />
		</div>
	}
}

class ImageDataViewer extends Component {
	render(){
		const { node } = this.state.data;
		const src = node.data && node.data.url || `http://placehold.it/${MAIN_WIDTH}?text=missing`;
		return <img src={src} />;
	}
}

class ImageDataAttr extends React.Component {

	static propTypes = {
		node: PropTypes.object.isRequired,
		field: PropTypes.object.isRequired,
		onSetAttr: PropTypes.func.isRequired,
		type: PropTypes.string,
	}

	render(){
		const {node,field,onSetAttr,type} = this.props;
		return <div className="attr attr-text">
			<Sticky ref="sticky">
				<div className="top">
					<AttrToolbar title={field.friendlyName || field.name} icon="image" />
				</div>
			</Sticky>
			<ImageDataViewer query={`
				node(id:"${node.id}"){
					...on ${node.type.name} {
						data(w:${MAIN_WIDTH}) {
							url
						}
					}
				}
			`} />
			<p className="md-caption">{field.hint}</p>
			<Divider />
		</div>;
	}
}
class TextAttr extends React.Component {

	static propTypes = {
		node: PropTypes.object.isRequired,
		field: PropTypes.object.isRequired,
		onSetAttr: PropTypes.func.isRequired,
		type: PropTypes.string,
	}

	render(){
		const {node,field,onSetAttr,type} = this.props;
		let opts = {};
		if( field.textLines > 1 ){
			opts.rows = field.textLines;
			opts.maxRows = field.textLineLimit > 1 ? field.textLineLimit : -1;
		}
		if( type ){
			opts.type = type;
		}
		let attr = node.attrs.find(attr => attr.name == field.name) || {};
		let iconName = 'wrap_text';
		if( field.textLineLimit < 2 ){
			iconName = 'short_text';
		}
		if( type == 'number' ){
			iconName = 'timeline';
		}
		return <div className="attr attr-text">
			<Sticky ref="sticky">
				<div className="top">
					<AttrToolbar title={field.friendlyName || field.name} icon={iconName} />
				</div>
			</Sticky>
			<TextField
				onChange={(v) => onSetAttr({name:field.name,value:v,enc:'UTF8'})}
				value={attr.value || ''}
				maxLength={field.textCharLimit}
				block
				placeholder={field.friendlyName}
				required={field.required}
				{...opts}
			/>
			{field.hint ? <p className="md-caption">{field.hint}</p> : null}
			<Divider />
		</div>;
	}
}

class BooleanAttr extends React.Component {

	static propTypes = {
		node: PropTypes.object.isRequired,
		field: PropTypes.object.isRequired,
		onSetAttr: PropTypes.func.isRequired,
	}

	render(){
		const {node,field,onSetAttr} = this.props;
		let attr = node.attrs.find(attr => attr.name == field.name) || {};
		let on = false;
		if( attr ){
			on = attr.value === true ||
				attr.value === 1 ||
				(/^(true|yes|y|t|on|1)$/i).test((attr.value || '').toString());
		}
		const control = <Switch
			label={field.hint}
			toggled={on}
			onChange={(v) => onSetAttr({name:field.name,value:v.toString(),enc:'UTF8'})}
		/>;
		const statusText = on ? 'Enabled' : 'Disabled';
		return <div className="attr attr-boolean">
			<Sticky ref="sticky">
				<div className="top">
					<AttrToolbar title={field.friendlyName} icon="playlist_add_check" />
				</div>
			</Sticky>
			<List>
				<ListItemControl
					primaryText={field.hint || field.friendlyName || ''}
					secondaryText={statusText}
					secondaryAction={control}
				/>
			</List>
			<Divider />
		</div>;
	}
}

class UploadedImageCard extends PureComponent {

	static propTypes = {
		id: PropTypes.string.isRequired,
		name: PropTypes.string.isRequired,
		contentType: PropTypes.string.isRequired,
		onRemove: PropTypes.func.isRequired,
	}

	render() {
		const { id, name, contentType, url, onRemove } = this.props;
		const title = <CardTitle
			title={name}
			subtitle={contentType}
		/>
		return <Card>
			<CardMedia overlay={title} style={{position:'relative'}}>
				<IconButton style={{position:'absolute',zIndex:99,top:0,right:0,backgroundColor:'black',color:'white'}} onClick={onRemove}>close</IconButton>
				<img src={url} />
			</CardMedia>
		</Card>;
	}
}

class ImageAttr extends Component {

	static propTypes = {
		node: PropTypes.object.isRequired,
		field: PropTypes.object.isRequired,
		onSetEdge: PropTypes.func.isRequired,
		onRemoveEdge: PropTypes.func.isRequired,
		query: PropTypes.string.isRequired,
	}

	constructor(...args) {
		super(...args);
		this.state = {};
		this._timeout = null;
	}

	componentWillUnmount() {
		this._timeout && clearTimeout(this._timeout);
		Component.prototype.componentWillUnmount.call(this);
	}

	_onLoad = (file, uploadResult) => {
		const { onSetNode, onSetEdge, node, field } = this.props;
		const { name, size, type, lastModifiedDate } = file;
		this.conn().then(conn => {
			return conn.setNode({
				id: uuid.v1(),
				type: "Image",
				attrs: [
					{name: "name", value:name, enc:"UTF8"},
					{name: "data", value:uploadResult, enc:"DataURI"},
				]
			}).then(res => {
				return conn.setEdge({
					[field.edgeDirection == 'Out' ? 'from' : 'to']: node.id,
					[field.edgeDirection == 'Out' ? 'to' : 'from']: res.id,
					name: field.edgeName,
				})
			}).catch(this._toast)
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

	_remove = (id) => {
		this.conn().then(conn => {
			return conn.removeNodes({
				id: id,
			}).catch(this._toast)
		});
	}

	_clickConnection = (node) => {
		this.go('NODE_EDIT', {id: node.id});
	}

	avatar(url){
		return <Avatar className="avatar-amber" src={url} />;
	}

	render() {
		const { node, field } = this.props;
		const imgs = this.state.data.node[field.name].map(c =>
			<ListItem
				key={c.node.id}
				leftAvatar={this.avatar(c.node.data && c.node.data.url)}
				rightIcon={<FontIcon onClick={() => this._remove(c.node.id)}>delete</FontIcon>}
				onClick={() => this._clickConnection(c.node)}
				primaryText={c.node.name || ''}
				secondaryText={c.node.data && c.node.data.contentType || ''}
			/>
		);

		let stats;
		if (typeof progress === 'number') {
			stats = [
				<LinearProgress key="progress" value={progress} />,
				<RaisedButton key="abort" label="Abort Upload" onClick={this._abortUpload} />,
			];
		}

		return <div className="attr attr-image">
			<Sticky ref="sticky">
				<div className="top">
					<AttrToolbar title={field.friendlyName} icon="camera_roll">
						<FileUpload
							multiple={false}
							secondary
							ref="upload"
							label="Add"
							iconChildren="add"
							onLoadStart={this._setFile}
							onProgress={this._handleProgress}
							onLoad={this._onLoad}
						/>
					</AttrToolbar>
				</div>
			</Sticky>
			{stats}
			<List>
				{imgs}
			</List>
			{field.hint ? <p className="md-caption">{field.hint}</p> : null}
			<Divider />
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

	_remove = (id) => {
		const {node, field} = this.props;
		this.props.onRemoveEdge({
			from: node.id,
			to: id,
			name: field.edgeName,
		})
	}

	_add = (name) => {
		const { data } = this.state;
		const id = data.nodes.find(n => n.name == name).id;
		const {node, field} = this.props;
		if (field.edgeDirection == 'In'){
			this.props.onSetEdge({
				to: node.id,
				from: id,
				name: field.edgeName,
			})
		} else {
			this.props.onSetEdge({
				from: node.id,
				to: id,
				name: field.edgeName,
			})
		}
	}

	_clickConnection = (node) => {
		this.go('NODE_EDIT', {id: node.id});
	}

	avatar(){
		return <Avatar icon={<FontIcon>note</FontIcon>} suffix="color-1" />;
	}

	render() {
		const { data } = this.state;
		const {node, field} = this.props;
		const items = node.connections.reduce((nodes,c) => {
			if( c.name != field.edgeName ){ // ignore other connections
				return nodes;
			}
			if( field.edgeDirection && c.direction != field.edgeDirection ){ // ignore other directions
				return nodes;
			}
			const node = data.nodes.find(n => n.id == c.node.id);
			if( !node ){ // do not have node in master list...yet
				return nodes;
			}
			if( nodes.find(n => n.id == node.id) ){ // uniq
				return nodes;
			}
			nodes.push(node);
			return nodes;
		},[]).map(node => {
			return <ListItem
				key={node.id}
				primaryText={node.name || node.id || ''}
				secondaryText={node.type ? node.type.name : ''}
				leftAvatar={this.avatar(node)}
				onClick={() => this._clickConnection(node)}
				rightIcon={<FontIcon onClick={(e) => {
					e.preventDefault()
					this._remove(node.id)
				}}>delete</FontIcon>}
			/>;
		});
		let typeName = 'Node';
		if( field.edgeToType && field.edgeToType.name ){
			typeName = field.edgeToType.name;
		}
		return <div className="attr attr-edge">
			<Sticky ref="sticky">
				<div className="top">
					<AttrToolbar title={field.friendlyName || field.name} icon="collections">
						<Autocomplete
							icon={<FontIcon>search</FontIcon>}
							label={`Find ${typeName}...`}
							data={data.nodes.reduce((uniq,n) => {
								if( uniq.find(existing => existing.name == n.name) ){
									return uniq;
								}
								uniq.push(n);
								return uniq;
							},[])}
							dataLabel="name"
							onAutocomplete={this._add}
							clearOnAutocomplete
							floatingLabel={false}
						/>
					</AttrToolbar>
				</div>
			</Sticky>
			<List>
				{items}
			</List>
			{field.hint ? <p className="md-caption">{field.hint}</p> : null}
			<Divider />
		</div>;
	}
}

export default class NodeChip extends PureComponent {
	static propTypes = {
		id: PropTypes.string.isRequired,
		label: PropTypes.string.isRequired,
		onRemove: PropTypes.func.isRequired,
	};

	state = {};

	_remove = () => {
		this.props.onRemove(this.props.id);
	};

	render() {
		const { label } = this.props;
		return <Chip
			label={label}
			remove={this._remove}
		>
			<Avatar random>{label.charAt(0)}</Avatar>
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
		const { node, field } = this.props;
		switch( field.type ){
		case 'Text':      return <TextAttr {...this.props} />;
		case 'RichText':  return <RichTextAttr {...this.props} />;
		case 'Int':       return <TextAttr {...this.props} type="number" />;
		case 'Float':     return <TextAttr {...this.props} type="number" />;
		case 'Boolean':   return <BooleanAttr {...this.props} />;
		case 'Image':   return <ImageDataAttr {...this.props} />;
		case 'Edge':
			if( field.edgeToType && field.edgeToType.name == 'Image' ){
				return <ImageAttr {...this.props} query={`
					node(id:"${node.id}"){
						...on ${node.type.name} {
							${field.name} {
								node {
									...on Image {
										id
										name
										data(w:50,h:50) {
											contentType
											url
										}
									}
								}
							}
						}
					}
				`}/>;
			} else {
				 return <EdgeAttr {...this.props} query={field.edgeToTypeID ? `
					nodes(typeID:"${field.edgeToTypeID}") {
						id
						name
					}
				` : `
					nodes {
						id
						name
					}
				`}/>;
			}
		default:          return <div>UNKNOWN FIELD TYPE {this.props.field.type}</div>;
		}
	}
}

class GlobalEditPane extends Component {

	render(){
		const { nodes } = this.state.data;
		const node = nodes[0];
		if( !node ){
			return <section>
				<FlatButton onClick={this._createGlobalAppType} label="Enable Global Options" />
			</section>;
		}
		return <NodeEditPane id={node.id} query={`
			node(id:"${node.id}"){
				id
				type {
					id
					name
					fields {
						${FIELD_FRAGMENT}
					}
				}
				attrs {
					name
					value
					enc
				}
				connections {
					name
					direction
					node {
						id
					}
				}
			}
		`} />;
	}
}

class NodeEditPane extends Component {

	static propTypes = {
		query: PropTypes.string.isRequired,
		id: PropTypes.string.isRequired,
	}

	state = {attrs: []}

	_setAttr = (attr, afterStateChangeCallback) => {
		const { node } = this.state.data;
		const attrs = this.state.attrs.slice()
		attrs.unshift(attr);
		this.setState({attrs}, afterStateChangeCallback);
		return this.conn().then(conn => conn.setNode({
			id: node.id,
			type: node.type.name,
			attrs: [attr],
			merge: true,
		})).catch(this._toast);
	}

	_setEdge = (edge) => {
		this.conn()
			.then(conn => conn.setEdge(edge))
			.catch(this._toast);
	}

	_removeEdge = (matcher) => {
		this.conn()
			.then(conn => conn.removeEdges(matcher))
			.catch(this._toast);
	}

	_done = () => {
		const { node } = this.state.data;
		this.go('NODE_LIST', {typeID:node.type.id})
	}

	findDiffAttr(savedAttrs,expectedAttrs){
		return savedAttrs.find(attr => {
			let exp = expectedAttrs.find(exp => exp.name == attr.name);
			if( !exp ){
				return true;
			}
			return exp.value != attr.value;
		})
	}

	onQueryData(data){
		let pending = true;
		let attrs = this.state.attrs;
		if( !this.findDiffAttr(this.state.data.node.attrs, this.optimisticNode().attrs) ) {
			pending = false;
			attrs = [];
		}
		this.setState({pending, attrs});
	}

	optimisticNode(){
		return Object.assign({}, this.state.data.node, {
			attrs: this.state.data.node.attrs.map(a => {
				const optAttr = this.state.attrs.find(oa => oa.name == a.name);
				return optAttr || a
			})
		});
	}

	render(){
		const node = this.optimisticNode();
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title={`Edit ${node.type.name}`}
					actionsRight={<div style={{marginLeft:'auto'}}>
						<IconButton onClick={this._done}>done</IconButton>
					</div>}
				/>
				{node.type.fields.map(f =>
					<Attr
						key={f.name}
						node={node}
						field={f}
						attr={node.attrs.find(a => a.name == f.name)}
						onSetAttr={this._setAttr}
						onSetEdge={this._setEdge}
						onRemoveEdge={this._removeEdge}
					/>
				)}
				<div style={{height:250}}></div>
			</Scroll>
		</div>
	}
}

class NodeListPane extends Component {

	static propTypes = {
		onToggleSidebar: PropTypes.func,
		typeID: PropTypes.string.isRequired,
		query: PropTypes.string.isRequired,
	}

	_clickAdd = () => {
		this.conn().then(conn => {
			return conn.setNode({
				id: uuid.v1(),
				typeID: this.props.typeID,
			})
		}).then((node) => {
			this.go('NODE_EDIT', {id: node.id});
		}).catch(this._toast)
	}

	_clickRow = (node) => {
		this.go('NODE_EDIT',{id:node.id});
	}

	render(){
		if( !this.state.data.type ){
			return <div>'waiting on type'</div>;
		}
		let type = this.state.data.type;
		let nodes = this.state.data.nodes.sort((a,b) => a.name > b.name);
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title={type.name}
					actionsRight={<div style={{marginLeft:'auto'}}>
						<IconButton onClick={this._done}>done</IconButton>
					</div>}
				/>
				<DataTable>
					<TableHeader>
						<TableRow>
							<TableColumn>Name / ID</TableColumn>
							<TableColumn> </TableColumn>
						</TableRow>
					</TableHeader>
					<TableBody>
						{nodes.map(n =>
							<TableRow key={n.id} onClick={this._clickRow.bind(this, n)}>
								<TableColumn>{n.name || n.id}</TableColumn>
								<TableColumn> </TableColumn>
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

class HomePane extends Component {
	render(){
		return <div>
			<Scroll>
				<Toolbar
					actionLeft={<IconButton onClick={this.props.onToggleSidebar}>menu</IconButton>}
					title={this.getAppID()}
					actionsRight={<div style={{marginLeft:'auto'}}>
					</div>}
				/>
				<p>Hello, Welcome, write some help and stuff here</p>
			</Scroll>
		</div>;
	}
}

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
		localStorage.setItem('appID', id);
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

	state = {tab:0}

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
			})
			.then(() => bootstrap(userToken, this.state.appID))
			.then(() => this.onAuthenticated(userToken));
		}).catch(err => {
			console.error('register fail:', err);
			this.onError(`Register failed: ${err.message}`)
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

	constructor(...args){
		super(...args);
		this.state = {};
		if( this.props.sessionToken ){
			this.state.sessionToken = this.props.sessionToken;
		}
	}

	componentDidMount(){
		this.startSession();
	}

	static propTypes = {
		id: PropTypes.string.isRequired,
		url: PropTypes.string.isRequired,
		userToken: PropTypes.string.isRequired,
		sessionToken: PropTypes.string,
		onClickClose: PropTypes.func.isRequired,
		onClickLogout: PropTypes.func.isRequired,
		onError: PropTypes.func.isRequired,
		onDismissError: PropTypes.func.isRequired,
		onSetPane: PropTypes.func.isRequired,
		pane: PropTypes.string.isRequired,
		paneProps: PropTypes.object.isRequired,
		layoutStyle: PropTypes.object,
	}

	static childContextTypes = {
		onError: PropTypes.func.isRequired,
		onSetPane: PropTypes.func.isRequired,
		userToken: PropTypes.string.isRequired,
		appID: PropTypes.string.isRequired,
		conn: PropTypes.object,
	}

	getChildContext(){
		return {
			onError: this.props.onError,
			onSetPane: this.props.onSetPane,
			userToken: this.props.userToken,
			appID: this.props.id,
			conn: this.state.conn,
		};
	}

	componentWillUnmount(){
		this.closeSession();
	}

	startSession(){
		let conn;
		if( this.props.sessionToken ){
			conn = client.connect({
				sessionToken: this.props.sessionToken
			});
		} else {
			const {userToken, id} = this.props;
			conn = client.createSession({
				userToken: userToken,
				appID: id,
			}).then(({sessionToken}) => {
				this.setState({sessionToken});
				localStorage.setItem('sessionToken', sessionToken);
				return client.connectSession({sessionToken});
			})
		}
		conn.then(this._connected).catch(this._disconnected)
	}

	_disconnected = (err) => {
		console.log('disconnected', err);
		this.props.onClickLogout();
	}

	_connected = (conn) => {
		console.log('connected');
		conn.onDirty = this._showDirtyToast;
		conn.onClean = this._hideDirtyToast;
		conn.onClose = this._showOfflineToast;
		this.setState({conn: Promise.resolve(conn)});
		return conn;
	}

	closeSession(){
		if( this.state.conn && typeof this.state.conn.close == 'function' ){
			this.state.conn.close();
		}
	}

	_showDirtyToast = () => {
		this.props.onError('You have unpublished changes', {
			label: 'Publish',
			secondary: true,
			onClick: () => {
				this.state.conn.then(conn => {
					return conn.commit().catch(err => {
						this.props.onError(err);
						if( conn.dirty ){
							this._showDirtyToast();
						}
					})
				})
			}
		});
	}

	_hideDirtyToast = () => {
		this.props.onDismissError();
	}

	_showOfflineToast = () => {
		this.props.onError('You are offline', {
			label: 'Reconnect',
			onClick: () => {
				window.location.reload();
			},
			important: true,
		});
	}

	renderPreview(){
		const url = `${this.props.url}#${this.state.sessionToken}`
		return <iframe src={url}
			frameBorder="0"
			width="100%"
			height="100%"
			style={{border:0,position:'absolute',top:0,left:0,botom:0,right:0}}
		></iframe>;
	}

	renderMain(){
		const props = {
			key: this.props.pane,
			conn: this.state.conn,
			...this.props.paneProps,
		};
		console.log('render:', this.props.pane, props)
		switch(this.props.pane){
			case 'TOKEN_LIST':    return <TokensPane {...props} query={`
				tokens {
					role
					jwt
					expires
				}
			`}/>;
			case 'MUTATION_LIST':    return <MutationListPane {...props} query={`
				mutations {
					time
					uid
					role
					query
				}
			`}/>;
			case 'TYPE_LIST':    return <TypeListPane {...props} query={`
				types {
					id
					name
					fields {
						name
						type
					}
				}
			`}/>;
			case 'TYPE_EDIT':    return <TypeEditPane {...props} query={`
				type(id:"${props.id}"){
					id
					name
					fields {
						${FIELD_FRAGMENT}
					}
				}
				types {
					id
					name
				}
			`}/>;
			case 'NODE_LIST':    return <NodeListPane {...props} query={`
				type(id:"${props.typeID}"){
					name
					fields {
						name
					}
				}
				nodes(typeID:"${props.typeID}"){
					id
					name
				}
			`}/>;
			case 'GLOBAL_EDIT':    return <GlobalEditPane {...props} query={`
				nodes(type:App){
					id
				}
			`}/>;
			case 'NODE_EDIT':    return <NodeEditPane {...props} query={`
				node(id:"${props.id}"){
					id
					type {
						id
						name
						fields {
							${FIELD_FRAGMENT}
						}
					}
					attrs {
						name
						value
						enc
					}
					connections {
						name
						direction
						node {
							id
						}
					}
				}
			`}/>;
			default:             return <HomePane {...props} />;
		}
	}

	render(){
		const {layoutStyle, onClickClose, onClickLogout} = this.props;
		const {conn} = this.state;
		if( !conn ){
			return <CircularProgress />;
		}
		return <AppLayout
			containerStyle={layoutStyle}
			sidebar={
				<AppSidebar
					onClickClose={onClickClose}
					onClickLogout={onClickLogout}
					conn={this.state.conn}
					query={`
						types {
							id
							name
						}
					`}
				/>
			}
			main={this.renderMain()}
			preview={this.renderPreview()}
		/>;
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
		this.state = {
			toasts:[],
			pane: 'HOME',
			paneProps: {},
			userToken: this.props.userToken,
			appID: this.props.appID,
			sessionToken: this.props.sessionToken,
		};
	}

	componentWillUnmount() {
		if( this.unlisten ){
			this.unlisten.forEach(fn => fn());
			this.unlisten = null;
		}
	}

	componentDidMount(){
		const mq = {
			mobile: window.matchMedia(`(min-width: 0px) and (max-width: 600px)`),
			tablet: window.matchMedia(`(min-width: 600px) and (max-width: 900px)`),
			desktop: window.matchMedia(`(min-width: 900px)`),
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
		const autohide = !toasts[0] || !(toasts[0].action && toasts[0].action.onClick);
		this.setState({ toasts, autohide });
	}

	_toast = (err, action) => {
		if( !err ){
			return;
		}
		let msg = err;
		if( msg.message ){
			msg = msg.message;
		}
		for(let t of this.state.toasts){
			if( msg == t.text ){
				return;
			}
		}
		const toasts = this.state.toasts.slice();
		if( toasts.length && toasts[0].action.important ){
			return;
		}
		const t = {
			key: Date.now(),
			text: msg,
			action,
		};
		toasts.unshift(t);
		const autohide = !(toasts[0].action && toasts[0].action.onClick);
		this.setState({toasts, autohide});
		if( !(/unpublished|offline/).test(msg) ){
			console.error('toast:', err);
		}
	}

	_createApp = ({id}) => {
		return client.createApp({
			userToken: this.state.userToken,
			id,
		})
		.then(() => bootstrap(this.state.userToken, id))
		.then(this._selectApp)
		.catch(this._toast)
	}

	_selectApp = ({id}) => {
		this.setState({appID: id});
	}

	_removeAppID = () => {
		this.setState({appID: null})
	}

	_removeUserToken = () => {
		// this.setState({userToken: null});
		localStorage.clear();
		window.location.reload();
	}

	_authenticated = (userToken) => {
		this.setState({userToken});
		localStorage.setItem('userToken', userToken);
	}

	_setPane = (pane, paneProps) => {
		console.log('setPane', pane, paneProps);
		this.setState({
			pane,
			paneProps: paneProps || {}
		});
	}

	renderMain(){
		if( !this.state.userToken ){
			return <Login onAuthenticated={this._authenticated} onError={this._toast} />
		}
		if( !this.state.appID ){
			return <SelectApp userToken={this.state.userToken} onSelect={this._selectApp} onCreate={this._createApp} onError={this._toast}/>
		}
		let url = 'about:blank';
		if (/ilios/.test(this.state.appID)) {
			url = 'http://toolbox.oxdi.eu:3000';
		} else if ( /fairlight/.test(this.state.appID)) {
			url = 'http://google.com/';
		}
		const layoutStyle = {};
		if( this.state.toasts.length > 0 ){
			layoutStyle.bottom = 48;
		}
		return <App id={this.state.appID}
					key={this.state.appID}
					userToken={this.state.userToken}
					sessionToken={this.state.sessionToken}
					url={url}
					onClickClose={this._removeAppID}
					onClickLogout={this._removeUserToken}
					onError={this._toast}
					onDismissError={this._dismissToast}
					onSetPane={this._setPane}
					pane={this.state.pane}
					paneProps={this.state.paneProps}
					layoutStyle={layoutStyle}
		/>;
	}

	render(){
		return <div>
			{this.renderMain()}
			<Snackbar
				toasts={this.state.toasts}
				dismiss={this._dismissToast}
				autohide={this.state.autohide}
			/>
		</div>;
	}
}

let localUserToken = localStorage.getItem('userToken');
let loadAppID = localStorage.getItem('appID');
let localSessionToken = localStorage.getItem('sessionToken');
render(<Chrome userToken={localUserToken} appID={loadAppID} sessionToken={localSessionToken} />, document.getElementById('app'))

