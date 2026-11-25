// Copyright (c) 2026 CAPITAL Team. All rights reserved. Proprietary — see LICENSE. Unauthorized copying or redistribution is prohibited.
// Game director: story phases, brewing, NPC trading, alchemy map, station camera, and all controls
// (desktop mouse+keyboard, phone touch, VR headset). Port of the Unity GameDirector & co.
import * as THREE from "three";
import { GameState, Finance, RecipeProgress, Supplier, Herb } from "./finance.js";
import { L, Stations, U } from "./layout.js";
import { place, load, colliders, box3, blocker, box } from "./assets.js";
import { refs } from "./shop.js";
import { UI, wait } from "./ui.js";
import { Audio } from "./audio.js";
import { FX } from "./fx.js";
import { NPC, Firas } from "./npc.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

const P = { Intro: 0, Purchase: 1, Brew: 2, Ready: 3, Price: 4, Handoff: 5, RevenueQuiz: 6, Offer: 7, Supplier: 8, Wilt: 9, BatchBrew: 10, BatchHandoff: 11, Expenses: 12, FinalQuiz: 13, Report: 14 };
const TERMS = [
  ["رأس المال", "الأموال أو الموارد التي يبدأ بها صاحب المشروع نشاطه."], ["الحساب البنكي", "حساب لدى البنك تُحفظ فيه أموالك وتُسجَّل فيه كل عملية إيداع أو سحب."],
  ["بطاقة الخصم", "بطاقة تدفع بها من رصيدك مباشرة؛ يُخصم المبلغ فورًا من حسابك."], ["الدفع الإلكتروني", "الدفع بالبطاقة أو الهاتف دون نقود ورقية، ويُسجَّل تلقائيًا في الحساب."],
  ["المواد الخام", "المواد المستخدمة لصناعة المنتج."], ["تكلفة الإنتاج", "مجموع التكاليف المباشرة اللازمة لصناعة المنتج."],
  ["سعر البيع", "المبلغ الذي يدفعه الزبون مقابل المنتج."], ["بطاقة الائتمان", "بطاقة يدفع بها البنك عنك الآن وتسدّد له لاحقًا؛ التأخير يعني فائدة."],
  ["الإيرادات", "الأموال الناتجة عن بيع المنتجات قبل طرح التكاليف."], ["تكلفة البضاعة المباعة", "التكلفة المباشرة للمنتجات التي تم بيعها."],
  ["إجمالي الربح", "الإيرادات ناقص تكلفة البضاعة المباعة."], ["التحويل البنكي", "نقل المال من حساب إلى حساب إلكترونيًا."],
  ["المخاطرة", "احتمال حدوث خسارة أو نتيجة غير متوقعة."], ["الفائدة", "ثمن اقتراض المال؛ مبلغ إضافي يُدفع إذا تأخر السداد."],
  ["المصروفات التشغيلية", "تكاليف تشغيل المحل غير الداخلة في تكلفة المنتج مباشرة."], ["صافي الربح", "إجمالي الربح بعد طرح خسائر التلف والمصروفات التشغيلية."],
  ["كشف الحساب", "قائمة بكل العمليات التي دخلت حسابك أو خرجت منه، مع الرصيد بعد كل عملية."], ["إدارة الأموال", "تخطيط الدخل والمصاريف والادخار ومراقبتها لتتخذ قرارات مالية صحيحة."]];
const TERM_CARDS = [
  "المال اللي بتبدأ فيه مشروعك. إنت بلّشت بـ100 عملة بحسابك البنكي. الهدف إنها تكبر.",
  "مكان آمن لمصاريك بالبنك. كل عملية بتدخل أو بتطلع بتنسجّل فيه، فبتعرف وين راحت كل عملة.",
  "بتدفع فيها من رصيدك أنت. المبلغ بينخصم فورًا، فما بتصرف أكتر من اللي معك.",
  "دفع بالبطاقة أو التلفون بدون كاش. أسرع وأأمن، وكل عملية بتظهر بكشف حسابك.",
  "الأشياء اللي بتصنع منها المنتج: الكركديه والنعناع والماء والعبوة. مجموع أسعارها = تكلفة الخلطة.",
  "مجموع تكاليف صناعة المنتج: 10 + 8 + 5 + 2 = 25 عملة. إذا بعت بأقل، بتخسر.",
  "اللي بيدفعه الزبون. السعر العالي بيرفع ربحك، بس ممكن يزعّل الزبون ويأثّر على سمعتك.",
  "البنك بيدفع عنك هلّأ وإنت بتسدّد بعدين. إذا سدّدت بالوقت ما في فائدة. فيزا وماستركارد شبكات بتوصل البنوك ببعض.",
  "كل المال اللي دخل حسابك من البيع، قبل ما تطرح أي تكلفة. بعت بـ30؟ إيرادك 30، مش ربحك.",
  "تكلفة المنتجات اللي بعتها فعلًا. بعت خلطة كلّفتك 25، فتكلفة البضاعة المباعة = 25.",
  "الإيرادات ناقص تكلفة البضاعة المباعة: 30 − 25 = 5. هاد ربح قبل باقي المصاريف.",
  "مصاري بتنتقل من حساب لحساب إلكترونيًا. التاجر بيحوّلك حقّك على حسابك مباشرة.",
  "احتمال يصير إشي ما بتتوقعه ويكلّفك. الرخيص ممكن يجيب ورقة ميرمية ذابلة، والممتاز أغلى بس أضمن.",
  "ثمن استلاف المصاري. ادفع فاتورة البطاقة الائتمانية بالوقت، وما بتدفع ولا عملة فائدة.",
  "مصاريف تشغيل المحل: الإيجار والكهربا والحطب. مش من تكلفة المنتج، بس لازم تندفع.",
  "اللي بيضل فعلًا: إجمالي الربح ناقص التلف والمصروفات. هاد ربحك الحقيقي.",
  "قائمة بكل عملية دخلت أو طلعت من حسابك، والرصيد بعد كل وحدة. اقراه دايمًا.",
  "خطّط لمصاريك قبل ما تصرف، وراقب حسابك، ووفّر جزء للطوارئ. هيك بتكبر مصاريك.",
];
const GRIND = ["خشن", "متوسط", "ناعم كالبودرة"];
const TERM_WORDS = ["رأس مال", "حسابك البنكي", "بطاقة الخصم", "الدفع الإلكتروني", "الخام", "تكلفتها", "سعر", "ائتمان", "إيراد", "التكاليف", "الربح", "بحوّلك", "عالسعر", "فائدة", "مصروفات تشغيل", "صافي الربح", "كشف حسابك", "بتدير أموالك"];
const CARDS = [["المشهد ١ من ٣", "الإرث"], ["المشهد ٢ من ٣", "أول زبون"], ["المشهد ٣ من ٣", "الطلبية الكبرى"]];
const MODELS = { herb: "herb_red", crystal: "crystal_blue", water: "water_flask", bottle: "potion_bottle", potion: "potion_bottle", pestle: "pestle", spoon: "stir_paddle" };
const GRIP = { spoon: 0.95, pestle: 0.2, pipette: 0.24 };
// Market square (through the portal). Scene 1: the order needs 4 things (buy = ingredient index); 4 lookalikes are wrong.
const MARKET = [
  { key: "m_herb", stall: 0, name: "زهر الكركديه", price: 10, tag: "للطاقة", buy: 0, model: "herb_red", scale: 1.3 },
  { key: "m_mush", stall: 0, name: "بابونج", price: 6, tag: "للنوم", line: "T1_NO_MUSH", model: "herb_red", scale: 1.2, tint: 0xf3e7a6 },
  { key: "m_water", stall: 0, name: "ماء معدني", price: 5, tag: "للتحضير", buy: 2, model: "water_flask", scale: 1.1 },
  { key: "m_honey", stall: 0, name: "عسل", price: 7, tag: "للتحلية", line: "T1_NO_HONEY" },
  { key: "m_crystal", stall: 1, name: "نعناع", price: 8, tag: "لصفاء الذهن", buy: 1, model: "herb_red", scale: 1.3, tint: 0x3fa34d },
  { key: "m_purple", stall: 1, name: "خزامى", price: 9, tag: "للاسترخاء", line: "B_NO_PURPLE", model: "herb_red", scale: 1.2, tint: 0x9a6bd6 },
  { key: "m_bottle", stall: 1, name: "عبوة", price: 2, tag: "للتعبئة", buy: 3, model: "potion_bottle", scale: 1 },
  { key: "m_salt", stall: 1, name: "ملح خشن", price: 4, tag: "للحفظ", line: "B_NO_SALT" },
];
const STALL_INFO = [
  { sign: "التاجر المتجول\nأعشاب • سوائل", hello: "T1_HELLO", deal: "T1_DEAL", offer: "T3_OFFER" },
  { sign: "تاجرة البلّور\nأعشاب ناشفة • عبوات", hello: "B_HELLO", deal: "B_DEAL", offer: "B3_OFFER" },
];
const ORDER_TEXT = "طلب الزبون: شاي أعشاب منشّط\nكركديه للطاقة • نعناع لصفاء الذهن\nماء معدني • عبوة • طحن متوسط";
// Trader sells single pieces (pick 3 of each; 7 + 5 + 3 = 15 per potion, 45 for three). Each piece shows its quality.
const LOOSE = [
  { kind: "herb", name: "ورق ميرمية", price: 7, notes: ["طري", "عادي", "يابس شوي", "طازة"], good: [0.82, 0.66, 0.48, 0.9] },
  { kind: "crystal", name: "راتنج لبان", price: 5, notes: ["صافي", "فيه شوائب", "عادي", "حبّات صغيرة"], good: [0.86, 0.45, 0.68, 0.6] },
  { kind: "water", name: "زيت زيتون", price: 3, notes: ["بكر", "عكر شوي", "عادي", "بكر ممتاز"], good: [0.8, 0.5, 0.65, 0.92] },
];
const ORDER3_TEXT = "طلب التاجر: 3 عبوات زيت ميرمية علاجي\nميرمية ناعمة • لبان ذايب • زيت زيتون\nقارن: اقتصادي 15 للعبوة ولا ممتاز 20؟";
// Scene 1 and scene 3 brew different potions: new ingredients, colours and a different target on the alchemy map.
const RECIPES = [
  { name: "شاي الأعشاب المنشّط", grind: 1, heat: false, labels: { herb: "زهر الكركديه", crystal: "النعناع", water: "الماء المعدني" }, models: { crystal: "herb_red" }, tint: { crystal: 0x3fa34d }, crushed: 0x8a2b10,
    zone: [0.42, 0.62], push: { crushed: [-0.05, 0.36], crystal: [0.3, 0.08], water: [-0.08, 0.1] }, potion: [0xa8322a, 0xc23a2e], steam: [0xc2cec6, 0xffb0a0], board: "شاي الأعشاب المنشّط\nكركديه 10 • نعناع 8 • ماء 5 • عبوة 2\nالطحن: متوسط" },
  { name: "زيت الميرمية العلاجي", grind: 2, heat: true, labels: { herb: "ورق الميرمية", crystal: "راتنج اللبان", water: "زيت الزيتون" }, models: {}, tint: { herb: 0xa9c4b4, crystal: 0xd99a3a, water: 0xb5a030 }, crushed: 0x8fae9c,
    zone: [-0.45, 0.58], push: { crushed: [0.06, 0.34], crystal: [-0.32, 0.1], water: [0.06, 0.1] }, potion: [0xc9a43a, 0xe2bf4a], steam: [0xd2c8b8, 0xffe0a0], board: "زيت الميرمية العلاجي\nميرمية • لبان • زيت زيتون\nالطحن: ناعم • اللبان ذايب" },
];
// Questions you can ask each character (point at them and press trigger / E).
const QUESTIONS = {
  "فراس": [["شو يعني هامش الربح؟", "A_MARGIN"], ["المصاري اللي معي كلها ربح؟", "A_CASH"], ["ليش الجودة مهمة؟", "A_QUALITY"], ["شو يعني ميزانية؟", "A_BUDGET"]],
  "التاجر المتجول": [["ليش الأسعار مختلفة؟", "A_T_PRICE"], ["في خصم إذا اشتريت كتير؟", "A_T_BULK"]],
  "الزبون": [["شو بهمّك بالخلطة؟", "A_C_WHY"], ["قدّيش سعرها عادة؟", "A_C_PRICE"]],
  "التاجر": [["ليش بدك كمية كبيرة؟", "A_M_ORDER"], ["شو بتفحص بالخلطة؟", "A_M_CHECK"]],
  "تاجرة البلّور": [["ليش العبوة المنيحة أغلى؟", "A_B_GLASS"], ["شو يعني سمعة المحل؟", "A_B_TRUST"]],
};
// Canvas sign in the world (Arabic shaped by the browser). yawUnity uses the Unity heading convention.
function sign(scene, text, pos, w, h, yawUnity, size = 64, bg = "#e8d4a6", ink = "#301e13") {
  const cv = document.createElement("canvas"); cv.width = 1024; cv.height = Math.round(1024 * h / w); const c = cv.getContext("2d");
  c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); c.strokeStyle = "#73501c"; c.lineWidth = 14; c.strokeRect(7, 7, cv.width - 14, cv.height - 14);
  c.fillStyle = ink; c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = `bold ${size}px Amiri`;
  const lines = text.split("\n"); lines.forEach((l, i) => c.fillText(l, cv.width / 2, cv.height / 2 + (i - (lines.length - 1) / 2) * size * 1.3));
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 }));
  m.position.copy(pos); m.rotation.y = -yawUnity * Math.PI / 180; scene.add(m); return m;
}
const MAT = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
function buildPipette(it) {
  const g = it.obj, glass = MAT(0xd6f2ff, { transparent: true, opacity: 0.45, roughness: 0.1 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.004, 0.2, 12), glass); tube.position.y = 0.1; g.add(tube);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 12), MAT(0xc2873a, { metalness: 0.7, roughness: 0.3 })); collar.position.y = 0.203; g.add(collar);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), MAT(0xb3261e, { roughness: 0.5 })); bulb.position.y = 0.24; bulb.scale.set(1, 1.3, 1); g.add(bulb);
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.003, 1, 10), new THREE.MeshBasicMaterial({ color: 0x1ab866 })); liq.name = "Liquid"; liq.visible = false; g.add(liq);
  it.bulb = bulb; it.pipeLiquid = liq;
}
function buildDecoy(it) {
  const g = it.obj, k = it.market.key;
  if (k === "m_mush") { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.06, 10), MAT(0xf2e8d0)); st.position.y = 0.03; g.add(st);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT(0xc0281c)); cap.position.y = 0.055; cap.scale.y = 0.7; g.add(cap);
    for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 4), MAT(0xffffff)); const a = i * 1.3; d.position.set(Math.cos(a) * 0.025, 0.08 - (i % 2) * 0.008, Math.sin(a) * 0.025); g.add(d); } }
  else if (k === "bundle") { const crate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.24), MAT(0x8a5a2b)); crate.position.y = 0.07; g.add(crate);
    const cols = [0xc4e8de, 0xff7a1a, 0xff8fc4];
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), MAT(cols[i % 3], { emissive: cols[i % 3], emissiveIntensity: i % 3 === 1 ? 0.5 : 0.1 })); m.position.set(-0.11 + (i % 3) * 0.11, 0.15, -0.07 + Math.floor(i / 3) * 0.07); g.add(m); }
    if (it.market.bundle === 2) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.25), MAT(0xd4a640, { metalness: 0.7, roughness: 0.3 })); band.position.y = 0.11; g.add(band); } }
  else if (k === "m_feather") { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 6), MAT(0xf0e6d0)); sh.position.y = 0.1; sh.rotation.z = 0.35; g.add(sh);
    const v = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), MAT(0x2f6fe0, { emissive: 0x0a2a70, emissiveIntensity: 0.4 })); v.scale.set(0.028, 0.085, 0.006); v.position.set(-0.03, 0.12, 0); v.rotation.z = 0.35; g.add(v); }
  else if (k === "m_honey") { const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 16), MAT(0xffe9b0, { transparent: true, opacity: 0.5, roughness: 0.1 })); jar.position.y = 0.045; g.add(jar);
    const hon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.032, 0.07, 16), MAT(0xe0a020, { emissive: 0x603800, emissiveIntensity: 0.3 })); hon.position.y = 0.037; g.add(hon);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 16), MAT(0x9a3b2a)); lid.position.y = 0.098; g.add(lid); }
  else if (k === "m_salt") { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), MAT(0x3a3a40, { roughness: 0.95 })); s.scale.set(0.05, 0.055, 0.045); s.position.y = 0.05; g.add(s);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 12), MAT(0xc2873a)); tie.rotation.x = Math.PI / 2; tie.position.y = 0.1; g.add(tie); }
}
const C = (text, action) => ({ text, action });
function tintAll(g, color, re) { g.traverse(o => { if (o.isMesh && re.test(o.name || "") ) { o.material = o.material.clone(); o.material.color.set(color); if (o.material.emissive && /Glow|Core/i.test(o.name)) o.material.emissive.set(color); } }); }

