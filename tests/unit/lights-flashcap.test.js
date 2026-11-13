// Blitz-Schranke der Overlay-App: höchstens 3 Blitze pro Sekunde, mit „Keine Blitze“ (nf) gar keine – für
// Kantenlicht/OBS (createPartyGuard) und für die Lampen (lights.js gegen eine nachgebaute Hue-Bridge und
// einen WLED-Empfänger auf 127.0.0.1). Aufruf: node tests/unit/lights-flashcap.test.js
const assert = require("assert");
const http = require("http");
const dgram = require("dgram");
const { createFlashCap, createPartyGuard, FLASH_GAP, CALM_GAP } = require("../../overlay/flashcap.js");
const { createLights, toXy } = require("../../overlay/lights.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// in jedem Fenster von 1 s höchstens max Zeitpunkte
function perSecond(times, max, what) {
  for (let i = 0; i < times.length; i++) {
    const n = times.filter((h) => h >= times[i] && h < times[i] + 1).length;
    assert.ok(n <= max, `${what}: ${n} in einer Sekunde (ab ${times[i].toFixed(2)} s)`);
  }
}
// Blitze, wie man sie im Ergebnis sieht: Schlag-Pegel steigt über 0,55 (nach unter 0,4) oder Drop über 0,85
function visibleFlashes(frames) {
  let hi = false, dhi = false;
  const out = [];
  for (const { t, s } of frames) {
    const kk = Math.max(s.k, s.a * 0.8);
    let f = false;
    if (kk < 0.4) hi = false;
    else if (kk > 0.55 && !hi) (hi = true), (f = true);
    if (s.d < 0.5) dhi = false;
    else if (s.d > 0.85 && !dhi) (dhi = true), (f = true);
    if (f) out.push(t);
  }
  return out;
}
// künstliche Party: Kick-Hüllkurve bei bpm, ab und zu ein Drop, ein bisschen Rauschen
function party(bpm, fps, secs, nf, jitter = 0) {
  const g = createPartyGuard(), frames = [];
  const period = 60 / bpm;
  for (let i = 0; i < fps * secs; i++) {
    const t = i / fps, ph = ((t + jitter * rnd()) % period) / period;
    const k = Math.max(0, 1 - ph * 4) + rnd() * 0.05;
    const d = Math.floor(t / 2) % 3 === 0 && (t % 2) < 0.5 + rnd() * 0.2 ? 1 : 0;
    frames.push({ t, s: g({ k, a: k * 0.7, e: 0.5 + 0.5 * Math.sin(t * 7), d, pal: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], ...(nf ? { nf: 1 } : {}) }, t) });
  }
  return frames;
}

/* ---- 1) die Schranke selbst (wie src/flashcap.js im Theme) */
{
  assert.ok(FLASH_GAP > 1 / 3);
  for (const fps of [24, 30, 60, 144, 1000]) {
    const cap = createFlashCap(), hits = [];
    for (let i = 0; i < fps * 20; i++) if (cap.take(i / fps)) hits.push(i / fps);
    assert.ok(hits.length > 20);
    perSecond(hits, 3, `Schranke ${fps} fps`);
  }
  const c = createFlashCap();
  assert.strictEqual(c.take(100), true);
  assert.strictEqual(c.take(5), false, "Uhr springt zurück: kein Blitz direkt danach");
  assert.strictEqual(c.take(5.2), false);
  assert.strictEqual(c.take(5.35), true);
}

