/* Time::HiRes — time (fractional), gettimeofday, tv_interval  sleep usleep nanosleep (they block the page while they wait, like Perl blocks the process) */
Perl2JS.module({ name: 'Time::HiRes', init(api) {
  const { mk } = api;
  const hiTime = () => Date.now() / 1000;
  const wait = (ms) => { const end = Date.now() + ms; if (typeof process !== 'undefined' && typeof Atomics !== 'undefined') { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); return; } while (Date.now() < end) { /* busy wait */ } };
  const hsleep = (s) => { wait(+s * 1000); return +s; };
  const usleep = (us) => { wait(+us / 1000); return +us; };
  const nanosleep = (ns) => { wait(+ns / 1e6); return +ns; };
  const gettimeofday = () => { const n = Date.now(); return mk([Math.floor(n / 1000), (n % 1000) * 1000]); };
  const tv_interval = (a, b) => { const e = b || [Math.floor(Date.now() / 1000), (Date.now() % 1000) * 1000]; return (e[0] - a[0]) + (e[1] - a[1]) / 1e6; };
  return {
    exports: { time: hiTime, gettimeofday, tv_interval, sleep: hsleep, usleep, nanosleep },
    default: [], listops: ['tv_interval'], noarg: ['gettimeofday'], listfns: ['gettimeofday'],
    scope(names) { const o = {}; if (names.includes('time')) o.time_ = hiTime; if (names.includes('sleep')) o.sleep_ = hsleep; return o; },
  };
} });
