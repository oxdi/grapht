'use strict';

import React, { Component, PropTypes } from 'react';
import classNames from 'classnames';
import ScrollFeatures from 'scrollfeatures';
import assign from 'object-assign';

var log = function() {};



const initialState = {
  sticky: false,
  absolute: false,
  fixedOffset: '',
  offsetHeight: 0,
  bounds: {
    top: null,
    left: null,
    right: null,
    bottom: null,
    height: null,
    width: null
  },
  restrict: {
    top: null,
    left: null,
    right: null,
    bottom: null,
    height: null,
    width: null
  },
  scrollClass: null,
  initialStyle: null,
  style: {
    top: null,
    bottom: null,
    left: null,
    right: null,
    'margin-top': 0,
    'margin-bottom': 0,
    'margin-left': 0,
    'margin-right': 0
  },
  disabled: false
};


const getAbsolutBoundingRect = (el, fixedHeight) => {
  var rect = el.getBoundingClientRect();
  var top = rect.top + (ScrollFeatures.windowScrollY || 0);
  var height = fixedHeight || rect.height;
  return {
    top: top,
    bottom: top + height,
    height: height,
    width: rect.width,
    left: rect.left,
    right: rect.right
  };
};

const addBounds = (rect1, rect2) => {
  var rect = assign({}, rect1);
  rect.top -= rect2.top;
  rect.left -= rect2.left;
  rect.right = rect.left + rect1.width;
  rect.bottom = rect.top + rect1.height;
  return rect;
};

const getPositionStyle = el => {

  var result = {};
  var style = window.getComputedStyle(el, null);

  for (var key in initialState.style) {
    var value = parseInt(style.getPropertyValue(key));
    value = isNaN(value) ? null : value;
    result[key] = value;
  }

  return result;
};

const getPreviousElementSibling = el => {
  var prev = el.previousElementSibling;
  if (prev && prev.tagName.toLocaleLowerCase() === 'script') {
    prev = getPreviousElementSibling(prev);
  }
  return prev;
};

export default class ReactStickyState extends Component {

  static propTypes = {
    stickyWrapperClass: PropTypes.string,
    stickyClass: PropTypes.string,
    fixedClass: PropTypes.string,
    stateClass: PropTypes.string,
    disabledClass: PropTypes.string,
    absoluteClass: PropTypes.string,
    disabled: PropTypes.bool,
    debug: PropTypes.bool,
    tagName: PropTypes.string,
    scrollClass: PropTypes.object
  };

  static defaultProps = {
    stickyWrapperClass: 'sticky-wrap',
    stickyClass: 'sticky',
    fixedClass: 'sticky-fixed',
    stateClass: 'is-sticky',
    disabledClass: 'sticky-disabled',
    absoluteClass: 'is-absolute',
    debug: false,
    disabled: false,
    tagName: 'div',
    scrollClass: {
      down: null,
      up: null,
      none: null,
      persist: false
    }
  };

  constructor(props, context) {
    super(props, context);

    this._updatingBounds = false;
    this._shouldComponentUpdate = false;

    this._updatingState = false;
    this._key = 'sticky_' + Math.round(Math.random() * 1000);

    if (props.debug === true) {
      log = console.log.bind(console);
    }


    this.state = initialState;
  }


  getBoundingClientRect() {
    return this.refs.el.getBoundingClientRect();
  }

