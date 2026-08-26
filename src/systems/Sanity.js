import * as THREE from 'three';

const DRAIN_IN_DARK = 3.1;
const RECOVER_IN_LIGHT = 4.4;
const LIGHT_RADIUS = 7.5;

/**
 * Sanity is a single number that quietly rewrites how the level feels:
 * fog closes in, the screen vignettes and grains, and the camera develops a
 * drift. No post-processing pipeline needed — it's all cheap.
 */
export class Sanity {
  constructor(scene, camera, hud) {
    this.scene = scene;
    this.camera = camera;
    this.hud = hud;

    this.value = 100;
    this.baseFogDensity = scene.fog ? scene.fog.density : 0.035;
    this.drift = 0;
    this.inLight = true;
    this.onLowSanity = () => {};
    this._wasLow = false;
  }

  update(dt, playerPos, flashlightOn, lights) {
    this.inLight = flashlightOn || this._nearLitPanel(playerPos, lights);

    if (this.inLight) {
      this.value = Math.min(100, this.value + RECOVER_IN_LIGHT * dt);
    } else {
      this.value = Math.max(0, this.value - DRAIN_IN_DARK * dt);
    }

    const t = 1 - this.value / 100; // 0 = fine, 1 = gone

    // Fog thickens as sanity drops, so corridors visibly shorten.
    if (this.scene.fog) {
      this.scene.fog.density = this.baseFogDensity * (1 + t * 2.6);
    }

    // Slow roll and sway. Subtle at first, seasick at the bottom.
    this.drift += dt * (0.5 + t * 1.6);
    this.camera.rotation.z = Math.sin(this.drift) * t * 0.045;

    this.hud.setSanity(this.value);

    const low = this.value < 25;
    if (low !== this._wasLow) {
      this._wasLow = low;
      this.onLowSanity(low);
    }
  }

  restore(amount) {
    this.value = Math.min(100, this.value + amount);
  }

  _nearLitPanel(pos, lights) {
    for (const l of lights) {
      if (l.light.intensity < 1) continue;
      const dx = l.position.x - pos.x;
      const dz = l.position.z - pos.z;
      if (dx * dx + dz * dz < LIGHT_RADIUS * LIGHT_RADIUS) return true;
    }
    return false;
  }
}
