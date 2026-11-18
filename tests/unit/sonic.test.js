// node tests/unit/sonic.test.js
// Klang-Detektoren (sonic.js), Laufzeit (sonicrt.js) und ihre Bilder (instfx.js) auf künstlichen Signalen:
// Treffer, Fehlalarme, Schwellen, Vorrang/Abklingzeiten, „Keine Blitze“. Ohne Netz, ohne Ton.
const assert = require("assert");
const { load } = require("./load.js");
const { onsetEnvelope, tempoFromEnvelope, analyzePcm } = load("tempo.js");
const S = load("sonic.js");
const RT = load("sonicrt.js");
const { createInstFx } = load("instfx.js");

const SR = 22050;
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
function hit(pcm, t, f, dec, amp, noise, rnd) {
  const i0 = Math.round(t * SR);
  for (let i = 0; i < SR * 0.3 && i0 + i < pcm.length; i++) {
    const tt = i / SR;
    pcm[i0 + i] += amp * Math.exp(-tt * dec) * (noise ? rnd() : Math.sin(2 * Math.PI * f * tt));
  }
}
function beat(pcm, bpm, from, to, hats = true) {
  const rnd = rng(3), P = 60 / bpm;
  for (let t = from, k = 0; t < to; t += P, k++) {
    hit(pcm, t, 55, 14, 0.7, false, rnd);
    if (k % 2) hit(pcm, t, 0, 25, 0.35, true, rnd);
    if (hats) hit(pcm, t + P / 2, 0, 80, 0.1, true, rnd);
  }
}
// Akkord (Grundton, Quinte, Oktave), Lautstärke über env(t)
function chord(pcm, from, to, f0, env = () => 1) {
  for (let i = Math.round(from * SR); i < Math.min(pcm.length, to * SR); i++) {
    const t = i / SR;
    pcm[i] += 0.12 * env(t) * (Math.sin(2 * Math.PI * f0 * t) + 0.6 * Math.sin(2 * Math.PI * f0 * 1.5 * t) + 0.4 * Math.sin(2 * Math.PI * f0 * 2 * t));
  }
}
function noiseRiser(pcm, from, to) {
  const rnd = rng(11);
  let y = 0;
  for (let i = Math.round(from * SR); i < Math.min(pcm.length, to * SR); i++) {
    const p = (i / SR - from) / (to - from), a = 1 - Math.exp((-2 * Math.PI * 300 * Math.pow(40, p)) / SR);
    y += a * (rnd() - y);
    pcm[i] += 0.5 * (0.15 + p) * y;
  }
}
function boom(pcm, t) {
  const rnd = rng(5), i0 = Math.round(t * SR);
  for (let i = 0; i < SR * 1.2 && i0 + i < pcm.length; i++) {
    const tt = i / SR;
    pcm[i0 + i] += 0.9 * Math.exp(-tt * 3) * (0.6 * rnd() + 0.8 * Math.sin(2 * Math.PI * 45 * tt));
  }
}
async function grid(pcm) {
  const sink = S.createFrameSink(SR, 1024);
  const { env, fps } = await onsetEnvelope(pcm, SR, null, sink);
  return { G: sink.grid(), bpm: tempoFromEnvelope(env, fps, 0)?.bpm || 0 };
}
const kinds = (ev) => new Set(ev.map((e) => e.k));
const STUDIO = ["riser", "sweep", "downlift", "stop", "tapestop", "revcym", "stutter", "filter", "pump", "siren", "scratch", "airhorn", "zap", "whoosh", "rewind", "subdrop"];

