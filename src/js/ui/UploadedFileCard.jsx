import React, { PureComponent, PropTypes } from 'react';

import { IconButton } from 'react-md/lib/Buttons';
import { Card, CardMedia, CardTitle } from 'react-md/lib/Cards';
import FontIcon from 'react-md/lib/FontIcons';

import Markdown from 'components/Markdown';

if (__CLIENT__ && !global.Intl) {
  require.ensure([], require => {
    require('intl');
    require('intl/locale-data/jsonp/en-US');
  });
}

