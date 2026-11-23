// node tests/unit/lyricstyle.test.js
// Verspielter Liedtext-Stil: Betonung aus Wortzeiten und Lautheit (sonst Faustregeln), gehaltene Töne, gerufene
// Zeilen, Hintergrundgesang, Satz der Teile, Takt, Inszenierungen je Zeile (Vielfalt, Wiederholung), Wortbilder über
// den Wortsinn (Verneinung, Deutsch, derbe Wörter), „Ruhig“ ohne Bewegung – und ein Wächter über das Stylesheet:
// in den @keyframes des Stils werden nur transform/opacity bewegt (kein text-shadow, keine Maße), höchstens drei
// kräftige Helligkeitswechsel je Sekunde. Dazu: Landung genau auf dem Einsatz (Spiel-Uhr), Abwechslung über zehn Songs,
// sichere Wartezustände (nie abgeschnitten), Schriften (Fenster, Schriftsysteme, lange Zeilen), Farben ≥ 4,5 : 1, Stufen, ♪.
// VERBOSE=1 zeigt je Beispiel-Song Inszenierungen und Wortbilder.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./load.js");
const {
  wordLoud, emphasis, heldNotes, isShout, sectionKind, sectionStyle, adlibPose, isAdlib, voiceSide,
  onBeat, beatPhase, cueOf, cueMatcher, planPlayful, paintPlayful, pickTreatments, syllables, rhymes,
  motionLoad, TREATMENTS, sungAt, PRE_MS, barPhase, leadPad, LEAD_PAD,
} = load("lyricstyle.js");
const { RECIPES, songDeck, allowed, wordPose, letterPoses, leadOf, LEAD_MAX, RAP_SET, BALLAD_SET, BRIDGE_SET, ACCENTS, FX_VARIANTS, FX_COUNT, fxVariant, EXITS, HOOKS, exitOf } = load("lyricdeck.js");
const { PFONTS, PFONTS_URL, scriptsOf, covers, windowFonts, LONG_WORDS, LONG_CHARS } = load("lyricfont.js");
const { meaningColors, lyricGrounds, contrast, KINDS, CUE_KIND } = load("lyriccolor.js");
const { LEX, NEG } = load("lexicon.js");
const { shaped } = require("./songshapes.js");
const { SONGS, build } = require("./fixtures/playful-songs.js");

