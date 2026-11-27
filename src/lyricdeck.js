/* ---------------------------------------------------------------- Verspielter Stil: Regiebuch je Song */
// Daten statt hundert CSS-Blöcken. Jede Inszenierung („Rezept“) beschreibt nur, wo ein Wort (oder ein Buchstabe)
// WARTET, bevor es gesungen wird: Versatz, Drehung, Größe, Deckkraft, 3D-Kippen, Neigung, Drehpunkt. Gelandet wird
// immer im Ruhezustand – eine einzige Überblendung in Mirage/user.css („i-playful“) mit der Dauer --pl. Dieselbe Zahl
// ist der Vorlauf: das Wort bekommt .is-sung genau --pl ms VOR seinem Einsatz und steht damit auf dem Einsatz
// still und voll deckend da (Vorlauf = Landedauer, höchstens 180 ms). Was danach kommt (Akzent, Wortbild), beginnt
// erst auf dem Einsatz und startet im Ruhezustand.
// Abwechslung: rund 60 Rezepte × Richtung × Stärke × Kurve × Reihenfolge der Buchstaben. Jeder Song bekommt aus
// seiner Kennung ein eigenes „Deck“ (welche Rezepte je Teil, Leit-Kurven, Schrift-Charakter, Farbstimmung,
// Wortbild-Spielarten) – so sieht jeder Song anders aus, und im Song teilen sich die Refrain-Zeilen ein Motiv.
// Rein rechnend (kein DOM): getestet in tests/unit/lyricstyle.test.js.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r2 = (v) => Math.round(v * 100) / 100;
// fester Zufall aus einem Text (0 … 1)
export function hash01(s) {
  let h = 2166136261;
  const t = String(s);
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100003) / 100003;
}
// kleiner Zufallsgenerator mit Startwert (für das Deck: gleicher Song, gleiches Deck)
export function rng(seed) {
  let a = Math.floor(hash01(seed) * 4294967295) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Kurven (Landung). Alle enden genau auf 1 – Nachfedern nur unterwegs. */
export const EASE = {
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  back: "cubic-bezier(0.2, 1.3, 0.4, 1)",
  expo: "cubic-bezier(0.16, 1, 0.3, 1)",
  snap: "cubic-bezier(0.6, 0, 0.1, 1)",
  smooth: "cubic-bezier(0.45, 0, 0.2, 1)",
  bounce: "cubic-bezier(0.3, 1.7, 0.55, 1)",
  quart: "cubic-bezier(0.25, 1, 0.5, 1)",
};

/* ---- Vorlauf = Landedauer (ms) je Rezept. Nie über 180 ms: lange Auftritte könnten sonst gegen das Singen laufen. */
export const LEAD_MAX = 180;
const LEAD_DEF = 160;

/* ---- Rezepte
   e: Energie 0 (ruhig) … 3 (hart) · lead: Vorlauf/Landedauer · L: Buchstaben-Rezept (Wort wird zerlegt)
   w(c): Wartezustand eines Worts, c = { k, n, side (-1 … 1), alt (±1), dir (±1), amp, h (Zufall je Wort) }
   l(c): Wartezustand eines Buchstabens, c zusätzlich { ci, cn, h }
   acc: Akzent auf dem Einsatz (beginnt im Ruhezustand) · ln: Bewegung der ganzen aktiven Zeile
   wild: nur bei „Wild“ · min/max: Wortzahl der Zeile, für die es taugt
   Werte: x/y in em, r/rx/ry/sk in Grad, s Größe (Zahl oder [x, y]), o Deckkraft, og Drehpunkt */
const R = {
  plain: { e: 0, lead: 140, w: () => ({ y: -0.08 }) },
  fade: { e: 0, lead: 180, w: () => ({ o: 0.3 }) },
  drift: { e: 0, lead: 180, w: (c) => ({ x: 0.2 * c.dir, y: -0.1, o: 0.5 }) },
  glow: { e: 0, lead: 180, w: () => ({ o: 0.45, s: 0.96 }) },
  rise: { e: 1, lead: 170, w: () => ({ y: 0.34, o: 0.7 }) },
  peek: { e: 1, lead: 170, w: () => ({ y: 0.42, o: 0 }) },
  type: { e: 1, lead: 90, w: (c) => ({ o: 0.4, x: -0.06 * c.dir, s: 1.06 }) },
  stagger: { e: 1, lead: 170, min: 3, max: 8, w: (c) => ({ y: c.alt * 0.16, r: c.alt * 2.5 }) },
  stairs: { e: 1, lead: 170, min: 3, max: 8, w: (c) => ({ y: Math.min(0.42, 0.08 * (c.k + 1)), o: 0.6 }) },
  ladder: { e: 1, lead: 170, min: 3, w: (c) => ({ y: ((c.k % 3) - 1) * 0.26, o: 0.65 }) },
  wavel: { e: 1, lead: 170, min: 2, w: (c) => ({ x: -0.45, y: 0.14 * Math.sin(c.k * 1.4), o: 0.5 }) },
  waver: { e: 1, lead: 170, min: 2, w: (c) => ({ x: 0.45, y: 0.14 * Math.sin(c.k * 1.4), o: 0.5 }) },
  wavec: { e: 1, lead: 170, min: 3, w: (c) => ({ x: -c.side * 0.45, o: 0.5 }) },
  conveyor: { e: 1, lead: 170, w: (c) => ({ x: 0.55 * c.dir, o: 0.3 }) },
  lean: { e: 1, lead: 160, w: (c) => ({ sk: 14 * c.dir, x: 0.15 * c.dir, o: 0.6 }) },
  accordion: { e: 1, lead: 170, w: () => ({ s: [0.15, 1], o: 0.4, og: "left center" }) },
  unfold: { e: 1, lead: 180, w: (c) => ({ ry: 88 * c.dir, o: 0.2, og: c.dir > 0 ? "left center" : "right center" }) },
  zoomin: { e: 1, lead: 170, w: () => ({ s: 0.25, o: 0 }) },
  tidal: { e: 1, lead: 180, w: (c) => ({ y: 0.3 * (0.5 + 0.5 * Math.sin(c.k)), o: 0.55 }), ln: "tide" },
  pendulum: { e: 1, lead: 180, w: (c) => ({ r: -18 * c.dir, og: "center top", o: 0.6 }), ln: "pend" },
  tilt: { e: 1, lead: 160, w: (c) => ({ r: 3 * c.dir, o: 0.75 }), ln: "tilt" },
  neon: { e: 1, lead: 180, w: () => ({ o: 0.08 }), acc: "neon" },
  // Fächer: die Wörter stehen wie ein Kartenfächer gespreizt (außen stärker gekippt) und richten sich auf
  fan: { e: 1, lead: 180, min: 3, max: 9, ease: "back", w: (c) => ({ r: 14 * c.side * c.dir, y: 0.1 * Math.abs(c.side), og: "center bottom", o: 0.55 }) },
  // Hintergrundgesang und Wörter in Klammern: kommen leise von der Seite dazu (nie mit dem Auftritt der Hauptzeile).
  // only: steht in keinem Deck – lyricstyle.js setzt es gezielt
  aside: { e: 0, lead: 180, only: true, ease: "smooth", w: (c) => ({ x: 0.18 * c.dir, s: 0.9, o: 0.25 }) },
  // Buchstaben
  curtain: { e: 1, lead: 180, L: "center", w: () => ({}), l: () => ({ o: 0, y: 0.15 }) },
  write: { e: 1, lead: 170, L: "fwd", w: () => ({}), l: () => ({ o: 0, x: -0.08 }) },
  typer: { e: 1, lead: 120, L: "fwd", w: () => ({}), l: () => ({ o: 0 }), caret: true },
  cascade: { e: 2, lead: 180, L: "fwd", w: () => ({}), l: () => ({ y: -0.35, o: 0.3 }) },
  cascadeup: { e: 2, lead: 180, L: "rev", w: () => ({}), l: () => ({ y: 0.35, o: 0.3 }) },
  rain: { e: 2, lead: 180, L: "fwd", w: () => ({}), l: () => ({ y: -0.7, o: 0 }) },
  swirl: { e: 2, lead: 180, L: "center", w: () => ({}), l: (c) => ({ r: (c.ci - (c.cn - 1) / 2) * 25, y: -0.2, o: 0.2 }) },
  wave: { e: 1, lead: 180, L: "fwd", w: () => ({}), l: (c) => ({ y: 0.25 * Math.sin(c.ci * 0.9), o: 0.6 }) },
  flipl: { e: 2, lead: 180, L: "fwd", w: () => ({}), l: (c) => ({ ry: 90 * c.dir, o: 0.2 }) },
  // Sperren: die Buchstaben stehen in der Wortmitte übereinander und laufen auseinander (Laufweite öffnet sich)
  track: { e: 1, lead: 180, L: "center", w: () => ({}), l: (c) => ({ x: ((c.cn - 1) / 2 - c.ci) * 0.22, o: 0 }) },
  // Reißverschluss: die Buchstaben kommen abwechselnd von oben und unten und greifen ineinander
  zip: { e: 2, lead: 180, L: "fwd", w: () => ({}), l: (c) => ({ y: c.ci % 2 ? 0.3 : -0.3, o: 0.2 }) },
  shatter: { e: 3, lead: 180, L: "rand", wild: true, w: () => ({}), l: (c) => ({ x: (c.h - 0.5) * 1, y: (hash01(c.h + "y") - 0.5) * 0.8, r: (hash01(c.h + "r") - 0.5) * 120, o: 0 }) },
  // lebhaft
  drop: { e: 2, lead: 170, w: (c) => ({ y: -0.3, r: -5 * c.dir, o: 0.7 }) },
  bounce: { e: 2, lead: 180, ease: "bounce", w: () => ({ y: -0.5, o: 0.6 }) },
  split: { e: 2, lead: 170, min: 4, max: 10, w: (c) => ({ x: (c.side < 0 ? -0.35 : 0.35) * c.dir, o: 0.4 }) },
  key: { e: 2, lead: 180, keyed: true, w: (c) => (c.key ? { s: 0.55, o: 0.4 } : { o: 0.7 }), acc: "pop" },
  flipx: { e: 2, lead: 180, w: (c) => ({ rx: 85 * c.dir, o: 0.3 }) },
  flipy: { e: 2, lead: 180, w: (c) => ({ ry: -85 * c.dir, o: 0.3 }) },
  mirror: { e: 2, lead: 180, w: () => ({ ry: 178, o: 0.5 }) },
  jelly: { e: 2, lead: 170, w: () => ({ s: [1.3, 0.7], o: 0.6 }), acc: "jelly" },
  domino: { e: 2, lead: 180, w: (c) => ({ r: -70 * c.dir, og: "left bottom", o: 0.4 }) },
  ricochet: { e: 2, lead: 170, w: (c) => ({ x: c.alt * 0.5, y: -0.2, o: 0.6 }) },
  slot: { e: 2, lead: 180, w: () => ({ y: -0.6, rx: 70, o: 0 }) },
  hinge: { e: 2, lead: 180, w: (c) => ({ r: 24 * c.dir, og: "left top", o: 0.5 }) },
  bubble: { e: 2, lead: 170, w: () => ({ s: 0.05, o: 0 }), acc: "pop" },
  // (wartend blass: das Wort steht bis zum Einsatz ein Stück über seinem Vorgänger – mitten in einer Reihe lag es sonst
  // gut sichtbar auf dem eben gelandeten Wort)
  magnet: { e: 2, lead: 110, ease: "snap", w: (c) => ({ x: c.k ? -0.4 : -0.3, o: 0.45 }) },
  orbit: { e: 2, lead: 180, w: (c) => ({ x: 0.4 * Math.cos(c.k * 1.3), y: 0.3 * Math.sin(c.k * 1.3), r: 20 * Math.sin(c.k), o: 0.4 }) },
  hop: { e: 2, lead: 170, w: () => ({ y: -0.4, o: 0.6 }), acc: "hop" },
  echo: { e: 2, lead: 170, w: (c) => ({ x: -0.3 * c.dir, o: 0.4 }), acc: "echo" },
  heart: { e: 2, lead: 170, w: () => ({ s: 0.7, o: 0.5 }), acc: "heart" },
  skew: { e: 2, lead: 160, w: (c) => ({ x: -0.4 * c.dir, sk: -20 * c.dir, o: 0.5 }) },
  stretch: { e: 2, lead: 170, w: () => ({ s: [1.7, 0.6], o: 0.5 }), acc: "jelly" },
  squash: { e: 2, lead: 170, w: () => ({ s: [0.6, 1.5], y: 0.1, o: 0.5 }) },
  punch: { e: 2, lead: 140, w: () => ({ y: -0.08 }), ln: "punch" },
  // Pegel: jedes Wort wächst wie ein Balken einer Pegelanzeige von der Grundlinie hoch (verschieden hoch gestartet)
  bars: { e: 2, lead: 170, ease: "back", w: (c) => ({ s: [1, 0.12 + 0.3 * c.h], og: "center bottom", o: 0.55 }), acc: "beat" },
  // Aufzählung: die Teile zwischen den Kommas kommen im Wechsel von links und rechts (segs: braucht so viele Teile)
  volley: { e: 2, lead: 170, segs: 2, min: 4, ease: "back", w: (c) => ({ x: 0.45 * c.galt * c.dir, r: -2 * c.galt * c.dir, o: 0.35 }) },
  // Zählen: jede Zahl klappt wie auf einer Fallblatt-Anzeige herunter und rastet ein; die übrigen Wörter kommen schlicht.
  // only: nur für Zähl-Zeilen (lyricstyle.js, countRun)
  count: { e: 2, lead: 150, only: true, ease: "snap", w: (c) => (c.on ? { rx: -88, og: "center top", o: 0.15 } : { y: -0.08, o: 0.7 }), acc: "tick" },
  // hart
  // (wartend halb deckend und nur 1,22-fach: voll deckend und größer ragte ein Wort der zweiten Reihe in die erste)
  caps: { e: 3, lead: 160, w: () => ({ s: 1.22, y: -0.08, o: 0.5 }), acc: "impact" },
  slam: { e: 3, lead: 160, w: () => ({ s: 1.6, o: 0 }), acc: "impact" },
  stamp: { e: 3, lead: 150, w: (c) => ({ s: 1.8, o: 0, r: -8 * c.dir }), acc: "impact" },
  zoom: { e: 3, lead: 170, w: () => ({ s: 2.2, o: 0 }) },
  collide: { e: 3, lead: 170, min: 2, max: 8, ease: "snap", w: (c) => ({ x: c.side * 0.6, s: 0.9, o: 0.75 }), acc: "impact" },
  spiral: { e: 3, lead: 180, wild: true, w: (c) => ({ r: 160 * c.dir, s: 0.3, o: 0 }) },
  scatter: { e: 3, lead: 180, wild: true, w: (c) => ({ x: (c.h - 0.5), y: (hash01(c.h + "y") - 0.5) * 0.7, r: (hash01(c.h + "r") - 0.5) * 40, o: 0.2 }) },
  tumble: { e: 3, lead: 180, wild: true, w: (c) => ({ r: 90 * c.dir, y: -0.3, o: 0.2 }) },
  pinwheel: { e: 3, lead: 180, wild: true, w: (c) => ({ r: 360 * c.dir, s: 0.4, o: 0 }) },
  jitter: { e: 3, lead: 100, wild: true, ease: "snap", w: (c) => ({ x: c.alt * 0.12, r: c.alt * 6 }) },
  glitch: { e: 3, lead: 120, wild: true, max: 6, ease: "snap", w: (c) => ({ x: c.alt * 0.18, sk: c.alt * 18, o: 0.35 }), acc: "glitch" },
};
export const RECIPES = R;
export const TREATMENTS = Object.keys(R);
// Familien: der Refrain teilt sich ein Motiv aus einer Familie (Abwandlungen statt immer derselben Bewegung)
const FAMILY = {
  flip: ["flipx", "flipy", "mirror", "unfold", "flipl"],
  fall: ["drop", "bounce", "rain", "cascade", "slot"],
  slide: ["split", "wavel", "waver", "conveyor", "magnet", "ricochet", "volley"],
  grow: ["key", "bubble", "zoomin", "heart", "jelly"],
  hit: ["slam", "stamp", "zoom", "caps", "collide"],
  swing: ["hinge", "domino", "pendulum", "tilt", "lean", "fan"],
  float: ["rise", "peek", "stairs", "tidal", "cascadeup"],
  letters: ["curtain", "write", "swirl", "wave", "flipl", "cascade", "track", "zip"],
  wild: ["spiral", "scatter", "tumble", "pinwheel", "shatter", "orbit"],
  pop: ["hop", "jelly", "stretch", "squash", "bubble", "bars"],
};
export const FAMILIES = FAMILY;
// Teile → Energie, aus der das Deck zieht
// (Strophe ohne die ganz stillen Rezepte – die bleiben Balladen und ruhigen Stellen; sonst wirkt eine Strophe wie Standbild)
const SECT_E = { verse: [1, 2], pre: [1, 2], chorus: [2, 3], drop: [3, 3], bridge: [0, 2], calm: [0, 1] };
const BRIDGE = ["tilt", "hinge", "pendulum", "mirror", "unfold", "drift", "lean", "swirl", "tidal", "domino", "fan"];
const RAP = ["type", "typer", "write", "magnet", "jitter", "glitch", "ricochet"];
const BALLAD = ["glow", "fade", "drift", "curtain", "write", "neon", "tidal", "rise", "track"];
// Ballade: was dort (außer den ruhigen Rezepten bis Energie 1) noch passt – Klappen, Wachsen, Buchstaben; nichts, was
// hüpft, prallt, schnappt oder zuckt (in der Ballade wirkte ein Abpraller oder Quetschen wie ein Witz an falscher Stelle)
const GENTLE = ["key", "flipx", "flipy", "mirror", "heart", "cascade", "cascadeup", "rain", "swirl", "flipl", "zip"];
// … und die ruhigen, die trotzdem nicht passen (Schnappen, Zucken, Fließband)
const NOT_BALLAD = ["type", "typer", "conveyor", "accordion", "zoomin", "stagger", "ladder"];
export const balladOk = (t) => !!R[t] && !NOT_BALLAD.includes(t) && R[t].ease !== "snap" && R[t].ease !== "bounce" && (R[t].e <= 1 || GENTLE.includes(t));
const HIT = ["slam", "stamp", "zoom", "collide", "caps"];

/* ---- Deck eines Songs: aus der Kennung (Spotify-URI) bzw. dem Liedtext */
// level: "subtle" | "playful" | "wild". → { seed, verse, pre, chorus (Motiv), hit, drop, bridge, calm, rap, ballad,
// shout, ease: [Refrain, Strophe], fonts (Schrift-Charakter), grade (Farbstimmung), amp, sig (Fingerabdruck) }
export function songDeck(seed, level = "playful") {
  const rnd = rng("deck|" + seed);
  const pickN = (list, n) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  };
  const ok = (t) => allowed(t, level);
  const byE = ([a, b]) => TREATMENTS.filter((t) => R[t].e >= a && R[t].e <= b && ok(t) && t !== "plain" && !R[t].only);
  const famNames = Object.keys(FAMILY).filter((f) => FAMILY[f].some(ok));
  const motifFam = pickN(famNames.filter((f) => f !== "float" || level === "subtle"), 1)[0] || "float";
  // (ohne Rezepte, die nur auf besondere Zeilen passen – Aufzählung, Zählen: sie taugen nicht als Motiv)
  const motif = pickN(FAMILY[motifFam].filter((t) => ok(t) && !R[t].only && !R[t].segs), 3);
  const easeKeys = Object.keys(EASE);
  const d = {
    seed: String(seed),
    level,
    verse: pickN(byE(SECT_E.verse), 6),
    pre: pickN(byE(SECT_E.pre), 3),
    motifFam,
    chorus: motif.length ? motif : ["rise"],
    hit: pickN(HIT.filter(ok), 2),
    drop: pickN(byE(SECT_E.drop).concat(HIT.filter(ok)), 3),
    bridge: pickN(BRIDGE.filter(ok), 3),
    calm: pickN(byE(SECT_E.calm), 3),
    rap: pickN(RAP.filter(ok), 3),
    ballad: pickN(BALLAD.filter(ok), 3),
    shout: pickN(HIT.filter(ok), 2),
    ease: pickN(easeKeys, 2),
    // Schrift-Charakter: welche Anzeige-Schriften dieser Song benutzt (zwei bis vier)
    fonts: pickN(["shout", "round", "serif", "mono", "wide", "marker"], 2 + Math.floor(rnd() * 3)),
    // Farbstimmung: Farbton verschieben, Sättigung
    grade: { hue: Math.round((rnd() - 0.5) * 30), sat: r2(0.85 + rnd() * 0.3) },
    amp: r2(0.85 + rnd() * 0.3),
    fx: Math.floor(rnd() * 1e6),
    // Erkennungszeichen der Hook-Wörter: jedes Mal, wenn ein Hook-Wort des Songs fällt, derselbe Akzent und dieselbe
    // Auszeichnung (unterstrichen oder gesperrt) – das Motiv, an dem man den Refrain wiedererkennt
    hook: HOOKS[Math.floor(rnd() * HOOKS.length)],
    hookMark: rnd() < 0.5 ? "under" : "wide",
  };
  // ruhige Stufe: nur sanfte Rezepte, keine Schriften
  if (level === "subtle") {
    d.fonts = [];
    d.amp = 0.55;
  }
  for (const k of ["verse", "pre", "drop", "bridge", "calm", "rap", "ballad", "shout", "hit"]) if (!d[k].length) d[k] = ["rise"];
  d.sig = [d.verse, d.pre, d.chorus, d.hit, d.drop, d.bridge, d.calm, d.rap, d.ballad, d.ease, d.fonts].map((x) => x.join(",")).join("|") + "|" + d.grade.hue + "|" + d.amp + "|" + d.hook + d.hookMark;
  return d;
}
// Was eine Stufe zeigt: „Dezent“ nur sanfte Wort-Bewegungen ohne Buchstaben, „Verspielt“ alles außer den wilden
export function allowed(t, level) {
  const r = R[t];
  if (!r) return false;
  if (level === "subtle") return r.e <= 1 && !r.L && !r.ln && !r.acc && !["unfold", "accordion", "lean", "zoomin", "peek", "conveyor"].includes(t);
  if (level === "wild") return true;
  return !r.wild;
}
export const RAP_SET = new Set(RAP), BALLAD_SET = new Set(BALLAD), HIT_SET = new Set(HIT), BRIDGE_SET = new Set(BRIDGE);

