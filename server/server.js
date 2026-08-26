/**
 * A-SYNC multiplayer server.
 *
 *   npm run server
 *
 * Deliberately tiny and authoritative: the puzzle sequence lives here and
 * nowhere else, so a modified client can't skip it. Players are relayed at a
 * fixed tick rather than on every message, which keeps bandwidth predictable.
 */

import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = process.env.PORT || 8080;
const TICK_HZ = 15;

/** Must match `sequence` in src/world/levels/level0.js */
const SEQUENCE = [2, 3, 1];

const state = {
  players: new Map(),
  progress: [],
  exitOpen: false,
  batteries: new Set()
};

let nextId = 1;

// A plain HTTP server alongside so hosts like Render/Railway see an open port.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`A-SYNC server up. ${state.players.size} connected.`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const id = nextId++;
  const player = { id, x: 6, z: 6, yaw: 0, light: false };
  state.players.set(id, player);
  ws.playerId = id;

  send(ws, {
    t: 'welcome',
    id,
    active: [...state.progress],
    exitOpen: state.exitOpen,
    batteries: [...state.batteries]
  });

  console.log(`+ player ${id} (${state.players.size} online)`);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    handle(id, msg);
  });

  ws.on('close', () => {
    state.players.delete(id);
    console.log(`- player ${id} (${state.players.size} online)`);

    // Empty room: wipe progress so the next group starts clean.
    if (state.players.size === 0) resetPuzzle();
  });
});

function handle(id, msg) {
  const p = state.players.get(id);
  if (!p) return;

  switch (msg.t) {
    case 'move':
      // Trust movement (it's co-op, not competitive) but sanity-check types.
      if (typeof msg.x === 'number' && typeof msg.z === 'number') {
        p.x = msg.x;
        p.z = msg.z;
        p.yaw = typeof msg.yaw === 'number' ? msg.yaw : p.yaw;
        p.light = !!msg.light;
      }
      break;

    case 'switch':
      pressSwitch(msg.id);
      break;

    case 'battery':
      if (!state.batteries.has(msg.index)) {
        state.batteries.add(msg.index);
        broadcast({ t: 'battery', index: msg.index });
      }
      break;
  }
}

function pressSwitch(id) {
  if (state.exitOpen) return;
  if (!Number.isInteger(id)) return;
  if (state.progress.includes(id)) return;

  const step = state.progress.length;

  if (SEQUENCE[step] !== id) {
    state.progress = [];
    broadcast({ t: 'reset' });
    console.log(`  puzzle reset (wrong switch ${id})`);
    return;
  }

  state.progress.push(id);
  broadcast({ t: 'progress', active: [...state.progress] });

  if (state.progress.length === SEQUENCE.length) {
    state.exitOpen = true;
    broadcast({ t: 'exit' });
    console.log('  exit opened');
  }
}

function resetPuzzle() {
  state.progress = [];
  state.exitOpen = false;
  state.batteries.clear();
  console.log('  room empty — state cleared');
}

function broadcast(obj) {
  const data = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(data);
  });
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

// Position relay tick.
setInterval(() => {
  if (state.players.size === 0) return;
  broadcast({ t: 'players', list: [...state.players.values()] });
}, 1000 / TICK_HZ);

server.listen(PORT, () => {
  console.log(`A-SYNC server listening on port ${PORT}`);
});
