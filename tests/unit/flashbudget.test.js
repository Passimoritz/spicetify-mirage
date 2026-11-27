// node tests/unit/flashbudget.test.js
// Ein Budget für alle Blitze des Party-Modus (flashcap.js): Farbfläche, Blitze der Bühnenbilder (Gewitter, Schüsse,
// Blitz – stagefx.js/scenefx.js) und Wortbilder (words.js) zusammen höchstens drei pro Sekunde. Geprüft wird auf
// Modulebene, mit Canvas-Attrappen: die Bühne zündet nur mit Freigabe des Hauptthreads (st.flashGo), die Wortbilder
// fragen die übergebene Funktion, und alles, was aufblitzt, fällt in ein Bild, das das Budget freigegeben hat.
// (party.js selbst lässt sich hier nicht laden – es braucht Spotify; sein Budget ist createFlashBudget.)
const assert = require("assert");
const { load } = require("./load.js");
const { createFlashCap, createFlashBudget, createCueFlash, flashTimes, FLASH_GAP, FLASH_AT, FLASH_ASK, FLASH_WAIT } = load("flashcap.js");
const { createStageFx } = load("stagefx.js");
const { FAM, FAMS } = load("scenarios.js");

const FPS = 60, VW = 1600, VH = 900;
const pal = [[255, 80, 120], [80, 160, 255], [255, 220, 90]];
const alphaOf = (style) => Number(/,([\d.]+)\)$/.exec(String(style))?.[1] ?? 0);
// höchstens 3 in jedem Fenster von einer Sekunde, Abstand mindestens FLASH_GAP
function assertRate(times, what) {
  for (let i = 0; i < times.length; i++) {
    const n = times.filter((x) => x >= times[i] && x < times[i] + 1).length;
    assert.ok(n <= 3, `${what}: ${n} Blitze in einer Sekunde ab ${times[i].toFixed(2)} s`);
    if (i) assert.ok(times[i] - times[i - 1] >= FLASH_GAP - 1e-9, `${what}: Abstand ${(times[i] - times[i - 1]).toFixed(3)} s`);
  }
}

/* ---- 1) das Budget: was im selben Bild gefragt wird, ist ein Blitz; sonst gilt der Mindestabstand */
{
  let wall = 0;
  const b = createFlashBudget(createFlashCap(), () => wall);
  b.frame();
  assert.equal(b.take(10), true);
  assert.equal(b.take(10), true, "dasselbe Bild: derselbe Blitz");
  b.frame();
  wall += 16;
  assert.equal(b.take(10.016), false, "nächstes Bild: kein weiterer Blitz");
  b.frame();
  assert.equal(b.take(10.2), false);
  b.frame();
  assert.equal(b.take(10.35), true);
  // die Party rechnet nicht mehr (kein frame(), die Uhr steht): die Freigabe verfällt, es kommt keine neue
  wall += 10;
  assert.equal(b.take(10.35), true);
  wall += 100;
  assert.equal(b.take(10.35), false, "ohne neues Bild bleibt die Freigabe nicht stehen");
  assert.equal(b.take(10.35), false);

  // jeder fragt in jedem Bild, bei jeder Bildrate: nie mehr als 3 Freigabe-Bilder je Sekunde
  for (const fps of [24, 60, 144]) {
    const bud = createFlashBudget(createFlashCap(), () => wall), frames = [];
    for (let i = 0; i < fps * 12; i++) {
      const t = i / fps;
      wall = t * 1000;
      bud.frame();
      let go = false;
      for (let k = 0; k < 4; k++) go = bud.take(t) || go;
      if (go) frames.push(t);
    }
    assert.ok(frames.length > 20, "es blitzt überhaupt");
    assertRate(frames, `Budget bei ${fps} Bildern/s`);
  }
}

