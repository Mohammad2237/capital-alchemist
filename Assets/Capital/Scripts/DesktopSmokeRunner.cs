using System;
using System.Collections;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Capital
{
    // Opt-in executable integration route. Uses the live scene controllers; does not fake ending values.
    public sealed class DesktopSmokeRunner:MonoBehaviour
    {
        // While the automated route runs, real mouse/keyboard input is ignored so a stray click can't change a branch.
        public static bool Running;
        string output;
        readonly System.Text.StringBuilder report=new System.Text.StringBuilder();
        int errors;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Bootstrap()
        {
            if(!Environment.GetCommandLineArgs().Contains("--smoke"))return;
            Running=true;var go=new GameObject("Automated desktop smoke");DontDestroyOnLoad(go);go.AddComponent<DesktopSmokeRunner>();
        }
        void Awake()
        {
            var args=Environment.GetCommandLineArgs();int i=Array.IndexOf(args,"--evidence");
            output=i>=0&&i+1<args.Length?args[i+1]:Application.persistentDataPath;
            Directory.CreateDirectory(output);Application.logMessageReceived+=OnLog;
        }
        void OnLog(string message,string trace,LogType type)
        {if(type==LogType.Exception || type==LogType.Error){errors++;report.AppendLine("RUNTIME ERROR "+message+"\n"+trace);File.WriteAllText(Path.Combine(output,"runtime-smoke.txt"),report.ToString());}}
        IEnumerator Start()
        {
            yield return null;yield return null;
            int[] prices={30,30,30,50,50,50};
            int[] cash={156,124,146,155,130,145},net={56,24,46,55,30,45};
            for(int branch=0;branch<6;branch++)
            {
                if(branch>0){GameManager.I.ResetRun();yield return null;yield return null;yield return null;}
                var s=GameManager.I.State;
                Check(s.Cash==100 && s.terms.Count<=1,"clean reset "+branch);
                GameDirector.I.GetComponent<SceneFlowManager>().Next();
                Check(SceneManager.GetActiveScene().buildIndex==0,"premature scene blocked");
                Check(GameDirector.I.Phase==Phase.Intro,"starts outside the shop");
                if(branch==0){yield return new WaitForSeconds(.5f);yield return Screenshot("00-outside");}
                GameDirector.I.OpenShopDoor();yield return new WaitForSeconds(branch==0?1.4f:.1f);
                if(branch==0)yield return Screenshot("00-door-open");
                GameDirector.I.EnterShop();
                Check(GameDirector.I.Phase==Phase.Purchase && FirasController.I && FirasController.I.Shown,"entered shop, Firas appears");
                if(branch==0){yield return new WaitForSeconds(2f);yield return Screenshot("00-inside-firas");yield return Tour("a");}
                for(int i=0;i<4;i++)GameDirector.I.Purchase(i);
                yield return null;
                Check(s.Cash==75 && s.InventoryValue==25,"purchase inventory");
                yield return Brew(false,branch==0);
                Check(GameDirector.I.Phase==Phase.Ready,"first bottle ready");
                if(branch==0)yield return Screenshot("01-crafting");
                GameDirector.I.GetComponent<SceneFlowManager>().Next();
                yield return new WaitForSeconds(1);
                Check(SceneManager.GetActiveScene().buildIndex==1 && s.Cash==75 && s.terms.Contains(2),"scene 2 state preserved");
                if(branch==0){yield return new WaitForSeconds(7.5f);PlayerRig.Teleport?.Invoke(ShopLayout.CounterStart,ShopLayout.CounterYaw);yield return new WaitForSeconds(.3f);yield return Screenshot("02a-customer-at-counter");PlayerRig.Teleport?.Invoke(ShopLayout.InsideStart,ShopLayout.InsideYaw);}
                GameDirector.I.ChoosePrice(prices[branch]);
                var first=Find("potion");first.transform.position=GameDirector.I.Brewing.HandoffPosition;first.TryDrop();
                Check(s.Revenue==prices[branch] && s.COGS==25,"physical first handoff");
                first.TryDrop();Check(s.Revenue==prices[branch],"duplicate handoff blocked");
                GameDirector.I.RevenueAnswer(false);Check(GameDirector.I.Phase==Phase.RevenueQuiz,"first quiz retry");
                GameDirector.I.RevenueAnswer(true);
                if(branch==0)yield return Screenshot("02-customer-ledger");
                GameDirector.I.GetComponent<SceneFlowManager>().Next();yield return new WaitForSeconds(1);
                Check(SceneManager.GetActiveScene().buildIndex==2,"scene 3 reached");
                GameDirector.I.BuyBatch(branch%3==2?Supplier.Premium:Supplier.Cheap);
                if(branch%3!=2)GameDirector.I.DecideHerb(branch%3==0?HerbDecision.Replace:HerbDecision.UseWilted);
                yield return null;yield return Brew(true);
                Check(GameDirector.I.Phase==Phase.BatchHandoff,"three filled bottles");
                for(int i=0;i<3;i++)
                {
                    var bottle=FindObjectsByType<IngredientInteraction>(FindObjectsSortMode.None).First(x=>x.Kind=="potion"&&x.Index==i&&!x.Consumed);
                    bottle.transform.position=GameDirector.I.Brewing.HandoffPosition;bottle.TryDrop();yield return null;
                }
                Check(GameDirector.I.Phase==Phase.Expenses,"all accepted or discarded");
                GameDirector.I.PayExpenses();GameDirector.I.PayExpenses();
                Check(s.Cash==cash[branch]&&s.NetProfit==net[branch]&&s.OperatingExpenses==10,"branch "+branch+" final values "+s.Cash);
                Check(s.NetProfit!=s.GrossProfit,"quiz uniqueness");
                GameDirector.I.FinalAnswer(false);GameDirector.I.FinalAnswer(true);
                Check(s.finished && s.terms.Count==10 && s.InventoryValue==0,"report and ten terms");
                GameManager.I.Finance.AssertReconciles();
                File.WriteAllText(Path.Combine(output,"branch-"+branch+".json"),JsonUtility.ToJson(s,true));
                yield return Screenshot("ending-"+branch);
                var glossary=FindFirstObjectByType<GlossaryManager>();glossary.Toggle();Check(GameManager.I.InteractionPaused,"book pauses interactions"+(IngredientInteraction.AnyHeld?" (held: "+string.Join(",",FindObjectsByType<IngredientInteraction>(FindObjectsSortMode.None).Where(x=>x.Held).Select(x=>x.Kind+x.Index))+")":""));
                glossary.Toggle();Check(!GameManager.I.InteractionPaused,"book resumes");
            }
            report.AppendLine(errors==0?"PASS: six executable scene-controller routes.":"FAIL: "+errors+" checks/errors");
            report.AppendLine("Automated route does not prove manual mouse usability or VR performance.");
            File.WriteAllText(Path.Combine(output,"runtime-smoke.txt"),report.ToString());
            Application.Quit(errors==0?0:2);
        }
        void Check(bool ok,string message){report.AppendLine((ok?"PASS ":"FAIL ")+message);if(!ok)errors++;}
        IngredientInteraction Find(string kind)=>FindObjectsByType<IngredientInteraction>(FindObjectsSortMode.None).First(x=>x.Kind==kind&&!x.Consumed);
        IEnumerator Shot(string name,bool shots){if(!shots)yield break;yield return new WaitForSeconds(1.4f);yield return Screenshot(name);}
        IEnumerator Brew(bool batch,bool shots=false)
        {
            var b=GameDirector.I.Brewing;
            yield return Shot("03a-ingredients-pov",shots);
            var herb=Find("herb");herb.transform.position=b.MortarPosition;herb.TryDrop();
            yield return Shot("03b-mortar-pov",shots);
            for(int i=0;i<5;i++){b.Mortar.Observe(b.MortarPosition+Vector3.up*.3f,true);b.Mortar.Observe(b.MortarPosition+Vector3.up*.05f,true);yield return null;}
            yield return Shot("03b2-mix-pov",shots);
            foreach(string kind in new[]{"crushed","crystal","water"}){var item=Find(kind);item.transform.position=b.CauldronPosition;item.TryDrop();yield return null;}
            Check(b.Progress.ReadyToStir,"valid ingredient intake");
            for(int i=0;i<155;i++)
            {
                float a=i*.1f;b.Cauldron.Observe(b.CauldronPosition+new Vector3(Mathf.Cos(a)*.2f,.15f,Mathf.Sin(a)*.2f),true);yield return null;
                if(i==70 && shots){var paddle=Find("spoon");paddle.transform.position=b.CauldronPosition+new Vector3(.25f,-.05f,.1f);paddle.transform.rotation=Quaternion.Euler(0,0,-20);yield return Shot("03c-stir-pov",true);}
            }
            Check(b.Progress.ReadyToBottle,"circular stirring");
            for(int i=0;i<(batch?3:1);i++)
            {
                var bottle=Find("bottle");bottle.transform.position=b.BottlePosition;bottle.TryDrop();
                Check(b.Bottler.Current!=null,"bottle snapped");
                for(int f=0;f<12;f++)
                {
                    b.Bottler.Pour(.25f);yield return null;
                    if(f==4 && i==0 && shots){for(float t=0;t<1.4f;t+=Time.deltaTime){b.Bottler.Pour(.0002f);yield return null;}yield return Screenshot("03d-pour-pov");}
                }
            }
        }
        // Visual review: a few fixed viewpoints around the shop.
        IEnumerator Tour(string tag)
        {
            var views=new[]{(new Vector3(0,0,2.6f),0f,"cauldron"),(new Vector3(-.6f,0,5.0f),-75f,"ingredients"),(new Vector3(.4f,0,7.6f),-130f,"firas"),
                            (new Vector3(.6f,0,6.6f),90f,"bottling"),(new Vector3(0,0,9.8f),180f,"looking-south"),(new Vector3(-2.8f,0,10.6f),135f,"shop-wide")};
            foreach(var (p,yaw,name) in views){PlayerRig.Teleport?.Invoke(p,yaw);yield return null;yield return null;yield return Screenshot("tour-"+tag+"-"+name);}
            PlayerRig.Teleport?.Invoke(ShopLayout.InsideStart,ShopLayout.InsideYaw);yield return null;
        }
        IEnumerator Screenshot(string name)
        {
            yield return new WaitForEndOfFrame();ScreenCapture.CaptureScreenshot(Path.Combine(output,name+".png"));yield return null;
        }
        void OnDestroy(){Application.logMessageReceived-=OnLog;}
    }
}
