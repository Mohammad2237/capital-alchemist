// Original procedural sound effects (Web Audio). Same recipes as the Unity version; no audio files needed.
const RATE = 44100;
export class Audio {
  constructor() {
    this.ctx = null; this.buffers = {}; this.last = {};
    const unlock = () => { this.start(); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
    window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
  }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
    let s = 42; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff * 2 - 1; };
    const make = (sec, f) => { const n = Math.ceil(sec * RATE), b = this.ctx.createBuffer(1, n, RATE), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = f(i / RATE, i); return b; };
    let lp = 0;
    this.buffers.grind = make(0.32, t => (lp += (rnd() - lp) * 0.25) * Math.sin(Math.PI * t / 0.32) * (0.7 + 0.3 * Math.sin(t * 90)) * 0.5);
    lp = 0; this.buffers.splash = make(0.5, t => (lp += (rnd() - lp) * (0.12 + 0.3 * Math.exp(-t * 8))) * Math.exp(-t * 7) * 0.6 + Math.sin(2 * Math.PI * (180 + 400 * t) * t) * Math.exp(-t * 14) * 0.15);
    this.buffers.glass = make(0.6, t => (Math.sin(2 * Math.PI * 2350 * t) + 0.6 * Math.sin(2 * Math.PI * 3720 * t) + 0.3 * Math.sin(2 * Math.PI * 5110 * t)) * Math.exp(-t * 9) * 0.16);
    const hits = [0, 0.07, 0.15, 0.21, 0.3, 0.34];
    this.buffers.coins = make(0.7, t => hits.reduce((v, h) => { const d = t - h; return d >= 0 ? v + (Math.sin(2 * Math.PI * (4200 + h * 900) * d) + 0.5 * Math.sin(2 * Math.PI * 6100 * d)) * Math.exp(-d * 38) : v; }, 0) * 0.13);
    this.buffers.knock = make(0.85, t => [0, 0.28, 0.52].reduce((v, h) => { const d = t - h; return d >= 0 ? v + (Math.sin(2 * Math.PI * 95 * d) + 0.5 * rnd() * Math.exp(-d * 90)) * Math.exp(-d * 28) : v; }, 0) * 0.55);
    this.buffers.creak = make(1.1, t => { const f = 320 + 120 * Math.sin(t * 7) + 60 * Math.sin(t * 23); return ((t * f) % 1 * 2 - 1) * Math.sin(Math.PI * t / 1.1) * (0.5 + 0.5 * Math.sin(t * 41)) * 0.08; });
    this.buffers.crystal = make(1.4, t => [1320, 1660, 1980, 2640].reduce((v, f, k) => { const d = t - k * 0.09; return d > 0 ? v + Math.sin(2 * Math.PI * f * d) * Math.exp(-d * 3.2) : v; }, 0) * 0.07);
    this.buffers.reject = make(0.45, t => (Math.sin(2 * Math.PI * (140 - 60 * t) * t) + 0.3 * rnd() * Math.exp(-t * 40)) * Math.exp(-t * 8) * 0.45);
    lp = 0; this.buffers.paper = make(0.35, t => (lp += (rnd() - lp) * 0.6) * Math.sin(Math.PI * t / 0.35) * (0.5 + 0.5 * Math.abs(Math.sin(t * 60))) * 0.22);
    this.buffers.chime = make(0.12, (t, i) => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-i / 700) * 0.22);
    // Hearth ambience loop + cauldron bubbling loop.
    let low = 0, cr = 0;
    const amb = make(4, () => { low += (rnd() - low) * 0.05; if (Math.random() < 0.00025) cr = 0.25; cr *= 0.996; return low * 0.06 + cr * rnd() * 0.12; });
    this.ambience = this.loop(amb, 0.16);
    const bub = this.ctx.createBuffer(1, RATE * 2, RATE), bd = bub.getChannelData(0);
    for (let b = 0; b < 38; b++) { const st = Math.floor(Math.random() * RATE * 2), f = 380 + Math.random() * 700, len = 0.05 + Math.random() * 0.06;
      for (let i = 0; i < len * RATE; i++) { const t = i / RATE; bd[(st + i) % bd.length] += Math.sin(2 * Math.PI * f * (1 + t * 6) * t) * Math.exp(-t * 55) * 0.18; } }
    this.bubbles = this.loop(bub, 0);
  }
  loop(buffer, vol) { const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = buffer; src.loop = true; g.gain.value = vol; src.connect(g).connect(this.master); src.start(); return g; }
  play(name, pitch = 1, vol = 1) {
    if (!this.ctx || !this.buffers[name]) return;
    const now = this.ctx.currentTime; if (this.last[name] && now - this.last[name] < 0.06) return; this.last[name] = now;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = this.buffers[name]; src.playbackRate.value = pitch; g.gain.value = vol * 0.75;
    src.connect(g).connect(this.master); src.start();
  }
  setBubbling(level) { if (this.bubbles) this.bubbles.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.3, this.ctx.currentTime, 0.3); }
  setSpeaking(on) { if (this.ambience) this.ambience.gain.setTargetAtTime(on ? 0.05 : 0.14, this.ctx.currentTime, 0.4); }
}
