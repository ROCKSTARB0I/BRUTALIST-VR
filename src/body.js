// Stickmen: 17 particles, capsule bones between them, hidden struts that hold the torso together.
// Alive = particles are pulled toward an animated pose (muscles). Dead = pure ragdoll.
// Any bone can be cut anywhere along its length; the struts that cross the cut plane snap with it.
import * as THREE from '../vendor/three.module.js?v=6';
import { Particle, DT } from './phys.js?v=6';
import { MODELS } from './models.js?v=6';
const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);

export const J = { CROWN: 0, NECK: 1, CHEST: 2, BELLY: 3, PELVIS: 4, LS: 5, LE: 6, LH: 7, RS: 8, RE: 9, RH: 10, LHIP: 11, LK: 12, LF: 13, RHIP: 14, RK: 15, RF: 16 };
const REST = [[0, 1.71, 0.0], [0, 1.53, 0], [0, 1.38, 0], [0, 1.16, 0.01], [0, 0.96, 0],
  [0.19, 1.42, 0], [0.23, 1.15, -0.03], [0.25, 0.89, 0.02],
  [-0.19, 1.42, 0], [-0.23, 1.15, -0.03], [-0.25, 0.89, 0.02],
  [0.1, 0.92, 0], [0.11, 0.5, 0.04], [0.12, 0.08, 0],
  [-0.1, 0.92, 0], [-0.11, 0.5, 0.04], [-0.12, 0.08, 0]];
const PR = [0.1, 0.04, 0.1, 0.1, 0.1, 0.05, 0.045, 0.05, 0.05, 0.045, 0.05, 0.06, 0.05, 0.055, 0.06, 0.05, 0.055];
const PM = [4, 2, 12, 9, 10, 3, 2, 1, 3, 2, 1, 5, 4, 2, 5, 4, 2];
const PS = [0.6, 0.7, 0.9, 0.9, 1, 0.6, 0.45, 0.45, 0.6, 0.45, 0.45, 0.8, 0.7, 1, 0.8, 0.7, 1];
const { CROWN, NECK, CHEST, BELLY, PELVIS, LS, LE, LH, RS, RE, RH, LHIP, LK, LF, RHIP, RK, RF } = J;
const BONES = [
  [NECK, CROWN, 0.1, 'head'], [CHEST, NECK, 0.032, 'neck'],
  [CHEST, BELLY, 0.075, 'torso'], [BELLY, PELVIS, 0.075, 'torso'],
  [CHEST, LS, 0.028, 'clav'], [CHEST, RS, 0.028, 'clav'],
  [LS, LE, 0.02, 'arm'], [LE, LH, 0.019, 'arm', 0.022],
  [RS, RE, 0.02, 'arm'], [RE, RH, 0.019, 'arm', 0.022],
  [PELVIS, LHIP, 0.06, 'hip'], [PELVIS, RHIP, 0.06, 'hip'],
  [LHIP, LK, 0.031, 'leg'], [LK, LF, 0.028, 'leg', 0.03],
  [RHIP, RK, 0.031, 'leg'], [RK, RF, 0.028, 'leg', 0.03]];
// which outfit colour each bone wears: 's' shirt, 'p' pants, 'k' skin, 'l' sleeve (shirt if long sleeves)
const WEAR = ['k', 'k', 's', 's', 's', 's', 's', 'l', 's', 'l', 'p', 'p', 'p', 'p', 'p', 'p'];
const BALL_WEAR = { 7: 'k', 9: 'k', 13: 'f', 15: 'f' };
const SKIN = '#8c9096';
const SKINS = ['#8c9096', '#767a80', '#5f6369', '#9ea2a8', '#6a6e74'];
export const OUTFITS = [
  { name: 'tracksuit', shirt: '#6a3fb5', pants: '#5a35a0', long: true, hat: null, stripe: '#f2f2f2' },
  { name: 'trackjacket', shirt: '#d8d0f2', pants: '#3b3e56', long: true, hat: null, stripe: '#38b862', coat: true },
  { name: 'overalls', shirt: '#4c3b72', pants: '#ff3faa', long: false, hat: null, bib: '#ff3faa' },
  { name: 'dungarees', shirt: '#2fd2b2', pants: '#1f4fe0', long: true, hat: null, bib: '#1f4fe0' },
  { name: 'labcoat', shirt: '#f1f1ee', pants: '#45474f', long: true, hat: null, coat: true },
  { name: 'windbreaker', shirt: '#3d7fd0', pants: '#2c2d33', long: true, hat: 'cap', hatColor: '#2c2d33', stripe: '#f0c419' },
  { name: 'scrubs', shirt: '#7fc7d9', pants: '#6fb5c7', long: false, hat: null },
  { name: 'greens', shirt: '#6dbf6a', pants: '#5aa858', long: false, hat: 'bucket', hatColor: '#4c8f4a' },
  { name: 'hivis', shirt: '#e8d43a', pants: '#3a3d44', long: false, hat: 'cap', hatColor: '#d9a22a' },
  { name: 'tee', shirt: '#e9e6df', pants: '#3e5a86', long: false, hat: null },
  { name: 'jumpsuit', shirt: '#e2702b', pants: '#e2702b', long: true, hat: null },
  { name: 'suit', shirt: '#2a2b30', pants: '#2a2b30', long: true, hat: null },
  { name: 'hoodie', shirt: '#b8302e', pants: '#2f3036', long: true, hat: 'beanie', hatColor: '#28292e' },
  { name: 'pink', shirt: '#e06aa8', pants: '#e9e6df', long: false, hat: 'cap', hatColor: '#e06aa8' },
];
export const SOLDIER = { name: 'soldier', shirt: '#59603f', pants: '#4c5236', long: true, hat: 'helmet', hatColor: '#4a5235', vest: true };
const ZOMBIE_SKIN = '#7f9a72';
const STRUCT = [[LS, RS], [LS, NECK], [RS, NECK], [LS, BELLY], [RS, BELLY], [NECK, BELLY], [CHEST, PELVIS], [LHIP, RHIP],
  [LHIP, BELLY], [RHIP, BELLY], [LHIP, CHEST], [RHIP, CHEST], [LS, PELVIS], [RS, PELVIS],
  [CROWN, CHEST, 0.6], [CROWN, LS, 0.25], [CROWN, RS, 0.25]];
const MINS = [[LS, LH, 0.14], [RS, RH, 0.14], [LHIP, LF, 0.3], [RHIP, RF, 0.3], [LF, RF, 0.1], [LK, RK, 0.1], [LE, BELLY, 0.12], [RE, BELLY, 0.12]];
export const ZONE = { head: 2.6, neck: 2, torso: 1, clav: 0.8, hip: 0.8, arm: 0.5, leg: 0.6 };

// capsule (or flat-cut) limb, built along +Y from 0 to len; cut ends show flesh, bone and marrow
const FLESH = [0.62, 0.05, 0.05], BONE = [0.94, 0.9, 0.8], MARROW = [0.4, 0.04, 0.05];
export function limbGeo(len, r, capA, capB, seg = 10, phiLen = Math.PI * 2, base = [1, 1, 1]) {
  const V2 = THREE.Vector2, pts = [], N = 4;
  if (capA === 'cut') pts.push(new V2(0, 0), new V2(r * 0.16, 0), new V2(r * 0.33, 0), new V2(r * 0.38, 0), new V2(r * 0.95, 0), new V2(r, 0.006));
  else for (let i = 0; i <= N; i++) { const a = -Math.PI / 2 + i / N * Math.PI / 2; pts.push(new V2(Math.max(0, Math.cos(a) * r), Math.sin(a) * r)); }
  if (capB === 'cut') pts.push(new V2(r, len - 0.006), new V2(r * 0.95, len), new V2(r * 0.38, len), new V2(r * 0.33, len), new V2(r * 0.16, len), new V2(0, len));
  else for (let i = 0; i <= N; i++) { const a = i / N * Math.PI / 2; pts.push(new V2(Math.max(0, Math.cos(a) * r), len + Math.sin(a) * r)); }
  const g = new THREE.LatheGeometry(pts, seg, 0, phiLen);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), rad = Math.hypot(x, z) / r;
    let c = base;
    if ((capA === 'cut' && y < 0.003) || (capB === 'cut' && y > len - 0.003)) c = rad < 0.2 ? MARROW : rad < 0.36 ? BONE : FLESH;
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export function tint(g, c) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
export function whiteColors(g) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(1);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}

const _v = new V3(), _w = new V3(), _q = new THREE.Quaternion(), _u = new V3(), _m4 = new THREE.Matrix4();

