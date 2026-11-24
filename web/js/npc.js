// Animated characters (KayKit rigs + clips) and Firas the hologram guide.
import * as THREE from "three";
import { character } from "./assets.js";
import { L } from "./layout.js";

class Animated {
  constructor(c) {
    this.holder = c.holder; this.mixer = new THREE.AnimationMixer(c.model);
    this.clips = Object.fromEntries(c.clips.map(k => [k.name, k])); this.current = null;
  }
  play(name, fade = 0.25, once = false) {
    const clip = this.clips[name]; if (!clip || this.current === name && !once) return;
    const a = this.mixer.clipAction(clip); a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once;
    if (this.action && this.action !== a) a.crossFadeFrom(this.action, fade, false);
    a.play(); this.action = a; this.current = name;
    if (once) { const back = () => { if (this.action === a) this.play("Idle"); }; setTimeout(back, clip.duration * 1000 - 200); }
  }
}

export class NPC extends Animated {
  // role: "Customer" | "Merchant" | "Trader"
  constructor(c, role, speaker, spot) { super(c); this.role = role; this.speaker = speaker; this.spot = spot; this.arrived = false; this.walking = false; this.gestureAt = 0; this.gesture = 0; this.holder.visible = false; }
  static async create(scene, url, height, role, speaker, spot) {
    const c = await character(url, height); if (!c) return null;
    const n = new NPC(c, role, speaker, spot); scene.add(n.holder); n.holder.position.copy(L.customerPath[0]); n.play("Idle"); return n;
  }
  get head() { return this.holder.position.clone().add(new THREE.Vector3(0, this.role === "Merchant" ? 1.95 : 1.85, 0)); }
  async arrive(game) {
    if (this.arrived || this.walking) return; this.walking = true; this.holder.visible = true;
    await sleep(game.fast ? 50 : 900); game.fx.swingDoor(); await sleep(game.fast ? 50 : 800);
    await this.walk([...L.customerPath.slice(1), this.spot], game);
    await this.face(new THREE.Vector3(0, 0, 1)); // toward the counter (+Z into the shop)
    this.play("Idle"); this.walking = false; this.arrived = true;
  }
  async leave(game) {
    if (!this.arrived) return; this.arrived = false; this.walking = true;
    await sleep(1200); game.fx.swingDoor();
    await this.walk([L.customerPath[2], L.customerPath[1], L.customerPath[0].clone().add(new THREE.Vector3(0, 0, -0.4))], game);
    this.holder.visible = false; this.walking = false;
  }
  walk(points, game) {
    this.play("Walking_A");
    return new Promise(res => { this.path = points.map(p => p.clone()); this.onPath = res; this.speed = game.fast ? 6 : 1.05; });
  }
  face(dir) { return new Promise(res => { this.faceDir = dir.clone().normalize(); this.onFace = res; }); }
  react(happy) { this.whenArrived(() => this.play(happy ? "Cheer" : "Hit_A", 0.2, true)); }
  receive() { this.whenArrived(() => this.play("Interact", 0.2, true)); }
  whenArrived(f) { if (this.arrived) f(); else { const t = setInterval(() => { if (this.arrived) { clearInterval(t); f(); } }, 200); setTimeout(() => clearInterval(t), 8000); } }
  update(dt, t, dialogue) {
    this.mixer.update(dt);
    const h = this.holder;
    if (this.path && this.path.length) {
      const target = this.path[0], d = target.clone().sub(h.position); d.y = 0;
      const step = this.speed * dt;
      if (d.length() <= step) { h.position.copy(target); this.path.shift(); if (!this.path.length) { this.path = null; this.onPath && this.onPath(); } }
      else { h.position.addScaledVector(d.normalize(), step); turnToward(h, d, dt * 4); }
    } else if (this.faceDir) {
      if (turnToward(h, this.faceDir, dt * 4)) { this.faceDir = null; this.onFace && this.onFace(); }
    }
    if (this.arrived && dialogue.speaking && dialogue.speaker === this.speaker && t > this.gestureAt) {
      this.gestureAt = t + 2.4; this.play(this.gesture++ % 2 === 0 ? "Interact" : "Use_Item", 0.2, true);
    }
  }
}

// yaw so that model forward (+Z) points along dir; returns true when aligned.
function turnToward(obj, dir, rate) {
  const want = Math.atan2(dir.x, dir.z); let diff = want - obj.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  obj.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), rate);
  return Math.abs(diff) < 0.02;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class Firas extends Animated {
  static async create(scene) {
    const c = await character("assets/kaykit/Characters/Mage.glb", L.firasHeight); if (!c) return null;
    const f = new Firas(c); scene.add(f.holder); return f;
  }
  constructor(c) {
    super(c);
    // Solid, softly glowing teal projection (not glass).
    this.mats = [];
    c.model.traverse(o => { if (o.isMesh) {
      const src = o.material; const m = new THREE.MeshStandardMaterial({ map: src.map || null, color: 0x8ffff0, emissive: 0x1a9e85, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.88, roughness: 0.6, metalness: 0 });
      o.material = m; o.castShadow = false; this.mats.push(m); } });
    this.home = L.firasSpot.clone(); this.pos = this.home.clone(); this.vel = new THREE.Vector3();
    this.holder.position.copy(this.home); this.holder.scale.setScalar(0.001); this.shown = false; this.appear = 0; this.trail = 0;
    this.play("Idle");
  }
  get head() { return this.pos.clone().add(new THREE.Vector3(0, L.firasHeight + 0.12, 0)); }
  show(game) { if (this.shown) return; this.shown = true; game.audio.play("crystal"); game.fx.sparkle(this.home, 16); this.play("Spellcast_Raise", 0.2, true); }
  update(dt, t, game, target) {
    this.mixer.update(dt);
    if (!this.shown) return;
    this.appear = Math.min(1, this.appear + dt / 1.6);
    const e = this.appear * this.appear * (3 - 2 * this.appear), w = THREE.MathUtils.lerp(0.15, 1, THREE.MathUtils.clamp(e * 1.6 - 0.4, 0, 1));
    this.holder.scale.set(w, Math.max(0.001, e), w);
    // Smooth flight toward the active station.
    const goal = this.appear >= 1 ? target : this.home;
    const k = 1 - Math.exp(-dt * 2.2); const before = this.pos.clone();
    this.pos.lerp(goal, k); const speed = before.distanceTo(this.pos) / Math.max(dt, 1e-4);
    this.holder.position.copy(this.pos).add(new THREE.Vector3(0, Math.sin(t * 1.5) * 0.035, 0));
    if (speed > 0.25 && (this.trail -= dt) <= 0) { this.trail = 0.12; game.fx.sparkle(this.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 1); }
    // Face the player.
    const cam = new THREE.Vector3(); game.camera.getWorldPosition(cam); const d = cam.sub(this.holder.position); d.y = 0;
    turnToward(this.holder, d, dt * 3);
    const talking = game.dialogue.speaking && game.dialogue.speaker === "فراس";
    for (const m of this.mats) m.emissiveIntensity = (talking ? 0.9 + Math.sin(t * 6) * 0.2 : 0.55) * e;
    if (this.appear >= 1 && this.current !== "Spellcast_Raise") this.play(talking && speed < 0.25 ? "Spellcasting" : "Idle");
  }
}
