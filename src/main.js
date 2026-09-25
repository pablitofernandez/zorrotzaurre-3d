import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { createMaterials } from './materials.js';
import { buildBlock, levelY, UNIT_FLOORS, DEFAULT_FLOOR, unitHighlight, RD151_WINGS } from './building.js';
import { buildUnit } from './unit.js';
import { createSky } from './context.js';
import { createGeo, GEO_NORTH } from './geo.js';
import { WalkControls } from './walk.js';
import { Minimap } from './minimap.js';
import * as D from './data/flat.js';
import './style.css';

const $ = (s) => document.querySelector(s);
const [FLOOR_MIN, FLOOR_MAX] = UNIT_FLOORS;
const clampFloor = (n) => THREE.MathUtils.clamp(Math.round(n), FLOOR_MIN, FLOOR_MAX);
// Optional ?planta=N in the URL selects the initial floor
const urlFloor = parseInt(new URLSearchParams(location.search).get('planta'), 10);
let floor = clampFloor(Number.isFinite(urlFloor) ? urlFloor : DEFAULT_FLOOR);
let floorY = levelY(floor);
const floorName = (n) => `${n}ª planta`;
// Plan "up" (-Z) points ~16° east of north (georeferenced against the parcel plan and OSM)
const NORTH_OFFSET = THREE.MathUtils.degToRad(GEO_NORTH);
const IS_TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
document.body.classList.toggle('touch', IS_TOUCH);

// ---------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
const MAX_PR = Math.min(devicePixelRatio, IS_TOUCH ? 2 : 1.5);
const MIN_PR = IS_TOUCH ? 0.9 : 0.5;
let pixelRatio = MAX_PR;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
const canvas = renderer.domElement;
canvas.tabIndex = 0;
canvas.setAttribute('role', 'application');
canvas.setAttribute('aria-roledescription', 'visor 3D');
$('#app').appendChild(canvas);