class Bone {
  constructor(body, a, b, r, kind, o = {}) {
    this.body = body; this.a = a; this.b = b; this.r = r; this.kind = kind;
    this.len = o.len ?? a.p.distanceTo(b.p);
    this.capA = o.capA || 'round'; this.capB = o.capB || 'round';
    this.ball = o.ball || 0; this.saw = 0; this.cool = 0; this.base = o.base || [1, 1, 1]; this.ballBase = o.ballBase || this.base;
    this.stick = body.g.phys.link(a, b, this.len);
    body.sticks.push(this.stick);
    this.isHead = kind === 'head';
    this.half = !!o.half;
    const geo = this.isHead && this.capA === 'round' && this.capB === 'round' && !o.len
      ? whiteColors(craniumGeo(r).translate(0, this.len / 2, 0))
      : limbGeo(this.len, r, this.capA, this.capB, this.isHead ? 14 : 8, this.half ? Math.PI : Math.PI * 2, this.base);
    this.mesh = new THREE.Mesh(geo, this.isHead ? body.headMat : body.mat);
    this.mesh.castShadow = true;
    if (this.half) {                                   // the cut face of a body split down the middle: flesh with bone up the centre
      const sh = new THREE.Shape(); sh.absarc(0, this.len, r, 0, Math.PI, false); sh.absarc(0, 0, r, Math.PI, Math.PI * 2, false);
      const face = new THREE.Mesh(new THREE.ShapeGeometry(sh, 8).rotateY(-Math.PI / 2), HALF_FLESH); this.mesh.add(face);
      const bone = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.35, this.len + r).rotateY(-Math.PI / 2).translate(-0.001, this.len / 2, r * 0.45), HALF_BONE); this.mesh.add(bone);
    }
    this.dir = _v.subVectors(b.p, a.p).normalize().clone();
    if (o.q) this.mesh.quaternion.copy(o.q); else this.mesh.quaternion.setFromUnitVectors(UP, this.dir);
    body.group.add(this.mesh);
    if (this.ball) {
      this.ballMesh = new THREE.Mesh(tint(new THREE.SphereGeometry(this.ball, 8, 6), this.ballBase), body.mat);
      this.ballMesh.castShadow = true;
      body.group.add(this.ballMesh);
    }
    this.squash = 1;
    this.update();
  }
  update() {
    const d = _v.subVectors(this.b.p, this.a.p), L = d.length();
    if (L < 1e-5) return;
    d.divideScalar(L);
    const P = this.body.P;
    if ((this.isHead || this.kind === 'torso') && !this.half && !P[LS].gone && P[LS].cc === this.a.cc && P[RS].cc === this.a.cc) {
      const side = _w.subVectors(P[LS].p, P[RS].p);
      const fwd = _u.crossVectors(side, d).normalize();            // body forward
      const z = fwd.negate(), x = side.crossVectors(d, z).normalize();
      _m4.makeBasis(x, d, z.crossVectors(x, d));
      this.mesh.quaternion.setFromRotationMatrix(_m4);
    } else {
      _q.setFromUnitVectors(this.dir, d);
      this.mesh.quaternion.premultiply(_q).normalize();
    }
    this.dir.copy(d);
    this.mesh.position.copy(this.a.p);
    const sq = this.squash;
    this.mesh.scale.set(sq === 1 ? 1 : 1 + (1 - sq) * 0.9, L / this.len * sq, sq === 1 ? 1 : 1 + (1 - sq) * 0.9);
    if (this.ballMesh) this.ballMesh.position.copy(this.b.p);
  }
  point(t, out) { return out.copy(this.a.p).lerp(this.b.p, t); }
  // splash body-local vertex colours red around a world point
  paint(pt, rad, k = 0.85, colour) {
    const c0 = colour || this.body.bloodRGB();
    paintMesh(this.mesh, pt, rad, k, c0);
    if (!colour) for (const c of this.mesh.children) if (c.userData.cloth) paintMesh(c, pt, rad, k, c0);
  }
  _unused(pt, rad, k) {
    const m = this.mesh; m.updateMatrixWorld();
    const lp = _w.copy(pt); m.worldToLocal(lp);
    const pos = m.geometry.attributes.position, col = m.geometry.attributes.color, bc = this.body.g.gore ? this.body.bloodRGB() : FLESH;
    let any = false;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - lp.x, dy = (pos.getY(i) - lp.y) * m.scale.y, dz = pos.getZ(i) - lp.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > rad) continue;
      const w = k * (1 - d / rad) * (0.6 + Math.random() * 0.4);
      col.setXYZ(i, col.getX(i) + (bc[0] - col.getX(i)) * w, col.getY(i) + (bc[1] - col.getY(i)) * w, col.getZ(i) + (bc[2] - col.getZ(i)) * w);
      any = true;
    }
    if (any) col.needsUpdate = true;
  }
  remove() {
    this.stick.on = false;
    this.body.group.remove(this.mesh); this.mesh.geometry.dispose();
    if (this.ballMesh) this.body.group.remove(this.ballMesh);
    this.gone = true;
  }
}

let BODY_ID = 1;

