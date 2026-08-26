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

/**
 * THE PLAYER CHARACTER
 *
 * This is what other players look like. Drop a rigged .glb at the url below.
 * If it isn't there you get the default capsule, which is genuinely fine to
 * ship with -- plenty of co-op horror games use abstract avatars.
 *
 * `animations` maps a state to a clip name inside the .glb. Names are matched
 * case-insensitively and partially, so 'walk' finds 'Walking' or 'Armature|Walk'.
 * Open the file at https://gltf-viewer.donmccurdy.com to see what clips it has.
 */
export const PLAYER = {
  url: 'assets/models/player.glb',
  scale: 1,          // model should be ~1.8 units tall; adjust if yours isn't
  yOffset: 0,        // raise/lower if the model floats or sinks into the floor
  rotationOffset: 0, // set to Math.PI if the model faces backwards
  animations: {
    idle: 'idle',
    walk: 'walk'
  }
};

export const SOUNDS = {
  // --- core loop -----------------------------------------------------------
  hum:       { url: 'assets/sounds/hum.mp3',       volume: 0.28, loop: true },
  footstep:  { url: 'assets/sounds/footstep.mp3',  volume: 0.35, loop: false },
  click:     { url: 'assets/sounds/click.mp3',     volume: 0.5,  loop: false },
  pickup:    { url: 'assets/sounds/pickup.mp3',    volume: 0.5,  loop: false },
  error:     { url: 'assets/sounds/error.mp3',     volume: 0.5,  loop: false },
  door:      { url: 'assets/sounds/door.mp3',      volume: 0.6,  loop: false },
  heartbeat: { url: 'assets/sounds/heartbeat.mp3', volume: 0.45, loop: true },

  // --- atmosphere ----------------------------------------------------------
  drone:     { url: 'assets/sounds/drone.mp3',     volume: 0.22, loop: true },
  menu:      { url: 'assets/sounds/menu.mp3',      volume: 0.35, loop: true },

  // --- random distant events (see AmbientEvents.js) ------------------------
  far_thump: { url: 'assets/sounds/far_thump.mp3', volume: 0.4,  loop: false },
  far_creak: { url: 'assets/sounds/far_creak.mp3', volume: 0.35, loop: false },
  far_voice: { url: 'assets/sounds/far_voice.mp3', volume: 0.3,  loop: false },
  buzz_pop:  { url: 'assets/sounds/buzz_pop.mp3',  volume: 0.4,  loop: false }
};

/** Which sounds the random-ambience system draws from. */
export const AMBIENT_EVENT_KEYS = ['far_thump', 'far_creak', 'far_voice', 'buzz_pop'];

export const MODELS = {
  // Scenery props. Reference these by key from a level's `props` array.
  // chair: { url: 'assets/models/chair.glb', scale: 1, yOffset: 0 },
};

/** WebSocket server. Leave as-is for local play; change when you deploy. */
export const SERVER_URL =
  import.meta.env?.VITE_SERVER_URL ||
  (location.protocol === 'https:'
    ? `wss://${location.host}`
    : 'ws://localhost:8080');
