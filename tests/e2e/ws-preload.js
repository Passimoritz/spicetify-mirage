// Leitet die öffentlichen Relays auf die lokalen Test-Relays um. Theme und Handy-Seite bleiben unverändert.
const arg = process.argv.find((a) => a.startsWith("--mirage-brokers="));
if (arg) {
  const map = JSON.parse(arg.slice("--mirage-brokers=".length));
  const Real = window.WebSocket;
  // Funkloch für die Tests: alle Verbindungen kappen, neue scheitern, bis die Zeit um ist
  const open = new Set();
  let cutUntil = 0;
  window.__e2eNet = {
    cut(ms) {
      cutUntil = Date.now() + ms;
      for (const ws of open) ws.close();
    },
  };
  window.WebSocket = class extends Real {
    constructor(url, proto) {
      const host = Object.keys(map).find((h) => String(url).includes(h));
      super(Date.now() < cutUntil ? "ws://127.0.0.1:1/" : host ? `ws://127.0.0.1:${map[host]}/mqtt` : url, proto);
      open.add(this);
      this.addEventListener("close", () => open.delete(this));
    }
  };
}
