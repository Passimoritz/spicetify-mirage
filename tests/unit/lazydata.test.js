// node tests/unit/lazydata.test.js
// Gepackte Datentabellen im Theme (tools/lazydata.js, tools/deflate.js, src/lazydata.js): der eigene Packer ist
// gleichbleibend und zlib-kompatibel, der eigene Entpacker liefert jedes Byte zurück, und Wörterbuch und Genre-Tabelle
// verhalten sich gebündelt wie im Theme (gepackt, beim ersten Zugriff ausgepackt) genau wie ungepackt.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const esbuild = require("esbuild");
const { load } = require("./load.js");
const { deflateRaw } = require("../../tools/deflate.js");
const { lazyData } = require("../../tools/lazydata.js");
const { inflateRaw, unpack, lazy } = load("lazydata.js");

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");

// ---- Packen und Entpacken: echte Tabellen und Randfälle
const LEXDIR = path.join(SRC, "lexicon");
const cases = fs.readdirSync(LEXDIR).map((f) => [f, fs.readFileSync(path.join(LEXDIR, f))]);
cases.push(["genre-map.js", fs.readFileSync(path.join(SRC, "genre-map.js"))]);
cases.push(["leer", Buffer.alloc(0)], ["ein Byte", Buffer.from("a")], ["Wiederholung", Buffer.alloc(100000, 7)]);
cases.push(["Rauschen", Buffer.from(Array.from({ length: 70000 }, (_, i) => (Math.imul(i, 2654435761) >>> 24) & 255))]);
cases.push(["UTF-8", Buffer.from("Grüße – Привет – こんにちは – 안녕 – مرحبا – 🎉 ".repeat(500))]);
for (const [name, buf] of cases) {
  const z = deflateRaw(buf);
  assert.ok(Buffer.compare(deflateRaw(buf), z) === 0, `${name}: Packer nicht gleichbleibend`);
  assert.ok(Buffer.compare(zlib.inflateRawSync(z), buf) === 0, `${name}: zlib liest den Packer nicht`);
  assert.ok(Buffer.compare(Buffer.from(inflateRaw(new Uint8Array(z), buf.length)), buf) === 0, `${name}: eigener Entpacker`);
  // und umgekehrt: zlib-Ausgabe (andere Blockarten, auch ungepackte Blöcke) liest der eigene Entpacker
  for (const level of [0, 1, 9]) {
    const zz = zlib.deflateRawSync(buf, { level });
    assert.ok(Buffer.compare(Buffer.from(inflateRaw(new Uint8Array(zz))), buf) === 0, `${name}: zlib Stufe ${level}`);
  }
  if (buf.length > 10000 && name !== "Rauschen") assert.ok(z.length < buf.length * 0.6, `${name}: packt kaum (${z.length}/${buf.length})`);
}
const fixed = zlib.deflateRawSync(Buffer.from("abcabcabc hallo hallo"), { strategy: zlib.constants.Z_FIXED });
assert.equal(Buffer.from(inflateRaw(new Uint8Array(fixed))).toString(), "abcabcabc hallo hallo");
const text = JSON.stringify({ a: "Grüße", b: [1, 2, 3] });
assert.equal(unpack(deflateRaw(Buffer.from(text)).toString("base64"), Buffer.byteLength(text)), text);

// ---- lazy(): liest sich wie das Objekt, make läuft erst beim ersten Zugriff und nur einmal
let made = 0;
const plain = { en: { stop: "a|b", c: { fire: "fire|flames" } }, de: { stop: "und", c: {} } };
const lz = lazy(() => (made++, structuredClone(plain)));
assert.equal(made, 0, "lazy: zu früh ausgepackt");
assert.deepStrictEqual(Object.keys(lz), ["en", "de"]);
assert.equal(made, 1);
assert.deepStrictEqual({ ...lz }, plain);
assert.deepStrictEqual(Object.entries(lz), Object.entries(plain));
assert.ok("de" in lz && !("fr" in lz));
assert.equal(lz.en.c.fire, "fire|flames");
assert.equal(JSON.stringify(lz), JSON.stringify(plain));
assert.equal(Object.getPrototypeOf(lz), Object.prototype);
assert.equal(made, 1, "lazy: mehrfach ausgepackt");

// ---- gebündelt wie im Theme: Wörterbuch und Genre-Tabelle gleich wie ungepackt
async function bundled(name) {
  const r = await esbuild.build({ entryPoints: [path.join(SRC, name)], plugins: [lazyData], bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent" });
  const text = r.outputFiles[0].text;
  const mod = { exports: {} };
  new Function("module", "exports", "require", text)(mod, mod.exports, require);
  return { mod: mod.exports, text };
}
const deep = (o) => JSON.parse(JSON.stringify(o, (_, v) => (v instanceof Set ? [...v] : v)));
(async () => {
  const L = await bundled("lexicon.js");
  assert.ok(/lazyJSON\("/.test(L.text), "Wörterbuch nicht gepackt");
  const P = load("lexicon.js");
  assert.deepStrictEqual(deep(L.mod.LEX), deep(P.LEX), "Wörterbuch gepackt ≠ ungepackt");
  assert.deepStrictEqual(deep(L.mod.NEG), deep(P.NEG), "Verneinungen gepackt ≠ ungepackt");
  assert.ok(Object.keys(L.mod.LEX).length >= 40, "zu wenige Sprachen");
  assert.ok(L.mod.NEG.de.neg instanceof Set);

  const G = await bundled("genres.js");
  assert.ok(/lazyJSON\("/.test(G.text) && !/\bacholitronix\b/.test(G.text), "Genre-Tabelle nicht gepackt");
  const plainG = load("genres.js");
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "data", "genres-all.json"), "utf8"));
  const names = [...Object.keys(data.spotify.names), ...(data.mb || []), ...Object.values(data.apple || {}).flat(), ...Object.values(data.deezer || {}).flat()];
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  let n = 0;
  for (const raw of names) {
    const g = norm(raw);
    const a = G.mod.best(g), b = plainG.best(g);
    assert.equal(a?.[0], b?.[0], `Genre „${g}“: gepackt ${a?.[0]} ≠ ungepackt ${b?.[0]}`);
    n++;
  }
  assert.ok(n > 5000);
  console.log(`lazydata: ${cases.length} Packproben, Wörterbuch (${Object.keys(P.LEX).length} Sprachen) und ${n} Genre-Namen gleich – ok`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
