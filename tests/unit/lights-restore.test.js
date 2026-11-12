// Grenzen und Aufräumen: Zustand vor der Party merken und danach wiederherstellen, einzelne Lampen
// ausnehmen, höchste Helligkeit. Läuft gegen nachgebaute Geräte auf 127.0.0.1 (Hue-Bridge, WLED,
// Home Assistant) – es geht nichts ins echte Netz. Aufruf: node tests/unit/lights-restore.test.js
const assert = require("assert");
const http = require("http");
const dgram = require("dgram");
const { createLights } = require("../../overlay/lights.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HUE_USER = "testuser-1234567890abcdef", HA_TOKEN = "ha-test-token-0123456789abcdef";

// kleiner HTTP-Server: handler(method, path, body, headers) → Antwortobjekt
function serve(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let s = "";
      req.on("data", (c) => (s += c));
      req.on("end", () => {
        let body = null;
        try { body = s ? JSON.parse(s) : null; } catch {}
        const out = handler(req.method, req.url, body, req.headers);
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(out ?? null));
      });
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// nachgebaute Hue-Bridge (REST v1): Raum 1 = Lampen 1–3, Raum 2 = Lampe 4, Gruppe 0 = alle
function fakeHue() {
  const lights = {
    1: { name: "Sofa", state: { on: true, bri: 120, xy: [0.4, 0.4], colormode: "xy" } },
    2: { name: "Regal", state: { on: false, bri: 77, ct: 366, colormode: "ct" } },
    3: { name: "Flur", state: { on: true, bri: 200, xy: [0.2, 0.3], colormode: "xy" } },
    4: { name: "Küche", state: { on: true, bri: 50, xy: [0.5, 0.4], colormode: "xy" } },
  };
  const groups = { 1: { name: "Wohnzimmer", lights: ["1", "2", "3"] }, 2: { name: "Küche", lights: ["4"] } };
  const puts = [];
  const handler = (method, url, body) => {
    const m = url.match(/^\/api\/([^/]+)(\/.*)?$/);
    if (!m || m[1] !== HUE_USER) return [{ error: { type: 1 } }];
    const p = m[2] || "";
    if (method === "GET" && p === "/lights") return JSON.parse(JSON.stringify(lights));
    if (method === "GET" && p === "/groups") return groups;
    if (method === "GET" && p === "/groups/0") return { lights: Object.keys(lights) };
    const g = p.match(/^\/groups\/(\d+)$/);
    if (method === "GET" && g) return groups[g[1]] || null;
    const l = p.match(/^\/lights\/(\d+)\/state$/);
    if (method === "PUT" && l && lights[l[1]]) {
      puts.push({ id: l[1], body });
      const { transitiontime, ...rest } = body;
      Object.assign(lights[l[1]].state, rest);
      return [{ success: true }];
    }
    return null;
  };
  return { lights, puts, handler };
}

// nachgebauter WLED-Streifen: JSON-API (an/aus, Helligkeit)
function fakeWled() {
  const state = { on: false, bri: 90 }, posts = [];
  const handler = (method, url, body) => {
    if (url !== "/json/state") return null;
    if (method === "POST") {
      posts.push(body);
      Object.assign(state, body);
    }
    return { ...state };
  };
  return { state, posts, handler };
}

// nachgebautes Home Assistant: drei Lichter, Szenen-Schnappschuss
function fakeHa() {
  const calls = [], auth = new Set();
  const handler = (method, url, body, headers) => {
    auth.add(headers.authorization || "");
    if (headers.authorization !== `Bearer ${HA_TOKEN}`) return { message: "401" };
    if (url === "/api/") return { message: "API running." };
    if (url === "/api/states") return ["light.sofa", "light.desk", "light.bed", "switch.fan"].map((id) => ({ entity_id: id, attributes: { friendly_name: id } }));
    if (method === "POST" && url.startsWith("/api/services/")) {
      calls.push({ svc: url.slice("/api/services/".length), body });
      return [];
    }
    return null;
  };
  return { calls, auth, handler };
}

(async () => {
  const hueDev = fakeHue(), wledDev = fakeWled(), haDev = fakeHa();
  const before = JSON.parse(JSON.stringify(hueDev.lights));
  const [hueSrv, wledSrv, haSrv] = await Promise.all([serve(hueDev.handler), serve(wledDev.handler), serve(haDev.handler)]);
  // WLED-Echtzeitdaten (UDP) landen hier statt bei einem Streifen
  const frames = [];
  const udp = dgram.createSocket("udp4");
  udp.on("message", (b) => frames.push(Buffer.from(b)));
  await new Promise((r) => udp.bind(0, "127.0.0.1", r));

  const cfg = {
    lightBright: 100, lightMax: 40,
    hueOn: true, hueIp: `127.0.0.1:${hueSrv.address().port}`, hueUser: HUE_USER, hueGroup: "1", hueExclude: "3",
    wledOn: true, wledIp: `127.0.0.1:${udp.address().port}`, wledLeds: 10,
    haOn: true, haUrl: `http://127.0.0.1:${haSrv.address().port}`, haToken: HA_TOKEN, haEntities: "", haExclude: "light.bed",
    orgbOn: false, chromaOn: false, goveeOn: false,
  };
  const logs = [];
  const lights = createLights(() => cfg, (s) => logs.push(String(s)), { wledHttpPort: wledSrv.address().port });

  // ein Schlag mit vollem Pegel (Drop), danach fällt der Kick wieder ab
  const beat = (d = 1) => {
    lights.feed({ k: 1, a: 1, e: 1, d, pal: [[255, 0, 0], [0, 255, 0], [0, 0, 255]] });
    for (let i = 0; i < 8; i++) lights.feed({ k: 0, a: 0, e: 1, d, pal: [[255, 0, 0], [0, 255, 0], [0, 0, 255]] });
  };

  /* ---- Party läuft */
  beat(); // erster Schlag: Lampen laden, Zustand merken
  await sleep(400);
  for (let i = 0; i < 6; i++) {
    beat();
    await sleep(260);
  }
  assert.ok(lights.active(), "Party sollte als aktiv gelten");

  // Hue: nur Lampen 1 und 2 (3 ist ausgenommen, 4 gehört zu einem anderen Raum), nie heller als 40 %
  const partyPuts = [...hueDev.puts];
  assert.ok(partyPuts.length >= 2, "Hue hat keine Befehle bekommen");
  assert.deepStrictEqual([...new Set(partyPuts.map((p) => p.id))].sort(), ["1", "2"]);
  for (const p of partyPuts) assert.ok(p.body.bri >= 1 && p.body.bri <= Math.round(254 * 0.4), `Hue zu hell: ${p.body.bri}`);
  assert.strictEqual(hueDev.lights[2].state.on, true, "ausgeschaltete Lampe sollte für die Party an sein");
  assert.deepStrictEqual(hueDev.lights[3].state, before[3].state);

  // WLED: war aus → für die Party an; Echtzeitbilder im DRGB-Format, kein Kanal über 40 %
  assert.deepStrictEqual(wledDev.posts[0], { on: true });
  assert.strictEqual(wledDev.state.on, true);
  assert.ok(frames.length > 3, "keine WLED-Bilder angekommen");
  for (const f of frames) {
    assert.strictEqual(f.length, 2 + 10 * 3);
    assert.strictEqual(f[0], 2);
    assert.strictEqual(f[1], 2);
    assert.ok(Math.max(...f.subarray(2)) <= Math.round(255 * 0.4), "WLED zu hell");
  }

  // Home Assistant: Schnappschuss genau einmal und ohne das ausgenommene Licht, Befehle nur an die übrigen
  const snaps = haDev.calls.filter((c) => c.svc === "scene/create");
  assert.strictEqual(snaps.length, 1);
  assert.deepStrictEqual(snaps[0].body, { scene_id: "mirage_before_party", snapshot_entities: ["light.sofa", "light.desk"] });
  const haOn = haDev.calls.filter((c) => c.svc === "light/turn_on");
  assert.ok(haOn.length >= 2, "Home Assistant hat keine Befehle bekommen");
  for (const c of haOn) {
    assert.ok(["light.sofa", "light.desk"].includes(c.body.entity_id));
    assert.ok(c.body.brightness <= Math.round(255 * 0.4), `HA zu hell: ${c.body.brightness}`);
  }
  assert.deepStrictEqual([...haDev.auth], [`Bearer ${HA_TOKEN}`]);

  /* ---- Einstellung mitten in der Party geändert: neu laden darf den gemerkten Zustand nicht überschreiben */
  cfg.hueExclude = "";
  lights.sync();
  beat();
  await sleep(400);
  for (let i = 0; i < 4; i++) {
    beat();
    await sleep(260);
  }
  assert.ok(hueDev.puts.some((p) => p.id === "3"), "Lampe 3 sollte nach dem Wieder-Aufnehmen mitmachen");
  assert.strictEqual(haDev.calls.filter((c) => c.svc === "scene/create").length, 1, "zweiter Schnappschuss hätte Partyfarben gemerkt");

  /* ---- Party vorbei (oder App wird beendet): alles zurück */
  const n = hueDev.puts.length;
  await lights.stopAll();
  assert.strictEqual(lights.active(), false);
  for (const id of ["1", "2", "3"]) {
    const now = hueDev.lights[id].state, was = before[id].state;
    assert.strictEqual(now.on, was.on, `Hue ${id}: an/aus`);
    assert.strictEqual(now.bri, was.bri, `Hue ${id}: Helligkeit`);
    if (was.colormode === "xy") assert.deepStrictEqual(now.xy, was.xy, `Hue ${id}: Farbe`);
    else assert.strictEqual(now.ct, was.ct, `Hue ${id}: Farbtemperatur`);
  }
  assert.deepStrictEqual(hueDev.lights[4].state, before[4].state, "Lampe im anderen Raum wurde angefasst");
  assert.strictEqual(hueDev.puts.length - n, 3, "genau ein Wiederherstellen je Lampe");
  assert.deepStrictEqual(wledDev.state, { on: false, bri: 90 });
  assert.deepStrictEqual(haDev.calls.at(-1), { svc: "scene/turn_on", body: { entity_id: "scene.mirage_before_party", transition: 1 } });

  // zweites Beenden: nichts mehr zu tun, keine weiteren Befehle
  const total = hueDev.puts.length + wledDev.posts.length + haDev.calls.length;
  await lights.stopAll();
  assert.strictEqual(hueDev.puts.length + wledDev.posts.length + haDev.calls.length, total);

  // Zugangsdaten tauchen in keinem Protokolltext auf
  assert.ok(!logs.join("\n").includes(HUE_USER) && !logs.join("\n").includes(HA_TOKEN));

  /* ---- Räume ausnehmen (Gruppe 0 = alle Lampen, Raum 1 ausgenommen) und die Liste für die Einstellungen */
  cfg.wledOn = cfg.haOn = false;
  cfg.hueGroup = "0";
  cfg.hueExclude = "g1";
  const listed = await lights.hueLights();
  assert.deepStrictEqual(listed.rooms, [{ id: "1", name: "Wohnzimmer" }, { id: "2", name: "Küche" }]);
  assert.deepStrictEqual(listed.lights.map((l) => l.name), ["Sofa", "Regal", "Flur", "Küche"]);
  hueDev.puts.length = 0;
  beat();
  await sleep(400);
  for (let i = 0; i < 3; i++) {
    beat();
    await sleep(260);
  }
  assert.deepStrictEqual([...new Set(hueDev.puts.map((p) => p.id))], ["4"]);
  await lights.stopAll();
  assert.deepStrictEqual(hueDev.lights[4].state.xy, before[4].state.xy);

  for (const s of [hueSrv, wledSrv, haSrv]) s.close();
  udp.close();
  console.log("lights-restore: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