(async () => {
  // ---- Treffer: Rausch-Riser vor einem Einschlag, mitten in einem Beat
  {
    const pcm = new Float32Array(SR * 30);
    beat(pcm, 128, 0, 12);
    chord(pcm, 0, 30, 220, () => 0.4);
    noiseRiser(pcm, 12, 18);
    boom(pcm, 18.75);
    beat(pcm, 128, 18.75, 30);
    const { G } = await grid(pcm);
    const ev = S.detectFx(G, { bpm: 128 });
    const sw = ev.find((e) => e.k === "sweep" || e.k === "riser");
    assert.ok(sw, "Riser/Sweep vor dem Einschlag erkannt: " + JSON.stringify(ev));
    assert.ok(sw.t + sw.dur > 17.5 && sw.t + sw.dur < 19.2, "Riser endet am Einschlag: " + JSON.stringify(sw));
    const im = ev.find((e) => e.k === "impact" || e.k === "subdrop");
    assert.ok(im && Math.abs(im.t - 18.75) < 0.2, "Einschlag auf seinem Zeitpunkt: " + JSON.stringify(ev));
    for (const e of ev) assert.ok(e.c >= S.THR[e.k], `nur über der Schwelle: ${e.k} ${e.c}`);
  }
  // ---- Fehlalarm: ein gleichmäßiger Beat mit Akkorden – keine Effekte, auch kein Pumpen (es duckt nichts)
  {
    const pcm = new Float32Array(SR * 30);
    beat(pcm, 124, 0, 30);
    chord(pcm, 0, 30, 196, () => 0.5);
    const { G } = await grid(pcm);
    const ev = S.detectFx(G, { bpm: 124 });
    assert.deepStrictEqual(ev, [], "gleichmäßiger Beat: keine Effekte " + JSON.stringify(ev));
  }
  // ---- Akustisch (nur Akkorde, kein Schlagzeug): keine Studio-Effekte, auch nicht bei einem Crescendo
  {
    const pcm = new Float32Array(SR * 30);
    chord(pcm, 0, 30, 262, (t) => 0.3 + 0.7 * Math.min(1, t / 20));
    chord(pcm, 12, 30, 392, (t) => Math.min(1, (t - 12) / 6));
    const { G, bpm } = await grid(pcm);
    const ev = S.detectFx(G, { bpm });
    assert.ok(!ev.some((e) => STUDIO.includes(e.k)), "Akkorde allein: keine Studio-Effekte " + JSON.stringify(ev));
    const pal = S.palette(G, bpm);
    assert.ok(pal.conf.kick < S.THR.kick && pal.conf.hats < S.THR.hats, "ohne Schlagzeug keine Kick/Hi-Hat: " + JSON.stringify(pal.conf));
  }
  // ---- Stopp: gut eine Sekunde Stille mitten im Beat
  {
    const pcm = new Float32Array(SR * 30);
    beat(pcm, 120, 0, 14);
    chord(pcm, 0, 14, 220, () => 0.5);
    beat(pcm, 120, 15.2, 30);
    chord(pcm, 15.2, 30, 220, () => 0.5);
    for (let i = 14 * SR; i < 15.2 * SR; i++) pcm[i] = 0;
    const { G } = await grid(pcm);
    const st = S.detectFx(G, { bpm: 120 }).find((e) => e.k === "stop");
    assert.ok(st && st.t > 13.7 && st.t < 14.6, "Stopp erkannt: " + JSON.stringify(st));
  }
  // ---- Sidechain-Pumpen: Akkord duckt unter jeder Kick → Pumpen (ohne Ducken nicht, siehe oben)
  {
    const pcm = new Float32Array(SR * 30), P = 60 / 126;
    beat(pcm, 126, 0, 30);
    chord(pcm, 0, 30, 440, (t) => 0.15 + 1.1 * Math.min(1, ((t % P) / P) * 1.6));
    // dazu ein Shaker-Rauschen wie in echten Produktionen (sonst wirkt das Signal „akustisch“, und Studio-Effekte fallen weg)
    const rnd = rng(9);
    for (let i = 0; i < pcm.length; i++) pcm[i] += 0.06 * rnd();
    const { G } = await grid(pcm);
    assert.ok(kinds(S.detectFx(G, { bpm: 126 })).has("pump"), "Pumpen erkannt");
  }
  // ---- Palette: Beat mit Hi-Hats → Kick und Hi-Hat sicher
  {
    const pcm = new Float32Array(SR * 30);
    beat(pcm, 128, 0, 30);
    chord(pcm, 0, 30, 220, () => 0.3);
    const rnd = rng(13);
    for (let i = 0; i < pcm.length; i++) pcm[i] += 0.03 * rnd();
    // deutliche Hi-Hats auf den Achteln
    for (let t = 60 / 256; t < 30; t += 60 / 128) hit(pcm, t, 0, 60, 0.3, true, rnd);
    const { G } = await grid(pcm);
    const pal = S.palette(G, 128);
    assert.ok(pal.conf.kick >= S.THR.kick, "Kick: " + JSON.stringify(pal.conf));
    assert.ok(pal.conf.hats >= S.THR.hats, "Hi-Hat: " + JSON.stringify(pal.conf));
  }
  // ---- ganze Kette (tempo.js → sonic): Palette, Effekte und Raster fürs Wiederfinden kommen mit
  {
    const pcm = new Float32Array(SR * 30);
    beat(pcm, 128, 0, 30);
    const r = await analyzePcm(pcm, SR, 0, null, true);
    assert.ok(r.sonic && r.sonic.inst && r.sonic.grid.loud.length > 500 && !r.sonic.grid.frames, "sonic-Ergebnis klein und vollständig");
    const r0 = await analyzePcm(pcm, SR);
    assert.strictEqual(r0.sonic, null, "ohne Wunsch keine Klang-Rechnung");
    assert.strictEqual(r0.bpm, r.bpm, "Tempo unverändert");
  }
  // ---- Spotify-Segmente: Helligkeit steigt 4 s vor einem harten Einsatz → Riser; Lautheitsloch → Stopp
  {
    const segs = [];
    for (let t = 0; t < 60; t += 0.25) {
      const inRise = t >= 20 && t < 24, after = t >= 24 && t < 24.3, gap = t >= 40 && t < 41;
      segs.push({ t, l: gap ? -50 : inRise ? -14 + (t - 20) * 2 : -10 + (t % 0.5 ? -2 : 0), p: [1, 0.2, 0.1, 0.1, 0.6, 0.1, 0.1, 0.8, 0.1, 0.1, 0.1, 0.1], b: inRise ? 20 + (t - 20) * 30 : 40 + (t % 0.5 ? 6 : -6), f: 10, k: after ? 120 : t % 0.5 ? 20 : 60 });
    }
    const G = S.gridFromSegs(segs);
    const ev = S.detectFx(G, { bpm: 120 });
    assert.ok(ev.some((e) => e.k === "riser" && e.t >= 18 && e.t + e.dur > 23.5), "Segmente: Riser " + JSON.stringify(ev));
    assert.ok(ev.some((e) => e.k === "stop" && Math.abs(e.t - 40) < 0.4), "Segmente: Stopp " + JSON.stringify(ev));
  }
  // ---- Hörprobe im Song wiederfinden (Lautheitsverlauf)
  {
    const n = 20 * 240, loud = new Float32Array(n);
    for (let x = 0; x < n; x++) loud[x] = -20 + 8 * Math.sin(x / 37) + 5 * Math.sin(x / 11.3) + (x > 2400 && x < 2600 ? 6 : 0);
    const prev = { r: 20, n: 600, loud: loud.slice(1900, 2500) };
    const a = S.alignPreview({ r: 20, n, loud }, prev);
    assert.ok(a && Math.abs(a.off - 95) < 0.3 && a.r > 0.95, "Lage der Hörprobe: " + JSON.stringify(a));
  }
  // ---- Mischer: Vorrang, höchstens n zugleich, Abklingzeit, weiches Ende
  {
    const mx = S.createMixer();
    const ev = [{ k: "riser", t: 0, dur: 4, c: 0.9 }, { k: "scratch", t: 1, dur: 1, c: 0.86 }, { k: "siren", t: 1, dur: 2, c: 0.9 }, { k: "impact", t: 3.9, dur: 1, c: 0.9 }, { k: "impact", t: 5, dur: 1, c: 0.95 }];
    const a = mx.at(ev, 1.5, { max: 2 });
    assert.deepStrictEqual(a.map((f) => f.k), ["riser", "siren"], "Vorrang: Riser vor Sirene (sicherer) vor Scratch, höchstens 2");
    assert.ok(a[0].e > 0 && a[0].p > 0.3 && a[0].p < 0.4, "Fortschritt des Risers");
    for (let s = 1.6; s < 4.95; s += 0.05) mx.at(ev, s, { max: 3 });
    const b = mx.at(ev, 5.1, { max: 3 });
    assert.ok(!b.some((f) => f.k === "impact" && Math.abs(f.p - 0.1) < 0.05), "zweiter Einschlag binnen der Abklingzeit fällt weg: " + JSON.stringify(b));
    const lite = S.createMixer().at(ev, 1.5, { max: 1 });
    assert.strictEqual(lite.length, 1, "Leicht: nur einer");
    const late = S.createMixer().at(ev, 4.3, { max: 3 }).find((f) => f.k === "riser");
    assert.ok(late && late.e > 0 && late.e < 1, "weiches Ausblenden nach dem Ende");
  }
  // ---- Laufzeit: Teile des Songs, Regie-Ereignisse nur mit Bestätigung der Hörprobe
  {
    assert.strictEqual(RT.partGate("drums", "intro", 0.9), 0, "kein Schlagzeug-Bild im Intro");
    assert.ok(RT.partGate("loud", "chorus", 0.9) > 0.9 && RT.partGate("loud", "verse", 0.4) === 0, "Gitarrenwand nur im lauten Teil");
    assert.ok(RT.partGate("soft", "verse", 0.4) > 0.9 && RT.partGate("soft", "drop", 0.4) === 0, "Klavier nicht im Drop");
    const st = { ev: [] };
    RT.directorEvents({ riser: 0.9, impact: 0.8 }, { build: 0.6, toDrop: 4, dropHit: false }, 10, st);
    RT.directorEvents({ riser: 0.9, impact: 0.8 }, { build: 0.1, toDrop: 99, dropHit: true }, 14, st);
    assert.deepStrictEqual(st.ev.map((e) => e.k), ["riser", "impact"], "Regie + Hörprobe: Riser bis zum Drop, Einschlag auf dem Drop");
    const st2 = { ev: [] };
    RT.directorEvents({ riser: 0.3, impact: 0.2 }, { build: 0.9, toDrop: 4, dropHit: true }, 10, st2);
    assert.strictEqual(st2.ev.length, 0, "unsichere Hörprobe: keine Effekte");
    // ganze Laufzeit: nur Hörprobe → Instrumente gedämpft und nach Teil
    const rt = RT.createSonicRuntime();
    const pv = { inst: { kick: 0.9, distguitar: 0.9, piano: 0.2 }, fx: { riser: 0.9 }, events: [], grid: null };
    rt.prepare("u", null, pv);
    await new Promise((r) => setTimeout(r, 5));
    let out;
    for (let i = 0; i < 120; i++) out = rt.frame(30 + i / 60, 1 / 60, { kind: "chorus", energy: 0.85, build: 0, toDrop: 99 });
    assert.ok(out.lv.kick > 0.4 && out.lv.kick <= 0.71 && out.lv.guitar > 0.4, "Kick und Gitarre im Refrain, gedämpft: " + JSON.stringify(out.lv));
    assert.strictEqual(out.lv.piano, 0, "Klavier unter der Schwelle: nichts");
    assert.strictEqual(out.src, "preview");
    for (let i = 0; i < 240; i++) out = rt.frame(40 + i / 60, 1 / 60, { kind: "intro", energy: 0.3, build: 0, toDrop: 99 });
    assert.ok(out.lv.kick < 0.05 && out.lv.guitar < 0.05, "im ruhigen Intro wieder aus");
  }
  // ---- Bilder: jede Art zeichnet etwas, nichts wirft, „Keine Blitze“ zeichnet keinen großen Aufschein beim Einschlag
  {
    const calls = { n: 0, bright: 0 };
    const ctx = new Proxy(
      {},
      {
        get(o, k) {
          if (k in o) return o[k];
          if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
          if (k === "drawImage") return (img, x, y, w) => (calls.n++, w > 500 && calls.bright++);
          return () => calls.n++;
        },
        set(o, k, v) {
          o[k] = v;
          return true;
        },
      },
    );
    const fx = createInstFx(() => ({}));
    const pal = [[200, 60, 120], [60, 120, 220], [240, 180, 60]];
    const st = (inst, noFlash) => ({ t: 3, dt: 0.016, vw: 1280, vh: 720, dpr: 1, pal, cx: 640, cy: 330, R: 120, bpm: 120, quality: 2, noFlash, inst, px: { kickEnv: 0.6, snareEnv: 0.3, hatEnv: 0.8, beat: 0.5, phase: 0.3, beatIdx: 16, energy: 0.8, kind: "chorus" } });
    for (const k of RT.SOUND.concat(["piano"])) {
      calls.n = 0;
      fx.draw(ctx, st({ [k]: 1, sfx: [] }, false));
      assert.ok(calls.n > 0, "Instrument zeichnet: " + k);
    }
    for (const k of S.FX) {
      calls.n = 0;
      fx.draw(ctx, st({ sfx: [{ k, p: 0.05, e: 1, c: 1 }] }, false));
      assert.ok(calls.n > 0, "Effekt zeichnet: " + k);
      assert.strictEqual(ctx.globalCompositeOperation, "lighter", "Mischmodus zurückgesetzt nach " + k);
    }
    calls.bright = 0;
    fx.draw(ctx, st({ sfx: [{ k: "impact", p: 0.05, e: 1, c: 1 }] }, true));
    const nf = calls.bright;
    calls.bright = 0;
    fx.draw(ctx, st({ sfx: [{ k: "impact", p: 0.05, e: 1, c: 1 }] }, false));
    assert.ok(nf === 0 && calls.bright > 0, "„Keine Blitze“: kein großer Aufschein beim Einschlag");
  }
  // ---- Runde 11: Stärke aus der Sicherheit – nichts unter der Schwelle, zart knapp darüber, voll bei voller Sicherheit
  {
    assert.strictEqual(S.strength("kick", S.THR.kick - 0.01), 0, "unter der Schwelle: nichts");
    assert.strictEqual(S.strength("kick", S.THR.kick), 0.4, "knapp sicher: zart");
    assert.strictEqual(S.strength("kick", 1), 1, "ganz sicher: voll");
    assert.ok(S.strength("kick", 0.8) > 0.4 && S.strength("kick", 0.8) < 1, "dazwischen gestuft");
    for (const k of ["pad", "organ", "bells", "scratch"]) assert.strictEqual(S.strength(k, 1), 0, "abgeschaltet: " + k);
    const mx = S.createMixer();
    const ev = [{ k: "riser", t: 0, dur: 4, c: S.THR.riser }, { k: "impact", t: 0, dur: 2, c: 1, w: 0.85 }, { k: "scratch", t: 0, dur: 2, c: 1, forced: true }];
    const a = mx.at(ev, 1, { max: 3 });
    assert.strictEqual(a.find((f) => f.k === "riser").s, 0.4, "Mischer: knapp sicherer Riser zart");
    assert.strictEqual(a.find((f) => f.k === "impact").s, 0.85, "Mischer: Regie-Zeitpunkt (w) eine Spur zarter");
    assert.strictEqual(a.find((f) => f.k === "scratch").s, 1, "Mischer: von Hand ausgelöst (Fehlersuche) voll, auch wenn die Art aus ist");
    // Regie-Ereignisse tragen die Sicherheit der Hörprobe, nicht abgeschwächt (sonst fielen sie unter die Schwelle)
    const st = { ev: [] };
    RT.directorEvents({ impact: S.THR.impact }, { build: 0, toDrop: 99, dropHit: true }, 5, st);
    assert.ok(st.ev[0] && st.ev[0].c === S.THR.impact && st.ev[0].w === 0.85, "Regie: c bleibt, w dämpft: " + JSON.stringify(st.ev));
    // Laufzeit: knapp sichere Kick zart, sichere voll – abgeschaltete Arten (Fläche) nie
    const lvOf = async (inst) => {
      const rt = RT.createSonicRuntime();
      rt.prepare("u" + Math.random(), null, { inst, fx: {}, events: [], grid: null });
      await new Promise((r) => setTimeout(r, 5));
      let out;
      for (let i = 0; i < 240; i++) out = rt.frame(30 + i / 60, 1 / 60, { kind: "chorus", energy: 0.9, build: 0, toDrop: 99 });
      return out.lv;
    };
    const lo = await lvOf({ kick: S.THR.kick, pad: 0.99 }), hi = await lvOf({ kick: 1 });
    assert.ok(lo.kick > 0.2 && lo.kick < hi.kick * 0.5, `knapp sicher zart (${lo.kick}) gegen sicher (${hi.kick})`);
    assert.strictEqual(lo.pad, 0, "Fläche ist aus");
    // Bild: dieselbe Wirkung mit s = 0,4 deutlich blasser als mit s = 1
    const alpha = { sum: 0 };
    const ctx = new Proxy(
      {},
      {
        get(o, k) {
          if (k in o) return o[k];
          if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
          if (k === "drawImage") return () => (alpha.sum += o.globalAlpha ?? 1);
          return () => {};
        },
      },
    );
    const fxd = createInstFx(() => ({}));
    const st2 = (s) => ({ t: 3, dt: 0.016, vw: 1280, vh: 720, dpr: 1, pal: [[200, 60, 120], [60, 120, 220], [240, 180, 60]], cx: 640, cy: 330, R: 120, bpm: 120, quality: 2, inst: { sfx: [{ k: "revcym", p: 0.6, e: 1, c: 1, s }] }, px: { kickEnv: 0.5, energy: 0.8, kind: "chorus" } });
    alpha.sum = 0;
    fxd.draw(ctx, st2(0.4));
    const weak = alpha.sum;
    alpha.sum = 0;
    fxd.draw(ctx, st2(1));
    assert.ok(weak > 0 && weak < alpha.sum * 0.5, `Bild zart bei s = 0,4 (${weak.toFixed(2)} gegen ${alpha.sum.toFixed(2)})`);
  }
  // ---- Runde 11: Einblenden aus digitaler Stille – Rauschanteil bleibt endlich (früher liefen die Maße gegen 10^12)
  {
    const pcm = new Float32Array(SR * 30);
    chord(pcm, 0.5, 30, 220, (t) => Math.min(1, (t - 0.5) * 2));
    const { G } = await grid(pcm);
    const fr = G.frames;
    assert.ok(Math.max(...fr.flat) <= 1.0001 && Math.max(...fr.mflat) <= 1.0001, "Rauschanteil ≤ 1 auch an der Stille");
    assert.ok(S.palette(G, 0).feats.mflat < 0.1, "Akkord bleibt klar: " + S.palette(G, 0).feats.mflat);
  }
  // ---- Runde 11: Pumpen erst ab zwei sicheren Fenstern; Palette aus Zahlen allein (paletteConf)
  {
    const one = S.fxSelect([{ k: "pump", t: 0, dur: 4, c: 0.95 }], 30);
    assert.deepStrictEqual(one, [], "ein Pump-Fenster allein ist Zufall");
    const two = S.fxSelect([{ k: "pump", t: 0, dur: 4, c: 0.95 }, { k: "pump", t: 4, dur: 4, c: 0.8 }], 30);
    assert.strictEqual(two.length, 2, "zwei Fenster: Pumpen");
    const z = S.paletteConf(null);
    assert.ok(S.INST.every((k) => z[k] === 0), "ohne Zahlen keine Sicherheit");
  }
  console.log("sonic: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
