using System;
using System.Linq;

namespace Capital
{
    // Every posting has a stable identity. Triggers can retry safely.
    public sealed class FinancialManager
    {
        public readonly GameState State;
        public FinancialManager(GameState state) { State = state; }
        bool Post(Transaction t)
        {
            if (State.Has(t.id)) return false;
            State.transactions.Add(t);
            return true;
        }
        public bool PurchaseFirst(int ingredient)
        {
            int[] costs = { 10, 8, 5, 2 };
            if (ingredient < 0 || ingredient > 3) return false;
            string id = "ingredient-" + ingredient;
            if (State.Has(id) || State.Cash < costs[ingredient]) return false;
            State.inventory.Add(new InventoryLot(id, costs[ingredient]));
            return Post(new Transaction { id = id, kind = "purchase", cash = -costs[ingredient], inventory = costs[ingredient] });
        }
        public bool CraftFirst()
        {
            if (State.Has("craft-first") || Enumerable.Range(0, 4).Any(i => !State.Has("ingredient-" + i))) return false;
            foreach (var lot in State.inventory) lot.removed = true;
            State.inventory.Add(new InventoryLot("first", 25) { crafted = true });
            return Post(new Transaction { id = "craft-first", kind = "craft" });
        }
        public bool ChoosePrice(int price)
        {
            if (State.firstPrice != 0 || !State.Has("craft-first") || (price != 30 && price != 50)) return false;
            State.firstPrice = price;
            if (price == 30) State.reputation++;
            return Post(new Transaction { id = "price", kind = "decision" });
        }
        public bool SellFirst() => State.firstPrice != 0 && Sell("first", State.firstPrice);
        bool Sell(string lotId, int price)
        {
            var lot = State.inventory.FirstOrDefault(i => i.id == lotId);
            if (lot == null || lot.removed || !lot.crafted || State.Has("sale-" + lotId)) return false;
            lot.removed = true;
            return Post(new Transaction { id = "sale-" + lotId, kind = "sale", cash = price, revenue = price, cogs = lot.cost, inventory = -lot.cost });
        }
        public bool PurchaseBatch(Supplier supplier)
        {
            int cost = supplier == Supplier.Cheap ? 45 : 60;
            if (!State.Has("sale-first") || State.supplier != Supplier.None || supplier == Supplier.None || State.Cash < cost) return false;
            State.supplier = supplier;
            if (supplier == Supplier.Premium) State.reputation++;
            for (int i = 0; i < 3; i++) State.inventory.Add(new InventoryLot("batch-" + i, cost / 3));
            return Post(new Transaction { id = "batch-purchase", kind = "purchase", cash = -cost, inventory = cost });
        }
        public bool DecideHerb(HerbDecision choice)
        {
            if (State.supplier != Supplier.Cheap || State.herb != HerbDecision.None || choice == HerbDecision.None) return false;
            if (choice == HerbDecision.Replace && State.Cash < 5) return false;
            State.herb = choice;
            if (choice == HerbDecision.Replace)
            {
                State.inventory.Single(i => i.id == "batch-2").cost += 5;
                Post(new Transaction { id = "replace", kind = "purchase", cash = -5, inventory = 5 });
            }
            else State.reputation--;
            return Post(new Transaction { id = "herb", kind = "decision" });
        }
        public bool CraftBatchBottle(int index)
        {
            if (index < 0 || index > 2 || State.supplier == Supplier.None ||
                (State.supplier == Supplier.Cheap && State.herb == HerbDecision.None)) return false;
            var lot = State.inventory.Single(i => i.id == "batch-" + index);
            if (lot.crafted || lot.removed) return false;
            lot.crafted = true;
            return Post(new Transaction { id = "craft-batch-" + index, kind = "craft" });
        }
        public bool DeliverBatchBottle(int index)
        {
            string id = "batch-" + index;
            var lot = State.inventory.FirstOrDefault(i => i.id == id);
            if (lot == null || !lot.crafted || lot.removed) return false;
            if (index == 2 && State.herb == HerbDecision.UseWilted)
            {
                lot.removed = true;
                return Post(new Transaction { id = "reject-" + id, kind = "spoilage", spoilage = lot.cost, inventory = -lot.cost });
            }
            return Sell(id, State.MerchantPrice);
        }
        public bool PayOperatingExpenses()
        {
            if (State.inventory.Any(i => !i.removed) || !State.Has("batch-purchase")) return false;
            return Post(new Transaction { id = "opex", kind = "expense", cash = -10, opex = 10 });
        }
        public void AssertReconciles()
        {
            if (State.Cash != State.capital + State.Revenue - State.Purchases - State.OperatingExpenses)
                throw new InvalidOperationException("Cash reconciliation failed");
            // NetProfit already includes the operating expense once posted, so this holds before and after.
            if (State.Cash + State.InventoryValue != State.capital + State.NetProfit)
                throw new InvalidOperationException("Inventory reconciliation failed");
        }
    }
    public sealed class RecipeProgress
    {
        public bool herbInMortar, crushed;
        public int strokes;
        public float stirring;
        public bool herb, crystal, water;
        public bool Add(string kind)
        {
            if (kind == "crushed" && crushed && !herb) { herb = true; return true; }
            if (kind == "crystal" && !crystal) { crystal = true; return true; }
            if (kind == "water" && !water) { water = true; return true; }
            return false;
        }
        public bool ReadyToStir => herb && crystal && water;
        public bool ReadyToBottle => ReadyToStir && stirring >= 1;
        public void CrushStroke() { if (herbInMortar && !crushed) { strokes++; crushed = strokes >= 5; } }
        public void Stir(float turns) { if (ReadyToStir) stirring = Math.Min(1, stirring + Math.Max(0, turns) / 2); }
    }
}
