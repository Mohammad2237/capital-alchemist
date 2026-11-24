// HUD: one state, two views. HTML on desktop/phone (native Arabic shaping); a floating parchment panel in VR
// (canvas texture) that follows the head lazily and is clicked with the controller ray.
import * as THREE from "three";

const $ = id => document.getElementById(id);
export class UI {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.st = { objective: "", cash: 100, subtitle: "", talk: null, modal: null, actions: [], toast: "", progress: "", hint: "" };
    this.toastUntil = 0; this.lastCash = 100; this.shownCash = 100;
    $("btn-book").onclick = () => this.onBook && this.onBook();
    $("btn-station").onclick = () => this.onStation && this.onStation();
    // VR panel
    this.canvas = document.createElement("canvas"); this.canvas.width = 1024; this.canvas.height = 720;
    this.ctx = this.canvas.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.879), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.panel.renderOrder = 10; this.panel.visible = false; scene.add(this.panel);
    this.hits = []; this.dirty = true; this.following = true;
  }
  set(k, v) { if (this.st[k] !== v) { this.st[k] = v; this.dirty = true; this.renderDom(k); } }
  objective(s) { this.set("objective", s || ""); }
  progress(s) { this.set("progress", s || ""); }
  hint(s) { this.set("hint", s || ""); }
  subtitle(s) { this.set("subtitle", s || ""); }
  toast(s) { this.set("toast", s || ""); this.toastUntil = performance.now() + 3000; }
  actions(...c) { this.st.actions = c; this.dirty = true; this.renderDom("actions"); }
  talk(speaker, line, ...choices) { this.st.talk = { speaker, line, choices }; this.st.modal = null; this.dirty = true; this.renderDom("talk"); this.renderDom("modal"); }
  modal(title, body, ...choices) { this.st.modal = { title, body, choices }; this.st.talk = null; this.dirty = true; this.renderDom("talk"); this.renderDom("modal"); }
  close() { this.st.talk = null; this.st.modal = null; this.dirty = true; this.renderDom("talk"); this.renderDom("modal"); }
  get busy() { return !!(this.st.talk || this.st.modal); }

  renderDom(k) {
    const s = this.st;
    if (k === "objective") $("step").textContent = s.objective;
    if (k === "toast") { $("toast").textContent = s.toast; $("toast").style.opacity = s.toast ? 1 : 0; }
    if (k === "progress") $("progress").textContent = s.progress;
    if (k === "hint") $("hint").textContent = s.hint;
    if (k === "subtitle") { $("subtitle").textContent = s.subtitle; $("subtitle").hidden = !s.subtitle || !!s.talk; }
    if (k === "actions") this.buttons($("actions"), s.actions);
    if (k === "talk") {
      $("talk").hidden = !s.talk;
      if (s.talk) { $("talk").querySelector(".name").textContent = s.talk.speaker; $("talk").querySelector(".line").textContent = s.talk.line; this.buttons($("talk").querySelector(".choices"), s.talk.choices); }
      $("subtitle").hidden = !s.subtitle || !!s.talk;
    }
    if (k === "modal") {
      $("modal").hidden = !s.modal;
      if (s.modal) { $("modal").querySelector("h3").textContent = s.modal.title; $("modal").querySelector(".body").textContent = s.modal.body; this.buttons($("modal").querySelector(".choices"), s.modal.choices); }
    }
  }
  buttons(el, choices) {
    el.innerHTML = "";
    for (const c of choices) { const b = document.createElement("button"); b.textContent = c.text; b.onclick = e => { e.stopPropagation(); this.click(c); }; el.appendChild(b); }
  }
  click(c) { this.onClick && this.onClick(); c.action(); }

  update(dt, cash, inVR) {
    if (cash !== this.lastCash) {
      const d = cash - this.lastCash; this.lastCash = cash;
      const el = $("delta"); el.textContent = (d > 0 ? "+" : "") + d; el.style.color = d > 0 ? "#7dff8c" : "#ff7a66";
      el.classList.remove("show"); void el.offsetWidth; el.classList.add("show"); clearTimeout(this.dt); this.dt = setTimeout(() => el.classList.remove("show"), 1600);
    }
    if (this.shownCash !== cash) {
      this.shownCash += Math.sign(cash - this.shownCash) * Math.max(1, Math.round(Math.abs(cash - this.shownCash) * 0.15));
      $("cash").textContent = this.shownCash; this.st.cash = this.shownCash; this.dirty = true;
    }
    if (this.st.toast && performance.now() > this.toastUntil) this.toast("");
    if (inVR) this.updatePanel(dt);
    this.panel.visible = inVR;
  }

  // ---------------------------------------------------------------- VR panel
  updatePanel(dt) {
    const cam = this.camera, head = new THREE.Vector3(), fwd = new THREE.Vector3();
    cam.getWorldPosition(head); cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const to = this.panel.position.clone().sub(head); to.y = 0;
    if (to.angleTo(fwd) > 0.65 || to.length() > 2.4 || to.length() < 0.6) this.following = true;
    if (this.following) {
      const target = head.clone().addScaledVector(fwd, 1.35); target.y = head.y - 0.2;
      this.panel.position.lerp(target, Math.min(1, dt * 3));
      this.panel.lookAt(head);
      if (this.panel.position.distanceTo(target) < 0.03) this.following = false;
    }
    if (this.dirty) { this.draw(); this.dirty = false; }
  }
  draw() {
    const c = this.ctx, W = 1024, H = 720, s = this.st; this.hits = [];
    c.clearRect(0, 0, W, H);
    const panel = (x, y, w, h, fill, stroke) => { c.fillStyle = fill; c.strokeStyle = stroke; c.lineWidth = 5; c.beginPath(); c.roundRect(x, y, w, h, 16); c.fill(); c.stroke(); };
    c.direction = "rtl"; c.textBaseline = "middle"; c.textAlign = "center";
    // top: the one current step (big) + purse
    if (s.objective) { panel(150, 6, 868, 92, "rgba(20,27,23,.94)", "#c2873a"); c.fillStyle = "#ffe7b0"; c.font = "bold 50px Amiri"; c.fillText(fit(c, s.objective, 840), 584, 54); }
    panel(6, 6, 136, 92, "rgba(20,27,23,.94)", "#c2873a"); c.fillStyle = "#ffcf7a"; c.font = "bold 48px Amiri"; c.fillText(String(s.cash), 74, 54);
    if (s.toast) { c.fillStyle = "#ffcf7a"; c.font = "bold 40px Amiri"; c.strokeStyle = "rgba(0,0,0,.8)"; c.lineWidth = 8; c.strokeText(fit(c, s.toast, 980), 512, 126); c.fillText(fit(c, s.toast, 980), 512, 132); }
    if (s.progress) { c.fillStyle = "#7dffc0"; c.font = "bold 42px Amiri"; c.strokeStyle = "rgba(0,0,0,.8)"; c.lineWidth = 8; c.strokeText(s.progress, 512, 174); c.fillText(s.progress, 512, 174); }
    const box = s.talk || s.modal;
    if (box) {
      const y0 = 228, h = 484, btnY = y0 + h - 118;
      panel(16, y0, 992, h, "#ecd9ab", "#73501c");
      if (s.talk) { panel(352, y0 - 26, 320, 58, "#1f3a30", "#c2873a"); c.font = "bold 36px Amiri"; c.fillStyle = "#ffcf7a"; c.fillText(s.talk.speaker, 512, y0 + 3); }
      else { c.font = "bold 44px Amiri"; c.fillStyle = "#301e13"; c.fillText(s.modal.title, 512, y0 + 46); }
      c.fillStyle = "#301e13"; const big = !!s.talk; c.font = (big ? "bold 44px" : "32px") + " Amiri";
      const lines = wrap(c, s.talk ? s.talk.line : s.modal.body, 940), step = big ? 58 : 42, top = y0 + (big ? 80 : 100);
      lines.slice(0, big ? 5 : 7).forEach((l, i) => c.fillText(l, 512, top + i * step));
      this.drawButtons(box.choices, btnY);
    } else if (s.actions.length) this.drawButtons(s.actions, 470);
    if (s.subtitle && !box) {
      c.font = "bold 40px Amiri"; const lines = wrap(c, s.subtitle, 950).slice(0, 2), hh = 30 + lines.length * 52;
      panel(10, H - hh - 6, 1004, hh, "rgba(20,27,23,.94)", "#c2873a"); c.fillStyle = "#ffe7b0";
      lines.forEach((l, i) => c.fillText(l, 512, H - hh - 6 + 41 + i * 52));
    }
    this.tex.needsUpdate = true;
  }
  drawButtons(choices, y) {
    const c = this.ctx, n = choices.length, gap = 18, w = Math.min(380, (980 - gap * (n - 1)) / n), total = n * w + (n - 1) * gap;
    choices.forEach((ch, i) => {
      const x = 512 + total / 2 - (i + 1) * w - i * gap, hov = this.hover === ch; // RTL order
      c.fillStyle = "rgba(0,0,0,.35)"; c.beginPath(); c.roundRect(x + 4, y + 8, w, 100, 16); c.fill();
      const g = c.createLinearGradient(0, y, 0, y + 100); g.addColorStop(0, hov ? "#4f8f74" : "#2c5a48"); g.addColorStop(1, hov ? "#2f6b55" : "#183328");
      c.fillStyle = g; c.strokeStyle = hov ? "#ffe08a" : "#c2873a"; c.lineWidth = hov ? 7 : 5;
      c.beginPath(); c.roundRect(x, y, w, 100, 16); c.fill(); c.stroke();
      c.fillStyle = "#fff1cf"; c.font = "bold 40px Amiri"; c.fillText(fit(c, ch.text, w - 24), x + w / 2, y + 52);
      this.hits.push({ x, y, w, h: 100, ch });
    });
  }
  // Controller ray hit -> panel UV -> button.
  rayHit(raycaster) {
    if (!this.panel.visible) return null;
    const h = raycaster.intersectObject(this.panel)[0]; if (!h) return null;
    const px = h.uv.x * 1024, py = (1 - h.uv.y) * 720;
    const b = this.hits.find(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
    if ((b && b.ch) !== this.hover) { this.hover = b && b.ch; this.dirty = true; }
    return { point: h.point, button: b && b.ch };
  }

  // ---------------------------------------------------------------- fades + chapter cards
  async card(title, sub, hold = 1600) {
    $("card-title").textContent = title; $("card-sub").textContent = sub;
    await this.fade(true, 0); await wait(hold); $("card-title").textContent = ""; $("card-sub").textContent = ""; await this.fade(false, 900);
  }
  fade(dark, ms = 400) {
    const f = $("fade"); f.style.transition = `opacity ${ms}ms`; f.style.opacity = dark ? 1 : 0;
    if (this.vrFade) this.vrFade.target = dark ? 1 : 0;
    return wait(ms);
  }
}
export const wait = ms => new Promise(r => setTimeout(r, ms));
function fit(c, text, max) { let s = String(text); while (s.length > 4 && c.measureText(s).width > max) s = s.slice(0, -2); return s === String(text) ? s : s + "…"; }
function wrap(c, text, max) {
  const out = []; for (const para of String(text).split("\n")) {
    let line = ""; for (const w of para.split(" ")) { const t = line ? line + " " + w : w; if (c.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  } return out;
}
