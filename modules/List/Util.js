/* List::Util — sum max min first reduce shuffle uniq any all none pairs ... */
Perl2JS.module({ name: 'List::Util', init(api) {
  const { mk, _s } = api;
  const F = (a) => a.flat(1);
  const num = (x) => Number(x);
  const bool = (b) => (b ? true : false);
  const keyOf = (x) => String(_s(x));
  const exports = {
    sum: (...a) => { const l = F(a); return l.length ? l.reduce((s, x) => s + num(x), 0) : undefined; },
    sum0: (...a) => F(a).reduce((s, x) => s + num(x), 0),
    product: (...a) => F(a).reduce((s, x) => s * num(x), 1),
    min: (...a) => { const l = F(a); return l.length ? l.reduce((m, x) => (num(x) < num(m) ? x : m)) : undefined; },
    max: (...a) => { const l = F(a); return l.length ? l.reduce((m, x) => (num(x) > num(m) ? x : m)) : undefined; },
    minstr: (...a) => { const l = F(a); return l.length ? l.reduce((m, x) => (String(x) < String(m) ? x : m)) : undefined; },
    maxstr: (...a) => { const l = F(a); return l.length ? l.reduce((m, x) => (String(x) > String(m) ? x : m)) : undefined; },
    first: (fn, ...a) => { for (const x of F(a)) if (fn(x)) return x; return undefined; },
    any: (fn, ...a) => bool(F(a).some((x) => fn(x))),
    all: (fn, ...a) => bool(F(a).every((x) => fn(x))),
    none: (fn, ...a) => bool(!F(a).some((x) => fn(x))),
    notall: (fn, ...a) => bool(!F(a).every((x) => fn(x))),
    reduce: (fn, ...a) => { const l = F(a); if (!l.length) return undefined; let acc = l[0]; for (let i = 1; i < l.length; i++) acc = fn(acc, l[i]); return acc; },
    reductions: (fn, ...a) => { const l = F(a); if (!l.length) return mk([]); const r = [l[0]]; let acc = l[0]; for (let i = 1; i < l.length; i++) { acc = fn(acc, l[i]); r.push(acc); } return mk(r); },
    shuffle: (...a) => { const l = F(a).slice(); for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return mk(l); },
    sample: (n, ...a) => exports.shuffle(...a).slice(0, n),
    uniq: (...a) => { const seen = new Set(); return mk(F(a).filter((x) => { const k = keyOf(x); if (seen.has(k)) return false; seen.add(k); return true; })); },
    uniqnum: (...a) => { const seen = new Set(); return mk(F(a).filter((x) => { const k = num(x); if (seen.has(k)) return false; seen.add(k); return true; })); },
    uniqint: (...a) => { const seen = new Set(); return mk(F(a).map((x) => Math.trunc(num(x))).filter((k) => { if (seen.has(k)) return false; seen.add(k); return true; })); },
    pairs: (...a) => { const l = F(a), r = []; for (let i = 0; i < l.length; i += 2) { const p = [l[i], l[i + 1]]; Object.defineProperties(p, { key: { value: () => p[0] }, value: { value: () => p[1] }, __perlCall: { value: true } }); r.push(p); } return mk(r); },
    unpairs: (...a) => mk(F(a).flatMap((p) => [p[0], p[1]])),
    pairkeys: (...a) => { const l = F(a), r = []; for (let i = 0; i < l.length; i += 2) r.push(l[i]); return mk(r); },
    pairvalues: (...a) => { const l = F(a), r = []; for (let i = 0; i < l.length; i += 2) r.push(l[i + 1]); return mk(r); },
    pairmap: (fn, ...a) => { const l = F(a), r = []; for (let i = 0; i < l.length; i += 2) { const v = fn(l[i], l[i + 1]); r.push(...(Array.isArray(v) ? v : [v])); } return mk(r); },
    pairgrep: (fn, ...a) => { const l = F(a), r = []; for (let i = 0; i < l.length; i += 2) if (fn(l[i], l[i + 1])) r.push(l[i], l[i + 1]); return mk(r); },
    pairfirst: (fn, ...a) => { const l = F(a); for (let i = 0; i < l.length; i += 2) if (fn(l[i], l[i + 1])) return mk([l[i], l[i + 1]]); return mk([]); },
    head: (n, ...a) => { const l = F(a); return mk(n >= 0 ? l.slice(0, n) : l.slice(0, Math.max(0, l.length + n))); },
    tail: (n, ...a) => { const l = F(a); return mk(n >= 0 ? l.slice(Math.max(0, l.length - n)) : l.slice(-n)); },
    zip: (...refs) => { const n = Math.max(0, ...refs.map((r) => r.length)); return mk(Array.from({ length: n }, (_, i) => refs.map((r) => r[i]))); },
    mesh: (...refs) => { const n = Math.max(0, ...refs.map((r) => r.length)); const out = []; for (let i = 0; i < n; i++) for (const r of refs) out.push(r[i]); return mk(out); },
  };
  const blocks = {}; for (const k of ['first', 'any', 'all', 'none', 'notall']) blocks[k] = '$_';
  for (const k of ['reduce', 'reductions', 'pairmap', 'pairgrep', 'pairfirst']) blocks[k] = '$a, $b';
  return { exports, default: [], blockfns: blocks,
    listfns: ['shuffle', 'sample', 'uniq', 'uniqnum', 'uniqint', 'pairs', 'unpairs', 'pairkeys', 'pairvalues', 'pairmap', 'pairgrep', 'head', 'tail', 'zip', 'mesh', 'reductions'] };
} });
