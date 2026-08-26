import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { MONSTER, MONSTER_STEP_KEYS, MONSTER_ROAR_KEYS } from '../config/manifest.js';

const PATROL = 'patrol';
const CHASE  = 'chase';
const SEARCH = 'search';

const SIGHT_RANGE   = 18;
const HEAR_RANGE    = 9;    // sprinting is loud even out of sight
const CATCH_RANGE   = 1.15;
const PATROL_SPEED  = 1.5;
const SEARCH_SPEED  = 2.2;
const CHASE_SPEED   = 3.6;  // slower than sprint, faster than walk -- you can escape, but not forever
const REPATH_TIME   = 0.45;
const SEARCH_TIMEOUT = 9;

/**
 * The thing in the walls.
 *
 * Pathfinding is breadth-first over the level grid. That's technically
 * "worse" than A*, but these maps are a few hundred cells and BFS on a
 * uniform grid gives a guaranteed shortest path in well under a millisecond.
 * Not worth the extra code.
 *
 * Line of sight is a grid walk, not a raycast against meshes -- consistent
 * with how player collision works, and it can't be fooled by a prop.
 */
export class Monster {
  constructor(scene, level, assets, audio) {
    this.scene = scene;
    this.level = level;
    this.assets = assets;
    this.audio = audio;

    this.state = PATROL;
    this.speed = PATROL_SPEED;
    this.path = [];
    this.repathTimer = 0;
    this.searchTimer = 0;
    this.stepDistance = 0;
    this.active = true;

    // Roar timers. It announces itself far more often once it's hunting.
    this.roarTimer = 8 + Math.random() * 12;

    this.onCatch = () => {};

    this.position = (level.monsterSpawn || level.spawn).clone();
    this.position.y = 0;
    this.yaw = 0;

    this._build();
    this._chaseLoop = null;
  }

