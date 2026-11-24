#!/usr/bin/env node
// Builds docs/*.html (the site version of the docs) from docs/*.md.
//   npm i marked@12   (once, anywhere: `NODE_PATH=/path/to/node_modules node tools/build-docs.js` also works)
//   node tools/build-docs.js
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const DOCS = path.join(__dirname, '..', 'docs');
const V = '20261124n';                                   // cache-buster for assets, same as index.html

// side menu: groups of pages (file name without .md)
const GROUPS = {
  en: [
    ['Start', [['README', 'Overview']]],
    ['The language', [['syntax', 'Supported syntax'], ['functions', 'Built-in functions'], ['differences', 'Differences from Perl']]],
    ['Modules', [['modules', 'Bundled modules'], ['cpan', 'Popular CPAN modules'], ['writing-modules', 'Write your own module']]],
    ['Use it', [['browser', 'In the browser']]],
  ],
  ja: [
    ['はじめに', [['README', '概要']]],
    ['言語', [['syntax', '対応している構文'], ['functions', '組み込み関数'], ['differences', 'Perl との違い']]],
    ['モジュール', [['modules', '同梱モジュール'], ['cpan', '人気のCPANモジュール'], ['writing-modules', '自分でモジュールを作る']]],
    ['使い方', [['browser', 'ブラウザで使う']]],
  ],
};
const T = {
  en: { home: 'Playground', docs: 'Docs', lang: '日本語', footer: 'Source and issues:', toc: 'On this page', menu: 'Menu', contents: 'Contents', copy: 'Copy', copied: 'Copied ✓', run: 'Open in playground' },
  ja: { home: 'プレイグラウンド', docs: 'ドキュメント', lang: 'English', footer: 'ソースコード・Issue:', toc: 'このページの内容', menu: 'メニュー', contents: '目次', copy: 'コピー', copied: 'コピーしました ✓', run: 'プレイグラウンドで開く' },
};

const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^\p{L}\p{N}\- _]/gu, '').trim().replace(/ /g, '-');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function render(md, lang) {
  const toc = [];
  const r = new marked.Renderer();
  r.heading = function (text, level, raw) {
    const id = slug(raw);
    if (level === 2) toc.push({ id, text: raw });
    return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${text}</h${level}>\n`;
  };
  r.code = function (code, info) {
    const l = (info || '').trim();
    const label = l === 'perl2js' ? 'Perl2JS' : l === 'perl' ? 'Perl' : l === 'js' ? 'JavaScript' : l === 'html' ? 'HTML' : l;
    return `<div class="code"><div class="code-bar"><span class="lang">${esc(label)}</span><button class="copy" type="button">${T[lang].copy}</button></div><pre><code>${esc(code)}</code></pre></div>\n`;
  };
  r.link = function (href, title, text) {
    let h = href;
    if (/^[\w./-]+\.md(#.*)?$/.test(h) && !h.startsWith('http')) {
      const m = /^(.*?)\.md(#.*)?$/.exec(h);
      h = (m[1].startsWith('..') ? m[1] + '.md' : m[1] + '.html') + (m[2] || '');
      if (m[1] === '../README' || m[1] === '../README.ja') h = 'https://github.com/satorunet/perl2js/blob/main/' + m[1].slice(3) + '.md';
    } else if (/^\.\.\//.test(h)) h = 'https://github.com/satorunet/perl2js/blob/main/' + h.slice(3);
    const ext = /^https?:/.test(h);
    return `<a href="${esc(h)}"${title ? ` title="${esc(title)}"` : ''}${ext ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
  };
  r.table = function (header, body) { return `<div class="tablewrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`; };
  const html = marked.parse(md, { renderer: r, gfm: true, mangle: false, headerIds: false });
  return { html, toc };
}

function headingsOf(name, lang) {
  const file = path.join(DOCS, name + (lang === 'ja' ? '.ja' : '') + '.md');
  if (!fs.existsSync(file)) return [];
  const out = []; let fence = false;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (/^```/.test(line)) fence = !fence;
    const m = !fence && /^##\s+(.+)$/.exec(line);
    if (m) out.push({ id: slug(m[1]), text: m[1].replace(/`/g, '') });
  }
  return out;
}

