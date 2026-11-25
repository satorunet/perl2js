package Acme::Hello;
use strict;
use warnings;
use Exporter qw(import);

our $VERSION   = '1.0.0';
our @EXPORT_OK = qw(hello);

sub hello {
    my ($name) = @_;
    $name = 'world' unless defined $name;
    return "Hello, $name!";
}

sub new {
    my ($class, %args) = @_;
    return bless { greeting => $args{greeting} || 'Hello' }, $class;
}

sub greet {
    my ($self, $name) = @_;
    return "$self->{greeting}, $name!";
}

1;
