import * as THREE from 'three';

const RADIUS = 0.22;
const _e = new THREE.Euler();
const _qy = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _z = new THREE.Vector3(0, 0, 1);
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const _q0 = new THREE.Quaternion();

// Camera quaternion from DeviceOrientation (like DeviceOrientationControls)
function gyroQuat(alpha, beta, gamma, orient) {
  const d = THREE.MathUtils.DEG2RAD;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(beta * d, alpha * d, -gamma * d, 'YXZ'));
  q.multiply(_q1);
  q.multiply(_q0.setFromAxisAngle(_z, -orient * d));
  return q;
}

// First-person controls with 2D collisions (plan-view rectangles).
export class WalkControls {
  constructor(camera, dom, colliders, floorY) {
    this.camera = camera;
    this.dom = dom;
    this.colliders = colliders;
    this.floorY = floorY;
    this.eye = 1.62;
    this.enabled = false;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.pos = new THREE.Vector2();
    this.joy = { x: 0, y: 0, active: false };
    this.dragging = false;
    this.bob = 0;
    this.onLockChange = null;
    this.reducedMotion = false;
    this.gyroEnabled = false;
    this.gyroQ = null;
    this.gyroOffset = 0;
    this._onOrient = (e) => {
      if (e.alpha == null) return;
      this.gyroQ = gyroQuat(e.alpha, e.beta, e.gamma, screen.orientation?.angle ?? window.orientation ?? 0);
    };

    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const onScene = e.target === document.body || e.target === dom || e.target === document.documentElement;
      if (!onScene && ['Space', 'Enter'].includes(e.code)) return;
      this.keys.add(e.code);
      if (onScene && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    dom.addEventListener('mousedown', (e) => {
      if (!this.enabled || e.button !== 0) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.downT = performance.now();
    });
    addEventListener('mouseup', (e) => {
      if (!this.enabled) return;
      if (this.dragging && performance.now() - this.downT < 220 && Math.abs(e.clientX - this.lastX) < 4 && document.pointerLockElement !== dom) {
        try {
          const p = dom.requestPointerLock?.({ unadjustedMovement: true });
          p?.catch?.(() => dom.requestPointerLock?.());
        } catch {
          dom.requestPointerLock?.();
        }
      }
      this.dragging = false;
    });
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === dom) {
        // some browsers emit spurious jumps when locking the pointer
        if (Math.abs(e.movementX) > 200 || Math.abs(e.movementY) > 200) return;
        this.look(e.movementX, e.movementY, 0.0022);
      }
      else if (this.dragging) {
        this.look(e.clientX - this.lastX, e.clientY - this.lastY, 0.004);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    document.addEventListener('pointerlockchange', () => this.onLockChange?.(document.pointerLockElement === dom));

    // Touch: left half = joystick, right half = look
    this.touchLook = null;
    dom.addEventListener(
      'touchstart',
      (e) => {
        if (!this.enabled) return;
        for (const t of e.changedTouches) {
          if (t.clientX < innerWidth / 2 && !this.joy.active) {
            this.joy = { active: true, id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 };
            this.showJoy(t.clientX, t.clientY);
          } else if (!this.touchLook) this.touchLook = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
        e.preventDefault();
      },
      { passive: false },
    );
    dom.addEventListener(
      'touchmove',
      (e) => {
        if (!this.enabled) return;
        for (const t of e.changedTouches) {
          if (this.joy.active && t.identifier === this.joy.id) {
            const dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
            const l = Math.min(1, Math.hypot(dx, dy) / 50);
            const a = Math.atan2(dy, dx);
            this.joy.x = Math.cos(a) * l;
            this.joy.y = Math.sin(a) * l;
            this.moveJoyKnob(this.joy.x * 50, this.joy.y * 50);
          } else if (this.touchLook && t.identifier === this.touchLook.id) {
            this.look(t.clientX - this.touchLook.x, t.clientY - this.touchLook.y, 0.005);
            this.touchLook.x = t.clientX;
            this.touchLook.y = t.clientY;
          }
        }
        e.preventDefault();
      },
      { passive: false },
    );
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (this.joy.active && t.identifier === this.joy.id) {
          this.joy = { x: 0, y: 0, active: false };
          this.hideJoy();
        }
        if (this.touchLook && t.identifier === this.touchLook.id) this.touchLook = null;
      }
    };
    dom.addEventListener('touchend', end);
    dom.addEventListener('touchcancel', end);

    this.joyEl = document.createElement('div');
    this.joyEl.className = 'joy';
    this.joyEl.innerHTML = '<div></div>';
    document.body.appendChild(this.joyEl);
  }

