# 主要な CPAN モジュールの対応状況

[English](cpan.md) | **日本語** · [ドキュメント一覧](README.ja.md)

凡例: **✅ 同梱** (動作し、本物の Perl と比較済み) · **🟡 一部対応** (よく使う関数のみ) · **🌐 ブラウザの代替あり** (JS/DOM の方法を使う) · **⛔ ブラウザでは不可能** · **➖ 未対応**。
同梱モジュールの読み込み方: `use List::Util qw(sum);` と書くと `modules/List/Util.js` が必要に応じて読み込まれます ([同梱モジュール](modules.ja.md)を参照)。

> 対応してほしい CPAN モジュール・標準モジュールがあれば、[Issue でリクエスト](https://github.com/satorunet/perl2js/issues/new?template=module-request.yml)してください。自分で作って [CPANjs に登録](cpanjs.ja.md)することもできます。

## リスト、データ、テキスト

| モジュール | 状況 | 備考 |
|---|---|---|
| `List::Util` | ✅ | `sum min max first any all none reduce uniq shuffle pairs ...` |
| `List::MoreUtils` | 🟡 | `uniq any all firstidx indexes minmax part ...`。`zip`、`natatime`、`pairwise` はなし |
| `Scalar::Util` | ✅ | `blessed reftype looks_like_number refaddr weaken` (`weaken` は何もしません) |
| `Data::Dumper` | ✅ | `Indent`、`Sortkeys`、`Terse` |
| `JSON::PP`, `JSON`, `JSON::XS`, `JSON::MaybeXS` | ✅ | `encode_json decode_json`、`->pretty->canonical` |
| `Storable` | 🟡 | `dclone freeze thaw`。`store`/`retrieve` (ファイル) はなし |
| `Text::Wrap` | ✅ | |
| `Term::ANSIColor` | ✅ | 色コード。プレイグラウンドのペインではテキストとして表示されます |
| `Text::CSV`, `Text::CSV_XS` | ➖ | |
| `YAML`, `YAML::XS`, `TOML` | ➖ | |
| `Text::Template`, `Template` (TT) | ➖ | |

## エンコーディングとハッシュ

| モジュール | 状況 | 備考 |
|---|---|---|
| `Encode` | ✅ | UTF-8、Latin-1、UTF-16、**Shift_JIS / CP932 / EUC-JP**、ISO-2022-JP のデコード |
| `MIME::Base64` | ✅ | |
| `URI::Escape` | ✅ | |
| `URI` (オブジェクトインターフェース) | ➖ | ハイブリッド構文の `new URL(...)` を使ってください |
| `Digest::MD5`, `Digest::SHA` | ✅ | `md5_hex sha1_hex sha256_hex hmac_sha256_hex`。SHA-512 はなし |

## 時刻

| モジュール | 状況 | 備考 |
|---|---|---|
| `POSIX` | 🟡 | `strftime mktime floor ceil fmod pow round trunc`、各種上限値 |
| `Time::Local` | ✅ | `timelocal timegm` |
| `Time::Piece`, `Time::Seconds` | ✅ | |
| `Time::HiRes` | 🟡 | `time gettimeofday tv_interval sleep usleep`。`sleep` は待つ間ページが止まります |
| `DateTime`, `DateTime::Duration` | ✅ | 実際のタイムゾーン (IANA 名) に対応 |
| `DateTime::Format::*`, `Date::Calc` | ➖ | |

## 制御フローとテスト

| モジュール | 状況 | 備考 |
|---|---|---|
| `Carp` | ✅ | `croak carp confess cluck` |
| `Try::Tiny` | ✅ | `try/catch/finally` |
| `Test::More` | ✅ | TAP 出力 |
| `constant`, `strict`, `warnings`, `utf8`, `parent`, `base` | ✅ | 言語の一部です |
| `Moose`, `Moo`, `Mouse` | ➖ | 素の `package`/`bless` を使ってください ([構文](syntax.ja.md)) |
| `Class::Accessor`, `Object::Pad` | ➖ | |
| `Readonly`, `Const::Fast` | ➖ | `use constant` を使ってください |
| `Benchmark` | ➖ | `Time::HiRes` を使ってください |

## ファイル、数学、システム

| モジュール | 状況 | 備考 |
|---|---|---|
| `File::Basename`, `File::Spec` | ✅ | 文字列処理のみ |
| `Math::Trig` | ✅ | |
| `Math::BigInt`, `Math::BigFloat` | ➖ | JavaScript の `BigInt` はハイブリッド構文から利用できます |
| `File::Temp`, `File::Find`, `File::Slurp`, `Path::Tiny`, `Cwd`, `IO::File` | ⛔ | ブラウザにはファイルシステムがありません |
| `Getopt::Long`, `Pod::Usage` | ⛔ | コマンドラインがありません |
| `Socket`, `IO::Socket`, `Net::*` | ⛔ | 生のソケットはありません |

## Web とデータベース

| モジュール | 状況 | 備考 |
|---|---|---|
| jQuery 風の `$("#id")->on(...)->fadeIn` | ✅ | `modules/jQuery.js`。`$` を使うと読み込まれます。[ブラウザ](browser.ja.md)を参照 |
| `LWP::UserAgent`, `HTTP::Tiny`, `Mojo::UserAgent` | 🌐 | `$->get`、`$->post`、`$->ajax` |
| `CGI`, `CGI::Cookie` | ✅ | Cookie の処理のみ。[モジュール](modules.ja.md#cgi-cookie)を参照 |
| `Plack`, `Mojolicious`, `Dancer2` | ⛔ | サーバー用フレームワーク |
| `DBI` とドライバ | ⛔ | データベースドライバがありません。`$->ajax` で HTTP API を呼び出してください |

必要なものが足りませんか? [数行で自分で書く](writing-modules.ja.md)か、issue を開いてください。
