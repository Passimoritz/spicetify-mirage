// node tests/unit/settingsui.test.js
// Einstellungs-Dialog: Gruppen, Abhängigkeiten und Texte, die Fakten aus dem Code nennen (Zahl der Ansichten,
// wo ein Knopf heute sitzt, einheitliche Namen) – in allen Sprachen.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./load.js");

const SRC = path.join(__dirname, "..", "..", "src");
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

// i18n.js braucht ein paar Browser-Namen (core.js); die Texte selbst sind reine Objekte
Object.assign(globalThis, {
  window: { Spicetify: {} },
  document: { documentElement: {} },
  addEventListener: () => {},
});
if (!globalThis.navigator) globalThis.navigator = { language: "en", languages: ["en"] };
const { I18N } = load("i18n.js");
const LANGS = Object.keys(I18N);
assert.ok(LANGS.length >= 14, "alle Sprachen geladen");
const tr = (l, k) => I18N[l][k] ?? I18N.en[k];

// ---- Zahl der Ansichten im Immersiv-Modus (MODES in immersive.js)
const im = read("immersive.js");
const modesSrc = im.slice(im.indexOf("const MODES = ["), im.indexOf("];", im.indexOf("const MODES = [")));
const VIEWS = [...modesSrc.matchAll(/\["(\w+)", "tab\w+"\]/g)].length;
assert.ok(VIEWS >= 6, "MODES gefunden");
const digits = (s) => [...String(s).matchAll(/(?<![\d.])\d(?![\d])/g)].map((m) => Number(m[0]));
for (const l of LANGS) {
  // „Tasten 1 bis N“ (Einführung) und „1 – N Ansicht“ (Tipp unten im Dialog): N ist die Zahl der Ansichten
  for (const k of ["tour2", "tip"]) {
    const d = digits(tr(l, k));
    assert.ok(d.includes(1), `${l}.${k} nennt die Tasten ab 1`);
    assert.strictEqual(Math.max(...d), VIEWS, `${l}.${k}: höchste Taste ${Math.max(...d)}, es gibt ${VIEWS} Ansichten`);
  }
  // Tastenliste: eine Ansicht je Eintrag
  assert.strictEqual(tr(l, "k_view").split("·").length, VIEWS, `${l}.k_view nennt ${VIEWS} Ansichten`);
}

// ---- Hinweise auf Knöpfe, die heute Zeilen im Menü „Mehr“ sind (Party-Modus)
for (const l of LANGS) {
  const more = tr(l, "pmTitle");
  for (const k of ["partyScreenHint", "partyRecapHint", "canvasHint"]) assert.ok(tr(l, k).includes(more), `${l}.${k} verweist auf „${more}“`);
}
assert.ok(!/shows a button|a button appears/i.test(I18N.en.partyScreenHint + I18N.en.partyRecapHint), "kein „Knopf erscheint“ mehr");
// Schalter heißt wie die Zeile im Menü
for (const l of LANGS) assert.strictEqual(tr(l, "partyScreen"), tr(l, "toScreen"), `${l}: partyScreen = toScreen`);

// ---- ein Begriff je Sache
for (const l of LANGS) {
  assert.strictEqual(tr(l, "shareNow"), tr(l, "share"), `${l}: shareNow = share`);
  assert.strictEqual(tr(l, "smShare"), tr(l, "share"), `${l}: smShare = share`);
  assert.strictEqual(tr(l, "partyLive"), tr(l, "liveTitle"), `${l}: partyLive = liveTitle`);
  assert.strictEqual(tr(l, "liveBtn"), tr(l, "liveTitle"), `${l}: liveBtn = liveTitle`);
}

