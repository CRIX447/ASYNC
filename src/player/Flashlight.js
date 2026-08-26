import * as THREE from 'three';

const MAX_CHARGE = 100;
const DRAIN_PER_SEC = 1.6;

/**
 * A spotlight parented to the camera, so it always points where you look.
 * This is the only shadow-casting light in the game — point lights with
 * shadows would tank the framerate for very little visual gain.
 */
export class Flashlight {
  constructor(camera) {
    this.charge = MAX_CHARGE;
    this.on = false;

    this.light = new THREE.SpotLight(0xfff0cc, 0, 26, Math.PI / 7, 0.55, 1.4);
    this.light.position.set(0.18, -0.12, 0);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.camera.near = 0.4;
    this.light.shadow.camera.far = 26;
    this.light.shadow.bias = -0.0022;

    this.light.target.position.set(0.18, -0.12, -1);

    camera.add(this.light);
    camera.add(this.light.target);

    this._flicker = 0;
    this.onChange = () => {};
  }

  toggle() {
    if (!this.on && this.charge <= 0) return false;
    this.on = !this.on;
    this.onChange(this.charge, this.on);
    return true;
  }

  addCharge(amount) {
    if (this.charge >= MAX_CHARGE) return false;
    this.charge = Math.min(MAX_CHARGE, this.charge + amount);
    this.onChange(this.charge, this.on);
    return true;
  }

  update(dt) {
    if (this.on) {
      this.charge = Math.max(0, this.charge - DRAIN_PER_SEC * dt);
      if (this.charge <= 0) {
        this.on = false;
      }
      this.onChange(this.charge, this.on);
    }

    if (!this.on) {
      this.light.intensity += (0 - this.light.intensity) * Math.min(1, dt * 14);
      return;
    }

    // A dying battery should feel like one, not just switch off.
    const health = this.charge / MAX_CHARGE;
    let target = 22 * (0.35 + 0.65 * health);

    if (health < 0.22) {
      this._flicker += dt * (7 + (1 - health) * 26);
      const f = Math.sin(this._flicker) * Math.sin(this._flicker * 2.7);
      target *= 0.55 + 0.45 * (f > -0.2 ? 1 : 0.15);
    }

    this.light.intensity += (target - this.light.intensity) * Math.min(1, dt * 12);
  }

  get percent() {
    return this.charge / MAX_CHARGE;
  }
}
