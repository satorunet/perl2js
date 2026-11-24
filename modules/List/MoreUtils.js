/* List::MoreUtils — the commonly used subset (uniq, any/all/none, firstidx, lastidx, indexes, minmax, part, ...) */
Perl2JS.module({ name: 'List::MoreUtils', deps: ['List::Util'], init(api) {
  const { mk } = api;
  const U = api.use('List::Util').exports;
  const F = (a) => a.flat(1);
  const idx = (fn, l) => { for (let i = 0; i < l.length; i++) if (fn(l[i])) return i; return -1; };
  const exports = {
    uniq: U.uniq, distinct: U.uniq, any: U.any, all: U.all, none: U.none, notall: U.notall,
    firstidx: (fn, ...a) => idx(fn, F(a)), first_index: (fn, ...a) => idx(fn, F(a)),
    lastidx: (fn, ...a) => { const l = F(a); for (let i = l.length - 1; i >= 0; i--) if (fn(l[i])) return i; return -1; },
    last_index: (fn, ...a) => exports.lastidx(fn, ...a),
    indexes: (fn, ...a) => mk(F(a).map((x, i) => (fn(x) ? i : -1)).filter((i) => i >= 0)),
    firstval: (fn, ...a) => U.first(fn, ...a), first_value: (fn, ...a) => U.first(fn, ...a),
    lastval: (fn, ...a) => { const l = F(a); for (let i = l.length - 1; i >= 0; i--) if (fn(l[i])) return l[i]; return undefined; },
    last_value: (fn, ...a) => exports.lastval(fn, ...a),
    true: (fn, ...a) => F(a).filter((x) => fn(x)).length, false: (fn, ...a) => F(a).filter((x) => !fn(x)).length,
    minmax: (...a) => { const l = F(a).map(Number); return l.length ? mk([Math.min(...l), Math.max(...l)]) : mk([]); },
    part: (fn, ...a) => { const out = []; for (const x of F(a)) { const i = fn(x); (out[i] = out[i] || []).push(x); } return mk(Array.from(out, (p) => p)); },
    apply: (fn, ...a) => mk(F(a).map((x) => { fn(x); return x; })),
    after: (fn, ...a) => { const l = F(a), i = idx(fn, l); return mk(i < 0 ? [] : l.slice(i + 1)); },
    before: (fn, ...a) => { const l = F(a), i = idx(fn, l); return mk(i < 0 ? l : l.slice(0, i)); },
  };
  const blocks = {};
  for (const k of ['any', 'all', 'none', 'notall', 'firstidx', 'first_index', 'lastidx', 'last_index', 'indexes', 'firstval', 'first_value', 'lastval', 'last_value', 'true', 'false', 'part', 'apply', 'after', 'before']) blocks[k] = '$_';
  return { exports, default: [], blockfns: blocks, listfns: ['uniq', 'distinct', 'indexes', 'minmax', 'part', 'apply', 'after', 'before'] };
} });