  _build() {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const model = this.assets?.monsterModel;

    if (model) {
      const body = skeletonClone(model.scene);
      body.scale.setScalar(MONSTER.scale ?? 1);
      body.position.y = MONSTER.yOffset ?? 0;
      this.group.add(body);

      if (model.animations.length) {
        this.mixer = new THREE.AnimationMixer(body);
        this.actions = {
          idle: this._action(model.animations, MONSTER.animations?.idle),
          walk: this._action(model.animations, MONSTER.animations?.walk),
          run:  this._action(model.animations, MONSTER.animations?.run)
        };
        this.actions.idle?.play();
        this.current = 'idle';
      }
    } else {
      // Placeholder: a tall matte-black figure. Deliberately featureless --
      // an unlit silhouette in fog is more unsettling than most models.
      const mat = new THREE.MeshStandardMaterial({
        color: 0x07070a, roughness: 1, metalness: 0
      });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.5, 4, 12), mat);
      body.position.y = 1.15;
      body.castShadow = true;

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), mat);
      head.position.y = 2.05;
      head.castShadow = true;

      // Two faint eyes, the only thing that catches your torch.
      const eyeMat = new THREE.MeshStandardMaterial({
        color: 0x000000, emissive: 0xffdf7a, emissiveIntensity: 3.2
      });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat);
      const eyeR = eyeL.clone();
      eyeL.position.set(-0.09, 2.09, -0.24);
      eyeR.position.set(0.09, 2.09, -0.24);

      this.group.add(body, head, eyeL, eyeR);
    }

    this.scene.add(this.group);
  }

  _action(clips, wanted) {
    if (!wanted) return null;
    const n = wanted.toLowerCase();
    const clip =
      clips.find((c) => c.name.toLowerCase() === n) ||
      clips.find((c) => c.name.toLowerCase().includes(n));
    return clip ? this.mixer.clipAction(clip) : null;
  }

  _playAnim(name) {
    if (!this.mixer || !this.actions || this.current === name) return;
    const from = this.actions[this.current];
    const to = this.actions[name];
    if (!to) return;
    to.reset().play();
    if (from) from.crossFadeTo(to, 0.2, false);
    this.current = name;
  }

  // ------------------------------------------------------------------ update

  update(dt, player) {
    if (!this.active) return;
    this.mixer?.update(dt);

    this.repathTimer -= dt;
    this._updateRoar(dt, player);

    const canSee = this._canSee(player);

    switch (this.state) {
      case PATROL:
        if (canSee) this._enterChase(player);
        else if (!this.path.length) this._pathToRandomCell();
        break;

      case CHASE:
        if (canSee) {
          this.lastKnown = player.position.clone();
          if (this.repathTimer <= 0) {
            this._pathTo(player.position);
            this.repathTimer = REPATH_TIME;
          }
        } else {
          this._enterSearch();
        }
        break;

      case SEARCH:
        this.searchTimer -= dt;
        if (canSee) this._enterChase(player);
        else if (this.searchTimer <= 0 || !this.path.length) this._enterPatrol();
        break;
    }

    this._followPath(dt);
    this._updateAudio(player);

    // Caught.
    const d = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
    if (d < CATCH_RANGE && !player.isHidden) {
      this.active = false;
      this.onCatch(this);
    }
  }

  _enterChase(player) {
    if (this.state !== CHASE) {
      this.audio.play('monster_alert');
      this._roar(1.0);              // it has seen you, and it wants you to know
      this.audio.startLoop('monster_chase');
      this._playAnim('run');
      this.roarTimer = 5 + Math.random() * 4;
    }
    this.state = CHASE;
    this.speed = CHASE_SPEED;
    this.lastKnown = player.position.clone();
    this._pathTo(player.position);
    this.repathTimer = REPATH_TIME;
  }

  _enterSearch() {
    this.state = SEARCH;
    this.speed = SEARCH_SPEED;
    this.searchTimer = SEARCH_TIMEOUT;
    this.audio.stopLoop('monster_chase');
    this.audio.play('monster_lost');
    this._playAnim('walk');
    if (this.lastKnown) this._pathTo(this.lastKnown);
  }

  _enterPatrol() {
    this.state = PATROL;
    this.speed = PATROL_SPEED;
    this.audio.stopLoop('monster_chase');
    this._playAnim('walk');
    this._pathToRandomCell();
  }

  // --------------------------------------------------------------- perception

  _canSee(player) {
    if (player.isHidden) return false;

    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    // Sprinting players are heard through walls.
    if (player.isSprinting && dist < HEAR_RANGE) return true;
    if (dist > SIGHT_RANGE) return false;

    // Crouching halves your effective visibility.
    const effective = player.crouching ? dist * 2 : dist;
    if (effective > SIGHT_RANGE) return false;

    return this._lineOfSight(this.position, player.position);
  }

  /** Bresenham-ish walk across the grid. Cheap and never lies. */
  _lineOfSight(a, b) {
    const cs = this.level.cellSize;
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (cs * 0.35));

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      if (this.level.isSightBlocked(x, z)) return false;
    }
    return true;
  }

  // -------------------------------------------------------------- pathfinding

  _pathTo(target) {
    const cs = this.level.cellSize;
    const start = [Math.floor(this.position.x / cs), Math.floor(this.position.z / cs)];
    const goal  = [Math.floor(target.x / cs), Math.floor(target.z / cs)];
    this.path = this.level.findPath(start, goal) || [];
  }

  _pathToRandomCell() {
    const cell = this.level.randomWalkableCell();
    if (!cell) return;
    const cs = this.level.cellSize;
    this._pathTo(new THREE.Vector3((cell[0] + 0.5) * cs, 0, (cell[1] + 0.5) * cs));
  }

  _followPath(dt) {
    if (!this.path.length) return;

    const cs = this.level.cellSize;
    const [c, r] = this.path[0];
    const tx = (c + 0.5) * cs;
    const tz = (r + 0.5) * cs;

    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const d = Math.hypot(dx, dz);

    if (d < 0.28) {
      this.path.shift();
      return;
    }

    const step = Math.min(this.speed * dt, d);
    this.position.x += (dx / d) * step;
    this.position.z += (dz / d) * step;
    this.stepDistance += step;

    // Face travel direction, turning smoothly.
    const targetYaw = Math.atan2(dx, dz) + (MONSTER.rotationOffset || 0);
    let diff = targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Math.min(1, dt * 7);

    this.group.position.set(this.position.x, 0, this.position.z);
    this.group.rotation.y = this.yaw;

    const stride = this.state === CHASE ? 1.1 : 1.7;
    if (this.stepDistance >= stride) {
      this.stepDistance = 0;
      this._step();
    }
  }

  // --------------------------------------------------------------------- audio

  /** Random variant + slight pitch shift, so steps never sound looped. */
  _step() {
    const key = MONSTER_STEP_KEYS[Math.floor(Math.random() * MONSTER_STEP_KEYS.length)];
    this.audio.play(key, {
      volumeScale: this._proximityVolume(),
      detune: (Math.random() - 0.5) * 0.14
    });
  }

  /**
   * Roars are the main thing that makes it feel alive when you can't see it.
   * Pitched down and quiet at distance so you can roughly place it by ear.
   */
  _roar(volumeScale = null) {
    const key = MONSTER_ROAR_KEYS[Math.floor(Math.random() * MONSTER_ROAR_KEYS.length)];
    const v = volumeScale ?? Math.max(0.25, this._proximityVolume());
    this.audio.play(key, {
      volumeScale: v,
      detune: -0.06 + (Math.random() - 0.5) * 0.1
    });
  }

  _updateRoar(dt, player) {
    this.roarTimer -= dt;
    if (this.roarTimer > 0) return;

    this._lastPlayerPos = player.position;
    this._roar();

    // Hunting: every 6-11s. Otherwise: every 14-30s.
    this.roarTimer = this.state === CHASE
      ? 6 + Math.random() * 5
      : 14 + Math.random() * 16;
  }

  /** Called by the game at the moment of the catch. */
  screamAtPlayer() {
    this.audio.play('jumpscare_roar', { volumeScale: 1 });
  }

  _updateAudio(player) {
    const v = this._proximityVolume(player);
    this.audio.setLoopVolume('monster_idle', 0.45 * v);
    if (this.state === CHASE) this.audio.setLoopVolume('monster_chase', 0.6);
  }

  _proximityVolume(player) {
    const p = player?.position || this._lastPlayerPos;
    if (p) this._lastPlayerPos = p;
    if (!p) return 0.3;
    const d = Math.hypot(p.x - this.position.x, p.z - this.position.z);
    return Math.max(0, 1 - d / 26);
  }

  dispose() {
    this.audio.stopLoop('monster_chase');
    this.audio.stopLoop('monster_idle');
    this.mixer?.stopAllAction();
    this.scene.remove(this.group);
  }
}