/* ---- 2) Blitz-Zeitpunkte der Bühnenbilder: der Hauptthread bittet genau dort, je Zeitpunkt einmal, weich nie */
{
  assert.deepStrictEqual(Array.from(FLASH_AT.thunder), [0.5, 2.2]);
  assert.equal(FLASH_AT.muzzle.length, 3);
  assert.equal(FLASH_AT.rapid.length, 9);
  assert.equal(flashTimes({ f: "muzzle", from: "rapid" }), FLASH_AT.rapid);
  assert.equal(flashTimes({ f: "muzzle", from: "top" }), FLASH_AT.muzzle);
  assert.equal(flashTimes({ f: "wash" }), null);
  for (const f of ["bolt", "thunder", "muzzle"]) assert.ok(FAM[f].flash, `${f} gilt in scenarios.js als Blitz-Bild`);
  for (const f of FAMS) if (FAM[f].flash) assert.ok(flashTimes({ f }), `Blitz-Bild ${f} hat Blitz-Zeitpunkte`);
  assert.ok(FLASH_ASK < FLASH_WAIT && FLASH_WAIT <= 0.12);

  const ask = createCueFlash(), asked = [];
  const cue = { f: "thunder", t0: 10, seq: 5, soft: false };
  for (let i = 0; i < FPS * 4; i++) {
    const t = 10 + i / FPS;
    if (ask([{ ...cue }], t, () => (asked.push(t), true))) assert.ok(asked.includes(t));
  }
  assert.equal(asked.length, 2, "Gewitter: zwei Zeitpunkte, je einmal freigegeben");
  assert.ok(Math.abs(asked[0] - 10.5) < 1.5 / FPS && Math.abs(asked[1] - 12.2) < 1.5 / FPS);
  // abgelehnt: innerhalb des Fensters weiter bitten, danach nicht mehr
  const ask2 = createCueFlash();
  let n = 0;
  for (let i = 0; i < FPS; i++) ask2([{ f: "bolt", t0: 10, seq: 1 }], 10 + i / FPS, () => (n++, false));
  assert.ok(n >= 2 && n <= Math.ceil(FLASH_ASK * FPS) + 1, `Blitz: ${n} Bitten im Fenster`);
  // weich (Blitze aus oder „Keine Blitze“), fremde Bilder, keine Antworten: nie
  const ask3 = createCueFlash(), never = () => assert.fail("darf nicht fragen");
  for (let i = 0; i < FPS * 4; i++) {
    const t = 10 + i / FPS;
    assert.equal(ask3([{ f: "thunder", t0: 10, seq: 1, soft: true }, { f: "wash", t0: 10, seq: 2 }], t, never), false);
    assert.equal(ask3(null, t, never), false);
  }
}

