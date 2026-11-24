using System.Collections.Generic;
using System.Linq;
using Capital;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

// Deterministic set-dressing of the shared shop prefab from KayKit (CC0) and Blender-built models.
// Every model is placed by its measured bounds (base-centre at the requested point, scaled to a
// requested real-world size), so importer unit/pivot differences cannot shift the layout.
public static class ShopDressing
{
    const string K = "Assets/ThirdParty/KayKit/", D = K + "Dungeon/", F = K + "Furniture/", R = K + "Restaurant/", H = K + "Halloween/", C = K + "Characters/";
    const string M = "Assets/Capital/Models/Custom/", RM = "Assets/Capital/Resources/Models/";
    static Transform root;
    static System.Random rng;
    static readonly Color Shingle = new Color(.32f, .14f, .09f), Meadow = new Color(.17f, .22f, .1f);

    // Transparent materials must exist as assets so the build keeps their shader variant.
    public static void SaveRuntimeMaterials()
    {
        System.IO.Directory.CreateDirectory("Assets/Capital/Resources/Materials");
        const string path = "Assets/Capital/Resources/Materials/Steam.mat";
        if (!AssetDatabase.LoadAssetAtPath<Material>(path))
            AssetDatabase.CreateAsset(new Material(ShopArt.Transparent("Steam", new Color(.8f, .86f, .84f, .1f), .25f, 0)), path);
        const string fader = "Assets/Capital/Resources/Materials/Fader.mat";
        if (!AssetDatabase.LoadAssetAtPath<Material>(fader))
            AssetDatabase.CreateAsset(new Material(ShopArt.Transparent("Fader", new Color(0, 0, 0, 0), 0, 0)), fader);
    }

    public static GameObject Build()
    {
        SaveRuntimeMaterials();
        rng = new System.Random(20261126);
        var go = new GameObject("Alchemy Shop"); root = go.transform;
        Architecture(); Roof(); Ceiling(); Exterior(); Centre(); Stations(); WallDressing(); Corners();
        return go;
    }

    // ------------------------------------------------------------------ placement helpers
    public static Bounds BoundsOf(GameObject go)
    {
        var rs = go.GetComponentsInChildren<Renderer>(); var b = new Bounds(go.transform.position, Vector3.zero);
        for (int i = 0; i < rs.Length; i++) { if (i == 0) b = rs[i].bounds; else b.Encapsulate(rs[i].bounds); }
        return b;
    }

    public static GameObject Place(string path, Vector3 at, float yaw = 0, float height = 0, float width = 0, float scale = 0, bool collider = false, string name = null, bool alignTop = false, Transform parent = null)
    {
        var asset = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (!asset) { Debug.LogWarning("CAPITAL missing model " + path); return null; }
        var go = (GameObject)PrefabUtility.InstantiatePrefab(asset);
        go.transform.SetParent(parent ? parent : root, true);
        if (name != null) go.name = name;
        go.transform.rotation = Quaternion.Euler(0, yaw, 0); go.transform.localScale = Vector3.one; go.transform.position = Vector3.zero;
        var b = BoundsOf(go);
        float s = scale > 0 ? scale : height > 0 && b.size.y > 1e-4f ? height / b.size.y : width > 0 ? width / Mathf.Max(b.size.x, b.size.z, 1e-4f) : 1;
        go.transform.localScale = Vector3.one * s;
        b = BoundsOf(go);
        float y = alignTop ? at.y - b.max.y : at.y - b.min.y;
        go.transform.position += new Vector3(at.x - b.center.x, y, at.z - b.center.z);
        if (collider) AddBox(go);
        return go;
    }

    static void AddBox(GameObject go)
    {
        var b = BoundsOf(go); var c = go.AddComponent<BoxCollider>();
        c.center = go.transform.InverseTransformPoint(b.center);
        var s = go.transform.InverseTransformVector(b.size); c.size = new Vector3(Mathf.Abs(s.x), Mathf.Abs(s.y), Mathf.Abs(s.z));
    }

    static GameObject Box(string name, Vector3 centre, Vector3 size, Color color, bool collider = false, float yaw = 0)
    {
        var g = ShopArt.Primitive(name, PrimitiveType.Cube, root, centre, size, color, collider);
        g.transform.localRotation = Quaternion.Euler(0, yaw, 0);
        return g;
    }

    static GameObject BlockCollider(string name, Vector3 centre, Vector3 size)
    {
        var g = new GameObject(name); g.transform.SetParent(root, false); g.transform.localPosition = centre;
        g.AddComponent<BoxCollider>().size = size; return g;
    }