const bare = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "");
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
  assert.ok(noWords.every((p) => ["", "plain", "caps", "punch", "tilt"].includes(p.t)), noWords.map((p) => p.t).join());
  // Duett: Seite je Stimme
  const duet = planPlayful([{ t: 0, text: "hello", who: "1" }, { t: 2000, text: "hi there", who: "2" }], [], null, { match: () => [] });
  assert.ok(duet[0].cls.includes("is-p-left") && duet[1].cls.includes("is-p-right"));
  // Auftritt nach dem Drop: die erste gesungene Zeile danach – und sie prallt zusammen
  const dropped = planPlayful(lines, words, null, { parts: [{ t0: 0, kind: "verse" }, { t0: 33.5, kind: "drop" }], drops: [33.5], match: () => [] });
  assert.ok(dropped[1].cls.includes("is-p-drop") && !dropped[0].cls.includes("is-p-drop"));
  assert.ok(RECIPES[dropped[1].t].e >= 2, "Drop-Zeile: kräftiger Auftritt, nicht " + dropped[1].t);
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
    assert.ok(top / plan.length <= 0.2, "eine Inszenierung zu oft (über 20 %): " + JSON.stringify(count));
    assert.ok(Object.keys(count).length >= 14, "zu wenig Abwechslung: " + JSON.stringify(count));
    // keine zwei gleichen hintereinander
    for (let i = 1; i < plan.length; i++) assert.notEqual(plan[i].t, plan[i - 1].t, `Zeile ${i}: zweimal ${plan[i].t}`);
    // jede Refrain-Zeile: über ihre vier Wiederholungen nicht immer dieselbe Inszenierung
    for (const text of chorus) {
      const ts = plan.filter((p, i) => lines[i].text === text).map((p) => p.t);
      assert.ok(new Set(ts).size >= 2, `„${text}“ immer ${ts[0]}`);
    }
    // die erste Refrain-Zeile trifft hart (Knall, Aufprall, Stoß oder großes Schlüsselwort)
    const firstChorus = lines.findIndex((l) => l.text === chorus[0]);
    assert.ok(RECIPES[plan[firstChorus].t].e >= 2, "erste Refrain-Zeile: " + plan[firstChorus].t);
    // Bridge: schräg, schwingend, klappend – aus dem Bridge-Satz des Decks
    assert.ok(plan.slice(16, 20).some((p) => BRIDGE_SET.has(p.t) || plan.deck.bridge.includes(p.t)), "Bridge: " + plan.slice(16, 20).map((p) => p.t));
  }
  // schneller Rap tippt, eine langsame Ballade glimmt
  const rap = build("rap"), bal = build("ballad");
  const rp = planPlayful(rap.lines, rap.words, null, { lexicon: LEX, neg: NEG, parts: rap.parts });
  const bp = planPlayful(bal.lines, bal.words, null, { lexicon: LEX, neg: NEG, parts: bal.parts });
  assert.ok(rp.filter((p) => RAP_SET.has(p.t)).length >= 4, "Rap ohne Tipp-/Rap-Zeilen: " + rp.map((p) => p.t));
  assert.ok(bp.filter((p) => BALLAD_SET.has(p.t)).length >= 2, "Ballade ohne ruhige Zeilen: " + bp.map((p) => p.t));
  assert.ok(bp.filter((p) => p.t && RECIPES[p.t].e >= 3).length <= 2, "Ballade knallt höchstens zum Refrain-Beginn: " + bp.map((p) => p.t));
  // pickTreatments ist fest (gleiche Eingabe, gleiche Wahl)
  const f = { kind: "verse", n: 5, rate: 3, energy: 0, mood: 0, words: true, key: "x", keyStrength: 0.6 };
  assert.deepEqual(pickTreatments([f, { ...f, key: "y" }], songDeck("a")), pickTreatments([f, { ...f, key: "y" }], songDeck("a")));
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
  const MOTION = /^(is-c-|is-p-held$|is-p-beat$|is-p-drop$|is-p-cue$|is-cg$|is-split$|is-p-moment$|is-p-riser$)/;
  for (const p of still) {
    assert.ok(!p.cls.some((c) => MOTION.test(c)), "Zeile: " + p.cls);
    for (const w of p.words) {
      assert.ok(!w.cls.some((c) => MOTION.test(c)) && !w.chars && !w.tx, "Wort: " + w.cls);
      assert.ok(!("--hd" in w.vars), "kein Halten ohne Bewegung");
      assert.ok(!("--pac" in w.vars) && !("--wi" in w.vars), "kein Akzent, kein Abgang ohne Bewegung");
    }
    assert.ok(!("--pxo" in p.vars) && !("--prd" in p.vars), "Zeile geht ohne Bewegung nicht ab: " + JSON.stringify(p.vars));
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
  // Auftritte laufen über die eine Überblendung mit --pl (Vorlauf = Landedauer), Akzente beginnen mit --pl Verzögerung
  assert.ok(/transition:\s*translate calc\(var\(--pl, 160ms\) - var\(--ld, 0ms\)\)/.test(block), "Auftritt nicht über --pl");
  assert.ok(/--pe: var\(--pac, none\) var\(--pad, 400ms\) ease-out var\(--pl, 0ms\) var\(--pai, 1\);/.test(block), "Akzent beginnt nicht auf dem Einsatz");
  // jede Bewegung, auf die die Daten zeigen, gibt es als @keyframes
  for (const a of Object.keys(ACCENTS)) assert.ok(names.has("m-a-" + a), "Akzent ohne Keyframes: " + a);
  for (const [cue, list] of Object.entries(FX_VARIANTS)) {
    assert.ok(effects.has(cue), "Wortbild ohne CSS: " + cue);
    for (const v of list) if (v.n) assert.ok(names.has(v.n), `Spielart von ${cue}: Schleife ${v.n} fehlt`);
  }
  for (const n of ["m-l-tide", "m-l-pend", "m-t-punch", "m-p-note", "m-q-pt", "m-p-caret"]) assert.ok(names.has(n), n);
  // Helligkeit: kräftige Wechsel (Deckkraft-Sprung ≥ 0,4) nur in bekannten Bewegungen, und die laufen langsam genug
  // für höchstens drei je Sekunde (m-c-glow: Durchgang ≥ 1,4 s; Schreibmarke 1,1 s – je zwei Wechsel)
  const strong = [];
  for (const fr of frames) {
    const ops = fr.kids.map((k) => decls(k.body).find(([p]) => p === "opacity")).filter(Boolean).map(([, v]) => Number(v)).filter((v) => !isNaN(v));
    let ch = 0;
    for (let k = 1; k < ops.length; k++) if (Math.abs(ops[k] - ops[k - 1]) >= 0.4) ch++;
    if (ch) strong.push([fr.sel.replace("@keyframes", "").trim(), ch]);
  }
  const SLOW = { "m-c-glow": 1.4, "m-p-caret": 1.1, "m-p-drop": 1.5, "m-q-pt": 0.9, "m-a-echo": 0.6, "m-p-drop-in": 0.18 };
  for (const [n, ch] of strong) {
    assert.ok(n in SLOW, "kräftiger Helligkeitswechsel in " + n);
    // Teilchen, Tropfen, Echo und der Drop-Auftritt sind kleine, einmalige Ein-/Ausblendungen – kein Blinken der Schrift
    if (["m-c-glow", "m-p-caret"].includes(n)) assert.ok((ch * 2) / SLOW[n] <= 3, `${n}: ${ch} Wechsel je ${SLOW[n]} s`);
  }
  assert.ok(/animation: m-c-glow max\(var\(--pcd, 1s\), 1\.4s\)/.test(block), "Schein ohne Mindestdauer");
  assert.ok(/animation: m-p-caret 1\.1s/.test(block), "Schreibmarke zu schnell");
  // ♪ wippt nur im Bewegungs-Block (Ruhig/Keine Blitze/weniger Bewegung: still)
  assert.ok(media[0].kids.some((r) => /\.is-p-note\.is-active/.test(r.sel) && /m-p-note/.test(r.body)), "♪ wippt nicht");
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

/* ---- Takt der Auftritte: mit einer Spiel-Uhr – jedes Wort ist genau auf seinem Einsatz gelandet (±40 ms) */
// Landung = Auslösen (.is-sung, sungAt) + Überblendung (Dauer --pl; Buchstaben: Staffelung --ld + verkürzte Dauer)
{
  const landing = (w, pw) => {
    let T = null;
    for (let pos = w.a - 400; pos <= w.a + 400; pos++) if (sungAt({ a: w.a, lead: pw.lead }, pos)) {
      T = pos;
      break;
    }
    const pl = parseFloat(pw.vars["--pl"] || "0");
    // Buchstaben: der letzte landet nach ld + (pl − ld) = pl
    const dur = Array.isArray(pw.chars) ? Math.max(...pw.chars.map((c) => c.ld + (pl - c.ld))) : pl;
    return T + dur;
  };
  let n = 0;
  const seenT = new Set();
  for (const level of ["subtle", "playful", "wild"]) {
    for (const name of Object.keys(SONGS)) {
      for (const seed of ["a", "b", "c", "d"]) {
        const s = build(name);
        const plan = planPlayful(s.lines, s.words, null, { lexicon: LEX, neg: NEG, parts: s.parts, level, seed: name + seed });
        plan.forEach((p, i) => p.words.forEach((pw, k) => {
          const w = s.words[i][k];
          assert.ok(pw.lead <= LEAD_MAX, `${p.t}: Vorlauf ${pw.lead} ms`);
          assert.equal(parseFloat(pw.vars["--pl"] || "0"), pw.lead, "Vorlauf = Landedauer");
          const land = landing(w, pw);
          assert.ok(Math.abs(land - w.a) <= 40, `${level} ${p.t} „${w.text}“: gelandet ${land - w.a} ms neben dem Einsatz`);
          if (Array.isArray(pw.chars)) for (const c of pw.chars) assert.ok(c.ld <= pw.lead / 2, "Staffelung frisst die Landung");
          seenT.add(p.t);
          n++;
        }));
      }
    }
  }
  // dazu jedes Rezept einzeln (auch die, die in den Beispiel-Songs nicht vorkamen)
  for (const t of TREATMENTS) {
    const lead = leadOf(t);
    assert.ok(lead > 0 && lead <= LEAD_MAX, `${t}: Vorlauf ${lead}`);
    if (RECIPES[t].L) for (const c of letterPoses(t, "fire", { k: 0, n: 2, dir: 1, amp: 1, seed: "x", lead })) assert.ok(c.ld + (lead - c.ld) === lead && c.ld <= lead / 2, t);
  }
  // Wortbilder beginnen erst nach der Landung (CSS: Verzögerung --pl + 60 ms), Akzente auf dem Einsatz (--pl)
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "Mirage", "user.css"), "utf8");
  assert.ok(/--pq: var\(--pcn, none\) var\(--pcd, 1s\) ease-in-out calc\(var\(--pl, 0ms\) \+ 60ms\)/.test(css), "Wortbild vor der Landung");
  // ohne Bewegung: kein Vorlauf (das Wort gilt auf dem Einsatz als gesungen)
  const still = planPlayful(build("party").lines, build("party").words, null, { lexicon: LEX, neg: NEG, still: true });
  assert.ok(still.every((p) => p.words.every((w) => w.lead === 0)));
  // die nächste Zeile nimmt rechtzeitig ihre Wartestellung ein (Vorlauf der Zeile > längster Wort-Vorlauf + Überblendung)
  assert.ok(PRE_MS >= 2 * LEAD_MAX + 100);
  if (process.env.VERBOSE) console.log(`Takt: ${n} Wörter, ${seenT.size} Rezepte, alle auf dem Einsatz gelandet`);
}

