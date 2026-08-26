import * as THREE from 'three';

/**
 * A spotlight parented to the camera, so it always points where you look.
 * The only shadow-casting light in the game -- shadowed point lights would
 * cost far more than they'd add.
 *
 * No battery any more. Darkness pressure now comes from sanity and from the
 * fact that the light makes you very easy to see.
 */
export class Flashlight {
  constructor(camera) {
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
  }

  toggle() {
    this.on = !this.on;
    return true;
  }

  update(dt) {
    if (!this.on) {
      this.light.intensity += (0 - this.light.intensity) * Math.min(1, dt * 14);
      return;
    }

    // Slight instability so it never looks like a static value.
    this._flicker += dt * 1.7;
    const wobble = 0.97 + Math.sin(this._flicker * 5.3) * 0.03;
    const target = 22 * wobble;

    this.light.intensity += (target - this.light.intensity) * Math.min(1, dt * 12);
  }
}
