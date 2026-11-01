// Levels are boxes (physics) dressed with procedural canvas textures (concrete, brick, sand) that blood paints into.
import * as THREE from '../vendor/three.module.js?v=1';
const V3 = THREE.Vector3;

// ---------- procedural surface bases (drawn into the same canvases blood paints on) ----------
function grime(ctx, W, H, k = 1) {
  for (let i = 0; i < W * H / 500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05 * k})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }
  for (let i = 0; i < W * H / 9000; i++) {         // water stains
    const x = Math.random() * W, y = Math.random() * H, r = 6 + Math.random() * 30;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${0.06 * k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
const concrete = (base, board = 0.6) => (ctx, W, H, box, fi, dims) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  grime(ctx, W, H, 1.2);
  if (fi !== 2 && fi !== 3) {                      // board-form lines on vertical faces
    const py = H / dims[1];
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
    for (let y = board; y < dims[1]; y += board) { ctx.beginPath(); ctx.moveTo(0, H - y * py); ctx.lineTo(W, H - y * py); ctx.stroke(); }
    const px = W / dims[0];
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0.6; x < dims[0]; x += 1.2) for (let y = board / 2; y < dims[1]; y += board) { ctx.beginPath(); ctx.arc(x * px, H - y * py, 1.6, 0, 7); ctx.fill(); }
    // grime runs down from the top
    const gr = ctx.createLinearGradient(0, 0, 0, H * 0.4); gr.addColorStop(0, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H * 0.4);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
};
const brick = (base, mortar) => (ctx, W, H, box, fi, dims) => {
  if (fi === 2 || fi === 3) return concrete('#7d7b78')(ctx, W, H, box, fi, dims);
  ctx.fillStyle = mortar; ctx.fillRect(0, 0, W, H);
  const px = W / dims[0], py = H / dims[1], bw = 0.24 * px, bh = 0.075 * py;
  const c = new THREE.Color(base);
  for (let row = 0; row * bh < H + bh; row++) {
    const off = (row % 2) * bw / 2;
    for (let x = -bw; x < W + bw; x += bw) {
      const k = 0.85 + Math.random() * 0.25;
      ctx.fillStyle = `rgb(${c.r * 255 * k | 0},${c.g * 255 * k | 0},${c.b * 255 * k | 0})`;
      ctx.fillRect(x + off + 1, H - (row + 1) * bh + 1, bw - 2, bh - 2);
    }
  }
  grime(ctx, W, H, 0.8);
};
const sand = (ctx, W, H) => {
  ctx.fillStyle = '#c4935d'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 60; i++) { const k = Math.random(); ctx.fillStyle = k < 0.5 ? `rgba(90,55,25,${Math.random() * 0.12})` : `rgba(255,220,170,${Math.random() * 0.12})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  for (let i = 0; i < 40; i++) { ctx.strokeStyle = 'rgba(120,80,40,0.08)'; ctx.lineWidth = 3 + Math.random() * 6; ctx.beginPath(); const y = Math.random() * H; ctx.moveTo(0, y); ctx.bezierCurveTo(W * 0.3, y + 30, W * 0.6, y - 30, W, y + Math.random() * 20); ctx.stroke(); }
};
const tiles = (base, line) => (ctx, W, H, box, fi, dims) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  grime(ctx, W, H, 0.9);
  const px = W / dims[0], py = H / dims[1];
  ctx.strokeStyle = line; ctx.lineWidth = 1.5;
  for (let x = 0; x <= dims[0]; x += 0.6) { ctx.beginPath(); ctx.moveTo(x * px, 0); ctx.lineTo(x * px, H); ctx.stroke(); }
  for (let y = 0; y <= dims[1]; y += 0.6) { ctx.beginPath(); ctx.moveTo(0, y * py); ctx.lineTo(W, y * py); ctx.stroke(); }
};

const facade = (base, mortar, floors = 3) => (ctx, W, H, box, fi, dims) => {
  brick(base, mortar)(ctx, W, H, box, fi, dims);
  if (fi === 2 || fi === 3) return;
  const px = W / dims[0], py = H / dims[1];
  for (let fy = 1.2; fy + 1.3 < dims[1]; fy += 3) {
    for (let fx = 0.9; fx + 1.1 < dims[0]; fx += 2.3) {
      const x = fx * px, y = H - (fy + 1.35) * py, w = 1.1 * px, h = 1.35 * py;
      ctx.fillStyle = '#d9dde3'; ctx.fillRect(x - 0.08 * px, y - 0.08 * py, w + 0.16 * px, h + 0.16 * py);
      const gr = ctx.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#7c9bd6'); gr.addColorStop(1, '#4c66a8');
      ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(x + w * 0.15, y + h); ctx.lineTo(x + w * 0.45, y); ctx.lineTo(x + w * 0.6, y); ctx.lineTo(x + w * 0.3, y + h); ctx.fill();
      ctx.fillStyle = '#c9ced6'; ctx.fillRect(x - 0.12 * px, y + h + 0.06 * py, w + 0.24 * px, 0.1 * py);
    }
  }
};
const asphalt = (ctx, W, H) => {
  ctx.fillStyle = '#b8bdc6'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 40; i++) { ctx.fillStyle = Math.random() < 0.5 ? `rgba(60,64,72,${Math.random() * 0.1})` : `rgba(255,255,255,${Math.random() * 0.1})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  for (let i = 0; i < 18; i++) { const x = Math.random() * W, y = Math.random() * H, r = 20 + Math.random() * 60; const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(70,75,85,0.12)'); gr.addColorStop(1, 'rgba(70,75,85,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
};
const metal = (c) => (ctx, W, H) => { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); grime(ctx, W, H, 0.6); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2); };

export class World {
  constructor(game) {
    this.g = game; this.group = new THREE.Group(); game.scene.add(this.group);
    this.spawns = []; this.racks = [];
  }
  box(x0, y0, z0, x1, y1, z1, o = {}) {
    const min = new V3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)), max = new V3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1));
    const b = { min, max, color: o.color || '#a39b90', glass: !!o.glass, paintBase: o.base, noPaint: !!o.glass, noFloor: !!o.noFloor };
    if (!o.hidden) {
      const geo = new THREE.BoxGeometry(max.x - min.x, max.y - min.y, max.z - min.z);
      const m = b.glass ? new THREE.MeshLambertMaterial({ color: 0xbfe3ee, transparent: true, opacity: 0.25, depthWrite: false })
        : new THREE.MeshLambertMaterial({ color: b.color });
      b.mesh = new THREE.Mesh(geo, [m, m, m, m, m, m]);
      b.mesh.position.addVectors(min, max).multiplyScalar(0.5);
      b.mesh.receiveShadow = !b.glass; b.mesh.castShadow = !b.glass && !o.noCast;
      this.group.add(b.mesh);
      // textured surfaces up front so the level reads before any blood lands
      if (b.paintBase) for (let f = 0; f < 6; f++) {
        const sx = max.x - min.x, sy = max.y - min.y, sz = max.z - min.z;
        const area = [sz * sy, sz * sy, sx * sz, sx * sz, sx * sy, sx * sy][f];
        if (area > 0.6 || o.eager) this.g.gore.face(b, f);
      }
    }
    this.g.phys.boxes.push(b);
    return b;
  }

  sky(top, mid, horizon, sunDir, sunCol) {
    const geo = new THREE.SphereGeometry(90, 24, 12);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, hor: { value: new THREE.Color(horizon) }, sd: { value: sunDir.clone().normalize() }, sc: { value: new THREE.Color(sunCol) } },
      vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top, mid, hor, sd, sc; varying vec3 vd;
        void main(){ float h = vd.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.8, h)) : mix(hor, mid, smoothstep(-0.05, 0.15, h));
          float s = max(dot(vd, sd), 0.0); c += sc * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.35);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const m = new THREE.Mesh(geo, mat); m.renderOrder = -1;
    this.skyMesh = m; this.group.add(m);
  }
  // low-poly green hills with grey peaks on the horizon, and fat cartoon clouds
  scenery(o = {}) {
    const ring = new THREE.Group();
    const R0 = o.r || 70;
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + Math.random() * 0.15, d = R0 + Math.random() * 12;
      const h = 10 + Math.random() * 18, rad = 12 + Math.random() * 12;
      const geo = new THREE.ConeGeometry(rad, h, 5 + (Math.random() * 3 | 0), 3).toNonIndexed();
      const p = geo.attributes.position, col = new Float32Array(p.count * 3);
      for (let k = 0; k < p.count; k++) {
        p.setX(k, p.getX(k) * (0.8 + Math.random() * 0.25)); p.setZ(k, p.getZ(k) * (0.8 + Math.random() * 0.25));
        const y = (p.getY(k) + h / 2) / h, grey = y > 0.55 ? 1 : 0;
        const c = grey ? [0.55, 0.57, 0.6] : [0.42 + Math.random() * 0.05, 0.72, 0.25];
        col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false }));
      m.position.set(Math.cos(a) * d, h / 2 - 2 + (o.base || 0), Math.sin(a) * d);
      ring.add(m);
    }
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const sg = new THREE.SphereGeometry(1, 10, 6);
    for (let i = 0; i < 14; i++) {
      const cl = new THREE.Group(), a = Math.random() * Math.PI * 2, d = 45 + Math.random() * 30;
      for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(sg, cm); s.scale.set(4 + Math.random() * 4, 1.2 + Math.random(), 2.5 + Math.random() * 2); s.position.set((k - 2) * 4 + Math.random() * 2, Math.random() * 1.2, Math.random() * 2); cl.add(s); }
      cl.position.set(Math.cos(a) * d, 30 + Math.random() * 14 + (o.base || 0), Math.sin(a) * d); cl.lookAt(0, cl.position.y, 0);
      ring.add(cl);
    }
    this.group.add(ring);
  }
  lights(hemiSky, hemiGround, hemiI, sunCol, sunI, sunPos) {
    const g = this.g;
    this.group.add(new THREE.HemisphereLight(hemiSky, hemiGround, hemiI));
    const sun = new THREE.DirectionalLight(sunCol, sunI);
    sun.position.copy(sunPos); sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    const S = sun.shadow; S.mapSize.set(g.lowEnd ? 1024 : 2048, g.lowEnd ? 1024 : 2048);
    S.camera.left = -16; S.camera.right = 16; S.camera.top = 16; S.camera.bottom = -16; S.camera.near = 1; S.camera.far = 70;
    S.bias = -0.0006; S.normalBias = 0.02;
    this.group.add(sun, sun.target);
    this.sun = sun;
  }

  build(name) {
    (MAPS[name] || MAPS.alley)(this);
    this.name = name;
  }
  // a table for weapons to lie on
  table(x, z, len, yaw) {
    const along = Math.abs(Math.sin(yaw)) > 0.5;
    const hx = along ? 0.35 : len / 2, hz = along ? len / 2 : 0.35;
    this.box(x - hx, 0.86, z - hz, x + hx, 0.92, z + hz, { color: '#6b5236', base: concrete('#6b5236', 9), noCast: true });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(x + sx * (hx - 0.05) - 0.03, 0, z + sz * (hz - 0.05) - 0.03, x + sx * (hx - 0.05) + 0.03, 0.86, z + sz * (hz - 0.05) + 0.03, { color: '#3b3b3e' });
    const step = along ? new V3(0, 0, len / 6) : new V3(len / 6, 0, 0);
    this.racks.push({ pos: new V3(x, 0.92, z).addScaledVector(step, -2.5), step, yaw, table: true });
  }
}

