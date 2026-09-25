import * as THREE from 'three';
import { Batch, boxFromRect, hPlane } from './geometry.js';

export const FLOOR0_H = 4.2;
export const FLOOR_H = 3.05;
export const SLAB_T = 0.3;
export const NFLOORS = 9; // ground floor + 9 floors
// Floors where the "C" flat type (wing W1) repeats with the same layout
export const UNIT_FLOORS = [1, NFLOORS];
export const DEFAULT_FLOOR = 5;
export const levelY = (n) => (n <= 0 ? 0 : FLOOR0_H + (n - 1) * FLOOR_H);
export const SHELL_H = FLOOR_H - SLAB_T; // 2.75

// Wings of block RD-15.1 (in unit plan coordinates).
// t: sides with terrace, e: exposed sides without terrace. id W1 = wing containing the "C" flats
export const RD151_WINGS = [
  { id: 'W1', r: [0.15, 0.03, 10.95, 14.12], t: 'W', depth: 1.45 },
  { id: 'W2', r: [-1.2, -15.0, 10.95, 0.03], t: 'WN' },
  { id: 'W3', r: [10.95, -17.0, 24.5, 0.03], t: 'NE' },
  { id: 'CA', r: [10.95, 0.03, 17.0, 9.5], core: true },
  { id: 'W4', r: [17.0, 0.03, 27.0, 13.0], t: 'E', e: 'N' },
  { id: 'M1', r: [10.95, 9.5, 17.0, 14.12], patio: true }, // light well (drying area)
  { id: 'W5', r: [0.8, 14.12, 11.5, 29.5], t: 'W' },
  { id: 'CB', r: [11.5, 14.12, 17.0, 23.0], core: true },
  { id: 'W6', r: [17.0, 13.0, 28.0, 27.0], t: 'E', e: 'S' },
  { id: 'M2', r: [11.5, 23.0, 17.0, 29.5], alt: true },
  { id: 'W7', r: [8.5, 29.5, 24.5, 35.0], t: 'S', e: 'WE' },
];

function edges(r, sides) {
  const [x0, z0, x1, z1] = r;
  const out = [];
  for (const s of sides || '') {
    if (s === 'W') out.push(['z', x0, z0, z1, -1]);
    if (s === 'E') out.push(['z', x1, z0, z1, 1]);
    if (s === 'N') out.push(['x', z0, x0, x1, -1]);
    if (s === 'S') out.push(['x', z1, x0, x1, 1]);
  }
  return out;
}

function inset(r, t, e, depth) {
  let [x0, z0, x1, z1] = r;
  const d = (s) => ((t || '').includes(s) ? depth : (e || '').includes(s) ? 0.25 : 0);
  x0 += d('W');
  x1 -= d('E');
  z0 += d('N');
  z1 -= d('S');
  return [x0, z0, x1, z1];
}

function railing(batchSolid, batchGlass, M, r, sides, y) {
  for (const [axis, fixed, a0, a1, sign] of edges(r, sides)) {
    const o = sign * 0.06;
    if (axis === 'z') {
      batchSolid.add(M.slab, boxFromRect(fixed - 0.06 - o, a0, fixed + 0.06 - o, a1, y, y + 0.2));
      batchGlass.add(M.railGlass, boxFromRect(fixed - 0.012 - o, a0, fixed + 0.012 - o, a1, y + 0.2, y + 1.08));
    } else {
      batchSolid.add(M.slab, boxFromRect(a0, fixed - 0.06 - o, a1, fixed + 0.06 - o, y, y + 0.2));
      batchGlass.add(M.railGlass, boxFromRect(a0, fixed - 0.012 - o, a1, fixed + 0.012 - o, y + 0.2, y + 1.08));
    }
  }
}

/**
 * Builds a residential block. Returns { group, floors[] }.
 * skip(n, wing) => true to omit a wing's envelope on a floor.
 * split(wing) => true to build that wing's envelope as a separate group per floor
 * (floors[n].userData.split), so it can be hidden to show the detailed unit on any floor.
 */
