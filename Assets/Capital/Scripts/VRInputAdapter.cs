using System.Collections;
using System.Linq;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.XR;
using UnityEngine.XR;
using UnityEngine.XR.Management;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Interactors;
using UnityEngine.XR.Interaction.Toolkit.Inputs.Readers;
using Unity.XR.CoreUtils;
using CommonUsages = UnityEngine.XR.CommonUsages;

namespace Capital
{
    // Reads one controller in either runtime: browser VR (WebXR Export) or PC VR (OpenXR via InputDevices).
    public static class HandInput
    {
        static readonly System.Collections.Generic.Dictionary<XRNode,Component> web=new System.Collections.Generic.Dictionary<XRNode,Component>();
        public static bool Web=>CapitalWeb.WebHands.IsWebGL;
        public static void RegisterWeb(XRNode node,Component c)=>web[node]=c;
        static Component W(XRNode n)=>web.TryGetValue(n,out var c)?c:null;
        static UnityEngine.XR.InputDevice D(XRNode n)=>InputDevices.GetDeviceAtXRNode(n);
        public static bool Grip(XRNode n){if(Web)return CapitalWeb.WebHands.Grip(W(n));D(n).TryGetFeatureValue(CommonUsages.gripButton,out bool b);return b;}
        public static bool Trigger(XRNode n){if(Web)return CapitalWeb.WebHands.Trigger(W(n));D(n).TryGetFeatureValue(CommonUsages.triggerButton,out bool b);return b;}
        public static bool Primary(XRNode n){if(Web)return CapitalWeb.WebHands.PrimaryDown(W(n));D(n).TryGetFeatureValue(CommonUsages.primaryButton,out bool b);return b;}
        public static Vector2 Stick(XRNode n){if(Web)return CapitalWeb.WebHands.Stick(W(n));D(n).TryGetFeatureValue(CommonUsages.primary2DAxis,out Vector2 v);return v;}
        public static void Pulse(XRNode n,float a,float s){if(Web)CapitalWeb.WebHands.Pulse(W(n),a,s);else D(n).SendHapticImpulse(0,a,s);}
    }

    // VR entry. Browser build: VR starts when the player presses "Enter VR" on the page (WebXR) and ends when
    // they leave it, handing control back to the desktop/touch controls. PC build: `--vr` with an OpenXR runtime.
    public sealed class VRInputAdapter:MonoBehaviour
    {
        public static bool Active;
        GameObject rig;Transform desktopRig;
        IEnumerator Start()
        {
            if(HandInput.Web)
            {
                yield return null; // scene HUD + desktop rig exist first
                CapitalWeb.WebHands.Hook();
                CapitalWeb.WebHands.VRChanged+=OnWebVR;
                if(CapitalWeb.WebHands.InVR)EnterVR(); // scene loaded while already in the headset
                yield break;
            }
            if(!System.Environment.GetCommandLineArgs().Contains("--vr"))yield break;
            var manager=XRGeneralSettings.Instance?.Manager;
            if(manager==null){Debug.LogWarning("VR requested, OpenXR settings unavailable");yield break;}
            if(!manager.isInitializationComplete)yield return manager.InitializeLoader();
            if(manager.activeLoader==null){Debug.LogWarning("No headset runtime; desktop fallback");yield break;}
            manager.StartSubsystems();
            EnterVR();
        }
        bool ownsSession;
        void OnDestroy(){if(HandInput.Web)CapitalWeb.WebHands.VRChanged-=OnWebVR;if(ownsSession)Active=false;}
        void OnWebVR(bool on){if(this==null)return;if(on)EnterVR();else ExitVR();}

