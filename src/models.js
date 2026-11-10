// 全部单位 / 建筑的程序化模型。约定：模型前方为 +z，建筑正门朝 +z（朝向镜头）
import * as THREE from 'three';
import { MB } from './builder.js';
import { TEAMS, CS } from './config.js';

const PI = Math.PI;
const RUBBER = 0x17191c, GUN = 0x2a2f35, STEEL = 0x8d97a2, DARK = 0x1c2025, CONC = 0x9b9ea3, CONC2 = 0x6e7278;
const WARN = 0xe6a51a, SKIN = 0xd6a27a, SAND = 0xb8a57c;
const ORE = [1.5, 0.5, 3.0], REDL = [3.2, 0.3, 0.2], WARNL = [3.0, 1.6, 0.2];
const gl = (p, k = 1) => p.glow.map(v => v * k);

function tracks(h, x, len, w = 0.46, ht = 0.5, nW = 5) {
  for (const s of [-1, 1]) {
    h.box(w, ht, len, s * x, ht / 2 + 0.04, 0, RUBBER, { r: ht * 0.42, seg: 2 });
    const r = ht * 0.34;
    for (let i = 0; i < nW; i++) {
      const z = -len / 2 + ht * 0.48 + i * ((len - ht * 0.96) / (nW - 1));
      h.cyl(r, r, w + 0.06, s * x, ht / 2 + 0.04, z, STEEL, { rz: PI / 2, kind: 'metal', n: 10 });
    }
  }
}

// ---------------- 载具 ----------------
function mTank(p) {
  const root = new THREE.Group();
  const h = new MB();
  tracks(h, 0.74, 2.75, 0.46, 0.52, 5);
  for (const s of [-1, 1]) {
    h.box(0.52, 0.07, 2.55, s * 0.74, 0.63, 0, p.hull2, { r: 0.03 });
    h.box(0.5, 0.2, 0.3, s * 0.74, 0.56, 1.22, p.hull2, { r: 0.05, rx: 0.5 });
    h.box(0.14, 0.07, 0.04, s * 0.42, 0.66, 1.42, gl(p), { kind: 'glow', r: 0 });
    h.cyl(0.05, 0.05, 0.5, s * 0.45, 0.86, -1.25, STEEL, { kind: 'metal', rx: PI / 2, n: 8 });
    h.box(0.2, 0.16, 0.5, s * 0.52, 0.86, -0.2, p.dark, { r: 0.04 });
  }
  h.box(1.22, 0.44, 2.4, 0, 0.58, -0.08, p.hull, { r: 0.1 });
  h.box(1.2, 0.3, 0.72, 0, 0.6, 1.1, p.hull, { r: 0.08, rx: 0.52 });
  h.box(1.02, 0.14, 0.86, 0, 0.84, -0.82, p.hull2, { r: 0.04 });
  for (let i = 0; i < 4; i++) h.box(0.82, 0.03, 0.08, 0, 0.92, -1.1 + i * 0.17, DARK, { r: 0 });
  h.box(1.24, 0.1, 0.42, 0, 0.66, 0.42, p.accent, { r: 0.02 });
  root.add(h.build('hull'));

  const t = new MB();
  t.box(1.02, 0.38, 1.18, 0, 0.19, -0.05, p.hull, { r: 0.13, seg: 2 });
  t.box(0.72, 0.3, 0.5, 0, 0.18, 0.62, p.hull2, { r: 0.09 });
  t.box(0.26, 0.26, 0.9, -0.6, 0.2, -0.1, p.hull2, { r: 0.07 });
  t.box(0.26, 0.26, 0.9, 0.6, 0.2, -0.1, p.hull2, { r: 0.07 });
  t.cyl(0.075, 0.09, 1.55, 0, 0.2, 1.55, GUN, { rx: PI / 2, kind: 'metal', n: 10 });
  t.cyl(0.12, 0.12, 0.26, 0, 0.2, 2.28, GUN, { rx: PI / 2, kind: 'metal', n: 10 });
  t.cyl(0.1, 0.1, 0.3, 0, 0.2, 1.1, p.hull2, { rx: PI / 2, n: 10 });
  t.cyl(0.2, 0.2, 0.08, -0.22, 0.41, -0.22, p.hull2, { n: 12 });
  t.box(0.16, 0.13, 0.22, 0.3, 0.44, 0.1, DARK, { r: 0.03 });
  t.box(0.11, 0.07, 0.02, 0.3, 0.45, 0.22, gl(p, 1.2), { kind: 'glow', r: 0 });
  t.cyl(0.012, 0.012, 0.95, -0.38, 0.84, -0.5, STEEL, { kind: 'metal', n: 5 });
  t.box(1.04, 0.07, 0.3, 0, 0.3, -0.48, p.accent, { r: 0.02 });
  const tn = t.build('turret'); tn.position.set(0, 0.8, -0.12); root.add(tn);
  root.userData.muzzle = [0, 0.2, 2.45];
  return root;
}

