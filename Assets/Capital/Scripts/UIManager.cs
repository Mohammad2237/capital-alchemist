using System;
using System.Collections;
using System.Collections.Generic;
using RTLTMPro;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using UnityEngine.XR.Interaction.Toolkit.UI;

namespace Capital
{
    public readonly struct Choice
    {
        public readonly string Text; public readonly Action Action;
        public Choice(string text, Action action) { Text=text; Action=action; }
    }
    public sealed class UIManager : MonoBehaviour
    {
        public static UIManager I;
        public static TMP_FontAsset Font;
        public Canvas canvas;
        RTLTextMeshPro objective, cash, subtitle, toast, hint, progress;
        RectTransform modal, actions;
        Image fade; RTLTextMeshPro cardTitle, cardSubtitle; Renderer vrFader;
        float toastUntil;
        public bool ModalVisible => modal && modal.gameObject.activeSelf || talk && talk.gameObject.activeSelf;
        public static readonly Color Ink=new Color(.19f,.12f,.075f), Paper=new Color(.9f,.81f,.62f,.98f), Gold=new Color(.76f,.53f,.22f);
        void Awake()
        {
            I=this; Font=Resources.Load<TMP_FontAsset>("Fonts/Arabic");
            canvas=new GameObject("Arabic HUD",typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster)).GetComponent<Canvas>();
            canvas.transform.SetParent(transform,false); canvas.renderMode=RenderMode.ScreenSpaceOverlay;
            var scaler=canvas.GetComponent<CanvasScaler>(); scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize; scaler.referenceResolution=new Vector2(1920,1080);
            if(!FindFirstObjectByType<EventSystem>()) new GameObject("UI input",typeof(EventSystem),typeof(UnityEngine.InputSystem.UI.InputSystemUIInputModule));
            // Any window shape (laptop, phone, portrait): the 1920x1080 HUD layout always fits, centred.
            scaler.screenMatchMode=CanvasScaler.ScreenMatchMode.Expand;
            var root=new GameObject("HUD frame",typeof(RectTransform)).GetComponent<RectTransform>();
            root.SetParent(canvas.transform,false);root.anchorMin=root.anchorMax=root.pivot=new Vector2(.5f,.5f);root.sizeDelta=new Vector2(1920,1080);
            // Coin purse (top-right): the cash figure counts up/down and each change floats a +/- amount.
            var purse=Panel(root,"Purse",(1560,26,330,92),new Color(.08f,.105f,.09f,.9f));Frame(purse,new Color(.55f,.38f,.14f));
            var coin=Panel(purse,"Coin",(18,14,64,64),Gold);coin.GetComponent<Image>().sprite=CircleSprite();
            Panel(coin,"Coin rim",(12,12,40,40),new Color(.78f,.55f,.18f)).GetComponent<Image>().sprite=CircleSprite();
            cash=Text(purse,"",(96,10,220,72),46,Paper);cash.alignment=TextAlignmentOptions.MidlineLeft;
            delta=Text(root,"",(1600,118,260,56),36,Gold);delta.alignment=TextAlignmentOptions.Center;
            // One short step at a time (top-centre).
            objectivePanel=Panel(root,"Step",(560,26,800,92),new Color(.08f,.105f,.09f,.9f));Frame(objectivePanel,new Color(.55f,.38f,.14f));
            objective=Text(objectivePanel,"",(20,8,760,76),34,Paper);objective.alignment=TextAlignmentOptions.Center;
            hint=Text(root,"",(540,720,840,70),26,Paper);hint.alignment=TextAlignmentOptions.Center;
            progress=Text(root,"",(700,640,520,55),32,Gold);progress.alignment=TextAlignmentOptions.Center;
            toast=Text(root,"",(560,128,800,56),30,Gold);toast.alignment=TextAlignmentOptions.Center;
            subPanel=Panel(root,"Subtitles",(310,900,1300,100),new Color(.045f,.065f,.06f,.92f));Frame(subPanel,new Color(.55f,.38f,.14f));
            subtitle=Text(subPanel,"",(25,10,1250,80),30,Paper);
            keys=Text(root,"WASD  •  E  •  Q  •  Tab",(560,1030,800,40),24,new Color(Paper.r,Paper.g,Paper.b,.7f));keys.alignment=TextAlignmentOptions.Center;
            Button(root,"الموسوعة",(30,26,250,62),()=>FindFirstObjectByType<GlossaryManager>().Toggle());
            Button(root,"وضع العرض",(290,26,250,62),()=>{
                GameManager.I.State.presentationMode=!GameManager.I.State.presentationMode;
                Toast(GameManager.I.State.presentationMode?"وضع العرض مفعّل":"السرعة العادية");});
            actions=Panel(root,"Actions",(560,790,800,76),Color.clear);
            Button(root,"انتقل إلى المحطة",(30,98,250,56),GoToStation);
            modal=Panel(root,"Parchment",(1060,175,820,560),Paper); modal.gameObject.SetActive(false);
            Frame(modal,new Color(.45f,.3f,.12f));
            talk=Panel(root,"Talk",(260,690,1400,200),Paper);talk.gameObject.SetActive(false);Frame(talk,new Color(.45f,.3f,.12f));
            fade=Panel(canvas.transform,"Fade",(0,0,1920,1080),Color.black).GetComponent<Image>(); fade.raycastTarget=false;
            var fr=(RectTransform)fade.transform;fr.anchorMin=Vector2.zero;fr.anchorMax=Vector2.one;fr.pivot=new Vector2(.5f,.5f);fr.anchoredPosition=Vector2.zero;fr.sizeDelta=Vector2.zero;
            cardTitle=Text(fade.transform,"",(260,380,1400,120),76,Gold);cardTitle.alignment=TextAlignmentOptions.Center;
            cardSubtitle=Text(fade.transform,"",(260,515,1400,80),40,Paper);cardSubtitle.alignment=TextAlignmentOptions.Center;
            foreach(var (txt,y) in new[]{(cardTitle,50f),(cardSubtitle,-70f)}){var r=txt.rectTransform;r.anchorMin=r.anchorMax=r.pivot=new Vector2(.5f,.5f);r.anchoredPosition=new Vector2(0,y);}
            StartCoroutine(OpeningCard());
        }
        public void EnableXR(Camera camera)
        {
            canvas.renderMode=RenderMode.WorldSpace; canvas.worldCamera=camera;
            var r=(RectTransform)canvas.transform; r.sizeDelta=new Vector2(1920,1080);
            r.localScale=Vector3.one*.0011f; xrHead=camera.transform; Recentre(true);
            if(!canvas.GetComponent<TrackedDeviceGraphicRaycaster>())canvas.gameObject.AddComponent<TrackedDeviceGraphicRaycaster>();
            var es=FindFirstObjectByType<EventSystem>();
            foreach(var module in es.GetComponents<BaseInputModule>()) Destroy(module);
            es.gameObject.AddComponent<XRUIInputModule>();
            // Head-locked fader quad so fades and title cards cover the whole headset view.
            if(vrFader)return;
            var q=GameObject.CreatePrimitive(PrimitiveType.Quad);q.name="VR fader";Destroy(q.GetComponent<Collider>());
            q.transform.SetParent(camera.transform,false);q.transform.localPosition=new Vector3(0,0,.12f);q.transform.localScale=Vector3.one*.6f;
            vrFader=q.GetComponent<Renderer>();vrFader.sharedMaterial=Resources.Load<Material>("Materials/Fader")??ShopArt.Transparent("Fader",new Color(0,0,0,0));
            vrFader.material.color=new Color(0,0,0,0);vrFader.enabled=false;vrFader.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;
        }
        // Back to the screen HUD after leaving browser VR.
        public void DisableXR()
        {
            xrHead=null;following=false;
            canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.transform.localScale=Vector3.one;
            var es=FindFirstObjectByType<EventSystem>();
            if(es){foreach(var module in es.GetComponents<BaseInputModule>())Destroy(module);es.gameObject.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();}
            if(vrFader)vrFader.enabled=false;
        }
        Transform xrHead;
        // VR: the parchment HUD floats 1.6 m in front of the player and lazily re-centres when they turn away,
        // so it never sticks to the face and is always findable while walking around the shop.
        void Recentre(bool snap)
        {
            Vector3 f=xrHead.forward;f.y=0;if(f.sqrMagnitude<1e-4f)f=Vector3.forward;f.Normalize();
            Vector3 target=xrHead.position+f*1.6f+Vector3.down*.15f;
            var r=canvas.transform;
            r.position=snap?target:Vector3.Lerp(r.position,target,Time.deltaTime*2.5f);
            r.rotation=Quaternion.Slerp(r.rotation,Quaternion.LookRotation(r.position-xrHead.position),snap?1:Time.deltaTime*3f);
        }
        bool following;
        void Update()
        {
            if(xrHead)
            {
                Vector3 toCanvas=canvas.transform.position-xrHead.position;toCanvas.y=0;Vector3 f=xrHead.forward;f.y=0;
                if(Vector3.Angle(toCanvas,f)>38 || toCanvas.magnitude>2.6f || toCanvas.magnitude<.9f)following=true;
                if(following){Recentre(false);if(Vector3.Angle(toCanvas,f)<6 && Mathf.Abs(toCanvas.magnitude-1.6f)<.15f)following=false;}
            }
            if(GameManager.I)
            {
                int real=GameManager.I.State.Cash;
                if(shownCash<0)shownCash=real;
                if(real!=lastCash){if(lastCash>=0){int d=real-lastCash;delta.text=(d>0?"+":"")+d;delta.color=d>0?new Color(.45f,1f,.55f):new Color(1f,.45f,.35f);deltaUntil=Time.unscaledTime+1.6f;}lastCash=real;}
                shownCash=Mathf.MoveTowards(shownCash,real,Mathf.Max(20,Mathf.Abs(real-shownCash)*3)*Time.unscaledDeltaTime);
                cash.text=Mathf.RoundToInt(shownCash).ToString();
            }
            float dl=deltaUntil-Time.unscaledTime;delta.alpha=Mathf.Clamp01(dl);delta.rectTransform.anchoredPosition=new Vector2(1600,-118-(1.6f-Mathf.Clamp(dl,0,1.6f))*30);
            float tl=toastUntil-Time.unscaledTime;toast.alpha=Mathf.Clamp01(tl*1.5f);if(tl<=0)toast.text="";
            subPanel.gameObject.SetActive(!string.IsNullOrEmpty(subtitle.text)&&!TalkVisible);
            objectivePanel.gameObject.SetActive(!string.IsNullOrEmpty(objective.text));
            keys.alpha=Mathf.Clamp01(1-(Time.timeSinceLevelLoad-25)/3f)*.7f;keys.gameObject.SetActive(!xrHead&&keys.alpha>0);
        }
        public void Objective(string s) => objective.text=s;
        public void Hint(string s) => hint.text=s;
        public void Progress(string s) => progress.text=s;
        public void Subtitle(string s) => subtitle.text=s;
        public void Toast(string s) { toast.text=s; toastUntil=Time.unscaledTime+3; }
        RTLTextMeshPro delta,keys; RectTransform subPanel,objectivePanel; float shownCash=-1,deltaUntil; int lastCash=-1;
        static Sprite circle;
        public static Sprite CircleSprite()
        {
            if(circle)return circle;
            const int n=96;var tex=new Texture2D(n,n,TextureFormat.RGBA32,false);var px=new Color32[n*n];
            for(int y=0;y<n;y++)for(int x=0;x<n;x++){float d=Vector2.Distance(new Vector2(x,y),new Vector2(n/2f-.5f,n/2f-.5f))/(n/2f);px[y*n+x]=new Color32(255,255,255,(byte)(Mathf.Clamp01((1-d)*14)*255));}
            tex.SetPixels32(px);tex.Apply();return circle=Sprite.Create(tex,new Rect(0,0,n,n),new Vector2(.5f,.5f));
        }
        public void Actions(params Choice[] choices)
        {
            Clear(actions);
            float w=(800-12*(choices.Length-1))/Mathf.Max(1,choices.Length);
            for(int i=0;i<choices.Length;i++) { var c=choices[i]; Button(actions,c.Text,(i*(w+12),0,w,65),c.Action); }
        }
        public void Modal(string title,string body,params Choice[] choices)
        {
            Clear(modal); modal.gameObject.SetActive(true);
            Text(modal,title,(30,16,760,64),36,Ink);
            Text(modal,body,(40,88,740,330),27,Ink);
            float w=(740-12*(choices.Length-1))/Mathf.Max(1,choices.Length);
            for(int i=0;i<choices.Length;i++){var c=choices[i];Button(modal,c.Text,(40+i*(w+12),440,w,90),c.Action);}
        }
        public void CloseModal() { modal.gameObject.SetActive(false); talk.gameObject.SetActive(false); }
        // Face-to-face conversation: who is talking, one short line, and short replies. Replaces menus for NPCs.
        RectTransform talk;
        public void Talk(string speaker,string line,params Choice[] choices)
        {
            Clear(talk);talk.gameObject.SetActive(true);modal.gameObject.SetActive(false);
            var tag=Panel(talk,"Name",(1090,-30,290,54),new Color(.16f,.25f,.22f));Frame(tag,new Color(Gold.r,Gold.g,Gold.b,.8f));
            Text(tag,speaker,(10,2,270,50),28,Gold).alignment=TextAlignmentOptions.Center;
            Text(talk,line,(40,26,1320,70),32,Ink);
            float w=Mathf.Min(420,(1320-14*(choices.Length-1))/Mathf.Max(1,choices.Length));
            float start=1360-choices.Length*w-(choices.Length-1)*14;
            for(int i=0;i<choices.Length;i++){var c=choices[i];Button(talk,c.Text,(start+i*(w+14),108,w,72),c.Action);}
        }
        public bool TalkVisible=>talk&&talk.gameObject.activeSelf;
        public IEnumerator Fade(bool dark,float seconds=.4f)
        {
            float t=0; while(t<seconds){t+=Time.unscaledDeltaTime;SetFade(dark?t/seconds:1-t/seconds);yield return null;}
            SetFade(dark?1:0);
        }
        void SetFade(float a)
        {
            fade.color=new Color(0,0,0,a);
            cardTitle.color=new Color(Gold.r,Gold.g,Gold.b,a);cardSubtitle.color=new Color(Paper.r,Paper.g,Paper.b,a);
            if(vrFader){vrFader.enabled=a>.001f;vrFader.material.color=new Color(0,0,0,a);}
        }
        // Chapter title card: each scene opens on black with its name, then fades into the shop.
        static readonly string[,] Cards={{"إرث الكيميائي","المشهد الأول: الإرث"},{"المشهد الثاني","أول زبون"},{"المشهد الثالث","الطلبية الكبرى"}};
        IEnumerator OpeningCard()
        {
            int chapter=Mathf.Clamp(UnityEngine.SceneManagement.SceneManager.GetActiveScene().buildIndex,0,2);
            cardTitle.text=Cards[chapter,0];cardSubtitle.text=Cards[chapter,1];SetFade(1);
            if(!DesktopSmokeRunner.Running)yield return new WaitForSecondsRealtime(1.6f);
            yield return Fade(false,.9f);
            cardTitle.text="";cardSubtitle.text="";
        }
        public IEnumerator ChapterOut(int next)
        {
            cardTitle.text=Cards[Mathf.Clamp(next,0,2),0];cardSubtitle.text=Cards[Mathf.Clamp(next,0,2),1];
            yield return Fade(true,.7f);
        }
        // Quick blink for VR teleports (comfort: no visible sliding).
        public void Blink(Action during){StartCoroutine(BlinkRoutine(during));}
        IEnumerator BlinkRoutine(Action during){cardTitle.text="";cardSubtitle.text="";yield return Fade(true,.12f);during?.Invoke();yield return Fade(false,.22f);}
        // "Go to station": desktop glides the camera into the station view; VR blinks the player to the floor ring.
        void GoToStation()
        {
            var s=Stations.Current;
            if(s==Station.None||s==Station.Welcome){Toast("لا توجد محطة الآن — تابع مع فراس");return;}
            var v=Stations.View(s);
            if(VRInputAdapter.Active)Blink(()=>PlayerRig.Teleport?.Invoke(v.Stand,v.StandYaw));
            else DesktopInputController.I?.FocusCurrent();
        }
        static void Frame(Transform panel,Color color)
        {
            var o=panel.gameObject.AddComponent<Outline>();o.effectColor=color;o.effectDistance=new Vector2(4,-4);
            var s=panel.gameObject.AddComponent<Shadow>();s.effectColor=new Color(0,0,0,.45f);s.effectDistance=new Vector2(10,-10);
        }
        public static void Clear(Transform t){foreach(Transform child in t) { child.gameObject.SetActive(false); Destroy(child.gameObject); }}
        static RectTransform Rect(Transform p,string name,(float x,float y,float w,float h) b)
        {
            var r=new GameObject(name,typeof(RectTransform)).GetComponent<RectTransform>();r.SetParent(p,false);
            r.anchorMin=r.anchorMax=new Vector2(0,1);r.pivot=new Vector2(0,1);r.anchoredPosition=new Vector2(b.x,-b.y);r.sizeDelta=new Vector2(b.w,b.h);return r;
        }
        public static RectTransform Panel(Transform p,string name,(float,float,float,float) b,Color color)
        {var r=Rect(p,name,b);var im=r.gameObject.AddComponent<Image>();im.color=color;im.raycastTarget=color.a>0;return r;}
        public static RTLTextMeshPro Text(Transform p,string s,(float,float,float,float) b,float size,Color color)
        {
            var r=Rect(p,"Arabic",b);var t=r.gameObject.AddComponent<RTLTextMeshPro>();
            t.font=Font;t.fontSize=size;t.color=color;t.alignment=TextAlignmentOptions.MidlineRight;t.Farsi=false;t.PreserveNumbers=true;
            t.raycastTarget=false;t.text=s;t.textWrappingMode=TextWrappingModes.Normal;return t;
        }
        public static void Button(Transform p,string s,(float,float,float,float) b,Action action)
        {
            var r=Panel(p,"Choice",b,new Color(.13f,.22f,.19f,.97f));
            var button=r.gameObject.AddComponent<Button>();var colors=button.colors;
            colors.normalColor=Color.white;colors.highlightedColor=new Color(1.35f,1.35f,1.2f);colors.pressedColor=new Color(1.9f,1.5f,.8f);
            colors.selectedColor=Color.white;colors.colorMultiplier=1.6f;colors.fadeDuration=.12f;button.colors=colors;
            var o=r.gameObject.AddComponent<Outline>();o.effectColor=new Color(Gold.r,Gold.g,Gold.b,.85f);o.effectDistance=new Vector2(2,-2);
            var sh=r.gameObject.AddComponent<Shadow>();sh.effectColor=new Color(0,0,0,.5f);sh.effectDistance=new Vector2(4,-5);
            r.gameObject.AddComponent<ButtonJuice>();
            Text(r,s,(12,3,b.Item3-24,b.Item4-6),26,Paper).alignment=TextAlignmentOptions.Center;
            button.onClick.AddListener(()=>{AudioManager.I?.Play(Sfx.Paper,1.1f,.8f);action?.Invoke();});
        }
        public static GameObject WorldLabel(string text,Vector3 position,Vector2 size,float fontSize=30,float yaw=0)
        {
            var go=new GameObject("World parchment",typeof(Canvas));var c=go.GetComponent<Canvas>();c.renderMode=RenderMode.WorldSpace;
            var r=(RectTransform)go.transform;r.position=position;r.rotation=Quaternion.Euler(0,yaw,0);r.sizeDelta=size;r.localScale=Vector3.one*.002f;
            var bg=go.AddComponent<Image>();bg.color=Paper;bg.raycastTarget=false;
            Text(r,text,(8,0,size.x-16,size.y),fontSize,Ink);
            return go;
        }
    }

    // Hover: the button grows slightly and its trim brightens; press: a quick squash. Works for mouse and VR rays.
    public sealed class ButtonJuice:MonoBehaviour,IPointerEnterHandler,IPointerExitHandler,IPointerDownHandler,IPointerUpHandler
    {
        float target=1,current=1;Outline outline;
        void Awake(){outline=GetComponent<Outline>();}
        public void OnPointerEnter(PointerEventData e){target=1.05f;if(outline)outline.effectDistance=new Vector2(3,-3);}
        public void OnPointerExit(PointerEventData e){target=1;if(outline)outline.effectDistance=new Vector2(2,-2);}
        public void OnPointerDown(PointerEventData e){current=.95f;}
        public void OnPointerUp(PointerEventData e){}
        void Update(){current=Mathf.Lerp(current,target,Time.unscaledDeltaTime*14);transform.localScale=Vector3.one*current;}
    }
}
