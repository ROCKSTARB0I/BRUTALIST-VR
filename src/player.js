// You: WebXR rig (Quest) or mouse + keyboard. Solid geometric gloves, grabs, throws, kicks, headbutts.
import * as THREE from '../vendor/three.module.js?v=3';
import { DT } from './phys.js?v=3';
import { DEFS, Weapon } from './arsenal.js?v=3';
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const UP = new V3(0, 1, 0);
const _v = new V3(), _w = new V3(), _q = new Q(), _m = new THREE.Matrix4(), _e = new THREE.Euler();

// smooth grey cartoon hands; fingers curl around whatever you hold
const HAND_MAT = new THREE.MeshLambertMaterial({ color: 0xb4b8be });
const SLEEVE_MAT = new THREE.MeshLambertMaterial({ color: 0x8a8e95 });
function gloveMesh(side) {
  const g = new THREE.Group(), s = side === 'left' ? -1 : 1;
  const inner = new THREE.Group(); inner.scale.x = s; g.add(inner);
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), HAND_MAT);
  palm.scale.set(0.021, 0.04, 0.05); palm.position.set(0, -0.005, 0.0); inner.add(palm);
  const fingers = [];
  const segGeo = new THREE.CapsuleGeometry(0.0105, 0.026, 3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.018);
  for (let i = 0; i < 4; i++) {
    const k1 = new THREE.Group(); k1.position.set(-0.004, 0.03 - i * 0.019, -0.042); inner.add(k1);
    const p1 = new THREE.Mesh(segGeo, HAND_MAT); k1.add(p1);
    const k2 = new THREE.Group(); k2.position.z = -0.036; k1.add(k2);
    const p2 = new THREE.Mesh(segGeo, HAND_MAT); p2.scale.setScalar(0.9); k2.add(p2);
    fingers.push([k1, k2]);
  }
  const tb = new THREE.Group(); tb.position.set(-0.016, 0.035, -0.01); tb.rotation.set(0.4, 0.5, 0); inner.add(tb);
  const t1 = new THREE.Mesh(segGeo, HAND_MAT); t1.scale.set(1.1, 1.1, 1.1); tb.add(t1);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.16, 10).rotateX(Math.PI / 2), SLEEVE_MAT);
  sleeve.position.set(0, -0.005, 0.1); inner.add(sleeve);
  const knuck = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.085, 0.02), new THREE.MeshLambertMaterial({ color: 0xd8b23a }));
  knuck.position.set(0.012, -0.0, -0.05); knuck.visible = false; inner.add(knuck);
  g.userData = { fingers, thumb: tb, knuck };
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}
function curlHand(glove, k) {
  const { fingers, thumb } = glove.userData;
  for (const [a, b] of fingers) { a.rotation.y = k * 1.45; b.rotation.y = k * 1.6; }
  thumb.rotation.y = 0.5 + k * 0.7;
}

class Hand {
  constructor(p, side) {
    this.p = p; this.side = side;
    this.pos = new V3(); this.p0 = new V3(); this.quat = new Q(); this.vel = new V3();
    this.held = null; this.grabP = null; this.pinV = new V3();
    this.btn = { trig: false, grip: false, a: false, b: false, stick: false };
    this.prevBtn = { ...this.btn };
    this.glove = gloveMesh(side); p.g.scene.add(this.glove);
    this.st = { pos: new V3(), prev: new V3(), r: 0.06, mass: 1.4, kind: 'fist', dmgMul: 1 };
    this.power = 1; this.src = null; this.grip = null; this.ray = null;
  }
  lerpPos(a, out) { return out.copy(this.p0).lerp(this.pos, a); }
  pressed(k) { return this.btn[k] && !this.prevBtn[k]; }
  released(k) { return !this.btn[k] && this.prevBtn[k]; }
}

