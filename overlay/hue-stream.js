/* ------------------------------------------------------------------ Hue ohne Verzögerung (Entertainment) */
// Hue Entertainment schickt 25–50 Farbbilder pro Sekunde direkt an die Bridge statt einzelner REST-Befehle.
// Dazu gehören drei Teile:
//   1. Entertainment-Bereich auf der Bridge wählen/anlegen und das Streamen ein-/ausschalten (CLIP v2, HTTPS)
//   2. Farbbilder im Format HueStream v2 bauen
//   3. eine DTLS-1.2-Verbindung mit PSK (TLS_PSK_WITH_AES_128_GCM_SHA256) zur Bridge, UDP-Port 2100
// Teil 1 und 2 stehen hier und sind getestet (tests/unit/lights-huestream.test.js). Teil 3 FEHLT mit Absicht:
// Node hat kein DTLS, und die einzige gepflegte Bibliothek (node-dtls-client) lädt unter Electron nur mit
// einem nativen Zusatzmodul. Solange das nicht sauber gelöst ist, bindet main.js diese Datei nicht ein und
// es gibt keinen Schalter dafür – Hue läuft weiter über REST (lights.js).
//
// Plan für Teil 3 (Reihenfolge beim Einschalten):
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
   als Kopfzeile an die Bridge). ca: Wurzelzertifikat von Signify (PEM) – ohne das lehnt Node das Zertifikat
   der Bridge ab; die Prüfung abzuschalten ist keine Lösung, der Schlüssel ginge sonst an jeden im Netz. */
function createHueV2({ base, key, ca, servername, timeout = 3000 }) {
  function request(method, path, body) {
    return new Promise((resolve) => {
      let u;
      try {
        u = new URL(base + path);
      } catch {
        return resolve({ status: 0, headers: {}, json: null });
      }
      const data = body == null ? null : Buffer.from(JSON.stringify(body));
      const opts = { method, timeout, headers: { "hue-application-key": key, ...(data ? { "content-type": "application/json", "content-length": data.length } : {}) } };
      if (u.protocol === "https:") Object.assign(opts, ca ? { ca } : {}, servername ? { servername } : {});
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
  const action = async (id, what) => UUID.test(String(id || "")) && !!dataOf(await request("PUT", `/clip/v2/resource/entertainment_configuration/${id}`, { action: what }));
  return { appId, areas, createArea, start: (id) => action(id, "start"), stop: (id) => action(id, "stop") };
}

// Bereich wählen: der gemerkte, sonst der erste, der passt (hat Kanäle, höchstens 20)
function pickArea(list, wanted) {
  const ok = (Array.isArray(list) ? list : []).filter((a) => a.channels.length > 0 && a.channels.length <= MAX_CHANNELS);
  return ok.find((a) => a.id === wanted) || ok[0] || null;
}

module.exports = { encodeFrame, createHueV2, pickArea, MAX_CHANNELS };
