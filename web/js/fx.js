// Visual effects: steam, bubbles, sparkles, coins, door swing, crush bits, station ring, speaker marker.
import * as THREE from "three";
import { L } from "./layout.js";
import { refs } from "./shop.js";

const sphere = new THREE.SphereGeometry(1, 12, 8);
export class FX {
  constructor(scene, audio) {
    this.scene = scene; this.audio = audio; this.parts = []; this.coins = []; this.steamT = 0; this.tint = new THREE.Color(0xd9e0dc); this.golden = false; this.activity = 0;
    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xd9a032, metalness: 0.8, roughness: 0.35 });
    this.coinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.004, 16);
    this.pile = []; this.doorAngle = 0; this.doorTarget = 0; this.doorHold = 0;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.4, 40), new THREE.MeshBasicMaterial({ color: 0x40ffd0, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
    this.mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xffc84d })); this.mark.visible = false; scene.add(this.mark);
  }
  add(mesh, life, tick) { this.scene.add(mesh); this.parts.push({ mesh, age: 0, life, tick }); }
  sparkle(at, n = 10, color = 0xffd873) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color })); m.scale.setScalar(0.012); m.position.copy(at);
      const v = new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.35, (Math.random() - 0.5) * 0.5);
      this.add(m, 0.9, (p, dt) => { m.position.addScaledVector(v, dt); v.y -= 0.5 * dt; m.scale.setScalar(0.012 * (1 - p)); });
    }
  }
  bits(at, color, n = 6) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color })); m.scale.setScalar(0.01); m.position.copy(at);
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2);
      this.add(m, 0.6, (p, dt) => { m.position.addScaledVector(v, dt); v.y -= 6 * dt; });
    }
  }
  steam(from) {
    const mat = new THREE.MeshBasicMaterial({ color: this.tint.clone(), transparent: true, opacity: 0, depthWrite: false });
    const m = new THREE.Mesh(sphere, mat); const spin = Math.random() * Math.PI * 2, base = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.05, (Math.random() - 0.5) * 0.5));
    const golden = this.golden;
    this.add(m, golden ? 3.2 : 2.8, p => {
      const r = 0.08 + p * 0.35; m.position.set(base.x + Math.cos(spin + p * 5) * r, base.y + p * 1.5, base.z + Math.sin(spin + p * 5) * r);
      m.scale.setScalar(0.1 + p * 0.45); mat.opacity = 0.18 * (1 - p) * (p < 0.15 ? p / 0.15 : 1);
      if (golden && Math.random() < 0.02) this.sparkle(m.position, 1);
    });
  }
  bubble() {
    const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: this.tint.clone().multiplyScalar(1.3) }));
    m.position.copy(L.liquid).add(new THREE.Vector3((Math.random() - 0.5) * 0.36, 0.02, (Math.random() - 0.5) * 0.36));
    const s = 0.012 + Math.random() * 0.012; this.add(m, 0.8, p => { m.position.y += 0.0008; m.scale.setScalar(s * (1 + p * 0.6)); });
  }
  coinsTo(amount, from) {
    const n = Math.max(3, Math.min(9, Math.floor(amount / 6))); this.audio.play("coins");
    for (let i = 0; i < n; i++) setTimeout(() => {
      const c = new THREE.Mesh(this.coinGeo, this.coinMat); c.position.copy(from); this.scene.add(c);
      const slot = this.pile.length, end = L.coinPile.clone().add(new THREE.Vector3((slot % 3) * 0.05 - 0.05, Math.floor(slot / 3) * 0.009, (Math.floor(slot / 3) % 2) * 0.02));
      this.pile.push(c);
      this.add(new THREE.Object3D(), 0.55, p => { c.position.lerpVectors(from, end, p).y += Math.sin(p * Math.PI) * 0.25; c.rotation.set(p * 12, p * 3, 0); if (p >= 0.98) c.rotation.set(0, 0, 0); });
    }, i * 60);
  }
  payOut(to) {
    this.audio.play("coins", 0.85);
    for (let i = 0; i < 3 && this.pile.length; i++) { const c = this.pile.pop(), from = c.position.clone();
      this.add(new THREE.Object3D(), 0.5, p => { c.position.lerpVectors(from, to, p).y += Math.sin(p * Math.PI) * 0.2; if (p >= 0.98) this.scene.remove(c); }); }
  }
  swingDoor() { if (this.doorTarget === 0) { this.audio.play("creak"); this.doorTarget = 1; this.doorHold = 4.2; } }
  openDoor() { this.audio.play("creak"); this.doorTarget = 1; this.doorHold = Infinity; }
  update(dt, t, game) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.age += dt; const k = Math.min(1, p.age / p.life);
      p.tick(k, dt); if (k >= 1) { this.scene.remove(p.mesh); this.parts.splice(i, 1); }
    }
    // Brew: steam always, bubbles while brewing; both tinted by what is in the cauldron.
    this.steamT -= dt; if (this.steamT <= 0) { this.steamT = (this.golden ? 0.12 : 0.28) - this.activity * 0.12; this.steam(L.liquid); }
    if (this.activity > 0 && Math.random() < this.activity * dt * 14) this.bubble();
    this.audio.setBubbling(this.activity);
    // Door: swing inward, hold, close.
    if (this.doorTarget === 1 && this.doorAngle >= 0.999) { this.doorHold -= dt; if (this.doorHold <= 0) this.doorTarget = 0; }
    this.doorAngle += Math.sign(this.doorTarget - this.doorAngle) * Math.min(Math.abs(this.doorTarget - this.doorAngle), dt / 1.1);
    if (refs.door) refs.door.rotation.y = smooth(this.doorAngle) * 1.66; // ~95 deg inward
    // Floor ring + speaker gem.
    const st = game.stationName(), view = game.station();
    const show = view && st !== "welcome" && st !== "ending" && (game.inVR || !game.focused);
    if (show) { const cam = new THREE.Vector3(); game.camera.getWorldPosition(cam); cam.y = 0; this.ring.visible = cam.distanceTo(new THREE.Vector3(view.stand.x, 0, view.stand.z)) > 0.55;
      this.ring.position.set(view.stand.x, 0.015, view.stand.z); this.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 3)); } else this.ring.visible = false;
    const head = game.speakerHead();
    this.mark.visible = !!head; if (head) { this.mark.position.copy(head).y += 0.12 + Math.sin(t * 4) * 0.04; this.mark.rotation.y = t * 1.6; this.mark.material.color.set(game.dialogue.speaker === "فراس" ? 0x4dffd9 : 0xffc84d); }
  }
}
const smooth = x => x * x * (3 - 2 * x);
