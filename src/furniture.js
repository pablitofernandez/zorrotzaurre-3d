import * as THREE from 'three';
import { boxFromRect } from './geometry.js';

// Furniture piece in local coordinates (front towards +z), rotated and placed on the plan.
export class Piece {
  constructor(ctx, cx, cz, rot = 0) {
    this.ctx = ctx; // { batch, colliders, group }
    this.m = new THREE.Matrix4().makeRotationY(rot).premultiply(new THREE.Matrix4().makeTranslation(cx, 0, cz));
  }
  box(mat, x0, z0, x1, z1, y0, y1, uv = 1) {
    const g = boxFromRect(x0, z0, x1, z1, y0, y1, uv, uv);
    g.applyMatrix4(this.m);
    this.ctx.batch.add(mat, g);
    return this;
  }
  cyl(mat, x, z, r, y0, y1, seg = 20, r2 = r) {
    const g = new THREE.CylinderGeometry(r2, r, y1 - y0, seg);
    g.translate(x, (y0 + y1) / 2, z);
    g.applyMatrix4(this.m);
    this.ctx.batch.add(mat, g);
    return this;
  }
  sphere(mat, x, y, z, r, sx = 1, sy = 1, sz = 1) {
    const g = new THREE.SphereGeometry(r, 14, 10);
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    g.applyMatrix4(this.m);
    this.ctx.batch.add(mat, g);
    return this;
  }
  collide(x0, z0, x1, z1) {
    const pts = [
      [x0, z0],
      [x1, z0],
      [x0, z1],
      [x1, z1],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(this.m));
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    this.ctx.colliders.push([Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]);
    return this;
  }
}

const R = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 }; // direction the front faces

export function bed(ctx, M, cx, cz, dir, w, l, duvet = M.fabricWhite) {
  const p = new Piece(ctx, cx, cz, R[dir]);
  const hw = w / 2, hl = l / 2;
  p.box(M.woodDark, -hw, -hl, hw, hl, 0.08, 0.3);
  p.box(M.fabricWhite, -hw + 0.02, -hl + 0.02, hw - 0.02, hl - 0.02, 0.3, 0.52);
  p.box(duvet, -hw - 0.02, -hl + 0.55, hw + 0.02, hl + 0.02, 0.5, 0.57);
  p.box(M.fabricBeige, -hw - 0.03, hl - 0.45, hw + 0.03, hl + 0.03, 0.54, 0.59);
  const pillows = w > 1.2 ? [-w / 4, w / 4] : [0];
  for (const px of pillows) p.box(M.fabricWhite, px - 0.33, -hl + 0.1, px + 0.33, -hl + 0.45, 0.52, 0.66);
  p.box(M.fabricGrey, -hw - 0.06, -hl - 0.08, hw + 0.06, -hl, 0, 1.15);
  for (const [lx, lz] of [
    [-hw + 0.05, hl - 0.05],
    [hw - 0.05, hl - 0.05],
  ])
    p.box(M.woodDark, lx - 0.04, lz - 0.04, lx + 0.04, lz + 0.04, 0, 0.08);
  p.collide(-hw - 0.06, -hl - 0.08, hw + 0.06, hl + 0.03);
}

export function nightstand(ctx, M, cx, cz, lamp = true) {
  const p = new Piece(ctx, cx, cz);
  p.box(M.wood, -0.25, -0.2, 0.25, 0.2, 0.12, 0.5);
  p.box(M.woodDark, -0.2, -0.15, 0.2, 0.15, 0, 0.12);
  if (lamp) {
    p.cyl(M.brass, 0, 0, 0.07, 0.5, 0.52);
    p.cyl(M.brass, 0, 0, 0.012, 0.52, 0.78);
    p.cyl(M.lampWarm, 0, 0, 0.16, 0.72, 0.95, 20, 0.1);
  }
  p.collide(-0.25, -0.2, 0.25, 0.2);
}

export function wardrobe(ctx, M, x0, z0, x1, z1, h = 2.45, frontAxis = 'x') {
  const p = new Piece(ctx, 0, 0);
  p.box(M.lacquer, x0, z0, x1, z1, 0, h);
  // door joints
  const n = Math.max(2, Math.round((frontAxis === 'x' ? z1 - z0 : x1 - x0) / 0.5));
  for (let i = 1; i < n; i++) {
    if (frontAxis === 'x') {
      const z = z0 + ((z1 - z0) * i) / n;
      p.box(M.fabricGrey, x0 - 0.004, z - 0.003, x1 + 0.004, z + 0.003, 0.02, h - 0.02);
    } else {
      const x = x0 + ((x1 - x0) * i) / n;
      p.box(M.fabricGrey, x - 0.003, z0 - 0.004, x + 0.003, z1 + 0.004, 0.02, h - 0.02);
    }
  }
  p.collide(x0, z0, x1, z1);
}

