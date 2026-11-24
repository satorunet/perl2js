# Modules

**English** | [日本語](modules.ja.md) · [Docs index](README.md)

Modules are separate files in [`modules/`](../modules). `use List::Util qw(sum);` loads `modules/List/Util.js` the first time a program asks for it,
so the core stays small. Everything below was compared with the real Perl modules (`perl 5.40`) where they are installed:
every `perl` block on this page runs identically under real Perl and Perl2JS (`node tools/verify-docs.js docs/modules.md`).

| Group | Modules |
|---|---|
| [Lists and types](#lists-and-types) | `List::Util` `List::MoreUtils` `Scalar::Util` |
| [Data and text](#data-and-text) | `Data::Dumper` `JSON::PP` `JSON` `Storable` `Text::Wrap` `Term::ANSIColor` |
| [Encoding and hashing](#encoding-and-hashing) | `Encode` `MIME::Base64` `URI::Escape` `Digest::MD5` `Digest::SHA` |
| [Time](#time) | `POSIX` `Time::Local` `Time::Piece` `Time::Seconds` `Time::HiRes` `DateTime` |
| [Control and testing](#control-and-testing) | `Carp` `Try::Tiny` `Test::More` `constant` |
| [Files and math](#files-and-math) | `File::Basename` `File::Spec` `Math::Trig` |
| Browser | [jQuery-style `$`](browser.md#the-dom-and-the-jquery-style) |

Not available in a browser (no files, processes or sockets): `Getopt::Long`, `Cwd`, `File::Temp`, `IO::File`, `Socket`, `DBI`, `LWP::UserAgent` (use `$->get/post/ajax` instead).
Not implemented yet: `Moose`/`Moo`, `Text::CSV`, `YAML`, `Benchmark`.

How imports work: `use Module qw(a b);` imports `a` and `b`; `use Module;` imports the module's default list; `use Module ();` imports nothing.
Fully qualified calls (`POSIX::floor(2.5)`) work for every function a loaded module provides.

## Lists and types

### List::Util

`sum sum0 product min max minstr maxstr first any all none notall reduce reductions shuffle sample uniq uniqnum uniqint pairs unpairs pairkeys pairvalues pairmap pairgrep pairfirst head tail zip mesh`

```perl
use List::Util qw(sum sum0 product min max first any all none reduce uniq pairs pairkeys pairvalues pairmap head tail);

my @n = (3, 1, 4, 1, 5, 9, 2, 6);
print "sum=", sum(@n), " sum0()=", sum0(), " product=", product(1..5), " min=", min(@n), " max=", max(@n), "\n";
print "first > 4: ", (first { $_ > 4 } @n), "\n";
print "any 9: ", ((any { $_ == 9 } @n) ? "yes" : "no"), ", all > 0: ", ((all { $_ > 0 } @n) ? "yes" : "no"), ", none > 10: ", ((none { $_ > 10 } @n) ? "yes" : "no"), "\n";
print "reduce: ", (reduce { $a * $b } 1..6), ", longest: ", (reduce { length($a) >= length($b) ? $a : $b } qw(aa bbbb cc dddd)), "\n";
print "uniq: @{[ uniq @n ]}, count: ", scalar(uniq @n), "\n";
print "pairs: ", join(";", map { $_->key . "=" . $_->value } pairs(a => 1, b => 2)), "\n";
my @joined = pairmap { "$a-$b" } (x => 1, y => 2);
print "pairkeys: @{[ pairkeys(a => 1, b => 2) ]}, pairvalues: @{[ pairvalues(a => 1, b => 2) ]}, pairmap: @joined\n";
print "head/tail: @{[ head(3, @n) ]} | @{[ tail(2, @n) ]}\n";
print "0.1+0.2+0.3 = ", sum(0.1, 0.2, 0.3), "\n";
```

`sum` and friends return `undef` for an empty list (`sum0` returns 0). Blocks for `first any all none notall` use `$_`; blocks for `reduce reductions pairmap pairgrep pairfirst` use `$a` and `$b`.

### List::MoreUtils (subset)

`uniq distinct any all none notall firstidx first_index lastidx last_index indexes firstval first_value lastval last_value true false minmax part apply after before`.
`zip`, `natatime` and `pairwise` are not implemented. (Not verified against real Perl: the module is not installed here.)

```perl2js
use List::MoreUtils qw(firstidx indexes minmax uniq);
my @a = (5, 3, 9, 3, 7);
print firstidx { $_ == 9 } @a;                 # 2
print join(",", indexes { $_ == 3 } @a), "\n"; # 1,3
my ($lo, $hi) = minmax @a;
```

### Scalar::Util

`blessed reftype looks_like_number refaddr weaken` (`weaken` does nothing: JavaScript has a garbage collector).

```perl
use Scalar::Util qw(blessed reftype looks_like_number);
my $obj = bless {}, 'Foo';
print "blessed: ", blessed($obj), ", of a plain hash: ", (defined blessed({}) ? "?" : "undef"), "\n";
print "reftype: ", join(",", reftype($obj), reftype([]), reftype(sub {})), "\n";
print join(",", map { looks_like_number($_) ? "num" : "str" } (1, "2.5", "abc", "1e3", " 3 ", "", "-7", ".5")), "\n";
```

## Data and text

### Data::Dumper

Same layout as the real module, including `bless( {...}, 'Class' )`. Settings: `$Data::Dumper::Indent` (0, 1, 2), `Sortkeys`, `Terse`.

```perl
use Data::Dumper;
$Data::Dumper::Sortkeys = 1;
print Dumper({ name => "Ann", langs => ["Perl", "JS"], pos => { x => 3 }, memo => undef, score => 3.5 });
{
    local $Data::Dumper::Indent = 1;
    local $Data::Dumper::Terse  = 1;
    print Dumper([1, "two", { three => 3 }]);
}
```

One difference: JavaScript has no separate integer/float types, so `3.0` is dumped as `3` where Perl writes `'3'`.

### JSON::PP, JSON

`encode_json decode_json`, and the object interface `JSON::PP->new->pretty->canonical->encode(...)` (options `pretty indent space_before space_after canonical ascii utf8 allow_blessed convert_blessed`).
`JSON` adds `to_json`/`from_json`; `JSON::XS` and `JSON::MaybeXS` are aliases. `pretty` indents by 3 spaces like the real module.
JSON `true`/`false` decode to `1`/`0`.

```perl
use JSON::PP;
my $json = JSON::PP->new->canonical->pretty;
print $json->encode({ name => "Ann", langs => ["Perl", "JS"], pos => { x => 3, y => 4 }, memo => undef, score => 3.5 });
print encode_json([1, "two", { three => 3 }]), "\n";
my $back = decode_json('{"list":[1,2,{"k":"v"}],"ok":true,"n":null,"pi":3.14}');
print "list[2]{k}=$back->{list}[2]{k} ok=$back->{ok} pi=$back->{pi} n=", (defined $back->{n} ? "def" : "undef"), "\n";
```

### Storable

`dclone` (deep copy; keeps `bless` and cycles), `freeze`, `thaw`. `store`/`retrieve` (files) are not available.

```perl
use Storable qw(dclone);
my $orig = { a => [1, 2, { b => 3 }], c => "x" };
my $copy = dclone($orig);
$copy->{a}[2]{b} = 99;
push @{ $copy->{a} }, 4;
print "orig: $orig->{a}[2]{b} (", scalar(@{ $orig->{a} }), " items), copy: $copy->{a}[2]{b} (", scalar(@{ $copy->{a} }), " items)\n";
```

### Text::Wrap

`wrap` and `fill`, a port of the real algorithm: `$Text::Wrap::columns`, `huge` (`wrap`, `overflow`, `die`), `unexpand`, `tabstop`, `separator`, `break`.

```perl
use Text::Wrap qw(wrap fill);
$Text::Wrap::columns = 36;
print wrap("* ", "  ", "The quick brown fox jumps over the lazy dog and keeps running through the forest."), "\n";
$Text::Wrap::huge = 'overflow';
print wrap("> ", "> ", "short words and aVeryLongWordThatCannotFitOnOneLine end"), "\n";
```

### Term::ANSIColor

`color colored colorstrip uncolor colorvalid` and the constants (`use Term::ANSIColor qw(:constants);` gives `RED`, `BOLD`, `RESET`, ...). The playground's output pane does not interpret the escape codes.

```perl
use Term::ANSIColor qw(color colored colorstrip uncolor);
print join("|", map { sprintf "%vd", $_ } color("bold red"), colored("hi", "green")), "\n";
print colorstrip("\e[1mbold\e[0m plain"), " ", join(",", uncolor("1;31")), "\n";
```

## Encoding and hashing

### Encode

`encode decode encode_utf8 decode_utf8 find_encoding is_utf8`. Encodings: UTF-8, latin1/ISO-8859-1, ASCII, UTF-16 (LE/BE), **Shift_JIS** (`shiftjis`, `sjis`, `cp932`), **EUC-JP**; ISO-2022-JP can be decoded.
"Byte strings" are strings whose characters are all below 256, as in Perl.

```perl
use utf8;
use Encode qw(encode decode);
my $bytes = encode("UTF-8", "日本語");
print length($bytes), " bytes: ", join(" ", map { sprintf "%02x", ord } split //, $bytes), "\n";
print "round trip: ", (decode("UTF-8", $bytes) eq "日本語" ? "ok" : "bad"), "\n";
print "Shift_JIS: ", join(" ", map { sprintf "%02x", ord } split //, encode("shiftjis", "あいう")), "\n";
print "EUC-JP: ", join(" ", map { sprintf "%02x", ord } split //, encode("euc-jp", "あいう")), "\n";
print "decoded: ", decode("shiftjis", encode("shiftjis", "漢字")), "\n";
```

### MIME::Base64, URI::Escape

```perl
use MIME::Base64 qw(encode_base64 decode_base64);
use URI::Escape qw(uri_escape uri_unescape);
print encode_base64("Hello, World!"), encode_base64("Hello", ""), "|", decode_base64("SGVsbG8sIFdvcmxkIQ=="), "\n";
print uri_escape("a b&c=d/?~"), " | ", uri_unescape("a%20b%2Bc%41"), "\n";
```

`uri_unescape` returns bytes (like the real module): for UTF-8 text pass the result through `Encode::decode_utf8`.

### Digest::MD5, Digest::SHA

`md5 md5_hex md5_base64`, `sha1 sha256` (each with `_hex` and `_base64`), `hmac_sha1 hmac_sha256` (same suffixes), and the object interface `Digest::MD5->new->add(...)->hexdigest`. SHA-512 is not implemented.

```perl
use Digest::MD5 qw(md5_hex);
use Digest::SHA qw(sha1_hex sha256_hex hmac_sha256_hex);
print md5_hex("hello"), "\n", sha1_hex("hello"), "\n", sha256_hex("hello"), "\n";
print hmac_sha256_hex("data", "key"), "\n";
print Digest::MD5->new->add("hel", "lo")->hexdigest, "\n";
```

## Time

Everything is compared with real Perl in the `Asia/Tokyo` zone; the time zone of the browser is used when you run it yourself.

### Built-ins, POSIX, Time::Local

`localtime`/`gmtime` return the 9-element list in list context and a string such as `Thu Jan  1 09:00:00 1970` in scalar context.
POSIX provides `strftime mktime difftime floor ceil fmod pow round trunc` and constants like `INT_MAX` `DBL_MAX`.
Time::Local provides `timelocal` and `timegm`.

```perl
use POSIX qw(strftime floor ceil fmod);
use Time::Local;

my $t = 1795000000;
my ($sec, $min, $hour, $mday, $mon, $year, $wday, $yday) = localtime($t);
printf "%04d-%02d-%02d %02d:%02d:%02d wday=%d yday=%d\n", $year + 1900, $mon + 1, $mday, $hour, $min, $sec, $wday, $yday;
print scalar(localtime($t)), " | ", scalar(gmtime(0)), "\n";
print strftime("%Y-%m-%d %H:%M:%S %a %A %b %B %j", localtime($t)), "\n";
print timelocal(0, 30, 12, 24, 10, 2026), " ", timegm(0, 0, 0, 1, 0, 100), "\n";
print floor(-3.5), " ", ceil(3.2), " ", fmod(10, 3), " ", POSIX::floor(2.7), "\n";
print "year: ", (localtime($t))[5] + 1900, "\n";
```

### Time::Piece, Time::Seconds

`localtime`/`gmtime` return objects. Methods: `ymd hms datetime date time year mon monname month fullmonth mday hour min sec wday wdayname day fullday yday week epoch strftime add_months add_years truncate julian_day mjd is_leap_year month_last_day tzoffset` and `Time::Piece->strptime`.
`$t + ONE_DAY` and `$t2 - $t1` work; the difference has `->days ->hours ->minutes ->pretty`.

```perl
use Time::Piece;
use Time::Seconds;

my $t = gmtime(1795000000);
print $t->ymd, " ", $t->hms, " ", $t->monname, " ", $t->fullday, " week ", $t->week, " epoch ", $t->epoch, "\n";
print $t->strftime("%Y/%m/%d %H:%M"), " | ", ($t + ONE_DAY * 3)->ymd, "\n";
my $p = Time::Piece->strptime("2026-03-15 13:45:10", "%Y-%m-%d %H:%M:%S");
my $d = ($t + ONE_DAY * 3) - $t;
print $p->epoch, " ", $p->mdy("/"), " ", ($p->is_leap_year ? "leap" : "common"), " ", $p->month_last_day, " | ", $d->days, " days = ", $d->pretty, "\n";
print $p->add_months(11)->ymd, " ", $p->add_years(-1)->ymd, "\n";
```

### Time::HiRes

`time` (fractional seconds), `gettimeofday`, `tv_interval`, and `sleep` / `usleep` / `nanosleep` (fractional sleeps). Like Perl they block: the page is busy while they wait; for a wait that keeps the page responsive use `setTimeout(sub { ... }, $ms)`.

```perl
use Time::HiRes qw(time gettimeofday tv_interval);
my $t0 = [gettimeofday];
my $start = time;
my $sum = 0;
$sum += $_ for 1..1000;
my $elapsed = tv_interval($t0);
print "elapsed ok: ", ($elapsed >= 0 && $elapsed < 5 ? 1 : 0), ", fractional: ", ($start =~ /\./ ? "yes" : "no"), ", sum=$sum\n";
```

### DateTime

`new now today from_epoch last_day_of_month`, accessors (`year month day hour minute second day_of_week day_of_year month_name day_name week ...`), `ymd hms datetime iso8601 strftime epoch`,
`add subtract add_duration subtract_duration subtract_datetime delta_days truncate set set_time_zone clone compare`, `DateTime::Duration` with `in_units`, and real time zones (`time_zone => 'Asia/Tokyo'`, any IANA name).
`==` on two DateTime objects compares identity; use `$a->epoch == $b->epoch` or `DateTime->compare($a, $b)` (`<`, `>` and `<=>` work). Not verified against real Perl (the module is not installed here).

```perl2js
use DateTime;
my $dt = DateTime->new(year => 2026, month => 11, day => 24, hour => 9, minute => 30, time_zone => 'Asia/Tokyo');
print "$dt  (", $dt->day_name, ")\n";                                  # 2026-11-24T09:30:00  (Tuesday)
print $dt->clone->set_time_zone('America/New_York')->datetime, "\n";   # 2026-11-23T19:30:00
print $dt->clone->add(months => 3, years => 1)->ymd, "\n";             # 2028-02-24
my $diff = $dt->clone->add(days => 10, hours => 5)->subtract_datetime($dt);
my ($days, $hours) = $diff->in_units('days', 'hours');                  # 10, 5
```

## Control and testing

### Carp

`croak carp confess cluck`; messages get ` at line N.` like `die`.

```perl
use Carp qw(croak);
sub positive { my $n = shift; croak "need a positive number" if $n <= 0; return $n; }
eval { positive(-1) };
print "caught: ", ($@ =~ /^(need a positive number) at / ? $1 : "?"), "\n";
```

### Try::Tiny

`try { ... } catch { ... } finally { ... };` The error is in `$_` (and `$_[0]`) inside `catch`. `return` leaves only the block, as in the real module.

```perl
use Try::Tiny;
my $r = try { die "boom\n"; 1 } catch { "caught: $_" };
print $r;
try { die { code => 404 } } catch { print "error code $_->{code}\n" } finally { print "finally runs\n" };
my @res = map { my $n = $_; try { die "odd\n" if $n % 2; "even$n" } catch { "ERR$n" } } 1..4;
print join(",", @res), "\n";
```

### Test::More

`ok is isnt like unlike cmp_ok is_deeply can_ok isa_ok pass fail diag note explain plan done_testing subtest BAIL_OUT`, with TAP output (`ok 1 - name`).
Failure details (`#   Failed test ...`) are printed in the output too, so they are visible on a page; real Perl prints them to STDERR.

```perl
use Test::More tests => 6;
ok(1 + 1 == 2, "addition");
is(uc("perl"), "PERL", "uc");
like("hello world", qr/wor/, "like");
is_deeply([1, { a => [2, 3] }], [1, { a => [2, 3] }], "same structure");
cmp_ok(10, '>', 3, "cmp_ok");
subtest 'inner' => sub { ok(1, "in subtest"); is(1, 1, "also"); };
```

### constant

`use constant` is part of the language (no module file): scalars, lists and the `{ A => 1, B => 2 }` form.

```perl
use constant PI => 3.14159;
use constant { E => 2.71828, NAME => "const" };
use constant COLORS => qw(red green blue);
my @c = (COLORS);
print PI, " ", E, " ", NAME, " ", scalar(@c), " ", (COLORS)[1], "\n";
```

## Files and math

### File::Basename, File::Spec

String handling only (no file system access): `basename dirname fileparse`, and `File::Spec->catfile catdir splitdir canonpath file_name_is_absolute curdir updir rootdir splitpath catpath`.

```perl
use File::Basename;
use File::Spec;
for my $p ("/usr/local/lib/Foo.pm", "foo.txt", "/a/b/", "a/b", "../x/y.tar.gz") {
    my ($n, $d, $s) = fileparse($p, qr/\.[^.]*/);
    printf "%-24s base=%-10s dir=%-16s name=%s suffix=%s\n", $p, basename($p), dirname($p), $n, $s;
}
print File::Spec->catfile("a", "b", "c.txt"), " ", File::Spec->catdir("/a/", "/b//"), " ", File::Spec->canonpath("/a/./b//c/"), "\n";
print join("|", File::Spec->splitdir("/a/b//c")), "\n";
```

### Math::Trig

`pi tan asin acos atan sinh cosh tanh sec csc cot asinh acosh atanh deg2rad rad2deg deg2grad grad2deg` (and `pi2 pi4 pip2 pip4` with `:pi`).

```perl
use Math::Trig;
use Math::Trig ':pi';
printf "pi=%.10f pi2=%.6f tan(1)=%.8f asin(.5)=%.8f atan(1)=%.8f\n", pi, pi2, tan(1), asin(0.5), atan(1);
printf "deg2rad(90)=%.8f deg2rad(450)=%.8f rad2deg(pi)=%.4f\n", deg2rad(90), deg2rad(450), rad2deg(pi);
```
