/* CGI::Cookie — new / fetch / parse / bake / accessors.
 * Browser: cookies are read from and written to document.cookie.  Node: read from $ENV{HTTP_COOKIE}, written as a Set-Cookie header.
 * Unlike CGI.pm, values are decoded as UTF-8 text (not bytes). */
Perl2JS.module({ name: 'CGI::Cookie', init(api) {
  const { mk, hide, RT, _s } = api;
  const jar = () => (typeof document !== 'undefined' && typeof document.cookie === 'string' ? document : null);
  const rawCookie = () => {
    const d = jar();
    if (d) return d.cookie;
    const env = RT._h$ENV || {}, sys = typeof process !== 'undefined' && process.env ? process.env : {};
    return env.HTTP_COOKIE || env.COOKIE || sys.HTTP_COOKIE || sys.COOKIE || '';
  };

  const utf8Bytes = (s) => unescape(encodeURIComponent(s));
  const escape_ = (s) => utf8Bytes(_s(s)).replace(/[^A-Za-z0-9_.~-]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
  const unescape_ = (s) => String(s).replace(/\+/g, ' ').replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    try { return decodeURIComponent(run); } catch (e) { return run.replace(/%(..)/g, (m, h) => String.fromCharCode(parseInt(h, 16))); }
  }).replace(/%u([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));

  const UNIT = { s: 1, m: 60, h: 3600, d: 86400, M: 86400 * 30, y: 86400 * 365 };
  const now = () => Math.floor(Date.now() / 1000);
  // "+1d" "-3m" "now" -> epoch seconds; anything else is passed through
  const expireCalc = (t) => {
    t = _s(t);
    if (!t || t === '0' || t.toLowerCase() === 'now') return now();
    if (/^\d+/.test(t)) return t;
    const m = /^([+-]?(?:\d+|\d*\.\d*))([smhdMy])/.exec(t);
    return m ? now() + UNIT[m[2]] * m[1] : t;
  };
  const expires = (t) => { const v = expireCalc(t); return /^\d+(\.\d+)?$/.test(String(v)) ? new Date(Math.floor(v) * 1000).toUTCString() : v; };

  // -name => 'x', -value => 'y'   |   { -name => 'x' }   |   'x', 'y'      ==>  { name: 'x', value: 'y' }
  const args = (a, order) => {
    const out = {};
    if (a.length === 1 && a[0] && Object.getPrototypeOf(a[0]) === Object.prototype) a = Object.entries(a[0]).flat(0);
    if (typeof a[0] === 'string' && a[0][0] === '-') {
      for (let i = 0; i < a.length; i += 2) {
        let k = String(a[i]).replace(/^-/, '').toLowerCase().replace(/_/g, '-');
        if (k === 'values') k = 'value';
        out[k] = a[i + 1];
      }
    } else a.forEach((v, i) => { if (order[i]) out[order[i]] = v; });
    return out;
  };
  // Perl's context: several values act as a list, and as the first value in scalar context
  const many = (list) => { if (list.length < 2) return list[0]; const r = mk(list.slice()); hide(r, '__scalar', () => list[0]); return r; };
  const ORDER = ['name', 'value', 'path', 'domain', 'secure', 'expires', 'max-age', 'httponly', 'samesite', 'priority', 'partitioned'];

  class Cookie {
    static new(...a) {
      const o = args(a, ORDER);
      if (o.name === undefined || o.value === undefined) return undefined;
      const c = new Cookie();
      c.name(o.name); c.value(o.value); c.path(o.path || '/');
      for (const k of ORDER.slice(3)) if (o[k] !== undefined) c[k.replace('-', '_')](o[k]);
      return c;
    }
    static parse(raw) {
      const res = {};
      for (let p of _s(raw).split(/[;,] ?/)) {
        p = p.trim();
        const i = p.indexOf('=');
        if (i < 0) continue;
        const key = unescape_(p.slice(0, i)), v = p.slice(i + 1);
        const values = v === '' ? [] : v.replace(/[&;]$/, '').split(/[&;]/).map(unescape_);
        if (!Object.prototype.hasOwnProperty.call(res, key)) res[key] = Cookie.new('-name', key, '-value', values);   // the first one wins
      }
      return res;
    }
    static fetch() { return Cookie.parse(rawCookie()); }
    static raw_fetch() {
      const res = {};
      for (let p of rawCookie().split(/[;,] ?/)) { p = p.trim(); if (!p) continue; const i = p.indexOf('='); res[i < 0 ? p : p.slice(0, i)] = i < 0 ? '' : p.slice(i + 1); }
      return res;
    }
    _acc(k, v) { if (v !== undefined) this._c[k] = v; return this._c[k]; }
    name(v) { return this._acc('name', v); }
    value(v) {
      if (v !== undefined) this._c.value = Array.isArray(v) ? v.slice() : v && typeof v === 'object' ? Object.entries(v).flat(1) : [v];
      return many(this._c.value);
    }
    path(v) { return this._acc('path', v); }
    domain(v) { return this._acc('domain', v === undefined ? v : _s(v).toLowerCase()); }
    secure(v) { return this._acc('secure', v); }
    expires(v) { return this._acc('expires', v === undefined ? v : expires(v)); }
    max_age(v) { return this._acc('max_age', v === undefined ? v : expireCalc(v) - now()); }
    httponly(v) { return this._acc('httponly', v); }
    partitioned(v) { return this._acc('partitioned', v); }
    _pick(k, v, legal) { if (v !== undefined) { const n = _s(v).toLowerCase().replace(/^./, (c) => c.toUpperCase()); if (legal.includes(n)) this._c[k] = n; } return this._c[k]; }
    samesite(v) { return this._pick('samesite', v, ['Strict', 'Lax', 'None']); }
    priority(v) { return this._pick('priority', v, ['Low', 'Medium', 'High']); }
    as_string() {
      const c = this._c, on = (v) => _s(v) !== '' && _s(v) !== '0';
      if (!on(c.name)) return '';
      const out = [escape_(c.name) + '=' + c.value.map(escape_).join('&')];
      for (const [k, label] of [['domain', 'domain='], ['path', 'path='], ['expires', 'expires='], ['max_age', 'max-age=']]) if (on(c[k])) out.push(label + _s(c[k]));
      if (on(c.secure)) out.push('secure');
      if (on(c.httponly)) out.push('HttpOnly');
      if (on(c.samesite)) out.push('SameSite=' + c.samesite);
      if (on(c.priority)) out.push('Priority=' + c.priority);
      if (on(c.partitioned)) out.push('Partitioned');
      return out.join('; ');
    }
    toString() { return this.as_string(); }
    bake() {
      if (jar()) store(this); else Perl2JS.stdout('Set-Cookie: ' + this.as_string() + '\r\nDate: ' + expires('now') + '\r\nContent-Type: text/html; charset=ISO-8859-1\r\n\r\n');
      return 1;
    }
    constructor() { hide(this, '_c', {}); }
  }
  // JavaScript cannot create HttpOnly cookies (the browser would drop the whole cookie), so that attribute is left out
  function store(c) {
    const s = String(c);
    if (s !== '') jar().cookie = s.replace(/; HttpOnly(?=;|$)/i, '');
  }
  for (const k of ['new', 'parse', 'fetch', 'raw_fetch']) hide(Cookie, k, Cookie[k]);
  hide(Cookie, '__perlCall', true);
  hide(Cookie.prototype, '__perlCall', true);
  for (const k of ['$m', '$nm', '$sub', '$tr', '$trc', '$x']) hide(Cookie.prototype, k, function (...a) { return String.prototype[k].apply(this.as_string(), a); });

  return { exports: {}, classes: { 'CGI::Cookie': Cookie }, shared: { Cookie, args, many, expires, escape_, unescape_, jar, store } };
} });
