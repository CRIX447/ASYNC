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

  showStart({ missingAssets = 0, onStart }) {
    const o = this.el.overlay;
    o.innerHTML = `
      <h1>A-SYNC</h1>
      <h2>THE THRESHOLD</h2>
      <p>
        <span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> move
        &nbsp;·&nbsp; <span class="key">SHIFT</span> sprint<br>
        <span class="key">F</span> flashlight
        &nbsp;·&nbsp; <span class="key">E</span> interact
        &nbsp;·&nbsp; <span class="key">ESC</span> release mouse<br><br>
        Find three switches. Press them in the right order.<br>
        Stay in the light.
      </p>
      <button id="start-btn">ENTER</button>
      ${missingAssets ? `<p style="margin-top:26px;font-size:11px;opacity:0.35">
        ${missingAssets} asset${missingAssets === 1 ? '' : 's'} not found — using placeholders
      </p>` : ''}
    `;

    document.getElementById('start-btn').addEventListener('click', () => {
      o.classList.add('hidden');
      onStart();
    });
  }

  showMessage(title, body) {
    const o = this.el.overlay;
    o.innerHTML = `<h1 style="font-size:30px">${title}</h1><p>${body}</p>`;
    o.classList.remove('hidden');
  }

  setLoadingProgress(t) {
    const el = document.getElementById('loading');
    if (el) el.textContent = `LOADING ${Math.round(t * 100)}%`;
  }
}
