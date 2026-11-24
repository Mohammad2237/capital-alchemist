using NUnit.Framework;

namespace Capital.Tests
{
    public class FinancialTests
    {
        public static GameState Run(int price, Supplier supplier, HerbDecision herb, bool duplicate = false)
        {
            var s = new GameState(); var f = new FinancialManager(s);
            for (int i = 0; i < 4; i++) { Assert.IsTrue(f.PurchaseFirst(i)); Assert.IsFalse(f.PurchaseFirst(i)); }
            Assert.AreEqual(75, s.Cash); Assert.AreEqual(25, s.InventoryValue); Assert.AreEqual(0, s.NetProfit);
            Assert.IsTrue(f.CraftFirst()); Assert.IsFalse(f.CraftFirst());
            f.ChoosePrice(price); f.SellFirst(); Assert.IsFalse(f.SellFirst());
            f.PurchaseBatch(supplier); Assert.IsFalse(f.PurchaseBatch(supplier));
            if (supplier == Supplier.Cheap) { f.DecideHerb(herb); Assert.IsFalse(f.DecideHerb(herb)); }
            for (int i = 0; i < 3; i++) { f.CraftBatchBottle(i); Assert.IsFalse(f.CraftBatchBottle(i)); f.DeliverBatchBottle(i); Assert.IsFalse(f.DeliverBatchBottle(i)); }
            f.PayOperatingExpenses(); Assert.IsFalse(f.PayOperatingExpenses()); f.AssertReconciles(); return s;
        }
        [TestCase(30, Supplier.Cheap, HerbDecision.Replace, 141, 75, 66, 0, 56, 156, 1)]
        [TestCase(30, Supplier.Cheap, HerbDecision.UseWilted, 104, 55, 49, 15, 24, 124, 0)]
        [TestCase(30, Supplier.Premium, HerbDecision.None, 141, 85, 56, 0, 46, 146, 2)]
        [TestCase(50, Supplier.Cheap, HerbDecision.Replace, 140, 75, 65, 0, 55, 155, 0)]
        [TestCase(50, Supplier.Cheap, HerbDecision.UseWilted, 110, 55, 55, 15, 30, 130, -1)]
        [TestCase(50, Supplier.Premium, HerbDecision.None, 140, 85, 55, 0, 45, 145, 1)]
        public void SixOutcomes(int price, Supplier supplier, HerbDecision herb, int revenue, int cogs, int gross, int spoilage, int net, int cash, int rep)
        {
            var s = Run(price, supplier, herb, true);
            Assert.AreEqual(revenue, s.Revenue); Assert.AreEqual(cogs, s.COGS); Assert.AreEqual(gross, s.GrossProfit);
            Assert.AreEqual(spoilage, s.Spoilage); Assert.AreEqual(net, s.NetProfit); Assert.AreEqual(cash, s.Cash);
            Assert.AreEqual(rep, s.reputation); Assert.AreEqual(10, s.OperatingExpenses); Assert.AreEqual(0, s.InventoryValue);
            Assert.AreNotEqual(s.GrossProfit, s.NetProfit); Assert.AreEqual(100 + s.NetProfit, s.Cash);
        }
        [Test] public void SequenceGuards()
        {
            var f = new FinancialManager(new GameState());
            Assert.IsFalse(f.SellFirst()); Assert.IsFalse(f.CraftFirst()); Assert.IsFalse(f.PurchaseBatch(Supplier.Premium));
            Assert.IsFalse(f.PayOperatingExpenses()); Assert.IsFalse(f.ChoosePrice(30));
        }
        [Test] public void WrongIngredientsCannotBrew()
        {
            var r = new RecipeProgress();
            Assert.IsFalse(r.Add("herb")); Assert.IsFalse(r.Add("bottle")); Assert.IsFalse(r.Add("crushed"));
            r.Stir(50); Assert.IsFalse(r.ReadyToBottle);
            r.herbInMortar = true; for (int i = 0; i < 5; i++) r.CrushStroke();
            Assert.IsTrue(r.Add("crushed")); Assert.IsFalse(r.Add("crushed")); r.Add("water"); r.Add("crystal");
            r.Stir(2); Assert.IsTrue(r.ReadyToBottle);
        }
        // Spec 15.2: a purchase subtracts cash once and adds inventory once, even if triggered twice.
        [Test] public void PurchaseIsPostedOnce()
        {
            var s = new GameState(); var f = new FinancialManager(s);
            Assert.IsTrue(f.PurchaseFirst(0)); Assert.IsFalse(f.PurchaseFirst(0));
            Assert.AreEqual(90, s.Cash); Assert.AreEqual(10, s.InventoryValue); Assert.AreEqual(1, s.transactions.Count);
        }
        // Spec 15.3: a sale removes inventory, recognises COGS and revenue exactly once.
        [Test] public void FirstSaleRecognisesRevenueAndCogsOnce()
        {
            var s = new GameState(); var f = new FinancialManager(s);
            for (int i = 0; i < 4; i++) f.PurchaseFirst(i);
            f.CraftFirst(); f.ChoosePrice(50);
            Assert.IsTrue(f.SellFirst()); Assert.IsFalse(f.SellFirst());
            Assert.AreEqual(50, s.Revenue); Assert.AreEqual(25, s.COGS); Assert.AreEqual(25, s.GrossProfit);
            Assert.AreEqual(0, s.InventoryValue); Assert.AreEqual(125, s.Cash);
        }
        // Spec 15.4: the wilted herb rejects exactly one potion, records 15 spoilage, pays for two.
        [TestCase(30)] [TestCase(50)]
        public void WiltedHerbRejectsOneAndPaysForTwo(int price)
        {
            var s = Run(price, Supplier.Cheap, HerbDecision.UseWilted);
            Assert.AreEqual(15, s.Spoilage);
            Assert.AreEqual(2, s.transactions.FindAll(t => t.kind == "sale" && t.id.StartsWith("sale-batch")).Count);
            Assert.IsFalse(s.Has("sale-batch-2")); Assert.IsTrue(s.Has("reject-batch-2"));
            Assert.AreEqual(price + 2 * s.MerchantPrice, s.Revenue);
            Assert.AreEqual(0, s.transactions.Find(t => t.id == "reject-batch-2").cogs, "Spoilage must not be COGS");
            Assert.AreEqual(0, s.transactions.Find(t => t.id == "reject-batch-2").revenue);
        }
        // Spec 15.5: replacing the herb costs exactly 5 extra and all three potions are accepted.
        [Test] public void ReplacingHerbCostsFiveAndAllAccepted()
        {
            var s = Run(30, Supplier.Cheap, HerbDecision.Replace);
            Assert.AreEqual(-5, s.transactions.Find(t => t.id == "replace").cash);
            Assert.AreEqual(50, s.Purchases - 25, "Batch cost should be 45 + 5");
            for (int i = 0; i < 3; i++) Assert.IsTrue(s.Has("sale-batch-" + i));
            Assert.AreEqual(0, s.Spoilage);
        }
        // Spec 15.7: the two final-quiz answers (net vs gross) are distinct in every branch.
        [TestCase(30, Supplier.Cheap, HerbDecision.Replace)]
        [TestCase(30, Supplier.Cheap, HerbDecision.UseWilted)]
        [TestCase(30, Supplier.Premium, HerbDecision.None)]
        [TestCase(50, Supplier.Cheap, HerbDecision.Replace)]
        [TestCase(50, Supplier.Cheap, HerbDecision.UseWilted)]
        [TestCase(50, Supplier.Premium, HerbDecision.None)]
        public void FinalQuizChoicesAreDistinct(int price, Supplier supplier, HerbDecision herb)
        {
            var s = Run(price, supplier, herb);
            Assert.AreNotEqual(s.NetProfit, s.GrossProfit);
            Assert.AreEqual(s.GrossProfit - s.NetProfit, s.OperatingExpenses + s.Spoilage);
        }
        // Spec 15.9: the persisted snapshot keeps cash, decisions and glossary unlocks.
        [Test] public void StateSurvivesSerialisation()
        {
            var s = Run(50, Supplier.Cheap, HerbDecision.UseWilted);
            s.terms.AddRange(new[] { 0, 1, 2, 9 });
            var copy = UnityEngine.JsonUtility.FromJson<GameState>(UnityEngine.JsonUtility.ToJson(s));
            Assert.AreEqual(s.Cash, copy.Cash); Assert.AreEqual(s.NetProfit, copy.NetProfit);
            Assert.AreEqual(s.firstPrice, copy.firstPrice); Assert.AreEqual(s.supplier, copy.supplier);
            Assert.AreEqual(s.herb, copy.herb); Assert.AreEqual(s.reputation, copy.reputation);
            CollectionAssert.AreEqual(s.terms, copy.terms);
        }
        // Guards: invalid prices, unaffordable purchases and premature decisions are refused.
        [Test] public void InvalidChoicesAreRefused()
        {
            var poor = new FinancialManager(new GameState { capital = 9 });
            Assert.IsFalse(poor.PurchaseFirst(0)); Assert.IsFalse(poor.PurchaseFirst(7));
            var s = new GameState(); var f = new FinancialManager(s);
            for (int i = 0; i < 4; i++) f.PurchaseFirst(i);
            f.CraftFirst();
            Assert.IsFalse(f.ChoosePrice(40)); Assert.IsFalse(f.DecideHerb(HerbDecision.Replace));
            Assert.IsTrue(f.ChoosePrice(30)); Assert.IsFalse(f.ChoosePrice(50));
            f.SellFirst(); f.PurchaseBatch(Supplier.Premium);
            Assert.IsFalse(f.DecideHerb(HerbDecision.UseWilted), "Herb decision only exists for the cheap supplier");
            Assert.IsFalse(f.PayOperatingExpenses(), "Opex waits until all inventory is sold or discarded");
        }
        [Test] public void ResetStateIsClean()
        {
            var s = new GameState(); Assert.AreEqual(100, s.Cash); Assert.IsEmpty(s.terms);
            Assert.AreEqual(0,s.firstPrice); Assert.AreEqual(Supplier.None,s.supplier); Assert.IsEmpty(s.transactions);
        }
    }
}
