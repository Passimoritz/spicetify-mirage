/* ---------------------------------------------------------------- Szenarien (Party-Modus) */
// Zwei Quellen lassen die Bühne reagieren – nicht nur das Wortbild über dem Cover (words.js):
//  1. Wörter im Liedtext: singt jemand „fire“, zünden die Flammen am Bühnenrand; „rain“ legt einen blauen
//     Schleier von oben, „stars“ ein Sternenfeld über die Bühne, „jump“ lässt die Menge springen, „3, 2, 1“
//     zählt auf den nächsten Schlägen mit … Jeder Begriff (lexicon/, rund 75 Begriffe in 45 Sprachen) hat eine
//     oder zwei Bühnen-Antworten aus einer Palette von Familien (FAM). Welche wirklich kommt, entscheidet die
//     Lage: Stärke nach Energie und Teil des Songs, Abklingzeit je Familie, nie zwei gleichzeitig vom selben
//     Typ, „Keine Blitze“ macht aus dem Blitz ein ruhiges Glühen, „Leicht“ lässt die teuren weg.
//  2. Momente der Musik (director.js plant sie): Finale, Tonartwechsel, Stopp und Wiedereinsatz, Solo,
//     a cappella, Ruf-und-Antwort, erster Schlag, Outro – und je Höhepunkt ein Drop-Bild aus der Palette des Stils.
// Hier steht nur die Entscheidung (rein rechnend, testbar); gezeichnet wird in stagefx.js.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Familien der Bühnen-Antwort. cd = Abklingzeit (s) dieser Familie · dur = Dauer (s) · lite = auch bei „Leicht“
// · flash = blitzt (nur mit Blitzen an und durch die Blitz-Schranke) · venue = löst einen Bühneneffekt der
// Location aus (Pyro, CO2, Raketen, Konfetti – die Location entscheidet, ob er dort hingehört)
const FAM = {
  wash: { cd: 6, dur: 3.2, lite: true },
  sun: { cd: 9, dur: 3.4, lite: true },
  stars: { cd: 10, dur: 4.5, lite: true },
  gold: { cd: 9, dur: 3.2, lite: false },
  wave: { cd: 9, dur: 3.6, lite: true },
  sweep: { cd: 7, dur: 2.2, lite: true },
  shock: { cd: 5, dur: 1.4, lite: true },
  count: { cd: 12, dur: 0, lite: true },
  chaos: { cd: 12, dur: 2.4, lite: false },
  bolt: { cd: 8, dur: 1.1, lite: true, flash: true },
  sparks: { cd: 7, dur: 1.6, lite: false },
  pyro: { cd: 10, dur: 1, lite: false, venue: true },
  co2: { cd: 8, dur: 1.4, lite: false, venue: true },
  rockets: { cd: 14, dur: 3, lite: false, venue: true },
  confetti: { cd: 18, dur: 4, lite: false, venue: true },
  jump: { cd: 8, dur: 0, lite: true },
  hands: { cd: 10, dur: 0, lite: true },
};
const FAMS = Object.keys(FAM);

