/* ---------------------------------------------------------------- DJ-Übergabe: Hilfen ohne Zustand */
// Rein rechnend (ohne Spotify, ohne DOM) – party.js nutzt sie, tests/unit/handover.test.js prüft sie.
import { rgb2hsl, hsl2rgb } from "./hsl.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Lichtfarben des nächsten Songs, so kräftig wie im Party-Modus (wie vivid() in immersive.js, ohne Melodie und Tonart)
const TINT = { cool: 205, warm: 28, hot: 4, pink: 325, gold: 44, jungle: 130 };
const toward = (h, target, f) => (h + ((((target - h) % 360) + 540) % 360 - 180) * f + 360) % 360;
function vividOf(pal, tint) {
  if (!Array.isArray(pal) || pal.length < 3) return null;
  const hsl = pal.map(rgb2hsl), grey = hsl.every(([, s]) => s < 0.12);
  return hsl.map(([h, s, l], i) => {
    let hue = grey ? [275, 195, 320][i] : h;
    if (TINT[tint] != null) hue = toward(hue, TINT[tint] + (i - 1) * 22, 0.45);
    return hsl2rgb([hue, Math.max(s, 0.74), clamp(l, 0.56, 0.7)]);
  });
}
const lerpPal = (a, b, f) => a.map((c, i) => c.map((v, k) => Math.round(v + (b[i][k] - v) * f)));
// Tempo des nächsten Songs im Verhältnis zum jetzigen, halbes/doppeltes Zeitgefühl zusammengelegt (0,7 … 1,4)
function tempoRatio(next, now) {
  if (!(next > 40) || !(now > 40)) return 1;
  let r = next / now;
  while (r > 1.42) r /= 2;
  while (r < 0.7) r *= 2;
  return r;
}
// Name der DJ-Stimme, falls Spotify ihn mitschickt. Spotify 1.3.10 tut das nicht (nur „is_narration“ am Eintrag und
// „lexicon_set_type: your_dj“ am Kontext) – geprüft wird trotzdem, damit eine spätere Version ihn gleich zeigt.
const VOICE_KEYS = ["narration.voice.name", "narration.voice", "dj_voice_name", "dj_voice", "voice_name", "narrator_name", "narrator"];
function djVoice(item, ctx) {
  for (const m of [item?.metadata, ctx?.metadata]) {
    if (!m) continue;
    for (const k of VOICE_KEYS) {
      const v = String(m[k] ?? "").replace(/\p{Cc}/gu, "").trim();
      if (v && v.length <= 24 && !/^(true|false|\d+)$/i.test(v)) return v;
    }
  }
  return "";
}
// Kurze DJ-Einwürfe: die Bühne wird erst ruhig, wenn die Ansage länger als 2,5 s läuft, und kommt weich zurück.
// Werbung, Podcasts und Hörbücher werden sofort ruhig (aber nicht im selben Bild). Rein rechnend – testbar.
function createTalkGate(hold = 2.5) {
  let on = 0, v = 0;
  return {
    step(kind, dt) {
      on = kind ? on + dt : 0;
      const want = kind && (kind !== "dj" || on > hold) ? 1 : 0;
      v += (want - v) * (1 - Math.exp(-dt * (want > v ? (kind === "dj" ? 2.2 : 5) : 2.4)));
      if (v < 0.002) v = 0;
      return v;
    },
    get v() { return v; },
  };
}

// Wie weit der Ausklang ist (0..1): über die letzten 16 Schläge (6–12 s), Beginn auf einem Taktanfang, wenn die
// Taktdaten ihn kennen (bars: [{ t }] aufsteigend). Ohne Taktdaten nur nach der Zeit.
function outroWindow(sec, dur, bpm, bars) {
  if (!(dur > 30)) return 0;
  const beat = 60 / (bpm || 120), len = clamp(16 * beat, 6, 12);
  let t0 = dur - len;
  if (bars?.length) {
    let lo = 0, hi = bars.length - 1, b = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (bars[m].t <= t0) [b, lo] = [m, m + 1];
      else hi = m - 1;
    }
    if (b >= 0 && t0 - bars[b].t < 4 * beat) t0 = bars[b].t;
  }
  return clamp((sec - t0) / Math.max(1, dur - t0), 0, 1);
}

export { createTalkGate, vividOf, lerpPal, tempoRatio, djVoice, outroWindow, TINT };
