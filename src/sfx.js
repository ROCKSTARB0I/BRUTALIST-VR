// Foley synthesized straight into sample arrays at boot (no runtime synthesis: Quest audio stays glitch-free).
const SR = 32000;
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const nz = () => rnd() * 2 - 1;
const arr = (sec) => new Float32Array(Math.max(1, Math.floor(sec * SR)));

// RBJ biquad, coefficients refreshable per sample block
class BQ {
  constructor(type, f, q = 0.707) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q = this.q) {
    this.q = q;
    const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
  }
}
// add a filtered-noise burst: env(t) shape, filter type/freq (freq may be a function of t)
function noiseBurst(out, at, dur, amp, type, f, q = 0.8, decay = 'exp') {
  const bq = new BQ(type, typeof f === 'function' ? f(0) : f, q);
  const n0 = Math.floor(at * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n && n0 + i < out.length; i++) {
    const t = i / SR, u = i / n;
    if (typeof f === 'function' && (i & 31) === 0) bq.set(f(u), q);
    const e = decay === 'exp' ? Math.exp(-5 * u) : decay === 'bell' ? Math.sin(Math.PI * u) ** 1.5 : (1 - u);
    out[n0 + i] += bq.p(nz()) * amp * e * Math.min(1, t * 2000);
  }
}
function tone(out, at, dur, amp, f0, f1, decay = 5, wave = 'sin') {
  const n0 = Math.floor(at * SR), n = Math.floor(dur * SR);
  let ph = 0;
  for (let i = 0; i < n && n0 + i < out.length; i++) {
    const u = i / n, f = f0 + (f1 - f0) * u;
    ph += 2 * Math.PI * f / SR;
    const w = wave === 'saw' ? ((ph / Math.PI) % 2) - 1 : Math.sin(ph);
    out[n0 + i] += w * amp * Math.exp(-decay * u) * Math.min(1, i / (SR * 0.002));
  }
}
function clicks(out, at, span, count, amp, f, q = 6) {
  for (let k = 0; k < count; k++) noiseBurst(out, at + rnd() * span, 0.004 + rnd() * 0.006, amp * (0.5 + rnd() * 0.5), 'bp', f * (0.7 + rnd() * 0.6), q);
}
function ring(out, at, freqs, dur, amp) { for (const f of freqs) tone(out, at, dur, amp / freqs.length, f, f * 0.998, 6); }
function norm(x, peak = 0.9) { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m; return x; }
function drive(x, k) { for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * k); return x; }