/* ---- Wartezustand eines Worts / Buchstabens → CSS-Variablen (nur, was vom Ruhezustand abweicht) */
// len: Zeichen des Worts – lange Wörter drehen und wachsen weniger (sie ragten sonst aus der Textfläche)
function safe(v, len, amp) {
  const o = { ...v };
  const a = amp ?? 1;
  const L = Math.max(1, len || 1);
  if (o.x) o.x = clamp(o.x * a, -0.6, 0.6);
  if (o.y) o.y = clamp(o.y * a, -0.45, 0.45);
  // Drehung: das gedrehte Wort darf höchstens ~0,45 em über seine Zeile hinausragen (halbe Breite ≈ 0,3 em je Zeichen)
  if (o.r) {
    // (ganze Drehungen nur für kurze Wörter, die unsichtbar oder winzig beginnen – ein langes Wort, das sich beim
    // Auftauchen dreht, fegte über die Nachbarzeilen)
    const lim = ((o.s != null && !Array.isArray(o.s) && o.s <= 0.5) || o.o === 0) && L <= 3 ? 360 : Math.max(2, (Math.asin(Math.min(1, 0.18 / (0.3 * L))) * 180) / Math.PI);
    o.r = clamp(o.r * (Math.abs(o.r) > 100 ? 1 : a), -lim, lim);
  }
  // Wachsen: höchstens 1 + 2,5/Länge (ein langes Wort wächst kaum), nie unter 5 %
  // (höchstens 1,3: größer ragte ein Wort beim Landen über die Zeilen darüber und darunter)
  const grow = (s) => (s > 1 ? Math.min(s, 1 + 2.5 / L, 1.3) : Math.max(0.05, s));
  if (Array.isArray(o.s)) o.s = [grow(o.s[0]), grow(o.s[1])];
  else if (o.s != null) o.s = grow(o.s);
  if (o.o != null) o.o = clamp(o.o, 0, 1);
  // stark verzerrt wartend (gespiegelt oder auf weniger als zwei Drittel gestaucht): kaum sichtbar statt halb deckend –
  // die noch nicht gesungenen Wörter der aktiven Zeile standen sonst sekundenlang als Zerrbild da (Party: „squash“ sah
  // aus wie eine fremde, schmale Schrift, „mirror“ zeigte Spiegelschrift)
  const sq = Array.isArray(o.s) ? Math.min(o.s[0], o.s[1]) / Math.max(o.s[0], o.s[1]) : 1;
  if ((sq < 0.67 || Math.abs(o.ry || 0) > 95 || Math.abs(o.rx || 0) > 95) && (o.o ?? 1) > 0.3) o.o = 0.3;
  return o;
}
export function poseVars(v) {
  const out = {};
  if (!v) return out;
  if (v.x || v.y) {
    out["--wx"] = r2(v.x || 0) + "em";
    out["--wy"] = r2(v.y || 0) + "em";
  }
  if (v.r) out["--wr"] = r2(v.r) + "deg";
  if (Array.isArray(v.s)) out["--ws"] = r2(v.s[0]) + " " + r2(v.s[1]);
  else if (v.s != null && v.s !== 1) out["--ws"] = String(r2(v.s));
  if (v.o != null && v.o !== 1) out["--wo"] = String(r2(v.o));
  const tf = [];
  if (v.rx) tf.push(`rotateX(${r2(v.rx)}deg)`);
  if (v.ry) tf.push(`rotateY(${r2(v.ry)}deg)`);
  if (v.sk) tf.push(`skewX(${r2(v.sk)}deg)`);
  if (tf.length) out["--wt"] = (v.rx || v.ry ? "perspective(20em) " : "") + tf.join(" ");
  if (v.og) out["--wog"] = v.og;
  return out;
}
// Wartezustand eines Worts. c: { k, n, dir, amp, len, key, seed }
export function wordPose(t, c) {
  const r = R[t] || R.plain;
  const n = Math.max(1, c.n), mid = (n - 1) / 2;
  const side = n > 1 ? (c.k - mid) / Math.max(1, mid) : 0;
  // galt: Seite des Teils zwischen zwei Kommas (Aufzählung), on: das Wort ist das besondere der Zeile (Zahl beim Zählen)
  // – ohne Angabe wechseln beide von Wort zu Wort
  const alt = c.k % 2 ? 1 : -1;
  const ctx = { ...c, side, alt, galt: c.galt ?? alt, on: c.on ?? c.k % 2 === 0, h: hash01(c.seed + "|" + c.k) };
  return safe(r.w(ctx), c.len, c.amp);
}
// Reihenfolge der Buchstaben (für die Staffelung): vorwärts, rückwärts, von der Mitte, gewürfelt
export function letterOrder(kind, cn, seed) {
  const idx = [...Array(cn).keys()];
  if (kind === "rev") return idx.map((i) => cn - 1 - i);
  if (kind === "center") return idx.map((i) => Math.round(Math.abs(i - (cn - 1) / 2) * 2) >> 1);
  if (kind === "rand") {
    const s = idx.map((i) => [hash01(seed + ":" + i), i]).sort((a, b) => a[0] - b[0]);
    const out = [];
    s.forEach(([, i], k) => (out[i] = k));
    return out;
  }
  return idx;
}
// Buchstaben eines Worts: je Buchstabe Wartezustand und Staffelung (--ld). Die Staffelung frisst nie mehr als die
// halbe Landedauer: der letzte Buchstabe landet genau mit dem Wort (Verzögerung + verkürzte Dauer = Vorlauf).
export function letterPoses(t, text, c) {
  const r = R[t];
  const chars = [...String(text)];
  const cn = chars.length;
  const order = letterOrder(r?.L || "fwd", cn, c.seed);
  const steps = Math.max(...order, 0);
  const lead = c.lead ?? r?.lead ?? LEAD_DEF;
  const st = steps ? Math.min(28, Math.floor((lead * 0.5) / steps)) : 0;
  return chars.map((ch, ci) => {
    const v = r?.l ? safe(r.l({ ...c, ci, cn, h: hash01(c.seed + "|" + c.k + "|" + ci) }), 1, c.amp) : {};
    return { ch, ld: order[ci] * st, vars: poseVars(v) };
  });
}
export const leadOf = (t) => Math.min(LEAD_MAX, (R[t] || R.plain).lead ?? LEAD_DEF);

