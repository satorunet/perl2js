/* Storable — dclone (deep copy, keeps bless and cycles), freeze / thaw (as strings) */
Perl2JS.module({ name: 'Storable', init(api) {
  const clone = (v, seen) => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return seen.get(v);
    if (typeof v.nodeType === 'number') return v;
    const out = Array.isArray(v) ? [] : Object.create(Object.getPrototypeOf(v));
    seen.set(v, out);
    for (const k of Object.keys(v)) out[k] = clone(v[k], seen);
    return out;
  };
  const exports = {
    dclone: (v) => clone(v, new Map()),
    freeze: (v) => JSON.stringify(v), nfreeze: (v) => JSON.stringify(v), thaw: (s) => JSON.parse(s),
  };
  return { exports, default: [], unary: ['dclone', 'freeze', 'nfreeze', 'thaw'] };
} });
