// node tests/unit/director.test.js
// Lichtregie auf künstlichen Songs mit bekanntem Aufbau (songshapes.js): erkennt sie die Teile, liegen alle
// Wechsel auf einer Eins und der Drop auf seinem Schlag, sind Breaks ruhiger, stimmt das Zeitgefühl
// (halbes Tempo im Trap-Break, doppeltes im Drum-&-Bass-Drop) – und nimmt „Keine Blitze“ alles Blitzende heraus?
const assert = require("assert");
const { load } = require("./load.js");
const { planSong, cue, grade, STYLE, LOOK } = load("director.js");
const { songMap } = load("songmap.js");
const { createShow } = load("show.js");
const { createFlashCap } = load("flashcap.js");
const { shaped } = require("./songshapes.js");

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const SONGS = [["edm", "edm"], ["rock", "rock"], ["ballad", "ballad"], ["trap", "trap"], ["dnb", "dnb"]];
const kinds = (p) => p.parts.map((x) => x.kind);
const partAt = (p, kind, n = 0) => p.parts.filter((x) => x.kind === kind)[n];
const mid = (x) => (x.t0 + x.t1) / 2 + 0.01;

for (const [name, key] of SONGS) {
  const d = shaped(name), M = songMap(d), plan = planSong(d, key);
  assert.ok(plan, name + ": kein Plan");
  // ---- erkannte Teile = gebauter Aufbau (bis auf Aufbau-Takte, die die Regie von langen Strophen abteilt)
  for (const t of d.truth) {
    const c = cue(plan, (t.t0 + t.t1) / 2, {});
    const ok = c.kind === t.kind || (t.kind === "verse" && c.kind === "pre") || (t.kind === "drop" && c.kind === "chorus");
    assert.ok(ok, `${name}: bei ${t.t0.toFixed(1)} s ${t.kind} erwartet, ${c.kind} geplant`);
  }
  // ---- jeder Wechsel auf einer Eins; ein Drop genau auf seinem Schlag
  const bars = d.bars.map((b) => b.t), beats = d.beats.map((b) => b.t);
  for (const p of plan.parts.slice(1)) {
    if (p.drop) {
      assert.ok(beats.some((b) => near(b, p.t0)), `${name}: Drop bei ${p.t0} liegt nicht auf einem Schlag`);
      assert.ok(M.drops.some((t) => near(t, p.t0)), `${name}: Teil bei ${p.t0} ist kein erkannter Drop`);
    } else assert.ok(bars.some((b) => near(b, p.t0)), `${name}: Wechsel bei ${p.t0.toFixed(3)} liegt nicht auf einer Eins`);
  }
  // die erkannten Drops liegen auf der Eins des gebauten Höhepunkts (nicht einen Schlag früher)
  for (const t of M.drops) assert.ok(d.truth.some((x) => near(x.t0, t, 0.01)), `${name}: Drop bei ${t.toFixed(2)} s liegt neben dem Teilanfang`);
  // ---- Bewegungsuhren springen nie (das Licht wird nur langsamer oder schneller), Zeitgefühl hält die Richtung
  let last = cue(plan, 0, {});
  for (let t = 0.01; t < plan.end; t += 0.01) {
    const c = cue(plan, t, {});
    assert.ok(c.mt - last.mt > -1e-9 && c.mt - last.mt < 0.02, `${name}: Bewegungsuhr springt bei ${t.toFixed(2)} s`);
    assert.ok(c.mb - last.mb > -1e-6 && c.mb - last.mb < 0.1, `${name}: Schlag-Uhr springt bei ${t.toFixed(2)} s`);
    last = c;
  }
  // ---- „Keine Blitze“: keine Farbflächen, keine Lichtwand, Riser glüht ruhig statt zu pulsen
  for (let t = 0; t < plan.end; t += 0.05) {
    const c = cue(plan, t, { noFlash: true });
    assert.equal(c.flash, 0, `${name}: Farbfläche trotz „Keine Blitze“ bei ${t.toFixed(2)}`);
    assert.equal(c.wall, 0, `${name}: Lichtwand trotz „Keine Blitze“`);
    assert.ok(near(c.pulse, c.riser), `${name}: Riser pulst trotz „Keine Blitze“`);
  }
  // ---- der Riser pulst höchstens sechsmal pro Sekunde
  let peaks = [], prev = 0, rising = false;
  for (let t = 0; t < plan.end; t += 0.005) {
    const v = cue(plan, t, {}).pulse;
    if (v < prev - 1e-4 && rising) peaks.push(t);
    rising = v > prev + 1e-4;
    prev = v;
  }
  for (const p of peaks) assert.ok(peaks.filter((x) => x >= p && x < p + 1).length <= 7, `${name}: Riser pulst schneller als 6/s`);
}