export class Body {
  constructor(game, pos, yaw, opts = {}) {
    this.g = game; this.id = BODY_ID++;
    this.zombie = !!opts.zombie;
    this.size = opts.size || 1;
    this.kind = opts.kind || 'grunt';
    this.outfit = opts.outfit || (this.kind === 'soldier' ? SOLDIER : OUTFITS[(Math.random() * OUTFITS.length) | 0]);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.skinHex = opts.skin || SKINS[(Math.random() * SKINS.length) | 0];
    this.headMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: this.zombie ? ZOMBIE_SKIN : this.skinHex });
    this.skinMat = new THREE.MeshLambertMaterial({ color: this.zombie ? ZOMBIE_SKIN : this.skinHex });
    this.sockMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.zombie ? ZOMBIE_SKIN : this.skinHex).multiplyScalar(0.62) });
    this.armor = { helmet: this.outfit.hat === 'helmet', vest: !!this.outfit.vest };
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.sticks = []; this.bones = []; this.caps = [];
    const c = Math.cos(yaw), s = Math.sin(yaw), S = this.size;
    this.P = REST.map((r, i) => {
      const lx = r[0] * S, lz = r[2] * S;
      const p = new Particle(new V3(pos.x + lx * c + lz * s, pos.y + r[1] * S, pos.z - lx * s + lz * c), PR[i] * S, PM[i] * S * S);
      p.body = this; p.j = i;
      game.phys.add(p);
      return p;
    });
    this.parts = this.P.slice();
    const O = this.outfit, skin = rgb(this.zombie ? ZOMBIE_SKIN : this.skinHex), col = { s: rgb(O.shirt), p: rgb(O.pants), k: skin, l: O.long ? rgb(O.shirt) : skin, f: rgb('#26262a') };
    BONES.forEach(([a, b, r, kind, ball], i) => {
      const thick = WEAR[i] === 'l' && O.long ? 1.25 : 1;
      this.bones.push(new Bone(this, this.P[a], this.P[b], r * S * thick, kind, { ball: ball ? ball * S : 0, base: col[WEAR[i]], ballBase: col[BALL_WEAR[i]] || skin, ...(kind === 'head' ? { base: [1, 1, 1] } : {}) }));
    });
    this.dress();
    this.buildFace();
    if (opts.gun) { this.gun = true; this.gunMesh = MODELS.m16(); this.gunMesh.traverse(m => { if (m.isMesh) m.castShadow = true; }); this.group.add(this.gunMesh); }
    for (const [a, b, k] of STRUCT) this.sticks.push(game.phys.link(this.P[a], this.P[b], undefined, k ?? 1));
    for (const [a, b, m] of MINS) this.sticks.push(game.phys.link(this.P[a], this.P[b], m * S, 0.5, true));
    this.root = { x: pos.x, y: pos.y, z: pos.z, yaw };
    this.tgt = REST.map(() => new V3());
    this.state = 'walk'; this.alive = true;
    this.hp = opts.hp || 100; this.blood = 100;
    this.str = 1; this.stun = 0; this.phase = Math.random() * 6; this.moveAmt = 0;
    this.speed = (opts.speed || 1.5) * (this.zombie ? 0.55 : 1);
    this.atkT = 0; this.hitDone = false; this.downT = 0; this.deadT = 0;
    this.headGone = false; this.legBroken = false; this.legsOk = true;
    this.lastHit = 0; this.grabbed = 0; this.voiceT = 2 + Math.random() * 4;
    this.still = 0;
    // blob shadow
    this.shadow = new THREE.Mesh(game.shadowGeo, game.shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    game.scene.add(this.shadow);
    this.components();
  }

  bloodRGB() {
    const c = new THREE.Color(this.g.gore.col(0));
    return [c.r * 1.4, c.g * 1.4, c.b * 1.4];
  }

  // ---------- topology ----------
  components() {
    const par = new Map();
    const find = (p) => { let r = p; while (par.get(r) !== r) r = par.get(r); let q = p; while (par.get(q) !== r) { const n = par.get(q); par.set(q, r); q = n; } return r; };
    for (const p of this.parts) par.set(p, p);
    for (const s of this.sticks) if (s.on && !s.min && par.has(s.a) && par.has(s.b)) { const a = find(s.a), b = find(s.b); if (a !== b) par.set(a, b); }
    for (const p of this.parts) p.cc = find(p);
  }
  check() {
    this.components();
    const P = this.P, core = P[CHEST].cc;
    const headOn = !this.headGone && P[CROWN].cc === core && P[NECK].cc === core;
    this.legsOk = !this.legBroken && [LK, LF, RK, RF, PELVIS].every(j => P[j].cc === core);
    if (!this.alive) return;
    if (!headOn) return this.kill('head');
    if (!this.zombie && P[PELVIS].cc !== core) return this.kill('halved');
    if (!this.legsOk && this.state !== 'crawl' && this.state !== 'down') this.fall(1.2);
  }

  // ---------- damage ----------
  hurt(dmg, stun = 0.5) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.stun = Math.min(1, this.stun + stun);
    if (this.hp <= 0) this.kill('beaten');
    else if (stun > 0.8 && this.state !== 'crawl') this.fall(1 + Math.random());
  }
  fall(t) { if (!this.alive) return; this.letGo(); this.state = 'down'; this.downT = t; }
  kill(how) {
    if (!this.alive) return;
    this.letGo();
    this.alive = false; this.state = 'dead'; this.deadT = 0; this.reanimAt = 2.5 + Math.random() * 2;
    if (!this.headGone && how !== 'head' && how !== 'bled') this.g.sfx.play('gurgle', this.P[NECK].p, 0.7);
    if (this.gun) this.g.dropGun(this);
    for (const p of this.parts) p.ds = 0;
    this.g.onKill(this, how);
  }
  wake() { if (this.asleep) { for (const p of this.parts) p.sleep = false; this.asleep = false; } this.still = 0; }

  // cut bone at t across plane normal n. mode 'slice' | 'break' (compound fracture: stays hinged, bone pokes out)
  cut(bone, t, n, mode = 'slice') {
    if (bone.gone || bone.len < 0.07) return false;
    this.wake();
    t = Math.min(0.85, Math.max(0.15, t));
    const g = this.g, a = bone.a, b = bone.b;
    const C = bone.point(t, new V3());
    const va = a.vel(new V3()), vb = b.vel(new V3()), vc = va.lerp(vb, t);
    const mk = () => { const p = new Particle(C, Math.min(bone.r, 0.05), 0.7); p.body = this; p.place(C, vc); g.phys.add(p); this.parts.push(p); return p; };
    const m1 = mk(), m2 = mk();
    const L = bone.len, q = bone.mesh.quaternion.clone();
    const decals = bone.mesh.children.slice();
    bone.remove();
    this.bones.splice(this.bones.indexOf(bone), 1);
    const A = new Bone(this, a, m1, bone.r, bone.kind, { len: t * L, capA: bone.capA, capB: 'cut', q, base: bone.base });
    const B = new Bone(this, m2, b, bone.r, bone.kind, { len: (1 - t) * L, capA: 'cut', capB: bone.capB, ball: bone.ball, q, base: bone.base, ballBase: bone.ballBase });
    A.squash = B.squash = bone.squash;
    const c = t * L;
    for (const d of decals) {
      if (d.userData.cloth) {
        const y0 = d.position.y, y1 = y0 + d.scale.y;
        if (y1 <= c) A.mesh.add(d);
        else if (y0 >= c) { d.position.y -= c; B.mesh.add(d); }
        else {
          const lo = d.clone(); lo.material = d.material; lo.userData = d.userData;
          d.scale.y = c - y0; A.mesh.add(d);
          lo.position.y = 0; lo.scale.y = y1 - c; B.mesh.add(lo);
        }
      } else if (d.position.y < c) A.mesh.add(d); else { d.position.y -= c; B.mesh.add(d); }
    }
    this.bones.push(A, B);
    const dir = _u.subVectors(b.p, a.p).normalize().clone();
    if (mode === 'break') {
      this.sticks.push(g.phys.link(m1, m2, 0, 1));
      const shard = new THREE.Mesh(g.shardGeo, g.boneMat);
      shard.position.set(bone.r * 0.3, t * L - 0.005, 0);
      shard.rotation.z = -0.5;
      A.mesh.add(shard);
      if (bone.kind === 'leg') this.legBroken = true;
    } else {
      // struts crossing the cut plane near the cut go too
      const R = bone.kind === 'torso' ? 0.34 : (bone.kind === 'neck' || bone.kind === 'head') ? 0.22 : bone.kind === 'hip' || bone.kind === 'clav' ? 0.12 : 0;
      if (R > 0) this.sever(C, n, R, bone.stick);
      this.caps.push({ bone: A, end: 1, bleed: 1 }, { bone: B, end: 0, bleed: 1 });
      if (bone.kind === 'head' || bone.kind === 'neck') this.headCut = true;
      // what's inside shows at the cut: ribs + lungs in the chest, guts low down, brain in the skull
      if (bone.kind === 'torso') { addInnards(A, A.len, bone.b === this.P[PELVIS]); addInnards(B, 0, bone.b === this.P[PELVIS]); if (bone.b === this.P[PELVIS]) this.g.spillGuts(C, va); }
      if (bone.kind === 'head') { addBrain(A, A.len, bone.r); addBrain(B, 0, bone.r); }
    }
    A.paint(C, bone.r * 2.5, 0.6); B.paint(C, bone.r * 2.5, 0.6);
    this.check();
    g.onDismember(this, bone, C, mode);
    return true;
  }
  sever(C, n, R, except) {
    const d = (p) => _v.subVectors(p, C).dot(n);
    for (const s of this.sticks) {
      if (!s.on || s === except) continue;
      if (this.bones.some(b => b.stick === s)) continue;
      const da = d(s.a.p), db = d(s.b.p);
      if (da * db >= 0) continue;
      // crossing point must be near the cut
      const t = da / (da - db);
      _w.copy(s.a.p).lerp(s.b.p, t);
      if (_w.distanceTo(C) < R) s.on = false;
    }
  }
  headBone() { return this.bones.find(b => b.kind === 'head' && b.b === this.P[CROWN]); }

  // blade went down the length of the skull
  splitHead(n) {
    const hb = this.headBone(); if (!hb || this.headGone) return false;
    this.wake();
    const g = this.g, a = hb.a, b = hb.b;
    const axis = new V3().subVectors(b.p, a.p).normalize();
    const nn = n.clone().addScaledVector(axis, -n.dot(axis)).normalize();
    const vel = b.vel(new V3());
    hb.remove(); this.bones.splice(this.bones.indexOf(hb), 1);
    for (const s of this.sticks) if (s.a === b || s.b === b) s.on = false;
    b.gone = true; this.headGone = true;
    for (const side of [1, -1]) {
      const x = nn.clone().multiplyScalar(side);
      const m = g.makeHeadHalf(hb.len, hb.r, this.mat);
      g.gore.chunk(m, { o: a.p.clone().addScaledVector(x, 0.004), x, y: axis.clone() }, vel.clone().addScaledVector(x, 1.6).add(new V3(0, 0.8, 0)), 3);
    }
    // neck stump gets a raw top
    const nb = this.bones.find(bb => bb.kind === 'neck' && bb.b === a);
    if (nb) this.recap(nb, 'b');
    g.brains(a.p, vel, 3);
    this.check();
    return true;
  }
  crushHead(dir) {
    const hb = this.headBone(); if (!hb || this.headGone) return false;
    this.wake();
    this.headGone = true;
    hb.squash = 0.45;
    hb.stick.len *= 0.55; hb.len *= 1;
    const c = hb.point(0.6, new V3());
    hb.paint(c, 0.3, 1);
    this.g.skullBits(c, dir, hb.r);
    this.check();
    return true;
  }
  recap(bone, end) {
    const geo = limbGeo(bone.len, bone.r, end === 'a' ? 'cut' : bone.capA, end === 'b' ? 'cut' : bone.capB, 8, Math.PI * 2, bone.base);
    bone.mesh.geometry.dispose(); bone.mesh.geometry = geo;
    if (end === 'a') bone.capA = 'cut'; else bone.capB = 'cut';
    this.caps.push({ bone, end: end === 'a' ? 0 : 1, bleed: 1 });
  }

  // ---------- AI + muscles ----------
  think(dt) {
    const g = this.g, P = this.P;
    this.bleed(dt);
    this.stun = Math.max(0, this.stun - dt * 1.3);
    if (!this.alive) { this.deadThink(dt); return; }
    if (!this.zombie && this.blood < 30) { this.kill('bled'); return; }
    const core = P[CHEST].cc;
    const pel = (P[PELVIS].cc === core ? P[PELVIS] : P[CHEST]).p;
    const head = g.player.head;
    const R = this.root;
    const dx = head.x - R.x, dz = head.z - R.z, dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let dy = want - R.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    const turn = (rate) => { R.yaw += Math.max(-rate * dt, Math.min(rate * dt, dy)); };
    let K = 0.2;
    this.voiceT -= dt;
    if (this.voiceT < 0) { this.voiceT = 4 + Math.random() * 6; if (this.zombie) g.sfx.play('groan', P[NECK].p, 0.6); }

    switch (this.state) {
      case 'walk': case 'attack': {
        const headY = (this.headGone ? P[NECK] : P[CROWN]).p.y - R.y;
        const pt = this.lastPelT;
        if (headY < 1.05 * this.size || (pt && Math.hypot(pel.x - pt.x, pel.z - pt.z) > 0.5)) { this.fall(1.2 + Math.random()); break; }
        // steer around walls: probe ahead at waist height, veer toward the clearer side
        if (this.state === 'walk' && dist > 1.5) {
          this.probeT = (this.probeT || 0) - dt;
          if (this.probeT <= 0) {
            this.probeT = 0.25;
            const o = _w.set(R.x, R.y + 0.7, R.z);
            const probe = (a) => { const h = g.phys.ray(o, _u.set(Math.sin(a), 0, Math.cos(a)), 1.6, true); return h ? h.t : 1.6; };
            const ahead = probe(want);
            if (ahead < Math.min(1.5, dist)) {
              let best = want, bt = 0;
              for (const off of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) { const t = probe(want + off); if (t > bt + 0.05) { bt = t; best = want + off; } }
              this.detour = best; this.detourT = 0.9;
            }
          }
          if (this.detourT > 0) { this.detourT -= dt; dy = this.detour - R.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; }
        }
        turn(this.state === 'attack' ? 6 : 3.5);
        if (this.gun && this.P[RH].cc === core) {
          this.gunT = (this.gunT || 1.5) - dt;
          const los = dist < 13 && this.g.losTo(this.P[NECK].p, head);
          this.aiming = los && dist > 2.2;
          if (this.aiming) {
            this.moveAmt *= 1 - Math.min(1, dt * 6);
            if (this.gunT <= 0 && Math.abs(dy) < 0.25) { this.burst = 3; this.gunT = 1.6 + Math.random() * 1.2; }
            if (this.burst > 0 && (this.burstT = (this.burstT || 0) - dt) <= 0) { this.burst--; this.burstT = 0.1; this.g.enemyShoot(this); }
            break;
          }
        }
        if (this.state === 'walk') {
          const go = dist > 0.75 ? 1 : 0;
          this.moveAmt += (go - this.moveAmt) * Math.min(1, dt * 5);
          const sp = this.speed * this.moveAmt * (1 - this.stun * 0.8);
          R.x += Math.sin(R.yaw) * sp * dt; R.z += Math.cos(R.yaw) * sp * dt;
          this.phase += dt * (this.zombie ? 5 : 7.5) * this.moveAmt;
          if (dist < 0.9 && Math.abs(head.y - (R.y + 1.6)) < 1.2) { this.state = 'attack'; this.atkT = 0; this.hitDone = false; }
        } else {
          this.moveAmt *= 1 - Math.min(1, dt * 6);
          const PL = g.player;
          if (this.grabbing) { this.holdOn(dt, core); break; }
          if (this.atkT < dt * 1.5 && !this.gun && !PL.grabbedBy && dist < 0.85 && Math.random() < (this.zombie ? 0.5 : 0.3) && P[LH].cc === core) {
            const hands = PL.H.filter(h => !PL.vr || h.src);
            const hand = hands.reduce((a, h) => !a || h.pos.distanceTo(P[NECK].p) < a.pos.distanceTo(P[NECK].p) ? h : a, null);
            if (hand) { this.grabbing = { hand, t: 0, hitT: 0.8, shake: 0 }; PL.grabbedBy = this; g.sfx.play('punch', hand.pos, 0.5, 1.5); break; }
          }
          this.atkT += dt;
          const T = this.zombie ? 1.2 : 0.95;
          if (!this.hitDone && this.atkT > T * 0.45 && this.atkT < T * 0.65) {
            const hand = this.zombie ? P[LH] : P[RH];
            if (hand.cc === core && hand.p.distanceTo(head) < 0.32 * this.size + 0.1) {
              this.hitDone = true;
              g.player.damage(this.zombie ? 12 : 9, hand.p);
            }
          }
          if (this.atkT > T) { this.atkT = 0; this.hitDone = false; if (dist > 1.15) this.state = 'walk'; }
        }
        break;
      }
      case 'idle':                                  // shopkeepers: stand, breathe, watch you
        turn(1.2);
        this.moveAmt *= 0.9;
        break;
      case 'down':
        K = 0;
        this.downT -= dt;
        if (this.downT <= 0) {
          if (this.legsOk) { this.state = 'getup'; this.str = 0; R.x = pel.x; R.z = pel.z; }
          else if (this.zombie) { this.state = 'crawl'; this.str = 0.2; R.x = pel.x; R.z = pel.z; R.yaw = want; }
          else { this.downT = 1; this.writhe(); }
        }
        break;
      case 'getup':
        this.str += dt * 0.8;
        turn(2);
        if (this.str >= 1) { this.str = 1; this.state = 'walk'; }
        break;
      case 'crawl': {
        K = 0.12;
        turn(2);
        this.str = Math.min(1, this.str + dt);
        const sp = dist > 0.6 ? 0.42 : 0;
        R.x += Math.sin(R.yaw) * sp * dt; R.z += Math.cos(R.yaw) * sp * dt;
        this.phase += dt * 3.2;
        if (dist < 0.7 && head.y - R.y < 2) { this.atkT += dt; if (this.atkT > 0.9) { this.atkT = 0; g.player.damage(6, P[NECK].p); } }
        const cy = P[CHEST].p.y - R.y;
        if (cy > 0.9) { this.fall(0.6); }
        break;
      }
    }
    // body was shoved: let the walking root follow the real pelvis
    if (this.lastPelT && this.state !== 'down') { R.x += (pel.x - this.lastPelT.x) * 0.12; R.z += (pel.z - this.lastPelT.z) * 0.12; }
    // ground / ledges
    const gy = g.phys.groundAt(R.x, R.z, R.y + 0.5);
    if (gy < R.y - 0.6 && this.state !== 'down') { this.fall(1.5); }
    if (this.state !== 'down') R.y += (Math.max(gy, -60) - R.y) * Math.min(1, dt * 12);
    else R.y = Math.max(gy, -60);

    // muscles
    this.pose();
    const str = this.str * (1 - 0.85 * this.stun) * (this.grabbed ? 0.25 : 1);
    const c = Math.cos(R.yaw), s = Math.sin(R.yaw), S = this.size;
    for (let i = 0; i < 17; i++) {
      const p = P[i];
      if (p.gone) continue;
      if (p.cc !== core || K === 0) { p.ds = 0; continue; }
      const l = this.tgt[i];
      p.drive.set(R.x + (l.x * c + l.z * s) * S, R.y + l.y * S, R.z + (-l.x * s + l.z * c) * S);
      p.ds = K * PS[i] * str;
    }
    if (this.grabbing && P[LH].cc === core) {           // the grabbing hand clamps onto yours; zombies lean in to bite
      P[LH].drive.copy(this.grabbing.hand.pos); P[LH].ds = 0.5;
      if (this.zombie) { P[CROWN].drive.lerp(g.player.head, 0.6); P[NECK].drive.lerp(g.player.head, 0.3); }
    }
    this.lastPelT = (this.lastPelT || new V3()).copy(P[PELVIS].drive);
    if (P[PELVIS].cc !== core) this.lastPelT.copy(P[CHEST].drive);
  }
  writhe() {
    for (const p of this.parts) if (!p.gone && Math.random() < 0.4) p.addVel(_v.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(1.6));
  }
  deadThink(dt) {
    this.deadT += dt;
    if (this.deadT < 1.6 && Math.random() < dt * 9) {      // death throes
      const p = this.parts[(Math.random() * this.parts.length) | 0];
      if (!p.gone) p.addVel(_v.set(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).multiplyScalar(1.4));
    }
    if (this.g.infected && !this.zombie && !this.headGone && this.deadT > this.reanimAt) {
      const P = this.P;
      if (P[CROWN].cc === P[CHEST].cc && P[NECK].cc === P[CHEST].cc) this.reanimate();
      else this.reanimAt = Infinity;
    }
    // sleep when settled
    if (this.deadT > 3 && !this.asleep) {
      let mv = 0;
      for (const p of this.parts) if (!p.gone) mv = Math.max(mv, p.p.distanceToSquared(p.o));
      this.still = mv < 2e-8 ? this.still + 1 : 0;
      if (this.still > 50 && !this.caps.some(c => c.bleed > 0.2)) { for (const p of this.parts) p.sleep = true; this.asleep = true; }
    }
  }
  reanimate() {
    this.wake();
    this.zombie = true; this.alive = true; this.hp = 80; this.blood = 100;
    this.speed *= 0.55;
    this.mat.color.set('#b9d0a8'); this.headMat.color.set(ZOMBIE_SKIN); this.skinMat.color.set(ZOMBIE_SKIN); if (this.face) { this.face.eyeMat = EYE_Z; for (const e of this.face.eyes) e.ball.material = EYE_Z; }
    this.state = 'down'; this.downT = 0.4;
    this.check();
    this.g.sfx.play('groan', this.P[NECK].p, 1);
  }

  pose() {
    const L = this.tgt, P = this.P;
    for (let i = 0; i < 17; i++) L[i].set(REST[i][0], REST[i][1], REST[i][2]);
    if (this.state === 'crawl') {
      const c = this.phase, a = Math.sin(c);
      const set = (j, x, y, z) => L[j].set(x, y, z);
      set(CROWN, 0, 0.28, 0.8); set(NECK, 0, 0.2, 0.54); set(CHEST, 0, 0.17, 0.4); set(BELLY, 0, 0.14, 0.16); set(PELVIS, 0, 0.13, -0.05);
      set(LS, 0.19, 0.18, 0.44); set(RS, -0.19, 0.18, 0.44);
      set(LE, 0.3, 0.14 + Math.max(0, Math.cos(c)) * 0.08, 0.5 + a * 0.1); set(LH, 0.3, 0.06 + Math.max(0, Math.cos(c)) * 0.14, 0.66 + a * 0.24);
      set(RE, -0.3, 0.14 + Math.max(0, -Math.cos(c)) * 0.08, 0.5 - a * 0.1); set(RH, -0.3, 0.06 + Math.max(0, -Math.cos(c)) * 0.14, 0.66 - a * 0.24);
      set(LHIP, 0.1, 0.13, -0.08); set(LK, 0.12, 0.09, -0.5); set(LF, 0.13, 0.07, -0.9);
      set(RHIP, -0.1, 0.13, -0.08); set(RK, -0.12, 0.09, -0.5); set(RF, -0.13, 0.07, -0.9);
      // drag the body along toward the hands
      for (const j of [CROWN, NECK, CHEST, BELLY, PELVIS, LS, RS, LHIP, RHIP]) L[j].z += Math.abs(a) * 0.04;
      return;
    }
    const w = this.moveAmt, ph = this.phase, sw = Math.sin(ph), cw = Math.cos(ph);
    L[LK].z += sw * 0.14 * w; L[LF].z += sw * 0.3 * w; L[LF].y += Math.max(0, cw) * 0.14 * w; L[LK].y += Math.max(0, cw) * 0.05 * w;
    L[RK].z -= sw * 0.14 * w; L[RF].z -= sw * 0.3 * w; L[RF].y += Math.max(0, -cw) * 0.14 * w; L[RK].y += Math.max(0, -cw) * 0.05 * w;
    const bob = Math.abs(cw) * 0.03 * w - 0.02 * w;
    for (const j of [CROWN, NECK, CHEST, BELLY, PELVIS, LS, RS, LE, RE, LH, RH, LHIP, RHIP]) L[j].y += bob;
    for (const j of [CROWN, NECK, CHEST, LS, RS]) L[j].z += 0.06 * w;
    if (this.zombie) {
      L[LE].set(0.21, 1.36, 0.24); L[LH].set(0.2, 1.36, 0.55); L[RE].set(-0.21, 1.36, 0.24); L[RH].set(-0.2, 1.36, 0.55);
      L[CROWN].z += 0.1; L[NECK].z += 0.06; L[LH].y += Math.sin(ph * 0.5) * 0.05; L[RH].y -= Math.sin(ph * 0.5) * 0.05;
    } else {
      L[LE].z -= sw * 0.1 * w; L[LH].z -= sw * 0.22 * w; L[RE].z += sw * 0.1 * w; L[RH].z += sw * 0.22 * w;
      // guard up only when squaring up to you
      if (this.state === 'attack') {
        L[LE].set(0.25, 1.2, 0.12); L[LH].set(0.14, 1.42, 0.28);
        L[RE].set(-0.25, 1.2, 0.08); L[RH].set(-0.15, 1.4, 0.24);
      }
    }
    if (this.gun && this.aiming) {                      // shouldered rifle, pointed at you
      L[RE].set(-0.2, 1.22, 0.16); L[RH].set(-0.1, 1.34, 0.3); L[LE].set(0.14, 1.24, 0.34); L[LH].set(0.0, 1.36, 0.6);
      for (const j of [CROWN, NECK]) L[j].x -= 0.04;
    }
    if (this.state === 'attack') {
      const T = this.zombie ? 1.2 : 0.95, u = this.atkT / T;
      // target: player's head in our local frame
      const R = this.root, h = this.g.player.head, c = Math.cos(R.yaw), s = Math.sin(R.yaw), S = this.size;
      const wx = (h.x - R.x) / S, wz = (h.z - R.z) / S, ly = Math.min(1.75, Math.max(1.0, (h.y - R.y) / S - 0.05));
      const lx = wx * c - wz * s, lz = wx * s + wz * c;
      const tgt = new V3(lx, ly, Math.min(0.85, lz));
      const hand = this.zombie ? [LE, LH] : [RE, RH];
      if (u < 0.45) {                                  // wind up
        const k = u / 0.45;
        L[hand[0]].set(this.zombie ? 0.3 : -0.32, 1.28, -0.1 * k); L[hand[1]].set(this.zombie ? 0.3 : -0.3, 1.42 + 0.08 * k, -0.12 * k);
        for (const j of [CROWN, NECK, CHEST, LS, RS]) L[j].z -= 0.06 * k;
      } else if (u < 0.65) {                           // strike
        L[hand[1]].copy(tgt); L[hand[0]].lerpVectors(L[this.zombie ? LS : RS], tgt, 0.5); L[hand[0]].y += 0.05;
        for (const j of [CROWN, NECK, CHEST, LS, RS]) L[j].z += 0.12;
        if (this.zombie) { L[RH].copy(tgt).x -= 0.15; }
      }
    }
  }

  bleed(dt) {
    const g = this.g;
    for (const c of this.caps) {
      if (c.bleed <= 0 || c.bone.gone) continue;
      c.bleed -= dt * (this.alive ? 0.06 : 0.1);
      const p = c.end ? c.bone.b : c.bone.a, q = c.end ? c.bone.a : c.bone.b;
      if (p.gone) { c.bleed = 0; continue; }
      const dir = _v.subVectors(p.p, q.p).normalize();
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012 + c.bone.len * 40);
      if (Math.random() < dt * 40 * c.bleed) {
        const v = p.vel(_w).multiplyScalar(0.5).addScaledVector(dir, (0.6 + 2.6 * pulse) * c.bleed * (this.alive ? 1.3 : 0.7));
        g.gore.emit(_u.copy(p.p).addScaledVector(dir, c.bone.r), v, 1, 0.4, 1 + c.bleed);
      }
      if (this.alive && p.cc === this.P[CHEST].cc) this.blood -= dt * c.bleed * 5;
      if (p.p.y < (this.root.y + 0.25) && Math.random() < dt * 3 * c.bleed) g.gore.pool(p.p, 0.05 + 0.1 * c.bleed);
    }
  }

  render() {
    this.animFace();
    if (this.gunMesh) {                                 // the rifle rides the right hand, pointed through the left
      const rh = this.P[RH].p, lh = this.P[LH].p;
      this.gunMesh.position.copy(rh);
      const dir = _v.subVectors(lh, rh);
      if (dir.lengthSq() < 0.01 || this.P[LH].cc !== this.P[RH].cc) dir.set(Math.sin(this.root.yaw), 0, Math.cos(this.root.yaw));
      this.gunMesh.quaternion.setFromUnitVectors(_w.set(0, 0, -1), dir.normalize());
    }
    for (const b of this.bones) b.update();
    const P = this.P, pel = P[PELVIS].gone ? P[CHEST] : P[PELVIS];
    const gy = this.g.phys.groundAt(pel.p.x, pel.p.z, pel.p.y);
    const h = Math.max(0.1, pel.p.y - gy);
    this.shadow.position.set(pel.p.x, gy + 0.012, pel.p.z);
    const sc = Math.max(0.2, 0.55 - h * 0.15) * this.size;
    this.shadow.scale.set(sc, sc, sc);
    this.shadow.visible = gy > -50 && !this.g.realShadows;
  }
  center() { return this.P[CHEST].p; }
  dispose() {
    this.g.scene.remove(this.group); this.g.scene.remove(this.shadow);
    for (const b of this.bones) b.mesh.geometry.dispose();
    for (const p of this.parts) p.gone = true;
    for (const s of this.sticks) s.on = false;
    this.mat.dispose(); this.headMat.dispose();
  }
}

