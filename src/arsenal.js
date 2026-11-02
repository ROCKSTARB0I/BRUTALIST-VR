// Weapons: real mass, held on a spring so heavy things lag behind your hand.
// Local frame: grip at origin. Melee: handle along +Y, cutting edge faces -Z. Guns: barrel along -Z.
import * as THREE from '../vendor/three.module.js?v=6';
import { Particle, DT } from './phys.js?v=6';
import { MODELS } from './models.js?v=6';
const V3 = THREE.Vector3, Q = THREE.Quaternion;

const M = {};
function mat(hex) { return M[hex] || (M[hex] = new THREE.MeshLambertMaterial({ color: hex })); }
const WOOD = 0x8a5a33, STEEL = 0xb9bec4, DARK = 0x3a3a3e, EDGE = 0xe4e8ec, GRIP = 0x2b2420, BRASS = 0xd4a52a;
function box(g, w, h, d, c, x = 0, y = 0, z = 0, rx = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; }
function cyl(g, r0, r1, len, c, x = 0, y = 0, z = 0, axis = 'y', seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg), mat(c));
  m.position.set(x, y, z); if (axis === 'z') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2;
  g.add(m); return m;
}

export const DEFS = {
  axe: {
    name: 'Hatchet', mass: 2.0, price: 0, handle: [-0.06, 0.5],
    build() { const g = new THREE.Group(); cyl(g, 0.022, 0.018, 0.72, WOOD, 0, 0.27); box(g, 0.026, 0.12, 0.16, STEEL, 0, 0.58, -0.035); box(g, 0.028, 0.125, 0.022, EDGE, 0, 0.58, -0.115); box(g, 0.04, 0.06, 0.05, DARK, 0, 0.58, 0.07); return g; },
    shapes: [{ a: [0, -0.08, 0], b: [0, 0.62, 0], r: 0.025 }, { a: [0, 0.58, 0.07], b: [0, 0.58, -0.09], r: 0.05 },
      { a: [0, 0.515, -0.115], b: [0, 0.645, -0.115], r: 0.022, edge: [0, 0, -1], sharp: 1.1 }],
    ends: [[0, -0.08, 0], [0, 0.62, -0.05]],
  },
  slab: {
    name: 'The Slab', mass: 4.6, price: 900, handle: [-0.06, 0.32], twoHand: true,
    build() { const g = new THREE.Group(); cyl(g, 0.021, 0.021, 0.42, GRIP, 0, 0.14); box(g, 0.05, 0.045, 0.24, DARK, 0, 0.37); box(g, 0.026, 1.06, 0.12, STEEL, 0, 0.92); box(g, 0.028, 1.06, 0.018, EDGE, 0, 0.92, -0.06); box(g, 0.028, 1.06, 0.018, EDGE, 0, 0.92, 0.06); cyl(g, 0.03, 0.03, 0.04, DARK, 0, -0.08); return g; },
    shapes: [{ a: [0, -0.08, 0], b: [0, 0.35, 0], r: 0.025 },
      { a: [0, 0.4, 0], b: [0, 1.45, 0], r: 0.035, edge: [0, 0, -1], double: true, sharp: 1.3 }],
    ends: [[0, -0.08, 0], [0, 1.45, 0]],
  },
  shovel: {
    name: 'Spade', mass: 2.4, price: 250, handle: [-0.1, 0.88], wide: true,
    build() { const g = new THREE.Group(); cyl(g, 0.018, 0.017, 1.05, WOOD, 0, 0.42); box(g, 0.1, 0.03, 0.03, WOOD, 0, -0.1); box(g, 0.22, 0.27, 0.012, 0x8d9399, 0, 1.1); box(g, 0.224, 0.02, 0.014, EDGE, 0, 1.235); box(g, 0.05, 0.08, 0.03, 0x8d9399, 0, 0.95); return g; },
    shapes: [{ a: [0, -0.1, 0], b: [0, 0.95, 0], r: 0.022 }, { a: [0, 0.98, 0], b: [0, 1.22, 0], r: 0.07 },
      { a: [-0.1, 1.24, 0], b: [0.1, 1.24, 0], r: 0.016, edge: [0, 1, 0], sharp: 1.0 },
      { a: [0.11, 0.98, 0], b: [0.11, 1.22, 0], r: 0.014, edge: [1, 0, 0], sharp: 0.8 },
      { a: [-0.11, 0.98, 0], b: [-0.11, 1.22, 0], r: 0.014, edge: [-1, 0, 0], sharp: 0.8 }],
    ends: [[0, -0.1, 0], [0, 1.24, 0]],
  },
  spear: {
    name: 'Short Spear', mass: 1.3, price: 150, handle: [-0.55, 0.92], throwable: true,
    build() { const g = new THREE.Group(); cyl(g, 0.015, 0.014, 1.55, WOOD, 0, 0.22); const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 6), mat(STEEL)); c.position.y = 1.11; g.add(c); box(g, 0.04, 0.03, 0.04, DARK, 0, 0.99); return g; },
    shapes: [{ a: [0, -0.55, 0], b: [0, 1.0, 0], r: 0.02 },
      { a: [0, 1.0, 0], b: [0, 1.22, 0], r: 0.022, stab: true, edge: [0, 0, -1], double: true, sharp: 1.3 }],
    ends: [[0, -0.55, 0], [0, 1.22, 0]],
  },
  pistol: {
    name: 'Service Pistol', mass: 1.0, price: 300, handle: [-0.06, 0.06], mount: 'gun',
    gun: { dmg: 1, pen: 1.3, force: 3, mag: 12, sound: 'pistol', recoil: 0.5, auto: false, rpm: 600, reload: 1.1 },
    muzzle: [0, 0.045, -0.165],
    build() {
      const g = new THREE.Group();
      box(g, 0.03, 0.034, 0.2, DARK, 0, 0.047, -0.065); box(g, 0.026, 0.02, 0.18, 0x55585c, 0, 0.022, -0.06);
      box(g, 0.028, 0.105, 0.044, GRIP, 0, -0.02, 0.012, 0.25); box(g, 0.006, 0.03, 0.03, DARK, 0, 0.0, -0.025);
      // open magazine: rounds show through a slot in the grip
      g.userData.rounds = [];
      for (let i = 0; i < 12; i++) { const r = cyl(g, 0.0045, 0.0045, 0.012, BRASS, 0.0155, 0.02 - i * 0.0072, 0.006 + i * 0.0018, 'z', 6); g.userData.rounds.push(r); }
      return g;
    },
    shapes: [{ a: [0, 0.04, 0.04], b: [0, 0.045, -0.16], r: 0.03 }],
    ends: [[0, 0, 0.03], [0, 0.045, -0.16]],
  },
  chainsaw: {
    name: 'Chainsaw', mass: 5.5, price: 2200, handle: [-0.02, 0.12], saw: true,
    build() {
      const g = new THREE.Group();
      box(g, 0.1, 0.16, 0.26, 0xd6462a, 0, 0.02, 0.08); box(g, 0.1, 0.05, 0.12, DARK, 0, 0.12, 0.1);          // engine body + top
      cyl(g, 0.016, 0.016, 0.12, DARK, 0, 0.13, -0.02, 'x');                                                     // front handle
      box(g, 0.012, 0.075, 0.62, STEEL, 0, 0.0, -0.33);                                                           // bar
      const chain = box(g, 0.016, 0.085, 0.64, 0x2d2d30, 0, 0.0, -0.33); chain.scale.y = 1;                      // chain rim
      g.userData.chain = chain;
      cyl(g, 0.01, 0.01, 0.05, GRIP, 0.055, 0.06, 0.12, 'x');                                                     // pull cord
      return g;
    },
    shapes: [{ a: [0, 0.02, 0.18], b: [0, 0.02, -0.02], r: 0.08 },
      { a: [0, 0.0, -0.04], b: [0, 0.0, -0.64], r: 0.045, edge: [0, -1, 0], double: true, sharp: 1.6, saw: true }],
    ends: [[0, 0.02, 0.2], [0, 0, -0.64]], mount: 'gun', twoHand: true,
  },
  m16: {
    name: 'M16', mass: 3.3, price: 1800, handle: [-0.06, 0.06], mount: 'gun', twoHand: true,
    gun: { dmg: 1.3, pen: 2.2, force: 3.6, mag: 30, sound: 'rifle', recoil: 0.35, auto: false, rpm: 760, reload: 1.6, modes: ['semi', 'burst', 'auto'] },
    muzzle: [0, 0.06, -0.62],
    build() {
      const g = new THREE.Group();
      box(g, 0.035, 0.06, 0.32, DARK, 0, 0.05, -0.08); box(g, 0.03, 0.05, 0.22, 0x2a2a2c, 0, 0.04, 0.2);         // receiver + stock
      cyl(g, 0.009, 0.009, 0.36, DARK, 0, 0.06, -0.42, 'z'); box(g, 0.04, 0.04, 0.2, 0x26262a, 0, 0.055, -0.3); // barrel + handguard
      box(g, 0.026, 0.09, 0.04, GRIP, 0, -0.02, 0.0, 0.2); box(g, 0.01, 0.035, 0.12, DARK, 0, 0.1, -0.04);       // grip + carry handle
      // open magazine: rounds visible in a slot
      const mag = box(g, 0.026, 0.13, 0.05, 0x3b3b3e, 0, -0.04, -0.12, -0.2);
      g.userData.rounds = []; for (let i = 0; i < 10; i++) { const r = cyl(g, 0.004, 0.004, 0.012, BRASS, 0.014, -0.0 - i * 0.011, -0.115 - i * 0.002, 'z', 5); g.userData.rounds.push(r); }
      g.userData.roundsPer = 3;
      return g;
    },
    shapes: [{ a: [0, 0.05, 0.3], b: [0, 0.06, -0.6], r: 0.035 }],
    ends: [[0, 0.04, 0.3], [0, 0.06, -0.6]],
  },
  bolt: {
    name: 'Hunting Rifle', mass: 3.8, price: 1400, handle: [-0.06, 0.06], mount: 'gun', twoHand: true,
    gun: { dmg: 2.6, pen: 4.5, force: 7, mag: 5, sound: 'rifle', recoil: 0.9, auto: false, rpm: 55, reload: 2.4 },
    muzzle: [0, 0.055, -0.8],
    build() {
      const g = new THREE.Group();
      box(g, 0.04, 0.07, 0.9, WOOD, 0, 0.02, -0.1); cyl(g, 0.01, 0.01, 0.5, DARK, 0, 0.055, -0.55, 'z');
      cyl(g, 0.018, 0.018, 0.2, 0x202024, 0, 0.11, -0.12, 'z'); cyl(g, 0.006, 0.006, 0.05, STEEL, 0.03, 0.06, 0.02, 'x');  // scope + bolt
      box(g, 0.03, 0.08, 0.04, WOOD, 0, -0.04, 0.02, 0.25);
      g.userData.rounds = []; for (let i = 0; i < 5; i++) { const r = cyl(g, 0.005, 0.005, 0.02, BRASS, 0.02, 0.02, -0.08 - i * 0.025, 'z', 5); g.userData.rounds.push(r); }
      return g;
    },
    shapes: [{ a: [0, 0.03, 0.35], b: [0, 0.055, -0.8], r: 0.04 }],
    ends: [[0, 0.02, 0.35], [0, 0.055, -0.8]],
  },
  minigun: {
    name: 'Minigun', mass: 14, price: 7000, handle: [-0.06, 0.06], mount: 'gun', twoHand: true,
    gun: { dmg: 1.1, pen: 2, force: 3, mag: 400, sound: 'rifle', recoil: 0.12, auto: true, rpm: 2200, reload: 3.5, spin: true },
    muzzle: [0, 0.03, -0.75],
    build() {
      const g = new THREE.Group();
      box(g, 0.14, 0.14, 0.32, DARK, 0, 0.03, 0.04);
      const barrels = new THREE.Group(); barrels.position.set(0, 0.03, -0.42); g.add(barrels);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cyl(barrels, 0.012, 0.012, 0.62, 0x2c2c30, Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0, 'z', 6); }
      cyl(barrels, 0.05, 0.05, 0.03, 0x3a3a3e, 0, 0, -0.25, 'z', 10); g.userData.barrels = barrels;
      box(g, 0.03, 0.1, 0.04, GRIP, 0, -0.07, 0.12); box(g, 0.2, 0.03, 0.03, GRIP, 0, 0.14, -0.05);
      box(g, 0.12, 0.16, 0.14, 0x4a5235, 0.12, -0.02, 0.08);                                                       // ammo box
      return g;
    },
    shapes: [{ a: [0, 0.03, 0.2], b: [0, 0.03, -0.72], r: 0.08 }],
    ends: [[0, 0.03, 0.2], [0, 0.03, -0.72]],
  },
  nailer: {
    name: 'Nail Launcher', mass: 2.6, price: 1600, handle: [-0.06, 0.06], mount: 'gun',
    gun: { dmg: 0.7, pen: 1.2, force: 2, mag: 24, sound: 'nail', recoil: 0.3, auto: false, rpm: 300, reload: 1.4, nail: true },
    muzzle: [0, 0.07, -0.3],
    build() {
      const g = new THREE.Group();
      box(g, 0.07, 0.11, 0.3, 0xe0b22a, 0, 0.06, -0.12); box(g, 0.03, 0.12, 0.05, DARK, 0, -0.03, 0.03, 0.2);
      cyl(g, 0.012, 0.012, 0.06, STEEL, 0, 0.07, -0.29, 'z'); box(g, 0.02, 0.03, 0.22, 0x8a8f96, 0, -0.0, -0.16, 0);  // nose + nail strip
      g.userData.rounds = []; for (let i = 0; i < 12; i++) { const r = cyl(g, 0.0025, 0.0025, 0.04, STEEL, 0, -0.02, -0.06 - i * 0.017, 'y', 4); g.userData.rounds.push(r); }
      g.userData.roundsPer = 2;
      return g;
    },
    shapes: [{ a: [0, 0.06, 0.04], b: [0, 0.07, -0.3], r: 0.05 }],
    ends: [[0, 0.03, 0.04], [0, 0.07, -0.3]],
  },
  cannon: {
    name: 'Hand-Cannon', mass: 2.4, price: 2600, handle: [-0.06, 0.06], mount: 'gun',
    gun: { dmg: 3, pen: 6, force: 9, mag: 6, sound: 'cannon', recoil: 1.6, auto: false, rpm: 110, reload: 2.2 },
    muzzle: [0, 0.06, -0.36],
    build() {
      const g = new THREE.Group();
      cyl(g, 0.026, 0.026, 0.3, 0x2e2f33, 0, 0.06, -0.2, 'z', 10); cyl(g, 0.04, 0.04, 0.08, 0x45474c, 0, 0.055, -0.02, 'z', 6); // barrel + cylinder
      box(g, 0.035, 0.12, 0.05, WOOD, 0, -0.03, 0.04, 0.3); box(g, 0.008, 0.03, 0.03, DARK, 0, 0.0, -0.01);
      g.userData.rounds = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const r = cyl(g, 0.009, 0.009, 0.012, 0xc4362e, Math.cos(a) * 0.024, 0.055 + Math.sin(a) * 0.024, 0.025, 'z', 6); g.userData.rounds.push(r); }
      return g;
    },
    shapes: [{ a: [0, 0.04, 0.06], b: [0, 0.06, -0.35], r: 0.04 }],
    ends: [[0, 0.02, 0.06], [0, 0.06, -0.35]],
  },
  mallet: {
    name: 'Gilded Mallet', mass: 1.6, price: 25000, handle: [-0.06, 0.4], homerun: true,
    build() { const g = new THREE.Group(); cyl(g, 0.018, 0.016, 0.55, 0x6b3b1f, 0, 0.2); cyl(g, 0.07, 0.07, 0.2, 0xe6b422, 0, 0.5, 0, 'z', 14); return g; },
    shapes: [{ a: [0, -0.06, 0], b: [0, 0.42, 0], r: 0.022 }, { a: [0, 0.5, 0.1], b: [0, 0.5, -0.1], r: 0.075 }],
    ends: [[0, -0.06, 0], [0, 0.5, 0]],
  },
  vaxe: {
    name: 'Viking Axe', mass: 3.0, price: 800, handle: [-0.08, 0.85], twoHand: true,
    shapes: [{ a: [0, -0.1, 0], b: [0, 0.98, 0], r: 0.025 }, { a: [0, 0.93, 0.05], b: [0, 0.93, -0.07], r: 0.04 },
      { a: [0, 0.79, -0.175], b: [0, 1.07, -0.175], r: 0.022, edge: [0, 0, -1], sharp: 1.25 }],
    ends: [[0, -0.1, 0], [0, 1.0, -0.06]],
  },
  zwei: {
    name: 'Zweihander', mass: 3.4, price: 1500, handle: [-0.12, 0.42], twoHand: true,
    shapes: [{ a: [0, -0.14, 0], b: [0, 0.45, 0], r: 0.024 }, { a: [0, 0.48, 0], b: [0, 0.68, 0], r: 0.02 },
      { a: [0, 0.68, 0], b: [0, 1.74, 0], r: 0.03, edge: [0, 0, -1], double: true, sharp: 1.35 }],
    ends: [[0, -0.14, 0], [0, 1.74, 0]],
  },
  scimitar: {
    name: 'Scimitar', mass: 1.4, price: 600, handle: [-0.04, 0.1],
    shapes: [{ a: [0, -0.06, 0], b: [0, 0.13, 0], r: 0.02 },
      { a: [0, 0.15, -0.01], b: [0, 0.83, -0.1], r: 0.022, edge: [0, 0, -1], sharp: 1.45 }],
    ends: [[0, -0.06, 0], [0, 0.83, -0.1]],
  },
  naginata: {
    name: 'Naginata', mass: 2.5, price: 1100, handle: [-0.9, 0.75], twoHand: true,
    shapes: [{ a: [0, -0.95, 0], b: [0, 1.0, 0], r: 0.02 },
      { a: [0, 1.02, -0.01], b: [0, 1.5, -0.07], r: 0.022, edge: [0, 0, -1], sharp: 1.35 },
      { a: [0, 1.36, -0.05], b: [0, 1.53, -0.08], r: 0.018, stab: true, edge: [0, 0, -1], sharp: 1.3 }],
    ends: [[0, -0.95, 0], [0, 1.5, -0.06]],
  },
  mace: {
    name: 'Flanged Mace', mass: 2.6, price: 700, handle: [-0.06, 0.38], bluntMul: 1.6,
    shapes: [{ a: [0, -0.08, 0], b: [0, 0.45, 0], r: 0.02 }, { a: [0, 0.46, 0], b: [0, 0.66, 0], r: 0.068 }],
    ends: [[0, -0.08, 0], [0, 0.66, 0]],
  },
  pitchfork: {
    name: 'Pitchfork', mass: 1.8, price: 300, handle: [-0.6, 0.8], wide: true, throwable: true,
    shapes: [{ a: [0, -0.65, 0], b: [0, 0.92, 0], r: 0.018 },
      { a: [-0.055, 0.95, 0], b: [-0.055, 1.22, 0], r: 0.008, stab: true, edge: [0, 0, -1], double: true, sharp: 1 },
      { a: [0, 0.95, 0], b: [0, 1.24, 0], r: 0.008, stab: true, edge: [0, 0, -1], double: true, sharp: 1 },
      { a: [0.055, 0.95, 0], b: [0.055, 1.22, 0], r: 0.008, stab: true, edge: [0, 0, -1], double: true, sharp: 1 }],
    ends: [[0, -0.65, 0], [0, 1.22, 0]],
  },
  autocannon: {
    name: 'Autocannon', mass: 9, price: 6000, handle: [-0.06, 0.06], mount: 'gun', twoHand: true,
    gun: { dmg: 4, ball: true, pen: 0, force: 0, mag: 8, sound: 'cannon', recoil: 1.4, auto: false, rpm: 140, reload: 3 },
    muzzle: [0, 0.05, -0.88],
    shapes: [{ a: [0, 0.04, 0.3], b: [0, 0.05, -0.85], r: 0.07 }],
    ends: [[0, 0.04, 0.3], [0, 0.05, -0.85]],
  },
  spawner: {
    name: 'Spawn Gun', mass: 1.3, price: 0, handle: [-0.06, 0.06], mount: 'gun', sandboxOnly: true,
    gun: { spawner: true, dmg: 0, pen: 0, force: 0, mag: 999, sound: 'click', recoil: 0.1, auto: false, rpm: 300, reload: 0.1 },
    muzzle: [0, 0.06, -0.26],
    shapes: [{ a: [0, 0.04, 0.04], b: [0, 0.06, -0.25], r: 0.04 }],
    ends: [[0, 0.02, 0.04], [0, 0.06, -0.25]],
  },
};