  getBounds(noCache) {

    var clientRect = this.getBoundingClientRect();
    var offsetHeight = ScrollFeatures.documentHeight || 0;
    noCache = noCache === true;

    if (noCache !== true && this.state.bounds.height !== null) {
      if (this.state.offsetHeight === offsetHeight && clientRect.height === this.state.bounds.height) {
        return {
          offsetHeight: offsetHeight,
          style: this.state.style,
          bounds: this.state.bounds,
          restrict: this.state.restrict
        };
      }
    }

    // var style = noCache ? this.state.style : getPositionStyle(this.refs.el);
    var initialStyle = this.state.initialStyle;
    if (!initialStyle) {
      initialStyle = getPositionStyle(this.refs.el);
    }

    var style = initialStyle;
    var child = this.refs.wrapper || this.refs.el;
    var rect;
    var restrict;
    var offsetY = 0;
    var offsetX = 0;

    if (!Can.sticky) {
      rect = getAbsolutBoundingRect(child, clientRect.height);
      if (this.hasOwnScrollTarget) {
        var parentRect = getAbsolutBoundingRect(this.scrollTarget);
        offsetY = this.scroll.y;
        rect = addBounds(rect, parentRect);
        rect.top += offsetY;
        restrict = parentRect;
        restrict.top = 0;
        restrict.height = this.scroll.scrollHeight || restrict.height;
        restrict.bottom = restrict.height;
        var elem = child.parentNode;
        if(elem){
          var elemRect = getAbsolutBoundingRect(elem);
          restrict.height = offsetY + elemRect.height + (elemRect.top || 0);
          restrict.bottom = restrict.height;
        }
      }
    } else {
      var elem = getPreviousElementSibling(child);
      offsetY = 0;

      if (elem) {
        offsetY = parseInt(window.getComputedStyle(elem)['margin-bottom']);
        offsetY = offsetY || 0;
        rect = getAbsolutBoundingRect(elem);
        if (this.hasOwnScrollTarget) {
          rect = addBounds(rect, getAbsolutBoundingRect(this.scrollTarget));
          offsetY += this.scroll.y;
        }
        rect.top = rect.bottom + offsetY;

      } else {
        elem = child.parentNode;
        offsetY = parseInt(window.getComputedStyle(elem)['padding-top']);
        offsetY = offsetY || 0;
        rect = getAbsolutBoundingRect(elem);
        if (this.hasOwnScrollTarget) {
          rect = addBounds(rect, getAbsolutBoundingRect(this.scrollTarget));
          offsetY += this.scroll.y;
        }
        rect.top = rect.top + offsetY;
      }
      if (this.hasOwnScrollTarget) {
        restrict = getAbsolutBoundingRect(this.scrollTarget);
        restrict.top = 0;
        restrict.height = this.scroll.scrollHeight || restrict.height;
        restrict.bottom = restrict.height;
      }

      rect.height = child.clientHeight;
      rect.width = child.clientWidth;
      rect.bottom = rect.top + rect.height;
    }

    restrict = restrict || getAbsolutBoundingRect(child.parentNode);

    return {
      offsetHeight: offsetHeight,
      style: style,
      bounds: rect,
      initialStyle: initialStyle,
      restrict: restrict
    };
  }

  updateBounds(noCache = true, shouldComponentUpdate = true, cb) {
    this._shouldComponentUpdate = shouldComponentUpdate;
    this.setState(this.getBounds(noCache), () => {
      this._shouldComponentUpdate = true;
      if (cb) {
        cb();
      }
    });
  }

  getStickyState() {

    if (this.state.disabled) {
      return { sticky: false, absolute: false };
    }

    var scrollY = this.scroll.y;
    var scrollX = this.scroll.x;
    var top = this.state.style.top;
    var bottom = this.state.style.bottom;
    var left = this.state.style.left;
    var right = this.state.style.right;
    var sticky = this.state.sticky;
    var absolute = this.state.absolute;

    if (top !== null) {
      var offsetBottom = this.state.restrict.bottom - this.state.bounds.height - top;
      top = this.state.bounds.top - top;

      if (this.state.sticky === false && ((scrollY >= top && scrollY <= offsetBottom) || (top <= 0 && scrollY < top))) {
        sticky = true;
        absolute = false;
      } else if (this.state.sticky && (top > 0 && scrollY < top || scrollY > offsetBottom)) {
        sticky = false;
        absolute = scrollY > offsetBottom;
      }
    } else if (bottom !== null) {

      scrollY += window.innerHeight;
      var offsetTop = this.state.restrict.top + this.state.bounds.height - bottom;
      bottom = this.state.bounds.bottom + bottom;

      if (this.state.sticky === false && scrollY <= bottom && scrollY >= offsetTop) {
        sticky = true;
        absolute = false;
      } else if (this.state.sticky && (scrollY > bottom || scrollY < offsetTop)) {
        sticky = false;
        absolute = scrollY <= offsetTop;
      }
    }
    return { sticky: sticky, absolute: absolute };
  }

  updateStickyState(bounds = true, cb) {
    if (this._updatingState) {
      return;
    }
    var values = this.getStickyState();

    if (values.sticky !== this.state.sticky || values.absolute !== this.state.absolute) {
      this._updatingState = true;
      if (bounds) {
        values = assign(values, this.getBounds(), { scrollClass: this.getScrollClass() });
      }
      this.setState(values, () => {
        this._updatingState = false;
        if (typeof cb === 'function') {
          cb();
        }
      });
      return true;
    } else if (typeof cb === 'function') {
      cb();
    }
    return false;
  }

