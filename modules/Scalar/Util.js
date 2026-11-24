/* Scalar::Util — blessed reftype looks_like_number refaddr weaken ... */
Perl2JS.module({ name: 'Scalar::Util', init(api) {
  const ids = new WeakMap(); let nextId = 0x55d0c8a00000;
  const exports = {
    blessed: (x) => { if (x && typeof x === 'object') { const p = Object.getPrototypeOf(x); if (p && p.__ps) return p.__ps.__name; } return undefined; },
    reftype: (x) => (x == null ? undefined : Array.isArray(x) ? 'ARRAY' : typeof x === 'function' ? 'CODE' : typeof x === 'object' ? 'HASH' : undefined),
    looks_like_number: (x) => (x != null && (typeof x === 'number' ? true : /^\s*[+-]?(?:(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|0[xX][0-9a-fA-F]+(?!.)|Inf(?:inity)?|NaN)\s*$/i.test(String(x)) && !/^\s*[+-]?0[xX]/.test(String(x)))),
    refaddr: (x) => { if (x == null || (typeof x !== 'object' && typeof x !== 'function')) return undefined; if (!ids.has(x)) ids.set(x, (nextId += 24)); return ids.get(x); },
    weaken: () => undefined, unweaken: () => undefined, isweak: () => '', readonly: () => 0,
    openhandle: () => undefined, dualvar: (n, s) => s, isdual: () => '',
  };
  return { exports, default: [], unary: ['blessed', 'reftype', 'looks_like_number', 'refaddr', 'weaken', 'unweaken', 'isweak', 'readonly'] };
} });
