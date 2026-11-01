// Verlet particle world: stickmen are literally sticks between particles.
// Fixed 120 Hz step, position-based constraints, static boxes, soft "muscle" drive per particle.
import * as THREE from '../vendor/three.module.js?v=3';
const V3 = THREE.Vector3;
export const DT = 1 / 120;
export const GRAV = -9.81;
const AX = ['x', 'y', 'z'];

export class Particle {
  constructor(pos, r = 0.05, m = 1) {
    this.p = pos.clone(); this.o = pos.clone();
    this.r = r; this.m = m; this.im = 1 / m;
    this.drive = new V3(); this.ds = 0;      // muscle target + strength per step (0..1)
    this.pin = null;                          // Vector3: hard follow (grabbed / impaled / nailed)
    this.grav = 1; this.damp = 0.997; this.fric = 0.5;
    this.body = null; this.contact = 0; this.gone = false; this.sleep = false;
  }
  vel(out) { return out.subVectors(this.p, this.o).multiplyScalar(1 / DT); }
  addVel(v, s = 1) { this.o.addScaledVector(v, -DT * s); }
  place(pos, vel) { this.p.copy(pos); this.o.copy(pos); if (vel) this.o.addScaledVector(vel, -DT); }
}

export class Stick {
  constructor(a, b, len, k = 1, min = false) {
    this.a = a; this.b = b; this.len = len ?? a.p.distanceTo(b.p); this.k = k; this.min = min; this.on = true;
  }
}

export class Phys {
  constructor() {
    this.parts = []; this.sticks = []; this.boxes = [];
    this.iters = 8;
    this.onImpact = null;   // (particle, speed, box, axis, sign)
    this.onGlass = null;    // (box, particle, speed)
    this.player = null;     // {x, z, y0, y1, r} vertical capsule nothing may enter
  }
  add(p) { this.parts.push(p); return p; }
  link(a, b, len, k, min) { const s = new Stick(a, b, len, k, min); this.sticks.push(s); return s; }
  prune() {
    this.parts = this.parts.filter(p => !p.gone);
    this.sticks = this.sticks.filter(s => s.on && !s.a.gone && !s.b.gone);
  }

  step() {
    const dt2 = DT * DT;
    for (const p of this.parts) {
      if (p.sleep) continue;
      if (p.pin) { p.o.copy(p.p); p.p.copy(p.pin); continue; }
      const d = p.damp;
      const vx = (p.p.x - p.o.x) * d, vy = (p.p.y - p.o.y) * d, vz = (p.p.z - p.o.z) * d;
      p.o.copy(p.p);
      p.p.x += vx; p.p.y += vy + GRAV * p.grav * dt2; p.p.z += vz;
      if (p.ds > 0) {
        // soft keyframe: move toward the pose, but keep most of the move out of the velocity (damped muscle)
        const s = p.ds, dx = (p.drive.x - p.p.x) * s, dy = (p.drive.y - p.p.y) * s, dz = (p.drive.z - p.p.z) * s;
        p.p.x += dx; p.p.y += dy; p.p.z += dz;
        p.o.x += dx * 0.85; p.o.y += dy * 0.85; p.o.z += dz * 0.85;
      }
      p.contact = 0;
    }
    const sticks = this.sticks;
    for (let it = 0; it < this.iters; it++) {
      for (let i = 0; i < sticks.length; i++) {
        const s = sticks[i];
        if (!s.on) continue;
        const a = s.a, b = s.b;
        const dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, dz = b.p.z - a.p.z;
        const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        if (s.min && l >= s.len) continue;
        const wa = (a.pin || a.sleep) ? 0 : a.im, wb = (b.pin || b.sleep) ? 0 : b.im;
        const w = wa + wb; if (w === 0) continue;
        const f = (l - s.len) / l / w * s.k;
        a.p.x += dx * f * wa; a.p.y += dy * f * wa; a.p.z += dz * f * wa;
        b.p.x -= dx * f * wb; b.p.y -= dy * f * wb; b.p.z -= dz * f * wb;
      }
      if (it === 3 || it === this.iters - 1) {
        for (const p of this.parts) if (!p.sleep && !p.pin) this.collide(p);
      }
    }
  }

