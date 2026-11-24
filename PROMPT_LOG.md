# Prompt log — truthful record of AI assistance

This file records the actual AI-assisted work in this workspace. It is evidence for the "AI and prompts"
judging area. It does not claim that Firas is powered by a live model: Firas is a scripted, authored NPC.

## Session 1 — environment and tooling (23 November 2026)

| Prompt / request (verbatim intent) | What the agent did | Outcome / human-relevant result |
|---|---|---|
| "Install blender and then install blender mcp" | Winget Blender 5.3.0; `uv tool install mcp-for-blender`; installed the add-on headlessly and registered the MCP server | Verified `get_addon_status`: Blender 5.3.0, protocol 16, telemetry off |
| "can u install unity mcp?" | Installed `mcpforunityserver` 10.3.0, created a Unity project, added the Editor package by git URL | Verified a connected Unity instance; used later to inspect and drive the editor |

## Session 2 — the build prompt

The team supplied a long master build prompt (design, finance matrix, dialogue, architecture, deliverables).
The agent did **not** treat it as a literal sequence of independent tasks; it inspected the machine first.

| Step | Prompt / instruction used | Action taken | Verification |
|---|---|---|---|
| Environment audit | "Inspect installed editor, packages, assets, internet connectivity, test devices" | Queried Unity release API, installed editors, playback engines, package registry, PnP devices | 6000.6.10f1 = SUPPORTED; 6000.3.29f1 = LTS; no Android module, no headset, no ADB |
| Package compatibility | "Do not assume package versions" | Read the editor's own `BuiltInPackages` and `PackageCache` for URP/TMP/Input/XRI/OpenXR | Pinned exactly those versions in `Packages/manifest.json` |
| Arabic first | "Solve RTL before building the full HUD" | Cloned RTLTMPro, downloaded Amiri (OFL), built a shaped-glyph corpus from the dialogue + code | `Evidence/arabic-glyph-coverage.txt` |
| Finance first | "Test numbers first, before art polish" | Pure C# transaction ledger + EditMode tests before scene work | `TEST_REPORT.md` |
| Compile fixes | (agent self-correction from editor logs) | Fixed 3 real compile errors reported by Unity: static `WorldLabel` call, `CommonUsages` ambiguity, obsolete `enableWordWrapping` | Recompiled cleanly |
| Setup failure | (agent self-correction) | TMP Settings was not yet imported when the font asset was created → `NullReferenceException`; extracted TMP Essential Resources, reran | Font asset builds |

### Representative agent-side prompts (paraphrased)

- "Inspect the actual environment and existing files. Identify what is possible today."
- "Build a tiny Arabic RTL verification UI and the financial calculation layer, including the six acceptance tests."
- "Create the three scenes and complete the required tactile crafting sequence, with one coherent medieval shop prefab."
- "Run the available tests, fix errors, and produce an end-to-end build and status report."

### Failed attempts and fixes (kept deliberately)

1. **Batch-mode project creation conflict** — a second `-batchmode` Unity launch failed because the editor was
   already holding the project. Fix: closed the GUI editor before batch execution.
2. **Unity "SAFE MODE"** — the editor restarted into safe mode after the first script import. Fix: ran the
   builder through `-executeMethod` so compilation and setup are deterministic and logged.
3. **TMP settings race** — see above.
4. **Compile errors** — see above.

### What the AI did *not* do

- It did not run or claim a headset test.
- It did not invent measured FPS, rubric percentages, or judge feedback.
- It did not create a live conversational model for Firas.
- It did not fabricate voice recordings; dialogue falls back to timed subtitles.
- It did not claim the LTS editor was already installed; it reported the supported release and installed LTS.

## Reproducing the assistant workflow

