/* File::Spec::Functions — catfile catdir splitdir ... as plain functions */
Perl2JS.module({ name: 'File::Spec::Functions', deps: ['File::Spec'], init(api) {
  const f = api.use('File::Spec').exports;
  const names = ['canonpath', 'catdir', 'catfile', 'curdir', 'rootdir', 'updir', 'no_upwards', 'file_name_is_absolute', 'path'];
  const exports = {}; for (const n of Object.keys(f)) exports[n] = f[n];
  return { exports, default: names.filter((n) => exports[n]), listops: Object.keys(exports) };
} });
