// node --test tests/unit/handover.test.js
// DJ-Übergabe zwischen Songs (handover.js): Ausklang über die letzten Takte, Tempo-Verhältnis, Farben des nächsten
// Songs, kurze DJ-Einwürfe ohne Hin und Her (Hysterese), Name der DJ-Stimme nur, wenn Spotify ihn nennt.
const test = require("node:test");
const assert = require("assert");
const { load } = require("./load.js");
const { createTalkGate, vividOf, tempoRatio, djVoice, outroWindow, lerpPal } = load("handover.js");

test("Ausklang: erst in den letzten 16 Schlägen, Beginn auf einem Taktanfang", () => {
  const bars = Array.from({ length: 100 }, (_, i) => ({ t: i * 2 })); // 120 BPM: ein Takt = 2 s
  assert.strictEqual(outroWindow(150, 200, 120, bars), 0);
  // 16 Schläge à 0,5 s = 8 s → Beginn 192 s, das ist ein Taktanfang
  assert.strictEqual(outroWindow(191.9, 200, 120, bars), 0);
  assert.ok(Math.abs(outroWindow(196, 200, 120, bars) - 0.5) < 1e-9);
  assert.strictEqual(outroWindow(200, 200, 120, bars), 1);
  // Takte versetzt (Taktanfang 191 s): der Ausklang beginnt dort, nicht mitten im Takt
  const off = bars.map((b) => ({ t: b.t + 1 }));
  assert.ok(outroWindow(191.5, 200, 120, off) > 0);
  // langsam (60 BPM): höchstens 12 s · schnell (180 BPM): mindestens 6 s
  assert.ok(outroWindow(188.5, 200, 60, null) > 0 && outroWindow(187.9, 200, 60, null) === 0);
  assert.ok(outroWindow(194.1, 200, 180, null) > 0 && outroWindow(193.9, 200, 180, null) === 0);
  // kurze Stücke (Zwischenspiele): nie
  assert.strictEqual(outroWindow(25, 28, 120, null), 0);
});

test("Tempo des nächsten Songs: halbes und doppeltes Zeitgefühl zählen als gleich", () => {
  assert.strictEqual(tempoRatio(128, 128), 1);
  assert.ok(Math.abs(tempoRatio(140, 70) - 1) < 1e-9);
  assert.ok(Math.abs(tempoRatio(87, 174) - 1) < 1e-9);
  assert.ok(Math.abs(tempoRatio(120, 100) - 1.2) < 1e-9);
  assert.strictEqual(tempoRatio(0, 120), 1);
  assert.strictEqual(tempoRatio(120, 0), 1);
  for (const [a, b] of [[60, 190], [200, 61], [99, 100]]) {
    const r = tempoRatio(a, b);
    assert.ok(r >= 0.7 && r <= 1.42, `${a}/${b} → ${r}`);
  }
});

test("Farben des nächsten Songs: kräftig, graue Cover bekommen Mirage-Töne", () => {
  const pal = vividOf([[90, 80, 70], [60, 70, 90], [200, 190, 180]], "cool");
  assert.strictEqual(pal.length, 3);
  for (const c of pal) {
    assert.ok(c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255));
    assert.ok(Math.max(...c) - Math.min(...c) > 60, "nicht grau: " + c);
  }
  assert.strictEqual(vividOf(null, "cool"), null);
  assert.deepStrictEqual(lerpPal([[0, 0, 0]], [[100, 200, 50]], 0.5), [[50, 100, 25]]);
});

test("DJ-Ansage: kurze Einwürfe kippen die Bühne nicht, lange werden ruhig, Werbung sofort", () => {
  const run = (kind, sec, g = createTalkGate()) => {
    let v = 0, max = 0;
    for (let t = 0; t < sec; t += 1 / 60) max = Math.max(max, (v = g.step(kind, 1 / 60)));
    return { v, max, g };
  };
  // 2 s DJ: die Bühne bleibt, wie sie war
  assert.strictEqual(run("dj", 2).max, 0);
  // 8 s DJ: ganz ruhig
  assert.ok(run("dj", 8).v > 0.97);
  // Werbung: nach einer Sekunde fast ganz ruhig, aber nicht im ersten Bild
  const ad = createTalkGate();
  assert.ok(ad.step("ad", 1 / 60) < 0.2);
  assert.ok(run("ad", 1, ad).v > 0.9);
  // Musik danach: kommt weich zurück (nicht im ersten Bild), nach 2 s fast ganz
  const g = run("dj", 8).g;
  assert.ok(g.step("", 1 / 60) > 0.9);
  assert.ok(run("", 2, g).v < 0.02);
  // Ansage – Song (1 s) – Ansage: zählt neu, kein Flackern zwischen ruhig und Show
  const h = createTalkGate();
  run("dj", 2, h);
  run("", 1, h);
  assert.strictEqual(run("dj", 2, h).max, 0);
});

test("DJ-Stimme: nur ein echter Name, sonst leer (Spotify 1.3.10 schickt keinen)", () => {
  assert.strictEqual(djVoice({ metadata: { is_narration: "true", title: "DJ" } }, { metadata: { lexicon_set_type: "your_dj" } }), "");
  assert.strictEqual(djVoice({ metadata: { "narration.voice.name": "Casey" } }), "Casey");
  assert.strictEqual(djVoice({ metadata: {} }, { metadata: { dj_voice: "Livi" } }), "Livi");
  assert.strictEqual(djVoice({ metadata: { dj_voice: "true" } }), "");
  assert.strictEqual(djVoice({ metadata: { voice_name: "x".repeat(40) } }), "");
  assert.strictEqual(djVoice(null, null), "");
});
