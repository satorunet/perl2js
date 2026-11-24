/* Encode — encode / decode / encode_utf8 / decode_utf8 (UTF-8, latin1, ascii, UTF-16, Shift_JIS, EUC-JP ...)
   "byte strings" are JS strings whose characters are all <= 0xFF */
Perl2JS.module({ name: 'Encode', init(api) {
  const { hide } = api;
  const toU8 = (b) => Uint8Array.from(String(b), (c) => c.charCodeAt(0) & 255);
  const fromU8 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return s; };
  const NAMES = { 'utf8': 'utf-8', 'utf-8': 'utf-8', 'utf-8-strict': 'utf-8', 'latin1': 'latin1', 'iso-8859-1': 'latin1', 'ascii': 'ascii', 'us-ascii': 'ascii',
    'utf-16le': 'utf-16le', 'utf-16be': 'utf-16be', 'utf-16': 'utf-16', 'ucs-2le': 'utf-16le', 'ucs-2be': 'utf-16be',
    'shiftjis': 'shift_jis', 'shift_jis': 'shift_jis', 'shift-jis': 'shift_jis', 'sjis': 'shift_jis', 'cp932': 'shift_jis', 'windows-31j': 'shift_jis',
    'euc-jp': 'euc-jp', 'eucjp': 'euc-jp', 'iso-2022-jp': 'iso-2022-jp', 'jis': 'iso-2022-jp', 'cp1252': 'windows-1252', 'windows-1252': 'windows-1252' };
  const norm = (n) => { const k = String(n).toLowerCase().replace(/_/g, '-').replace(/^utf-?8$/, 'utf-8'); const v = NAMES[k] || NAMES[String(n).toLowerCase()]; if (!v) throw 'Unknown encoding \'' + n + '\' at line ' + api.RT._ln.v + '.\n'; return v; };
  const tables = {};
  function legacyTable(enc) {            // char -> bytes, built by decoding every 1/2-byte sequence the decoder knows
    if (tables[enc]) return tables[enc];
    const dec = new TextDecoder(enc), map = new Map();
    for (let b = 0; b < 256; b++) { const ch = dec.decode(Uint8Array.of(b)); if (ch.length === 1 && ch !== '�') map.set(ch, [b]); }
    const leads = enc === 'euc-jp' ? [[0xa1, 0xfe], [0x8e, 0x8e]] : [[0x81, 0x9f], [0xe0, 0xfc]];
    const trails = enc === 'euc-jp' ? [[0xa1, 0xfe]] : [[0x40, 0x7e], [0x80, 0xfc]];
    for (const [l0, l1] of leads) for (let l = l0; l <= l1; l++) for (const [t0, t1] of (enc === 'euc-jp' && l === 0x8e ? [[0xa1, 0xdf]] : trails)) for (let t = t0; t <= t1; t++) {
      const ch = dec.decode(Uint8Array.of(l, t));
      if (ch.length === 1 && ch !== '�' && !map.has(ch)) map.set(ch, [l, t]);
    }
    return (tables[enc] = map);
  }
  function encode(name, str) {
    const enc = norm(name); str = String(str);
    if (enc === 'utf-8') return fromU8(new TextEncoder().encode(str));
    if (enc === 'latin1') return Array.from(str, (c) => (c.charCodeAt(0) < 256 ? c : '?')).join('');
    if (enc === 'ascii') return Array.from(str, (c) => (c.charCodeAt(0) < 128 ? c : '?')).join('');
    if (enc === 'utf-16le' || enc === 'utf-16be' || enc === 'utf-16') { let out = enc === 'utf-16' ? '\xfe\xff' : ''; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i), hi = c >> 8, lo = c & 255; out += enc === 'utf-16le' ? String.fromCharCode(lo, hi) : String.fromCharCode(hi, lo); } return out; }
    if (enc === 'shift_jis' || enc === 'euc-jp') { const t = legacyTable(enc); let out = ''; for (const ch of str) { const b = t.get(ch); out += b ? String.fromCharCode(...b) : '?'; } return out; }
    throw 'Encoding to ' + name + ' is not supported in the browser';
  }
  function decode(name, bytes) {
    const enc = norm(name), u = toU8(bytes);
    if (enc === 'latin1') return String(bytes);
    if (enc === 'ascii') return Array.from(String(bytes), (c) => (c.charCodeAt(0) < 128 ? c : '�')).join('');
    if (enc === 'utf-16') return new TextDecoder(u[0] === 0xff && u[1] === 0xfe ? 'utf-16le' : 'utf-16be').decode(u[0] === 0xfe || u[0] === 0xff ? u.subarray(2) : u);
    return new TextDecoder(enc).decode(u);
  }
  class Enc { constructor(n) { hide(this, '_n', n); } name() { return norm(this._n) === 'utf-8' ? 'utf-8-strict' : norm(this._n); } mime_name() { return norm(this._n).toUpperCase(); }
    encode(s) { return encode(this._n, s); } decode(b) { return decode(this._n, b); } }
  hide(Enc.prototype, '__perlCall', true);
  for (const k of Object.getOwnPropertyNames(Enc.prototype)) if (k !== 'constructor') hide(Enc.prototype, k, Enc.prototype[k]);
  const exports = {
    encode: (n, s) => encode(n, s), decode: (n, b) => decode(n, b),
    encode_utf8: (s) => encode('utf-8', s), decode_utf8: (b) => decode('utf-8', b),
    str2bytes: (n, s) => encode(n, s), bytes2str: (n, b) => decode(n, b),
    is_utf8: (s) => /[^\x00-\xff]/.test(String(s)) ? 1 : '', find_encoding: (n) => { try { norm(n); return new Enc(n); } catch (e) { return undefined; } },
    encodings: () => Object.keys(NAMES), FB_CROAK: 1, FB_QUIET: 4, FB_WARN: 6, FB_DEFAULT: 0, LEAVE_SRC: 8,
  };
  return { exports, default: ['encode', 'decode', 'encode_utf8', 'decode_utf8', 'find_encoding', 'str2bytes', 'bytes2str', 'encodings'], listops: ['encode', 'decode', 'str2bytes', 'bytes2str'], unary: ['encode_utf8', 'decode_utf8', 'is_utf8', 'find_encoding'] };
} });
