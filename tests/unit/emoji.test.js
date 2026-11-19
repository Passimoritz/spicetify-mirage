// Emoji-Wächter (tools/check-emoji.js): findet Emojis im Code und in Texten, lässt Kommentare, Escapes und
// typografische Pfeile in Ruhe; und die echten Quellen sind frei davon (samt passendem Sprite der Handy-Seite).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { scanJs, scanHtml, found } = require("../../tools/check-emoji.js");
const { sprite, PHONE_UI } = require("../../tools/build-icons.js");

const scan = (code) => {
  found.length = 0;
  scanJs("probe.js", code);
  return found.map((x) => x.split(": ")[1].split(" ")[0]);
};

test("Emojis in Strings und Templates werden gefunden", () => {
  assert.deepStrictEqual(scan('const a = "🥇 " + name;'), ["🥇"]);
  assert.deepStrictEqual(scan("const b = `${x} 🔒`;"), ["🔒"]);
  // auch Zeichen aus dem BMP, die als Emoji erscheinen (⏱ ✋ ⚡ ▶ ♥)
  assert.deepStrictEqual(scan('x("⏱️", "✋", "⚡", "▶", "♥")'), ["⏱", "✋", "⚡", "▶", "♥"]);
});

test("Kommentare, Escapes und typografische Pfeile zählen nicht", () => {
  assert.deepStrictEqual(scan('// früher stand hier 🎤\nconst a = 1; /* 🎶 */'), []);
  assert.deepStrictEqual(scan('send({ e: "\\u2764\\ufe0f" });'), []);
  assert.deepStrictEqual(scan('const s = "PC ↔ Handy ↕ © Mirage";'), []);
});

test("HTML: Markup und Skripte zählen, Kommentare nicht", () => {
  const f = path.join(os.tmpdir(), "mirage-emoji-probe.html");
  fs.writeFileSync(f, '<!-- 🎉 --><style>/* 🎨 */ a{}</style><button>👑</button><script>// 🙈\nconst t = "🔇";</script>');
  found.length = 0;
  scanHtml(f);
  fs.rmSync(f, { force: true });
  assert.deepStrictEqual(found.map((x) => x.split(": ")[1].split(" ")[0]), ["🔇", "👑"]);
});

test("die echten Quellen sind frei von Emojis, das Sprite passt zu icons.js", () => {
  const out = execFileSync(process.execPath, [path.join(__dirname, "..", "..", "tools", "check-emoji.js")], { encoding: "utf8" });
  assert.match(out, /Keine Emojis/);
  assert.match(out, /Sprite der Handy-Seite passt/);
});

test("Sprite: jedes Symbol der Handy-Seite gibt es, Strich-Stil wie im Theme", () => {
  const s = sprite();
  for (const k of PHONE_UI) assert.ok(s.includes(`id="i-${k}"`), k);
  assert.ok(s.includes('id="i-g-karaoke"') && s.includes('id="i-g-dwheel"'));
  // nur Pfade, Kreise, Rechtecke – keine Füllungen oder Farben im Sprite (die kommen aus CSS, currentColor)
  assert.doesNotMatch(s, /fill="(?!none)|stroke="#|style=/);
});
