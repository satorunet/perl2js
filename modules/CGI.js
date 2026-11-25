/* CGI — the cookie part: CGI->new, cookie(), header(-cookie => ...), both as methods and as imported functions.
 * Browser: header() sets the cookies in document.cookie and returns "" (there are no response headers to print).
 * Node: header() returns the same header text as CGI.pm. */
Perl2JS.module({ name: 'CGI', deps: ['CGI::Cookie'], init(api) {
  const { mk, hide, _s } = api;
  const { Cookie, args, many, expires, escape_, unescape_, jar, store } = api.use('CGI::Cookie').shared;

  function cookie(a) {
    const o = args(a, ['name', 'value', 'path', 'domain', 'secure', 'expires', 'httponly', 'max-age', 'samesite', 'priority']);
    if (o.value === undefined) {                       // read
      const all = Cookie.fetch();
      if (o.name === undefined || o.name === '') return mk(Object.keys(all));
      return Object.prototype.hasOwnProperty.call(all, o.name) ? all[o.name].value() : undefined;
    }
    if (o.name === undefined || o.name === '') return undefined;
    const p = [];
    for (const k of Object.keys(o)) if (k === 'name' || k === 'value' || (o[k] && o[k] !== '0')) p.push('-' + k, o[k]);
    return Cookie.new(...p);
  }

  function header(self, a) {
    const o = args(a, ['type', 'status', 'cookie', 'target', 'expires', 'nph', 'charset', 'attachment']);
    const take = (...keys) => { let v; for (const k of keys) { if (o[k] !== undefined) v = o[k]; delete o[k]; } return v; };
    let type = take('content-type', 'type');
    const status = take('status'), target = take('target'), exp = take('expires'), attachment = take('attachment'), charset = take('charset');
    const ck = take('set-cookie', 'cookies', 'cookie');
    delete o.nph;
    const cookies = [].concat(ck === undefined ? [] : ck).filter((c) => c !== undefined && String(c) !== '');
    for (const v of [type, status, target, exp, attachment, charset, ...cookies, ...Object.values(o)]) {
      if (/[\r\n]/.test(_s(v))) throw 'Invalid header value contains a newline not followed by whitespace: ' + _s(v) + '\n';
    }
    if (charset !== undefined) self._charset = _s(charset);           // sticks to this CGI object, as in CGI.pm
    if (jar()) { cookies.forEach(store); return ''; }
    if (type === undefined) type = 'text/html';
    if (type !== '' && !/\bcharset\b/.test(type) && self._charset !== '') type += '; charset=' + self._charset;
    const h = [];
    if (status) h.push('Status: ' + status);
    if (target) h.push('Window-Target: ' + target);
    for (const c of cookies) h.push('Set-Cookie: ' + _s(c));
    if (exp) h.push('Expires: ' + expires(exp));
    if (exp || ck !== undefined) h.push('Date: ' + expires('now'));
    if (attachment) h.push('Content-Disposition: attachment; filename="' + attachment + '"');
    for (const k of Object.keys(o).sort()) h.push(k.charAt(0).toUpperCase() + k.slice(1) + ': ' + _s(o[k]));
    if (type !== '') h.push('Content-Type: ' + type);
    return h.join('\r\n') + '\r\n\r\n';
  }

  class CGI {
    static new() { return new CGI(); }
    constructor() { Object.defineProperty(this, '_charset', { value: 'ISO-8859-1', writable: true }); }
    cookie(...a) { return cookie(a); }
    header(...a) { return header(this, a); }
    escape(s) { return escape_(s); }
    unescape(s) { return unescape_(s); }
  }
  hide(CGI, 'new', CGI.new);
  hide(CGI, '__perlCall', true);
  hide(CGI.prototype, '__perlCall', true);

  const std = new CGI();                              // the object behind the imported functions
  const exports = { cookie: (...a) => cookie(a), header: (...a) => header(std, a) };
  const names = Object.keys(exports);
  return { exports, default: [], tags: () => names, classes: { 'CGI': CGI, 'CGI::Cookie': Cookie } };
} });