    static float R01() => (float)rng.NextDouble();
    static T Pick<T>(IList<T> list) => list[rng.Next(list.Count)];

    // ------------------------------------------------------------------ building shell
    static void Architecture()
    {
        // Walkable ground: one big collider under everything (player controller + teleport target).
        BlockCollider("Walk floor", new Vector3(0, -.05f, 2), new Vector3(60, .1f, 60)).layer = 0;
        Box("Meadow", new Vector3(0, -.08f, -10), new Vector3(140, .1f, 120), Meadow);
        // Invisible boundary so nobody wanders off into the meadow.
        BlockCollider("Bound south", new Vector3(0, 1.5f, -9.6f), new Vector3(26, 3, .4f));
        BlockCollider("Bound west", new Vector3(-11, 1.5f, 2), new Vector3(.4f, 3, 24));
        BlockCollider("Bound east", new Vector3(11, 1.5f, 2), new Vector3(.4f, 3, 24));
        BlockCollider("Bound north", new Vector3(0, 1.5f, 13.6f), new Vector3(26, 3, .4f));
        for (int ix = -1; ix <= 1; ix++) for (int iz = 0; iz < 4; iz++)
            Place(D + "floor_wood_large.fbx", new Vector3(ix * 3, 0, 1.5f + iz * 3), (ix + iz) % 2 == 0 ? 0 : 90, width: 3.02f, alignTop: true, name: "Oak floor");
        for (int ix = -3; ix <= 3; ix++) for (int iz = 0; iz < 3; iz++)
            Place(D + "floor_tile_large.fbx", new Vector3(ix * 3, -.005f, -1.9f - iz * 3), 0, width: 3.02f, alignTop: true, name: "Street stone");

        // South wall (z=0): window | entrance | plain. Colliders leave the doorway open.
        Place(D + "wall_window_open.fbx", new Vector3(-3, 0, 0), 0, height: 3, collider: true, name: "South wall window");
        Place(M + "entrance_wall.fbx", new Vector3(0, 0, 0), 0, scale: 1, name: "Entrance wall");
        BlockCollider("Entrance jamb L", new Vector3(-1.075f, 1.5f, 0), new Vector3(.85f, 3, .75f));
        BlockCollider("Entrance jamb R", new Vector3(1.075f, 1.5f, 0), new Vector3(.85f, 3, .75f));
        BlockCollider("Entrance lintel", new Vector3(0, 2.68f, 0), new Vector3(1.3f, .65f, .75f));
        Place(D + "wall.fbx", new Vector3(3, 0, 0), 0, height: 3, collider: true, name: "South wall");
        // North wall (z=12): built-in shelves in the middle.
        Place(D + "wall.fbx", new Vector3(-3, 0, 12), 180, height: 3, collider: true, name: "North wall");
        Place(D + "wall_shelves.fbx", new Vector3(0, 0, 11.85f), 180, height: 3, collider: true, name: "North shelving wall");
        Place(D + "wall.fbx", new Vector3(3, 0, 12), 180, height: 3, collider: true, name: "North wall");
        string[] east = { "wall", "wall_window_open", "wall", "wall" }, west = { "wall", "wall", "wall_archedwindow_open", "wall" };
        for (int i = 0; i < 4; i++)
        {
            Place(D + east[i] + ".fbx", new Vector3(4.5f, 0, 1.5f + i * 3), 90, height: 3, collider: true, name: "East " + east[i]);
            Place(D + west[i] + ".fbx", new Vector3(-4.5f, 0, 1.5f + i * 3), 90, height: 3, collider: true, name: "West " + west[i]);
        }
        foreach (var p in new[] { new Vector3(-4.5f, 0, 0), new Vector3(4.5f, 0, 0), new Vector3(-4.5f, 0, 12), new Vector3(4.5f, 0, 12) })
            Place(D + "pillar.fbx", p, 0, height: 3.15f, collider: true, name: "Corner pillar");

        // Door leaf on its hinge (ShopFx swings "Door hinge").
        var hinge = new GameObject("Door hinge").transform; hinge.SetParent(root, false); hinge.position = ShopLayout.DoorHinge;
        var door = Place(M + "shop_door.fbx", ShopLayout.DoorHinge + new Vector3(.6f, 0, 0), 0, scale: 1, name: "Shop door", parent: hinge);
        if (door) AddBox(door);
    }

