/* The playground editor: syntax colors, completion, snippets, usage hints, live syntax check and Perl-friendly keys.
   The visible text is drawn by an overlay (pre.ws) under a textarea whose own text is transparent. */
(function (root) {
'use strict';

const words = (s) => new Set(s.split(/\s+/).filter(Boolean));
const KEYWORDS = words(`my our local state sub if elsif else unless while until for foreach do last next redo return use no package require
  and or not xor eq ne lt gt le ge cmp x BEGIN END try catch finally async await __PACKAGE__ __END__ __DATA__`);
const BUILTINS = words(`print printf say sprintf die warn eval defined undef delete exists ref bless wantarray scalar push pop shift unshift splice
  reverse sort map grep join split keys values each length substr index rindex uc lc ucfirst lcfirst chomp chop chr ord repeat abs int sqrt
  rand srand sin cos atan2 exp log hex oct time localtime gmtime sleep exit open close binmode readline sprintf pack unpack sprintf lock
  quotemeta pos study caller sprintf fc opendir readdir closedir mkdir unlink rename stat chdir rmdir read write seek tell eof truncate
  sprintf alarm system exec fork wait kill umask utime chmod chown link symlink readlink select printf`);
const NOARG = words('time wantarray __PACKAGE__');          // a / after these is a division

const SIG = {
  print: 'print リスト; — 出力します(改行は付きません)', say: 'say リスト; — 改行付きで出力します(use feature "say";)',
  printf: 'printf "書式", 値...; — 書式を指定して出力  %s %d %.2f %05d %-8s', sprintf: 'sprintf("書式", 値...) — 書式化した文字列を返します  %s %d %.2f %05d',
  die: 'die "メッセージ\\n"; — 例外を投げます(末尾に \\n が無いと行番号が付きます)', warn: 'warn "メッセージ\\n"; — 警告を出します',
  eval: 'eval { ... }; print $@ if $@; — 例外を捕まえます', defined: 'defined($x) — 値が undef でなければ真', undef: 'undef $x — 未定義にします',
  delete: 'delete $h{key} — キーを削除します', exists: 'exists $h{key} — キーがあるか調べます', ref: 'ref($r) — リファレンスの型 ("ARRAY" "HASH" "CODE" クラス名)',
  bless: 'bless {}, $class — リファレンスをオブジェクトにします', scalar: 'scalar(@a) — スカラーとして評価(配列なら要素数)',
  push: 'push @配列, 値...; — 末尾に追加', pop: 'pop @配列 — 末尾を取り出す', shift: 'shift @配列 — 先頭を取り出す(省略時は @_)', unshift: 'unshift @配列, 値...; — 先頭に追加',
  splice: 'splice(@配列, 開始, 個数, 差し込む値...) — 途中を削除・置換', reverse: 'reverse リスト — 逆順', sort: 'sort { $a <=> $b } リスト — 並べ替え(文字列順は cmp)',
  map: 'map { 式($_) } リスト — 各要素を変換', grep: 'grep { 条件($_) } リスト — 条件に合う要素を抽出', join: 'join("区切り", リスト) — 連結して文字列に',
  split: 'split(/パターン/, 文字列, 上限) — 分割してリストに', keys: 'keys %ハッシュ — キーの一覧', values: 'values %ハッシュ — 値の一覧',
  each: 'while (my ($k, $v) = each %h) { ... } — キーと値を順に', length: 'length($文字列) — 文字数', substr: 'substr(文字列, 開始, 長さ, 置換) — 部分文字列',
  index: 'index(文字列, 探す文字列, 開始) — 見つかった位置(無ければ -1)', rindex: 'rindex(文字列, 探す文字列) — 後ろから検索',
  uc: 'uc($s) — 大文字に', lc: 'lc($s) — 小文字に', ucfirst: 'ucfirst($s) — 先頭を大文字に', lcfirst: 'lcfirst($s) — 先頭を小文字に',
  chomp: 'chomp($s) — 末尾の改行を取り除く', chop: 'chop($s) — 末尾の1文字を取り除く', chr: 'chr(コード) — 文字に', ord: 'ord(文字) — コード番号に',
  abs: 'abs($n) — 絶対値', int: 'int($n) — 整数部', sqrt: 'sqrt($n) — 平方根', rand: 'rand($n) — 0 以上 $n 未満の乱数', time: 'time — 現在のエポック秒',
  localtime: 'localtime($t) — (秒,分,時,日,月0-11,年-1900,曜日,通日,夏時間)', sleep: 'sleep 秒; — 待ちます(画面は固まりません)',
  local: 'local $x = 値; — このブロックの間だけ値を差し替え', my: 'my $x = 値; my @a = (...); my %h = (...); — 変数の宣言',
  sub: 'sub 名前 { my ($a, $b) = @_; ... return 値 } — サブルーチン', foreach: 'foreach my $x (リスト) { ... }', for: 'for (my $i = 0; $i < 10; $i++) { ... }  /  for my $x (リスト) { ... }',
  while: 'while (条件) { ... }', until: 'until (条件) { ... } — 条件が真になるまで', if: 'if (条件) { ... } elsif (条件) { ... } else { ... }', unless: 'unless (条件) { ... } — 偽のとき',
  last: 'last; — ループを抜ける', next: 'next; — 次の繰り返しへ', wantarray: 'wantarray — 呼び出し側がリストを期待していれば真', use: 'use List::Util qw(sum max); — モジュールを読み込む',
  sum: 'sum(リスト) — 合計 (List::Util)', max: 'max(リスト) — 最大値 (List::Util)', min: 'min(リスト) — 最小値 (List::Util)', first: 'first { 条件 } リスト — 最初に合う要素 (List::Util)',
  uniq: 'uniq(リスト) — 重複を除く (List::Util)', shuffle: 'shuffle(リスト) — 並びを混ぜる (List::Util)', reduce: 'reduce { $a + $b } リスト — 畳み込み (List::Util)',
};

/* name: [label, text]  — «...» marks a placeholder (Tab goes to the next one) */
const SNIPPETS = {
  print: ['print', 'print "«Hello»\\n";'],
  my: ['変数', 'my $«name» = «value»;'],
  if: ['if', 'if («条件») {\n    «処理»\n}'],
  ifelse: ['if/else', 'if («条件») {\n    «処理»\n}\nelse {\n    «それ以外»\n}'],
  for: ['for', 'for (my $i = 0; $i < «10»; $i++) {\n    «print "$i\\n";»\n}'],
  foreach: ['foreach', 'foreach my $«item» («@list») {\n    «処理»\n}'],
  while: ['while', 'while («条件») {\n    «処理»\n}'],
  sub: ['sub', 'sub «name» {\n    my («$arg») = @_;\n    «処理»\n}'],
  array: ['配列', 'my @«list» = («1, 2, 3»);'],
  hash: ['ハッシュ', 'my %«hash» = («key» => «"value"»);'],
  eachhash: ['ハッシュを回す', 'for my $key (sort keys %«hash») {\n    print "$key: $«hash»{$key}\\n";\n}'],
  regex: ['正規表現', 'if ($«str» =~ /«(\\d+)»/) {\n    print "$1\\n";\n}'],
  eval: ['eval', 'eval {\n    «処理»\n};\nprint "error: $@" if $@;'],
  package: ['クラス', 'package «Name» {\n    sub new {\n        my ($class, %args) = @_;\n        return bless {%args}, $class;\n    }\n}'],
  heredoc: ['ヒアドキュメント', 'print <<"END";\n«本文»\nEND'],
  click: ['クリック', '$("«#id»")->on("click", sub {\n    «処理»\n});'],
};
const BAR = ['print', 'my', 'if', 'ifelse', 'for', 'foreach', 'while', 'sub', 'array', 'hash', 'eachhash', 'regex', 'eval', 'package', 'heredoc', 'click'];

/* Splits Perl into colored ranges [start, end, class]; text outside the ranges is plain.
   c comment  s string  r regex  n number  v variable  k keyword  f function  d sub name  p package / module */
function tokenize(code) {
  const out = [], n = code.length, heredocs = [], close = { '(': ')', '[': ']', '{': '}', '<': '>' };
  const add = (a, b, c) => { if (b > a) out.push([a, b, c]); };
  const find = (from, end, open) => {                          // index just after the closing delimiter, or -1
    for (let j = from, depth = 0; j < n; j++) {
      if (code[j] === '\\') j++;
      else if (open !== end && code[j] === open) depth++;
      else if (code[j] === end && depth-- === 0) return j + 1;
    }
    return -1;
  };
  const str = (a, b, interp, cls) => {                         // a string, with the variables it interpolates
    if (!interp) return add(a, b, cls);
    const re = /\\[\s\S]|[$@](?:\{\w+\}|[A-Za-z_]\w*|[0-9&])/g;
    re.lastIndex = 0;
    const s = code.slice(a, b); let m, done = 0;
    while ((m = re.exec(s))) if (m[0][0] !== '\\') { add(a + done, a + m.index, cls); add(a + m.index, a + m.index + m[0].length, 'v'); done = m.index + m[0].length; }
    add(a + done, b, cls);
  };
  let i = 0, term = true, prev = '';                           // term: a value may start here, so / begins a regex
  while (i < n) {
    const c = code[i], lineStart = i === 0 || code[i - 1] === '\n';
    let m;
    const at = (re) => { re.lastIndex = i; return re.exec(code); };
    if (c === '\n') {
      i++;
      while (heredocs.length && i < n) {                       // heredoc bodies
        let e = code.indexOf('\n', i); if (e < 0) e = n;
        const line = code.slice(i, e), h = heredocs[0];
        if ((h.indent ? line.trim() : line) === h.tag) { add(i, e, 'k'); heredocs.shift(); }
        else str(i, e, h.interp, 's');
        i = e < n && heredocs.length ? e + 1 : e;
      }
    }
    else if (/\s/.test(c)) i++;
    else if (c === '#' || c === '＃') { let e = code.indexOf('\n', i); if (e < 0) e = n; add(i, e, 'c'); i = e; }
    else if (lineStart && at(/=[a-zA-Z]/y)) {                  // POD ... =cut
      const cut = /\n=cut[^\n]*/g; cut.lastIndex = i; const k = cut.exec(code), e = k ? k.index + k[0].length : n; add(i, e, 'c'); i = e;
    }
    else if (lineStart && (m = at(/__(?:END|DATA)__\b/y))) { add(i, i + m[0].length, 'k'); add(i + m[0].length, n, 'c'); break; }
    else if ((m = at(/<<(~?)(?:"([^"\n]*)"|'([^'\n]*)'|([A-Za-z_]\w*))/y))) {
      heredocs.push({ indent: m[1] === '~', tag: m[2] ?? m[3] ?? m[4], interp: m[3] === undefined }); add(i, i + m[0].length, 'k'); i += m[0].length; term = false;
    }
    else if ((c === '$' || c === '＄' || ((c === '@' || c === '%' || c === '&') && term)) &&
             (m = at(/[$＄@%&](?:#\$?)?(?:\^[A-Z]|(?:::)?[A-Za-z_぀-ヿ一-鿿Ａ-ｚ][\w぀-ヿ一-鿿０-ｚ]*(?:::\w+)*|\d+)/y))) {
      add(i, i + m[0].length, 'v'); i += m[0].length; term = false; prev = m[0];
    }
    else if (c === '$' || c === '＄') {                        // $#{...}  $@  $!  $_  $( jQuery )
      const t = /^\$(?:\{\^\w+\}|\^[A-Z]|#(?=[{$])|[@!&0"'`\/\\,;.$+\-\]](?![A-Za-z_{]))?/.exec(code.slice(i, i + 16));
      const len = t ? t[0].length : 1; add(i, i + len, 'v'); i += len; term = false;
    }
    else if ('"\'`“‘'.includes(c) || (c === '/' && term)) {
      const re = c === '/';
      let e = find(i + 1, c === '“' ? '”' : c === '‘' ? '’' : c, c);
      if (e < 0 || (re && code.slice(i, e).includes('\n'))) { i++; term = false; continue; }
      if (re) { while (/[a-z]/.test(code[e] || '')) e++; add(i, e, 'r'); }
      else str(i, e, c !== "'" && c !== '‘', 's');
      i = e; term = false;
    }
    else if ((m = at(/(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)/y))) { add(i, i + m[0].length, 'n'); i += m[0].length; term = false; }
    else if ((m = at(/[A-Za-z_]\w*(?:::\w*)*/y))) {
      const w = m[0], a = i; i += w.length;
      const arrow = code.slice(Math.max(0, a - 2), a) === '->';
      const key = /^[ \t]*=>/.test(code.slice(i, i + 20)) || (/\{\s*$/.test(code.slice(Math.max(0, a - 8), a)) && /^\s*\}/.test(code.slice(i, i + 8)));
      term = !arrow && !key && (KEYWORDS.has(w) || (BUILTINS.has(w) && !NOARG.has(w)));
      if (key) add(a, i, 's');
      else if (/^(q|qq|qw|qx|qr|m|s|tr|y)$/.test(w) && !arrow) {
        let j = i; while (code[j] === ' ' || code[j] === '\t') j++;
        const d = code[j];
        if (d && !/[\w\s=,;)\]}>]/.test(d) && !(d === '#' && j > i)) {
          let e = find(j + 1, close[d] || d, d);
          if (e > 0 && /^(s|tr|y)$/.test(w)) {                 // second part:  s{a}{b}  or  s/a/b/
            if (close[d]) { while (/\s/.test(code[e] || '')) e++; e = find(e + 1, close[code[e]] || code[e], code[e]); }
            else e = find(e, d, d);
          }
          if (e > 0) {
            if (/^(m|s|tr|y|qr)$/.test(w)) { while (/[a-z]/.test(code[e] || '')) e++; add(a, e, 'r'); }
            else { add(a, j, 'k'); str(j, e, w === 'qq' || w === 'qx', 's'); }
            i = e;
          }
          term = false;
        }
      }
      else if (prev === 'sub') add(a, i, 'd');
      else if (arrow) add(a, i, 'f');
      else if (KEYWORDS.has(w)) add(a, i, 'k');
      else if (BUILTINS.has(w)) add(a, i, 'f');
      else if (w.includes('::') || prev === 'package' || prev === 'use' || /^->/.test(code.slice(i, i + 2))) add(a, i, 'p');
      else if (code[i] === '(') add(a, i, 'f');
      prev = w;
    }
    else { term = !/[)\]}]/.test(c); i++; }
  }
  return out;
}

const OPEN = '([{', CLOSE = ')]}';
/* positions of the bracket pair next to the caret (brackets in strings and comments don't count) */
function matchBrackets(text, pos, ranges) {
  const hidden = (k) => ranges.some((r) => k >= r[0] && k < r[1] && (r[2] === 'c' || r[2] === 's' || r[2] === 'r'));
  for (const k of [pos, pos - 1]) {
    const ch = text[k]; if (!ch || hidden(k)) continue;
    const o = OPEN.indexOf(ch), cl = CLOSE.indexOf(ch); if (o < 0 && cl < 0) continue;
    const dir = o >= 0 ? 1 : -1, mate = o >= 0 ? CLOSE[o] : OPEN[cl];
    for (let j = k + dir, depth = 0; j >= 0 && j < text.length; j += dir) {
      if ((text[j] !== ch && text[j] !== mate) || hidden(j)) continue;
      if (text[j] === ch) depth++; else if (depth-- === 0) return [k, j];
    }
  }
  return [];
}

function create({ src, overlay, unwrap, hint, bar, check }) {
  let ranges = [], base = 0, perlEnd = 0, brackets = [], stops = [], pop = null, items = [], cur = 0, moved = false, busy = false, timer = 0, problem = null;
  const esc = (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c);
  const mark = (s) => s.replace(/[ 　\t \n&<>]/g, (c) => (c === ' ' ? '<i class="h"> </i>' : c === '　' ? '<i class="f">　</i>' : c === '\t' ? '<i class="t">\t</i>' : c === ' ' ? '<i class="n"> </i>' : c === '\n' ? '<i class="e"></i>\n' : esc(c)));

  function analyze() {
    const text = src.value, { code } = unwrap(text);
    base = code === text ? 0 : text.indexOf(code, text.search(/text\/perl2js/i)); perlEnd = base + code.length;
    ranges = tokenize(code).map(([a, b, c]) => [a + base, b + base, c]);
    if (base) {                                                 // the <script> lines around the Perl
      const tags = [[0, base], [perlEnd, text.length]];
      for (const [a, b] of tags) if (b > a) ranges.push([a, b, 't']);
      ranges.sort((x, y) => x[0] - y[0]);
    }
  }
  function paint() {
    const text = src.value;
    const cuts = ranges.concat(brackets.map((k) => [k, k + 1, 'bm']));
    const points = [...new Set([0, text.length, ...cuts.flatMap((r) => [r[0], r[1]])])].sort((a, b) => a - b);
    let html = '', r = 0;
    for (let p = 0; p + 1 < points.length; p++) {
      const a = points[p], b = points[p + 1];
      while (r < ranges.length && ranges[r][1] <= a) r++;
      const cls = [ranges[r] && ranges[r][0] <= a ? 'x-' + ranges[r][2] : '', brackets.includes(a) && b === a + 1 ? 'x-bm' : ''].join(' ').trim();
      const body = mark(text.slice(a, b));
      html += cls ? '<span class="' + cls + '">' + body + '</span>' : body;
    }
    overlay.innerHTML = html + '<i class="z"></i>\n';
    overlay.scrollTop = src.scrollTop; overlay.scrollLeft = src.scrollLeft;
  }
  function render() { analyze(); brackets = document.activeElement === src ? matchBrackets(src.value, src.selectionStart, ranges) : []; paint(); }

  /* ---- editing (through execCommand so that Ctrl+Z keeps working) ---- */
  function replace(from, to, text, selFrom, selTo) {
    busy = true;
    src.focus(); src.setSelectionRange(from, to);
    let ok = false;
    try { ok = text ? document.execCommand('insertText', false, text) : from === to || document.execCommand('delete'); } catch (e) { /* old browser */ }
    if (!ok) { src.setRangeText(text, from, to, 'end'); src.dispatchEvent(new Event('input')); }
    if (selFrom !== undefined) src.setSelectionRange(selFrom, selTo === undefined ? selFrom : selTo);
    busy = false;
    caretMoved();
  }
  const lineStartOf = (p) => src.value.lastIndexOf('\n', p - 1) + 1;
  const classAt = (p) => { const r = ranges.find((x) => p > x[0] && p <= x[1]); return r ? r[2] : ''; };

  function insertSnippet(name, from, to) {
    if (from === undefined) {                                   // from the toolbar: on its own line, inside the Perl part
      from = src.selectionStart; to = src.selectionEnd;
      if (base && (from < base || from > perlEnd)) from = to = perlEnd;
    }
    const ls = lineStartOf(from), head = src.value.slice(ls, from), indent = /^[ \t]*/.exec(head)[0];
    let pre = '', post = '';
    if (head.trim()) pre = '\n' + indent;
    const rest = src.value.slice(to, (src.value + '\n').indexOf('\n', to));
    if (rest.trim()) post = '\n' + indent;
    const raw = pre + SNIPPETS[name][1].replace(/\n(?!END\b|«本文)/g, '\n' + indent) + post;
    let text = ''; const marks = [];
    raw.split(/(«[^»]*»)/).forEach((part) => { if (part[0] === '«') { const v = part.slice(1, -1); marks.push([text.length, v.length]); text += v; } else text += part; });
    replace(from, to, text);
    const len = src.value.length;
    stops = marks.map(([o, l]) => [len - (from + o), l]);       // measured from the end: typing in earlier placeholders keeps them valid
    if (!nextStop()) src.setSelectionRange(from + text.length, from + text.length);
  }
  function nextStop() {
    const s = stops.shift(); if (!s) return false;
    const a = src.value.length - s[0]; if (a < 0) { stops = []; return false; }
    src.setSelectionRange(a, a + s[1]); caretMoved(); return true;
  }

  /* ---- completion ---- */
  function rectAt(pos) {                                        // screen position of a character, measured on the overlay
    const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
    let node, left = pos;
    while ((node = walker.nextNode())) {
      if (left < node.length) { const r = document.createRange(); r.setStart(node, left); r.setEnd(node, left + 1); return r.getClientRects()[0] || r.getBoundingClientRect(); }
      left -= node.length;
    }
    return overlay.getBoundingClientRect();
  }
  function hide() { if (pop) pop.hidden = true; items = []; }
  function complete(forced) {
    const pos = src.selectionStart; if (pos !== src.selectionEnd) return hide();
    const cls = classAt(pos); if (cls === 'c' || cls === 't' || ((cls === 's' || cls === 'r') && !forced)) return hide();
    const m = /(?:[$@%]\w*|[A-Za-z_][\w:]*)$/.exec(src.value.slice(lineStartOf(pos), pos));
    const word = m ? m[0] : '';
    if (!forced && !(/^[$@%]\w+$/.test(word) || (/^[A-Za-z_]/.test(word) && word.length >= 2))) return hide();
    const from = pos - word.length, found = new Map();
    const put = (label, kind, desc) => { if (label.toLowerCase().startsWith(word.toLowerCase()) && !found.has(kind + label)) found.set(kind + label, { label, kind, desc, from }); };
    const own = ranges.filter((r) => (r[2] === 'v' || r[2] === 'd') && !(r[0] <= from && r[1] >= pos));
    if (/^[$@%]/.test(word)) {
      const names = new Map();                                  // a declared @list also offers $list[...], %h offers $h{...}
      for (const [a, b, c] of own) if (c === 'v') { const v = src.value.slice(a, b); if (/^[$@%]\w+$/.test(v)) names.set(v, 1); }
      for (const v of [...names.keys()].sort()) put(v, '変数', '');
    } else {
      for (const k of Object.keys(SNIPPETS)) put(k, 'ひな形', SNIPPETS[k][0]);
      for (const [a, b, c] of own) if (c === 'd') put(src.value.slice(a, b), 'sub', '');
      for (const k of [...KEYWORDS, ...BUILTINS, ...Object.keys(SIG)]) if (k !== word && !Object.prototype.hasOwnProperty.call(SNIPPETS, k)) put(k, '関数', (SIG[k] || '').split(' — ')[1] || '');
    }
    items = [...new Map([...found.values()].map((x) => [(x.kind === 'ひな形' ? '+' : '') + x.label, x])).values()].slice(0, 8);
    if (!items.length) return hide();
    if (!pop) {
      pop = document.createElement('div'); pop.className = 'ac'; pop.setAttribute('role', 'listbox'); document.body.appendChild(pop);
      pop.addEventListener('pointerdown', (e) => { e.preventDefault(); const row = e.target.closest('[data-i]'); if (row) accept(+row.dataset.i); });
    }
    cur = 0; moved = false; list(); pop.hidden = false;
    const r = rectAt(pos), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(4, Math.min(r.left, document.documentElement.clientWidth - w - 4)) + 'px';
    pop.style.top = (r.bottom + h + 4 > window.innerHeight ? r.top - h - 2 : r.bottom + 2) + 'px';
  }
  function list() {
    pop.textContent = '';
    items.forEach((it, i) => {
      const row = document.createElement('div'); row.dataset.i = i; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', i === cur);
      for (const [tag, t] of [['b', it.label], ['em', it.kind], ['span', it.desc]]) { const el = document.createElement(tag); el.textContent = t; row.appendChild(el); }
      pop.appendChild(row);
    });
    const foot = document.createElement('small'); foot.textContent = 'Tab で確定 · ↑↓ 選択 · Esc 閉じる'; pop.appendChild(foot);
  }
  function accept(i) {
    const it = items[i], to = src.selectionStart; hide();
    if (it.kind === 'ひな形') insertSnippet(it.label, it.from, to);
    else replace(it.from, to, it.label);
    hide();
  }

  /* ---- usage hint and syntax check ---- */
  function showHint() {
    if (!hint) return;
    const pos = src.selectionStart, ls = lineStartOf(pos), line = src.value.slice(ls, (src.value + '\n').indexOf('\n', pos));
    let name = '';
    for (const [a, b, c] of ranges) if (a >= ls && a <= pos && (c === 'f' || c === 'k')) { const w = line.slice(a - ls, b - ls); if (SIG[w]) name = w; }
    hint.classList.toggle('bad', !!problem);
    hint.textContent = problem ? '⚠ ' + (problem.line ? problem.line + ' 行目: ' : '') + problem.message
      : name ? '💡 ' + SIG[name] : '💡 Tab: 補完の確定 · Ctrl+Space: 候補 · Ctrl+/: コメント切替 · Shift+Tab: 字下げを戻す';
  }
  function scheduleCheck() {
    clearTimeout(timer); problem = null;
    if (check) timer = setTimeout(() => { problem = check(); showHint(); }, 900);
  }
  function caretMoved() {
    const next = matchBrackets(src.value, src.selectionStart, ranges);
    if (next.join() !== brackets.join()) { brackets = next; paint(); }
    showHint();
  }

  /* ---- keys ---- */
  function indentLines(dir) {
    const a = src.selectionStart, b = src.selectionEnd, ls = lineStartOf(a);
    let le = src.value.indexOf('\n', b > a && src.value[b - 1] === '\n' ? b - 1 : b); if (le < 0) le = src.value.length;
    const old = src.value.slice(ls, le).split('\n');
    const now = old.map((l) => (dir > 0 ? '    ' + l : l.replace(/^( {1,4}|\t)/, '')));
    const text = now.join('\n'), first = now[0].length - old[0].length;
    if (a === b) replace(ls, le, text, Math.max(ls, a + first)); else replace(ls, le, text, ls, ls + text.length);
  }
  function toggleComment() {
    const a = src.selectionStart, b = src.selectionEnd, ls = lineStartOf(a);
    let le = src.value.indexOf('\n', b > a && src.value[b - 1] === '\n' ? b - 1 : b); if (le < 0) le = src.value.length;
    const old = src.value.slice(ls, le).split('\n'), used = old.filter((l) => l.trim());
    const off = used.length && used.every((l) => /^\s*[#＃]/.test(l));
    const col = Math.min(...(used.length ? used : ['']).map((l) => /^[ \t]*/.exec(l)[0].length));
    const now = old.map((l) => (off ? l.replace(/^(\s*)[#＃] ?/, '$1') : l.trim() || old.length === 1 ? l.slice(0, col) + '# ' + l.slice(col) : l));
    const text = now.join('\n');
    if (a === b) replace(ls, le, text, Math.max(ls, a + now[0].length - old[0].length)); else replace(ls, le, text, ls, ls + text.length);
  }
  src.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;             // the IME is converting: leave its keys alone
    const a = src.selectionStart, b = src.selectionEnd, v = src.value, prev = v[a - 1] || '', next = v[b] || '', mod = e.ctrlKey || e.metaKey;
    const stopIt = () => e.preventDefault();
    if (items.length && !mod) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { stopIt(); cur = (cur + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; moved = true; list(); return; }
      if (e.key === 'Escape') { stopIt(); hide(); return; }
      if ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'Enter' && moved)) { stopIt(); accept(cur); return; }   // Enter only after choosing with ↑↓
    }
    if (mod && (e.key === '/' || e.code === 'Slash')) { stopIt(); hide(); toggleComment(); return; }
    if (e.ctrlKey && e.code === 'Space') { stopIt(); complete(true); return; }
    if (mod || e.altKey) return;
    if (e.key === 'Escape') { stops = []; return; }
    if (e.key === 'Tab') {
      stopIt(); hide();
      if (e.shiftKey) indentLines(-1);
      else if (stops.length && nextStop()) return;
      else if (v.slice(a, b).includes('\n')) indentLines(1);
      else replace(a, b, '    ');
      return;
    }
    if (e.key === 'Enter') {
      stopIt(); hide();
      const head = v.slice(lineStartOf(a), a), ind = /^[ \t]*/.exec(head)[0];
      const opens = /[([{]\s*(?:#.*)?$/.test(head), deeper = ind + (opens ? '    ' : '');
      if (opens && prev && next && OPEN.indexOf(prev) >= 0 && CLOSE.indexOf(next) === OPEN.indexOf(prev)) replace(a, b, '\n' + deeper + '\n' + ind, a + 1 + deeper.length);
      else replace(a, b, '\n' + deeper);
      return;
    }
    const cls = classAt(a), quiet = cls === 'c' || cls === 't';
    if (e.key === 'Backspace' && a === b && ((OPEN.includes(prev) && next === CLOSE[OPEN.indexOf(prev)]) || ((prev === '"' || prev === "'") && next === prev))) { stopIt(); replace(a - 1, a + 1, ''); return; }
    if (a === b && e.key === next && (CLOSE.includes(e.key) || ((e.key === '"' || e.key === "'") && cls === 's'))) { stopIt(); src.setSelectionRange(a + 1, a + 1); caretMoved(); return; }
    if (e.key === '}' && a === b) {                             // } on an empty line goes one level back
      const ls = lineStartOf(a), head = v.slice(ls, a);
      if (head && !head.trim()) { stopIt(); replace(ls, a, head.replace(/( {1,4}|\t)$/, '') + '}'); return; }
    }
    const pair = OPEN.includes(e.key) && e.key ? CLOSE[OPEN.indexOf(e.key)] : e.key === '"' || e.key === "'" ? e.key : '';
    if (pair && e.key.length === 1) {
      if (a !== b) { stopIt(); replace(a, b, e.key + v.slice(a, b) + pair, a + 1, b + 1); return; }
      const roomy = !next || /[\s)\]};,]/.test(next), isQuote = pair === e.key;
      if (roomy && !quiet && !(isQuote && (/[\w$\\]/.test(prev) || cls === 's' || cls === 'r'))) { stopIt(); replace(a, b, e.key + pair, a + 1); }
    }
  });
  src.addEventListener('input', (e) => {
    scheduleCheck(); showHint();
    if (!busy && !e.isComposing && (e.inputType === 'insertText' || (e.inputType === 'deleteContentBackward' && items.length))) complete(false);
    else if (!busy) hide();
  });
  src.addEventListener('keyup', (e) => { if (/^(Arrow|Home|End|Page)/.test(e.key) && !items.length) caretMoved(); });
  src.addEventListener('click', () => { hide(); stops = []; caretMoved(); });
  src.addEventListener('blur', () => { hide(); brackets = []; paint(); });
  src.addEventListener('scroll', hide);
  window.addEventListener('scroll', hide, { passive: true });

  if (bar) for (const k of BAR) {
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = SNIPPETS[k][0]; btn.title = SNIPPETS[k][1].replace(/[«»]/g, '');
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.onclick = () => { hide(); analyze(); insertSnippet(k); };
    bar.appendChild(btn);
  }

  return { render, reset() { stops = []; problem = null; clearTimeout(timer); hide(); showHint(); } };
}

const api = { tokenize, matchBrackets, create, SNIPPETS };
if (typeof module === 'object' && module.exports) module.exports = api; else root.P2JEditor = api;
})(typeof window === 'object' ? window : globalThis);
