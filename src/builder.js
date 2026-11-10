// 程序化建模工具：把大量基础几何体按材质类别合并成极少的 draw call
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const MATS = {
  paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.22 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.9 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const PI = Math.PI;

export class MB {
  constructor() { this.lists = { paint: [], metal: [], glow: [] }; }

  add(geo, x, y, z, color, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g.attributes.uv) g.deleteAttribute('uv');
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0); _q.setFromEuler(_e);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    _m.compose(_p.set(x, y, z), _q, _s); g.applyMatrix4(_m);
    let r, gg, b;
    if (Array.isArray(color)) [r, gg, b] = color; else { _c.set(color); r = _c.r; gg = _c.g; b = _c.b; }
    const n = g.attributes.position.count; const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.lists[o.kind || 'paint'].push(g);
    return this;
  }
  box(w, h, d, x, y, z, color, o = {}) {
    const r = o.r ?? Math.min(w, h, d) * 0.18;
    const geo = r >= 0.012 ? new RoundedBoxGeometry(w, h, d, o.seg ?? 1, r) : new THREE.BoxGeometry(w, h, d);
    return this.add(geo, x, y, z, color, o);
  }
  cyl(rt, rb, h, x, y, z, color, o = {}) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, o.n ?? 14, 1, false), x, y, z, color, o);
  }
  // 半圆柱（拱顶），轴向沿 z，拱面朝上
  hcyl(r, len, x, y, z, color, o = {}) {
    return this.add(new THREE.CylinderGeometry(r, r, len, o.n ?? 16, 1, false, 0, PI), x, y, z, color, { ...o, rz: PI / 2, ry: PI / 2 });
  }
  sph(r, x, y, z, color, o = {}) {
    return this.add(new THREE.SphereGeometry(r, o.n ?? 14, o.n2 ?? 10, 0, PI * 2, 0, o.theta ?? PI), x, y, z, color, o);
  }
  tor(R, r, x, y, z, color, o = {}) {
    return this.add(new THREE.TorusGeometry(R, r, 8, o.n ?? 22), x, y, z, color, o);
  }
  build(name) {
    const g = new THREE.Group(); if (name) g.name = name;
    for (const kind of ['paint', 'metal', 'glow']) {
      const list = this.lists[kind]; if (!list.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(list), MATS[kind]);
      mesh.castShadow = kind !== 'glow'; mesh.receiveShadow = kind !== 'glow';
      g.add(mesh);
      for (const l of list) l.dispose();
    }
    return g;
  }
}