function mHeavy(p) {
  const root = new THREE.Group();
  const h = new MB();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    h.box(0.62, 0.64, 1.6, sx * 1.02, 0.36, sz * 0.98, RUBBER, { r: 0.26, seg: 2 });
    for (let i = 0; i < 3; i++) h.cyl(0.22, 0.22, 0.68, sx * 1.02, 0.34, sz * 0.98 - 0.5 + i * 0.5, STEEL, { rz: PI / 2, kind: 'metal', n: 10 });
    h.box(0.68, 0.1, 1.5, sx * 1.02, 0.73, sz * 0.98, p.hull2, { r: 0.04 });
  }
  h.box(1.5, 0.56, 3.4, 0, 0.74, 0, p.hull, { r: 0.14, seg: 2 });
  h.box(1.5, 0.4, 0.9, 0, 0.76, 1.6, p.hull, { r: 0.1, rx: 0.55 });
  h.box(2.6, 0.18, 0.9, 0, 0.9, 0, p.hull2, { r: 0.05 });
  h.box(1.3, 0.2, 1.05, 0, 1.08, -1.12, p.hull2, { r: 0.05 });
  for (let i = 0; i < 4; i++) h.box(1.0, 0.04, 0.1, 0, 1.19, -1.46 + i * 0.22, DARK, { r: 0 });
  for (const s of [-1, 1]) {
    h.cyl(0.07, 0.07, 0.6, s * 0.55, 1.16, -1.62, STEEL, { kind: 'metal', rx: PI / 2, n: 8 });
    h.box(0.16, 0.08, 0.04, s * 0.5, 0.86, 2.0, gl(p), { kind: 'glow', r: 0 });
  }
  h.box(1.52, 0.12, 0.6, 0, 0.84, 0.75, p.accent, { r: 0.03 });
  root.add(h.build('hull'));

  const t = new MB();
  t.box(1.5, 0.52, 1.75, 0, 0.26, -0.1, p.hull, { r: 0.17, seg: 2 });
  t.box(1.1, 0.42, 0.7, 0, 0.25, 0.86, p.hull2, { r: 0.1 });
  for (const s of [-1, 1]) {
    t.box(0.4, 0.32, 1.25, s * 0.86, 0.22, -0.2, p.hull2, { r: 0.08 });
    t.box(0.1, 0.24, 2.3, s * 0.14, 0.28, 2.15, GUN, { kind: 'metal', r: 0.03 });
  }
  t.box(0.12, 0.1, 2.1, 0, 0.28, 2.1, gl(p, 0.9), { kind: 'glow', r: 0.02 });
  for (let i = 0; i < 4; i++) t.box(0.46, 0.32, 0.1, 0, 0.28, 1.4 + i * 0.52, GUN, { kind: 'metal', r: 0.03 });
  t.cyl(0.24, 0.24, 0.1, -0.35, 0.56, -0.3, p.hull2, { n: 12 });
  t.box(0.2, 0.16, 0.26, 0.42, 0.6, 0.2, DARK, { r: 0.04 });
  t.box(0.14, 0.09, 0.02, 0.42, 0.61, 0.34, gl(p, 1.2), { kind: 'glow', r: 0 });
  t.cyl(0.014, 0.014, 1.1, -0.6, 1.05, -0.8, STEEL, { kind: 'metal', n: 5 });
  t.box(1.52, 0.08, 0.4, 0, 0.44, -0.68, p.accent, { r: 0.02 });
  const tn = t.build('turret'); tn.position.set(0, 1.04, -0.15); root.add(tn);
  root.userData.muzzle = [0, 0.28, 3.35];
  return root;
}

function mBuggy(p) {
  const root = new THREE.Group();
  const h = new MB();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    h.cyl(0.33, 0.33, 0.28, sx * 0.7, 0.33, sz * 0.82, RUBBER, { rz: PI / 2, n: 14 });
    h.cyl(0.17, 0.17, 0.3, sx * 0.7, 0.33, sz * 0.82, STEEL, { rz: PI / 2, kind: 'metal', n: 8 });
    h.box(0.34, 0.06, 0.8, sx * 0.7, 0.7, sz * 0.82, p.hull2, { r: 0.02 });
  }
  h.box(1.06, 0.3, 2.15, 0, 0.5, 0, p.hull, { r: 0.1, seg: 2 });
  h.box(0.96, 0.24, 0.72, 0, 0.6, 0.86, p.hull, { r: 0.08, rx: 0.3 });
  h.box(0.92, 0.36, 0.86, 0, 0.82, -0.1, p.hull2, { r: 0.11 });
  h.box(0.8, 0.22, 0.04, 0, 0.86, 0.35, gl(p, 0.35), { kind: 'glow', r: 0, rx: -0.3 });
  h.box(1.0, 0.14, 0.6, 0, 0.66, -0.8, p.hull2, { r: 0.04 });
  h.box(1.08, 0.08, 0.5, 0, 0.56, 0.2, p.accent, { r: 0.02 });
  h.box(1.12, 0.1, 0.1, 0, 0.4, 1.12, GUN, { kind: 'metal', r: 0.03 });
  for (const s of [-1, 1]) {
    h.box(0.14, 0.07, 0.04, s * 0.36, 0.56, 1.1, gl(p), { kind: 'glow', r: 0 });
    h.box(0.12, 0.3, 0.3, s * 0.42, 0.8, -0.85, RUBBER, { r: 0.04 });
  }
  root.add(h.build('hull'));
  const t = new MB();
  t.cyl(0.2, 0.25, 0.14, 0, 0.07, 0, GUN, { kind: 'metal', n: 10 });
  t.box(0.26, 0.22, 0.44, 0, 0.24, 0.02, p.hull, { r: 0.06 });
  for (const s of [-1, 1]) t.cyl(0.035, 0.035, 0.85, s * 0.07, 0.25, 0.62, GUN, { rx: PI / 2, kind: 'metal', n: 6 });
  t.box(0.2, 0.2, 0.26, 0.24, 0.22, -0.05, 0x4a4f3c, { r: 0.04 });
  t.box(0.08, 0.05, 0.02, 0, 0.37, 0.24, gl(p, 1.2), { kind: 'glow', r: 0 });
  const tn = t.build('turret'); tn.position.set(0, 1.0, -0.1); root.add(tn);
  root.userData.muzzle = [0, 0.25, 1.08];
  return root;
}

