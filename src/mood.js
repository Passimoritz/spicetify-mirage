/* ---------------------------------------------------------------- Gefühl des Songs */
// Wie fühlt sich der Song an – und wie jeder seiner Teile? Ohne zusätzliche Anfrage, nur aus dem, was schon da
// ist: Tempo, Lautheit, Dur/Moll (je Abschnitt), Klanghelligkeit, Dichte der Schläge, gehaltene Töne, Energie des
// Teils relativ zum Song, dazu – falls vorhanden – Spotifys Audio-Merkmale (Valenz, Energie, Tanzbarkeit) und eine
// winzige Wortliste über den Liedtext. Ergebnis je Teil: Valenz v (−1 traurig … +1 froh), Erregung a (−1 ruhig …
// +1 aufgedreht) und eine benannte Stimmung (euphorisch, fröhlich, zärtlich, melancholisch …).
// Rein rechnend, ohne Fenster – darum in den Unit-Tests ladbar (director.js plant damit).
import { songMap, at, STEP } from "./songmap.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MOODS = ["euphoric", "happy", "triumphant", "tender", "dreamy", "calm", "melancholic", "sad", "tense", "aggressive", "dark"];
// Lage jeder Stimmung im Valenz/Erregungs-Raum (Russells Circumplex, grob)
const PROTO = {
  euphoric: [0.6, 0.8], happy: [0.6, 0.3], triumphant: [0.45, 0.55], tender: [0.4, -0.45], dreamy: [0.1, -0.4], calm: [0.15, -0.75],
  melancholic: [-0.4, -0.3], sad: [-0.65, -0.65], tense: [-0.2, 0.45], aggressive: [-0.45, 0.85], dark: [-0.65, 0.1],
};
// Teile an sich: ein Drop ist aufgedrehter als eine Strophe gleicher Lautheit, ein Outro ruhiger
const KIND_A = { intro: -0.1, verse: 0, pre: 0.15, chorus: 0.1, drop: 0.2, break: -0.2, bridge: -0.05, outro: -0.15 };
const KIND_V = { bridge: -0.1, break: -0.05 };

/* ---- Liedtext: winzige Wortliste (Englisch, Deutsch). Wortanfänge – „lonel“ trifft lonely und loneliness */
const WORDS = {
  // froh
  "1": "love lov happ joy smil sun light danc alive free together shine beaut heaven gold celebr party forever best sweet laugh bright hope glory kiss fly win yeah magic paradise " +
    "lieb glück lach sonne licht tanz frei zusammen schön himmel feier freude hoffn küss süß strahl wunder",
  // traurig
  "-1": "sad cry tear alone lonel lost pain hurt broken die dead death cold gone goodbye fear sorry miss regret grief empty fall bleed ghost shadow rain " +
    "traurig wein träne allein einsam verlor schmerz kalt tot tod dunkel angst vorbei vermiss kaputt leer abschied sterb schatten regen",
};
// aufgebracht (Valenz runter, Erregung hoch)
// (kein „hell“: im Deutschen heißt das hell)
const ANGRY = "hate kill blood war fight rage scream burn destroy enemy hass blut krieg kampf wut schrei brenn hölle zerstör feind";
const EN = new Set(["i", "you", "we", "the", "to", "my", "will", "gonna", "let", "me", "and", "i'll", "i'm", "we'll", "want", "rather"]);
const NEG = new Set(["not", "no", "never", "don't", "dont", "can't", "cant", "won't", "nicht", "kein", "keine", "nie", "niemals"]);
const STEMS = [];
for (const [s, list] of Object.entries(WORDS)) for (const w of list.split(" ")) STEMS.push([w, +s, 0]);
for (const w of ANGRY.split(" ")) STEMS.push([w, -0.7, 1]);
// kurze Stämme nur als ganzes Wort (sonst trifft „sun“ auch „sunday“ – egal; „die“ aber auch das deutsche „die“)
const SHORT = new Set(["die", "sad", "sun", "fly", "win", "joy", "cry", "war", "tot", "tod", "hass", "wut", "fall", "rain", "gold", "hell", "miss", "free"]);
function lineMood(text) {
  const toks = String(text || "").toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);
  let v = 0, a = 0, n = 0, flip = 0;
  for (const w of toks) {
    if (NEG.has(w)) {
      flip = 2;
      continue;
    }
    // „die“ ist im Deutschen ein Artikel: es zählt nur in Zeilen mit englischen Wörtern
    const hit = STEMS.find(([s]) => (SHORT.has(s) ? w === s || w === s + "s" : w.startsWith(s)));
    if (hit && !(hit[0] === "die" && !toks.some((x) => EN.has(x)))) {
      v += flip ? -hit[1] * 0.6 : hit[1];
      a += hit[2];
      n++;
    }
    if (flip) flip--;
  }
  return n ? { v: clamp(v / n, -1, 1), a: clamp(a / n, 0, 1), n } : null;
}
// Zeilen [{ t (s), text }] → je Zeile die Stimmung (nur Zeilen mit Treffern)
function lyricMoods(lines) {
  const out = [];
  for (const l of lines || []) {
    const m = lineMood(l.text);
    if (m) out.push({ t: l.t, ...m });
  }
  return out;
}

