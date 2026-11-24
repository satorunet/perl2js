# 組み込み関数

[English](functions.md) | **日本語** · [ドキュメント一覧](README.ja.md)

各行は、本物の Perl 5.40 と Perl2JS の両方で実行して確認しています(機能ごとに1行のプログラムを用意し、出力が同一であることを条件にしています)。
**✅** Perl と同じに動く · **🟡** 違いあり(備考を参照) · **➖** 未実装 · **⛔** ブラウザでは実現できない

## 文字列

| 関数 | | 備考 |
|---|---|---|
| `length` `uc` `lc` `ucfirst` `lcfirst` `index` `rindex` `reverse` `join` `chr` `ord` `hex` `oct` `chomp` `chop` `quotemeta` | ✅ | |
| `substr` (引数2・3・4個の形と、`substr($s, 0, 1) = "x"`) | ✅ | |
| `sprintf` / `printf` (`%s %d %f %e %g %x %o %b %c %%`、フラグ、幅、`%*d`、`%2$s`、`%vd`) | ✅ | |
| `x`(繰り返し)、`.`(連結)、文字列中の `\U \L \u \l \E` | ✅ | |
| `tr///`(範囲、個数のカウント、`d` `s` `c` `r`) | ✅ | |
| 非ASCII文字への `lc` / `uc` | ✅ | |
| `use utf8` なしの UTF-8 文字列の `length` | 🟡 | 文字数を数えます(Perl はバイト数) |
| `pack` / `unpack` | ➖ | |
| `crypt`, `study`, `fc` | ➖ | |
| `format` / `write` | ➖ | |

## 数値