export function chair(ctx, M, cx, cz, dir, mat = M.wood, seat = M.fabricBeige) {
  const p = new Piece(ctx, cx, cz, R[dir]);
  for (const [lx, lz] of [
    [-0.19, -0.19],
    [0.19, -0.19],
    [-0.19, 0.19],
    [0.19, 0.19],
  ])
    p.box(mat, lx - 0.02, lz - 0.02, lx + 0.02, lz + 0.02, 0, 0.44);
  p.box(seat, -0.22, -0.22, 0.22, 0.22, 0.43, 0.48);
  p.box(mat, -0.22, -0.24, 0.22, -0.2, 0.48, 0.85);
}

export function diningTable(ctx, M, cx, cz, alongZ, len, wid) {
  const p = new Piece(ctx, cx, cz, alongZ ? Math.PI / 2 : 0);
  const hl = len / 2, hw = wid / 2;
  p.box(M.wood, -hl, -hw, hl, hw, 0.72, 0.76);
  for (const [lx, lz] of [
    [-hl + 0.1, -hw + 0.1],
    [hl - 0.1, -hw + 0.1],
    [-hl + 0.1, hw - 0.1],
    [hl - 0.1, hw - 0.1],
  ])
    p.box(M.woodDark, lx - 0.03, lz - 0.03, lx + 0.03, lz + 0.03, 0, 0.72);
  p.collide(-hl, -hw, hl, hw);
}

export function roundTable(ctx, M, cx, cz, r, mat = M.wood, h = 0.74) {
  const p = new Piece(ctx, cx, cz);
  p.cyl(mat, 0, 0, r, h - 0.03, h, 28);
  p.cyl(mat, 0, 0, 0.04, 0.02, h - 0.03, 10);
  p.cyl(mat, 0, 0, 0.22, 0, 0.03, 20);
  p.collide(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
}

export function sofa(ctx, M, cx, cz, dir, len = 2.4, mat = M.sofa) {
  const p = new Piece(ctx, cx, cz, R[dir]);
  const hl = len / 2;
  p.box(M.woodDark, -hl + 0.05, -0.4, hl - 0.05, 0.4, 0, 0.1);
  p.box(mat, -hl, -0.45, hl, 0.45, 0.1, 0.42);
  p.box(mat, -hl, -0.45, hl, -0.22, 0.42, 0.82);
  p.box(mat, -hl, -0.45, -hl + 0.18, 0.45, 0.42, 0.62);
  p.box(mat, hl - 0.18, -0.45, hl, 0.45, 0.42, 0.62);
  const n = Math.round((len - 0.36) / 0.7);
  const cw = (len - 0.36) / n;
  for (let i = 0; i < n; i++) {
    const x = -hl + 0.18 + i * cw;
    p.box(mat, x + 0.01, -0.22, x + cw - 0.01, 0.43, 0.42, 0.52);
    p.box(M.fabricBeige, x + 0.15, -0.26, x + cw - 0.15, -0.14, 0.5, 0.85);
  }
  p.collide(-hl, -0.45, hl, 0.45);
}

export function rug(ctx, M, x0, z0, x1, z1) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
  ctx.batch.add(M.rug, g);
}

export function plant(ctx, M, cx, cz, h = 1.2) {
  const p = new Piece(ctx, cx, cz);
  p.cyl(M.pot, 0, 0, 0.18, 0, 0.4, 16, 0.22);
  p.cyl(M.trunk, 0, 0, 0.02, 0.4, h * 0.7, 6);
  p.sphere(M.plant, 0, h * 0.75, 0, 0.35, 1, 1.3, 1);
  p.sphere(M.plant, 0.15, h * 0.6, 0.1, 0.25);
  p.collide(-0.22, -0.22, 0.22, 0.22);
}

export function wc(ctx, M, cx, cz, dir) {
  const p = new Piece(ctx, cx, cz, R[dir]);
  p.box(M.porcelain, -0.18, -0.3, 0.18, -0.12, 0.35, 0.8);
  p.box(M.steel, -0.05, -0.28, 0.05, -0.2, 0.8, 0.81);
  p.box(M.porcelain, -0.17, -0.15, 0.17, 0.28, 0.0, 0.4);
  p.box(M.porcelain, -0.18, -0.16, 0.18, 0.3, 0.4, 0.43);
  p.collide(-0.18, -0.3, 0.18, 0.3);
}

