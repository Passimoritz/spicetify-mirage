/* ---------------------------------------------------------------- Lichtregie */
// Wie ein Video-Edit, nur ohne Kamera: einmal pro Song plant die Regie aus der Song-Karte die Teile
// (Intro, Strophe, Pre-Chorus, Refrain, Drop, Break, Bridge, Outro) – jede Grenze liegt auf einer Eins,
// ein Drop genau auf seinem Schlag. Jeder Teil bekommt einen „Look“: Helligkeit, Bewegungstempo,
// Farbkorrektur (Sättigung, Temperatur, Kontrast, Farbwelt), welche Effekte erlaubt sind, wie viel Nebel.
// Pro Bild liefert cue() den Zustand zur Songzeit – rein aus der Zeit berechnet, ohne Gedächtnis: Springen
// im Song, ausgelassene Bilder oder der Hintergrund-Thread können nichts aus dem Takt bringen.
// Die Stile unterscheiden sich nur über eine kurze Signatur (SIG) – keine Sonderfälle im Zeichencode.
import { songMap, at, seek, STEP } from "./songmap.js";
import { songMood, PROTO } from "./mood.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const KINDS = ["intro", "verse", "pre", "chorus", "drop", "break", "bridge", "outro"];
// Look je Teil. I = Helligkeit, speed = Tempo der Bewegung, sat/warm/con/hue = Farbkorrektur (hue = Drehung
// in eine andere Farbwelt), beams/sparks = Menge an Strahlen und Funken, flash = erlaubte Farbflächen
// (0 keine, 0.5 nur auf der Eins, 1 alle), fx = Bühneneffekte (Laserfläche, CO2, Pyro), haze = Nebel,
// glide = Überblendung in Takten (0 = harter Wechsel genau auf dem Schlag), swap = Wechsel mit Lichtwisch
const LOOK = {
  intro: { I: 0.72, speed: 0.6, sat: 0.85, warm: 0, con: 0.92, hue: 0, beams: 0.45, sparks: 0.4, flash: 0, fx: 0, haze: 1.3, glide: 2, swap: 0 },
  verse: { I: 0.84, speed: 0.8, sat: 0.92, warm: 0, con: 0.96, hue: 0, beams: 0.7, sparks: 0.7, flash: 0.5, fx: 0.5, haze: 1, glide: 2, swap: 0 },
  pre: { I: 0.92, speed: 1, sat: 1, warm: 0, con: 1, hue: 0, beams: 0.85, sparks: 0.8, flash: 0.5, fx: 0.5, haze: 1.1, glide: 1, swap: 0 },
  chorus: { I: 1.12, speed: 1.12, sat: 1.12, warm: 0.05, con: 1.08, hue: 0, beams: 1.15, sparks: 1.2, flash: 1, fx: 1, haze: 0.9, glide: 0.25, swap: 1 },
  drop: { I: 1.25, speed: 1.25, sat: 1.18, warm: 0, con: 1.15, hue: 0, beams: 1.3, sparks: 1.4, flash: 1, fx: 1, haze: 0.8, glide: 0, swap: 1 },
  break: { I: 0.55, speed: 0.45, sat: 0.72, warm: -0.3, con: 0.88, hue: 0, beams: 0.3, sparks: 0.25, flash: 0, fx: 0, haze: 1.5, glide: 1, swap: 0 },
  bridge: { I: 0.82, speed: 0.7, sat: 0.95, warm: -0.1, con: 0.95, hue: 120, beams: 0.6, sparks: 0.6, flash: 0.5, fx: 0.5, haze: 1.2, glide: 0.25, swap: 1 },
  outro: { I: 0.66, speed: 0.55, sat: 0.8, warm: 0.15, con: 0.92, hue: 0, beams: 0.4, sparks: 0.4, flash: 0, fx: 0, haze: 1.2, glide: 2, swap: 0 },
};
// Signatur je Stil. contrast = wie weit die Teile auseinanderliegen · warm/sat/speed = Grundton des Stils ·
// drops = elektronische Dramaturgie (Drop statt Refrain) · drama = Spannung vor dem Höhepunkt (Riser,
// dunkler Schlag auch vor dem Refrain) · tf* = gefühltes Tempo der Lichtmuster (0.5 halbes, 2 doppeltes) ·
// pump = Sidechain-Pumpen auf der Kick · boom = 808-Treffer am Boden · wall = Lichtwand auf der Eins des
// Refrains · sync = Akzente im Tresillo (3-3-2) · swell = langsames Atmen über zwei Takte · scan = lange,
// hypnotische Scanner · vox = Verfolger-Spot auf gehaltenen Tönen
const BASE = { contrast: 1, warm: 0, sat: 1, speed: 1, drops: 0, drama: 0, tfBreak: 1, tfDrop: 1, tfChorus: 1, pump: 0, boom: 0, wall: 0, sync: 0, swell: 0, scan: 0, vox: 0.6 };
const SIG = {
  edm: { contrast: 1.3, drops: 1, drama: 1, pump: 0.3, vox: 0.5 },
  house: { contrast: 0.9, warm: 0.3, drops: 1, drama: 0.4, pump: 1, vox: 0.6 },
  techno: { contrast: 0.7, warm: -0.35, sat: 0.6, speed: 0.7, drops: 1, drama: 0.3, scan: 1, vox: 0.2 },
  trance: { contrast: 1.2, drops: 1, drama: 1, vox: 0.9 },
  dnb: { contrast: 1.1, warm: -0.25, drops: 1, drama: 0.7, tfDrop: 2, tfChorus: 2, vox: 0.4 },
  dubstep: { contrast: 1.35, warm: -0.2, drops: 1, drama: 1, tfBreak: 0.5, tfDrop: 0.5, boom: 0.8, vox: 0.3 },
  trap: { contrast: 1.1, warm: -0.15, speed: 0.75, drama: 0.5, tfBreak: 0.5, tfDrop: 0.5, tfChorus: 0.5, boom: 1, vox: 0.5 },
  hiphop: { contrast: 0.9, speed: 0.85, boom: 0.5, vox: 0.6 },
  rock: { contrast: 1.15, warm: 0.1, wall: 1, vox: 0.7 },
  metal: { contrast: 1.2, warm: 0.15, wall: 1, vox: 0.5 },
  pop: { contrast: 1, drama: 0.3, vox: 0.8 },
  ballad: { contrast: 0.8, warm: 0.6, speed: 0.6, swell: 1, vox: 1 },
  calm: { contrast: 0.6, warm: 0.25, speed: 0.55, swell: 0.7, vox: 0.8 },
  latin: { contrast: 1, warm: 0.5, sat: 1.1, sync: 1, vox: 0.7 },
  reggae: { contrast: 0.8, warm: 0.35, speed: 0.8, sync: 0.5, vox: 0.6 },
};
// alle Spielarten aus party.js → ihre Signatur (unbekannte bekommen Pop)
const STYLE = {
  edm: ["rave", "edm", "eurodance", "futurebass", "hardstyle", "hyperpop"],
  house: ["house", "deephouse", "techhouse", "garage", "disco", "electroswing", "amapiano"],
  techno: ["techno", "melodictechno", "hardtechno", "synthwave"],
  trance: ["trance", "psytrance"],
  dnb: ["dnb", "breakbeat"],
  dubstep: ["dubstep"],
  trap: ["trap", "drill", "phonk", "cloudrap"],
  hiphop: ["bass", "boombap"],
  rock: ["rock", "hardrock", "alternative", "indie", "punk", "emo", "country"],
  metal: ["metal"],
  pop: ["pop", "kpop", "jpop", "schlager", "musical", "christmas", "rnb", "soul", "gospel", "celtic", "bollywood"],
  ballad: ["ballad", "acoustic", "postrock"],
  calm: ["chill", "lofi", "ambient", "jazz", "blues", "classical", "neoclassical", "cinematic"],
  latin: ["latin", "reggaeton", "salsa", "brazil", "flamenco", "afro", "arabic", "balkan", "dancehall"],
  reggae: ["reggae", "ska"],
};
// Grundstimmung jedes Stils (home): passt das Gefühl des Teils dazu, bleibt die eigene Lichtsprache vorn,
// sonst leiht sich die Regie eher Szenen anderer Stile (eine traurige Bridge im House bekommt Balladenlicht)
const HOME = { edm: "euphoric", house: "happy", techno: "tense", trance: "euphoric", dnb: "tense", dubstep: "aggressive", trap: "dark", hiphop: "tense", rock: "triumphant", metal: "aggressive", pop: "happy", ballad: "tender", calm: "calm", latin: "happy", reggae: "happy" };
for (const [s, m] of Object.entries(HOME)) SIG[s].home = m;
const SIG_OF = {};
for (const [s, keys] of Object.entries(STYLE)) for (const k of keys) SIG_OF[k] = s;
const sigOf = (key) => ({ ...BASE, ...SIG[SIG_OF[key] || "pop"], name: SIG_OF[key] || "pop" });

