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
  motionLoad, TREATMENTS, sungAt, PRE_MS, barPhase, leadPad, LEAD_PAD, planSteps, paintSteps,
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
  // gehalten 1,8 s, aber die nächste Zeile (Hintergrundgesang) kommt nach 1,25 s: die Dehnung endet davor (95 %)
  assert.equal(fire.vars["--hd"], "1188ms");
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
    // aktive Zeile, oder .is-pout: die Zeile direkt vor ihr (setzt immersive.js beim Zeilenwechsel)
    assert.ok(/\.is-active|\.is-past\.is-pout/.test(r.sel), "Bewegung außerhalb der aktiven Zeile: " + r.sel);
    // kein :has() im Bewegungs-Block: es ließ bei jedem Einsatz und Zeilenwechsel Nachbarn neu prüfen (Party-Messung)
    assert.ok(!r.sel.includes(":has("), ":has() im Bewegungs-Block: " + r.sel);
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
  for (const n of ["m-l-tide", "m-l-pend", "m-t-punch", "m-q-pt", "m-p-caret"]) assert.ok(names.has(n), n);
  // Helligkeit: kräftige Wechsel (Deckkraft-Sprung ≥ 0,4) nur in bekannten Bewegungen, und die laufen langsam genug
  // für höchstens drei je Sekunde (m-c-glow: Durchgang ≥ 1,4 s; Schreibmarke 1,1 s – je zwei Wechsel)
  const strong = [];
  for (const fr of frames) {
    const ops = fr.kids.map((k) => decls(k.body).find(([p]) => p === "opacity")).filter(Boolean).map(([, v]) => Number(v)).filter((v) => !isNaN(v));
    let ch = 0;
    for (let k = 1; k < ops.length; k++) if (Math.abs(ops[k] - ops[k - 1]) >= 0.4) ch++;
    if (ch) strong.push([fr.sel.replace("@keyframes", "").trim(), ch]);
  }
  const SLOW = { "m-c-glow": 1.4, "m-p-caret": 1.1, "m-p-drop": 1.5, "m-q-pt": 0.9, "m-a-echo": 0.6, "m-p-drop-in": 0.18, "m-c-sirena": 1.6, "m-c-sirenb": 1.6 };
  for (const [n, ch] of strong) {
    assert.ok(n in SLOW, "kräftiger Helligkeitswechsel in " + n);
    // Teilchen, Tropfen, Echo und der Drop-Auftritt sind kleine, einmalige Ein-/Ausblendungen – kein Blinken der Schrift
    if (["m-c-glow", "m-p-caret", "m-c-sirena", "m-c-sirenb"].includes(n)) assert.ok((ch * 2) / SLOW[n] <= 3, `${n}: ${ch} Wechsel je ${SLOW[n]} s`);
  }
  assert.ok(/animation: m-c-glow max\(var\(--pcd, 1s\), 1\.4s\)/.test(block), "Schein ohne Mindestdauer");
  assert.ok(/animation: m-p-caret 1\.1s/.test(block), "Schreibmarke zu schnell");
  // ♪ wippt nur im Bewegungs-Block (Ruhig/Keine Blitze/weniger Bewegung: still)
  // ♪: keine frei laufende CSS-Schleife mehr (die driftete ab) – Bewegung Bild für Bild aus der Songuhr, Farbe im Bewegungs-Block
  assert.ok(!names.has("m-p-note") && media[0].kids.some((r) => /\.is-p-note\.is-active/.test(r.sel) && /--pnc/.test(r.body)), "♪ ohne Farbe im Takt");
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
      assert.ok(sc <= Math.max(1, Math.min(1.3, 1 + 2.5 / len)) + 1e-9, `${t}: wächst auf ${sc} bei ${len} Zeichen`);
      // sichtbar gedreht (deckend und nicht winzig): ragt höchstens ~0,25 em über die Zeile (nie in die Nachbarzeile)
      const visible = (p.o ?? 1) > 0 && !(sc <= 0.5);
      if (visible && p.r) assert.ok(Math.sin((Math.min(90, Math.abs(p.r)) * Math.PI) / 180) * 0.3 * len <= 0.26 || Math.abs(p.r) <= 8, `${t}: ${p.r}° bei ${len} Zeichen`);
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
  assert.ok(/\.m-im-line\.is-past\.is-pout > \.m-im-words \{/.test(css), "Abgang nicht auf die Zeile vor der aktiven beschränkt");
  const imSrc = fs.readFileSync(path.join(__dirname, "..", "..", "src", "immersive.js"), "utf8");
  assert.ok(/classList\.add\("is-pout"\)/.test(imSrc) && /classList\.add\("is-pcar"\)/.test(imSrc), "immersive.js setzt is-pout/is-pcar nicht");
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
  // ohne den Liedtext neu zu laden (Windows-Checkout hat CRLF: Wagenrückläufe entfernen)
  const im = fs.readFileSync(path.join(__dirname, "..", "..", "src", "immersive.js"), "utf8").split(String.fromCharCode(13)).join("");
  assert.ok(/function styleLyrics\(\) \{[\s\S]*?playfulRestyle\(\);\n {2}\}/.test(im), "styleLyrics malt den Stil nicht neu");
  assert.ok(/reducedMotion\.addEventListener\?\.\("change", playfulRestyle\)/.test(im), "weniger Bewegung wirkt erst beim nächsten Song");
  const st = fs.readFileSync(path.join(__dirname, "..", "..", "src", "settings.js"), "utf8");
  assert.ok(/cfg\.lyrPlayLevel = k;[\s\S]{0,160}immersive\.styleLyrics\(\)/.test(st), "Stärke lädt den Liedtext neu");
}

