import { SERVER_URL } from '..import { PHOTON } from '../config/manifest.js';

/**
 * Photon Cloud session.
 *
 * Implements the same interface as LocalSession / NetworkSession, so Game.js
 * has no idea which one it's using. No server to run, no server to deploy --
 * Photon Cloud hosts the rooms.
 *
 * Authority model: Photon designates one actor in each room as the "master
 * client". That actor validates the switch puzzle and broadcasts the result,
 * exactly like the Node server used to. If they leave, Photon promotes someone
 * else automatically and the game carries on.
 *
 * Voice chat piggybacks on this too: WebRTC signalling is sent as Photon
 * events, so VoiceChat.js works unchanged and audio still goes peer-to-peer.
 */

// Event codes. Photon lets games use 0-199.
const EV_MOVE     = 1;
const EV_SWITCH   = 2;  // non-master asks master to validate a press
const EV_PROGRESS = 3;
const EV_RESET    = 4;
const EV_EXIT     = 5;
const EV_LEVEL    = 6;
const EV_SYNC     = 7;  // master catches a late joiner up
const EV_VOICE    = 8;

let sdkPromise = null;

/** Loads the Photon SDK from public/vendor/ once, on demand. */
function loadPhotonSDK() {
  if (window.Photon) return Promise.resolve(window.Photon);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = PHOTON.sdkPath;
    el.onload = () =>
      window.Photon
        ? resolve(window.Photon)
        : reject(new Error('Photon SDK loaded but window.Photon is undefined'));
    el.onerror = () =>
      reject(new Error(`Photon SDK not found at ${PHOTON.sdkPath}. See public/vendor/README.txt`));
    document.head.appendChild(el);
  });

  return sdkPromise;
}

export class PhotonSession {
  constructor(sequence, roomCode) {
    this._handlers = {};
    this.sequence = [...sequence];
    this.roomCode = (roomCode || PHOTON.defaultRoom).trim().toUpperCase();

    this.online = false;
    this.progress = [];
    this.exitOpen = false;
    this.level = 0;

    this.players = new Map();  // actorNr -> latest transform
    this._moveTimer = 0;
    this.lastError = null;
  }

  on(event, fn) {
    (this._handlers[event] ||= []).push(fn);
    return this;
  }

  emit(event, payload) {
    (this._handlers[event] || []).forEach((fn) => fn(payload));
  }

  // ------------------------------------------------------------------ connect

  async connect(timeoutMs = 15000) {
    if (!PHOTON.appId || PHOTON.appId.startsWith('PASTE')) {
      this.lastError = 'NO APP ID — SEE src/config/manifest.js';
      return this;
    }

    let Photon;
    try {
      Photon = await loadPhotonSDK();
    } catch (err) {
      this.lastError = 'SDK MISSING — SEE public/vendor/';
      console.error(err);
      return this;
    }

    const LB = Photon.LoadBalancing;
    const self = this;

    this.client = new LB.LoadBalancingClient(
      Photon.ConnectionProtocol.Wss,   // always secure, so it works on HTTPS
      PHOTON.appId,
      PHOTON.appVersion
    );

    this.client.setLogLevel(Photon.LogLevel.ERROR);

    return new Promise((resolve) => {
      let settled = false;

      const finish = (ok, err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.online = ok;
        if (err) this.lastError = err;
        resolve(this);
      };

      const timer = setTimeout(() => finish(false, 'TIMED OUT'), timeoutMs);

      this.client.onStateChange = function (state) {
        const S = LB.LoadBalancingClient.State;

        // Lobby reached -> join the room by code, creating it if nobody's there.
        if (state === S.JoinedLobby) {
          this.joinRoom(self.roomCode, { createIfNotExists: true }, { maxPlayers: PHOTON.maxPlayers });
        }

        if (state === S.Disconnected) {
          self.online = false;
          self.players.clear();
          self.emit('status', { online: false, players: 1 });
        }
      };

      this.client.onJoinRoom = function () {
        self.online = true;
        self._emitStatus();
        finish(true);
      };

      this.client.onError = function (code, msg) {
        console.error('Photon error', code, msg);
        finish(false, String(msg || 'CONNECTION FAILED').toUpperCase());
      };

      this.client.onActorJoin = function (actor) {
        self._emitStatus();
        // Master catches the new arrival up on everything they missed.
        if (self.isMaster() && actor.actorNr !== self.myNr()) {
          self._raise(EV_SYNC, {
            level: self.level,
            progress: self.progress,
            exitOpen: self.exitOpen
          }, [actor.actorNr]);
        }
      };

      this.client.onActorLeave = function (actor) {
        self.players.delete(actor.actorNr);
        self.emit('voice-leave', { id: actor.actorNr });
        self.emit('players', { list: [...self.players.values()] });
        self._emitStatus();
      };

      this.client.onEvent = function (code, content, actorNr) {
        self._onEvent(code, content, actorNr);
      };

      this.client.connectToRegionMaster(PHOTON.region);
    });
  }