/* ---- Gefühl → Look (mood.js schätzt das Gefühl je Teil) */
// hue/k = Farbwelt, in die die Palette gezogen wird, und wie stark · sat/con/lum/warm = Farbkorrektur (lum hebt
// Richtung Pastell bzw. senkt ins Dunkle) · speed = Bewegungstempo · haze = Nebel · soft = wie weich ein Schlag
// ausklingt (1 = lang und weich, 0 = kurz und hart) · spread = Breite der Lichtkegel · crowd = wie viel sich das
// Publikum bewegt · fx = Teilcheneffekt (Funken, langsamer Lichtregen, kurze harte Lichtstöße – nie Blitze) ·
// flash = höchstens so viele Farbflächen (nimmt nur weg, gibt nie mehr als der Teil erlaubt)
const MOOD = {
  euphoric: { hue: 310, k: 0.12, sat: 1.15, con: 1.04, lum: 0.02, warm: 0, speed: 1.1, haze: 0.9, soft: 0, spread: 1.1, crowd: 1.15, fx: "sparks", flash: 1 },
  happy: { hue: 45, k: 0.22, sat: 1.08, con: 1, lum: 0.03, warm: 0.15, speed: 1, haze: 0.95, soft: 0.2, spread: 1.05, crowd: 1.05, fx: "sparks", flash: 1 },
  triumphant: { hue: 42, k: 0.5, sat: 1.05, con: 1.05, lum: 0.02, warm: 0.25, speed: 0.95, haze: 1.05, soft: 0.15, spread: 1.2, crowd: 1.05, fx: "sparks", flash: 1 },
  tender: { hue: 335, k: 0.35, sat: 0.72, con: 0.95, lum: 0.08, warm: 0.1, speed: 0.8, haze: 1.15, soft: 0.75, spread: 1.3, crowd: 0.7, fx: "rain", flash: 0.5 },
  dreamy: { hue: 270, k: 0.45, sat: 0.7, con: 0.94, lum: 0.08, warm: 0, speed: 0.78, haze: 1.35, soft: 0.8, spread: 1.35, crowd: 0.7, fx: "rain", flash: 0 },
  calm: { hue: 190, k: 0.25, sat: 0.75, con: 0.95, lum: 0.03, warm: 0, speed: 0.72, haze: 1.2, soft: 0.85, spread: 1.25, crowd: 0.6, fx: "rain", flash: 0 },
  melancholic: { hue: 232, k: 0.55, sat: 0.85, con: 0.98, lum: -0.03, warm: -0.15, speed: 0.8, haze: 1.25, soft: 0.7, spread: 1.2, crowd: 0.7, fx: "rain", flash: 0.5 },
  sad: { hue: 222, k: 0.6, sat: 0.65, con: 0.95, lum: -0.06, warm: -0.25, speed: 0.7, haze: 1.3, soft: 0.85, spread: 1.15, crowd: 0.6, fx: "rain", flash: 0 },
  tense: { hue: 280, k: 0.3, sat: 0.95, con: 1.08, lum: -0.04, warm: -0.15, speed: 1, haze: 1.1, soft: 0.1, spread: 0.8, crowd: 0.95, fx: "hits", flash: 1 },
  aggressive: { hue: 2, k: 0.55, sat: 1.15, con: 1.12, lum: -0.02, warm: 0.1, speed: 1.12, haze: 0.85, soft: 0, spread: 0.75, crowd: 1.15, fx: "hits", flash: 1 },
  dark: { hue: 262, k: 0.45, sat: 0.9, con: 1.08, lum: -0.08, warm: -0.2, speed: 0.9, haze: 1.2, soft: 0.3, spread: 0.8, crowd: 0.85, fx: "hits", flash: 0.5 },
};

