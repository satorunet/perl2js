/* POSIX — the commonly used subset (strftime, mktime, floor, ceil, fmod, pow, round, trunc, constants) */
Perl2JS.module({ name: 'POSIX', deps: ['_date'], init(api) {
  const { fromParts, strftimeMs } = api.use('_date').shared;
const flatArgs = (a) => a.flat(1);
const POSIXFN = {
  strftime: (fmt, ...a) => { const t = flatArgs(a); return strftimeMs(fmt, fromParts((t[5] === undefined ? 70 : t[5]) + 1900, t[4] || 0, t[3] === undefined ? 1 : t[3], t[2] || 0, t[1] || 0, t[0] || 0, 'local'), 'local'); },
  mktime: (...a) => { const t = flatArgs(a); return Math.floor(fromParts(t[5] + 1900, t[4], t[3], t[2], t[1], t[0], 'local') / 1000); },
  difftime: (a, b) => a - b,
  floor: Math.floor, ceil: Math.ceil, fmod: (a, b) => a % b, pow: Math.pow, round: (x) => Math.sign(x) * Math.round(Math.abs(x)), trunc: Math.trunc,
  strtol: (s, base) => parseInt(s, base || 10), tolower: (s) => String(s).toLowerCase(), toupper: (s) => String(s).toUpperCase(),
  INT_MAX: 2147483647, INT_MIN: -2147483648, UINT_MAX: 4294967295, DBL_MAX: Number.MAX_VALUE, DBL_MIN: 2.2250738585072014e-308, DBL_EPSILON: Number.EPSILON, FLT_EPSILON: 1.1920929e-7,
  LONG_MAX: Number.MAX_SAFE_INTEGER, LONG_MIN: Number.MIN_SAFE_INTEGER, EXIT_SUCCESS: 0, EXIT_FAILURE: 1,
};

const unary = ['floor', 'ceil', 'round', 'trunc', 'tolower', 'toupper'];
const listops = ['strftime', 'mktime', 'difftime', 'fmod', 'pow', 'strtol'];
return { exports: POSIXFN, default: Object.keys(POSIXFN), unary, listops };
} });