export function vanity(ctx, M, x0, z0, x1, z1, mirrorX) {
  const p = new Piece(ctx, 0, 0);
  p.box(M.wood, x0, z0, x1, z1, 0.5, 0.82);
  p.box(M.counter, x0, z0, x1, z1, 0.82, 0.86);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  p.box(M.porcelain, cx - 0.17, cz - 0.22, cx + 0.17, cz + 0.22, 0.86, 0.88);
  p.cyl(M.steel, mirrorX - 0.08 * Math.sign(mirrorX - cx), cz, 0.015, 0.86, 1.08, 8);
  p.box(M.mirror, mirrorX - 0.02 * Math.sign(mirrorX - cx) - 0.005, z0 + 0.02, mirrorX - 0.02 * Math.sign(mirrorX - cx) + 0.005, z1 - 0.02, 1.05, 1.9);
  p.collide(x0, z0, x1, z1);
}

export function bathtub(ctx, M, x0, z0, x1, z1) {
  const p = new Piece(ctx, 0, 0);
  p.box(M.porcelain, x0, z0, x1, z0 + 0.06, 0, 0.56);
  p.box(M.porcelain, x0, z1 - 0.06, x1, z1, 0, 0.56);
  p.box(M.porcelain, x0, z0, x0 + 0.06, z1, 0, 0.56);
  p.box(M.porcelain, x1 - 0.06, z0, x1, z1, 0, 0.56);
  p.box(M.porcelain, x0, z0, x1, z1, 0, 0.12);
  p.cyl(M.steel, x1 - 0.12, (z0 + z1) / 2, 0.02, 0.56, 0.75, 8);
  p.collide(x0, z0, x1, z1);
}

export function shower(ctx, M, x0, z0, x1, z1, glassZ, glassX1) {
  const p = new Piece(ctx, 0, 0);
  p.box(M.porcelain, x0, z0, x1, z1, 0, 0.035);
  p.box(M.steel, x1 - 0.06, (z0 + z1) / 2 - 0.04, x1 - 0.02, (z0 + z1) / 2 + 0.04, 0.9, 2.05);
  p.cyl(M.steel, x1 - 0.2, (z0 + z1) / 2, 0.13, 2.02, 2.04, 20);
  ctx.batch.add(M.glass, boxFromRect(x0, glassZ - 0.005, glassX1, glassZ + 0.005, 0.04, 2.0));
  p.box(M.steel, x0, glassZ - 0.012, glassX1, glassZ + 0.012, 1.98, 2.0);
}

export function kitchen(ctx, M) {
  const p = new Piece(ctx, 0, 0);
  const z0 = 13.2, z1 = 13.83, xa = 3.65, xb = 6.4, xc = 7.6;
  p.box(M.black, xa + 0.05, z0 + 0.06, xb, z1, 0, 0.1);
  p.box(M.kitchen, xa, z0, xb, z1, 0.1, 0.88);
  for (let x = xa + 0.6; x < xb - 0.1; x += 0.6) p.box(M.fabricGrey, x - 0.003, z0 - 0.003, x + 0.003, z0 + 0.01, 0.12, 0.86);
  p.box(M.fabricGrey, xa, z0 - 0.003, xb, z0 + 0.01, 0.48, 0.485);
  p.box(M.counter, xa - 0.02, z0 - 0.03, xb, z1, 0.88, 0.92);
  // sink and tap
  p.box(M.steel, 3.85, 13.3, 4.55, 13.7, 0.9, 0.925);
  p.cyl(M.steel, 4.2, 13.74, 0.018, 0.92, 1.22, 8);
  p.box(M.steel, 4.18, 13.58, 4.22, 13.76, 1.19, 1.22);
  // induction hob
  p.box(M.black, 5.25, 13.3, 6.05, 13.78, 0.92, 0.927);
  // porcelain backsplash
  p.box(M.counter, xa, 13.8, xb, z1, 0.92, 1.55);
  // wall units + integrated hood
  p.box(M.kitchen, xa, 13.46, xb, z1, 1.55, 2.3);
  p.box(M.steel, 5.2, 13.46, 6.1, 13.83, 1.5, 1.56);
  for (let x = xa + 0.6; x < xb - 0.1; x += 0.6) p.box(M.fabricGrey, x - 0.003, 13.457, x + 0.003, 13.47, 1.56, 2.29);
  // tall units: fridge + oven
  p.box(M.kitchen, xb, z0, xc, z1, 0, 2.3);
  p.box(M.fabricGrey, xb + 0.6 - 0.003, z0 - 0.004, xb + 0.6 + 0.003, z0 + 0.01, 0.02, 2.28);
  p.box(M.black, xb + 0.65, z0 - 0.006, xc - 0.05, z0 + 0.01, 0.85, 1.45);
  p.box(M.black, xb + 0.65, z0 - 0.006, xc - 0.05, z0 + 0.01, 1.5, 1.88);
  p.box(M.steel, xb + 0.7, z0 - 0.03, xc - 0.1, z0 - 0.006, 1.4, 1.42);
  p.collide(xa - 0.02, z0 - 0.03, xc, z1);
}

