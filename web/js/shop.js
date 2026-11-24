// The whole shop + village lane, ported from the Unity set-dressing (same models, same positions).
import * as THREE from "three";
import { place, box, blocker, material, colliders, box3 } from "./assets.js";
import { L, U } from "./layout.js";

const KK = "assets/kaykit/", CU = "assets/custom/";
const D = n => `${KK}Dungeon/${n}.glb`, F = n => `${KK}Furniture/${n}.gltf`, R = n => `${KK}Restaurant/${n}.gltf`,
  H = n => `${KK}Halloween/${n}.gltf`, T = n => `${KK}Town/${n}.gltf`, C = n => `${KK}Accessories/${n}.gltf`, M = n => `${CU}${n}.glb`;
const WOOD = 0x40200c, DARK = 0x1b0d07, SHINGLE = 0x52241a, MEADOW = 0x2b3819;

let seed = 20261126;
const R01 = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(R01() * a.length)];

export const refs = { flickers: [], flames: [], door: null, liquid: null, root: null };
let root;
// Unity-coordinate placement helper: P(url, x, y, z, unityYaw, opts)
const P = (url, x, y, z, yaw = 0, o = {}) => place(o.parent || root, url, U(x, y, z), { ...o, yaw: -yaw });
function light(x, y, z, color, intensity, range, flicker) {
  const l = new THREE.PointLight(color, intensity, range, 1.6); l.position.copy(U(x, y, z)); root.add(l);
  if (flicker) refs.flickers.push({ l, base: intensity, seed: x * 13 + z * 7 });
  return l;
}

