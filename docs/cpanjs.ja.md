# CPANjs — モジュールを登録する

[English](cpanjs.md) | **日本語** · [ドキュメント一覧](README.ja.md)

**CPANjs** は、CPAN のように、誰でもモジュールを登録して使える仕組みです。登録は GitHub の Pull Request で行い、確認してマージされると公開されます。公開中のモジュールは [一覧](https://satoru.net/perl2js/cpanjs/) で検索できます。

## 使う

`use` するだけです。インストールは要りません。

```perl2js
use Acme::Hello qw(hello);
print hello("Perl"), "\n";                      # Hello, Perl!
print Acme::Hello->new(greeting => "Hi")->greet("CPANjs"), "\n";
```

同梱モジュールに同じ名前がないときだけ、`perl2js.js` と同じ場所の `cpanjs/lib/` から読み込みます。

**何も設定しない場合**、CDN の `@main` なら最新のモジュールです (反映が半日ほど遅れることがあります)。

**版を固定する場合** (本番ではこれをおすすめします) は、その時点のコミット ID を指定します。

```js
Perl2JS.cpanjs = "https://cdn.jsdelivr.net/gh/satorunet/perl2js@コミットID/cpanjs/lib/";
```

**CPANjs を使わない場合**は、次のように設定します。

```js
Perl2JS.cpanjs = false;
```

> モジュールは、使うページの中で何でも実行できるコードです。登録時に確認していますが、安全を保証するものではありません。大事なページでは中身を読んで、版を固定してください。

## 登録する

1. [satorunet/perl2js](https://github.com/satorunet/perl2js) を Fork して、手元に clone します。
2. ひな形を作ります (JavaScript で書くときは `--js` を付けます)。

```text
node tools/cpanjs.js new Foo::Bar --author あなたのGitHubユーザー名
```

3. 次の 3 つのファイルを書きます。

| ファイル | 中身 |
|---|---|
| `cpanjs/lib/Foo/Bar.pm` (または `.js`) | モジュール本体。200KB まで |
| `cpanjs/lib/Foo/Bar.json` | `name` `version` `abstract` (1 行の説明) `authors` `license` |
| `cpanjs/t/Foo/Bar.pl` | `Test::More` のテスト (必須) |

4. `node tools/cpanjs.js check` が通ることを確認して、Pull Request を出します。同じチェックが GitHub 上でも自動で動きます。

## Perl で書くモジュール

いつもの `.pm` です。`package` / `sub` / `bless`、`use parent`、`@EXPORT` / `@EXPORT_OK` / `%EXPORT_TAGS`、ほかのモジュールの `use` が使えます。

```text
package Foo::Bar;
use strict;
use warnings;
use Exporter qw(import);

our @EXPORT_OK = qw(hello);

sub hello { return "Hello" }

1;
```

- ファイル名と同じ `package` が必要です。
- モジュールの中では `sleep` は使えません。
- 独自の `sub import` による取り込みには対応していません。
- そのほかは [Perl との違い](differences.ja.md) と同じです。

JavaScript で書くときの形式は [自作モジュールの書き方](writing-modules.ja.md) を参照してください。

## ルール

- 名前は先着順です。同梱モジュールやプラグマと同じ名前、大文字小文字だけが違う名前は登録できません。
- 更新できるのは、`authors` に入っている人だけです。コードを変えるときは `version` を上げます。
- 登録の Pull Request で変更できるのは `cpanjs/lib/` と `cpanjs/t/` だけです。一覧は自動で作られます。
- 削除してほしいときは Issue で依頼してください。
- 中身が読めない形 (難読化・圧縮)、利用者の情報を勝手に送るもの、外部からコードを取ってきて実行するもの、権利を侵害するものは登録できません。見つけた場合は削除します。

## 対応してほしい CPAN モジュールのリクエスト

対応してほしい CPAN モジュールや Perl の標準モジュールがあれば、**GitHub の Issue でリクエストしてください**: [リクエストを送る](https://github.com/satorunet/perl2js/issues/new?template=module-request.yml)。モジュール名と、使いたい機能のサンプルコードを書いてください。すべての対応を約束するものではありません。対応済みのものは [人気の CPAN モジュール](cpan.ja.md) にあります。

## 管理者向け: マージの前に確認すること

- 自動チェックが成功していて、変更が `cpanjs/lib/` と `cpanjs/t/` だけであること (`.github/` が変わる Pull Request は、チェックの結果を信用しないでください)。
- コードを読んで、上のルールに反していないこと。名前が有名なモジュールと紛らわしくないこと。
- マージした後、satoru.net で公開するにはサーバー側で `git pull` します。
