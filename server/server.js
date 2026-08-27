/**
 * A-SYNC multiplayer server.
 *
 *   npm run server
 *
 * Authoritative for the puzzle and the current level. Relays player positions
 * and introduces WebRTC voice peers -- voice audio itself never touches this
 * server, so bandwidth stays flat no matter how many people are talking.
 */

import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = process.env.PORT || 8080;
const TICK_HZ = 15;

/** Switch order per level. MUST match `sequence` in each level file. */
const SEQUENCES = [
  [2, 3, 1], // 0 - The Lobby
  [3, 1, 2], // 1 - Habitat
  [1, 3, 2], // 2 - The Hub
  [1, 2, 3], // 3 - The Offices
  [3, 2, 1], // 4 - The Hotel
  [2, 1, 3]  // 5 - The Endless Suburbs
];

const state = {
  players: new Map(),
  progress: [],
  exitOpen: false,
  level: 0
};

let nextId = 1;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`A-SYNC server up. ${state.players.size} connected. Level ${state.level}.`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const id = nextId++;
  const player = {
    id, x: 6, z: 6, y: 0, yaw: 0,
    light: false, crouch: false, voice: false
  };
  state.players.set(id, player);
  ws.playerId = id;

  send(ws, {
    t: 'welcome',
    id,
    level: state.level,
    active: [...state.progress],
    exitOpen: state.exitOpen
  });

  console.log(`+ player ${id} (${state.players.size} online)`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    handle(id, msg);
  });

  ws.on('close', () => {
    state.players.delete(id);
    broadcastExcept(id, { t: 'voice-leave', id });
    console.log(`- player ${id} (${state.players.size} online)`);
    if (state.players.size === 0) resetRoom();
  });
});

function handle(id, msg) {
  const p = state.players.get(id);
  if (!p) return;

  switch (msg.t) {
    case 'move':
      // Co-op, not competitive, so movement is trusted -- but type-checked.
      if (typeof msg.x === 'number' && typeof msg.z === 'number') {
        p.x = msg.x;
        p.z = msg.z;
        p.y = typeof msg.y === 'number' ? msg.y : 0;
        p.yaw = typeof msg.yaw === 'number' ? msg.yaw : p.yaw;
        p.light = !!msg.light;
        p.crouch = !!msg.crouch;
      }
      break;

    case 'switch':
      pressSwitch(msg.id);
      break;

    case 'level':
      // Whoever reaches the exit first advances the room.
      if (Number.isInteger(msg.index) && msg.index !== state.level) {
        state.level = msg.index;
        state.progress = [];
        state.exitOpen = false;
        broadcast({ t: 'level', index: msg.index });
        console.log(`  -> level ${msg.index}`);
      }
      break;

    // ---- WebRTC voice signalling ------------------------------------------
    // The server only introduces peers to each other. Audio goes direct.
    case 'voice-join':
      p.voice = true;
      for (const [otherId, other] of state.players) {
        if (otherId === id || !other.voice) continue;
        sendTo(otherId, { t: 'voice-peer', id, initiator: true });
        sendTo(id, { t: 'voice-peer', id: otherId, initiator: false });
      }
      break;

    case 'voice-signal':
      sendTo(msg.to, { t: 'voice-signal', from: id, data: msg.data });
      break;

    case 'voice-leave':
      p.voice = false;
      broadcastExcept(id, { t: 'voice-leave', id });
      break;
  }
}

function pressSwitch(id) {
  if (state.exitOpen) return;
  if (!Number.isInteger(id)) return;
  if (state.progress.includes(id)) return;

  const seq = SEQUENCES[state.level] || SEQUENCES[0];
  const step = state.progress.length;

  if (seq[step] !== id) {
    state.progress = [];
    broadcast({ t: 'reset' });
    console.log(`  puzzle reset (wrong switch ${id})`);
    return;
  }

  state.progress.push(id);
  broadcast({ t: 'progress', active: [...state.progress] });

  if (state.progress.length === seq.length) {
    state.exitOpen = true;
    broadcast({ t: 'exit' });
    console.log('  exit opened');
  }
}

function resetRoom() {
  state.progress = [];
  state.exitOpen = false;
  state.level = 0;
  console.log('  room empty - state cleared');
}

function broadcast(obj) {
  const data = JSON.stringify(obj);
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(data); });
}

function broadcastExcept(playerId, obj) {
  const data = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.playerId !== playerId && c.readyState === 1) c.send(data);
  });
}

function sendTo(playerId, obj) {
  const data = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.playerId === playerId && c.readyState === 1) c.send(data);
  });
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

setInterval(() => {
  if (state.players.size === 0) return;
  broadcast({ t: 'players', list: [...state.players.values()] });
}, 1000 / TICK_HZ);

server.listen(PORT, () => {
  console.log(`A-SYNC server listening on port ${PORT}`);
});
