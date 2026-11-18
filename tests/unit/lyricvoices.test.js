// node tests/unit/lyricvoices.test.js
const assert = require("assert");
const { load } = require("./load.js");
const { parseVoices, bgFlags, bgParts, isLabel, tagNames, voiceColors } = load("lyricvoices.js");
const { parseLrc, parseTtml } = load("lyricparse.js");
const { contrast } = load("hsl.js");

const who = (lyr) => lyr.lines.map((l) => l.who || "");
const lrc = (s) => ({ lines: parseLrc(s) });

// ---- nichts bekannt: alles bleibt, wie es war (keine neuen Felder)
let lyr = lrc("[00:01.00]Just a line\n[00:02.00]Another line\n[00:03.00]Third");
const before = JSON.stringify(lyr.lines);
parseVoices(lyr);
assert.equal(JSON.stringify(lyr.lines), before);

// ---- „Name:“ vor den Zeilen, Zeiten bleiben
lyr = lrc(["[00:01.00]Anna: I walk", "[00:02.00]alone", "[00:03.00]Ben: You run", "[00:04.00]Anna: I stay", "[00:05.00]Ben: You go", "[00:06.00]Anna: Fine", "[00:07.00]Ben: Bye", "[00:08.00]Both: Together"].join("\n"));
parseVoices(lyr);
assert.deepEqual(who(lyr), ["1", "1", "2", "1", "2", "1", "2", "all"]);
assert.deepEqual(lyr.lines.map((l) => l.text), ["I walk", "alone", "You run", "I stay", "You go", "Fine", "Bye", "Together"]);
assert.deepEqual(lyr.lines.map((l) => l.t), [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]);
// zweimal laufen lassen ändert nichts
const once = JSON.stringify(lyr);
parseVoices(lyr);
assert.equal(JSON.stringify(lyr), once);

// ---- „[Name]“ und „(Name)“ als Präfix
lyr = lrc(["[00:01.00][Zoe] one", "[00:02.00][Max] two", "[00:03.00][Zoe] three", "[00:04.00][Max] four", "[00:05.00][Zoe] five", "[00:06.00][Max] six"].join("\n"));
// ein „[Zoe]“ direkt nach der Zeitmarke ist für LRC Teil des Texts
assert.equal(lyr.lines[0].text, "[Zoe] one");
parseVoices(lyr);
assert.deepEqual(who(lyr), ["1", "2", "1", "2", "1", "2"]);
assert.equal(lyr.lines[1].text, "two");
lyr = { lines: ["(Zoe) a", "(Max) b", "(Zoe) c", "(Max) d", "(Zoe) e", "(Max) f"].map((text, i) => ({ t: i * 1000, text })) };
parseVoices(lyr);
assert.deepEqual(who(lyr), ["1", "2", "1", "2", "1", "2"]);

// ---- Genius-Kopfzeilen: „[Verse 1: A]“, „[Chorus: A & B]“, „[Chorus]“ (offen)
lyr = { lines: ["[Verse 1: Kendrick]", "line a", "line b", "[Verse 2: SZA]", "line c", "[Chorus: Kendrick & SZA]", "line d", "[Bridge]", "line e", "[Outro: SZA]", "line f"].map((text, i) => ({ t: 0, text })) };
parseVoices(lyr);
assert.deepEqual(who(lyr), ["1", "1", "1", "2", "2", "all", "all", "", "", "2", "2"]);
// Sänger-Etiketten werden zur Pause (Zeilenzahl bleibt: gespeichertes Timing passt weiter), „[Bridge]“ bleibt
assert.equal(lyr.lines.length, 11);
assert.equal(lyr.lines[0].text, "♪");
assert.equal(lyr.lines[7].text, "[Bridge]");

// ---- nur eine Stimme genannt: kein Duett
lyr = lrc("[00:01.00]Anna: a\n[00:02.00]Anna: b\n[00:03.00]Anna: c\n[00:04.00]Ben: d");
parseVoices(lyr);
assert.deepEqual(who(lyr), ["", "", "", ""]);
assert.equal(lyr.lines[0].text, "Anna: a");

// ---- Ausrufe in Klammern sind Hintergrundgesang, keine Sänger
lyr = { lines: ["(Hey) one", "(Oh) two", "(Hey) three", "(Oh) four", "(Hey) five", "(Oh) six", "(Hey Hey) seven"].map((text, i) => ({ t: i, text })) };
parseVoices(lyr);
assert.deepEqual(who(lyr), ["", "", "", "", "", "", ""]);
assert.equal(lyr.lines[0].text, "(Hey) one");

