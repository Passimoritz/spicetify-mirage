// node tests/unit/cfgkeys.test.js
// Jede Einstellung, die der Code als cfg.<name> liest oder schreibt, steht in DEFAULTS (src/config.js) –
// sonst übergehen „Zurücksetzen“, „Diesen Bereich zurücksetzen“ und die Sicherung sie still.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "src");
const config = fs.readFileSync(path.join(SRC, "config.js"), "utf8");

// Schlüssel von DEFAULTS aus dem Quelltext (zwei Leerzeichen Einzug, bis zur schließenden Klammer)
const block = config.slice(config.indexOf("const DEFAULTS = {"), config.indexOf("\n};", config.indexOf("const DEFAULTS = {")));
const DEFAULT_KEYS = new Set([...block.matchAll(/^ {2}([A-Za-z_]\w*):/gm)].map((m) => m[1]));
assert.ok(DEFAULT_KEYS.size > 100, "DEFAULTS gefunden");

// Bewusst ohne Standardwert: interne Merker und Einmal-Umstellungen, keine Einstellungen zum Zurücksetzen
const ALLOW = new Set([
  // nur noch zum Aufräumen alter Einstellungen (Migration auf canvasShow)
  "canvasIn",
  "schemeCfg", // Spotify-Schema beim Speichern (erkennt einen Wechsel per „spicetify config“)
  "presetBase", // zuletzt gewähltes Preset als Kostenrahmen für „Eigene“ (perf.js)
  "lite", // gehört zu den Presets (PRESETS in perf.js setzt ihn immer)
  "zoomOff1155", "join2min", // einmalige Umstellungen beim Laden (config.js)
  "calmPreset128", // einmalige Umstellung „Ruhig“ nur noch als Preset (config.js)
]);

const used = new Map();
for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith(".js"))) {
  const text = fs.readFileSync(path.join(SRC, f), "utf8");
  for (const m of text.matchAll(/\bcfg(?:\.([A-Za-z_]\w*)|\[\s*["']([A-Za-z_]\w*)["']\s*\])/g)) {
    const k = m[1] || m[2];
    if (!used.has(k)) used.set(k, f);
  }
}
assert.ok(used.size > 100, "cfg-Zugriffe gefunden");

const missing = [...used].filter(([k]) => !DEFAULT_KEYS.has(k) && !ALLOW.has(k)).map(([k, f]) => `${k} (${f})`);
assert.deepStrictEqual(missing, [], "cfg-Schlüssel ohne Eintrag in DEFAULTS: " + missing.join(", "));

// die Ausnahmeliste bleibt klein und enthält nichts, was inzwischen doch in DEFAULTS steht
for (const k of ALLOW) assert.ok(!DEFAULT_KEYS.has(k), `${k} steht in DEFAULTS – aus ALLOW streichen`);

console.log(`cfgkeys: ${used.size} Schlüssel geprüft, ok`);
