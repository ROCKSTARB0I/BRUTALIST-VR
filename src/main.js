// BRUTALIST VR — boot, loop, modes, effects glue.
import * as THREE from '../vendor/three.module.js?v=5';
import { Phys, DT, Particle } from './phys.js?v=5';
import { Body, J, limbGeo, whiteColors } from './body.js?v=5';
import { Gore } from './gore.js?v=5';
import { Sfx } from './sfx.js?v=5';
import { World, registerMap } from './world.js?v=5';
import { buildHub, loadCareer, saveCareer, applyUpgrades, updateButtons, refreshButtons, UPGRADES, JOBS } from './hub.js?v=5';
import { Motor } from './sfx.js?v=5';
import { Holsters, buildWall, fillWall, updateSlots, placeSlot } from './loadout.js?v=5';
import { Player } from './player.js?v=5';
import { Weapon, DEFS } from './arsenal.js?v=5';
import { weaponContacts, strikerContacts, shoot } from './combat.js?v=5';
const V3 = THREE.Vector3;

const SETTINGS_KEY = 'splinter_settings';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) {}

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const g = window.__sp = {
  renderer, scene, time: 0, playing: false,
  settings: Object.assign({ handPitch: 0, sens: 1, blood: 'red', mode: 'waves', count: 5, heightBoost: 20 }, saved),
  upgrades: { punch: 1, dusters: false, armor: false },
  bodies: [], weapons: [], racks: [],
  cash: 0, kills: 0, wave: 0, infected: false, cutScale: 1, god: false,
  lowEnd: /OculusBrowser|Quest|Mobile/i.test(navigator.userAgent), realShadows: true,
};
if (!g.settings.map || !g.settings.v2) { g.settings.map = 'alley'; g.settings.v2 = 1; }
if (!g.settings.v3) { g.settings.mode = 'career'; g.settings.v3 = 1; }
g.phys = new Phys();
g.sfx = new Sfx();
g.gore = new Gore(g);
g.gore.setColor(g.settings.blood);
g.shadowGeo = new THREE.CircleGeometry(1, 16);
g.shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
g.shardGeo = whiteColors(new THREE.ConeGeometry(0.012, 0.07, 5).translate(0, 0.035, 0));
g.boneMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0xf2ecdc });
const fleshMat = new THREE.MeshLambertMaterial({ color: 0x8e0d0d, side: THREE.DoubleSide });
const brainMat = new THREE.MeshLambertMaterial({ color: 0xd98f95 });
const skullMat = new THREE.MeshLambertMaterial({ color: 0xefe8d6 });
registerMap('hub', buildHub);
g.career = loadCareer();
g.npcs = [];
g.world = new World(g);
g.world.build(g.settings.map);
g.player = new Player(g);
g.player.initXR(renderer);
g.player.initDesktop(canvas);
g.holsters = new Holsters(g);
applyUpgrades(g, g.career);
scene.add(g.player.dolly);

