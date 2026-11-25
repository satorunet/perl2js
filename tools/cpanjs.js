#!/usr/bin/env node
/* CPANjs: the module registry of Perl2JS (cpanjs/lib/, registered by Pull Request).
 *   node tools/cpanjs.js new Foo::Bar --author your-github-id [--js]   make the three files of a new module
 *   node tools/cpanjs.js check                                          check every module and run its tests
 *   node tools/cpanjs.js check --base DIR --author ID [--admin ID]      also check a Pull Request against DIR (the current cpanjs/)
 *   node tools/cpanjs.js index                                          write cpanjs/index.json and cpanjs/README.md
 *   --root DIR : the cpanjs/ folder to work on (default: the one of this repository) */
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const REPO = path.join(__dirname, '..');
const Perl2JS = require(path.join(REPO, 'perl2js.js'));

const NAME = /^[A-Z][A-Za-z0-9_]*(::[A-Za-z_]\w*)*$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const MAX_BYTES = 200 * 1024;

const argv = process.argv.slice(2), cmd = argv.shift();
const opt = {}, args = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--js') opt.js = true;
  else if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
  else args.push(argv[i]);
}
const ROOT = path.resolve(opt.root || path.join(REPO, 'cpanjs'));
const rel = (name) => name.replace(/::/g, '/');
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// every file under dir, as 'Foo/Bar.pm'; symbolic links are reported, never followed
function walk(dir, errors, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = prefix + e.name;
    if (e.isDirectory()) return walk(path.join(dir, e.name), errors, p + '/');
    if (!e.isFile()) { errors.push(p + ': 通常のファイル以外は置けません'); return []; }
    return [p];
  });
}
function readModules(root, errors) {
  const mods = new Map();
  for (const f of walk(path.join(root, 'lib'), errors)) {
    const m = /^(.+)\.(pm|js|json)$/.exec(f);
    if (!m) { errors.push('lib/' + f + ': 置けるのは .pm / .js / .json だけです'); continue; }
    const name = m[1].replace(/\//g, '::');
    const mod = mods.get(name) || mods.set(name, { name, code: [] }).get(name);
    if (m[2] === 'json') {
      try { mod.meta = JSON.parse(fs.readFileSync(path.join(root, 'lib', f), 'utf8')); } catch (e) { errors.push('lib/' + f + ': JSON として読めません (' + e.message + ')'); }
    } else mod.code.push(f);
  }
  return mods;
}

function bundled() {
  const set = new Set(walk(path.join(REPO, 'modules'), []).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3).replace(/\//g, '::').toLowerCase()));
  for (const p of Perl2JS.pragmas) set.add(p.toLowerCase());
  return set;
}
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

function checkModule(mod, errors, reserved) {
  const err = (m) => errors.push(mod.name + ': ' + m);
  if (!NAME.test(mod.name)) err('モジュール名は大文字で始まる半角英数字を :: でつなげます');
  if (reserved.has(mod.name.toLowerCase()) || /^(main|CORE|Perl2JS|CPANjs)(::|$)/i.test(mod.name)) err('同梱モジュール・プラグマ・予約された名前は登録できません');
  if (mod.code.length !== 1) { err('コードは ' + rel(mod.name) + '.pm か .js のどちらか 1 つです'); return false; }
  const code = fs.readFileSync(path.join(ROOT, 'lib', mod.code[0]));
  if (code.length > MAX_BYTES) err('コードは ' + MAX_BYTES / 1024 + 'KB までです');
  const t = mod.meta;
  if (!t || typeof t !== 'object') { err(rel(mod.name) + '.json がありません'); return false; }
  if (t.name !== mod.name) err('json の "name" がファイルの場所と一致しません');
  if (!VERSION.test(t.version)) err('"version" は 1.2.3 の形式です');
  if (typeof t.abstract !== 'string' || !t.abstract.trim() || t.abstract.length > 200 || /[\r\n]/.test(t.abstract)) err('"abstract" は 200 文字以内の 1 行の説明です');
  if (!Array.isArray(t.authors) || !t.authors.length || !t.authors.every((a) => LOGIN.test(a))) err('"authors" は GitHub のユーザー名の配列です');
  if (typeof t.license !== 'string' || !t.license.trim()) err('"license" を書いてください (例: "MIT", "perl")');
  if (!fs.existsSync(path.join(ROOT, 't', rel(mod.name) + '.pl'))) err('テスト t/' + rel(mod.name) + '.pl がありません');
  return true;
}

// a Pull Request may only touch the author's own modules, and a changed module needs a bigger version
function checkOwnership(mods, errors) {
  const base = path.resolve(opt.base), author = opt.author;
  if (!author) { errors.push('--base には --author も必要です'); return; }
  const admin = !!opt.admin && same(opt.admin, author);
  const old = readModules(base, []);
  const read = (root, f) => { const p = path.join(root, f); return fs.existsSync(p) ? fs.readFileSync(p) : null; };
  const differs = (f) => { const a = read(base, f), b = read(ROOT, f); return a === null || b === null ? a !== b : !a.equals(b); };
  for (const name of new Set([...old.keys(), ...mods.keys()])) {
    const o = old.get(name), n = mods.get(name);
    const err = (m) => errors.push(name + ': ' + m);
    if (!o) {
      if ([...old.keys()].some((k) => same(k, name))) err('大文字小文字だけが違う名前のモジュールがあります');
      if (!admin && !(n.meta && [].concat(n.meta.authors).some((a) => same(a, author)))) err('"authors" に Pull Request を出した本人 (' + author + ') を入れてください');
      continue;
    }
    const codeChanged = [...new Set([...o.code, ...(n ? n.code : [])])].some((f) => differs('lib/' + f));
    const changed = codeChanged || differs('lib/' + rel(name) + '.json') || differs('t/' + rel(name) + '.pl');
    if (!changed) continue;
    if (!n) { if (!admin) err('モジュールの削除は管理者だけができます (Issue で依頼してください)'); continue; }
    if (!admin && !(o.meta && [].concat(o.meta.authors).some((a) => same(a, author)))) err(author + ' はこのモジュールの作者ではありません');
    if (codeChanged && !(o.meta && n.meta && VERSION.test(n.meta.version) && newer(n.meta.version, o.meta.version))) err('コードを変えるときは "version" を ' + (o.meta && o.meta.version) + ' より大きくしてください');
  }
}

// load the module and run its test in a separate process, with a time limit
function runTest(name, errors) {
  const r = spawnSync(process.execPath, [__filename, 'run-test', name, '--root', ROOT], { encoding: 'utf8', timeout: 30000 });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 || /^not ok\b/m.test(out) || !/^ok\b/m.test(out)) errors.push(name + ': テストに失敗しました' + (r.error ? ' (' + r.error.message + ')' : '') + '\n' + out.split('\n').slice(0, 30).map((l) => '    ' + l).join('\n'));
}

function check() {
  const errors = [], mods = readModules(ROOT, errors), reserved = bundled(), seen = new Map();
  walk(path.join(ROOT, 't'), errors);
  for (const mod of mods.values()) {
    const low = mod.name.toLowerCase();
    if (seen.has(low)) errors.push(mod.name + ': ' + seen.get(low) + ' と大文字小文字だけが違います');
    seen.set(low, mod.name);
  }
  if (opt.base) checkOwnership(mods, errors);
  const valid = [...mods.values()].filter((m) => checkModule(m, errors, reserved));
  if (!errors.length) for (const m of valid) runTest(m.name, errors);
  if (errors.length) { console.error(errors.map((e) => '✗ ' + e).join('\n')); process.exit(1); }
  console.log('✓ CPANjs: ' + mods.size + ' モジュール OK');
}

function index() {
  const errors = [], mods = readModules(ROOT, errors);
  const list = [...mods.values()].filter((m) => m.meta && m.code.length === 1).sort((a, b) => (a.name < b.name ? -1 : 1)).map((m) => ({
    name: m.name, version: m.meta.version, abstract: m.meta.abstract, authors: m.meta.authors, license: m.meta.license, file: 'lib/' + m.code[0],
  }));
  fs.writeFileSync(path.join(ROOT, 'index.json'), JSON.stringify(list, null, 2) + '\n');
  const cell = (s) => String(s).replace(/[\\`*_\[\]<>|@#]/g, (c) => '&#' + c.charCodeAt(0) + ';');
  fs.writeFileSync(path.join(ROOT, 'README.md'), '# CPANjs モジュール一覧\n\n' +
    '[登録のしかた](../docs/cpanjs.ja.md) · [How to register](../docs/cpanjs.md)\n\n' +
    '<!-- このファイルは tools/cpanjs.js index が作ります。手で編集しないでください -->\n\n' +
    '| モジュール | 版 | 説明 | 作者 | ライセンス |\n|---|---|---|---|---|\n' +
    list.map((m) => '| [' + m.name + '](' + m.file + ') | ' + m.version + ' | ' + cell(m.abstract) + ' | ' + m.authors.map((a) => '[' + a + '](https://github.com/' + a + ')').join(' ') + ' | ' + cell(m.license) + ' |').join('\n') + '\n');
  console.log('indexed ' + list.length + ' modules');
}

function create() {
  const name = args[0], author = opt.author;
  if (!name || !NAME.test(name) || !author || !LOGIN.test(author)) { console.error('usage: node tools/cpanjs.js new Foo::Bar --author your-github-id [--js]'); process.exit(1); }
  if (bundled().has(name.toLowerCase())) { console.error(name + ' は同梱モジュールの名前です'); process.exit(1); }
  const lib = path.join(ROOT, 'lib', rel(name)), test = path.join(ROOT, 't', rel(name) + '.pl');
  if (['.pm', '.js', '.json'].some((x) => fs.existsSync(lib + x))) { console.error(name + ' はすでに登録されています'); process.exit(1); }
  const code = opt.js
    ? "Perl2JS.module({\n  name: '" + name + "',\n  init(api) {\n    return { exports: { hello: () => 'Hello' }, default: [] };\n  },\n});\n"
    : 'package ' + name + ';\nuse strict;\nuse warnings;\nuse Exporter qw(import);\n\nour @EXPORT_OK = qw(hello);\n\nsub hello { return "Hello" }\n\n1;\n';
  fs.mkdirSync(path.dirname(lib), { recursive: true });
  fs.mkdirSync(path.dirname(test), { recursive: true });
  fs.writeFileSync(lib + (opt.js ? '.js' : '.pm'), code);
  fs.writeFileSync(lib + '.json', JSON.stringify({ name, version: '0.1.0', abstract: '', authors: [author], license: 'MIT' }, null, 2) + '\n');
  fs.writeFileSync(test, 'use strict;\nuse warnings;\nuse Test::More tests => 1;\nuse ' + name + " qw(hello);\n\nis(hello(), 'Hello', 'hello');\n");
  console.log('作りました: ' + [lib + (opt.js ? '.js' : '.pm'), lib + '.json', test].map((p) => path.relative(process.cwd(), p)).join('  ') + '\n"abstract" を書いてから node tools/cpanjs.js check を実行してください');
}

if (cmd === 'check') check();
else if (cmd === 'index') index();
else if (cmd === 'new') create();
else if (cmd === 'run-test') {
  Perl2JS.cpanjs = path.join(ROOT, 'lib') + '/';
  try {
    Perl2JS.run('use ' + args[0] + ';');
    Perl2JS.run(fs.readFileSync(path.join(ROOT, 't', rel(args[0]) + '.pl'), 'utf8'));
  } catch (e) { console.error(Perl2JS.errorText(e)); process.exit(1); }
} else { console.error('usage: node tools/cpanjs.js new|check|index'); process.exit(1); }
