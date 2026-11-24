# 自作モジュールの書き方

[English](writing-modules.md) | **日本語** · [ドキュメント一覧](README.ja.md)

モジュールは **JavaScript ファイル 1 つ** です。`use Acme::Tools qw(greet);` と書くと、プログラムが最初に要求したときに `modules/Acme/Tools.js` が読み込まれる (ブラウザでは `fetch`、Node では `fs` 経由) ので、コアが肥大化することはありません。

## 1. ファイルを作る

`modules/Acme/Tools.js` (パスはモジュール名の `::` を `/` にしたものです):

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

## 2. 使う

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

次の表は、`init` が返せるすべての項目の一覧です。

| キー | 意味 |
|---|---|
| `exports` | `{ name: value }`。`use Mod qw(name)` でインポートできる関数と定数です。完全修飾名での呼び出し (`Acme::Tools::clamp(...)`) も動作します。 |
| `default` | リストなしの `use Mod;` でインポートされる名前です。 |
| `unary` | かっこなしで、ちょうど 1 つの引数を取る名前です (`greet "x" . "y"`)。 |
| `noarg` | 引数を取らない名前です (`PI` のような定数)。 |
| `listops` | かっこなしでリスト全体を引数に取る名前です (`push` のようなもの)。 |
| `blockfns` | `{ name: '$_' }` または `{ name: '$a, $b' }`。最初の引数がブロックである関数 (`name { ... } @list`) です。文字列はブロックの変数を表します。 |
| `classes` | `{ 'Foo::Bar': JsClass }`。`Foo::Bar->new(...)` や `Foo::Bar->method` を動作させます。 |
| `deps` (`name` と同じ階層) | 先に読み込む他のモジュールです (例: `deps: ['List::Util']`)。`api.use('List::Util')` でそれらを取得できます。 |
| `finish()` | プログラムの終了後に呼び出されます (バッファのフラッシュなど)。 |

`api` からは次のものが使えます: `G` (`G.$Data_Dumper_Indent` のような Perl のグローバル変数)、`mk` (リストを作る関数)、`Lst`、`RT` (ランタイムのヘルパー)、`_s` (Perl の値から文字列への変換)、`hide`、`pkg` (Perl のパッケージを作成)、`use(name)`。

## 3. 検索される場所

| 場所 | 方法 |
|---|---|
| `perl2js.js` と同じ場所 | `modules/Acme/Tools.js` (自動。jsDelivr CDN からでも動作します) |
| それ以外の場所 | 実行前に `Perl2JS.libPath = "/my/js/"` を設定します (ディレクトリで終わる任意の URL) |
| 読み込み済み | `Perl2JS.module({...})` を呼ぶ `<script>` がモジュールを登録します。fetch は行われません |

モジュールは単なるスクリプトです。ビルド手順も `import` も不要です。Perl の値 (文字列、数値、配列、プレーンなオブジェクト) を返してください。関数から返された JS の配列は、Perl のリスト/配列リファレンスになります。

## 4. Perl コードをライブラリにする

`.p2j` ファイルから、別の Perl ファイルを `require` することもできます。[browser.md](browser.ja.md) を参照してください。
