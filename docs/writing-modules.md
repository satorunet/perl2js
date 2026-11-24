# Writing your own module

**English** | [日本語](writing-modules.ja.md) · [Docs index](README.md)

A module is **one JavaScript file**. `use Acme::Tools qw(greet);` loads `modules/Acme/Tools.js` the first time a program asks for it (in a browser through `fetch`, in Node through `fs`), so the core never grows.

## 1. Create the file

`modules/Acme/Tools.js` (the path is the module name with `::` turned into `/`):

```js
Perl2JS.module({
  name: 'Acme::Tools',
  init(api) {
    const { mk } = api;                       // mk(array) makes a Perl list
    return {
      exports: {
        greet:    (name) => 'Hello, ' + name + '!',
        clamp:    (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
        PI:       3.14159,
        count_if: (code, ...list) => list.flat().filter((x) => code(x)).length,
        evens:    (...list) => mk(list.flat().filter((x) => x % 2 === 0)),
      },
      default:  ['greet'],                    // what a plain `use Acme::Tools;` imports
      unary:    ['greet'],                    // may be called without parentheses: greet "x"
      blockfns: { count_if: '$_' },           // takes a block:  count_if { $_ > 2 } @list
    };
  },
});
```

## 2. Use it

```perl2js
use Acme::Tools qw(greet clamp count_if evens PI);
print greet("Perl"), "\n";                      # Hello, Perl!
print clamp(15, 0, 10), " ", PI, "\n";          # 10 3.14159
my @n = (1, 2, 3, 4);
print count_if { $_ > 2 } @n;                   # 2
print "\n";
my @e = evens(1..8);
print "@e\n";                                   # 2 4 6 8
```

The table below lists everything `init` may return.

| Key | Meaning |
|---|---|
| `exports` | `{ name: value }`. Functions and constants that `use Mod qw(name)` can import. Fully qualified calls (`Acme::Tools::clamp(...)`) work too. |
| `default` | Names imported by `use Mod;` with no list. |
| `unary` | Names that take exactly one argument without parentheses (`greet "x" . "y"`). |
| `noarg` | Names that take no argument (constants such as `PI`). |
| `listops` | Names that take a whole list without parentheses (like `push`). |
| `blockfns` | `{ name: '$_' }` or `{ name: '$a, $b' }`: functions whose first argument is a block, `name { ... } @list`. The string is the block's variables. |
| `classes` | `{ 'Foo::Bar': JsClass }`: lets `Foo::Bar->new(...)` and `Foo::Bar->method` work. |
| `deps` (next to `name`) | Other modules to load first, e.g. `deps: ['List::Util']`; `api.use('List::Util')` returns them. |
| `finish()` | Called after the program finished (flush buffers, ...). |

`api` gives you: `G` (Perl globals such as `G.$Data_Dumper_Indent`), `mk` (list builder), `Lst`, `RT` (runtime helpers), `_s` (Perl's value-to-string), `hide`, `pkg` (create Perl packages), `use(name)`.

## 3. Where it is looked up

| Where | How |
|---|---|
| Next to `perl2js.js` | `modules/Acme/Tools.js` (automatic; also works from the jsDelivr CDN) |
| Somewhere else | `Perl2JS.libPath = "/my/js/"` before running (any URL ending in a directory) |
| Already loaded | a `<script>` that calls `Perl2JS.module({...})` registers the module; no fetch happens |

Modules are plain scripts: no build step, no `import`. Return Perl values (strings, numbers, arrays, plain objects); a JS array returned from a function is a Perl list/array reference.

## 4. Perl code as a library

A `.p2j` file can also `require` other Perl files: see [browser.md](browser.md#splitting-code-into-files).
