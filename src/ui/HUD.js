/** Thin wrapper over the DOM overlay in index.html. No framework needed. */
export class HUD {
  constructor() {
    this.el = {
      crosshair: document.getElementById('crosshair'),
      prompt: document.getElementById('prompt'),
      batteryFill: document.getElementById('battery-fill'),
      switches: document.getElementById('switch-progress'),
      netstate: document.getElementById('netstate'),
      vignette: document.getElementById('vignette'),
      grain: document.getElementById('grain'),
      overlay: document.getElementById('overlay')
    };
    this._prompt = '';
    this._sequenceLength = 3;
  }

  setPrompt(text) {
    if (text === this._prompt) return;
    this._prompt = text;

    this.el.prompt.textContent = text || '';
    this.el.prompt.classList.toggle('show', !!text);
    this.el.crosshair.classList.toggle('active', !!text);
  }

  setBattery(percent) {
    this.el.batteryFill.style.width = `${Math.max(0, percent * 100).toFixed(1)}%`;
    this.el.batteryFill.classList.toggle('low', percent < 0.25);
  }

  setSequenceLength(n) {
    this._sequenceLength = n;
    this.setProgress(0);
  }

  setProgress(count) {
    const filled = '\u25A0'.repeat(count);
    const empty = '\u25A1'.repeat(Math.max(0, this._sequenceLength - count));
    this.el.switches.textContent = filled + empty;
  }

  setSanity(value) {
    const t = 1 - value / 100;
    this.el.vignette.style.opacity = (t * 0.95).toFixed(2);
    this.el.grain.style.opacity = (t * 0.22).toFixed(3);
  }

  setNetState({ online, players }) {
    this.el.netstate.innerHTML = online
      ? `<div>ONLINE</div><div>${players} IN SESSION</div>`
      : `<div>OFFLINE</div><div>SOLO</div>`;
  }

  setLoadingProgress(t) {
    const fill = document.getElementById('load-fill');
    const label = document.getElementById('loading');
    if (fill) fill.style.width = `${Math.round(t * 100)}%`;
    if (label) label.textContent = t >= 1 ? 'READY' : 'LOADING';
  }

  showStart({ missingAssets = 0, onStart }) {
    const o = this.el.overlay;

    o.innerHTML = `
      <div class="menu-inner">
        <div class="title-block">
          <h1 data-text="A-SYNC">A-SYNC</h1>
        </div>
        <h2>THE THRESHOLD</h2>
        <div class="rule"></div>

        <p class="brief">
          The exit is sealed behind three switches.<br>
          Find them. Press them in the right order.<br>
          Stay in the light.
        </p>

        <div class="controls">
          <span><b class="key">W</b><b class="key">A</b><b class="key">S</b><b class="key">D</b> MOVE</span>
          <span><b class="key">SHIFT</b> SPRINT</span>
          <span><b class="key">F</b> FLASHLIGHT</span>
          <span><b class="key">E</b> INTERACT</span>
          <span><b class="key">ESC</b> RELEASE MOUSE</span>
        </div>

        <button id="start-btn"><span>ENTER</span></button>

        ${
          missingAssets
            ? `<div class="footnote">${missingAssets} ASSET${
                missingAssets === 1 ? '' : 'S'
              } MISSING — USING PLACEHOLDERS</div>`
            : ''
        }
      </div>
    `;

    document.getElementById('start-btn').addEventListener('click', () => {
      o.classList.add('hidden');
      onStart();
    });
  }

  showMessage(title, body) {
    const o = this.el.overlay;
    o.innerHTML = `
      <div class="menu-inner">
        <div class="title-block">
          <h1 data-text="${title}" style="font-size:clamp(26px,5vw,46px)">${title}</h1>
        </div>
        <div class="rule"></div>
        <p class="brief">${body}</p>
      </div>
    `;
    o.classList.remove('hidden');
  }
}
