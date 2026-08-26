import * as THREE from 'three';

const STAND_HEIGHT  = 1.65;
const CROUCH_HEIGHT = 0.95;
const RADIUS        = 0.34;

const WALK_SPEED   = 3.1;
const SPRINT_SPEED = 5.4;
const CROUCH_SPEED = 1.45;

const ACCEL    = 12;
const FRICTION = 9;
const GRAVITY  = 18;
const JUMP_VELOCITY = 5.2;

const MOUSE_SENS = 0.0021;
const PAD_LOOK_SENS = 2.6;
const PAD_DEADZONE = 0.18;

const MAX_STAMINA = 100;
const STAMINA_DRAIN = 22;
const STAMINA_RECOVER = 13;
/** Once you hit zero you're locked out until stamina climbs back to this. */
const EXHAUST_RECOVERY_THRESHOLD = 32;

/**
 * Movement, looking, crouching, jumping and collision.
 *
 * Pointer lock is handled manually rather than with PointerLockControls --
 * that class changed API twice across recent three.js releases.
 * Gamepad input is polled here too, so the rest of the game never has to
 * know which device the player is on.
 */
export class PlayerController {
  constructor(camera, domElement, level) {
    this.camera = camera;
    this.dom = domElement;
    this.level = level;

    this.position = level.spawn.clone();
    this.position.y = STAND_HEIGHT;
    this.velocity = new THREE.Vector3();

    this.yaw = 0;
    this.pitch = 0;

    // vertical state
    this.feetY = 0;
    this.verticalVelocity = 0;
    this.grounded = true;

    // crouch state
    this.crouching = false;
    this.eyeHeight = STAND_HEIGHT;

    // stamina
    this.stamina = MAX_STAMINA;
    this.exhausted = false;
    this.isSprinting = false;

    this.locked = false;
    this.frozen = false;

    this.headBob = 0;
    this.stepDistance = 0;

    // callbacks the game hooks into
    this.onStep = () => {};
    this.onJump = () => {};
    this.onLand = () => {};
    this.onInteract = () => {};
    this.onToggleLight = () => {};

    this.keys = Object.create(null);
    this._padPrev = {};
    this._bind();
  }