    static void Roof()
    {
        float half = 4.9f, rise = 2.4f, angle = Mathf.Atan2(rise, half) * Mathf.Rad2Deg, slope = Mathf.Sqrt(half * half + rise * rise);
        foreach (int side in new[] { -1, 1 })
        {
            var slab = Box("Roof shingles", new Vector3(side * half / 2, 3 + rise / 2 + .08f, 6), new Vector3(slope + .7f, .16f, 13.2f), Shingle);
            slab.transform.localRotation = Quaternion.Euler(0, 0, -side * angle);
            for (int i = 0; i < 9; i++)
            {
                var row = Box("Shingle row", Vector3.zero, new Vector3(.08f, .05f, 13.2f), Shingle * .8f);
                row.transform.SetParent(slab.transform, true);
                row.transform.localPosition = new Vector3(-.5f + i / 8f, .6f, 0); row.transform.localRotation = Quaternion.identity;
                row.transform.localScale = new Vector3(.012f, .5f, 1);
            }
        }
        Box("Roof ridge", new Vector3(0, 3 + rise + .15f, 6), new Vector3(.3f, .25f, 13.4f), ShopArt.DarkWood);
        foreach (float z in new[] { 0f, 12f })
            ShopArt.Gable("Gable", root, new Vector3(0, 3, z), half, rise, .7f, new Color(.42f, .36f, .3f));
        Place(H + "lantern_hanging.fbx", new Vector3(0, 4.3f, -.45f), 0, height: .55f, name: "Gable lantern");
    }

    static void Ceiling()
    {
        Box("Ceiling planks", new Vector3(0, 3.06f, 6), new Vector3(9.1f, .1f, 12.1f), ShopArt.DarkWood);
        for (int i = 0; i < 8; i++) Box("Ceiling beam", new Vector3(0, 2.86f, .9f + i * 1.5f), new Vector3(9, .24f, .2f), ShopArt.Wood);
        foreach (float x in new[] { -2.1f, 2.1f }) Box("Long beam", new Vector3(x, 2.66f, 6), new Vector3(.2f, .2f, 12), ShopArt.Wood * 1.1f);
        // Drying herbs hang from the beams (kept clear of the cauldron steam and the door).
        int n = 0;
        foreach (float x in new[] { -3.4f, -2.7f, -1.4f, 1.4f, 2.7f, 3.4f })
            foreach (float z in new[] { 2.4f, 3.9f, 8.4f, 9.9f })
            {
                if ((n++ % 3) == 2) continue;
                Place(M + (n % 2 == 0 ? "hanging_herbs_lavender.fbx" : "hanging_herbs_green.fbx"), new Vector3(x + (R01() - .5f) * .2f, 2.74f, z), R01() * 360, scale: .9f + R01() * .3f, alignTop: true, name: "Drying herbs");
            }
        foreach (float x in new[] { -1.5f, 1.5f })
        {
            Place(H + "lantern_hanging.fbx", new Vector3(x, 2.74f, ShopLayout.Cauldron.z - 1.6f), 0, height: .55f, alignTop: true, name: "Hanging lantern");
            ShopArt.Light(root, new Vector3(x, 2.05f, ShopLayout.Cauldron.z - 1.6f), new Color(1, .66f, .32f), 1.1f, 4.5f, "Lantern light");
        }
    }

