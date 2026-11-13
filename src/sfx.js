import { cfg } from "./config.js";

/* ---------------------------------------------------------------- Soundeffekte der Spiele */
// Alles wird synthetisiert: keine Dateien, nichts zu laden. Lautstärke über „Soundeffekte“ in den Spiel-Einstellungen.
let ac = null, idle = 0;
const level = () => {
  const v = cfg.gameSfx;
  return v === undefined ? 0.7 : Number(v) || 0;
};
// Ein offener AudioContext hält das Audiogerät und einen eigenen Thread wach – auch stumm. Nach einer
// Minute ohne Effekt schließen; der nächste Effekt öffnet einen neuen (dauert wenige ms).
function sleepLater() {
  clearTimeout(idle);
  idle = setTimeout(() => {
    ac?.close().catch(() => {});
    ac = null;
  }, 60000);
}
function ctx() {
  const lv = level();
  if (!lv) return null;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume().catch(() => {});
    sleepLater();
    return ac;
  } catch {
    return null;
  }
}
function tone(freq, dur, { type = "sine", gain = 0.2, at = 0, to = 0 } = {}) {
  const c = ctx();
  if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + at, peak = gain * level();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
function noise(dur, { gain = 0.2, at = 0, from = 4000, to = 300, q = 1 } = {}) {
  const c = ctx();
  if (!c) return;
  const n = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + at;
  s.buffer = buf;
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(gain * level(), t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(c.destination);
  s.start(t0);
}
const chord = (notes, step, opt) => notes.forEach((f, i) => tone(f, opt.dur || 0.35, { ...opt, at: (opt.at || 0) + i * step }));

export const sfx = {
  tick: () => tone(1100, 0.05, { type: "square", gain: 0.06 }),
  pop: () => tone(620, 0.09, { type: "triangle", gain: 0.16, to: 980 }),
  go: () => chord([523, 784], 0.09, { type: "triangle", gain: 0.18, dur: 0.22 }),
  good: () => chord([523, 659, 784, 1047], 0.08, { type: "triangle", gain: 0.2, dur: 0.32 }),
  bad: () => chord([311, 233], 0.16, { type: "sawtooth", gain: 0.1, dur: 0.3 }),
  reveal: () => chord([392, 523, 659], 0.09, { type: "sine", gain: 0.2, dur: 0.4 }),
  whoosh: () => noise(0.32, { gain: 0.14, from: 500, to: 3500, q: 0.7 }),
  horn: () => {
    tone(392, 0.45, { type: "sawtooth", gain: 0.12 });
    tone(587, 0.45, { type: "sawtooth", gain: 0.1 });
  },
  scratch: () => {
    noise(0.28, { gain: 0.3, from: 3800, to: 240, q: 2 });
    tone(900, 0.26, { type: "sawtooth", gain: 0.08, to: 110 });
  },
  buzz: () => tone(130, 0.3, { type: "square", gain: 0.1 }),
  fuse: () => noise(0.05, { gain: 0.12, from: 5200, to: 3800, q: 3 }),
  boom: () => {
    noise(0.9, { gain: 0.5, from: 1200, to: 70, q: 0.5 });
    tone(110, 0.8, { gain: 0.4, to: 32 });
  },
  siren: () => {
    tone(740, 0.22, { type: "square", gain: 0.1 });
    tone(990, 0.22, { type: "square", gain: 0.1, at: 0.22 });
    tone(740, 0.22, { type: "square", gain: 0.1, at: 0.44 });
  },
  wheel: () => {
    let at = 0, gap = 0.05;
    while (at < 4.9) {
      tone(1500, 0.03, { type: "square", gain: 0.05, at });
      at += gap;
      gap *= 1.055;
    }
  },
  fanfare: () => {
    chord([523, 659, 784], 0.12, { type: "triangle", gain: 0.2, dur: 0.3 });
    chord([1047, 1319], 0.02, { type: "triangle", gain: 0.2, dur: 0.8, at: 0.4 });
  },
};
