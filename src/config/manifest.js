/**
 * ASSET MANIFEST
 * --------------
 * The ONLY file you edit to add art and audio.
 * Drop files into public/assets/{textures,models,sounds,fonts}/ and list them here.
 * Anything missing falls back to a placeholder, so the game always runs.
 */

export const TEXTURES = {
  wall:    { url: 'assets/textures/wall.jpg',    repeat: [1, 1], fallback: { base: '#c9b45f', accent: '#b39f4d', pattern: 'stripes' } },
  carpet:  { url: 'assets/textures/carpet.jpg',  repeat: [2, 2], fallback: { base: '#8f7c38', accent: '#7a6a2f', pattern: 'noise' } },
  ceiling: { url: 'assets/textures/ceiling.jpg', repeat: [1, 1], fallback: { base: '#cfc7a6', accent: '#bdb492', pattern: 'noise' } },
  concrete:{ url: 'assets/textures/concrete.jpg',repeat: [1, 1], fallback: { base: '#6e6a63', accent: '#5c584f', pattern: 'noise' } },
  tile:    { url: 'assets/textures/tile.jpg',    repeat: [2, 2], fallback: { base: '#8d9490', accent: '#767c78', pattern: 'stripes' } }
};

/** What other players look like. No file = capsule, which is fine to ship. */
export const PLAYER = {
  url: 'assets/models/player.glb',
  scale: 1,
  yOffset: 0,
  rotationOffset: 0,
  animations: { idle: 'idle', walk: 'walk' }
};

/** The thing hunting you. No file = a tall dark shape, which is scarier than most models. */
export const MONSTER = {
  url: 'assets/models/monster.glb',
  scale: 1,
  yOffset: 0,
  rotationOffset: 0,
  animations: { idle: 'idle', walk: 'walk', run: 'run' }
};

/**
 * SCENERY PROPS
 * Name your .glb files EXACTLY these names and they load with no further work.
 * Place them from a level's `props` array: { model: 'chair', cell: [6,12], rotation: 0.4 }
 */
export const MODELS = {
  chair:      { url: 'assets/models/chair.glb',      scale: 1, yOffset: 0 },
  desk:       { url: 'assets/models/desk.glb',       scale: 1, yOffset: 0 },
  cabinet:    { url: 'assets/models/cabinet.glb',    scale: 1, yOffset: 0 },
  shelf:      { url: 'assets/models/shelf.glb',      scale: 1, yOffset: 0 },
  boxes:      { url: 'assets/models/boxes.glb',      scale: 1, yOffset: 0 },
  barrel:     { url: 'assets/models/barrel.glb',     scale: 1, yOffset: 0 },
  pipe:       { url: 'assets/models/pipe.glb',       scale: 1, yOffset: 0 },
  vent:       { url: 'assets/models/vent.glb',       scale: 1, yOffset: 0 },
  crate:      { url: 'assets/models/crate.glb',      scale: 1, yOffset: 0 },
  trolley:    { url: 'assets/models/trolley.glb',    scale: 1, yOffset: 0 },
  sofa:       { url: 'assets/models/sofa.glb',       scale: 1, yOffset: 0 },
  lamp:       { url: 'assets/models/lamp.glb',       scale: 1, yOffset: 0 },
  computer:   { url: 'assets/models/computer.glb',   scale: 1, yOffset: 0 },
  filecabinet:{ url: 'assets/models/filecabinet.glb',scale: 1, yOffset: 0 },
  generator:  { url: 'assets/models/generator.glb',  scale: 1, yOffset: 0 },
  door:       { url: 'assets/models/door.glb',       scale: 1, yOffset: 0 }
};

