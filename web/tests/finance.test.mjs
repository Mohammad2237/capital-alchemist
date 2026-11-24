// Six-outcome acceptance matrix + idempotency (same rows as the spec). Run: node web/tests/finance.test.mjs
import { GameState, Finance, Supplier, Herb } from "../js/finance.js";
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) failed++; };
const rows = [
  [30, Supplier.Cheap, Herb.Replace, 141, 75, 66, 0, 56, 156, 1],
  [30, Supplier.Cheap, Herb.UseWilted, 104, 55, 49, 15, 24, 124, 0],
  [30, Supplier.Premium, Herb.None, 141, 85, 56, 0, 46, 146, 2],
  [50, Supplier.Cheap, Herb.Replace, 140, 75, 65, 0, 55, 155, 0],
  [50, Supplier.Cheap, Herb.UseWilted, 110, 55, 55, 15, 30, 130, -1],
  [50, Supplier.Premium, Herb.None, 140, 85, 55, 0, 45, 145, 1]];
for (const [price, sup, herb, rev, cogs, gross, spoil, net, cash, rep] of rows) {
  const s = new GameState(), f = new Finance(s);
  for (let i = 0; i < 4; i++) { f.purchaseFirst(i); f.purchaseFirst(i); }
  check(s.cash === 75 && s.inventoryValue === 25, "purchase posted once");
  f.craftFirst(); f.craftFirst(); f.choosePrice(price); f.choosePrice(price); f.sellFirst(); f.sellFirst();
  check(s.revenue === price && s.cogs === 25, "first sale once");
  f.purchaseBatch(sup); f.purchaseBatch(sup);
  if (herb !== Herb.None) { f.decideHerb(herb); f.decideHerb(herb); }
  for (let i = 0; i < 3; i++) { f.craftBatchBottle(i); f.craftBatchBottle(i); f.deliverBatchBottle(i); f.deliverBatchBottle(i); }
  f.payOperatingExpenses(); f.payOperatingExpenses(); f.assertReconciles();
  check(s.revenue === rev && s.cogs === cogs && s.grossProfit === gross && s.spoilage === spoil && s.netProfit === net && s.cash === cash && s.reputation === rep,
    `row ${price}: revenue ${s.revenue} cogs ${s.cogs} gross ${s.grossProfit} spoilage ${s.spoilage} net ${s.netProfit} cash ${s.cash} rep ${s.reputation}`);
  check(s.netProfit !== s.grossProfit, "final quiz answers distinct");
}
const s = new GameState(), f = new Finance(s);
check(!f.choosePrice(30) && !f.purchaseBatch(Supplier.Cheap) && !f.payOperatingExpenses(), "out-of-order actions refused");
console.log(failed ? `FAILED ${failed}` : "ALL PASS");
process.exit(failed ? 1 : 0);
