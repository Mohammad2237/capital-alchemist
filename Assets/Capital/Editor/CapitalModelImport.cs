using System.Linq;
using UnityEditor;
using UnityEngine;

// Import rules for KayKit (CC0) and the project's Blender-built models.
// - Bake axis conversion so every model arrives Y-up with identity rotation.
// - Characters: Generic rig, animations imported, locomotion/idle clips looped.
// - Materials: the FBX colours/textures are mapped onto URP Lit (see OnPostprocessMaterial).
public sealed class CapitalModelImport : AssetPostprocessor
{
    static bool Ours(string path) => path.StartsWith("Assets/ThirdParty/KayKit/") || path.StartsWith("Assets/Capital/Models/") || path.StartsWith("Assets/Capital/Resources/Models/");
    static readonly string[] Looping = { "Idle", "Walking_A", "Walking_B", "Spellcasting", "Unarmed_Idle", "Sit_Chair_Idle", "2H_Melee_Idle" };

    void OnPreprocessModel()
    {
        if (!Ours(assetPath)) return;
        var m = (ModelImporter)assetImporter;
        m.bakeAxisConversion = true;
        m.materialImportMode = ModelImporterMaterialImportMode.ImportStandard;
        m.materialLocation = ModelImporterMaterialLocation.InPrefab;
        m.materialSearch = ModelImporterMaterialSearch.Everywhere;
        m.importCameras = false; m.importLights = false;
        bool character = assetPath.Contains("/Characters/") && !assetPath.EndsWith("staff.fbx") && !assetPath.EndsWith("mug_full.fbx") && !assetPath.EndsWith("spellbook_open.fbx");
        if (character)
        {
            m.animationType = ModelImporterAnimationType.Generic;
            m.importAnimation = true;
            m.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
        }
        else
        {
            m.animationType = ModelImporterAnimationType.None;
            m.importAnimation = false;
        }
    }

    void OnPreprocessAnimation()
    {
        if (!Ours(assetPath)) return;
        var m = (ModelImporter)assetImporter;
        if (m.animationType != ModelImporterAnimationType.Generic) return;
        var clips = m.defaultClipAnimations;
        foreach (var c in clips)
        {
            c.loopTime = Looping.Contains(c.name);
            c.lockRootPositionXZ = true; c.keepOriginalPositionXZ = true; c.keepOriginalPositionY = true; c.keepOriginalOrientation = true;
        }
        m.clipAnimations = clips;
    }

    // FBX materials come in as Standard-style descriptions; build URP Lit materials from them.
    void OnPreprocessMaterialDescription(UnityEditor.AssetImporters.MaterialDescription description, Material material, AnimationClip[] clips)
    {
        if (!Ours(assetPath)) return;
        var lit = Shader.Find("Universal Render Pipeline/Lit");
        if (!lit) return;
        material.shader = lit;
        if (description.TryGetProperty("DiffuseColor", out Vector4 diffuse)) material.SetColor("_BaseColor", new Color(diffuse.x, diffuse.y, diffuse.z, 1));
        if (description.TryGetProperty("DiffuseColor", out UnityEditor.AssetImporters.TexturePropertyDescription tex) && tex.texture)
        {
            material.SetTexture("_BaseMap", tex.texture); material.SetColor("_BaseColor", Color.white);
        }
        else
        {
            // KayKit FBX reference their atlas by file name; find it beside the model.
            string folder = System.IO.Path.GetDirectoryName(assetPath).Replace('\\', '/');
            var atlas = AssetDatabase.FindAssets("t:Texture2D", new[] { folder }).Select(AssetDatabase.GUIDToAssetPath).FirstOrDefault(p => p.EndsWith("_texture.png"));
            if (atlas != null && assetPath.Contains("/KayKit/") || atlas != null && assetPath.Contains("/Resources/Models/bowl"))
            { material.SetTexture("_BaseMap", AssetDatabase.LoadAssetAtPath<Texture2D>(atlas)); material.SetColor("_BaseColor", Color.white); }
        }
        float metal = 0, rough = .7f;
        if (description.TryGetProperty("ReflectionFactor", out float refl)) metal = Mathf.Clamp01(refl);
        if (description.TryGetProperty("Shininess", out float shin)) rough = Mathf.Clamp01(1 - shin / 100f);
        material.SetFloat("_Metallic", metal * .8f);
        material.SetFloat("_Smoothness", Mathf.Clamp(1 - rough, .05f, .7f));
        if (description.TryGetProperty("EmissiveColor", out Vector4 e) && (e.x + e.y + e.z) > .05f)
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", new Color(e.x, e.y, e.z) * 2.2f);
            material.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
        }
    }
}