const css = new CSS2DRenderer();
css.setSize(innerWidth, innerHeight);
css.domElement.className = 'css2d';
$('#app').appendChild(css.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#c9d6df', 0.00007);
const baseFov = () => (IS_TOUCH && innerHeight > innerWidth ? 68 : 55);
const camera = new THREE.PerspectiveCamera(baseFov(), innerWidth / innerHeight, 0.05, 30000);
camera.position.set(-130, 120, 140);

const M = createMaterials();

// ---------------- buildings
// The W1 envelope is split per floor so the detailed unit can replace it on the selected floor
const main = buildBlock(M, { name: 'RD-15.1', split: (w) => w.id === 'W1' });
scene.add(main.group);

const unit = buildUnit(M);
scene.add(unit.group);

const highlight = unitHighlight(M, D.UNIT_BOUNDS, 0);
scene.add(highlight);

function makeLabel(html, cls, tag = 'div') {
  const el = document.createElement(tag);
  el.className = cls;
  el.innerHTML = html;
  return new CSS2DObject(el);
}
const homeLabel = makeLabel('', 'home-label', 'button');
homeLabel.element.type = 'button';
scene.add(homeLabel);
homeLabel.element.addEventListener('click', () => setMode('walk'));
const blockLabels = [makeLabel('RD-15.1', 'block-label'), makeLabel('RD-15.2', 'block-label')];
blockLabels[0].position.set(13, levelY(11) + 4, 9);
blockLabels[1].position.set(57, 39, 20);
blockLabels.forEach((l) => {
  l.element.setAttribute('aria-hidden', 'true');
  scene.add(l);
});

// ---------------- real surroundings
const geoApi = createGeo(M, renderer, { lite: IS_TOUCH });
scene.add(geoApi.group);
if (geoApi.rd152) blockLabels[1].position.set(geoApi.rd152[0], 39, geoApi.rd152[1]);

// ---------------- sky and lighting
const sky = createSky();
scene.add(sky);
const envScene = new THREE.Scene();
const envSky = createSky();
envSky.scale.setScalar(100);
envScene.add(envSky);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;

const hemi = new THREE.HemisphereLight('#f3efe8', '#9c8f7c', 0.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3e0', 3);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3();
let shadowCenter = new THREE.Vector3(14, 15, 9);

function configureShadow(center, size) {
  shadowCenter = center.clone();
  const c = sun.shadow.camera;
  c.left = -size;
  c.right = size;
  c.top = size;
  c.bottom = -size;
  c.near = 1;
  c.far = 700;
  c.updateProjectionMatrix();
  placeSun();
}
function placeSun() {
  sun.target.position.copy(shadowCenter);
  sun.position.copy(shadowCenter).addScaledVector(sunDir, 300);
  sun.target.updateMatrixWorld();
}

let hour = 17.5;
let lastDay = 1;
function applyEnv() {
  const k = mode === 'exterior' ? 1 : 0.5;
  scene.environmentIntensity = (0.12 + 0.6 * lastDay) * k;
}
const fmtHour = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
function updateSun(h) {
  hour = h;
  const frac = (h - 6.6) / (21.7 - 6.6);
  const el = THREE.MathUtils.degToRad(62) * Math.sin(Math.PI * frac);
  const az = THREE.MathUtils.degToRad(68 + 224 * frac);
  sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).applyAxisAngle(new THREE.Vector3(0, 1, 0), NORTH_OFFSET);
  const day = THREE.MathUtils.clamp(Math.sin(el) * 4 + 0.15, 0, 1);
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  envSky.material.uniforms.sunPosition.value.copy(sunDir);
  sun.intensity = 3.2 * THREE.MathUtils.clamp(Math.sin(el) * 3, 0, 1);
  sun.color.setHSL(0.09, 0.6, 0.55 + 0.4 * THREE.MathUtils.clamp(Math.sin(el) * 2, 0, 1));
  hemi.intensity = 0.08 + 0.55 * day;
  lastDay = day;
  applyEnv();
  scene.fog.color.setHSL(0.58, 0.25, 0.12 + 0.68 * day);
  for (const l of unit.lights) {
    l.intensity = l.userData.base * (1 - day) * (1 - day);
    l.visible = l.intensity > 0.02; // lights that are off are skipped by the shaders
  }
  M.lampWarm.emissiveIntensity = 2.5 * (1 - day);
  placeSun();
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0, 0.5, 500);
  scene.environment = envRT.texture;
  $('#hour').textContent = fmtHour(h);
  hourInput.setAttribute('aria-valuetext', fmtHour(h));
}

// ---------------- controls
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.target.set(14, 16, 8);
orbit.maxPolarAngle = Math.PI * 0.495;

const walk = new WalkControls(camera, canvas, unit.colliders, floorY);
walk.onLockChange = (locked) => document.body.classList.toggle('locked', locked);
walk.reducedMotion = REDUCED.matches;

const minimap = new Minimap($('#map'), (x, z) => {
  const r = D.roomAt(x, z);
  if (!r || mode !== 'walk') return;
  walk.pos.set(x, z);
  walk.collide();
  walk.apply();
  announce(`${r.name}`);
});

// ---------------- screen reader announcements
const status = $('#sr-status');
function announce(msg) {
  status.textContent = '';
  requestAnimationFrame(() => (status.textContent = msg));
}

// ---------------- orientation and views
const CARD = ['norte', 'nornordeste', 'nordeste', 'estenordeste', 'este', 'estesudeste', 'sudeste', 'sursudeste', 'sur', 'sursudoeste', 'sudoeste', 'oestesudoeste', 'oeste', 'oestenoroeste', 'noroeste', 'nornoroeste'];
const CARD_S = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
const cardIdx = (b) => Math.round((((b % 360) + 360) % 360) / 22.5) % 16;
// true bearing of a plan direction (dx, dz)
const bearingOf = (dx, dz) => (((THREE.MathUtils.radToDeg(Math.atan2(dx, -dz)) + GEO_NORTH) % 360) + 360) % 360;
const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);
const camForward = new THREE.Vector3();
function cameraBearing() {
  camera.getWorldDirection(camForward);
  return bearingOf(camForward.x, camForward.z);
}

