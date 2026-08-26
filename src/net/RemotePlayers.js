import * as THREE from 'three';

/**
 * Other players. Positions arrive ~15 times a second, so each avatar lerps
 * toward its latest target instead of snapping — otherwise everyone teleports.
 */
export class RemotePlayers {
  constructor(scene) {
    this.scene = scene;
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

    // Anyone who disconnected.
    for (const [id, a] of this.avatars) {
      if (!seen.has(id)) {
        this.scene.remove(a.group);
        this.avatars.delete(id);
      }
    }
  }

  update(dt) {
    for (const a of this.avatars.values()) {
      a.group.position.lerp(a.target, Math.min(1, dt * 9));

      // Shortest-path yaw interpolation, or they spin the long way round.
      let diff = a.targetYaw - a.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.group.rotation.y += diff * Math.min(1, dt * 9);

      a.beam.intensity += ((a.lightOn ? 9 : 0) - a.beam.intensity) * Math.min(1, dt * 10);
    }
  }

  _create(id) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x8d8574,
      roughness: 0.85
    });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.0, 4, 10), bodyMat);
    body.position.y = 0.92;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), bodyMat);
    head.position.y = 1.62;
    head.castShadow = true;
    group.add(head);

    // Their torch, so you can see where a teammate is looking from a distance.
    const beam = new THREE.SpotLight(0xfff0cc, 0, 20, Math.PI / 7, 0.6, 1.5);
    beam.position.set(0, 1.5, 0);
    beam.target.position.set(0, 1.3, -1);
    group.add(beam, beam.target);

    this.scene.add(group);

    return {
      id,
      group,
      beam,
      target: new THREE.Vector3(),
      targetYaw: 0,
      lightOn: false
    };
  }
}
