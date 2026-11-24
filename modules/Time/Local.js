/* Time::Local — timelocal / timegm */
Perl2JS.module({ name: 'Time::Local', deps: ['_date'], init(api) {
  const { fromParts } = api.use('_date').shared;
function localYear(y, modern) { return modern ? y : (y >= 1000 ? y : y + 1900); }
const mkLocal = (tz, modern) => (s, m, h, D, M, Y) => Math.floor(fromParts(localYear(Y, modern), M, D, h, m, s, tz) / 1000);
const TIMELOCAL = { timelocal: mkLocal('local'), timegm: mkLocal('UTC'), timelocal_nocheck: mkLocal('local'), timegm_nocheck: mkLocal('UTC'),
  timelocal_modern: mkLocal('local', true), timegm_modern: mkLocal('UTC', true), timelocal_posix: (s, m, h, D, M, Y) => mkLocal('local')(s, m, h, D, M, Y), timegm_posix: (s, m, h, D, M, Y) => mkLocal('UTC')(s, m, h, D, M, Y) };

return { exports: TIMELOCAL, default: ['timelocal', 'timegm'], listops: Object.keys(TIMELOCAL) };
} });