        void EnterVR()
        {
            if(ownsSession)return;ownsSession=true;Active=true;
            var camera=GetComponent<Camera>();
            var desktop=GetComponent<DesktopInputController>();if(desktop)desktop.enabled=false;
            desktopRig=transform.parent;
            if(desktopRig && desktopRig.name=="Desktop player"){var cc=desktopRig.GetComponent<CharacterController>();if(cc)cc.enabled=false;}
            // Room-scale rig standing where the player currently is; free locomotion around the shop.
            Vector3 feet=transform.position;feet.y=0;float yaw=transform.eulerAngles.y;
            if(!rig)
            {
                rig=new GameObject("XR Origin",typeof(XROrigin));
                if(!FindFirstObjectByType<XRInteractionManager>())new GameObject("XR Interaction Manager").AddComponent<XRInteractionManager>();
                MakeHand(rig.transform,XRNode.LeftHand);MakeHand(rig.transform,XRNode.RightHand);
                rig.AddComponent<VRLocomotion>().Head=transform;
            }
            rig.SetActive(true);
            rig.transform.position=feet;rig.transform.rotation=Quaternion.Euler(0,yaw,0);
            transform.SetParent(rig.transform,false);transform.localPosition=Vector3.zero;transform.localRotation=Quaternion.identity;
            var origin=rig.GetComponent<XROrigin>();origin.Camera=camera;origin.RequestedTrackingOriginMode=XROrigin.TrackingOriginMode.Floor;
            if(!HandInput.Web && !GetComponent<TrackedPoseDriver>())
            {
                var pose=gameObject.AddComponent<TrackedPoseDriver>();
                pose.positionInput=new InputActionProperty(new InputAction("Head position",InputActionType.Value,"<XRHMD>/centerEyePosition"));
                pose.rotationInput=new InputActionProperty(new InputAction("Head rotation",InputActionType.Value,"<XRHMD>/centerEyeRotation"));
                pose.positionInput.action.Enable();pose.rotationInput.action.Enable();
            }
            rig.GetComponent<VRLocomotion>().Activate();
            // Browser headsets: drop full-screen post effects in VR to hold frame rate (they render twice per frame).
            if(HandInput.Web){var data=camera.GetComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>();if(data)data.renderPostProcessing=false;}
            UIManager.I.EnableXR(camera);
        }

        // Browser only: leaving VR returns to desktop/touch play from the same spot.
        void ExitVR()
        {
            if(!ownsSession)return;ownsSession=false;Active=false;
            Vector3 feet=transform.position;feet.y=0;float yaw=transform.eulerAngles.y;
            if(desktopRig)
            {
                transform.SetParent(desktopRig,false);
                var cc=desktopRig.GetComponent<CharacterController>();
                desktopRig.position=feet;if(cc)cc.enabled=true;
            }
            if(rig)rig.SetActive(false);
            var desktop=GetComponent<DesktopInputController>();if(desktop){desktop.enabled=true;desktop.SetYaw(yaw);}
            UIManager.I.DisableXR();
        }

