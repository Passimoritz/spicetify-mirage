// node tests/unit/shortcuts.test.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./load.js");
const { SHORTCUTS, shortcutFor, helpRows } = load("shortcuts.js");
const { crowdLayers } = load("stagefx.js");

// Eine Tabelle für Tastatur und Tastenhilfe: keine Taste doppelt belegt
{
  const seen = new Map();
  for (const s of SHORTCUTS)
    for (const c of s.codes || []) {
      const k = c + (s.shift ? "+shift" : "");
      assert.ok(!seen.has(k) || seen.get(k) === s.id, `Taste ${k} doppelt: ${seen.get(k)} / ${s.id}`);
      seen.set(k, s.id);
    }
}

// jede Aktion der Tabelle hat in keys.js einen Griff – und keys.js kennt keine Aktion, die nicht in der Tabelle steht
{
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "src", "keys.js"), "utf8");
  const block = src.slice(src.indexOf("const ACTIONS = {"), src.indexOf("window.addEventListener(\"keydown\""));
  const acts = new Set([...block.matchAll(/^ {2}([a-zA-Z]+): /gm)].map((m) => m[1]));
  const ids = new Set(SHORTCUTS.filter((s) => s.id && s.codes.length).map((s) => s.id));
  for (const id of ids) assert.ok(acts.has(id), "keys.js: Aktion fehlt: " + id);
  for (const a of acts) assert.ok(ids.has(a), "keys.js: Aktion ohne Taste in shortcuts.js: " + a);
}

// Taste → Aktion: Umschalt+F10 öffnet das Song-Menü, F10 allein nicht; Buchstaben gelten auch mit Umschalt
{
  assert.equal(shortcutFor("F10", true)?.id, "song");
  assert.equal(shortcutFor("F10", false), null);
  assert.equal(shortcutFor("KeyS", true)?.id, "shuffle");
  assert.equal(shortcutFor("ContextMenu", false)?.id, "song");
  assert.equal(shortcutFor("F11", false)?.id, "full");
  assert.equal(shortcutFor("KeyC", false)?.id, "confetti");
  assert.equal(shortcutFor("KeyZ", false), null);
}

// Tastenhilfe: nennt die bisher fehlenden Tasten (C, F11, Umschalt+F10, Rechtsklick, Strg+Umschalt+M, Pos1/Ende,
// Editor, Spieltasten) und die Zahl der Ansichten
{
  const rows = helpRows(6);
  const kbd = rows.map((r) => r.kbd || r.kbdKey).join(" | ");
  for (const k of ["C", "F / F11", "⇧ F10", "k_rclickKey", "Ctrl ⇧ M", "Home / End", "Enter / ⌫", "1 – 9", "O", "Esc", "?", "1 – 6"]) assert.ok(kbd.includes(k), "Tastenhilfe ohne " + k + ": " + kbd);
  assert.ok(rows.every((r) => r.label), "jede Zeile hat einen Text");
  assert.ok(helpRows(7).some((r) => r.kbd === "1 – 7"), "Zahl der Ansichten folgt MODES");
}

// Publikum aus: keine Silhouetten, keine Handy-Lichter, Reaktionen vom unteren Rand, Bassbalken (wenn das Genre sie hat)
{
  const on = crowdLayers({ crowd: true, fx: true, bottom: true });
  assert.deepEqual([on.people, on.glints, on.bassBars], [true, true, false]);
  assert.ok(on.reactY0 < 1, "mit Menge steigen Reaktionen aus der Menge auf");
  const off = crowdLayers({ crowd: false, fx: true, bottom: true });
  assert.deepEqual([off.people, off.glints, off.bassBars], [false, false, true]);
  assert.ok(off.reactY0 >= 1, "ohne Menge vom unteren Bildrand");
  assert.equal(crowdLayers({ crowd: false, bottom: false }).bassBars, false, "Genre ohne Bassbalken: Rand bleibt frei");
  // Bühne ruht (Ansage, Ruhig): auch mit Schalter an keine Menge
  assert.equal(crowdLayers({ crowd: true, fx: false }).people, false);
}

console.log("shortcuts ok");
