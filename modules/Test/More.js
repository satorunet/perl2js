/* Test::More — ok is isnt like unlike cmp_ok is_deeply can_ok isa_ok pass fail diag note done_testing plan subtest ...
   Output is TAP on stdout (diagnostics are printed as "# ..." lines too, so they show up in the page). */
Perl2JS.module({ name: 'Test::More', init(api) {
  const { RT, _s, G } = api;
  let n, failed, planned, done, indent, skipAll, out;
  const reset = () => { n = 0; failed = 0; planned = null; done = false; indent = ''; skipAll = false; };
  reset();
  const emit = (s) => { for (const line of String(s).split('\n')) Perl2JS.stdout(indent + line + '\n'); };
  const diag = (...a) => { const m = a.flat(1).map(_s).join(''); for (const l of m.split('\n')) emit('# ' + l); return ''; };
  const quote = (v) => (v === undefined || v === null ? 'undef' : "'" + String(_s(v)) + "'");
  const str = (v) => (v === undefined || v === null ? undefined : String(_s(v)));
  function report(pass, name, extra) {
    n++;
    const nm = name === undefined || name === null ? '' : ' - ' + String(name).replace(/#/g, '\\#');
    emit((pass ? 'ok ' : 'not ok ') + n + nm);
    if (!pass) {
      failed++;
      const where = ' at line ' + RT._ln.v + '.';
      diag(name !== undefined && name !== null ? "  Failed test '" + name + "'\n" + '  ' + where.trim() : '  Failed test' + '\n' + '  ' + where.trim());
      if (extra) diag(extra);
    }
    return pass ? 1 : 0;
  }
  // first difference, written like Test::More:  $got->{a}[1] = '1'  /  $expected->{a}[1] = '2'
  function firstDiff(a, b, path) {
    const show = (v) => (v === undefined || v === null ? 'undef' : typeof v === 'object' ? (Array.isArray(v) ? 'ARRAY' : 'HASH') + '(0x...)' : "'" + String(_s(v)) + "'");
    if (a === b) return null;
    if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return String(_s(a)) === String(_s(b)) && typeof a !== 'object' ? null : [path, show(a), show(b)];
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
    for (const k of keys) {
      const p = path + (Array.isArray(a) ? '[' + k + ']' : '{' + k + '}');
      if (!(k in a)) return [p, 'Does not exist', show(b[k])];
      if (!(k in b)) return [p, show(a[k]), 'Does not exist'];
      const d = firstDiff(a[k], b[k], p); if (d) return d;
    }
    return null;
  }
  function deepEq(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return String(_s(a)) === String(_s(b));
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEq(a[k], b[k]));
  }
  const ops = { '==': (a, b) => +a === +b, '!=': (a, b) => +a !== +b, '<': (a, b) => +a < +b, '>': (a, b) => +a > +b, '<=': (a, b) => +a <= +b, '>=': (a, b) => +a >= +b,
    eq: (a, b) => String(a) === String(b), ne: (a, b) => String(a) !== String(b), lt: (a, b) => String(a) < String(b), gt: (a, b) => String(a) > String(b), le: (a, b) => String(a) <= String(b), ge: (a, b) => String(a) >= String(b),
    '&&': (a, b) => !!(a && b), '||': (a, b) => !!(a || b), '=~': (a, b) => b.test(String(a)) };
  const exports = {
    ok: (t, name) => report(!!t && t !== '0', name),
    pass: (name) => report(true, name), fail: (name) => report(false, name),
    is: (got, exp, name) => { const g = str(got), e = str(exp), p = g === e; return report(p, name, p ? '' : '         got: ' + quote(got) + '\n    expected: ' + quote(exp)); },
    isnt: (got, exp, name) => { const p = str(got) !== str(exp); return report(p, name, p ? '' : '         got: ' + quote(got) + '\n    expected: anything else'); },
    like: (got, re, name) => { const p = got != null && new RegExp(re.source, re.flags.replace('g', '')).test(String(got)); return report(p, name, p ? '' : '                  ' + quote(got) + "\n    doesn't match '(?^" + re.flags.replace('g', '') + ':' + re.source + ")'"); },
    unlike: (got, re, name) => { const p = got == null || !new RegExp(re.source, re.flags.replace('g', '')).test(String(got)); return report(p, name, p ? '' : '                  ' + quote(got) + "\n          matches '(?^" + re.flags.replace('g', '') + ':' + re.source + ")'"); },
    cmp_ok: (a, op, b, name) => { const f = ops[op]; const p = f ? f(a, b) : false; return report(p, name, p ? '' : '    ' + quote(a) + '\n        ' + op + '\n    ' + quote(b)); },
    is_deeply: (a, b, name) => {
      const ok = deepEq(a, b);
      let extra = '';
      if (!ok) { const d = firstDiff(a, b, ''); extra = d ? '    Structures begin differing at:\n         $got->' + d[0].replace(/^(.)/, '$1') + ' = ' + d[1] + '\n    $expected->' + d[0] + ' = ' + d[2] : '    Structures begin differing'; }
      return report(ok, name, extra);
    },
    can_ok: (obj, ...m) => {
      const list = m.flat(1), cls = typeof obj === 'object' && obj !== null ? (RT.ref_(obj) || 'HASH') : String(obj);
      const missing = list.filter((x) => !(obj != null && typeof obj[x] === 'function'));
      return report(!missing.length, cls + (list.length === 1 ? "->can('" + list[0] + "')" : '->can(...)'), missing.length ? '    ' + cls + "->can('" + missing[0] + "') failed" : '');
    },
    isa_ok: (obj, cls, name) => {
      const isRef = obj != null && typeof obj === 'object', rt = isRef ? RT.ref_(obj) : '';
      const p = (isRef && typeof obj.isa === 'function' && !!obj.isa(cls)) || (isRef && ((cls === 'HASH' && !Array.isArray(obj) && !rt.length) || (Array.isArray(obj) && cls === 'ARRAY')));
      const what = name ? name : isRef ? (['HASH', 'ARRAY', 'CODE'].includes(rt) || !rt ? "A reference of type '" + (Array.isArray(obj) ? 'ARRAY' : 'HASH') + "'" : "An object of class '" + rt + "'") : "The class (or class-like) '" + obj + "'";
      return report(p, what + " isa '" + cls + "'");
    },
    diag, note: (...a) => { const m = a.flat(1).map(_s).join(''); for (const l of m.split('\n')) emit('# ' + l); return ''; },
    explain: (...a) => a.flat(1).map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(_s(v)))),
    plan: (...a) => { const o = {}; const l = a.flat(1); if (l[0] === 'tests') { planned = +l[1]; emit('1..' + planned); } else if (l[0] === 'skip_all') { skipAll = true; emit('1..0 # SKIP ' + (l[1] || '')); } else if (l[0] === 'no_plan') planned = 'no_plan'; return 1; },
    done_testing: (cnt) => { done = true; if (planned === null) { planned = cnt === undefined ? n : cnt; emit('1..' + planned); } return 1; },
    BAIL_OUT: (why) => { emit('Bail out!  ' + (why || '')); throw { exit: true }; },
    use_ok: (m, name) => report(true, name || 'use ' + m + ';'), require_ok: (m, name) => report(true, name || 'require ' + m + ';'),
    subtest: (name, fn) => {
      const saved = { n, failed, planned, done, indent };
      emit('# Subtest: ' + name);
      n = 0; failed = 0; planned = null; done = false; indent = saved.indent + '    ';
      let err; try { fn(); } catch (e) { err = e; }
      if (planned === null) emit('1..' + n);
      const ok = !err && failed === 0 && n > 0;
      n = saved.n; failed = saved.failed; planned = saved.planned; done = saved.done; indent = saved.indent;
      if (err) throw err;
      return report(ok, name);
    },
  };
  return { exports, default: Object.keys(exports), withLine: Object.keys(exports), listops: Object.keys(exports),
    scope(names, args) {
      reset();
      const a = (args || []).map(String);
      if (a[0] === 'tests') { planned = +a[1]; emit('1..' + planned); } else if (a[0] === 'skip_all') { skipAll = true; emit('1..0 # SKIP ' + (a[1] || '')); } else if (a[0] === 'no_plan') planned = 'no_plan';
      return {};
    },
    finish() {
      if (n === 0 && !skipAll) { return; }
      if (!done && planned === null && n > 0) { diag('Tests were run but no plan was declared and done_testing() was not seen.'); }
      else if (typeof planned === 'number' && planned !== n) diag('Looks like you planned ' + planned + ' test' + (planned === 1 ? '' : 's') + ' but ran ' + n + '.');
      if (failed) diag('Looks like you failed ' + failed + ' test' + (failed === 1 ? '' : 's') + ' of ' + n + '.');
    } };
} });
