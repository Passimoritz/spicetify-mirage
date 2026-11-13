// node tests/unit/lyricsync.test.js
// Künstliche Analysen: Schlagzeug auf jedem Schlag (rauschig, ohne Tonhöhe), Gesang auf jedem Wort
// (klare Tonhöhe), dazwischen leise Füll-Segmente wie in echten Spotify-Analysen (4–8 je Sekunde).
const assert = require("assert");
const { load } = require("./load.js");
const { estimateSync, applySync } = load("lyricsync.js");

// fester Zufall, damit jeder Lauf gleich ist
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
// Song: wahre Zeilen (mit Wörtern) und die Analyse dazu
function song({ seed = 1, dur = 200000, vocals = 1, drums = true, randomVocals = false } = {}) {
  const r = rng(seed), lines = [], ev = [];
  for (let t = 12000; t < dur - 8000; t += 3300 + r() * 900) {
    const n = 4 + Math.floor(r() * 4), words = [];
    let w = t;
    for (let k = 0; k < n; k++) {
      words.push({ t: Math.round(w), d: 280, text: "la" + k });
      w += 280 + r() * 200;
    }
    lines.push({ t: words[0].t, text: words.map((x) => x.text).join(" "), words });
  }
  const tonal = () => Array.from({ length: 12 }, (_, i) => (i === 4 ? 1 : 0.12));
  const flat = () => Array.from({ length: 12 }, () => 0.85);
  if (randomVocals) for (let t = 5000; t < dur; t += 200 + r() * 600) ev.push({ t, jump: 9 + r() * 3, p: tonal(), f: -10 });
  else for (const l of lines) for (const w of l.words) if (r() < vocals) ev.push({ t: w.t + (r() - 0.5) * 50, jump: 9 + r() * 3, p: tonal(), f: -10 });
  if (drums) for (let t = 2000; t < dur; t += 500) ev.push({ t, jump: 6 + r() * 2, p: flat(), f: 40 });
  const segs = [];
  for (const e of ev) {
    segs.push({ t: (e.t - 50) / 1000, l: -30, p: flat(), f: 0 });
    segs.push({ t: e.t / 1000, l: -30 + e.jump, p: e.p, f: e.f });
  }
  for (let t = 0; t < dur; t += 150 + r() * 60) segs.push({ t: t / 1000, l: -29.5 + r() * 1.2, p: flat(), f: 5 });
  segs.sort((a, b) => a.t - b.t);
  return { lines, segs };
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const shift = (lines, f) => clone(lines).map((l) => ({ ...l, t: f(l.t), words: l.words.map((w) => ({ ...w, t: f(w.t) })) }));
const lineOnly = (lines) => lines.map((l) => ({ t: l.t, text: l.text }));
const err = (a, b) => a.reduce((n, l, i) => n + Math.abs(l.t - b[i].t), 0) / a.length;

// 1. richtiger Text bleibt, wie er ist
{
  const s = song({ seed: 3 });
  const r = estimateSync(lineOnly(s.lines), s.segs);
  assert.equal(r.apply, false, "richtiger Text: " + JSON.stringify(r));
}
// 2. 400 ms zu spät → um 400 ms nach vorn
for (const seed of [1, 2, 5]) {
  const s = song({ seed });
  const late = lineOnly(shift(s.lines, (t) => t + 400));
  const r = estimateSync(late, s.segs);
  assert.equal(r.apply, true, "400 ms zu spät: " + JSON.stringify(r));
  assert.equal(r.scale, 1);
  assert.ok(Math.abs(r.off + 400) <= 20, "Versatz " + r.off);
  applySync(late, r);
  assert.ok(err(late, s.lines) < 30, "danach im Takt: " + err(late, s.lines));
}
// 3. 250 ms zu früh, mit Wortzeiten (NetEase/AMLL): Wörter wandern mit
{
  const s = song({ seed: 7 });
  const early = shift(s.lines, (t) => t - 250);
  const r = estimateSync(early, s.segs);
  assert.equal(r.apply, true, "250 ms zu früh: " + JSON.stringify(r));
  assert.ok(Math.abs(r.off - 250) <= 20, "Versatz " + r.off);
  applySync(early, r);
  assert.ok(Math.abs(early[3].words[2].t - s.lines[3].words[2].t) < 30, "Wortzeit mitgezogen");
}
// 4. gestreckt: der Text läuft 2 % zu schnell (andere Abspielgeschwindigkeit)
for (const seed of [4, 9]) {
  const s = song({ seed });
  const fast = lineOnly(shift(s.lines, (t) => Math.round(t / 1.02)));
  const r = estimateSync(fast, s.segs);
  assert.equal(r.apply, true, "gestreckt: " + JSON.stringify(r));
  assert.ok(Math.abs(r.scale - 1.02) <= 0.002, "Streckung " + r.scale);
  applySync(fast, r);
  assert.ok(err(fast, s.lines) < 40, "danach im Takt: " + err(fast, s.lines));
}
// 5. gestreckt und versetzt (Radio-Edit mit anderem Intro, leicht anderes Tempo)
{
  const s = song({ seed: 11 });
  const both = lineOnly(shift(s.lines, (t) => Math.round(t / 1.015 + 300)));
  const r = estimateSync(both, s.segs);
  assert.equal(r.apply, true, "versetzt + gestreckt: " + JSON.stringify(r));
  applySync(both, r);
  assert.ok(err(both, s.lines) < 40, "danach im Takt: " + err(both, s.lines));
}
// 6. nur die Hälfte der Wörter hat einen erkennbaren Einsatz: reicht trotzdem
{
  const s = song({ seed: 12, vocals: 0.5 });
  const r = estimateSync(lineOnly(shift(s.lines, (t) => t + 400)), s.segs);
  assert.equal(r.apply, true, "halber Gesang: " + JSON.stringify(r));
  assert.ok(Math.abs(r.off + 400) <= 30);
}
// 7. unsicher → nichts tun: Gesang passt zu keinem Text, nur Schlagzeug, zu wenig Zeilen, keine Analyse
{
  const s = song({ seed: 13 }), other = song({ seed: 14, randomVocals: true });
  assert.equal(estimateSync(lineOnly(shift(s.lines, (t) => t + 400)), other.segs).apply, false, "zufälliger Gesang");
  const dr = song({ seed: 15, vocals: 0 });
  assert.equal(estimateSync(lineOnly(shift(s.lines, (t) => t + 400)), dr.segs).apply, false, "nur Schlagzeug");
  assert.equal(estimateSync(lineOnly(s.lines.slice(0, 5)), s.segs).why, "few-lines");
  assert.equal(estimateSync(lineOnly(s.lines), []).why, "few-onsets");
}
// 8. kleine Abweichung (30 ms) ist kein Grund, etwas zu verschieben
{
  const s = song({ seed: 16 });
  assert.equal(estimateSync(lineOnly(shift(s.lines, (t) => t + 30)), s.segs).apply, false);
}
console.log("lyricsync: ok");
