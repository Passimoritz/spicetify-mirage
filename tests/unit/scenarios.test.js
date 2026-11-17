// node tests/unit/scenarios.test.js
// Szenarien: erkennen die Wörterbücher die neuen Begriffe (in mehreren Sprachen), zählt nur ein echter Countdown,
// halten Abklingzeiten und Grenzen die Bühne ruhig, bleibt der Blitz unter 3/s (und ohne Blitze ganz aus) –
// und findet die Lichtregie Finale, Rückung, Stopp, Solo, Ruf und Antwort und abwechselnde Drop-Bilder?
const assert = require("assert");
const { load } = require("./load.js");
const { createScenarios, isCountdown, STAGE, FAM, DROP_PAL, DROP_LOOKS } = load("scenarios.js");
const { matchAny, FX } = load("words.js");
const { LEX } = load("lexicon.js");
const { createStageFx } = load("stagefx.js");
const { createFlashCap, FLASH_GAP } = load("flashcap.js");
const { planSong, cue, SIG } = load("director.js");
const { shaped } = require("./songshapes.js");

/* ---- jeder Begriff mit Bühnen-Antwort ist ein Wortbild, jede Antwort eine bekannte Familie */
for (const [c, list] of Object.entries(STAGE)) {
  assert.ok(FX[c], `Begriff ${c} fehlt in words.js`);
  for (const [f] of list) assert.ok(FAM[f], `${c}: unbekannte Familie ${f}`);
}
for (const s of Object.keys(SIG)) assert.ok(DROP_PAL[s], `Stil ${s} ohne Drop-Palette`);
for (const pal of Object.values(DROP_PAL)) for (const l of pal) assert.ok(DROP_LOOKS.includes(l), l);

/* ---- Wörterbuch: neue Begriffe in mehreren Sprachen, Wortgruppen vor Einzelwörtern */
const hit = (text, lang) => matchAny(text, [lang], LEX).map((m) => m.c);
const CASES = [
  ["Put your hands up for me", "en", "handsup"], ["Alle Hände hoch jetzt", "de", "handsup"], ["manos arriba todo el mundo", "es", "handsup"],
  ["les mains en l'air", "fr", "handsup"], ["mani in alto", "it", "handsup"], ["mãos pro alto", "pt", "handsup"], ["eller havaya", "tr", "handsup"],
  ["drop the bass now", "en", "bass"], ["spürst du den Bass", "de", "bass"], ["let's go", "en", "hype"], ["los geht's", "de", "hype"],
  ["vámonos", "es", "hype"], ["tutti insieme", "it", "hype"], ["going crazy tonight", "en", "crazy"], ["völlig verrückt", "de", "crazy"],
  ["una locura", "es", "crazy"], ["c'est la folie", "fr", "crazy"], ["deliyim", "tr", "crazy"], ["yellow light", "en", "yellow"],
  ["gelbe Sonne", "de", "yellow"], ["amarillo", "es", "yellow"], ["turquoise sea", "en", "cyan"], ["orange sky", "en", "orange"],
  ["like a volcano", "en", "fire"], ["heiße Nacht", "de", "fire"], ["the waves", "en", "ocean"], ["cometa", "es", "star"],
];
for (const [text, lang, c] of CASES) assert.ok(hit(text, lang).includes(c), `${lang}: „${text}“ sollte ${c} treffen, trifft ${hit(text, lang)}`);
// die alten Begriffe sind noch da (angehängt, nicht ersetzt)
assert.ok(hit("we are on fire", "en").includes("fire"));
assert.ok(hit("Feuer und Flamme", "de").includes("fire"));
// keine Fehltreffer auf Alltagswörtern
for (const [text, lang] of [["under the table", "en"], ["bajo la luna", "es"], ["a basso costo", "it"], ["nada mais baixo", "pt"]]) {
  assert.ok(!hit(text, lang).includes("bass"), `${lang}: „${text}“ ist kein Bass`);
}