for (const k in MODELS) if (DEFS[k]) DEFS[k].build = MODELS[k];

const MOUNT_MELEE = new Q().setFromAxisAngle(new V3(1, 0, 0), -0.95);
const _v = new V3(), _w = new V3(), _q = new Q(), _q2 = new Q();

export class Weapon {
  constructor(g, key, pos, quat, mode = 'loose') {
    this.g = g; this.key = key; this.def = DEFS[key];
    this.mesh = this.def.build(); g.scene.add(this.mesh);
    this.mesh.traverse(m => { if (m.isMesh) m.castShadow = true; });
    this.pos = pos.clone(); this.quat = quat.clone(); this.vel = new V3();
    this.mode = mode; this.hands = []; this.grabY = [];
    this.cur = this.def.shapes.map(() => ({ a: new V3(), b: new V3() }));
    this.prev = this.def.shapes.map(() => ({ a: new V3(), b: new V3() }));
    this.ammo = this.def.gun ? this.def.gun.mag : 0;
    this.impaled = []; this.reloadT = 0; this.fireT = 0; this.burst = 0;
    this.shapesNow(); this.copyPrev();
    if (mode === 'loose') this.makeLoose(new V3());
    this.sync();
  }
  shapesNow() {
    const s = this.def.shapes;
    for (let i = 0; i < s.length; i++) {
      this.cur[i].a.fromArray(s[i].a).applyQuaternion(this.quat).add(this.pos);
      this.cur[i].b.fromArray(s[i].b).applyQuaternion(this.quat).add(this.pos);
    }
  }
  copyPrev() { for (let i = 0; i < this.cur.length; i++) { this.prev[i].a.copy(this.cur[i].a); this.prev[i].b.copy(this.cur[i].b); } }
  worldPoint(local, out) { return out.fromArray(local).applyQuaternion(this.quat).add(this.pos); }
  edgeW(k, out) { return out.fromArray(this.def.shapes[k].edge).applyQuaternion(this.quat); }

