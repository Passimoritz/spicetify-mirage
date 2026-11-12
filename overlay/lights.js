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
// Listen aus den Einstellungen: „a, b; c“ → ["a", "b", "c"]
const listOf = (s, sep = /[\s,;]+/) => String(s || "").split(sep).map((x) => x.trim()).filter(Boolean);
const validIp = (s) => /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$|^[a-z0-9-]+(\.[a-z0-9-]+)*\.local$/i.test(String(s || ""));

/* ---- Verzögerung je Gerät: Lampen hängen unterschiedlich weit hinterher. Der Vorlauf (ms) sagt, wie viel
   früher ein Gerät seine Befehle bekommt; negativ = später (z. B. wenn der Ton über Bluetooth nachhinkt). */
const LAT_MAX = 1000;
const clampLat = (ms) => clamp(Math.round(Number(ms) || 0), -LAT_MAX, LAT_MAX);
const LAT_KEYS = { wled: "latWled", govee: "latGovee", ha: "latHa", orgb: "latOrgb", chroma: "latChroma" };
const NAMES = ["hue", ...Object.keys(LAT_KEYS)];
// Hue je Bridge: „192.168.1.20=120, 10.0.0.5=-40“ – wer die Bridge wechselt, behält beide Werte
const hueLatMap = (s) => new Map(listOf(s, /[,;]+/).map((x) => x.split("=")).filter(([ip, ms]) => validIp(ip) && Number.isFinite(Number(ms))).map(([ip, ms]) => [ip, clampLat(ms)]));
function latOf(c, name) {
  if (name === "hue") return hueLatMap(c.latHue).get(String(c.hueIp || "")) || 0;
  return clampLat(c[LAT_KEYS[name]]);
}
// Änderung für die Einstellungen ({ Schlüssel: Wert }) oder null, wenn es das Gerät nicht gibt
function latPatch(c, name, ms) {
  if (!Number.isFinite(ms)) return null;
  ms = clampLat(ms);
  if (name === "hue") {
    if (!validIp(c.hueIp)) return null;
    const m = hueLatMap(c.latHue);
    m.delete(c.hueIp);
    if (ms) m.set(c.hueIp, ms);
    return { latHue: [...m].slice(-8).map(([ip, v]) => `${ip}=${v}`).join(", ") };
  }
  return LAT_KEYS[name] ? { [LAT_KEYS[name]]: ms } : null;
}

// Früher senden heißt vorhersagen: Schläge kommen gleichmäßig, also sieht der Zustand in L ms so aus wie
// vor (Schlagabstand − L) ms. Die Sicht merkt sich dazu die letzten Sekunden und die Schlagzeiten. Ohne
// stabilen Takt (Songanfang, Break) gibt es keinen Vorlauf – dann gilt einfach der Zustand von jetzt.
const EMPTY = { t: 0, st: null, beat: 0, kick: 0 };
function createBeatView(maxAge = 4000) {
  let hist = [], hits = [];
  function push(e) {
    hist.push(e);
    while (hist.length > 1 && e.t - hist[0].t > maxAge) hist.shift();
  }
  function hit(t) {
    hits.push(t);
    if (hits.length > 6) hits.shift();
  }
  // Schlagabstand in ms oder 0, wenn der Takt (noch) nicht stabil ist
  function period(now) {
    if (hits.length < 4) return 0;
    const iv = hits.slice(1).map((t, i) => t - hits[i]);
    const med = [...iv].sort((a, b) => a - b)[iv.length >> 1];
    // 40–240 Schläge/min, alle Abstände nah beieinander, und der letzte Schlag ist nicht ausgeblieben
    if (med < 250 || med > 1500 || iv.some((x) => Math.abs(x - med) > med * 0.15) || now - hits.at(-1) > med * 1.6) return 0;
    return iv.reduce((a, b) => a + b, 0) / iv.length;
  }
  function at(t) {
    for (let i = hist.length - 1; i >= 0; i--) if (hist[i].t <= t) return hist[i];
    return null;
  }
  // Zustand, den ein Gerät mit diesem Vorlauf jetzt zeigen soll
  function view(offset, now) {
    const last = hist.at(-1) || EMPTY;
    if (!offset || !hist.length) return last;
    if (offset < 0) return at(now + offset) || hist[0];
    const p = period(now);
    if (!p) return last;
    const n = Math.ceil(offset / p), s = at(now + offset - n * p);
    return s ? { ...s, beat: s.beat + n } : last;
  }
  function reset() {
    hist = [];
    hits = [];
  }
  return { push, hit, period, view, reset };
}