// ---------------- effects glue ----------------
g.saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(g.settings)); } catch (e) {} };
g.strike = (st) => strikerContacts(g, st);
g.onKill = (body, how) => {
  if (body.noReward) { g.sfx.play('thud', body.center(), 0.6); return; }
  g.kills++;
  const bonus = { head: 15, halved: 20, crush: 20, headshot: 12, split: 25 }[how] || 8;
  g.cash += Math.round(bonus * (g.upgrades.reward || 1));
  if (g.upgrades.lifesteal) g.player.heal(6);
  if (g.job) g.job.kills++;
  if (how !== 'head') g.sfx.play('thud', body.center(), 0.6);
};
g.onDismember = (body, bone, C, mode) => {
  const thick = bone.r > 0.07;
  g.sfx.play(thick ? 'chop' : 'slice', C, thick ? 1.1 : 0.9, 1, true);
  if (thick || bone.kind === 'neck') g.sfx.play('tear', C, 0.7);
  if (mode === 'slice') {
    g.gore.burst(C, thick ? 26 : 14, 2.6, 0.8, 1.3);
    g.gore.puff(C, thick ? 0.35 : 0.2);
    g.gore.splash(C, new V3(0, -0.4, 0), thick ? 8 : 3, 2);
    g.cash += 3;
  }
  if (body.alive && !body.zombie) g.sfx.play('grunt', body.P[J.NECK].p, 0.8);
};
// enemy riflemen: line of sight, bursts with spread, tracers; you get hit if a round passes close to your head or chest
g.losTo = (a, b) => { const d = b.clone().sub(a), L = d.length(); return !g.phys.ray(a, d.divideScalar(L), L - 0.3, true); };
g.enemyShoot = (body) => {
  const P = g.player, from = body.gunMesh ? body.gunMesh.localToWorld(new V3(0, 0.06, -0.62)) : body.P[J.RH].p.clone();
  const aim = P.head.clone().add(new V3(0, -0.25 - Math.random() * 0.3, 0));
  const dir = aim.sub(from).normalize().add(new V3((Math.random() - 0.5) * 0.07, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.07)).normalize();
  const wh = g.phys.ray(from, dir, 60, true), maxT = wh ? wh.t : 60;
  g.sfx.play('rifle', from, 0.9, 1.05); muzzleFlash(from, body.gunMesh ? body.gunMesh.quaternion : new THREE.Quaternion());
  let endT = maxT;
  for (const [pt, r, dmg] of [[P.head, 0.16, 14], [P.head.clone().add(new V3(0, -0.45, 0)), 0.22, 8]]) {
    const t = pt.clone().sub(from).dot(dir);
    if (t < 0 || t > maxT) continue;
    if (from.clone().addScaledVector(dir, t).distanceTo(pt) < r) { P.damage(dmg, from); endT = t; break; }
  }
  if (wh && endT === maxT) g.impact(from.clone().addScaledVector(dir, wh.t), wh, dir);
  g.tracer(from, from.clone().addScaledVector(dir, Math.min(endT, 40)));
};
g.dropGun = (body) => {
  if (!body.gunMesh) return;
  const m = body.gunMesh; m.updateMatrixWorld();
  const pos = new V3(), q = new THREE.Quaternion(); m.getWorldPosition(pos); m.getWorldQuaternion(q);
  body.group.remove(m); body.gunMesh = null; body.gun = false;
  const w = new Weapon(g, 'm16', pos, q, 'rack'); w.ammo = 10 + (Math.random() * 15 | 0); w.mode = 'loose'; w.makeLoose(new V3(0, 1, 0)); g.weapons.push(w);
};
const gutGeo = new THREE.CapsuleGeometry(0.022, 0.09, 3, 8), gutMat = new THREE.MeshLambertMaterial({ color: 0xc9707a });
g.spillGuts = (pos, vel) => {
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(gutGeo, gutMat); m.rotation.z = Math.random() * 3;
    g.gore.chunk(m, { o: pos.clone().add(new V3((Math.random() - 0.5) * 0.1, -0.02 * i, (Math.random() - 0.5) * 0.1)), x: new V3(1, 0, 0), y: new V3(0, 1, 0) }, vel.clone().add(new V3((Math.random() - 0.5) * 1.5, Math.random(), (Math.random() - 0.5) * 1.5)), 2);
  }
  g.sfx.play('tear', pos, 0.9, 0.8);
};
g.onSplit = (body, pt) => {
  g.sfx.play('crush', pt, 1.2, 0.9, true);
  g.sfx.play('tear', pt, 0.9);
  g.gore.burst(pt, 30, 2.4, 1.2, 1.3);
  g.gore.splash(pt, new V3(0, 1, 0), 10, 2.5);
};
g.onHit = (body, kind) => { if (body.alive && !body.zombie && Math.random() < 0.3) g.sfx.play('grunt', body.P[J.NECK].p, 0.6); };

