/* JSON::XS — same as JSON */
Perl2JS.module({ name: 'JSON::XS', deps: ['JSON'], init(api) { const j = api.use('JSON'); return { exports: j.exports, default: j.default, unary: j.unary, classes: { 'JSON::XS': j.classes.JSON } }; } });
