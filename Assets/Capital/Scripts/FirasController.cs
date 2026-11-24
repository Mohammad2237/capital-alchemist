using UnityEngine;
namespace Capital
{
    // Firas: a scripted hologram guide (KayKit Mage, translucent teal). Hidden until Appear(): he materialises
    // upward out of his crystal, then flies to wherever the current step happens (ingredient table, mortar,
    // cauldron, bottling stand, counter) and floats there facing the player. He gestures while his lines play.
    // No AI, no microphone: every line is scripted.
    public sealed class FirasController:MonoBehaviour
    {
        public static FirasController I;
        Vector3 home,position,velocity,fullScale;float appear,visibility,trailTimer;bool shown;
        Renderer[] renderers;Animator anim;string current;MaterialPropertyBlock block;
        public bool Shown=>shown;
        public Vector3 HeadPosition=>position+Vector3.up*(ShopLayout.FirasHeight+.12f);
        void Awake()
        {
            I=this;home=position=transform.position;fullScale=transform.localScale;
            renderers=GetComponentsInChildren<Renderer>();anim=GetComponentInChildren<Animator>();block=new MaterialPropertyBlock();
            transform.localScale=Vector3.zero;
        }
        public void Appear()
        {
            if(shown)return;shown=true;
            AudioManager.I?.Play(Sfx.Crystal);ShopFx.I?.Sparkle(home,16);Play("Spellcast_Raise");
        }
        Vector3 Target()
        {
            var s=Stations.Current;
            if(s==Station.None||s==Station.Ending)return home;
            return Stations.View(s).Firas;
        }
        void Update()
        {
            if(!shown)return;
            appear=Mathf.MoveTowards(appear,1,Time.deltaTime/1.6f);
            float e=Mathf.SmoothStep(0,1,appear);
            // Grows out of the crystal: a thin column of light first, then full width.
            float w=Mathf.Lerp(.15f,1,Mathf.Clamp01(e*1.6f-.4f));
            transform.localScale=new Vector3(fullScale.x*w,fullScale.y*e,fullScale.z*w);

            // Fly to the active station once fully formed (smooth, never faster than a brisk walk).
            Vector3 target=appear>=1?Target():home;
            position=Vector3.SmoothDamp(position,target,ref velocity,.9f,2.2f);
            transform.position=position+Vector3.up*(Mathf.Sin(Time.time*1.5f)*.035f);
            bool flying=velocity.magnitude>.25f;
            if(flying && (trailTimer-=Time.deltaTime)<=0){trailTimer=.12f;ShopFx.I?.Sparkle(position+Vector3.up*.5f,1);}

            // Face the player (lean a little into the flight).
            var cam=Camera.main;
            Quaternion face=transform.rotation;
            if(cam){Vector3 d=cam.transform.position-transform.position;d.y=0;if(d.sqrMagnitude>.01f)face=Quaternion.LookRotation(d);}
            if(flying){Vector3 v=velocity;v.y=0;if(v.sqrMagnitude>.01f)face=Quaternion.LookRotation(v)*Quaternion.Euler(12,0,0);}
            transform.rotation=Quaternion.Slerp(transform.rotation,face,Time.deltaTime*3f);

            bool talking=DialogueManager.I && DialogueManager.I.Speaking && DialogueManager.I.Speaker=="فراس";
            visibility=Mathf.MoveTowards(visibility,talking?1:.6f,Time.deltaTime*1.5f);
            float glow=(visibility+(talking?Mathf.Sin(Time.time*6)*.15f:0))*e;
            foreach(var r in renderers){r.GetPropertyBlock(block);block.SetColor("_EmissionColor",new Color(.1f,.62f,.52f)*glow*1.6f);r.SetPropertyBlock(block);}
            if(appear>=1)Play(talking&&!flying?"Spellcasting":"Idle");
        }
        void Play(string state)
        {
            if(current==state||!anim||!anim.runtimeAnimatorController||!anim.HasState(0,Animator.StringToHash(state)))return;
            current=state;anim.CrossFadeInFixedTime(state,.3f);
        }
    }
}
