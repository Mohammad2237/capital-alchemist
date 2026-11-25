// Copyright (c) 2026 CAPITAL Team. All rights reserved. Proprietary — see LICENSE. Unauthorized copying or redistribution is prohibited.
// Automated playthrough of one financial branch through the live game code (no shortcuts on the money).
// Open index.html?fast&smoke=N (N = 0..5). Results land in window.__smoke and the page title.
import { L } from "./layout.js";
import { Supplier, Herb } from "./finance.js";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROWS = [[30, Supplier.Cheap, Herb.Replace, 156, 56], [30, Supplier.Cheap, Herb.UseWilted, 124, 24], [30, Supplier.Premium, Herb.None, 146, 46],
  [50, Supplier.Cheap, Herb.Replace, 155, 55], [50, Supplier.Cheap, Herb.UseWilted, 130, 30], [50, Supplier.Premium, Herb.None, 145, 45]];

export async function runSmoke(g, branch) {
  const log = [], ck = (ok, m) => log.push((ok ? "PASS " : "FAIL ") + m);
  const [price, sup, herb, cash, net] = ROWS[branch];
  const find = k => g.items.find(i => i.kind === k && !i.consumed && i !== g.bottleIn);
  const drop = (it, p) => { it.obj.position.copy(p); g.tryDrop(it); };
  const until = async (f, ms = 8000) => { const t = performance.now(); while (!f() && performance.now() - t < ms) await sleep(50); return f(); };
  async function brew(batch) {
    await until(() => find("herb"));
    drop(find("herb"), L.mortar); ck(g.brew.herbInMortar, "herb into mortar");
    for (let i = 0; i < (batch ? 8 : 5); i++) g.crushStroke(); ck(g.brew.crushed && g.grindLevel === g.recipe.grind, "crushed to the ordered texture");
    await until(() => find("crushed"));
    if (g.recipe.heat) { const cr = find("crystal"); drop(cr, L.liquid.clone().setY(1.2)); ck(!cr.consumed, "cold ember refused");
      cr.obj.position.copy(g.brazier).setY(g.brazier.y + 0.15); for (let k = 0; k < 20 && !cr.hot; k++) g.updateHeat(0.1); ck(cr.hot, "ember heated on the brazier"); }
    drop(find("crushed"), L.liquid.clone().setY(1.2)); drop(find("crystal"), L.liquid.clone().setY(1.2)); drop(find("water"), L.liquid.clone().setY(1.2));
    ck(g.brew.readyToStir, "ingredients accepted by cauldron");
    const pestle = find("pestle"); drop(pestle, L.liquid.clone().setY(1.2)); ck(!pestle.consumed, "cauldron rejects the pestle");
    for (let i = 0; i < 900 && !g.brew.readyToBottle; i++) { const a = i * 0.1; g.observeStir(L.liquid.clone().add({ x: Math.cos(a) * 0.2, y: 0.05, z: Math.sin(a) * 0.2 })); }
    ck(g.brew.readyToBottle, "circular stirring");
    for (let i = 0; i < (batch ? 3 : 1); i++) { const b = find("bottle"); drop(b, L.bottleSocket); ck(g.bottleIn === b, "bottle snapped"); const pip = find("pipette"); ck(!!pip, "dropper ready");
      for (let f = 0; f < 40 && g.bottleIn; f++) { pip.obj.position.copy(L.liquid).setY(L.liquid.y - 0.04); g.usePipette(pip, true, 0.1); pip.obj.position.copy(L.bottleSocket).setY(L.bottleSocket.y + 0.2); g.usePipette(pip, true, 0.1); } ck(!g.bottleIn, "dropper filled the bottle"); }
  }
  ck(g.phase === 0, "starts outside the shop");
  g.openShopDoor(); await sleep(200); g.enterShop(); ck(g.phase === 1 && g.firas.shown, "entered, Firas appears");
  ck(g.trader.arrived && g.items.filter(i => i.market).length === 8, "market stall: vendor + 8 ingredients");
  await until(() => g.welcomed);
  const decoy = g.items.find(i => i.market && i.market.key === "m_mush"); drop(decoy, L.basket); ck(g.state.cash === 100 && !decoy.consumed, "wrong ingredient refused, no charge");
  const herb0 = g.items.find(i => i.market && i.market.buy === 0); drop(herb0, L.basket); ck(g.state.cash === 100 && !!g.pay && g.pay.amount === 10, "terminal asks for 10");
  g.tapPay(g.pay.pos, "debit"); ck(g.state.cash === 90 && g.bank.tx.length === 1 && g.bank.tx[0].method === "بطاقة خصم", "tap to pay: debit card, bank statement line");
  for (let i = 0; i < 4; i++) { g.purchase(i); g.purchase(i); }
  ck(g.state.cash === 75 && g.state.inventoryValue === 25, "purchase posted once (100->75)");
  await brew(false); ck(g.phase === 3, "first bottle ready");
  await g.nextChapter(); ck(g.chapter === 1 && g.state.cash === 75, "scene 2, state preserved");
  await until(() => g.customer.arrived);
  g.choosePrice(price); const potion = find("potion"); drop(potion, L.handoff); drop(potion, L.handoff);
  ck(g.state.revenue === price && g.state.cogs === 25, "first sale once");
  g.revenueAnswer(false); ck(g.phase === 6, "revenue quiz retry"); g.revenueAnswer(true);
  await g.nextChapter(); ck(g.chapter === 2, "scene 3 reached");
  await until(() => g.trader.arrived); g.buyBatch(sup); if (herb !== Herb.None) g.decideHerb(herb);
  await brew(true); ck(g.phase === 11, "three bottles filled");
  for (let i = 0; i < 3; i++) { const p = g.items.find(it => it.kind === "potion" && it.index === i && !it.consumed); drop(p, L.handoff); }
  ck(g.phase === 12, "all accepted or discarded");
  g.payExpenses(); g.payExpenses();
  ck(g.state.cash === cash && g.state.netProfit === net && g.state.opex === 10, `branch ${branch} final cash ${g.state.cash}, net ${g.state.netProfit}`);
  ck(g.state.netProfit !== g.state.grossProfit, "quiz answers distinct");
  g.finalAnswer(false); g.finalAnswer(true); ck(g.state.finished && g.state.terms.length === 18, "report + 18 terms"); ck(g.bank.balance === cash && g.bank.tx.length >= 7, "bank balance = final cash, statement filled");
  g.fin.assertReconciles();
  const failed = log.filter(l => l.startsWith("FAIL")).length;
  window.__smoke = { branch, failed, log }; document.title = failed ? `SMOKE FAIL ${branch}` : `SMOKE PASS ${branch}`;
  return window.__smoke;
}
