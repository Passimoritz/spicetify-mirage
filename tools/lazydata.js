// esbuild-Plugin: große Datentabellen gepackt und erst bei Bedarf ausgepackt ins Theme (src/lazydata.js).
//  - jede JSON-Datei unter src/ (das Wörterbuch lexicon/*.json)
//  - src/genre-map.js (erzeugt von tools/genres-map.js, reine Daten)
// Aus „export default {…}“ wird „export default lazyJSON("<Deflate als Base64>", <Größe>)“: ein Objekt, das beim
// ersten Zugriff ausgepackt wird und sich danach wie das Original liest. Der Inhalt der Dateien bleibt, wie er ist –
// wer sie ändert, muss hier nichts anpassen. Jede gepackte Tabelle wird beim Bauen zurückgepackt und verglichen.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const util = require("util");
const zlib = require("zlib");
const { deflateRaw } = require("./deflate.js");

const SRC = path.join(__dirname, "..", "src");
const RUNTIME = path.join(SRC, "lazydata.js");
// genre-map.js und alles, was künftig wie sie reine Daten als JS-Modul ausgibt
const DATA_MODULES = /[\\/]src[\\/]genre-map\.js$/;

function packed(value) {
  const json = JSON.stringify(value);
  const raw = Buffer.from(json, "utf8");
  const z = deflateRaw(raw);
  if (Buffer.compare(zlib.inflateRawSync(z), raw) !== 0) throw new Error("lazydata: Packen ging schief");
  return `lazyJSON(${JSON.stringify(z.toString("base64"))}, ${raw.length})`;
}
const header = (file) => `import { lazyJSON } from ${JSON.stringify("./" + path.relative(path.dirname(file), RUNTIME).split(path.sep).join("/"))};\n`;

const lazyData = {
  name: "mirage-lazydata",
  setup(build) {
    build.onLoad({ filter: /\.json$/ }, (a) => {
      if (!a.path.startsWith(SRC)) return undefined;
      const value = JSON.parse(fs.readFileSync(a.path, "utf8"));
      // kleine Werte (Zahlen, kurze Listen) lohnen das Packen nicht
      if (!value || typeof value !== "object" || JSON.stringify(value).length < 2048) return { contents: `export default JSON.parse(${JSON.stringify(JSON.stringify(value))});`, loader: "js" };
      return { contents: header(a.path) + `export default ${packed(value)};`, loader: "js", resolveDir: path.dirname(a.path) };
    });
    build.onLoad({ filter: DATA_MODULES }, async (a) => {
      // das Modul in Node auswerten (es ist reine Daten) und jede Ausfuhr gepackt neu schreiben
      const r = await esbuild.build({ entryPoints: [a.path], bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent" });
      const mod = { exports: {} };
      new Function("module", "exports", r.outputFiles[0].text)(mod, mod.exports);
      const out = [header(a.path)];
      for (const [k, v] of Object.entries(mod.exports)) {
        // nur JSON-reine Werte (keine Funktionen, RegExp, undefined …) – sonst bleibt die Datei unverändert
        if (!v || typeof v !== "object" || !util.isDeepStrictEqual(v, JSON.parse(JSON.stringify(v)))) return undefined;
        out.push(`export const ${k} = ${packed(v)};`);
      }
      return { contents: out.join("\n"), loader: "js", resolveDir: path.dirname(a.path), watchFiles: [a.path] };
    });
  },
};

module.exports = { lazyData };
