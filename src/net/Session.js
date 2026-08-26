import { SERVER_URL } from '../config/manifest.js';

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
  constructor(sequenceLength) {
    super();
    this.sequenceLength = sequenceLength;
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
        this.ws = new WebSocket(SERVER_URL);
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
export async function createSession(sequence) {
  const net = new NetworkSession(sequence.length);
  await net.connect();
  if (net.online) return net;

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
