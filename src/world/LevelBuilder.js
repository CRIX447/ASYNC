import * as THREE from 'three';

const WALL_COLOR_MUL = 1.0;

/**
 * Turns a level definition into scene geometry.
 *
 * Walls, floors and ceilings are InstancedMesh, so a 28x20 map is three draw
 * calls instead of hundreds. Collision is done against the grid rather than
 * against meshes, which is both faster and far less glitchy than raycasting.
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

    // Fail loudly on a ragged map — this is the #1 map editing mistake.
    const width = grid[0].length;
    grid.forEach((row, i) => {
      if (row.length !== width) {
        throw new Error(
          `Level "${level.name}": row ${i} is ${row.length} chars, expected ${width}. ` +
          `Every row must be the same length.`
        );
      }
    });

    const result = {
      cellSize: cs,
      wallHeight: wh,
      cols: width,
      rows: grid.length,
      blocked: new Set(),
      spawn: new THREE.Vector3(cs * 1.5, 0, cs * 1.5),
      switches: [],
      batteries: [],
      lights: [],
      exit: null,
      interactables: [],
      group: new THREE.Group()
    };

    const wallCells = [];
    const floorCells = [];

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < width; c++) {
        const ch = grid[r][c];
        if (ch === ' ') continue;

        if (ch === '#') {
          wallCells.push([c, r]);
          result.blocked.add(key(c, r));
          continue;
        }

        floorCells.push([c, r]);

        const center = this.cellCenter(c, r, cs);

        switch (ch) {
          case 'S':
            result.spawn.set(center.x, 0, center.z);
            break;
          case 'L':
            result.lights.push(this._makeCeilingLight(center, wh, result.group));
            break;
          case '1':
          case '2':
          case '3':
            result.switches.push(
              this._makeSwitch(parseInt(ch, 10), center, result)
            );
            break;
          case 'b':
            result.batteries.push(this._makeBattery(center, result));
            break;
          case 'X':
            result.exit = this._makeExit(center, cs, wh, result);
            result.blocked.add(key(c, r)); // solid until it opens
            result.exitCell = key(c, r);
            break;
        }
      }
    }

    this._buildWalls(wallCells, cs, wh, result.group);
    this._buildFloorAndCeiling(floorCells, cs, wh, result.group);
    this._placeProps(level, result);

    this.scene.add(result.group);

    /** World-space solidity test used by player movement. */
    result.isBlocked = (x, z) => {
      const c = Math.floor(x / cs);
      const r = Math.floor(z / cs);
      if (r < 0 || r >= grid.length || c < 0 || c >= width) return true;
      if (grid[r][c] === ' ') return true;
      return result.blocked.has(key(c, r));
    };

    result.openExit = () => {
      if (!result.exit) return;
      result.blocked.delete(result.exitCell);
      result.exit.open();
    };

    return result;
  }

  cellCenter(c, r, cs) {
    return new THREE.Vector3((c + 0.5) * cs, 0, (r + 0.5) * cs);
  }

  // ------------------------------------------------------------------ bulk geometry

  _buildWalls(cells, cs, wh, parent) {
    if (!cells.length) return;

    const geo = new THREE.BoxGeometry(cs, wh, cs);
    const mat = new THREE.MeshStandardMaterial({
      map: this.assets.texture('wall'),
      roughness: 0.92,
      metalness: 0.0
    });
    mat.color.multiplyScalar(WALL_COLOR_MUL);

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

  _buildFloorAndCeiling(cells, cs, wh, parent) {
    if (!cells.length) return;

    const plane = new THREE.PlaneGeometry(cs, cs);

    const floorMat = new THREE.MeshStandardMaterial({
      map: this.assets.texture('carpet'),
      roughness: 0.98,
      metalness: 0.0
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      map: this.assets.texture('ceiling'),
      roughness: 0.95,
      metalness: 0.0
    });

    const floor = new THREE.InstancedMesh(plane, floorMat, cells.length);
    const ceil = new THREE.InstancedMesh(plane, ceilMat, cells.length);
    floor.receiveShadow = true;
    ceil.receiveShadow = true;

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

      q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
      m.compose(pos.set(x, wh, z), q, s);
      ceil.setMatrixAt(i, m);
    });

    floor.instanceMatrix.needsUpdate = true;
    ceil.instanceMatrix.needsUpdate = true;

    parent.add(floor, ceil);
  }

  // ------------------------------------------------------------------ fixtures

  _makeCeilingLight(center, wh, parent) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.06, 0.6),
      new THREE.MeshStandardMaterial({
        color: 0xfff4d0,
        emissive: 0xffeeb0,
        emissiveIntensity: 2.4,
        roughness: 0.4
      })
    );
    panel.position.set(center.x, wh - 0.05, center.z);
    parent.add(panel);

    const light = new THREE.PointLight(0xffe9b8, 9, 16, 2);
    light.position.set(center.x, wh - 0.35, center.z);
    parent.add(light);

    return {
      panel,
      light,
      position: light.position.clone(),
      // Flicker gives the whole level its character. Cheap, huge payoff.
      flickerPhase: Math.random() * 100,
      flickerRate: 0.4 + Math.random() * 2.2,
      baseIntensity: 9
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
      color: 0x551111,
      emissive: 0x330505,
      emissiveIntensity: 1
    });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), lampMat);
    lamp.position.set(0, 0.95, 0.2);
    group.add(lamp);

    // Bigger invisible box so aiming at it isn't fiddly.
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
      id,
      group,
      hit,
      active: false,
      setActive(on) {
        this.active = on;
        lampMat.color.setHex(on ? 0x2fbf5a : 0x551111);
        lampMat.emissive.setHex(on ? 0x1f9944 : 0x330505);
        lampMat.emissiveIntensity = on ? 4 : 1;
        hit.userData.prompt = on ? 'SWITCH ACTIVE' : `PRESS E — SWITCH ${this.id}`;
      }
    };
  }

  _makeBattery(center, result) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.28, 12),
      new THREE.MeshStandardMaterial({
        color: 0x2f6f3f,
        emissive: 0x143a1f,
        emissiveIntensity: 0.8,
        roughness: 0.5,
        metalness: 0.5
      })
    );
    mesh.position.set(center.x, 0.55, center.z);
    mesh.castShadow = true;
    result.group.add(mesh);

    return { mesh, collected: false, basePosition: mesh.position.clone() };
  }

  _makeExit(center, cs, wh, result) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(cs * 0.95, wh, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0x3a3a3c,
        roughness: 0.55,
        metalness: 0.6,
        emissive: 0x0a0a0a
      })
    );
    door.position.set(center.x, wh / 2, center.z);
    door.castShadow = true;
    result.group.add(door);

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.35, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0x0f2f14,
        emissive: 0x27b34a,
        emissiveIntensity: 3
      })
    );
    sign.position.set(center.x, wh - 0.6, center.z - 0.24);
    result.group.add(sign);

    return {
      mesh: door,
      sign,
      opening: false,
      opened: false,
      closedY: wh / 2,
      open() {
        this.opening = true;
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
      if (!obj) return; // Model not supplied yet — silently skip.
      const center = this.cellCenter(p.cell[0], p.cell[1], level.cellSize);
      obj.position.copy(center);
      obj.rotation.y = p.rotation ?? 0;
      result.group.add(obj);
    });
  }
}

function key(c, r) {
  return `${c},${r}`;
}