/* ---- 3) die Bühne: Gewitter, Schüsse und Blitze in absurder Dichte */
// Attrappe: merkt je Bild die Stärke der drei Blitz-Arten (bildfüllendes Wetterleuchten, bildfüllender Blitz,
// heißes Mündungsfeuer als Leuchtbild)
const HOT = "255,245,220";
function stageCtx(now) {
  const own = { globalAlpha: 1, fillStyle: "", createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) };
  own.fillRect = (x, y, w, h) => {
    if (x !== 0 || y !== 0 || w < VW || h < VH) return;
    const s = String(own.fillStyle);
    if (/^rgba\(200,215,255/.test(s)) now.thunder = Math.max(now.thunder, alphaOf(s));
    if (/^rgba\(215,225,255/.test(s)) now.bolt = Math.max(now.bolt, alphaOf(s));
  };
  own.drawImage = (img) => {
    if (img === HOT) now.muzzle = Math.max(now.muzzle, own.globalAlpha);
  };
  return new Proxy(own, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) });
}
// neuer Blitz in diesem Bild: eine bildfüllende Fläche wird heller, oder das Mündungsfeuer springt an (das Leuchtbild
// des allerersten Schusses blendet mit der Antwort weich ein, höchstens 0,011 je Bild – das ist kein Blitz)
const rose = (now, prev) => now.thunder > prev.thunder + 1e-4 || now.bolt > prev.bolt + 1e-4 || now.muzzle > prev.muzzle + 0.02;
const stBase = (t, extra) => ({ t, dt: 1 / FPS, vw: VW, vh: VH, dpr: 1, cx: VW / 2, cy: VH * 0.45, R: VH * 0.15, pal, quality: 2, px: { scn: null }, flash: true, noFlash: false, ...extra });
// laufende Antworten zur Zeit t: alle 0,1 s beginnt ein Gewitter, eine Salve, drei Schüsse und ein Blitz –
// weit mehr, als scenarios.js je schickt (dort höchstens drei zugleich). In jedem Bild neue Kopien (wie im Thread).
function cuesAt(t, soft = false) {
  const out = [], n0 = Math.floor((t - 4.5) / 0.1), n1 = Math.floor(t / 0.1);
  for (let n = Math.max(0, n0); n <= n1; n++) {
    const t0 = n * 0.1;
    [["thunder", "top"], ["muzzle", "rapid"], ["muzzle", "top"], ["bolt", "top"]].forEach(([f, from], j) => {
      if (t - t0 < FAM[f].dur + 0.5) out.push({ f, fi: FAMS.indexOf(f), t0, k: 1.15, col: null, from, seq: n * 4 + j + 1, dur: FAM[f].dur, v: 0, dir: 1, ox: 0.3, soft });
    });
  }
  return out;
}
// ein Lauf der Bühne: goOf(t, cues) liefert st.flashGo des Bilds. Ergebnis: Bilder, in denen ein Blitz neu aufleuchtet
function runStage(secs, goOf, extra = {}) {
  const sfx = createStageFx((c) => String(c), createFlashCap()), onsets = [], go = [];
  let prev = { thunder: 0, bolt: 0, muzzle: 0 }, any = 0;
  for (let i = 0; i < secs * FPS; i++) {
    const t = 10 + i / FPS, cues = cuesAt(t - 10, extra.soft).map((c) => ({ ...c, t0: c.t0 + 10 })), now = { thunder: 0, bolt: 0, muzzle: 0 };
    const flashGo = goOf(t, cues);
    if (flashGo) go.push(t);
    sfx.draw(stageCtx(now), stBase(t, { cues, flashGo, ...extra.st }), {}, {});
    any = Math.max(any, now.thunder, now.bolt, now.muzzle);
    if (rose(now, prev)) onsets.push(t);
    prev = now;
  }
  return { onsets, go, any };
}
{
  // (a) ohne Freigabe aus dem Hauptthread: gar kein Blitz, in keinem Bild
  const a = runStage(12, () => false);
  assert.equal(a.any, 0, "ohne Freigabe (flashGo: false) blitzt kein Bühnenbild");

  // (b) Freigabe aus einem gemeinsamen Budget: nie mehr als 3 Blitz-Einsätze in einer Sekunde,
  // und jeder Einsatz liegt in einem freigegebenen Bild
  const ask = createCueFlash();
  let wall = 0;
  const budget = createFlashBudget(createFlashCap(), () => wall);
  const b = runStage(20, (t, cues) => {
    wall = t * 1000;
    budget.frame();
    return ask(cues, t, () => budget.take(t));
  });
  assert.ok(b.onsets.length > 20, `mit Freigabe blitzt es auch (${b.onsets.length})`);
  assertRate(b.onsets, "Bühnenbilder");
  for (const t of b.onsets) assert.ok(b.go.includes(t), `Blitz bei ${t.toFixed(3)} s ohne Freigabe in diesem Bild`);

  // die Freigabe kommt ein paar Bilder zu spät an (Hintergrund-Thread): innerhalb von FLASH_WAIT zündet der Blitz noch
  for (const [late, fires] of [[0.05, true], [FLASH_WAIT + 0.05, false]]) {
    const sfx = createStageFx((c) => String(c), createFlashCap());
    let max = 0;
    for (let i = 0; i < FPS; i++) {
      const t = 10 + i / FPS, now = { thunder: 0, bolt: 0, muzzle: 0 }, d = t - 10;
      sfx.draw(stageCtx(now), stBase(t, { cues: [{ f: "bolt", fi: FAMS.indexOf("bolt"), t0: 10, k: 1, seq: 1, dur: 1.1, soft: false }], flashGo: d >= late && d < late + 1.5 / FPS }), {}, {});
      max = Math.max(max, now.bolt);
    }
    assert.equal(max > 0, fires, `Freigabe ${late.toFixed(2)} s nach dem Blitz-Zeitpunkt`);
  }

  // (c) „Keine Blitze“: keiner – auch mit Freigabe in jedem Bild; ebenso weiche Antworten und Blitze aus
  assert.equal(runStage(8, () => true, { st: { noFlash: true } }).any, 0, "„Keine Blitze“ mit Freigabe");
  assert.equal(runStage(8, () => true, { st: { noFlash: true, flash: false }, soft: true }).any, 0, "„Keine Blitze“, weich");
  assert.equal(runStage(8, () => true, { soft: true }).any, 0, "weiche Antworten");
  assert.equal(runStage(8, () => true, { st: { flash: false } }).any, 0, "Blitze aus");
}

