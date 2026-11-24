# Built-in functions

**English** | [日本語](functions.ja.md) · [Docs index](README.md)

Every row was run through real Perl 5.40 and Perl2JS side by side (the test is a one-line program per feature; output must be identical).
**✅** works like Perl · **🟡** works with a difference (see the note) · **➖** not implemented yet · **⛔** cannot exist in a browser.

## Strings

| Function | | Note |
|---|---|---|
| `length` `uc` `lc` `ucfirst` `lcfirst` `index` `rindex` `reverse` `join` `chr` `ord` `hex` `oct` `chomp` `chop` `quotemeta` | ✅ | |
| `substr` (2, 3 and 4 arguments, and `substr($s, 0, 1) = "x"`) | ✅ | |
| `sprintf` / `printf` (`%s %d %f %e %g %x %o %b %c %%`, flags, width, `%*d`, `%2$s`, `%vd`) | ✅ | |
| `x` (repeat), `.` (concatenate), `\U \L \u \l \E` in strings | ✅ | |
| `tr///` (ranges, counting, `d` `s` `c` `r`) | ✅ | |
| `lc` / `uc` on non-ASCII text | ✅ | |
| `length` of a UTF-8 string without `use utf8` | 🟡 | counts characters; Perl counts bytes |
| `pack` / `unpack` | ➖ | |
| `crypt`, `study`, `fc` | ➖ | |
| `format` / `write` | ➖ | |

## Numbers

