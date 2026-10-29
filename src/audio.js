import { S, root, clamp, seek, lru } from "./core.js";
import { cfg } from "./config.js";

/* ---------------------------------------------------------------- Taktdaten */
const audio = { uri: "", data: null };
// Taktdaten der letzten 50 Songs: Zurückspringen lädt nichts neu
const audioCache = lru(50);
async function loadAudio(uri) {
  if (!uri || audio.uri === uri) return;
  audio.uri = uri;
  audio.data = audioCache.get(uri) || null;
  if (audio.data || !uri.startsWith("spotify:track:") || typeof S.getAudioData !== "function") {
    beat.sync();
    return;
  }
  try {
    const d = await Promise.race([S.getAudioData(uri), new Promise((_, rej) => setTimeout(rej, 8000))]);
    if (audio.uri === uri && d?.beats?.length) {
      audio.data = {
        beats: d.beats.map((b) => ({ t: b.start, c: b.confidence ?? 1 })),
        segs: (d.segments || []).map((s) => ({ t: s.start, l: s.loudness_max, p: s.pitches || [] })),
      };
      audioCache.set(uri, audio.data);
    }
  } catch {}
  beat.sync();
}

// 8 Bänder 0..1 für die Overlay-App (Tonhöhen-Verteilung × Lautstärke + Schlag)
function bands(sec) {
  const segs = audio.data?.segs;
  if (!segs?.length) return null;
  const s = segs[Math.max(seek(segs, sec, "t"), 0)];
  if (!s || s.p.length !== 12) return null;
  const loud = clamp((s.l + 38) / 38, 0, 1);
  const b = beat.read(sec);
  const out = [];
  for (let i = 0; i < 8; i++) {
    const f = (i / 7) * 11, lo = Math.floor(f), hi = Math.min(11, lo + 1);
    const p = s.p[lo] + (s.p[hi] - s.p[lo]) * (f - lo);
    out.push(Number(clamp((0.1 + p * 0.9) * (0.35 + loud * 0.65) + b * 0.2, 0, 1).toFixed(3)));
  }
  return out;
}

// 0..1: wie stark gerade ein Schlag nachklingt. Wird pro Bild direkt aus den Taktdaten gelesen
// (dust.js zeichnet den Puls im Hintergrund-Canvas) – keine eigene Schleife, keine Timer.
const beat = (() => {
  let on = false;
  function read(sec) {
    const bs = audio.data?.beats;
    if (!bs) return 0;
    const i = seek(bs, sec, "t");
    if (i < 0) return 0;
    const since = sec - bs[i].t;
    return Math.pow(clamp(1 - since / 0.32, 0, 1), 2) * clamp(0.4 + bs[i].c, 0, 1);
  }
  const now = () => (S.Player.getProgress?.() || 0) / 1000;
  function sync() {
    on = cfg.beat && !cfg.calm && !!audio.data && root.classList.contains("mirage-playing");
    root.classList.toggle("mirage-beat", on);
  }
  return { sync, read, get level() { return on ? read(now()) : 0; } };
})();

export { audio, loadAudio, beat, bands };
