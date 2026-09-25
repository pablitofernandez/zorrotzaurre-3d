import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Batch, boxFromRect, hPlane, vPlane } from './geometry.js';
import * as D from './data/flat.js';
import * as F from './furniture.js';

function textPlane(text, w, h, { bg = '#e9e6e0', fg = '#2b2d30', font = 'bold 120px Segoe UI, Arial' } = {}) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.3 }));
  mesh.userData.setText = (s) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s, c.width / 2, c.height / 2);
    t.needsUpdate = true;
  };
  mesh.userData.setText(text);
  return mesh;
}

/**
 * Builds the detailed flat. Local coordinates = plan coordinates; y=0 = finished floor.
 */
export function buildUnit(M) {
  const group = new THREE.Group();
  group.name = 'flat';
  const colliders = [];
  const batch = new Batch();
  const glassBatch = new Batch();
  const ctx = { batch, colliders, group };
  const H = D.WALL_H;

  // ---------- floors
  const [ix0, iz0, ix1, iz1] = D.INTERIOR_BOUNDS;
  batch.add(M.floor, hPlane(ix0, iz0, ix1, iz1, 0.006, 1.2, 1.2));
  for (const r of D.TERRACE.floor) batch.add(M.terraceFloor, hPlane(...r, 0.01, 0.6, 0.6));
  batch.add(M.terraceFloor, hPlane(9.53, 9.55, 10.8, 12.75, 0.012, 0.6, 0.6));
  batch.add(M.landingFloor, hPlane(...D.LANDING.floor, 0.012, 1, 1));

  // ---------- walls
  for (const [x0, z0, x1, z1, t] of D.WALLS) {
    batch.add(M.wall, boxFromRect(x0, z0, x1, z1, 0, H));
    colliders.push([x0, z0, x1, z1]);
    // exterior face (facade onto terrace)
    if (t === 'e' && x0 <= 2.46 && z1 <= 14.2 && x1 <= 2.6) {
      batch.add(M.wallExt, vPlane(z0, z1, x0 - 0.004, 0, H, 'z', -1));
    }
  }
  for (const r of D.LINTELS) batch.add(M.wall, boxFromRect(...r, D.DOOR_H, H));

  // ---------- wall tiling (bathrooms and utility room)
  const tile = (a0, a1, fixed, axis, sign, y1 = D.CEIL_H) => batch.add(M.bathTile, vPlane(a0, a1, fixed, 0, y1, axis, sign, 1.2, 1.2));
  // Bathroom 1 [7.65,0.3,9.05,2.8]
  tile(7.65, 9.05, 0.304, 'x', 1);
  tile(0.3, 2.8, 9.046, 'z', -1);
  tile(7.65, 9.05, 2.796, 'x', -1);
  tile(0.3, 1.95, 7.654, 'z', 1);
  // Bathroom 2
  tile(7.65, 9.05, 3.734, 'x', 1);
  tile(3.73, 6.13, 9.046, 'z', -1);
  tile(8.4, 9.05, 6.126, 'x', -1);
  tile(6.13, 7.0, 8.396, 'z', -1);
  tile(7.65, 8.4, 6.996, 'x', -1);
  tile(3.73, 4.93, 7.654, 'z', 1);
  tile(5.8, 7.0, 7.654, 'z', 1);
  // Utility room
  tile(7.7, 9.23, 11.824, 'x', 1);
  tile(7.7, 9.23, 13.566, 'x', -1);
  tile(12.74, 13.57, 7.704, 'z', 1);
  tile(12.75, 13.57, 9.226, 'z', -1);
  tile(11.82, 11.9, 9.226, 'z', -1);

  // ---------- exterior joinery
  for (const w of D.WINDOWS) {
    const gx = (w.x0 + w.x1) / 2;
    const zs = w.segs.map((s) => s[0]);
    const ze = w.segs.map((s) => s[1]);
    const wz0 = Math.min(...zs), wz1 = Math.max(...ze);
    const facadeX0 = w.x0 < 2 ? 1.6 : 2.26;
    batch.add(M.wall, boxFromRect(facadeX0, wz0, w.x1, wz1, D.WIN_HEAD, H));
    batch.add(M.wallExt, vPlane(wz0, wz1, facadeX0 - 0.004, D.WIN_HEAD, H, 'z', -1));
    for (const [z0, z1, kind] of w.segs) {
      const f = 0.05;
      batch.add(M.frame, boxFromRect(w.x0, z0, w.x1, z1, 0, 0.04));
      batch.add(M.frame, boxFromRect(w.x0, z0, w.x1, z1, D.WIN_HEAD - 0.05, D.WIN_HEAD));
      batch.add(M.frame, boxFromRect(w.x0, z0, w.x1, z0 + f, 0, D.WIN_HEAD));
      batch.add(M.frame, boxFromRect(w.x0, z1 - f, w.x1, z1, 0, D.WIN_HEAD));
      if (z1 - z0 > 0.2) glassBatch.add(M.glass, boxFromRect(gx - 0.006, z0 + f, gx + 0.006, z1 - f, 0.04, D.WIN_HEAD - 0.05));
      if (kind === 'p') {
        batch.add(M.steel, boxFromRect(w.x1, z1 - 0.12, w.x1 + 0.04, z1 - 0.1, 1.0, 1.25));
      } else colliders.push([w.x0 - 0.02, z0, w.x1 + 0.02, z1]);
    }
  }

  // ---------- door leaves
  for (const d of D.DOOR_LEAVES) {
    const [x0, z0, x1, z1] = d.r;
    const mat = d.entry ? M.entryDoor : M.doorWhite;
    if (d.glass) {
      batch.add(mat, boxFromRect(x0, z0, x1, z1, 0.01, 1.05));
      batch.add(mat, boxFromRect(x0, z0, x1, z1, 1.95, 2.08));
      const alongZ = z1 - z0 > x1 - x0;
      if (alongZ) {
        batch.add(mat, boxFromRect(x0, z0, x1, z0 + 0.1, 1.05, 1.95));
        batch.add(mat, boxFromRect(x0, z1 - 0.1, x1, z1, 1.05, 1.95));
        glassBatch.add(M.glass, boxFromRect(x0 + 0.01, z0 + 0.1, x1 - 0.01, z1 - 0.1, 1.05, 1.95));
      }
    } else batch.add(mat, boxFromRect(x0, z0, x1, z1, 0.01, 2.08));
    // handle (at the free end)
    const alongZ = z1 - z0 > x1 - x0;
    if (alongZ) {
      const zf = Math.abs(z1 - 7.54) < 0.01 || d.r[1] > 7.5 ? z1 - 0.07 : z0 + 0.07;
      batch.add(M.steel, boxFromRect(x0 - 0.05, zf - 0.07, x1 + 0.05, zf + 0.01, 1.0, 1.03));
    } else {
      const xf = x0 + 0.07;
      batch.add(M.steel, boxFromRect(xf - 0.01, z0 - 0.05, xf + 0.07, z1 + 0.05, 1.0, 1.03));
    }
  }
  // Bathroom 2 sliding door (leaf retracted)
  batch.add(M.doorWhite, boxFromRect(7.575, 4.93, 7.625, 5.12, 0.01, 2.08));

  // ---------- terrace: dividers, railing (collision), drying-area louvers
  for (const r of D.TERRACE.dividers) {
    batch.add(M.slab, boxFromRect(...r, 0, 2.2));
    colliders.push(r);
  }
  colliders.push([0.05, 0.03, 0.3, 14.12]);
  const [lx0, lz0, lx1, lz1] = D.LOUVERS;
  for (let z = lz0; z < lz1; z += 0.12) batch.add(M.frame, boxFromRect(lx0, z, lx1, z + 0.035, 0, H));
  colliders.push([lx0, lz0, lx1, lz1]);

  // ---------- landing
  for (const r of D.LANDING.walls) {
    batch.add(M.wall, boxFromRect(...r, 0, H));
    colliders.push(r);
  }
  colliders.push([10.9, 0.0, 11.1, 9.6]);
  for (const [z0, z1] of D.LANDING.lifts) {
    batch.add(M.frame, boxFromRect(10.9, z0 - 0.08, 10.95, z1 + 0.08, 0, 2.2));
    batch.add(M.liftDoor, boxFromRect(10.88, z0, 10.9, (z0 + z1) / 2 - 0.005, 0, 2.1));
    batch.add(M.liftDoor, boxFromRect(10.88, (z0 + z1) / 2 + 0.005, 10.9, z1, 0, 2.1));
    batch.add(M.black, boxFromRect(10.88, z1 + 0.15, 10.9, z1 + 0.25, 1.05, 1.25));
  }
  const [sz0, sz1] = D.LANDING.stairDoor;
  batch.add(M.doorWhite, boxFromRect(10.88, sz0, 10.9, sz1, 0, 2.1));
  batch.add(M.steel, boxFromRect(10.84, sz1 - 0.2, 10.88, sz1 - 0.1, 1.0, 1.03));
  const plaque = textPlane('', 0.3, 0.16);
  plaque.position.set(10.62, 1.6, 7.325);
  plaque.rotation.y = Math.PI;
  group.add(plaque);
  const plaqueStair = textPlane('', 0.5, 0.14, { font: 'bold 70px Segoe UI, Arial' });
  plaqueStair.position.set(10.89, 1.7, 4.55);
  plaqueStair.rotation.y = -Math.PI / 2;
  group.add(plaqueStair);
  const setFloor = (n) => {
    plaque.userData.setText(`${n}º C`);
    plaqueStair.userData.setText(`PLANTA ${n}`);
  };
  batch.add(M.fabricGrey, hPlane(9.6, 6.6, 10.3, 7.2, 0.018, 1, 1)); // doormat

  // ---------- furniture
  // Bedroom 1
  F.bed(ctx, M, 4.25, 1.38, 'S', 1.6, 2.0, M.fabricBeige);
  F.nightstand(ctx, M, 3.08, 0.52);
  F.nightstand(ctx, M, 5.42, 0.52);
  F.wardrobe(ctx, M, 6.9, 0.3, 7.55, 1.9, 2.45, 'x');
  F.rug(ctx, M, 3.2, 2.2, 5.3, 3.0);
  F.plant(ctx, M, 2.3, 0.75, 1.1);
  // Bedroom 2
  F.bed(ctx, M, 3.9, 4.3, 'S', 1.35, 1.9, M.fabricBlue);
  F.nightstand(ctx, M, 2.9, 3.5);
  F.nightstand(ctx, M, 4.9, 3.5, false);
  F.wardrobe(ctx, M, 5.75, 3.27, 6.36, 4.77, 2.45, 'x');
  // Bedroom 3
  F.bed(ctx, M, 3.6, 7.59, 'N', 0.9, 1.9, M.fabricGrey);
  F.desk(ctx, M, 3.0, 5.98, 4.3, 6.58);
  F.chair(ctx, M, 3.65, 6.9, 'N', M.lacquer, M.fabricGrey);
  F.wardrobe(ctx, M, 5.76, 7.0, 6.36, 8.62, 2.45, 'x');
  // Living-dining room
  F.tvUnit(ctx, M, 3.2, 8.73, 5.4, 9.15);
  F.sofa(ctx, M, 4.3, 11.1, 'N', 2.4);
  F.coffeeTable(ctx, M, 3.75, 9.75, 4.85, 10.3);
  F.rug(ctx, M, 2.95, 9.4, 5.65, 11.45);
  F.diningTable(ctx, M, 7.9, 10.45, true, 1.6, 0.9);
  F.chair(ctx, M, 7.2, 10.05, 'E');
  F.chair(ctx, M, 7.2, 10.85, 'E');
  F.chair(ctx, M, 8.6, 10.05, 'W');
  F.chair(ctx, M, 8.6, 10.85, 'W');
  F.chair(ctx, M, 7.9, 9.4, 'S');
  F.chair(ctx, M, 7.9, 11.48, 'N');
  F.pendant(ctx, M, 7.9, 10.45, D.CEIL_H, 0.85, 0.3);
  F.plant(ctx, M, 9.0, 9.7, 1.4);
  F.plant(ctx, M, 2.85, 11.45, 1.0);
  // Kitchen
  F.kitchen(ctx, M);
  F.roundTable(ctx, M, 3.3, 12.55, 0.42);
  F.chair(ctx, M, 3.3, 12.0, 'S', M.wood, M.fabricBeige);
  F.chair(ctx, M, 3.95, 12.7, 'W', M.wood, M.fabricBeige);
  F.pendant(ctx, M, 3.3, 12.55, D.CEIL_H, 0.95, 0.2);
  // Utility room
  F.washer(ctx, M, 8.63, 12.97, 9.23, 13.57);
  // Bathroom 1: shower, WC, washbasin
  F.shower(ctx, M, 7.68, 0.32, 9.03, 1.38, 1.37, 8.55);
  F.wc(ctx, M, 8.75, 1.74, 'W');
  F.vanity(ctx, M, 8.55, 2.08, 9.05, 2.76, 9.05);
  // Bathroom 2: bathtub, washbasin, WC
  F.bathtub(ctx, M, 7.65, 3.73, 9.05, 4.42);
  F.vanity(ctx, M, 8.55, 4.57, 9.05, 5.37, 9.05);
  F.wc(ctx, M, 8.02, 6.7, 'N');
  // Entrance hall and corridor
  F.wardrobe(ctx, M, 7.47, 7.54, 9.27, 8.18, 2.45, 'z');
  F.wardrobe(ctx, M, 7.55, 7.05, 8.17, 7.44, 2.45, 'x');
  // Terrace
  F.roundTable(ctx, M, 1.35, 11.3, 0.4, M.red);
  F.chair(ctx, M, 1.35, 10.7, 'S', M.red, M.red);
  F.chair(ctx, M, 1.35, 11.9, 'N', M.red, M.red);
  F.lounger(ctx, M, 1.0, 8.2, 'E');
  F.lounger(ctx, M, 1.0, 2.6, 'E');
  F.plant(ctx, M, 0.55, 7.35, 1.3);
  F.plant(ctx, M, 0.6, 12.9, 1.1);
  F.plant(ctx, M, 0.6, 1.1, 1.2);
  // Drying area
  F.clothesRack(ctx, M, 9.75, 10.0, 10.45, 11.6);

  // ---------- recessed lighting (kitchen, bathrooms, corridors, terrace)
  const dl = [
    [4.0, 12.6], [5.6, 12.6], [6.9, 12.9], [8.3, 1.9], [8.3, 5.3], [7.0, 5.6], [7.0, 6.9], [8.4, 8.8], [9.9, 8.4],
    [8.4, 12.5], [10.1, 11.2], [9.9, 2.0], [9.9, 5.0], [7.0, 3.9],
  ];
  for (const [x, z] of dl) F.downlight(ctx, M, x, z, D.CEIL_H);
  for (const z of [2.5, 5.5, 8.5, 11.5]) F.downlight(ctx, M, 1.1, z, 2.75);

  batch.build(group);
  glassBatch.build(group, { cast: false, receive: false });

  // False ceiling (hidden in "dollhouse" view)
  const ceiling = new THREE.Mesh(hPlane(ix0, iz0, ix1, iz1, D.CEIL_H, 1, 1, true), M.ceiling);
  ceiling.receiveShadow = true;
  ceiling.name = 'false-ceiling';
  group.add(ceiling);

  // Interior lights (switch on at dusk)
  const lights = [];
  for (const [x, z, i] of [
    [5.2, 10.2, 1.2], [5.0, 12.8, 0.9], [4.3, 1.8, 0.8], [3.9, 4.6, 0.7], [4.5, 7.3, 0.7], [8.3, 3.5, 0.6], [8.6, 8.7, 0.6], [1.2, 9.5, 0.5],
  ]) {
    const l = new THREE.PointLight('#ffd9a0', 0, 9, 1.6);
    l.position.set(x, 2.35, z);
    l.userData.base = i * 6;
    group.add(l);
    lights.push(l);
  }

  // Room labels
  const labels = [];
  for (const r of D.ROOMS) {
    const el = document.createElement('div');
    el.className = 'room-label';
    el.innerHTML = `<b>${r.name}</b>${r.area ? `<span>${r.area.toFixed(2).replace('.', ',')} m²</span>` : ''}`;
    const o = new CSS2DObject(el);
    o.position.set(r.label[0], 0.4, r.label[1]);
    o.visible = false;
    group.add(o);
    labels.push(o);
  }

  return { group, colliders, ceiling, lights, labels, setFloor };
}