/* ---- Countdown: nur echtes Herunterzählen bis zur Eins */
for (const t of ["3, 2, 1, go!", "Three, two, one", "drei, zwei, eins – los", "tres, dos, uno", "trois, deux, un", "tre, due, uno", "três, dois, um", "üç iki bir", "5 4 3 2 1"]) assert.ok(isCountdown(t), "Countdown: " + t);
for (const t of ["one, two, three", "we are one", "two hearts beat as one", "3 2 go", "1 2 3 4", "four three two", "three little birds, one love"]) assert.ok(!isCountdown(t), "kein Countdown: " + t);

/* ---- Entscheidung: Abklingzeiten, Abstand, Grenzen, Leicht, Ruhig */
const base = { energy: 0.8, kind: "chorus", level: 3, lite: false, calm: false, noFlash: false, flash: true, beat: 0.5, phase: 0.2 };
{
  const s = createScenarios();
  const a = s.word("fire", { ...base, t: 10 });
  assert.deepStrictEqual(a.map((x) => x.f), ["pyro", "wash"], "Feuer: Flammen und warmer Schein");
  assert.strictEqual(s.word("rain", { ...base, t: 10.5 }).length, 0, "unter 1,2 s nach dem letzten Wort: nichts");
  assert.strictEqual(s.word("fire", { ...base, t: 14 }).length, 0, "Flammen erst nach ihrer Abklingzeit wieder");
  assert.strictEqual(s.word("devil", { ...base, t: 15 }).filter((x) => x.f === "pyro").length, 0, "Pyro auch über einen anderen Begriff erst nach der Abklingzeit");
  assert.ok(s.word("fire", { ...base, t: 21 }).some((x) => x.f === "pyro"), "nach 10 s wieder");
  // zurückgespult: Abklingzeiten neu
  assert.ok(s.word("fire", { ...base, t: 2 }).some((x) => x.f === "pyro"));
}
{
  // nie mehr als drei gleichzeitig, nie zwei derselben Familie
  const s = createScenarios();
  let t = 0;
  for (const c of ["rain", "star", "money", "ocean", "sun", "heart", "dance", "smoke"]) s.word(c, { ...base, t: (t += 1.3) });
  const act = s.frame(t);
  assert.ok(act.length <= 3, "höchstens drei laufen gleichzeitig: " + act.length);
  assert.strictEqual(new Set(act.map((x) => x.f)).size, act.length, "jede Familie höchstens einmal");
}
{
  // leise Stelle: keine Flammen, nur der Schein · Leicht: keine teuren Effekte · Ruhig: gar nichts
  const quiet = createScenarios().word("fire", { ...base, t: 5, energy: 0.2, kind: "intro" });
  assert.deepStrictEqual(quiet.map((x) => x.f), ["wash"]);
  assert.ok(quiet[0].k < 0.6, "im leisen Intro schwächer: " + quiet[0].k);
  const lite = createScenarios().word("money", { ...base, t: 5, lite: true });
  assert.strictEqual(lite.length, 0, "Gold-Glitzer gibt es bei Leicht nicht");
  assert.ok(createScenarios().word("star", { ...base, t: 5, lite: true }).length, "Sterne sind billig genug für Leicht");
  assert.strictEqual(createScenarios().word("fire", { ...base, t: 5, calm: true }).length, 0, "Ruhig: keine Bühnen-Antwort");
  // Blitz ohne Blitze: weich
  assert.strictEqual(createScenarios().word("lightning", { ...base, t: 5, noFlash: true })[0].soft, true);
  assert.strictEqual(createScenarios().word("lightning", { ...base, t: 5 })[0].soft, false);
  // Farb-Wort: Schleier in seiner Farbe
  const col = createScenarios().word("cyan", { ...base, t: 5, col: FX.cyan.col });
  assert.deepStrictEqual(col[0].col, FX.cyan.col);
  // Countdown: Pulse auf den nächsten Schlägen
  const cd = createScenarios().word("count", { ...base, t: 5, beat: 0.5, phase: 0.2 })[0];
  assert.ok(Math.abs(cd.off - 0.4) < 1e-9 && cd.dur > 2.4, "Countdown auf die Schläge gelegt");
}

