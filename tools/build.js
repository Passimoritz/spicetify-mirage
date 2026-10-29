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

if (process.argv.includes("--watch")) {
  esbuild.context(options).then((ctx) => ctx.watch());
} else {
  esbuild.build(options).catch(() => process.exit(1));
}