const DEFS = {
  whoosh: (v) => { const o = arr(0.34); noiseBurst(o, 0, 0.32, 1, 'bp', u => 300 + 1300 * Math.sin(Math.PI * u) + v * 120, 1.4, 'bell'); return norm(o, 0.5); },
  slice: () => {
    const o = arr(0.32);
    noiseBurst(o, 0, 0.03, 0.6, 'hp', 2600);
    const bq = new BQ('bp', 500, 4);
    for (let i = 0; i < 0.22 * SR; i++) { const u = i / (0.22 * SR); bq.set(520 - 280 * u, 3.5); o[i] += bq.p(nz()) * Math.exp(-4 * u) * (1 + 0.8 * Math.sin(i / SR * 2 * Math.PI * 23)) * 1.4; }
    clicks(o, 0.01, 0.12, 6, 0.5, 1300, 5);
    return norm(o, 0.8);
  },
  chop: () => {
    const o = arr(0.35);
    noiseBurst(o, 0, 0.025, 0.5, 'hp', 2500);
    clicks(o, 0, 0.05, 5, 0.9, 2200, 8);
    tone(o, 0, 0.1, 0.8, 120, 60, 4);
    const bq = new BQ('bp', 420, 3);
    for (let i = 0; i < 0.25 * SR; i++) { const u = i / (0.25 * SR); bq.set(450 - 220 * u, 3); o[i] += bq.p(nz()) * Math.exp(-4 * u) * 1.2; }
    return norm(drive(o, 1.5), 0.9);
  },
  blunt: () => {
    const o = arr(0.3);
    tone(o, 0, 0.18, 1, 80, 38, 4);
    noiseBurst(o, 0, 0.07, 0.7, 'lp', 700);
    clicks(o, 0.005, 0.07, 12, 0.35, 1800, 5);
    return norm(drive(o, 1.8), 0.95);
  },
  crush: () => {
    const o = arr(0.55);
    tone(o, 0, 0.22, 1, 70, 32, 3);
    noiseBurst(o, 0, 0.09, 0.8, 'lp', 900);
    clicks(o, 0, 0.22, 32, 0.45, 2000, 6);
    const bq = new BQ('bp', 380, 3);
    for (let i = 0; i < 0.45 * SR; i++) { const u = i / (0.45 * SR); bq.set(400 - 180 * u, 2.5); o[i] += bq.p(nz()) * Math.exp(-3.5 * u) * 1.1 * (1 + 0.7 * Math.sin(i / SR * 2 * Math.PI * 17)); }
    return norm(drive(o, 1.6), 0.95);
  },
  punch: () => { const o = arr(0.14); tone(o, 0, 0.07, 0.9, 130, 70, 4); noiseBurst(o, 0, 0.02, 0.6, 'hp', 1200); noiseBurst(o, 0, 0.06, 0.5, 'lp', 500); return norm(o, 0.8); },
  pistol: () => {
    const o = arr(0.7);
    noiseBurst(o, 0, 0.004, 1.2, 'hp', 800);
    noiseBurst(o, 0, 0.08, 0.9, 'lp', 2600);
    tone(o, 0, 0.2, 0.8, 58, 40, 5);
    noiseBurst(o, 0.01, 0.6, 0.22, 'lp', 900);
    noiseBurst(o, 0, 0.003, 0.4, 'bp', 4200, 6);
    return norm(drive(o, 2.2), 0.95);
  },
  rifle: () => {
    const o = arr(0.9);
    noiseBurst(o, 0, 0.005, 1.4, 'hp', 700);
    noiseBurst(o, 0, 0.11, 1, 'lp', 3300);
    tone(o, 0, 0.26, 0.9, 52, 36, 4.5);
    noiseBurst(o, 0.015, 0.8, 0.32, 'lp', 1000);
    return norm(drive(o, 2.6), 0.97);
  },
  cannon: () => {
    const o = arr(1.4);
    noiseBurst(o, 0, 0.008, 1.5, 'hp', 500);
    noiseBurst(o, 0, 0.16, 1, 'lp', 1800);
    tone(o, 0, 0.45, 1.2, 40, 26, 3);
    noiseBurst(o, 0.02, 1.3, 0.4, 'lp', 700);
    return norm(drive(o, 3), 1);
  },
  click: () => { const o = arr(0.05); noiseBurst(o, 0, 0.012, 1, 'bp', 3600, 9); noiseBurst(o, 0.018, 0.01, 0.5, 'bp', 2800, 9); return norm(o, 0.5); },
  reload: () => {
    const o = arr(0.55);
    noiseBurst(o, 0, 0.015, 1, 'bp', 2400, 5); ring(o, 0.005, [1850, 2780, 4130], 0.09, 0.6);
    noiseBurst(o, 0.3, 0.02, 1, 'bp', 1900, 5); ring(o, 0.305, [1500, 2340, 3700], 0.12, 0.7);
    tone(o, 0.3, 0.05, 0.4, 180, 120, 5);
    return norm(o, 0.6);
  },
  glass: () => {
    const o = arr(0.9);
    noiseBurst(o, 0, 0.07, 0.8, 'hp', 3000);
    for (let k = 0; k < 46; k++) { const at = Math.pow(rnd(), 1.8) * 0.75, f = 2800 + rnd() * 5500; tone(o, at, 0.03 + rnd() * 0.07, 0.12 + rnd() * 0.2, f, f * 0.99, 6); }
    return norm(o, 0.75);
  },
  splat: () => { const o = arr(0.09); noiseBurst(o, 0, 0.06, 1, 'bp', u => 900 - 500 * u, 2); return norm(o, 0.35); },
  thud: () => { const o = arr(0.22); tone(o, 0, 0.16, 1, 62, 34, 4); noiseBurst(o, 0, 0.1, 0.6, 'lp', 320); return norm(o, 0.7); },
  hurt: () => { const o = arr(0.3); tone(o, 0, 0.25, 1, 90, 45, 3); noiseBurst(o, 0, 0.1, 0.7, 'lp', 600); return norm(drive(o, 2), 0.8); },
  // short chesty grunt: unvoiced breath through a low throat resonance, no pitch tone (not a cartoon yelp)
  grunt: (v) => {
    const o = arr(0.32), bands = [new BQ('bp', 380 + v * 40, 3), new BQ('bp', 1050 + v * 60, 4)];
    const lp = new BQ('lp', 1800, 0.7);
    for (let i = 0; i < o.length; i++) {
      const u = i / o.length, e = Math.min(1, u * 30) * Math.exp(-4.5 * u);
      const src = nz() * (0.6 + 0.4 * Math.sin(i / SR * 2 * Math.PI * (95 + v * 10)));
      o[i] = lp.p(bands[0].p(src) * 1.0 + bands[1].p(src) * 0.45) * e;
    }
    return norm(o, 0.45);
  },
  // wet tearing for big dismemberments: sinew pulling apart under the squelch
  tear: () => {
    const o = arr(0.5);
    const bq = new BQ('bp', 900, 2.5);
    for (let i = 0; i < o.length; i++) {
      const u = i / o.length;
      bq.set(1400 - 900 * u, 2.5);
      const crackle = rnd() < 0.02 ? nz() * 3 : 0;
      o[i] = (bq.p(nz()) + crackle * 0.3) * Math.exp(-3 * u) * (0.7 + 0.3 * Math.sin(i / SR * 2 * Math.PI * 31));
    }
    noiseBurst(o, 0, 0.3, 0.8, 'lp', 350);
    return norm(o, 0.7);
  },
  // heavy steel door slam marks a new wave (no chimes)
  slam: () => {
    const o = arr(1.4);
    tone(o, 0, 0.5, 1, 55, 42, 3);
    noiseBurst(o, 0, 0.12, 0.9, 'lp', 1400);
    for (const f of [212, 347, 503]) tone(o, 0.005, 1.2, 0.18, f, f * 0.995, 4);
    noiseBurst(o, 0.02, 1.2, 0.18, 'lp', 500);
    return norm(drive(o, 1.6), 0.8);
  },
  // dying: a wet, choking exhale (no voice tone)
  gurgle: (v) => {
    const o = arr(0.9), bq = new BQ('bp', 500, 2.5), lp = new BQ('lp', 1400, 0.7);
    for (let i = 0; i < o.length; i++) {
      const u = i / o.length, bub = Math.sin(i / SR * 2 * Math.PI * (9 + v * 2)) > 0.6 ? 1.6 : 0.6;
      bq.set(380 + 260 * Math.sin(i / SR * 40) + v * 40, 2.5);
      o[i] = lp.p(bq.p(nz()) * bub) * Math.min(1, u * 12) * Math.exp(-2.6 * u);
    }
    noiseBurst(o, 0, 0.25, 0.5, 'lp', 260);
    return norm(o, 0.55);
  },
  // pneumatic nail gun: sharp air crack + a dull drive thump
  nail: () => { const o = arr(0.25); noiseBurst(o, 0, 0.02, 1, 'hp', 1800); tone(o, 0.004, 0.08, 0.8, 140, 80, 5); noiseBurst(o, 0.01, 0.18, 0.35, 'bp', u => 2400 - 1600 * u, 1.2); return norm(drive(o, 1.6), 0.8); },
  pullcord: () => { const o = arr(0.6); noiseBurst(o, 0, 0.35, 0.6, 'bp', u => 600 + 1800 * u, 2, 'bell'); clicks(o, 0.32, 0.25, 8, 0.6, 900, 4); tone(o, 0.35, 0.25, 0.5, 40, 55, 3, 'saw'); return norm(o, 0.7); },
  spinup: () => { const o = arr(0.7); const bq = new BQ('bp', 300, 3); let ph = 0; for (let i = 0; i < o.length; i++) { const u = i / o.length, f = 30 + 220 * u; ph += f / SR; o[i] = bq.p(((ph % 1) * 2 - 1) + nz() * 0.3) * Math.min(1, u * 4); bq.set(300 + 1500 * u, 3); } return norm(o, 0.6); },
  groan: (v) => {
    const o = arr(1.3), f0 = 82 + v * 8, bands = [new BQ('bp', 420, 6), new BQ('bp', 900, 7), new BQ('bp', 2300, 9)], g = [1, 0.6, 0.25];
    let ph = 0;
    for (let i = 0; i < o.length; i++) {
      const u = i / o.length, f = f0 * (1 + 0.06 * Math.sin(i / SR * 2 * Math.PI * 3.3));
      ph += f / SR; const s = (ph % 1) * 2 - 1 + nz() * 0.3;
      let y = 0; for (let k = 0; k < 3; k++) y += bands[k].p(s) * g[k];
      o[i] = y * Math.sin(Math.PI * u) * (0.7 + 0.3 * Math.sin(i / SR * 2 * Math.PI * 5));
    }
    return norm(o, 0.5);
  },
};

