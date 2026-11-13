// node tests/unit/songtime.test.js
const assert = require("assert");
const { load } = require("./load.js");
const { freshPos, lineAt } = load("songtime.js");

// Songwechsel: Spotify meldet noch die alte Position → Anfang des neuen Songs
assert.equal(freshPos(183400, 183300, 200), 0);
assert.equal(freshPos(183400, 183300, 2000), 183400, "nach 1,5 s gilt die Meldung");
assert.equal(freshPos(400, 183300, 200), 400, "neue Position kam schon");
assert.equal(freshPos(1200, 1000, 100), 1200, "alter Song war gerade erst gestartet");

const L = [{ t: 1000 }, { t: 4000 }, { t: 7000 }];
assert.equal(lineAt(L, 500, -2), -1);
assert.equal(lineAt(L, 4100, -2), 1);
// Pause/Nachjustieren: 40 ms zurück lässt die Zeile stehen
assert.equal(lineAt(L, 3960, 1), 1);
// Spulen: weit zurück geht sofort
assert.equal(lineAt(L, 2000, 1), 0);
assert.equal(lineAt(L, 500, 1), -1);
// vorwärts immer sofort
assert.equal(lineAt(L, 7001, 1), 2);
console.log("songtime: ok");
