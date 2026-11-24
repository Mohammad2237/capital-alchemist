using System.Collections.Generic;
using UnityEngine;
namespace Capital
{
    public sealed class BrewingController : MonoBehaviour
    {
        public RecipeProgress Progress=new RecipeProgress();
        public bool Batch;
        public int Filled;
        public MortarController Mortar;
        public CauldronController Cauldron;
        public BottleController Bottler;
        public Vector3 MortarPosition=>ShopLayout.Mortar;
        public Vector3 CauldronPosition=>ShopLayout.Liquid;
        public Vector3 BottlePosition=>ShopLayout.BottleSocket;
        public Vector3 HandoffPosition=>ShopLayout.Handoff;
        readonly List<GameObject> props=new List<GameObject>();
        GameObject wilt;
        public void Begin(bool batch)
        {
            Batch=batch;Progress=new RecipeProgress();Filled=0;BrewMap.I?.ResetMap();
            if(wilt)Destroy(wilt);
            Mortar=NewAt<MortarController>("Mortar interaction",MortarPosition);Mortar.Initialize(this);
            Cauldron=NewAt<CauldronController>("Cauldron interaction",CauldronPosition);Cauldron.Initialize(this);
            Cauldron.Liquid=GameObject.Find("Cauldron liquid")?.GetComponent<Renderer>();
            Bottler=NewAt<BottleController>("Bottle socket",BottlePosition);Bottler.Initialize(this);
            Spawn("herb","العشبة",ShopLayout.HerbSpot,0);
            Spawn("crystal","البلورة",ShopLayout.CrystalSpot,0);
            Spawn("water","الماء السحري",ShopLayout.WaterSpot,0);
            Spawn("pestle","المدقة",ShopLayout.PestleSpot,0);
            Spawn("spoon","مجداف التحريك",ShopLayout.PaddleSpot,0);
            for(int i=0;i<(batch?3:1);i++)Spawn("bottle","قارورة فارغة",ShopLayout.EmptyBottle(i),i);
        }
        T NewAt<T>(string name,Vector3 position) where T:Component
        {var go=new GameObject(name);go.transform.position=position;return go.AddComponent<T>();}
        public IngredientInteraction Spawn(string kind,string label,Vector3 pos,int index)
        {
            var go=ShopArt.Item(kind,pos);var item=go.AddComponent<IngredientInteraction>();
            item.Kind=kind;item.ArabicName=label;item.Index=index;props.Add(go);return item;
        }
        public void ShowWilted()
        {
            wilt=ShopArt.Item("herb",ShopLayout.WiltedSpot);wilt.name="Wilted herb";
            wilt.transform.rotation=Quaternion.Euler(0,0,70);
            foreach(var r in wilt.GetComponentsInChildren<Renderer>())r.material.color=new Color(.36f,.24f,.08f);
            ShopFx.I?.Sparkle(ShopLayout.WiltedSpot+Vector3.up*.1f,6);
        }
        public void SpawnSaleBottle(){var i=Spawn("potion","جرعة النشاط",ShopLayout.SaleBottle,0);i.Filled=true;}
        public void UpdateObjective()
        {
            if(!UIManager.I || GameDirector.I.Phase!=Phase.Brew && GameDirector.I.Phase!=Phase.BatchBrew)return;
            string title=Batch?"حضّر الطلبية دفعة واحدة":"اصنع جرعة النشاط";
            string task=!Progress.herbInMortar?"ضع العشبة في الهاون":!Progress.crushed?"اسحق العشبة بالمدقة":!Progress.ReadyToStir?"أضف المسحوق والبلورة والماء إلى المرجل":!Progress.ReadyToBottle?"حرّك المجداف دائريًا داخل المرجل":Bottler.Current?"أمل القارورة للتعبئة: اضغط F مطولًا":"ضع قارورة فارغة في حلقة التعبئة";
            UIManager.I.Objective(task);
            UIManager.I.Progress(!Progress.crushed && Progress.herbInMortar?"السحق: "+Progress.strokes+" / 5":Progress.ReadyToStir&&!Progress.ReadyToBottle?"المزج: "+Mathf.RoundToInt(Progress.stirring*100)+"%":Progress.ReadyToBottle?"القوارير: "+Filled+" / "+(Batch?3:1):"");
            if(Progress.herbInMortar&&!Progress.crushed)UIManager.I.Actions(new Choice("مساعدة الحركة: ضربة سحق",()=>Mortar.Stroke()));
            else if(Progress.ReadyToStir&&!Progress.ReadyToBottle)UIManager.I.Actions(new Choice("مساعدة الحركة: دورة تحريك",()=>Cauldron.Stir(.25f)));
            else if(Bottler.Current)UIManager.I.Actions(new Choice("مساعدة التعبئة",()=>Bottler.Pour(.55f)));
            else UIManager.I.Actions();
        }
    }
}