  // ------------------------------------------------------------------- events

  _onEvent(code, content, actorNr) {
    switch (code) {
      case EV_MOVE:
        this.players.set(actorNr, { id: actorNr, ...content });
        this.emit('players', { list: [...this.players.values()] });
        break;

      // Only the master acts on these.
      case EV_SWITCH:
        if (this.isMaster()) this._validateSwitch(content.id);
        break;

      case EV_PROGRESS:
        this.progress = content.active;
        this.emit('progress', { active: content.active, total: this.sequence.length });
        break;

      case EV_RESET:
        this.progress = [];
        this.emit('reset', {});
        break;

      case EV_EXIT:
        this.exitOpen = true;
        this.emit('exit', {});
        break;

      case EV_LEVEL:
        this.level = content.index;
        this.progress = [];
        this.exitOpen = false;
        this.emit('level', { index: content.index });
        break;

      case EV_SYNC:
        this.level = content.level;
        this.progress = content.progress || [];
        this.exitOpen = !!content.exitOpen;
        if (content.level) this.emit('level', { index: content.level });
        if (this.progress.length) {
          this.emit('progress', { active: this.progress, total: this.sequence.length });
        }
        if (this.exitOpen) this.emit('exit', {});
        break;

      // WebRTC signalling relayed as a Photon event.
      case EV_VOICE:
        this._onVoiceEvent(content, actorNr);
        break;
    }
  }

  _onVoiceEvent(msg, actorNr) {
    if (msg.t === 'voice-join') {
      // Tell the newcomer about me, and me about them. Lower actor number
      // initiates, so exactly one side creates the offer.
      const iInitiate = this.myNr() < actorNr;
      this.emit('voice-peer', { id: actorNr, initiator: iInitiate });
    } else if (msg.t === 'voice-signal' && msg.to === this.myNr()) {
      this.emit('voice-signal', { from: actorNr, data: msg.data });
    } else if (msg.t === 'voice-leave') {
      this.emit('voice-leave', { id: actorNr });
    }
  }

  // ------------------------------------------------------------------ actions

  pressSwitch(id) {
    if (this.isMaster()) this._validateSwitch(id);
    else this._raise(EV_SWITCH, { id }, [this.masterNr()]);
  }

  /** Master-only. The single source of truth for the puzzle. */
  _validateSwitch(id) {
    if (this.exitOpen || !Number.isInteger(id)) return;
    if (this.progress.includes(id)) return;

    const step = this.progress.length;

    if (this.sequence[step] !== id) {
      this.progress = [];
      this._raise(EV_RESET, {});
      this.emit('reset', {});
      return;
    }

    this.progress.push(id);
    const active = [...this.progress];
    this._raise(EV_PROGRESS, { active });
    this.emit('progress', { active, total: this.sequence.length });

    if (this.progress.length === this.sequence.length) {
      this.exitOpen = true;
      this._raise(EV_EXIT, {});
      this.emit('exit', {});
    }
  }