function mArty(p) {
  const root = new THREE.Group();
  const h = new MB();
  tracks(h, 0.74, 2.7, 0.44, 0.5, 5);
  for (const s of [-1, 1]) h.box(0.5, 0.07, 2.5, s * 0.74, 0.61, 0, p.hull2, { r: 0.03 });
  h.box(1.2, 0.4, 2.45, 0, 0.56, 0, p.hull, { r: 0.1 });
  h.box(1.14, 0.46, 0.82, 0, 0.95, 0.78, p.hull, { r: 0.12, seg: 2 });
  h.box(1.0, 0.16, 0.04, 0, 1.02, 1.2, gl(p, 0.4), { kind: 'glow', r: 0 });
  h.box(1.16, 0.08, 0.84, 0, 0.8, 0.78, p.accent, { r: 0.02 });
  h.box(1.0, 0.3, 1.1, 0, 0.9, -0.55, p.hull2, { r: 0.08 });
  h.cyl(0.26, 0.26, 0.9, 0, 1.12, -0.5, GUN, { rz: PI / 2, kind: 'metal', n: 12 });
  const el = 0.45, by = 1.15, bz = -0.5, L = 2.9;
  h.cyl(0.1, 0.13, L, 0, by + Math.sin(el) * L / 2, bz + Math.cos(el) * L / 2, GUN, { rx: PI / 2 - el, kind: 'metal', n: 10 });
  h.cyl(0.17, 0.17, 0.9, 0, by + Math.sin(el) * 0.55, bz + Math.cos(el) * 0.55, p.hull2, { rx: PI / 2 - el, n: 10 });
  h.cyl(0.16, 0.16, 0.34, 0, by + Math.sin(el) * (L - 0.1), bz + Math.cos(el) * (L - 0.1), GUN, { rx: PI / 2 - el, kind: 'metal', n: 10 });
  for (const s of [-1, 1]) {
    h.box(0.12, 0.12, 0.9, s * 0.45, 0.5, -1.55, GUN, { kind: 'metal', rx: -0.5, r: 0.03 });
    h.box(0.3, 0.26, 0.4, s * 0.38, 0.92, -1.0, 0x4a4f3c, { r: 0.04 });
  }
  h.cyl(0.012, 0.012, 0.9, 0.48, 1.6, 0.5, STEEL, { kind: 'metal', n: 5 });
  root.add(h.build('hull'));
  root.userData.muzzle = [0, by + Math.sin(el) * (L + 0.1), bz + Math.cos(el) * (L + 0.1)];
  return root;
}

function mHarv(p) {
  const root = new THREE.Group();
  const h = new MB();
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    h.cyl(0.44, 0.44, 0.42, sx * 1.02, 0.44, -1.15 + i * 1.12, RUBBER, { rz: PI / 2, n: 14 });
    h.cyl(0.22, 0.22, 0.46, sx * 1.02, 0.44, -1.15 + i * 1.12, STEEL, { rz: PI / 2, kind: 'metal', n: 8 });
  }
  h.box(1.7, 0.4, 3.5, 0, 0.72, 0, p.hull2, { r: 0.1 });
  h.box(1.5, 0.84, 0.95, 0, 1.32, 1.15, p.hull, { r: 0.17, seg: 2 });
  h.box(1.3, 0.3, 0.04, 0, 1.46, 1.63, gl(p, 0.4), { kind: 'glow', r: 0 });
  h.box(1.52, 0.14, 0.97, 0, 1.02, 1.15, p.accent, { r: 0.03 });
  h.box(1.84, 1.0, 2.1, 0, 1.42, -0.62, p.hull, { r: 0.14, seg: 2 });
  h.box(1.5, 0.1, 1.75, 0, 1.9, -0.62, DARK, { r: 0.02 });
  for (let i = 0; i < 3; i++) h.box(1.9, 0.9, 0.12, 0, 1.42, -1.35 + i * 0.73, p.hull2, { r: 0.03 });
  h.box(1.88, 0.14, 2.12, 0, 1.0, -0.62, WARN, { r: 0.03 });
  for (const s of [-1, 1]) {
    h.cyl(0.08, 0.08, 0.9, s * 0.62, 1.95, 0.5, STEEL, { kind: 'metal', n: 8 });
    h.box(0.16, 0.16, 1.1, s * 0.62, 0.6, 2.1, GUN, { kind: 'metal', rx: 0.2, r: 0.04 });
    h.box(0.14, 0.07, 0.04, s * 0.5, 1.1, 1.64, gl(p), { kind: 'glow', r: 0 });
  }
  h.cyl(0.09, 0.09, 0.1, 0, 1.8, 1.15, WARNL, { kind: 'glow', n: 8 });
  root.add(h.build('hull'));

  const d = new MB();
  d.cyl(0.3, 0.3, 1.5, 0, 0, 0, STEEL, { rz: PI / 2, kind: 'metal', n: 10 });
  for (let i = 0; i < 6; i++) { const a = i * PI / 3; d.box(1.4, 0.12, 0.12, 0, Math.cos(a) * 0.32, Math.sin(a) * 0.32, WARN, { rx: a, r: 0.02 }); }
  const drum = d.build('drum'); drum.position.set(0, 0.42, 2.62); root.add(drum);

  const c = new MB();
  for (let i = 0; i < 9; i++) {
    const x = ((i % 3) - 1) * 0.45, z = (((i / 3) | 0) - 1) * 0.5;
    c.cyl(0, 0.2, 0.55, x + (i % 2) * 0.1, 0.2, z, ORE, { kind: 'glow', n: 5, rx: (i % 3 - 1) * 0.3, rz: (i % 2 - 0.5) * 0.5 });
  }
  const cargo = c.build('cargo'); cargo.position.set(0, 1.85, -0.62); cargo.visible = false; root.add(cargo);
  return root;
}

