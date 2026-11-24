# رأس المال: إرث الكيميائي — CAPITAL: The Alchemist's Legacy

A three-scene, first-person medieval alchemy shop where the player crafts a potion by hand, sells it,
then faces a supplier decision whose consequences land in a real ledger.

All player-facing text is Arabic (RTL, Western digits). Code and documentation are English.

## Editor and packages (verified on this machine)

| Item | Version | Status |
|---|---|---|
| Unity editor used for development | 6000.6.10f1 | Installed, licensed, builds Windows |
| Unity LTS (official release API) | 6000.3.29f1 | Installed for the LTS target |
| Render pipeline | URP 17.6.0 | Editor-shipped, configured by builder |
| UI / text | uGUI + TextMeshPro 2.6.0 | TMP Essentials imported |
| Input | Input System 1.20.1 | Active input handler = Both |
| XR | XRI 3.6.1, OpenXR 1.18.0, XR Management 4.7.0 | Configured for Standalone; **not tested on a headset** |
| Tests | Test Framework 1.8.0 | EditMode financial suite |
| Arabic | RTLTMPro (MIT) + Amiri (OFL 1.1) | Shaping, RTL flow, glyph coverage checked |

Android build support, an OpenXR runtime registration and a connected headset were **not** present on this
machine, so an APK/Quest build was not produced. See `KNOWN_LIMITATIONS.md`.

## Open the project

1. Open the folder in Unity Hub (add project from disk) with **6000.3.29f1** (or 6000.6.10f1).
2. Menu **Capital → 1 - Build project and RTL fixture**. This creates the URP asset, OpenXR settings, the
   Arabic font asset with a shaped-glyph corpus, the shared shop prefab, and the three scenes, then sets
   build settings and player settings.
3. Menu **Capital → 2 - Open temporary RTL fixture** to inspect Arabic shaping and mixed numerals. This
   fixture is unsaved and is never added to the build.
4. Open `Assets/Capital/Scenes/01_Inheritance.unity` and press Play.

The scenes are generated deterministically by the builder; nothing depends on undocumented manual wiring.

## Desktop controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` / arrows (`Shift` = faster) | Walk around the shop and the street outside (walls and furniture collide) |
| Right mouse drag | Look around (no forced camera motion) |
| Mouse move while holding an object | The object follows the cursor onto tables, the cauldron, the counter |
| `E` | Grab / release the object under the cursor; open the shop door at the start |
| Left mouse drag with pestle held (at the mortar) | Crush strokes |
| Paddle held, cursor circling inside the big cauldron | Stir |
| `F` (hold) | Pour into the snapped bottle |
| Mouse click | Choose a decision, open the encyclopedia |
| `Tab` | Financial encyclopedia (10 terms) |
| `Q` / HUD button «انتقل إلى المحطة» | Glide back into the current station view (above the cauldron while stirring, over the mortar, at the bottling stand, behind the counter) |
| `Home` | Level the view |
| `R` | Restart with confirmation |

Movement assistance buttons (crush stroke / stir turn / pour) appear next to the objective so the physical
action is never a hard block.

**Station views.** Each step has its own framed point of view. On desktop the camera glides there by itself
(looking down into the cauldron while you stir, over the mortar while you crush, at the bottling stand while the
ladle pours) and glides back out when you walk off with WASD. In VR the camera is never moved for you: a
glowing floor ring marks where to stand, and «انتقل إلى المحطة» blinks you there. Firas flies to each station
and guides from beside it; the next item to use pulses gold, and anything you point at glows.

## Gameplay flow (single guided story)

1. **01_Inheritance** — you start on the street outside the shop you inherited. Open the door (`E` on it, or
   the button), walk in, and Firas materialises from his crystal to welcome you and introduce inherited capital. Buy four ingredients (100 → 75 cash, 25 inventory),
   grab the herb into the mortar, crush it with real pestle strokes, add crushed herb + crystal + water to the
   cauldron, stir circularly, snap a bottle and pour. Production cost 25 is revealed in the ledger.
2. **02_FirstCustomer** — the market board shows ~40 coins. Choose 30 (fair, reputation +1, merchant later pays
   37) or 50 (higher immediate gross profit, merchant later pays 30). Physically hand the potion over, then a
   micro-check distinguishes revenue from profit.
3. **03_BigOrder** — choose the cheap 45-coin batch or the premium 60-coin batch. Cheap reveals a wilted herb:
   replace it for +5 (all accepted) or use it (third potion is rejected and 15 is posted as spoilage, never as
   COGS or revenue). Batch crafting is one preparation plus three short bottle fills. Pay the 10-coin operating
   expense once, answer the branch-aware net-profit check, then read the final store report.