/* ---- Szenen: Lichtbilder, zwischen denen die Regie innerhalb eines Songs wechselt */
// Jede Szene passt zu einigen Stimmungen und stammt aus einigen Stilen (from). spot = Bühnenlicht der Location
// (null = das des Genre-Profils), rig = Muster der Moving Heads, hue = Drehung der Farbwelt, spread = Kegelbreite,
// borrow = Stil-Signaturen, die sie mitbringt (Atmen der Ballade, Pumpen des House, Lichtwand des Rock …).
// „own“ ist die eigene Lichtsprache des Genres.
const SCENES = [
  { id: "own", from: [], moods: [], spot: null, rig: null },
  { id: "festival", from: ["edm", "trance", "pop"], moods: ["euphoric", "happy", "triumphant"], spot: "cross", rig: "fan", spread: 1.1 },
  { id: "aurora", from: ["trance", "techno", "calm"], moods: ["dreamy", "euphoric", "calm", "tender"], spot: "aurora", rig: "wave", hue: 18, spread: 1.25 },
  { id: "discoball", from: ["house", "pop", "latin"], moods: ["happy", "euphoric"], spot: "disco", rig: "wave", hue: -12, spread: 1 },
  { id: "sunset", from: ["latin", "reggae", "house", "pop"], moods: ["happy", "tender", "triumphant"], spot: "pan", rig: "wave", hue: 24, spread: 1.15 },
  { id: "tunnel", from: ["dnb", "edm", "techno"], moods: ["euphoric", "tense", "aggressive"], spot: "tunnel", rig: "cross", hue: -24, spread: 0.85 },
  { id: "scanner", from: ["techno", "house", "dnb"], moods: ["tense", "dark", "dreamy", "calm"], spot: "scan", rig: "chase", spread: 0.8, borrow: { scan: 1 } },
  { id: "arena", from: ["rock", "metal", "pop"], moods: ["triumphant", "aggressive", "euphoric"], spot: "top", rig: "fan", borrow: { wall: 0.8 } },
  { id: "stab", from: ["metal", "rock", "dubstep"], moods: ["aggressive", "dark", "tense"], spot: "top", rig: "point", spread: 0.7 },
  { id: "inferno", from: ["metal", "trap", "dubstep", "hiphop"], moods: ["aggressive", "dark"], spot: "floor", rig: "chase", spread: 0.8, borrow: { boom: 0.6 } },
  { id: "undertow", from: ["trap", "hiphop", "dubstep"], moods: ["dark", "tense", "melancholic"], spot: "floor", rig: "point", spread: 0.9, borrow: { boom: 0.4 } },
  { id: "lighters", from: ["ballad", "rock", "pop"], moods: ["tender", "melancholic", "triumphant", "sad"], spot: "soft", rig: "wave", spread: 1.35, borrow: { swell: 1, vox: 1 } },
  { id: "moonlight", from: ["ballad", "calm"], moods: ["sad", "melancholic", "calm"], spot: "top", rig: "point", spread: 1.2, borrow: { swell: 0.7, vox: 1 } },
  { id: "rain", from: ["calm", "ballad", "techno"], moods: ["sad", "melancholic", "dreamy"], spot: "soft", rig: "wave", hue: -12, spread: 1.3, borrow: { swell: 0.5 } },
  { id: "haze", from: ["calm", "trance", "ballad"], moods: ["dreamy", "calm", "tender"], spot: "aurora", rig: "fan", hue: 30, spread: 1.4, borrow: { swell: 0.8 } },
  { id: "pulse", from: ["house", "edm", "techno"], moods: ["happy", "euphoric", "tense"], spot: "pan", rig: "chase", spread: 0.95, borrow: { pump: 0.8 } },
  { id: "fiesta", from: ["latin", "reggae", "pop"], moods: ["happy", "euphoric"], spot: "pan", rig: "wave", hue: 36, borrow: { sync: 0.7 } },
  { id: "gold", from: ["pop", "rock", "ballad", "edm"], moods: ["triumphant", "euphoric"], spot: "top", rig: "fan", spread: 1.15, borrow: { vox: 0.8 } },
  { id: "noir", from: ["techno", "trap", "metal", "calm"], moods: ["dark", "tense", "melancholic"], spot: "scan", rig: "point", hue: 12, spread: 0.75 },
];
// verwandte Stile: von ihnen leiht die Regie leichter
const NEAR = {
  edm: ["trance", "house", "pop", "dnb"], house: ["edm", "pop", "latin", "techno"], techno: ["house", "trance", "dnb"], trance: ["edm", "techno", "calm"],
  dnb: ["edm", "techno", "dubstep"], dubstep: ["dnb", "trap", "metal"], trap: ["hiphop", "dubstep"], hiphop: ["trap", "pop"], rock: ["metal", "pop", "ballad"],
  metal: ["rock", "dubstep"], pop: ["edm", "house", "ballad", "rock"], ballad: ["calm", "pop", "rock"], calm: ["ballad", "trance"], latin: ["reggae", "pop", "house"], reggae: ["latin", "calm"],
};
// billige Bühnenlichter (Leicht: nur diese, die Discokugel und das Polarlicht bleiben dem Genre vorbehalten)
const CHEAP = new Set(["soft", "top", "pan", "floor", "cross", "scan"]);
// fester Zufall je Song: aus der Analyse selbst (gleicher Song → dieselben Szenen, auch nach dem Neustart)
function seedOf(d) {
  let h = 2166136261;
  const mix = (v) => (h = Math.imul(h ^ (Math.round(v * 10) | 0), 16777619));
  mix(d.segs?.length || 0);
  mix(d.beats?.length || 0);
  mix(d.bpm || 0);
  for (let i = 0; i < Math.min(64, d.segs?.length || 0); i++) mix(d.segs[i].l);
  return h >>> 0;
}
function rngOf(seed) {
  let x = seed || 1;
  return () => {
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Szene wählen: passt zur Stimmung (und zum Stil – fremde nur, wenn das Gefühl passt), nie dieselbe wie eben,
// selten gezeigte bevorzugt (so wechselt die Regie durch statt immer dieselben zwei)
function pickScene(emo, sig, rng, uses, lastId) {
  const cand = [];
  let tot = 0;
  for (const s of SCENES) {
    if (s.id === lastId) continue;
    let mf, sf;
    if (s.id === "own") {
      const h = PROTO[sig.home || "happy"];
      mf = clamp(1 - Math.hypot(emo.v - h[0], emo.a - h[1]) / 1.1, 0.05, 0.9);
      sf = 1;
    } else {
      const mi = s.moods.indexOf(emo.name);
      mf = mi === 0 ? 1 : mi > 0 ? 0.8 : s.moods.includes(emo.alt) ? 0.2 : 0;
      sf = s.from.includes(sig.name) ? 1 : (NEAR[sig.name] || []).some((x) => s.from.includes(x)) ? 0.6 : 0.3;
    }
    if (!mf) continue;
    // hoch drei: gut Passendes klar vorn, Abwechslung nur unter dem, was wirklich passt
    const w = (mf * sf) ** 3 / (1 + 1.5 * (uses[s.id] || 0));
    cand.push([s, w]);
    tot += w;
  }
  let r = rng() * tot;
  for (const [s, w] of cand) if ((r -= w) <= 0) return s;
  return cand.length ? cand[cand.length - 1][0] : SCENES[0];
}

// nächster Wert in einer sortierten Zahlenliste
function nearest(arr, t) {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] < t) lo = m + 1;
    else hi = m;
  }
  return lo > 0 && Math.abs(arr[lo - 1] - t) <= Math.abs(arr[lo] - t) ? arr[lo - 1] : arr[lo];
}
// Schlagposition als Kommazahl (3,5 = halb zwischen dem 4. und 5. Schlag)
function beatPos(beats, sec, beat) {
  const i = seek(beats, sec, "t");
  if (i < 0) return (sec - (beats[0]?.t || 0)) / beat;
  const b = beats[i], nx = beats[i + 1];
  return i + (nx ? clamp((sec - b.t) / Math.max(0.05, nx.t - b.t), 0, 1) : (sec - b.t) / beat);
}