/* ---- Akzente auf dem Einsatz (CSS-Keyframes m-a-*, beginnen und enden im Ruhezustand) */
// syl: Silben-Tick im schnellen Rap (je Silbe ein kurzer Stoß – Dauer und Zahl je Wort, --pad/--pai);
// hstamp/htwist/hlift/hflare: Erkennungszeichen der Hook-Wörter (je Song eins, siehe songDeck().hook)
// tick: eine Zahl rastet ein (Zähl-Zeilen) · ask: das letzte Wort einer Frage hebt sich wie die Stimme
export const ACCENTS = { impact: 360, pop: 420, jelly: 600, hop: 420, heart: 700, neon: 900, echo: 520, glitch: 450, beat: 300, bar: 380, syl: 140, hstamp: 460, htwist: 520, hlift: 480, hflare: 500, tick: 260, ask: 520 };
export const HOOKS = ["hstamp", "htwist", "hlift", "hflare"];

/* ---- Übergabe: die alte Zeile geht mit einer Bewegung ab, die zu ihrem Auftritt passt (Familie des Rezepts).
   Kurzer Ausschlag in die Richtung und zurück in den Ruhezustand (die vergangene Zeile steht danach still) */
export const EXITS = { float: "m-x-up", letters: "m-x-up", fall: "m-x-down", slide: "m-x-side", flip: "m-x-flip", hit: "m-x-push", swing: "m-x-tilt", wild: "m-x-tilt", pop: "m-x-pop", grow: "m-x-pop" };
export function exitOf(t) {
  for (const [fam, list] of Object.entries(FAMILY)) if (list.includes(t)) return EXITS[fam];
  return RAP.includes(t) ? "m-x-side" : "m-x-up";
}

