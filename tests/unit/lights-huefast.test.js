// Hue schnell (Entertainment): lights.js gegen eine nachgebaute Bridge (REST v1 + CLIP v2 über HTTP auf 127.0.0.1)
// und eine nachgebaute DTLS-Verbindung. Geprüft: Ablauf beim Einschalten, 50 Bilder pro Sekunde, REST lässt die
// Lampen des Bereichs in Ruhe, Rückfall auf REST bei jedem Fehler, Aufräumen in der richtigen Reihenfolge, keine
// Schlüssel im Protokoll. Dazu das Festnageln des Bridge-Zertifikats (hue-stream.js, HTTPS mit Test-Zertifikat).
// Die echte DTLS-Strecke prüft tests/dtls/. Aufruf: node tests/unit/lights-huefast.test.js
const assert = require("assert");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");
const { createLights } = require("../../overlay/lights.js");
const { createHueV2 } = require("../../overlay/hue-stream.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const USER = "fastuser-0123456789abcdef", CKEY = "00112233445566778899AABBCCDDEEFF", APPID = "11111111-2222-4333-8444-555555555555";
const AREA = "1a8d99cc-967b-44f2-9202-43f976c0fa6b";

function fakeBridge() {
  const lights = {
    1: { state: { on: true, bri: 100, xy: [0.4, 0.4] } },
    2: { state: { on: false, bri: 50, xy: [0.3, 0.3] } },
    3: { state: { on: true, bri: 200, xy: [0.2, 0.2] } },
    9: { state: { on: true, bri: 10, xy: [0.5, 0.4] } }, // nur im Bereich, nicht im Raum
  };
  const log = []; // { t, what }
  const srv = http.createServer((req, res) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      const body = s ? JSON.parse(s) : null, u = req.url;
      const send = (json, status = 200, headers = {}) => {
        res.writeHead(status, { "content-type": "application/json", ...headers });
        res.end(JSON.stringify(json));
      };
      if (u === "/api/config") return send({ bridgeid: "001788FFFE4A5B6C" });
      const v1 = u.match(/^\/api\/([^/]+)(\/.*)?$/);
      if (v1) {
        if (v1[1] !== USER) return send([{ error: { type: 1 } }]);
        const p = v1[2] || "";
        if (p === "/groups/1") return send({ lights: ["1", "2", "3"] });
        if (p === "/lights") return send(lights);
        const l = p.match(/^\/lights\/(\d+)\/state$/);
        if (req.method === "PUT" && l) {
          log.push({ t: Date.now(), what: "put", id: l[1], body });
          const { transitiontime, ...rest } = body;
          Object.assign(lights[l[1]].state, rest);
          return send([{ success: true }]);
        }
        return send(null);
      }
      if (req.headers["hue-application-key"] !== USER) return send({ errors: [{ description: "unauthorized" }], data: [] }, 403);
      if (u === "/auth/v1") return send({}, 200, { "hue-application-id": APPID });
      const area = { id: AREA, metadata: { name: "Party" }, configuration_type: "music", status: "inactive", channels: [{ channel_id: 0, position: { x: -1, y: 0, z: 0 } }, { channel_id: 1, position: { x: 1, y: 0, z: 0 } }], light_services: [{ rid: "L1", rtype: "light" }, { rid: "L2", rtype: "light" }, { rid: "L9", rtype: "light" }] };
      if (u === "/clip/v2/resource/entertainment_configuration") return send({ errors: [], data: [area] });
      if (u === `/clip/v2/resource/entertainment_configuration/${AREA}` && req.method === "GET") return send({ errors: [], data: [area] });
      if (u === `/clip/v2/resource/entertainment_configuration/${AREA}` && req.method === "PUT") {
        log.push({ t: Date.now(), what: body.action });
        return send({ errors: [], data: [{ rid: AREA }] });
      }
      if (u === "/clip/v2/resource/light") return send({ errors: [], data: [{ id: "L1", id_v1: "/lights/1" }, { id: "L2", id_v1: "/lights/2" }, { id: "L3", id_v1: "/lights/3" }, { id: "L9", id_v1: "/lights/9" }] });
      if (u === "/clip/v2/resource/entertainment") return send({ errors: [], data: [] });
      send({ errors: [{ description: "not found" }], data: [] }, 404);
    });
  });
  return { srv, lights, log };
}
// nachgebaute DTLS-Verbindung: merkt sich Aufrufe und Bilder
function fakeDtls(mode = "ok") {
  const calls = [], frames = [];
  let conn = null;
  const connect = async (o) => {
    calls.push({ host: o.host, port: o.port, identity: o.identity, psk: o.psk.toString("hex") });
    if (mode === "fail") throw new Error("timeout");
    conn = Object.assign(new EventEmitter(), {
      open: true,
      send(buf) {
        if (!this.open) return false;
        frames.push({ t: Date.now(), buf: Buffer.from(buf) });
        return true;
      },
      close() {
        if (!this.open) return;
        this.open = false;
        frames.closedAt = Date.now();
        this.emit("close");
      },
    });
    return conn;
  };
  return { connect, calls, frames, conn: () => conn };
}
const PAL = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
// Party: ein Schlag alle 400 ms, dazwischen der Zustand ~30-mal pro Sekunde
async function party(lights, ms, extra = {}) {
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < ms) {
    lights.feed({ k: i % 12 === 0 ? 1 : 0.1, a: 0, e: 0.6, d: 0, pal: PAL, ...extra });
    i++;
    await sleep(33);
  }
}

