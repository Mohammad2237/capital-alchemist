# Known limitations — read before judging

This list is deliberately blunt. Everything here is either untested, simplified, or missing.
`TEST_REPORT.md` holds the measured results; this file explains what those results do *not* cover.

## 1. VR / OpenXR is implemented but NOT TESTED

- No VR headset, no OpenXR runtime (SteamVR/Oculus/Mixed Reality) and no Android build module exist
  on the development machine. `--vr` was therefore never executed on hardware.
- The VR path (room-scale rig, smooth walk, teleport arc, snap turn, direct + ray interactors, floating
  world-space HUD) is code-reviewed only. Treat it as **unverified**.
- Android/Quest build: not produced. No SDK/NDK, no ADB, no device.
- Station "points of view" are a desktop camera feature. In VR the camera is never moved for you (comfort);
  the player walks or teleports (floor ring + «انتقل إلى المحطة» blink) and leans over the cauldron themselves.
- Comfort: teleport (with a short fade), snap turn and a moderate smooth-walk speed exist; there is no comfort vignette and no
  seated-mode height offset. Smooth walking may not suit every player; teleport is the comfortable option.
- No measured FPS, frame time, draw calls, memory or thermal data on any XR device.
- The desktop route is the only route that has actually been played end to end.

## 2. Audio and voice

- No Lahajati voice recordings were supplied. All dialogue is **timed subtitles with silence**
  (the `audio` column in `DIALOGUE.csv` names files that do not exist yet).
- All sound effects (hearth, grinding, splash, bubbling, glass, coins, door, crystal, reject) are original
  procedural synths in `AudioManager.cs`, not recorded foley. They can be replaced by dropping files into
  `Assets/Resources/Sfx/` with the same names, no code changes.
- Ambience ducks under dialogue and the cauldron bubbling is spatial; there is no mixing or loudness pass.

## 3. Art and presentation

- Art is stylised low-poly: KayKit CC0 packs plus project models built in Blender. Characters (Firas, customer,
  merchant) are rigged KayKit adventurers with idle/walk/interact/cheer/spellcast animations. There is no
  lip-sync or facial animation, and the customer and merchant are re-used fantasy adventurer models, not
  bespoke medieval traders.
- No baked lighting, no lightmaps, no reflection probes. Lighting is real-time; a light URP post-processing
  profile (warm grade, soft bloom, vignette) is applied to all scenes by `Capital → 4 - Apply lighting polish`.
  Its cost on a standalone headset is unmeasured.
- Materials are untextured flat-colour URP Lit; there are no normal maps or decals.
- The UI is functional and readable, but not a designed interface: no icon set, no transitions beyond
  fades, one font (Amiri).

## 4. Arabic and text

- Arabic shaping/RTL is handled by RTLTMPro with `Farsi=false`, `PreserveNumbers=true`. Western digits
  are intentional; there is no Arabic-Indic numeral option.
- Font coverage was validated against the glyph corpus generated from the dialogue and UI strings
  (`Evidence/arabic-glyph-coverage.txt`). Text added later that is outside that corpus may fall back.
- No diacritics (tashkeel) are used; no line-breaking tuning for very narrow mobile widths.
- No Arabic voice-over, no transliteration aid, no second language.

## 5. Simulation scope (deliberate simplification)

- One product, one recipe, one shop, three scenes. No menus, no save slots, no progression beyond the
  ten glossary terms.
- The economy is a teaching model: no taxes, no financing costs, no depreciation, no credit, no
  shrinkage beyond the single scripted spoilage event. This is stated in-game in the report footnote.
- Demand, reputation and supplier behaviour are scripted branches, not a simulation. Prices are fixed
  choices (first sale 30 or 50; supplier 45 cheap or 60 premium; herb replace +5), not free input.
- The quiz has a fixed question per branch; it is branch-aware but not adaptive.
- The customer's recommendation and the merchant's bulk order are authored triggers, not emergent.

## 6. Finance model boundaries

- `FinancialManager` is authoritative only inside this game. It is a single-user, in-memory ledger with
  an audit snapshot; it is not double-entry bookkeeping and has no period close.
- Rounding: all values are integer coins by design; there are no fractional costs, so no rounding policy
  is exercised.
- Spoilage is recorded as its own line, not folded into COGS. If a judge expects spoilage inside COGS,
  the report will look different — the split is deliberate and documented in the report footnote.
- The 10-coin operating expense is posted once per run by an idempotent trigger; it is not recurring,
  and there is no rent/payroll model.

## 7. Testing coverage

- Automated coverage is the six financial outcome rows, idempotency, sequence guards, wrong-ingredient
  handling and reset cleanliness (EditMode), plus one scripted desktop playthrough per branch (PlayMode
  style smoke run inside a built player).
- Not covered automatically: pointer precision, actual frame pacing, audio timing, UI at other
  resolutions/aspect ratios, save-file corruption, long-session memory, alt-tab/focus loss, gamepad.
- No human playtest with the target age group has been run. Difficulty, reading speed and hint clarity
  are unvalidated.
- No localisation QA, no accessibility pass (colour-blind palettes, subtitles sizing, remapping).

## 8. Build and distribution

- Only a Windows desktop build is produced. No macOS/Linux/WebGL/Android.
- The build is unsigned; Windows SmartScreen may warn.
- No installer, no auto-update, no crash reporting, no analytics.
- The final build was produced by the editor recorded in `TEST_REPORT.md`; the other installed editor
  was checked for compilation only.

## 9. Process limitations

- The competition rubric, weighting and rulebook were not supplied to this workspace. No claim is made
  about scoring, and no requirement beyond the written brief was inferred.
- The AI assistance record (`PROMPT_LOG.md`) lists what the agent did; it is not an independent audit.
- Firas is a **scripted hologram** with authored lines and timed subtitles. He is not a live language
  model, does not listen, and has no microphone input. Any expectation of open conversation is out of
  scope by design.
