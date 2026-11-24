# Blender headless: report bounding sizes of selected KayKit models and animation names of characters.
import bpy, sys, os, mathutils
root = r"C:\Users\moham\Downloads\capital-assets"
def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)
def size_of(path):
    clear()
    if path.endswith(".fbx"): bpy.ops.import_scene.fbx(filepath=path)
    else: bpy.ops.import_scene.gltf(filepath=path)
    pts = []
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            pts += [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    if not pts: return None
    mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return tuple(round(v, 2) for v in (mx - mn))
D = root + r"\KayKit-Dungeon-Remastered-1.0\addons\kaykit_dungeon_remastered\Assets\gltf"
F = root + r"\KayKit-Furniture-Bits-1.0\addons\kaykit_furniture_bits\Assets\gltf"
R = root + r"\KayKit-Restaurant-Bits-1.0\addons\kaykit_restaurant_bits\Assets\gltf"
C = root + r"\KayKit-Character-Pack-Adventures-1.0\addons\kaykit_character_pack_adventures\Characters\gltf"
for folder, names in [(D, ["wall", "wall_doorway", "wall_window_open", "wall_shelves", "floor_wood_large", "shelves", "shelf_large", "table_long", "table_medium", "barrel_large", "candle_lit", "torch_mounted", "bottle_A_green", "chest", "pillar"]),
                      (F, ["shelf_B_large_decorated", "rug_rectangle_A", "book_set"]),
                      (R, ["jar_A_large", "crate", "pot_large", "cuttingboard"]),
                      (C, ["Mage.glb", "Rogue_Hooded.glb"])]:
    for n in names:
        p = os.path.join(folder, n if "." in n else n + ".gltf")
        if folder==D and "." not in n: p = os.path.join(folder, n + ".gltf.glb") if os.path.exists(os.path.join(folder, n + ".gltf.glb")) else os.path.join(folder, n + ".glb")
        if not os.path.exists(p):
            alt = [f for f in os.listdir(folder) if f.startswith(n)]
            print("MISSING", n, alt[:3]); continue
        print("SIZE", n, size_of(p))
clear()
bpy.ops.import_scene.gltf(filepath=os.path.join(C, "Mage.glb"))
print("CHAR_ACTIONS_DONE")
