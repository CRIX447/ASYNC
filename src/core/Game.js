import * as THREE from 'three';

import { AssetManager } from './AssetManager.js';
import { LevelBuilder } from '../world/LevelBuilder.js';
import { PlayerController } from '../player/PlayerController.js';
import { Flashlight } from '../player/Flashlight.js';
import { Sanity } from '../systems/Sanity.js';
import { AudioManager } from '../systems/AudioManager.js';
import { AmbientEvents } from '../systems/AmbientEvents.js';
import { RemotePlayers } from '../net/RemotePlayers.js';
import { createSession } from '../net/Session.js';
import { HUD } from '../ui/HUD.js';

const INTERACT_RANGE = 3.4;
const PICKUP_RANGE = 1.3;
const MAX_ACTIVE_LIGHTS = 10;

export class Game {
  constructor(levelData) {
    this.levelData = levelData;
    this.clock = new THREE.Clock();
    this.running = false;
    this.won = false;
  }

  async init() {
    this.hud = new HUD();

    this._setupRenderer();
    this._setupScene();

    // ---- assets -----------------------------------------------------------
    this.assets = new AssetManager();
    await this.assets.loadAll((t) => this.hud.setLoadingProgress(t * 0.7));

    // ---- world ------------------------------------------------------------
    this.level = new LevelBuilder(this.scene, this.assets).build(this.levelData);
    this.hud.setSequenceLength(this.levelData.sequence.length);

    // ---- player -----------------------------------------------------------
    this.player = new PlayerController(this.camera, this.renderer.domElement, this.level);
    this.flashlight = new Flashlight(this.camera);
    this.flashlight.onChange = (charge) => this.hud.setBattery(charge / 100);
    this.hud.setBattery(1);

    this.sanity = new Sanity(this.scene, this.camera, this.hud);

    // ---- audio ------------------------------------------------------------
    this.audio = new AudioManager(this.camera);
    await this.audio.loadAll();
    this.hud.setLoadingProgress(0.85);

    this.ambient = new AmbientEvents(this.audio);
    this.player.onStep = () => this.audio.playFootstep();
    this.sanity.onLowSanity = (low) => {
      if (low) this.audio.startLoop('heartbeat');
      else this.audio.stopLoop('heartbeat');
    };

    // ---- multiplayer ------------------------------------------------------
    this.remotes = new RemotePlayers(this.scene, this.assets);
    this.session = await createSession(this.levelData.sequence);
    this._wireSession();
    this.hud.setLoadingProgress(1);

    // ---- input ------------------------------------------------------------
    this._bindInput();

    this.hud.showStart({
      missingAssets: this.assets.missing.length,
      onStart: () => this.start()
    });

    this._startMenuScene();

    window.addEventListener('resize', () => this._onResize());
  }