/* ---- Blitz-Sicherheit beim Zeichnen: jeder Auslöser in jedem Bild, trotzdem höchstens 3 Blitze je Sekunde */
function mockCtx(log) {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => grad;
      if (k === "fillRect") return (x, y, w, h) => log.push({ fill: o.fillStyle, full: x === 0 && y === 0 && w >= 1000 && h >= 600 });
      return () => {};
    },
    set(o, k, v) {
      o[k] = v;
      return true;
    },
  });
}
for (const noFlash of [false, true]) {
  const log = [], ctx = mockCtx(log), cap = createFlashCap();
  const sfx = createStageFx(() => ({}), cap);
  const flashes = [];
  let seq = 0;
  for (let i = 0; i < 60 * 20; i++) {
    const t = i / 60;
    // ein neuer Blitz in jedem fünften Bild – viel mehr, als die Regie je schickt
    const cues = [];
    for (let j = 0; j < 3; j++) cues.push({ f: "bolt", fi: -1, t0: t - j * 0.08, k: 1, seq: seq + j, dur: 1.1, soft: false });
    if (i % 5 === 0) seq += 1;
    log.length = 0;
    sfx.draw(ctx, { vw: 1280, vh: 800, dpr: 1, t, pal: [[255, 0, 0], [0, 255, 0], [0, 0, 255]], cx: 640, cy: 400, R: 120, px: { scn: null }, cues, noFlash, flash: true, quality: 2 }, {}, {});
    if (log.some((x) => x.full && /^rgba\(215,225,255/.test(x.fill))) flashes.push(t);
  }
  if (noFlash) assert.strictEqual(flashes.length, 0, "ohne Blitze: kein Aufhellen des Bilds");
  else {
    // Aufhellungen gehören zu Blitzen, die die Schranke freigegeben hat: Einsätze zählen
    const onsets = flashes.filter((t, i) => i === 0 || t - flashes[i - 1] > 1.5 / 60);
    assert.ok(onsets.length > 5, "mit Blitzen blitzt es auch");
    for (let i = 0; i < onsets.length; i++) {
      const n = onsets.filter((x) => x >= onsets[i] && x < onsets[i] + 1).length;
      assert.ok(n <= 3, `${n} Blitze in einer Sekunde`);
    }
    for (let i = 1; i < onsets.length; i++) assert.ok(onsets[i] - onsets[i - 1] >= FLASH_GAP - 1e-9);
  }
}

/* ---- Lichtregie: Momente der Musik */
{
  const d = shaped("lift"), lyrics = [];
  for (const t of d.truth) {
    if (t.kind === "solo" || t.kind === "intro" || t.kind === "outro") continue;
    for (let x = t.t0 + 0.5; x < t.t1 - 1; x += 4) lyrics.push({ t: x, text: "la la la" + (lyrics.length % 5 === 2 ? " (oh oh)" : "") });
  }
  const plan = planSong(d, "rock", { lyrics });
  const truth = (k, n = 0) => d.truth.filter((x) => x.kind === k)[n];
  const at = (t) => cue(plan, t, {});
  // Stopp mitten im zweiten Refrain: Licht aus, danach der Wiedereinsatz
  const [s0, s1] = plan.mo.stops[0];
  assert.strictEqual(plan.mo.stops.length, 1, "genau ein Stopp");
  const ch2 = truth("chorus", 1), bar = plan.bar;
  assert.ok(Math.abs(s0 - (ch2.t0 + bar * 4)) < 0.3, "Stopp beginnt mit der Stille: " + s0);
  assert.ok(at(s0 + 0.5).scn.stop > 0.9 && at(s0 + 0.5).I < at(s0 - 1).I * 0.5, "im Stopp ist das Licht unten");
  assert.ok(at(s1 + 0.05).scn.back > 0.8, "Wiedereinsatz hebt an");
  // Solo ohne Gesang
  const solo = truth("solo");
  assert.ok(at((solo.t0 + solo.t1) / 2).scn.solo > 0.9, "Solo erkannt");
  assert.strictEqual(at((truth("chorus", 2).t0 + truth("chorus", 2).t1) / 2).scn.solo, 0, "gesungener Refrain ist kein Solo");
  // letzter Refrain: Finale mit Rückung
  const last = truth("chorus", 3);
  const cl = at(last.t0 + 0.05);
  assert.ok(cl.scn.mod > 0.9, "Rückung im letzten Refrain");
  assert.ok(at(last.t0 + bar * 2).scn.fin > 0.9, "Finale");
  assert.strictEqual(at(truth("chorus", 0).t0 + bar * 2).scn.fin, 0, "erster Refrain ist kein Finale");
  // Ruf und Antwort, erster Schlag, Outro
  assert.ok(plan.mo.echo.length >= 2);
  const e0 = plan.mo.echo[0];
  assert.ok(at(e0 + 0.2).scn.echo > 0.5 && at(e0 + 2).scn.echo === 0);
  assert.ok(at(plan.mo.first + 0.05).scn.open > 0.8);
  const ot = truth("outro");
  assert.ok(at(ot.t1 - 0.2).scn.out > 0.6 && at(ot.t1 - 0.2).scn.out > at(ot.t0 + 1).scn.out, "Outro wird ruhiger");
  // ein Objekt je Plan, jedes Bild nur neu befüllt
  assert.strictEqual(at(10).scn, at(20).scn);
}
{
  // Drop-Bilder: nie zweimal hintereinander dasselbe, nur aus der Palette des Stils, bei gleichem Song gleich
  for (const [name, key] of [["edm", "edm"], ["rock", "rock"], ["metal", "metal"], ["ballad", "ballad"], ["trap", "trap"], ["dnb", "dnb"], ["lift", "pop"]]) {
    const p = planSong(shaped(name), key), peaks = p.parts.filter((x) => x.dl >= 0);
    assert.ok(peaks.length >= 2, name);
    for (let i = 1; i < peaks.length; i++) assert.notStrictEqual(peaks[i].dl, peaks[i - 1].dl, `${name}: dasselbe Drop-Bild zweimal hintereinander`);
    const pal = DROP_PAL[p.sig.name];
    for (const x of peaks) assert.ok(pal.includes(DROP_LOOKS[x.dl]), `${name}: ${DROP_LOOKS[x.dl]} nicht in der Palette`);
    assert.deepStrictEqual(planSong(shaped(name), key).parts.map((x) => x.dl), p.parts.map((x) => x.dl));
    // Drop-Bild setzt auf dem Höhepunkt ein und klingt aus
    // (scn ist je Plan ein Objekt, das jedes Bild neu befüllt: Werte sofort lesen)
    const c0 = cue(p, peaks[0].t0 + 0.01, {}).scn.dx, c1 = cue(p, peaks[0].t0 + p.bar * 2, {}).scn.dx;
    assert.ok(c0 > 0.9 && c1 < 0.15, `${name}: Drop-Bild ${c0} → ${c1}`);
  }
}

// Umfang (für den Bericht)
let forms = 0;
for (const l of Object.values(LEX)) for (const v of Object.values(l.c)) forms += v.split("|").length;
console.log(`scenarios: ok (${Object.keys(STAGE).length} Begriffe mit Bühnen-Antwort, ${Object.keys(FAM).length} Familien, ${Object.keys(LEX).length} Sprachen, ${forms} Wortformen)`);
