#!/usr/bin/env node
/* Runs every ```perl block of the given Markdown files with real Perl and with Perl2JS and compares the output.
 *   node tools/verify-docs.js docs/syntax.md docs/modules.md
 * Needs a `perl` on the PATH.  Blocks that are not meant to be compared: use ```perl2js (browser-only) or ```text. */
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const Perl2JS = require(path.join(__dirname, '..', 'perl2js.js'));

let bad = 0, total = 0;
for (const file of process.argv.slice(2)) {
  const md = fs.readFileSync(file, 'utf8');
  const re = /^```perl\n([\s\S]*?)^```/gm;
  let m, n = 0;
  while ((m = re.exec(md))) {
    n++; total++;
    const code = m[1];
    const line = md.slice(0, m.index).split('\n').length + 1;
    const tmp = path.join(os.tmpdir(), 'p2j-doc-' + process.pid + '.pl');
    fs.writeFileSync(tmp, code);
    const real = spawnSync('perl', [tmp], { encoding: 'utf8', env: Object.assign({}, process.env, { TZ: 'Asia/Tokyo' }) });
    let out = '', err = '';
    Perl2JS.stdout = (s) => { out += s; };
    try { Perl2JS.run(code); } catch (e) { err = Perl2JS.errorText(e); }
    const ok = !err && out === real.stdout && real.status === 0;
    if (!ok) {
      bad++;
      console.log('\n✗ ' + file + ' block ' + n + ' (line ' + line + ')');
      if (real.status !== 0) console.log('  real perl failed: ' + (real.stderr || '').split('\n')[0]);
      if (err) console.log('  perl2js error: ' + err.split('\n').slice(0, 3).join(' | '));
      if (!err && out !== real.stdout) {
        const a = real.stdout.split('\n'), b = out.split('\n');
        for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log('  line ' + (i + 1) + '\n    perl   : ' + JSON.stringify(a[i]) + '\n    perl2js: ' + JSON.stringify(b[i])); break; }
      }
    }
  }
}
console.log('\n' + (total - bad) + ' / ' + total + ' blocks identical to real Perl' + (bad ? '  (' + bad + ' differ)' : ''));
process.exit(bad ? 1 : 0);
