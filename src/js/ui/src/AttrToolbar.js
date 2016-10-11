import React from 'react';
import {FontIcon} from 'react-md';

const AttrToolbar = ({icon,title,children}) => {
	const flex = {flex:1};
	const tools = React.Children.map(children, child => <div className="attr-item" style={flex}>
			{child}
	</div>);
	return <div style={{display:'flex',flexDirection:'row',alignItems:'center'}}>
		<div className="left" style={{flex:100, display:'flex', alignItems:'center'}}>
			<div style={{flex:1}}><FontIcon style={{fontSize:36}}>{icon}</FontIcon></div>
			<h4 className="md-subheading-2" style={{flex:100,marginBottom:5,marginLeft:5,fontSize:18}}>{title}</h4>
		</div>
		<div className="right" style={{flex:1,zoom:0.75,display:'flex',alignItems:'center',marginBottom:5}}>
			{tools}
		</div>
	</div>;
};


AttrToolbar.propTypes = {
	icon: React.PropTypes.string.isRequired,
	title: React.PropTypes.string.isRequired,
};

export default AttrToolbar;
