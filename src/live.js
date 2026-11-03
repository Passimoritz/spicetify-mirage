import QRCode from "qrcode";
import { cfg } from "./config.js";
import { currentItem, titleOf, artistOf } from "./player.js";

/* ---------------------------------------------------------------- Live-Link: Handys leuchten mit */
// Über jedes Netz (WLAN, mobile Daten) und ohne Overlay-App: das Theme schickt den Lichtzustand an einen
// öffentlichen Relay (MQTT über WebSocket), Ende-zu-Ende verschlüsselt (AES-GCM). Kanal und Schlüssel sind
// zufällig und stehen nur im QR-Link hinter dem „#“ – dieser Teil verlässt das Handy nie (auch GitHub Pages
// sieht ihn nicht); ohne QR-Code kein Zugang, und weil GCM jede Nachricht prüft, kann auch niemand etwas
// unterschieben. Gesendet wird nur, solange der Party-Modus läuft; 10 Minuten danach verfällt der Schlüssel.

// Kleinstmöglicher MQTT-3.1.1-Client über WebSocket: verbinden, veröffentlichen, abonnieren, Ping.
// Mehrere öffentliche Relays: wer zuerst antwortet, wird benutzt; fällt einer aus, der nächste.
const BROKERS = ["wss://broker.hivemq.com:8884/mqtt", "wss://broker.emqx.io:8084/mqtt"];
const te = new TextEncoder();
const mqStr = (s) => {
  const b = te.encode(s);
  return [b.length >> 8, b.length & 255, ...b];
};
const mqLen = (n) => {
  const o = [];
  do {
    let d = n % 128;
    n = Math.floor(n / 128);
    if (n) d |= 128;
    o.push(d);
  } while (n);
  return o;
};
const mqPkt = (h, body) => new Uint8Array([h, ...mqLen(body.length), ...body]);
function mqttOpen(url, { onReady, onMessage, onClose }) {
  const ws = new WebSocket(url, "mqtt");
  ws.binaryType = "arraybuffer";
  let buf = new Uint8Array(0), ping = 0;
  ws.onopen = () => {
    const id = "mirage-" + Math.random().toString(36).slice(2, 12);
    ws.send(mqPkt(0x10, [...mqStr("MQTT"), 4, 2, 0, 60, ...mqStr(id)]));
  };
  ws.onmessage = (e) => {
    const add = new Uint8Array(e.data), nb = new Uint8Array(buf.length + add.length);
    nb.set(buf);
    nb.set(add, buf.length);
    buf = nb;
    // ein WebSocket-Rahmen kann mehrere oder halbe MQTT-Pakete enthalten
    for (;;) {
      if (buf.length < 2) break;
      let len = 0, mul = 1, i = 1, b;
      do {
        if (i >= buf.length) return;
        b = buf[i++];
        len += (b & 127) * mul;
        mul *= 128;
      } while (b & 128);
      if (buf.length < i + len) break;
      const type = buf[0] >> 4, body = buf.subarray(i, i + len);
      buf = buf.slice(i + len);
      if (type === 2 && body[1] === 0) {
        ping = setInterval(() => ws.readyState === 1 && ws.send(new Uint8Array([0xc0, 0])), 30000);
        onReady?.(api);
      } else if (type === 3) {
        const tl = (body[0] << 8) | body[1];
        onMessage?.(body.slice(2 + tl));
      }
    }
  };
  ws.onclose = ws.onerror = () => {
    clearInterval(ping);
    if (api.closed) return;
    api.closed = true;
    onClose?.();
  };
  const api = {
    closed: false,
    publish: (topic, payload, retain) => ws.readyState === 1 && ws.send(mqPkt(0x30 | (retain ? 1 : 0), [...mqStr(topic), ...payload])),
    subscribe: (topic) => ws.readyState === 1 && ws.send(mqPkt(0x82, [0, 1, ...mqStr(topic), 0])),
    close: () => {
      api.closed = true;
      clearInterval(ping);
      try {
        ws.send(new Uint8Array([0xe0, 0]));
        ws.close();
      } catch {}
    },
  };
  return api;
}

const PAGE = "https://passimoritz.github.io/spicetify-mirage/live/";
const GRACE = 10 * 60e3, RATE = 125;
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
let ses = null, client = null, brokerIx = 0, status = "off", lastSend = 0, lastFeed = 0, offAt = 0, sending = false, stopT = 0, wanted = false;
const emit = () => window.dispatchEvent(new Event("mirage:live"));
const setStatus = (s) => {
  if (s === status) return;
  status = s;
  setTimeout(emit);
};

// Kanal und Schlüssel: bleiben, solange gefeiert wird (und 10 Minuten danach), sonst neu
async function prepare() {
  if (ses && (lastFeed || !offAt || Date.now() - offAt < GRACE)) return ses;
  const raw = crypto.getRandomValues(new Uint8Array(16)), ch = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const url = `${PAGE}#c=${b64u(ch)}&k=${b64u(raw)}`;
  ses = { topic: "mirage-live/" + b64u(ch), key, url, qr: await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) };
  offAt = 0;
  emit();
  return ses;
}
function connect() {
  if (client && !client.closed) return;
  setStatus("connecting");
  client = mqttOpen(BROKERS[brokerIx % BROKERS.length], {
    onReady: () => setStatus("on"),
    onClose: () => {
      client = null;
      setStatus(wanted ? "connecting" : "off");
      // nächster Relay, kurz warten
      if (wanted) setTimeout(() => wanted && (brokerIx++, connect()), 3000);
    },
  });
}
async function send(state, retain) {
  if (!client || status !== "on" || !ses || sending) return;
  sending = true;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, ses.key, te.encode(JSON.stringify(state))));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    client.publish(ses.topic, out, retain);
  } catch {}
  sending = false;
}
// jedes Bild im Party-Modus: höchstens 8 Nachrichten pro Sekunde; die Handyseite rechnet den Takt selbst weiter
function feed(px, pal, bpm) {
  if (!cfg.partyLive) return;
  lastFeed = performance.now();
  wanted = true;
  clearTimeout(stopT);
  stopT = setTimeout(stop, 2500);
  if (!ses) return void prepare();
  connect();
  if (lastFeed - lastSend < RATE) return;
  lastSend = lastFeed;
  const item = currentItem();
  send({
    v: 1, on: 1, s: Date.now(), bpm: Math.round(bpm || 120), bi: px.beatIdx, ph: +(px.phase || 0).toFixed(3),
    e: +px.energy.toFixed(2), k: +px.kickEnv.toFixed(2), d: +px.drop.toFixed(2), b: +px.build.toFixed(2),
    pal: (pal || []).slice(0, 3).map((c) => c.map((v) => Math.round(v))), t: titleOf(item) || "", a: artistOf(item) || "",
  }, true);
}
// Party verlassen: „aus“ melden, Verbindung schließen; nach 10 Minuten gilt der Link nicht mehr
async function stop() {
  clearTimeout(stopT);
  if (!wanted) return;
  wanted = false;
  lastFeed = 0;
  offAt = Date.now();
  await send({ v: 1, on: 0, s: Date.now() }, true);
  setTimeout(() => {
    client?.close();
    client = null;
    setStatus("off");
  }, 400);
}

export const live = { prepare, feed, stop, info: () => (ses ? { url: ses.url, qr: ses.qr } : null), status: () => status };
