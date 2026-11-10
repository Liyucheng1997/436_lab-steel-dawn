// 镜头控制、框选、指令下达、建筑放置
import * as THREE from 'three';
import { CS, N, WORLD, BUILDINGS } from './config.js';
import { makeModel } from './models.js';
import { clamp } from './util.js';

const _v = new THREE.Vector3(), _ndc = new THREE.Vector2();
const PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const GREEN = [0.5, 2.4, 1.1], RED = [2.8, 0.5, 0.3], AMBER = [2.8, 1.6, 0.3];

export class Input {
  constructor({ camera, dom, game, fx, sfx, scene }) {
    this.camera = camera; this.dom = dom; this.game = game; this.fx = fx; this.sfx = sfx; this.scene = scene;
    this.hud = null; this.enabled = false;
    const b = game.map.baseC[0];
    this.cam = { tx: b.x * CS + 6, tz: b.z * CS - 4, dist: 64, distT: 64, yaw: 0, pitch: 0.98 };
    this.keys = new Set(); this.mouse = { x: innerWidth / 2, y: innerHeight / 2, inside: false };
    this.drag = { active: false, x0: 0, y0: 0, x1: 0, y1: 0, down: false };
    this.pan = null; this.placing = null; this.mode = null; this.groups = {}; this.hover = null; this.hoverT = 0;
    this.ray = new THREE.Raycaster();
    this.ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false });
    this.planeMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false });
    this.bind();
    this.applyCamera();
  }

  bind() {
    const d = this.dom;
    d.addEventListener('contextmenu', e => e.preventDefault());
    d.addEventListener('mousedown', e => this.onDown(e));
    window.addEventListener('mousemove', e => this.onMove(e));
    window.addEventListener('mouseup', e => this.onUp(e));
    d.addEventListener('dblclick', e => this.onDbl(e));
    d.addEventListener('wheel', e => { e.preventDefault(); this.cam.distT = clamp(this.cam.distT * (e.deltaY > 0 ? 1.12 : 0.89), 26, 125); }, { passive: false });
    d.addEventListener('mouseenter', () => { this.mouse.inside = true; });
    document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    window.addEventListener('keydown', e => this.onKey(e));
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  applyCamera() {
    const c = this.cam; const h = Math.sin(c.pitch) * c.dist, r = Math.cos(c.pitch) * c.dist;
    this.camera.position.set(c.tx + Math.sin(c.yaw) * r, h, c.tz + Math.cos(c.yaw) * r);
    this.camera.lookAt(c.tx, 0, c.tz);
    this.sfx.lx = c.tx; this.sfx.lz = c.tz; this.sfx.ld = c.dist;
  }
  lookAt(x, z) { this.cam.tx = clamp(x, 4, WORLD - 4); this.cam.tz = clamp(z, 4, WORLD - 4); }

  update(dt) {
    const c = this.cam;
    if (this.enabled) {
      let mx = 0, mz = 0; const k = this.keys;
      if (k.has('w') || k.has('arrowup')) mz -= 1;
      if (k.has('s') || k.has('arrowdown')) mz += 1;
      if (k.has('a') || k.has('arrowleft')) mx -= 1;
      if (k.has('d') || k.has('arrowright')) mx += 1;
      // 边缘滚屏只在全屏时启用，窗口模式下容易误触
      const full = document.fullscreenElement || innerHeight >= screen.height - 2;
      if (full && this.mouse.inside && document.hasFocus() && !this.pan) {
        const E = 4; const m = this.mouse;
        if (m.x <= E) mx -= 1; else if (m.x >= innerWidth - E) mx += 1;
        if (m.y <= E) mz -= 1; else if (m.y >= innerHeight - E) mz += 1;
      }
      if (k.has('q')) c.yaw += dt * 1.4;
      if (k.has('e')) c.yaw -= dt * 1.4;
      if (mx || mz) {
        const sp = c.dist * 0.95 * dt; const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
        this.lookAt(c.tx + (mx * cs + mz * sn) * sp, c.tz + (-mx * sn + mz * cs) * sp);
      }
    }
    c.dist += (c.distT - c.dist) * Math.min(1, dt * 10);
    this.applyCamera();
    if (this.placing) this.updatePlacing();
    this.hoverT -= dt;
    if (this.enabled && this.hoverT <= 0) {
      this.hoverT = 0.08; let cur = 'default';
      if (this.placing) cur = 'crosshair'; else if (this.mode === 'amove') cur = 'crosshair';
      else {
        const e = this.pickEntity(this.mouse.x, this.mouse.y); this.hover = e;
        if (e && e.team !== 0 && this.ownUnits().some(u => u.def.weapon)) cur = 'crosshair';
        else if (e) cur = 'pointer';
      }
      if (this.dom.style.cursor !== cur) this.dom.style.cursor = cur;
    }
  }

  // ---------- 拾取 ----------
  groundPoint(x, y, out = new THREE.Vector3()) {
    _ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); this.ray.setFromCamera(_ndc, this.camera);
    return this.ray.ray.intersectPlane(PLANE, out);
  }
  project(x, y, z) {
    _v.set(x, y, z).project(this.camera); if (_v.z > 1) return null;
    return [(_v.x * 0.5 + 0.5) * innerWidth, (-_v.y * 0.5 + 0.5) * innerHeight];
  }
  pickEntity(mx, my) {
    const g = this.game; let best = null, bd = 1e9;
    const k = innerHeight / (2 * Math.tan(this.camera.fov * Math.PI / 360));
    for (const u of g.units) {
      if (!u.alive || !u.obj.visible) continue;
      const p = this.project(u.pos.x, u.def.cat === 'inf' ? 0.7 : 0.9, u.pos.z); if (!p) continue;
      const dist = this.camera.position.distanceTo(u.pos); const r = Math.max(13, (k / dist) * u.radius * 1.25);
      const d = Math.hypot(p[0] - mx, p[1] - my); if (d < r && d < bd) { bd = d; best = u; }
    }
    if (best) return best;
    _ndc.set((mx / innerWidth) * 2 - 1, -(my / innerHeight) * 2 + 1); this.ray.setFromCamera(_ndc, this.camera);
    for (const b of g.buildings) {
      if (!b.alive || !b.obj.visible) continue;
      if (this.ray.ray.intersectsBox(b.box)) { const d = this.camera.position.distanceTo(b.pos); if (d < bd) { bd = d; best = b; } }
    }
    return best;
  }
  ownUnits() { const out = []; for (const e of this.game.selection) if (e.alive && e.team === 0 && e.kind === 'unit') out.push(e); return out; }

  // ---------- 选择 ----------
  setSelection(list, add = false) {
    const sel = this.game.selection;
    if (!add) { for (const e of sel) e.sel.visible = false; sel.clear(); }
    for (const e of list) { sel.add(e); e.sel.visible = true; }
  }
  onDown(e) {
    if (!this.enabled) return;
    this.sfx.init();
    const x = e.clientX, y = e.clientY;
    if (e.button === 0) {
      if (this.placing) { this.tryPlace(); return; }
      if (this.mode === 'amove') {
        const gp = this.groundPoint(x, y); const units = this.ownUnits();
        if (gp && units.length) { this.game.orderMove(units, gp.x, gp.z, true); this.fx.marker(gp.x, gp.z, AMBER); this.sfx.play('ack'); }
        this.mode = null; return;
      }
      this.drag.down = true; this.drag.active = false; this.drag.x0 = this.drag.x1 = x; this.drag.y0 = this.drag.y1 = y; this.drag.shift = e.shiftKey;
    } else if (e.button === 2) {
      if (this.placing) { this.cancelPlacing(); return; }
      if (this.mode) { this.mode = null; return; }
      this.command(x, y);
    } else if (e.button === 1) { e.preventDefault(); this.pan = { x, y }; }
  }
  onMove(e) {
    const x = e.clientX, y = e.clientY; this.mouse.x = x; this.mouse.y = y;
    if (this.pan) {
      const c = this.cam; const s = c.dist * 0.0022; const dx = (x - this.pan.x) * s, dz = (y - this.pan.y) * s * 1.3;
      const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
      this.lookAt(c.tx - (dx * cs + dz * sn), c.tz - (-dx * sn + dz * cs)); this.pan.x = x; this.pan.y = y;
    }
    if (this.drag.down) {
      this.drag.x1 = x; this.drag.y1 = y;
      if (!this.drag.active && Math.hypot(x - this.drag.x0, y - this.drag.y0) > 6) this.drag.active = true;
    }
  }
  onUp(e) {
    if (e.button === 1) { this.pan = null; return; }
    if (e.button !== 0 || !this.drag.down) return;
    const d = this.drag; d.down = false;
    if (d.active) {
      d.active = false;
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
      const list = [];
      for (const u of this.game.units) {
        if (!u.alive || u.team !== 0) continue; const p = this.project(u.pos.x, 0.6, u.pos.z);
        if (p && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) list.push(u);
      }
      // 框选时，若同时框到战斗单位则忽略采集车
      const fighters = list.filter(u => u.def.weapon);
      const pick = fighters.length ? fighters : list;
      if (pick.length) { this.setSelection(pick, d.shift); this.sfx.play('click'); } else if (!d.shift) this.setSelection([]);
    } else {
      const ent = this.pickEntity(d.x1, d.y1);
      if (!ent) { if (!d.shift) this.setSelection([]); return; }
      if (d.shift && ent.team === 0 && ent.kind === 'unit') {
        if (this.game.selection.has(ent)) { this.game.selection.delete(ent); ent.sel.visible = false; } else this.setSelection([ent], true);
      } else this.setSelection([ent]);
      this.sfx.play('click');
    }
  }
  onDbl(e) {
    if (!this.enabled || this.placing) return;
    const ent = this.pickEntity(e.clientX, e.clientY); if (!ent || ent.team !== 0 || ent.kind !== 'unit') return;
    const list = [];
    for (const u of this.game.units) {
      if (!u.alive || u.team !== 0 || u.type !== ent.type) continue; const p = this.project(u.pos.x, 0.6, u.pos.z);
      if (p && p[0] >= 0 && p[0] <= innerWidth && p[1] >= 0 && p[1] <= innerHeight) list.push(u);
    }
    this.setSelection(list);
  }

  // ---------- 指令 ----------
  command(mx, my) {
    const g = this.game; const sel = [...g.selection].filter(e => e.alive && e.team === 0); if (!sel.length) return;
    const units = sel.filter(e => e.kind === 'unit'), blds = sel.filter(e => e.kind === 'building');
    const gp = this.groundPoint(mx, my); const ent = this.pickEntity(mx, my);
    if (units.length) {
      if (ent && ent.team !== 0) {
        const armed = units.filter(u => u.def.weapon);
        if (armed.length) { g.orderAttack(armed, ent); this.fx.marker(ent.pos.x, ent.pos.z, RED); this.sfx.play('ack'); }
        return;
      }
      const harv = units.filter(u => u.def.harvester), others = units.filter(u => !u.def.harvester);
      if (ent && ent.team === 0 && ent.type === 'refinery' && harv.length) { g.orderReturn(harv); this.fx.marker(ent.pos.x, ent.pos.z + 4, GREEN); this.sfx.play('ack'); return; }
      if (!gp) return;
      const cx = clamp(Math.floor(gp.x / CS), 0, N - 1), cz = clamp(Math.floor(gp.z / CS), 0, N - 1);
      if (harv.length && g.map.ore[cz * N + cx] > 0) { g.orderHarvest(harv, cz * N + cx); if (others.length) g.orderMove(others, gp.x, gp.z); }
      else g.orderMove(units, gp.x, gp.z);
      this.fx.marker(gp.x, gp.z, GREEN); this.sfx.play('ack');
    } else if (blds.length && gp) {
      let any = false;
      for (const b of blds) if (b.type === 'barracks' || b.type === 'factory') { b.rally = { x: gp.x, z: gp.z }; any = true; }
      if (any) { this.fx.marker(gp.x, gp.z, AMBER); this.sfx.play('ack'); }
    }
  }

  onKey(e) {
    const k = e.key.toLowerCase();
    if (e.target && (e.target.tagName === 'INPUT')) return;
    this.keys.add(k);
    if (!this.enabled) return;
    const g = this.game;
    if (k === 'escape') { if (this.placing) this.cancelPlacing(); else if (this.mode) this.mode = null; else if (this.onPause) this.onPause(); return; }
    if (k === 'p') { if (this.onPause) this.onPause(); return; }
    if (k === 'm') { this.sfx.setMuted(!this.sfx.muted); if (this.hud) this.hud.toast(this.sfx.muted ? '已静音' : '声音已开启'); return; }
    if (k === '+' || k === '=') { if (this.onSpeed) this.onSpeed(1); return; }
    if (k === '-' || k === '_') { if (this.onSpeed) this.onSpeed(-1); return; }
    if (k === 'x') { g.orderStop(this.ownUnits()); return; }
    if (k === 'f') { if (this.ownUnits().some(u => u.def.weapon)) this.mode = 'amove'; return; }
    if (k === 'h') { const hq = g.buildings.find(b => b.team === 0 && b.type === 'hq') || g.buildings.find(b => b.team === 0); if (hq) this.lookAt(hq.pos.x, hq.pos.z); return; }
    if (k === ' ') { e.preventDefault(); if (g.alertPos) this.lookAt(g.alertPos.x, g.alertPos.z); return; }
    if (k === 'delete') { for (const b of [...g.selection]) if (b.kind === 'building' && b.team === 0) g.sell(b); return; }
    if (k >= '1' && k <= '9') {
      if (e.ctrlKey) { e.preventDefault(); this.groups[k] = this.ownUnits(); if (this.hud && this.groups[k].length) this.hud.toast(`已编为第 ${k} 队`); }
      else {
        const grp = (this.groups[k] || []).filter(u => u.alive);
        if (grp.length) {
          const same = grp.length === g.selection.size && grp.every(u => g.selection.has(u));
          if (same) { const cx = grp.reduce((s, u) => s + u.pos.x, 0) / grp.length, cz = grp.reduce((s, u) => s + u.pos.z, 0) / grp.length; this.lookAt(cx, cz); }
          this.setSelection(grp);
        }
      }
    }
  }

  // ---------- 建筑放置 ----------
  startPlacing(type) {
    this.cancelPlacing(); const def = BUILDINGS[type];
    const ghost = makeModel(type, 0);
    ghost.traverse(m => { if (m.isMesh) { m.material = this.ghostMat; m.castShadow = false; m.receiveShadow = false; } });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(def.w * CS, def.h * CS).rotateX(-Math.PI / 2), this.planeMat);
    plane.position.y = 0.07; ghost.add(plane); this.scene.add(ghost);
    this.placing = { type, def, ghost, cx: 0, cz: 0, ok: false };
    this.updatePlacing();
  }
  updatePlacing() {
    const p = this.placing; const gp = this.groundPoint(this.mouse.x, this.mouse.y); if (!gp) return;
    p.cx = Math.round(gp.x / CS - p.def.w / 2); p.cz = Math.round(gp.z / CS - p.def.h / 2);
    p.ok = this.game.canPlace(0, p.type, p.cx, p.cz);
    p.ghost.position.set((p.cx + p.def.w / 2) * CS, 0, (p.cz + p.def.h / 2) * CS);
    const c = p.ok ? GREEN : RED; this.ghostMat.color.setRGB(c[0] * 0.5, c[1] * 0.5, c[2] * 0.5); this.planeMat.color.setRGB(c[0], c[1], c[2]);
  }
  tryPlace() {
    const p = this.placing; if (!p) return;
    if (p.ok && this.game.placeBuilding(0, p.type, p.cx, p.cz)) this.cancelPlacing();
    else { this.sfx.play('err'); if (this.hud) this.hud.toast('无法在此处建造：需靠近己方建筑且地面空闲', 'warn'); }
  }
  cancelPlacing() { if (this.placing) { this.scene.remove(this.placing.ghost); this.placing = null; } }
}
