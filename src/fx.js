// 粒子、曳光、冲击波、弹坑贴花、闪光灯
import * as THREE from 'three';
import { rand } from './util.js';

const VS = `attribute vec4 aColor; attribute float aSize; varying vec4 vColor; uniform float uScale;
void main(){ vColor=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*uScale/max(0.1,-mv.z); }`;
const FS = `varying vec4 vColor;
void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.15,d)*vColor.a; if(a<0.004) discard; gl_FragColor=vec4(vColor.rgb,a); }`;

class PSys {
  constructor(scene, max, additive) {
    this.max = max; this.next = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4); this.c1 = new Float32Array(max * 4);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 600 } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 11 : 10;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag = 0, grav = 0) {
    const i = this.next; this.next = (i + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.drag[i] = drag; this.grav[i] = grav;
    for (let k = 0; k < 4; k++) { this.c0[i * 4 + k] = c0[k]; this.c1[i * 4 + k] = c1[k]; }
  }
  update(dt) {
    const { pos, vel, life, maxLife, s0, s1, c0, c1, col, size, drag, grav, max } = this;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
      const t = 1 - life[i] / maxLife[i]; const i3 = i * 3, i4 = i * 4;
      const dk = Math.max(0, 1 - drag[i] * dt);
      vel[i3] *= dk; vel[i3 + 1] = vel[i3 + 1] * dk + grav[i] * dt; vel[i3 + 2] *= dk;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      if (pos[i3 + 1] < 0.05 && grav[i] < 0) { pos[i3 + 1] = 0.05; vel[i3 + 1] *= -0.3; }
      size[i] = s0[i] + (s1[i] - s0[i]) * t;
      for (let k = 0; k < 4; k++) col[i4 + k] = c0[i4 + k] + (c1[i4 + k] - c0[i4 + k]) * t;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aColor.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.smoke = new PSys(scene, 2600, false);
    this.fire = new PSys(scene, 3200, true);
    this.mats = {};
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.tracers = []; this.rings = []; this.decals = []; this.lights = [];
    for (let i = 0; i < 64; i++) { const m = new THREE.Mesh(this.boxGeo, this.matFor([1, 1, 1])); m.visible = false; m.frustumCulled = false; m.renderOrder = 12; scene.add(m); this.tracers.push({ m, t: 0, dur: 1, w: 0.1, len: 1 }); }
    const ringGeo = new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 9; scene.add(m); this.rings.push({ m, t: 0, dur: 1, s0: 1, s1: 2 });
    }
    const dc = document.createElement('canvas'); dc.width = dc.height = 64; const g = dc.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const dtex = new THREE.CanvasTexture(dc); const dgeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(dgeo, new THREE.MeshBasicMaterial({ map: dtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.visible = false; m.renderOrder = 1; scene.add(m); this.decals.push({ m, t: 0 });
    }
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa040, 0, 36, 2); scene.add(l); this.lights.push(l); }
    this.ti = 0; this.ri = 0; this.di = 0; this.li = 0;
  }
  setScale(s) { this.smoke.mat.uniforms.uScale.value = s; this.fire.mat.uniforms.uScale.value = s; }
  matFor(c) {
    const k = c.join(',');
    if (!this.mats[k]) this.mats[k] = new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    return this.mats[k];
  }
  update(dt) {
    this.smoke.update(dt); this.fire.update(dt);
    for (const t of this.tracers) {
      if (!t.m.visible) continue; t.t += dt;
      if (t.t >= t.dur) { t.m.visible = false; continue; }
      const k = 1 - t.t / t.dur; t.m.scale.set(t.w * k, t.w * k, t.len);
    }
    for (const r of this.rings) {
      if (!r.m.visible) continue; r.t += dt;
      if (r.t >= r.dur) { r.m.visible = false; continue; }
      const k = r.t / r.dur; const e = 1 - (1 - k) * (1 - k); const s = r.s0 + (r.s1 - r.s0) * e;
      r.m.scale.set(s, 1, s); r.m.material.opacity = (1 - k) * 0.9;
    }
    for (const d of this.decals) {
      if (!d.m.visible) continue; d.t += dt;
      if (d.t > 45) { d.m.visible = false; continue; }
      d.m.material.opacity = Math.min(1, (45 - d.t) / 10) * 0.5;
    }
    const lk = Math.exp(-dt * 11);
    for (const l of this.lights) { if (l.intensity > 0.01) l.intensity *= lk; else l.intensity = 0; }
  }
  tracer(x0, y0, z0, x1, y1, z1, color, w = 0.06, dur = 0.07) {
    const t = this.tracers[this.ti]; this.ti = (this.ti + 1) % this.tracers.length;
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0; const len = Math.hypot(dx, dy, dz) || 0.01;
    t.m.material = this.matFor(color); t.m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    t.m.lookAt(x1, y1, z1); t.m.scale.set(w, w, len); t.m.visible = true; t.t = 0; t.dur = dur; t.w = w; t.len = len;
  }
  ring(x, y, z, s0, s1, dur, color) {
    const r = this.rings[this.ri]; this.ri = (this.ri + 1) % this.rings.length;
    r.m.position.set(x, y, z); r.m.material.color.setRGB(color[0], color[1], color[2]); r.m.scale.set(s0, 1, s0);
    r.m.visible = true; r.t = 0; r.dur = dur; r.s0 = s0; r.s1 = s1;
  }
  marker(x, z, color) { this.ring(x, 0.12, z, 1.7, 0.35, 0.4, color); }
  decal(x, z, s) {
    const d = this.decals[this.di]; this.di = (this.di + 1) % this.decals.length;
    d.m.position.set(x, 0.04, z); d.m.scale.set(s, 1, s); d.m.rotation.y = Math.random() * 6.28; d.m.visible = true; d.t = 0;
  }
  flash(x, y, z, intensity, color = 0xffa040) {
    const l = this.lights[this.li]; this.li = (this.li + 1) % this.lights.length;
    l.position.set(x, y, z); l.color.set(color); l.intensity = intensity;
  }
  explosion(x, y, z, s = 1) {
    const f = this.fire, sm = this.smoke;
    f.spawn(x, y + 0.3, z, 0, 0, 0, 0.16, 3.2 * s, 6 * s, [5, 4, 2.4, 1], [2, 0.8, 0, 0]);
    const n = Math.round(12 * s);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, e = Math.random() * 1.3, v = rand(2, 6.5) * s;
      f.spawn(x, y + 0.2, z, Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v + 1, Math.sin(a) * Math.cos(e) * v, rand(0.3, 0.65), rand(1, 1.8) * s, rand(2, 3) * s, [3.6, 1.7, 0.4, 0.95], [1.2, 0.12, 0, 0], 3.2);
    }
    for (let i = 0; i < Math.round(9 * s); i++) {
      const a = Math.random() * 6.28, v = rand(6, 15) * Math.sqrt(s);
      f.spawn(x, y + 0.3, z, Math.cos(a) * v * 0.6, rand(5, 12), Math.sin(a) * v * 0.6, rand(0.5, 1.0), 0.28, 0.06, [5, 3, 1, 1], [2.5, 0.6, 0, 0], 0.4, -20);
    }
    for (let i = 0; i < Math.round(7 * s); i++) {
      const a = Math.random() * 6.28, v = rand(0.5, 2.2) * s; const g = rand(0.06, 0.16);
      sm.spawn(x + Math.cos(a) * 0.4 * s, y + 0.5, z + Math.sin(a) * 0.4 * s, Math.cos(a) * v, rand(1.4, 3.2), Math.sin(a) * v, rand(1.3, 2.6), rand(1.2, 2) * s, rand(3.4, 4.6) * s, [g, g, g, 0.7], [0.3, 0.3, 0.3, 0], 0.9);
    }
    this.ring(x, 0.15, z, 0.4 * s, 4.2 * s, 0.42, [2.2, 1.3, 0.5]);
    this.flash(x, y + 1.6, z, 420 * s);
    this.decal(x, z, 2.8 * s);
  }
  puff(x, y, z, s = 1) {
    for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28; this.smoke.spawn(x, y, z, Math.cos(a) * 1.2, rand(0.6, 1.6), Math.sin(a) * 1.2, rand(0.6, 1.1), 0.5 * s, 1.5 * s, [0.5, 0.48, 0.44, 0.55], [0.6, 0.58, 0.55, 0], 1.5); }
    this.fire.spawn(x, y, z, 0, 0, 0, 0.12, 1.2 * s, 1.8 * s, [3, 1.8, 0.8, 0.9], [1, 0.3, 0, 0]);
  }
  muzzle(x, y, z, dx, dz, s = 1) {
    this.fire.spawn(x + dx * 0.3 * s, y, z + dz * 0.3 * s, dx * 4, 0.3, dz * 4, 0.07, 1.5 * s, 0.6 * s, [5, 3.4, 1.4, 1], [3, 1, 0.2, 0]);
    if (s >= 1) {
      this.fire.spawn(x + dx * 0.9 * s, y, z + dz * 0.9 * s, dx * 9, 0.2, dz * 9, 0.1, 1.1 * s, 0.4 * s, [4, 2.2, 0.6, 0.9], [2, 0.5, 0, 0]);
      for (let i = 0; i < 3; i++) this.smoke.spawn(x, y, z, dx * rand(1, 3) + rand(-0.6, 0.6), rand(0.3, 1), dz * rand(1, 3) + rand(-0.6, 0.6), rand(0.5, 1), 0.6 * s, 1.8 * s, [0.6, 0.58, 0.55, 0.4], [0.7, 0.7, 0.7, 0], 1.6);
      this.flash(x, y + 0.6, z, 90 * s);
    }
  }
  sparks(x, y, z, n = 3) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = rand(2, 6); this.fire.spawn(x, y, z, Math.cos(a) * v, rand(1, 5), Math.sin(a) * v, rand(0.2, 0.45), 0.2, 0.04, [5, 3.2, 1.2, 1], [2, 0.6, 0, 0], 0.5, -18); }
  }
  trail(x, y, z) { const g = rand(0.5, 0.7); this.smoke.spawn(x, y, z, rand(-0.3, 0.3), rand(0.1, 0.5), rand(-0.3, 0.3), rand(0.5, 0.9), 0.3, 1.0, [g, g, g, 0.45], [g, g, g, 0], 1); }
  dust(x, z, s = 1) { this.smoke.spawn(x + rand(-0.3, 0.3), 0.15, z + rand(-0.3, 0.3), rand(-0.4, 0.4), rand(0.3, 0.8), rand(-0.4, 0.4), rand(0.6, 1.1), 0.5 * s, 1.7 * s, [0.55, 0.47, 0.36, 0.3], [0.6, 0.52, 0.42, 0], 1.2); }
  smokePuff(x, y, z, s = 1) { const g = rand(0.05, 0.14); this.smoke.spawn(x, y, z, rand(-0.4, 0.4), rand(1.6, 2.8), rand(-0.4, 0.4), rand(1.6, 2.6), 0.8 * s, 2.8 * s, [g, g, g, 0.6], [0.25, 0.25, 0.25, 0], 0.3); }
  fireAt(x, y, z, s = 1) { this.fire.spawn(x + rand(-0.2, 0.2), y, z + rand(-0.2, 0.2), rand(-0.3, 0.3), rand(1.5, 3), rand(-0.3, 0.3), rand(0.3, 0.6), 1.1 * s, 0.3 * s, [3.6, 1.6, 0.3, 0.9], [1.6, 0.2, 0, 0], 0.5); }
  sparkle(x, y, z, c) { this.fire.spawn(x + rand(-0.6, 0.6), y, z + rand(-0.6, 0.6), rand(-1, 1), rand(1, 3.5), rand(-1, 1), rand(0.3, 0.7), 0.3, 0.05, [c[0], c[1], c[2], 1], [c[0], c[1], c[2], 0], 0.5, -4); }
  projectile(color, w, len) { const m = new THREE.Mesh(this.boxGeo, this.matFor(color)); m.scale.set(w, w, len); m.renderOrder = 12; this.scene.add(m); return m; }
}
