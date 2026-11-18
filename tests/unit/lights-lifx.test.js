// LIFX (LAN-Protokoll): Pakete Byte für Byte, Suche, Party gegen nachgebaute Lampen auf 127.0.0.1 (eine Lampe,
// ein Streifen mit Zonen, eine, die erst schweigt und später antwortet), Drossel, „Keine Blitze“, Zurücksetzen.
// Es geht nichts ins echte Netz. Aufruf: node tests/unit/lights-lifx.test.js
const assert = require("assert");
const dgram = require("dgram");
const { createLights } = require("../../overlay/lights.js");
const { encode, decode, setColor, setPower, setZones, toHsbk, parseLightState, parseZones, T } = require("../../overlay/lifx.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (b) => Buffer.from(b).toString("hex");

/* ---- 1) Pakete Byte für Byte */
{
  // Beispiel aus der LIFX-Doku („Building a LIFX packet“): alle Lampen grün, volle Helligkeit, 3500 K, 1024 ms
  const green = toHsbk([0, 255, 0]);
  assert.deepStrictEqual(green, { h: 21845, s: 65535, b: 65535, k: 3500 });
  assert.strictEqual(
    hex(setColor(green, 1024, { tagged: true })),
    "3100" + "0034" + "00000000" + "0000000000000000" + "000000000000" + "00" + "00" + "0000000000000000" + "6600" + "0000" + "00" + "5555" + "ffff" + "ffff" + "ac0d" + "00040000"
  );
  // an eine bestimmte Lampe (Ziel = Seriennummer, tagged aus), Quelle, Folgenummer, Antwort erbeten
  const target = Buffer.from("d073d5010203", "hex");
  assert.strictEqual(
    hex(encode(T.Get, undefined, { source: 0x12345678, target, seq: 7, res: true })),
    "2400" + "0014" + "78563412" + "d073d50102030000" + "000000000000" + "01" + "07" + "0000000000000000" + "6500" + "0000"
  );
  // SetLightPower: an = 65535, Dauer 800 ms
  assert.strictEqual(hex(setPower(1, 800, { source: 1 })).slice(64), "7500" + "0000" + "ffff" + "20030000");
  assert.strictEqual(hex(setPower(0, 0, { source: 1 })).slice(72), "0000" + "00000000");
  // SetExtendedColorZones: 36 + 664 Byte, Dauer, apply = 1, ab Zone 0, Anzahl, dann HSBK je Zone
  const z = setZones([{ h: 1, s: 2, b: 3, k: 3500 }, { h: 65535, s: 0, b: 65535, k: 9000 }], 60, { source: 1 });
  assert.strictEqual(z.length, 700);
  assert.strictEqual(z.readUInt16LE(0), 700);
  assert.strictEqual(z.readUInt16LE(32), 510);
  assert.strictEqual(hex(z.subarray(36, 60)), "3c000000" + "01" + "0000" + "02" + "010002000300ac0d" + "ffff0000ffff2823");
  assert.ok(z.subarray(60).every((x) => x === 0), "freie Zonen bleiben leer");
  // Werte außerhalb des Bereichs: Farbton läuft im Kreis weiter, der Rest wird begrenzt
  assert.strictEqual(hex(setColor({ h: 70000, s: -5, b: 1e6, k: 100 }, -1, {})).slice(72), "00" + "7011" + "0000" + "ffff" + "dc05" + "00000000");
  // Lesen: fremde oder kaputte Pakete → null
  assert.strictEqual(decode(Buffer.alloc(10)), null);
  const bad = setColor(green, 0, {});
  bad.writeUInt16LE(99, 0);
  assert.strictEqual(decode(bad), null);
  const m = decode(encode(T.Get, undefined, { source: 9, target, seq: 3 }));
  assert.deepStrictEqual([m.type, m.source, m.seq, hex(m.target)], [101, 9, 3, "d073d50102030000"]);
  // Farbumrechnung: Schwarz = Helligkeit 0, Rot = Farbton 0
  assert.deepStrictEqual(toHsbk([0, 0, 0]), { h: 0, s: 0, b: 0, k: 3500 });
  assert.deepStrictEqual(toHsbk([255, 0, 0]), { h: 0, s: 65535, b: 65535, k: 3500 });
  assert.strictEqual(toHsbk([0, 0, 128]).b, Math.round((128 / 255) * 65535));
}

/* ---- nachgebaute Lampe: beantwortet GetService, Get und GetExtendedColorZones wie im LAN-Protokoll */
const SERIAL = (n) => Buffer.from([0xd0, 0x73, 0xd5, 0, 0, n, 0, 0]);
function reply(type, payload, m, serial) {
  return encode(type, payload, { source: m.source, target: serial, seq: m.seq });
}
async function fakeLamp({ n, label, color, power = 0, zones = 0, silent = false }) {
  const sock = dgram.createSocket("udp4"), got = [];
  const lamp = { sock, got, silent, label, color: { ...color }, power, zones: Array.from({ length: zones }, (_, i) => ({ h: i * 1000, s: 65535, b: 30000, k: 3500 })) };
  sock.on("message", (buf, rinfo) => {
    const m = decode(buf);
    if (!m) return;
    got.push({ at: Date.now(), type: m.type, tagged: !!(buf.readUInt16LE(2) & 0x2000), target: hex(m.target), payload: Buffer.from(m.payload) });
    if (lamp.silent) return;
    const send = (b) => sock.send(b, rinfo.port, rinfo.address);
    if (m.type === T.GetService) {
      const p = Buffer.alloc(5);
      p[0] = 1;
      p.writeUInt32LE(sock.address().port, 1);
      send(reply(T.StateService, p, m, SERIAL(n)));
    } else if (m.type === T.Get) {
      const p = Buffer.alloc(52);
      p.writeUInt16LE(lamp.color.h, 0), p.writeUInt16LE(lamp.color.s, 2), p.writeUInt16LE(lamp.color.b, 4), p.writeUInt16LE(lamp.color.k, 6);
      p.writeUInt16LE(lamp.power, 10);
      p.write(lamp.label, 12, "utf8");
      send(reply(T.LightState, p, m, SERIAL(n)));
    } else if (m.type === T.GetExtendedColorZones) {
      if (!lamp.zones.length) {
        const p = Buffer.alloc(2);
        p.writeUInt16LE(T.GetExtendedColorZones, 0);
        return send(reply(T.StateUnhandled, p, m, SERIAL(n)));
      }
      const p = Buffer.alloc(5 + 82 * 8);
      p.writeUInt16LE(lamp.zones.length, 0);
      p[4] = lamp.zones.length;
      lamp.zones.forEach((c, i) => [c.h, c.s, c.b, c.k].forEach((v, j) => p.writeUInt16LE(v, 5 + i * 8 + j * 2)));
      send(reply(T.StateExtendedColorZones, p, m, SERIAL(n)));
    } else if (m.type === T.SetLightPower) lamp.power = m.payload.readUInt16LE(0);
    else if (m.type === T.SetColor) lamp.color = { h: m.payload.readUInt16LE(1), s: m.payload.readUInt16LE(3), b: m.payload.readUInt16LE(5), k: m.payload.readUInt16LE(7) };
  });
  await new Promise((r) => sock.bind(0, "127.0.0.1", r));
  lamp.addr = `127.0.0.1:${sock.address().port}`;
  return lamp;
}
// in jedem Fenster von 1 s höchstens max Zeitpunkte
function perSecond(times, max, what) {
  for (let i = 0; i < times.length; i++) {
    const k = times.filter((t) => t >= times[i] && t < times[i] + 1000).length;
    assert.ok(k <= max, `${what}: ${k} in einer Sekunde`);
  }
}
const PAL = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];

