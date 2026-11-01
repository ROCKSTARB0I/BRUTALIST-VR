// Blood that never goes away: droplets fly, land, and are painted into per-face canvases on the level boxes.
// Also: loose chunks (head halves, skull bits, brains) and bullet-hole decals stuck to body bones.
import * as THREE from '../vendor/three.module.js?v=3';
import { Particle, DT } from './phys.js?v=3';
const V3 = THREE.Vector3;
const MAXD = 1600;
const PPM = 40;                // canvas pixels per metre on level surfaces

export const BLOOD_COLORS = {
  red: ['#a30000', '#c80c0c', '#6c0000'],
  neon: ['#ff1e8c', '#ff4fb0', '#c4006a'],
  toxic: ['#46ff3c', '#9dff6a', '#1fa31a'],
  ink: ['#1a1a1a', '#333333', '#000000'],
};

export class Gore {
  constructor(game) {
    this.g = game;
    this.color = 'red';
    // droplets
    this.dp = new Float32Array(MAXD * 3); this.dv = new Float32Array(MAXD * 3); this.ds = new Float32Array(MAXD); this.dl = new Float32Array(MAXD);
    this.n = 0;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    this.dmat = new THREE.MeshBasicMaterial({ color: 0x7a0505 });
    this.dmesh = new THREE.InstancedMesh(geo, this.dmat, MAXD);
    this.dmesh.frustumCulled = false; this.dmesh.count = 0;
    game.scene.add(this.dmesh);
    this.dirty = new Set();
    this.faceList = [];
    this.chunks = [];
    this.holeGeo = new THREE.CircleGeometry(1, 8);
    this.holeMat = new THREE.MeshBasicMaterial({ color: 0x2a0000, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this.exitMat = new THREE.MeshBasicMaterial({ color: 0x6a0303, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new V3(); this._v = new V3();
  }
  setColor(name) {
    this.color = BLOOD_COLORS[name] ? name : 'red';
    this.dmat.color.set(BLOOD_COLORS[this.color][1]);
    this.holeMat.color.set(BLOOD_COLORS[this.color][2]).multiplyScalar(0.5);
    this.exitMat.color.set(BLOOD_COLORS[this.color][0]);
  }
  col(i) { return BLOOD_COLORS[this.color][i]; }

  emit(pos, vel, n, spread = 1, size = 1) {
    for (let k = 0; k < n; k++) {
      if (this.n >= MAXD) this.land(0, false);
      const i = this.n++;
      this.dp[i * 3] = pos.x + (Math.random() - 0.5) * 0.02;
      this.dp[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.02;
      this.dp[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.02;
      this.dv[i * 3] = vel.x + (Math.random() - 0.5) * spread;
      this.dv[i * 3 + 1] = vel.y + (Math.random() - 0.5) * spread;
      this.dv[i * 3 + 2] = vel.z + (Math.random() - 0.5) * spread;
      this.ds[i] = (0.006 + Math.random() * 0.012) * size;
      this.dl[i] = 0;
    }
  }
  burst(pos, n, speed, up = 1.5, size = 1) {
    for (let k = 0; k < n; k++) {
      this._v.set(Math.random() - 0.5, Math.random() * 0.8 - 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random()));
      this._v.y += up;
      this.emit(pos, this._v, 1, 0.2, size);
    }
  }
  // remove droplet i; optionally paint where it ended up
  land(i, paint, box, ax, sg) {
    if (paint && box) this.paint(box, ax, sg, this.dp[i * 3], this.dp[i * 3 + 1], this.dp[i * 3 + 2], this.ds[i] * 2.4,
      this.dv[i * 3], this.dv[i * 3 + 1], this.dv[i * 3 + 2]);
    const j = --this.n;
    if (i !== j) {
      for (let k = 0; k < 3; k++) { this.dp[i * 3 + k] = this.dp[j * 3 + k]; this.dv[i * 3 + k] = this.dv[j * 3 + k]; }
      this.ds[i] = this.ds[j]; this.dl[i] = this.dl[j];
    }
  }
  update(dt) {
    const boxes = this.g.phys.boxes, P = this.dp, Vv = this.dv;
    for (let i = this.n - 1; i >= 0; i--) {
      Vv[i * 3 + 1] -= 9.81 * dt;
      const k = 1 - 0.4 * dt;
      Vv[i * 3] *= k; Vv[i * 3 + 2] *= k;
      const x = P[i * 3] + Vv[i * 3] * dt, y = P[i * 3 + 1] + Vv[i * 3 + 1] * dt, z = P[i * 3 + 2] + Vv[i * 3 + 2] * dt;
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
      this.dl[i] += dt;
      if (y < -20 || this.dl[i] > 6) { this.land(i, false); continue; }
      for (const b of boxes) {
        if (x < b.min.x || x > b.max.x || y < b.min.y || y > b.max.y || z < b.min.z || z > b.max.z) continue;
        // which face did it come through: smallest penetration
        let best = x - b.min.x, ax = 0, sg = -1, t;
        t = b.max.x - x; if (t < best) { best = t; ax = 0; sg = 1; }
        t = y - b.min.y; if (t < best) { best = t; ax = 1; sg = -1; }
        t = b.max.y - y; if (t < best) { best = t; ax = 1; sg = 1; }
        t = z - b.min.z; if (t < best) { best = t; ax = 2; sg = -1; }
        t = b.max.z - z; if (t < best) { best = t; ax = 2; sg = 1; }
        if (ax === 0) P[i * 3] = sg > 0 ? b.max.x : b.min.x; else if (ax === 1) P[i * 3 + 1] = sg > 0 ? b.max.y : b.min.y; else P[i * 3 + 2] = sg > 0 ? b.max.z : b.min.z;
        this.land(i, true, b, ax, sg);
        break;
      }
    }
    // draw
    const m = this._m, q = this._q, s = this._s, v = this._v;
    for (let i = 0; i < this.n; i++) {
      v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      const r = this.ds[i];
      s.set(r, r * 1.6, r);
      m.compose(v, q, s);
      this.dmesh.setMatrixAt(i, m);
    }
    this.dmesh.count = this.n;
    this.dmesh.instanceMatrix.needsUpdate = true;
    // push painted canvases to the GPU, a few per frame
    let budget = 3;
    for (const f of this.dirty) { f.tex.needsUpdate = true; this.dirty.delete(f); if (--budget <= 0) break; }
    for (const c of this.chunks) c.sync();
  }

  // ---- level painting ----
  faceIndex(ax, sg) { return ax * 2 + (sg > 0 ? 0 : 1); }   // BoxGeometry order: px nx py ny pz nz
  face(box, fi) {
    box.faces = box.faces || [];
    let f = box.faces[fi];
    if (f) return f;
    const sx = box.max.x - box.min.x, sy = box.max.y - box.min.y, sz = box.max.z - box.min.z;
    const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]][fi];
    const W = Math.max(16, Math.min(1024, Math.round(dims[0] * PPM))), H = Math.max(16, Math.min(1024, Math.round(dims[1] * PPM)));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    (box.paintBase || defaultBase)(ctx, W, H, box, fi, dims);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    if (box.mesh) { box.mesh.material[fi] = mat; }
    f = box.faces[fi] = { cv, ctx, tex, W, H, dims, mat };
    this.faceList.push(f);
    return f;
  }
  uv(box, fi, x, y, z) {
    const mn = box.min, mx = box.max, sx = mx.x - mn.x, sy = mx.y - mn.y, sz = mx.z - mn.z;
    switch (fi) {
      case 0: return [(mx.z - z) / sz, (y - mn.y) / sy];
      case 1: return [(z - mn.z) / sz, (y - mn.y) / sy];
      case 2: return [(x - mn.x) / sx, (mx.z - z) / sz];
      case 3: return [(x - mn.x) / sx, (z - mn.z) / sz];
      case 4: return [(x - mn.x) / sx, (y - mn.y) / sy];
      default: return [(mx.x - x) / sx, (y - mn.y) / sy];
    }
  }
  paint(box, ax, sg, x, y, z, r, vx = 0, vy = 0, vz = 0, alpha = 0.9) {
    if (box.glass || box.noPaint) return;
    const fi = this.faceIndex(ax, sg), f = this.face(box, fi);
    const [u, v] = this.uv(box, fi, x, y, z);
    const px = u * f.W, py = (1 - v) * f.H;
    const sx = f.W / f.dims[0], sy = f.H / f.dims[1];
    const ctx = f.ctx;
    // streak direction: tangential velocity projected into face space (rough)
    const tang = ax === 1 ? [vx, sg > 0 ? -vz : vz] : ax === 0 ? [sg > 0 ? -vz : vz, -vy] : [sg > 0 ? vx : -vx, -vy];
    const sp = Math.hypot(tang[0], tang[1]);
    const ang = Math.atan2(tang[1], tang[0]);
    const stretch = 1 + Math.min(2.5, sp * 0.35);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.col(Math.random() < 0.3 ? 2 : 0);
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1, r * sx * stretch), Math.max(1, r * sy), 0, 0, Math.PI * 2); ctx.fill();
    const sat = 1 + (Math.random() * 4) | 0;
    for (let k = 0; k < sat; k++) {
      const d = (1 + Math.random() * 2.5) * r * sx * stretch, rr = r * sx * (0.15 + Math.random() * 0.3);
      ctx.beginPath(); ctx.arc(d * (Math.random() < 0.7 ? 1 : -0.5), (Math.random() - 0.5) * r * sy * 1.5, Math.max(0.6, rr), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    this.dirty.add(f);
  }
  // blood pool on whatever is beneath a point
  pool(pos, r) {
    const h = this.g.phys.ray(pos, DOWN, 3, true);
    if (!h || h.ax !== 1) return;
    const y = pos.y - h.t;
    this.paint(h.box, 1, 1, pos.x + (Math.random() - 0.5) * r * 0.5, y, pos.z + (Math.random() - 0.5) * r * 0.5, r, 0, 0, 0, 0.55);
  }
  // splash a cone of blood onto nearby walls/floor right away (for big impacts)
  splash(pos, dir, n, reach = 2.5) {
    for (let k = 0; k < n; k++) {
      this._v.copy(dir).add(new V3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2)).normalize();
      const h = this.g.phys.ray(pos, this._v, reach, true);
      if (!h) continue;
      const hp = pos.clone().addScaledVector(this._v, h.t);
      this.paint(h.box, h.ax, h.sg, hp.x, hp.y, hp.z, 0.02 + Math.random() * 0.05, this._v.x * 5, this._v.y * 5, this._v.z * 5);
    }
  }

  // ---- decals on body bones ----
  hole(bone, point, normal, size, exit) {
    const mesh = bone.mesh; mesh.updateMatrixWorld();
    const d = new THREE.Mesh(this.holeGeo, exit ? this.exitMat : this.holeMat);
    const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    d.position.copy(point).addScaledVector(normal, 0.002).applyMatrix4(inv);
    const nq = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), normal);
    const mq = new THREE.Quaternion(); mesh.getWorldQuaternion(mq);
    d.quaternion.copy(mq.invert().multiply(nq));
    d.scale.setScalar(size);
    mesh.add(d);
    return d;
  }

