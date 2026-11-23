// node tests/unit/scenefx.test.js
// Neue Bühnenbilder der Szenarien (scenefx.js): jedes Bild zeichnet ohne Fehler und ohne NaN, in voller Qualität
// und bei „Leicht“ – und mit „Keine Blitze“ wird keine Stelle des Bilds mehr als dreimal pro Sekunde kräftig hell und
// wieder dunkel (dieselbe Messung wie noflash.test.js: Canvas-Attrappe mit Messpunkten, Wechsel um mindestens SWING).
// Dazu: ohne „Keine Blitze“ blitzt das Gewitter nur durch die Blitz-Schranke (höchstens 3/s).
const assert = require("assert");
const { load } = require("./load.js");
const { createStageFx } = load("stagefx.js");
const { createFlashCap } = load("flashcap.js");
const { SCENE_FAMS, FAM, FAMS } = load("scenarios.js");

const VW = 1600, VH = 900, GX = 24, GY = 14, SWING = 0.1, FPS = 60;
const probes = [];
for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) probes.push([((i + 0.5) / GX) * VW, ((j + 0.5) / GY) * VH]);

const alphaOf = (style) => {
  if (style && typeof style === "object") return style.max ?? 0;
  const m = /rgba?\(([^)]+)\)/.exec(String(style));
  if (!m) return 0;
  const v = m[1].split(",").map(Number);
  return v.length > 3 ? v[3] : 1;
};
const isDark = (style) => typeof style === "string" && /rgba?\(0,0,0/.test(style.replace(/\s/g, ""));
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function inPoly(px, py, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
// Attrappe: L[k] = Licht am Messpunkt k in diesem Bild
function meterCtx() {
  const L = new Float64Array(probes.length);
  let path = [], cur = null, tf = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const T = (x, y) => [tf[0] * x + tf[2] * y + tf[4], tf[1] * x + tf[3] * y + tf[5]];
  // Verläufe: Deckkraft am Messpunkt aus den Stufen (linear: Lage auf der Achse, radial: Abstand, Winkel-Verlauf: Höchstwert)
  const grad = (type) => (...c) => {
    const g = { type, c, stops: [], max: 0, dark: false, addColorStop: (u, col) => (g.stops.push([u, alphaOf(col)]), (g.max = Math.max(g.max, alphaOf(col))), (g.dark ||= isDark(col))) };
    return g;
  };
  const gAt = (g, px, py) => {
    if (g.type === "conic" || !g.stops.length) return g.max;
    const det = tf[0] * tf[3] - tf[1] * tf[2], dx = px - tf[4], dy = py - tf[5];
    const x = (tf[3] * dx - tf[2] * dy) / det, y = (-tf[1] * dx + tf[0] * dy) / det, c = g.c;
    let u;
    if (g.type === "linear") {
      const ax = c[2] - c[0], ay = c[3] - c[1], l = ax * ax + ay * ay || 1;
      u = ((x - c[0]) * ax + (y - c[1]) * ay) / l;
    } else u = (Math.hypot(x - c[3], y - c[4]) - c[2]) / Math.max(1e-6, c[5] - c[2]);
    const s = g.stops.slice().sort((a, b) => a[0] - b[0]);
    if (u <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) if (u <= s[i][0]) return s[i - 1][1] + ((s[i][1] - s[i - 1][1]) * (u - s[i - 1][0])) / Math.max(1e-9, s[i][0] - s[i - 1][0]);
    return s[s.length - 1][1];
  };
  const styleAt = (style, px, py) => (style && typeof style === "object" ? gAt(style, px, py) : alphaOf(style));
  const add = (k, a, style) => {
    if (isDark(style) || style?.dark) L[k] *= 1 - a;
    else L[k] += a;
  };
  const own = {
    globalAlpha: 1, globalCompositeOperation: "lighter", fillStyle: "", strokeStyle: "", lineWidth: 1, canvas: { width: VW, height: VH },
    L, reset: () => L.fill(0),
    save: () => stack.push(tf.slice()),
    restore: () => (tf = stack.pop() || [1, 0, 0, 1, 0, 0]),
    translate: (x, y) => ((tf[4] += tf[0] * x + tf[2] * y), (tf[5] += tf[1] * x + tf[3] * y)),
    scale: (sx, sy) => (tf = [tf[0] * sx, tf[1] * sx, tf[2] * sy, tf[3] * sy, tf[4], tf[5]]),
    setTransform: (a, b, c, d, e, f) => (tf = [a, b, c, d, e, f]),
    createLinearGradient: grad("linear"), createRadialGradient: grad("radial"), createConicGradient: grad("conic"),
    beginPath: () => ((path = []), (cur = null)),
    moveTo: (x, y) => path.push((cur = [T(x, y)])),
    lineTo: (x, y) => (cur ? cur.push(T(x, y)) : path.push((cur = [T(x, y)]))),
    closePath: () => {},
    ellipse: (x, y, rx, ry) => {
      const s = [];
      for (let k = 0; k <= 32; k++) s.push(T(x + Math.cos((k / 32) * Math.PI * 2) * rx, y + Math.sin((k / 32) * Math.PI * 2) * ry));
      path.push((cur = s));
    },
    arc: (x, y, r) => own.ellipse(x, y, r, r),
    stroke: () => {
      const st = own.strokeStyle, w = own.lineWidth / 2 + 1;
      probes.forEach(([px, py], k) => {
        for (const s of path) for (let i = 1; i < s.length; i++) if (segDist(px, py, ...s[i - 1], ...s[i]) <= w) return add(k, styleAt(st, px, py) * own.globalAlpha, st);
      });
    },
    fill: () => {
      const st = own.fillStyle;
      probes.forEach(([px, py], k) => {
        for (const s of path) if (s.length > 2 && inPoly(px, py, s)) return add(k, styleAt(st, px, py) * own.globalAlpha, st);
      });
    },
    fillRect: (x, y, w, h) => {
      const st = own.fillStyle, p0 = T(x, y), p1 = T(x + w, y + h);
      probes.forEach(([px, py], k) => {
        if (px >= Math.min(p0[0], p1[0]) && px <= Math.max(p0[0], p1[0]) && py >= Math.min(p0[1], p1[1]) && py <= Math.max(p0[1], p1[1])) add(k, styleAt(st, px, py) * own.globalAlpha, st);
      });
    },
    clearRect: () => {},
    drawImage: (img, x, y, w, h) => {
      const a = own.globalAlpha;
      if (a <= 0 || w == null) return;
      const p0 = T(x, y), p1 = T(x + w, y + h), cx = (p0[0] + p1[0]) / 2, cy = (p0[1] + p1[1]) / 2, rx = Math.abs(p1[0] - p0[0]) / 2, ry = Math.abs(p1[1] - p0[1]) / 2;
      probes.forEach(([px, py], k) => {
        const u = Math.hypot((px - cx) / rx, (py - cy) / ry);
        if (u < 1) L[k] += a * (u < 0.3 ? 1 : (1 - u) * (1 - u * u) * 1.15);
      });
    },
  };
  return new Proxy(own, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) });
}
// Wechsel je Messpunkt zählen (Hysterese SWING), Ergebnis: höchste Zahl voller Hell-dunkel-Wechsel in einer Sekunde
function maxRate(frames) {
  let worst = 0, where = -1;
  for (let k = 0; k < probes.length; k++) {
    const turns = [];
    let lo = frames[0][k], hi = frames[0][k], dir = 0;
    for (let i = 1; i < frames.length; i++) {
      const v = frames[i][k];
      if (dir >= 0) {
        if (v > hi) hi = v;
        if (hi - v >= SWING) [dir, lo, hi] = [-1, v, v], turns.push(i);
      }
      if (dir <= 0) {
        if (v < lo) lo = v;
        if (v - lo >= SWING) [dir, lo, hi] = [1, v, v], turns.push(i);
      }
    }
    for (let i = 0; i < turns.length; i++) {
      const n = turns.filter((f) => f >= turns[i] && f < turns[i] + FPS).length / 2;
      if (n > worst) [worst, where] = [n, k];
    }
  }
  return { worst, where: probes[where] };
}
const pal = [[255, 80, 120], [80, 160, 255], [255, 220, 90]];
const BEAT = 60 / 128;
function run(draw, secs = 4) {
  const ctx = meterCtx(), frames = [];
  for (let i = 0; i < secs * FPS; i++) {
    const t = 10 + i / FPS;
    ctx.reset();
    draw(ctx, t, i / FPS);
    frames.push(Float64Array.from(ctx.L));
  }
  return maxRate(frames);
}
const base = (t, extra) => ({ t, dt: 1 / FPS, vw: VW, vh: VH, dpr: 1, cx: VW / 2, cy: VH * 0.45, R: VH * 0.15, pal, quality: 2, noFlash: true, px: { scn: null }, ...extra });
// eine Antwort wie aus scenarios.js, in jedem Bild als neue Kopie (wie im Hintergrund-Thread)
function cueOf(f, v, seq, t0) {
  const F = FAM[f];
  const c = { f, fi: FAMS.indexOf(f), t0, k: 1.15, col: null, from: "top", seq, dur: F.dur, v, dir: v % 2 ? -1 : 1, ox: 0.3 + 0.2 * v, soft: false };
  if (F.beats) Object.assign(c, { beat: BEAT, off: 0.1, dur: 0.1 + BEAT * F.beats + 0.6 });
  return c;
}

