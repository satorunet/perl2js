# Popular CPAN modules: status

**English** | [日本語](cpan.ja.md) · [Docs index](README.md)

Legend: **✅ bundled** (works, compared with real Perl) · **🟡 partial** (common functions only) · **🌐 browser equivalent** (use the JS/DOM way) · **⛔ not possible in a browser** · **➖ not yet**.
How to load a bundled module: `use List::Util qw(sum);` loads `modules/List/Util.js` on demand (see [Bundled modules](modules.md)).

## Lists, data and text

| Module | Status | Notes |
|---|---|---|
| `List::Util` | ✅ | `sum min max first any all none reduce uniq shuffle pairs ...` |
| `List::MoreUtils` | 🟡 | `uniq any all firstidx indexes minmax part ...`; no `zip`, `natatime`, `pairwise` |
| `Scalar::Util` | ✅ | `blessed reftype looks_like_number refaddr weaken` (`weaken` is a no-op) |
| `Data::Dumper` | ✅ | `Indent`, `Sortkeys`, `Terse` |
| `JSON::PP`, `JSON`, `JSON::XS`, `JSON::MaybeXS` | ✅ | `encode_json decode_json`, `->pretty->canonical` |
| `Storable` | 🟡 | `dclone freeze thaw`; no `store`/`retrieve` (files) |
| `Text::Wrap` | ✅ | |
| `Term::ANSIColor` | ✅ | colour codes; the playground pane shows them as text |
| `Text::CSV`, `Text::CSV_XS` | ➖ | |
| `YAML`, `YAML::XS`, `TOML` | ➖ | |
| `Text::Template`, `Template` (TT) | ➖ | |

## Encoding and hashing

| Module | Status | Notes |
|---|---|---|
| `Encode` | ✅ | UTF-8, Latin-1, UTF-16, **Shift_JIS / CP932 / EUC-JP**, ISO-2022-JP decode |
| `MIME::Base64` | ✅ | |
| `URI::Escape` | ✅ | |
| `URI` (object interface) | ➖ | use `new URL(...)` from the hybrid syntax |
| `Digest::MD5`, `Digest::SHA` | ✅ | `md5_hex sha1_hex sha256_hex hmac_sha256_hex`; no SHA-512 |

## Time

| Module | Status | Notes |
|---|---|---|
| `POSIX` | 🟡 | `strftime mktime floor ceil fmod pow round trunc`, limits |
| `Time::Local` | ✅ | `timelocal timegm` |
| `Time::Piece`, `Time::Seconds` | ✅ | |
| `Time::HiRes` | 🟡 | `time gettimeofday tv_interval`; `sleep`/`usleep` block the page while waiting |
| `DateTime`, `DateTime::Duration` | ✅ | with real time zones (IANA names) |
| `DateTime::Format::*`, `Date::Calc` | ➖ | |

## Control flow and testing

| Module | Status | Notes |
|---|---|---|
| `Carp` | ✅ | `croak carp confess cluck` |
| `Try::Tiny` | ✅ | `try/catch/finally` |
| `Test::More` | ✅ | TAP output |
| `constant`, `strict`, `warnings`, `utf8`, `parent`, `base` | ✅ | part of the language |
| `Moose`, `Moo`, `Mouse` | ➖ | use plain `package`/`bless` ([syntax](syntax.md#packages-and-objects)) |
| `Class::Accessor`, `Object::Pad` | ➖ | |
| `Readonly`, `Const::Fast` | ➖ | use `use constant` |
| `Benchmark` | ➖ | use `Time::HiRes` |

## Files, math, system

| Module | Status | Notes |
|---|---|---|
| `File::Basename`, `File::Spec` | ✅ | string handling only |
| `Math::Trig` | ✅ | |
| `Math::BigInt`, `Math::BigFloat` | ➖ | JavaScript's `BigInt` is reachable from the hybrid syntax |
| `File::Temp`, `File::Find`, `File::Slurp`, `Path::Tiny`, `Cwd`, `IO::File` | ⛔ | no file system in a browser |
| `Getopt::Long`, `Pod::Usage` | ⛔ | no command line |
| `Socket`, `IO::Socket`, `Net::*` | ⛔ | no raw sockets |

## Web and databases

| Module | Status | Notes |
|---|---|---|
| jQuery-style `$("#id")->on(...)->fadeIn` | ✅ | `modules/jQuery.js`, loaded when `$` is used; see [browser](browser.md) |
| `LWP::UserAgent`, `HTTP::Tiny`, `Mojo::UserAgent` | 🌐 | `$->get`, `$->post`, `$->ajax` |
| `CGI`, `Plack`, `Mojolicious`, `Dancer2` | ⛔ | server frameworks |
| `DBI` and drivers | ⛔ | no database driver; call an HTTP API with `$->ajax` |

Missing something you need? [Write it yourself in a few lines](writing-modules.md) or open an issue.