// ---- Hintergrundgesang als ganze Zeile – „(Chorus)“, „(x2)“ sind Etiketten, kein Gesang
lyr = { lines: ["Main line", "(oh, oh)", "(Chorus)", "(x2)", "(Repeat)", "(Baby I love you)", "[Chorus]"].map((text, i) => ({ t: i * 500, text })) };
parseVoices(lyr);
assert.deepEqual(lyr.lines.map((l) => !!l.bg), [false, true, false, false, false, true, false]);
assert.deepEqual(lyr.lines.map((l) => l.t), [0, 500, 1000, 1500, 2000, 2500, 3000]);
assert.ok(isLabel("Chorus") && isLabel("Pre-Chorus") && isLabel("Verse 2: X") && isLabel("x2") && isLabel("2x"));
assert.ok(!isLabel("Versailles"));
assert.deepEqual(tagNames("Verse 2: Drake & Rihanna"), ["drake", "rihanna"]);
assert.deepEqual(tagNames("Chorus"), []);
assert.deepEqual(tagNames("Both"), ["*"]);
assert.equal(tagNames("oh, oh"), null);

// ---- Klammern mitten in der Zeile
assert.deepEqual(bgParts("I love you (love you) so (x2)"), [{ text: "I love you ", bg: false }, { text: "(love you)", bg: true }, { text: " so ", bg: false }, { text: "(x2)", bg: false }]);
assert.deepEqual(bgFlags(["Oh", "yeah", "(echo", "back)", "(Chorus)"]), [false, false, true, true, false]);
// nie geschlossene Klammer: bis zum Ende
assert.deepEqual(bgFlags(["Go", "(go", "go"]), [false, true, true]);

// ---- Wortzeiten (Enhanced LRC): Klammern werden zu w.bg, Präfix verschwindet auf Wortgrenze
lyr = lrc([
  "[00:01.00]<00:01.00>Anna: <00:01.30>Hi <00:01.60>(hi)",
  "[00:02.00]<00:02.00>Ben: <00:02.30>Yo",
  "[00:03.00]<00:03.00>Anna: <00:03.30>Hey",
  "[00:04.00]<00:04.00>Ben: <00:04.30>Ho",
  "[00:05.00]<00:05.00>Anna: <00:05.30>La",
  "[00:06.00]<00:06.00>Ben: <00:06.30>Li",
].join("\n"));
parseVoices(lyr);
assert.deepEqual(who(lyr), ["1", "2", "1", "2", "1", "2"]);
assert.deepEqual(lyr.lines[0].words.map((w) => [w.t, w.text, !!w.bg]), [[1300, "Hi", false], [1600, "(hi)", true]]);
assert.equal(lyr.lines[0].text, "Hi (hi)");

// ---- TTML: Stimmen, Gruppe „alle“, Hintergrund je Wort und als ganze Zeile
const ttml = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata>
<ttm:agent type="person" xml:id="v1"/><ttm:agent type="person" xml:id="v2"/><ttm:agent type="group" xml:id="v1000"/></metadata></head><body><div>
<p begin="1.000" end="2.000" ttm:agent="v1"><span begin="1.000" end="1.500">Hello</span> <span ttm:role="x-bg"><span begin="1.500" end="1.900">(hello)</span></span></p>
<p begin="3.000" end="4.000" ttm:agent="v2"><span begin="3.000" end="3.500">World</span></p>
<p begin="5.000" end="6.000" ttm:agent="v1000"><span begin="5.000" end="5.500">All</span> <span begin="5.500" end="6.000">of us</span></p>
<p begin="7.000" end="8.000" ttm:agent="v2"><span ttm:role="x-bg"><span begin="7.000" end="7.500">ooh</span></span></p>
</div></body></tt>`;
lyr = { lines: parseTtml(ttml) };
assert.deepEqual(who(lyr), ["1", "2", "all", "2"]);
assert.deepEqual(lyr.lines[0].words.map((w) => [w.text, !!w.bg]), [["Hello", false], ["(hello)", true]]);
assert.equal(lyr.lines[3].bg, true);
assert.equal(lyr.lines[3].text, "(ooh)");
assert.equal(lyr.lines[0].bg, undefined);
// parseVoices lässt die Stimmen aus der Quelle stehen
parseVoices(lyr);
assert.deepEqual(who(lyr), ["1", "2", "all", "2"]);
// nur eine Person plus Gruppe: kein Duett
assert.deepEqual(parseTtml(ttml.replace(/ttm:agent="v2"/g, 'ttm:agent="v1"')).map((l) => l.who || ""), ["", "", "", ""]);

// ---- Farben: drei verschiedene, alle lesbar auf dem Liedtext-Grund
const hue = (c) => {
  const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
};
const gap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
for (const pal of [
  [[180, 40, 200], [90, 20, 120], [230, 200, 255]], // alles lila (ähnliche Farbtöne)
  [[200, 50, 50], [40, 80, 200], [240, 220, 120]], // bunt
  [[128, 128, 128], [60, 60, 60], [220, 220, 220]], // grau
  [[20, 20, 20], [10, 10, 10], [40, 40, 40]], // fast schwarz
]) {
  const v = voiceColors(pal);
  assert.equal(v.length, 3);
  for (const c of v) assert.ok(contrast(c, [46, 42, 58]) >= 4.5, "lesbar: " + c);
  assert.ok(gap(hue(v[0]), hue(v[1])) >= 75 || pal[0][0] === 128 || pal[0][0] === 20, "Stimme 1 und 2 unterscheidbar: " + v);
  assert.notDeepEqual(v[0], v[1]);
}
console.log("lyricvoices: ok");