  // ---- held ----
  grab(hand, yLocal) {
    if (this.mode === 'loose') this.dropLoose();
    if (this.hands.length === 0) this.vel.set(0, 0, 0);
    this.mode = 'held';
    this.hands.push(hand); this.grabY.push(yLocal);
    hand.held = this;
  }
  release(hand, vel) {
    const i = this.hands.indexOf(hand); if (i < 0) return;
    this.hands.splice(i, 1); this.grabY.splice(i, 1);
    hand.held = null;
    if (this.hands.length === 0) { this.mode = 'loose'; this.makeLoose(vel || this.vel); }
  }
  mountQ(hand) { return this.def.mount === 'gun' ? hand.quat : _q2.copy(hand.quat).multiply(MOUNT_MELEE); }
  stepHeld(alpha) {
    const h = this.hands[0], gy = this.grabY[0];
    const hp = h.lerpPos(alpha, _w);
    const tq = _q.copy(this.mountQ(h));
    if (this.hands[1]) {                                      // two hands: aim the handle from hand to hand
      const h2 = this.hands[1], d = h2.lerpPos(alpha, new V3()).sub(hp);
      if (d.lengthSq() > 0.004) {
        d.normalize(); if (this.grabY[1] < gy) d.negate();
        const cur = (this.def.mount === 'gun' ? new V3(0, 0, -1) : new V3(0, 1, 0)).applyQuaternion(tq);
        tq.premultiply(new Q().setFromUnitVectors(cur, d));
      }
    }
    const tp = new V3(0, gy, 0).applyQuaternion(tq).negate().add(hp);
    const m = this.def.mass * (this.hands[1] ? 0.55 : 1) / (h.power || 1);
    const w = 34 / Math.sqrt(m);
    // critically damped spring toward the hand
    _v.subVectors(tp, this.pos).multiplyScalar(w * w).addScaledVector(this.vel, -2 * w);
    this.vel.addScaledVector(_v, DT);
    this.pos.addScaledVector(this.vel, DT);
    if (this.pos.distanceToSquared(tp) > 0.5) { this.pos.copy(tp); this.vel.set(0, 0, 0); }
    this.quat.slerp(tq, 1 - Math.exp(-w * 0.9 * DT));
  }
  // ---- loose (two particles, roll carried along) ----
  makeLoose(vel) {
    const g = this.g, e = this.def.ends;
    const p0 = this.worldPoint(e[0], new V3()), p1 = this.worldPoint(e[1], new V3());
    const m = this.def.mass / 2;
    this.lp = [new Particle(p0, 0.035, m), new Particle(p1, 0.035, m)];
    const spin = this.spinVel || new V3();
    this.lp[0].place(p0, vel.clone().addScaledVector(spin, -0.5));
    this.lp[1].place(p1, vel.clone().addScaledVector(spin, 0.5));
    for (const p of this.lp) { p.fric = 0.7; p.weapon = this; g.phys.add(p); }
    this.lstick = g.phys.link(this.lp[0], this.lp[1]);
    this.axisL = new V3().fromArray(e[1]).sub(new V3().fromArray(e[0])).normalize();
  }
  dropLoose() {
    if (!this.lp) return;
    for (const p of this.lp) p.gone = true;
    this.lstick.on = false; this.lp = null;
  }
  stepLoose() {
    const [a, b] = this.lp;
    const ax = _v.subVectors(b.p, a.p).normalize();
    const cur = _w.copy(this.axisL).applyQuaternion(this.quat);
    this.quat.premultiply(_q.setFromUnitVectors(cur, ax)).normalize();
    this.pos.copy(a.p).sub(new V3().fromArray(this.def.ends[0]).applyQuaternion(this.quat));
    this.vel.copy(a.vel(new V3())).add(b.vel(new V3())).multiplyScalar(0.5);
  }

