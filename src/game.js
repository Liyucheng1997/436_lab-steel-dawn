// 游戏核心：实体、经济、生产、移动、战斗、采矿
import * as THREE from 'three';
import { CS, N, WORLD, UNITS, BUILDINGS, WEAPONS, TEAMS, defOf, buildTime, QUEUES } from './config.js';
import { makeModel } from './models.js';
import { Pathfinder } from './pathfinding.js';
import { clamp, angleDiff, turnToward, rand } from './util.js';
import { AI } from './ai.js';

const _v = new THREE.Vector3();
const cellOf = v => clamp(Math.floor(v / CS), 0, N - 1);
const HARV_CAP = 700;
const ORE_GLOW = [1.6, 0.6, 3.2];
const BULLET = [4, 3, 1.3];
let NEXT_ID = 1;
const mkQ = () => ({ current: null, pending: [] });

const selMats = [
  new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 1.1), transparent: true, opacity: 0.95, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.5, 0.3), transparent: true, opacity: 0.95, depthWrite: false }),
];
const ringGeos = {};
function selMarker(r, team, square) {
  const key = (square ? 's' : 'c') + r.toFixed(2);
  if (!ringGeos[key]) {
    ringGeos[key] = square
      ? new THREE.RingGeometry(r * Math.SQRT2 * 0.96, r * Math.SQRT2 * 1.02, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2)
      : new THREE.RingGeometry(r, r * 1.14, 40).rotateX(-Math.PI / 2);
  }
  const m = new THREE.Mesh(ringGeos[key], selMats[team]); m.position.y = 0.09; m.visible = false; m.renderOrder = 5;
  return m;
}

export class Game {
  constructor({ scene, map, terrain, fx, sfx, fog }) {
    this.scene = scene; this.map = map; this.terrain = terrain; this.fx = fx; this.sfx = sfx; this.fog = fog;
    this.pf = new Pathfinder(map.blocked);
    this.time = 0; this.started = false; this.over = null; this.ai = null;
    this.units = []; this.buildings = []; this.projectiles = [];
    this.selection = new Set(); this.floaters = []; this.pings = [];
    this.hash = new Array(N * N).fill(null); this.hashUsed = [];
    this.teams = [0, 1].map(id => ({
      id, credits: 6000, powerMade: 0, powerUsed: 0, low: false, counts: {}, incomeMult: 1,
      queues: { build: mkQ(), def: mkQ(), inf: mkQ(), veh: mkQ() },
      stats: { killed: 0, lost: 0, earned: 0, built: 0 },
    }));
    this.visT = 0; this.checkT = 1; this.lastAlert = -99; this.alertPos = null; this.dirty = false;
    this.onNotify = null; this.onOver = null;
    this.bfsStamp = new Uint32Array(N * N); this.bfsId = 0;
    this.setupBases();
  }

  setupBases() {
    const m = this.map;
    for (let t = 0; t < 2; t++) {
      const b = m.bases[t]; this.spawnBuilding('hq', t, b.cx, b.cz, true);
      const spots = [[4, 1], [4, 2], [5, 2], [5, 0]]; const types = ['rifle', 'rifle', 'rifle', 'tank'];
      spots.forEach(([dx, dz], i) => {
        const cx = t === 0 ? b.cx + dx : b.cx + 2 - dx, cz = t === 0 ? b.cz + dz : b.cz + 2 - dz;
        this.spawnUnit(types[i], t, (cx + 0.5) * CS, (cz + 0.5) * CS);
      });
    }
    this.updateVision(); this.fog.snap();
  }

  start(diff) {
    this.started = true;
    this.ai = new AI(this, diff);
  }

  notify(msg, kind = 'info') { if (this.onNotify) this.onNotify(msg, kind); }

  // ---------- 实体创建 ----------
  spawnUnit(type, team, x, z) {
    const def = UNITS[type]; const obj = makeModel(type, team);
    obj.position.set(x, 0, z); this.scene.add(obj);
    const rot = team === 0 ? Math.PI * 0.75 : -Math.PI * 0.25;
    const u = {
      id: NEXT_ID++, kind: 'unit', type, def, team, hp: def.hp, maxHp: def.hp, pos: obj.position, rot, obj,
      radius: def.radius, mass: def.mass, alive: true, seen: team === 0, cool: Math.random() * 0.5,
      order: { type: 'idle' }, path: null, pi: 0, pathKind: null, auto: null, tyaw: rot,
      scanT: Math.random() * 0.4, repathT: 0, stuckT: 0, stuckN: 0, lastX: x, lastZ: z, moving: false,
      anim: Math.random() * 6, recoil: 0, cargo: 0, anchored: false, dustT: 0, lastHit: -99,
      turretNode: obj.getObjectByName('turret') || null, legL: obj.getObjectByName('legL') || null, legR: obj.getObjectByName('legR') || null,
      cargoNode: obj.getObjectByName('cargo') || null, drum: obj.getObjectByName('drum') || null,
    };
    if (u.turretNode) u.turretBase = u.turretNode.position.clone();
    u.sel = selMarker(def.radius * (def.cat === 'inf' ? 0.9 : 1.05), team, false); obj.add(u.sel);
    obj.rotation.y = rot;
    if (team === 1) obj.visible = false;
    this.units.push(u);
    return u;
  }

