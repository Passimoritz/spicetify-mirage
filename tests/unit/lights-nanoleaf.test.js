// Nanoleaf (lokale OpenAPI): Bild-Format von extControl v2 Byte für Byte, Paneel-Lage, Suche (mDNS und SSDP),
// Koppeln, Party gegen ein nachgebautes Gerät auf 127.0.0.1 (HTTP + UDP), Drossel, „Keine Blitze“, Zurücksetzen,
// REST-Ersatz, Gerät weg und wieder da. Es geht nichts ins echte Netz. Aufruf: node tests/unit/lights-nanoleaf.test.js
const assert = require("assert");
const http = require("http");
const dgram = require("dgram");
const { createLights } = require("../../overlay/lights.js");
const { encodeFrame, parseLayout, parseSsdp, snapshot } = require("../../overlay/nanoleaf.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = "AbCdEf0123456789AbCdEf0123456789";
const PAL = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];

/* ---- 1) Formate */
{
  // Anzahl (2 Byte), je Paneel: ID (2), R, G, B, W, Übergang in 100 ms (2) – Big Endian
  const f = encodeFrame([{ id: 0x1234, rgb: [1, 2, 3], t: 1 }, { id: 7, rgb: [255, 0, 128], t: 5 }]);
  assert.strictEqual(f.toString("hex"), "0002" + "1234" + "010203" + "00" + "0001" + "0007" + "ff0080" + "00" + "0005");
  assert.strictEqual(encodeFrame([]).toString("hex"), "0000");
  // Lage: Controller (12) und Verbinder (16) haben kein Licht; links → rechts, x von −1 bis +1
  const layout = parseLayout({ panelLayout: { layout: { positionData: [
    { panelId: 30, x: 300, y: 0, o: 0, shapeType: 7 }, { panelId: 10, x: 100, y: 0, o: 0, shapeType: 7 },
    { panelId: 0, x: 0, y: 0, o: 0, shapeType: 12 }, { panelId: 20, x: 200, y: 50, o: 0, shapeType: 7 }, { panelId: 99, x: 999, y: 0, shapeType: 16 },
  ] } } });
  assert.deepStrictEqual(layout, [{ id: 10, x: -1 }, { id: 20, x: 0 }, { id: 30, x: 1 }]);
  assert.deepStrictEqual(parseLayout({}), []);
  assert.deepStrictEqual(parseLayout({ panelLayout: { layout: { positionData: [{ panelId: 5, x: 3, shapeType: 2 }] } } }), [{ id: 5, x: 0 }]);
  // SSDP-Antwort; Adressen außerhalb des Heimnetzes zählen nicht
  const ok = "HTTP/1.1 200 OK\r\nCache-Control: max-age=60\r\nST: nanoleaf:nl42\r\nLocation: http://192.168.1.61:16021\r\nnl-deviceid: 5E:2E:EA:00:11:22\r\nnl-devicename: Shapes 1A2B\r\n\r\n";
  assert.deepStrictEqual(parseSsdp(ok), { ip: "192.168.1.61", name: "Shapes 1A2B" });
  assert.strictEqual(parseSsdp(ok.replace("192.168.1.61", "203.0.113.5")), null);
  assert.strictEqual(parseSsdp(ok.replace("nanoleaf:nl42", "upnp:rootdevice")), null);
  // Zustand vor der Party
  assert.deepStrictEqual(snapshot({ state: { on: { value: false }, brightness: { value: 40 }, hue: { value: 10 }, sat: { value: 20 }, ct: { value: 3000 }, colorMode: "effect" }, effects: { select: "Northern Lights" } }),
    { on: false, bri: 40, mode: "effect", hue: 10, sat: 20, ct: 3000, effect: "Northern Lights" });
  assert.strictEqual(snapshot({}), null);
}

