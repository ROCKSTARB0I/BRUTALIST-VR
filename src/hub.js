// The hub: a tiled market hall under a glass roof. Vendor stalls sell weapons and upgrades,
// a jobs board starts paid missions, and the tailor sells armour. Career progress is saved locally.
import * as THREE from '../vendor/three.module.js?v=6';
import { DEFS } from './arsenal.js?v=6';
import { Body, OUTFITS } from './body.js?v=6';
const V3 = THREE.Vector3;

const SAVE_KEY = 'brutalist_career';
export function loadCareer() {
  let c = null;
  try { c = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
  return Object.assign({ cash: 150, owned: ['axe'], up: { hp: 0, punch: 0, reward: 0, lifesteal: 0, dusters: 0, armor: 0 }, armorOn: false, dustersOn: true, jobs: {} }, c || {});
}
export function saveCareer(c) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch (e) {} }
export function applyUpgrades(g, c) {
  const u = c.up;
  g.upgrades.punch = 1 + 0.35 * u.punch;
  g.upgrades.dusters = !!u.dusters && c.dustersOn;
  g.upgrades.armor = !!u.armor && c.armorOn;
  g.upgrades.lifesteal = !!u.lifesteal;
  g.upgrades.reward = 1 + 0.2 * u.reward;
  g.player.maxHp = 100 + 25 * u.hp;
}

export const SHOP = [
  { vendor: "RUSTY PETE'S CUTLERY", sign: '#7a1f17', ink: '#ffd88a', font: 'Bangers', items: ['axe', 'shovel', 'spear', 'pitchfork', 'scimitar', 'mace', 'slab', 'vaxe', 'zwei', 'naginata'] },
  { vendor: "BARNEY'S BOOMSTICKS", sign: '#22303f', ink: '#f2f2f2', font: 'Black Ops One', items: ['pistol', 'm16', 'bolt', 'cannon'] },
  { vendor: "DR. KESSLER'S HEAVY HARDWARE", sign: '#1e4752', ink: '#5ff0e0', font: 'Bangers', items: ['chainsaw', 'nailer', 'minigun', 'autocannon', 'mallet'] },
  { vendor: "IRON IVAN'S GYM", sign: '#e2c64a', ink: '#8a1010', font: 'Bangers', upgrades: ['hp', 'punch', 'reward', 'lifesteal'] },
];
export const UPGRADES = {
  hp: { name: 'Max Health +25', price: [600, 1200, 2400], max: 3 },
  punch: { name: 'Punch Power', price: [500, 1000, 2000], max: 3 },
  reward: { name: 'Reward Bonus +20%', price: [800, 1600, 3200], max: 3 },
  lifesteal: { name: 'Lifesteal', price: [2500], max: 1 },
  armor: { name: 'Body Armour', price: [1500], max: 1 },
  dusters: { name: 'Hydraulic Knuckles', price: [1200], max: 1 },
};
export const JOBS = [
  { id: 'alley', name: 'Alley Cleanup', map: 'alley', count: 6, pay: 300, bonus: { kind: 'melee', pay: 150, text: 'Melee only' } },
  { id: 'roofs', name: 'Roof Party', map: 'roofs', count: 8, pay: 550, bonus: { kind: 'time', t: 150, pay: 250, text: 'Under 2:30' } },
  { id: 'yard', name: 'Dust Up', map: 'yard', count: 10, pay: 750, bonus: { kind: 'health', hp: 60, pay: 300, text: 'Finish above 60 HP' } },
  { id: 'block', name: 'The Block', map: 'block', count: 12, pay: 1100, soldiers: 0.35, bonus: { kind: 'melee', pay: 500, text: 'Melee only' } },
  { id: 'infest', name: 'Infestation', map: 'alley', count: 12, pay: 1300, infected: true, bonus: { kind: 'time', t: 240, pay: 500, text: 'Under 4:00' } },
  { id: 'hardhats', name: 'Hard Hats', map: 'roofs', count: 14, pay: 2200, soldiers: 1, bonus: { kind: 'health', hp: 50, pay: 900, text: 'Finish above 50 HP' } },
  { id: 'sandpit', name: 'Sandpit Brawl', map: 'pit', count: 6, pay: 350, bonus: { kind: 'melee', pay: 200, text: 'Melee only' } },
  { id: 'eviction', name: 'Eviction', map: 'tenement', count: 10, pay: 900, bonus: { kind: 'time', t: 200, pay: 400, text: 'Under 3:20' } },
  { id: 'freefall', name: 'Free Fall', map: 'droptest', count: 8, pay: 700, bonus: { kind: 'melee', pay: 350, text: 'Melee only' } },
  { id: 'stocktake', name: 'Stock Take', map: 'depot', count: 12, pay: 1200, soldiers: 0.3, bonus: { kind: 'health', hp: 60, pay: 500, text: 'Finish above 60 HP' } },
  { id: 'lasttrain', name: 'Last Train', map: 'metro', count: 12, pay: 1400, infected: true, bonus: { kind: 'time', t: 240, pay: 600, text: 'Under 4:00' } },
  { id: 'mass', name: 'Sunday Mass', map: 'chapel', count: 10, pay: 1000, bonus: { kind: 'melee', pay: 450, text: 'Melee only' } },
  { id: 'rushhour', name: 'Rush Hour', map: 'downtown', count: 16, pay: 2600, soldiers: 0.5, bonus: { kind: 'health', hp: 50, pay: 1000, text: 'Finish above 50 HP' } },
];

