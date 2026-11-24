using UnityEngine;
namespace Capital
{
    public sealed class MortarController : MonoBehaviour
    {
        BrewingController brew;
        bool armed;
        float previousY;
        public void Initialize(BrewingController b){brew=b;}
        System.Collections.IEnumerator Shake()
        {
            var mortar=GameObject.Find("Stone mortar");if(!mortar)yield break;
            Vector3 p=mortar.transform.position;
            for(float t=0;t<.18f;t+=Time.deltaTime){mortar.transform.position=p+new Vector3(Mathf.Sin(t*90)*.006f,0,Mathf.Cos(t*70)*.006f);yield return null;}
            mortar.transform.position=p;
        }
        public void Insert(IngredientInteraction item)
        {
            if(item.Kind!="herb" || brew.Progress.herbInMortar)return;
            brew.Progress.herbInMortar=true;item.Consume();AudioManager.I.Cue(.5f);brew.UpdateObjective();
            ShopArt.Herb(transform,new Vector3(0,.08f,0),.1f,new Color(.38f,.16f,.1f));
        }
        public void Observe(Vector3 position,bool held)
        {
            if(!held || GameManager.I.InteractionPaused || !brew.Progress.herbInMortar || brew.Progress.crushed)return;
            float horizontal=Vector2.Distance(new Vector2(position.x,position.z),new Vector2(transform.position.x,transform.position.z));
            if(horizontal>.26f)return;
            if(position.y>transform.position.y+.18f)armed=true;
            if(armed && position.y<transform.position.y+.1f){armed=false;Stroke();}
            previousY=position.y;
        }
        public void Stroke()
        {
            if(GameManager.I.InteractionPaused || !brew.Progress.herbInMortar || brew.Progress.crushed)return;
            brew.Progress.CrushStroke();AudioManager.I.Play(Sfx.Grind,.85f+brew.Progress.strokes*.06f);
            ShopFx.I?.Bits(transform.position+Vector3.up*.12f,new Color(.6f,.16f,.08f),5);
            foreach(Transform leaf in transform)leaf.localScale*=.86f;
            StartCoroutine(Shake());
            if(brew.Progress.crushed){ShopFx.I?.Sparkle(transform.position+Vector3.up*.08f,6);AudioManager.I.Cue(.8f);}
            if(brew.Progress.crushed) brew.Spawn("crushed","عشبة مسحوقة",transform.position+new Vector3(0,.12f,0),0);
            brew.UpdateObjective();
        }
    }
}