// Farben der Schleier (wash): woher er kommt (top/floor/center) und in welcher Farbe
const C = {
  warm: [255, 120, 40], hell: [255, 40, 20], rain: [70, 140, 255], frost: [150, 215, 255], love: [255, 80, 150], dream: [170, 110, 255],
  ghost: [140, 160, 210], heaven: [255, 245, 225], moon: [200, 210, 255], gold: [255, 200, 70], night: [60, 70, 200], silver: [215, 225, 240],
};
// Begriff → Bühnen-Antworten. [Familie, Farbe?, Herkunft?]. Farb-Wörter (tint) bekommen ihre eigene Farbe aus words.js.
const STAGE = {
  fire: [["pyro"], ["wash", C.warm, "floor"]], devil: [["pyro"], ["wash", C.hell, "floor"]], boom: [["shock"], ["co2"]],
  rain: [["wash", C.rain, "top"]], tears: [["wash", C.rain, "top"]], storm: [["bolt"], ["wash", C.rain, "top"]], lightning: [["bolt"]],
  snow: [["wash", C.frost, "top"], ["co2"]], cold: [["wash", C.frost, "floor"], ["co2"]], christmas: [["wash", C.frost, "top"], ["gold"]],
  sun: [["sun", [255, 200, 90]]], summer: [["sun", [255, 170, 60]]], beach: [["sun", [255, 190, 110]], ["wave"]], light: [["sun", [255, 240, 210]]],
  sky: [["sun", [170, 210, 255]]], heaven: [["sun", C.heaven], ["wash", C.heaven, "top"]], angel: [["sun", C.heaven]],
  star: [["stars"]], night: [["stars"], ["wash", C.night, "top"]], moon: [["wash", C.moon, "top"], ["stars"]], space: [["stars"], ["sweep"]],
  dream: [["wash", C.dream, "center"], ["stars"]], magic: [["stars"], ["wash", C.dream, "center"]], ghost: [["wash", C.ghost, "floor"]],
  dark: [["wash", C.night, "floor"]], black: [["wash", C.night, "floor"]],
  heart: [["wash", C.love, "center"]], love: [["wash", C.love, "center"]], kiss: [["wash", C.love, "center"]], rose: [["wash", [255, 40, 80], "center"]],
  flower: [["wash", [255, 150, 200], "center"]], heartbreak: [["shock"], ["wash", [255, 50, 90], "center"]],
  money: [["gold"]], gold: [["gold"], ["wash", C.gold, "top"]], diamond: [["gold", [190, 240, 255]]], crown: [["gold"], ["sun", C.gold]],
  champagne: [["gold", [255, 230, 150]]], silver: [["gold", C.silver]],
  ocean: [["wave"]], water: [["wave"]], wind: [["sweep"]], fly: [["sweep"]], bird: [["sweep"]], butterfly: [["sweep"]], rocket: [["sweep"], ["co2"]],
  smoke: [["co2"]], electric: [["sparks"]], rainbow: [["chaos"]], fireworks: [["rockets"]], party: [["confetti"], ["jump"]], birthday: [["confetti"]],
  dance: [["jump"]], jump: [["jump"]], world: [["sweep"]], drive: [["sweep"]], city: [["sweep"]], time: [["count"]], music: [["hands"]], sing: [["hands"]],
  // neue Begriffe der Szenarien (lexicon/: count, bass, handsup, hype, crazy, orange, yellow, cyan)
  count: [["count"]], bass: [["shock"], ["jump"]], handsup: [["hands"], ["jump"]], hype: [["jump"], ["hands"]], crazy: [["chaos"]],
};
// Wie stark eine Antwort im jeweiligen Teil des Songs ausfällt (Intro und Outro leise, Refrain und Drop voll)
const PART_K = { intro: 0.6, verse: 0.8, pre: 0.85, chorus: 1, drop: 1, break: 0.6, bridge: 0.75, outro: 0.55, "": 0.8 };
// Bühnen-Effekte, die zu ruhigen Stellen nicht passen: nur ab dieser Energie (sonst bleibt es beim Schleier)
const LOUD = { pyro: 0.45, co2: 0.4, rockets: 0.5, confetti: 0.35, jump: 0.35, chaos: 0.45, shock: 0.3, bolt: 0.2 };

// Zählwörter („3 2 1“, „drei, zwei, eins“, „tres dos uno“ …): ein Countdown erst, wenn die Zeile drei Zahlen
// hintereinander abwärts zählt (sonst wäre jedes „one“ ein Countdown)
const NUMS = {
  1: "1|one|eins|ein|uno|una|un|une|um|uma|bir|één|een|en|ett|yksi|jeden|раз|один|ένα|ichi|하나|一",
  2: "2|two|zwei|dos|deux|due|dois|duas|iki|twee|to|två|kaksi|dwa|два|δύο|ni|둘|二",
  3: "3|three|drei|tres|trois|tre|três|üç|drie|tre|kolme|trzy|три|τρία|san|셋|三",
  4: "4|four|vier|cuatro|quatre|quattro|quatro|dört|fire|fyra|neljä|cztery|четыре",
  5: "5|five|fünf|cinco|cinq|cinque|beş|vijf|fem|viisi|pięć|пять",
};
const NUM = new Map();
for (const [n, s] of Object.entries(NUMS)) for (const w of s.split("|")) if (!NUM.has(w)) NUM.set(w, +n);
const TOK = /[\p{L}\p{N}]+/gu;
// true = die Zeile zählt herunter (mindestens drei Zahlen nacheinander, jede eins kleiner, bis zur Eins)
function isCountdown(text) {
  let prev = 0, run = 0;
  for (const m of String(text || "").toLocaleLowerCase().matchAll(TOK)) {
    const n = NUM.get(m[0]) || 0;
    run = n && n === prev - 1 ? run + 1 : n ? 1 : 0;
    prev = n;
    if (run >= 3 && n === 1) return true;
  }
  return false;
}