// ------------------------------------------------------------------ dialogue
class Dialogue {
  constructor(game) { this.g = game; this.lines = {}; this.queue = []; this.speaking = false; this.speaker = ""; }
  async load() {
    const csv = await (await fetch("assets/DIALOGUE.csv")).text();
    for (const raw of csv.split("\n")) { const c = raw.trim().split(","); if (c.length !== 8 || c[0] === "id") continue; this.lines[c[0]] = { speaker: c[1], text: c[4], dur: parseFloat(c[6]) }; }
    if (!this.g.fast) this.g.audio.preloadVoices(Object.keys(this.lines));
  }
  get busy() { return this.speaking || this.queue.length > 0; }
  say(...ids) { for (const id of ids) if (this.lines[id] && !this.queue.includes(id)) this.queue.push(id); }
  update(dt) {
    if (this.speaking) { this.left -= dt; if (this.left <= 0) { this.speaking = false; this.speaker = ""; this.g.ui.subtitle(""); this.g.audio.setSpeaking(false); this.gap = 0.25; } return; }
    if ((this.gap -= dt) > 0 || !this.queue.length) return;
    const id = this.queue.shift(), l = this.lines[id]; this.speaking = true; this.speaker = l.speaker; this.text = l.text; this.left = this.g.fast ? 0.05 : l.dur;
    this.g.ui.subtitle(l.speaker + ": " + l.text); this.g.audio.setSpeaking(true); this.g.onLine(l.text);
    if (!this.g.fast) this.g.audio.speak(id).then(d => { if (d && this.speaker === l.speaker) this.left = Math.max(this.left - (l.dur - d - 0.3), 0.3); });
  }
}