/* ---- nachgebautes Gerät: OpenAPI auf HTTP, Bilder auf UDP */
function fakeNanoleaf() {
  const dev = {
    pairing: false, extOk: true, down: false,
    state: { on: { value: false }, brightness: { value: 40, max: 100, min: 0 }, hue: { value: 10 }, sat: { value: 20 }, ct: { value: 3000 }, colorMode: "effect" },
    effect: "Northern Lights", puts: [], frames: [], gets: 0,
  };
  const layout = { numPanels: 4, positionData: [{ panelId: 0, x: 0, y: 0, o: 0, shapeType: 12 }, { panelId: 11, x: 0, y: 0, o: 0, shapeType: 7 }, { panelId: 22, x: 100, y: 0, o: 0, shapeType: 7 }, { panelId: 33, x: 200, y: 0, o: 0, shapeType: 7 }] };
  dev.http = http.createServer((req, res) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      const out = (code, body) => {
        res.statusCode = code;
        res.end(body === undefined ? "" : JSON.stringify(body));
      };
      if (dev.down) return req.socket.destroy();
      if (req.method === "POST" && req.url === "/api/v1/new") return dev.pairing ? out(200, { auth_token: TOKEN }) : out(403);
      const m = req.url.match(/^\/api\/v1\/([^/]+)(\/.*)?$/);
      if (!m || m[1] !== TOKEN) return out(401);
      const p = m[2] || "/";
      const body = s ? JSON.parse(s) : null;
      if (req.method === "GET" && p === "/") return dev.gets++, out(200, { name: "Shapes", state: dev.state, effects: { select: dev.effect, effectsList: [dev.effect] }, panelLayout: { globalOrientation: { value: 0 }, layout } });
      if (req.method === "GET" && p === "/state/on") return out(200, dev.state.on);
      if (req.method === "PUT") {
        dev.puts.push({ at: Date.now(), p, body });
        if (p === "/effects" && body.write) return dev.extOk ? out(204) : out(400);
        if (p === "/effects" && body.select) return (dev.effect = body.select), (dev.state.colorMode = "effect"), out(204);
        if (p === "/state") {
          for (const [k, v] of Object.entries(body)) dev.state[k] = { ...dev.state[k], value: v.value };
          if (body.hue || body.sat) dev.state.colorMode = "hs";
          if (body.ct) dev.state.colorMode = "ct";
          return out(204);
        }
      }
      out(404);
    });
  });
  dev.udp = dgram.createSocket("udp4");
  dev.udp.on("message", (b) => dev.frames.push({ at: Date.now(), b: Buffer.from(b) }));
  return dev;
}
// Bild lesen: [{ id, rgb, t }]
function readFrame(b) {
  const n = b.readUInt16BE(0), out = [];
  assert.strictEqual(b.length, 2 + n * 8);
  for (let i = 0; i < n; i++) {
    const o = 2 + i * 8;
    out.push({ id: b.readUInt16BE(o), rgb: [b[o + 2], b[o + 3], b[o + 4]], w: b[o + 5], t: b.readUInt16BE(o + 6) });
  }
  return out;
}