| Function | | Note |
|---|---|---|
| `abs` `int` `sqrt` `sin` `cos` `atan2` `exp` `log` `hex` `oct` `rand` `srand` | ✅ | |
| `**` `%` (Perl's sign rules: `-7 % 3 == 2`) `<=>` `& \| ^ ~ << >>` `0x` `0b` `0o` `1_000` literals | ✅ | |
| integers above 2**53 | 🟡 | numbers are JavaScript doubles; `9007199254740993` prints as `9.00719925474099e+15` |
| bit operations on more than 32 bits | 🟡 | 32-bit |

## Arrays and lists

| Function | | Note |
|---|---|---|
| `push` `pop` `shift` `unshift` `splice` `reverse` `scalar` `join` `grep` `map` `sort` (block, `$a`/`$b`, `<=>`, `cmp`) | ✅ | |
| `exists` `delete` on arrays, `$#a`, `$#{$r}`, `$#a = 3`, slices `@a[1,2]`, `(list)[i]`, `@$r[0,1]` | ✅ | |
| `keys @array`, `foreach` aliasing (`$_ *= 2 for @a`), `wantarray`-free list assignment `($a, $b) = ($b, $a)` | ✅ | |
| `sort by_name LIST` (a named sub as comparator) | ➖ | write the comparison in a block: `sort { $a <=> $b } @list` |
| `each @array` | ➖ | use `for my $i (0..$#a)` |
| `wantarray` | ➖ | |
| `my $x = f();` where `f` returns a list | 🟡 | gets the whole list, Perl gets the last element |

## Hashes

| Function | | Note |
|---|---|---|
| `keys` `values` `each` `exists` `delete` `defined`, slices `@h{...}`, `delete @h{...}`, `%h = ()`, nested data, `%$ref`, `@{$h}{...}` | ✅ | |
| `local $h{key}` | ✅ | |
| `exists $h{a}{b}` creating `$h{a}` (autovivification) | 🟡 | does not create `$h{a}` |
| `%r = reverse %h` | ➖ | |
| `scalar(%h)` | ✅ | the key count, like Perl 5.26+ |

## Control flow and scope

| Feature | | Note |
|---|---|---|
| `if` `elsif` `else` `unless` `while` `until` `for (;;)` `foreach` `last` `next` `redo` | ✅ | |
| labels (`OUTER: for ... { next OUTER }`), `do {} while`, statement modifiers (`... if`, `... for`), `?:` | ✅ | |
| `my` `our` `local`, closures, recursion, `return`, implicit return | ✅ | |
| subroutine signatures (`sub f($x, $y = 10)`) | ✅ | |
| `eval { }`, `eval "string"`, `die` (string or object), `warn`, `$@` | ✅ | |
| `exit`, `sleep`, `__PACKAGE__`, `caller`-free packages, `use constant` | ✅ | |
| `state` variables | ➖ | use a `my` variable outside the sub |
| `BEGIN` / `END` blocks | ➖ | |
| `caller` | ➖ | |
| prototypes (`sub apply(&@)`) | ➖ | write `apply(sub { ... }, @list)` |
| `goto`, `given`/`when`, `format` | ➖ | |
| `do FILE`, `require FILE` | 🟡 | `require "lib/x.p2j";` pulls in another Perl2JS file ([browser](browser.md#splitting-code-into-files)) |

## Regular expressions

| Feature | | Note |
|---|---|---|
| `m//` `s///` `tr///` with `g i m s x e r` flags, captures `$1`, `$&`, `%+` (`$+{name}`), `qr//`, list-context matches | ✅ | |
| `split` (regex, limit, captures, `//`), lookahead / lookbehind, non-greedy, backreferences `\1` | ✅ | |
| any delimiter: `m@a@`, `m"a"`, `s!a!b!`, `s{a}{b}`, `qw@a b@` | ✅ | |
| `pos()`, `\G`, scalar `//g` position | ➖ | scalar `//g` loops (`while ($s =~ /x/g)`) do work |
| `` $` `` and `$'` in strings, `@-` / `@+` | ➖ | |
| recursive patterns `(?R)`, atomic groups `(?>...)`, possessive quantifiers | ➖ | JavaScript's regex engine does not have them |
| `\p{L}` unicode properties on text without `use utf8` | 🟡 | |

## Time

| Function | | Note |
|---|---|---|
| `time`, `localtime`, `gmtime` (list and scalar context) | ✅ | |
| `sleep`, `select(undef, undef, undef, $secs)` | ✅ | block the page while waiting; `sleep($secs, sub { ... })` does not block |
| `times`, `alarm` | ➖ | |

## Output

| Function | | Note |
|---|---|---|
| `print` `printf` `say` (`print;` prints `$_`), `print STDOUT`, `print STDERR` (to `console.warn`), `$,` `$\` `$|`, `binmode` | ✅ | |
| here-documents (`<<"EOT"`, `<<'EOT'`, `<<~EOT`) | ✅ | |
| `$0` | 🟡 | `main.p2j` |
| `sprintf("%.0f", 0.5)` | ✅ | exact ties round to even like C (`0 2 2` for 0.5, 1.5, 2.5) |

## References and objects

| Feature | | Note |
|---|---|---|
| `ref`, `bless`, `->isa`, `->can`, `@ISA`, `use parent`, `SUPER::`, `__PACKAGE__->method` | ✅ | |
| `\$x`, `\@a`, `\%h`, `\&f`, `$$r`, `@$r`, `%$r`, `$r->[0]`, `"$ref"` as `ARRAY(0x...)`, `==` on references | ✅ | |
| `undef $x` / `undef @a` / `undef %h`, `defined`, `local $_` | ✅ | |
| `Scalar::Util` (`blessed reftype looks_like_number refaddr`), `use constant` | ✅ | |
| `ref(\\$x)` for a reference to a reference | 🟡 | `SCALAR` (Perl: `REF`) |
| `AUTOLOAD`, `DESTROY`, `use overload`, `tie` | ➖ | |
| `\$h{k}` / `\$a[0]` (reference to an element) | ➖ | |

## Not possible in a browser

| Area | Functions |
|---|---|
| Files and directories | `open` `close` `print FH` `<FH>` `readline` `eof` `seek` `tell` `opendir` `readdir` `mkdir` `rmdir` `unlink` `rename` `stat` `lstat` `chdir` `glob` `-e -f -d -r -w -x -s` |
| Processes | `system` `exec` `fork` `wait` `waitpid` `kill` `` `backticks` `` `%SIG` `$$` `getppid` |
| Network and users | `socket` `connect` `bind` `listen` `accept` `getpwnam` `getlogin` |
| Terminal input | `<STDIN>` `getc` `read` `sysread` `syswrite` (use form fields and `$("#input")->val`) |

`%ENV` and `@ARGV` exist but are empty.

Something you need is missing? [Open an issue](https://github.com/satorunet/perl2js/issues) with a one-line program and what real Perl prints.