    // ------------------------------------------------------------------ outside: a small street at dusk
    static void Exterior()
    {
        Place(M + "shop_sign.fbx", new Vector3(0, 2.62f, -.5f), 0, scale: 1, name: "Shop sign");
        foreach (int s in new[] { -1, 1 })
        {
            Place(H + "post_lantern.fbx", new Vector3(s * 1.75f, 0, -1.15f), 0, height: 2.4f, collider: true, name: "Street lantern");
            ShopArt.Light(root, new Vector3(s * 1.75f, 2.1f, -1.3f), new Color(1, .62f, .28f), 1.6f, 6, "Street lantern light");
            Place(H + "pumpkin_orange_small.fbx", new Vector3(s * 1.05f, 0, -.75f), R01() * 360, height: .28f, name: "Pumpkin");
        }
        Place(D + "barrel_large.fbx", new Vector3(-2.4f, 0, -.95f), 20, height: 1.0f, collider: true, name: "Rain barrel");
        Place(D + "barrel_small_stack.fbx", new Vector3(-3.3f, 0, -.9f), 0, height: 1.05f, collider: true, name: "Barrel stack");
        Place(D + "crates_stacked.fbx", new Vector3(3.3f, 0, -1.0f), 10, height: 1.2f, collider: true, name: "Crates");
        Place(H + "bench.fbx", new Vector3(2.3f, 0, -1.35f), 0, height: .5f, collider: true, name: "Bench");
        Place(H + "lantern_standing.fbx", new Vector3(-1.3f, 0, -1.6f), 0, height: .55f, name: "Lantern");
        // A small village lane: neighbours across the street and beside the shop, a market stall, a well,
        // a windmill and hills on the horizon (KayKit Medieval Hexagon, CC0).
        const string T = K + "Town/";
        var street = new[] {
            ("building_home_A_red", -7.2f, -10.2f, 180f, 5.2f), ("building_tavern_red", -1.2f, -11.0f, 180f, 6.2f),
            ("building_home_B_yellow", 4.6f, -10.4f, 180f, 5.0f), ("building_blacksmith_green", 9.8f, -9.4f, 200f, 5.0f),
            ("building_home_A_blue", -9.6f, 3.2f, 90f, 5.0f), ("building_home_B_green", 9.6f, 2.6f, -90f, 5.0f) };
        foreach (var (m, x, z, yaw, h) in street) Place(T + m + ".fbx", new Vector3(x, 0, z), yaw, height: h, collider: true, name: "Neighbour " + m);
        Place(T + "building_market_yellow.fbx", new Vector3(5.6f, 0, -5.0f), -25, height: 3.0f, collider: true, name: "Market stall");
        Place(T + "sack.fbx", new Vector3(4.2f, 0, -4.3f), 30, height: .55f, name: "Sack");
        Place(T + "sack.fbx", new Vector3(4.55f, 0, -4.0f), 75, height: .5f, name: "Sack");
        Place(T + "crate_open.fbx", new Vector3(6.9f, 0, -3.9f), 10, height: .6f, collider: true, name: "Produce crate");
        Place(T + "wheelbarrow.fbx", new Vector3(-5.6f, 0, -3.4f), 120, height: .8f, collider: true, name: "Wheelbarrow");
        Place(T + "building_well_blue.fbx", new Vector3(-5.2f, 0, -6.4f), 0, height: 2.4f, collider: true, name: "Well");
        Place(T + "tent.fbx", new Vector3(-9.0f, 0, -5.6f), 60, height: 2.4f, collider: true, name: "Trader tent");
        Place(T + "building_windmill_red.fbx", new Vector3(-16f, 0, -22f), 160, height: 11f, name: "Windmill");
        Place(T + "hills_B_trees.fbx", new Vector3(14f, 0, -26f), 0, width: 22f, name: "Hills");
        Place(T + "mountain_A_grass_trees.fbx", new Vector3(-2f, 0, -40f), 0, width: 34f, name: "Mountains");
        Place(T + "hills_B_trees.fbx", new Vector3(-26f, 0, -14f), 90, width: 20f, name: "Hills");
        foreach (var (x, y, z) in new[] { (-10f, 13f, -24f), (8f, 15f, -30f), (20f, 12f, -10f) })
            Place(T + "cloud_big.fbx", new Vector3(x, y, z), R01() * 360, width: 7f, name: "Cloud");
        var trees = new[] { (-7.6f, -2.6f), (7.8f, -1.8f), (-6.4f, 6.5f), (7f, 7.5f), (-6.8f, 10.5f), (6.6f, 11.5f), (12f, -6f), (-12.5f, -8f) };
        foreach (var (x, z) in trees)
            Place(H + (R01() > .5f ? "tree_pine_yellow_large.fbx" : "tree_pine_orange_medium.fbx"), new Vector3(x, 0, z), R01() * 360, height: 4.5f + R01() * 2, collider: true, name: "Tree");
        for (int i = 0; i < 5; i++) Place(H + Pick(new[] { "path_A", "path_B", "path_C", "path_D" }) + ".fbx", new Vector3((R01() - .5f) * .3f, .01f, -1.6f - i * 1.4f), R01() * 360, width: 1.1f, name: "Path stone");
    }

