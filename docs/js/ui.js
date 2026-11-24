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
    $("btn-station").hidden = true;
    // VR panel
    this.canvas = document.createElement("canvas"); this.canvas.width = 1024; this.canvas.height = 720;
    this.ctx = this.canvas.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.879), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.panel.renderOrder = 10; this.panel.visible = false; scene.add(this.panel);
    this.hits = []; this.dirty = true; this.following = true; this.hold = false;
    // VR corner task card: small, top-right of your view (task, scene, coins). Only choices use the middle.
    this.kcv = document.createElement("canvas"); this.kcv.width = 768; this.kcv.height = 320; this.ktex = new THREE.CanvasTexture(this.kcv); this.ktex.colorSpace = THREE.SRGBColorSpace;
    this.corner = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.108), new THREE.MeshBasicMaterial({ map: this.ktex, transparent: true, depthTest: false }));
    this.corner.renderOrder = 20; this.corner.position.set(0.17, 0.115, -0.46); this.corner.rotation.y = -0.3; this.corner.visible = false; camera.add(this.corner);
    // VR speech bubble: the spoken line floats above whoever is talking (not in front of your eyes).
    this.bcv = document.createElement("canvas"); this.bcv.width = 1024; this.bcv.height = 320; this.btex = new THREE.CanvasTexture(this.bcv); this.btex.colorSpace = THREE.SRGBColorSpace;
    this.bubble = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.344), new THREE.MeshBasicMaterial({ map: this.btex, transparent: true, depthTest: false }));
    this.bubble.renderOrder = 9; this.bubble.visible = false; scene.add(this.bubble); this.bubbleOn = false;
    // Term / answer card: green for a new term or a right answer, soft red for a wrong one (always explains).
    this.cards = []; this.cardOn = null; this.chapter = 0;
    this.ccv = document.createElement("canvas"); this.ccv.width = 1024; this.ccv.height = 460; this.ctex = new THREE.CanvasTexture(this.ccv); this.ctex.colorSpace = THREE.SRGBColorSpace;
    this.cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.427), new THREE.MeshBasicMaterial({ map: this.ctex, transparent: true, depthTest: false }));
    this.cardMesh.renderOrder = 12; this.cardMesh.visible = false; scene.add(this.cardMesh);
  }
  // While someone is talking, decision boxes wait; they appear when the line is finished.
  setHold(b) { this.holdReq = b; const h = b; if (this.hold !== h) { this.hold = h; this.dirty = true; this.renderDom("talk"); } }
  card3(title, body, kind = "good") { this.cards.push({ title, body, kind }); }
  setChapter(n) { this.chapter = n; this.dirty = true; [...$("timeline").children].forEach((s, i) => { s.className = i === n ? "now" : i < n ? "done" : ""; }); }
  updateCards(dt, inVR) {
    if (this.cardOn && performance.now() > this.cardOn.until) { this.cardOn = null; $("termcard").hidden = true; this.cardMesh.visible = false; this.setHold(this.holdReq); }
    if (!this.cardOn && this.cards.length) {
      const c = this.cardOn = this.cards.shift(); c.until = performance.now() + Math.max(9000, 3000 + c.body.length * 75);
      const el = $("termcard"); el.className = c.kind; el.querySelector("b").textContent = c.title; el.querySelector("p").textContent = c.body; el.hidden = false; el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
      const x = this.ccv.getContext("2d"); x.clearRect(0, 0, 1024, 460); const good = c.kind === "good";
      const g = x.createLinearGradient(0, 0, 0, 460); g.addColorStop(0, good ? "#2f9a63" : "#c0563f"); g.addColorStop(1, good ? "#1d6b45" : "#8f3a2a");
      x.fillStyle = g; x.strokeStyle = "#ffe08a"; x.lineWidth = 8; x.beginPath(); x.roundRect(6, 6, 1012, 448, 28); x.fill(); x.stroke();
      x.direction = "rtl"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#ffffff"; x.font = "bold 54px Amiri"; x.fillText(c.title, 512, 70);
      x.font = "bold 40px Amiri"; wrap(x, c.body, 940).slice(0, 5).forEach((l, i) => x.fillText(l, 512, 160 + i * 58)); this.ctex.needsUpdate = true;
      this.placeCard = true; this.setHold(this.holdReq);
    }
    this.cardMesh.visible = !!this.cardOn && inVR;
    if (this.cardMesh.visible) {
      const head = new THREE.Vector3(), fwd = new THREE.Vector3(); this.camera.getWorldPosition(head); this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      const target = head.clone().addScaledVector(fwd, 1.15); target.y = head.y + (this.panel.visible ? 0.4 : 0.02);
      const to = this.cardMesh.position.clone().sub(head).setY(0);
      if (this.placeCard || to.angleTo(fwd) > 0.6 || Math.abs(this.cardMesh.position.y - target.y) > 0.15) { this.cardMesh.position.lerp(target, this.placeCard ? 1 : Math.min(1, dt * 4)); this.placeCard = false; }
      this.cardMesh.lookAt(head);
    }
  }
  setBubble(speaker, text, head) {
    const on = !!(text && head); if (on !== this.bubbleOn) { this.bubbleOn = on; this.dirty = true; } this.bubble.visible = on; if (!on) { this.bubbleText = null; return; }
    if (this.bubbleText !== text) {
      this.bubbleText = text; const c = this.bcv.getContext("2d"); c.clearRect(0, 0, 1024, 320); c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = "bold 46px Amiri"; const lines = wrap(c, text, 940).slice(0, 3), h = 70 + lines.length * 60;
      c.fillStyle = "rgba(236,217,171,.97)"; c.strokeStyle = "#73501c"; c.lineWidth = 6; c.beginPath(); c.roundRect(8, 300 - h - 8, 1008, h, 26); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(480, 292); c.lineTo(512, 318); c.lineTo(544, 292); c.fill();
      c.fillStyle = "#1f3a30"; c.font = "bold 34px Amiri"; c.fillText(speaker, 512, 300 - h + 28);
      c.fillStyle = "#2a190d"; c.font = "bold 46px Amiri"; lines.forEach((l, i) => c.fillText(l, 512, 300 - h + 80 + i * 60));
      this.btex.needsUpdate = true;
    }
    const cam = new THREE.Vector3(); this.camera.getWorldPosition(cam);
    this.bubble.position.copy(head).add(new THREE.Vector3(0, 0.5, 0)); this.bubble.lookAt(cam);
    this.bubble.scale.setScalar(THREE.MathUtils.clamp(cam.distanceTo(this.bubble.position) / 2.2, 0.7, 1.7));
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
    if (k === "subtitle") { $("subtitle").textContent = s.subtitle; $("subtitle").hidden = !s.subtitle || (!!s.talk && !this.hold); }
    if (k === "actions") this.buttons($("actions"), s.actions);
    if (k === "talk") {
      $("talk").hidden = !s.talk || this.hold;
      if (s.talk) { $("talk").querySelector(".name").textContent = s.talk.speaker; $("talk").querySelector(".line").textContent = s.talk.line; this.buttons($("talk").querySelector(".choices"), s.talk.choices); }
      $("subtitle").hidden = !s.subtitle || (!!s.talk && !this.hold);
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
    this.updateCards(dt, inVR);
    const box = !!((this.st.talk && !this.hold) || this.st.modal);
    if (inVR && box && !this.panel.visible) this.following = true;
    this.panel.visible = inVR && box; this.corner.visible = inVR; if (!inVR) this.bubble.visible = false;
    if (inVR) this.updatePanel(dt);
  }

  // ---------------------------------------------------------------- VR panel
  updatePanel(dt) {
    const cam = this.camera, head = new THREE.Vector3(), fwd = new THREE.Vector3();
    cam.getWorldPosition(head); cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const to = this.panel.position.clone().sub(head); to.y = 0;
    if (to.angleTo(fwd) > 0.65 || to.length() > 2.4 || to.length() < 0.6) this.following = true;
    if (this.following) {
      const target = head.clone().addScaledVector(fwd, 1.3); target.y = head.y - 0.22;
      this.panel.position.lerp(target, Math.min(1, dt * 3));
      this.panel.lookAt(head);
      if (this.panel.position.distanceTo(target) < 0.03) this.following = false;
    }
    if (this.dirty) { if (this.panel.visible) this.draw(); this.drawCorner(); this.dirty = false; }
  }
  drawCorner() {
    const c = this.kcv.getContext("2d"), s = this.st, W = 768; c.clearRect(0, 0, W, 320);
    c.fillStyle = "rgba(14,20,17,.78)"; c.strokeStyle = "rgba(194,135,58,.9)"; c.lineWidth = 4; c.beginPath(); c.roundRect(4, 4, W - 8, 312, 26); c.fill(); c.stroke();
    c.direction = "rtl"; c.textBaseline = "middle";
    c.textAlign = "right"; c.fillStyle = "#ffcf7a"; c.font = "bold 30px Amiri"; c.fillText(["المشهد ١/٣ • الإرث", "المشهد ٢/٣ • أول زبون", "المشهد ٣/٣ • الطلبية الكبرى"][this.chapter], W - 30, 44);
    c.textAlign = "left"; c.fillStyle = "#e8b64a"; c.beginPath(); c.arc(46, 44, 17, 0, Math.PI * 2); c.fill(); c.fillStyle = "#ffe7b0"; c.font = "bold 36px Amiri"; c.fillText(String(s.cash), 74, 46);
    c.textAlign = "center"; c.fillStyle = "#ffffff"; c.font = "bold 44px Amiri";
    const lines = wrap(c, s.objective || "", 700).slice(0, 2); lines.forEach((l, i) => c.fillText(l, W / 2, (lines.length > 1 ? 122 : 146) + i * 52));
    const extra = s.toast ? [s.toast, "#ffcf7a"] : s.progress ? [s.progress, "#7dffc0"] : s.subtitle && !this.bubbleOn ? [s.subtitle, "#d9cfb8"] : null;
    if (extra) { c.fillStyle = extra[1]; c.font = "bold 30px Amiri"; c.fillText(fit(c, extra[0], 720), W / 2, 268); }
    this.ktex.needsUpdate = true;
  }
  draw() {
    const c = this.ctx, W = 1024, H = 720, s = this.st; this.hits = [];
    c.clearRect(0, 0, W, H);
    const panel = (x, y, w, h, fill, stroke) => { c.fillStyle = fill; c.strokeStyle = stroke; c.lineWidth = 5; c.beginPath(); c.roundRect(x, y, w, h, 16); c.fill(); c.stroke(); };
    c.direction = "rtl"; c.textBaseline = "middle"; c.textAlign = "center";
    const talk = s.talk && !this.hold ? s.talk : null, box = talk || s.modal;
    if (box) {
      const y0 = 70, h = 600, btnY = y0 + h - 122;
      panel(16, y0, 992, h, "#ecd9ab", "#73501c");
      if (talk) { panel(352, y0 - 26, 320, 58, "#1f3a30", "#c2873a"); c.font = "bold 36px Amiri"; c.fillStyle = "#ffcf7a"; c.fillText(talk.speaker, 512, y0 + 3); }
      else { c.font = "bold 44px Amiri"; c.fillStyle = "#301e13"; c.fillText(s.modal.title, 512, y0 + 46); }
      c.fillStyle = "#301e13"; const big = !!talk; c.font = (big ? "bold 44px" : "32px") + " Amiri";
      const lines = wrap(c, talk ? talk.line : s.modal.body, 940), step = big ? 58 : 42, top = y0 + (big ? 80 : 100);
      lines.slice(0, big ? 5 : 7).forEach((l, i) => c.fillText(l, 512, top + i * step));
      this.drawButtons(box.choices, btnY);
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
