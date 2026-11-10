// 网格 A* 寻路 + 视线平滑
import { CS, N } from './config.js';

const SQ2 = Math.SQRT2;
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];

export class Pathfinder {
  constructor(blocked) {
    this.b = blocked; const n = N * N;
    this.g = new Float32Array(n); this.par = new Int32Array(n);
    this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n); this.cur = 0;
    this.hi = []; this.hk = [];
  }
  _push(i, k) {
    const hi = this.hi, hk = this.hk; let c = hi.length; hi.push(i); hk.push(k);
    while (c > 0) { const p = (c - 1) >> 1; if (hk[p] <= k) break; hi[c] = hi[p]; hk[c] = hk[p]; c = p; }
    hi[c] = i; hk[c] = k;
  }
  _pop() {
    const hi = this.hi, hk = this.hk; const top = hi[0]; const li = hi.pop(), lk = hk.pop(); const n = hi.length;
    if (n > 0) {
      let c = 0;
      for (;;) { let ch = c * 2 + 1; if (ch >= n) break; if (ch + 1 < n && hk[ch + 1] < hk[ch]) ch++; if (hk[ch] >= lk) break; hi[c] = hi[ch]; hk[c] = hk[ch]; c = ch; }
      hi[c] = li; hk[c] = lk;
    }
    return top;
  }
  // 目标被占用时，找离目标最近、且尽量靠近起点的空格
  nearestFree(tx, tz, sx = tx, sz = tz, maxR = 16) {
    const b = this.b;
    if (tx >= 0 && tz >= 0 && tx < N && tz < N && !b[tz * N + tx]) return tz * N + tx;
    for (let r = 1; r <= maxR; r++) {
      let best = -1, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = tx + dx, z = tz + dz; if (x < 0 || z < 0 || x >= N || z >= N) continue;
        if (b[z * N + x]) continue;
        const d = (x - sx) * (x - sx) + (z - sz) * (z - sz); if (d < bd) { bd = d; best = z * N + x; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
  // 返回格子索引数组（不含起点）；无法到达时返回通往最近可达点的路径
  find(sx, sz, tx, tz) {
    const b = this.b, g = this.g, par = this.par, stamp = this.stamp, closed = this.closed;
    const goal = this.nearestFree(tx, tz, sx, sz); if (goal < 0) return null;
    tx = goal % N; tz = (goal / N) | 0;
    const start = sz * N + sx; if (start === goal) return [];
    const id = ++this.cur; this.hi.length = 0; this.hk.length = 0;
    const H = (x, z) => { const dx = Math.abs(x - tx), dz = Math.abs(z - tz); return dx + dz + (SQ2 - 2) * Math.min(dx, dz); };
    g[start] = 0; stamp[start] = id; par[start] = -1; this._push(start, H(sx, sz));
    let best = start, bestH = H(sx, sz);
    while (this.hi.length) {
      const c = this._pop(); if (closed[c] === id) continue; closed[c] = id;
      if (c === goal) { best = c; break; }
      const cx = c % N, cz = (c / N) | 0;
      for (let k = 0; k < 8; k++) {
        const d = DIRS[k]; const nx = cx + d[0], nz = cz + d[1];
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const ni = nz * N + nx; if (b[ni] || closed[ni] === id) continue;
        if (k > 3 && (b[cz * N + nx] || b[nz * N + cx])) continue;
        const ng = g[c] + d[2];
        if (stamp[ni] !== id || ng < g[ni]) {
          g[ni] = ng; stamp[ni] = id; par[ni] = c; const hh = H(nx, nz);
          if (hh < bestH) { bestH = hh; best = ni; }
          this._push(ni, ng + hh);
        }
      }
    }
    const out = []; let c = best;
    while (c !== start && c !== -1) { out.push(c); c = par[c]; }
    out.reverse(); return out;
  }
  blockedAt(x, z) {
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    if (cx < 0 || cz < 0 || cx >= N || cz >= N) return true;
    return this.b[cz * N + cx] !== 0;
  }
  los(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0; const d = Math.hypot(dx, dz); if (d < 0.01) return true;
    const n = Math.ceil(d / (CS * 0.4)); const px = (-dz / d) * 0.7, pz = (dx / d) * 0.7;
    for (let i = 1; i <= n; i++) {
      const t = i / n; const x = x0 + dx * t, z = z0 + dz * t;
      if (this.blockedAt(x, z) || this.blockedAt(x + px, z + pz) || this.blockedAt(x - px, z - pz)) return false;
    }
    return true;
  }
  smooth(from, pts) {
    const out = []; let cx = from.x, cz = from.z; let i = 0;
    while (i < pts.length) {
      let j = Math.min(pts.length - 1, i + 14);
      while (j > i && !this.los(cx, cz, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]); cx = pts[j].x; cz = pts[j].z; i = j + 1;
    }
    return out;
  }
}
