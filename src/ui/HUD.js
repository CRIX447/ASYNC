/** Thin wrapper over the DOM overlay in index.html. No framework needed. */
export class HUD {
  constructor() {
    this.el = {
      crosshair: document.getElementById('crosshair'),
      prompt: document.getElementById('prompt'),
      staminaFill: document.getElementById('battery-fill'),
      staminaLabel: document.getElementById('battery-label'),
      voice: document.getElementById('voice-state'),
      scare: document.getElementById('scare'),
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

  setStamina(percent, exhausted) {
    this.el.staminaFill.style.width = `${Math.max(0, percent * 100).toFixed(1)}%`;
    this.el.staminaFill.classList.toggle('low', percent < 0.35 && !exhausted);
    this.el.staminaFill.classList.toggle('exhausted', !!exhausted);
    this.el.staminaLabel.textContent = exhausted ? 'EXHAUSTED' : 'STAMINA';
  }

  setVoice({ enabled, talking, error }) {
    if (error) { this.el.voice.textContent = error; return; }
    if (!enabled) { this.el.voice.textContent = 'V — ENABLE VOICE'; }
    else this.el.voice.textContent = talking ? '● TRANSMITTING' : 'HOLD V TO TALK';
    this.el.voice.classList.toggle('talking', !!talking);
  }

  fireJumpscare() {
    this.el.scare.classList.remove('fire');
    void this.el.scare.offsetWidth; // force reflow so the animation restarts
    this.el.scare.classList.add('fire');
  }

  clearJumpscare() {
    this.el.scare.classList.remove('fire');
    this.el.scare.style.opacity = 0;
  }

  setLevelName(name) {
    const el = document.querySelector('#objective div');
    if (el) el.textContent = name.toUpperCase();
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

  /**
   * Main menu with SINGLEPLAYER / MULTIPLAYER tabs.
   * onStart is called with ('solo') or ('online', serverUrl).
   */
  showStart({ missingAssets = 0, defaultServer = '', onStart }) {
    const o = this.el.overlay;

    o.innerHTML = `
      <div class="menu-inner">
        <div class="title-block">
          <h1 data-text="A-SYNC">A-SYNC</h1>
        </div>
        <h2>THE THRESHOLD</h2>

        <div class="tabs">
          <button class="tab active" data-tab="solo">SINGLEPLAYER</button>
          <button class="tab" data-tab="online">MULTIPLAYER</button>
        </div>

        <div class="panel active" data-panel="solo">
          <p class="brief">
            The exit is sealed behind three switches.<br>
            Find them. Press them in the right order.<br>
            Something else is down here with you.<br>
            Crouch into the cracks in the walls. It can't reach you there.
          </p>

          <div class="controls">
            <span><b class="key">W</b><b class="key">A</b><b class="key">S</b><b class="key">D</b> MOVE</span>
            <span><b class="key">SHIFT</b> SPRINT</span>
            <span><b class="key">CTRL</b> CROUCH</span>
            <span><b class="key">SPACE</b> JUMP</span>
            <span><b class="key">F</b> FLASHLIGHT</span>
            <span><b class="key">E</b> INTERACT</span>
          </div>

          <button class="btn" id="start-solo"><span>ENTER ALONE</span></button>
          <div class="status">NO SERVER NEEDED</div>
        </div>

        <div class="panel" data-panel="online">
          <p class="brief">
            Same descent, but you can hear each other.<br>
            Voice is push-to-talk on <b class="key">V</b> and fades with distance.
          </p>

          <div class="field">
            <label>SERVER ADDRESS</label>
            <input id="server-url" type="text" value="${defaultServer}" spellcheck="false" />
          </div>

          <button class="btn" id="start-online"><span>CONNECT</span></button>
          <div class="status" id="net-status">RUN <b class="key">npm run server</b> FIRST</div>
        </div>

        ${missingAssets ? `<div class="footnote">${missingAssets} ASSET${missingAssets === 1 ? '' : 'S'} MISSING — USING PLACEHOLDERS</div>` : ''}
      </div>
    `;

    // Tab switching.
    const tabs = o.querySelectorAll('.tab');
    const panels = o.querySelectorAll('.panel');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        panels.forEach((pn) =>
          pn.classList.toggle('active', pn.dataset.panel === tab.dataset.tab)
        );
      });
    });

    document.getElementById('start-solo').addEventListener('click', () => {
      o.classList.add('hidden');
      onStart('solo');
    });

    const online = document.getElementById('start-online');
    const input = document.getElementById('server-url');
    const status = document.getElementById('net-status');

    online.addEventListener('click', async () => {
      status.className = 'status';
      status.textContent = 'CONNECTING…';
      online.disabled = true;

      const ok = await onStart('online', input.value.trim());

      if (ok) {
        o.classList.add('hidden');
      } else {
        // Stay on the menu and say why, rather than dumping them into a
        // silently-offline game and letting them wonder where everyone is.
        online.disabled = false;
        status.className = 'status err';
        status.textContent = 'COULD NOT REACH SERVER';
      }
    });

    // Enter key in the address field connects.
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') online.click();
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
