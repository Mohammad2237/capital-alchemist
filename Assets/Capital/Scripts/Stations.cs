using UnityEngine;
namespace Capital
{
    public enum Station { None, Welcome, Ingredients, Mortar, Mix, Cauldron, Bottling, Counter, Ending }

    // Where each step of the story happens. One definition feeds:
    //  - the desktop camera glide (Camera/LookAt: framed view, e.g. looking down into the cauldron while stirring),
    //  - the VR floor ring + "go to station" teleport (Stand/StandYaw; the VR camera itself is never moved),
    //  - Firas, who flies to Firas and guides from there,
    //  - which items pulse to say "use me next".
    public readonly struct StationView
    {
        public readonly Vector3 Camera, LookAt, Stand, Firas; public readonly float StandYaw; public readonly string Name;
        public StationView(string name,Vector3 camera,Vector3 lookAt,Vector3 stand,Vector3 firas)
        {
            Name=name;Camera=camera;LookAt=lookAt;Stand=stand;Firas=firas;
            Vector3 d=lookAt-stand;d.y=0;StandYaw=Mathf.Atan2(d.x,d.z)*Mathf.Rad2Deg;
        }
        public Quaternion CameraRotation=>Quaternion.LookRotation(LookAt-Camera);
    }

    public static class Stations
    {
        static readonly Vector3 C=ShopLayout.Cauldron;
        public static StationView View(Station s)
        {
            switch(s)
            {
                case Station.Welcome:     return new StationView("الترحيب",ShopLayout.InsideStart+Vector3.up*1.62f,new Vector3(-.4f,1.5f,4.8f),ShopLayout.InsideStart,new Vector3(-.45f,.8f,4.85f));
                case Station.Ingredients: return new StationView("طاولة المكونات",new Vector3(-.95f,2.05f,4.2f),new Vector3(-2.0f,.9f,4.9f),new Vector3(-1.2f,0,4.6f),new Vector3(-2.9f,.8f,3.3f));
                case Station.Mix:         return new StationView("إضافة المكونات",new Vector3(-1.05f,2.3f,4.55f),new Vector3(-1.05f,.9f,6.2f),new Vector3(-1.0f,0,5.0f),new Vector3(-1.7f,.8f,7.85f));
                case Station.Mortar:      return new StationView("الهاون",new Vector3(-1.45f,1.62f,3.45f),new Vector3(-1.85f,.92f,4.2f),new Vector3(-1.55f,0,3.5f),new Vector3(-2.75f,.8f,3.7f));
                case Station.Cauldron:    return new StationView("المرجل",new Vector3(C.x,2.45f,C.z-1.05f),ShopLayout.Liquid,new Vector3(C.x,0,C.z-1.1f),new Vector3(C.x+1.85f,.7f,C.z+.55f));
                case Station.Bottling:    return new StationView("التعبئة",new Vector3(1.2f,1.75f,5.4f),new Vector3(2.1f,1.08f,6.45f),new Vector3(1.35f,0,5.55f),new Vector3(3.35f,.8f,6.75f));
                case Station.Counter:     return new StationView("طاولة البيع",new Vector3(2.45f,1.62f,3.4f),new Vector3(2.5f,1.3f,1.35f),new Vector3(2.4f,0,3.3f),new Vector3(1.05f,.85f,2.5f));
                case Station.Ending:      return new StationView("تقرير المتجر",new Vector3(-2.9f,2.35f,10.7f),new Vector3(.2f,1.0f,5.6f),new Vector3(-.6f,0,3.6f),ShopLayout.FirasSpot);
                default:                  return new StationView("",Vector3.zero,Vector3.forward,ShopLayout.InsideStart,ShopLayout.FirasSpot);
            }
        }

        public static Station Current
        {
            get
            {
                var d=GameDirector.I; if(!d)return Station.None;
                switch(d.Phase)
                {
                    case Phase.Purchase: return Station.Welcome;
                    case Phase.Brew: case Phase.BatchBrew: return BrewStep(d.Brewing);
                    case Phase.Wilt: return Station.Ingredients;
                    case Phase.Price: case Phase.Handoff: case Phase.RevenueQuiz: case Phase.Offer:
                    case Phase.Supplier: case Phase.BatchHandoff: case Phase.Expenses: case Phase.FinalQuiz: return Station.Counter;
                    case Phase.Report: return Station.Ending;
                    default: return Station.None;
                }
            }
        }

        static Station BrewStep(BrewingController b)
        {
            if(!b || b.Progress==null)return Station.None;
            var p=b.Progress;
            if(!p.herbInMortar)return Station.Ingredients;
            if(!p.crushed)return Station.Mortar;
            if(!p.ReadyToStir)return Station.Mix;
            if(!p.ReadyToBottle)return Station.Cauldron;
            return Station.Bottling;
        }

        // Items that should glow "use me next" right now.
        public static bool IsTarget(IngredientInteraction item)
        {
            var d=GameDirector.I; if(!d || !item || item.Consumed)return false;
            if(d.Phase==Phase.Handoff || d.Phase==Phase.BatchHandoff)return item.Kind=="potion";
            if(d.Phase!=Phase.Brew && d.Phase!=Phase.BatchBrew)return false;
            var p=d.Brewing.Progress;
            if(!p.herbInMortar)return item.Kind=="herb";
            if(!p.crushed)return item.Kind=="pestle";
            if(!p.ReadyToStir)return item.Kind=="crushed"||item.Kind=="crystal"||item.Kind=="water";
            if(!p.ReadyToBottle)return item.Kind=="spoon";
            return item.Kind=="bottle" && d.Brewing.Bottler && !d.Brewing.Bottler.Current;
        }
    }
}
