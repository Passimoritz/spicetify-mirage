export const S = window.Spicetify;
// esbuild setzt die Version aus package.json ein (--define:__MIRAGE_VERSION__)
// eslint-disable-next-line no-undef
export const VERSION = typeof __MIRAGE_VERSION__ === "string" ? __MIRAGE_VERSION__ : "dev";

// kleiner Speicher mit fester Größe: der am längsten nicht genutzte Eintrag fliegt zuerst raus
export function lru(max) {
  const m = new Map();
  return {
    get(k) {
      if (!m.has(k)) return undefined;
      const v = m.get(k);
      m.delete(k);
      m.set(k, v);
      return v;
    },
    set(k, v) {
      m.delete(k);
      m.set(k, v);
      if (m.size > max) m.delete(m.keys().next().value);
    },
    has: (k) => m.has(k),
  };
}

const root = document.documentElement;
// Fehler sammeln – gehen mit dem Diagnosebericht an die Overlay-App
const errors = [];
addEventListener("error", (e) => errors.length < 30 && errors.push(String(e.message) + " @" + (e.lineno || "")));
addEventListener("unhandledrejection", (e) => errors.length < 30 && errors.push("promise: " + String(e.reason)));

// Ein Fehler soll nur seinen eigenen Baustein lahmlegen: guard() fängt ihn ab, merkt sich den Baustein und lässt
// den Rest von Mirage weiterlaufen. Die Liste steht in der Diagnose.
const failed = [];
function fail(name, e) {
  if (!failed.includes(name)) failed.push(name);
  if (errors.length < 30) errors.push(name + ": " + String(e?.message || e));
  try {
    console.error("[Mirage] " + name, e);
  } catch {}
}
function guard(name, fn) {
  try {
    const r = fn();
    return r && typeof r.then === "function" ? r.catch((e) => fail(name, e)) : r;
  } catch (e) {
    fail(name, e);
  }
}
// Stand der Reparatur-Datei aus dem Netz (remote.js)
const remote = { applied: 0, at: 0 };

/* ---------------------------------------------------------------- Helfer */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
// letzter Index mit arr[i][key] <= t (arr aufsteigend sortiert)
function seek(arr, at, key) {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (arr[m][key] <= at) { r = m; lo = m + 1; } else hi = m - 1;
  }
  return r;
}
const fmt = (ms) => {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const imgCache = new Map();
// Lädt und dekodiert ein Bild genau einmal; erst danach wird es angezeigt (kein Aufblitzen)
function loadImage(url, cors) {
  const key = (cors ? "c:" : "") + url;
  if (!imgCache.has(key)) {
    imgCache.set(
      key,
      new Promise((resolve) => {
        const img = new Image();
        if (cors) img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(img));
        img.onerror = () => {
          imgCache.delete(key);
          resolve(null);
        };
        img.src = url;
      })
    );
    if (imgCache.size > 40) imgCache.delete(imgCache.keys().next().value);
  }
  return imgCache.get(key);
}

export { root, errors, failed, guard, remote, clamp, hueGap, seek, fmt, loadImage };
