using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
namespace Capital
{
    // Tier 2 presentation layer: cauldron bubbles/sparkle, coin flights, door swing, ending warmth.
    // Purely visual/audio. It reads state but never posts transactions.
    public sealed class ShopFx : MonoBehaviour
    {
        public static ShopFx I;
        Transform liquid, door, coinPile;
        float steamTimer;
        Transform ring,speakerMark;Material markMat;
        readonly List<Transform> bubbles=new List<Transform>();
        readonly List<float> bubbleAge=new List<float>();
        int coinsStacked;
        Material bubbleMat, sparkMat, coinMat, steamMat;
        Light[] lights; float[] baseIntensity; Color baseAmbient; float warmth, warmthTarget;

        void Awake(){I=this;}
        void Start()
        {
            liquid=GameObject.Find("Cauldron liquid")?.transform;
            bubbleMat=ShopArt.Material("Bubble Glow",new Color(.3f,.85f,.55f),true);
            sparkMat=ShopArt.Material("Spark Glow",new Color(1f,.85f,.45f),true);
            coinMat=ShopArt.Material("Coin Brass",new Color(.85f,.62f,.18f));
            steamMat=Resources.Load<Material>("Materials/Steam")??ShopArt.Transparent("Steam",new Color(.8f,.86f,.84f,.1f),.25f,0);
            steamMat.color=new Color(.85f,.88f,.86f,.06f);steamMat.SetFloat("_Smoothness",0);
            coinPile=new GameObject("Coin pile").transform;coinPile.position=ShopLayout.CoinPile;
            door=GameObject.Find("Door hinge")?.transform;
            // Floor ring: "stand here" for the current station (VR players walk/teleport to it).
            ring=ShopArt.Primitive("Station ring Glow",PrimitiveType.Cylinder,null,Vector3.zero,new Vector3(.8f,.004f,.8f),new Color(.25f,.95f,.8f),false).transform;
            var inner=ShopArt.Primitive("Station ring centre",PrimitiveType.Cylinder,ring,new Vector3(0,.6f,0),new Vector3(.82f,1,.82f),new Color(.09f,.11f,.1f),false);
            inner.GetComponent<Renderer>().shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;
            ring.gameObject.SetActive(false);
            // Speaker marker: a small glowing gem bobbing over whoever is talking.
            speakerMark=ShopArt.Primitive("Speaker Glow",PrimitiveType.Cube,null,Vector3.zero,Vector3.one*.07f,new Color(1f,.8f,.3f),false).transform;
            markMat=speakerMark.GetComponent<Renderer>().material;speakerMark.gameObject.SetActive(false);
            lights=FindObjectsByType<Light>(FindObjectsInactive.Exclude);baseIntensity=lights.Select(l=>l.intensity).ToArray();baseAmbient=RenderSettings.ambientLight;
        }

        // ---------- door ----------
        // The door leaf hangs on "Door hinge" (west jamb); it swings inward (+Z) by rotating -95 degrees.
        public bool DoorOpen{get;private set;}
        bool swinging;
        public void SwingDoor(){if(door && !swinging && !DoorOpen)StartCoroutine(Swing(true));}
        public void OpenDoor(){if(door && !DoorOpen && !swinging)StartCoroutine(Swing(false));}
        IEnumerator Swing(bool closeAfter)
        {
            swinging=true;AudioManager.I?.Play(Sfx.DoorCreak);
            yield return Rotate(0,-95,1.1f);DoorOpen=true;swinging=false;
            if(!closeAfter)yield break;
            yield return new WaitForSeconds(4.2f);
            swinging=true;yield return Rotate(-95,0,1.3f);DoorOpen=false;swinging=false;
        }
        IEnumerator Rotate(float from,float to,float seconds)
        {
            for(float t=0;t<1;t+=Time.deltaTime/seconds){door.localRotation=Quaternion.Euler(0,Mathf.Lerp(from,to,Mathf.SmoothStep(0,1,t)),0);yield return null;}
            door.localRotation=Quaternion.Euler(0,to,0);
        }