/* ---- 2) ohne nf: jedes Tempo, jede Bildrate – nie mehr als 3 sichtbare Blitze pro Sekunde */
for (const bpm of [60, 120, 174, 200, 300, 600]) {
  for (const fps of [30, 60]) {
    const frames = party(bpm, fps, 30, false, 0.03);
    const flashes = visibleFlashes(frames);
    perSecond(flashes, 3, `${bpm} BPM, ${fps} fps`);
    perSecond(frames.filter((f) => f.s.pulse).map((f) => f.t), 3, `pulse ${bpm} BPM`);
    perSecond(frames.filter((f) => f.s.beat).map((f) => f.t), 3, `beat ${bpm} BPM`);
    assert.ok(frames.every((f) => f.s.nf === 0));
    if (bpm <= 150) {
      // langsam genug: kein Schlag geht verloren
      const beats = frames.filter((f) => f.s.beat).length;
      assert.ok(beats >= Math.floor((30 * bpm) / 60) - 2, `${bpm} BPM: nur ${beats} Schläge durchgelassen`);
    }
  }
}
// zurückgehaltener Schlag zündet nicht verspätet: Kick bleibt oben, kommt nach der Sperre nicht durch
{
  const g = createPartyGuard();
  assert.strictEqual(g({ k: 1, a: 0, e: 0, d: 0 }, 0).pulse, true);
  g({ k: 0, a: 0, e: 0, d: 0 }, 0.05);
  const held = g({ k: 1, a: 0, e: 0, d: 0 }, 0.1);
  assert.strictEqual(held.pulse, false);
  assert.ok(held.k <= 0.35);
  const later = g({ k: 1, a: 0, e: 0, d: 0 }, 0.6);
  assert.strictEqual(later.pulse, false, "derselbe Schlag darf nicht nachträglich blitzen");
  assert.ok(later.k <= 0.35);
  // Drop und Schlag im selben Bild: ein Blitz
  const g2 = createPartyGuard();
  const both = g2({ k: 1, a: 1, e: 1, d: 1 }, 0);
  assert.strictEqual(both.pulse, true);
  assert.strictEqual(both.d, 1);
  assert.strictEqual(both.k, 1);
}

/* ---- 3) nf: keine Spitzen, kein Drop, Energie geglättet, Farbwechsel höchstens alle 0,6 s */
for (const bpm of [90, 128, 300]) {
  const frames = party(bpm, 30, 20, true);
  assert.deepStrictEqual(visibleFlashes(frames), [], `${bpm} BPM mit nf: es blitzt`);
  for (const f of frames) {
    assert.strictEqual(f.s.nf, 1);
    assert.strictEqual(f.s.pulse, false);
    assert.strictEqual(f.s.d, 0);
    assert.strictEqual(f.s.a, 0);
    assert.ok(f.s.k <= 0.3);
  }
  // die Energie springt mit 7 rad/s hin und her – ankommen darf nur eine ruhige Kurve
  for (let i = 1; i < frames.length; i++) assert.ok(Math.abs(frames[i].s.e - frames[i - 1].s.e) < 0.05, "Energie springt");
  const beats = frames.filter((f) => f.s.beat).map((f) => f.t);
  assert.ok(beats.length > 5, "mit nf sollen die Farben trotzdem wechseln");
  for (let i = 1; i < beats.length; i++) assert.ok(beats[i] - beats[i - 1] >= CALM_GAP - 1e-9);
}
// andere Felder (Palette, edge) kommen unverändert durch; Unsinn wird zu 0
{
  const s = createPartyGuard()({ k: "x", a: null, e: 7, d: -1, pal: [[9, 9, 9]], edge: false }, 0);
  assert.deepStrictEqual([s.k, s.a, s.e, s.d, s.edge], [0, 0, 1, 0, false]);
  assert.deepStrictEqual(s.pal, [[9, 9, 9]]);
}

/* ---- 4) Lampen: nachgebaute Hue-Bridge und WLED-Empfänger */
function fakeHue(user) {
  const lights = { 1: { name: "A", state: { on: true, bri: 100, xy: [0.4, 0.4] } }, 2: { name: "B", state: { on: true, bri: 100, xy: [0.3, 0.3] } } };
  const puts = [];
  const srv = http.createServer((req, res) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      const m = req.url.match(/^\/api\/([^/]+)(\/.*)?$/), p = m?.[2] || "";
      let out = null;
      if (!m || m[1] !== user) out = [{ error: { type: 1 } }];
      else if (req.method === "GET" && p === "/lights") out = lights;
      else if (req.method === "GET" && /^\/groups\/\d+$/.test(p)) out = { lights: ["1", "2"] };
      else if (req.method === "PUT") puts.push({ at: Date.now(), body: JSON.parse(s) }), (out = [{ success: true }]);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(out));
    });
  });
  return { srv, puts };
}

