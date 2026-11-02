// How weapons reach your hands: a paged weapon wall in every map (tabs + arrows, locked if you haven't bought it),
// stands in the hub to try things, and four body holsters (two hips, two over the shoulders) that ride with you between maps.
import * as THREE from '../vendor/three.module.js?v=5';
import { DEFS, Weapon } from './arsenal.js?v=5';
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const QY = (a) => new Q().setFromAxisAngle(new V3(0, 1, 0), a);
const QX = (a) => new Q().setFromAxisAngle(new V3(1, 0, 0), a);
const QZ = (a) => new Q().setFromAxisAngle(new V3(0, 0, 1), a);

export const TABS = [
  { name: 'MELEE', keys: ['axe', 'shovel', 'spear', 'slab', 'mallet'] },
  { name: 'FIREARMS', keys: ['pistol', 'm16', 'bolt', 'cannon'] },
  { name: 'HEAVY', keys: ['chainsaw', 'nailer', 'minigun'] },
];
const PER_PAGE = 3;

function canvasPlane(w, h, px = 512) {
  const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round(px * h / w);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.userData = { cv, ctx: cv.getContext('2d'), tex };
  return m;
}
// where a weapon's mid-point sits relative to its grip (so it can be centred in a slot)
function midLocal(def) { const e = def.ends; return new V3((e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2, (e[0][2] + e[1][2]) / 2); }

// ---------- slots: wall pegs and hub stands share this; taken weapons come back after a few seconds ----------
export function placeSlot(g, s) {
  const def = DEFS[s.key];
  const q = s.quat.clone();
  const pos = s.pos.clone().sub(midLocal(def).applyQuaternion(q));
  s.w = new Weapon(g, s.key, pos, q, 'rack');
  s.w.trial = s.trial;
  g.weapons.push(s.w);
  s.t = 0;
}
export function updateSlots(g, dt) {
  for (const s of g.world.slots || []) {
    if (s.locked) continue;
    if (s.w && s.w.mode === 'rack') continue;
    s.t += dt;
    if (s.t > 3) placeSlot(g, s);
  }
}

// ---------- weapon wall ----------
export function buildWall(g, w) {
  const spot = w.wallSpot; if (!spot) return;
  w.buttons = w.buttons || []; w.slots = w.slots || [];
  const yaw = spot.yaw, n = new V3(Math.sin(yaw), 0, Math.cos(yaw)), t = new V3(Math.cos(yaw), 0, -Math.sin(yaw));
  const base = new V3(spot.x, spot.y || 0, spot.z);
  const W = 3.6, H = 2.5;
  // backing board on legs (and a physics slab so bodies hit it)
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.06), new THREE.MeshLambertMaterial({ color: '#3a3d42' }));
  board.position.copy(base).addScaledVector(n, 0.04).add(new V3(0, 0.25 + H / 2, 0)); board.quaternion.copy(QY(yaw)); w.group.add(board);
  const peg = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, H - 0.5), new THREE.MeshLambertMaterial({ color: '#5a5e64' }));
  peg.position.copy(board.position).addScaledVector(n, 0.031).add(new V3(0, -0.2, 0)); peg.quaternion.copy(QY(yaw)); w.group.add(peg);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), new THREE.MeshLambertMaterial({ color: '#2a2c30' })); leg.position.copy(base).addScaledVector(t, s * (W / 2 - 0.1)).addScaledVector(n, 0.04).add(new V3(0, 0.15, 0)); w.group.add(leg); }
  const c0 = base.clone().addScaledVector(t, -W / 2).addScaledVector(n, -0.02), c1 = base.clone().addScaledVector(t, W / 2).addScaledVector(n, 0.1);
  w.box(c0.x, base.y, c0.z, c1.x, base.y + 0.25 + H, c1.z, { hidden: true });
  const at = (dx, dy, dz = 0.07) => base.clone().addScaledVector(t, dx).addScaledVector(n, 0.07 + dz).add(new V3(0, dy, 0));
  const face = (m, dx, dy) => { m.position.copy(at(dx, dy)); m.quaternion.copy(QY(yaw)); w.group.add(m); return m; };
  const st = w.wall = { tab: 0, page: 0, yaw, base, n, t, at, slotMeshes: [] };
  // tabs + arrows along the top
  TABS.forEach((tab, i) => {
    const m = face(canvasPlane(0.9, 0.26, 512), (i - 1) * 1.0, 0.25 + H - 0.22);
    const btn = { obj: m, r: 0.22, kind: 'wall', tab: i, press: () => { st.tab = i; st.page = 0; fillWall(g); } };
    btn.refresh = () => drawTab(m, tab.name, st.tab === i);
    w.buttons.push(btn); btn.refresh();
  });
  for (const s of [-1, 1]) {
    const m = face(canvasPlane(0.3, 0.3, 256), s * (W / 2 - 0.25), 0.25 + H / 2 - 0.2);
    const btn = { obj: m, r: 0.2, kind: 'wall', press: () => { const pages = Math.ceil(TABS[st.tab].keys.length / PER_PAGE); st.page = (st.page + s + pages) % pages; fillWall(g); } };
    btn.refresh = () => drawArrow(m, s, Math.ceil(TABS[st.tab].keys.length / PER_PAGE) > 1);
    w.buttons.push(btn); btn.refresh();
  }
  for (let i = 0; i < PER_PAGE; i++) {
    const label = face(canvasPlane(0.95, 0.2, 512), (i - 1) * 1.05, 0.42);
    st.slotMeshes.push(label);
  }
  fillWall(g);
}
export function fillWall(g) {
  const w = g.world, st = w.wall; if (!st) return;
  // clear this wall's old slots
  for (const s of w.slots.filter(s => s.wall)) { if (s.w && s.w.mode === 'rack') g.removeWeapon(s.w); }
  w.slots = w.slots.filter(s => !s.wall);
  const keys = TABS[st.tab].keys.slice(st.page * PER_PAGE, st.page * PER_PAGE + PER_PAGE);
  for (let i = 0; i < PER_PAGE; i++) {
    const key = keys[i], label = st.slotMeshes[i];
    const locked = key && !g.wallAllows(key);
    drawLabel(label, key ? DEFS[key].name : '', locked);
    if (!key) continue;
    const def = DEFS[key];
    // melee hangs upright with the edge sideways; guns hang flat, barrel along the wall
    const q = QY(st.yaw).multiply(def.wide ? new Q() : QY(Math.PI / 2));     // show the flat side (a spade is wide the other way)
    const s = { key, pos: st.at((i - 1) * 1.05, 1.42, 0.06), quat: q, wall: true, locked, t: 0, w: null };
    w.slots.push(s);
    if (!locked) placeSlot(g, s);
  }
  for (const b of w.buttons) if (b.kind === 'wall') b.refresh();
}
function drawTab(m, text, on) {
  const { ctx: c, cv, tex } = m.userData;
  c.clearRect(0, 0, cv.width, cv.height);
  c.fillStyle = on ? '#e6c84a' : '#1d1f23'; c.strokeStyle = '#0c0c0c'; c.lineWidth = 8;
  c.beginPath(); c.roundRect ? c.roundRect(4, 4, cv.width - 8, cv.height - 8, 22) : c.rect(4, 4, cv.width - 8, cv.height - 8); c.fill(); c.stroke();
  c.fillStyle = on ? '#1b1b1b' : '#e9e9e9'; c.font = "bold 64px 'Roboto Mono', monospace"; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, cv.width / 2, cv.height / 2 + 4); tex.needsUpdate = true;
}
function drawArrow(m, s, on) {
  const { ctx: c, cv, tex } = m.userData, W = cv.width;
  c.clearRect(0, 0, W, W);
  c.globalAlpha = on ? 1 : 0.25;
  c.fillStyle = '#f2f2f2'; c.beginPath();
  if (s > 0) { c.moveTo(W * 0.3, W * 0.15); c.lineTo(W * 0.8, W * 0.5); c.lineTo(W * 0.3, W * 0.85); } else { c.moveTo(W * 0.7, W * 0.15); c.lineTo(W * 0.2, W * 0.5); c.lineTo(W * 0.7, W * 0.85); }
  c.closePath(); c.fill(); c.lineWidth = 10; c.strokeStyle = '#111'; c.stroke(); c.globalAlpha = 1;
  tex.needsUpdate = true;
}
function drawLabel(m, name, locked) {
  const { ctx: c, cv, tex } = m.userData;
  c.clearRect(0, 0, cv.width, cv.height);
  if (!name) { tex.needsUpdate = true; return; }
  c.fillStyle = locked ? '#2a1414' : '#f4f2ec'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = locked ? '#ff6a5a' : '#1b1b1b'; c.font = "bold 46px 'Roboto Mono', monospace"; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(locked ? `LOCKED · ${name}` : name, cv.width / 2, cv.height / 2 + 2);
  tex.needsUpdate = true;
}

