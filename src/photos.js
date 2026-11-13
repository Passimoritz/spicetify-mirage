/* ---------------------------------------------------------------- Foto-Wand: Stücke, Prüfsumme, Grenzen */
// Ein Foto vom Handy ist größer als eine Relay-Nachricht sein sollte: die öffentlichen Relays nennen keine
// Grenze, darum bleibt jede Nachricht deutlich unter 32 KB. Das Handy schickt das JPEG in Stücken (gleiche
// Kennung, Nummer, Anzahl, SHA-256 des Ganzen); hier wird es zusammengesetzt, geprüft und gedrosselt.
// Ohne DOM, damit die Unit-Tests es in Node laufen lassen können.
export const PHOTO = {
  MAX_BYTES: 64 * 1024, // Handy zielt auf 60 KB, ein wenig Luft
  CHUNK: 20000, // Base64-Zeichen je Stück (durch 4 teilbar) → Nachricht ≈ 20 KB
  MAX_CHUNKS: 5,
  TIMEOUT: 25e3, // unvollständige Sätze fliegen danach raus
  GAP: 30e3, // ein Foto je 30 s und Gast
  PER_GUEST: 5, // je Gast und Party
  QUEUE: 12, // höchstens so viele warten auf deine Freigabe
  GALLERY: 24, // freigegebene im Speicher, ältere fallen raus
  BURST: 3, // insgesamt: kurz drei, dann eines je 6 s
  REFILL: 6e3,
  SIDE: 640,
};
const B64 = /^[A-Za-z0-9+/]*={0,2}$/;
const PID = /^[\w-]{6,16}$/;
const HASH = /^[\w-]{43}$/;

const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export async function hashOf(u8) {
  return b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", u8)));
}
// große Arrays nicht auf einmal in String.fromCharCode (Stapelgrenze)
export function toB64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192));
  return btoa(s);
}
export function fromB64(s) {
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// wie das Handy: Stücke einer Datei (für Tests und als Vorlage für docs/live)
export async function makeChunks(u8, p) {
  const h = await hashOf(u8), d = toB64(u8), n = Math.max(1, Math.ceil(d.length / PHOTO.CHUNK));
  return Array.from({ length: n }, (_, i) => ({ k: "photo", p, i, n, h, d: d.slice(i * PHOTO.CHUNK, (i + 1) * PHOTO.CHUNK) }));
}
const isJpeg = (u8) => u8.length > 4 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff && u8[u8.length - 2] === 0xff && u8[u8.length - 1] === 0xd9;

// Zusammensetzen: je Gast höchstens ein offener Satz, insgesamt wenige. Ergebnis von add():
// "part" (fehlt noch etwas), "done" (+ bytes), "dup" (schon fertig – nur noch einmal bestätigen), "bad" (verworfen)
export function createAssembler({ now = () => Date.now(), timeout = PHOTO.TIMEOUT, maxOpen = 6 } = {}) {
  const open = new Map(), done = new Map();
  function sweep() {
    const t = now();
    for (const [k, s] of open) if (t - s.at > timeout) open.delete(k);
    for (const [k, at] of done) if (t - at > 120e3) done.delete(k);
  }
  async function add(from, m) {
    sweep();
    const n = m?.n, i = m?.i, d = m?.d;
    if (!PID.test(String(m?.p)) || !HASH.test(String(m?.h)) || !Number.isInteger(n) || n < 1 || n > PHOTO.MAX_CHUNKS || !Number.isInteger(i) || i < 0 || i >= n) return { st: "bad" };
    if (typeof d !== "string" || !d.length || d.length > PHOTO.CHUNK || !B64.test(d) || (i < n - 1 && d.length !== PHOTO.CHUNK)) return { st: "bad" };
    const key = from + "|" + m.p;
    if (done.has(key)) return { st: "dup", p: m.p };
    let s = open.get(key);
    if (s && (s.n !== n || s.h !== m.h)) {
      open.delete(key);
      return { st: "bad", p: m.p };
    }
    const first = !s;
    if (!s) {
      // neuer Satz desselben Gastes ersetzt seinen alten; zu viele offene insgesamt: der älteste fliegt raus
      for (const [k, o] of open) if (o.from === from) open.delete(k);
      if (open.size >= maxOpen) open.delete(open.keys().next().value);
      s = { from, n, h: m.h, parts: new Array(n), got: 0, at: now() };
      open.set(key, s);
    }
    if (s.parts[i] == null) {
      s.parts[i] = d;
      s.got++;
    }
    if (s.got < n) return { st: "part", p: m.p, first };
    // aus „open“ heraus, bevor geprüft wird: späte Kopien desselben Stücks legen keinen neuen Satz an
    open.delete(key);
    done.set(key, now());
    let bytes;
    try {
      bytes = fromB64(s.parts.join(""));
    } catch {
      bytes = null;
    }
    // kaputt: vergessen, damit ein neuer Versuch mit derselben Kennung wieder geht
    if (!bytes || bytes.length > PHOTO.MAX_BYTES || !isJpeg(bytes) || (await hashOf(bytes)) !== s.h) {
      done.delete(key);
      return { st: "bad", p: m.p };
    }
    return { st: "done", p: m.p, bytes, first };
  }
  // abgelehnter Satz (Grenze erreicht): nicht weiter sammeln
  const drop = (from, p) => open.delete(from + "|" + p);
  return { add, sweep, drop, open, clear: () => (open.clear(), done.clear()) };
}

// Grenzen: je Gast ein Foto je 30 s und fünf je Party, insgesamt ein kleiner Eimer, und nie mehr als QUEUE offen.
// check() vor dem ersten Stück (früh ablehnen, nichts sammeln), take() wenn ein Foto fertig angekommen ist.
export function createLimiter({ now = () => Date.now(), gap = PHOTO.GAP, perGuest = PHOTO.PER_GUEST, burst = PHOTO.BURST, refill = PHOTO.REFILL, queue = PHOTO.QUEUE } = {}) {
  const by = new Map();
  let tokens = burst, at = now();
  const fill = () => {
    const t = now();
    tokens = Math.min(burst, tokens + (t - at) / refill);
    at = t;
  };
  function check(id, waiting) {
    const g = by.get(id) || { n: 0, last: -Infinity };
    if (g.n >= perGuest) return { st: "max", n: perGuest };
    if (now() - g.last < gap) return { st: "slow", w: Math.ceil((gap - (now() - g.last)) / 1000) };
    if (waiting >= queue) return { st: "full" };
    fill();
    if (tokens < 1) return { st: "full" };
    return { st: "go" };
  }
  function take(id) {
    const g = by.get(id) || { n: 0, last: -Infinity };
    g.n++;
    g.last = now();
    by.set(id, g);
    fill();
    tokens = Math.max(0, tokens - 1);
  }
  return { check, take, clear: () => by.clear() };
}
