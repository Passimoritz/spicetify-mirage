// node tests/unit/crowd.test.js
// Was die Menge tut (crowd.js): folgt sie der Musik? Springen im Drop, Wiegen in der Ballade, Hände hoch im Refrain,
// Feuerzeuge und Handys in langsamen, leisen Songs, in die Knie vor dem Drop – und im Saal (Sitzplätze) bleibt sie sitzen.
const assert = require("assert");
const { load } = require("./load.js");
const { dance, jumps, armsUp, createCrowdMind, MOVES } = load("crowd.js");

const px = (o) => ({ key: "edm", kind: "verse", energy: 0.7, drop: 0, build: 0, low: 0, crowd: 1, mood: "happy", ...o });

// ---- Drop: alle, die tanzen, springen; vorher in die Knie
{
  const D = dance(px({ kind: "drop", drop: 0.9 }), 0.95, false, 128);
  assert.equal(D.style, "jump");
  assert.equal(D.jump, 1);
  // wer in Stimmung ist, springt im Drop sicher (h = fester Zufall der Person)
  const n = Array.from({ length: 100 }, (_, i) => jumps(D, 0.9, i / 100, px({ drop: 0.9 }))).filter(Boolean).length;
  assert.ok(n > 90, "im Drop springt fast jeder: " + n);
  const pre = dance(px({ kind: "pre", build: 0.8, tension: 0.9 }), 0.7, false, 128);
  assert.equal(pre.jump, 0, "im Aufbau springt niemand");
  assert.ok(pre.crouch > 0.8, "vor dem Drop in die Knie");
  assert.ok(pre.clap > 0.5 && pre.style === "clap", "im Aufbau klatschen sie mit");
  assert.equal(dance(px({ kind: "pre", blackout: true, build: 0.7 }), 0.7, false).crouch, 1, "auf dem dunklen Schlag ganz unten");
}

// ---- Ballade: wiegen, nie springen; im Refrain Feuerzeuge/Handys (Lichtermeer) statt Fäuste
{
  const verse = dance(px({ key: "ballad", kind: "verse", mood: "tender", energy: 0.4 }), 0.4, false, 72);
  assert.equal(verse.style, "sway");
  assert.equal(verse.jump, 0);
  const ch = dance(px({ key: "ballad", kind: "chorus", mood: "tender", energy: 0.6 }), 0.6, false, 72);
  assert.ok(ch.sea >= 0.8, "Refrain einer Ballade: Lichtermeer " + ch.sea);
  assert.ok(ch.hands <= 0.1, "… statt Händen im V");
  assert.equal(ch.jump, 0);
  // auch ein langsamer, trauriger Pop-Song (nicht nur Balladen-Genres) bekommt Lichter – ein schneller nicht
  assert.ok(dance(px({ key: "pop", kind: "chorus", mood: "sad" }), 0.6, false, 84).sea > 0, "langsam und traurig: Lichter");
  assert.equal(dance(px({ key: "pop", kind: "chorus", mood: "sad" }), 0.6, false, 128).sea, 0, "schnell: keine Lichter");
  assert.equal(dance(px({ key: "pop", kind: "chorus", mood: "euphoric" }), 0.6, false, 84).sea, 0, "fröhlich: keine Lichter");
  assert.equal(dance(px({ key: "ballad", kind: "verse", mood: "tender" }), 0.6, false, 72).sea, 0, "Strophe: noch keine Lichter");
}

// ---- Refrain: Hände hoch, je mehr Stimmung, desto mehr; im Finale fast alle; im Intro/Break nicht
{
  const lo = dance(px({ key: "pop", kind: "chorus" }), 0.5, false, 120), hi = dance(px({ key: "pop", kind: "chorus" }), 0.9, false, 120);
  assert.ok(hi.hands > lo.hands && hi.hands >= 0.6, `Hände hoch mit der Stimmung (${lo.hands} → ${hi.hands})`);
  assert.ok(dance(px({ key: "pop", kind: "chorus", finale: true }), 0.5, false, 120).hands >= 0.6, "Finale: fast alle Hände oben");
  for (const kind of ["intro", "break", "outro", "verse"]) assert.equal(dance(px({ kind }), 0.9, false, 120).hands, 0, kind + ": keine Hände im V");
  assert.equal(armsUp(dance(px({ kind: "intro" }), 0.6, false), 0.6, 0.2), 0, "Intro: Hände bleiben unten");
  assert.equal(armsUp(dance(px({ kind: "chorus" }), 0.6, false), 0.6, 0.2), 1, "Refrain: Hände hoch (gleiche Stimmung)");
}

// ---- ruhige Teile: niemand springt, der Groove bleibt im Körper
for (const kind of ["intro", "break", "outro"]) {
  const D = dance(px({ kind }), 0.9, false, 128);
  assert.equal(D.jump, 0, kind + ": niemand springt");
  assert.notEqual(D.style, "jump");
}

// ---- Saal (Sitzplätze): wiegen, keine Hände im V, kein Lichtermeer
{
  const D = dance(px({ key: "ballad", kind: "chorus", mood: "tender", finale: true }), 0.9, true, 72);
  assert.equal(D.style, "sway");
  assert.equal(D.hands, 0);
  assert.equal(D.sea, 0);
}

// ---- Stimmung: steigt schnell, fällt langsam, im Drop sofort oben; folgt dem Gefühl des Teils (crowd)
{
  const m = createCrowdMind();
  for (let i = 0; i < 60; i++) m.mood(px({ energy: 0.2 }), 1 / 60);
  const low = m.x;
  m.mood(px({ energy: 0.9, drop: 1, dropHit: true }), 1 / 60);
  assert.ok(m.x >= 0.9 && low < 0.3, "Drop: sofort oben");
  const sad = createCrowdMind(), happy = createCrowdMind();
  for (let i = 0; i < 300; i++) {
    sad.mood(px({ energy: 0.8, crowd: 0.6 }), 1 / 60);
    happy.mood(px({ energy: 0.8, crowd: 1.15 }), 1 / 60);
  }
  assert.ok(happy.x > sad.x + 0.15, "eine traurige Stelle bewegt die Menge weniger");
}

// ---- jede Spielart hat eine Bewegung, die venue.js zeichnen kann
for (const [k, mv] of Object.entries(MOVES)) assert.ok(["jump", "pump", "bounce", "bang", "clap", "skank", "nod", "wave", "sway"].includes(mv), k + ": " + mv);

console.log("crowd: ok");
