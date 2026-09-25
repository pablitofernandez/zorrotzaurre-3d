import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import geo from './data/geo.json';
import groundNear from './assets/ground_near.jpg';
import groundMid from './assets/ground_mid.jpg';
import groundFar from './assets/ground_far.jpg';
import waterNear from './assets/water_near.png';
import waterMid from './assets/water_mid.png';
import waterFar from './assets/water_far.png';
import heightMid from './assets/height_mid.png';
import heightFar from './assets/height_far.png';

// Real surroundings: terrain (DEM), ground (OpenStreetMap + parcel plan), buildings, bridges, quays and places.
// All in flat-plan coordinates (X right, Z down, metres; -Z points ~16° east of north).

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = url;
  });
}

async function decodeHeights(url, n) {
  const im = await loadImage(url);
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, n, n).data;
  const h = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) h[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 50 - 100;
  return h;
}

function texture(url, loader, aniso, color = true) {
  const t = loader.load(url);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Window texture: 4 bays x 4 floors (14 m x 12.4 m per repeat), white so it can be tinted per vertex
function windowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let fy = 0; fy < 4; fy++) {
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(0, fy * 64 + 58, 256, 6);
    for (let bx = 0; bx < 4; bx++) {
      const r = Math.random();
      g.fillStyle = r > 0.9 ? '#9aa7b0' : r > 0.5 ? '#56626b' : '#46525b';
      g.fillRect(bx * 64 + 16, fy * 64 + 14, 32, 36);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const PALETTE = ['#d9cfc0', '#cdbfa8', '#e6e0d6', '#bfb4a5', '#a89a88', '#d4c4b0', '#c9c3bb', '#b7ada0', '#e2d9c9', '#9d9489'].map((c) => new THREE.Color(c));
const NEW_COLOR = new THREE.Color('#eceae5');

export function createGeo(M, renderer, { lite = false } = {}) {
  const group = new THREE.Group();
  group.name = 'real-context';
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const L = geo.layers;
  const G = geo.grids;

  // ---------------- water
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2 * G.far.half, 2 * G.far.half), M.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = geo.waterY;
  water.receiveShadow = true;
  group.add(water);

  // ---------------- terrain material (3 textures + water masks by distance)
  const u = {
    tNear: { value: texture(groundNear, loader, aniso) },
    tMid: { value: texture(groundMid, loader, aniso) },
    tFar: { value: texture(groundFar, loader, aniso) },
    wNear: { value: texture(waterNear, loader, 1, false) },
    wMid: { value: texture(waterMid, loader, 1, false) },
    wFar: { value: texture(waterFar, loader, 1, false) },
    hNear: { value: L.near.half },
    hMid: { value: L.mid.half },
    hFar: { value: L.far.half },
  };
  const terrainMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
  terrainMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGeoPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGeoPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vGeoPos;
uniform sampler2D tNear, tMid, tFar, wNear, wMid, wFar;
uniform float hNear, hMid, hFar;
vec2 geoUV(vec2 p, float h) { return vec2((p.x + h) / (2.0 * h), 1.0 - (p.y + h) / (2.0 * h)); }
float edgeW(vec2 p, float h) { vec2 a = abs(p) / h; return 1.0 - smoothstep(0.9, 0.98, max(a.x, a.y)); }`,
      )
      .replace(
        '#include <map_fragment>',
        `{
  vec2 p = vGeoPos.xz;
  vec2 uf = geoUV(p, hFar);
  vec3 col = texture2D(tFar, uf).rgb;
  float wat = texture2D(wFar, uf).r;
  float bm = edgeW(p, hMid);
  if (bm > 0.0) { vec2 um = geoUV(p, hMid); col = mix(col, texture2D(tMid, um).rgb, bm); wat = mix(wat, texture2D(wMid, um).r, bm); }
  float bn = edgeW(p, hNear);
  if (bn > 0.0) { vec2 un = geoUV(p, hNear); col = mix(col, texture2D(tNear, un).rgb, bn); wat = mix(wat, texture2D(wNear, un).r, bn); }
  if (wat > 0.5) discard;
  diffuseColor.rgb *= col;
}`,
      );
  };

  const api = { group, labels: [], occluders: [], ready: null, heightAt: () => 0, rd152: geo.rd152 };

  api.ready = (async () => {
    const [hm, hf] = await Promise.all([decodeHeights(heightMid, G.mid.n), decodeHeights(heightFar, G.far.n)]);
    const sample = (h, g, x, z) => {
      const step = (2 * g.half) / (g.n - 1);
      const fx = (x + g.half) / step, fz = (z + g.half) / step;
      if (fx < 0 || fz < 0 || fx >= g.n - 1 || fz >= g.n - 1) return null;
      const i = Math.floor(fx), j = Math.floor(fz), ax = fx - i, az = fz - j;
      const k = j * g.n + i;
      return h[k] * (1 - ax) * (1 - az) + h[k + 1] * ax * (1 - az) + h[k + g.n] * (1 - ax) * az + h[k + g.n + 1] * ax * az;
    };
    api.heightAt = (x, z) => sample(hm, G.mid, x, z) ?? sample(hf, G.far, x, z) ?? 0;

    // terrain meshes: mid (8 m) with skirt + far (64 m) with a central hole
    const mid = gridMesh(hm, G.mid, null, true);
    const far = gridMesh(hf, G.far, G.mid.half);
    for (const g of [mid, far]) {
      const m = new THREE.Mesh(g, terrainMat);
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      group.add(m);
    }

    buildBuildings(group, M, lite, api.occluders);
    buildBridges(group, M, api.heightAt);
    buildWalls(group, M, api.heightAt);
    buildTrees(group, M, api.heightAt);
    for (const [name, x, y, z, major, bearing, dist] of geo.labels) {
      const el = document.createElement('div');
      el.className = 'geo-label' + (major ? '' : ' far');
      el.textContent = name;
      const o = new CSS2DObject(el);
      o.position.set(x, y, z);
      o.userData = { name, major, bearing, dist };
      group.add(o);
      api.labels.push(o);
    }
    for (const [name, x, y, z, floors] of geo.parcels || []) {
      const el = document.createElement('div');
      el.className = 'geo-label parcel';
      el.innerHTML = `${name}<small>${floors <= 7 ? `máx. ${floors} alturas` : 'altura estimada'}</small>`;
      const o = new CSS2DObject(el);
      o.position.set(x, y, z);
      o.userData = { name, major: true, parcel: true };
      group.add(o);
      api.labels.push(o);
    }
  })();
  return api;
}

function gridMesh(h, g, hole, skirt = false) {
  const n = g.n, step = (2 * g.half) / (n - 1);
  const pos = new Float32Array(n * n * 3 + (skirt ? 4 * n * 3 : 0));
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      pos[k * 3] = -g.half + i * step;
      pos[k * 3 + 1] = h[k];
      pos[k * 3 + 2] = -g.half + j * step;
    }
  const idx = [];
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      if (hole) {
        const x0 = -g.half + i * step, z0 = -g.half + j * step;
        if (x0 >= -hole && x0 + step <= hole && z0 >= -hole && z0 + step <= hole) continue;
      }
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  if (skirt) {
    // vertical skirt along the edge to hide seams with the far mesh
    let base = n * n;
    const edges = [
      [...Array(n).keys()].map((i) => i),
      [...Array(n).keys()].map((i) => (n - 1) * n + i),
      [...Array(n).keys()].map((j) => j * n),
      [...Array(n).keys()].map((j) => j * n + n - 1),
    ];
    for (const e of edges) {
      e.forEach((k, t) => {
        pos[(base + t) * 3] = pos[k * 3];
        pos[(base + t) * 3 + 1] = pos[k * 3 + 1] - 40;
        pos[(base + t) * 3 + 2] = pos[k * 3 + 2];
      });
      for (let t = 0; t < n - 1; t++) idx.push(e[t], base + t, e[t + 1], e[t + 1], base + t, base + t + 1, e[t], e[t + 1], base + t, e[t + 1], base + t + 1, base + t);
      base += n;
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
}

function hash(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 16;
  return ((x >>> 0) % 1000) / 1000;
}

function buildBuildings(group, M, lite, occluders) {
  const meta = new Int16Array(b64(geo.meta).buffer);
  const pts = new Int16Array(b64(geo.pts).buffer);
  const sets = { near: newSet(), far: newSet() };
  const ghost = newSet();
  let k = 0;
  for (let b = 0; b < meta.length / 4; b++) {
    const n = meta[b * 4], base = meta[b * 4 + 1] / 10, top = meta[b * 4 + 2] / 10, kind = meta[b * 4 + 3];
    const p = [];
    for (let i = 0; i < n; i++) p.push(new THREE.Vector2(pts[k + i * 2] / 4, pts[k + i * 2 + 1] / 4));
    k += n * 2;
    let cx = 0, cz = 0;
    for (const v of p) (cx += v.x), (cz += v.y);
    cx /= n;
    cz /= n;
    const d = Math.hypot(cx - 13, cz - 9);
    if (lite && d > 5000 && top - base < 25) continue;
    if (kind === 2) {
      addPrism(ghost, p, base, top, GHOST_COLOR, true);
      continue;
    }
    const set = d < 420 ? sets.near : sets.far;
    const col = kind === 1 ? NEW_COLOR : PALETTE[Math.floor(hash(b) * PALETTE.length)];
    addPrism(set, p, base, top, col, kind === 1);
  }
  const wallMat = new THREE.MeshStandardMaterial({ map: windowTexture(), vertexColors: true, roughness: 0.8, metalness: 0.02 });
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  for (const [key, s] of Object.entries(sets)) {
    for (const [arr, mat] of [
      [s.walls, wallMat],
      [s.roofs, roofMat],
    ]) {
      if (!arr.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(arr.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(arr.col, 3));
      if (arr.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(arr.uv, 2));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.castShadow = key === 'near';
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      group.add(m);
      if (key === 'near') occluders.push(m);
    }
  }
  buildGhosts(group, ghost);
}

// Future developments: translucent volume
const GHOST_COLOR = new THREE.Color('#e9f1f8');
function buildGhosts(group, s) {
  if (!s.walls.pos.length) return;
  const g = new THREE.BufferGeometry();
  const pos = [...s.walls.pos, ...s.roofs.pos];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([...s.walls.nor, ...s.roofs.nor], 3));
  g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({
    color: GHOST_COLOR,
    emissive: new THREE.Color('#9fb6cc'),
    emissiveIntensity: 0.25,
    roughness: 0.25,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(g, mat);
  m.name = 'future-parcels';
  m.renderOrder = 2;
  m.matrixAutoUpdate = false;
  group.add(m);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(g, 50),
    new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false }),
  );
  edges.renderOrder = 3;
  edges.matrixAutoUpdate = false;
  group.add(edges);
}

const newSet = () => ({ walls: { pos: [], nor: [], col: [], uv: [] }, roofs: { pos: [], nor: [], col: [], uv: [] } });

function addPrism(set, p, y0, y1, col, isNew) {
  // orient the ring so facade normals face outward
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  if (a > 0) p.reverse();
  const W = set.walls;
  const vScale = isNew ? 12.2 : 12.4;
  let run = 0;
  const shade = 0.92 + 0.08 * Math.random();
  for (let i = 0; i < p.length; i++) {
    const s = p[i], e = p[(i + 1) % p.length];
    const dx = e.x - s.x, dz = e.y - s.y;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const nx = -dz / len, nz = dx / len;
    const u0 = run / 14, u1 = (run + len) / 14;
    run += len;
    const v0 = 0, v1 = (y1 - y0) / vScale;
    const quad = [
      [s.x, y0, s.y, u0, v0],
      [e.x, y0, e.y, u1, v0],
      [e.x, y1, e.y, u1, v1],
      [s.x, y0, s.y, u0, v0],
      [e.x, y1, e.y, u1, v1],
      [s.x, y1, s.y, u0, v1],
    ];
    // subtle shading by orientation to tell facades apart
    const f = shade * (0.9 + 0.1 * Math.abs(nx));
    for (const [x, y, z, uu, vv] of quad) {
      W.pos.push(x, y, z);
      W.nor.push(nx, 0, nz);
      W.col.push(col.r * f, col.g * f, col.b * f);
      W.uv.push(uu, vv);
    }
  }
  const R = set.roofs;
  let tris;
  try {
    tris = THREE.ShapeUtils.triangulateShape(p, []);
  } catch {
    return;
  }
  const rc = isNew ? 0.78 : 0.62;
  for (const [i0, i1, i2] of tris) {
    const A = p[i0], B = p[i1], C = p[i2];
    // upward normal: (B-A) x (C-A) must have y > 0
    const cy = (C.x - A.x) * (B.y - A.y) - (B.x - A.x) * (C.y - A.y);
    const tri = cy > 0 ? [A, B, C] : [A, C, B];
    for (const v of tri) {
      R.pos.push(v.x, y1, v.y);
      R.nor.push(0, 1, 0);
      R.col.push(col.r * rc, col.g * rc, col.b * rc);
    }
  }
}

function buildBridges(group, M, heightAt) {
  const geoms = [];
  const box = new THREE.BoxGeometry(1, 1, 1);
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const inst = [];
  for (const b of geo.bridges) {
    const [w, y] = b;
    for (let i = 2; i + 3 < b.length; i += 2) {
      const x0 = b[i], z0 = b[i + 1], x1 = b[i + 2], z1 = b[i + 3];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.1) continue;
      q.setFromAxisAngle(up, Math.atan2(-(z1 - z0), x1 - x0));
      s.set(len + 0.6, 1.3, w);
      t.set((x0 + x1) / 2, y - 0.65, (z0 + z1) / 2);
      inst.push(tmp.compose(t, q, s).clone());
    }
  }
  const im = new THREE.InstancedMesh(box, M.quay, inst.length);
  inst.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = true;
  im.receiveShadow = true;
  group.add(im);
  for (const b of geo.bridgePolys) {
    const y = b[0];
    const shape = new THREE.Shape();
    for (let i = 1; i < b.length; i += 2) (i === 1 ? shape.moveTo(b[i], -b[i + 1]) : shape.lineTo(b[i], -b[i + 1]));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y - 1.2, 0);
    geoms.push(g);
  }
  for (const g of geoms) {
    const m = new THREE.Mesh(g, M.quay);
    m.receiveShadow = m.castShadow = true;
    group.add(m);
  }
}

function buildWalls(group, M, heightAt) {
  const pos = [], nor = [];
  const y0 = geo.waterY - 2;
  for (const w of geo.walls) {
    for (let i = 0; i + 3 < w.length; i += 2) {
      const x0 = w[i], z0 = w[i + 1], x1 = w[i + 2], z1 = w[i + 3];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.05 || len > 60) continue;
      const h0 = heightAt(x0, z0) + 0.05, h1 = heightAt(x1, z1) + 0.05;
      const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
      pos.push(x0, y0, z0, x1, y0, z1, x1, h1, z1, x0, y0, z0, x1, h1, z1, x0, h0, z0);
      for (let k = 0; k < 6; k++) nor.push(nx, 0, nz);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const mat = M.quay.clone();
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  group.add(m);
}

function buildTrees(group, M, heightAt) {
  const pts = geo.trees;
  const n = pts.length;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 3.2, 6), M.trunk, n);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.4, 1), M.leaves, n);
  const m = new THREE.Matrix4();
  pts.forEach(([x, z], i) => {
    const s = 0.8 + hash(i + 7) * 0.6;
    const y = heightAt(x, z);
    m.compose(new THREE.Vector3(x, y + 1.6 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    trunk.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, y + 4.6 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(i), hash(i + 1), hash(i + 2))), new THREE.Vector3(s, s * 1.15, s));
    crown.setMatrixAt(i, m);
  });
  trunk.castShadow = crown.castShadow = true;
  crown.receiveShadow = true;
  group.add(trunk, crown);
}

export const GEO_LABELS = geo.labels;
export const GEO_NORTH = geo.north;
