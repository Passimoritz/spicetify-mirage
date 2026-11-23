// Prüft die Übersetzungen: welche Schlüssel fehlen je Datei und Sprache gegenüber Englisch, und wo die Platzhalter
// ({n}, {fps} …) oder die Markup-Tags (<kbd>, <b> …) nicht zum englischen Text passen. Liest nur Dateien.
//   npm run check:i18n                      Übersicht, Ende mit Code 1, wenn etwas fehlt oder nicht passt
//   node tools/i18n-missing.js --json out.json   zusätzlich alle Funde als JSON (mit en- und de-Text zum Übersetzen)
//   node tools/i18n-missing.js --lang ja,tr       nur diese Sprachen
//   node tools/i18n-missing.js --keys        jeden fehlenden Schlüssel einzeln auflisten
//   node tools/i18n-missing.js --since <rev> zusätzlich: Schlüssel, deren en-Text sich seit <rev> geändert hat, während
//                                             die Übersetzung gleich blieb (veraltete Bedeutung) – auch das ergibt Code 1
// Geprüft werden src/i18n.js, alle src/i18n-*.js, die Texte der Handy-Seite (docs/live/index.html) und der
// Overlay-App (overlay/i18n.js).
// Jede Zusatzdatei wird für sich gegen ihren eigenen en-Block geprüft: sie überschreibt oft ältere Fassungen in
// i18n.js – fehlt dort eine Sprache, sähe sie den veralteten Text. In src/i18n.js zählt ein Schlüssel als vorhanden,
// wenn ihn i18n.js selbst oder eine Zusatzdatei für diese Sprache hat.
// Namen einzelner Party-Stile (party_* in i18n-genres.js) sind meist Eigennamen: dort fehlende gelten als optional.
// Bleibt ein Name in einer Sprache bewusst international, steht er in der Liste GENRE_INTL derselben Datei (ein
// Export „…_INTL“: je Sprache die Schlüssel ohne „party_“) – er gilt dann als vorhanden. Ein Name in dieser Liste,
// den es im Englischen nicht gibt (Tippfehler, gestrichener Stil), ist ein Fehler.
const fs = require("fs"), path = require("path"), vm = require("vm");

const repo = path.join(__dirname, "..");
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? argv[i + 1] || "" : null;
};
const LANGS = ["de", "es", "fr", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "uk", "zh"];
const only = arg("lang") ? arg("lang").split(",").map((x) => x.trim()).filter(Boolean) : LANGS;

// Quelltext einer Datei: aus dem Arbeitsordner oder (für --since) aus einem älteren Stand im Git
const { execFileSync } = require("child_process");
const read = (rel, rev) => {
  if (!rev) return fs.readFileSync(path.join(repo, rel), "utf8");
  try {
    return execFileSync("git", ["show", `${rev}:${rel}`], { cwd: repo, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] });
  } catch { return null; }
};
// ES-Modul ohne Bundler auswerten: Importe werden zu leeren Objekten, Exporte zu Rückgabewerten
function loadModule(src, file) {
  const ctx = { S: {}, navigator: { language: "en", languages: ["en"] }, console };
  const names = [];
  let code = src.replace(/^import\s*\{([^}]*)\}\s*from\s*["'][^"']+["'];?\s*$/gm, (_, list) => {
    for (const n of list.split(",").map((x) => x.trim().split(/\s+as\s+/).pop()).filter(Boolean)) ctx[n] = {};
    return "";
  });
  code = code.replace(/^export\s+const\s+(\w+)/gm, (_, n) => (names.push(n), "const " + n));
  code = code.replace(/^export\s*\{([^}]*)\};?\s*$/gm, (_, list) => (names.push(...list.split(",").map((x) => x.trim()).filter(Boolean)), ""));
  code += `\n;({${[...new Set(names)].join(",")}})`;
  return vm.runInNewContext(code, ctx, { filename: file });
}
const dictOf = (mod) => mod[Object.keys(mod).find((k) => mod[k] && typeof mod[k] === "object" && mod[k].en)];
// Handy-Seite: der Block von „const L = {“ bis vor „const LANG =“ baut alle Texte zusammen
function loadPhone(src, file) {
  const a = src.indexOf("const L = {"), b = src.indexOf("const LANG =", a);
  if (a < 0 || b < 0) throw new Error("Texte der Handy-Seite nicht gefunden: " + file);
  return vm.runInNewContext(src.slice(a, b) + "\n;L", { navigator: { language: "en", languages: ["en"] } }, { filename: file });
}
// Overlay-App: ein IIFE mit „const I18N = {“ – das Objekt wird beim Auswerten herausgereicht
function loadOverlay(src, file) {
  const ctx = { root: {} };
  vm.runInNewContext(src.replace("const I18N = {", "const I18N = globalThis.__I18N = {"), ctx, { filename: file });
  return ctx.__I18N;
}
const LOAD = (rel, rev) => {
  const src = read(rel, rev);
  if (src == null) return null;
  if (rel.endsWith(".html")) return loadPhone(src, rel);
  if (rel.startsWith("overlay/")) return loadOverlay(src, rel);
  const mod = loadModule(src, rel);
  return rel === "src/i18n.js" ? mod.I18N : dictOf(mod);
};

