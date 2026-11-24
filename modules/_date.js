/* internal: calendar / time-zone / strftime primitives shared by the date modules */
Perl2JS.module({ name: '_date', init(api) {
  const { hide } = api;
/* ------------------------------------------------------------------ dates */
// localtime/gmtime, POSIX::strftime, Time::Local, Time::Piece (+Time::Seconds), Time::HiRes, DateTime
const DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const p2 = (n, w, c) => String(Math.trunc(n)).padStart(w === undefined ? 2 : w, c === undefined ? '0' : c);
const fmtCache = {};

// calendar fields of an instant in a zone: 'UTC' | 'local' | IANA name
function tzParts(ms, tz) {
  if (tz === 'UTC') { const d = new Date(ms); return { Y: d.getUTCFullYear(), M: d.getUTCMonth(), D: d.getUTCDate(), h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), w: d.getUTCDay(), off: 0 }; }
  if (!tz || tz === 'local') { const d = new Date(ms); return { Y: d.getFullYear(), M: d.getMonth(), D: d.getDate(), h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), w: d.getDay(), off: -d.getTimezoneOffset() * 60 }; }
  let f = fmtCache[tz];
  if (!f) f = fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' });
  const o = {};
  for (const x of f.formatToParts(new Date(ms))) o[x.type] = x.value;
  const Y = +o.year, M = +o.month - 1, D = +o.day, h = +o.hour % 24, m = +o.minute, s = +o.second;
  return { Y, M, D, h, m, s, w: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday), off: Math.round((Date.UTC(Y, M, D, h, m, s) - Math.floor(ms / 1000) * 1000) / 1000) };
}
const utcMs = (Y, M, D, h, m, s) => { const d = new Date(0); d.setUTCFullYear(Y, M, D); d.setUTCHours(h, m, s, 0); return d.getTime(); };
function fromParts(Y, M, D, h, m, s, tz) {
  if (tz === 'UTC') return utcMs(Y, M, D, h, m, s);
  if (!tz || tz === 'local') { const d = new Date(2000, 0, 1, h, m, s); d.setFullYear(Y, M, D); return d.getTime(); }
  const guess = utcMs(Y, M, D, h, m, s);
  const o1 = tzParts(guess, tz).off;
  let ms = guess - o1 * 1000;
  const o2 = tzParts(ms, tz).off;
  if (o2 !== o1) ms = guess - o2 * 1000;
  return ms;
}
const ydayOf = (Y, M, D) => Math.round((utcMs(Y, M, D, 0, 0, 0) - utcMs(Y, 0, 1, 0, 0, 0)) / 86400000);
const isLeap = (Y) => (Y % 4 === 0 && Y % 100 !== 0) || Y % 400 === 0;
const monthDays = (Y, M) => [31, isLeap(Y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][M];
function isoWeek(Y, M, D) {
  const d = new Date(utcMs(Y, M, D, 0, 0, 0));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const iy = d.getUTCFullYear(), thu = new Date(utcMs(iy, 0, 4, 0, 0, 0));
  return [iy, 1 + Math.round(((d - thu) / 86400000 - 3 + ((thu.getUTCDay() + 6) % 7)) / 7)];
}
function tzName(ms, tz) {
  if (tz === 'UTC') return 'UTC';
  try {
    const name = (style) => { const r = new Intl.DateTimeFormat('en-US', { timeZone: !tz || tz === 'local' ? undefined : tz, timeZoneName: style }).formatToParts(new Date(ms)).find((x) => x.type === 'timeZoneName'); return r ? r.value : ''; };
    const short = name('short');
    // en-US only knows PST/EST...; elsewhere it says "GMT+9", so build "JST" from "Japan Standard Time"
    if (/^GMT[+-]/.test(short)) { const long = name('long'); return /^GMT/.test(long) ? short : long.split(/\s+/).map((w) => w[0]).join('').toUpperCase(); }
    return short;
  } catch (e) { return ''; }
}
function strftimeMs(fmt, ms, tz) {
  const P = tzParts(ms, tz), yd = ydayOf(P.Y, P.M, P.D);
  const h12 = P.h % 12 === 0 ? 12 : P.h % 12;
  const sign = P.off < 0 ? '-' : '+', ao = Math.abs(P.off);
  const f = {
    a: () => DAYN[P.w].slice(0, 3), A: () => DAYN[P.w], b: () => MONN[P.M].slice(0, 3), h: () => MONN[P.M].slice(0, 3), B: () => MONN[P.M],
    c: () => strftimeMs('%a %b %e %H:%M:%S %Y', ms, tz), C: () => p2(Math.floor(P.Y / 100)), d: () => p2(P.D), D: () => strftimeMs('%m/%d/%y', ms, tz),
    e: () => p2(P.D, 2, ' '), F: () => strftimeMs('%Y-%m-%d', ms, tz), G: () => String(isoWeek(P.Y, P.M, P.D)[0]), g: () => p2(isoWeek(P.Y, P.M, P.D)[0] % 100),
    H: () => p2(P.h), I: () => p2(h12), j: () => p2(yd + 1, 3), k: () => p2(P.h, 2, ' '), l: () => p2(h12, 2, ' '), m: () => p2(P.M + 1), M: () => p2(P.m),
    n: () => '\n', p: () => (P.h < 12 ? 'AM' : 'PM'), P: () => (P.h < 12 ? 'am' : 'pm'), r: () => strftimeMs('%I:%M:%S %p', ms, tz), R: () => strftimeMs('%H:%M', ms, tz),
    s: () => String(Math.floor(ms / 1000)), S: () => p2(P.s), t: () => '\t', T: () => strftimeMs('%H:%M:%S', ms, tz), u: () => String(P.w === 0 ? 7 : P.w),
    U: () => p2(Math.floor((yd + 7 - P.w) / 7)), V: () => p2(isoWeek(P.Y, P.M, P.D)[1]), w: () => String(P.w), W: () => p2(Math.floor((yd + 7 - ((P.w + 6) % 7)) / 7)),
    x: () => strftimeMs('%m/%d/%y', ms, tz), X: () => strftimeMs('%H:%M:%S', ms, tz), y: () => p2(P.Y % 100), Y: () => String(P.Y),
    z: () => sign + p2(Math.floor(ao / 3600)) + p2(Math.floor((ao % 3600) / 60)), Z: () => tzName(ms, tz), '%': () => '%',
  };
  return String(fmt).replace(/%([a-zA-Z%])/g, (all, c) => (f[c] ? f[c]() : all));
}


const defs2 = (proto, o) => { for (const k of Object.keys(o)) hide(proto, k, o[k]); };
const forwardStr = (proto) => { for (const k of ['$m', '$nm', '$sub', '$tr', '$trc', '$x']) hide(proto, k, function (...a) { return String.prototype[k].apply(String(this), a); }); };

return { shared: { DAYN, MONN, p2, tzParts, utcMs, fromParts, ydayOf, isLeap, monthDays, isoWeek, tzName, strftimeMs, defs2, forwardStr } };
} });
