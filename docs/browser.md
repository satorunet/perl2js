# Using Perl2JS in the browser

**English** | [日本語](browser.ja.md) · [Docs index](README.md)

## Loading it

```html
<script src="https://cdn.jsdelivr.net/gh/satorunet/perl2js@main/perl2js.min.js"></script>
```

That one tag is the whole core. Modules (`List::Util`, `DateTime`, the jQuery-style `$`, ...) are fetched from the same place the first time a program needs them, so a page that does not use them downloads nothing extra.
Pin a release instead of `@main` once you publish one (`perl2js@v0.1.0`).

## Perl in a page

```html
<div id="out"></div>
<script type="text/perl2js">
  use List::Util qw(sum);
  my @n = (3, 1, 4);
  $("#out")->text("sum = " . sum(@n));
  print "printed text goes to <pre id=\"output\">\n";
</script>
```

* `print` writes to the element with `id="output"` (it is created at the end of `<body>` if missing).
* Put code in a file with `<script type="text/perl2js" src="main.p2j"></script>`.
* Errors are shown on the page with the Perl line number and the source line (`Perl2JS.renderError`); the browser console gets the full JavaScript error.

### Splitting code into files

`require "lib/util.p2j";` at the start of a line pulls another file in first (paths are relative to the file that requires it). All files share one top-level scope, so `sub`s defined in `lib/util.p2j` are callable from `main.p2j`. See [`main.p2j`](../main.p2j), [`lib/util.p2j`](../lib/util.p2j) and [`require-demo.html`](../require-demo.html).

## The DOM and the jQuery-style `$`

`$("#id")` is built in and returns a wrapper with the jQuery methods you expect. Chains work, callbacks are `sub { ... }`.

```perl2js
$("#stage")->html("<button id='b'>Click</button> <b id='n'>0</b>");
my $count = 0;
$("#b")->on("click", sub {
    $count++;
    $("#n")->text($count);
});
$("#stage")->fadeOut(300)->fadeIn(300);
```

| Area | Methods |
|---|---|
| Select | `$("css")  $(sub { ... })` (ready)  `find children parent closest siblings next prev eq first last filter not has is` |
| Content | `html text val attr prop data append prepend before after remove empty clone replaceWith wrap` |
| Class and style | `addClass removeClass toggleClass hasClass css show hide toggle width height` |
| Events | `on off one trigger click dblclick change input submit focus blur hover keydown keyup` |
| Effects | `fadeIn fadeOut fadeToggle slideUp slideDown slideToggle animate delay stop` |
| Iteration | `each map get length` |
| Ajax | `$->get  $->post  $->getJSON  $->ajax({ url => ..., success => sub { ... } })` |

If the page already loads the real jQuery, `$` uses that instead. Any DOM object also works directly, see the [hybrid syntax](syntax.md#perl--javascript-hybrid):

```perl2js
my $el = document.getElementById("out");
$el->{textContent} = "plain DOM";
```

## The JavaScript API

```js
Perl2JS.run(source)                  // compile and run synchronously (modules loaded earlier or from a <script>)
await Perl2JS.runAsync(source)       // loads the `use`d modules first, then runs; use this one
Perl2JS.compile(source)              // the generated JavaScript, as a string
await Perl2JS.use("List::Util", "DateTime")   // preload modules
Perl2JS.requires(source)             // module names a program uses
Perl2JS.stdout = (text) => { ... }   // where print goes (default: #output / process.stdout)
Perl2JS.libPath = "/js/modules/"     // where modules are loaded from (default: next to perl2js.js)
Perl2JS.notes                        // hints from the last compile (full-width symbols that were read as half-width)
Perl2JS.renderError(err, el, { dark: true })   // show a PerlError in an element
```

Runtime errors are `PerlError` objects with `.kind` (`compile` / `runtime`), `.line` (the Perl line), the message and source excerpt; `Perl2JS.errorText(err)` formats them as plain text.

## The playground

[satoru.net/perl2js](https://satoru.net/perl2js/) has an editor with line numbers, a DevTools-style console, a "generated JS" tab, copy buttons and about 30 runnable examples. `Ctrl+Enter` runs the program. Every example has a stable link, e.g. `https://satoru.net/perl2js/#fizzbuzz` (the 🔗 button copies the current one): `hello fizzbuzz word-count closures nested-data regex hybrid jquery-counter jquery-todo jquery-dom jquery-effects jquery-ajax heredoc oop strict-tr data-dumper local error-demo datetime time-piece datetime-module list-util json-pp try-tiny test-more text-encode error-handling`. The `#stage` area below it is where the DOM examples draw.

## In Node.js

```js
const Perl2JS = require("./perl2js.js");
Perl2JS.run('print "Hello from Node\\n"; use List::Util qw(max); print max(1, 7, 3), "\\n";');
```

Modules are read from the `modules/` directory next to the file with `fs`; no DOM, so `$`/`document` are not available.
