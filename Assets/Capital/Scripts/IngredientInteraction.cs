using System.Linq;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit.Interactables;
using UnityEngine.XR.Interaction.Toolkit.Interactors;

namespace Capital
{
    public sealed class IngredientInteraction : MonoBehaviour
    {
        public string Kind, ArabicName;
        public int Index;
        public bool Held, Consumed, Filled;
        public Vector3 Home;
        public Quaternion HomeRotation;
        public XRGrabInteractable Grab;
        // Highlight: "use me next" items pulse gold; whatever the mouse or a VR hand points at glows brighter.
        public int HoverFrame=-10; int xrHovers;
        Material[] glowMaterials; static readonly Color GlowColor=new Color(1f,.72f,.25f);
        public static bool AnyHeld => FindObjectsByType<IngredientInteraction>(FindObjectsSortMode.None).Any(i=>i.Held);
        void Start()
        {
            Home=transform.position;HomeRotation=transform.rotation;
            var body=GetComponent<Rigidbody>() ?? gameObject.AddComponent<Rigidbody>();
            body.mass=.15f;body.useGravity=false;body.isKinematic=true;
            Grab=GetComponent<XRGrabInteractable>() ?? gameObject.AddComponent<XRGrabInteractable>();
            Grab.throwOnDetach=false;Grab.movementType=XRBaseInteractable.MovementType.Kinematic;
            // Hands hold tools by the handle, not by the model's base.
            var grip=new GameObject("Grip point").transform;grip.SetParent(transform,false);grip.localPosition=ShopArt.GripPoint(Kind);
            Grab.attachTransform=grip;
            // A socket capturing the bottle is not a hand holding it; otherwise Held sticks and blocks the book.
            Grab.selectEntered.AddListener(a=>{if(a.interactorObject is XRSocketInteractor)return;Held=true;AudioManager.I?.Cue(.8f);});
            Grab.selectExited.AddListener(a=>{if(a.interactorObject is XRSocketInteractor)return;Held=false;TryDrop();});
            Grab.hoverEntered.AddListener(a=>{if(!(a.interactorObject is XRSocketInteractor))xrHovers++;});
            Grab.hoverExited.AddListener(a=>{if(!(a.interactorObject is XRSocketInteractor))xrHovers=Mathf.Max(0,xrHovers-1);});
            glowMaterials=GetComponentsInChildren<Renderer>().Where(r=>r.name!="Liquid").SelectMany(r=>r.materials).Where(m=>!m.name.Contains("Glow")).ToArray();
            foreach(var m in glowMaterials){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",Color.black);}
        }
        void LateUpdate()
        {
            if(glowMaterials==null)return;
            bool hover=!Consumed && (HoverFrame>=Time.frameCount-1 || xrHovers>0) && !Held;
            float pulse=Stations.IsTarget(this)&&!Held?.18f+.22f*(.5f+.5f*Mathf.Sin(Time.time*4.5f)):0;
            float glow=hover?.75f:pulse;
            foreach(var m in glowMaterials)if(m)m.SetColor("_EmissionColor",GlowColor*glow);
        }
        public void TryDrop()
        {
            if(Consumed || GameManager.I.InteractionPaused)return;
            var brew=GameDirector.I.Brewing;
            if(Kind=="herb" && Vector3.Distance(transform.position,brew.MortarPosition)<.37f) brew.Mortar.Insert(this);
            else if((Kind=="crushed" || Kind=="crystal" || Kind=="water") && OverCauldron(transform.position)) brew.Cauldron.Accept(this);
            else if(Kind=="bottle" && Near(transform.position,brew.BottlePosition,.32f,.6f)) brew.Bottler.Snap(this);
            else if(Kind=="potion" && Near(transform.position,brew.HandoffPosition,.45f,.5f))
            {
                if(GameDirector.I.Deliver(Index))
                {
                    Consumed=true;
                    bool rejected=Index==2 && GameManager.I.State.herb==HerbDecision.UseWilted && GameManager.I.State.chapter==2;
                    StartCoroutine(MoveToDisplay(rejected));
                }
            }
        }
        System.Collections.IEnumerator MoveToDisplay(bool rejected)
        {
            Vector3 start=transform.position,end=rejected?ShopLayout.DiscardBin:ShopLayout.Display(GameManager.I.State.chapter==2?Index+1:0);
            for(float t=0;t<1;t+=Time.deltaTime){transform.position=Vector3.Lerp(start,end,Mathf.SmoothStep(0,1,t));yield return null;}
            transform.position=end;if(rejected) gameObject.SetActive(false);
        }
        // Generous drop zone for the big cauldron: anywhere over its mouth, from just below the rim to arm's height.
        static bool Near(Vector3 p,Vector3 target,float horizontal,float vertical)=>new Vector2(p.x-target.x,p.z-target.z).magnitude<horizontal && Mathf.Abs(p.y-target.y)<vertical;
        public static bool OverCauldron(Vector3 p)
        {
            Vector3 c=ShopLayout.Cauldron;
            return new Vector2(p.x-c.x,p.z-c.z).magnitude<ShopLayout.CauldronInnerRadius+.3f && p.y>c.y+.55f && p.y<c.y+2.1f;
        }
        public void Consume() {Consumed=true;Held=false;gameObject.SetActive(false);}
        public void ReturnHome(){Held=false;transform.SetPositionAndRotation(Home,HomeRotation);}
        void Update()
        {
            // Anything dropped on the floor or carried far away returns to where it belongs (no dead ends).
            if(!Held && !Consumed && (transform.position.y<Home.y-.25f || (transform.position-new Vector3(0,0,6)).magnitude>10))ReturnHome();
            if(GameManager.I && GameManager.I.InteractionPaused && Held)ReturnHome();
        }
    }
}
