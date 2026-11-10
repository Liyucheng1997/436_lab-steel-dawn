// 全程序合成音效（WebAudio），无需任何音频素材
import { clamp } from './util.js';

const GAP = { rifle: 0.06, mg: 0.05, cannon: 0.08, heavy: 0.1, rocket: 0.1, arty: 0.15, beam: 0.1, boom: 0.07, boomS: 0.06, click: 0.03, ack: 0.08 };

export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.last = {}; this.lx = 0; this.lz = 0; this.ld = 60; }
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate; this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; }
  playAt(name, x, z, vol = 1) {
    const d = Math.hypot(x - this.lx, z - this.lz); const a = clamp(1.2 - d / (this.ld * 1.5), 0, 1);
    if (a > 0.03) this.play(name, vol * a);
  }
  play(name, vol = 1) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime; const gap = GAP[name] || 0.04;
    if (now - (this.last[name] ?? -1) < gap) return; this.last[name] = now;
    const f = this['_' + name]; if (f) f.call(this, now, vol);
  }
  _noise(t, dur, vol, type, f0, f1, q = 0.9) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(Math.max(0.0001, vol), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  _tone(t, dur, vol, type, f0, f1, delay = 0) {
    const c = this.ctx; const o = c.createOscillator(); o.type = type; const st = t + delay;
    o.frequency.setValueAtTime(f0, st); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), st + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), st + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
    o.connect(g); g.connect(this.master); o.start(st); o.stop(st + dur + 0.02);
  }
  _rifle(t, v) { this._noise(t, 0.08, 0.3 * v, 'bandpass', 2400, 800); }
  _mg(t, v) { this._noise(t, 0.06, 0.3 * v, 'bandpass', 1700, 700); this._tone(t, 0.04, 0.12 * v, 'square', 160, 80); }
  _cannon(t, v) { this._noise(t, 0.32, 0.7 * v, 'lowpass', 1500, 160); this._tone(t, 0.24, 0.6 * v, 'sine', 150, 42); }
  _heavy(t, v) { this._noise(t, 0.45, 0.85 * v, 'lowpass', 1200, 110); this._tone(t, 0.35, 0.8 * v, 'sine', 120, 34); this._tone(t, 0.2, 0.15 * v, 'sawtooth', 900, 200); }
  _rocket(t, v) { this._noise(t, 0.55, 0.3 * v, 'bandpass', 500, 2600, 1.4); }
  _arty(t, v) { this._noise(t, 0.6, 0.9 * v, 'lowpass', 900, 90); this._tone(t, 0.45, 0.85 * v, 'sine', 105, 30); }
  _beam(t, v) { this._tone(t, 0.4, 0.28 * v, 'sawtooth', 1500, 160); this._noise(t, 0.3, 0.25 * v, 'highpass', 3200, 1000); this._tone(t, 0.3, 0.5 * v, 'sine', 90, 40); }
  _boom(t, v) { this._noise(t, 0.9, 0.95 * v, 'lowpass', 750, 55); this._tone(t, 0.55, 0.85 * v, 'sine', 88, 28); }
  _boomS(t, v) { this._noise(t, 0.4, 0.55 * v, 'lowpass', 1000, 110); this._tone(t, 0.25, 0.4 * v, 'sine', 120, 45); }
  _click(t, v) { this._tone(t, 0.05, 0.14 * v, 'square', 720, 520); }
  _ack(t, v) { this._tone(t, 0.07, 0.12 * v, 'triangle', 620, 880); }
  _err(t, v) { this._tone(t, 0.16, 0.18 * v, 'sawtooth', 150, 110); }
  _place(t, v) { this._noise(t, 0.35, 0.5 * v, 'lowpass', 500, 80); this._tone(t, 0.3, 0.5 * v, 'sine', 100, 40); }
  _ready(t, v) { this._tone(t, 0.14, 0.16 * v, 'triangle', 660, 660); this._tone(t, 0.14, 0.16 * v, 'triangle', 880, 880, 0.11); this._tone(t, 0.26, 0.18 * v, 'triangle', 1320, 1320, 0.22); }
  _unit(t, v) { this._tone(t, 0.1, 0.13 * v, 'triangle', 520, 520); this._tone(t, 0.16, 0.13 * v, 'triangle', 780, 780, 0.09); }
  _alarm(t, v) { for (let i = 0; i < 3; i++) { this._tone(t, 0.14, 0.2 * v, 'square', 880, 880, i * 0.3); this._tone(t, 0.14, 0.2 * v, 'square', 620, 620, i * 0.3 + 0.15); } }
  _cash(t, v) { this._tone(t, 0.09, 0.12 * v, 'sine', 1200, 1200); this._tone(t, 0.2, 0.12 * v, 'sine', 1800, 1800, 0.07); }
  _sell(t, v) { this._tone(t, 0.3, 0.2 * v, 'triangle', 700, 220); }
  _win(t, v) { [523, 659, 784, 1047].forEach((f, i) => this._tone(t, 0.5, 0.2 * v, 'triangle', f, f, i * 0.16)); }
  _lose(t, v) { [392, 330, 262, 196].forEach((f, i) => this._tone(t, 0.6, 0.2 * v, 'sawtooth', f, f * 0.97, i * 0.22)); }
}
