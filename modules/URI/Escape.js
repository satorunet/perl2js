/* URI::Escape — uri_escape / uri_unescape / uri_escape_utf8   (uri_unescape returns bytes: use Encode::decode_utf8 for UTF-8 text) */
Perl2JS.module({ name: 'URI::Escape', init(api) {
  const utf8 = (s) => unescape(encodeURIComponent(s));
  const esc = (s, unsafe) => {
    const re = unsafe === undefined ? /[^A-Za-z0-9\-._~]/ : new RegExp('[' + unsafe + ']');
    return Array.from(String(s)).map((ch) => (re.test(ch) ? Array.from(utf8(ch)).map((c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join('') : ch)).join('');
  };
  const exports = {
    uri_escape: esc, uri_escape_utf8: esc,
    uri_unescape: (...a) => a.map((s) => String(s).replace(/%([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))).join(''),
  };
  return { exports, default: ['uri_escape', 'uri_unescape', 'uri_escape_utf8'], listops: ['uri_escape', 'uri_escape_utf8'], unary: ['uri_unescape'] };
} });
