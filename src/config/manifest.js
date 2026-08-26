/**
 * ASSET MANIFEST
 * --------------
 * This is the ONLY file you need to edit to add your own art and audio.
 *
 * Drop files into public/assets/{textures,models,sounds}/ and point at them here.
 * Anything missing falls back to a procedurally generated placeholder, so the
 * game always runs even with a completely empty assets folder.
 *
 * Good free CC0 sources: ambientcg.com, polyhaven.com, freesound.org
 */

export const TEXTURES = {
  // repeat = how many times the texture tiles across ONE cell (4m x 4m by default)
  wall: {
    url: 'assets/textures/wall.jpg',
    repeat: [1, 1],
    fallback: { base: '#c9b45f', accent: '#b39f4d', pattern: 'stripes' }
  },
  carpet: {
    url: 'assets/textures/carpet.jpg',
    repeat: [2, 2],
    fallback: { base: '#8f7c38', accent: '#7a6a2f', pattern: 'noise' }
  },
  ceiling: {
    url: 'assets/textures/ceiling.jpg',
    repeat: [1, 1],
    fallback: { base: '#cfc7a6', accent: '#bdb492', pattern: 'noise' }
  }
};

export const SOUNDS = {
  // volume 0..1, loop for ambience
  hum:       { url: 'assets/sounds/hum.mp3',       volume: 0.28, loop: true },
  footstep:  { url: 'assets/sounds/footstep.mp3',  volume: 0.35, loop: false },
  click:     { url: 'assets/sounds/click.mp3',     volume: 0.5,  loop: false },
  pickup:    { url: 'assets/sounds/pickup.mp3',    volume: 0.5,  loop: false },
  error:     { url: 'assets/sounds/error.mp3',     volume: 0.5,  loop: false },
  door:      { url: 'assets/sounds/door.mp3',      volume: 0.6,  loop: false },
  heartbeat: { url: 'assets/sounds/heartbeat.mp3', volume: 0.45, loop: true }
};

export const MODELS = {
  // Use .glb (binary glTF). Blender exports it directly: File > Export > glTF 2.0
  // scale/yOffset let you fix models that were authored at the wrong size.
  // Reference these by key from a level's `props` array.
  //
  // chair: { url: 'assets/models/chair.glb', scale: 1, yOffset: 0 },
  // pillar: { url: 'assets/models/pillar.glb', scale: 1, yOffset: 0 },
};

/** WebSocket server. Leave as-is for local play; change when you deploy. */
export const SERVER_URL =
  import.meta.env?.VITE_SERVER_URL ||
  (location.protocol === 'https:'
    ? `wss://${location.host}`
    : 'ws://localhost:8080');
