import React from 'react';
import { PropTypes } from 'react';
import {
	Editor,
	DefaultDraftBlockRenderMap,
	getDefaultKeyBinding,
	CompositeDecorator,
	Entity,
	Modifier,
	EditorState,
	RichUtils,
	convertToRaw,
	convertFromRaw
} from 'draft-js';
import {
	FlatButton,
	IconButton,
	Dialog,
	Tabs,
	Tab,
	FontIcon,
	TextField,
	Toolbar,
	Menu,
	ListItem,
	Divider,
} from 'react-md';
import Immutable from 'immutable';
import SelectField from 'react-md/lib/SelectFields';
import Autocomplete from 'react-md/lib/Autocompletes';
import AttrToolbar from './AttrToolbar';
import Sticky from './Sticky';

const Link = ({entityKey, children}) => {
	const { url } = Entity.get(entityKey).getData();
	return <a href={url}>
		{children}
	</a>;
};

const NodeLink = ({entityKey, children}) => {
	const { id } = Entity.get(entityKey).getData();
	return <a href={`#node:${id}`}>
		{children}
	</a>;
};

function isType(...types){
	return function(contentBlock, callback) {
		contentBlock.findEntityRanges((character) => {
			const key = character.getEntity();
			if( key === null ){
				return false;
			}
			const entity = Entity.get(key);
			if( !entity ){
				return false;
			}
			return !!types.find(t => t == entity.getType());
		}, callback);
	};
}

const decorator = new CompositeDecorator([
	{
		strategy: isType('NODE_LINK'),
		component: NodeLink,
	},
	{
		strategy: isType('LINK'),
		component: Link,
	},
]);

const BLOCK_TYPES = [
	{name: 'Normal', type: 'unstyled', className:'editor-normal'},
	{name: 'Heading', type: 'header-one', className:'editor-heading-one'},
	{name: 'Subheading', type: 'header-two', className:'editor-heading-two'},
	{name: 'Small', type: 'small', className:'editor-small'},
	{name: 'Quote', type: 'blockquote', className:'editor-quote'},
	{name: 'List', type: 'unordered-list-item', className:'editor-list-item'},

];

const blockRenderMap = DefaultDraftBlockRenderMap.merge(Immutable.Map({
	'small': {
		element: 'div'
	}
}));

function getClassNameForBlock(contentBlock) {
	const type = contentBlock.getType();
	const blockType = BLOCK_TYPES.find(b => b.type == type);
	if( blockType ){
		return blockType.className;
	}
}

export default class RichTextAttr extends React.Component {

	static propTypes = {
		node: PropTypes.object.isRequired,
		field: PropTypes.object.isRequired,
		onSetAttr: PropTypes.func.isRequired,
	}

	constructor(props) {
		super(props);
		this.state = {
			editorState: this.getEditorState(),
			showLinkDialog: false,
		};
	}

	_onChange = (editorState) => {
		const { field } = this.props;
		const newValue = JSON.stringify(convertToRaw(editorState.getCurrentContent()));
		const oldValue = JSON.stringify(convertToRaw(this.state.editorState.getCurrentContent()));
		this.setState({editorState});
		if( newValue == oldValue ){
			return;
		}
		this.setAttr({
			name: field.name,
			enc: "JSON",
			value: newValue,
		});
	}

	setAttr(attr) {
		if( this.latestAttr && this.latestAttr.value == attr.value ){
			return;
		}
		this.latestAttr = attr;
		clearTimeout(this.timer);
		this.timer = setTimeout(this._setPendingAttr,500);
	}

	_setPendingAttr = () => {
		if( !this.latestAttr ){
			return;
		}
		this.props.onSetAttr(this.latestAttr, this._focus);
	}

	getEditorState(){
		const {node,field} = this.props;
		const attr = node.attrs.find(a => a.name == field.name);
		if( !attr ){
			return EditorState.createEmpty(decorator);
		}
		try {
			return EditorState.createWithContent(
				convertFromRaw(JSON.parse(attr.value)),
				decorator
			);
		} catch(err) {
			console.warn('bad rich text value', err);
			return EditorState.createEmpty(decorator);
		}
	}

