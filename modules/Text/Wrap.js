/* Text::Wrap — wrap / fill, a port of the real algorithm ($Text::Wrap::columns, ::huge, ::unexpand, ::tabstop, ::separator, ::break) */
Perl2JS.module({ name: 'Text::Wrap', init(api) {
  const { G } = api;
  const cfg = (n, d) => (G['$Text_Wrap_' + n] === undefined ? d : G['$Text_Wrap_' + n]);
  const expand = (s, ts) => String(s).split(/^/m).map((line) => { let offs = 0; return line.replace(/\t/g, (m, pos) => { const pad = ts - ((pos + offs) % ts); offs += pad - 1; return ' '.repeat(pad); }); }).join('');
  const unexpand = (x, ts) => x.split('\n').map((line) => {
    line = expand(line, ts);
    const chunks = line.match(new RegExp('.{1,' + ts + '}', 'gs')) || [];
    return chunks.map((c) => (c.length === ts ? c.replace(/ {2,}$/, '\t') : c)).join('');
  }).join('\n');
  const len = (s) => Array.from(s).length;
  function wrap(ip, xp, ...t) {
    ip = ip == null ? '' : String(ip); xp = xp == null ? '' : String(xp);
    t = t.flat(1).map((x) => (x == null ? '' : String(x)));
    const columns0 = +cfg('columns', 76), huge = cfg('huge', 'wrap'), ts = +cfg('tabstop', 8), un = cfg('unexpand', 1);
    const sep = cfg('separator', '\n'), sep2 = G.$Text_Wrap_separator2;
    const brk = cfg('break', '(?=\\s)(?:.|\\n)'), breakRe = brk instanceof RegExp ? brk.source : String(brk);
    let columns = columns0;
    const tail = t.length ? t.pop() : '';
    const T = expand(t.map((s) => (/\s$/.test(s) ? s : s + ' ')).join('') + tail, ts);
    let lead = ip, r = '';
    let nll = columns - len(expand(xp, ts)) - 1;
    if (nll <= 0 && xp !== '') { columns = len(expand(xp, ts)) + 2; nll = 1; }
    let ll = Math.max(0, columns - len(expand(ip, ts)) - 1);
    let nl = '', remainder = '', pos = 0;
    const endRe = new RegExp('(?:' + breakRe + ')*(?=\\n?$)', 'y');
    while (true) {
      endRe.lastIndex = pos;
      const e = endRe.exec(T);
      if (e) { pos = endRe.lastIndex; break; }
      let m;
      const first = new RegExp('([^\\n]{0,' + ll + '})(' + breakRe + '|\\n+|$)', 'yu');
      first.lastIndex = pos;
      if ((m = first.exec(T))) {
        const piece = nl + lead + m[1]; r += un ? unexpand(piece, ts) : piece; remainder = m[2]; pos = first.lastIndex;
      } else if (huge === 'wrap') {
        const h = new RegExp('([^\\n]{' + ll + '})', 'yu'); h.lastIndex = pos; m = h.exec(T);
        if (!m) throw "This shouldn't happen";
        const piece = nl + lead + m[1]; r += un ? unexpand(piece, ts) : piece; remainder = sep2 !== undefined ? sep2 : sep; pos = h.lastIndex;
      } else if (huge === 'overflow') {
        const o = new RegExp('([^\\n]*?)(' + breakRe + '|\\n+|$)', 'yu'); o.lastIndex = pos; m = o.exec(T);
        const piece = nl + lead + m[1]; r += un ? unexpand(piece, ts) : piece; remainder = m[2]; pos = o.lastIndex;
      } else if (huge === 'die') throw "couldn't wrap '" + T + "'";
      else throw "This shouldn't happen";
      lead = xp; ll = nll;
      nl = sep2 !== undefined ? (remainder === '\n' ? '\n' : sep2) : sep;
    }
    r += remainder;
    if (pos !== T.length) r += lead + T.slice(pos);
    return r;
  }
  function fill(ip, xp, ...raw) {
    const paras = raw.flat(1).join('\n').split(/\n\s+/).map((pp) => wrap(ip, xp, pp.replace(/\s+/g, ' ')));
    return paras.join(ip === xp ? '\n\n' : '\n');
  }
  return { exports: { wrap, fill }, default: ['wrap', 'fill'], listops: ['wrap', 'fill'] };
} });