    // ------------------------------------------------------------------ the big cauldron at the centre
    static void Centre()
    {
        var c = ShopLayout.Cauldron;
        Place(M + "fire_pit.fbx", c, 0, scale: 1, name: "Fire pit");
        Place(M + "cauldron_big.fbx", c + Vector3.up * .01f, 0, scale: 1, collider: true, name: "Great cauldron");
        var liquid = ShopArt.Primitive("Cauldron liquid", PrimitiveType.Cylinder, root, ShopLayout.Liquid, new Vector3(1.08f, .012f, 1.08f), new Color(.08f, .2f, .14f), false);
        var lm = ShopArt.Material("Cauldron brew", new Color(.08f, .2f, .14f), true); liquid.GetComponent<Renderer>().sharedMaterial = lm;
        for (int i = 0; i < 7; i++)
        {
            float a = i * Mathf.PI * 2 / 7;
            var f = ShopArt.Primitive("Fire Flame", PrimitiveType.Sphere, root, c + new Vector3(Mathf.Cos(a) * .32f, .18f + (i % 2) * .06f, Mathf.Sin(a) * .32f), new Vector3(.16f, .38f, .16f), new Color(1, .32f, .05f), false);
            f.AddComponent<FlameIdle>();
        }
        var fire = ShopArt.Light(root, c + new Vector3(0, .45f, 0), new Color(1, .45f, .15f), 3.2f, 9, "Fire light");
        fire.gameObject.AddComponent<LightFlicker>();
        // Paddle rests in a small barrel; the runtime spawns the grabbable paddle into it.
        Place(D + "barrel_small.fbx", ShopLayout.PaddleSpot, 0, height: .6f, name: "Paddle barrel");
        Place(D + "stool.fbx", c + new Vector3(-1.15f, 0, 1.0f), 30, height: .5f, collider: true, name: "Stool");
    }

    // ------------------------------------------------------------------ work stations around the cauldron
    static void Stations()
    {
        float top = ShopLayout.TableTop;
        // Ingredient table (west).
        var t = ShopLayout.IngredientTable;
        Place(D + "table_long.fbx", t, 0, height: top, collider: true, name: "Ingredient table");
        Place(R + "jar_B_large.fbx", new Vector3(t.x - .55f, top, t.z - 1.3f), 0, height: .38f, name: "Jar");
        Place(R + "jar_C_medium.fbx", new Vector3(t.x - .6f, top, t.z - .75f), 40, height: .3f, name: "Jar");
        Place(R + "jar_D_small.fbx", new Vector3(t.x - .5f, top, t.z + .55f), 10, height: .22f, name: "Jar");
        Place(R + "jar_A_medium.fbx", new Vector3(t.x - .6f, top, t.z + 1.25f), 0, height: .3f, name: "Jar");
        Place(C + "spellbook_open.fbx", new Vector3(t.x - .35f, top, t.z + .05f), 90, width: .42f, name: "Recipe book");
        Place(R + "cuttingboard.fbx", new Vector3(t.x - .3f, top, t.z - .1f - 1.0f), 90, width: .45f, name: "Cutting board");
        Place(R + "knife.fbx", new Vector3(t.x - .3f, top + .025f, t.z - 1.1f), 75, width: .26f, name: "Knife");
        Place(D + "candle_lit.fbx", new Vector3(t.x - .65f, top, t.z + 1.65f), 0, height: .3f, name: "Candle");
        Place(R + "crate_carrots.fbx", new Vector3(t.x - .2f, 0, t.z - 1.4f), 15, height: .45f, name: "Root crate");
        Place(R + "crate_onions.fbx", new Vector3(t.x - .3f, 0, t.z + 1.3f), -10, height: .45f, name: "Root crate");
        Place(M + "parchment_board.fbx", new Vector3(-4.06f, 1.35f, t.z), 90, scale: 1, name: "Recipe board");

        // Mortar table (south-west).
        Place(D + "table_small.fbx", ShopLayout.MortarTable, 0, height: top, collider: true, name: "Mortar table");
        Place(M + "mortar.fbx", new Vector3(ShopLayout.Mortar.x, top, ShopLayout.Mortar.z), 0, scale: 1, name: "Stone mortar");
        Place(D + "candle_thin_lit.fbx", ShopLayout.MortarTable + new Vector3(-.3f, top, .28f), 0, height: .32f, name: "Candle");
        Place(F + "book_single.fbx", ShopLayout.MortarTable + new Vector3(.25f, top, .3f), 70, width: .26f, name: "Notebook");

        // Bottling stand + bottle table (east).
        Place(M + "bottling_stand.fbx", ShopLayout.BottlingStand, 0, scale: 1, collider: true, name: "Bottling stand");
        Place(D + "table_medium_tablecloth.fbx", ShopLayout.BottleTable, 0, height: top, collider: true, name: "Bottle table");
        Place(D + "candle_triple.fbx", ShopLayout.BottleTable + new Vector3(.55f, top, .45f), 0, height: .32f, name: "Candles");
        Place(D + "box_small.fbx", ShopLayout.BottleTable + new Vector3(-.5f, top, .5f), 25, height: .2f, name: "Cork box");

        // Sales counter (south-east) with tray, ledger and the shop's coin chest.
        Place(M + "sales_counter.fbx", ShopLayout.Counter, 0, scale: 1, collider: true, name: "Sales counter");
        Place(D + "plate.fbx", ShopLayout.Handoff, 0, width: .42f, name: "Receiving tray");
        Place(F + "book_single.fbx", new Vector3(3.3f, 1.04f, 2.3f), 15, width: .3f, name: "Ledger");
        Place(D + "candle_triple.fbx", new Vector3(1.6f, 1.04f, 2.3f), 0, height: .3f, name: "Counter candles");
        Place(D + "chest_gold.fbx", new Vector3(3.55f, 0, 3.0f), -90, height: .6f, collider: true, name: "Coin chest");
        Place(F + "rug_rectangle_A.fbx", new Vector3(1.9f, .005f, 1.0f), 0, width: 2.4f, name: "Rug");
        Place(F + "rug_oval_A.fbx", new Vector3(.4f, .005f, 3.5f), 0, width: 2.0f, name: "Rug");
        Place(M + "parchment_board.fbx", new Vector3(4.06f, 1.35f, 1.15f), -90, scale: .7f, name: "Market board");
        // Display shelf for finished potions behind the counter.
        WallShelf(new Vector3(3.92f, 0, 3.3f), -90, 1.8f, new[] { 1.6f, 2.2f }, fillLevels: new[] { false, true });

        // Firas's crystal pedestal (north-west), ringed by melted candles.
        Place(M + "firas_pedestal.fbx", ShopLayout.FirasPedestal, 0, scale: 1, collider: true, name: "Firas pedestal");
        Place(M + "firas_crystal.fbx", ShopLayout.FirasPedestal + new Vector3(0, .99f, 0), 0, scale: 1, name: "Firas Crystal");
        ShopArt.Light(root, ShopLayout.FirasPedestal + new Vector3(0, 1.4f, 0), new Color(.25f, 1, .85f), .9f, 3.2f, "Crystal light");
        for (int i = 0; i < 4; i++)
        {
            float a = i * Mathf.PI / 2 + .4f;
            Place(D + "candle_melted.fbx", ShopLayout.FirasPedestal + new Vector3(Mathf.Cos(a) * .55f, 0, Mathf.Sin(a) * .55f), R01() * 360, height: .22f, name: "Melted candle");
        }
    }

