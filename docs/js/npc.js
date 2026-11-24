// Animated characters (KayKit rigs + clips) and Firas the hologram guide.
import * as THREE from "three";
import { character, colliders } from "./assets.js";
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
  constructor(c, role, speaker, spot) { super(c); this.role = role; this.speaker = speaker; this.spot = spot; this.arrived = false; this.walking = false; this.baseYaw = 0; this.gestureAt = 0; this.gesture = 0; this.holder.visible = false; }
  static async create(scene, url, height, role, speaker, spot) {
    const c = await character(url, height); if (!c) return null;
    const n = new NPC(c, role, speaker, spot); scene.add(n.holder); n.holder.position.copy(L.customerPath[0]); n.play("Idle"); return n;
  }
  // Stand at a fixed spot already 'arrived' (the market vendor).
  standAt(pos, yaw) { this.holder.position.copy(pos); this.holder.rotation.y = yaw; this.baseYaw = yaw; this.holder.visible = true; this.arrived = true; this.walking = false; this.path = null; this.play("Idle"); }
  reset() { this.gen = (this.gen || 0) + 1; this.onPath = this.onFace = null; this.faceDir = null; this.play("Idle"); this.arrived = false; this.walking = false; this.path = null; this.holder.visible = false; this.holder.position.copy(L.customerPath[0]); }
  get head() { return this.holder.position.clone().add(new THREE.Vector3(0, this.role === "Merchant" ? 1.95 : 1.85, 0)); }
  async arrive(game) {
    if (this.arrived || this.walking) return; this.walking = true; this.holder.visible = true; const gen = this.gen = (this.gen || 0) + 1;
    this.holder.position.copy(L.customerPath[0]);
    await sleep(game.fast ? 50 : 900); if (gen !== this.gen) return; game.fx.swingDoor(); await sleep(game.fast ? 50 : 800); if (gen !== this.gen) return;
    this.game = game; await this.walk([...L.customerPath.slice(1), this.spot], game); if (gen !== this.gen) return;
    await this.face(new THREE.Vector3(0, 0, 1)); if (gen !== this.gen) return; // toward the counter (+Z into the shop)
    this.play("Idle"); this.walking = false; this.arrived = true; this.baseYaw = 0;
  }
  async leave(game) {
    if (!this.arrived) return; this.arrived = false; this.walking = true; const gen = this.gen = (this.gen || 0) + 1;
    await sleep(1200); if (gen !== this.gen) return; game.fx.swingDoor();
    await this.walk([L.customerPath[2], L.customerPath[1], L.customerPath[0].clone().add(new THREE.Vector3(0, 0, -0.4))], game);
    if (gen !== this.gen) return; this.holder.visible = false; this.walking = false;
  }
  walk(points, game) {
    this.play("Walking_A");
    return new Promise(res => { this.path = points.map(p => p.clone()); this.onPath = res; this.speed = game.fast ? 6 : 1.05; });
  }
  face(dir) { return new Promise(res => { this.faceDir = dir.clone().normalize(); this.onFace = res; }); }
  react(happy) { this.whenArrived(() => this.play(happy ? "Cheer" : "Hit_A", 0.2, true)); }
  receive() { this.whenArrived(() => this.play("Interact", 0.2, true)); }
  whenArrived(f) { if (this.arrived) f(); else { const t = setInterval(() => { if (this.arrived) { clearInterval(t); f(); } }, 200); setTimeout(() => clearInterval(t), 8000); } }
  update(dt, t, dialogue, eye, game) {
    this.mixer.update(dt);
    const h = this.holder;
    if (this.path && this.path.length && game && !game.fast && (this.stepT = (this.stepT || 0) - dt) <= 0) { this.stepT = 0.42; const d = eye.distanceTo(h.position); if (d < 9) game.audio.play("step", 0.8 + Math.random() * 0.3, Math.min(0.8, 2.2 / (d + 0.5))); }
    if (this.path && this.path.length) {
      const target = this.path[0], d = target.clone().sub(h.position); d.y = 0;
      const step = this.speed * dt;
      if (d.length() <= step) { h.position.copy(target); this.path.shift(); if (!this.path.length) { this.path = null; this.onPath && this.onPath(); } }
      else { h.position.addScaledVector(d.normalize(), step); turnToward(h, d, dt * 4); }
    } else if (this.faceDir) {
      if (turnToward(h, this.faceDir, dt * 4)) { this.faceDir = null; this.onFace && this.onFace(); }
    } else if (this.arrived && eye) {
      // Look at the player while standing at the counter (within a comfortable turn from the counter).
      const d = eye.clone().sub(h.position); d.y = 0; let rel = Math.atan2(d.x, d.z) - this.baseYaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const yaw = this.baseYaw + THREE.MathUtils.clamp(rel, -1.2, 1.2);
      turnToward(h, new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), dt * 2.5);
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
// Firas's body is about 0.6 m wide and 1.3 m tall; keep him out of anything solid.
function freeSpot(p) {
  return !colliders.some(b => p.x > b.min.x - 0.32 && p.x < b.max.x + 0.32 && p.z > b.min.z - 0.32 && p.z < b.max.z + 0.32 && b.max.y > p.y + 0.05 && b.min.y < p.y + 1.35);
}
function frontSpot(eye, f) {
  const side = new THREE.Vector3(-f.z, 0, f.x);
  for (const [d, s] of [[1.6, 0.55], [1.6, -0.55], [1.3, 0.8], [1.3, -0.8], [1.9, 0.9], [1.9, -0.9], [1.15, 0.35], [1.15, -0.35], [2.2, 0]]) {
    const p = eye.clone().addScaledVector(f, d).addScaledVector(side, s); p.y = Math.max(0.15, eye.y - L.firasHeight - 0.05);
    if (L.isInside(eye) && !L.isInside(p)) continue;
    if (freeSpot(p)) return p;
  }
  const p = eye.clone().addScaledVector(f, 0.9).addScaledVector(side, 0.6); p.y = Math.max(0.15, eye.y - L.firasHeight - 0.05); return p;
}

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
  resetTo(p) { this.pos.copy(p); this.holder.position.copy(p); this.talkGoal = null; }
  show(game) { if (this.shown) return; this.shown = true; game.audio.play("crystal"); game.fx.sparkle(this.home, 16); this.play("Spellcast_Raise", 0.2, true); }
  update(dt, t, game, target) {
    this.mixer.update(dt);
    if (!this.shown) return;
    this.appear = Math.min(1, this.appear + dt / 1.6);
    const e = this.appear * this.appear * (3 - 2 * this.appear), w = THREE.MathUtils.lerp(0.15, 1, THREE.MathUtils.clamp(e * 1.6 - 0.4, 0, 1));
    this.holder.scale.set(w, Math.max(0.001, e), w);
    // Smooth flight toward the active station.
    const talking0 = game.dialogue.speaking && game.dialogue.speaker === "فراس";
    let goal = this.appear >= 1 ? target : this.home;
    if (this.appear >= 1 && talking0) {
      const eye = game.camera.getWorldPosition(new THREE.Vector3()), f = new THREE.Vector3(); game.camera.getWorldDirection(f); f.y = 0; f.normalize();
      const side = new THREE.Vector3(-f.z, 0, f.x);
      if (!this.talkGoal || this.talkGoal.distanceTo(eye) > 2.6 || this.talkGoal.distanceTo(eye) < 0.7 || !freeSpot(this.talkGoal) || this.talkGoal.clone().sub(eye).setY(0).normalize().dot(f) < 0.35) this.talkGoal = frontSpot(eye, f);
      goal = this.talkGoal;
    } else this.talkGoal = null;
    const k = 1 - Math.exp(-dt * 2.2); const before = this.pos.clone();
    this.pos.lerp(goal, k); const speed = before.distanceTo(this.pos) / Math.max(dt, 1e-4);
    this.holder.position.copy(this.pos).add(new THREE.Vector3(0, Math.sin(t * 1.5) * 0.035, 0));
    if (speed > 1.2 && !this.zoom) { this.zoom = true; game.audio.play("whoosh", 0.8, 0.35); } else if (speed < 0.3) this.zoom = false;
    if (speed > 0.25 && (this.trail -= dt) <= 0) { this.trail = 0.12; game.fx.sparkle(this.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 1); }
    // Face the player.
    const cam = new THREE.Vector3(); game.camera.getWorldPosition(cam); const d = cam.sub(this.holder.position); d.y = 0;
    turnToward(this.holder, d, dt * 3);
    const talking = game.dialogue.speaking && game.dialogue.speaker === "فراس";
    for (const m of this.mats) m.emissiveIntensity = (talking ? 0.9 + Math.sin(t * 6) * 0.2 : 0.55) * e;
    if (this.appear >= 1 && this.current !== "Spellcast_Raise") this.play(talking && speed < 0.25 ? "Spellcasting" : "Idle");
  }
}