g.makeHeadHalf = (len, r, mat) => {
  const grp = new THREE.Group();
  const shell = new THREE.Mesh(limbGeo(len, r, 'round', 'round', 10, Math.PI), mat);
  grp.add(shell);
  const stadium = (rr, y0, y1) => { const s = new THREE.Shape(); s.absarc(0, y1, rr, 0, Math.PI, false); s.absarc(0, y0, rr, Math.PI, Math.PI * 2, false); return s; };
  const face = new THREE.Mesh(new THREE.ShapeGeometry(stadium(r * 0.97, 0, len), 10).rotateY(-Math.PI / 2), fleshMat);
  const brain = new THREE.Mesh(new THREE.ShapeGeometry(stadium(r * 0.7, len * 0.45, len * 0.8), 10).rotateY(-Math.PI / 2), brainMat);
  brain.position.x = -0.002;
  grp.add(face, brain);
  return grp;
};
const brainGeo = new THREE.IcosahedronGeometry(0.026, 0), skullGeo = new THREE.TetrahedronGeometry(0.026);
g.brains = (pos, vel, n) => {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(brainGeo, brainMat); m.scale.set(1, 0.7 + Math.random() * 0.6, 1.2);
    g.gore.chunk(m, { o: pos.clone().add(new V3((Math.random() - 0.5) * 0.08, 0.05, (Math.random() - 0.5) * 0.08)), x: new V3(1, 0, 0), y: new V3(0, 1, 0) },
      vel.clone().add(new V3((Math.random() - 0.5) * 2.5, 1 + Math.random() * 2, (Math.random() - 0.5) * 2.5)), 3);
  }
};
g.skullBits = (pos, dir, r) => {
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(skullGeo, skullMat); m.scale.setScalar(0.6 + Math.random());
    g.gore.chunk(m, { o: pos.clone().add(new V3((Math.random() - 0.5) * r, (Math.random() - 0.5) * r, (Math.random() - 0.5) * r)), x: new V3(1, 0, 0), y: new V3(0, 1, 0) },
      dir.clone().multiplyScalar(2.5).add(new V3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3)), 6);
  }
  g.brains(pos, dir.clone().multiplyScalar(1.5), 4);
  g.gore.burst(pos, 40, 3, 1, 1.4);
};
const glassMat = new THREE.MeshLambertMaterial({ color: 0xcfeaf2, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
const shardGeo = new THREE.BufferGeometry().setFromPoints([new V3(0, 0.06, 0), new V3(-0.05, -0.04, 0), new V3(0.05, -0.03, 0)]);
shardGeo.computeVertexNormals();
g.breakGlass = (box, at, dir) => {
  if (box.broken) return;
  box.broken = true;
  g.phys.boxes.splice(g.phys.boxes.indexOf(box), 1);
  box.mesh.parent.remove(box.mesh);
  g.sfx.play('glass', at, 1.2, 1, true);
  const mn = box.min, mx = box.max;
  for (let i = 0; i < 16; i++) {
    const p = new V3(mn.x + Math.random() * (mx.x - mn.x), mn.y + Math.random() * (mx.y - mn.y), mn.z + Math.random() * (mx.z - mn.z));
    const m = new THREE.Mesh(shardGeo, glassMat); m.scale.setScalar(0.6 + Math.random() * 1.4);
    const v = (dir ? dir.clone().multiplyScalar(2.5) : new V3()).add(new V3((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2));
    g.gore.chunk(m, { o: p, x: new V3(1, 0, 0), y: new V3(0, 1, 0) }, v, 4);
  }
};
g.phys.onGlass = (box, p, sp) => { g.breakGlass(box, p.p.clone(), p.vel(new V3()).normalize()); if (p.body) p.body.hurt(10, 0.6); };
let lastImpact = 0;
g.phys.onImpact = (p, sp, box) => {
  if (!p.body || sp < 4.5 || g.time - lastImpact < 0.05) return;
  lastImpact = g.time;
  g.sfx.play('thud', p.p, Math.min(1, sp / 10));
  if (sp > 8) { p.body.hurt((sp - 8) * 8, 0.8); g.gore.burst(p.p, 6, 1.5, 0.5); }
};
g.impact = (P, wh, dir) => {
  // bullet mark on the level: a dark chip
  const f = g.gore.face(wh.box, g.gore.faceIndex(wh.ax, wh.sg));
  const [u, v] = g.gore.uv(wh.box, g.gore.faceIndex(wh.ax, wh.sg), P.x, P.y, P.z);
  f.ctx.fillStyle = 'rgba(30,26,22,0.85)'; f.ctx.beginPath(); f.ctx.arc(u * f.W, (1 - v) * f.H, 2.2, 0, Math.PI * 2); f.ctx.fill();
  g.gore.dirty.add(f);
  g.sfx.play('thud', P, 0.25, 2.2);
  g.gore.puff(P.clone().addScaledVector(dir, -0.05), 0.12, '#b8b2a6');
  if (wh.box.paintBase && Math.random() < 0.5) g.gore.sparks(P, 3);
};
// tracers + muzzle flashes
const tracers = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.8 });
g.tracer = (a, b) => {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(geo, tracerMat.clone()); scene.add(l); tracers.push({ l, t: 0.06 });
};
const flashGeo = new THREE.PlaneGeometry(0.12, 0.12);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const flashes = [];
function muzzleFlash(pos, q) {
  const grp = new THREE.Group();
  for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(flashGeo, flashMat); m.rotation.y = i * Math.PI / 2; m.position.z = -0.04; grp.add(m); }
  grp.position.copy(pos); grp.quaternion.copy(q); grp.rotateX(Math.PI / 2); grp.rotateX(-Math.PI / 2);
  scene.add(grp); flashes.push({ m: grp, t: 0.045 });
}
g.flash = (k) => { const el = document.getElementById('flash'); el.style.opacity = k; setTimeout(() => el.style.opacity = 0, 120); };

