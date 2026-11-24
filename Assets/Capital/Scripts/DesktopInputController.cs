using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.EventSystems;
namespace Capital
{
    // Whichever rig is active (desktop or VR) registers how to move the player instantly.
    public static class PlayerRig { public static System.Action<Vector3,float> Teleport; }

    // Desktop mode: walk the shop with WASD (Shift = faster), hold the right mouse button to look,
    // E picks up / drops what the cursor points at, Tab opens the encyclopedia, R resets.
    // Same gameplay controllers and finance code as VR.
    public sealed class DesktopInputController : MonoBehaviour
    {
        public static DesktopInputController I;
        Camera cam; IngredientInteraction held; int heldLayer; IngredientInteraction hovered;
        // Station camera: glides into a framed view for each step (above the cauldron while stirring, over the
        // mortar while crushing, at the bottling stand while pouring, behind the counter facing the customer).
        // WASD walks out of it; Q (or the HUD button) glides back in. Desktop only: VR never moves the camera.
        bool focused; public bool Focused=>focused; Station focusStation=Station.None, lastStation=Station.None;
        Vector3 fromPos; Quaternion fromRot; float glide=1;
        const float GlideSeconds=1.15f;
        CharacterController body; Transform rig;
        float yaw,pitch=8,fall;
        bool resetConfirm;
        const float Eye=1.62f,Walk=1.9f,Run=3.3f,Reach=2.8f;
        void Awake(){cam=GetComponent<Camera>();I=this;}
        void Start()
        {
            if(VRInputAdapter.Active)return;
            Vector3 feet=transform.position;feet.y=0;
            yaw=transform.eulerAngles.y;pitch=Mathf.DeltaAngle(0,transform.eulerAngles.x);
            rig=new GameObject("Desktop player").transform;rig.position=feet;rig.rotation=Quaternion.Euler(0,yaw,0);
            body=rig.gameObject.AddComponent<CharacterController>();
            body.height=1.7f;body.radius=.24f;body.center=Vector3.up*.86f;body.stepOffset=.25f;body.skinWidth=.03f;body.slopeLimit=50;
            transform.SetParent(rig,false);transform.localPosition=Vector3.up*Eye;transform.localRotation=Quaternion.Euler(pitch,0,0);
            RegisterTeleport();
        }
        void OnEnable(){if(rig)RegisterTeleport();}
        void RegisterTeleport(){PlayerRig.Teleport=(p,y)=>{body.enabled=false;rig.position=new Vector3(p.x,0,p.z);yaw=y;rig.rotation=Quaternion.Euler(0,yaw,0);body.enabled=true;};}
        public void SetYaw(float y){yaw=y;pitch=8;focused=false;glide=1;lastStation=Stations.Current;}
        void Update()
        {
            if(!GameManager.I || !GameDirector.I || Mouse.current==null || Keyboard.current==null || !rig)return;
            Vector3 renderedPos=transform.position;Quaternion renderedRot=transform.rotation;
            var station=Stations.Current;
            if(station!=lastStation)
            {
                lastStation=station;
                if(held)Release(false);
                bool hasView=station!=Station.None && station!=Station.Welcome;
                if(hasView)FocusOn(station,renderedPos,renderedRot);else if(focused)Unfocus(renderedPos,renderedRot);
            }
            if(DesktopSmokeRunner.Running){if(EventSystem.current)EventSystem.current.enabled=false;ApplyPose();return;}
            var m=Mouse.current;var k=Keyboard.current;
            if(k.qKey.wasPressedThisFrame)FocusCurrent();
            if(k.tabKey.wasPressedThisFrame)FindFirstObjectByType<GlossaryManager>().Toggle();
            if(k.rKey.wasPressedThisFrame)
            {
                if(held){Release(false);}
                resetConfirm=true;GameManager.I.InteractionPaused=true;
                UIManager.I.Modal("إعادة التجربة؟","ستبدأ مجددًا برصيد 100 عملة.",
                    new Choice("نعم، إعادة",()=>GameManager.I.ResetRun()),new Choice("متابعة",()=>{resetConfirm=false;GameManager.I.InteractionPaused=false;GameDirector.I.Refresh();}));
            }
            if(GameManager.I.InteractionPaused){ApplyPose();return;}

            // Look (right mouse) and walk (WASD / arrows).
            bool touch=TouchControls.Active;
            if(touch && !focused && !held){Vector2 d=TouchControls.I.LookDelta;yaw+=d.x*.12f;pitch=Mathf.Clamp(pitch-d.y*.1f,-70,75);}
            if(m.rightButton.isPressed && !focused && !(held && held.Kind=="pestle" && m.leftButton.isPressed))
            {
                Vector2 d=m.delta.ReadValue();yaw+=d.x*.14f;pitch=Mathf.Clamp(pitch-d.y*.12f,-70,75);
            }
            Vector2 move=new Vector2((k.dKey.isPressed||k.rightArrowKey.isPressed?1:0)-(k.aKey.isPressed||k.leftArrowKey.isPressed?1:0),
                                     (k.wKey.isPressed||k.upArrowKey.isPressed?1:0)-(k.sKey.isPressed||k.downArrowKey.isPressed?1:0));
            if(focused && move.sqrMagnitude>0)Unfocus(renderedPos,renderedRot);
            fall=body.isGrounded?-1:fall-9.8f*Time.deltaTime;
            if(touch && TouchControls.I.Move.sqrMagnitude>.01f){move=TouchControls.I.Move;if(focused)Unfocus(transform.position,transform.rotation);}
            Vector3 v=(rig.forward*move.y+rig.right*move.x);if(v.sqrMagnitude>1)v.Normalize();v*=(k.leftShiftKey.isPressed?Run:Walk);
            body.Move((v+Vector3.up*fall)*Time.deltaTime);
            ApplyPose();

            Ray ray=cam.ScreenPointToRay(touch?TouchControls.I.Pointer:m.position.ReadValue());
            bool act=k.eKey.wasPressedThisFrame||(touch&&TouchControls.I.Tapped);
            bool overUI=EventSystem.current && EventSystem.current.IsPointerOverGameObject();
            if(held)
            {
                held.transform.position=Vector3.Lerp(held.transform.position,HeldTarget(ray,m),Time.deltaTime*20);
                if(held.Kind!="spoon")held.transform.rotation=Quaternion.Slerp(held.transform.rotation,held.HomeRotation,Time.deltaTime*10);
                else
                {
                    Vector3 off=held.transform.position-ShopLayout.Liquid;off.y=0;
                    Vector3 up=(Vector3.up+(off.sqrMagnitude>1e-4f?off.normalized*.38f:Vector3.zero)).normalized;
                    held.transform.rotation=Quaternion.Slerp(held.transform.rotation,Quaternion.FromToRotation(Vector3.up,up),Time.deltaTime*8);
                }
                var b=GameDirector.I.Brewing;
                if(held.Kind=="pestle")b.Mortar?.Observe(held.transform.position,true);
                if(held.Kind=="spoon")b.Cauldron?.Observe(held.transform.position,true);
                UIManager.I.Hint(held.ArabicName+" • E للإفلات"+(held.Kind=="pestle"?" • عند الهاون: اضغط الزر الأيسر وحرّك الفأرة للأعلى والأسفل":held.Kind=="spoon"?" • وجّه المجداف داخل المرجل وحرّكه دائريًا":""));
                if(act){if(touch)held.transform.position=HeldTarget(ray,m);Release(true);}
            }
            else if(!overUI && Physics.Raycast(ray,out var hit,Reach))
            {
                var target=hit.collider.GetComponentInParent<IngredientInteraction>();
                if(target && !target.Consumed)target.HoverFrame=Time.frameCount;
                bool door=GameDirector.I.Phase==Phase.Intro && hit.collider.name=="Shop door";
                UIManager.I.Hint(target && !target.Consumed?target.ArabicName+" • E للإمساك":door?"الباب • E للفتح":"");
                if(act)
                {
                    if(target && !target.Consumed){held=target;held.Held=true;heldLayer=held.gameObject.layer;SetLayer(held.transform,2);AudioManager.I.Cue();}
                    else if(door)GameDirector.I.OpenShopDoor();
                }
            }
            else UIManager.I.Hint("");
            if(k.homeKey.wasPressedThisFrame){pitch=8;}
        }