export function buildBlock(M, { wings = RD151_WINGS, floors = NFLOORS, offset = [0, 0], skip = () => false, split = () => false, name = 'block' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(offset[0], 0, offset[1]);
  const floorGroups = [];

  for (let n = 0; n <= floors + 1; n++) {
    const fg = new THREE.Group();
    fg.name = `${name}-F${n}`;
    fg.userData.floor = n;
    const solid = new Batch();
    const glass = new Batch();
    const splitBatch = new Batch();
    const y = levelY(n);

    for (const w of wings) {
      if (w.patio) continue;
      const depth = w.depth ?? 1.6;
      if (n === 0) {
        // Ground floor: recessed glazing and columns
        if (w.core) {
          solid.add(M.core, boxFromRect(...w.r, 0, FLOOR0_H - SLAB_T, 3, SHELL_H));
        } else {
          const ir = inset(w.r, w.t, w.e, Math.min(depth, 1.2));
          solid.add(M.groundFloor, boxFromRect(...ir, 0, FLOOR0_H - SLAB_T, 3.0, FLOOR0_H - SLAB_T));
          const [x0, z0, x1, z1] = w.r;
          for (const [axis, fixed, a0, a1] of edges(w.r, w.t)) {
            const len = a1 - a0;
            const cnt = Math.max(2, Math.round(len / 6));
            for (let i = 0; i <= cnt; i++) {
              const a = a0 + 0.3 + ((len - 0.6) * i) / cnt;
              if (axis === 'z') {
                const x = fixed + (fixed === x0 ? 0.5 : -0.5);
                solid.add(M.slab, boxFromRect(x - 0.2, a - 0.2, x + 0.2, a + 0.2, 0, FLOOR0_H - SLAB_T));
              } else {
                const z = fixed + (fixed === z0 ? 0.5 : -0.5);
                solid.add(M.slab, boxFromRect(a - 0.2, z - 0.2, a + 0.2, z + 0.2, 0, FLOOR0_H - SLAB_T));
              }
            }
          }
          void x1;
          void z1;
        }
        continue;
      }

      // Floor slab
      solid.add(M.slab, boxFromRect(...w.r, y - SLAB_T, y, 3, 3));

      if (n === floors + 1) {
        // Roof
        if (!w.core) railing(solid, glass, M, w.r, w.t, y);
        continue;
      }

      if (!skip(n, w)) {
        const ir = w.core ? w.r : inset(w.r, w.t, w.e, depth);
        const mat = w.core ? M.core : w.alt ? M.facadeB : M.facade;
        const target = split(w) ? splitBatch : solid;
        target.add(mat, boxFromRect(...ir, y, y + SHELL_H, 3.0, SHELL_H));
        // cap for the section view (visible when upper floors are hidden)
        target.add(M.slab, boxFromRect(...ir, y + SHELL_H, y + SHELL_H + 0.01, 3, 3));
      }
      if (!w.core) railing(solid, glass, M, w.r, w.t, y);
    }

    solid.build(fg);
    glass.build(fg, { cast: false, receive: false });
    if (splitBatch.map.size) {
      const sg = new THREE.Group();
      sg.name = `${name}-F${n}-split`;
      splitBatch.build(sg);
      fg.add(sg);
      fg.userData.split = sg;
    }
    floorGroups.push(fg);
    group.add(fg);
  }

  // Roof elements
  const roof = floorGroups[floors + 1];
  roof.add(buildRoof(M, wings, levelY(floors + 1)));
  return { group, floors: floorGroups };
}

function buildRoof(M, wings, y) {
  const g = new THREE.Group();
  const b = new Batch();
  const glass = new Batch();
  const byId = Object.fromEntries(wings.map((w) => [w.id, w]));
  // Lift / services housings
  for (const w of wings.filter((w) => w.core)) {
    const [x0, z0, x1, z1] = w.r;
    b.add(M.core, boxFromRect(x0 + 0.5, z0 + 0.8, x1 - 0.5, z1 - 0.8, y, y + 3.2, 3, 3.2));
    b.add(M.slab, boxFromRect(x0 + 0.3, z0 + 0.6, x1 - 0.3, z1 - 0.6, y + 3.2, y + 3.45));
  }
  // Panoramic pool + sun deck on W4
  const pw = byId.W4 || wings[0];
  if (pw) {
    const [x0, z0, x1, z1] = pw.r;
    b.add(M.terraceFloor, boxFromRect(x0 + 0.2, z0 + 0.2, x1 - 1.7, z1 - 0.2, y, y + 0.35, 1.2, 1.2));
    const px0 = x0 + 2.2, px1 = x1 - 2.4, pz0 = z0 + 3.0, pz1 = z0 + 7.0;
    b.add(M.slab, boxFromRect(px0 - 0.25, pz0 - 0.25, px1 + 0.25, pz1 + 0.25, y + 0.35, y + 0.55));
    const water = new THREE.Mesh(hPlane(px0, pz0, px1, pz1, y + 0.5), M.pool);
    g.add(water);
    // sun loungers
    for (let i = 0; i < 4; i++) {
      const lx = x0 + 2.4 + i * 1.6;
      b.add(M.wood, boxFromRect(lx, z1 - 3.4, lx + 0.7, z1 - 1.4, y + 0.35, y + 0.7));
      b.add(M.fabricWhite, boxFromRect(lx + 0.05, z1 - 3.35, lx + 0.65, z1 - 2.8, y + 0.7, y + 0.95));
    }
    // pergola
    for (const [cx, cz] of [
      [x0 + 1.0, z1 - 5.5],
      [x0 + 7.0, z1 - 5.5],
      [x0 + 1.0, z1 - 0.8],
      [x0 + 7.0, z1 - 0.8],
    ])
      b.add(M.slab, boxFromRect(cx - 0.15, cz - 0.15, cx + 0.15, cz + 0.15, y + 0.35, y + 3.0));
    for (let i = 0; i < 10; i++) {
      const lx = x0 + 0.9 + i * 0.7;
      b.add(M.wood, boxFromRect(lx, z1 - 5.7, lx + 0.12, z1 - 0.6, y + 2.9, y + 3.1));
    }
    glass.add(M.railGlass, boxFromRect(x0 + 0.1, z0 + 0.1, x0 + 0.13, z1 - 0.1, y + 0.35, y + 1.5));
  }
  // Photovoltaic panels on W2, W5
  for (const id of ['W2', 'W5', 'W7']) {
    const w = byId[id];
    if (!w) continue;
    const [x0, z0, x1, z1] = w.r;
    b.add(M.slab, boxFromRect(x0 + 1.8, z0 + 1.8, x1 - 1.8, z1 - 1.8, y, y + 0.08)); // gravel
    for (let z = z0 + 2.5; z < z1 - 3; z += 2.4) {
      for (let x = x0 + 2.4; x < x1 - 3; x += 1.9) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 1.1), M.screen);
        p.position.set(x + 0.85, y + 0.6, z + 0.55);
        p.rotation.x = -0.35;
        p.castShadow = true;
        g.add(p);
      }
    }
  }
  b.build(g);
  glass.build(g, { cast: false, receive: false });
  return g;
}

export function unitHighlight(M, bounds, floor) {
  const [x0, z0, x1, z1] = bounds;
  const y = levelY(floor);
  const g = new THREE.Group();
  const geo = boxFromRect(x0 - 0.08, z0 - 0.08, x1 + 0.08, z1 + 0.08, y - 0.05, y + SHELL_H + 0.05);
  const box = new THREE.Mesh(geo, M.highlight);
  box.renderOrder = 5;
  g.add(box);
  const edgesGeo = new THREE.EdgesGeometry(geo);
  const lines = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 1 }));
  lines.renderOrder = 6;
  g.add(lines);
  g.userData.box = box;
  g.userData.lines = lines;
  return g;
}
