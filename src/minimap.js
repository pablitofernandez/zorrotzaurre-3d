import * as D from './data/flat.js';

// 2D floor-plan minimap with the visitor's position and heading
export class Minimap {
  constructor(container, onTeleport) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Plano de la vivienda con tu posición. Pulsa en una zona para ir allí, o usa la lista de estancias.');
    container.appendChild(this.canvas);
    this.s = 19; // px per metre
    this.ox = -0.1;
    this.oz = -0.1;
    const W = 11.2, H = 14.4;
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = W * this.s * dpr;
    this.canvas.height = H * this.s * dpr;
    this.canvas.style.width = W * this.s + 'px';
    this.canvas.style.height = H * this.s + 'px';
    this.g = this.canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    this.drawBase(this.bg.getContext('2d'));
    this.canvas.addEventListener('click', (e) => {
      const r = this.canvas.getBoundingClientRect();
      // CSS may scale the canvas (mobile): convert to logical px
      const kx = (W * this.s) / r.width, kz = (H * this.s) / r.height;
      const x = ((e.clientX - r.left) * kx) / this.s + this.ox;
      const z = ((e.clientY - r.top) * kz) / this.s + this.oz;
      onTeleport?.(x, z);
    });
    this.hover = null;
  }

  tx(x) {
    return (x - this.ox) * this.s * this.dpr;
  }
  tz(z) {
    return (z - this.oz) * this.s * this.dpr;
  }
  rect(g, [x0, z0, x1, z1]) {
    g.fillRect(this.tx(x0), this.tz(z0), (x1 - x0) * this.s * this.dpr, (z1 - z0) * this.s * this.dpr);
  }

  drawBase(g) {
    const k = this.dpr;
    g.fillStyle = 'rgba(255,255,255,0.0)';
    g.clearRect(0, 0, this.bg.width, this.bg.height);
    const colors = { tz: '#d9d2c3', te: '#d9d2c3', rl: '#cfcfcf', b1: '#dfe9ee', b2: '#dfe9ee', la: '#dfe9ee' };
    for (const r of D.ROOMS) {
      g.fillStyle = colors[r.id] || '#f6f1e8';
      for (const rc of r.rects) this.rect(g, rc);
    }
    g.fillStyle = '#34373b';
    for (const w of D.WALLS) this.rect(g, w);
    for (const w of D.LANDING.walls) this.rect(g, w);
    for (const r of D.TERRACE.dividers) this.rect(g, r);
    g.fillStyle = '#6fa7c2';
    for (const w of D.WINDOWS) for (const [z0, z1] of w.segs) this.rect(g, [w.x0 - 0.02, z0, w.x1 + 0.02, z1]);
    this.rect(g, D.TERRACE.railing);
    g.fillStyle = '#7b7e82';
    this.rect(g, D.LOUVERS);
    g.fillStyle = '#9a9ea3';
    this.rect(g, [10.9, 0.03, 11.1, 9.5]);
    g.fillStyle = '#56595d';
    g.font = `${10 * k}px Segoe UI, Arial`;
    g.textAlign = 'center';
    for (const r of D.ROOMS) {
      if (r.id === 'rl') continue;
      g.fillText(r.name.replace('Salón comedor', 'Salón'), this.tx(r.label[0]), this.tz(r.label[1]));
    }
  }

  draw(x, z, yaw) {
    const g = this.g;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.bg, 0, 0);
    const px = this.tx(x), pz = this.tz(z), k = this.dpr;
    // view cone
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const a = Math.atan2(fz, fx);
    const grd = g.createRadialGradient(px, pz, 0, px, pz, 60 * k);
    grd.addColorStop(0, 'rgba(230,57,70,0.45)');
    grd.addColorStop(1, 'rgba(230,57,70,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(px, pz);
    g.arc(px, pz, 60 * k, a - 0.6, a + 0.6);
    g.closePath();
    g.fill();
    g.fillStyle = '#e63946';
    g.strokeStyle = '#fff';
    g.lineWidth = 2 * k;
    g.beginPath();
    g.arc(px, pz, 5 * k, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}