	_onClickBold = (e) => {
		e.preventDefault();
		this._onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'BOLD'));
	}

	_onClickItalic = (e) => {
		e.preventDefault();
		this._onChange(RichUtils.toggleInlineStyle(this.state.editorState, 'ITALIC'));
	}

	_changeBlockStyle = ({type}) => {
		this._onChange(RichUtils.toggleBlockType(this.state.editorState, type));
	}

	_showLinkDialog = (e) => {
		if (e && e.preventDefault) {
			e.preventDefault();
		}
		this.setState({showLinkDialog: true});
	}

	_hideLinkDialog = () => {
		this.setState({showLinkDialog: false}, this._focus);
	}

	_focus = () => {
		this.refs.editor.focus(0);
		this.refs.sticky.updateBounds();
	}

	_setLink = ({type,id,url}) => {
		const { editorState } = this.state;
		const key = type == 'INT' ?
			Entity.create(
				'NODE_LINK',
				'MUTABLE',
				{id}
			) :
			Entity.create(
				'LINK',
				'MUTABLE',
				{url}
			) ;
		 this._onChange(RichUtils.toggleLink(
			 editorState,
			 editorState.getSelection(),
			 key
		));
		this.setState({showLinkDialog: false}, this._focus);
	}

	_hideToolMenu = () => {
		this.setState({showToolMenu: false});
	}

	_showToolMenu = () => {
		this.setState({showToolMenu: true});
	}

	_handleKeyCommand = (command) => {
		const {editorState} = this.state;
		const newState = RichUtils.handleKeyCommand(editorState, command);
		if (newState) {
			this._onChange(newState);
			return true;
		}
		return false;
	}

	_keyBindings = (e) => {
		return getDefaultKeyBinding(e);
	}

	_onTab = (e) => {
		e.preventDefault();
		const {editorState} = this.state;
		this._onChange(RichUtils.onTab(e, editorState, 2));
	}

	render() {
		const {editorState} = this.state;
		const selection = editorState.getSelection();
		const blockType = editorState
			.getCurrentContent()
			.getBlockForKey(selection.getStartKey())
			.getType();
		const blockItem = BLOCK_TYPES.find(t => t.type == blockType);
		const {field} = this.props;
		const flex = {flex:1};
		return <div className="attr attr-richtext">
			<Sticky ref="sticky">
				<div className="top">
					<AttrToolbar title={field.friendlyName} icon="art_track">
						<IconButton onClick={this._onClickBold}>format_bold</IconButton>
						<IconButton onClick={this._onClickItalic}>format_italic</IconButton>
						<IconButton onClick={this._showLinkDialog}>link</IconButton>
						<SelectField label="Style" itemLabel="name" menuItems={BLOCK_TYPES} position={SelectField.Positions.BELOW} onChange={this._changeBlockStyle} value={blockItem ? blockItem.name : 'Normal'} />
						<Menu isOpen={!!this.state.showToolMenu}
							toggle={<IconButton onClick={this._showToolMenu} tooltipLabel="More options">more_vert</IconButton>}
							close={this._hideToolMenu}
						>
							<ListItem primaryText="Add Image"
								leftIcon={<FontIcon>format_clear</FontIcon>}
								onClick={this._clearFormatting}
							/>
							<ListItem primaryText="Clear Formatting"
								leftIcon={<FontIcon>format_clear</FontIcon>}
								onClick={this._clearFormatting}
							/>
						</Menu>
					</AttrToolbar>
				</div>
			</Sticky>
			<Editor
				ref="editor"
				stripPastedStyles
				spellCheck
				editorState={editorState}
				onChange={this._onChange}
				handleKeyCommand={this._handleKeyCommand}
				blockStyleFn={getClassNameForBlock}
				blockRenderMap={blockRenderMap}
				keyBindingFn={this._keyBindings}
				onTab={this._onTab}
			/>
			<LinkDialog
				isOpen={this.state.showLinkDialog}
				onCancel={this._hideLinkDialog}
				onSetLink={this._setLink}
			/>
			{field.hint ? <p className="md-caption">{field.hint}</p> : null}
			<Divider />
		</div>;
	}

}

class LinkDialog extends React.Component {

	static propTypes = {
		isOpen: PropTypes.bool.isRequired,
		onCancel: PropTypes.func.isRequired,
		onSetLink: PropTypes.func.isRequired,
	}

	state = {linkType:'INT',linkURL:'',data:{}}

	_cancel = () => {
		this.props.onCancel();
	}

	_confirm = () => {
		this.props.onSetLink({
			type: this.state.linkType,
			url: this.state.linkURL,
			id: this.state.linkID,
		});
	}

	_setTab = (idx) => {
		const linkType = idx == 0 ? 'INT' : 'EXT';
		this.setState({linkType});
	}

	_setLinkURL = (linkURL) => {
		this.setState({linkURL})
	}

	renderInternalTab() {
		return <div>
			<Autocomplete
				label="Link to"
				data={[]}
				fullWidth
			/>
		</div>;
	}

	renderExtenralTab() {
		return <div>
			<TextField
				label="URL"
				value={this.state.linkURL || ''}
				onChange={this._setLinkURL}
				floatingLabel
				fullWidth
			/>
		</div>;
	}

	renderTab() {
		if( this.state.linkType === 'INT' ){
			return this.renderInternalTab();
		} else {
			return this.renderExtenralTab();
		}
	}

	renderActions(){
		return <div style={{marginLeft:'auto'}}>
			<FlatButton type="button" className="md-toolbar-item" label="Cancel" onClick={this._cancel}/>
			<FlatButton type="submit" className="md-toolbar-item" primary label="Link" onClick={this._confirm}/>
		</div>;
	}

	render() {
		const {isOpen} = this.props;
		return <Dialog isOpen={isOpen} close={this._cancel}>
			<Tabs centered fixedWidth primary>
				<Tab label="Internal" icon={<FontIcon>link</FontIcon>} onChange={this._setTab} />
				<Tab label="External" icon={<FontIcon>public</FontIcon>} onChange={this._setTab} />
			</Tabs>
			{this.renderTab()}
			<div>
				<Toolbar primary={false} actionsRight={this.renderActions()} />
			</div>
		</Dialog>;
	}
}