/* ---- Häppchen (Party-Messung: Planen + Malen am Stück 40–60 ms beim Songwechsel): planSteps gibt zwischen den
   Zeilen Luft und kommt zum selben Plan; paintSteps malt die Zeilen um die aktive zuerst; ein zweites Malen mit
   demselben Plan ändert nichts (keine Neuberechnung unveränderter Zeilen) */
{
  const s = build("party");
  const o = { lexicon: LEX, neg: NEG, parts: s.parts, seed: "chunk" };
  const g = planSteps(s.lines, s.words, null, o);
  let r = g.next(), steps = 0;
  while (!r.done) (steps++, (r = g.next()));
  assert.ok(steps >= 8, "planSteps gibt zu selten Luft: " + steps);
  assert.deepEqual(JSON.parse(JSON.stringify(r.value)), JSON.parse(JSON.stringify(planPlayful(s.lines, s.words, null, o))));
  // winziges DOM, zählt Änderungen
  let muts = 0;
  const mk = (doc) => {
    const el = {
      ownerDocument: doc, children: [], _text: "", dataset: {},
      classList: {
        s: new Set(),
        add(...c) { muts++; c.forEach((x) => this.s.add(x)); },
        remove(...c) { muts++; c.forEach((x) => this.s.delete(x)); },
        contains(c) { return this.s.has(c); },
        [Symbol.iterator]() { return this.s[Symbol.iterator](); },
      },
      style: { v: {}, setProperty(k, v) { muts++; this.v[k] = String(v); }, removeProperty(k) { muts++; delete this.v[k]; } },
      append(...k) { this.children.push(...k); },
      get firstElementChild() { return this.children[0] || null; },
      get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join("") : this._text; },
      set textContent(v) { muts++; this.children = []; this._text = v; },
    };
    Object.defineProperty(el, "className", { set(v) { v.split(" ").forEach((c) => el.classList.s.add(c)); } });
    return el;
  };
  const doc = { createElement: () => mk(doc) };
  const wl = s.words.map((ws) => ws.map((w) => ({ ...w, el: Object.assign(mk(doc), { _text: w.text }) })));
  const els = s.lines.map(() => mk(doc));
  const plan = r.value;
  const at = 20, order = [];
  const pg = paintSteps(els, plan, wl, at);
  const painted = () => els.map((e, i) => (e.classList.s.size ? i : -1)).filter((i) => i >= 0);
  pg.next();
  order.push(...painted());
  assert.ok(order.length <= 4 && order.every((i) => Math.abs(i - at) <= 2), "zuerst die Zeilen um die aktive: " + order);
  while (!pg.next().done);
  assert.equal(painted().length, plan.filter((p) => p.cls.length).length);
  muts = 0;
  paintPlayful(els, plan, wl, at);
  assert.equal(muts, 0, "zweites Malen mit demselben Plan ändert " + muts + "×");
  // Analyse kommt nach: nur, was sich ändert
  const plan2 = planPlayful(s.lines, s.words, null, { ...o, level: "wild" });
  paintPlayful(els, plan2, wl, at);
  assert.ok(muts > 0);
}

/* ---- ♪ im Takt mit einer falschen Uhr (60 Bilder/s): Spitze auf jedem Schlag (±1 Bild), kein Sprung zwischen den
   Schlägen und Takten, auf der Eins größer; Farbe fließt ohne Sprung durch lesbare Cover-Farben */
{
  const { notePose, noteColor } = load("lyricstyle.js");
  const { noteRing, lyricGrounds } = load("lyriccolor.js");
  // 120 BPM mit leichtem Wackeln, Takte alle vier Schläge (ab dem zweiten Schlag: Auftakt)
  const beats = [], bars = [];
  for (let k = 0, t = 1; k < 64; k++, t += 0.5 + (k % 3 === 0 ? 0.004 : -0.002)) {
    beats.push({ t });
    if (k % 4 === 1) bars.push({ t });
  }
  const fr = 1 / 60;
  const P = [];
  for (let s = beats[0].t; s < beats[60].t; s += fr) P.push([s, notePose(beats, bars, s)]);
  let jump = 0;
  for (let k = 1; k < P.length; k++) jump = Math.max(jump, Math.abs(P[k][1].y - P[k - 1][1].y), Math.abs(P[k][1].r - P[k - 1][1].r) / 75);
  // größter Schritt je Bild: Steigung des Hügels (≤ π·Ausschlag/Schlag) – kein Sprung beim Wechsel von Schlag/Takt
  assert.ok(jump <= (Math.PI * 0.2 * fr) / 0.5 + 0.002, "♪ springt: " + jump.toFixed(4));
  for (let k = 2; k < 58; k++) {
    // Spitze des Hügels: das Bild mit dem größten Ausschlag rund um den Schlag
    const near = P.filter(([s]) => Math.abs(s - beats[k].t) < 0.2);
    const top = near.reduce((m, x) => (Math.abs(x[1].y) > Math.abs(m[1].y) ? x : m));
    assert.ok(Math.abs(top[0] - beats[k].t) <= fr + 1e-9, `Schlag ${k}: Spitze ${((top[0] - beats[k].t) * 1000).toFixed(1)} ms daneben`);
    const down = bars.some((b) => Math.abs(b.t - beats[k].t) < 0.01);
    assert.equal(top[1].down, down, "Eins erkannt");
    if (down) assert.ok(Math.abs(top[1].y) > 0.15, "Eins groß");
    else assert.ok(Math.abs(top[1].y) < 0.1, "andere Schläge klein");
  }
  assert.equal(notePose(null, null, 3), null);
  // Farbe: lesbar (auch die Mischungen), ohne Sprung an den Taktgrenzen
  const pals = [[[255, 40, 40], [40, 40, 255], [250, 250, 80]], [[20, 20, 30], [60, 60, 70], [90, 90, 100]], [[255, 255, 255], [200, 255, 200], [255, 200, 255]]];
  for (const pal of pals) {
    const ring = noteRing(pal), grounds = lyricGrounds(pal);
    let prev = null, worst = 99, step = 0;
    for (let s = bars[0].t; s < bars[10].t; s += fr) {
      const c = noteColor(ring, beats, bars, s);
      for (const g of grounds) worst = Math.min(worst, contrast(c, g));
      if (prev) step = Math.max(step, ...c.map((v, j) => Math.abs(v - prev[j])));
      prev = c;
    }
    assert.ok(worst >= 4.5, "♪-Farbe unter 4,5 : 1: " + worst.toFixed(2));
    assert.ok(step <= 8, "♪-Farbe springt: " + step);
  }
}

/* ---- Hook-Wort wechselt auf der Eins die Schrift: nur kurze Zeilen, nur Schriften des Songs, die das Wort können */
{
  const s = build("party");
  let alt = 0;
  for (const seed of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
    for (const [level, still] of [["playful", false], ["wild", false], ["subtle", false], ["wild", true]]) {
      const plan = planPlayful(s.lines, s.words, null, { lexicon: LEX, neg: NEG, parts: s.parts, level, still, seed });
      plan.forEach((p, i) => p.words.forEach((w, k) => {
        if (!w.vars["--phf"]) return;
        assert.ok(level !== "subtle" && !still, "Schriftwechsel bei " + level + (still ? " still" : ""));
        assert.ok(w.cls.includes("is-p-hook") && s.words[i].length <= 6, "Schriftwechsel auf langer Zeile");
        const role = w.vars["--phf"].match(/--pf-(\w+)/)[1];
        assert.ok(plan.deck.fonts.includes(role) && covers(role, s.words[i][k].text) && !["wide", "mono"].includes(role));
        alt++;
      }));
    }
  }
  assert.ok(alt > 0, "kein Hook-Wort wechselt je die Schrift");
}