// ---------- holsters ----------
// offsets in the body frame (x right, y up from the head, z back), plus how the weapon hangs
export const HOLSTERS = [
  { name: 'hipL', off: [-0.19, -0.74, -0.02] },
  { name: 'hipR', off: [0.19, -0.74, -0.02] },
  { name: 'backL', off: [-0.14, -0.2, 0.17], back: true, tilt: 0.45 },
  { name: 'backR', off: [0.14, -0.2, 0.17], back: true, tilt: -0.45 },
];
export class Holsters {
  constructor(g) { this.g = g; this.slots = HOLSTERS.map(h => ({ ...h, w: null, pos: new V3(), quat: new Q() })); this.bodyYaw = 0; }
  update(dt) {
    const P = this.g.player, head = P.head;
    // body yaw follows the head lazily (you can look over your shoulder without the holsters swinging)
    const hy = P.vr ? P.headYaw() : P.yaw;
    let d = hy - this.bodyYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) > 0.6) this.bodyYaw += d - Math.sign(d) * 0.6;
    this.bodyYaw += d * Math.min(1, dt * 1.5);
    const bq = QY(this.bodyYaw);
    for (const s of this.slots) {
      s.pos.set(s.off[0], s.off[1], s.off[2]).applyQuaternion(bq).add(head);
      if (!P.vr) s.pos.y = Math.max(s.pos.y, P.dolly.position.y + 0.2);
      if (s.w) {
        const def = s.w.def, gun = def.mount === 'gun';
        // weapons hang muzzle / blade down; shoulder ones tilt across the back
        s.quat.copy(bq);
        if (s.back) s.quat.multiply(QZ(s.tilt));
        s.quat.multiply(gun ? QX(-Math.PI / 2) : QX(Math.PI));
        const w = s.w;
        w.quat.copy(s.quat);
        const grip = gun ? new V3() : new V3(0, def.handle[1] * 0.4, 0);
        w.pos.copy(s.pos).sub(grip.applyQuaternion(w.quat));
        w.shapesNow(); w.copyPrev();
        w.mesh.visible = !(P.vr === false && s.back);           // desktop: shoulder weapons would block the view
      }
    }
  }
  nearest(pos, r = 0.2, wantFull = null) {
    let best = null, bd = r;
    for (const s of this.slots) {
      if (wantFull === true && !s.w) continue;
      if (wantFull === false && s.w) continue;
      const d = s.pos.distanceTo(pos); if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  put(s, w) {
    for (const h of w.hands.slice()) w.release(h, new V3());
    w.dropLoose(); w.mode = 'holstered'; s.w = w;
    this.g.sfx.play('click', s.pos, 0.5, 0.8);
  }
  take(s, hand) {
    const w = s.w; s.w = null; w.mesh.visible = true;
    w.mode = 'rack'; w.grab(hand, w.def.mount === 'gun' ? 0 : w.def.handle[0] + 0.08);
    this.g.sfx.play('click', s.pos, 0.5, 1.1);
  }
  keys() { return this.slots.map(s => s.w ? s.w.key : null); }
  clear() { for (const s of this.slots) s.w = null; }
  restore(keys) {
    keys.forEach((k, i) => {
      if (!k || !DEFS[k]) return;
      const w = new Weapon(this.g, k, this.g.player.head, new Q(), 'rack');
      this.g.weapons.push(w); w.mode = 'holstered'; this.slots[i].w = w;
    });
  }
}