    // ------------------------------------------------------------------ shelves full of jars, potions and books
    static readonly string[] ShelfItems = { "bottle_A_green", "bottle_B_green", "bottle_C_green", "bottle_A_brown", "bottle_B_brown", "bottle_C_brown", "bottle_A_labeled_green", "bottle_A_labeled_brown" };
    static readonly string[] JarItems = { "jar_A_small", "jar_B_small", "jar_C_small", "jar_D_small", "jar_A_medium", "jar_C_medium" };
    static readonly Color[] Glow = { new Color(.2f, .95f, .45f), new Color(.95f, .35f, .2f), new Color(.6f, .3f, 1f), new Color(.25f, .7f, 1f), new Color(1f, .8f, .25f) };

    static void WallShelf(Vector3 at, float yaw, float length, float[] levels, bool[] fillLevels = null)
    {
        var rot = Quaternion.Euler(0, yaw, 0); Vector3 along = rot * Vector3.right, outward = rot * Vector3.forward;
        for (int l = 0; l < levels.Length; l++)
        {
            float y = levels[l];
            var plank = Box("Shelf plank", at + Vector3.up * (y - .03f) + outward * .17f, new Vector3(length, .05f, .34f), ShopArt.Wood, false, yaw);
            foreach (int s in new[] { -1, 1 }) Box("Shelf bracket", at + along * s * (length / 2 - .12f) + Vector3.up * (y - .16f) + outward * .1f, new Vector3(.05f, .24f, .2f), ShopArt.DarkWood, false, yaw);
            if (fillLevels != null && !fillLevels[l]) continue;
            float x = -length / 2 + .12f;
            while (x < length / 2 - .12f)
            {
                var p = at + along * x + Vector3.up * y + outward * (.15f + R01() * .06f);
                float r = R01();
                float used;
                if (r < .32f) { Place(D + Pick(ShelfItems) + ".fbx", p, R01() * 360, height: .2f + R01() * .1f, name: "Shelf bottle"); used = .14f; }
                else if (r < .55f) { Place(R + Pick(JarItems) + ".fbx", p, R01() * 360, height: .18f + R01() * .1f, name: "Shelf jar"); used = .17f; }
                else if (r < .8f) { GlowPotion(p, Pick(Glow)); used = .13f; }
                else if (r < .93f) { Place(F + "book_set.fbx", p, yaw + 180, height: .26f, name: "Books"); used = .36f; }
                else { Place(D + "candle_melted.fbx", p, 0, height: .16f, name: "Shelf candle"); used = .1f; }
                x += used + .03f + R01() * .05f;
            }
        }
    }

