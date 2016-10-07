import React from 'react';
import { PropTypes } from 'react';
import {Editor, EditorState, convertToRaw, convertFromRaw} from 'draft-js';

export default class RichTextAttr extends React.Component {

	static propTypes = {
		node: PropTypes.object.isRequired,
		field: PropTypes.object.isRequired,
		onSetAttr: PropTypes.func.isRequired,
	}

	constructor(props) {
		super(props);
		this.state = {editorState: this.getEditorState()};
	}

	_onChange = (editorState) => {
		const { field } = this.props;
		this.setState({editorState});
		this.setAttr({
			name: field.name,
			enc: "JSON",
			value: JSON.stringify(convertToRaw(editorState.getCurrentContent())),
		});
	}

	setAttr(attr) {
		if( this.pendingAttr && this.pendingAttr.value == attr.value ){
			return;
		}
		this.pendingAttr = attr;
		clearTimeout(this.timer);
		this.timer = setTimeout(this._setPendingAttr,500);
	}

	_setPendingAttr = () => {
		if( !this.pendingAttr ){
			return;
		}
		this.props.onSetAttr(this.pendingAttr)
	}

	getEditorState(){
		const {node,field} = this.props;
		const attr = node.attrs.find(a => a.name == field.name);
		if( !attr ){
			return EditorState.createEmpty();
		}
		try {
			return EditorState.createWithContent(
				convertFromRaw(JSON.parse(attr.value))
			);
		} catch(err) {
			console.warn('bad rich text value', err);
			return EditorState.createEmpty();
		}
	}


	render() {
		const {editorState} = this.state;
		return <Editor editorState={editorState} onChange={this._onChange} />;
	}

}