## Financial model

`FinancialManager` is the only writer of transactions; every posting has a stable id, so repeated triggers are
no-ops. Buying ingredients moves cash into inventory (no expense). A sale posts revenue and moves the lot's cost
to COGS. A rejected potion posts spoilage separately. Operating expenses post once.

```
GrossProfit = Revenue - COGS
NetProfit   = GrossProfit - SpoilageLoss - OperatingExpenses
FinalCash   = StartingCash + Revenue - IngredientPurchases - OperatingExpenses
Cash + InventoryValue == StartingCapital + NetProfit   (asserted after every posting)
```

Six accepted outcomes (all covered by EditMode tests):

| First sale | Supplier | Revenue | COGS | Gross | Spoilage | Opex | Net | Cash | Rep |
|---|---|---|---|---|---|---|---|---|---|
| 30 | Cheap, replace | 141 | 75 | 66 | 0 | 10 | 56 | 156 | +1 |
| 30 | Cheap, wilted | 104 | 55 | 49 | 15 | 10 | 24 | 124 | 0 |
| 30 | Premium | 141 | 85 | 56 | 0 | 10 | 46 | 146 | +2 |
| 50 | Cheap, replace | 140 | 75 | 65 | 0 | 10 | 55 | 155 | 0 |
| 50 | Cheap, wilted | 110 | 55 | 55 | 15 | 10 | 30 | 130 | -1 |
| 50 | Premium | 140 | 85 | 55 | 0 | 10 | 45 | 145 | +1 |

Reputation stars are a non-financial mapping `clamp(2 + score, 1, 4)` and are labelled as such.

## Tests and builds

- **Capital → run EditMode tests** (or `Tools/run-editmode-tests.ps1`) — six outcomes, idempotency, guards,
  wrong-ingredient rejection, reconciliation.
- **Capital → 3 - Build Windows** (or `Tools/build-windows.ps1`) — `Builds/Windows/Capital.exe`.
- **Automated desktop route** (or `Tools/run-smoke.ps1`) — `Capital.exe --smoke --evidence <dir>` plays all six
  branches through the real scene controllers, writes JSON ledgers, screenshots and a PASS/FAIL log, then exits.
  All three scripts take `-Editor` / `-Player` overrides; by default they find the installed 6000.6.10f1 editor
  (`Tools/_find-editor.ps1`) and the built player.
- **No licence yet?** `bash Tools/dev/compile-check.sh` compiles every project assembly with Unity's own compiler.
- **VR** — `Capital.exe --vr` initialises OpenXR and builds a room-scale rig: left stick = smooth walk
  (1.5 m/s, collides with the shop), right stick left/right = 30° snap turn, right stick forward = aim a teleport
  arc and release to jump, grip = grab, trigger = UI / pour, left primary button = encyclopedia. The parchment HUD
  floats 1.6 m ahead and re-centres when you turn away. This path is code-complete but **NOT TESTED** on hardware.
- **Full rebuild** — `Tools/full-rebuild.ps1` regenerates the three scenes from code (`CapitalBuilder.BuildProject`,
  `ShopDressing.cs`), then runs tests, the build and the smoke route.
- **Custom models** — `Tools/blender/build_custom_models.py` (Blender 5.2, headless) rebuilds the cauldron, door,
  counter and other project-made models into `Assets/Capital/Models/Custom` and `Assets/Capital/Resources/Models`.
- **Blender MCP** — installed for live Blender editing in a future session: the Blender add-on is enabled and
  `.mcp.json` registers `uvx blender-mcp`. Open Blender, press *Connect to Claude* in the BlenderMCP sidebar tab,
  then start a new Claude Code session in this folder.

## Voice import

`DIALOGUE.csv` (project root and `Assets/Resources/DIALOGUE.csv`) holds every line id, speaker, scene, trigger,
Arabic text, target filename, fallback duration and style. Drop recorded files into
`Assets/StreamingAssets/Voices/<audio_filename>` or `Assets/Resources/Voices/<name>.wav`; no code change is
needed. Missing audio plays the subtitle for the estimated duration. Lines never overlap; subtitles are always
shown. Dynamic totals are never voiced — only the ledger shows them.

## Documentation set

`IMPLEMENTATION_PLAN.md`, `DIALOGUE.csv`, `ASSET_LICENSES.md`, `PROMPT_LOG.md`, `TEST_REPORT.md`,
`KNOWN_LIMITATIONS.md`, `DEMO_SCRIPT.md`.
