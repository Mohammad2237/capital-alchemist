using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Capital
{
    // Creative brewing: a parchment alchemy map (genre idea inspired by potion-map games; original art/code).
    // Every ingredient pushes the potion marker its own way; stirring moves it forward, and the stir
    // direction steers (clockwise = curve right, counter-clockwise = curve left). Getting the marker close to the
    // Vitality zone raises the potion's quality (1-3 stars): its glow, smoke and Firas's reaction change.
    // Costs and the financial outcomes are untouched — quality is craft, not money.
    public sealed class BrewMap : MonoBehaviour
    {
        public static BrewMap I;
        public Vector2 Pos { get; private set; }
        public int Quality => best < .09f ? 3 : best < .18f ? 2 : 1;
        public static readonly Vector2 Zone = new Vector2(.42f, .62f);
        const float ZoneRadius = .13f, StepPerTurn = .34f, TurnPerTurn = 75f;
        float heading = 90f, best = 9f; bool any;
        RectTransform panel, marker, zone; readonly List<RectTransform> trail = new List<RectTransform>();
        RTLTMPro.RTLTextMeshPro stars, steer;
        const float MapSize = 360;

        void Awake() { I = this; }
        void Start()
        {
            var root = UIManager.I.canvas.transform.Find("HUD frame");
            panel = UIManager.Panel(root, "Alchemy map", (1530, 180, MapSize + 20, MapSize + 110), new Color(.86f, .76f, .55f, .96f));
            var circle = UIManager.CircleSprite();
            var map = UIManager.Panel(panel, "Map", (10, 10, MapSize, MapSize), new Color(.93f, .85f, .66f));
            map.GetComponent<Image>().sprite = circle;
            for (int r = 1; r <= 3; r++)
            {
                var ring = UIManager.Panel(map, "Ring", (MapSize / 2 - r * 55, MapSize / 2 - r * 55, r * 110, r * 110), new Color(.55f, .4f, .2f, .12f));
                ring.GetComponent<Image>().sprite = circle;
            }
            zone = UIManager.Panel(map, "Vitality zone", (0, 0, ZoneRadius * MapSize, ZoneRadius * MapSize), new Color(.2f, .7f, .45f, .75f));
            zone.GetComponent<Image>().sprite = circle; Place(zone, Zone);
            for (int i = 0; i < 40; i++)
            {
                var d = UIManager.Panel(map, "Trail", (0, 0, 8, 8), new Color(.45f, .28f, .1f, .7f)); d.GetComponent<Image>().sprite = circle;
                d.gameObject.SetActive(false); trail.Add(d);
            }
            marker = UIManager.Panel(map, "Potion marker", (0, 0, 30, 30), UIManager.Gold); marker.GetComponent<Image>().sprite = circle;
            stars = UIManager.Text(panel, "", (10, MapSize + 16, MapSize, 44), 30, UIManager.Ink); stars.alignment = TMPro.TextAlignmentOptions.Center;
            steer = UIManager.Text(panel, "مع عقارب الساعة: يمين • عكسها: يسار", (10, MapSize + 56, MapSize, 40), 24, UIManager.Ink); steer.alignment = TMPro.TextAlignmentOptions.Center;
            ResetMap();
        }
        void Place(RectTransform r, Vector2 p)
        {
            r.anchorMin = r.anchorMax = r.pivot = new Vector2(.5f, .5f);
            r.anchoredPosition = p * (MapSize / 2);
        }
        public void ResetMap()
        {
            Pos = Vector2.zero; heading = 90; best = 9; any = false;
            foreach (var t in trail) t.gameObject.SetActive(false);
            trailIndex = 0; Redraw();
        }
        int trailIndex;
        void Drop()
        {
            var d = trail[trailIndex % trail.Count]; d.gameObject.SetActive(true); Place(d, Pos); trailIndex++;
        }
        public void AddIngredient(string kind)
        {
            Vector2 push = kind == "crushed" ? new Vector2(-.05f, .36f) : kind == "crystal" ? new Vector2(.3f, .08f) : kind == "water" ? new Vector2(-.08f, .1f) : Vector2.zero;
            if (push == Vector2.zero) return;
            for (int i = 1; i <= 5; i++) { Pos += push / 5; Drop(); }
            heading = Mathf.Atan2(push.y, push.x) * Mathf.Rad2Deg; any = true;
            Track(); Redraw();
        }
        // dir: +1 clockwise (curve right), -1 counter-clockwise (curve left), 0 = assist button (straight).
        public void Stir(float turns, int dir)
        {
            if (!any || turns <= 0) return;
            heading -= dir * TurnPerTurn * turns;
            Vector2 step = new Vector2(Mathf.Cos(heading * Mathf.Deg2Rad), Mathf.Sin(heading * Mathf.Deg2Rad)) * StepPerTurn * turns;
            Pos = Vector2.ClampMagnitude(Pos + step, .95f);
            if (Random.value < .5f) Drop();
            Track(); Redraw();
        }
        void Track()
        {
            float d = Vector2.Distance(Pos, Zone);
            bool wasIn = best < ZoneRadius * .7f;
            best = Mathf.Min(best, d);
            if (!wasIn && best < ZoneRadius * .7f) { AudioManager.I?.Play(Sfx.Crystal, 1.2f, .7f); ShopFx.I?.Sparkle(ShopLayout.Liquid + Vector3.up * .2f, 14); }
        }
        public bool InZone => Vector2.Distance(Pos, Zone) < ZoneRadius * .7f;
        public string StarsText => "الجودة " + Quality + " / 3" + (Quality == 3 ? " — ممتازة!" : "");
        void Redraw()
        {
            if (!marker) return;
            Place(marker, Pos);
            stars.text = any ? StarsText : "أضف المكونات";
        }
        void Update()
        {
            if (!panel) return;
            var s = Stations.Current;
            bool show = (s == Station.Mix || s == Station.Cauldron) && GameDirector.I && (GameDirector.I.Phase == Phase.Brew || GameDirector.I.Phase == Phase.BatchBrew);
            panel.gameObject.SetActive(show);
            if (show) { float k = 1 + .08f * Mathf.Sin(Time.time * 4); zone.localScale = Vector3.one * k; }
        }
        // Colour of the brew/smoke from what's in it.
        public Color BrewTint
        {
            get
            {
                if (!any) return new Color(.75f, .78f, .76f);
                if (InZone) return new Color(1f, .85f, .45f);
                return Color.Lerp(new Color(.85f, .35f, .3f), new Color(.35f, .55f, 1f), Mathf.Clamp01(Pos.x * 2 + .5f));
            }
        }
    }
}