// Platzhalter und Tags eines Textes (bei Listen: alle Einträge zusammen, plus die Länge der Liste)
const marks = (v) => {
  if (Array.isArray(v)) return ["#" + v.length, ...v.flatMap(marks)];
  const s = String(v);
  return [...(s.match(/\{[a-zA-Z0-9_]+\}/g) || []), ...(s.match(/<\/?[a-z][a-z0-9]*\b/gi) || []).map((x) => x.toLowerCase())].sort();
};
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const sources = [];
const main = LOAD("src/i18n.js");
// bewusst internationale Namen: Export „…_INTL“ = { sprache: "name name …" } (Schlüssel ohne „party_“)
const intlOf = (rel) => {
  const mod = loadModule(read(rel), rel), k = Object.keys(mod).find((n) => /_INTL$/.test(n));
  return Object.fromEntries(Object.entries((k && mod[k]) || {}).map(([l, v]) => [l, new Set(String(v).split(/\s+/).filter(Boolean).map((x) => "party_" + x))]));
};
const sats = fs.readdirSync(path.join(repo, "src")).filter((f) => /^i18n-.+\.js$/.test(f)).sort().map((f) => ({ file: "src/" + f, dict: LOAD("src/" + f), intl: intlOf("src/" + f) })).filter((s) => s.dict);
sources.push({
  file: "src/i18n.js",
  dict: main,
  has: (l, k) => (main[l] && k in main[l]) || sats.some((s) => s.dict[l] && k in s.dict[l]),
});
for (const s of sats) sources.push({ ...s, optional: s.file.endsWith("i18n-genres.js") ? (k) => k.startsWith("party_") : null });
// Einträge der Liste ohne englischen Namen
const strayIntl = sats.flatMap((s) => Object.entries(s.intl).flatMap(([l, set]) => [...set].filter((k) => !(k in (s.dict.en || {}))).map((k) => `${s.file} ${l}: ${k.slice(6)}`)));
sources.push({ file: "docs/live/index.html", dict: LOAD("docs/live/index.html") });
if (fs.existsSync(path.join(repo, "overlay", "i18n.js"))) sources.push({ file: "overlay/i18n.js", dict: LOAD("overlay/i18n.js") });
const since = arg("since");

const out = {}, bad = {}, stale = {};
let missing = 0, optional = 0, mism = 0, old = 0;
const rows = [];
for (const src of sources) {
  const en = src.dict.en || {};
  const before = since ? LOAD(src.file, since) : null;
  for (const l of only) {
    const dict = src.dict[l] || {};
    const has = src.has ? (k) => src.has(l, k) : (k) => k in dict || !!src.intl?.[l]?.has(k);
    for (const k of Object.keys(en)) {
      if (!has(k)) {
        const opt = src.optional?.(k);
        opt ? optional++ : missing++;
        if (opt && !argv.includes("--optional")) continue;
        ((out[src.file] ||= {})[l] ||= {})[k] = { en: en[k], de: src.dict.de?.[k] ?? main.de?.[k] ?? null };
        continue;
      }
      const v = k in dict ? dict[k] : null;
      if (v == null) continue;
      // en hat sich seit --since geändert, die Übersetzung nicht: sie meint vermutlich noch das Alte
      const was = before?.en?.[k], wasL = before?.[l]?.[k];
      if (l !== "de" && was != null && JSON.stringify(was) !== JSON.stringify(en[k]) && JSON.stringify(wasL) === JSON.stringify(v)) {
        old++;
        ((stale[src.file] ||= {})[l] ||= {})[k] = { en: en[k], de: src.dict.de?.[k] ?? null, enBefore: was, [l]: v };
      }
      if (!same(marks(en[k]), marks(v))) {
        mism++;
        ((bad[src.file] ||= {})[l] ||= {})[k] = { en: en[k], [l]: v };
      }
    }
    const n = Object.keys(out[src.file]?.[l] || {}).length, m = Object.keys(bad[src.file]?.[l] || {}).length, o = Object.keys(stale[src.file]?.[l] || {}).length;
    if (n || m || o) rows.push(`${src.file.padEnd(24)} ${l}  ` + [n && n + " fehlen", m && m + " Platzhalter/Tags anders", o && o + " veraltet"].filter(Boolean).join(", "));
  }
}

if (rows.length) console.log(rows.join("\n"));
if (strayIntl.length) console.log("Bewusst international, aber ohne englischen Namen:\n  " + strayIntl.join("\n  "));
if (argv.includes("--keys")) {
  for (const [f, byL] of Object.entries(out)) for (const [l, keys] of Object.entries(byL)) console.log(`\n${f} ${l}: ${Object.keys(keys).join(", ")}`);
  for (const [f, byL] of Object.entries(bad)) for (const [l, keys] of Object.entries(byL)) for (const [k, v] of Object.entries(keys)) console.log(`\n${f} ${l} ${k}\n  en: ${JSON.stringify(v.en)}\n  ${l}: ${JSON.stringify(v[l])}`);
}
const json = arg("json");
if (json != null) {
  const file = path.resolve(json || "i18n-missing.json");
  fs.writeFileSync(file, JSON.stringify({ missing: out, placeholders: bad, stale }, null, 2));
  console.log("JSON: " + file);
}
console.log(`\n${missing} fehlende Schlüssel, ${mism} mit abweichenden Platzhaltern/Tags` + (since ? `, ${old} veraltet seit ${since}` : "") + (optional ? ` (${optional} optionale Stilnamen fehlen, --optional zeigt sie)` : "") + ` – Sprachen: ${only.join(", ")}`);
process.exit(missing || mism || old || strayIntl.length ? 1 : 0);