/* ---- Kategorien: neue Begriffe bekommen über ihre Kategorie eine Bewegung; Gewalt folgt der Einstellung für derbe
   Inhalte (aus: nichts, sanft: nur Farbe) und erkennt Redewendungen („killing it“, „shot of tequila“, „photo shoot“) */
{
  const { CATEGORY_FX, VIOLENT_CATS, categoryOf, cueFor } = load("lyricstyle.js");
  const cuesOf = (text, explicit = "on", extra = {}) => cueMatcher([{ text }], LEX, { neg: NEG, explicit, ...extra })(text).map((x) => x.cue + (x.calm ? ":calm" : ""));
  assert.deepEqual(cuesOf("he pulls out a gun"), ["shot"]);
  assert.deepEqual(cuesOf("ich hab ne Pistole dabei"), ["shot"]);
  assert.ok(cuesOf("rat-a-tat with the tommy gun").includes("rapid"), "Tommy Gun");
  assert.ok(cuesOf("Maschinengewehr in der Nacht").includes("rapid"));
  assert.ok(cuesOf("swing the axe tonight").includes("slash"));
  assert.ok(cuesOf("they want to kill me").includes("shatter"));
  assert.ok(cuesOf("blood on the dancefloor").includes("war"));
  assert.ok(cuesOf("a grenade in his hand").includes("burst"));
  assert.ok(cuesOf("hear the police sirens").includes("siren"));
  // Redewendungen: keine Gewalt
  for (const t of ["we are killing it tonight", "pour a shot of tequila", "photo shoot in the morning", "shoot your shot baby", "ein Schuss Tequila"]) {
    assert.ok(!cuesOf(t).some((c) => /^(shot|rapid|slash|shatter|war)/.test(c)), "Gewalt in Redewendung: " + t + " → " + cuesOf(t));
  }
  // Verneinung über den Wortsinn
  assert.deepEqual(cuesOf("don't shoot"), [], "verneint");
  // derbe Inhalte: aus → keine Bewegung, sanft → nur Farbe
  assert.deepEqual(cuesOf("he pulls out a gun", "off"), []);
  assert.deepEqual(cuesOf("he pulls out a gun", "soft"), ["shot:calm"]);
  const plan = planPlayful([{ t: 0, text: "he pulls out a gun" }], [WS("he pulls out a gun", 0)], null, { lexicon: LEX, neg: NEG, explicit: "soft" });
  const gw = plan[0].words[4];
  assert.ok(gw.cls.includes("is-k-rage") && !gw.cls.some((c) => c.startsWith("is-c-")) && !gw.chars, "sanft: nur Farbe " + gw.cls);
  // nicht gewaltsame Kategorien: Fahrzeug, Tier, Essen, Technik, Sport
  assert.ok(cuesOf("helicopter over the city").includes("zoomby"));
  assert.ok(cuesOf("a wolf in the night").includes("prowl"));
  assert.ok(cuesOf("sweet like chocolate").includes("savor"));
  assert.ok(cuesOf("dancing like a robot").includes("glitchy"));
  assert.ok(cuesOf("kick the ball").includes("kick"));
  // Kategorie aus dem Wortsinn (künftige Begriffe aus dem Wörterbuch): unbekannter Begriff → Bewegung über die Kategorie
  assert.equal(cueFor("rocketlauncher", "weapon"), "shot");
  assert.equal(cueFor("fire", "weapon"), "flame", "eigene Bewegung geht vor");
  assert.equal(categoryOf("knife"), "blade");
  assert.ok(VIOLENT_CATS.has(categoryOf("machinegun")));
  for (const fx of new Set(Object.values(CATEGORY_FX))) assert.ok(FX_VARIANTS[fx] || ["drift", "bounce", "glint", "float", "bloom", "beat", "shine", "droop", "shiver", "shake", "tick", "wave", "dim", "flame", "drip", "dash", "neon", "burst"].includes(fx), "Kategorie ohne Bewegung: " + fx);
  // Farben der Kategorien lesbar (Blut, Stahl) – geprüft im Farben-Block über KINDS
  assert.ok(KINDS.blood && KINDS.steel && CUE_KIND.war === "blood" && CUE_KIND.slash === "steel");
}

/* ---- jeder Begriff des Wörterbuchs (src/concepts.js) bekommt eine Bewegung: eigene, sonst die seiner Kategorie;
   Gewalt-Begriffe sind als Gewalt erkannt (folgen der Einstellung für derbe Inhalte) */
{
  const { CATEGORIES, GROUPS } = load("concepts.js");
  const { CATEGORY_FX, VIOLENT_CATS, categoryOf, cueFor } = load("lyricstyle.js");
  for (const cat of CATEGORIES) if (cat !== "explicit") assert.ok(CATEGORY_FX[cat], "Kategorie ohne Bewegung: " + cat);
  let n = 0, none = [];
  for (const [cat, list] of Object.entries(GROUPS)) {
    if (cat === "explicit") continue;
    for (const c of list.split(" ")) {
      n++;
      if (!cueFor(c)) none.push(c);
      if (cat === "violence") assert.ok(VIOLENT_CATS.has(categoryOf(c)), "Gewalt nicht erkannt: " + c);
    }
  }
  assert.ok(none.length <= 20, `${none.length} von ${n} Begriffen ohne Bewegung: ${none.join(" ")}`);
  console.log(`  Kategorien: ${n - none.length}/${n} Begriffe mit Bewegung (ohne: Allerweltswörter ${none.length})`);
}

