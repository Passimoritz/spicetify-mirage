/* ------------------------------------------------------------------ LIFX (LAN-Protokoll, UDP 56700) */
// Lampen und Streifen im eigenen Netz, ohne LIFX-Konto und ohne Cloud. Suche per Rundruf (GetService), danach
// spricht die App jede Lampe direkt an: SetColor (eine Farbe) bzw. SetExtendedColorZones (Streifen und Beam,
// bis 82 Zonen in einer Nachricht). LIFX empfiehlt höchstens 20 Nachrichten pro Sekunde je Gerät – hier gehen
// höchstens ~16 raus und nur, wenn sich sichtbar etwas ändert. Vor der ersten Farbe merkt sich die App Farbe,
// Zonen und an/aus jeder Lampe; nach der Party kommt genau das zurück. Lampen, die (noch) nicht antworten,
// bekommen nichts und werden alle 3 s neu gefragt. opts.lifxBroadcast / opts.lifxPort / opts.lampRetryMs nur für Tests.
const dgram = require("dgram");
const { clamp, scale, lanAddr, lanList, createGate, sig, hsv, oneColor, spreadColor, sleep } = require("./lamp-kit.js");

const PORT = 56700;
const T = { GetService: 2, StateService: 3, Acknowledgement: 45, Get: 101, SetColor: 102, LightState: 107, SetLightPower: 117, SetExtendedColorZones: 510, GetExtendedColorZones: 511, StateExtendedColorZones: 512, StateUnhandled: 223 };
const KELVIN = 3500, MAX_ZONES = 82;

/* ---- Kopf (36 Byte, Little Endian): Frame (Größe, Protokoll 1024 + addressable + tagged, Quelle),
   Frame Address (Ziel 8 Byte, 6 reserviert, res/ack, Folgenummer), Protocol Header (8 reserviert, Typ, 2 reserviert) */
function encode(type, payload = Buffer.alloc(0), o = {}) {
  const buf = Buffer.alloc(36 + payload.length);
  buf.writeUInt16LE(buf.length, 0);
  // Protokoll 1024 (12 Bit) | addressable (Bit 12, immer 1) | tagged (Bit 13: an alle, Ziel = Nullen)
  buf.writeUInt16LE(1024 | 0x1000 | (o.tagged ? 0x2000 : 0), 2);
  buf.writeUInt32LE((o.source || 0) >>> 0, 4);
  if (o.target) Buffer.from(o.target).copy(buf, 8, 0, 8);
  buf[22] = (o.res ? 1 : 0) | (o.ack ? 2 : 0);
  buf[23] = (o.seq || 0) & 0xff;
  buf.writeUInt16LE(type, 32);
  payload.copy(buf, 36);
  return buf;
}
// Nachricht lesen; null, wenn es kein gültiges LIFX-Paket ist
function decode(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 36 || buf.readUInt16LE(0) !== buf.length || (buf.readUInt16LE(2) & 0xfff) !== 1024) return null;
  return { type: buf.readUInt16LE(32), source: buf.readUInt32LE(4), target: buf.subarray(8, 16), seq: buf[23], payload: buf.subarray(36) };
}

// RGB (schon auf Helligkeit skaliert) → HSBK, alles 0..65535; Weißpunkt 3500 K
function toHsbk(rgb) {
  const { h, s, v } = hsv(rgb);
  return { h: Math.round((h / 360) * 65535) & 0xffff, s: Math.round(s * 65535), b: Math.round(v * 65535), k: KELVIN };
}
function writeHsbk(buf, o, c) {
  buf.writeUInt16LE(c.h & 0xffff, o);
  buf.writeUInt16LE(clamp(c.s | 0, 0, 65535), o + 2);
  buf.writeUInt16LE(clamp(c.b | 0, 0, 65535), o + 4);
  buf.writeUInt16LE(clamp(c.k | 0, 1500, 9000), o + 6);
}
const readHsbk = (buf, o) => ({ h: buf.readUInt16LE(o), s: buf.readUInt16LE(o + 2), b: buf.readUInt16LE(o + 4), k: buf.readUInt16LE(o + 6) });