/* ---- Abwechslung: zehn verschiedene Songs – viele Rezept-Spielarten, jedes Deck anders, keins über 20 % im Song */
{
  const songs = [];
  const VERSE = ["I walk alone along the river side", "Counting all the lights that pass me by", "Every word you said is in my head", "Shadows on the wall beside my bed",
    "Running through the city in the rain", "Calling out your name and back again", "Pictures on the floor of better days", "Nothing ever stays the way it stays"];
  const CHORUS = ["Turn it up and let it go", "We are burning, burning slow", "Hold on tight and never stop", "Take me higher to the top"];
  for (let s = 0; s < 10; s++) {
    const lines = [], words = [], parts = [];
    let t = 2000;
    const sec = (kind, ls) => {
      parts.push({ t0: t / 1000 - 0.2, kind });
      for (const text of ls) {
        lines.push({ t, text });
        words.push(WS(text, t, 240 + (s % 3) * 30));
        t += 3000;
      }
      t += 1500;
    };
    const v = VERSE.map((x, k) => VERSE[(k + s) % VERSE.length]);
    sec("intro", ["Oh oh oh", "Here we go"]);
    sec("verse", v.slice(0, 4));
    sec("pre", ["Can you feel it coming now", "Every heartbeat, every vow"]);
    sec("chorus", CHORUS);
    sec("verse", v.slice(4));
    sec("chorus", CHORUS);
    sec("bridge", ["Slowly fading into blue", "Everything I knew was you", "Silence when the music ends"]);
    sec("drop", ["Jump!", "Boom boom boom"]);
    sec("chorus", CHORUS);
    sec("outro", ["Let it go", "Let it go"]);
    songs.push({ lines, words, parts, uri: "spotify:track:" + (1000 + s * 7919).toString(36) });
  }
  const combos = new Set(), recipes = new Set(), decks = new Set();
  for (const level of ["playful", "wild"]) {
    for (const sg of songs) {
      const plan = planPlayful(sg.lines, sg.words, null, { lexicon: LEX, neg: NEG, parts: sg.parts, level, seed: sg.uri });
      decks.add(level + plan.deck.sig);
      const count = {};
      for (const p of plan) {
        if (!p.t) continue;
        combos.add(p.v);
        recipes.add(p.t);
        count[p.t] = (count[p.t] || 0) + 1;
        if (level === "playful") assert.ok(!RECIPES[p.t].wild, "„Verspielt“ zeigt ein wildes Rezept: " + p.t);
      }
      const n = plan.filter((p) => p.t).length;
      const top = Math.max(...Object.values(count));
      assert.ok(top / n <= 0.2, `${sg.uri}: ein Rezept in ${top} von ${n} Zeilen`);
    }
  }
  assert.equal(decks.size, songs.length * 2, "zwei Songs mit gleichem Deck");
  assert.ok(TREATMENTS.length >= 50, "Rezepte: " + TREATMENTS.length);
  assert.ok(recipes.size >= 45, "nur " + recipes.size + " Rezepte über zehn Songs");
  assert.ok(combos.size >= 250, "nur " + combos.size + " Rezept-Spielarten über zehn Songs");
  assert.ok(FX_COUNT >= 80, "Wortbild-Spielarten: " + FX_COUNT);
  // dasselbe Wortbild sieht in verschiedenen Songs verschieden aus
  const looks = new Set(songs.map((sg) => {
    const d = songDeck(sg.uri);
    return FX_VARIANTS.flame.indexOf(fxVariant("flame", "fire", d.fx));
  }));
  assert.ok(looks.size >= 2, "Feuer sieht in jedem Song gleich aus");
  if (process.env.VERBOSE) console.log(`Abwechslung: ${TREATMENTS.length} Rezepte, ${recipes.size} davon in 10 Songs, ${combos.size} Spielarten, ${FX_COUNT} Wortbild-Spielarten`);
  console.log(`  Abwechslung: ${recipes.size}/${TREATMENTS.length} Rezepte und ${combos.size} Rezept-Spielarten in 10 Songs (Verspielt + Wild), ${FX_COUNT} Wortbild-Spielarten`);
}

