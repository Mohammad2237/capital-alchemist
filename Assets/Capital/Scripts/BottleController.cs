using System.Collections;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit.Interactors;
namespace Capital
{
    // Bottling: snap an empty bottle into the brass ring, then hold F (desktop) / right trigger (VR).
    // A brass ladle scoops brew from the cauldron, arcs over to the funnel and tips; the brew streams
    // through the funnel into the bottle. The animation is driven by the fill amount, so it stays in sync
    // with the player's input (and the assist button).
    public sealed class BottleController : MonoBehaviour
    {
        BrewingController brew;
        public IngredientInteraction Current;
        float fill;int lastPourFrame=-10;
        Transform liquid,ladle,ladleBrew;Color color;
        LineRenderer stream,ladleStream;
        const float PourSeconds=2.2f,ScoopShare=.25f;
        Vector3 Dir{get{Vector3 d=transform.position-ShopLayout.Liquid;d.y=0;return d.normalized;}}
        Vector3 Rest=>ShopLayout.Liquid+Dir*.6f+Vector3.up*.16f;
        Vector3 Dip=>ShopLayout.Liquid+Dir*.28f+Vector3.down*.02f;
        Vector3 OverFunnel=>transform.position+Vector3.up*.52f-Dir*.09f;

        public void Initialize(BrewingController b)
        {
            brew=b;
            // An actual XRI socket provides physical capture; the state gate validates recipe/role.
            var trigger=gameObject.AddComponent<SphereCollider>();trigger.radius=.17f;trigger.isTrigger=true;
            var socket=gameObject.AddComponent<XRSocketInteractor>();socket.showInteractableHoverMeshes=false;
            socket.selectEntered.AddListener(args=>{
                var item=args.interactableObject.transform.GetComponent<IngredientInteraction>();
                if(item && item.Kind=="bottle") Snap(item);
            });
            stream=gameObject.AddComponent<LineRenderer>();stream.positionCount=2;stream.startWidth=.012f;stream.endWidth=.016f;
            stream.material=ShopArt.Material("Pour Glow",new Color(.16f,.85f,.5f),true);stream.enabled=false;
            var ls=new GameObject("Ladle stream");ls.transform.SetParent(transform,false);
            ladleStream=ls.AddComponent<LineRenderer>();ladleStream.positionCount=8;ladleStream.startWidth=.022f;ladleStream.endWidth=.014f;
            ladleStream.material=stream.material;ladleStream.enabled=false;
            BuildLadle();
        }
        void BuildLadle()
        {
            ladle=new GameObject("Pouring ladle").transform;ladle.position=Rest;ladle.rotation=Quaternion.FromToRotation(Vector3.right,Dir);
            ShopArt.Lathe("Ladle bowl Brass",ladle,Vector3.zero,new[]{new Vector2(0,-.045f),new Vector2(.05f,-.04f),new Vector2(.075f,-.01f),new Vector2(.08f,.02f),new Vector2(.074f,.022f)},ShopArt.Brass,18);
            var handle=ShopArt.Primitive("Ladle handle Brass",PrimitiveType.Cylinder,ladle,new Vector3(-.26f,.15f,0),new Vector3(.018f,.24f,.018f),ShopArt.Brass,false);
            handle.transform.localRotation=Quaternion.Euler(0,0,58);
            ladleBrew=ShopArt.Primitive("Ladle brew Glow",PrimitiveType.Cylinder,ladle,new Vector3(0,.0f,0),new Vector3(.13f,.004f,.13f),new Color(.1f,.72f,.4f),false).transform;
            ladleBrew.gameObject.SetActive(false);
        }
        public void Snap(IngredientInteraction item)
        {
            if(Current==item)return; // the XR socket and the drop check can both report the same bottle
            if(Current || item.Kind!="bottle" || !brew.Progress.ReadyToBottle){UIManager.I.Toast(Current?"انتظر حتى تمتلئ القارورة الحالية":"أكمل الخلط أولًا");return;}
            Current=item;fill=0;item.transform.position=transform.position;item.Held=false;
            color=item.Index==2 && brew.Batch && GameManager.I.State.herb==HerbDecision.UseWilted?new Color(.4f,.38f,.27f):
                brew.Batch && GameManager.I.State.supplier==Supplier.Premium?new Color(.16f,.85f,.56f):new Color(.1f,.72f,.4f);
            liquid=ShopArt.Fill(item.transform,0,color);item.transform.rotation=Quaternion.identity;
            brew.UpdateObjective();AudioManager.I.Play(Sfx.Glass,1.1f,.7f);
        }
        public void Pour(float dt)
        {
            if(!Current || GameManager.I.InteractionPaused)return;
            float before=fill;
            fill=Mathf.Min(1,fill+dt/PourSeconds);lastPourFrame=Time.frameCount;
            if(before<ScoopShare*.4f && fill>=ScoopShare*.4f)AudioManager.I.Play(Sfx.Splash,.75f,.6f);
            if(before<ScoopShare && fill>=ScoopShare)AudioManager.I.Play(Sfx.Splash,.55f,.45f);
            AnimateLadle();
            float bottleFill=Mathf.Clamp01((fill-ScoopShare)/(1-ScoopShare));
            ShopArt.Fill(Current.transform,bottleFill,color);
            Current.transform.rotation=Quaternion.Euler(0,0,Mathf.Sin(bottleFill*Mathf.PI*3)*3);
            UIManager.I.Progress("تعبئة القارورة: "+Mathf.RoundToInt(bottleFill*100)+"%");
            if(fill>=1)
            {
                stream.enabled=false;ladleStream.enabled=false;StartCoroutine(ReturnLadle());
                Current.Kind="potion";Current.ArabicName="جرعة النشاط";Current.Filled=true;
                Current.transform.rotation=Quaternion.identity;
                Current.transform.position=ShopLayout.FinishedBottle(brew.Filled);
                Current.Home=Current.transform.position;Current.HomeRotation=Quaternion.identity;
                ShopArt.Primitive("Parchment label",PrimitiveType.Cube,Current.transform,new Vector3(0,.05f,-.056f),new Vector3(.06f,.04f,.006f),UIManager.Paper,false);
                if(brew.Batch)GameManager.I.Finance.CraftBatchBottle(Current.Index);
                ShopFx.I?.Sparkle(Current.transform.position+Vector3.up*.08f,8);
                Current=null;brew.Filled++;AudioManager.I.Play(Sfx.Glass);GameDirector.I.BottleFinished();brew.UpdateObjective();
            }
        }
        void AnimateLadle()
        {
            Quaternion baseRot=Quaternion.FromToRotation(Vector3.right,Dir);
            var brewMat=ladleBrew.GetComponent<Renderer>().sharedMaterial;brewMat.color=color;brewMat.SetColor("_EmissionColor",color*1.5f);
            if(fill<ScoopShare)
            {
                // Scoop: rest -> dip into the brew -> arc up and over to the funnel.
                float t=fill/ScoopShare;
                Vector3 p;
                if(t<.35f)p=Vector3.Lerp(Rest,Dip,Mathf.SmoothStep(0,1,t/.35f));
                else{float u=Mathf.SmoothStep(0,1,(t-.35f)/.65f);Vector3 ctrl=(Dip+OverFunnel)*.5f+Vector3.up*.55f;p=(1-u)*(1-u)*Dip+2*(1-u)*u*ctrl+u*u*OverFunnel;}
                ladle.SetPositionAndRotation(p,baseRot);
                ladleBrew.gameObject.SetActive(t>.3f);ladleBrew.localScale=new Vector3(.13f,.004f,.13f);
                stream.enabled=false;ladleStream.enabled=false;
            }
            else
            {
                // Pour: tip the ladle over the funnel; brew streams into the funnel and down into the bottle.
                float t=(fill-ScoopShare)/(1-ScoopShare);
                float tilt=Mathf.Lerp(35,80,Mathf.SmoothStep(0,1,Mathf.Min(1,t*1.6f)));
                ladle.SetPositionAndRotation(OverFunnel,baseRot*Quaternion.Euler(0,0,-tilt));
                ladleBrew.gameObject.SetActive(t<.85f);ladleBrew.localScale=new Vector3(.13f*(1-t*.8f),.004f,.13f*(1-t*.8f));
                Vector3 lip=ladle.TransformPoint(new Vector3(.08f,.02f,0)),funnelTop=transform.position+Vector3.up*.38f;
                ladleStream.enabled=true;
                for(int i=0;i<ladleStream.positionCount;i++){float u=i/(float)(ladleStream.positionCount-1);ladleStream.SetPosition(i,Vector3.Lerp(lip,funnelTop,u)+Vector3.down*(Mathf.Sin(u*Mathf.PI)*.0f)+Vector3.up*(1-u)*u*.04f);}
                stream.enabled=true;stream.SetPosition(0,transform.position+Vector3.up*.18f);stream.SetPosition(1,transform.position+Vector3.up*(.05f+.09f*t));
                ladleStream.material.color=color;
            }
        }
        IEnumerator ReturnLadle()
        {
            Vector3 from=ladle.position;Quaternion fromRot=ladle.rotation,toRot=Quaternion.FromToRotation(Vector3.right,Dir);
            for(float t=0;t<1;t+=Time.deltaTime/.8f){float e=Mathf.SmoothStep(0,1,t);ladle.SetPositionAndRotation(Vector3.Lerp(from,Rest,e)+Vector3.up*Mathf.Sin(e*Mathf.PI)*.2f,Quaternion.Slerp(fromRot,toRot,e));yield return null;}
            ladle.SetPositionAndRotation(Rest,toRot);ladleBrew.gameObject.SetActive(false);
        }
        void Update()
        {
            bool key=UnityEngine.InputSystem.Keyboard.current!=null && UnityEngine.InputSystem.Keyboard.current.fKey.isPressed;
            if(Current && !DesktopSmokeRunner.Running && (key||TouchControls.PourHeld))Pour(Time.deltaTime);
            // Streams only show on frames where pouring actually happened (input held or assist pressed).
            if(Current && Time.frameCount-lastPourFrame>1){stream.enabled=false;ladleStream.enabled=false;}
        }
    }
}