// SetColor (102): reserviert (1), HSBK (8), Dauer in ms (4)
function setColor(c, duration, o) {
  const p = Buffer.alloc(13);
  writeHsbk(p, 1, c);
  p.writeUInt32LE(Math.max(0, duration | 0), 9);
  return encode(T.SetColor, p, o);
}
// SetLightPower (117): Stufe 0 oder 65535 (2), Dauer in ms (4)
function setPower(level, duration, o) {
  const p = Buffer.alloc(6);
  p.writeUInt16LE(level ? 65535 : 0, 0);
  p.writeUInt32LE(Math.max(0, duration | 0), 2);
  return encode(T.SetLightPower, p, o);
}
// SetExtendedColorZones (510): Dauer (4), apply (1, 1 = sofort), erste Zone (2), Anzahl (1), 82 × HSBK
function setZones(colors, duration, o, index = 0) {
  const p = Buffer.alloc(8 + MAX_ZONES * 8), n = Math.min(colors.length, MAX_ZONES);
  p.writeUInt32LE(Math.max(0, duration | 0), 0);
  p[4] = 1;
  p.writeUInt16LE(index, 5);
  p[7] = n;
  for (let i = 0; i < n; i++) writeHsbk(p, 8 + i * 8, colors[i]);
  return encode(T.SetExtendedColorZones, p, o);
}
// LightState (107): HSBK, reserviert (2), Stufe (2), Name (32), reserviert (8)
function parseLightState(p) {
  if (p.length < 52) return null;
  return { color: readHsbk(p, 0), power: p.readUInt16LE(10), label: p.subarray(12, 44).toString("utf8").replace(/\0[\s\S]*$/, "") };
}
// StateExtendedColorZones (512): Zonen gesamt (2), erste Zone (2), Anzahl (1), 82 × HSBK
function parseZones(p) {
  if (p.length < 5 + MAX_ZONES * 8) return null;
  const count = p.readUInt16LE(0), index = p.readUInt16LE(2), n = Math.min(p[4], MAX_ZONES);
  return { count, index, colors: Array.from({ length: n }, (_, i) => readHsbk(p, 5 + i * 8)) };
}