/* ---- Entscheidung pro Wort: was die Bühne tut */
// ctx: { t (s), energy 0..1, kind (Teil), level 1..5, lite, calm, noFlash, flash (Bühnenblitze erlaubt),
//        beat (s je Schlag), phase (0..1 im Schlag), col (Farbe des Farb-Worts) }
// Gibt die angenommenen Antworten zurück (auch in active), höchstens zwei je Wort.
function createScenarios() {
  const last = new Map();
  let active = [], seq = 0, lastAt = -1e9;
  function word(c, ctx) {
    const list = STAGE[c] || (ctx.col ? [["wash", ctx.col, "top"]] : null);
    if (!list || ctx.calm) return [];
    const t = ctx.t;
    // Uhr sprang zurück (Spulen, neuer Song): Abklingzeiten neu beginnen
    if (t < lastAt) reset();
    frame(t);
    // ein Wort je 1,2 s – zwei Wörter in einer Zeile stapeln sich nicht
    if (t - lastAt < 1.2) return [];
    const e = clamp(ctx.energy ?? 0.5, 0, 1);
    const k0 = clamp((0.45 + 0.55 * e) * (PART_K[ctx.kind || ""] ?? 0.8) * (0.75 + 0.08 * clamp(ctx.level ?? 3, 1, 5)), 0.2, 1.2);
    const out = [];
    for (const [f, col, from] of list) {
      const F = FAM[f];
      if (!F || out.length >= 2) continue;
      if (ctx.lite && !F.lite) continue;
      if (t - (last.get(f) ?? -1e9) < F.cd) continue;
      // laute Effekte nur, wenn die Musik es trägt
      if (e < (LOUD[f] ?? 0)) continue;
      // höchstens ein laufender Effekt je Familie, höchstens drei zugleich
      if (active.some((a) => a.f === f) || active.length >= 3) continue;
      const cue = { f, fi: FAMS.indexOf(f), t0: t, k: k0, col: col || ctx.col || null, from: from || "top", seq: ++seq, dur: F.dur };
      if (F.flash) cue.soft = !!(ctx.noFlash || !ctx.flash);
      // Countdown: die Pulse sitzen auf den nächsten Schlägen (Versatz bis zum nächsten Schlag)
      if (f === "count") {
        const b = clamp(ctx.beat || 0.5, 0.25, 1.5);
        cue.beat = b;
        cue.off = (1 - clamp(ctx.phase ?? 0, 0, 1)) * b;
        cue.dur = cue.off + b * 4 + 0.8;
      }
      if (f === "jump" || f === "hands") cue.dur = clamp((ctx.beat || 0.5) * 8, 2, 5);
      last.set(f, t);
      active.push(cue);
      out.push(cue);
    }
    if (out.length) lastAt = t;
    return out;
  }
  // laufende Antworten zum Zeitpunkt t (abgelaufene fallen heraus)
  function frame(t) {
    if (active.length) active = active.filter((a) => t - a.t0 < a.dur + 0.5 && t >= a.t0 - 0.05);
    return active;
  }
  function reset() {
    last.clear();
    active = [];
    lastAt = -1e9;
  }
  return { word, frame, reset, get active() { return active; } };
}

/* ---- Drop-Bilder: je Höhepunkt eines, aus der Palette des Stils, nie zweimal hintereinander dasselbe */
const DROP_LOOKS = ["shock", "sunburst", "curtain", "bloom", "shatter", "pillars", "tunnel", "halo"];
const DROP_PAL = {
  edm: ["shock", "shatter", "pillars", "tunnel", "sunburst"], house: ["bloom", "curtain", "halo", "sunburst"], techno: ["curtain", "tunnel", "pillars", "shatter"],
  trance: ["sunburst", "halo", "tunnel", "bloom"], dnb: ["shatter", "tunnel", "shock"], dubstep: ["shock", "shatter", "pillars"], trap: ["shock", "pillars", "curtain"],
  hiphop: ["shock", "curtain", "bloom"], rock: ["pillars", "sunburst", "shock", "curtain"], metal: ["pillars", "shock", "shatter"],
  pop: ["sunburst", "bloom", "halo", "curtain", "shock"], ballad: ["halo", "bloom", "sunburst"], calm: ["halo", "bloom"], latin: ["bloom", "sunburst", "curtain", "halo"],
  reggae: ["bloom", "halo", "sunburst"], folk: ["halo", "bloom", "sunburst"], orchestral: ["sunburst", "halo", "pillars"], kids: ["bloom", "sunburst", "halo", "curtain"],
};
// rng: fester Zufall je Song · prev: zuletzt gewähltes Bild (wird nie wiederholt, wenn die Palette mehr hat)
function pickDropLook(sig, rng, prev) {
  const pal = DROP_PAL[sig] || DROP_PAL.pop;
  const cand = pal.length > 1 ? pal.filter((x) => x !== prev) : pal;
  return cand[Math.floor(rng() * cand.length) % cand.length];
}

export { createScenarios, isCountdown, pickDropLook, STAGE, FAM, FAMS, DROP_LOOKS, DROP_PAL, PART_K };