// ---- EDM: Aufbau → dunkler Schlag → Drop schlägt genau auf seinem Schlag ein; Break ruhiger als der Drop
{
  const d = shaped("edm"), plan = planSong(d, "edm"), drop = partAt(plan, "drop"), brk = partAt(plan, "break", 1);
  assert.deepEqual(kinds(plan), ["intro", "break", "pre", "drop", "break", "pre", "drop", "outro"]);
  const before = cue(plan, drop.t0 - 0.05, {}), on = cue(plan, drop.t0 + 0.001, {}), b = cue(plan, mid(brk), {});
  assert.equal(before.kind, "pre");
  assert.equal(before.dim, 1, "der letzte Schlag vor dem Drop ist dunkel");
  assert.ok(before.riser > 0.9, "der Riser ist am Ende des Aufbaus fast voll");
  assert.equal(cue(plan, drop.t0 - plan.beat * 1.5, {}).dim, 0, "nur der letzte Schlag ist dunkel");
  assert.equal(on.kind, "drop");
  assert.ok(on.I > 1.25 && on.speed > 1.25, "der Drop sitzt sofort – kein Überblenden");
  assert.equal(on.dim, 0);
  assert.ok(on.wipe >= 0 && on.wipe < 0.01, "Lichtwisch startet auf dem Drop");
  assert.ok(on.lift > 0.99, "erster Drop hebt voll an");
  assert.ok(cue(plan, partAt(plan, "drop", 1).t0 + 0.001, {}).lift < 0.7, "zweiter Drop hebt weniger an");
  assert.ok(b.I < on.I * 0.6 && b.speed < on.speed * 0.5 && b.beams < on.beams * 0.4, "Break deutlich ruhiger als der Drop");
  assert.equal(b.flash, 0, "im Break keine Farbflächen");
  assert.ok(b.grade.sat < 1 && b.grade.warm < 0, "Break: entsättigt und kühler");
  // in den letzten Takten wird der Riser dichter: Viertel, dann Achtel, dann Sechzehntel (≤ 6/s)
  const pre = partAt(plan, "pre");
  const count = (a, b2) => {
    let n = 0, p0 = 0, up = false;
    for (let t = a; t < b2; t += 0.002) {
      const v = cue(plan, t, {}).pulse;
      if (v < p0 - 1e-4 && up) n++;
      up = v > p0 + 1e-4;
      p0 = v;
    }
    return n;
  };
  const early = count(pre.t0 + plan.bar, pre.t0 + plan.bar * 2), late = count(pre.t1 - plan.bar, pre.t1 - 0.01);
  assert.ok(late > early, `Riser wird dichter (${early} → ${late} Pulse je Takt)`);
}

// ---- Rock: Strophe → Pre → Refrain mit Lichtwand; Bridge in einer anderen Farbwelt
{
  const plan = planSong(shaped("rock"), "rock");
  assert.deepEqual(kinds(plan), ["intro", "verse", "pre", "chorus", "verse", "pre", "chorus", "bridge", "chorus", "chorus", "outro"]);
  const v = cue(plan, mid(partAt(plan, "verse")), {}), ch = partAt(plan, "chorus"), c = cue(plan, mid(ch), {});
  assert.ok(c.I > v.I * 1.2 && c.beams > v.beams, "Refrain größer als die Strophe");
  assert.ok(v.flash === 0.5 && c.flash === 1, "Strophe nur Einsen, Refrain alle Farbflächen");
  const w = cue(plan, ch.t0 + 0.01, {});
  assert.ok(w.wall > 0.9, "Lichtwand auf der Eins des Refrains");
  assert.ok(cue(plan, ch.t0 + plan.beat * 2, {}).wall < 0.05, "Lichtwand klingt binnen zwei Schlägen ab");
  assert.equal(cue(plan, ch.t0 + 0.01, { lite: true }).wall, 0, "„Leicht“: keine Lichtwand");
  assert.equal(cue(plan, ch.t0 + 0.01, { lite: true }).wipe, -1, "„Leicht“: kein Lichtwisch");
  const br = cue(plan, mid(partAt(plan, "bridge")), {});
  assert.equal(br.grade.hue, 120, "Bridge dreht in eine andere Farbwelt");
  // Farbwechsel auf der Eins: einen Schlag nach dem Refrain-Start ist die neue Farbe da, davor die alte
  assert.ok(cue(plan, ch.t0 - 0.01, {}).grade.sat < cue(plan, ch.t0 + plan.beat, {}).grade.sat);
  // Stärke-Stufen: „Wahnsinn“ spreizt die Teile weiter als „Sanft“
  const soft = cue(plan, mid(ch), { level: 1 }), mad = cue(plan, mid(ch), { level: 5 });
  assert.ok(mad.I > soft.I, "Wahnsinn hebt den Refrain stärker an");
}

