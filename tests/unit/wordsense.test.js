// node tests/unit/wordsense.test.js
// Wortsinn: Verneinung je Sprache, Redewendungen, Wiederholung, Stimmung des Songs, mehrere Treffer je Zeile,
// Sicherheit mit Schwelle – und ein Korpus aus über 300 erfundenen Liedzeilen (de, en, es, fr, it, pt, tr, pl, nl),
// je Zeile „soll reagieren (Begriff)“ oder „soll nicht reagieren“. Fällt die Trefferquote unter den erreichten
// Stand, schlägt der Test fehl.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./load.js");
const { matchAny, FX } = load("words.js");
const { LEX, NEG } = load("lexicon.js");
const { planSong, senseLine, pickLine, EXPLICIT } = load("wordsense.js");
const { isCountdown, createScenarios, responses, STAGE } = load("scenarios.js");

const pri = (c) => FX[c]?.pri;
const langsOf = (lang) => (lang === "en" ? ["en"] : [lang, "en"]);
function judge(lang, text) {
  if (isCountdown(text)) return { c: "count" };
  return pickLine(senseLine(text, matchAny(text, langsOf(lang), LEX), { neg: NEG, main: lang }), pri);
}

/* ---- Korpus */
const rows = fs.readFileSync(path.join(__dirname, "fixtures", "wordsense-corpus.txt"), "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith("#")).map((l) => {
    const [lang, want, ...rest] = l.split("|");
    return { lang, want, text: rest.join("|") };
  });
