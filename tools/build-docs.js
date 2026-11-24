#!/usr/bin/env node
// Builds docs/*.html (the site version of the docs) from docs/*.md.
//   npm i marked@12   (once, anywhere: `NODE_PATH=/path/to/node_modules node tools/build-docs.js` also works)
//   node tools/build-docs.js
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const DOCS = path.join(__dirname, '..', 'docs');
const V = '20261124f';                                   // cache-buster for assets, same as index.html

const NAV = {
  en: [['README', 'Overview'], ['syntax', 'Syntax'], ['modules', 'Modules'], ['cpan', 'CPAN status'], ['writing-modules', 'Write a module'], ['browser', 'Browser'], ['differences', 'Differences']],
  ja: [['README', '概要'], ['syntax', '構文'], ['modules', 'モジュール'], ['cpan', 'CPAN 対応状況'], ['writing-modules', 'モジュールを作る'], ['browser', 'ブラウザで使う'], ['differences', 'Perl との違い']],
};
const T = {
  en: { home: 'Playground', docs: 'Docs', lang: '日本語', footer: 'Source and issues:', toc: 'On this page', copy: 'Copy', copied: 'Copied ✓', run: 'Open in playground' },
  ja: { home: 'プレイグラウンド', docs: 'ドキュメント', lang: 'English', footer: 'ソースコード・Issue:', toc: 'このページの内容', copy: 'コピー', copied: 'コピーしました ✓', run: 'プレイグラウンドで開く' },
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
  const nav = NAV[lang].map(([n, label]) => `<a href="${n}${lang === 'ja' ? '.ja' : ''}.html"${n === name ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  const tocHtml = toc.length > 2 ? `<nav class="toc" aria-label="${t.toc}"><b>${t.toc}</b>${toc.map((x) => `<a href="#${x.id}">${esc(x.text)}</a>`).join('')}</nav>` : '';
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
  <nav class="main">${nav}</nav>
  <span class="sp"></span>
  <a class="pill" href="../">${t.home}</a>
  ${otherExists ? `<a class="pill" href="${other}" hreflang="${lang === 'en' ? 'ja' : 'en'}">${t.lang}</a>` : ''}
  <a class="pill" href="https://github.com/satorunet/perl2js" target="_blank" rel="noopener">GitHub</a>
</header>
<div class="layout">
<main>
<h1>${esc(title)}</h1>
${html}
<footer>${t.footer} <a href="https://github.com/satorunet/perl2js" target="_blank" rel="noopener">github.com/satorunet/perl2js</a></footer>
</main>
${tocHtml}
</div>
<script>
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