/* ---- Wortbilder in Spielarten: je Begriff (Feuer, Kerze …) und Song eine andere Ausprägung.
   Spielart 0 ist die feste aus dem Stylesheet (Klasse is-c-…); die anderen setzen ihre Bewegung über Variablen:
   n Name einer Schleife (m-c-… oder die frei einstellbaren m-q-…), d Dauer, q Stellgrößen, pt Teilchen (::after). */
const PT = {
  ember: { w: 0.1, h: 0.1, br: "50%", c: "255 150 50", x: "0.1em", y: "-0.9em", s: 0.5, d: 1.1 },
  drop: { w: 0.12, h: 0.17, br: "50% 50% 50% 50% / 62% 62% 38% 38%", c: "150 200 255", x: "0em", y: "0.9em", s: 0.6, d: 1.4 },
  spark: { w: 0.14, h: 0.14, br: "2px", c: "255 220 120", x: "0.25em", y: "-0.5em", s: 0.2, d: 1, rot: "45deg" },
  snow: { w: 0.1, h: 0.1, br: "50%", c: "235 245 255", x: "-0.2em", y: "0.8em", s: 0.6, d: 1.8 },
  bubble: { w: 0.16, h: 0.16, br: "50%", c: "170 220 255", x: "0.1em", y: "-0.8em", s: 0.4, d: 1.6 },
  petal: { w: 0.18, h: 0.1, br: "60% 0", c: "255 150 190", x: "0.3em", y: "0.7em", s: 0.7, d: 1.7, rot: "160deg" },
  zap: { w: 0.04, h: 0.3, br: "1px", c: "150 240 255", x: "0.15em", y: "-0.2em", s: 0.8, d: 0.9, rot: "25deg" },
  star: { w: 0.12, h: 0.12, br: "1px", c: "255 255 255", x: "-0.1em", y: "-0.6em", s: 0.2, d: 1.2, rot: "45deg" },
  smoke: { w: 0.3, h: 0.3, br: "50%", c: "200 200 220", x: "0.2em", y: "-0.7em", s: 0.4, d: 2.2 },
  note: { w: 0.09, h: 0.09, br: "50%", c: "255 255 255", x: "0.3em", y: "-0.6em", s: 0.5, d: 1.2 },
};
export const PARTICLES = PT;
const V = (n, d, q, pt) => ({ n, d, q: q || {}, pt });
export const FX_VARIANTS = {
  flame: [V(), V("m-q-skew", 0.8, { k: "-5deg" }, "ember"), V("m-q-pulse", 0.7, { s: 1.1 }, "ember"), V("m-q-stretch", 0.9, { s: 0.94 })],
  heat: [V(), V("m-q-skew", 1.6, { k: "3deg" }), V("m-q-bob", 1.4, { y: "-0.06em" }, "smoke")],
  drip: [V(), V("m-q-sink", 1.6, { y: "0.1em", r: "0deg" }, "drop"), V("m-q-bob", 1.3, { y: "0.08em" }, "drop")],
  wave: [V(), V("m-q-sway", 1.6, { r: "4deg" }), V("m-q-bob", 1.2, { y: "-0.1em" }, "bubble")],
  jolt: [V(), V("m-q-jit", 0.5, { x: "0.05em" }, "zap"), V("m-q-skew", 0.6, { k: "-8deg" }, "zap")],
  shiver: [V(), V("m-q-jit", 0.3, { x: "0.025em" }, "snow"), V("m-q-pulse", 1.4, { s: 0.94 }, "snow")],
  beat: [V(), V("m-q-pulse", 0.9, { s: 1.14 }), V("m-q-stretch", 0.95, { s: 1.08 })],
  crack: [V(), V("m-q-sink", 1.4, { y: "0.12em", r: "-5deg" }), V("m-q-skew", 1.2, { k: "-9deg" })],
  float: [V(), V("m-q-bob", 2, { y: "-0.12em" }, "bubble"), V("m-q-orbit", 2.2, { x: "0.08em", y: "-0.1em" })],
  fall: [V(), V("m-q-sink", 1.6, { y: "0.12em", r: "8deg" }), V("m-q-bob", 1.4, { y: "0.12em" })],
  burst: [V(), V("m-q-pulse", 0.6, { s: 1.2 }, "spark"), V("m-q-jit", 0.4, { x: "0.06em" }, "spark")],
  spin: [V(), V("m-q-sway", 1.2, { r: "-6deg" }), V("m-q-sway", 0.8, { r: "12deg" })],
  glint: [V(), V("m-q-pulse", 1.2, { s: 1.08 }, "spark"), V("m-q-sway", 1.4, { r: "-3deg" }, "star")],
  dim: [V(), V("m-q-flick", 2.4, { o: 0.6 }), V("m-q-sink", 2, { y: "0.06em", r: "0deg" }, "smoke")],
  shine: [V(), V("m-q-pulse", 1.8, { s: 1.1 }, "star"), V("m-q-bob", 1.8, { y: "-0.1em" })],
  shake: [V(), V("m-q-jit", 0.3, { x: "0.05em" }), V("m-q-sway", 0.4, { r: "4deg" })],
  hush: [V(), V("m-q-swell", 2.2, { s: 0.88 }), V("m-q-flick", 2.4, { o: 0.65 })],
  bounce: [V(), V("m-q-bob", 0.5, { y: "-0.12em" }), V("m-q-stretch", 0.5, { s: 1.1 }, "note")],
  halt: [V(), V("m-q-jit", 0.25, { x: "0.03em" }), V("m-q-swell", 0.6, { s: 1.08 })],
  tick: [V(), V("m-q-sway", 1, { r: "8deg" }), V("m-q-jit", 0.5, { x: "0.02em" })],
  drift: [V(), V("m-q-orbit", 2.6, { x: "0.1em", y: "-0.08em" }, "smoke"), V("m-q-bob", 2.4, { y: "-0.12em" })],
  dash: [V(), V("m-q-skew", 0.6, { k: "-14deg" }), V("m-q-jit", 0.4, { x: "0.06em" })],
  power: [V(), V("m-q-swell", 1.2, { s: 1.14 }), V("m-q-pulse", 1, { s: 1.12 }, "spark")],
  droop: [V(), V("m-q-sink", 2, { y: "0.14em", r: "-3deg" }), V("m-q-swell", 2, { s: 0.92 })],
  bloom: [V(), V("m-q-pulse", 1.4, { s: 1.1 }, "petal"), V("m-q-sway", 1.6, { r: "5deg" }, "petal")],
  sultry: [V(), V("m-q-sway", 2.6, { r: "3deg" }), V("m-q-skew", 2.4, { k: "-4deg" })],
  neon: [V(), V("m-q-flick", 1.6, { o: 0.62 }, "zap"), V("m-q-pulse", 1.4, { s: 1.05 })],
  snow: [V(), V("m-q-bob", 2, { y: "0.06em" }, "snow"), V("m-q-jit", 0.35, { x: "0.02em" }, "snow")],
  star: [V(), V("m-q-pulse", 1.3, { s: 1.1 }, "star"), V("m-q-orbit", 2, { x: "0.05em", y: "-0.06em" }, "spark")],
  // Kategorien (lyricstyle.js, CATEGORY_FX)
  shot: [V(), V("m-q-jit", 0.35, { x: "0.05em" }, "spark")],
  rapid: [V()],
  slash: [V()],
  shatter: [V()],
  war: [V(), V("m-q-swell", 1.6, { s: 1.06 }, "smoke")],
  siren: [V()],
  zoomby: [V(), V("m-q-skew", 0.5, { k: "-16deg" })],
  prowl: [V(), V("m-q-sway", 1.8, { r: "3deg" })],
  savor: [V(), V("m-q-pulse", 1.2, { s: 1.08 }, "bubble")],
  glitchy: [V(), V("m-q-jit", 0.3, { x: "0.04em" }, "zap")],
  kick: [V(), V("m-q-bob", 0.5, { y: "-0.1em" })],
};
// Spielart je Begriff und Song: gleicher Song, gleiches Bild; anderer Song, andere Spielart
export function fxVariant(cue, concept, deckFx) {
  const list = FX_VARIANTS[cue];
  if (!list) return null;
  return list[Math.floor(hash01(deckFx + "|" + cue + "|" + concept) * list.length)];
}
export function fxVars(v) {
  const out = {};
  if (!v || !v.n) return out;
  out["--pcn"] = v.n;
  out["--pcd"] = v.d + "s";
  for (const [k, val] of Object.entries(v.q)) out["--q" + k] = String(val);
  return out;
}
export function particleVars(kind) {
  const p = PT[kind];
  if (!p) return {};
  return { "--ptw": p.w + "em", "--pth": p.h + "em", "--ptr": p.br, "--ptc": p.c, "--ptx": p.x, "--pty": p.y, "--pts": String(p.s), "--ptd": p.d + "s", "--ptq": p.rot || "0deg" };
}
// Zahl der Spielarten insgesamt (Begriff × Spielart) – für den Abwechslungs-Test
export const FX_COUNT = Object.values(FX_VARIANTS).reduce((s, l) => s + l.length, 0);
