// node tests/unit/lyricstyle.test.js
// Verspielter Liedtext-Stil: Betonung aus Wortzeiten und Lautheit, gehaltene Töne, gerufene Zeilen, Hintergrundgesang,
// Satz der Teile (aus der Lichtregie oder aus Wiederholungen), Takt, Wortbilder – und dass ohne Analyse nichts bricht.
const assert = require("assert");
const { load } = require("./load.js");
const {
  wordLoud, emphasis, heldNotes, isShout, sectionKind, sectionStyle, adlibPose, isAdlib, voiceSide,
  onBeat, beatPhase, cueOf, cueMatcher, planPlayful,
} = load("lyricstyle.js");
const { LEX } = load("lexicon.js");
const { shaped } = require("./songshapes.js");

// Wörter einer Zeile: [Text, Anfang ms, Dauer ms]
const W = (spec) => spec.map(([text, a, d]) => ({ text, a, b: a + d }));
// Segmente: je 100 ms eins, Lautheit nach Funktion (Zeit in ms → dB)
const SEGS = (from, to, f) => {
  const out = [];
  for (let t = from; t < to; t += 100) out.push({ t: t / 1000, l: f(t) });
  return out;
};

/* ---- Lautheit eines Worts: das Lauteste darin */
{
  const segs = SEGS(0, 3000, (t) => (t >= 1000 && t < 1300 ? -4 : -14));
  assert.equal(wordLoud(segs, 1000, 1300), -4);
  assert.equal(wordLoud(segs, 0, 500), -14);
  assert.equal(wordLoud(null, 0, 500), null);
}

/* ---- Betonung: lautes Wort größer/kräftiger, leises/gehauchtes dünner, ohne Analyse nur Schreibweise und Dauer */
{
  const ws = W([["I", 0, 250], ["really", 300, 250], ["NEED", 600, 300], ["you", 950, 250], ["now", 1250, 250]]);
  // „really“ laut gesungen, „you“ leise
  const segs = SEGS(0, 2000, (t) => (t >= 300 && t < 550 ? -3 : t >= 950 && t < 1200 ? -19 : -11));
  const em = emphasis(ws, { segs, avg: -11 });
  assert.equal(em[1].cls, "is-p-loud", "laut gesungenes Wort");
  assert.ok(em[1].z > 1 && em[1].z <= 1.16);
  assert.equal(em[2].cls, "is-p-loud", "Großbuchstaben betonen");
  assert.equal(em[3].cls, "is-p-soft", "leises Wort");
  assert.ok(em[3].z >= 0.88 && em[3].z < 1, "leise, aber nie kleiner als 88 %");
  assert.equal(em[0].cls, "");
  // höchstens ein Drittel einer Zeile ist laut
  const shout = emphasis(W([["HEY", 0, 200], ["HEY", 250, 200], ["HEY", 500, 200], ["HEY", 750, 200], ["HEY", 1000, 200], ["HEY", 1250, 200]]), {});
  assert.equal(shout.filter((e) => e.cls === "is-p-loud").length, 2);
  // gehaucht und Hintergrund: leise; Ausrufezeichen: laut – auch ohne Analyse
  const t = emphasis(W([["(ooh)", 0, 300], ["go!", 400, 300], ["on", 800, 300]]), {});
  assert.equal(t[0].cls, "is-p-soft");
  assert.equal(t[1].cls, "is-p-loud");
  // geschätzte Analyse (synthetic) liefert keine echte Lautheit: wird ignoriert
  const fake = emphasis(ws, { segs, avg: -11, synthetic: true });
  assert.notEqual(fake[1].cls, "is-p-loud");
  // Größe bleibt immer im lesbaren Bereich (nie unter 70 % der normalen Größe)
  for (const e of [...em, ...shout, ...t]) assert.ok(e.z >= 0.7 && e.z <= 1.2);
  assert.deepEqual(emphasis([], {}), []);
}

/* ---- Gehaltene Töne: viel länger als der Rest der Zeile */
{
  const h = heldNotes(W([["so", 0, 250], ["long", 300, 1600], ["my", 2000, 220], ["love", 2300, 300]]));
  assert.deepEqual(h.map((x) => x.held), [false, true, false, false]);
  assert.equal(h[1].hd, 1600);
  // gleichmäßig gesungen: nichts gehalten
  assert.ok(heldNotes(W([["a", 0, 400], ["b", 450, 420], ["c", 900, 450]])).every((x) => !x.held));
  // kurze Wörter, die nur „doppelt so lang“ sind, sind kein gehaltener Ton (mindestens 650 ms)
  assert.ok(!heldNotes(W([["a", 0, 200], ["b", 250, 500], ["c", 800, 200]]))[1].held);
  // geschätzte Wortzeiten wissen nichts vom Halten
  const est = W([["so", 0, 250], ["long", 300, 1600], ["my", 2000, 220]]).map((w) => ({ ...w, est: true }));
  assert.ok(heldNotes(est).every((x) => !x.held));
  // ein einzelnes Wort: erst ab 1,2 s
  assert.ok(heldNotes(W([["ooooh", 0, 1500]]))[0].held);
}