        // ---------- coins ----------
        public void Coins(int amount,Vector3 from)
        {
            int count=Mathf.Clamp(amount/6,3,9);
            AudioManager.I?.Play(Sfx.Coins);
            for(int i=0;i<count;i++)StartCoroutine(Fly(from,i*.06f));
        }
        public void PayOut(Vector3 to)
        {
            AudioManager.I?.Play(Sfx.Coins,.85f);
            for(int i=0;i<3 && coinPile.childCount>0;i++){var c=coinPile.GetChild(coinPile.childCount-1);c.SetParent(null,true);coinsStacked=Mathf.Max(0,coinsStacked-1);StartCoroutine(Leave(c,to,i*.08f));}
        }
        IEnumerator Fly(Vector3 from,float delay)
        {
            yield return new WaitForSeconds(delay);
            var coin=ShopArt.Primitive("Coin",PrimitiveType.Cylinder,null,from,new Vector3(.045f,.004f,.045f),Color.white,false);
            coin.GetComponent<Renderer>().sharedMaterial=coinMat;
            int slot=coinsStacked++;
            Vector3 end=coinPile.position+new Vector3((slot%3)*.05f-.05f,(slot/3)*.009f,((slot/3)%2)*.02f);
            for(float t=0;t<1;t+=Time.deltaTime/.55f)
            {
                coin.transform.position=Vector3.Lerp(from,end,t)+Vector3.up*Mathf.Sin(t*Mathf.PI)*.25f;
                coin.transform.rotation=Quaternion.Euler(t*720,t*200,0);yield return null;
            }
            coin.transform.position=end;coin.transform.rotation=Quaternion.identity;coin.transform.SetParent(coinPile,true);
        }
        IEnumerator Leave(Transform coin,Vector3 to,float delay)
        {
            yield return new WaitForSeconds(delay);Vector3 from=coin.position;
            for(float t=0;t<1;t+=Time.deltaTime/.5f){coin.position=Vector3.Lerp(from,to,t)+Vector3.up*Mathf.Sin(t*Mathf.PI)*.2f;yield return null;}
            Destroy(coin.gameObject);
        }

        // ---------- sparkle ----------
        public void Sparkle(Vector3 at,int count=10)
        {
            for(int i=0;i<count;i++)StartCoroutine(Spark(at));
        }
        IEnumerator Spark(Vector3 at)
        {
            var s=ShopArt.Primitive("Spark",PrimitiveType.Sphere,null,at,Vector3.one*.018f,Color.white,false);s.GetComponent<Renderer>().sharedMaterial=sparkMat;
            Vector3 v=new Vector3(Random.Range(-.25f,.25f),Random.Range(.35f,.7f),Random.Range(-.25f,.25f));
            for(float t=0;t<1;t+=Time.deltaTime/.9f){s.transform.position+=v*Time.deltaTime;v+=Vector3.down*.5f*Time.deltaTime;s.transform.localScale=Vector3.one*.018f*(1-t);yield return null;}
            Destroy(s);
        }

        // ---------- steam ----------
        IEnumerator Steam(Vector3 from)
        {
            // Swirling, fading puffs tinted by what is in the brew (gold + sparks when the alchemy map is in the zone).
            Color tint=BrewMap.I?BrewMap.I.BrewTint:new Color(.85f,.88f,.86f);
            bool golden=BrewMap.I&&BrewMap.I.InZone;
            var puff=ShopArt.Primitive("Steam",PrimitiveType.Sphere,null,from+new Vector3(Random.Range(-.25f,.25f),.05f,Random.Range(-.25f,.25f)),Vector3.one*.08f,Color.white,false);
            var r=puff.GetComponent<Renderer>();r.sharedMaterial=steamMat;r.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;
            var block=new MaterialPropertyBlock();
            float spin=Random.Range(0,Mathf.PI*2),life=golden?3.2f:2.8f;Vector3 basePos=puff.transform.position;
            for(float t=0;t<1;t+=Time.deltaTime/life)
            {
                float radius=.08f+t*.35f;
                puff.transform.position=basePos+new Vector3(Mathf.Cos(spin+t*5)*radius,t*1.5f,Mathf.Sin(spin+t*5)*radius);
                puff.transform.localScale=Vector3.one*Mathf.Lerp(.1f,.55f,t);
                block.SetColor("_BaseColor",new Color(tint.r,tint.g,tint.b,.16f*(1-t)*(t<.15f?t/.15f:1)));
                block.SetColor("_EmissionColor",tint*(golden?.6f:.18f)*(1-t));
                r.SetPropertyBlock(block);
                if(golden&&Random.value<.02f)Sparkle(puff.transform.position,1);
                yield return null;
            }
            Destroy(puff);
        }

        // ---------- crush bits ----------
        public void Bits(Vector3 at,Color color,int count=6){for(int i=0;i<count;i++)StartCoroutine(Bit(at,color));}
        IEnumerator Bit(Vector3 at,Color color)
        {
            var b=ShopArt.Primitive("Herb bit",PrimitiveType.Sphere,null,at,Vector3.one*.02f,color,false);
            Vector3 v=new Vector3(Random.Range(-.6f,.6f),Random.Range(.6f,1.2f),Random.Range(-.6f,.6f));
            for(float t=0;t<.6f;t+=Time.deltaTime){b.transform.position+=v*Time.deltaTime;v+=Vector3.down*6*Time.deltaTime;yield return null;}
            Destroy(b);
        }

