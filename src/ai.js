// 电脑对手：按顺序发展基地、持续爆兵、分波次进攻、受袭回防
import { CS, N, BUILDINGS } from './config.js';

const DIFF = {
  easy:   { inc: 0.7,  first: 330, gap: 160, size: 4, grow: 2, credits: 4500, maxArmy: 20, armyBase: 4, armyRate: 60, harv: 2 },
  normal: { inc: 0.9,  first: 260, gap: 120, size: 6, grow: 3, credits: 6000, maxArmy: 34, armyBase: 6, armyRate: 38, harv: 3 },
  hard:   { inc: 1.35, first: 150, gap: 85,  size: 8, grow: 4, credits: 9000, maxArmy: 50, armyBase: 9, armyRate: 22, harv: 5 },
};

export class AI {
  constructor(game, diff) {
    this.g = game; this.t = game.teams[1]; this.D = DIFF[diff] || DIFF.normal;
    this.t.incomeMult = this.D.inc; this.t.credits = this.D.credits;
    this.tick = 2; this.wave = 0; this.nextWave = this.D.first; this.lastDefend = -99;
    const m = game.map; const me = m.baseC[1], foe = m.baseC[0];
    const dx = foe.x - me.x, dz = foe.z - me.z, dl = Math.hypot(dx, dz);
    this.dir = { x: dx / dl, z: dz / dl };
    this.rally = { x: (me.x + this.dir.x * 9) * CS, z: (me.z + this.dir.z * 9) * CS };
  }
  update(dt) { this.tick -= dt; if (this.tick > 0) return; this.tick = 1; this.think(); }

  think() {
    const g = this.g, t = this.t, cnt = t.counts;
    const hq = g.buildings.find(b => b.team === 1 && b.type === 'hq' && b.alive);
    for (const qn of ['build', 'def']) {
      const q = t.queues[qn];
      if (q.current && q.current.ready) {
        const p = this.findSpot(q.current.type);
        if (p) g.placeBuilding(1, q.current.type, p.cx, p.cz); else g.cancel(1, q.current.type);
      } else if (!q.current && hq) {
        const want = qn === 'build' ? this.nextStructure(cnt) : this.nextDefense(cnt);
        if (want && g.hasReq(1, want)) g.enqueue(1, want);
      }
    }
    const mine = g.units.filter(u => u.team === 1 && u.alive);
    const harv = mine.filter(u => u.def.harvester).length;
    const army = mine.filter(u => u.def.weapon);
    const bq = t.queues.build.current;
    const saving = bq && !bq.ready && t.credits < 700;
    const qv = t.queues.veh, qi = t.queues.inf;
    // 军队规模上限随时间增长，避免开局就被海量部队淹没
    const cap = Math.min(this.D.maxArmy, this.D.armyBase + g.time / this.D.armyRate);
    if (cnt.factory && !qv.current && !qv.pending.length) {
      if (harv < Math.min(this.D.harv, (cnt.refinery || 0) * 2)) g.enqueue(1, 'harv');
      else if (!saving && army.length < cap) g.enqueue(1, this.pickVeh(cnt));
    }
    if (cnt.barracks && !qi.current && !saving && army.filter(u => u.def.cat === 'inf').length < 12 && army.length < cap)
      g.enqueue(1, Math.random() < 0.58 ? 'rifle' : 'rocket');

    // 军队管理
    const rallyUnits = [];
    for (const u of army) {
      if (!u.ai) { u.ai = 'rally'; g.orderMove([u], this.rally.x + (Math.random() - 0.5) * 8, this.rally.z + (Math.random() - 0.5) * 8, true); }
      if (u.ai === 'rally') {
        rallyUnits.push(u);
        if (u.order.type === 'idle' && !u.auto && g.time - this.lastDefend > 10 && Math.hypot(u.pos.x - this.rally.x, u.pos.z - this.rally.z) > 22)
          g.orderMove([u], this.rally.x + (Math.random() - 0.5) * 8, this.rally.z + (Math.random() - 0.5) * 8, true);
      } else if (u.order.type === 'idle' && !u.auto) {
        const tg = this.pickTarget(u.pos); if (tg) g.orderMove([u], tg.pos.x, tg.pos.z, true);
      }
    }
    const size = Math.min(26, this.D.size + this.wave * this.D.grow);
    if (g.time >= this.nextWave && (rallyUnits.length >= size || (g.time >= this.nextWave + 90 && rallyUnits.length >= Math.max(3, size / 2)))) {
      const cx = rallyUnits.reduce((s, u) => s + u.pos.x, 0) / rallyUnits.length, cz = rallyUnits.reduce((s, u) => s + u.pos.z, 0) / rallyUnits.length;
      const tg = this.pickTarget({ x: cx, z: cz }, true);
      if (tg) {
        for (const u of rallyUnits) u.ai = 'attack';
        g.orderMove(rallyUnits, tg.pos.x, tg.pos.z, true);
        this.wave++; this.nextWave = g.time + this.D.gap;
      }
    }
  }

