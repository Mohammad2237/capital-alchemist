// Procedural sound (Web Audio) + recorded character voices. No clicks: every buffer has a soft attack and
// release, and the looping beds crossfade their seam so nothing pops when a loop restarts.
const RATE = 44100;
export class Audio {
  constructor() {
    this.ctx = null; this.buffers = {}; this.last = {}; this.voiceData = {}; this.voices = {};
    const unlock = () => { this.start(); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
    window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
  }
  start() {
    if (this.ctx) { if (this.ctx.state !== "running") this.ctx.resume(); return; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain(); this.master.gain.value = 0.85; this.master.connect(comp);
    this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
    this.voiceBus = this.ctx.createGain(); this.voiceBus.gain.value = 1.25; this.voiceBus.connect(this.master);
    let s = 42; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff * 2 - 1; };
    // Soft 6 ms fade in/out on every one-shot so none of them click.
    const make = (sec, f) => { const n = Math.ceil(sec * RATE), b = this.ctx.createBuffer(1, n, RATE), d = b.getChannelData(0), e = 0.006 * RATE;
      for (let i = 0; i < n; i++) d[i] = f(i / RATE, i) * Math.min(1, i / e, (n - i) / e); return b; };
    let lp = 0;
    this.buffers.grind = make(0.32, t => (lp += (rnd() - lp) * 0.25) * Math.sin(Math.PI * t / 0.32) * (0.7 + 0.3 * Math.sin(t * 90)) * 0.5);
    lp = 0; this.buffers.splash = make(0.6, t => (lp += (rnd() - lp) * (0.1 + 0.25 * Math.exp(-t * 8))) * Math.exp(-t * 6) * 0.6 + Math.sin(2 * Math.PI * (160 + 380 * t) * t) * Math.exp(-t * 12) * 0.14);
    this.buffers.glass = make(0.6, t => (Math.sin(2 * Math.PI * 2350 * t) + 0.6 * Math.sin(2 * Math.PI * 3720 * t)) * Math.exp(-t * 9) * 0.12);
    const hits = [0, 0.07, 0.15, 0.21, 0.3, 0.34];
    this.buffers.coins = make(0.7, t => hits.reduce((v, h) => { const d = t - h; return d >= 0 ? v + (Math.sin(2 * Math.PI * (4200 + h * 900) * d) + 0.5 * Math.sin(2 * Math.PI * 6100 * d)) * Math.exp(-d * 38) * Math.min(1, d * 600) : v; }, 0) * 0.11);
    this.buffers.knock = make(0.85, t => [0, 0.28, 0.52].reduce((v, h) => { const d = t - h; return d >= 0 ? v + Math.sin(2 * Math.PI * 95 * d) * Math.exp(-d * 28) * Math.min(1, d * 400) : v; }, 0) * 0.6);
    this.buffers.creak = make(1.1, t => { const f = 300 + 110 * Math.sin(t * 7) + 50 * Math.sin(t * 23); return Math.sin(2 * Math.PI * f * t + 2 * Math.sin(t * 40)) * Math.sin(Math.PI * t / 1.1) * 0.06; });
    this.buffers.crystal = make(1.4, t => [1320, 1660, 1980, 2640].reduce((v, f, k) => { const d = t - k * 0.09; return d > 0 ? v + Math.sin(2 * Math.PI * f * d) * Math.exp(-d * 3.2) * Math.min(1, d * 300) : v; }, 0) * 0.06);
    this.buffers.reject = make(0.45, t => Math.sin(2 * Math.PI * (140 - 60 * t) * t) * Math.exp(-t * 8) * 0.4);
    lp = 0; this.buffers.paper = make(0.25, t => (lp += (rnd() - lp) * 0.5) * Math.sin(Math.PI * t / 0.25) * 0.16);
    this.buffers.chime = make(0.5, t => (Math.sin(2 * Math.PI * 880 * t) + 0.4 * Math.sin(2 * Math.PI * 1320 * t)) * Math.exp(-t * 7) * Math.min(1, t * 200) * 0.14);
    // New action sounds.
    lp = 0; this.buffers.whoosh = make(0.7, t => (lp += (rnd() - lp) * (0.04 + 0.25 * Math.sin(Math.PI * t / 0.7))) * Math.sin(Math.PI * t / 0.7) ** 2 * 0.7);
    this.buffers.pop = make(0.16, t => Math.sin(2 * Math.PI * (420 + 900 * t) * t) * Math.sin(Math.PI * t / 0.16) * 0.22);
    lp = 0; this.buffers.step = make(0.14, t => (lp += (rnd() - lp) * 0.15) * Math.sin(Math.PI * t / 0.14) * 0.5);
    lp = 0; this.buffers.swish = make(0.45, t => (lp += (rnd() - lp) * (0.05 + 0.1 * Math.sin(Math.PI * t / 0.45))) * Math.sin(Math.PI * t / 0.45) * 0.55);
    this.buffers.sparkle = make(0.9, t => [2100, 2800, 3500].reduce((v, f, k) => { const d = t - k * 0.06; return d > 0 ? v + Math.sin(2 * Math.PI * f * d) * Math.exp(-d * 6) * Math.min(1, d * 300) : v; }, 0) * 0.04);
    this.buffers.thud = make(0.3, t => Math.sin(2 * Math.PI * (110 - 80 * t) * t) * Math.exp(-t * 14) * 0.5);
    // Looping beds: a warm, smooth hearth rumble (no crackle impulses) and soft bubbling; seams crossfaded.
    const loopBuf = (sec, f) => { const n = sec * RATE, x = RATE * 0.5, raw = new Float32Array(n + x); for (let i = 0; i < n + x; i++) raw[i] = f(i / RATE);
      const b = this.ctx.createBuffer(1, n, RATE), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = i < x ? raw[i] * (i / x) + raw[n + i] * (1 - i / x) : raw[i]; return b; };
    let a = 0, b2 = 0;
    this.ambience = this.loop(loopBuf(6, () => { a += (rnd() - a) * 0.02; b2 += (a - b2) * 0.05; return b2 * 0.5; }), 0.0);
    const bub = loopBuf(3, () => 0), bd = bub.getChannelData(0);
    for (let k = 0; k < 26; k++) { const st = Math.floor(Math.random() * RATE * 3), f = 300 + Math.random() * 380, len = 0.09 + Math.random() * 0.08;
      for (let i = 0; i < len * RATE; i++) { const t = i / RATE; bd[(st + i) % bd.length] += Math.sin(2 * Math.PI * f * (1 + t * 4) * t) * Math.sin(Math.PI * t / len) * 0.09; } }
    this.bubbles = this.loop(bub, 0);
    let p = 0; this.pourLoop = this.loop(loopBuf(2, t => { p += (rnd() - p) * 0.3; return p * (0.6 + 0.4 * Math.sin(t * 31)) * 0.35; }), 0);
    this.ambience.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.5);
    for (const id in this.voiceData) this.decodeVoice(id);
  }
  loop(buffer, vol) { const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = buffer; src.loop = true; g.gain.value = vol; src.connect(g).connect(this.master); src.start(); return g; }
  play(name, pitch = 1, vol = 1) {
    if (!this.ctx || !this.buffers[name]) return;
    const now = this.ctx.currentTime; if (this.last[name] && now - this.last[name] < 0.06) return; this.last[name] = now;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = this.buffers[name]; src.playbackRate.value = pitch; g.gain.value = vol * 0.75;
    src.connect(g).connect(this.sfx); src.start();
  }
  setBubbling(level) { if (this.bubbles) this.bubbles.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.5, this.ctx.currentTime, 0.3); }
  setPouring(on) { if (this.pourLoop) this.pourLoop.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.06); }
  setSpeaking(on) { if (this.ambience) { this.ambience.gain.setTargetAtTime(on ? 0.22 : 0.5, this.ctx.currentTime, 0.3); this.sfx.gain.setTargetAtTime(on ? 0.6 : 1, this.ctx.currentTime, 0.2); } }

  // ---------------------------------------------------------------- character voices (Levantine dialect)
  async preloadVoices(ids) {
    // Palestinian voices are Ogg Vorbis; older Safari can't decode Ogg, so it falls back to the MP3 set.
    const ogg = !!document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"');
    await Promise.all(ids.map(async id => { try { let r = await fetch(`assets/voice/${id}.${ogg ? "ogg" : "mp3"}`); if (!r.ok && ogg) r = await fetch(`assets/voice/${id}.mp3`); if (r.ok) { this.voiceData[id] = await r.arrayBuffer(); if (this.ctx) this.decodeVoice(id); } } catch (e) {} }));
  }
  decodeVoice(id) { const data = this.voiceData[id]; if (!data || this.voices[id]) return; this.voices[id] = this.ctx.decodeAudioData(data.slice(0)).catch(() => null); }
  // Plays a line; resolves its length in seconds (or null if no recording / audio not started).
  async speak(id) {
    if (!this.ctx || !this.voices[id]) return null; const buf = await this.voices[id]; if (!buf) return null;
    if (this.voiceSrc) try { this.voiceSrc.stop(); } catch (e) {}
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(this.voiceBus); src.start(); this.voiceSrc = src; return buf.duration;
  }
  stopVoice() { if (this.voiceSrc) try { this.voiceSrc.stop(); } catch (e) {} this.voiceSrc = null; }
}