// ---- Ballade: warm, langsam, Spot auf den gehaltenen Tönen im Refrain, atmet über zwei Takte
{
  const d = shaped("ballad"), plan = planSong(d, "ballad"), M = songMap(d);
  assert.ok(M.holds.length >= 6, "gehaltene Töne erkannt");
  const h = M.holds[0], c = cue(plan, (h[0] + h[1]) / 2 + 0.6, {});
  assert.ok(c.vox > 0.5, "Spot auf dem gehaltenen Ton");
  assert.equal(cue(plan, (h[0] + h[1]) / 2 + 0.6, { lite: true }).vox, 0, "„Leicht“: kein Spot");
  assert.ok(c.grade.warm > 0.3 && c.speed < 1, "Ballade warm und ruhig");
  const sw = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => cue(plan, d.beats[16 + k].t + 0.001, {}).swell);
  assert.ok(Math.max(...sw) > 0.9 && Math.min(...sw) < 0.1, "Atmen über zwei Takte");
  assert.equal(cue(plan, 20, {}).wall, 0, "Balladen haben keine Lichtwand");
}

// ---- Trap: Break im halben Tempo und ruhiger; Refrain mit 808 und halbem Zeitgefühl
{
  const plan = planSong(shaped("trap"), "trap"), b = cue(plan, mid(partAt(plan, "break")), {}), c = cue(plan, mid(partAt(plan, "chorus", 1)), {});
  assert.equal(b.tf, 0.5, "Break im halben Tempo");
  assert.ok(b.I < c.I && b.speed < c.speed, "Break ruhiger als der Refrain");
  assert.ok(c.boom > 0.5 && c.tf === 0.5, "Trap: 808 und halbes Zeitgefühl");
}

// ---- Drum & Bass: Drop im doppelten Zeitgefühl, Break normal
{
  const plan = planSong(shaped("dnb"), "dnb");
  assert.equal(cue(plan, mid(partAt(plan, "drop")), {}).tf, 2, "Drop im doppelten Tempo");
  assert.equal(cue(plan, mid(partAt(plan, "break")), {}).tf, 1);
}

// ---- Schätzung ohne Abschnitte (estimate.js liefert nur einen): Teile aus der Energie, trotzdem auf der Eins
{
  const d = shaped("rock");
  d.sections = [d.sections[0]];
  const plan = planSong(d, "rock"), bars = d.bars.map((b) => b.t);
  assert.ok(plan.parts.length >= 5, "Teile aus der Energiekurve");
  for (const p of plan.parts.slice(1)) assert.ok(p.drop || bars.some((b) => near(b, p.t0)), "Wechsel auf der Eins");
  assert.ok(kinds(plan).includes("chorus") && kinds(plan).includes("verse"));
}

// ---- jede Spielart hat eine Signatur, jeder Teil einen Look
const all = Object.values(STYLE).flat();
assert.equal(new Set(all).size, all.length, "Spielart doppelt zugeordnet");
for (const k of ["intro", "verse", "pre", "chorus", "drop", "break", "bridge", "outro"]) assert.ok(LOOK[k]);

// ---- Farbkorrektur: neutral = dieselbe Palette, sonst gemerkt (gleiche Eingabe → dasselbe Objekt)
const pal = [[255, 80, 120], [80, 160, 255], [255, 220, 90]];
assert.equal(grade(pal, { sat: 1, con: 1, warm: 0, hue: 0 }), pal);
const g = { sat: 0.6, con: 0.9, warm: -0.3, hue: 0 };
assert.equal(grade(pal, g), grade(pal, { ...g }));
assert.ok(grade(pal, g).every((c) => Math.max(...c) - Math.min(...c) < 200), "entsättigt");

// ---- Bühne: Lichtwand nur mit Blitzen und Freigabe, Wisch/Spot/Pumpen/808 laufen ohne Fehler
function wallCount(st) {
  const show = createShow((c) => c.join(","), createFlashCap());
  let n = 0;
  const grad = { addColorStop() {} };
  const own = { globalAlpha: 1, createRadialGradient: () => grad, createLinearGradient: () => grad, drawImage: (img) => img === "255,240,215" && own.globalAlpha > 0.05 && n++ };
  const ctx = new Proxy(own, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) });
  for (let i = 0; i < 120; i++) {
    const t = i / 60;
    show.drawRig(ctx, { t, dt: 1 / 60, vw: 1920, vh: 1080, cx: 960, cy: 480, bpm: 120, rig: true, flash: true, flashGo: true, noFlash: false, ...st }, { decor: "stands" },
      { key: "rock", beatIdx: Math.floor(t * 2), phase: (t * 2) % 1, low: 0, I: 1, kickEnv: 0.5, snareEnv: 0, hatEnv: 0, energy: 0.9, build: 0, drop: 0, scene: 0,
        wall: Math.exp(-t * 4), wipe: t < 0.5 ? t * 2 : -1, wdir: 1, vox: 0.8, pump: 1, boom: 0.6, swell: 0.5, pulse: 0.5, lift: 1, mb: t * 2, mt: t }, pal, 1);
  }
  return n;
}
assert.ok(wallCount({}) > 0, "Lichtwand zündet");
assert.equal(wallCount({ noFlash: true }), 0, "keine Lichtwand mit „Keine Blitze“");
assert.equal(wallCount({ flash: false }), 0, "keine Lichtwand ohne Blitze");

console.log("director: ok");