// ---------------- 步兵 ----------------
function mInf(p, rocket) {
  const root = new THREE.Group();
  const b = new MB();
  b.box(0.34, 0.36, 0.22, 0, 0.66, 0, p.hull2, { r: 0.07 });
  b.box(0.36, 0.2, 0.25, 0, 0.72, 0, p.accent, { r: 0.05 });
  b.box(0.24, 0.26, 0.13, 0, 0.68, -0.16, p.dark, { r: 0.04 });
  b.sph(0.115, 0, 0.96, 0, SKIN, { n: 10, n2: 8 });
  b.sph(0.142, 0, 0.975, -0.005, p.hull, { n: 10, n2: 6, theta: PI * 0.56 });
  b.box(0.17, 0.035, 0.02, 0, 0.965, 0.118, gl(p, 0.9), { kind: 'glow', r: 0 });
  b.box(0.09, 0.3, 0.1, 0.22, 0.68, 0.09, p.hull2, { r: 0.03, rx: -0.9 });
  b.box(0.09, 0.3, 0.1, -0.22, 0.68, 0.09, p.hull2, { r: 0.03, rx: -0.9 });
  if (!rocket) {
    b.box(0.05, 0.07, 0.64, 0.1, 0.66, 0.34, GUN, { kind: 'metal', r: 0.015 });
    b.box(0.05, 0.12, 0.1, 0.1, 0.6, 0.2, GUN, { kind: 'metal', r: 0.015 });
  } else {
    b.cyl(0.075, 0.075, 0.88, 0.2, 0.92, 0.1, 0x4a5540, { rx: PI / 2, n: 8 });
    b.cyl(0.095, 0.095, 0.14, 0.2, 0.92, 0.52, GUN, { rx: PI / 2, kind: 'metal', n: 8 });
    b.cyl(0.05, 0.05, 0.03, 0.2, 0.92, 0.6, WARNL, { rx: PI / 2, kind: 'glow', n: 8 });
  }
  root.add(b.build('body'));
  for (const s of [-1, 1]) {
    const l = new MB();
    l.box(0.13, 0.44, 0.15, 0, -0.22, 0, p.dark, { r: 0.04 });
    l.box(0.14, 0.08, 0.22, 0, -0.42, 0.03, RUBBER, { r: 0.03 });
    const leg = l.build(s < 0 ? 'legL' : 'legR'); leg.position.set(s * 0.09, 0.46, 0); root.add(leg);
  }
  root.scale.setScalar(1.3);
  root.userData.muzzle = rocket ? [0.2, 0.92, 0.65] : [0.1, 0.66, 0.7];
  return root;
}

