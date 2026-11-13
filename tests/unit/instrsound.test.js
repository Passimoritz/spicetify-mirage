// node tests/unit/instrsound.test.js
// Künstliche Analyse-Segmente (wie audio.js sie formt: t, l, p[12], b, f, k). Geprüft wird, dass klare Muster
// erkannt werden und typische Verwechslungen (Flächen, Schlagzeug, kurze Stellen) NICHT.
const assert = require("assert");
const { load } = require("./load.js");
const { heardMoments, HEARD_STEP } = load("instrsound.js");

// Zufall mit festem Startwert: jeder Lauf gleich
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const jitter = (v, amt) => v + (rnd() - 0.5) * 2 * amt;

// Tonhöhen-Vektor: die genannten Tonklassen stark, der Rest leise
const chroma = (pcs, rest = 0.08) => Array.from({ length: 12 }, (_, i) => (pcs.includes(i) ? (i === pcs[0] ? 1 : 0.8) : jitter(rest, 0.04)));
const C = [0, 4, 7], F = [5, 9, 0], G = [7, 11, 2], Am = [9, 0, 4];

// Abschnitte: [Dauer s, Art]. Jede Art erzeugt ihre Segmente.
function song(parts) {
  const segs = [];
  let t = 0;
  for (const [len, kind] of parts) {
    const end = t + len;
    let i = 0;
    while (t < end) {
      if (kind === "piano") {
        // angeschlagene Akkorde und Einzeltöne, ~4 Einsätze je Sekunde, Harmonie wechselt je Takt
        const chord = [C, F, G, Am][Math.floor(t / 2) % 4];
        const pcs = i % 3 === 0 ? chord : [chord[i % 3]];
        segs.push({ t, l: jitter(-14, 2), p: chroma(pcs), b: jitter(10, 8), f: jitter(-20, 6), k: jitter(40, 10) });
        t += jitter(0.25, 0.05);
      } else if (kind === "band") {
        // Schlagzeug (rauschig, kaum Ton) im Wechsel mit Gesang/Akkorden
        if (i % 2 === 0) segs.push({ t, l: jitter(-6, 1.5), p: Array.from({ length: 12 }, () => jitter(0.75, 0.2)), b: jitter(40, 10), f: jitter(45, 8), k: jitter(70, 10) });
        else segs.push({ t, l: jitter(-8, 1.5), p: chroma([C, F, G][i % 3]), b: jitter(20, 8), f: jitter(0, 8), k: jitter(20, 10) });
        t += jitter(0.2, 0.04);
      } else if (kind === "pad") {
        // lange, stehende Fläche: wenige Einsätze, gleicher Akkord
        segs.push({ t, l: jitter(-16, 1), p: chroma(C), b: jitter(5, 4), f: jitter(-25, 4), k: jitter(-30, 6) });
        t += jitter(1.6, 0.2);
      } else if (kind === "guitar") {
        // laute Quint-Akkorde (E5, A5, D5), rauschiger Klang
        const root = [4, 9, 2][Math.floor(t / 2) % 3];
        segs.push({ t, l: jitter(-5, 1), p: chroma([root, (root + 7) % 12], 0.15), b: jitter(45, 8), f: jitter(30, 8), k: jitter(25, 10) });
        t += jitter(0.3, 0.05);
      } else if (kind === "quiet") {
        // leise Strophe mit Bass und Stimme
        segs.push({ t, l: jitter(-20, 2), p: chroma([[0], [7], [9]][i % 3]), b: jitter(-10, 6), f: jitter(-10, 6), k: jitter(0, 10) });
        t += jitter(0.4, 0.05);
      }
      i++;
    }
  }
  return segs;
}
// Sekunden, in denen ein Instrument erkannt wurde
const secondsOf = (m, kind) => (m[kind] ? m[kind].reduce((n, v) => n + (v > 0 ? HEARD_STEP : 0), 0) : 0);
const at = (m, kind, sec) => m[kind]?.[Math.floor(sec / HEARD_STEP)] || 0;

// 1) Klavier-Intro (20 s), dann Band mit Schlagzeug (40 s): Klavier nur im Intro
{
  const m = heardMoments(song([[20, "piano"], [40, "band"]]));
  assert.ok(m.kinds.includes("piano"), "Klavier-Intro erkannt");
  assert.ok(at(m, "piano", 10) > 0.4, "Pegel mitten im Intro");
  assert.equal(at(m, "piano", 40), 0, "kein Klavier, wenn das Schlagzeug spielt");
  assert.ok(secondsOf(m, "piano") >= 12 && secondsOf(m, "piano") <= 22, "ungefähr die Länge des Intros: " + secondsOf(m, "piano"));
  assert.ok(!m.kinds.includes("guitar"), "keine Gitarre");
}
// 2) Nur Flächen (Streicher/Synth-Pad): zu wenige Einsätze → kein Klavier
{
  const m = heardMoments(song([[60, "pad"]]));
  assert.deepEqual([...m.kinds], [], "Flächen sind kein Klavier");
}
// 3) Nur Band mit Schlagzeug: nichts
{
  const m = heardMoments(song([[60, "band"]]));
  assert.deepEqual([...m.kinds], [], "Band ohne Muster: nichts");
}
// 4) Leise Strophe, dann verzerrte Gitarre im Refrain (20 s)
{
  const m = heardMoments(song([[25, "quiet"], [20, "guitar"], [25, "quiet"]]));
  assert.ok(m.kinds.includes("guitar"), "Power Chords erkannt");
  assert.ok(at(m, "guitar", 35) > 0.4, "Pegel im Refrain");
  assert.equal(at(m, "guitar", 10), 0, "keine Gitarre in der leisen Strophe");
  assert.ok(!m.kinds.includes("piano"), "kein Klavier");
}
// 5) Durchgehend verzerrt (ganzer Song): Gitarre trotzdem erkannt, obwohl sie der Normalfall des Songs ist
{
  const m = heardMoments(song([[60, "guitar"]]));
  assert.ok(m.kinds.includes("guitar"), "durchgehende Gitarre erkannt");
}
// 6) Zu kurz: 4 s Klavier zwischen Band-Teilen zählt nicht (mindestens 6 s am Stück)
{
  const m = heardMoments(song([[30, "band"], [4, "piano"], [30, "band"]]));
  assert.ok(!m.kinds.includes("piano"), "4 s Klavier sind zu kurz");
}
// 7) Nur Stimme und Bass (leise, tonal, ohne Schlagzeug): kein Klavier – zu wenige Akkorde
{
  const m = heardMoments(song([[60, "quiet"]]));
  assert.deepEqual([...m.kinds], [], "Stimme und Bass sind kein Klavier");
}
// 8) Kaputte oder fehlende Daten
{
  assert.deepEqual([...heardMoments(null).kinds], []);
  assert.deepEqual([...heardMoments([]).kinds], []);
  const noPitch = song([[60, "piano"]]).map((s) => ({ ...s, p: [] }));
  assert.deepEqual([...heardMoments(noPitch).kinds], [], "ohne Tonhöhen keine Aussage");
}
console.log("instrsound: ok");