// ---------- canvas helpers ----------
function canvasPlane(w, h, px = 256) {
  const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round(px * h / w);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.userData = { cv, ctx: cv.getContext('2d'), tex };
  return m;
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function fitText(c, text, maxW, size, font) { let s = size; do { c.font = `${s}px ${font}`; s -= 2; } while (c.measureText(text).width > maxW && s > 10); }

// ---------- the hall ----------
export function buildHub(w) {
  const g = w.g;
  g.scene.background = new THREE.Color('#8fc0f0');
  g.scene.fog = new THREE.Fog('#a9cdf0', 40, 120);
  const sunDir = new V3(0.35, 0.85, 0.4);
  w.sky('#3b7bd4', '#86b8ee', '#dceaf6', sunDir, '#fff6dc');
  w.lights('#e6efff', '#8a8578', 2.1, '#fff4e0', 2.0, sunDir.clone().multiplyScalar(40));
  w.scenery({ r: 75 });
  const X = 17, Z = 9, H = 4.2;
  const tiles = (ctx, W, Hh, box, fi, dims) => {
    ctx.fillStyle = '#8a95a3'; ctx.fillRect(0, 0, W, Hh);
    const px = W / dims[0], py = Hh / dims[1];
    for (let x = 0; x < dims[0]; x += 0.8) for (let y = 0; y < dims[1]; y += 0.8) { const k = 0.94 + Math.random() * 0.08; ctx.fillStyle = `rgb(${138 * k | 0},${149 * k | 0},${163 * k | 0})`; ctx.fillRect(x * px + 1, y * py + 1, 0.8 * px - 2, 0.8 * py - 2); }
  };
  const wall = (ctx, W, Hh, box, fi, dims) => {
    ctx.fillStyle = '#8e8e8c'; ctx.fillRect(0, 0, W, Hh);
    for (let i = 0; i < W * Hh / 400; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; ctx.fillRect(Math.random() * W, Math.random() * Hh, 3, 3); }
    const py = Hh / dims[1];
    ctx.fillStyle = '#d58a2a'; ctx.fillRect(0, Hh - 1.25 * py, W, 0.5 * py);      // orange band like a market hall
    ctx.fillStyle = '#6f6f6d'; ctx.fillRect(0, Hh - 0.75 * py, W, 0.75 * py);
  };
  w.box(-X - 0.4, -0.5, -Z - 0.4, X + 0.4, 0, Z + 0.4, { base: tiles });
  w.box(-X - 0.4, 0, -Z - 0.4, X + 0.4, H, -Z, { base: wall });
  w.box(-X - 0.4, 0, Z, X + 0.4, H, Z + 0.4, { base: wall });
  w.box(-X - 0.4, 0, -Z, -X, H, Z, { base: wall });
  w.box(X, 0, -Z, X + 0.4, H, Z, { base: wall });
  // glass barrel roof on steel ribs
  const ribM = new THREE.MeshLambertMaterial({ color: '#c9ced6' });
  for (let x = -X; x <= X + 0.01; x += 3.4) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(Z, 0.07, 6, 28, Math.PI), ribM);
    rib.rotation.y = Math.PI / 2; rib.position.set(x, H, 0); w.group.add(rib);
  }
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(Z, Z, X * 2, 28, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshLambertMaterial({ color: '#cfe6f5', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  glass.rotation.z = Math.PI / 2; glass.position.y = H; w.group.add(glass);
  for (const z of [-Z, Z]) { const beam = new THREE.Mesh(new THREE.BoxGeometry(X * 2, 0.12, 0.12), ribM); beam.position.set(0, H, z); w.group.add(beam); }

  w.buttons = [];
  w.vendors = [];
  w.slots = [];
  const stallW = 7.6, stalls = SHOP.length;
  SHOP.forEach((shop, si) => {
    const cx = (si - (stalls - 1) / 2) * (stallW + 0.6), cz = -5.4;
    const counterC = ['#b6b8bb', '#2b2b30', '#9c4a24', '#cdbb7a'][si];
    w.box(cx - stallW / 2, 0, cz - 0.35, cx + stallW / 2, 1.05, cz + 0.35, { color: counterC });
    w.box(cx - stallW / 2 - 0.02, 1.05, cz - 0.4, cx + stallW / 2 + 0.02, 1.1, cz + 0.42, { color: '#3a3a3e' });
    for (const sx of [-1, 1]) w.box(cx + sx * stallW / 2 - 0.05, 1.1, cz + 0.3, cx + sx * stallW / 2 + 0.05, 3.3, cz + 0.4, { color: '#5a5c60' });
    // sign board
    const sign = canvasPlane(stallW * 0.92, 1.1, 1024);
    const c = sign.userData.ctx, cv = sign.userData.cv;
    c.fillStyle = shop.sign; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = shop.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    fitText(c, shop.vendor, cv.width * 0.92, 112, `'${shop.font}', sans-serif`);
    c.fillText(shop.vendor, cv.width / 2, cv.height / 2 + 6);
    sign.position.set(cx, 3.55, cz + 0.42); sign.rotation.x = -0.12; w.group.add(sign);
    const back = new THREE.Mesh(new THREE.BoxGeometry(stallW * 0.92 + 0.1, 1.2, 0.08), new THREE.MeshLambertMaterial({ color: '#2a2a2e' }));
    back.position.copy(sign.position).add(new V3(0, 0, -0.05)); back.rotation.x = -0.12; w.group.add(back);
    document.fonts && document.fonts.load(`40px '${shop.font}'`).then(() => { c.fillStyle = shop.sign; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = shop.ink; fitText(c, shop.vendor, cv.width * 0.92, 112, `'${shop.font}', sans-serif`); c.fillText(shop.vendor, cv.width / 2, cv.height / 2 + 6); sign.userData.tex.needsUpdate = true; });
    // vendor behind the counter (eyes follow you)
    const vb = new Body(g, new V3(cx, 0, cz - 1.0), 0, { outfit: OUTFITS[(si * 3 + 1) % OUTFITS.length] });
    vb.static = true; vb.state = 'idle'; w.vendors.push(vb);
    // wares: four positions per stall; stalls with more stock page through it with arrows
    const list = shop.items || shop.upgrades, PER = 4;
    const stall = { list, page: 0, pos: [] };
    for (let i = 0; i < PER; i++) {
      const ix = cx + (i - (PER - 1) / 2) * (stallW / PER);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 30), new THREE.MeshLambertMaterial({ color: '#efe6d6' }));
      frame.scale.set(0.95, 1.75, 1); frame.position.set(ix, 2.1, -Z + 0.05); w.group.add(frame);
      const label = canvasPlane(1.4, 0.32, 512); label.position.set(ix, 3.0, -Z + 0.05); w.group.add(label);
      const icon = canvasPlane(0.6, 0.6, 256); icon.position.set(ix, 2.05, -Z + 0.08); w.group.add(icon);
      const card = canvasPlane(0.62, 0.3, 512); card.position.set(ix, 1.2, cz + 0.32); card.rotation.x = -0.6; w.group.add(card);
      const btn = { obj: card, r: 0.24, kind: shop.items ? 'weapon' : 'upgrade', key: null };
      btn.refresh = () => { if (btn.key) drawCard(g, btn); else { card.userData.ctx.clearRect(0, 0, 512, 512); card.userData.tex.needsUpdate = true; } };
      btn.press = () => { if (btn.key) g.shopPress(btn); };
      w.buttons.push(btn);
      stall.pos.push({ ix, label, icon, btn, frame });
    }
    const fill = () => {
      for (const sl of w.slots.filter(sl => sl.stall === stall)) if (sl.w && sl.w.mode === 'rack') g.removeWeapon(sl.w);
      w.slots = w.slots.filter(sl => sl.stall !== stall);
      stall.pos.forEach((P, i) => {
        const key = list[stall.page * PER + i] || null;
        P.btn.key = key; P.btn.refresh(); P.frame.visible = !!key;
        const lc = P.label.userData.ctx; lc.clearRect(0, 0, 512, 160);
        if (key) { const name = shop.items ? DEFS[key].name : UPGRADES[key].name; lc.fillStyle = '#f4f4f0'; lc.textAlign = 'center'; lc.textBaseline = 'middle'; fitText(lc, name, 490, 64, "'Roboto Mono', monospace"); lc.fillText(name, 256, 60); }
        P.label.userData.tex.needsUpdate = true;
        const ic = P.icon.userData.ctx; ic.clearRect(0, 0, 256, 256);
        if (key && !shop.items) {
          ic.fillStyle = '#e2c64a'; ic.beginPath(); ic.arc(128, 128, 110, 0, 7); ic.fill();
          ic.fillStyle = '#8a1010'; ic.font = "bold 120px 'Bangers', sans-serif"; ic.textAlign = 'center'; ic.textBaseline = 'middle';
          ic.fillText({ hp: '+', punch: 'P', reward: '$', lifesteal: 'L' }[key], 128, 138);
        }
        P.icon.userData.tex.needsUpdate = true;
        if (key && shop.items) {
          // a real weapon hangs on the stand: grab it to try it (buying is the price card)
          const q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), DEFS[key].wide ? 0 : Math.PI / 2);
          const sl = { key, pos: new V3(P.ix, 2.1, -Z + 0.22), quat: q, trial: true, t: 0, w: null, stall };
          w.slots.push(sl); if (g.placeSlot) g.placeSlot(sl);
        }
      });
    };
    stall.fill = fill;
    if (list.length > PER) for (const sx of [-1, 1]) {
      const arrow = canvasPlane(0.32, 0.32, 256); arrow.position.set(cx + sx * (stallW / 2 + 0.05), 2.1, -Z + 0.08); w.group.add(arrow);
      const ac = arrow.userData.ctx; ac.fillStyle = '#f2f2f2'; ac.strokeStyle = '#111'; ac.lineWidth = 10; ac.beginPath();
      if (sx > 0) { ac.moveTo(70, 40); ac.lineTo(200, 128); ac.lineTo(70, 216); } else { ac.moveTo(186, 40); ac.lineTo(56, 128); ac.lineTo(186, 216); }
      ac.closePath(); ac.fill(); ac.stroke(); arrow.userData.tex.needsUpdate = true;
      w.buttons.push({ obj: arrow, r: 0.25, kind: 'page', press: () => { const pages = Math.ceil(list.length / PER); stall.page = (stall.page + sx + pages) % pages; fill(); g.sfx.play('click', null, 0.5); }, refresh() {} });
    }
    (w.stalls = w.stalls || []).push(stall);
    // current funds sign on the counter front
    const funds = canvasPlane(1.1, 0.42, 512);
    funds.position.set(cx, 0.62, cz + 0.36); w.group.add(funds);
    w.buttons.push({ obj: funds, r: 0, fundsSign: true, refresh() { drawFunds(g, funds); } });
  });
  // tailor board (right wall) and jobs board (left wall)
  const tailor = canvasPlane(2.4, 0.5, 768); tailor.position.set(X - 0.05, 2.6, 2.5); tailor.rotation.y = -Math.PI / 2; w.group.add(tailor);
  titleCard(tailor, "TRUDY'S TAILORING", '#4a2a6a', '#ffd6f0');
  ['armor', 'dusters'].forEach((key, i) => {
    const card = canvasPlane(0.9, 0.42, 512); card.position.set(X - 0.05, 1.6, 2.5 + (i - 0.5) * 1.1); card.rotation.y = -Math.PI / 2; w.group.add(card);
    const btn = { obj: card, r: 0.3, kind: 'gear', key }; btn.refresh = () => drawCard(g, btn); btn.press = () => g.shopPress(btn);
    w.buttons.push(btn); btn.refresh();
  });
  const jobs = canvasPlane(3.6, 0.6, 1024); jobs.position.set(-X + 0.05, 3.1, 1.5); jobs.rotation.y = Math.PI / 2; w.group.add(jobs);
  titleCard(jobs, 'JOBS BOARD', '#1b1b1b', '#ff4a3a');
  JOBS.forEach((job, i) => {
    const card = canvasPlane(1.1, 0.62, 512);
    card.position.set(-X + 0.05, 2.45 - Math.floor(i / 4) * 0.68, 1.5 + ((i % 4) - 1.5) * 1.2); card.rotation.y = Math.PI / 2; w.group.add(card);
    const btn = { obj: card, r: 0.36, kind: 'job', job }; btn.refresh = () => drawJob(g, btn); btn.press = () => g.startJob(job);
    w.buttons.push(btn); btn.refresh();
  });
  w.start = { x: 0, z: 6.5, yaw: 0 };
  w.spawns.push(new V3(0, 0, 7.5));
  w.isHub = true;
}
function titleCard(m, text, bg, ink) {
  const { ctx: c, cv, tex } = m.userData;
  const draw = () => { c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, text, cv.width * 0.9, cv.height * 0.8, "'Bangers', sans-serif"); c.fillText(text, cv.width / 2, cv.height / 2 + 4); tex.needsUpdate = true; };
  draw(); document.fonts && document.fonts.load("40px 'Bangers'").then(draw);
}
function drawCard(g, btn) {
  const { ctx: c, cv, tex } = btn.obj.userData, C = g.career;
  const W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  let title, line, owned = false, dark = false;
  if (btn.kind === 'weapon') {
    const d = DEFS[btn.key]; owned = C.owned.includes(btn.key);
    title = d.name; line = owned ? 'Owned · take one' : `Cost: ${d.price} $`;
  } else {
    const u = UPGRADES[btn.key], lvl = C.up[btn.key] || 0, maxed = lvl >= u.max;
    title = u.name + (u.max > 1 ? `  (${lvl}/${u.max})` : '');
    if (btn.kind === 'gear' && lvl) { line = (btn.key === 'armor' ? C.armorOn : C.dustersOn) ? 'Wearing · tap to remove' : 'Owned · tap to wear'; owned = true; }
    else line = maxed ? 'Maxed out' : `Cost: ${u.price[lvl]} $`;
    owned = owned || maxed;
  }
  if (btn.flash && performance.now() < btn.flash) { line = btn.flashText; dark = true; }
  c.fillStyle = dark ? '#2b2b2e' : '#ffffff'; roundRect(c, 6, 6, W - 12, H - 12, 26); c.fill();
  c.lineWidth = 6; c.strokeStyle = '#1b1b1b'; c.stroke();
  c.fillStyle = dark ? '#f4f4f4' : '#1b1b1b'; c.textAlign = 'center'; c.textBaseline = 'middle';
  fitText(c, title, W - 50, 54, "'Roboto Mono', monospace"); c.font = 'bold ' + c.font; c.fillText(title, W / 2, H * 0.36);
  c.fillStyle = dark ? '#ffcf4a' : owned ? '#2a7a2a' : '#119a2e';
  fitText(c, line, W - 50, 50, "'Roboto Mono', monospace"); c.font = 'bold ' + c.font; c.fillText(line, W / 2, H * 0.7);
  tex.needsUpdate = true;
}
function drawFunds(g, m) {
  const { ctx: c, cv, tex } = m.userData, W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#26282c'; roundRect(c, 8, 8, W - 16, H - 16, 40); c.fill(); c.lineWidth = 8; c.strokeStyle = '#111'; c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#36e05a'; c.font = "bold 46px 'Roboto Mono', monospace"; c.fillText('Current Funds', W / 2, H * 0.32);
  c.fillStyle = '#d6ff3a'; c.font = "bold 74px 'Roboto Mono', monospace"; c.fillText(`${g.career.cash} $`, W / 2, H * 0.68);
  tex.needsUpdate = true;
}
function drawJob(g, btn) {
  const { ctx: c, cv, tex } = btn.obj.userData, W = cv.width, H = cv.height, j = btn.job, done = g.career.jobs[j.id];
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#f3ecd9'; roundRect(c, 6, 6, W - 12, H - 12, 18); c.fill(); c.lineWidth = 5; c.strokeStyle = '#1b1b1b'; c.stroke();
  c.fillStyle = '#b3241a'; c.beginPath(); c.arc(W / 2, 22, 10, 0, 7); c.fill();
  c.fillStyle = '#1b1b1b'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = "bold 50px 'Roboto Mono', monospace"; c.fillText(j.name, W / 2, 70);
  c.font = "30px 'Roboto Mono', monospace";
  c.fillText(`${j.count} targets${j.infected ? ' · infected' : ''}${j.soldiers ? ' · armoured' : ''}`, W / 2, 125);
  c.fillStyle = '#119a2e'; c.font = "bold 40px 'Roboto Mono', monospace"; c.fillText(`Pays ${j.pay} $`, W / 2, 180);
  c.fillStyle = '#7a4a10'; c.font = "28px 'Roboto Mono', monospace"; c.fillText(`Bonus +${j.bonus.pay} $: ${j.bonus.text}`, W / 2, 228);
  if (done) { c.fillStyle = '#2a7a2a'; c.font = "bold 30px 'Roboto Mono', monospace"; c.fillText(`done ×${done}`, W / 2, 268); }
  tex.needsUpdate = true;
}

