export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const rand = (a, b) => a + Math.random() * (b - a);

export function angleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function turnToward(cur, target, max) {
  return cur + clamp(angleDiff(cur, target), -max, max);
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise + fbm
export function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const p = []; for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256); for (let i = 0; i < 256; i++) vals[i] = rnd();
  const h = (i, j) => vals[perm[(i & 255) + perm[j & 255]]];
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  };
  const fbm = (x, y, oct = 4) => {
    let a = 0.5, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * n2(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  };
  return { n2, fbm };
}

// 可平铺的多倍频噪声（用于贴图）
export function periodicNoise(size, octaves, rnd) {
  const out = new Float32Array(size * size);
  for (const [g, amp] of octaves) {
    const lat = new Float32Array(g * g); for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * g, fy = (y / size) * g;
      const xi = Math.floor(fx), yi = Math.floor(fy); const xf = fx - xi, yf = fy - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const x1 = (xi + 1) % g, y1 = (yi + 1) % g;
      const a = lerp(lat[yi * g + xi], lat[yi * g + x1], u), b = lerp(lat[y1 * g + xi], lat[y1 * g + x1], u);
      out[y * size + x] += lerp(a, b, v) * amp;
    }
  }
  return out;
}