    static void GlowPotion(Vector3 at, Color color)
    {
        var b = Place(RM + "potion_bottle.fbx", at, R01() * 360, height: .18f + R01() * .08f, name: "Glowing potion");
        if (!b) return;
        var liquid = ShopArt.Primitive("Potion Glow", PrimitiveType.Sphere, b.transform, Vector3.zero, Vector3.one, color, false);
        liquid.GetComponent<Renderer>().sharedMaterial = ShopArt.Material("Shelf potion Glow", color, true);
        var bb = BoundsOf(b); liquid.transform.position = new Vector3(bb.center.x, bb.min.y + bb.size.y * .3f, bb.center.z);
        liquid.transform.localScale = Vector3.one * .085f / b.transform.localScale.x;
    }

    static void WallDressing()
    {
        // West wall: tall shelves either side of the recipe board, plus a reading corner.
        WallShelf(new Vector3(-3.92f, 0, 9.9f), 90, 2.2f, new[] { 1.05f, 1.55f, 2.05f });
        WallShelf(new Vector3(-3.92f, 0, 2.9f), 90, 1.8f, new[] { 1.3f, 1.85f });
        // East wall: shelves past the window.
        WallShelf(new Vector3(3.92f, 0, 9.9f), -90, 2.2f, new[] { 1.05f, 1.55f, 2.05f });
        WallShelf(new Vector3(3.92f, 0, 6.9f), -90, 1.4f, new[] { 1.45f, 1.95f });
        // South wall interior, right of the door.
        WallShelf(new Vector3(3.0f, 0, .42f), 0, 1.8f, new[] { 1.4f, 1.95f });
        // Torches with warm light.
        var torches = new[] { (new Vector3(-4.02f, 1.7f, 4.6f), 90f), (new Vector3(-4.02f, 1.7f, 8.4f), 90f), (new Vector3(4.02f, 1.7f, 8.4f), -90f), (new Vector3(4.02f, 1.7f, 5.4f), -90f), (new Vector3(-1.7f, 1.7f, 11.55f), 180f), (new Vector3(1.7f, 1.7f, 11.55f), 180f) };
        foreach (var (p, yaw) in torches)
        {
            Place(D + "torch_mounted.fbx", p, yaw, height: .55f, name: "Wall torch");
            var l = ShopArt.Light(root, p + Quaternion.Euler(0, yaw, 0) * Vector3.forward * .3f + Vector3.up * .5f, new Color(1, .55f, .22f), 1.3f, 4.5f, "Torch light");
            l.gameObject.AddComponent<LightFlicker>();
        }
        // Banners and the late master's portrait.
        Place(D + "banner_patternA_red.fbx", new Vector3(-3.1f, .7f, 11.5f), 180, height: 1.9f, name: "Banner");
        Place(D + "banner_patternC_green.fbx", new Vector3(3.1f, .7f, 11.5f), 180, height: 1.9f, name: "Banner");
        Place(F + "pictureframe_large_A.fbx", new Vector3(-4.05f, 1.25f, 7.3f), 90, height: .9f, name: "Portrait of the late master");
    }

