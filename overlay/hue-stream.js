/* ------------------------------------------------------------------ Hue ohne Verzögerung (Entertainment) */
// Hue Entertainment schickt 25–50 Farbbilder pro Sekunde direkt an die Bridge statt einzelner REST-Befehle.
// Dazu gehören drei Teile:
//   1. Entertainment-Bereich auf der Bridge wählen/anlegen und das Streamen ein-/ausschalten (CLIP v2, HTTPS)
//   2. Farbbilder im Format HueStream v2 bauen
//   3. eine DTLS-1.2-Verbindung mit PSK (TLS_PSK_WITH_AES_128_GCM_SHA256) zur Bridge, UDP-Port 2100
// Teil 1 und 2 stehen hier (tests/unit/lights-huestream.test.js), Teil 3 ist dtls.js – ein eigener, kleiner
// DTLS-Client auf Nodes crypto/dgram, weil die gepflegte Bibliothek unter Electron ein natives Zusatzmodul braucht
// (tests/dtls/). createSession() unten setzt alles zusammen; lights.js lädt diese Datei nur, wenn „Hue schnell“
// (hueFast) an ist, und fällt bei jedem Fehler auf REST zurück.
//
// Reihenfolge beim Einschalten:
//   a) appId()  → PSK-Identität („hue-application-id“); PSK = Hue-Client-Schlüssel (32 Hex-Zeichen → 16 Byte).
//      Den Client-Schlüssel gibt die Bridge nur beim Koppeln heraus (generateclientkey) – wer vorher
//      gekoppelt hat, muss einmal neu koppeln.
//   b) areas() / pickArea() oder createArea()  → Bereich mit höchstens 20 Kanälen
//   c) start(id)  → erst danach nimmt die Bridge auf Port 2100 den DTLS-Handshake an
//   d) DTLS: ClientHello → HelloVerifyRequest (Cookie) → ClientHello → ServerHello, ServerHelloDone →
//      ClientKeyExchange (PSK-Identität), ChangeCipherSpec, Finished → ChangeCipherSpec, Finished
//   e) alle 20 ms encodeFrame() senden (auch ohne Änderung: nach 10 s ohne Daten beendet die Bridge den Stream)
//   f) Ende oder Fehler: Verbindung schließen, stop(id), zurück auf REST. Während des Streamens darf der
//      REST-Weg die Lampen des Bereichs nicht anfassen.
const https = require("https");
const http = require("http");
const tls = require("tls");

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX_CHANNELS = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---- Farbbild im Format HueStream v2 (alles Big-Endian):
     0– 8  „HueStream“
     9–10  Version 2.0 (0x02 0x00)
    11     laufende Nummer (0–255, läuft über; die Bridge wertet sie nicht aus)
    12–13  reserviert (0)
    14     Farbraum: 0 = RGB, 1 = xy + Helligkeit
    15     reserviert (0)
    16–51  ID des Entertainment-Bereichs (36 ASCII-Zeichen)
    ab 52  je Kanal 7 Byte: Kanalnummer, dann drei 16-Bit-Werte (R, G, B oder x, y, Helligkeit)
   channels: [{ id, rgb: [r, g, b] }] mit 0–255 je Farbe; höchstens 20 Kanäle. */
function encodeFrame(areaId, seq, channels) {
  if (!UUID.test(String(areaId || ""))) throw new Error("area id");
  if (!Array.isArray(channels) || channels.length > MAX_CHANNELS) throw new Error("channels");
  const buf = Buffer.alloc(52 + channels.length * 7);
  buf.write("HueStream", 0, "ascii");
  buf[9] = 2;
  buf[10] = 0;
  buf[11] = seq & 255;
  buf[14] = 0; // RGB: die Bridge rechnet je Lampe in deren Farbraum um
  buf.write(String(areaId), 16, "ascii");
  channels.forEach((c, i) => {
    const o = 52 + i * 7;
    buf[o] = clamp(Math.round(c.id), 0, 255);
    // 8 Bit → 16 Bit: 255 wird genau 65535
    for (let k = 0; k < 3; k++) buf.writeUInt16BE(Math.round(clamp(Number(c.rgb?.[k]) || 0, 0, 255) * 257), o + 1 + k * 2);
  });
  return buf;
}

