/* ------------------------------------------------------------------ Yeelight (LAN-Steuerung) */
// Lampen von Yeelight/Xiaomi im eigenen Netz. In der Yeelight-App muss je Lampe „LAN-Steuerung“ an sein.
// Suche: SSDP-artiger Rundruf an 239.255.255.250:1982 („ST: wifi_bulb“). Befehle: JSON-Zeilen über TCP 55443.
// Auf dieser Verbindung nimmt die Lampe höchstens 60 Befehle pro Minute an – zu wenig für Musik. Deshalb bittet
// die App um den „Musikmodus“ (set_music): die Lampe verbindet sich zurück zu einem kleinen TCP-Server hier,
// und darüber gehen bis zu 10 Farben pro Sekunde (nur bei sichtbarer Änderung). Klappt das nicht, bleibt es
// bei höchstens einem Befehl pro Sekunde. Bricht eine Verbindung ab, wird nach 10 s neu verbunden.
// opts.yeelightSsdp, opts.lampRetryMs nur für Tests.
const net = require("net");
const dgram = require("dgram");
const { clamp, scale, lanAddr, lanList, createGate, sig, oneColor, sleep } = require("./lamp-kit.js");

const PORT = 55443;
// Steuerverbindung: unter 60 Befehlen pro Minute bleiben; Musikmodus: 10 pro Sekunde
const CTRL_GAP = 1100, MUSIC_GAP = 100, QUOTA = 50;

