# HANDOFF — continue CAPITAL: The Alchemist's Legacy in a new chat

Paste this into the new chat:

> Read `HANDOFF.md` in this folder first, then the master prompt at
> `C:\Users\moham\Downloads\CAPITAL_Alchemists_Legacy_Master_Prompt_V3.md`, then continue from "Next steps".

---

## 1. What the project is (current: banking edition, build r12)

- An Arabic VR **financial-literacy + banking** game for a school competition; may also be shown to real banking people.
  - Title: «رأس المال: إرث الكيميائي» (must be **كيميائي**, never خيميائي).
  - Mission (loading screen + README): schools/universities rarely teach money management, banks and digital payments; you learn by living it.
  - You inherit a **herbal remedy shop** (no fantasy wording). Scene 1–2 product: «شاي الأعشاب المنشّط» (كركديه، نعناع، ماء معدني، عبوة). Scene 3 product: «زيت الميرمية العلاجي» (ميرمية، راتنج لبان melted on a brazier، زيت زيتون).
  - Flow: open the shop door by hand → Firas (hologram guide) welcomes you, explains capital, bank account and the debit/credit cards → walk through a stone-arch **portal** to a far **market square** with 2 sellers → put the ordered herbs in a stall basket → **tap-to-pay** at the stall's card terminal (choose debit or credit; card appears in hand, beeps, then vanishes) → back through the portal → grind to the ordered texture, add to the pot, stir on the alchemy map, fill bottles with a squeeze dropper → scene 2: customer knocks, you open the door, set the price, customer pays by Visa credit or debit on your counter terminal, revenue quiz, merchant offers 3 bottles (pays by bank transfer) → scene 3: market again, compare cheap loose pieces (15/bottle, variable quality) vs premium crate (20/bottle, 95%), maybe a wilted leaf, brew 3 oils (frankincense must be melted, not burnt), hand over, pay bills + credit card from the bank app, net-profit quiz, report + bank statement.
  - 18 terms unlock as green cards right after a character says the word.
- **Deadline:** Thursday 26 Nov 2026. Must run from the GitHub Pages URL and in a VR headset browser (user has a Quest-type headset); desktop + phone too.
- The user is very hands-on and tests every build on the headset; they write casual English + Palestinian Arabic. Keep replies plain, list what changed, always push + verify live.

## 2. Where everything is

| Thing | Where |
|---|---|
| Live game | https://mohammad2237.github.io/capital-alchemist/ (corner card / desktop hint shows «إصدار rNN») |
| Repo | https://github.com/Mohammad2237/capital-alchemist (`main`, Pages serves `/docs`; main is branch-protected: no force-push/delete) |
| Old Unity version | branch `unity-version` (archived) |
| Local project | `C:\Users\moham\Desktop\VR project` |
| KayKit source packs (CC0) | `C:\Users\moham\Downloads\capital-assets` |
| Master spec | `C:\Users\moham\Downloads\CAPITAL_Alchemists_Legacy_Master_Prompt_V3.md` |
| Voice tool (Python 3.12 venv + Sofelia model) | `C:\Users\moham\AppData\Local\Temp\claude\90e7b197a6ef3cf5\d7d3c9e8-7602-4de2-b482-4af45783075c\scratchpad\sofelia` (venv312 + model; may be wiped — setup steps are in `Tools/voices/make_voices_sofelia.py`) |
| Blender MCP launcher | `Tools/blender/blender_mcp_start.py` — run `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --factory-startup --python Tools/blender/blender_mcp_start.py` (never call read_factory_settings inside it) |

Last commit on `main`: `c5d53b1` (r12), live and verified.

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

## 5. Controls (current)

