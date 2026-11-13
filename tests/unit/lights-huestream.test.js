// Hue Entertainment: Farbbild im Format HueStream v2 (Byte für Byte gegen das dokumentierte Layout) und die
// Bereichsverwaltung über CLIP v2 gegen eine nachgebaute Bridge auf 127.0.0.1.
// Die DTLS-Verbindung prüft tests/dtls/, das Zusammenspiel mit lights.js tests/unit/lights-huefast.test.js.
// Aufruf: node tests/unit/lights-huestream.test.js
const assert = require("assert");
const http = require("http");
const { encodeFrame, createHueV2, pickArea, MAX_CHANNELS } = require("../../overlay/hue-stream.js");

const AREA = "1a8d99cc-967b-44f2-9202-43f976c0fa6b";

/* ---- 1) Beispiel aus der Hue-Dokumentation: Kanal 0 rot, Kanal 1 blau, laufende Nummer 7 */
{
  const want = Buffer.concat([
    Buffer.from("HueStream", "ascii"), // Protokollname
    Buffer.from([0x02, 0x00]), // Version 2.0
    Buffer.from([0x07]), // laufende Nummer
    Buffer.from([0x00, 0x00]), // reserviert
    Buffer.from([0x00]), // Farbraum RGB
    Buffer.from([0x00]), // reserviert
    Buffer.from(AREA, "ascii"), // Bereichs-ID, 36 Zeichen
    Buffer.from([0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00]), // Kanal 0: rot
    Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff]), // Kanal 1: blau
  ]);
  const got = encodeFrame(AREA, 7, [{ id: 0, rgb: [255, 0, 0] }, { id: 1, rgb: [0, 0, 255] }]);
  assert.strictEqual(got.length, 16 + 36 + 2 * 7);
  assert.deepStrictEqual(got, want);
}

/* ---- 2) Einzelheiten: 16-Bit-Werte, Überlauf der Nummer, Grenzen */
{
  const f = encodeFrame(AREA, 256 + 3, [{ id: 4, rgb: [128, 1, 300] }, { id: 9, rgb: [-5, NaN, 254.6] }]);
  assert.strictEqual(f[11], 3, "laufende Nummer läuft bei 256 über");
  assert.strictEqual(f.subarray(16, 52).toString("ascii"), AREA);
  assert.strictEqual(f[52], 4);
  assert.strictEqual(f.readUInt16BE(53), 128 * 257);
  assert.strictEqual(f.readUInt16BE(55), 257);
  assert.strictEqual(f.readUInt16BE(57), 65535, "über 255 wird gekappt");
  assert.strictEqual(f[59], 9);
  assert.strictEqual(f.readUInt16BE(60), 0, "unter 0 wird gekappt");
  assert.strictEqual(f.readUInt16BE(62), 0);
  assert.strictEqual(f.readUInt16BE(64), Math.round(254.6 * 257));
  // leeres Bild (nur Kopf) hält den Stream offen
  assert.strictEqual(encodeFrame(AREA, 0, []).length, 52);
  assert.strictEqual(MAX_CHANNELS, 20);
  const many = Array.from({ length: 21 }, (_, id) => ({ id, rgb: [1, 2, 3] }));
  assert.strictEqual(encodeFrame(AREA, 0, many.slice(0, 20)).length, 52 + 20 * 7);
  assert.throws(() => encodeFrame(AREA, 0, many), /channels/);
  assert.throws(() => encodeFrame("not-a-uuid", 0, []), /area id/);
  assert.throws(() => encodeFrame(AREA, 0, null), /channels/);
}

/* ---- 3) Bereich wählen */
{
  const ch = (n) => Array.from({ length: n }, (_, id) => ({ id, x: 0, y: 0, z: 0 }));
  const list = [{ id: "a", channels: [] }, { id: "b", channels: ch(25) }, { id: "c", channels: ch(3) }, { id: "d", channels: ch(20) }];
  assert.strictEqual(pickArea(list, "d").id, "d");
  assert.strictEqual(pickArea(list, "b").id, "c", "zu viele Kanäle: nächster passender");
  assert.strictEqual(pickArea(list, "").id, "c");
  assert.strictEqual(pickArea([list[0], list[1]], "a"), null);
  assert.strictEqual(pickArea(null, "a"), null);
}