assert.ok(rows.length >= 300, "Korpus zu klein: " + rows.length);
// Lob-Wörter („f-words“, eigener Abschnitt am Ende des Korpus): eigene Trefferquote
let ok = 0, fp = 0, fn = 0, wrong = 0, fwN = 0, fwOk = 0;
const miss = [];
const FW = new Set(fs.readFileSync(path.join(__dirname, "fixtures", "wordsense-corpus.txt"), "utf8").split(/# --- Lob-Wörter/)[1]?.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")) || []);
for (const r of rows) {
  const got = judge(r.lang, r.text);
  // „!x“: alles außer x (auch keine Antwort) – für Lob-Wörter, die nicht derb gedeutet werden dürfen
  const not = r.want.startsWith("!") ? r.want.slice(1) : null;
  const want = r.want === "-" || not ? null : r.want.split("/");
  // mehrere Begriffe in der Zeile: der erwartete darf Teil der kombinierten Antwort sein
  const good = not ? !got || (got.c !== not && !got.also?.includes(not)) : want ? !!got && (want.includes(got.c) || want.some((w) => got.also?.includes(w))) : !got;
  if (FW.has(`${r.lang}|${r.want}|${r.text}`)) {
    fwN++;
    if (good) fwOk++;
  }
  if (good) ok++;
  else {
    if (!want) fp++;
    else if (!got) fn++;
    else wrong++;
    miss.push(`${r.lang} „${r.text}“: erwartet ${r.want}, bekommen ${got ? got.c : "–"}`);
  }
}
const acc = ok / rows.length;
if (process.env.VERBOSE) console.log(miss.join("\n"));
// erreichter Stand (bei Änderungen am Wörterbuch oder an wordsense.js nur nach oben anpassen)
const MIN_ACC = 0.985, MAX_FP = 6;
assert.ok(acc >= MIN_ACC, `Trefferquote ${(acc * 100).toFixed(1)} % < ${MIN_ACC * 100} %\n${miss.join("\n")}`);
assert.ok(fp <= MAX_FP, `${fp} Fehlalarme (Zeilen ohne Grund zur Reaktion) > ${MAX_FP}\n${miss.join("\n")}`);
// Lob- und Gewalt-Wörter (Abschnitte am Ende des Korpus): mindestens 80 Zeilen, fast alle richtig gedeutet
assert.ok(fwN >= 80, "zu wenige Zeilen mit Lob-Wörtern: " + fwN);
assert.ok(fwOk / fwN >= 0.95, `Lob-Wörter: ${fwOk}/${fwN} richtig\n${miss.join("\n")}`);

/* ---- Verneinung, Wortsinn (einzeln, damit klar ist, was kaputt ist) */
const c = (lang, text) => judge(lang, text)?.c ?? null;
assert.strictEqual(c("en", "No fire in the sky"), null, "en: Verneinung davor");
assert.strictEqual(c("en", "I don't love you anymore"), "heartbreak", "en: verneinte Liebe wird Herzschmerz");
assert.strictEqual(c("de", "Ich liebe dich nicht"), "heartbreak", "de: Verneinung danach (Satzende)");
assert.strictEqual(c("de", "Ich hab kein Geld"), null, "de: kein");
assert.strictEqual(c("tr", "Para yok"), null, "tr: yok danach");
assert.strictEqual(c("fr", "Je n'ai pas d'argent"), null, "fr: ne … pas");
assert.strictEqual(c("es", "Sin dinero"), null, "es: sin");
assert.strictEqual(c("en", "No, no, fire!"), "fire", "eine Verneinung wirkt nicht über ein Komma");
assert.strictEqual(c("en", "Make it rain"), "money", "make it rain = Geld");
assert.strictEqual(c("en", "Pull the fire alarm"), null, "fire alarm ist kein Feuer");
assert.strictEqual(c("de", "Die Feuerwehr kommt"), null, "Feuerwehr ist kein Feuer");
assert.strictEqual(c("en", "Lean on me"), "together", "lean on = Zusammenhalt, keine Droge");
const set = judge("en", "We set the world on fire");
assert.ok(set.c === "fire" && set.conf >= 0.95, "Redewendung erhöht die Sicherheit");

/* ---- mehrere Treffer in einer Zeile: eine kombinierte, stärkere Antwort */
{
  const m = judge("en", "Fuck yeah, money on my mind");
  assert.strictEqual(m.c, "money", "der Fluch verstärkt den anderen Begriff");
  assert.ok(m.also.includes("curse") && m.k > 1, "kombiniert und stärker");
}

/* ---- ganzer Song: Wiederholung, letzter Refrain, Stimmung */
function plan(texts, lang = "en") {
  const lines = texts.map((text) => ({ text }));
  return planSong(lines, lines.map((l) => matchAny(l.text, langsOf(lang), LEX)), { neg: NEG, main: lang, pri });
}
{
  const chorus = "Set the night on fire";
  const song = ["Walking down alone", chorus, "verse line one", "verse line two", chorus, "another verse", "bridge goes here", "and more", "and more again", chorus];
  const p = plan(song);
  const hits = p.map((x, i) => [i, x]).filter(([, x]) => x && x.c === "fire");
  assert.strictEqual(hits.length, 3);
  assert.ok(hits[0][1].k >= 1 && hits[0][1].rep === 0, "beim ersten Mal voll");
  assert.ok(hits[1][1].k < 0.75 && hits[1][1].rep === 1, "Wiederholung kleiner");
  assert.ok(hits[2][1].last && hits[2][1].k >= 1, "letzter Refrain wieder voll");
}
{
  // trauriges Lied: Antworten ruhig (soft)
  const sad = plan(["I'm so sad and alone", "Tears fall like rain", "My broken heart is cold", "I'm lost and empty", "The fire in me is dying", "Goodbye, I cry"]);
  assert.ok(sad.filter(Boolean).every((x) => x.soft), "trauriger Song: alles ruhig");
  const happy = plan(["We dance all night", "Party on fire", "Jump jump", "Happy happy love"]);
  assert.ok(happy.filter(Boolean).some((x) => !x.soft), "fröhlicher Song: volle Antworten");
}
{
  // derbe Wörter: als derb markiert
  const p = judge("en", "You are such a bitch");
  assert.ok(p.ex && EXPLICIT.has(p.c));
}

/* ---- Bühne: ruhige Stelle, derbe Wörter je Einstellung, Wiederholung, Kombination */
const base = { energy: 0.8, kind: "chorus", level: 3, lite: false, calm: false, noFlash: false, flash: true, beat: 0.5, phase: 0.2 };
{
  const fam = (c, ctx) => (responses(c, { ...base, ...ctx }) || []).map((r) => r[0]);
  assert.deepStrictEqual(fam("fire", { soft: true, energy: 0.6 }), ["wash"], "ruhiges Lied: Pyro wird warmes Glühen");
  assert.ok(fam("fire", { soft: true, energy: 0.85 }).includes("pyro"), "bei voller Energie trotzdem voll");
  assert.deepStrictEqual(fam("party", { soft: true, energy: 0.5 }), ["wash"], "Party im ruhigen Lied: nur Farbe");
  assert.deepStrictEqual(fam("sexy", { explicit: "on" }), ["sway", "mood"]);
  assert.deepStrictEqual(fam("sexy", { explicit: "soft" }), ["mood"], "nur Farbe");
  assert.deepStrictEqual(fam("insult", { explicit: "off" }), [], "aus: nichts");
  assert.deepStrictEqual(fam("insult", {}), ["accent", "hands"], "Beleidigung: Akzent und Ooh der Menge");
  assert.deepStrictEqual(fam("drugs", {}), ["psy"]);
  // Gefühle: nur Farbe, auch bei Leicht
  for (const k of ["anger", "lonely", "longing", "freedom"]) assert.strictEqual(STAGE[k][0][0], "mood", k);
  const s = createScenarios();
  assert.strictEqual(s.word("money", { ...base, t: 5, k: 0.6 }).length, 1, "Wiederholung: eine, kleinere Antwort");
  const s2 = createScenarios();
  const comb = s2.word("money", { ...base, t: 5, k: 1.15, also: ["curse"] });
  assert.ok(comb.length >= 2 && comb.some((x) => x.f === "shock" || x.f === "jump"), "Kombination: Fluch bringt Energie dazu");
  assert.ok(comb[0].k > createScenarios().word("money", { ...base, t: 5 })[0].k, "Kombination stärker");
}

/* ---- Schnittstelle für Bühne und Liedtext (concepts.js): Begriff und Kategorie eines Worts im Zusammenhang */
{
  const { CATEGORIES, categoryOf, conceptOf, conceptsOfLine } = load("concepts.js");
  for (const c of Object.keys(FX)) assert.ok(CATEGORIES.includes(categoryOf(c)), `${c} ohne Kategorie`);
  const unlisted = Object.keys(FX).filter((c) => categoryOf(c) === "misc" && !load("concepts.js").GROUPS.misc.split(" ").includes(c));
  assert.deepStrictEqual(unlisted, [], "Begriffe ohne eigene Kategorie: " + unlisted);
  assert.strictEqual(categoryOf("gun"), "violence");
  assert.strictEqual(conceptOf("geil", { lang: "de", line: "Die Party ist so geil" }), "praise");
  assert.strictEqual(conceptOf("geil", { lang: "de", line: "Ich bin so geil auf dich" }), "sexy");
  assert.strictEqual(conceptOf("killing", { line: "We're killing it tonight" }), "praise");
  assert.strictEqual(conceptOf("glock", { line: "Got a glock in my pocket" }), "gun");
  assert.strictEqual(conceptOf("rain"), "rain");
  assert.strictEqual(conceptOf("table"), null);
  const all = conceptsOfLine("Fire in the rain, shots fired", { lang: "en" });
  assert.ok(all.some((x) => x.c === "shoot" && x.cat === "violence" && x.ex), "Gewalt: nie als Text (ex)");
}
// Gewalt auf der Bühne: wie derbe Wörter von partyExplicit abhängig, stilisiert (Mündungsfeuer, Hieb)
{
  const fam = (c, ctx) => (responses(c, { ...base, ...ctx }) || []).map((r) => r[0]);
  assert.deepStrictEqual(fam("gun", { explicit: "off" }), [], "aus: keine Reaktion auf Waffen");
  assert.deepStrictEqual(fam("gun", { explicit: "soft" }), ["mood"], "nur Farbe: dunkles Rot");
  assert.ok(fam("gun", {}).includes("muzzle") && fam("axe", {}).includes("slash"));
  assert.ok(!fam("machinegun", { soft: true, energy: 0.5 }).some((f) => f === "muzzle" || f === "tracer"), "ruhiges Lied: keine Schüsse");
}

/* ---- jede Sprache: Verneinungen vorhanden, jeder neue Begriff in mehreren Sprachen */
const NEWC = ["club", "drink", "rich", "sweat", "anger", "freedom", "desert", "sunset", "hey", "sexy", "insult", "curse", "drugs"];
for (const k of NEWC) {
  const n = Object.values(LEX).filter((l) => l.c[k]).length;
  assert.ok(n >= 20, `${k} nur in ${n} Sprachen`);
}
for (const l of ["de", "en", "es", "fr", "it", "pt", "tr", "pl", "nl"]) for (const k of ["sexy", "insult", "curse", "drugs"]) assert.ok(LEX[l].c[k], `${l}: ${k} fehlt`);
assert.ok(Object.keys(NEG).length >= 40, "Verneinungen für fast alle Sprachen");

console.log(`wordsense: ok (Korpus ${rows.length} Zeilen, ${(acc * 100).toFixed(1)} % richtig, ${fp} Fehlalarme, ${fn} verpasst, ${wrong} falscher Begriff; Lob-/Gewalt-Wörter ${fwOk}/${fwN})`);
