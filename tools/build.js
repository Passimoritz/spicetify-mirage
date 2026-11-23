// Bündelt src/*.js zu Mirage/theme.js und setzt die Version aus package.json ein.
// Aufruf: npm run build   (npm run watch: bei jeder Änderung neu)
const esbuild = require("esbuild");
const path = require("path");
const { version } = require("../package.json");

const { lazyData } = require("./lazydata.js");

// Größe und Startzeit (Spotify lädt und übersetzt theme.js bei jedem Start, auch ohne Party):
//  - lazyData: Wörterbuch (lexicon/*.json) und Genre-Tabelle gepackt, ausgepackt erst beim ersten Zugriff
//    (tools/lazydata.js, src/lazydata.js) – ein langer Text ist für V8 fast umsonst, ein riesiges Literal nicht
//  - charset utf8: Umlaute, Kyrillisch, CJK … der Übersetzungen bleiben UTF-8 statt \uXXXX (ein Zeichen statt sechs)
//  - ohne Leerraum und mit kürzerer Syntax, aber mit den echten Namen: Fehlermeldungen in Diagnosen bleiben lesbar
const compact = { charset: "utf8", minifyWhitespace: true, minifySyntax: true };

const options = {
  entryPoints: [path.join(__dirname, "..", "src", "main.js")],
  plugins: [lazyData],
  outfile: path.join(__dirname, "..", "Mirage", "theme.js"),
  bundle: true,
  format: "iife",
  target: "chrome120",
  legalComments: "none",
  ...compact,
  // Byte-Order-Mark: legt UTF-8 fest, auch wenn eine Seite das Skript ohne Zeichensatz ausliefert
  banner: { js: "\uFEFF" },
  define: { __MIRAGE_VERSION__: JSON.stringify(version) },
  logLevel: "info",
};

// Die Party-Location läuft in einem eigenen Thread: ihr Code wird vorab gebündelt und als Text eingebettet
// (das Theme ist eine einzige Datei – der Thread entsteht daraus zur Laufzeit als Blob)
function workerSource() {
  const r = esbuild.buildSync({
    entryPoints: [path.join(__dirname, "..", "src", "venue-worker.js")],
    bundle: true,
    format: "iife",
    target: "chrome120",
    write: false,
    legalComments: "none",
    ...compact,
  });
  return r.outputFiles[0].text;
}
options.define.__VENUE_WORKER__ = JSON.stringify(workerSource());

// Wortbilder für die Live-Seite der Handys (GitHub Pages): eigene kleine Datei ohne Wörterbuch
function buildTvFx() {
  return esbuild.build({
    entryPoints: [path.join(__dirname, "..", "src", "tvfx.js")],
    outfile: path.join(__dirname, "..", "docs", "live", "fx.js"),
    bundle: true,
    minify: true,
    format: "iife",
    target: "chrome100",
    legalComments: "none",
    logLevel: "info",
  });
}

// QR-Leser für Handys ohne eingebaute Erkennung (iPhone): wird erst beim Scannen nachgeladen
function buildQrReader() {
  return esbuild.build({
    stdin: { contents: 'import jsQR from "jsqr"; window.jsQR = jsQR;', resolveDir: path.join(__dirname, "..") },
    outfile: path.join(__dirname, "..", "docs", "live", "qr.js"),
    bundle: true,
    minify: true,
    format: "iife",
    target: "chrome100",
    legalComments: "none",
    banner: { js: "/* jsQR, Apache-2.0, https://github.com/cozmo/jsQR */" },
    logLevel: "info",
  });
}

// Karaoke-Wertung für die Live-Seite (src/karaoke.js): das Handy des Singenden lädt sie erst, wenn es dran ist
function buildKaraoke() {
  return esbuild.build({
    stdin: { contents: 'import * as K from "./src/karaoke.js"; window.MirageKaraoke = K;', resolveDir: path.join(__dirname, "..") },
    outfile: path.join(__dirname, "..", "docs", "live", "karaoke.js"),
    bundle: true,
    minify: true,
    format: "iife",
    target: "chrome100",
    legalComments: "none",
    logLevel: "info",
  });
}

if (process.argv.includes("--watch")) {
  esbuild.context(options).then((ctx) => ctx.watch());
} else {
  Promise.all([esbuild.build(options), buildTvFx(), buildQrReader(), buildKaraoke()]).catch(() => process.exit(1));
}
