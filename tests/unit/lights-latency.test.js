// Verzögerung je Gerät: die verschobene Sicht (früher/später senden), die Werte je Gerät und Bridge und das
// Einmessen gegen eine nachgebaute Hue-Bridge auf 127.0.0.1. Aufruf: node tests/unit/lights-latency.test.js
const assert = require("assert");
const http = require("http");
const dgram = require("dgram");
const { createLights, createBeatView, latOf, latPatch, LAT_MAX } = require("../../overlay/lights.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- 1) Werte je Gerät, Hue je Bridge, Grenzen */
{
  assert.strictEqual(LAT_MAX, 1000);
  const c = { hueIp: "192.168.1.20", latHue: "192.168.1.20=120, 10.0.0.5=-40", latWled: 30, latHa: "x", latGovee: 99999, latOrgb: -99999 };
  assert.strictEqual(latOf(c, "hue"), 120);
  assert.strictEqual(latOf({ ...c, hueIp: "10.0.0.5" }, "hue"), -40);
  assert.strictEqual(latOf({ ...c, hueIp: "10.0.0.9" }, "hue"), 0);
  assert.strictEqual(latOf(c, "wled"), 30);
  assert.strictEqual(latOf(c, "ha"), 0);
  assert.strictEqual(latOf(c, "govee"), 1000);
  assert.strictEqual(latOf(c, "orgb"), -1000);
  assert.strictEqual(latOf(c, "chroma"), 0);
  assert.deepStrictEqual(latPatch(c, "wled", 55.4), { latWled: 55 });
  assert.deepStrictEqual(latPatch(c, "ha", -5000), { latHa: -1000 });
  assert.deepStrictEqual(latPatch(c, "hue", 200), { latHue: "10.0.0.5=-40, 192.168.1.20=200" });
  assert.deepStrictEqual(latPatch(c, "hue", 0), { latHue: "10.0.0.5=-40" });
  assert.strictEqual(latPatch({ hueIp: "" }, "hue", 50), null);
  assert.strictEqual(latPatch(c, "nope", 50), null);
  assert.strictEqual(latPatch(c, "wled", NaN), null);
  // kaputte Einträge werden überlesen
  assert.strictEqual(latOf({ hueIp: "1.2.3.4", latHue: "foo=3; 1.2.3.4=abc, 1.2.3.4=70" }, "hue"), 70);
}

/* ---- 2) verschobene Sicht bei gleichmäßigem Takt (Zeit von Hand, 500 ms je Schlag, Zustand alle 25 ms) */
{
  const bv = createBeatView(), P = 500, hitAt = (b) => b * P; // Schlag b bei b·500 ms
  let beat = 0, kick = 0;
  const kickAt = new Map();
  // für jede Millisekunde: welche Schlagnummer zeigt die Sicht?
  const seen = { 0: [], 120: [], "-200": [], 620: [] };
  for (let t = P; t <= 12 * P; t++) {
    if (t % 25 === 0) {
      const hit = t % P === 0;
      if (hit) {
        beat++;
        kick = 1;
        bv.hit(t);
      } else kick *= 0.8;
      kickAt.set(t, kick);
      bv.push({ t, st: { k: kick }, beat, kick });
    }
    for (const off of Object.keys(seen)) seen[off][t] = bv.view(Number(off), t);
  }
  assert.strictEqual(bv.period(12 * P), P);
  const firstAt = (off, b) => seen[off].findIndex((v, t) => t >= 6 * P && v && v.beat === b);
  // ab dem 8. Schlag ist der Takt sicher erkannt
  for (let b = 8; b <= 11; b++) {
    assert.strictEqual(firstAt(0, b), hitAt(b), "ohne Vorlauf: genau zum Schlag");
    assert.strictEqual(firstAt(120, b), hitAt(b) - 120, "120 ms Vorlauf: 120 ms vor dem Schlag");
    assert.strictEqual(firstAt(-200, b), hitAt(b) + 200, "−200 ms: 200 ms nach dem Schlag");
    // Vorlauf länger als ein Schlagabstand: zwei Schläge voraus gerechnet
    assert.strictEqual(firstAt(620, b), hitAt(b) - 620);
  }
  // auch der Verlauf zwischen den Schlägen ist verschoben (Kick-Hüllkurve)
  assert.strictEqual(seen[120][9 * P + 80].kick, kickAt.get(8 * P + 200));
  assert.strictEqual(seen["-200"][9 * P + 300].kick, kickAt.get(9 * P + 100));
  // Schlag bleibt aus (Break): kein Raten mehr, es gilt der Zustand von jetzt
  const late = 12 * P + 900;
  assert.strictEqual(bv.period(late), 0);
  assert.strictEqual(bv.view(120, late).beat, beat);
  bv.reset();
  assert.strictEqual(bv.view(120, late).beat, 0);
}

/* ---- 3) unruhiger Takt: kein Vorlauf, aber Verzögern geht immer */
{
  const bv = createBeatView();
  let beat = 0, t = 0;
  for (const gap of [400, 700, 300, 900, 450, 520]) {
    t += gap;
    bv.hit(t);
    bv.push({ t, st: null, beat: ++beat, kick: 1 });
  }
  assert.strictEqual(bv.period(t + 10), 0);
  assert.strictEqual(bv.view(150, t + 10).beat, beat);
  assert.strictEqual(bv.view(-100, t + 10).beat, beat - 1);
  // noch zu wenige Schläge
  const young = createBeatView();
  for (const x of [500, 1000, 1500]) young.hit(x), young.push({ t: x, st: null, beat: x / 500, kick: 1 });
  assert.strictEqual(young.period(1510), 0);
}

/* ---- 4) Einmessen in Echtzeit gegen eine nachgebaute Hue-Bridge: der Befehl kommt um den Vorlauf früher */
(async () => {
  const USER = "testuser-1234567890abcdef", puts = [];
  const state = { on: true, bri: 100, xy: [0.4, 0.4] };
  const srv = http.createServer((req, res) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      const p = req.url.replace(`/api/${USER}`, "");
      let out = null;
      if (p === "/groups/1") out = { lights: ["5", "6"] };
      else if (p === "/lights") out = { 5: { name: "A", state: { ...state } }, 6: { name: "B", state: { ...state } } };
      else if (req.method === "PUT") {
        puts.push({ at: Date.now(), id: p.split("/")[2], body: JSON.parse(s) });
        out = [{ success: true }];
      }
      res.end(JSON.stringify(out));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  // WLED ist eingeschaltet, darf beim Einmessen von Hue aber nichts bekommen
  const udp = dgram.createSocket("udp4");
  let wledFrames = 0;
  udp.on("message", () => wledFrames++);
  await new Promise((r) => udp.bind(0, "127.0.0.1", r));

  const ip = `127.0.0.1:${srv.address().port}`;
  const cfg = { lightBright: 100, lightMax: 100, hueOn: false, hueIp: ip, hueUser: USER, hueGroup: "1", latHue: "", wledOn: true, wledIp: `127.0.0.1:${udp.address().port}`, wledLeds: 5 };
  const lights = createLights(() => cfg, () => {}, { wledHttpPort: 1 });
  const PERIOD = 300;

  // offset ms Vorlauf einstellen, 12 Schläge laufen lassen, je Schlag den Abstand Befehl → Schlag messen
  async function run(offset) {
    Object.assign(cfg, lights.latPatch("hue", offset));
    assert.strictEqual(lights.latAll().hue, offset);
    puts.length = 0;
    const beats = [];
    let ended = false;
    assert.strictEqual(await lights.calibrate("hue", (bright) => (bright === null ? (ended = true) : beats.push({ at: Date.now(), bright })), PERIOD), true);
    assert.strictEqual(lights.calibrating(), true);
    // Party-Daten vom Theme zählen währenddessen nicht
    lights.feed({ k: 1, a: 1, e: 1, d: 1 });
    await sleep(200 + 12.5 * PERIOD);
    await lights.stopAll();
    assert.strictEqual(ended, true, "Ende des Einmessens wurde nicht gemeldet");
    assert.strictEqual(lights.calibrating(), false);
    assert.ok(beats.length >= 11, `zu wenige Schläge: ${beats.length}`);
    for (let i = 1; i < beats.length; i++) assert.notStrictEqual(beats[i].bright, beats[i - 1].bright, "hell und dunkel müssen sich abwechseln");
    // nur die erste Lampe blinkt; die letzte Meldung ist das Wiederherstellen
    const blink = puts.filter((p) => p.body.transitiontime === 0);
    assert.ok(blink.every((p) => p.id === "5"));
    assert.ok(blink.some((p) => p.body.bri === 254) && blink.some((p) => p.body.bri < 30));
    assert.deepStrictEqual(puts.at(-1).body, { on: true, bri: 100, transitiontime: 10, xy: [0.4, 0.4] });
    // ab dem 7. Schlag ist der Takt erkannt: zu jedem Schlag den passenden Befehl suchen
    const leads = [];
    for (const b of beats.slice(6, 11)) {
      const want = b.bright ? (p) => p.body.bri === 254 : (p) => p.body.bri < 30;
      const near = blink.filter(want).sort((x, y) => Math.abs(b.at - offset - x.at) - Math.abs(b.at - offset - y.at))[0];
      assert.ok(near, "kein Befehl zum Schlag gefunden");
      leads.push(b.at - near.at);
    }
    return leads;
  }
  // Toleranz: 16-ms-Schleife, Zeitgeber von Windows und der HTTP-Weg auf dem eigenen Rechner. Gewertet wird
  // der mittlere von fünf Schlägen – ein einzelner verspäteter Zeitgeber (Rechner unter Last) zählt nicht.
  const within = (leads, lo, hi, what) => {
    const mid = [...leads].sort((a, b) => a - b)[leads.length >> 1];
    assert.ok(mid >= lo && mid <= hi, `${what}: Abstand ${mid} ms außerhalb ${lo}…${hi} (${leads})`);
  };
  within(await run(0), -60, 5, "ohne Vorlauf");
  within(await run(150), 95, 165, "150 ms Vorlauf");
  within(await run(-100), -175, -95, "100 ms später");
  assert.strictEqual(wledFrames, 0, "WLED hat beim Einmessen von Hue Daten bekommen");

  // unbekanntes Gerät: kein Einmessen
  assert.strictEqual(await lights.calibrate("toaster", () => {}), false);
  assert.strictEqual(lights.calibrating(), false);
  // WLED einmessen: jetzt bekommt der Streifen Bilder, abwechselnd hell und dunkel, alles weiß
  const frames = [];
  udp.on("message", (b) => frames.push(Buffer.from(b)));
  await lights.calibrate("wled", () => {}, PERIOD);
  await sleep(200 + 4.5 * PERIOD);
  await lights.stopAll();
  const mids = new Set(frames.map((f) => (f[2 + 6] > 128 ? "hell" : "dunkel")));
  assert.deepStrictEqual([...mids].sort(), ["dunkel", "hell"]);
  assert.ok(frames.every((f) => f[2] === f[3] && f[3] === f[4]), "Einmessen sollte weiß blinken");

  srv.close();
  udp.close();
  console.log("lights-latency: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
