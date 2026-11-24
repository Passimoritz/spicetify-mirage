// node tests/unit/rest.test.js
// Zierde ruht (src/rest.js): wann die Dauer-Animationen auf Spotifys Seiten anhalten und wann wieder laufen,
// und dass die Verdrahtung nur bei einem Wechsel umschaltet (keine Klassenänderung je Mausbewegung).
const assert = require("assert");
const { load } = require("./load.js");
const { REST_IDLE_MS, resting, nextCheck, startRest } = load("rest.js");

// ---- Entscheidung
assert.equal(resting({ focused: true, lastInput: 0, now: 1000 }), false, "aktiv und eben bedient: läuft");
assert.equal(resting({ focused: false, lastInput: 0, now: 1000 }), true, "anderes Fenster aktiv: ruht sofort");
assert.equal(resting({ focused: true, lastInput: 0, now: REST_IDLE_MS - 1 }), false, "knapp vor der Frist: läuft");
assert.equal(resting({ focused: true, lastInput: 0, now: REST_IDLE_MS }), true, "Frist ohne Eingabe: ruht");
assert.equal(resting({ focused: true, lastInput: 5000, now: 6000, idleMs: 1000 }), true, "eigene Frist");

// ---- Wecker: genau zur Frist, nie in Dauerschleife, keiner wenn sie schon ruht
assert.equal(nextCheck({ focused: true, lastInput: 0, now: 1000 }), REST_IDLE_MS - 1000);
assert.equal(nextCheck({ focused: true, lastInput: 0, now: REST_IDLE_MS - 10 }), 250, "mindestens 250 ms");
assert.equal(nextCheck({ focused: false, lastInput: 0, now: 0 }), -1);
assert.equal(nextCheck({ focused: true, lastInput: 0, now: REST_IDLE_MS }), -1);

// ---- Verdrahtung mit einem nachgebauten Fenster
{
  let now = 0;
  global.performance = { now: () => now };
  const timers = [];
  global.setTimeout = (f, ms) => (timers.push({ f, at: now + ms }), timers.length);
  global.clearTimeout = (id) => id && (timers[id - 1].f = null);
  const runTimers = () => {
    for (const t of timers.slice()) if (t.f && t.at <= now) { const f = t.f; t.f = null; f(); }
  };
  const handlers = {};
  const on = (o) => (ev, f) => ((handlers[o + ev] ||= []).push(f));
  let focus = true;
  const doc = { hasFocus: () => focus, addEventListener: on("doc:") };
  const win = { addEventListener: on("win:") };
  const fire = (k) => (handlers[k] || []).forEach((f) => f());
  let toggles = 0;
  const cls = new Set();
  const root = { classList: { contains: (c) => cls.has(c), toggle: (c, v) => (toggles++, v ? cls.add(c) : cls.delete(c)) } };
  startRest(root, { idleMs: 1000, win, doc });
  assert.equal(cls.has("mirage-rest"), false, "Start: aktiv, läuft");
  assert.equal(toggles, 0, "kein Umschalten ohne Wechsel");

  // viele Mausbewegungen: kein einziges Umschalten
  for (let i = 0; i < 50; i++) { now += 10; fire("doc:pointermove"); }
  assert.equal(toggles, 0);

  // Frist ohne Eingabe → ruht (der Wecker sieht nach, Eingaben dazwischen verschieben ihn)
  now += 1000;
  runTimers();
  now += 400;
  runTimers();
  assert.equal(cls.has("mirage-rest"), true, "nach der Frist ruht sie");
  assert.equal(toggles, 1);

  // eine Bewegung weckt sofort
  now += 5;
  fire("doc:pointermove");
  assert.equal(cls.has("mirage-rest"), false, "Bewegung weckt");
  assert.equal(toggles, 2);

  // anderes Fenster aktiv → ruht sofort; Bewegungen über dem inaktiven Fenster wecken nicht
  focus = false;
  fire("win:blur");
  assert.equal(cls.has("mirage-rest"), true);
  fire("doc:pointermove");
  assert.equal(cls.has("mirage-rest"), true, "inaktives Fenster bleibt ruhig");
  // zurückgeholt → läuft
  focus = true;
  fire("win:focus");
  assert.equal(cls.has("mirage-rest"), false);
}

console.log("rest: ok");