// ---------------- guns ----------------
g.trigger = (w, held, pressed, dt) => {
  const gun = w.def.gun;
  w.fireT -= dt;
  if (w.reloadT > 0) { w.reloadT -= dt; if (w.reloadT <= 0) w.ammo = gun.mag; return; }
  if (gun.spin) {
    w.spin = Math.max(0, Math.min(1, (w.spin || 0) + (held ? dt / 0.6 : -dt / 1.2)));
    if (!w.motor && g.sfx.ctx) w.motor = new Motor(g.sfx, 'spin');
    if (w.motor) w.motor.set(w.spin > 0.02, w.spin, 0, w.pos);
    if (w.spin < 1) return;
  }
  const mode = w.fireMode || (gun.auto ? 'auto' : 'semi');
  let want = false;
  if (mode === 'auto') want = held;
  else if (mode === 'burst') { if (pressed) w.burst = 3; want = w.burst > 0; }
  else want = pressed;
  if (!want || w.fireT > 0) return;
  if (g.job) g.job.shots++;
  if (w.ammo <= 0) { if (pressed) g.sfx.play('click', w.pos, 0.7); w.burst = 0; return; }
  w.ammo--; if (w.burst > 0) w.burst--;
  w.fireT = 60 / gun.rpm;
  const muzzle = w.worldPoint(w.def.muzzle, new V3());
  const dir = new V3(0, 0, -1).applyQuaternion(w.quat);
  g.sfx.play(gun.sound, muzzle, gun.spin ? 0.8 : 1.2, gun.spin ? 1.15 : 1, !gun.spin);
  muzzleFlash(muzzle, w.quat);
  shoot(g, muzzle, dir, gun);
  // recoil: kick the gun up and back on its spring
  w.vel.addScaledVector(dir, -gun.recoil * 1.6).add(new V3(0, gun.recoil * 1.2, 0));
  w.quat.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), gun.recoil * 0.18));
};
g.sawCtl = (w, held, pressed, dt) => {
  if (pressed && !w.running) { w.running = true; g.sfx.play('pullcord', w.pos, 1); }
  w.rev = (w.rev || 0) + ((held ? 1 : 0.15) - (w.rev || 0)) * Math.min(1, dt * 6);
  if (!w.motor && g.sfx.ctx) w.motor = new Motor(g.sfx, 'saw');
  if (w.motor) w.motor.set(w.running, w.rev, w.load || 0, w.pos);
  w.load = Math.max(0, (w.load || 0) - dt * 4);
  // chain blur
  const ch = w.mesh.userData.chain; if (ch) ch.material = w.running && w.rev > 0.4 ? CHAIN_FAST : ch.material;
};
const CHAIN_FAST = new THREE.MeshLambertMaterial({ color: 0x55585e });
g.homerun = (body, n, pt) => {
  const dir = n.clone().setY(0).normalize().add(new V3(0, 0.8, 0)).normalize();
  for (const p of body.parts) if (!p.gone) { p.sleep = false; p.addVel(dir, 26 + Math.random() * 4); }
  body.kill('homerun');
  g.sfx.play('crush', pt, 1.3, 0.8, true); g.sfx.play('blunt', pt, 1.3, 0.6, true);
  g.gore.burst(pt, 30, 4, 1.5, 1.4);
  setTimeout(() => g.disintegrate(body), 380);
};
g.disintegrate = (body) => {
  if (!g.bodies.includes(body)) return;
  const pos = body.center().clone();
  for (const b of body.bones) {
    const c = b.point(0.5, new V3());
    g.gore.burst(c, 10, 3.5, 1, 1.5);
    if (Math.random() < 0.5) { const m = new THREE.Mesh(chunkGeo, chunkMat); m.scale.setScalar(0.8 + Math.random()); g.gore.chunk(m, { o: c, x: new V3(1, 0, 0), y: new V3(0, 1, 0) }, new V3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6), 8); }
  }
  g.gore.splash(pos, new V3(0, -1, 0), 20, 6);
  g.sfx.play('tear', pos, 1.2, 0.8, true);
  body.dispose(); g.bodies.splice(g.bodies.indexOf(body), 1); g.phys.prune();
};
const chunkGeo = new THREE.IcosahedronGeometry(0.035, 0), chunkMat = new THREE.MeshLambertMaterial({ color: 0x9a1414 });
const nailGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.09, 5).rotateX(Math.PI / 2), nailMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
g.nailMark = (at, dir, p, bone) => {
  const m = new THREE.Mesh(nailGeo, nailMat);
  m.position.copy(at).addScaledVector(dir, -0.03); m.quaternion.setFromUnitVectors(new V3(0, 0, -1), dir);
  if (bone) { bone.mesh.updateMatrixWorld(); bone.mesh.attach(m); } else scene.add(m);
  g.sfx.play('thud', at, 0.5, 1.8);
  if (p) { p.body.wake(); g.gore.burst(at, 6, 1.5, 0.3); }
};
g.reload = (w) => { if (w.reloadT > 0 || w.ammo === w.def.gun.mag) return; w.reloadT = w.def.gun.reload; g.sfx.play('reload', w.pos, 0.9); };
g.cycleFire = (w) => {
  const m = w.def.gun.modes; if (!m) return;
  w.fireMode = m[(m.indexOf(w.fireMode || m[0]) + 1) % m.length];
  g.sfx.play('click', w.pos, 0.6, 1.3);
};
const ALL = Object.keys(DEFS);
const available = () => (g.mode === 'career' || g.mode === 'job') ? g.career.owned.filter(k => DEFS[k]) : ALL;
g.equipSlot = (i, hand) => g.equipKey(available()[i], hand);
g.equipKey = (key, hand) => {
  if (!key) return;
  if (hand.held) { const old = hand.held; old.release(hand, new V3()); removeWeapon(old); }
  const w = new Weapon(g, key, hand.pos, hand.quat, 'held');
  w.mode = 'held'; w.grab(hand, w.def.mount === 'gun' ? 0 : w.def.handle[0] + 0.08);
  g.weapons.push(w);
};
function removeWeapon(w) { w.dispose(); const i = g.weapons.indexOf(w); if (i >= 0) g.weapons.splice(i, 1); for (const s of g.holsters.slots) if (s.w === w) s.w = null; }
g.removeWeapon = removeWeapon;
g.wallAllows = (key) => (g.mode === 'career' || g.mode === 'job') ? g.career.owned.includes(key) : true;