  updateFixedOffset() {
    if (this.hasOwnScrollTarget && !Can.sticky) {

      if (this.state.sticky) {
        this.setState({ fixedOffset: this.scrollTarget.getBoundingClientRect().top + 'px' });
        if (!this.hasWindowScrollListener) {
          this.hasWindowScrollListener = true;
          ScrollFeatures.getInstance(window).on('scroll:progress', this.updateFixedOffset);
        }
      } else {
        this.setState({ fixedOffset: '' });
        if (this.hasWindowScrollListener) {
          this.hasWindowScrollListener = false;
          ScrollFeatures.getInstance(window).off('scroll:progress', this.updateFixedOffset);
        }
      }
    }
  }


  update(force = false) {

    if (!this._updatingBounds) {
      log('update():: force:' + force);
      this._updatingBounds = true;
      this.updateBounds(true, true, () => {
        this.scroll.updateScrollPosition();
        this.updateBounds(force, true, () => {
          this.scroll.updateScrollPosition();
          var updateSticky = this.updateStickyState(false, () => {
            if (force && !updateSticky) {
              this.forceUpdate();
            }
          });
          this._updatingBounds = false;
        });
      });
    }
  }

  initialize() {
    var child = this.refs.wrapper || this.refs.el;
    this.scrollTarget = ScrollFeatures.getScrollParent(child);
    this.hasOwnScrollTarget = this.scrollTarget !== window;
    if (this.hasOwnScrollTarget) {
      this.updateFixedOffset = ::this.updateFixedOffset;
    }

    this.addSrollHandler();
    this.addResizeHandler();
    this.update();
  }

  addSrollHandler() {
    if (!this.scroll) {
      this.scroll = ScrollFeatures.getInstance(this.scrollTarget);
      this.onScroll = ::this.onScroll;
      this.onScrollDirection = ::this.onScrollDirection;
      this.scroll.on('scroll:start', this.onScroll);
      this.scroll.on('scroll:progress', this.onScroll);
      this.scroll.on('scroll:stop', this.onScroll);
      if (this.props.scrollClass.up || this.props.scrollClass.down) {
        this.scroll.on('scroll:up', this.onScrollDirection);
        this.scroll.on('scroll:down', this.onScrollDirection);
        if (!this.props.scrollClass.persist) {
          this.scroll.on('scroll:stop', this.onScrollDirection);
        }
      }
    }
  }

  removeSrollHandler() {
    if (this.scroll) {
      this.scroll.off('scroll:start', this.onScroll);
      this.scroll.off('scroll:progress', this.onScroll);
      this.scroll.off('scroll:stop', this.onScroll);
      this.scroll.off('scroll:up', this.onScrollDirection);
      this.scroll.off('scroll:down', this.onScrollDirection);
      this.scroll.off('scroll:stop', this.onScrollDirection);
      if (!this.scroll.hasListeners()) {
        this.scroll.destroy();

      }
      this.onScroll = null;
      this.onScrollDirection = null;
      this.scroll = null;
    }
  }

  addResizeHandler() {
    if (!this.resizeHandler) {
      this.resizeHandler = ::this.onResize;
      window.addEventListener('sticky:update', this.resizeHandler, false);
      window.addEventListener('resize', this.resizeHandler, false);
      window.addEventListener('orientationchange', this.resizeHandler, false);
    }
  }

  removeResizeHandler() {
    if (this.resizeHandler) {
      window.removeEventListener('sticky:update', this.resizeHandler);
      window.removeEventListener('resize', this.resizeHandler);
      window.removeEventListener('orientationchange', this.resizeHandler);
      this.resizeHandler = null;
    }
  }


  getScrollClass() {
    if (this.props.scrollClass.up || this.props.scrollClass.down) {

      var direction = (this.scroll.y <= 0 || this.scroll.y + this.scroll.clientHeight >= this.scroll.scrollHeight) ? 0 : this.scroll.directionY;
      var scrollClass = direction < 0 ? this.props.scrollClass.up : this.props.scrollClass.down;
      scrollClass = direction === 0 ? null : scrollClass;
      return scrollClass;
    }
    return null;
  }

  onScrollDirection(e) {

    if (this.state.sticky || e && e.type === ScrollFeatures.EVENT_SCROLL_STOP) {
      this.setState({
          scrollClass: this.getScrollClass()
        })
        // this.refs.el.className = classNames(this.refs.el.className, this.getScrollClassObj());
    }
  }


