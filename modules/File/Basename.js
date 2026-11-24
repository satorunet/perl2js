/* File::Basename — fileparse / basename / dirname (Unix rules) */
Perl2JS.module({ name: 'File::Basename', init(api) {
  const { mk } = api;
  const stripSep = (p) => p.replace(/(.)\/*$/s, '$1');
  const pat = (p) => (p instanceof RegExp ? p.source : String(p));
  function fileparse(full, ...suffixes) {
    full = String(full);
    const m = /^((?:.*\/)?)(.*)$/s.exec(full);
    let dir = m[1] || './', base = m[2], suffix = '';
    for (const p of suffixes.flat(1)) {
      const mm = new RegExp('(' + pat(p) + ')$', 's').exec(base);
      if (mm) { suffix = mm[1] + suffix; base = base.slice(0, mm.index); break; }
    }
    return mk([base, dir, suffix]);
  }
  const quote = (s) => String(s).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  function basename(path, ...suf) {
    path = stripSep(String(path));
    const [base, dir, suffix] = fileparse(path, ...suf.flat(1).map(quote));
    let b = base;
    if (suffix.length && !b.length) b = suffix;
    if (!b.length) b = dir;
    return b;
  }
  function dirname(path) {
    let [base, dir] = fileparse(String(path));
    dir = stripSep(dir);
    if (!base.length) { [base, dir] = fileparse(dir); dir = stripSep(dir); }
    return dir;
  }
  return { exports: { fileparse, basename, dirname, fileparse_set_fstype: () => 'Unix' }, default: ['fileparse', 'basename', 'dirname', 'fileparse_set_fstype'], listfns: ['fileparse'], listops: ['fileparse', 'basename'], unary: ['dirname'] };
} });
