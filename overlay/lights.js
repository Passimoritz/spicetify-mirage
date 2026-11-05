/* ------------------------------------------------------------------ Licht im Raum */
// Im Party-Modus spielt echtes Licht mit: Philips Hue, WLED-LED-Streifen, Govee (LAN), Home Assistant (alle
// Lichter im Haus), PC-Beleuchtung über OpenRGB und Razer Chroma. Alles läuft im eigenen Netz bzw. auf diesem Rechner; das Theme liefert ~30-mal pro Sekunde
// den Lichtzustand (Akzent, Kick, Energie, Drop, drei Songfarben). Jede Lampe bekommt nur so viel, wie sie
// verträgt: WLED 30 Bilder/s, OpenRGB und Chroma 20/s, Hue höchstens ~8 Befehle/s (die Bridge drosselt sonst).
const dgram = require("dgram");
const http = require("http");
const https = require("https");

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const scale = (c, f) => c.map((v) => Math.round(clamp(v * f, 0, 255)));

// kleiner JSON-Aufruf über http/https (Hue-Bridge, Razer Chroma, Hue-Suche)
function call(method, url, body, timeout = 2500, headers = {}) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      return resolve(null);
    }
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = (u.protocol === "https:" ? https : http).request(
      u,
      { method, timeout, headers: { "content-type": "application/json", ...headers, ...(data ? { "content-length": data.length } : {}) } },
      (res) => {
        let s = "";
        res.on("data", (c) => (s += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(s || "null"));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    if (data) req.write(data);
    req.end();
  });
}
// Home Assistant: Adresse wie http://homeassistant.local:8123 (ohne Pfad), Token = „langlebiges Zugriffstoken“
const haBaseOk = (s) => /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(String(s || ""));
const haTokenOk = (s) => /^[\w.-]{20,600}$/.test(String(s || ""));
const validIp = (s) => /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$|^[a-z0-9-]+(\.[a-z0-9-]+)*\.local$/i.test(String(s || ""));