// RGB → Hue-Farbort (CIE xy, Gamut der Hue-Lampen grob genug)
function toXy([r, g, b]) {
  const lin = (v) => ((v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = R * 0.664511 + G * 0.154324 + B * 0.162028, Y = R * 0.283881 + G * 0.668433 + B * 0.047685, Z = R * 0.000088 + G * 0.07231 + B * 0.986039;
  const s = X + Y + Z || 1;
  return [+(X / s).toFixed(4), +(Y / s).toFixed(4)];
}

// opts.wledHttpPort: nur für Tests (WLED-JSON-API auf einem anderen Port als 80)
function createLights(getCfg, log = () => {}, opts = {}) {
  let beat = 0, kick = 0, lastAt = 0, idleT = 0;
  const bv = createBeatView();
  // Einmessen (calibrate): nur ein Gerät blinkt im festen Takt, weiß, abwechselnd hell und dunkel
  let cal = null;
  const on = (name) => (cal ? cal.name === name : !!getCfg()[name + "On"]);
  // v: der Zustand, den das gerade bediente Gerät sehen soll – um seinen Vorlauf verschoben. use() setzt ihn
  // vor jedem frame()/onBeat(); dort wird er nur synchron gelesen.
  let v = EMPTY;
  const use = (name, now) => (v = bv.view(latOf(getCfg(), name), now));
  const pal = () => (cal ? [[255, 255, 255], [255, 255, 255], [255, 255, 255]] : Array.isArray(v.st?.pal) && v.st.pal.length === 3 ? v.st.pal : [[155, 107, 240], [34, 73, 231], [217, 188, 241]]);
  const bright = () => clamp((getCfg().lightBright ?? 100) / 100, 0.1, 1);
  // Obergrenze: heller als das wird keine Lampe, egal was die Musik macht (lightBright dimmt alles,
  // lightMax schneidet nur die Spitzen ab)
  const cap = () => clamp((getCfg().lightMax ?? 100) / 100, 0.05, 1);
  // Helligkeit 0..1: Grundlicht mit der Energie, Kick und Akzent obendrauf, Drop = voll
  const level = () => Math.min(cap(), cal ? (v.beat % 2 ? 0.06 : 1) : clamp(0.18 + 0.32 * (v.st?.e || 0) + 0.5 * Math.max(v.st?.k || 0, (v.st?.a || 0) * 0.8) + (v.st?.d > 0.85 ? 0.4 : 0), 0, 1) * bright());
  // Helligkeit für Lampen mit eigener Skala (Hue 1–254, Home Assistant 1–255): in der Party nie ganz dunkel,
  // beim Einmessen der volle Unterschied zwischen hell und dunkel
  const briOf = (max) => Math.max(1, Math.round(cal ? max * level() : Math.min(max * cap(), 40 + (max - 40) * level())));

  /* ---- WLED: UDP-Echtzeit (DRGB), der Streifen fällt nach 2 s ohne Daten selbst in sein Programm zurück */
  const wled = {
    sock: null, at: 0, saved: null, asked: false,
    // JSON-API des Streifens (Port 80; die Portangabe hinter der Adresse gilt nur für UDP)
    http(ip) {
      return `http://${String(ip).split(":")[0]}${opts.wledHttpPort ? ":" + opts.wledHttpPort : ""}/json/state`;
    },
    start() {
      if (!this.sock) {
        this.sock = dgram.createSocket("udp4");
        this.sock.on("error", () => this.stop());
      }
      if (!this.asked) this.capture();
    },
    // vorher-Zustand merken (an/aus, Helligkeit). Farben und Effekt kehren von selbst zurück, sobald keine
    // Echtzeitdaten mehr kommen. Ein ausgeschalteter Streifen zeigt Echtzeitdaten nicht – für die Party an.
    async capture() {
      const ip = getCfg().wledIp;
      if (!validIp(ip)) return;
      this.asked = true;
      const s = await call("GET", this.http(ip), null, 1500);
      // inzwischen schon wieder vorbei (asked zurückgesetzt): nichts mehr merken oder einschalten
      if (!this.asked || !s || typeof s.on !== "boolean") return;
      this.saved = { ip, on: s.on, bri: Number(s.bri) || 0 };
      if (!s.on) await call("POST", this.http(ip), { on: true }, 1500);
    },
    stop() {
      try { this.sock?.close(); } catch {}
      this.sock = null;
    },
    async restore() {
      const s = this.saved;
      this.saved = null;
      this.asked = false;
      this.stop();
      if (s) await call("POST", this.http(s.ip), s.bri ? { on: s.on, bri: s.bri } : { on: s.on }, 1500);
    },
    frame(now) {
      const c = getCfg();
      if (!this.sock || !validIp(c.wledIp) || now - this.at < 33) return;
      this.at = now;
      const n = clamp(Math.round(c.wledLeds || 60), 1, 490), p = pal(), lv = level(), drop = v.st?.d > 0.85;
      const buf = Buffer.alloc(2 + n * 3);
      buf[0] = 2; // DRGB
      buf[1] = 2; // nach 2 s ohne Daten zurück zum normalen WLED-Programm
      for (let i = 0; i < n; i++) {
        // die drei Songfarben laufen als Verlauf über den Streifen und wandern mit jedem Schlag weiter
        const f = ((i / n) * 3 + v.beat * 0.5) % 3, a = Math.floor(f), m = f - a;
        const c0 = p[a % 3], c1 = p[(a + 1) % 3];
        let col = [0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * m);
        if (drop) col = col.map((v) => v + (255 - v) * 0.7);
        const fall = 1 - 0.55 * Math.abs((i / n) * 2 - 1) * (1 - v.kick); // Mitte pulst stärker
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
    lights: [], next: 0, busy: false, saved: null, loading: false, retryAt: 0, gen: 0, seen: 0,
    base() {
      const c = getCfg();
      return validIp(c.hueIp) && /^[\w-]{10,64}$/.test(c.hueUser || "") ? `http://${c.hueIp}/api/${c.hueUser}` : "";
    },
    async load() {
      const b = this.base(), c = getCfg(), g = c.hueGroup || "0", gen = this.gen;
      // leerer Raum oder alles ausgenommen: nicht bei jedem Schlag neu fragen
      if (!b || this.loading || Date.now() < this.retryAt) return;
      this.loading = true;
      const grp = await call("GET", `${b}/groups/${encodeURIComponent(g)}`);
      // ausgenommen: einzelne Lampen („7“) und ganze Räume/Zonen („g3“)
      const ex = listOf(c.hueExclude), out = new Set(ex.filter((x) => /^\d+$/.test(x)));
      const rooms = ex.filter((x) => /^g\d+$/.test(x)).map((x) => x.slice(1));
      if (rooms.length) {
        const groups = await call("GET", `${b}/groups`);
        for (const r of rooms) for (const id of Array.isArray(groups?.[r]?.lights) ? groups[r].lights : []) out.add(String(id));
      }
      const lights = (Array.isArray(grp?.lights) ? grp.lights.map(String) : []).filter((id) => !out.has(id)).slice(0, 12);
      const all = await call("GET", `${b}/lights`);
      this.loading = false;
      // die Party ist inzwischen vorbei (restore lief): nichts mehr übernehmen
      if (gen !== this.gen) return;
      // vorher-Zustand merken, um ihn nach der Party wiederherzustellen – je Lampe nur einmal: wird mitten
      // in der Party neu geladen (Einstellung geändert), leuchtet sie schon in Partyfarben
      if (all && typeof all === "object") {
        this.saved ||= {};
        for (const id of lights) if (!(id in this.saved) && all[id]?.state) this.saved[id] = all[id].state;
      }
      this.lights = lights;
      this.retryAt = lights.length ? 0 : Date.now() + 5000;
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
      // beim Einmessen blinkt immer dieselbe (erste) Lampe, ohne Überblenden
      const p = pal(), id = cal ? this.lights[0] : this.lights[this.next++ % this.lights.length];
      const drop = v.st?.d > 0.85;
      this.send(`/lights/${id}/state`, { on: true, xy: toXy(drop ? [255, 255, 255] : p[this.next % 3]), bri: briOf(254), transitiontime: cal ? 0 : 1 });
    },
    async restore() {
      const b = this.base(), saved = this.saved;
      this.saved = null;
      this.lights = [];
      this.retryAt = 0;
      this.gen++;
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
          // Farben vor der Party merken (nur die Farben – einen laufenden Effekt kann das SDK nicht zurückholen)
          const saved = Array.isArray(d?.colors) && d.colors.length ? d.colors.map((x) => ({ red: x.red, green: x.green, blue: x.blue })) : null;
          this.devices.push({ id: i, leds: d?.colors?.length || d?.leds?.length || 0, name: String(d?.name || "").toLowerCase(), saved });
        }
        c.on?.("disconnect", () => this.stop(true));
        this.client = c;
      } catch {
        this.retryAt = Date.now() + 15000; // OpenRGB läuft nicht: in 15 s noch einmal
      }
      this.connecting = false;
    },
    stop(retry) {
      // normales Ende (kein Verbindungsabbruch): die gemerkten Farben zurückschreiben
      if (this.client && !retry) for (const d of this.devices) {
        try { if (d.saved) this.client.updateLeds(d.id, d.saved); } catch {}
      }
      try { this.client?.disconnect(); } catch {}
      this.client = null;
      if (retry) this.retryAt = Date.now() + 15000;
    },
    frame(now) {
      if (!this.client || now - this.at < 50) return;
      this.at = now;
      const p = pal(), lv = level(), drop = v.st?.d > 0.85;
      // ausgenommene Geräte: Teil des Namens genügt („corsair“, „ram“)
      const skip = listOf(getCfg().orgbExclude, /[,;]+/).map((x) => x.toLowerCase());
      for (const d of this.devices) {
        if (!d.leds || skip.some((x) => d.name.includes(x))) continue;
        const colors = Array.from({ length: d.leds }, (_, i) => {
          let c = p[(Math.floor(i / Math.max(1, d.leds / 3)) + v.beat) % 3];
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
      const p = pal(), drop = v.st?.d > 0.85;
      let c = p[v.beat % 3];
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
      const p = pal(), drop = v.st?.d > 0.85;
      let c = p[v.beat % 3];
      if (drop) c = c.map((v) => v + (255 - v) * 0.7);
      const lv = Math.round(level() * 10) / 10, [r, g, b] = scale(c, Math.min(cap(), Math.max(0.15, lv)));
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
      if (!saved.length) return this.stop();
      // UDP braucht einen Moment, bevor der Socket zugeht – beim Beenden der App wird darauf gewartet
      return new Promise((r) => setTimeout(() => r(this.stop()), 400));
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
    list: [], next: 0, busy: false, snap: false, loading: false, lastAt: 0, retryAt: 0, gen: 0, seen: 0,
    ok() {
      const c = getCfg();
      return haBaseOk(c.haUrl) && haTokenOk(c.haToken);
    },
    req(method, path, body, timeout = 2500) {
      const c = getCfg();
      return call(method, `${c.haUrl}${path}`, body, timeout, { authorization: `Bearer ${c.haToken}` });
    },
    async entities() {
      const c = getCfg(), out = new Set(listOf(c.haExclude));
      const want = listOf(c.haEntities).filter((x) => /^light\.[\w-]+$/.test(x));
      if (want.length) return want.filter((id) => !out.has(id)).slice(0, 24);
      const all = await this.req("GET", "/api/states");
      return Array.isArray(all) ? all.map((s) => s?.entity_id).filter((id) => /^light\.[\w-]+$/.test(id || "") && !out.has(id)).slice(0, 24) : [];
    },
    async load() {
      if (!this.ok() || this.loading || Date.now() < this.retryAt) return;
      const gen = this.gen;
      this.loading = true;
      const list = await this.entities();
      // die Party ist inzwischen vorbei (restore lief): nichts mehr übernehmen
      if (gen !== this.gen) return void (this.loading = false);
      // Schnappschuss nur einmal je Party: beim Nachladen leuchten die Lichter schon in Partyfarben
      if (list.length && !this.snap) {
        this.snap = true;
        await this.req("POST", "/api/services/scene/create", { scene_id: "mirage_before_party", snapshot_entities: list });
      }
      this.list = list;
      // nichts gefunden oder alles ausgenommen: nicht bei jedem Schlag neu fragen
      this.retryAt = list.length ? 0 : Date.now() + 5000;
      this.loading = false;
    },
    onBeat() {
      if (!this.ok()) return;
      if (!this.list.length) return void this.load();
      const now = Date.now();
      if (this.busy || now - this.lastAt < 200) return;
      this.busy = true;
      this.lastAt = now;
      const p = pal(), drop = v.st?.d > 0.85, id = cal ? this.list[0] : this.list[this.next++ % this.list.length];
      const rgb = drop ? [255, 255, 255] : p[this.next % 3];
      this.req("POST", "/api/services/light/turn_on", { entity_id: id, rgb_color: rgb, brightness: briOf(255), transition: cal ? 0 : 0.15 }, 1500).finally(() => (this.busy = false));
    },
    async restore() {
      const had = this.snap;
      this.snap = false;
      this.list = [];
      this.retryAt = 0;
      this.gen++;
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
  // Lampen, die nur auf den Schlag reagieren (Hue, Home Assistant): sobald ihre Sicht einen neuen Schlag zeigt
  function pulse(now) {
    for (const [name, dev] of [["hue", hue], ["ha", ha]]) {
      if (!on(name) || use(name, now).beat <= dev.seen) continue;
      dev.seen = v.beat;
      dev.onBeat();
    }
  }
  function tick() {
    const now = Date.now();
    pulse(now);
    for (const [name, dev] of [["govee", govee], ["wled", wled], ["orgb", orgb], ["chroma", chroma]]) {
      if (!on(name)) continue;
      use(name, now);
      dev.frame(now);
    }
  }
  // Party-Zustand vom Theme (über onParty in main.js)
  function feed(m) {
    // beim Einmessen zählt nur der feste Takt
    if (cal || !NAMES.some(on)) return;
    const k = Math.max(+m.k || 0, (+m.a || 0) * 0.8);
    const hit = k > 0.55 && kick < 0.4;
    kick = k > kick ? k : kick * 0.8 + k * 0.2;
    push(m, hit);
  }
  function push(st, hit) {
    const now = Date.now();
    lastAt = now;
    if (hit) {
      beat++;
      bv.hit(now);
    }
    bv.push({ t: now, st, beat, kick });
    if (on("govee")) govee.start();
    if (on("wled")) wled.start();
    if (on("orgb")) orgb.start();
    if (on("chroma")) chroma.start();
    // ohne Vorlauf geht der Schlag sofort raus, nicht erst mit dem nächsten Takt der Schleife
    pulse(now);
    if (!loop) loop = setInterval(tick, 16);
    clearTimeout(idleT);
    // kommt 2,5 s nichts mehr (Party vorbei): alles freigeben, Hue in den alten Zustand
    idleT = setTimeout(idle, 2500);
  }
  // läuft noch ein Wiederherstellen? Beim Beenden der App wartet main.js darauf (stopAll gibt es zurück)
  let restoring = Promise.resolve();
  const later = (...jobs) => (restoring = Promise.allSettled([restoring, ...jobs]));
  function idle() {
    clearInterval(loop);
    clearTimeout(idleT);
    loop = 0;
    lastAt = 0;
    bv.reset();
    v = EMPTY;
    if (cal) {
      clearTimeout(cal.timer);
      const done = cal.onBeat;
      cal = null;
      // null = Einmessen zu Ende (die Einstellungen setzen ihren Knopf zurück)
      done?.(null);
    }
    orgb.stop();
    chroma.stop();
    log("lights idle");
    return later(hue.restore(), wled.restore(), govee.restore(), ha.restore());
  }
  // Einstellungen geändert: Abgeschaltetes sofort freigeben
  function sync() {
    if (!on("wled")) later(wled.restore());
    if (!on("orgb")) orgb.stop();
    if (!on("chroma")) chroma.stop();
    if (!on("hue")) later(hue.restore());
    else hue.lights = [], hue.retryAt = 0;
    if (!on("govee")) later(govee.restore());
    if (!on("ha")) later(ha.restore());
    else ha.list = [], ha.retryAt = 0;
  }
  const active = () => !!lastAt && Date.now() - lastAt < 2500;

  /* ---- Verzögerung einmessen: das gewählte Gerät blinkt im festen Takt (jeder Schlag wechselt zwischen hell
     und dunkel), die Einstellungen lassen daneben einen Punkt blinken. onBeat(hell) kommt genau zum Schlag,
     onBeat(null) am Ende. Hört nach 150 Schlägen von selbst auf. */
  async function calibrate(name, onBeat, period = 600) {
    // laufende Party oder Messung beenden, Lampen erst zurück in ihren Zustand. Wird nur das Gerät
    // gewechselt, bekommt das Fenster dafür kein „zu Ende“.
    if (cal) cal.onBeat = null;
    await idle();
    if (!NAMES.includes(name)) return false;
    const mine = (cal = { name, onBeat, timer: 0, left: 150 });
    const t0 = Date.now() + 200;
    let n = 0;
    const step = () => {
      if (cal !== mine) return;
      if (--mine.left < 0) return void idle();
      kick = 1;
      push({ k: 1, a: 0, e: 0.5, d: 0 }, true);
      onBeat?.(beat % 2 === 0);
      // feste Schlagzeiten ab t0, damit sich Verspätungen des Zeitgebers nicht aufsummieren
      mine.timer = setTimeout(step, Math.max(1, t0 + ++n * period - Date.now()));
    };
    mine.timer = setTimeout(step, 200);
    return true;
  }
  const latAll = () => Object.fromEntries(NAMES.map((n) => [n, latOf(getCfg(), n)]));

  /* ---- Hue einrichten: Bridge finden, koppeln (Knopf auf der Bridge drücken), Räume holen */
  async function hueFind() {
    const list = await call("GET", "https://discovery.meethue.com/", null, 4000);
    return Array.isArray(list) ? list.map((b) => b.internalipaddress).filter(validIp).slice(0, 5) : [];
  }
  async function huePair(ip) {
    if (!validIp(ip)) return { error: "ip" };
    // generateclientkey: der zweite Schlüssel, den Hue Entertainment (hue-stream.js) für DTLS braucht. Die
    // Bridge gibt ihn nur beim Koppeln heraus – gleich mitnehmen, sonst müsste später neu gekoppelt werden.
    const r = await call("POST", `http://${ip}/api`, { devicetype: "mirage_overlay#pc", generateclientkey: true }, 4000);
    const ok = Array.isArray(r) && r[0]?.success?.username;
    if (ok) return { user: r[0].success.username, clientKey: /^[0-9a-f]{32}$/i.test(r[0].success.clientkey || "") ? r[0].success.clientkey : "" };
    return { error: Array.isArray(r) && r[0]?.error?.type === 101 ? "button" : "unreachable" };
  }
  async function hueGroups() {
    const b = hue.base();
    if (!b) return [];
    const g = await call("GET", `${b}/groups`);
    return g && typeof g === "object" && !Array.isArray(g) ? Object.entries(g).filter(([, x]) => x?.lights?.length).map(([id, x]) => ({ id, name: String(x.name || id), n: x.lights.length })) : [];
  }

  // Einstellungen: Lampen des gewählten Raums (und bei „alle“ die Räume), um einzelne auszunehmen
  async function hueLights() {
    const b = hue.base(), g = getCfg().hueGroup || "0";
    if (!b) return { lights: [], rooms: [] };
    const [grp, all, groups] = await Promise.all([call("GET", `${b}/groups/${encodeURIComponent(g)}`), call("GET", `${b}/lights`), g === "0" ? call("GET", `${b}/groups`) : null]);
    const lights = (Array.isArray(grp?.lights) ? grp.lights.map(String) : []).map((id) => ({ id, name: String(all?.[id]?.name || id) }));
    const rooms = groups && typeof groups === "object" && !Array.isArray(groups) ? Object.entries(groups).filter(([, x]) => x?.lights?.length).map(([id, x]) => ({ id, name: String(x.name || id) })) : [];
    return { lights: lights.slice(0, 60), rooms: rooms.slice(0, 30) };
  }

  return { feed, sync, active, stopAll: idle, calibrate, calibrating: () => !!cal, latAll, latPatch: (name, ms) => latPatch(getCfg(), name, ms), hueFind, huePair, hueGroups, hueLights, goveeScan: () => govee.scan(), haTest: () => ha.test() };
}

module.exports = { createLights, toXy, createBeatView, latOf, latPatch, LAT_MAX };