/* ---- Namen sind keine Begriffe: „… from the sky Ash“ färbt nicht (und Asche ist grau, nicht rot); am Satzanfang, in
   Großbuchstaben-Zeilen und im Deutschen (Hauptwörter groß) zählen sie weiter */
{
  const m = (text) => cueMatcher([{ text }], LEX, { neg: NEG, explicit: "on" })(text).map((x) => s(text, x));
  const s = (text, x) => text.slice(x.at, x.at + x.len).toLowerCase() + ":" + x.cue;
  const names = { Ash: "Money falling down from the sky Ash", Rose: "I wrote this song for Rose", Hope: "Dancing all night with Hope", Grace: "I love you Grace",
    Storm: "Call me tonight Storm", Angel: "Come back to me Angel", Summer: "Driving to the coast with Summer", River: "Waiting by the door for River", Sky: "Hold my hand Sky" };
  for (const [name, text] of Object.entries(names)) assert.ok(!m(text).some((x) => x.startsWith(name.toLowerCase() + ":")), `Name „${name}“ als Begriff: ${m(text)}`);
  // klein geschrieben, am Zeilenanfang, nach Satzende, in Großbuchstaben: Begriff
  assert.ok(m("the rose is red").some((x) => x.startsWith("rose:")));
  assert.ok(m("Rose petals everywhere").some((x) => x.startsWith("rose:")));
  assert.ok(m("I said goodbye. Rain is falling").some((x) => x.startsWith("rain:")));
  assert.ok(m("FIRE IN THE SKY").some((x) => x.startsWith("sky:")));
  const de = ["Ich sehe den Regen fallen", "Und das Feuer brennt in mir", "Ich bin nicht allein heute Nacht", "Mein Herz schlägt nur für dich"].map((text) => ({ text }));
  const dm = cueMatcher(de, LEX, { neg: NEG })(de[0].text).map((x) => s(de[0].text, x));
  assert.ok(dm.some((x) => /^regen:/.test(x)), "Deutsch: Hauptwörter sind groß, kein Name: " + dm);
  // Asche: grau (Dunkel), nicht Feuer-Rot
  assert.ok(m("only ashes left behind").includes("ashes:dim"), "Asche: " + m("only ashes left behind"));
  assert.equal(CUE_KIND.dim, "dark");
}

/* ---- Schnelle Stellen (Rap 8 Wörter/s, Zeilen von 0,4 s): mit Spiel-Uhr (60 und 144 Hz) ist jedes Wort auf seinem
   Einsatz lesbar (± ein Bild), und keine Bewegung einer Zeile läuft noch, wenn das erste Wort der nächsten landet –
   Akzente, gehaltene Töne, Farbwechsel, Abgang und großer Moment passen in die Zeit (vorher hinkte der Text hinterher) */
{
  const { fastSong, lateReport } = require("./fixtures/fast-lines.js");
  const { LEAD_MIN } = load("lyricstyle.js");
  const s = fastSong();
  let words = 0, accents = 0, fast = 0;
  for (const level of ["subtle", "playful", "wild"]) {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const plan = planPlayful(s.lines, s.words, s.d, { lexicon: LEX, neg: NEG, parts: s.parts, drops: [], level, seed: "fast" + seed });
      for (const hz of [60, 144]) {
        const late = lateReport(plan, s, sungAt, { fr: 1000 / hz, pad: leadPad(hz) });
        assert.deepEqual(late, [], `${level}/${seed} ${hz} Hz: zu spät:\n  ` + late.slice(0, 8).join("\n  "));
      }
      plan.forEach((p, i) => p.words.forEach((pw, k) => {
        words++;
        if (pw.vars["--pac"]) accents++;
        // Echo blendet nur die Kopie aus, nie das Wort selbst
        assert.notEqual(pw.vars["--pac"], "m-a-echo", "Wort blendet sich als Echo selbst aus");
        // Landung nie länger als 90 % des Abstands zum vorigen Einsatz (aber nie unter LEAD_MIN)
        const gap = k ? s.words[i][k].a - s.words[i][k - 1].a : Infinity;
        if (pw.lead) assert.ok(pw.lead <= Math.max(LEAD_MIN, 0.9 * gap), `Landung ${pw.lead} ms bei ${gap} ms Abstand`);
      }));
      fast += plan.filter((p) => p.cls.includes("is-p-fast")).length;
    }
  }
  assert.ok(accents > 0, "schnelle Stellen ganz ohne Akzente");
  assert.ok(fast >= 8 * 18, "kurze Zeilen ohne is-p-fast: " + fast);
  console.log(`  schnelle Stellen: ${words} Wörter (Rap 8/s, Zeilen 0,4 s) rechtzeitig, ${accents} Akzente passen in die Zeit`);
}

