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
    this.pile = []; this.doorRot = 0; this.doorGoal = 0; this.doorHold = 0; this.doorHeld = false; this.swingBack = null; this.low = false;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.4, 40), new THREE.MeshBasicMaterial({ color: 0x40ffd0, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
    this.mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xffc84d })); this.mark.visible = false; scene.add(this.mark);
  }
  add(mesh, life, tick) { this.scene.add(mesh); this.parts.push({ mesh, age: 0, life, tick }); }
  sparkle(at, n = 10, color = 0xffd873) {
    if (this.low) n = Math.ceil(n / 2);
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
  // Soft smoke wisps (sprites with a feathered edge): never a solid bubble over the cauldron.
  steam(from) {
    if (!this.puff) { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const c = cv.getContext("2d"), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); this.puff = new THREE.CanvasTexture(cv); }
    const mat = new THREE.SpriteMaterial({ map: this.puff, color: this.tint.clone().lerp(new THREE.Color(0xffffff), 0.35), transparent: true, opacity: 0, depthWrite: false });
    const m = new THREE.Sprite(mat); const spin = Math.random() * Math.PI * 2, base = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.06, (Math.random() - 0.5) * 0.6));
    const golden = this.golden, life = 3 + Math.random();
    this.add(m, life, p => {
      const r = 0.05 + p * 0.25; m.position.set(base.x + Math.cos(spin + p * 3) * r, base.y + p * 1.3, base.z + Math.sin(spin + p * 3) * r);
      m.scale.setScalar(0.18 + p * 0.5); mat.opacity = 0.32 * (1 - p) * Math.min(1, p / 0.2);
      if (golden && !this.low && Math.random() < 0.015) this.sparkle(m.position, 1);
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
  // Door: the player owns it (hand, E, trigger). Visitors swing it open and then put it back how it was.
  get doorOpen() { return this.doorRot > 0.9; }
  swingDoor() { if (this.doorRot > 1.2 || this.swingBack !== null) return; this.audio.play("creak"); this.swingBack = this.doorGoal; this.doorGoal = 1.66; this.doorHold = 4.2; }
  openDoor(open = true) { this.audio.play("creak"); this.doorGoal = open ? 1.66 : 0; this.swingBack = null; }
  update(dt, t, game) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.age += dt; const k = Math.min(1, p.age / p.life);
      p.tick(k, dt); if (k >= 1) { this.scene.remove(p.mesh); this.parts.splice(i, 1); }
    }
    // Brew: steam always, bubbles while brewing; both tinted by what is in the cauldron.
    this.steamT -= dt; if (this.steamT <= 0) { this.steamT = ((this.golden ? 0.12 : 0.28) - this.activity * 0.12) * (this.low ? 2.6 : 1); this.steam(L.liquid); }
    if (this.activity > 0 && Math.random() < this.activity * dt * (this.low ? 5 : 14)) this.bubble();
    this.audio.setBubbling(this.activity);
    // Door: swing inward, hold, close.
    if (this.swingBack !== null && this.doorRot > 1.6) { this.doorHold -= dt; if (this.doorHold <= 0) { this.doorGoal = this.swingBack; this.swingBack = null; if (this.doorGoal < 1) this.audio.play("creak", 0.9, 0.6); } }
    if (!this.doorHeld) { const d = this.doorGoal - this.doorRot; this.doorRot += Math.sign(d) * Math.min(Math.abs(d), dt * (0.6 + Math.abs(d) * 1.8)); }
    if (refs.door) refs.door.rotation.y = this.doorRot; // 0 = shut, 1.66 = open inward
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