(async () => {
  const USER = "flashtest-0123456789abcdef";
  const hue = fakeHue(USER);
  await new Promise((r) => hue.srv.listen(0, "127.0.0.1", r));
  const udp = dgram.createSocket("udp4"), frames = [];
  udp.on("message", (b) => frames.push({ at: Date.now(), b: Buffer.from(b) }));
  await new Promise((r) => udp.bind(0, "127.0.0.1", r));
  const wledHttp = http.createServer((_q, res) => res.end(JSON.stringify({ on: true, bri: 100 })));
  await new Promise((r) => wledHttp.listen(0, "127.0.0.1", r));
  const cfg = {
    lightBright: 100, lightMax: 100, hueOn: true, hueIp: `127.0.0.1:${hue.srv.address().port}`, hueUser: USER, hueGroup: "1",
    wledOn: true, wledIp: `127.0.0.1:${udp.address().port}`, wledLeds: 6,
  };
  const pal = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
  const WHITE = JSON.stringify(toXy([255, 255, 255]));
  const lights = createLights(() => cfg, () => {}, { wledHttpPort: wledHttp.address().port });

  // a) ohne nf, Kick alle 100 ms (600 BPM) mit Dauer-Drop: höchstens 3 Hue-Befehle pro Sekunde
  for (let i = 0; i < 40; i++) {
    lights.feed({ k: i % 3 === 0 ? 1 : 0, a: 0, e: 1, d: 1, pal });
    await sleep(33);
  }
  await sleep(300);
  perSecond(hue.puts.map((p) => p.at / 1000), 3, "Hue ohne nf");
  assert.ok(hue.puts.length >= 2, "Hue hat nichts bekommen");
  await lights.stopAll();

  // b) nf: Drop und harte Kicks – nie Weiß, langes Überblenden, WLED ohne Weiß-Anteil und ohne harte Sprünge
  hue.puts.length = 0;
  frames.length = 0;
  for (let i = 0; i < 90; i++) {
    lights.feed({ k: i % 6 === 0 ? 1 : 0, a: 0, e: 1, d: 1, pal, nf: 1 });
    await sleep(33);
  }
  await sleep(200);
  const party = hue.puts.filter((p) => p.body.transitiontime !== 10); // 10 = Wiederherstellen
  assert.ok(party.length >= 2, "mit nf sollen die Farben weiter wechseln");
  for (const p of party) {
    assert.notStrictEqual(JSON.stringify(p.body.xy), WHITE, "nf: Hue wird weiß");
    assert.strictEqual(p.body.transitiontime, 8);
  }
  for (let i = 1; i < party.length; i++) assert.ok(party[i].at - party[i - 1].at >= CALM_GAP * 1000 - 50);
  assert.ok(frames.length > 10, "keine WLED-Bilder");
  for (const { b } of frames) {
    // reines Rot/Grün/Blau gemischt, ohne Weiß: in jeder LED bleibt ein Kanal bei 0
    for (let i = 0; i < 6; i++) assert.strictEqual(Math.min(b[2 + i * 3], b[3 + i * 3], b[4 + i * 3]), 0, "nf: WLED wird weiß");
  }
  // Helligkeit von Bild zu Bild: keine Sprünge (max. Kanal der mittleren LED)
  const mid = frames.map(({ b }) => Math.max(b[2 + 3 * 3], b[3 + 3 * 3], b[4 + 3 * 3]));
  for (let i = 1; i < mid.length; i++) assert.ok(Math.abs(mid[i] - mid[i - 1]) <= 40, `WLED springt: ${mid[i - 1]} → ${mid[i]}`);
  await lights.stopAll();

  hue.srv.close();
  wledHttp.close();
  udp.close();
  console.log("lights-flashcap: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