/* ---- Gerufene Zeilen */
assert.ok(isShout("WE WILL ROCK YOU"));
assert.ok(isShout("come on!"));
assert.ok(isShout("Jump!!"));
assert.ok(!isShout("I walk alone tonight"));
assert.ok(!isShout("I"), "ein einzelnes großes I ist kein Rufen");
assert.ok(isShout("go go go", -3, -5), "Lautheits-Spitze, kurze Zeile");
assert.ok(!isShout("this is a long line that just happens to be loud", -3, -5), "lange Zeile bleibt");
assert.ok(!isShout("我爱你"), "Schriften ohne Groß-/Kleinschreibung rufen nicht wegen Großbuchstaben");

/* ---- Hintergrundgesang in Klammern */
assert.ok(isAdlib(["(oh", "yeah)"]));
assert.ok(!isAdlib(["(x2)"]), "Regieanweisung ist kein Hintergrundgesang");
assert.ok(!isAdlib(["I", "said", "(yeah)"]), "nur ein Teil der Zeile");
{
  const a = adlibPose(0), b = adlibPose(1);
  assert.ok(a.rot < 0 && b.rot > 0, "abwechselnd geneigt");
  assert.ok(Math.abs(a.rot) <= 4 && Math.abs(b.rot) <= 4, "nur leicht schräg");
}

/* ---- Duett-Seiten */
assert.equal(voiceSide("1"), "is-p-left");
assert.equal(voiceSide("2"), "is-p-right");
assert.equal(voiceSide("all"), "is-p-mid");
assert.equal(voiceSide(undefined), "");

/* ---- Teile: Refrain groß, Strophe kompakt, Bridge anders, Rand ruhig */
assert.equal(sectionStyle("chorus"), "is-p-chorus");
assert.equal(sectionStyle("drop"), "is-p-chorus");
assert.equal(sectionStyle("verse"), "is-p-verse");
assert.equal(sectionStyle("bridge"), "is-p-bridge");
assert.equal(sectionStyle("outro"), "is-p-calm");
assert.equal(sectionStyle("verse", { repeated: true }), "is-p-chorus", "wiederholte Zeile = Hook");
assert.equal(sectionStyle("bridge", { repeated: true }), "is-p-bridge");
assert.equal(sectionStyle("", { repeated: true }), "is-p-chorus", "ohne Analyse: Wiederholung = Refrain");
assert.equal(sectionStyle(""), "is-p-verse");
{
  const parts = [{ t0: 0, kind: "intro" }, { t0: 10, kind: "verse" }, { t0: 30, kind: "chorus" }];
  assert.equal(sectionKind(parts, 5000), "intro");
  assert.equal(sectionKind(parts, 29900), "chorus", "knapp vor der Grenze gehört schon zum neuen Teil");
  assert.equal(sectionKind(parts, 15000), "verse");
  assert.equal(sectionKind(null, 1000), "");
}

/* ---- Takt */
{
  const beats = [0, 0.5, 1, 1.5, 2].map((t) => ({ t }));
  assert.ok(onBeat(1020, beats));
  assert.ok(!onBeat(1250, beats));
  assert.ok(!onBeat(1000, null));
  assert.deepEqual(beatPhase(beats, 1.2), { p: 500, d: -200 });
  assert.equal(beatPhase(beats, 5), null, "hinter dem letzten Schlag nichts");
  assert.equal(beatPhase([{ t: 0 }, { t: 3 }], 1), null, "unplausible Schlaglänge");
}

/* ---- Wortbilder: über das Wörterbuch (words.js) und die kleine Liste für Fallen/Steigen */
assert.equal(cueOf("fire"), "flicker");
assert.equal(cueOf("rain"), "drip");
assert.equal(cueOf("heart"), "pulse");
assert.equal(cueOf("fly"), "rise");
assert.equal(cueOf("money"), "");
{
  const lines = [{ text: "I feel the fire" }, { text: "rain on my heart" }, { text: "we fly so high" }, { text: "don't let me fall" }];
  const m = cueMatcher(lines, LEX);
  assert.deepEqual(m("I feel the fire").map((x) => x.cue), ["flicker"]);
  assert.deepEqual(m("rain on my heart").map((x) => x.cue), ["drip", "pulse"]);
  assert.deepEqual(m("we fly so high").map((x) => x.cue), ["rise", "rise"]);
  assert.deepEqual(m("don't let me fall").map((x) => x.cue), ["fall"]);
  // ohne Wörterbuch: nur die eigene kleine Liste
  assert.deepEqual(cueMatcher(lines, null)("fire falling").map((x) => x.cue), ["fall"]);
}