/* ---- Nie abgeschnitten: Wartezustände bleiben in sicheren Grenzen (lange Wörter drehen und wachsen weniger) */
{
  for (const t of TREATMENTS) {
    for (const len of [1, 3, 6, 10, 14]) for (const amp of [0.55, 1, 1.5]) for (const dir of [-1, 1]) for (let k = 0; k < 6; k++) {
      const p = wordPose(t, { k, n: 6, dir, amp, len, key: k === 2, seed: "s" });
      assert.ok(Math.abs(p.x || 0) <= 0.6 && Math.abs(p.y || 0) <= 0.45, `${t}: Versatz ${p.x}/${p.y}`);
      const sc = Array.isArray(p.s) ? Math.max(...p.s) : p.s ?? 1;
      assert.ok(sc <= Math.max(1, Math.min(2.2, 1 + 2.5 / len)) + 1e-9, `${t}: wächst auf ${sc} bei ${len} Zeichen`);
      // sichtbar gedreht (deckend und nicht winzig): ragt höchstens ~0,45 em über die Zeile
      const visible = (p.o ?? 1) > 0 && !(sc <= 0.5);
      if (visible && p.r) assert.ok(Math.sin((Math.min(90, Math.abs(p.r)) * Math.PI) / 180) * 0.3 * len <= 0.46 || Math.abs(p.r) <= 8, `${t}: ${p.r}° bei ${len} Zeichen`);
    }
  }
}