| Desktop | Phone | VR |
|---|---|---|
| Click the view once = mouse-look (pointer lock) + crosshair; WASD walk; Esc frees the mouse | Left joystick, drag to look | Left stick walk; right stick snap-turn / push forward = teleport arc (can't cross a shut door) |
| E or left-click: grab/drop, door, ask a character, pay at a terminal | Tap | Grip: grab (trigger = far grab); grip the door handle to swing it |
| Hold F / left mouse with the dropper: squeeze | «اضغط مطولًا للعصر» | Trigger while holding the dropper: squeeze |
| Tab: encyclopedia | button | X: encyclopedia, left Y: put the bank card away, right B: reset eye height |

No teleport/enter/station buttons (user asked): walk in, open the door, walk through the portal. Scene 2 starts when you open the door after the knock.

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
- **Cache trap:** the local server lets the browser cache modules, so after editing, a reload may still run OLD code. Load from another origin (`http://127.0.0.1:8090` vs `http://localhost:8090`, or another port) and check `typeof window.__capital.<newFunction>` before trusting a test. Every release bump the build label in `js/main.js` («إصدار rNN»), `VOICE_VERSION` in `js/audio.js` and `main.js?v=rNN` in `index.html`.
- **Last verified (r12):** all 6 branches pass locally on fresh code; branch 2 passes on the live site.

## 7. Git and GitHub

- Git Credential Manager is logged in as **Mohammad2237**. Push with:
  ```powershell
  git -c credential.username=Mohammad2237 push
  ```
- The commit identity is "Capital Team" (capital-team@users.noreply.github.com).
- **Never type passwords, and never print the token.** Keep the user's email out of commits and files.
- After pushing, wait for GitHub Pages to rebuild (about 1 minute), then re-check the live URL (grep the build label in `js/main.js`).
- If Pages doesn't update: check `GET /repos/Mohammad2237/capital-alchemist/actions/runs` and the job log (token via `git credential fill`, never printed). On 25 Nov GitHub had an outage; the fix was `POST .../actions/runs/{id}/rerun-failed-jobs` or `POST .../pages/builds` once githubstatus.com said mitigated.
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

## 8c. Second headset round (24 Nov evening)
- Dialogue rewritten (no fillers like همم/أوه); every decision prompt is a voiced line (`ask(id, ...)` in game.js) so the voice = the text. 63 voices.
- Choices wait until the line is spoken (`ui.setHold`); in VR the line floats in a speech bubble over the speaker (`ui.setBubble`).
- Scene 1 now starts at a village market stall outside (`setupMarket`, `MARKET` table in game.js, `L.stall/marketItem/basket/vendorSpot` in layout.js): 4 correct + 4 decoy ingredients, drop into the basket to buy; decoys are refused with a voiced reason and cost nothing (finance unchanged).
- Door is player-owned: grip the handle in VR, E/trigger toggles; a shut door blocks walking and teleport (`fx.doorRot/doorGoal`).
- Bottling uses a squeeze dropper (`usePipette`): dip + squeeze fills it, squeeze over the bottle fills the bottle.
- Alchemy map floats above the cauldron in VR (`setupWorldMap`); stir speed sets precision (`BrewMap.stir(turns, dir, speed)`), Firas explains it (S1_MAP, S1_FAST).
- Point at any character + trigger/E: question menu (`QUESTIONS`) with extra money ideas (هامش الربح، الميزانية، العرض والطلب، خصم الكمية...).
- VR effects lighter (`fx.low`).

## 8d. Third headset round (24 Nov night)
- Market moved to its own square far away (Unity z ≈ -50..-64), reached through two stone-arch portals (`travel()`, `L.portalShop/portalMarket`). Stations are region-aware: if the next station is on the other side, the station becomes `portal`/`portalBack`.
- Two sellers: التاجر المتجول (Barbarian, herbs/liquids, cheap offer) and تاجرة البلّور (Rogue, crystals/glass, premium offer; voice ar-JO-SanaNeural). Scene 1 goods split 4+4 (`MARKET[].stall`); each stall has a basket.
- Scene 3 is a new potion (جرعة الشفاء: ورقة فضية، جمرة الشمس، ندى الفجر) via `RECIPES[1]` (tints, map zone, colours). Supplier choice = put that seller's crate in their basket (or ask them). Finance untouched.
- Term cards (`ui.card3`): green for new terms and right answers, soft red for wrong answers, always with the why.
- Scene timeline pills (DOM `#timeline` + VR panel), chapter cards say «المشهد ١ من ٣».
- Characters reset per scene (`NPC.reset` with a generation token; Firas `resetTo`); merchant arrives for the offer in scene 2 and again at hand-off in scene 3.
- Firas picks a collider-free spot in front of you when he talks (`frontSpot` in npc.js).
- Walking never sticks: you can always walk out of something you are inside; VR collision uses the head position.
- Steam is soft sprites now (the purple 'bubble' was the old sphere steam).

## 8e. Fourth headset round
- VR HUD: small corner task card locked to the top-right of the view (`ui.corner`, `drawCorner`): scene, coins, task, one status line. The centre panel only appears for choices/modals.
- Term cards wait until a character says the word (`TERM_WORDS`, `onLine`), fallback when talking stops.
- No teleport buttons: no «ادخل», «افتح الباب», «ادخل البوابة», «انتقل إلى المحطة» (Q removed). Walk in, open the door, walk through the portal. Scene 2 starts when you open the door after the knock (`readyShut`).

## 8f. Palestinian voices
- All lines now use Sofelia-TTS-82M (Palestinian, one female voice); male characters are re-voiced with WORLD (pyworld): pitch and formant ratios per speaker in the generator. Files: `docs/assets/voice/*.ogg` (MP3 kept as fallback).
- Generator: `Tools/voices/make_voices_sofelia.py <model dir> [--all]`, needs a Python 3.12 venv (kokoro 0.9 doesn't support 3.13). Setup steps are in the script header.
- New/changed lines: edit DIALOGUE.csv, delete that line's .ogg, rerun (only missing files are generated).

## 8g. Scene-3 shopping + heat stages (r8)
- Scene 3: the trader sells loose pieces (`LOOSE` in game.js: 4 leaves 7, 4 embers 5, 4 dews 3, each with its own quality %); pick 3 of each into his basket (9 pieces = 45 = `purchaseBatch(Cheap)`). The glass seller sells one premium crate (60, quality 95%). `batchGood` feeds potion quality.
- VR point-at tag shows name • price • quality (`ui.setTag`).
- Ember heat stages (`Game.HEAT`): cold, warming, ready ✓, too hot, burnt ✗; cools slowly off the coals; quality uses the stage it went in at.
- Term cards: 6–9 s, stay where they appeared (no follow).
- Version label «إصدار r8» in the desktop key hint and the VR corner card, to confirm the browser loaded the latest build.

## 8h. Banking edition (25 Nov)
- Theme: herbal remedy shop (خلطة النشاط العشبية in scene 1, زيت الشفاء العشبي in scene 3). Title kept.
- `Bank` class in game.js: every finance posting is recorded as a transaction (label, method, amount, balance). Methods: بطاقة خصم، فيزا • بطاقة ائتمان الزبون، تحويل بنكي، بطاقة ائتمان، تطبيق البنك. Finance engine untouched, so the six outcomes are exact; `bank.balance` = cash + credit owed.
- `POS` terminals at both stalls and the counter; `setPay(i, amount, label, onPaid)` + `tapPay(pos)` (VR: hand near terminal or trigger; desktop: E/click). Scene 1 buys per stall basket; scene 3 loose cart (9 pieces) or premium crate with debit/credit choice (`chooseMethod`). Credit is repaid with the evening bills (`bank.payCredit`).
- Bank-app tablet on the counter (`drawTablet`), VR debit card in the left hand, report has a «كشف الحساب» page.
- 18 terms (TERMS / TERM_CARDS / TERM_WORDS), unlock indices changed — see `unlock(` calls.
- Desktop: pointer-lock mouse look + crosshair, no automatic camera jumps; non-skippable opening flyover (`this.cine`).
- Copyright: LICENSE (proprietary), headers in every js file, notice on the loading screen; GitHub main branch protected (no force-push/deletion, admins included).

## 8i. r11 (25 Nov evening)
- Blender MCP: launched Blender with `scratchpad/blender_mcp_start.py` (enables the add-on and starts its server on 9876; don't call read_factory_settings — it unloads the add-on). Built `docs/assets/custom/pos_terminal.glb` (handheld terminal + dock, mesh "Screen" for the live display) and `bank_card.glb` (mesh "Face" painted per card). Canvas textures on glTF meshes need `flipY = false`.
- Every payment: tap the terminal → choose debit/credit → card appears in the VR hand (desktop: card flies to the terminal) → tap. Left Y puts the card away. Terminal screen shows amount, method, balance before/after, card debt. Customer randomly pays by debit or credit.
- Real herbal medicine names: scene 1 شاي الأعشاب المنشّط (كركديه، نعناع، ماء معدني)، decoys بابونج، خزامى، عسل، ملح خشن؛ scene 3 زيت الميرمية العلاجي (ميرمية، راتنج لبان يذوب على الموقد، زيت زيتون). Scene 3 compares 15/bottle (variable quality) vs 20/bottle (95%); quality card shows market value by quality while the merchant's contract price stays fixed (six outcomes unchanged).
- Market: village mountain/hills/windmill/clouds hidden while in the market; instanced trees, hills and bushes around it.
- Fixes: VR fader stays on the head (was the black square at the door); merchant waits for the customer to leave; door-frame lintel flicker; steam smaller and fades near your head; bank screen 0.86 m.

## 8j. r12 (25 Nov night)
- One tap = one bank transaction (`bank.group(label, method, fn)` around `onPaid`).
- Card payment animation: card grows into the hand with sparkle + shimmer, holographic shine while held; tap = 3 beeps + approved chime (audio buffers beep/approved/shimmer), contactless pad flash, green ring, haptics; card dissolves after (`hideCard(true)`); desktop card flies to the terminal (`cardFly`). `payFx(pos)` also runs when the customer pays.
- Pot liquid: soft emissive (0.22×colour), glossy swirl texture turning with stirring, small coloured translucent bubbles (was a flat full-bright disc that looked like a lid/bubble).
- Door frame flicker: posts/jambs/lintel/over no longer share faces (shop.js, after entrance_wall loads); camera near 0.08, far 300.
- Term cards only between lines (after the line that said the word); dialogue pauses while a card is up; quiz feedback is the card only; the alchemy map hides under a card. In `?fast` mode cards last 30 ms.

## 9. Next steps

1. The user tests each build on the headset and sends a new list: fix it, run all 6 smoke branches on fresh code, push, verify the live build label.
2. Keep the six final-cash outcomes exact (156/124/146/155/130/145) and `bank.balance === state.cash` at the end.
3. Optional leftovers: `Tools/blender/build_custom_models.py` still writes to `web/assets/custom` (should be `docs/assets/custom`); `TEST_REPORT.md`, `KNOWN_LIMITATIONS.md`, `ASSET_LICENSES.md` are from the Unity era; smoother voices would need a Gemini/ElevenLabs key the user creates.

## 10. History, in short

- The game was first built in Unity 6 with the WebXR export.
- A different agent ("codex") later replaced `docs/` with a standalone page and left broken local edits.
  - Its page was undone with a merge.
  - Its local edits are backed up in the old session's scratchpad (`other-agent/local-changes.diff`).
- The Unity VR button never worked because the WebXR settings and loader assets were never created. That was fixed, but the user then asked to drop Unity entirely.
- The whole game was rewritten in three.js and WebXR. This is the current `main`.
- Full transcript of the old chat:
  `C:\Users\moham\.claude\projects\C--Users-moham-Desktop-VR-project\d7d3c9e8-7602-4de2-b482-4af45783075c.jsonl`
