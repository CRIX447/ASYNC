import * as THREE from 'three';
import { SOUNDS } from '../config/manifest.js';

/**
 * Every sound is optional. If a file isn't there, calls to play() simply do
 * nothing — the game never breaks because you haven't found a footstep sample.
 */
export class AudioManager {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.buffers = {};
    this.loops = {};
    this.enabled = true;
    this._loader = new THREE.AudioLoader();
  }

  async loadAll() {
    await Promise.all(
      Object.entries(SOUNDS).map(async ([key, def]) => {
        try {
          this.buffers[key] = await this._loader.loadAsync(def.url);
        } catch {
          this.buffers[key] = null;
        }
      })
    );
  }

  /** Browsers block audio until a user gesture — call this from the start click. */
  resume() {
    const ctx = this.listener.context;
    if (ctx.state === 'suspended') ctx.resume();
  }

  play(key, { volumeScale = 1, detune = 0 } = {}) {
    const buf = this.buffers[key];
    if (!buf || !this.enabled) return null;

    const def = SOUNDS[key];
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(buf);
    sound.setVolume((def.volume ?? 0.5) * volumeScale);
    if (detune) sound.playbackRate = 1 + detune;
    sound.play();
    return sound;
  }

  startLoop(key, volumeScale = 1) {
    if (this.loops[key]) return this.loops[key];

    const buf = this.buffers[key];
    if (!buf) return null;

    const def = SOUNDS[key];
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(buf);
    sound.setLoop(true);
    sound.setVolume((def.volume ?? 0.3) * volumeScale);
    sound.play();

    this.loops[key] = sound;
    return sound;
  }

  stopLoop(key) {
    const s = this.loops[key];
    if (!s) return;
    s.stop();
    delete this.loops[key];
  }

  setLoopVolume(key, v) {
    const s = this.loops[key];
    if (s) s.setVolume(v);
  }

  /** Slight pitch variation stops repeated footsteps sounding robotic. */
  playFootstep() {
    this.play('footstep', { detune: (Math.random() - 0.5) * 0.18 });
  }
}