function rgb(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }

// simple painted faces: dot eyes, a mouth. u wraps around the head, the face sits at u = 0.5 (local -Z)
const FACES = {};
function faceTexture(skin, zombie) {
  const key = skin + (zombie ? 'z' : 'h');
  const pool = FACES[key] || (FACES[key] = []);
  if (pool.length >= 8) return pool[(Math.random() * pool.length) | 0];
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = skin; c.fillRect(0, 0, 512, 256);
  const cx = 384, ink = '#111';
  // big round eyes, white with a dark rim and small pupils (they stare)
  const ey = 108 + Math.random() * 6, gap = 24 + Math.random() * 3, er = 17 + Math.random() * 3;
  const look = [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6];
  for (const sx of [-1, 1]) {
    c.fillStyle = zombie ? '#e9e4b8' : '#fbfbf8'; c.strokeStyle = ink; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(cx + sx * gap, ey, er, er * 1.08, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = zombie ? '#7a1010' : ink;
    c.beginPath(); c.arc(cx + sx * gap + look[0], ey + look[1], zombie ? 3 : 4, 0, 7); c.fill();
  }
  // brows sometimes
  if (Math.random() < 0.5) { c.strokeStyle = ink; c.lineWidth = 3; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(cx + sx * (gap - 12), ey - er - 6 + (zombie ? 4 : 0)); c.lineTo(cx + sx * (gap + 12), ey - er - 9); c.stroke(); } }
  // mouth: gritted teeth, a flat line, or a gape
  const my = 150 + Math.random() * 6, mw = 13 + Math.random() * 7, kind = zombie ? 2 : (Math.random() * 3) | 0;
  c.strokeStyle = ink; c.lineWidth = 2.5;
  if (kind === 0) {
    c.fillStyle = '#f4f1e6'; c.beginPath(); c.rect(cx - mw, my - 6, mw * 2, 12); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(cx - mw, my); c.lineTo(cx + mw, my); for (let x = -mw + 6; x < mw; x += 6) { c.moveTo(cx + x, my - 6); c.lineTo(cx + x, my + 6); } c.stroke();
  } else if (kind === 1) {
    c.beginPath(); c.moveTo(cx - mw, my + 3); c.quadraticCurveTo(cx, my - 4, cx + mw, my + 2); c.stroke();
  } else {
    c.fillStyle = '#2a0d0d'; c.beginPath(); c.ellipse(cx, my + 2, mw * 0.6, 10 + Math.random() * 5, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#f4f1e6'; c.fillRect(cx - mw * 0.45, my - 6, mw * 0.9, 4);
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  pool.push(tex);
  return tex;
}
function paintMesh(m, pt, rad, k, bc) {
  m.updateMatrixWorld();
  const lp = new V3().copy(pt); m.worldToLocal(lp);
  const pos = m.geometry.attributes.position, col = m.geometry.attributes.color;
  if (!col) return;
  const sx = m.scale.x, sy = m.scale.y, sz = m.scale.z;
  let any = false;
  for (let i = 0; i < pos.count; i++) {
    const dx = (pos.getX(i) - lp.x) * sx, dy = (pos.getY(i) - lp.y) * sy, dz = (pos.getZ(i) - lp.z) * sz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > rad) continue;
    const w = k * (1 - d / rad) * (0.6 + Math.random() * 0.4);
    col.setXYZ(i, col.getX(i) + (bc[0] - col.getX(i)) * w, col.getY(i) + (bc[1] - col.getY(i)) * w, col.getZ(i) + (bc[2] - col.getZ(i)) * w);
    any = true;
  }
  if (any) col.needsUpdate = true;
}
// soft elliptical tube of cloth (unit height along +Y, x = shoulder line, z = chest depth)
function clothOval(w0, w1, d0, d1, colour, paint) {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 8, true).translate(0, 0.5, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (w0 + (w1 - w0) * y)); p.setZ(i, p.getZ(i) * (d0 + (d1 - d0) * y)); }
  g.computeVertexNormals();
  tint(g, rgb(colour));
  let geo = g;
  if (paint) {
    // per-triangle colour so panel edges stay crisp
    geo = g.toNonIndexed(); geo.computeVertexNormals();
    const q = geo.attributes.position, c = geo.attributes.color;
    for (let i = 0; i < q.count; i += 3) {
      const cx = (q.getX(i) + q.getX(i + 1) + q.getX(i + 2)) / 3, cy = (q.getY(i) + q.getY(i + 1) + q.getY(i + 2)) / 3, cz = (q.getZ(i) + q.getZ(i + 1) + q.getZ(i + 2)) / 3;
      const k = paint(cx, cy, cz);
      if (k) for (let j = 0; j < 3; j++) c.setXYZ(i + j, k[0], k[1], k[2]);
    }
  }
  const m = new THREE.Mesh(geo, CLOTH_MAT); m.userData.cloth = true; m.castShadow = true;
  return m;
}
// tapered box of cloth (unit height along +Y, x = shoulder line, z = chest depth)
function shirtBox(w0, w1, d0, d1, colour, slope = 0) {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 4, 1).translate(0, 0.5, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), w = w0 + (w1 - w0) * y, d = d0 + (d1 - d0) * y, xn = p.getX(i); p.setX(i, xn * w); p.setZ(i, p.getZ(i) * d); if (y < 0.01) p.setY(i, y + Math.abs(xn) * 2 * slope); }
  g.computeVertexNormals();
  tint(g, rgb(colour));
  const m = new THREE.Mesh(g, CLOTH_MAT); m.userData.cloth = true; m.castShadow = true;
  return m;
}
// a loose tube of cloth (unit height, scaled to the bone) that blood can soak into
function clothTube(r0, r1, colour, seg = 12) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, seg, 3, true).translate(0, 0.5, 0);
  tint(g, rgb(colour));
  const m = new THREE.Mesh(g, CLOTH_MAT);
  m.userData.cloth = true; m.castShadow = true;
  return m;
}
const CLOTH_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
// hats, helmets and vests ride on bones; armour comes off when hit hard enough
const HAT_MATS = {};
function hm(c) { return HAT_MATS[c] || (HAT_MATS[c] = new THREE.MeshLambertMaterial({ color: c })); }
Body.prototype.dress = function () {
  const O = this.outfit, hb = this.headBone(), r = hb.r, S = this.size;
  // soft rounded torso: elliptical tube with domed shoulders, a little narrower than the shoulders' stick width
  const [up, low] = this.bones.filter(b => b.kind === 'torso');
  const top = clothOval(0.29 * S, 0.27 * S, 0.15 * S, 0.16 * S, O.shirt); top.position.y = -0.04 * S; top.scale.y = up.len + 0.04 * S; up.mesh.add(top);
  const dome = new THREE.Mesh(tint(new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), rgb(O.shirt)), CLOTH_MAT);
  dome.scale.set(0.145 * S, 0.075 * S, 0.075 * S); dome.rotation.x = Math.PI; dome.position.y = -0.04 * S; dome.userData.cloth = true; dome.castShadow = true; up.mesh.add(dome);
  const hem = clothOval(0.27 * S, O.coat ? 0.31 * S : 0.31 * S, 0.16 * S, O.coat ? 0.19 * S : 0.18 * S, O.shirt); hem.scale.y = low.len + (O.coat ? 0.36 : 0.12) * S; low.mesh.add(hem);
  for (const b of this.bones) if (b.kind === 'arm' && (b.a === this.P[LS] || b.a === this.P[RS])) {
    const sl = clothTube(O.long ? 0.038 * S : 0.042 * S, O.long ? 0.034 * S : 0.04 * S, O.shirt, 8); sl.position.y = -0.03 * S; sl.scale.y = b.len * (O.long ? 1 : 0.42) + 0.03 * S; b.mesh.add(sl);
    if (O.long) { const fb = this.bones.find(x => x.a === b.b); if (fb) { const s2 = clothTube(0.033 * S, 0.03 * S, O.shirt, 8); s2.scale.y = fb.len * 0.92; fb.mesh.add(s2); } }
  }
  if (O.bib) {
    // dungarees: the bib covers the front of the chest, two straps run up over the shoulders; the lower half is all bib
    const bc = rgb(O.bib);
    up.mesh.remove(top);
    const bibTop = clothOval(0.29 * S, 0.27 * S, 0.15 * S, 0.16 * S, O.shirt, (x, y, z) => {
      const ax = Math.abs(x);
      if (z > 0 && y > 0.22 && ax < 0.1 * S) return bc;                    // bib panel (torso front is +Z)
      if (y <= 0.3 && ax > 0.055 * S && ax < 0.095 * S) return bc;           // straps, front and back
      return null;
    });
    bibTop.position.y = top.position.y; bibTop.scale.y = top.scale.y; up.mesh.add(bibTop);
    low.mesh.remove(hem);
    const lowBib = clothOval(0.27 * S, 0.3 * S, 0.16 * S, 0.18 * S, O.bib); lowBib.scale.y = low.len + 0.1 * S; low.mesh.add(lowBib);
  }
  if (O.stripe) for (const [m, d] of [[top, 0.155], [hem, O.coat ? 0.18 : 0.17]]) if (m) {
    const st = new THREE.Mesh(tint(new THREE.BoxGeometry(0.032 * S, 1, 0.006).translate(0, 0.5, 0), rgb(O.stripe)), CLOTH_MAT);
    st.position.z = (d * S) / 2 + 0.004; st.userData.cloth = true; m.add(st);
  }
  for (const b of this.bones) if (b.kind === 'arm' && (b.a === this.P[LS] || b.a === this.P[RS])) {
    const sl = clothTube(0.048 * S, 0.044 * S, O.shirt, 6); sl.position.y = -0.03 * S; sl.scale.y = b.len * (O.long ? 1 : 0.42) + 0.02 * S; b.mesh.add(sl);
    if (O.long) { const fb = this.bones.find(x => x.a === b.b); if (fb) { const s2 = clothTube(0.034 * S, 0.03 * S, O.shirt, 6); s2.scale.y = fb.len * 0.92; fb.mesh.add(s2); } }
  }
  let hat = null;
  if (O.hat === 'helmet') {
    hat = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 1.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hm(O.hatColor));
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.24, r * 0.18, 12), hm(O.hatColor)); rim.position.y = r * 0.12;
    hat.add(dome, rim); hat.position.y = hb.len / 2 + r * 0.22;
  } else if (O.hat === 'cap') {
    hat = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), hm(O.hatColor));
    const bill = new THREE.Mesh(new THREE.BoxGeometry(r * 1.4, r * 0.08, r * 1.1), hm(O.hatColor)); bill.position.set(0, 0.0, -r * 1.2);
    hat.add(dome, bill); hat.position.y = hb.len / 2 + r * 0.55;
  } else if (O.hat === 'bucket') {
    hat = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 1.1, r * 0.75, 12), hm(O.hatColor)); top.position.y = r * 0.35;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.55, r * 1.6, r * 0.06, 14), hm(O.hatColor));
    hat.add(top, brim); hat.position.y = hb.len / 2 + r * 0.8;
  } else if (O.hat === 'beanie') {
    hat = new THREE.Mesh(new THREE.SphereGeometry(r * 1.07, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.52), hm(O.hatColor));
    hat.position.y = hb.len / 2 + r * 0.5;
  }
  if (hat) { hat.traverse(m => { if (m.isMesh) m.castShadow = true; }); hb.mesh.add(hat); this.hat = hat; this.hatBone = hb; }
  if (O.vest) {
    const tb = this.bones.find(b => b.kind === 'torso');
    const vest = new THREE.Mesh(new THREE.CylinderGeometry(tb.r * 1.45, tb.r * 1.35, tb.len * 1.05, 10), hm('#3d4230'));
    vest.position.y = tb.len * 0.5; vest.castShadow = true;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(tb.r * 1.6, tb.len * 0.8, 0.02), hm('#2f3326')); plate.position.set(0, 0, -tb.r * 1.4);
    vest.add(plate);
    tb.mesh.add(vest); this.vest = vest; this.vestBone = tb;
  }
};
// knock the hat/helmet off as a loose chunk
Body.prototype.loseHat = function (dir) {
  if (!this.hat) return false;
  const hat = this.hat, hb = this.hatBone;
  hat.updateMatrixWorld(true);
  const pos = new V3(), q = new THREE.Quaternion(), sc = new V3();
  hat.matrixWorld.decompose(pos, q, sc);
  hb.mesh.remove(hat);
  const vel = this.P[CROWN].vel(new V3()).addScaledVector(dir, 3).add(new V3(0, 1.5, 0));
  hat.position.set(0, 0, 0); hat.quaternion.identity();
  const holder = new THREE.Group(); holder.add(hat);
  this.g.gore.chunk(holder, { o: pos, x: new V3(1, 0, 0).applyQuaternion(q), y: new V3(0, 1, 0).applyQuaternion(q) }, vel, 4);
  this.hat = null; this.armor.helmet = false;
  this.g.sfx.play('punch', pos, 0.8, 1.6);
  return true;
};

