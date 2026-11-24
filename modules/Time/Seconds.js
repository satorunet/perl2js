/* Time::Seconds — ONE_DAY ... and ($t2 - $t1)->days / ->pretty */
Perl2JS.module({ name: 'Time::Seconds', init(api) {
// Time::Seconds: the number you get from $t2 - $t1
const SECAPI = {
  seconds: (n) => n, minutes: (n) => n / 60, hours: (n) => n / 3600, days: (n) => n / 86400, weeks: (n) => n / 604800, months: (n) => n / 2629744, years: (n) => n / 31557600,
  pretty: (n) => {
    let s = Math.abs(Math.trunc(n)); const out = [];
    const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
    if (d) out.push(d + ' days'); if (d || h) out.push(h + ' hours'); if (d || h || m) out.push(m + ' minutes'); out.push(s + ' seconds');
    return (n < 0 ? 'minus ' : '') + out.join(', ');
  },
};
const SECONDS_CONST = { ONE_MINUTE: 60, ONE_HOUR: 3600, ONE_DAY: 86400, ONE_WEEK: 604800, ONE_MONTH: 2629744, ONE_YEAR: 31557600, ONE_FINANCIAL_MONTH: 2592000, LEAP_YEAR: 31622400, NON_LEAP_YEAR: 31536000 };

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
api.NUMHOOKS.push((num, n, call) => (has(SECAPI, n) ? (call ? () => SECAPI[n](num) : SECAPI[n](num)) : undefined));
return { exports: SECONDS_CONST, default: Object.keys(SECONDS_CONST) };
} });
