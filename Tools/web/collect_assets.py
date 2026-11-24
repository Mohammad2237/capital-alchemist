# Copies the web-ready (glTF/GLB) versions of every KayKit model the shop uses into web/assets/kaykit/.
# The model list comes from the Unity set-dressing script, so the web shop uses exactly the same props.
# Usage: python -I Tools/web/collect_assets.py <path to the folder holding the KayKit-* clones>
import os, re, shutil, sys

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
packs = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(r"~\Downloads\capital-assets")
dst = os.path.join(root, "web", "assets", "kaykit")
src = {
    "Dungeon": os.path.join(packs, r"KayKit-Dungeon-Remastered-1.0\addons\kaykit_dungeon_remastered\Assets\gltf"),
    "Furniture": os.path.join(packs, r"KayKit-Furniture-Bits-1.0\addons\kaykit_furniture_bits\Assets\gltf"),
    "Restaurant": os.path.join(packs, r"KayKit-Restaurant-Bits-1.0\addons\kaykit_restaurant_bits\Assets\gltf"),
    "Halloween": os.path.join(packs, r"KayKit-Halloween-Bits-1.0\addons\kaykit_halloween_bits\Assets\gltf"),
    "Town": os.path.join(packs, r"KayKit-Medieval-Hexagon-Pack-1.0\addons\kaykit_medieval_hexagon_pack\Assets\gltf"),
    "Characters": os.path.join(packs, r"KayKit-Character-Pack-Adventures-1.0\addons\kaykit_character_pack_adventures\Characters\gltf"),
    "Accessories": os.path.join(packs, r"KayKit-Character-Pack-Adventures-1.0\addons\kaykit_character_pack_adventures\Assets\gltf"),
}
dressing = open(os.path.join(root, r"Assets\Capital\Editor\ShopDressing.cs"), encoding="utf-8").read()
prefix = {"D": "Dungeon", "F": "Furniture", "R": "Restaurant", "H": "Halloween", "T": "Town", "C": "Accessories"}
wanted = set()
for p, name in re.findall(r'\b([DFRHTC]) \+ "([A-Za-z0-9_]+)\.fbx"', dressing): wanted.add((prefix[p], name))
for name in re.findall(r'Pick\(ShelfItems\)|"(bottle_[A-Za-z_]+)"', dressing):
    if name: wanted.add(("Dungeon", name))
for name in re.findall(r'"(jar_[A-Z]_[a-z]+)"', dressing): wanted.add(("Restaurant", name))
for name in re.findall(r'"(path_[A-D])"', dressing): wanted.add(("Halloween", name))
for name in re.findall(r'\("(building_[a-z_A-Z]+)"', dressing): wanted.add(("Town", name))
wanted |= {("Characters", n) for n in ("Mage", "Rogue_Hooded", "Knight", "Barbarian")}
wanted |= {("Restaurant", "bowl_small")}

def find(folder, name):
    for dirpath, _, files in os.walk(folder):
        for f in files:
            stem = f.split(".")[0]
            if stem == name and (f.endswith(".glb") or f.endswith(".gltf")):
                return os.path.join(dirpath, f)
    return None

copied, missing = 0, []
for pack, name in sorted(wanted):
    f = find(src[pack], name)
    if not f: missing.append(f"{pack}/{name}"); continue
    out = os.path.join(dst, pack); os.makedirs(out, exist_ok=True)
    ext = ".glb" if f.endswith(".glb") else ".gltf"
    shutil.copy2(f, os.path.join(out, name + ext))
    if ext == ".gltf":  # copy its buffer + textures
        d = os.path.dirname(f)
        for extra in os.listdir(d):
            if extra.startswith(name + ".") and extra.endswith(".bin") or extra.endswith(".png") and "sample" not in extra.lower():
                shutil.copy2(os.path.join(d, extra), os.path.join(out, extra))
    copied += 1
print("copied", copied, "missing", missing)