// ---- Dialog: jede Einstellung genau an einer Stelle, Gruppen in fester Reihenfolge
const st = read("settings.js");
const body = st.slice(st.indexOf("function render(box)"), st.indexOf("// Fokus im Fenster halten"));
const keys = [...body.matchAll(/\b(?:toggle|range|rangeZero)\("(\w+)"/g)].map((m) => m[1]);
// wishRules() baut drei Regler/Schalter außerhalb von render()
keys.push(...[...st.slice(st.indexOf("function wishRules()"), st.indexOf("function remoteButton()")).matchAll(/\b(?:toggle|range|rangeZero)\("(\w+)"/g)].map((m) => m[1]));
const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
assert.deepStrictEqual(dup, [], "doppelt im Dialog: " + dup.join(", "));
assert.ok(!keys.includes("calm"), "„Ruhig“ gibt es nur als Preset, nicht als eigenen Schalter");
for (const k of ["remoteFix", "onlineLyrics", "partyOnline"]) assert.ok(keys.includes(k), k + " im Dialog");
const GROUPS = JSON.parse(st.match(/const GROUPS = (\[[^\]]*\]);/)[1]);
const used = [...body.matchAll(/\bgroup\(\s*"(\w+)"/g)].map((m) => m[1]);
assert.deepStrictEqual(used, GROUPS, "Gruppen im Dialog = GROUPS, in derselben Reihenfolge");
// jede Gruppe hat ihren Titel in jeder Sprache
for (const k of ["g_comfort", "g_lyrics", "g_viz", "g_system", "ps_screen", "offBy", "calmSwitchHint"]) for (const l of LANGS) assert.ok(I18N[l][k], `${l}.${k}`);
for (const l of LANGS) assert.ok(I18N[l].offBy.includes("{s}"), `${l}.offBy hat {s}`);

// ---- Schnellmenü und Dialog: Energiesparen mit denselben drei Stufen
assert.ok(/const ECO = \["auto", "on", "off"\]/.test(st), "ECO im Dialog");
assert.ok(/for \(const k of ECO\)/.test(im) && /t\("eco_" \+ k\)/.test(im), "Schnellmenü nimmt ECO und dieselben Namen");
assert.ok(!/ecoQuick/.test(im + st), "keine eigenen Schnellmenü-Namen fürs Energiesparen");

// ---- Abhängigkeiten (settingsdeps.js)
const { DEPENDS, blockedBy } = load("settingsdeps.js");
const cfgSrc = read("config.js");
const defaults = new Set([...cfgSrc.slice(cfgSrc.indexOf("const DEFAULTS = {")).matchAll(/^ {2}([A-Za-z_]\w*):/gm)].map((m) => m[1]));
for (const d of DEPENDS) {
  for (const k of d.keys) {
    assert.ok(defaults.has(k), `${d.id}: ${k} in DEFAULTS`);
    assert.ok(keys.includes(k), `${d.id}: ${k} ist ein Schalter im Dialog`);
  }
  assert.ok(I18N.en[d.label], `${d.id}: Name ${d.label}`);
  if (d.jump.startsWith("preset:")) assert.ok(new RegExp(`\\b${d.jump.slice(7)}: \\d`).test(read("perf.js")), `${d.id}: Preset ${d.jump}`);
  else assert.ok(keys.includes(d.jump), `${d.id}: Sprungziel ${d.jump} im Dialog`);
}
assert.strictEqual(blockedBy("partyStrobe", { noFlash: true }).id, "noFlash");
assert.strictEqual(blockedBy("partyStrobe", { noFlash: false }), null);
assert.strictEqual(blockedBy("burst", { calm: true }).id, "calm");
assert.strictEqual(blockedBy("vizGlow", { calm: true, noFlash: true }), null);

// ---- „Ruhig“: eine Quelle für die Werte (config.js), perf.js übernimmt sie
assert.ok(/calm: CALM_PRESET/.test(read("perf.js")), "PRESETS.calm = CALM_PRESET");
assert.ok(/calm: false,/.test(cfgSrc.slice(cfgSrc.indexOf("const DEFAULTS = {"))), "calm folgt dem Preset (Standard aus)");

// ---- Umstellung alter „Ruhiger Modus“-Schalter (config.js, migrateCalm) und neue Standardwerte
{
  Object.assign(globalThis.document, { createElement: () => ({}), head: { append: () => {} } });
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  const { migrateCalm, DEFAULTS, CALM_PRESET } = load("config.js");
  for (const k of ["albumPanel", "clockDate", "plRecent", "calmFrom"]) assert.ok(k in DEFAULTS, k + " in DEFAULTS");
  assert.strictEqual(DEFAULTS.calm, false);
  assert.strictEqual(CALM_PRESET.calm, true);
  // Schalter an, Preset „Ausgewogen“: Eigene auf Grundlage „Ruhig“, zurück geht es nach „Ausgewogen“
  let c = { calm: true, preset: "balanced", tilt: true };
  migrateCalm(c, { ...c });
  assert.deepStrictEqual([c.preset, c.presetBase, c.calm, c.calmFrom, c.tilt, c.calmPreset128], ["custom", "calm", true, "balanced", true, true]);
  // Schalter aus: nichts ändert sich
  c = { calm: false, preset: "full" };
  migrateCalm(c, { ...c });
  assert.deepStrictEqual([c.preset, c.calm], ["full", false]);
  // schon umgestellt: kein zweites Mal
  c = { calm: true, preset: "balanced" };
  migrateCalm(c, { ...c, calmPreset128: true });
  assert.strictEqual(c.preset, "balanced");
  // Preset „Ruhig“ ohne calm (alter Stand nach Einzelschaltern): calm folgt dem Preset
  c = { calm: false, preset: "custom", presetBase: "calm" };
  migrateCalm(c, { ...c });
  assert.strictEqual(c.calm, true);
  // System „Bewegung reduzieren“: Standard ist das Preset „Ruhig“ (wie bisher ruhig ab dem ersten Start)
  globalThis.matchMedia = () => ({ matches: true });
  const rm = load("config.js").DEFAULTS;
  assert.deepStrictEqual([rm.preset, rm.calm, rm.particles, rm.noFlash], ["calm", true, false, true]);
}

// ---- Raster des Dialogs (1.32): Unter-Einstellungen, Felder, lange Hinweise
{
  const { DEFAULTS } = load("config.js");
  // jede Unter-Einstellung hängt an einem Schalter, den es gibt (sonst wäre sie immer gesperrt)
  const subs = [...st.matchAll(/\bsub\(\s*"(\w+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual([...subs].sort(), ["glass", "lyrPlayful", "partyInstruments", "partyLive", "partyWishes"], "Unter-Einstellungen: " + subs.join());
  for (const k of subs) {
    assert.strictEqual(typeof DEFAULTS[k], "boolean", `Unter-Einstellung unter „${k}“: ein Schalter in DEFAULTS`);
    assert.ok(keys.includes(k), `${k} ist selbst ein Schalter im Dialog`);
    // der Schalter steht vor seinen Unter-Einstellungen
    // (die Wunsch-Regeln baut wishRules() außerhalb von render(), gleich hinter dem Schalter)
    const at = body.search(new RegExp(`\\bsub\\(\\s*"${k}"`));
    assert.ok(k === "partyWishes" || (at > 0 && body.indexOf(`toggle("${k}"`) < at), `${k}: Schalter vor seinen Unter-Einstellungen`);
  }
  // was nur über die Handys geht, hängt am Live-Link; die Stärke am verspielten Stil; die Unschärfe am Glas
  const subBody = (k) => body.slice(body.search(new RegExp(`\\bsub\\(\\s*"${k}"`))).slice(0, 900);
  for (const k of ["partyWishes", "partyReacts", "partyPhotos", "partyWave"]) assert.ok(subBody("partyLive").includes(k), `${k} unter dem Live-Link`);
  assert.ok(/sub\("lyrPlayful", playLevel\(\)\)/.test(body), "Verspieltheit unter dem verspielten Stil");
  assert.ok(/sub\("glass", range\("blur"/.test(body), "Unschärfe unter Echtes Glas");
  assert.ok(!/cfg\.lyrPlayful \? playLevel/.test(st), "Verspieltheit wird nicht mehr versteckt, sondern gesperrt");
  // gesperrt heißt: Bedienelemente disabled, Kasten aria-disabled, Hinweis „Nur mit …“
  const subFn = st.slice(st.indexOf("function sub("), st.indexOf("function bolt("));
  assert.ok(/c\.disabled = true/.test(subFn) && /aria-disabled/.test(subFn) && /needsParent/.test(subFn), "sub() sperrt und sagt, wovon es abhängt");
  // „mehr“ steht nur im CSS (data-label), nicht im Text: sonst fände die Suche „mehr“ in jeder langen Zeile
  const clamp = st.slice(st.indexOf("function clampHints("), st.indexOf("function watchHints("));
  assert.ok(/dataset\.label = t\("hintMore"\)/.test(clamp) && !/el\("button", "m-more", t\(/.test(clamp), "„mehr“ ohne Textinhalt");
  assert.ok(/is-searching/.test(clamp), "beim Suchen wird nicht gemessen");
  // neue Texte in allen Sprachen
  for (const l of LANGS) {
    for (const k of ["hintMore", "hintLess", "needsParent", "moreShare", "moreBackup", "moreHelp"]) assert.ok(I18N[l][k], `${l}.${k}`);
    assert.ok(I18N[l].needsParent.includes("{s}"), `${l}.needsParent hat {s}`);
  }
  // Schemata stehen in der Gruppe „Farben“ (früher frei zwischen den Gruppen)
  assert.ok(/group\("colours", t\("g_colours"\), true, schemeField/.test(body), "Farbschema oben in „Farben“");
  // Suche: die Gruppen hängen nicht an der Einheit davor, Unter-Einstellungen werden zeilenweise gesucht
  assert.ok(/parent === top && c\.matches\("details"\)/.test(st) && /details\.m-group, \.m-sub/.test(st), "Suche: Gruppen und Unter-Einstellungen richtig zerlegt");
  // Suchleiste über einem eigenen Bildlauf-Bereich (keine klebende Leiste mit eigener Fläche); die Bildlauf-Stelle
  // überlebt den Neuaufbau nach jedem Schalter
  assert.ok(/:scope > \.m-scroll/.test(body) && /box\.replaceChildren\(barEl, sayEl, scroll\)/.test(body) && /scroll\.scrollTop = at/.test(body), "Suchleiste fest, Inhalt in .m-scroll");
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "Mirage", "user.css"), "utf8");
  const barRules = [...css.matchAll(/([^{}]*\.m-search-bar)\s*\{([^}]*)\}/g)].map((m) => m[2]).join("");
  assert.ok(!/background|position:\s*sticky/.test(barRules), "die Suchleiste malt keine eigene Fläche und klebt nicht");
}

console.log(`settingsui: ${LANGS.length} Sprachen, ${keys.length} Einstellungen, ${GROUPS.length} Gruppen, ok`);