// ------------------------------------------------------------------ the bank
// Every change of the balance becomes a bank transaction (label, method, amount, balance after). Money itself is still
// posted by the finance engine, so the six outcomes stay exact; the bank is how the player sees and moves it.
class Bank {
  constructor(g) { this.g = g; this.tx = []; this.last = 100; this.credit = 0; }
  record(label, method) {
    const cash = this.g.state.cash, d = cash - this.last; if (!d) return; this.last = cash;
    if (method === "بطاقة ائتمان") this.credit += -d;
    const tx = { label, method, amount: d, balance: cash + this.credit }; this.tx.push(tx); this.g.onBankTx(tx);
  }
  payCredit() { if (!this.credit) return; const tx = { label: "سداد بطاقة الائتمان", method: "تطبيق البنك", amount: -this.credit, balance: this.g.state.cash }; this.credit = 0; this.tx.push(tx); this.g.onBankTx(tx); }
  get balance() { return this.g.state.cash + this.credit; }
}
// A card-payment terminal (POS): small screen that shows "ready / pay X / approved".
class POS {
  constructor(scene, pos, yaw) {
    this.g = new THREE.Group(); this.g.position.copy(pos); this.g.rotation.y = yaw; scene.add(this.g);
    this.cv = document.createElement("canvas"); this.cv.width = 320; this.cv.height = 300; this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.flipY = false; // glTF UVs
    this.ready = place(this.g, "assets/custom/pos_terminal.glb", new THREE.Vector3(), { scale: 1.25 }).then(m => { m && m.traverse(o => { if (o.isMesh && o.name === "Screen") o.material = new THREE.MeshBasicMaterial({ map: this.tex }); }); });
    this.idle(100);
  }
  get at() { return this.g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.19, 0)); }
  idle(balance) { this.screen3([["بنك القرية", 26, "#cfe8ff"], ["جاهز للدفع", 38, "#9fe6ff"], [`رصيدك: ${balance}`, 26, "#ffffff"], ["))) تقبل الخصم والائتمان", 18, "#7fa0b4"]]); }
  screen3(lines) {
    const c = this.cv.getContext("2d"); c.fillStyle = "#0b1820"; c.fillRect(0, 0, 320, 300); c.fillStyle = "#16384c"; c.fillRect(0, 0, 320, 6);
    c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "middle";
    const ys = [48, 120, 196, 256]; lines.forEach(([txt, size, col], i) => { c.fillStyle = col; c.font = `bold ${size}px Amiri`; c.fillText(txt, 160, ys[i]); });
    this.tex.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ grabbable items
class Item {
  constructor(game, kind, label, index) { this.g = game; this.kind = kind; this.label = label; this.index = index; this.obj = new THREE.Group(); this.held = false; this.consumed = false; this.filled = false; this.glow = []; }
  async build(pos) {
    const g = this.obj; g.position.copy(pos); this.g.scene.add(g);
    if (this.kind === "crushed") {
      const bowl = await place(g, "assets/kaykit/Restaurant/bowl_small.gltf", new THREE.Vector3(), { width: 0.16 });
      for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: this.g.recipe.crushed })); m.position.set(Math.sin(i * 3) * 0.035, 0.045, Math.cos(i * 3) * 0.035); g.add(m); }
    } else if (this.kind === "pipette") buildPipette(this);
    else if (this.market && !this.market.model) buildDecoy(this);
    else if (this.market) { await place(g, `assets/custom/${this.market.model}.glb`, new THREE.Vector3(), { scale: this.market.scale }); if (this.market.tint) tintAll(g, this.market.tint, /./); }
    else {
      const model = this.g.recipe.models?.[this.kind] || MODELS[this.kind];
      await place(g, `assets/custom/${model}.glb`, new THREE.Vector3(), { scale: model === "water_flask" ? 1.3 : (model === "herb_red" || model === "crystal_blue") ? 1.55 : 1 });
      const tint = this.g.recipe.tint[this.kind]; if (tint) tintAll(g, tint, model === "water_flask" ? /Water|Bubble/i : model === "crystal_blue" ? /Shard|Core/i : /./);
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
  constructor() { this.reset(RECIPES[0]); }
  reset(r = this.recipe) { this.recipe = r; this.zone = new THREE.Vector2(...r.zone); this.pos = new THREE.Vector2(); this.heading = 90; this.best = 9; this.any = false; this.trail = []; this.wobble = 0; }
  get quality() { return this.best < 0.09 ? 3 : this.best < 0.18 ? 2 : 1; }
  get inZone() { return this.pos.distanceTo(this.zone) < 0.13 * 0.7; }
  add(kind) {
    const push = this.recipe.push[kind]; if (!push) return;
    for (let i = 1; i <= 5; i++) { this.pos.x += push[0] / 5; this.pos.y += push[1] / 5; this.trail.push(this.pos.clone()); }
    this.heading = Math.atan2(push[1], push[0]) * 180 / Math.PI; this.any = true; this.track();
  }
  // speed = degrees per second of the paddle: slow and steady steers precisely, fast stirring wobbles the marker.
  stir(turns, dir, speed = 0) {
    if (!this.any || turns <= 0) return false; const wasIn = this.inZone;
    this.wobble = THREE.MathUtils.clamp((speed - 260) / 300, 0, 1);
    this.heading -= dir * 75 * turns + (Math.random() - 0.5) * 140 * this.wobble; const r = this.heading * Math.PI / 180;
    this.pos.add(new THREE.Vector2(Math.cos(r), Math.sin(r)).multiplyScalar(0.34 * turns * (1 + 0.8 * this.wobble))); if (this.pos.length() > 0.95) this.pos.setLength(0.95);
    if (Math.random() < 0.5) this.trail.push(this.pos.clone()); this.track(); return !wasIn && this.inZone;
  }
  track() { this.best = Math.min(this.best, this.pos.distanceTo(this.zone)); }
  get qualityText() { return "الجودة " + this.quality + " / 3" + (this.quality === 3 ? " — ممتازة!" : ""); }
  get tint() { if (!this.any) return new THREE.Color(0xd9e0dc); if (this.inZone) return new THREE.Color(0xffd973); const near = 1 - Math.min(1, this.pos.distanceTo(this.zone) / 0.8); return new THREE.Color(this.recipe.steam[0]).lerp(new THREE.Color(this.recipe.steam[1]), near); }
  get speedText() { return this.wobble > 0.5 ? "التحريك سريع: العلامة بتفلت" : "التحريك هادئ: تحكّم دقيق"; }
  draw(c, size) {
    const s = size / 2, P2 = v => [s + v.x * s, s - v.y * s];
    c.clearRect(0, 0, size, size); c.fillStyle = "#eedbb0"; c.beginPath(); c.arc(s, s, s - 2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(120,80,30,.25)"; for (let r = 1; r <= 3; r++) { c.beginPath(); c.arc(s, s, r * s / 3.4, 0, Math.PI * 2); c.stroke(); }
    const [zx, zy] = P2(this.zone); c.fillStyle = "rgba(40,170,110,.75)"; c.beginPath(); c.arc(zx, zy, 0.13 * s, 0, Math.PI * 2); c.fill();
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
    this.dialogue = new Dialogue(this); await this.dialogue.load(); this.bank = new Bank(this);
    this.firas = await Firas.create(this.scene);
    this.trader = await NPC.create(this.scene, "assets/kaykit/Characters/Barbarian.glb", 1.78, "Trader", "التاجر المتجول", L.customerSpot);
    this.customer = await NPC.create(this.scene, "assets/kaykit/Characters/Rogue_Hooded.glb", 1.72, "Customer", "الزبون", L.customerSpot);
    this.merchant = await NPC.create(this.scene, "assets/kaykit/Characters/Knight.glb", 1.8, "Merchant", "التاجر", L.customerSpot);
    this.seller = await NPC.create(this.scene, "assets/kaykit/Characters/Rogue.glb", 1.7, "Seller", "تاجرة البلّور", L.customerSpot);
    this.npcs = [this.trader, this.customer, this.merchant, this.seller].filter(Boolean); this.vendors = [this.trader, this.seller];
    for (const name of ["herb_red", "crystal_blue", "water_flask", "potion_bottle", "pestle", "stir_paddle"]) await load(`assets/custom/${name}.glb`);
    this.labels(); await this.setupMarket(); this.setupWorldMap(); await this.setupBank(); await this.makeCards();
    this.ui.onBook = () => this.glossary(0); this.ui.onClick = () => this.audio.play("paper", 1.1, 0.8);
    this.setupDesktop(); this.setupTouch(); this.setupVR();
    this.ui.card(...CARDS[0], this.fast ? 0 : 1600);
    if (!this.fast) this.cine = { t: -1.6, dur: 7 };
    this.refresh();
  }
  get recipe() { return RECIPES[this.chapter >= 2 ? 1 : 0]; }
  region() { const p = this.inVR ? this.camera.getWorldPosition(new THREE.Vector3()) : this.rig.position; return L.inMarket(p) ? "market" : "village"; }
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
      label("إرث الكيميائي\nأعشاب طبية", U(0, 2.93, -0.545), 1.1, 0.5, 180, 90);
      this.recipeBoard = label(RECIPES[0].board, U(-4.03, 1.36, 6.2), 1.05, 0.7, 90, 70);
      this.orderBoard = sign(this.scene, ORDER_TEXT, U(0, 3.55, -123.2), 2.4, 0.95, 0, 64);
      L.stalls.forEach((s, i) => sign(this.scene, STALL_INFO[i].sign, L.stallPos(s, 0, 2.24, 0), 1.5, 0.6, s.side * 90, 70));
      sign(this.scene, "✦ إلى السوق ✦", L.portalShop.clone().setY(3.55), 1.3, 0.34, 0, 80, "#2a1c3a", "#ffe7b0");
      sign(this.scene, "✦ إلى المحل ✦", L.portalMarket.clone().setY(3.55), 1.3, 0.34, 180, 80, "#2a1c3a", "#ffe7b0");
      sign(this.scene, "سوق القرية", U(0, 4.4, -123.25), 1.6, 0.4, 0, 90, "#7a2a1c", "#ffe7b0");
      this.marketLabel = label("لوحة السوق\nخلطات الجيران: نحو 40 عملة", U(4.03, 1.36, 1.15), 0.76, 0.5, -90, 64); this.marketLabel.visible = false;
    });
  }

  // ---------------------------------------------------------------- village market (scene 1)
  async setupMarket() {
    const root = this.marketRoot = new THREE.Group(); root.name = "Market square"; this.scene.add(root);
    const KK = "assets/kaykit/", jobs = [];
    box(root, U(0, -0.08, -117), new THREE.Vector3(70, 0.1, 50), 0x2b3819, { shadow: false }); // its own meadow, far past the mountain
    for (const x of [-1.3, 1.3]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 4.2, 8), MAT(0x5a3418)); post.position.copy(U(x, 2.1, -123.3)); root.add(post); }
    // Ground, bounds, buildings and props around the square.
    for (let ix = -2; ix <= 2; ix++) for (let iz = 0; iz < 5; iz++) jobs.push(place(root, `${KK}Dungeon/floor_tile_large.glb`, U(ix * 3, -0.005, -111 - iz * 3), { width: 3.02, alignTop: true }));
    for (const [x, z, sx, sz] of [[0, -109.6, 16, 0.4], [0, -124.4, 16, 0.4], [-7.6, -117, 0.4, 15], [7.6, -117, 0.4, 15]]) blocker(U(x, 1.5, z), new THREE.Vector3(sx, 3, sz));
    jobs.push(place(root, `${KK}Town/building_market_blue.gltf`, U(-9.5, 0, -117), { yaw: -90, height: 3.2 }), place(root, `${KK}Town/building_market_green.gltf`, U(9.5, 0, -117), { yaw: 90, height: 3.2 }));
    jobs.push(place(root, `${KK}Town/building_tavern_red.gltf`, U(-6, 0, -128), { height: 6 }), place(root, `${KK}Town/building_home_B_yellow.gltf`, U(6, 0, -128), { height: 5 }));
    jobs.push(place(root, `${KK}Town/building_well_blue.gltf`, U(0, 0, -121.2), { height: 2.2, collider: true }), place(root, `${KK}Town/tent.gltf`, U(-6.2, 0, -112.8), { yaw: 40, height: 2.2, collider: true }));
    for (const [m, x, z, h] of [["sack", -5.2, -120.8, 0.55], ["sack", 5.3, -116.9, 0.5], ["crate_open", -5.3, -116.8, 0.6], ["wheelbarrow", 5.6, -121.4, 0.8]]) jobs.push(place(root, `${KK}Town/${m}.gltf`, U(x, 0, z), { yaw: x * 20, height: h, collider: true }));
    for (const [x, z] of [[-5.6, -123.4], [5.6, -123.4], [-6.4, -110.6], [6.4, -110.6]]) jobs.push(place(root, `${KK}Halloween/lantern_standing.gltf`, U(x, 0, z), { height: 0.9 }));
    for (const [x, z] of [[-4.5, -117], [4.5, -117]]) { const l = new THREE.PointLight(0xffa64d, 7, 9, 1.6); l.position.copy(U(x, 2.4, z)); root.add(l); refs.lights.push(l); }
    // Two stalls with sellers, each with its own basket.
    const wood = MAT(0x5a3418), cloth = [[MAT(0xb8322a), MAT(0xf0dcb0)], [MAT(0x2a5fb8), MAT(0xf0dcb0)]];
    this.baskets = []; this.basketRings = [];
    for (const [si, s] of L.stalls.entries()) {
      jobs.push(place(root, `${KK}Dungeon/table_long.glb`, L.stallPos(s, 0, 0, 0), { height: L.tableTop, collider: true }));
      for (const dz of [-1.75, 1.75]) for (const dx of [-1.0, 1.0]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 8), wood); post.position.copy(L.stallPos(s, dx, 1.3, dz)); root.add(post); }
      for (let i = 0; i < 6; i++) { const strip = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.03, 0.62), cloth[si][i % 2]); strip.position.copy(L.stallPos(s, 0, 2.62, -1.55 + i * 0.62)); strip.rotation.z = 0.16 * s.side; root.add(strip); }
      const bpos = L.stallPos(s, 0.5, 0.9, 1.2), basket = new THREE.Group(); basket.position.copy(bpos); root.add(basket); this.baskets.push(bpos);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.13, 18, 1, true), MAT(0x9a6a2e, { side: THREE.DoubleSide })); body.position.y = 0.065; basket.add(body);
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), MAT(0x7a4f20)); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.005; basket.add(bottom);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 20, Math.PI), MAT(0x7a4f20)); handle.position.y = 0.13; basket.add(handle);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 32), new THREE.MeshBasicMaterial({ color: 0x6dffb0, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.copy(bpos).setY(bpos.y + 0.01); this.scene.add(ring); this.basketRings.push(ring);
      this.vendors[si].standAt(L.stallPos(s, -1.45, 0, 0), -s.side * Math.PI / 2);
    }
    // Scene-1 goods: four per stall, with price tags on the stall front.
    const slot = [0, 0];
    for (const d of MARKET) {
      const s = L.stalls[d.stall], k = slot[d.stall]++, dz = -1.1 + k * 0.45;
      const it = new Item(this, d.key, d.name + " • " + d.price, k); it.market = d; await it.build(L.stallPos(s, 0.54, 0.9, dz));
      document.fonts.ready.then(() => { d.tagMesh = sign(this.scene, `${d.name} • ${d.price}\n${d.tag}`, L.stallPos(s, 0.93, 0.8, dz), 0.3, 0.15, s.side * 90, 110, "#f3e3bb"); });
    }
    // Portals: a stone arch with a swirling gate, one by the shop lane and one in the square.
    this.portalMat = new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { t: { value: 0 } },
      vertexShader: "varying vec2 v; void main(){ v = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform float t; varying vec2 v; void main(){ vec2 p = v*2.0-1.0; float r = length(p); if (r > 1.0) discard; float a = atan(p.y, p.x);" +
        "float s = sin(a*5.0 + r*12.0 - t*3.0)*0.5+0.5; float s2 = sin(a*3.0 - r*8.0 + t*2.0)*0.5+0.5; vec3 c = mix(vec3(0.15,0.85,0.8), vec3(0.45,0.3,1.0), s*s2);" +
        "c = mix(c, vec3(1.0,0.95,0.8), smoothstep(0.55,0.0,r)*0.55); gl_FragColor = vec4(c, (1.0 - smoothstep(0.86,1.0,r)) * 0.92); }" });
    this.portals = [];
    for (const [at, yaw] of [[L.portalShop, 0], [L.portalMarket, 180]]) {
      const arch = await place(this.scene, `${KK}Halloween/arch.gltf`, at, { yaw: -yaw, height: 3.4 });
      const bb = box3(arch), w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.portalMat); disc.scale.set(Math.min(1.05, w * 0.3), 1.35, 1);
      disc.position.copy(at).setY(1.4); disc.rotation.y = yaw === 180 ? Math.PI : 0; this.scene.add(disc);
      const glow = new THREE.PointLight(0x7a6bff, 4, 5, 1.6); glow.position.copy(at).setY(1.5); this.scene.add(glow); refs.lights.push(glow);
      this.portals.push({ at, disc, arch });
    }
    await Promise.all(jobs); this.buildMarketScenery();
    // Brazier for heating the sun ember (scene 3).
    const bz = new THREE.Group(), bpos = U(-1.6, 0, 5.4); bz.position.copy(bpos); (refs.root || this.scene).add(bz);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.8, 6), MAT(0x2a2422, { metalness: 0.6 })); leg.position.set(Math.cos(a) * 0.14, 0.4, Math.sin(a) * 0.14); leg.rotation.z = Math.cos(a) * 0.15; leg.rotation.x = -Math.sin(a) * 0.15; bz.add(leg); }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.12, 18), MAT(0x3a302a, { metalness: 0.7, roughness: 0.4 })); bowl.position.y = 0.82; bz.add(bowl);
    const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 18), new THREE.MeshBasicMaterial({ color: 0xff5a1a })); coals.position.y = 0.88; bz.add(coals);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb02a : 0xff6a10 })); f.scale.set(0.07, 0.16, 0.07); f.position.set(Math.cos(i * 1.6) * 0.07, 0.95, Math.sin(i * 1.6) * 0.07); bz.add(f); refs.flames.push({ m: f, base: f.scale.clone(), seed: 10 + i }); }
    colliders.push(new THREE.Box3().setFromCenterAndSize(bpos.clone().setY(0.45), new THREE.Vector3(0.4, 0.9, 0.4)));
    this.brazier = bpos.clone().setY(0.92);
    // Little wooden holder for the dropper at the bottling table.
    const hold = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), MAT(0x5a3418)); hold.position.copy(L.pipetteSpot).setY(0.925); this.scene.add(hold);
  }
  // ---------------------------------------------------------------- bank props: card terminals and the bank-app tablet
  async setupBank() {
    this.pos = L.stalls.map(s => new POS(this.scene, L.stallPos(s, 0.62, 0.9, 0.62), -s.side * Math.PI / 2));
    this.pos.push(new POS(this.scene, U(2.12, 1.04, 1.85), 0)); this.counterPOS = this.pos[2]; await Promise.all(this.pos.map(p => p.ready));
    this.tabCv = document.createElement("canvas"); this.tabCv.width = 512; this.tabCv.height = 360; this.tabTex = new THREE.CanvasTexture(this.tabCv); this.tabTex.colorSpace = THREE.SRGBColorSpace;
    // Big bank-app screen on a stand at the counter (readable from where you sell).
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.62, 0.03), MAT(0x1a1d20, { roughness: 0.3 })); frame.position.copy(U(3.45, 1.52, 1.75)); frame.rotation.x = -0.12; this.scene.add(frame);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.58), new THREE.MeshBasicMaterial({ map: this.tabTex })); scr.position.z = 0.017; frame.add(scr);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.42, 10), MAT(0x2a2d30, { metalness: 0.6 })); stand.position.copy(U(3.45, 1.25, 1.72)); this.scene.add(stand);
    this.drawTablet(); this.pos.forEach(p => p.idle(this.bank.balance));
  }
  drawTablet() {
    const c = this.tabCv.getContext("2d"), b = this.bank; c.fillStyle = "#f4f7f9"; c.fillRect(0, 0, 512, 360);
    c.fillStyle = "#14507a"; c.fillRect(0, 0, 512, 64); c.direction = "rtl"; c.textBaseline = "middle"; c.textAlign = "right"; c.fillStyle = "#fff"; c.font = "bold 30px Amiri"; c.fillText("🏦 تطبيق البنك • حساب المحل", 490, 33);
    c.fillStyle = "#14507a"; c.font = "bold 46px Amiri"; c.textAlign = "center"; c.fillText(`${b.balance} عملة`, 256, 108); c.fillStyle = "#6a7a86"; c.font = "22px Amiri"; c.fillText(b.credit ? `الرصيد • دين البطاقة الائتمانية ${b.credit}` : "الرصيد المتاح", 256, 146);
    b.tx.slice(-4).reverse().forEach((x, i) => { const y = 192 + i * 42; c.fillStyle = i % 2 ? "#eef2f5" : "#ffffff"; c.fillRect(16, y - 19, 480, 38);
      c.textAlign = "right"; c.fillStyle = "#24323c"; c.font = "22px Amiri"; c.fillText(`${x.label} • ${x.method}`, 486, y); c.textAlign = "left"; c.fillStyle = x.amount > 0 ? "#1f8a4c" : "#b3412e"; c.font = "bold 24px Amiri"; c.fillText((x.amount > 0 ? "+" : "−") + Math.abs(x.amount), 26, y); });
    this.tabTex.needsUpdate = true;
  }
  onBankTx(x) {
    this.audio.play("chime", 1.5, 0.5); setTimeout(() => this.audio.play("chime", 1.9, 0.4), 120);
    this.ui.toast(`🏦 ${x.amount > 0 ? "+" : "−"}${Math.abs(x.amount)} • ${x.label} • ${x.method}`); this.ui.toastUntil = performance.now() + 3500;
    this.drawTablet();
  }
  // Tap to pay: bring your card (VR hand / desktop E on the terminal) to a terminal that is asking for money.
  setPay(posIndex, amount, label, onPaid) { const pos = this.pos?.[posIndex]; if (!pos) { onPaid(); return; } const old = this.pays?.[posIndex];
    (this.pays = this.pays || {})[posIndex] = { i: posIndex, pos, amount, label, onPaid, method: old?.method || null };
    pos.screen3([["المبلغ", 24, "#9fb4c2"], [`${amount} عملة`, 54, "#ffd76a"], [old?.method ? "قرّب البطاقة" : "اختار: خصم أو ائتمان", 24, "#cfe8ff"], [`رصيدك: ${this.bank.balance}`, 22, "#9fb4c2"]]);
    if (!this.payExplained) { this.payExplained = true; this.dialogue.say("S1_PAY"); } }
  get pending() { return Object.values(this.pays || {}).filter(Boolean); }
  get pay() { return this.pending[0] || null; }
  payNear(ray, r = 0.13, far = 4) { return this.pending.find(p => ray.distanceToPoint(p.pos.at) < r && ray.origin.distanceTo(p.pos.at) < far) || null; }
  // Tapping a terminal: first choose the card (debit = your money now, credit = the bank's money, repaid tonight), then tap it.
  tapPay(pos, method) {
    const p = this.pending.find(x => !pos || x.pos === pos); if (!p) return false;
    if (method) p.method = method;
    if (!p.method) { this.askPayMethod(p); return false; }
    this.pays[p.i] = null; const before = this.bank.balance, debtBefore = this.bank.credit;
    this.payMethodNow = p.method === "credit" ? "بطاقة ائتمان" : "بطاقة خصم"; p.onPaid(); this.payMethodNow = null;
    const after = this.bank.balance, debt = this.bank.credit, isCredit = p.method === "credit";
    this.audio.play("glass", 2.2, 0.6);
    p.pos.screen3([["تمّت العملية ✓", 30, "#6dffa8"], [`−${p.amount} عملة`, 50, "#ff9a7a"], [isCredit ? `على بطاقة الائتمان • الدين ${debt}` : `بطاقة الخصم • انخصم من رصيدك`, 22, "#cfe8ff"],
      [isCredit ? `رصيدك ما تغيّر: ${after}` : `قبل ${before}  ←  بعد ${after}`, 24, "#ffffff"]]);
    setTimeout(() => this.pos && p.pos.idle(this.bank.balance), 5000);
    setTimeout(() => this.hideCard(), 900); return true;
  }
  askPayMethod(p) {
    this.asking = "pos"; this.audio.play("paper", 1, 0.5);
    this.ui.talk("جهاز الدفع", `المبلغ ${p.amount} عملة • ${p.label}\nرصيدك ${this.bank.balance}${this.bank.credit ? ` • دين البطاقة ${this.bank.credit}` : ""}`,
      C("💳 بطاقة الخصم", () => this.pickCard(p, "debit")), C("💳 بطاقة الائتمان", () => this.pickCard(p, "credit")), C("مش هلّأ", () => { this.asking = null; this.refresh(); }));
  }
  pickCard(p, m) {
    p.method = m; this.asking = null; this.ui.close(); this.refresh();
    p.pos.screen3([["المبلغ", 24, "#9fb4c2"], [`${p.amount} عملة`, 54, "#ffd76a"], ["قرّب البطاقة ))) ", 26, "#6fd6ff"], [m === "credit" ? "بطاقة ائتمان" : "بطاقة خصم", 22, "#cfe8ff"]]);
    if (this.inVR) this.showCard(m); else this.cardFly(m, p.pos).then(() => this.tapPay(p.pos));
  }
  // The bank cards (Blender models): only out while you pay; Y on the left controller puts it away.
  async makeCards() {
    const gltf = await load("assets/custom/bank_card.glb"); this.cards = {};
    for (const [k, title, sub, a, b] of [["debit", "بطاقة خصم", "DEBIT", "#1d4f9c", "#2f86d6"], ["credit", "بطاقة ائتمان", "CREDIT", "#1a1a1e", "#5a4a26"]]) {
      const cv = document.createElement("canvas"); cv.width = 512; cv.height = 324; const c = cv.getContext("2d"), gr = c.createLinearGradient(0, 0, 512, 324);
      gr.addColorStop(0, a); gr.addColorStop(1, b); c.fillStyle = gr; c.fillRect(0, 0, 512, 324);
      c.fillStyle = "rgba(255,255,255,.08)"; c.beginPath(); c.arc(430, 40, 160, 0, Math.PI * 2); c.fill();
      c.direction = "rtl"; c.textAlign = "right"; c.fillStyle = "#ffffff"; c.font = "bold 34px Amiri"; c.fillText("بنك القرية", 486, 52);
      c.font = "bold 30px Amiri"; c.fillText(title, 486, 96); c.textAlign = "left"; c.direction = "ltr"; c.font = "bold 22px monospace"; c.fillText(sub, 26, 52);
      c.font = "bold 34px monospace"; c.fillStyle = "#f3f3f3"; c.fillText(k === "debit" ? "4532  0186  7741  2026" : "5274  9903  1180  2026", 40, 240);
      c.font = "20px monospace"; c.fillText("VALID 11/30", 40, 282); c.direction = "rtl"; c.textAlign = "right"; c.font = "24px Amiri"; c.fillText("صاحب المحل", 486, 282);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;
      const card = gltf.scene.clone(true); card.traverse(o => { if (o.isMesh && o.name === "Face") o.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.15 }); });
      card.scale.setScalar(1.15); this.cards[k] = card;
    }
  }
  showCard(m) {
    this.hideCard(); const card = this.cards?.[m]; if (!card) return; const h = this.hands.find(h => h.hand === "left" && h.source) || this.hands.find(h => h.source); if (!h) return;
    card.position.set(0, 0.015, -0.07); card.rotation.set(-0.5, 0, Math.PI / 2); h.grip.add(card); this.cardHand = h; this.audio.play("paper", 1.4, 0.5);
  }
  hideCard() { if (this.cardHand) { for (const c of Object.values(this.cards || {})) this.cardHand.grip.remove(c); this.cardHand = null; } }
  cardFly(m, pos) {
    const card = this.cards?.[m]; if (!card) return Promise.resolve(); const from = this.camera.getWorldPosition(new THREE.Vector3()).add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.35)).add(new THREE.Vector3(0, -0.12, 0));
    const to = pos.at.clone().add(new THREE.Vector3(0, 0.02, 0)); this.scene.add(card); card.rotation.set(-1.1, 0, 0);
    return new Promise(res => this.fx.add(new THREE.Object3D(), 0.55, k => { card.position.lerpVectors(from, to, k * k * (3 - 2 * k)); if (k >= 1) setTimeout(() => { this.scene.remove(card); res(); }, 250); }));
  }
  // Light scenery around the market square (instanced, unlit-cheap, no shadows) so it doesn't feel empty.
  buildMarketScenery() {
    const C0 = new THREE.Vector3(0, 0, -117), dummy = new THREE.Object3D(), N = 44;
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshLambertMaterial({ color: 0x3d6b34 }), N);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 6), new THREE.MeshLambertMaterial({ color: 0x5a3a22 }), N);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rnd() * 0.12, r = 12 + rnd() * 7, x = C0.x + Math.cos(a) * r, z = C0.z + Math.sin(a) * r * 0.85;
      if (z > -105) { i--; seed++; continue; } const h = 3 + rnd() * 2.5;
      dummy.position.set(x, h * 0.25, z); dummy.scale.set(1, h * 0.5, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, h * 0.5 + h * 0.35, z); dummy.scale.set(h * 0.32, h * 0.75, h * 0.32); dummy.rotation.y = rnd() * 3; dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
    }
    const hills = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x4d6a3a, flatShading: true }), 7);
    for (let i = 0; i < 7; i++) { const a = -0.4 - i * 0.55, r = 30 + (i % 3) * 5; dummy.position.set(Math.cos(a) * r, -2, C0.z + Math.sin(a) * r); dummy.scale.set(10 + i, 6 + (i % 3) * 2, 9); dummy.rotation.set(0, i, 0); dummy.updateMatrix(); hills.setMatrixAt(i, dummy.matrix); }
    const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0x55803f, flatShading: true }), 18);
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, x = Math.cos(a) * 8.6, z = C0.z + Math.sin(a) * 7.6; dummy.position.set(x, 0.25, z); dummy.scale.setScalar(0.8 + (i % 3) * 0.3); dummy.rotation.set(0, i, 0); dummy.updateMatrix(); bushes.setMatrixAt(i, dummy.matrix); }
    this.marketScenery = new THREE.Group(); this.marketScenery.add(crowns, trunks, hills, bushes); this.scene.add(this.marketScenery);
    this.villageBackdrop = refs.root.children.filter(o => /mountain|hills_B|windmill|cloud_big/.test(o.name || ""));
  }
  // Through the portal: quick fade, whoosh, and you are on the other side.
  travel() {
    if (this.traveling || this.changing) return; this.traveling = true; const toMarket = this.region() === "village";
    this.audio.play("whoosh", 0.7, 0.9); this.audio.play("crystal", 0.8, 0.6); this.dropHeld(false);
    this.ui.fade(true, 260).then(() => {
      this.teleport(toMarket ? L.marketArrive : L.villageArrive, toMarket ? L.marketYaw : L.villageYaw, true);
      if (!this.inVR) { this.focused = false; this.skipGlide = true; }
      this.firas?.resetTo((toMarket ? Stations.portalBack : Stations.portal).firas);
      this.fx.sparkle((toMarket ? L.marketArrive : L.villageArrive).clone().setY(1.2), 14, 0x9a8cff);
      return this.ui.fade(false, 380);
    }).then(() => { this.traveling = false; this.portalCool = performance.now() + 1500; this.refresh(); });
  }
    // Alchemy map floating above the cauldron (VR): shows where the brew is heading and how precise your stirring is.
  setupWorldMap() {
    this.mapCv = document.createElement("canvas"); this.mapCv.width = 512; this.mapCv.height = 640;
    this.mapTex = new THREE.CanvasTexture(this.mapCv); this.mapTex.colorSpace = THREE.SRGBColorSpace;
    this.mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.9), new THREE.MeshBasicMaterial({ map: this.mapTex, transparent: true }));
    this.mapMesh.position.copy(L.liquid).add(U(0, 0.95, 0.75)); this.mapMesh.visible = false; this.scene.add(this.mapMesh);
    this.mapMesh.lookAt(Stations.cauldron.stand.clone().setY(1.6));
  }
  drawWorldMap() {
    const c = this.mapCv.getContext("2d"); c.clearRect(0, 0, 512, 640);
    c.fillStyle = "rgba(20,27,23,.9)"; c.beginPath(); c.roundRect(0, 0, 512, 640, 30); c.fill();
    c.save(); c.translate(16, 70); this.map.draw(c, 480); c.restore();
    c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#ffcf7a"; c.font = "bold 40px Amiri"; c.fillText("خريطة الخلطة", 256, 38);
    c.font = "bold 32px Amiri"; c.fillStyle = "#f1dcae"; c.fillText(this.map.any ? this.map.qualityText : "أضف المكونات", 256, 580);
    c.font = "26px Amiri"; c.fillStyle = this.map.wobble > 0.5 ? "#ff8a70" : "#7dffc0"; c.fillText(this.map.any ? this.map.speedText : "وصّل العلامة للدائرة الخضرا", 256, 618);
    this.mapTex.needsUpdate = true;
  }
  marketDrop(it) {
    const d = it.market;
    if (d.bundle !== undefined) {
      if (this.phase !== P.Supplier) { this.bounceHome(it); return; }
      this.intoBasket(it, 1, 0); it.consumed = true; this.audio.play("pop", 1.1, 0.6);
      this.setPay(1, 60, "صندوق المكونات الممتاز", () => this.buyBatch(Supplier.Premium)); this.dialogue.say("P_METHOD"); return;
    }
    if (d.loose) {
      if (this.phase !== P.Supplier) { this.bounceHome(it); return; }
      if (this.cart.filter(c => c.market.loose === d.loose).length >= 3) { this.dialogue.say("T3_FULL"); this.ui.toast("عندك 3 من هاد النوع"); this.bounceHome(it); return; }
      this.cart.push(it); this.intoBasket(it, 0, this.cart.length - 1); it.obj.position.y += Math.floor((this.cart.length - 1) / 4) * 0.05; this.audio.play("pop", 1.1, 0.6);
      const sum = this.cart.reduce((a, c) => a + c.market.price, 0);
      if (this.cart.length === 9) this.setPay(0, sum, "مكونات 3 عبوات", () => this.buyBatch(Supplier.Cheap));
      this.refresh(); return;
    }
    if (this.phase !== P.Purchase) { this.bounceHome(it); return; }
    if (d.buy === undefined) { this.dialogue.say(d.line); this.audio.play("reject", 1.3, 0.4); this.ui.toast(`${d.name} ${d.tag}، مش من الطلب`); this.bounceHome(it); return; }
    // Into this stall's basket; the stall's terminal asks for the total, you tap your debit card to pay.
    this.cart1 = this.cart1 || [[], []]; const cart = this.cart1[d.stall]; cart.push(it); this.intoBasket(it, d.stall, cart.length - 1); it.consumed = true; this.audio.play("pop", 1.1, 0.6);
    const total = cart.reduce((a, x) => a + x.market.price, 0), names = cart.map(x => x.market.name).join(" + ");
    this.setPay(d.stall, total, names, () => { for (const x of cart.splice(0)) this.purchase(x.market.buy); });
  }
  _unusedChooseMethod(m) { this.payMethod = m; this.ui.close(); this.setPay(1, 60, m === "credit" ? "بطاقة الائتمان • تسدّد آخر اليوم" : "بطاقة الخصم", () => this.buyBatch(Supplier.Premium), m === "credit" ? "ائتمان" : "خصم"); this.refresh(); }
  intoBasket(it, stall, k) { it.consumed = true; it.held = false; it.flying = false; it.obj.scale.setScalar(0.7); it.obj.quaternion.identity(); it.obj.position.copy(this.baskets[stall]).add(new THREE.Vector3((k % 2 - 0.5) * 0.11, 0.03, (Math.floor(k / 2) % 2 - 0.5) * 0.11)); }
  // Ask a character questions: more money words, told in conversation.
  askMenu(speaker) {
    const qs = QUESTIONS[speaker]; if (!qs || this.paused || this.changing) return;
    this.asking = speaker; if (speaker === "فراس") this.dialogue.say("Q_ASK"); this.audio.play("paper", 1, 0.6);
    if (speaker === "جهاز الدفع") return;
    const offer = this.phase === P.Supplier && (speaker === "التاجر المتجول" ? C("عبّيلي الأحسن بالحبّة • 45", () => this.buyBatch(Supplier.Cheap)) : speaker === "تاجرة البلّور" ? C("اشتري العرض الممتاز • 60", () => this.buyBatch(Supplier.Premium)) : null);
    this.ui.talk(speaker, "شو بدك تعرف؟", ...(offer ? [offer] : []), ...qs.map(([q, id]) => C(q, () => { this.dialogue.say(id); this.asking = null; this.refresh(); })), C("رجوع", () => { this.asking = null; this.refresh(); }));
  }
  characters() {
    const out = []; if (this.firas?.shown) out.push({ speaker: "فراس", at: this.firas.head.clone().add(new THREE.Vector3(0, -0.4, 0)) });
    for (const n of this.npcs) if (n.arrived && n.holder.visible) out.push({ speaker: n.speaker, at: n.holder.position.clone().add(new THREE.Vector3(0, 1.15, 0)) });
    return out;
  }
  rayCharacter(ray) { let best = null, bd = 0.42; for (const ch of this.characters()) { const d = ray.distanceToPoint(ch.at); if (d < bd && ch.at.distanceTo(ray.origin) < 7) { bd = d; best = ch; } } return best; }
  toggleDoor() { this.fx.openDoor(this.fx.doorGoal < 0.8); }
  // ---------------------------------------------------------------- stations
  stationName() {
    const n = this.baseStation(); if (!n || n === "welcome") return n;
    const want = Stations[n].market ? "market" : "village", here = this.region();
    return want === here ? n : here === "market" ? "portalBack" : "portal";
  }
  baseStation() {
    switch (this.phase) {
      case P.Purchase: return this.welcomed ? "market" : "welcome";
      case P.Brew: case P.BatchBrew: { const b = this.brew; return !b.herbInMortar ? "ingredients" : !b.crushed ? "mortar" : !b.readyToStir ? "mix" : !b.readyToBottle ? "cauldron" : "bottling"; }
      case P.Wilt: return "ingredients";
      case P.Supplier: return "market";
      case P.Price: case P.Handoff: case P.RevenueQuiz: case P.Offer: case P.BatchHandoff: case P.Expenses: case P.FinalQuiz: return "counter";
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
    return this.bottleIn ? it.kind === "pipette" : it.kind === "bottle";
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
    const ui = this.ui, s = this.state; ui.actions(); ui.close(); this.asking = null;
    if (this.askKey && !this.askKey.startsWith(this.phase + ":")) this.askKey = null;
    if (this.phase !== P.Brew && this.phase !== P.BatchBrew) ui.progress("");
    switch (this.phase) {
      case P.Intro:
        ui.objective(!this.doorOpened ? "افتح باب متجرك" : "ادخل المتجر"); break;
      case P.Purchase: {
        const n = [0, 1, 2, 3].filter(i => s.has("ingredient-" + i)).length;
        ui.objective(!this.welcomed ? "اسمع فراس" : this.region() === "market" ? "السوق: حطّ مكونات الطلب بالسلّة" : "اطلع وادخل البوابة عالسوق"); if (this.welcomed) ui.progress(`بالسلّة: ${n} / 4`);
        ui.actions(C("شو الطلب؟", () => { ui.toast(ORDER_TEXT.replace(/\n/g, " • ")); ui.toastUntil = performance.now() + 6000; })); break; }
      case P.Brew: case P.BatchBrew: this.brewObjective(); break;
      case P.Ready: ui.objective("حدا بدقّ الباب: افتحله"); break;
      case P.Price: ui.objective("اختر سعرك");
        this.ask("P_PRICE", C("30 عملة", () => this.choosePrice(30)), C("50 عملة", () => this.choosePrice(50))); break;
      case P.Handoff: ui.objective("ضع الخلطة على الصينية"); break;
      case P.RevenueQuiz: ui.objective(`إيراد ولا ربح؟ البيع ${s.revenue} • التكلفة ${s.cogs}`);
        this.ask("P_REVQ", C("إيراد", () => this.revenueAnswer(true)), C("ربح", () => this.revenueAnswer(false))); break;
      case P.Offer: ui.objective("طلبية كبيرة");
        if (!this.merchant.arrived) { if (!this.merchant.walking && !this.merchantComing) { this.merchantComing = true; this.merchant.spot = L.traderSpot;
          (this.customerGone || Promise.resolve()).then(() => this.merchant.arrive(this)).then(() => { this.merchantComing = false; this.refresh(); }); } break; }
        this.ask(s.firstPrice === 30 ? "S2_MA" : "S2_MB", C("اتفقنا", () => this.nextChapter())); break;
      case P.Supplier: { const n = k => (this.cart || []).filter(c => c.market.loose === k).length, sum = (this.cart || []).reduce((a, c) => a + c.market.price, 0);
        ui.objective(this.region() === "market" ? "اشتري: 3 من كل نوع بالحبّة، أو الصندوق الممتاز" : "امشِ عبر البوابة للسوق");
        if (this.cart?.length) ui.progress(`ميرمية ${n("herb")}/3 • لبان ${n("crystal")}/3 • زيت ${n("water")}/3 • ${sum} عملة`); break; }
      case P.Wilt: ui.objective("عشبة ذابلة!");
        this.ask("P_WILT", C("استبدلها • +5", () => this.decideHerb(Herb.Replace)), C("استخدمها", () => this.decideHerb(Herb.UseWilted))); break;
      case P.BatchHandoff: ui.objective("سلّم العبوات للتاجر"); break;
      case P.Expenses: ui.objective("ادفع فواتير اليوم من تطبيق البنك");
        this.ask("S3_OPEX", C(this.bank.credit ? `ادفع 10 + سدّد البطاقة ${this.bank.credit}` : "ادفع 10 من التطبيق", () => this.payExpenses())); break;
      case P.FinalQuiz: { ui.objective("السؤال الأخير"); const a = C(s.netProfit + " عملة", () => this.finalAnswer(true)), b = C(s.grossProfit + " عملة", () => this.finalAnswer(false));
        this.ask("P_FINAL", ...(this.correctLeft ? [a, b] : [b, a])); break; }
      case P.Report: ui.objective("تقرير المتجر");
        ui.modal("تقرير المحل", this.report(), C("كشف الحساب", () => this.statement()), C("الموسوعة المالية", () => this.glossary(0)), C("إعادة التجربة", () => location.reload())); break;
    }
    const st = this.stationName(); if (st === "portal" || st === "portalBack") ui.objective(this.phase === P.Purchase || this.phase === P.Supplier ? "امشِ عبر البوابة للسوق" : "امشِ عبر البوابة للمحل");
  }
  // A decision: the character says the line (voice = the same words you read), then the choices appear.
  ask(id, ...choices) {
    const l = this.dialogue.lines[id], key = this.phase + ":" + id; if (!l) return;
    if (this.askKey !== key) { this.askKey = key; this.dialogue.say(id); }
    const s = this.state, facts = this.phase === P.RevenueQuiz ? `\nبعت الخلطة بـ${s.revenue} • كلّفتك ${s.cogs}`
      : this.phase === P.FinalQuiz ? `\nتذكّر أرقام يومك:\nالإيرادات ${s.revenue} • تكلفة البضاعة المباعة ${s.cogs} • إجمالي الربح ${s.grossProfit}\nخسائر التلف ${s.spoilage} • المصروفات التشغيلية ${s.opex}` : "";
    this.ui.talk(l.speaker, l.text + facts, ...choices);
  }
  statement() {
    this.paused = true; const rows = this.bank.tx.map(x => `${x.amount > 0 ? "+" : "−"}${Math.abs(x.amount)}   ${x.label} • ${x.method}   ← ${x.balance}`);
    this.ui.modal("كشف الحساب البنكي", `الرصيد الافتتاحي: 100\n${rows.slice(-9).join("\n")}\nالرصيد الختامي: ${this.bank.balance}`, C("عودة للتقرير", () => { this.paused = false; this.refresh(); }));
  }
  report() {
    const s = this.state;
    return `رصيد الحساب البنكي: ${this.bank.balance} (بدأ 100)    عمليات إلكترونية: ${this.bank.tx.length}\nرأس المال الأولي: 100    إيرادات المبيعات: ${s.revenue}\nتكلفة البضاعة المباعة: ${s.cogs}    إجمالي الربح: ${s.grossProfit}\nخسائر التلف: ${s.spoilage}    المصروفات التشغيلية: ${s.opex}\nصافي الربح: ${s.netProfit}    الرصيد النقدي النهائي: ${s.cash}\nسمعة المتجر: ${s.reputation} • تقييم غير مالي: ${s.reputationStars} / 4\nمحاكاة مبسطة: لا تشمل الضرائب أو تكاليف التمويل.`;
  }
  unlock(i) { if (this.state.terms.includes(i)) return; this.state.terms.push(i); (this.pendingTerms = this.pendingTerms || []).push(i); this.termWait = 0; }
  showTerm(i) { this.pendingTerms = this.pendingTerms.filter(k => k !== i); this.ui.card3("مصطلح جديد: " + TERMS[i][0], TERM_CARDS[i], "good"); this.audio.play("crystal", 1.3, 0.5); }
  onLine(text) { for (const i of [...(this.pendingTerms || [])]) if (text.includes(TERM_WORDS[i])) this.showTerm(i); }
  glossary(page) {
    this.paused = true; const s = this.state, open = s.terms.includes(page), N = TERMS.length;
    this.ui.modal(`الموسوعة المالية   ${s.terms.length} / ${N}`, open ? `${TERMS[page][0]}\n\n${TERMS[page][1]}` : "مصطلح مغلق\nستكتشفه أثناء التجربة",
      C("السابق", () => this.glossary((page + N - 1) % N)), C("التالي", () => this.glossary((page + 1) % N)), C("عودة", () => { this.paused = false; this.refresh(); }));
  }
  openShopDoor() { if (this.fx.doorGoal > 0.8) return; this.fx.openDoor(true); }
  enterShop() {
    if (this.phase !== P.Intro) return;
    if (!this.doorOpened) { this.doorOpened = true; this.fx.openDoor(true); }
    const p = new THREE.Vector3(); this.camera.getWorldPosition(p);
    if (!L.isInside(p)) this.teleport(L.insideStart, L.insideYaw);
    this.phase = P.Purchase; this.unlock(0); this.unlock(1); this.unlock(2); this.firas.show(this); this.welcomed = false; this.dialogue.say("S1_F01", "S1_F03", "S1_BANK", "S1_ORDER"); this.refresh();
  }
  purchase(i) {
    if (this.phase !== P.Purchase || !this.fin.purchaseFirst(i)) return;
    const mi = this.items.find(x => x.market && x.market.buy === i), stall = mi ? mi.market.stall : 0;
    this.bank.record(MARKET.find(x => x.buy === i).name, this.payMethodNow || "بطاقة خصم"); this.unlock(3);
    this.vendors[stall].receive(); this.fx.sparkle(this.baskets[stall].clone().setY(1.05), 6);
    if (mi && !mi.consumed) this.intoBasket(mi, stall, i);
    if (!this.state.terms.includes(4)) { this.unlock(4); this.dialogue.say("S1_F04"); }
    if ([0, 1, 2, 3].every(k => this.state.has("ingredient-" + k))) { this.phase = P.Brew; this.beginBrew(false); this.dialogue.say("T1_BYE", "S1_BACK", "S1_F05"); }
    else this.dialogue.say(STALL_INFO[stall].deal);
    this.refresh();
  }
  async beginBrew(batch) {
    this.batch = batch; this.brew = new RecipeProgress(); this.map.reset(this.recipe); this.usedEmberStage = null; this.grindLocked = false; this.grindLevelUsed = null; this.crushedItem = null; this.lastGrind = 0; this.filled = 0; this.bottleIn = null; this.fill = 0; this.pipe = 0; this.fastWarned = false;
    for (const it of this.items) if (!it.consumed && it.kind !== "potion" && !it.market) { this.scene.remove(it.obj); it.consumed = true; }
    const lb = this.recipe.labels;
    await new Item(this, "herb", lb.herb, 0).build(L.herbSpot); await new Item(this, "crystal", lb.crystal, 0).build(L.crystalSpot);
    await new Item(this, "water", lb.water, 0).build(L.waterSpot); await new Item(this, "pestle", "المدقة", 0).build(L.pestleSpot);
    await new Item(this, "spoon", "مجداف التحريك", 0).build(L.paddleSpot);
    for (let i = 0; i < (batch ? 3 : 1); i++) await new Item(this, "bottle", "عبوة فارغة", i).build(L.emptyBottle(i));
    await new Item(this, "pipette", "القطّارة", 0).build(L.pipetteSpot);
    if (this.recipe.heat) this.dialogue.say("S3_HEAT");
    this.refresh();
  }
  brewObjective() {
    const b = this.brew;
    const r = this.recipe, cold = r.heat && !b.crystal && !this.items.find(i => i.kind === "crystal" && !i.consumed && i.hot);
    if (this.heatText && !b.crystal) this.ui.toast(this.heatText);
    this.ui.objective(!b.herbInMortar ? "ضع العشبة في الهاون" : !b.crushed ? `اسحق العشبة • الطلب: ${GRIND[r.grind]}` : !b.herb && this.grindLevel < r.grind ? `كمّل سحق: الطلب ${GRIND[r.grind]}` : !b.readyToStir ? (cold ? "حمّي الجمرة عالموقد، وبعدين حطّ المكونات بالقدر" : "أضف المسحوق والبلورة والماء إلى القدر") : !b.readyToBottle ? "حرّك بهدوء ووجّه العلامة للدائرة الخضرا" : !this.bottleIn ? "ضع عبوة فارغة في حلقة التعبئة" : this.pipe > 0.02 ? "اعصر القطّارة فوق العبوة" : "اغمس القطّارة بالقدر واعصرها");
    this.ui.progress(b.herbInMortar && !b.herb ? `الطحن: ${b.crushed ? GRIND[this.grindLevel] : "لسّا"} • الطلب: ${GRIND[r.grind]}` : b.readyToStir && !b.readyToBottle ? `المزج: ${Math.round(b.stirring * 100)}%` : b.readyToBottle ? `القطّارة ${Math.round(this.pipe * 100)}% • العبوة ${Math.round(this.fill * 100)}% • ${this.filled} / ${this.batch ? 3 : 1}` : "");
    if (b.herbInMortar && !this.grindLocked && !b.readyToStir) this.ui.actions(C("مساعدة: ضربة سحق", () => this.crushStroke()));
    else if (b.readyToStir && !b.readyToBottle) this.ui.actions(C("مساعدة: دورة تحريك", () => this.stir(0.25, 0)));
    else if (this.bottleIn) this.ui.actions(C("مساعدة التعبئة", () => this.pour(0.55)));
    else this.ui.actions();
  }
  bottleFinished() {
    if (this.phase === P.Brew && this.fin.craftFirst()) { this.unlock(5); this.phase = P.Ready; this.readyShut = false; this.dialogue.say("S1_F06", "S1_F07"); setTimeout(() => { if (this.phase !== P.Ready) return; this.audio.play("knock"); if (this.fx.doorGoal > 0.8) this.fx.openDoor(false); }, 2500); }
    else if (this.phase === P.BatchBrew && this.filled === 3) { this.phase = P.BatchHandoff; this.dialogue.say("S3_GIVE"); this.merchant.spot = L.customerSpot; this.merchant.arrive(this); }
    this.refresh();
  }
  choosePrice(p) { if (this.phase !== P.Price || !this.fin.choosePrice(p)) return; this.phase = P.Handoff; this.dialogue.say(p === 30 ? "S2_CA" : "S2_CB", "S2_GIVE"); this.customer.react(p === 30); this.refresh(); }
  deliver(index) {
    const s = this.state;
    if (this.phase === P.Handoff && this.fin.sellFirst()) {
      this.customer.receive(); this.phase = P.RevenueQuiz; this.quizTries = 0;
      const credit = this.custCredit = Math.random() < 0.5, before = this.bank.balance;
      this.bank.record("بيع شاي الأعشاب", credit ? "فيزا • بطاقة ائتمان الزبون" : "بطاقة خصم الزبون"); if (credit) this.unlock(7);
      this.counterPOS?.screen3([["دفع الزبون ✓", 30, "#6dffa8"], [`+${s.firstPrice} عملة`, 50, "#6dffa8"], [credit ? "فيزا • بطاقة ائتمان" : "بطاقة خصم", 22, "#cfe8ff"], [`رصيدك: ${before} ← ${this.bank.balance}`, 24, "#ffffff"]]);
      setTimeout(() => this.counterPOS?.idle(this.bank.balance), 6000); this.audio.play("glass", 2.2, 0.6);
      for (const t of [8, 9, 10]) this.unlock(t); this.dialogue.say(credit ? "S2_CARD" : "S2_DEBIT", credit ? "S2_TAP" : "S2_TAP_D", s.firstPrice === 30 ? "S2_FA" : "S2_FB");
    } else if (this.phase === P.BatchHandoff && this.fin.deliverBatchBottle(index)) {
      const reject = index === 2 && s.herb === Herb.UseWilted; this.merchant.react(!reject);
      if (reject) { this.audio.play("reject"); this.dialogue.say("S3_M_REJECT", "S3_SPOIL"); } else { this.bank.record(`تحويل من التاجر • عبوة ${index + 1}`, "تحويل بنكي"); this.unlock(11); }
      if (s.inventoryValue === 0) { this.phase = P.Expenses; this.unlock(14); this.dialogue.say("S3_M_OK"); if (s.supplier === Supplier.Premium) this.dialogue.say("S3_FB"); }
    } else return false;
    this.refresh(); return true;
  }
  revenueAnswer(ok) {
    if (this.phase !== P.RevenueQuiz) return; this.dialogue.say(ok ? "S2_Q_OK" : "S2_Q_NO");
    const s = this.state;
    if (ok) this.ui.card3("صح! هاد إيراد", `الإيراد = كل مبلغ البيع (${s.revenue}). الربح بيجي بعد ما تطرح التكلفة: ${s.revenue} − ${s.cogs} = ${s.revenue - s.cogs}.`, "good");
    else this.ui.card3("مش هيك، بس قرّبت", `المبلغ اللي استلمته كله (${s.revenue}) اسمه إيراد. الربح أقل منه لأنه لازم تطرح التكلفة ${s.cogs}.`, "bad");
    if (!ok && this.quizTries++ === 0) return;
    this.phase = P.Offer; this.customerGone = this.customer.leave(this); this.refresh();
  }
  buyBatch(sup) {
    if (this.phase !== P.Supplier || !this.fin.purchaseBatch(sup)) return;
    const stall = sup === Supplier.Cheap ? 0 : 1; this.audio.play("coins", 0.8, 0.7); this.vendors[stall].receive();
    const loose = this.items.filter(x => x.market && x.market.loose && !x.consumed);
    if (sup === Supplier.Cheap) { // fill the basket with the best remaining pieces if you bought through the menu
      for (const kind of ["herb", "crystal", "water"]) { while ((this.cart || []).filter(c => c.market.loose === kind).length < 3) { const best = loose.filter(x => x.market.loose === kind && !this.cart.includes(x)).sort((a, b) => b.market.good - a.market.good)[0]; if (!best) break; this.cart.push(best); this.intoBasket(best, 0, this.cart.length - 1); } }
      this.batchGood = this.cart.reduce((a, c) => a + c.market.good, 0) / Math.max(1, this.cart.length);
    } else { for (const c of this.cart || []) { c.consumed = false; c.returnHome(); c.obj.scale.setScalar(1); } this.batchGood = 0.95; }
    for (const x of this.items.filter(x => x.market && (x.market.loose || x.market.bundle !== undefined))) { if (x.market.bundle === sup) this.intoBasket(x, stall, 0); else x.consumed = true; }
    this.bank.record(sup === Supplier.Cheap ? "مكونات زيت الميرمية • بالحبّة" : "صندوق المكونات الممتاز", this.payMethodNow || "بطاقة خصم");
    this.dialogue.say(sup === Supplier.Cheap ? "T3_CHEAP" : "B3_THANKS");
    if (sup === Supplier.Cheap) { this.phase = P.Wilt; this.showWilted(); this.dialogue.say("S3_FA_RISK"); } else { this.phase = P.BatchBrew; this.beginBrew(true); this.dialogue.say("S3_BACK"); }
    this.refresh();
  }
  async showWilted() { const w = await place(this.scene, "assets/custom/herb_red.glb", L.wiltedSpot, { scale: 1.55 }); w.rotation.z = 1.2; w.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(0x5c3d14); } }); this.wilted = w; this.fx.sparkle(L.wiltedSpot.clone().setY(1), 6); }
  decideHerb(c) { if (this.phase !== P.Wilt || !this.fin.decideHerb(c)) return; this.bank.record("ورق ميرمية بديل", "بطاقة خصم"); if (c === Herb.Replace) this.dialogue.say("S3_FA_FIX"); this.dialogue.say("S3_BACK"); if (this.wilted) this.scene.remove(this.wilted); this.phase = P.BatchBrew; this.beginBrew(true); this.refresh(); }
  payExpenses() {
    if (this.phase !== P.Expenses || !this.fin.payOperatingExpenses()) return;
    this.bank.record("فواتير التشغيل: إيجار وكهربا وحطب", "تطبيق البنك"); if (this.bank.credit) { this.dialogue.say("S3_BILL"); this.bank.payCredit(); }
    this.unlock(15); this.phase = P.FinalQuiz; this.quizTries = 0; this.correctLeft = Math.random() > 0.5; this.dialogue.say("S3_NET"); this.refresh();
  }
  finalAnswer(ok) {
    if (this.phase !== P.FinalQuiz) return; this.dialogue.say(ok ? "S3_Q_OK" : "S3_Q_NO");
    const s = this.state, sub = s.spoilage > 0 ? `المصروفات ${s.opex} والتلف ${s.spoilage}` : `المصروفات ${s.opex}`;
    if (ok) this.ui.card3("صح عليك! هاد صافي الربح", `إجمالي الربح ${s.grossProfit} ناقص ${sub} = ${s.netProfit}. هاد اللي ربحته فعلًا اليوم.`, "good");
    else this.ui.card3("هاد إجمالي الربح، مش الصافي", `إجمالي الربح ${s.grossProfit} صح، بس لسّا لازم تطرح ${sub}، فبيطلع الصافي أقل.`, "bad");
    if (!ok && this.quizTries++ === 0) return;
    this.phase = P.Report; this.state.finished = true; this.unlock(16); this.unlock(17); this.dialogue.say("S3_STATEMENT", "S3_END1", "S3_END2"); this.warm = 1; this.fx.sparkle(L.liquid.clone().setY(1.1), 18); this.audio.play("crystal", 1.1); this.refresh();
  }
  async nextChapter() {
    if (this.changing) return; this.changing = true; this.dropHeld(false);
    const next = this.chapter + 1; await this.ui.fade(true, 700);
    document.getElementById("card-title").textContent = CARDS[next][0]; document.getElementById("card-sub").textContent = CARDS[next][1];
    await wait(this.fast ? 50 : 1400);
    this.chapter = next; this.state.chapter = next; this.ui.setChapter(next);
    for (const it of this.items) if (it.kind !== "potion" || next === 2) { this.scene.remove(it.obj); it.consumed = true; }
    this.teleport(L.insideStart, L.insideYaw, true); this.fx.pile.forEach(c => this.scene.remove(c)); this.fx.pile = [];
    this.firas.resetTo(L.firasSpot); this.skipGlide = true; // everyone back to their own place for the new scene
    for (const n of [this.customer, this.merchant]) n.reset();
    if (next === 1) {
      this.phase = P.Price; await new Item(this, "potion", "خلطة النشاط", 0).build(L.saleBottle); this.unlock(6);
      this.marketLabel && (this.marketLabel.visible = true); this.customer.arrive(this); this.dialogue.say("S2_C01", "S1_ASK", "S2_F02");
    } else {
      this.phase = P.Supplier; this.unlock(7); this.unlock(12); this.unlock(13); this.dialogue.say("S3_F01", "S3_CREDIT", "S3_COMPARE");
      if (this.orderBoard) { this.scene.remove(this.orderBoard); this.orderBoard = sign(this.scene, ORDER3_TEXT, U(0, 3.55, -123.2), 2.4, 0.95, 0, 64); }
      if (this.recipeBoard) { this.recipeBoard.visible = false; sign(this.scene, RECIPES[1].board, U(-4.02, 1.36, 6.2), 1.05, 0.7, 90, 70); }
      // Trader: loose pieces, each with its own quality. Glass seller: one premium crate.
      const s0 = L.stalls[0], s1 = L.stalls[1]; let slot = 0; this.cart = [];
      for (const [k, d] of LOOSE.entries()) for (let i = 0; i < 4; i++, slot++) {
        const row = slot % 2, col = Math.floor(slot / 2), good = d.good[i];
        const it = new Item(this, "loose", `${d.name} • ${d.notes[i]} • ${d.price} عملة • الجودة ${Math.round(good * 100)}%`, slot);
        it.market = { key: "loose", loose: d.kind, stall: 0, price: d.price, good, model: { herb: "herb_red", crystal: "crystal_blue", water: "water_flask" }[d.kind], scale: d.kind === "water" ? 0.95 : 1.1,
          tint: new THREE.Color(RECIPES[1].tint[d.kind]).lerp(new THREE.Color(0x5a4a3a), (1 - good) * 0.9).getHex() };
        await it.build(L.stallPos(s0, row ? 0.28 : 0.6, 0.9, -1.55 + col * 0.42));
      }
      sign(this.scene, "بالحبّة: ميرمية 7 • لبان 5 • زيت 3 = 15 للعبوة\nالجودة متفاوتة • اختار 3 من كل نوع", L.stallPos(s0, 0.93, 0.8, -0.2), 0.6, 0.2, s0.side * 90, 80, "#f3e3bb");
      const crate = new Item(this, "bundle", "صندوق ممتاز • 60 عملة • الجودة 95% لكل المكونات", 0); crate.market = { key: "bundle", bundle: Supplier.Premium, stall: 1, good: 0.95 };
      await crate.build(L.stallPos(s1, 0.54, 0.9, -0.2));
      sign(this.scene, "صندوق لـ3 عبوات • 60 = 20 للعبوة\nميرمية 9 • لبان 7 • زيت 4 • جودة 95%", L.stallPos(s1, 0.93, 0.8, -0.2), 0.5, 0.2, s1.side * 90, 90, "#ffe9a8");
    }
    document.getElementById("card-title").textContent = ""; document.getElementById("card-sub").textContent = "";
    await this.ui.fade(false, 900); this.changing = false; this.refresh();
  }

  // ---------------------------------------------------------------- brewing mechanics
  // Crushing: 3 strokes = coarse, 5 = medium, 8+ = fine powder. Keep grinding until the texture matches the order, then take the bowl.
  get grindLevel() { const s = this.brew.strokes; return s >= 8 ? 2 : s >= 5 ? 1 : 0; }
  crushStroke() {
    if (this.paused || !this.brew.herbInMortar || this.grindLocked || (this.crushedItem && this.crushedItem.pos.distanceTo(L.mortar.clone().setY(1.04)) > 0.3)) return;
    const b = this.brew; b.strokes++; this.audio.play("grind", 0.85 + Math.min(b.strokes, 9) * 0.05); this.fx.bits(L.mortar.clone().setY(1.04), this.recipe.crushed, 5);
    if (this.mortarHerb) this.mortarHerb.scale.multiplyScalar(0.86);
    if (!b.crushed && b.strokes >= 3) { b.crushed = true; this.fx.sparkle(L.mortar.clone().setY(1.0), 6); this.audio.play("chime", 0.8); if (this.mortarHerb) this.scene.remove(this.mortarHerb);
      new Item(this, "crushed", "عشبة مسحوقة", 0).build(L.mortar.clone().setY(1.04)).then(it => { this.crushedItem = it; this.updateGrindLook(); });
      if (!this.grindExplained) { this.grindExplained = true; this.dialogue.say(this.recipe.grind === 2 ? "S3_GRIND" : "S1_GRIND"); } }
    else if (b.crushed) { this.updateGrindLook(); if (this.grindLevel === this.recipe.grind && this.lastGrind !== this.grindLevel) this.audio.play("chime", 1.1, 0.6); }
    this.lastGrind = this.grindLevel; this.refresh();
  }
  updateGrindLook() { const it = this.crushedItem; if (!it) return; const k = [1, 0.7, 0.42][this.grindLevel]; it.obj.children.forEach(m => { if (m.isMesh && m.geometry.type === "SphereGeometry") m.scale.setScalar(k); }); it.label = "عشبة مسحوقة • " + GRIND[this.grindLevel]; }
  // The sun ember must glow before it goes in: hold it over the brazier.
  // Heat stages: warming (dull red) -> ready (bright orange, best) -> too hot (white) -> burnt (dark). Away from the coals it cools slowly.
  static HEAT = [[0, "بارد", 0x000000, 0], [0.9, "بيسخن", 0xa05010, 0.5], [1.8, "ذاب ✓", 0xffa030, 1.4], [3.4, "سخن كتير", 0xfff0b0, 1.8], [4.8, "احترق ✗", 0x201810, 0.2]];
  heatStage(h) { let s = 0; Game.HEAT.forEach((x, i) => { if (h >= x[0]) s = i; }); return s; }
  updateHeat(dt) {
    if (!this.recipe.heat || !this.brazier) return; const c = this.items.find(i => i.kind === "crystal" && !i.consumed); if (!c) return;
    const p = c.pos, b = this.brazier, on = Math.hypot(p.x - b.x, p.z - b.z) < 0.26 && p.y > b.y - 0.1 && p.y < b.y + 0.55;
    const before = this.heatStage(c.heat || 0);
    if (on) { c.heat = (c.heat || 0) + dt; if (Math.random() < dt * 6) this.fx.bits(p.clone(), 0xff9a3a, 1); if ((this.sizzleT = (this.sizzleT || 0) - dt) <= 0) { this.sizzleT = 0.35; this.audio.play("swish", 1.6, 0.35); } }
    else if (c.heat && c.heat < 4.8) c.heat = Math.max(0, c.heat - dt * 0.12); // cools slowly once you take it away
    const st = this.heatStage(c.heat || 0), H = Game.HEAT[st]; c.heatColor = st ? H : null; c.hot = st >= 2 && st <= 4;
    c.label = `راتنج اللبان • ${H[1]}`; this.heatText = on || (st && st !== 2) ? `حرارة اللبان: ${H[1]}` : null;
    if (st !== before) {
      if (st === 2) { this.fx.sparkle(p.clone(), 10, 0xffb040); this.audio.play("crystal", 0.9, 0.7); this.dialogue.say("S3_HOT"); }
      if (st === 3) this.audio.play("reject", 1.6, 0.3);
      if (st === 4) { this.dialogue.say("S3_BURN"); this.audio.play("reject", 1, 0.5); }
      this.refresh();
    }
  }
  get heatQuality() { const c = this.usedEmberStage ?? 2; return c === 2 ? 3 : c === 3 ? 2 : 1; }
  // How close the potion is to what the buyer asked for (map path + grind + heated ember).
  get goodQuality() { const g = this.batch ? this.batchGood ?? 0.95 : 0.9; return g >= 0.82 ? 3 : g >= 0.62 ? 2 : 1; }
  get prepQuality() { return Math.max(1, Math.min(this.map.quality, 3 - Math.abs((this.grindLevelUsed ?? this.recipe.grind) - this.recipe.grind), this.recipe.heat ? this.heatQuality : 3, this.goodQuality)); }
  stir(turns, dir) {
    if (this.paused || !this.brew.readyToStir || this.brew.readyToBottle) return;
    if (this.map.stir(turns, dir, this.stirSpeed || 0)) { this.audio.play("crystal", 1.2, 0.7); this.fx.sparkle(L.liquid.clone().setY(1.06), 14); }
    this.brew.stir(turns); this.stirAcc = (this.stirAcc || 0) + turns; if (this.stirAcc > 0.22) { this.stirAcc = 0; this.audio.play("swish", 0.9 + Math.random() * 0.2, 0.7); } this.swirl = Math.min(3, (this.swirl || 0) + turns * 9);
    if (this.brew.readyToBottle) { this.audio.play("chime", 1.25); this.fx.sparkle(L.liquid.clone().setY(1.06), 14); }
    this.brewObjective();
  }
  observeStir(p) {
    const c = L.liquid, d = p.clone().sub(c), r = Math.hypot(d.x, d.z);
    if (!this.brew.readyToStir || r < 0.06 || r > L.innerRadius || Math.abs(d.y) > 0.5) { this.lastAngle = null; return; }
    const a = Math.atan2(d.z, d.x) * 180 / Math.PI;
    const now = performance.now();
    if (this.lastAngle != null) { let s = a - this.lastAngle; s = ((s + 540) % 360) - 180;
      const sp = Math.abs(s) / Math.max((now - this.lastStirT) / 1000, 0.008); this.stirSpeed = (this.stirSpeed || 0) * 0.8 + sp * 0.2;
      if (this.stirSpeed > 560 && !this.fastWarned && !this.fast) { this.fastWarned = true; this.dialogue.say("S1_FAST"); }
      if (Math.abs(s) < 60) this.stir(Math.abs(s) / 360, s > 0 ? 1 : -1); }
    this.lastAngle = a; this.lastStirT = now;
  }
  observePestle(p) {
    const m = L.mortar; if (Math.hypot(p.x - m.x, p.z - m.z) > 0.26 || !this.brew.herbInMortar || this.grindLocked) return;
    if (p.y > m.y + 0.18) this.pestleArmed = true; if (this.pestleArmed && p.y < m.y + 0.1) { this.pestleArmed = false; this.crushStroke(); }
  }
  pour(dt) {
    const it = this.bottleIn; if (!it || this.paused) return;
    this.fill = Math.min(1, this.fill + dt / 1.8);
    const s = this.state, r = this.recipe, color = it.index === 2 && this.batch && s.herb === Herb.UseWilted ? new THREE.Color(0x665c45) : new THREE.Color(r.potion[this.batch && s.supplier === Supplier.Premium ? 1 : 0]);
    color.lerp(new THREE.Color(0xffffff), 0.06 * (this.prepQuality - 1));
    it.fill(this.fill, color); this.pourT = 0.1; this.pourColor = color;
    this.ui.progress(`تعبئة العبوة: ${Math.round(this.fill * 100)}%`);
    if (this.fill >= 1) {
      it.kind = "potion"; it.label = this.recipe.name; it.filled = true; it.obj.position.copy(L.finishedBottle(this.filled)); it.home = it.obj.position.clone();
      if (this.batch) this.fin.craftBatchBottle(it.index);
      this.fx.sparkle(it.obj.position.clone().setY(1.0), 4 + this.map.quality * 4); this.audio.play("glass");
      if (this.filled === 0) { const q = this.prepQuality, r = this.recipe, used = this.grindLevelUsed ?? r.grind;
        this.ui.card3(`${r.name} • الجودة ${q} / 3`, `مسار الخريطة: ${this.map.quality} / 3. الطحن: ${GRIND[used]}${used === r.grind ? " ✓" : ` (الطلب ${GRIND[r.grind]})`}.${r.heat ? ` الجمرة: ${Game.HEAT[this.usedEmberStage ?? 2][1]}.` : ""}${this.batch ? ` جودة المكونات: ${Math.round((this.batchGood ?? 0.95) * 100)}%. قيمتها بالسوق: ${[26, 34, 40][q - 1]} للعبوة (التاجر ملتزم بسعر ثابت ${this.state.merchantPrice}).` : " الجودة بتبني سمعة."}`, q >= 2 ? "good" : "bad"); }
      this.bottleIn = null; this.filled++; this.bottleFinished();
    }
  }
  // Drop logic shared by mouse, touch and VR hands.
  tryDrop(it) {
    if (it.consumed || this.paused) return;
    if (it.market && it.market.loose && it.market.stall === 0 && this.baskets) { const b = this.baskets[0]; if (Math.hypot(it.pos.x - b.x, it.pos.z - b.z) < 0.42 && Math.abs(it.pos.y - b.y) < 0.6) this.marketDrop(it); else this.bounceHome(it); return; }
    if (it.market) { const b = (this.baskets || [L.basket]).find(b => Math.hypot(it.pos.x - b.x, it.pos.z - b.z) < 0.42 && Math.abs(it.pos.y - b.y) < 0.6); if (b) this.marketDrop(it); else this.bounceHome(it); return; }
    const p = it.pos, c = L.cauldron, overCauldron = Math.hypot(p.x - c.x, p.z - c.z) < L.innerRadius + 0.3 && p.y > 0.55 && p.y < 2.1;
    if (overCauldron && it.kind !== "spoon") {
      const ing = ["crushed", "crystal", "water"].includes(it.kind);
      if (it.kind === "crystal" && this.recipe.heat && !it.hot && this.heatStage(it.heat || 0) < 2) { this.dialogue.say("S3_COLD"); this.ui.toast("الجمرة باردة: حمّيها عالموقد أول"); this.bounceHome(it); return; }
      if (ing && (this.phase === P.Brew || this.phase === P.BatchBrew) && this.brew.add(it.kind)) {
        if (it.kind === "crushed") { this.grindLocked = true; this.grindLevelUsed = this.grindLevel; }
        if (it.kind === "crystal" && this.recipe.heat) this.usedEmberStage = this.heatStage(it.heat || 0);
        const col = it.kind === "crystal" ? 0x4d8cff : it.kind === "water" ? 0x66d9ff : 0xd9401f;
        this.fx.bits(L.liquid.clone().setY(0.92), col, 9); this.fx.sparkle(L.liquid.clone().setY(0.96), 8); this.map.add(it.kind); it.consume(); this.audio.play("splash", 0.9 + Math.random() * 0.2);
        if (this.brew.readyToStir && !this.mapExplained) { this.mapExplained = true; this.dialogue.say("S1_MAP"); }
        this.refresh(); return;
      }
      this.ui.toast(it.kind === "herb" ? "اسحق العشبة في الهاون أولًا" : ing ? (this.brew.readyToStir ? "القدر ممتلئ — حرّك الآن" : "ليس الآن") : "هذا لا يوضع في القدر");
      this.bounceHome(it); return;
    }
    const near = (t, h, v) => Math.hypot(p.x - t.x, p.z - t.z) < h && Math.abs(p.y - t.y) < v;
    if (it.kind === "herb" && near(L.mortar, 0.37, 0.4) && !this.brew.herbInMortar && (this.phase === P.Brew || this.phase === P.BatchBrew)) {
      this.brew.herbInMortar = true; it.consume(); this.audio.play("chime", 0.5);
      place(this.scene, "assets/custom/herb_red.glb", L.mortar.clone().setY(1.0), { scale: 0.9 }).then(h => this.mortarHerb = h); this.refresh();
    } else if (it.kind === "bottle" && near(L.bottleSocket, 0.32, 0.6)) {
      if (!this.brew.readyToBottle) { this.ui.toast("أكمل الخلط أولًا"); this.bounceHome(it); return; }
      if (this.bottleIn && this.bottleIn !== it) { this.ui.toast("انتظر حتى تمتلئ العبوة الحالية"); this.bounceHome(it); return; }
      this.bottleIn = it; this.fill = 0; it.obj.position.copy(L.bottleSocket); it.obj.quaternion.identity(); it.fill(0, new THREE.Color(0x1ab866)); this.audio.play("glass", 1.1, 0.7);
      if (!this.pipeExplained) { this.pipeExplained = true; this.dialogue.say("S1_PIPE"); } this.refresh();
    } else if (it.kind === "potion" && near(L.handoff, 0.45, 0.5)) {
      if (this.deliver(it.index)) {
        it.consumed = true; const rejected = it.index === 2 && this.state.herb === Herb.UseWilted && this.chapter === 2;
        const from = it.pos.clone(), to = rejected ? L.discard : L.display(this.chapter === 2 ? it.index + 1 : 0);
        this.fx.add(new THREE.Object3D(), 1, k => { it.obj.position.lerpVectors(from, to, k * k * (3 - 2 * k)); if (k >= 1 && rejected) it.obj.visible = false; });
      } else this.bounceHome(it);
    } else if (it.pos.distanceTo(it.home) > 0.05) this.bounceHome(it); // never leave things floating in the air
  }
  // The dropper: squeeze in the cauldron to draw liquid up, squeeze over the bottle to fill it.
  usePipette(it, squeezing, dt) {
    const k = Math.min(1, dt * 14), sq = squeezing ? 1 : 0; it.bulb.scale.lerp(new THREE.Vector3(1 + 0.3 * sq, 1.3 - 0.5 * sq, 1 + 0.3 * sq), k);
    if (!squeezing || this.paused) { this.pipeSound = false; return; }
    const tip = it.pos, c = L.liquid, s = L.bottleSocket;
    const inPot = Math.hypot(tip.x - c.x, tip.z - c.z) < L.innerRadius - 0.03 && tip.y < c.y + 0.16 && tip.y > c.y - 0.6;
    const overBottle = this.bottleIn && Math.hypot(tip.x - s.x, tip.z - s.z) < 0.14 && tip.y > s.y + 0.04 && tip.y < s.y + 0.5;
    if (inPot) {
      if (!this.brew.readyToBottle) { if (!this.pipeWarn) { this.pipeWarn = true; this.ui.toast("حرّك الخليط أول"); } return; }
      if (this.pipe < 1) { this.pipe = Math.min(1, this.pipe + dt / 0.9); this.audio.play("splash", 1.8, 0.25); if (Math.random() < dt * 8) this.fx.bubble(); this.brewObjective(); }
    } else if (overBottle && this.pipe > 0) {
      const a = Math.min(this.pipe, dt / 1.1); this.pipe -= a; this.pour(a * 1.8);
      if (Math.random() < dt * 12) this.fx.bits(tip.clone(), this.pourColor ? this.pourColor.getHex() : 0x1ab866, 1);
      if (this.bottleIn) this.brewObjective();
    } else if (this.pipe > 0) { this.pipe = Math.max(0, this.pipe - dt * 0.6); if (Math.random() < dt * 10) this.fx.bits(tip.clone(), 0x1ab866, 1); }
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
    this.focused = name; this.glide = this.skipGlide ? 1 : 0; this.skipGlide = false; this.rig.position.set(v.stand.x, 0, v.stand.z); this.yaw = v.standYaw; this.pitch = -0.3;
  }
  unfocus() { this.fromPos = this.camera.getWorldPosition(new THREE.Vector3()); this.fromQ = this.camera.getWorldQuaternion(new THREE.Quaternion()); this.focused = false; this.glide = 0; }
  walk(move, dt) {
    if (!move.lengthSq()) return; const r = this.rig.position, d = move.clone().multiplyScalar(dt);
    const base = this.inVR ? this.camera.getWorldPosition(new THREE.Vector3()).setY(r.y) : r.clone();
    const shut = this.fx.doorRot < 0.9, m = 0.2;
    const blocked = p => (shut && Math.abs(p.x) < 0.66 && Math.abs(p.z) < 0.3) || colliders.some(b => p.x > b.min.x - m && p.x < b.max.x + m && p.z > b.min.z - m && p.z < b.max.z + m && b.min.y < 1.2 && b.max.y > 0.15);
    if (blocked(base)) { r.add(d); return; } // already inside something (teleport, room-scale step): let the player walk out
    if (!blocked(base.clone().add(d))) { r.add(d); return; }
    const dx = new THREE.Vector3(d.x, 0, 0), dz = new THREE.Vector3(0, 0, d.z);
    if (!blocked(base.clone().add(dx))) r.add(dx); else if (!blocked(base.clone().add(dz))) r.add(dz);
  }
  applyDesktopPose(dt) {
    this.rig.rotation.set(0, 0, 0); this.rig.updateMatrixWorld(true);
    if (this.cine) {
      const c = this.cine; c.t += dt; const k = THREE.MathUtils.clamp(c.t / c.dur, 0, 1), e = k * k * (3 - 2 * k);
      const from = U(-6, 9, -26), to = this.rig.position.clone().add(new THREE.Vector3(0, 1.62, 0)), pos = from.clone().lerp(to, e);
      pos.x += Math.sin(e * Math.PI) * 3; const look = U(0, 1.6 + (1 - e) * 0.8, 0.2);
      this.camera.position.copy(pos.sub(this.rig.position)); this.camera.lookAt(look);
      if (k >= 1) { this.cine = null; this.yaw = L.outsideYaw; this.pitch = 0.12; this.glide = 1; this.fromPos = null; }
      return;
    }
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
      if (e.code === "KeyE") this.act(); if (e.code === "Tab") { e.preventDefault(); this.paused ? (this.paused = false, this.refresh()) : this.glossary(0); }
      if (e.code === "KeyR") this.ui.modal("إعادة التجربة؟", "ستبدأ مجددًا برصيد 100 عملة.", C("نعم، إعادة", () => location.reload()), C("متابعة", () => this.refresh())); });
    addEventListener("keyup", e => { this.keys[e.code] = false; });
    el.addEventListener("contextmenu", e => e.preventDefault());
    // Click the 3D view once: the mouse now looks around (first-person), a crosshair shows what you will interact with. Esc frees the mouse.
    el.addEventListener("click", () => { if (!this.inVR && !this.touchUsed && !this.cine && !document.pointerLockElement && !this.ui.st.modal && !(this.ui.st.talk && !this.ui.hold)) el.requestPointerLock?.(); });
    document.addEventListener("pointerlockchange", () => { this.locked = document.pointerLockElement === el; document.getElementById("cross").hidden = !this.locked; document.getElementById("lockhint").hidden = this.locked || this.touchUsed; });
    el.addEventListener("mousemove", e => {
      if (!this.locked || this.cine) return; this.pointer.set(0, 0);
      if ((e.buttons & 1) && this.held?.kind === "pestle") { this.pestleDy = (this.pestleDy || 0) + e.movementY; return; }
      this.yaw -= e.movementX * 0.0022; this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022, -1.3, 1.3); if (this.focused) this.unfocus();
    });
    el.addEventListener("pointermove", e => {
      if (this.locked) return;
      this.pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (e.pointerType === "mouse" && (e.buttons & 2) && !this.focused) { this.yaw -= e.movementX * 0.0025; this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.002, -1.2, 1.3); }
      if (e.pointerType === "mouse" && (e.buttons & 1) && this.held?.kind === "pestle") this.pestleDy = (this.pestleDy || 0) + e.movementY;
    });
    el.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" && e.button === 0) { this.mouseDown = true;
      if (!this.held && (this.hover || this.hoverDoor || this.hoverChar || this.hoverPortal || this.hoverPOS)) this.act();
      else if (this.locked && this.held && !["pestle", "pipette"].includes(this.held.kind)) this.act(); } });
    addEventListener("pointerup", e => { if (e.button === 0) this.mouseDown = false; });
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
    this.ray.setFromCamera(this.pointer, this.camera); this.ray.far = this.region() === "market" ? 5.5 : 3;
    const objs = this.items.filter(i => !i.consumed && i.obj.visible).map(i => i.obj);
    const hits = this.ray.intersectObjects(objs.concat(refs.door ? [refs.door] : []), true);
    this.hover = null; this.hoverDoor = false; this.hoverChar = null; this.hoverPortal = false;
    if (!hits.length && this.portals) { this.ray.far = 6; this.hoverPortal = this.ray.intersectObjects(this.portals.map(p => p.disc)).length > 0; }
    this.hoverPOS = !this.held ? this.payNear(this.ray.ray, 0.14, 4) : null;
    if (hits.length) { let o = hits[0].object; while (o && !this.items.find(i => i.obj === o) && o !== refs.door) o = o.parent;
      if (o === refs.door) this.hoverDoor = true; else this.hover = this.items.find(i => i.obj === o); }
    if (!this.hover && !this.held) { this.ray.far = 7; this.hoverChar = this.rayCharacter(this.ray.ray); }
  }
  act() {
    if (this.paused || this.inVR) return; this.audio.start();
    if (this.hoverPOS && !this.held) { this.tapPay(this.hoverPOS.pos); return; }
    if (this.held) { const it = this.held; this.held = null; it.held = false; this.tryDrop(it); return; }
    if (this.hover && !this.hover.consumed && this.hover !== this.bottleIn) { this.held = this.hover; this.held.held = true; this.audio.play("pop", 1, 0.8); }
    else if (this.hoverDoor) this.toggleDoor();
    else if (this.hoverChar) this.askMenu(this.hoverChar.speaker);
    else if (this.hoverPortal) this.travel();
  }
  dropHeld(drop) { if (!this.held) return; const it = this.held; this.held = null; it.held = false; drop ? this.tryDrop(it) : it.returnHome(); }
  heldTarget() {
    this.ray.setFromCamera(this.pointer, this.camera); const it = this.held;
    if (it.kind === "spoon") { const t = this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -L.liquid.y), new THREE.Vector3());
      if (t && Math.hypot(t.x - L.liquid.x, t.z - L.liquid.z) < L.innerRadius + 0.1) { const f = new THREE.Vector3(t.x - L.liquid.x, 0, t.z - L.liquid.z).clampLength(0, L.innerRadius - 0.05); return L.liquid.clone().add(f).setY(L.liquid.y - 0.08); } }
    if (it.kind === "pestle" && this.pestleDy !== undefined && this.camera.getWorldPosition(new THREE.Vector3()).distanceTo(L.mortar) < 2.4) {
      const y = THREE.MathUtils.clamp(it.pos.y - this.pestleDy * 0.006, L.mortar.y + 0.03, L.mortar.y + 0.42); this.pestleDy = 0; return L.mortar.clone().setY(y); }
    if (it.kind === "pipette") {
      const top = L.bottleSocket.clone().setY(L.bottleSocket.y + 0.2); if (this.bottleIn && this.ray.ray.distanceToPoint(top) < 0.3) return top;
      const t = this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -L.liquid.y), new THREE.Vector3());
      if (t && Math.hypot(t.x - L.liquid.x, t.z - L.liquid.z) < L.innerRadius + 0.15) { const f = new THREE.Vector3(t.x - L.liquid.x, 0, t.z - L.liquid.z).clampLength(0, L.innerRadius - 0.1); return L.liquid.clone().add(f).setY(L.liquid.y - 0.05); }
    }
    if (it.market) { for (const b0 of this.baskets || []) { const b = b0.clone().setY(b0.y + 0.12); if (this.ray.ray.distanceToPoint(b) < 0.35) return b; } }
    this.ray.far = this.region() === "market" ? 5.5 : 2.8; const hits = this.ray.intersectObjects([refs.root, this.marketRoot].filter(Boolean), true);
    if (hits.length) return hits[0].point.add(new THREE.Vector3(0, 0.01, 0));
    return this.ray.ray.at(this.region() === "market" ? 2.2 : 1.1, new THREE.Vector3()).add(new THREE.Vector3(0, -0.15, 0));
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
    this.renderer.xr.addEventListener("sessionstart", () => { this.cine = null;
      this.inVR = true; this.dropHeld(false); this.focused = false; this.vrLift = 0; this.calibrateIn = 1.5; this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true; for (const n of this.npcs) n.holder.traverse(o => o.castShadow = false);
      const p = this.rig.position.clone(); this.camera.position.set(0, 0, 0); this.camera.quaternion.identity(); this.rig.position.copy(p); this.rig.rotation.y = this.yaw;
      btn.textContent = "اخرج من الواقع الافتراضي"; this.ui.dirty = true;
      setTimeout(() => { this.ui.toast("وجّه الشعاع واضغط الزناد للإمساك من بعيد • B لضبط الطول"); this.ui.toastUntil = performance.now() + 7000; }, 1800);
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
        else if (this.payNear(this.ray.ray, 0.12, 6)) this.tapPay(this.payNear(this.ray.ray, 0.12, 6).pos);
        else if (refs.door && this.ray.intersectObject(refs.door, true).length) this.toggleDoor();
        else { const ch = this.rayCharacter(this.ray.ray); if (ch) this.askMenu(ch.speaker); }
      }
      // Door: grip near the handle and swing it with your hand.
      if (down(1) && !h.held && refs.door) {
        const hinge = refs.door.getWorldPosition(new THREE.Vector3()), r = this.fx.doorRot;
        const handle = hinge.clone().add(new THREE.Vector3(-Math.cos(r), 0, Math.sin(r)).multiplyScalar(1.0)).setY(1.0);
        if (gripPos.distanceTo(handle) < 0.28) { h.door = true; this.fx.doorHeld = true; gp.hapticActuators?.[0]?.pulse?.(0.3, 50); this.audio.play("creak", 1.1, 0.4); }
      }
      if (h.door) {
        if (!squeeze) { h.door = false; this.fx.doorHeld = false; this.fx.doorGoal = this.fx.doorRot; }
        else { const hinge = refs.door.getWorldPosition(new THREE.Vector3()), d = gripPos.clone().sub(hinge);
          const a = THREE.MathUtils.clamp(Math.atan2(d.z, -d.x), 0, 1.66); if (Math.abs(a - this.fx.doorRot) > 0.5) { this.audio.play("creak", 1, 0.35); }
          this.fx.doorRot = this.fx.doorRot + (a - this.fx.doorRot) * Math.min(1, dt * 15); this.fx.doorGoal = this.fx.doorRot; }
      }
      // Grab with the grip button: nearest item within reach of the hand (or the one the ray points at).
      if (down(1) && !h.held && !h.door) {
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
        if (it.kind === "pipette") this.usePipette(it, h.byTrigger ? squeeze : trigger, dt);
        if (h.byTrigger ? !trigger : !squeeze) { h.held = null; it.held = false; it.obj.quaternion.identity(); this.vrRelease(it, zone, gripPos); }
      }
      if (h.hand === "right" && down(5)) this.calibrate(true);
      for (const pp of this.pending) if (gripPos.distanceTo(pp.pos.at) < 0.16) {
        if (pp.method && this.cardHand === h) { gp.hapticActuators?.[0]?.pulse?.(0.6, 90); this.tapPay(pp.pos); }
        else if (!pp.method && !this.ui.st.talk && performance.now() > (this.askPosT || 0)) { this.askPosT = performance.now() + 4000; this.askPayMethod(pp); } }
      if (h.hand === "left" && down(5) && this.cardHand) { this.hideCard(); for (const pp of this.pending) pp.method = null; this.ui.toast("رجّعت البطاقة"); }
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
    const zones = [...(this.baskets || []).map(b => ({ at: b.clone().setY(1.0), r: 0.35 })), { at: L.liquid.clone().setY(1.12), r: 0.65 }, { at: L.mortar.clone().setY(1.0), r: 0.3 }, { at: L.bottleSocket.clone().setY(1.05), r: 0.3 }, { at: L.handoff.clone().setY(1.1), r: 0.45 }];
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
      if (n.y <= 0) { const eye = this.camera.getWorldPosition(new THREE.Vector3()), crosses = this.fx.doorRot < 0.9 && (eye.z < 0.3) !== (n.z < 0.3) && Math.abs(n.x) < 4.6;
        const ok = (L.isInside(n) || n.z < 0.9) && !crosses && L.inMarket(n) === L.inMarket(eye); const hitWall = colliders.some(b => b.containsPoint(n.clone().setY(0.5))); if (ok && !hitWall) this.arcTarget = n.setY(0); pts.push(n); break; } p.copy(n); }
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
    this.ui.setHold(this.dialogue.busy && !this.asking && !this.paused);
    if (this.locked && (this.ui.st.modal || (this.ui.st.talk && !this.ui.hold))) document.exitPointerLock();
    this.updateHeat(dt);
    if (this.pendingTerms?.length) { this.termWait = this.dialogue.busy ? 0 : (this.termWait || 0) + dt; if (this.termWait > 0.6) this.showTerm(this.pendingTerms[0]); }
    if (this.phase === P.Purchase && !this.welcomed && !this.dialogue.busy) { this.welcomed = true; this.refresh(); }
    if (this.phase === P.Intro && !this.doorOpened && this.fx.doorRot > 0.6) { this.doorOpened = true; this.refresh(); }
    if (this.phase === P.Ready && !this.changing) { if (this.fx.doorRot < 0.25) this.readyShut = true; else if (this.readyShut && this.fx.doorRot > 0.6) this.nextChapter(); }
    this.fx.low = this.inVR; this.fx.eye = this.camera.getWorldPosition(this.fx.eyeV || (this.fx.eyeV = new THREE.Vector3()));
    const name = this.stationName();
    if (name !== this.lastStation) { const first = this.lastStation === undefined; this.lastStation = name; this.dropHeld(false); if (!this.inVR && this.focused) this.unfocus(); if (!first) this.refresh(); }
    if (this.inVR) this.updateVR(dt);
    else {
      const k = this.keys, mv = new THREE.Vector2((k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0));
      if (this.touchMove && this.touchMove.lengthSq() > 0.01) mv.copy(this.touchMove);
      if (mv.lengthSq() && !this.paused && !this.cine) {
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
        if (it.kind === "pipette") { it.obj.quaternion.identity(); this.usePipette(it, !!(this.keys.KeyF || this.pourHeld || this.mouseDown), dt); }
        this.ui.hint(it.label + " • E للإفلات" + (it.kind === "pestle" ? " • اضغط الزر الأيسر وحرّك الفأرة للأعلى والأسفل" : it.kind === "spoon" ? " • حرّك المؤشر دائريًا ببطء داخل القدر" : it.kind === "pipette" ? " • اضغط F أو الزر الأيسر مطولًا للعصر" : it.market ? " • حطّه بالسلّة" : ""));
      } else this.ui.hint(this.hover && !this.hover.consumed ? this.hover.label + " • E للإمساك" : this.hoverDoor ? (this.fx.doorGoal > 0.8 ? "الباب • E للإغلاق" : "الباب • E للفتح") : this.hoverChar ? this.hoverChar.speaker + " • E لتسأل" : this.hoverPortal ? "البوابة • E للعبور" : this.hoverPOS ? `جهاز الدفع • E لتدفع ${this.hoverPOS.amount} بالبطاقة` : "");
      if (this.phase === P.Intro && this.doorOpened && L.isInside(this.rig.position)) this.enterShop();
    }
    const eye = this.camera.getWorldPosition(new THREE.Vector3()), shopping = (this.phase === P.Purchase && this.welcomed) || this.phase === P.Supplier;
    this.greeted = this.greeted || new Set();
    if (shopping) this.vendors.forEach((v, i) => { const key = this.phase + ":" + i; if (!this.greeted.has(key) && eye.distanceTo(v.holder.position) < 3.8) { this.greeted.add(key); this.dialogue.say(this.phase === P.Supplier ? STALL_INFO[i].offer : STALL_INFO[i].hello); } });
    (this.basketRings || []).forEach(r => r.visible = shopping);
    if (this.portalMat) this.portalMat.uniforms.t.value = t;
    const inMk = this.region() === "market"; if (this.villageBackdrop && this.backdropIn !== inMk) { this.backdropIn = inMk; this.villageBackdrop.forEach(o => o.visible = !inMk); this.marketScenery.visible = inMk; }
    if (this.portals && !this.traveling && !this.changing && performance.now() > (this.portalCool || 0)) { const pp = this.inVR ? eye : this.rig.position;
      for (const p of this.portals) if (Math.hypot(pp.x - p.at.x, pp.z - p.at.z) < 0.6) { this.travel(); break; } }
    const pip = this.items.find(i => i.kind === "pipette" && !i.consumed);
    if (pip) { const f = this.pipe || 0; pip.pipeLiquid.visible = f > 0.01; pip.pipeLiquid.scale.y = 0.19 * f; pip.pipeLiquid.position.y = 0.006 + 0.095 * f; if (this.pourColor) pip.pipeLiquid.material.color.copy(this.pourColor); }
    if (this.inVR) { const head = this.speakerHead(); this.ui.setBubble(this.dialogue.speaker, this.dialogue.speaking ? this.dialogue.text : null, head); } else this.ui.setBubble(null, null, null);
    if (this.inVR && this.phase === P.Intro && this.doorOpened && L.isInside(this.camera.getWorldPosition(new THREE.Vector3()))) this.enterShop();
    document.getElementById("pour").hidden = !(this.touchUsed && this.held?.kind === "pipette");
    document.getElementById("keys").style.opacity = t > 25 ? 0 : 0.7;
    // Item glow: next item pulses gold, hovered item glows brighter.
    for (const it of this.items) { if (it.consumed) continue; const hov = it === this.hover && !it.held, tgt = this.isTarget(it) && !it.held;
      if (it.heatColor) { for (const m of it.glow) if (m.emissive) { m.emissive.setHex(it.heatColor[2]); m.emissiveIntensity = it.heatColor[3] * (0.85 + 0.15 * Math.sin(t * 9)); } if (it.heatColor[0] >= 4.8) for (const m of it.glow) m.color && m.color.setHex(0x2a2018); continue; }
      it.setGlow(hov ? 0.75 : tgt ? 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 4.5)) : 0); }
    const tagIt = this.inVR ? (this.hover || this.hands?.map(h => h.held).find(Boolean)) : null;
    this.ui.setTag(tagIt && (tagIt.market || tagIt.kind === "crystal" || tagIt.kind === "crushed") ? tagIt.label : null, tagIt ? tagIt.pos.clone().setY(tagIt.pos.y + 0.28) : null);
    // Brew visuals.
    const b = this.brew; this.swirl = Math.max(0, (this.swirl || 0) - dt * 1.2);
    this.fx.activity = (this.phase === P.Brew || this.phase === P.BatchBrew) ? (b.readyToBottle ? 0.6 : b.readyToStir ? 0.35 + b.stirring * 0.65 : 0) : 0;
    this.fx.tint = this.map.tint; this.fx.golden = this.map.inZone;
    if (refs.liquid) { const rc = this.recipe.potion, target = new THREE.Color(0x14261f).lerp(this.state.herb === Herb.UseWilted && this.batch ? new THREE.Color(0x6a6a3a) : new THREE.Color(rc[this.batch && this.state.supplier === Supplier.Premium ? 1 : 0]), b.stirring);
      refs.liquid.material.color.lerp(target, Math.min(1, dt * 3)); refs.liquid.material.emissive.copy(refs.liquid.material.color); refs.liquid.position.y = L.liquid.y + Math.sin(t * 3) * 0.004; }
    if (this.pourT > 0) { this.pourT -= dt; } this.audio.setPouring(this.pourT > 0);
    if ((this.lightT = (this.lightT || 0) - dt) <= 0) { this.lightT = 0.4; this.budgetLights(); }
    this.fx.update(dt, t, this);
    const eyeNow = this.camera.getWorldPosition(new THREE.Vector3()); for (const n of this.npcs) n.update(dt, t, this.dialogue, eyeNow, this);
    if (this.firas) this.firas.update(dt, t, this, (Stations[name] && name !== "ending" ? Stations[name].firas : L.firasSpot));
    this.ui.update(dt, this.bank.balance, this.inVR);
    // Alchemy map panel (desktop/phone) while mixing or stirring.
    const showMap = (name === "mix" || name === "cauldron") && (this.phase === P.Brew || this.phase === P.BatchBrew);
    const mapEl = document.getElementById("map"); mapEl.hidden = !showMap || this.inVR;
    this.mapMesh.visible = showMap && this.inVR; if (this.mapMesh.visible && (this.mapT = (this.mapT || 0) - dt) <= 0) { this.mapT = 0.1; this.drawWorldMap(); }
    if (showMap) { this.map.draw(document.getElementById("map-canvas").getContext("2d"), 360); document.getElementById("map-quality").textContent = this.map.any ? this.map.qualityText : "أضف المكونات"; }
    if (this.warm) { this.sun.intensity = Math.min(3.0, this.sun.intensity + dt * 0.3); }
  }
}