/* ---- Schriften: Pinsel nie auf langen Zeilen, andere Schriften → normale Schrift, höchstens zwei je Fenster */
{
  assert.ok(PFONTS_URL.startsWith("https://fonts.googleapis.com/css2?") && PFONTS_URL.endsWith("&display=swap"));
  for (const f of ["Oswald", "Fredoka", "Playfair+Display", "JetBrains+Mono", "Permanent+Marker", "Unbounded"]) assert.ok(PFONTS_URL.includes("family=" + f), f);
  assert.deepEqual([...scriptsOf("Hello Привет")].sort(), ["cyrillic", "latin"]);
  assert.ok(covers("serif", "Привет мир") && !covers("marker", "Привет") && !covers("round", "Привет"));
  assert.ok(covers("marker", "Fire") && !covers("marker", "Łódź"), "Pinsel kann nur Latin-1");
  for (const r of Object.keys(PFONTS)) for (const tx of ["我爱你", "أحبك", "אני אוהב", "मैं प्यार", "ฉันรัก", "사랑해"]) assert.ok(!covers(r, tx), `${r} für ${tx}`);
  // ganze Songs: Fenster-Regel, lange Zeilen, Schriften der Zeile
  const LANGS = {
    ru: ["Я горю в огне любви", "Дождь стучит в моё окно", "Сердце бьётся только для тебя", "ПРЫГАЙ!", "Мы летим высоко", "Холодно без тебя"],
    ja: ["夜空に光る星", "雨が降っている", "心が燃えている", "飛べ！", "愛してる", "君と踊りたい"],
    ar: ["قلبي يحترق بالنار", "المطر يتساقط", "أحبك كثيرا", "ارقص معي", "النجوم في السماء", "لا تتركني"],
  };
  let fontLines = 0;
  for (const level of ["playful", "wild"]) {
    for (const [name, mk] of [...Object.keys(SONGS).map((n) => [n, () => build(n)]), ...Object.entries(LANGS).map(([n, ls]) => [n, () => {
      const lines = [], words = [];
      let t = 1000;
      for (let r = 0; r < 6; r++) for (const text of ls) {
        lines.push({ t, text });
        words.push(WS(text, t, 300));
        t += 3000;
      }
      return { lines, words, parts: undefined };
    }])]) {
      for (const seed of ["1", "2", "3", "4", "5", "6"]) {
        const s = mk();
        const plan = planPlayful(s.lines, s.words, null, { lexicon: LEX, neg: NEG, parts: s.parts, level, seed: name + seed });
        const fonts = plan.map((p) => ({ line: p.font?.line || "", word: p.font?.word || "" }));
        plan.forEach((p, i) => {
          const text = s.lines[i].text, n = s.words[i]?.length || 0;
          assert.ok(windowFonts(fonts, i) <= 2, `${name}: ${windowFonts(fonts, i)} Schriften um Zeile ${i}`);
          const f = fonts[i];
          if (f.line || f.word) fontLines++;
          if (f.line) assert.ok(covers(f.line, text), `${name}: ${f.line} kann „${text}“ nicht`);
          if (f.line === "marker") assert.ok(n <= 3, "Pinsel auf langer Zeile: " + text);
          if (n > LONG_WORDS || [...text].length > LONG_CHARS) assert.ok(!f.line || ["serif", "mono"].includes(f.line), `lange Zeile mit ${f.line}: ${text}`);
          if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Arabic}]/u.test(text)) assert.ok(!f.line && !f.word, "fremde Schrift mit Anzeige-Schrift: " + text);
          const marked = p.words.filter((w) => w.cls.some((c) => c.startsWith("is-f-")));
          assert.ok(marked.length <= 1, "mehr als ein Wort mit eigener Schrift");
          if (marked.some((w) => w.cls.includes("is-f-marker"))) assert.equal(p.t, "key", "Pinsel-Wort nur als Schlüsselwort");
        });
      }
    }
  }
  assert.ok(fontLines > 30, "kaum Anzeige-Schriften: " + fontLines);
  // „Dezent“: keine Schriftmischung
  const sub = planPlayful(build("party").lines, build("party").words, null, { lexicon: LEX, neg: NEG, level: "subtle", seed: "x" });
  assert.ok(sub.every((p) => !p.font?.line && !p.font?.word && !p.cls.some((c) => c.startsWith("is-f-"))));
}

/* ---- Farben: jede erzeugte Farbe ≥ 4,5 : 1 auf dem Liedtext-Grund – über viele Cover-Paletten und Farbstimmungen */
{
  const rnd = (() => {
    let a = 12345;
    return () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296);
  })();
  const pals = [
    [[255, 255, 255], [255, 255, 255], [255, 255, 255]], [[0, 0, 0], [0, 0, 0], [0, 0, 0]], [[128, 128, 128], [90, 90, 90], [200, 200, 200]],
    [[255, 0, 0], [0, 0, 255], [255, 255, 0]], [[0, 0, 255], [0, 0, 128], [60, 60, 255]], [[255, 255, 0], [255, 200, 0], [255, 255, 200]],
  ];
  for (let k = 0; k < 600; k++) pals.push([0, 1, 2].map(() => [rnd() * 255, rnd() * 255, rnd() * 255].map(Math.round)));
  let min = Infinity, worst = "";
  for (const pal of pals) for (const grade of [{ hue: 0, sat: 1 }, { hue: -15, sat: 1.15 }, { hue: 15, sat: 0.85 }]) {
    const cols = meaningColors(pal, grade);
    const grounds = lyricGrounds(pal);
    for (const [k, c] of Object.entries(cols)) for (const g of grounds) {
      const r = contrast(c, g);
      if (r < min) (min = r), (worst = `${k} ${c} auf ${g}`);
    }
  }
  assert.ok(min >= 4.5, "Farbe unter 4,5 : 1: " + min.toFixed(2) + " " + worst);
  // jede Bedeutung hat ihre Farbe, und die Farben bleiben unterscheidbar (Feuer ist nicht Eis)
  const c0 = meaningColors([[124, 92, 255], [182, 156, 255], [230, 222, 255]]);
  for (const k of new Set(Object.values(CUE_KIND))) assert.ok(c0[k], "keine Farbe für " + k);
  const hueOf = (c) => load("lyriccolor.js").rgb2hsl(c)[0];
  assert.ok(Math.abs(hueOf(c0.fire) - hueOf(c0.ice)) > 90, "Feuer und Eis zu ähnlich");
  console.log(`  Farben: ${Object.keys(KINDS).length} Bedeutungen, kleinster Kontrast ${min.toFixed(2)} : 1 über ${pals.length} Paletten × 3 Stimmungen`);
  if (process.env.VERBOSE) for (const [k, c] of Object.entries(c0)) console.log(`    ${k.padEnd(7)} rgb(${c.join(", ")})  ${contrast(c, [7, 6, 12]).toFixed(2)} : 1`);
  // im Plan: Farben nur ohne Duett-Stimme, Verlauf nur für Feuer/Gold/Neon
  const lines = [{ t: 0, text: "I can feel the fire in my soul" }, { t: 3000, text: "Gold and diamonds on my neck", who: "1" }, { t: 6000, text: "and I am here for you" }];
  const plan = planPlayful(lines, lines.map((l) => WS(l.text, l.t)), null, { lexicon: LEX, neg: NEG });
  assert.ok(plan[0].words[4].cls.includes("is-k-fire") && plan[0].words[4].cls.includes("is-kg") && plan[0].cls.includes("is-pk"));
  assert.ok(plan[1].words.every((w) => !w.cls.some((c) => c.startsWith("is-k"))), "Duett-Zeile eingefärbt");
}

