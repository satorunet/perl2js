/* File::Spec (Unix) — File::Spec->catfile / catdir / splitdir / canonpath ... */
Perl2JS.module({ name: 'File::Spec', init(api) {
  const { mk, hide } = api;
  const canonpath = (p) => {
    p = String(p);
    if (p === '') return '';
    p = p.replace(/\/{2,}/g, '/').replace(/(?:\/\.)+(?:\/|$)/g, '/');
    if (p !== './') p = p.replace(/^(?:\.\/)+/, '');
    p = p.replace(/^\/(?:\.\.\/)+/, '/').replace(/^\/\.\.$/, '/');
    if (p !== '/') p = p.replace(/\/$/, '');
    return p;
  };
  const flat = (a) => a.flat(1);
  const catdir = (...a) => canonpath(flat(a).concat(['']).join('/'));
  const FS = {
    canonpath: (p) => canonpath(p),
    catdir: (...a) => catdir(...a),
    catfile: (...a) => { a = flat(a); const file = canonpath(a.pop()); if (!a.length) return file; let dir = catdir(...a); if (!dir.endsWith('/')) dir += '/'; return dir + file; },
    curdir: () => '.', updir: () => '..', rootdir: () => '/', tmpdir: () => '/tmp', devnull: () => '/dev/null',
    file_name_is_absolute: (p) => /^\//.test(p),
    splitdir: (p) => mk(String(p).split('/')),
    splitpath: (p, nofile) => { p = String(p); if (nofile) return mk(['', p, '']); const m = /^((?:.*\/(?:\.\.?$)?)?)([^/]*)/s.exec(p); return mk(['', m[1], m[2]]); },
    catpath: (v, d, f) => { if (d !== '' && f !== '' && !/\/$/.test(d)) d += '/'; return d + f; },
    no_upwards: (...a) => mk(flat(a).filter((x) => !/^\.{1,2}$/.test(x))),
    case_tolerant: () => 0,
  };
  const File_Spec = {};
  for (const k of Object.keys(FS)) hide(File_Spec, k, function (...a) { return FS[k](...a); });
  hide(File_Spec, '__perlCall', true);
  return { classes: { 'File::Spec': File_Spec, 'File::Spec::Functions': File_Spec }, exports: FS, default: [] };
} });
