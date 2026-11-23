// node tests/unit/noflash.test.js
// „Keine Blitze“: kein Bühnenbild darf an einer Stelle des Bildes mehr als dreimal pro Sekunde kräftig hell und
// wieder dunkel werden (WCAG 2.3.1). Die Zeichenfunktionen laufen auf einer Canvas-Attrappe, die an einem Raster
// von Messpunkten grob mitrechnet, wie viel Licht dort ankommt (Leuchtbilder, Flächen, Linien, Pfade). Gezählt
// werden Wechsel um mindestens SWING (Anteil von vollem Weiß) mit Hysterese, je gleitendem Fenster von einer Sekunde.
const assert = require("assert");
const { load } = require("./load.js");
const { createInstFx } = load("instfx.js");
const { createStageFx } = load("stagefx.js");
const { createShow } = load("show.js");
const { createFlashCap } = load("flashcap.js");
const { DROP_LOOKS } = load("scenarios.js");

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
const BPM = 128, BEAT = 60 / BPM;
// Hüllen der Party wie in party.js: Kick auf jedem Schlag, Snare auf 2 und 4, Hi-Hat in Sechzehnteln
function pxAt(t, extra = {}) {
  const b = t / BEAT, ph = b % 1, age = ph * BEAT;
  const sAge = Math.floor(b) % 2 === 1 ? age : age + BEAT;
  return { beatIdx: Math.floor(b), phase: ph, inBar: Math.floor(b) % 4, barIdx: Math.floor(b / 4), kickEnv: Math.exp(-age * 7), snareEnv: Math.exp(-sAge * 9), hatEnv: Math.exp(-((age % (BEAT / 4)) * 16)), energy: 0.9, bass: 0.6, beat: Math.exp(-age * 6), pump: 0, boom: 0, blackout: false, ...extra };
}
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
const base = (t, extra) => ({ t, dt: 1 / FPS, vw: VW, vh: VH, dpr: 1, cx: VW / 2, cy: VH * 0.45, R: VH * 0.15, bpm: BPM, pal, quality: 2, noFlash: true, ...extra });

// ---- Soundeffekte (instfx.js), je einer, über 3 s Dauer
const SFX = ["riser", "sweep", "downlift", "impact", "subdrop", "orchhit", "stop", "tapestop", "revcym", "stutter", "scratch", "filter", "pump", "cheer", "siren", "airhorn", "zap", "whoosh", "rewind"];
for (const k of SFX) {
  const fx = createInstFx((c) => c.join(","));
  const dur = k === "airhorn" || k === "zap" || k === "whoosh" || k === "impact" ? 1 : 3;
  const r = run((ctx, t, age) => {
    const p = Math.min(1.6, age / dur), e = Math.min(1, age / 0.15) * Math.max(0, Math.min(1, 1 - (age - dur) / 0.6));
    fx.draw(ctx, base(t, { px: pxAt(t), inst: { sfx: [{ k, p, e, s: 1 }] } }));
  });
  assert.ok(r.worst <= 3, `Keine Blitze: Effekt ${k} wechselt ${r.worst}× pro Sekunde bei ${r.where}`);
}

// ---- Instrumente (instfx.js) alle zusammen
{
  const fx = createInstFx((c) => c.join(","));
  const inst = { kick: 1, sub808: 1, hats: 1, crash: 1, acguitar: 1, pad: 1, bells: 1, organ: 1, piano: 1, sfx: [] };
  const r = run((ctx, t) => fx.draw(ctx, base(t, { px: pxAt(t), inst })));
  assert.ok(r.worst <= 3, `Keine Blitze: Instrumente wechseln ${r.worst}× pro Sekunde bei ${r.where}`);
}

// ---- Drop-Bilder und Momente der Regie (stagefx.js)
for (let dl = 0; dl < DROP_LOOKS.length; dl++) {
  const sfx = createStageFx((c) => String(c), createFlashCap());
  const r = run((ctx, t, age) => {
    const x = age % 2, dx = Math.exp(-x / (BEAT * 4 * 0.75));
    sfx.draw(ctx, base(t, { px: { ...pxAt(t), scn: { dl, dx, da: x, fin: 0, mod: 0, back: 0, open: 0, solo: 0, acap: 0, echo: 0 } }, cues: null }), {}, {});
  });
  assert.ok(r.worst <= 3, `Keine Blitze: Drop-Bild ${DROP_LOOKS[dl]} wechselt ${r.worst}× pro Sekunde bei ${r.where}`);
}

// ---- Lichtwisch, Pumpen, 808-Boden (show.js), mit „Keine Blitze“
{
  const show = createShow((c) => String(c), createFlashCap());
  const r = run((ctx, t, age) => {
    const w = age % 2 < 1.2 ? (age % 2) / 1.2 : -1;
    show.drawRig(ctx, base(t, { rig: true, flash: false, flashGo: false }), { decor: "club" }, { ...pxAt(t), key: "house", low: 0, I: 1, build: 0, drop: 0, wipe: w, wdir: 1, pump: 1, boom: 0.7, mb: t / BEAT, spread: 1 }, pal, 1);
  });
  assert.ok(r.worst <= 3, `Keine Blitze: Lichtrig wechselt ${r.worst}× pro Sekunde bei ${r.where}`);
}

