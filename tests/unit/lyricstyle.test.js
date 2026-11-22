// node tests/unit/lyricstyle.test.js
// Verspielter Liedtext-Stil: Betonung aus Wortzeiten und Lautheit (sonst Faustregeln), gehaltene Töne, gerufene
// Zeilen, Hintergrundgesang, Satz der Teile, Takt, Inszenierungen je Zeile (Vielfalt, Wiederholung), Wortbilder über
// den Wortsinn (Verneinung, Deutsch, derbe Wörter), „Ruhig“ ohne Bewegung – und ein Wächter über das Stylesheet:
// in den @keyframes des Stils werden nur transform/opacity bewegt (kein text-shadow, keine Maße).
// VERBOSE=1 zeigt je Beispiel-Song Inszenierungen und Wortbilder.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./load.js");
const {
  wordLoud, emphasis, heldNotes, isShout, sectionKind, sectionStyle, adlibPose, isAdlib, voiceSide,
  onBeat, beatPhase, cueOf, cueMatcher, planPlayful, paintPlayful, pickTreatments, syllables, rhymes,
  motionLoad, TREATMENTS,
} = load("lyricstyle.js");
const { LEX, NEG } = load("lexicon.js");
const { shaped } = require("./songshapes.js");
const { SONGS, build } = require("./fixtures/playful-songs.js");

// Wörter einer Zeile: [Text, Anfang ms, Dauer ms]
const W = (spec) => spec.map(([text, a, d]) => ({ text, a, b: a + d }));
// Wörter aus einem Satz, gleichmäßig
const WS = (text, t = 0, d = 280) => text.split(" ").map((x, k) => ({ text: x, a: t + k * (d + 40), b: t + k * (d + 40) + d }));
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

/* ---- Betonung: lautes Wort größer/kräftiger, leises/gehauchtes dünner */
{
  const ws = W([["I", 0, 250], ["really", 300, 250], ["NEED", 600, 300], ["you", 950, 250], ["now", 1250, 250]]);
  // „really“ laut gesungen, „you“ leise
  const segs = SEGS(0, 2000, (t) => (t >= 300 && t < 550 ? -3 : t >= 950 && t < 1200 ? -19 : -11));
  const em = emphasis(ws, { segs, avg: -11 });
  assert.equal(em[1].cls, "is-p-loud", "laut gesungenes Wort");
  assert.ok(em[1].z > 1.1 && em[1].z <= 1.3, "laut = deutlich größer: " + em[1].z);
  assert.equal(em[2].cls, "is-p-loud", "Großbuchstaben betonen");
  assert.equal(em[3].cls, "is-p-soft", "leises Wort");
  assert.ok(em[3].z >= 0.84 && em[3].z < 1, "leise, aber nie kleiner als 84 %");
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
  for (const e of [...em, ...shout, ...t]) assert.ok(e.z >= 0.7 && e.z <= 1.3);
  assert.deepEqual(emphasis([], {}), []);
}
/* ---- Betonung ohne Analyse: Inhaltswörter, Zeilenende, Reim, Hook-Wörter – Funktionswörter nie */
{
  const ws = WS("I walk alone in the empty city");
  const em = emphasis(ws, {});
  const loud = em.map((e, k) => (e.cls === "is-p-loud" ? ws[k].text : "")).filter(Boolean);
  assert.ok(loud.length >= 1, "ohne Analyse wird trotzdem betont");
  for (const w of loud) assert.ok(!["I", "in", "the"].includes(w), "Funktionswort betont: " + w);
  // Reim am Zeilenende und Hook-Wort heben ihr Wort
  const plain = emphasis(WS("we keep on dancing in the night"), {});
  const rhyme = emphasis(WS("we keep on dancing in the night"), { rhyme: true });
  assert.ok(rhyme[6].e > plain[6].e, "Reim hebt das letzte Wort");
  const hook = emphasis(WS("we keep on dancing in the night"), { hook: new Set(["dancing"]) });
  assert.ok(hook[3].e > plain[3].e, "Hook-Wort wiegt mehr");
  // derbe Wörter (o.no) wachsen nie
  const no = emphasis(WS("FUCK this whole world"), { no: new Set([0]) });
  assert.ok(no[0].cls !== "is-p-loud" && no[0].z <= 1, "derbes Wort bleibt klein");
  assert.ok(rhymes("night", "light") && rhymes("fire", "desire") && !rhymes("night", "night") && !rhymes("rain", "fire"));
}

