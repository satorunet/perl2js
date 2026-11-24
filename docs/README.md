# Perl2JS documentation

**English** | [日本語](README.ja.md) · [Playground](https://satoru.net/perl2js/) · [GitHub](https://github.com/satorunet/perl2js)

Perl2JS compiles Perl syntax to JavaScript **in the browser**. No server, no WebAssembly.
Every `perl` code block in these pages is run through real Perl 5.40 and Perl2JS in CI-style checks (`node tools/verify-docs.js docs/*.md`), and the output must be identical.

| I want to... | Read |
|---|---|
| see which Perl syntax works, with examples | **[Supported syntax](syntax.md)** |
| see which built-in functions work (and which do not) | **[Built-in functions](functions.md)** |
| mix Perl and JavaScript (`Math.max`, `document.getElementById`, `alert`) | [Perl + JavaScript hybrid](syntax.md#perl--javascript-hybrid) |
| use `List::Util`, `JSON::PP`, `POSIX`, `DateTime`... | **[Bundled modules](modules.md)** |
| check whether a popular CPAN module is available | **[Popular CPAN modules: status](cpan.md)** |
| write my own module (`use Foo::Bar`) | **[Writing your own module](writing-modules.md)** |
| put it on a web page, use the DOM and jQuery-style `$` | [Using it in the browser](browser.md) |
| know what behaves differently from real Perl | [Differences from Perl](differences.md) |

## The 30-second version

```html
<script src="https://cdn.jsdelivr.net/gh/satorunet/perl2js@main/perl2js.min.js"></script>
<script type="text/perl2js">
  my @langs = qw(Perl JavaScript);
  for my $l (@langs) { print "Hello, $l!\n"; }
  $("#out")->text("done");            # jQuery-style DOM, built in
</script>
```

The core (`perl2js.js`) is small on purpose. Everything else (`List::Util`, `DateTime`, jQuery-style `$`, ...) is a separate file in [`modules/`](../modules) that is downloaded the first time a program says `use ...`.