/* ---- 4) Bereichsverwaltung gegen eine nachgebaute Bridge (CLIP v2 über HTTP auf 127.0.0.1) */
(async () => {
  const KEY = "testuser-1234567890abcdef", NEW = "5c0ffee0-1111-4222-8333-444455556666";
  const seen = [];
  const area = {
    id: AREA, type: "entertainment_configuration", metadata: { name: "TV" }, configuration_type: "screen", status: "inactive",
    channels: [{ channel_id: 0, position: { x: -0.5, y: 1, z: 0 } }, { channel_id: 1, position: { x: 0.5, y: 1, z: 0 } }],
  };
  const srv = http.createServer((req, res) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      const body = s ? JSON.parse(s) : null;
      seen.push({ method: req.method, url: req.url, key: req.headers["hue-application-key"], body });
      const send = (status, json, headers = {}) => {
        res.writeHead(status, { "content-type": "application/json", ...headers });
        res.end(JSON.stringify(json));
      };
      if (req.headers["hue-application-key"] !== KEY) return send(403, { errors: [{ description: "unauthorized" }], data: [] });
      if (req.url === "/auth/v1") return send(200, {}, { "hue-application-id": "app-id-0123456789abcdef" });
      const p = req.url.replace("/clip/v2/resource/", "");
      if (req.method === "GET" && p === "entertainment_configuration") return send(200, { errors: [], data: [area, { id: "broken" }] });
      if (req.method === "GET" && p === "light") return send(200, { errors: [], data: [
        { id: "l1", id_v1: "/lights/5", owner: { rid: "dev-5", rtype: "device" } },
        { id: "l2", id_v1: "/lights/6", owner: { rid: "dev-6", rtype: "device" } },
        { id: "l3", id_v1: "/lights/7", owner: { rid: "dev-7", rtype: "device" } },
        { id: "l4", id_v1: "/lights/8", owner: { rid: "dev-8", rtype: "device" } },
      ] });
      if (req.method === "GET" && p === "entertainment") return send(200, { errors: [], data: [
        { id: "ent-5", owner: { rid: "dev-5", rtype: "device" }, renderer: true },
        { id: "ent-6", owner: { rid: "dev-6", rtype: "device" }, renderer: true },
        { id: "ent-7", owner: { rid: "dev-7", rtype: "device" }, renderer: false }, // kann nicht streamen
        { id: "ent-8", owner: { rid: "dev-8", rtype: "device" }, renderer: true }, // anderer Raum
        { id: "ent-bridge", owner: { rid: "dev-bridge", rtype: "device" }, renderer: false },
      ] });
      if (req.method === "POST" && p === "entertainment_configuration") return send(201, { errors: [], data: [{ rid: NEW, rtype: "entertainment_configuration" }] });
      if (req.method === "PUT" && p === `entertainment_configuration/${AREA}`) {
        if (body?.action === "start") area.status = "active";
        else if (body?.action === "stop") area.status = "inactive";
        else return send(400, { errors: [{ description: "bad action" }], data: [] });
        return send(200, { errors: [], data: [{ rid: AREA, rtype: "entertainment_configuration" }] });
      }
      send(404, { errors: [{ description: "not found" }], data: [] });
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const v2 = createHueV2({ base, key: KEY });

  assert.strictEqual(await v2.appId(), "app-id-0123456789abcdef");
  // auflisten: kaputte Einträge fallen weg, Kanäle mit Lage
  const list = await v2.areas();
  assert.deepStrictEqual(list, [{ id: AREA, name: "TV", type: "screen", active: false, channels: [{ id: 0, x: -0.5, y: 1, z: 0 }, { id: 1, x: 0.5, y: 1, z: 0 }] }]);
  assert.strictEqual(pickArea(list, "").id, AREA);
  // streamen ein und aus
  assert.strictEqual(await v2.start(AREA), true);
  assert.strictEqual((await v2.areas())[0].active, true);
  assert.strictEqual(await v2.stop(AREA), true);
  assert.strictEqual((await v2.areas())[0].active, false);
  assert.deepStrictEqual(seen.filter((x) => x.method === "PUT").map((x) => x.body), [{ action: "start" }, { action: "stop" }]);
  // unbekannter Bereich / keine gültige ID: false, und für die ungültige geht gar keine Anfrage raus
  const n = seen.length;
  assert.strictEqual(await v2.start("../../etc"), false);
  assert.strictEqual(seen.length, n);
  assert.strictEqual(await v2.start(NEW), false);
  // anlegen aus den Lampen 5–7 eines Raums: nur die zwei, die streamen können, von links nach rechts verteilt
  assert.deepStrictEqual(await v2.createArea("Mirage Party mit einem viel zu langen Namen", ["5", "6", "7"]), { id: NEW });
  assert.deepStrictEqual(seen.find((x) => x.method === "POST").body, {
    type: "entertainment_configuration",
    metadata: { name: "Mirage Party mit einem viel zu l" },
    configuration_type: "music",
    locations: { service_locations: [
      { service: { rid: "ent-5", rtype: "entertainment" }, positions: [{ x: -1, y: 0, z: 0 }] },
      { service: { rid: "ent-6", rtype: "entertainment" }, positions: [{ x: 1, y: 0, z: 0 }] },
    ] },
  });
  assert.deepStrictEqual(await v2.createArea("x", ["7"]), { error: "nolights" });
  // der Schlüssel geht nur als Kopfzeile mit, nie in Adresse oder Inhalt
  assert.ok(seen.every((x) => x.key === KEY && !x.url.includes(KEY) && !JSON.stringify(x.body || "").includes(KEY)));

  // falscher Schlüssel und nicht erreichbare Bridge: sauberes „geht nicht“ statt Ausnahme
  const bad = createHueV2({ base, key: "wrong-key-0123456789" });
  assert.strictEqual(await bad.areas(), null);
  assert.strictEqual(await bad.appId(), "");
  assert.strictEqual(await bad.start(AREA), false);
  assert.deepStrictEqual(await bad.createArea("x", ["5"]), { error: "unreachable" });
  srv.close();
  const gone = createHueV2({ base, key: KEY, timeout: 500 });
  assert.strictEqual(await gone.areas(), null);
  assert.strictEqual(await gone.stop(AREA), false);

  console.log("lights-huestream: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
