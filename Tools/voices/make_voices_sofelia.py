"""Character voices in Palestinian Arabic with Sofelia-TTS-82M (Kokoro fine-tune, Apache-2.0, one female voice "Eliaa").
Male characters use the same voice pitched down (librosa), each a different depth/speed so they sound distinct.

Setup (needs Python 3.10-3.12):
  uv venv --python 3.12 venv312
  uv pip install --python venv312/Scripts/python.exe torch --index-url https://download.pytorch.org/whl/cpu
  uv pip install --python venv312/Scripts/python.exe "kokoro>=0.9,<0.10" misaki espeakng-loader phonemizer-fork soundfile librosa huggingface_hub
  venv312/Scripts/python.exe -c "from huggingface_hub import snapshot_download; snapshot_download('hamdallah/Sofelia-TTS-82M', local_dir='model')"
Run:
  venv312/Scripts/python.exe Tools/voices/make_voices_sofelia.py <model dir> [--all]
Writes docs/assets/voice/<id>.ogg and the real duration back into docs/assets/DIALOGUE.csv."""
import csv, io, os, re, sys
import numpy as np, soundfile as sf, torch, librosa

M = os.path.abspath(sys.argv[1]); sys.path.insert(0, M)
from kokoro import KModel
from misaki import espeak
from sofelia_frontend import text_to_phonemes

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "assets")
CSV, OUT, SR = os.path.join(ROOT, "DIALOGUE.csv"), os.path.join(ROOT, "voice"), 24000
VOICES = {  # speaker -> (semitones, speed)
    "فراس": (-4.0, 1.0),
    "التاجر المتجول": (-6.0, 0.95),
    "الزبون": (-3.0, 1.03),
    "التاجر": (-7.0, 0.9),
    "تاجرة البلّور": (0.0, 1.0),
}
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
    semis, speed = VOICES[r["speaker"]]
    a = synth(r["arabic_text"], speed)
    if semis: a = librosa.effects.pitch_shift(a, sr=SR, n_steps=semis)
    a = a / max(1e-4, np.abs(a).max()) * 0.9
    fade = int(0.01 * SR); a[:fade] *= np.linspace(0, 1, fade); a[-fade:] *= np.linspace(1, 0, fade)
    sf.write(out, a.astype(np.float32), SR, format="OGG", subtype="VORBIS")
    r["audio_filename"] = r["id"] + ".ogg"; r["estimated_duration"] = "%.1f" % (len(a) / SR + 0.35)
    print(r["id"], r["estimated_duration"], flush=True)
with io.open(CSV, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=rows[0].keys(), lineterminator="\n"); w.writeheader(); w.writerows(rows)
