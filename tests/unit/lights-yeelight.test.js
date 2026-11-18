// Yeelight (LAN-Steuerung): Suche, Befehle als JSON-Zeilen über TCP, Musikmodus (die Lampe verbindet sich
// zurück), Kontingent ohne Musikmodus, Abbruch und Wiederverbinden, Zurücksetzen – gegen nachgebaute Lampen
// auf 127.0.0.1. Es geht nichts ins echte Netz. Aufruf: node tests/unit/lights-yeelight.test.js
const assert = require("assert");
const net = require("net");
const dgram = require("dgram");
const { createLights } = require("../../overlay/lights.js");
const { parseSsdp, parseProps, PROPS, line } = require("../../overlay/yeelight.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAL = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];

/* ---- 1) Formate */
{
  // Antwort auf die Suche, wie in der Yeelight-Spezifikation
  const res = "HTTP/1.1 200 OK\r\nCache-Control: max-age=3600\r\nDate: \r\nExt: \r\nLocation: yeelight://192.168.1.239:55443\r\nServer: POSIX UPnP/1.0 YGLC/1\r\nid: 0x000000000015243f\r\nmodel: color\r\nfw_ver: 18\r\nsupport: get_prop set_default set_power toggle set_bright start_cf stop_cf set_scene cron_add cron_get cron_del set_ct_abx set_rgb\r\npower: on\r\nbright: 100\r\ncolor_mode: 2\r\nct: 4000\r\nrgb: 16711680\r\nhue: 100\r\nsat: 35\r\nname: my_bulb\r\n";
  const d = parseSsdp(res);
  assert.strictEqual(d.ip, "192.168.1.239");
  assert.strictEqual(d.name, "my_bulb");
  assert.strictEqual(d.model, "color");
  assert.ok(d.support.includes("set_scene"));
  assert.strictEqual(parseSsdp(res.replace(":55443", ":5000")).ip, "192.168.1.239:5000");
  assert.strictEqual(parseSsdp(res.replace("192.168.1.239", "52.1.2.3")), null, "nur Heimnetz");
  assert.strictEqual(parseSsdp("HTTP/1.1 200 OK\r\nLocation: http://192.168.1.5/\r\n"), null);
  // Befehlszeile: JSON, abgeschlossen mit CRLF
  assert.strictEqual(line(1, "set_scene", ["color", 65280, 70]), '{"id":1,"method":"set_scene","params":["color",65280,70]}\r\n');
  assert.deepStrictEqual(PROPS, ["power", "bright", "rgb", "ct", "color_mode", "hue", "sat"]);
  assert.deepStrictEqual(parseProps(["off", "30", "65280", "", "1", "120", "100"]), { on: false, bright: 30, rgb: 65280, ct: 4000, mode: 1, hue: 120, sat: 100 });
  assert.strictEqual(parseProps(["on"]), null);
}

/* ---- nachgebaute Lampe: Steuerverbindung auf TCP, Musikmodus verbindet sich zu host:port zurück */
async function fakeBulb({ music = true, props }) {
  const b = { music, props: { ...props }, ctrl: [], musicLines: [], conns: 0, musicSock: null, ctrlSocks: new Set() };
  const apply = (m) => {
    const p = m.params;
    if (m.method === "set_power") b.props.power = p[0];
    if (m.method === "set_bright") b.props.bright = String(p[0]);
    if (m.method === "set_rgb") (b.props.rgb = String(p[0])), (b.props.color_mode = "1");
    if (m.method === "set_ct_abx") (b.props.ct = String(p[0])), (b.props.color_mode = "2");
    if (m.method === "set_scene") (b.props.power = "on"), (b.props.rgb = String(p[1])), (b.props.bright = String(p[2])), (b.props.color_mode = "1");
  };
  b.srv = net.createServer((sock) => {
    b.conns++;
    b.ctrlSocks.add(sock);
    sock.on("close", () => b.ctrlSocks.delete(sock));
    let buf = "";
    sock.on("data", (c) => {
      buf += c;
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const m = JSON.parse(buf.slice(0, i));
        buf = buf.slice(i + 2);
        b.ctrl.push({ at: Date.now(), ...m });
        const ok = (result) => sock.write(JSON.stringify({ id: m.id, result }) + "\r\n");
        if (m.method === "get_prop") ok(m.params.map((k) => b.props[k] ?? ""));
        else if (m.method === "set_music") {
          if (!b.music) sock.write(JSON.stringify({ id: m.id, error: { code: -1, message: "unsupported" } }) + "\r\n");
          else if (m.params[0] === 1) {
            const ms = net.connect({ host: m.params[1], port: m.params[2] }, () => ok(["ok"]));
            b.musicSock = ms;
            let mb = "";
            ms.on("data", (c) => {
              mb += c;
              let j;
              while ((j = mb.indexOf("\r\n")) >= 0) {
                const x = JSON.parse(mb.slice(0, j));
                mb = mb.slice(j + 2);
                b.musicLines.push({ at: Date.now(), ...x });
                apply(x);
              }
            });
            ms.on("error", () => {});
          } else {
            b.musicSock?.destroy();
            ok(["ok"]);
          }
        } else {
          apply(m);
          ok(["ok"]);
        }
      }
    });
    sock.on("error", () => {});
  });
  await new Promise((r) => b.srv.listen(0, "127.0.0.1", r));
  b.addr = `127.0.0.1:${b.srv.address().port}`;
  return b;
}
function perMinuteOk(times, max) {
  for (let i = 0; i < times.length; i++) assert.ok(times.filter((t) => t >= times[i] && t < times[i] + 60000).length <= max);
}

