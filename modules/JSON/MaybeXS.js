/* JSON::MaybeXS — same as JSON */
Perl2JS.module({ name: 'JSON::MaybeXS', deps: ['JSON'], init(api) { const j = api.use('JSON'); return { exports: j.exports, default: j.default, unary: j.unary, classes: { 'JSON::MaybeXS': j.classes.JSON } }; } });
