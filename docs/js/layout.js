// Floor plan (metres, Y up, +Z = into the shop). Same plan as the Unity version.
// Interior x in [-4.5, 4.5], z in [0, 12]; entrance in the south wall at x = 0.
import * as THREE from "three";
// Numbers are written in the Unity version's coordinates; U() mirrors X so the web shop looks identical
// (Unity is left-handed, three.js/glTF right-handed). Yaw values convert with uyaw().
export const U = (x, y, z) => new THREE.Vector3(-x, y, z);
export const uyaw = deg => THREE.MathUtils.degToRad(-deg);
const V = U;
// three.js camera yaw for a Unity heading (0 = facing +Z into the shop).
export const camYaw = unityDeg => Math.PI - THREE.MathUtils.degToRad(unityDeg);

export const L = {
  tableTop: 0.9,
  cauldron: V(0, 0, 6.2), innerRadius: 0.54, liquidHeight: 0.86,
  get liquid() { return V(0, 0.86, 6.2); },
  ingredientTable: V(-2.75, 0, 6.2),
  herbSpot: V(-2.12, 0.9, 5.45), crystalSpot: V(-2.12, 0.9, 6.2), waterSpot: V(-2.12, 0.9, 6.95), wiltedSpot: V(-2.2, 0.9, 4.8),
  mortarTable: V(-1.85, 0, 4.2), get mortar() { return V(-1.85, 0.92, 4.2); }, pestleSpot: V(-1.5, 0.9, 4.05),
  paddleSpot: V(1.05, 0.02, 5.25),
  bottlingStand: V(2.05, 0, 6.2), get bottleSocket() { return V(2.05, 1.0, 6.2); }, bottleTable: V(2.75, 0, 7.6),
  emptyBottle: i => V(2.45 + i * 0.3, 0.9, 7.45), finishedBottle: i => V(2.45 + i * 0.3, 0.9, 7.8),
  counter: V(2.55, 0, 2.1), handoff: V(2.55, 1.04, 2.0), saleBottle: V(1.9, 1.04, 2.15), coinPile: V(3.25, 1.04, 2.15),
  customerSpot: V(2.55, 0, 1.25), traderSpot: V(1.6, 0, 1.3),
  display: i => V(3.9, 1.62, 3.2 + i * 0.3), discard: V(3.6, 0.35, 0.95),
  firasPedestal: V(-1.75, 0, 8.1), get firasSpot() { return V(-1.75, 1.12, 8.1); }, firasHeight: 1.15,
  doorHinge: V(-0.6, 0, 0.02),
  outsideStart: V(0, 0, -5.4), insideStart: V(0.6, 0, 3.4), outsideYaw: camYaw(0), insideYaw: camYaw(20),
  isInside: p => p.z > 0.9 && Math.abs(p.x) < 4.5 && p.z < 12,
  customerPath: [V(0, 0, -2.4), V(0, 0, -0.6), V(0.2, 0, 1.0)],
  // Village market stall (scene 1): ingredients in a row on the stall front, basket at the shop end.
  stall: V(-2.9, 0, -4.3), marketItem: i => V(-2.36, 0.9, -5.35 + i * 0.3), basket: V(-2.4, 0.9, -2.9), vendorSpot: V(-4.3, 0, -4.3),
  pipetteSpot: V(2.25, 0.92, 7.3),
};

// Where each step happens: desktop camera view (cam/look), VR "stand here" ring (stand), Firas's spot.
const C = L.cauldron;
export const Stations = {
  welcome: { cam: null, look: null, stand: L.insideStart, firas: V(-0.45, 0.8, 4.85) },
  market: { cam: V(-0.55, 1.8, -4.3), look: V(-2.7, 1.2, -4.3), stand: V(-1.1, 0, -4.3), firas: V(-1.5, 0.8, -6.7) },
  ingredients: { cam: V(-0.95, 2.05, 4.2), look: V(-2.0, 0.9, 4.9), stand: V(-1.2, 0, 4.6), firas: V(-2.9, 0.8, 3.3) },
  mortar: { cam: V(-1.45, 1.62, 3.45), look: V(-1.85, 0.92, 4.2), stand: V(-1.55, 0, 3.5), firas: V(-2.75, 0.8, 3.7) },
  mix: { cam: V(-1.05, 2.3, 4.55), look: V(-1.05, 0.9, 6.2), stand: V(-1.0, 0, 5.0), firas: V(-1.7, 0.8, 7.85) },
  cauldron: { cam: V(0, 2.45, C.z - 1.05), look: V(0, 0.86, C.z), stand: V(0, 0, C.z - 1.1), firas: V(1.85, 0.7, C.z + 0.55) },
  bottling: { cam: V(1.2, 1.75, 5.4), look: V(2.1, 1.08, 6.45), stand: V(1.35, 0, 5.55), firas: V(3.35, 0.8, 6.75) },
  counter: { cam: V(2.45, 1.62, 3.4), look: V(2.5, 1.3, 1.35), stand: V(2.4, 0, 3.3), firas: V(1.05, 0.85, 2.5) },
  ending: { cam: V(-2.9, 2.35, 10.7), look: V(0.2, 1.0, 5.6), stand: V(-0.6, 0, 3.6), firas: L.firasSpot },
};
for (const s of Object.values(Stations)) {
  const d = (s.look || V(0, 0, 9)).clone().sub(s.stand); s.standYaw = Math.atan2(-d.x, -d.z); // three.js camera yaw
}
