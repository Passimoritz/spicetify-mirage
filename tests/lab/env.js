// Testlabor: lädt die ECHTEN Module aus src/ (Song-Karte, Regie, Stimmung, Party, Genres, Schätzung) in Node –
// ohne Spotify, ohne Fenster, ohne Ton. Was Spotify oder den Browser braucht, ersetzen kleine Attrappen
// (tests/lab/stubs/): Einstellungen, Player, Liedtext, Analyse-Speicher.
const esbuild = require("esbuild");
const path = require("path");

// LAB_SRC: anderer Quellstand (z. B. der Stand vor einer Änderung) für Vorher-nachher-Vergleiche
const SRC = process.env.LAB_SRC ? path.resolve(process.env.LAB_SRC) : path.join(__dirname, "..", "..", "src");
const STUBS = path.join(__dirname, "stubs");
// Browser-Globals, die beim Laden oder pro Bild gelesen werden
globalThis.window ??= globalThis;
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });
globalThis.localStorage ??= { getItem: () => null, setItem() {} };
globalThis.document ??= { documentElement: { classList: { toggle() {}, contains: () => false } }, dispatchEvent() {}, addEventListener() {} };
globalThis.addEventListener ??= () => {};

// stubs: Liste der Modulnamen (ohne .js), die durch tests/lab/stubs/<name>.js ersetzt werden
// (asynchron: esbuild erlaubt Plugins nur im asynchronen Bau)
async function load(name, stubs = []) {
  const plugin = {
    name: "lab-stubs",
    setup(b) {
      b.onResolve({ filter: /^\.\/[\w-]+\.js$/ }, (a) => {
        const base = path.basename(a.path, ".js");
        if (stubs.includes(base) && a.importer.startsWith(SRC)) return { path: path.join(STUBS, base + ".js") };
        return undefined;
      });
    },
  };
  const r = await esbuild.build({ entryPoints: [path.join(SRC, name)], bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent", plugins: [plugin] });
  const mod = { exports: {} };
  new Function("module", "exports", "require", r.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
}

// Party mit Attrappen für Einstellungen und Taktdaten (globalThis.__labAudio / __labCfg): ein eigenes Exemplar je Aufruf
const loadParty = () => load("party.js", ["core", "config", "audio"]);

module.exports = { load, loadParty, SRC };
