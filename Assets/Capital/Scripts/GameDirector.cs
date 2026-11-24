using System.Collections;
using System.Linq;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Capital
{
    public enum Phase { Intro, Purchase, Brew, Ready, Price, Handoff, RevenueQuiz, Offer, Supplier, Wilt, BatchBrew, BatchHandoff, Expenses, FinalQuiz, Report }
    public sealed class GameDirector : MonoBehaviour
    {
        public static GameDirector I;
        public Phase Phase { get; private set; }
        public BrewingController Brewing;
        public int QuizAttempts { get; private set; }
        bool correctLeft;
        GameState S=>GameManager.I.State;
        FinancialManager F=>GameManager.I.Finance;
        void Awake(){I=this;}
        IEnumerator Start()
        {
            if(!GameManager.I) new GameObject("Persistent GameState").AddComponent<GameManager>();
            if(!UIManager.I) gameObject.AddComponent<UIManager>();
            gameObject.AddComponent<AudioManager>();gameObject.AddComponent<GlossaryManager>();gameObject.AddComponent<SceneFlowManager>();gameObject.AddComponent<DialogueManager>();
            Brewing=gameObject.AddComponent<BrewingController>();
            gameObject.AddComponent<DemoManager>();gameObject.AddComponent<ShopFx>();gameObject.AddComponent<TouchControls>();gameObject.AddComponent<BrewMap>();
            yield return null;
            int chapter=SceneManager.GetActiveScene().buildIndex;
            // Guard direct editor scene entry. No synthetic sale or free batch.
            if(chapter>0 && !S.Has(chapter==1?"craft-first":"sale-first")) { SceneManager.LoadScene(0);yield break; }
            S.chapter=chapter;
            // Parchment labels sit on the real boards: recipe by the ingredient table, shop name on the street sign.
            UIManager.WorldLabel("جرعة النشاط\nعشبة 10 • بلورة 8\nماء 5 • قارورة 2",new Vector3(-4.0f,1.36f,ShopLayout.IngredientTable.z),new Vector2(540,360),34,-90);
            UIManager.WorldLabel("إرث الكيميائي\nمتجر الجرعات",new Vector3(0,2.93f,-.545f),new Vector2(560,250),44,0);
            if(chapter==0)
            {
                Phase=Phase.Intro;
            }
            else if(chapter==1)
            {
                FirasController.I?.Appear();
                Phase=Phase.Price;Brewing.SpawnSaleBottle();GameManager.I.Unlock(3);
                DialogueManager.I.Say("S2_C01","S2_F01","S2_F02");
                UIManager.WorldLabel("لوحة السوق\nجرعات الجيران: نحو 40 عملة",new Vector3(4.0f,1.36f,1.15f),new Vector2(380,250),30,90);
            }
            else
            {
                FirasController.I?.Appear();
                Phase=Phase.Supplier;GameManager.I.Unlock(7);DialogueManager.I.Say("S3_F01");
            }
            Refresh();
        }
        public void Refresh()
        {
            if(!UIManager.I || GameManager.I.InteractionPaused) return;
            var ui=UIManager.I;ui.Actions();ui.CloseModal();
            if(Phase!=Phase.Brew && Phase!=Phase.BatchBrew)ui.Progress("");
            var trader=CustomerController.Get("Trader");
            // One short step at a time; NPCs are talked to face to face (no shop menus).
            switch(Phase)
            {
                case Phase.Intro:
                    if(!doorOpened){ui.Objective("افتح باب متجرك");ui.Actions(new Choice("افتح الباب",OpenShopDoor));}
                    else{ui.Objective("ادخل المتجر");ui.Actions(new Choice("ادخل",EnterShop));}
                    break;
                case Phase.Purchase:
                    ui.Objective("اشترِ المكونات من التاجر");
                    if(trader && !trader.Arrived){trader.Arrive(()=>{DialogueManager.I.Say("T1_HELLO");Refresh();});break;}
                    string[] names={"عشبة حمراء • 10","بلورة زرقاء • 8","ماء سحري • 5","قارورة • 2"};
                    var choices=Enumerable.Range(0,4).Where(i=>!S.Has("ingredient-"+i)).Select(i=>new Choice(names[i],()=>Purchase(i))).ToArray();
                    ui.Talk("التاجر المتجول","ماذا تحتاج لجرعة النشاط؟",choices);break;
                case Phase.Brew:case Phase.BatchBrew:Brewing.UpdateObjective();break;
                case Phase.Ready:
                    ui.Objective("جرعتك جاهزة! • التكلفة 25");
                    ui.Actions(new Choice("افتح الباب للزبون",()=>GetComponent<SceneFlowManager>().Next()));break;
                case Phase.Price:
                    ui.Objective("اختر سعرك");
                    ui.Talk("الزبون","بكم جرعة النشاط؟ الجيران يبيعونها بنحو 40.",
                        new Choice("30 عملة",()=>ChoosePrice(30)),new Choice("50 عملة",()=>ChoosePrice(50)));break;
                case Phase.Handoff:
                    ui.Objective("ضع الجرعة على الصينية");break;
                case Phase.RevenueQuiz:
                    ui.Objective("إيراد أم ربح؟");
                    ui.Talk("فراس","الإيراد "+S.Revenue+" • التكلفة "+S.COGS+" — المال الذي استلمته: إيراد أم ربح؟",
                        new Choice("إيراد",()=>RevenueAnswer(true)),new Choice("ربح",()=>RevenueAnswer(false)));break;
                case Phase.Offer:
                    ui.Objective("طلبية كبيرة");
                    ui.Talk("التاجر","أريد 3 جرعات، وأدفع "+S.MerchantPrice+" لكل جرعة سليمة.",
                        new Choice("اتفقنا",()=>GetComponent<SceneFlowManager>().Next()));break;
                case Phase.Supplier:
                    ui.Objective("اختر المورد");
                    if(trader && !trader.Arrived){trader.Arrive(()=>{DialogueManager.I.Say("T3_HELLO");Refresh();});break;}
                    ui.Talk("التاجر المتجول","3 جرعات: اقتصادي رخيص، أو ممتاز بجودة ثابتة.",
                        new Choice("اقتصادي • 45",()=>BuyBatch(Supplier.Cheap)),new Choice("ممتاز • 60",()=>BuyBatch(Supplier.Premium)));break;
                case Phase.Wilt:
                    ui.Objective("عشبة ذابلة!");
                    ui.Talk("فراس","إحدى الأعشاب ذابلة. ماذا تفعل؟",
                        new Choice("استبدلها • +5",()=>DecideHerb(HerbDecision.Replace)),new Choice("استخدمها",()=>DecideHerb(HerbDecision.UseWilted)));break;
                case Phase.BatchHandoff:
                    ui.Objective("سلّم القوارير للتاجر");break;
                case Phase.Expenses:
                    ui.Objective("فاتورة اليوم");
                    ui.Talk("فراس","فاتورة المتجر: إيجار وشموع وحطب.",new Choice("ادفع 10",PayExpenses));break;
                case Phase.FinalQuiz:
                    ui.Objective("السؤال الأخير");
                    ui.Talk("فراس","كم صافي ربحك اليوم؟",
                        new Choice((correctLeft?S.NetProfit:S.GrossProfit)+" عملة",()=>FinalAnswer(correctLeft)),
                        new Choice((correctLeft?S.GrossProfit:S.NetProfit)+" عملة",()=>FinalAnswer(!correctLeft)));break;
                case Phase.Report:
                    ui.Objective("تقرير المتجر");ui.Progress("");
                    ui.Modal("تقرير المتجر",FinalLedger(),
                        new Choice("إعادة التجربة",()=>GameManager.I.ResetRun()),new Choice("الموسوعة المالية",()=>GetComponent<GlossaryManager>().Toggle()));break;
            }
        }
        // ---- Scene 1 opening: the player stands outside, opens the inherited shop and walks in. ----
        bool doorOpened;
        public void OpenShopDoor()
        {
            if(Phase!=Phase.Intro || doorOpened)return;
            doorOpened=true;ShopFx.I?.OpenDoor();Refresh();
        }
        public void EnterShop()
        {
            if(Phase!=Phase.Intro)return;
            if(!doorOpened){doorOpened=true;ShopFx.I?.OpenDoor();}
            var cam=Camera.main;
            if(cam && !ShopLayout.IsInside(cam.transform.position))PlayerRig.Teleport?.Invoke(ShopLayout.InsideStart,ShopLayout.InsideYaw);
            Phase=Phase.Purchase;GameManager.I.Unlock(0);FirasController.I?.Appear();
            DialogueManager.I.Say("S1_F01","S1_F02","S1_F03");GameManager.I.Notify();Refresh();
        }
        void Update()
        {
            // Walking through the open door counts as entering (VR locomotion or WASD).
            if(Phase==Phase.Intro && doorOpened && Camera.main && ShopLayout.IsInside(Camera.main.transform.position))EnterShop();
        }
        public void Purchase(int index)
        {
            if(Phase!=Phase.Purchase || !F.PurchaseFirst(index))return;
            AudioManager.I.Play(Sfx.Coins,.8f,.5f);
            if(S.terms.Contains(1)==false){GameManager.I.Unlock(1);DialogueManager.I.Say("S1_F04");}
            CustomerController.Get("Trader")?.Receive();
            if(Enumerable.Range(0,4).All(i=>S.Has("ingredient-"+i)))
            {Phase=Phase.Brew;Brewing.Begin(false);DialogueManager.I.Say("T1_BYE","S1_F05");CustomerController.Get("Trader")?.Leave();}
            else DialogueManager.I.Say("T1_DEAL");
            GameManager.I.Notify();Refresh();
        }
        public void BottleFinished()
        {
            if(Phase==Phase.Brew && F.CraftFirst())
            {GameManager.I.Unlock(2);Phase=Phase.Ready;DialogueManager.I.Say("S1_F06","S1_F07");StartCoroutine(KnockLater());}
            else if(Phase==Phase.BatchBrew && Brewing.Filled==3) Phase=Phase.BatchHandoff;
            GameManager.I.Notify();Refresh();
        }
        public void ChoosePrice(int price)
        {
            if(Phase!=Phase.Price || !F.ChoosePrice(price))return;
            Phase=Phase.Handoff;DialogueManager.I.Say(price==30?"S2_CA":"S2_CB");
            CustomerController.Get("Customer")?.React(price==30);GameManager.I.Notify();Refresh();
        }
        public bool Deliver(int index)
        {
            if(Phase==Phase.Handoff && F.SellFirst())
            {
                CustomerController.Get("Customer")?.Receive();
                Phase=Phase.RevenueQuiz;QuizAttempts=0;ShopFx.I?.Coins(S.firstPrice,Brewing.HandoffPosition+Vector3.up*.1f);
                foreach(int t in new[]{4,5,6}) GameManager.I.Unlock(t);
                DialogueManager.I.Say(S.firstPrice==30?"S2_FA":"S2_FB");
            }
            else if(Phase==Phase.BatchHandoff && F.DeliverBatchBottle(index))
            {
                bool reject=index==2 && S.herb==HerbDecision.UseWilted;
                CustomerController.Get("Merchant")?.React(!reject);
                if(reject) AudioManager.I.Play(Sfx.Reject); else ShopFx.I?.Coins(S.MerchantPrice,Brewing.HandoffPosition+Vector3.up*.1f);
                if(reject) DialogueManager.I.Say("S3_M_REJECT","S3_FA_SKIP","S3_SPOIL");
                if(S.InventoryValue==0)
                {
                    Phase=Phase.Expenses;GameManager.I.Unlock(8);DialogueManager.I.Say("S3_M_OK");
                    // Premium verdict only lands once the merchant has actually inspected consistent potions.
                    if(S.supplier==Supplier.Premium) DialogueManager.I.Say("S3_FB");
                    DialogueManager.I.Say("S3_OPEX");
                }
            }
            else return false;
            GameManager.I.Notify();Refresh();return true;
        }
        public void RevenueAnswer(bool correct)
        {
            if(Phase!=Phase.RevenueQuiz)return;
            DialogueManager.I.Say(correct?"S2_Q_OK":"S2_Q_NO");
            if(!correct && QuizAttempts++==0) {UIManager.I.Toast("حاول مرة أخرى: الإيراد قبل طرح التكاليف");return;}
            Phase=Phase.Offer;DialogueManager.I.Say(S.firstPrice==30?"S2_MA":"S2_MB","S2_F03");Refresh();
        }
        public void BuyBatch(Supplier supplier)
        {
            if(Phase!=Phase.Supplier || !F.PurchaseBatch(supplier))return;
            AudioManager.I.Play(Sfx.Coins,.8f,.7f);
            DialogueManager.I.Say(supplier==Supplier.Cheap?"T3_CHEAP":"T3_PREMIUM");CustomerController.Get("Trader")?.Leave();
            if(supplier==Supplier.Cheap){Phase=Phase.Wilt;Brewing.ShowWilted();DialogueManager.I.Say("S3_FA_RISK");}
            else {Phase=Phase.BatchBrew;Brewing.Begin(true);}
            GameManager.I.Notify();Refresh();
        }
        public void DecideHerb(HerbDecision choice)
        {
            if(Phase!=Phase.Wilt || !F.DecideHerb(choice))return;
            if(choice==HerbDecision.Replace)DialogueManager.I.Say("S3_FA_FIX");
            Phase=Phase.BatchBrew;Brewing.Begin(true);GameManager.I.Notify();Refresh();
        }
        public void PayExpenses()
        {
            if(Phase!=Phase.Expenses || !F.PayOperatingExpenses())return;
            ShopFx.I?.PayOut(new Vector3(0,1.2f,-.5f));
            GameManager.I.Unlock(9);Phase=Phase.FinalQuiz;QuizAttempts=0;correctLeft=Random.value>.5f;
            Debug.Assert(S.GrossProfit!=S.NetProfit);DialogueManager.I.Say("S3_NET");GameManager.I.Notify();Refresh();
        }
        public void FinalAnswer(bool correct)
        {
            if(Phase!=Phase.FinalQuiz)return;
            DialogueManager.I.Say(correct?"S3_Q_OK":"S3_Q_NO");
            if(!correct && QuizAttempts++==0){UIManager.I.Toast(S.Spoilage>0?"اطرح مصروفات التشغيل 10 وخسائر التلف 15":"اطرح مصروفات التشغيل 10");return;}
            Phase=Phase.Report;S.finished=true;ShopFx.I?.Celebrate();DialogueManager.I.Say("S3_END1","S3_END2");GameManager.I.Notify();Refresh();
        }
        IEnumerator KnockLater(){yield return new WaitForSeconds(2.5f);AudioManager.I.Play(Sfx.Knock);}
        string FirstLedger()=>"سعر البيع: "+S.firstPrice+"\nالإيرادات: "+S.Revenue+"\nتكلفة البضاعة المباعة: "+S.COGS+"\nإجمالي الربح: "+S.GrossProfit;
        string ShortLedger()=>"الإيرادات: "+S.Revenue+"    تكلفة المبيعات: "+S.COGS+"\nإجمالي الربح: "+S.GrossProfit+"\nمصروفات التشغيل: "+S.OperatingExpenses+"    خسائر التلف: "+S.Spoilage;
        public string FinalLedger()=>"رأس المال الأولي: 100    إيرادات المبيعات: "+S.Revenue+
            "\nتكلفة البضاعة المباعة: "+S.COGS+"    إجمالي الربح: "+S.GrossProfit+
            "\nخسائر التلف: "+S.Spoilage+"    المصروفات التشغيلية: "+S.OperatingExpenses+
            "\nصافي الربح: "+S.NetProfit+"    الرصيد النقدي النهائي: "+S.Cash+
            "\nسمعة المتجر: "+S.reputation+"  •  تقييم غير مالي: "+S.ReputationStars+" / 4"+
            "\nمحاكاة مبسطة: لا تشمل الضرائب أو تكاليف التمويل.";
    }
}
