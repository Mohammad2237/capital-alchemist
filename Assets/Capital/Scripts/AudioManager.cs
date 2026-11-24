using System.Collections.Generic;
using UnityEngine;
namespace Capital
{
    public enum Sfx { Chime, Grind, Splash, Glass, Coins, Knock, DoorCreak, Crystal, Reject, Paper }

    // All clips are synthesised at start-up (original, no licensing). Real recordings can replace them later
    // by dropping files with the same names into Resources/Sfx (e.g. Resources/Sfx/Coins.wav).
    public sealed class AudioManager : MonoBehaviour
    {
        public static AudioManager I;
        AudioSource effects, ambience, bubbles;
        readonly Dictionary<Sfx,AudioClip> clips=new Dictionary<Sfx,AudioClip>();
        readonly Dictionary<Sfx,float> lastPlayed=new Dictionary<Sfx,float>();
        const int Rate=44100;

        void Awake()
        {
            I=this; effects=gameObject.AddComponent<AudioSource>(); ambience=gameObject.AddComponent<AudioSource>();
            var rng=new System.Random(42);
            foreach(Sfx s in System.Enum.GetValues(typeof(Sfx)))
            {
                var file=Resources.Load<AudioClip>("Sfx/"+s);
                clips[s]=file?file:Synth(s,rng);
            }
            var fire=Make("Original hearth ambience",2f,(t,i)=>0f);
            var a=new float[fire.samples];float low=0,crackle=0;
            for(int i=0;i<a.Length;i++)
            {
                low=Mathf.Lerp(low,(float)rng.NextDouble()*2-1,.05f);
                if(rng.NextDouble()<.00025)crackle=.25f; crackle*=.996f;
                a[i]=low*.06f+crackle*Mathf.Sin(i*.9f)*.12f;
            }
            fire.SetData(a,0); ambience.clip=fire; ambience.loop=true; ambience.volume=.12f; ambience.Play();
            effects.volume=.75f;
        }

        public void Cue(float pitch=1) { effects.pitch=pitch; effects.PlayOneShot(clips[Sfx.Chime]); }

        public void Play(Sfx s,float pitch=1,float volume=1)
        {
            if(!clips.TryGetValue(s,out var c))return;
            // The same sound never stacks within a few frames (no harsh doubled hits).
            if(lastPlayed.TryGetValue(s,out float when) && Time.unscaledTime-when<.06f)return;
            lastPlayed[s]=Time.unscaledTime;
            effects.pitch=pitch; effects.PlayOneShot(c,volume);
        }

        // A soft spatial bubbling loop that follows the cauldron. Intensity 0 silences it.
        public void Bubbling(Vector3 at,float intensity)
        {
            if(!bubbles)
            {
                var go=new GameObject("Cauldron bubbling audio");bubbles=go.AddComponent<AudioSource>();
                bubbles.clip=BubbleLoop();bubbles.loop=true;bubbles.spatialBlend=1;bubbles.minDistance=.6f;bubbles.maxDistance=6;bubbles.volume=0;bubbles.Play();
            }
            bubbles.transform.position=at;
            bubbles.volume=Mathf.Lerp(bubbles.volume,Mathf.Clamp01(intensity)*.32f,Time.deltaTime*3);
        }

        void Update()
        {
            bool speaking=DialogueManager.I && DialogueManager.I.Speaking;
            ambience.volume=Mathf.Lerp(ambience.volume,speaking ? .05f:.12f,Time.deltaTime*4);
        }

        static AudioClip Make(string name,float seconds,System.Func<float,int,float> f)
        {
            int n=Mathf.CeilToInt(seconds*Rate);var clip=AudioClip.Create(name,n,1,Rate,false);var d=new float[n];
            for(int i=0;i<n;i++)d[i]=f((float)i/Rate,i);
            clip.SetData(d,0);return clip;
        }

