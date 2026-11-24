// Game director: story phases, brewing, NPC trading, alchemy map, station camera, and all controls
// (desktop mouse+keyboard, phone touch, VR headset). Port of the Unity GameDirector & co.
import * as THREE from "three";
import { GameState, Finance, RecipeProgress, Supplier, Herb } from "./finance.js";
import { L, Stations, U } from "./layout.js";
import { place, load, colliders, box3 } from "./assets.js";
import { refs } from "./shop.js";
import { UI, wait } from "./ui.js";
import { Audio } from "./audio.js";
import { FX } from "./fx.js";
import { NPC, Firas } from "./npc.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

const P = { Intro: 0, Purchase: 1, Brew: 2, Ready: 3, Price: 4, Handoff: 5, RevenueQuiz: 6, Offer: 7, Supplier: 8, Wilt: 9, BatchBrew: 10, BatchHandoff: 11, Expenses: 12, FinalQuiz: 13, Report: 14 };
const TERMS = [["رأس المال", "الأموال أو الموارد التي يبدأ بها صاحب المشروع نشاطه."], ["المواد الخام", "المواد المستخدمة لصناعة المنتج."],
  ["تكلفة الإنتاج", "مجموع التكاليف المباشرة اللازمة لصناعة المنتج في هذه المحاكاة."], ["سعر البيع", "المبلغ الذي يدفعه الزبون مقابل المنتج."],
  ["الإيرادات", "الأموال الناتجة عن بيع المنتجات قبل طرح التكاليف."], ["تكلفة البضاعة المباعة", "التكلفة المباشرة للمنتجات التي تم بيعها."],
  ["إجمالي الربح", "الإيرادات ناقص تكلفة البضاعة المباعة."], ["المخاطرة", "احتمال حدوث خسارة أو نتيجة غير متوقعة."],
  ["المصروفات التشغيلية", "تكاليف تشغيل المتجر غير الداخلة في تكلفة الجرعات مباشرة."], ["صافي الربح", "إجمالي الربح بعد طرح خسائر التلف والمصروفات التشغيلية في هذه المحاكاة."]];
const CARDS = [["إرث الكيميائي", "المشهد الأول: الإرث"], ["المشهد الثاني", "أول زبون"], ["المشهد الثالث", "الطلبية الكبرى"]];
const MODELS = { herb: "herb_red", crystal: "crystal_blue", water: "water_flask", bottle: "potion_bottle", potion: "potion_bottle", pestle: "pestle", spoon: "stir_paddle" };
const GRIP = { spoon: 0.95, pestle: 0.2 };
const C = (text, action) => ({ text, action });

// ------------------------------------------------------------------ dialogue
class Dialogue {
  constructor(game) { this.g = game; this.lines = {}; this.queue = []; this.speaking = false; this.speaker = ""; }
  async load() {
    const csv = await (await fetch("assets/DIALOGUE.csv")).text();
    for (const raw of csv.split("\n")) { const c = raw.trim().split(","); if (c.length !== 8 || c[0] === "id") continue; this.lines[c[0]] = { speaker: c[1], text: c[4], dur: parseFloat(c[6]) }; }
    if (!this.g.fast) this.g.audio.preloadVoices(Object.keys(this.lines));
  }
  say(...ids) { for (const id of ids) if (this.lines[id] && !this.queue.includes(id)) this.queue.push(id); }
  update(dt) {
    if (this.speaking) { this.left -= dt; if (this.left <= 0) { this.speaking = false; this.speaker = ""; this.g.ui.subtitle(""); this.g.audio.setSpeaking(false); this.gap = 0.25; } return; }
    if ((this.gap -= dt) > 0 || !this.queue.length) return;
    const id = this.queue.shift(), l = this.lines[id]; this.speaking = true; this.speaker = l.speaker; this.left = this.g.fast ? 0.05 : l.dur;
    this.g.ui.subtitle(l.speaker + ": " + l.text); this.g.audio.setSpeaking(true);
    if (!this.g.fast) this.g.audio.speak(id).then(d => { if (d && this.speaker === l.speaker) this.left = Math.max(this.left - (l.dur - d - 0.3), 0.3); });
  }
}

// ------------------------------------------------------------------ grabbable items
class Item {
  constructor(game, kind, label, index) { this.g = game; this.kind = kind; this.label = label; this.index = index; this.obj = new THREE.Group(); this.held = false; this.consumed = false; this.filled = false; this.glow = []; }
  async build(pos) {
    const g = this.obj; g.position.copy(pos); this.g.scene.add(g);
    if (this.kind === "crushed") {
      const bowl = await place(g, "assets/kaykit/Restaurant/bowl_small.gltf", new THREE.Vector3(), { width: 0.16 });
      for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a2b10 })); m.position.set(Math.sin(i * 3) * 0.035, 0.045, Math.cos(i * 3) * 0.035); g.add(m); }
    } else {
      const m = await place(g, `assets/custom/${MODELS[this.kind]}.glb`, new THREE.Vector3(), { scale: this.kind === "water" ? 1.3 : (this.kind === "herb" || this.kind === "crystal") ? 1.55 : 1 });
    }
    if (this.kind === "potion") this.fill(1, new THREE.Color(0x1ab866));
    g.traverse(o => { if (o.isMesh && o.name !== "Liquid") { o.material = o.material.clone(); this.glow.push(o.material); } });
    this.home = g.position.clone(); this.homeQ = g.quaternion.clone();
    this.g.items.push(this); return this;
  }
  fill(f, color) {
    if (!this.liquid) { this.liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 1, 16), new THREE.MeshBasicMaterial({ color })); this.liquid.name = "Liquid"; this.obj.add(this.liquid); }
    this.liquid.material.color.copy(color); this.liquid.scale.set(1, Math.max(0.001, 0.09 * f), 1); this.liquid.position.y = 0.008 + 0.045 * f;
  }
  get pos() { return this.obj.position; }
  returnHome() { this.held = false; this.obj.position.copy(this.home); this.obj.quaternion.copy(this.homeQ); }
  consume() { this.consumed = true; this.held = false; this.obj.visible = false; }
  setGlow(k) { for (const m of this.glow) { if (m.emissive) { m.emissive.setRGB(1, 0.72, 0.25); m.emissiveIntensity = k; } } }
}

