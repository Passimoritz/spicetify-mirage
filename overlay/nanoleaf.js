/* ------------------------------------------------------------------ Nanoleaf (lokale OpenAPI) */
// Paneele (Light Panels, Canvas, Shapes, Elements, Lines) im eigenen Netz. Koppeln: Ein/Aus-Knopf am Controller
// 5–7 s halten, bis die LEDs blinken, dann innerhalb von 30 s POST /api/v1/new → Zugangsschlüssel (liegt
// verschlüsselt über secrets.js). Während der Party bekommt jedes Paneel eigene Farben über „extControl v2“
// (UDP an Port 60222, 10 Bilder/s); kann das Gerät das nicht, wechselt per REST höchstens 2-mal pro Sekunde die
// Farbe. Danach kommt der alte Zustand zurück (Effekt bzw. Farbe, Helligkeit, an/aus).
// opts.nanoleafUdpPort, opts.ssdp, opts.bonjour, opts.lampRetryMs, opts.nanoleafCheckMs nur für Tests.
const dgram = require("dgram");
const { clamp, scale, lanAddr, createGate, sig, req, hsv, oneColor, spreadColor, sleep } = require("./lamp-kit.js");

const API_PORT = 16021, UDP_PORT = 60222;
// Zugangsschlüssel der OpenAPI: 32 Zeichen aus Buchstaben und Ziffern (etwas Spielraum)
const TOKEN = /^[A-Za-z0-9]{16,64}$/;
// Paneel-Typen ohne eigenes Licht: Rhythm-Modul, Shapes-Controller, Lines-Verbinder, Controller-Kappe, Stromanschluss
const NO_LIGHT = new Set([1, 12, 16, 19, 20]);
// SSDP-Suchbegriffe: Light Panels, Canvas, Shapes, Elements/Lines
const SSDP_ST = ["nanoleaf_aurora:light", "nanoleaf:nl29", "nanoleaf:nl42", "nanoleaf:nl52", "nanoleaf:nl59"];

/* ---- extControl v2: Anzahl Paneele (2 Byte), je Paneel ID (2), R, G, B, W (je 1), Übergang (2, in 100 ms).
   Alles Big Endian. */
function encodeFrame(panels) {
  const buf = Buffer.alloc(2 + panels.length * 8);
  buf.writeUInt16BE(panels.length, 0);
  panels.forEach((p, i) => {
    const o = 2 + i * 8;
    buf.writeUInt16BE(p.id & 0xffff, o);
    buf[o + 2] = p.rgb[0];
    buf[o + 3] = p.rgb[1];
    buf[o + 4] = p.rgb[2];
    buf[o + 5] = 0;
    buf.writeUInt16BE(clamp(p.t | 0, 0, 0xffff), o + 6);
  });
  return buf;
}

// Paneele mit Licht aus panelLayout, links nach rechts; x von −1 bis +1 für den Farbverlauf
function parseLayout(info) {
  const list = info?.panelLayout?.layout?.positionData;
  if (!Array.isArray(list)) return [];
  const lit = list.filter((p) => Number.isInteger(p?.panelId) && p.panelId > 0 && !NO_LIGHT.has(p.shapeType)).slice(0, 200);
  const xs = lit.map((p) => Number(p.x) || 0), lo = Math.min(...xs), hi = Math.max(...xs);
  return lit.map((p, i) => ({ id: p.panelId, x: hi > lo ? ((xs[i] - lo) / (hi - lo)) * 2 - 1 : 0 })).sort((a, b) => a.x - b.x);
}

// Zustand vor der Party: Effekt (Szene) oder Farbe, Helligkeit, an/aus
function snapshot(info) {
  const s = info?.state;
  if (!s || typeof s.on?.value !== "boolean") return null;
  const num = (x, d = 0) => (Number.isFinite(Number(x?.value)) ? Number(x.value) : d);
  return { on: s.on.value, bri: num(s.brightness, 100), mode: String(s.colorMode || ""), hue: num(s.hue), sat: num(s.sat), ct: num(s.ct, 4000), effect: typeof info.effects?.select === "string" ? info.effects.select : "" };
}