        static AudioClip Synth(Sfx s,System.Random rng)
        {
            float Noise()=>(float)rng.NextDouble()*2-1;
            switch(s)
            {
                case Sfx.Grind:{float lp=0;return Make("Original grind",.32f,(t,i)=>{lp=Mathf.Lerp(lp,Noise(),.25f);return lp*Mathf.Sin(Mathf.PI*t/.32f)*(.7f+.3f*Mathf.Sin(t*90))*.5f;});}
                case Sfx.Splash:{float lp=0;return Make("Original splash",.5f,(t,i)=>{lp=Mathf.Lerp(lp,Noise(),.12f+.3f*Mathf.Exp(-t*8));return lp*Mathf.Exp(-t*7)*.6f+Mathf.Sin(2*Mathf.PI*(180+400*t)*t)*Mathf.Exp(-t*14)*.15f;});}
                case Sfx.Glass:return Make("Original glass clink",.6f,(t,i)=>(Mathf.Sin(2*Mathf.PI*2350*t)+.6f*Mathf.Sin(2*Mathf.PI*3720*t)+.3f*Mathf.Sin(2*Mathf.PI*5110*t))*Mathf.Exp(-t*9)*.16f);
                case Sfx.Coins:
                {
                    var hits=new[]{0f,.07f,.15f,.21f,.3f,.34f};
                    return Make("Original coins",.7f,(t,i)=>{float v=0;foreach(var h in hits){float d=t-h;if(d>=0)v+=(Mathf.Sin(2*Mathf.PI*(4200+h*900)*d)+.5f*Mathf.Sin(2*Mathf.PI*6100*d))*Mathf.Exp(-d*38);}return v*.13f;});
                }
                case Sfx.Knock:
                {
                    var hits=new[]{0f,.28f,.52f};
                    return Make("Original knock",.85f,(t,i)=>{float v=0;foreach(var h in hits){float d=t-h;if(d>=0)v+=(Mathf.Sin(2*Mathf.PI*95*d)+.5f*Noise()*Mathf.Exp(-d*90))*Mathf.Exp(-d*28);}return v*.55f;});
                }
                case Sfx.DoorCreak:return Make("Original door creak",1.1f,(t,i)=>{float f=320+120*Mathf.Sin(t*7)+60*Mathf.Sin(t*23);float saw=Mathf.Repeat(t*f,1)*2-1;return saw*Mathf.Sin(Mathf.PI*t/1.1f)*(.5f+.5f*Mathf.Sin(t*41))*.08f;});
                case Sfx.Crystal:return Make("Original crystal shimmer",1.4f,(t,i)=>{float v=0;float[] f={1320,1660,1980,2640};for(int k=0;k<f.Length;k++){float d=t-k*.09f;if(d>0)v+=Mathf.Sin(2*Mathf.PI*f[k]*d)*Mathf.Exp(-d*3.2f);}return v*.07f;});
                case Sfx.Reject:return Make("Original reject thud",.45f,(t,i)=>(Mathf.Sin(2*Mathf.PI*(140-60*t)*t)+.3f*Noise()*Mathf.Exp(-t*40))*Mathf.Exp(-t*8)*.45f);
                case Sfx.Paper:{float lp=0;return Make("Original parchment",.35f,(t,i)=>{lp=Mathf.Lerp(lp,Noise(),.6f);return lp*Mathf.Sin(Mathf.PI*t/.35f)*(.5f+.5f*Mathf.Abs(Mathf.Sin(t*60)))*.22f;});}
                default:return Make("Original glass chime",.1f,(t,i)=>Mathf.Sin(2*Mathf.PI*880*t)*Mathf.Exp(-i/700f)*.22f);
            }
        }

        AudioClip BubbleLoop()
        {
            var rng=new System.Random(7);int n=Rate*2;var d=new float[n];
            for(int b=0;b<38;b++)
            {
                int start=rng.Next(n);float f=380+(float)rng.NextDouble()*700;float len=.05f+(float)rng.NextDouble()*.06f;
                for(int i=0;i<len*Rate;i++){float t=(float)i/Rate;d[(start+i)%n]+=Mathf.Sin(2*Mathf.PI*f*(1+t*6)*t)*Mathf.Exp(-t*55)*.18f;}
            }
            var clip=AudioClip.Create("Original bubbling",n,1,Rate,false);clip.SetData(d,0);return clip;
        }
    }
}
