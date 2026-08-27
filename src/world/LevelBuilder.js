import * as THREE from 'three';

const WALL = '#';
const VOID = ' ';

/**
 * Per-level lighting. Any level can override any of these in its `lighting`
 * block, so the Lobby can be bright and airy while the Hub stays pitch black
 * without touching a line of code.
 */
export const DEFAULT_LIGHTING = {
  fogColor: 0x0a0a08,
  fogDensity: 0.036,
  skyColor: 0x07070a,

  ambientColor: 0x312a18,
  ambientIntensity: 0.55,

  lightColor: 0xffe9b8,
  lightIntensity: 9,
  lightRange: 16,
  panelIntensity: 2.4,

  flicker: true,
  flickerStrength: 1,

  ceiling: true,
  lightStyle: 'panel'   // 'panel' indoors, 'lamp' for streetlights
};

/**
 * Turns a level definition into scene geometry.
 *
 * Walls, floors and ceilings are InstancedMesh, so a large map is three draw
 * calls rather than hundreds. Collision, line-of-sight and pathfinding all run
 * against the grid rather than against meshes -- faster, and impossible to
 * fool with a prop.
 */
export class LevelBuilder {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
  }

  build(level) {
    const cs = level.cellSize;
    const wh = level.wallHeight;
    const grid = level.grid;
    const width = grid[0].length;

    grid.forEach((row, i) => {
      if (row.length !== width) {
        throw new Error(
          `Level "${level.name}": row ${i} is ${row.length} chars, expected ${width}. ` +
          `Every row must be the same length.`
        );
      }
    });

    const lighting = { ...DEFAULT_LIGHTING, ...(level.lighting || {}) };

    const result = {
      def: level,
      lighting,
      name: level.name,
      cellSize: cs,
      wallHeight: wh,
      cols: width,
      rows: grid.length,
      grid,
      blocked: new Set(),
      hiding: new Set(),
      spawn: new THREE.Vector3(cs * 1.5, 0, cs * 1.5),
      monsterSpawn: null,
      switches: [],
      lights: [],
      exit: null,
      interactables: [],
      group: new THREE.Group(),
      walkable: []
    };

    const wallCells = [];
    const floorCells = [];

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < width; c++) {
        const ch = grid[r][c];
        if (ch === VOID) continue;

        if (ch === WALL) {
          wallCells.push([c, r]);
          result.blocked.add(k(c, r));
          continue;
        }

        floorCells.push([c, r]);
        const center = this.cellCenter(c, r, cs);

        switch (ch) {
          case 'S':
            result.spawn.set(center.x, 0, center.z);
            result.walkable.push([c, r]);
            break;

          case 'M':
            result.monsterSpawn = new THREE.Vector3(center.x, 0, center.z);
            result.walkable.push([c, r]);
            break;

          case 'L':
            result.lights.push(this._makeCeilingLight(center, wh, result.group, lighting));
            result.walkable.push([c, r]);
            break;

          case 'H':
            // Crack in the wall. Walkable, but only while crouched, and the
            // monster will never path into it or see you inside.
            result.hiding.add(k(c, r));
            this._makeHidingSpot(center, cs, wh, result, grid, c, r);
            break;

          case '1':
          case '2':
          case '3':
            result.switches.push(this._makeSwitch(parseInt(ch, 10), center, result));
            result.walkable.push([c, r]);
            break;

          case 'X': {
            const solid = (rr, cc) => {
              const ch2 = grid[rr]?.[cc];
              return ch2 === undefined || ch2 === WALL || ch2 === VOID;
            };
            const facesEastWest = solid(r - 1, c) && solid(r + 1, c);
            result.exit = this._makeExit(center, cs, wh, result, facesEastWest);
            result.blocked.add(k(c, r));
            result.exitCell = k(c, r);
            break;
          }

          default:
            result.walkable.push([c, r]);
        }
      }
    }

    this._buildWalls(wallCells, cs, wh, result.group, level);
    this._buildFloorAndCeiling(floorCells, cs, wh, result.group, level, lighting);
    this._placeProps(level, result);

    this.scene.add(result.group);
    this._attachQueries(result, grid, width, cs);

    return result;
  }

  // ------------------------------------------------------------------ queries

  _attachQueries(result, grid, width, cs) {
    const cellAt = (x, z) => [Math.floor(x / cs), Math.floor(z / cs)];

    const charAt = (c, r) => {
      if (r < 0 || r >= grid.length || c < 0 || c >= width) return VOID;
      return grid[r][c];
    };

    result.isBlocked = (x, z) => {
      const [c, r] = cellAt(x, z);
      const ch = charAt(c, r);
      if (ch === VOID) return true;
      return result.blocked.has(k(c, r));
    };

    /** Walls stop sight. So do hiding alcoves -- that's the whole point. */
    result.isSightBlocked = (x, z) => {
      const [c, r] = cellAt(x, z);
      const ch = charAt(c, r);
      return ch === WALL || ch === VOID || ch === 'H';
    };

    result.isHidingSpot = (x, z) => {
      const [c, r] = cellAt(x, z);
      return result.hiding.has(k(c, r));
    };

    result.isCrouchOnly = (x, z) => result.isHidingSpot(x, z);
    result.isLowCeiling = (x, z) => result.isHidingSpot(x, z);

    /** Cells the monster is allowed to walk. Never the cracks. */
    const monsterWalkable = (c, r) => {
      const ch = charAt(c, r);
      if (ch === VOID || ch === WALL || ch === 'H') return false;
      return !result.blocked.has(k(c, r)) || k(c, r) === result.exitCell;
    };

    /**
     * Breadth-first search. On a grid of a few hundred uniform cells this
     * returns a guaranteed shortest path in well under a millisecond, so A*
     * would be extra code for no measurable gain.
     */
    result.findPath = (start, goal) => {
      if (!monsterWalkable(goal[0], goal[1])) {
        // Player standing somewhere unreachable -- aim for the nearest cell we can reach.
        const alt = [[0, 1], [0, -1], [1, 0], [-1, 0]]
          .map(([dc, dr]) => [goal[0] + dc, goal[1] + dr])
          .find(([c, r]) => monsterWalkable(c, r));
        if (!alt) return null;
        goal = alt;
      }

      const startKey = k(start[0], start[1]);
      const goalKey = k(goal[0], goal[1]);
      if (startKey === goalKey) return [];

      const prev = new Map([[startKey, null]]);
      const queue = [start];
      let head = 0;

      while (head < queue.length) {
        const [c, r] = queue[head++];

        for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nc = c + dc;
          const nr = r + dr;
          const nk = k(nc, nr);

          if (prev.has(nk) || !monsterWalkable(nc, nr)) continue;

          prev.set(nk, [c, r]);

          if (nk === goalKey) {
            // Walk the chain backwards, then flip it.
            const path = [];
            let cur = [nc, nr];
            while (cur) {
              path.push(cur);
              cur = prev.get(k(cur[0], cur[1]));
            }
            path.pop();
            return path.reverse();
          }

          queue.push([nc, nr]);
        }
      }
      return null;
    };

    result.randomWalkableCell = () => {
      const list = result.walkable;
      return list.length ? list[Math.floor(Math.random() * list.length)] : null;
    };

    result.openExit = () => {
      if (!result.exit) return;
      result.blocked.delete(result.exitCell);
      result.exit.open();
    };

    result.dispose = () => {
      result.group.traverse((o) => {
        if (o.isMesh || o.isInstancedMesh) {
          o.geometry?.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m?.dispose();
        }
      });
      this.scene.remove(result.group);
    };
  }

  cellCenter(c, r, cs) {
    return new THREE.Vector3((c + 0.5) * cs, 0, (r + 0.5) * cs);
  }

  // ------------------------------------------------------------ bulk geometry

  _buildWalls(cells, cs, wh, parent, level) {
    if (!cells.length) return;

    const geo = new THREE.BoxGeometry(cs, wh, cs);
    const mat = new THREE.MeshStandardMaterial({
      map: this.assets.texture(level.wallTexture || 'wall'),
      roughness: 0.92
    });

    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const m = new THREE.Matrix4();
    cells.forEach(([c, r], i) => {
      m.makeTranslation((c + 0.5) * cs, wh / 2, (r + 0.5) * cs);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
  }

  _buildFloorAndCeiling(cells, cs, wh, parent, level, lighting) {
    if (!cells.length) return;

    const plane = new THREE.PlaneGeometry(cs, cs);

    const floorMat = new THREE.MeshStandardMaterial({
      map: this.assets.texture(level.floorTexture || 'carpet'),
      roughness: 0.98
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      map: this.assets.texture(level.ceilingTexture || 'ceiling'),
      roughness: 0.95
    });

    const wantCeiling = lighting.ceiling !== false;

    const floor = new THREE.InstancedMesh(plane, floorMat, cells.length);
    floor.receiveShadow = true;

    // Outdoor levels (the Suburbs) have open sky instead of a ceiling.
    const ceil = wantCeiling
      ? new THREE.InstancedMesh(plane.clone(), ceilMat, cells.length)
      : null;
    if (ceil) ceil.receiveShadow = true;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3();

    cells.forEach(([c, r], i) => {
      const x = (c + 0.5) * cs;
      const z = (r + 0.5) * cs;

      q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      m.compose(pos.set(x, 0, z), q, s);
      floor.setMatrixAt(i, m);

      if (ceil) {
        q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
        m.compose(pos.set(x, wh, z), q, s);
        ceil.setMatrixAt(i, m);
      }
    });

    floor.instanceMatrix.needsUpdate = true;
    parent.add(floor);

    if (ceil) {
      ceil.instanceMatrix.needsUpdate = true;
      parent.add(ceil);
    }
  }

  // ---------------------------------------------------------------- fixtures

  /**
   * A crack in the wall you can squeeze into while crouched.
   * Built as a low, dark recess with a visible gap, so it reads as somewhere
   * you could fit rather than as a bug in the geometry.
   */
  _makeHidingSpot(center, cs, wh, result, grid, c, r) {
    const LOW = 1.35;

    const dark = new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 1 });

    // Cap it off so you can't stand up or see over the top.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(cs, wh - LOW, cs), dark);
    cap.position.set(center.x, LOW + (wh - LOW) / 2, center.z);
    result.group.add(cap);

    // Back and side walls of the recess.
    const back = new THREE.Mesh(new THREE.BoxGeometry(cs, LOW, 0.2), dark);
    back.position.set(center.x, LOW / 2, center.z + cs / 2 - 0.1);
    result.group.add(back);

    // Ragged edge pieces framing the gap, so it looks broken open.
    const edgeMat = new THREE.MeshStandardMaterial({
      map: this.assets.texture('wall'), roughness: 0.95
    });
    [-1, 1].forEach((side) => {
      const w = cs * 0.28;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w, LOW, 0.35), edgeMat);
      edge.position.set(center.x + side * (cs / 2 - w / 2), LOW / 2, center.z - cs / 2 + 0.18);
      edge.rotation.z = side * 0.05;
      edge.castShadow = true;
      result.group.add(edge);
    });

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(cs * 0.9, LOW, cs * 0.9),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(center.x, LOW / 2, center.z);
    hit.userData = { type: 'hiding', prompt: 'CROUCH TO HIDE' };
    result.group.add(hit);
    result.interactables.push(hit);
  }

  _makeCeilingLight(center, wh, parent, cfg) {
    const isLamp = cfg.lightStyle === 'lamp';

    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xfff4d0,
      emissive: cfg.lightColor,
      emissiveIntensity: cfg.panelIntensity,
      roughness: 0.4
    });

    let panel;
    let lightY;

    if (isLamp) {
      // Streetlamp: a post with a glowing head, for outdoor levels.
      const postMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1f, roughness: 0.8, metalness: 0.4 });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, wh * 0.82, 8), postMat);
      post.position.set(center.x, wh * 0.41, center.z);
      post.castShadow = true;
      parent.add(post);

      panel = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), glowMat);
      panel.position.set(center.x, wh * 0.86, center.z);
      lightY = wh * 0.82;
    } else {
      panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.6), glowMat);
      panel.position.set(center.x, wh - 0.05, center.z);
      lightY = wh - 0.35;
    }

    parent.add(panel);

    const light = new THREE.PointLight(cfg.lightColor, cfg.lightIntensity, cfg.lightRange, 2);
    light.position.set(center.x, lightY, center.z);
    parent.add(light);

    return {
      panel,
      light,
      position: light.position.clone(),
      flickerPhase: Math.random() * 100,
      flickerRate: 0.4 + Math.random() * 2.2,
      baseIntensity: cfg.lightIntensity,
      basePanelIntensity: cfg.panelIntensity,
      flicker: cfg.flicker !== false,
      flickerStrength: cfg.flickerStrength ?? 1
    };
  }

  _makeSwitch(id, center, result) {
    const group = new THREE.Group();
    group.position.copy(center);

    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.2, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 0.7, metalness: 0.3 })
    );
    housing.position.y = 0.6;
    housing.castShadow = true;
    group.add(housing);

    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x551111, emissive: 0x330505, emissiveIntensity: 1
    });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), lampMat);
    lamp.position.set(0, 0.95, 0.2);
    group.add(lamp);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2, 1.1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 1;
    hit.userData = { type: 'switch', id, prompt: `PRESS E — SWITCH ${id}` };
    group.add(hit);

    result.group.add(group);
    result.interactables.push(hit);

    return {
      id, group, hit, active: false,

      setActive(on) {
        this.active = on;
        lampMat.color.setHex(on ? 0x2fbf5a : 0x551111);
        lampMat.emissive.setHex(on ? 0x1f9944 : 0x330505);
        lampMat.emissiveIntensity = on ? 4 : 1;
        hit.userData.prompt = on ? 'SWITCH ACTIVE' : `PRESS E — SWITCH ${this.id}`;
      },

      flashError() {
        lampMat.color.setHex(0xff3b26);
        lampMat.emissive.setHex(0xff2a12);
        lampMat.emissiveIntensity = 7;
        clearTimeout(this._errTimer);
        this._errTimer = setTimeout(() => this.setActive(this.active), 420);
      }
    };
  }

  _makeExit(center, cs, wh, result, facesEastWest) {
    const W = cs * 0.95;
    const THIN = 0.35;

    const size = facesEastWest
      ? new THREE.Vector3(THIN, wh, W)
      : new THREE.Vector3(W, wh, THIN);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({
        color: 0x3a3a3c, roughness: 0.55, metalness: 0.6, emissive: 0x0a0a0a
      })
    );
    door.position.set(center.x, wh / 2, center.z);
    door.castShadow = true;
    door.receiveShadow = true;
    result.group.add(door);

    const signGeo = facesEastWest
      ? new THREE.BoxGeometry(0.05, 0.35, 1.3)
      : new THREE.BoxGeometry(1.3, 0.35, 0.05);

    const signMat = new THREE.MeshStandardMaterial({
      color: 0x3a1010, emissive: 0xc4392a, emissiveIntensity: 2.6
    });

    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(
      center.x + (facesEastWest ? THIN / 2 + 0.03 : 0),
      wh - 0.6,
      center.z + (facesEastWest ? 0 : THIN / 2 + 0.03)
    );
    result.group.add(sign);

    const signBack = sign.clone();
    signBack.position.set(
      center.x - (facesEastWest ? THIN / 2 + 0.03 : 0),
      wh - 0.6,
      center.z - (facesEastWest ? 0 : THIN / 2 + 0.03)
    );
    result.group.add(signBack);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(size.x + 0.6, wh, size.z + 0.6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(center.x, wh / 2, center.z);
    hit.userData = { type: 'exit', prompt: 'SEALED — FIND THE SWITCHES' };
    result.group.add(hit);
    result.interactables.push(hit);

    return {
      mesh: door, sign, signBack, hit,
      opening: false, opened: false, closedY: wh / 2,

      open() {
        if (this.opening) return;
        this.opening = true;
        [this.sign, this.signBack].forEach((m) => {
          m.material = m.material.clone();
          m.material.color.setHex(0x0f2f14);
          m.material.emissive.setHex(0x27b34a);
        });
        this.hit.userData.prompt = '';
      },

      update(dt) {
        if (!this.opening || this.opened) return;
        door.position.y -= dt * 1.4;
        if (door.position.y <= -this.closedY) {
          door.position.y = -this.closedY;
          this.opened = true;
        }
      }
    };
  }

  _placeProps(level, result) {
    (level.props || []).forEach((p) => {
      const obj = this.assets.model(p.model);
      if (!obj) return; // model not supplied yet -- skip silently
      const center = this.cellCenter(p.cell[0], p.cell[1], level.cellSize);
      obj.position.copy(center);
      if (p.offset) obj.position.add(new THREE.Vector3(...p.offset));
      obj.rotation.y = p.rotation ?? 0;
      if (p.scale) obj.scale.multiplyScalar(p.scale);
      result.group.add(obj);
    });
  }
}

function k(c, r) {
  return `${c},${r}`;
}