  // ---- loose chunks ----
  chunk(mesh, frame, vel, spin = 2) {
    // frame: {o: V3 (centroid), x: V3, y: V3} — 3 particles keep the chunk's orientation
    const g = this.g, s = 0.04;
    const z = new V3().crossVectors(frame.x, frame.y).normalize();
    const pts = [new V3(0, s, 0), new V3(-s * 0.87, -s * 0.5, 0), new V3(s * 0.87, -s * 0.5, 0)].map(l =>
      frame.o.clone().addScaledVector(frame.x, l.x).addScaledVector(frame.y, l.y).addScaledVector(z, l.z));
    const ps = pts.map(p => { const q = new Particle(p, 0.025, 0.3); q.fric = 0.7; q.place(p, vel.clone().add(new V3((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin))); g.phys.add(q); return q; });
    g.phys.link(ps[0], ps[1]); g.phys.link(ps[1], ps[2]); g.phys.link(ps[2], ps[0]);
    // local mesh frame relative to the particle triangle
    const c = new Chunk(mesh, ps, frame);
    g.scene.add(mesh);
    this.chunks.push(c);
    if (this.chunks.length > 140) { const old = this.chunks.shift(); old.dispose(g); }
    return c;
  }
}

const DOWN = new V3(0, -1, 0);

class Chunk {
  constructor(mesh, ps, frame) {
    this.mesh = mesh; this.ps = ps;
    // record the mesh's frame relative to the triangle frame at spawn
    const tri = triFrame(ps);
    const meshM = new THREE.Matrix4().makeBasis(frame.x, frame.y, new V3().crossVectors(frame.x, frame.y)).setPosition(frame.o);
    this.rel = tri.invert().multiply(meshM);
    this.still = 0;
  }
  sync() {
    if (this.ps[0].sleep) return;
    const m = triFrame(this.ps).multiply(this.rel);
    m.decompose(this.mesh.position, this.mesh.quaternion, this.mesh.scale);
    const v = this.ps[0].p.distanceToSquared(this.ps[0].o);
    this.still = v < 1e-9 ? this.still + 1 : 0;
    if (this.still > 240) for (const p of this.ps) p.sleep = true;
  }
  dispose(g) { g.scene.remove(this.mesh); for (const p of this.ps) p.gone = true; }
}
const _a = new V3(), _b = new V3(), _c = new V3();
function triFrame(ps) {
  const o = new V3().addVectors(ps[0].p, ps[1].p).add(ps[2].p).multiplyScalar(1 / 3);
  _a.subVectors(ps[0].p, o).normalize();                 // y
  _b.subVectors(ps[2].p, ps[1].p).normalize();           // x
  _b.addScaledVector(_a, -_b.dot(_a)).normalize();
  _c.crossVectors(_b, _a);
  return new THREE.Matrix4().makeBasis(_b, _a, _c).setPosition(o);
}

function defaultBase(ctx, W, H, box) {
  ctx.fillStyle = box.color || '#d8d4cc';
  ctx.fillRect(0, 0, W, H);
  // faint flash-era grime
  for (let i = 0; i < W * H / 900; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 5, 2 + Math.random() * 5);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
}