/* ---- 4) Wortbilder (words.js): Blitz, Knall und Flackern fragen die übergebene Funktion */
// words.js zeichnet auf ein eigenes Canvas (document.createElement): eine Attrappe, die bildfüllende Flächen merkt
const fills = [];
global.document = {
  createElement: () => {
    const own = { globalAlpha: 1, fillStyle: "", createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) };
    own.fillRect = (x, y, w, h) => {
      if (x === 0 && y === 0 && w >= VW && h >= VH) fills.push(String(own.fillStyle));
    };
    const ctx = new Proxy(own, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) });
    return { width: 0, height: 0, getContext: () => ctx };
  },
};
const { createWordFx } = load("words.js");
const mainCtx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) });
const wst = (t, extra) => ({ pos: t * 1000, now: t * 1000, dt: 1 / FPS, w: VW, h: VH, dpr: 1, cx: VW / 2, cy: VH * 0.45, R: VH * 0.15, pal, level: 4, beat: 0, beatIdx: 0, playing: true, noFlash: false, ...extra });
// ein Lauf: in jedem Bild so viele Wortbilder starten, wie hineinpassen. Ergebnis: Bilder mit neuem Aufhellen je Art
const WORD_FILL = { bolt: /^rgba\(220,230,255/, boom: /^rgba\(255,240,220/, flicker: /^rgba\(160,210,255/ };
function runWords(secs, words, extraOf) {
  const wfx = createWordFx(null), onsets = [], seen = { bolt: 0, boom: 0, flicker: 0 };
  let prev = { bolt: 0, boom: 0, flicker: 0 };
  for (let i = 0; i < secs * FPS; i++) {
    const t = 10 + i / FPS, st = wst(t, extraOf(t));
    for (const w of words) wfx.fire(w, st);
    fills.length = 0;
    wfx.draw(mainCtx, st);
    const now = { bolt: 0, boom: 0, flicker: 0 };
    for (const s of fills) for (const k in WORD_FILL) if (WORD_FILL[k].test(s)) now[k] = Math.max(now[k], alphaOf(s)), seen[k]++;
    if (now.bolt > prev.bolt + 1e-4 || now.boom > prev.boom + 1e-4 || now.flicker > prev.flicker + 1e-4) onsets.push(t);
    prev = now;
  }
  return { onsets, seen };
}
{
  const WORDS = ["lightning", "storm", "boom", "electric"];
  // ohne Freigabe: kein Aufhellen
  const none = runWords(8, WORDS, () => ({ takeFlash: () => false }));
  assert.deepStrictEqual(none.seen, { bolt: 0, boom: 0, flicker: 0 }, "ohne Freigabe hellt kein Wortbild das Bild auf");
  // „Keine Blitze“: die Funktion wird nicht einmal gefragt
  const nf = runWords(8, WORDS, () => ({ noFlash: true, takeFlash: () => assert.fail("„Keine Blitze“ fragt das Budget nicht") }));
  assert.deepStrictEqual(nf.seen, { bolt: 0, boom: 0, flicker: 0 });
  // mit Budget: jeder Einsatz in einem freigegebenen Bild, höchstens 3 je Sekunde
  let wall = 0;
  const budget = createFlashBudget(createFlashCap(), () => wall), go = new Set();
  const w = runWords(20, WORDS, (t) => ((wall = t * 1000), budget.frame(), { takeFlash: () => budget.take(t) && !!go.add(t) }));
  assert.ok(w.seen.bolt > 0 && w.onsets.length > 10, `mit Budget blitzen die Wortbilder auch (${w.onsets.length})`);
  assertRate(w.onsets, "Wortbilder");
  for (const t of w.onsets) assert.ok(go.has(t), `Wortbild blitzt bei ${t.toFixed(3)} s ohne Freigabe`);
  // ohne übergebene Funktion (TV-Ansicht): die eigene Schranke
  const own = runWords(12, ["lightning", "storm"], () => ({}));
  assert.ok(own.onsets.length > 5);
  assertRate(own.onsets, "Wortbilder mit eigener Schranke");
}

/* ---- 5) alles zusammen an einem Budget: Farbfläche in jedem Bild gewünscht, Bühnenbilder und Wortbilder in
   absurder Dichte – zusammen höchstens 3 Bilder je Sekunde, in denen irgendetwas neu aufblitzt */
for (const partyEvery of [1, 7, 0]) {
  let wall = 0, tNow = 0;
  const budget = createFlashBudget(createFlashCap(), () => wall), ask = createCueFlash(), granted = new Set();
  const take = () => budget.take(tNow) && !!granted.add(tNow);
  const wfx = createWordFx(null), sfx = createStageFx((c) => String(c), createFlashCap());
  const onsets = [], kinds = { party: 0, stage: 0, words: 0 };
  let prevS = { thunder: 0, bolt: 0, muzzle: 0 }, prevW = 0;
  for (let i = 0; i < 20 * FPS; i++) {
    const t = (tNow = 10 + i / FPS);
    wall = t * 1000;
    budget.frame();
    let on = false;
    // party.step: die Farbfläche (und die Freigabe für die Bühne)
    let flashGo = !!partyEvery && i % partyEvery === 0 && take();
    if (flashGo) on = !!++kinds.party;
    // immersive.js: Blitz-Zeitpunkte der Bühnenbilder, dann das Bild der Bühne
    const cues = cuesAt(t - 10).map((c) => ({ ...c, t0: c.t0 + 10 }));
    flashGo = ask(cues, t, take) || flashGo;
    const now = { thunder: 0, bolt: 0, muzzle: 0 };
    sfx.draw(stageCtx(now), stBase(t, { cues, flashGo }), {}, {});
    if (rose(now, prevS)) on = !!++kinds.stage;
    prevS = now;
    // danach die Wortbilder
    const st = wst(t, { takeFlash: take });
    for (const w of ["lightning", "storm", "boom"]) wfx.fire(w, st);
    fills.length = 0;
    wfx.draw(mainCtx, st);
    const a = Math.max(0, ...fills.filter((s) => WORD_FILL.bolt.test(s) || WORD_FILL.boom.test(s)).map(alphaOf));
    if (a > prevW + 1e-4) on = !!++kinds.words;
    prevW = a;
    if (on) {
      onsets.push(t);
      assert.ok(granted.has(t), `Blitz bei ${t.toFixed(3)} s in einem Bild ohne Freigabe`);
    }
  }
  assert.ok(onsets.length > 20, "es blitzt überhaupt");
  assertRate(onsets, `alles zusammen (Farbfläche alle ${partyEvery} Bilder)`);
  if (!partyEvery) assert.ok(kinds.stage > 0 && kinds.words > 0, `ohne Farbfläche kommen Bühne (${kinds.stage}) und Wortbilder (${kinds.words}) zum Zug`);
}

console.log("flashbudget: ok");
