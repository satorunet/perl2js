/* DateTime / DateTime::Duration */
Perl2JS.module({ name: 'DateTime', deps: ['_date'], init(api) {
  const { hide, RT } = api;
  const { DAYN, MONN, p2, tzParts, utcMs, fromParts, ydayOf, isLeap, monthDays, isoWeek, tzName, strftimeMs, defs2, forwardStr } = api.use('_date').shared;
/* ---- DateTime ---- */
const dtOpts = (a) => { if (a.length === 1 && a[0] && typeof a[0] === 'object') return a[0]; const o = {}; for (let k = 0; k < a.length; k += 2) o[a[k]] = a[k + 1]; return o; };
class DTD {   // DateTime::Duration
  constructor(o) { Object.assign(this, { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0, nanoseconds: 0, _neg: false }, o); }
  static new(...a) { return new DTD(dtOpts(a)); }
  _secs() { return ((this.weeks * 7 + this.days) * 86400 + this.hours * 3600 + this.minutes * 60 + this.seconds); }
  is_negative() { return this._neg; }
  // like DateTime::Duration: months / days / seconds are separate groups and are never converted into each other
  in_units(...u) {
    let months = this.years * 12 + this.months, days = this.weeks * 7 + this.days, secs = this.hours * 3600 + this.minutes * 60 + this.seconds;
    const val = {};
    const has = (n) => u.includes(n);
    if (has('years')) { val.years = Math.trunc(months / 12); months -= val.years * 12; }
    if (has('months')) val.months = months;
    if (has('weeks')) { val.weeks = Math.trunc(days / 7); days -= val.weeks * 7; }
    if (has('days')) val.days = days;
    if (has('hours')) { val.hours = Math.trunc(secs / 3600); secs -= val.hours * 3600; }
    if (has('minutes')) { val.minutes = Math.trunc(secs / 60); secs -= val.minutes * 60; }
    if (has('seconds')) val.seconds = secs;
    if (has('nanoseconds')) val.nanoseconds = 0;
    const out = u.map((n) => (this._neg && val[n] ? -val[n] : val[n] === undefined ? 0 : val[n]));
    return u.length === 1 ? out[0] : out;
  }
  delta_days() { return this.days + this.weeks * 7; } delta_months() { return this.years * 12 + this.months; }
  delta_minutes() { return this.hours * 60 + this.minutes; } delta_seconds() { return this.seconds; }
  is_zero() { return !this.years && !this.months && !this._secs(); }
}
defs2(DTD.prototype, { __perlCall: true });
hide(DTD, '__perlCall', true);

class DT {
  constructor(ms, tz) { hide(this, '_ms', ms); hide(this, '_tz', tz || 'UTC'); }
  static _tz(o) { return o.time_zone === undefined || o.time_zone === 'floating' ? 'UTC' : o.time_zone; }
  static new(...a) {
    const o = dtOpts(a);
    if (o.year === undefined) throw 'Mandatory parameter \'year\' missing in call to DateTime::new at line ' + RT._ln.v + '.\n';
    const tz = DT._tz(o);
    return new DT(fromParts(+o.year, (o.month === undefined ? 1 : +o.month) - 1, o.day === undefined ? 1 : +o.day, +o.hour || 0, +o.minute || 0, +o.second || 0, tz), tz);
  }
  static now(...a) { return new DT(Date.now(), DT._tz(dtOpts(a))); }
  static today(...a) { return DT.now(...a).truncate('to', 'day'); }
  static from_epoch(...a) { const o = dtOpts(a); return new DT(o.epoch * 1000, DT._tz(o)); }
  static last_day_of_month(...a) { const o = dtOpts(a); return DT.new(Object.assign({}, o, { day: monthDays(+o.year, +o.month - 1) })); }
  static compare(a, b) { const x = +a, y = +b; return x < y ? -1 : x > y ? 1 : 0; }
  static duration(...a) { return DTD.new(...a); }
  _P() { return tzParts(this._ms, this._tz); }
  clone() { return new DT(this._ms, this._tz); }
  year() { return this._P().Y; } month() { return this._P().M + 1; } mon() { return this.month(); } day() { return this._P().D; } mday() { return this.day(); } day_of_month() { return this.day(); }
  hour() { return this._P().h; } minute() { return this._P().m; } min() { return this.minute(); } second() { return this._P().s; } sec() { return this.second(); }
  nanosecond() { return (this._ms % 1000) * 1e6; } millisecond() { return ((this._ms % 1000) + 1000) % 1000; }
  day_of_week() { const w = this._P().w; return w === 0 ? 7 : w; } dow() { return this.day_of_week(); } day_of_week_0() { return this._P().w; }
  day_of_year() { const P = this._P(); return ydayOf(P.Y, P.M, P.D) + 1; } doy() { return this.day_of_year(); }
  month_name() { return MONN[this._P().M]; } month_abbr() { return MONN[this._P().M].slice(0, 3); }
  day_name() { return DAYN[this._P().w]; } day_abbr() { return DAYN[this._P().w].slice(0, 3); }
  quarter() { return Math.floor(this._P().M / 3) + 1; } days_in_month() { const P = this._P(); return monthDays(P.Y, P.M); }
  is_leap_year() { return isLeap(this._P().Y); } is_dst() { return 0; }
  week() { const P = this._P(); return isoWeek(P.Y, P.M, P.D); } week_number() { return this.week()[1]; } week_year() { return this.week()[0]; }
  ymd(sep) { const P = this._P(); sep = sep === undefined ? '-' : sep; return P.Y + sep + p2(P.M + 1) + sep + p2(P.D); }
  mdy(sep) { const P = this._P(); sep = sep === undefined ? '-' : sep; return p2(P.M + 1) + sep + p2(P.D) + sep + P.Y; }
  dmy(sep) { const P = this._P(); sep = sep === undefined ? '-' : sep; return p2(P.D) + sep + p2(P.M + 1) + sep + P.Y; }
  hms(sep) { const P = this._P(); sep = sep === undefined ? ':' : sep; return p2(P.h) + sep + p2(P.m) + sep + p2(P.s); }
  date(sep) { return this.ymd(sep); } time(sep) { return this.hms(sep); }
  datetime() { return this.ymd('-') + 'T' + this.hms(':'); } iso8601() { return this.datetime(); }
  rfc3339() { const o = this._P().off; return this.datetime() + (this._tz === 'UTC' ? 'Z' : (o < 0 ? '-' : '+') + p2(Math.floor(Math.abs(o) / 3600)) + ':' + p2((Math.abs(o) % 3600) / 60)); }
  epoch() { return Math.floor(this._ms / 1000); } hires_epoch() { return this._ms / 1000; }
  offset() { return this._P().off; }
  time_zone() { return this._tz === 'local' ? 'local' : this._tz; } time_zone_short_name() { return tzName(this._ms, this._tz); }
  set_time_zone(tz) { this._tz = tz === 'floating' ? 'UTC' : tz; return this; }
  strftime(fmt) { return strftimeMs(fmt, this._ms, this._tz); }
  _shift(o, sign) {
    const P = this._P(), n = (k) => (+o[k] || 0) * sign;
    const base = fromParts(P.Y + n('years'), P.M + n('months'), P.D + n('days') + 7 * n('weeks'), P.h, P.m, P.s, this._tz);
    this._ms = base + (n('hours') * 3600 + n('minutes') * 60 + n('seconds')) * 1000 + (n('nanoseconds') / 1e6);
    return this;
  }
  add(...a) { return this._shift(dtOpts(a), 1); } subtract(...a) { return this._shift(dtOpts(a), -1); }
  add_duration(d) { return this._shift(d, 1); } subtract_duration(d) { return this._shift(d, -1); }
  subtract_datetime(o) {
    let a = this, b = o, neg = false;
    if (+a < +b) { [a, b] = [b, a]; neg = true; }
    const A = a._P(), B = b._P();
    let months = (A.Y - B.Y) * 12 + (A.M - B.M);
    const shifted = (mm) => fromParts(B.Y, B.M + mm, B.D, B.h, B.m, B.s, b._tz);
    if (shifted(months) > a._ms) months--;
    const rest = Math.round((a._ms - shifted(months)) / 1000);
    const d = Math.floor(rest / 86400), r = rest % 86400;
    return new DTD({ months, days: d, minutes: Math.floor(r / 60), seconds: r % 60, hours: 0, _neg: neg });
  }
  delta_days(o) { return new DTD({ days: Math.floor(Math.abs(this._ms - o._ms) / 86400000) }); }   // delta_* are always positive
  delta_ms(o) { return new DTD({ seconds: Math.abs(this._ms - o._ms) / 1000, _neg: this._ms < o._ms }); }
  truncate(...a) {
    const o = dtOpts(a), P = this._P();
    const k = { year: [P.Y, 0, 1, 0, 0, 0], quarter: [P.Y, Math.floor(P.M / 3) * 3, 1, 0, 0, 0], month: [P.Y, P.M, 1, 0, 0, 0], week: [P.Y, P.M, P.D - ((P.w + 6) % 7), 0, 0, 0], day: [P.Y, P.M, P.D, 0, 0, 0], hour: [P.Y, P.M, P.D, P.h, 0, 0], minute: [P.Y, P.M, P.D, P.h, P.m, 0], second: [P.Y, P.M, P.D, P.h, P.m, P.s] }[o.to];
    if (k) this._ms = fromParts(...k, this._tz);
    return this;
  }
  set(...a) {
    const o = dtOpts(a), P = this._P();
    this._ms = fromParts(o.year !== undefined ? +o.year : P.Y, o.month !== undefined ? o.month - 1 : P.M, o.day !== undefined ? +o.day : P.D, o.hour !== undefined ? +o.hour : P.h, o.minute !== undefined ? +o.minute : P.m, o.second !== undefined ? +o.second : P.s, this._tz);
    return this;
  }
  set_year(v) { return this.set('year', v); } set_month(v) { return this.set('month', v); } set_day(v) { return this.set('day', v); }
  set_hour(v) { return this.set('hour', v); } set_minute(v) { return this.set('minute', v); } set_second(v) { return this.set('second', v); }
  end_of_month() { const P = this._P(); return DT.new('year', P.Y, 'month', P.M + 1, 'day', monthDays(P.Y, P.M), 'hour', 23, 'minute', 59, 'second', 59, 'time_zone', this._tz); }
  toString() { return this.datetime(); }
  valueOf() { return this._ms / 1000; }
  $ncmp(o) { const a = +this, b = +o; return a < b ? -1 : a > b ? 1 : 0; }
  $scmp(o) { const a = String(this), b = String(o); return a < b ? -1 : a > b ? 1 : 0; }
}
hide(DT.prototype, '__perlCall', true);
hide(DT, '__perlCall', true);
for (const k of Object.getOwnPropertyNames(DT.prototype)) if (k !== 'constructor') hide(DT.prototype, k, DT.prototype[k]);
forwardStr(DT.prototype);
for (const k of ['new', 'now', 'today', 'from_epoch', 'last_day_of_month', 'compare', 'duration']) hide(DT, k, DT[k]);


return { classes: { 'DateTime': DT, 'DateTime::Duration': DTD } };
} });
