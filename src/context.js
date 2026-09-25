import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Batch, boxFromRect, hPlane } from './geometry.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function buildContext(M) {
  const g = new THREE.Group();
  g.name = 'context';
  const b = new Batch();
  const rand = rng(7);

  // Base ground
  const ground = new THREE.Mesh(hPlane(-2500, -35, 2500, 2500, -0.05, 6, 6), M.grass);
  ground.receiveShadow = true;
  g.add(ground);

  // Plot / site development
  b.add(M.paving, hPlane(-40, -34, 110, 40, 0.0, 4, 4));
  // Green areas between blocks
  b.add(M.grass, hPlane(29.5, -22, 34.5, 36, 0.02, 4, 4));
  b.add(M.grass, hPlane(-14, -22, -5, 36, 0.02, 4, 4));
  // Galleteras street + tram
  b.add(M.asphalt, hPlane(-2500, 41, 2500, 51, 0.01, 6, 6));
  b.add(M.paving, hPlane(-2500, 51, 2500, 54, 0.03, 4, 4));
  b.add(M.grass, hPlane(-2500, 54, 2500, 61, 0.02, 4, 4));
  for (const z of [55.8, 57.23, 58.3, 59.73]) b.add(M.rail, boxFromRect(-2500, z, 2500, z + 0.07, 0.02, 0.14));
  // Road markings
  for (let x = -300; x < 300; x += 6) b.add(M.slab, hPlane(x, 45.9, x + 3, 46.05, 0.02));

  // Estuary: water surface and quays
  const water = new THREE.Mesh(hPlane(-2500, -125, 2500, -36, -2.2, 1, 1), M.water);
  water.receiveShadow = true;
  g.add(water);
  b.add(M.quay, boxFromRect(-2500, -37, 2500, -34, -3, 0.0));
  b.add(M.quay, boxFromRect(-2500, -126, 2500, -123, -3, 0.5));
  // Riverside promenade
  b.add(M.paving, hPlane(-2500, -34, 2500, -24, 0.005, 4, 4));
  b.add(M.darkMetal, boxFromRect(-2500, -34.2, 2500, -34.1, 0, 1.0));
  // Footbridge over the estuary
  b.add(M.slab, boxFromRect(-120, -125, -116, -34, 3.5, 4.0));
  for (let z = -120; z < -36; z += 14) b.add(M.slab, boxFromRect(-119, z, -117, z + 1, -3, 3.5));

  // Opposite bank (Deusto / San Ignacio)
  b.add(M.paving, hPlane(-2500, -2500, 2500, -126, 0.5, 5, 5));
  for (let i = 0; i < 170; i++) {
    const x = -700 + rand() * 1400;
    const z = -145 - rand() * 520;
    const w = 14 + rand() * 26;
    const d = 12 + rand() * 20;
    const h = 12 + rand() * 30;
    b.add(M.city, boxFromRect(x, z, x + w, z + d, 0.5, h, 12, 20));
  }
  // White towers (as in the renders)
  for (const [x, z, w, h] of [
    [-40, -175, 22, 78],
    [-5, -190, 18, 62],
    [30, -165, 20, 95],
    [150, -210, 26, 70],
  ])
    b.add(M.cityWhite, boxFromRect(x, z, x + w, z + w * 0.8, 0.5, h, 4, 4));

  // Stadium (San Mamés, across the estuary)
  const stadium = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 64, 1, true), M.cityWhite);
  ring.scale.set(120, 42, 90);
  ring.position.y = 21;
  stadium.add(ring);
  const ribs = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 64, 1, true), new THREE.MeshStandardMaterial({ color: '#b8b6b0', wireframe: true }));
  ribs.scale.set(121, 42, 91);
  ribs.position.y = 21;
  stadium.add(ribs);
  const roofS = new THREE.Mesh(new THREE.RingGeometry(0.65, 1, 64), M.cityWhite);
  roofS.rotation.x = -Math.PI / 2;
  roofS.scale.set(120, 90, 1);
  roofS.position.y = 42;
  stadium.add(roofS);
  stadium.position.set(-330, 0, -260);
  stadium.traverse((o) => (o.castShadow = o.receiveShadow = true));
  g.add(stadium);

  // Zorrotzaurre (rest of the island) to the south/east
  for (let i = 0; i < 60; i++) {
    const x = -500 + rand() * 1100;
    const z = 75 + rand() * 350;
    if (Math.abs(x - 20) < 60 && z < 110) continue;
    const w = 18 + rand() * 20;
    const h = 10 + rand() * 25;
    b.add(M.city, boxFromRect(x, z, x + w, z + 14 + rand() * 14, 0, h, 12, 20));
  }

  // Mountains around Bilbao
  const hillGeo = new THREE.IcosahedronGeometry(1, 2);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rand() * 0.1;
    const r = 1300 + rand() * 700;
    const h = new THREE.Mesh(hillGeo, M.hill);
    h.scale.set(260 + rand() * 260, 70 + rand() * 170, 260 + rand() * 200);
    h.position.set(Math.cos(a) * r, -40, Math.sin(a) * r);
    g.add(h);
  }

  b.build(g, { cast: true, receive: true });

  // Trees (instanced)
  const pts = [];
  for (let x = -200; x < 260; x += 9) pts.push([x + rand() * 2, -29 + rand() * 2]);
  for (let x = -200; x < 260; x += 11) pts.push([x + rand() * 2, 38.5 + rand()]);
  for (let z = -18; z < 34; z += 7) pts.push([32 + rand(), z]);
  for (let z = -18; z < 34; z += 7) pts.push([-9 + rand() * 2, z]);
  for (let x = -30; x < 100; x += 12) pts.push([x, -20 + rand() * 2]);
  const n = pts.length;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 3.2, 6), M.trunk, n);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.4, 1), M.leaves, n);
  const m = new THREE.Matrix4();
  pts.forEach(([x, z], i) => {
    const s = 0.8 + rand() * 0.6;
    m.compose(new THREE.Vector3(x, 1.6 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    trunk.setMatrixAt(i, m);
    m.compose(
      new THREE.Vector3(x, 4.6 * s, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(), rand(), rand())),
      new THREE.Vector3(s * (0.9 + rand() * 0.3), s * (1.1 + rand() * 0.3), s),
    );
    crown.setMatrixAt(i, m);
  });
  trunk.castShadow = crown.castShadow = true;
  crown.receiveShadow = true;
  g.add(trunk, crown);

  return g;
}

export function createSky() {
  const sky = new Sky();
  sky.scale.setScalar(20000);
  const u = sky.material.uniforms;
  u.turbidity.value = 4;
  u.rayleigh.value = 1.4;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.85;
  return sky;
}
