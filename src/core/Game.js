import * as THREE from 'three';

import { AssetManager } from './AssetManager.js';
import { LevelBuilder } from '../world/LevelBuilder.js';
import { LEVELS } from '../world/levels/index.js';
import { PlayerController } from '../player/PlayerController.js';
import { Flashlight } from '../player/Flashlight.js';
import { Monster } from '../entity/Monster.js';
import { Sanity } from '../systems/Sanity.js';
import { AudioManager } from '../systems/AudioManager.js';
import { AmbientEvents } from '../systems/AmbientEvents.js';
import { RemotePlayers } from '../net/RemotePlayers.js';
import { createSession, setSessionSequence } from '../net/Session.js';
import { PHOTON } from '../config/manifest.js';
import { VoiceChat } from '../net/VoiceChat.js';
import { VOICE } from '../config/manifest.js';
import { HUD } from '../ui/HUD.js';

const INTERACT_RANGE = 3.4;
const MAX_ACTIVE_LIGHTS = 10;
const RESPAWN_DELAY = 2.6;

export class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.running = false;
    this.levelIndex = 0;
    this.caught = false;
  }

  async init() {
    this.hud = new HUD();
    this._setupRenderer();
    this._setupScene();

    this.assets = new AssetManager();
    await this.assets.loadAll((t) => this.hud.setLoadingProgress(t * 0.7));

    this.builder = new LevelBuilder(this.scene, this.assets);

    this.audio = new AudioManager(this.camera);
    await this.audio.loadAll();
    this.hud.setLoadingProgress(0.9);

    this._buildLevel(0);

    this.flashlight = new Flashlight(this.camera);
    this.sanity = new Sanity(this.scene, this.camera, this.hud);
    this.sanity.onLowSanity = (low) => {
      if (low) this.audio.startLoop('heartbeat');
      else this.audio.stopLoop('heartbeat');
    };
    this.ambient = new AmbientEvents(this.audio);

    this.remotes = new RemotePlayers(this.scene, this.assets);
    this._bindInput();
    this.hud.setLoadingProgress(1);

    this.hud.showStart({
      missingAssets: this.assets.missing.length,
      defaultRoom: PHOTON.defaultRoom,
      onStart: (mode, url) => this.start(mode, url)
    });

    this._startMenuScene();
    window.addEventListener('resize', () => this._onResize());
  }

  // ------------------------------------------------------------------- setup

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
    this.scene.fog = new THREE.FogExp2(0x0a0a08, 0.036);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 200);
    this.scene.add(this.camera);
    this.scene.add(new THREE.AmbientLight(0x312a18, 0.55));
  }

  // ------------------------------------------------------------ level loading

  _buildLevel(index) {
    this.levelIndex = index;
    const def = LEVELS[index];

    this.level?.dispose?.();
    this.monster?.dispose?.();

    this.level = this.builder.build(def);

    if (this.player) {
      this.player.level = this.level;
      this.player.teleportTo(this.level.spawn);
    } else {
      this.player = new PlayerController(this.camera, this.renderer.domElement, this.level);
      this.player.onStep = () => this.audio.playFootstep();
      this.player.onJump = () => this.audio.play('jump');
      this.player.onLand = () => this.audio.play('land');
      this.player.onInteract = () => this._tryInteract();
      this.player.onToggleLight = () => this._toggleLight();
    }

    if (this.level.monsterSpawn) {
      this.monster = new Monster(this.scene, this.level, this.assets, this.audio);
      this.monster.onCatch = () => this._onCaught();
      if (this.running) this.audio.startLoop('monster_idle');
    } else {
      this.monster = null;
    }

    this.hud.setSequenceLength(def.sequence.length);
    this.hud.setLevelName(def.name);
    if (this.session) setSessionSequence(this.session, def.sequence);

    this.sanity?.reset?.();
    this.caught = false;
  }

  _advanceLevel() {
    const next = this.levelIndex + 1;

    if (next >= LEVELS.length) {
      this.running = false;
      document.exitPointerLock();
      this.hud.showMessage(
        'YOU ESCAPED',
        'You wake up in the A-SYNC testing chamber.<br>They tell you that you were missing for six minutes.<br><br>Then your radio turns on.'
      );
      return;
    }

    this.session.nextLevel(next);
    this._buildLevel(next);
    this.audio.play('door');
  }

  // ------------------------------------------------------------------- input

  _bindInput() {
    document.addEventListener('keydown', (e) => {
      if (!this.running) return;
      if (e.code === 'KeyF') this._toggleLight();
      if (e.code === 'KeyE') this._tryInteract();
      if (e.code === VOICE.pushToTalkKey && this.voice) {
        if (!this.voice.enabled) this.voice.enable();
        else this.voice.setTalking(true);
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === VOICE.pushToTalkKey) this.voice?.setTalking(false);
    });

    this.renderer.domElement.addEventListener('click', () => {
      if (this.running && !this.player.locked) this.player.requestLock();
    });
  }

  _toggleLight() {
    if (this.flashlight.toggle()) this.audio.play('click', { volumeScale: 0.6 });
  }

  _tryInteract() {
    const target = this._raycastInteractable();
    if (!target) return;

    if (target.userData.type === 'switch') {
      const sw = this.level.switches.find((s) => s.id === target.userData.id);
      if (sw?.active) return;
      this.session.pressSwitch(target.userData.id);
    }
  }

  _raycastInteractable() {
    if (!this._ray) this._ray = new THREE.Raycaster();
    this._ray.far = INTERACT_RANGE;
    this._ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this._ray.intersectObjects(this.level.interactables, false);
    return hits.length ? hits[0].object : null;
  }

  // ----------------------------------------------------------------- session

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
      this.level.switches.forEach((sw) => { sw.setActive(false); sw.flashError(); });
      this.audio.play('error');
      this._shake(0.35);
    });

    this.session.on('exit', () => {
      this.level.openExit();
      this.audio.play('door');
      this.hud.setPrompt('');
    });

    // Someone else reached the exit first.
    this.session.on('level', ({ index }) => {
      if (index !== this.levelIndex) this._buildLevel(index);
    });
  }

  // -------------------------------------------------------------- jumpscare

  _onCaught() {
    if (this.caught) return;
    this.caught = true;

    this.player.frozen = true;
    this.audio.play('jumpscare');
    this.monster?.screamAtPlayer?.();
    this.audio.stopLoop('monster_chase');
    this.audio.stopLoop('breathe');
    this._wasExhausted = false;
    this.hud.fireJumpscare();

    // Snap the camera onto the thing's face. Cheap, and it works.
    if (this.monster) {
      const m = this.monster.group.position;
      const dx = m.x - this.player.position.x;
      const dz = m.z - this.player.position.z;
      this.player.yaw = Math.atan2(-dx, -dz) + Math.PI;
      this.player.pitch = 0.1;
      this.monster.group.position.set(
        this.player.position.x + Math.sin(this.player.yaw) * -0.9,
        0,
        this.player.position.z + Math.cos(this.player.yaw) * -0.9
      );
      this.monster.group.rotation.y = this.player.yaw + Math.PI;
    }

    this._shake(0.9);
    this._respawnTimer = RESPAWN_DELAY;
  }

  _respawn() {
    this.hud.clearJumpscare();
    this.player.frozen = false;
    this.player.teleportTo(this.level.spawn);
    this.player.stamina = 60;
    this.sanity.value = Math.max(20, this.sanity.value - 30);
    this._buildMonsterFresh();
    this.caught = false;
  }

  _buildMonsterFresh() {
    this.monster?.dispose?.();
    if (!this.level.monsterSpawn) { this.monster = null; return; }
    this.monster = new Monster(this.scene, this.level, this.assets, this.audio);
    this.monster.onCatch = () => this._onCaught();
    this.audio.startLoop('monster_idle');
  }

  // ---------------------------------------------------------------- menu

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

  // -------------------------------------------------------------- gameplay

  /**
   * Called from the menu. Returns false if 'online' was chosen and the server
   * couldn't be reached, so the menu can stay up and report it.
   */
  async start(mode = 'solo', arg = null) {
    const session = await createSession(LEVELS[this.levelIndex].sequence, mode, arg);
    if (!session || session.failed) {
      return { ok: false, error: session?.error || 'CONNECTION FAILED' };
    }

    this.session = session;
    this.voice = new VoiceChat(session);
    this.voice.onStatus = (s) => this.hud.setVoice(s);
    this.hud.setVoice({ enabled: false });
    this._wireSession();
    setSessionSequence(session, LEVELS[this.levelIndex].sequence);

    this._menuActive = false;
    this.running = true;

    this.audio.resume();
    this.audio.stopLoop('menu');
    this.audio.startLoop('hum');
    this.audio.startLoop('drone');
    if (this.monster) this.audio.startLoop('monster_idle');

    this.player.teleportTo(this.level.spawn);
    this.player.requestLock();
    this.clock.start();
    this._loop();
    return { ok: true };
  }

  _updateLights(dt) {
    const p = this.player?.position || this.camera.position;

    const sorted = this.level.lights
      .map((l) => ({ l, d: (l.position.x - p.x) ** 2 + (l.position.z - p.z) ** 2 }))
      .sort((a, b) => a.d - b.d);

    sorted.forEach(({ l }, i) => {
      const active = i < MAX_ACTIVE_LIGHTS;
      l.light.visible = active;
      if (!active) return;

      l.flickerPhase += dt * l.flickerRate;
      const n = Math.sin(l.flickerPhase * 3.1) * Math.sin(l.flickerPhase * 7.7);
      const dip = n < -0.72 ? 0.15 : 1;
      const wobble = 0.94 + Math.sin(l.flickerPhase * 21) * 0.06;

      l.light.intensity = l.baseIntensity * dip * wobble;
      l.panel.material.emissiveIntensity = 2.4 * dip * wobble;
    });
  }

  _checkExit() {
    if (!this.level.exit?.opened) return;
    const p = this.player.position;
    const e = this.level.exit.mesh.position;
    if (Math.hypot(e.x - p.x, e.z - p.z) < 1.5) this._advanceLevel();
  }

  _shake(amount) {
    this._shakeAmount = amount;
  }

  /**
   * Heavy breathing while exhausted, and a one-off scuff when you squeeze
   * into a crack. Both are edge-triggered so they don't retrigger every frame.
   */
  _updatePlayerAudio() {
    const exhausted = this.player.exhausted;
    if (exhausted !== this._wasExhausted) {
      this._wasExhausted = exhausted;
      if (exhausted) this.audio.startLoop('breathe');
      else this.audio.stopLoop('breathe');
    }

    const hidden = this.player.isHidden;
    if (hidden !== this._wasHidden) {
      this._wasHidden = hidden;
      if (hidden) this.audio.play('hide_in');
    }
  }

  _loop() {
    requestAnimationFrame(() => this._loop());

    if (!this.running) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.caught) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) this._respawn();
    }

    this.player.update(dt);
    this.flashlight.update(dt);
    this._updateLights(dt);

    if (this.monster && !this.caught) this.monster.update(dt, this.player);

    this.sanity.update(dt, this.player.position, this.flashlight.on, this.level.lights);
    this.level.exit?.update(dt);
    this._checkExit();

    this.hud.setStamina(this.player.staminaPercent, this.player.exhausted);
    this._updatePlayerAudio();

    // Hiding shows a different prompt than the generic look-at prompt.
    const target = this._raycastInteractable();
    if (this.player.isHidden) this.hud.setPrompt('HIDDEN');
    else this.hud.setPrompt(target ? target.userData.prompt : '');

    this.session.sendMove({ ...this.player.getNetState(), light: this.flashlight.on }, dt);
    this.remotes.update(dt);
    this.voice?.updateProximity(this.player.position, this.remotes.avatars);

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