// RGB → Hue-Farbort (CIE xy, Gamut der Hue-Lampen grob genug)
function toXy([r, g, b]) {
  const lin = (v) => ((v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = R * 0.664511 + G * 0.154324 + B * 0.162028, Y = R * 0.283881 + G * 0.668433 + B * 0.047685, Z = R * 0.000088 + G * 0.07231 + B * 0.986039;
  const s = X + Y + Z || 1;
  return [+(X / s).toFixed(4), +(Y / s).toFixed(4)];
}

function createLights(getCfg, log = () => {}) {
  let st = null, beat = 0, kick = 0, lastAt = 0, idleT = 0;
  const pal = () => (Array.isArray(st?.pal) && st.pal.length === 3 ? st.pal : [[155, 107, 240], [34, 73, 231], [217, 188, 241]]);
  const bright = () => clamp((getCfg().lightBright ?? 100) / 100, 0.1, 1);
  // Helligkeit 0..1: Grundlicht mit der Energie, Kick und Akzent obendrauf, Drop = voll
  const level = () => clamp(0.18 + 0.32 * (st?.e || 0) + 0.5 * Math.max(st?.k || 0, (st?.a || 0) * 0.8) + (st?.d > 0.85 ? 0.4 : 0), 0, 1) * bright();

  /* ---- WLED: UDP-Echtzeit (DRGB), der Streifen fällt nach 2 s ohne Daten selbst in sein Programm zurück */
  const wled = {
    sock: null, at: 0,
    start() {
      if (this.sock) return;
      this.sock = dgram.createSocket("udp4");
      this.sock.on("error", () => this.stop());
    },
    stop() {
      try { this.sock?.close(); } catch {}
      this.sock = null;
    },
    frame(now) {
      const c = getCfg();
      if (!this.sock || !validIp(c.wledIp) || now - this.at < 33) return;
      this.at = now;
      const n = clamp(Math.round(c.wledLeds || 60), 1, 490), p = pal(), lv = level(), drop = st?.d > 0.85;
      const buf = Buffer.alloc(2 + n * 3);
      buf[0] = 2; // DRGB
      buf[1] = 2; // nach 2 s ohne Daten zurück zum normalen WLED-Programm
      for (let i = 0; i < n; i++) {
        // die drei Songfarben laufen als Verlauf über den Streifen und wandern mit jedem Schlag weiter
        const f = ((i / n) * 3 + beat * 0.5) % 3, a = Math.floor(f), m = f - a;
        const c0 = p[a % 3], c1 = p[(a + 1) % 3];
        let col = [0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * m);
        if (drop) col = col.map((v) => v + (255 - v) * 0.7);
        const fall = 1 - 0.55 * Math.abs((i / n) * 2 - 1) * (1 - kick); // Mitte pulst stärker
        const out = scale(col, lv * fall);
        buf[2 + i * 3] = out[0];
        buf[3 + i * 3] = out[1];
        buf[4 + i * 3] = out[2];
      }
      const [host, port] = String(c.wledIp).split(":");
      this.sock.send(buf, Number(port) || 21324, host);
    },
  };

  /* ---- Philips Hue (Bridge, REST v1): auf jedem Schlag wechselt reihum eine Lampe die Farbe */
  const hue = {
    lights: [], next: 0, busy: false, saved: null, groupAt: 0, loading: false,
    base() {
      const c = getCfg();
      return validIp(c.hueIp) && /^[\w-]{10,64}$/.test(c.hueUser || "") ? `http://${c.hueIp}/api/${c.hueUser}` : "";
    },
    async load() {
      const b = this.base(), g = getCfg().hueGroup || "0";
      if (!b || this.loading) return;
      this.loading = true;
      const grp = await call("GET", `${b}/groups/${encodeURIComponent(g)}`);
      this.lights = Array.isArray(grp?.lights) ? grp.lights.slice(0, 12) : [];
      // vorher-Zustand merken, um ihn nach der Party wiederherzustellen
      const all = await call("GET", `${b}/lights`);
      this.saved = all && typeof all === "object" ? Object.fromEntries(this.lights.map((id) => [id, all[id]?.state]).filter(([, s]) => s)) : null;
      this.loading = false;
    },
    async send(path, body) {
      const b = this.base();
      if (!b || this.busy) return;
      this.busy = true;
      await call("PUT", `${b}${path}`, body, 1500);
      // Abstand zwischen Befehlen: die Bridge schafft etwa 10 pro Sekunde
      setTimeout(() => (this.busy = false), 120);
    },
    onBeat() {
      if (!this.lights.length) return void this.load();
      const p = pal(), id = this.lights[this.next++ % this.lights.length];
      const drop = st?.d > 0.85;
      this.send(`/lights/${id}/state`, { on: true, xy: toXy(drop ? [255, 255, 255] : p[this.next % 3]), bri: Math.round(40 + 214 * level()), transitiontime: 1 });
    },
    async restore() {
      const b = this.base(), saved = this.saved;
      this.saved = null;
      this.lights = [];
      if (!b || !saved) return;
      for (const [id, s] of Object.entries(saved)) {
        const body = { on: !!s.on, bri: s.bri, transitiontime: 10 };
        if (Array.isArray(s.xy)) body.xy = s.xy;
        else if (s.ct) body.ct = s.ct;
        await call("PUT", `${b}/lights/${id}/state`, body, 1500);
      }
    },
  };

  /* ---- OpenRGB (SDK-Server, Standard 127.0.0.1:6742): Tastatur, Maus, RAM, Lüfter … */
  const orgb = {
    client: null, devices: [], at: 0, retryAt: 0, connecting: false,
    async start() {
      if (this.client || this.connecting || Date.now() < this.retryAt) return;
      this.connecting = true;
      try {
        const { Client } = require("openrgb-sdk");
        const c = new Client("Mirage", 6742, "127.0.0.1");
        await c.connect();
        const n = await c.getControllerCount();
        this.devices = [];
        for (let i = 0; i < Math.min(n, 16); i++) {
          const d = await c.getControllerData(i);
          this.devices.push({ id: i, leds: d?.colors?.length || d?.leds?.length || 0 });
        }
        c.on?.("disconnect", () => this.stop(true));
        this.client = c;
      } catch {
        this.retryAt = Date.now() + 15000; // OpenRGB läuft nicht: in 15 s noch einmal
      }
      this.connecting = false;
    },
    stop(retry) {
      try { this.client?.disconnect(); } catch {}
      this.client = null;
      if (retry) this.retryAt = Date.now() + 15000;
    },
    frame(now) {
      if (!this.client || now - this.at < 50) return;
      this.at = now;
      const p = pal(), lv = level(), drop = st?.d > 0.85;
      for (const d of this.devices) {
        if (!d.leds) continue;
        const colors = Array.from({ length: d.leds }, (_, i) => {
          let c = p[(Math.floor(i / Math.max(1, d.leds / 3)) + beat) % 3];
          if (drop) c = c.map((v) => v + (255 - v) * 0.7);
          const o = scale(c, lv);
          return { red: o[0], green: o[1], blue: o[2] };
        });
        try { this.client.updateLeds(d.id, colors); } catch { return this.stop(true); }
      }
    },
  };

  /* ---- Razer Chroma (Synapse 3, Chroma SDK REST auf diesem Rechner) */
  const chroma = {
    uri: "", hb: 0, at: 0, last: -1, starting: false, retryAt: 0,
    async start() {
      if (this.uri || this.starting || Date.now() < this.retryAt) return;
      this.starting = true;
      const r = await call("POST", "http://127.0.0.1:54235/razer/chromasdk", {
        title: "Mirage", description: "Party light from the Mirage Spotify theme",
        author: { name: "Mirage", contact: "https://github.com/Passimoritz/spicetify-mirage" },
        device_supported: ["keyboard", "mouse", "headset", "mousepad", "keypad", "chromalink"], category: "application",
      });
      if (r?.uri && /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(r.uri)) {
        this.uri = r.uri;
        // ohne Herzschlag beendet Synapse die Sitzung nach 15 s
        this.hb = setInterval(() => call("PUT", `${this.uri}/heartbeat`, {}), 1000);
      } else this.retryAt = Date.now() + 15000;
      this.starting = false;
    },
    stop() {
      clearInterval(this.hb);
      if (this.uri) call("DELETE", this.uri);
      this.uri = "";
      this.last = -1;
    },
    frame(now) {
      if (!this.uri || now - this.at < 50) return;
      this.at = now;
      const p = pal(), drop = st?.d > 0.85;
      let c = p[beat % 3];
      if (drop) c = [255, 255, 255];
      // nur senden, wenn sich Farbe oder Helligkeit (in 12 Stufen) sichtbar ändert – Synapse mag keine Flut
      const [r, g, b] = scale(c, Math.round(level() * 12) / 12);
      const color = (b << 16) | (g << 8) | r; // Chroma will BGR
      if (color === this.last) return;
      this.last = color;
      for (const dev of ["keyboard", "mouse", "headset", "mousepad", "keypad", "chromalink"]) call("PUT", `${this.uri}/${dev}`, { effect: "CHROMA_STATIC", param: { color } }, 400);
    },
  };

  /* ---- Govee (LAN-API, in der Govee-App je Gerät „LAN-Steuerung“ einschalten): UDP an Port 4003,
     Antworten kommen auf 4002. Höchstens ~10 Befehle/s und nur, wenn sich die Farbe sichtbar ändert. */
  const govee = {
    sock: null, at: 0, last: "", saved: new Map(), found: new Map(), listening: false,
    ips() {
      return String(getCfg().goveeIps || "").split(/[\s,;]+/).filter((x) => /^(\d{1,3}\.){3}\d{1,3}$/.test(x)).slice(0, 16);
    },
    open() {
      if (this.sock) return this.sock;
      const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
      s.on("error", () => this.stop());
      s.on("message", (buf, rinfo) => {
        let m;
        try {
          m = JSON.parse(String(buf))?.msg;
        } catch {
          return;
        }
        if (m?.cmd === "scan" && m.data?.ip) this.found.set(String(m.data.ip), String(m.data.sku || m.data.device || "Govee"));
        // Zustand vor der Party, um ihn danach wiederherzustellen
        if (m?.cmd === "devStatus" && m.data && !this.saved.has(rinfo.address)) this.saved.set(rinfo.address, m.data);
      });
      try {
        s.bind(4002, () => {
          this.listening = true;
          try { s.addMembership("239.255.255.250"); } catch {}
        });
      } catch {}
      this.sock = s;
      return s;
    },
    send(ip, cmd, data) {
      try { this.open().send(Buffer.from(JSON.stringify({ msg: { cmd, data } })), 4003, ip); } catch {}
    },
    start() {
      if (this.sock && this.started) return;
      this.open();
      this.started = true;
      for (const ip of this.ips()) {
        this.send(ip, "devStatus", {});
        this.send(ip, "turn", { value: 1 });
      }
    },
    stop() {
      try { this.sock?.close(); } catch {}
      this.sock = null;
      this.started = false;
      this.listening = false;
      this.last = "";
    },
    frame(now) {
      if (!this.sock || now - this.at < 100) return;
      const p = pal(), drop = st?.d > 0.85;
      let c = p[beat % 3];
      if (drop) c = c.map((v) => v + (255 - v) * 0.7);
      const lv = Math.round(level() * 10) / 10, [r, g, b] = scale(c, Math.max(0.15, lv));
      const key = `${r >> 3},${g >> 3},${b >> 3}`;
      if (key === this.last) return;
      this.last = key;
      this.at = now;
      for (const ip of this.ips()) this.send(ip, "colorwc", { color: { r, g, b }, colorTemInKelvin: 0 });
    },
    restore() {
      const saved = [...this.saved];
      this.saved.clear();
      for (const [ip, s] of saved) {
        if (s.color && typeof s.color === "object") this.send(ip, "colorwc", { color: s.color, colorTemInKelvin: s.colorTemInKelvin || 0 });
        if (s.brightness) this.send(ip, "brightness", { value: s.brightness });
        if (s.onOff === 0) this.send(ip, "turn", { value: 0 });
      }
      setTimeout(() => this.stop(), 400);
    },
    // Geräte im Netz finden: Rundruf, 2 s auf Antworten warten
    async scan() {
      this.found.clear();
      this.open();
      for (let i = 0; i < 20 && !this.listening; i++) await new Promise((r) => setTimeout(r, 50));
      if (!this.listening) return { error: "port" };
      const msg = Buffer.from(JSON.stringify({ msg: { cmd: "scan", data: { account_topic: "reserve" } } }));
      for (let i = 0; i < 2; i++) {
        try { this.sock.send(msg, 4001, "239.255.255.250"); } catch {}
        await new Promise((r) => setTimeout(r, 1000));
      }
      const list = [...this.found].map(([ip, sku]) => ({ ip, sku }));
      if (!this.started) this.stop();
      return { list };
    },
  };

  /* ---- Home Assistant (REST): alle Lichter im Haus, die HA kennt – auch Zigbee, Matter, MQTT-Lampen.
     Vor der Party merkt sich HA den Zustand als Szene, danach wird sie wiederhergestellt. Auf jedem Schlag
     wechselt reihum ein Licht die Farbe (höchstens ~5 Befehle/s, Funklampen vertragen nicht mehr). */
  const ha = {
    list: [], next: 0, busy: false, snap: false, loading: false, lastAt: 0,
    ok() {
      const c = getCfg();
      return haBaseOk(c.haUrl) && haTokenOk(c.haToken);
    },
    req(method, path, body, timeout = 2500) {
      const c = getCfg();
      return call(method, `${c.haUrl}${path}`, body, timeout, { authorization: `Bearer ${c.haToken}` });
    },
    async entities() {
      const want = String(getCfg().haEntities || "").split(/[\s,;]+/).filter((x) => /^light\.[\w-]+$/.test(x));
      if (want.length) return want.slice(0, 24);
      const all = await this.req("GET", "/api/states");
      return Array.isArray(all) ? all.map((s) => s?.entity_id).filter((id) => /^light\.[\w-]+$/.test(id || "")).slice(0, 24) : [];
    },
    async load() {
      if (!this.ok() || this.loading) return;
      this.loading = true;
      this.list = await this.entities();
      if (this.list.length && !this.snap) {
        await this.req("POST", "/api/services/scene/create", { scene_id: "mirage_before_party", snapshot_entities: this.list });
        this.snap = true;
      }
      this.loading = false;
    },
    onBeat() {
      if (!this.ok()) return;
      if (!this.list.length) return void this.load();
      const now = Date.now();
      if (this.busy || now - this.lastAt < 200) return;
      this.busy = true;
      this.lastAt = now;
      const p = pal(), drop = st?.d > 0.85, id = this.list[this.next++ % this.list.length];
      const rgb = drop ? [255, 255, 255] : p[this.next % 3];
      this.req("POST", "/api/services/light/turn_on", { entity_id: id, rgb_color: rgb, brightness: Math.round(40 + 215 * level()), transition: 0.15 }, 1500).finally(() => (this.busy = false));
    },
    async restore() {
      const had = this.snap;
      this.snap = false;
      this.list = [];
      if (had && this.ok()) await this.req("POST", "/api/services/scene/turn_on", { entity_id: "scene.mirage_before_party", transition: 1 });
    },
    // Einstellungen: Verbindung prüfen und die Lichter auflisten
    async test() {
      if (!haBaseOk(getCfg().haUrl)) return { error: "url" };
      if (!haTokenOk(getCfg().haToken)) return { error: "token" };
      const r = await this.req("GET", "/api/", null, 4000);
      if (!r?.message) return { error: "unreachable" };
      const all = await this.req("GET", "/api/states", null, 6000);
      const lights = Array.isArray(all) ? all.filter((s) => /^light\.[\w-]+$/.test(s?.entity_id || "")).map((s) => ({ id: s.entity_id, name: String(s.attributes?.friendly_name || s.entity_id) })) : [];
      return { lights: lights.slice(0, 60) };
    },
  };

  let loop = 0;
  function tick() {
    const c = getCfg(), now = Date.now();
    if (c.goveeOn) govee.frame(now);
    if (c.wledOn) wled.frame(now);
    if (c.orgbOn) orgb.frame(now);
    if (c.chromaOn) chroma.frame(now);
  }
  // Party-Zustand vom Theme (über onParty in main.js)
  function feed(m) {
    const c = getCfg();
    if (!(c.hueOn || c.wledOn || c.orgbOn || c.chromaOn || c.goveeOn || c.haOn)) return;
    const k = Math.max(+m.k || 0, (+m.a || 0) * 0.8);
    const hit = k > 0.55 && kick < 0.4;
    kick = k > kick ? k : kick * 0.8 + k * 0.2;
    st = m;
    lastAt = Date.now();
    if (hit) {
      beat++;
      if (c.hueOn) hue.onBeat();
      if (c.haOn) ha.onBeat();
    }
    if (c.goveeOn) govee.start();
    if (c.wledOn) wled.start();
    if (c.orgbOn) orgb.start();
    if (c.chromaOn) chroma.start();
    if (!loop) loop = setInterval(tick, 16);
    clearTimeout(idleT);
    // kommt 2,5 s nichts mehr (Party vorbei): alles freigeben, Hue in den alten Zustand
    idleT = setTimeout(idle, 2500);
  }
  function idle() {
    clearInterval(loop);
    loop = 0;
    st = null;
    wled.stop();
    orgb.stop();
    chroma.stop();
    hue.restore();
    govee.restore();
    ha.restore();
    log("lights idle");
  }
  // Einstellungen geändert: Abgeschaltetes sofort freigeben
  function sync() {
    const c = getCfg();
    if (!c.wledOn) wled.stop();
    if (!c.orgbOn) orgb.stop();
    if (!c.chromaOn) chroma.stop();
    if (!c.hueOn) hue.restore();
    else hue.lights = [];
    if (!c.goveeOn) govee.restore();
    if (!c.haOn) ha.restore();
    else ha.list = [];
  }
  const active = () => !!lastAt && Date.now() - lastAt < 2500;

  /* ---- Hue einrichten: Bridge finden, koppeln (Knopf auf der Bridge drücken), Räume holen */
  async function hueFind() {
    const list = await call("GET", "https://discovery.meethue.com/", null, 4000);
    return Array.isArray(list) ? list.map((b) => b.internalipaddress).filter(validIp).slice(0, 5) : [];
  }
  async function huePair(ip) {
    if (!validIp(ip)) return { error: "ip" };
    const r = await call("POST", `http://${ip}/api`, { devicetype: "mirage_overlay#pc" }, 4000);
    const ok = Array.isArray(r) && r[0]?.success?.username;
    if (ok) return { user: r[0].success.username };
    return { error: Array.isArray(r) && r[0]?.error?.type === 101 ? "button" : "unreachable" };
  }
  async function hueGroups() {
    const b = hue.base();
    if (!b) return [];
    const g = await call("GET", `${b}/groups`);
    return g && typeof g === "object" && !Array.isArray(g) ? Object.entries(g).filter(([, x]) => x?.lights?.length).map(([id, x]) => ({ id, name: String(x.name || id), n: x.lights.length })) : [];
  }

  return { feed, sync, active, stopAll: idle, hueFind, huePair, hueGroups, goveeScan: () => govee.scan(), haTest: () => ha.test() };
}

module.exports = { createLights, toXy };
