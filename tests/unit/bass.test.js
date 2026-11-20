// node tests/unit/bass.test.js   (BASS_EVAL_PRINT=1 druckt die Tabelle)
// Tiefe Töne im Party-Modus (src/bass.js) und die feine Lage der Hörprobe im Song (sonic.js alignPreview).
// Auf echter Musik: tests/unit/fixtures/bass-eval.json enthält für 24 Hörproben (Testlabor Runde 13, je Gruppe zwei)
// Segmente wie Spotifys (aus dem Ton gerechnet) und das gemessene Tiefband < 120 Hz – keine Hörproben selbst.
const assert = require("assert");
const { load } = require("./load.js");
const B = load("bass.js");
const S = load("sonic.js");
const fx = require("./fixtures/bass-eval.json");

const pearson = (a, b) => {
  const n = Math.min(a.length, b.length);
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) [ma, mb] = [ma + a[i], mb + b[i]];
  [ma, mb] = [ma / n, mb / n];
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) [ab, aa, bb] = [ab + (a[i] - ma) * (b[i] - mb), aa + (a[i] - ma) ** 2, bb + (b[i] - mb) ** 2];
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
};
const pct = (arr, q) => Float32Array.from(arr).sort()[Math.floor(q * (arr.length - 1))];

// ---- auf echter Musik: das Bass-Signal folgt dem Tiefband, die Kick-Hülle (wie bisher) kaum
{
  const rows = [];
  for (const s of fx.songs) {
    const d = { segs: s.segs.map(([t, l, b]) => ({ t, l, b, f: 0, k: 0, p: [] })), beats: [] };
    const prof = { gate: B.gateOf(s.share) };
    const env = B.createBassEnv();
    // Kick wie songmap.js (harter, dunkler Einsatz) ist hier nicht nachgebaut – Vergleich mit der alten Bodenlicht-
    // Quelle: jeder Pegelsprung ≥ 6 dB als Kick (großzügig zugunsten der Kick)
    const kicks = d.segs.filter((x, i) => i && x.l - d.segs[i - 1].l > 6).map((x) => x.t);
    const sig = [], kick = [];
    let ki = 0;
    for (let i = 0; i < s.low.length; i++) {
      const t = s.lowT0 + i / s.lowRate;
      // 50 ms je Schritt wie ein Bild bei 20 fps, zwei Schritte je Messwert
      env.step(B.bassTarget(t - 0.05, d, prof, null).v, 0.05);
      sig.push(env.step(B.bassTarget(t, d, prof, null).v, 0.05).bass);
      while (ki < kicks.length && kicks[ki] <= t) ki++;
      kick.push(ki ? Math.exp(-(t - kicks[ki - 1]) * 7) : 0);
    }
    const hi = pct(s.low, 0.95);
    let miss = 0, strong = 0;
    s.low.forEach((v, i) => v > hi - 8 && (strong++, sig[i] < 0.2 && miss++));
    rows.push({ g: s.group, r: pearson(s.low, sig), rk: pearson(s.low, kick), miss: strong ? miss / strong : 0, mean: sig.reduce((a, b) => a + b, 0) / sig.length });
  }
  const avg = (sel, k) => {
    const v = rows.filter(sel).map((r) => r[k]);
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  const neg = (r) => r.g === "nobass" || r.g === "high", pos = (r) => !neg(r) && r.g !== "lowclass";
  if (process.env.BASS_EVAL_PRINT) for (const r of rows) console.log(r.g.padEnd(10), "r", r.r.toFixed(2), "kick r", r.rk.toFixed(2), "miss", r.miss.toFixed(2), "mean", r.mean.toFixed(2));
  assert.ok(avg(() => true, "r") >= 0.45, "Bass folgt dem Tiefband: r = " + avg(() => true, "r").toFixed(2));
  assert.ok(avg(() => true, "r") >= avg(() => true, "rk") + 0.25, "deutlich besser als die Kick-Hülle");
  assert.ok(avg(pos, "miss") <= 0.15, "kräftiger Bass bleibt kaum unsichtbar: " + avg(pos, "miss").toFixed(2));
  // Songs ohne nennenswerten Bass (Solo-Violine, Klavier, A-cappella …): wenig Bass-Licht
  assert.ok(avg(neg, "mean") < 0.5 * avg(pos, "mean"), "ohne Bass wenig Licht: " + avg(neg, "mean").toFixed(2) + " vs " + avg(pos, "mean").toFixed(2));
  console.log("bass eval: r", avg(() => true, "r").toFixed(2), "(Kick", avg(() => true, "rk").toFixed(2) + ")", "miss", avg(pos, "miss").toFixed(2));
}

// ---- Pforte aus der Hörprobe: Anteil < 150 Hz
assert.strictEqual(B.gateOf(-3), 1);
assert.strictEqual(B.gateOf(-9), 0.5);
assert.strictEqual(B.gateOf(-20), 0);

// ---- Profil aus einem Raster mit Bändern: Bass-lastig vs. ohne Bass
{
  const mk = (lowOff) => {
    const n = 400, G = { bands: true, r: 20, n, loud: new Float32Array(n), low: new Float32Array(n) };
    for (let x = 0; x < n; x++) [G.loud[x], G.low[x]] = [-12 + Math.sin(x / 9), -12 + lowOff + 6 * Math.sin(x / 5)];
    return B.bassProfile(G);
  };
  const a = mk(-2), b = mk(-25);
  assert.ok(a.gate === 1 && b.gate === 0, "Pforte: " + a.gate + " / " + b.gate);
  assert.strictEqual(a.lvl.length, 400);
  assert.ok(Math.max(...a.lvl) === 255 && Math.min(...a.lvl) < 120, "Verlauf je Zelle");
  assert.strictEqual(B.bassProfile({ bands: false, r: 20, n: 400 }), null, "ohne Bänder (Spotify-Raster): kein Profil");
}

// ---- Zielwert: Quellen
{
  const segs = [];
  for (let i = 0; i < 200; i++) segs.push({ t: i * 0.25, l: i % 4 ? -14 : -6, b: i % 4 ? 40 : -20 });
  const d = { segs };
  const loud = B.bassTarget(10.05, d, null, null), quiet = B.bassTarget(10.3, d, null, null);
  assert.ok(loud.v > 0.6 && quiet.v < 0.15 && loud.src === "spotify", "laut+dunkel = Bass: " + JSON.stringify([loud, quiet]));
  assert.ok(Math.abs(loud.v - 0.7) < 0.01, "ohne Hörprobe gedämpft (0,7)");
  // Hörprobe im Song: dort ihr gemessener Verlauf
  const prof = { gate: 1, r: 20, lvl: new Uint8Array(600).fill(255) };
  const al = { off: 20, end: 50 };
  assert.ok(B.bassTarget(35.3, d, prof, al).v > 0.99 && B.bassTarget(35.3, d, prof, al).src === "preview", "Hörprobe gilt in ihrem Ausschnitt");
  assert.ok(B.bassTarget(10.3, d, prof, al).v < 0.15, "außerhalb nicht");
  // Schätzung (Takt geraten): ohne Hörprobe nichts, mit Hörprobe nur ruhiger Charakter
  const est = { ...d, synthetic: true };
  assert.strictEqual(B.bassTarget(10, est, null, null).v, 0);
  const e = B.bassTarget(10, est, { gate: 1 }, null, 0.8, 0);
  assert.ok(e.v > 0.6 && e.v <= 1 && e.src === "estimate");
  assert.strictEqual(B.bassTarget(10, est, { gate: 0 }, null, 0.8, 0).v, 0, "Song ohne Bass: nichts");
  assert.strictEqual(B.bassTarget(10, null, null, null).v, 0);
}

// ---- Glätten: schnell hoch, gemächlich runter, Anschlag bei neuem tiefem Ton
{
  const env = B.createBassEnv();
  let o = env.step(1, 1 / 60);
  assert.ok(o.pulse > 0.9, "Anschlag");
  for (let i = 0; i < 6; i++) o = env.step(1, 1 / 60);
  assert.ok(o.bass > 0.9, "nach 0,1 s fast oben: " + o.bass);
  for (let i = 0; i < 6; i++) o = env.step(0, 1 / 60);
  assert.ok(o.bass > 0.35 && o.bass < 0.6, "nach 0,1 s ohne Bass noch sichtbar, aber fallend: " + o.bass);
  for (let i = 0; i < 60; i++) o = env.step(0, 1 / 60);
  assert.ok(o.bass === 0 && o.pulse < 0.01, "nach 1 s aus");
  // gehaltener Ton: kein neuer Anschlag
  const e2 = B.createBassEnv();
  e2.step(0.8, 0.05);
  for (let i = 0; i < 40; i++) o = e2.step(0.8, 0.05);
  assert.ok(o.pulse < 0.01 && Math.abs(o.bass - 0.8) < 0.01, "gehaltener Bass bleibt stehen");
}

// ---- Hörprobe im Song: fein auf 25 ms statt nur auf die Viertelsekunde
{
  const n = 20 * 200, loud = new Float32Array(n);
  const f = (t) => -20 + 8 * Math.sin(t * 0.54) + 5 * Math.sin(t * 1.7) + 4 * Math.sin(t * 3.1) + (t > 120 && t < 130 ? 6 : 0);
  for (let x = 0; x < n; x++) loud[x] = f(x / 20);
  const r = 21.5, off = 101.37, np = Math.round(30 * r), prev = new Float32Array(np);
  for (let x = 0; x < np; x++) prev[x] = f(off + x / r);
  const a = S.alignPreview({ r: 20, n, loud }, { r, n: np, loud: prev });
  assert.ok(a && Math.abs(a.off - off) <= 0.02 && a.r > 0.9, "feine Lage: " + JSON.stringify(a));
  // gemerkt: einmal gerechnet, danach ohne Rechnen abrufbar
  const segs = [];
  for (let x = 0; x < n; x += 5) segs.push({ t: x / 20, l: loud[x], b: 0, f: 0, k: 0, p: [] });
  const grid = { r, n: np, loud: prev };
  assert.strictEqual(S.alignedOf(segs, grid), undefined, "noch nicht gerechnet");
  const al = S.alignFor(segs, grid);
  assert.ok(al && Math.abs(al.off - off) < 0.15 && Math.abs(al.end - (al.off + 30)) < 0.1, "Lage aus Segmenten: " + JSON.stringify(al));
  assert.strictEqual(S.alignedOf(segs, grid), al, "gemerkt");
}
console.log("bass: ok");
