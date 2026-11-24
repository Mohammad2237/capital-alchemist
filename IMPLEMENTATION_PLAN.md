# CAPITAL — implementation plan

## Confirmed environment (23 November 2026)
- Workspace: `C:\Users\Admin\Documents\Unity Projects\MCP Sandbox`; fresh project, no existing game assets.
- Running licensed Unity 6000.6.10f1 (release API reports SUPPORTED; LTS designation not confirmed).
- Windows standalone player module installed. Android module/SDK/NDK absent; no ADB on PATH, OpenXR runtime registration or connected Quest/Vive/Pico discovered.
- Git, .NET, Python/uv and Internet available. No team voice recordings supplied.
- Editor-shipped packages: URP 17.6.0, uGUI/TMP 2.6.0, Input System 1.20.1, XRI 3.6.1, OpenXR 1.18.0, XR Management 4.7.0, Test Framework 1.8.0.
- No official competition name/rubric URL supplied. Claimed weights remain unverified.

## Shortest runnable path
1. Import Arabic font + RTLTMPro; create editor-only RTL fixture and glyph checks.
2. Pure transaction model and six-row/idempotency tests before scene art.
3. Deterministic shop prefab + exactly three scenes; persistent state; desktop physical interactions.
4. Branches, glossary, ledger, dialogue, quiz, Firas, authored stylized characters.
5. XR rig / direct grabs / sockets / world-space menus; PC build, automated runtime route, screenshots.
6. Record actual validation, controls, licenses, voice drop-in workflow and remaining risks.

## Real blockers / release gates
- Real headset / Android build and measured comfort cannot be verified without hardware and Android module.
- LTS editor policy still requires verification/migration; keep current executable editor as immediate development target.
- Lahajati recordings and official rubric must come from team.
- Arabic requires visual inspection in addition to automated glyph coverage.
- Presentation duration and controller ergonomics require human rehearsal.

Protect the first complete mortar → cauldron → bottle sequence. No fourth shipped scene.
Feature freeze target: night of 25 November; 26 November: fixes/rehearsal/backups.

## Status update — 23 November 2026, evening (project moved to `C:\Users\moham\Desktop\VR project`)
Done on the original PC: steps 1–4 and the EditMode suite (110/110 passed). The Windows build was started
but never finished (empty `Evidence/windows-build.log`, empty `Builds/Windows/`), so no player and no
smoke run exist yet.

Current PC status (updated 24 November 2026, morning):
- Unity 6000.6.10f1 is installed at `C:\Users\moham\Unity\Editors\6000.6.10f1` and the account is signed in.
- Licence active (2026-11-24). Unity tests, Windows build and the six-branch smoke route all PASS here.
- Tier 2 polish started: SFX, cauldron bubbles/sparkle, coins, door swing, branch liquid colour, post-processing.
- All code compiles (0 errors) and 21/21 runnable domain tests pass outside Unity (see `TEST_REPORT.md`).

Next steps (in order):
1. Manual desktop playthrough of `DEMO_SCRIPT.md`; record results in `TEST_REPORT.md`.
2. Remaining Tier 2 (Wednesday): Lahajati voices drop-in, sound, lighting polish, headset test if hardware exists.