(async () => {
  const dev = fakeNanoleaf();
  await new Promise((r) => dev.http.listen(0, "127.0.0.1", r));
  await new Promise((r) => dev.udp.bind(0, "127.0.0.1", r));
  const ip = `127.0.0.1:${dev.http.address().port}`;

  /* ---- 2) Koppeln */
  {
    const lights = createLights(() => ({}), () => {});
    assert.deepStrictEqual(await lights.nanoleafPair("8.8.8.8"), { error: "ip" }, "nur Heimnetz");
    assert.deepStrictEqual(await lights.nanoleafPair("nanoleaf.example.com"), { error: "ip" });
    assert.deepStrictEqual(await lights.nanoleafPair(ip), { error: "button" }, "nicht im Kopplungsmodus → 403");
    dev.pairing = true;
    assert.deepStrictEqual(await lights.nanoleafPair(ip), { token: TOKEN });
    // niemand da
    const dead = http.createServer();
    await new Promise((r) => dead.listen(0, "127.0.0.1", r));
    const deadPort = dead.address().port;
    dead.close();
    assert.deepStrictEqual(await lights.nanoleafPair(`127.0.0.1:${deadPort}`), { error: "unreachable" });
  }

  /* ---- 3) Suche: mDNS (nachgebautes bonjour-service) und SSDP (Antwort von 127.0.0.1) */
  {
    const ssdp = dgram.createSocket("udp4"), asked = [];
    ssdp.on("message", (b, r) => {
      asked.push(String(b));
      if (asked.length === 1) {
        ssdp.send(Buffer.from("HTTP/1.1 200 OK\r\nST: nanoleaf_aurora:light\r\nLocation: http://192.168.1.62:16021\r\nnl-devicename: Panels\r\n\r\n"), r.port, r.address);
        ssdp.send(Buffer.from("HTTP/1.1 200 OK\r\nST: nanoleaf:nl29\r\nLocation: http://8.8.4.4:16021\r\n\r\n"), r.port, r.address);
      }
    });
    await new Promise((r) => ssdp.bind(0, "127.0.0.1", r));
    const log = [];
    const bonjour = { Bonjour: class {
      find(q, cb) {
        log.push(q.type);
        setTimeout(() => {
          cb({ name: "Canvas", addresses: ["fe80::1", "192.168.1.63"] });
          cb({ name: "Canvas", addresses: ["192.168.1.63"] });
          cb({ name: "Fremd", addresses: ["93.184.216.34"] });
        }, 20);
        return { stop: () => log.push("stop") };
      }
      destroy() { log.push("destroy"); }
    } };
    const lights = createLights(() => ({}), () => {}, { bonjour, ssdp: { host: "127.0.0.1", port: ssdp.address().port } });
    const list = await lights.nanoleafFind(250);
    assert.deepStrictEqual(list.sort((a, b) => a.ip.localeCompare(b.ip)), [{ ip: "192.168.1.62", name: "Panels" }, { ip: "192.168.1.63", name: "Canvas" }]);
    assert.deepStrictEqual(log, ["nanoleafapi", "stop", "destroy"]);
    assert.ok(asked.length >= 3 && asked.every((q) => /^M-SEARCH \* HTTP\/1\.1\r\n/.test(q) && /ST: nanoleaf/.test(q)));
    ssdp.close();
  }

  /* ---- 4) Party mit extControl v2 */
  const logs = [];
  const cfg = { lightBright: 100, lightMax: 60, nanoleafOn: true, nanoleafIp: ip, nanoleafToken: TOKEN };
  const opts = { nanoleafUdpPort: dev.udp.address().port, lampRetryMs: 300, nanoleafCheckMs: 300 };
  const lights = createLights(() => cfg, (s) => logs.push(s), opts);
  const beat = async (nf, d = 0) => {
    lights.feed({ k: 1, a: 1, e: 1, d, pal: PAL, ...(nf ? { nf: 1 } : {}) });
    for (let i = 0; i < 10; i++) {
      await sleep(36);
      lights.feed({ k: 0, a: 0, e: 1, d, pal: PAL, ...(nf ? { nf: 1 } : {}) });
    }
  };
  for (let i = 0; i < 6; i++) await beat(false, i === 4 ? 1 : 0);
  assert.strictEqual(lights.nanoleafState(), "stream");
  // zuerst an + volle Helligkeit, dann extControl v2
  assert.deepStrictEqual(dev.puts[0].body, { on: { value: true }, brightness: { value: 100, duration: 0 } });
  assert.deepStrictEqual(dev.puts[1], { at: dev.puts[1].at, p: "/effects", body: { write: { command: "display", animType: "extControl", extControlVersion: "v2" } } });
  assert.ok(dev.frames.length > 8, "keine Bilder");
  for (const { b } of dev.frames) {
    const f = readFrame(b);
    // nur die drei Paneele mit Licht, nie heller als lightMax
    assert.deepStrictEqual(f.map((p) => p.id), [11, 22, 33]);
    for (const p of f) {
      assert.ok(Math.max(...p.rgb) <= Math.round(255 * 0.6), `Nanoleaf zu hell: ${p.rgb}`);
      assert.strictEqual(p.w, 0);
      assert.strictEqual(p.t, 1);
    }
  }
  // höchstens 10 Bilder pro Sekunde
  for (let i = 1; i < dev.frames.length; i++) assert.ok(dev.frames[i].at - dev.frames[i - 1].at >= 90, "Nanoleaf zu schnell");
  // Verlauf: links und rechts verschiedene Farben
  assert.ok(dev.frames.some(({ b }) => { const f = readFrame(b); return f[0].rgb.join() !== f[2].rgb.join(); }));

  /* ---- 5) „Keine Blitze“: kein Weiß beim Drop, Übergang 0,5 s */
  dev.frames.length = 0;
  for (let i = 0; i < 4; i++) await beat(true, 1);
  assert.ok(dev.frames.length > 3);
  for (const { b } of dev.frames) for (const p of readFrame(b)) {
    assert.strictEqual(p.t, 5);
    assert.strictEqual(Math.min(...p.rgb), 0, "nf: Nanoleaf wird weiß");
  }

  /* ---- 6) Gerät weg und wieder da: neu verbinden, der gemerkte Zustand bleibt der von vorher */
  dev.down = true;
  for (let i = 0; i < 3; i++) await beat(false);
  assert.notStrictEqual(lights.nanoleafState(), "stream", "Ausfall nicht bemerkt");
  assert.ok(logs.some((l) => /nanoleaf: offline/.test(l)));
  dev.down = false;
  const gets = dev.gets;
  for (let i = 0; i < 4; i++) await beat(false);
  assert.strictEqual(lights.nanoleafState(), "stream", "nicht neu verbunden");
  assert.ok(dev.gets > gets);

  /* ---- 7) Party vorbei: Effekt, Helligkeit und „aus“ zurück */
  await lights.stopAll();
  assert.strictEqual(dev.effect, "Northern Lights");
  assert.strictEqual(dev.state.brightness.value, 40);
  assert.strictEqual(dev.state.on.value, false);
  const n = dev.frames.length;
  await sleep(250);
  assert.strictEqual(dev.frames.length, n, "nach der Party kommen noch Bilder");
  assert.ok(!logs.join("\n").includes(TOKEN), "Schlüssel im Protokoll");

  /* ---- 8) ohne extControl (alte Firmware): REST, höchstens 2 Befehle pro Sekunde; danach feste Farbe zurück */
  dev.extOk = false;
  dev.state = { ...dev.state, on: { value: true }, brightness: { value: 70 }, hue: { value: 200 }, sat: { value: 50 }, colorMode: "hs" };
  dev.puts.length = 0;
  for (let i = 0; i < 8; i++) await beat(false);
  assert.strictEqual(lights.nanoleafState(), "rest");
  const rest = dev.puts.filter((p) => p.p === "/state" && p.body.hue);
  assert.ok(rest.length >= 3, "REST bekommt nichts");
  for (let i = 1; i < rest.length; i++) assert.ok(rest[i].at - rest[i - 1].at >= 480, "REST zu schnell");
  for (const r of rest) assert.ok(r.body.brightness.value <= 60);
  await lights.stopAll();
  assert.deepStrictEqual([dev.state.hue.value, dev.state.sat.value, dev.state.brightness.value, dev.state.on.value], [200, 50, 70, true]);

  /* ---- 9) falscher Schlüssel / Adresse außerhalb des Heimnetzes: nichts wird gesendet */
  dev.puts.length = 0;
  dev.frames.length = 0;
  cfg.nanoleafToken = "WrongToken0123456789WrongToken01";
  lights.sync();
  for (let i = 0; i < 3; i++) await beat(false);
  assert.strictEqual(dev.puts.length + dev.frames.length, 0);
  cfg.nanoleafIp = "8.8.8.8";
  cfg.nanoleafToken = TOKEN;
  assert.deepStrictEqual(await lights.test("nanoleaf"), { error: "setup" });
  await lights.stopAll();

  dev.http.close();
  dev.udp.close();
  console.log("lights-nanoleaf: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
