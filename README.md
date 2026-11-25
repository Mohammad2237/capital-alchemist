# رأس المال: إرث الكيميائي — CAPITAL: The Alchemist's Legacy

**Play in the browser (desktop, phone, or a VR headset's browser):** https://mohammad2237.github.io/capital-alchemist/
In a headset (e.g. Meta Quest Browser) press **«ادخل الواقع الافتراضي»**.

**Why this game exists:** schools and universities rarely teach young people how money really works — how to manage
it, what a bank account, a debit card or a credit card actually does, how digital payments move money, or the
difference between revenue, profit and the balance in your account. CAPITAL teaches it by living it.

You inherit a **herbal remedy shop** (محل أعشاب طبية). Your 100 coins of capital sit in a **bank account**, and you
carry a **debit card**. You step through a portal to the market, pick the ingredients a customer ordered, and **tap
your card on the seller's terminal**. You prepare an energy herbal blend (grind to the right texture, steer the mix on
the alchemy map, fill bottles with a dropper). Your first customer pays with a **Visa credit card** on your counter
terminal. A merchant orders three healing oils and pays by **bank transfer**. You choose a supplier — loose pieces you
inspect one by one, or a premium crate you can pay by **debit or credit card** (repaid the same evening, so no
**interest**). You pay the shop's bills from the **bank app**, then read your **bank statement**. Every coin is a
real transaction with a method, an amount and a running balance.

18 terms (capital, bank account, debit card, digital payment, raw materials, production cost, selling price, credit
card, revenue, cost of goods sold, gross profit, bank transfer, risk, interest, operating expenses, net profit, bank
statement, money management) unlock the moment a character says them. Six financial outcomes, exact to the spec.

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
| F or left mouse (hold) while holding the dropper: squeeze | «اضغط مطولًا للعصر» button | Trigger while holding the dropper: squeeze (dip in the cauldron, then over the bottle) |
| E on the door: open/close; E on a character: ask questions | Tap | Grip the door handle and swing it; trigger at a character: ask questions |
| Tab: encyclopedia, R: restart | «الموسوعة» button | X: encyclopedia, B: reset eye height (auto when the floor is missing) |

Each step has a framed point of view on desktop (above the cauldron while stirring, over the mortar, at the
bottling stand, facing the customer). In VR the camera is never moved for you; a glowing floor ring shows where
to stand.

## Financial model (unchanged)

Start 100 coins. First potion costs 25 (herb 10, crystal 8, water 5, bottle 2). Price 30 (merchant later pays 37)
or 50 (merchant pays 30). Batch of 3: cheap 45 (wilted herb: replace +5, or use it and lose one potion = 15 spoilage)
or premium 60. Operating expenses 10. Final cash: 156 / 124 / 146 / 155 / 130 / 145. Taxes and financing are
excluded and labelled as such in the report.

## Copyright

© 2026 CAPITAL Team. **All rights reserved.** This is proprietary software, not open source — see [`LICENSE`](LICENSE).
You may not copy, re-host, modify, redistribute or submit any part of it as your own work without written permission.
Third-party parts (three.js MIT, KayKit CC0, Amiri OFL, Sofelia-TTS Apache-2.0) keep their own licences.

## Credits

Voices: Palestinian Arabic, generated offline with Sofelia-TTS-82M (Apache-2.0, a Kokoro-82M fine-tune) via `Tools/voices/make_voices_sofelia.py`; men use the same voice re-voiced with the WORLD vocoder (lower pitch and deeper vocal tract). Older MP3 voices (edge-tts, `make_voices.py`) remain as a fallback for browsers without Ogg. Models: KayKit by Kay Lousberg (CC0). Engine: three.js (MIT). Font: Amiri (SIL OFL). Project-made models,
sounds (synthesised) and code: the CAPITAL team. See `ASSET_LICENSES.md`.