export async function buildShop(scene) {
  root = refs.root = new THREE.Group(); root.name = "Alchemy Shop"; scene.add(root);
  const jobs = [];
  const J = p => jobs.push(p);

  // ---- ground + bounds
  box(root, U(0, -0.08, -10), new THREE.Vector3(140, 0.1, 120), MEADOW, { shadow: false });
  for (const [x, z, sx, sz] of [[0, -9.6, 26, 0.4], [-11, 2, 0.4, 24], [11, 2, 0.4, 24], [0, 13.6, 26, 0.4]]) blocker(U(x, 1.5, z), new THREE.Vector3(sx, 3, sz));
  for (let ix = -1; ix <= 1; ix++) for (let iz = 0; iz < 4; iz++) J(P(D("floor_wood_large"), ix * 3, 0, 1.5 + iz * 3, (ix + iz) % 2 ? 90 : 0, { width: 3.02, alignTop: true }));
  for (let ix = -3; ix <= 3; ix++) for (let iz = 0; iz < 3; iz++) J(P(D("floor_tile_large"), ix * 3, -0.005, -1.9 - iz * 3, 0, { width: 3.02, alignTop: true }));

  // ---- walls
  J(P(D("wall_window_open"), -3, 0, 0, 0, { height: 3, collider: true }));
  J(P(M("entrance_wall"), 0, 0, 0, 0, { scale: 1 }));
  blocker(U(-1.075, 1.5, 0), new THREE.Vector3(0.85, 3, 0.75)); blocker(U(1.075, 1.5, 0), new THREE.Vector3(0.85, 3, 0.75));
  J(P(D("wall"), 3, 0, 0, 0, { height: 3, collider: true }));
  J(P(D("wall"), -3, 0, 12, 180, { height: 3, collider: true }));
  J(P(D("wall_shelves"), 0, 0, 11.85, 180, { height: 3, collider: true }));
  J(P(D("wall"), 3, 0, 12, 180, { height: 3, collider: true }));
  const east = ["wall", "wall_window_open", "wall", "wall"], west = ["wall", "wall", "wall_archedwindow_open", "wall"];
  for (let i = 0; i < 4; i++) { J(P(D(east[i]), 4.5, 0, 1.5 + i * 3, 90, { height: 3, collider: true })); J(P(D(west[i]), -4.5, 0, 1.5 + i * 3, 90, { height: 3, collider: true })); }
  for (const [x, z] of [[-4.5, 0], [4.5, 0], [-4.5, 12], [4.5, 12]]) J(P(D("pillar"), x, 0, z, 0, { height: 3.15, collider: true }));

  // ---- door on its hinge (opens inward)
  const hinge = new THREE.Group(); hinge.position.copy(L.doorHinge); root.add(hinge); refs.door = hinge;
  // Door centre sits 0.6 m from the hinge; place() positions relative to the hinge group.
  J(place(hinge, M("shop_door"), U(0, 0, 0.02).sub(L.doorHinge), { scale: 1, name: "Shop door" }));

  // ---- roof + ceiling
  const half = 4.9, rise = 2.4, ang = Math.atan2(rise, half), slope = Math.hypot(half, rise);
  for (const side of [-1, 1]) {
    const slab = box(root, U(side * half / 2, 3 + rise / 2 + 0.08, 6), new THREE.Vector3(slope + 0.7, 0.16, 13.2), SHINGLE);
    slab.rotation.z = side * ang;
  }
  box(root, U(0, 3 + rise + 0.15, 6), new THREE.Vector3(0.3, 0.25, 13.4), DARK);
  for (const z of [0, 12]) {
    const shape = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rise)]);
    const g = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false }), material(0x6b5c4d));
    g.position.copy(U(0, 3, z)); g.position.z -= 0.35; g.castShadow = g.receiveShadow = true; root.add(g);
  }
  J(P(H("lantern_hanging"), 0, 4.3, -0.45, 0, { height: 0.55 }));
  box(root, U(0, 3.06, 6), new THREE.Vector3(9.1, 0.1, 12.1), DARK);
  for (let i = 0; i < 8; i++) box(root, U(0, 2.86, 0.9 + i * 1.5), new THREE.Vector3(9, 0.24, 0.2), WOOD);
  for (const x of [-2.1, 2.1]) box(root, U(x, 2.66, 6), new THREE.Vector3(0.2, 0.2, 12), 0x4a2510);
  let n = 0;
  for (const x of [-3.4, -2.7, -1.4, 1.4, 2.7, 3.4]) for (const z of [2.4, 3.9, 8.4, 9.9]) {
    if ((n++ % 3) === 2) continue;
    J(P(M(n % 2 === 0 ? "hanging_herbs_lavender" : "hanging_herbs_green"), x + (R01() - 0.5) * 0.2, 2.74, z, R01() * 360, { scale: 0.9 + R01() * 0.3, alignTop: true }));
  }
  for (const x of [-1.5, 1.5]) { J(P(H("lantern_hanging"), x, 2.74, 4.6, 0, { height: 0.55, alignTop: true })); light(x, 2.05, 4.6, 0xffa852, 6, 6, false); }

  // ---- outside: lane, neighbours, market, well, windmill, hills
  J(P(M("shop_sign"), 0, 2.62, -0.5, 0, { scale: 1 }));
  for (const s of [-1, 1]) {
    J(P(H("post_lantern"), s * 1.75, 0, -1.15, 0, { height: 2.4, collider: true })); light(s * 1.75, 2.1, -1.3, 0xff9e47, 10, 8, true);
    J(P(H("pumpkin_orange_small"), s * 1.05, 0, -0.75, R01() * 360, { height: 0.28 }));
  }
  J(P(D("barrel_large"), -2.4, 0, -0.95, 20, { height: 1, collider: true }));
  J(P(D("barrel_small_stack"), -3.3, 0, -0.9, 0, { height: 1.05, collider: true }));
  J(P(D("crates_stacked"), 3.3, 0, -1.0, 10, { height: 1.2, collider: true }));
  J(P(H("bench"), 2.3, 0, -1.35, 0, { height: 0.5, collider: true }));
  J(P(H("lantern_standing"), -1.3, 0, -1.6, 0, { height: 0.55 }));
  for (const [m, x, z, yaw, h] of [["building_home_A_red", -7.2, -10.2, 180, 5.2], ["building_tavern_red", -1.2, -11, 180, 6.2], ["building_home_B_yellow", 4.6, -10.4, 180, 5],
    ["building_blacksmith_green", 9.8, -9.4, 200, 5], ["building_home_A_blue", -9.6, 3.2, 90, 5], ["building_home_B_green", 9.6, 2.6, -90, 5]])
    J(P(T(m), x, 0, z, yaw, { height: h, collider: true }));
  J(P(T("building_market_yellow"), 5.6, 0, -5, -25, { height: 3, collider: true }));
  J(P(T("sack"), 4.2, 0, -4.3, 30, { height: 0.55 })); J(P(T("sack"), 4.55, 0, -4.0, 75, { height: 0.5 }));
  J(P(T("crate_open"), 6.9, 0, -3.9, 10, { height: 0.6, collider: true }));
  J(P(T("wheelbarrow"), -5.6, 0, -3.4, 120, { height: 0.8, collider: true }));
  J(P(T("building_well_blue"), -5.2, 0, -6.4, 0, { height: 2.4, collider: true }));
  J(P(T("tent"), -9, 0, -5.6, 60, { height: 2.4, collider: true }));
  J(P(T("building_windmill_red"), -16, 0, -22, 160, { height: 11 }));
  J(P(T("hills_B_trees"), 14, 0, -26, 0, { width: 22 })); J(P(T("mountain_A_grass_trees"), -2, 0, -40, 0, { width: 34 })); J(P(T("hills_B_trees"), -26, 0, -14, 90, { width: 20 }));
  for (const [x, y, z] of [[-10, 13, -24], [8, 15, -30], [20, 12, -10]]) J(P(T("cloud_big"), x, y, z, R01() * 360, { width: 7 }));
  for (const [x, z] of [[-7.6, -2.6], [7.8, -1.8], [-6.4, 6.5], [7, 7.5], [-6.8, 10.5], [6.6, 11.5], [12, -6], [-12.5, -8]])
    J(P(H(R01() > 0.5 ? "tree_pine_yellow_large" : "tree_pine_orange_medium"), x, 0, z, R01() * 360, { height: 4.5 + R01() * 2, collider: true }));
  for (let i = 0; i < 5; i++) J(P(H(pick(["path_A", "path_B", "path_C", "path_D"])), (R01() - 0.5) * 0.3, 0.01, -1.6 - i * 1.4, R01() * 360, { width: 1.1 }));

  // ---- the big cauldron
  const c = L.cauldron;
  J(P(M("fire_pit"), 0, 0, 6.2, 0, { scale: 1 }));
  J(P(M("cauldron_big"), 0, 0.01, 6.2, 0, { scale: 1, collider: true }));
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.012, 40), material(0x14332a, { emissive: 0.6 }));
  liquid.position.copy(L.liquid); root.add(liquid); refs.liquid = liquid;
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff5a0d }));
    f.scale.set(0.16, 0.38, 0.16); f.position.set(c.x + Math.cos(a) * 0.32, 0.18 + (i % 2) * 0.06, c.z + Math.sin(a) * 0.32);
    root.add(f); refs.flames.push({ m: f, base: f.scale.clone(), seed: i });
  }
  light(0, 0.45, 6.2, 0xff7326, 14, 10, true);
  J(P(D("barrel_small"), 1.05, 0.02, 5.25, 0, { height: 0.6 }));
  J(P(D("stool"), -1.15, 0, 7.2, 30, { height: 0.5, collider: true }));

  // ---- stations
  const top = L.tableTop, tx = -2.75, tz = 6.2;
  J(P(D("table_long"), tx, 0, tz, 0, { height: top, collider: true }));
  J(P(R("jar_B_large"), tx - 0.55, top, tz - 1.3, 0, { height: 0.38 })); J(P(R("jar_C_medium"), tx - 0.6, top, tz - 0.75, 40, { height: 0.3 }));
  J(P(R("jar_D_small"), tx - 0.5, top, tz + 0.55, 10, { height: 0.22 })); J(P(R("jar_A_medium"), tx - 0.6, top, tz + 1.25, 0, { height: 0.3 }));
  J(P(C("spellbook_open"), tx - 0.35, top, tz + 0.05, 90, { width: 0.42 })); J(P(R("cuttingboard"), tx - 0.3, top, tz - 1.1, 90, { width: 0.45 }));
  J(P(R("knife"), tx - 0.3, top + 0.025, tz - 1.1, 75, { width: 0.26 })); J(P(D("candle_lit"), tx - 0.65, top, tz + 1.65, 0, { height: 0.3 }));
  J(P(R("crate_carrots"), tx - 0.2, 0, tz - 1.4, 15, { height: 0.45 })); J(P(R("crate_onions"), tx - 0.3, 0, tz + 1.3, -10, { height: 0.45 }));
  J(P(M("parchment_board"), -4.06, 1.35, tz, 90, { scale: 1 }));
  J(P(D("table_small"), -1.85, 0, 4.2, 0, { height: top, collider: true }));
  J(P(M("mortar"), -1.85, top, 4.2, 0, { scale: 1, name: "Stone mortar" }));
  J(P(D("candle_thin_lit"), -2.15, top, 4.48, 0, { height: 0.32 })); J(P(F("book_single"), -1.6, top, 4.5, 70, { width: 0.26 }));
  J(P(M("bottling_stand"), 2.05, 0, 6.2, 0, { scale: 1, collider: true }));
  J(P(D("table_medium_tablecloth"), 2.75, 0, 7.6, 0, { height: top, collider: true }));
  J(P(D("candle_triple"), 3.3, top, 8.05, 0, { height: 0.32 })); J(P(D("box_small"), 2.25, top, 8.1, 25, { height: 0.2 }));
  J(P(M("sales_counter"), 2.55, 0, 2.1, 0, { scale: 1, collider: true }));
  J(P(D("plate"), 2.55, 1.04, 2.0, 0, { width: 0.42 })); J(P(F("book_single"), 3.3, 1.04, 2.3, 15, { width: 0.3 }));
  J(P(D("candle_triple"), 1.6, 1.04, 2.3, 0, { height: 0.3 })); J(P(D("chest_gold"), 3.55, 0, 3.0, -90, { height: 0.6, collider: true }));
  J(P(F("rug_rectangle_A"), 1.9, 0.005, 1.0, 0, { width: 2.4 })); J(P(F("rug_oval_A"), 0.4, 0.005, 3.5, 0, { width: 2 }));
  J(P(M("parchment_board"), 4.06, 1.35, 1.15, -90, { scale: 0.7 }));
  J(P(M("firas_pedestal"), -1.75, 0, 8.1, 0, { scale: 1, collider: true })); J(P(M("firas_crystal"), -1.75, 0.99, 8.1, 0, { scale: 1 }));
  light(-1.75, 1.4, 8.1, 0x40ffd9, 4, 4, false);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; J(P(D("candle_melted"), -1.75 + Math.cos(a) * 0.55, 0, 8.1 + Math.sin(a) * 0.55, R01() * 360, { height: 0.22 })); }

  // ---- shelves, torches, banners, corners
  const shelf = (x, z, yaw, len, levels, fill) => J(wallShelf(x, z, yaw, len, levels, fill));
  shelf(3.92, 3.3, -90, 1.8, [1.6, 2.2], [false, true]);
  shelf(-3.92, 9.9, 90, 2.2, [1.05, 1.55, 2.05]); shelf(-3.92, 2.9, 90, 1.8, [1.3, 1.85]);
  shelf(3.92, 9.9, -90, 2.2, [1.05, 1.55, 2.05]); shelf(3.92, 6.9, -90, 1.4, [1.45, 1.95]); shelf(3.0, 0.42, 0, 1.8, [1.4, 1.95]);
  for (const [x, y, z, yaw] of [[-4.02, 1.7, 4.6, 90], [-4.02, 1.7, 8.4, 90], [4.02, 1.7, 8.4, -90], [4.02, 1.7, 5.4, -90], [-1.7, 1.7, 11.55, 180], [1.7, 1.7, 11.55, 180]]) {
    J(P(D("torch_mounted"), x, y, z, yaw, { height: 0.55 }));
    const f = new THREE.Vector3(Math.sin(yaw * Math.PI / 180), 0, Math.cos(yaw * Math.PI / 180)).multiplyScalar(0.3);
    light(x + f.x, y + 0.5, z + f.z, 0xff8c38, 5, 6, true);
  }
  J(P(D("banner_patternA_red"), -3.1, 0.7, 11.5, 180, { height: 1.9 })); J(P(D("banner_patternC_green"), 3.1, 0.7, 11.5, 180, { height: 1.9 }));
  J(P(F("pictureframe_large_A"), -4.05, 1.25, 7.3, 90, { height: 0.9 }));
  J(P(D("barrel_large"), 3.6, 0, 11.3, 10, { height: 1, collider: true })); J(P(D("barrel_large"), 2.75, 0, 11.45, 70, { height: 0.95, collider: true }));
  J(P(D("barrel_small_stack"), 3.7, 0, 10.45, 0, { height: 1, collider: true })); J(P(D("keg_decorated"), 1.9, 0, 11.4, 0, { height: 0.75, collider: true }));
  J(P(D("crates_stacked"), -3.55, 0, 11.25, -15, { height: 1.3, collider: true })); J(P(R("crate_potatoes"), -2.55, 0, 11.45, 5, { height: 0.45, collider: true }));
  J(P(D("trunk_medium_A"), -1.6, 0, 11.4, 180, { height: 0.55, collider: true })); J(P(F("cabinet_medium_decorated"), -3.75, 0, 1.0, 90, { height: 1.5, collider: true }));
  J(P(F("armchair"), -3.3, 0, 5.0, 90, { height: 0.9, collider: true })); J(P(D("box_stacked"), 3.75, 0, 5.0, 0, { height: 0.8, collider: true }));
  J(P(D("chest"), -1.3, 0, 11.45, 180, { height: 0.55, collider: true }));

  await Promise.all(jobs);
  root.traverse(o => { if (o.isMesh) o.matrixAutoUpdate = o.matrixAutoUpdate; });
  return root;
}