(async () => {
  const A = await fakeBulb({ music: true, props: { power: "off", bright: "30", rgb: "65280", ct: "4000", color_mode: "1", hue: "0", sat: "0" } });
  const B = await fakeBulb({ music: false, props: { power: "on", bright: "80", rgb: "255", ct: "2700", color_mode: "2", hue: "0", sat: "0" } });

  /* ---- 2) Suche: M-SEARCH an die Multicast-Adresse (hier 127.0.0.1), Antworten von der Lampe */
  {
    const ssdp = dgram.createSocket("udp4"), asked = [];
    ssdp.on("message", (m, r) => {
      asked.push(String(m));
      const send = (s) => ssdp.send(Buffer.from(s), r.port, r.address);
      send(`HTTP/1.1 200 OK\r\nLocation: yeelight://${A.addr}\r\nid: 0x1\r\nmodel: color\r\nname: Sofa\r\n`);
      send("HTTP/1.1 200 OK\r\nLocation: yeelight://8.8.8.8:55443\r\nid: 0x2\r\nmodel: mono\r\n");
    });
    await new Promise((r) => ssdp.bind(0, "127.0.0.1", r));
    const lights = createLights(() => ({}), () => {}, { yeelightSsdp: { host: "127.0.0.1", port: ssdp.address().port } });
    const r = await lights.yeelightScan(200);
    assert.deepStrictEqual(r, { list: [{ ip: A.addr, name: "Sofa" }] });
    assert.ok(/^M-SEARCH \* HTTP\/1\.1\r\nHOST: 239\.255\.255\.250:1982\r\nMAN: "ssdp:discover"\r\nST: wifi_bulb\r\n/.test(asked[0]));
    ssdp.close();
  }

  /* ---- 3) Party: A im Musikmodus, B nur über die Steuerverbindung */
  const logs = [];
  const cfg = { lightBright: 100, lightMax: 50, yeelightOn: true, yeelightIps: `${A.addr}, ${B.addr}, 1.2.3.4` };
  const lights = createLights(() => cfg, (s) => logs.push(s), { lampRetryMs: 400 });
  const beat = async (nf, d = 0) => {
    lights.feed({ k: 1, a: 1, e: 1, d, pal: PAL, ...(nf ? { nf: 1 } : {}) });
    for (let i = 0; i < 10; i++) {
      await sleep(36);
      lights.feed({ k: 0.2, a: 0, e: 0.6 + 0.04 * i, d, pal: PAL, ...(nf ? { nf: 1 } : {}) });
    }
  };
  for (let i = 0; i < 9; i++) await beat(false, i === 5 ? 1 : 0);
  // zuerst den Zustand lesen, dann einschalten (A war aus), dann Musikmodus
  assert.strictEqual(A.ctrl[0].method, "get_prop");
  assert.deepStrictEqual(A.ctrl[0].params, PROPS);
  assert.deepStrictEqual(A.ctrl[1].params, ["on", "sudden", 0]);
  assert.strictEqual(A.ctrl[2].method, "set_music");
  assert.deepStrictEqual(A.ctrl[2].params.slice(0, 2), [1, "127.0.0.1"]);
  assert.ok(logs.some((l) => l.includes(`${A.addr} music mode`)));
  // Musikmodus: Farben mit Helligkeit in einem Befehl, höchstens 10 pro Sekunde, nie heller als lightMax
  const scenes = A.musicLines.filter((x) => x.method === "set_scene");
  // Helligkeit steht hier am Deckel (lightMax): neue Befehle nur mit neuer Farbe, also etwa einer je Schlag
  assert.ok(scenes.length >= 6, `Musikmodus: nur ${scenes.length} Befehle`);
  for (let i = 1; i < scenes.length; i++) assert.ok(scenes[i].at - scenes[i - 1].at >= 90, "Musikmodus zu schnell");
  for (const s of scenes) {
    assert.strictEqual(s.params[0], "color");
    assert.ok(s.params[2] >= 1 && s.params[2] <= 50, `zu hell: ${s.params[2]}`);
  }
  assert.ok(!A.ctrl.some((x) => x.method === "set_scene"), "im Musikmodus nichts über die Steuerverbindung");
  // B: kein Musikmodus → höchstens ein Befehl pro Sekunde, unter 60 pro Minute
  const bScenes = B.ctrl.filter((x) => x.method === "set_scene");
  assert.ok(bScenes.length >= 3, "B bekommt nichts");
  for (let i = 1; i < bScenes.length; i++) assert.ok(bScenes[i].at - bScenes[i - 1].at >= 1000, "Steuerverbindung zu schnell");
  perMinuteOk(B.ctrl.map((x) => x.at), 60);
  assert.ok(!B.ctrl.some((x) => x.method === "set_power"), "B war schon an");

  /* ---- 4) „Keine Blitze“: kein Weiß beim Drop */
  A.musicLines.length = 0;
  for (let i = 0; i < 4; i++) await beat(true, 1);
  const calm = A.musicLines.filter((x) => x.method === "set_scene");
  assert.ok(calm.length >= 2);
  for (const s of calm) {
    const v = s.params[1], rgb = [v >> 16, (v >> 8) & 255, v & 255];
    assert.strictEqual(Math.min(...rgb), 0, "nf: Yeelight wird weiß");
  }

  /* ---- 5) Abbruch: A wirft die Verbindung ab → nach kurzer Zeit neu verbunden, Musikmodus wieder da */
  const conns = A.conns;
  for (const s of A.ctrlSocks) s.destroy();
  A.musicSock?.destroy();
  for (let i = 0; i < 6; i++) await beat(false);
  assert.ok(A.conns > conns, "nicht neu verbunden");
  assert.ok(logs.some((l) => l.includes(`${A.addr} offline`)));
  // der gemerkte Zustand ist der von vor der Party (nicht noch einmal gelesen)
  assert.strictEqual(A.ctrl.filter((x) => x.method === "get_prop").length, 1);
  A.musicLines.length = 0;
  for (let i = 0; i < 3; i++) await beat(false);
  assert.ok(A.musicLines.some((x) => x.method === "set_scene"), "nach dem Wiederverbinden kein Musikmodus");

  /* ---- 6) Party vorbei: Musikmodus aus, Farbe/Weiß, Helligkeit, an/aus wie vorher */
  await lights.stopAll();
  assert.deepStrictEqual([A.props.power, A.props.bright, A.props.rgb, A.props.color_mode], ["off", "30", "65280", "1"]);
  assert.ok(A.ctrl.some((x) => x.method === "set_music" && x.params[0] === 0));
  assert.deepStrictEqual([B.props.power, B.props.bright, B.props.ct, B.props.color_mode], ["on", "80", "2700", "2"]);
  await sleep(100);
  assert.strictEqual(A.ctrlSocks.size + B.ctrlSocks.size, 0, "Verbindungen bleiben offen");
  const n = A.ctrl.length + A.musicLines.length + B.ctrl.length;
  await sleep(300);
  assert.strictEqual(A.ctrl.length + A.musicLines.length + B.ctrl.length, n, "nach der Party kommen noch Befehle");

  /* ---- 7) Lampe nicht erreichbar: kein Absturz, kein Test ohne Adresse im Heimnetz */
  const dead = net.createServer();
  await new Promise((r) => dead.listen(0, "127.0.0.1", r));
  const deadAddr = `127.0.0.1:${dead.address().port}`;
  dead.close();
  cfg.yeelightIps = deadAddr;
  lights.sync();
  for (let i = 0; i < 3; i++) await beat(false);
  assert.ok(logs.some((l) => l.includes(`${deadAddr} offline`)));
  await lights.stopAll();
  assert.deepStrictEqual(await createLights(() => ({ yeelightIps: "8.8.8.8" }), () => {}).test("yeelight"), { error: "setup" });

  A.srv.close();
  B.srv.close();
  console.log("lights-yeelight: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