/* ---- Gehaltene Töne: viel länger als der Rest der Zeile */
{
  const h = heldNotes(W([["so", 0, 250], ["long", 300, 1600], ["my", 2000, 220], ["love", 2300, 300]]));
  assert.deepEqual(h.map((x) => x.held), [false, true, false, false]);
  assert.equal(h[1].hd, 1600);
  assert.ok(heldNotes(W([["a", 0, 400], ["b", 450, 420], ["c", 900, 450]])).every((x) => !x.held));
  assert.ok(!heldNotes(W([["a", 0, 200], ["b", 250, 500], ["c", 800, 200]]))[1].held);
  const est = W([["so", 0, 250], ["long", 300, 1600], ["my", 2000, 220]]).map((w) => ({ ...w, est: true }));
  assert.ok(heldNotes(est).every((x) => !x.held));
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

/* ---- Hintergrundgesang, Duett, Teile, Takt, Silben */
assert.ok(isAdlib(["(oh", "yeah)"]));
assert.ok(!isAdlib(["(x2)"]), "Regieanweisung ist kein Hintergrundgesang");
assert.ok(!isAdlib(["I", "said", "(yeah)"]), "nur ein Teil der Zeile");
{
  const a = adlibPose(0), b = adlibPose(1);
  assert.ok(a.rot < 0 && b.rot > 0, "abwechselnd geneigt");
  assert.ok(Math.abs(a.rot) <= 4 && Math.abs(b.rot) <= 4, "nur leicht schräg");
}
assert.equal(voiceSide("1"), "is-p-left");
assert.equal(voiceSide("2"), "is-p-right");
assert.equal(voiceSide("all"), "is-p-mid");
assert.equal(voiceSide(undefined), "");
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
{
  const beats = [0, 0.5, 1, 1.5, 2].map((t) => ({ t }));
  assert.ok(onBeat(1020, beats));
  assert.ok(!onBeat(1250, beats));
  assert.ok(!onBeat(1000, null));
  assert.deepEqual(beatPhase(beats, 1.2), { p: 500, d: -200 });
  assert.equal(beatPhase(beats, 5), null, "hinter dem letzten Schlag nichts");
  assert.equal(beatPhase([{ t: 0 }, { t: 3 }], 1), null, "unplausible Schlaglänge");
}
assert.equal(syllables("hello beautiful world"), 6);
assert.equal(syllables("我爱你"), 3);

/* ---- Wortbilder: Begriff → Bewegung (über wordsense.js und das Wörterbuch) */
assert.equal(cueOf("fire"), "flame");
assert.equal(cueOf("rain"), "drip");
assert.equal(cueOf("heart"), "beat");
assert.equal(cueOf("fly"), "float");
assert.equal(cueOf("money"), "glint");
assert.equal(cueOf("insult"), "", "derbe Wörter haben keine eigene Bewegung");
{
  // der Rest des Songs (die Sprache erkennt words.js am ganzen Text)
  const CONTEXT = {
    en: ["and I am here for you", "you know that I will stay"],
    de: ["und ich bin nicht mehr da", "wenn du mich wirklich brauchst", "ich weiß nicht, was du willst", "das ist mir egal"],
    es: ["y yo te quiero con el corazón", "que no me digas que no", "porque eres para mí", "una noche más"],
    fr: ["et je suis là pour toi", "je ne sais pas pourquoi", "dans la nuit avec moi", "tu es pour moi"],
  };
  // je Zeile: [Sprache, Zeile, erwartete Bewegung oder "-" (keine)]
  const CASES = [
    ["en", "I can feel the fire in my soul", "flame"],
    ["en", "Dancing in the pouring rain", "drip"],
    ["en", "My heart is beating for you", "beat"],
    ["en", "Let me fly away tonight", "float"],
    ["en", "Watch me falling down again", "fall"],
    ["en", "It's so cold without you here", "shiver"],
    ["en", "Boom goes the night", "burst"],
    ["en", "Spin me round like a record", "spin"],
    ["en", "Gold and diamonds on my neck", "glint"],
    ["en", "Lost in the dark again", "dim"],
    ["en", "You are the light I need", "shine"],
    ["en", "I wanna scream it out", "shake"],
    ["en", "Whisper to me slowly", "hush"],
    ["en", "Everybody dance with me", "bounce"],
    ["en", "Stop right there, baby", "halt"],
    ["en", "The clock is ticking on", "tick"],
    ["en", "Driving down the highway fast", "dash"],
    ["en", "Waves on the ocean blue", "wave"],
    ["en", "A storm is coming in", "jolt"],
    ["en", "My heart is yours tonight", "beat"],
    ["en", "You broke my heart in two", "crack"],
    ["de", "Du hast mein Herz gebrochen", "crack"],
    // Verneinung: keine Bewegung
    ["en", "There is no fire left between us", "-"],
    ["en", "Don't stop the music", "-"],
    ["en", "I'm not falling for it", "-"],
    ["en", "No rain tonight", "-"],
    // Redewendung: „make it rain“ ist Geld, kein Regen
    ["en", "Make it rain in the club", "glint"],
    // Deutsch
    ["de", "Ich spüre das Feuer in mir", "flame"],
    ["de", "Der Regen auf meiner Haut", "drip"],
    ["de", "Mein Herz gehört nur dir", "beat"],
    ["de", "Wir fliegen über die Stadt", "float"],
    ["de", "Ich falle immer tiefer", "fall"],
    ["de", "Es ist so kalt hier ohne dich", "shiver"],
    ["de", "Kein Feuer mehr in deinen Augen", "-"],
    ["de", "Ich habe keine Angst", "power"],
    // Spanisch, Französisch
    ["es", "Bailando bajo la lluvia", "drip"],
    ["fr", "Mon cœur bat pour toi", "beat"],
  ];
  let hit = 0;
  for (const [lang, text, want] of CASES) {
    const lines = [{ text }, ...CONTEXT[lang].map((x) => ({ text: x }))];
    const got = cueMatcher(lines, LEX, { neg: NEG })(text).map((x) => x.cue);
    if (want === "-") assert.deepEqual(got, [], `„${text}“ soll nicht reagieren, bekam ${got}`);
    else assert.ok(got.includes(want), `„${text}“: erwartet ${want}, bekam ${got.join(",") || "–"}`);
    hit++;
  }
  assert.equal(hit, CASES.length);
  // derbe Wörter: nur mit „Licht & Stimmung“ ein laszives Wiegen, sonst nichts – Beleidigungen nie
  const sx = [{ text: "You look so sexy tonight" }, { text: "and I am here for you" }];
  assert.deepEqual(cueMatcher(sx, LEX, { neg: NEG, explicit: "on" })("You look so sexy tonight").map((x) => x.cue), ["sultry"]);
  assert.deepEqual(cueMatcher(sx, LEX, { neg: NEG, explicit: "off" })("You look so sexy tonight").map((x) => x.cue), []);
  assert.deepEqual(cueMatcher(sx, LEX, { neg: NEG, explicit: "soft" })("You look so sexy tonight").map((x) => x.cue), []);
  assert.deepEqual(cueMatcher(sx, LEX, { neg: NEG, explicit: "on" })("You're a motherfucker, get out").map((x) => x.cue), []);
  // traurige Stelle: laute Bewegungen werden sanft
  assert.deepEqual(cueMatcher(sx, LEX, { neg: NEG })("Boom goes the night", true).map((x) => x.cue), ["shine"]);
  // ohne Wörterbuch: nur die Zusatzlisten
  assert.deepEqual(cueMatcher([{ text: "fire falling" }], null)("fire falling").map((x) => x.cue), ["fall"]);
}
{
  // derbe Wörter wachsen auch im Plan nie und werden nie Schlüsselwort
  const lines = [{ t: 0, text: "Fuck this shit tonight" }, { t: 3000, text: "Fuck this shit tonight" }];
  const words = lines.map((l) => WS(l.text, l.t));
  for (const explicit of ["on", "off"]) {
    const plan = planPlayful(lines, words, null, { lexicon: LEX, neg: NEG, explicit });
    for (const p of plan) for (const k of [0, 2]) {
      const w = p.words[k];
      assert.ok(!w.cls.includes("is-p-key") && !w.cls.includes("is-p-loud") && !(Number(w.vars["--pz"]) > 1), `derbes Wort hervorgehoben (${explicit}): ${w.cls}`);
      assert.ok(!w.cls.some((c) => c.startsWith("is-c-")), "keine Bewegung für Flüche");
    }
  }
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
  const plan = planPlayful(lines, words, d, { lexicon: LEX, neg: NEG });
  assert.equal(plan.length, lines.length);
  assert.ok(plan[0].cls.includes("is-p-verse"), "Strophe: " + plan[0].cls);
  assert.ok(plan[1].cls.includes("is-p-chorus"), "Refrain: " + plan[1].cls);
  assert.ok(plan[3].cls.includes("is-p-bridge"), "Bridge: " + plan[3].cls);
  assert.ok(plan[2].cls.includes("is-p-adlib"), "Hintergrundgesang");
  assert.equal(plan[2].t, "", "Hintergrundgesang bekommt keine eigene Inszenierung");
  assert.ok(plan[2].vars["--pr"].endsWith("deg"));
  const fire = plan[1].words[4];
  assert.ok(fire.cls.includes("is-p-held"), "gehaltenes „fire“");
  assert.equal(fire.vars["--hd"], "1800ms");
  assert.ok(fire.cls.includes("is-c-flame"), "Feuer flackert");
  assert.ok(fire.cls.includes("is-cg") && fire.tx === "fire", "Feuer mit Schein-Ebene");
  assert.ok(plan[1].words[2].cls.includes("is-c-beat"), "Herz schlägt");
  assert.ok(plan[3].words[2].cls.includes("is-c-fall"), "fallen fällt");
  for (const p of plan) {
    assert.ok(p.words.filter((w) => w.cls.includes("is-p-cue")).length <= 2, "höchstens zwei Wortbilder je Zeile");
    if (p.t) assert.ok(p.cls.includes("is-t-" + p.t) && TREATMENTS.includes(p.t));
  }
  // die wiederholte Zeile spielt anders als beim ersten Mal
  assert.notEqual(plan[1].t, plan[4].t, "Wiederholung wechselt die Inszenierung");
  // ohne Analyse: Wiederholung macht den Refrain, nichts wirft
  const bare = planPlayful(lines, words, null, { lexicon: LEX, neg: NEG });
  assert.ok(bare[1].cls.includes("is-p-chorus"));
  assert.ok(bare[0].cls.includes("is-p-verse"));
  assert.ok(bare.every((p) => p.words.every((w) => !w.cls.includes("is-p-beat"))), "ohne Takt keine Schlag-Wörter");
  // Zeilen ohne Wort-Elemente: nur Zeilen-Klassen, keine Inszenierung, die Wörter braucht
  const noWords = planPlayful(lines, [], null, { match: () => [] });
  assert.ok(noWords.every((p) => p.words.length === 0 && p.cls.length > 0));
  assert.ok(noWords.every((p) => ["", "plain", "caps", "punch", "tilt", "slam"].includes(p.t)), noWords.map((p) => p.t).join());
  // Duett: Seite je Stimme
  const duet = planPlayful([{ t: 0, text: "hello", who: "1" }, { t: 2000, text: "hi there", who: "2" }], [], null, { match: () => [] });
  assert.ok(duet[0].cls.includes("is-p-left") && duet[1].cls.includes("is-p-right"));
  // Auftritt nach dem Drop: die erste gesungene Zeile danach – und sie prallt zusammen
  const dropped = planPlayful(lines, words, null, { parts: [{ t0: 0, kind: "verse" }, { t0: 33.5, kind: "drop" }], drops: [33.5], match: () => [] });
  assert.ok(dropped[1].cls.includes("is-p-drop") && !dropped[0].cls.includes("is-p-drop"));
  assert.equal(dropped[1].t, "collide", "Drop-Zeile: Wörter prallen zusammen");
}

/* ---- Inszenierungen: Vielfalt in einem synthetischen 40-Zeilen-Song, Wiederholung variiert */
{
  const verse = ["I walk alone along the river side", "Counting all the lights that pass me by", "Every word you said is in my head", "Shadows on the wall beside my bed",
    "Running through the city in the rain", "Calling out your name and back again", "Pictures on the floor of better days", "Nothing ever stays the way it stays"];
  const chorus = ["Turn it up and let it go", "We are burning, burning slow", "Hold on tight and never stop", "Take me higher to the top"];
  const lines = [], words = [], parts = [];
  let t = 2000;
  const sec = (kind, ls) => {
    parts.push({ t0: t / 1000 - 0.2, kind });
    for (const text of ls) {
      lines.push({ t, text });
      words.push(WS(text, t, 260));
      t += 3000;
    }
    t += 1500;
  };
  sec("verse", verse.slice(0, 4));
  sec("chorus", chorus);
  sec("verse", verse.slice(4));
  sec("chorus", chorus);
  sec("bridge", ["Slowly fading into blue", "Everything I knew was you", "Silence when the music ends", "Starting over once again"]);
  sec("chorus", chorus);
  sec("chorus", chorus);
  sec("verse", verse.slice(0, 4));
  sec("pre", ["Can you feel it coming now", "Every heartbeat, every vow", "Standing at the edge of time", "Waiting for the final line"]);
  sec("outro", ["Let it go", "Let it go", "Let it go", "Let it go"]);
  assert.equal(lines.length, 40);
  for (const d of [null, shaped("rock")]) {
    const plan = planPlayful(lines, words, d, { lexicon: LEX, neg: NEG, parts });
    const count = {};
    for (const p of plan) count[p.t] = (count[p.t] || 0) + 1;
    const top = Math.max(...Object.values(count));
    assert.ok(top / plan.length <= 0.35, "eine Inszenierung zu oft: " + JSON.stringify(count));
    assert.ok(Object.keys(count).length >= 7, "zu wenig Abwechslung: " + JSON.stringify(count));
    // keine zwei gleichen hintereinander
    for (let i = 1; i < plan.length; i++) assert.notEqual(plan[i].t, plan[i - 1].t, `Zeile ${i}: zweimal ${plan[i].t}`);
    // jede Refrain-Zeile: über ihre vier Wiederholungen nicht immer dieselbe Inszenierung
    for (const text of chorus) {
      const ts = plan.filter((p, i) => lines[i].text === text).map((p) => p.t);
      assert.ok(new Set(ts).size >= 2, `„${text}“ immer ${ts[0]}`);
    }
    // die erste Refrain-Zeile trifft hart (Knall, Aufprall, Stoß oder großes Schlüsselwort)
    const firstChorus = lines.findIndex((l) => l.text === chorus[0]);
    assert.ok(["slam", "collide", "punch", "key", "drop", "caps"].includes(plan[firstChorus].t), "erste Refrain-Zeile: " + plan[firstChorus].t);
    // Bridge steht schräg
    assert.ok(plan.slice(16, 20).some((p) => p.t === "tilt"), "Bridge: " + plan.slice(16, 20).map((p) => p.t));
  }
  // schneller Rap tippt, eine langsame Ballade glimmt
  const rap = build("rap"), bal = build("ballad");
  const rp = planPlayful(rap.lines, rap.words, null, { lexicon: LEX, neg: NEG, parts: rap.parts });
  const bp = planPlayful(bal.lines, bal.words, null, { lexicon: LEX, neg: NEG, parts: bal.parts });
  assert.ok(rp.filter((p) => p.t === "type").length >= 4, "Rap ohne Tipp-Zeilen");
  assert.ok(bp.filter((p) => p.t === "glow").length >= 2, "Ballade ohne Glimm-Zeilen");
  assert.ok(!bp.some((p) => p.t === "type"), "Ballade tippt nicht");
  // pickTreatments ist fest (gleiche Eingabe, gleiche Wahl)
  const f = { kind: "verse", n: 5, rate: 3, energy: 0, mood: 0, words: true, key: "x", keyStrength: 0.6 };
  assert.deepEqual(pickTreatments([f, { ...f, key: "y" }]), pickTreatments([f, { ...f, key: "y" }]));
}

/* ---- Beispiel-Songs: wie viele Wortbilder, wie viele Inszenierungen, Last je Zeile */
{
  const stats = [];
  for (const name of Object.keys(SONGS)) {
    const s = build(name);
    const plan = planPlayful(s.lines, s.words, null, { lexicon: LEX, neg: NEG, parts: s.parts });
    let cues = 0, maxLoad = 0;
    const kinds = new Set();
    plan.forEach((p, i) => {
      const cs = p.words.filter((w) => w.cls.some((c) => c.startsWith("is-c-")));
      cues += cs.length;
      maxLoad = Math.max(maxLoad, motionLoad(p));
      kinds.add(p.t);
      if (process.env.VERBOSE) {
        const tag = p.words.map((w, k) => (w.cls.find((c) => c.startsWith("is-c-")) ? s.words[i][k].text + ":" + w.cls.find((c) => c.startsWith("is-c-")).slice(5) : "")).filter(Boolean);
        console.log(`${name.padEnd(8)} ${String(p.t).padEnd(8)} ${s.lines[i].text}  ${tag.join(" ")}`);
      }
    });
    stats.push(`${name}: ${s.lines.length} Zeilen, ${cues} Wortbilder, ${kinds.size} Inszenierungen, Last ≤ ${maxLoad}`);
    assert.ok(cues >= 8, `${name}: nur ${cues} Wortbilder`);
    assert.ok(kinds.size >= 6, `${name}: nur ${kinds.size} Inszenierungen`);
    // höchstens 24 gleichzeitig bewegte Elemente in einer Zeile (Wörter + Buchstaben + Schein)
    assert.ok(maxLoad <= 24, `${name}: ${maxLoad} bewegte Elemente in einer Zeile`);
  }
  if (process.env.VERBOSE) console.log(stats.join("\n"));
}

/* ---- „Ruhig“ / „Keine Blitze“ / weniger Bewegung: keine Bewegungs-Klassen, nur Größe, Stärke, Satz */
{
  const s = build("party");
  const still = planPlayful(s.lines, s.words, null, { lexicon: LEX, neg: NEG, parts: s.parts, still: true });
  const moving = planPlayful(s.lines, s.words, null, { lexicon: LEX, neg: NEG, parts: s.parts });
  const MOTION = /^(is-c-|is-p-held$|is-p-beat$|is-p-drop$|is-p-cue$|is-cg$|is-split$)/;
  for (const p of still) {
    assert.ok(!p.cls.some((c) => MOTION.test(c)), "Zeile: " + p.cls);
    for (const w of p.words) {
      assert.ok(!w.cls.some((c) => MOTION.test(c)) && !w.chars && !w.tx, "Wort: " + w.cls);
      assert.ok(!("--hd" in w.vars), "kein Halten ohne Bewegung");
    }
  }
  // der ruhende Satz (Größen) bleibt gleich: der Text springt nicht, wenn „Ruhig“ umschaltet
  still.forEach((p, i) => p.words.forEach((w, k) => assert.equal(w.vars["--pz"], moving[i].words[k].vars["--pz"])));
}

/* ---- Wächter über das Stylesheet: Bewegung nur mit transform/opacity, nie text-shadow oder Maße */
{
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "Mirage", "user.css"), "utf8");
  const a = css.indexOf("/* === i-playful === */"), b = css.indexOf("/* === end i-playful === */");
  assert.ok(a >= 0 && b > a, "Block i-playful fehlt");
  const block = css.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, "");
  // kleiner Klammer-Leser: [{ sel, body, kids }]
  function parse(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const o = s.indexOf("{", i);
      if (o < 0) break;
      const sel = s.slice(i, o).trim().split(";").pop().trim();
      let depth = 1, j = o + 1;
      while (j < s.length && depth) {
        if (s[j] === "{") depth++;
        else if (s[j] === "}") depth--;
        j++;
      }
      const body = s.slice(o + 1, j - 1);
      out.push({ sel, body, kids: body.includes("{") ? parse(body) : null });
      i = j;
    }
    return out;
  }
  const decls = (body) => body.split(";").map((x) => x.trim()).filter(Boolean).map((x) => [x.slice(0, x.indexOf(":")).trim(), x.slice(x.indexOf(":") + 1).trim()]);
  const top = parse(block);
  const ALLOWED = new Set(["transform", "translate", "scale", "rotate", "opacity", "filter"]);
  const frames = top.filter((r) => r.sel.startsWith("@keyframes"));
  assert.ok(frames.length >= 30, "zu wenige Bewegungen: " + frames.length);
  let filters = 0;
  for (const f of frames) {
    for (const step of f.kids) {
      for (const [prop] of decls(step.body)) {
        assert.ok(ALLOWED.has(prop), `${f.sel}: „${prop}“ wird bewegt (nur transform/opacity erlaubt)`);
        if (prop === "filter") filters++;
      }
    }
  }
  assert.ok(filters <= 2, "filter höchstens sparsam: " + filters);
  const names = new Set(frames.map((f) => f.sel.replace("@keyframes", "").trim()));
  // alles, was animiert oder überblendet, steht unter „weniger Bewegung: nein“ und ohne „Ruhig“/„Keine Blitze“
  const media = top.filter((r) => r.sel.startsWith("@media"));
  assert.ok(media.length === 1 && /prefers-reduced-motion:\s*no-preference/.test(media[0].sel));
  for (const r of top.filter((x) => !x.sel.startsWith("@"))) {
    for (const [prop, val] of decls(r.body)) {
      if (prop === "transition") assert.fail("Überblendung außerhalb des Bewegungs-Blocks: " + r.sel);
      if (prop === "animation") assert.equal(val, "none", "Animation außerhalb des Bewegungs-Blocks: " + r.sel);
    }
  }
  for (const r of media[0].kids) {
    assert.ok(/html:not\(\.mirage-calm, \.mirage-noflash/.test(r.sel), "ohne Ruhig/Keine-Blitze-Schutz: " + r.sel);
    assert.ok(/\.is-active/.test(r.sel), "Bewegung außerhalb der aktiven Zeile: " + r.sel);
    for (const [prop, val] of decls(r.body)) {
      if (prop === "transition") {
        for (const part of val.split(/,(?![^(]*\))/)) assert.ok(ALLOWED.has(part.trim().split(/\s+/)[0]), `${r.sel}: Überblendung von „${part.trim()}“`);
      }
      if (prop === "animation" || prop.startsWith("--p")) {
        for (const m of val.matchAll(/\b(m-[a-z]-[a-z-]+)\b/g)) assert.ok(names.has(m[1]), `${r.sel}: unbekannte Animation ${m[1]}`);
      }
      // fester Schein nur an der stillen Kopie (::before), deren Deckkraft geblendet wird
      if (prop === "text-shadow") assert.ok(/::before$/.test(r.sel), "text-shadow im Bewegungs-Block: " + r.sel);
    }
  }
  // auch Variablen mit Animationsnamen außerhalb des Bewegungs-Blocks zeigen nur auf erlaubte @keyframes
  for (const r of top.filter((x) => !x.sel.startsWith("@"))) for (const [prop, val] of decls(r.body)) {
    if (prop.startsWith("--p")) for (const m of val.matchAll(/\b(m-[a-z]-[a-z-]+)\b/g)) assert.ok(names.has(m[1]), `${r.sel}: unbekannte Animation ${m[1]}`);
  }
  // jedes Wortbild hat seine Bewegung im Stylesheet
  const effects = new Set();
  for (const m of block.matchAll(/\.is-c-([a-z]+)/g)) effects.add(m[1]);
  for (const fx of ["flame", "drip", "shiver", "beat", "float", "fall", "burst", "spin", "glint", "dim", "shine", "shake", "hush", "bounce", "halt", "tick", "sultry"]) {
    assert.ok(effects.has(fx), "Wortbild ohne CSS: " + fx);
  }
  for (const t of TREATMENTS.filter((x) => x !== "plain")) assert.ok(block.includes(".is-t-" + t), "Inszenierung ohne CSS: " + t);
}