const SHELF_BOTTLES = ["bottle_A_green", "bottle_B_green", "bottle_C_green", "bottle_A_brown", "bottle_B_brown", "bottle_C_brown", "bottle_A_labeled_green", "bottle_A_labeled_brown"];
const JARS = ["jar_A_small", "jar_B_small", "jar_C_small", "jar_D_small", "jar_A_medium", "jar_C_medium"];
const GLOW = [0x33f273, 0xf25933, 0x994dff, 0x40b3ff, 0xffcc40];
async function wallShelf(x, z, yaw, len, levels, fill) {
  const jobs = [];
  const r = yaw * Math.PI / 180, along = new THREE.Vector3(Math.cos(r), 0, -Math.sin(r)), out = new THREE.Vector3(Math.sin(r), 0, Math.cos(r));
  const at = new THREE.Vector3(x, 0, z);
  const UV = v => U(v.x, v.y, v.z);
  levels.forEach((y, l) => {
    box(root, UV(at.clone().addScaledVector(out, 0.17).setY(y - 0.03)), new THREE.Vector3(len, 0.05, 0.34), WOOD, { yaw: -yaw });
    for (const s of [-1, 1]) box(root, UV(at.clone().addScaledVector(along, s * (len / 2 - 0.12)).addScaledVector(out, 0.1).setY(y - 0.16)), new THREE.Vector3(0.05, 0.24, 0.2), DARK, { yaw: -yaw });
    if (fill && !fill[l]) return;
    let px = -len / 2 + 0.12;
    while (px < len / 2 - 0.12) {
      const p = at.clone().addScaledVector(along, px).addScaledVector(out, 0.15 + R01() * 0.06).setY(y);
      const k = R01(); let used;
      if (k < 0.32) { jobs.push(P(D(pick(SHELF_BOTTLES)), p.x, p.y, p.z, R01() * 360, { height: 0.2 + R01() * 0.1 })); used = 0.14; }
      else if (k < 0.55) { jobs.push(P(R(pick(JARS)), p.x, p.y, p.z, R01() * 360, { height: 0.18 + R01() * 0.1 })); used = 0.17; }
      else if (k < 0.8) { jobs.push(glowPotion(p, pick(GLOW))); used = 0.13; }
      else if (k < 0.93) { jobs.push(P(F("book_set"), p.x, p.y, p.z, yaw + 180, { height: 0.26 })); used = 0.36; }
      else { jobs.push(P(D("candle_melted"), p.x, p.y, p.z, 0, { height: 0.16 })); used = 0.1; }
      px += used + 0.03 + R01() * 0.05;
    }
  });
  await Promise.all(jobs);
}
async function glowPotion(p, color) {
  const b = await P(M("potion_bottle"), p.x, p.y, p.z, R01() * 360, { height: 0.18 + R01() * 0.08 });
  if (!b) return;
  const bb = box3(b), g = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color }));
  g.position.set((bb.min.x + bb.max.x) / 2, bb.min.y + (bb.max.y - bb.min.y) * 0.3, (bb.min.z + bb.max.z) / 2); root.add(g);
}
