// 地图生成（中心对称，保证公平）与地形 / 水面 / 植被 / 晶矿渲染
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CS, N, WORLD } from './config.js';
import { makeNoise, mulberry32, periodicNoise, clamp, smoothstep } from './util.js';

const WATER_T = 0.415;

export function generateMap(seed0 = 20) {
  for (let i = 0; i < 40; i++) { const m = tryGen(seed0 + i * 101); if (m) return m; }
  throw new Error('map generation failed');
}

function tryGen(seed) {
  const rnd = mulberry32(seed);
  const nz = makeNoise(seed), nz2 = makeNoise(seed + 17), nz3 = makeNoise(seed + 53);
  const bases = [{ cx: 13, cz: N - 17 }, { cx: N - 16, cz: 14 }];
  const baseC = bases.map(b => ({ x: b.cx + 1.5, z: b.cz + 1.5 }));

  const fields = [];
  const addField = (x, z, r) => { fields.push({ x, z, r }); fields.push({ x: N - x, z: N - z, r }); };
  addField(baseC[0].x + 11.5, baseC[0].z - 1, 4.2);
  addField(baseC[0].x + 1, baseC[0].z - 13.5, 3.9);
  addField(N * 0.3, N * 0.34, 4.6);
  addField(N * 0.8, N * 0.84, 4.6);
  fields.push({ x: N / 2, z: N / 2, r: 5.2 });

  const wf = (cx, cz) => {
    let v = (nz.fbm(cx * 0.06, cz * 0.06, 4) + nz.fbm((N - cx) * 0.06, (N - cz) * 0.06, 4)) * 0.5;
    for (const b of baseC) { const d = Math.hypot(cx - b.x, cz - b.z); v += Math.max(0, 1 - d / 21) * 0.5; }
    for (const f of fields) { const d = Math.hypot(cx - f.x, cz - f.z); v += Math.max(0, 1 - d / (f.r + 4)) * 0.2; }
    return v;
  };

  const blocked = new Uint8Array(N * N), kind = new Uint8Array(N * N);
  const ore = new Float32Array(N * N), oreMax = new Float32Array(N * N);
  for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
    const i = cz * N + cx;
    if (wf(cx + 0.5, cz + 0.5) < WATER_T + 0.012) { kind[i] = 1; blocked[i] = 1; }
    if (cx === 0 || cz === 0 || cx === N - 1 || cz === N - 1) blocked[i] = 1;
  }
  const oreCells = [];
  for (const f of fields) {
    const R = Math.ceil(f.r + 1);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const cx = Math.floor(f.x) + dx, cz = Math.floor(f.z) + dz;
      if (cx < 2 || cz < 2 || cx >= N - 2 || cz >= N - 2) continue;
      const i = cz * N + cx; if (blocked[i] || ore[i] > 0) continue;
      const d = Math.hypot(cx + 0.5 - f.x, cz + 0.5 - f.z);
      const n = nz3.n2(cx * 0.8, cz * 0.8);
      if (d < f.r * (0.7 + 0.5 * n)) { ore[i] = oreMax[i] = 500 + Math.round(rnd() * 5) * 100; oreCells.push(i); }
    }
  }
  const trees = [], rocks = [];
  for (let cz = 1; cz < N - 1; cz++) for (let cx = 1; cx < N - 1; cx++) {
    const i = cz * N + cx; if (blocked[i] || ore[i] > 0) continue;
    let near = false;
    for (const b of baseC) if (Math.hypot(cx + 0.5 - b.x, cz + 0.5 - b.z) < 14) near = true;
    for (const f of fields) if (Math.hypot(cx + 0.5 - f.x, cz + 0.5 - f.z) < f.r + 2.5) near = true;
    if (near) continue;
    const t = (nz2.fbm((cx + 0.5) * 0.1, (cz + 0.5) * 0.1, 3) + nz2.fbm((N - cx - 0.5) * 0.1, (N - cz - 0.5) * 0.1, 3)) * 0.5;
    if (t > 0.565 && rnd() < 0.62) {
      kind[i] = 2; blocked[i] = 1;
      const n = 1 + (rnd() < 0.55 ? 1 : 0);
      for (let k = 0; k < n; k++) trees.push({ x: (cx + 0.5 + (rnd() - 0.5) * 0.7) * CS, z: (cz + 0.5 + (rnd() - 0.5) * 0.7) * CS, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28, c: rnd() });
    } else if (rnd() < 0.006) {
      kind[i] = 3; blocked[i] = 1;
      rocks.push({ x: (cx + 0.5) * CS, z: (cz + 0.5) * CS, s: 0.8 + rnd() * 0.7, r: rnd() * 6.28 });
    }
  }
  // 连通性检查：两个基地必须互通，且所有矿区可达
  const seen = new Uint8Array(N * N); const q = [];
  const s0 = (bases[0].cz + 4) * N + bases[0].cx + 1; seen[s0] = 1; q.push(s0);
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % N, z = (c / N) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nzz = z + dz; if (nx < 0 || nzz < 0 || nx >= N || nzz >= N) continue;
      const ni = nzz * N + nx; if (seen[ni] || blocked[ni]) continue; seen[ni] = 1; q.push(ni);
    }
  }
  if (!seen[(bases[1].cz - 1) * N + bases[1].cx + 1]) return null;
  let reach = 0; for (const i of oreCells) if (seen[i]) reach++;
  if (reach < oreCells.length * 0.97) return null;

  return { seed, blocked, kind, ore, oreMax, oreCells, trees, rocks, bases, baseC, wf, fields };
}

