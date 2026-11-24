# Perl2JS ドキュメント

[English](README.md) | **日本語** · [Playground](https://satoru.net/perl2js/) · [GitHub](https://github.com/satorunet/perl2js)

Perl2JS は、Perl 構文で書いたコードを **ブラウザ上で** JavaScript にコンパイルします。サーバーも WebAssembly も不要です。
これらのページにあるすべての `perl` コードブロックは、本物の Perl 5.40 と Perl2JS の両方で CI 風のチェック (`node tools/verify-docs.js docs/*.md`) にかけられ、出力が一致する必要があります。

| やりたいこと | 読むページ |
|---|---|
| 使える Perl の構文を例つきで知りたい | **[対応している構文](syntax.ja.md)** |
| 使える組み込み関数・使えない関数を知りたい | **[組み込み関数](functions.ja.md)** |
| Perl と JavaScript を混ぜて使いたい (`Math.max`、`document.getElementById`、`alert`) | [Perl + JavaScript ハイブリッド](syntax.ja.md) |
| `List::Util`、`JSON::PP`、`POSIX`、`DateTime`... を使いたい | **[同梱モジュール](modules.ja.md)** |
| 有名な CPAN モジュールが使えるか確認したい | **[主要な CPAN モジュールの対応状況](cpan.ja.md)** |
| 自分のモジュール (`use Foo::Bar`) を書きたい | **[自作モジュールの書き方](writing-modules.ja.md)** |
| Web ページに組み込み、DOM や jQuery 風の `$` を使いたい | [ブラウザでの使い方](browser.ja.md) |
| 本物の Perl と挙動が違う点を知りたい | [Perl との違い](differences.ja.md) |

## 30 秒でわかる使い方

```html
<script src="https://cdn.jsdelivr.net/gh/satorunet/perl2js@main/perl2js.min.js"></script>
<script type="text/perl2js">
  my @langs = qw(Perl JavaScript);
  for my $l (@langs) { print "Hello, $l!\n"; }
  $("#out")->text("done");            # jQuery-style DOM, built in
</script>
```

コア (`perl2js.js`) は意図的に小さく作られています。それ以外の機能 (`List::Util`、`DateTime`、jQuery 風の `$` など) は [`modules/`](../modules) にある別ファイルで、プログラムが最初に `use ...` と書いたときにダウンロードされます。
