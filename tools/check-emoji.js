// Wächter: keine Emojis in der Oberfläche. Mirage zeichnet Symbole als SVG (src/icons.js, auf der Handy-Seite als
// Sprite) – Emojis sehen auf jedem System anders aus und passen nicht zum Glas.
// Geprüft wird jedes Zeichen mit Unicode-Eigenschaft Extended_Pictographic in
//   src/**/*.js (ohne Kommentare; das Wortbild-Lexikon ist JSON und zählt nicht), docs/live/index.html,
//   overlay/*.html und overlay/i18n.js (ohne HTML-, CSS- und JS-Kommentare).
// Erlaubt sind typografische Pfeile (↔ ↕ …) und © ® ™: sie erscheinen als Schrift, nicht als Bild.
// Escapes im Quelltext ("❤") bleiben, was sie sind: Daten fürs Protokoll, kein Zeichen auf dem Bildschirm.
// Zusätzlich: das Symbol-Sprite der Handy-Seite muss zu src/icons.js passen (tools/build-icons.js).
//   npm run check:emoji
const fs = require("fs");
const path = require("path");
const espree = require("espree");

const ROOT = path.join(__dirname, "..");
const PICTO = /\p{Extended_Pictographic}/u;
const ALLOW = new Set([..."↔↕↖↗↘↙©®™"]);
const bad = [];

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
function scanText(file, text, offset, full) {
  for (const m of text.matchAll(/\p{Extended_Pictographic}/gu)) {
    if (ALLOW.has(m[0])) continue;
    const at = offset + m.index;
    const line = lineOf(full, at), src = full.split("\n")[line - 1].trim();
    bad.push(`${path.relative(ROOT, file)}:${line}: ${m[0]} (U+${m[0].codePointAt(0).toString(16).toUpperCase()})  ${src.slice(0, 120)}`);
  }
}
// JS: nur Code und Zeichenketten, keine Kommentare (Tokens ohne Kommentare; Strings bleiben roh mit ihren Escapes)
function scanJs(file, code, offset = 0, full = code) {
  if (!PICTO.test(code)) return;
  let tokens;
  for (const sourceType of ["module", "script"]) {
    try {
      tokens = espree.tokenize(code, { ecmaVersion: "latest", sourceType, range: true });
      break;
    } catch (e) {
      if (sourceType === "script") throw new Error(`${path.relative(ROOT, file)}: nicht lesbar (${e.message})`);
    }
  }
  for (const t of tokens) if (PICTO.test(t.value)) scanText(file, t.value, offset + t.range[0], full);
}
// HTML: Kommentare raus, eingebettete Skripte als JS, der Rest (Markup, CSS ohne Kommentare) als Text
function scanHtml(file) {
  const html = fs.readFileSync(file, "utf8");
  const blank = (s) => s.replace(/[^\n]/g, " ");
  let rest = html.replace(/<!--[\s\S]*?-->/g, blank);
  rest = rest.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g, (all, open, body, close, at) => {
    scanJs(file, body, at + open.length, html);
    return open + blank(body) + close;
  });
  rest = rest.replace(/\/\*[\s\S]*?\*\//g, blank);
  scanText(file, rest, 0, html);
}
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith(".js")) out.push(p);
  }
  return out;
}

function main() {
  for (const f of walk(path.join(ROOT, "src"))) scanJs(f, fs.readFileSync(f, "utf8"));
  scanHtml(path.join(ROOT, "docs", "live", "index.html"));
  for (const f of fs.readdirSync(path.join(ROOT, "overlay"))) if (f.endsWith(".html")) scanHtml(path.join(ROOT, "overlay", f));
  scanJs(path.join(ROOT, "overlay", "i18n.js"), fs.readFileSync(path.join(ROOT, "overlay", "i18n.js"), "utf8"));

  if (bad.length) {
    console.error(`Emojis in der Oberfläche (${bad.length}) – bitte ein SVG-Symbol aus src/icons.js nehmen:\n  ` + bad.join("\n  "));
    process.exitCode = 1;
  } else console.log("Keine Emojis in src/, docs/live/index.html, overlay/*.html, overlay/i18n.js");

  // das Sprite der Handy-Seite muss zu icons.js passen
  const { sprite, toLf } = require("./build-icons.js");
  const page = toLf(fs.readFileSync(path.join(ROOT, "docs", "live", "index.html"), "utf8"));
  if (!page.includes(sprite())) {
    console.error("docs/live/index.html: das Symbol-Sprite passt nicht zu src/icons.js – npm run icons");
    process.exitCode = 1;
  } else console.log("Sprite der Handy-Seite passt zu src/icons.js");
}
if (require.main === module) main();
// für tests/unit/emoji.test.js
module.exports = { scanJs, scanHtml, found: bad };