  step(alpha) {
    this.copyPrev();
    if (this.mode === 'held') this.stepHeld(alpha);
    else if (this.mode === 'loose') this.stepLoose();
    this.shapesNow();
    // tip velocity drives spin when thrown
    if (this.mode === 'held') {
      const n = this.cur.length - 1;
      this.spinVel = (this.spinVel || new V3()).subVectors(this.cur[n].b, this.prev[n].b).multiplyScalar(1 / DT).sub(this.vel);
    }
    for (const im of this.impaled) im.p.pin = this.worldPoint(im.local, im.pin);
  }
  sync() {
    this.mesh.position.copy(this.pos); this.mesh.quaternion.copy(this.quat);
    const r = this.mesh.userData.rounds;
    if (r) { const per = this.mesh.userData.roundsPer || 1; for (let i = 0; i < r.length; i++) r[i].visible = i < Math.ceil(this.ammo / per); }
    const bar = this.mesh.userData.barrels; if (bar) bar.rotation.z += (this.spin || 0) * 0.016 * 60;
  }
  impale(p) {
    if (this.impaled.some(i => i.p === p)) return;
    const local = p.p.clone().sub(this.pos).applyQuaternion(this.quat.clone().invert());
    this.impaled.push({ p, local: local.toArray(), pin: new V3(), t: this.g.time });
  }
  unimpale(i) { const im = this.impaled[i]; im.p.pin = null; im.p.addVel(this.vel); this.impaled.splice(i, 1); }
  dispose() { if (this.motor) { this.motor.stop(); this.motor = null; } this.g.scene.remove(this.mesh); this.dropLoose(); for (let i = this.impaled.length - 1; i >= 0; i--) this.unimpale(i); }
}