export function washer(ctx, M, x0, z0, x1, z1) {
  const p = new Piece(ctx, 0, 0);
  p.box(M.porcelain, x0, z0, x1, z1, 0, 0.85);
  const cx = (x0 + x1) / 2;
  const g = new THREE.CylinderGeometry(0.18, 0.18, 0.02, 24);
  g.rotateX(Math.PI / 2);
  g.translate(cx, 0.48, z0 - 0.005);
  ctx.batch.add(M.black, g);
  p.box(M.counter, x0 - 0.9, z0 + 0.05, x1, z1, 1.6, 1.63);
  p.collide(x0, z0, x1, z1);
}

export function tvUnit(ctx, M, x0, z0, x1, z1) {
  const p = new Piece(ctx, 0, 0);
  p.box(M.woodDark, x0, z0, x1, z1, 0.18, 0.55);
  p.box(M.black, x0 + 0.1, z0 + 0.05, x1 - 0.1, z1 - 0.05, 0, 0.18);
  const cx = (x0 + x1) / 2;
  p.box(M.screen, cx - 0.72, z0 + 0.03, cx + 0.72, z0 + 0.07, 0.85, 1.67);
  p.collide(x0, z0, x1, z1);
}

export function coffeeTable(ctx, M, x0, z0, x1, z1) {
  const p = new Piece(ctx, 0, 0);
  p.box(M.wood, x0, z0, x1, z1, 0.3, 0.38);
  p.box(M.woodDark, x0 + 0.08, z0 + 0.08, x1 - 0.08, z1 - 0.08, 0, 0.3);
  p.sphere(M.pot, (x0 + x1) / 2 + 0.2, 0.45, (z0 + z1) / 2, 0.08, 1, 0.9, 1);
  p.collide(x0, z0, x1, z1);
}

export function desk(ctx, M, x0, z0, x1, z1) {
  const p = new Piece(ctx, 0, 0);
  p.box(M.lacquer, x0, z0, x1, z1, 0.72, 0.75);
  p.box(M.lacquer, x0, z0, x0 + 0.04, z1, 0, 0.72);
  p.box(M.lacquer, x1 - 0.04, z0, x1, z1, 0, 0.72);
  p.box(M.screen, (x0 + x1) / 2 - 0.3, z0 + 0.05, (x0 + x1) / 2 + 0.3, z0 + 0.08, 0.85, 1.2);
  p.box(M.steel, (x0 + x1) / 2 - 0.04, z0 + 0.06, (x0 + x1) / 2 + 0.04, z0 + 0.16, 0.75, 0.86);
  p.collide(x0, z0, x1, z1);
}

export function pendant(ctx, M, x, z, top, drop = 0.9, r = 0.25) {
  const p = new Piece(ctx, x, z);
  p.cyl(M.black, 0, 0, 0.004, top - drop, top, 4);
  p.cyl(M.lampWarm, 0, 0, r, top - drop - 0.18, top - drop, 24, 0.05);
}

export function downlight(ctx, M, x, z, y) {
  const g = new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16);
  g.translate(x, y - 0.004, z);
  ctx.batch.add(M.lampWarm, g);
}

export function lounger(ctx, M, cx, cz, dir) {
  const p = new Piece(ctx, cx, cz, R[dir]);
  p.box(M.wood, -0.3, -0.3, 0.3, 0.35, 0.3, 0.36);
  p.box(M.wood, -0.3, -0.35, 0.3, -0.3, 0.36, 0.75);
  p.box(M.fabricBeige, -0.27, -0.27, 0.27, 0.3, 0.36, 0.44);
  for (const lx of [-0.27, 0.27]) p.box(M.woodDark, lx - 0.02, -0.3, lx + 0.02, 0.35, 0, 0.3);
  p.collide(-0.3, -0.35, 0.3, 0.35);
}

export function clothesRack(ctx, M, x0, z0, x1, z1) {
  const p = new Piece(ctx, 0, 0);
  for (const z of [z0, z1]) p.box(M.steel, x0, z - 0.01, x0 + 0.02, z + 0.01, 0, 1.0), p.box(M.steel, x1 - 0.02, z - 0.01, x1, z + 0.01, 0, 1.0);
  for (let i = 0; i < 5; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / 5;
    p.box(M.steel, x - 0.005, z0, x + 0.005, z1, 0.99, 1.0);
  }
  p.box(M.fabricBlue, x0 + 0.2, z0 + 0.3, x0 + 0.24, z0 + 0.8, 0.6, 1.0);
  p.box(M.fabricWhite, x0 + 0.5, z0 + 0.5, x0 + 0.54, z0 + 1.2, 0.5, 1.0);
  p.collide(x0, z0, x1, z1);
}