// ------------------------------------------------------------------ alchemy map (creative brewing)
class BrewMap {
  constructor() { this.reset(); }
  reset() { this.pos = new THREE.Vector2(); this.heading = 90; this.best = 9; this.any = false; this.trail = []; }
  static zone = new THREE.Vector2(0.42, 0.62);
  get quality() { return this.best < 0.09 ? 3 : this.best < 0.18 ? 2 : 1; }
  get inZone() { return this.pos.distanceTo(BrewMap.zone) < 0.13 * 0.7; }
  add(kind) {
    const push = kind === "crushed" ? [-0.05, 0.36] : kind === "crystal" ? [0.3, 0.08] : kind === "water" ? [-0.08, 0.1] : null; if (!push) return;
    for (let i = 1; i <= 5; i++) { this.pos.x += push[0] / 5; this.pos.y += push[1] / 5; this.trail.push(this.pos.clone()); }
    this.heading = Math.atan2(push[1], push[0]) * 180 / Math.PI; this.any = true; this.track();
  }
  stir(turns, dir) {
    if (!this.any || turns <= 0) return false; const wasIn = this.inZone;
    this.heading -= dir * 75 * turns; const r = this.heading * Math.PI / 180;
    this.pos.add(new THREE.Vector2(Math.cos(r), Math.sin(r)).multiplyScalar(0.34 * turns)); if (this.pos.length() > 0.95) this.pos.setLength(0.95);
    if (Math.random() < 0.5) this.trail.push(this.pos.clone()); this.track(); return !wasIn && this.inZone;
  }
  track() { this.best = Math.min(this.best, this.pos.distanceTo(BrewMap.zone)); }
  get qualityText() { return "الجودة " + this.quality + " / 3" + (this.quality === 3 ? " — ممتازة!" : ""); }
  get tint() { if (!this.any) return new THREE.Color(0xd9e0dc); if (this.inZone) return new THREE.Color(0xffd973); return new THREE.Color(0xd95a4d).lerp(new THREE.Color(0x598cff), THREE.MathUtils.clamp(this.pos.x * 2 + 0.5, 0, 1)); }
  draw(c, size) {
    const s = size / 2, P2 = v => [s + v.x * s, s - v.y * s];
    c.clearRect(0, 0, size, size); c.fillStyle = "#eedbb0"; c.beginPath(); c.arc(s, s, s - 2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(120,80,30,.25)"; for (let r = 1; r <= 3; r++) { c.beginPath(); c.arc(s, s, r * s / 3.4, 0, Math.PI * 2); c.stroke(); }
    const [zx, zy] = P2(BrewMap.zone); c.fillStyle = "rgba(40,170,110,.75)"; c.beginPath(); c.arc(zx, zy, 0.13 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(110,70,25,.75)"; for (const p of this.trail.slice(-60)) { const [x, y] = P2(p); c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
    const [mx, my] = P2(this.pos); c.fillStyle = "#c2873a"; c.strokeStyle = "#4a2d0e"; c.lineWidth = 3; c.beginPath(); c.arc(mx, my, 11, 0, Math.PI * 2); c.fill(); c.stroke();
  }
}

// ------------------------------------------------------------------ the game
export class Game {
  constructor({ renderer, scene, camera, rig, sun }) {
    Object.assign(this, { renderer, scene, camera, rig, sun });
    this.state = new GameState(); this.fin = new Finance(this.state);
    this.items = []; this.npcs = []; this.phase = P.Intro; this.chapter = 0; this.brew = new RecipeProgress(); this.map = new BrewMap();
    this.yaw = L.outsideYaw; this.pitch = 0.12; this.keys = {}; this.held = null; this.focused = false; this.glide = 1;
    this.fast = new URLSearchParams(location.search).has("fast");
    this.ray = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.inVR = false; this.filled = 0; this.quizTries = 0;
  }
  async init() {
    this.ui = new UI(this.scene, this.camera); this.audio = new Audio(); this.fx = new FX(this.scene, this.audio);
    this.dialogue = new Dialogue(this); await this.dialogue.load();
    this.firas = await Firas.create(this.scene);
    this.trader = await NPC.create(this.scene, "assets/kaykit/Characters/Barbarian.glb", 1.78, "Trader", "التاجر المتجول", L.customerSpot);
    this.customer = await NPC.create(this.scene, "assets/kaykit/Characters/Rogue_Hooded.glb", 1.72, "Customer", "الزبون", L.customerSpot);
    this.merchant = await NPC.create(this.scene, "assets/kaykit/Characters/Knight.glb", 1.8, "Merchant", "التاجر", L.customerSpot);
    this.npcs = [this.trader, this.customer, this.merchant].filter(Boolean);
    for (const name of ["herb_red", "crystal_blue", "water_flask", "potion_bottle", "pestle", "stir_paddle"]) await load(`assets/custom/${name}.glb`);
    this.labels();
    this.ui.onBook = () => this.glossary(0); this.ui.onStation = () => this.goToStation(); this.ui.onClick = () => this.audio.play("paper", 1.1, 0.8);
    this.setupDesktop(); this.setupTouch(); this.setupVR();
    this.ui.card(...CARDS[0], this.fast ? 0 : 1600);
    this.refresh();
  }
  // ---------------------------------------------------------------- world labels (sign, recipe, market)
  labels() {
    const label = (text, pos, w, h, yawUnity, size = 64) => {
      const cv = document.createElement("canvas"); cv.width = 1024; cv.height = Math.round(1024 * h / w); const c = cv.getContext("2d");
      c.fillStyle = "#e8d4a6"; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = "#301e13"; c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = `${size}px Amiri`;
      const lines = text.split("\n"); lines.forEach((l, i) => c.fillText(l, cv.width / 2, cv.height / 2 + (i - (lines.length - 1) / 2) * size * 1.3));
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
      m.position.copy(pos); m.rotation.y = Math.PI - yawUnity * Math.PI / 180 + Math.PI; this.scene.add(m); return m;
    };
    document.fonts.ready.then(() => {
      label("إرث الكيميائي\nمتجر الجرعات", U(0, 2.93, -0.545), 1.1, 0.5, 180, 90);
      label("جرعة النشاط\nعشبة 10 • بلورة 8\nماء 5 • قارورة 2", U(-4.03, 1.36, 6.2), 1.05, 0.7, 90, 70);
      this.marketLabel = label("لوحة السوق\nجرعات الجيران: نحو 40 عملة", U(4.03, 1.36, 1.15), 0.76, 0.5, -90, 64); this.marketLabel.visible = false;
    });
  }

  // ---------------------------------------------------------------- stations
  stationName() {
    switch (this.phase) {
      case P.Purchase: return this.trader ? "counter" : "welcome";
      case P.Brew: case P.BatchBrew: { const b = this.brew; return !b.herbInMortar ? "ingredients" : !b.crushed ? "mortar" : !b.readyToStir ? "mix" : !b.readyToBottle ? "cauldron" : "bottling"; }
      case P.Wilt: return "ingredients";
      case P.Price: case P.Handoff: case P.RevenueQuiz: case P.Offer: case P.Supplier: case P.BatchHandoff: case P.Expenses: case P.FinalQuiz: return "counter";
      case P.Report: return "ending";
      default: return null;
    }
  }
  station() { const n = this.stationName(); return n ? Stations[n] : null; }
  isTarget(it) {
    if (it.consumed) return false;
    if (this.phase === P.Handoff || this.phase === P.BatchHandoff) return it.kind === "potion";
    if (this.phase !== P.Brew && this.phase !== P.BatchBrew) return false;
    const b = this.brew;
    if (!b.herbInMortar) return it.kind === "herb"; if (!b.crushed) return it.kind === "pestle";
    if (!b.readyToStir) return ["crushed", "crystal", "water"].includes(it.kind); if (!b.readyToBottle) return it.kind === "spoon";
    return it.kind === "bottle" && !this.bottleIn;
  }
  speakerHead() {
    const d = this.dialogue; if (!d.speaking) return null;
    if (d.speaker === "فراس" && this.firas?.shown) return this.firas.head;
    const n = this.npcs.find(n => n.arrived && n.speaker === d.speaker); return n ? n.head : null;
  }
  goToStation() {
    const v = this.station(); if (!v || this.stationName() === "welcome") { this.ui.toast("لا توجد محطة الآن — تابع مع فراس"); return; }
    if (this.inVR) this.teleport(v.stand, v.standYaw); else this.focusOn(this.stationName());
  }

  // ---------------------------------------------------------------- story
  refresh() {
    const ui = this.ui, s = this.state; ui.actions(); ui.close();
    if (this.phase !== P.Brew && this.phase !== P.BatchBrew) ui.progress("");
    switch (this.phase) {
      case P.Intro:
        if (!this.doorOpened) { ui.objective("افتح باب متجرك"); ui.actions(C("افتح الباب", () => this.openShopDoor())); }
        else { ui.objective("ادخل المتجر"); ui.actions(C("ادخل", () => this.enterShop())); } break;
      case P.Purchase: {
        ui.objective("اشترِ المكونات من التاجر");
        if (!this.trader.arrived) { this.trader.arrive(this).then(() => { this.dialogue.say("T1_HELLO"); this.refresh(); }); break; }
        const names = ["عشبة حمراء • 10", "بلورة زرقاء • 8", "ماء سحري • 5", "قارورة • 2"];
        ui.talk("التاجر المتجول", "ماذا تحتاج لجرعة النشاط؟", ...[0, 1, 2, 3].filter(i => !s.has("ingredient-" + i)).map(i => C(names[i], () => this.purchase(i)))); break; }
      case P.Brew: case P.BatchBrew: this.brewObjective(); break;
      case P.Ready: ui.objective("جرعتك جاهزة! • التكلفة 25"); ui.actions(C("افتح الباب للزبون", () => this.nextChapter())); break;
      case P.Price: ui.objective("اختر سعرك");
        ui.talk("الزبون", "بكم جرعة النشاط؟ الجيران يبيعونها بنحو 40.", C("30 عملة", () => this.choosePrice(30)), C("50 عملة", () => this.choosePrice(50))); break;
      case P.Handoff: ui.objective("ضع الجرعة على الصينية"); break;
      case P.RevenueQuiz: ui.objective("إيراد أم ربح؟");
        ui.talk("فراس", `الإيراد ${s.revenue} • التكلفة ${s.cogs} — المال الذي استلمته: إيراد أم ربح؟`, C("إيراد", () => this.revenueAnswer(true)), C("ربح", () => this.revenueAnswer(false))); break;
      case P.Offer: ui.objective("طلبية كبيرة");
        ui.talk("التاجر", `أريد 3 جرعات، وأدفع ${s.merchantPrice} لكل جرعة سليمة.`, C("اتفقنا", () => this.nextChapter())); break;
      case P.Supplier: ui.objective("اختر المورد");
        if (!this.trader.arrived) { this.trader.spot = L.traderSpot; this.trader.arrive(this).then(() => { this.dialogue.say("T3_HELLO"); this.refresh(); }); break; }
        ui.talk("التاجر المتجول", "3 جرعات: اقتصادي رخيص، أو ممتاز بجودة ثابتة.", C("اقتصادي • 45", () => this.buyBatch(Supplier.Cheap)), C("ممتاز • 60", () => this.buyBatch(Supplier.Premium))); break;
      case P.Wilt: ui.objective("عشبة ذابلة!");
        ui.talk("فراس", "إحدى الأعشاب ذابلة. ماذا تفعل؟", C("استبدلها • +5", () => this.decideHerb(Herb.Replace)), C("استخدمها", () => this.decideHerb(Herb.UseWilted))); break;
      case P.BatchHandoff: ui.objective("سلّم القوارير للتاجر"); break;
      case P.Expenses: ui.objective("فاتورة اليوم"); ui.talk("فراس", "فاتورة المتجر: إيجار وشموع وحطب.", C("ادفع 10", () => this.payExpenses())); break;
      case P.FinalQuiz: { ui.objective("السؤال الأخير"); const a = C(s.netProfit + " عملة", () => this.finalAnswer(true)), b = C(s.grossProfit + " عملة", () => this.finalAnswer(false));
        ui.talk("فراس", "كم صافي ربحك اليوم؟", ...(this.correctLeft ? [a, b] : [b, a])); break; }
      case P.Report: ui.objective("تقرير المتجر");
        ui.modal("تقرير المتجر", this.report(), C("إعادة التجربة", () => location.reload()), C("الموسوعة المالية", () => this.glossary(0))); break;
    }
  }
  report() {
    const s = this.state;
    return `رأس المال الأولي: 100    إيرادات المبيعات: ${s.revenue}\nتكلفة البضاعة المباعة: ${s.cogs}    إجمالي الربح: ${s.grossProfit}\nخسائر التلف: ${s.spoilage}    المصروفات التشغيلية: ${s.opex}\nصافي الربح: ${s.netProfit}    الرصيد النقدي النهائي: ${s.cash}\nسمعة المتجر: ${s.reputation} • تقييم غير مالي: ${s.reputationStars} / 4\nمحاكاة مبسطة: لا تشمل الضرائب أو تكاليف التمويل.`;
  }
  unlock(i) { if (this.state.terms.includes(i)) return; this.state.terms.push(i); this.ui.toast("مصطلح جديد: " + TERMS[i][0]); }
  glossary(page) {
    this.paused = true; const s = this.state, open = s.terms.includes(page);
    this.ui.modal(`الموسوعة المالية   ${s.terms.length} / 10`, open ? `${TERMS[page][0]}\n\n${TERMS[page][1]}` : "مصطلح مغلق\nستكتشفه أثناء التجربة",
      C("السابق", () => this.glossary((page + 9) % 10)), C("التالي", () => this.glossary((page + 1) % 10)), C("عودة", () => { this.paused = false; this.refresh(); }));
  }
  openShopDoor() { if (this.phase !== P.Intro || this.doorOpened) return; this.doorOpened = true; this.fx.openDoor(); this.refresh(); }
  enterShop() {
    if (this.phase !== P.Intro) return;
    if (!this.doorOpened) { this.doorOpened = true; this.fx.openDoor(); }
    const p = new THREE.Vector3(); this.camera.getWorldPosition(p);
    if (!L.isInside(p)) this.teleport(L.insideStart, L.insideYaw);
    this.phase = P.Purchase; this.unlock(0); this.firas.show(this); this.dialogue.say("S1_F01", "S1_F03"); this.refresh();
  }
  purchase(i) {
    if (this.phase !== P.Purchase || !this.fin.purchaseFirst(i)) return;
    this.audio.play("coins", 0.8, 0.5); this.trader.receive();
    if (!this.state.terms.includes(1)) { this.unlock(1); this.dialogue.say("S1_F04"); }
    if ([0, 1, 2, 3].every(k => this.state.has("ingredient-" + k))) { this.phase = P.Brew; this.beginBrew(false); this.dialogue.say("T1_BYE", "S1_F05"); this.trader.leave(this); }
    else this.dialogue.say("T1_DEAL");
    this.refresh();
  }
  async beginBrew(batch) {
    this.batch = batch; this.brew = new RecipeProgress(); this.map.reset(); this.filled = 0; this.bottleIn = null; this.fill = 0;
    for (const it of this.items) if (!it.consumed && it.kind !== "potion") { this.scene.remove(it.obj); it.consumed = true; }
    await new Item(this, "herb", "العشبة", 0).build(L.herbSpot); await new Item(this, "crystal", "البلورة", 0).build(L.crystalSpot);
    await new Item(this, "water", "الماء السحري", 0).build(L.waterSpot); await new Item(this, "pestle", "المدقة", 0).build(L.pestleSpot);
    await new Item(this, "spoon", "مجداف التحريك", 0).build(L.paddleSpot);
    for (let i = 0; i < (batch ? 3 : 1); i++) await new Item(this, "bottle", "قارورة فارغة", i).build(L.emptyBottle(i));
    this.refresh();
  }
  brewObjective() {
    const b = this.brew;
    this.ui.objective(!b.herbInMortar ? "ضع العشبة في الهاون" : !b.crushed ? "اسحق العشبة بالمدقة" : !b.readyToStir ? "أضف المسحوق والبلورة والماء إلى المرجل" : !b.readyToBottle ? "حرّك المجداف دائريًا داخل المرجل" : this.bottleIn ? "املأ القارورة: اضغط F مطولًا" : "ضع قارورة فارغة في حلقة التعبئة");
    this.ui.progress(b.herbInMortar && !b.crushed ? `السحق: ${b.strokes} / 5` : b.readyToStir && !b.readyToBottle ? `المزج: ${Math.round(b.stirring * 100)}%` : b.readyToBottle ? `القوارير: ${this.filled} / ${this.batch ? 3 : 1}` : "");
    if (b.herbInMortar && !b.crushed) this.ui.actions(C("مساعدة: ضربة سحق", () => this.crushStroke()));
    else if (b.readyToStir && !b.readyToBottle) this.ui.actions(C("مساعدة: دورة تحريك", () => this.stir(0.25, 0)));
    else if (this.bottleIn) this.ui.actions(C("مساعدة التعبئة", () => this.pour(0.55)));
    else this.ui.actions();
  }
  bottleFinished() {
    if (this.phase === P.Brew && this.fin.craftFirst()) { this.unlock(2); this.phase = P.Ready; this.dialogue.say("S1_F06", "S1_F07"); setTimeout(() => this.audio.play("knock"), 2500); }
    else if (this.phase === P.BatchBrew && this.filled === 3) this.phase = P.BatchHandoff;
    this.refresh();
  }
  choosePrice(p) { if (this.phase !== P.Price || !this.fin.choosePrice(p)) return; this.phase = P.Handoff; this.dialogue.say(p === 30 ? "S2_CA" : "S2_CB"); this.customer.react(p === 30); this.refresh(); }
  deliver(index) {
    const s = this.state;
    if (this.phase === P.Handoff && this.fin.sellFirst()) {
      this.customer.receive(); this.phase = P.RevenueQuiz; this.quizTries = 0; this.fx.coinsTo(s.firstPrice, L.handoff.clone().setY(1.14));
      for (const t of [4, 5, 6]) this.unlock(t); this.dialogue.say(s.firstPrice === 30 ? "S2_FA" : "S2_FB");
    } else if (this.phase === P.BatchHandoff && this.fin.deliverBatchBottle(index)) {
      const reject = index === 2 && s.herb === Herb.UseWilted; this.merchant.react(!reject);
      if (reject) { this.audio.play("reject"); this.dialogue.say("S3_M_REJECT", "S3_SPOIL"); } else this.fx.coinsTo(s.merchantPrice, L.handoff.clone().setY(1.14));
      if (s.inventoryValue === 0) { this.phase = P.Expenses; this.unlock(8); this.dialogue.say("S3_M_OK"); if (s.supplier === Supplier.Premium) this.dialogue.say("S3_FB"); this.dialogue.say("S3_OPEX"); }
    } else return false;
    this.refresh(); return true;
  }
  revenueAnswer(ok) {
    if (this.phase !== P.RevenueQuiz) return; this.dialogue.say(ok ? "S2_Q_OK" : "S2_Q_NO");
    if (!ok && this.quizTries++ === 0) { this.ui.toast("حاول مرة أخرى: الإيراد قبل طرح التكاليف"); return; }
    this.phase = P.Offer; this.dialogue.say(this.state.firstPrice === 30 ? "S2_MA" : "S2_MB"); this.refresh();
  }
  buyBatch(sup) {
    if (this.phase !== P.Supplier || !this.fin.purchaseBatch(sup)) return;
    this.audio.play("coins", 0.8, 0.7); this.dialogue.say(sup === Supplier.Cheap ? "T3_CHEAP" : "T3_PREMIUM"); this.trader.leave(this);
    if (sup === Supplier.Cheap) { this.phase = P.Wilt; this.showWilted(); this.dialogue.say("S3_FA_RISK"); } else { this.phase = P.BatchBrew; this.beginBrew(true); }
    this.refresh();
  }
  async showWilted() { const w = await place(this.scene, "assets/custom/herb_red.glb", L.wiltedSpot, { scale: 1.55 }); w.rotation.z = 1.2; w.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(0x5c3d14); } }); this.wilted = w; this.fx.sparkle(L.wiltedSpot.clone().setY(1), 6); }
  decideHerb(c) { if (this.phase !== P.Wilt || !this.fin.decideHerb(c)) return; if (c === Herb.Replace) this.dialogue.say("S3_FA_FIX"); if (this.wilted) this.scene.remove(this.wilted); this.phase = P.BatchBrew; this.beginBrew(true); this.refresh(); }
  payExpenses() {
    if (this.phase !== P.Expenses || !this.fin.payOperatingExpenses()) return;
    this.fx.payOut(U(0, 1.2, -0.5)); this.unlock(9); this.phase = P.FinalQuiz; this.quizTries = 0; this.correctLeft = Math.random() > 0.5; this.dialogue.say("S3_NET"); this.refresh();
  }
  finalAnswer(ok) {
    if (this.phase !== P.FinalQuiz) return; this.dialogue.say(ok ? "S3_Q_OK" : "S3_Q_NO");
    if (!ok && this.quizTries++ === 0) { this.ui.toast(this.state.spoilage > 0 ? "اطرح مصروفات التشغيل 10 وخسائر التلف 15" : "اطرح مصروفات التشغيل 10"); return; }
    this.phase = P.Report; this.state.finished = true; this.dialogue.say("S3_END1", "S3_END2"); this.warm = 1; this.fx.sparkle(L.liquid.clone().setY(1.1), 18); this.audio.play("crystal", 1.1); this.refresh();
  }
  async nextChapter() {
    if (this.changing) return; this.changing = true; this.dropHeld(false);
    const next = this.chapter + 1; await this.ui.fade(true, 700);
    document.getElementById("card-title").textContent = CARDS[next][0]; document.getElementById("card-sub").textContent = CARDS[next][1];
    await wait(this.fast ? 50 : 1400);
    this.chapter = next; this.state.chapter = next;
    for (const it of this.items) if (it.kind !== "potion" || next === 2) { this.scene.remove(it.obj); it.consumed = true; }
    this.teleport(L.insideStart, L.insideYaw, true); this.fx.pile.forEach(c => this.scene.remove(c)); this.fx.pile = [];
    if (next === 1) {
      this.phase = P.Price; await new Item(this, "potion", "جرعة النشاط", 0).build(L.saleBottle); this.unlock(3);
      this.marketLabel && (this.marketLabel.visible = true); this.customer.arrive(this); this.dialogue.say("S2_C01", "S2_F02");
    } else {
      this.phase = P.Supplier; this.unlock(7); this.merchant.arrive(this); this.dialogue.say("S3_F01");
    }
    document.getElementById("card-title").textContent = ""; document.getElementById("card-sub").textContent = "";
    await this.ui.fade(false, 900); this.changing = false; this.refresh();
  }

  // ---------------------------------------------------------------- brewing mechanics
  crushStroke() {
    if (this.paused || !this.brew.herbInMortar || this.brew.crushed) return;
    this.brew.crushStroke(); this.audio.play("grind", 0.85 + this.brew.strokes * 0.06); this.fx.bits(L.mortar.clone().setY(1.04), 0x9a2914, 5);
    if (this.mortarHerb) this.mortarHerb.scale.multiplyScalar(0.86);
    if (this.brew.crushed) { this.fx.sparkle(L.mortar.clone().setY(1.0), 6); this.audio.play("chime", 0.8); if (this.mortarHerb) this.scene.remove(this.mortarHerb); new Item(this, "crushed", "عشبة مسحوقة", 0).build(L.mortar.clone().setY(1.04)); }
    this.refresh();
  }
  stir(turns, dir) {
    if (this.paused || !this.brew.readyToStir || this.brew.readyToBottle) return;
    if (this.map.stir(turns, dir)) { this.audio.play("crystal", 1.2, 0.7); this.fx.sparkle(L.liquid.clone().setY(1.06), 14); }
    this.brew.stir(turns); this.stirAcc = (this.stirAcc || 0) + turns; if (this.stirAcc > 0.22) { this.stirAcc = 0; this.audio.play("swish", 0.9 + Math.random() * 0.2, 0.7); } this.swirl = Math.min(3, (this.swirl || 0) + turns * 9);
    if (this.brew.readyToBottle) { this.audio.play("chime", 1.25); this.fx.sparkle(L.liquid.clone().setY(1.06), 14); }
    this.brewObjective();
  }
  observeStir(p) {
    const c = L.liquid, d = p.clone().sub(c), r = Math.hypot(d.x, d.z);
    if (!this.brew.readyToStir || r < 0.06 || r > L.innerRadius || Math.abs(d.y) > 0.5) { this.lastAngle = null; return; }
    const a = Math.atan2(d.z, d.x) * 180 / Math.PI;
    if (this.lastAngle != null) { let s = a - this.lastAngle; s = ((s + 540) % 360) - 180; if (Math.abs(s) < 60) this.stir(Math.abs(s) / 360, s > 0 ? 1 : -1); }
    this.lastAngle = a;
  }
  observePestle(p) {
    const m = L.mortar; if (Math.hypot(p.x - m.x, p.z - m.z) > 0.26 || !this.brew.herbInMortar || this.brew.crushed) return;
    if (p.y > m.y + 0.18) this.pestleArmed = true; if (this.pestleArmed && p.y < m.y + 0.1) { this.pestleArmed = false; this.crushStroke(); }
  }
  pour(dt) {
    const it = this.bottleIn; if (!it || this.paused) return;
    this.fill = Math.min(1, this.fill + dt / 1.8);
    const s = this.state, color = it.index === 2 && this.batch && s.herb === Herb.UseWilted ? new THREE.Color(0x665c45) : new THREE.Color(this.batch && s.supplier === Supplier.Premium ? 0x29d98f : 0x1ab866);
    if (color.r < 0.3) color.multiplyScalar(0.8 + 0.3 * (this.map.quality - 1));
    it.fill(this.fill, color); this.pourT = 0.1; this.pourColor = color;
    this.ui.progress(`تعبئة القارورة: ${Math.round(this.fill * 100)}%`);
    if (this.fill >= 1) {
      it.kind = "potion"; it.label = "جرعة النشاط"; it.filled = true; it.obj.position.copy(L.finishedBottle(this.filled)); it.home = it.obj.position.clone();
      if (this.batch) this.fin.craftBatchBottle(it.index);
      this.fx.sparkle(it.obj.position.clone().setY(1.0), 4 + this.map.quality * 4); this.audio.play("glass");
      if (this.filled === 0) this.ui.toast("جرعة النشاط • " + this.map.qualityText);
      this.bottleIn = null; this.filled++; this.bottleFinished();
    }
  }
  // Drop logic shared by mouse, touch and VR hands.
  tryDrop(it) {
    if (it.consumed || this.paused) return;
    const p = it.pos, c = L.cauldron, overCauldron = Math.hypot(p.x - c.x, p.z - c.z) < L.innerRadius + 0.3 && p.y > 0.55 && p.y < 2.1;
    if (overCauldron && it.kind !== "spoon") {
      const ing = ["crushed", "crystal", "water"].includes(it.kind);
      if (ing && (this.phase === P.Brew || this.phase === P.BatchBrew) && this.brew.add(it.kind)) {
        const col = it.kind === "crystal" ? 0x4d8cff : it.kind === "water" ? 0x66d9ff : 0xd9401f;
        this.fx.bits(L.liquid.clone().setY(0.92), col, 9); this.fx.sparkle(L.liquid.clone().setY(0.96), 8); this.map.add(it.kind); it.consume(); this.audio.play("splash", 0.9 + Math.random() * 0.2); this.refresh(); return;
      }
      this.ui.toast(it.kind === "herb" ? "اسحق العشبة في الهاون أولًا" : ing ? (this.brew.readyToStir ? "المرجل ممتلئ — حرّك الآن" : "ليس الآن") : "هذا لا يوضع في المرجل");
      this.bounceHome(it); return;
    }
    const near = (t, h, v) => Math.hypot(p.x - t.x, p.z - t.z) < h && Math.abs(p.y - t.y) < v;
    if (it.kind === "herb" && near(L.mortar, 0.37, 0.4) && !this.brew.herbInMortar && (this.phase === P.Brew || this.phase === P.BatchBrew)) {
      this.brew.herbInMortar = true; it.consume(); this.audio.play("chime", 0.5);
      place(this.scene, "assets/custom/herb_red.glb", L.mortar.clone().setY(1.0), { scale: 0.9 }).then(h => this.mortarHerb = h); this.refresh();
    } else if (it.kind === "bottle" && near(L.bottleSocket, 0.32, 0.6)) {
      if (!this.brew.readyToBottle) { this.ui.toast("أكمل الخلط أولًا"); this.bounceHome(it); return; }
      if (this.bottleIn && this.bottleIn !== it) { this.ui.toast("انتظر حتى تمتلئ القارورة الحالية"); this.bounceHome(it); return; }
      this.bottleIn = it; this.fill = 0; it.obj.position.copy(L.bottleSocket); it.obj.quaternion.identity(); it.fill(0, new THREE.Color(0x1ab866)); this.audio.play("glass", 1.1, 0.7); this.refresh();
    } else if (it.kind === "potion" && near(L.handoff, 0.45, 0.5)) {
      if (this.deliver(it.index)) {
        it.consumed = true; const rejected = it.index === 2 && this.state.herb === Herb.UseWilted && this.chapter === 2;
        const from = it.pos.clone(), to = rejected ? L.discard : L.display(this.chapter === 2 ? it.index + 1 : 0);
        this.fx.add(new THREE.Object3D(), 1, k => { it.obj.position.lerpVectors(from, to, k * k * (3 - 2 * k)); if (k >= 1 && rejected) it.obj.visible = false; });
      }
    }
  }
  bounceHome(it) {
    this.audio.play("whoosh", 1.4, 0.35); const from = it.pos.clone();
    this.fx.add(new THREE.Object3D(), 0.6, k => { it.obj.position.lerpVectors(from, it.home, k).y += Math.sin(k * Math.PI) * 0.35; if (k >= 1) { it.returnHome(); this.audio.play("thud", 1.3, 0.4); } });
  }

  // ---------------------------------------------------------------- player movement + station camera
  teleport(pos, yaw, instant) {
    const go = () => { this.rig.position.set(pos.x, this.inVR ? this.vrLift || 0 : 0, pos.z); if (!instant) this.audio.play("whoosh", 1.1, 0.5); if (this.inVR) { this.rig.rotation.y = yaw - (this.headYaw() - this.rig.rotation.y); } else { this.yaw = yaw; this.pitch = -0.05; this.focused = false; this.glide = 1; } };
    if (instant || !this.inVR) go(); else this.ui.fade(true, 120).then(() => { go(); this.ui.fade(false, 220); });
  }
  headYaw() { const q = new THREE.Quaternion(); this.camera.getWorldQuaternion(q); return new THREE.Euler().setFromQuaternion(q, "YXZ").y; }
  focusOn(name) {
    const v = Stations[name]; if (!v || !v.cam) return;
    this.fromPos = this.camera.getWorldPosition(new THREE.Vector3()); this.fromQ = this.camera.getWorldQuaternion(new THREE.Quaternion());
    this.focused = name; this.glide = 0; this.rig.position.set(v.stand.x, 0, v.stand.z); this.yaw = v.standYaw; this.pitch = -0.3;
  }
  unfocus() { this.fromPos = this.camera.getWorldPosition(new THREE.Vector3()); this.fromQ = this.camera.getWorldQuaternion(new THREE.Quaternion()); this.focused = false; this.glide = 0; }
  walk(move, dt) {
    if (!move.lengthSq()) return; const r = this.rig.position, next = r.clone().add(move.multiplyScalar(dt));
    const blocked = p => colliders.some(b => p.x > b.min.x - 0.24 && p.x < b.max.x + 0.24 && p.z > b.min.z - 0.24 && p.z < b.max.z + 0.24 && b.min.y < 1.2 && b.max.y > 0.15);
    if (!blocked(next)) r.copy(next); else { const nx = r.clone().setX(next.x), nz = r.clone().setZ(next.z); if (!blocked(nx)) r.copy(nx); else if (!blocked(nz)) r.copy(nz); }
  }
  applyDesktopPose(dt) {
    this.rig.rotation.set(0, 0, 0); this.rig.updateMatrixWorld(true);
    const freePos = this.rig.position.clone().add(new THREE.Vector3(0, 1.62, 0)), freeQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
    let tp = freePos, tq = freeQ;
    if (this.focused) { const v = Stations[this.focused]; tp = v.cam; tq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(v.cam, v.look, new THREE.Vector3(0, 1, 0))); }
    this.glide = Math.min(1, this.glide + dt / 1.15); const e = this.glide * this.glide * (3 - 2 * this.glide);
    const pos = this.glide < 1 && this.fromPos ? this.fromPos.clone().lerp(tp, e) : tp, q = this.glide < 1 && this.fromQ ? this.fromQ.clone().slerp(tq, e) : tq;
    this.camera.position.copy(pos.clone().sub(this.rig.position)); this.camera.quaternion.copy(q);
  }

  // ---------------------------------------------------------------- desktop + touch input
  setupDesktop() {
    const el = this.renderer.domElement;
    addEventListener("keydown", e => { this.keys[e.code] = true; this.audio.start();
      if (e.code === "KeyE") this.act(); if (e.code === "KeyQ") this.goToStation(); if (e.code === "Tab") { e.preventDefault(); this.paused ? (this.paused = false, this.refresh()) : this.glossary(0); }
      if (e.code === "KeyR") this.ui.modal("إعادة التجربة؟", "ستبدأ مجددًا برصيد 100 عملة.", C("نعم، إعادة", () => location.reload()), C("متابعة", () => this.refresh())); });
    addEventListener("keyup", e => { this.keys[e.code] = false; });
    el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("pointermove", e => {
      this.pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (e.pointerType === "mouse" && (e.buttons & 2) && !this.focused) { this.yaw -= e.movementX * 0.0025; this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.002, -1.2, 1.3); }
      if (e.pointerType === "mouse" && (e.buttons & 1) && this.held?.kind === "pestle") this.pestleDy = (this.pestleDy || 0) + e.movementY;
    });
    el.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" && e.button === 0 && !this.held && this.hover) this.act(); });
  }
  setupTouch() {
    const stick = document.getElementById("stick"), knob = document.getElementById("knob"), pourBtn = document.getElementById("pour");
    this.touchMove = new THREE.Vector2(); let stickId = null, lookId = null, start, last, t0, moved;
    const el = this.renderer.domElement;
    el.addEventListener("touchstart", e => {
      this.touchUsed = true; this.audio.start(); stick.hidden = false;
      for (const t of e.changedTouches) {
        if (stickId === null && t.clientX < innerWidth * 0.33 && t.clientY > innerHeight * 0.4) { stickId = t.identifier; start = { x: t.clientX, y: t.clientY }; }
        else if (lookId === null) { lookId = t.identifier; last = { x: t.clientX, y: t.clientY }; t0 = performance.now(); moved = false; this.pointer.set(t.clientX / innerWidth * 2 - 1, -(t.clientY / innerHeight) * 2 + 1); }
      } e.preventDefault();
    }, { passive: false });
    el.addEventListener("touchmove", e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { const dx = THREE.MathUtils.clamp((t.clientX - start.x) / 60, -1, 1), dy = THREE.MathUtils.clamp((t.clientY - start.y) / 60, -1, 1); this.touchMove.set(dx, -dy); knob.style.transform = `translate(${dx * 45}px,${dy * 45}px)`; }
        if (t.identifier === lookId) { const dx = t.clientX - last.x, dy = t.clientY - last.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; last = { x: t.clientX, y: t.clientY };
          this.pointer.set(t.clientX / innerWidth * 2 - 1, -(t.clientY / innerHeight) * 2 + 1);
          if (!this.held && !this.focused) { this.yaw -= dx * 0.005; this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.004, -1.2, 1.3); } }
      } e.preventDefault();
    }, { passive: false });
    const end = e => { for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; this.touchMove.set(0, 0); knob.style.transform = ""; }
      if (t.identifier === lookId) { lookId = null; if (!moved && performance.now() - t0 < 350) { this.updateHover(); this.act(); } } } };
    el.addEventListener("touchend", end); el.addEventListener("touchcancel", end);
    pourBtn.addEventListener("pointerdown", () => this.pourHeld = true); pourBtn.addEventListener("pointerup", () => this.pourHeld = false); pourBtn.addEventListener("pointerleave", () => this.pourHeld = false);
  }
  updateHover() {
    this.ray.setFromCamera(this.pointer, this.camera); this.ray.far = 3;
    const objs = this.items.filter(i => !i.consumed && i.obj.visible).map(i => i.obj);
    const hits = this.ray.intersectObjects(objs.concat(refs.door ? [refs.door] : []), true);
    this.hover = null; this.hoverDoor = false;
    if (hits.length) { let o = hits[0].object; while (o && !this.items.find(i => i.obj === o) && o !== refs.door) o = o.parent;
      if (o === refs.door) this.hoverDoor = this.phase === P.Intro; else this.hover = this.items.find(i => i.obj === o); }
  }
  act() {
    if (this.paused || this.inVR) return; this.audio.start();
    if (this.held) { const it = this.held; this.held = null; it.held = false; this.tryDrop(it); return; }
    if (this.hover && !this.hover.consumed && this.hover !== this.bottleIn) { this.held = this.hover; this.held.held = true; this.audio.play("pop", 1, 0.8); }
    else if (this.hoverDoor) this.openShopDoor();
  }
  dropHeld(drop) { if (!this.held) return; const it = this.held; this.held = null; it.held = false; drop ? this.tryDrop(it) : it.returnHome(); }
  heldTarget() {
    this.ray.setFromCamera(this.pointer, this.camera); const it = this.held;
    if (it.kind === "spoon") { const t = this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -L.liquid.y), new THREE.Vector3());
      if (t && Math.hypot(t.x - L.liquid.x, t.z - L.liquid.z) < L.innerRadius + 0.1) { const f = new THREE.Vector3(t.x - L.liquid.x, 0, t.z - L.liquid.z).clampLength(0, L.innerRadius - 0.05); return L.liquid.clone().add(f).setY(L.liquid.y - 0.08); } }
    if (it.kind === "pestle" && this.pestleDy !== undefined && this.camera.getWorldPosition(new THREE.Vector3()).distanceTo(L.mortar) < 2.4) {
      const y = THREE.MathUtils.clamp(it.pos.y - this.pestleDy * 0.006, L.mortar.y + 0.03, L.mortar.y + 0.42); this.pestleDy = 0; return L.mortar.clone().setY(y); }
    this.ray.far = 2.8; const hits = this.ray.intersectObject(refs.root, true);
    if (hits.length) return hits[0].point.add(new THREE.Vector3(0, 0.01, 0));
    return this.ray.ray.at(1.1, new THREE.Vector3()).add(new THREE.Vector3(0, -0.15, 0));
  }

  // ---------------------------------------------------------------- VR (WebXR)
  setupVR() {
    const btn = document.getElementById("entervr"), help = document.getElementById("vr-help");
    const say = m => { help.textContent = m; help.hidden = false; setTimeout(() => help.hidden = true, 6000); };
    if (navigator.xr) navigator.xr.isSessionSupported("immersive-vr").then(ok => { btn.hidden = !ok; }).catch(() => {});
    btn.onclick = async () => {
      this.audio.start();
      if (!window.isSecureContext || !navigator.xr) { say("افتح الرابط في متصفح النظارة (يحتاج https)."); return; }
      try {
        const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"] });
        await this.renderer.xr.setSession(session);
      } catch (e) { console.error(e); say("تعذّر بدء الواقع الافتراضي: " + e.message); }
    };
    this.renderer.xr.addEventListener("sessionstart", () => {
      this.inVR = true; this.dropHeld(false); this.focused = false; this.vrLift = 0; this.calibrateIn = 1.5; this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true; for (const n of this.npcs) n.holder.traverse(o => o.castShadow = false);
      const p = this.rig.position.clone(); this.camera.position.set(0, 0, 0); this.camera.quaternion.identity(); this.rig.position.copy(p); this.rig.rotation.y = this.yaw;
      btn.textContent = "اخرج من الواقع الافتراضي"; this.ui.dirty = true;
      setTimeout(() => { this.ui.toast("وجّه الشعاع واضغط الزناد للإمساك من بعيد • B لضبط الطول"); this.ui.toastUntil = performance.now() + 7000; }, 1800);
      this.scene.add(this.vrFader);
    });
    this.renderer.xr.addEventListener("sessionend", () => { this.inVR = false; this.rig.position.y = 0; this.renderer.shadowMap.autoUpdate = true; this.yaw = this.rig.rotation.y; this.rig.rotation.y = 0; this.camera.position.set(0, 1.62, 0); btn.textContent = "ادخل الواقع الافتراضي 🥽"; });
    // Head-locked fader so fades/teleports cover the whole headset view.
    this.vrFader = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0, depthTest: false }));
    this.vrFader.renderOrder = 99; this.vrFader.position.z = -0.12; this.camera.add(this.vrFader); this.ui.vrFade = { target: 0 };
    const factory = new XRControllerModelFactory();
    this.hands = [0, 1].map(i => {
      const ray = this.renderer.xr.getController(i), grip = this.renderer.xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip)); this.rig.add(ray, grip);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffe0a0 }));
      line.scale.z = 3; ray.add(line);
      const h = { i, ray, grip, line, held: null, last: {} };
      ray.addEventListener("connected", e => { h.source = e.data; h.hand = e.data.handedness; });
      ray.addEventListener("disconnected", () => { h.source = null; });
      return h;
    });
    this.arc = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x4dffd0 })); this.arc.visible = false; this.scene.add(this.arc);
    this.arcMark = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 32), new THREE.MeshBasicMaterial({ color: 0x4dffd0, side: THREE.DoubleSide })); this.arcMark.rotation.x = -Math.PI / 2; this.arcMark.visible = false; this.scene.add(this.arcMark);
  }
  updateVR(dt) {
    if (this.calibrateIn > 0 && (this.calibrateIn -= dt) <= 0) this.calibrate(false);
    if ((this.shadowT = (this.shadowT || 0) + dt) > 1.5) { this.shadowT = 0; this.renderer.shadowMap.needsUpdate = true; }
    let vrHover = null;
    for (const h of this.hands) {
      const gp = h.source && h.source.gamepad; if (!gp) continue;
      const btn = k => !!(gp.buttons[k] && gp.buttons[k].pressed), down = k => btn(k) && !h.last[k];
      const trigger = btn(0), squeeze = btn(1), stick = new THREE.Vector2(gp.axes[2] || 0, gp.axes[3] || 0);
      const gripPos = h.grip.getWorldPosition(new THREE.Vector3());
      // Laser ray: HUD buttons, the shop door, items far away (grab from afar), drop zones.
      const m = new THREE.Matrix4().extractRotation(h.ray.matrixWorld); this.ray.ray.origin.setFromMatrixPosition(h.ray.matrixWorld); this.ray.ray.direction.set(0, 0, -1).applyMatrix4(m); this.ray.far = 6;
      const ui = this.ui.rayHit(this.ray), far = !ui && !h.held ? this.rayItem(this.ray.ray) : null, zone = h.held ? this.rayZone(this.ray.ray) : null;
      if (far) vrHover = vrHover || far;
      h.line.scale.z = ui ? this.ray.ray.origin.distanceTo(ui.point) : far ? this.ray.ray.origin.distanceTo(far.pos) : zone ? this.ray.ray.origin.distanceTo(zone.at) : 3;
      h.line.material.color.set(far || zone ? 0x6dffb0 : 0xffe0a0);
      if (down(0)) {
        if (ui && ui.button) this.ui.click(ui.button);
        else if (far) this.vrGrab(h, far, true, gp);
        else if (this.phase === P.Intro && refs.door && this.ray.intersectObject(refs.door, true).length) this.openShopDoor();
      }
      // Grab with the grip button: nearest item within reach of the hand (or the one the ray points at).
      if (down(1) && !h.held) {
        let best = null, bd = 0.2;
        for (const it of this.items) if (!it.consumed && !it.flying && it.obj.visible && it !== this.bottleIn) { const gp2 = it.pos.clone().add(new THREE.Vector3(0, GRIP[it.kind] || 0.08, 0)), d = gp2.distanceTo(gripPos); if (d < bd) { bd = d; best = it; } }
        if (best) this.vrGrab(h, best, false, gp); else if (far) this.vrGrab(h, far, false, gp);
      }
      if (h.held) {
        const it = h.held, q = h.grip.getWorldQuaternion(new THREE.Quaternion());
        const target = gripPos.clone().sub(new THREE.Vector3(0, h.offset, 0).applyQuaternion(q));
        h.fly = Math.min(1, (h.fly ?? 1) + dt / 0.28);
        if (h.fly < 1) { it.obj.position.lerpVectors(h.flyFrom, target, h.fly * h.fly * (3 - 2 * h.fly)); it.obj.quaternion.slerp(q, h.fly); }
        else { it.obj.quaternion.copy(q); it.obj.position.copy(target); }
        if (it.kind === "spoon") this.observeStir(it.pos); if (it.kind === "pestle") this.observePestle(it.pos);
        if (h.byTrigger ? !trigger : !squeeze) { h.held = null; it.held = false; it.obj.quaternion.identity(); this.vrRelease(it, zone, gripPos); }
      }
      if (h.hand === "right" && down(5)) this.calibrate(true);
      if (trigger && h.hand === "right" && this.bottleIn && !h.held) this.pour(dt);
      if (h.hand === "left" && down(4)) this.paused ? (this.paused = false, this.refresh()) : this.glossary(0);
      // Locomotion: left stick walks (head-relative), right stick snap-turns or aims a teleport arc.
      if (h.hand === "left" && stick.lengthSq() > 0.04 && !this.paused) {
        const f = new THREE.Vector3(); this.camera.getWorldDirection(f); f.y = 0; f.normalize(); const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0));
        this.walk(f.multiplyScalar(-stick.y).add(r.multiplyScalar(stick.x)).multiplyScalar(1.5), dt);
      }
      if (h.hand === "right") {
        if (Math.abs(stick.x) > 0.75 && !h.turned && !h.aiming) { const head = this.camera.getWorldPosition(new THREE.Vector3()); this.rig.rotation.y -= Math.sign(stick.x) * Math.PI / 6;
          const after = this.camera.getWorldPosition(new THREE.Vector3()); this.rig.position.add(head.sub(after)).setY(this.vrLift || 0); h.turned = true; }
        if (Math.abs(stick.x) < 0.3) h.turned = false;
        if (stick.y < -0.7) { h.aiming = true; this.aimArc(h.ray); } else if (h.aiming) { h.aiming = false; this.arc.visible = this.arcMark.visible = false; if (this.arcTarget) this.teleport(this.arcTarget, this.headYaw()); }
      }
      for (let k = 0; k < gp.buttons.length; k++) h.last[k] = btn(k);
    }
    this.hover = vrHover;
    this.ui.vrFade && (this.vrFader.material.opacity += (this.ui.vrFade.target - this.vrFader.material.opacity) * Math.min(1, dt * 12));
  }
  // Eye height: if the headset reports a low (or missing) floor, lift the player to a standing eye height.
  calibrate(force) {
    const y = this.camera.position.y; if (!force && y > 1.25) return;
    this.vrLift = THREE.MathUtils.clamp(1.6 - y, -0.6, 1.7); this.rig.position.y = this.vrLift;
    if (force) { this.ui.toast("تم ضبط الطول"); this.audio.play("chime", 1.2, 0.6); }
  }
  rayItem(ray) {
    let best = null, bd = 0.13;
    for (const it of this.items) { if (it.consumed || it.flying || it.held || !it.obj.visible || it === this.bottleIn) continue;
      const c = it.pos.clone().add(new THREE.Vector3(0, 0.07, 0)), far = c.distanceTo(ray.origin), d = ray.distanceToPoint(c) - far * 0.012;
      if (far < 8 && d < bd) { bd = d; best = it; } }
    return best;
  }
  rayZone(ray) {
    const zones = [{ at: L.liquid.clone().setY(1.12), r: 0.65 }, { at: L.mortar.clone().setY(1.0), r: 0.3 }, { at: L.bottleSocket.clone().setY(1.05), r: 0.3 }, { at: L.handoff.clone().setY(1.1), r: 0.45 }];
    return zones.find(z => ray.distanceToPoint(z.at) < z.r && ray.origin.distanceTo(z.at) < 8) || null;
  }
  vrGrab(h, it, byTrigger, gp) {
    h.held = it; it.held = true; h.byTrigger = byTrigger; h.offset = GRIP[it.kind] || 0.08;
    const near = it.pos.distanceTo(h.grip.getWorldPosition(new THREE.Vector3())) < 0.3; h.fly = near ? 1 : 0; h.flyFrom = it.pos.clone();
    gp.hapticActuators?.[0]?.pulse?.(0.35, 60); this.audio.play(near ? "pop" : "whoosh", near ? 1 : 1.3, 0.7);
  }
  // Release: if the ray points at a station (cauldron, mortar, bottle ring, counter tray) the item flies there.
  vrRelease(it, zone, handPos) {
    if (!zone || handPos.distanceTo(zone.at) < 0.5) { this.tryDrop(it); return; }
    const from = it.pos.clone(); it.flying = true; this.audio.play("whoosh", 1.2, 0.5);
    this.fx.add(new THREE.Object3D(), 0.45, k => { it.obj.position.lerpVectors(from, zone.at, k * k * (3 - 2 * k)).y += Math.sin(k * Math.PI) * 0.4;
      if (k >= 1 && it.flying) { it.flying = false; this.tryDrop(it); } });
  }
  aimArc(ctrl) {
    const pts = [], p = ctrl.getWorldPosition(new THREE.Vector3()), v = new THREE.Vector3(0, 0, -1).applyQuaternion(ctrl.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(6.5);
    this.arcTarget = null;
    for (let i = 0; i < 40; i++) { pts.push(p.clone()); const n = p.clone().addScaledVector(v, 0.04); v.y -= 9.8 * 0.04;
      if (n.y <= 0) { const ok = L.isInside(n) || n.z < 0.9; const hitWall = colliders.some(b => b.containsPoint(n.clone().setY(0.5))); if (ok && !hitWall) this.arcTarget = n.setY(0); pts.push(n); break; } p.copy(n); }
    this.arc.geometry.setFromPoints(pts); this.arc.visible = true; this.arc.material.color.set(this.arcTarget ? 0x4dffd0 : 0xff5a4d);
    this.arcMark.visible = !!this.arcTarget; if (this.arcTarget) this.arcMark.position.copy(this.arcTarget).setY(0.02);
  }

  // Fewer lights on headsets/phones: the fire plus the 3 nearest lamps (constant count = no shader recompiles).
  budgetLights() {
    const all = refs.lights || [], low = this.inVR || this.touchUsed, max = low ? 4 : 99;
    if (refs.hemi) refs.hemi.intensity = low ? 1.3 : 0.9;
    if (all.length <= max) { all.forEach(l => l.visible = true); return; }
    const eye = this.camera.getWorldPosition(new THREE.Vector3()), wp = l => l.getWorldPosition(new THREE.Vector3());
    const sorted = all.slice().sort((a, b) => (b === refs.fire) - (a === refs.fire) || wp(a).distanceToSquared(eye) - wp(b).distanceToSquared(eye));
    sorted.forEach((l, i) => l.visible = i < max);
  }
  // ---------------------------------------------------------------- frame
  update(dt, t) {
    this.dialogue.update(dt);
    const name = this.stationName();
    if (name !== this.lastStation) { this.lastStation = name; this.dropHeld(false); if (!this.inVR) { if (name && Stations[name].cam) this.focusOn(name); else if (this.focused) this.unfocus(); } }
    if (this.inVR) this.updateVR(dt);
    else {
      const k = this.keys, mv = new THREE.Vector2((k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0));
      if (this.touchMove && this.touchMove.lengthSq() > 0.01) mv.copy(this.touchMove);
      if (mv.lengthSq() && !this.paused) {
        if (this.focused) this.unfocus();
        const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        this.walk(f.multiplyScalar(mv.y).add(r.multiplyScalar(mv.x)).normalize().multiplyScalar(k.ShiftLeft ? 3.3 : 1.9), dt);
      }
      this.applyDesktopPose(dt);
      this.updateHover();
      if (this.held) {
        const it = this.held, tgt = this.heldTarget(); it.obj.position.lerp(tgt, Math.min(1, dt * 20));
        if (it.kind === "spoon") { const off = it.pos.clone().sub(L.liquid).setY(0); const up = new THREE.Vector3(0, 1, 0).add(off.lengthSq() > 1e-4 ? off.normalize().multiplyScalar(0.38) : new THREE.Vector3()).normalize();
          it.obj.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up), Math.min(1, dt * 8)); this.observeStir(it.pos); }
        if (it.kind === "pestle") this.observePestle(it.pos);
        this.ui.hint(it.label + " • E للإفلات" + (it.kind === "pestle" ? " • اضغط الزر الأيسر وحرّك الفأرة للأعلى والأسفل" : it.kind === "spoon" ? " • حرّك المؤشر دائريًا داخل المرجل" : ""));
      } else this.ui.hint(this.hover && !this.hover.consumed ? this.hover.label + " • E للإمساك" : this.hoverDoor ? "الباب • E للفتح" : "");
      if ((this.keys.KeyF || this.pourHeld) && this.bottleIn) this.pour(dt);
      if (this.phase === P.Intro && this.doorOpened && L.isInside(this.rig.position)) this.enterShop();
    }
    if (this.inVR && this.phase === P.Intro && this.doorOpened && L.isInside(this.camera.getWorldPosition(new THREE.Vector3()))) this.enterShop();
    document.getElementById("pour").hidden = !(this.touchUsed && this.bottleIn);
    document.getElementById("keys").style.opacity = t > 25 ? 0 : 0.7;
    // Item glow: next item pulses gold, hovered item glows brighter.
    for (const it of this.items) { if (it.consumed) continue; const hov = it === this.hover && !it.held, tgt = this.isTarget(it) && !it.held; it.setGlow(hov ? 0.75 : tgt ? 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 4.5)) : 0); }
    // Brew visuals.
    const b = this.brew; this.swirl = Math.max(0, (this.swirl || 0) - dt * 1.2);
    this.fx.activity = (this.phase === P.Brew || this.phase === P.BatchBrew) ? (b.readyToBottle ? 0.6 : b.readyToStir ? 0.35 + b.stirring * 0.65 : 0) : 0;
    this.fx.tint = this.map.tint; this.fx.golden = this.map.inZone;
    if (refs.liquid) { const target = new THREE.Color(0x14261f).lerp(this.batch && this.state.supplier === Supplier.Premium ? new THREE.Color(0x29cc8c) : this.state.herb === Herb.UseWilted && this.batch ? new THREE.Color(0x47803f) : new THREE.Color(0x21ab6b), b.stirring);
      refs.liquid.material.color.lerp(target, Math.min(1, dt * 3)); refs.liquid.material.emissive.copy(refs.liquid.material.color); refs.liquid.position.y = L.liquid.y + Math.sin(t * 3) * 0.004; }
    if (this.pourT > 0) { this.pourT -= dt; } this.audio.setPouring(this.pourT > 0);
    if ((this.lightT = (this.lightT || 0) - dt) <= 0) { this.lightT = 0.4; this.budgetLights(); }
    this.fx.update(dt, t, this);
    const eyeNow = this.camera.getWorldPosition(new THREE.Vector3()); for (const n of this.npcs) n.update(dt, t, this.dialogue, eyeNow, this);
    if (this.firas) this.firas.update(dt, t, this, (Stations[name] && name !== "ending" ? Stations[name].firas : L.firasSpot));
    this.ui.update(dt, this.state.cash, this.inVR);
    // Alchemy map panel (desktop/phone) while mixing or stirring.
    const showMap = (name === "mix" || name === "cauldron") && (this.phase === P.Brew || this.phase === P.BatchBrew);
    const mapEl = document.getElementById("map"); mapEl.hidden = !showMap || this.inVR;
    if (showMap) { this.map.draw(document.getElementById("map-canvas").getContext("2d"), 360); document.getElementById("map-quality").textContent = this.map.any ? this.map.qualityText : "أضف المكونات"; }
    if (this.warm) { this.sun.intensity = Math.min(3.0, this.sun.intensity + dt * 0.3); }
  }
}
