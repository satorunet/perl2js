/* built-in mini jQuery:  $("#id")->on("click", sub { ... })   (the real jQuery wins if the page loaded it) */
Perl2JS.module({ name: 'jQuery', init(api) {
  const root = api.root;
  let built = null;
// Used for `$("#id")->on("click", sub {...})`. If the real jQuery is loaded, that one wins.
function makeJQ(win) {
  const doc = win.document;
  const isStr = (x) => typeof x === 'string';
  const isFn = (x) => typeof x === 'function';
  const isPlain = (x) => x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype;
  const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  const uniq = (a) => Array.from(new Set(a));

  class JQ extends Array { static get [Symbol.species]() { return Array; } }
  const mkq = (a) => { const q = new JQ(); for (const x of a) if (x != null) q.push(x); return q; };
  const parseHTML = (h) => { const t = doc.createElement('template'); t.innerHTML = String(h).trim(); return Array.from(t.content.childNodes); };
  const AP = Array.prototype;

  function $(sel, ctx) {
    if (sel instanceof JQ) return mkq(sel);
    if (isFn(sel)) { ready(sel); return mkq([doc]); }
    if (isStr(sel)) {
      sel = sel.trim();
      if (sel[0] === '<' && sel[sel.length - 1] === '>' && sel.length > 2) {
        const m = /^<(\w+)\s*\/?>(?:<\/\1>)?$/.exec(sel);
        if (m) {
          const el = doc.createElement(m[1]);
          if (isPlain(ctx)) for (const k of Object.keys(ctx)) {
            const v = ctx[k], q = mkq([el]);
            if (k === 'text') q.text(v); else if (k === 'html') q.html(v); else if (k === 'css') q.css(v);
            else if (k === 'class') el.className = v; else if (k === 'val') el.value = v;
            else if (isFn(v) && /^[a-z]+$/.test(k)) q.on(k, v); else el.setAttribute(k, v);
          }
          return mkq([el]);
        }
        return mkq(parseHTML(sel));
      }
      const roots = ctx === undefined ? [doc] : Array.from($(ctx));
      return mkq(uniq(roots.flatMap((r) => Array.from(r.querySelectorAll(sel)))));
    }
    if (!sel) return mkq([]);
    if (sel.nodeType || sel === win) return mkq([sel]);
    if (typeof sel.length === 'number') return mkq(Array.from(sel));
    return mkq([sel]);
  }
  function ready(f) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => f.call(doc, $));
    else setTimeout(() => f.call(doc, $), 0);
  }

  const def = (name, fn) => Object.defineProperty(JQ.prototype, name, { value: fn, enumerable: false, configurable: true, writable: true });
  const defs = (o) => { for (const k of Object.keys(o)) def(k, o[k]); };
  const matches = (el, sel, i) => {
    if (isStr(sel)) return el.nodeType === 1 && el.matches(sel);
    if (isFn(sel)) return !!sel.call(el, i, el);
    if (sel instanceof JQ) return sel.includes(el);
    return el === sel;
  };
  const first = (q) => q[0];
  const px = (k, v) => (typeof v === 'number' && !/^(opacity|zIndex|fontWeight|lineHeight|flex|flexGrow|flexShrink|order|zoom)$/.test(k)) ? v + 'px' : v;
  const dataStore = new WeakMap();
  const evStore = new WeakMap();
  const dispOrig = new WeakMap();

  /* ---- traversal ---- */
  defs({
    each(cb) { for (let i = 0; i < this.length; i++) if (cb.call(this[i], i, this[i]) === false) break; return this; },
    map(cb) { const r = []; for (let i = 0; i < this.length; i++) { const v = cb.call(this[i], i, this[i]); if (Array.isArray(v)) r.push(...v); else if (v != null) r.push(v); } return mkq(r); },
    get(i) { return i === undefined ? Array.from(this) : this[i < 0 ? this.length + i : i]; },
    toArray() { return Array.from(this); },
    size() { return this.length; },
    eq(i) { return mkq([this[i < 0 ? this.length + i : i]]); },
    first() { return this.eq(0); },
    last() { return this.eq(-1); },
    slice(a, b) { return mkq(AP.slice.call(this, a, b)); },
    filter(sel) { return mkq(AP.filter.call(this, (el, i) => matches(el, sel, i))); },
    not(sel) { return mkq(AP.filter.call(this, (el, i) => !matches(el, sel, i))); },
    is(sel) { return AP.some.call(this, (el, i) => matches(el, sel, i)); },
    has(sel) { return mkq(AP.filter.call(this, (el) => isStr(sel) ? !!el.querySelector(sel) : el !== sel && el.contains(sel))); },
    find(sel) {
      if (isStr(sel)) return mkq(uniq(Array.from(this).flatMap((el) => Array.from(el.querySelectorAll(sel)))));
      const t = $(sel); return mkq(AP.filter.call(t, (n) => AP.some.call(this, (el) => el !== n && el.contains(n))));
    },
    add(sel, ctx) { return mkq(uniq([...this, ...$(sel, ctx)])); },
    index(sel) {
      if (sel === undefined) { const el = this[0]; return el && el.parentNode ? Array.from(el.parentNode.children).indexOf(el) : -1; }
      return isStr(sel) ? Array.from($(sel)).indexOf(this[0]) : Array.from(this).indexOf(sel instanceof JQ ? sel[0] : sel);
    },
    parent(sel) { return mkq(uniq(Array.from(this).map((e) => e.parentElement).filter((p) => p && (!sel || matches(p, sel))))); },
    parents(sel) {
      const r = [];
      for (const el of this) for (let p = el.parentElement; p; p = p.parentElement) if (!sel || matches(p, sel)) r.push(p);
      return mkq(uniq(r));
    },
    closest(sel) { return mkq(uniq(Array.from(this).map((e) => isStr(sel) ? e.closest(sel) : (() => { for (let p = e; p; p = p.parentElement) if (matches(p, sel)) return p; })()))); },
    children(sel) { return mkq(Array.from(this).flatMap((e) => Array.from(e.children)).filter((c) => !sel || matches(c, sel))); },
    contents() { return mkq(Array.from(this).flatMap((e) => Array.from(e.childNodes))); },
    siblings(sel) { return mkq(Array.from(this).flatMap((e) => Array.from(e.parentElement ? e.parentElement.children : []).filter((c) => c !== e && (!sel || matches(c, sel))))); },
    next(sel) { return mkq(Array.from(this).map((e) => e.nextElementSibling).filter((n) => n && (!sel || matches(n, sel)))); },
    prev(sel) { return mkq(Array.from(this).map((e) => e.previousElementSibling).filter((n) => n && (!sel || matches(n, sel)))); },
    nextAll(sel) { const r = []; for (const e of this) for (let n = e.nextElementSibling; n; n = n.nextElementSibling) if (!sel || matches(n, sel)) r.push(n); return mkq(r); },
    prevAll(sel) { const r = []; for (const e of this) for (let n = e.previousElementSibling; n; n = n.previousElementSibling) if (!sel || matches(n, sel)) r.push(n); return mkq(r); },
  });

  /* ---- attributes, classes, content ---- */
  const access = (q, key, val, get, set) => {
    if (key !== null && typeof key === 'object') { for (const k of Object.keys(key)) access(q, k, key[k], get, set); return q; }
    if (val === undefined) return q.length ? get(q[0], key) : undefined;
    for (let i = 0; i < q.length; i++) set(q[i], key, isFn(val) ? val.call(q[i], i, get(q[i], key)) : val);
    return q;
  };
  const classes = (s) => String(s).split(/\s+/).filter(Boolean);
  defs({
    addClass(c) { return this.each(function (i) { const v = isFn(c) ? c.call(this, i, this.className) : c; if (this.classList) this.classList.add(...classes(v)); }); },
    removeClass(c) { return this.each(function (i) { if (!this.classList) return; if (c === undefined) this.className = ''; else this.classList.remove(...classes(isFn(c) ? c.call(this, i, this.className) : c)); }); },
    toggleClass(c, state) { return this.each(function () { for (const k of classes(c)) this.classList.toggle(k, state === undefined ? undefined : !!state); }); },
    hasClass(c) { return AP.some.call(this, (e) => e.classList && e.classList.contains(c)); },
    attr(k, v) {
      if (v === null) return this.removeAttr(k);
      return access(this, k, v, (e, n) => { const a = e.getAttribute && e.getAttribute(n); return a === null ? undefined : a; }, (e, n, x) => e.setAttribute(n, x));
    },
    removeAttr(k) { return this.each(function () { for (const n of classes(k)) this.removeAttribute(n); }); },
    prop(k, v) { return access(this, k, v, (e, n) => e[n], (e, n, x) => { e[n] = x; }); },
    removeProp(k) { return this.each(function () { delete this[k]; }); },
    data(k, v) {
      const rd = (e, n) => {
        const st = dataStore.get(e) || {};
        if (n === undefined) { const o = Object.assign({}, e.dataset || {}); for (const x of Object.keys(o)) { try { o[x] = JSON.parse(o[x]); } catch (_) {} } return Object.assign(o, st); }
        if (n in st) return st[n];
        const a = e.dataset && e.dataset[camel(n)];
        if (a === undefined) return undefined;
        try { return JSON.parse(a); } catch (_) { return a; }
      };
      if (k === undefined) return this.length ? rd(this[0]) : undefined;
      return access(this, k, v, rd, (e, n, x) => { const st = dataStore.get(e) || {}; st[n] = x; dataStore.set(e, st); });
    },
    removeData(k) { return this.each(function () { const st = dataStore.get(this); if (st) { if (k === undefined) dataStore.delete(this); else delete st[k]; } }); },
    val(v) {
      if (v === undefined) {
        const e = this[0]; if (!e) return undefined;
        if (e.tagName === 'SELECT' && e.multiple) return Array.from(e.selectedOptions).map((o) => o.value);
        return e.value;
      }
      return this.each(function (i) {
        const x = isFn(v) ? v.call(this, i, this.value) : v;
        if (this.tagName === 'SELECT' && Array.isArray(x)) Array.from(this.options).forEach((o) => { o.selected = x.includes(o.value); });
        else if ((this.type === 'checkbox' || this.type === 'radio') && Array.isArray(x)) this.checked = x.includes(this.value);
        else this.value = x;
      });
    },
    html(v) {
      if (v === undefined) return this.length ? this[0].innerHTML : undefined;
      return this.each(function (i) { this.innerHTML = isFn(v) ? v.call(this, i, this.innerHTML) : v; });
    },
    text(v) {
      if (v === undefined) return Array.from(this).map((e) => e.textContent).join('');
      return this.each(function (i) { this.textContent = isFn(v) ? v.call(this, i, this.textContent) : v; });
    },
    css(k, v) {
      return access(this, k, v,
        (e, n) => win.getComputedStyle(e).getPropertyValue(kebab(n)),
        (e, n, x) => { e.style[camel(n)] = px(camel(n), x); });
    },
    width(v) { return this._dim('width', v); },
    height(v) { return this._dim('height', v); },
    _dim(k, v) {
      if (v === undefined) {
        const e = this[0]; if (!e) return undefined;
        if (e === win) return k === 'width' ? win.innerWidth : win.innerHeight;
        if (e === doc) return doc.documentElement[k === 'width' ? 'scrollWidth' : 'scrollHeight'];
        return e.getBoundingClientRect()[k];
      }
      return this.css(k, v);
    },
    offset() {
      const e = this[0]; if (!e) return undefined;
      const r = e.getBoundingClientRect();
      return { top: r.top + (win.pageYOffset || 0), left: r.left + (win.pageXOffset || 0) };
    },
    position() { const e = this[0]; return e ? { top: e.offsetTop, left: e.offsetLeft } : undefined; },
    scrollTop(v) { if (v === undefined) return this.length ? (this[0] === win || this[0] === doc ? win.pageYOffset : this[0].scrollTop) : undefined; return this.each(function () { if (this === win || this === doc) win.scrollTo(win.pageXOffset, v); else this.scrollTop = v; }); },
    scrollLeft(v) { if (v === undefined) return this.length ? (this[0] === win || this[0] === doc ? win.pageXOffset : this[0].scrollLeft) : undefined; return this.each(function () { if (this === win || this === doc) win.scrollTo(v, win.pageYOffset); else this.scrollLeft = v; }); },
  });

  /* ---- DOM manipulation ---- */
  const toNodes = (c) => {
    if (c == null || c === false) return [];
    if (isStr(c)) return parseHTML(c);
    if (typeof c === 'number') return [doc.createTextNode(String(c))];
    if (c.nodeType) return [c];
    if (typeof c.length === 'number') return Array.from(c).flatMap(toNodes);
    return [];
  };
  const insert = (q, args, place) => {
    const n = q.length;
    for (let i = 0; i < n; i++) {
      for (const a of args) {
        let nodes = toNodes(isFn(a) ? a.call(q[i], i, q[i].innerHTML) : a);
        if (i < n - 1) nodes = nodes.map((x) => x.cloneNode(true));
        place(q[i], nodes);
      }
    }
    return q;
  };
  defs({
    append(...a) { return insert(this, a, (t, n) => t.append(...n)); },
    prepend(...a) { return insert(this, a, (t, n) => t.prepend(...n)); },
    after(...a) { return insert(this, a, (t, n) => t.after(...n)); },
    before(...a) { return insert(this, a, (t, n) => t.before(...n)); },
    appendTo(t) { $(t).append(this); return this; },
    prependTo(t) { $(t).prepend(this); return this; },
    insertAfter(t) { $(t).after(this); return this; },
    insertBefore(t) { $(t).before(this); return this; },
    remove(sel) { for (const e of Array.from(this)) if (!sel || matches(e, sel)) e.remove(); return this; },
    detach(sel) { return this.remove(sel); },
    empty() { return this.each(function () { this.textContent = ''; }); },
    clone(deep) { return mkq(Array.from(this).map((e) => e.cloneNode(deep !== false))); },
    replaceWith(c) { return this.each(function (i) { this.replaceWith(...toNodes(isFn(c) ? c.call(this, i, this) : c)); }); },
    replaceAll(t) { $(t).replaceWith(this); return this; },
    wrap(w) {
      return this.each(function (i) {
        const wr = toNodes(isFn(w) ? w.call(this, i) : w)[0].cloneNode(true);
        let inner = wr; while (inner.firstElementChild) inner = inner.firstElementChild;
        this.replaceWith(wr); inner.append(this);
      });
    },
    unwrap() { this.parent().each(function () { if (this !== doc.body) this.replaceWith(...Array.from(this.childNodes)); }); return this; },
  });

  /* ---- events ---- */
  const parseTypes = (s) => String(s).split(/\s+/).filter(Boolean).map((t) => { const [type, ...ns] = t.split('.'); return { type, ns: ns.join('.') }; });
  const DELEG = { focus: 'focusin', blur: 'focusout', mouseenter: 'mouseover', mouseleave: 'mouseout' };
  defs({
    on(types, sel, data, fn, one) {
      if (types !== null && typeof types === 'object') { for (const k of Object.keys(types)) this.on(k, sel, data, types[k]); return this; }
      const args = [sel, data, fn].filter((x) => x !== undefined && x !== null && x !== one);
      fn = [...args].reverse().find(isFn);
      const rest = args.filter((x) => x !== fn);
      let selector, d;
      if (rest.length && isStr(rest[0])) { selector = rest[0]; d = rest[1]; } else d = rest[0];
      if (!fn) return this;
      return this.each(function () {
        const el = this;
        for (const { type, ns } of parseTypes(types)) {
          const real = selector && DELEG[type] ? DELEG[type] : type;
          const rec = { type, ns, sel: selector, fn, real };
          rec.w = function (e) {
            let target = el;
            if (selector) {
              const t = e.target && e.target.closest ? e.target.closest(selector) : null;
              if (!t || !el.contains(t) || t === el) return;
              if (type === 'mouseenter' || type === 'mouseleave') { const rel = e.relatedTarget; if (rel && t.contains(rel)) return; }
              target = t;
            }
            if (d !== undefined) { try { e.data = d; } catch (_) {} }
            const extra = e.detail && e.detail.__jq ? e.detail.__jq : [];
            if (one) off(el, rec);
            const r = fn.call(target, e, ...extra);
            if (r === false) { e.preventDefault(); e.stopPropagation(); }
          };
          el.addEventListener(real, rec.w);
          const list = evStore.get(el) || []; list.push(rec); evStore.set(el, list);
        }
      });
    },
    one(types, sel, data, fn) { return this.on(types, sel, data, fn, true); },
    off(types, sel, fn) {
      if (isFn(sel)) { fn = sel; sel = undefined; }
      return this.each(function () {
        const list = evStore.get(this) || [];
        const ts = types === undefined ? [{ type: null, ns: '' }] : parseTypes(types);
        for (const rec of list.slice()) {
          if (ts.some((t) => (t.type === null || t.type === rec.type || (t.type === '' && t.ns && t.ns === rec.ns)) && (!t.ns || t.ns === rec.ns)) &&
              (!fn || fn === rec.fn) && (sel === undefined || sel === '**' || sel === rec.sel)) off(this, rec);
        }
      });
    },
    trigger(type, ...extra) {
      const t = parseTypes(type)[0].type;
      return this.each(function () {
        if (!extra.length && isFn(this[t]) && ['click', 'focus', 'blur', 'submit', 'reset'].includes(t) && t !== 'submit') this[t]();
        else this.dispatchEvent(new win.CustomEvent(t, { bubbles: true, cancelable: true, detail: { __jq: extra.flat(1) } }));
      });
    },
    triggerHandler(type, ...extra) { return this.first().trigger(type, ...extra); },
    ready(f) { ready(f); return this; },
    hover(a, b) { return this.on('mouseenter', a).on('mouseleave', b || a); },
    serializeArray() {
      const out = [];
      for (const f of this) for (const e of (f.elements || [f])) {
        if (!e.name || e.disabled || /^(submit|button|reset|file|image)$/.test(e.type)) continue;
        if ((e.type === 'checkbox' || e.type === 'radio') && !e.checked) continue;
        if (e.tagName === 'SELECT' && e.multiple) for (const o of e.selectedOptions) out.push({ name: e.name, value: o.value });
        else out.push({ name: e.name, value: e.value });
      }
      return out;
    },
    serialize() { return $.param(this.serializeArray()); },
  });
  function off(el, rec) {
    el.removeEventListener(rec.real, rec.w);
    const list = evStore.get(el) || [];
    const i = list.indexOf(rec); if (i >= 0) list.splice(i, 1);
  }
  for (const name of ['click', 'dblclick', 'change', 'input', 'submit', 'focus', 'blur', 'keydown', 'keyup', 'keypress', 'mousedown', 'mouseup',
    'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'scroll', 'resize', 'select', 'contextmenu', 'load', 'error']) {
    def(name, function (...a) { return a.length ? this.on(name, ...a) : this.trigger(name); });
  }

  /* ---- effects (CSS transitions) ---- */
  const dur = (d) => d === 'fast' ? 200 : d === 'slow' ? 600 : (typeof d === 'number' ? d : 400);
  const hidden = (e) => win.getComputedStyle(e).display === 'none';
  const showEl = (e) => {
    if (e.style.display === 'none') e.style.display = dispOrig.get(e) || '';
    if (hidden(e)) e.style.display = 'block';
  };
  const hideEl = (e) => { if (!hidden(e)) dispOrig.set(e, e.style.display === 'none' ? '' : e.style.display); e.style.display = 'none'; };
  function anim(e, props, ms, done) {
    e.style.transition = Object.keys(props).map((k) => kebab(k) + ' ' + ms + 'ms ease').join(',');
    void e.offsetWidth;
    for (const k of Object.keys(props)) e.style[k] = px(k, props[k]);
    setTimeout(() => { e.style.transition = ''; if (done) done(); }, ms);
  }
  const cbArgs = (d, cb) => isFn(d) ? [400, d] : [dur(d), cb];
  defs({
    show() { return this.each(function () { showEl(this); }); },
    hide() { return this.each(function () { hideEl(this); }); },
    toggle(state) { return this.each(function () { (state === undefined ? hidden(this) : state) ? showEl(this) : hideEl(this); }); },
    fadeIn(d, cb) {
      [d, cb] = cbArgs(d, cb);
      return this.each(function () { const e = this; showEl(e); e.style.opacity = 0; anim(e, { opacity: 1 }, d, () => { e.style.opacity = ''; if (cb) cb.call(e); }); });
    },
    fadeOut(d, cb) {
      [d, cb] = cbArgs(d, cb);
      return this.each(function () { const e = this; anim(e, { opacity: 0 }, d, () => { hideEl(e); e.style.opacity = ''; if (cb) cb.call(e); }); });
    },
    fadeToggle(d, cb) { return this.each(function () { $(this)[hidden(this) ? 'fadeIn' : 'fadeOut'](d, cb); }); },
    slideDown(d, cb) {
      [d, cb] = cbArgs(d, cb);
      return this.each(function () {
        const e = this; showEl(e); const h = e.scrollHeight; e.style.overflow = 'hidden'; e.style.height = '0px';
        anim(e, { height: h + 'px' }, d, () => { e.style.height = ''; e.style.overflow = ''; if (cb) cb.call(e); });
      });
    },
    slideUp(d, cb) {
      [d, cb] = cbArgs(d, cb);
      return this.each(function () {
        const e = this; e.style.overflow = 'hidden'; e.style.height = e.scrollHeight + 'px';
        anim(e, { height: '0px' }, d, () => { hideEl(e); e.style.height = ''; e.style.overflow = ''; if (cb) cb.call(e); });
      });
    },
    slideToggle(d, cb) { return this.each(function () { $(this)[hidden(this) ? 'slideDown' : 'slideUp'](d, cb); }); },
    animate(props, d, cb) {
      [d, cb] = cbArgs(d, cb);
      return this.each(function () {
        const e = this, cs = win.getComputedStyle(e);
        for (const k of Object.keys(props)) e.style[k] = cs[k];
        anim(e, props, d, () => { if (cb) cb.call(e); });
      });
    },
    stop() { return this; },
    delay() { return this; },
  });

  /* ---- static utilities ---- */
  $.fn = JQ.prototype;
  $.each = (o, cb) => {
    if (o && typeof o.length === 'number' && !isFn(o)) { for (let i = 0; i < o.length; i++) if (cb.call(o[i], i, o[i]) === false) break; }
    else for (const k of Object.keys(o || {})) if (cb.call(o[k], k, o[k]) === false) break;
    return o;
  };
  $.map = (o, cb) => {
    const r = [];
    const push = (v) => { if (Array.isArray(v)) r.push(...v); else if (v != null) r.push(v); };
    if (o && typeof o.length === 'number') for (let i = 0; i < o.length; i++) push(cb(o[i], i));
    else for (const k of Object.keys(o || {})) push(cb(o[k], k));
    return r;
  };
  $.grep = (a, cb, inv) => Array.from(a).filter((v, i) => !!cb(v, i) !== !!inv);
  $.inArray = (v, a, from) => Array.from(a).indexOf(v, from);
  $.merge = (a, b) => { for (const x of b) a.push(x); return a; };
  $.extend = (...a) => {
    let deep = false;
    if (typeof a[0] === 'boolean') deep = a.shift();
    const target = a.shift() || {};
    for (const src of a) for (const k of Object.keys(src || {})) {
      const v = src[k];
      if (deep && (isPlain(v) || Array.isArray(v))) target[k] = $.extend(true, Array.isArray(v) ? [] : (isPlain(target[k]) ? target[k] : {}), v);
      else if (v !== undefined) target[k] = v;
    }
    return target;
  };
  $.trim = (s) => s == null ? '' : String(s).trim();
  $.isArray = Array.isArray;
  $.isFunction = isFn;
  $.isPlainObject = isPlain;
  $.isEmptyObject = (o) => Object.keys(o || {}).length === 0;
  $.isNumeric = (n) => !isNaN(parseFloat(n)) && isFinite(n);
  $.type = (x) => x === null ? 'null' : Array.isArray(x) ? 'array' : typeof x;
  $.now = () => Date.now();
  $.noop = () => {};
  $.parseJSON = JSON.parse;
  $.contains = (a, b) => a !== b && a.contains(b);
  $.ready = ready;
  $.param = (obj) => {
    const parts = [];
    const enc = (s) => encodeURIComponent(s).replace(/%20/g, '+');
    const add = (k, v) => { if (isFn(v)) v = v(); parts.push(enc(k) + '=' + enc(v == null ? '' : v)); };
    const build = (pre, v) => {
      if (Array.isArray(v)) v.forEach((x, i) => build(pre + '[' + (typeof x === 'object' && x ? i : '') + ']', x));
      else if (v && typeof v === 'object') for (const k of Object.keys(v)) build(pre + '[' + k + ']', v[k]);
      else add(pre, v);
    };
    if (Array.isArray(obj)) obj.forEach((o) => add(o.name, o.value));
    else if (obj instanceof JQ) obj.serializeArray().forEach((o) => add(o.name, o.value));
    else for (const k of Object.keys(obj || {})) build(k, obj[k]);
    return parts.join('&');
  };
  $.ajax = (url, o) => {
    if (url !== null && typeof url === 'object') { o = url; url = o.url; }
    o = Object.assign({ headers: {} }, o);
    const method = String(o.method || o.type || 'GET').toUpperCase();
    const ctx = o.context || o;
    let u = url, body;
    const headers = Object.assign({}, o.headers);
    if (o.data != null) {
      if (method === 'GET' || method === 'HEAD') { const d = isStr(o.data) ? o.data : $.param(o.data); if (d) u += (u.includes('?') ? '&' : '?') + d; }
      else if (o.contentType && /json/.test(o.contentType) && !isStr(o.data)) { body = JSON.stringify(o.data); headers['Content-Type'] = o.contentType; }
      else { body = isStr(o.data) ? o.data : $.param(o.data); headers['Content-Type'] = o.contentType || 'application/x-www-form-urlencoded; charset=UTF-8'; }
    }
    if (o.cache === false && (method === 'GET')) u += (u.includes('?') ? '&' : '?') + '_=' + Date.now();
    const p = win.fetch(u, { method, headers, body, credentials: o.xhrFields && o.xhrFields.withCredentials ? 'include' : 'same-origin' })
      .then(async (r) => {
        const text = await r.text();
        const xhr = { status: r.status, statusText: r.statusText, responseText: text, getResponseHeader: (n) => r.headers.get(n) };
        if (!r.ok) { const err = { xhr, textStatus: 'error', thrown: r.statusText }; throw err; }
        let data = text;
        const dt = o.dataType || (/json/.test(r.headers.get('content-type') || '') ? 'json' : 'text');
        if (dt === 'json') { try { data = JSON.parse(text); } catch (e) { throw { xhr, textStatus: 'parsererror', thrown: e }; } }
        if (o.success) o.success.call(ctx, data, 'success', xhr);
        return data;
      })
      .catch((err) => {
        const e = err && err.xhr ? err : { xhr: { status: 0, statusText: 'error', responseText: '' }, textStatus: 'error', thrown: err };
        if (o.error) o.error.call(ctx, e.xhr, e.textStatus, e.thrown);
        throw e;
      })
      .finally(() => { if (o.complete) o.complete.call(ctx); });
    p.catch(() => {});
    p.done = (f) => { p.then(f); return p; };
    p.fail = (f) => { p.catch((e) => f(e.xhr, e.textStatus, e.thrown)); return p; };
    p.always = (f) => { p.then(f, f); return p; };
    return p;
  };
  const shortcut = (method, dataType) => (url, data, success, type) => {
    if (isFn(data)) { type = success; success = data; data = undefined; }
    return $.ajax({ url, method, data, success, dataType: dataType || type });
  };
  $.get = shortcut('GET');
  $.post = shortcut('POST');
  $.getJSON = shortcut('GET', 'json');
  return $;
}


  return { scope() { const q = root.jQuery || built || (built = makeJQ(root)); return { $: q, jQuery: q }; } };
} });
