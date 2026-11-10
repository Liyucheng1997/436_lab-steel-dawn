// 战争迷雾：按格计算可见性，以一张平滑插值的贴图覆盖在场景上
import * as THREE from 'three';
import { N, WORLD } from './config.js';

export class FogOfWar {
  constructor(scene) {
    const n = N * N;
    this.vis = new Uint8Array(n);                 // 0 未探索 1 已探索 2 当前可见
    this.raw = new Float32Array(n).fill(1); this.target = new Float32Array(n).fill(1); this.cur = new Float32Array(n).fill(1);
    this.data = new Uint8Array(n).fill(255);
    this.tex = new THREE.DataTexture(this.data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter; this.tex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tFog: { value: this.tex }, uSize: { value: WORLD } },
      vertexShader: `varying vec2 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D tFog; uniform float uSize; varying vec2 vW;
        void main(){ vec2 uv=clamp(vW/uSize,0.0,1.0); float a=texture2D(tFog,uv).r; gl_FragColor=vec4(0.012,0.02,0.032,a*0.97); }`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 5, WORLD * 5).rotateX(-Math.PI / 2), mat);
    this.mesh.position.set(WORLD / 2, 0.1, WORLD / 2); this.mesh.renderOrder = 1000; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  // src: [cx, cz, r, cx, cz, r, ...]
  compute(src) {
    const v = this.vis, n = N * N;
    for (let i = 0; i < n; i++) if (v[i] === 2) v[i] = 1;
    for (let k = 0; k < src.length; k += 3) {
      const cx = src[k], cz = src[k + 1], r = src[k + 2], r2 = r * r + 1;
      const z0 = Math.max(0, cz - r), z1 = Math.min(N - 1, cz + r), x0 = Math.max(0, cx - r), x1 = Math.min(N - 1, cx + r);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if ((x - cx) * (x - cx) + (z - cz) * (z - cz) <= r2) v[z * N + x] = 2;
    }
    const raw = this.raw, t = this.target;
    for (let i = 0; i < n; i++) raw[i] = v[i] === 2 ? 0 : v[i] === 1 ? 0.52 : 1;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      let s = 0, c = 0;
      for (let dz = -1; dz <= 1; dz++) { const zz = z + dz; if (zz < 0 || zz >= N) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= N) continue; s += raw[zz * N + xx]; c++; } }
      t[z * N + x] = s / c;
    }
  }
  snap() { this.cur.set(this.target); this.update(0); }
  update(dt) {
    const k = dt > 0 ? 1 - Math.exp(-dt * 7) : 0; const c = this.cur, t = this.target, d = this.data;
    for (let i = 0; i < c.length; i++) { c[i] += (t[i] - c[i]) * k; d[i] = c[i] * 255; }
    this.tex.needsUpdate = true;
  }
  visible(cx, cz) { return this.vis[cz * N + cx] === 2; }
  explored(cx, cz) { return this.vis[cz * N + cx] >= 1; }
}