function createLifx({ getCfg, log = () => {}, opts = {} }) {
  // Quelle: zufällig, nie 0 (0 heißt für die Lampe „Antwort an alle“)
  const source = (Math.floor(Math.random() * 0xfffffff0) + 2) >>> 0;
  const gate = createGate(60), ASK = opts.lampRetryMs || 3000;
  let sock = null, opening = null, seq = 0, scanning = null;
  const devs = new Map(); // "ip:port" → Lampe
  const ips = () => lanList(getCfg().lifxIps, opts.lifxPort || PORT);

  function open() {
    if (sock) return Promise.resolve(sock);
    if (opening) return opening;
    const s = dgram.createSocket("udp4");
    s.on("error", () => close());
    s.on("message", onMessage);
    opening = new Promise((r) => s.bind(0, () => {
      try { s.setBroadcast(true); } catch {}
      sock = s;
      opening = null;
      r(s);
    }));
    return opening;
  }
  function close() {
    try { sock?.close(); } catch {}
    sock = null;
    opening = null;
  }
  function send(d, msg) {
    try { sock?.send(msg, d.port, d.host); } catch {}
  }
  const o = (d, extra = {}) => ({ source, target: d.target, tagged: !d.target, seq: (seq = (seq + 1) & 0xff), ...extra });

  function onMessage(buf, rinfo) {
    const m = decode(buf);
    if (!m || m.source !== source || !lanAddr(rinfo.address)) return;
    if (m.type === T.StateService && scanning && m.payload.length >= 5 && m.payload[0] === 1) {
      // Service 1 = UDP; der Port steht in der Antwort (normalerweise 56700)
      const a = lanAddr(`${rinfo.address}:${m.payload.readUInt32LE(1)}`);
      if (a) scanning.set(a.key, { ip: a.port === PORT ? a.host : a.key });
      return;
    }
    const d = devs.get(`${rinfo.address}:${rinfo.port}`);
    if (!d) return;
    // die Seriennummer im Kopf ist das Ziel für alle weiteren Nachrichten
    if (m.target.some((x) => x)) d.target = Buffer.from(m.target);
    if (m.type === T.LightState && !d.saved) {
      const st = parseLightState(m.payload);
      if (!st) return;
      d.saved = st;
      log(`lifx: ${d.key} ready${st.label ? ` (${st.label.slice(0, 30)})` : ""}`);
      // ausgeschaltet zeigt sie keine Farben: für die Party an (nach der Party wieder aus)
      if (!st.power) send(d, setPower(1, 0, o(d)));
    } else if (m.type === T.StateExtendedColorZones && !d.savedZones) {
      const z = parseZones(m.payload);
      if (!z || !z.count) return;
      d.zones = Math.min(z.count, MAX_ZONES);
      d.zoneBuf ||= [];
      z.colors.forEach((c, i) => (d.zoneBuf[z.index + i] = c));
      if (d.zoneBuf.filter(Boolean).length >= d.zones) d.savedZones = d.zoneBuf.slice(0, d.zones);
    } else if (m.type === T.StateUnhandled && m.payload.length >= 2 && m.payload.readUInt16LE(0) === T.GetExtendedColorZones) d.noZones = true;
  }
  // Zustand erfragen (Farbe/an-aus und – bei Streifen – die Zonen)
  function ask(d, now) {
    d.askedAt = now;
    send(d, encode(T.Get, undefined, o(d, { res: true })));
    send(d, encode(T.GetExtendedColorZones, undefined, o(d, { res: true })));
  }
  // bereit, wenn der Zustand gemerkt ist; Zonen-Antwort abwarten (oder 600 ms, dann ist es keine Zonen-Lampe)
  const ready = (d, now) => !!d.saved && (!!d.savedZones || d.noZones || now - d.askedAt > 600);

  async function start() {
    const list = ips();
    if (!list.length) return;
    await open();
    const now = Date.now();
    for (const a of list) if (!devs.has(a.key)) {
      const d = { ...a, target: null, saved: null, zones: 0, savedZones: null, zoneBuf: null, noZones: false, askedAt: 0 };
      devs.set(a.key, d);
      ask(d, now);
    }
  }

  function frame(now, look) {
    if (!sock) return;
    const dur = look.cal ? 0 : look.nf ? 600 : 60;
    for (const d of devs.values()) {
      if (!d.saved) {
        // antwortet nicht (aus, weg, noch nicht da): alle 3 s noch einmal fragen
        if (now - d.askedAt > ASK) ask(d, now);
        continue;
      }
      if (!ready(d, now)) continue;
      if (d.zones > 1 && d.savedZones) {
        const rgb = Array.from({ length: d.zones }, (_, i) => scale(spreadColor(look, (i / Math.max(1, d.zones - 1)) * 2 - 1), look.lv));
        if (!gate.ok(d.key, now, rgb.map((c) => sig(c)).join("|"))) continue;
        send(d, setZones(rgb.map(toHsbk), dur, o(d)));
      } else {
        const rgb = scale(oneColor(look), look.lv);
        if (!gate.ok(d.key, now, sig(rgb))) continue;
        send(d, setColor(toHsbk(rgb), dur, o(d)));
      }
    }
  }

  // Party vorbei: Farbe bzw. Zonen und an/aus zurück. UDP kann verloren gehen – jede Nachricht geht zweimal.
  async function restore(only) {
    const list = [...devs.values()].filter((d) => !only || only(d));
    for (const d of list) devs.delete(d.key);
    gate.forget();
    const back = list.filter((d) => d.saved);
    if (sock) for (let i = 0; i < 2; i++) {
      for (const d of back) {
        if (d.savedZones && d.zones > 1) send(d, setZones(d.savedZones, 800, o(d)));
        else send(d, setColor(d.saved.color, 800, o(d)));
        send(d, setPower(d.saved.power, 800, o(d)));
      }
      if (back.length) await sleep(120);
    }
    if (!devs.size && !scanning) close();
  }
  // Einstellungen geändert: Lampen, die nicht mehr in der Liste stehen, sofort zurück
  function sync() {
    const keep = new Set(ips().map((a) => a.key));
    return restore((d) => !keep.has(d.key));
  }

  // Lampen im Netz finden: GetService an alle (zweimal), ms lang auf StateService warten
  async function scan(ms = 1500) {
    if (scanning) return { list: [] };
    scanning = new Map();
    try {
      await open();
      const to = { host: opts.lifxBroadcast || "255.255.255.255", port: opts.lifxPort || PORT };
      for (let i = 0; i < 2; i++) {
        try { sock?.send(encode(T.GetService, undefined, { source, tagged: true, seq: (seq = (seq + 1) & 0xff), res: true }), to.port, to.host); } catch {}
        await sleep(ms / 2);
      }
      return { list: [...scanning.values()].slice(0, 16) };
    } finally {
      scanning = null;
      if (!devs.size) close();
    }
  }

  return { start, frame, restore: () => restore(), sync, scan, ips, ready: () => ips().length > 0 };
}

module.exports = { createLifx, encode, decode, setColor, setPower, setZones, toHsbk, parseLightState, parseZones, T };
