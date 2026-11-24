# Builds CAPITAL's custom low-poly models in Blender (headless) and exports one FBX per model.
# Real-world metres, origin at the base centre (door: at the hinge). Flat-shaded to match KayKit.
# Usage: blender --background --factory-startup --python Tools/blender/build_custom_models.py
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "Assets", "Capital", "Models", "Custom")
OUT = os.path.abspath(OUT)
os.makedirs(OUT, exist_ok=True)
MATS = {}

def mat(name, rgb, metal=0.0, rough=0.7, emit=None):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.use_backface_culling = True  # glTF: single-sided, so the ink outline hull works on the web
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 2.0
    MATS[name] = m
    return m

IRON = lambda: mat("Iron", (0.06, 0.055, 0.055), 0.8, 0.45)
WOOD = lambda: mat("Wood", (0.32, 0.17, 0.08))
DARKWOOD = lambda: mat("DarkWood", (0.16, 0.08, 0.04))
STONE = lambda: mat("Stone", (0.36, 0.35, 0.33), 0, 0.9)
BRASS = lambda: mat("Brass", (0.7, 0.45, 0.15), 0.85, 0.35)
GLASS = lambda: mat("Glass", (0.62, 0.82, 0.8), 0, 0.15)
CORK = lambda: mat("Cork", (0.55, 0.38, 0.2))
LEAF = lambda: mat("HerbRed", (0.62, 0.12, 0.08))
STEM = lambda: mat("Stem", (0.2, 0.3, 0.08))
DRYHERB = lambda: mat("DryHerb", (0.33, 0.4, 0.16))
LAVENDER = lambda: mat("Lavender", (0.42, 0.3, 0.6))
TWINE = lambda: mat("Twine", (0.6, 0.48, 0.3))
CRYSTAL = lambda: mat("CrystalBlue", (0.15, 0.4, 0.95), 0, 0.1, emit=(0.1, 0.3, 0.9))
TEAL = lambda: mat("CrystalTeal", (0.1, 0.75, 0.65), 0, 0.1, emit=(0.08, 0.6, 0.5))
WATER = lambda: mat("MagicWater", (0.3, 0.7, 0.95), 0, 0.1, emit=(0.1, 0.35, 0.6))
EMBER = lambda: mat("Ember", (0.9, 0.3, 0.05), 0, 0.8, emit=(1.0, 0.35, 0.05))
PARCH = lambda: mat("Parchment", (0.85, 0.75, 0.52))

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()

def obj_from_bm(name, bm, material):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth = False
    return o

def lathe(name, profile, material, segments=16, cap_bottom=True, cap_top=False):
    """profile: list of (radius, height) bottom-to-top. Builds a solid of revolution around Z."""
    bm = bmesh.new(); rings = []
    for r, h in profile:
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, h)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        for i in range(segments):
            a, b = rings[j][i], rings[j][(i + 1) % segments]
            c, d = rings[j + 1][(i + 1) % segments], rings[j + 1][i]
            bm.faces.new((a, b, c, d))
    if cap_bottom: bm.faces.new(list(reversed(rings[0])))
    if cap_top: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material)

def box(name, size, loc, material, rot=(0, 0, 0)):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = obj_from_bm(name, bm, material); o.location = loc; o.rotation_euler = rot
    return o

def cyl(name, r, h, loc, material, seg=10, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=h)
    o = obj_from_bm(name, bm, material); o.location = loc; o.rotation_euler = rot
    return o

def ico(name, r, loc, material, scale=(1, 1, 1), sub=1):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    o = obj_from_bm(name, bm, material); o.location = loc
    return o

def torus(name, R, r, loc, material, seg=20, rot=(0, 0, 0)):
    bm = bmesh.new(); rings = []
    minor = 6
    for i in range(seg):
        a = 2 * math.pi * i / seg; ring = []
        for k in range(minor):
            b = 2 * math.pi * k / minor
            rr = R + math.cos(b) * r
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, math.sin(b) * r)))
        rings.append(ring)
    for i in range(seg):
        for k in range(minor):
            a, b = rings[i][k], rings[(i + 1) % seg][k]
            c, d = rings[(i + 1) % seg][(k + 1) % minor], rings[i][(k + 1) % minor]
            bm.faces.new((a, b, c, d))
    o = obj_from_bm(name, bm, material); o.location = loc; o.rotation_euler = rot
    return o

