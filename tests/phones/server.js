// Lokale Gegenstellen für den Handy-Test: ein Dateiserver für docs/live/ und ein stummer MQTT-Relay.
// Nichts davon verlässt den Rechner – die Seite bekommt statt der öffentlichen Relays diesen hier.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };

function startServer(root) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(root, rel);
    // nichts außerhalb des Ordners ausliefern
    if (!file.startsWith(root + path.sep)) return void res.writeHead(403).end();
    // Browser fragen von selbst nach einem Icon – das ist kein Fehler der Seite
    if (rel === "/favicon.ico") return void res.writeHead(204).end();
    fs.readFile(file, (err, data) => {
      if (err) return void res.writeHead(404).end("not found");
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(data);
    });
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ port: server.address().port, close: () => new Promise((r) => server.close(r)) })));
}

// Relay ohne Party: nimmt Verbindungen und Abos an und sendet von sich aus nie eine Nachricht (nur über publish).
// Genau das sieht ein Gast, dessen QR-Code zu einer längst beendeten Party gehört.
function startBroker() {
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1", handleProtocols: () => "mqtt" });
  const stats = { clients: 0, subs: [], pubs: [] };
  const subs = new Map(); // Verbindung → abonnierte Themen
  wss.on("connection", (ws) => {
    stats.clients++;
    subs.set(ws, new Set());
    ws.on("close", () => subs.delete(ws));
    ws.on("message", (raw) => {
      const b = Buffer.from(raw);
      const type = b[0] >> 4;
      if (type === 1) ws.send(Buffer.from([0x20, 2, 0, 0])); // CONNECT → CONNACK
      else if (type === 3) {
        // was die Seite sendet, merken (Tests lesen es mit dem Schlüssel aus dem Link)
        let i = 1, len = 0, mul = 1, d;
        do {
          d = b[i++];
          len += (d & 127) * mul;
          mul *= 128;
        } while (d & 128);
        const tl = (b[i] << 8) | b[i + 1];
        stats.pubs.push({ topic: b.subarray(i + 2, i + 2 + tl).toString(), payload: b.subarray(i + 2 + tl, i + len) });
      }
      else if (type === 12) ws.send(Buffer.from([0xd0, 0])); // PING → PINGRESP
      else if (type === 8) {
        // SUBSCRIBE → SUBACK (kurze Themen: die Restlänge passt in ein Byte)
        const len = (b[4] << 8) | b[5];
        stats.subs.push(b.subarray(6, 6 + len).toString());
        subs.get(ws)?.add(b.subarray(6, 6 + len).toString());
        ws.send(Buffer.from([0x90, 3, b[2], b[3], 0]));
      }
    });
  });
  // Nachricht an alle, die das Thema abonniert haben (nur für Tests mit einer gespielten Party)
  const publish = (topic, payload) => {
    const t = Buffer.from(topic), body = Buffer.concat([Buffer.from([t.length >> 8, t.length & 255]), t, payload]), len = [];
    let n = body.length;
    do {
      let d = n % 128;
      n = Math.floor(n / 128);
      if (n) d |= 128;
      len.push(d);
    } while (n);
    const pkt = Buffer.concat([Buffer.from([0x30, ...len]), body]);
    for (const [ws, set] of subs) if (set.has(topic) && ws.readyState === 1) ws.send(pkt);
  };
  return new Promise((ok) => wss.on("listening", () => ok({ port: wss.address().port, stats, publish, close: () => new Promise((r) => {
    for (const c of wss.clients) c.terminate();
    wss.close(r);
  }) })));
}

module.exports = { startServer, startBroker };
