<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo.svg">
    <img alt="Perl2JS" src="assets/logo-light.svg" width="520">
  </picture>
</p>

**Perl2JS** compiles Perl-flavoured source to JavaScript **in the browser** — no server, no WebAssembly.
Write `my $x`, `@list`, `%hash`, `->{}`, `=~ s///`, `sub`, `package`/`bless`, heredocs … and call the DOM, `console`, or the built-in jQuery-style `$("#id")` directly.

Perl風の構文で書いたコードを、**ブラウザの中でJavaScriptにコンパイルして実行**します(サーバー不要・WebAssembly不要)。

**▶ Try it:** <https://satoru.net/perlscript/>

## Quick start

```html
<script src="perl2js.js"></script>
<script type="text/perl2js">
  my $n = 0;
  $("#hello")->on("click", sub {
      $n++;
      $("#hello-n")->text(" ← ${n}回クリックされました");
  });
</script>
```

- External files: `<script type="text/perl2js" src="app.p2j"></script>` (any extension works)
- From JavaScript: `Perl2JS.run('print "hi\n"')`, `await Perl2JS.runAsync(src)`, `Perl2JS.compile(src)`
- Put `perl2js.js` and the `modules/` folder together (override with `Perl2JS.libPath = "/path/"`).
- The old names (`PerlScript`, `perlscript.js`, `type="text/perlscript"`) still work as aliases.

## Modules are loaded on demand

The core stays small (~100 KB, ~29 KB gzipped). `use List::Util qw(sum);` fetches `modules/List/Util.js` only when a program asks for it.

| | |
|---|---|
| Data / text | `Data::Dumper` `JSON::PP` `JSON` `Storable` `Text::Wrap` `Term::ANSIColor` `Encode` (UTF-8 / Shift_JIS / EUC-JP) `MIME::Base64` `URI::Escape` `Digest::MD5` `Digest::SHA` |
| Lists / types | `List::Util` `List::MoreUtils` `Scalar::Util` |
| Time | `POSIX` `Time::Local` `Time::Piece` `Time::Seconds` `Time::HiRes` `DateTime` |
| Control / testing | `Carp` `Try::Tiny` (+ Perl 5.34 `try/catch`) `Test::More` |
| Files / math | `File::Basename` `File::Spec` `Math::Trig` |
| Browser | `$("#id")` jQuery-compatible API (auto-loaded), direct access to `document` / `console` / … |

Most modules were checked against the real Perl modules (same script, same output). See the page above for the full list and what is not supported.

Write your own: one file per module, `modules/Foo/Bar.js`:

```js
Perl2JS.module({
  name: 'Foo::Bar',
  init(api) {
    return { exports: { hello: (name) => 'Hello, ' + name }, default: [], unary: ['hello'] };
  },
});
```

## Layout

```
perl2js.js        the compiler + runtime (core)
modules/          Perl modules, loaded by `use`
index.html        playground + documentation
demo.html, require-demo.html, hello.p2j, main.p2j, lib/   small examples
assets/           logo
perlscript.js     legacy name (loads perl2js.js)
```

## Known differences from Perl

- Numbers are JavaScript doubles (integers above 2^53 lose precision); they are printed like Perl (`%.15g`).
- No file / network / process I/O, no `local $|`-style special variables, no `AUTOLOAD` / `DESTROY` / `use overload`.
- Source is always treated as Unicode text (as if `use utf8`).
- List vs. scalar context is approximated, not fully tracked.
