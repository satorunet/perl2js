/* MIME::Base64 — encode_base64 / decode_base64 (+ url-safe variants)   (wide characters are encoded as UTF-8) */
Perl2JS.module({ name: 'MIME::Base64', init(api) {
  const bytes = (s) => { s = String(s); return /[^\x00-\xff]/.test(s) ? unescape(encodeURIComponent(s)) : s; };
  const enc = (s, eol) => { const b = btoa(bytes(s)); eol = eol === undefined ? '\n' : eol; return eol === '' ? b : (b.match(/.{1,76}/g) || []).map((l) => l + eol).join(''); };
  const dec = (s) => atob(String(s).replace(/[^A-Za-z0-9+/]/g, '').replace(/=+$/, '').padEnd(Math.ceil(String(s).replace(/[^A-Za-z0-9+/]/g, '').length / 4) * 4, '='));
  const exports = {
    encode_base64: enc, decode_base64: dec,
    encode_base64url: (s) => btoa(bytes(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    decode_base64url: (s) => dec(String(s).replace(/-/g, '+').replace(/_/g, '/')),
    encoded_base64_length: (s, eol) => enc(s, eol).length, decoded_base64_length: (s) => dec(s).length,
  };
  return { exports, default: ['encode_base64', 'decode_base64'], listops: ['encode_base64'], unary: ['decode_base64', 'encode_base64url', 'decode_base64url'] };
} });
