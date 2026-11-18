/* ------------------------------------------------------------------ Werkzeug für die Lampen-Treiber */
// Gemeinsam für Nanoleaf, LIFX und Yeelight: nur Adressen im eigenen Netz, kleine HTTP-Aufrufe mit Statuscode,
// Farben aus den drei Songfarben. Ohne Electron-Abhängigkeit, damit es sich mit nachgebauten Geräten testen lässt.
const http = require("http");

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const scale = (c, f) => c.map((v) => Math.round(clamp(v * f, 0, 255)));
// Farbe an Stelle f im Kreis der drei Songfarben (1,5 = mitten zwischen der zweiten und dritten)
function mixPal(p, f) {
  f = ((f % 3) + 3) % 3;
  const a = Math.floor(f), m = f - a, c0 = p[a % 3], c1 = p[(a + 1) % 3];
  return [0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * m);
}
// „Keine Blitze“: die Farben wandern langsam weiter (eine Songfarbe je 4 s) statt auf jedem Schlag zu springen
const drift = (now) => now / 4000;
// beim Drop Richtung Weiß (mit „Keine Blitze“ kommt kein Drop an, siehe flashcap.js)
const whiten = (c) => c.map((x) => x + (255 - x) * 0.7);

/* ---- Nur das eigene Netz: private IPv4-Adressen (RFC 1918), link-local (169.254/16) und dieser Rechner
   (127/8). Keine Namen – ein Name könnte auf eine Adresse im Internet zeigen. „ip:port“ ist erlaubt. */
function lanAddr(s, port = 0) {
  const m = String(s ?? "").trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::(\d{1,5}))?$/);
  if (!m) return null;
  const o = m.slice(1, 5).map(Number);
  if (o.some((x) => x > 255)) return null;
  const [a, b] = o;
  const priv = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 127;
  if (!priv) return null;
  const p = m[5] ? Number(m[5]) : port;
  if (m[5] && (p < 1 || p > 65535)) return null;
  const host = o.join(".");
  return { host, port: p, key: `${host}:${p}` };
}
// Liste aus den Einstellungen („a, b; c“) → nur gültige Adressen im eigenen Netz, ohne doppelte
function lanList(s, port, max = 16) {
  const out = new Map();
  for (const x of String(s || "").split(/[\s,;]+/)) {
    const a = lanAddr(x, port);
    if (a && !out.has(a.key)) out.set(a.key, a);
  }
  return [...out.values()].slice(0, max);
}

/* ---- Drossel je Gerät: höchstens ein Befehl je gap ms und nur, wenn sich sichtbar etwas ändert. keep: nach so
   vielen ms auch ohne Änderung wieder senden (Geräte, die ohne Daten in ihr Programm zurückfallen). */
function createGate(gap, keep = 0) {
  const at = new Map(), last = new Map();
  return {
    // darf jetzt gesendet werden? key = Gerät, sig = sichtbarer Zustand (gleich = nichts Neues)
    ok(key, now, sig) {
      const t = at.get(key) ?? -Infinity;
      if (now - t < gap) return false;
      if (sig !== undefined && last.get(key) === sig && !(keep && now - t >= keep)) return false;
      at.set(key, now);
      last.set(key, sig);
      return true;
    },
    forget(key) {
      if (key === undefined) at.clear(), last.clear();
      else at.delete(key), last.delete(key);
    },
  };
}

// Farbe als grobe Signatur: kleine Rundungsunterschiede schicken keinen neuen Befehl los
const sig = (rgb, extra = "") => rgb.map((x) => x >> 3).join(",") + extra;

/* ---- HTTP mit Statuscode (Nanoleaf antwortet auf Befehle mit 204 ohne Inhalt, beim Koppeln mit 403) */
function req(method, url, body, timeout = 2500) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      return resolve(null);
    }
    // nur unverschlüsseltes HTTP zu Adressen im eigenen Netz – alles andere geht gar nicht erst raus
    if (u.protocol !== "http:" || !lanAddr(u.hostname)) return resolve(null);
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const r = http.request(u, { method, timeout, headers: { "content-type": "application/json", ...(data ? { "content-length": data.length } : {}) } }, (res) => {
      let s = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        // Antworten der Lampen sind klein; was riesig wird, ist keine Lampe
        if ((s += c).length > 512 * 1024) res.destroy();
      });
      res.on("end", () => {
        let json = null;
        try {
          json = s ? JSON.parse(s) : null;
        } catch {}
        resolve({ status: res.statusCode || 0, body: json });
      });
      res.on("error", () => resolve(null));
    });
    r.on("timeout", () => r.destroy());
    r.on("error", () => resolve(null));
    if (data) r.write(data);
    r.end();
  });
}

// RGB 0..255 → Farbton 0..360, Sättigung 0..1, Helligkeit 0..1
function hsv([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: mx ? d / mx : 0, v: mx / 255 };
}

// Lampen mit nur einer Farbe: dieselbe Wahl wie Govee (eine Songfarbe je Schlag, mit „Keine Blitze“ wandernd)
function oneColor(look) {
  const c = look.nf ? mixPal(look.p, drift(look.now)) : look.p[((look.beat % 3) + 3) % 3];
  return look.drop ? whiten(c) : c;
}
// Lampen mit mehreren Feldern (Paneele, Zonen): x von −1 (links) bis +1 (rechts) → Verlauf der Songfarben
function spreadColor(look, x) {
  const c = mixPal(look.p, clamp(x, -1, 1) + 1 + (look.nf ? drift(look.now) : look.beat * 0.5));
  return look.drop ? whiten(c) : c;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { clamp, scale, mixPal, drift, whiten, lanAddr, lanList, createGate, sig, req, hsv, oneColor, spreadColor, sleep };
