// node tests/unit/show.test.js
// Die Show-Ebene (Lichtrig und Instrumente) auf einer Canvas-Attrappe: läuft jeder Effekt ohne Fehler durch,
// und hält die Blitz-Schranke auch im schlimmsten Fall (jedes Bild freigegeben, Snare zehnmal pro Sekunde)?
const assert = require("assert");
const { load } = require("./load.js");
const { createShow } = load("show.js");
const { createFlashCap } = load("flashcap.js");
const { KINDS } = load("instrkinds.js");

function fakeCtx(onDraw) {
  const grad = { addColorStop() {} };
  const own = { globalAlpha: 1, createRadialGradient: () => grad, createLinearGradient: () => grad, drawImage: (img) => onDraw?.(img, own.globalAlpha) };
  return new Proxy(own, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) });
}
const pal = [[255, 80, 120], [80, 160, 255], [255, 220, 90]];
const frame = (t, extra = {}) => ({
  st: { t, dt: 1 / 60, vw: 1920, vh: 1080, cx: 960, cy: 480, bpm: 128, rig: true, flash: true, flashGo: true, hype: true, noFlash: false, inst: null, ...extra.st },
  px: { key: "rock", beatIdx: Math.floor(t * 2.13), phase: (t * 2.13) % 1, low: 0, I: 1, kickEnv: 0, snareEnv: 0, hatEnv: 0, energy: 0.9, build: 0, drop: 0.6, dropHit: false, finale: true, blackout: false, scene: 0, ...extra.px },
});

// ---- jedes Instrument einzeln und alle zusammen, mit und ohne „Keine Blitze“
for (const noFlash of [false, true]) {
  for (const kinds of [...KINDS.map((k) => [k]), KINDS]) {
    const show = createShow((c) => c.join(","), createFlashCap());
    const ctx = fakeCtx();
    for (let i = 0; i < 180; i++) {
      const t = i / 60, hit = Math.exp(-((t * 2.13) % 1) * 7);
      const inst = Object.fromEntries(KINDS.map((k) => [k, kinds.includes(k) ? 1 : 0]));
      inst.chroma = [1, 0, 0.5, 0, 0.8, 0, 0, 1, 0, 0.3, 0, 0];
      const { st, px } = frame(t, { st: { inst, noFlash }, px: { kickEnv: hit, snareEnv: hit, hatEnv: hit } });
      show.drawRig(ctx, st, { decor: "club" }, px, pal, 1);
      show.drawInst(ctx, st, px, pal, 1);
    }
  }
}

// ---- Blinder: nie mehr als drei in einer Sekunde, auch wenn alles andere „ja“ sagt
const BLIND = "255,236,200";
function blinderTimes(extraSt) {
  const times = [];
  let last = 0, now = 0, seen = 0;
  const show = createShow((c) => c.join(","), createFlashCap());
  const ctx = fakeCtx((img, alpha) => {
    if (img !== BLIND || seen++) return;
    if (alpha > last + 0.05) times.push(now);
    last = alpha;
  });
  for (let i = 0; i < 60 * 30; i++) {
    now = i / 60;
    seen = 0;
    // Snare zehnmal pro Sekunde: jede Flanke will einen Blinder
    const { st, px } = frame(now, { st: extraSt, px: { snareEnv: i % 6 < 3 ? 1 : 0 } });
    show.drawRig(ctx, st, { decor: "club" }, px, pal, 1);
    if (!seen) last = 0;
  }
  return times;
}
const hits = blinderTimes({});
assert.ok(hits.length > 30, "der Blinder zündet überhaupt (" + hits.length + ")");
for (const h of hits) assert.ok(hits.filter((x) => x >= h && x < h + 1).length <= 3, "mehr als 3 Blinder in einer Sekunde");
// ohne Freigabe aus dem Hauptthread und mit ausgeschalteten Blitzen: gar keiner
assert.equal(blinderTimes({ flashGo: false }).length, 0);
assert.equal(blinderTimes({ flash: false }).length, 0);
console.log("show: ok");
