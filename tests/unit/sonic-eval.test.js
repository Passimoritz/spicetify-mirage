// node tests/unit/sonic-eval.test.js   (SONIC_EVAL_PRINT=1 druckt die Tabelle)
// Regression der Klang-Detektoren auf echter Musik: tests/unit/fixtures/sonic-eval.json enthält für 201 Hörproben
// (Testlabor Runde 11) die Klangzahlen der Palette und die Effekt-Kandidaten – keine Hörproben selbst. Gerechnet wird
// mit denselben Funktionen wie in der Party (sonic.js paletteConf, fxSelect, THR). Geprüft wird je Art:
//  · Präzision ≥ 0,9 für jede Art, die überhaupt anschlagen darf (Regel des Besitzers: nur reagieren, wenn sicher)
//  · keine neuen Fehlalarme und keine verlorenen Treffer gegenüber dem eingefrorenen Stand (FROZEN unten)
//  · Effekte: Fehlalarme je Minute auf Songs, in denen der Effekt sicher fehlt, nicht mehr als eingefroren
// Bessere Zahlen sind willkommen – dann FROZEN anpassen (und im CHANGELOG/Bericht festhalten).
const assert = require("assert");
const { load } = require("./load.js");
const S = load("sonic.js");
const fx = require("./fixtures/sonic-eval.json");

// eingefroren (Runde 11): je Art Treffer (tp) und Fehlalarme (fp) über alle drei Gruppen
const FROZEN = {
  kick: { tp: 47, fp: 1 }, sub808: { tp: 8, fp: 0 }, hats: { tp: 17, fp: 0 }, crash: { tp: 3, fp: 0 }, distguitar: { tp: 15, fp: 0 },
  acguitar: { tp: 14, fp: 0 }, piano: { tp: 8, fp: 0 }, strings: { tp: 4, fp: 0 }, pump: { tp: 3, fp: 0 },
};
// aus: Schwelle über 1 (Testlabor ohne sichere Erkennung)
const OFF = ["pad", "organ", "bells", "scratch"];

const ALL = [...S.INST, ...S.FX];
const rows = fx.songs.map((s) => {
  const conf = S.paletteConf(s.feats);
  const ev = S.fxSelect(s.cand.map(([k, t, dur, c]) => ({ k, t, dur, c })), 30);
  const on = new Set([...S.INST.filter((k) => conf[k] >= S.THR[k]), ...ev.map((e) => e.k)]);
  const neg = ALL.filter((k) => !s.pos.includes(k) && !s.unk.includes(k));
  return { s, on, ev, neg };
});
const stat = (k, sel = () => true) => {
  let tp = 0, fn = 0, fp = 0, negMin = 0, fpEv = 0;
  for (const r of rows) {
    if (!sel(r.s)) continue;
    const isOn = r.on.has(k);
    if (r.s.pos.includes(k)) isOn ? tp++ : fn++;
    else if (r.neg.includes(k)) {
      negMin += r.s.dur / 60;
      if (isOn) [fp, fpEv] = [fp + 1, fpEv + Math.max(1, r.ev.filter((e) => e.k === k).length)];
    }
  }
  return { tp, fn, fp, prec: tp + fp ? tp / (tp + fp) : NaN, rec: tp + fn ? tp / (tp + fn) : NaN, fpm: negMin ? fpEv / negMin : 0 };
};

if (process.env.SONIC_EVAL_PRINT) {
  const f = (v) => (Number.isNaN(v) ? "  -  " : v.toFixed(2).padStart(5));
  console.log("class       thr  | all: TP FN FP  prec  rec | train  holdout  blind (TP/FP)");
  for (const k of ALL) {
    const a = stat(k), t = stat(k, (s) => s.set === "train"), h = stat(k, (s) => s.set === "holdout"), b = stat(k, (s) => s.set === "blind");
    console.log(k.padEnd(11), String(S.THR[k]).padEnd(4), "|", [a.tp, a.fn, a.fp].map((v) => String(v).padStart(3)).join(""), f(a.prec), f(a.rec), "|", `${t.tp}/${t.fp}`.padEnd(6), `${h.tp}/${h.fp}`.padEnd(8), `${b.tp}/${b.fp}`, "| FP/min", a.fpm.toFixed(2));
  }
}

assert.ok(fx.songs.length >= 200, "Fixture vollständig");
for (const k of ALL) {
  const a = stat(k);
  if (S.THR[k] <= 1 && a.tp + a.fp > 0) assert.ok(a.prec >= 0.9, `${k}: Präzision ${a.prec.toFixed(2)} < 0,9`);
  const fz = FROZEN[k];
  if (fz) {
    assert.ok(a.fp <= fz.fp, `${k}: mehr Fehlalarme als eingefroren (${a.fp} > ${fz.fp})`);
    assert.ok(a.tp >= fz.tp, `${k}: weniger Treffer als eingefroren (${a.tp} < ${fz.tp})`);
  } else if (!OFF.includes(k)) assert.strictEqual(a.fp, 0, `${k}: Fehlalarm, eingefroren waren keine`);
}
for (const k of OFF) assert.ok(S.THR[k] > 1, `${k} ist im Testlabor nicht sicher – Schwelle muss über 1 bleiben`);
// Effekte gesamt: auf Songs, in denen sie sicher fehlen, kein einziger Fehlalarm
const fxFalse = S.FX.filter((k) => stat(k).fp > 0);
assert.deepStrictEqual(fxFalse, [], "Effekte: Fehlalarme auf sicheren Negativen");
// gesperrte Arten zeigen die Laufzeit nie, sichere zart bis voll
for (const k of OFF) assert.strictEqual(S.strength(k, 1), 0, "aus: " + k);
console.log("sonic-eval: ok (" + fx.songs.length + " Hörproben)");