// ---------------- weapon wall / stands ----------------
function stockRacks() { buildWall(g, g.world); for (const sl of g.world.slots || []) if (!sl.wall && !sl.w) placeSlot(g, sl); }
g.loadMap = (name) => {
  // holstered weapons come with you (in career only the ones you own)
  const carry = g.holsters.keys().map(k => k && (!(g.mode === 'career' || g.mode === 'job') || g.career.owned.includes(k)) ? k : null);
  g.holsters.clear();
  for (const w of g.weapons.slice()) removeWeapon(w);
  for (const b of g.bodies) b.dispose(); g.bodies.length = 0;
  g.npcs = [];
  scene.remove(g.world.group);
  g.world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  for (const f of g.gore.faceList) { f.tex.dispose(); f.mat.dispose(); }
  g.gore.faceList.length = 0; g.gore.dirty.clear();
  for (const c of g.gore.chunks) c.dispose(g); g.gore.chunks.length = 0;
  g.phys.boxes.length = 0; g.phys.prune();
  g.world = new World(g); g.world.build(name);
  g.world.slots = g.world.slots || [];
  // shopkeepers are real bodies: you can hit them, and they fight back (no reward for it)
  for (const v of g.world.vendors || []) { v.noReward = true; g.bodies.push(v); }
  stockRacks();
  g.holsters.restore(carry);
  refreshButtons(g);
};
function restockRacks(dt) {
  updateSlots(g, dt);
  const loose = g.weapons.filter(w => w.mode === 'loose');
  if (loose.length > 14) removeWeapon(loose[0]);
}