/* ---- Alles zusammen: Song mit Analyse (Lichtregie) und ohne */
{
  const d = shaped("rock"); // Strophe ab 8 s, Refrain ab 32 s, Bridge ab 88 s
  const lines = [], words = [];
  const add = (t, text, durs) => {
    const ws = text.split(" ").map((x, k) => ({ text: x, a: t + durs.slice(0, k).reduce((s, v) => s + v + 50, 0), b: 0 }));
    ws.forEach((w, k) => (w.b = w.a + durs[k]));
    lines.push({ t, text });
    words.push(ws);
  };
  add(10000, "walking down the empty street", [300, 250, 200, 300, 400]);
  add(34000, "set my heart on fire", [250, 250, 300, 250, 1800]);
  add(36500, "(oh yeah)", [300, 300]);
  add(90000, "and we fall apart", [250, 250, 400, 400]);
  add(106000, "set my heart on fire", [250, 250, 300, 250, 1800]);
  const plan = planPlayful(lines, words, d, { lexicon: LEX });
  assert.equal(plan.length, lines.length);
  assert.ok(plan[0].cls.includes("is-p-verse"), "Strophe: " + plan[0].cls);
  assert.ok(plan[1].cls.includes("is-p-chorus"), "Refrain: " + plan[1].cls);
  assert.ok(plan[3].cls.includes("is-p-bridge"), "Bridge: " + plan[3].cls);
  assert.ok(plan[2].cls.includes("is-p-adlib"), "Hintergrundgesang");
  assert.ok(plan[2].vars["--pr"].endsWith("deg"));
  const fire = plan[1].words[4];
  assert.ok(fire.cls.includes("is-p-held"), "gehaltenes „fire“");
  assert.equal(fire.vars["--hd"], "1800ms");
  assert.ok(fire.cls.includes("is-p-flicker"), "Feuer flackert");
  assert.ok(plan[1].words[2].cls.includes("is-p-pulse"), "Herz pocht");
  assert.ok(plan[3].words[2].cls.includes("is-p-fall"), "fallen fällt");
  // höchstens zwei Wortbilder je Zeile
  for (const p of plan) assert.ok(p.words.filter((w) => w.cls.includes("is-p-cue")).length <= 2);
  // ohne Analyse: Wiederholung macht den Refrain, nichts wirft
  const bare = planPlayful(lines, words, null, { lexicon: LEX });
  assert.ok(bare[1].cls.includes("is-p-chorus"));
  assert.ok(bare[0].cls.includes("is-p-verse"));
  assert.ok(bare.every((p) => p.words.every((w) => !w.cls.includes("is-p-beat"))), "ohne Takt keine Schlag-Wörter");
  // Zeilen ohne Wort-Elemente (kein Karaoke-Aufbau): nur Zeilen-Klassen
  const noWords = planPlayful(lines, [], null, { match: () => [] });
  assert.ok(noWords.every((p) => p.words.length === 0 && p.cls.length > 0));
  // Duett: Seite je Stimme
  const duet = planPlayful([{ t: 0, text: "hello", who: "1" }, { t: 2000, text: "hi there", who: "2" }], [], null, { match: () => [] });
  assert.ok(duet[0].cls.includes("is-p-left") && duet[1].cls.includes("is-p-right"));
  // Auftritt nach dem Drop: die erste gesungene Zeile danach
  const dropped = planPlayful(lines, words, null, { parts: [{ t0: 0, kind: "verse" }, { t0: 33.5, kind: "drop" }], drops: [33.5], match: () => [] });
  assert.ok(dropped[1].cls.includes("is-p-drop") && !dropped[0].cls.includes("is-p-drop"));
}

/* ---- Kosten: einmal je Song, nicht im Bild – 80 Zeilen bleiben klein */
{
  const d = shaped("edm");
  const lines = [], words = [];
  for (let i = 0; i < 80; i++) {
    const t = 5000 + i * 2000;
    lines.push({ t, text: "we are burning in the rain tonight" });
    words.push("we are burning in the rain tonight".split(" ").map((x, k) => ({ text: x, a: t + k * 250, b: t + k * 250 + 220 })));
  }
  planPlayful(lines, words, d, { lexicon: LEX });
  const t0 = performance.now();
  planPlayful(lines, words, d, { lexicon: LEX });
  const ms = performance.now() - t0;
  assert.ok(ms < 80, "Planung zu langsam: " + ms.toFixed(1) + " ms");
}

console.log("lyricstyle: ok");
