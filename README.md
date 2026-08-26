# A-SYNC — The Backrooms

Co-op backrooms horror that runs in a browser. Three.js, no engine, no build step beyond Vite.

Level 0 is playable: three switches to find, one sequence to get right, a flashlight that dies on you, and sanity that drains in the dark.

---

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. That's it — it plays solo with no server and no assets.

For multiplayer, open a second terminal:

```bash
npm run server
```

Refresh the page. Top right should switch from OFFLINE to ONLINE. Open a second browser window (or send a friend your address) and you'll see each other.

**Controls:** `WASD` move · `Shift` sprint · `F` flashlight · `E` interact · `Esc` release mouse

---

## Putting it on GitHub

I can't create the repo for you, but this is the whole process:

```bash
cd backrooms-web
git init
git add .
git commit -m "A-SYNC: level 0 prototype"
```

Make an empty repo at https://github.com/new (no README, no .gitignore — you have both), then:

```bash
git remote add origin https://github.com/YOURNAME/backrooms-web.git
git branch -M main
git push -u origin main
```

Commit every time something works. Unreal-style project corruption isn't a risk here, but losing an afternoon to a bad refactor is.

---

## Editing the map

The level **is** a text file. Open `src/world/levels/level0.js` and edit the grid:

```
#  wall              .  floor           S  spawn
L  floor + ceiling light                b  battery
1  2  3  switches    X  exit door       (space) void
```

Each character is one 4m × 4m cell. Save, and Vite hot-reloads.

Two rules: every row must be the same length (the builder throws a clear error if not), and the map must be sealed by `#` or you'll walk into the void.

The switch order lives in `sequence: [2, 3, 1]` in the same file. **If you're running the server, change `SEQUENCE` in `server/server.js` to match** — the server is the authority, and the client copy is only used offline.

### Making it feel bigger

The instinct is to build a huge maze. Don't. Escape the Backrooms feels enormous because of fog and sightlines, not floor area. Long straight runs with fog eating the far end read as infinite. A big open maze just reads as tedious.

---

## Adding your own art and sound

Drop files into `public/assets/{textures,models,sounds}/`, then register them in **`src/config/manifest.js`** — that's the only file you edit.

Everything is optional. Missing files fall back to generated placeholders, so the game never breaks because an asset isn't ready.

**Textures** need to be seamless/tileable. `repeat: [2, 2]` means the texture tiles twice across one cell.

**Models** must be `.glb`. In Blender: File → Export → glTF 2.0 → format `glTF Binary`. Then place them per-level:

```js
props: [
  { model: 'chair', cell: [6, 12], rotation: 0.4 }
]
```

**Sounds** should be mp3 or ogg. Loops (`hum`, `heartbeat`) need to be seamless or you'll hear the seam every few seconds.

Free CC0 sources: [ambientCG](https://ambientcg.com), [Poly Haven](https://polyhaven.com), [Freesound](https://freesound.org).

---

## How the multiplayer works

Same model as a proper game engine: **the server is the authority.**

| | Where truth lives | How clients find out |
|---|---|---|
| Player positions | Each client (co-op, so trusted) | Relayed at 15 Hz |
| Switch presses | `server/server.js` only | `progress` / `reset` broadcast |
| Exit opening | Server | `exit` broadcast |
| Flashlight, sanity | Purely local | Beam state piggybacks on movement |

The client never decides the puzzle is solved. It sends "I pressed switch 2" and waits to be told what happened. A modified client can't skip the sequence.

`src/net/Session.js` is the piece worth understanding. `LocalSession` and `NetworkSession` expose an identical API, so `Game.js` has no idea whether a server exists. That's why solo play works with zero setup — and why you never end up with two divergent code paths.

---

## Deploying

**The game** is static. `npm run build` produces `dist/`, which drops onto Netlify, Vercel, or GitHub Pages unchanged.

**The server** needs a Node host — Render, Railway, and Fly.io all have workable free or cheap tiers. Deploy `server/server.js`, then point the client at it:

```bash
# .env
VITE_SERVER_URL=wss://your-server.onrender.com
```

Note `wss://` not `ws://`. A page served over HTTPS cannot open an insecure WebSocket, and this catches everyone at least once.

---

## Project structure

```
src/
  config/manifest.js       ← your assets and server URL
  core/
    Game.js                main loop, wires everything together
    AssetManager.js        loading + placeholder fallbacks
  world/
    LevelBuilder.js        ASCII grid → geometry, lights, interactables
    levels/level0.js       ← your map
  player/
    PlayerController.js    movement, pointer lock, grid collision
    Flashlight.js          spotlight, battery drain, dying-torch flicker
  systems/
    Sanity.js              fog, vignette, grain, camera drift
    AudioManager.js        optional-by-design sound
  net/
    Session.js             Local + Network sessions, identical API
    RemotePlayers.js       other players, interpolated
  ui/HUD.js                DOM overlay
server/server.js           authoritative Node WebSocket server
```

---

## Some things worth knowing

**Collision is grid-based, not mesh-based.** The player is tested against cells, one axis at a time. That's why you slide along walls instead of catching on them, and why it never lets you clip through a corner at high framerate.

**Only the flashlight casts shadows.** Ten shadow-casting point lights would halve the framerate for almost no visual gain. The ceiling lights are unshadowed point lights plus emissive panels.

**Only the nearest ten lights are enabled** at any moment, re-sorted each frame. WebGL degrades fast with many real lights.

**The flicker matters more than you'd think.** `_updateLights` in `Game.js` is maybe fifteen lines and does more for atmosphere than any texture will.

---

## Where to go next

Roughly in order of payoff per hour spent:

1. **Real sound.** A fluorescent hum, footsteps on carpet, and a distant unexplained noise on a random timer. This is the single biggest upgrade available and it's just files.
2. **Real textures.** Yellow wallpaper and damp carpet from ambientCG.
3. **An entity.** A pathfinding chaser is the natural next system, and the grid you already have makes A* straightforward.
4. **Level 1.** Copy `level0.js`, change the grid, add a level-select. The builder handles any map you throw at it.
5. **Voice chat.** WebRTC on top of the existing WebSocket for signalling. This is what makes co-op horror actually funny.

The entity is the big one and the honest warning is that it's a week of work, not an evening. Do sound and textures first — you'll enjoy the game more, which matters more than it sounds when you're building alone.