```powershell
# 1. Inspect
$r = Invoke-RestMethod 'https://services.api.unity.com/unity/editor/release/v1/releases?version=6000.3.29f1'
# 2. Build the project data, scenes and font
Unity.exe -batchmode -quit -projectPath <project> -executeMethod CapitalBuilder.BuildProject -logFile Evidence/setup.log
# 3. Tests, then player build, then the automated desktop route
Unity.exe -batchmode -quit -projectPath <project> -runTests -testPlatform EditMode -testResults Evidence/editmode.xml
Unity.exe -batchmode -quit -projectPath <project> -executeMethod CapitalBuilder.BuildWindows
Builds/Windows/Capital.exe --smoke --evidence Evidence
```

## Session 2 — 23 November 2026, evening (Claude Code, new PC)

Prompt (team member): "read MD and the files … continue where it's left off and edit." Later: permission to
download anything needed (Unity etc.).

What the AI did:
- Inspected the copied project and found the stopping point: tests passed, Windows build never completed,
  `TEST_REPORT.md` missing.
- Checked this PC: no Unity, no .NET SDK, ~5 GB free disk. **Did not install Unity** — not enough disk space
  for the editor; reported this instead of starting a download that would fail.
- Added explicit EditMode tests for spec §15 items 2, 3, 4, 5, 7, 9 and extra guards (uncompiled).
- Added a parameterless `InventoryLot` constructor so the JSON save snapshot can deserialise.
- Fixed a narrative bug: Firas praised the premium potions (`S3_FB`) before they were brewed; it now plays
  after the merchant accepts them.
- Removed an empty stray `Assets/XR 1` folder; fixed wrong price list in `KNOWN_LIMITATIONS.md`.
- Wrote `TEST_REPORT.md` with honest PASS / NOT TESTED status.

Not done / not claimed that evening: no compile, no test run, no build, no playthrough on this PC.

### Session 2, continued — overnight 23→24 November 2026

After the team freed disk space and granted permission to download tools:
- Installed Unity 6000.6.10f1 silently into the user folder (`C:\Users\moham\Unity\Editors\6000.6.10f1`),
  because the shell had no admin rights. The installer's firewall notice only affects the remote Profiler.
- Unity was already signed in, but **no licence was activated**: activation requires accepting the Unity
  Personal terms, which the AI left to the team. That blocks batch-mode tests and builds.
- Workaround: compiled all four assemblies with Unity's own Roslyn from the recorded `Library/Bee` command
  lines (0 errors) and ran `Capital.Tests` with a small reflection runner: 21 passed, 0 failed, 1 skipped
  (needs the engine).
- Failed attempts kept: 7-Zip could not unpack the NSIS installer; `winget` Unity Hub was a no-op (MSIX,
  not elevated); Git Bash rewrote `/noconfig` into a path (fixed with `-noconfig`); the first compile pass
  redirected package references to the wrong folder.
- Made the Tools scripts find the editor automatically (`Tools/_find-editor.ps1`).

### Session 2, continued — 24 November 2026, morning

Prompt (team member): "licence done … i also want you to start building." The team activated the Unity
Personal licence themselves; the AI did not accept any terms.
- Ran the real Unity Test Runner: 123/123 passed (`Evidence/editmode.xml`).
- Produced the first finished Windows build (`Builds/Windows/Capital.exe`) and ran the six-branch smoke route.
- **Failed attempt kept:** the first smoke run failed `book pauses interactions` in all six branches. Cause: the
  XRI bottle socket's selection set `Held=true` permanently, so the dictionary refused to open after bottling.
  Fixed in `IngredientInteraction.cs`; rerun passed.
- Reviewed smoke screenshots and fixed two visible problems: Firas's hologram hid the recipe parchment, and the
  objective panel kept old text on later phases.
- Tier 2 polish (spec §3): procedural SFX set, spatial cauldron bubbling, bubbles/sparkle, coin flights, door
  swing, supplier-dependent brew colour, warmer ending, URP post-processing profile.
- Final evidence: Unity tests 123/123, build 0 errors, smoke 145 PASS / 0 FAIL.

### Session 2, continued — 24 November 2026, shop overhaul

