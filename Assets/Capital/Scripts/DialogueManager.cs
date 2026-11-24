using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;

namespace Capital
{
    public sealed class DialogueManager : MonoBehaviour
    {
        public static DialogueManager I;
        public sealed class Line { public string id, speaker, text, filename; public float duration; }
        readonly Dictionary<string, Line> lines = new Dictionary<string, Line>();
        readonly Queue<string> queue = new Queue<string>();
        AudioSource voice;
        public bool Speaking { get; private set; }
        public string Speaker { get; private set; }
        void Awake()
        {
            I = this; voice = gameObject.AddComponent<AudioSource>(); voice.spatialBlend = 0;
            foreach (string raw in Resources.Load<TextAsset>("DIALOGUE").text.Split('\n'))
            {
                var c = raw.Trim().Split(',');
                if(c.Length != 8 || c[0]=="id") continue;
                lines[c[0]] = new Line { id=c[0],speaker=c[1],text=c[4],filename=c[5],duration=float.Parse(c[6],CultureInfo.InvariantCulture) };
            }
            StartCoroutine(PlayQueue());
        }
        public void Say(params string[] ids) { foreach(var id in ids) if(lines.ContainsKey(id)) queue.Enqueue(id); }
        public bool Busy => Speaking || queue.Count > 0;
        IEnumerator PlayQueue()
        {
            while(true)
            {
                if(queue.Count == 0) { yield return null; continue; }
                Line l=lines[queue.Dequeue()]; Speaking=true; Speaker=l.speaker;
                UIManager.I?.Subtitle(l.speaker + " — " + l.text);
                AudioClip clip=Resources.Load<AudioClip>("Voices/"+Path.GetFileNameWithoutExtension(l.filename));
                string external=Path.Combine(Application.streamingAssetsPath,"Voices",l.filename);
                if(clip==null && File.Exists(external))
                {
                    using(var req=UnityWebRequestMultimedia.GetAudioClip(new System.Uri(external).AbsoluteUri,AudioType.WAV))
                    {
                        yield return req.SendWebRequest();
                        if(req.result==UnityWebRequest.Result.Success) clip=DownloadHandlerAudioClip.GetContent(req);
                    }
                }
                if(clip) { voice.clip=clip; voice.Play(); }
                float duration=clip ? clip.length : l.duration*(GameManager.I.State.presentationMode ? .7f : 1);
                float elapsed=0;
                while(elapsed<duration)
                {
                    if(GameManager.I.InteractionPaused) { if(voice.isPlaying) voice.Pause(); }
                    else { if(clip && !voice.isPlaying && elapsed<duration-.1f) voice.UnPause(); elapsed+=Time.unscaledDeltaTime; }
                    yield return null;
                }
                voice.Stop(); Speaking=false; UIManager.I?.Subtitle(""); yield return new WaitForSecondsRealtime(.15f);
            }
        }
    }
}
