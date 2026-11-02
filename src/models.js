// Weapon models built from real side profiles (cut out and extruded, bevelled edges), with real parts:
// receivers, trigger guards, sights, fullers, tapered blade edges, open magazines showing the rounds.
// Same local frames as arsenal.js: melee handle along +Y with the edge facing -Z; guns barrel along -Z.
import * as THREE from '../vendor/three.module.js?v=4';
const V3 = THREE.Vector3;

const MC = {};
function M(c, shin = 0) {
  const k = c + ':' + shin;
  return MC[k] || (MC[k] = new THREE.MeshPhongMaterial({ color: c, shininess: shin, specular: shin > 30 ? 0x555555 : 0x161616 }));
}
const STEEL = () => M(0xb9bec6, 80), EDGE = () => M(0xe8ecf0, 110), DARKSTEEL = () => M(0x45484e, 50), BLUED = () => M(0x24262b, 55);
const POLY = () => M(0x1d1e21, 8), WOOD = () => M(0x7a4626, 10), WOODL = () => M(0x9a5f34, 10), LEATHER = () => M(0x3f2617, 4);
const BRASS = () => M(0xd6a53a, 90), GOLD = () => M(0xe2b028, 100), GOLDD = () => M(0xa87a14, 70), RUBBER = () => M(0x141414, 2);
const ORANGE = () => M(0xd9581f, 18), YELLOW = () => M(0xe6b021, 18), OLIVE = () => M(0x4a5235, 10);

