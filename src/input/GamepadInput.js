/**
 * Controller support via the browser Gamepad API. No library needed.
 *
 * Layout is the standard mapping every Xbox/PlayStation pad reports:
 *   left stick  move        right stick  look
 *   A / Cross   jump        B / Circle   crouch
 *   X / Square  interact    Y / Triangle flashlight
 *   L3          sprint      Start        pause
 *
 * A pad only appears to the browser AFTER you press a button on it, so if
 * nothing responds, press A first.
 */
const DEADZONE = 0.18;

export class GamepadInput {
  constructor() {
    this.connected = false;
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };

    this._prev = {};
    this._pressed = {};

    window.addEventListener('gamepadconnected', (e) => {
      this.connected = true;
      console.info('Gamepad connected:', e.gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.connected = false;
    });
  }

  /** Call once per frame, before reading anything. */
  poll() {
    const pads = navigator.getGamepads?.() || [];
    const pad = [...pads].find((p) => p && p.connected);

    if (!pad) {
      this.connected = false;
      this.move.x = this.move.y = this.look.x = this.look.y = 0;
      return;
    }

    this.connected = true;

    this.move.x = dz(pad.axes[0]);
    this.move.y = dz(pad.axes[1]);
    this.look.x = dz(pad.axes[2]);
    this.look.y = dz(pad.axes[3]);

    // Edge detection so a held button doesn't fire every frame.
    this._pressed = {};
    pad.buttons.forEach((b, i) => {
      const down = b.pressed || b.value > 0.5;
      if (down && !this._prev[i]) this._pressed[i] = true;
      this._prev[i] = down;
    });

    this.sprintHeld = this._held(10) || this._held(6); // L3 or LT
  }

  _held(i) {
    return !!this._prev[i];
  }

  /** True only on the frame the button went down. */
  justPressed(name) {
    const map = {
      jump: 0,      // A / Cross
      crouch: 1,    // B / Circle
      interact: 2,  // X / Square
      flashlight: 3,// Y / Triangle
      pause: 9      // Start
    };
    return !!this._pressed[map[name]];
  }
}

function dz(v = 0) {
  return Math.abs(v) < DEADZONE ? 0 : v;
}
