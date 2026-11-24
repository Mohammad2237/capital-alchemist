# HANDOFF — continue CAPITAL: The Alchemist's Legacy in a new chat

Paste this into the new chat:

> Read `HANDOFF.md` in this folder first, then the master prompt at
> `C:\Users\moham\Downloads\CAPITAL_Alchemists_Legacy_Master_Prompt_V3.md`, then continue from "Next steps".

---

## 1. What the project is

- An Arabic VR financial-literacy game for a school competition.
  - Arabic title: «رأس المال: إرث الكيميائي». The word must be **كيميائي**, never خيميائي.
  - The player inherits a potion shop. They buy ingredients from a wandering trader, then crush, mix, stir and bottle a potion in a big central cauldron.
  - They sell to a customer, take a bulk order of 3 from a merchant, face a supplier risk (a wilted herb), and pay the shop's bills.
  - The point is to learn **revenue, gross profit, net profit and cash**.
- Firas is a teal hologram guide (KayKit Mage model) who flies between stations.
- **Deadline:** Thursday 26 Nov 2026. Feature freeze is Wednesday night.
- The teacher requires the game to **run from a URL hosted on GitHub**, and it must work in a **VR headset browser** (the user has a headset). Phone and desktop must also work.

## 2. Where everything is

| Thing | Where |
|---|---|
| Live game | https://mohammad2237.github.io/capital-alchemist/ |
| Repo | https://github.com/Mohammad2237/capital-alchemist (branch `main`, Pages serves `/docs`) |
| Old Unity version | branch `unity-version` (archived; **Unity was dropped because its WebXR broke VR**) |
| Windows demo zip (Unity) | GitHub release `v1.0-demo` |
| Local project | `C:\Users\moham\Desktop\VR project` |
| KayKit source packs (CC0) | `C:\Users\moham\Downloads\capital-assets` |
| Master spec | `C:\Users\moham\Downloads\CAPITAL_Alchemists_Legacy_Master_Prompt_V3.md` |

The last commit on `main` is `0e1b3fb`: "Replace Unity with the three.js + WebXR edition". The working tree was clean before this file was added.

## 3. Engine and architecture (three.js r170 + WebXR, no build step)

The whole game is static files in `docs/`. three.js is vendored in `docs/vendor/three` and loaded through an importmap.

| File | Role |
|---|---|
| `docs/index.html`, `style.css` | Loading card, Arabic DOM HUD, fade card, VR button «ادخل الواقع الافتراضي», Amiri font |
| `docs/js/main.js` | Renderer (ACES, soft shadows, `xr.enabled`, `local-floor`), sky dome, sun, rig + camera (eye height 1.62), frame loop, `window.__capital = game`, `?smoke=N` |
| `docs/js/game.js` | Main director: phase enum `P` (Intro=0 … Report=14), dialogue (`assets/DIALOGUE.csv`), items, BrewMap, stations, desktop/touch/VR input, teleport arc |
| `docs/js/finance.js` | Line-for-line port of the C# finance ledger (idempotent stable-ID postings, spoilage kept separate from COGS, `RecipeProgress`) |
| `docs/js/layout.js` | Positions written in Unity numbers through `U(x,y,z) => Vector3(-x,y,z)`; `uyaw`, `camYaw(d)=PI-deg2rad(d)`, `Stations` (cam/look/stand/firas) |
| `docs/js/assets.js` | `load`, `place(parent,url,at,{yaw,height/width/scale,alignTop,collider})` (base-centre placement by measured bounds), `character()`, colliders |
| `docs/js/shop.js` | Builds the shop and village: walls, roof, hinged door (`refs.door`), cauldron + liquid + flames, stations, shelves, lanterns, exterior |
| `docs/js/ui.js` | HUD state + VR canvas panel (1024×720, lazy follow, controller-ray hit test), `card()`, `fade()` |
| `docs/js/audio.js` | Procedural Web Audio: grind, splash, glass, coins, knock, creak, crystal, reject, paper, chime + ambience/bubbling |
| `docs/js/fx.js` | Sparkles, steam tinted by the cauldron's contents (gold in the target zone), bubbles, coins, door swing, station ring |
| `docs/js/npc.js` | `NPC` (arrive/leave/react/receive, AnimationMixer clips) and `Firas` (solid teal emissive, opacity 0.88, flies to stations) |
| `docs/js/smoke.js` | Automated playthrough of one branch, 28 checks |
| `docs/tests/finance.test.mjs` | `node docs/tests/finance.test.mjs` should print ALL PASS |
| `docs/assets/` | `kaykit/*` glTF, `custom/*.glb` (19 Blender-made models), `DIALOGUE.csv`, favicon |
| `Tools/blender/build_custom_models.py` | Rebuilds the custom models in Blender 5.2 headless (ink outlines). **Its output path still says `web/assets/custom`; change it to `docs/assets/custom`.** |

Characters (KayKit Adventurers):

| Model | Role |
|---|---|
| Mage | Firas |
| Barbarian | wandering trader «التاجر المتجول» |
| Rogue_Hooded | customer «الزبون» |
| Knight | merchant «التاجر» |

glTF characters already face +Z, so **don't add a Math.PI flip**.

Alchemy map (creative brewing):
- Each ingredient pushes a marker in its own direction.
- Stirring moves the marker. Clockwise steers right.
- The target zone is at (0.42, 0.62). Quality 1–3 depends on how close the marker got to it.
- The cauldron rejects invalid items, which bounce back home.

## 4. Financial model (must stay exact)

