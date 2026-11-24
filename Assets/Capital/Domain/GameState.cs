using System;
using System.Collections.Generic;
using System.Linq;

namespace Capital
{
    public enum Supplier { None, Cheap, Premium }
    public enum HerbDecision { None, Replace, UseWilted }
    [Serializable] public sealed class InventoryLot
    {
        public string id;
        public int cost;
        public bool crafted, removed;
        public InventoryLot() { } // required for JsonUtility round-trips (SaveManager)
        public InventoryLot(string id, int cost) { this.id = id; this.cost = cost; }
    }
    [Serializable] public sealed class Transaction
    {
        public string id, kind;
        public int cash, revenue, cogs, spoilage, opex, inventory;
    }
    [Serializable] public sealed class GameState
    {
        public int capital = 100, firstPrice, reputation, chapter;
        public Supplier supplier;
        public HerbDecision herb;
        public bool presentationMode, finished;
        public List<Transaction> transactions = new List<Transaction>();
        public List<InventoryLot> inventory = new List<InventoryLot>();
        public List<int> terms = new List<int>();
        public int Cash => capital + transactions.Sum(t => t.cash);
        public int Revenue => transactions.Sum(t => t.revenue);
        public int COGS => transactions.Sum(t => t.cogs);
        public int Spoilage => transactions.Sum(t => t.spoilage);
        public int OperatingExpenses => transactions.Sum(t => t.opex);
        public int Purchases => -transactions.Where(t => t.kind == "purchase").Sum(t => t.cash);
        public int InventoryValue => inventory.Where(i => !i.removed).Sum(i => i.cost);
        public int GrossProfit => Revenue - COGS;
        public int NetProfit => GrossProfit - Spoilage - OperatingExpenses;
        public int MerchantPrice => firstPrice == 30 ? 37 : 30;
        public bool Has(string id) => transactions.Any(t => t.id == id);
        public int ReputationStars => Math.Max(1, Math.Min(4, 2 + reputation));
    }
}