  onScroll(e) {
    this.updateStickyState();
    if (this.hasOwnScrollTarget && !Can.sticky) {
      this.updateFixedOffset();
      if (this.state.sticky && !this.hasWindowScrollListener) {
        this.hasWindowScrollListener = true;
        ScrollFeatures.getInstance(window).on('scroll:progress', this.updateFixedOffset);
      } else if (!this.state.sticky && this.hasWindowScrollListener) {
        this.hasWindowScrollListener = false;
        ScrollFeatures.getInstance(window).off('scroll:progress', this.updateFixedOffset);
      }
    }
  }

  onResize(e) {
    this.update();
  }

  shouldComponentUpdate(newProps, newState) {
    return this._shouldComponentUpdate;
  }


  componentWillReceiveProps(props) {
    if (props.disabled !== this.state.disabled) {
      this.setState({
        disabled: props.disabled
      });
    }
  }

  componentDidMount() {
    setTimeout(() => this.initialize(), 1);
    this.timer = setInterval(() => {
      if( this.timer ){
        this.updateBounds();
      }
    }, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    this.timer = null;
    this._shouldComponentUpdate = false;
    this.removeSrollHandler();
    this.removeResizeHandler();
    this.scrollTarget = null;
  }

  render() {
    let element = React.Children.only(this.props.children);

    const { stickyWrapperClass, stickyClass, fixedClass, stateClass, disabledClass, absoluteClass, disabled, debug, tagName, ...props } = this.props;

    var style;
    const refName = 'el';
    const className = classNames({
      [stickyClass]: !this.state.disabled, [disabledClass]: this.state.disabled }, {
      [fixedClass]: !Can.sticky }, {
      [stateClass]: this.state.sticky && !this.state.disabled }, {
      [absoluteClass]: this.state.absolute }, this.state.scrollClass);



    if (!Can.sticky) {
      if (this.state.absolute) {

        style = {
          marginTop: this.state.style.top !== null ? (this.state.restrict.height - (this.state.bounds.height + this.state.style.top) + (this.state.restrict.top - this.state.bounds.top)) + 'px' : '',
          marginBottom: this.state.style.bottom !== null ? (this.state.restrict.height - (this.state.bounds.height + this.state.style.bottom) + (this.state.restrict.bottom - this.state.bounds.bottom)) + 'px' : ''
        };
      } else if (this.hasOwnScrollTarget && this.state.fixedOffset !== '') {
        style = {
          marginTop: this.state.fixedOffset
        };
      }
    }

    if (element) {
      element = React.cloneElement(element, { ref: refName, key: this._key, style: style, className: classNames(element.props.className, className) });
    } else {
      const Comp = this.props.tagName;
      element = <Comp ref = { refName }
      key = { this._key }
      style = { style }
      className = { className } {...props }> { this.props.children } </Comp>;
    }

    if (Can.sticky) {
      return element;
    }

    const height = (this.state.disabled || this.state.bounds.height === null || (!this.state.sticky && !this.state.absolute)) ? 'auto' : this.state.bounds.height + 'px';
    const marginTop = height === 'auto' ? '' : (this.state.style['margin-top'] ? this.state.style['margin-top'] + 'px' : '');
    const marginBottom = height === 'auto' ? '' : (this.state.style['margin-bottom'] ? this.state.style['margin-bottom'] + 'px' : '');

    style = {
      height: height,
      marginTop: marginTop,
      marginBottom: marginBottom
    };
    if (this.state.absolute) {
      style.position = 'relative';
    }
    return ( <div ref = 'wrapper'
      className = { stickyWrapperClass }
      style = { style }> { element } </div>
    );
  }
}


var _canSticky = null;

class Can {

  static get sticky() {
    if (_canSticky !== null) {
      return _canSticky;
    }
    if (typeof window !== 'undefined') {

      if (window.Modernizr && window.Modernizr.hasOwnProperty('csspositionsticky')) {
        return _globals.canSticky = window.Modernizr.csspositionsticky;
      }

      var documentFragment = document.documentElement;
      var testEl = document.createElement('div');
      documentFragment.appendChild(testEl);
      var prefixedSticky = ['sticky', '-webkit-sticky'];

      _canSticky = false;

      for (var i = 0; i < prefixedSticky.length; i++) {
        testEl.style.position = prefixedSticky[i];
        _canSticky = !!window.getComputedStyle(testEl).position.match('sticky');
        if (_canSticky) {
          break;
        }
      }
      documentFragment.removeChild(testEl);
    }
    return _canSticky;
  };

}