/* ---- Ausbau: Zählen, Aufzählung, Wort-Wiederholung, Frage, lang gehaltene Töne, Hintergrundgesang, Steigerung der
   Refrains, direkt wiederholte Zeilen, Ballade im Ton, eine Schrift je Teil, neue Rezepte */
{
  const { countRun, segments, wordRepeats, VIB_MIN } = load("lyricstyle.js");
  const { balladOk } = load("lyricdeck.js");
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "Mirage", "user.css"), "utf8");
  const sp = (s) => s.split(" ");
  // Zählen: mindestens drei Zahlen in Folge (auf- oder abwärts), eine Sprache, Ziffern, Wörter dazwischen
  assert.deepEqual([...countRun(sp("one, two, three, four"))], [0, 1, 2, 3]);
  assert.deepEqual([...countRun(sp("Drei, zwei, eins – los!"))], [0, 1, 2], "abwärts, Deutsch");
  assert.deepEqual([...countRun(sp("uno dos tres"))], [0, 1, 2]);
  assert.deepEqual([...countRun(sp("un, deux, trois, quatre"))], [0, 1, 2, 3]);
  assert.deepEqual([...countRun(sp("раз один два три"))], [1, 2, 3], "Russisch");
  assert.deepEqual([...countRun(sp("5 6 7 8"))], [0, 1, 2, 3], "Ziffern");
  assert.deepEqual([...countRun(sp("and a one, and a two, and a three"))], [2, 5, 8], "Wörter zwischen den Zahlen");
  assert.deepEqual([...countRun(sp("we count 1, two, 3 and go"))], [2, 3, 4], "Ziffern und Wörter gemischt");
  for (const tx of ["you are the one I love", "one two", "one, three, five", "two two two", "one zwei tres", "one more time for two of us three"]) assert.equal(countRun(sp(tx)), null, tx);
  // Aufzählung: Teile zwischen Kommas
  const sg = segments(sp("Clock is ticking, time is money, money never sleeping"));
  assert.deepEqual([...sg], [0, 0, 0, 1, 1, 1, 2, 2, 2]);
  assert.equal(sg.n, 3);
  assert.equal(segments(sp("no commas in this line,")).n, 1, "Komma am Zeilenende trennt nichts");
  // Wort-Wiederholung: Inhaltswörter nah beieinander, Funktionswörter nur direkt, Füllsilben nie
  assert.deepEqual(wordRepeats(sp("Boom boom boom here we come")), [0, 1, 2, 0, 0, 0]);
  assert.deepEqual(wordRepeats(sp("Dancing higher and higher")), [0, 0, 0, 1]);
  assert.deepEqual(wordRepeats(sp("Shake it, shake it, shake it now")), [0, 0, 1, 0, 2, 0, 0], "„it“ steht nie direkt hintereinander");
  assert.deepEqual(wordRepeats(sp("We go up, up, never coming down")), [0, 0, 0, 1, 0, 0, 0]);
  assert.deepEqual(wordRepeats(sp("oh oh oh my love")), [0, 0, 0, 0, 0]);
  assert.deepEqual(wordRepeats(sp("I see the sky and I see the sea")), [0, 0, 0, 0, 0, 0, 0, 0, 0], "weit auseinander: keine Steigerung");

  // ein Song mit allem: drei Refrains (getrennt), Zähl-Zeile, Aufzählung, Frage, Hintergrundgesang, Wiederholungen
  const lines = [], words = [], parts = [];
  let t = 2000;
  const sec = (kind, ls) => {
    parts.push({ t0: t / 1000 - 0.2, kind });
    for (const text of ls) {
      lines.push({ t, text });
      words.push(WS(text, t, 260));
      t += 3200;
    }
    t += 1500;
  };
  const CH = ["Fire in my heart tonight", "We are the fire, burning bright", "Boom boom boom we go", "Higher and higher up"];
  sec("verse", ["One, two, three, four", "Clock is ticking, time is money, money never sleeping", "Do you remember where we met?", "Walking through the city (city lights)"]);
  sec("chorus", CH);
  sec("verse", ["Every window full of stories", "Tell me, tell me, tell me now", "Is this the way it ends?", "(oh yeah)"]);
  sec("chorus", CH);
  sec("bridge", ["Slowly fading into blue", "Everything I knew was you"]);
  sec("chorus", [...CH, "Let it burn", "Let it burn", "Let it burn"]);
  sec("outro", ["Fade away", "Fade away", "Fade away"]);
  const at = (text, nth = 0) => lines.map((l, i) => (l.text === text ? i : -1)).filter((i) => i >= 0)[nth];
  const ampOf = (p) => Number(p.v.split(":")[2]);
  for (const level of ["playful", "wild"]) for (const seed of ["n1", "n2", "n3", "n4"]) {
    const plan = planPlayful(lines, words, null, { lexicon: LEX, neg: NEG, parts, level, seed });
    // Zählen: eigenes Rezept, die Zahlen rasten ein und steigen bis zur letzten an
    const c = plan[0];
    assert.equal(c.t, "count", "Zähl-Zeile: " + c.t);
    assert.ok(c.words.every((w) => w.cls.includes("is-p-num") && w.vars["--pac"] === "m-a-tick"), "Zahlen ohne Einrasten");
    assert.deepEqual(c.words.map((w) => Number(w.vars["--pz"] || 1)), [1, 1.08, 1.16, 1.24], "Zahlen steigen nicht an");
    assert.ok(c.words.every((w) => /rotateX\(-88deg\)/.test(w.vars["--wt"] || "")), "Zahlen klappen nicht herunter");
    // Frage: das letzte Wort hebt sich
    for (const q of ["Do you remember where we met?", "Is this the way it ends?"]) {
      const p = plan[at(q)];
      assert.equal(p.words[p.words.length - 1].vars["--pac"], "m-a-ask", `${q}: ${p.words[p.words.length - 1].vars["--pac"]}`);
      assert.ok(p.words.slice(0, -1).every((w) => w.vars["--pac"] !== "m-a-ask"));
    }
    // Wort-Wiederholung in der Zeile: jede Wiederholung eine Stufe größer
    const boom = plan[at("Boom boom boom we go")].words.map((w) => Number(w.vars["--pz"] || 1));
    assert.ok(boom[1] > boom[0] && boom[2] > boom[1] && boom[2] <= 1.3, "boom boom boom: " + boom);
    const hi = plan[at("Higher and higher up")].words.map((w) => Number(w.vars["--pz"] || 1));
    assert.ok(hi[2] > hi[0] && hi[2] >= 1.09, "higher and higher: " + hi);
    // Hintergrundgesang: ganze Zeile und Wörter in Klammern kommen leise von der Seite, ohne Akzent des Rezepts
    const ad = plan[at("(oh yeah)")];
    assert.ok(ad.cls.includes("is-p-adlib") && ad.t === "" && ad.words.every((w) => w.vars["--wo"] === "0.25" && w.vars["--ws"] === "0.9"), "Hintergrundgesang: " + JSON.stringify(ad.words.map((w) => w.vars)));
    // Refrains steigern sich: der letzte ist als einziger größer gesetzt, der Ausschlag wächst von Block zu Block
    const c1 = at(CH[1], 0), c2 = at(CH[1], 1), c3 = at(CH[1], 2);
    assert.ok(!plan[c1].cls.includes("is-p-last") && !plan[c2].cls.includes("is-p-last") && plan[c3].cls.includes("is-p-last"), "letzter Refrain");
    assert.ok(ampOf(plan[c1]) <= ampOf(plan[c2]) && ampOf(plan[c2]) <= ampOf(plan[c3]) && ampOf(plan[c1]) < ampOf(plan[c3]), `Ausschlag: ${ampOf(plan[c1])}/${ampOf(plan[c2])}/${ampOf(plan[c3])}`);
    assert.ok(plan.every((p, i) => !p.cls.includes("is-p-last") || (p.cls.includes("is-p-chorus") && !p.cls.includes("is-p-big") && i >= at(CH[0], 2))), "is-p-last außerhalb des letzten Refrains");
    // dieselbe Zeile direkt hintereinander: im Refrain wächst sie, im Outro klingt sie aus – und spielt nie zweimal gleich
    const burn = [0, 1, 2].map((k) => plan[at("Let it burn", k)]), fade = [0, 1, 2].map((k) => plan[at("Fade away", k)]);
    assert.deepEqual(burn.map((p) => p.vars["--prz"]), [undefined, "1.05", "1.1"], "wächst nicht");
    assert.ok(burn.slice(1).every((p) => p.cls.includes("is-p-rep") && !p.cls.includes("is-p-fade")));
    assert.deepEqual(fade.map((p) => p.vars["--prz"]), [undefined, "0.95", "0.9"], "klingt nicht aus");
    assert.ok(fade.slice(1).every((p) => p.cls.includes("is-p-rep") && p.cls.includes("is-p-fade")));
    for (const run of [burn, fade]) assert.ok(run[0].t !== run[1].t && run[1].t !== run[2].t, "Wiederholung spielt zweimal gleich: " + run.map((p) => p.t));
    // Rezepte nur für besondere Zeilen bleiben dort: Zählen nur in der Zähl-Zeile, „aside“ nie als Zeilen-Rezept,
    // die Aufzählung nur in Zeilen mit Komma
    plan.forEach((p, i) => {
      assert.ok(p.t !== "aside" && (p.t !== "count" || i === 0), `Zeile ${i}: ${p.t}`);
      if (p.t === "volley") assert.ok(/,/.test(lines[i].text.replace(/,\s*$/, "")), "Aufzählung ohne Komma: " + lines[i].text);
    });
  }
  // Aufzählung mit drei Teilen: über viele Songs meist im Wechsel der Seiten – die Teile, nicht die Wörter, wechseln
  let vol = 0;
  for (let s = 0; s < 20; s++) {
    const plan = planPlayful(lines, words, null, { lexicon: LEX, neg: NEG, parts, seed: "vol" + s });
    const p = plan[at("Tell me, tell me, tell me now")];
    if (p.t !== "volley") continue;
    vol++;
    const x = p.words.map((w) => Math.sign(parseFloat(w.vars["--wx"])));
    assert.ok(x[0] === x[1] && x[2] === x[3] && x[4] === x[5] && x[0] === -x[2] && x[2] === -x[4], "Teile wechseln nicht die Seite: " + x);
  }
  assert.ok(vol >= 10, "Aufzählung selten im Wechsel der Seiten: " + vol + " von 20");
  // Wörter in Klammern mitten in der Zeile: leise von der Seite, nie mit dem Akzent der Hauptzeile
  {
    const ws = WS("Walking through the city (city lights)", 0, 260);
    ws[4].bg = ws[5].bg = true;
    for (const seed of ["b1", "b2", "b3", "b4", "b5", "b6"]) {
      const p = planPlayful([{ t: 0, text: "Walking through the city (city lights)" }, { t: 4000, text: "And the night goes on" }], [ws, WS("And the night goes on", 4000)], null, { match: () => [], level: "wild", seed })[0];
      for (const k of [4, 5]) {
        assert.ok(p.words[k].vars["--wo"] === "0.25" && p.words[k].vars["--ws"] === "0.9", "Klammer-Wort mit dem Auftritt der Zeile: " + JSON.stringify(p.words[k].vars));
        const acc = RECIPES[p.t].acc;
        if (acc) assert.notEqual(p.words[k].vars["--pac"], "m-a-" + acc, "Klammer-Wort stößt mit dem Akzent der Zeile");
      }
    }
  }
  // Dezent: Zahlen und Wiederholungen nur über die Größe (kleinere Stufen), kein eigenes Rezept, kein Akzent
  const sub = planPlayful(lines, words, null, { lexicon: LEX, neg: NEG, parts, level: "subtle", seed: "n1" });
  assert.ok(sub[0].t !== "count" && sub[0].words.every((w) => w.cls.includes("is-p-num") && !("--pac" in w.vars)), "Dezent: Zähl-Zeile " + sub[0].t);
  assert.ok(Number(sub[0].words[3].vars["--pz"]) >= 1.2);
  assert.equal(sub[at("Let it burn", 2)].vars["--prz"], "1.06", "Dezent: Wiederholung wächst weniger");
  assert.ok(sub.every((p) => p.words.every((w) => !("--phn" in w.vars) && w.vars["--pac"] !== "m-a-ask")));
  // ohne Bewegung: der ruhende Satz bleibt (Zahlen, Stufen, letzter Refrain, Wachsen/Ausklingen) – ohne Akzent
  const still = planPlayful(lines, words, null, { lexicon: LEX, neg: NEG, parts, still: true, seed: "n1" });
  assert.ok(still[0].words.every((w) => w.cls.includes("is-p-num") && !("--pac" in w.vars) && !("--wt" in w.vars)));
  assert.ok(still[at(CH[1], 2)].cls.includes("is-p-last") && still[at("Let it burn", 2)].vars["--prz"] === "1.1" && still[at("Fade away", 2)].cls.includes("is-p-fade"));
  assert.ok(Number(still[at("Boom boom boom we go")].words[2].vars["--pz"]) > 1.1);

  // lang gehaltener Ton (ab VIB_MIN): schwingt nach; kurz gehalten: dehnt sich nur
  {
    const mk = (hold) => {
      const ws = W([["set", 0, 250], ["my", 300, 250], ["heart", 600, 300], ["on", 950, 250], ["fire", 1250, hold]]);
      return planPlayful([{ t: 0, text: "set my heart on fire" }, { t: 6000, text: "and we go again now" }], [ws, WS("and we go again now", 6000)], null, { match: () => [], seed: "h" })[0].words[4];
    };
    const long = mk(2200), short = mk(900);
    assert.ok(long.cls.includes("is-p-held") && long.vars["--phn"] === "m-p-vib" && parseFloat(long.vars["--hd"]) >= VIB_MIN, JSON.stringify(long.vars));
    assert.ok(short.cls.includes("is-p-held") && !("--phn" in short.vars), "kurz gehalten schwingt");
    assert.ok(css.includes("@keyframes m-p-vib {") && /--ph: var\(--phn, m-p-hold\) var\(--hd, 1s\)/.test(css), "Vibrato fehlt im Stylesheet");
  }

  // Ballade bleibt im Ton: nichts, was hüpft, prallt, schnappt oder zuckt – außer dem einen Einschlag zum Refrain
  const bal = build("ballad");
  for (const level of ["playful", "wild"]) for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    const plan = planPlayful(bal.lines, bal.words, null, { lexicon: LEX, neg: NEG, parts: bal.parts, level, seed: "bal" + seed });
    plan.forEach((p, i) => p.t && assert.ok(balladOk(p.t) || RECIPES[p.t].e >= 3, `Ballade ${level}/${seed}: „${bal.lines[i].text}“ spielt ${p.t}`));
  }
  for (const t of ["ricochet", "squash", "stretch", "hop", "magnet", "domino", "bounce", "jitter", "type", "conveyor", "bars", "volley", "count"]) assert.ok(!balladOk(t), "passt nicht in eine Ballade: " + t);
  for (const t of ["glow", "fade", "rise", "unfold", "key", "flipx", "heart", "track", "fan", "tidal"]) assert.ok(balladOk(t), "fehlt der Ballade: " + t);
  // ein Drop und ein Ruf sind nie Ballade (auch mit wenigen Silben je Sekunde): „JUMP!“ darf knallen
  {
    const club = build("club");
    let hard = 0, all = 0;
    for (const seed of ["c1", "c2", "c3", "c4"]) {
      const plan = planPlayful(club.lines, club.words, null, { lexicon: LEX, neg: NEG, parts: club.parts, seed });
      plan.forEach((p, i) => {
        if (club.lines[i].text !== "JUMP!") return;
        all++;
        if (RECIPES[p.t].e >= 2) hard++;
      });
    }
    assert.ok(hard >= 0.7 * all, `Drop-Rufe zahm: ${hard} von ${all} kräftig`);
  }

  // eine Anzeige-Schrift je Teil (gleicher Satz der Zeilen, höchstens acht am Stück): nie zwei verschiedene
  // Zeilen-Schriften im Wechsel
  for (const level of ["playful", "wild"]) for (const name of Object.keys(SONGS)) for (const seed of ["1", "2", "3", "4", "5", "6"]) {
    const s = build(name);
    const plan = planPlayful(s.lines, s.words, null, { lexicon: LEX, neg: NEG, parts: s.parts, level, seed: name + seed });
    let kind = null, own = "", run = 0;
    plan.forEach((p) => {
      if (!p.t) return;
      const set = p.cls.find((c) => ["is-p-verse", "is-p-chorus", "is-p-bridge", "is-p-calm"].includes(c));
      if (set !== kind || run >= 8) (kind = set), (own = ""), (run = 0);
      run++;
      const f = p.font?.line || "";
      if (!f) return;
      assert.ok(!own || own === f, `${name}/${seed}: ${own} und ${f} im selben Teil (${kind})`);
      own = f;
    });
  }

  // neue Rezepte: es gibt sie, sie stehen in ihrer Stufe, die besonderen in keinem Deck
  for (const t of ["fan", "bars", "volley", "count", "aside", "track", "zip"]) assert.ok(TREATMENTS.includes(t), "Rezept fehlt: " + t);
  assert.ok(allowed("fan", "subtle") && !allowed("bars", "subtle") && !allowed("count", "subtle") && !allowed("zip", "subtle") && !allowed("volley", "subtle"));
  assert.ok(RECIPES.track.L && RECIPES.zip.L && RECIPES.count.only && RECIPES.aside.only && RECIPES.volley.segs === 2);
  for (let s = 0; s < 60; s++) for (const level of ["subtle", "playful", "wild"]) {
    const d = songDeck("deck" + s, level);
    for (const k of ["verse", "pre", "chorus", "hit", "drop", "bridge", "calm", "rap", "ballad", "shout"]) for (const t of d[k]) assert.ok(!RECIPES[t].only, `Deck ${k}: ${t}`);
    assert.ok(!d.chorus.includes("volley"), "Aufzählung als Refrain-Motiv");
  }
  // Fächer: außen stärker gekippt, die Mitte steht; Pegel: jedes Wort wächst von der Grundlinie; Sperren und
  // Reißverschluss: Buchstaben aus der Wortmitte bzw. abwechselnd von oben und unten
  const fanP = [0, 2, 4].map((k) => wordPose("fan", { k, n: 5, dir: 1, amp: 1, len: 3, seed: "s" }));
  assert.ok(fanP[0].r < 0 && !fanP[1].r && fanP[2].r > 0 && fanP[0].og === "center bottom", JSON.stringify(fanP));
  const barP = wordPose("bars", { k: 1, n: 5, dir: 1, amp: 1, len: 5, seed: "s" });
  assert.ok(Array.isArray(barP.s) && barP.s[0] === 1 && barP.s[1] < 0.45 && barP.og === "center bottom");
  const trk = letterPoses("track", "fire", { k: 0, n: 1, dir: 1, amp: 1, seed: "s", lead: 180 }).map((c) => parseFloat(c.vars["--wx"]));
  assert.ok(trk[0] > 0 && trk[3] < 0 && Math.abs(trk[0] + trk[3]) < 1e-9, "Sperren: " + trk);
  const zp = letterPoses("zip", "fire", { k: 0, n: 1, dir: 1, amp: 1, seed: "s", lead: 180 }).map((c) => Math.sign(parseFloat(c.vars["--wy"])));
  assert.deepEqual(zp, [-1, 1, -1, 1], "Reißverschluss");
  // stark verzerrt wartend (gestaucht, gespiegelt): höchstens 30 % deckend – kein Zerrbild in der aktiven Zeile
  for (const t of TREATMENTS) for (let k = 0; k < 6; k++) {
    const p = wordPose(t, { k, n: 6, dir: 1, amp: 1, len: 5, key: false, seed: "s" });
    const sq = Array.isArray(p.s) ? Math.min(...p.s) / Math.max(...p.s) : 1;
    if (sq < 0.67 || Math.abs(p.ry || 0) > 95 || Math.abs(p.rx || 0) > 95) assert.ok((p.o ?? 1) <= 0.3, `${t}: verzerrt und ${p.o} deckend`);
  }
  // Stylesheet: die Stufe der Wiederholung steht in der Schriftgröße der Zeile (Liedtext und Party), der letzte Refrain
  // und die Zahlen haben ihre Regeln
  assert.ok((css.match(/var\(--pfs, 1\) \* var\(--prz, 1\)/g) || []).length === 2, "--prz fehlt in der Schriftgröße");
  assert.ok(/\.m-im-line\.is-p-last:not\(\.is-p-big\) \{\s*--m-ps: 1\.17;/.test(css) && /\.m-w\.is-p-num \{/.test(css) && /\.m-im-line\.is-p-rep\.is-p-fade \{/.test(css));
  console.log("  Ausbau: Zählen, Aufzählung, Wort-Wiederholung, Frage, Vibrato, Hintergrundgesang, Refrain-Steigerung, Wachsen/Ausklingen, Ballade, Schrift je Teil");
}

/* ---- Zeilen überdecken sich nie (der Platz steht im Layout): gekippte Zeilen und Zeilenstücke schwenken höchstens
   0,2 em – der Winkel richtet sich nach ihrer Länge –, und das Stylesheet hält dafür Abstand. Gemessen wird im echten
   Bild (e2e „playful-ink“: Tinte benachbarter Zeilen und Reihen bei drei Fenstergrößen); hier die Rechnung dahinter */
{
  const { tiltCap } = load("lyricstyle.js");
  const { inkSong } = require("./fixtures/ink-lines.js");
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "Mirage", "user.css"), "utf8");
  const deg = (v) => parseFloat(v);
  const sweep = (chars, d, per = 0.26) => per * chars * Math.sin((Math.abs(d) * Math.PI) / 180);
  assert.ok(tiltCap(9) > 3.5 && tiltCap(58) < 1 && tiltCap(58) > 0.5, "Grenze: kurz kippt frei, lang kaum");
  for (const n of [3, 10, 25, 60, 120]) assert.ok(sweep(n, tiltCap(n)) <= 0.2 + 1e-9 && sweep(n, tiltCap(n, 0.22, 0.52), 0.52) <= 0.22 + 1e-9);
  const s = inkSong();
  let adl = 0, tilts = 0, exits = 0, inner = 0;
  for (const level of ["subtle", "playful", "wild"]) for (let k = 0; k < 40; k++) {
    // Klammern wie immersive.js sie markiert (Wörter in Klammern am Zeilenende)
    const words = s.words.map((ws, i) => {
      const open = ws.findIndex((w) => w.text.startsWith("("));
      return ws.map((w, j) => ({ ...w, bg: open > 0 && j >= open && !s.lines[i].text.startsWith("(") }));
    });
    const plan = planPlayful(s.lines, words, null, { lexicon: LEX, neg: NEG, parts: s.parts, level, seed: "ink" + k });
    plan.forEach((p, i) => {
      const n = [...s.lines[i].text].length;
      if (p.cls.includes("is-p-adlib")) {
        adl++;
        assert.ok(sweep(n, deg(p.vars["--pr"])) <= 0.2 + 0.01 && Math.abs(deg(p.vars["--pr"])) <= 3.5, `Hintergrundgesang „${s.lines[i].text}“ kippt ${p.vars["--pr"]}`);
      } else if (words[i].some((w) => w.bg)) {
        inner++;
        const bg = words[i].reduce((a, w) => a + (w.bg ? [...w.text].length + 1 : 0), 0);
        assert.ok(sweep(bg, deg(p.vars["--pr"])) <= 0.2 + 0.01, `Klammer am Zeilenende kippt ${p.vars["--pr"]}`);
      }
      if (p.t === "tilt") {
        tilts++;
        assert.ok(deg(p.vars["--ptl"]) < 0 && deg(p.vars["--ptl"]) >= -1.6 && sweep(n, deg(p.vars["--ptl"]), 0.52) <= 0.22 + 0.01, `schräge Zeile „${s.lines[i].text}“: ${p.vars["--ptl"]}`);
      }
      if (p.vars["--pxo"] === "m-x-tilt") {
        exits++;
        assert.ok(deg(p.vars["--pxa"]) > 0 && deg(p.vars["--pxa"]) <= 5 && sweep(n, deg(p.vars["--pxa"])) <= 0.22 + 0.01, `Abgang mit Kippen „${s.lines[i].text}“: ${p.vars["--pxa"]}`);
      }
    });
  }
  assert.ok(adl > 100 && inner > 50 && tilts > 5 && exits > 20, `zu wenig geprüft: ${adl} Hintergrund-Zeilen, ${inner} Klammern, ${tilts} schräge Zeilen, ${exits} Abgänge`);
  // der lange Hintergrundgesang kippt kaum noch (vorher feste 2,5°/3,5°: sein Ende lag auf der Nachbarzeile)
  const long = planPlayful(s.lines, s.words, null, { match: () => [], parts: s.parts, seed: "x" })[3];
  assert.ok(long.cls.includes("is-p-adlib") && Math.abs(deg(long.vars["--pr"])) < 1, "langer Hintergrundgesang: " + long.vars["--pr"]);
  // Stylesheet: der Platz steht im Layout
  const rule = (sel) => {
    const a = css.indexOf(sel + " {");
    assert.ok(a >= 0, "Regel fehlt: " + sel);
    return css.slice(a, css.indexOf("}", a));
  };
  const P = "#mirage-immersive .m-im-lyrics.is-playful";
  const ad = rule(P + " .m-im-line.is-p-adlib");
  assert.ok(/max-width: calc\(100% - var\(--px, 2em\)\)/.test(ad) && /transform-origin: center/.test(ad) && /padding-top: 0\.22em/.test(ad) && /margin-bottom: calc\(0\.5em \* var\(--m-lyr-gap, 1\) \+ 0\.22em\)/.test(ad), "Hintergrundgesang ohne Platz im Layout");
  assert.ok(/margin-top: 0;/.test(rule(P + " .m-im-line.is-bgline")), "Hintergrund-Zeile unter die Zeile davor gezogen");
  const bgl = rule(P + " .m-im-line .m-im-bgl");
  assert.ok(/max-width: calc\(100% - 1\.2em\)/.test(bgl) && /transform-origin: center/.test(bgl) && /margin-top: 0\.3em/.test(bgl), "kleine Zeile in Klammern ohne Abstand");
  assert.ok(/rotate: var\(--ptl, -0\.6deg\)/.test(rule(P + " .m-im-line.is-t-tilt")), "schräge Zeile mit festem Winkel");
  assert.ok(/rotate: calc\(var\(--pxd, 1\) \* var\(--pxa, 1\.5deg\)\)/.test(css), "Abgang kippt mit festem Winkel");
  assert.ok(/text-wrap: balance/.test(rule(P + " .m-im-line")), "umbrochene Zeilen nicht ausgeglichen");
  // Zeilenhöhe: keine Regel des Stils drückt sie unter die des normalen Liedtexts (1,2); hohe Schriften bekommen mehr
  assert.ok(/font: 800 clamp\(24px, 3vw, 48px\)\/1\.2 var\(--m-font\)/.test(css), "Zeilenhöhe des normalen Liedtexts");
  const a = css.indexOf("/* === i-playful === */"), b = css.indexOf("/* === end i-playful === */");
  for (const m of css.slice(a, b).matchAll(/line-height: ([\d.]+)/g)) assert.ok(Number(m[1]) >= 1.06, "Zeilenhöhe im verspielten Stil zu eng: " + m[1]);
  console.log(`  Überdeckung: ${adl} Hintergrund-Zeilen, ${inner} Klammern, ${tilts} schräge Zeilen, ${exits} Abgänge schwenken höchstens 0,22 em`);
}

console.log("lyricstyle: ok");
