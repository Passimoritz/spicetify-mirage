// Leitet die öffentlichen Relays auf die lokalen Test-Relays um. Theme und Handy-Seite bleiben unverändert.
const arg = process.argv.find((a) => a.startsWith("--mirage-brokers="));
if (arg) {
  const map = JSON.parse(arg.slice("--mirage-brokers=".length));
  const Real = window.WebSocket;
  window.WebSocket = class extends Real {
    constructor(url, proto) {
      const host = Object.keys(map).find((h) => String(url).includes(h));
      super(host ? `ws://127.0.0.1:${map[host]}/mqtt` : url, proto);
    }
  };
}
