/* Try::Tiny — try { ... } catch { ... } finally { ... };   ($_ and $_[0] are the error inside catch) */
Perl2JS.module({ name: 'Try::Tiny', init(api) {
  const { G } = api;
  const errText = (e) => (e instanceof Error ? e.message : e);
  const mark = (kind) => (fn) => Object.assign((...a) => fn(...a), { __kind: kind, __fn: fn });
  const _catch = mark('catch'), _finally = mark('finally');
  const _try = (tryFn, ...handlers) => {
    const hs = handlers.flat(1);
    const catchFn = (hs.find((h) => h && h.__kind === 'catch') || {}).__fn;
    const finals = hs.filter((h) => h && h.__kind === 'finally').map((h) => h.__fn);
    let ret, err, failed = false;
    try {
      try { ret = tryFn(); } catch (e) { if (e && e.exit) throw e; failed = true; err = errText(e); }
      if (failed && catchFn) { const old = G.$_; G.$_ = err; try { ret = catchFn(err); } finally { G.$_ = old; } }
      else if (failed) ret = undefined;
    } finally { for (const f of finals) f(...(failed ? [err] : [])); }
    return ret;
  };
  const dummy = () => undefined;
  return { exports: { try: dummy, catch: dummy, finally: dummy }, default: ['try', 'catch', 'finally'], scope() { return { _try, _catch, _finally }; } };
} });
