/* Carp — croak / carp / confess / cluck  (messages get " at line N." like die) */
Perl2JS.module({ name: 'Carp', init(api) {
  const { RT, _s } = api;
  const text = (a) => { const l = a.flat(1); if (l.length === 1 && l[0] !== null && typeof l[0] === 'object') return l[0]; let m = l.map(_s).join('') || 'Died'; if (!/\n$/.test(m)) m += ' at line ' + RT._ln.v + '.\n'; return m; };
  const warn = (a) => { const m = text(a); console.warn(String(m).replace(/\n$/, '')); return 1; };
  const exports = {
    croak: (...a) => { throw text(a); }, confess: (...a) => { throw text(a); },
    carp: (...a) => warn(a), cluck: (...a) => warn(a),
  };
  return { exports, default: ['croak', 'carp', 'confess'], withLine: ['croak', 'carp', 'confess', 'cluck'] };
} });