/* ---- Stufen: Dezent (wenig Bewegung, keine Buchstaben/Akzente/Teilchen) · Verspielt · Wild (alles) */
{
  const used = { subtle: new Set(), playful: new Set(), wild: new Set() };
  for (const level of Object.keys(used)) for (const name of Object.keys(SONGS)) for (const seed of ["a", "b", "c", "d", "e"]) {
    const s = build(name);
    const plan = planPlayful(s.lines, s.words, null, { lexicon: LEX, neg: NEG, parts: s.parts, level, seed: name + seed });
    for (const p of plan) {
      if (p.t) used[level].add(p.t);
      if (level === "subtle") {
        assert.ok(!p.t || allowed(p.t, "subtle"), "Dezent: " + p.t);
        for (const w of p.words) {
          assert.ok(!Array.isArray(w.chars) && !w.chars, "Dezent: Buchstaben");
          assert.ok(!("--pac" in w.vars) && !w.cls.includes("is-pt"), "Dezent: Akzent/Teilchen");
          if (w.vars["--wr"]) assert.ok(Math.abs(parseFloat(w.vars["--wr"])) <= 10, "Dezent: Drehung " + w.vars["--wr"]);
        }
      }
    }
  }
  assert.ok([...used.subtle].every((t) => RECIPES[t].e <= 1));
  assert.ok([...used.wild].some((t) => RECIPES[t].wild), "Wild ohne wilde Rezepte");
  assert.ok(used.wild.size >= used.playful.size - 3 && used.playful.size > used.subtle.size);
}

/* ---- ♪ in der Lücke: eigene Klasse, wippt im Takt (Lage im Takt aus Schlägen bzw. Takten) */
{
  const lines = [{ t: 0, text: "hello there my friend" }, { t: 3000, text: "♪" }, { t: 9000, text: "and here we go again" }];
  const plan = planPlayful(lines, [WS(lines[0].text, 0), [], WS(lines[2].text, 9000)], null, { match: () => [] });
  assert.ok(plan[1].cls.includes("is-p-note") && !plan[0].cls.includes("is-p-note"));
  const beats = [];
  for (let t = 0; t < 20; t += 0.5) beats.push({ t });
  const bp = barPhase(beats, null, 3.25);
  assert.equal(bp.p, 500);
  assert.equal(bp.bar, 2000);
  assert.equal(bp.d, -1250, "Takt beginnt bei 2 s: 1,25 s hinein");
  const bars = [{ t: 0.5 }, { t: 2.5 }];
  assert.equal(barPhase(beats, bars, 3.25).d, -750, "mit Takten der Analyse");
  assert.equal(barPhase(null, null, 3), null);
}

/* ---- Vorlauf-Zuschlag aus der gemessenen Bildschirmrate: ein Bild (60 Hz ~17 ms, 144 Hz ~7 ms), 6 … 34 ms */
{
  assert.equal(leadPad(60), 16.7);
  assert.equal(leadPad(144), 6.9);
  assert.equal(leadPad(30), 33.3);
  assert.equal(leadPad(24), 34, "höchstens 34 ms");
  assert.equal(leadPad(360), 6, "mindestens 6 ms");
  assert.equal(leadPad(0), LEAD_PAD, "ungemessen: 60 Hz");
  // Spiel-Uhr mit falschen 60 und 144 Hz: Klassenwechsel im ersten Bild ab der Schwelle, die Überblendung startet im
  // nächsten Bild und dauert --pl – gelandet höchstens ein Bild neben dem Einsatz (mit festen 20 ms lag die Landung bei
  // 144 Hz im Mittel ~13 ms zu früh)
  for (const hz of [60, 144]) {
    const fr = 1000 / hz;
    let worst = 0, sum = 0, n = 0, sumOld = 0;
    for (let a = 5000; a < 5200; a += 3.7) for (const lead of [90, 140, 180]) {
      const w = { a, lead };
      let f = 0;
      while (!sungAt(w, f * fr, leadPad(hz))) f++;
      const land = (f + 1) * fr + lead;
      let g = 0;
      while (!sungAt(w, g * fr, 20)) g++;
      worst = Math.max(worst, Math.abs(land - a));
      sum += land - a;
      sumOld += (g + 1) * fr + lead - a;
      n++;
    }
    assert.ok(worst <= fr + 0.5, `${hz} Hz: bis ${worst.toFixed(1)} ms neben dem Einsatz`);
    assert.ok(Math.abs(sum / n) <= fr / 2 + 0.5, `${hz} Hz: im Mittel ${(sum / n).toFixed(1)} ms neben dem Einsatz`);
    if (hz === 144) assert.ok(Math.abs(sum / n) < Math.abs(sumOld / n), "nicht besser als fest 20 ms");
    console.log(`  Vorlauf ${hz} Hz: Zuschlag ${leadPad(hz)} ms, Landung im Mittel ${(sum / n).toFixed(1)} ms (fest 20 ms: ${(sumOld / n).toFixed(1)} ms), höchstens ${worst.toFixed(1)} ms daneben`);
  }
}