- Start with 100 coins.
- First potion costs 25: herb 10, crystal 8, water 5, bottle 2.
- The player prices it at 30 or 50. The merchant pays 37 or 30 respectively.
- Batch of 3:
  - Cheap supplier: 45. The wilted herb can be replaced (+5) or used (lose one potion, 15 spoilage).
  - Premium supplier: 60.
- Operating expenses: 10.
- **Final cash for the six branches (smoke N=0..5): 156 / 124 / 146 / 155 / 130 / 145.**
- Taxes and financing are excluded and labelled as such in the report.

## 5. Controls

| Desktop | Phone | VR |
|---|---|---|
| WASD walk (Shift run), right-mouse look | Left joystick, drag to look | Left stick walk; right stick snap-turn, push forward to teleport |
| E or click: grab / drop / open door | Tap to grab or drop | Grip: grab; move your hand to stir and crush |
| F (hold): pour | «اضغط مطولًا للصب» button | Right trigger: pour, press buttons, open the door |
| Q: station view, Tab: encyclopedia, R: restart | buttons | X: encyclopedia |

- On desktop, each step glides the camera to a framed view (above the cauldron while stirring, over the mortar, and so on).
- In VR the camera is **never** moved for the player. A glowing floor ring shows where to stand, and the player blink-teleports there.

## 6. How to run and test

- **Run locally:**
  ```powershell
  python -m http.server 8090 --directory docs
  ```
  Then open http://localhost:8090. `.claude/launch.json` has a "capital-three" entry for the browser pane.
- **Smoke test:** open `index.html?fast&smoke=N`. If the browser pane is hidden, run it from the console instead:
  ```js
  import("./js/smoke.js").then(m => m.runSmoke(window.__capital, N))
  ```
  Expect 0 failures and the final cash above.
- **Last verified:**
  - All 6 branches pass locally.
  - Branch 0 passes on the live site.
  - `navigator.xr` is present on the live site.
- **Not verified:** VR on a real headset. This is the top priority.

## 7. Git and GitHub

- Git Credential Manager is logged in as **Mohammad2237**. Push with:
  ```powershell
  git -c credential.username=Mohammad2237 push
  ```
- The commit identity is "Capital Team" (capital-team@users.noreply.github.com).
- **Never type passwords, and never print the token.** Keep the user's email out of commits and files.
- After pushing, wait for GitHub Pages to rebuild (about 1 minute), then re-check the live URL.
- `.mcp.json` (the Blender MCP config) is untracked. Leave it out of commits.

## 8. Things the user asked for (keep honoring them)

- Polish everything to "tier 3": real 3D models, animations between scenes and stations, NPCs that walk and talk back, buttons that look good to click.
- Keep text in VR short. Steps should be short and precise.
- Creative, exploratory brewing; don't force one way to play.
- Held items must not snap when the camera moves.
- Smoke should depend on what's in the cauldron.
- Firas shouldn't look too glassy.
- The shop exterior should look good.
- No stray text boxes or stuck yellow text.
- **Push everything to GitHub.**

## 8b. Done after the first headset test (24 Nov)
- VR eye height auto-lift when the headset reports a low floor; B button re-calibrates (`calibrate()` in game.js, `vrLift`).
- Grab from afar (trigger at item) and point-to-place release (`rayItem`, `rayZone`, `vrGrab`, `vrRelease`).
- Bigger VR panel text/buttons (ui.js `draw`), bigger HUD text, fewer dialogue lines.
- Palestinian/Levantine dialect lines in `DIALOGUE.csv` + recorded voices in `docs/assets/voice/*.mp3` (regenerate: `python Tools/voices/make_voices.py`).
- Audio rewritten: no clicking (crossfaded loops, soft attacks), new sounds (whoosh, pop, footsteps, stir swish, pour loop, thud).
- Firas floats in front of the player when he talks; NPCs turn to face the player.
- Perf: on headset/phone only the fire + 3 nearest lamps are lit, shadows update every 1.5 s, NPCs cast no shadow in VR.
- Player measured ~20 FPS before these perf changes.

## 9. Next steps

1. **The user tests VR on the headset** at the live URL, then reports what breaks. Fix those issues first.
2. Check the performance in the Quest browser. Possible fixes: lower the framebuffer scale (currently 0.9), reduce shadows, merge static meshes.
3. Visual polish:
   - The shop sign label may sit hidden behind the HUD bar.
   - The neighbouring buildings.
   - A visible paddle on desktop while stirring.
4. Fix the Blender script output path (`web/assets/custom` → `docs/assets/custom`).
5. Update `TEST_REPORT.md`, `KNOWN_LIMITATIONS.md` and `ASSET_LICENSES.md` for the three.js edition (three.js is MIT).
6. Optional, and only if the user says so: delete the local Unity caches (`Library`, `Temp`, `Builds`, `Logs`) to free disk space.

## 10. History, in short

- The game was first built in Unity 6 with the WebXR export.
- A different agent ("codex") later replaced `docs/` with a standalone page and left broken local edits.
  - Its page was undone with a merge.
  - Its local edits are backed up in the old session's scratchpad (`other-agent/local-changes.diff`).
- The Unity VR button never worked because the WebXR settings and loader assets were never created. That was fixed, but the user then asked to drop Unity entirely.
- The whole game was rewritten in three.js and WebXR. This is the current `main`.
- Full transcript of the old chat:
  `C:\Users\moham\.claude\projects\C--Users-moham-Desktop-VR-project\d7d3c9e8-7602-4de2-b482-4af45783075c.jsonl`
