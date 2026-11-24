using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Controls;
using UnityEngine.UI;

namespace Capital
{
    // Phone / tablet controls for the browser build (only shown when a touchscreen is used):
    //  - left thumb: virtual joystick to walk;
    //  - right thumb: drag to look; while holding an item the finger becomes the pointer (stirring = circling);
    //  - tap an item to pick it up, tap a spot to put it down (the "E" key on desktop);
    //  - "hold to pour" button appears while a bottle sits in the bottling ring.
    public sealed class TouchControls : MonoBehaviour
    {
        public static TouchControls I;
        public static bool Active => I && I.used;
        public Vector2 Move { get; private set; }
        public Vector2 LookDelta { get; private set; }
        public Vector2 Pointer { get; private set; }
        public bool PointerDown { get; private set; }
        public bool Tapped { get; private set; }
        public static bool PourHeld => I && I.pourHeld;

        bool used, pourHeld;
        int stickFinger = -1, lookFinger = -1;
        Vector2 stickOrigin, lookStart, lookLast; float lookStartTime; bool lookMoved;
        RectTransform canvasRect, stickBase, stickKnob, pourButton;
        const float StickRadius = 110;

        void Awake() { I = this; }
        void Start()
        {
            var canvas = new GameObject("Touch controls", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster)).GetComponent<Canvas>();
            canvas.transform.SetParent(transform, false); canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 20;
            var scaler = canvas.GetComponent<CanvasScaler>(); scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; scaler.referenceResolution = new Vector2(1920, 1080); scaler.matchWidthOrHeight = .5f;
            canvasRect = (RectTransform)canvas.transform;
            var circle = Circle();
            stickBase = Img(canvasRect, "Stick base", circle, new Color(1, 1, 1, .16f), 260);
            stickKnob = Img(stickBase, "Stick knob", circle, new Color(.95f, .75f, .35f, .7f), 120);
            stickBase.gameObject.SetActive(false);
            pourButton = Img(canvasRect, "Hold to pour", circle, new Color(.15f, .55f, .4f, .85f), 220);
            pourButton.anchorMin = pourButton.anchorMax = new Vector2(1, 0); pourButton.anchoredPosition = new Vector2(-230, 330);
            var label = UIManager.Text(pourButton, "اضغط مطولًا\nللصب", (20, 60, 180, 100), 30, UIManager.Paper);
            label.alignment = TMPro.TextAlignmentOptions.Center;
            pourButton.gameObject.SetActive(false);
        }

        static Sprite Circle()
        {
            const int n = 128; var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
            var px = new Color32[n * n];
            for (int y = 0; y < n; y++) for (int x = 0; x < n; x++)
            {
                float d = Vector2.Distance(new Vector2(x, y), new Vector2(n / 2f - .5f, n / 2f - .5f)) / (n / 2f);
                byte a = (byte)(Mathf.Clamp01((1 - d) * 18) * 255);
                px[y * n + x] = new Color32(255, 255, 255, a);
            }
            tex.SetPixels32(px); tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(.5f, .5f));
        }
        static RectTransform Img(Transform parent, string name, Sprite s, Color c, float size)
        {
            var r = new GameObject(name, typeof(RectTransform), typeof(Image)).GetComponent<RectTransform>();
            r.SetParent(parent, false); r.sizeDelta = Vector2.one * size;
            var im = r.GetComponent<Image>(); im.sprite = s; im.color = c; im.raycastTarget = name == "Hold to pour";
            return r;
        }

        void Update()
        {
            Tapped = false; LookDelta = Vector2.zero;
            var ts = Touchscreen.current;
            if (ts == null || VRInputAdapter.Active) { Move = Vector2.zero; PointerDown = false; pourHeld = false; return; }
            bool any = false;
            foreach (TouchControl t in ts.touches) if (t.press.isPressed || t.phase.ReadValue() == UnityEngine.InputSystem.TouchPhase.Ended) any = true;
            if (any) used = true;
            if (!used) return;

            float scale = canvasRect.localScale.x > 0 ? canvasRect.localScale.x : 1;
            pourHeld = false;
            bool pourVisible = GameDirector.I && GameDirector.I.Brewing && GameDirector.I.Brewing.Bottler && GameDirector.I.Brewing.Bottler.Current;
            pourButton.gameObject.SetActive(pourVisible);
            PointerDown = false;
            foreach (TouchControl t in ts.touches)
            {
                int id = t.touchId.ReadValue(); var phase = t.phase.ReadValue(); Vector2 pos = t.position.ReadValue();
                if (phase == UnityEngine.InputSystem.TouchPhase.None) continue;
                bool pressed = t.press.isPressed;
                // Hold-to-pour button.
                if (pourVisible && pressed && RectTransformUtility.RectangleContainsScreenPoint(pourButton, pos)) { pourHeld = true; continue; }
                if (phase == UnityEngine.InputSystem.TouchPhase.Began)
                {
                    bool overUI = EventSystem.current && EventSystem.current.IsPointerOverGameObject(id);
                    if (overUI) continue;
                    if (stickFinger < 0 && pos.x < Screen.width * .33f && pos.y < Screen.height * .6f)
                    {
                        stickFinger = id; stickOrigin = pos; stickBase.gameObject.SetActive(true);
                        stickBase.position = pos; stickKnob.anchoredPosition = Vector2.zero; continue;
                    }
                    if (lookFinger < 0) { lookFinger = id; lookStart = lookLast = pos; lookStartTime = Time.unscaledTime; lookMoved = false; }
                }
                if (id == stickFinger)
                {
                    Vector2 d = (pos - stickOrigin) / scale; d = Vector2.ClampMagnitude(d, StickRadius);
                    stickKnob.anchoredPosition = d; Move = d / StickRadius;
                    if (!pressed) { stickFinger = -1; Move = Vector2.zero; stickBase.gameObject.SetActive(false); }
                }
                else if (id == lookFinger)
                {
                    if ((pos - lookStart).magnitude > 18 * scale) lookMoved = true;
                    LookDelta += pos - lookLast; lookLast = pos; Pointer = pos; PointerDown = pressed;
                    if (!pressed)
                    {
                        if (!lookMoved && Time.unscaledTime - lookStartTime < .35f) Tapped = true;
                        lookFinger = -1;
                    }
                }
            }
        }
    }
}