/* ---- Planung: einmal pro Song und Stil */
// o: { feat: Spotifys Audio-Merkmale { valence, energy, dance }, lyrics: [{ t (s), text }] } – beides optional
function planSong(d, key, o = {}) {
  const sig = sigOf(key), M = songMap(d), beats = d.beats || [];
  if (beats.length < 8 || !M.energy.length) return null;
  const gaps = beats.slice(1, 200).map((b, i) => b.t - beats[i].t).filter((g) => g > 0.2 && g < 2).sort((a, b) => a - b);
  const beat = gaps.length ? gaps[gaps.length >> 1] : 60 / (d.bpm || 120), bar = beat * 4;
  // Taktanfänge: Spotifys Takte, sonst jeder vierte Schlag
  const bars = d.bars?.length >= 4 ? d.bars.map((b) => b.t) : beats.filter((_, i) => i % 4 === 0).map((b) => b.t);
  const end = Math.max(M.energy.length * STEP, beats[beats.length - 1].t + beat);
  const mean = (a, b) => {
    let s = 0, n = 0;
    for (let t = a; t < b; t += STEP, n++) s += at(M.energy, t);
    return n ? s / n : at(M.energy, a);
  };
  // 1. Grenzen: Spotifys Abschnitte, sonst (Schätzung, ein einziger Abschnitt) Sprünge der Energie je 8 Takte;
  // dazu jeder Drop. Abschnittsgrenzen rutschen auf die nächste Eins, Drops bleiben auf ihrem Schlag.
  const cand = [];
  if (M.sections.length > 1) for (const s of M.sections) s.t > bar && cand.push({ t: nearest(bars, s.t), drop: false });
  else {
    let prev = -1;
    for (let i = 0; i + 8 < bars.length; i += 8) {
      const e = mean(bars[i], bars[i + 8]);
      if (prev >= 0 && Math.abs(e - prev) > 0.14) cand.push({ t: bars[i], drop: false });
      prev = e;
    }
  }
  for (const t of M.drops) cand.push({ t, drop: true });
  cand.sort((a, b) => a.t - b.t);
  const cuts = [];
  for (const c of cand) {
    if (c.t < bar || c.t > end - bar) continue;
    const last = cuts[cuts.length - 1];
    // zu dicht (unter zwei Takten): der Drop gewinnt, sonst die frühere Grenze
    if (last && c.t - last.t < bar * 2 - 0.05) {
      if (c.drop && !last.drop) cuts[cuts.length - 1] = c;
      continue;
    }
    cuts.push(c);
  }
  // 2. Teile mit ihrer Energie (Mitte, Anfang, Ende) und Tonart
  const tonart = (t) => M.sections[Math.max(0, seek(M.sections, t + 0.1, "t"))] || {};
  const parts = [{ t: 0, drop: false }, ...cuts].map((c, i, all) => {
    // Tonart einen Takt nach dem Anfang: der Teil beginnt auf der Eins, Spotifys Abschnitt oft knapp danach
    const t1 = all[i + 1]?.t ?? end, s = tonart(Math.min(c.t + bar, (c.t + t1) / 2));
    return { t0: c.t, t1, drop: c.drop, e: mean(c.t, t1), key: s.key ?? -1, mode: s.mode ?? 1 };
  });
  // Haupttonart = die Tonart, die am längsten klingt (eine Bridge wechselt oft weg)
  const keyTime = {};
  for (const p of parts) keyTime[p.key + "/" + p.mode] = (keyTime[p.key + "/" + p.mode] || 0) + p.t1 - p.t0;
  const mainKey = Object.entries(keyTime).sort((a, b) => b[1] - a[1])[0][0];
  // 3. Einordnen – relativ zum Song selbst: sein lautester Teil ist Refrain/Drop, leise Teile in einem
  // dynamischen Song sind Breaks
  const eMax = Math.max(...parts.map((p) => p.e)), eMin = Math.min(...parts.map((p) => p.e));
  const hiT = Math.max(0.55, eMax - 0.16), loT = Math.min(0.38, eMin + 0.1);
  const last = parts.length - 1;
  parts.forEach((p, i) => {
    p.kind = p.drop && sig.drops ? "drop"
      : p.e >= hiT || p.drop ? "chorus"
      : i === 0 ? "intro"
      : i === last && p.t0 > end * 0.7 ? "outro"
      : p.e < loT && M.dynamic ? "break"
      : "verse";
  });
  // Bridge: (nur ohne Drop-Dramaturgie) ein ruhigerer Teil nach mindestens einem Refrain, vor dem letzten,
  // in einer anderen Tonart oder (eine Strophe) nach dem zweiten Refrain. Ein Break in derselben Tonart bleibt Break.
  const peak = (p) => p && (p.kind === "chorus" || p.kind === "drop");
  if (!sig.drops) {
    let seen = 0;
    const lastPeak = parts.map(peak).lastIndexOf(true);
    parts.forEach((p, i) => {
      if (peak(p)) seen++;
      else if (seen >= 1 && i < lastPeak && p.t0 > end * 0.4 && ((p.kind === "verse" && seen >= 2) || ((p.kind === "verse" || p.kind === "break") && p.key + "/" + p.mode !== mainKey))) p.kind = "bridge";
    });
  }
  // Pre-Chorus/Aufbau vor einem Höhepunkt: eine kurze Strophe (bis 4 Takte), ein ansteigender Teil bis 8 Takte,
  // oder die letzten Takte eines langen Teils (8 bei dramatischen Stilen, sonst 4). Ein Break bleibt Break,
  // solange er nicht ansteigt – die Pause vor dem Drop gehört dazu
  for (let i = parts.length - 2; i > 0; i--) {
    const p = parts[i];
    if (!peak(parts[i + 1]) || (p.kind !== "verse" && p.kind !== "break")) continue;
    const len = Math.round((p.t1 - p.t0) / bar), take = sig.drama >= 0.5 && len >= 16 ? 8 : 4;
    const tail = p.t1 - take * bar, rising = mean(Math.max(p.t0, tail), p.t1) - mean(p.t0, Math.min(p.t1, p.t0 + 4 * bar)) > 0.1;
    // (ein kurzer Teil direkt vor dem Drop oder deutlich lauter als der Teil davor – außer dem Intro – ist Aufbau)
    const lift = parts[i + 1].kind === "drop" || (parts[i - 1].kind !== "intro" && p.e > parts[i - 1].e + 0.12);
    if ((len <= 4 && p.kind === "verse") || (len <= 8 && (rising || lift))) p.kind = "pre";
    else if (len >= 12 && (p.kind === "verse" || rising)) {
      const tSplit = nearest(bars, tail);
      if (tSplit - p.t0 >= bar * 2) {
        const q = { ...p, t0: tSplit, drop: false, kind: "pre", e: mean(tSplit, p.t1) };
        p.t1 = tSplit;
        p.e = mean(p.t0, p.t1);
        parts.splice(i + 1, 0, q);
      }
    }
  }
  // 4. Gefühl je Teil (mood.js): färbt, beschleunigt oder beruhigt den Look des Teils
  const emo = songMood(d, parts, o);
  parts.forEach((p, i) => (p.emo = emo.parts[i]));
  // 5. Look, Zeitgefühl und Übergänge je Teil
  const dev = (v, k) => 1 + (v - 1) * k;
  let n = 0, mt = 0, mb = 0;
  parts.forEach((p, i) => {
    const L = LOOK[p.kind], c = sig.contrast, E = p.emo, Mo = MOOD[E.name], k = E.conf, f = (v) => dev(v, k);
    // Antrieb: wie viel Pumpen, 808 und Tresillo bleibt – eine traurige Bridge pumpt kaum noch
    const drive = f(0.35 + 0.65 * clamp((E.a + 1) / 1.4, 0, 1));
    p.look = {
      I: dev(L.I, c) * (1 + 0.1 * E.a * k), speed: clamp(dev(L.speed, c) * sig.speed * f(Mo.speed) * (1 + 0.1 * E.a * k), 0.25, 1.8),
      sat: dev(L.sat, c) * sig.sat * f(Mo.sat) * (1 + 0.08 * E.a * k), con: dev(L.con, c) * f(Mo.con), beams: dev(L.beams, c), sparks: dev(L.sparks, c),
      warm: clamp(L.warm + sig.warm + (Mo.warm + 0.15 * E.v) * k, -1, 1), hue: L.hue, flash: Math.min(L.flash, Mo.flash), fx: L.fx, haze: L.haze * f(Mo.haze),
      // Farbwelt der Stimmung als Vektor (so überblendet sie über 0°/360° hinweg ohne Umweg über alle Farben)
      tx: Math.cos((Mo.hue * Math.PI) / 180) * Mo.k * k, ty: Math.sin((Mo.hue * Math.PI) / 180) * Mo.k * k, lum: Mo.lum * k,
      soft: Mo.soft * k + 0.2 * (1 - k), spread: f(Mo.spread), crowd: f(Mo.crowd), drive,
    };
    p.fxk = Mo.fx;
    p.tf = p.kind === "break" ? sig.tfBreak : p.kind === "drop" ? sig.tfDrop : p.kind === "chorus" ? sig.tfChorus : 1;
    p.n = peak(p) ? ++n : 0;
    // Überblendung höchstens über die halbe Länge des Teils
    p.fade = Math.min(L.glide * bar, (p.t1 - p.t0) / 2);
    const prev = parts[i - 1], next = parts[i + 1];
    // Lichtwisch beim Wechsel in eine neue Farbwelt (nicht zwischen zwei gleichen Teilen, außer auf einem Drop)
    p.wipe = !!L.swap && !!prev && (prev.kind !== p.kind || p.drop);
    // Aufbau: Riser bis zum Höhepunkt; der letzte Schlag davor wird dunkel (vor dem Drop ganz, vor einem
    // Refrain nur bei dramatischen Stilen und halb)
    p.riser = p.kind === "pre" && peak(next);
    p.dim = next?.kind === "drop" ? 1 : p.riser && next?.kind === "chorus" && sig.drama >= 0.5 ? 0.6 : 0;
    // Bewegungsuhren: mt (Sekunden mal Tempo) und mb (Schläge mal Zeitgefühl) laufen stetig weiter,
    // nur ihre Geschwindigkeit wechselt – so springt kein Licht, es wird nur langsamer oder schneller
    p.s0 = prev ? prev.look.speed : p.look.speed;
    p.mt0 = mt;
    p.b0 = beatPos(beats, p.t0, beat);
    p.mb0 = mb;
    const len = p.t1 - p.t0, F = p.fade;
    mt += p.look.speed * len - (p.look.speed - p.s0) * (F / 2);
    mb += (beatPos(beats, p.t1, beat) - p.b0) * p.tf;
    p.kindIdx = KINDS.indexOf(p.kind);
  });
  const scenes = planScenes(parts, bars, bar, beat, sig, seedOf(d));
  return { parts, scenes, beat, bar, bars, beats, end, sig, emo, holds: M.holds, drops: M.drops };
}