  nextLevel(index) {
    this.level = index;
    this.progress = [];
    this.exitOpen = false;
    this._raise(EV_LEVEL, { index });
  }

  setSequence(sequence) {
    this.sequence = [...sequence];
    this.progress = [];
    this.exitOpen = false;
  }

  /** Throttled to ~15 Hz. Sending every frame is pure waste. */
  sendMove(state, dt) {
    if (!this.online) return;
    this._moveTimer += dt;
    if (this._moveTimer < 1 / 15) return;
    this._moveTimer = 0;
    this._raise(EV_MOVE, state);
  }

  /** Used by VoiceChat, which doesn't know Photon exists. */
  send(obj) {
    if (!this.online) return;
    if (obj.t === 'voice-signal') this._raise(EV_VOICE, obj, [obj.to]);
    else this._raise(EV_VOICE, obj);
  }

  // ------------------------------------------------------------------ helpers

  myNr() {
    return this.client?.myActor()?.actorNr ?? -1;
  }

  masterNr() {
    return this.client?.myRoomMasterActorNr?.() ?? -1;
  }

  isMaster() {
    return this.online && this.myNr() === this.masterNr();
  }

  _raise(code, data, targetActors = null) {
    if (!this.client || !this.online) return;
    const options = targetActors ? { targetActors } : {};
    this.client.raiseEvent(code, data, options);
  }

  _emitStatus() {
    this.emit('status', {
      online: this.online,
      players: this.client?.myRoomActorCount?.() ?? 1,
      room: this.roomCode
    });
  }

  disconnect() {
    this.send({ t: 'voice-leave' });
    this.client?.disconnect();
    this.online = false;
  }
}config/manifest.js';

/**
 * The game talks to a "session" and never cares whether a server exists.
 *
 * LocalSession runs the same authoritative rules in the browser, so the game
 * is fully playable solo with no server running. NetworkSession forwards the
 * same calls over a WebSocket. Both emit identical events.
 */
class BaseSession {
  constructor() {
    this._handlers = {};
  }

  on(event, fn) {
    (this._handlers[event] ||= []).push(fn);
    return this;
  }

  emit(event, payload) {
    (this._handlers[event] || []).forEach((fn) => fn(payload));
  }
}

/** Offline: this browser is the authority. */
export class LocalSession extends BaseSession {
  constructor(sequence) {
    super();
    this.sequence = sequence;
    this.progress = [];
    this.exitOpen = false;
    this.online = false;
  }

  connect() {
    this.emit('status', { online: false, players: 1 });
    return Promise.resolve(this);
  }

  pressSwitch(id) {
    if (this.exitOpen) return;

    const step = this.progress.length;

    if (this.sequence[step] !== id) {
      this.progress = [];
      this.emit('reset', {});
      return;
    }

    this.progress.push(id);
    this.emit('progress', { active: [...this.progress], total: this.sequence.length });

    if (this.progress.length === this.sequence.length) {
      this.exitOpen = true;
      this.emit('exit', {});
    }
  }

  setHidden() { /* no monster offline */ }

  sendSignal() { /* no peers offline */ }

  sendMove() { /* nobody to tell */ }
}

/** Online: the Node server is the authority, exactly like the Unreal version. */
export class NetworkSession extends BaseSession {
  constructor(sequenceLength, url = null) {
    super();
    this.sequenceLength = sequenceLength;
    this.url = url || SERVER_URL;
    this.online = false;
    this.id = null;
    this.players = new Map();
    this.ws = null;
    this._moveTimer = 0;
  }

