<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo.svg">
    <img alt="Perl2JS" src="assets/logo-light.svg" width="520">
  </picture>
</p>

<p align="center"><a href="README.md">English</a> | <b>日本語</b></p>

**Perl2JS** は、Perl風の構文で書いたコードを、**ブラウザの中でJavaScriptにコンパイルして実行**します(サーバー不要・WebAssembly不要)。
`my $x`、`@list`、`%hash`、`->{}`、`=~ s///`、`sub`、`package` / `bless`、ヒアドキュメントなどが書けて、DOMや `console`、内蔵のjQuery風 `$("#id")` もそのまま呼べます。

**▶ 試す:** <https://satoru.net/perl2js/>(サンプル26本入りのプレイグラウンド)

## クイックスタート

HTMLに貼るだけです。`print` の出力は `<pre id="output">` に書き込まれます(ページに無ければ自動で作ります)。

```html
<script src="perl2js.js"></script>
<script type="text/perl2js">
  use strict;
  use warnings;
  use List::Util qw(sum max);

  my %stock = (apple => 3, banana => 5, cherry => 2);

  # 数量の多い順に並べる
  for my $name (sort { $stock{$b} <=> $stock{$a} } keys %stock) {
      printf "%-8s %s\n", $name, "#" x $stock{$name};
  }

  my @words = map { ucfirst lc } qw(hELLO wORLD from PERL2JS);
  print join(" ", @words), "!\n";

  print "total: ", sum(values %stock), "  max: ", max(values %stock), "\n";

  if ("2026-11-24" =~ /^(\d+)-(\d+)-(\d+)$/) {
      print "year $1, month $2, day $3\n";
  }
</script>
```

```
banana   #####
apple    ###
cherry   ##
Hello World From Perl2js!
total: 10  max: 5
year 2026, month 11, day 24
```

### ページを操作する(jQuery風)

```html
<script type="text/perl2js">
  my $n = 0;
  $("#hello")->on("click", sub {
      $n++;
      $("#hello-n")->text(" ← ${n}回クリックされました");
  });
</script>
```

### そのほかの実行方法

- 外部ファイル: `<script type="text/perl2js" src="app.p2j"></script>`(拡張子は何でも構いません。`require "lib/util.p2j";` で別ファイルも取り込めます)
- JavaScriptから: `Perl2JS.run('print "hi\n"')`、`await Perl2JS.runAsync(src)`、`Perl2JS.compile(src)`(生成されたJSを返します)
- Node.js: `const Perl2JS = require('./perl2js.js'); Perl2JS.run(src);`
- `perl2js.js` と `modules/` フォルダを同じ場所に置いてください(場所は `Perl2JS.libPath = "/path/"` で変更できます)。
- モダンブラウザ(ES2021)が必要です。

## モジュールは必要な時だけ読み込まれます

コアは小さく保っています(約100KB、gzipで約29KB)。`use List::Util qw(sum);` と書いたときだけ、`modules/List/Util.js` を読み込みます。

| | |
|---|---|
| データ・文字列 | `Data::Dumper` `JSON::PP` `JSON` `Storable` `Text::Wrap` `Term::ANSIColor` `Encode`(UTF-8 / Shift_JIS / EUC-JP)`MIME::Base64` `URI::Escape` `Digest::MD5` `Digest::SHA` |
| リスト・型 | `List::Util` `List::MoreUtils` `Scalar::Util` |
| 日付・時刻 | `POSIX` `Time::Local` `Time::Piece` `Time::Seconds` `Time::HiRes` `DateTime` |
| 制御・テスト | `Carp` `Try::Tiny`(Perl 5.34 の `try/catch` も)`Test::More` |
| ファイル名・数学 | `File::Basename` `File::Spec` `Math::Trig` |
| ブラウザ | `$("#id")` jQuery互換API(自動で読み込み)、`document` / `console` などの直接呼び出し |

ほとんどのモジュールは、本物のPerlのモジュールと同じスクリプトで出力を比べて確認しています。対応状況(対応・一部対応・ブラウザでは対象外)の一覧は、上のページにあります。

自分でモジュールも作れます。1ファイル = 1モジュールで、`modules/Foo/Bar.js` に置きます。

```js
Perl2JS.module({
  name: 'Foo::Bar',
  init(api) {
    return { exports: { hello: (name) => 'Hello, ' + name }, default: [], unary: ['hello'] };
  },
});
```

## 仕組み

Perlのソース → トークン → トークン単位の書き換え(後置の `if`、暗黙の戻り値、`try` など)→ JavaScriptのソース → `new Function`。
スカラー・配列・ハッシュは、生成コード内でもシジルを残した名前(`$x`、`_a$list`、`_h$map`)にするので、出力は読みやすい形です。
エラーは、Perlの行番号・ソースの抜粋・ヒント付きで、コンソールとページの両方に表示されます。

## ファイル構成

```
perl2js.js        コンパイラ + ランタイム(コア)
modules/          Perlモジュール(use で読み込み)
index.html        プレイグラウンド + ドキュメント
demo.html, require-demo.html, hello.p2j, main.p2j, lib/   小さなサンプル
assets/           ロゴ
```

## Perlとの違い

- 数値はJavaScriptの倍精度です(2^53 を超える整数は精度が落ちます)。表示はPerlと同じ形式(`%.15g`)にしています。
- ファイル・ネットワーク・プロセスのI/O、`AUTOLOAD` / `DESTROY` / `use overload` は未対応です。
- ソースは常にUnicodeの文字列として扱います(`use utf8` を付けた状態と同じです)。
- リスト文脈とスカラー文脈は、完全には追跡せず、近似しています。