/* ---- Szenenfolge: einmal pro Song, fester Zufall aus der Analyse */
// Eine neue Szene beginnt mit einem Teil (wenn seit der letzten mindestens 8 Takte vergangen sind – ein Drop
// darf immer) und innerhalb langer Teile an Phrasengrenzen: alle 8 Takte, wenn es aufgedreht ist, sonst alle 16.
// Jede Grenze ist eine Eins aus der Taktliste (ein Drop sein Schlag). Wechsel in der Mitte eines Teils: aufgedreht
// mit Lichtwisch auf der Eins, ruhig als Überblendung über zwei Takte.
function planScenes(parts, bars, bar, beat, sig, seed) {
  const rng = rngOf(seed), uses = {}, out = [];
  let last = null, lastT = -1e9;
  const barIdx = (t) => {
    let lo = 0, hi = bars.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (bars[m] < t - 0.01) lo = m + 1;
      else hi = m;
    }
    return lo;
  };
  const add = (t, p, mid) => {
    const s = pickScene(p.emo, sig, rng, uses, last?.id);
    uses[s.id] = (uses[s.id] || 0) + 1;
    // jede Szene etwas anders getönt (±12°, in 6°-Stufen), damit zwei Songs mit denselben Szenen nicht gleich aussehen
    const sh = (s.hue || 0) + Math.round((rng() - 0.5) * 4) * 6;
    const wipe = mid ? p.emo.a > 0.3 : p.wipe;
    last = { t0: t, id: s.id, sc: out.length, spot: s.spot, rig: s.rig, sh, spread: s.spread || 1, borrow: s.borrow || {}, mid, wipe, fade: mid ? (wipe ? beat : bar * 2) : Math.max(p.fade, p.drop ? 0 : beat) };
    out.push(last);
    lastT = t;
  };
  parts.forEach((p, i) => {
    // ein Aufbau direkt vor dem Höhepunkt behält seine Szene – die neue kommt mit dem Höhepunkt
    const peakNext = p.kind === "pre" && (parts[i + 1]?.kind === "chorus" || parts[i + 1]?.kind === "drop");
    if (!out.length || p.kind === "drop" || (!peakNext && p.t0 - lastT >= bar * 8 - 0.05)) add(p.t0, p, false);
    const phrase = p.emo.a > 0.25 ? 8 : 16;
    // Phrasen zählen ab der Eins, auf der der Teil beginnt
    for (let j = barIdx(p.t0) + phrase; j < bars.length; j += phrase) {
      const t = bars[j];
      // der nächste Teil muss noch mindestens 8 Takte entfernt sein (sonst wechselt er selbst)
      if (t + bar * 8 > p.t1 + 0.05) break;
      if (t - lastT >= bar * 8 - 0.05) add(t, p, true);
    }
  });
  return out;
}

