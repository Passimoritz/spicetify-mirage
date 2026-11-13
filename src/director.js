/* ---------------------------------------------------------------- Lichtregie */
// Wie ein Video-Edit, nur ohne Kamera: einmal pro Song plant die Regie aus der Song-Karte die Teile
// (Intro, Strophe, Pre-Chorus, Refrain, Drop, Break, Bridge, Outro) – jede Grenze liegt auf einer Eins,
// ein Drop genau auf seinem Schlag. Jeder Teil bekommt einen „Look“: Helligkeit, Bewegungstempo,
// Farbkorrektur (Sättigung, Temperatur, Kontrast, Farbwelt), welche Effekte erlaubt sind, wie viel Nebel.
// Pro Bild liefert cue() den Zustand zur Songzeit – rein aus der Zeit berechnet, ohne Gedächtnis: Springen
// im Song, ausgelassene Bilder oder der Hintergrund-Thread können nichts aus dem Takt bringen.
// Die Stile unterscheiden sich nur über eine kurze Signatur (SIG) – keine Sonderfälle im Zeichencode.
import { songMap, at, seek, STEP } from "./songmap.js";

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
const SIG_OF = {};
for (const [s, keys] of Object.entries(STYLE)) for (const k of keys) SIG_OF[k] = s;
const sigOf = (key) => ({ ...BASE, ...SIG[SIG_OF[key] || "pop"], name: SIG_OF[key] || "pop" });

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
function planSong(d, key) {
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
    const t1 = all[i + 1]?.t ?? end, s = tonart(c.t);
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
  // 4. Look, Zeitgefühl und Übergänge je Teil
  const dev = (v, k) => 1 + (v - 1) * k;
  let n = 0, mt = 0, mb = 0;
  parts.forEach((p, i) => {
    const L = LOOK[p.kind], c = sig.contrast;
    p.look = {
      I: dev(L.I, c), speed: dev(L.speed, c) * sig.speed, sat: dev(L.sat, c) * sig.sat, con: dev(L.con, c), beams: dev(L.beams, c), sparks: dev(L.sparks, c),
      warm: clamp(L.warm + sig.warm, -1, 1), hue: L.hue, flash: L.flash, fx: L.fx, haze: L.haze,
    };
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
  return { parts, beat, bar, bars, beats, end, sig, holds: M.holds, drops: M.drops };
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
  let vox = 0;
  if (!o.lite && sig.vox) {
    let h = null;
    for (let lo = 0, hi = plan.holds.length - 1; lo <= hi; ) {
      const k = (lo + hi) >> 1;
      if (plan.holds[k][0] <= sec) [h, lo] = [plan.holds[k], k + 1];
      else hi = k - 1;
    }
    if (h && sec < h[1] + 0.5) vox = sig.vox * clamp((sec - h[0] - 0.3) / 1.2, 0, 1) * (sec > h[1] ? 1 - (sec - h[1]) / 0.5 : 1);
  }
  const F = Math.max(P.fade, 1e-6), xm = Math.max(0, x);
  const mt = sec < 0 ? sec : P.mt0 + (xm < F ? P.s0 * xm + ((P.look.speed - P.s0) * xm * xm) / (2 * F) : P.look.speed * xm - ((P.look.speed - P.s0) * F) / 2);
  return {
    i, kind: P.kind, sect: P.kindIdx, n: P.n, mix: m,
    I: dev("I"), speed: dev("speed"), beams: dev("beams"), sparks: dev("sparks"),
    // Farbkorrektur in groben Stufen: gleitet über die Takte, ohne jedes Bild neue Farben (und Leuchtbilder) zu brauchen
    grade: { sat: q(dev("sat"), 0.04), con: q(dev("con"), 0.04), warm: q(mix("warm"), 0.05), hue: q(mix("hue"), 6) },
    flash: o.noFlash ? 0 : m < 0.5 ? Q.look.flash : P.look.flash,
    fx: mix("fx"), haze: mix("haze"), tf: P.tf,
    wipe: !o.lite && P.wipe && x >= 0 && x < beat ? x / beat : -1, wdir: i % 2 ? -1 : 1,
    riser, pulse, dim, lift,
    wall: sig.wall && P.kind === "chorus" && !o.noFlash && !o.lite ? sig.wall * Math.exp(-x / (beat * 0.5)) : 0,
    vox, swell: sig.swell ? sig.swell * (0.5 - 0.5 * Math.cos((Math.PI * bp) / 4)) : 0,
    pump: sig.pump, boom: sig.boom, sync: sig.sync, scan: sig.scan,
    mt, mb: P.mb0 + (bp - P.b0) * P.tf, bp,
  };
}

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
function grade(pal, g) {
  if (!g || (g.sat === 1 && g.con === 1 && !g.warm && !g.hue)) return pal;
  const key = g.sat + "|" + g.con + "|" + g.warm + "|" + g.hue;
  if (pal === gradeIn && key === gradeKey) return gradeOut;
  [gradeIn, gradeKey] = [pal, key];
  gradeOut = pal.map((c) => {
    let [h, s, l] = rgb2hsl(c);
    h = (h + g.hue + 360) % 360;
    if (g.warm) h = toward(h, g.warm > 0 ? 32 : 212, Math.abs(g.warm) * 0.3);
    s = clamp(s * g.sat, 0, 1);
    l = clamp(0.5 + (l - 0.5) * g.con + (g.con - 1) * 0.08, 0.12, 0.88);
    return hsl2rgb([h, s, l]);
  });
  return gradeOut;
}

export { planSong, cue, grade, sigOf, KINDS, LOOK, SIG, STYLE };