function sidebar(name, lang) {
  const t = T[lang], sfx = lang === 'ja' ? '.ja' : '';
  let h = `<nav class="side" aria-label="${t.contents}"><div class="side-title">${t.contents}</div>`;
  for (const [g, pages] of GROUPS[lang]) {
    h += `<div class="grp">${esc(g)}</div>`;
    for (const [n, label] of pages) {
      if (!fs.existsSync(path.join(DOCS, n + sfx + '.md'))) continue;
      const cur = n === name;
      const heads = headingsOf(n, lang);
      h += `<details class="pg"${cur ? ' open' : ''}><summary><a href="${n}${sfx}.html"${cur ? ' aria-current="page"' : ''}>${esc(label)}</a></summary>`;
      if (heads.length) h += '<ul>' + heads.map((x) => `<li><a href="${n}${sfx}.html#${x.id}">${esc(x.text)}</a></li>`).join('') + '</ul>';
      h += '</details>';
    }
  }
  h += `<div class="side-links"><a href="../">${t.home}</a><a href="https://github.com/satorunet/perl2js" target="_blank" rel="noopener">GitHub</a></div>`;
  return h + '</nav>';
}

function page(name, lang) {
  const file = path.join(DOCS, name + (lang === 'ja' ? '.ja' : '') + '.md');
  if (!fs.existsSync(file)) return null;
  let md = fs.readFileSync(file, 'utf8');
  const title = (/^#\s+(.+)$/m.exec(md) || [, name])[1];
  md = md.replace(/^#\s+.+\n/, '');                                  // the H1 goes into the page header
  md = md.replace(/^\*\*English\*\*.*\n|^\[English\].*\n/m, '');       // the language line is replaced by the switch in the header
  const { html, toc } = render(md, lang);
  const t = T[lang];
  const other = lang === 'en' ? name + '.ja.html' : name + '.html';
  const otherExists = fs.existsSync(path.join(DOCS, name + (lang === 'en' ? '.ja' : '') + '.md'));
  const side = sidebar(name, lang);
  const desc = (/^([^#\n|`\-*>\[].{30,200})$/m.exec(md) || [, ''])[1].replace(/[*`\[\]]/g, '').slice(0, 160);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Perl2JS</title>
<meta name="description" content="${esc(desc)}">
<link rel="icon" href="../assets/icon.svg?v=${V}" type="image/svg+xml">
<link rel="stylesheet" href="docs.css?v=${V}">
</head>
<body>
<header class="top">
  <a class="brand" href="./${lang === 'ja' ? 'README.ja.html' : 'README.html'}"><picture><source srcset="../assets/logo.svg?v=${V}" media="(prefers-color-scheme: dark)"><img src="../assets/logo-light.svg?v=${V}" alt="Perl2JS" height="34"></picture></a>
  <button class="menu" type="button" aria-label="${t.menu}" aria-expanded="false">☰ ${t.menu}</button>
  <span class="sp"></span>
  <a class="pill opt" href="../">${t.home}</a>
  ${otherExists ? `<a class="pill" href="${other}" hreflang="${lang === 'en' ? 'ja' : 'en'}">${t.lang}</a>` : ''}
  <a class="pill opt" href="https://github.com/satorunet/perl2js" target="_blank" rel="noopener">GitHub</a>
</header>
<div class="layout">
${side}
<main>
<h1>${esc(title)}</h1>
${html}
<footer>${t.footer} <a href="https://github.com/satorunet/perl2js" target="_blank" rel="noopener">github.com/satorunet/perl2js</a></footer>
</main>
</div>
<script>
(function () {                                              // mobile menu + highlight the section being read
  var b = document.querySelector('button.menu'), side = document.querySelector('nav.side');
  b.addEventListener('click', function () { var o = side.classList.toggle('open'); b.setAttribute('aria-expanded', o); });
  side.addEventListener('click', function (e) { if (e.target.closest('li a')) side.classList.remove('open'); });
  var links = [].slice.call(side.querySelectorAll('details[open] li a')), heads = links.map(function (a) { return document.getElementById(decodeURIComponent(a.hash.slice(1))); });
  function spy() { var y = window.scrollY + 90, cur = -1; heads.forEach(function (h, i) { if (h && h.offsetTop <= y) cur = i; }); links.forEach(function (a, i) { a.classList.toggle('on', i === cur); }); }
  window.addEventListener('scroll', spy, { passive: true }); spy();
  var on = side.querySelector('a[aria-current]'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
})();
document.querySelectorAll('.code .copy').forEach(function (b) {
  b.addEventListener('click', function () {
    var text = b.closest('.code').querySelector('code').textContent;
    var done = function () { var o = b.textContent; b.textContent = ${JSON.stringify(t.copied)}; setTimeout(function () { b.textContent = o; }, 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
  });
});
</script>
</body>
</html>
`;
}

let n = 0;
for (const f of fs.readdirSync(DOCS)) {
  const m = /^(.+?)(\.ja)?\.md$/.exec(f);
  if (!m) continue;
  const out = page(m[1], m[2] ? 'ja' : 'en');
  if (out) { fs.writeFileSync(path.join(DOCS, m[1] + (m[2] || '') + '.html'), out); n++; }
}
console.log('built ' + n + ' pages');
