// node tests/unit/steady.test.js
const assert = require("assert");
const { load } = require("./load.js");
const { createSteadyClock, createBeatClock, glideCue, isJump, createJumpFade } = load("steady.js");
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} ≠ ${b}`);

// Bewegungsuhr: läuft normal mit, ein Sprung (Spulen 30 s zurück) geht im bisherigen Tempo weiter
{
  const c = createSteadyClock();
  let now = 0, x = 50, v = 0;
  for (let i = 0; i < 60; i++) v = c((x += 0.016 * 1.2), (now += 16));
  near(v, x, 1e-6, "ohne Sprung = Rohwert");
  const before = v;
  v = c((x -= 30), (now += 16));
  near(v - before, 0.016 * 1.2, 0.01, "Sprung zurück: ein normaler Schritt");
  const after = v;
  v = c((x += 0.016 * 1.2), (now += 16));
  near(v - after, 0.016 * 1.2, 1e-6, "danach wieder im Gleichschritt");
  assert.equal(c(x + 5, now), v, "gleiches Bild: gleicher Wert, kein zweiter Schritt");
  // Pause: steht
  const p = c(x, (now += 16));
  near(c(x, (now += 16)), p, 1e-9, "Pause: steht");
}

// Schlag-Uhr: Sprung wird zum Versatz, der auf ganze Takte gleitet – die Schlagphase stimmt danach wieder
{
  const c = createBeatClock(4, 0.3);
  let now = 0, x = 100, v = 0;
  for (let i = 0; i < 30; i++) v = c((x += 0.032), (now += 16));
  near(v, x, 1e-9, "ohne Sprung = Rohwert");
  const before = v;
  v = c((x = 37.3), (now += 16));
  near(v - before, 0.032, 0.01, "Sprung: kein Satz im Bild");
  let maxStep = 0, last = v;
  for (let i = 0; i < 150; i++) {
    v = c((x += 0.032), (now += 16));
    maxStep = Math.max(maxStep, v - last);
    last = v;
  }
  const off = v - x;
  near(off, Math.round(off / 4) * 4, 1e-6, "nach 2,4 s: Versatz in ganzen Takten");
  assert.ok(maxStep < 0.6, "Aufholen ohne Sprung: " + maxStep);
}

// Sprung erkennen
assert.equal(isJump(10.016, 10, 0.016), false);
assert.equal(isJump(9.9, 10, 0.016), false, "Nachjustieren der Uhr");
assert.equal(isJump(40, 10, 0.016), true, "vorwärts gespult");
assert.equal(isJump(0, 80, 0.016), true, "Songwechsel / an den Anfang");
assert.equal(isJump(5, NaN, 0.016), false);

// Look gleitet: Zahlen, Licht blendet über, Farbkorrektur in groben Stufen
{
  const a = { I: 1.2, speed: 1.2, spot: "beams", spot2: "beams", sx: 1, grade: { sat: 1.2, con: 1, warm: 0, hue: 0, th: 350, tk: 0.3, lum: 0, sh: 0 } };
  const b = { I: 0.6, speed: 0.4, spot: "wash", spot2: "wash", sx: 1, grade: { sat: 0.8, con: 1, warm: 0, hue: 0, th: 10, tk: 0.3, lum: 0, sh: 0 }, kind: "break" };
  const m = glideCue(a, b, 0.5);
  near(m.I, 0.9, 1e-9, "I halb");
  assert.equal(m.kind, "break");
  assert.equal(m.spot, "wash");
  assert.equal(m.spot2, "beams");
  assert.equal(m.sx, 0.5);
  assert.equal(m.grade.th, 0, "Winkel über den kurzen Weg");
  near(m.grade.sat, 1, 1e-9, "Sättigung halb");
  assert.equal(glideCue(a, b, 0.5).grade, m.grade, "unverändert → dasselbe Objekt");
  assert.equal(glideCue(a, b, 1), b, "fertig → neuer Look");
}

// Überblendung: startet beim Sprung, endet nach dur, ein zweiter Sprung startet vom gezeigten Zustand
{
  const f = createJumpFade(0.6);
  const A = { I: 1, spot: "a", sx: 1 }, B = { I: 0, spot: "b", sx: 1 };
  assert.equal(f.apply(A, 0), A);
  f.start(1);
  near(f.apply(B, 1).I, 1, 1e-9, "Start: alter Look");
  near(f.apply(B, 1.3).I, 0.5, 1e-9, "Mitte");
  assert.equal(f.apply(B, 1.7), B, "danach: neuer Look");
}
console.log("steady: ok");
