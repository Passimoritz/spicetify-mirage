// Gemeinsames für Nanoleaf, LIFX und Yeelight: nur Adressen im Heimnetz, Drossel je Gerät, HTTP nur dorthin,
// Vorlauf je Gerät und Test-Blinken (gegen eine nachgebaute LIFX-Lampe auf 127.0.0.1).
// Aufruf: node tests/unit/lights-lan.test.js
const assert = require("assert");
const http = require("http");
const dgram = require("dgram");
const { lanAddr, lanList, createGate, req, hsv } = require("../../overlay/lamp-kit.js");
const { createLights, latOf, latPatch } = require("../../overlay/lights.js");
const { decode, encode, T } = require("../../overlay/lifx.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- 1) Adressen */
{
  for (const ok of ["10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.254", "192.168.1.20", "169.254.3.4", "127.0.0.1"]) assert.ok(lanAddr(ok), ok);
  for (const bad of ["8.8.8.8", "172.15.0.1", "172.32.0.1", "192.169.1.1", "11.0.0.1", "0.0.0.0", "255.255.255.255", "224.0.0.1", "192.168.1.256", "192.168.1", "lamp.local", "example.com", "::1", "fe80::1", "", null, undefined, "192.168.1.5:0", "192.168.1.5:70000", " 10.0.0.1x"]) assert.strictEqual(lanAddr(bad), null, String(bad));
  assert.deepStrictEqual(lanAddr(" 192.168.001.020 ", 80), { host: "192.168.1.20", port: 80, key: "192.168.1.20:80" });
  assert.deepStrictEqual(lanAddr("10.0.0.5:1234", 80), { host: "10.0.0.5", port: 1234, key: "10.0.0.5:1234" });
  // Liste: gültige, ohne doppelte, höchstens max
  assert.deepStrictEqual(lanList("192.168.1.2, 8.8.8.8; 192.168.1.2 10.0.0.9:99 nonsense", 56700).map((a) => a.key), ["192.168.1.2:56700", "10.0.0.9:99"]);
  assert.strictEqual(lanList(Array.from({ length: 30 }, (_, i) => `10.0.0.${i + 1}`).join(","), 1, 16).length, 16);
  assert.deepStrictEqual(lanList(undefined, 1), []);
}

/* ---- 2) Drossel je Gerät */
{
  const g = createGate(100, 1000);
  assert.strictEqual(g.ok("a", 0, "x"), true);
  assert.strictEqual(g.ok("a", 50, "y"), false, "zu früh");
  assert.strictEqual(g.ok("b", 50, "y"), true, "anderes Gerät hat eigene Drossel");
  assert.strictEqual(g.ok("a", 150, "x"), false, "nichts Neues");
  assert.strictEqual(g.ok("a", 160, "z"), true);
  assert.strictEqual(g.ok("a", 1159, "z"), false);
  assert.strictEqual(g.ok("a", 1160, "z"), true, "nach keep ms auch ohne Änderung");
  g.forget("a");
  assert.strictEqual(g.ok("a", 1161, "z"), true);
  const plain = createGate(50);
  assert.strictEqual(plain.ok("a", 0, "s"), true);
  assert.strictEqual(plain.ok("a", 5000, "s"), false, "ohne keep: gleiche Farbe nie doppelt");
  // HSV
  assert.deepStrictEqual(hsv([0, 0, 255]), { h: 240, s: 1, v: 1 });
  assert.deepStrictEqual(hsv([0, 0, 0]), { h: 0, s: 0, v: 0 });
}

/* ---- 3) Vorlauf je Gerät */
{
  const c = { latNanoleaf: 80, latLifx: -40, latYeelight: 99999 };
  assert.strictEqual(latOf(c, "nanoleaf"), 80);
  assert.strictEqual(latOf(c, "lifx"), -40);
  assert.strictEqual(latOf(c, "yeelight"), 1000);
  assert.deepStrictEqual(latPatch(c, "lifx", 125.4), { latLifx: 125 });
  assert.deepStrictEqual(Object.keys(createLights(() => c, () => {}).latAll()).slice(-3), ["nanoleaf", "lifx", "yeelight"]);
}

(async () => {
  /* ---- 4) HTTP geht nur an Adressen im Heimnetz und nur unverschlüsselt dorthin */
  let hits = 0;
  const srv = http.createServer((q, res) => (hits++, res.end('{"ok":1}')));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  assert.deepStrictEqual(await req("GET", `http://127.0.0.1:${srv.address().port}/x`), { status: 200, body: { ok: 1 } });
  for (const u of ["http://8.8.8.8/", "https://192.168.1.2/", "http://localhost:1/", "ftp://10.0.0.1/", "nonsense"]) assert.strictEqual(await req("GET", u, null, 300), null, u);
  assert.strictEqual(hits, 1);
  srv.close();

  /* ---- 5) Test-Blinken: LIFX wechselt hell/dunkel im festen Takt und ist danach wie vorher */
  const sock = dgram.createSocket("udp4"), got = [];
  sock.on("message", (buf, r) => {
    const m = decode(buf);
    if (!m) return;
    got.push({ at: Date.now(), type: m.type, payload: Buffer.from(m.payload) });
    if (m.type === T.Get) {
      const p = Buffer.alloc(52);
      p.writeUInt16LE(123, 0);
      p.writeUInt16LE(65535, 10);
      sock.send(encode(T.LightState, p, { source: m.source, seq: m.seq, target: Buffer.from("d073d5000001", "hex") }), r.port, r.address);
    }
  });
  await new Promise((r) => sock.bind(0, "127.0.0.1", r));
  const cfg = { lifxOn: false, lifxIps: `127.0.0.1:${sock.address().port}` };
  const lights = createLights(() => cfg, () => {});
  assert.deepStrictEqual(await lights.test("lifx"), { ok: true });
  await sleep(4600);
  assert.strictEqual(lights.calibrating(), false);
  const colors = got.filter((g) => g.type === T.SetColor);
  // während des Blinkens: weiß (keine Sättigung), Dauer 0, abwechselnd hell und dunkel; zuletzt zurück (Farbton 123, 800 ms)
  const blink = colors.slice(0, -2), bris = blink.map((c) => c.payload.readUInt16LE(5));
  assert.ok(blink.length >= 4, "kein Blinken");
  for (const c of blink) {
    assert.strictEqual(c.payload.readUInt16LE(3), 0);
    assert.strictEqual(c.payload.readUInt32LE(9), 0);
  }
  assert.ok(Math.max(...bris) > 60000 && Math.min(...bris) < 6000, `hell/dunkel fehlt: ${bris}`);
  for (const c of colors.slice(-2)) assert.deepStrictEqual([c.payload.readUInt16LE(1), c.payload.readUInt32LE(9)], [123, 800]);
  sock.close();
  console.log("lights-lan: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
