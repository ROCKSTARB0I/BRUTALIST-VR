// Contacts between weapons / fists / feet and stickman bones, and hitscan bullets.
// Sharp edges cut when the edge moves fast enough across the bone (or keeps sawing); everything else is blunt.
import * as THREE from '../vendor/three.module.js?v=4';
import { DT, segSeg, rayCapsule } from './phys.js?v=4';
import { J, ZONE } from './body.js?v=4';
const V3 = THREE.Vector3;
const res = { s: 0, t: 0, d2: 0, c1: new V3(), c2: new V3() };
const _vw = new V3(), _vb = new V3(), _vr = new V3(), _n = new V3(), _e = new V3(), _ax = new V3(), _t = new V3(), _u = new V3();

function boneVel(bone, t, out) {
  bone.a.vel(out); const bx = bone.b.vel(_u);
  return out.lerp(bx, t);
}
function separate(bone, n, pen, t) {
  if (pen <= 0) return;
  bone.a.p.addScaledVector(n, pen * (1 - t) * 1.2);
  bone.b.p.addScaledVector(n, pen * t * 1.2);
}

export function weaponContacts(g, w) {
  if (w.mode === 'rack') return;
  const def = w.def;
  for (const body of g.bodies) {
    if (body.center().distanceToSquared(w.pos) > 6) continue;
    const bones = body.bones.slice();
    for (const bone of bones) {
      if (bone.gone || bone.cool > g.time) continue;
      for (let k = def.shapes.length - 1; k >= 0; k--) {   // edges are listed last: test them first
        const sh = def.shapes[k], A = w.cur[k].a, B = w.cur[k].b;
        segSeg(A, B, bone.a.p, bone.b.p, res);
        const rr = sh.r + bone.r;
        if (res.d2 > rr * rr) continue;
        const s = res.s, t = res.t, dist = Math.sqrt(res.d2);
        _vw.copy(A).sub(w.prev[k].a).lerp(_t.copy(B).sub(w.prev[k].b), s).multiplyScalar(1 / DT);
        boneVel(bone, t, _vb);
        _vr.subVectors(_vw, _vb);
        if (dist > 1e-5) _n.subVectors(res.c2, res.c1).divideScalar(dist); else _n.copy(_vr).normalize();
        _ax.subVectors(B, A).normalize();
        const r = strike(g, { w, sh, k, s, axis: _ax, mass: def.mass, pt: res.c2.clone() }, bone, t, _n, _vr, rr - dist);
        if (r) break;
      }
    }
  }
}

// sphere strikers: fists, the player's head, a kicking foot
export function strikerContacts(g, st) {
  for (const body of g.bodies) {
    if (body.center().distanceToSquared(st.pos) > 4) continue;
    for (const bone of body.bones.slice()) {
      if (bone.gone || bone.cool > g.time) continue;
      // closest point on bone to sphere
      _t.subVectors(bone.b.p, bone.a.p);
      const L2 = _t.lengthSq();
      const t = Math.max(0, Math.min(1, _u.subVectors(st.pos, bone.a.p).dot(_t) / L2));
      const cp = _e.copy(bone.a.p).addScaledVector(_t, t);
      const d = cp.distanceTo(st.pos), rr = bone.r + st.r;
      if (d > rr) continue;
      _vw.subVectors(st.pos, st.prev).multiplyScalar(1 / DT);
      boneVel(bone, t, _vb);
      _vr.subVectors(_vw, _vb);
      _n.subVectors(cp, st.pos).divideScalar(d || 1);
      strike(g, { st, mass: st.mass, pt: cp.clone() }, bone, t, _n, _vr, rr - d);
    }
  }
}

