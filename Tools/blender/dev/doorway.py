import bpy, mathutils
from mathutils.bvhtree import BVHTree
p = r"C:\Users\moham\Desktop\VR project\Assets\ThirdParty\KayKit\Dungeon\%s.fbx"
for name in ["wall_doorway", "wall_window_open", "wall_archedwindow_open"]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=p % name)
    for o in bpy.context.scene.objects: o.select_set(o.type=='MESH')
    bpy.context.view_layer.objects.active = next(o for o in bpy.context.scene.objects if o.type=='MESH')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    dg = bpy.context.evaluated_depsgraph_get()
    trees = []
    pts = []
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            trees.append(BVHTree.FromObject(o, dg))
            pts += [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    mn = [min(q[i] for q in pts) for i in range(3)]; mx = [max(q[i] for q in pts) for i in range(3)]
    print("BOUNDS", name, [round(v, 2) for v in mn], [round(v, 2) for v in mx])
    # Find which axis is thickness (smallest extent) and probe holes across the other two.
    ext = [mx[i] - mn[i] for i in range(3)]; t = ext.index(min(ext)); a, b = [i for i in range(3) if i != t]
    holes = []
    steps = 40
    for i in range(2, steps - 1):
        for j in range(1, steps - 1):
            o = [0, 0, 0]; o[a] = mn[a] + ext[a] * i / steps; o[b] = mn[b] + ext[b] * j / steps; o[t] = mn[t] - 1
            d = [0, 0, 0]; d[t] = 1
            hit = any(tr.ray_cast(mathutils.Vector(o), mathutils.Vector(d), ext[t] + 2)[0] is not None for tr in trees)
            if not hit: holes.append((o[a], o[b]))
    if holes:
        ha = [h[0] for h in holes]; hb = [h[1] for h in holes]
        print("HOLE", name, "axis", "xyz"[a], round(min(ha), 2), round(max(ha), 2), "axis", "xyz"[b], round(min(hb), 2), round(max(hb), 2), "thick-axis", "xyz"[t])
    else:
        print("NOHOLE", name)
