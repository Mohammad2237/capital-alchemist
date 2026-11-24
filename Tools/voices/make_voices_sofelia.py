"""Character voices in Palestinian Arabic with Sofelia-TTS-82M (Kokoro fine-tune, Apache-2.0, one female voice "Eliaa").
Male characters use the same voice re-voiced with the WORLD vocoder (lower pitch + longer vocal tract), so they sound natural, not metallic.

Setup (needs Python 3.10-3.12):
  uv venv --python 3.12 venv312
  uv pip install --python venv312/Scripts/python.exe torch --index-url https://download.pytorch.org/whl/cpu
  uv pip install --python venv312/Scripts/python.exe "kokoro>=0.9,<0.10" misaki espeakng-loader phonemizer-fork soundfile pyworld huggingface_hub
  venv312/Scripts/python.exe -c "from huggingface_hub import snapshot_download; snapshot_download('hamdallah/Sofelia-TTS-82M', local_dir='model')"
Run:
  venv312/Scripts/python.exe Tools/voices/make_voices_sofelia.py <model dir> [--all]
Writes docs/assets/voice/<id>.ogg and the real duration back into docs/assets/DIALOGUE.csv."""
import csv, io, os, re, sys
import numpy as np, soundfile as sf, torch, pyworld as pw

M = os.path.abspath(sys.argv[1]); sys.path.insert(0, M)
from kokoro import KModel
from misaki import espeak
from sofelia_frontend import text_to_phonemes

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "assets")
CSV, OUT, SR = os.path.join(ROOT, "DIALOGUE.csv"), os.path.join(ROOT, "voice"), 24000
VOICES = {  # speaker -> (pitch ratio, formant ratio, speed); 1, 1 = the original female voice
    "فراس": (0.68, 0.87, 1.0),
    "التاجر المتجول": (0.6, 0.83, 0.95),
    "الزبون": (0.75, 0.9, 1.03),
    "التاجر": (0.56, 0.8, 0.9),
    "تاجرة البلّور": (1.0, 1.0, 1.0),
}
def revoice(a, pitch, formant):
    """WORLD analysis/synthesis: scale F0 and warp the spectral envelope (formants) for a deeper, natural voice."""
    x = a.astype(np.float64); f0, tt = pw.harvest(x, SR, frame_period=5.0); sp = pw.cheaptrick(x, f0, tt, SR); ap = pw.d4c(x, f0, tt, SR)
    n = sp.shape[1]; src = np.clip(np.arange(n) / formant, 0, n - 1); lo = np.floor(src).astype(int); hi = np.minimum(lo + 1, n - 1); w = src - lo
    sp2 = sp[:, lo] * (1 - w) + sp[:, hi] * w
    return pw.synthesize(f0 * pitch, np.ascontiguousarray(sp2), ap, SR, 5.0).astype(np.float32)
model = KModel(repo_id="hexgrad/Kokoro-82M", config=os.path.join(M, "config.json"), model=os.path.join(M, "kokoro_sofelia_82M.pth")).eval()
voice = torch.load(os.path.join(M, "voices", "eliaa.pt"), map_location="cpu", weights_only=True)
g2p = espeak.EspeakG2P(language="ar")

def synth(text, speed):
    pieces = []
    for ch in [c.strip() for c in re.split(r"(?<=[.!؟?:])\s+", text) if c.strip()] or [text]:
        ps = text_to_phonemes(ch, g2p)[:510]
        if not ps: continue
        with torch.no_grad(): a = model(ps, voice[len(ps) - 1], speed, return_output=False)
        pieces += [a.numpy().squeeze(), np.zeros(int(0.18 * SR), np.float32)]
    return np.concatenate(pieces[:-1]) if pieces else np.zeros(2400, np.float32)

rows = list(csv.DictReader(io.open(CSV, encoding="utf-8")))
for r in rows:
    out = os.path.join(OUT, r["id"] + ".ogg")
    if "--all" not in sys.argv and os.path.exists(out): continue
    pitch, formant, speed = VOICES[r["speaker"]]
    a = synth(r["arabic_text"], speed)
    if pitch != 1 or formant != 1: a = revoice(a, pitch, formant)
    a = a / max(1e-4, np.abs(a).max()) * 0.9
    fade = int(0.01 * SR); a[:fade] *= np.linspace(0, 1, fade); a[-fade:] *= np.linspace(1, 0, fade)
    sf.write(out, a.astype(np.float32), SR, format="OGG", subtype="VORBIS")
    r["audio_filename"] = r["id"] + ".ogg"; r["estimated_duration"] = "%.1f" % (len(a) / SR + 0.35)
    print(r["id"], r["estimated_duration"], flush=True)
with io.open(CSV, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=rows[0].keys(), lineterminator="\n"); w.writeheader(); w.writerows(rows)