Prompts (team member, paraphrased): "the 3D models were bad; it's a VR game; you should inherit the store, enter
it and Firas welcomes you; I need a big cauldron in the middle with things around it; install Blender MCP; get
outside models if needed"; "everything should be Tier 3 detail"; "make sure you can go around in VR".
Reference images supplied: four cozy potion-shop interiors (used for mood only, nothing copied).

What the AI did:
- Downloaded five KayKit CC0 packs from the creator's official GitHub (licences kept beside the models).
- Installed Blender MCP (add-on enabled in Blender 5.2, `uvx blender-mcp` cached, `.mcp.json` added). Its tools
  load in a new session, so this session drove Blender headless with Python instead
  (`Tools/blender/build_custom_models.py`): big cauldron, fire pit, mortar, pestle, paddle, ingredients, bottle,
  hanging herbs, Firas pedestal and crystal, door, entrance wall, counter, sign, bottling stand, parchment board.
- Measured KayKit models in Blender before placing them. Found that KayKit's doorway wall has a closed door baked
  in, so built a matching entrance wall.
- New `ShopLayout` (one floor plan), `ShopDressing` (editor set-dressing by measured bounds), animated
  characters with generated Animator controllers, entrance flow, WASD walking, VR locomotion, floating VR HUD.
- **Failed attempts kept:** first ray-cast measurement of the doorway gave nonsense (object transforms not
  applied); steam spheres rendered opaque (runtime material variant); KayKit characters faced backwards; a
  leading Latin word scrambled an Arabic line; a real mouse click during a smoke run changed a branch. Each was
  found from evidence (screenshots or the smoke log) and fixed, then re-verified.

### Session 2, continued — 24 November 2026, polish pass

Prompt (team member, paraphrased): "make it VR-headset friendly with keyboard or headset controls; things should
look good to click; title must be الكيميائي; the guy needs to move; when stirring the POV should be above the
cauldron, same when measuring and pouring into the glass; good transitions between scenes and stations; polish
the stick, the pouring, talking to the customer."

Design decision recorded: station "POV" moves the camera only on desktop. In VR the camera is never moved by the
game (comfort rule in the brief), so VR players get floor rings and a blink teleport and physically lean over the
cauldron. Firas (the "guy") now flies between stations as a guide; customers walk in and gesture while talking.
Found and fixed from screenshots: invisible pour stream (same-frame disable), double bottle snap warning, Firas
blocking the stir/pour views. Final: tests 123/123, build OK, smoke 157/157.

### Session 2, continued — 24 November 2026, evening: web + VR browser, team feedback

Prompts (team member, paraphrased): the teacher wants it playable from a URL (GitHub); a VR headset is now
available; feedback: too much text for VR, audio issue, items snapping when the camera moves, cauldron accepts
anything, buying should be face-to-face with NPCs who talk back, creative non-repetitive brewing like
potion-map games, better cauldron/smoke/ingredients/exterior, Firas too glassy, stray text boxes.

What the AI did: kept Unity (a three.js rewrite would have discarded working systems two days before the
deadline) and added a WebGL + WebXR build (De-Panther WebXR Export 0.25, CC/Apache per its licence), patched
the package for Unity 6.6's Emscripten 4 (`Browser` -> `MainLoop`), touch controls, published to GitHub Pages.
Then: wandering trader NPC + dialogue box replacing menus, alchemy-map brewing with craft quality (costs and the
six financial outcomes unchanged), content-tinted swirling smoke, ink-outlined Blender ingredients and an ornate
cauldron (original art, inspired by but not copied from Potion Craft), village lane from KayKit Medieval
Hexagon (CC0), compact HUD with coin purse, cauldron rejection, held items released on camera glides.
Failed attempts kept: first web build crashed (`Browser is not defined`); a shell in the wrong folder made one
pipeline run do nothing; a smoke-effect edit deleted neighbouring code (caught by the compile check).
Verified: tests 123/123, Windows build, smoke 157/157, web build loads and plays from the public link.
