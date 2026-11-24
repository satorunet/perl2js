# ブラウザで Perl2JS を使う

[English](browser.md) | **日本語** · [ドキュメント一覧](README.ja.md)

## 読み込み方

```html
<script src="https://cdn.jsdelivr.net/gh/satorunet/perl2js@main/perl2js.min.js"></script>
```

このタグ 1 つがコアのすべてです。モジュール (`List::Util`、`DateTime`、jQuery 風の `$` など) は、プログラムが最初に必要としたときに同じ場所から取得されるため、使わないページでは余計なものをダウンロードしません。
リリースを公開したら、`@main` ではなくリリースを指定してください (`perl2js@v0.1.0`)。

## ページ内の Perl

```html
<div id="out"></div>
<script type="text/perl2js">
  use List::Util qw(sum);
  my @n = (3, 1, 4);
  $("#out")->text("sum = " . sum(@n));
  print "printed text goes to <pre id=\"output\">\n";
</script>
```

* `print` は `id="output"` を持つ要素に書き込みます (存在しない場合は `<body>` の末尾に作られます)。
* コードをファイルに分けるには `<script type="text/perl2js" src="main.p2j"></script>` を使います。
* エラーは Perl の行番号とソース行つきでページ上に表示されます (`Perl2JS.renderError`)。ブラウザのコンソールには JavaScript の完全なエラーが出力されます。

### コードをファイルに分割する

行頭の `require "lib/util.p2j";` は、別のファイルを先に読み込みます (パスは require するファイルからの相対パスです)。すべてのファイルは 1 つのトップレベルスコープを共有するので、`lib/util.p2j` で定義した `sub` は `main.p2j` から呼び出せます。[`main.p2j`](../main.p2j)、[`lib/util.p2j`](../lib/util.p2j)、[`require-demo.html`](../require-demo.html) を参照してください。

## DOM と jQuery 風の `$`

`$("#id")` は組み込みで、おなじみの jQuery メソッドを持つラッパーを返します。メソッドチェーンが使え、コールバックは `sub { ... }` で書きます。

```perl2js
$("#stage")->html("<button id='b'>Click</button> <b id='n'>0</b>");
my $count = 0;
$("#b")->on("click", sub {
    $count++;
    $("#n")->text($count);
});
$("#stage")->fadeOut(300)->fadeIn(300);
```

| 分類 | メソッド |
|---|---|
| 選択 | `$("css")  $(sub { ... })` (ready)  `find children parent closest siblings next prev eq first last filter not has is` |
| 内容 | `html text val attr prop data append prepend before after remove empty clone replaceWith wrap` |
| クラスとスタイル | `addClass removeClass toggleClass hasClass css show hide toggle width height` |
| イベント | `on off one trigger click dblclick change input submit focus blur hover keydown keyup` |
| エフェクト | `fadeIn fadeOut fadeToggle slideUp slideDown slideToggle animate delay stop` |
| 反復 | `each map get length` |
| Ajax | `$->get  $->post  $->getJSON  $->ajax({ url => ..., success => sub { ... } })` |

ページがすでに本物の jQuery を読み込んでいる場合、`$` はそちらを使います。DOM オブジェクトもそのまま扱えます。[ハイブリッド構文](syntax.ja.md)を参照してください。

```perl2js
my $el = document.getElementById("out");
$el->{textContent} = "plain DOM";
```

## JavaScript API

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

実行時エラーは `PerlError` オブジェクトで、`.kind` (`compile` / `runtime`)、`.line` (Perl の行番号)、メッセージ、ソースの抜粋を持ちます。`Perl2JS.errorText(err)` でプレーンテキストに整形できます。

## プレイグラウンド

[satoru.net/perl2js](https://satoru.net/perl2js/) には、行番号つきエディタ、DevTools 風のコンソール、「generated JS」タブ、コピーボタン、実行可能な約 30 個のサンプルがあります。`Ctrl+Enter` でプログラムを実行します。その下の `#stage` 領域が DOM サンプルの描画先です。

## Node.js で使う

```js
const Perl2JS = require("./perl2js.js");
Perl2JS.run('print "Hello from Node\\n"; use List::Util qw(max); print max(1, 7, 3), "\\n";');
```

モジュールは、ファイルと同じ場所にある `modules/` ディレクトリから `fs` で読み込まれます。DOM はないため、`$` や `document` は使えません。
