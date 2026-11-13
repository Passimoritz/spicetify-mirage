// Einrichtungs-Assistent: WLED per mDNS finden (nachgebautes bonjour-service) und ein Gerät kurz blinken lassen
// (WLED-Empfänger auf 127.0.0.1). Aufruf: node tests/unit/lights-setup.test.js
const assert = require("assert");
const http = require("http");
const dgram = require("dgram");
const { createLights } = require("../../overlay/lights.js");

// nachgebautes bonjour-service: meldet zwei Streifen (einen doppelt) und ein Gerät ohne brauchbare Adresse
function fakeBonjour(log) {
  return {
    Bonjour: class {
      find(q, cb) {
        log.push(q.type);
        setTimeout(() => {
          cb({ name: "Regal", addresses: ["fe80::1", "192.168.1.41"] });
          cb({ name: "Regal", addresses: ["192.168.1.41"] });
          cb({ name: "Bett", referer: { address: "192.168.1.42" } });
          cb({ name: "kaputt", addresses: ["nonsense"] });
        }, 20);
        return { stop: () => log.push("stop") };
      }
      destroy() {
        log.push("destroy");
      }
    },
  };
}

(async () => {
  /* ---- WLED finden */
  const log = [];
  const cfg = { wledOn: false, wledIp: "", wledLeds: 4 };
  let lights = createLights(() => cfg, () => {}, { bonjour: fakeBonjour(log) });
  const list = await lights.wledFind(150);
  assert.deepStrictEqual(list, [{ ip: "192.168.1.41", name: "Regal" }, { ip: "192.168.1.42", name: "Bett" }]);
  assert.deepStrictEqual(log, ["wled", "stop", "destroy"], "Suche muss aufgeräumt werden");
  // bonjour-service fehlt oder wirft: leere Liste statt Absturz
  lights = createLights(() => cfg, () => {}, { bonjour: { Bonjour: class { constructor() { throw new Error("no mdns"); } } } });
  assert.deepStrictEqual(await lights.wledFind(10), []);

  /* ---- Test-Blinken */
  const udp = dgram.createSocket("udp4"), frames = [];
  udp.on("message", (b) => frames.push(Buffer.from(b)));
  await new Promise((r) => udp.bind(0, "127.0.0.1", r));
  const posts = [];
  const wledHttp = http.createServer((req, res) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      if (req.method === "POST") posts.push(JSON.parse(s));
      res.end(JSON.stringify({ on: false, bri: 50 }));
    });
  });
  await new Promise((r) => wledHttp.listen(0, "127.0.0.1", r));
  lights = createLights(() => cfg, () => {}, { wledHttpPort: wledHttp.address().port });
  // nicht eingerichtet: nichts senden, sagen warum
  assert.deepStrictEqual(await lights.test("wled"), { error: "setup" });
  assert.deepStrictEqual(await lights.test("hue"), { error: "setup" });
  assert.deepStrictEqual(await lights.test("ha"), { error: "setup" });
  assert.deepStrictEqual(await lights.test("nope"), { error: "name" });
  assert.strictEqual(frames.length, 0);
  // eingerichtet (auch wenn noch nicht eingeschaltet): blinkt, hört von selbst auf, Zustand zurück
  cfg.wledIp = `127.0.0.1:${udp.address().port}`;
  assert.deepStrictEqual(await lights.test("wled"), { ok: true });
  await new Promise((r) => setTimeout(r, 4600));
  assert.ok(frames.length > 5, "keine Bilder beim Test");
  const maxes = frames.map((f) => Math.max(...f.subarray(2)));
  assert.ok(Math.max(...maxes) > 200 && Math.min(...maxes) < 40, "Test soll hell/dunkel wechseln");
  assert.strictEqual(lights.calibrating(), false, "Test muss von selbst enden");
  assert.deepStrictEqual(posts, [{ on: true }, { on: false, bri: 50 }], "Streifen danach wie vorher");
  const n = frames.length;
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(frames.length, n, "nach dem Test kommen noch Bilder");

  wledHttp.close();
  udp.close();
  console.log("lights-setup: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
