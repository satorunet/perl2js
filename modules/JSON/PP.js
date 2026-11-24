/* JSON::PP — encode_json / decode_json and the OO interface (->pretty ->canonical ->encode ...) */
Perl2JS.module({ name: 'JSON::PP', init(api) {
  const { hide, _s, RT } = api;
  const nativeJSON = JSON;
  const fail = (m) => { throw m + ' at line ' + RT._ln.v + '.\n'; };
  function encodeValue(v, o, lvl) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return isFinite(v) ? String(_s(v)) : 'null';
    if (typeof v === 'string') { let s = nativeJSON.stringify(v); if (o.ascii) s = s.replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')); return s; }
    if (typeof v === 'function') fail('encountered CODE(0x0), but JSON can only represent references to arrays or hashes');
    const proto = Object.getPrototypeOf(v), cls = proto && proto.__ps ? proto.__ps.__name : null;
    if (cls) {
      if (o.convert_blessed && typeof v.TO_JSON === 'function') return encodeValue(v.TO_JSON(), o, lvl);
      if (o.allow_blessed) return 'null';
      fail("encountered object '" + cls + "=HASH(0x0)', but neither allow_blessed, convert_blessed nor allow_tags settings are enabled (or TO_JSON/FREEZE method missing)");
    }
    const nl = o.indent ? '\n' : '', pad = (n) => (o.indent ? ' '.repeat(o.indent_length * n) : '');
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return '[' + nl + v.map((x) => pad(lvl + 1) + encodeValue(x, o, lvl + 1)).join(',' + nl) + nl + pad(lvl) + ']';
    }
    let keys = Object.keys(v);
    if (o.canonical) keys = keys.slice().sort();
    if (!keys.length) return '{}';
    const colon = (o.space_before ? ' ' : '') + ':' + (o.space_after ? ' ' : '');
    return '{' + nl + keys.map((k) => pad(lvl + 1) + encodeValue(String(k), Object.assign({}, o, { ascii: o.ascii }), 0) + colon + encodeValue(v[k], o, lvl + 1)).join(',' + nl) + nl + pad(lvl) + '}';
  }
  function fix(v) {                 // JSON true/false -> 1/0 (like JSON::PP::Boolean), null -> undef
    if (v === true) return 1;
    if (v === false) return 0;
    if (v === null) return undefined;
    if (Array.isArray(v)) return v.map(fix);
    if (typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = fix(v[k]); return o; }
    return v;
  }
  class JSONPP {
    constructor() { hide(this, '_o', { indent: false, indent_length: 3, space_before: false, space_after: false, canonical: false, ascii: false, allow_blessed: false, convert_blessed: false, allow_nonref: true }); }
    static new() { return new JSONPP(); }
    pretty(v) { const on = v === undefined ? true : !!v; Object.assign(this._o, { indent: on, space_before: on, space_after: on }); return this; }
    indent(v) { this._o.indent = v === undefined ? true : !!v; return this; }
    space_before(v) { this._o.space_before = v === undefined ? true : !!v; return this; }
    space_after(v) { this._o.space_after = v === undefined ? true : !!v; return this; }
    indent_length(n) { this._o.indent_length = n; return this; }
    canonical(v) { this._o.canonical = v === undefined ? true : !!v; return this; }
    ascii(v) { this._o.ascii = v === undefined ? true : !!v; return this; }
    allow_blessed(v) { this._o.allow_blessed = v === undefined ? true : !!v; return this; }
    convert_blessed(v) { this._o.convert_blessed = v === undefined ? true : !!v; return this; }
    utf8() { return this; } latin1() { return this; } relaxed() { return this; } allow_nonref() { return this; } allow_unknown() { return this; } loose() { return this; }
    boolean_values() { return this; } allow_bignum() { return this; } max_depth() { return this; } shrink() { return this; } escape_slash() { return this; }
    encode(v) { const s = encodeValue(v, this._o, 0); return this._o.indent ? s + '\n' : s; }
    decode(s) { try { return fix(nativeJSON.parse(String(s))); } catch (e) { return fail('malformed JSON string, neither tag, array, object, number, string or atom, ' + e.message); } }
  }
  hide(JSONPP.prototype, '__perlCall', true); hide(JSONPP, '__perlCall', true);
  for (const k of Object.getOwnPropertyNames(JSONPP.prototype)) if (k !== 'constructor') hide(JSONPP.prototype, k, JSONPP.prototype[k]);
  hide(JSONPP, 'new', JSONPP.new);
  const exports = {
    encode_json: (v) => encodeValue(v, { indent: false, canonical: false, ascii: false }, 0),
    decode_json: (s) => new JSONPP().decode(s),
    true: 1, false: 0, null: undefined,
  };
  return { exports, default: ['encode_json', 'decode_json'], unary: ['encode_json', 'decode_json'], classes: { 'JSON::PP': JSONPP }, shared: { JSONPP, encodeValue } };
} });