/* ---- Bogen des Songs: Aufbau im Pre-Chorus, Steigerung, große Momente, Ruf und Antwort, Hook-Zeichen, Abgang */
{
  const lines = [], words = [], parts = [];
  let t = 2000;
  const sec = (kind, ls) => {
    parts.push({ t0: t / 1000 - 0.2, kind });
    for (const x of ls) {
      const [text, who] = Array.isArray(x) ? x : [x];
      lines.push(who ? { t, text, who } : { t, text });
      words.push(WS(text, t, 260));
      t += 3000;
    }
    t += 1500;
  };
  const CH = ["Fire in my heart tonight", "We are the fire, burning bright", "Feel the fire take control", "Fire burning in my soul"];
  sec("verse", ["Do you remember where we met?", "Under neon lights in the rain", "Walking slowly through the city", "Every window full of stories"]);
  sec("pre", ["Can you feel it coming now", "Every heartbeat, every vow", "Standing at the edge of time"]);
  sec("chorus", CH);
  sec("verse", [["I was waiting at the station", "1"], ["I was running for the train", "2"], ["Looking for a destination", "1"], ["Never looking back again", "2"]]);
  sec("pre", ["Can you feel it coming now", "Every heartbeat, every vow", "Standing at the edge of time"]);
  sec("chorus", CH);
  sec("chorus", CH);
  for (const level of ["playful", "wild"]) for (const seed of ["s1", "s2", "s3"]) {
    const plan = planPlayful(lines, words, null, { lexicon: LEX, neg: NEG, parts, level, seed });
    // Aufbau: Fortschritt wächst, Landungen werden kürzer, die letzte Zeile vor dem Refrain steigt
    const pre = [4, 5, 6].map((i) => plan[i]);
    const bu = pre.map((p) => Number(p.vars["--pbu"]));
    assert.ok(pre.every((p) => p.cls.includes("is-p-build")) && bu[0] < bu[1] && bu[1] < bu[2] && bu[2] === 1, "Aufbau: " + bu);
    pre.forEach((p) => p.words.forEach((w) => assert.ok(w.lead <= leadOf(p.t) && w.lead >= 90, `Aufbau ${p.t}: Vorlauf ${w.lead}`)));
    assert.ok(pre[2].words.every((w) => w.lead <= Math.round(leadOf(pre[2].t) * 0.7) || w.lead === 90), "letzte Aufbau-Zeile landet nicht schneller");
    assert.ok(plan[6].cls.includes("is-p-riser") && parseFloat(plan[6].vars["--prd"]) >= 800, "keine Steigerung vor dem Refrain");
    assert.ok(!plan[5].cls.includes("is-p-riser"));
    // große Momente: erster und letzter Refrain, sonst keiner
    const moments = plan.map((p, i) => (p.cls.includes("is-p-moment") ? i : -1)).filter((i) => i >= 0);
    // (die letzten beiden Refrains folgen direkt aufeinander: ein Block, der Moment an seinem Anfang)
    assert.deepEqual(moments, [7, 18], "Momente: " + moments);
    assert.ok(plan[7].cls.includes("is-p-big"), "erster Refrain nicht groß");
    // Ruf und Antwort: Frage → Antwort, Duett-Stimmen im Wechsel – die Antwort kommt von der anderen Seite und spielt
    // dieselbe Inszenierung, wenn sie passt
    assert.ok(plan[0].v.includes(":l:") && plan[1].v.includes(":r:") && plan[1].cls.includes("is-p-resp"), "Frage/Antwort: " + plan[0].v + " / " + plan[1].v);
    assert.ok(plan[11].v.includes(":l:") && plan[12].v.includes(":r:") && !plan[12].cls.includes("is-p-resp"), "Duett: Seiten über die Stimmen, Richtung gespiegelt");
    const mirrored = [[0, 1], [11, 12], [13, 14]].filter(([a, b]) => plan[a].t === plan[b].t).length;
    assert.ok(mirrored >= 2, "Antworten spielen kaum dieselbe Inszenierung: " + mirrored);
    // Hook-Zeichen: „fire“ kehrt wieder – jedes Mal dasselbe Zeichen dieses Songs
    const marks = new Set();
    plan.forEach((p, i) => p.words.forEach((w, k) => {
      if (!w.cls.includes("is-p-hook")) return;
      assert.equal(bare(words[i][k].text), "fire");
      marks.add(w.vars["--pac"] + "|" + w.cls.find((c) => c.startsWith("is-p-hm-")));
    }));
    assert.equal(marks.size, 1, "Hook-Zeichen wechselt im Song: " + [...marks]);
    assert.ok(HOOKS.some((h) => [...marks][0].startsWith("m-a-" + h + "|")));
    // Abgang passend zum Auftritt, Wörter gestaffelt
    for (const p of plan) if (p.t) {
      assert.equal(p.vars["--pxo"], exitOf(p.t));
      assert.ok(Object.values(EXITS).includes(p.vars["--pxo"]));
      p.words.forEach((w, k) => assert.equal(w.vars["--wi"], String(k)));
    }
  }
  // ohne Bewegung: der ruhende Satz bleibt (Aufbau, groß, Antwort) – keine Bewegungs-Klassen
  const still = planPlayful(lines, words, null, { lexicon: LEX, neg: NEG, parts, still: true, seed: "s1" });
  assert.ok(still[4].cls.includes("is-p-build") && still[7].cls.includes("is-p-big") && still[1].cls.includes("is-p-resp"));
  assert.ok(still.every((p) => !p.cls.includes("is-p-moment") && !p.cls.includes("is-p-riser")));
  // Dezent: keine Hook-Akzente, kein Abgang
  const sub = planPlayful(lines, words, null, { lexicon: LEX, neg: NEG, parts, level: "subtle", seed: "s1" });
  assert.ok(sub.every((p) => !p.vars["--pxo"] && p.words.every((w) => !w.cls.includes("is-p-hook"))));
  // jedes Abgangs-Zeichen gibt es als @keyframes (der Wächter oben prüft die Eigenschaften)
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "Mirage", "user.css"), "utf8");
  for (const n of [...new Set(Object.values(EXITS)), "m-l-moment", "m-l-riser"]) assert.ok(css.includes("@keyframes " + n + " {"), n);
  assert.ok(/\.m-im-line\.is-past:has\(\+ \.m-im-line\.is-active\) \.m-w \{/.test(css), "Abgang nicht auf die Zeile direkt vor der aktiven beschränkt");
}

