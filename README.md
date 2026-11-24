# رأس المال: إرث الكيميائي — CAPITAL: The Alchemist's Legacy

**Play in the browser (desktop, phone, or a VR headset's browser):** https://mohammad2237.github.io/capital-alchemist/
In a headset (e.g. Meta Quest Browser) press **«ادخل الواقع الافتراضي»**.

A short Arabic VR financial-literacy game: you inherit a potion shop, buy ingredients from a wandering trader,
crush, mix, stir and bottle a potion in a big central cauldron, sell it, take a bulk order, face a supplier
risk, pay the shop's bills — and learn the difference between **revenue, gross profit, net profit and cash**
by doing it. Six financial outcomes, all exact to the competition spec.

## Engine

Pure web: **three.js r170 + WebXR**, no game engine install, no build step. Everything is static files in
[`docs/`](docs/) (served by GitHub Pages).

| Path | What |
|---|---|
| `docs/index.html`, `docs/style.css` | Page, Arabic HUD, loading screen, VR button |
| `docs/js/main.js` | Renderer, sky, sun, frame loop |
| `docs/js/game.js` | Story phases, brewing, NPC trading, alchemy map, station camera, desktop/touch/VR controls |
| `docs/js/finance.js` | Transaction ledger (idempotent postings) — the six-outcome model |
| `docs/js/shop.js`, `layout.js`, `assets.js` | The shop + village lane, floor plan, model placement |
| `docs/js/npc.js`, `fx.js`, `audio.js`, `ui.js` | Characters (Firas, trader, customer, merchant), effects, procedural sound, HUD + VR panel |
| `docs/js/smoke.js` | Automated playthrough of one branch: open `index.html?fast&smoke=N` (N = 0–5) |
| `docs/tests/finance.test.mjs` | Finance tests: `node docs/tests/finance.test.mjs` |
| `docs/assets/` | KayKit CC0 models (glTF), project models (GLB), `DIALOGUE.csv` |
| `Tools/blender/build_custom_models.py` | Rebuilds the cauldron, ingredients, door, counter… (Blender 5.2, headless) |

Run locally: `python -m http.server 8090 --directory docs` then open http://localhost:8090 (VR needs the https link).

The earlier Unity version is preserved on the `unity-version` branch.

## Controls

| Desktop | Phone | VR headset |
|---|---|---|
| WASD walk (Shift run), right-mouse look | Left thumb joystick, drag to look | Left stick walk, right stick snap-turn / push forward to aim a teleport arc |
| E or left-click: grab / drop / open door | Tap item to grab, tap a spot to drop | Grip: grab; move your hand to stir and crush. Trigger at a far item: it flies to your hand; release while pointing at the cauldron/mortar/bottle ring/counter tray and it flies there |
| F (hold): pour | «اضغط مطولًا للصب» button | Right trigger: pour; trigger on buttons and the door |
| Q / «انتقل إلى المحطة»: station view | same button | same button: blink-teleport to the floor ring |
| Tab: encyclopedia, R: restart | «الموسوعة» button | X: encyclopedia, B: reset eye height (auto when the floor is missing) |

Each step has a framed point of view on desktop (above the cauldron while stirring, over the mortar, at the
bottling stand, facing the customer). In VR the camera is never moved for you; a glowing floor ring shows where
to stand.

## Financial model (unchanged)

Start 100 coins. First potion costs 25 (herb 10, crystal 8, water 5, bottle 2). Price 30 (merchant later pays 37)
or 50 (merchant pays 30). Batch of 3: cheap 45 (wilted herb: replace +5, or use it and lose one potion = 15 spoilage)
or premium 60. Operating expenses 10. Final cash: 156 / 124 / 146 / 155 / 130 / 145. Taxes and financing are
excluded and labelled as such in the report.

## Credits

Voices: Levantine-dialect neural voices generated with `Tools/voices/make_voices.py` (edge-tts) from `DIALOGUE.csv`. Models: KayKit by Kay Lousberg (CC0). Engine: three.js (MIT). Font: Amiri (SIL OFL). Project-made models,
sounds (synthesised) and code: the CAPITAL team. See `ASSET_LICENSES.md`.