    static void Corners()
    {
        Place(D + "barrel_large.fbx", new Vector3(3.6f, 0, 11.3f), 10, height: 1.0f, collider: true, name: "Barrel");
        Place(D + "barrel_large.fbx", new Vector3(2.75f, 0, 11.45f), 70, height: .95f, collider: true, name: "Barrel");
        Place(D + "barrel_small_stack.fbx", new Vector3(3.7f, 0, 10.45f), 0, height: 1.0f, collider: true, name: "Barrel stack");
        Place(D + "keg_decorated.fbx", new Vector3(1.9f, 0, 11.4f), 0, height: .75f, collider: true, name: "Keg");
        Place(D + "crates_stacked.fbx", new Vector3(-3.55f, 0, 11.25f), -15, height: 1.3f, collider: true, name: "Crates");
        Place(R + "crate_potatoes.fbx", new Vector3(-2.55f, 0, 11.45f), 5, height: .45f, collider: true, name: "Crate");
        Place(D + "trunk_medium_A.fbx", new Vector3(-1.6f, 0, 11.4f), 180, height: .55f, collider: true, name: "Trunk");
        Place(F + "cabinet_medium_decorated.fbx", new Vector3(-3.75f, 0, 1.0f), 90, height: 1.5f, collider: true, name: "Cabinet");
        Place(F + "armchair.fbx", new Vector3(-3.3f, 0, 5.0f + 0f), 90, height: .9f, collider: true, name: "Armchair");
        Place(D + "box_stacked.fbx", new Vector3(3.75f, 0, 5.0f), 0, height: .8f, collider: true, name: "Boxes");
        Place(D + "chest.fbx", new Vector3(-1.3f, 0, 11.45f + 0f), 180, height: .55f, collider: true, name: "Chest");
    }

    // ------------------------------------------------------------------ characters
    public static GameObject Character(string fbx, float height, Vector3 at, float yaw, string controller, bool hologram = false)
    {
        var path = C + fbx + ".fbx";
        var asset = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (!asset) { Debug.LogWarning("CAPITAL missing character " + path); return null; }
        // KayKit characters import facing -Z; a holder keeps gameplay "forward" = +Z for walking/facing code.
        var holder = new GameObject(controller).transform; holder.position = at; holder.rotation = Quaternion.Euler(0, yaw, 0);
        var go = (GameObject)PrefabUtility.InstantiatePrefab(asset);
        go.name = fbx + " model";
        go.transform.SetParent(holder, false); go.transform.localRotation = Quaternion.Euler(0, 180, 0); go.transform.localPosition = Vector3.zero; go.transform.localScale = Vector3.one;
        var b = BoundsOf(go); float s = height / Mathf.Max(.01f, b.size.y);
        go.transform.localScale = Vector3.one * s; b = BoundsOf(go);
        go.transform.position += new Vector3(at.x - b.center.x, at.y - b.min.y, at.z - b.center.z);
        var anim = go.GetComponent<Animator>() ?? go.AddComponent<Animator>();
        anim.runtimeAnimatorController = Controller(path, controller);
        anim.applyRootMotion = false; anim.cullingMode = AnimatorCullingMode.AlwaysAnimate;
        if (hologram)
        {
            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                var tex = r.sharedMaterial ? r.sharedMaterial.GetTexture("_BaseMap") : null;
                var holo = ShopArt.Transparent("Firas hologram", new Color(.45f, 1f, .9f, .88f), .9f, .05f);
                if (tex) holo.SetTexture("_BaseMap", tex);
                r.sharedMaterials = Enumerable.Repeat(holo, r.sharedMaterials.Length).ToArray();
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
        }
        return holder.gameObject;
    }

    static readonly string[] States = { "Idle", "Walking_A", "Interact", "Cheer", "Hit_A", "Spellcasting", "Spellcast_Raise", "Use_Item", "PickUp", "Block" };
    static readonly string[] Loops = { "Idle", "Walking_A", "Spellcasting" };

    static AnimatorController Controller(string fbxPath, string name)
    {
        string path = "Assets/Capital/Generated/" + name + "Animator.controller";
        AssetDatabase.DeleteAsset(path);
        var ctrl = AnimatorController.CreateAnimatorControllerAtPath(path);
        var clips = AssetDatabase.LoadAllAssetsAtPath(fbxPath).OfType<AnimationClip>().Where(c => !c.name.StartsWith("__preview")).GroupBy(c => c.name).ToDictionary(g => g.Key, g => g.First());
        var sm = ctrl.layers[0].stateMachine; AnimatorState idle = null; var made = new List<AnimatorState>();
        foreach (var n in States)
        {
            if (!clips.TryGetValue(n, out var clip)) continue;
            var st = sm.AddState(n); st.motion = clip; made.Add(st);
            if (n == "Idle") idle = st;
        }
        if (idle) sm.defaultState = idle;
        foreach (var st in made)
            if (idle && !Loops.Contains(st.name)) { var t = st.AddTransition(idle); t.hasExitTime = true; t.exitTime = .9f; t.duration = .25f; }
        if (clips.Count == 0) Debug.LogWarning("CAPITAL no animation clips in " + fbxPath);
        return ctrl;
    }
}