// ---------------- enemies + modes ----------------
function spawnEnemy(opts = {}) {
  // multi-storey maps: spawn on your floor so they can actually reach you
  const fy = g.player.dolly.position.y, near = g.world.spawns.filter(s => Math.abs(s.y - fy) < 1.6);
  const pool = g.world.floors && near.length ? near : g.world.spawns;
  const sp = pool[(Math.random() * pool.length) | 0];
  const yaw = Math.atan2(-sp.x, -sp.z);
  const b = new Body(g, new V3(sp.x + (Math.random() - 0.5) * 0.6, sp.y, sp.z + (Math.random() - 0.5) * 0.6), yaw, opts);
  g.bodies.push(b);
  return b;
}
function aliveCount() { return g.bodies.filter(b => b.alive).length; }
function trimCorpses() {
  const dead = g.bodies.filter(b => !b.alive);
  if (g.bodies.length > 20 && dead.length) { const b = dead[0]; b.dispose(); g.bodies.splice(g.bodies.indexOf(b), 1); g.phys.prune(); }
}
const W = { toSpawn: 0, spawnT: 0, breakT: 0, state: 'idle', respawnT: 0 };
function startWave(n) {
  g.wave = n; W.toSpawn = 3 + n * 2; W.spawnT = 1.5; W.state = 'fight';
  g.sfx.play('slam', null, 0.9, 1, true);
  banner(`WAVE ${n}`);
}
// ---------------- career ----------------
g.saveCareer = () => { g.career.cash = g.cash; saveCareer(g.career); applyUpgrades(g, g.career); refreshButtons(g); };
g.shopPress = (btn) => {
  const C = g.career;
  const flash = (t) => { btn.flash = performance.now() + 1400; btn.flashText = t; btn.refresh(); setTimeout(() => btn.refresh(), 1450); };
  if (btn.kind === 'weapon') {
    const d = DEFS[btn.key];
    if (C.owned.includes(btn.key)) { g.equipKey(btn.key, g.player.vr && btn.hand ? btn.hand : g.player.hands.right); g.sfx.play('click', null, 0.6); return; }
    if (g.cash < d.price) { flash('Not enough cash'); g.sfx.play('click', null, 0.6, 0.6); return; }
    g.cash -= d.price; C.owned.push(btn.key); g.sfx.play('reload', null, 0.9); flash('Item Bought');
    g.saveCareer(); stockRacksAgain();
    return;
  }
  const u = UPGRADES[btn.key], lvl = C.up[btn.key] || 0;
  if (btn.kind === 'gear' && lvl) {
    if (btn.key === 'armor') C.armorOn = !C.armorOn; else C.dustersOn = !C.dustersOn;
    g.sfx.play('punch', null, 0.6, 1.3); g.saveCareer(); return;
  }
  if (lvl >= u.max) { flash('Maxed out'); return; }
  if (g.cash < u.price[lvl]) { flash('Not enough cash'); g.sfx.play('click', null, 0.6, 0.6); return; }
  g.cash -= u.price[lvl]; C.up[btn.key] = lvl + 1;
  if (btn.key === 'armor') C.armorOn = true; if (btn.key === 'dusters') C.dustersOn = true;
  g.sfx.play('reload', null, 0.9); flash('Upgraded'); g.saveCareer();
  if (btn.key === 'hp') g.player.heal(25);
};
function stockRacksAgain() { fillWall(g); }
g.startJob = (job) => {
  g.saveCareer();
  g.loadMap(job.map);
  g.mode = 'job'; g.infected = !!job.infected;
  g.job = { def: job, toSpawn: job.count, spawnT: 2.5, t: 0, shots: 0, kills: 0, done: false };
  g.player.spawn(g.world.start.x, g.world.start.z, g.world.start.yaw);
  g.player.hp = g.player.maxHp;
  stockRacksAgain();
  g.sfx.play('slam', null, 0.9, 1, true);
  banner(job.name.toUpperCase(), `${job.count} targets · bonus: ${job.bonus.text}`);
};
g.toHub = () => {
  g.job = null; g.infected = false; g.mode = 'career';
  g.loadMap('hub');
  g.player.spawn(g.world.start.x, g.world.start.z, g.world.start.yaw);
  g.player.hp = g.player.maxHp; g.player.dead = false;
};
function updateJob(dt) {
  const J = g.job; if (!J || J.done || g.player.dead) return;
  J.t += dt; J.spawnT -= dt;
  if (J.toSpawn > 0 && J.spawnT <= 0 && aliveCount() < 6) {
    J.toSpawn--; J.spawnT = 1.4 + Math.random() * 1.4;
    const sold = J.def.soldiers && Math.random() < J.def.soldiers;
    spawnEnemy({ zombie: J.def.infected && Math.random() < 0.5, kind: sold ? 'soldier' : 'grunt', hp: sold ? 140 : 100, speed: 1.4, gun: !J.def.infected && (sold ? Math.random() < 0.5 : Math.random() < 0.15) });
    J.lastKill = J.lastKill || J.t;
  }
  // failsafe: if nobody's died for a long time, the stragglers drop dead so a job can't stall
  if (J.kills !== J.k0) { J.k0 = J.kills; J.lastKill = J.t; }
  if (J.t - (J.lastKill || 0) > 90 && J.toSpawn === 0) { const b = g.bodies.find(b => b.alive && !b.noReward); if (b) { b.kill('failsafe'); J.lastKill = J.t - 85; } }
  if (J.toSpawn === 0 && aliveCount() === 0) {
    J.done = true;
    const B = J.def.bonus;
    const ok = B.kind === 'melee' ? J.shots === 0 : B.kind === 'time' ? J.t <= B.t : g.player.hp >= B.hp;
    const pay = Math.round((J.def.pay + (ok ? B.pay : 0)) * (g.upgrades.reward || 1));
    g.cash += pay; g.career.jobs[J.def.id] = (g.career.jobs[J.def.id] || 0) + 1;
    g.saveCareer();
    banner('JOB DONE', `+${pay} $${ok ? ' · bonus earned' : ' · bonus missed'}`);
    setTimeout(() => { if (g.job === J) g.toHub(); }, 5000);
  }
}
function updateMode(dt) {
  if (g.player.dead) return;
  if (g.mode === 'job') { updateJob(dt); return; }
  if (g.mode === 'career') return;
  if (g.mode === 'sandbox') {
    W.respawnT -= dt;
    if (aliveCount() < g.settings.count && W.respawnT <= 0) { spawnEnemy({ zombie: g.infected && Math.random() < 0.3, gun: Math.random() < 0.2 }); W.respawnT = 1.2; }
    return;
  }
  if (W.state === 'fight') {
    W.spawnT -= dt;
    if (W.toSpawn > 0 && W.spawnT <= 0 && aliveCount() < 6) {
      W.toSpawn--; W.spawnT = 1.6 + Math.random() * 1.5;
      spawnEnemy({ zombie: g.infected && g.wave > 1 && Math.random() < 0.35, speed: 1.3 + Math.min(1, g.wave * 0.08), gun: !g.infected && g.wave >= 3 && Math.random() < 0.25 });
    }
    if (W.toSpawn === 0 && aliveCount() === 0) { W.state = 'break'; W.breakT = 6; banner('WAVE CLEARED', `+$${50 * g.wave}`); g.cash += 50 * g.wave; g.player.heal(25); }
  } else if (W.state === 'break') {
    W.breakT -= dt;
    if (W.breakT <= 0) startWave(g.wave + 1);
  }
}
g.onPlayerDeath = () => {
  if (g.mode === 'job' || g.mode === 'career') {
    banner('YOU GOT WRECKED', g.job ? 'job failed · back to the hub' : '');
    g.job = null;
    setTimeout(() => g.toHub(), 3500);
    return;
  }
  banner('YOU GOT WRECKED', 'back in a moment');
  setTimeout(() => {
    for (const b of g.bodies) if (!b.noReward) b.dispose();
    g.bodies = g.bodies.filter(b => b.noReward); g.phys.prune();
    g.player.spawn(g.world.start.x, g.world.start.z, g.world.start.yaw);
    if (g.mode !== 'sandbox') startWave(1);
  }, 3500);
};