function strike(g, src, bone, t, n, vrel, pen) {
  const body = bone.body; body.wake();
  const sh = src.sh;
  const vn = vrel.dot(n);
  const pt = src.pt;
  // ---- edges ----
  if (sh && sh.edge) {
    const w = src.w;
    if (sh.stab) {
      const along = vrel.dot(src.axis);
      if (along > 2.3 && src.s > 0.5 && (bone.kind === 'torso' || bone.kind === 'head' || bone.kind === 'neck' || bone.kind === 'leg' || bone.kind === 'arm')) {
        const p = t < 0.5 ? bone.a : bone.b;
        if (!w.impaled.some(im => im.p === p)) {
          w.impale(p);
          bone.paint(pt, 0.08, 1);
          g.gore.burst(pt, 10, 2, 0.5);
          g.sfx.play('slice', pt, 1);
          body.hurt(bone.kind === 'head' ? 200 : bone.kind === 'torso' ? 55 : 20, 0.9);
          g.onHit(body, 'stab');
          bone.cool = g.time + 0.3;
          return 'stab';
        }
      }
    }
    _e.fromArray(sh.edge).applyQuaternion(w.quat);
    let es = vrel.dot(_e); if (sh.double) es = Math.abs(es);
    if (sh.saw) {
      // the chain does the cutting: any contact while running chews in, faster with pressure
      if (!w.running) es = Math.min(es, 0.5);
      else {
        es = Math.max(es, 0) + 1.2;
        bone.saw += DT * (0.5 + w.rev * 0.8);
        w.load = 1;
        if (Math.random() < 0.5) g.gore.emit(pt, _vw.copy(vrel).normalize().multiplyScalar(-2).add(_t.set(0, 1.5, 0)), 2, 1.4);
        if (Math.random() < 0.05) bone.paint(pt, bone.r * 2, 0.8);
      }
    }
    if (es > 0.9) {
      const thr = 2.0 * (bone.r / 0.05) / sh.sharp / Math.sqrt(src.mass / 2) * g.cutScale;
      bone.saw += es * DT * sh.sharp;                       // follow-through saws
      if ((!sh.saw && es > thr) || bone.saw > (sh.saw ? 0.12 + bone.r * 4 : bone.r * 3.5)) {
        const pn = new V3().crossVectors(src.axis, vrel).normalize();
        const bax = _t.subVectors(bone.b.p, bone.a.p).normalize();
        bone.saw = 0;
        if (Math.abs(pn.dot(bax)) < 0.42) {                  // plane runs along the bone
          if (bone.kind === 'head' && bone.b === body.P[J.CROWN] && body.splitHead(pn)) {
            g.onSplit(body, pt);
            if (w.mode === 'held') w.vel.multiplyScalar(0.8);
            return 'cut';
          }
          gash(g, body, bone, pt, vrel, es);
          bone.cool = g.time + 0.15;
          return 'hit';
        }
        if (body.cut(bone, t, pn)) {
          if (w.mode === 'held') w.vel.multiplyScalar(0.88);
          else w.vel.multiplyScalar(0.9);
          return 'cut';
        }
      }
      if (es > 1.6 && !sh.saw) gash(g, body, bone, pt, vrel, es * 0.5);
      if (sh.saw && Math.random() < 0.08) { g.sfx.play('slice', pt, 0.5, 0.8); body.hurt(4, 0.3); }
      if (!sh.saw) bone.cool = g.time + 0.08;
      separate(bone, n, pen * 0.25, t);
      return 'hit';
    }
  }
  if (vn < 0.5) { separate(bone, n, pen * 0.5, t); return null; }
  // ---- blunt ----
  const bm = (bone.a.m * (1 - t) + bone.b.m * t) * 1.6;
  const mu = src.mass * bm / (src.mass + bm);
  const E = 0.5 * mu * vn * vn;
  const dv = vn * (src.mass / (src.mass + bm)) * 1.7;
  bone.a.addVel(n, dv * ((1 - t) + 0.35));
  bone.b.addVel(n, dv * (t + 0.35));
  separate(bone, n, pen, t);
  if (src.w && src.w.mode === 'held') src.w.vel.addScaledVector(n, -vn * bm / (src.mass + bm) * 0.9);
  if (src.w && src.w.lp) for (const p of src.w.lp) p.addVel(n, -vn * 0.4);
  bone.cool = g.time + 0.1;
  if (E < 2) return 'tap';
  if (src.w && src.w.def.homerun && E > 3) { g.homerun(body, n, pt); return 'homerun'; }
  const dmg = E * (ZONE[bone.kind] || 1) * 0.9 * (src.st ? src.st.dmgMul || 1 : 1);
  const isHead = bone.kind === 'head' && bone.b === body.P[J.CROWN];
  g.sfx.play(src.st && src.st.kind === 'fist' && E < 25 ? 'punch' : 'blunt', pt, Math.min(1.2, 0.3 + E / 30), isHead ? 0.9 : 1);
  if (E > 10) { bone.paint(pt, 0.05 + E * 0.002, Math.min(1, E / 40)); g.gore.burst(pt, Math.min(18, E / 3) | 0, 1.5, 0.6); }
  if (isHead && body.armor.helmet) {
    if (E > 9) body.loseHat(n);
    body.hurt(dmg * 0.3, Math.min(1, E / 30));
    return 'helmet';
  }
  if (isHead && body.hat && E > 6) body.loseHat(n);
  if (isHead && E > 34 && body.crushHead(n)) {
    g.sfx.play('crush', pt, 1.2, 1, true);
    g.gore.splash(pt, n, 14, 2.5);
    g.onHit(body, 'crush');
    return 'crush';
  }
  if ((bone.kind === 'arm' || bone.kind === 'leg') && E > 28 && bone.len > 0.18) {
    if (body.cut(bone, 0.5, n, 'break')) { g.sfx.play('chop', pt, 0.9, 0.8); body.hurt(15, 1); g.onHit(body, 'break'); return 'break'; }
  }
  body.hurt(dmg, Math.min(1, E / 22));
  g.onHit(body, 'blunt', E);
  return 'blunt';
}

