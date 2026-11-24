/* JSON — encode_json / decode_json / to_json / from_json and JSON->new  (JSON->stringify / parse still reach the JS JSON object) */
Perl2JS.module({ name: 'JSON', deps: ['JSON::PP'], init(api) {
  const { hide } = api;
  const base = api.use('JSON::PP'), JSONPP = base.shared.JSONPP;
  class JSONC extends JSONPP { static new() { return new JSONC(); } }
  hide(JSONC, '__perlCall', true); hide(JSONC, 'new', JSONC.new);
  hide(JSONC, 'stringify', (...a) => JSON.stringify(...a)); hide(JSONC, 'parse', (...a) => JSON.parse(...a));
  const opt = (o, k) => o && o[k];
  const exports = {
    encode_json: base.exports.encode_json, decode_json: base.exports.decode_json,
    to_json: (v, o) => { const j = new JSONPP(); if (opt(o, 'pretty')) j.pretty(); if (opt(o, 'canonical')) j.canonical(); return j.encode(v); },
    from_json: (s) => new JSONPP().decode(s),
  };
  return { exports, default: ['encode_json', 'decode_json', 'to_json', 'from_json'], unary: ['encode_json', 'decode_json', 'from_json'], classes: { 'JSON': JSONC } };
} });
