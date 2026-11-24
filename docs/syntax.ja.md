# 構文ガイド

[English](syntax.md) | **日本語** · [ドキュメント一覧](README.ja.md)

Perl2JS は Perl 5 の実用的なサブセットを読み取ります。このページでは、書けるものを順に見ていきます。
このページにあるすべての `perl` コードブロックは、**本物の Perl 5.40 と Perl2JS の両方** で実行され、出力が一致する必要があります
(`node tools/verify-docs.js docs/syntax.md`)。

- [変数](#変数) · [配列、ハッシュ、リファレンス](#配列ハッシュリファレンス) · [文字列](#文字列)
- [数値と演算子](#数値と演算子) · [制御構文](#制御構文) · [サブルーチン](#サブルーチン)
- [正規表現](#正規表現) · [パッケージとオブジェクト](#パッケージとオブジェクト) · [エラー](#エラー)
- [その他の機能](#その他の機能) · [組み込み関数](#組み込み関数)

## 変数

`$scalar`、`@array`、`%hash` です。宣言には `my` (ブロックスコープ)、`our` (パッケージ/グローバル)、`local` (一時的な値) を使います。

```perl
use strict;
use warnings;

my $name  = "Perl2JS";
my @langs = ("Perl", "JavaScript", "Raku");
my %age   = (ann => 31, bob => 25);

print "$name knows ", scalar(@langs), " languages: @langs\n";
print "Ann is $age{ann}, the last language is $langs[-1] (index $#langs)\n";

my ($first, @rest) = @langs;      # list assignment
print "first=$first rest=@rest\n";
my ($x, $y) = (1, 2);
($x, $y) = ($y, $x);              # swap
print "x=$x y=$y\n";
```

`use strict;` はコンパイル時にチェックされます。宣言していない変数を使うと、行番号つきでプログラムが停止します。

## 配列、ハッシュ、リファレンス

```perl
my @a = (10, 20, 30, 40, 50);
push @a, 60;                       # also: pop, shift, unshift, splice
print "count=", scalar(@a), " last=$a[-1] slice=@a[1,2] range=@a[1..3]\n";
print "reversed: @{[ reverse @a ]}\n";
print "sorted desc: @{[ sort { $b <=> $a } @a ]}\n";

my %h = (one => 1, two => 2, three => 3);
$h{four} = 4;
delete $h{one};
for my $k (sort keys %h) {
    print "$k=$h{$k} ";
}
print "\n";
print "has two: ", (exists $h{two} ? "yes" : "no"), ", has one: ", (exists $h{one} ? "yes" : "no"), "\n";
print "values sum: ", eval { my $s = 0; $s += $_ for values %h; $s }, "\n";
```

リファレンスは素の JavaScript のオブジェクトと配列なので、`\@a` と `\%h` は配列やハッシュそのものです。
`[ ... ]` と `{ ... }` は無名の配列・ハッシュを作り、`->` でその中をたどります。

```perl
my $data = {
    name  => "Ann",
    langs => ["Perl", "JS"],
    pos   => { x => 3, y => 4 },
};
push @{ $data->{langs} }, "Rust";
$data->{pos}{x} += 10;

print "$data->{name} knows @{ $data->{langs} }; x=$data->{pos}{x}\n";
print "number of langs: ", scalar(@{ $data->{langs} }), "\n";
print "ref types: ", join(",", ref($data), ref($data->{langs}), ref(sub { 1 })), "\n";

my @matrix = ([1, 2, 3], [4, 5, 6]);
print "matrix[1][2] = $matrix[1][2], row 0 = @{ $matrix[0] }\n";

my @copy = @{ $data->{langs} };    # copy of the array
my %by_name = map { $_ => length($_) } @copy;
print join(", ", map { "$_:$by_name{$_}" } sort keys %by_name), "\n";
```

ハッシュの順序: Perl では順序がランダムになりますが、Perl2JS は挿入順を保ちます。順序が重要な場合は `sort keys %h` を使ってください。

## 文字列

```perl
my $n = 3;
my @items = ("a", "b");
my %h = (k => "v");
my $r = { list => [1, 2] };

print "Interpolation: $n $items[0] @items $h{k} $r->{list}[1] @{[ $n * 2 ]}\n";
print 'No interpolation: $n @items\n', "\n";
print "Escapes: tab[\t] unicode[\x{263A}] quote[\"]\n";
print q(single quoted with $n), " | ", qq{double quoted with $n}, "\n";
my @words = qw(alpha beta gamma);
print "qw: @words\n";
```

ヒアドキュメント (`<<"EOT"`、`<<'EOT'`、およびインデントを取り除く `<<~EOT`):

```perl
my $who = "world";
print <<"EOT";
Hello, $who!
  (interpolated)
EOT
print <<'EOT';
Hello, $who! (not interpolated)
EOT
print <<~EOT;
    indented text
      keeps relative indentation
    EOT
```

文字列関数と演算子:

```perl
my $s = "Hello, World";
print length($s), " ", uc($s), " ", lc($s), " ", ucfirst(lc("PERL")), " ", lcfirst("ABC"), "\n";
print substr($s, 0, 5), "|", substr($s, -5), "|", index($s, "World"), "|", rindex($s, "o"), "\n";
print join("-", split(/,\s*/, $s)), "|", scalar reverse("abc"), "|", "ab" x 3, "|", "-" x 10, "\n";
print sprintf("%05.1f|%-6s|%6s|%x|%o|%b|%e|%3d%%", 3.14159, "ab", "cd", 255, 8, 5, 12345.678, 42), "\n";
print "chr/ord: ", chr(65), ord("a"), " ", join(",", map { sprintf "%02x", ord } split //, "AB"), "\n";
my $line = "text\n";
chomp $line;
print "[$line] ", ($s =~ tr/a-z//), " lowercase letters\n";
(my $t = $s) =~ tr/a-zA-Z//cd;     # delete everything that is not a letter
print "$t\n";
```

## 数値と演算子

数値は JavaScript の倍精度浮動小数点数で、Perl と同じ形式 (`%.15g`) で出力されます。
演算子は Perl の規則に従います。`+ - * /` は (文字列に対しても) 常に数値演算で、`.` は連結、
`== != < > <= >=` は数値として比較し、`eq ne lt gt le ge` は文字列として比較します。

```perl
print 0.1 + 0.2, " ", 1 / 3, " ", 10 / 4, " ", 7 % 3, " ", 2 ** 10, " ", int(7 / 2), " ", abs(-3), " ", sqrt(16), "\n";
print "5" + "5", " ", "5" . "5", " ", "5" * "5", " ", "10" / "4", "\n";
print "numeric: ", ("10" < "9" ? "10 is smaller" : "10 is not smaller"), "\n";
print "string : ", ("10" lt "9" ? "10 sorts first" : "9 sorts first"), "\n";
print "equal  : ", (5 == 5.0 ? "5 == 5.0" : "no"), ", ", ("5" eq "5.0" ? "same text" : "different text"), "\n";
print "spaceship: ", join(",", 1 <=> 2, "b" cmp "a", 2 <=> 2), "\n";

my $i = 5;
$i++; $i += 10; $i *= 2; $i -= 1; $i **= 2;
print "i=$i\n";
my ($u, $v);
print "defined-or: ", $u // "default", " ", ($v || "false-ish"), " ", (0 // "zero is defined"), "\n";
print "logic: ", (1 && "and"), " ", (0 || "or"), " ", (!1 ? "t" : "not"), " ", (1 and 0 or "low-precedence"), "\n";
print "range: ", join(",", 1..5), " ", join("", "a".."e"), "\n";
```

## 制御構文

```perl
for my $i (1..15) {
    if    ($i % 15 == 0) { print "FizzBuzz " }
    elsif ($i % 3  == 0) { print "Fizz " }
    elsif ($i % 5  == 0) { print "Buzz " }
    else                 { print "$i " }
}
print "\n";

my $n = 0;
while ($n < 10) { $n++; next if $n % 2; last if $n > 6; print "n=$n "; }
print "\n";
do { $n-- } until ($n <= 3);
print "after until: $n\n";

for (my $j = 0; $j < 3; $j++) { print "j=$j "; }
print "\n";

my @queue = qw(a b c);
while (my $item = shift @queue) { print "item $item "; }
print "\n";

print "$_ " foreach reverse 1..3;                # statement modifiers: if unless while until for foreach
print "\n";
print "unless works\n" unless 0;
my $size = 5;
print "size: ", ($size < 3 ? "small" : $size < 10 ? "medium" : "large"), "\n";
```

`$_` は `for`、`map`、`grep`、`split` などのデフォルト変数です。

```perl
for (qw(x y z)) { print uc, " " }
print "\n";
my @lens = map { length } qw(a bb ccc);
print "@lens\n";
```

## サブルーチン

```perl
use feature 'signatures';
no warnings;

sub add { my ($a, $b) = @_; return $a + $b; }
sub greet { my $name = shift // "world"; "Hello, $name!" }        # the last value is returned
sub minmax { my @s = sort { $a <=> $b } @_; return ($s[0], $s[-1]); }
sub fact($n) { $n <= 1 ? 1 : $n * fact($n - 1) }                    # signatures

print add(2, 3), " ", greet(), " ", greet("Perl2JS"), " ", fact(10), "\n";
my ($lo, $hi) = minmax(5, 3, 9, 1);
print "min=$lo max=$hi\n";

my $counter = do { my $c = 0; sub { return ++$c } };               # closures
$counter->() for 1..2;
print "counter: ", $counter->(), "\n";

my %dispatch = (double => sub { $_[0] * 2 }, square => sub { $_[0] ** 2 });
print join(", ", map { "$_(7)=" . $dispatch{$_}->(7) } sort keys %dispatch), "\n";

my @sorted = sort { length($a) <=> length($b) or $a cmp $b } qw(pear fig apple kiwi);
print "@sorted\n";
```

sub は最後の文の値を返します。`@_` には引数が入り、`shift` で最初の引数を取り出します。
`local` はパッケージ変数に一時的な値を与え、ブロックの終了時 (`die` で抜けた場合も含む) に元に戻します。

```perl
our $level = 0;
sub show { print "level=$level\n" }
sub nested { local $level = $level + 1; show(); }
show(); nested(); show();
```

## 正規表現

Perl の正規表現は JavaScript の `RegExp` に変換されます。キャプチャは `$1`、`$2`、... です。

```perl
my $date = "2026-11-24";
if ($date =~ /^(\d+)-(\d+)-(\d+)$/) {
    print "year=$1 month=$2 day=$3\n";
}
(my $copy = $date) =~ s/-/\//g;                  # substitute, g = all
print "$copy\n";
my $text = "a1b22c333";
my $count = 0;
$count++ while $text =~ /\d+/g;                  # scalar //g walks through the matches
print "numbers found: $count\n";
my $shout = "hello world";
$shout =~ s/(\w+)/uc($1)/ge;                     # e = evaluate the replacement
print "$shout\n";
print join("|", split /\s*,\s*/, "a , b,c ,d"), "\n";
my $re = qr/(\w+)@(\w+)\.com/i;                  # compiled regex
print "user=$1 host=$2\n" if 'Mail: Bob@Example.com' =~ $re;
print "no match\n" if "abc" !~ /\d/;
my @found = grep { /^b/ } qw(apple banana blueberry cherry);
print "@found\n";
```

フラグ `i m s x g e`、`qr//`、`m{...}`、`s{...}{...}`、`tr/a-z/A-Z/` (`c d s r` つき)、`split` が動作します。
エンジンは JavaScript のものなので、Perl の正規表現の一部の特殊な機能は使えません。[違い](differences.ja.md)を参照してください。

## パッケージとオブジェクト

`package`、`bless`、`use parent`、`SUPER::`、`isa`、`can`、`ref` が動作します。パッケージは、それを使うコードより**前**に定義してください。

```perl
package Animal;
sub new {
    my ($class, %args) = @_;
    my $self = { name => $args{name} || "unknown", sound => "..." };
    return bless $self, $class;
}
sub name  { $_[0]->{name} }
sub speak { my $self = shift; return sprintf("%s the %s says %s", $self->name, lc ref($self), $self->sound); }
sub sound { $_[0]->{sound} }

package Dog;
use parent -norequire, 'Animal';
sub new {
    my ($class, %args) = @_;
    my $self = Animal::new($class, %args);
    $self->{tricks} = [];
    return $self;
}
sub sound { "Woof" }
sub add_trick { my ($self, $t) = @_; push @{ $self->{tricks} }, $t; return $self; }
sub tricks { @{ $_[0]->{tricks} } }

package main;
my $d = Dog->new(name => "Rex");
$d->add_trick("sit")->add_trick("roll");
print $d->speak, "\n";
print "tricks: ", join(", ", $d->tricks), "\n";
print "isa Animal: ", ($d->isa('Animal') ? "yes" : "no"), ", can speak: ", ($d->can('speak') ? "yes" : "no"), ", ref: ", ref($d), "\n";
my $r = eval { $d->fly; 1 };
print "error: $1\n" if !$r && $@ =~ /^(Can't locate object method "\w+" via package "\w+")/;
```

`$obj->name` と `$obj->{name}` は衝突しません。メソッドとハッシュキーは別の場所に存在するためです。

## エラー

```perl
my $ok = eval { die "something broke\n"; 1 };
print "caught: $@" unless $ok;

sub risky { my $n = shift; die { code => 42, msg => "negative" } if $n < 0; return sqrt($n); }
for my $n (16, -1) {
    my $r = eval { risky($n) };
    if (ref $@) { print "error $@->{code}: $@->{msg}\n" } else { print "sqrt($n) = $r\n" }
}
```

末尾に改行のない `die "text"` には、Perl の `at FILE line N.` と同様に `at line N.` が付加されます。
Perl 5.34 の `try`/`catch` はモジュールなしで動作し、`Try::Tiny` も利用できます。

```perl
use feature 'try';
no warnings;
for my $n (4, -4) {
    try {
        die "negative\n" if $n < 0;
        print "sqrt($n) = ", sqrt($n), "\n";
    }
    catch ($e) {
        chomp $e;
        print "failed for $n: $e\n";
    }
    finally { print "done with $n\n"; }
}
```

Web ページでは、捕捉されなかったエラーが、行番号、ソースの抜粋、ヒントとともにページ上に表示されます。

## その他の機能

```perl
use constant PI => 3.14159;
use constant { E => 2.71828, NAME => "const" };
use constant COLORS => qw(red green blue);
my @c = (COLORS);
print PI, " ", E, " ", NAME, " ", scalar(@c), " ", (COLORS)[1], "\n";

my @unsorted = (3, 11, 2);
print join(",", sort @unsorted), " vs ", join(",", sort { $a <=> $b } @unsorted), "\n";   # default sort is by string
print join(",", map { $_ * 2 } grep { $_ % 2 } 1..9), "\n";
print "last element: $unsorted[$#unsorted], via -1: $unsorted[-1]\n";

my ($y, $m, $d) = (localtime(0))[5, 4, 3];     # list slice
printf "%s\n", join "", map { chr(ord($_) + 1) } split //, "HAL";
print "ok\n" if "abc" =~ /b/ and not "abc" =~ /z/;
```

そのほか: `wantarray` は**サポートされていません**。`local $_` は動作します。`printf`/`sprintf` は `%s %d %f %e %g %x %o %b %c %%`、フラグ、幅、精度、`%vd` をサポートします。

## Perl + JavaScript ハイブリッド

Perl2JS は JavaScript にコンパイルされるので、JavaScript の世界はすぐそこにあります。Perl を書き続けながら、同じプログラム内でブラウザや JS のオブジェクトを呼び出せます。よく使う JS のグローバルオブジェクトには、`->` (Perl 構文) または `.` (JavaScript 風) のどちらも使えます。

```perl2js
for (0..5) {
    alert(10);                       # Perl loop, JavaScript function
}

print Math.max(1, 5, 3), "\n";                       # 5   (also Math->max(...))
print JSON.stringify({ a => 1, b => [1, 2] }), "\n";  # {"a":1,"b":[1,2]}

my $el = document.getElementById("out");             # the DOM, straight from Perl
$el->{textContent} = "Hello from Perl";              # properties are hash-style: ->{name}
console.log("sum:", 1 + 2);

my $now = new Date();
print $now->getFullYear(), "\n";                     # methods on JS objects: ->name(...)
```

`.` で使える JS の名前: `Math JSON console document window Object Array Number String Date Promise localStorage sessionStorage navigator location Intl history performance`。
それ以外の場所では `->` を使います。`$obj->method(...)` はメソッド呼び出し、`$obj->{prop}` はプロパティの読み書き、`$fn->(...)` は関数値の呼び出しで、`sub { ... }` はどの JS API にも渡せる関数です (`setTimeout(sub { print "later" }, 500)`)。
Perl のコードと JS の値は自由に混在できます。配列は本物の JS 配列、ハッシュはプレーンなオブジェクト、文字列と数値は JS のものです。

受け付けないもの (これは JavaScript ではなく Perl です): `let`/`const`、アロー関数 `x => x * 2`、`===`、テンプレートリテラル。[違い](differences.ja.md)を参照してください。

## 組み込み関数

Perl と同じに動くもの・動かないものの一覧は、専用のページにまとめています: **[組み込み関数](functions.ja.md)**。組み込み以外の機能は [モジュール](modules.ja.md) (`List::Util`、`POSIX`、`Data::Dumper`、`Time::Piece`、`JSON::PP`、`Encode` など) で提供されます。
