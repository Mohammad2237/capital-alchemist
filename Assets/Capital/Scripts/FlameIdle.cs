using UnityEngine;
namespace Capital
{
    public sealed class FlameIdle:MonoBehaviour
    {
        Vector3 scale;
        void Start(){scale=transform.localScale;}
        void Update(){transform.localScale=scale*(1+Mathf.Sin(Time.time*7+transform.position.z*3+transform.position.x)*.08f);}
    }
    // Gentle fire/torch flicker (Perlin noise, never strobing).
    public sealed class LightFlicker:MonoBehaviour
    {
        Light l;float baseIntensity,seed;
        void Start(){l=GetComponent<Light>();baseIntensity=l?l.intensity:1;seed=transform.position.x*13+transform.position.z*7;}
        void Update(){if(l)l.intensity=baseIntensity*(.86f+.24f*Mathf.PerlinNoise(seed,Time.time*2.2f));}
    }
}
