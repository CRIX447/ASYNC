import * as THREE from 'three';

const EYE_HEIGHT = 1.65;
const RADIUS = 0.34;
const WALK_SPEED = 3.1;
const SPRINT_SPEED = 5.4;
const ACCEL = 12;
const FRICTION = 9;
const MOUSE_SENS = 0.0021;
const MAX_STAMINA = 100;

/**
 * Movement, looking, and collision.
 *
 * Pointer lock is handled manually rather than with PointerLockControls —
 * that class has changed API twice across recent three.js releases, and this
 * is only about twenty lines.
 */
export class PlayerController {
  constructor(camera, domElement, level) {
    this.camera = camera;
    this.dom = domElement;
    this.level = level;

    this.position = level.spawn.clone();
    this.position.y = EYE_HEIGHT;
    this.velocity = new THREE.Vector3();

    this.yaw = 0;
    this.pitch = 0;

    this.stamina = MAX_STAMINA;
    this.isSprinting = false;
    this.locked = false;

    this.headBob = 0;
    this.stepDistance = 0;
    this.onStep = () => {};

    this.keys = Object.create(null);
    this._bind();
  }

  _bind() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * MOUSE_SENS;
      this.pitch -= e.movementY * MOUSE_SENS;
      // Stop short of straight up/down so the view can't flip.
      const limit = Math.PI / 2 - 0.02;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });
  }

  requestLock() {
    this.dom.requestPointerLock();
  }

  update(dt) {
    const forward = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
    const strafe = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
    const moving = forward !== 0 || strafe !== 0;

    // Sprint burns stamina and needs a moment to recover.
    const wantsSprint = (this.keys.ShiftLeft || this.keys.ShiftRight) && moving;
    this.isSprinting = wantsSprint && this.stamina > 1;

    if (this.isSprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 22);
    } else {
      this.stamina = Math.min(MAX_STAMINA, this.stamina + dt * 13);
    }

    const speed = this.isSprinting ? SPRINT_SPEED : WALK_SPEED;

    // Build the desired direction in world space from the yaw only —
    // looking at the floor shouldn't slow you down.
    const dir = new THREE.Vector3();
    if (moving) {
      dir.set(strafe, 0, -forward).normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    }

    this.velocity.x += (dir.x * speed - this.velocity.x) * Math.min(1, ACCEL * dt);
    this.velocity.z += (dir.z * speed - this.velocity.z) * Math.min(1, ACCEL * dt);

    if (!moving) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      this.velocity.x *= damp;
      this.velocity.z *= damp;
    }

    this._moveAxis('x', this.velocity.x * dt);
    this._moveAxis('z', this.velocity.z * dt);

    this._updateHeadBob(dt);
    this._applyToCamera();
  }

  /**
   * Move one axis at a time and cancel it if it ends inside a wall. Doing the
   * axes separately is what lets you slide along a surface instead of sticking.
   */
  _moveAxis(axis, delta) {
    if (delta === 0) return;

    const before = this.position[axis];
    this.position[axis] += delta;

    if (this._collides()) {
      this.position[axis] = before;
      this.velocity[axis] = 0;
    }
  }

  /** Sample the four points around the player capsule against the grid. */
  _collides() {
    const { x, z } = this.position;
    return (
      this.level.isBlocked(x + RADIUS, z) ||
      this.level.isBlocked(x - RADIUS, z) ||
      this.level.isBlocked(x, z + RADIUS) ||
      this.level.isBlocked(x, z - RADIUS) ||
      this.level.isBlocked(x + RADIUS * 0.7, z + RADIUS * 0.7) ||
      this.level.isBlocked(x - RADIUS * 0.7, z + RADIUS * 0.7) ||
      this.level.isBlocked(x + RADIUS * 0.7, z - RADIUS * 0.7) ||
      this.level.isBlocked(x - RADIUS * 0.7, z - RADIUS * 0.7)
    );
  }

  _updateHeadBob(dt) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);

    if (speed > 0.4) {
      this.headBob += dt * speed * 2.1;
      this.stepDistance += speed * dt;

      const stride = this.isSprinting ? 2.0 : 2.6;
      if (this.stepDistance >= stride) {
        this.stepDistance = 0;
        this.onStep();
      }
    } else {
      this.stepDistance = 0;
    }
  }

  _applyToCamera() {
    const bobY = Math.sin(this.headBob * 2) * 0.035;
    const bobX = Math.cos(this.headBob) * 0.018;

    this.camera.position.set(
      this.position.x + bobX,
      this.position.y + bobY,
      this.position.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  /** Compact snapshot for the network. */
  getNetState() {
    return {
      x: +this.position.x.toFixed(2),
      z: +this.position.z.toFixed(2),
      yaw: +this.yaw.toFixed(2)
    };
  }
}