        // ---------------------------------------------------------------- station camera
        public void FocusCurrent()
        {
            var s=Stations.Current;
            if(s!=Station.None && s!=Station.Welcome)FocusOn(s,transform.position,transform.rotation);
        }
        void FocusOn(Station s,Vector3 rp,Quaternion rr)
        {
            fromPos=rp;fromRot=rr;glide=0;focused=true;focusStation=s;
            // The body moves to the station's standing spot, so walking off later starts from there.
            var v=Stations.View(s);
            body.enabled=false;rig.position=new Vector3(v.Stand.x,0,v.Stand.z);body.enabled=true;
            yaw=v.StandYaw;pitch=18;
        }
        void Unfocus(Vector3 rp,Quaternion rr){fromPos=rp;fromRot=rr;glide=0;focused=false;}
        void ApplyPose()
        {
            rig.rotation=Quaternion.Euler(0,yaw,0);
            Vector3 freePos=rig.position+Vector3.up*Eye;Quaternion freeRot=rig.rotation*Quaternion.Euler(pitch,0,0);
            Vector3 tp=freePos;Quaternion tr=freeRot;
            if(focused){var v=Stations.View(focusStation);tp=v.Camera;tr=v.CameraRotation;}
            glide=Mathf.Min(1,glide+Time.deltaTime/GlideSeconds);
            float e=glide*glide*(3-2*glide);
            transform.SetPositionAndRotation(Vector3.Lerp(fromPos,tp,e),Quaternion.Slerp(fromRot,tr,e));
        }