/* ---- pro Bild: der Zustand zur Songzeit */
// o: { noFlash, level (1..5), lite (Leicht: weniger, billigere Effekte) }
const ease = (x) => x * x * (3 - 2 * x);
const q = (v, s) => Math.round(v / s) * s;
const LEVEL = [0.7, 0.85, 1, 1.1, 1.2];
function cue(plan, sec, o = {}) {
  if (!plan) return null;
  const { parts, beat, bar, sig } = plan;
  let i = 0;
  for (let lo = 0, hi = parts.length - 1; lo <= hi; ) {
    const m = (lo + hi) >> 1;
    if (parts[m].t0 <= sec) [i, lo] = [m, m + 1];
    else hi = m - 1;
  }
  const P = parts[i], Q = parts[i - 1] || P, x = sec - P.t0;
  const m = P.fade > 0 ? ease(clamp(x / P.fade, 0, 1)) : 1;
  const lv = LEVEL[clamp(Math.round(o.level || 3), 1, 5) - 1];
  const mix = (k) => Q.look[k] + (P.look[k] - Q.look[k]) * m;
  const dev = (k) => 1 + (mix(k) - 1) * lv;
  const bp = beatPos(plan.beats, sec, beat);
  // Riser: wird zum Ende des Aufbaus dichter (Viertel → Achtel → Sechzehntel, höchstens 6 Pulse/s);
  // ohne Blitze ein ruhiges Anschwellen statt Pulsen
  let riser = 0, pulse = 0;
  if (P.riser) {
    riser = clamp(x / (P.t1 - P.t0), 0, 1) ** 1.5;
    const toEnd = P.t1 - sec;
    let rate = toEnd < bar ? 4 : toEnd < bar * 2 ? 2 : 1;
    while (rate > 1 && rate / beat > 6) rate /= 2;
    pulse = o.noFlash ? riser : riser * Math.exp(-((((bp * rate) % 1) + 1) % 1) * 3.5);
  }
  const toEnd = P.t1 - sec, dim = P.dim && toEnd > 0.02 && toEnd < beat * 0.95 ? P.dim : 0;
  // Einsatz eines Höhepunkts: der erste Refrain hebt am stärksten an, jeder weitere etwas weniger
  const lift = P.n ? (P.n === 1 ? 1 : 0.6) * Math.exp(-x / bar) : 0;
  // Verfolger-Spot: ein gehaltener Ton (ab 0,3 s anschwellend, nach dem Ende 0,5 s ausklingend)
  // (Hüllkurve 0..1 – die Stärke kommt vom Stil oder von der Szene, siehe unten)
  let vox = 0;
  if (!o.lite) {
    let h = null;
    for (let lo = 0, hi = plan.holds.length - 1; lo <= hi; ) {
      const k = (lo + hi) >> 1;
      if (plan.holds[k][0] <= sec) [h, lo] = [plan.holds[k], k + 1];
      else hi = k - 1;
    }
    if (h && sec < h[1] + 0.5) vox = clamp((sec - h[0] - 0.3) / 1.2, 0, 1) * (sec > h[1] ? 1 - (sec - h[1]) / 0.5 : 1);
  }
  const F = Math.max(P.fade, 1e-6), xm = Math.max(0, x);
  const mt = sec < 0 ? sec : P.mt0 + (xm < F ? P.s0 * xm + ((P.look.speed - P.s0) * xm * xm) / (2 * F) : P.look.speed * xm - ((P.look.speed - P.s0) * F) / 2);
  // Szene (planScenes): Bühnenlicht, Muster, Tönung und geliehene Signaturen; der Übergang gleitet über sx
  const SC = plan.scenes || [];
  let j = 0;
  for (let lo = 0, hi = SC.length - 1; lo <= hi; ) {
    const k = (lo + hi) >> 1;
    if (SC[k].t0 <= sec) [j, lo] = [k, k + 1];
    else hi = k - 1;
  }
  const S = SC[j] || NOSCENE, S0 = SC[j - 1] || S, xs = sec - S.t0;
  const sx = S.fade > 0 ? ease(clamp(xs / S.fade, 0, 1)) : 1, b0 = S0.borrow, b1 = S.borrow;
  const drive = mix("drive"), tx = mix("tx"), ty = mix("ty");
  const wSc = !o.lite && S.mid && S.wipe && xs >= 0 && xs < beat ? xs / beat : -1;
  const wall = Math.max(sig.wall, lerpB(b0, b1, "wall", sx));
  // Farbkorrektur in groben Stufen: gleitet über die Takte, ohne jedes Bild neue Farben (und Leuchtbilder) zu brauchen.
  // th/tk = Farbwelt der Stimmung und ihre Stärke, lum = Pastell/Dunkel, sh = Tönung der Szene.
  // Unverändert → dasselbe Objekt wie im Bild davor (grade() erkennt es dann ohne Vergleich)
  const g = plan.g || (plan.g = {}), gs = q(dev("sat"), 0.04), gc = q(dev("con"), 0.04), gw = q(mix("warm"), 0.05), gh = q(mix("hue"), 6);
  const th = q(((Math.atan2(ty, tx) * 180) / Math.PI + 360) % 360, 6), tk = q(Math.hypot(tx, ty), 0.05), lum = q(mix("lum"), 0.02), sh = q(S0.sh + (S.sh - S0.sh) * sx, 6);
  if (g.sat !== gs || g.con !== gc || g.warm !== gw || g.hue !== gh || g.th !== th || g.tk !== tk || g.lum !== lum || g.sh !== sh) plan.g = { sat: gs, con: gc, warm: gw, hue: gh, th, tk, lum, sh };
  return {
    i, kind: P.kind, sect: P.kindIdx, n: P.n, mix: m,
    I: dev("I"), speed: dev("speed"), beams: dev("beams"), sparks: dev("sparks"),
    grade: plan.g,
    flash: o.noFlash ? 0 : m < 0.5 ? Q.look.flash : P.look.flash,
    fx: mix("fx"), haze: mix("haze"), tf: P.tf,
    wipe: !o.lite && P.wipe && x >= 0 && x < beat ? x / beat : wSc, wdir: (i + S.sc) % 2 ? -1 : 1,
    riser, pulse, dim, lift,
    wall: wall && P.kind === "chorus" && !o.noFlash && !o.lite ? wall * Math.exp(-x / (beat * 0.5)) : 0,
    vox: vox * Math.max(sig.vox, lerpB(b0, b1, "vox", sx)),
    swell: Math.max(sig.swell, lerpB(b0, b1, "swell", sx)) * (0.5 - 0.5 * Math.cos((Math.PI * bp) / 4)),
    pump: Math.max(sig.pump, lerpB(b0, b1, "pump", sx)) * drive, boom: Math.max(sig.boom, lerpB(b0, b1, "boom", sx)) * drive,
    sync: Math.max(sig.sync, lerpB(b0, b1, "sync", sx)) * drive, scan: Math.max(sig.scan, lerpB(b0, b1, "scan", sx)),
    mt, mb: P.mb0 + (bp - P.b0) * P.tf, bp,
    // Gefühl und Szene: Stimmung des Teils, Weichheit der Schläge, Kegelbreite, Publikum, Teilcheneffekt
    mood: P.emo.name, v: Q.emo.v + (P.emo.v - Q.emo.v) * m, a: Q.emo.a + (P.emo.a - Q.emo.a) * m,
    soft: mix("soft"), spread: mix("spread") * (S0.spread + (S.spread - S0.spread) * sx), crowd: mix("crowd"), fxk: P.fxk,
    // „Leicht“: nur billige Bühnenlichter, kein Überblenden zweier Lichter
    sc: S.sc, scene: S.id, spot: spotOf(S, o.lite), spot2: spotOf(o.lite ? S : S0, o.lite), sx: o.lite ? 1 : sx, rig: S.rig || "",
  };
}
const lerpB = (b0, b1, k, f) => (b0[k] || 0) + ((b1[k] || 0) - (b0[k] || 0)) * f;
const spotOf = (s, lite) => (s.spot && (!lite || CHEAP.has(s.spot)) ? s.spot : "");
const NOSCENE = { t0: 0, id: "", sc: 0, spot: null, rig: null, sh: 0, spread: 1, borrow: {}, mid: false, wipe: false, fade: 0 };

