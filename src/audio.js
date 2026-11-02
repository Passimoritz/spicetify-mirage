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
  await fetchAnalysis(uri, 0);
}
// Spotify liefert die Analyse manchmal nicht (Zeitüberschreitung, Anfragelimit). Früher blieb der Song
// dann ganz ohne Taktdaten und die Welle lief „ins Blaue“ – jetzt noch dreimal nachfragen, solange er läuft.
const RETRY = [3000, 8000, 20000];
async function fetchAnalysis(uri, attempt) {
  let got = false;
  try {
    const d = await Promise.race([S.getAudioData(uri), new Promise((_, rej) => setTimeout(rej, 8000))]);
    // Analysedaten sind nicht immer vollständig: fehlende oder kaputte Werte ersetzen, sonst
    // schleicht sich NaN in den Visualizer und er bleibt bis zum Neuladen leer
    const num = (v, fb) => (Number.isFinite(v) ? v : fb);
    const ok = (x) => Number.isFinite(x?.start);
    const beats = (d?.beats || []).filter(ok);
    if (audio.uri === uri && beats.length) {
      const segs = (d.segments || []).filter(ok).map((s) => ({
        t: s.start,
        l: num(s.loudness_max, -20),
        p: s.pitches?.length === 12 && s.pitches.every(Number.isFinite) ? s.pitches : [],
        // Klangfarbe: timbre[1] = Helligkeit (Höhen, Becken, Synth-Leads) – der Party-Modus macht daraus Lichtschärfe
        b: num(s.timbre?.[1], 0),
        // timbre[2] = Flachheit (rauschig wie Snare/Clap/Becken), timbre[3] = Anschlag (hart wie Kick/Snare)
        f: num(s.timbre?.[2], 0),
        k: num(s.timbre?.[3], 0),
      }));
      // Tempo (Spotify-Analyse, sonst aus den Schlagabständen) und mittlere Lautheit des Songs –
      // der Party-Modus wählt daraus Stärke und Takt seiner Effekte und erkennt laute „Drops“
      const gaps = beats.slice(1, 200).map((b, i) => b.start - beats[i].start).filter((g) => g > 0.2 && g < 2).sort((a, b) => a - b);
      const bpm = Number(d.track?.tempo) || (gaps.length ? 60 / gaps[gaps.length >> 1] : 0);
      const avg = segs.length ? segs.reduce((n, s) => n + s.l, 0) / segs.length : -12;
      audio.data = {
        beats: beats.map((b) => ({ t: b.start, c: num(b.confidence, 1) })),
        bars: (d.bars || []).filter(ok).map((b) => ({ t: b.start })),
        // Abschnitte (Strophe, Refrain …) mit Tonart-Geschlecht: mode 1 = Dur, 0 = Moll
        sections: (d.sections || []).filter(ok).map((s) => ({ t: s.start, mode: num(s.mode, 1), l: num(s.loudness, -12) })),
        segs,
        bpm: Math.round(bpm),
        loud: Number(d.track?.loudness) || avg,
        avg,
      };
      audioCache.set(uri, audio.data);
      got = true;
    }
  } catch {}
  beat.sync();
  if (!got && audio.uri === uri && attempt < RETRY.length) {
    setTimeout(() => audio.uri === uri && !audio.data && fetchAnalysis(uri, attempt + 1), RETRY[attempt]);
  }
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