// Does any flat wall block the (plan-view) line of sight to a point?
const OCCLUDERS = [...D.WALLS.map((w) => w.slice(0, 4)), ...(D.LANDING.walls || []), ...RD151_WINGS.filter((w) => w.id !== 'W1' && !w.patio).map((w) => w.r)];
function segHitsRect(x0, z0, x1, z1, [rx0, rz0, rx1, rz1]) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dz = z1 - z0;
  for (const [p, q] of [
    [-dx, x0 - rx0],
    [dx, rx1 - x0],
    [-dz, z0 - rz0],
    [dz, rz1 - z0],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
}
function occludedFromFlat(px, pz, tx, tz) {
  // only the nearby stretch matters (the flat and the rest of the block)
  const d = Math.hypot(tx - px, tz - pz);
  const k = Math.min(1, 60 / d);
  const ex = px + (tx - px) * k, ez = pz + (tz - pz) * k;
  for (const r of OCCLUDERS) if (segHitsRect(px, pz, ex, ez, r)) return true;
  return false;
}

function visibleLabels(fov = 35) {
  const b = cameraBearing();
  const out = [];
  for (const o of geoApi.labels) {
    const dx = o.position.x - camera.position.x, dz = o.position.z - camera.position.z;
    const lb = bearingOf(dx, dz);
    let diff = ((lb - b + 540) % 360) - 180;
    if (Math.abs(diff) > fov) continue;
    if (mode === 'walk' && occludedFromFlat(walk.pos.x, walk.pos.y, o.position.x, o.position.z)) continue;
    out.push({ name: o.userData.name, dist: Math.hypot(dx, dz), diff });
  }
  return out.sort((a, b) => a.diff - b.diff);
}

function describeView() {
  const b = cameraBearing();
  const where = mode === 'walk' ? D.roomAt(walk.pos.x, walk.pos.y)?.name || 'la vivienda' : 'el exterior';
  const vis = visibleLabels();
  const side = (d) => (Math.abs(d) < 8 ? 'al frente' : d < 0 ? 'a la izquierda' : 'a la derecha');
  const list = vis.length ? vis.map((v) => `${v.name}, ${side(v.diff)}, a ${fmtDist(v.dist)}`).join('; ') : mode === 'walk' ? 'una pared o el interior de la vivienda' : 'el entorno';
  announce(`Estás en ${where}, mirando al ${CARD[cardIdx(b)]} (${Math.round(b)} grados). Se ve: ${list}.`);
}

// ---------------- camera animation
let fly = null;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function flyTo(pos, target, dur = 1.8, done) {
  if (REDUCED.matches) dur = 0.001;
  const lookNow = new THREE.Vector3();
  camera.getWorldDirection(lookNow);
  const fromTarget = mode === 'walk' || !orbit.enabled ? camera.position.clone().add(lookNow.multiplyScalar(5)) : orbit.target.clone();
  fly = { t: 0, dur, fromPos: camera.position.clone(), toPos: pos.clone(), fromTarget, toTarget: target.clone(), done };
}
function updateFly(dt) {
  if (!fly) return;
  fly.t = Math.min(1, fly.t + dt / fly.dur);
  const k = ease(fly.t);
  camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
  const tgt = new THREE.Vector3().lerpVectors(fly.fromTarget, fly.toTarget, k);
  camera.up.set(0, 1, 0);
  camera.lookAt(tgt);
  orbit.target.copy(tgt);
  if (fly.t >= 1) {
    const d = fly.done;
    fly = null;
    d?.();
  }
}

// ---------------- modes
let mode = 'exterior';
const unitCenter = new THREE.Vector3(5.6, floorY + 0.8, 7.1);
const MODE_TEXT = {
  exterior: () => 'Vista del edificio y su entorno real. Arrastra para girar, rueda o pellizco para acercar. Pulsa V para describir la vista.',
  dollhouse: () => `Vista de la vivienda (${floorName(floor)}) desde arriba. Elige una estancia para entrar.`,
  walk: () => `Recorriendo la vivienda de la ${floorName(floor)}. Muévete con W A S D o flechas; pulsa V para describir lo que tienes delante.`,
};
const MODE_LABEL = { exterior: () => 'Edificio', dollhouse: () => `Planta ${floor}ª`, walk: () => 'Recorrer' };
const modeButtons = document.querySelectorAll('button[data-mode]');

function setUpperFloorsVisible(v) {
  for (const f of main.floors) f.visible = v || f.userData.floor <= floor;
}

function setMode(m, opts = {}) {
  if (document.pointerLockElement) document.exitPointerLock();
  const prev = mode;
  mode = m;
  document.body.dataset.mode = m;
  modeButtons.forEach((b) => {
    const on = b.dataset.mode === m;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
  canvas.setAttribute('aria-label', `Visor 3D. Modo ${MODE_LABEL[m]()}. ${MODE_TEXT[m]()}`);
  walk.enabled = false;
  orbit.enabled = false;
  applyFov();
  const interior = m !== 'exterior';
  highlight.visible = !interior;
  homeLabel.visible = !interior;
  blockLabels.forEach((l) => (l.visible = !interior));
  unit.labels.forEach((l) => (l.visible = m === 'dollhouse'));
  setUpperFloorsVisible(m !== 'dollhouse');
  unit.ceiling.visible = m !== 'dollhouse';
  renderer.toneMappingExposure = interior ? 0.72 : 0.9;
  applyEnv();
  configureShadow(interior ? unitCenter : new THREE.Vector3(25, 15, 5), interior ? 22 : 90);
  if (!opts.silent) announce(`Modo ${MODE_LABEL[m]()}. ${MODE_TEXT[m]()}`);

  if (m === 'exterior') {
    orbit.minDistance = 12;
    orbit.maxDistance = 4000;
    const portrait = innerHeight > innerWidth;
    const from = portrait ? new THREE.Vector3(-150, 150, 160) : new THREE.Vector3(-105, 105, 115);
    flyTo(from, new THREE.Vector3(14, 16, 8), prev === 'walk' ? 2.4 : 1.8, () => (orbit.enabled = true));
  } else if (m === 'dollhouse') {
    orbit.minDistance = 5;
    orbit.maxDistance = 70;
    const k = innerHeight > innerWidth ? 1.6 : 1;
    flyTo(unitCenter.clone().add(new THREE.Vector3(-10 * k, 13.5 * k, 10 * k)), unitCenter, 1.8, () => (orbit.enabled = true));
  } else if (m === 'walk') {
    const [sx, sz] = opts.at || [9.6, 8.7];
    const look = opts.look || [3.5, 10.4];
    const eye = new THREE.Vector3(sx, floorY + walk.eye, sz);
    const target = new THREE.Vector3(look[0], floorY + 1.4, look[1]);
    const fromOutside = prev === 'exterior';
    const go = () =>
      flyTo(eye, target, fromOutside ? 1.2 : 1.6, () => {
        walk.setPose(sx, sz, 0);
        walk.lookAtPoint(look[0], look[1]);
        walk.pitch = -0.08;
        walk.apply();
        walk.enabled = true;
        minimap.draw(walk.pos.x, walk.pos.y, walk.yaw);
        if (!helpSeen) showHelp(true);
        if (!IS_TOUCH) canvas.focus({ preventScroll: true });
      });
    if (fromOutside) flyTo(new THREE.Vector3(-14, floorY + 3, 11), new THREE.Vector3(3, floorY + 1.4, 9), 2.2, go);
    else go();
  }
}

modeButtons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// Room list for teleporting
const roomsEl = $('#rooms');
const roomButtons = new Map();
for (const r of D.ROOMS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = r.name.replace(' (zona común)', '');
  b.addEventListener('click', () => {
    const [x, z] = r.spawn || r.label;
    if (mode !== 'walk') return setMode('walk', { at: [x, z], look: r.label });
    walk.pos.set(x, z);
    walk.collide();
    walk.lookAtPoint(r.label[0] + 0.001, r.label[1] + 0.001);
    walk.apply();
  });
  roomsEl.appendChild(b);
  roomButtons.set(r, b);
}

// ---------------- floor selection (the "C" flat repeats on every residential floor)
const fmtA = (a) => a.toFixed(2).replace('.', ',');
const floorSelect = $('#floor-select');
for (let n = FLOOR_MIN; n <= FLOOR_MAX; n++) floorSelect.add(new Option(`Planta ${n}ª`, String(n)));
function setFloor(n, { silent = false } = {}) {
  n = clampFloor(n);
  const dy = levelY(n) - floorY;
  floor = n;
  floorY = levelY(n);
  for (const f of main.floors) if (f.userData.split) f.userData.split.visible = f.userData.floor !== n;
  unit.group.position.y = floorY;
  unit.setFloor(n);
  highlight.position.y = floorY;
  homeLabel.position.set(-0.5, floorY + 4.2, 7);
  homeLabel.element.innerHTML = `<b>Vivienda C</b><span>${floorName(n)}</span>`;
  homeLabel.element.setAttribute('aria-label', `Entrar en la vivienda C de la ${floorName(n)} y recorrerla`);
  walk.floorY = floorY;
  unitCenter.y = floorY + 0.8;
  floorSelect.value = String(n);
  $('#brand-floor').textContent = floorName(n);
  try {
    const url = new URL(location.href);
    url.searchParams.set('planta', n);
    history.replaceState(history.state, '', url);
  } catch {
    // e.g. file:// URLs in some browsers
  }
  if (!dy) return;
  if (mode === 'dollhouse') setUpperFloorsVisible(false);
  if (mode !== 'exterior') {
    // keep the same framing, just one floor up or down
    camera.position.y += dy;
    orbit.target.y += dy;
    if (fly) for (const v of [fly.fromPos, fly.toPos, fly.fromTarget, fly.toTarget]) v.y += dy;
    if (mode === 'walk' && !fly) walk.apply();
    configureShadow(unitCenter, 22);
  }
  canvas.setAttribute('aria-label', `Visor 3D. Modo ${MODE_LABEL[mode]()}. ${MODE_TEXT[mode]()}`);
  if (!silent) announce(floorName(n));
}
floorSelect.addEventListener('change', () => setFloor(parseInt(floorSelect.value, 10)));

// ---------------- field of view inside the flat (walk mode), remembered between visits
const fovInput = $('#fov-range');
const FOV_MIN = +fovInput.min, FOV_MAX = +fovInput.max;
const storedFov = parseFloat(localStorage.getItem('walkFov'));
let walkFov = Number.isFinite(storedFov) ? THREE.MathUtils.clamp(storedFov, FOV_MIN, FOV_MAX) : IS_TOUCH ? 75 : 70;
function applyFov() {
  camera.fov = mode === 'walk' ? walkFov : baseFov();
  camera.updateProjectionMatrix();
}
function setWalkFov(v, { silent = true } = {}) {
  walkFov = THREE.MathUtils.clamp(Math.round(v), FOV_MIN, FOV_MAX);
  fovInput.value = walkFov;
  fovInput.setAttribute('aria-valuetext', `${walkFov} grados`);
  $('#fov-val').textContent = `${walkFov}º`;
  try {
    localStorage.setItem('walkFov', walkFov);
  } catch {
    // storage may be unavailable (private mode)
  }
  applyFov();
  if (!silent) announce(`Campo de visión ${walkFov} grados`);
}
fovInput.addEventListener('input', () => setWalkFov(parseFloat(fovInput.value)));
setWalkFov(walkFov);

// Place labels
const labelsBtn = $('#labels-toggle');
labelsBtn.addEventListener('click', () => {
  const on = document.body.classList.toggle('no-labels');
  labelsBtn.setAttribute('aria-pressed', !on);
  announce(on ? 'Nombres de lugares ocultos' : 'Nombres de lugares visibles');
});

// Time of day
const hourInput = $('#hour-range');
hourInput.value = hour;
let sunPending = null;
hourInput.addEventListener('input', () => {
  const v = parseFloat(hourInput.value);
  if (sunPending) cancelAnimationFrame(sunPending);
  sunPending = requestAnimationFrame(() => updateSun(v));
});

// Help (closed with the X, Esc or the ❔ button)
const help = $('#help');
const helpBtn = $('#help-btn');
let helpSeen = false;
function showHelp(auto = false) {
  helpSeen = true;
  help.hidden = false;
  helpBtn.setAttribute('aria-expanded', 'true');
  clearTimeout(showHelp.t);
  if (auto) showHelp.t = setTimeout(() => hideHelp(false), 12000);
  else $('#help-close').focus({ preventScroll: true });
}
function hideHelp(returnFocus = true) {
  clearTimeout(showHelp.t);
  if (help.hidden) return;
  const hadFocus = help.contains(document.activeElement);
  help.hidden = true;
  helpBtn.setAttribute('aria-expanded', 'false');
  if (returnFocus && hadFocus) helpBtn.focus({ preventScroll: true });
}
helpBtn.addEventListener('click', () => (help.hidden ? showHelp() : hideHelp()));
$('#help-close').addEventListener('click', () => hideHelp());

// Look around by moving the phone (gyroscope)
const gyroBtn = $('#gyro-btn');
if (IS_TOUCH && 'DeviceOrientationEvent' in window) {
  gyroBtn.hidden = false;
  gyroBtn.addEventListener('click', async () => {
    const on = !walk.gyroEnabled;
    if (on && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return announce('Permiso de orientación denegado');
      } catch {
        return;
      }
    }
    walk.setGyro(on);
    gyroBtn.setAttribute('aria-pressed', on);
    announce(on ? 'Mirar moviendo el móvil activado' : 'Mirar moviendo el móvil desactivado');
  });
}

// ---------------- mouse / touch picking
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downPos = null;
canvas.addEventListener('pointerdown', (e) => (downPos = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!downPos || Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 8) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (mode === 'exterior') {
    if (ray.intersectObject(highlight.userData.box).length) setMode('walk');
  } else if (mode === 'dollhouse') {
    const hits = ray.intersectObject(unit.group, true);
    for (const h of hits) {
      if (h.point.y > floorY + 0.3) continue;
      const r = D.roomAt(h.point.x, h.point.z);
      if (r) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        setMode('walk', { at: [h.point.x, h.point.z], look: [h.point.x + dir.x, h.point.z + dir.z] });
      }
      break;
    }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'exterior' || e.pointerType !== 'mouse') return (canvas.style.cursor = '');
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  canvas.style.cursor = ray.intersectObject(highlight.userData.box).length ? 'pointer' : '';
});

addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
  if (e.code === 'Escape') {
    if (!help.hidden) return hideHelp();
  }
  if (e.code === 'PageUp' || e.code === 'PageDown') {
    e.preventDefault();
    return setFloor(floor + (e.code === 'PageUp' ? 1 : -1));
  }
  if (mode === 'walk' && ['-', '+', '='].includes(e.key)) {
    return setWalkFov(walkFov + (e.key === '-' ? -5 : 5), { silent: false });
  }
  if (e.code === 'Digit1') setMode('exterior');
  if (e.code === 'Digit2') setMode('dollhouse');
  if (e.code === 'Digit3') setMode('walk');
  if (e.code === 'KeyH') help.hidden ? showHelp() : hideHelp();
  if (e.code === 'KeyV') describeView();
  if (e.code === 'KeyL') labelsBtn.click();
});

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  applyFov();
  renderer.setSize(innerWidth, innerHeight);
  css.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 250));

// ---------------- label visibility
let labelTick = 0;
const labelRay = new THREE.Raycaster();
const labelDir = new THREE.Vector3();
const lastLabelPos = new THREE.Vector3(1e9, 0, 0);
const labelHidden = new Map();
// do neighbouring buildings block the line of sight to the label?
function blockedByCity(o) {
  if (lastLabelPos.distanceToSquared(camera.position) > 0.09 || !labelHidden.has(o)) {
    labelDir.subVectors(o.position, camera.position);
    const d = labelDir.length();
    labelRay.set(camera.position, labelDir.divideScalar(d));
    labelRay.far = d;
    labelHidden.set(o, labelRay.intersectObjects(geoApi.occluders, false).length > 0);
  }
  return labelHidden.get(o);
}
function updateLabels() {
  if (++labelTick % 8) return;
  const moved = lastLabelPos.distanceToSquared(camera.position) > 0.09;
  for (const o of geoApi.labels) {
    let v = mode !== 'dollhouse';
    if (v && mode === 'walk') v = !occludedFromFlat(walk.pos.x, walk.pos.y, o.position.x, o.position.z) && !blockedByCity(o);
    else if (v && !o.userData.major) v = camera.position.distanceTo(o.position) < 5000;
    o.visible = v;
  }
  if (moved) lastLabelPos.copy(camera.position);
}

