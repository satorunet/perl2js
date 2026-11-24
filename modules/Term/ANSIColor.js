/* Term::ANSIColor — color / colored / colorstrip / uncolor and the :constants (RED, BOLD, RESET ...) */
Perl2JS.module({ name: 'Term::ANSIColor', init(api) {
  const { mk } = api;
  const A = { clear: 0, reset: 0, bold: 1, dark: 2, faint: 2, italic: 3, underline: 4, underscore: 4, blink: 5, reverse: 7, concealed: 8 };
  const names = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
  names.forEach((c, i) => { A[c] = 30 + i; A['on_' + c] = 40 + i; A['bright_' + c] = 90 + i; A['on_bright_' + c] = 100 + i; });
  const code = (attr) => {
    attr = String(attr).toLowerCase(); let m;
    if (attr in A) return String(A[attr]);
    if ((m = /^(on_)?ansi(\d+)$/.exec(attr)) && +m[2] < 256) return (m[1] ? '48;5;' : '38;5;') + m[2];
    if ((m = /^(on_)?grey(\d+)$/.exec(attr)) && +m[2] < 24) return (m[1] ? '48;5;' : '38;5;') + (232 + +m[2]);
    if ((m = /^(on_)?rgb([0-5])([0-5])([0-5])$/.exec(attr))) return (m[1] ? '48;5;' : '38;5;') + (16 + 36 * +m[2] + 6 * +m[3] + +m[4]);
    if ((m = /^(on_)?r(\d+)g(\d+)b(\d+)$/.exec(attr)) && +m[2] < 256 && +m[3] < 256 && +m[4] < 256) return (m[1] ? '48;2;' : '38;2;') + m[2] + ';' + m[3] + ';' + m[4];
    throw 'Invalid attribute name ' + attr + ' at line ' + api.RT._ln.v + '.\n';
  };
  const color = (...a) => { const l = a.flat(1).flatMap((x) => String(x).split(/[\s,]+/)).filter(Boolean); return l.length ? '\x1b[' + l.map(code).join(';') + 'm' : ''; };
  const colored = (first, ...rest) => {
    let attrs, text;
    if (Array.isArray(first)) { attrs = first; text = rest.flat(1).join(''); } else { text = String(first); attrs = rest.flat(1); }
    const c = color(...attrs);
    return c === '' ? text : c + text + '\x1b[0m';
  };
  const exports = {
    color, colored, colorvalid: (...a) => { try { a.flat(1).flatMap((x) => String(x).split(/[\s,]+/)).filter(Boolean).forEach(code); return 1; } catch (e) { return ''; } },
    colorstrip: (...a) => { const r = a.flat(1).map((s) => String(s).replace(/\x1b\[[\d;]*m/g, '')); return r.length === 1 ? r[0] : mk(r); },
    uncolor: (...a) => { const inv = {}; for (const k of Object.keys(A)) if (!(A[k] in inv)) inv[A[k]] = k; const out = []; for (const s of a.flat(1)) for (const n of String(s).replace(/^\x1b\[|m$/g, '').split(';')) out.push(inv[+n]); return mk(out); },
  };
  for (const k of Object.keys(A)) exports[k.toUpperCase()] = '\x1b[' + A[k] + 'm';
  return { exports, default: ['color', 'colored'], listops: ['color', 'colored', 'colorstrip', 'uncolor', 'colorvalid'], listfns: ['uncolor'] };
} });
