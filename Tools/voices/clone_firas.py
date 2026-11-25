"""Re-voice Firas's lines in the team's own Firas voice (OpenVoice V2 tone-colour converter, MIT).
The words/accent come from the clean Levantine neural reading (make_voices.py, ar-JO-Taim);
only the voice timbre is converted to match the team's recordings.

Setup (Python 3.12 venv with torch + librosa + soundfile):
  uv pip install --python <venv python> --no-deps git+https://github.com/myshell-ai/OpenVoice.git
  python -c "from huggingface_hub import hf_hub_download as d; [d('myshell-ai/OpenVoiceV2', f, local_dir='openvoice_v2') for f in ['converter/config.json','converter/checkpoint.pth']]"
Run:
  <venv python> Tools/voices/clone_firas.py <openvoice_v2 dir> <folder with the team's Firas recordings> <ids to convert, comma-separated>
Writes docs/assets/voice/<id>.mp3 (the neural reading is kept in Tools/voices/taim_source/<id>.mp3 the first time)."""
import os, sys, shutil, glob
import numpy as np, librosa, soundfile as sf, torch
from openvoice import utils
from openvoice.models import SynthesizerTrn
from openvoice.mel_processing import spectrogram_torch

CK, REF, IDS = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
HERE = os.path.dirname(os.path.abspath(__file__)); VOICE = os.path.join(HERE, "..", "..", "docs", "assets", "voice"); KEEP = os.path.join(HERE, "taim_source"); os.makedirs(KEEP, exist_ok=True)
hps = utils.get_hparams_from_file(os.path.join(CK, "converter", "config.json"))
model = SynthesizerTrn(len(getattr(hps, "symbols", [])), hps.data.filter_length // 2 + 1, n_speakers=hps.data.n_speakers, **hps.model).eval()
model.load_state_dict(torch.load(os.path.join(CK, "converter", "checkpoint.pth"), map_location="cpu")["model"], strict=False)
SR = hps.data.sampling_rate

def spec(a):
    y = torch.FloatTensor(a).unsqueeze(0)
    return spectrogram_torch(y, hps.data.filter_length, SR, hps.data.hop_length, hps.data.win_length, center=False)

def embed(files):
    with torch.no_grad():
        return torch.stack([model.ref_enc(spec(librosa.load(f, sr=SR)[0]).transpose(1, 2)).unsqueeze(-1) for f in files]).mean(0)

src_files = [os.path.join(KEEP, i + ".mp3") if os.path.exists(os.path.join(KEEP, i + ".mp3")) else os.path.join(VOICE, i + ".mp3") for i in IDS]
tgt = embed(sorted(glob.glob(os.path.join(REF, "*.mp3"))))
src = embed(src_files)
for i, f in zip(IDS, src_files):
    keep = os.path.join(KEEP, i + ".mp3")
    if not os.path.exists(keep): shutil.copyfile(f, keep); f = keep
    a = librosa.load(f, sr=SR)[0]; s = spec(a)
    with torch.no_grad():
        out = model.voice_conversion(s, torch.LongTensor([s.size(-1)]), sid_src=src, sid_tgt=tgt, tau=float(os.environ.get("TAU", "0.3")))[0][0, 0].numpy()
    out = out * (0.09 / max(1e-4, float(np.sqrt(np.mean(out ** 2))))); out = np.clip(out, -0.98, 0.98)
    fade = int(0.01 * SR); out[:fade] *= np.linspace(0, 1, fade); out[-fade:] *= np.linspace(1, 0, fade)
    sf.write(os.path.join(VOICE, i + ".mp3"), out.astype(np.float32), SR, format="MP3")
    print(i, round(len(out) / SR, 1), flush=True)
