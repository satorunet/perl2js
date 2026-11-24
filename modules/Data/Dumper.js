/* Data::Dumper — Dumper(), $Data::Dumper::Indent / Sortkeys / Terse */
Perl2JS.module({ name: 'Data::Dumper', init(api) {
  const { G } = api;
function dumper(vals) {
  const cfg = (n, d) => (G['$Data_Dumper_' + n] === undefined ? d : G['$Data_Dumper_' + n]);
  const indent = +cfg('Indent', 2), sortkeys = !!cfg('Sortkeys', 0), terse = !!cfg('Terse', 0);
  const q = (str) => "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const dump = (v, col, level, seen) => {
    if (v === undefined || v === null) return 'undef';
    if (typeof v === 'boolean') return v ? '1' : "''";
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : q(v);
    if (typeof v === 'string') return q(v);
    if (typeof v === 'function') return 'sub { "DUMMY" }';
    if (typeof v !== 'object') return q(v);
    if (v.nodeType) return q('[' + (v.nodeName || 'Node') + ']');
    if (seen.includes(v)) return '$VAR1';
    const proto = Object.getPrototypeOf(v), cls = proto && proto.__ps ? proto.__ps.__name : null;
    const pre = cls ? 'bless( ' : '';
    const c0 = col + pre.length;
    const nl = indent === 0 ? '' : '\n';
    const pad = indent === 0 ? '' : indent === 1 ? '  '.repeat(level + 1) : ' '.repeat(c0 + 2);
    const cpad = indent === 0 ? '' : indent === 1 ? '  '.repeat(level) : ' '.repeat(c0);
    const seen2 = seen.concat([v]);
    let body;
    if (Array.isArray(v)) {
      body = v.length ? '[' + nl + v.map((x) => pad + dump(x, c0 + 2, level + 1, seen2)).join(',' + nl) + nl + cpad + ']' : '[]';
    } else {
      let keys = Object.keys(v);
      if (sortkeys) keys = keys.slice().sort();
      body = keys.length ? '{' + nl + keys.map((k) => { const kk = q(k) + ' => '; return pad + kk + dump(v[k], c0 + 2 + kk.length, level + 1, seen2); }).join(',' + nl) + nl + cpad + '}' : '{}';
    }
    return cls ? pre + body + ', ' + q(cls) + ' )' : body;
  };
  return vals.map((v, i) => {
    const head = terse ? '' : '$VAR' + (i + 1) + ' = ';
    return head + dump(v, terse ? 0 : head.length, 0, []) + (terse ? '' : ';') + (indent === 0 ? '' : '\n');
  }).join('');
}


return { exports: { Dumper: (...vals) => dumper(vals) }, default: ['Dumper'], listops: ['Dumper'] };
} });
