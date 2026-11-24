/*!
 * Perl2JS — Perl syntax that compiles to JavaScript, in the browser.
 *
 *   <script src="perl2js.js"></script>
 *   <script type="text/perl2js"> my $x = 1; say "hi $x"; </script>
 *
 * API: Perl2JS.compile(src) -> JS source
 *      Perl2JS.run(src)     -> compile + execute
 *      Perl2JS.stdout = fn(str)   (where print/say write to)
 */
(function (root) {
'use strict';

/* ----------------------------------------------- per-compile module info */
// filled from the `use Foo qw(...)` lines before translating (see compileFull)
const emptyCur = () => ({ imports: new Map(), classes: new Set(), listfns: new Set(), blockfns: new Set() });
let CUR = emptyCur();
const BLOCKIDS = new Set(['map', 'grep', 'sort']);
const CTRL_BEFORE_BLOCK = new Set(['else', 'do', 'eval', 'sub', 'try', 'catch', 'finally', 'BEGIN', 'END', 'map', 'grep', 'sort', 'if', 'elsif', 'unless', 'while', 'until', 'for', 'foreach', 'continue', 'default', 'package', 'my', 'our', 'local']);
const RESERVED = new Set(['try', 'catch', 'finally', 'delete', 'new', 'var', 'default', 'switch', 'case', 'class', 'function', 'return', 'typeof', 'void', 'with', 'yield',
  'await', 'enum', 'let', 'static', 'this', 'super', 'import', 'export', 'do', 'if', 'else', 'for', 'while', 'in', 'of', 'instanceof', 'throw', 'break', 'continue', 'const', 'null', 'true', 'false']);
const jsName = (n) => (RESERVED.has(n) ? '_i$' + n : n);

/* ------------------------------------------------------------------ lexer */

const QLIKE = new Set(['q', 'qq', 'qw', 'm', 'qr', 's', 'tr', 'y']);
const QDELIM = '/|!#([{<\'"~@,%^:;*+';
const TERMBEFORE = new Set(['and', 'or', 'not', 'xor', 'if', 'unless', 'while', 'until', 'return', 'split',
  'grep', 'map', 'join', 'push', 'unshift', 'print', 'say', 'x', 'eq', 'ne', 'lt', 'gt', 'le', 'ge', 'cmp',
  'elsif', 'foreach', 'for', 'die', 'warn', 'when', 'my', 'our', 'local', 'sort', 'reverse', 'keys', 'values',
  'scalar', 'defined', 'ref', 'lc', 'uc', 'length', 'else', 'do', 'eval', 'each', 'undef', 'delete', 'exists', 'wantarray', 'eachkey']);
const OPS3 = ['<=>', '**=', '||=', '&&=', '//=', '...'];
const OPS2 = ['=~', '!~', '==', '!=', '<=', '>=', '&&', '||', '//', '++', '--', '+=', '-=', '*=', '/=', '.=',
  '%=', '->', '=>', '..', '**', '<<', '>>'];

function valueEnd(t) {
  if (!t) return false;
  switch (t.t) {
    case 'op': return t.v === ')' || t.v === ']' || t.v === '}';
    case 'id': return !TERMBEFORE.has(t.v);
    case 'deref': return false;
    default: return true;
  }
}

// ￥ / ¥ (typed on a JP keyboard) followed by an escape-ish char is treated as a backslash: "hello￥n" == "hello\n"
function normalizeYen(src) {
  return src.replace(/[\u00a5\uffe5](?=[ntr\\"'$@dwsDWSbB.()\[\]{}\/|+*?^\-\u00a5\uffe5])/g, '\\');
}

function lex(src) {
  src = normalizeYen(src);
  const T = [];
  const n = src.length;
  let i = 0;
  let lnPos = 0, ln = 1;
  const lineOf = (pos) => { while (lnPos < pos && lnPos < n) { if (src[lnPos] === '\n') ln++; lnPos++; } return ln; };
  let hdLine = -1, hdEnd = -1;          // pending heredoc bodies: skip [hdLine, hdEnd) when the current line ends
  const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };

  function readDelim(at) {
    const o = src[at], c = pairs[o] || o;
    let depth = 1, j = at + 1, s = '';
    while (j < n) {
      const ch = src[j];
      if (ch === '\\') { s += ch + (src[j + 1] || ''); j += 2; continue; }
      if (pairs[o] && ch === o) depth++;
      else if (ch === c && --depth === 0) return [s, j + 1];
      s += ch; j++;
    }
    throw perr('Perl2JS: unterminated literal starting with ' + o, lineOf(at));
  }

  while (i < n) {
    let sp = false;
    for (;;) {
      if (i >= n) break;
      const ch = src[i];
      if (ch === '\n' && i === hdLine) { i = hdEnd; hdLine = -1; sp = true; }
      else if (/\s/.test(ch)) { i++; sp = true; }
      else if (ch === '#') { while (i < n && src[i] !== '\n') i++; sp = true; }
      else if (ch === '=' && (i === 0 || src[i - 1] === '\n') && /^=[a-zA-Z]/.test(src.slice(i, i + 2))) {
        const e = src.indexOf('\n=cut', i);               // POD block
        if (e < 0) i = n; else { const nl = src.indexOf('\n', e + 1); i = nl < 0 ? n : nl; }
        sp = true;
      } else break;
    }
    if (i >= n) break;
    if ('$@%&'.includes(src[i]) && src.charCodeAt(i + 1) >= 0xFF21 && src.charCodeAt(i + 1) <= 0xFF5A) {      // @ａ  %ｈ : half-width sigil + full-width name
      let k = i + 1, run = '';
      for (; k < n; k++) { const cc = src.charCodeAt(k); if (cc >= 0xFF01 && cc <= 0xFF5E) { run += String.fromCharCode(cc - 0xFEE0); Perl2JS.notes.push({ line: lineOf(k), from: src[k], to: run[run.length - 1] }); } else break; }
      src = src.slice(0, i + 1) + run + src.slice(k);
    }
    {   // full-width symbols typed with a Japanese IME  ＄ｘ ＝ （ ） ｛ ｝ ； ， “ ” ‘ ’ ...  are read as their half-width twins (inside strings they stay as text)
      const fc = src.charCodeAt(i);
      let half = null;
      if (fc >= 0xFF01 && fc <= 0xFF5E) half = String.fromCharCode(fc - 0xFEE0);
      else if (fc === 0x201C || fc === 0x201D) half = '"';
      else if (fc === 0x2018 || fc === 0x2019) half = "'";
      else if (fc === 0x3001 && false) half = ',';
      if (half && (fc === 0x201C || fc === 0x2018)) {                                   // “text” / ‘text’ : convert the closing quote too
        const closer = fc === 0x201C ? ['\u201D', '\u201C', '"'] : ['\u2019', '\u2018', "'"];
        let e = -1;
        for (let k = i + 1; k < n && src[k] !== '\n'; k++) if (src[k] === closer[0] || src[k] === closer[1]) { e = k; break; }
        if (e > 0) src = src.slice(0, e) + half + src.slice(e + 1);
      }
      if (half) {
        let k = i, run = '';
        for (; k < n; k++) {                                                              // the whole run:  ＄ｎ  ｛ｋ｝  １．．３
          const cc = src.charCodeAt(k);
          if (cc >= 0xFF01 && cc <= 0xFF5E) { run += String.fromCharCode(cc - 0xFEE0); Perl2JS.notes.push({ line: lineOf(k), from: src[k], to: run[run.length - 1] }); }
          else if (k === i) { run += half; Perl2JS.notes.push({ line: lineOf(k), from: src[k], to: half }); }
          else break;
        }
        src = src.slice(0, i) + run + src.slice(k);
      }
    }
    const c = src[i];
    const last = T[T.length - 1];
    const expectTerm = !valueEnd(last);
    const push = (t) => { t.sp = sp; t.line = lineOf(i); T.push(t); };
    const rest = src.slice(i);
    let m;

    // numbers
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || '') && expectTerm)) {
      m = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|[0-9][0-9_]*(?:\.(?!\.)[0-9_]*)?(?:[eE][+-]?[0-9]+)?|\.[0-9]+)/.exec(rest);
      push({ t: 'num', v: m[0] }); i += m[0].length; continue;
    }
    // heredoc:  <<"EOT"  <<'EOT'  <<EOT  <<~EOT
    if (c === '<' && src[i + 1] === '<' && expectTerm && (m = /^<<(~?)(?:"([^"\n]*)"|'([^'\n]*)'|([A-Za-z_]\w*))/.exec(rest))) {
      const indent = m[1] === '~', tag = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
      const raw = m[3] !== undefined;
      let le = src.indexOf('\n', i); if (le < 0) le = n;
      let at = hdLine === le ? hdEnd : le + 1;
      const lines = [];
      let found = false;
      while (at < n) {
        let e = src.indexOf('\n', at); if (e < 0) e = n;
        const line = src.slice(at, e);
        at = Math.min(e + 1, n);
        if ((indent ? line.trim() : line) === tag) { found = true; break; }
        lines.push(line);
      }
      if (!found) throw perr('Perl2JS: heredoc terminator "' + tag + '" not found', lineOf(i));
      hdLine = le; hdEnd = at;
      if (indent) {
        const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)[0].length), Infinity);
        if (ind !== Infinity) for (let k = 0; k < lines.length; k++) lines[k] = lines[k].slice(Math.min(ind, /^[ \t]*/.exec(lines[k])[0].length));
      }
      const body = lines.length ? lines.join('\n') + '\n' : '';
      push(raw ? { t: 'str', interp: false, v: body } : { t: 'str', interp: true, raw: body });
      i += m[0].length; continue;
    }
    // strings
    if (c === "'") {
      const [s, j] = readDelim(i);
      push({ t: 'str', interp: false, v: s.replace(/\\([\\'])/g, '$1') }); i = j; continue;
    }
    if (c === '"') {
      const [s, j] = readDelim(i);
      push({ t: 'str', interp: true, raw: s }); i = j; continue;
    }
    // variables
    if (c === '$') {
      if (src[i + 1] === '(' || (src[i + 1] === '-' && src[i + 2] === '>')) { push({ t: 'id', v: '$' }); i++; continue; }   // jQuery: $("#id") / $->ajax(..)
      if ((m = /^\$\$([A-Za-z_]\w*)(?=[\[{])/.exec(rest))) { push({ t: 'var', sig: '$', name: m[1], elem: null }); push({ t: 'op', v: '->' }); i += m[0].length; continue; }   // $$r[0]  ==  $r->[0]
      if (rest.startsWith('$#{')) { push({ t: 'deref', sig: '$#' }); i += 2; continue; }       // $#{ expr }
      if ((m = /^\$#\$([A-Za-z_]\w*)/.exec(rest))) { push({ t: 'var', sig: '$#', name: m[1], ref: true }); i += m[0].length; continue; }
      if ((m = /^\$#([A-Za-z_]\w*)/.exec(rest))) { push({ t: 'var', sig: '$#', name: m[1] }); i += m[0].length; continue; }
      if ((m = /^\$([A-Za-z_]\w*(?:::\w+)*|\d+|[@!&|,\\\/]|\+(?=\{))/.exec(rest))) {
        i += m[0].length;
        const nx = src[i];
        push({ t: 'var', sig: '$', name: m[1] === '+' ? 'NAMED_' : m[1], elem: nx === '[' ? '[' : nx === '{' ? '{' : null });
        continue;
      }
      if (src[i + 1] === '$' || src[i + 1] === '{') { push({ t: 'deref', sig: '$' }); i++; continue; }
    }
    if (c === '@') {
      if ((m = /^@([A-Za-z_]\w*(?:::\w+)*)/.exec(rest))) { push({ t: 'var', sig: '@', name: m[1] }); i += m[0].length; continue; }
      if (src[i + 1] === '$' || src[i + 1] === '{') { push({ t: 'deref', sig: '@' }); i++; continue; }
    }
    if (c === '%' && expectTerm) {
      if ((m = /^%([A-Za-z_]\w*)/.exec(rest))) { push({ t: 'var', sig: '%', name: m[1] }); i += m[0].length; continue; }
      if (src[i + 1] === '$' || src[i + 1] === '{') { push({ t: 'deref', sig: '%' }); i++; continue; }
    }
    if (c === '&' && expectTerm && (m = /^&(?:\$([A-Za-z_]\w*)|\{\s*\$([A-Za-z_]\w*)\s*\})(?=\s*\()/.exec(rest))) {      // &$code(args)  ==  $code->(args)
      push({ t: 'var', sig: '$', name: m[1] || m[2], elem: null }); push({ t: 'op', v: '->' }); i += m[0].length; continue;
    }
    if (c === '&' && expectTerm && (m = /^&([A-Za-z_]\w*)/.exec(rest))) {
      push({ t: 'id', v: m[1] }); i += m[0].length; continue;
    }
    // bare regex
    if (c === '/' && expectTerm) {
      const [pat, j] = readDelim(i);
      m = /^[a-z]*/.exec(src.slice(j));
      push({ t: 're', pat, flags: m[0] }); i = j + m[0].length; continue;
    }
    // words
    if ((m = /^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*/.exec(rest))) {
      const w = m[0];
      if (w === '__END__' || w === '__DATA__') break;
      const nc = src[i + w.length];
      const afterArrow = last && last.t === 'op' && last.v === '->';
      if (QLIKE.has(w) && nc !== undefined && !afterArrow && QDELIM.includes(nc)) {
        const [body, j] = readDelim(i + w.length);
        i = j;
        if (w === 'q') push({ t: 'str', interp: false, v: body.replace(/\\([\\'])/g, '$1') });
        else if (w === 'qq') push({ t: 'str', interp: true, raw: body });
        else if (w === 'qw') push({ t: 'qw', list: body.split(/\s+/).filter(Boolean) });
        else if (w === 'm' || w === 'qr') { const f = /^[a-z]*/.exec(src.slice(i))[0]; i += f.length; push({ t: 're', pat: body, flags: f, qr: w === 'qr' }); }
        else { // s/// , tr///
          let rep;
          if (pairs[nc]) { while (/\s/.test(src[i])) i++; [rep, i] = readDelim(i); }
          else { [rep, i] = readDelim(i - 1); }
          const f = /^[a-z]*/.exec(src.slice(i))[0]; i += f.length;
          if (w === 's') push({ t: 'subst', pat: body, rep, flags: f });
          else push({ t: 'trans', from: body, to: rep, flags: f });
        }
        continue;
      }
      push({ t: 'id', v: w }); i += w.length; continue;
    }
    // operators
    let op = null;
    for (const o of OPS3) if (src.startsWith(o, i)) { op = o; break; }
    if (!op) for (const o of OPS2) if (src.startsWith(o, i)) { op = o; break; }
    if (!op) op = c;
    push({ t: 'op', v: op }); i += op.length;
  }
  return T;
}

/* ------------------------------------------------- token-level rewriting */

const OBJPREV = new Set(['=', '(', ',', '=>', '[', '?', ':', '||', '&&', '//', '!', '+']);
const tok = {
  id: (v) => ({ t: 'id', v, sp: true }),
  op: (v) => ({ t: 'op', v, sp: true }),
};

function matching(T, i) {
  let d = 0;
  for (let j = i; j < T.length; j++) {
    const u = T[j];
    if (u.t !== 'op') continue;
    if (u.v === '(' || u.v === '[' || u.v === '{') d++;
    else if (u.v === ')' || u.v === ']' || u.v === '}') { if (--d === 0) return j; }
  }
  return -1;
}

function braceKind(T, i) {
  const t = T[i], p = T[i - 1];
  if (!p) return 'block';
  if (p.t === 'deref') return 'deref';
  if (p.t === 'var' && p.sig === '$' && p.elem === '{' && !t.sp) return 'sub';
  if (p.t === 'op') {
    if (p.v === '->') return 'sub';
    if ((p.v === ']' || (p.v === '}' && p.kind === 'sub')) && !t.sp) return 'sub';
    if (p.v === '{' && (p.kind === 'fn' || p.kind === 'deref')) return 'obj';
    if (OBJPREV.has(p.v)) return 'obj';
    return 'block';
  }
  if (p.t === 'id') {
    if (BLOCKIDS.has(p.v) || CUR.blockfns.has(p.v)) return 'fn';
    if (p.v === 'return' || p.v === 'bless') return 'obj';
    // `die { code => 1 }`, `croak { ... }`, `push @a, ...`: after a list operator, `{ word => ...` is a hash
    if (!CTRL_BEFORE_BLOCK.has(p.v) && T[i + 1] && T[i + 2] && ((T[i + 1].t === 'id' || T[i + 1].t === 'str' || (T[i + 1].t === 'var' && T[i + 1].sig === '$')) && T[i + 2].t === 'op' && T[i + 2].v === '=>' || (T[i + 1].t === 'op' && T[i + 1].v === '}'))) return 'obj';
  }
  return 'block';
}

function classify(T) {
  const stk = [];
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (t.t !== 'op') continue;
    if (t.v === '(') stk.push('p');
    else if (t.v === '[') stk.push('b');
    else if (t.v === '{') { t.kind = braceKind(T, i); stk.push(t.kind); }
    else if (t.v === ')' || t.v === ']') stk.pop();
    else if (t.v === '}') t.kind = stk.pop();
  }
}

// sub name ($a, $b) {  ==>  sub name { my ($a, $b) = @_;
function rewriteSubs(T) {
  for (let i = 0; i < T.length; i++) {
    if (!(T[i].t === 'id' && T[i].v === 'sub')) continue;
    let j = i + 1;
    if (T[j] && T[j].t === 'id') j++;
    if (T[j] && T[j].t === 'op' && T[j].v === '(') {
      const k = matching(T, j);
      if (k > 0 && T[k + 1] && T[k + 1].t === 'op' && T[k + 1].v === '{') {
        const params = T.slice(j + 1, k);
        T.splice(j, k + 1 - j);
        if (params.length) {
          T.splice(j + 1, 0, tok.id('my'), tok.op('('), ...params, tok.op(')'), tok.op('='),
            { t: 'var', sig: '@', name: '_', sp: true }, tok.op(';'));
        }
        return true;
      }
    }
  }
  return false;
}

// `stmt if cond;`  ==>  `if (cond) { stmt }`
function rewriteMods(T) {
  const MODS = new Set(['if', 'unless', 'while', 'until', 'for', 'foreach']);
  const stk = [];
  let start = 0, startDepth = 0;
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (t.t === 'op') {
      const v = t.v;
      if (v === '(' || v === '[' || v === '{') {
        // a `do {}` / `eval {}` / `sub {}` block is an expression: a following `while`/`until`/`if` is still a modifier of the whole statement
        stk.push({ start, startDepth, ex: v === '{' && t.kind === 'block' && !!T[i - 1] && T[i - 1].t === 'id' && (T[i - 1].v === 'do' || T[i - 1].v === 'eval' || T[i - 1].v === 'sub') });
        if (v === '{' && t.kind === 'block') { start = i + 1; startDepth = stk.length; }      // statements inside the block start here
      } else if (v === ')' || v === ']' || v === '}') {
        const e = stk.pop();
        if (!e) continue;
        start = e.start; startDepth = e.startDepth;
        if (v === '}' && t.kind === 'block' && !e.ex) { start = i + 1; startDepth = stk.length; }
      } else if (v === ';' && stk.length === startDepth) start = i + 1;
      continue;
    }
    if (t.t === 'id' && i === start && stk.length === startDepth && /^[A-Z_][A-Z0-9_]*$/.test(t.v) && T[i + 1] && T[i + 1].t === 'op' && T[i + 1].v === ':' && !(T[i + 2] && T[i + 2].t === 'op' && T[i + 2].v === ':')) { start = i + 2; continue; }   // LABEL: for ...
    if (t.t === 'id' && MODS.has(t.v) && !t.dwTail && i > start && stk.length === startDepth) {
      let d = 0, j = i + 1;
      for (; j < T.length; j++) {
        const u = T[j];
        if (u.t !== 'op') continue;
        if (u.v === '(' || u.v === '[' || u.v === '{') d++;
        else if (u.v === ')' || u.v === ']' || u.v === '}') { if (d === 0) break; d--; }
        else if (u.v === ';' && d === 0) break;
      }
      const stmt = T.slice(start, i), cond = T.slice(i + 1, j);
      if ((t.v === 'while' || t.v === 'until') && stmt.length > 2 && stmt[0].t === 'id' && stmt[0].v === 'do' && stmt[1].t === 'op' && stmt[1].v === '{' && matching(stmt, 1) === stmt.length - 1) {
        const dw = Object.assign({}, stmt[0], { dw: true, ir: true });
        const tail = tok.id(t.v); tail.dwTail = true;        // already handled: do not treat this `while` as a modifier again
        T.splice(start, j - start, dw, ...stmt.slice(1), tail, tok.op('('), ...cond, tok.op(')'));
        return true;
      }
      const kw = t.v === 'for' ? 'foreach' : t.v;
      T.splice(start, j - start, tok.id(kw), tok.op('('), ...cond, tok.op(')'), tok.op('{'), ...stmt, tok.op('}'));
      return true;
    }
  }
  return false;
}

// Perl subs return their last expression: insert `return` there.
function addReturn(T, open, close) {
  let ls = open + 1, d = 0;
  for (let k = open + 1; k < close; k++) {
    const u = T[k];
    if (u.t !== 'op') continue;
    if (u.v === '(' || u.v === '[' || u.v === '{') d++;
    else if (u.v === ')' || u.v === ']' || u.v === '}') {
      d--;
      if (d === 0 && u.v === '}' && u.kind === 'block') {
        const nx = T[k + 1], ob = matching(T, k) /* unused */;
        const opener = findOpen(T, k);
        const before = T[opener - 1];
        const isStmtBlock = before && ((before.t === 'op' && before.v === ')') || (before.t === 'id' && before.v === 'else'));
        if (isStmtBlock && !(nx && nx.t === 'id' && (nx.v === 'else' || nx.v === 'elsif'))) ls = k + 1;
      }
    } else if (u.v === ';' && d === 0) ls = k + 1;
  }
  if (ls >= close) return;
  const f = T[ls];
  if (f.t === 'id') {
    if (['return', 'my', 'our', 'local', 'last', 'next', 'for', 'foreach', 'while', 'until', 'die'].includes(f.v)) return;
    if (f.v === 'if' || f.v === 'unless') {
      const blocks = [];
      let p = ls;
      while (T[p] && T[p].t === 'id' && ['if', 'unless', 'elsif', 'else'].includes(T[p].v)) {
        p++;
        if (T[p - 1].v !== 'else') p = matching(T, p) + 1;
        if (!(T[p] && T[p].t === 'op' && T[p].v === '{')) break;
        const e = matching(T, p);
        blocks.push([p, e]);
        p = e + 1;
      }
      for (let b = blocks.length - 1; b >= 0; b--) addReturn(T, blocks[b][0], blocks[b][1]);
      return;
    }
  } else if (f.t === 'op' && f.v === '{') {
    const isHash = T[ls + 1] && ((T[ls + 1].t === 'op' && T[ls + 1].v === '}') || (T[ls + 2] && T[ls + 2].t === 'op' && T[ls + 2].v === '=>'));
    if (!isHash) return;
  }
  T.splice(ls, 0, tok.id('return'));
}
function findOpen(T, closeIdx) {
  let d = 0;
  for (let j = closeIdx; j >= 0; j--) {
    const u = T[j];
    if (u.t !== 'op') continue;
    if (u.v === ')' || u.v === ']' || u.v === '}') d++;
    else if (u.v === '(' || u.v === '[' || u.v === '{') { if (--d === 0) return j; }
  }
  return -1;
}
function rewriteReturns(T) {
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (t.t === 'id' && (t.v === 'sub' || t.v === 'eval' || t.v === 'do') && !t.ir) {
      let j = i + 1;
      if (t.v === 'sub' && T[j] && T[j].t === 'id') j++;
      if (T[j] && T[j].t === 'op' && T[j].v === '{') {
        t.ir = true;
        const e = matching(T, j);
        if (e > 0) { const before = T.length; addReturn(T, j, e); if (T.length !== before) return true; }
      }
    }
  }
  return false;
}

// $h{x}++ / $h{x} += n / $h{x} .= s : undef counts as 0 / ""
function rewriteElemOps(T) {
  for (let i = 1; i < T.length; i++) {
    const t = T[i];
    if (t.t !== 'op' || t.fixed || !['++', '--', '+=', '-=', '.='].includes(t.v)) continue;
    const p = T[i - 1];
    if (!(p.t === 'op' && (p.v === ']' || (p.v === '}' && p.kind === 'sub')))) continue;
    let k = i - 1, s = -1;
    for (;;) {
      const u = T[k];
      if (!u) break;
      if (u.t === 'op' && (u.v === ']' || (u.v === '}' && u.kind === 'sub'))) { k = findOpen(T, k) - 1; continue; }
      if (u.t === 'op' && u.v === '->') { k--; continue; }
      if (u.t === 'var' && u.sig === '$') s = k;
      break;
    }
    if (s < 0) continue;
    t.fixed = true;
    const lv = T.slice(s, i).map((u) => Object.assign({}, u));
    const init = t.v === '.=' ? { t: 'str', interp: false, v: '', sp: true } : { t: 'num', v: '0', sp: true };
    const pre = [tok.op('('), ...lv, { t: 'op', v: '//=', sp: true }, init, tok.op(',')];
    T.splice(s, 0, ...pre);
    const oi = i + pre.length;
    if (t.v === '++' || t.v === '--') T.splice(oi + 1, 0, tok.op(')'));
    else {
      let d = 0, j = oi + 1;
      for (; j < T.length; j++) {
        const u = T[j];
        if (u.t !== 'op') continue;
        if (u.v === '(' || u.v === '[' || u.v === '{') d++;
        else if (u.v === ')' || u.v === ']' || u.v === '}') { if (d === 0) break; d--; }
        else if ((u.v === ';' || u.v === ',') && d === 0) break;
      }
      T.splice(j, 0, tok.op(')'));
    }
    return true;
  }
  return false;
}

function rewriteTryTiny(T) {
  for (let i = 0; i < T.length; i++) {
    if (!(T[i].t === 'id' && T[i].v === 'try' && T[i + 1] && T[i + 1].t === 'op' && T[i + 1].v === '{' && !T[i].tt)) continue;
    const parts = [];
    let j = i + 1;
    const e0 = matching(T, j);
    if (e0 < 0) continue;
    if (T[e0 + 1] && T[e0 + 1].t === 'id' && T[e0 + 1].v === 'catch' && T[e0 + 2] && T[e0 + 2].t === 'op' && T[e0 + 2].v === '(') continue;   // Perl 5.34 `catch ($e)`: native
    parts.push({ kind: 'try', body: T.slice(j, e0 + 1) });
    j = e0 + 1;
    while (T[j] && T[j].t === 'id' && (T[j].v === 'catch' || T[j].v === 'finally') && T[j + 1] && T[j + 1].t === 'op' && T[j + 1].v === '{') {
      const e = matching(T, j + 1);
      parts.push({ kind: T[j].v, body: T.slice(j + 1, e + 1) });
      j = e + 1;
    }
    const out = [tok.id('_try'), tok.op('(')];
    parts.forEach((p, k) => {
      if (k) out.push(tok.op(','));
      if (p.kind !== 'try') out.push(tok.id('_' + p.kind), tok.op('('));
      out.push(tok.id('sub'), ...p.body);
      if (p.kind !== 'try') out.push(tok.op(')'));
    });
    out.push(tok.op(')'));
    out[0].tt = true;
    T.splice(i, j - i, ...out);
    return true;
  }
  return false;
}

function rewriteFnBlocks(T) {
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (!(t.t === 'op' && t.v === '{' && t.kind === 'fn') || t.fnDone) continue;
    t.fnDone = true;
    const e = matching(T, i);
    if (e < 0) continue;
    let d = 0, lastSemi = -1, hasSemi = false;
    for (let j = i + 1; j < e; j++) {
      const u = T[j];
      if (u.t !== 'op') continue;
      if (u.v === '(' || u.v === '[' || u.v === '{') d++;
      else if (u.v === ')' || u.v === ']' || u.v === '}') d--;
      else if (u.v === ';' && d === 0) { hasSemi = true; if (j < e - 1) lastSemi = j; }
    }
    if (!hasSemi) continue;
    t.stmts = true;
    let end = e;                                   // a trailing `;` before the closing brace is dropped from the "last statement"
    if (T[e - 1].t === 'op' && T[e - 1].v === ';') { end = e - 1; lastSemi = (() => { let dd = 0, ls = -1; for (let j = i + 1; j < end; j++) { const u = T[j]; if (u.t !== 'op') continue; if ('([{'.includes(u.v) && u.v.length === 1) dd++; else if (')]}'.includes(u.v) && u.v.length === 1) dd--; else if (u.v === ';' && dd === 0) ls = j; } return ls; })(); }
    const start = lastSemi + 1 > i ? lastSemi + 1 : i + 1;
    const first = T[start];
    if (!first || start >= end || (first.t === 'id' && ['if', 'unless', 'for', 'foreach', 'while', 'until', 'return', 'my', 'our'].includes(first.v))) return true;
    const prevId = T[i - 1] && T[i - 1].t === 'id' ? T[i - 1].v : '';
    const open = prevId === 'map' ? '[' : '(', close = prevId === 'map' ? ']' : ')';
    T.splice(end, 0, tok.op(close));
    T.splice(start, 0, tok.id('return'), tok.op(open));
    return true;
  }
  return false;
}

function rewriteCopyAssign(T) {
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (!(t.t === 'op' && t.v === '(')) continue;
    const prev = T[i - 1];
    if (prev && !(prev.t === 'op' && (prev.v === ';' || prev.v === '{' || prev.v === '}'))) continue;      // statement start only
    let k = i + 1;
    const decl = T[k] && T[k].t === 'id' && (T[k].v === 'my' || T[k].v === 'our' || T[k].v === 'local') ? T[k++] : null;
    const v = T[k];
    if (!(v && v.t === 'var' && v.sig === '$' && !v.elem && T[k + 1] && T[k + 1].t === 'op' && T[k + 1].v === '=')) continue;
    const e = matching(T, i);
    if (e < 0 || !(T[e + 1] && T[e + 1].t === 'op' && T[e + 1].v === '=~' && T[e + 2] && (T[e + 2].t === 'subst' || T[e + 2].t === 'trans'))) continue;
    const expr = T.slice(k + 2, e);
    const copy = Object.assign({}, v, { elem: null, sp: true });
    T.splice(i, e - i + 1, ...(decl ? [decl] : []), Object.assign({}, v), tok.op('='), ...expr, tok.op(';'), copy);
    return true;
  }
  return false;
}

function rewriteLastIdx(T) {            // $#{ EXPR }  ==>  (scalar(@{ EXPR }) - 1)
  for (let i = 0; i < T.length; i++) {
    if (T[i].t === 'deref' && T[i].sig === '$#' && T[i + 1] && T[i + 1].t === 'op' && T[i + 1].v === '{') {
      const c = matching(T, i + 1);
      T.splice(c + 1, 0, tok.op(')'), tok.op('-'), { t: 'num', v: '1', sp: true }, tok.op(')'));
      T.splice(i, 1, tok.op('('), tok.id('scalar'), tok.op('('), { t: 'deref', sig: '@', sp: true });
      return true;
    }
  }
  return false;
}

function rewriteCountOf(T) {            // $n = () = LIST;   ==>   $n = scalar(LIST)   (number of elements / matches)
  const O = (t, v) => t && t.t === 'op' && t.v === v;
  for (let i = 0; i + 3 < T.length; i++) {
    if (O(T[i], '=') && O(T[i + 1], '(') && O(T[i + 2], ')') && O(T[i + 3], '=')) {
      let k = i + 4, d = 0;
      for (; k < T.length; k++) { const u = T[k]; if (u.t === 'op') { if ('([{'.includes(u.v)) d++; else if (')]}'.includes(u.v)) { if (d === 0) break; d--; } else if (u.v === ';' && d === 0) break; } }
      T.splice(k, 0, tok.op(')'));
      T.splice(i + 1, 3, tok.id('_countof'), tok.op('('));
      return true;
    }
  }
  return false;
}

const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '.=', '%=', '**=', '||=', '&&=', '//=', 'x=', '++', '--']);
function stmtEnd(T, from) {               // index of the `;` (or the closing bracket) that ends the statement starting before `from`
  let d = 0;
  for (let k = from; k < T.length; k++) {
    const u = T[k];
    if (u.t === 'op') { if ('([{'.includes(u.v)) d++; else if (')]}'.includes(u.v)) { if (d === 0) return k; d--; } else if (u.v === ';' && d === 0) return k; }
    else if (d === 0 && u.t === 'id' && ['if', 'unless', 'for', 'foreach', 'while', 'until'].includes(u.v)) return k;
  }
  return T.length;
}
function rewriteAggAssign(T) {           // @a = LIST;  %h = LIST;  @$r = LIST;  @{EXPR} = LIST   ==>  aset_/hset_: change the array/hash IN PLACE so references to it see the change
  const O = (t, v) => t && t.t === 'op' && t.v === v;
  for (let i = 0; i < T.length; i++) {
    const prev = T[i - 1];
    if (prev && !(prev.t === 'op' && (prev.v === ';' || prev.v === '{' || prev.v === '}'))) continue;      // statement start (so `my @a = ...` is untouched)
    const t = T[i];
    let base, e;
    if (t.t === 'var' && (t.sig === '@' || t.sig === '%') && O(T[i + 1], '=')) { base = [tok.op('\\'), t]; e = i; }
    else if (t.t === 'deref' && (t.sig === '@' || t.sig === '%')) {
      if (T[i + 1] && T[i + 1].t === 'var' && T[i + 1].sig === '$' && O(T[i + 2], '=')) { base = [Object.assign({}, T[i + 1], { elem: null })]; e = i + 1; }
      else if (O(T[i + 1], '{')) { const c = matching(T, i + 1); if (!O(T[c + 1], '=')) continue; base = [tok.op('('), ...T.slice(i + 2, c), tok.op(')')]; e = c; }
      else continue;
    } else continue;
    const hash = t.sig === '%';
    const end = stmtEnd(T, e + 2);
    let rhs = T.slice(e + 2, end);
    if (!rhs.length) rhs = [tok.op('('), tok.op(')')];
    if (O(rhs[0], '(') && matching(rhs, 0) === rhs.length - 1) rhs = rhs.slice(1, -1);
    let d = 0, comma = false;
    for (const u of rhs) { if (u.t === 'op') { if ('([{'.includes(u.v)) d++; else if (')]}'.includes(u.v)) d--; else if ((u.v === ',' || u.v === '=>') && d === 0) comma = true; } }
    const lit = comma || rhs.length === 0 || (rhs.length === 1 && (rhs[0].t === 'num' || rhs[0].t === 'str' || rhs[0].t === 'qw'));
    const call = (hash ? 'hset' : 'aset') + (lit ? 'l_' : '_');
    T.splice(e + 0 - (base.length === 2 && t.t === 'var' ? 0 : 0), 0);
    T.splice(i, end - i, tok.id(call), tok.op('('), ...base, tok.op(','), ...(lit ? [tok.op('['), ...rhs, tok.op(']')] : rhs), tok.op(')'));
    return true;
  }
  return false;
}

let aliasSeq = 0;
function rewriteForAlias(T) {            // for my $e (@a) { $e *= 2 }  /  for (@a) { s/x/y/ }   ==>  index loop where $e is spelled $a[$i]  (foreach aliases the elements)
  const O = (t, v) => t && t.t === 'op' && t.v === v;
  for (let i = 0; i < T.length; i++) {
    if (!(T[i].t === 'id' && (T[i].v === 'for' || T[i].v === 'foreach'))) continue;
    let k = i + 1, loopVar = null, my = false;
    if (T[k] && T[k].t === 'id' && T[k].v === 'my') { my = true; k++; }
    if (T[k] && T[k].t === 'var' && T[k].sig === '$' && !T[k].elem) { loopVar = T[k]; k++; } else if (my) continue;
    if (!O(T[k], '(')) continue;
    const pc = matching(T, k);
    const L = T.slice(k + 1, pc);
    let arr;                                                                 // [tokens for  `$#arr`, element builder]
    if (L.length === 1 && L[0].t === 'var' && L[0].sig === '@') arr = { last: { t: 'var', sig: '$#', name: L[0].name, sp: true }, elem: (ix) => [{ t: 'var', sig: '$', name: L[0].name, elem: '[', sp: true }, tok.op('['), ix, tok.op(']')] };
    else if (L.length === 2 && L[0].t === 'deref' && L[0].sig === '@' && L[1].t === 'var' && L[1].sig === '$') arr = { last: { t: 'var', sig: '$#', name: L[1].name, ref: true, sp: true }, elem: (ix) => [Object.assign({}, L[1], { elem: null, sp: true }), tok.op('->'), tok.op('['), ix, tok.op(']')] };
    else continue;
    if (!O(T[pc + 1], '{')) continue;
    const bc = matching(T, pc + 1);
    const nm = loopVar ? loopVar.name : '_';
    let modified = false;
    for (let q = pc + 2; q < bc; q++) {
      const u = T[q];
      if (u.t === 'var' && u.sig === '$' && u.name === nm && !u.elem) {
        const n1 = T[q + 1], p1 = T[q - 1];
        if ((n1 && n1.t === 'op' && ASSIGN_OPS.has(n1.v)) || (n1 && O(n1, '=~') && T[q + 2] && (T[q + 2].t === 'subst' || T[q + 2].t === 'trans')) || (p1 && p1.t === 'op' && (p1.v === '++' || p1.v === '--'))) { modified = true; break; }
      }
      if (!loopVar && (u.t === 'subst' || u.t === 'trans') && !(T[q - 1] && O(T[q - 1], '=~'))) { modified = true; break; }       // bare s/// works on $_
    }
    if (!modified) continue;
    const ix = { t: 'var', sig: '$', name: '__i' + (aliasSeq++), elem: null, sp: true };
    // body: replace $e by the element expression (and bare s///, tr/// by  ELEM =~ s///)
    const body = [];
    for (let q = pc + 2; q < bc; q++) {
      const u = T[q];
      if (u.t === 'var' && u.sig === '$' && u.name === nm && !u.elem) body.push(...arr.elem(ix));
      else if (!loopVar && (u.t === 'subst' || u.t === 'trans') && !(T[q - 1] && O(T[q - 1], '=~'))) body.push(...arr.elem(ix), tok.op('=~'), u);
      else if (u.t === 'str' && u.interp && u.raw && u.raw.includes('$' + nm)) {          // "z$e"  ->  "z$a[$i]"
        const rep = arr.elem(ix).map((x) => (x.t === 'var' ? '$' + x.name : x.v)).join('');
        body.push(Object.assign({}, u, { raw: u.raw.replace(new RegExp('(?<!\\\\)\\$' + nm.replace(/\$/g, '\\$') + '(?![A-Za-z0-9_\\[{])', 'g'), () => (arr.elem(ix)[0].ref ? rep : rep)) }));
      }
      else body.push(u);
    }
    T.splice(i, bc + 1 - i, tok.id('foreach'), tok.id('my'), ix, tok.op('('), { t: 'num', v: '0', sp: true }, tok.op('..'), arr.last, tok.op(')'), tok.op('{'), ...body, tok.op('}'));
    return true;
  }
  return false;
}

const JS_GLOBALS = new Set(['Math', 'JSON', 'console', 'document', 'window', 'Object', 'Array', 'Number', 'String', 'Date', 'Promise', 'localStorage', 'sessionStorage', 'navigator', 'location', 'Intl', 'history', 'performance']);
function rewriteJsDots(T) {              // Math.max(1, 2)  document.getElementById("x").value   ==>   JS-style `.` access is accepted next to `->`
  const O = (t, v) => t && t.t === 'op' && t.v === v;
  for (let i = 0; i < T.length; i++) {
    if (!(T[i].t === 'id' && JS_GLOBALS.has(T[i].v) && O(T[i + 1], '.') && !T[i + 1].sp && T[i + 2] && T[i + 2].t === 'id' && !T[i + 2].sp)) continue;
    if (T[i - 1] && O(T[i - 1], '->')) continue;
    let d = 0, changed = false;
    for (let k = i + 1; k < T.length; k++) {
      const u = T[k];
      if (u.t === 'op') {
        if ('([{'.includes(u.v)) d++;
        else if (')]}'.includes(u.v)) { if (d === 0) break; d--; }
        else if ((u.v === ';' || u.v === ',') && d === 0) break;
        else if (u.v === '.' && !u.sp && T[k + 1] && T[k + 1].t === 'id' && !T[k + 1].sp && (T[k - 1].t === 'id' || O(T[k - 1], ')') || O(T[k - 1], ']'))) { T[k] = Object.assign({}, u, { v: '->' }); changed = true; }
      }
    }
    if (changed) return true;
  }
  return false;
}

function rewriteListIndex(T) {          // (10, 20, 30)[1]  ==>  [10, 20, 30][1]      (a comma list, not a call)
  const O = (t, v) => t && t.t === 'op' && t.v === v;
  for (let i = 0; i < T.length; i++) {
    if (!O(T[i], '(')) continue;
    const p = T[i - 1];
    if (p && (p.t === 'id' && !['return', 'print', 'push', 'unshift', 'my', 'our', 'local', 'join', 'say'].includes(p.v) || p.t === 'var' || p.t === 'deref' || O(p, ')') || O(p, ']'))) continue;
    const c = matching(T, i);
    if (c < 0 || !O(T[c + 1], '[') || T[c + 1].sp) continue;
    let d = 0, comma = false;
    for (let k = i + 1; k < c; k++) { const u = T[k]; if (u.t === 'op') { if ('([{'.includes(u.v)) d++; else if (')]}'.includes(u.v)) d--; else if (u.v === ',' && d === 0) comma = true; } }
    if (!comma) continue;
    T[i] = tok.op('['); T[c] = tok.op(']');
    T[i].sp = false; T[i].lit = true; T[c].lit = true;
    if (O(p, '+') && T[i - 2] && T[i - 2].t === 'id') { T.splice(i - 1, 1); }            // print +(1,2,3)[1]
    return true;
  }
  return false;
}

function rewriteSubstr(T) {              // substr($s, o, l, repl)  and  substr($s, o, l) = repl   ==>   $s = substr4_($s, o, l, repl)
  const O = (t, v) => t && t.t === 'op' && t.v === v;
  for (let i = 0; i < T.length; i++) {
    if (!(T[i].t === 'id' && T[i].v === 'substr' && O(T[i + 1], '(') && T[i + 2] && T[i + 2].t === 'var' && T[i + 2].sig === '$' && !T[i + 2].elem && O(T[i + 3], ','))) continue;
    if (T[i - 1] && O(T[i - 1], '->')) continue;
    const c = matching(T, i + 1);
    const args = []; let d = 0, cur = [];
    for (let k = i + 2; k < c; k++) { const u = T[k]; if (u.t === 'op') { if ('([{'.includes(u.v)) d++; else if (')]}'.includes(u.v)) d--; else if (u.v === ',' && d === 0) { args.push(cur); cur = []; continue; } } cur.push(u); }
    args.push(cur);
    const v = T[i + 2];
    const join = (a) => a.reduce((acc, x, n) => (n ? acc.concat([tok.op(',')], x) : x), []);
    if (args.length === 4) {
      T.splice(i, c + 1 - i, tok.op('('), Object.assign({}, v), tok.op('='), tok.id('substr4_'), tok.op('('), ...join(args), tok.op(')'), tok.op(')'));
      return true;
    }
    if ((args.length === 2 || args.length === 3) && O(T[c + 1], '=')) {
      const end = stmtEnd(T, c + 2);
      let rhs = T.slice(c + 2, end);
      const len = args.length === 3 ? args[2] : [tok.id('undef')];
      T.splice(i, end - i, tok.op('('), Object.assign({}, v), tok.op('='), tok.id('substr4_'), tok.op('('), ...args[0], tok.op(','), ...args[1], tok.op(','), ...len, tok.op(','), tok.op('('), ...rhs, tok.op(')'), tok.op(')'), tok.op(')'));
      return true;
    }
  }
  return false;
}

function rewriteDelete(T) {            // delete $h{k} / delete $r->{a}{b}  ==>  hdel_(base, key)   (returns the removed value like Perl)
  const O = (t, v) => t && t.t === 'op' && t.v === v;
  for (let i = 0; i < T.length; i++) {
    if (!(T[i].t === 'id' && (T[i].v === 'delete' || T[i].v === 'exists') && T[i + 1] && T[i + 1].t === 'var' && T[i + 1].sig === '$' && !(T[i - 1] && O(T[i - 1], '->')))) continue;
    const v = T[i + 1];
    let k = i + 2; const groups = [];
    if (v.elem === '{') { const c = matching(T, k); groups.push([k, c]); k = c + 1; }
    else if (v.elem === '[') continue;
    for (;;) {
      if (O(T[k], '->') && O(T[k + 1], '{')) { const c = matching(T, k + 1); groups.push([k + 1, c, k]); k = c + 1; }
      else if (O(T[k], '{') && groups.length && !T[k].sp) { const c = matching(T, k); groups.push([k, c]); k = c + 1; }
      else break;
    }
    if (!groups.length) continue;
    const last = groups[groups.length - 1];
    const inner = T.slice(last[0] + 1, last[1]);
    const key = inner.length === 1 && inner[0].t === 'id' ? [{ t: 'str', interp: false, v: inner[0].v, sp: true }] : inner;
    let base;
    if (groups.length === 1 && v.elem) base = [tok.op('\\'), { t: 'var', sig: '%', name: v.name, sp: false }];
    else base = T.slice(i + 1, last[2] !== undefined ? last[2] : last[0]).map((x, n) => (n === 0 && groups.length === 1 ? Object.assign({}, x, { elem: null }) : x));
    T.splice(i, last[1] + 1 - i, tok.id(T[i].v === 'exists' ? 'hexists_' : 'hdel_'), tok.op('('), ...base, tok.op(','), ...key, tok.op(')'));
    return true;
  }
  return false;
}

function rewriteSlices(T) {
  // @h{LIST} / @$r{LIST} / @{EXPR}{LIST}  -> hslice_(%h, LIST)      @$r[LIST] / @{EXPR}[LIST] -> aslice_(@$r, LIST)
  // @h{LIST} = RHS -> hsset_(%h, LIST, RHS)      delete @h{LIST} -> hsdel_(%h, LIST)      ${EXPR}{k} -> (EXPR)->{k}
  const O = (t, v) => t && t.t === 'op' && t.v === v;
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (t.t === 'deref' && t.sig === '$' && O(T[i + 1], '{')) {                       // ${ $h }{k}
      const c = matching(T, i + 1);
      if (!O(T[c + 1], '{') && !O(T[c + 1], '[')) {
        if (c === i + 3 && T[i + 2].t === 'var' && T[i + 2].sig === '$') { const v0 = Object.assign({}, T[i + 2], { elem: null }); T.splice(i, 4, t, v0); continue; }      // ${$r}  ==  $$r
        T.splice(c, 1, tok.op(')'), tok.op('->'), tok.id('v')); T.splice(i, 2, tok.op('(')); return true;
      }
      if (O(T[c + 1], '{')) { T.splice(c + 1, 0, tok.op('->')); T[c] = tok.op(')'); T.splice(i, 2, tok.id('deref_'), tok.op('(')); return true; }   // ${$h}{k} -> deref_($h)->{k}
      continue;
    }
    let kind = null, start = i, base = [], j;
    if (t.t === 'var' && t.sig === '@' && O(T[i + 1], '{') && !T[i + 1].sp) { kind = 'h'; base = [tok.op('\\'), { t: 'var', sig: '%', name: t.name, sp: false }]; j = i + 1; }
    else if (t.t === 'deref' && t.sig === '@') {
      let e;
      if (T[i + 1] && T[i + 1].t === 'var' && T[i + 1].sig === '$') { e = i + 1; base = [Object.assign({}, T[i + 1], { elem: null })]; }
      else if (O(T[i + 1], '{')) { e = matching(T, i + 1); base = [tok.op('('), ...T.slice(i + 2, e), tok.op(')')]; }
      else continue;
      if (O(T[e + 1], '{') && !T[e + 1].sp) { kind = 'h'; j = e + 1; }
      else if (O(T[e + 1], '[') && !T[e + 1].sp) { kind = 'a'; j = e + 1; }
      else continue;
    } else continue;
    if (!kind) continue;
    const c = matching(T, j);
    const list = T.slice(j + 1, c);
    let end = c + 1;
    const callee = kind === 'a' ? 'aslice_' : 'hslice_';
    const prevDelete = T[start - 1] && T[start - 1].t === 'id' && T[start - 1].v === 'delete';
    if (kind === 'h' && O(T[end], '=') ) {                                               // assignment
      let d = 0, k = end + 1;
      for (; k < T.length; k++) { const u = T[k]; if (u.t === 'op') { if ('([{'.includes(u.v)) d++; else if (')]}'.includes(u.v)) { if (d === 0) break; d--; } else if (u.v === ';' && d === 0) break; } }
      let rhs = T.slice(end + 1, k);
      if (O(rhs[0], '(') && matching(rhs, 0) === rhs.length - 1) rhs = rhs.slice(1, -1);
      T.splice(start, k - start, tok.id('hsset_'), tok.op('('), ...base, tok.op(','), tok.op('['), ...list, tok.op(']'), tok.op(','), tok.op('['), ...rhs, tok.op(']'), tok.op(')'));
      return true;
    }
    const name = prevDelete ? 'hsdel_' : callee;
    const from = prevDelete ? start - 1 : start;
    T.splice(from, end - from, tok.id(name), tok.op('('), ...base, tok.op(','), ...list, tok.op(')'));
    return true;
  }
  return false;
}

let eachSeq = 0;
function rewriteEach(T) {
  const O = (t, v) => t && t.t === 'op' && t.v === v;
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    // 1. while (my ($k, $v) = LIST) {...}   ==>   while (1) { my @tmp = LIST; last unless @tmp; my ($k, $v) = @tmp; ... }
    if (t.t === 'id' && (t.v === 'while') && O(T[i + 1], '(') && T[i + 2] && T[i + 2].t === 'id' && T[i + 2].v === 'my' && O(T[i + 3], '(')) {
      const lc = matching(T, i + 3);
      const pc = matching(T, i + 1);
      if (lc > 0 && O(T[lc + 1], '=') && pc > lc && O(T[pc + 1], '{')) {
        const tmp = { t: 'var', sig: '@', name: '__e' + (eachSeq++), sp: true };
        const lhs = T.slice(i + 2, lc + 1), rhs = T.slice(lc + 2, pc);
        const tmpv = (extra) => Object.assign({}, tmp, extra || {});
        T.splice(i, pc + 2 - i, tok.id('while'), tok.op('('), { t: 'num', v: '1', sp: true }, tok.op(')'), tok.op('{'),
          tok.id('my'), tmpv(), tok.op('='), ...rhs, tok.op(';'),
          tok.id('last'), tok.id('unless'), tmpv(), tok.op(';'),
          ...lhs, tok.op('='), tmpv(), tok.op(';'));
        return true;
      }
    }
    // 2. while (my $k = each %h) {...}   ==>   while (defined(my $k = eachkey(%h))) -> same loop shape
    if (t.t === 'id' && t.v === 'while' && O(T[i + 1], '(') && T[i + 2] && T[i + 2].t === 'id' && T[i + 2].v === 'my' && T[i + 3] && T[i + 3].t === 'var' && T[i + 3].sig === '$' && O(T[i + 4], '=') && T[i + 5] && T[i + 5].t === 'id' && T[i + 5].v === 'each') {
      const pc = matching(T, i + 1);
      if (pc > 0 && O(T[pc + 1], '{')) {
        const v = T[i + 3], rhs = T.slice(i + 6, pc);
        T.splice(i, pc + 2 - i, tok.id('while'), tok.op('('), { t: 'num', v: '1', sp: true }, tok.op(')'), tok.op('{'),
          tok.id('my'), Object.assign({}, v), tok.op('='), tok.id('eachkey'), ...rhs, tok.op(';'),
          tok.id('last'), tok.id('unless'), tok.id('defined'), tok.op('('), Object.assign({}, v), tok.op(')'), tok.op(';'));
        return true;
      }
    }
    // 3. each %h / each %$r / each %{EXPR} / each @a / each @$r   ==>   each(\%h) / each($r) / each(EXPR) ...
    if (t.t === 'id' && (t.v === 'each' || t.v === 'eachkey') && !(T[i - 1] && O(T[i - 1], '->'))) {
      const a = T[i + 1];
      let base, end;
      if (a && a.t === 'var' && (a.sig === '%' || a.sig === '@')) { base = [tok.op('\\'), Object.assign({}, a, { sp: false })]; end = i + 1; }
      else if (a && a.t === 'deref' && (a.sig === '%' || a.sig === '@')) {
        if (T[i + 2] && T[i + 2].t === 'var' && T[i + 2].sig === '$') { base = [Object.assign({}, T[i + 2], { elem: null })]; end = i + 2; }
        else if (O(T[i + 2], '{')) { const c = matching(T, i + 2); base = [tok.op('('), ...T.slice(i + 3, c), tok.op(')')]; end = c; }
        else continue;
      } else continue;
      T.splice(i, end + 1 - i, tok.id(t.v + '_'), tok.op('('), ...base, tok.op(')'));
      return true;
    }
  }
  return false;
}

// our @ISA = ('Base');  ==>  use parent -norequire, ('Base');
function rewriteISA(T) {
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (t.t === 'var' && t.sig === '@' && t.name === 'ISA' && T[i + 1] && T[i + 1].t === 'op' && T[i + 1].v === '=') {
      const st = T[i - 1] && T[i - 1].t === 'id' && (T[i - 1].v === 'our' || T[i - 1].v === 'my') ? i - 1 : i;
      let e = i + 2;
      while (e < T.length && !(T[e].t === 'op' && T[e].v === ';')) e++;
      const items = T.slice(i + 2, e);
      T.splice(st, e - st, tok.id('use'), tok.id('parent'), tok.op('-'), tok.id('norequire'), tok.op(','), ...items);
      return true;
    }
  }
  return false;
}

// my ($class, %args) = @_;  ==>  my ($class, @_tmp_args) = @_; my %args = @_tmp_args;
function rewriteHashList(T) {
  for (let i = 0; i < T.length; i++) {
    if (!(T[i].t === 'id' && T[i].v === 'my' && T[i + 1] && T[i + 1].t === 'op' && T[i + 1].v === '(')) continue;
    const e = matching(T, i + 1);
    if (e < 0 || !(T[e + 1] && T[e + 1].t === 'op' && T[e + 1].v === '=')) continue;
    let hi = -1;
    for (let k = i + 2; k < e; k++) if (T[k].t === 'var' && T[k].sig === '%') { hi = k; break; }
    if (hi < 0) continue;
    const hv = T[hi];
    let j = e + 2, d = 0;
    for (; j < T.length; j++) {
      const u = T[j];
      if (u.t !== 'op') continue;
      if (u.v === '(' || u.v === '[' || u.v === '{') d++;
      else if (u.v === ')' || u.v === ']' || u.v === '}') { if (d === 0) break; d--; }
      else if (u.v === ';' && d === 0) break;
    }
    const tmp = { t: 'var', sig: '@', name: '_tmp_' + hv.name, sp: true, line: hv.line };
    T[hi] = tmp;
    T.splice(j, 0, tok.op(';'), tok.id('my'), { t: 'var', sig: '%', name: hv.name, sp: true, line: hv.line }, tok.op('='), Object.assign({}, tmp));
    return true;
  }
  return false;
}

function prepare(T) {
  classify(T);
  for (let guard = 0; guard < 5000; guard++) {
    if (rewriteSubs(T) || (CUR.imports.has('try') && rewriteTryTiny(T)) || rewriteCopyAssign(T) || rewriteListIndex(T) || rewriteSubstr(T) || rewriteJsDots(T) || rewriteAggAssign(T) || rewriteForAlias(T) || rewriteDelete(T) || rewriteCountOf(T) || rewriteSlices(T) || rewriteLastIdx(T) || rewriteEach(T) || rewriteFnBlocks(T) || rewriteMods(T) || rewriteElemOps(T) || rewriteISA(T) || rewriteHashList(T)) { classify(T); continue; }
    if (rewriteReturns(T)) { classify(T); continue; }
    break;
  }
  return T;
}

/* ------------------------------------------------------------- translator */

const BUILTINS = new Set(['print', 'say', 'printf', 'sprintf', 'push', 'pop', 'shift', 'unshift', 'splice', 'join',
  'split', 'map', 'grep', 'sort', 'reverse', 'keys', 'values', 'exists', 'defined', 'scalar', 'length', 'substr',
  'index', 'rindex', 'uc', 'lc', 'ucfirst', 'lcfirst', 'abs', 'int', 'sqrt', 'sin', 'cos', 'atan2', 'exp', 'log',
  'hex', 'oct', 'rand', 'srand', 'time', 'localtime', 'die', 'warn', 'ref', 'chr', 'ord', 'num', 'exit', 'eval', 'bless', 'gmtime', 'binmode', 'sleep', 'select', 'quotemeta']);
const UNARY = new Set(['length', 'defined', 'ref', 'scalar', 'uc', 'lc', 'ucfirst', 'lcfirst', 'int', 'abs', 'sqrt',
  'exists', 'shift', 'pop', 'chr', 'ord', 'hex', 'oct', 'keys', 'values', 'rand', 'log', 'exp', 'sin', 'cos', 'num', 'localtime', 'gmtime', 'exit', 'quotemeta']);
const LISTFN = new Set(['map', 'grep', 'sort', 'split', 'keys', 'values', 'reverse', 'splice', 'localtime', 'gmtime']);
const DEFARG = new Set(['ord', 'chr', 'lc', 'uc', 'lcfirst', 'ucfirst', 'length', 'abs', 'int', 'sqrt', 'sin', 'cos', 'exp', 'log', 'hex', 'oct', 'defined', 'ref']);   // `$_` when called without an argument
const NOARG = new Set(['shift', 'pop', 'time', 'rand', 'localtime', 'gmtime', 'srand']);
const NOSPREAD = new Set(['map', 'grep', 'sort', 'scalar', 'keys', 'values', 'reverse', '_list', 'defined', 'exists', 'ref']);
const FIRSTARR = new Set(['push', 'unshift', 'splice', 'pop', 'shift']);
const PEND = new Set(['call', 'unary', 'rng', 'exprfn', 'retlist']);
const UNARY_ONLY = new Set(['unary']);
const UNARY_RNG = new Set(['unary', 'rng']);
const WORDOPS = new Set(['and', 'or', 'not', 'xor', 'eq', 'ne', 'lt', 'gt', 'le', 'ge', 'cmp', 'x', 'if', 'unless',
  'while', 'until', 'for', 'foreach']);
const CMPOPS = new Set(['==', '!=', '<', '>', '<=', '>=', '<=>']);
const UFLUSH = new Set(['==', '!=', '<', '>', '<=', '>=', '&&', '||', '//', '?', ':', '=', '+=', '-=', '*=', '/=',
  '.=', '||=', '&&=', '//=', '<=>', '=~', '!~', '<<', '>>', '&', '|', '^']);
const WFLUSH = new Set(['eq', 'ne', 'lt', 'gt', 'le', 'ge', 'and', 'or', 'cmp', 'xor']);

const safeName = (s) => s.replace(/::/g, '_');
const perr = (msg, line) => { const e = new Error(msg); e.line = line; return e; };

// An error with a Perl-side line number and a copy of the source, for display
class PerlError extends Error {
  constructor(kind, message, line, src, hint) {
    super(message);
    this.name = 'Perl2JSError';
    this.kind = kind; this.line = line; this.src = src; this.hint = hint;
  }
}
const demangle = (m) => String(m).replace(/\b_a\$(\w+)/g, '@$1').replace(/\b_h\$(\w+)/g, '%$1').replace(/\$_args\b/g, '@_')
  .replace(/\b(\w+)_(?=\()/g, (all, n) => BUILTINS.has(n) ? n : all).replace(/^Perl2JS:\s*/, '');
function hintFor(msg) {
  let m;
  if ((m = /Cannot read propert(?:y|ies) of (null|undefined) \(reading '([^']*)'\)/.exec(msg)))
    return /^(_\$|_p)$/.test(m[2])
      ? '$obj->method の $obj が undef です。new の戻り値や、見つからなかったセレクタ(\\$("#id") が空)などを確認してください。'
      : 'undef の値に対して ->{' + m[2] + '} / ->' + m[2] + ' を使いました。左側の変数に値が入っているか確認してください(存在しない要素、見つからなかったセレクタなど)。';
  if ((m = /^(\S+) is not defined$/.exec(msg))) return m[1] + ' が定義されていません。my で宣言したか、スペルや require(読み込み順)を確認してください。';
  if ((m = /^(.+) is not a function$/.exec(msg))) return m[1] + ' は関数ではありません。名前の綴りや、$obj->name の左側が正しいオブジェクトか確認してください。';
  if (/Unexpected (token|identifier|end of input)|Invalid or unexpected token/.test(msg)) return '生成されたJSが不正です。直前の行の括弧・セミコロン・クォートの対応を確認してください。';
  if (/Cannot access '.+' before initialization|has already been declared/.test(msg)) return 'my 変数の宣言順序か、同じスコープでの二重宣言(my $x を2回)が原因です。';
  if (/Maximum call stack/.test(msg)) return '再帰が深すぎます(終了条件を確認してください)。';
  if (/Can't locate object method/.test(msg)) return 'そのメソッドは定義されていません。package 名・継承(use parent)・綴りを確認してください。';
  return '';
}
function toPerlError(kind, e, src, js) {
  if (e instanceof PerlError) return e;
  const raw = e instanceof Error ? e.message : String(e);
  let line = e && e.line, m;
  if (!line && (m = /\bat line (\d+)/.exec(raw))) line = +m[1];
  if (!line && kind === 'runtime' && js && e && e.stack) {
    // map "<anonymous>:LINE:COL" in the generated code back to the Perl line via /*@N*/ markers
    const mm = /(?:<anonymous>|Function):(\d+):\d+/.exec(e.stack);
    if (mm) {
      const lines = js.split('\n');
      for (let k = Math.min(+mm[1] - 3, lines.length - 1); k >= 0; k--) {
        const mk = /^\/\*@(\d+)\*\//.exec(lines[k]);
        if (mk) { line = +mk[1]; break; }
      }
    }
  }
  let msg = demangle(raw).replace(/\s+at line \d+\.?\s*$/, '');
  if (/Cannot read propert(?:y|ies) of (null|undefined) \(reading '(_\$|_p)'\)/.test(raw)) msg = "Can't call method on an undefined value";
  return new PerlError(kind, msg.replace(/\n+$/, ''), line, src, hintFor(raw));
}
function vname(t) {
  const nm = t.name;
  if (t.sig === '$') {
    if (t.elem === '[') return nm === '_' ? '$_args' : '_a$' + safeName(nm);
    if (t.elem === '{') return '_h$' + safeName(nm);
    if (nm === 'this') return 'this';
    if (nm === '+') return 'NAMED_';          // $+{name}: named captures (hash %+)
    if (nm === '|') return '$AUTOFLUSH';
    if (nm === ',') return '$OFS';
    if (nm === '\\') return '$ORS';
    if (nm === '/') return '$RS';
    if (nm === '@') return '$ERR';
    if (nm === '!') return '$ERRNO';
    if (nm === '&') return '$MATCH';
    return '$' + safeName(nm);
  }
  if (t.sig === '@') return nm === '_' ? '$_args' : '_a$' + safeName(nm);
  if (t.sig === '%') return '_h$' + safeName(nm);
  return '$' + safeName(nm);
}

function compileExpr(src) {
  const js = translate(prepare(lex(src)));
  return js.replace(/[\s;]+$/, '');
}

function reLiteral(pat, flags, xflag) {
  let p = pat;
  if (/x/.test(flags)) p = p.replace(/\\#/g, '\u0001').replace(/#.*$/gm, '').replace(/\s+/g, '').replace(/\u0001/g, '\\#');
  p = p.replace(/\\z/g, '$').replace(/\\Z/g, '$').replace(/\\A/g, '^');
  const fl = flags.replace(/[^gimsuy]/g, '');
  const varRe = /(?<!\\)\$([A-Za-z_]\w*)|(?<!\\)\$\{(\w+)\}/g;
  if (!varRe.test(p)) {
    return '/' + (p === '' ? '(?:)' : p.replace(/(^|[^\\])\//g, '$1\\/').replace(/(^|[^\\])\//g, '$1\\/')) + '/' + fl;
  }
  const parts = []; let last = 0, m;
  varRe.lastIndex = 0;
  while ((m = varRe.exec(p))) {
    if (m.index > last) parts.push(JSON.stringify(p.slice(last, m.index)));
    parts.push('_rx($' + (m[1] || m[2]) + ')');
    last = m.index + m[0].length;
  }
  if (last < p.length) parts.push(JSON.stringify(p.slice(last)));
  return 'new RegExp(' + parts.join(' + ') + ', ' + JSON.stringify(fl) + ')';
}

function interp(raw) {
  let s = '`', i = 0, open = 0, one = '';           // open: \U / \L spans not closed yet;  one: pending \u / \l
  const n = raw.length;
  const piece = (js) => (one ? '${_c' + one + '(' + js + ')}' : '${' + js + '}');
  while (i < n) {
    const c = raw[i];
    if (c === '\\') {
      const d = raw[i + 1];
      if (d === undefined) { s += '\\\\'; i++; continue; }
      let em;
      if (d === 'U' || d === 'L') { s += '${_c' + d + '(`'; open++; i += 2; continue; }                 // \U ... \E
      if (d === 'E') { if (open > 0) { s += '`)}'; open--; } i += 2; continue; }
      if (d === 'u' || d === 'l') { one = d; i += 2; continue; }                                     // \u$name
      if ('ntr\\"fb'.includes(d)) s += d === '"' ? '"' : '\\' + d;
      else if (d === 'e') s += '\\x1b';
      else if (d === 'a') s += '\\x07';
      else if (d === 'x') {                                           // \x{263A}  \xE9
        if ((em = /^\\x\{([0-9a-fA-F]+)\}/.exec(raw.slice(i)))) { s += '\\u{' + em[1] + '}'; i += em[0].length; continue; }
        if ((em = /^\\x([0-9a-fA-F]{1,2})/.exec(raw.slice(i)))) { s += '\\x' + em[1].padStart(2, '0'); i += em[0].length; continue; }
        s += '\\x00'; i += 2; continue;
      }
      else if (/[0-7]/.test(d)) { em = /^\\([0-7]{1,3})/.exec(raw.slice(i)); s += '\\u{' + parseInt(em[1], 8).toString(16) + '}'; i += em[0].length; continue; }   // \033  \0
      else if (d === 'c' && raw[i + 2]) { s += '\\x' + (raw[i + 2].toUpperCase().charCodeAt(0) ^ 64).toString(16).padStart(2, '0'); i += 3; continue; }   // \cA
      else if (d === 'N' && (em = /^\\N\{U\+([0-9a-fA-F]+)\}/.exec(raw.slice(i)))) { s += '\\u{' + em[1] + '}'; i += em[0].length; continue; }
      else if (d === '$') s += '\\$';
      else if (d === '`') s += '\\`';
      else s += d;
      i += 2; continue;
    }
    if (c === '`') { s += '\\`'; i++; continue; }
    if (c === '$' || c === '@') {
      const sub = raw.slice(i);
      let m;
      if (c === '@' && (m = /^@\{/.exec(sub))) {
        let end = matchBraceStr(sub, 1);
        if (sub[end + 1] === '[' || sub[end + 1] === '{') end = matchBraceStr(sub, end + 1);       // "@{$r}[0,1]"  "@{$h}{qw(a b)}"
        const code = sub.slice(0, end + 1);
        s += '${(' + compileExpr(code) + ').join(" ")}';
        i += end + 1; continue;
      }
      if (c === '$' && sub.startsWith('$#{')) { const end = matchBraceStr(sub, 2); s += '${_s(' + compileExpr(sub.slice(0, end + 1)) + ')}'; i += end + 1; continue; }
      if (c === '$' && (m = /^\$#\$([A-Za-z_]\w*)/.exec(sub))) { s += '${($' + m[1] + '.length-1)}'; i += m[0].length; continue; }
      if (c === '$' && (m = /^\$#([A-Za-z_]\w*)/.exec(sub))) { s += '${(_a$' + m[1] + '.length-1)}'; i += m[0].length; continue; }
      let pre = null;
      if (c === '$' && sub.startsWith('${$')) { const e = matchBraceStr(sub, 1); pre = sub.slice(0, e + 1); m = [pre]; }       // "${$ref}[1]"
      else if (c === '@' && (m = /^@\$([A-Za-z_]\w*)/.exec(sub))) pre = m[0];                                                  // "@$ref"
      if (pre || (m = c === '$' ? /^\$(?:\{(\w+)\}|([A-Za-z_]\w*(?:::\w+)*)|(\d+)|(@)|(\+)(?=\{)|(&)|(\$+[A-Za-z_]\w*))/.exec(sub) : /^@([A-Za-z_]\w*)/.exec(sub))) {
        let expr = pre || c + (m[1] || m[2] || m[3] || (m[4] ? '@' : '') || (m[5] ? '+' : '') || (m[6] ? '&' : '') || (m[7] || ''));
        let j = m[0].length;
        if (c === '$') {
          for (;;) {
            const ch = sub[j];
            if (ch === '[' && /^\[(-?\d+|\$#?\w+|[^\]]*\$#?\w+[^\]]*)\]/.test(sub.slice(j))) {
              const e = matchBraceStr(sub, j); expr += sub.slice(j, e + 1); j = e + 1;
            } else if (ch === '{') {
              const e = matchBraceStr(sub, j); expr += sub.slice(j, e + 1); j = e + 1;
            } else if (ch === '-' && sub[j + 1] === '>' && (sub[j + 2] === '[' || sub[j + 2] === '{')) {
              const e = matchBraceStr(sub, j + 2); expr += sub.slice(j, e + 1); j = e + 1;
            } else break;
          }
          s += piece('_s(' + compileExpr(expr) + ')'); one = '';
        } else {
          if (sub[j] === '[' || sub[j] === '{') { const e = matchBraceStr(sub, j); expr += sub.slice(j, e + 1); j = e + 1; }   // "@a[0,1]"  "@h{qw(a b)}"
          s += '${' + compileExpr(expr) + '.join(" ")}';
        }
        i += j; continue;
      }
      s += c === '$' ? '\\$' : '@'; i++; continue;
    }
    if (one) { s += one === 'u' ? c.toUpperCase() : c.toLowerCase(); one = ''; i++; continue; }          // \u followed by a plain character
    s += c; i++;
  }
  for (; open > 0; open--) s += '`)}';
  return s + '`';
}
function matchBraceStr(str, at) {
  let d = 0;
  for (let j = at; j < str.length; j++) {
    const ch = str[j];
    if (ch === '{' || ch === '[' || ch === '(') d++;
    else if (ch === '}' || ch === ']' || ch === ')') { if (--d === 0) return j; }
  }
  return str.length - 1;
}

const STRICT_OK = new Set(['_', '@', '!', '&', '|', ',', '\\', '/', '+', '0', 'a', 'b', 'this', 'ARGV', 'ENV', 'ISA', 'VERSION', 'EXPORT', 'EXPORT_OK', 'INC', 'STDIN', 'STDOUT', 'STDERR']);

function translate(T, opts) {
  const marks = !!(opts && opts.marks);
  let lastMarked = 0;
  // `use strict;` => variables must be declared with my/our (checked at compile time)
  let strict = false;
  for (let k = 0; k < T.length - 1; k++) {
    if (T[k].t === 'id' && T[k + 1].t === 'id' && T[k + 1].v === 'strict') {
      if (T[k].v === 'use') strict = true; else if (T[k].v === 'no') { strict = false; break; }
    }
  }
  const scopes = [new Set()];
  let pendDecl = [];
  const keyOf = (v) => v.sig === '$#' && v.ref ? '$' + v.name : (v.sig === '$' ? (v.elem === '[' ? '@' : v.elem === '{' ? '%' : '$') : v.sig === '$#' ? '@' : v.sig) + v.name;
  const declare = (k) => scopes[scopes.length - 1].add(k);
  const checkVar = (v, k) => {
    if (!strict || STRICT_OK.has(v.name) || /^\d+$/.test(v.name) || v.name.includes('::') || v.ref) return;
    if (scopes.some((sc) => sc.has(k))) return;
    throw perr('Global symbol "' + k + '" requires explicit package name (did you forget to declare "my ' + k + '"?)', v.line);
  };
  const out = [];
  const st = [];
  let i = 0, listRhs = false, subBody = false, pendOne = false, lastListClose = -2, forList = false, negNext = false, condNext = false;
  const emit = (s) => out.push(s);
  const top = () => st[st.length - 1];
  const flush = (kinds) => { while (st.length && kinds.has(top().k)) emit(st.pop().close); };

  const isOp = (t, v) => t && t.t === 'op' && t.v === v;
  const chainNext = (u) => !!u && u.t === 'op' && (u.v === '->' || (!u.sp && (u.v === '[' || (u.v === '{' && u.kind === 'sub'))));
  const isId = (t, v) => t && t.t === 'id' && t.v === v;
  // packages / subs declared in the file (for unqualified calls inside a package)
  const knownPkgs = new Set(), knownSubs = {};
  let curPkg = 'main';
  {
    let cur = 'main'; const stk = [];
    for (let k = 0; k < T.length; k++) {
      while (stk.length && stk[stk.length - 1].end === k) cur = stk.pop().prev;
      const u = T[k];
      if (u.t === 'id' && u.v === 'package' && T[k + 1] && T[k + 1].t === 'id') {
        knownPkgs.add(T[k + 1].v);
        if (isOp(T[k + 2], '{')) stk.push({ end: matching(T, k + 2), prev: cur });
        cur = T[k + 1].v;
      } else if (u.t === 'id' && u.v === 'sub' && T[k + 1] && T[k + 1].t === 'id') (knownSubs[cur] = knownSubs[cur] || new Set()).add(T[k + 1].v);
    }
  }

  function startsTerm(t) {
    if (!t) return false;
    if (['num', 'str', 'var', 'qw', 're', 'deref', 'subst'].includes(t.t)) return true;
    if (t.t === 'id') return !WORDOPS.has(t.v);
    return t.t === 'op' && (t.v === '[' || t.v === '\\' || t.v === '!' || t.v === '(' || (t.v === '{' && t.kind === 'obj'));
  }
  // does this bracket contain a range or a list-returning builtin (needs flattening)?
  function hasRange(openIdx) {
    const e = matching(T, openIdx);
    for (let j = openIdx; j < e; j++) {
      const u = T[j];
      if (u.t === 'op' && (u.v === '..' || u.v === '...')) return true;
      if (u.t === 'id' && (LISTFN.has(u.v) || CUR.listfns.has(u.v)) && !isOp(T[j - 1], '->')) return true;
    }
    return false;
  }
  // does the block opened at T[openIdx] directly contain a `local` (not inside a nested block)?
  function blockHasLocal(openIdx) {
    const e = matching(T, openIdx);
    let d = 0;
    for (let j = openIdx; j < e; j++) {
      const u = T[j];
      if (u.t === 'op' && u.v === '{') d++;
      else if (u.t === 'op' && u.v === '}') d--;
      else if (d === 1 && u.t === 'id' && u.v === 'local' && !isOp(T[j - 1], '->')) return true;
    }
    return false;
  }
  function hasComma(openIdx) {
    const e = matching(T, openIdx);
    let d = 0;
    for (let j = openIdx; j < e; j++) {
      const u = T[j];
      if (u.t !== 'op') continue;
      if (u.v === '(' || u.v === '[' || u.v === '{') d++;
      else if (u.v === ')' || u.v === ']' || u.v === '}') d--;
      else if ((u.v === ',' || u.v === '=>') && d === 1) return true;
    }
    return false;
  }
  function spreadOK() {
    const e = top();
    if (!e) return false;
    if (e.k === 'call') return !NOSPREAD.has(e.callee);
    if (e.k === 'paren') return !!e.call && !NOSPREAD.has(e.callee);
    return ['brk', 'listlit', 'mylist', 'hashlit', 'obj'].includes(e.k);
  }
  function atArgStart(prev) {
    if (!prev) return false;
    const e = top();
    if (prev.t === 'op' && (prev.v === ',' || prev.v === '(' || prev.v === '[' || (prev.v === '{' && e && e.k === 'obj'))) {
      if (e && FIRSTARR.has(e.callee) && e.argc === 0) return false;
      return true;
    }
    if (e && e.k === 'call' && prev.t === 'id') return !(FIRSTARR.has(e.callee) && e.argc === 0);
    return false;
  }
  function lhsTok(eqIdx) { // token before '=' skipping my/our
    let k = eqIdx - 1;
    return T[k];
  }
  function lastTerm() {                      // the JS text of the term just emitted:  $x   _a$a[$i]   $r["k"][0]
    const tail = out.slice(-12).join('');
    const m = /[\w$]+(?:\[[^\[\]]*\]|\.\w+)*$/.exec(tail);
    return m ? m[0] : out[out.length - 1];
  }
  function countCtx(prev, nxt) {
    if (prev && prev.t === 'op' && prev.v === '\\') return false;            // \@a is a reference, not a count
    if (prev && ((prev.t === 'op' && (prev.v === '!' || prev.v === '.' || CMPOPS.has(prev.v) || '+-*/'.includes(prev.v) && prev.v.length === 1)) ||
        (prev.t === 'id' && ['not', 'eq', 'ne', 'lt', 'gt', 'le', 'ge'].includes(prev.v)))) return true;
    if (nxt && nxt.t === 'op' && (CMPOPS.has(nxt.v) || ['?', '&&', '||', '+', '-', '*', '/', '.'].includes(nxt.v))) return true;
    if (nxt && nxt.t === 'id' && ['and', 'or', 'eq', 'ne', 'lt', 'gt', 'le', 'ge'].includes(nxt.v)) return true;
    if (prev && isOp(prev, '(') && isOp(nxt, ')') && top() && top().cond) return true;
    if (prev && isOp(prev, '=') && (!nxt || isOp(nxt, ';') || isOp(nxt, ')'))) {
      const l = lhsTok(i - 1);
      if (l && l.t === 'var' && l.sig === '$' && !l.elem) return true;
    }
    return false;
  }
  function copyCtx(prev, nxt, sig) {
    if (prev && isOp(prev, '=') && (!nxt || isOp(nxt, ';') || isOp(nxt, ')') || isOp(nxt, ','))) {
      const l = lhsTok(i - 1);
      return !!(l && l.t === 'var' && l.sig === sig);
    }
    return false;
  }
  function listReturn(at) { // `return a, b` or `return (a, b)`
    const f = T[at];
    if (!f || isOp(f, ';') || isOp(f, '}')) return null;
    if (f.t === 'id' && BUILTINS.has(f.v) && !isOp(T[at + 1], '(')) return null;   // `return bless $x, $c` : the comma belongs to the list operator
    if (isOp(f, '(')) {
      const e = matching(T, at);
      const after = T[e + 1];
      if (!after || isOp(after, ';') || isOp(after, '}') || (after.t === 'id' && ['if', 'unless'].includes(after.v)) ) {
        let d = 0;
        for (let j = at; j < e; j++) {
          const u = T[j];
          if (u.t !== 'op') continue;
          if (u.v === '(' || u.v === '[' || u.v === '{') d++;
          else if (u.v === ')' || u.v === ']' || u.v === '}') d--;
          else if (u.v === ',' && d === 1) return 'paren';
        }
        return null;
      }
    }
    let d = 0;
    for (let j = at; j < T.length; j++) {
      const u = T[j];
      if (u.t !== 'op') continue;
      if (u.v === '(' || u.v === '[' || u.v === '{') d++;
      else if (u.v === ')' || u.v === ']' || u.v === '}') { if (d === 0) break; d--; }
      else if (u.v === ';' && d === 0) break;
      else if (u.v === ',' && d === 0) return 'wrap';
    }
    return null;
  }

  function emitArrayish(sig, nm, prev, nxt, declInit) {
    if (sig === '@') {
      if (countCtx(prev, nxt)) emit(nm + '.length');
      else if (copyCtx(prev, nxt, '@')) emit('[...' + nm + ']');
      else if (atArgStart(prev) && spreadOK()) emit('...' + nm);
      else emit(nm);
      if (declInit) emit(' = []');
    } else {
      if (copyCtx(prev, nxt, '%')) emit('_hash(..._pairs(' + nm + '))');
      else if (atArgStart(prev) && spreadOK()) emit('..._pairs(' + nm + ')');
      else emit(nm);
      if (declInit) emit(' = {}');
    }
  }

  while (i < T.length) {
    const t = T[i], prev = T[i - 1], next = T[i + 1];
    const wantClose = pendOne;
    pendOne = false;
    if (marks && t.line && t.line !== lastMarked && (!prev || (prev.t === 'op' && (prev.v === ';' || ((prev.v === '{' || prev.v === '}') && prev.kind === 'block'))))) {
      emit('\n/*@' + t.line + '*/'); lastMarked = t.line;
    }
    let isOpener = false, keepPend = false;

    switch (t.t) {
      case 'num': emit(t.v.replace(/_/g, '')); break;

      case 'str':
        if (next && isOp(next, '=>') && !t.interp) emit(JSON.stringify(t.v));
        else emit(t.interp ? interp(t.raw) : JSON.stringify(t.v));
        break;

      case 'qw':
        if (atArgStart(prev) && spreadOK()) emit('...');
        emit(JSON.stringify(t.list));
        break;

      case 're': {
        const lit = reLiteral(t.pat, t.flags);
        if (t.qr) { emit(lit); break; }                  // qr/.../ is just the RegExp object
        const rawOK = isId(prev, 'split') || (isOp(prev, '(') && isId(T[i - 2], 'split')) ||
          (top() && top().callee === 'split' && top().argc === 0);
        emit(rawOK ? lit : '$_.$m(' + lit + ')');
        break;
      }

      case 'subst':
        emit('($_ = $_.$sub(' + subArgs(t) + '))');
        break;

      case 'trans':
        emit('($_ = $_.$tr(' + trArgs(t) + '))');
        break;

      case 'var': {
        if (strict) {
          const k = keyOf(t);
          if ((prev && prev.t === 'id' && (prev.v === 'my' || prev.v === 'our' || prev.v === 'local')) || (top() && top().k === 'mylist')) declare(k);
          else if (isOp(prev, '(') && isId(T[i - 2], 'catch')) pendDecl.push(k);      // catch ($e) { ... }
          else checkVar(t, k);
        }
        if (t.sig === '$#') {
          const nm = t.ref ? '$' + t.name : '_a$' + safeName(t.name);
          if (isOp(next, '=')) { emit(nm + '.length = 1 + ('); st.push({ k: 'unary', close: ')', callee: '_n' }); i++; break; }      // $#a = 3;
          if (isOp(next, '++') || isOp(next, '--')) { emit(nm + '.length'); break; }                                                  // $#a--;
          emit('(' + nm + '.length-1)'); break;
        }
        const nm = vname(t);
        const declInit = prev && prev.t === 'id' && (prev.v === 'my' || prev.v === 'our' || prev.v === 'local') &&
          !isOp(next, '=') && !(top() && top().k === 'mylist');
        if (t.sig === '$') {
          if (prev && prev.t === 'deref') { emit(nm); break; }
          emit(nm);
          if (t.elem) keepPend = true;
        } else if (prev && prev.t === 'deref') {
          emitArrayish(t.sig, '$' + t.name, T[i - 2], next, false);
          if (t.sig === '@' && t.elem) keepPend = true;
        } else {
          emitArrayish(t.sig, nm, prev, next, declInit);
        }
        break;
      }

      case 'deref': {
        // `@$x`, `@{...}`, `%$x`, `$$x`
        if (t.sig === '$') {                                    // $$r  /  $$$r  : the scalar a reference points to
          let k = i + 1, n = 1;
          while (T[k] && T[k].t === 'deref' && T[k].sig === '$') { k++; n++; }
          if (T[k] && T[k].t === 'var' && T[k].sig === '$' && !T[k].elem) { emit(vname(T[k]) + '.v'.repeat(n)); i = k; }
          break;
        }
        if (next && next.t === 'var') break;         // handled at the var
        break;
      }

      case 'id': {
        const v = t.v;
        // hash-key position / fat comma
        if (next && isOp(next, '=>')) { emit(JSON.stringify(v)); break; }
        // method / property after ->
        if (prev && isOp(prev, '->')) { emit(v); break; }
        // LABEL:  (at the start of a statement)
        if (/^[A-Z_][A-Z0-9_]*$/.test(v) && next && isOp(next, ':') && (!prev || (prev.t === 'op' && (prev.v === ';' || ((prev.v === '{' || prev.v === '}') && prev.kind === 'block'))))) { emit(v + ': '); i++; break; }
        // Class->new(...)  ==>  new Class(...)
        if (next && isOp(next, '->') && isId(T[i + 2], 'new') && !knownPkgs.has(v) && !CUR.classes.has(v)) { emit('new ' + safeName(v)); i += 2; break; }
        // operators spelled as words
        if (valueEnd(prev) && v === 'x') { flush(UNARY_ONLY); emit(' .$x('); pendOne = true; break; }
        switch (v) {
          case 'eq': case 'ne': case 'lt': case 'gt': case 'le': case 'ge': {
            flush(UNARY_ONLY);
            if (prev && prev.t === 'var' && prev.sig === '$' && !prev.elem && out[out.length - 1] === vname(prev)) out[out.length - 1] = '_s(' + out[out.length - 1] + ')';
            else if (prev && prev.t === 'num' && out[out.length - 1] === prev.v.replace(/_/g, '')) out[out.length - 1] = '_s(' + out[out.length - 1] + ')';
            emit(' ' + { eq: '==', ne: '!=', lt: '<', gt: '>', le: '<=', ge: '>=' }[v] + ' _s(');
            st.push({ k: 'unary', close: ')', callee: '_s' });
            break;
          }
          case 'cmp': flush(UNARY_ONLY); emit(' .$scmp('); pendOne = true; break;
          case 'and': flush(PEND); emit(' && '); break;
          case 'or': flush(PEND); emit(' || '); break;
          case 'xor': flush(PEND); emit(' !== '); break;
          case 'not': emit('!'); break;
          case 'my': case 'our': emit(v === 'my' && !t.hoisted ? 'let ' : ''); break;
          case 'local': {
            // local LVALUE [= expr];  -> save the old value now, restore it when the enclosing block exits
            let j = i + 1;
            if (T[j] && T[j].t === 'deref') j++;
            if (!(T[j] && T[j].t === 'var')) { emit(''); break; }
            while (T[j + 1] && ((isOp(T[j + 1], '->')) || ((isOp(T[j + 1], '[') || (isOp(T[j + 1], '{') && T[j + 1].kind === 'sub')) && !T[j + 1].sp))) {
              j++;
              if (isOp(T[j], '->')) { if (T[j + 1] && (isOp(T[j + 1], '[') || isOp(T[j + 1], '{'))) j++; else break; }
              if (isOp(T[j], '[') || isOp(T[j], '{')) j = matching(T, j);
            }
            const slice = T.slice(i + 1, j + 1).map((u) => Object.assign({}, u));
            classify(slice);
            const lv = translate(slice).trim();
            const getter = /^[\w$]+$/.test(lv) ? 'typeof ' + lv + " === 'undefined' ? undefined : " + lv : lv;
            emit('_local($$L, () => ' + getter + ', (v) => { ' + lv + ' = v; }), ' + lv);
            const sig = T[i + 1].t === 'var' ? T[i + 1].sig : '$';
            if (!isOp(T[j + 1], '=')) emit(' = ' + (sig === '@' ? '[]' : sig === '%' ? '{}' : 'undefined'));
            i = j;
            break;
          }
          case 'package': {
            const nm = next && next.t === 'id' ? next.v : 'main';
            i++;
            if (isOp(T[i + 1], '{')) T[i + 1].pkgRestore = curPkg;
            curPkg = nm;
            break;
          }
          case 'use': case 'no': case 'require': {
            if (v === 'use' && next && next.t === 'id' && (next.v === 'parent' || next.v === 'base')) {
              const names = [];
              let j = i + 2;
              for (; j < T.length && !isOp(T[j], ';'); j++) {
                const u = T[j];
                if (u.t === 'str') names.push(u.interp ? u.raw : u.v); else if (u.t === 'qw') names.push(...u.list);
              }
              emit('_isa(' + JSON.stringify(curPkg) + ', ' + JSON.stringify(names) + ');');
              i = j;
              break;
            }
            if (v === 'use' && isId(next, 'constant')) {      // use constant PI => 3.14;  /  use constant { A => 1, B => 2 };
              const semi = (() => { let d = 0, j = i; for (; j < T.length; j++) { const u = T[j]; if (u.t !== 'op') continue; if ('([{'.includes(u.v) && u.v.length === 1) d++; else if (')]}'.includes(u.v) && u.v.length === 1) d--; else if (u.v === ';' && d === 0) break; } return j; })();
              const js = (sl) => {
                if (!sl.length) return 'undefined';
                let d = 0, comma = false;
                for (const u of sl) { if (u.t !== 'op') continue; if ('([{'.includes(u.v) && u.v.length === 1) d++; else if (')]}'.includes(u.v) && u.v.length === 1) d--; else if (u.v === ',' && d === 0) comma = true; }
                const c = sl.map((u) => Object.assign({}, u)); classify(c);
                const r = translate(c).trim();
                return comma ? '[' + r + ']' : r;
              };
              const split = (sl) => { const parts = []; let d = 0, cur = []; for (const u of sl) { if (u.t === 'op' && '([{'.includes(u.v) && u.v.length === 1) d++; else if (u.t === 'op' && ')]}'.includes(u.v) && u.v.length === 1) d--; if (u.t === 'op' && u.v === ',' && d === 0) { parts.push(cur); cur = []; } else cur.push(u); } if (cur.length) parts.push(cur); return parts; };
              const nameOf = (u) => (u.t === 'id' ? u.v : u.t === 'str' ? (u.interp ? u.raw : u.v) : String(u.v));
              if (isOp(T[i + 2], '{')) {
                const e = matching(T, i + 2);
                const entries = []; let cur = [], d = 0;
                for (let j = i + 3; j < e; j++) { const u = T[j]; if (u.t === 'op' && '([{'.includes(u.v) && u.v.length === 1) d++; else if (u.t === 'op' && ')]}'.includes(u.v) && u.v.length === 1) d--; if (u.t === 'op' && u.v === ',' && d === 0) { entries.push(cur); cur = []; } else cur.push(u); }
                if (cur.length) entries.push(cur);
                for (const en of entries) { if (en.length > 2 && isOp(en[1], '=>')) emit('var ' + safeName(nameOf(en[0])) + ' = ' + js(en.slice(2)) + ';'); }
              } else if (T[i + 2]) {
                const nm = nameOf(T[i + 2]);
                const rest = T.slice(i + 3, semi); if (rest.length && (isOp(rest[0], '=>') || isOp(rest[0], ','))) rest.shift();
                emit('var ' + safeName(nm) + ' = ' + js(rest) + ';');
              }
              i = semi;
              break;
            }
            while (i < T.length && !isOp(T[i], ';')) i++;
            break;
          }
          case '__PACKAGE__': emit(curPkg === 'main' ? '"main"' : safeName(curPkg) + ' '); break;
          case 'sub': {
            if (next && next.t === 'id' && curPkg !== 'main') {
              emit('_def(' + JSON.stringify(curPkg) + ', ' + JSON.stringify(next.v) + ', function(...$_args)');
              if (isOp(T[i + 2], '{')) T[i + 2].after = ');';
              i++;
            }
            else if (next && next.t === 'id') { emit('function ' + safeName(next.v) + '(...$_args)'); i++; }
            else emit('function(...$_args)');
            subBody = true;
            break;
          }
          case 'if': case 'while': case 'unless': case 'until': {
            // `while (my $line = shift @lines) { ... }` : `let` cannot sit inside a JS condition, so the declaration is lifted in front of the statement
            const names = [];
            if (isOp(next, '(')) {
              const close = matching(T, i + 1);
              for (let k = i + 2; k < close; k++) {
                if (T[k].t === 'id' && T[k].v === 'my' && T[k + 1] && T[k + 1].t === 'var' && T[k + 1].sig === '$' && !T[k + 1].elem) { T[k].hoisted = true; names.push(vname(T[k + 1])); }
              }
              if (names.length) {
                if (v === 'while' || v === 'until') { emit('{ let ' + names.join(', ') + '; '); if (T[close + 1] && isOp(T[close + 1], '{')) T[close + 1].after = (T[close + 1].after || '') + '}'; }
                else emit('var ' + names.join(', ') + '; ');
              }
            }
            emit(v === 'unless' ? 'if ' : v === 'until' ? 'while ' : v + ' ');
            condNext = true; if (v === 'unless' || v === 'until') negNext = true;
            break;
          }
          case 'elsif': emit('else if '); condNext = true; break;
          case 'else': emit('else '); break;
          case 'try': case 'finally': if (isOp(next, '{')) { emit(v + ' '); break; } emit(safeName(v) + ' '); break;
          case 'catch': emit('catch '); break;
          case 'chomp': case 'chop': {
            // chomp($x);  chomp(my $x = EXPR);  chomp $x;  chomp;   =>   $x = chomp_($x)
            let a, b;
            if (isOp(next, '(')) { a = i + 2; b = matching(T, i + 1); } else { a = i + 1; b = a; while (b < T.length && !isOp(T[b], ';') && !isOp(T[b], '}')) b++; b = b; }
            let C = T.slice(a, isOp(next, '(') ? b : b);
            const sub = (sl) => { const c = sl.map((u) => Object.assign({}, u)); classify(c); return translate(c).trim(); };
            const fn = v + '_';
            if (!C.length) emit('$_ = ' + fn + '($_)');
            else if (C[0].t === 'id' && (C[0].v === 'my' || C[0].v === 'our' || C[0].v === 'local') && C[1] && C[1].t === 'var' && isOp(C[2], '=')) {
              const lv = vname(C[1]);
              emit((C[0].v === 'my' ? 'let ' : '') + lv + ' = ' + sub(C.slice(3)) + '; ' + lv + ' = ' + fn + '(' + lv + ')');
            } else { const lv = sub(C); emit(lv + ' = ' + fn + '(' + lv + ')'); }
            i = isOp(next, '(') ? b : b - 1;
            break;
          }
          case 'last': case 'next': {
            const kw = v === 'last' ? 'break' : 'continue';
            if (next && next.t === 'id' && /^[A-Z_][A-Z0-9_]*$/.test(next.v)) { emit(kw + ' ' + next.v); i++; } else emit(kw);       // last OUTER;
            break;
          }
          case 'undef':
            if (next && next.t === 'var' && !next.elem && !(T[i + 2] && T[i + 2].t === 'op' && (T[i + 2].v === '->' || T[i + 2].v === '['))) {
              const nmv = next.sig === '%' ? '_h$' + safeName(next.name) : vname(next);                                       // undef $x;  undef @a;  undef %h;
              emit(next.sig === '$' ? '(' + nmv + ' = undefined)' : next.sig === '@' ? '(' + nmv + '.length = 0, undefined)' : '(Object.keys(' + nmv + ').forEach((k) => delete ' + nmv + '[k]), undefined)'); i++;
            } else emit('undefined');
            break;
          case 'return': {
            const lr = listReturn(i + 1);
            if (lr === 'wrap') { emit('return ['); st.push({ k: 'retlist', close: ']' }); }
            else if (lr === 'paren') { emit('return '); forList = 'ret'; }
            else emit('return ');
            break;
          }
          case 'do': case 'eval': {
            if (t.dw && isOp(next, '{')) { emit('do '); break; }          // do { ... } while (...)
            if (isOp(next, '{')) { emit(v === 'do' ? '(() => ' : 'eval_(() => '); T[i + 1].after = v === 'do' ? ')()' : ')'; }
            else emit(v + ' ');
            break;
          }
          case 'foreach': case 'for': {
            let j = i + 1, varTok = null;
            if (isId(T[j], 'my') || isId(T[j], 'our')) j++;
            if (T[j] && T[j].t === 'var' && T[j].sig === '$') { varTok = T[j]; j++; }
            let cstyle = false;
            if (!varTok && isOp(T[j], '(')) {
              const e = matching(T, j);
              let d = 0;
              for (let k = j; k < e; k++) {
                const u = T[k];
                if (u.t !== 'op') continue;
                if (u.v === '(' || u.v === '[' || u.v === '{') d++;
                else if (u.v === ')' || u.v === ']' || u.v === '}') d--;
                else if (u.v === ';' && d === 1) { cstyle = true; break; }
              }
            }
            if (varTok && strict) pendDecl.push(keyOf(varTok));
            if (cstyle) { emit('for '); }
            else { emit('for (let ' + (varTok ? vname(varTok) : '$_') + ' of '); i = j - 1; forList = true; }
            break;
          }
          default: {
            if (CUR.imports.has(v)) {
              const imp = CUR.imports.get(v);
              if (imp.kind === 'const') emit(jsName(v) + ' '); else builtinCall(v, imp);
              break;
            }
            if (BUILTINS.has(v)) { builtinCall(v); break; }
            if (v.includes('::')) {
              const k = v.lastIndexOf('::'), pk = v.slice(0, k);
              if (knownPkgs.has(pk) && isOp(next, '(')) { emit('_pkg(' + JSON.stringify(pk) + ').$f.' + v.slice(k + 2)); break; }
            } else if (curPkg !== 'main' && knownSubs[curPkg] && knownSubs[curPkg].has(v) && isOp(next, '(')) {
              emit('_pkg(' + JSON.stringify(curPkg) + ').$f.' + v); break;
            }
            emit(safeName(v) + ' ');
          }
        }
        break;
      }

      case 'op': {
        const v = t.v;
        switch (v) {
          case ';': flush(PEND); emit(';'); listRhs = false; break;
          case ',': {
            flush(UNARY_RNG);
            const e = top();
            if (e && e.k === 'exprfn') {
              st.pop(); emit(e.close + ', ');
              st.push({ k: 'call', close: e.inParen ? '' : ')', callee: e.callee, argc: 1 });
            } else {
              if (e && e.argc !== undefined) e.argc++;
              emit(', ');
            }
            break;
          }
          case '=>': emit(', '); break;
          case '(': isOpener = true; openParen(t); break;
          case '[': {
            isOpener = true;
            const sub = (prev && prev.t === 'var' && prev.elem === '[') || isOp(prev, '->') ||
              (!t.sp && prev && (isOp(prev, ']') || (isOp(prev, '}') && prev.kind === 'sub')));
            const sliceable = !t.sp && prev && (isOp(prev, ')') || (isOp(prev, ']') && prev.lit) || (prev.t === 'var' && prev.sig === '@' && !prev.elem && !(T[i - 2] && T[i - 2].t === 'deref')));
            if (sliceable && (hasComma(i) || hasRange(i))) {
              emit('._slice(_L(['); st.push({ k: 'brk', close: ']))', argc: 0 });
            }
            else if (sliceable) { emit('._at('); st.push({ k: 'sub', close: ')' }); }          // (list)[-1]
            else if (sub && isOp(next, '-') && next.t === 'op' && T[i + 2] && T[i + 2].t === 'num' && isOp(T[i + 3], ']')) {
              emit('.at(-' + T[i + 2].v + ')'); i += 3; isOpener = false;
              keepPend = chainNext(T[i + 1]);
            }
            else if (sub) { emit('['); st.push({ k: 'sub', close: ']' }); }
            else if (hasRange(i)) { emit('_L(['); st.push({ k: 'brk', close: '])' , argc: 0}); }
            else { emit('['); st.push({ k: 'brk', close: ']', argc: 0 }); }
            break;
          }
          case '{': {
            isOpener = true;
            const kind = t.kind;
            if (kind === 'sub') {
              if (next && next.t === 'id' && isOp(T[i + 2], '}')) {
                emit('[' + JSON.stringify(next.v) + ']'); i += 2;
                isOpener = false;
                if (wantClose) { if (chainNext(T[i + 1])) pendOne = true; else emit(')'); }
                i++; continue;
              }
              emit('['); st.push({ k: 'sub', close: ']' });
            } else if (kind === 'deref') {
              const d = prev; // deref token
              const sp = atArgStart(T[i - 2]) && spreadOK();
              if (d.sig === '@') { emit((sp ? '...' : '') + '('); st.push({ k: 'dref', close: ')' }); }
              else if (d.sig === '%') { emit((sp ? '..._pairs(' : '(')); st.push({ k: 'dref', close: ')' }); }
              else { emit('('); st.push({ k: 'dref', close: ')' }); }
            } else if (kind === 'obj') {
              emit('_hash('); st.push({ k: 'obj', close: ')', argc: 0 });
            } else if (kind === 'fn') {
              const f = top() && top().callee;
              const sv = (u, n) => u && u.t === 'var' && u.sig === '$' && u.name === n && !u.elem;
              if (f === 'sort' && next && T[i + 4] && isOp(T[i + 4], '}') && (isOp(T[i + 2], '<=>') || isId(T[i + 2], 'cmp'))) {
                const asc = sv(T[i + 1], 'a') && sv(T[i + 3], 'b'), desc = sv(T[i + 1], 'b') && sv(T[i + 3], 'a');
                if (asc || desc) {
                  const num = isOp(T[i + 2], '<=>');
                  emit(num ? (asc ? '_NUM_ASC, ' : '_NUM_DESC, ') : (asc ? 'null, ' : '_STR_DESC, '));
                  i += 4; isOpener = false;
                  i++; continue;
                }
              }
              scopes.push(new Set());
              const imp = CUR.imports.get(f);
              const params = f === 'map' || f === 'grep' ? '$_' : (imp && imp.params ? imp.params : '$a, $b');
              if (t.stmts) { emit('(' + params + ') => {'); st.push({ k: 'fn', close: '}, ' }); }       // several statements: a real function body
              else if (f === 'map') { emit('($_) => ['); st.push({ k: 'fn', close: '], ' }); }
              else if (f === 'grep') { emit('($_) => ('); st.push({ k: 'fn', close: '), ' }); }
              else { emit('(' + params + ') => ('); st.push({ k: 'fn', close: '), ' }); }
            } else {
              const hl = blockHasLocal(i);
              emit('{'); st.push({ k: 'blk', close: hl ? '} finally { _unlocal($$L); } }' : '}', after: t.after, pkgRestore: t.pkgRestore });
              scopes.push(new Set(pendDecl)); pendDecl = [];
              if (subBody) { subBody = false; emit('$_args = _L($_args);'); }   // flatten list-valued args (map/grep/sort/...)
              if (hl) emit('const $$L = []; try {');
            }
            break;
          }
          case ')': case ']': case '}': {
            flush(PEND);
            const e = st.pop();
            if (!e) throw perr('Perl2JS: unbalanced ' + v + ' (対応する開き括弧がありません)', t.line);
            if ((e.k === 'blk' || e.k === 'fn') && scopes.length > 1) scopes.pop();
            if (e.pkgRestore !== undefined) curPkg = e.pkgRestore;
            emit((e.close !== undefined ? e.close : v) + (e.after || ''));
            if (e.pc) { if (chainNext(next)) pendOne = true; else emit(')'); }
            if (e.k === 'mylist' && !isOp(next, '=')) emit(' = []');
            if (e.k === 'mylist' || e.listAssign) lastListClose = i;
            break;
          }
          case '->':
            keepPend = true;
            if (next && next.t === 'id') {
              if (next.v.startsWith('SUPER::')) { emit('.$super(' + JSON.stringify(curPkg) + ', ' + JSON.stringify(next.v.slice(7)) + ')'); i++; break; }
              const bare = prev && prev.t === 'id' && !BUILTINS.has(prev.v);
              if (!bare && isOp(T[i + 2], '(')) { emit('._$(' + JSON.stringify(next.v) + ')'); i++; break; }
              if (!isOp(T[i + 2], '=') && !isOp(T[i + 2], '(')) { emit('._p(' + JSON.stringify(next.v) + ')'); i++; break; }   // $obj->name / Class->name (no parens)
              emit('.');
            }
            break;
          case '.': {
            flush(UNARY_ONLY);
            // left operand: a plain variable that was just emitted gets formatted too
            if (prev && prev.t === 'var' && prev.sig === '$' && !prev.elem && out[out.length - 1] === vname(prev)) out[out.length - 1] = '_s(' + out[out.length - 1] + ')';
            if (next && next.t === 'str') { emit(' + '); break; }
            emit(' + _s('); st.push({ k: 'unary', close: ')', callee: '_s' });      // closes at the next `.` / `,` / `;` / bracket
            break;
          }
          case '.=': flush(UNARY_ONLY); emit(' += _s('); st.push({ k: 'call', close: ')', callee: '_s', argc: 0 }); break;
          case '//': flush(UNARY_ONLY); emit(' ?? '); break;
          case '//=': flush(UNARY_ONLY); emit(' ??= '); break;
          case '..': case '...': emit(' .$rng('); st.push({ k: 'rng', close: ')' }); break;
          case '<=>': flush(UNARY_ONLY); emit(' .$ncmp('); pendOne = true; break;
          case '=~': case '!~': {
            flush(UNARY_ONLY);
            const nx = next;
            const argCtx = T[i - 2] && (isOp(T[i - 2], ',') || (isOp(T[i - 2], '(') && T[i - 3] && T[i - 3].t === 'id' && !['if', 'elsif', 'while', 'unless', 'until', 'and', 'or', 'not', 'for', 'foreach'].includes(T[i - 3].v))) && next && next.t === 're' && T[i + 2] && (isOp(T[i + 2], ')') || isOp(T[i + 2], ','));   // join("|", $s =~ m/(..)/)
            const asgn = T[i - 2] && isOp(T[i - 2], '=') && T[i - 3] && ((T[i - 3].t === 'var' && T[i - 3].sig === '@') || isOp(T[i - 3], ')'));       // my @n = $s =~ /x/g;   my ($a, $b) = $s =~ /../
            listRhs = argCtx || asgn || lastListClose === i - 1 || (prev && prev.t === 'var' && prev.sig === '@');      // `my ($a, $b) = $s =~ /../` : the match is in list context
            if (nx && nx.t === 're') {
              emit((v === '=~' ? (listRhs ? '.$ml(' : '.$m(') : '.$nm(') + reLiteral(nx.pat, nx.flags) + ')'); i++;
            } else if (nx && nx.t === 'trans') {
              const a = trArgs(nx);
              if (/r/.test(nx.flags)) emit('.$tr(' + a + ')');
              else if (nx.to === '' && !/[ds]/.test(nx.flags)) emit('.$trc(' + a + ')');
              else { const lhs = lastTerm(); emit(' = ' + lhs + '.$tr(' + a + ')'); }
              i++;
            } else if (nx && nx.t === 'subst') {
              const lhs = lastTerm();
              emit(/r/.test(nx.flags) ? '.$sub(' + subArgs(nx) + ')' : ' = ' + lhs + '.$sub(' + subArgs(nx) + ')'); i++;
            } else {
              emit(v === '=~' ? '.$m(' : '.$nm('); pendOne = true;
            }
            break;
          }
          case '=': {
            flush(UNARY_ONLY);
            if (prev && prev.t === 'var' && prev.sig === '@' && next && !isOp(next, '(') && !isOp(next, '[') && next.t !== 'qw') {
              emit(' = _arr('); st.push({ k: 'call', close: ')', callee: '_list', argc: 0 });
            } else if (prev && prev.t === 'var' && prev.sig === '%' && !isOp(next, '(')) {
              emit(' = _hashFrom('); st.push({ k: 'call', close: ')', callee: '_list', argc: 0 });
            } else if (lastListClose === i - 1) {
              emit(' = _list('); st.push({ k: 'call', close: ')', callee: '_list', argc: 0 });
            } else emit(' = ');
            break;
          }
          case '!': emit('!'); break;
          case '\\':
            if (next && next.t === 'var' && next.sig === '$' && !next.elem && !(T[i + 2] && T[i + 2].t === 'op' && (T[i + 2].v === '->' || T[i + 2].v === '[' || T[i + 2].v === '{'))) {
              const nmv = vname(next); emit('_sref(() => ' + nmv + ', (_v) => ' + nmv + ' = _v)'); i++;       // \$x
            } else if (next && (next.t === 'num' || next.t === 'str')) { emit('_sconst('); pendOne = true; }   // \"text"  \42
            break;
          case '++': case '--': emit(v); break;
          case '%': {
            flush(UNARY_ONLY);
            // lhs term: number / variable / (group) / call / subscript. `a * b % c` and `-a % c` keep the plain JS operator.
            let k = i - 1; const u = T[k];
            let simple = u && (u.t === 'num' || (u.t === 'var' && u.sig === '$') || (u.t === 'op' && (u.v === ')' || u.v === ']' || (u.v === '}' && u.kind === 'sub'))));
            if (simple && u.t === 'op') { k = findOpen(T, k); while (k > 0 && ((T[k - 1].t === 'id' && !WORDOPS.has(T[k - 1].v)) || T[k - 1].t === 'var' || isOp(T[k - 1], '->'))) k--; }
            const b = T[k - 1];
            if (b && ((b.t === 'op' && ['*', '/', '%', '**', '.', '!', '\\'].includes(b.v)) || (b.t === 'id' && b.v === 'x') || (b.t === 'op' && (b.v === '-' || b.v === '+') && !valueEnd(T[k - 2]) && !(b.v === '-' && u.t === 'num')))) simple = false;
            if (simple && isOp(next, '-') && T[i + 2] && T[i + 2].t === 'num') { emit(' .$mod(-' + T[i + 2].v + ')'); i += 2; }
            else if (simple) { emit(' .$mod('); pendOne = true; } else emit(' % ');
            break;
          }
          case '-': case '+':
            if (!valueEnd(prev) && v === '-' && next && next.t === 'num' && isOp(T[i + 2], '%')) { emit('(-' + next.v + ')'); i++; break; }   // (-7) % 3
            if (valueEnd(prev)) {
              flush(UNARY_ONLY);
              if (v === '+') { emit(' - -('); st.push({ k: 'unary', close: ')', callee: '_n' }); }      // "3" + "4" is 7 in Perl, "34" in JS: a - -(b) adds as numbers
              else emit(' ' + v + ' ');
            } else emit(v);
            break;
          case '+=': flush(UNARY_ONLY); emit(' -= - ('); st.push({ k: 'call', close: ')', callee: '_n', argc: 0 }); break;
          default:
            if (UFLUSH.has(v)) flush(UNARY_ONLY);
            if (v === '<' || v === '>' || v === '<=' || v === '>=' || v === '==' || v === '!=') emit(' ' + v + ' + ');    // right side coerced to a number
            else emit(' ' + v + ' ');
        }
        break;
      }
      default:
        throw perr('Perl2JS: unexpected token ' + JSON.stringify(t), t.line);
    }

    if (wantClose) {
      if (isOpener) top().pc = true;
      else if (keepPend || chainNext(T[i + 1]) || (t.t === 'id' && isOp(T[i + 1], '('))) pendOne = true;
      else emit(')');
    }
    i++;
  }
  flush(PEND);
  if (st.length) throw perr('括弧が閉じられていません(ファイルの最後まで読みましたが、閉じ括弧が足りません)', T.length ? T[T.length - 1].line : undefined);
  const topLocal = T.some((u, k) => { if (!(u.t === 'id' && u.v === 'local' && !isOp(T[k - 1], '->'))) return false;
    let d = 0; for (let j = 0; j < k; j++) { if (isOp(T[j], '{')) d++; else if (isOp(T[j], '}')) d--; } return d === 0; });
  const hoist = Array.from(knownPkgs).filter((n) => n !== 'main').map((n) => 'var ' + safeName(n) + ' = _pkg(' + JSON.stringify(n) + ');').join('');
  if (topLocal) return hoist + 'const $$L = []; try {' + out.join('') + '\n} finally { _unlocal($$L); }';
  return hoist + out.join('');

  /* ---- helpers closed over translator state ---- */

  function trArgs(x) { return JSON.stringify(x.from) + ', ' + JSON.stringify(x.to) + ', ' + JSON.stringify(x.flags); }
  function subArgs(s) {
    const re = reLiteral(s.pat, s.flags);
    const rep = /e/.test(s.flags) ? compileExpr(s.rep) : interp(s.rep);
    return re + ', () => ' + rep;
  }

  function openParen(t) {
    const prev = T[i - 1], next = T[i + 1];
    // foreach list
    if (prev && isOp(prev, '}') && prev.kind === 'fn' && top() && top().k === 'call') {   // map {..} (list)
      emit(''); st.push({ k: 'paren', close: '', call: true, callee: top().callee, argc: 1 }); return;
    }
    if (forList) {
      const ret = forList === 'ret';
      forList = false;
      if (ret) { emit('['); st.push({ k: 'listlit', close: ']', argc: 0 }); return; }
      if (hasRange(i)) { emit('_L(['); st.push({ k: 'listlit', close: '])' + ')', argc: 0 }); }
      else if (!hasComma(i)) { emit('_list('); st.push({ k: 'paren', close: '))' }); }
      else { emit('['); st.push({ k: 'listlit', close: '])', argc: 0 }); }
      return;
    }
    if (prev && prev.t === 'id' && prev.v === 'my' ) { emit('['); st.push({ k: 'mylist', close: ']', argc: 0 }); return; }
    if (prev && prev.t === 'id' && (prev.v === 'our' || prev.v === 'local')) { emit('['); st.push({ k: 'mylist', close: ']', argc: 0 }); return; }
    if (condNext) {
      condNext = false;
      if (negNext) { negNext = false; emit('(!('); st.push({ k: 'paren', close: '))', cond: true }); }
      else { emit('('); st.push({ k: 'paren', close: ')', cond: true }); }
      return;
    }
    // sort(LIST) / map(EXPR, LIST) / grep(EXPR, LIST) with parentheses
    if (prev && prev.t === 'id' && (prev.v === 'sort' || prev.v === 'map' || prev.v === 'grep') && !isOp(T[i - 2], '->') && !isOp(next, '{') && !CUR.imports.has(prev.v)) {
      if (prev.v === 'sort') { emit('(null, '); st.push({ k: 'paren', close: ')', call: true, callee: 'sort', argc: 1 }); return; }
      emit('(($_) => ' + (prev.v === 'map' ? '[' : '('));
      st.push({ k: 'paren', close: ')', call: true, callee: prev.v, argc: 0 });
      st.push({ k: 'exprfn', close: prev.v === 'map' ? ']' : ')', callee: prev.v, inParen: true });
      return;
    }
    // callable
    if (prev && ((prev.t === 'id' && !isId(prev, 'my') && !(T[i - 2] && isOp(T[i - 2], '=>') && false)) || isOp(prev, '->'))) {
      const callee = prev.t === 'id' ? prev.v : '';
      emit('('); st.push({ k: 'paren', close: ')', call: true, callee, argc: 0 });
      return;
    }
    // list assignment: (...) = ...   and   ... = (...)
    const stmtStart = !prev || isOp(prev, ';') || (isOp(prev, '{') && prev.kind === 'block') || (isOp(prev, '}') && prev.kind === 'block');
    const e = matching(T, i);
    if (stmtStart && isOp(T[e + 1], '=')) {
      emit(';['); st.push({ k: 'listlit', close: ']', listAssign: true, argc: 0 }); return;
    }
    if (prev && isOp(prev, '=')) {
      const l = T[i - 2];
      if (l && l.t === 'var' && l.sig === '%') { emit('_hash('); st.push({ k: 'hashlit', close: ')', argc: 0 }); return; }
      if ((l && l.t === 'var' && l.sig === '@') || lastListClose === i - 2) {
        if (hasRange(i)) { emit('_L(['); st.push({ k: 'listlit', close: '])', argc: 0 }); }
        else if (!hasComma(i)) { emit('_list('); st.push({ k: 'paren', close: ')' }); }
        else { emit('['); st.push({ k: 'listlit', close: ']', argc: 0 }); }
        return;
      }
    }
    emit('('); st.push({ k: 'paren', close: ')' });
  }

  function builtinCall(v, imp) {            // imp: an imported (module) function, otherwise a core builtin
    const next = T[i + 1];
    const name = imp ? (imp.line && T[i].line ? '(_ln.v = ' + T[i].line + ', ' + jsName(v) + ')' : jsName(v)) : (v === 'die' || v === 'warn') && T[i].line ? '(_ln.v = ' + T[i].line + ', ' + v + '_)' : v + '_';
    if (!imp && (v === 'print' || v === 'say' || v === 'printf')) {
      if (next && next.t === 'id' && (next.v === 'STDERR' || next.v === 'STDOUT')) {
        if (next.v === 'STDERR') emit('warn_'); else emit(name);
        i++;
        if (!isOp(T[i + 1], '(')) { emit('('); st.push({ k: 'call', close: ')', callee: v, argc: 0 }); }
        return;
      }
    }
    if (isOp(next, '(')) { emit(name); return; }   // paren handler sees callee id
    if (imp && imp.kind === 'block' && isOp(next, '{')) { emit(name + '('); st.push({ k: 'call', close: ')', callee: v, argc: 0 }); return; }
    if (!imp && (v === 'sort' || v === 'map' || v === 'grep')) {
      if (isOp(next, '{')) { emit(name + '('); st.push({ k: 'call', close: ')', callee: v, argc: 0 }); return; }
      if (v === 'sort') { emit('sort_(null, '); st.push({ k: 'call', close: ')', callee: v, argc: 1 }); return; }
      emit(name + '(($_) => ' + (v === 'map' ? '[' : '('));
      st.push({ k: 'exprfn', close: (v === 'map' ? ']' : ')'), callee: v });
      return;
    }
    const isUnary = imp ? imp.kind === 'unary' : UNARY.has(v), isNoarg = imp ? imp.kind === 'noarg' : NOARG.has(v);
    if (isUnary || isNoarg) {
      if (!startsTerm(next) || (isNoarg && !isUnary)) {
        emit(name + (!imp && (v === 'shift' || v === 'pop') ? '($_args)' : !imp && DEFARG.has(v) ? '($_)' : '()'));
        return;
      }
      emit(name + '('); st.push({ k: 'unary', close: ')', callee: v, argc: 0 });
      return;
    }
    const minusTerm = isOp(next, '-') && T[i + 2] && !T[i + 2].sp && (T[i + 2].t === 'num' || T[i + 2].t === 'var' || T[i + 2].t === 'id' || isOp(T[i + 2], '('));   // print -7, ...
    if (!startsTerm(next) && !minusTerm) { emit((v === 'print' || v === 'say') && (!next || (next.t === 'op' && (next.v === ';' || next.v === '}'))) ? name + '($_)' : name + '()'); return; }
    emit(name + '('); st.push({ k: 'call', close: ')', callee: v, argc: 0 });
  }
}

/* ---------------------------------------------------------------- runtime */

class Lst extends Array {}
const mk = (a) => { const r = new Lst(); for (const x of a) r.push(x); return r; };
const G = typeof globalThis !== 'undefined' ? globalThis : root;
G.$ERR = '';

function sprintf_(fmt, ...args) {
  args = args.flat(1);
  let ai = 0;
  return String(fmt).replace(/%(?:(\d+)\$)?([-+ 0#]*)(v?)(\*|\d+)?(?:\.(\d+))?([sdifgeExXobcu%])/g, (all, pos, flags, vflag, width, prec, conv) => {
    if (conv === '%') return '%';
    if (pos) { const keep = ai; ai = +pos - 1; const r = sprintf_('%' + flags + vflag + (width || '') + (prec !== undefined ? '.' + prec : '') + conv, args[ai]); ai = keep; return r; }
    if (vflag) { const sv = String(_s(args[ai++])); return Array.from(sv, (ch) => sprintf_('%' + flags + (width || '') + conv, ch.codePointAt(0))).join('.'); }   // %vd
    if (width === '*') width = args[ai++];
    let a = args[ai++];
    let s;
    switch (conv) {
      case 's': s = String(_s(a)); if (prec !== undefined) s = s.slice(0, +prec); break;
      case 'c': s = String.fromCharCode(a); break;
      case 'd': case 'i': case 'u': s = String(Math.trunc(Number(a) || 0)); break;
      case 'f': s = toFixedC(Number(a) || 0, prec === undefined ? 6 : +prec); break;
      case 'e': case 'E': s = (Number(a) || 0).toExponential(prec === undefined ? 6 : +prec).replace(/e([+-])(\d)$/, 'e$10$2'); if (conv === 'E') s = s.toUpperCase(); break;
      case 'g': s = String(Number(Number(a).toPrecision(prec === undefined ? 6 : +prec || 1))); break;
      case 'x': s = (Number(a) >>> 0).toString(16); if (flags.includes('#')) s = '0x' + s; break;
      case 'X': s = (Number(a) >>> 0).toString(16).toUpperCase(); break;
      case 'o': s = (Number(a) >>> 0).toString(8); break;
      case 'b': s = (Number(a) >>> 0).toString(2); break;
    }
    if ('dif'.includes(conv) && flags.includes('+') && Number(a) >= 0) s = '+' + s;
    else if ('dif'.includes(conv) && flags.includes(' ') && Number(a) >= 0) s = ' ' + s;
    const w = +width || 0;
    if (s.length < w) {
      if (flags.includes('-')) s = s.padEnd(w);
      else if (flags.includes('0') && conv !== 's') { const neg = /^[+-]/.test(s) ? s[0] : ''; s = neg + s.slice(neg.length).padStart(w - neg.length, '0'); }
      else s = s.padStart(w);
    }
    return s;
  });
}

/* ---- packages / bless ---- */
const PKGS = {};
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const Root = {}, RootProto = {};
const hide = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, configurable: true, writable: true });
function pkg(name) {
  if (PKGS[name]) return PKGS[name];
  const P = Object.create(Root), proto = Object.create(RootProto);
  hide(P, '__name', name); hide(P, 'proto', proto); hide(P, '$f', {});
  hide(proto, '__ps', P);
  return (PKGS[name] = P);
}
const isaWalk = (P, name) => { for (let o = P; o && o !== Root; o = Object.getPrototypeOf(o)) if (hasOwn(o, '__name') && o.__name === name) return true; return false; };
for (const [o, isStatic] of [[Root, true], [RootProto, false]]) {
  hide(o, '$super', function (pk, m) {
    const P = PKGS[pk], self = this;
    const f = hasOwn(this, '__name') ? Object.getPrototypeOf(P)[m] : Object.getPrototypeOf(P.proto)[m];
    if (typeof f !== 'function') throw 'Can\'t locate object method "' + m + '" via package "' + pk + '"';
    return (...a) => f.apply(self, a);
  });
  hide(o, 'isa', function (name) { const P = hasOwn(this, '__name') ? this : Object.getPrototypeOf(this).__ps; return !!P && isaWalk(P, name); });
  hide(o, 'can', function (m) { const f = hasOwn(this, '__name') ? this[m] : Object.getPrototypeOf(this)[m]; return typeof f === 'function' ? f : ''; });
  hide(o, 'toString', isStatic ? function () { return this.__name; } : function () { return Object.getPrototypeOf(this).__ps.__name + '=HASH'; });
}
hide(Object.prototype, '_$', function (n) {          // $x->method(...) : Perl method call (blessed) or JS method
  const p = Object.getPrototypeOf(this);
  if (p && p.__ps) {
    const f = p[n];
    if (typeof f === 'function') return (...a) => f.apply(this, a);
    throw 'Can\'t locate object method "' + n + '" via package "' + p.__ps.__name + '"';
  }
  if (typeof this === 'number') for (const h of NUMHOOKS) { const f = h(+this, n, true); if (f !== undefined) return f; }
  const v = this[n];
  return typeof v === 'function' ? v.bind(this) : v;
});

hide(Object.prototype, '_p', function (n) {          // $x->name without parens: Perl method call (blessed) or JS property
  const p = Object.getPrototypeOf(this);
  if (p && p.__ps) {
    if (typeof p[n] === 'function') return p[n].call(this);
    if (!(n in this)) throw 'Can\'t locate object method "' + n + '" via package "' + p.__ps.__name + '"';
  }
  if (typeof this === 'number') for (const h of NUMHOOKS) { const f = h(+this, n, false); if (f !== undefined) return f; }   // $epoch->ymd, $secs->days
  const v = this[n];
  if (typeof v === 'function' && this.__perlCall) return v.call(this);                                  // Time::Piece / DateTime accessors
  return v;
});
hide(Root, '__perlCall', true);
hide(Object.prototype, '_at', function (i) { const a = Array.isArray(this) ? this : [this]; return a[i < 0 ? a.length + i : i]; });
hide(Object.prototype, '_slice', function (ix) {      // (list)[i,j] / @a[i,j]
  const a = Array.isArray(this) ? this : [this];
  return mk(ix.map((i) => a[i < 0 ? a.length + i : i]));
});

/* ---- localtime / gmtime (core: list, or a string in scalar context; `use Time::Piece` swaps in objects) ---- */
const NUMHOOKS = [];          // (number, name, call) => value|undefined : methods on plain numbers ($t + ONE_DAY)->ymd
class TimeList extends Array { static get [Symbol.species]() { return Array; } }
const DN3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');
function timeList(t, utc) {
  const d = new Date(Math.floor(t === undefined ? Date.now() / 1000 : +t) * 1000);
  const f = utc ? { Y: d.getUTCFullYear(), M: d.getUTCMonth(), D: d.getUTCDate(), h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), w: d.getUTCDay() }
                : { Y: d.getFullYear(), M: d.getMonth(), D: d.getDate(), h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), w: d.getDay() };
  const yday = Math.round((Date.UTC(f.Y, f.M, f.D) - Date.UTC(f.Y, 0, 1)) / 86400000);
  const r = new TimeList();
  r.push(f.s, f.m, f.h, f.D, f.M, f.Y - 1900, f.w, yday, 0);
  hide(r, '__scalar', () => DN3[f.w] + ' ' + MN3[f.M] + ' ' + String(f.D).padStart(2, ' ') + ' ' + pad2(f.h) + ':' + pad2(f.m) + ':' + pad2(f.s) + ' ' + f.Y);
  return r;
}
hide(TimeList.prototype, '__listlike', true);
// string operators (=~, tr, x ...) work on the string form too; installed once the String helpers below exist
const TIMELIST_FWD = ['$m', '$nm', '$sub', '$tr', '$trc', '$x'];
hide(TimeList.prototype, 'toString', function () { return this.__scalar(); });

function blockMs(ms) {
  if (ms <= 0) return;
  if (typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined' && typeof process !== 'undefined') { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); return; }
  const end = Date.now() + ms;
  while (Date.now() < end) { /* the browser cannot sleep synchronously */ }
}
const EACH = new WeakMap();                                   // iterator state of each(): object -> { keys, i }
function eachNext(h, keyOnly) {
  if (h == null || typeof h !== 'object') return keyOnly ? undefined : mk([]);
  let st = EACH.get(h);
  if (!st) { st = { keys: Array.isArray(h) ? [...h.keys()] : Object.keys(h), i: 0 }; EACH.set(h, st); }
  if (st.i >= st.keys.length) { EACH.delete(h); return keyOnly ? undefined : mk([]); }
  const k = st.keys[st.i++];
  return keyOnly ? k : mk([k, h[k]]);
}
const RT = {
  _pkg: pkg,
  _def: (pk, name, fn) => { const P = pkg(pk); P.$f[name] = fn; const w = function (...a) { return fn.apply(this, [this, ...a]); }; P[name] = w; P.proto[name] = w; },
  _isa: (pk, parents) => {
    const P = pkg(pk);
    parents.forEach((n, idx) => {
      const B = pkg(n);
      if (idx === 0) { Object.setPrototypeOf(P, B); Object.setPrototypeOf(P.proto, B.proto); }
      else { for (const k of Object.keys(B)) if (!(k in P)) P[k] = B[k]; for (const k of Object.keys(B.proto)) if (!(k in P.proto)) P.proto[k] = B.proto[k]; }
    });
  },
  bless_: (obj, cls) => {
    const P = typeof cls === 'string' ? pkg(cls) : (cls && cls.__ps ? cls.__ps : cls);
    Object.setPrototypeOf(obj, P.proto); return obj;
  },
  print_: (...l) => { Perl2JS.stdout(l.flat(1).map(_s).join(G.$OFS === undefined ? '' : G.$OFS) + (G.$ORS === undefined ? '' : G.$ORS)); return 1; },
  say_: (...l) => { Perl2JS.stdout(l.flat(1).map(_s).join(G.$OFS === undefined ? '' : G.$OFS) + '\n'); return 1; },
  binmode_: () => 1,
  STDOUT: 'STDOUT', STDERR: 'STDERR', STDIN: 'STDIN',
  printf_: (f, ...l) => { Perl2JS.stdout(sprintf_(f, ...l)); return 1; },
  sprintf_,
  push_: (a, ...v) => a.push(...v.flat(0)),
  pop_: (a) => a.pop(),
  shift_: (a) => a.shift(),
  unshift_: (a, ...v) => a.unshift(...v),
  deref_: (x) => x,
  substr4_: (s, off, len, repl) => { s = String(_s(s)); off = +off; if (off < 0) off = Math.max(0, s.length + off); len = len == null ? s.length - off : +len < 0 ? Math.max(0, s.length - off + +len) : +len; return s.slice(0, off) + _s(repl) + s.slice(off + len); },
  quotemeta_: (x) => String(_s(x)).replace(/[^A-Za-z0-9_]/g, '\\$&'),
  _h$NAMED_: new Proxy({}, { get: (t, k) => (typeof k === 'string' && LAST && LAST.groups ? LAST.groups[k] : undefined), has: (t, k) => !!(LAST && LAST.groups && k in LAST.groups) }),
  $0: 'main.p2j', _a$ARGV: [], _h$ENV: {},
  aset_: (a, v) => { v = Array.isArray(v) ? Array.from(v) : v === undefined ? [] : [v]; a.splice(0, a.length, ...v); return a; },
  asetl_: (a, v) => { a.splice(0, a.length, ...v.flatMap((x) => (x instanceof Lst || (x && x.__listlike)) ? x : [x])); return a; },
  hset_: (h, v) => { EACH.delete(h); const src = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.assign({}, v) : []; for (const k of Object.keys(h)) delete h[k]; if (Array.isArray(src)) for (let n = 0; n < src.length; n += 2) h[_s(src[n])] = src[n + 1]; else Object.assign(h, src); return h; },
  hsetl_: (h, v) => RT.hset_(h, v.flatMap((x) => (x instanceof Lst || (x && x.__listlike)) ? x : [x])),
  hexists_: (h, k) => h != null && typeof h === 'object' && _s(k) in h,
  hdel_: (h, k) => { const r = h[k]; delete h[k]; return r; },
  _sref: (g, s) => new SRef(g, s),
  _sconst: (x) => new SRef(() => x, null),
  _countof: (...l) => l.flat(1).length,
  hslice_: (h, ...k) => mk(k.flat(1).map((x) => h[x])),
  aslice_: (a, ...k) => mk(k.flat(1).map((x) => a[x < 0 ? a.length + +x : x])),
  hsset_: (h, k, v) => { k = [].concat(k).flat(1); v = [].concat(v).flat(1); k.forEach((x, n) => { h[x] = v[n]; }); return mk(v); },
  hsdel_: (h, ...k) => mk(k.flat(1).map((x) => { const r = h[x]; delete h[x]; return r; })),
  splice_: (a, off = 0, len, ...l) => a.splice(off, len === undefined ? a.length : len, ...l),
  join_: (sep, ...l) => l.flat(1).map(_s).join(sep),
  split_: (pat, str, limit) => {
    str = String(str == null ? '' : str);
    let re = pat;
    if (typeof pat === 'string') re = pat === ' ' ? /\s+/ : new RegExp(pat);
    if (pat === ' ') str = str.replace(/^\s+/, '');
    let r = str.split(re);
    if (limit > 0 && r.length > limit) {
      r = str.split(re); const head = r.slice(0, limit - 1);
      let consumed = 0, s2 = str;
      for (let k = 0; k < limit - 1; k++) { const mm = re.exec ? new RegExp(re.source, re.flags.replace('g', '')).exec(s2) : null; if (!mm) break; s2 = s2.slice(mm.index + mm[0].length); }
      r = head.concat([s2]);
    } else if (!(limit < 0)) while (r.length && (r[r.length - 1] === '' || r[r.length - 1] === undefined)) r.pop();
    return mk(r);
  },
  map_: (fn, ...l) => mk(l.flat(1).flatMap(fn)),
  grep_: (fn, ...l) => mk(l.flat(1).filter(fn)),
  sort_: (fn, ...l) => mk(l.flat(1).sort(fn || undefined)),
  reverse_: (...l) => (l.length === 1 && typeof l[0] === 'string') ? [...l[0]].reverse().join('') : mk(l.flat(1).slice().reverse()),
  keys_: (h) => { if (h && typeof h === 'object') EACH.delete(h); return mk(Array.isArray(h) ? [...h.keys()] : Object.keys(h || {})); },
  each_: (h) => eachNext(h, false),
  eachkey_: (h) => eachNext(h, true),
  values_: (h) => mk(Array.isArray(h) ? h.slice() : Object.values(h || {})),
  exists_: (x) => x !== undefined,
  defined_: (x) => x !== undefined && x !== null,
  scalar_: (x) => (x && typeof x.__scalar === 'function') ? x.__scalar() : Array.isArray(x) ? x.length : (x && typeof x === 'object' ? Object.keys(x).length : x),
  length_: (s) => s == null ? undefined : String(s).length,
  substr_: (s, off, len) => {
    s = String(s); if (off < 0) off = Math.max(0, s.length + off);
    if (len === undefined) return s.slice(off);
    return len < 0 ? s.slice(off, s.length + len) : s.substr(off, len);
  },
  index_: (s, t, p) => String(s).indexOf(t, p),
  rindex_: (s, t, p) => p === undefined ? String(s).lastIndexOf(t) : String(s).lastIndexOf(t, p),
  uc_: (s) => String(s).toUpperCase(),
  lc_: (s) => String(s).toLowerCase(),
  ucfirst_: (s) => { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); },
  lcfirst_: (s) => { s = String(s); return s.charAt(0).toLowerCase() + s.slice(1); },
  abs_: Math.abs, int_: Math.trunc, sqrt_: Math.sqrt, sin_: Math.sin, cos_: Math.cos, atan2_: Math.atan2,
  exp_: Math.exp, log_: Math.log,
  hex_: (s) => parseInt(String(s).replace(/^0x/i, ''), 16),
  oct_: (s) => { s = String(s); return /^0x/i.test(s) ? parseInt(s, 16) : /^0b/i.test(s) ? parseInt(s.slice(2), 2) : parseInt(s, 8); },
  rand_: (n) => Math.random() * (n || 1),
  srand_: () => 0,
  time_: () => Math.floor(Date.now() / 1000),
  // sleep blocks like Perl does (the page is busy while it waits); in Node it really sleeps without spinning
  sleep_: (n, cb) => { n = +n || 0; if (typeof cb === 'function') return setTimeout(cb, n * 1000); blockMs(n * 1000); return Math.round(n); },   // sleep(3, sub { ... }) waits without blocking
  select_: (r, w, e, t) => { if (t != null) blockMs(+t * 1000); return 0; },
  localtime_: (t) => timeList(t, false),
  gmtime_: (t) => timeList(t, true),
  _ln: { v: 0 },
  die_: (...l) => {
    const a = l.flat(1);
    if (a.length === 1 && typeof a[0] === 'object' && a[0] !== null) throw a[0];
    let m = a.map(_s).join('') || 'Died';
    if (!/\n$/.test(m)) m += ' at line ' + RT._ln.v + '.\n';       // like Perl: "msg at SCRIPT line N."
    throw m;
  },
  warn_: (...l) => { let m = l.flat(1).map(_s).join(''); if (!/\n$/.test(m)) m += ' at line ' + RT._ln.v + '.\n'; console.warn(m.replace(/\n$/, '')); return 1; },
  ref_: (x) => x == null ? '' : x instanceof SRef ? (typeof x.v === 'object' && x.v !== null || typeof x.v === 'function' ? 'REF' : 'SCALAR') : x instanceof RegExp ? 'Regexp' : (typeof x === 'object' && Object.getPrototypeOf(x) && Object.getPrototypeOf(x).__ps) ? Object.getPrototypeOf(x).__ps.__name :
    (typeof x === 'object' && hasOwn(x, '__name')) ? '' : Array.isArray(x) ? 'ARRAY' : typeof x === 'function' ? 'CODE' :
    typeof x === 'object' ? (x.constructor && x.constructor !== Object ? x.constructor.name : 'HASH') : '',
  chomp_: (x) => (Array.isArray(x) ? mk(x.map((v) => String(_s(v)).replace(/\n$/, ''))) : x == null ? x : String(_s(x)).replace(/\n$/, '')),
  chop_: (x) => (Array.isArray(x) ? mk(x.map((v) => String(_s(v)).slice(0, -1))) : x == null ? x : String(_s(x)).slice(0, -1)),
  chr_: (n) => String.fromCodePoint(n),
  ord_: (s) => String(s).codePointAt(0),
  num_: (x) => Number(x),
  exit_: () => { throw { exit: true }; },
  eval_: (f) => {
    try { const r = f(); G.$ERR = ''; return r === undefined ? 1 : r; }
    catch (e) { if (e && e.exit) throw e; G.$ERR = (e instanceof Error) ? e.message : e; return undefined; }
  },
  _hash: (...kv) => { const o = {}; for (let k = 0; k < kv.length; k += 2) o[kv[k]] = kv[k + 1]; return o; },
  _hashFrom: (x) => Array.isArray(x) ? RT._hash(...x) : x,
  _pairs: (h) => Object.entries(h || {}).flat(),
  _list: (x) => x === undefined ? [] : Array.isArray(x) ? x : [x],
  _L: (a) => a.flatMap((x) => (x instanceof Lst || (x && x.__listlike)) ? x : [x]),
  _local: (L, get, set) => { L.push([set, get()]); },
  _unlocal: (L) => { for (let k = L.length - 1; k >= 0; k--) L[k][0](L[k][1]); },
  _NUM_ASC: (a, b) => a - b,
  _NUM_DESC: (a, b) => b - a,
  _STR_DESC: (a, b) => a < b ? 1 : a > b ? -1 : 0,
  _arr: (x) => Array.isArray(x) ? Array.from(x) : x,
  _rx: (v) => (v instanceof RegExp ? '(?:' + v.source + ')' : String(v)),
  _s,
  _cU: (x) => String(x).toUpperCase(), _cL: (x) => String(x).toLowerCase(),
  _cu: (x) => { x = String(x); return x.charAt(0).toUpperCase() + x.slice(1); }, _cl: (x) => { x = String(x); return x.charAt(0).toLowerCase() + x.slice(1); },
};
// Perl prints numbers with %.15g (0.1+0.2 => 0.3, 1e15 => 1e+15); JS would print 0.30000000000000004
function toFixedC(v, p) {                                  // like C's printf("%.Nf"): an exact tie rounds to even (0.5 -> 0, 1.5 -> 2, 2.5 -> 2)
  if (!Number.isFinite(v) || Math.abs(v) >= 1e21 || p > 60) return v.toFixed(Math.min(p, 100));
  const exact = Math.abs(v).toFixed(Math.min(100, p + 30)), frac = exact.split('.')[1] || '';
  if (/^50*$/.test(frac.slice(p))) {                       // exactly halfway
    const down = Math.abs(v).toFixed(p + 1).slice(0, -1).replace(/\.$/, '');          // truncated at p digits
    const lastDigit = +down.replace('.', '').slice(-1);
    const up = lastDigit % 2 === 0 ? down : (Math.abs(v) + Math.pow(10, -p) / 2).toFixed(p);
    return (v < 0 ? '-' : '') + (lastDigit % 2 === 0 ? down : up);
  }
  return v.toFixed(p);
}
function fmtNum(v) {
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  if (!isFinite(v)) return isNaN(v) ? 'NaN' : v > 0 ? 'Inf' : '-Inf';
  const [m, e] = v.toExponential(14).split('e'), exp = +e;
  if (exp < -4 || exp >= 15) return m.replace(/\.?0+$/, '') + 'e' + (exp < 0 ? '-' : '+') + String(Math.abs(exp)).padStart(2, '0');
  const f = v.toFixed(Math.max(0, 14 - exp));
  return f.includes('.') ? f.replace(/\.?0+$/, '') : f;
}
class SRef {                                         // \$x : a reference to a scalar variable
  constructor(get, set) { this.g = get; this.s = set; }
  get v() { return this.g(); }
  set v(x) { if (this.s) this.s(x); }
}
const ADDR = new WeakMap(); let addrN = 0;
const addrOf = (o) => { let a = ADDR.get(o); if (a === undefined) { a = 0x55d0c8a1f000 + (addrN++) * 24; ADDR.set(o, a); } return a; };
function refStr(v) {                                  // ARRAY(0x55d0c8a1f000)  /  Foo=HASH(0x...)
  const hex = '(0x' + addrOf(v).toString(16) + ')';
  const pr = Object.getPrototypeOf(v);
  const blessed = pr && pr.__ps ? pr.__ps.__name + '=' : '';
  const kind = v instanceof SRef ? (typeof v.v === 'object' && v.v !== null || typeof v.v === 'function' ? 'REF' : 'SCALAR') : Array.isArray(v) ? 'ARRAY' : typeof v === 'function' ? 'CODE' : 'HASH';
  return blessed + kind + hex;
}
const isPlainRef = (o) => Array.isArray(o) ? !(o instanceof Lst) : o instanceof SRef || typeof o === 'function' || (() => { const pr = Object.getPrototypeOf(o); return pr === Object.prototype || pr === null || !!(pr && pr.__ps); })();
Object.defineProperty(Object.prototype, Symbol.toPrimitive, { enumerable: false, configurable: true, writable: true, value: function (hint) {     // $ref == $ref2 compares addresses
  if (hint !== 'string' && isPlainRef(this)) return addrOf(this);
  for (const m of hint === 'string' ? ['toString', 'valueOf'] : ['valueOf', 'toString']) { const f = this[m]; if (typeof f === 'function') { const r = f.call(this); if (r === null || (typeof r !== 'object' && typeof r !== 'function')) return r; } }
  throw new TypeError('Cannot convert object to primitive value');
} });
function _s(v) {
  if (typeof v === 'string') return v;
  if (v == null || v === false) return '';
  if (v === true) return '1';
  if (typeof v === 'number') return fmtNum(v);
  if (typeof v === 'object' && typeof v.__scalar === 'function') return v.__scalar();
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v instanceof Lst ? v : refStr(v);
    if (v instanceof SRef) return refStr(v);
    const pr = Object.getPrototypeOf(v);
    if (pr === Object.prototype || pr === null || (pr && pr.__ps)) return refStr(v);
  } else if (typeof v === 'function') return refStr(v);
  return v;
}

const POS = new Map();
function strInc(s) {                                      // "az" -> "ba", "Zz" -> "AAa", "a9" -> "b0"
  const a = s.split('');
  for (let i = a.length - 1; i >= 0; i--) {
    const c = a[i];
    if (c === 'z') a[i] = 'a'; else if (c === 'Z') a[i] = 'A'; else if (c === '9') a[i] = '0';
    else { a[i] = String.fromCharCode(c.charCodeAt(0) + 1); return a.join(''); }
  }
  const f = s[0];
  return (f === 'z' ? 'a' : f === 'Z' ? 'A' : '1') + a.join('');
}
hide(Array.prototype, '$x', function (n) { const r = new Lst(); for (let i = 0; i < n; i++) r.push(...this); return r; });   // (1, 2) x 3
// $1..$9 / $MATCH are lazy getters over the last successful match (much cheaper than writing 10 globals per match)
let LAST = null;
for (let k = 1; k < 10; k++) Object.defineProperty(G, '$' + k, { get() { return LAST ? LAST[k] : undefined; }, set() {}, configurable: true });
Object.defineProperty(G, '$MATCH', { get() { return LAST ? LAST[0] : undefined; }, set() {}, configurable: true });
Object.defineProperty(G, '$NAMED', { get() { return LAST && LAST.groups ? LAST.groups : {}; }, set() {}, configurable: true });   // $+{name}
function trExpand(s) {
  s = s.replace(/\\(.)/g, (m, c) => ({ n: '\n', t: '\t', r: '\r', '\\': '\\', '-': '\u0001' })[c] || c);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i + 1] === '-' && i + 2 < s.length) { for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) out.push(String.fromCharCode(c)); i += 2; }
    else out.push(s[i]);
  }
  return out.map((ch) => ch === '\u0001' ? '-' : ch);
}
function trans(str, from, to, flags) {
  const f = trExpand(from);
  let t = trExpand(to);
  const cmp = flags.includes('c'), del = flags.includes('d'), sq = flags.includes('s');
  if (!t.length && !del) t = f.slice();
  else if (t.length && t.length < f.length && !del) t = t.concat(Array(f.length - t.length).fill(t[t.length - 1]));
  let out = '', last = null, count = 0;
  for (const ch of str) {
    let idx = f.indexOf(ch);
    if (cmp) idx = idx < 0 ? 0 : -1;
    if (idx < 0) { out += ch; last = null; continue; }
    count++;
    let r;
    if (cmp) r = del ? undefined : (to === '' ? ch : t[t.length - 1]);
    else r = idx < t.length ? t[idx] : (del ? undefined : t[t.length - 1]);
    if (r === undefined) continue;
    if (sq && last === r) continue;
    out += r; last = r;
  }
  return { out, count };
}
const def = (proto, name, fn) => Object.defineProperty(proto, name, { value: fn, enumerable: false, configurable: true, writable: true });
for (const P of [String.prototype, Number.prototype]) {
  def(P, '$x', function (n) { return String(this).repeat(Math.max(0, n)); });
  def(P, '$ncmp', function (o) { const a = +this, b = +o; return a < b ? -1 : a > b ? 1 : 0; });
  def(P, '$scmp', function (o) { const a = String(this), b = String(o); return a < b ? -1 : a > b ? 1 : 0; });
  def(P, '$rng', function (e) {
    const r = new Lst();
    const a = this.valueOf();
    if (typeof a === 'string' && isNaN(a)) {            // 'a'..'e', 'aa'..'ad' : Perl's magic string increment
      const end = String(e);
      let cur = a;
      for (let guard = 0; cur.length <= end.length && guard < 1e6; guard++) { r.push(cur); if (cur === end) break; cur = strInc(cur); }
    } else for (let k = +a; k <= +e; k++) r.push(k);
    return r;
  });
  def(P, '$m', function (re) {
    const str = String(this);
    let m;
    if (re.global) {            // scalar-context //g : remember position per (pattern, string)
      const key = re.source + '/' + re.flags, ps = POS.get(key);
      re.lastIndex = ps && ps.str === str ? ps.idx : 0;
      m = re.exec(str);
      if (m) POS.set(key, { str, idx: m[0] === '' ? re.lastIndex + 1 : re.lastIndex }); else POS.delete(key);
    } else m = re.exec(str);
    if (!m) return false;
    LAST = m;
    return true;
  });
  def(P, '$nm', function (re) { return !this.$m(re); });
  def(P, '$mod', function (o) {                                 // -7 % 3 == 2 in Perl (JS: -1);  7.5 % 2 == 1
    const a = Math.trunc(+this), b = Math.trunc(+o);
    if (b === 0) throw 'Illegal modulus zero at line ' + RT._ln.v + '.\n';
    const m = a % b;
    return m !== 0 && (m < 0) !== (b < 0) ? m + b : m;
  });
  def(P, '$ml', function (re) {                                 // a match in list context: the captures
    const str = String(this);
    if (re.global) {
      const out = []; re.lastIndex = 0; let m;
      while ((m = re.exec(str))) { out.push(...(m.length > 1 ? m.slice(1) : [m[0]])); LAST = m; if (m[0] === '') re.lastIndex++; }
      return mk(out);
    }
    const m = re.exec(str);
    if (!m) return mk([]);
    LAST = m;
    return mk(m.length > 1 ? m.slice(1) : [1]);
  });
  def(P, '$tr', function (from, to, flags) { return trans(String(this), from, to, flags).out; });
  def(P, '$trc', function (from, to, flags) { return trans(String(this), from, to, flags).count; });
  def(P, '$sub', function (re, fn) {
    return String(this).replace(re, (...a) => {
      const n = typeof a[a.length - 1] === 'object' ? a.length - 3 : a.length - 2;   // number of capture groups
      LAST = a.slice(0, n + 1);
      if (typeof a[a.length - 1] === 'object') LAST.groups = a[a.length - 1];
      return fn();
    });
  });
}
for (const k of TIMELIST_FWD) hide(TimeList.prototype, k, function (...a) { return String.prototype[k].apply(String(this), a); });

/* ------------------------------------------------------------------ API */

function errorText(err) {
  const e = err instanceof PerlError ? err : toPerlError('runtime', err);
  let t = (e.kind === 'compile' ? 'コンパイルエラー' : '実行時エラー') + (e.line ? ' (行 ' + e.line + ')' : '') + '\n' + e.message;
  if (e.hint) t += '\nヒント: ' + e.hint;
  if (e.line && e.src) {
    const L = e.src.split('\n');
    for (let k = Math.max(1, e.line - 2); k <= Math.min(L.length, e.line + 2); k++) t += '\n' + (k === e.line ? '> ' : '  ') + String(k).padStart(4) + ' | ' + L[k - 1];
  }
  return t;
}
// Draw the error into the page (target element, or a dismissable banner at the top of the page)
function renderError(err, target, opts) {
  const e = err instanceof PerlError ? err : toPerlError('runtime', err);
  if (typeof document === 'undefined') { console.error(errorText(e)); return null; }
  const dark = opts && typeof opts.dark === 'boolean' ? opts.dark : !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
  const C = dark ? { bg: '#2a1412', bd: '#ff8a80', fg: '#ffd9d4', mut: '#e0a9a2', hi: '#5a2420', line: '#7a3a34' }
                 : { bg: '#fff1f0', bd: '#d93025', fg: '#3c0b08', mut: '#8a3a33', hi: '#ffd6d2', line: '#f0b4ae' };
  const el = (tag, css, text) => { const n = document.createElement(tag); if (css) n.style.cssText = css; if (text !== undefined) n.textContent = text; return n; };
  const box = el('div', 'font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:normal;text-align:left;' +
    'background:' + C.bg + ';color:' + C.fg + ';border:1px solid ' + C.bd + ';border-left:6px solid ' + C.bd + ';border-radius:8px;padding:10px 12px;margin:8px 0;');
  const head = el('div', 'font-weight:700;margin-bottom:4px;', (e.kind === 'compile' ? '⚠ コンパイルエラー' : '⚠ 実行時エラー') + (e.line ? '  — 行 ' + e.line : ''));
  box.appendChild(head);
  box.appendChild(el('div', 'white-space:pre-wrap;word-break:break-word;font-weight:600;', e.message));
  if (e.hint) box.appendChild(el('div', 'margin-top:6px;color:' + C.mut + ';white-space:pre-wrap;', '💡 ' + e.hint));
  if (e.line && e.src) {
    const L = e.src.split('\n'), code = el('div', 'margin-top:8px;border:1px solid ' + C.line + ';border-radius:6px;overflow:auto;');
    for (let k = Math.max(1, e.line - 3); k <= Math.min(L.length, e.line + 2); k++) {
      const row = el('div', 'display:flex;white-space:pre;' + (k === e.line ? 'background:' + C.hi + ';font-weight:700;' : ''));
      row.appendChild(el('span', 'min-width:3.2em;text-align:right;padding:0 8px;color:' + C.mut + ';user-select:none;', String(k)));
      row.appendChild(el('span', 'padding-right:12px;', (k === e.line ? '▶ ' : '  ') + L[k - 1]));
      code.appendChild(row);
    }
    box.appendChild(code);
  }
  if (target) {
    if (!(opts && opts.append)) target.textContent = '';
    target.appendChild(box);
    return box;
  }
  let host = document.getElementById('perl2js-error');
  if (!host) {
    host = el('div', 'position:fixed;top:8px;left:8px;right:8px;z-index:2147483647;max-height:60vh;overflow:auto;box-shadow:0 6px 24px rgba(0,0,0,.25);border-radius:8px;');
    host.id = 'perl2js-error';
    (document.body || document.documentElement).appendChild(host);
  }
  const close = el('button', 'float:right;border:0;background:transparent;color:inherit;font-size:16px;cursor:pointer;', '✕');
  close.onclick = () => box.remove();
  head.appendChild(close);
  host.appendChild(box);
  return box;
}

/* ------------------------------------------------------------- module loader */
// `use List::Util qw(sum);` loads modules/List/Util.js on demand, so the core stays small.
// A module file calls  Perl2JS.module({ name, deps, init(api) { ...; return { exports, default, listops, ... }; } })
const MODS = {}, PENDING = {};
const isNode = typeof process !== 'undefined' && !!(process.versions && process.versions.node) && typeof require === 'function';
const SCRIPT_URL = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
function libBase() {
  if (Perl2JS.libPath) return Perl2JS.libPath.replace(/\/?$/, '/');
  if (isNode) return require('path').join(__dirname, 'modules') + '/';
  if (SCRIPT_URL) return new URL('modules/', SCRIPT_URL).href;
  return new URL('modules/', document.baseURI).href;
}
const modUrl = (name) => libBase() + name.replace(/::/g, '/') + '.js';
function readSync(url) {
  if (isNode) return require('fs').readFileSync(/^file:/i.test(url) ? new URL(url) : url, 'utf8');
  const x = new XMLHttpRequest(); x.open('GET', url, false); x.send(null);
  if (x.status && (x.status < 200 || x.status >= 300)) throw new Error('HTTP ' + x.status);
  return x.responseText;
}
const evalModule = (text, url) => new Function('Perl2JS', text + '\n//# sourceURL=' + url)(Perl2JS);
const missing = (name, url, e) => new Error('モジュール "' + name + '" を読み込めません (' + url + ')' + (e && e.message ? ': ' + e.message : ''));
function initModule(name) {
  const raw = PENDING[name];
  const api = Object.assign({}, API, { use: (n) => { if (!MODS[n]) throw new Error('module not loaded: ' + n); return MODS[n]; } });
  const def = (raw.init && raw.init(api)) || {};
  def.name = name; MODS[name] = def;
  return def;
}
function loadSync(name) {
  if (MODS[name]) return MODS[name];
  if (!PENDING[name]) {
    const url = modUrl(name); let text;
    try { text = readSync(url); } catch (e) { throw missing(name, url, e); }
    evalModule(text, url);
    if (!PENDING[name]) throw missing(name, url, new Error('このファイルは ' + name + ' を登録していません'));
  }
  for (const d of PENDING[name].deps || []) loadSync(d);
  return MODS[name] || initModule(name);
}
async function loadAsync(name) {
  if (MODS[name]) return;
  if (!PENDING[name]) {
    const url = modUrl(name); let text;
    try {
      if (isNode || typeof fetch !== 'function') text = readSync(url);     // no fetch (old browsers / jsdom): fall back to a plain request
      else { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); text = await r.text(); }
    } catch (e) { throw missing(name, url, e); }
    evalModule(text, url);
    if (!PENDING[name]) throw missing(name, url, new Error('このファイルは ' + name + ' を登録していません'));
  }
  for (const d of PENDING[name].deps || []) await loadAsync(d);
  if (!MODS[name]) initModule(name);
}
// pragmas / core syntax handled by the translator itself: nothing to load
const PRAGMAS = new Set(['strict', 'warnings', 'utf8', 'feature', 'vars', 'lib', 'parent', 'base', 'constant', 'integer', 'overload', 'Exporter', 'bytes', 'open',
  'locale', 'fields', 'subs', 'less', 'sort', 'diagnostics', 'autodie', 'bigint', 'bignum', 'bigrat', 'if', 'mro', 're', 'version', 'charnames', 'English', 'experimental']);
function scanUses(T) {
  const out = [];
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (!(t.t === 'id' && t.v === 'use' && T[i + 1] && T[i + 1].t === 'id')) continue;
    const mod = T[i + 1].v;
    if (PRAGMAS.has(mod) || !/^[A-Za-z_][\w:]*$/.test(mod)) continue;
    const items = [], args = []; let explicit = false;
    for (let j = i + 2; j < T.length && !(T[j].t === 'op' && T[j].v === ';'); j++) {
      const u = T[j];
      if (u.t === 'str') { items.push(u.interp ? u.raw : u.v); args.push(u.interp ? u.raw : u.v); explicit = true; }
      else if (u.t === 'qw') { items.push(...u.list); args.push(...u.list); explicit = true; }
      else if (u.t === 'op' && u.v === '(') explicit = true;
      else if (u.t === 'id' || u.t === 'num') args.push(u.v);          // e.g. `use Test::More tests => 3;`
    }
    out.push({ mod, names: explicit ? items : null, args, line: t.line });
  }
  return out;
}
function buildImports(uses) {
  const cur = emptyCur(), imports = [];
  for (const u of uses) {
    const def = MODS[u.mod];
    if (!def) continue;
    const ex = def.exports || {};
    for (const c of Object.keys(def.classes || {})) cur.classes.add(c);
    for (const n of def.listfns || []) cur.listfns.add(n);
    const names = (u.names === null ? (def.default || []) : u.names.flatMap((n) => (n[0] === ':' ? Object.keys(ex) : [n]))).filter((n) => Object.prototype.hasOwnProperty.call(ex, n));
    const unary = new Set(def.unary || []), noarg = new Set(def.noarg || []), blocks = def.blockfns || {};
    for (const n of names) {
      const kind = typeof ex[n] !== 'function' ? 'const' : n in blocks ? 'block' : unary.has(n) ? 'unary' : noarg.has(n) ? 'noarg' : 'listop';
      cur.imports.set(n, { kind, mod: u.mod, params: blocks[n], line: (def.withLine || []).includes(n) });
      if (kind === 'block') cur.blockfns.add(n);
      imports.push({ name: n, mod: u.mod });
    }
  }
  return { cur, imports };
}
function compileFull(src) {
  Perl2JS.notes.length = 0;
  const T = lex(src);
  const seen = new Set(); Perl2JS.notes = Perl2JS.notes.filter((n) => { const k = n.line + n.from; if (seen.has(k)) return false; seen.add(k); return true; });
  const uses = scanUses(T);
  const jq = T.find((t) => t.t === 'id' && t.v === '$');
  const need = uses.map((u) => ({ mod: u.mod, line: u.line }));
  if (jq) need.push({ mod: 'jQuery', line: jq.line });
  for (const n of need) { try { loadSync(n.mod); } catch (e) { if (!e.line) e.line = n.line; throw e; } }
  const { cur, imports } = buildImports(uses);
  CUR = cur;
  try {
    const js = 'let $_args = [];\n' + translate(prepare(T), { marks: true }) + '\n';
    return { js, mods: Array.from(new Set(need.map((n) => n.mod))), imports, uses };
  } finally { CUR = emptyCur(); }
}
// module names a program needs (so a page can preload them asynchronously)
function requires(src) {
  try {
    const T = lex(src), names = scanUses(T).map((u) => u.mod);
    if (T.some((t) => t.t === 'id' && t.v === '$')) names.push('jQuery');
    return Array.from(new Set(names));
  } catch (e) { return []; }
}

const API = { G, hide, mk, Lst, RT, _s, root, NUMHOOKS, pkg, hasOwn };

const Perl2JS = {
  notes: [],                                  // hints from the last compile, e.g. full-width symbols read as half-width
  errorText, renderError,
  lex, prepare,
  PerlError,
  libPath: null,
  module(def) { PENDING[def.name] = def; },
  async use(...names) { for (const n of names.flat()) await loadAsync(n); },
  requires,
  compile(src) {
    try { return compileFull(src).js; } catch (e) { throw toPerlError('compile', e, src); }
  },
  run(src, opts) {
    let c;
    try { c = compileFull(src); } catch (e) { throw toPerlError('compile', e, src); }
    const js = c.js, scope = Object.assign({}, RT);
    for (const m of c.mods) {
      const def = MODS[m]; if (!def) continue;
      const key = safeName(m), ex = def.exports || {};
      for (const k of Object.keys(ex)) scope[key + '_' + k] = ex[k];                       // List::Util::sum(...)  =>  List_Util_sum
      for (const cls of Object.keys(def.classes || {})) scope[safeName(cls)] = def.classes[cls];   // DateTime->new
      const imported = c.imports.filter((x) => x.mod === m).map((x) => x.name);
      for (const n of imported) scope[jsName(n)] = ex[n];
      if (def.scope) Object.assign(scope, def.scope(imported, c.uses.filter((x) => x.mod === m).flatMap((x) => x.args)));
    }
    Object.assign(scope, (opts && opts.globals) || {});
    const names = Object.keys(scope);
    let fn;
    try { fn = new Function(...names, js); } catch (e) { throw toPerlError('compile', e, src, js); }
    const finish = () => { for (const m of c.mods) { const d = MODS[m]; if (d && d.finish) { try { d.finish(); } catch (e) { /* ignore */ } } } };
    try { const r = fn(...names.map((k) => scope[k])); finish(); return r; }
    catch (e) { finish(); if (e && e.exit) return; throw toPerlError('runtime', e, src, js); }
  },
  // load whatever the program needs (asynchronously, so no blocking request), then run it
  async runAsync(src, opts) { await Perl2JS.use(requires(src)); return Perl2JS.run(src, opts); },
  runtime: RT,
  // `$`: the real jQuery if the page loaded it, otherwise the built-in mini jQuery (module "jQuery")
  jq() { loadSync('jQuery'); return MODS.jQuery.scope().$; },
  // Resolve `require "lib/util.p2j";` (relative to `base`): dependencies are fetched first and
  // concatenated in front of the file, so they share one top-level scope.
  async bundle(text, base, seen) {
    seen = seen || new Set([base]);
    let out = '';
    const re = /^[ \t]*require\s+(["'])([^"']+)\1\s*;/gm;
    for (const m of text.matchAll(re)) {
      const url = new URL(m[2], base).href;
      if (seen.has(url)) continue;
      seen.add(url);
      const res = await fetch(url);
      if (res.ok === false) throw new Error('require: cannot load ' + url + ' (' + res.status + ')');
      out += await Perl2JS.bundle(await res.text(), url, seen) + '\n';
    }
    return out + text;
  },
  stdout(s) {
    if (typeof document !== 'undefined') {
      let el = document.getElementById('output');
      if (!el) { el = document.createElement('pre'); el.id = 'output'; document.body.appendChild(el); }
      el.textContent += s;
    } else if (typeof process !== 'undefined') process.stdout.write(s);
    else console.log(s);
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = Perl2JS;
else root.Perl2JS = Perl2JS;

// <script type="text/perl2js"> auto-run
if (typeof document !== 'undefined') {
  const go = async () => {
    for (const s of document.querySelectorAll('script[type="text/perl2js"]')) {
      try {
        const base = s.src ? new URL(s.src, document.baseURI).href : document.baseURI;
        const text = s.src ? await (await fetch(s.src)).text() : s.textContent;
        await Perl2JS.runAsync(await Perl2JS.bundle(text, base));
      } catch (e) { console.error(e); Perl2JS.renderError(e); }
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}

})(typeof window !== 'undefined' ? window : this);