/* ---- Merkmale des ganzen Songs */
function songFeatures(d, M) {
  const segs = d.segs || [], beats = d.beats || [];
  const len = Math.max(1, M.energy.length * STEP);
  let L = 0, B = 0, nb = 0;
  for (const s of segs) L += s.l;
  L = segs.length ? L / segs.length : -12;
  // Helligkeit nur über die hörbaren Segmente (Stille ist nicht „dunkel“)
  for (const s of segs) if (s.l > L - 6) [B, nb] = [B + (s.b || 0), nb + 1];
  B = nb ? B / nb : 40;
  const sx = d.sections || [];
  let minor = 0, all = 0;
  sx.forEach((x, i) => {
    const l = Math.max(0, (sx[i + 1]?.t ?? len) - x.t);
    all += l;
    if (x.mode === 0) minor += l;
  });
  let held = 0;
  for (const [a, b] of M.holds) held += b - a;
  let tonal = 0;
  for (let i = 0; i < M.tonal.length; i++) tonal += M.tonal[i];
  const bpm = d.bpm || (beats.length > 1 ? 60 / ((beats[beats.length - 1].t - beats[0].t) / (beats.length - 1)) : 110);
  return {
    bpm, loud: L, bright: B, minor: all ? minor / all : 0.3,
    // Schläge je Takt-Schlag: Kick, Snare, Hi-Hat zusammen
    dens: (M.kicks.length + M.snares.length + M.hats.length) / Math.max(1, beats.length),
    held: held / len, tonal: M.tonal.length ? tonal / M.tonal.length : 0.3,
  };
}

// Anteil von [t0, t1), den gehaltene Töne füllen
function heldIn(holds, t0, t1) {
  let s = 0;
  for (const [a, b] of holds) s += Math.max(0, Math.min(b, t1) - Math.max(a, t0));
  return s / Math.max(0.5, t1 - t0);
}
const countIn = (arr, t0, t1) => {
  let n = 0;
  for (const t of arr) if (t >= t0 && t < t1) n++;
  return n;
};

/* ---- nächstgelegene benannte Stimmung, mit Zusatzhinweisen (Aufbau → angespannt, gehaltene Töne → feierlich …) */
function nameOf(v, a, hint) {
  const score = {};
  for (const k of MOODS) score[k] = Math.hypot(v - PROTO[k][0], a - PROTO[k][1]);
  // Aufbau vor dem Höhepunkt fühlt sich nach Spannung an
  if (hint.kind === "pre") score.tense -= 0.18;
  // groß, getragen, mit langen Tönen: feierlich statt euphorisch
  if ((hint.kind === "chorus" || hint.kind === "drop") && hint.held > 0.2 && hint.bpm < 125 && v > 0.1) score.triumphant -= 0.2;
  // wenig Schlag, klare Töne, eher leise: verträumt
  if (a < 0.1 && hint.dens < 1.2 && hint.tonal > 0.4) score.dreamy -= 0.1;
  // „düster“ braucht einen Song, der nicht langsam und leise ist, und einen dunklen Klang
  if (hint.A0 < -0.15 || hint.ba > 0.3) score.dark += 0.3;
  // schnell, laut, Moll: aggressiv statt nur angespannt
  if (hint.A0 > 0.55 && hint.minor > 0.5 && a > 0.4) score.aggressive -= 0.15;
  let best = "calm", alt = "calm";
  for (const k of MOODS) {
    if (score[k] < score[best]) [alt, best] = [best, k];
    else if (k !== best && (alt === best || score[k] < score[alt])) alt = k;
  }
  return { name: best, alt };
}