        Vector3 HeldTarget(Ray ray,Mouse m)
        {
            // Paddle: follow the cursor across the cauldron's surface so circles stir the brew.
            if(held.Kind=="spoon" && new Plane(Vector3.up,ShopLayout.Liquid).Raycast(ray,out float d))
            {
                Vector3 p=ray.GetPoint(d);Vector3 c=ShopLayout.Liquid;
                if(new Vector2(p.x-c.x,p.z-c.z).magnitude<ShopLayout.CauldronInnerRadius+.1f && Vector3.Distance(cam.transform.position,p)<Reach+.6f)
                {
                    Vector3 flat=Vector3.ClampMagnitude(new Vector3(p.x-c.x,0,p.z-c.z),ShopLayout.CauldronInnerRadius-.05f);
                    return c+flat-Vector3.up*.08f;
                }
            }
            // Pestle at the mortar: left button + vertical mouse movement pounds the herb.
            if(held.Kind=="pestle" && m.leftButton.isPressed && Vector3.Distance(cam.transform.position,ShopLayout.Mortar)<2.4f)
            {
                Vector3 p=ShopLayout.Mortar;
                p.y=Mathf.Clamp(held.transform.position.y-m.delta.ReadValue().y*.006f,ShopLayout.Mortar.y+.03f,ShopLayout.Mortar.y+.42f);
                return p;
            }
            if(Physics.Raycast(ray,out var hit,Reach,~(1<<2),QueryTriggerInteraction.Ignore))return hit.point+hit.normal*.01f;
            return cam.transform.position+ray.direction*1.1f-Vector3.up*.15f;
        }

        void Release(bool drop)
        {
            var item=held;held=null;SetLayer(item.transform,heldLayer);item.Held=false;
            if(drop)item.TryDrop();else item.ReturnHome();
        }
        static void SetLayer(Transform t,int layer){t.gameObject.layer=layer;foreach(Transform c in t)SetLayer(c,layer);}
    }
}