(async () => {
  const bulb = await fakeLamp({ n: 1, label: "Desk", color: { h: 1000, s: 2000, b: 3000, k: 4000 }, power: 0 });
  const strip = await fakeLamp({ n: 2, label: "Strip", color: { h: 0, s: 0, b: 65535, k: 2700 }, power: 65535, zones: 16 });
  const late = await fakeLamp({ n: 3, label: "Late", color: { h: 5, s: 6, b: 7, k: 3500 }, power: 65535, silent: true });

  /* ---- 2) Suche: GetService an alle, Antworten mit Port */
  {
    const cfg = { lifxOn: false, lifxIps: "" };
    const lights = createLights(() => cfg, () => {}, { lifxBroadcast: "127.0.0.1", lifxPort: bulb.sock.address().port });
    const r = await lights.lifxScan(300);
    assert.deepStrictEqual(r, { list: [{ ip: bulb.addr }] });
    const q = bulb.got.find((g) => g.type === T.GetService);
    assert.ok(q && q.tagged, "Suche muss an alle gehen (tagged)");
    bulb.got.length = 0;
  }

  /* ---- 3) Party */
  const logs = [];
  const cfg = { lightBright: 100, lightMax: 50, lifxOn: true, lifxIps: `${bulb.addr}, ${strip.addr}, ${late.addr}, 8.8.8.8, 192.168.1.300, nonsense` };
  const lights = createLights(() => cfg, (s) => logs.push(s), { lampRetryMs: 400 });
  // ohne Einrichtung kein Test-Blinken; öffentliche oder kaputte Adressen zählen nicht
  assert.deepStrictEqual(await createLights(() => ({ lifxIps: "8.8.8.8, 1.1.1.1" }), () => {}).test("lifx"), { error: "setup" });
  const feed = (nf, d = 0) => lights.feed({ k: 1, a: 1, e: 1, d, pal: PAL, ...(nf ? { nf: 1 } : {}) });
  for (let i = 0; i < 60; i++) {
    feed(false, i > 40 ? 1 : 0);
    await sleep(i % 3 ? 16 : 40);
    lights.feed({ k: 0, a: 0, e: 1, d: 0, pal: PAL });
  }
  // die stumme Lampe meldet sich mitten in der Party
  late.silent = false;
  for (let i = 0; i < 40; i++) {
    feed(false);
    await sleep(33);
  }
  for (const L of [bulb, strip, late]) {
    // zuerst gefragt, erst danach Farben – nie eine Farbe, bevor der alte Zustand gemerkt ist
    const first = L.got.findIndex((g) => [T.SetColor, T.SetExtendedColorZones].includes(g.type));
    assert.ok(first > 0, `${L.label}: keine Farben`);
    assert.ok(L.got.slice(0, first).some((g) => g.type === T.Get), `${L.label}: Farbe vor dem Merken`);
    // höchstens 20 Nachrichten pro Sekunde je Lampe (LIFX-Empfehlung)
    perSecond(L.got.map((g) => g.at), 20, L.label);
    // nach der ersten Antwort geht alles an die Seriennummer der Lampe
    assert.ok(L.got.slice(first).every((g) => !g.tagged), `${L.label}: Ziel fehlt`);
  }
  // wer Antworten bekommt, nimmt die Seriennummer
  assert.strictEqual(bulb.got.at(-1).target, hex(SERIAL(1)));
  // war aus → für die Party an
  assert.strictEqual(bulb.power, 65535);
  // eine Farbe: SetColor, nie heller als lightMax (50 %)
  const colors = bulb.got.filter((g) => g.type === T.SetColor);
  assert.ok(colors.length > 5);
  for (const c of colors) assert.ok(c.payload.readUInt16LE(5) <= Math.round((Math.round(255 * 0.5) / 255) * 65535), "LIFX zu hell");
  // Streifen: alle 16 Zonen in einer Nachricht, keine SetColor (die würde die Zonen überschreiben)
  const zmsgs = strip.got.filter((g) => g.type === T.SetExtendedColorZones);
  assert.ok(zmsgs.length > 5, "keine Zonen");
  assert.ok(!strip.got.some((g) => g.type === T.SetColor), "Streifen bekam SetColor");
  for (const z of zmsgs) {
    assert.strictEqual(z.payload[7], 16);
    const hs = Array.from({ length: 16 }, (_, i) => z.payload.readUInt16LE(8 + i * 8));
    assert.ok(new Set(hs).size > 1, "Zonen sollen einen Verlauf zeigen");
  }
  assert.ok(late.got.some((g) => g.type === T.SetColor), "spät antwortende Lampe macht nicht mit");
  // nichts an Adressen außerhalb des Heimnetzes – dafür gibt es keinen Socket, aber auch keinen Eintrag
  assert.ok(!logs.some((l) => /8\.8\.8\.8/.test(l)));

  /* ---- 4) „Keine Blitze“: weiche Übergänge (600 ms), kein Weiß beim Drop */
  bulb.got.length = 0;
  for (let i = 0; i < 40; i++) {
    feed(true, 1);
    await sleep(33);
  }
  const calm = bulb.got.filter((g) => g.type === T.SetColor);
  assert.ok(calm.length >= 1, "nf: keine Farben");
  for (const c of calm) {
    assert.strictEqual(c.payload.readUInt32LE(9), 600);
    assert.ok(c.payload.readUInt16LE(3) > 30000, "nf: Lampe wird weiß");
  }

  /* ---- 5) Party vorbei: alles zurück, je Nachricht zweimal (UDP) */
  for (const L of [bulb, strip, late]) L.got.length = 0;
  await lights.stopAll();
  // Wiederherstellen = Übergang 800 ms (ein Partybild kann noch unterwegs gewesen sein, als die Liste geleert wurde)
  const back = (L, type) => L.got.filter((g) => g.type === type && (type === T.SetColor ? g.payload.readUInt32LE(9) : g.payload.readUInt32LE(0)) === 800);
  assert.deepStrictEqual(bulb.color, { h: 1000, s: 2000, b: 3000, k: 4000 }, "Farbe zurück");
  assert.strictEqual(bulb.power, 0, "war aus – wieder aus");
  assert.strictEqual(back(bulb, T.SetColor).length, 2);
  assert.strictEqual(back(bulb, T.SetColor)[0].payload.readUInt32LE(9), 800);
  const rz = back(strip, T.SetExtendedColorZones);
  assert.strictEqual(rz.length, 2);
  for (let i = 0; i < 16; i++) assert.strictEqual(rz[0].payload.readUInt16LE(8 + i * 8), i * 1000, `Zone ${i}`);
  assert.strictEqual(strip.power, 65535);
  assert.deepStrictEqual(late.color, { h: 5, s: 6, b: 7, k: 3500 });
  // danach kommt nichts mehr
  const n = bulb.got.length + strip.got.length;
  await sleep(200);
  assert.strictEqual(bulb.got.length + strip.got.length, n);

  /* ---- 6) Einstellung geändert: herausgenommene Lampe sofort zurück, die anderen machen weiter */
  for (let i = 0; i < 25; i++) {
    feed(false);
    await sleep(33);
  }
  bulb.got.length = 0;
  cfg.lifxIps = strip.addr;
  lights.sync();
  await sleep(300);
  assert.strictEqual(bulb.color.h, 1000, "herausgenommene Lampe nicht zurück");
  strip.got.length = 0;
  // neue Schläge (über 0,34 s auseinander, sonst hält die Blitz-Schranke sie zurück) → neue Farben
  for (let i = 0; i < 3; i++) {
    feed(false);
    await sleep(30);
    lights.feed({ k: 0, a: 0, e: 1, d: 0, pal: PAL });
    await sleep(340);
  }
  assert.ok(strip.got.some((g) => g.type === T.SetExtendedColorZones), "verbleibende Lampe macht nicht weiter");
  const b2 = bulb.got.length;
  await sleep(150);
  assert.strictEqual(bulb.got.length, b2, "herausgenommene Lampe bekommt noch Farben");
  await lights.stopAll();

  // Zustandsantworten lesen
  assert.strictEqual(parseLightState(Buffer.alloc(10)), null);
  assert.strictEqual(parseZones(Buffer.alloc(10)), null);

  for (const L of [bulb, strip, late]) L.sock.close();
  console.log("lights-lifx: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