        // WebXR feeds the headset pose through Unity's XR input; drive the camera from it directly.
        void Update()
        {
            if(!ownsSession || !HandInput.Web)return;
            var head=InputDevices.GetDeviceAtXRNode(XRNode.CenterEye);
            if(head.TryGetFeatureValue(CommonUsages.centerEyePosition,out Vector3 p))transform.localPosition=p;
            else if(head.TryGetFeatureValue(CommonUsages.devicePosition,out p))transform.localPosition=p;
            if(head.TryGetFeatureValue(CommonUsages.centerEyeRotation,out Quaternion r))transform.localRotation=r;
            else if(head.TryGetFeatureValue(CommonUsages.deviceRotation,out r))transform.localRotation=r;
        }
        static void MakeHand(Transform rig,XRNode node)
        {
            var go=new GameObject(node.ToString());go.transform.SetParent(rig,false);
            if(HandInput.Web)HandInput.RegisterWeb(node,CapitalWeb.WebHands.Attach(go,node==XRNode.LeftHand));
            go.AddComponent<VRHand>().Node=node;
        }
    }
    public sealed class VRHand:MonoBehaviour
    {
        public XRNode Node;
        XRDirectInteractor direct;XRRayInteractor ray;
        bool lastMenu,lastTrigger;
        void Start()
        {
            var sphere=gameObject.AddComponent<SphereCollider>();sphere.radius=.09f;sphere.isTrigger=true;
            var rb=gameObject.AddComponent<Rigidbody>();rb.isKinematic=true;rb.useGravity=false;
            direct=gameObject.AddComponent<XRDirectInteractor>();
            direct.selectInput.inputSourceMode=XRInputButtonReader.InputSourceMode.ManualValue;
            var child=new GameObject("UI ray");child.transform.SetParent(transform,false);
            ray=child.AddComponent<XRRayInteractor>();ray.enableUIInteraction=true;
            ray.selectInput.inputSourceMode=XRInputButtonReader.InputSourceMode.ManualValue;
            ray.uiPressInput.inputSourceMode=XRInputButtonReader.InputSourceMode.ManualValue;
            child.AddComponent<UnityEngine.XR.Interaction.Toolkit.Interactors.Visuals.XRInteractorLineVisual>();
            // Visible hand: brass glove-ball with a pointer nub so players see where they reach.
            ShopArt.Primitive("Hand Brass",PrimitiveType.Sphere,transform,Vector3.zero,Vector3.one*.07f,ShopArt.Brass,false);
            ShopArt.Primitive("Pointer Brass",PrimitiveType.Capsule,transform,new Vector3(0,0,.05f),new Vector3(.025f,.03f,.025f),ShopArt.Brass,false).transform.localRotation=Quaternion.Euler(90,0,0);
            direct.selectEntered.AddListener(_=>HandInput.Pulse(Node,.3f,.08f));
            direct.hoverEntered.AddListener(_=>HandInput.Pulse(Node,.1f,.03f));
        }
        void Update()
        {
            if(!HandInput.Web)
            {
                var device=InputDevices.GetDeviceAtXRNode(Node);
                if(device.TryGetFeatureValue(CommonUsages.devicePosition,out Vector3 p))transform.localPosition=p;
                if(device.TryGetFeatureValue(CommonUsages.deviceRotation,out Quaternion r))transform.localRotation=r;
            }
            bool grip=HandInput.Grip(Node),trigger=HandInput.Trigger(Node);
            bool paused=GameManager.I && GameManager.I.InteractionPaused;
            direct.selectInput.QueueManualState(grip&&!paused,grip?1:0);
            ray.selectInput.QueueManualState(false,0);ray.uiPressInput.QueueManualState(trigger,trigger?1:0);
            // Pointing at the shop door and pulling the trigger opens it (VR has no E key).
            if(trigger && !lastTrigger && !paused && GameDirector.I && GameDirector.I.Phase==Phase.Intro &&
                Physics.Raycast(transform.position,transform.forward,out var hit,3f,~0,QueryTriggerInteraction.Ignore) &&
                hit.collider.name=="Shop door")GameDirector.I.OpenShopDoor();
            lastTrigger=trigger;
            bool menu=HandInput.Primary(Node);
            if(Node==XRNode.LeftHand && menu&&!lastMenu)FindFirstObjectByType<GlossaryManager>().Toggle();lastMenu=menu;
            if(!paused && GameDirector.I)
            {
                foreach(var selected in direct.interactablesSelected)
                {
                    var item=selected.transform.GetComponent<IngredientInteraction>();
                    if(item && item.Kind=="pestle")GameDirector.I.Brewing.Mortar?.Observe(item.transform.position,true);
                    if(item && item.Kind=="spoon")GameDirector.I.Brewing.Cauldron?.Observe(item.transform.position,true);
                }
                if(trigger && Node==XRNode.RightHand)GameDirector.I.Brewing.Bottler?.Pour(Time.deltaTime);
            }
        }
    }