/* ---- CLIP v2 auf der Bridge. base: „https://<Bridge>“, key: Hue-Schlüssel (bleibt im Hauptprozess, geht nur
   als Kopfzeile an die Bridge). Das Zertifikat der Bridge stammt von Signifys eigener Stelle, die Node nicht kennt;
   die Prüfung einfach abzuschalten ist keine Lösung, der Schlüssel ginge sonst an jeden im Netz. Zwei Wege:
   · ca: Wurzelzertifikat von Signify (PEM), dann prüft Node wie gewohnt
   · sonst festgenagelt (pin): beim ersten Mal muss der Name im Zertifikat (CN) die Bridge-ID sein (bridgeId, aus
     /api/config), dann wird sein Fingerabdruck gemerkt (onPin); danach zählt nur noch genau dieser. Erst wenn das
     stimmt, geht die Anfrage mit dem Schlüssel über die schon geprüfte Verbindung raus. */
function createHueV2({ base, key, ca, servername, timeout = 3000, pin = "", bridgeId = "", onPin }) {
  function openPinned(u) {
    return new Promise((resolve) => {
      const s = tls.connect({ host: u.hostname, port: Number(u.port) || 443, rejectUnauthorized: false, ...(servername ? { servername } : {}) });
      const fail = () => {
        s.destroy();
        resolve(null);
      };
      s.setTimeout(timeout, fail);
      s.once("error", fail);
      s.once("secureConnect", () => {
        const c = s.getPeerCertificate() || {};
        const fp = String(c.fingerprint256 || "");
        const cn = String(c.subject?.CN || "").toLowerCase();
        if (!fp) return fail();
        if (pin ? fp !== pin : !bridgeId || cn !== String(bridgeId).toLowerCase()) return fail();
        if (!pin) {
          pin = fp;
          onPin?.(fp);
        }
        s.setTimeout(0);
        s.removeListener("error", fail);
        s.on("error", () => {});
        resolve(s);
      });
    });
  }
  async function request(method, path, body) {
    let u;
    try {
      u = new URL(base + path);
    } catch {
      return { status: 0, headers: {}, json: null };
    }
    const pinned = u.protocol === "https:" && !ca;
    const sock = pinned ? await openPinned(u) : null;
    if (pinned && !sock) return { status: 0, headers: {}, json: null };
    return new Promise((resolve) => {
      const data = body == null ? null : Buffer.from(JSON.stringify(body));
      const opts = { method, timeout, headers: { "hue-application-key": key, ...(data ? { "content-type": "application/json", "content-length": data.length } : {}) } };
      if (sock) Object.assign(opts, { createConnection: () => sock, headers: { ...opts.headers, connection: "close" } });
      else if (u.protocol === "https:") Object.assign(opts, ca ? { ca } : {}, servername ? { servername } : {});
      const req = (u.protocol === "https:" ? https : http).request(u, opts, (res) => {
        let s = "";
        res.on("data", (c) => (s += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(s || "null");
          } catch {}
          resolve({ status: res.statusCode || 0, headers: res.headers, json });
        });
      });
      req.on("timeout", () => req.destroy());
      req.on("error", () => resolve({ status: 0, headers: {}, json: null }));
      if (data) req.write(data);
      req.end();
    });
  }
  // Antwort der Bridge: { errors: [], data: [] } – Daten nur, wenn kein Fehler gemeldet ist
  const dataOf = (r) => (r.status >= 200 && r.status < 300 && Array.isArray(r.json?.data) && !r.json.errors?.length ? r.json.data : null);

  // PSK-Identität für DTLS (steht nur in einer Kopfzeile der Antwort)
  async function appId() {
    const r = await request("GET", "/auth/v1");
    const id = String(r.headers["hue-application-id"] || "");
    return /^[\w-]{8,64}$/.test(id) ? id : "";
  }
  // Entertainment-Bereiche: [{ id, name, type, active, channels: [{ id, x, y, z }] }] oder null bei Fehler
  async function areas() {
    const d = dataOf(await request("GET", "/clip/v2/resource/entertainment_configuration"));
    if (!d) return null;
    return d.filter((a) => UUID.test(a?.id || "")).map((a) => ({
      id: a.id,
      name: String(a.metadata?.name || a.name || a.id),
      type: String(a.configuration_type || ""),
      active: a.status === "active",
      channels: (Array.isArray(a.channels) ? a.channels : []).map((c) => ({ id: Number(c.channel_id), x: Number(c.position?.x) || 0, y: Number(c.position?.y) || 0, z: Number(c.position?.z) || 0 })).filter((c) => Number.isInteger(c.id)),
    }));
  }
  // Bereich für die Lampen eines Raums anlegen. v1Ids: Lampennummern der alten API („5“), wie sie lights.js
  // kennt. Nur Lampen, die streamen können (renderer); gibt die neue ID zurück oder { error }.
  async function createArea(name, v1Ids) {
    const [lights, ents] = await Promise.all([request("GET", "/clip/v2/resource/light"), request("GET", "/clip/v2/resource/entertainment")]);
    const l = dataOf(lights), e = dataOf(ents);
    if (!l || !e) return { error: "unreachable" };
    const want = new Set(v1Ids.map((id) => `/lights/${id}`));
    const owners = new Set(l.filter((x) => want.has(x.id_v1)).map((x) => x.owner?.rid).filter(Boolean));
    const services = e.filter((x) => x.renderer && owners.has(x.owner?.rid)).map((x) => x.id).slice(0, MAX_CHANNELS);
    if (!services.length) return { error: "nolights" };
    // die Lampen gleichmäßig von links nach rechts verteilen – für den Farbverlauf reicht das
    const n = services.length;
    const service_locations = services.map((rid, i) => ({ service: { rid, rtype: "entertainment" }, positions: [{ x: n > 1 ? +(-1 + (2 * i) / (n - 1)).toFixed(3) : 0, y: 0, z: 0 }] }));
    const r = await request("POST", "/clip/v2/resource/entertainment_configuration", { type: "entertainment_configuration", metadata: { name: String(name).slice(0, 32) }, configuration_type: "music", locations: { service_locations } });
    const id = dataOf(r)?.[0]?.rid;
    return UUID.test(id || "") ? { id } : { error: "rejected" };
  }
  // Lampennummern der alten API („5“) eines Bereichs – damit REST sie in Ruhe lässt, solange gestreamt wird, und
  // ihr Zustand vorher gemerkt werden kann. Neuere Firmware nennt die Lampen direkt (light_services), ältere nur
  // über Kanal → Entertainment-Dienst → Gerät → Lampe. null bei Fehler.
  async function areaLights(id) {
    if (!UUID.test(String(id || ""))) return null;
    const [ar, lr, er] = await Promise.all([request("GET", `/clip/v2/resource/entertainment_configuration/${id}`), request("GET", "/clip/v2/resource/light"), request("GET", "/clip/v2/resource/entertainment")]);
    const a = dataOf(ar)?.[0], l = dataOf(lr), e = dataOf(er);
    if (!a || !l || !e) return null;
    const rids = new Set((Array.isArray(a.light_services) ? a.light_services : []).map((x) => x?.rid).filter(Boolean));
    const owners = new Set();
    for (const ch of Array.isArray(a.channels) ? a.channels : [])
      for (const m of Array.isArray(ch?.members) ? ch.members : []) {
        const ent = e.find((x) => x.id === m?.service?.rid);
        if (ent?.owner?.rid) owners.add(ent.owner.rid);
      }
    const ids = l.filter((x) => rids.has(x.id) || owners.has(x.owner?.rid)).map((x) => (String(x.id_v1 || "").match(/^\/lights\/(\d+)$/) || [])[1]).filter(Boolean);
    return [...new Set(ids)];
  }
  const action = async (id, what) => UUID.test(String(id || "")) && !!dataOf(await request("PUT", `/clip/v2/resource/entertainment_configuration/${id}`, { action: what }));
  return { appId, areas, areaLights, createArea, start: (id) => action(id, "start"), stop: (id) => action(id, "stop") };
}

