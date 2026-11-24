/* Digest::SHA — sha1 / sha256 (+ _hex / _base64) and hmac_*   (sha512 is not included) */
Perl2JS.module({ name: 'Digest::SHA', init(api) {
  const { hide } = api;
  const toBytes = (s) => { s = String(s); if (/[^\x00-\xff]/.test(s)) s = unescape(encodeURIComponent(s)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  const rotl = (x, n) => (x << n) | (x >>> (32 - n)), rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const pad = (bytes) => { const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6, buf = new Uint8Array(total); buf.set(bytes); buf[len] = 0x80; const dv = new DataView(buf.buffer); dv.setUint32(total - 8, Math.floor(len * 8 / 4294967296)); dv.setUint32(total - 4, (len * 8) >>> 0); return dv; };
  function sha1(bytes) {
    const dv = pad(bytes); let h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0].map((x) => x | 0);
    for (let off = 0; off < dv.byteLength; off += 64) {
      const w = []; for (let i = 0; i < 16; i++) w.push(dv.getInt32(off + i * 4));
      for (let i = 16; i < 80; i++) w.push(rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1));
      let [a, b, c, d, e] = h;
      for (let i = 0; i < 80; i++) {
        let f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; } else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; } else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; } else { f = b ^ c ^ d; k = 0xca62c1d6; }
        const t = (rotl(a, 5) + f + e + k + w[i]) | 0; e = d; d = c; c = rotl(b, 30); b = a; a = t;
      }
      h = [(h[0] + a) | 0, (h[1] + b) | 0, (h[2] + c) | 0, (h[3] + d) | 0, (h[4] + e) | 0];
    }
    const out = new Uint8Array(20), o = new DataView(out.buffer); h.forEach((x, i) => o.setInt32(i * 4, x)); return out;
  }
  const primes = []; for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n);
  const frac = (x) => Math.floor((x - Math.floor(x)) * 4294967296) | 0;
  const K256 = primes.map((p) => frac(Math.cbrt(p))), H256 = primes.slice(0, 8).map((p) => frac(Math.sqrt(p)));
  function sha256(bytes) {
    const dv = pad(bytes); let h = H256.slice();
    for (let off = 0; off < dv.byteLength; off += 64) {
      const w = []; for (let i = 0; i < 16; i++) w.push(dv.getInt32(off + i * 4));
      for (let i = 16; i < 64; i++) { const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w.push((w[i - 16] + s0 + w[i - 7] + s1) | 0); }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K256[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [(h[0] + a) | 0, (h[1] + b) | 0, (h[2] + c) | 0, (h[3] + d) | 0, (h[4] + e) | 0, (h[5] + f) | 0, (h[6] + g) | 0, (h[7] + hh) | 0];
    }
    const out = new Uint8Array(32), o = new DataView(out.buffer); h.forEach((x, i) => o.setInt32(i * 4, x)); return out;
  }
  const hex = (u) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('');
  const raw = (u) => String.fromCharCode(...u);
  const b64 = (u) => btoa(raw(u)).replace(/=+$/, '');
  const j = (a) => a.flat(1).join('');
  const hmac = (H, data, key) => {
    let k = toBytes(key); if (k.length > 64) k = H(k);
    const ipad = new Uint8Array(64).fill(0x36), opad = new Uint8Array(64).fill(0x5c);
    k.forEach((b, i) => { ipad[i] ^= b; opad[i] ^= b; });
    const inner = H(Uint8Array.from([...ipad, ...toBytes(data)]));
    return H(Uint8Array.from([...opad, ...inner]));
  };
  const exports = {};
  for (const [n, H] of [['sha1', sha1], ['sha256', sha256]]) {
    exports[n] = (...a) => raw(H(toBytes(j(a)))); exports[n + '_hex'] = (...a) => hex(H(toBytes(j(a)))); exports[n + '_base64'] = (...a) => b64(H(toBytes(j(a))));
    exports['hmac_' + n] = (...a) => { const key = a.length > 1 ? a[a.length - 1] : ''; return raw(hmac(H, j(a.slice(0, -1)), key)); };
    exports['hmac_' + n + '_hex'] = (...a) => { const key = a.length > 1 ? a[a.length - 1] : ''; return hex(hmac(H, j(a.slice(0, -1)), key)); };
    exports['hmac_' + n + '_base64'] = (...a) => { const key = a.length > 1 ? a[a.length - 1] : ''; return b64(hmac(H, j(a.slice(0, -1)), key)); };
  }
  class SHA { constructor(alg) { hide(this, '_d', ''); hide(this, '_h', /256/.test(String(alg)) ? sha256 : sha1); } static new(alg) { return new SHA(alg || 1); }
    add(...a) { this._d += j(a); return this; } digest() { const r = raw(this._h(toBytes(this._d))); this._d = ''; return r; } hexdigest() { const r = hex(this._h(toBytes(this._d))); this._d = ''; return r; } b64digest() { const r = b64(this._h(toBytes(this._d))); this._d = ''; return r; } }
  hide(SHA.prototype, '__perlCall', true); hide(SHA, '__perlCall', true);
  for (const k of Object.getOwnPropertyNames(SHA.prototype)) if (k !== 'constructor') hide(SHA.prototype, k, SHA.prototype[k]);
  hide(SHA, 'new', SHA.new);
  return { exports, default: [], listops: Object.keys(exports), classes: { 'Digest::SHA': SHA } };
} });