// side profile [[z, y], ...] (weapon coords) extruded across X, centred
function prof(pts, th, mat, o = {}) {
  const sh = new THREE.Shape();
  pts.forEach(([z, y], i) => i ? sh.lineTo(-z, y) : sh.moveTo(-z, y));
  for (const h of o.holes || []) { const p = new THREE.Path(); h.forEach(([z, y], i) => i ? p.lineTo(-z, y) : p.moveTo(-z, y)); sh.holes.push(p); }
  const b = o.bevel ?? Math.min(0.003, th * 0.25);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: th - b * 2, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 1, curveSegments: 6 });
  geo.rotateY(Math.PI / 2); geo.translate(-(th - b * 2) / 2, 0, 0);
  if (o.taper) {                                   // thin toward a cutting edge: taper(z, y) -> 0..1 thickness factor
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * o.taper(p.getZ(i), p.getY(i)));
    geo.computeVertexNormals();
  }
  const m = new THREE.Mesh(geo, mat);
  if (o.x) m.position.x = o.x;
  return m;
}
// profile in the X/Y plane extruded along Z (for things that are wide side-to-side, like a spade)
function profXY(pts, th, mat, o = {}) {
  const sh = new THREE.Shape();
  pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y));
  const b = o.bevel ?? Math.min(0.002, th * 0.25);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: th - b * 2, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 1 });
  geo.translate(0, 0, -(th - b * 2) / 2);
  return new THREE.Mesh(geo, mat);
}
function tube(r0, r1, len, mat, axis = 'y', x = 0, y = 0, z = 0, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg), mat);
  if (axis === 'z') m.rotation.x = -Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z); return m;
}
function ring(r, t, mat, axis, x, y, z) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 5, 16), mat); if (axis === 'y') m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; }
function boxm(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function rounds(g, list, r, len, mat, axis = 'z') { g.userData.rounds = list.map(([x, y, z]) => { const m = tube(r, r, len, mat, axis, x, y, z, 6); g.add(m); return m; }); }
const add = (g, ...ms) => { for (const m of ms) g.add(m); return g; };

export const MODELS = {
  axe() {
    const g = new THREE.Group();
    // hickory handle with a slight S curve and a swelled knob
    add(g, prof([[0.016, -0.085], [0.024, -0.06], [0.018, 0.0], [0.016, 0.25], [0.017, 0.5], [0.019, 0.62], [-0.019, 0.62], [-0.016, 0.5], [-0.014, 0.25], [-0.016, 0.0], [-0.02, -0.06], [-0.014, -0.085]], 0.024, WOODL(), { bevel: 0.006 }));
    // forged head: curved bit with a beard, narrow cheeks, flat poll; tapers to the edge
    const head = [[-0.138, 0.682], [-0.112, 0.674], [-0.06, 0.64], [-0.022, 0.632], [0.035, 0.638], [0.07, 0.632], [0.07, 0.568], [0.035, 0.562], [-0.022, 0.566], [-0.05, 0.548], [-0.1, 0.5], [-0.128, 0.486], [-0.142, 0.53], [-0.146, 0.6], [-0.144, 0.65]];
    add(g, prof(head, 0.03, DARKSTEEL(), { bevel: 0.003, taper: (z) => 1 - 0.78 * Math.min(1, Math.max(0, (z + 0.03) / -0.11)) }));
    add(g, prof([[-0.128, 0.488], [-0.142, 0.53], [-0.146, 0.6], [-0.144, 0.65], [-0.138, 0.682], [-0.126, 0.678], [-0.128, 0.6], [-0.126, 0.53], [-0.116, 0.494]], 0.009, EDGE(), { bevel: 0.001 }));
    return g;
  },
  slab() {
    const g = new THREE.Group();
    // broad heavy blade with a long fuller, tapering to both edges
    add(g, prof([[-0.06, 0.39], [0.06, 0.39], [0.063, 1.3], [0.0, 1.47], [-0.063, 1.3]], 0.016, STEEL(), { bevel: 0.002, taper: (z) => 1 - 0.75 * Math.min(1, Math.abs(z) / 0.062) }));
    add(g, prof([[-0.011, 0.44], [0.011, 0.44], [0.011, 1.18], [0.0, 1.22], [-0.011, 1.18]], 0.0175, DARKSTEEL(), { bevel: 0.001 }));
    add(g, prof([[-0.138, 0.372], [-0.125, 0.397], [0.125, 0.397], [0.138, 0.372], [0.125, 0.352], [0.03, 0.345], [-0.03, 0.345], [-0.125, 0.352]], 0.042, BLUED(), { bevel: 0.006 }));
    add(g, tube(0.02, 0.019, 0.4, LEATHER(), 'y', 0, 0.145));
    for (let y = -0.03; y < 0.33; y += 0.045) add(g, ring(0.0205, 0.003, M(0x2a180e, 4), 'y', 0, y, 0));
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), BLUED())); g.children[g.children.length - 1].position.y = -0.075;
    return g;
  },
  shovel() {
    const g = new THREE.Group();
    add(g, tube(0.0175, 0.0165, 1.04, WOODL(), 'y', 0, 0.42));
    // D-grip below the shaft
    const d = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 16, Math.PI), POLY()); d.rotation.z = Math.PI; d.position.y = -0.13; g.add(d);
    add(g, tube(0.013, 0.013, 0.11, POLY(), 'x', 0, -0.185, 0));
    // pressed-steel spade: socket, tread, pointed blade
    add(g, tube(0.019, 0.026, 0.12, DARKSTEEL(), 'y', 0, 0.95));
    const blade = profXY([[-0.11, 0.99], [0.11, 0.99], [0.112, 1.17], [0.06, 1.24], [0.0, 1.265], [-0.06, 1.24], [-0.112, 1.17]], 0.006, M(0x8a9097, 50));
    blade.rotation.x = 0.06; g.add(blade);
    add(g, boxm(0.226, 0.014, 0.022, DARKSTEEL(), 0, 0.99, 0.006));
    add(g, profXY([[-0.06, 1.24], [0.0, 1.265], [0.06, 1.24], [0.055, 1.232], [0.0, 1.255], [-0.055, 1.232]], 0.007, EDGE()));
    return g;
  },
  spear() {
    const g = new THREE.Group();
    add(g, tube(0.0145, 0.0135, 1.56, WOOD(), 'y', 0, 0.22));
    add(g, tube(0.016, 0.019, 0.07, DARKSTEEL(), 'y', 0, 1.0));
    for (const y of [0.9, 0.93, 0.96]) add(g, ring(0.0155, 0.003, M(0x5a4630, 4), 'y', 0, y, 0));
    // leaf-shaped head with a raised midrib
    add(g, prof([[0, 1.02], [0.03, 1.07], [0.026, 1.15], [0, 1.24], [-0.026, 1.15], [-0.03, 1.07]], 0.012, STEEL(), { bevel: 0.0015, taper: (z) => 1 - 0.8 * Math.min(1, Math.abs(z) / 0.03) }));
    add(g, tube(0.004, 0.0015, 0.2, DARKSTEEL(), 'y', 0, 1.13, 0, 6));
    return g;
  },
  mallet() {
    const g = new THREE.Group();
    add(g, tube(0.019, 0.015, 0.56, WOODL(), 'y', 0, 0.2));
    add(g, tube(0.064, 0.064, 0.17, GOLD(), 'z', 0, 0.5, 0, 20));
    for (const z of [-0.085, 0.085]) { add(g, tube(0.069, 0.069, 0.018, GOLDD(), 'z', 0, 0.5, z, 20)); add(g, tube(0.058, 0.058, 0.006, GOLD(), 'z', 0, 0.5, z * 1.09, 20)); }
    add(g, ring(0.02, 0.004, GOLDD(), 'y', 0, 0.42, 0));
    return g;
  },

  pistol() {
    const g = new THREE.Group();
    add(g, prof([[0.026, 0.033], [0.026, 0.06], [0.016, 0.068], [-0.153, 0.068], [-0.164, 0.061], [-0.164, 0.035]], 0.026, BLUED(), { bevel: 0.0025 }));
    for (let i = 0; i < 6; i++) add(g, boxm(0.0265, 0.022, 0.0016, POLY(), 0, 0.05, 0.016 - i * 0.004));       // slide serrations
    add(g, prof([[0.036, 0.034], [-0.15, 0.034], [-0.15, 0.021], [-0.072, 0.019], [-0.062, 0.002], [-0.056, -0.016], [-0.036, -0.022], [-0.02, -0.018], [-0.011, 0.004], [0.002, 0.004], [0.013, -0.1], [0.047, -0.1], [0.052, -0.09], [0.031, 0.0], [0.041, 0.026]], 0.028, POLY(),
      { holes: [[[-0.052, 0.012], [-0.046, -0.011], [-0.031, -0.015], [-0.019, -0.011], [-0.016, 0.012]]], bevel: 0.003 }));
    add(g, prof([[-0.031, 0.013], [-0.028, -0.006], [-0.024, -0.004], [-0.025, 0.013]], 0.006, DARKSTEEL()));
    add(g, boxm(0.004, 0.006, 0.006, DARKSTEEL(), 0, 0.071, -0.155), boxm(0.012, 0.006, 0.006, DARKSTEEL(), 0, 0.071, 0.018));
    add(g, tube(0.0058, 0.0058, 0.01, M(0x101010, 10), 'z', 0, 0.048, -0.162, 10));
    add(g, prof([[0.016, -0.004], [0.04, -0.094], [0.026, -0.094], [0.004, -0.004]], 0.029, M(0x0c0c0c, 2), { bevel: 0.0005 }));   // window slot
    rounds(g, Array.from({ length: 12 }, (_, i) => [0.0128, -0.008 - i * 0.0072, 0.012 + i * 0.002]), 0.0045, 0.011, BRASS());
    return g;
  },
  m16() {
    const g = new THREE.Group();
    add(g, prof([[0.07, 0.036], [0.07, 0.076], [-0.135, 0.076], [-0.135, 0.036]], 0.03, DARKSTEEL(), { bevel: 0.003 }));                     // upper
    add(g, prof([[0.05, 0.076], [0.04, 0.116], [-0.085, 0.116], [-0.095, 0.076]], 0.018, DARKSTEEL(), { holes: [[[0.032, 0.083], [-0.074, 0.083], [-0.074, 0.103], [0.028, 0.103]]] }));  // carry handle
    add(g, prof([[0.07, 0.036], [0.07, 0.002], [0.03, -0.004], [-0.022, -0.004], [-0.035, 0.002], [-0.125, 0.002], [-0.135, 0.036]], 0.029, DARKSTEEL(), { bevel: 0.003 }));  // lower
    add(g, prof([[0.034, -0.004], [0.034, -0.03], [-0.03, -0.03], [-0.03, -0.004]], 0.02, DARKSTEEL(), { holes: [[[0.025, -0.008], [0.025, -0.024], [-0.022, -0.024], [-0.022, -0.008]]] }));  // trigger guard
    add(g, prof([[0.034, 0.0], [0.064, -0.1], [0.04, -0.106], [0.008, -0.006]], 0.027, POLY(), { bevel: 0.004 }));                              // pistol grip
    add(g, prof([[0.07, 0.074], [0.335, 0.062], [0.345, -0.022], [0.315, -0.034], [0.12, 0.004], [0.07, 0.01]], 0.034, POLY(), { bevel: 0.005 }));     // stock
    add(g, tube(0.024, 0.022, 0.24, POLY(), 'z', 0, 0.056, -0.255, 12));                                                                         // handguard
    for (let z = -0.15; z > -0.36; z -= 0.03) add(g, ring(0.0235, 0.002, M(0x111111, 4), 'z', 0, 0.056, z));
    add(g, tube(0.008, 0.008, 0.27, BLUED(), 'z', 0, 0.056, -0.5, 10), tube(0.011, 0.011, 0.045, BLUED(), 'z', 0, 0.056, -0.6, 8));
    add(g, prof([[-0.4, 0.05], [-0.43, 0.05], [-0.428, 0.095], [-0.414, 0.095]], 0.012, BLUED()));                                            // front sight
    add(g, prof([[-0.022, 0.0], [-0.062, 0.0], [-0.078, -0.08], [-0.073, -0.15], [-0.037, -0.155], [-0.034, -0.08]], 0.024, M(0x55585e, 40), { bevel: 0.002 }));  // curved mag
    add(g, prof([[-0.032, -0.008], [-0.046, -0.008], [-0.06, -0.075], [-0.056, -0.14], [-0.046, -0.14], [-0.044, -0.075]], 0.025, M(0x0c0c0c, 2), { bevel: 0.0005 }));
    rounds(g, Array.from({ length: 10 }, (_, i) => [0.0122, -0.012 - i * 0.0125, -0.043 - Math.sin(i / 9 * 1.2) * 0.012]), 0.0042, 0.012, BRASS());
    g.userData.roundsPer = 3;
    return g;
  },
  bolt() {
    const g = new THREE.Group();
    add(g, prof([[0.365, 0.042], [0.365, -0.07], [0.3, -0.06], [0.12, -0.036], [0.06, -0.04], [0.04, -0.098], [0.008, -0.098], [0.006, -0.03], [-0.05, 0.0], [-0.5, 0.016], [-0.5, 0.042], [-0.05, 0.042], [0.11, 0.048]], 0.042, WOOD(), { bevel: 0.008 }));
    add(g, tube(0.015, 0.015, 0.2, BLUED(), 'z', 0, 0.055, -0.04, 12), tube(0.0095, 0.0085, 0.62, BLUED(), 'z', 0, 0.055, -0.45, 10));
    add(g, tube(0.016, 0.016, 0.2, POLY(), 'z', 0, 0.107, -0.08, 14), tube(0.023, 0.017, 0.05, POLY(), 'z', 0, 0.107, -0.19, 14), tube(0.017, 0.021, 0.04, POLY(), 'z', 0, 0.107, 0.03, 14));
    add(g, boxm(0.012, 0.03, 0.012, DARKSTEEL(), 0, 0.083, -0.03), boxm(0.012, 0.03, 0.012, DARKSTEEL(), 0, 0.083, -0.13));
    add(g, tube(0.004, 0.004, 0.05, STEEL(), 'x', 0.03, 0.06, 0.03, 6)); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), STEEL()); knob.position.set(0.056, 0.058, 0.03); g.add(knob);
    add(g, prof([[0.045, -0.04], [0.045, -0.07], [-0.03, -0.07], [-0.03, -0.04]], 0.016, BLUED(), { holes: [[[0.037, -0.045], [0.037, -0.063], [-0.022, -0.063], [-0.022, -0.045]]] }));
    add(g, boxm(0.003, 0.02, 0.10, M(0x0c0c0c, 2), 0.0205, 0.03, -0.12));
    rounds(g, Array.from({ length: 5 }, (_, i) => [0.0205, 0.03, -0.085 - i * 0.02]), 0.005, 0.018, BRASS());
    return g;
  },
  cannon() {
    const g = new THREE.Group();
    add(g, tube(0.021, 0.021, 0.3, BLUED(), 'z', 0, 0.062, -0.2, 14));
    add(g, boxm(0.012, 0.016, 0.3, BLUED(), 0, 0.087, -0.2));                                                                                    // top rib
    add(g, prof([[0.045, 0.03], [0.045, 0.098], [-0.05, 0.098], [-0.06, 0.03], [-0.03, 0.018], [0.03, 0.018]], 0.03, BLUED(), { holes: [[[0.038, 0.034], [0.038, 0.09], [-0.045, 0.09], [-0.045, 0.034]]] }));  // frame window
    const cyl = tube(0.038, 0.038, 0.08, DARKSTEEL(), 'z', 0, 0.062, -0.003, 18); g.add(cyl);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; const f = boxm(0.008, 0.008, 0.07, POLY(), Math.cos(a) * 0.037, 0.062 + Math.sin(a) * 0.037, -0.003); f.rotation.z = a; g.add(f); }
    add(g, prof([[0.03, 0.022], [0.075, -0.09], [0.05, -0.105], [0.005, -0.005]], 0.036, WOODL(), { bevel: 0.006 }));
    add(g, prof([[0.045, 0.09], [0.07, 0.105], [0.068, 0.095], [0.045, 0.08]], 0.01, DARKSTEEL()));                                              // hammer
    add(g, prof([[0.025, 0.02], [0.025, -0.012], [-0.03, -0.012], [-0.03, 0.02]], 0.014, BLUED(), { holes: [[[0.018, 0.016], [0.018, -0.005], [-0.023, -0.005], [-0.023, 0.016]]] }));
    add(g, prof([[-0.004, 0.018], [0.0, -0.002], [0.004, 0.0], [0.002, 0.018]], 0.006, STEEL()));
    rounds(g, Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2; return [Math.cos(a) * 0.022, 0.062 + Math.sin(a) * 0.022, 0.039]; }), 0.0095, 0.006, M(0xb5302a, 40));
    return g;
  },
  nailer() {
    const g = new THREE.Group();
    add(g, prof([[0.07, 0.125], [-0.24, 0.125], [-0.275, 0.1], [-0.28, 0.05], [-0.2, 0.035], [0.07, 0.04]], 0.062, YELLOW(), { bevel: 0.01 }));
    add(g, prof([[0.068, 0.045], [0.088, -0.06], [0.058, -0.08], [0.022, 0.035]], 0.036, RUBBER(), { bevel: 0.006 }));
    add(g, prof([[0.0, 0.045], [-0.005, 0.0], [0.01, -0.005], [0.016, 0.04]], 0.008, POLY()));
    add(g, tube(0.013, 0.016, 0.07, DARKSTEEL(), 'z', 0, 0.07, -0.29, 10), tube(0.006, 0.006, 0.05, STEEL(), 'z', 0, 0.07, -0.33, 8));
    add(g, tube(0.008, 0.008, 0.03, BRASS(), 'z', 0, 0.06, 0.1, 8));                                                                            // air fitting
    const strip = boxm(0.022, 0.03, 0.24, M(0x8a9097, 40), 0, 0.005, -0.15); strip.rotation.x = 0.12; g.add(strip);
    const nails = new THREE.Group(); nails.position.copy(strip.position); nails.rotation.x = 0.12; g.add(nails);
    g.userData.rounds = Array.from({ length: 12 }, (_, i) => { const n = tube(0.0022, 0.0022, 0.045, STEEL(), 'y', 0.012, 0, 0.1 - i * 0.018, 4); nails.add(n); return n; });
    g.userData.roundsPer = 2;
    return g;
  },
  minigun() {
    const g = new THREE.Group();
    add(g, tube(0.062, 0.062, 0.24, DARKSTEEL(), 'z', 0, 0.03, 0.05, 18), boxm(0.12, 0.13, 0.08, POLY(), 0, 0.03, 0.19));
    const barrels = new THREE.Group(); barrels.position.set(0, 0.03, -0.43); g.add(barrels);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; barrels.add(tube(0.011, 0.011, 0.62, BLUED(), 'z', Math.cos(a) * 0.034, Math.sin(a) * 0.034, 0, 8)); }
    for (const z of [-0.26, -0.05, 0.18]) barrels.add(tube(0.05, 0.05, 0.022, DARKSTEEL(), 'z', 0, 0, z, 14));
    g.userData.barrels = barrels;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 14, Math.PI), POLY()); handle.position.set(0, 0.1, 0.02); handle.rotation.y = Math.PI / 2; g.add(handle);
    add(g, prof([[0.12, -0.03], [0.14, -0.12], [0.115, -0.125], [0.095, -0.03]], 0.03, POLY()));
    add(g, boxm(0.13, 0.17, 0.15, OLIVE(), 0.13, -0.03, 0.09));
    const chute = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 10, Math.PI / 2), M(0x2e3226, 10)); chute.position.set(0.06, 0.02, 0.0); chute.rotation.set(0, 0, -Math.PI / 2); g.add(chute);
    return g;
  },
  chainsaw() {
    const g = new THREE.Group();
    add(g, prof([[0.2, 0.0], [0.2, 0.1], [0.14, 0.158], [-0.02, 0.158], [-0.065, 0.1], [-0.065, 0.0]], 0.11, ORANGE(), { bevel: 0.012 }));
    add(g, prof([[0.2, 0.03], [0.335, 0.03], [0.36, 0.085], [0.335, 0.14], [0.2, 0.14]], 0.03, POLY(), { holes: [[[0.22, 0.055], [0.32, 0.055], [0.335, 0.085], [0.32, 0.115], [0.22, 0.115]]], bevel: 0.006 }));
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 16, Math.PI), POLY()); wrap.position.set(0, 0.07, -0.04); wrap.rotation.y = Math.PI / 2; g.add(wrap);
    add(g, prof([[-0.065, 0.02], [-0.075, 0.02], [-0.075, 0.2], [-0.065, 0.2]], 0.12, POLY()));                                                // hand guard
    add(g, boxm(0.111, 0.04, 0.06, M(0x2a2a2c, 10), 0, 0.12, 0.09));                                                                            // air filter cover
    // bar with a rounded nose, the chain riding round it with teeth
    const bar = [[-0.05, -0.034], [-0.6, -0.028], [-0.635, -0.016], [-0.645, 0.0], [-0.635, 0.016], [-0.6, 0.028], [-0.05, 0.034]];
    add(g, prof(bar, 0.007, STEEL(), { bevel: 0.001 }));
    add(g, prof(bar.map(([z, y]) => [z * 1.02, y * 1.25]), 0.011, M(0x2b2b2e, 30), { bevel: 0.001 }));
    const chain = new THREE.Group(); g.add(chain);
    for (let z = -0.07; z > -0.62; z -= 0.022) for (const s of [1, -1]) chain.add(boxm(0.012, 0.009, 0.012, M(0x55585e, 60), 0, s * 0.04, z));
    g.userData.chain = chain.children[0];
    add(g, tube(0.006, 0.006, 0.05, RUBBER(), 'x', 0.06, 0.05, 0.12, 6), new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), RUBBER()));
    g.children[g.children.length - 1].position.set(0.088, 0.05, 0.12);
    return g;
  },
};
