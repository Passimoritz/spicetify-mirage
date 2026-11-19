// Schreibt die Linien-Symbole aus src/icons.js als SVG-Sprite (<symbol> + <use>) in die Handy-Seite
// docs/live/index.html. Die Seite ist eigenständig (GitHub Pages, ohne Bündler): so nutzt sie dieselben Pfade wie das
// Theme, ohne eine zweite Datei nachzuladen – das Sprite steht im HTML und geht auch ohne Netz.
//   npm run icons            Sprite neu schreiben
//   node tools/build-icons.js --check   nur prüfen (Fehler, wenn das Sprite nicht zu icons.js passt)
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGE = path.join(ROOT, "docs", "live", "index.html");
const START = "<!-- icons:start (npm run icons, aus src/icons.js) -->";
const END = "<!-- icons:end -->";

// was die Handy-Seite braucht: alle Spiele (als g-<Spiel>) und diese Symbole aus UI
const PHONE_UI = ["medal1", "medal2", "medal3", "mic", "lock", "crown", "mixer", "battery", "camera", "bell", "thumb", "check", "headphones", "boom", "voice", "speaker", "speakerOff", "gamepad", "moon", "shield", "shake", "draw", "prev", "pause", "play", "skip", "confetti", "music", "timer"];

function loadIcons() {
  const r = esbuild.buildSync({ entryPoints: [path.join(ROOT, "src", "icons.js")], bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent" });
  const mod = { exports: {} };
  new Function("module", "exports", "require", r.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
}
const inner = (svg, name) => {
  const m = /^<svg[^>]*>([\s\S]*)<\/svg>$/.exec(svg || "");
  if (!m) throw new Error("Symbol fehlt oder ist kein <svg>: " + name);
  return m[1];
};
// das Sprite als ein Block (Zeilen mit \n getrennt)
function sprite() {
  const { UI, GAME } = loadIcons();
  const list = [...Object.keys(GAME).map((k) => ["g-" + k, GAME[k]]), ...PHONE_UI.map((k) => [k, UI[k]])];
  const symbols = list.map(([id, svg]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${inner(svg, id)}</symbol>`);
  return [START, `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">${symbols.join("")}</svg>`, END].join("\n");
}
// Zeilenenden wie in der Datei: git kann sie unter Windows als CRLF auschecken
const CRLF = String.fromCharCode(13, 10);
const toLf = (s) => s.split(CRLF).join("\n");
function main() {
  const raw = fs.readFileSync(PAGE, "utf8"), crlf = raw.includes(CRLF), html = toLf(raw);
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < a) throw new Error("Marken für das Sprite fehlen in docs/live/index.html");
  const next = html.slice(0, a) + sprite() + html.slice(b + END.length);
  if (process.argv.includes("--check")) {
    if (next !== html) {
      console.error("docs/live/index.html: das Symbol-Sprite passt nicht zu src/icons.js – npm run icons");
      process.exit(1);
    }
    console.log("Sprite der Handy-Seite ist aktuell");
    return;
  }
  if (next !== html) fs.writeFileSync(PAGE, crlf ? next.split("\n").join(CRLF) : next);
  console.log(next === html ? "Sprite war schon aktuell" : "Sprite geschrieben");
}
if (require.main === module) main();
module.exports = { sprite, toLf, PHONE_UI };
