import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { MONSTER } from '../config/manifest.js';

/**
 * Client-side VISUAL only. All movement decisions happen on the server --
 * this just interpolates toward wherever the server last said it was, so
 * nobody can hack their client to make the monster stand still.
 */
export class Monster {
  constructor(scene, assets, audio) {
    this.scene = scene;
    this.audio = audio;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.target = new THREE.Vector3();
    this.targetYaw = 0;
    this.mode = 'idle';
    this.distance = 999;

    this.mixer = null;
    this.actions = {};
    this.current = null;
    this._stepTimer = 0;

    const model = assets?.monsterModel;

    if (model) {
      const body = skeletonClone(model.scene);
      body.scale.setScalar(MONSTER.scale ?? 1);
      body.position.y = MONSTER.yOffset ?? 0;
      this.group.add(body);

      if (model.animations.length) {
        this.mixer = new THREE.AnimationMixer(body);
        for (const key of ['idle', 'walk', 'run']) {
          this.actions[key] = this._find(model.animations, MONSTER.animations?.[key]);
        }
        this._play('idle');
      }
    } else {
      this.group.add(...this._placeholder());
    }

    // Its own dim red light, so it reads before you can make out the shape.
    this.glow = new THREE.PointLight(0xff2a12, 2.4, 9, 2);
    this.glow.position.y = 1.7;
    this.group.add(this.glow);

    scene.add(this.group);
  }

  /** Called when a server position update arrives. */
  setState({ x, z, yaw, mode }) {
    if (!this.group.visible) {
      // First sighting: drop it straight in rather than sliding from origin.
      this.group.position.set(x, 0, z);
      this.group.visible = true;
    }
    this.target.set(x, 0, z);
    this.targetYaw = yaw ?? this.targetYaw;

    if (mode !== this.mode) {
      if (mode === 'chase' && this.mode !== 'chase') {
        this.audio.play('monster_notice');
        this.audio.stopLoop('monster_idle');
        this.audio.startLoop('monster_chase');
      }
      if (mode !== 'chase' && this.mode === 'chase') {
        this.audio.stopLoop('monster_chase');
        this.audio.startLoop('monster_idle');
      }
      this.mode = mode;
    }
  }

  update(dt, playerPos) {
    if (!this.group.visible) return;

    this.group.position.lerp(this.target, Math.min(1, dt * 7));

    let diff = this.targetYaw + (MONSTER.rotationOffset || 0) - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, dt * 7);

    this.distance = this.group.position.distanceTo(
      new THREE.Vector3(playerPos.x, 0, playerPos.z)
    );

    // Proximity drives volume, so you hear it before you see it.
    const near = Math.max(0, 1 - this.distance / 26);
    this.audio.setLoopVolume('monster_chase', 0.75 * near * near);
    this.audio.setLoopVolume('monster_idle', 0.45 * near * near);
    this.glow.intensity = 1.6 + Math.sin(performance.now() * 0.004) * 0.7;

    if (this.mixer) {
      this.mixer.update(dt);
      this._play(this.mode === 'chase' ? 'run' : this.mode === 'patrol' ? 'walk' : 'idle');
    }

    // Footsteps, faster when hunting.
    this._stepTimer -= dt;
    if (this._stepTimer <= 0 && this.mode !== 'idle' && this.distance < 30) {
      this._stepTimer = this.mode === 'chase' ? 0.38 : 0.72;
      this.audio.play('monster_step', { volumeScale: near * near });
    }
  }

  /** How badly it should be disrupting your flashlight right now (0..1). */
  get proximity() {
    if (!this.group.visible) return 0;
    return Math.max(0, 1 - this.distance / 14);
  }

  _play(key) {
    const next = this.actions[key];
    if (!next || next === this.current) return;
    next.reset().play();
    if (this.current) this.current.crossFadeTo(next, 0.3, false);
    this.current = next;
  }

  _find(clips, wanted) {
    if (!wanted) return null;
    const n = wanted.toLowerCase();
    const clip =
      clips.find((c) => c.name.toLowerCase() === n) ||
      clips.find((c) => c.name.toLowerCase().includes(n));
    return clip ? this.mixer.clipAction(clip) : null;
  }

  _placeholder() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x140a0a, roughness: 0.95, emissive: 0x180000
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.5, 4, 10), mat);
    body.position.y = 1.15;
    body.castShadow = true;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), mat);
    head.position.y = 2.15;
    head.castShadow = true;

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3018 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
    eyeL.position.set(-0.11, 2.2, -0.26);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.11;

    return [body, head, eyeL, eyeR];
  }
}
