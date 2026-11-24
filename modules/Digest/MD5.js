/* Digest::MD5 — md5 / md5_hex / md5_base64 and Digest::MD5->new->add(..)->hexdigest */
Perl2JS.module({ name: 'Digest::MD5', init(api) {
  const { hide } = api;
  const toBytes = (s) => { s = String(s); if (/[^\x00-\xff]/.test(s)) s = unescape(encodeURIComponent(s)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  function md5(bytes) {
    let a0 = 0x67452301 | 0, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476 | 0;
    const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total); buf.set(bytes); buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, (len * 8) >>> 0, true); dv.setUint32(total - 4, Math.floor(len * 8 / 4294967296), true);
    for (let off = 0; off < total; off += 64) {
      const M = []; for (let i = 0; i < 16; i++) M.push(dv.getInt32(off + i * 4, true));
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; } else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) | 0; A = D; D = C; C = B; B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    const out = new Uint8Array(16), o = new DataView(out.buffer);
    o.setInt32(0, a0, true); o.setInt32(4, b0, true); o.setInt32(8, c0, true); o.setInt32(12, d0, true);
    return out;
  }
  const hex = (u) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('');
  const raw = (u) => String.fromCharCode(...u);
  const b64 = (u) => btoa(raw(u)).replace(/=+$/, '');
  const j = (a) => a.flat(1).join('');
  class DM { constructor() { hide(this, '_d', ''); } static new() { return new DM(); }
    add(...a) { this._d += j(a); return this; } addfile() { throw 'addfile is not supported in the browser'; }
    digest() { const r = raw(md5(toBytes(this._d))); this._d = ''; return r; } hexdigest() { const r = hex(md5(toBytes(this._d))); this._d = ''; return r; }
    b64digest() { const r = b64(md5(toBytes(this._d))); this._d = ''; return r; } reset() { this._d = ''; return this; } clone() { const c = new DM(); c._d = this._d; return c; } }
  hide(DM.prototype, '__perlCall', true); hide(DM, '__perlCall', true);
  for (const k of Object.getOwnPropertyNames(DM.prototype)) if (k !== 'constructor') hide(DM.prototype, k, DM.prototype[k]);
  hide(DM, 'new', DM.new);
  const exports = { md5: (...a) => raw(md5(toBytes(j(a)))), md5_hex: (...a) => hex(md5(toBytes(j(a)))), md5_base64: (...a) => b64(md5(toBytes(j(a)))) };
  return { exports, default: [], listops: Object.keys(exports), classes: { 'Digest::MD5': DM } };
} });