INK = lambda: mat("Ink", (0.06, 0.035, 0.02), 0, 1.0)
OUTLINE = {"cauldron_big": 0.012, "fire_pit": 0.0, "shop_door": 0.0, "entrance_wall": 0.0, "sales_counter": 0.006,
           "parchment_board": 0.0, "hanging_herbs_green": 0.0, "hanging_herbs_lavender": 0.0, "shop_sign": 0.006}

def ink(o, thickness):
    """Inverted-hull outline: a slightly larger shell, normals flipped, dark ink material."""
    if thickness <= 0 or o.type != 'MESH': return
    o.data.materials.append(INK())
    m = o.modifiers.new("Ink", 'SOLIDIFY')
    m.thickness = thickness; m.offset = 1.0; m.use_flip_normals = True; m.use_rim = False
    m.material_offset = len(o.data.materials) - 1

def export(name):
    t = OUTLINE.get(name, 0.0035)
    for o in list(bpy.context.scene.objects):
        if not any(s in o.name for s in ("Water", "Glow", "Ember")): ink(o, t)
    for o in bpy.context.scene.objects: o.select_set(True)
    path = os.path.join(OUT, name + ".fbx")
    bpy.ops.export_scene.fbx(filepath=path, use_selection=True, apply_scale_options='FBX_SCALE_UNITS',
                             axis_forward='-Z', axis_up='Y', bake_space_transform=True, object_types={'MESH'},
                             mesh_smooth_type='FACE', use_mesh_modifiers=True)
    # Web (three.js) copy: binary glTF, modifiers applied, Y-up.
    web = os.path.join(os.path.dirname(OUT), "..", "..", "..", "web", "assets", "custom")
    os.makedirs(web, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(os.path.join(web, name + ".glb")), export_format='GLB',
                              use_selection=True, export_apply=True)
    print("EXPORTED", path)

# ---------------- big cauldron (rim 0.95 m high, 1.3 m across), ornate ----------------
reset()
lathe("CauldronBody", [(0.18, 0.28), (0.45, 0.32), (0.64, 0.45), (0.72, 0.6), (0.7, 0.75), (0.62, 0.88), (0.6, 0.95), (0.54, 0.95), (0.56, 0.86)], IRON(), 32)
torus("CauldronRim", 0.6, 0.05, (0, 0, 0.955), BRASS(), 32)
torus("RuneBand", 0.715, 0.03, (0, 0, 0.66), BRASS(), 32)
torus("LowerBand", 0.6, 0.02, (0, 0, 0.42), BRASS(), 28)
for i in range(8):
    a = i * 2 * math.pi / 8
    # Medallions: brass rings with a teal gem, set into the belly.
    md = torus("Medallion%d" % i, 0.07, 0.014, (math.cos(a) * 0.735, math.sin(a) * 0.735, 0.585), BRASS(), 14, (0, math.radians(90), a))
    gem = ico("Gem%d Glow" % i, 0.035, (math.cos(a) * 0.745, math.sin(a) * 0.745, 0.585), TEAL(), (1, 1, 1), 1)
for i in range(16):
    a = i * 2 * math.pi / 16
    ico("Rivet%d" % i, 0.018, (math.cos(a) * 0.655, math.sin(a) * 0.655, 0.93), BRASS(), (1, 1, 0.7), 1)
for i in range(3):
    a = i * 2 * math.pi / 3 + math.pi / 6
    box("Leg%d" % i, (0.1, 0.1, 0.34), (math.cos(a) * 0.42, math.sin(a) * 0.42, 0.19), IRON(), (0, 0, a))
    ico("Claw%d" % i, 0.085, (math.cos(a) * 0.47, math.sin(a) * 0.47, 0.04), IRON(), (1.4, 1.0, 0.6), 1).rotation_euler = (0, 0, a)