    // Comfort-first locomotion: left stick = smooth walk (head-relative, 1.5 m/s, collides with the shop),
    // right stick left/right = 30 degree snap turn, right stick forward = aim a teleport arc, release to jump.
    public sealed class VRLocomotion:MonoBehaviour
    {
        public Transform Head;
        CharacterController body;LineRenderer arc;Transform marker;
        bool turnLatched,aiming;Vector3 teleportTarget;bool targetValid;float fall;
        void Start()
        {
            body=gameObject.AddComponent<CharacterController>();body.radius=.22f;body.height=1.6f;body.center=Vector3.up*.8f;body.stepOffset=.25f;body.skinWidth=.03f;
            arc=gameObject.AddComponent<LineRenderer>();arc.positionCount=0;arc.startWidth=.015f;arc.endWidth=.015f;
            arc.material=ShopArt.Material("Teleport arc Glow",new Color(.3f,1f,.85f),true);arc.enabled=false;
            marker=ShopArt.Primitive("Teleport marker Glow",PrimitiveType.Cylinder,null,Vector3.zero,new Vector3(.5f,.005f,.5f),new Color(.3f,1f,.85f),false).transform;
            marker.gameObject.SetActive(false);
            Activate();
        }
        public void Activate(){if(body)PlayerRig.Teleport=(p,yaw)=>{transform.rotation=Quaternion.Euler(0,yaw,0);MoveHeadTo(p);};}
        void MoveHeadTo(Vector3 floorPoint)
        {
            Vector3 headFlat=Head.position-transform.position;headFlat.y=0;
            body.enabled=false;transform.position=new Vector3(floorPoint.x,0,floorPoint.z)-headFlat;body.enabled=true;
        }
        void Update()
        {
            if(!Head)return;
            bool paused=GameManager.I && GameManager.I.InteractionPaused;
            // Keep the body capsule under the head as the player walks around their real room.
            Vector3 local=transform.InverseTransformPoint(Head.position);body.center=new Vector3(local.x,.8f,local.z);
            Vector2 move=HandInput.Stick(XRNode.LeftHand),turn=HandInput.Stick(XRNode.RightHand);
            fall=body.isGrounded?-1:fall-9.8f*Time.deltaTime;
            Vector3 v=Vector3.zero;
            if(!paused && move.sqrMagnitude>.04f)
            {
                Vector3 f=Head.forward;f.y=0;f.Normalize();Vector3 r=Vector3.Cross(Vector3.up,f);
                v=(f*move.y+r*move.x)*1.5f;
            }
            body.Move((v+Vector3.up*fall)*Time.deltaTime);
            if(Mathf.Abs(turn.x)>.75f && !turnLatched && !aiming)
            {transform.RotateAround(Head.position,Vector3.up,Mathf.Sign(turn.x)*30);turnLatched=true;}
            if(Mathf.Abs(turn.x)<.3f)turnLatched=false;
            // Teleport aim while the right stick is pushed forward; jump on release.
            if(!paused && turn.y>.7f){aiming=true;Aim();}
            else if(aiming)
            {
                aiming=false;arc.enabled=false;marker.gameObject.SetActive(false);
                if(targetValid){var target=teleportTarget;if(UIManager.I)UIManager.I.Blink(()=>MoveHeadTo(target));else MoveHeadTo(target);}
            }
        }
        void Aim()
        {
            var hand=transform.Find(XRNode.RightHand.ToString());if(!hand)return;
            var points=new System.Collections.Generic.List<Vector3>();Vector3 p=hand.position,vel=hand.forward*6.5f;targetValid=false;
            for(int i=0;i<40;i++)
            {
                points.Add(p);Vector3 next=p+vel*.04f;vel+=Vector3.down*9.8f*.04f;
                if(Physics.Linecast(p,next,out var hit,~0,QueryTriggerInteraction.Ignore))
                {
                    points.Add(hit.point);
                    targetValid=hit.normal.y>.75f && hit.point.y<.3f && Vector3.Distance(hit.point,new Vector3(0,0,4))<13;
                    teleportTarget=hit.point;break;
                }
                p=next;
            }
            arc.enabled=true;arc.positionCount=points.Count;arc.SetPositions(points.ToArray());
            arc.material.color=targetValid?new Color(.3f,1f,.85f):new Color(1f,.35f,.3f);
            marker.gameObject.SetActive(targetValid);if(targetValid)marker.position=teleportTarget+Vector3.up*.01f;
        }
    }
}