// ---------- faces: real eyeballs that track you, blinking lids, brows, a hinged jaw ----------
function deformHead(v, r) {
  const below = Math.max(0, -v.y / r);
  const k = 1 - 0.2 * below * below - 0.05 * below;
  v.x *= k * 0.86; v.z *= v.z < 0 ? k * 0.95 : k;
  v.y *= v.y > 0 ? 1.42 : 1.3;                           // a tall smooth egg
  return v;
}
function craniumGeo(r, seg = 26, rows = 20, ...range) {
  const g = new THREE.SphereGeometry(r, seg, rows, ...range), p = g.attributes.position, v = new V3();
  for (let i = 0; i < p.count; i++) { deformHead(v.fromBufferAttribute(p, i), r); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  return g;
}
const EYE_W = new THREE.MeshLambertMaterial({ color: 0xfbfbf6 }), EYE_Z = new THREE.MeshLambertMaterial({ color: 0xe6dfae });
const PUPIL = new THREE.MeshBasicMaterial({ color: 0x0b0b0b }), MOUTH = new THREE.MeshBasicMaterial({ color: 0x1c0606 });
const TEETH = new THREE.MeshLambertMaterial({ color: 0xf1ecdc }), BROW = new THREE.MeshLambertMaterial({ color: 0x2a2a2c });
const G_EYE = new THREE.SphereGeometry(1, 16, 12), G_PUP = new THREE.SphereGeometry(1, 10, 8);
const G_LID = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
Body.prototype.buildFace = function () {
  const hb = this.headBone(); if (!hb) return;
  const r = hb.r, f = new THREE.Group();
  f.position.y = hb.len / 2;
  hb.mesh.add(f);
  const eyes = [];
  const er = r * 0.22;
  for (const sx of [-1, 1]) {
    const socket = new THREE.Group(); socket.position.set(sx * r * 0.33, r * 0.32, -r * 0.82); f.add(socket);
    const ring = new THREE.Mesh(G_EYE, this.sockMat); ring.scale.set(er * 1.32, er * 1.32, er * 0.6); ring.position.z = er * 0.25; socket.add(ring);
    const ball = new THREE.Mesh(G_EYE, this.zombie ? EYE_Z : EYE_W); ball.scale.setScalar(er);
    const pivot = new THREE.Group(); socket.add(pivot); pivot.add(ball);
    const pup = new THREE.Mesh(G_PUP, PUPIL); pup.scale.set(er * 0.24, er * 0.24, er * 0.14); pup.position.z = -er * 0.9; pivot.add(pup);
    const lid = new THREE.Mesh(G_LID, this.skinMat); lid.scale.setScalar(er * 1.1); lid.rotation.x = 0.2; socket.add(lid);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(er * 1.7, er * 0.2, er * 0.3), BROW); brow.position.set(0, er * 1.45, -er * 0.35); socket.add(brow);
    brow.visible = false;
    eyes.push({ socket, pivot, ball, lid, brow, sx });
  }
  // mouth: a smooth-edged shell over the lower face is the jaw; it swings down on a hinge.
  // Under it the skull is painted dark (the inside of the mouth), with a row of separate teeth on each side.
  const MY = -r * 0.48, pivot = new V3(0, MY + r * 0.02, r * 0.15);
  const nose = new THREE.Mesh(G_EYE, this.skinMat); nose.scale.set(r * 0.1, r * 0.2, r * 0.12); nose.position.set(0, -r * 0.1, -r * 0.88); nose.rotation.x = -0.25; f.add(nose);
  const yo = MY / 1.3, th0 = Math.acos(Math.max(-1, Math.min(1, yo / r)));
  const jawGeo = whiteColors(craniumGeo(r * 1.05, 24, 10, Math.PI * 1.5 - 0.72, 1.44, th0, Math.PI - 0.3 - th0));
  jawGeo.translate(-pivot.x, -pivot.y, -pivot.z);
  const hinge = new THREE.Group(); hinge.position.copy(pivot); f.add(hinge);
  const jaw = new THREE.Mesh(jawGeo, this.headMat); hinge.add(jaw);
  // darken the skull under the jaw
  const sk = hb.mesh.geometry, sp = sk.attributes.position, sc = sk.attributes.color, hy = hb.len / 2;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i) - hy, z = sp.getZ(i);
    if (z < -r * 0.2 && y < MY - r * 0.02 && y > MY - r * 0.75 && Math.abs(Math.atan2(x, -z)) < 0.62) sc.setXYZ(i, 0.12, 0.03, 0.03);
  }
  sc.needsUpdate = true;
  const pos = sp;
  const front = (yd) => { const v = deformHead(new V3(0, yd / 1.3, -Math.sqrt(Math.max(0, r * r - (yd / 1.3) ** 2))), r); return -v.z; };
  // teeth sit just behind the lips: an upper row hanging from the skull, a lower row standing on the jaw
  const toothG = new THREE.BoxGeometry(r * 0.1, r * 0.16, r * 0.06);
  const n = 8, span = 0.9, RU = front(MY - r * 0.12) - r * 0.035, RL = front(MY - r * 0.16) * 1.05 - r * 0.045;
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1) - 0.5) * span;
    const tu = new THREE.Mesh(toothG, TEETH);
    tu.position.set(Math.sin(a) * RU * 0.86, MY - r * 0.12, -Math.cos(a) * RU); tu.rotation.y = -a; f.add(tu);
    const tl = new THREE.Mesh(toothG, TEETH); tl.scale.set(0.9, 0.85, 1);
    tl.position.set(Math.sin(a) * RL * 0.86, MY - r * 0.16, -Math.cos(a) * RL).sub(pivot); tl.rotation.y = -a; hinge.add(tl);
  }
  for (const m of [jaw]) m.castShadow = true;
  const fz = -front(MY) * 1.05;
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, r * 0.045, 20, 1, true, Math.PI - 0.55, 1.1), MOUTH);
  lip.scale.set((-fz + r * 0.012) * 0.9, 1, -fz + r * 0.012); lip.position.y = MY + r * 0.01; f.add(lip);
  this.face = { f, eyes, hinge, jaw, lip, blinkT: 1 + Math.random() * 3, blink: 0, sacc: new V3(), saccT: 0, open: 0, gasp: 0, look: new V3(0, 0, -1), roll: Math.random() < 0.5 ? 1 : -1 };
};
const _inv = new THREE.Matrix4(), _lv = new V3();
Body.prototype.animFace = function () {
  const F = this.face; if (!F || !F.f.parent || this.headGone) { if (F && this.headGone) F.f.visible = false; return; }
  const now = this.g.time, dt = Math.min(0.05, now - (F.t || now)); F.t = now;
  const hm = F.f; hm.updateMatrixWorld();
  // --- where to look ---
  let yaw = 0, pitch = 0;
  if (this.alive) {
    _inv.copy(hm.matrixWorld).invert();
    _lv.copy(this.g.player.head).applyMatrix4(_inv).normalize();
    F.saccT -= dt;
    if (F.saccT <= 0) { F.saccT = 0.3 + Math.random() * 1.4; F.sacc.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, 0); }
    yaw = Math.atan2(-_lv.x, -_lv.z) + F.sacc.x; pitch = Math.atan2(_lv.y, Math.hypot(_lv.x, _lv.z)) + F.sacc.y;
    if (this.stun > 0.5) { yaw = Math.sin(now * 13) * 0.5; pitch = Math.cos(now * 11) * 0.3; }       // dazed
  } else { yaw = 0.3 * F.roll; pitch = 0.55; }                                                       // eyes rolled up
  yaw = Math.max(-0.7, Math.min(0.7, yaw)); pitch = Math.max(-0.5, Math.min(0.6, pitch));
  // --- blink ---
  F.blinkT -= dt;
  if (F.blinkT <= 0 && this.alive) { F.blink = 1; F.blinkT = 2 + Math.random() * 4; }
  F.blink = Math.max(0, F.blink - dt * 7);
  const b = Math.sin(Math.min(1, F.blink) * Math.PI);
  const lidOpen = this.alive ? (this.state === 'attack' ? 0.55 : 1.05) : -0.35;   // angry squint / half-lidded dead stare
  for (const e of F.eyes) {
    e.pivot.rotation.set(pitch, yaw + (this.alive ? 0 : -e.sx * 0.15), 0, 'YXZ');
    e.lid.rotation.x = lidOpen - b * (lidOpen + 1.55);
    e.lid.visible = b > 0.04 || !this.alive;
    e.brow.rotation.z = this.alive && (this.state === 'attack' || this.stun > 0.3) ? e.sx * 0.35 : -e.sx * 0.08;
    e.brow.position.y = e.ball.scale.x * (this.alive && this.state === 'attack' ? 1.2 : 1.55);
  }
  // --- jaw ---
  let want = 0;                                                                    // closed: just a line
  if (this.alive) {
    if (this.zombie) want = 0.25 + Math.max(0, Math.sin(now * 7 + this.id)) * 0.4; // chomping
    else if (this.state === 'attack') { const u = this.atkT / 0.95; want = u < 0.45 ? 0.55 : u < 0.65 ? 0.05 : 0.2; }
    else if (this.state === 'down' || this.state === 'getup') want = 0.35;
    if (this.grabbed) want = 0.55 + Math.sin(now * 9) * 0.1;                      // grabbed: yelling
  } else want = 0.6;                                                                 // slack
  F.gasp = Math.max(0, F.gasp - dt * 2);
  want = Math.max(want, F.gasp * 0.75);
  F.open += (want - F.open) * Math.min(1, dt * (this.alive ? 14 : 4));
  F.hinge.rotation.x = -F.open;
  F.lip.visible = F.open < 0.1;
};
// flinch: gasp + wide eyes when hurt
const _hurt = Body.prototype.hurt;
Body.prototype.hurt = function (dmg, stun) {
  if (this.face) this.face.gasp = 1;
  if (this.static && this.alive) { this.static = false; this.state = 'walk'; this.speed = 1.6; }   // a shopkeeper you hit comes over the counter at you
  return _hurt.call(this, dmg, stun);
};