// ---------------- 建筑 ----------------
function slab(b, w, h, p) {
  const W = w * CS - 0.24, D = h * CS - 0.24;
  b.box(W, 0.3, D, 0, 0.15, 0, CONC, { r: 0.07 });
  b.box(W - 0.5, 0.04, D - 0.5, 0, 0.31, 0, CONC2, { r: 0 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.34, 0.05, 0.09, sx * (W / 2 - 0.34), 0.325, sz * (D / 2 - 0.12), gl(p, 0.9), { kind: 'glow', r: 0 });
}

function mHQ(p) {
  const root = new THREE.Group(); const b = new MB();
  slab(b, 3, 3, p);
  b.box(3.6, 1.6, 3.2, -0.5, 1.1, -0.7, p.hull, { r: 0.2, seg: 2 });
  b.box(3.66, 0.16, 3.26, -0.5, 1.62, -0.7, p.accent, { r: 0.04 });
  b.box(2.8, 0.26, 0.05, -0.5, 1.15, 0.91, gl(p, 0.5), { kind: 'glow', r: 0 });
  b.box(0.05, 0.26, 2.2, 1.31, 1.15, -0.7, gl(p, 0.5), { kind: 'glow', r: 0 });
  b.box(2.2, 1.3, 2.0, -0.9, 2.5, -1.0, p.hull2, { r: 0.18, seg: 2 });
  b.box(2.23, 0.22, 2.03, -0.9, 2.78, -1.0, gl(p, 0.45), { kind: 'glow', r: 0.02 });
  b.box(2.4, 0.16, 2.2, -0.9, 3.2, -1.0, p.hull, { r: 0.06 });
  b.box(1.2, 0.5, 1.0, -1.2, 3.52, -1.2, p.hull, { r: 0.1 });
  b.box(1.22, 0.16, 1.02, -1.2, 3.58, -1.2, gl(p, 0.6), { kind: 'glow', r: 0.02 });
  b.cyl(0.05, 0.08, 2.0, -1.75, 4.2, -1.75, STEEL, { kind: 'metal', n: 6 });
  b.sph(0.1, -1.75, 5.25, -1.75, REDL, { kind: 'glow', n: 8, n2: 6 });
  // 侧翼车库
  b.box(1.5, 1.1, 2.6, 2.0, 0.85, -1.1, p.hull2, { r: 0.14 });
  b.box(1.0, 0.66, 0.05, 2.0, 0.66, 0.21, DARK, { r: 0 });
  b.box(1.1, 0.06, 0.07, 2.0, 1.04, 0.22, gl(p, 0.9), { kind: 'glow', r: 0 });
  b.box(0.6, 0.3, 0.6, 2.0, 1.52, -1.6, CONC2, { r: 0.05 });
  b.cyl(0.2, 0.2, 0.08, 2.0, 1.7, -1.6, DARK, { n: 10 });
  // 正门
  b.box(1.1, 0.8, 0.5, -0.5, 0.7, 1.05, p.hull2, { r: 0.08 });
  b.box(0.56, 0.5, 0.03, -0.5, 0.62, 1.31, gl(p, 0.7), { kind: 'glow', r: 0 });
  b.box(1.5, 0.08, 0.8, -0.5, 0.36, 1.6, CONC2, { r: 0.02 });
  // 停机坪
  b.cyl(1.05, 1.1, 0.12, 1.75, 0.36, 1.75, CONC2, { n: 24 });
  b.tor(0.86, 0.04, 1.75, 0.43, 1.75, gl(p, 0.9), { kind: 'glow', rx: PI / 2, n: 28 });
  b.box(0.12, 0.02, 0.7, 1.5, 0.43, 1.75, WARN, { r: 0 });
  b.box(0.12, 0.02, 0.7, 2.0, 0.43, 1.75, WARN, { r: 0 });
  b.box(0.5, 0.02, 0.12, 1.75, 0.43, 1.75, WARN, { r: 0 });
  // 角灯柱
  for (const [x, z] of [[-2.65, 2.65], [-2.65, -2.65], [2.65, -2.65]]) {
    b.cyl(0.08, 0.13, 1.0, x, 0.8, z, CONC2, { n: 8 });
    b.sph(0.1, x, 1.36, z, gl(p, 1.2), { kind: 'glow', n: 8, n2: 6 });
  }
  // 屋顶设备
  b.box(0.7, 0.3, 0.5, 0.6, 2.05, -1.8, CONC2, { r: 0.05 });
  b.cyl(0.07, 0.07, 1.6, 0.9, 2.0, 0.3, STEEL, { kind: 'metal', rz: PI / 2, n: 8 });
  b.box(0.5, 0.36, 0.5, 0.7, 2.08, 0.3, p.hull2, { r: 0.06 });
  root.add(b.build());
  const r = new MB();
  r.cyl(0.06, 0.08, 0.5, 0, 0.25, 0, STEEL, { kind: 'metal', n: 6 });
  r.box(1.4, 0.55, 0.08, 0, 0.75, 0.05, p.hull, { r: 0.03, rx: -0.25 });
  r.box(1.44, 0.07, 0.1, 0, 0.75, 0.06, p.accent, { r: 0.02, rx: -0.25 });
  r.box(0.06, 0.06, 0.4, 0, 0.75, 0.28, STEEL, { kind: 'metal', r: 0 });
  r.sph(0.06, 0, 0.75, 0.5, gl(p, 1.4), { kind: 'glow', n: 6, n2: 5 });
  const rn = r.build('spin'); rn.position.set(-0.3, 3.28, -0.55); rn.userData.spin = 1.1; root.add(rn);
  return root;
}

function mPower(p) {
  const root = new THREE.Group(); const b = new MB();
  slab(b, 2, 2, p);
  for (const x of [-0.9, 0.9]) {
    b.cyl(0.52, 0.82, 1.9, x, 1.25, -0.7, p.hull, { n: 20 });
    b.cyl(0.6, 0.56, 0.14, x, 2.22, -0.7, p.hull2, { n: 20 });
    b.cyl(0.44, 0.44, 0.06, x, 2.28, -0.7, gl(p, 1.3), { kind: 'glow', n: 20 });
    b.tor(0.74, 0.05, x, 0.95, -0.7, p.accent, { rx: PI / 2, n: 24 });
    b.tor(0.6, 0.035, x, 1.7, -0.7, p.hull2, { rx: PI / 2, n: 24 });
  }
  b.cyl(0.09, 0.09, 1.2, 0, 0.9, -0.7, STEEL, { kind: 'metal', rz: PI / 2, n: 8 });
  b.box(2.7, 0.9, 1.3, 0, 0.75, 0.95, p.hull2, { r: 0.12 });
  b.box(2.73, 0.1, 1.33, 0, 1.04, 0.95, p.accent, { r: 0.03 });
  b.box(1.5, 0.34, 0.05, 0, 0.68, 1.61, gl(p, 1.0), { kind: 'glow', r: 0 });
  for (const x of [-1.5, 1.5]) {
    b.cyl(0.13, 0.13, 0.9, x, 0.75, 0.15, STEEL, { kind: 'metal', n: 8 });
    b.sph(0.13, x, 1.26, 0.15, gl(p, 1.3), { kind: 'glow', n: 8, n2: 6 });
  }
  b.cyl(0.2, 0.3, 0.3, 0, 1.35, 0.95, CONC2, { n: 10 });
  root.add(b.build());
  const r = new MB();
  r.tor(0.46, 0.05, 0, 0, 0, gl(p, 1.2), { kind: 'glow', n: 20, rx: 0.5 });
  r.tor(0.46, 0.05, 0, 0, 0, gl(p, 1.2), { kind: 'glow', n: 20, rx: PI / 2, rz: 0.4 });
  r.sph(0.2, 0, 0, 0, gl(p, 1.6), { kind: 'glow', n: 10, n2: 8 });
  const rn = r.build('spin'); rn.position.set(0, 2.0, 0.95); rn.userData.spin = 2.2; root.add(rn);
  return root;
}

function mRefinery(p) {
  const root = new THREE.Group(); const b = new MB();
  slab(b, 3, 3, p);
  b.box(3.3, 1.9, 2.6, -1.1, 1.25, -1.4, p.hull, { r: 0.2, seg: 2 });
  b.box(3.34, 0.16, 2.64, -1.1, 1.85, -1.4, p.accent, { r: 0.04 });
  b.box(2.4, 0.26, 0.05, -1.1, 1.3, -0.09, gl(p, 0.5), { kind: 'glow', r: 0 });
  b.box(1.6, 0.4, 1.2, -1.4, 2.4, -1.6, p.hull2, { r: 0.1 });
  for (const z of [-2.0, -0.55]) {
    b.cyl(0.72, 0.72, 2.4, 1.85, 1.5, z, p.hull2, { n: 20 });
    b.sph(0.72, 1.85, 2.7, z, p.hull2, { n: 20, n2: 8, theta: PI / 2 });
    b.cyl(0.74, 0.74, 0.16, 1.85, 1.1, z, ORE, { kind: 'glow', n: 20 });
    b.cyl(0.745, 0.745, 0.1, 1.85, 2.2, z, p.accent, { n: 20 });
  }
  b.cyl(0.1, 0.1, 1.5, 1.85, 3.0, -1.27, STEEL, { kind: 'metal', rx: PI / 2, n: 8 });
  b.cyl(0.22, 0.32, 3.4, -2.3, 2.0, -2.35, CONC2, { n: 12 });
  b.cyl(0.26, 0.26, 0.3, -2.3, 3.0, -2.35, WARN, { n: 12 });
  b.cyl(0.27, 0.27, 0.16, -2.3, 3.66, -2.35, DARK, { n: 12 });
  // 卸矿棚
  for (const s of [-1, 1]) b.box(0.26, 1.7, 0.26, s * 1.62, 1.15, 2.5, CONC2, { r: 0.05 });
  b.box(3.6, 0.24, 1.9, 0, 2.1, 1.75, p.hull2, { r: 0.07 });
  b.box(3.3, 0.08, 0.1, 0, 2.0, 2.68, gl(p, 1.0), { kind: 'glow', r: 0 });
  b.box(2.6, 0.06, 2.2, 0, 0.33, 1.75, DARK, { r: 0 });
  for (let i = 0; i < 5; i++) b.box(0.26, 0.02, 2.2, -1.04 + i * 0.52, 0.37, 1.75, WARN, { r: 0 });
  b.box(0.8, 0.3, 1.9, 0, 1.55, 0.35, STEEL, { kind: 'metal', rx: -0.35, r: 0.05 });
  b.box(1.0, 0.7, 0.6, 0, 0.7, 0.3, p.hull2, { r: 0.08 });
  b.cyl(0.1, 0.1, 2.0, 0.6, 0.9, -1.3, STEEL, { kind: 'metal', rz: PI / 2, n: 8 });
  root.add(b.build());
  const r = new MB();
  r.cyl(0.3, 0.34, 0.14, 0, 0.07, 0, DARK, { n: 12 });
  for (let i = 0; i < 4; i++) r.box(0.7, 0.03, 0.14, 0, 0.16, 0, STEEL, { kind: 'metal', ry: i * PI / 4, r: 0 });
  const rn = r.build('spin'); rn.position.set(-0.3, 2.2, -0.9); rn.userData.spin = 5; root.add(rn);
  return root;
}

function mBarracks(p) {
  const root = new THREE.Group(); const b = new MB();
  slab(b, 2, 2, p);
  b.hcyl(1.25, 2.9, -0.3, 0.3, -0.35, p.hull, { n: 18 });
  for (const z of [-1.5, -0.35, 0.8]) b.hcyl(1.3, 0.14, -0.3, 0.3, z, p.hull2, { n: 18 });
  b.hcyl(1.31, 0.16, -0.3, 0.3, 0.22, p.accent, { n: 18 });
  b.box(1.2, 1.0, 0.5, -0.3, 0.8, 1.2, p.hull2, { r: 0.08 });
  b.box(0.62, 0.72, 0.04, -0.3, 0.68, 1.46, DARK, { r: 0 });
  b.box(0.74, 0.06, 0.05, -0.3, 1.1, 1.46, gl(p, 1.1), { kind: 'glow', r: 0 });
  b.box(0.8, 0.9, 1.5, 1.4, 0.75, -0.7, p.hull2, { r: 0.1 });
  b.box(0.05, 0.2, 1.0, 1.81, 0.9, -0.7, gl(p, 0.5), { kind: 'glow', r: 0 });
  b.cyl(0.3, 0.1, 0.16, 1.4, 1.36, -0.9, p.hull, { n: 12, rx: 0.5 });
  b.cyl(0.02, 0.02, 0.3, 1.4, 1.3, -0.9, STEEL, { kind: 'metal', n: 5 });
  // 沙袋
  for (let i = 0; i < 4; i++) b.box(0.42, 0.2, 0.26, 0.75 + i * 0.36, 0.42, 1.6, SAND, { r: 0.08 });
  for (let i = 0; i < 3; i++) b.box(0.42, 0.2, 0.26, 0.93 + i * 0.36, 0.6, 1.6, SAND, { r: 0.08 });
  b.cyl(0.03, 0.03, 2.5, -1.6, 1.55, 1.55, STEEL, { kind: 'metal', n: 6 });
  b.box(0.7, 0.42, 0.03, -1.23, 2.5, 1.55, p.accent, { r: 0 });
  b.box(0.5, 0.3, 0.4, -1.5, 0.48, 0.3, 0x4a4f3c, { r: 0.04 });
  b.box(0.4, 0.26, 0.36, -1.5, 0.76, 0.3, 0x4a4f3c, { r: 0.04 });
  root.add(b.build());
  return root;
}

function mFactory(p) {
  const root = new THREE.Group(); const b = new MB();
  slab(b, 3, 3, p);
  b.box(4.4, 2.0, 4.1, -0.45, 1.3, -0.6, p.hull, { r: 0.2, seg: 2 });
  b.box(4.44, 0.18, 4.14, -0.45, 1.95, -0.6, p.accent, { r: 0.04 });
  for (let i = 0; i < 3; i++) {
    b.box(4.2, 0.5, 1.2, -0.45, 2.42, -1.85 + i * 1.3, p.hull2, { r: 0.06, rx: 0.3 });
    b.box(3.8, 0.05, 0.4, -0.45, 2.6, -1.6 + i * 1.3, gl(p, 0.45), { kind: 'glow', r: 0, rx: 0.3 });
  }
  // 大门
  b.box(2.7, 1.56, 0.08, -0.45, 1.08, 1.46, DARK, { r: 0 });
  for (let i = 0; i < 5; i++) b.box(2.6, 0.03, 0.1, -0.45, 0.5 + i * 0.28, 1.48, GUN, { kind: 'metal', r: 0 });
  b.box(2.9, 0.09, 0.1, -0.45, 1.9, 1.5, gl(p, 1.1), { kind: 'glow', r: 0 });
  for (const s of [-1, 1]) {
    b.box(0.1, 1.56, 0.12, -0.45 + s * 1.42, 1.08, 1.5, WARN, { r: 0 });
    b.box(0.2, 0.02, 1.3, -0.45 + s * 1.2, 0.4, 2.2, WARN, { r: 0 });
  }
  b.box(2.7, 0.1, 1.4, -0.45, 0.33, 2.2, CONC2, { r: 0.02 });
  // 控制塔
  b.box(1.1, 2.9, 1.4, 2.35, 1.75, -1.7, p.hull2, { r: 0.12 });
  b.box(1.13, 0.26, 1.43, 2.35, 2.75, -1.7, gl(p, 0.5), { kind: 'glow', r: 0.02 });
  b.box(1.2, 0.12, 1.5, 2.35, 3.24, -1.7, p.hull, { r: 0.04 });
  b.cyl(0.02, 0.02, 1.0, 2.6, 3.8, -2.0, STEEL, { kind: 'metal', n: 5 });
  // 储罐与烟囱
  for (const z of [0.3, 1.3]) {
    b.cyl(0.4, 0.4, 1.3, 2.35, 0.75, z, STEEL, { kind: 'metal', rx: PI / 2, n: 14 });
    b.cyl(0.41, 0.41, 0.12, 2.35, 0.75, z, WARN, { rx: PI / 2, n: 14 });
  }
  for (const x of [-2.2, -1.7]) {
    b.cyl(0.14, 0.18, 1.3, x, 2.9, -2.2, CONC2, { n: 10 });
    b.cyl(0.17, 0.17, 0.1, x, 3.56, -2.2, DARK, { n: 10 });
  }
  root.add(b.build());
  for (const x of [0.3, 1.2]) {
    const r = new MB();
    r.cyl(0.3, 0.34, 0.14, 0, 0.07, 0, DARK, { n: 12 });
    for (let i = 0; i < 4; i++) r.box(0.7, 0.03, 0.14, 0, 0.16, 0, STEEL, { kind: 'metal', ry: i * PI / 4, r: 0 });
    const rn = r.build('spin'); rn.position.set(x, 2.32, 0.95); rn.userData.spin = 6; root.add(rn);
  }
  return root;
}

function mTech(p) {
  const root = new THREE.Group(); const b = new MB();
  slab(b, 2, 2, p);
  b.cyl(1.25, 1.5, 1.4, 0, 1.0, 0, p.hull, { n: 8 });
  b.cyl(1.3, 1.3, 0.14, 0, 1.36, 0, p.accent, { n: 8 });
  b.cyl(1.0, 1.2, 0.8, 0, 2.1, 0, p.hull2, { n: 8 });
  b.cyl(1.07, 1.07, 0.2, 0, 2.2, 0, gl(p, 0.5), { kind: 'glow', n: 8 });
  b.cyl(0.5, 0.92, 0.32, 0, 2.66, 0, p.hull, { n: 8 });
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2 + PI / 4;
    b.box(0.2, 1.7, 0.8, Math.cos(a) * 1.42, 1.1, Math.sin(a) * 1.42, p.hull2, { ry: -a + PI / 2, r: 0.05 });
    b.sph(0.08, Math.cos(a) * 1.5, 2.0, Math.sin(a) * 1.5, gl(p, 1.3), { kind: 'glow', n: 6, n2: 5 });
  }
  b.box(0.6, 0.7, 0.05, 0, 0.7, 1.4, gl(p, 0.7), { kind: 'glow', r: 0 });
  b.tor(1.62, 0.035, 0, 0.36, 0, gl(p, 1.0), { kind: 'glow', rx: PI / 2, n: 36 });
  root.add(b.build());
  const r = new MB();
  r.cyl(0.08, 0.12, 0.6, 0, 0.3, 0, STEEL, { kind: 'metal', n: 8 });
  r.cyl(0.95, 0.2, 0.32, 0, 0.85, 0.15, p.hull, { n: 18, rx: 0.6 });
  r.cyl(0.9, 0.9, 0.03, 0, 0.98, 0.24, p.hull2, { n: 18, rx: 0.6 });
  r.cyl(0.02, 0.02, 0.7, 0, 1.25, 0.43, STEEL, { kind: 'metal', n: 5, rx: 0.6 });
  r.sph(0.1, 0, 1.54, 0.63, gl(p, 1.6), { kind: 'glow', n: 8, n2: 6 });
  const rn = r.build('spin'); rn.position.set(0, 2.8, 0); rn.userData.spin = 0.9; root.add(rn);
  return root;
}

