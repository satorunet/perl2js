# モジュール

[English](modules.md) | **日本語** · [ドキュメント一覧](README.ja.md)

モジュールは [`modules/`](../modules) にある別ファイルです。`use List::Util qw(sum);` と書くと、プログラムが最初に要求したときに `modules/List/Util.js` が読み込まれるので、
コアは小さいままです。以下はすべて、本物の Perl モジュール (`perl 5.40`) がインストールされている場合はそれと比較済みです。
このページのすべての `perl` ブロックは、本物の Perl と Perl2JS で同一に動作します (`node tools/verify-docs.js docs/modules.md`)。

| グループ | モジュール |
|---|---|
| [リストと型](#リストと型) | `List::Util` `List::MoreUtils` `Scalar::Util` |
| [データとテキスト](#データとテキスト) | `Data::Dumper` `JSON::PP` `JSON` `Storable` `Text::Wrap` `Term::ANSIColor` |
| [エンコーディングとハッシュ](#エンコーディングとハッシュ) | `Encode` `MIME::Base64` `URI::Escape` `Digest::MD5` `Digest::SHA` |
| [時刻](#時刻) | `POSIX` `Time::Local` `Time::Piece` `Time::Seconds` `Time::HiRes` `DateTime` |
| [制御とテスト](#制御とテスト) | `Carp` `Try::Tiny` `Test::More` `constant` |
| [CGI (Cookie)](#cgi-cookie) | `CGI` `CGI::Cookie` |
| [ファイルと数学](#ファイルと数学) | `File::Basename` `File::Spec` `Math::Trig` |
| ブラウザ | [jQuery 風の `$`](browser.ja.md) |

ブラウザでは利用できないもの (ファイル、プロセス、ソケットがないため): `Getopt::Long`、`Cwd`、`File::Temp`、`IO::File`、`Socket`、`DBI`、`LWP::UserAgent` (代わりに `$->get/post/ajax` を使ってください)。
未実装: `Moose`/`Moo`、`Text::CSV`、`YAML`、`Benchmark`。

インポートの仕組み: `use Module qw(a b);` は `a` と `b` をインポートし、`use Module;` はモジュールのデフォルトリストをインポートし、`use Module ();` は何もインポートしません。
完全修飾名での呼び出し (`POSIX::floor(2.5)`) は、読み込まれたモジュールが提供するすべての関数で動作します。

## リストと型

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

`sum` などは空リストに対して `undef` を返します (`sum0` は 0 を返します)。`first any all none notall` のブロックは `$_` を使い、`reduce reductions pairmap pairgrep pairfirst` のブロックは `$a` と `$b` を使います。

### List::MoreUtils (一部)

`uniq distinct any all none notall firstidx first_index lastidx last_index indexes firstval first_value lastval last_value true false minmax part apply after before`。
`zip`、`natatime`、`pairwise` は未実装です。(本物の Perl との照合は未実施です。ここにはこのモジュールがインストールされていません。)

```perl2js
use List::MoreUtils qw(firstidx indexes minmax uniq);
my @a = (5, 3, 9, 3, 7);
print firstidx { $_ == 9 } @a;                 # 2
print join(",", indexes { $_ == 3 } @a), "\n"; # 1,3
my ($lo, $hi) = minmax @a;
```

### Scalar::Util

`blessed reftype looks_like_number refaddr weaken` (`weaken` は何もしません。JavaScript にはガベージコレクタがあるためです)。

```perl
use Scalar::Util qw(blessed reftype looks_like_number);
my $obj = bless {}, 'Foo';
print "blessed: ", blessed($obj), ", of a plain hash: ", (defined blessed({}) ? "?" : "undef"), "\n";
print "reftype: ", join(",", reftype($obj), reftype([]), reftype(sub {})), "\n";
print join(",", map { looks_like_number($_) ? "num" : "str" } (1, "2.5", "abc", "1e3", " 3 ", "", "-7", ".5")), "\n";
```

## データとテキスト

### Data::Dumper

本物のモジュールと同じレイアウトで、`bless( {...}, 'Class' )` も含みます。設定: `$Data::Dumper::Indent` (0、1、2)、`Sortkeys`、`Terse`。

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

1 つ違う点があります。JavaScript には整数と浮動小数点数の区別がないため、Perl が `'3'` と書く `3.0` は `3` としてダンプされます。

### JSON::PP, JSON

`encode_json decode_json` と、オブジェクトインターフェース `JSON::PP->new->pretty->canonical->encode(...)` (オプション: `pretty indent space_before space_after canonical ascii utf8 allow_blessed convert_blessed`)。
`JSON` は `to_json`/`from_json` を追加します。`JSON::XS` と `JSON::MaybeXS` はエイリアスです。`pretty` は本物のモジュールと同様に 3 スペースでインデントします。
JSON の `true`/`false` は `1`/`0` にデコードされます。

```perl
use JSON::PP;
my $json = JSON::PP->new->canonical->pretty;
print $json->encode({ name => "Ann", langs => ["Perl", "JS"], pos => { x => 3, y => 4 }, memo => undef, score => 3.5 });
print encode_json([1, "two", { three => 3 }]), "\n";
my $back = decode_json('{"list":[1,2,{"k":"v"}],"ok":true,"n":null,"pi":3.14}');
print "list[2]{k}=$back->{list}[2]{k} ok=$back->{ok} pi=$back->{pi} n=", (defined $back->{n} ? "def" : "undef"), "\n";
```

### Storable

`dclone` (ディープコピー。`bless` と循環参照を保持します)、`freeze`、`thaw`。`store`/`retrieve` (ファイル) は使えません。

```perl
use Storable qw(dclone);
my $orig = { a => [1, 2, { b => 3 }], c => "x" };
my $copy = dclone($orig);
$copy->{a}[2]{b} = 99;
push @{ $copy->{a} }, 4;
print "orig: $orig->{a}[2]{b} (", scalar(@{ $orig->{a} }), " items), copy: $copy->{a}[2]{b} (", scalar(@{ $copy->{a} }), " items)\n";
```

### Text::Wrap

`wrap` と `fill`。本物のアルゴリズムの移植です: `$Text::Wrap::columns`、`huge` (`wrap`、`overflow`、`die`)、`unexpand`、`tabstop`、`separator`、`break`。

```perl
use Text::Wrap qw(wrap fill);
$Text::Wrap::columns = 36;
print wrap("* ", "  ", "The quick brown fox jumps over the lazy dog and keeps running through the forest."), "\n";
$Text::Wrap::huge = 'overflow';
print wrap("> ", "> ", "short words and aVeryLongWordThatCannotFitOnOneLine end"), "\n";
```

### Term::ANSIColor

`color colored colorstrip uncolor colorvalid` と定数 (`use Term::ANSIColor qw(:constants);` で `RED`、`BOLD`、`RESET`、... が使えます)。プレイグラウンドの出力ペインはエスケープコードを解釈しません。

```perl
use Term::ANSIColor qw(color colored colorstrip uncolor);
print join("|", map { sprintf "%vd", $_ } color("bold red"), colored("hi", "green")), "\n";
print colorstrip("\e[1mbold\e[0m plain"), " ", join(",", uncolor("1;31")), "\n";
```

## エンコーディングとハッシュ

### Encode

`encode decode encode_utf8 decode_utf8 find_encoding is_utf8`。対応エンコーディング: UTF-8、latin1/ISO-8859-1、ASCII、UTF-16 (LE/BE)、**Shift_JIS** (`shiftjis`、`sjis`、`cp932`)、**EUC-JP**。ISO-2022-JP はデコードのみ可能です。
「バイト文字列」とは、Perl と同様、すべての文字が 256 未満である文字列のことです。

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

`uri_unescape` は (本物のモジュールと同様に) バイト列を返します。UTF-8 のテキストの場合は、結果を `Encode::decode_utf8` に通してください。

### Digest::MD5, Digest::SHA

`md5 md5_hex md5_base64`、`sha1 sha256` (それぞれ `_hex` と `_base64` つき)、`hmac_sha1 hmac_sha256` (同じ接尾辞)、およびオブジェクトインターフェース `Digest::MD5->new->add(...)->hexdigest`。SHA-512 は未実装です。

```perl
use Digest::MD5 qw(md5_hex);
use Digest::SHA qw(sha1_hex sha256_hex hmac_sha256_hex);
print md5_hex("hello"), "\n", sha1_hex("hello"), "\n", sha256_hex("hello"), "\n";
print hmac_sha256_hex("data", "key"), "\n";
print Digest::MD5->new->add("hel", "lo")->hexdigest, "\n";
```

## 時刻

すべて `Asia/Tokyo` タイムゾーンの本物の Perl と比較しています。自分で実行する場合は、ブラウザのタイムゾーンが使われます。

### 組み込み関数、POSIX、Time::Local

`localtime`/`gmtime` は、リストコンテキストでは 9 要素のリストを、スカラーコンテキストでは `Thu Jan  1 09:00:00 1970` のような文字列を返します。
POSIX は `strftime mktime difftime floor ceil fmod pow round trunc` と、`INT_MAX` `DBL_MAX` などの定数を提供します。
Time::Local は `timelocal` と `timegm` を提供します。

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

`localtime`/`gmtime` はオブジェクトを返します。メソッド: `ymd hms datetime date time year mon monname month fullmonth mday hour min sec wday wdayname day fullday yday week epoch strftime add_months add_years truncate julian_day mjd is_leap_year month_last_day tzoffset` と `Time::Piece->strptime`。
`$t + ONE_DAY` と `$t2 - $t1` が使えます。差分には `->days ->hours ->minutes ->pretty` があります。

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

`time` (小数秒)、`gettimeofday`、`tv_interval`、そして `sleep` / `usleep` / `nanosleep` (小数秒もOK)。Perl と同じく待っている間は処理をブロックし、ページも止まります。ページを止めずに待ちたいときは `setTimeout(sub { ... }, $ms)` を使ってください。

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

`new now today from_epoch last_day_of_month`、アクセサ (`year month day hour minute second day_of_week day_of_year month_name day_name week ...`)、`ymd hms datetime iso8601 strftime epoch`、
`add subtract add_duration subtract_duration subtract_datetime delta_days truncate set set_time_zone clone compare`、`in_units` を持つ `DateTime::Duration`、そして実際のタイムゾーン (`time_zone => 'Asia/Tokyo'`、任意の IANA 名) に対応します。
2 つの DateTime オブジェクトへの `==` は同一性を比較します。`$a->epoch == $b->epoch` または `DateTime->compare($a, $b)` を使ってください (`<`、`>`、`<=>` は動作します)。本物の Perl との照合は未実施です (ここにはこのモジュールがインストールされていません)。

```perl2js
use DateTime;
my $dt = DateTime->new(year => 2026, month => 11, day => 24, hour => 9, minute => 30, time_zone => 'Asia/Tokyo');
print "$dt  (", $dt->day_name, ")\n";                                  # 2026-11-24T09:30:00  (Tuesday)
print $dt->clone->set_time_zone('America/New_York')->datetime, "\n";   # 2026-11-23T19:30:00
print $dt->clone->add(months => 3, years => 1)->ymd, "\n";             # 2028-02-24
my $diff = $dt->clone->add(days => 10, hours => 5)->subtract_datetime($dt);
my ($days, $hours) = $diff->in_units('days', 'hours');                  # 10, 5
```

## 制御とテスト

### Carp

`croak carp confess cluck`。メッセージには `die` と同様に ` at line N.` が付きます。

```perl
use Carp qw(croak);
sub positive { my $n = shift; croak "need a positive number" if $n <= 0; return $n; }
eval { positive(-1) };
print "caught: ", ($@ =~ /^(need a positive number) at / ? $1 : "?"), "\n";
```

### Try::Tiny

`try { ... } catch { ... } finally { ... };` エラーは `catch` 内の `$_` (および `$_[0]`) に入ります。`return` は、本物のモジュールと同様、ブロックから抜けるだけです。

```perl
use Try::Tiny;
my $r = try { die "boom\n"; 1 } catch { "caught: $_" };
print $r;
try { die { code => 404 } } catch { print "error code $_->{code}\n" } finally { print "finally runs\n" };
my @res = map { my $n = $_; try { die "odd\n" if $n % 2; "even$n" } catch { "ERR$n" } } 1..4;
print join(",", @res), "\n";
```

### Test::More

`ok is isnt like unlike cmp_ok is_deeply can_ok isa_ok pass fail diag note explain plan done_testing subtest BAIL_OUT`。出力は TAP 形式です (`ok 1 - name`)。
失敗の詳細 (`#   Failed test ...`) も出力に表示されるので、ページ上で確認できます。本物の Perl では STDERR に出力されます。

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

`use constant` は言語の一部です (モジュールファイルはありません)。スカラー、リスト、`{ A => 1, B => 2 }` 形式に対応します。

```perl
use constant PI => 3.14159;
use constant { E => 2.71828, NAME => "const" };
use constant COLORS => qw(red green blue);
my @c = (COLORS);
print PI, " ", E, " ", NAME, " ", scalar(@c), " ", (COLORS)[1], "\n";
```

## CGI (Cookie)

`use CGI;` は Cookie の処理に対応しています: `CGI->new`、`cookie`、`header(-cookie => ...)`、`escape` / `unescape`、そして `CGI::Cookie` の `new` `fetch` `parse` `raw_fetch` `bake` とアクセサーです。`use CGI qw(:standard);` で `cookie` と `header` を関数として使えます。`param` や HTML 生成など、その他の CGI の機能はありません。

```perl
use CGI;
$ENV{HTTP_COOKIE} = "name=taro; fruits=apple&banana";   # サーバーがリクエストから設定する値
my $q = CGI->new;
print $q->cookie('name'), "\n";
my @f = $q->cookie('fruits');
print "@f\n";
my $c = $q->cookie(-name => 'theme', -value => 'dark mode', -path => '/', -samesite => 'lax');
print "$c\n";
```

```perl2js
use CGI qw(:standard);
print header(-cookie => cookie(-name => 'visits', -value => (cookie('visits') || 0) + 1, -expires => '+30d'));
print "visits: ", cookie('visits'), "\n";
```

| | ブラウザ | Node |
|---|---|---|
| Cookie の読み込み | `document.cookie` | `$ENV{HTTP_COOKIE}` |
| `header(-cookie => ...)`、`bake` | Cookie を保存する。`header` は `""` を返す | CGI.pm と同じヘッダー文字列を出力する |

本物の CGI.pm との違い:

- 値はバイト列ではなく UTF-8 のテキストとして返ります。
- ブラウザでは保存した Cookie を同じプログラム内ですぐに読めます。
- JavaScript からは `HttpOnly` の Cookie を作れないため、ブラウザではこの属性を外して保存します。
- `file://` で開いたページでは、ブラウザが Cookie を保存しないことがあります。

## ファイルと数学

### File::Basename, File::Spec

文字列処理のみです (ファイルシステムへのアクセスはありません): `basename dirname fileparse`、および `File::Spec->catfile catdir splitdir canonpath file_name_is_absolute curdir updir rootdir splitpath catpath`。

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

`pi tan asin acos atan sinh cosh tanh sec csc cot asinh acosh atanh deg2rad rad2deg deg2grad grad2deg` (`:pi` を指定すると `pi2 pi4 pip2 pip4` も使えます)。

```perl
use Math::Trig;
use Math::Trig ':pi';
printf "pi=%.10f pi2=%.6f tan(1)=%.8f asin(.5)=%.8f atan(1)=%.8f\n", pi, pi2, tan(1), asin(0.5), atan(1);
printf "deg2rad(90)=%.8f deg2rad(450)=%.8f rad2deg(pi)=%.4f\n", deg2rad(90), deg2rad(450), rad2deg(pi);
```