  showJoy(x, y) {
    this.joyEl.style.display = 'block';
    this.joyEl.style.left = x - 60 + 'px';
    this.joyEl.style.top = y - 60 + 'px';
    this.moveJoyKnob(0, 0);
  }
  moveJoyKnob(x, y) {
    this.joyEl.firstChild.style.transform = `translate(${x}px, ${y}px)`;
  }
  hideJoy() {
    this.joyEl.style.display = 'none';
  }

  setGyro(on) {
    if (on === this.gyroEnabled) return;
    this.gyroEnabled = on;
    if (on) {
      this.gyroQ = null;
      this._gyroInit = true;
      addEventListener('deviceorientation', this._onOrient);
    } else {
      removeEventListener('deviceorientation', this._onOrient);
      this.gyroQ = null;
      this.pitch = 0;
    }
  }

  look(dx, dy, s) {
    if (this.gyroEnabled && this.gyroQ) {
      this.gyroOffset -= dx * s;
      return;
    }
    this.yaw -= dx * s;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * s, -1.35, 1.35);
  }

  setPose(x, z, yaw, pitch = 0) {
    this.pos.set(x, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.apply();
  }

  // Orientation from a look direction
  lookAtPoint(x, z) {
    this.yaw = Math.atan2(-(x - this.pos.x), -(z - this.pos.y));
  }

  collide() {
    for (let it = 0; it < 3; it++) {
      for (const [x0, z0, x1, z1] of this.colliders) {
        const cx = THREE.MathUtils.clamp(this.pos.x, x0, x1);
        const cz = THREE.MathUtils.clamp(this.pos.y, z0, z1);
        let dx = this.pos.x - cx, dz = this.pos.y - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < RADIUS * RADIUS) {
          if (d2 < 1e-10) {
            // inside the rectangle: push out through the nearest side
            const opts = [
              [this.pos.x - x0, -1, 0],
              [x1 - this.pos.x, 1, 0],
              [this.pos.y - z0, 0, -1],
              [z1 - this.pos.y, 0, 1],
            ].sort((a, b) => a[0] - b[0])[0];
            this.pos.x += opts[1] * (opts[0] + RADIUS);
            this.pos.y += opts[2] * (opts[0] + RADIUS);
          } else {
            const d = Math.sqrt(d2);
            dx /= d;
            dz /= d;
            this.pos.x = cx + dx * RADIUS;
            this.pos.y = cz + dz * RADIUS;
          }
        }
      }
    }
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    let f = 0, s = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyA')) s -= 1;
    if (k.has('KeyD')) s += 1;
    if (k.has('ArrowLeft')) this.yaw += 1.8 * dt;
    if (k.has('ArrowRight')) this.yaw -= 1.8 * dt;
    if (k.has('KeyQ')) this.yaw += 1.8 * dt;
    if (k.has('KeyE')) this.yaw -= 1.8 * dt;
    if (k.has('KeyR')) this.pitch = Math.min(1.35, this.pitch + 1.2 * dt);
    if (k.has('KeyF')) this.pitch = Math.max(-1.35, this.pitch - 1.2 * dt);
    if (this.joy.active) {
      f -= this.joy.y;
      s += this.joy.x;
    }
    const len = Math.hypot(f, s);
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? 2.8 : 1.4;
    if (len > 0.01) {
      const n = Math.min(1, len);
      f /= len;
      s /= len;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const vx = (-sin * f + cos * s) * speed * n;
      const vz = (-cos * f - sin * s) * speed * n;
      const steps = Math.ceil((Math.hypot(vx, vz) * dt) / 0.08) || 1;
      for (let i = 0; i < steps; i++) {
        this.pos.x += (vx * dt) / steps;
        this.pos.y += (vz * dt) / steps;
        this.collide();
      }
      if (!this.reducedMotion) this.bob += dt * speed * 5;
    }
    this.apply();
  }

  apply() {
    const cam = this.camera;
    cam.position.set(this.pos.x, this.floorY + this.eye + Math.sin(this.bob) * 0.015, this.pos.y);
    if (this.gyroEnabled && this.gyroQ) {
      _e.setFromQuaternion(this.gyroQ, 'YXZ');
      if (this._gyroInit) {
        // keep the current heading when enabling the gyroscope
        this.gyroOffset = this.yaw - _e.y;
        this._gyroInit = false;
      }
      _qy.setFromAxisAngle(_up, this.gyroOffset);
      cam.quaternion.copy(_qy).multiply(this.gyroQ);
      _e.setFromQuaternion(cam.quaternion, 'YXZ');
      this.yaw = _e.y;
      this.pitch = _e.x;
    } else cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