// ---- Lichtprogramme der Regie (director.js → show.js): jedes Muster mit jedem Farbprogramm (House: ohne die Laserfläche,
// deren dünne Linien die Messung ohnehin kaum sieht – hier zählt das Rig)
const { RIG_P, COL_P } = load("director.js");
const PROGS = [...new Set(Object.values(RIG_P).flat())], COLS = [...new Set(Object.values(COL_P).flat())];
for (const rigP of PROGS) {
  for (const colP of COLS) {
    const show = createShow((c) => String(c), createFlashCap());
    const r = run((ctx, t) => {
      show.drawRig(ctx, base(t, { rig: true, flash: false, flashGo: false }), { decor: "club" }, { ...pxAt(t), key: "house", low: 0, I: 1, build: 0, drop: 0, wipe: -1, wdir: 1, mb: t / BEAT, spread: 1, rigP, colP }, pal, 1);
    }, 3);
    assert.ok(r.worst <= 3, `Keine Blitze: Programm ${rigP}/${colP} wechselt ${r.worst}× pro Sekunde bei ${r.where}`);
  }
}
// ---- Aufbau → dunkler Schlag → Drop mit Leitbild, so wie die Regie es für einen echten Song plant (EDM-Form): die
// Köpfe ziehen sich zusammen, die Lichtrampe steigt (ohne Pulsen), ein Schlag dunkel, dann gleiten die Köpfe
// auseinander (lead) und das Drop-Programm trägt – je um beide Drops, in voller und in halber Qualität
const { planSong, cue } = load("director.js");
const { shaped } = require("./songshapes.js");
{
  const plan = planSong(shaped("edm"), "edm");
  for (const drop of plan.parts.filter((p) => p.kind === "drop")) {
    for (const quality of [2, 1]) {
      const show = createShow((c) => String(c), createFlashCap());
      const r = run((ctx, t, age) => {
        const sec = drop.t0 - 3 + age, C = cue(plan, sec, { noFlash: true });
        show.drawRig(ctx, base(t, { rig: true, flash: false, flashGo: false, quality }), { decor: "stands" }, {
          ...pxAt(sec), key: "house", low: 0, I: C.I, build: 0, drop: C.kind === "drop" ? 0.9 : 0, blackout: C.dim >= 1, wipe: C.wipe, wdir: C.wdir, mb: C.mb, spread: C.spread,
          rigP: C.rigP, colP: C.colP, conv: C.conv, lead: C.lead, ramp: C.ramp, pulse: C.pulse, lift: C.lift, dropHit: Math.abs(sec - drop.t0) < 0.5 / FPS,
        }, pal, 1);
      }, 6);
      assert.ok(r.worst <= 3, `Keine Blitze: Aufbau und Drop bei ${drop.t0.toFixed(1)} s (Qualität ${quality}) wechseln ${r.worst}× pro Sekunde bei ${r.where}`);
    }
  }
}
// ---- DJ-Übergabe: die Köpfe stehen zur Mitte, auf der ersten Eins des neuen Songs springen sie auseinander
{
  const show = createShow((c) => String(c), createFlashCap());
  const r = run((ctx, t, age) => {
    const hand = age < 3 ? Math.min(1, age / 2) : 0, land = age >= 3 && age < 3 + 1 / FPS;
    show.drawRig(ctx, base(t, { rig: true, flash: false, flashGo: false }), { decor: "club" }, { ...pxAt(t), key: "house", low: 0, I: 1, build: 0, drop: 0, wipe: age > 3 && age < 4 ? age - 3 : -1, wdir: 1, mb: t / BEAT, spread: 1, rigP: "wave", colP: "mono", hand, land }, pal, 1);
  }, 5);
  assert.ok(r.worst <= 3, `Keine Blitze: Übergabe und Landung wechseln ${r.worst}× pro Sekunde bei ${r.where}`);
}

// ---- Gegenprobe: die Messung zählt richtig – eine Fläche, die mit 5 Hz bzw. 2 Hz an und aus geht
// (Grenze der Messung: dünne Linien, die in einem Bild weiter springen als der Abstand der Messpunkte, sieht sie kaum)
for (const [hz, over] of [[5, true], [2, false]]) {
  const r = run((ctx, t) => {
    ctx.fillStyle = `rgba(255,255,255,${(t * hz) % 1 < 0.5 ? 0.3 : 0})`;
    ctx.fillRect(0, 0, VW / 2, VH / 2);
  }, 2);
  assert.equal(r.worst > 3, over, `Gegenprobe ${hz} Hz: ${r.worst} Wechsel pro Sekunde`);
}
// … und der Lichtwisch mit Blitzen bleibt ohnehin langsam (gleitet über ≥ 0,8 s)
{
  const show = createShow((c) => String(c), createFlashCap());
  const r = run((ctx, t, age) => {
    show.drawRig(ctx, base(t, { noFlash: false, rig: true, flash: false, flashGo: false }), { decor: "" }, { ...pxAt(t), key: "ambient", low: 0, I: 1, build: 0, drop: 0, wipe: (age % 1) / 1, wdir: 1, mb: t / BEAT }, pal, 1);
  }, 3);
  assert.ok(r.worst <= 2, `Lichtwisch (ein Durchgang je Sekunde): ${r.worst} Wechsel pro Sekunde`);
}

console.log("noflash: ok");