function mTurret(p) {
  const root = new THREE.Group(); const b = new MB();
  b.cyl(0.82, 0.92, 0.4, 0, 0.2, 0, CONC, { n: 8 });
  b.cyl(0.6, 0.72, 0.5, 0, 0.65, 0, p.hull2, { n: 8 });
  b.cyl(0.74, 0.74, 0.08, 0, 0.44, 0, p.accent, { n: 8 });
  root.add(b.build());
  const t = new MB();
  t.box(0.8, 0.5, 0.95, 0, 0.27, -0.05, p.hull, { r: 0.13, seg: 2 });
  t.box(0.82, 0.08, 0.5, 0, 0.42, -0.2, p.accent, { r: 0.02 });
  for (const s of [-1, 1]) {
    t.box(0.3, 0.38, 0.6, s * 0.52, 0.26, 0.1, p.hull2, { r: 0.07 });
    for (const y of [0.19, 0.33]) t.cyl(0.045, 0.045, 1.0, s * 0.52, y, 0.85, GUN, { rx: PI / 2, kind: 'metal', n: 6 });
    t.box(0.16, 0.26, 0.1, s * 0.52, 0.26, 1.3, GUN, { kind: 'metal', r: 0.02 });
  }
  t.box(0.3, 0.12, 0.04, 0, 0.36, 0.43, gl(p, 1.2), { kind: 'glow', r: 0 });
  t.cyl(0.012, 0.012, 0.6, -0.25, 0.8, -0.35, STEEL, { kind: 'metal', n: 5 });
  const tn = t.build('turret'); tn.position.set(0, 0.9, 0); root.add(tn);
  root.userData.muzzle = [0, 0.26, 1.4];
  return root;
}