const MAPS = {
  // Rooftops: four flat roofs 12 m up, brick parapets, plank bridges. Everyone goes over the edge eventually.
  roofs(w) {
    const g = w.g;
    g.scene.background = new THREE.Color('#8fc0f0');
    g.scene.fog = new THREE.Fog('#b4d4f2', 40, 110);
    const sunDir = new V3(0.4, 0.8, -0.45);
    w.sky('#3b7bd4', '#86b8ee', '#dceaf6', sunDir, '#fff6dc');
    w.lights('#dbe9ff', '#8a8578', 2.0, '#fff4e0', 2.4, sunDir.clone().multiplyScalar(40));
    w.scenery({ r: 85 });
    const Y = 12;
    const FAC = [facade('#c9b98a', '#9e9170'), facade('#a9b6bf', '#86929a'), facade('#c98a6a', '#a06a50'), facade('#9aa3a0', '#7b8481')];
    const ROOF = concrete('#d7dadf', 9), PARA = brick('#9a9a96', '#7d7d7a'), WOOD = (ctx, W, H, box, fi, dims) => {
      ctx.fillStyle = '#c8a06a'; ctx.fillRect(0, 0, W, H);
      const along = dims[0] > dims[1], n = Math.max(2, Math.round((along ? dims[0] : dims[1]) / 0.25));
      ctx.strokeStyle = 'rgba(80,50,20,0.5)'; ctx.lineWidth = 2;
      for (let i = 1; i < n; i++) { ctx.beginPath(); if (along) { ctx.moveTo(i * W / n, 0); ctx.lineTo(i * W / n, H); } else { ctx.moveTo(0, i * H / n); ctx.lineTo(W, i * H / n); } ctx.stroke(); }
      grime(ctx, W, H, 0.6);
    };
    w.box(-40, -1, -40, 50, 0, 50, { color: '#9aa0a8', base: asphalt });
    // roofs: [x0, z0, x1, z1, height]
    const roofs = [[-7, -7, 7, 7, Y], [10, -6, 21, 6, Y], [-7, 10, 7, 21, Y + 1.4], [10, 9, 21, 21, Y - 1]];
    roofs.forEach(([x0, z0, x1, z1, h], i) => {
      w.box(x0, 0, z0, x1, h, z1, { base: FAC[i] });
      w.box(x0, h, z0, x1, h + 0.05, z1, { base: ROOF });
    });
    // parapets with gaps where the bridges land
    const para = (x0, z0, x1, z1, h) => w.box(x0, h, z0, x1, h + 0.95, z1, { base: PARA });
    // roof A (-7..7)
    para(-7, -7, 7, -6.7, Y); para(-7, -7, -6.7, 7, Y);
    para(6.7, -7, 7, -0.8, Y); para(6.7, 0.8, 7, 7, Y);
    para(-7, 6.7, -0.8, 7, Y); para(0.8, 6.7, 7, 7, Y);
    // roof B
    para(10, -6, 21, -5.7, Y); para(10, 5.7, 21, 6, Y); para(20.7, -6, 21, 6, Y);
    para(10, -6, 10.3, -0.8, Y); para(10, 0.8, 10.3, 5.7, Y);
    para(14.7, 5.7, 16.3, 6, Y); 
    // roof C (higher)
    const YC = Y + 1.4;
    para(-7, 20.7, 7, 21, YC); para(-7, 10, -6.7, 21, YC); para(6.7, 10, 7, 21, YC);
    para(-7, 10, -0.8, 10.3, YC); para(0.8, 10, 7, 10.3, YC);
    // roof D (lower)
    const YD = Y - 1;
    para(10, 20.7, 21, 21, YD); para(20.7, 9, 21, 21, YD); para(10, 9, 10.3, 21, YD);
    para(10, 9, 14.7, 9.3, YD); para(16.3, 9, 21, 9.3, YD);
    // plank bridges (with a step where roofs differ)
    w.box(7, Y - 0.05, -0.75, 10, Y + 0.05, 0.75, { base: WOOD });
    w.box(-0.75, Y - 0.05, 7, 0.75, Y + 0.05, 8.6, { base: WOOD });
    w.box(-0.75, Y + 0.65, 8.6, 0.75, Y + 0.75, 9.3, { base: WOOD });
    w.box(-0.75, YC - 0.05, 9.3, 0.75, YC + 0.05, 10, { base: WOOD });
    w.box(14.7, Y - 0.05, 6, 16.3, Y + 0.05, 7.6, { base: WOOD });
    w.box(14.7, YD + 0.45, 7.6, 16.3, YD + 0.55, 8.3, { base: WOOD });
    w.box(14.7, YD - 0.05, 8.3, 16.3, YD + 0.05, 9, { base: WOOD });
    // stairwell huts (enemies come out of these), vents, a water tank
    const HUT = concrete('#b9b2a6', 0.5);
    for (const [x, z, h] of [[-4.5, -4.5, Y], [18, 3, Y], [-4, 18, YC], [18, 18, YD]]) w.box(x - 1.1, h, z - 1.1, x + 1.1, h + 2.5, z + 1.1, { base: HUT });
    w.box(2.5, Y, -5.5, 4.5, Y + 0.8, -4.5, { base: metal('#a7adb4') });
    w.box(13, Y, -4.5, 14, Y + 1.0, -3.5, { base: metal('#a7adb4') });
    w.box(2, YC, 15, 4.5, YC + 2.2, 17.5, { base: metal('#8c6c4a') });
    w.table(0, 3.2, 3.6, 0);
    const T = w.racks[w.racks.length - 1]; T.pos.y += Y; for (const b of w.g.phys.boxes.slice(-5)) { b.min.y += Y; b.max.y += Y; if (b.mesh) b.mesh.position.y += Y; }
    w.spawns.push(new V3(-4.5, Y, -2.9), new V3(16.4, Y, 3), new V3(-4, YC, 16.4), new V3(16.4, YD, 18));
    w.start = { x: 0, z: 2.2, yaw: Math.PI };
    w.fallY = 6;
  },

  // Back Alley: bright afternoon between brick blocks. Fire escapes to throw people off, dumpsters, a dead end.
  alley(w) {
    const g = w.g;
    g.scene.background = new THREE.Color('#8fc0f0');
    g.scene.fog = new THREE.Fog('#a9cdf0', 30, 90);
    const sunDir = new V3(0.45, 0.85, 0.3);
    w.sky('#3d7fd6', '#7fb4ec', '#d6e8f6', sunDir, '#fff6dc');
    w.lights('#dbe9ff', '#8a8578', 2.0, '#fff4e0', 2.4, sunDir.clone().multiplyScalar(40));
    w.scenery();
    const YEL = facade('#d8c64e', '#b3a54a'), GRN = brick('#7f9488', '#5f6f66'), GRY = facade('#8a8a86', '#6a6a66'), PUR = facade('#7b5fb8', '#5d4790');
    w.box(-26, -1, -14, 26, 0, 14, { color: '#b8bdc6', base: asphalt });
    // fences so nobody wanders off
    w.box(-24, 0, -6, -23.6, 4, 6, { hidden: true }); w.box(-24, 0, -14, 24, 4, -13.6, { hidden: true }); w.box(-24, 0, 13.6, 24, 4, 14, { hidden: true });
    // left: tall yellow block; right: grey block then a purple one; back: green brick wall
    w.box(-22, 0, -13, 8, 9.5, -6, { base: YEL });
    w.box(8, 0, -13, 18, 7, -7.5, { base: GRY });
    w.box(-22, 0, 6, 1, 8, 13, { base: GRY });
    w.box(1, 0, 7, 12, 6, 13, { base: PUR });
    w.box(18, 0, -13, 19, 6.5, 13, { base: GRN });
    w.box(12, 0, 6, 18, 6.5, 13, { base: GRN });
    // cross alley gap between grey and purple (x 1..1) is the side entrance; roofs are walk-on via the fire escape
    // fire escape on the grey block: two landings with railings and stairs between
    const FE = metal('#9aa0a8');
    const fe = (y, x0, x1) => {
      w.box(x0, y - 0.08, 4.9, x1, y, 6, { base: FE });
      w.box(x0, y, 4.88, x1, y + 1.0, 4.94, { base: FE });            // front rail
      w.box(x0, y, 4.9, x0 + 0.06, y + 1.0, 6, { base: FE });
    };
    fe(3.0, -12, -6.5); fe(5.8, -18, -14.9);
    for (let i = 0; i < 7; i++) w.box(-6.5 + i * 0.42, 0, 5.0, -6.08 + i * 0.42, 3.0 - i * 0.43, 5.9, { base: FE });            // street -> landing 1
    for (let i = 0; i < 7; i++) w.box(-12 - (i + 1) * 0.42, 0, 5.0, -12 - i * 0.42, 3.0 + (i + 1) * 0.4, 5.9, { base: FE });   // landing 1 -> landing 2
    // dumpsters
    const DUMP = metal('#2f6b3a'), LID = metal('#1e1f22');
    const dump = (x, z, rot) => { const hx = rot ? 0.6 : 0.95, hz = rot ? 0.95 : 0.6; w.box(x - hx, 0, z - hz, x + hx, 1.2, z + hz, { base: DUMP }); w.box(x - hx - 0.05, 1.2, z - hz - 0.05, x + hx + 0.05, 1.32, z + hz + 0.05, { base: LID }); };
    dump(-14, -5.2, false); dump(-11.6, -5.2, false); dump(15.8, 4.9, false); dump(4.5, -6.6, false);
    // crates and a low wall to vault over
    w.box(-3, 0, 4.2, -1.8, 0.9, 5.4, { base: concrete('#9c7a4a', 0.3) });
    w.box(6, 0, -1.2, 6.4, 1.0, 1.2, { base: concrete('#a8aaae', 0.5) });
    w.table(13, 0, 3.6, Math.PI / 2);
    w.spawns.push(new V3(-21, 0, -2), new V3(-21, 0, 2), new V3(1.2, 0, 11), new V3(-21, 0, 0));
    w.start = { x: 11.8, z: 0, yaw: -Math.PI / 2 };
  },

  // Dust Yard: brutalist concrete compound in the desert at sunset. Roof to throw people off, a glass office, a tower.
  yard(w) {
    const g = w.g;
    g.scene.background = new THREE.Color('#d98a52');
    g.scene.fog = new THREE.Fog('#d9875a', 22, 80);
    const sunDir = new V3(-0.55, 0.22, -0.8);
    w.sky('#4a3a6a', '#c56a4c', '#f0a060', sunDir, '#ffd9a0');
    w.lights('#ffd2b0', '#6a4a3a', 1.4, '#ffb070', 2.6, sunDir.clone().multiplyScalar(40));
    const CON = concrete('#a69d93'), CON2 = concrete('#8e877f', 0.45), BR = brick('#9a5a42', '#6e6157');
    // ground: big sand slab, then a concrete pad
    w.box(-40, -1, -40, 40, 0, 40, { color: '#c4935d', base: sand });
    w.box(-12, 0, -12, 12, 0.04, 12, { color: '#9a938a', base: tiles('#9a938a', 'rgba(0,0,0,0.12)') });
    // invisible fence far out so nobody walks into the dunes forever
    for (const s of [-1, 1]) { w.box(-30, 0, s * 30, 30, 4, s * 30.5, { hidden: true }); w.box(s * 30, 0, -30, s * 30.5, 4, 30, { hidden: true }); }
    // main block: 9 x 6, 3.4 tall, door gaps, windows, flat roof with a parapet
    const X0 = -4.5, X1 = 4.5, Z0 = -9, Z1 = -3, H = 3.4, T = 0.3;
    w.box(X0, 0, Z0, X1, H, Z0 + T, { base: CON });                     // back wall
    w.box(X0, 0, Z0, X0 + T, H, Z1, { base: CON });                     // sides
    w.box(X1 - T, 0, Z0, X1, H, Z1, { base: CON });
    // front wall: door (1.4 wide) in the middle, a glass window to its right
    w.box(X0, 0, Z1 - T, -0.7, H, Z1, { base: CON });
    w.box(-0.7, 2.3, Z1 - T, 0.7, H, Z1, { base: CON });
    w.box(0.7, 0, Z1 - T, 1.5, H, Z1, { base: CON });
    w.box(1.5, 0, Z1 - T, 3.7, 0.95, Z1, { base: CON });
    w.box(1.5, 0.95, Z1 - 0.18, 3.7, 2.3, Z1 - 0.12, { glass: true });
    w.box(1.5, 2.3, Z1 - T, 3.7, H, Z1, { base: CON });
    w.box(3.7, 0, Z1 - T, X1, H, Z1, { base: CON });
    w.box(X0 + T, 0.04, Z0 + T, X1 - T, 0.06, Z1 - T, { color: '#7b8088', base: tiles('#7b8088', 'rgba(0,0,0,0.15)') });   // inside floor
    w.box(X0, H, Z0, X1, H + 0.25, Z1, { base: CON2 });                // roof slab
    for (const [a, b, c, d] of [[X0, Z0, X1, Z0 + 0.2], [X0, Z1 - 0.2, X1, Z1], [X0, Z0, X0 + 0.2, Z1], [X1 - 0.2, Z0, X1, Z1]]) w.box(a, H + 0.25, b, c, H + 0.75, d, { base: CON2 });
    // stairs up the east side to the roof (open the parapet there)
    for (let i = 0; i < 9; i++) w.box(X1, 0, -4.2 + i * -0.45 - 0.45, X1 + 1.2, 0.4 + i * 0.4, -4.2 + i * -0.45, { base: CON2 });
    w.box(X1, 0, -8.7, X1 + 1.2, H + 0.25, -8.25, { base: CON2 });
    // brick side shed with a low roof (2.2) — a second throwing ledge
    w.box(-11, 0, -2, -7, 2.2, 2, { base: BR });
    w.box(-11.2, 2.2, -2.2, -6.8, 2.4, 2.2, { base: CON2 });
    // the tower: 2.4 square, 9 m, slit windows, a ring of blood waiting to happen
    w.box(7, 0, -11, 9.4, 9, -8.6, { base: CON });
    // low walls / barriers for cover
    w.box(-5, 0, 3, -2.5, 1.0, 3.35, { base: CON2 });
    w.box(2.5, 0, 4.5, 5, 1.0, 4.85, { base: CON2 });
    w.box(6.5, 0, -1.5, 6.85, 1.0, 1.5, { base: CON2 });
    w.box(-7, 0, 6, -6, 0.8, 7, { base: concrete('#86663d', 0.4) });  // crates
    w.box(-6.9, 0.8, 6.2, -6.1, 1.5, 6.9, { base: concrete('#86663d', 0.35) });
    // pillars of a half-built frame
    for (const x of [-2, 2]) w.box(x - 0.2, 0, 8.6, x + 0.2, 3.2, 9, { base: CON });
    w.box(-2.2, 3.2, 8.5, 2.2, 3.5, 9.1, { base: CON2 });
    w.table(4.2, 7.6, 3.6, 0);
    w.spawns.push(new V3(0, 0, -22), new V3(-20, 0, -8), new V3(20, 0, -6), new V3(-18, 0, 14), new V3(18, 0, 16), new V3(0, 0, 22));
    w.start = { x: 4.2, z: 6.6, yaw: Math.PI };
  },

  // The Block: concrete-and-brick interior at night, cold strip lights.
  block(w) {
    const g = w.g;
    g.scene.background = new THREE.Color('#1c2230');
    g.scene.fog = new THREE.Fog('#1c2230', 10, 30);
    w.sky('#0e1220', '#1c2433', '#262c3a', new V3(0.3, 0.6, 0.2), '#000000');
    w.lights('#a9c4ff', '#2c2a2e', 1.2, '#cfe0ff', 1.5, new V3(6, 18, 4));
    const S = 9, H = 3.4, T = 0.4, D = 0.8;
    const BR = brick('#5c5a5a', '#3a3838'), CON = concrete('#6f747c');
    w.box(-S - T, -0.5, -S - T, S + T, 0, S + T, { color: '#5d6672', base: tiles('#5d6672', 'rgba(0,0,0,0.25)') });
    w.box(-S - T, H, -S - T, S + T, H + 0.3, S + T, { base: concrete('#4d525a') });
    for (const sz of [-1, 1]) {
      w.box(-S - T, 0, sz * S, -D, H, sz * (S + T), { base: BR });
      w.box(D, 0, sz * S, S + T, H, sz * (S + T), { base: BR });
      w.box(-D, 2.3, sz * S, D, H, sz * (S + T), { base: BR });
      w.box(sz * S, 0, -S, sz * (S + T), H, -D, { base: BR });
      w.box(sz * S, 0, D, sz * (S + T), H, S, { base: BR });
      w.box(sz * S, 2.3, -D, sz * (S + T), H, D, { base: BR });
      w.box(-D - 0.3, 0, sz * (S + T), -D, H, sz * (S + 3), { base: BR });
      w.box(D, 0, sz * (S + T), D + 0.3, H, sz * (S + 3), { base: BR });
      w.box(-D - 0.3, 0, sz * (S + 3), D + 0.3, H, sz * (S + 3.3), { base: BR });
      w.box(sz * (S + T), 0, -D - 0.3, sz * (S + 3), H, -D, { base: BR });
      w.box(sz * (S + T), 0, D, sz * (S + 3), H, D + 0.3, { base: BR });
      w.box(sz * (S + 3), 0, -D - 0.3, sz * (S + 3.3), H, D + 0.3, { base: BR });
      w.box(-D - 0.3, -0.5, sz * (S + T), D + 0.3, 0, sz * (S + 3.3), { base: CON });
      w.box(sz * (S + T), -0.5, -D - 0.3, sz * (S + 3.3), 0, D + 0.3, { base: CON });
    }
    // strip lights (emissive bars, no extra light cost)
    const lm = new THREE.MeshBasicMaterial({ color: '#e8f0ff' });
    for (const x of [-4.5, 0, 4.5]) for (const z of [-4.5, 0, 4.5]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.12), lm); m.position.set(x, H - 0.03, z); w.group.add(m); }
    w.spawns.push(new V3(0, 0, -S - 2), new V3(0, 0, S + 2), new V3(-S - 2, 0, 0), new V3(S + 2, 0, 0));
    w.box(-4.5, 0, -3, -3, 0.9, -2.4, { base: CON });
    w.box(3, 0, 2.4, 4.5, 0.9, 3, { base: CON });
    w.box(-0.4, 0, 4, 0.4, H, 4.8, { base: CON });
    w.box(-0.4, 0, -4.8, 0.4, H, -4, { base: CON });
    w.box(5.5, 0, -S, S, 1.6, -5.5, { base: CON });
    w.box(4.9, 0, -7.8, 5.5, 1.2, -6.2, { base: CON });
    w.box(4.3, 0, -7.8, 4.9, 0.8, -6.2, { base: CON });
    w.box(3.7, 0, -7.8, 4.3, 0.4, -6.2, { base: CON });
    w.box(-S, 0, 4.5, -6, 1.0, 4.7, { base: CON });
    w.box(-S, 1.0, 4.55, -6, 2.6, 4.65, { glass: true });
    w.box(-6.2, 0, 4.7, -6, 2.6, 7, { base: CON });
    w.box(-6.2, 2.6, 4.5, -S, 2.8, 7, { base: CON });
    w.table(4.6, 8.1, 3.6, 0);
    w.start = { x: 4.6, z: 7.0, yaw: Math.PI };
  },
};