/* ---- An die Zeilen setzen: Klassen, Variablen, Buchstaben – und alles wieder weg */
{
  // winziges DOM für Node
  const mk = (doc) => {
    const el = {
      ownerDocument: doc, children: [], _text: "", dataset: {},
      classList: {
        s: new Set(),
        add(...c) { c.forEach((x) => this.s.add(x)); },
        remove(...c) { c.forEach((x) => this.s.delete(x)); },
        contains(c) { return this.s.has(c); },
        [Symbol.iterator]() { return this.s[Symbol.iterator](); },
      },
      style: { v: {}, setProperty(k, v) { this.v[k] = String(v); }, removeProperty(k) { delete this.v[k]; } },
      append(...k) { this.children.push(...k); },
      get firstElementChild() { return this.children[0] || null; },
      get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join("") : this._text; },
      set textContent(v) { this.children = []; this._text = v; },
    };
    Object.defineProperty(el, "className", { set(v) { v.split(" ").forEach((c) => el.classList.add(c)); } });
    return el;
  };
  const doc = { createElement: () => mk(doc) };
  const line = mk(doc), word = mk(doc);
  word.textContent = "boom";
  const plan = [{ t: "key", cls: ["is-p-chorus", "is-t-key"], vars: {}, words: [{ cls: ["is-c-burst", "is-split"], vars: { "--cn": "4" }, chars: true }] }];
  const wl = [[{ el: word, text: "boom" }]];
  paintPlayful([line], plan, wl);
  assert.ok(line.classList.contains("is-t-key"));
  assert.equal(word.children.length, 4, "in Buchstaben zerlegt");
  assert.equal(word.textContent, "boom");
  assert.equal(word.children[2].style.v["--ci"], "2");
  paintPlayful([line], null, wl);
  assert.ok(!line.classList.contains("is-t-key") && !word.classList.contains("is-c-burst"), "Klassen wieder weg");
  assert.equal(word.children.length, 0, "wieder ein Text");
  assert.equal(word.textContent, "boom");
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
  planPlayful(lines, words, d, { lexicon: LEX, neg: NEG });
  const t0 = performance.now();
  planPlayful(lines, words, d, { lexicon: LEX, neg: NEG });
  const ms = performance.now() - t0;
  assert.ok(ms < 120, "Planung zu langsam: " + ms.toFixed(1) + " ms");
}

console.log("lyricstyle: ok");