| 関数 | | 備考 |
|---|---|---|
| `abs` `int` `sqrt` `sin` `cos` `atan2` `exp` `log` `hex` `oct` `rand` `srand` | ✅ | |
| `**` `%` (Perl's sign rules: `-7 % 3 == 2`) `<=>` `& \| ^ ~ << >>` `0x` `0b` `0o` `1_000` literals | ✅ | |
| 2**53 を超える整数 | 🟡 | 数値は JavaScript の倍精度です。`9007199254740993` は `9.00719925474099e+15` と表示されます |
| 32ビットを超えるビット演算 | 🟡 | 32ビットです |

## 配列とリスト

| 関数 | | 備考 |
|---|---|---|
| `push` `pop` `shift` `unshift` `splice` `reverse` `scalar` `join` `grep` `map` `sort` (ブロック、`$a`/`$b`、`<=>`、`cmp`) | ✅ | |
| 配列への `exists` `delete`、`$#a`、`$#{$r}`、`$#a = 3`、スライス `@a[1,2]`、`(list)[i]`、`@$r[0,1]` | ✅ | |
| `keys @array`、`foreach` のエイリアス(`$_ *= 2 for @a`)、リスト代入 `($a, $b) = ($b, $a)` | ✅ | |
| `sort by_name LIST` (名前付きサブを比較関数にする形) | ➖ | 比較をブロックに書いてください: `sort { $a <=> $b } @list` |
| `wantarray` | ➖ | |
| リストを返すサブの `my $x = f();` | 🟡 | リスト全体になります(Perl は最後の要素) |

## ハッシュ

| 関数 | | 備考 |
|---|---|---|
| `keys` `values` `each`(`while (my ($k, $v) = each %h)`、`each %$ref`、`each @array`、`while (my $k = each %h)`。呼ぶたびに1組ずつ返し、`keys` でリセット) `exists` `delete` `defined`、スライス `@h{...}`、`delete @h{...}`、`%h = ()`、入れ子のデータ、`%$ref`、`@{$h}{...}` | ✅ | |
| `local $h{key}` | ✅ | |
| `exists $h{a}{b}` が `$h{a}` を作る動作(autovivification) | 🟡 | `$h{a}` は作られません |
| `%r = reverse %h` | ➖ | |
| `scalar(%h)` | ✅ | キーの数(Perl 5.26 以降と同じ) |

## 制御構文とスコープ

| 機能 | | 備考 |
|---|---|---|
| `if` `elsif` `else` `unless` `while` `until` `for (;;)` `foreach` `last` `next` `redo` | ✅ | |
| ラベル(`OUTER: for ... { next OUTER }`)、`do {} while`、文修飾子(`... if`、`... for`)、`?:` | ✅ | |
| `my` `our` `local`、クロージャ、再帰、`return`、暗黙の戻り値 | ✅ | |
| サブルーチンのシグネチャ(`sub f($x, $y = 10)`) | ✅ | |
| `eval { }`、`eval "文字列"`、`die`(文字列もオブジェクトも)、`warn`、`$@` | ✅ | |
| `exit`、`sleep`、`__PACKAGE__`、`package`、`use constant` | ✅ | |
| `state` 変数 | ➖ | サブの外側の `my` 変数を使ってください |
| `BEGIN` / `END` ブロック | ➖ | |
| `caller` | ➖ | |
| プロトタイプ(`sub apply(&@)`) | ➖ | `apply(sub { ... }, @list)` と書いてください |
| `goto`、`given`/`when`、`format` | ➖ | |
| `do FILE`、`require FILE` | 🟡 | `require "lib/x.p2j";` で別の Perl2JS ファイルを取り込めます([ブラウザで使う](browser.ja.md)) |

## 正規表現

| 機能 | | 備考 |
|---|---|---|
| `m//` `s///` `tr///` と `g i m s x e r` フラグ、キャプチャ `$1`、`$&`、`%+`(`$+{name}`)、`qr//`、リストコンテキストのマッチ | ✅ | |
| `split`(正規表現、limit、キャプチャ、`//`)、先読み・後読み、最短一致、後方参照 `\1` | ✅ | |
| 任意の区切り文字: `m@a@`、`m"a"`、`s!a!b!`、`s{a}{b}`、`qw@a b@` | ✅ | |
| `pos()`、`\G`、スカラーの `//g` の位置 | ➖ | スカラーの `//g` ループ(`while ($s =~ /x/g)`)は動きます |
| 文字列中の `` $` `` と `$'`、`@-` / `@+` | ➖ | |
| 再帰パターン `(?R)`、アトミックグループ `(?>...)`、強欲量指定子 | ➖ | JavaScript の正規表現エンジンにはありません |
| `use utf8` なしのテキストに対する `\p{L}` などのUnicodeプロパティ | 🟡 | |

## 時間

| 関数 | | 備考 |
|---|---|---|
| `time`、`localtime`、`gmtime`(リスト・スカラー両方のコンテキスト) | ✅ | |
| `sleep`, `select(undef, undef, undef, $secs)` | ✅ | 待つ間ページを止めます。`sleep($secs, sub { ... })` は止めません |
| `times`、`alarm` | ➖ | |

## 出力

| 関数 | | 備考 |
|---|---|---|
| `print` `printf` `say`(`print;` は `$_` を出力)、`print STDOUT`、`print STDERR`(`console.warn` へ)、`$,` `$\` `$|`、`binmode` | ✅ | |
| ヒアドキュメント(`<<"EOT"`、`<<'EOT'`、`<<~EOT`) | ✅ | |
| `$0` | 🟡 | `main.p2j` |
| `sprintf("%.0f", 0.5)` | ✅ | ちょうど半分の値は C と同じく偶数に丸めます(0.5, 1.5, 2.5 → `0 2 2`) |

## リファレンスとオブジェクト

| 機能 | | 備考 |
|---|---|---|
| `ref`, `bless`, `->isa`, `->can`, `@ISA`, `use parent`, `SUPER::`, `__PACKAGE__->method` | ✅ | |
| `\$x`、`\@a`、`\%h`、`\&f`、`$$r`、`@$r`、`%$r`、`$r->[0]`、`"$ref"` の `ARRAY(0x...)` 表示、リファレンスの `==` | ✅ | |
| `undef $x` / `undef @a` / `undef %h`、`defined`、`local $_` | ✅ | |
| `Scalar::Util`(`blessed reftype looks_like_number refaddr`)、`use constant` | ✅ | |
| リファレンスへのリファレンスの `ref(\\$x)` | 🟡 | `SCALAR` を返します(Perl は `REF`) |
| `AUTOLOAD`, `DESTROY`, `use overload`, `tie` | ➖ | |
| `\$h{k}` / `\$a[0]`(要素へのリファレンス) | ➖ | |

## ブラウザではできないもの

| 分野 | 関数 |
|---|---|
| ファイルとディレクトリ | `open` `close` `print FH` `<FH>` `readline` `eof` `seek` `tell` `opendir` `readdir` `mkdir` `rmdir` `unlink` `rename` `stat` `lstat` `chdir` `glob` `-e -f -d -r -w -x -s` |
| プロセス | `system` `exec` `fork` `wait` `waitpid` `kill` `` `backticks` `` `%SIG` `$$` `getppid` |
| ネットワークとユーザー | `socket` `connect` `bind` `listen` `accept` `getpwnam` `getlogin` |
| 端末からの入力 | `<STDIN>` `getc` `read` `sysread` `syswrite` (フォームの入力欄と `$("#input")->val` を使ってください) |

`%ENV` と `@ARGV` は存在しますが空です。

足りないものがあれば、1行のプログラムと本物の Perl の出力を添えて [Issue](https://github.com/satorunet/perl2js/issues) でお知らせください。