// ---------------- compass
const rose = $('#compass .rose');
const headingEl = $('#heading');
let lastHeading = -1;
function updateCompass() {
  const b = Math.round(cameraBearing());
  if (b === lastHeading) return;
  lastHeading = b;
  rose.style.transform = `rotate(${-b}deg)`;
  headingEl.textContent = `${b}º ${CARD_S[cardIdx(b)]}`;
}

// ---------------- loop
const clock = new THREE.Clock();
let lastRoom = null;
// adaptive resolution to keep things smooth (integrated GPUs and mobiles)
let perfAcc = 0, perfN = 0;
function adaptQuality(dt) {
  perfAcc += dt;
  perfN++;
  if (perfAcc < 1.0) return;
  const avg = perfAcc / perfN;
  perfAcc = perfN = 0;
  let pr = pixelRatio;
  if (avg > 1 / 28) pr = Math.max(MIN_PR, pixelRatio * 0.8);
  else if (avg < 1 / 55) pr = Math.min(MAX_PR, pixelRatio * 1.1);
  if (Math.abs(pr - pixelRatio) > 0.01) {
    pixelRatio = pr;
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight);
  }
}
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  adaptQuality(clock.elapsedTime > 2 ? dt : 0);
  updateFly(dt);
  if (!fly) {
    if (mode === 'walk') walk.update(dt);
    else if (orbit.enabled) orbit.update();
  }
  const t = clock.elapsedTime;
  highlight.userData.box.material.opacity = REDUCED.matches ? 0.25 : 0.18 + 0.12 * Math.sin(t * 3);

  if (mode === 'walk' && !fly) {
    minimap.draw(walk.pos.x, walk.pos.y, walk.yaw);
    updateCompass();
    const r = D.roomAt(walk.pos.x, walk.pos.y);
    if (r !== lastRoom) {
      if (lastRoom) roomButtons.get(lastRoom)?.removeAttribute('aria-current');
      lastRoom = r;
      if (r) roomButtons.get(r)?.setAttribute('aria-current', 'true');
      const area = r?.area ? ` ${fmtA(r.area)} m²` : '';
      $('#room').innerHTML = r ? `${r.name}${area ? ` <span>${area}</span>` : ''}` : '';
      $('#room').classList.toggle('visible', !!r);
      if (r) announce(`${r.name}${area}`);
    }
  }
  updateLabels();
  renderer.render(scene, camera);
  css.render(scene, camera);
  requestAnimationFrame(frame);
}

updateSun(hour);
configureShadow(new THREE.Vector3(25, 15, 5), 90);
setFloor(floor, { silent: true });
setMode('exterior', { silent: true });
requestAnimationFrame(frame);
const hideLoading = () => {
  $('#loading').classList.add('hidden');
  $('#loading').setAttribute('aria-hidden', 'true');
};
geoApi.ready.then(hideLoading, (e) => {
  console.error(e);
  hideLoading();
});
setTimeout(hideLoading, 12000);

// Debug / test access
window.__app = { renderer, scene, camera, setMode, setFloor, walk, updateSun, unit, main, geo: geoApi, describeView, cameraBearing };