function mRail(p) {
  const root = new THREE.Group(); const b = new MB();
  b.cyl(0.85, 0.95, 0.4, 0, 0.2, 0, CONC, { n: 6 });
  b.cyl(0.38, 0.62, 2.2, 0, 1.5, 0, p.hull2, { n: 6 });
  for (let i = 0; i < 3; i++) b.tor(0.56 - i * 0.05, 0.065, 0, 0.9 + i * 0.6, 0, gl(p, 0.9), { kind: 'glow', rx: PI / 2, n: 20 });
  for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3 + PI / 6; b.box(0.12, 2.0, 0.5, Math.cos(a) * 0.62, 1.4, Math.sin(a) * 0.62, p.hull, { ry: -a + PI / 2, r: 0.04 }); }
  b.cyl(0.5, 0.42, 0.14, 0, 2.62, 0, p.accent, { n: 6 });
  root.add(b.build());
  const t = new MB();
  t.box(0.74, 0.42, 0.95, 0, 0.21, -0.1, p.hull, { r: 0.1, seg: 2 });
  for (const s of [-1, 1]) t.box(0.09, 0.16, 1.6, s * 0.15, 0.23, 1.05, GUN, { kind: 'metal', r: 0.02 });
  t.box(0.14, 0.08, 1.5, 0, 0.23, 1.0, gl(p, 1.3), { kind: 'glow', r: 0.02 });
  for (let i = 0; i < 3; i++) t.box(0.46, 0.26, 0.08, 0, 0.23, 0.6 + i * 0.5, GUN, { kind: 'metal', r: 0.02 });
  t.sph(0.2, 0, 0.52, -0.15, gl(p, 1.5), { kind: 'glow', n: 10, n2: 8 });
  t.box(0.76, 0.07, 0.4, 0, 0.36, -0.3, p.accent, { r: 0.02 });
  const tn = t.build('turret'); tn.position.set(0, 2.7, 0); root.add(tn);
  root.userData.muzzle = [0, 0.23, 1.9];
  return root;
}

const MAKERS = {
  rifle: p => mInf(p, false), rocket: p => mInf(p, true),
  buggy: mBuggy, tank: mTank, heavy: mHeavy, arty: mArty, harv: mHarv,
  hq: mHQ, power: mPower, refinery: mRefinery, barracks: mBarracks, factory: mFactory, tech: mTech, turret: mTurret, rail: mRail,
};
const cache = {};

export function makeModel(type, team) {
  const key = type + team;
  if (!cache[key]) cache[key] = MAKERS[type](TEAMS[team]);
  return cache[key].clone(true);
}