  nextStructure(c) {
    const t = this.t;
    if (!c.power) return 'power';
    if (!c.refinery) return 'refinery';
    if (!c.barracks) return 'barracks';
    if (t.powerMade - t.powerUsed < 30) return 'power';
    if (!c.factory) return 'factory';
    if ((c.refinery || 0) < 2) return 'refinery';
    if (!c.tech) return 'tech';
    if (this.g.time > 480 && (c.refinery || 0) < 3 && t.credits > 2500) return 'refinery';
    if (this.g.time > 600 && (c.factory || 0) < 2 && t.credits > 3000) return 'factory';
    return null;
  }
  nextDefense(c) {
    const time = this.g.time;
    if (!c.factory) return null;
    if (this.t.powerMade - this.t.powerUsed < 20) return null;
    if (c.tech && (c.rail || 0) < Math.min(3, 1 + Math.floor(time / 420))) return 'rail';
    if ((c.turret || 0) < Math.min(5, 2 + Math.floor(time / 240))) return 'turret';
    return null;
  }
  pickVeh(c) {
    const r = Math.random();
    if (c.tech) return r < 0.34 ? 'tank' : r < 0.62 ? 'heavy' : r < 0.82 ? 'arty' : 'buggy';
    return r < 0.7 ? 'tank' : 'buggy';
  }
  pickTarget(from, raid = false) {
    const g = this.g; let best = null, bd = 1e9;
    const eco = raid && Math.random() < 0.35;
    for (const b of g.buildings) {
      if (b.team !== 0 || !b.alive) continue;
      let d = Math.hypot(b.pos.x - from.x, b.pos.z - from.z);
      if (eco && b.type === 'refinery') d -= 60;
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) for (const u of g.units) { if (u.team !== 0 || !u.alive) continue; const d = Math.hypot(u.pos.x - from.x, u.pos.z - from.z); if (d < bd) { bd = d; best = u; } }
    return best;
  }
  onAttacked(t, attacker) {
    const g = this.g;
    if (!attacker || !attacker.alive) return;
    if (t.kind !== 'building' && !t.def.harvester) return;
    if (g.time - this.lastDefend < 4) return;
    this.lastDefend = g.time;
    const resp = g.units.filter(u => u.team === 1 && u.alive && u.def.weapon && (u.ai === 'rally' || Math.hypot(u.pos.x - t.pos.x, u.pos.z - t.pos.z) < 40) && u.order.type !== 'attack');
    if (resp.length) g.orderMove(resp, attacker.pos.x, attacker.pos.z, true);
  }

  findSpot(type) {
    const g = this.g, def = BUILDINGS[type];
    const anchor = g.buildings.find(b => b.team === 1 && b.type === 'hq' && b.alive) || g.buildings.find(b => b.team === 1 && b.alive);
    if (!anchor) return null;
    const bx = anchor.cx + 1, bz = anchor.cz + 1;
    for (const margin of [1, 0]) {
      const cands = [];
      for (let r = 3; r <= 17; r++) {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = bx + dx - (def.w >> 1), cz = bz + dz - (def.h >> 1);
          if (g.canPlace(1, type, cx, cz, margin)) cands.push({ cx, cz, r, dx, dz });
        }
        if (cands.length >= 10 && r >= 6) break;
      }
      if (!cands.length) continue;
      let best = null, bs = 1e9;
      for (const c of cands) {
        let s = Math.random() * 3;
        if (def.weapon) s += -(c.dx * this.dir.x + c.dz * this.dir.z) * 1.2 + Math.abs(c.r - 7) * 0.8;   // 防御塔朝向前线
        else if (type === 'refinery') { let md = 1e9; for (const f of g.map.fields) md = Math.min(md, Math.hypot(c.cx + 1.5 - f.x, c.cz + 1.5 - f.z)); s += md * 1.5; }
        else s += c.r * 0.6 + (c.dx * this.dir.x + c.dz * this.dir.z) * 0.3;
        if (s < bs) { bs = s; best = c; }
      }
      return best;
    }
    return null;
  }
}
