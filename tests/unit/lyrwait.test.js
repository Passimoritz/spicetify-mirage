// node tests/unit/lyrwait.test.js
// Party zwischen Liedtext-Suche und „kein Liedtext“: Layout-Wächter, Plan-Tausch außerhalb des Bildes,
// Tempo-Suche in Häppchen
const assert = require("assert");
const { load } = require("./load.js");
const { takeLyrics, hasText, createLayoutGate } = load("lyrlayout.js");
const { createPlanSwap, fadeFor, lookOf } = load("planswap.js");
const { runSync, runIdle } = load("idlework.js");

const plain = { synced: false, lines: [{ t: 0, text: "a" }] };
const synced = { synced: true, lines: [{ t: 0, text: "a" }, { t: 2000, text: "b" }] };
const words = { synced: true, wordSynced: true, lines: synced.lines };
const instr = { synced: false, instrumental: true, lines: [] };

// ---- welches Ergebnis wird gezeigt
{
  assert.ok(hasText(plain) && !hasText(instr) && !hasText(null));
  assert.equal(takeLyrics(undefined, null), true, "noch nichts gezeigt: auch „nichts“ zeigen");
  assert.equal(takeLyrics(plain, instr), false, "Instrumental verdrängt keinen Text");
  assert.equal(takeLyrics(plain, null), false, "nichts verdrängt keinen Text");
  assert.equal(takeLyrics(plain, synced), true, "besser ersetzt");
  assert.equal(takeLyrics(synced, synced), false, "dasselbe nicht neu");
  assert.equal(takeLyrics(null, plain), true, "Text nach „nichts“");
  assert.equal(takeLyrics(instr, words), true, "Text nach Instrumental");
}

// ---- Layout: je Song höchstens ein Wechsel
{
  const g = createLayoutGate();
  // Song 1: Text da (Layout bleibt), dann NetEase-Instrumental (würde früher umschalten) – bleibt
  assert.equal(g.next("s1", plain, false), false);
  assert.equal(g.next("s1", instr, false), false, "kein Wechsel ohne Not – Text bleibt");
  // Song 2: nichts gefunden → einmal ins Layout ohne Liedtext
  assert.equal(g.next("s2", null, false), true);
  // ein schlichter Text danach tauscht nur den Text, nicht das Layout
  assert.equal(g.next("s2", plain, true), true, "zweiter Wechsel nur für zeitgenauen Text");
  // zeitgenauer Text: einmal zurück
  assert.equal(g.next("s2", synced, true), false, "zeitgenauer Text holt das Layout zurück");
  // und dabei bleibt es
  assert.equal(g.next("s2", instr, false), false);
  // Song 3 (startet im Layout mit Text): Instrumental → ohne, Wort für Wort → zurück, Instrumental → bleibt
  assert.equal(g.next("s3", instr, false), true);
  assert.equal(g.next("s3", words, true), false);
  assert.equal(g.next("s3", null, false), false);
  // neu laden (andere Fassung): der Song darf wieder wechseln
  g.reset();
  assert.equal(g.next("s3", instr, false), true);
}

// ---- Plan-Tausch: nie im Bild, alter Stand bis der neue fertig ist, weiche Übergänge
{
  const queue = [];
  let builds = 0;
  const build = (d, key, ln) => (builds++, { map: { d }, plan: { parts: [{ kind: "verse", t0: 0, look: { I: d.I ?? 1 }, emo: { name: ln > 1 ? "sad" : "calm" } }], key } });
  const sw = createPlanSwap({ build, schedule: (fn) => queue.push(fn) });
  const flush = () => queue.splice(0).forEach((f) => f());
  const d1 = { id: 1 }, d2 = { id: 2 }, d3 = { id: 3 };
  let r = sw.get(d1, "pop", "u1", 0);
  assert.equal(r.d, null, "neuer Song: erst neutral");
  assert.equal(builds, 0, "nichts im Bild gerechnet");
  r = sw.get(d1, "pop", "u1", 0);
  assert.equal(queue.length, 1, "nur einmal eingeplant");
  flush();
  r = sw.get(d1, "pop", "u1", 0);
  assert.equal(r.d, d1);
  assert.equal(r.fade, 0.6, "neuer Song: 0,6 s");
  // genauere Taktdaten zum selben Song: bis fertig der alte Stand, dann 1,5 s
  r = sw.get(d2, "pop", "u1", 0);
  assert.equal(r.d, d1, "alter Stand bleibt");
  flush();
  r = sw.get(d2, "pop", "u1", 0);
  assert.equal(r.d, d2);
  assert.equal(r.fade, 1.5, "bessere Taktdaten: 1,5 s");
  // Liedtext, der den Look nicht ändert: kein Überblenden
  r = sw.get(d2, "pop", "u1", 1);
  flush();
  r = sw.get(d2, "pop", "u1", 1);
  assert.equal(r.fade, 0, "gleicher Look: nicht überblenden");
  // Liedtext, der die Stimmung ändert: weich
  sw.get(d2, "pop", "u1", 2);
  flush();
  assert.equal(sw.get(d2, "pop", "u1", 2).fade, 1.5);
  // schnell geskippt: nur der neueste Wunsch wird gerechnet
  const before = builds;
  sw.get(d1, "pop", "u2", 0);
  sw.get(d3, "pop", "u3", 0);
  assert.equal(sw.get(d3, "pop", "u3", 0).d, null, "anderer Song: nicht mit alten Daten");
  flush();
  assert.equal(builds, before + 1, "übersprungener Song wird nicht gerechnet");
  assert.equal(sw.get(d3, "pop", "u3", 0).d, d3);
  // ohne Daten: leer
  assert.equal(sw.get(null, "pop", "u3", 0).d, null);
  // Fingerabdruck und Übergänge
  assert.equal(fadeFor(null, { uri: "a" }), 0.6);
  assert.equal(fadeFor({ uri: "a", key: "x", d: 1 }, { uri: "a", key: "y", d: 1 }), 0.6, "anderer Stil");
  assert.equal(lookOf(null), "");
}

// ---- Häppchen-Rechnung: gleiches Ergebnis am Stück und verteilt
(async () => {
  function* count(n) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      s += i;
      if (i % 10 === 9) yield;
    }
    return s;
  }
  assert.equal(runSync(count(100)), 4950);
  assert.equal(await runIdle(count(100)), 4950);
  console.log("lyrwait: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