// body vs body: keep piles from interpenetrating; keep walkers from stacking
function collideBodies() {
  const B = g.bodies;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j];
    if (a.asleep && b.asleep) continue;
    if (a.center().distanceToSquared(b.center()) > 3.2) continue;
    for (const p of a.parts) {
      if (p.gone) continue;
      for (const q of b.parts) {
        if (q.gone) continue;
        const dx = q.p.x - p.p.x, dy = q.p.y - p.p.y, dz = q.p.z - p.p.z, rr = p.r + q.r, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-10) continue;
        const d = Math.sqrt(d2), k = (rr - d) / d * 0.5;
        const wp = p.sleep ? 0 : 1, wq = q.sleep ? 0 : 1;
        if (q.sleep && !p.sleep) b.wake(); if (p.sleep && !q.sleep) a.wake();
        p.p.x -= dx * k * wp; p.p.y -= dy * k * wp; p.p.z -= dz * k * wp;
        q.p.x += dx * k * wq; q.p.y += dy * k * wq; q.p.z += dz * k * wq;
      }
    }
    if (a.alive && b.alive) {
      const dx = b.root.x - a.root.x, dz = b.root.z - a.root.z, d = Math.hypot(dx, dz);
      if (d < 0.6 && d > 1e-4) { const k = (0.6 - d) / d * 0.05; a.root.x -= dx * k; a.root.z -= dz * k; b.root.x += dx * k; b.root.z += dz * k; }
    }
  }
}
// impaled bodies come off when the blade is yanked back out
function checkImpaled() {
  for (const w of g.weapons) for (let i = w.impaled.length - 1; i >= 0; i--) {
    const im = w.impaled[i];
    if (im.p.gone) { w.impaled.splice(i, 1); continue; }
    const out = im.edge ? new V3().fromArray(im.edge).applyQuaternion(w.quat).negate() : new V3(0, -1, 0).applyQuaternion(w.quat);
    if (g.time - im.t > 0.3 && w.mode === 'held' && w.vel.dot(out) > (im.edge ? 1.4 : 2.2)) {
      w.unimpale(i); g.sfx.play('slice', im.p.p, 0.8, 0.8); g.gore.burst(im.p.p, 12, 2, 0.4);
    }
  }
}

// ---------------- HUD ----------------
const hudEl = document.getElementById('hud');
g.hudLine1 = () => g.mode === 'sandbox' ? `SANDBOX  kills ${g.kills}` : g.mode === 'career' ? 'HUB · pick a job on the left wall' : g.mode === 'job' && g.job ? `${g.job.def.name}  ${g.job.toSpawn + aliveCount()} left  ${Math.floor(g.job.t / 60)}:${String(Math.floor(g.job.t % 60)).padStart(2, '0')}` : `WAVE ${g.wave}  kills ${g.kills}`;
g.hudLine2 = () => {
  const w = g.player.hands.right.held || g.player.hands.left.held;
  const ammo = w && w.def.gun ? `  ${w.reloadT > 0 ? 'reloading' : w.ammo + '/' + w.def.gun.mag}${w.fireMode ? ' ' + w.fireMode : ''}` : '';
  return `$${g.cash}${ammo}`;
};
let hudT = 0;
function updateHud(dt) {
  if ((hudT -= dt) > 0) return; hudT = 0.1;
  const p = g.player;
  document.getElementById('hpbar').style.width = (100 * p.hp / p.maxHp) + '%';
  document.getElementById('l1').textContent = g.hudLine1();
  const w = p.hands.right.held;
  document.getElementById('l2').textContent = g.hudLine2() + (w ? '  ·  ' + w.def.name : '  ·  fists');
  const hb = g.hoverBtn, hint = document.getElementById('hint');
  if (hint) { hint.textContent = hb && !p.vr ? (hb.kind === 'job' ? `E: start ${hb.job.name}` : 'E: buy / use') : ''; }
}
let bannerT = null;
function banner(a, b = '') {
  const el = document.getElementById('banner');
  el.innerHTML = `<b>${a}</b>${b ? `<span>${b}</span>` : ''}`; el.classList.add('on');
  clearTimeout(bannerT); bannerT = setTimeout(() => el.classList.remove('on'), 2600);
}

