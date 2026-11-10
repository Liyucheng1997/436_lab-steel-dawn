import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { UNITS, BUILDINGS, CS } from './config.js';
import { generateMap, buildTerrain } from './terrain.js';
import { FX } from './fx.js';
import { Sfx } from './audio.js';
import { FogOfWar } from './fog.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { renderIcons } from './icons.js';
import { clamp } from './util.js';

const $ = id => document.getElementById(id);
const canvas = $('gl');
const PR = Math.min(window.devicePixelRatio || 1, 1.5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1218); scene.fog = new THREE.Fog(0x0c1218, 170, 520);
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 2, 900);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.42;

scene.add(new THREE.HemisphereLight(0xc4d8ff, 0x57503e, 0.75));
const sun = new THREE.DirectionalLight(0xfff0d6, 3.1);
const SUN_OFF = new THREE.Vector3(-70, 105, -38);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 320;
scene.add(sun); scene.add(sun.target);

const rt = new THREE.WebGLRenderTarget(innerWidth * PR, innerHeight * PR, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(PR); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.55, 1.0);
composer.addPass(bloom); composer.addPass(new OutputPass());

// ---------- 世界 ----------
const map = generateMap(20);
const terrain = buildTerrain(scene, map);
const fx = new FX(scene);
const sfx = new Sfx();
const fog = new FogOfWar(scene);
const game = new Game({ scene, map, terrain, fx, sfx, fog });
const input = new Input({ camera, dom: $('overlay'), game, fx, sfx, scene });
const icons = renderIcons([...Object.keys(UNITS), ...Object.keys(BUILDINGS)]);
const hud = new Hud({ game, camera, icons, sfx });
hud.input = input; input.hud = hud;
game.onNotify = (m, k) => hud.toast(m, k);

// ---------- 游戏速度 ----------
const SPEEDS = [1, 1.5, 2, 3, 4];
let speed = 1.5;
try { const s = parseFloat(localStorage.getItem('sd_speed')); if (SPEEDS.includes(s)) speed = s; } catch { /* 无本地存储时用默认值 */ }
function setSpeed(s, announce = true) {
  speed = s; $('speedVal').textContent = s + '×';
  try { localStorage.setItem('sd_speed', String(s)); } catch { /* 忽略 */ }
  if (announce) { hud.toast(`游戏速度 ${s}×`); sfx.play('click'); }
}
// dir: 1 加速，-1 减速，0 循环切换
function stepSpeed(dir) {
  const i = SPEEDS.indexOf(speed);
  const n = dir === 0 ? (i + 1) % SPEEDS.length : clamp(i + dir, 0, SPEEDS.length - 1);
  if (n !== i) setSpeed(SPEEDS[n]);
}
// 高倍速时拆成多个子步，保证寻路与碰撞稳定
function simulate(dt) {
  const n = Math.ceil(speed), h = dt * speed / n;
  for (let i = 0; i < n; i++) { game.update(h); game.animate(h); fx.update(h); terrain.update(h); }
}
setSpeed(speed, false);
$('speedBtn').onclick = () => { sfx.init(); stepSpeed(0); };
input.onSpeed = stepSpeed;

let paused = false, inMenu = true;
function setPaused(p) { if (game.over || inMenu) return; paused = p; $('pause').classList.toggle('hidden', !p); }
input.onPause = () => setPaused(!paused);
$('resumeBtn').onclick = () => setPaused(false);
$('restartBtn').onclick = () => location.reload();
$('againBtn').onclick = () => location.reload();

game.onOver = o => {
  const win = o.winner === 0; const s = game.teams[0].stats; const t = Math.floor(game.time);
  $('endTitle').textContent = win ? '胜 利' : '失 败'; $('endTitle').className = win ? 'win' : 'lose';
  $('endSub').textContent = win ? '敌方基地已被彻底摧毁，指挥官。' : '我方基地已全部沦陷。';
  $('endStats').innerHTML = `<div><b>${String((t / 60) | 0).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}</b>作战时长</div><div><b>${s.killed}</b>击毁敌军</div><div><b>${s.lost}</b>我方损失</div><div><b>${s.earned.toLocaleString('en-US')}</b>采集资金</div>`;
  setTimeout(() => { $('end').classList.remove('hidden'); sfx.play(win ? 'win' : 'lose'); }, 1400);
  input.enabled = false;
};

$('loading').textContent = '选择难度，开始作战';
document.querySelectorAll('.diff button').forEach(b => {
  b.onclick = () => {
    sfx.init(); sfx.play('ready');
    inMenu = false; $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
    input.cam.yaw = 0; input.enabled = true; game.start(b.dataset.diff); resize();
    hud.toast('先建造 聚变电站，再建 晶矿精炼厂 开始采矿', 'info');
  };
});

function resize() {
  const w = innerWidth, h = innerHeight;
  // 让镜头中心落在可操作区域中央（右侧被建造栏遮住 264px）
  const SB = inMenu ? 0 : 264;
  camera.aspect = (w + SB) / h; camera.setViewOffset(w + SB, h, SB, 0, w, h); camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer.setSize(w, h); hud.resize();
  fx.setScale(h * PR / (2 * Math.tan(camera.fov * Math.PI / 360)));
}
addEventListener('resize', resize); resize();

// ---------- 主循环 ----------
let last = performance.now(); let shadowHalf = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (inMenu) input.cam.yaw += dt * 0.045;
  input.update(dt);
  if (!paused) simulate(dt);
  fog.update(dt);
  const c = input.cam;
  sun.position.set(c.tx + SUN_OFF.x, SUN_OFF.y, c.tz + SUN_OFF.z); sun.target.position.set(c.tx, 0, c.tz); sun.target.updateMatrixWorld();
  const half = clamp(Math.round(c.dist * 0.95 / 8) * 8, 40, 120);
  if (half !== shadowHalf) { shadowHalf = half; const sc = sun.shadow.camera; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
  composer.render();
  if (!inMenu) { hud.update(dt); hud.drawOverlay(); }
}
requestAnimationFrame(frame);

// 调试句柄
window.__game = {
  game, input, hud, fog, scene, camera, renderer,
  // 快进模拟（调试用）：按固定步长推进 sec 秒并渲染一帧
  step(sec = 1) {
    const dt = 1 / 30;
    for (let t = 0; t < sec; t += dt) { input.update(dt); simulate(dt); fog.update(dt); }
    composer.render(); hud.update(dt); hud.drawOverlay();
  },
};