// SSDP-Antwort (HTTP-artige Kopfzeilen) → { ip, name } oder null
function parseSsdp(text) {
  const h = {};
  for (const line of String(text).split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  if (!/nanoleaf/i.test(`${h.st || ""} ${h.nt || ""}`)) return null;
  const m = String(h.location || "").match(/^http:\/\/([\d.]+)(?::(\d+))?/i);
  const a = m && lanAddr(m[1]);
  if (!a) return null;
  return { ip: a.host, name: String(h["nl-devicename"] || h["nl-deviceid"] || "Nanoleaf").slice(0, 60) };
}

function createNanoleaf({ getCfg, log = () => {}, opts = {} }) {
  const gate = createGate(100, 1000), restGate = createGate(500);
  const RETRY = opts.lampRetryMs || 10000, CHECK = opts.nanoleafCheckMs || 15000;
  const dev = { state: "off", saved: null, base: "", panels: [], sock: null, host: "", retryAt: 0, gen: 0, checkAt: 0, busy: false };
  // Adresse (nur im eigenen Netz) und Schlüssel aus den Einstellungen → Basis-URL oder ""
  function base() {
    const c = getCfg(), a = lanAddr(c.nanoleafIp, API_PORT);
    return a && TOKEN.test(c.nanoleafToken || "") ? `http://${a.key}/api/v1/${c.nanoleafToken}` : "";
  }
  const put = (b, path, body) => req("PUT", b + path, body, 1500);
  const okStatus = (r) => !!r && r.status >= 200 && r.status < 300;

  async function start() {
    const b = base();
    if (dev.state !== "off" || Date.now() < dev.retryAt || !b) return;
    dev.state = "starting";
    const gen = ++dev.gen;
    const info = await req("GET", b + "/", null, 2500);
    if (gen !== dev.gen) return;
    if (info?.status !== 200 || !info.body) return fail("unreachable");
    // vorher-Zustand nur einmal je Party merken – nach einem Verbindungsabbruch leuchtet es schon in Partyfarben
    if (!dev.saved) {
      dev.saved = snapshot(info.body);
      dev.base = b;
    }
    dev.panels = parseLayout(info.body);
    // ein ausgeschaltetes Gerät zeigt nichts; volle Helligkeit, gedimmt wird über die Farben (lightBright/lightMax)
    await put(b, "/state", { on: { value: true }, brightness: { value: 100, duration: 0 } });
    const r = dev.panels.length ? await put(b, "/effects", { write: { command: "display", animType: "extControl", extControlVersion: "v2" } }) : null;
    if (gen !== dev.gen) return;
    dev.host = lanAddr(getCfg().nanoleafIp, API_PORT).host;
    dev.checkAt = Date.now() + CHECK;
    gate.forget();
    if (okStatus(r)) {
      dev.sock = dgram.createSocket("udp4");
      dev.sock.on("error", () => fail("udp"));
      dev.state = "stream";
      log(`nanoleaf: streaming ${dev.panels.length} panels`);
    } else {
      dev.state = "rest";
      log("nanoleaf: extControl not available, using REST");
    }
  }
  // Fehler oder Gerät weg: in 10 s neu verbinden (der gemerkte Zustand bleibt)
  function fail(why) {
    dev.gen++;
    try { dev.sock?.close(); } catch {}
    Object.assign(dev, { state: "off", sock: null, retryAt: Date.now() + RETRY, busy: false });
    log(`nanoleaf: ${why}, retry in ${Math.round(RETRY / 1000)} s`);
  }
  // alle 15 s nachsehen, ob das Gerät noch da ist (UDP merkt es nicht, wenn niemand zuhört)
  function check(now) {
    if (now < dev.checkAt || dev.busy) return;
    dev.checkAt = now + CHECK;
    const gen = dev.gen, b = base();
    req("GET", b + "/state/on", null, 2000).then((r) => {
      if (gen === dev.gen && dev.state !== "off" && r?.status !== 200) fail("offline");
    });
  }

  function frame(now, look) {
    if (dev.state === "stream") {
      const t = look.cal ? 0 : look.nf ? 5 : 1;
      const panels = dev.panels.map((p) => ({ id: p.id, rgb: scale(spreadColor(look, p.x), look.lv), t }));
      if (!gate.ok("udp", now, panels.map((p) => sig(p.rgb)).join("|"))) return;
      try { dev.sock.send(encodeFrame(panels), opts.nanoleafUdpPort || UDP_PORT, dev.host); } catch { return fail("send"); }
      check(now);
    } else if (dev.state === "rest") {
      if (dev.busy) return;
      const { h, s, v } = hsv(oneColor(look)), bri = Math.round(clamp(look.lv * v * 100, 1, 100));
      const hue = Math.round(h), sat = Math.round(s * 100);
      if (!restGate.ok("rest", now, `${hue >> 2},${sat >> 2},${bri >> 2}`)) return;
      dev.busy = true;
      const gen = dev.gen;
      // Helligkeits-Übergang in Sekunden: mit „Keine Blitze“ weich
      put(base(), "/state", { hue: { value: hue }, sat: { value: sat }, brightness: { value: bri, duration: look.nf ? 1 : 0 } }).then((r) => {
        if (gen !== dev.gen) return;
        dev.busy = false;
        if (!okStatus(r)) fail("offline");
      });
    }
  }

  async function restore() {
    const s = dev.saved, b = dev.base;
    dev.gen++;
    try { dev.sock?.close(); } catch {}
    Object.assign(dev, { state: "off", saved: null, base: "", panels: [], sock: null, retryAt: 0, busy: false });
    gate.forget();
    restGate.forget();
    if (!s || !b) return;
    // eigene Effekte zurück; interne Namen (*Solid*, *Dynamic*, *ExtControl*) heißen: es war eine feste Farbe
    if (s.mode === "effect" && s.effect && !s.effect.startsWith("*")) await put(b, "/effects", { select: s.effect });
    else if (s.mode === "ct") await put(b, "/state", { ct: { value: s.ct } });
    else await put(b, "/state", { hue: { value: s.hue }, sat: { value: s.sat } });
    await put(b, "/state", { brightness: { value: s.bri, duration: 1 } });
    if (!s.on) await put(b, "/state", { on: { value: false } });
  }

  // Koppeln: liefert { token } oder { error: "ip" | "button" | "unreachable" }
  async function pair(ip) {
    const a = lanAddr(ip, API_PORT);
    if (!a) return { error: "ip" };
    const r = await req("POST", `http://${a.key}/api/v1/new`, null, 4000);
    if (r?.status === 200 && TOKEN.test(r.body?.auth_token || "")) return { token: r.body.auth_token };
    // 403: das Gerät ist nicht im Kopplungsmodus (Knopf nicht lange genug gehalten oder 30 s vorbei)
    return { error: r?.status === 403 ? "button" : "unreachable" };
  }

  // Geräte im Netz finden: mDNS („_nanoleafapi._tcp“) und SSDP gleichzeitig, ms lang auf Antworten warten
  async function find(ms = 3000) {
    const found = new Map();
    const add = (ip, name) => {
      const a = lanAddr(ip);
      if (a && !found.has(a.host)) found.set(a.host, { ip: a.host, name: String(name || a.host).slice(0, 60) });
    };
    let b = null, browser = null, sock = null;
    try {
      const { Bonjour } = opts.bonjour || require("bonjour-service");
      b = new Bonjour();
      browser = b.find({ type: "nanoleafapi" }, (s) => add((s?.addresses || []).find((x) => lanAddr(x)) || s?.referer?.address, s?.name));
    } catch {}
    try {
      sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
      sock.on("error", () => {});
      sock.on("message", (buf) => {
        const d = parseSsdp(String(buf));
        if (d) add(d.ip, d.name);
      });
      await new Promise((r) => sock.bind(0, r));
      const to = opts.ssdp || { host: "239.255.255.250", port: 1900 };
      for (const st of SSDP_ST) {
        const msg = `M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${st}\r\n\r\n`;
        sock.send(Buffer.from(msg), to.port, to.host);
      }
    } catch {}
    await sleep(ms);
    try { browser?.stop(); } catch {}
    try { b?.destroy(); } catch {}
    try { sock?.close(); } catch {}
    return [...found.values()].slice(0, 10);
  }

  // Einstellungen geändert (anderes Gerät oder neu gekoppelt): das alte zurück, beim nächsten Schlag neu verbinden
  function sync() {
    if (dev.state !== "off" || dev.saved) return dev.base === base() ? undefined : restore();
  }

  return { start, frame, restore, sync, pair, find, ready: () => !!base(), state: () => dev.state };
}

module.exports = { createNanoleaf, encodeFrame, parseLayout, parseSsdp, snapshot, TOKEN };
