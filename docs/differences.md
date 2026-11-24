# Differences from real Perl

**English** | [日本語](differences.ja.md) · [Docs index](README.md)

Perl2JS is a Perl-flavoured language that runs on JavaScript, not a full `perl`. It is checked against real Perl with the programs in these docs, and these are the places where it still differs.

## Numbers and strings

| Perl | Perl2JS |
|---|---|
| 64-bit integers (`9007199254740993`) | numbers are JavaScript doubles: integers above 2**53 lose precision, and the output uses Perl's `%.15g` formatting |
| `"0x10" + 0` is 0, `"1_000" + 0` is 1 | the same string-to-number rules are implemented for common cases; hex/underscore strings may differ |
| `1 << 33`, `~5` act on 64 bits | bit operations are 32-bit |
| `"az"++` is `"ba"` (magic string increment) | works for `..` ranges (`"aa".."ad"`); not for `++` on a string variable |

## References

References behave as in Perl: `\$x`, `\@a`, `\%h`, `\&f`, `$$r`, `@$r`, `%$r`, `$r->[0]`, `ref($r)` (`SCALAR ARRAY HASH CODE REF Regexp`), `"$r"` prints `ARRAY(0x55d0c8a1f000)` and `==`/`eq` compare identity, `@a = (...)` changes the array in place so earlier references see it, and `foreach` aliases the elements.

Not the same: `\$x == \$x` is false (each `\$x` makes a new reference object), and `\$h{k}` / `\$a[0]` (reference to an element) are not supported.

## Context

Perl decides list or scalar context at run time. Perl2JS decides from the shape of the code, which matches Perl in the common cases:

* works: `my ($a, $b) = f();`, `my $n = @a;`, `my $n = () = $s =~ /x/g;`, `scalar(@a)`, `if (@a)`, `print "n=" . @a`.
* does not exist: `wantarray`, so a sub cannot behave differently in list and scalar context.
* a sub that returns a list used as `my $x = f();` gets the whole list, where Perl gives the last element.

## Not implemented

`wantarray`, formats (`format STDOUT =`), `tie`, `pos()` and `\G`, `sort by_name LIST` (use a block: `sort { $a <=> $b } LIST`), `goto`, typeglobs (`*name`), `AUTOLOAD`, `DESTROY` timing, `local` on array and hash elements.
File and process functions (`open`, `opendir`, `system`, `fork`, `-e`) do not exist in a browser.
`binmode` and `STDIN` are accepted and ignored; `print STDERR` goes to `console.warn`.

## Waiting

`sleep N`, `Time::HiRes::sleep` / `usleep` and `select(undef, undef, undef, $secs)` really wait, like Perl: nothing else runs and the page does not repaint until they return. That is fine for short pauses and for output order, but for a delay that should not freeze the page use a timer:

```perl2js
print "start\n";
setTimeout(sub { print "half a second later\n" }, 500);   # the page stays responsive
sleep 1;                                                    # blocks for 1 second
print "done\n";
```

(`sleep` also works inside a `setTimeout` callback; it then blocks while that callback runs.)

## Things that are better than Perl in a browser

`$("#id")->...` (jQuery style), calling DOM and JS objects with `->` or `.`, [hybrid syntax](syntax.md#perl--javascript-hybrid), and full-width symbols (`＄ｘ ＝ （１）；`) typed with an IME are read as their half-width twins (inside strings they stay as they are).

## Names

`$_ @_ $0 $1.. $& $+{name} $@ $! $, $\ $/ $|` exist. `@ARGV` and `%ENV` are empty and `$0` is `main.p2j`.

Found a difference that is not listed? Open an issue with the smallest program that shows it and what real Perl prints.
