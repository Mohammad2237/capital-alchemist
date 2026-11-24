using UnityEngine;
namespace Capital
{
    public sealed class CauldronController : MonoBehaviour
    {
        BrewingController brew;
        float? lastAngle;
        public Renderer Liquid;
        // Swirl: foam blobs orbit the brew; stirring spins them faster (energy decays when you stop).
        Transform[] foam;float swirlEnergy,swirlAngle;Material foamMat;
        public void Initialize(BrewingController b)
        {
            brew=b;
            foamMat=ShopArt.Material("Brew foam Glow",new Color(.5f,1f,.7f),true);
            foam=new Transform[14];
            for(int i=0;i<foam.Length;i++)
            {
                var f=ShopArt.Primitive("Brew foam",PrimitiveType.Sphere,transform,Vector3.zero,new Vector3(.07f,.02f,.07f),Color.white,false);
                f.GetComponent<Renderer>().sharedMaterial=foamMat;f.SetActive(false);foam[i]=f.transform;
            }
        }
        public bool Accept(IngredientInteraction item)
        {
            if(GameManager.I.InteractionPaused || !brew.Progress.Add(item.Kind)){UIManager.I.Toast(brew.Progress.ReadyToStir?"المرجل ممتلئ — حرّك الآن":"ليس الآن");return false;}
            Color burst=item.Kind=="crystal"?new Color(.3f,.55f,1f):item.Kind=="water"?new Color(.4f,.85f,1f):new Color(.85f,.25f,.12f);
            ShopFx.I?.Bits(ShopLayout.Liquid+Vector3.up*.05f,burst,9);ShopFx.I?.Sparkle(ShopLayout.Liquid+Vector3.up*.1f,8);
            BrewMap.I?.AddIngredient(item.Kind);
            item.Consume();AudioManager.I.Play(Sfx.Splash,Random.Range(.9f,1.1f));brew.UpdateObjective();return true;
        }
        public void Observe(Vector3 position,bool held)
        {
            if(!held || GameManager.I.InteractionPaused || !brew.Progress.ReadyToStir){lastAngle=null;return;}
            Vector3 d=position-transform.position;float radius=new Vector2(d.x,d.z).magnitude;
            if(radius<.06f || radius>ShopLayout.CauldronInnerRadius || Mathf.Abs(d.y)>.5f){lastAngle=null;return;}
            float angle=Mathf.Atan2(d.z,d.x)*Mathf.Rad2Deg;
            if(lastAngle.HasValue)
            {
                float signed=Mathf.DeltaAngle(lastAngle.Value,angle),delta=Mathf.Abs(signed);
                // Seen from above, a falling angle is clockwise: the map marker curves right.
                if(delta<60) Stir(delta/360,signed<0?1:-1);
            }
            lastAngle=angle;
        }
        public void Stir(float turns)=>Stir(turns,0);
        public void Stir(float turns,int dir)
        {
            if(!GameManager.I.InteractionPaused && brew.Progress.ReadyToStir && !brew.Progress.ReadyToBottle)BrewMap.I?.Stir(turns,dir);
            if(GameManager.I.InteractionPaused || brew.Progress.ReadyToBottle)return;
            brew.Progress.Stir(turns);brew.UpdateObjective();swirlEnergy=Mathf.Min(3,swirlEnergy+turns*9);
            if(brew.Progress.ReadyToBottle){AudioManager.I.Cue(1.25f);ShopFx.I?.Sparkle(transform.position+Vector3.up*.2f,14);}
        }
        // Supplier/herb choices visibly change the batch brew; the first potion keeps the reference green.
        Color BrewColor()
        {
            var s=GameManager.I.State;
            if(!brew.Batch)return new Color(.13f,.67f,.42f);
            if(s.supplier==Supplier.Premium)return new Color(.16f,.8f,.55f);
            return s.herb==HerbDecision.UseWilted?new Color(.28f,.5f,.27f):new Color(.15f,.62f,.37f);
        }
        void Update()
        {
            if(!brew || !Liquid)return;
            bool swirling=brew.Progress.ReadyToStir;
            swirlEnergy=Mathf.MoveTowards(swirlEnergy,0,Time.deltaTime*1.2f);
            swirlAngle+=Time.deltaTime*(.35f+swirlEnergy*2.6f);
            if(foam!=null)for(int i=0;i<foam.Length;i++)
            {
                foam[i].gameObject.SetActive(swirling);
                if(!swirling)continue;
                float r=.1f+.36f*((i*.37f)%1f),a=swirlAngle*(1.4f-r)+i*2.1f;
                foam[i].position=ShopLayout.Liquid+new Vector3(Mathf.Cos(a)*r,.012f+.006f*Mathf.Sin(Time.time*5+i),Mathf.Sin(a)*r);
                foam[i].localScale=new Vector3(.07f,.02f,.07f)*(1+swirlEnergy*.15f);
            }
            if(swirling)foamMat.color=Color.Lerp(new Color(.7f,.75f,.6f),BrewColor()*1.5f,brew.Progress.stirring);
            Color target=Color.Lerp(new Color(.08f,.15f,.12f),BrewColor(),brew.Progress.stirring);
            var m=Liquid.material;m.color=Color.Lerp(m.color,target,Time.deltaTime*3);m.SetColor("_EmissionColor",m.color*1.1f);
            Liquid.transform.localPosition=new Vector3(Liquid.transform.localPosition.x,ShopLayout.Liquid.y+Mathf.Sin(Time.time*3)*.004f,Liquid.transform.localPosition.z);
        }
    }
}