  collide(p) {
    const r = p.r, P = p.p;
    const boxes = this.boxes;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (P.x < b.min.x - r || P.x > b.max.x + r || P.y < b.min.y - r || P.y > b.max.y + r || P.z < b.min.z - r || P.z > b.max.z + r) continue;
      let best = P.x - (b.min.x - r), ax = 0, sg = -1, t;
      t = (b.max.x + r) - P.x; if (t < best) { best = t; ax = 0; sg = 1; }
      t = P.y - (b.min.y - r); if (t < best) { best = t; ax = 1; sg = -1; }
      t = (b.max.y + r) - P.y; if (t < best) { best = t; ax = 1; sg = 1; }
      t = P.z - (b.min.z - r); if (t < best) { best = t; ax = 2; sg = -1; }
      t = (b.max.z + r) - P.z; if (t < best) { best = t; ax = 2; sg = 1; }
      if (b.glass) {
        const k = AX[ax];
        const sp = Math.abs(P[k] - p.o[k]) / DT;
        if (sp > 2.2 && this.onGlass) { this.onGlass(b, p, sp); if (b.broken) continue; }
      }
      this.resolve(p, ax, sg, best, b);
    }
    const c = this.player;
    if (c && P.y > c.y0 && P.y < c.y1) {
      const dx = P.x - c.x, dz = P.z - c.z, rr = c.r + r, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 1e-4, push = (rr - d) / d;
        P.x += dx * push; P.z += dz * push;
      }
    }
  }

  resolve(p, ax, sg, pen, box) {
    const k = AX[ax], P = p.p, O = p.o;
    const vn = (P[k] - O[k]) * sg / DT;          // + = leaving the surface
    P[k] += sg * pen;
    if (vn < 0) {
      if (vn < -3 && this.onImpact) this.onImpact(p, -vn, box, ax, sg);
      O[k] = P[k] + vn * 0.12 * DT * sg;          // small bounce
    } else O[k] = P[k] - vn * DT * sg;
    if (!(p.contact & 1)) {                       // friction once per step
      const f = p.fric;
      for (let i = 0; i < 3; i++) if (i !== ax) { const kk = AX[i]; O[kk] += (P[kk] - O[kk]) * f; }
    }
    p.contact |= 1;
  }

  groundAt(x, z, y, r = 0.08) {
    let g = -Infinity;
    for (const b of this.boxes) {
      if (b.glass || b.noFloor) continue;
      if (x >= b.min.x - r && x <= b.max.x + r && z >= b.min.z - r && z <= b.max.z + r && b.max.y <= y + 0.45 && b.max.y > g) g = b.max.y;
    }
    return g === -Infinity ? -60 : g;
  }

  // ray vs every box; returns {t, box, ax, sg} of the nearest hit within maxT
  ray(o, d, maxT, skipGlass = false) {
    let best = null;
    for (const b of this.boxes) {
      if (skipGlass && b.glass) continue;
      const h = rayBox(o, d, b.min, b.max);
      if (h && h.t >= 0 && h.t < maxT && (!best || h.t < best.t)) { best = h; best.box = b; }
    }
    return best;
  }
}

export function rayBox(o, d, mn, mx) {
  let t0 = -Infinity, t1 = Infinity, ax = 0, sg = 0;
  for (let i = 0; i < 3; i++) {
    const k = AX[i], di = d[k];
    if (Math.abs(di) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) return null; continue; }
    let a = (mn[k] - o[k]) / di, b = (mx[k] - o[k]) / di, s = -1;
    if (a > b) { const tt = a; a = b; b = tt; s = 1; }
    if (a > t0) { t0 = a; ax = i; sg = s; }
    if (b < t1) t1 = b;
    if (t0 > t1) return null;
  }
  if (t1 < 0) return null;
  return { t: t0, ax, sg };
}

// closest points between segments p1q1 and p2q2 (Ericson). Writes s, t, d2 into out.
const _d1 = new V3(), _d2 = new V3(), _r = new V3();
export function segSeg(p1, q1, p2, q2, out) {
  _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _r.subVectors(p1, p2);
  const a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_r);
  let s, t;
  if (a < 1e-9 && e < 1e-9) { s = 0; t = 0; }
  else if (a < 1e-9) { s = 0; t = clamp01(f / e); }
  else {
    const c = _d1.dot(_r);
    if (e < 1e-9) { t = 0; s = clamp01(-c / a); }
    else {
      const b = _d1.dot(_d2), den = a * e - b * b;
      s = den > 1e-9 ? clamp01((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); } else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  out.s = s; out.t = t;
  out.c1.copy(p1).addScaledVector(_d1, s);
  out.c2.copy(p2).addScaledVector(_d2, t);
  out.d2 = out.c1.distanceToSquared(out.c2);
  return out;
}
export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

// ray vs capsule (a,b,r): returns [tIn, tOut] or null
const _ba = new V3(), _oa = new V3();
export function rayCapsule(o, d, a, b, r) {
  // sample-free: intersect infinite cylinder, then clip with end spheres
  _ba.subVectors(b, a); _oa.subVectors(o, a);
  const baba = _ba.dot(_ba), bard = _ba.dot(d), baoa = _ba.dot(_oa), rdoa = d.dot(_oa), oaoa = _oa.dot(_oa);
  const A = baba - bard * bard, B = baba * rdoa - baoa * bard, C = baba * oaoa - baoa * baoa - r * r * baba;
  let tIn = null, tOut = null;
  const h = B * B - A * C;
  if (h >= 0 && A > 1e-9) {
    const sq = Math.sqrt(h);
    const t0 = (-B - sq) / A, t1 = (-B + sq) / A;
    const y0 = baoa + t0 * bard, y1 = baoa + t1 * bard;
    if (y0 > 0 && y0 < baba) tIn = t0;
    if (y1 > 0 && y1 < baba) tOut = t1;
  }
  const sph = (c) => {
    const ocx = o.x - c.x, ocy = o.y - c.y, ocz = o.z - c.z;
    const bb = ocx * d.x + ocy * d.y + ocz * d.z, cc = ocx * ocx + ocy * ocy + ocz * ocz - r * r;
    const hh = bb * bb - cc; if (hh < 0) return null;
    const s = Math.sqrt(hh); return [-bb - s, -bb + s];
  };
  for (const c of [a, b]) {
    const s = sph(c); if (!s) continue;
    if (tIn === null || s[0] < tIn) tIn = s[0];
    if (tOut === null || s[1] > tOut) tOut = s[1];
  }
  if (tIn === null || tOut === null || tOut < 0) return null;
  return [tIn, tOut];
}
