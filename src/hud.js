// HUD：资源栏、建造栏、小地图、选中面板、血条与框选叠加层
import * as THREE from 'three';
import { BUILD_TABS, defOf, TEAMS, N, CS, WORLD, WEAPONS, ARMOR_NAME, buildTime } from './config.js';

const _v = new THREE.Vector3();
const $ = id => document.getElementById(id);
const MM = 236;

export class Hud {
  constructor({ game, camera, icons, sfx }) {
    this.game = game; this.camera = camera; this.icons = icons; this.sfx = sfx; this.input = null;
    this.overlay = $('overlay'); this.ctx = this.overlay.getContext('2d');
    this.mm = $('minimap'); this.mctx = this.mm.getContext('2d');
    this.small = document.createElement('canvas'); this.small.width = this.small.height = N; this.sctx = this.small.getContext('2d');
    this.img = this.sctx.createImageData(N, N);
    this.tab = 'build'; this.btns = {}; this.tabEls = {}; this.shown = 0; this.t10 = 0; this.tmm = 0; this.selSig = '';
    this.buildBase(); this.buildSidebar(); this.bindMinimap(); this.resize();
    $('selinfo').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'sell') for (const s of [...this.game.selection]) if (s.kind === 'building' && s.team === 0) this.game.sell(s);
      if (b.dataset.act === 'stop') this.game.orderStop(this.input.ownUnits());
      if (b.dataset.act === 'amove') this.input.mode = 'amove';
    });
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2); this.W = innerWidth; this.H = innerHeight;
    this.overlay.width = this.W * dpr; this.overlay.height = this.H * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  buildBase() {
    const k = this.game.map.kind; this.base = new Uint8Array(N * N * 3);
    const col = [[78, 98, 58], [38, 92, 120], [44, 70, 40], [110, 112, 112]];
    for (let i = 0; i < N * N; i++) { const c = col[k[i]]; const j = ((i * 7919) % 13) - 6; this.base[i * 3] = c[0] + j; this.base[i * 3 + 1] = c[1] + j; this.base[i * 3 + 2] = c[2] + j; }
  }

  buildSidebar() {
    const tabs = $('tabs'), grid = $('grid');
    for (const t of BUILD_TABS) {
      const b = document.createElement('button'); b.className = 'tab'; b.innerHTML = `${t.name}<i></i>`;
      b.onclick = () => { this.setTab(t.id); this.sfx.play('click'); }; tabs.appendChild(b); this.tabEls[t.id] = b;
      for (const type of t.items) {
        const def = defOf(type); const el = document.createElement('button'); el.className = 'bbtn'; el.dataset.tab = t.id;
        el.innerHTML = `<img src="${this.icons[type]}" draggable="false"/><div class="prog"></div><span class="cost">${def.cost}</span><span class="name">${def.name}</span><span class="badge"></span><span class="state"></span>`;
        el.onclick = () => this.onBuild(type);
        el.oncontextmenu = e => { e.preventDefault(); this.game.cancel(0, type); };
        el.onmouseenter = () => this.showTip(type, el); el.onmouseleave = () => $('tooltip').classList.remove('show');
        grid.appendChild(el);
        this.btns[type] = { el, def, prog: el.querySelector('.prog'), badge: el.querySelector('.badge'), state: el.querySelector('.state'), c: {} };
      }
    }
    this.setTab('build');
  }
  setTab(id) {
    this.tab = id;
    for (const k in this.tabEls) this.tabEls[k].classList.toggle('on', k === id);
    for (const k in this.btns) this.btns[k].el.style.display = this.btns[k].el.dataset.tab === id ? '' : 'none';
  }
  onBuild(type) {
    const g = this.game, def = defOf(type), q = g.teams[0].queues[def.queue];
    if (def.kind === 'building' && q.current && q.current.type === type && q.current.ready) { this.input.startPlacing(type); this.sfx.play('click'); return; }
    g.enqueue(0, type);
  }
  showTip(type, el) {
    const def = defOf(type), g = this.game, tip = $('tooltip'); const miss = g.missingReq(0, type);
    let h = `<h4>${def.name}<span>${def.cost}</span></h4><p>${def.desc}</p><div class="tl">`;
    h += `<span>生命 ${def.hp}</span><span>耗时 ${Math.round(buildTime(def))}秒</span>`;
    if (def.kind === 'building') h += `<span class="${def.power > 0 ? 'good' : 'badc'}">电力 ${def.power > 0 ? '+' : ''}${def.power}</span>`;
    if (def.weapon) { const w = WEAPONS[def.weapon]; h += `<span>伤害 ${w.dmg}</span><span>射程 ${(w.range / CS).toFixed(1)}</span>`; }
    if (def.kind === 'unit') h += `<span>速度 ${def.speed}</span><span>${ARMOR_NAME[def.armor]}</span>`;
    h += '</div>';
    if (miss.length) h += `<div class="req">需要：${miss.join('、')}</div>`;
    h += `<div class="hint2">左键 ${def.kind === 'building' ? '建造 / 部署' : '加入队列'} · 右键取消</div>`;
    tip.innerHTML = h; tip.classList.add('show');
    const r = el.getBoundingClientRect(); tip.style.top = Math.min(innerHeight - tip.offsetHeight - 10, Math.max(10, r.top)) + 'px';
  }

  toast(msg, kind = 'info') {
    const box = $('toasts'); const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg; box.appendChild(d);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 4200);
  }

  update(dt) {
    const g = this.game, t = g.teams[0];
    this.shown += (t.credits - this.shown) * Math.min(1, dt * 9); if (Math.abs(t.credits - this.shown) < 1) this.shown = t.credits;
    $('creditsVal').textContent = Math.floor(this.shown).toLocaleString('en-US');
    this.t10 -= dt;
    if (this.t10 <= 0) {
      this.t10 = 0.1;
      const max = Math.max(t.powerMade, t.powerUsed, 1);
      $('powerFill').style.width = (t.powerMade / max * 100) + '%'; $('powerUse').style.left = Math.min(100, t.powerUsed / max * 100) + '%';
      $('powerTxt').textContent = `${t.powerUsed} / ${t.powerMade}`; $('power').classList.toggle('low', t.low);
      const s = Math.floor(g.time); $('clock').textContent = String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      const tabState = {};
      for (const type in this.btns) {
        const b = this.btns[type], def = b.def, q = t.queues[def.queue], cur = q.current, mine = cur && cur.type === type;
        const locked = !g.hasReq(0, type), busy = def.kind === 'building' && cur && !mine;
        const ready = !!(mine && cur.ready); const prog = mine && !ready ? cur.progress : (ready ? 1 : -1);
        let count = 0; for (const p of q.pending) if (p === type) count++; if (mine && def.kind === 'unit') count++;
        const state = ready ? '部署' : (mine && cur.stalled ? '暂停' : '');
        const c = b.c;
        if (c.locked !== locked) { b.el.classList.toggle('locked', locked); c.locked = locked; }
        if (c.busy !== busy) { b.el.classList.toggle('busy', !!busy); c.busy = busy; }
        if (c.ready !== ready) { b.el.classList.toggle('ready', ready); c.ready = ready; }
        if (c.active !== !!mine) { b.el.classList.toggle('active', !!mine); c.active = !!mine; }
        const ph = prog < 0 || ready ? 0 : Math.round((1 - prog) * 1000) / 10;
        if (c.ph !== ph) { b.prog.style.height = ph + '%'; c.ph = ph; }
        if (c.count !== count) { b.badge.textContent = count > 0 ? count : ''; c.count = count; }
        if (c.state !== state) { b.state.textContent = state; c.state = state; }
        if (mine) tabState[def.queue] = ready ? 'ready' : 'work';
      }
      for (const k in this.tabEls) { const e = this.tabEls[k]; const s2 = tabState[k] || ''; if (e.dataset.s !== s2) { e.dataset.s = s2; } }
      this.updateSel();
    }
    this.tmm -= dt; if (this.tmm <= 0) { this.tmm = 0.12; this.drawMinimap(); }
  }

  updateSel() {
    const g = this.game, el = $('selinfo'); const sel = [...g.selection].filter(e => e.alive);
    if (!sel.length) { if (this.selSig !== '') { el.classList.remove('show'); this.selSig = ''; } return; }
    let sig = sel.length + ':';
    if (sel.length === 1) { const e = sel[0]; sig += e.id + ':' + Math.ceil(e.hp) + ':' + (e.cargo || 0); } else sig += sel.map(e => e.id).join(',');
    if (sig === this.selSig) return; this.selSig = sig;
    let h = '';
    if (sel.length === 1) {
      const e = sel[0], d = e.def, k = Math.max(0, e.hp / e.maxHp);
      h += `<div class="one"><img src="${this.icons[e.type]}"/><div class="info"><h4>${d.name}<em style="color:${TEAMS[e.team].css}">${TEAMS[e.team].name}</em></h4>`;
      h += `<div class="hp"><div style="width:${k * 100}%;background:${k > 0.5 ? '#5dffa8' : k > 0.25 ? '#ffc23d' : '#ff5a48'}"></div></div><div class="tl"><span>${Math.ceil(e.hp)} / ${e.maxHp}</span><span>${ARMOR_NAME[d.armor]}</span>`;
      if (d.weapon) { const w = WEAPONS[d.weapon]; h += `<span>伤害 ${w.dmg}</span><span>射程 ${(w.range / CS).toFixed(1)}</span>`; }
      if (d.harvester) h += `<span class="ore">载货 ${Math.round(e.cargo)} / 700</span>`;
      h += '</div>';
      if (e.team === 0) {
        h += '<div class="acts">';
        if (e.kind === 'building') { h += `<button data-act="sell">出售 (Del)</button>`; if (e.type === 'barracks' || e.type === 'factory') h += `<span class="note">右键地面设置集结点</span>`; }
        else { h += `<button data-act="stop">停止 (X)</button>`; if (d.weapon) h += `<button data-act="amove">进攻移动 (F)</button>`; }
        h += '</div>';
      }
      h += '</div></div>';
    } else {
      const cnt = {}; for (const e of sel) cnt[e.type] = (cnt[e.type] || 0) + 1;
      h += `<div class="multi"><div class="chips">`;
      for (const k in cnt) h += `<div class="chip"><img src="${this.icons[k]}"/><b>${cnt[k]}</b></div>`;
      h += `</div><div class="acts"><span class="note">已选中 ${sel.length} 个单位</span><button data-act="stop">停止 (X)</button><button data-act="amove">进攻移动 (F)</button></div></div>`;
    }
    el.innerHTML = h; el.classList.add('show');
  }

  project(x, y, z) {
    _v.set(x, y, z).project(this.camera); if (_v.z > 1) return null;
    return [(_v.x * 0.5 + 0.5) * this.W, (-_v.y * 0.5 + 0.5) * this.H];
  }

  drawOverlay() {
    const c = this.ctx, g = this.game; c.clearRect(0, 0, this.W, this.H);
    const zoom = 64 / this.input.cam.dist;
    const bar = (e, w) => {
      const p = this.project(e.pos.x, e.def.height, e.pos.z); if (!p) return;
      if (p[0] < -50 || p[0] > this.W + 50 || p[1] < -20 || p[1] > this.H + 20) return;
      const k = Math.max(0, e.hp / e.maxHp); const x = p[0] - w / 2, y = p[1] - 8;
      c.fillStyle = 'rgba(5,10,14,0.75)'; c.fillRect(x - 1, y - 1, w + 2, 6);
      c.fillStyle = k > 0.5 ? '#5dffa8' : k > 0.25 ? '#ffc23d' : '#ff5a48'; c.fillRect(x, y, w * k, 4);
      if (e.def.harvester && e.cargo > 0) { c.fillStyle = 'rgba(5,10,14,0.75)'; c.fillRect(x - 1, y + 6, w + 2, 4); c.fillStyle = '#b388ff'; c.fillRect(x, y + 7, w * e.cargo / 700, 2); }
    };
    for (const u of g.units) { if (!u.alive || !u.obj.visible) continue; if (g.selection.has(u) || u.hp < u.maxHp) bar(u, (u.def.cat === 'inf' ? 24 : 40) * Math.max(0.7, zoom)); }
    for (const b of g.buildings) {
      if (!b.alive || !b.obj.visible) continue;
      if (g.selection.has(b) || b.hp < b.maxHp) bar(b, (30 + b.w * 22) * Math.max(0.7, zoom));
      if (g.selection.has(b) && b.team === 0 && b.rally && (b.type === 'barracks' || b.type === 'factory')) {
        const a = this.project(b.pos.x, 0.2, b.pos.z + b.h), r = this.project(b.rally.x, 0.2, b.rally.z);
        if (a && r) { c.strokeStyle = 'rgba(255,190,70,0.8)'; c.setLineDash([6, 5]); c.lineWidth = 1.5; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(r[0], r[1]); c.stroke(); c.setLineDash([]); c.fillStyle = '#ffbe46'; c.beginPath(); c.arc(r[0], r[1], 4, 0, 6.3); c.fill(); }
      }
    }
    c.font = '600 15px "Segoe UI","Microsoft YaHei UI",sans-serif'; c.textAlign = 'center';
    for (const f of g.floaters) {
      const p = this.project(f.x, f.y + f.t * 1.6, f.z); if (!p) continue;
      c.globalAlpha = Math.max(0, 1 - f.t / 1.6); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(f.text, p[0] + 1, p[1] + 1); c.fillStyle = '#d3b6ff'; c.fillText(f.text, p[0], p[1]);
    }
    c.globalAlpha = 1;
    const d = this.input.drag;
    if (d.active) {
      const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
      c.fillStyle = 'rgba(93,255,168,0.1)'; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(93,255,168,0.9)'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w, h);
    }
    if (this.input.mode === 'amove') { c.fillStyle = '#ffbe46'; c.textAlign = 'left'; c.fillText('进攻移动：左键点击目标位置', this.input.mouse.x + 16, this.input.mouse.y + 22); }
  }

  drawMinimap() {
    const g = this.game, d = this.img.data, base = this.base, vis = g.fog.vis, ore = g.map.ore;
    for (let i = 0; i < N * N; i++) {
      let r = base[i * 3], gg = base[i * 3 + 1], b = base[i * 3 + 2];
      if (ore[i] > 0) { r = 176; gg = 110; b = 255; }
      const v = vis[i]; const k = v === 2 ? 1 : v === 1 ? 0.5 : 0.07;
      d[i * 4] = r * k; d[i * 4 + 1] = gg * k; d[i * 4 + 2] = b * k + (v === 0 ? 10 : 0); d[i * 4 + 3] = 255;
    }
    this.sctx.putImageData(this.img, 0, 0);
    const c = this.mctx, s = MM / N; c.imageSmoothingEnabled = true; c.drawImage(this.small, 0, 0, MM, MM);
    for (const b of g.buildings) {
      if (!b.alive || (b.team !== 0 && !b.discovered)) continue;
      c.fillStyle = TEAMS[b.team].css; c.fillRect(b.cx * s, b.cz * s, b.w * s, b.h * s);
    }
    for (const u of g.units) {
      if (!u.alive || (u.team !== 0 && !u.seen)) continue;
      c.fillStyle = u.team === 0 ? (g.selection.has(u) ? '#ffffff' : '#7fd0ff') : '#ff7a5c';
      const z = u.def.cat === 'inf' ? 2 : 3; c.fillRect(u.pos.x / CS * s - z / 2, u.pos.z / CS * s - z / 2, z, z);
    }
    for (const p of g.pings) {
      const k = (p.t % 1); c.strokeStyle = `rgba(255,80,60,${1 - k})`; c.lineWidth = 2; c.beginPath(); c.arc(p.x / WORLD * MM, p.z / WORLD * MM, 4 + k * 18, 0, 6.3); c.stroke();
    }
    // 镜头视野
    const inp = this.input; const pts = [[0, 0], [innerWidth, 0], [innerWidth, innerHeight], [0, innerHeight]].map(([x, y]) => inp.groundPoint(x, y, new THREE.Vector3()));
    if (pts.every(p => p)) {
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.2; c.beginPath();
      pts.forEach((p, i) => { const x = p.x / WORLD * MM, y = p.z / WORLD * MM; if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); c.stroke();
    }
  }

  bindMinimap() {
    const mm = this.mm; let down = false;
    const toWorld = e => { const r = mm.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * WORLD, z: (e.clientY - r.top) / r.height * WORLD }; };
    mm.addEventListener('mousedown', e => {
      if (!this.input.enabled) return; const p = toWorld(e);
      if (e.button === 0) { down = true; this.input.lookAt(p.x, p.z + this.input.cam.dist * 0.12); }
      else if (e.button === 2) { const u = this.input.ownUnits(); if (u.length) { this.game.orderMove(u, p.x, p.z); this.sfx.play('ack'); } }
    });
    window.addEventListener('mousemove', e => { if (down) { const p = toWorld(e); this.input.lookAt(p.x, p.z + this.input.cam.dist * 0.12); } });
    window.addEventListener('mouseup', () => { down = false; });
    mm.addEventListener('contextmenu', e => e.preventDefault());
  }
}
