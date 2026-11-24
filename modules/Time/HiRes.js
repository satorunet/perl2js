/* Time::HiRes — time (fractional), gettimeofday, tv_interval  (sleep/usleep cannot block in a browser) */
Perl2JS.module({ name: 'Time::HiRes', init(api) {
  const { mk } = api;
  const hiTime = () => Date.now() / 1000;
  const gettimeofday = () => { const n = Date.now(); return mk([Math.floor(n / 1000), (n % 1000) * 1000]); };
  const tv_interval = (a, b) => { const e = b || [Math.floor(Date.now() / 1000), (Date.now() % 1000) * 1000]; return (e[0] - a[0]) + (e[1] - a[1]) / 1e6; };
  return {
    exports: { time: hiTime, gettimeofday, tv_interval },
    default: [], listops: ['tv_interval'], noarg: ['gettimeofday'], listfns: ['gettimeofday'],
    scope(names) { return names.includes('time') ? { time_: hiTime } : {}; },
  };
} });
