using System;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Capital
{
    public sealed class GameManager : MonoBehaviour
    {
        public static GameManager I { get; private set; }
        public GameState State = new GameState();
        public FinancialManager Finance { get; private set; }
        public bool InteractionPaused;
        public event Action Changed;
        void Awake()
        {
            if (I && I != this) { Destroy(gameObject); return; }
            I = this; DontDestroyOnLoad(gameObject);
            Finance = new FinancialManager(State);
            Application.targetFrameRate = 90;
        }
        public void Notify() { Finance.AssertReconciles(); SaveManager.Save(State); Changed?.Invoke(); }
        public void Unlock(int term)
        {
            if (State.terms.Contains(term)) return;
            State.terms.Add(term); UIManager.I?.Toast("مصطلح جديد: " + GlossaryManager.Names[term]); Notify();
        }
        public void ResetRun()
        {
            bool demo = State.presentationMode;
            State = new GameState { presentationMode = demo }; Finance = new FinancialManager(State);
            InteractionPaused = false; SaveManager.Clear(); SceneManager.LoadScene(0);
        }
        void OnDestroy() { if (I == this) I = null; }
    }
    public static class SaveManager
    {
        public static string Path => System.IO.Path.Combine(Application.persistentDataPath, "last-run.json");
        // Audit snapshot only: a new launch deliberately starts clean, avoiding half-restored physics.
        public static void Save(GameState s) => File.WriteAllText(Path, JsonUtility.ToJson(s, true));
        public static void Clear() { if (File.Exists(Path)) File.Delete(Path); }
    }
    public sealed class SceneFlowManager : MonoBehaviour
    {
        public static readonly string[] Names = { "01_Inheritance", "02_FirstCustomer", "03_BigOrder" };
        bool transitioning;
        public void Next()
        {
            var s = GameManager.I.State;
            int current = SceneManager.GetActiveScene().buildIndex;
            if (transitioning || current == 2 || (current == 0 && !s.Has("craft-first")) || (current == 1 && !s.Has("sale-first"))) return;
            transitioning = true; StartCoroutine(Transition(current + 1));
        }
        System.Collections.IEnumerator Transition(int index)
        {
            yield return UIManager.I.ChapterOut(index);
            if(!DesktopSmokeRunner.Running)yield return new WaitForSecondsRealtime(.9f);
            GameManager.I.State.chapter = index; GameManager.I.Notify();
            SceneManager.LoadScene(index);
        }
    }
}
