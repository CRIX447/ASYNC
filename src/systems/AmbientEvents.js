import { AMBIENT_EVENT_KEYS } from '../config/manifest.js';

/**
 * Fires an occasional distant noise from somewhere you can't see.
 *
 * This is the cheapest scare in the game. There is no entity, nothing is
 * chasing you, and it still makes people stop walking and listen. The gaps
 * shorten as sanity falls, so the level gets louder exactly when you're
 * least equipped to handle it.
 */
export class AmbientEvents {
  constructor(audio) {
    this.audio = audio;
    this.timer = 0;
    this.next = this._roll(1);
  }

  update(dt, sanityValue) {
    this.timer += dt;
    if (this.timer < this.next) return;

    this.timer = 0;
    const t = 1 - sanityValue / 100; // 0 = calm, 1 = falling apart
    this.next = this._roll(1 - t * 0.62);

    const key = AMBIENT_EVENT_KEYS[Math.floor(Math.random() * AMBIENT_EVENT_KEYS.length)];

    // Quiet and pitched down reads as "far away" without needing 3D audio.
    this.audio.play(key, {
      volumeScale: 0.35 + Math.random() * 0.4,
      detune: -0.12 + Math.random() * 0.1
    });
  }

  /** 20-55 seconds when calm, tightening to roughly 8-20 at zero sanity. */
  _roll(scale) {
    return (20 + Math.random() * 35) * Math.max(0.28, scale);
  }
}
