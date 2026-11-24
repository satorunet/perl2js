# Syntax guide

**English** | [日本語](syntax.ja.md) · [Docs index](README.md)

Perl2JS reads a practical subset of Perl 5. This page walks through what you can write.
Every `perl` code block on this page is run with **real Perl 5.40 and with Perl2JS**, and the output has to be identical
(`node tools/verify-docs.js docs/syntax.md`).

- [Variables](#variables) · [Arrays, hashes, references](#arrays-hashes-and-references) · [Strings](#strings)
- [Numbers and operators](#numbers-and-operators) · [Control flow](#control-flow) · [Subroutines](#subroutines)
- [Regular expressions](#regular-expressions) · [Packages and objects](#packages-and-objects) · [Errors](#errors)
- [Other features](#other-features) · [Built-in functions](#built-in-functions)

## Variables

`$scalar`, `@array`, `%hash`. Declare them with `my` (block scope), `our` (package/global) or `local` (temporary value).

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

`use strict;` is checked at compile time: using an undeclared variable stops the program with the line number.

## Arrays, hashes and references

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

References are plain JavaScript objects and arrays, so `\@a` and `\%h` are the array or hash itself.
`[ ... ]` and `{ ... }` build anonymous ones, and `->` walks into them.

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

Hash order: Perl randomises it, Perl2JS keeps insertion order. Use `sort keys %h` when the order matters.

## Strings

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

Here-documents (`<<"EOT"`, `<<'EOT'`, and `<<~EOT` which strips the indentation):

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

String functions and operators:

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

## Numbers and operators

Numbers are JavaScript doubles, printed the way Perl prints them (`%.15g`).
Operators follow Perl's rules: `+ - * /` are always numeric (even on strings), `.` concatenates,
`== != < > <= >=` compare as numbers and `eq ne lt gt le ge` compare as strings.

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

## Control flow

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

`$_` is the default variable of `for`, `map`, `grep`, `split` and friends.

```perl
for (qw(x y z)) { print uc, " " }
print "\n";
my @lens = map { length } qw(a bb ccc);
print "@lens\n";
```

## Subroutines

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

A sub returns the value of its last statement. `@_` holds the arguments, `shift` takes the first one.
`local` gives a package variable a temporary value that is restored when the block ends, even through `die`:

```perl
our $level = 0;
sub show { print "level=$level\n" }
sub nested { local $level = $level + 1; show(); }
show(); nested(); show();
```

## Regular expressions

Perl regexes are translated to JavaScript `RegExp`. Captures are `$1`, `$2`, ...

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

Flags `i m s x g e`, `qr//`, `m{...}`, `s{...}{...}`, `tr/a-z/A-Z/` (with `c d s r`) and `split` work.
Because the engine is JavaScript's, a few exotic Perl regex features are missing, see [differences](differences.md).

## Packages and objects

`package`, `bless`, `use parent`, `SUPER::`, `isa`, `can` and `ref` work. Define a package **before** the code that uses it.

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

`$obj->name` and `$obj->{name}` do not collide: methods and hash keys live in different places.

## Errors

```perl
my $ok = eval { die "something broke\n"; 1 };
print "caught: $@" unless $ok;

sub risky { my $n = shift; die { code => 42, msg => "negative" } if $n < 0; return sqrt($n); }
for my $n (16, -1) {
    my $r = eval { risky($n) };
    if (ref $@) { print "error $@->{code}: $@->{msg}\n" } else { print "sqrt($n) = $r\n" }
}
```

`die "text"` without a trailing newline gets `at line N.` appended, like Perl's `at FILE line N.`.
Perl 5.34's `try`/`catch` works without any module, and `Try::Tiny` is available:

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

On a web page, uncaught errors are drawn on the page with the line number, a source excerpt and a hint.

## Other features

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

Also available: `wantarray` is **not** supported; `local $_` works; `printf`/`sprintf` support `%s %d %f %e %g %x %o %b %c %%`, flags, width, precision and `%vd`.

## Built-in functions

| Group | Functions |
|---|---|
| Output | `print` `printf` `say` `sprintf` |
| Arrays | `push` `pop` `shift` `unshift` `splice` `reverse` `sort` `map` `grep` `join` `scalar` |
| Hashes | `keys` `values` `exists` `delete` `each`-style loops with `keys` |
| Strings | `length` `substr` `index` `rindex` `uc` `lc` `ucfirst` `lcfirst` `chomp` `chop` `chr` `ord` `split` `sprintf` `reverse` `tr///` |
| Numbers | `abs` `int` `sqrt` `sin` `cos` `atan2` `exp` `log` `hex` `oct` `rand` `srand` |
| Types | `defined` `ref` `bless` |
| Time | `time` `localtime` `gmtime` |
| Control | `die` `warn` `eval` `exit` `return` `last` `next` |

Everything else comes from [modules](modules.md): `List::Util`, `POSIX`, `Data::Dumper`, `Time::Piece`, `JSON::PP`, `Encode`, ...
