import bpy, addon_utils
addon_utils.enable("addon", default_set=True, persistent=True)
def go():
    import addon
    sc = bpy.context.scene
    try: sc.blendermcp_auto_start_server = True
    except Exception: pass
    r = addon._blendermcp_ensure_server_running()
    print("MCP server start ->", r, getattr(bpy.types, "blendermcp_server", None) and bpy.types.blendermcp_server.running, flush=True)
    return None
bpy.app.timers.register(go, first_interval=2.0)
