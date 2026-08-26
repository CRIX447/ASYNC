import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { PLAYER } from '../config/manifest.js';

/**
 * Other players. Positions arrive ~15 times a second, so each avatar lerps
 * toward its latest target instead of snapping -- otherwise everyone teleports.
 *
 * If a rigged .glb is supplied it's used, with idle/walk animations chosen from
 * how fast the avatar is actually moving. Otherwise you get a capsule.
 */
export class RemotePlayers {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.avatars = new Map();
  }

  sync(list) {
    const seen = new Set();

    list.forEach((p) => {
      seen.add(p.id);
      let a = this.avatars.get(p.id);
      if (!a) {
        a = this._create(p.id);
        this.avatars.set(p.id, a);
      }
      a.target.set(p.x, 0, p.z);
      a.targetYaw = p.yaw ?? 0;
      a.lightOn = !!p.light;
    });

    for (const [id, a] of this.avatars) {
      if (!seen.has(id)) {
        this.scene.remove(a.group);
        a.mixer?.stopAllAction();
        this.avatars.delete(id);
      }
    }
  }

  update(dt) {
    for (const a of this.avatars.values()) {
      const prev = a.group.position.clone();
      a.group.position.lerp(a.target, Math.min(1, dt * 9));

      // Shortest-path yaw interpolation, or they spin the long way round.
      let diff = a.targetYaw + (PLAYER.rotationOffset || 0) - a.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.group.rotation.y += diff * Math.min(1, dt * 9);

      a.beam.intensity += ((a.lightOn ? 9 : 0) - a.beam.intensity) * Math.min(1, dt * 10);

      // Drive animation from observed speed rather than a networked flag --
      // one less thing to send, and it always matches what you can see.
      const speed = prev.distanceTo(a.group.position) / Math.max(dt, 0.0001);
      this._updateAnimation(a, speed, dt);
    }
  }

  _updateAnimation(a, speed, dt) {
    if (!a.mixer) return;
    a.mixer.update(dt);

    const wantWalk = speed > 0.55;
    if (wantWalk === a.isWalking) return;
    a.isWalking = wantWalk;

    const from = wantWalk ? a.actions.idle : a.actions.walk;
    const to = wantWalk ? a.actions.walk : a.actions.idle;
    if (!to) return;

    to.reset().play();
    if (from) from.crossFadeTo(to, 0.25, false);
  }

  _create(id) {
    const group = new THREE.Group();
    let mixer = null;
    let actions = {};

    const model = this.assets?.playerModel;

    if (model) {
      // skeletonClone, NOT .clone() -- plain clone breaks skinned meshes and
      // every copy ends up sharing (and fighting over) one skeleton.
      const body = skeletonClone(model.scene);
      body.scale.setScalar(PLAYER.scale ?? 1);
      body.position.y = PLAYER.yOffset ?? 0;
      group.add(body);

      if (model.animations.length) {
        mixer = new THREE.AnimationMixer(body);
        actions = {
          idle: this._findAction(mixer, model.animations, PLAYER.animations?.idle),
          walk: this._findAction(mixer, model.animations, PLAYER.animations?.walk)
        };
        actions.idle?.play();
      }
    } else {
      group.add(...this._makeCapsule());
    }

    const beam = new THREE.SpotLight(0xfff0cc, 0, 20, Math.PI / 7, 0.6, 1.5);
    beam.position.set(0, 1.5, 0);
    beam.target.position.set(0, 1.3, -1);
    group.add(beam, beam.target);

    this.scene.add(group);

    return {
      id,
      group,
      beam,
      mixer,
      actions,
      isWalking: false,
      target: new THREE.Vector3(),
      targetYaw: 0,
      lightOn: false
    };
  }

  /** Partial, case-insensitive clip lookup -- exporters mangle clip names. */
  _findAction(mixer, clips, wanted) {
    if (!wanted) return null;
    const needle = wanted.toLowerCase();
    const clip =
      clips.find((c) => c.name.toLowerCase() === needle) ||
      clips.find((c) => c.name.toLowerCase().includes(needle));
    return clip ? mixer.clipAction(clip) : null;
  }

  _makeCapsule() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8d8574, roughness: 0.85 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.0, 4, 10), mat);
    body.position.y = 0.92;
    body.castShadow = true;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), mat);
    head.position.y = 1.62;
    head.castShadow = true;

    return [body, head];
  }
}
