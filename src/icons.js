// 启动时把每个模型离屏渲染成图标，侧边栏直接使用真实模型的缩略图
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeModel } from './models.js';

export function renderIcons(types, size = 176) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(size, size); r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x4a4438, 1.0));
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.2); sun.position.set(-3, 6, 4); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
  const out = {}; const box = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3();
  const dir = new THREE.Vector3(0.85, 0.75, 1.15).normalize();
  for (const t of types) {
    const o = makeModel(t, 0); o.traverse(m => { if (m.name === 'cargo') m.visible = false; }); scene.add(o);
    box.setFromObject(o); box.getCenter(c); box.getSize(s);
    const rad = Math.max(s.x, s.y, s.z) * 0.62 + 0.25;
    cam.position.copy(c).addScaledVector(dir, rad / Math.tan(13 * Math.PI / 180)); cam.lookAt(c);
    r.render(scene, cam); out[t] = r.domElement.toDataURL('image/png'); scene.remove(o);
  }
  pm.dispose(); r.dispose(); r.forceContextLoss();
  return out;
}