// ---------------- loop ----------------
let acc = 0, last = performance.now(), stepN = 0;
function frame(t) {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (g.playing) {
    g.time += dt;
    g.player.update(dt);
    g.holsters.update(dt);
    for (const b of g.bodies) b.think(dt);
    for (const b of g.npcs) b.think(dt);
    g.hoverBtn = updateButtons(g, dt);
    if (g.cash !== g._lastCash) { g._lastCash = g.cash; if (g.world.buttons) for (const b of g.world.buttons) if (b.fundsSign) b.refresh(); }
    acc += dt;
    let n = Math.floor(acc / DT);
    if (n > 4) { n = 4; acc = 0; } else acc -= n * DT;
    for (let i = 1; i <= n; i++) {
      const alpha = i / n;
      for (const w of g.weapons) w.step(alpha);
      g.player.step(alpha);
      for (const w of g.weapons) if (w.mode === 'held' || w.mode === 'loose') weaponContacts(g, w);
      if ((stepN++ & 1) === 0) collideBodies();
      g.phys.step();
    }
    checkImpaled();
    g.gore.update(dt);
    for (const b of g.bodies) b.render();
    for (const b of g.npcs) b.render();
    for (const w of g.weapons) w.sync();
    g.player.render();
    restockRacks(dt);
    updateMode(dt);
    trimCorpses();
    updateHud(dt);
    for (let i = tracers.length - 1; i >= 0; i--) { const tr = tracers[i]; tr.t -= dt; tr.l.material.opacity = Math.max(0, tr.t / 0.06) * 0.8; if (tr.t <= 0) { scene.remove(tr.l); tr.l.geometry.dispose(); tracers.splice(i, 1); } }
    for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t -= dt; if (f.t <= 0) { scene.remove(f.m); flashes.splice(i, 1); } }
    g.sfx.listen(g.player.cam);
  }
  renderer.render(scene, g.player.cam);
}
renderer.setAnimationLoop((t) => { try { frame(t); } catch (e) { console.error(e); } });
g._frame = (dt) => { last = performance.now() - dt * 1000; frame(); };   // test hook: step a frame by hand
addEventListener('resize', () => { g.player.cam.aspect = innerWidth / innerHeight; g.player.cam.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------------- menu ----------------
const menu = document.getElementById('menu');
function start(vr) {
  g.sfx.init();
  g.mode = g.settings.mode === 'infected' ? 'waves' : g.settings.mode;
  g.infected = g.settings.mode === 'infected';
  g.job = null;
  g.holsters.clear();
  if (g.mode === 'career') { g.cash = g.career.cash; applyUpgrades(g, g.career); g.loadMap('hub'); g.holsters.restore(['axe', null, null, null]); }
  else { g.cash = 0; g.upgrades = { punch: 1, dusters: false, armor: false, lifesteal: false, reward: 1 }; g.player.maxHp = 100; g.loadMap(g.settings.map); g.holsters.restore(['axe', 'pistol', null, null]); }
  g.gore.setColor(g.settings.blood);
  menu.hidden = true; hudEl.hidden = vr; document.getElementById('cross').hidden = vr;
  g.playing = true;
  g.player.spawn(g.world.start.x, g.world.start.z, g.world.start.yaw);
  g.kills = 0;
  g.player.hp = g.player.maxHp;
  if (g.mode === 'career') banner('THE MARKET', 'buy gear · jobs board on the left wall');
  else if (g.mode !== 'sandbox') { W.state = 'break'; W.breakT = 3; g.wave = 0; banner('GRAB A WEAPON', 'they are coming'); }
  else banner('SANDBOX', 'every weapon · number keys or the table');
}
function stop() {
  if (g.mode === 'career' || g.mode === 'job') g.saveCareer();
  g.playing = false; menu.hidden = false; hudEl.hidden = true; document.getElementById('cross').hidden = true;
  if (document.pointerLockElement) document.exitPointerLock();
}
document.getElementById('btnDesk').onclick = () => start(false);
const btnVR = document.getElementById('btnVR');
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    if (!ok) { btnVR.textContent = 'VR not available here'; btnVR.disabled = true; return; }
    btnVR.onclick = async () => {
      try {
        const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
        await renderer.xr.setSession(s);
        try { if (s.updateTargetFrameRate && s.supportedFrameRates) { const r = [...s.supportedFrameRates]; if (r.includes(90)) s.updateTargetFrameRate(90); } } catch (e) {}
        start(true);
        s.addEventListener('end', stop);
      } catch (e) { console.error(e); btnVR.textContent = 'VR failed: ' + e.message; }
    };
  });
} else { btnVR.textContent = 'VR not available here'; btnVR.disabled = true; }
addEventListener('keydown', e => { if (e.code === 'Escape' && g.playing && !g.player.vr) { setTimeout(() => { if (!document.pointerLockElement) stop(); }, 50); } });

// settings widgets
const bind = (id, key, num) => {
  const el = document.getElementById(id); if (!el) return;
  el.value = g.settings[key];
  el.oninput = () => { g.settings[key] = num ? parseFloat(el.value) : el.value; g.saveSettings(); const o = document.getElementById(id + 'Out'); if (o) o.textContent = el.value; if (key === 'blood') g.gore.setColor(el.value); };
  const o = document.getElementById(id + 'Out'); if (o) o.textContent = el.value;
};
bind('selMode', 'mode'); bind('selMap', 'map'); bind('selBlood', 'blood'); bind('rngPitch', 'handPitch', true); bind('rngSens', 'sens', true); bind('rngCount', 'count', true); bind('rngHeight', 'heightBoost', true);
stockRacks();
g.player.spawn(g.world.start.x, g.world.start.z, g.world.start.yaw);