/* ---- jedes Bild: zeichnet, ohne NaN, alle Spielarten, voll und „Leicht“ */
for (const f of SCENE_FAMS) {
  for (const quality of [2, 0]) {
    for (let v = 0; v < (FAM[f].nv || 1); v++) {
      const ctx = meterCtx(), sfx = createStageFx((c) => String(c), createFlashCap());
      const c0 = cueOf(f, v, 7, 10);
      for (let i = 0; i < 40; i++) {
        const t = 10 + (i / 40) * (c0.dur + 0.5);
        ctx.reset();
        sfx.draw(ctx, base(t, { quality, noFlash: false, flash: true, cues: [{ ...c0 }] }), {}, {});
        for (const x of ctx.L) assert.ok(Number.isFinite(x), `${f}: NaN im Bild`);
        assert.strictEqual(ctx.globalCompositeOperation, "lighter", `${f}: Mischmodus nicht zurückgesetzt`);
      }
    }
  }
}

/* ---- „Keine Blitze“: je Bild höchstens 3 kräftige Wechsel pro Sekunde an jeder Stelle (über die ganze Dauer,
   dazu ein zweiter Einsatz desselben Bilds direkt danach) */
let worst = 0, worstF = "";
const bad = [];
for (const f of SCENE_FAMS) {
  const sfx = createStageFx((c) => String(c), createFlashCap());
  const c0 = cueOf(f, 0, 3, 10), c1 = cueOf(f, 1, 4, 10 + c0.dur + 0.6);
  const secs = Math.ceil(c0.dur + c1.dur + 2);
  const r = run((ctx, t) => {
    const cues = [];
    if (t - c0.t0 < c0.dur + 0.5) cues.push({ ...c0 });
    if (t >= c1.t0) cues.push({ ...c1 });
    sfx.draw(ctx, base(t, { cues }), {}, {});
  }, secs);
  if (r.worst > worst) [worst, worstF] = [r.worst, f];
  if (r.worst > 3) bad.push(`${f} ${r.worst}×/s bei ${r.where.map(Math.round)}`);
}

