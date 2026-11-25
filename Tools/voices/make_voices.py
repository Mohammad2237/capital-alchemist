"""Generate the character voice lines (Levantine Arabic neural voices) from docs/assets/DIALOGUE.csv.
Usage: python -m pip install edge-tts && python Tools/voices/make_voices.py [--all]  (default: only lines without an mp3)
Writes docs/assets/voice/<id>.mp3 and rewrites the CSV duration column with the real length."""
import asyncio, csv, io, os, edge_tts

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "assets")
CSV = os.path.join(ROOT, "DIALOGUE.csv")
OUT = os.path.join(ROOT, "voice")
VOICES = {  # speaker -> (voice, rate, pitch)
    # Natural voices, tiny adjustments only (big pitch shifts make neural voices sound processed).
    "فراس": ("ar-JO-TaimNeural", "-3%", "+0Hz"),
    "التاجر المتجول": ("ar-SY-LaithNeural", "-4%", "+0Hz"),
    "الزبون": ("ar-LB-RamiNeural", "-2%", "+0Hz"),
    "التاجر": ("ar-SY-LaithNeural", "-8%", "-8Hz"),
    "تاجرة البلّور": ("ar-LB-LaylaNeural", "-3%", "+0Hz"),
}

async def one(row):
    voice, rate, pitch = VOICES[row["speaker"]]
    com = edge_tts.Communicate(row["arabic_text"], voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    end = 0
    with open(os.path.join(OUT, row["id"] + ".mp3"), "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary": end = max(end, (ch["offset"] + ch["duration"]) / 1e7)
    row["estimated_duration"] = "%.1f" % (end + 0.35)

async def main():
    os.makedirs(OUT, exist_ok=True)
    rows = list(csv.DictReader(io.open(CSV, encoding="utf-8")))
    import sys
    for r in rows:
        if "--all" not in sys.argv and os.path.exists(os.path.join(OUT, r["id"] + ".mp3")): continue  # only new/changed lines
        await one(r); print(r["id"], r["estimated_duration"])
    with io.open(CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys(), lineterminator="\n"); w.writeheader(); w.writerows(rows)

asyncio.run(main())
