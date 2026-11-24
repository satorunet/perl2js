<p align="center">
  <img alt="Dromi, the Perl2JS camel" src="assets/mascot.svg" width="230"><br>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo.svg">
    <img alt="Perl2JS" src="assets/logo-light.svg" width="520">
  </picture>
</p>

<p align="center"><b>English</b> | <a href="README.ja.md">日本語</a></p>

**Perl2JS** compiles Perl-flavoured source to JavaScript **in the browser** — no server, no WebAssembly.
Write `my $x`, `@list`, `%hash`, `->{}`, `=~ s///`, `sub`, `package`/`bless`, heredocs … and call the DOM, `console`, or the built-in jQuery-style `$("#id")` directly.

**▶ Try it:** <https://satoru.net/perl2js/> (playground with 26 examples)

## Quick start

Drop this into any HTML page. `print` writes into `<pre id="output">` (created automatically if the page has none).

```html
<script src="perl2js.js"></script>
<script type="text/perl2js">
  use strict;
  use warnings;
  use List::Util qw(sum max);

  my %stock = (apple => 3, banana => 5, cherry => 2);

  # sort the fruit by quantity, biggest first
  for my $name (sort { $stock{$b} <=> $stock{$a} } keys %stock) {
      printf "%-8s %s\n", $name, "#" x $stock{$name};
  }

  my @words = map { ucfirst lc } qw(hELLO wORLD from PERL2JS);
  print join(" ", @words), "!\n";

  print "total: ", sum(values %stock), "  max: ", max(values %stock), "\n";

  if ("2026-11-24" =~ /^(\d+)-(\d+)-(\d+)$/) {
      print "year $1, month $2, day $3\n";
  }
</script>
```

```
banana   #####
apple    ###
cherry   ##
Hello World From Perl2js!
total: 10  max: 5
year 2026, month 11, day 24
```

### Talk to the page (jQuery-style)

```html
<script type="text/perl2js">
  my $n = 0;
  $("#hello")->on("click", sub {
      $n++;
      $("#hello-n")->text(" clicked ${n} times");
  });
</script>
```

### More ways to run code

- External files: `<script type="text/perl2js" src="app.p2j"></script>` (any extension works; `require "lib/util.p2j";` pulls in other files)
- From JavaScript: `Perl2JS.run('print "hi\n"')`, `await Perl2JS.runAsync(src)`, `Perl2JS.compile(src)` (returns the generated JS)
- Node.js: `const Perl2JS = require('./perl2js.js'); Perl2JS.run(src);`
- Put `perl2js.js` and the `modules/` folder together (override with `Perl2JS.libPath = "/path/"`).
- Needs a modern browser (ES2021).

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

Most modules were checked against the real Perl modules (same script, same output). The page above lists everything that is supported, partly supported, or out of scope in a browser.

Write your own — one file per module, `modules/Foo/Bar.js`:

```js
Perl2JS.module({
  name: 'Foo::Bar',
  init(api) {
    return { exports: { hello: (name) => 'Hello, ' + name }, default: [], unary: ['hello'] };
  },
});
```

## How it works

Perl source → tokens → token-level rewrites (statement modifiers, implicit returns, `try`, …) → JavaScript source → `new Function`.
Scalars, arrays and hashes keep their sigils in the generated names (`$x`, `_a$list`, `_h$map`), so the output is easy to read.
Errors show the Perl line number, a source excerpt and a hint, both in the console and on the page.

## Layout

```
perl2js.js        the compiler + runtime (core)
modules/          Perl modules, loaded by `use`
index.html        playground + documentation
demo.html, require-demo.html, hello.p2j, main.p2j, lib/   small examples
assets/           logo, mascot
```

## Mascot

**Dromi** is the Perl2JS camel: a hump with a `$` badge and a saddle blanket with `»` (Perl → JS).
It is an original character — not the O'Reilly "Perl camel" artwork, which is O'Reilly Media's trademark.

## Known differences from Perl

- Numbers are JavaScript doubles (integers above 2^53 lose precision); they are printed like Perl (`%.15g`).
- No file / network / process I/O, no `AUTOLOAD` / `DESTROY` / `use overload`.
- Source is always treated as Unicode text (as if `use utf8`).
- List vs. scalar context is approximated, not fully tracked.