  connect(timeoutMs = 2500) {
    return new Promise((resolve) => {
      let settled = false;

      const fail = () => {
        if (settled) return;
        settled = true;
        this.online = false;
        this.emit('status', { online: false, players: 1 });
        resolve(this);
      };

      try {
        this.ws = new WebSocket(this.url);
      } catch {
        return fail();
      }

      const timer = setTimeout(fail, timeoutMs);

      this.ws.onopen = () => {
        clearTimeout(timer);
        settled = true;
        this.online = true;
        this._send({ t: 'join' });
        resolve(this);
      };

      this.ws.onerror = fail;

      this.ws.onclose = () => {
        this.online = false;
        this.players.clear();
        this.emit('status', { online: false, players: 1 });
      };

      this.ws.onmessage = (ev) => this._receive(ev.data);
    });
  }

  _receive(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.t) {
      case 'welcome':
        this.id = msg.id;
        this.emit('level', { index: msg.levelIndex });
        this.emit('peers', { list: msg.peers || [] });
        if (msg.active?.length) {
          this.emit('progress', { active: msg.active, total: this.sequenceLength });
        }
        if (msg.exitOpen) this.emit('exit', {});
        break;

      case 'players': {
        this.players.clear();
        msg.list.forEach((p) => {
          if (p.id !== this.id) this.players.set(p.id, p);
        });
        this.emit('players', { list: [...this.players.values()] });
        this.emit('status', { online: true, players: msg.list.length });
        if (msg.monster) this.emit('monster', msg.monster);
        break;
      }

      case 'caught':
        this.emit('caught', { id: msg.id, respawn: msg.respawn, isMe: msg.id === this.id });
        break;

      case 'level':
        this.emit('level', { index: msg.index, name: msg.name });
        break;

      case 'level-complete':
        this.emit('level-complete', { index: msg.index });
        break;

      case 'peer-join':
        this.emit('peer-join', { id: msg.id });
        break;

      case 'peer-leave':
        this.emit('peer-leave', { id: msg.id });
        break;

      case 'signal':
        this.emit('signal', { from: msg.from, data: msg.data });
        break;

      case 'progress':
        this.emit('progress', { active: msg.active, total: this.sequenceLength });
        break;

      case 'reset':
        this.emit('reset', {});
        break;

      case 'exit':
        this.emit('exit', {});
        break;

      case 'level':
        this.emit('level', { index: msg.index });
        break;

      case 'voice-peer':
        this.emit('voice-peer', { id: msg.id, initiator: msg.initiator });
        break;

      case 'voice-signal':
        this.emit('voice-signal', { from: msg.from, data: msg.data });
        break;

      case 'voice-leave':
        this.emit('voice-leave', { id: msg.id });
        break;
    }
  }

  pressSwitch(id) {
    this._send({ t: 'switch', id });
  }

  setHidden(hidden) {
    this._send({ t: 'hide', hidden });
  }

  sendSignal(to, data) {
    this._send({ t: 'signal', to, data });
  }

  /** Throttled to ~15 Hz. Sending every frame is pure waste. */
  sendMove(state, dt) {
    this._moveTimer += dt;
    if (this._moveTimer < 1 / 15) return;
    this._moveTimer = 0;
    this._send({ t: 'move', ...state });
  }

  _send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }
}

/**
 * Try the server; fall back to offline play if it isn't there.
 * This means `npm run dev` alone gives you a working game.
 */
/**
 * mode 'solo'   -> always LocalSession, never touches the network
 * mode 'online' -> NetworkSession; returns null if the server can't be reached,
 *                  so the menu can say so instead of silently dropping you
 *                  into an empty offline game.
 */
export async function createSession(sequence, mode = 'solo', url = null) {
  if (mode === 'online') {
    const net = new NetworkSession(sequence.length, url);
    await net.connect();
    return net.online ? net : null;
  }

  const local = new LocalSession(sequence);
  await local.connect();
  return local;
}

/** Swapping levels changes the puzzle, so offline authority needs telling. */
export function setSessionSequence(session, sequence) {
  if (session instanceof LocalSession) {
    session.sequence = sequence;
    session.progress = [];
    session.exitOpen = false;
  }
  session.sequenceLength = sequence.length;
}
