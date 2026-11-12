// Lädt ein Modul aus src/ für die Unit-Tests: esbuild bündelt es nach CommonJS (src/ ist ESM ohne "type": "module").
const esbuild = require("esbuild");
const path = require("path");

function load(name) {
  const r = esbuild.buildSync({
    entryPoints: [path.join(__dirname, "..", "..", "src", name)],
    bundle: true,
    format: "cjs",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const mod = { exports: {} };
  new Function("module", "exports", "require", r.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
}

module.exports = { load };
