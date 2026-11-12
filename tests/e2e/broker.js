// Kleiner MQTT-3.1.1-Relay über WebSocket: verhält sich wie die öffentlichen Broker, die Mirage benutzt
// (QoS 0, aufbewahrte Nachrichten, Abo auf genaue Themen), mit Verzögerung und einstellbarem Paketverlust.
const { WebSocketServer } = require("ws");

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

function startBroker({ latency = 40, jitter = 60, loss = 0.02 } = {}) {
  const subs = new Map(), retained = new Map();
  const stats = { published: 0, dropped: 0, maxPayload: 0, clients: 0 };
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1", handleProtocols: () => "mqtt" });

  const frame = (topic, payload, retain) => {
    const t = Buffer.from(topic);
    const body = Buffer.concat([Buffer.from([t.length >> 8, t.length & 255]), t, payload]);
    return Buffer.concat([Buffer.from([0x30 | (retain ? 1 : 0), ...mqLen(body.length)]), body]);
  };
  const deliver = (ws, data) => setTimeout(() => ws.readyState === 1 && ws.send(data), latency + Math.random() * jitter);

  wss.on("connection", (ws) => {
    stats.clients++;
    const mine = new Set();
    let buf = Buffer.alloc(0);
    ws.on("message", (raw) => {
      buf = Buffer.concat([buf, Buffer.from(raw)]);
      for (;;) {
        if (buf.length < 2) return;
        let len = 0, mul = 1, i = 1, b;
        do {
          if (i >= buf.length) return;
          b = buf[i++];
          len += (b & 127) * mul;
          mul *= 128;
        } while (b & 128);
        if (buf.length < i + len) return;
        const head = buf[0], type = head >> 4, body = buf.subarray(i, i + len);
        buf = buf.subarray(i + len);
        if (type === 1) ws.send(Buffer.from([0x20, 2, 0, 0]));
        else if (type === 12) ws.send(Buffer.from([0xd0, 0]));
        else if (type === 14) ws.close();
        else if (type === 8) {
          const tl = (body[2] << 8) | body[3], topic = body.subarray(4, 4 + tl).toString();
          mine.add(topic);
          if (!subs.has(topic)) subs.set(topic, new Set());
          subs.get(topic).add(ws);
          ws.send(Buffer.from([0x90, 3, body[0], body[1], 0]));
          if (retained.has(topic)) deliver(ws, frame(topic, retained.get(topic), true));
        } else if (type === 3) {
          const tl = (body[0] << 8) | body[1], topic = body.subarray(2, 2 + tl).toString();
          const payload = Buffer.from(body.subarray(2 + tl));
          stats.published++;
          stats.maxPayload = Math.max(stats.maxPayload, payload.length);
          if (head & 1) {
            if (payload.length) retained.set(topic, payload);
            else retained.delete(topic);
          }
          for (const c of subs.get(topic) || []) {
            if (Math.random() < loss) {
              stats.dropped++;
              continue;
            }
            deliver(c, frame(topic, payload, false));
          }
        }
      }
    });
    ws.on("close", () => {
      for (const t of mine) subs.get(t)?.delete(ws);
    });
    ws.on("error", () => {});
  });
  return new Promise((ok) => wss.on("listening", () => ok({ port: wss.address().port, stats, close: () => wss.close() })));
}

module.exports = { startBroker };