export class Player {
  constructor(g) {
    this.g = g;
    this.dolly = new THREE.Group(); g.scene.add(this.dolly);
    this.cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 120);
    this.dolly.add(this.cam);
    this.head = new V3(); this.headPrev = new V3();
    this.hands = { left: new Hand(this, 'left'), right: new Hand(this, 'right') };
    this.H = [this.hands.left, this.hands.right];
    this.hp = 100; this.maxHp = 100; this.dead = false;
    this.vy = 0; this.onGround = true;
    this.yaw = 0; this.pitch = 0; this.eye = 1.65;
    this.keys = {}; this.mdx = 0; this.mdy = 0; this.swing = null; this.punch = null;
    this.kick = null; this.butt = null; this.snapT = 0;
    this.headSt = { pos: new V3(), prev: new V3(), r: 0.11, mass: 5, kind: 'head', dmgMul: 1.2 };
    this.kickSt = { pos: new V3(), prev: new V3(), r: 0.09, mass: 9, kind: 'kick', dmgMul: 1 };
    this.leg = this.makeLeg(); g.scene.add(this.leg); this.leg.visible = false;
    this.hurtT = 0;
    this.settings = g.settings;
    this.recentMouse = [];
    this.vrHud = this.makeWristHud();
    this.hurtSphere = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0xaa0000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false }));
    this.hurtSphere.renderOrder = 999; this.cam.add(this.hurtSphere);
  }

  get vr() { return this.g.renderer.xr.isPresenting; }
  spawn(x, z, yaw) {
    this.dolly.position.set(x, this.g.phys.groundAt(x, z, ((this.g.world.start && this.g.world.start.y) || 0) + 0.5), z);
    this.dolly.rotation.set(0, 0, 0);
    this.yaw = yaw; this.pitch = 0; this.vy = 0;
    if (this.vr) this.dolly.rotation.y = yaw;
    this.hp = this.maxHp; this.dead = false;
  }

  // ---------- input wiring ----------
  initXR(renderer) {
    for (let i = 0; i < 2; i++) {
      const ray = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i);
      this.dolly.add(ray, grip);
      ray.addEventListener('connected', (e) => {
        const h = e.data.handedness === 'left' ? this.hands.left : this.hands.right;
        h.src = e.data; h.ray = ray; h.grip = grip;
      });
      ray.addEventListener('disconnected', () => { for (const h of this.H) if (h.ray === ray) h.src = null; });
    }
  }
  initDesktop(canvas) {
    addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (!this.g.playing || this.vr) return;
      const R = this.hands.right;
      if (e.code === 'KeyE') this.deskInteract();
      if (e.code === 'KeyQ') this.deskDrop();
      if (e.code === 'KeyF') this.startKick();
      if (e.code === 'KeyG') this.startButt();
      if (e.code === 'KeyR' && R.held && R.held.def.gun) this.g.reload(R.held);
      if (e.code === 'KeyB' && R.held && R.held.def.gun) this.g.cycleFire(R.held);
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) this.holsterKey(n - 1);
      if (e.code === 'Space' && this.onGround) { this.vy = 4.3; this.onGround = false; }
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    let dragging = false, downAt = null;
    canvas.addEventListener('mousedown', e => {
      if (!this.g.playing || this.vr) return;
      this.g.sfx.init();
      if (document.pointerLockElement !== canvas) {
        try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {}
      }
      downAt = { x: e.clientX, y: e.clientY, b: e.button }; dragging = false;
      if (document.pointerLockElement === canvas) this.deskClick(e.button, true);
    });
    addEventListener('mouseup', e => {
      if (!this.g.playing || this.vr) return;
      if (document.pointerLockElement !== canvas && downAt && !dragging) this.deskClick(downAt.b, true);
      if (downAt) this.deskClick(downAt.b, false);
      downAt = null;
    });
    addEventListener('mousemove', e => {
      if (!this.g.playing || this.vr) return;
      const locked = document.pointerLockElement === canvas;
      if (!locked && !downAt) return;
      if (!locked && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) dragging = true;
      if (!locked && !dragging) return;
      const s = 0.0022 * (this.settings.sens || 1);
      this.yaw -= e.movementX * s; this.pitch -= e.movementY * s;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
      this.recentMouse.push({ t: performance.now(), x: e.movementX, y: e.movementY });
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ---------- desktop actions ----------
  deskClick(button, down) {
    const R = this.hands.right, L = this.hands.left;
    if (button === 0) R.btn.trig = down;
    if (!down) return;
    if (R.grabP && button === 0) { this.releaseGrab(R, this.lookDir(new V3()).multiplyScalar(9).add(new V3(0, 2, 0))); return; }
    if (button === 0 && R.held && R.held.def.saw) { /* trigger runs the saw */ }
    else if (button === 0 && R.held && !R.held.def.gun) this.startSwing();
    else if (button === 0 && !R.held) this.startPunch(R);
    else if (button === 2) { if (L.held && L.held.def.gun) L.btn.trig = true; else this.startPunch(L); }
  }
  lookDir(out) { return out.set(0, 0, -1).applyQuaternion(this.cam.getWorldQuaternion(_q)); }
  startSwing() {
    if (this.swing && this.swing.u < 0.62) return;
    const now = performance.now();
    let dx = 0, dy = 0;
    for (const m of this.recentMouse) if (now - m.t < 160) { dx += m.x; dy += m.y; }
    let type;
    const w = this.hands.right.held;
    if (w.key === 'spear') type = 'thrust';
    else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) { this.swingCycle = ((this.swingCycle || 0) + 1) % 3; type = ['over', 'side', 'back'][this.swingCycle]; }
    else if (Math.abs(dy) > Math.abs(dx)) type = dy > 0 ? 'over' : 'up';
    else type = dx < 0 ? 'side' : 'back';
    const m = w.def.mass;
    this.swing = { type, u: 0, dur: 0.42 + m * 0.05 };
    this.g.sfx.play('whoosh', this.head, 0.6, 1.2 - m * 0.05);
  }
  startPunch(h) { if (this.punch && this.punch.u < 0.7) return; this.punch = { h, u: 0, dur: 0.28 }; }
  startKick() { if (this.kick) return; this.kick = { u: 0, dur: 0.38 }; this.g.sfx.play('whoosh', this.head, 0.4, 0.8); }
  startButt() { if (this.butt) return; this.butt = { u: 0, dur: 0.3 }; }
  deskInteract() {
    const R = this.hands.right;
    if (this.g.hoverBtn) { this.g.hoverBtn.press(); return; }
    if (R.grabP) { this.releaseGrab(R, new V3()); return; }
    if (R.held) return;
    const eye = this.head, dir = this.lookDir(new V3());
    let best = null, bd = 1e9;
    for (const w of this.g.weapons) {
      if (w.mode === 'held' || w.mode === 'holstered') continue;
      _v.subVectors(w.pos, eye); const along = _v.dot(dir);
      if (along < 0 || along > 2.4) continue;
      const off = _v.addScaledVector(dir, -along).length();
      if (off < 0.5 && along + off * 2 < bd) { bd = along + off * 2; best = w; }
    }
    if (best) { best.grab(R, best.def.mount === 'gun' ? 0 : best.def.handle[0] + 0.08); this.g.sfx.play('click', best.pos, 0.5); return; }
    // grab a body part in front of you
    let bp = null; bd = 1e9;
    for (const b of this.g.bodies) for (const p of b.parts) {
      if (p.gone || p.pin) continue;
      _v.subVectors(p.p, eye); const along = _v.dot(dir);
      if (along < 0.2 || along > 1.6) continue;
      const off = _v.addScaledVector(dir, -along).length();
      if (off < 0.35 && along + off * 3 < bd) { bd = along + off * 3; bp = p; }
    }
    if (bp) this.grabPart(R, bp);
  }
  // desktop: 1-4 = holsters (hips, then shoulders). Holding something puts it away (or swaps), empty hand draws.
  holsterKey(i) {
    const H = this.g.holsters, sl = H.slots[i], R = this.hands.right;
    if (!sl) return;
    const held = R.held;
    if (held && sl.w) { const other = sl.w; sl.w = null; H.put(sl, held); other.mesh.visible = true; other.mode = 'rack'; other.grab(R, other.def.mount === 'gun' ? 0 : other.def.handle[0] + 0.08); return; }
    if (held) { H.put(sl, held); return; }
    if (sl.w) H.take(sl, R);
  }
  deskDrop() {
    const R = this.hands.right;
    if (R.grabP) { this.releaseGrab(R, this.lookDir(new V3()).multiplyScalar(6)); return; }
    if (!R.held) return;
    const v = this.lookDir(new V3()).multiplyScalar(R.held.def.throwable ? 14 : 7).add(new V3(0, 1.5, 0));
    R.held.release(R, v);
  }

  grabPart(h, p) {
    h.grabP = p; p.pin = h.pinV.copy(p.p);
    p.body.grabbed++; p.body.wake();
    this.g.sfx.play('punch', p.p, 0.4, 1.4);
  }
  releaseGrab(h, vel) {
    const p = h.grabP; if (!p) return;
    p.pin = null; p.place(p.p, vel);
    // the whole body gets the throw, not just the bit you held
    for (const q of p.body.parts) if (!q.gone && q.cc === p.cc) q.addVel(vel, 0.8);
    p.body.grabbed = Math.max(0, p.body.grabbed - 1);
    h.grabP = null;
  }

  // ---------- per frame ----------
  update(dt) {
    const g = this.g;
    this.headPrev.copy(this.head);
    for (const h of this.H) h.p0.copy(h.pos);
    if (this.vr) this.updateVR(dt); else this.updateDesk(dt);
    this.cam.getWorldPosition(this.head);
    for (const h of this.H) {
      h.vel.subVectors(h.pos, h.p0).multiplyScalar(1 / Math.max(dt, 1e-3));
      h.power = (g.upgrades.punch || 1);
      h.st.mass = 1.4 * h.power; h.st.dmgMul = g.upgrades.dusters ? 1.6 : 1;
      h.glove.userData.knuck.visible = !!g.upgrades.dusters;
      curlHand(h.glove, h.held || h.grabP || h.btn.grip ? 1 : (this.punch && this.punch.h === h) || !this.vr ? 0.9 : h.btn.trig ? 0.6 : 0.15);
    }
    this.actions(dt);
    // player capsule blocks bodies
    const hp = this.head;
    g.phys.player = { x: hp.x, z: hp.z, y0: this.dolly.position.y + 0.1, y1: hp.y + 0.05, r: 0.2 };
    if (this.hurtT > 0) this.hurtT -= dt;
    this.hurtSphere.material.opacity = Math.max(0, this.hurtT) * 0.9 + (this.dead ? 0.6 : 0);
    this.hurtSphere.visible = this.vr && this.hurtSphere.material.opacity > 0.01;
    this.updateWristHud(dt);
    for (const h of this.H) { h.trigTap = h.pressed('trig'); h.prevBtn = { ...h.btn }; }   // after actions, so a click between frames counts as a press
  }

  move(dx, dz, dt) {
    const g = this.g, D = this.dolly.position;
    // gravity + ground
    this.vy -= 9.81 * dt;
    D.y += this.vy * dt;
    const hx = this.head.x || D.x, hz = this.head.z || D.z;
    D.x += dx; D.z += dz;
    const cx = (this.vr ? this.head.x : D.x) + dx * 0, cz = (this.vr ? this.head.z : D.z);
    const gy = g.phys.groundAt(cx, cz, D.y + 0.5, 0.15);
    if (D.y <= gy) { D.y = gy; this.vy = 0; this.onGround = true; } else if (D.y - gy > 0.05) this.onGround = false;
    if (D.y < -30 || (g.world.fallY && D.y < g.world.fallY)) { this.damage(25, null); if (!this.dead) this.spawn(g.world.start.x, g.world.start.z, g.world.start.yaw); }
    // walls
    const r = 0.26, y0 = D.y + 0.45, y1 = D.y + (this.vr ? Math.max(1, this.head.y - D.y) : this.eye);
    let px = this.vr ? this.head.x : D.x, pz = this.vr ? this.head.z : D.z;
    for (const b of g.phys.boxes) {
      if (b.max.y < y0 || b.min.y > y1) continue;
      const qx = Math.max(b.min.x, Math.min(px, b.max.x)), qz = Math.max(b.min.z, Math.min(pz, b.max.z));
      const ddx = px - qx, ddz = pz - qz, d2 = ddx * ddx + ddz * ddz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-8) continue;
      const d = Math.sqrt(d2), push = (r - d) / d;
      D.x += ddx * push; D.z += ddz * push; px += ddx * push; pz += ddz * push;
    }
  }

  updateDesk(dt) {
    const k = this.keys;
    const sp = (k.ShiftLeft ? 5 : 3.2) * dt;
    let fx = 0, fz = 0;
    if (k.KeyW) fz -= 1; if (k.KeyS) fz += 1; if (k.KeyA) fx -= 1; if (k.KeyD) fx += 1;
    const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.move((fx * c + fz * s) * sp, (-fx * s + fz * c) * sp, dt);
    const crouch = k.KeyC || k.ControlLeft;
    this.eye += ((crouch ? 1.05 : 1.65) - this.eye) * Math.min(1, dt * 10);
    this.cam.position.set(0, this.eye, 0);
    // headbutt lunge
    let lunge = 0;
    if (this.butt) { this.butt.u += dt / this.butt.dur; const u = this.butt.u; lunge = u < 0.4 ? u / 0.4 : Math.max(0, 1 - (u - 0.4) / 0.6); if (u >= 1) this.butt = null; }
    this.cam.position.z = -lunge * 0.45; this.cam.position.y -= lunge * 0.12;
    this.dolly.rotation.set(0, this.yaw, 0);
    this.cam.rotation.set(this.pitch - lunge * 0.3, 0, 0, 'YXZ');
    this.cam.updateMatrixWorld(true);
    // hands
    const camQ = this.cam.getWorldQuaternion(new Q());
    const R = this.hands.right, L = this.hands.left;
    this.deskHand(R, camQ, dt, 1);
    this.deskHand(L, camQ, dt, -1);
    this.recentMouse = this.recentMouse.filter(m => performance.now() - m.t < 200);
  }
  deskHand(h, camQ, dt, side) {
    const w = h.held;
    let lp = new V3(0.24 * side, -0.28, -0.42), e = new V3(0, 0, 0);
    if (side < 0 && !w) lp.set(-0.26, -0.34, -0.34);
    if (h.grabP) lp.set(0.12 * side, -0.05, -0.75);
    if (w && w.def.mount === 'gun') lp.set(0.16 * side, w.def.mass > 4 ? -0.3 : -0.17, w.def.mass > 4 ? -0.32 : -0.42);
    if (w && w.def.twoHand && side > 0) lp.set(0.16, -0.32, -0.38);
    // swings (right hand)
    if (side > 0 && this.swing && w && !w.def.gun) {
      const s = this.swing; s.u += dt / s.dur;
      const K = SWINGS[s.type] || SWINGS.over;
      const u = Math.min(1, s.u);
      const [p, r] = sampleSwing(K, u);
      lp.copy(p); e.copy(r);
      if (s.u >= 1) this.swing = null;
    }
    if (this.punch && this.punch.h === h) {
      const pu = this.punch; pu.u += dt / pu.dur;
      const u = Math.min(1, pu.u), k = u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65;
      lp.lerp(new V3(0.05 * side, -0.12, -0.78), Math.sin(k * Math.PI / 2));
      if (pu.u >= 1) this.punch = null;
    }
    h.pos.copy(lp).applyQuaternion(camQ).add(this.cam.getWorldPosition(_w));
    if (w && w.def.mount === 'gun') {
      const aim = this.cam.getWorldPosition(new V3()).addScaledVector(this.lookDir(new V3()), 18);
      _m.lookAt(h.pos, aim, UP); h.quat.setFromRotationMatrix(_m);
    } else {
      h.quat.copy(camQ).multiply(_q.setFromEuler(_e.set(e.x, e.y, e.z, 'YXZ')));
    }
  }

  updateVR(dt) {
    const g = this.g;
    const xrCam = g.renderer.xr.getCamera();
    for (const h of this.H) {
      const gp = h.src && h.src.gamepad;
      if (!gp) continue;
      const b = gp.buttons;
      h.btn.trig = !!(b[0] && b[0].value > 0.5); h.btn.grip = !!(b[1] && b[1].value > 0.5);
      h.btn.a = !!(b[4] && b[4].pressed); h.btn.b = !!(b[5] && b[5].pressed); h.btn.stick = !!(b[3] && b[3].pressed);
      h.axes = [gp.axes[2] || 0, gp.axes[3] || 0];
      h.grip.getWorldPosition(h.pos);
      h.ray.getWorldQuaternion(h.quat);
      const pitch = (this.settings.handPitch || 0) * Math.PI / 180;
      if (pitch) h.quat.multiply(_q.setFromAxisAngle(new V3(1, 0, 0), pitch));
    }
    const L = this.hands.left, R = this.hands.right;
    // smooth locomotion, head-relative
    const ax = L.axes || [0, 0];
    const fwd = new V3(0, 0, -1).applyQuaternion(xrCam.getWorldQuaternion(_q)); fwd.y = 0; fwd.normalize();
    const right = new V3().crossVectors(fwd, UP);
    const sp = (L.btn.stick ? 4.2 : 2.6) * dt;
    const mvx = (right.x * ax[0] - fwd.x * ax[1]) * sp, mvz = (right.z * ax[0] - fwd.z * ax[1]) * sp;
    xrCam.getWorldPosition(this.head);
    this.move(Math.abs(ax[0]) > 0.15 || Math.abs(ax[1]) > 0.15 ? mvx : 0, Math.abs(ax[0]) > 0.15 || Math.abs(ax[1]) > 0.15 ? mvz : 0, dt);
    // snap turn about the head
    const rx = (R.axes || [0, 0])[0];
    this.snapT -= dt;
    if (Math.abs(rx) > 0.7 && this.snapT <= 0) {
      this.snapT = 0.3;
      const ang = rx > 0 ? -Math.PI / 6 : Math.PI / 6;
      const D = this.dolly.position, hx = this.head.x - D.x, hz = this.head.z - D.z;
      const c = Math.cos(ang), s = Math.sin(ang);
      D.x += hx - (hx * c + hz * s); D.z += hz - (-hx * s + hz * c);
      this.dolly.rotation.y += ang;
    }
    if (Math.abs(rx) < 0.3) this.snapT = 0;
    // jump on A; holding A + trigger = kick
    if (R.pressed('a') && this.onGround) { this.vy = 3.6; this.onGround = false; }
    if (R.btn.a && R.pressed('trig') && !(R.held && R.held.def.gun)) this.startKick();
    this.dolly.updateMatrixWorld(true);
    for (const h of this.H) if (h.src) { h.grip.getWorldPosition(h.pos); }
  }

  actions(dt) {
    const g = this.g;
    if (this.vr) {
      for (const h of this.H) {
        if (!h.src) continue;
        if (h.pressed('grip')) this.vrGrab(h);
        if (h.released('grip')) {
          if (h.held) { const hs = h.held.hands.length === 1 && this.g.holsters.nearest(h.pos, 0.24, false); if (hs) this.g.holsters.put(hs, h.held); else h.held.release(h, h.vel.clone().multiplyScalar(1.15)); }
          if (h.grabP) this.releaseGrab(h, h.vel.clone().multiplyScalar(1.3));
        }
        if (h.held && h.held.def.gun && h.pressed('b')) g.reload(h.held);
        if (h.held && h.held.def.gun && h.pressed('stick')) g.cycleFire(h.held);
      }
    }
    for (const h of this.H) {
      const w = h.held;
      if (w && w.def.gun && w.hands[0] === h) g.trigger(w, h.btn.trig, h.pressed('trig'), dt);
      if (w && w.def.saw && w.hands[0] === h) g.sawCtl(w, h.btn.trig, h.pressed('trig'), dt);
    }
    if (!this.vr) this.hands.left.btn.trig = false;
    // kick animation
    if (this.kick) {
      const k = this.kick; k.u += dt / k.dur;
      if (k.u >= 1) { this.kick = null; this.leg.visible = false; }
    }
  }
  vrGrab(h) {
    if (h.held || h.grabP) return;
    const hs = this.g.holsters.nearest(h.pos, 0.22, true);
    if (hs) { this.g.holsters.take(hs, h); return; }
    let best = null, bd = 0.16, by = 0;
    for (const w of this.g.weapons) {
      if (w.hands.includes(h) || w.mode === 'holstered') continue;
      const lp = _v.copy(h.pos).sub(w.pos).applyQuaternion(_q.copy(w.quat).invert());
      if (w.def.mount === 'gun') {
        let d = lp.length();
        if (w.def.twoHand && w.mode === 'held') {                       // support hand anywhere along the barrel
          const e0 = new V3().fromArray(w.def.ends[0]), e1 = new V3().fromArray(w.def.ends[1]), ab = e1.clone().sub(e0);
          const t = Math.max(0, Math.min(1, lp.clone().sub(e0).dot(ab) / ab.lengthSq()));
          d = lp.distanceTo(e0.addScaledVector(ab, t)) * 0.8;
        }
        if (d < bd) { bd = d; best = w; by = 0; }
        continue;
      }
      const y = Math.max(w.def.handle[0], Math.min(w.def.handle[1], lp.y));
      const d = Math.hypot(lp.x, lp.z, lp.y - y);
      if (d < bd) { bd = d; best = w; by = y; }
    }
    if (best) {
      if (best.mode === 'held' && best.def.mount === 'gun' && !best.def.twoHand) return;
      best.grab(h, by); this.g.sfx.play('click', h.pos, 0.4, 0.7); return;
    }
    let bp = null; bd = 0.17;
    for (const b of this.g.bodies) for (const p of b.parts) {
      if (p.gone || p.pin) continue;
      const d = p.p.distanceTo(h.pos) - p.r;
      if (d < bd) { bd = d; bp = p; }
    }
    if (bp) this.grabPart(h, bp);
  }

  // called every physics step with alpha in (0,1]
  step(alpha) {
    const g = this.g;
    for (const h of this.H) {
      if (h.grabP) h.lerpPos(alpha, h.pinV);
      const st = h.st;
      st.prev.copy(st.pos); h.lerpPos(alpha, st.pos);
      if (h.held) {
        // glove sits on the weapon grip and lags with it
        continue;
      }
      if (!h.grabP) g.strike(st);
    }
    // headbutt: VR head speed, or the desktop lunge
    const hs = this.headSt;
    hs.prev.copy(hs.pos); hs.pos.copy(this.headPrev).lerp(this.head, alpha);
    if (hs.pos.distanceTo(hs.prev) / DT > 1.4) g.strike(hs);
    // kick
    if (this.kick) {
      const u = Math.min(1, this.kick.u), ks = this.kickSt;
      const f = u < 0.45 ? u / 0.45 : 1 - (u - 0.45) / 0.55;
      const ext = Math.sin(f * Math.PI / 2);
      const yaw = this.vr ? this.headYaw() : this.yaw;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const base = this.dolly.position;
      ks.prev.copy(ks.pos);
      ks.pos.set(this.head.x + fx * (0.1 + ext * 0.85) + fz * 0.08, base.y + 0.3 + ext * 0.6, this.head.z + fz * (0.1 + ext * 0.85) - fx * 0.08);
      if (u > 0.1 && u < 0.6) g.strike(ks);
      this.poseLeg(ks.pos, yaw);
    }
  }
  headYaw() { const d = this.lookDir(new V3()); return Math.atan2(-d.x, -d.z); }

  render() {
    for (const h of this.H) {
      const w = h.held;
      h.glove.visible = this.vr ? !!h.src : (h.side === 'right' || this.punch?.h === h || !!w);
      if (!this.vr && h.side === 'left' && !w && !(this.punch && this.punch.h === h)) h.glove.visible = false;
      if (w) {
        const i = w.hands.indexOf(h);
        w.worldPoint([0, w.grabY[i], 0], h.glove.position);
        h.glove.quaternion.copy(w.def.mount === 'gun' ? w.quat : _q.copy(w.quat).multiply(INV_MOUNT));
      } else {
        h.glove.position.copy(h.pos); h.glove.quaternion.copy(h.quat);
      }
    }
  }

  damage(amt, from) {
    if (this.dead || this.g.god) return;
    amt *= this.g.upgrades.armor ? 0.6 : 1;
    this.hp -= amt; this.hurtT = 0.45;
    this.g.sfx.play('hurt', null, 0.8, 1, true);
    this.g.flash(0.5);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.g.onPlayerDeath(); }
  }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  makeLeg() {
    const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0x2e3238 }), boot = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 1, 8), m), sh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1, 8), m);
    const ft = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.26), boot);
    g.add(th, sh, ft); g.userData = { th, sh, ft };
    return g;
  }
  poseLeg(foot, yaw) {
    const { th, sh, ft } = this.leg.userData;
    this.leg.visible = true;
    const hip = new V3(this.head.x - Math.cos(yaw) * 0.0, this.dolly.position.y + 0.92, this.head.z);
    const mid = hip.clone().lerp(foot, 0.5); mid.y += 0.15;
    const place = (mesh, a, b) => { mesh.position.copy(a).lerp(b, 0.5); const d = _v.subVectors(b, a); mesh.scale.set(1, d.length(), 1); mesh.quaternion.setFromUnitVectors(UP, d.normalize()); };
    place(th, hip, mid); place(sh, mid, foot);
    ft.position.copy(foot); ft.rotation.set(0, yaw, 0);
  }

  makeWristHud() {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    m.position.set(0, 0.06, 0.07); m.rotation.x = -Math.PI / 2.6;
    this.hands.left.glove.add(m);
    return { cv, tex, m, t: 0 };
  }
  updateWristHud(dt) {
    const h = this.vrHud; h.m.visible = this.vr;
    if (!this.vr || (h.t -= dt) > 0) return;
    h.t = 0.25;
    const c = h.cv.getContext('2d'), g = this.g;
    c.clearRect(0, 0, 256, 128);
    c.fillStyle = 'rgba(15,15,18,0.85)'; c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#c11'; c.fillRect(10, 12, 236 * this.hp / this.maxHp, 20);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(10, 12, 236, 20);
    c.fillStyle = '#fff'; c.font = 'bold 26px sans-serif';
    c.fillText(g.hudLine1(), 10, 66);
    c.font = '22px sans-serif'; c.fillStyle = '#ffd34d';
    c.fillText(g.hudLine2(), 10, 104);
    h.tex.needsUpdate = true;
  }
}
const INV_MOUNT = new Q().setFromAxisAngle(new V3(1, 0, 0), 0.95);

