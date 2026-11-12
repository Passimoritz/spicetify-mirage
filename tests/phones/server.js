// Lokale Gegenstellen für den Handy-Test: ein Dateiserver für docs/live/ und ein stummer MQTT-Relay.
// Nichts davon verlässt den Rechner – die Seite bekommt statt der öffentlichen Relays diesen hier.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

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

// Relay ohne Party: nimmt Verbindungen und Abos an, sendet aber nie eine Nachricht.
// Genau das sieht ein Gast, dessen QR-Code zu einer längst beendeten Party gehört.
function startBroker() {
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1", handleProtocols: () => "mqtt" });
  const stats = { clients: 0, subs: [] };
  wss.on("connection", (ws) => {
    stats.clients++;
    ws.on("message", (raw) => {
      const b = Buffer.from(raw);
      const type = b[0] >> 4;
      if (type === 1) ws.send(Buffer.from([0x20, 2, 0, 0])); // CONNECT → CONNACK
      else if (type === 12) ws.send(Buffer.from([0xd0, 0])); // PING → PINGRESP
      else if (type === 8) {
        // SUBSCRIBE → SUBACK (kurze Themen: die Restlänge passt in ein Byte)
        const len = (b[4] << 8) | b[5];
        stats.subs.push(b.subarray(6, 6 + len).toString());
        ws.send(Buffer.from([0x90, 3, b[2], b[3], 0]));
      }
    });
  });
  return new Promise((ok) => wss.on("listening", () => ok({ port: wss.address().port, stats, close: () => new Promise((r) => {
    for (const c of wss.clients) c.terminate();
    wss.close(r);
  }) })));
}

module.exports = { startServer, startBroker };
