// node tests/unit/fxenv.test.js
// Bausteine der Bühnenbilder: Hülle (nie ein Einsatz im selben Bild), Begrenzer, Rauschen, Tiefpass, Lichtwisch,
// Teiler der Bildrate und Messung der Bildschirmrate.
const assert = require("assert");
const { load } = require("./load.js");
const { envAR, slew, vnoise, lowpass, lowpassHue, wipeAt, wipeDur, fpsDivisor, refreshFrom, addStops, ATK_MIN } = load("fxenv.js");

// ---- Hülle: 0 am Anfang, mindestens 80 ms Anstieg, weich aus am Ende
assert.equal(envAR(0), 0);
assert.equal(envAR(-1), 0);
assert.ok(envAR(1 / 60) < 0.15, "im ersten Bild (60 Bilder/s) höchstens ein Hauch");
assert.ok(envAR(ATK_MIN) > 0.99, "nach dem Anstieg voll");
assert.ok(envAR(0.01, Infinity, 0.001) < 0.1, "kürzerer Anstieg als 80 ms wird nicht angenommen");
assert.ok(Math.abs(envAR(1, 2, 0.08, 0.5) - 1) < 1e-9 && envAR(2, 2) === 0, "hält, dann aus");
for (let a = 0; a < 1; a += 0.01) assert.ok(envAR(a + 0.01) >= envAR(a) - 1e-12, "steigt stetig");

// ---- Begrenzer: ein Sprung 0 → 1 braucht mindestens 80 ms, fällt weich
{
  const s = { v: 0 };
  let n = 0;
  while (slew(s, 1, 1 / 60) < 0.999 && n < 100) n++;
  assert.ok((n + 1) / 60 >= ATK_MIN - 1e-9, `Anstieg in ${(n + 1) / 60} s`);
  const v = s.v;
  slew(s, 0, 1 / 60);
  assert.ok(s.v < v && s.v > 0.5, "fällt weich");
  assert.equal(slew({ v: 0.5 }, 0.2, 0.2, 0.08, 0.12) > 0.2, true);
}

// ---- Rauschen: fest, zusammenhängend (kleine Schritte bei kleinen Zeitschritten), 0..1
for (let x = 0; x < 20; x += 0.013) {
  const a = vnoise(x, 3), b = vnoise(x + 0.013, 3);
  assert.ok(a >= 0 && a <= 1);
  assert.ok(Math.abs(a - b) < 0.05, "gleitet");
}
assert.equal(vnoise(4.2, 1), vnoise(4.2, 1));

// ---- Tiefpass und Farbton über 0/360
assert.ok(Math.abs(lowpass(0, 1, 1, 1) - (1 - Math.exp(-1))) < 1e-9);
{
  const h = lowpassHue(350, 10, 10, 1);
  assert.ok(h < 15 || h > 355, "kürzester Weg über 0");
  const h2 = lowpassHue(350, 10, 0.1, 1);
  assert.ok(h2 > 350 || h2 < 1, `kleiner Schritt in Richtung 10 (${h2})`);
}

// ---- Lichtwisch: gleitet an/aus, blendet am Anfang/Ende aus, dauert ≥ 0,8 s und zwei Schläge
assert.equal(wipeAt(0).alpha, 0);
assert.equal(wipeAt(1).alpha, 0);
assert.ok(wipeAt(0.5).alpha === 1 && Math.abs(wipeAt(0.5).pos - 0.5) < 1e-9);
assert.ok(wipeAt(0.02).pos < 0.002 && wipeAt(0.98).pos > 0.998, "ruhiger Anfang und ruhiges Ende");
{
  // größter Sprung je Bild (60 Bilder/s, 1920 px, 130 % der Breite): deutlich unter den alten ~90 px
  const d = wipeDur(60 / 128), n = Math.round(d * 60);
  let worst = 0;
  for (let i = 1; i <= n; i++) worst = Math.max(worst, (wipeAt(i / n).pos - wipeAt((i - 1) / n).pos) * 1920 * 1.3);
  assert.ok(worst < 75, `größter Schritt ${worst.toFixed(1)} px`);
}
assert.equal(wipeDur(0.25), 0.8);
assert.equal(wipeDur(0.5), 1);

// ---- Teiler der Bildrate
assert.equal(fpsDivisor(60, 60), 1);
assert.equal(fpsDivisor(120, 60), 2);
assert.equal(fpsDivisor(144, 60), 2, "144 Hz → 72 Bilder/s statt Wechsel aus 2 und 3");
assert.equal(fpsDivisor(75, 60), 1, "75 Hz → jedes Bild statt ~37");
assert.equal(fpsDivisor(165, 60), 3);
assert.equal(fpsDivisor(60, 30), 2);
assert.equal(fpsDivisor(144, 30), 4);
assert.equal(fpsDivisor(50, 60), 1);
assert.equal(fpsDivisor(144, 0), 1);
for (const hz of [48, 50, 60, 75, 90, 100, 120, 144, 165, 240]) {
  for (const cap of [30, 60]) {
    const fps = hz / fpsDivisor(hz, cap);
    assert.ok(fps <= cap * 1.25 + 1e-9 && (fps >= cap * 0.5 || hz < cap), `${hz} Hz / ${cap}: ${fps}`);
  }
}

// ---- Bildschirmrate aus den Abständen (mit Ausreißern)
assert.equal(refreshFrom([16.6, 16.7, 16.8, 16.6, 16.7, 33.4, 16.6, 16.7, 16.7, 16.6, 16.7, 200]), 60);
assert.equal(refreshFrom(Array(20).fill(6.94)), 144);
assert.equal(refreshFrom([16, 17]), 0, "zu wenige Abstände");

// ---- Verläufe mit vielen Stufen
{
  const stops = [];
  addStops({ addColorStop: (u, c) => stops.push([u, c]) }, [255, 0, 0], 0.5, (u) => 1 - u, 9, (c, a) => a);
  assert.equal(stops.length, 9);
  assert.equal(stops[0][1], 0.5);
  assert.equal(stops[8][1], 0);
}

console.log("fxenv: ok");