/* ---- schneller Rap: Silben-Stöße über die gesungene Dauer (Zahl = Silben, Dauer = Silbenabstand) */
{
  const s = build("rap");
  const plan = planPlayful(s.lines, s.words, null, { lexicon: LEX, neg: NEG, parts: s.parts, seed: "rap" });
  let syl = 0, multi = 0;
  plan.forEach((p, i) => p.words.forEach((w, k) => {
    if (w.vars["--pac"] !== "m-a-syl") return;
    syl++;
    const n = Number(w.vars["--pai"] || 1), d = parseFloat(w.vars["--pad"]), ww = s.words[i][k];
    if (n > 1) multi++;
    assert.ok(n >= 1 && n <= 4 && d >= 70 && d <= 260, `Silben-Stoß ${ww.text}: ${n} × ${d} ms`);
    assert.ok(n * d <= ww.b - ww.a + 4, `Silben-Stöße länger als das Wort ${ww.text}`);
  }));
  assert.ok(syl >= 20 && multi >= 5, `Rap: ${syl} Silben-Stöße, ${multi} mehrsilbig`);
  // Ballade: keine Silben-Stöße
  const b = build("ballad");
  assert.ok(planPlayful(b.lines, b.words, null, { lexicon: LEX, neg: NEG, parts: b.parts }).every((p) => p.words.every((w) => w.vars["--pac"] !== "m-a-syl")));
}

/* ---- Umschalten mitten im Song (Ruhig / Keine Blitze / weniger Bewegung / Stärke): neu planen und malen –
   Buchstaben, Wortbilder und Vorlauf gehen sofort weg und kommen wieder (immersive.js ruft dafür paintPlayful) */
{
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
  const lines = [{ t: 1000, text: "Boom boom" }, { t: 4000, text: "We set the night on fire" }, { t: 7000, text: "Boom boom" }];
  const wl = lines.map((l) => WS(l.text, l.t).map((w) => ({ ...w, el: Object.assign(mk(doc), { _text: w.text }) })));
  const els = lines.map(() => mk(doc));
  const opts = { lexicon: LEX, neg: NEG, level: "wild", seed: "toggle" };
  const snapshot = () => ({
    letters: wl.flat().reduce((n, w) => n + w.el.children.length, 0),
    cues: wl.flat().filter((w) => [...w.el.classList].some((c) => c.startsWith("is-c-"))).length,
    leads: wl.flat().filter((w) => w.lead > 0).length,
    motion: els.filter((e) => [...e.classList].some((c) => /^is-p-(moment|riser)$/.test(c)) || "--pxo" in e.style.v).length,
    text: wl.flat().map((w) => w.el.textContent).join(" "),
  });
  paintPlayful(els, planPlayful(lines, wl, null, opts), wl);
  const on = snapshot();
  assert.ok(on.letters > 0 && on.cues > 0 && on.leads > 0 && on.motion > 0, "bewegt: " + JSON.stringify(on));
  paintPlayful(els, planPlayful(lines, wl, null, { ...opts, still: true }), wl);
  const off = snapshot();
  assert.deepEqual([off.letters, off.cues, off.leads, off.motion], [0, 0, 0, 0], "still: " + JSON.stringify(off));
  assert.equal(off.text, on.text, "Text bleibt derselbe");
  paintPlayful(els, planPlayful(lines, wl, null, opts), wl);
  assert.deepEqual(snapshot(), on, "wieder bewegt wie vorher");
  // Stärke „Dezent“ mitten im Song: keine Buchstaben, keine Akzente
  paintPlayful(els, planPlayful(lines, wl, null, { ...opts, level: "subtle" }), wl);
  assert.equal(snapshot().letters, 0);
  // immersive.js: Einstellungen (applySettings → styleLyrics) und weniger Bewegung (matchMedia) malen neu, die Stärke
  // ohne den Liedtext neu zu laden
  const im = fs.readFileSync(path.join(__dirname, "..", "..", "src", "immersive.js"), "utf8");
  assert.ok(/function styleLyrics\(\) \{[\s\S]*?playfulRestyle\(\);\n {2}\}/.test(im), "styleLyrics malt den Stil nicht neu");
  assert.ok(/reducedMotion\.addEventListener\?\.\("change", playfulRestyle\)/.test(im), "weniger Bewegung wirkt erst beim nächsten Song");
  const st = fs.readFileSync(path.join(__dirname, "..", "..", "src", "settings.js"), "utf8");
  assert.ok(/cfg\.lyrPlayLevel = k;[\s\S]{0,160}immersive\.styleLyrics\(\)/.test(st), "Stärke lädt den Liedtext neu");
}

console.log("lyricstyle: ok");