assert.ok(!bad.length, `Keine Blitze: zu viele Wechsel pro Sekunde:\n${bad.join("\n")}`);

/* ---- mit Blitzen: das Wetterleuchten geht durch die Schranke (nie mehr als 3 Aufhellungen je Sekunde) */
{
  const cap = createFlashCap(), sfx = createStageFx((c) => String(c), cap), flashes = [];
  let seq = 100;
  for (let i = 0; i < 60 * 12; i++) {
    const t = 10 + i / 60, cues = [];
    // alle 0,2 s ein neues Gewitter – weit mehr, als die Regie je schickt
    for (let j = 0; j < 3; j++) cues.push(cueOf("thunder", 0, seq + j, Math.floor((t - 10) / 0.2) * 0.2 + 10 - j * 0.6 - 0.5));
    if (i % 12 === 0) seq += 3;
    const log = [];
    const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === "fillRect" ? (x, y, w, h) => log.push({ fill: o.fillStyle, full: x === 0 && y === 0 && w >= 1000 }) : k.startsWith("create") ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => ((o[k] = v), true) });
    sfx.draw(ctx, base(t, { cues, noFlash: false, flash: true }), {}, {});
    if (log.some((x) => x.full && /^rgba\(200,215,255/.test(x.fill))) flashes.push(t);
  }
  const onsets = flashes.filter((t, i) => i === 0 || t - flashes[i - 1] > 1.5 / 60);
  assert.ok(onsets.length > 2, "mit Blitzen leuchtet das Gewitter auch");
  for (let i = 0; i < onsets.length; i++) assert.ok(onsets.filter((x) => x >= onsets[i] && x < onsets[i] + 1).length <= 3, "mehr als 3 Blitze in einer Sekunde");
}

console.log(`scenefx: ok (${SCENE_FAMS.length} neue Bilder, Keine Blitze: höchstens ${worst} Wechsel/s bei ${worstF})`);
