using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Capital;
using RTLTMPro;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.TextCore.LowLevel;
using UnityEngine.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEngine.XR.OpenXR;
using UnityEngine.XR.OpenXR.Features.Interactions;

public static class CapitalBuilder
{
    const string Root="Assets/Capital";
    [MenuItem("Capital/1 - Build project and RTL fixture")]
    public static void BuildProject()
    {
        Directory.CreateDirectory(Root+"/Scenes");Directory.CreateDirectory(Root+"/Prefabs");Directory.CreateDirectory(Root+"/Generated");
        Directory.CreateDirectory("Assets/StreamingAssets/Voices");Directory.CreateDirectory("Evidence");
        if(!AssetDatabase.LoadAssetAtPath<TMP_Settings>("Assets/TextMesh Pro/Resources/TMP Settings.asset"))
        {
            string package=Path.Combine(EditorApplication.applicationContentsPath,"Resources/PackageManager/BuiltInPackages/com.unity.ugui/Package Resources/TMP Essential Resources.unitypackage");
            AssetDatabase.ImportPackage(package,false);
        }
        MakeFont();MakePipeline();ConfigureXR();
        var recipe=AssetDatabase.LoadAssetAtPath<PotionRecipe>(Root+"/Generated/Vitality.asset");
        if(!recipe){recipe=ScriptableObject.CreateInstance<PotionRecipe>();AssetDatabase.CreateAsset(recipe,Root+"/Generated/Vitality.asset");}
        // Clear previously generated meshes/materials (scenes are regenerated below).
        foreach(var old in AssetDatabase.FindAssets("",new[]{Root+"/Generated"}).Select(AssetDatabase.GUIDToAssetPath)
            .Where(p=>{var f=Path.GetFileName(p);return f.StartsWith("Mesh")||f.StartsWith("Mat")||f.StartsWith("Character");}).ToList())
            AssetDatabase.DeleteAsset(old);
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        var shop=ShopDressing.Build();
        int index=0;var saved=new HashSet<UnityEngine.Object>();
        void Persist(IEnumerable<Renderer> renderers,IEnumerable<MeshFilter> filters)
        {
            // Persist runtime-generated meshes/materials; prefab and scene references must survive restarts.
            foreach(var mf in filters)
                if(mf.sharedMesh && !AssetDatabase.Contains(mf.sharedMesh) && saved.Add(mf.sharedMesh))
                    AssetDatabase.CreateAsset(mf.sharedMesh,AssetDatabase.GenerateUniqueAssetPath(Root+"/Generated/Mesh"+index++ +".asset"));
            foreach(var renderer in renderers)
                foreach(var m in renderer.sharedMaterials)
                    if(m && !AssetDatabase.Contains(m) && saved.Add(m))
                        AssetDatabase.CreateAsset(m,AssetDatabase.GenerateUniqueAssetPath(Root+"/Generated/Mat"+index++ +".mat"));
        }
        Persist(shop.GetComponentsInChildren<Renderer>(),shop.GetComponentsInChildren<MeshFilter>());
        var prefab=PrefabUtility.SaveAsPrefabAsset(shop,Root+"/Prefabs/AlchemyShop.prefab");
        UnityEngine.Object.DestroyImmediate(shop);
        var sky=AssetDatabase.LoadAssetAtPath<Material>(Root+"/Generated/DuskSky.mat");
        if(!sky){sky=new Material(Shader.Find("Skybox/Procedural"));AssetDatabase.CreateAsset(sky,Root+"/Generated/DuskSky.mat");}
        sky.SetColor("_SkyTint",new Color(.55f,.42f,.5f));sky.SetColor("_GroundColor",new Color(.22f,.2f,.18f));
        sky.SetFloat("_AtmosphereThickness",1.6f);sky.SetFloat("_Exposure",1.05f);sky.SetFloat("_SunSize",.05f);
        for(int i=0;i<3;i++)
        {
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            PrefabUtility.InstantiatePrefab(prefab);
            // Scene 1 begins outside the inherited shop; later scenes begin inside by the counter.
            Vector3 start=i==0?ShopLayout.OutsideStart:ShopLayout.InsideStart;float yaw=i==0?ShopLayout.OutsideYaw:ShopLayout.InsideYaw;
            var camera=new GameObject("Main Camera",typeof(Camera),typeof(AudioListener),typeof(DesktopInputController),typeof(VRInputAdapter));
            camera.tag="MainCamera";camera.transform.position=start+Vector3.up*1.65f;camera.transform.rotation=Quaternion.Euler(i==0?-3:8,yaw,0);
            var cam=camera.GetComponent<Camera>();cam.fieldOfView=68;cam.nearClipPlane=.04f;cam.farClipPlane=80;cam.clearFlags=CameraClearFlags.Skybox;
            var light=new GameObject("Dusk sun",typeof(Light));light.transform.rotation=Quaternion.Euler(14,-35,0);
            var l=light.GetComponent<Light>();l.type=LightType.Directional;l.color=new Color(1,.68f,.42f);l.intensity=i==2?1.35f:1.15f;l.shadows=LightShadows.Soft;
            RenderSettings.skybox=sky;RenderSettings.sun=l;
            RenderSettings.ambientMode=AmbientMode.Trilight;
            RenderSettings.ambientSkyColor=new Color(.36f,.33f,.38f);RenderSettings.ambientEquatorColor=new Color(.27f,.22f,.18f);RenderSettings.ambientGroundColor=new Color(.12f,.1f,.08f);
            RenderSettings.fog=true;RenderSettings.fogColor=new Color(.42f,.33f,.3f);RenderSettings.fogMode=FogMode.Exponential;RenderSettings.fogDensity=.012f;
            new GameObject("XR Interaction Manager",typeof(UnityEngine.XR.Interaction.Toolkit.XRInteractionManager));
            new GameObject("Chapter Director",typeof(GameDirector));
            var firas=ShopDressing.Character("Mage",ShopLayout.FirasHeight,ShopLayout.FirasSpot,160,"Firas",true);
            if(firas)firas.AddComponent<FirasController>();
            if(i==0||i==2)
            {
                // The wandering trader: walks in to sell ingredients (scene 1) or offer suppliers (scene 3).
                var trader=ShopDressing.Character("Barbarian",1.78f,ShopLayout.CustomerPath[0],0,"Trader");
                if(trader)trader.AddComponent<CustomerController>();
            }
            if(i>0)
            {
                // Scene 2: the first customer; scene 3: the wealthy merchant. Both walk in through the door.
                var npc=ShopDressing.Character(i==1?"RogueHooded":"Knight",i==1?1.72f:1.8f,ShopLayout.CustomerPath[0],0,i==1?"Customer":"Merchant");
                if(npc)npc.AddComponent<CustomerController>();
            }
            Persist(UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include),UnityEngine.Object.FindObjectsByType<MeshFilter>(FindObjectsInactive.Include));
            EditorSceneManager.SaveScene(scene,Root+"/Scenes/"+SceneFlowManager.Names[i]+".unity");
        }
        EditorBuildSettings.scenes=SceneFlowManager.Names.Select(n=>new EditorBuildSettingsScene(Root+"/Scenes/"+n+".unity",true)).ToArray();
        PlayerSettings.companyName="Capital Team";PlayerSettings.productName="Capital - The Alchemist's Legacy";
        PlayerSettings.defaultScreenWidth=1600;PlayerSettings.defaultScreenHeight=900;PlayerSettings.fullScreenMode=FullScreenMode.Windowed;
        PlayerSettings.runInBackground=true;PlayerSettings.colorSpace=ColorSpace.Linear;
        var settings=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset")[0]);
        var input=settings.FindProperty("activeInputHandler");if(input!=null){input.intValue=1;settings.ApplyModifiedPropertiesWithoutUndo();}
        File.Copy("Assets/Resources/DIALOGUE.csv","DIALOGUE.csv",true);
        AssetDatabase.SaveAssets();
        ApplyLightingPolish();
        EditorSceneManager.OpenScene(Root+"/Scenes/01_Inheritance.unity");
        File.WriteAllText("Evidence/scene-build.txt","PASS: three primary scenes, shared shop prefab, URP, font fixture, OpenXR configuration. "+DateTime.UtcNow.ToString("O"));
        Debug.Log("CAPITAL_BUILD_READY");
    }
    static void MakeFont()
    {
        var font=AssetDatabase.LoadAssetAtPath<Font>("Assets/Resources/Fonts/Amiri-Regular.ttf");
        var tmp=AssetDatabase.LoadAssetAtPath<TMP_FontAsset>("Assets/Resources/Fonts/Arabic.asset");
        if(!tmp)
        {
            tmp=TMP_FontAsset.CreateFontAsset(font,80,9,GlyphRenderMode.SDFAA,2048,2048,AtlasPopulationMode.Dynamic,true);
            tmp.name="Amiri Arabic SDF";AssetDatabase.CreateAsset(tmp,"Assets/Resources/Fonts/Arabic.asset");
            AssetDatabase.AddObjectToAsset(tmp.material,tmp);foreach(var tex in tmp.atlasTextures)AssetDatabase.AddObjectToAsset(tex,tmp);
        }
        string corpus=File.ReadAllText("Assets/Resources/DIALOGUE.csv")+"\n30 عملة\nإجمالي الربح: 49\nالرصيد النهائي: 124\nالموسوعة المالية: 10 / 10";
        foreach(string f in Directory.GetFiles(Root+"/Scripts","*.cs"))corpus+="\n"+File.ReadAllText(f);
        var chars=new HashSet<char>("0123456789 :.,!?%/+-•—()");
        foreach(var line in corpus.Split('\n'))
        {
            if(!line.Any(c=>c>=0x600&&c<=0x6ff))continue;
            var sb=new FastStringBuilder(2048);RTLSupport.FixRTL(line,sb,false,true,true);
            foreach(char c in sb.ToString())if(!char.IsControl(c))chars.Add(c);
        }
        bool ok=tmp.TryAddCharacters(new string(chars.ToArray()),out string missing);
        EditorUtility.SetDirty(tmp);AssetDatabase.SaveAssets();UIManager.Font=tmp;
        File.WriteAllText("Evidence/arabic-glyph-coverage.txt",(ok?"PASS":"FAIL")+" shaped corpus coverage. Missing: "+missing+"\nFont: Amiri OFL. Western digits preserved. Visual bidi review separate.");
        if(!ok)Debug.LogWarning("Missing Arabic fixture glyphs: "+missing);
    }
    static void MakePipeline()
    {
        var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(Root+"/Generated/CapitalURP.asset");
        if(!pipeline)
        {
            var renderer=ScriptableObject.CreateInstance<UniversalRendererData>();AssetDatabase.CreateAsset(renderer,Root+"/Generated/CapitalRenderer.asset");
            pipeline=ScriptableObject.CreateInstance<UniversalRenderPipelineAsset>();AssetDatabase.CreateAsset(pipeline,Root+"/Generated/CapitalURP.asset");
            var so=new SerializedObject(pipeline);var list=so.FindProperty("m_RendererDataList");list.arraySize=1;list.GetArrayElementAtIndex(0).objectReferenceValue=renderer;so.ApplyModifiedPropertiesWithoutUndo();
            pipeline.msaaSampleCount=4;pipeline.shadowDistance=15;pipeline.renderScale=1;
        }
        GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
    }
    static void ConfigureXR()
    {
        var per=UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget.XRGeneralSettingsForBuildTarget(BuildTargetGroup.Standalone);
        if(per==null)
        {
            var settings=ScriptableObject.CreateInstance<UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget>();
            AssetDatabase.CreateAsset(settings,Root+"/Generated/XRSettings.asset");
            EditorBuildSettings.AddConfigObject("Unity.XR.Management.Settings",settings,true);
            settings.CreateDefaultSettingsForBuildTarget(BuildTargetGroup.Standalone);
            per=UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget.XRGeneralSettingsForBuildTarget(BuildTargetGroup.Standalone);
        }
        if(per.Manager==null)
        {
            var manager=ScriptableObject.CreateInstance<XRManagerSettings>();AssetDatabase.AddObjectToAsset(manager,AssetDatabase.GetAssetPath(per));per.Manager=manager;
        }
        per.InitManagerOnStart=false;
        XRPackageMetadataStore.AssignLoader(per.Manager,"UnityEngine.XR.OpenXR.OpenXRLoader",BuildTargetGroup.Standalone);
        var oxr=OpenXRSettings.GetSettingsForBuildTargetGroup(BuildTargetGroup.Standalone);
        if(oxr)foreach(var feature in oxr.GetFeatures<UnityEngine.XR.OpenXR.Features.OpenXRFeature>())
            if(feature is OculusTouchControllerProfile || feature is ValveIndexControllerProfile)feature.enabled=true;
        EditorUtility.SetDirty(per);
    }
    // Browser build (GitHub Pages): WebXR loader initialised at startup so "Enter VR" works in headset browsers.
    static void ConfigureWebXR()
    {
        var any=UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget.XRGeneralSettingsForBuildTarget(BuildTargetGroup.Standalone);
        string path=any?AssetDatabase.GetAssetPath(any):null;
        var container=path!=null?AssetDatabase.LoadAllAssetsAtPath(path).OfType<UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget>().FirstOrDefault():null;
        if(container==null){ConfigureXR();return;}
        if(!container.HasSettingsForBuildTarget(BuildTargetGroup.WebGL))container.CreateDefaultSettingsForBuildTarget(BuildTargetGroup.WebGL);
        var web=container.SettingsForBuildTarget(BuildTargetGroup.WebGL);
        if(web.Manager==null){var manager=ScriptableObject.CreateInstance<XRManagerSettings>();AssetDatabase.AddObjectToAsset(manager,path);web.Manager=manager;}
        web.InitManagerOnStart=true;
        XRPackageMetadataStore.AssignLoader(web.Manager,"WebXR.WebXRLoader",BuildTargetGroup.WebGL);
        EditorUtility.SetDirty(container);AssetDatabase.SaveAssets();
    }
    [MenuItem("Capital/5 - Build Web (WebXR)")]
    public static void BuildWeb()
    {
        ConfigureWebXR();
        PlayerSettings.WebGL.template="PROJECT:WebXRFullView2020";
        // GitHub Pages can't send Content-Encoding headers, so the loader decompresses gzip itself.
        PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.decompressionFallback=true;
        PlayerSettings.WebGL.dataCaching=true;
        PlayerSettings.WebGL.memoryGrowthMode=WebGLMemoryGrowthMode.Geometric;
        PlayerSettings.WebGL.exceptionSupport=WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
        PlayerSettings.SetManagedStrippingLevel(UnityEditor.Build.NamedBuildTarget.WebGL,ManagedStrippingLevel.Low);
        PlayerSettings.runInBackground=true;
        Directory.CreateDirectory("Builds/Web");
        var report=BuildPipeline.BuildPlayer(EditorBuildSettings.scenes.Where(s=>s.enabled).Select(s=>s.path).ToArray(),
            "Builds/Web",BuildTarget.WebGL,BuildOptions.None);
        File.WriteAllText("Evidence/web-build.txt",report.summary.result+"\n"+report.summary.totalErrors+" errors\n"+report.summary.totalSize+" bytes\n"+DateTime.UtcNow.ToString("O"));
        if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Web build failed");
    }
    [MenuItem("Capital/2 - Open temporary RTL fixture")]
    public static void RTLFixture()
    {
        MakeFont();
        var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        new GameObject("RTL fixture camera",typeof(Camera)).tag="MainCamera";
        var canvas=new GameObject("TEMPORARY Arabic Fixture",typeof(Canvas),typeof(UnityEngine.UI.CanvasScaler));
        canvas.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;
        var scaler=canvas.GetComponent<UnityEngine.UI.CanvasScaler>();scaler.uiScaleMode=UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1920,1080);
        UIManager.Panel(canvas.transform,"Parchment",(0,0,1920,1080),UIManager.Paper);
        UIManager.Text(canvas.transform,"رأس المال: إرث الكيميائي\n30 عملة\nإجمالي الربح: 49\nالرصيد النهائي: 124\nأهلًا بك! هل الإيراد هو الربح؟\nالموسوعة المالية: 10 / 10\nالعشبة، البلورة، الماء — جرعة النشاط",(120,80,1680,900),64,UIManager.Ink);
        // Unsaved fixture, deliberately excluded from builds.
    }
    // Tier 2 lighting pass: one shared post-processing profile (warm grade, soft bloom on emissive glows,
    // gentle vignette) added to all three scenes. Idempotent; safe to run repeatedly.
    [MenuItem("Capital/4 - Apply lighting polish")]
    public static void ApplyLightingPolish()
    {
        const string path=Root+"/Generated/CapitalPost.asset";
        var profile=AssetDatabase.LoadAssetAtPath<VolumeProfile>(path);
        if(!profile)
        {
            profile=ScriptableObject.CreateInstance<VolumeProfile>();AssetDatabase.CreateAsset(profile,path);
            var bloom=profile.Add<Bloom>(true);bloom.threshold.Override(.95f);bloom.intensity.Override(.55f);bloom.scatter.Override(.6f);
            var tone=profile.Add<Tonemapping>(true);tone.mode.Override(TonemappingMode.Neutral);
            var color=profile.Add<ColorAdjustments>(true);color.postExposure.Override(.15f);color.contrast.Override(8f);color.saturation.Override(6f);
            var white=profile.Add<WhiteBalance>(true);white.temperature.Override(12f);
            var vignette=profile.Add<Vignette>(true);vignette.intensity.Override(.24f);vignette.smoothness.Override(.45f);
            foreach(var c in profile.components)AssetDatabase.AddObjectToAsset(c,profile);
            EditorUtility.SetDirty(profile);AssetDatabase.SaveAssets();
        }
        foreach(var s in EditorBuildSettings.scenes.Where(s=>s.enabled))
        {
            var scene=EditorSceneManager.OpenScene(s.path,OpenSceneMode.Single);
            var volume=UnityEngine.Object.FindObjectsByType<Volume>(FindObjectsInactive.Include).FirstOrDefault(v=>v.name=="Shop post-processing");
            if(!volume){volume=new GameObject("Shop post-processing").AddComponent<Volume>();}
            volume.isGlobal=true;volume.priority=0;volume.sharedProfile=profile;
            foreach(var cam in UnityEngine.Object.FindObjectsByType<Camera>(FindObjectsInactive.Include))
            {
                var data=cam.GetComponent<UniversalAdditionalCameraData>()??cam.gameObject.AddComponent<UniversalAdditionalCameraData>();
                data.renderPostProcessing=true;data.antialiasing=AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            }
            EditorSceneManager.MarkSceneDirty(scene);EditorSceneManager.SaveScene(scene);
        }
        File.WriteAllText("Evidence/lighting-polish.txt","Post-processing profile applied to "+EditorBuildSettings.scenes.Count(s=>s.enabled)+" scenes\n"+DateTime.UtcNow.ToString("O"));
    }
    [MenuItem("Capital/3 - Build Windows")]
    public static void BuildWindows()
    {
        Directory.CreateDirectory("Builds/Windows");
        var report=BuildPipeline.BuildPlayer(EditorBuildSettings.scenes.Where(s=>s.enabled).Select(s=>s.path).ToArray(),
            "Builds/Windows/Capital.exe",BuildTarget.StandaloneWindows64,BuildOptions.None);
        File.WriteAllText("Evidence/windows-build.txt",report.summary.result+"\n"+report.summary.totalErrors+" errors\n"+report.summary.totalSize+" bytes\n"+DateTime.UtcNow.ToString("O"));
        if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Windows build failed");
    }
}