function grainTexture() {
  const s = 256; const c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); const im = g.createImageData(s, s); const rnd = mulberry32(99);
  const P = periodicNoise(s, [[6, 0.35], [24, 0.3], [96, 0.2], [256, 0.15]], rnd);
  for (let i = 0; i < s * s; i++) { const v = 150 + P[i] * 105; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function waterNormalTexture() {
  const s = 256; const c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); const im = g.createImageData(s, s); const rnd = mulberry32(7);
  const H = periodicNoise(s, [[6, 0.5], [14, 0.3], [34, 0.2]], rnd);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const hx = H[y * s + ((x + 1) % s)] - H[y * s + ((x + s - 1) % s)];
    const hy = H[((y + 1) % s) * s + x] - H[((y + s - 1) % s) * s + x];
    let nx = -hx * 14, ny = -hy * 14, nzz = 1; const l = Math.hypot(nx, ny, nzz); nx /= l; ny /= l; nzz /= l;
    const i = (y * s + x) * 4; im.data[i] = (nx * 0.5 + 0.5) * 255; im.data[i + 1] = (ny * 0.5 + 0.5) * 255; im.data[i + 2] = (nzz * 0.5 + 0.5) * 255; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildTerrain(scene, map) {
  const EXT = 16, cells = N + EXT * 2, size = cells * CS, seg = cells * 2;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2); geo.translate(WORLD / 2, 0, WORLD / 2);
  const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3);
  const na = makeNoise(map.seed + 5), nb = makeNoise(map.seed + 9);
  const cG1 = new THREE.Color(0x4f6636), cG2 = new THREE.Color(0x78884a), cD = new THREE.Color(0x8c7a5a), cS = new THREE.Color(0xbcab80), cM = new THREE.Color(0x3a4a44);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); const cx = x / CS, cz = z / CS;
    const v = map.wf(cx, cz);
    pos.setY(i, v < WATER_T ? -1.7 * smoothstep(0, 0.085, WATER_T - v) : 0);
    c.copy(cG1).lerp(cG2, smoothstep(0.3, 0.7, na.fbm(cx * 0.16, cz * 0.16, 4)));
    c.lerp(cD, smoothstep(0.5, 0.66, nb.fbm(cx * 0.07 + 10, cz * 0.07, 4)) * 0.85);
    for (const b of map.baseC) { const d = Math.hypot(cx - b.x, cz - b.z); if (d < 11) c.lerp(cD, (1 - d / 11) * 0.7); }
    c.lerp(cS, smoothstep(WATER_T + 0.07, WATER_T + 0.004, v));
    c.lerp(cM, smoothstep(0, 0.06, WATER_T - v));
    let k = 0.93 + 0.14 * na.n2(cx * 2.3, cz * 2.3);
    if (cx < 0 || cz < 0 || cx > N || cz > N) k *= 0.78;
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const grain = grainTexture(); grain.repeat.set(cells / 3, cells / 3);
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, bumpMap: grain, bumpScale: 0.6, roughness: 0.96, metalness: 0 }));
  ground.receiveShadow = true; scene.add(ground);

  const outer = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a5a35, roughness: 1 }));
  outer.position.set(WORLD / 2, -1.9, WORLD / 2); scene.add(outer);

  const wn = waterNormalTexture(); wn.repeat.set(34, 34);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1f6e8e, roughness: 0.1, metalness: 0.35, transparent: true, opacity: 0.84, normalMap: wn, normalScale: new THREE.Vector2(0.22, 0.22) }));
  water.position.set(WORLD / 2, -0.42, WORLD / 2); water.receiveShadow = true; scene.add(water);

  const dummy = new THREE.Object3D(); const tc = new THREE.Color();
  // 树
  {
    const parts = [];
    const paint = (g, hex) => { const gg = g.toNonIndexed(); gg.deleteAttribute('uv'); const cc = new THREE.Color(hex); const n = gg.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); return gg; };
    parts.push(paint(new THREE.CylinderGeometry(0.11, 0.17, 0.8, 6).translate(0, 0.4, 0), 0x5a4330));
    parts.push(paint(new THREE.ConeGeometry(0.95, 1.3, 7).translate(0, 1.25, 0), 0x2f5a2c));
    parts.push(paint(new THREE.ConeGeometry(0.74, 1.1, 7).translate(0, 1.95, 0), 0x3a6a33));
    parts.push(paint(new THREE.ConeGeometry(0.48, 1.0, 7).translate(0, 2.6, 0), 0x4a7c3c));
    const tg = mergeGeometries(parts); tg.computeVertexNormals();
    const tm = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), Math.max(1, map.trees.length));
    map.trees.forEach((t, i) => {
      dummy.position.set(t.x, 0, t.z); dummy.rotation.set(0, t.r, 0); dummy.scale.set(t.s, t.s * (0.9 + t.c * 0.3), t.s); dummy.updateMatrix();
      tm.setMatrixAt(i, dummy.matrix); tm.setColorAt(i, tc.setRGB(0.8 + t.c * 0.35, 0.85 + t.c * 0.3, 0.75 + t.c * 0.2));
    });
    tm.count = map.trees.length; tm.castShadow = true; tm.receiveShadow = true; scene.add(tm);
  }
  // 岩石
  {
    const rm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.85, 0), new THREE.MeshStandardMaterial({ color: 0x7d7f80, flatShading: true, roughness: 0.85 }), Math.max(1, map.rocks.length * 2));
    let k = 0;
    for (const r of map.rocks) {
      dummy.position.set(r.x, 0.25 * r.s, r.z); dummy.rotation.set(r.r, r.r * 2, r.r * 3); dummy.scale.set(r.s, r.s * 0.7, r.s * 0.9); dummy.updateMatrix(); rm.setMatrixAt(k++, dummy.matrix);
      dummy.position.set(r.x + Math.cos(r.r) * 0.7, 0.1, r.z + Math.sin(r.r) * 0.7); dummy.scale.setScalar(r.s * 0.45); dummy.updateMatrix(); rm.setMatrixAt(k++, dummy.matrix);
    }
    rm.count = k; rm.castShadow = true; rm.receiveShadow = true; scene.add(rm);
  }
  // 晶矿
  const PER = 4; const rnd = mulberry32(map.seed + 3);
  const cg = mergeGeometries([new THREE.CylinderGeometry(0, 0.22, 0.5, 5).translate(0, 0.75, 0).toNonIndexed(), new THREE.CylinderGeometry(0.22, 0.14, 0.5, 5).translate(0, 0.25, 0).toNonIndexed()]);
  cg.computeVertexNormals();
  const om = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: 0x8a5cf0, emissive: 0x6a30ff, emissiveIntensity: 1.5, roughness: 0.22, metalness: 0.1, flatShading: true }), Math.max(1, map.oreCells.length * PER));
  const oreSlot = new Int32Array(N * N).fill(-1); const base = [];
  map.oreCells.forEach((idx, n) => {
    oreSlot[idx] = n; const cx = idx % N, cz = (idx / N) | 0;
    for (let k = 0; k < PER; k++) {
      base.push({ x: (cx + 0.5 + (rnd() - 0.5) * 0.8) * CS, z: (cz + 0.5 + (rnd() - 0.5) * 0.8) * CS, rx: (rnd() - 0.5) * 0.9, ry: rnd() * 6.28, rz: (rnd() - 0.5) * 0.9, s: 0.7 + rnd() * 0.9 });
    }
  });
  const setOre = idx => {
    const n = oreSlot[idx]; if (n < 0) return;
    const f = map.oreMax[idx] > 0 ? map.ore[idx] / map.oreMax[idx] : 0;
    for (let k = 0; k < PER; k++) {
      const b = base[n * PER + k]; const s = f > 0 ? b.s * (0.4 + 0.6 * f) * (map.oreMax[idx] / 800) : 0.0001;
      dummy.position.set(b.x, f > 0 ? -0.05 : -5, b.z); dummy.rotation.set(b.rx, b.ry, b.rz); dummy.scale.setScalar(s); dummy.updateMatrix(); om.setMatrixAt(n * PER + k, dummy.matrix);
    }
    om.instanceMatrix.needsUpdate = true;
  };
  for (const idx of map.oreCells) setOre(idx);
  om.count = map.oreCells.length * PER; om.castShadow = true; om.frustumCulled = false; scene.add(om);

  return {
    setOre,
    update(dt) { wn.offset.x += dt * 0.006; wn.offset.y += dt * 0.004; },
  };
}