  _bind() {
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
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
      if (!this.locked || this.frozen) return;
      this.yaw -= e.movementX * MOUSE_SENS;
      this.pitch -= e.movementY * MOUSE_SENS;
      const limit = Math.PI / 2 - 0.02;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });

    window.addEventListener('gamepadconnected', (e) => {
      console.info('Gamepad connected:', e.gamepad.id);
      this.padConnected = true;
    });

    window.addEventListener('gamepaddisconnected', () => {
      this.padConnected = false;
    });
  }

  requestLock() {
    this.dom.requestPointerLock();
  }

  // ------------------------------------------------------------------ gamepad

  /**
   * Standard mapping: left stick move, right stick look, A jump, B crouch,
   * X interact, Y flashlight, L3 sprint. Returns the analogue axes so the
   * movement code can treat pad and keyboard identically.
   */
  _pollGamepad() {
    const pads = navigator.getGamepads?.() || [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) return null;

    const dz = (v) => (Math.abs(v) < PAD_DEADZONE ? 0 : v);

    const pressed = (i) => !!pad.buttons[i]?.pressed;
    const justPressed = (i) => {
      const now = pressed(i);
      const was = this._padPrev[i];
      this._padPrev[i] = now;
      return now && !was;
    };

    if (justPressed(0)) this._jumpQueued = true;   // A
    if (justPressed(2)) this.onInteract();          // X
    if (justPressed(3)) this.onToggleLight();       // Y

    return {
      moveX: dz(pad.axes[0] ?? 0),
      moveY: dz(pad.axes[1] ?? 0),
      lookX: dz(pad.axes[2] ?? 0),
      lookY: dz(pad.axes[3] ?? 0),
      crouch: pressed(1),   // B held
      sprint: pressed(10)   // L3
    };
  }

  // ------------------------------------------------------------------- update

  update(dt) {
    if (this.frozen) {
      this._applyToCamera();
      return;
    }

    const pad = this._pollGamepad();

    if (pad) {
      this.yaw -= pad.lookX * PAD_LOOK_SENS * dt;
      this.pitch -= pad.lookY * PAD_LOOK_SENS * dt;
      const limit = Math.PI / 2 - 0.02;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    }

    let forward = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
    let strafe  = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);

    if (pad) {
      if (pad.moveY) forward = -pad.moveY;
      if (pad.moveX) strafe = pad.moveX;
    }

    const moving = forward !== 0 || strafe !== 0;

    this._updateCrouch(dt, pad);
    this._updateStamina(dt, moving, pad);
    this._updateVertical(dt, pad);

    const speed = this.crouching
      ? CROUCH_SPEED
      : this.isSprinting
        ? SPRINT_SPEED
        : WALK_SPEED;

    const dir = new THREE.Vector3();
    if (moving) {
      dir.set(strafe, 0, -forward);
      if (dir.lengthSq() > 1) dir.normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    }

    // Less control in mid-air, so jumps commit.
    const control = this.grounded ? 1 : 0.35;

    this.velocity.x += (dir.x * speed - this.velocity.x) * Math.min(1, ACCEL * dt * control);
    this.velocity.z += (dir.z * speed - this.velocity.z) * Math.min(1, ACCEL * dt * control);

    if (!moving && this.grounded) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      this.velocity.x *= damp;
      this.velocity.z *= damp;
    }

    this._moveAxis('x', this.velocity.x * dt);
    this._moveAxis('z', this.velocity.z * dt);

    this._updateHeadBob(dt);
    this._applyToCamera();
  }

  _updateCrouch(dt, pad) {
    const wantsCrouch =
      this.keys.ControlLeft || this.keys.ControlRight || this.keys.KeyC || pad?.crouch;

    // Can't stand up under a low ceiling or inside a crack.
    if (!wantsCrouch && this.crouching && this._blockedAbove()) {
      // stay crouched
    } else {
      this.crouching = !!wantsCrouch;
    }

    const targetEye = this.crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 11);
  }

  _blockedAbove() {
    return this.level.isLowCeiling?.(this.position.x, this.position.z) ?? false;
  }

  _updateStamina(dt, moving, pad) {
    const wantsSprint =
      ((this.keys.ShiftLeft || this.keys.ShiftRight || pad?.sprint) &&
        moving &&
        !this.crouching &&
        this.grounded);

    // Hard lockout: hit zero and you jog until you've caught your breath.
    if (this.exhausted && this.stamina >= EXHAUST_RECOVERY_THRESHOLD) {
      this.exhausted = false;
    }

    this.isSprinting = !!wantsSprint && !this.exhausted && this.stamina > 0;

    if (this.isSprinting) {
      this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN * dt);
      if (this.stamina <= 0) {
        this.exhausted = true;
        this.isSprinting = false;
      }
    } else {
      // Recover faster while crouched and still.
      const rate = this.crouching && !moving ? STAMINA_RECOVER * 1.7 : STAMINA_RECOVER;
      this.stamina = Math.min(MAX_STAMINA, this.stamina + rate * dt);
    }
  }

  _updateVertical(dt, pad) {
    const wantsJump = this.keys.Space || this._jumpQueued;
    this._jumpQueued = false;

    if (wantsJump && this.grounded && !this.crouching && !this.exhausted) {
      this.verticalVelocity = JUMP_VELOCITY;
      this.grounded = false;
      this.stamina = Math.max(0, this.stamina - 8);
      this.onJump();
    }

    if (!this.grounded) {
      this.verticalVelocity -= GRAVITY * dt;
      this.feetY += this.verticalVelocity * dt;

      if (this.feetY <= 0) {
        this.feetY = 0;
        const impact = this.verticalVelocity;
        this.verticalVelocity = 0;
        this.grounded = true;
        if (impact < -2) this.onLand();
      }
    }
  }

  _moveAxis(axis, delta) {
    if (delta === 0) return;
    const before = this.position[axis];
    this.position[axis] += delta;

    if (this._collides()) {
      this.position[axis] = before;
      this.velocity[axis] = 0;
    }
  }

  _collides() {
    const { x, z } = this.position;
    const r = RADIUS;
    const d = r * 0.7;

    // Crack tiles are only passable while crouched.
    if (!this.crouching && this.level.isCrouchOnly?.(x, z)) return true;

    return (
      this.level.isBlocked(x + r, z) ||
      this.level.isBlocked(x - r, z) ||
      this.level.isBlocked(x, z + r) ||
      this.level.isBlocked(x, z - r) ||
      this.level.isBlocked(x + d, z + d) ||
      this.level.isBlocked(x - d, z + d) ||
      this.level.isBlocked(x + d, z - d) ||
      this.level.isBlocked(x - d, z - d)
    );
  }

  _updateHeadBob(dt) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);

    if (speed > 0.4 && this.grounded) {
      this.headBob += dt * speed * 2.1;
      this.stepDistance += speed * dt;

      const stride = this.crouching ? 3.2 : this.isSprinting ? 2.0 : 2.6;
      if (this.stepDistance >= stride) {
        this.stepDistance = 0;
        this.onStep();
      }
    } else {
      this.stepDistance = 0;
    }
  }

  _applyToCamera() {
    const amp = this.crouching ? 0.45 : 1;
    const bobY = Math.sin(this.headBob * 2) * 0.035 * amp;
    const bobX = Math.cos(this.headBob) * 0.018 * amp;

    this.camera.position.set(
      this.position.x + bobX,
      this.feetY + this.eyeHeight + bobY,
      this.position.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  teleportTo(vec) {
    this.position.set(vec.x, STAND_HEIGHT, vec.z);
    this.velocity.set(0, 0, 0);
    this.feetY = 0;
    this.verticalVelocity = 0;
    this.grounded = true;
  }

  get staminaPercent() {
    return this.stamina / MAX_STAMINA;
  }

  /** True when crouched inside a crack -- the monster can't see you here. */
  get isHidden() {
    return this.crouching && !!this.level.isHidingSpot?.(this.position.x, this.position.z);
  }

  getNetState() {
    return {
      x: +this.position.x.toFixed(2),
      z: +this.position.z.toFixed(2),
      y: +this.feetY.toFixed(2),
      yaw: +this.yaw.toFixed(2),
      crouch: this.crouching
    };
  }
}