for s_ in (-1, 1):
    torus("Handle%d" % s_, 0.14, 0.026, (s_ * 0.78, 0, 0.78), BRASS(), 16, (math.radians(90), 0, 0))
    box("Lug%d" % s_, (0.12, 0.1, 0.1), (s_ * 0.7, 0, 0.84), IRON())
export("cauldron_big")

# ---------------- fire pit ----------------
reset()
for i in range(14):
    a = i * 2 * math.pi / 14
    ico("Stone%d" % i, 0.16, (math.cos(a) * 1.0, math.sin(a) * 1.0, 0.07), STONE(), (1.3, 1.0, 0.65), 1).rotation_euler = (0, 0, a)
for i, ang in enumerate([0, 60, 120]):
    cyl("Log%d" % i, 0.07, 1.0, (0, 0, 0.08), DARKWOOD(), 8, (math.radians(90), 0, math.radians(ang)))
ico("Embers", 0.42, (0, 0, 0.02), EMBER(), (1, 1, 0.18), 1)
export("fire_pit")

# ---------------- mortar + pestle ----------------
reset()
lathe("Mortar", [(0.12, 0.0), (0.16, 0.03), (0.17, 0.11), (0.15, 0.15), (0.12, 0.15), (0.09, 0.07), (0.0, 0.06)], STONE(), 18)
torus("MortarBand", 0.168, 0.01, (0, 0, 0.09), BRASS(), 24)
export("mortar")
reset()
lathe("Pestle", [(0.0, 0.0), (0.04, 0.012), (0.045, 0.04), (0.026, 0.09), (0.022, 0.25), (0.028, 0.27), (0.0, 0.285)], STONE(), 10)
export("pestle")

# ---------------- big stirring paddle (1.15 m) ----------------
reset()
cyl("Shaft", 0.022, 0.95, (0, 0, 0.62), WOOD(), 8)
box("Blade", (0.12, 0.025, 0.26), (0, 0, 0.13), WOOD())
ico("Knob", 0.035, (0, 0, 1.1), DARKWOOD())
export("stir_paddle")

# ---------------- ingredients (hand-crafted, storybook look) ----------------
PETAL = lambda: mat("HerbPetal", (0.78, 0.13, 0.12))
PETAL2 = lambda: mat("HerbPetalDeep", (0.55, 0.06, 0.1))
POLLEN = lambda: mat("Pollen", (0.98, 0.78, 0.25), 0, 0.6, emit=(0.6, 0.4, 0.05))
LEAFG = lambda: mat("HerbLeaf", (0.24, 0.48, 0.16))
reset()
cyl("Stem", 0.008, 0.18, (0, 0, 0.09), STEM(), 6)
for i in range(4):
    lf = ico("Leaf%d" % i, 0.045, (0.035 * math.cos(i * 1.6), 0.035 * math.sin(i * 1.6), 0.04 + i * 0.025), LEAFG(), (1.8, 0.45, 0.25), 1)
    lf.rotation_euler = (0, math.radians(-25), i * 1.6)
for ring, (r, n, matf, tilt) in enumerate([(0.045, 7, PETAL2, 55), (0.032, 6, PETAL, 35)]):
    for i in range(n):
        a = i * 2 * math.pi / n + ring * 0.4
        pe = ico("Petal%d_%d" % (ring, i), 0.03, (math.cos(a) * r, math.sin(a) * r, 0.2 + ring * 0.012), matf(), (1.6, 0.8, 0.35), 1)
        pe.rotation_euler = (0, math.radians(-tilt), a)
ico("Pollen Glow", 0.018, (0, 0, 0.215), POLLEN(), (1, 1, 0.7), 1)
export("herb_red")
reset()
for i, (x, y, h, tx, ty) in enumerate([(0, 0, 0.16, 0, 0), (0.04, 0.02, 0.11, 0.35, 0.1), (-0.035, 0.03, 0.1, -0.3, 0.2),
                                       (0.012, -0.04, 0.09, 0.15, -0.35), (-0.03, -0.025, 0.07, -0.25, -0.3), (0.045, -0.02, 0.06, 0.45, -0.2)]):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.02 + h * 0.08, radius2=0.02 + h * 0.08, depth=h)
    tip = [v for v in bm.verts if v.co.z > 0]
    bmesh.ops.pointmerge(bm, verts=tip, merge_co=Vector((0, 0, h / 2 + 0.03)))
    o = obj_from_bm("Shard%d" % i, bm, CRYSTAL()); o.location = (x, y, h / 2 + 0.015); o.rotation_euler = (tx, ty, i)