// ---------- innards ----------
const RIB = new THREE.MeshLambertMaterial({ color: 0xefe6d2 }), LUNG = new THREE.MeshLambertMaterial({ color: 0xd2757e }), GUT = new THREE.MeshLambertMaterial({ color: 0xc9707a }), BRAIN = new THREE.MeshLambertMaterial({ color: 0xdb9aa0 });
function addInnards(bone, y, low) {
  const g = new THREE.Group(); g.position.y = y; bone.mesh.add(g);
  const r = bone.r * 0.92;
  if (!low) {
    const ribs = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 4, 18, Math.PI * 1.7), RIB); ribs.rotation.x = Math.PI / 2; ribs.rotation.z = Math.PI * 0.65; g.add(ribs);
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(r * 0.42, 8, 6), LUNG); l.scale.set(1, 0.5, 1); l.position.set(sx * r * 0.42, 0, 0); g.add(l); }
  } else {
    for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(new THREE.TorusGeometry(r * 0.25, r * 0.12, 5, 10), GUT); k.position.set((i % 2 - 0.5) * r * 0.6, 0, (Math.floor(i / 2) - 0.5) * r * 0.6); k.rotation.x = Math.PI / 2; g.add(k); }
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, 0.01, 8), RIB); spine.position.set(0, 0, r * 0.75); g.add(spine);
}
function addBrain(bone, y, r) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 12, 8), BRAIN); b.scale.set(1, 0.25, 1.1); b.position.y = y; bone.mesh.add(b);
}
// an eye knocked out of its socket, on a red stalk
Body.prototype.popEye = function (dir) {
  const F = this.face; if (!F) return false;
  const e = F.eyes.find(x => !x.popped); if (!e) return false;
  e.popped = true;
  e.ball.updateMatrixWorld(); const pos = new V3(); e.ball.getWorldPosition(pos);
  e.pivot.visible = false;
  const hole = new THREE.Mesh(G_EYE, MOUTH); hole.scale.setScalar(e.ball.scale.x * 0.9); e.socket.add(hole);
  const grp = new THREE.Group(), er = e.ball.scale.x;
  const ball = new THREE.Mesh(G_EYE, EYE_W); ball.scale.setScalar(er); grp.add(ball);
  const pup = new THREE.Mesh(G_PUP, PUPIL); pup.scale.set(er * 0.24, er * 0.24, er * 0.14); pup.position.z = -er * 0.9; grp.add(pup);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(er * 0.18, er * 0.12, er * 3, 5), new THREE.MeshLambertMaterial({ color: 0x8a1414 })); stalk.rotation.x = Math.PI / 2; stalk.position.z = er * 1.6; grp.add(stalk);
  this.g.gore.chunk(grp, { o: pos, x: new V3(1, 0, 0), y: new V3(0, 1, 0) }, this.P[CROWN].vel(new V3()).addScaledVector(dir, 2.2).add(new V3(0, 1.2, 0)), 5);
  this.g.gore.burst(pos, 8, 1.5, 0.4, 0.8);
  this.g.sfx.play('splat', pos, 0.9, 0.8);
  return true;
};