  spawnBuilding(type, team, cx, cz, instant = false) {
    const def = BUILDINGS[type]; const obj = makeModel(type, team);
    const x = (cx + def.w / 2) * CS, z = (cz + def.h / 2) * CS;
    obj.position.set(x, 0, z); this.scene.add(obj);
    const b = {
      id: NEXT_ID++, kind: 'building', type, def, team, hp: def.hp, maxHp: def.hp, pos: obj.position, rot: 0, obj,
      cx, cz, w: def.w, h: def.h, radius: def.w * CS * 0.5, alive: true, seen: team === 0, discovered: team === 0,
      cool: 0, tyaw: team === 0 ? Math.PI * 0.75 : -Math.PI * 0.25, target: null, scanT: Math.random() * 0.3, smokeT: 0, recoil: 0,
      rise: instant ? 1 : 0, rally: null, dockBusy: null, lastHit: -99,
      turretNode: obj.getObjectByName('turret') || null, spins: [],
      box: new THREE.Box3(new THREE.Vector3(x - def.w, 0, z - def.h), new THREE.Vector3(x + def.w, def.height, z + def.h)),
    };
    obj.traverse(o => { if (o.userData.spin) b.spins.push(o); });
    if (b.turretNode) { b.turretBase = b.turretNode.position.clone(); b.turretNode.rotation.y = b.tyaw; }
    b.sel = selMarker(def.w * CS * 0.5 + 0.1, team, true); obj.add(b.sel);
    for (let zz = cz; zz < cz + def.h; zz++) for (let xx = cx; xx < cx + def.w; xx++) this.map.blocked[zz * N + xx] = 2;
    const ex = this.exitPos(b); b.rally = { x: ex.x + rand(-1, 1), z: ex.z + 5 };
    // 把压在地基里的单位挤出去
    for (const u of this.units) {
      if (!u.alive) continue; const ux = cellOf(u.pos.x), uz = cellOf(u.pos.z);
      if (ux >= cx && ux < cx + def.w && uz >= cz && uz < cz + def.h) {
        const f = this.pf.nearestFree(ux, uz); if (f >= 0) { u.pos.x = (f % N + 0.5) * CS; u.pos.z = (((f / N) | 0) + 0.5) * CS; u.path = null; }
      }
    }
    if (!instant) {
      obj.scale.y = 0.02;
      this.sfx.playAt('place', x, z);
      for (let i = 0; i < 14; i++) this.fx.dust(x + rand(-def.w, def.w), z + rand(-def.h, def.h), 2.2);
    }
    if (team === 1) obj.visible = false;
    this.buildings.push(b); this.teams[team].stats.built++;
    this.recount();
    return b;
  }

  recount() {
    for (const t of this.teams) { t.counts = {}; t.powerMade = 0; t.powerUsed = 0; }
    for (const b of this.buildings) {
      if (!b.alive) continue; const t = this.teams[b.team];
      t.counts[b.type] = (t.counts[b.type] || 0) + 1;
      if (b.def.power > 0) t.powerMade += b.def.power; else t.powerUsed -= b.def.power;
    }
    for (const t of this.teams) {
      const low = t.powerUsed > t.powerMade;
      if (low && !t.low && t.id === 0 && this.started && this.time - (this.lastLowWarn ?? -99) > 12) { this.lastLowWarn = this.time; this.notify('电力不足！生产减速，防御效率下降', 'warn'); this.sfx.play('err'); }
      t.low = low;
    }
  }

  exitPos(b) { return { x: (b.cx + b.w / 2) * CS, z: (b.cz + b.h + 0.5) * CS }; }

