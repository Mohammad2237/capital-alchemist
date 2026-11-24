// Model loading + placement by measured bounds (base-centre on the target point, scaled to a real-world size),
// so every KayKit/Blender model lands exactly where the floor plan says regardless of its pivot or units.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

const loader = new GLTFLoader();
const cache = new Map();
export const colliders = [];     // Box3 list: walls/furniture the player can't walk through
let pending = 0, done = 0, onProgress = () => {};
export function setProgress(cb) { onProgress = cb; }

export function load(url) {
  if (!cache.has(url)) {
    pending++;
    cache.set(url, new Promise((res, rej) => loader.load(url, g => { done++; onProgress(done / pending); res(g); },
      undefined, e => { done++; onProgress(done / pending); console.warn("missing model", url, e); res(null); })));
  }
  return cache.get(url);
}

function prep(root) {
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m && m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; }
    }
  });
  return root;
}

export const box3 = o => new THREE.Box3().setFromObject(o);

// opts: yaw (deg), height | width | scale, alignTop, collider, name, parent
export async function place(parent, url, at, opts = {}) {
  const g = await load(url); if (!g) return null;
  const o = prep(g.scene.clone(true));
  o.name = opts.name || url.split("/").pop();
  o.rotation.y = THREE.MathUtils.degToRad(opts.yaw || 0);
  o.updateMatrixWorld(true);
  let b = box3(o), size = b.getSize(new THREE.Vector3());
  const s = opts.scale || (opts.height ? opts.height / Math.max(size.y, 1e-4) : opts.width ? opts.width / Math.max(size.x, size.z, 1e-4) : 1);
  o.scale.setScalar(s); o.updateMatrixWorld(true);
  b = box3(o); const c = b.getCenter(new THREE.Vector3());
  o.position.set(at.x - c.x, (opts.alignTop ? at.y - b.max.y : at.y - b.min.y), at.z - c.z);
  (parent).add(o); o.updateMatrixWorld(true);
  if (opts.collider) colliders.push(box3(o));
  return o;
}

// Characters keep their skeleton + animation clips (SkeletonUtils clone).
export async function character(url, height) {
  const g = await load(url); if (!g) return null;
  const model = prep(cloneSkinned(g.scene));
  const holder = new THREE.Group();
  // KayKit glTF characters already face +Z (gameplay forward).
  holder.add(model);
  holder.updateMatrixWorld(true);
  const b = box3(model), s = height / Math.max(b.getSize(new THREE.Vector3()).y, 1e-4);
  model.scale.setScalar(s); holder.updateMatrixWorld(true);
  const b2 = box3(model); model.position.y -= b2.min.y;
  return { holder, model, clips: g.animations };
}

export function material(color, { emissive = 0, metal = 0, rough = 0.75, transparent = false, opacity = 1 } = {}) {
  const c = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({ color: c, metalness: metal, roughness: rough, emissive: emissive ? c : 0x000000,
    emissiveIntensity: emissive, transparent, opacity, depthWrite: !transparent });
}
export function box(parent, pos, size, color, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), opts.mat || material(color, opts));
  m.position.copy(pos); if (opts.yaw) m.rotation.y = THREE.MathUtils.degToRad(opts.yaw);
  m.castShadow = opts.shadow !== false; m.receiveShadow = true; parent.add(m);
  if (opts.collider) { m.updateMatrixWorld(true); colliders.push(box3(m)); }
  return m;
}
export function blocker(pos, size) { colliders.push(new THREE.Box3().setFromCenterAndSize(pos, size)); }