// desktop swing keyframes: [u, pos(cam-local), euler(pitch,yaw,roll)]
const SWINGS = {
  over: [[0, [0.24, -0.28, -0.42], [0, 0, 0]], [0.38, [0.2, 0.25, -0.18], [1.25, 0.1, 0]], [0.62, [0.04, -0.45, -0.62], [-1.0, 0, 0]], [1, [0.24, -0.28, -0.42], [0, 0, 0]]],
  up: [[0, [0.24, -0.28, -0.42], [0, 0, 0]], [0.38, [0.1, -0.5, -0.3], [-1.2, 0, Math.PI]], [0.62, [0.08, 0.3, -0.55], [0.9, 0, Math.PI]], [1, [0.24, -0.28, -0.42], [0, 0, 0]]],
  side: [[0, [0.24, -0.28, -0.42], [0, 0, 0]], [0.38, [0.55, -0.02, -0.22], [0.1, -1.3, -Math.PI / 2]], [0.62, [-0.45, -0.08, -0.55], [0.1, 1.1, -Math.PI / 2]], [1, [0.24, -0.28, -0.42], [0, 0, 0]]],
  back: [[0, [0.24, -0.28, -0.42], [0, 0, 0]], [0.38, [-0.35, 0.0, -0.28], [0.1, 1.2, Math.PI / 2]], [0.62, [0.55, -0.1, -0.5], [0.1, -1.1, Math.PI / 2]], [1, [0.24, -0.28, -0.42], [0, 0, 0]]],
  thrust: [[0, [0.24, -0.28, -0.42], [0, 0, 0]], [0.38, [0.22, -0.2, -0.12], [-0.95, 0, 0]], [0.6, [0.06, -0.08, -0.98], [-0.95, 0, 0]], [1, [0.24, -0.28, -0.42], [0, 0, 0]]],
};
function sampleSwing(K, u) {
  let i = 0; while (i < K.length - 2 && u > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1];
  let t = (u - a[0]) / (b[0] - a[0]); t = Math.max(0, Math.min(1, t));
  // strike segment eases in (fast), windup eases out
  t = i === 1 ? t * t * (3 - 2 * t) : t * t * (3 - 2 * t);
  const p = new V3().fromArray(a[1]).lerp(new V3().fromArray(b[1]), t);
  const r = new V3().fromArray(a[2]).lerp(new V3().fromArray(b[2]), t);
  return [p, r];
}
