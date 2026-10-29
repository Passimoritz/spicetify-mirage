import { S, lru } from "./core.js";

/* ---------------------------------------------------------------- Liedtext */
// Promise statt Ergebnis merken: fragen Immersiv-Modus und Overlay gleichzeitig, geht nur
// EINE Anfrage an Spotify raus
const lyricCache = lru(60);
function getLyrics(uri) {
  if (!uri?.startsWith("spotify:track:")) return Promise.resolve(null);
  if (!lyricCache.has(uri)) lyricCache.set(uri, fetchLyrics(uri));
  return lyricCache.get(uri);
}
async function fetchLyrics(uri) {
  const id = uri.split(":")[2];
  const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`;
  let body = null;
  try {
    body = await S.CosmosAsync.get(url, null, { "app-platform": "WebPlayer" });
  } catch {
    try { body = await S.CosmosAsync.get(url); } catch {}
  }
  const L = body?.lyrics;
  return L?.lines?.length
    ? {
        synced: L.syncType === "LINE_SYNCED",
        lang: L.language || "",
        lines: L.lines.map((l) => ({ t: Number(l.startTimeMs) || 0, text: (l.words || "").trim() || "♪" })),
      }
    : null;
}

/* ---------------------------------------------------------------- Übersetzung */
// Nur auf ausdrücklichen Wunsch (Einstellung „Liedtext übersetzen“, aus ab Werk): die Zeilen gehen
// dafür an Google Translate. Ein Aufruf pro Song, Ergebnis wird gemerkt.
const trCache = lru(40);
async function translateLines(uri, lyr, target) {
  if (!lyr?.lines?.length) return null;
  const lang = (lyr.lang || "").slice(0, 2).toLowerCase();
  if (lang && lang === target) return null;
  const key = uri + ":" + target;
  if (trCache.has(key)) return trCache.get(key);
  const text = lyr.lines.map((l) => (l.text === "♪" ? "" : l.text)).join("\n");
  let out = null;
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`
    );
    const data = await res.json();
    // data[2] = erkannte Quellsprache; gleich der Zielsprache → nichts anzeigen
    if (data?.[2] !== target) {
      const lines = (data?.[0] || []).map((p) => p[0]).join("").split("\n");
      out = lyr.lines.map((l, i) => (l.text === "♪" ? "" : (lines[i] || "").trim()));
    }
  } catch {}
  trCache.set(key, out);
  return out;
}

/* ---------------------------------------------------------------- Canvas-Videos */
// Die kurzen Spotify-Loops hinter manchen Songs. Spotify liefert sie über eine interne Abfrage;
// fehlt sie in einer Spotify-Version, bleibt es einfach beim Cover.
const canvasCache = lru(60);
async function getCanvas(uri) {
  if (!uri?.startsWith("spotify:track:")) return null;
  if (canvasCache.has(uri)) return canvasCache.get(uri);
  let url = null;
  try {
    const G = S.GraphQL;
    const def = G?.Definitions?.canvas;
    if (def && G.Request) {
      const r = await G.Request(def, { uri });
      url = r?.data?.trackUnion?.canvas?.url || null;
      if (url && !/\.mp4(\?|$)/.test(url)) url = null; // Bild-Canvas: das Cover reicht
    }
  } catch {}
  canvasCache.set(uri, url);
  return url;
}

export { getLyrics, translateLines, getCanvas };