        void UpdateMarkers()
        {
            var cam=Camera.main;var s=Stations.Current;
            bool show=cam && s!=Station.None && s!=Station.Ending && s!=Station.Welcome && !(DesktopInputController.I && DesktopInputController.I.isActiveAndEnabled && DesktopInputController.I.Focused);
            if(show)
            {
                var v=Stations.View(s);Vector3 c=cam.transform.position;c.y=0;
                show=Vector3.Distance(c,new Vector3(v.Stand.x,0,v.Stand.z))>.55f;
                ring.position=new Vector3(v.Stand.x,.012f,v.Stand.z);
                float k=.8f+.06f*Mathf.Sin(Time.time*3);ring.localScale=new Vector3(k,.004f,k);
            }
            ring.gameObject.SetActive(show);
            Vector3? head=null;bool firas=false;
            var d=DialogueManager.I;
            if(d && d.Speaking)
            {
                if(d.Speaker=="فراس" && FirasController.I && FirasController.I.Shown){head=FirasController.I.HeadPosition;firas=true;}
                else{var npc=CustomerController.Speaking(d.Speaker);if(npc)head=npc.Head;}
            }
            speakerMark.gameObject.SetActive(head.HasValue);
            if(head.HasValue)
            {
                speakerMark.position=head.Value+Vector3.up*(.12f+.04f*Mathf.Sin(Time.time*4));
                speakerMark.rotation=Quaternion.Euler(45,Time.time*90,45);
                Color c=firas?new Color(.3f,1f,.85f):new Color(1f,.78f,.3f);markMat.color=c;markMat.SetColor("_EmissionColor",c*2f);
            }
        }

        // ---------- ending ----------
        public void Celebrate(){warmthTarget=1;Sparkle(liquid?liquid.position+Vector3.up*.1f:new Vector3(0,1.3f,1),18);AudioManager.I?.Play(Sfx.Crystal,1.1f);}

        void Update()
        {
            UpdateMarkers();
            var brew=GameDirector.I?GameDirector.I.Brewing:null;
            float activity=0;
            if(brew && brew.Cauldron && liquid)
            {
                var p=brew.Progress;
                activity=p.ReadyToBottle?.6f:p.ReadyToStir?.35f+p.stirring*.65f:0;
            }
            AudioManager.I?.Bubbling(liquid?liquid.position:Vector3.zero,activity);
            if(activity>0 && brew.Cauldron.Liquid)
            {
                // One shared bubble material tinted to the current brew; no per-bubble material instances.
                Color c=brew.Cauldron.Liquid.sharedMaterial.color;
                bubbleMat.color=c*1.3f;bubbleMat.SetColor("_EmissionColor",c*1.6f);
            }
            if(liquid && activity>0 && Random.value<activity*Time.deltaTime*14 && bubbles.Count<18)
            {
                var b=ShopArt.Primitive("Bubble",PrimitiveType.Sphere,null,liquid.position+new Vector3(Random.Range(-.18f,.18f),.02f,Random.Range(-.18f,.18f)),Vector3.one*Random.Range(.02f,.04f),Color.white,false);
                b.GetComponent<Renderer>().sharedMaterial=bubbleMat;
                bubbles.Add(b.transform);bubbleAge.Add(0);
            }
            steamTimer-=Time.deltaTime;
            if(liquid && steamTimer<=0){steamTimer=(BrewMap.I&&BrewMap.I.InZone?.12f:.28f)-activity*.12f;StartCoroutine(Steam(liquid.position));}
            for(int i=bubbles.Count-1;i>=0;i--)
            {
                bubbleAge[i]+=Time.deltaTime;var b=bubbles[i];
                b.position+=Vector3.up*Time.deltaTime*.05f;b.localScale*=1+Time.deltaTime*.6f;
                if(bubbleAge[i]>.8f){Destroy(b.gameObject);bubbles.RemoveAt(i);bubbleAge.RemoveAt(i);}
            }
            if(warmth!=warmthTarget)
            {
                warmth=Mathf.MoveTowards(warmth,warmthTarget,Time.deltaTime*.5f);
                for(int i=0;i<lights.Length;i++)if(lights[i])lights[i].intensity=baseIntensity[i]*(1+.3f*warmth);
                RenderSettings.ambientLight=Color.Lerp(baseAmbient,baseAmbient*1.25f+new Color(.06f,.03f,0),warmth);
            }
        }
    }
}
