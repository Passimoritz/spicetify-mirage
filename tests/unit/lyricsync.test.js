// node tests/unit/lyricsync.test.js
// Künstliche Analysen: Schlagzeug auf jedem Schlag (rauschig, ohne Tonhöhe), Gesang auf jedem Wort
// (klare Tonhöhe), dazwischen leise Füll-Segmente wie in echten Spotify-Analysen (4–8 je Sekunde).
const assert = require("assert");
const { load } = require("./load.js");
const { estimateSync, applySync, undoSync, speechOnsets } = load("lyricsync.js");

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

// ---- Sicherer Abgleich (Takt-Raster, Sprechgesang, Reichweite, mehrere Quellen einig)
const P = 500;
const powerChord = () => Array.from({ length: 12 }, (_, i) => (i === 0 ? 1 : i === 7 ? 0.9 : 0.15));
const speechChroma = () => Array.from({ length: 12 }, () => 0.8);
const flatC = () => Array.from({ length: 12 }, () => 0.85);
const tonalC = () => Array.from({ length: 12 }, (_, i) => (i === 4 ? 1 : 0.12));
// Ereignisse → Segmente wie bei Spotify (mit Klangfarbe b/f/k), dazwischen leise Füll-Segmente
function toSegs(ev, r, dur) {
  const segs = [];
  for (const e of ev) {
    segs.push({ t: (e.t - 50) / 1000, l: -30, p: flatC(), f: 0, b: 0, k: 0 });
    segs.push({ t: e.t / 1000, l: -30 + e.jump, p: e.p, f: e.f, b: e.b || 0, k: e.k || 0 });
  }
  for (let t = 0; t < dur; t += 150 + r() * 60) segs.push({ t: t / 1000, l: -29.5 + r() * 1.2, p: flatC(), f: 5, b: 0, k: 0 });
  return segs.sort((a, b) => a.t - b.t);
}
// Tonale Gitarre auf jedem Schlag; Gesang kurz nach dem Schlag; ein lauter Akzent genau einen Schlag nach jedem
// Zeilenanfang. Die Zeilen sind RICHTIG – um einen Schlag verschoben träfen sie die Akzente aber noch besser.
function accentSong(seed, accent = 12) {
  const r = rng(seed), dur = 200000, heads = [], ev = [];
  for (let t = 12000; t < dur - 8000; t += P * (6 + Math.floor(r() * 3))) heads.push(t + 120);
  for (let t = 2000; t < dur; t += P) ev.push({ t, jump: 7, p: tonalC(), f: -5 });
  for (const t of heads) ev.push({ t, jump: 9, p: tonalC(), f: -10 }, { t: t + P, jump: accent, p: tonalC(), f: -8 });
  return { lines: heads.map((t, i) => ({ t, text: "Zeile " + i })), segs: toSegs(ev, r, dur) };
}
// Sprechgesang (kaum Tonhöhe, etwas Rauschen, mittlere Helligkeit) über lauten, hellen Gitarren auf jedem Schlag;
// die Zeilen beginnen auf dem Offbeat. gf = Flachheit der Gitarren (25 verzerrt/rauschig, 10 eher sauber)
function spokenSong(seed, gf = 25) {
  const r = rng(seed), dur = 200000, lines = [], ev = [];
  for (let t = 12000 + P / 2; t < dur - 8000; t += P * (6 + Math.floor(r() * 3))) {
    const words = [];
    let w = t;
    for (let k = 0; k < 5 + Math.floor(r() * 4); k++) {
      words.push(w);
      w += 170 + r() * 150;
    }
    lines.push({ t, text: "Zeile " + t, words });
  }
  for (let t = 2000; t < dur; t += P) ev.push({ t, jump: 8 + r() * 2, p: powerChord(), f: gf, b: 60, k: 40 });
  for (const l of lines) for (const w of l.words) ev.push({ t: w + (r() - 0.5) * 40, jump: 8 + r() * 3, p: speechChroma(), f: 15, b: 10, k: 5 });
  return { lines: lines.map((l) => ({ t: l.t, text: l.text })), segs: toSegs(ev, r, dur) };
}
const moved = (lines, d) => lines.map((l) => ({ ...l, t: l.t + d }));