// a live engine voice (chainsaw / minigun motor): two-stroke saw buzz + grit, pitch and load set every frame
export class Motor {
  constructor(sfx, kind) {
    const c = sfx.ctx; this.c = c; this.kind = kind;
    this.osc = c.createOscillator(); this.osc.type = 'sawtooth';
    this.osc2 = c.createOscillator(); this.osc2.type = 'square';
    const len = c.sampleRate, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = c.createBufferSource(); this.noise.buffer = nb; this.noise.loop = true;
    this.nf = c.createBiquadFilter(); this.nf.type = 'bandpass'; this.nf.frequency.value = 1800; this.nf.Q.value = 0.8;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 1200; this.lp.Q.value = 2;
    this.g = c.createGain(); this.g.gain.value = 0;
    this.ng = c.createGain(); this.ng.gain.value = 0;
    this.og2 = c.createGain(); this.og2.gain.value = 0.35;
    this.pan = c.createPanner(); this.pan.panningModel = 'equalpower'; this.pan.refDistance = 1.2;
    this.osc.connect(this.lp); this.osc2.connect(this.og2); this.og2.connect(this.lp);
    this.noise.connect(this.nf); this.nf.connect(this.ng); this.ng.connect(this.pan);
    this.lp.connect(this.g); this.g.connect(this.pan); this.pan.connect(sfx.master);
    this.osc.start(); this.osc2.start(); this.noise.start();
  }
  set(on, rev, load, pos) {
    const t = this.c.currentTime, k = this.kind === 'saw';
    const f = k ? (on ? 38 + rev * 85 - load * 18 : 0) : 40 + rev * 260;
    this.osc.frequency.setTargetAtTime(Math.max(20, f), t, 0.05);
    this.osc2.frequency.setTargetAtTime(Math.max(20, f * 0.5), t, 0.05);
    this.lp.frequency.setTargetAtTime(k ? 700 + rev * 2200 : 500 + rev * 3000, t, 0.05);
    this.g.gain.setTargetAtTime(on ? (k ? 0.28 + rev * 0.25 : rev * 0.3) : 0, t, 0.06);
    this.ng.gain.setTargetAtTime(on ? (k ? 0.06 + load * 0.5 : rev * 0.05) : 0, t, 0.05);
    if (pos) { this.pan.positionX.value = pos.x; this.pan.positionY.value = pos.y; this.pan.positionZ.value = pos.z; }
  }
  stop() { try { this.osc.stop(); this.osc2.stop(); this.noise.stop(); this.pan.disconnect(); } catch (e) {} }
}

