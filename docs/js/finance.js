// Transaction ledger — a line-for-line port of the tested C# domain (Assets/Capital/Domain).
// Every posting has a stable id, so repeated triggers can never double-post.
export const Supplier = { None: 0, Cheap: 1, Premium: 2 };
export const Herb = { None: 0, Replace: 1, UseWilted: 2 };

export class GameState {
  constructor() {
    this.capital = 100; this.firstPrice = 0; this.reputation = 0; this.chapter = 0;
    this.supplier = Supplier.None; this.herb = Herb.None; this.finished = false;
    this.transactions = []; this.inventory = []; this.terms = [];
  }
  sum(f) { return this.transactions.reduce((a, t) => a + (t[f] || 0), 0); }
  get cash() { return this.capital + this.sum("cash"); }
  get revenue() { return this.sum("revenue"); }
  get cogs() { return this.sum("cogs"); }
  get spoilage() { return this.sum("spoilage"); }
  get opex() { return this.sum("opex"); }
  get purchases() { return -this.transactions.filter(t => t.kind === "purchase").reduce((a, t) => a + t.cash, 0); }
  get inventoryValue() { return this.inventory.filter(i => !i.removed).reduce((a, i) => a + i.cost, 0); }
  get grossProfit() { return this.revenue - this.cogs; }
  get netProfit() { return this.grossProfit - this.spoilage - this.opex; }
  get merchantPrice() { return this.firstPrice === 30 ? 37 : 30; }
  get reputationStars() { return Math.max(1, Math.min(4, 2 + this.reputation)); }
  has(id) { return this.transactions.some(t => t.id === id); }
}

export class Finance {
  constructor(state) { this.s = state; }
  post(t) { if (this.s.has(t.id)) return false; this.s.transactions.push(t); return true; }
  purchaseFirst(i) {
    const costs = [10, 8, 5, 2]; if (i < 0 || i > 3) return false;
    const id = "ingredient-" + i;
    if (this.s.has(id) || this.s.cash < costs[i]) return false;
    this.s.inventory.push({ id, cost: costs[i], crafted: false, removed: false });
    return this.post({ id, kind: "purchase", cash: -costs[i], inventory: costs[i] });
  }
  craftFirst() {
    if (this.s.has("craft-first") || [0, 1, 2, 3].some(i => !this.s.has("ingredient-" + i))) return false;
    for (const lot of this.s.inventory) lot.removed = true;
    this.s.inventory.push({ id: "first", cost: 25, crafted: true, removed: false });
    return this.post({ id: "craft-first", kind: "craft" });
  }
  choosePrice(p) {
    if (this.s.firstPrice !== 0 || !this.s.has("craft-first") || (p !== 30 && p !== 50)) return false;
    this.s.firstPrice = p; if (p === 30) this.s.reputation++;
    return this.post({ id: "price", kind: "decision" });
  }
  sellFirst() { return this.s.firstPrice !== 0 && this.sell("first", this.s.firstPrice); }
  sell(lotId, price) {
    const lot = this.s.inventory.find(i => i.id === lotId);
    if (!lot || lot.removed || !lot.crafted || this.s.has("sale-" + lotId)) return false;
    lot.removed = true;
    return this.post({ id: "sale-" + lotId, kind: "sale", cash: price, revenue: price, cogs: lot.cost, inventory: -lot.cost });
  }
  purchaseBatch(sup) {
    const cost = sup === Supplier.Cheap ? 45 : 60;
    if (!this.s.has("sale-first") || this.s.supplier !== Supplier.None || sup === Supplier.None || this.s.cash < cost) return false;
    this.s.supplier = sup; if (sup === Supplier.Premium) this.s.reputation++;
    for (let i = 0; i < 3; i++) this.s.inventory.push({ id: "batch-" + i, cost: Math.trunc(cost / 3), crafted: false, removed: false });
    return this.post({ id: "batch-purchase", kind: "purchase", cash: -cost, inventory: cost });
  }
  decideHerb(choice) {
    if (this.s.supplier !== Supplier.Cheap || this.s.herb !== Herb.None || choice === Herb.None) return false;
    if (choice === Herb.Replace && this.s.cash < 5) return false;
    this.s.herb = choice;
    if (choice === Herb.Replace) {
      this.s.inventory.find(i => i.id === "batch-2").cost += 5;
      this.post({ id: "replace", kind: "purchase", cash: -5, inventory: 5 });
    } else this.s.reputation--;
    return this.post({ id: "herb", kind: "decision" });
  }
  craftBatchBottle(i) {
    if (i < 0 || i > 2 || this.s.supplier === Supplier.None || (this.s.supplier === Supplier.Cheap && this.s.herb === Herb.None)) return false;
    const lot = this.s.inventory.find(l => l.id === "batch-" + i);
    if (lot.crafted || lot.removed) return false;
    lot.crafted = true;
    return this.post({ id: "craft-batch-" + i, kind: "craft" });
  }
  deliverBatchBottle(i) {
    const id = "batch-" + i, lot = this.s.inventory.find(l => l.id === id);
    if (!lot || !lot.crafted || lot.removed) return false;
    if (i === 2 && this.s.herb === Herb.UseWilted) {
      lot.removed = true;
      return this.post({ id: "reject-" + id, kind: "spoilage", spoilage: lot.cost, inventory: -lot.cost });
    }
    return this.sell(id, this.s.merchantPrice);
  }
  payOperatingExpenses() {
    if (this.s.inventory.some(i => !i.removed) || !this.s.has("batch-purchase")) return false;
    return this.post({ id: "opex", kind: "expense", cash: -10, opex: 10 });
  }
  assertReconciles() {
    const s = this.s;
    if (s.cash !== s.capital + s.revenue - s.purchases - s.opex) throw new Error("Cash reconciliation failed");
    if (s.cash + s.inventoryValue !== s.capital + s.netProfit) throw new Error("Inventory reconciliation failed");
  }
}

export class RecipeProgress {
  constructor() { this.herbInMortar = false; this.crushed = false; this.strokes = 0; this.stirring = 0; this.herb = false; this.crystal = false; this.water = false; }
  add(kind) {
    if (kind === "crushed" && this.crushed && !this.herb) { this.herb = true; return true; }
    if (kind === "crystal" && !this.crystal) { this.crystal = true; return true; }
    if (kind === "water" && !this.water) { this.water = true; return true; }
    return false;
  }
  get readyToStir() { return this.herb && this.crystal && this.water; }
  get readyToBottle() { return this.readyToStir && this.stirring >= 1; }
  crushStroke() { if (this.herbInMortar && !this.crushed) { this.strokes++; this.crushed = this.strokes >= 5; } }
  stir(turns) { if (this.readyToStir) this.stirring = Math.min(1, this.stirring + Math.max(0, turns) / 2); }
}
