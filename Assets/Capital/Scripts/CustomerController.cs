using System.Collections;
using System.Collections.Generic;
using UnityEngine;
namespace Capital
{
    // Animated NPC (KayKit rig): customer, merchant or wandering trader. Waits outside, the door swings open,
    // walks in to its spot by the counter, talks with its hands while its lines play, reacts, and can leave again.
    public sealed class CustomerController:MonoBehaviour
    {
        static readonly List<CustomerController> all=new List<CustomerController>();
        public static CustomerController Current;
        public static CustomerController Get(string role){foreach(var c in all)if(c&&c.name.StartsWith(role))return c;return null;}
        public static CustomerController Speaking(string speaker){foreach(var c in all)if(c&&c.Arrived&&c.SpeakerName==speaker)return c;return null;}

        Animator anim;float gestureAt;int gesture;Renderer[] renderers;bool walking;
        public bool Arrived{get;private set;}
        public bool WaitForCall;              // traders stay out of sight until Arrive() is called
        public System.Action OnArrived;
        bool IsTrader=>name.StartsWith("Trader");
        public string SpeakerName=>name.StartsWith("Merchant")?"التاجر":IsTrader?"التاجر المتجول":"الزبون";
        public Vector3 Head=>transform.position+Vector3.up*(name.StartsWith("Merchant")?1.95f:1.85f);
        Vector3 Spot=>IsTrader&&GameManager.I&&GameManager.I.State.chapter==2?ShopLayout.TraderSpot:ShopLayout.CustomerSpot;
        const float Speed=1.05f,TurnSpeed=240;

        void Awake(){anim=GetComponentInChildren<Animator>();renderers=GetComponentsInChildren<Renderer>();all.Add(this);if(!IsTrader)Current=this;}
        void OnDestroy(){all.Remove(this);}
        void Start()
        {
            transform.position=ShopLayout.CustomerPath[0];
            if(IsTrader)WaitForCall=true;
            if(WaitForCall)Show(false);else StartCoroutine(Enter());
        }
        void Show(bool on){foreach(var r in renderers)if(r)r.enabled=on;}
        public void Arrive(System.Action onArrived=null)
        {
            OnArrived=onArrived;if(Arrived||walking){if(Arrived)onArrived?.Invoke();return;}
            Show(true);StartCoroutine(Enter());
        }
        IEnumerator Enter()
        {
            walking=true;Play("Idle");
            yield return new WaitForSeconds(DesktopSmokeRunner.Running?.1f:1.0f);
            ShopFx.I?.SwingDoor();
            yield return new WaitForSeconds(DesktopSmokeRunner.Running?.1f:.8f);
            var path=new List<Vector3>(ShopLayout.CustomerPath);path[path.Count-1]=Spot;
            yield return Walk(path,1);
            yield return Face(Vector3.forward);
            Play("Idle");walking=false;Arrived=true;
            if(IsTrader)AudioManager.I?.Play(Sfx.Coins,.7f,.4f);
            OnArrived?.Invoke();
        }
        // Walk back out through the door and disappear.
        public void Leave(){if(Arrived)StartCoroutine(LeaveRoutine());}
        IEnumerator LeaveRoutine()
        {
            Arrived=false;walking=true;
            yield return new WaitForSeconds(1.2f);
            ShopFx.I?.SwingDoor();
            var path=new List<Vector3>{transform.position,new Vector3(.2f,0,1.0f),new Vector3(0,0,-.6f),new Vector3(0,0,-2.6f)};
            yield return Walk(path,1);
            Show(false);walking=false;
        }
        IEnumerator Walk(List<Vector3> path,int from)
        {
            Play("Walking_A");
            for(int i=from;i<path.Count;i++)
            {
                Vector3 target=path[i];
                while((transform.position-target).sqrMagnitude>.0025f)
                {
                    Vector3 d=target-transform.position;d.y=0;
                    if(d.sqrMagnitude>1e-5f)transform.rotation=Quaternion.RotateTowards(transform.rotation,Quaternion.LookRotation(d),TurnSpeed*Time.deltaTime);
                    transform.position=Vector3.MoveTowards(transform.position,target,(DesktopSmokeRunner.Running?6:Speed)*Time.deltaTime);
                    yield return null;
                }
            }
        }
        IEnumerator Face(Vector3 dir)
        {
            var face=Quaternion.LookRotation(dir);
            while(Quaternion.Angle(transform.rotation,face)>1){transform.rotation=Quaternion.RotateTowards(transform.rotation,face,TurnSpeed*Time.deltaTime);yield return null;}
        }
        // While this character's lines play, they talk with their hands (alternating gestures).
        void Update()
        {
            var d=DialogueManager.I;
            if(!Arrived || !d || !d.Speaking || d.Speaker!=SpeakerName || Time.time<gestureAt)return;
            gestureAt=Time.time+2.4f;Play(gesture++%2==0?"Interact":"Use_Item");
        }
        public void React(bool happy)=>StartCoroutine(AfterArrival(happy?"Cheer":"Hit_A"));
        public void Receive()=>StartCoroutine(AfterArrival("Interact"));
        public void Inspect()=>StartCoroutine(AfterArrival("Use_Item"));
        IEnumerator AfterArrival(string state){float t=0;while(!Arrived&&t<6){t+=Time.deltaTime;yield return null;}Play(state);}
        void Play(string state){if(anim&&anim.runtimeAnimatorController&&anim.HasState(0,Animator.StringToHash(state)))anim.CrossFadeInFixedTime(state,.2f);}
    }
}