/* ---- Farbkorrektur der Palette */
const rgb2hsl = ([r, g, b]) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
  if (!dd) return [0, 0, l];
  const s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
  const h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
  return [h * 60, s, l];
};
const hsl2rgb = ([h, s, l]) => {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};
const toward = (h, target, f) => (h + ((((target - h) % 360) + 540) % 360 - 180) * f + 360) % 360;
let gradeKey = "", gradeIn = null, gradeOut = null;
// Sättigung, Kontrast (Helligkeit um die Mitte gespreizt), Temperatur (Richtung Bernstein bzw. Eisblau)
// und Farbwelt (Drehung des Farbkreises, z. B. in der Bridge). Ergebnis gemerkt, solange sich nichts ändert.
// Dazu die Stimmung: die Palette wird in ihre Farbwelt gezogen (th, Stärke tk – die drei Farben bleiben je 26°
// auseinander, damit es nicht einfarbig wird), lum hebt ins Pastell oder senkt ins Dunkle; sh = Tönung der Szene.
let gradeG = null;
function grade(pal, g) {
  if (!g) return pal;
  // dasselbe Objekt wie eben (cue() gibt es zurück, solange sich nichts ändert): ohne Vergleich fertig
  if (g === gradeG && pal === gradeIn) return gradeOut;
  if (g.sat === 1 && g.con === 1 && !g.warm && !g.hue && !g.tk && !g.lum && !g.sh) return pal;
  const key = g.sat + "|" + g.con + "|" + g.warm + "|" + g.hue + "|" + (g.th || 0) + "|" + (g.tk || 0) + "|" + (g.lum || 0) + "|" + (g.sh || 0);
  gradeG = g;
  if (pal === gradeIn && key === gradeKey) return gradeOut;
  [gradeIn, gradeKey] = [pal, key];
  gradeOut = pal.map((c, i) => {
    let [h, s, l] = rgb2hsl(c);
    h = (h + g.hue + (g.sh || 0) + 360) % 360;
    if (g.tk) h = toward(h, (g.th + (i - 1) * 26 + 360) % 360, Math.min(0.85, g.tk));
    if (g.warm) h = toward(h, g.warm > 0 ? 32 : 212, Math.abs(g.warm) * 0.3);
    s = clamp(s * g.sat, 0, 1);
    l = clamp(0.5 + (l - 0.5) * g.con + (g.con - 1) * 0.08 + (g.lum || 0), 0.12, 0.88);
    return hsl2rgb([h, s, l]);
  });
  return gradeOut;
}

export { planSong, cue, grade, sigOf, KINDS, LOOK, SIG, STYLE, MOOD, SCENES };