const HALF_FLESH = new THREE.MeshLambertMaterial({ color: 0x9a1212, side: THREE.DoubleSide }), HALF_BONE = new THREE.MeshLambertMaterial({ color: 0xece2cc, side: THREE.DoubleSide });
// ---------- grabbing the player ----------
Body.prototype.holdOn = function (dt, core) {
  const G = this.grabbing, g = this.g, PL = g.player, h = G.hand;
  G.t += dt;
  // shake them off: a fast yank of the held hand (VR), or a punch / kick (desktop)
  if (h.vel.length() > 2.6) G.shake += dt; else G.shake = Math.max(0, G.shake - dt * 0.5);
  const freed = G.shake > 0.12 || (!PL.vr && (PL.punch || PL.kick || PL.swing));
  if (freed || G.t > 5 || this.stun > 0.6 || this.P[LH].cc !== core) {
    if (freed) { this.stun = 0.9; this.P[LH].addVel(_v.subVectors(this.P[LH].p, PL.head).setY(0).normalize(), 3); g.sfx.play('punch', h.pos, 0.6, 1.2); }
    this.letGo(); this.atkT = 0; return;
  }
  G.hitT -= dt;
  if (G.hitT <= 0) {
    G.hitT = this.zombie ? 1.1 : 0.9;
    PL.damage(this.zombie ? 10 : 6, this.P[NECK].p);
    g.sfx.play(this.zombie ? 'splat' : 'punch', PL.head, 0.9, this.zombie ? 0.7 : 1);
    if (this.zombie) this.face && (this.face.gasp = 1);
  }
};
Body.prototype.letGo = function () {
  if (!this.grabbing) return;
  if (this.g.player.grabbedBy === this) this.g.player.grabbedBy = null;
  this.grabbing = null;
};

