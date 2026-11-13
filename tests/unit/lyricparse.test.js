// node tests/unit/lyricparse.test.js
const assert = require("assert");
const { load } = require("./load.js");
const { parseLrc, parseYrc, parseTtml } = load("lyricparse.js");

// ---- LRC
let l = parseLrc("[ti:X]\n[00:01.00]one\n[00:03.50][00:10.00]chorus\n[00:05.25]two");
assert.deepEqual(l.map((x) => [x.t, x.text]), [[1000, "one"], [3500, "chorus"], [5250, "two"], [10000, "chorus"]]);
// [offset:+300] = 300 ms früher
l = parseLrc("[offset:+300]\n[00:01.00]one\n[00:02.00]two");
assert.deepEqual(l.map((x) => x.t), [700, 1700]);
l = parseLrc("[offset:-200]\n[00:01.00]one");
assert.equal(l[0].t, 1200);
// Enhanced LRC
l = parseLrc("[00:01.00]<00:01.00>Look <00:01.40>at <00:01.70>the <00:02.00>stars");
assert.equal(l[0].text, "Look at the stars");
assert.deepEqual(l[0].words.map((w) => w.t), [1000, 1400, 1700, 2000]);

// ---- YRC
l = parseYrc('{"t":0,"c":[{"tx":"作词: x"}]}\n[1000,2000](1000,400,0)how(1400,300,0)to (1700,300,0)go');
assert.equal(l.length, 1);
assert.equal(l[0].text, "how to go");

// ---- TTML: Silben eines Worts ohne Abstand, Wörter mit Abstand, Übersetzung weg, Hintergrund in Klammern, Duett
const ttml = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head></head><body dur="1:00.000"><div>
<p begin="1.000" end="3.000" ttm:agent="v1"><span begin="1.000" end="1.300">Shi</span><span begin="1.300" end="1.600">ning</span> <span begin="1.700" end="2.000">light</span><span ttm:role="x-translation" xml:lang="de">Leuchtendes Licht</span></p>
<p begin="0:04.000" end="0:06.000" ttm:agent="v2"><span begin="0:04.000" end="0:04.500">Oh</span> <span begin="0:04.600" end="0:05.000">yeah</span><span ttm:role="x-bg"><span begin="5.100" end="5.400">echo</span> <span begin="5.400" end="5.800">back</span></span></p>
<p begin="7.000" end="8.000" ttm:agent="v1"><span begin="7.000" end="7.500">Rock &amp; roll</span></p>
</div></body></tt>`;
l = parseTtml(ttml);
assert.equal(l.length, 3);
assert.equal(l[0].text, "Shining light");
assert.deepEqual(l[0].words.map((w) => [w.t, w.text, w.sp]), [[1000, "Shi", false], [1300, "ning", true], [1700, "light", false]]);
assert.equal(l[1].text, "Oh yeah (echo back)");
assert.equal(l[1].t, 4000);
assert.deepEqual([l[0].who, l[1].who, l[2].who], ["1", "2", "1"]);
assert.equal(l[2].text, "Rock & roll");
// eine Stimme: keine Duett-Farben
assert.equal(parseTtml(ttml.replace(/ttm:agent="v2"/, 'ttm:agent="v1"'))[1].who, undefined);
console.log("lyricparse: ok");
