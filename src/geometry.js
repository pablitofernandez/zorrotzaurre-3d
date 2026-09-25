import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Box from a plan rectangle and a height range, with metric-scale UVs.
// uvU/uvV: metres covered by one texture repeat (u, v)
export function boxFromRect(x0, z0, x1, z1, y0, y1, uvU = 1, uvV = 1) {
  const w = Math.max(0.001, x1 - x0);
  const h = Math.max(0.001, y1 - y0);
  const d = Math.max(0.001, z1 - z0);
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // faces: +x, -x, +y, -y, +z, -z (4 vertices each)
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / uvU, (uv.getY(k) * dims[f][1]) / uvV);
    }
  }
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

// Horizontal plane (facing up or down) with metric UVs
export function hPlane(x0, z0, x1, z1, y, uvU = 1, uvV = 1, down = false) {
  const w = x1 - x0;
  const d = z1 - z0;
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / uvU, (uv.getY(i) * d) / uvV);
  g.rotateX(down ? Math.PI / 2 : -Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return g;
}

// Vertical plane along X (normal ±Z) or along Z (normal ±X)
export function vPlane(a0, a1, fixed, y0, y1, axis, normalSign, uvU = 1, uvV = 1) {
  const len = a1 - a0;
  const h = y1 - y0;
  const g = new THREE.PlaneGeometry(len, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / uvU, (uv.getY(i) * h) / uvV);
  if (axis === 'x') {
    if (normalSign < 0) g.rotateY(Math.PI);
    g.translate((a0 + a1) / 2, (y0 + y1) / 2, fixed);
  } else {
    g.rotateY(normalSign > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(fixed, (y0 + y1) / 2, (a0 + a1) / 2);
  }
  return g;
}

export function merge(geoms) {
  if (!geoms.length) return null;
  const norm = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(norm, false);
  norm.forEach((g) => g.dispose());
  return m;
}

export function meshFrom(geoms, material, { cast = true, receive = true } = {}) {
  const g = merge(geoms);
  if (!g) return null;
  const m = new THREE.Mesh(g, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Geometry accumulator grouped by material
export class Batch {
  constructor() {
    this.map = new Map();
  }
  add(material, geom) {
    if (!this.map.has(material)) this.map.set(material, []);
    this.map.get(material).push(geom);
  }
  build(group, opts = {}) {
    for (const [mat, geoms] of this.map) {
      const m = meshFrom(geoms, mat, opts);
      if (m) group.add(m);
    }
    this.map.clear();
    return group;
  }
}
