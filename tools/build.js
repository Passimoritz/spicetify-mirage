// Bündelt src/*.js zu Mirage/theme.js und setzt die Version aus package.json ein.
// Aufruf: npm run build   (npm run watch: bei jeder Änderung neu)
const esbuild = require("esbuild");
const path = require("path");
const { version } = require("../package.json");

const options = {
  entryPoints: [path.join(__dirname, "..", "src", "main.js")],
  outfile: path.join(__dirname, "..", "Mirage", "theme.js"),
  bundle: true,
  format: "iife",
  target: "chrome120",
  legalComments: "none",
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

if (process.argv.includes("--watch")) {
  esbuild.context(options).then((ctx) => ctx.watch());
} else {
  Promise.all([esbuild.build(options), buildTvFx(), buildQrReader()]).catch(() => process.exit(1));
}
