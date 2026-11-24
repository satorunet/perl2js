/* Math::Trig — pi, tan, asin, acos, atan, sinh/cosh/tanh, deg2rad, rad2deg ... */
Perl2JS.module({ name: 'Math::Trig', init(api) {
  const pi = Math.PI, pi2 = 2 * pi, pi4 = 4 * pi, pip2 = pi / 2, pip4 = pi / 4;
  const rem = (a, b) => a - b * Math.trunc(a / b);
  const D = pi / 180, G = pi / 200;
  const exports = {
    pi: () => pi, pi2: () => pi2, pi4: () => pi4, pip2: () => pip2, pip4: () => pip4,
    tan: Math.tan, csc: (x) => 1 / Math.sin(x), cosec: (x) => 1 / Math.sin(x), sec: (x) => 1 / Math.cos(x), cot: (x) => 1 / Math.tan(x), cotan: (x) => 1 / Math.tan(x),
    asin: Math.asin, acos: Math.acos, atan: Math.atan, acsc: (x) => Math.asin(1 / x), acosec: (x) => Math.asin(1 / x), asec: (x) => Math.acos(1 / x), acot: (x) => Math.atan(1 / x), acotan: (x) => Math.atan(1 / x),
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, csch: (x) => 1 / Math.sinh(x), cosech: (x) => 1 / Math.sinh(x), sech: (x) => 1 / Math.cosh(x), coth: (x) => 1 / Math.tanh(x), cotanh: (x) => 1 / Math.tanh(x),
    asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
    deg2rad: (d, w) => (w ? d * D : rem(d * D, pi2)), rad2deg: (r, w) => (w ? r / D : rem(r, pi2) / D),
    grad2rad: (g, w) => (w ? g * G : rem(g * G, pi2)), rad2grad: (r, w) => (w ? r / G : rem(r, pi2) / G),
    deg2grad: (d, w) => (w ? d * 400 / 360 : rem(d, 360) * 400 / 360), grad2deg: (g, w) => (w ? g * 360 / 400 : rem(g, 400) * 360 / 400),
    great_circle_distance: (t0, p0, t1, p1, rho) => { rho = rho === undefined ? 1 : rho; const lat0 = pip2 - p0, lat1 = pip2 - p1; return rho * Math.acos(Math.cos(lat0) * Math.cos(lat1) * Math.cos(t0 - t1) + Math.sin(lat0) * Math.sin(lat1)); },
  };
  const noarg = ['pi', 'pi2', 'pi4', 'pip2', 'pip4'];
  const unary = Object.keys(exports).filter((k) => !noarg.includes(k) && k !== 'great_circle_distance' && !/^(deg|rad|grad)2/.test(k));
  return { exports, default: Object.keys(exports).filter((k) => k !== 'great_circle_distance' && !['pi2', 'pi4', 'pip2', 'pip4'].includes(k)), noarg, unary, listops: ['deg2rad', 'rad2deg', 'grad2rad', 'rad2grad', 'deg2grad', 'grad2deg', 'great_circle_distance'] };
} });
