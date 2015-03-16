!function($) {
  var nextId = 0

  var needScroller = navigator.userAgent.toLowerCase().indexOf('gecko/') >= 0;

  var Scroller = function() {
  };

  Scroller.prototype.scrollEvent = function(element, originalEvent) {
    var event = new CustomEvent('dragscroll', {
      detail: {
        element: [ $(element) ],
        originalEvent: originalEvent
      }
    });
    document.dispatchEvent(event);
  };

  Scroller.prototype.scroll = function(e) {
    var
      d = e.detail,
      originalEvent = d.originalEvent.originalEvent || d.originalEvent,
      winWidth = window.innerWidth,
      winHeight = window.innerHeight,
      scrollSpeed = 5,
      scrollSensitivity = 50,
      step = 20,
      x,
      y

    e.stopPropagation();

    if (originalEvent.pageY) {
      y = originalEvent.pageY - window.pageYOffset
    }

    if (originalEvent.pageX) {
      x = originalEvent.pageX - window.pageXOffset
    }

    var moveY;
    if (y >= winHeight - scrollSensitivity) {
      moveY = window.scrollY + step;
    } else if (y <= scrollSensitivity) {
      moveY = window.scrollY - step;
    }

    var moveX;
    if (x >= winWidth - scrollSensitivity) {
      moveX = window.scrollX + step;
    } else if (x <= scrollSensitivity) {
      moveX = window.scrollX - step;
    }

    if (moveX) {
      window.scrollTo(moveX, window.pageYOffset);
    } else if (moveY) {
      window.scrollTo(window.pageXOffset, moveY);
    }
  };

  if (needScroller) {
    // https://github.com/rkusa/zepto-dnd/issues/19#issuecomment-77806753
    var scroller = new Scroller();
    document.addEventListener('dragover', function(e) {
      scroller.scrollEvent(e.explicitOriginalTarget, e);
    });
    document.addEventListener('dragscroll', scroller.scroll.bind(scroller));
  };

  var Dragging = function() {
    this.eventHandler = $('<div />')
    this.origin = this.el = null

    var placeholder
    Object.defineProperty(this, 'placeholder', {
      get: function() { return placeholder },
      set: function(val) {
        if (placeholder === val) return
        if (placeholder) placeholder.remove()
        placeholder = val
      }
    })
  }

  Dragging.prototype.on = function() {
    this.eventHandler.on.apply(this.eventHandler, Array.prototype.slice.call(arguments))
    return this
  }

  Dragging.prototype.off = function() {
    this.eventHandler.off.apply(this.eventHandler, Array.prototype.slice.call(arguments))
    return this
  }

  Dragging.prototype.start = function(origin, el, evt) {
    this.origin = origin
    this.el = el
    this.eventHandler.trigger('dragging:start')

    if (origin.opts.clonePlaceholder) {
      if (typeof origin.opts.clonePlaceholder === 'function') {
        this.placeholder = origin.opts.clonePlaceholder.call(this);
      } else if (origin.opts.clonePlaceholder === true) {
        this.placeholder = $(this.el[0].cloneNode(true));
        if (origin.opts.placeholder && this.placeholder) {
          this.placeholder.addClass(origin.opts.placeholder);
        }
      }
    }

    this.dragImageEl = this.dragImageEl || document.createElement('img');
    if (origin.opts.dragImage === false) {
      // noop
    } else if (typeof origin.opts.dragImage === 'string') {
      this.dragImageEl.src = origin.opts.dragImage
    } else if (origin.opts.dragImage instanceof HTMLElement) {
      this.dragImageEl = origin.opts.dragImage;
    } else {
      delete this.dragImageEl;
    }
    if (this.dragImageEl) {
      evt.dataTransfer.setDragImage(this.dragImageEl, 0, 0);
      delete this.dragImageEl;
    }

    return this.el
  }

  Dragging.prototype.stop = function() {
    this.origin = this.el = this.placeholder = null
    this.eventHandler.trigger('dragging:stop')
  }

  Dragging.prototype.parentDraggable = function(state, args) {
    if (this.opts.handle && args[0] && args[0].target) {
      var $parent = $(args[0].target).closest(this.opts.items);
      $parent.prop('draggable', state);
    }
  }

  var dragging = $.dragging = parent.$.dragging || new Dragging()

  // from https://github.com/rkusa/selector-observer
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver
  function matches(el, selector) {
    var fn = el.matches || el.matchesSelector || el.msMatchesSelector || el.mozMatchesSelector || el.webkitMatchesSelector || el.oMatchesSelector
    return fn ? fn.call(el, selector) : false
  }
  function toArr(nodeList) {
    return Array.prototype.slice.call(nodeList)
  }

  // polyfill for IE < 11
  var isOldIE = false
  if (typeof MutationObserver === 'undefined') {
    MutationObserver = function(callback) {
      this.targets = []
      this.onAdded = function(e) {
        callback([{ addedNodes: [e.target], removedNodes: [] }])
      }
      this.onRemoved = function(e) {
        callback([{ addedNodes: [], removedNodes: [e.target] }])
      }
    }

    MutationObserver.prototype.observe = function(target) {
      target.addEventListener('DOMNodeInserted', this.onAdded)
      target.addEventListener('DOMNodeRemoved', this.onRemoved)
      this.targets.push(target)
    }

    MutationObserver.prototype.disconnect = function() {
      var target
      while (target = this.targets.shift()) {
        target.removeEventListener('DOMNodeInserted', this.onAdded)
        target.removeEventListener('DOMNodeRemoved', this.onRemoved)
      }
    }

    isOldIE = !!~navigator.appName.indexOf('Internet Explorer')
  }

  var SelectorObserver = function(targets, selector, onAdded, onRemoved) {
    var self     = this
    this.targets = targets instanceof NodeList
                     ? Array.prototype.slice.call(targets)
                     : [targets]

    // support selectors starting with the childs only selector `>`
    var childsOnly = selector[0] === '>'
    var search = childsOnly ? selector.substr(1) : selector
    var initialized = false

    function query(nodes, deep) {
      var result = []

      toArr(nodes).forEach(function(node) {
        //ignore non-element nodes
        if (node.nodeType !== 1) return;

        // if looking for childs only, the node's parentNode
        // should be one of our targets
        if (childsOnly && self.targets.indexOf(node.parentNode) === -1) {
          return
        }

        // test if the node itself matches the selector
        if (matches(node, search)) {
          result.push(node)
        }

        if (childsOnly || !deep) {
          return
        }

        toArr(node.querySelectorAll(selector)).forEach(function(node) {
          result.push(node)
        })
      })

      return result
    }

    function apply(nodes, deep, callback) {
      if (!callback) {
        return
      }

      // flatten
      query(nodes, deep)
      // filter unique nodes
      .filter(function(node, i, self) {
        return self.indexOf(node) === i
      })
      // execute callback
      .forEach(function(node) {
        callback.call(node)
      })
    }

    var timeout      = null
    var addedNodes   = []
    var removedNodes = []

    function handle() {
      self.disconnect()

      // filter moved elements (removed and re-added)
      for (var i = 0, len = removedNodes.length; i < len; ++i) {
        var index = addedNodes.indexOf(removedNodes[i])
        if (index > -1) {
          addedNodes.splice(index, 1)
          removedNodes.splice(i--, 1)
        }
      }

      //                ↓ IE workarounds ...
      apply(addedNodes, !(initialized && isOldIE), onAdded)
      apply(removedNodes, true, onRemoved)

      addedNodes.length   = 0
      removedNodes.length = 0

      self.observe()
    }

    this.observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        addedNodes.push.apply(addedNodes, mutation.addedNodes)
        removedNodes.push.apply(removedNodes, mutation.removedNodes)
      })

      // IE < 10 fix: wait a cycle to gather all mutations
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout(handle)
    })

    // call onAdded for existing elements
    if (onAdded) {
      this.targets.forEach(function(target) {
        apply(target.children, true, onAdded)
      })
    }

    initialized = true

    this.observe()
  }

  SelectorObserver.prototype.disconnect = function() {
    this.observer.disconnect()
  }

  SelectorObserver.prototype.observe = function() {
    var self = this
    this.targets.forEach(function(target) {
      self.observer.observe(target, { childList: true, subtree: true })
    })
  }

  var Draggable = function(element, opts) {
    this.id       = nextId++
    this.el  = $(element)
    this.opts     = opts
    this.cancel   = opts.handle !== false

    this.connectedWith = []
    if (this.opts.connectWith) {
      this.connectWith(this.opts.connectWith)
    }
  }

  Draggable.prototype.connectWith = function(connectWith) {
    var self = this
      , target = $(connectWith)
      , context = window
    if (target[0].ownerDocument !== document) {
      context = target[0].ownerDocument.defaultView
    }
    context.$(connectWith).each(function() {
      var el = context.$(this)
      if (el[0] === self.el[0]) return
      var instance = el.data('sortable') || el.data('droppable')
      if (instance) instance.connectedWith.push(self.id)
      else {
        el.one('sortable:create droppable:create', function(e, instance) {
          instance.connectedWith.push(self.id)
        })
      }
    })
  }

  Draggable.prototype.create = function() {
    this.el
    .on('dragstart', $.proxy(this.start, this))
    .on('dragend',   $.proxy(this.end, this))

    // Prevents dragging from starting on specified elements.
    this.el
    .on('mouseenter', this.opts.cancel, $.proxy(this.disable, this))
    .on('mouseleave', this.opts.cancel, $.proxy(this.enable, this))

    if (this.opts.handle) {
      this.el
      .on('mouseenter', this.opts.handle, $.proxy(this.enable, this))
      .on('mouseleave', this.opts.handle, $.proxy(this.disable, this))
    } else {
      this.el.prop('draggable', true)
    }

    var self = this
    setTimeout(function() {
      self.el.trigger('draggable:create', self)
    })
  }

  Draggable.prototype.destroy = function() {
    this.el
    .off('dragstart', this.start)
    .off('dragend',   this.end)
    .prop('draggable', false)

    this.el
    .off('mouseenter', this.opts.cancel, this.disable)
    .off('mouseleave', this.opts.cancel, this.enable)

    if (this.opts.handle) {
      this.el
      .off('mouseenter', this.opts.handle, this.enable)
      .off('mouseleave', this.opts.handle, this.disable)
    }
  }

  Draggable.prototype.enable = function() {
    dragging.parentDraggable.call(this, true, arguments);
    this.opts.disabled = false
  }

  Draggable.prototype.disable = function() {
    dragging.parentDraggable.call(this, false, arguments);
    this.opts.disabled = true
  }

  Draggable.prototype.start = function(e) {
    if (this.opts.disabled) return false

    e = e.originalEvent || e // zepto <> jquery compatibility
    e.dataTransfer.effectAllowed = 'copy'
    try { // IE fix
      // FF fix: set some data ....
      e.dataTransfer.setData('text/plain', '42')
    } catch(e) {}

    dragging.start(this, this.el, e).addClass('dragging')
  }

  Draggable.prototype.end = function(e) {
    e.stopPropagation()
    e.preventDefault()

    if (!dragging.el) return

    // revert
    this.el.removeClass('dragging')
    dragging.stop()
  }

  var Droppable = function(element, opts) {
    this.id            = nextId++
    this.el            = $(element)
    this.opts          = opts
    this.accept        = false
    this.connectedWith = []
  }

  Droppable.prototype.create = function() {
    this.el
    .on('dragover',  $.proxy(this.over, this))
    .on('dragenter', $.proxy(this.enter, this))
    .on('dragleave', $.proxy(this.leave, this))
    .on('drop',      $.proxy(this.drop, this))

    dragging
    .on('dragging:start', $.proxy(this.activate, this))
    .on('dragging:stop',  $.proxy(this.reset, this))

    var self = this
    setTimeout(function() {
      self.el.trigger('droppable:create', self)
    })
  }

  Droppable.prototype.destroy = function() {
    this.el
    .off('dragover',  this.over)
    .off('dragenter', this.enter)
    .off('dragleave', this.leave)
    .off('drop',      this.drop)

    // Todo: Fix Zepto Bug
    // dragging
    // .off('dragging:start', this.activate)
    // .off('dragging:stop',  this.reset)
  }

  Droppable.prototype.enable = function() {
    this.opts.disabled = false
  }

  Droppable.prototype.disable = function() {
    this.opts.disabled = true
  }

  Droppable.prototype.activate = function(e) {
    this.accept = this.connectedWith.indexOf(dragging.origin.id) !== -1
    if (!this.accept) {
      var accept = this.opts.accept === '*'
                || (typeof this.opts.accept === 'function' ? this.opts.accept.call(this.el[0], dragging.el)
                                                           : dragging.el.is(this.opts.accept))
      if (this.opts.scope !== 'default') {
        this.accept = dragging.origin.opts.scope === this.opts.scope
        if (!this.accept && this.opts.accept !== '*') this.accept = accept
      } else this.accept = accept
    }

    if (!this.accept) return
    if (this.opts.activeClass)
      this.el.addClass(this.opts.activeClass)

    this.el.trigger('droppable:activate', dragging.el)
  }

  Droppable.prototype.reset = function(e) {
    if (!this.accept) return
    if (this.opts.activeClass) this.el.removeClass(this.opts.activeClass)
    if (this.opts.hoverClass)  this.el.removeClass(this.opts.hoverClass)

    this.el.trigger('droppable:deactivate', dragging.el)
  }

  Droppable.prototype.enter = function(e) {
    if (this.opts.disabled) return false

    e.stopPropagation()
    e = e.originalEvent || e // zepto <> jquery compatibility

    // toLowerCase() is a IE fix
    var effectAllowed = e.dataTransfer.effectAllowed.toLowerCase()
    // Safari fix
    if (effectAllowed === 'all') {
      effectAllowed = 'copymove'
    }

    // hide placeholder, if set (e.g. enter the droppable after
    // entering a sortable)
    if (dragging.placeholder && !(effectAllowed === 'copymove' && this.opts.clone)) {
      if (this.opts.clonePlaceholder) {
        this.el.append(dragging.placeholder);
      } else {
        dragging.placeholder.hide();
      }
    }

    if (this.opts.hoverClass && this.accept)
      this.el.addClass(this.opts.hoverClass)
  }

  Droppable.prototype.over = function(e) {
    e.stopPropagation()

    if (!this.accept || this.opts.disabled) return

    e.preventDefault() // allow drop

    e = e.originalEvent || e // zepto <> jquery compatibility
    e.dataTransfer.dropEffect = 'copyMove'
  }

  Droppable.prototype.leave = function(e) {
    if (this.opts.disabled) return false
    // e.stopPropagation()

    if (this.opts.hoverClass && this.accept)
      this.el.removeClass(this.opts.hoverClass)
  }

  Droppable.prototype.drop = function(e) {
    if (this.opts.disabled) return false

    e.stopPropagation() // stops the browser from redirecting.
    e.preventDefault()

    if (!dragging.el) return

    dragging.el.removeClass('dragging')

    // zepto <> jquery compatibility
    if (e.originalEvent) e = e.originalEvent

    // (toLowerCase() is a IE fix)
    switch (e.dataTransfer.effectAllowed.toLowerCase()) {
      // all is a Safari fix
      case 'all':
      case 'copymove':
        if (!this.opts.clone) break
        dragging.el.show()
      case 'copy':
        dragging.el = dragging.el.clone()
        break
    }

    $(this.el).append(dragging.el.show())

    this.el.trigger('droppable:receive', { item: dragging.el })

    dragging.stop()
  }

  var Sortable = function(element, opts) {
    this.id   = nextId++
    this.el   = element
    this.opts = opts
    this.scroller = needScroller && new Scroller()

    var tag
    try {
      tag = this.el.find(this.opts.items)[0].tagName
    } catch(e) {
      tag = /^ul|ol$/i.test(this.el.tagName) ? 'li' : 'div'
    }

    this.placeholder = $('<' + tag + ' class="' + this.opts.placeholder + '" />')

    this.accept = this.index = this.lastEntered = null
    this.lastX  = this.lastY = this.direction = null
    this.connectedWith = []
    if (this.opts.connectWith) {
      this.connectWith(this.opts.connectWith)
    }
  }

  Sortable.prototype.connectWith = Draggable.prototype.connectWith

  Sortable.prototype.create = function() {
    this.el
    .on('dragstart', this.opts.items, $.proxy(this.start, this))
    .on('dragenter', this.opts.items, $.proxy(this.enter, this))
    .on('dragover',  this.opts.items, $.proxy(this.over, this))
    .on('dragend',   this.opts.items, $.proxy(this.end, this))
    .on('drop',      this.opts.items, $.proxy(this.drop, this))

    this.el
    .on('dragenter',  $.proxy(this.enter, this))
    .on('dragover',   $.proxy(this.over, this))
    .on('dragend',    $.proxy(this.end, this))
    .on('drop',       $.proxy(this.drop, this))
    .on('mouseenter', this.opts.cancel, $.proxy(this.disable, this))
    .on('mouseleave', this.opts.cancel, $.proxy(this.enable, this))

    if (this.opts.handle) {
      this.el
      .on('mouseenter', this.opts.handle, $.proxy(this.enable, this))
      .on('mouseleave', this.opts.handle, $.proxy(this.disable, this))
    } else {
      this.el.find(this.opts.items).prop('draggable', true)
    }

    dragging
    .on('dragging:start', $.proxy(this.activate, this))
    .on('dragging:stop',  $.proxy(this.reset, this))

    var self = this
    setTimeout(function() {
      self.el.trigger('sortable:create', self)
    })

    this.observer = new SelectorObserver(this.el[0], this.opts.items, function() {
      if (!self.opts.handle) {
        $(this).prop('draggable', true)
      }
    }, function() {
      if (this === self.placeholder[0]) {
        return // ignore placeholder
      }
      var item = $(this)
      self.el.trigger('sortable:sort',   { item: item })
      self.el.trigger('sortable:update', { item: item, index: -1 })
      self.el.trigger('sortable:change', { item: item })
    })
  }

  Sortable.prototype.destroy = function() {
    this.el
    .off('dragstart', this.opts.items, this.start)
    .off('dragenter', this.opts.items, this.enter)
    .off('dragover',  this.opts.items, this.over)
    .off('dragend',   this.opts.items, this.end)
    .off('drop',      this.opts.items, this.drop)
    .find(this.opts.items).prop('draggable', false)

    this.el
    .off('dragenter',  this.enter)
    .off('dragover',   this.over)
    .off('dragend',    this.end)
    .off('drop',       this.drop)
    .off('mouseenter', this.opts.cancel, this.disable)
    .off('mouseleave', this.opts.cancel, this.enable)

    if (this.opts.handle) {
      this.el
      .off('mouseenter', this.opts.handle, this.enable)
      .off('mouseleave', this.opts.handle, this.disable)
    }

    // Todo: Fix Zepto Bug
    // dragging
    // .off('dragging:start', this.activate)
    // .off('dragging:stop',  this.reset)

    this.observer.disconnect()
  }

  Sortable.prototype.enable = function() {
    dragging.parentDraggable.call(this, true, arguments);
    this.opts.disabled = false
  }

  Sortable.prototype.disable = function() {
    dragging.parentDraggable.call(this, false, arguments);
    this.opts.disabled = true
  }

  Sortable.prototype.activate = function(e) {
    this.accept  = dragging.origin.id === this.id
                   || !!~this.connectedWith.indexOf(dragging.origin.id)
    this.isEmpty = this.el.find(this.opts.items).length === 0

    if (!this.accept) return

    this.accept = this.opts.accept === '*'
                || (typeof this.opts.accept === 'function' ? this.opts.accept.call(this.el[0], dragging.el)
                                                           : dragging.el.is(this.opts.accept))
    if (!this.accept) return

    if (this.opts.activeClass)
      this.el.addClass(this.opts.activeClass)

    this.el.trigger('sortable:activate', dragging.el)
  }

  Sortable.prototype.reset = function(e) {
    if (!this.accept) return
    if (this.opts.activeClass) this.el.removeClass(this.opts.activeClass)

    this.el.trigger('sortable:deactivate', dragging.el)
  }

  Sortable.prototype.start = function(e) {
    if (this.opts.disabled) return false

    e.stopPropagation()

    var target = e.currentTarget

    e = e.originalEvent || e // zepto <> jquery compatibility
    e.dataTransfer.effectAllowed = 'copyMove'
    try { // IE fix
      // FF fix: set some data ....
      e.dataTransfer.setData('text/plain', '42')
    } catch(e) {}

    dragging.start(this, $(target), e).addClass('dragging')
    this.index = dragging.el.index()

    if (this.opts.forcePlaceholderSize) {
      this.placeholder.height(parseFloat(dragging.el.css('height')))
      this.placeholder.width(parseFloat(dragging.el.css('width')))
    }

    this.el.trigger('dragging:start', { item: dragging.el })
  }

  Sortable.prototype.enter = function(e) {
    if (!this.accept || this.opts.disabled) return

    e.preventDefault()
    e.stopPropagation()

    // stop if event is fired on the placeholder
    var child = e.currentTarget, isContainer = child === this.el[0]
    if (child === this.placeholder[0]) return

    if (dragging.placeholder) {
      this.placeholder = dragging.placeholder;
    }

    // the container fallback is only necessary for empty sortables
    if (isContainer && !this.isEmpty && this.placeholder.parent().length)
      return

    if (this.opts.forcePlaceholderSize) {
      this.placeholder.height(parseFloat(dragging.el.css('height')))
      // this.placeholder.width(parseFloat(dragging.el.css('width')))
    }

    if (!isContainer) {
      e = e.originalEvent
      // check if we entered another element or if we changed the dragging direction
      if (this.lastEntered === child) {
        if ((this.direction === 'down' && (e.clientY < this.lastY || e.clientX < this.lastX))
          || (this.direction === 'up' && (e.clientY > this.lastY || e.clientX > this.lastX)))
          this.lastEntered = null
        else
          return
      }
      this.lastEntered = child
      this.lastX = e.clientX
      this.lastY = e.clientY
    }

    dragging.placeholder = this.placeholder.show()

    // if dragging an item that belongs to the current list, hide it while
    // it is being dragged
    if (this.index !== null)
      dragging.el.hide()

    if (!isContainer) {
      // insert the placeholder according to the dragging direction
      this.direction = this.placeholder.index() < $(child).index() ? 'down' : 'up'
      $(child)[this.direction === 'down' ? 'after' : 'before'](this.placeholder)
    } else {
      this.el.append(this.placeholder)
    }

    this.el.trigger('sortable:sort', { item: dragging.el })
  }

  Sortable.prototype.over = function(e) {
    if (this.scroller)
      this.scroller.scrollEvent(this.el, e);

    if (!this.accept || this.opts.disabled) return

    e.preventDefault() // allow drop
    e.stopPropagation()

    e = e.originalEvent || e // zepto <> jquery compatibility
    if (e.dataTransfer.effectAllowed === 'copy')
      e.dataTransfer.dropEffect = 'copy'
  }

  Sortable.prototype.end = function(e) {
    e.stopPropagation()
    e.preventDefault()

    if (!dragging.el) return

    this.el.trigger('sortable:beforeStop', { item: dragging.el })

    // revert
    dragging.el.removeClass('dragging').show()
    dragging.stop()

    this.index = null
    this.el.trigger('dragging:stop')
  }

  Sortable.prototype.drop = function(e) {
    e.stopPropagation()
    e.preventDefault()

    if (!dragging.el) return
    dragging.el.removeClass('dragging')

    e = e.originalEvent || e
    if (e.dataTransfer.effectAllowed === 'copy')
      dragging.el = dragging.el.clone()

    dragging.el.insertBefore(this.placeholder).show()

    // remove placeholder to be able to calculate new index
    dragging.placeholder = null

    // if the dropped element belongs to another list, trigger the receive event
    var newIndex = dragging.el.index()
    if (this.index === null) { // dropped element belongs to another list
      // if (dragging.origin instanceof Draggable)
      //   dragging.origin.destroy()

      this.el.trigger('sortable:receive', { item: dragging.el })
      this.el.trigger('sortable:update', { item: dragging.el, index: newIndex })

      // the receive event maybe inserted an element manually
      // if so, find it and make it draggable
      $(this.el.find(this.opts.items).get(newIndex)).prop('draggable', true)
    }
    // if the index changed, trigger the update event
    else if (newIndex !== this.index) {
      this.el.trigger('sortable:update', { item: dragging.el, index: newIndex })
    }

    this.el.trigger('sortable:change', { item: dragging.el })

    this.el.trigger('sortable:beforeStop', { item: dragging.el })
    if (dragging.origin instanceof Sortable) {
      dragging.origin.index = null
      dragging.origin.el.trigger('dragging:stop')
    }

    dragging.stop()

    this.el.trigger('dragging:stop')
  }

  Sortable.prototype.toArray = function(opts) {
    if (!opts) opts = {}
    var attr = opts.attribute || 'id', attrs = []
    this.el.find(this.opts.items).each(function() {
      attrs.push($(this).prop(attr))
    })
    return attrs
  }

  function generic(constructor, identifier, defaults) {
    return function(opts, name, value) {
      var result = []
      this.each(function() {
        var instance = $(this).data(identifier)
        if (typeof opts === 'string') {
          if (typeof instance === 'undefined')
            throw new Error(identifier + ' not defined')
          switch (opts) {
          case 'enable':  instance.enable();  break
          case 'disable': instance.disable(); break
          case 'destroy':
            instance.destroy()
            $(this).removeData(identifier)
            break
          case 'option':
            // set
            if (value !== undefined)
              instance.opts[name] = value
            else if (typeof name === 'object')
              instance.opts = $.extend(instance.opts, name)
            // get
            else if (name)
              result.push(instance.opts[name])
            else
              result.push(instance.opts)
            break
          // case 'serialize':
          //   if (identifier !== 'sortable') return
          //   result.push(instance.serialize())
          //   break
          case 'toArray':
            if (identifier !== 'sortable') return
            result.push(instance.toArray(name))
            break
          }
        } else {
          if (instance) {
            $.extend(instance.opts, opts) // merge options
            return this
          }
          instance = new constructor($(this), $.extend({}, defaults, opts))
          instance.create()
          $(this).data(identifier, instance)
        }
      })

      if (result.length)
        return result.length === 1 ? result[0] : result
      else
        return this
    }
  }

  $.fn.draggable = generic(Draggable, 'draggable', {
    cancel: 'input, textarea, button, select, option',
    connectedWith: false,
    cursor: 'auto',
    disabled: false,
    handle: false,
    initialized: false,
    scope: 'default'
  })

  $.fn.droppable = generic(Droppable, 'droppable', {
    accept: '*',
    activeClass: false,
    disabled: false,
    hoverClass: false,
    initialized: false,
    scope: 'default',
    clone: false
  })

  $.fn.sortable = generic(Sortable, 'sortable', {
    accept: '*',
    activeClass: false,
    cancel: 'input, textarea, button, select, option',
    connectWith: false,
    disabled: false,
    forcePlaceholderSize: false,
    handle: false,
    initialized: false,
    items: 'li, div',
    placeholder: 'placeholder'
  })
}(window.Zepto || window.jQuery)