function gash(g, body, bone, pt, vrel, es) {
  bone.paint(pt, bone.r * 1.8, 1);
  _vw.copy(vrel).normalize().multiplyScalar(1.5);
  g.gore.emit(pt, _vw, (4 + es * 2) | 0, 1.2);
  g.sfx.play('slice', pt, Math.min(1, 0.3 + es * 0.1), 1.15);
  body.hurt(es * 4 * (ZONE[bone.kind] || 1), 0.35);
  g.onHit(body, 'slash');
}

// hitscan with penetration, entry and exit wounds
export function shoot(g, origin, dir, gun) {
  let power = gun.pen;
  const hits = [];
  for (const body of g.bodies) {
    _t.subVectors(body.center(), origin);
    const along = _t.dot(dir);
    if (along < -1 || _t.addScaledVector(dir, -along).lengthSq() > 1.6) continue;
    for (const bone of body.bones) {
      const h = rayCapsule(origin, dir, bone.a.p, bone.b.p, bone.r);
      if (h && h[1] > 0) hits.push({ t0: Math.max(0, h[0]), t1: h[1], bone });
    }
  }
  hits.sort((a, b) => a.t0 - b.t0);
  let wh = g.phys.ray(origin, dir, 80);
  // glass shatters and the round carries on
  while (wh && wh.box.glass) { g.breakGlass(wh.box, origin.clone().addScaledVector(dir, wh.t), dir); wh = g.phys.ray(origin, dir, 80); }
  const worldT = wh ? wh.t : 80;
  let endT = worldT;
  const done = new Set();
  for (const h of hits) {
    if (h.t0 > worldT) break;
    if (done.has(h.bone)) continue;
    done.add(h.bone);
    const bone = h.bone, body = bone.body;
    if (bone.gone) continue;
    body.wake();
    const E = origin.clone().addScaledVector(dir, h.t0), X = origin.clone().addScaledVector(dir, h.t1);
    const axis = _t.subVectors(bone.b.p, bone.a.p), L2 = axis.lengthSq();
    const tt = Math.max(0, Math.min(1, _u.subVectors(E, bone.a.p).dot(axis) / L2));
    const nIn = E.clone().sub(bone.a.p.clone().addScaledVector(axis, tt)).normalize();
    const tx = Math.max(0, Math.min(1, _u.subVectors(X, bone.a.p).dot(axis) / L2));
    const nOut = X.clone().sub(bone.a.p.clone().addScaledVector(axis, tx)).normalize();
    power -= bone.r * 9;
    g.gore.hole(bone, E, nIn, 0.011 * Math.sqrt(gun.dmg), false);
    if (power > 0 || gun.dmg > 1.5) g.gore.hole(bone, X, nOut, 0.02 * gun.dmg, true);
    bone.paint(E, 0.05, 0.6);
    g.gore.emit(X, dir.clone().multiplyScalar(4 + gun.dmg * 2), (8 * gun.dmg) | 0, 1.4);
    g.gore.emit(E, dir.clone().multiplyScalar(-1.2), 3, 0.7);
    const imp = dir.clone().multiplyScalar(gun.force);
    bone.a.addVel(imp, 1 - tt + 0.25); bone.b.addVel(imp, tt + 0.25);
    g.sfx.play('splat', E, 0.9);
    const isHead = bone.kind === 'head' && bone.b === body.P[J.CROWN];
    if (isHead && body.armor.helmet && gun.dmg < 2) {
      body.loseHat(dir); body.hurt(10, 1); g.sfx.play('click', E, 1, 0.5);
      power = 0; endT = h.t1; g.onHit(body, 'helmet'); break;
    }
    if (isHead) {
      if (body.hat) body.loseHat(dir);
      if (gun.dmg >= 2.5) { body.crushHead(dir); g.sfx.play('crush', E, 1.2); g.gore.splash(E, dir, 16, 3); }
      else { body.hurt(400, 1); }
      g.onHit(body, 'headshot');
    } else {
      if (gun.dmg >= 2 && (bone.kind === 'arm' || bone.kind === 'leg' || bone.kind === 'neck') && Math.random() < 0.6) {
        body.cut(bone, tt, new V3().crossVectors(dir, axis).cross(axis).normalize());
      }
      const vest = bone.kind === 'torso' && body.armor.vest && gun.dmg < 2;
      body.hurt((bone.kind === 'torso' ? (vest ? 10 : 34) : 18) * gun.dmg, 0.45);
      g.onHit(body, 'shot');
    }
    if (gun.nail && !h.nailed) {
      const back = g.phys.ray(X, dir, 1.4, true);
      const p = tt < 0.5 ? bone.a : bone.b;
      if (back) { const at = X.clone().addScaledVector(dir, back.t); p.pin = at.clone(); g.nailMark(at, dir, p); }
      else g.nailMark(X, dir, null, bone);
      power = 0;
    }
    if (power <= 0) { endT = h.t1; break; }
  }
  if (wh && endT === worldT) {
    const P = origin.clone().addScaledVector(dir, wh.t);
    g.impact(P, wh, dir);
  }
  g.tracer(origin, origin.clone().addScaledVector(dir, Math.min(endT, 60)));
}
