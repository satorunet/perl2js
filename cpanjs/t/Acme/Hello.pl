use strict;
use warnings;
use Test::More tests => 3;
use Acme::Hello qw(hello);

is(hello(), 'Hello, world!', 'default name');
is(hello('Perl'), 'Hello, Perl!', 'with a name');
is(Acme::Hello->new(greeting => 'Hi')->greet('CPAN'), 'Hi, CPAN!', 'object');