(async () => {
  const bridge = fakeBridge();
  await new Promise((r) => bridge.srv.listen(0, "127.0.0.1", r));
  const port = bridge.srv.address().port;
  const before = JSON.parse(JSON.stringify(bridge.lights));
  const base = (over = {}) => ({ lightBright: 100, lightMax: 100, hueOn: true, hueIp: `127.0.0.1:${port}`, hueUser: USER, hueClientKey: CKEY, hueGroup: "1", hueFast: true, hueArea: "", hueCertPin: "", ...over });

  /* ---- A) läuft: Stream statt REST für die Bereichslampen, REST nur noch für Lampe 3 */
  {
    const cfg = base(), logs = [], dt = fakeDtls(), updates = [];
    const lights = createLights(() => cfg, (s) => logs.push(String(s)), { hueV2Base: `http://127.0.0.1:${port}`, dtlsConnect: dt.connect, update: (p) => updates.push(p) });
    await party(lights, 1800);
    assert.strictEqual(lights.hueFast(), "on");
    assert.deepStrictEqual(dt.calls, [{ host: "127.0.0.1", port: 2100, identity: APPID, psk: CKEY.toLowerCase() }]);
    const startAt = bridge.log.find((x) => x.what === "start").t;
    // Lampen des Bereichs (1, 2, 9) bekommen ab dem Einschalten kein REST mehr – nur Lampe 3
    const puts = bridge.log.filter((x) => x.what === "put");
    assert.ok(puts.length >= 1, "Lampe 3 sollte per REST weiterlaufen");
    assert.deepStrictEqual([...new Set(puts.map((p) => p.id))], ["3"], "REST hat Lampen des Bereichs angefasst");
    // 50 Bilder pro Sekunde (Toleranz für Zeitgeber), Format HueStream mit Bereichs-ID und zwei Kanälen
    const f = dt.frames, span = (f.at(-1).t - f[0].t) / 1000;
    const rate = (f.length - 1) / span;
    // Soll 50/s; unter Last (CI, parallele Tests) kommen Zeitgeber zu spät, darum großzügig nach unten
    assert.ok(rate > 25 && rate < 60, `Bildrate ${rate.toFixed(1)}/s`);
    for (const { buf } of f) {
      assert.strictEqual(buf.subarray(0, 9).toString(), "HueStream");
      assert.strictEqual(buf.subarray(16, 52).toString(), AREA);
      assert.strictEqual(buf.length, 52 + 2 * 7);
    }
    // ohne nf wandert die Farbe mit dem Schlag; Kanal 0 (links) und 1 (rechts) liegen im Verlauf auseinander
    const last = f.at(-1).buf;
    assert.notDeepStrictEqual(last.subarray(53, 59), last.subarray(60, 66));
    // Party vorbei: erst Stream zu und Streamen aus, dann REST-Wiederherstellen für alle gemerkten Lampen
    await lights.stopAll();
    const stopAt = bridge.log.find((x) => x.what === "stop").t;
    assert.ok(f.closedAt <= stopAt, "DTLS erst nach dem Ausschalten geschlossen");
    const restores = bridge.log.filter((x) => x.what === "put" && x.body.transitiontime === 10);
    assert.deepStrictEqual(restores.map((x) => x.id).sort(), ["1", "2", "3", "9"]);
    assert.ok(restores.every((x) => x.t >= stopAt), "REST vor dem Ende des Streams");
    for (const id of ["1", "2", "3", "9"]) {
      assert.strictEqual(bridge.lights[id].state.on, before[id].state.on, `Lampe ${id} an/aus`);
      assert.deepStrictEqual(bridge.lights[id].state.xy, before[id].state.xy, `Lampe ${id} Farbe`);
    }
    assert.ok(startAt < stopAt);
    assert.strictEqual(lights.hueFast(), "off");
    // Zertifikat: über HTTP (Test) gibt es keins zum Festnageln
    assert.deepStrictEqual(updates, []);
    assert.ok(logs.some((l) => /hue fast: streaming 2 channels/.test(l)));
    const text = logs.join("\n");
    assert.ok(!text.includes(USER) && !text.toLowerCase().includes(CKEY.toLowerCase()), "Schlüssel im Protokoll");
  }

  /* ---- B) DTLS scheitert: zurück auf REST (auch für die Bereichslampen), Streamen wieder aus, kein neuer Versuch
     innerhalb einer Minute */
  {
    bridge.log.length = 0;
    const cfg = base(), logs = [], dt = fakeDtls("fail");
    const lights = createLights(() => cfg, (s) => logs.push(String(s)), { hueV2Base: `http://127.0.0.1:${port}`, dtlsConnect: dt.connect });
    await party(lights, 2200);
    assert.strictEqual(dt.calls.length, 1, "neuer Versuch vor Ablauf einer Minute");
    assert.strictEqual(lights.hueFast(), "off");
    assert.deepStrictEqual(bridge.log.filter((x) => x.what !== "put").map((x) => x.what), ["start", "stop"]);
    const ids = new Set(bridge.log.filter((x) => x.what === "put").map((x) => x.id));
    assert.ok(ids.has("1") || ids.has("2"), "REST übernimmt die Bereichslampen nicht");
    assert.ok(logs.some((l) => /hue fast: back to REST \(dtls timeout\)/.test(l)), logs.join("|"));
    await lights.stopAll();
  }

  /* ---- C) Verbindung reißt mitten in der Party ab */
  {
    bridge.log.length = 0;
    const cfg = base(), logs = [], dt = fakeDtls();
    const lights = createLights(() => cfg, (s) => logs.push(String(s)), { hueV2Base: `http://127.0.0.1:${port}`, dtlsConnect: dt.connect });
    await party(lights, 900);
    assert.strictEqual(lights.hueFast(), "on");
    const n = dt.frames.length;
    dt.conn().open = false;
    dt.conn().emit("error", new Error("alert 20"));
    await party(lights, 1300);
    assert.strictEqual(lights.hueFast(), "off");
    assert.strictEqual(dt.frames.length, n, "nach dem Abbruch noch Bilder");
    assert.ok(bridge.log.some((x) => x.what === "stop"), "Streamen nicht ausgeschaltet");
    const after = bridge.log.filter((x) => x.what === "put" && x.t > bridge.log.find((y) => y.what === "stop").t);
    assert.ok(after.some((x) => x.id === "1" || x.id === "2"), "REST übernimmt nach dem Abbruch nicht");
    await lights.stopAll();
  }

  /* ---- D) ohne Client-Schlüssel (vor dieser Version gekoppelt) oder ausgeschaltet: nie DTLS, REST wie immer */
  for (const over of [{ hueClientKey: "" }, { hueFast: false }]) {
    bridge.log.length = 0;
    const cfg = base(over), dt = fakeDtls();
    const lights = createLights(() => cfg, () => {}, { hueV2Base: `http://127.0.0.1:${port}`, dtlsConnect: dt.connect });
    await party(lights, 1300);
    assert.strictEqual(dt.calls.length, 0);
    assert.ok(!bridge.log.some((x) => x.what === "start"));
    assert.ok(bridge.log.some((x) => x.what === "put" && (x.id === "1" || x.id === "2")));
    assert.deepStrictEqual(await lights.hueAreas(), over.hueFast === false ? { areas: [{ id: AREA, name: "Party", n: 2 }] } : { error: "clientkey" });
    await lights.stopAll();
  }

  /* ---- E) „Keine Blitze“: auch im Stream kein Weiß, und die Helligkeit springt nicht */
  {
    const cfg = base(), dt = fakeDtls();
    const lights = createLights(() => cfg, () => {}, { hueV2Base: `http://127.0.0.1:${port}`, dtlsConnect: dt.connect });
    await party(lights, 1500, { nf: 1, d: 1 });
    assert.strictEqual(lights.hueFast(), "on");
    let prev = null;
    for (const { buf } of dt.frames) {
      for (const o of [53, 60]) {
        const rgb = [buf.readUInt16BE(o), buf.readUInt16BE(o + 2), buf.readUInt16BE(o + 4)];
        assert.strictEqual(Math.min(...rgb), 0, "nf: Weißanteil im Stream");
      }
      const m = Math.max(buf.readUInt16BE(53), buf.readUInt16BE(55), buf.readUInt16BE(57));
      if (prev !== null) assert.ok(Math.abs(m - prev) < 65535 * 0.12, "nf: Helligkeit springt");
      prev = m;
    }
    await lights.stopAll();
  }
  bridge.srv.close();

  /* ---- F) Zertifikat festnageln (hue-stream.js) gegen HTTPS mit Test-Zertifikat, CN = Bridge-ID */
  {
    const pem = fs.readFileSync(path.join(__dirname, "fixtures", "hue-bridge-test.pem"), "utf8");
    const cert = pem.slice(pem.indexOf("-----BEGIN CERTIFICATE-----"));
    const fp = new crypto.X509Certificate(cert).fingerprint256;
    const seen = [];
    const srv = https.createServer({ key: pem, cert }, (req, res) => {
      seen.push(req.headers["hue-application-key"]);
      res.writeHead(200, { "hue-application-id": APPID });
      res.end("{}");
    });
    await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    const b = `https://127.0.0.1:${srv.address().port}`;
    // erstes Mal: CN muss die Bridge-ID sein (Groß/klein egal), dann wird der Fingerabdruck gemerkt
    const pins = [];
    const v2 = createHueV2({ base: b, key: USER, bridgeId: "001788FFFE4A5B6C", onPin: (x) => pins.push(x) });
    assert.strictEqual(await v2.appId(), APPID);
    assert.deepStrictEqual(pins, [fp]);
    assert.strictEqual(await v2.appId(), APPID, "zweite Anfrage mit gemerktem Fingerabdruck");
    assert.strictEqual(pins.length, 1);
    assert.deepStrictEqual(seen, [USER, USER]);
    // falsche Bridge-ID, falscher Fingerabdruck, gar nichts: der Schlüssel geht nicht raus
    for (const o of [{ bridgeId: "001788fffe000000" }, { pin: fp.replace(/^../, "00") }, {}]) {
      const bad = createHueV2({ base: b, key: USER, timeout: 1500, ...o });
      assert.strictEqual(await bad.appId(), "", JSON.stringify(o));
    }
    assert.strictEqual(seen.length, 2, "Schlüssel ging an eine nicht bestätigte Gegenstelle");
    // gemerkter Fingerabdruck passt
    assert.strictEqual(await createHueV2({ base: b, key: USER, pin: fp }).appId(), APPID);
    srv.close();
  }
  console.log("lights-huefast: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
