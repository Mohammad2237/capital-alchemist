using UnityEngine;
namespace Capital
{
    public sealed class DemoManager:MonoBehaviour
    {
        // Presentation controls are deliberately separate from progression. No auto-choice.
        public void ResetDemo()=>GameManager.I.ResetRun();
    }
}