export const SOUNDS = {
  // core
  hum:       { url: 'assets/sounds/hum.mp3',       volume: 0.28, loop: true },
  footstep:  { url: 'assets/sounds/footstep.mp3',  volume: 0.35, loop: false },
  drone:     { url: 'assets/sounds/drone.mp3',     volume: 0.22, loop: true },
  menu:      { url: 'assets/sounds/menu.mp3',      volume: 0.35, loop: true },
  click:     { url: 'assets/sounds/click.mp3',     volume: 0.5,  loop: false },
  error:     { url: 'assets/sounds/error.mp3',     volume: 0.5,  loop: false },
  door:      { url: 'assets/sounds/door.mp3',      volume: 0.6,  loop: false },
  heartbeat: { url: 'assets/sounds/heartbeat.mp3', volume: 0.45, loop: true },

  // player
  breathe:   { url: 'assets/sounds/breathe.mp3',   volume: 0.4,  loop: true },
  hide_in:   { url: 'assets/sounds/hide_in.mp3',   volume: 0.45, loop: false },
  jump:      { url: 'assets/sounds/jump.mp3',      volume: 0.25, loop: false },
  land:      { url: 'assets/sounds/land.mp3',      volume: 0.3,  loop: false },

  // --- monster: breathing + movement ---------------------------------------
  monster_idle:   { url: 'assets/sounds/monster_idle.mp3',   volume: 0.45, loop: true },
  monster_chase:  { url: 'assets/sounds/monster_chase.mp3',  volume: 0.6,  loop: true },

  // Footsteps. Three variants so it never sounds like a metronome.
  monster_step_1: { url: 'assets/sounds/monster_step_1.mp3', volume: 0.5,  loop: false },
  monster_step_2: { url: 'assets/sounds/monster_step_2.mp3', volume: 0.5,  loop: false },
  monster_step_3: { url: 'assets/sounds/monster_step_3.mp3', volume: 0.5,  loop: false },

  // Roars. Fired on a timer while hunting, and at the moment it spots you.
  monster_roar_1: { url: 'assets/sounds/monster_roar_1.mp3', volume: 0.75, loop: false },
  monster_roar_2: { url: 'assets/sounds/monster_roar_2.mp3', volume: 0.75, loop: false },
  monster_roar_3: { url: 'assets/sounds/monster_roar_3.mp3', volume: 0.75, loop: false },

  monster_alert:  { url: 'assets/sounds/monster_alert.mp3',  volume: 0.85, loop: false },
  monster_lost:   { url: 'assets/sounds/monster_lost.mp3',   volume: 0.5,  loop: false },

  // Jumpscare: the catch sting, plus a scream layered over it.
  jumpscare:      { url: 'assets/sounds/jumpscare.mp3',      volume: 1.0,  loop: false },
  jumpscare_roar: { url: 'assets/sounds/jumpscare_roar.mp3', volume: 1.0,  loop: false },

  // random distant events
  far_thump: { url: 'assets/sounds/far_thump.mp3', volume: 0.4,  loop: false },
  far_creak: { url: 'assets/sounds/far_creak.mp3', volume: 0.35, loop: false },
  far_voice: { url: 'assets/sounds/far_voice.mp3', volume: 0.3,  loop: false },
  buzz_pop:  { url: 'assets/sounds/buzz_pop.mp3',  volume: 0.4,  loop: false }
};

export const AMBIENT_EVENT_KEYS = ['far_thump', 'far_creak', 'far_voice', 'buzz_pop'];

/** Picked at random so footsteps and roars never repeat predictably. */
export const MONSTER_STEP_KEYS = ['monster_step_1', 'monster_step_2', 'monster_step_3'];
export const MONSTER_ROAR_KEYS = ['monster_roar_1', 'monster_roar_2', 'monster_roar_3'];

/** Voice chat rides on the same WebSocket used for multiplayer. */
export const VOICE = {
  enabled: true,
  pushToTalkKey: 'KeyV',
  openMic: false,
  proximity: true,
  maxDistance: 22
};

export const SERVER_URL =
  import.meta.env?.VITE_SERVER_URL ||
  (location.protocol === 'https:' ? `wss://${location.host}` : 'ws://localhost:8080');