ico("Core Glow", 0.03, (0, 0, 0.06), mat("CrystalCore", (0.6, 0.85, 1.0), 0, 0.1, emit=(0.4, 0.7, 1.0)), (1, 1, 1.4), 1)
ico("Base", 0.055, (0, 0, 0.01), STONE(), (1.3, 1.3, 0.35))
export("crystal_blue")
reset()
lathe("Flask", [(0.0, 0.0), (0.045, 0.004), (0.07, 0.03), (0.078, 0.065), (0.068, 0.1), (0.03, 0.125), (0.019, 0.14), (0.019, 0.2), (0.026, 0.21), (0.0, 0.212)], GLASS(), 16)
lathe("Water Glow", [(0.0, 0.008), (0.06, 0.025), (0.07, 0.065), (0.055, 0.095), (0.0, 0.1)], WATER(), 16)
torus("Collar", 0.022, 0.006, (0, 0, 0.165), BRASS(), 12)
cyl("Cork", 0.017, 0.032, (0, 0, 0.222), CORK(), 8)
for i in range(3):
    ico("Bubble%d Glow" % i, 0.006, (0.02 * math.cos(i * 2), 0.02 * math.sin(i * 2), 0.04 + i * 0.02), WATER(), (1, 1, 1), 1)
export("water_flask")
reset()
lathe("Bottle", [(0.0, 0.0), (0.05, 0.004), (0.058, 0.04), (0.05, 0.085), (0.02, 0.11), (0.016, 0.15), (0.021, 0.16), (0.0, 0.16)], GLASS(), 16)
torus("Band", 0.052, 0.005, (0, 0, 0.07), BRASS(), 16)
cyl("Cork", 0.014, 0.028, (0, 0, 0.165), CORK(), 8)
export("potion_bottle")

# ---------------- hanging herb bundles (ceiling decor) ----------------
for variant, leafmat in (("hanging_herbs_green", DRYHERB), ("hanging_herbs_lavender", LAVENDER)):
    reset()
    cyl("Cord", 0.006, 0.3, (0, 0, -0.15), TWINE(), 6)
    cyl("Tie", 0.035, 0.04, (0, 0, -0.32), TWINE(), 8)
    for i in range(16):
        a = i * 2.4; r = 0.03 + (i % 4) * 0.012
        s = cyl("Sprig%d" % i, 0.006, 0.34, (math.cos(a) * r, math.sin(a) * r, -0.5), STEM(), 5)
        s.rotation_euler = (math.cos(a) * 0.25, math.sin(a) * 0.25, 0)
        ico("Bud%d" % i, 0.03, (math.cos(a) * r * 1.8, math.sin(a) * r * 1.8, -0.62 - (i % 3) * 0.04), leafmat(), (0.8, 0.8, 1.8), 1)
    export(variant)

# ---------------- Firas crystal pedestal ----------------
reset()
lathe("Pedestal", [(0.26, 0.0), (0.26, 0.08), (0.17, 0.12), (0.12, 0.2), (0.11, 0.8), (0.16, 0.86), (0.2, 0.92), (0.0, 0.93)], STONE(), 8)
torus("BrassBand", 0.115, 0.015, (0, 0, 0.5), BRASS(), 16)
for i in range(4):
    a = i * math.pi / 2
    box("Claw%d" % i, (0.025, 0.025, 0.12), (math.cos(a) * 0.1, math.sin(a) * 0.1, 0.97), BRASS(), (math.cos(a) * 0.4 * -1 if i % 2 == 0 else 0, math.sin(a) * 0.4 if i % 2 else 0, 0))
export("firas_pedestal")
reset()
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.07, radius2=0.07, depth=0.18)
for v in bm.verts: v.co.z += 0.09
top = [v for v in bm.verts if v.co.z > 0.1]; bot = [v for v in bm.verts if v.co.z < 0.1]
bmesh.ops.pointmerge(bm, verts=top, merge_co=Vector((0, 0, 0.27)))
bmesh.ops.pointmerge(bm, verts=bot, merge_co=Vector((0, 0, -0.06)))
obj_from_bm("Crystal", bm, TEAL())
export("firas_crystal")