export class Sfx {
  constructor() { this.ctx = null; this.bank = {}; this.live = 0; this.muted = /[?&]mute/.test(location.search); }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'playback' });
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    for (const [name, fn] of Object.entries(DEFS)) {
      this.bank[name] = [0, 1, 2].map(v => {
        const data = fn(v), b = this.ctx.createBuffer(1, data.length, SR);
        b.copyToChannel(data, 0); return b;
      });
    }
    const resume = () => { if (this.ctx.state !== 'running') this.ctx.resume(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, resume));
    setInterval(resume, 2000);
  }
  play(name, pos, vol = 1, rate = 1, vip = false) {
    const c = this.ctx; if (!c || !this.bank[name]) return;
    if (this.live > 26 && !vip) return;
    const src = c.createBufferSource(), vs = this.bank[name];
    src.buffer = vs[(Math.random() * vs.length) | 0];
    src.playbackRate.value = rate * (0.93 + Math.random() * 0.14);
    const g = c.createGain(); g.gain.value = vol;
    src.connect(g);
    if (pos) {
      const p = c.createPanner();
      p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 1.2; p.rolloffFactor = 1.1;
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
      g.connect(p); p.connect(this.master);
    } else g.connect(this.master);
    this.live++;
    src.onended = () => { this.live--; };
    src.start();
    return src;
  }
  listen(cam) {
    const c = this.ctx; if (!c) return;
    const L = c.listener, e = cam.matrixWorld.elements;
    if (L.positionX) {
      L.positionX.value = e[12]; L.positionY.value = e[13]; L.positionZ.value = e[14];
      L.forwardX.value = -e[8]; L.forwardY.value = -e[9]; L.forwardZ.value = -e[10];
      L.upX.value = e[4]; L.upY.value = e[5]; L.upZ.value = e[6];
    } else { L.setPosition(e[12], e[13], e[14]); L.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]); }
  }
}