// Bereich wählen: der gemerkte, sonst der erste, der passt (hat Kanäle, höchstens 20)
function pickArea(list, wanted) {
  const ok = (Array.isArray(list) ? list : []).filter((a) => a.channels.length > 0 && a.channels.length <= MAX_CHANNELS);
  return ok.find((a) => a.id === wanted) || ok[0] || null;
}

/* ---- Eine Streaming-Sitzung: Bereich wählen, Streamen einschalten, DTLS aufbauen, Bilder senden, alles wieder
   abbauen. v2: createHueV2(…), connect: dtls.connect, host: Bridge-Adresse ohne Port, clientKey: 32 Hex-Zeichen,
   area: gemerkte Bereichs-ID. Wirft nie: start() liefert { ok, area, lights } oder { error }; bricht die Verbindung
   später ab (Bridge weg, Alarm), kommt onDrop() – der Aufrufer geht dann zurück auf REST. prepare(lights) läuft,
   bevor die Bridge ins Streamen schaltet (dann lässt sich der Zustand der Lampen noch per REST merken). */
function createSession({ v2, connect, host, clientKey, area: wanted = "", onDrop = () => {}, prepare = async () => {} }) {
  let conn = null, area = null, seq = 0, closing = false;
  async function start() {
    if (!/^[0-9a-f]{32}$/i.test(String(clientKey || ""))) return { error: "clientkey" };
    const identity = await v2.appId();
    if (!identity) return { error: "unreachable" };
    area = pickArea(await v2.areas(), wanted);
    if (!area) return { error: "noarea" };
    const lights = await v2.areaLights(area.id);
    if (!lights) return { error: "unreachable" };
    await prepare(lights);
    if (closing) return { error: "stopped" };
    if (!(await v2.start(area.id))) return { error: "start" };
    try {
      conn = await connect({ host, port: 2100, identity, psk: Buffer.from(clientKey, "hex") });
    } catch (e) {
      conn = null;
      await v2.stop(area.id);
      return { error: "dtls", detail: String(e?.message || e).slice(0, 80) };
    }
    // inzwischen abgesagt (Party vorbei): gleich wieder abbauen
    if (closing) {
      try { conn.close(); } catch {}
      conn = null;
      await v2.stop(area.id);
      return { error: "stopped" };
    }
    conn.on("error", drop);
    conn.on("close", drop);
    return { ok: true, area: { id: area.id, name: area.name, channels: area.channels }, lights };
  }
  function drop() {
    if (closing) return;
    closing = true;
    conn = null;
    Promise.resolve(area && v2.stop(area.id)).catch(() => {}).finally(() => onDrop());
  }
  // channels: [{ id, rgb }] – ein Bild; false, wenn (noch) keine Verbindung steht
  const frame = (channels) => !!conn && conn.send(encodeFrame(area.id, seq++, channels));
  async function stop() {
    if (closing) return;
    closing = true;
    const c = conn;
    conn = null;
    if (!c) return; // start() läuft noch oder ist gescheitert: es räumt selbst auf
    try { c.close(); } catch {}
    await v2.stop(area.id);
  }
  return { start, frame, stop };
}

module.exports = { encodeFrame, createHueV2, pickArea, createSession, MAX_CHANNELS };