# ---------------- shop door (hinge at origin, opens around Z) ----------------
reset()
for i in range(6):
    box("Plank%d" % i, (0.19, 0.06, 2.25), (0.1 + i * 0.2, 0, 1.125), WOOD() if i % 2 else DARKWOOD())
for z in (0.35, 1.9):
    box("Strap%d" % z, (1.2, 0.075, 0.07), (0.6, -0.01, z), IRON())
ico("Ring", 0.05, (1.02, -0.07, 1.05), BRASS())
torus("Knocker", 0.06, 0.012, (1.02, -0.08, 0.98), BRASS(), 12, (math.radians(90), 0, 0))
export("shop_door")

# ---------------- sales counter (2.2 m) ----------------
reset()
box("Top", (2.3, 0.75, 0.08), (0, 0, 1.0), WOOD())
box("Front", (2.2, 0.06, 0.95), (0, -0.3, 0.48), DARKWOOD())
for x in (-1.05, 1.05): box("Side%d" % x, (0.08, 0.7, 0.96), (x, 0, 0.48), DARKWOOD())
for x in (-0.55, 0.0, 0.55): box("Panel%d" % x, (0.45, 0.02, 0.6), (x, -0.335, 0.5), WOOD())
box("Shelf", (2.1, 0.6, 0.05), (0, 0.02, 0.4), WOOD())
export("sales_counter")

# ---------------- hanging shop sign + bottling stand + wall recipe board ----------------
reset()
box("Board", (1.3, 0.06, 0.6), (0, 0, -0.55), WOOD())
box("Trim", (1.38, 0.07, 0.06), (0, 0, -0.24), DARKWOOD())
for x in (-0.45, 0.45): cyl("Chain%d" % x, 0.01, 0.25, (x, 0, -0.12), IRON(), 6)
box("Bracket", (1.6, 0.06, 0.06), (0, 0, 0.0), IRON())
export("shop_sign")
reset()
box("Base", (0.5, 0.5, 0.06), (0, 0, 0.03), DARKWOOD())
cyl("Post", 0.04, 0.9, (0, 0, 0.48), WOOD(), 8)
box("Top", (0.55, 0.55, 0.05), (0, 0, 0.93), WOOD())
torus("Holder", 0.075, 0.012, (0, 0, 1.0), BRASS(), 16)
lathe("Funnel", [(0.015, 1.18), (0.02, 1.25), (0.09, 1.36), (0.095, 1.38)], BRASS(), 12, cap_bottom=False)
box("Arm", (0.03, 0.03, 0.5), (0.2, 0, 1.15), BRASS())
box("ArmTop", (0.25, 0.03, 0.03), (0.1, 0, 1.38), BRASS())
export("bottling_stand")
reset()
box("Board", (1.2, 0.04, 0.8), (0, 0, 0), PARCH())
box("Frame", (1.3, 0.05, 0.9), (0, 0.012, 0), DARKWOOD())
export("parchment_board")
# ---------------- entrance wall module: 3 x 3 m, 0.75 m thick, 1.3 x 2.35 m opening ----------------
reset()
WALLSTONE = mat("WallStone", (0.4, 0.4, 0.43), 0, 0.95)
box("JambL", (0.85, 0.75, 3.0), (-1.075, 0, 1.5), WALLSTONE)
box("JambR", (0.85, 0.75, 3.0), (1.075, 0, 1.5), WALLSTONE)
box("Over", (1.3, 0.75, 0.65), (0, 0, 2.675), WALLSTONE)
box("Lintel", (1.6, 0.85, 0.18), (0, 0, 2.44), DARKWOOD())
for x in (-0.72, 0.72): box("Post%d" % x, (0.14, 0.82, 2.35), (x, 0, 1.175), DARKWOOD())
box("Step", (1.7, 1.2, 0.08), (0, -0.2, 0.04), STONE())
export("entrance_wall")
print("ALL-DONE")