// ---------- split down the middle ----------
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion();
function halfCloth(c, oldMesh, newMesh, n, sg, centre) {
  c.updateMatrix(); oldMesh.updateMatrixWorld(true); newMesh.updateMatrixWorld(true);
  const toWorld = new THREE.Matrix4().multiplyMatrices(oldMesh.matrixWorld, c.matrix);
  const src = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
  const pos = src.attributes.position, col = src.attributes.color, keepP = [], keepC = [], v = new V3();
  for (let i = 0; i < pos.count; i += 3) {
    v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) v.add(_w.fromBufferAttribute(pos, i + k).applyMatrix4(toWorld));
    v.multiplyScalar(1 / 3);
    if ((v.sub(centre).dot(n)) * sg < 0) continue;
    for (let k = 0; k < 3; k++) { keepP.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)); if (col) keepC.push(col.getX(i + k), col.getY(i + k), col.getZ(i + k)); }
  }
  if (!keepP.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
  if (col) geo.setAttribute('color', new THREE.Float32BufferAttribute(keepC, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, c.material); m.castShadow = true;
  _bm.copy(newMesh.matrixWorld).invert().multiply(toWorld);
  _bm.decompose(m.position, m.quaternion, m.scale);
  m.userData.cloth = false;                                  // halves no longer split again
  return m;
}
Body.prototype.bisect = function (n, full) {
  if (this.bisected) return false;
  const g = this.g, P = this.P;
  n = n.clone().setY(0); if (n.lengthSq() < 1e-4) n.set(1, 0, 0); n.normalize();   // a vertical cut plane
  if (!this.headGone) this.splitHead(n);
  this.bisected = true; this.wake();
  const centre = P[CHEST].p.clone();
  const spineJ = full ? [NECK, CHEST, BELLY, PELVIS] : [NECK, CHEST];
  const twin = new Map();
  for (const j of spineJ) {
    const o = P[j]; if (o.gone) continue;
    const vel = o.vel(new V3());
    const t = new Particle(o.p.clone().addScaledVector(n, 0.025), o.r * 0.75, o.m * 0.5); t.body = this; t.j = j;
    t.place(t.p, vel.clone().addScaledVector(n, 0.9)); g.phys.add(t); this.parts.push(t);
    o.p.addScaledVector(n, -0.025); o.addVel(n, -0.9); o.m *= 0.5; o.im = 1 / o.m; o.r *= 0.75;
    twin.set(o, t);
  }
  const dOf = (p) => _v.subVectors(p.p, centre).dot(n);
  const classify = (s) => {
    const as = twin.has(s.a), bs = twin.has(s.b);
    if (as && bs) return 'dup';
    if (!as && !bs) return 'keep';
    const other = as ? s.b : s.a, d = dOf(other);
    if (Math.abs(d) < 0.045 || other.j === BELLY || other.j === PELVIS) return 'dup';   // the uncut spine below holds both halves                 // sits on the cut: both halves hang on to it
    return d > 0 ? 'move' : 'keep';
  };
  const swap = (p) => twin.get(p) || p;
  for (const bone of this.bones.slice()) {
    const s = bone.stick, k = classify(s);
    if (k === 'keep') continue;
    if (k === 'move') { if (twin.has(s.a)) s.a = bone.a = twin.get(s.a); else s.b = bone.b = twin.get(s.b); continue; }
    const a = bone.a, b = bone.b, dir = _v.subVectors(b.p, a.p).normalize().clone();
    const mk = (pa, pb, sg) => {
      const x = n.clone().multiplyScalar(sg); x.addScaledVector(dir, -x.dot(dir)).normalize();
      const z = new V3().crossVectors(x, dir);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, dir, z));
      return new Bone(this, pa, pb, bone.r, bone.kind, { len: bone.len, capA: bone.capA, capB: bone.capB, base: bone.base, q, half: true });
    };
    const L = mk(a, b, -1), R = mk(swap(a), swap(b), 1);
    for (const c of bone.mesh.children.slice()) if (c.userData.cloth) for (const [nb, sg] of [[L, -1], [R, 1]]) { const h = halfCloth(c, bone.mesh, nb.mesh, n, sg, centre); if (h) nb.mesh.add(h); }
    bone.remove(); this.bones.splice(this.bones.indexOf(bone), 1); this.bones.push(L, R);
    if (bone.kind === 'torso') { addInnards(L, L.len * 0.5, false); }
  }
  for (const s of this.sticks.slice()) {
    if (!s.on || this.bones.some(b => b.stick === s)) continue;
    const k = classify(s);
    if (k === 'move') { if (twin.has(s.a)) s.a = twin.get(s.a); else s.b = twin.get(s.b); }
    else if (k === 'dup') this.sticks.push(g.phys.link(swap(s.a), swap(s.b), s.len, s.k, s.min));
    else if (!twin.has(s.a) && !twin.has(s.b)) {          // struts straight across the cut (shoulder to shoulder, hip to hip) snap
      const da = dOf(s.a), db = dOf(s.b);
      if (da * db < 0 && Math.abs(da) > 0.03 && Math.abs(db) > 0.03 && (full || Math.max(s.a.p.y, s.b.p.y) > P[BELLY].p.y)) s.on = false;
    }
  }
  if (this.gun) g.dropGun(this);
  this.components();
  if (this.alive) this.kill('split');
  g.gore.burst(centre, 40, 2.5, 1.2, 1.4); g.gore.splash(centre, n, 10, 2.5); g.gore.splash(centre, n.clone().negate(), 10, 2.5);
  g.sfx.play('tear', centre, 1.2, 0.8, true); g.sfx.play('chop', centre, 1.2, 0.8, true);
  if (full) g.spillGuts(centre.clone().add(new V3(0, -0.25, 0)), new V3());
  return true;
};
