/* Time::Piece — localtime/gmtime objects, ->ymd ->strftime ..., Time::Piece->strptime */
Perl2JS.module({ name: 'Time::Piece', deps: ['_date', 'Time::Seconds'], init(api) {
  const { hide, mk, RT } = api;
  const { DAYN, MONN, p2, tzParts, utcMs, fromParts, ydayOf, isLeap, monthDays, isoWeek, strftimeMs, defs2, forwardStr } = api.use('_date').shared;
  let TPMODE = false;
/* ---- Time::Piece (also the value returned by localtime/gmtime) ---- */
class TP extends Array { static get [Symbol.species]() { return Array; } }
function mkTP(epoch, utc) {
  const t = new TP();
  const P = tzParts(epoch * 1000, utc ? 'UTC' : 'local');
  t.push(P.s, P.m, P.h, P.D, P.M, P.Y - 1900, P.w, ydayOf(P.Y, P.M, P.D), 0);
  hide(t, '_e', epoch); hide(t, '_u', !!utc);
  return t;
}
const tpz = (t) => (t._u ? 'UTC' : 'local');
const tpP = (t) => tzParts(t._e * 1000, tpz(t));
defs2(TP.prototype, {
  __perlCall: true,
  sec() { return this[0]; }, second() { return this[0]; }, min() { return this[1]; }, minute() { return this[1]; }, hour() { return this[2]; },
  mday() { return this[3]; }, day_of_month() { return this[3]; }, mon() { return this[4] + 1; }, _mon() { return this[4]; },
  monname() { return MONN[this[4]].slice(0, 3); }, month() { return MONN[this[4]].slice(0, 3); }, fullmonth() { return MONN[this[4]]; },
  year() { return this[5] + 1900; }, _year() { return this[5]; }, yy() { return (this[5] + 1900) % 100; },
  wday() { return this[6] + 1; }, _wday() { return this[6]; }, day_of_week() { return this[6]; },
  wdayname() { return DAYN[this[6]].slice(0, 3); }, day() { return DAYN[this[6]].slice(0, 3); }, fullday() { return DAYN[this[6]]; },
  yday() { return this[7]; }, day_of_year() { return this[7]; }, isdst() { return 0; }, daylight_savings() { return 0; },
  hms(sep) { sep = sep === undefined ? ':' : sep; return p2(this[2]) + sep + p2(this[1]) + sep + p2(this[0]); },
  ymd(sep) { sep = sep === undefined ? '-' : sep; return this[5] + 1900 + sep + p2(this[4] + 1) + sep + p2(this[3]); },
  mdy(sep) { sep = sep === undefined ? '-' : sep; return p2(this[4] + 1) + sep + p2(this[3]) + sep + (this[5] + 1900); },
  dmy(sep) { sep = sep === undefined ? '-' : sep; return p2(this[3]) + sep + p2(this[4] + 1) + sep + (this[5] + 1900); },
  time(sep) { return this.hms(sep); }, date(sep) { return this.ymd(sep); },
  datetime() { return this.ymd('-') + 'T' + this.hms(':'); },
  cdate() { return strftimeMs('%a %b %e %H:%M:%S %Y', this._e * 1000, tpz(this)); },
  epoch() { return this._e; },
  julian_day() { return this._e / 86400 + 2440587.5; }, mjd() { return this._e / 86400 + 40587; },
  week() { const P = tpP(this); return isoWeek(P.Y, P.M, P.D)[1]; },
  is_leap_year() { return isLeap(this[5] + 1900); }, month_last_day() { return monthDays(this[5] + 1900, this[4]); },
  tzoffset() { return tpP(this).off; },
  strftime(fmt) { return strftimeMs(fmt === undefined ? '%a, %d %b %Y %H:%M:%S %Z' : fmt, this._e * 1000, tpz(this)); },
  add_months(n) { const P = tpP(this); return mkTP(fromParts(P.Y, P.M + n, P.D, P.h, P.m, P.s, tpz(this)) / 1000, this._u); },
  add_years(n) { return this.add_months(n * 12); },
  truncate(...a) {
    const o = {}; for (let k = 0; k < a.length; k += 2) o[a[k]] = a[k + 1];
    const P = tpP(this), to = o.to || 'second';
    const keep = { year: [P.Y, 0, 1, 0, 0, 0], quarter: [P.Y, Math.floor(P.M / 3) * 3, 1, 0, 0, 0], month: [P.Y, P.M, 1, 0, 0, 0], day: [P.Y, P.M, P.D, 0, 0, 0], hour: [P.Y, P.M, P.D, P.h, 0, 0], minute: [P.Y, P.M, P.D, P.h, P.m, 0], second: [P.Y, P.M, P.D, P.h, P.m, P.s] }[to];
    return mkTP(fromParts(...keep, tpz(this)) / 1000, this._u);
  },
  toString() { return this.cdate(); },
  valueOf() { return this._e; },
  $ncmp(o) { const a = +this, b = +o; return a < b ? -1 : a > b ? 1 : 0; },
  $scmp(o) { const a = String(this), b = String(o); return a < b ? -1 : a > b ? 1 : 0; },
});
Object.defineProperty(TP.prototype, Symbol.toPrimitive, { configurable: true, value(hint) { return hint === 'number' || (hint === 'default' && TPMODE) ? this._e : this.cdate(); } });
const TPAPI = new Set(['sec', 'second', 'min', 'minute', 'hour', 'mday', 'day_of_month', 'mon', '_mon', 'monname', 'month', 'fullmonth', 'year', '_year', 'yy', 'wday', '_wday',
  'day_of_week', 'wdayname', 'day', 'fullday', 'yday', 'day_of_year', 'hms', 'ymd', 'mdy', 'dmy', 'time', 'date', 'datetime', 'cdate', 'epoch', 'julian_day', 'mjd', 'week',
  'is_leap_year', 'month_last_day', 'tzoffset', 'strftime', 'add_months', 'add_years', 'truncate']);
function strptime(str, fmt) {
  const v = { Y: 1970, m: 1, d: 1, H: 0, M: 0, S: 0, off: 0, pm: null, epoch: null };
  const names = (arr, full) => '(' + arr.map((x) => (full ? x : x.slice(0, 3))).join('|') + ')';
  const keys = [];
  const rx = String(fmt).replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '%' ? c : '\\' + c)).replace(/%([a-zA-Z%])/g, (all, c) => {
    switch (c) {
      case 'Y': keys.push('Y'); return '(\\d{4})'; case 'm': keys.push('m'); return '(\\d{1,2})'; case 'd': case 'e': keys.push('d'); return '\\s*(\\d{1,2})';
      case 'H': case 'k': keys.push('H'); return '\\s*(\\d{1,2})'; case 'I': case 'l': keys.push('I'); return '\\s*(\\d{1,2})'; case 'M': keys.push('M'); return '(\\d{1,2})';
      case 'S': keys.push('S'); return '(\\d{1,2})'; case 'y': keys.push('y'); return '(\\d{2})'; case 'j': keys.push('j'); return '(\\d{1,3})';
      case 'b': case 'B': case 'h': keys.push('b'); return '(' + MONN.map((x) => x + '|' + x.slice(0, 3)).join('|') + ')';
      case 'a': case 'A': keys.push('skip'); return '(' + DAYN.map((x) => x + '|' + x.slice(0, 3)).join('|') + ')';
      case 'p': case 'P': keys.push('p'); return '(AM|PM|am|pm)'; case 's': keys.push('s'); return '(\\d+)';
      case 'z': keys.push('z'); return '(Z|[+-]\\d{2}:?\\d{2})'; case 'Z': keys.push('skip'); return '([A-Za-z]+)';
      case 'T': keys.push('H', 'M', 'S'); return '(\\d{1,2}):(\\d{1,2}):(\\d{1,2})'; case 'R': keys.push('H', 'M'); return '(\\d{1,2}):(\\d{1,2})';
      case 'F': keys.push('Y', 'm', 'd'); return '(\\d{4})-(\\d{1,2})-(\\d{1,2})'; case 'D': keys.push('m', 'd', 'y'); return '(\\d{1,2})/(\\d{1,2})/(\\d{2})';
      case 'n': case 't': return '\\s+'; case '%': return '%'; default: return all;
    }
  });
  const m = new RegExp('^\\s*' + rx + '\\s*$').exec(String(str));
  if (!m) throw 'Error parsing time at line ' + RT._ln.v + '.\n';
  keys.forEach((k, i) => {
    const x = m[i + 1];
    if (k === 'b') v.m = MONN.findIndex((n) => n.toLowerCase().startsWith(x.slice(0, 3).toLowerCase())) + 1;
    else if (k === 'y') v.Y = +x < 69 ? 2000 + +x : 1900 + +x;
    else if (k === 'I') v.H = +x % 12 + (v.pm === true ? 12 : 0), v.hr12 = +x;
    else if (k === 'p') { v.pm = /pm/i.test(x); if (v.hr12 !== undefined) v.H = v.hr12 % 12 + (v.pm ? 12 : 0); }
    else if (k === 'j') v.j = +x;
    else if (k === 's') v.epoch = +x;
    else if (k === 'z') v.off = x === 'Z' ? 0 : (x[0] === '-' ? -1 : 1) * (+x.slice(1, 3) * 3600 + +x.slice(-2) * 60);
    else if (k !== 'skip') v[k] = +x;
  });
  if (v.epoch !== null) return mkTP(v.epoch, true);
  const ms = v.j ? utcMs(v.Y, 0, v.j, v.H, v.M, v.S) : utcMs(v.Y, v.m - 1, v.d, v.H, v.M, v.S);
  return mkTP(ms / 1000 - v.off, true);
}


const TimePiece = { strptime, new: (t) => mkTP(t === undefined ? Math.floor(Date.now() / 1000) : +t, false), localtime: (t) => mkTP(t === undefined ? Math.floor(Date.now() / 1000) : +t, false), gmtime: (t) => mkTP(t === undefined ? Math.floor(Date.now() / 1000) : +t, true) };
hide(TimePiece, '__perlCall', true);

forwardStr(TP.prototype);
hide(TP.prototype, '__listlike', true);                       // flattened inside (list) literals
hide(TP.prototype, '__scalar', function () { return this.cdate(); });   // scalar(localtime)
api.NUMHOOKS.push((num, n, call) => { if (TPAPI.has(n)) { const t = mkTP(num, false); return call ? (...a) => t[n](...a) : t[n](); } });
const now = () => Math.floor(Date.now() / 1000);
return {
  classes: { 'Time::Piece': TimePiece },
  default: ['localtime', 'gmtime'],
  scope() { TPMODE = true; return { localtime_: (t) => mkTP(Math.floor(t === undefined ? Date.now() / 1000 : +t), false), gmtime_: (t) => mkTP(Math.floor(t === undefined ? Date.now() / 1000 : +t), true) }; },
};
} });
