using System.Collections.Generic;
using UnityEngine;

namespace Capital
{
    // Runtime art helpers: materials, small procedural shapes, and the grabbable gameplay items.
    // Environment dressing is placed in the editor by ShopDressing (KayKit CC0 + Blender-built models).
    public static class ShopArt
    {
        static readonly Dictionary<string,Material> materials=new Dictionary<string,Material>();
        public static readonly Color Wood=new Color(.25f,.115f,.045f), DarkWood=new Color(.105f,.052f,.027f),
            Brass=new Color(.61f,.34f,.105f), Stone=new Color(.29f,.28f,.24f), Teal=new Color(.13f,.54f,.46f);

        public static Material Material(string name,Color color,bool emission=false)
        {
            string key=name+color.ToString()+emission;
            if(materials.TryGetValue(key,out var m)&&m)return m;
            m=new Material(Shader.Find("Universal Render Pipeline/Lit"));m.name=name;m.color=color;
            m.SetFloat("_Smoothness",name.Contains("Glass")?.7f:.22f);
            if(name.Contains("Brass") || name.Contains("Copper"))m.SetFloat("_Metallic",.65f);
            if(emission){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",color*1.7f);}
            materials[key]=m;return m;
        }

        // URP Lit configured for alpha blending (hologram, steam, glass liquids).
        public static Material Transparent(string name,Color color,float emission=0,float smoothness=.8f)
        {
            string key="T"+name+color+emission+smoothness;
            if(materials.TryGetValue(key,out var m)&&m)return m;
            m=new Material(Shader.Find("Universal Render Pipeline/Lit"));m.name=name;
            m.SetFloat("_Surface",1);m.SetFloat("_Blend",0);m.SetFloat("_ZWrite",0);
            m.SetFloat("_SrcBlend",(float)UnityEngine.Rendering.BlendMode.SrcAlpha);m.SetFloat("_DstBlend",(float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            m.SetFloat("_SrcBlendAlpha",1);m.SetFloat("_DstBlendAlpha",(float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");m.SetOverrideTag("RenderType","Transparent");
            m.renderQueue=(int)UnityEngine.Rendering.RenderQueue.Transparent;
            m.SetColor("_BaseColor",color);m.SetFloat("_Smoothness",smoothness);
            if(emission>0){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",new Color(color.r,color.g,color.b)*emission);}
            materials[key]=m;return m;
        }

        public static GameObject Primitive(string name,PrimitiveType type,Transform parent,Vector3 pos,Vector3 scale,Color color,bool collider=true)
        {
            var g=GameObject.CreatePrimitive(type);g.name=name;g.transform.SetParent(parent,false);g.transform.localPosition=pos;g.transform.localScale=scale;
            g.GetComponent<Renderer>().sharedMaterial=Material(name,color,name.Contains("Glow")||name.Contains("Flame"));
            if(!collider){var c=g.GetComponent<Collider>();if(Application.isPlaying)Object.Destroy(c);else Object.DestroyImmediate(c);}
            return g;
        }

        public static GameObject Lathe(string name,Transform parent,Vector3 pos,Vector2[] profile,Color color,int segments=20)
        {
            var vertices=new List<Vector3>();var triangles=new List<int>();var uv=new List<Vector2>();
            for(int j=0;j<profile.Length;j++)for(int i=0;i<=segments;i++)
            {float a=i*Mathf.PI*2/segments;vertices.Add(new Vector3(Mathf.Cos(a)*profile[j].x,profile[j].y,Mathf.Sin(a)*profile[j].x));uv.Add(new Vector2((float)i/segments,(float)j/(profile.Length-1)));}
            for(int j=0;j<profile.Length-1;j++)for(int i=0;i<segments;i++)
            {int a=j*(segments+1)+i,b=a+segments+1;triangles.AddRange(new[]{a,b,a+1,a+1,b,b+1});}
            var mesh=new Mesh{name=name};mesh.SetVertices(vertices);mesh.SetTriangles(triangles,0);mesh.SetUVs(0,uv);mesh.RecalculateNormals();mesh.RecalculateBounds();
            var g=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer));g.transform.SetParent(parent,false);g.transform.localPosition=pos;
            g.GetComponent<MeshFilter>().sharedMesh=mesh;g.GetComponent<MeshRenderer>().sharedMaterial=Material(name,color);
            return g;
        }

        // Triangular prism (gable end / roof filler). Base along X at y=0, apex at (0,height).
        public static GameObject Gable(string name,Transform parent,Vector3 pos,float halfWidth,float height,float thickness,Color color)
        {
            float z=thickness/2;
            var v=new[]{new Vector3(-halfWidth,0,-z),new Vector3(halfWidth,0,-z),new Vector3(0,height,-z),new Vector3(-halfWidth,0,z),new Vector3(halfWidth,0,z),new Vector3(0,height,z)};
            var verts=new List<Vector3>();var tris=new List<int>();
            void Face(params int[] idx){int b=verts.Count;foreach(var i in idx)verts.Add(v[i]);for(int k=1;k<idx.Length-1;k++)tris.AddRange(new[]{b,b+k,b+k+1});}
            Face(0,2,1);Face(3,4,5);Face(0,3,5,2);Face(1,2,5,4);Face(0,1,4,3);
            var mesh=new Mesh{name=name};mesh.SetVertices(verts);mesh.SetTriangles(tris,0);mesh.RecalculateNormals();mesh.RecalculateBounds();
            var g=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer));g.transform.SetParent(parent,false);g.transform.localPosition=pos;
            g.GetComponent<MeshFilter>().sharedMesh=mesh;g.GetComponent<MeshRenderer>().sharedMaterial=Material(name,color);
            return g;
        }

        public static void Herb(Transform parent,Vector3 pos,float size,Color color)
        {
            var stem=Primitive("Herb stem",PrimitiveType.Cylinder,parent,pos,new Vector3(.012f,size*.6f,.012f),new Color(.22f,.32f,.08f),false);
            stem.transform.localRotation=Quaternion.Euler(0,0,25);
            for(int i=0;i<6;i++)
            {
                var leaf=Primitive("Herb leaf",PrimitiveType.Sphere,parent,pos+new Vector3((i%2==0?1:-1)*size*.24f,i*size*.12f,0),new Vector3(size*.65f,size*.2f,size*.25f),color,false);
                leaf.transform.localRotation=Quaternion.Euler(0,i*29,i%2==0?25:-25);
            }
        }

        static readonly Dictionary<string,string> ItemModel=new Dictionary<string,string>{
            {"herb","herb_red"},{"crystal","crystal_blue"},{"water","water_flask"},{"bottle","potion_bottle"},
            {"potion","potion_bottle"},{"pestle","pestle"},{"spoon","stir_paddle"},{"crushed","bowl_small"}};
        // Where a hand holds each tool (local, metres from the model's base).
        public static Vector3 GripPoint(string kind)=>kind=="spoon"?new Vector3(0,.95f,0):kind=="pestle"?new Vector3(0,.2f,0):new Vector3(0,.08f,0);

        // Grabbable gameplay item. Model from Resources/Models (Blender/KayKit), primitive fallback if missing.
        public static GameObject Item(string kind,Vector3 pos)
        {
            var root=new GameObject(kind);root.transform.position=pos;
            GameObject model=null;
            if(ItemModel.TryGetValue(kind,out var file))
            {
                var prefab=Resources.Load<GameObject>("Models/"+file);
                if(prefab){model=Object.Instantiate(prefab,root.transform);model.name=file;model.transform.localPosition=Vector3.zero;model.transform.localRotation=Quaternion.identity;}
                // Ingredients read clearly from the station views and in a VR hand.
                if(model && (kind=="herb"||kind=="crystal"||kind=="water"))model.transform.localScale*=kind=="water"?1.3f:1.55f;
            }
            if(kind=="crushed")
            {
                if(model)model.transform.localScale=Vector3.one*FitScale(model,.16f,true);
                for(int i=0;i<9;i++)Primitive("Crushed herb",PrimitiveType.Sphere,root.transform,new Vector3(Mathf.Sin(i*3)*.035f,.045f,Mathf.Cos(i*3)*.035f),Vector3.one*.035f,new Color(.54f,.17f,.06f),false);
            }
            if(kind=="potion")Fill(root.transform,1,new Color(.1f,.72f,.4f));
            if(!model && kind!="crushed")Primitive("Fallback "+kind,PrimitiveType.Capsule,root.transform,new Vector3(0,.1f,0),new Vector3(.08f,.1f,.08f),Brass,false);
            // Collider fitted to the visible model so mouse/hand targeting matches what the player sees.
            var bounds=new Bounds(pos,Vector3.zero);bool first=true;
            foreach(var r in root.GetComponentsInChildren<Renderer>()){if(first){bounds=r.bounds;first=false;}else bounds.Encapsulate(r.bounds);}
            var c=root.AddComponent<BoxCollider>();
            c.center=root.transform.InverseTransformPoint(bounds.center);c.size=Vector3.Max(bounds.size,Vector3.one*.06f)+Vector3.one*.02f;
            return root;
        }

        // Liquid inside a potion bottle (fill 0..1). Bottle interior: radius ~0.05, height ~0.09.
        public static Transform Fill(Transform bottle,float fill,Color color)
        {
            var liquid=bottle.Find("Liquid");
            if(!liquid)liquid=Primitive("Liquid Glow",PrimitiveType.Cylinder,bottle,Vector3.zero,Vector3.one,color,false).transform;
            liquid.name="Liquid";
            liquid.localScale=new Vector3(.088f,Mathf.Max(.001f,.045f*fill),.088f);
            liquid.localPosition=new Vector3(0,.008f+.045f*fill,0);
            liquid.GetComponent<Renderer>().sharedMaterial=Material("Potion Glow",color,true);
            return liquid;
        }

        public static float FitScale(GameObject go,float target,bool byWidth=false)
        {
            var b=new Bounds();bool first=true;
            foreach(var r in go.GetComponentsInChildren<Renderer>()){if(first){b=r.bounds;first=false;}else b.Encapsulate(r.bounds);}
            float size=byWidth?Mathf.Max(b.size.x,b.size.z):b.size.y;
            return size>1e-4f?target/size*go.transform.localScale.x:1;
        }

        public static Light Light(Transform parent,Vector3 p,Color c,float intensity,float range,string name="Warm point")
        {var go=new GameObject(name,typeof(Light));go.transform.SetParent(parent,false);go.transform.localPosition=p;var l=go.GetComponent<Light>();l.type=LightType.Point;l.color=c;l.intensity=intensity;l.range=range;l.shadows=LightShadows.None;return l;}
    }
}