// d = Analyse, parts = Teile der Lichtregie ({ t0, t1, kind, e, mode }), o = { feat: { valence, energy, dance }, lyrics: [{ t, text }] }
function songMood(d, parts, o = {}) {
  const M = songMap(d), F = songFeatures(d, M);
  const ta = clamp((F.bpm - 100) / 50, -1, 1), la = clamp((F.loud + 12) / 6, -1, 1);
  const ba = clamp((F.bright - 30) / 60, -1, 1), da = clamp((F.dens - 1) / 1.5, -1, 1);
  const fe = o.feat && Number.isFinite(o.feat.energy) ? o.feat.energy : null;
  const fv = o.feat && Number.isFinite(o.feat.valence) ? o.feat.valence : null;
  const fd = o.feat && Number.isFinite(o.feat.dance) ? o.feat.dance : null;
  // Erregung des Songs: Tempo und Lautheit vor allem, Dichte und Helligkeit dazu; Spotifys Energie zählt am meisten
  let A0 = 0.35 * ta + 0.35 * la + 0.15 * da + 0.15 * ba;
  if (fe != null) A0 = 0.5 * (2 * fe - 1) + 0.5 * A0;
  // Grund-Valenz ohne Tonart: heller Klang und (in Dur) schnelles Tempo heben, Tanzbarkeit auch
  const Vb = 0.15 * ba + 0.12 * ta * (F.minor < 0.5 ? 1 : 0.3) + (fd != null ? 0.15 * (2 * fd - 1) : 0);
  const modeSong = (1 - 2 * F.minor) * 0.45;
  const lyr = lyricMoods(o.lyrics);
  const lyrSong = lyr.length >= 4 ? lyr.reduce((s, x) => s + x.v, 0) / lyr.length : 0;
  const out = parts.map((p) => {
    const t0 = p.t0, t1 = p.t1, re = clamp(p.e ?? at(M.energy, (t0 + t1) / 2), 0, 1);
    // Dur/Moll dieses Teils (unbekannte Tonart: wie der Song)
    const mp = p.key >= 0 || p.mode === 0 ? (p.mode === 0 ? -0.45 : 0.45) : modeSong;
    const held = heldIn(M.holds, t0, t1);
    const dl = (countIn(M.kicks, t0, t1) + countIn(M.snares, t0, t1) + countIn(M.hats, t0, t1)) / Math.max(1, (t1 - t0) / (60 / F.bpm));
    let br = 0, nb = 0;
    for (let t = t0; t < t1; t += 1, nb++) br += at(M.bright, t);
    br = nb ? br / nb : 0.5;
    let a = 0.65 * A0 + 0.7 * (re - 0.5) + (KIND_A[p.kind] || 0) + 0.1 * clamp(dl - F.dens, -1, 1);
    // leise und getragen (lange Töne in einem ruhigen Teil) wirkt wehmütig
    let v = Vb + 0.4 * modeSong + 0.6 * mp + 0.15 * (re - 0.5) + 0.1 * (br - 0.5) + (KIND_V[p.kind] || 0) - (held > 0.2 && re < 0.5 ? 0.1 : 0);
    // Liedtext des Teils (mindestens zwei Zeilen mit Treffern), sonst der des ganzen Songs, schwächer
    const ly = lyr.filter((x) => x.t >= t0 && x.t < t1);
    if (ly.length >= 2) {
      v += 0.35 * (ly.reduce((s, x) => s + x.v, 0) / ly.length);
      a += 0.2 * (ly.reduce((s, x) => s + x.a, 0) / ly.length);
    } else v += 0.15 * lyrSong;
    return { v, a, re, held, dens: dl, kind: p.kind, len: t1 - t0 };
  });
  // Spotifys Valenz verschiebt den ganzen Song dorthin – die Unterschiede zwischen den Teilen bleiben
  if (fv != null && out.length) {
    let s = 0, w = 0;
    for (const x of out) [s, w] = [s + x.v * x.len, w + x.len];
    const shift = 0.6 * (2 * fv - 1 - s / w);
    for (const x of out) x.v += shift;
  }
  // Sicherheit: geschätzte Analyse (aus dem Liedtext) → schwächere Wirkung
  const conf = d.synthetic ? (fe != null || fv != null ? 0.75 : 0.55) : 1;
  const parts2 = out.map((x) => {
    const v = clamp(x.v, -1, 1), a = clamp(x.a, -1, 1);
    const { name, alt } = nameOf(v, a, { kind: x.kind, held: x.held, bpm: F.bpm, dens: x.dens, tonal: F.tonal, A0, ba, minor: F.minor });
    return { v, a, name, alt, conf };
  });
  // Song gesamt: zeitgewichtetes Mittel
  let sv = 0, sa = 0, w = 0;
  out.forEach((x, i) => {
    sv += parts2[i].v * x.len;
    sa += parts2[i].a * x.len;
    w += x.len;
  });
  sv = w ? sv / w : 0;
  sa = w ? sa / w : 0;
  return { song: { v: sv, a: sa, ...nameOf(sv, sa, { kind: "", held: F.held, bpm: F.bpm, dens: F.dens, tonal: F.tonal, A0, ba, minor: F.minor }), A0, F }, parts: parts2, conf };
}

export { songMood, lyricMoods, lineMood, MOODS, PROTO };
