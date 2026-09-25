import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function noise(g, w, h, amount, alpha = 0.06) {
  for (let i = 0; i < amount; i++) {
    const v = Math.random() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

function tex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// 60x120 porcelain tile (texture covers 1.2 x 1.2 m)
export function porcelainTexture(base = '#d9d0c3', grout = '#bfb4a5') {
  const [c, g] = canvas(512, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2; i++) {
    const shade = i ? 0.02 : -0.015;
    g.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${Math.abs(shade)})`;
    g.fillRect(i * 256, 0, 256, 512);
  }
  // soft veining
  for (let k = 0; k < 40; k++) {
    g.strokeStyle = `rgba(160,150,135,${Math.random() * 0.06})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    const y = Math.random() * 512;
    g.moveTo(0, y);
    g.bezierCurveTo(170, y + (Math.random() - 0.5) * 80, 340, y + (Math.random() - 0.5) * 80, 512, y + (Math.random() - 0.5) * 40);
    g.stroke();
  }
  noise(g, 512, 512, 6000, 0.05);
  g.fillStyle = grout;
  g.fillRect(0, 0, 512, 2);
  g.fillRect(0, 0, 2, 512);
  g.fillRect(255, 0, 2, 512);
  return tex(c);
}

// 30x60 bathroom wall tiling (texture = 1.2 x 1.2 m)
export function bathTileTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#e4ddd2';
  g.fillRect(0, 0, 512, 512);
  noise(g, 512, 512, 4000, 0.04);
  g.fillStyle = '#c9c0b2';
  for (let i = 0; i <= 4; i++) g.fillRect(0, i * 128 - 1, 512, 2);
  for (let r = 0; r < 4; r++) for (let i = 0; i <= 2; i++) g.fillRect(i * 256 + (r % 2) * 128 - 1, r * 128, 2, 128);
  return tex(c);
}

export function woodTexture(base = '#b08a63') {
  const [c, g] = canvas(256, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(70,45,20,${0.05 + Math.random() * 0.1})`;
    g.lineWidth = Math.random() * 2 + 0.5;
    const x = Math.random() * 256;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 10, 170, x - 10, 340, x + 5, 512);
    g.stroke();
  }
  return tex(c);
}

export function fabricTexture(base) {
  const [c, g] = canvas(128, 128);
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  noise(g, 128, 128, 3000, 0.08);
  return tex(c);
}

export function rugTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#d8c7ad';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(150,110,80,0.35)';
  g.lineWidth = 6;
  for (let i = 0; i < 6; i++) g.strokeRect(20 + i * 22, 20 + i * 22, 472 - i * 44, 472 - i * 44);
  noise(g, 512, 512, 12000, 0.1);
  return tex(c, false);
}

// Typical facade per floor: 1 texture = 3.0 m module x floor height
export function facadeTexture(variant = 0) {
  const [c, g] = canvas(256, 256);
  // light ceramic cladding
  g.fillStyle = variant ? '#74767a' : '#86888b';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 1500, 0.05);
  // floor-to-ceiling window
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#6f8595');
  grd.addColorStop(0.5, '#34454f');
  grd.addColorStop(1, '#27323a');
  g.fillStyle = grd;
  g.fillRect(40, 10, 176, 222);
  // reflection
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath();
  g.moveTo(40, 10);
  g.lineTo(120, 10);
  g.lineTo(40, 140);
  g.fill();
  // frame
  g.fillStyle = '#3d3f42';
  g.fillRect(40, 10, 176, 5);
  g.fillRect(40, 227, 176, 5);
  g.fillRect(40, 10, 5, 222);
  g.fillRect(211, 10, 5, 222);
  g.fillRect(126, 10, 4, 222);
  // dark vertical band (pilasters)
  g.fillStyle = '#5c5f63';
  g.fillRect(0, 0, 18, 256);
  g.fillRect(238, 0, 18, 256);
  return tex(c);
}

export function coreTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#d6d1c7';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 2000, 0.05);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 4; i++) g.fillRect(0, i * 64, 256, 1);
  for (let i = 0; i < 4; i++) g.fillRect(i * 64, 0, 1, 256);
  return tex(c);
}

export function groundFloorTexture() {
  const [c, g] = canvas(256, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#6c7f8c');
  grd.addColorStop(1, '#2b353b');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#e8e4dc';
  g.fillRect(0, 0, 10, 256);
  g.fillRect(0, 0, 256, 8);
  g.fillStyle = '#2f3134';
  g.fillRect(128, 0, 3, 256);
  g.fillRect(0, 190, 256, 3);
  return tex(c);
}

export function pavingTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#c9c1b3';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 5000, 0.08);
  g.fillStyle = 'rgba(90,80,70,0.25)';
  for (let i = 0; i < 4; i++) g.fillRect(0, i * 64, 256, 2);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) g.fillRect(i * 128 + (r % 2) * 64, r * 64, 2, 64);
  return tex(c);
}

export function grassTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#6f8f4e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random();
    g.fillStyle = `rgba(${40 + v * 60},${90 + v * 70},${30 + v * 30},0.5)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1, 2);
  }
  return tex(c);
}

export function asphaltTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#55575a';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 9000, 0.15);
  return tex(c);
}

export function outdoorTileTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#b9ada0';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 5000, 0.08);
  g.fillStyle = '#9d9184';
  for (let i = 0; i <= 2; i++) {
    g.fillRect(0, i * 128 - 1, 256, 2);
    g.fillRect(i * 128 - 1, 0, 2, 256);
  }
  return tex(c);
}

export function cityTexture() {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#d8d1c4';
  g.fillRect(0, 0, 128, 256);
  for (let y = 6; y < 256; y += 16) {
    for (let x = 6; x < 128; x += 16) {
      const lit = Math.random();
      g.fillStyle = lit > 0.85 ? '#8a9aa6' : '#5d6b75';
      g.fillRect(x, y, 9, 10);
    }
  }
  return tex(c);
}