// hover/press for shop cards: VR hand poke + trigger, desktop crosshair + E / click
const _p = new V3(), _d = new V3(), _q = new THREE.Quaternion();
export function updateButtons(g, dt) {
  const w = g.world; if (!w.buttons) return null;
  const P = g.player;
  let hover = null, bd = 1e9;
  if (P.vr) {
    for (const h of P.H) {
      if (!h.src || h.held) continue;
      for (const b of w.buttons) {
        if (!b.r) continue;
        b.obj.getWorldPosition(_p);
        const d = _p.distanceTo(h.pos);
        if (d < b.r && d < bd) { bd = d; hover = b; hover.hand = h; }
      }
    }
  } else {
    P.cam.getWorldPosition(_p); _d.set(0, 0, -1).applyQuaternion(P.cam.getWorldQuaternion(_q));
    for (const b of w.buttons) {
      if (!b.r) continue;
      const c = b.obj.getWorldPosition(new V3()).sub(_p), along = c.dot(_d);
      if (along < 0.3 || along > 3.2) continue;
      const off = c.addScaledVector(_d, -along).length();
      if (off < b.r * 0.8 && along < bd) { bd = along; hover = b; }
    }
  }
  for (const b of w.buttons) if (b.r) b.obj.scale.setScalar(b === hover ? 1.08 : 1);
  if (hover && P.vr && hover.hand && hover.hand.trigTap) hover.press();
  return hover;
}
export function refreshButtons(g) { const w = g.world; if (w.buttons) for (const b of w.buttons) b.refresh && b.refresh(); }