// 9. Takt-Raster: ohne Schlagabstand würde der Abgleich richtige Zeilen um einen Schlag verschieben,
//    mit Schlagabstand erkennt er den Kamm und lässt sie, wie sie sind
for (const acc of [11, 12, 13]) {
  const s = accentSong(1, acc);
  const blind = estimateSync(s.lines, s.segs);
  assert.ok(blind.apply && Math.abs(blind.off - P) <= 20, "ohne Schlagabstand: ein Schlag daneben (Ausgangslage) " + JSON.stringify(blind));
  const r = estimateSync(s.lines, s.segs, { beat: P });
  assert.equal(r.apply, false, "mit Schlagabstand: " + JSON.stringify(r));
  assert.equal(r.why, "beat");
}
// 10. Takt-Raster blockiert keine echten Verschiebungen (Schlagzeug auf jedem Schlag, 400 ms bzw. 250 ms)
{
  const s = song({ seed: 2 });
  const r = estimateSync(lineOnly(shift(s.lines, (t) => t + 400)), s.segs, { beat: P });
  assert.equal(r.apply, true, "400 ms mit Schlagabstand: " + JSON.stringify(r));
  assert.ok(Math.abs(r.off + 400) <= 20);
  const s7 = song({ seed: 7 });
  const r7 = estimateSync(lineOnly(shift(s7.lines, (t) => t - 250)), s7.segs, { beat: P });
  assert.equal(r7.apply, true, "halber Schlag, aber eindeutig: " + JSON.stringify(r7));
  assert.ok(Math.abs(r7.off - 250) <= 20);
}
// 11. Sprechgesang über verzerrten Gitarren: richtige Zeilen bleiben, verschobene werden richtig zurückgeholt
for (const seed of [1, 2, 3]) {
  const s = spokenSong(seed);
  assert.equal(estimateSync(s.lines, s.segs, { beat: P }).apply, false, "Sprechgesang, richtig");
  for (const d of [400, -300]) {
    const r = estimateSync(moved(s.lines, d), s.segs, { beat: P });
    assert.equal(r.apply, true, `Sprechgesang ${d} ms: ` + JSON.stringify(r));
    assert.ok(Math.abs(r.off + d) <= 30, `Sprechgesang ${d} ms → ${r.off}`);
  }
}
// 12. Sprechgesang über sauberen, tonalen Gitarren: die Gitarren ziehen aufs Raster – dann lieber gar nichts als
//     eine falsche Verschiebung (falls doch übernommen, dann nur die richtige)
for (const seed of [1, 2, 3]) {
  const s = spokenSong(seed, 10);
  for (const d of [0, 400, -300]) {
    const r = estimateSync(moved(s.lines, d), s.segs, { beat: P });
    assert.ok(!r.apply || Math.abs(r.off + d) <= 30, `saubere Gitarren ${seed}/${d}: ` + JSON.stringify(r));
  }
}
// 13. Reichweite: bis ±1 s normal, bis ±2 s nur bei sehr klarem Gipfel, weiter nie – und nie ein Fund am Rand
{
  for (const seed of [1, 2, 3]) {
    const s = song({ seed });
    const r = estimateSync(lineOnly(shift(s.lines, (t) => t + 1500)), s.segs, { beat: P });
    assert.ok(!r.apply || Math.abs(r.off + 1500) <= 20, "1,5 s: " + JSON.stringify(r));
    const far = estimateSync(lineOnly(shift(s.lines, (t) => t + 2500)), s.segs, { beat: P });
    assert.equal(far.apply, false, "2,5 s: " + JSON.stringify(far));
    // halber Gesang: für mehr als 1 s nicht sicher genug
    const half = song({ seed, vocals: 0.5 });
    assert.equal(estimateSync(lineOnly(shift(half.lines, (t) => t + 1500)), half.segs, { beat: P }).why, "too-far");
  }
}
// 14. Mehrere Quellen einig: kein Abgleich am Klang
{
  const s = song({ seed: 1 });
  const r = estimateSync(lineOnly(shift(s.lines, (t) => t + 400)), s.segs, { agree: 2 });
  assert.equal(r.apply, false);
  assert.equal(r.why, "agreed");
  assert.equal(estimateSync(lineOnly(shift(s.lines, (t) => t + 400)), s.segs, { agree: 1 }).apply, true);
}
// 15. Sprach-Melder: flacher Anstieg bei mittlerer Helligkeit zählt, helle harte Schläge (Becken, Snare) nicht
{
  const segs = [], r = rng(3);
  for (let i = 0; i < 200; i++) segs.push({ t: i * 0.2, l: -29, p: flatC(), f: r() * 20, b: (r() - 0.5) * 40, k: (r() - 0.5) * 20 });
  segs.push({ t: 50.0, l: -22, p: speechChroma(), f: 12, b: 5, k: 3 });
  segs.push({ t: 51.0, l: -20, p: flatC(), f: 60, b: 120, k: 80 });
  segs.sort((a, b) => a.t - b.t);
  const ts = speechOnsets(segs).map((x) => x.t);
  assert.ok(ts.includes(50000), "Sprache erkannt");
  assert.ok(!ts.includes(51000), "Becken/Snare nicht");
}
// 16. undoSync macht applySync rückgängig (auch gestreckt, mit Wortzeiten)
{
  const s = song({ seed: 5 });
  const a = clone(s.lines), b = clone(s.lines);
  applySync(b, { off: 330, scale: 1.015 });
  undoSync(b, { off: 330, scale: 1.015 });
  assert.ok(err(a, b) <= 1, "Zeilen zurück: " + err(a, b));
  assert.ok(Math.abs(a[4].words[2].t - b[4].words[2].t) <= 1, "Wörter zurück");
}
console.log("lyricsync: ok");
