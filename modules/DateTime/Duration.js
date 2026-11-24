/* DateTime::Duration — comes with DateTime */
Perl2JS.module({ name: 'DateTime::Duration', deps: ['DateTime'], init(api) { return { classes: api.use('DateTime').classes }; } });
