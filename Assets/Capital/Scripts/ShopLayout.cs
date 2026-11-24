using UnityEngine;
namespace Capital
{
    // Single source of truth for the shop's floor plan (metres, Y up, +Z = into the shop).
    // Interior: x in [-4.5, 4.5], z in [0, 12]. Entrance in the south wall at x = 0.
    // The big cauldron stands in the middle; every station is a short walk around it.
    public static class ShopLayout
    {
        public const float Module = 3f, HalfWidth = 4.5f, Depth = 12f, WallHeight = 3f, TableTop = .9f;

        // Big cauldron (Blender model: rim 0.95 m, inner radius ~0.54 m) over a fire pit.
        public static readonly Vector3 Cauldron = new Vector3(0, 0, 6.2f);
        public const float CauldronInnerRadius = .54f, LiquidHeight = .86f;
        public static Vector3 Liquid => Cauldron + Vector3.up * LiquidHeight;

        // West: ingredient table (runs along Z) with the three ingredients.
        public static readonly Vector3 IngredientTable = new Vector3(-2.75f, 0, 6.2f);
        public static readonly Vector3 HerbSpot = new Vector3(-2.12f, TableTop, 5.45f);
        public static readonly Vector3 CrystalSpot = new Vector3(-2.12f, TableTop, 6.2f);
        public static readonly Vector3 WaterSpot = new Vector3(-2.12f, TableTop, 6.95f);
        public static readonly Vector3 WiltedSpot = new Vector3(-2.2f, TableTop, 4.8f);

        // South-west: mortar on its own work table.
        public static readonly Vector3 MortarTable = new Vector3(-1.85f, 0, 4.2f);
        public static Vector3 Mortar => MortarTable + Vector3.up * (TableTop + .02f);
        public static readonly Vector3 PestleSpot = new Vector3(-1.5f, TableTop, 4.05f);

        // Stirring paddle rests in a rack beside the cauldron.
        public static readonly Vector3 PaddleSpot = new Vector3(1.05f, .02f, 5.25f);

        // East: bottling stand + table of empty bottles.
        public static readonly Vector3 BottlingStand = new Vector3(2.05f, 0, 6.2f);
        public static Vector3 BottleSocket => BottlingStand + Vector3.up * 1.0f;
        public static readonly Vector3 BottleTable = new Vector3(2.75f, 0, 7.6f);
        public static Vector3 EmptyBottle(int i) => new Vector3(2.45f + i * .3f, TableTop, 7.45f);
        public static Vector3 FinishedBottle(int i) => new Vector3(2.45f + i * .3f, TableTop, 7.8f);

        // South-east: sales counter facing the door; the customer stands on the door side.
        public static readonly Vector3 Counter = new Vector3(2.55f, 0, 2.1f);
        public static readonly Vector3 Handoff = new Vector3(2.55f, 1.04f, 2.0f);
        public static readonly Vector3 SaleBottle = new Vector3(1.9f, 1.04f, 2.15f);
        public static readonly Vector3 CoinPile = new Vector3(3.25f, 1.04f, 2.15f);
        public static readonly Vector3 CustomerSpot = new Vector3(2.55f, 0, 1.25f);
        public static Vector3 Display(int i) => new Vector3(3.9f, 1.62f, 3.2f + i * .3f);
        public static readonly Vector3 DiscardBin = new Vector3(3.6f, .35f, .95f);

        // North-west: Firas's crystal pedestal; he projects above it.
        public static readonly Vector3 FirasPedestal = new Vector3(-1.75f, 0, 8.1f);
        public static Vector3 FirasSpot => FirasPedestal + Vector3.up * 1.12f;
        public const float FirasHeight = 1.15f;

        // Door: hinge on the west side of the opening, closed door runs along +X.
        public static readonly Vector3 DoorHinge = new Vector3(-.6f, 0, .02f);

        // Player starts. Scene 1 begins outside; later scenes start inside near the counter.
        public static readonly Vector3 OutsideStart = new Vector3(0, 0, -5.4f);
        public const float OutsideYaw = 0;
        public static readonly Vector3 InsideStart = new Vector3(.6f, 0, 3.4f);
        public const float InsideYaw = 20;
        public static readonly Vector3 CounterStart = new Vector3(2.3f, 0, 3.35f);
        public const float CounterYaw = 180;
        public static bool IsInside(Vector3 p) => p.z > .9f && Mathf.Abs(p.x) < HalfWidth && p.z < Depth;

        // NPC route: outside the door -> through it -> to the counter.
        public static readonly Vector3[] CustomerPath = { new Vector3(0, 0, -2.4f), new Vector3(0, 0, -.6f), new Vector3(.2f, 0, 1.0f), CustomerSpot };
    }
}