// Antwort auf die Suche (oder NOTIFY der Lampe) → { ip, port, id, model, name, support } oder null
function parseSsdp(text) {
  const h = {};
  for (const line of String(text).split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  const m = String(h.location || "").match(/^yeelight:\/\/([\d.]+):(\d+)/i);
  const a = m && lanAddr(`${m[1]}:${m[2]}`);
  if (!a) return null;
  return { ip: a.port === PORT ? a.host : a.key, id: String(h.id || ""), model: String(h.model || "").slice(0, 30), name: String(h.name || "").slice(0, 60), support: String(h.support || "").split(/\s+/).filter(Boolean) };
}
const line = (id, method, params) => JSON.stringify({ id, method, params }) + "\r\n";
const rgbInt = ([r, g, b]) => (r << 16) | (g << 8) | b;
// get_prop: Reihenfolge der Antwort wie hier
const PROPS = ["power", "bright", "rgb", "ct", "color_mode", "hue", "sat"];
function parseProps(result) {
  if (!Array.isArray(result) || result.length < PROPS.length) return null;
  const n = (i, d) => (Number.isFinite(Number(result[i])) && result[i] !== "" ? Number(result[i]) : d);
  return { on: result[0] === "on", bright: clamp(n(1, 100), 1, 100), rgb: n(2, 0xffffff) & 0xffffff, ct: clamp(n(3, 4000), 1700, 6500), mode: n(4, 2), hue: n(5, 0), sat: n(6, 0) };
}

// eigene Adresse in Richtung der Lampe (dorthin verbindet sie sich im Musikmodus). UDP-connect schickt nichts.
function localFor(host, port) {
  return new Promise((resolve) => {
    const s = dgram.createSocket("udp4");
    const done = (a) => {
      try { s.close(); } catch {}
      resolve(a);
    };
    s.on("error", () => done(null));
    try {
      s.connect(port, host, (err) => {
        let a = null;
        try { a = err ? null : s.address().address; } catch {}
        done(a);
      });
    } catch {
      done(null);
    }
  });
}

function createYeelight({ getCfg, log = () => {}, opts = {} }) {
  const bulbs = new Map(); // "ip:port" → Lampe
  const gate = createGate(MUSIC_GAP);
  let server = null, serverAddr = "", serverPort = 0, nextId = 1;
  const RETRY = opts.lampRetryMs || 10000;
  const ips = () => lanList(getCfg().yeelightIps, PORT);

  // Befehl über die Steuerverbindung; Antwort (result) oder null. Zählt gegen das Minuten-Kontingent.
  function ask(b, method, params, timeout = 1500) {
    const now = Date.now();
    b.sent = b.sent.filter((t) => now - t < 60000);
    if (!b.ctrl || b.sent.length >= QUOTA) return Promise.resolve(null);
    b.sent.push(now);
    const id = nextId++ & 0x7fffffff;
    return new Promise((resolve) => {
      const t = setTimeout(() => (b.wait.delete(id), resolve(null)), timeout);
      b.wait.set(id, (m) => (clearTimeout(t), resolve(m.error ? null : m.result ?? null)));
      try { b.ctrl.write(line(id, method, params)); } catch { b.wait.delete(id); clearTimeout(t); resolve(null); }
    });
  }
  // Partybefehl: im Musikmodus ohne Antwort und ohne Kontingent, sonst über die Steuerverbindung
  function cmd(b, method, params) {
    if (b.music) {
      try { b.music.write(line(nextId++ & 0x7fffffff, method, params)); } catch {}
      return;
    }
    ask(b, method, params);
  }

  // TCP-Server für den Musikmodus, auf der eigenen Adresse im Heimnetz; nimmt nur Lampen an, die gerade
  // darum gebeten wurden
  async function listen(addr) {
    if (server && serverAddr === addr) return serverPort;
    stopServer();
    const srv = net.createServer((sock) => {
      const from = String(sock.remoteAddress || "").replace(/^::ffff:/, "");
      const b = [...bulbs.values()].find((x) => x.host === from && x.musicWait);
      if (!b) return sock.destroy();
      clearTimeout(b.musicWait);
      b.musicWait = 0;
      b.music = sock;
      sock.setNoDelay(true);
      sock.on("data", () => {}); // die Lampe sagt im Musikmodus nichts; falls doch: ignorieren
      sock.on("error", () => {});
      sock.on("close", () => {
        if (b.music !== sock) return;
        b.music = null;
        b.musicAt = Date.now() + RETRY; // in 10 s noch einmal um den Musikmodus bitten
        log(`yeelight: ${b.key} music mode closed`);
      });
      log(`yeelight: ${b.key} music mode`);
    });
    const ok = await new Promise((r) => {
      srv.once("error", () => r(false));
      srv.listen(0, addr, () => r(true));
    });
    if (!ok) return 0;
    srv.on("error", () => {});
    server = srv;
    serverAddr = addr;
    serverPort = srv.address().port;
    return serverPort;
  }
  function stopServer() {
    try { server?.close(); } catch {}
    server = null;
    serverAddr = "";
    serverPort = 0;
  }

  async function music(b) {
    b.musicAt = Date.now() + RETRY;
    const addr = await localFor(b.host, b.port);
    const port = addr && lanAddr(addr) ? await listen(addr) : 0;
    if (!port || !b.ctrl) return;
    // die Lampe verbindet sich binnen ~1 s; kommt sie nicht, bleibt es bei der Steuerverbindung
    b.musicWait = setTimeout(() => (b.musicWait = 0), 3000);
    const r = await ask(b, "set_music", [1, addr, port]);
    if (!r) {
      clearTimeout(b.musicWait);
      b.musicWait = 0;
    }
  }

  function connect(b) {
    b.state = "connecting";
    const gen = ++b.gen, sock = net.connect({ host: b.host, port: b.port });
    let buf = "";
    sock.setTimeout(2500);
    sock.on("timeout", () => sock.destroy());
    sock.on("error", () => {});
    sock.on("close", () => {
      if (gen !== b.gen) return;
      for (const f of b.wait.values()) f({ error: "closed" });
      b.wait.clear();
      try { b.music?.destroy(); } catch {}
      Object.assign(b, { ctrl: null, music: null, state: "off", retryAt: Date.now() + RETRY });
      log(`yeelight: ${b.key} offline, retry in 10 s`);
    });
    sock.on("data", (c) => {
      buf += c;
      if (buf.length > 64 * 1024) return sock.destroy();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const s = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        let m;
        try { m = JSON.parse(s); } catch { continue; }
        if (m && b.wait.has(m.id)) {
          const f = b.wait.get(m.id);
          b.wait.delete(m.id);
          f(m);
        }
      }
    });
    sock.on("connect", async () => {
      sock.setTimeout(0);
      b.ctrl = sock;
      // vorher-Zustand nur einmal je Party (nach einem Abbruch leuchtet sie schon in Partyfarben)
      if (!b.saved) {
        const p = parseProps(await ask(b, "get_prop", PROPS));
        if (gen !== b.gen) return;
        if (!p) return void sock.destroy();
        b.saved = p;
      }
      if (!b.saved.on) await ask(b, "set_power", ["on", "sudden", 0]);
      if (gen !== b.gen) return;
      b.state = "ready";
      log(`yeelight: ${b.key} ready`);
      music(b);
    });
  }

  function start() {
    const now = Date.now();
    for (const a of ips()) {
      let b = bulbs.get(a.key);
      if (!b) bulbs.set(a.key, (b = { ...a, state: "off", ctrl: null, music: null, musicWait: 0, musicAt: 0, saved: null, wait: new Map(), sent: [], gen: 0, retryAt: 0 }));
      if (b.state === "off" && now >= b.retryAt) connect(b);
    }
  }

  function frame(now, look) {
    for (const b of bulbs.values()) {
      if (b.state === "off" && now >= b.retryAt) {
        connect(b);
        continue;
      }
      if (b.state !== "ready") continue;
      if (!b.music && !b.musicWait && now >= b.musicAt) music(b);
      // Farbe in voller Sättigung, die Helligkeit als eigener Wert 1–100 (set_scene setzt beides zugleich)
      const rgb = scale(oneColor(look), 1), bri = Math.round(clamp(look.lv * 100, 1, 100));
      // ohne Musikmodus höchstens ein Befehl pro Sekunde (Kontingent der Lampe)
      if (!b.music && now - (b.ctrlAt || 0) < CTRL_GAP) continue;
      if (!gate.ok(b.key, now, sig(rgb, `/${bri >> 2}`))) continue;
      b.ctrlAt = now;
      cmd(b, "set_scene", ["color", rgbInt(rgb) || 1, bri]);
    }
  }

  // Party vorbei: Musikmodus beenden, Farbe/Weiß, Helligkeit und an/aus zurück, dann Verbindungen zu
  async function restore(only) {
    const list = [...bulbs.values()].filter((b) => !only || only(b));
    for (const b of list) bulbs.delete(b.key);
    gate.forget();
    await Promise.all(list.map(async (b) => {
      const s = b.saved, wasMusic = !!b.music;
      try { b.music?.destroy(); } catch {}
      b.music = null;
      clearTimeout(b.musicWait);
      if (b.ctrl && b.state === "ready") {
        if (wasMusic) await ask(b, "set_music", [0]);
        if (s) {
          if (s.mode === 2) await ask(b, "set_ct_abx", [s.ct, "smooth", 500]);
          else if (s.mode === 3) await ask(b, "set_hsv", [s.hue, s.sat, "smooth", 500]);
          else await ask(b, "set_rgb", [s.rgb || 0xffffff, "smooth", 500]);
          await ask(b, "set_bright", [s.bright, "smooth", 500]);
          if (!s.on) await ask(b, "set_power", ["off", "smooth", 500]);
        }
      }
      b.gen++;
      try { b.ctrl?.destroy(); } catch {}
      b.ctrl = null;
    }));
    if (!bulbs.size) stopServer();
  }
  function sync() {
    const keep = new Set(ips().map((a) => a.key));
    return restore((b) => !keep.has(b.key));
  }

  // Lampen im Netz finden: Suche an die Multicast-Adresse (zweimal), ms lang auf Antworten warten
  async function scan(ms = 2000) {
    const found = new Map();
    const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
    s.on("error", () => {});
    s.on("message", (buf) => {
      const d = parseSsdp(String(buf));
      if (d && !found.has(d.ip)) found.set(d.ip, { ip: d.ip, name: d.name || d.model || "Yeelight" });
    });
    try {
      await new Promise((r, j) => {
        s.once("error", j);
        s.bind(0, r);
      });
    } catch {
      return { error: "port" };
    }
    const to = opts.yeelightSsdp || { host: "239.255.255.250", port: 1982 };
    const msg = Buffer.from(`M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1982\r\nMAN: "ssdp:discover"\r\nST: wifi_bulb\r\n`);
    for (let i = 0; i < 2; i++) {
      try { s.send(msg, to.port, to.host); } catch {}
      await sleep(ms / 2);
    }
    try { s.close(); } catch {}
    return { list: [...found.values()].slice(0, 16) };
  }

  return { start, frame, restore: () => restore(), sync, scan, ips, ready: () => ips().length > 0 };
}

module.exports = { createYeelight, parseSsdp, parseProps, PROPS, line };
