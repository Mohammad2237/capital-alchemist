using UnityEngine;
using WebXR;

namespace CapitalWeb
{
    // Thin bridge to the WebXR Export package (its assembly is not auto-referenced by game code).
    // Browser VR (Quest Browser etc.): head pose arrives through Unity's XR display; controllers through
    // WebXRController components, which also move their own transforms.
    public static class WebHands
    {
        public static bool IsWebGL =>
#if UNITY_WEBGL && !UNITY_EDITOR
            true;
#else
            false;
#endif
        public static bool InVR => WebXRManager.Instance != null && WebXRManager.Instance.XRState == WebXRState.VR;
        public static event System.Action<bool> VRChanged;
        static bool hooked;
        public static void Hook()
        {
            if (hooked) return; hooked = true;
            WebXRManager.OnXRChange += (state, views, l, r) => VRChanged?.Invoke(state == WebXRState.VR);
        }
        public static bool VRSupported => WebXRManager.Instance != null && WebXRManager.Instance.isSupportedVR;
        public static void ToggleVR() => WebXRManager.Instance?.ToggleVR();

        public static Component Attach(GameObject go, bool left)
        {
            var c = go.AddComponent<WebXRController>();
            c.hand = left ? WebXRControllerHand.LEFT : WebXRControllerHand.RIGHT;
            return c;
        }
        static WebXRController C(Component c) => c as WebXRController;
        public static bool Active(Component c) => C(c) && C(c).isControllerActive;
        public static bool Grip(Component c) => C(c) && C(c).GetButton(WebXRController.ButtonTypes.Grip);
        public static bool Trigger(Component c) => C(c) && C(c).GetButton(WebXRController.ButtonTypes.Trigger);
        public static bool PrimaryDown(Component c) => C(c) && C(c).GetButtonDown(WebXRController.ButtonTypes.ButtonA);
        public static Vector2 Stick(Component c) => C(c) ? C(c).GetAxis2D(WebXRController.Axis2DTypes.Thumbstick) : Vector2.zero;
        public static void Pulse(Component c, float intensity, float seconds) { if (C(c)) C(c).Pulse(intensity, seconds * 1000f); }
    }
}
