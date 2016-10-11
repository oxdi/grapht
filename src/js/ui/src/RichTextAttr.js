import React from 'react';
import { PropTypes } from 'react';
import {Editor, CompositeDecorator, Entity, Modifier, EditorState, RichUtils, convertToRaw, convertFromRaw} from 'draft-js';
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
} from 'react-md';
import SelectField from 'react-md/lib/SelectFields';
import Autocomplete from 'react-md/lib/Autocompletes';
import AttrToolbar from './AttrToolbar';

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

	render() {
		const {editorState} = this.state;
		const {field} = this.props;
		const flex = {flex:1};
		return <div>
			<AttrToolbar title={field.friendlyName} icon="art_track">
				<IconButton onClick={this._onClickBold}>format_bold</IconButton>
				<IconButton onClick={this._onClickItalic}>format_italic</IconButton>
				<IconButton onClick={this._showLinkDialog}>link</IconButton>
				<SelectField label="Style" menuItems={['Normal','Heading 1', 'Heading 2']} position={SelectField.Positions.BELOW} />
				<Menu isOpen={!!this.state.showToolMenu}
					toggle={<IconButton onClick={this._showToolMenu} tooltipLabel="More options">more_vert</IconButton>}
					close={this._hideToolMenu}
				>
					<ListItem primaryText="Clear Formatting"
						leftIcon={<FontIcon>format_clear</FontIcon>}
						onClick={this._clearFormatting}
					/>
					<ListItem primaryText="Clear Formatting"
						leftIcon={<FontIcon>format_clear</FontIcon>}
						onClick={this._clearFormatting}
					/>
				</Menu>
			</AttrToolbar>
			<Editor ref="editor" stripPastedStyles spellCheck editorState={editorState} onChange={this._onChange} />
			<LinkDialog isOpen={this.state.showLinkDialog} onCancel={this._hideLinkDialog} onSetLink={this._setLink} />
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

