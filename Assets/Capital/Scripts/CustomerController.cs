using System.Collections;
using UnityEngine;
namespace Capital
{
    // Animated customer/merchant (KayKit rig). Waits outside, the door swings open, walks in along
    // ShopLayout.CustomerPath to the counter and idles; reacts to prices and to the handed-over potion.
    public sealed class CustomerController:MonoBehaviour
    {
        Animator anim;float gestureAt;int gesture;
        public static CustomerController Current;
        public bool Arrived{get;private set;}
        public string SpeakerName=>name.StartsWith("Merchant")?"التاجر":"الزبون";
        public Vector3 Head=>transform.position+Vector3.up*(name.StartsWith("Merchant")?1.95f:1.85f);
        const float Speed=1.05f,TurnSpeed=240;
        void Awake(){anim=GetComponentInChildren<Animator>();Current=this;}
        // While this character's lines play, they talk with their hands (alternating gestures).
        void Update()
        {
            var d=DialogueManager.I;
            if(!Arrived || !d || !d.Speaking || d.Speaker!=SpeakerName || Time.time<gestureAt)return;
            gestureAt=Time.time+2.4f;Play(gesture++%2==0?"Interact":"Use_Item");
        }
        void Start(){transform.position=ShopLayout.CustomerPath[0];StartCoroutine(Enter());}
        IEnumerator Enter()
        {
            Play("Idle");
            yield return new WaitForSeconds(1.2f);
            ShopFx.I?.SwingDoor();
            yield return new WaitForSeconds(.8f);
            Play("Walking_A");
            for(int i=1;i<ShopLayout.CustomerPath.Length;i++)
            {
                Vector3 target=ShopLayout.CustomerPath[i];
                while((transform.position-target).sqrMagnitude>.0025f)
                {
                    Vector3 d=target-transform.position;d.y=0;
                    if(d.sqrMagnitude>1e-5f)transform.rotation=Quaternion.RotateTowards(transform.rotation,Quaternion.LookRotation(d),TurnSpeed*Time.deltaTime);
                    transform.position=Vector3.MoveTowards(transform.position,target,Speed*Time.deltaTime);
                    yield return null;
                }
            }
            // Face the counter (+Z) and settle.
            var face=Quaternion.LookRotation(Vector3.forward);
            while(Quaternion.Angle(transform.rotation,face)>1){transform.rotation=Quaternion.RotateTowards(transform.rotation,face,TurnSpeed*Time.deltaTime);yield return null;}
            Play("Idle");Arrived=true;
        }
        public void React(bool happy)=>StartCoroutine(AfterArrival(happy?"Cheer":"Hit_A"));
        public void Receive()=>StartCoroutine(AfterArrival("Interact"));
        public void Inspect()=>StartCoroutine(AfterArrival("Use_Item"));
        IEnumerator AfterArrival(string state){float t=0;while(!Arrived&&t<6){t+=Time.deltaTime;yield return null;}Play(state);}
        void Play(string state){if(anim&&anim.runtimeAnimatorController&&anim.HasState(0,Animator.StringToHash(state)))anim.CrossFadeInFixedTime(state,.2f);}
    }
}
