import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TEXTURES, MODELS } from '../config/manifest.js';

/**
 * Loads everything listed in the manifest. Anything that 404s or fails to
 * decode is replaced with a generated placeholder, so a fresh clone of this
 * repo is playable before you have added a single asset file.
 */
export class AssetManager {
  constructor() {
    this.textures = {};
    this.models = {};
    this.missing = [];
    this._texLoader = new THREE.TextureLoader();
    this._gltfLoader = new GLTFLoader();
  }

  async loadAll(onProgress = () => {}) {
    const texKeys = Object.keys(TEXTURES);
    const modelKeys = Object.keys(MODELS);
    const total = texKeys.length + modelKeys.length || 1;
    let done = 0;

    const tick = () => onProgress(++done / total);

    await Promise.all([
      ...texKeys.map((k) => this._loadTexture(k, TEXTURES[k]).then(tick)),
      ...modelKeys.map((k) => this._loadModel(k, MODELS[k]).then(tick))
    ]);

    return this;
  }

  // ---------------------------------------------------------------- textures

  async _loadTexture(key, def) {
    let tex;
    try {
      tex = await this._texLoader.loadAsync(def.url);
      tex.colorSpace = THREE.SRGBColorSpace;
    } catch {
      this.missing.push(def.url);
      tex = makePlaceholderTexture(def.fallback);
    }

    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(def.repeat?.[0] ?? 1, def.repeat?.[1] ?? 1);
    tex.anisotropy = 8;
    this.textures[key] = tex;
    return tex;
  }

  texture(key) {
    return this.textures[key] || null;
  }

  // ------------------------------------------------------------------ models

  async _loadModel(key, def) {
    try {
      const gltf = await this._gltfLoader.loadAsync(def.url);
      const root = gltf.scene;
      const s = def.scale ?? 1;
      root.scale.setScalar(s);
      root.position.y += def.yOffset ?? 0;
      root.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.models[key] = root;
    } catch {
      this.missing.push(def.url);
      this.models[key] = null;
    }
  }

  /** Returns a fresh clone, or null if the model was never loaded. */
  model(key) {
    const src = this.models[key];
    return src ? src.clone(true) : null;
  }
}

/**
 * Draws a tileable placeholder onto a canvas. Keeps the game looking
 * deliberate rather than broken while the assets folder is still empty.
 */
function makePlaceholderTexture({ base = '#c9b45f', accent = '#b39f4d', pattern = 'noise' } = {}) {
  const SIZE = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (pattern === 'stripes') {
    // Faint vertical wallpaper banding.
    ctx.fillStyle = accent;
    for (let x = 0; x < SIZE; x += 32) ctx.fillRect(x, 0, 14, SIZE);
  }

  // Grain over the top of everything, so surfaces aren't flat colour.
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