  // ---------------------------------------------------------------- setup

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    document.body.appendChild(this.renderer.domElement);
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07070a);
    // Exponential fog is what makes hallways feel like they never end.
    this.scene.fog = new THREE.FogExp2(0x0a0a08, 0.036);

    this.camera = new THREE.PerspectiveCamera(
      72, window.innerWidth / window.innerHeight, 0.1, 200
    );
    this.scene.add(this.camera);

    // A whisper of ambient so unlit areas are murky rather than pure black.
    this.scene.add(new THREE.AmbientLight(0x312a18, 0.55));
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => {
      if (!this.running) return;

      if (e.code === 'KeyF') {
        if (this.flashlight.toggle()) this.audio.play('click', { volumeScale: 0.6 });
      }
      if (e.code === 'KeyE') this._tryInteract();
    });

    this.renderer.domElement.addEventListener('click', () => {
      if (this.running && !this.player.locked) this.player.requestLock();
    });
  }

  _wireSession() {
    this.session.on('status', (s) => this.hud.setNetState(s));

    this.session.on('players', ({ list }) => this.remotes.sync(list));

    this.session.on('progress', ({ active }) => {
      this.hud.setProgress(active.length);
      this.level.switches.forEach((sw) => sw.setActive(active.includes(sw.id)));
      this.audio.play('click');
    });

    this.session.on('reset', () => {
      this.hud.setProgress(0);
      this.level.switches.forEach((sw) => sw.setActive(false));
      this.audio.play('error');
      this._shake(0.35);
    });

    this.session.on('exit', () => {
      this.level.openExit();
      this.audio.play('door');
      this.hud.setPrompt('');
    });

    this.session.on('battery', ({ index }) => {
      const b = this.level.batteries[index];
      if (!b || b.collected) return;
      b.collected = true;
      b.mesh.visible = false;
    });
  }

  // ---------------------------------------------------------------- menu

  /**
   * The menu isn't a static image -- it's the real level, lit and flickering,
   * with the camera drifting through it. Costs almost nothing because the
   * scene is already built, and it does more for first impressions than any
   * amount of CSS.
   */
  _startMenuScene() {
    const spawn = this.level.spawn;

    this.camera.position.set(spawn.x, 1.75, spawn.z);
    this._menuTime = 0;
    this._menuActive = true;

    this.audio.startLoop('menu');

    const tick = () => {
      if (!this._menuActive) return;
      requestAnimationFrame(tick);

      const dt = Math.min(this.clock.getDelta(), 0.05);
      this._menuTime += dt;
      const t = this._menuTime;

      // Slow arc plus a breathing drift, so it never looks frozen.
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = Math.sin(t * 0.085) * 0.85 + 0.6;
      this.camera.rotation.x = Math.sin(t * 0.13) * 0.045 - 0.03;
      this.camera.position.y = 1.75 + Math.sin(t * 0.4) * 0.035;
      this.camera.position.x = spawn.x + Math.sin(t * 0.11) * 0.6;
      this.camera.position.z = spawn.z + Math.cos(t * 0.09) * 0.5;

      this._updateLights(dt);
      this.renderer.render(this.scene, this.camera);
    };

    this.clock.start();
    tick();
  }

  // ---------------------------------------------------------------- gameplay

  start() {
    this._menuActive = false;
    this.running = true;

    this.audio.resume();
    this.audio.stopLoop('menu');
    this.audio.startLoop('hum');
    this.audio.startLoop('drone');
    this.player.requestLock();
    this.clock.start();
    this._loop();
  }

  _tryInteract() {
    const target = this._raycastInteractable();
    if (!target) return;

    const { type, id } = target.userData;
    if (type === 'switch') {
      const sw = this.level.switches.find((s) => s.id === id);
      if (sw?.active) return;
      this.session.pressSwitch(id);
    }
  }

  _raycastInteractable() {
    if (!this._ray) this._ray = new THREE.Raycaster();
    this._ray.far = INTERACT_RANGE;
    this._ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const hits = this._ray.intersectObjects(this.level.interactables, false);
    return hits.length ? hits[0].object : null;
  }

  _checkPickups() {
    const p = this.player.position;

    this.level.batteries.forEach((b, i) => {
      if (b.collected) return;
      const dx = b.mesh.position.x - p.x;
      const dz = b.mesh.position.z - p.z;
      if (dx * dx + dz * dz > PICKUP_RANGE * PICKUP_RANGE) return;

      if (this.flashlight.addCharge(45)) {
        this.audio.play('pickup');
        this.session.collectBattery(i);
        b.collected = true;
        b.mesh.visible = false;
      }
    });
  }

  _checkWin() {
    if (this.won || !this.level.exit?.opened) return;

    const p = this.player.position;
    const e = this.level.exit.mesh.position;
    const dist = Math.hypot(e.x - p.x, e.z - p.z);

    if (dist < 2.2) {
      this.won = true;
      this.running = false;
      document.exitPointerLock();
      this.hud.showMessage(
        'YOU ESCAPED',
        'The door closes behind you.<br><br>Level 1 is not built yet.<br>That part is up to you.'
      );
    }
  }

  /**
   * Only the nearest handful of point lights stay enabled. WebGL gets slow
   * fast with many real lights, and you can't see the far ones anyway.
   */
  _updateLights(dt) {
    const p = this.player.position;

    const sorted = this.level.lights
      .map((l) => ({ l, d: (l.position.x - p.x) ** 2 + (l.position.z - p.z) ** 2 }))
      .sort((a, b) => a.d - b.d);

    sorted.forEach(({ l }, i) => {
      const active = i < MAX_ACTIVE_LIGHTS;
      l.light.visible = active;
      if (!active) return;

      // Sick fluorescent stutter. Mostly steady, occasionally not.
      l.flickerPhase += dt * l.flickerRate;
      const n = Math.sin(l.flickerPhase * 3.1) * Math.sin(l.flickerPhase * 7.7);
      const dip = n < -0.72 ? 0.15 : 1;
      const wobble = 0.94 + Math.sin(l.flickerPhase * 21) * 0.06;

      l.light.intensity = l.baseIntensity * dip * wobble;
      l.panel.material.emissiveIntensity = 2.4 * dip * wobble;
    });
  }

  _shake(amount) {
    this._shakeAmount = amount;
  }

  // ---------------------------------------------------------------- loop

  _loop() {
    requestAnimationFrame(() => this._loop());
    if (!this.running) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Cap dt so an alt-tab doesn't teleport the player through a wall.
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.player.update(dt);
    this.flashlight.update(dt);
    this._updateLights(dt);
    this.sanity.update(dt, this.player.position, this.flashlight.on, this.level.lights);

    this.level.exit?.update(dt);
    this._checkPickups();
    this._checkWin();

    // Look-at prompt.
    const target = this._raycastInteractable();
    this.hud.setPrompt(target ? target.userData.prompt : '');

    // Networking.
    this.session.sendMove(
      { ...this.player.getNetState(), light: this.flashlight.on },
      dt
    );
    this.remotes.update(dt);

    // Impact shake decay.
    if (this._shakeAmount > 0.001) {
      this._shakeAmount *= Math.max(0, 1 - dt * 4);
      this.camera.position.x += (Math.random() - 0.5) * this._shakeAmount;
      this.camera.position.y += (Math.random() - 0.5) * this._shakeAmount;
    }

    this.ambient.update(dt, this.sanity.value);
    this.audio.setLoopVolume('hum', this.sanity.inLight ? 0.28 : 0.14);

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
