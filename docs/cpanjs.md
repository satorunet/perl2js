# CPANjs — register a module

**English** | [日本語](cpanjs.ja.md) · [Docs index](README.md)

**CPANjs** lets anyone publish a module and `use` it, like CPAN. You register by GitHub Pull Request; the module is public once it has been reviewed and merged. [Search the published modules](https://satoru.net/perl2js/cpanjs/).

## Use a module

Just `use` it. There is nothing to install.

```perl2js
use Acme::Hello qw(hello);
print hello("Perl"), "\n";                      # Hello, Perl!
print Acme::Hello->new(greeting => "Hi")->greet("CPANjs"), "\n";
```

A module is looked up in `cpanjs/lib/` next to `perl2js.js`, only when no bundled module has that name.

**With no setting**, using the CDN `@main`, you get the latest modules (it can take about half a day to show up).

**To pin the version** (recommended in production), give the commit ID:

```js
Perl2JS.cpanjs = "https://cdn.jsdelivr.net/gh/satorunet/perl2js@COMMIT/cpanjs/lib/";
```

**To turn CPANjs off:**

```js
Perl2JS.cpanjs = false;
```

> A module is code that can do anything inside the page that uses it. Registrations are reviewed, but that is no guarantee. For important pages, read the code and pin the version.

## Register a module

1. Fork and clone [satorunet/perl2js](https://github.com/satorunet/perl2js).
2. Make the skeleton (add `--js` to write it in JavaScript):

```text
node tools/cpanjs.js new Foo::Bar --author your-github-id
```

3. Fill in the three files:

| File | Content |
|---|---|
| `cpanjs/lib/Foo/Bar.pm` (or `.js`) | The module, up to 200KB |
| `cpanjs/lib/Foo/Bar.json` | `name` `version` `abstract` (one line) `authors` `license` |
| `cpanjs/t/Foo/Bar.pl` | A `Test::More` test (required) |

4. Make sure `node tools/cpanjs.js check` passes, then open a Pull Request. The same check runs on GitHub.

## Modules written in Perl

A normal `.pm`: `package` / `sub` / `bless`, `use parent`, `@EXPORT` / `@EXPORT_OK` / `%EXPORT_TAGS`, and `use` of other modules.

```text
package Foo::Bar;
use strict;
use warnings;
use Exporter qw(import);

our @EXPORT_OK = qw(hello);

sub hello { return "Hello" }

1;
```

- The file needs a `package` with the same name as the module.
- `sleep` cannot be used inside a module.
- A custom `sub import` does not take part in importing.
- Otherwise the [differences from Perl](differences.md) apply.

For the JavaScript format see [Writing your own module](writing-modules.md).

## Rules

- Names are first come, first served. Names of bundled modules and pragmas, and names that differ only in letter case, cannot be registered.
- Only the people in `authors` can update a module. A code change needs a bigger `version`.
- A registration Pull Request may only change `cpanjs/lib/` and `cpanjs/t/`. The index is generated.
- Ask in an Issue to have a module removed.
- Obfuscated or minified code, code that sends user data without consent, code that downloads and runs other code, and infringing code are not accepted and will be removed.

## Request a CPAN module

If there is a CPAN or core Perl module you want supported, **request it in a GitHub Issue**: [open a request](https://github.com/satorunet/perl2js/issues/new?template=module-request.yml). Give the module name and sample code of the features you need. Not every request can be supported. See [popular CPAN modules](cpan.md) for what already works.

## For maintainers: before merging

- The check passed and only `cpanjs/lib/` and `cpanjs/t/` changed (do not trust the check of a Pull Request that changes `.github/`).
- Read the code against the rules above. The name must not be confusable with a well-known module.
- After merging, run `git pull` on the server to publish on satoru.net.