  // ---------- 生产 ----------
  hasReq(team, type) {
    const def = defOf(type); if (!def || def.buildable === false) return false;
    const c = this.teams[team].counts;
    for (const r of def.req) if (!c[r]) return false;
    return def.kind === 'building' ? !!c.hq : !!c[def.from];
  }
  missingReq(team, type) {
    const def = defOf(type); const c = this.teams[team].counts; const out = [];
    if (def.kind === 'building') { if (!c.hq) out.push('指挥中心'); } else if (!c[def.from]) out.push(BUILDINGS[def.from].name);
    for (const r of def.req) if (!c[r]) out.push(BUILDINGS[r].name);
    return out;
  }
  producerFor(team, def) {
    const want = def.kind === 'building' ? 'hq' : def.from;
    for (const b of this.buildings) if (b.alive && b.team === team && b.type === want && b.rise >= 1) return b;
    return null;
  }
  enqueue(team, type) {
    const def = defOf(type); const t = this.teams[team]; const q = t.queues[def.queue];
    if (!this.hasReq(team, type)) { if (team === 0) { this.notify('尚未满足建造条件：需要 ' + this.missingReq(0, type).join('、'), 'warn'); this.sfx.play('err'); } return false; }
    if (def.kind === 'building') {
      if (q.current) { if (team === 0) { this.notify('该建造队列正忙', 'warn'); this.sfx.play('err'); } return false; }
      q.current = { type, paid: 0, progress: 0, ready: false, stalled: false };
    } else {
      if (q.pending.length + (q.current ? 1 : 0) >= 20) return false;
      if (!q.current) q.current = { type, paid: 0, progress: 0, ready: false, stalled: false }; else q.pending.push(type);
    }
    if (team === 0) this.sfx.play('click');
    return true;
  }
  cancel(team, type) {
    const def = defOf(type); const t = this.teams[team]; const q = t.queues[def.queue];
    const i = q.pending.lastIndexOf(type);
    if (i >= 0) { q.pending.splice(i, 1); if (team === 0) this.sfx.play('click'); return true; }
    if (q.current && q.current.type === type) {
      t.credits += q.current.paid; q.current = null;
      if (team === 0) { this.sfx.play('click'); this.notify('已取消，资金已退还'); }
      return true;
    }
    return false;
  }
  updateProduction(t, dt) {
    for (const qn of QUEUES) {
      const q = t.queues[qn];
      if (!q.current) { if (!q.pending.length) continue; q.current = { type: q.pending.shift(), paid: 0, progress: 0, ready: false, stalled: false }; }
      const c = q.current; if (c.ready) continue;
      const def = defOf(c.type);
      if (!this.producerFor(t.id, def)) { c.stalled = true; continue; }
      let rate = 1 / buildTime(def); if (t.low) rate *= 0.5;
      const need = Math.max(0, Math.min(def.cost * rate * dt, def.cost - c.paid));
      if (t.credits >= need) { t.credits -= need; c.paid += need; c.progress += rate * dt; c.stalled = false; } else c.stalled = true;
      if (c.progress >= 1) {
        if (def.kind === 'building') {
          c.ready = true; c.progress = 1;
          if (t.id === 0) { this.notify(`${def.name} 建造完成，点击图标后在地图上部署`, 'ok'); this.sfx.play('ready'); }
        } else { this.produceUnit(t.id, c.type); q.current = null; }
      }
    }
  }
  produceUnit(team, type) {
    const def = UNITS[type]; const b = this.producerFor(team, def); if (!b) return null;
    const e = this.exitPos(b); const f = this.pf.nearestFree(cellOf(e.x), cellOf(e.z));
    const x = f >= 0 ? (f % N + 0.5) * CS : e.x, z = f >= 0 ? (((f / N) | 0) + 0.5) * CS : e.z;
    const u = this.spawnUnit(type, team, x + rand(-0.3, 0.3), z); u.rot = u.tyaw = 0; this.teams[team].stats.built++;
    if (def.harvester) u.order = { type: 'harvest', state: 'seek', near: -1 };
    else if (b.rally) this.orderMove([u], b.rally.x + rand(-1.5, 1.5), b.rally.z + rand(-1.5, 1.5));
    if (team === 0) { this.notify(`${def.name} 已就绪`, 'ok'); this.sfx.play('unit'); }
    return u;
  }
  canPlace(team, type, cx, cz, margin = 0) {
    const def = BUILDINGS[type]; const b = this.map.blocked, ore = this.map.ore;
    for (let z = cz - margin; z < cz + def.h + margin; z++) for (let x = cx - margin; x < cx + def.w + margin; x++) {
      if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) return false;
      const i = z * N + x; if (b[i]) return false;
      if (x >= cx && x < cx + def.w && z >= cz && z < cz + def.h && ore[i] > 0) return false;
    }
    if ((type === 'refinery' || type === 'factory' || type === 'barracks') && b[(cz + def.h) * N + cx + (def.w >> 1)]) return false; // 出口留空
    for (const o of this.buildings) {
      if (!o.alive || o.team !== team) continue;
      const gx = Math.max(o.cx - (cx + def.w), cx - (o.cx + o.w), 0), gz = Math.max(o.cz - (cz + def.h), cz - (o.cz + o.h), 0);
      if (Math.max(gx, gz) <= 4) return true;
    }
    return false;
  }
  placeBuilding(team, type, cx, cz) {
    const def = BUILDINGS[type]; const q = this.teams[team].queues[def.queue];
    if (!q.current || q.current.type !== type || !q.current.ready) return null;
    if (!this.canPlace(team, type, cx, cz)) return null;
    q.current = null;
    return this.spawnBuilding(type, team, cx, cz);
  }
  sell(b) {
    if (!b.alive || b.kind !== 'building') return;
    const t = this.teams[b.team]; const refund = Math.round(b.def.cost * 0.5 * (b.hp / b.maxHp));
    t.credits += refund;
    if (b.team === 0) { this.notify(`已出售 ${b.def.name}，回收 ${refund}`); this.sfx.play('sell'); this.floaters.push({ x: b.pos.x, y: 2, z: b.pos.z, text: '+' + refund, t: 0 }); }
    this.kill(b, null, true);
  }

  // ---------- 指令 ----------
  clearState(u) {
    u.anchored = false; u.path = null; u.stuckN = 0;
    if (u.order.ref && u.order.ref.dockBusy === u) u.order.ref.dockBusy = null;
  }
  // stride=2 时隔一格取点，给大型载具留出间距
  formation(x, z, n, stride = 1) {
    const b = this.map.blocked; const start = this.pf.nearestFree(cellOf(x), cellOf(z));
    if (start < 0) return [{ x, z }];
    const sx = start % N, sz = (start / N) | 0;
    const out = []; const id = ++this.bfsId; const st = this.bfsStamp; const q = [start]; st[start] = id;
    for (let h = 0; h < q.length && out.length < n; h++) {
      const c = q[h], cx = c % N, cz = (c / N) | 0;
      if (stride === 1 || ((cx - sx) % stride === 0 && (cz - sz) % stride === 0)) out.push({ x: (cx + 0.5) * CS, z: (cz + 0.5) * CS });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const ni = nz * N + nx; if (st[ni] === id || b[ni]) continue; st[ni] = id; q.push(ni);
      }
    }
    if (cellOf(x) + cellOf(z) * N === start) out[0] = { x, z };
    return out;
  }
  orderMove(units, x, z, amove = false) {
    const big = units.length > 1 && units.some(u => u.radius > 1);
    const spots = this.formation(x, z, units.length, big ? 2 : 1);
    units.forEach((u, i) => {
      const s = spots[Math.min(i, spots.length - 1)];
      this.clearState(u);
      u.order = amove && u.def.weapon ? { type: 'amove', x: s.x, z: s.z, tries: 0 } : { type: 'move' };
      if (!amove) u.auto = null;
      if (!this.setPath(u, s.x, s.z, 'order') && u.order.type === 'move') u.order = { type: 'idle' };
    });
  }
  orderAttack(units, target) {
    for (const u of units) { if (!u.def.weapon) continue; this.clearState(u); u.order = { type: 'attack', target }; u.repathT = 0; }
  }
  orderHarvest(units, cellIdx) { for (const u of units) { this.clearState(u); u.order = { type: 'harvest', state: 'seek', near: cellIdx }; } }
  orderReturn(units) { for (const u of units) { this.clearState(u); u.order = { type: 'harvest', state: 'return', near: -1 }; } }
  orderStop(units) { for (const u of units) { this.clearState(u); u.order = { type: 'idle' }; u.auto = null; } }

  setPath(u, x, z, kind = 'order') {
    const sx = cellOf(u.pos.x), sz = cellOf(u.pos.z), tx = cellOf(x), tz = cellOf(z);
    const cells = this.pf.find(sx, sz, tx, tz);
    if (!cells) { u.path = null; return false; }
    const pts = cells.map(c => ({ x: (c % N + 0.5) * CS, z: (((c / N) | 0) + 0.5) * CS }));
    const direct = !this.map.blocked[tz * N + tx];
    if (!pts.length) { if (direct) pts.push({ x, z }); else { u.path = null; return true; } }
    else if (direct && cells[cells.length - 1] === tz * N + tx) pts[pts.length - 1] = { x, z };
    u.path = this.pf.smooth(u.pos, pts); u.pi = 0; u.pathKind = kind; u.stuckT = 0;
    return true;
  }

  // ---------- 主循环 ----------
  update(dt) {
    if (this.over || !this.started) return;
    this.time += dt;
    for (const i of this.hashUsed) this.hash[i].length = 0;
    this.hashUsed.length = 0;
    for (const u of this.units) {
      if (!u.alive) continue; const i = cellOf(u.pos.z) * N + cellOf(u.pos.x);
      let l = this.hash[i]; if (!l) l = this.hash[i] = [];
      if (!l.length) this.hashUsed.push(i); l.push(u);
    }
    for (const t of this.teams) this.updateProduction(t, dt);
    for (const u of this.units) if (u.alive) this.updateUnit(u, dt);
    this.separate();
    for (const b of this.buildings) if (b.alive) this.updateBuilding(b, dt);
    this.updateProjectiles(dt);
    this.visT -= dt; if (this.visT <= 0) { this.visT = 0.2; this.updateVision(); }
    if (this.ai) this.ai.update(dt);
    if (this.dirty) { this.units = this.units.filter(u => u.alive); this.buildings = this.buildings.filter(b => b.alive); this.dirty = false; }
    for (const f of this.floaters) f.t += dt;
    if (this.floaters.length && this.floaters[0].t > 1.6) this.floaters.shift();
    for (const p of this.pings) p.t += dt;
    if (this.pings.length && this.pings[0].t > 4) this.pings.shift();
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 1;
      for (let t = 0; t < 2; t++) if (!this.buildings.some(b => b.team === t && b.alive)) { this.over = { winner: 1 - t }; if (this.onOver) this.onOver(this.over); break; }
    }
  }

  // 模型的轻量动画（菜单暂停时也可运行）
  animate(dt) {
    for (const b of this.buildings) for (const s of b.spins) s.rotation.y += s.userData.spin * dt * (this.teams[b.team].low ? 0.25 : 1);
  }

  updateVision() {
    const src = [];
    for (const u of this.units) if (u.alive && u.team === 0) src.push(cellOf(u.pos.x), cellOf(u.pos.z), u.def.sight);
    for (const b of this.buildings) if (b.alive && b.team === 0) src.push(b.cx + (b.w >> 1), b.cz + (b.h >> 1), b.def.sight);
    this.fog.compute(src);
    const vis = this.fog.vis;
    for (const u of this.units) { if (u.team === 0) continue; u.seen = vis[cellOf(u.pos.z) * N + cellOf(u.pos.x)] === 2; u.obj.visible = u.seen; }
    for (const b of this.buildings) {
      if (b.team === 0) continue;
      b.seen = vis[b.cz * N + b.cx] === 2 || vis[(b.cz + b.h - 1) * N + b.cx + b.w - 1] === 2 || vis[(b.cz + (b.h >> 1)) * N + b.cx + (b.w >> 1)] === 2;
      if (b.seen) b.discovered = true; b.obj.visible = b.discovered;
    }
  }

  canSee(team, t) { return team === 1 ? true : (t.kind === 'building' ? t.discovered : t.seen); }
  distTo(e, t) {
    if (t.kind === 'building') {
      const dx = Math.max(Math.abs(e.pos.x - t.pos.x) - t.w, 0), dz = Math.max(Math.abs(e.pos.z - t.pos.z) - t.h, 0);
      return Math.hypot(dx, dz);
    }
    return Math.hypot(e.pos.x - t.pos.x, e.pos.z - t.pos.z);
  }
  findTarget(e, range, minRange = 0) {
    let best = null, bd = 1e9; const ex = e.pos.x, ez = e.pos.z;
    const cr = Math.ceil(range / CS) + 1, cx = cellOf(ex), cz = cellOf(ez);
    const z0 = Math.max(0, cz - cr), z1 = Math.min(N - 1, cz + cr), x0 = Math.max(0, cx - cr), x1 = Math.min(N - 1, cx + cr);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const l = this.hash[z * N + x]; if (!l || !l.length) continue;
      for (const u of l) {
        if (u.team === e.team || !u.alive) continue; if (e.team === 0 && !u.seen) continue;
        const d = Math.hypot(u.pos.x - ex, u.pos.z - ez); if (d > range || d < minRange) continue;
        const score = d + (u.def.weapon ? 0 : 3);
        if (score < bd) { bd = score; best = u; }
      }
    }
    for (const b of this.buildings) {
      if (b.team === e.team || !b.alive) continue; if (e.team === 0 && !b.seen) continue;
      const d = this.distTo(e, b); if (d > range || d < minRange) continue;
      const score = d + (b.def.weapon ? 1 : 5);
      if (score < bd) { bd = score; best = b; }
    }
    return best;
  }

  // ---------- 单位 ----------
  updateUnit(u, dt) {
    u.cool -= dt; u.moving = false;
    if (u.def.harvester) this.updateHarvester(u, dt);
    else this.updateCombat(u, dt);
    // 卡住检测
    if (u.path) {
      u.stuckT += dt;
      if (u.stuckT > 1.2) {
        const mv = Math.hypot(u.pos.x - u.lastX, u.pos.z - u.lastZ); u.lastX = u.pos.x; u.lastZ = u.pos.z; u.stuckT = 0;
        if (mv < 0.35) {
          u.stuckN++;
          if (u.stuckN >= 2) {
            const g = u.path[u.path.length - 1];
            if (Math.hypot(g.x - u.pos.x, g.z - u.pos.z) < 5 || u.stuckN >= 5) { u.path = null; u.stuckN = 0; }
            else this.setPath(u, g.x, g.z, u.pathKind);
          }
        } else u.stuckN = 0;
      }
    } else { u.stuckT = 0; u.lastX = u.pos.x; u.lastZ = u.pos.z; }
    // 外观同步
    u.obj.rotation.y = u.rot;
    if (u.turretNode) {
      u.recoil = Math.max(0, u.recoil - dt * 5);
      const rel = u.tyaw - u.rot, k = u.recoil * 0.16;
      u.turretNode.rotation.y = rel;
      u.turretNode.position.set(u.turretBase.x - Math.sin(rel) * k, u.turretBase.y, u.turretBase.z - Math.cos(rel) * k);
    }
    if (u.legL) {
      if (u.moving) { u.anim += dt * u.def.speed * 2.8; const s = Math.sin(u.anim) * 0.75; u.legL.rotation.x = s; u.legR.rotation.x = -s; u.pos.y = Math.abs(Math.cos(u.anim)) * 0.05; }
      else { u.legL.rotation.x *= 0.8; u.legR.rotation.x *= 0.8; u.pos.y = 0; }
    } else if (u.moving && u.seen) {
      u.dustT -= dt;
      if (u.dustT <= 0) { u.dustT = 0.12; this.fx.dust(u.pos.x - Math.sin(u.rot) * u.radius, u.pos.z - Math.cos(u.rot) * u.radius, u.radius); }
    }
    if (u.cargoNode) { u.cargoNode.visible = u.cargo > 0; u.cargoNode.scale.y = 0.3 + 0.7 * u.cargo / HARV_CAP; }
  }

  follow(u, dt) {
    const p = u.path; if (!p) return false;
    let wp = p[u.pi]; let dx = wp.x - u.pos.x, dz = wp.z - u.pos.z; let d = Math.hypot(dx, dz);
    const last = u.pi === p.length - 1;
    if (d < (last ? 0.25 : 0.9)) {
      u.pi++; if (u.pi >= p.length) { u.path = null; return false; }
      wp = p[u.pi]; dx = wp.x - u.pos.x; dz = wp.z - u.pos.z; d = Math.hypot(dx, dz);
    }
    if (d < 1e-4) return true;
    const want = Math.atan2(dx, dz), sp = u.def.speed; let mx, mz, step;
    if (u.def.cat === 'inf') { u.rot = turnToward(u.rot, want, 12 * dt); mx = dx / d; mz = dz / d; step = sp * dt; }
    else {
      const diff = angleDiff(u.rot, want); u.rot += clamp(diff, -u.def.turn * dt, u.def.turn * dt);
      const ad = Math.abs(diff);
      if (d < 1.4 && ad < 1.2) { mx = dx / d; mz = dz / d; step = sp * dt * 0.8; }
      else { mx = Math.sin(u.rot); mz = Math.cos(u.rot); step = sp * dt * (ad > 0.7 ? 0 : Math.cos(ad * 1.3)); }
    }
    step = Math.min(step, d);
    if (step > 0) this.tryMove(u, mx * step, mz * step);
    u.moving = true; return true;
  }
  tryMove(u, dx, dz) {
    const b = this.map.blocked;
    const nx = clamp(u.pos.x + dx, 1, WORLD - 1), nz = clamp(u.pos.z + dz, 1, WORLD - 1);
    const cx = cellOf(nx), cz = cellOf(nz);
    if (!b[cz * N + cx]) { u.pos.x = nx; u.pos.z = nz; return true; }
    const ox = cellOf(u.pos.x), oz = cellOf(u.pos.z);
    if (b[oz * N + ox]) { u.pos.x = nx; u.pos.z = nz; return true; }
    if (!b[oz * N + cx]) { u.pos.x = nx; return true; }
    if (!b[cz * N + ox]) { u.pos.z = nz; return true; }
    return false;
  }

  updateCombat(u, dt) {
    const w = WEAPONS[u.def.weapon]; let o = u.order; let tgt = null, chase = false;
    if (o.type === 'attack') {
      tgt = o.target;
      if (!tgt.alive || !this.canSee(u.team, tgt)) { u.order = o = { type: 'idle' }; u.path = null; tgt = null; } else chase = true;
    } else {
      u.scanT -= dt;
      if (u.auto && (!u.auto.alive || !this.canSee(u.team, u.auto))) u.auto = null;
      if (u.scanT <= 0) {
        u.scanT = 0.35 + Math.random() * 0.2;
        const acq = o.type === 'move' ? w.range : w.range + (o.type === 'amove' ? 5 : 3);
        if (!u.auto || this.distTo(u, u.auto) > w.range) { const t = this.findTarget(u, acq, w.minRange || 0); if (t) u.auto = t; }
        if (u.auto && this.distTo(u, u.auto) > acq * 1.4) u.auto = null;
      }
      tgt = u.auto; chase = o.type !== 'move';
    }
    let firing = false;
    if (tgt) {
      const d = this.distTo(u, tgt);
      if (d <= w.range && (!w.minRange || d >= w.minRange)) {
        if (o.type !== 'move') u.path = null;
        const want = Math.atan2(tgt.pos.x - u.pos.x, tgt.pos.z - u.pos.z); let aligned = false;
        if (u.turretNode) { u.tyaw = turnToward(u.tyaw, want, 5 * dt); aligned = Math.abs(angleDiff(u.tyaw, want)) < 0.12; }
        else if (o.type !== 'move') { u.rot = turnToward(u.rot, want, (u.def.turn || 10) * dt); aligned = Math.abs(angleDiff(u.rot, want)) < 0.12; }
        if (aligned && u.cool <= 0) this.fire(u, tgt, w);
        firing = o.type !== 'move';
      } else if (chase && !(w.minRange && d < w.minRange)) {
        u.repathT -= dt;
        if (!u.path || u.pathKind !== 'chase' || u.repathT <= 0) { u.repathT = 0.8 + Math.random() * 0.5; this.setPath(u, tgt.pos.x, tgt.pos.z, 'chase'); }
      }
    } else if (u.path && u.pathKind === 'chase') u.path = null;

    if (o.type === 'move') { if (!this.follow(u, dt)) u.order = { type: 'idle' }; }
    else if (o.type === 'amove') {
      if (!tgt) {
        if (!u.path) {
          if (Math.hypot(o.x - u.pos.x, o.z - u.pos.z) < 3.5 || o.tries > 4) u.order = { type: 'idle' };
          else { o.tries++; this.setPath(u, o.x, o.z, 'order'); }
        } else if (!this.follow(u, dt) && Math.hypot(o.x - u.pos.x, o.z - u.pos.z) < 3.5) u.order = { type: 'idle' };
      } else if (!firing && u.path) this.follow(u, dt);
    } else if (tgt && !firing && u.path) this.follow(u, dt);
    if (u.turretNode && !tgt) u.tyaw = turnToward(u.tyaw, u.rot, 2.5 * dt);
  }

  muzzle(e) {
    const m = e.obj.userData.muzzle || [0, 1, 0]; const node = e.turretNode || e.obj;
    node.updateWorldMatrix(true, false);
    return _v.set(m[0], m[1], m[2]).applyMatrix4(node.matrixWorld);
  }
  fire(e, tgt, w) {
    const mz = this.muzzle(e); const mx = mz.x, my = mz.y, mzz = mz.z;
    const ay = tgt.kind === 'building' ? Math.min(tgt.def.height * 0.45, 1.7) : (tgt.def.cat === 'inf' ? 0.7 : 0.8);
    const tx = tgt.pos.x, tz = tgt.pos.z;
    const low = e.kind === 'building' && this.teams[e.team].low;
    e.cool = w.cd * (low ? 2.2 : 1) * rand(0.92, 1.08); e.recoil = 1;
    const dx = tx - mx, dz = tz - mzz, dl = Math.hypot(dx, dz) || 1;
    const shown = e.seen || tgt.seen;
    if (shown) this.sfx.playAt(w.sound, mx, mzz);
    const glow = TEAMS[e.team].glow;
    switch (w.type) {
      case 'bullet':
        if (shown) {
          this.fx.tracer(mx, my, mzz, tx + rand(-0.3, 0.3), ay + rand(-0.2, 0.2), tz + rand(-0.3, 0.3), BULLET, 0.07, 0.07);
          this.fx.muzzle(mx, my, mzz, dx / dl, dz / dl, 0.45);
          if (Math.random() < 0.35) this.fx.sparks(tx + rand(-0.4, 0.4), ay, tz + rand(-0.4, 0.4), 2);
        }
        this.damage(tgt, w.dmg * w.mult[tgt.def.armor], e);
        break;
      case 'beam':
        if (shown) {
          this.fx.tracer(mx, my, mzz, tx, ay, tz, glow.map(v => v * 2), 0.42, 0.4);
          this.fx.tracer(mx, my, mzz, tx, ay, tz, [4, 4, 4], 0.14, 0.3);
          this.fx.muzzle(mx, my, mzz, dx / dl, dz / dl, 1.2);
          this.fx.explosion(tx, ay, tz, 0.7); this.sfx.playAt('boomS', tx, tz);
        }
        this.damage(tgt, w.dmg * w.mult[tgt.def.armor], e);
        break;
      default: {
        if (shown) this.fx.muzzle(mx, my, mzz, dx / dl, dz / dl, w.type === 'rocket' ? 0.6 : (w.dmg > 100 ? 1.6 : 1.1));
        const p = { w, team: e.team, owner: e, target: w.type === 'arc' ? null : tgt, x: mx, y: my, z: mzz, sx: mx, sy: my, sz: mzz, tx, ty: w.type === 'arc' ? 0.1 : ay, tz, ay, t: 0, trailT: 0 };
        if (w.type === 'arc') { p.tx += rand(-1.2, 1.2); p.tz += rand(-1.2, 1.2); p.dur = Math.max(0.8, Math.hypot(p.tx - mx, p.tz - mzz) / w.speed); p.mesh = this.fx.projectile([4, 2.4, 0.8], 0.3, 0.6); }
        else if (w.type === 'rocket') p.mesh = this.fx.projectile([4, 2.2, 0.8], 0.13, 0.6);
        else p.mesh = this.fx.projectile(w.dmg > 100 ? glow.map(v => v * 1.8) : [4, 2.8, 1.2], w.dmg > 100 ? 0.2 : 0.13, w.dmg > 100 ? 1.5 : 1.0);
        p.mesh.position.set(mx, my, mzz);
        this.projectiles.push(p);
      }
    }
  }
  updateProjectiles(dt) {
    const ps = this.projectiles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; const w = p.w; let hit = false;
      if (w.type === 'arc') {
        p.t += dt / p.dur; const t = Math.min(1, p.t);
        const nx = p.sx + (p.tx - p.sx) * t, nz = p.sz + (p.tz - p.sz) * t;
        const ny = p.sy + (p.ty - p.sy) * t + Math.sin(Math.PI * t) * Math.min(14, p.dur * 5.5);
        p.mesh.lookAt(nx, ny, nz); p.x = nx; p.y = ny; p.z = nz; p.mesh.position.set(nx, ny, nz);
        p.trailT -= dt; if (p.trailT <= 0) { p.trailT = 0.04; this.fx.trail(nx, ny, nz); }
        if (t >= 1) hit = true;
      } else {
        if (p.target && p.target.alive) { p.tx = p.target.pos.x; p.tz = p.target.pos.z; p.ty = p.ay; }
        const dx = p.tx - p.x, dy = p.ty - p.y, dz = p.tz - p.z; const d = Math.hypot(dx, dy, dz);
        p.t += dt; const sp = w.type === 'rocket' ? w.speed * Math.min(1.6, 0.5 + p.t * 2) : w.speed; const step = sp * dt;
        if (d <= step) { p.x = p.tx; p.y = p.ty; p.z = p.tz; hit = true; }
        else {
          p.x += dx / d * step; p.y += dy / d * step; p.z += dz / d * step; p.mesh.position.set(p.x, p.y, p.z); p.mesh.lookAt(p.tx, p.ty, p.tz);
          if (w.type === 'rocket') { p.trailT -= dt; if (p.trailT <= 0) { p.trailT = 0.03; this.fx.trail(p.x, p.y, p.z); } }
        }
      }
      if (hit) {
        this.scene.remove(p.mesh); ps[i] = ps[ps.length - 1]; ps.pop();
        const s = w.type === 'arc' ? 1.5 : w.type === 'rocket' ? 0.7 : (w.dmg > 100 ? 1.1 : 0.75);
        const cx = cellOf(p.x), cz = cellOf(p.z);
        if (this.fog.vis[cz * N + cx] >= 1) { this.fx.explosion(p.x, Math.max(0.1, p.y - 0.3), p.z, s); this.sfx.playAt(s > 1 ? 'boom' : 'boomS', p.x, p.z); }
        const direct = p.target && p.target.alive ? p.target : null;
        if (direct) this.damage(direct, w.dmg * w.mult[direct.def.armor], p.owner);
        if (w.splash) {
          const r = w.splash;
          for (let z = Math.max(0, cz - 2); z <= Math.min(N - 1, cz + 2); z++) for (let x = Math.max(0, cx - 2); x <= Math.min(N - 1, cx + 2); x++) {
            const l = this.hash[z * N + x]; if (!l) continue;
            for (const u of l) {
              if (!u.alive || u.team === p.team || u === direct) continue;
              const d = Math.hypot(u.pos.x - p.x, u.pos.z - p.z); if (d < r) this.damage(u, w.dmg * w.mult[u.def.armor] * (1 - 0.6 * d / r), p.owner);
            }
          }
          for (const b of this.buildings) {
            if (!b.alive || b.team === p.team || b === direct) continue;
            _v.set(p.x, 0, p.z); const d = Math.hypot(Math.max(Math.abs(p.x - b.pos.x) - b.w, 0), Math.max(Math.abs(p.z - b.pos.z) - b.h, 0));
            if (d < r) this.damage(b, w.dmg * w.mult.bldg * (1 - 0.6 * d / r), p.owner);
          }
        }
      }
    }
  }

  damage(t, amt, attacker) {
    if (!t.alive) return;
    t.hp -= amt; t.lastHit = this.time;
    if (t.team === 0) { if (t.kind === 'building' || t.def.harvester) this.alert(t); }
    else if (this.ai) this.ai.onAttacked(t, attacker);
    if (t.kind === 'unit' && t.def.weapon && attacker && attacker.alive && t.order.type === 'idle' && !t.auto && this.canSee(t.team, attacker)) t.auto = attacker;
    if (t.hp <= 0) this.kill(t, attacker);
  }
  alert(t) {
    if (this.time - this.lastAlert < 9) return;
    this.lastAlert = this.time; this.alertPos = { x: t.pos.x, z: t.pos.z };
    this.notify(t.kind === 'building' ? '警报：基地遭到攻击！（空格键跳转）' : '警报：采集车遭到攻击！（空格键跳转）', 'bad');
    this.sfx.play('alarm'); this.pings.push({ x: t.pos.x, z: t.pos.z, t: 0 });
  }
  kill(e, attacker, silent = false) {
    if (!e.alive) return;
    e.alive = false; this.scene.remove(e.obj); this.selection.delete(e); this.dirty = true;
    if (!silent) {
      this.teams[e.team].stats.lost++; this.teams[1 - e.team].stats.killed++;
      const shown = e.team === 0 || e.seen || e.discovered;
      if (shown) {
        if (e.kind === 'building') {
          const n = e.w * e.w;
          for (let i = 0; i < n; i++) this.fx.explosion(e.pos.x + rand(-e.w, e.w) * 0.7, rand(0.3, e.def.height * 0.5), e.pos.z + rand(-e.h, e.h) * 0.7, rand(0.9, 1.5));
          this.sfx.playAt('boom', e.pos.x, e.pos.z, 1.2);
        } else if (e.def.cat === 'inf') { this.fx.puff(e.pos.x, 0.6, e.pos.z, 1); }
        else { this.fx.explosion(e.pos.x, 0.6, e.pos.z, 0.8 + e.radius * 0.45); this.sfx.playAt('boom', e.pos.x, e.pos.z); }
      }
      if (e.team === 0 && e.kind === 'building') this.notify(`${e.def.name} 被摧毁`, 'bad');
      if (e.team === 1 && e.kind === 'building' && shown) this.notify(`敌方 ${e.def.name} 已摧毁`, 'ok');
    } else for (let i = 0; i < 12; i++) this.fx.dust(e.pos.x + rand(-e.w, e.w), e.pos.z + rand(-e.h, e.h), 2.4);
    if (e.kind === 'building') {
      for (let z = e.cz; z < e.cz + e.h; z++) for (let x = e.cx; x < e.cx + e.w; x++) this.map.blocked[z * N + x] = 0;
      this.recount();
    }
  }

  // ---------- 采集车 ----------
  findOre(u, near) {
    const ore = this.map.ore; let cx, cz;
    if (near >= 0) { cx = near % N; cz = (near / N) | 0; } else { cx = cellOf(u.pos.x); cz = cellOf(u.pos.z); }
    const ux = cellOf(u.pos.x), uz = cellOf(u.pos.z);
    const claimed = new Set();
    for (const o of this.units) if (o !== u && o.alive && o.def.harvester && o.order.type === 'harvest' && o.order.cell >= 0) claimed.add(o.order.cell);
    let best = -1, bd = 1e9;
    for (const i of this.map.oreCells) {
      if (ore[i] <= 0) continue; const x = i % N, z = (i / N) | 0;
      let d = Math.hypot(x - cx, z - cz) + 0.35 * Math.hypot(x - ux, z - uz); if (claimed.has(i)) d += 6;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  nearestBuilding(u, type) {
    let best = null, bd = 1e9;
    for (const b of this.buildings) { if (!b.alive || b.team !== u.team || b.type !== type || b.rise < 1) continue; const d = Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  updateHarvester(u, dt) {
    const o = u.order;
    if (o.type === 'move') { if (!this.follow(u, dt)) u.order = { type: 'idle' }; return; }
    if (o.type !== 'harvest') return;
    const ore = this.map.ore;
    switch (o.state) {
      case 'seek': {
        o.wait = (o.wait || 0) - dt; if (o.wait > 0) return;
        const idx = this.findOre(u, o.near);
        if (idx < 0) { if (u.cargo > 0) { o.state = 'return'; } else o.wait = 3; return; }
        o.cell = idx; o.fail = 0; this.setPath(u, (idx % N + 0.5) * CS, (((idx / N) | 0) + 0.5) * CS); o.state = 'toOre'; break;
      }
      case 'toOre': {
        if (ore[o.cell] <= 0) { o.near = o.cell; o.state = 'seek'; break; }
        if (!this.follow(u, dt)) {
          const x = (o.cell % N + 0.5) * CS, z = (((o.cell / N) | 0) + 0.5) * CS;
          if (Math.hypot(x - u.pos.x, z - u.pos.z) < 2.2) { o.state = 'mine'; o.t = 0; u.anchored = true; }
          else if (++o.fail > 3) { o.near = -1; o.state = 'seek'; o.wait = 1; } else this.setPath(u, x, z);
        }
        break;
      }
      case 'mine': {
        o.t += dt; if (u.drum) u.drum.rotation.x += dt * 9;
        if (u.seen && Math.random() < dt * 14) this.fx.sparkle(u.pos.x + Math.sin(u.rot) * 2.2, 0.4, u.pos.z + Math.cos(u.rot) * 2.2, ORE_GLOW);
        if (o.t >= 0.75) {
          o.t = 0; const take = Math.min(100, ore[o.cell], HARV_CAP - u.cargo);
          ore[o.cell] -= take; u.cargo += take; this.terrain.setOre(o.cell);
          if (u.cargo >= HARV_CAP) { u.anchored = false; o.state = 'return'; }
          else if (ore[o.cell] <= 0) { u.anchored = false; o.near = o.cell; o.state = 'seek'; }
        }
        break;
      }
      case 'return': {
        o.wait = (o.wait || 0) - dt; if (o.wait > 0) return;
        const r = this.nearestBuilding(u, 'refinery'); if (!r) { o.wait = 2; return; }
        o.ref = r; o.fail = 0; const d = this.exitPos(r); this.setPath(u, d.x, d.z); o.state = 'toRef'; break;
      }
      case 'toRef': {
        const r = o.ref; if (!r.alive) { o.state = 'return'; break; }
        const d = this.exitPos(r); const dist = Math.hypot(d.x - u.pos.x, d.z - u.pos.z);
        const busy = r.dockBusy && r.dockBusy !== u && r.dockBusy.alive && r.dockBusy.order.ref === r;
        if (busy && dist < 7) { u.path = null; break; }
        if (!u.path && dist >= 2) { if (++o.fail > 6) { o.state = 'return'; o.wait = 1; } else this.setPath(u, d.x, d.z); break; }
        if (!this.follow(u, dt) && dist < 2) { o.state = 'dock'; o.t = 0; u.anchored = true; r.dockBusy = u; o.sx = u.pos.x; o.sz = u.pos.z; }
        break;
      }
      case 'dock': {
        const r = o.ref; if (!r.alive) { u.anchored = false; o.state = 'return'; break; }
        o.t += dt; const k = Math.min(1, o.t / 1.0); const e = k * k * (3 - 2 * k);
        u.rot = turnToward(u.rot, Math.PI, 4 * dt);
        u.pos.x = o.sx + (r.pos.x - o.sx) * e; u.pos.z = o.sz + (r.pos.z + 2.0 - o.sz) * e; u.moving = true;
        if (k >= 1) { o.state = 'unload'; o.t = 0; }
        break;
      }
      case 'unload': {
        o.t += dt;
        if (u.seen && Math.random() < dt * 10) this.fx.sparkle(u.pos.x, 2, u.pos.z, ORE_GLOW);
        if (o.t >= 1.3) {
          const t = this.teams[u.team]; const amt = Math.round(u.cargo * t.incomeMult);
          t.credits += amt; t.stats.earned += amt; u.cargo = 0;
          if (u.team === 0) { this.floaters.push({ x: u.pos.x, y: 3, z: u.pos.z, text: '+' + amt, t: 0 }); this.sfx.playAt('cash', u.pos.x, u.pos.z, 0.8); }
          o.state = 'undock'; o.t = 0;
        }
        break;
      }
      case 'undock': {
        const r = o.ref; o.t += dt; const k = Math.min(1, o.t / 0.9); const e = 1 - k;
        if (r.alive) { u.pos.x = o.sx + (r.pos.x - o.sx) * e; u.pos.z = o.sz + (r.pos.z + 2.0 - o.sz) * e; }
        u.moving = true;
        if (k >= 1) { u.anchored = false; if (r.dockBusy === u) r.dockBusy = null; o.near = o.cell ?? -1; o.state = 'seek'; o.wait = 0; }
        break;
      }
    }
  }

  // ---------- 单位互相挤开 ----------
  separate() {
    const hash = this.hash;
    for (const a of this.units) {
      if (!a.alive) continue; const cx = cellOf(a.pos.x), cz = cellOf(a.pos.z);
      for (let dz = -2; dz <= 2; dz++) { const z = cz + dz; if (z < 0 || z >= N) continue;
        for (let dx = -2; dx <= 2; dx++) { const x = cx + dx; if (x < 0 || x >= N) continue;
          const l = hash[z * N + x]; if (!l) continue;
          for (const b of l) {
            if (b.id <= a.id || !b.alive) continue; if (a.anchored && b.anchored) continue;
            let ox = b.pos.x - a.pos.x, oz = b.pos.z - a.pos.z; const rr = (a.radius + b.radius) * 0.95; let d2 = ox * ox + oz * oz;
            if (d2 >= rr * rr) continue;
            if (d2 < 1e-6) { ox = Math.random() - 0.5; oz = Math.random() - 0.5; d2 = ox * ox + oz * oz + 1e-6; }
            const d = Math.sqrt(d2); const ov = (rr - d) * 0.5; ox /= d; oz /= d;
            let wa = b.mass / (a.mass + b.mass), wb = 1 - wa;
            if (a.anchored) { wa = 0; wb = 1; } else if (b.anchored) { wa = 1; wb = 0; }
            else if (a.moving && !b.moving) { wa *= 0.4; wb = 1 - wa; } else if (b.moving && !a.moving) { wb *= 0.4; wa = 1 - wb; }
            if (wa > 0) this.tryMove(a, -ox * ov * wa, -oz * ov * wa);
            if (wb > 0) this.tryMove(b, ox * ov * wb, oz * ov * wb);
          }
        }
      }
    }
  }

  // ---------- 建筑 ----------
  updateBuilding(b, dt) {
    if (b.rise < 1) {
      b.rise = Math.min(1, b.rise + dt / 1.3);
      const k = b.rise, c1 = 1.70158, c3 = c1 + 1; const e = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
      b.obj.scale.set(1, Math.max(0.02, e), 1);
      if (b.rise >= 1) {
        b.obj.scale.set(1, 1, 1);
        if (b.type === 'refinery') {
          const e2 = this.exitPos(b); const u = this.spawnUnit('harv', b.team, e2.x, e2.z);
          u.order = { type: 'harvest', state: 'seek', near: -1 };
        }
      }
      return;
    }
    const team = this.teams[b.team];
    if (b.def.weapon) {
      const w = WEAPONS[b.def.weapon]; b.cool -= dt; b.scanT -= dt;
      if (team.low && b.def.needsPower) { b.target = null; }
      else {
        if (b.target && (!b.target.alive || this.distTo(b, b.target) > w.range || !this.canSee(b.team, b.target) || (b.team === 0 && !b.target.seen))) b.target = null;
        if (!b.target && b.scanT <= 0) { b.scanT = 0.3; b.target = this.findTarget(b, w.range); }
        if (b.target) {
          const want = Math.atan2(b.target.pos.x - b.pos.x, b.target.pos.z - b.pos.z);
          b.tyaw = turnToward(b.tyaw, want, 4.5 * dt);
          if (Math.abs(angleDiff(b.tyaw, want)) < 0.1 && b.cool <= 0) this.fire(b, b.target, w);
        }
      }
      b.recoil = Math.max(0, b.recoil - dt * 6);
      const k = b.recoil * 0.1; b.turretNode.rotation.y = b.tyaw;
      b.turretNode.position.set(b.turretBase.x - Math.sin(b.tyaw) * k, b.turretBase.y, b.turretBase.z - Math.cos(b.tyaw) * k);
    }
    const hpk = b.hp / b.maxHp;
    if (hpk < 0.55 && (b.team === 0 || b.seen)) {
      b.smokeT -= dt;
      if (b.smokeT <= 0) {
        b.smokeT = 0.22; const x = b.pos.x + Math.sin(b.id * 7.1) * b.w * 0.5, z = b.pos.z + Math.cos(b.id * 3.3) * b.h * 0.5, y = b.def.height * 0.55;
        this.fx.smokePuff(x, y, z, 0.8 + b.w * 0.25);
        if (hpk < 0.3) this.fx.fireAt(x, y - 0.2, z, 1 + b.w * 0.2);
      }
    }
  }
}
