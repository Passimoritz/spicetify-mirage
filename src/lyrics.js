import { S, lru } from "./core.js";
import { cfg } from "./config.js";
import { currentItem, titleOf, artistOf } from "./player.js";

/* ---------------------------------------------------------------- Liedtext */
// Promise statt Ergebnis merken: fragen Immersiv-Modus und Overlay gleichzeitig, geht nur
// EINE Anfrage an Spotify raus
const lyricCache = lru(60);
function getLyrics(uri) {
  if (!/^spotify:(track|local):/.test(uri || "")) return Promise.resolve(null);
  // Schalter im Schlüssel: wer die Online-Suche umschaltet, bekommt sofort das passende Ergebnis
  const key = uri + (cfg.onlineLyrics ? "|web" : "");
  if (!lyricCache.has(key)) lyricCache.set(key, fetchLyrics(uri));
  return lyricCache.get(key);
}
async function fetchLyrics(uri) {
  // Song-Daten jetzt festhalten – bis die Spotify-Antwort da ist, kann schon der nächste laufen
  const item = currentItem();
  const meta = item?.uri === uri ? songMeta(item) : null;
  const own = uri.startsWith("spotify:track:") ? await fetchSpotify(uri) : null;
  if (own || !cfg.onlineLyrics || !meta) return own;
  return fetchLrclib(meta);
}
async function fetchSpotify(uri) {
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
        source: "spotify",
        lines: L.lines.map((l) => ({ t: Number(l.startTimeMs) || 0, text: (l.words || "").trim() || "♪" })),
      }
    : null;
}

/* ---------------------------------------------------------------- Liedtext aus dem Netz */
// Hat Spotify nichts, fragt Mirage LRCLIB (freie Liedtext-Sammlung, ohne Konto). Raus gehen nur
// Titel, Künstler, Album und Länge – abschaltbar unter „Liedtext online suchen“.
function songMeta(item) {
  const m = item.metadata || {};
  const ms = Number(m.duration) || Number(item.duration?.milliseconds) || Number(S.Player.data?.duration) || 0;
  return {
    title: titleOf(item),
    artist: m.artist_name || artistOf(item).split(", ")[0] || "",
    album: m.album_title || item.album?.name || "",
    sec: Math.round(ms / 1000),
  };
}
// „Song - Remastered 2011“, „Song (feat. X)“ → „Song“: so stehen die Titel bei LRCLIB
const cleanTitle = (s) => s.replace(/\s+-\s+.*(remaster|version|edit|live|mix|mono|stereo).*$/i, "").replace(/\s*[([](feat|ft|with)\.?\s[^)\]]*[)\]]/gi, "").trim();
const LRCLIB = "https://lrclib.net/api/";
async function lrclib(path) {
  try {
    const res = await fetch(LRCLIB + path, { headers: { "Lrclib-Client": "mirage (https://github.com/Passimoritz/spicetify-mirage)" } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
async function fetchLrclib(meta) {
  if (!meta.title || !meta.artist) return null;
  const qs = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  const title = cleanTitle(meta.title) || meta.title;
  // 1. genauer Treffer (LRCLIB lässt dabei ±2 s Länge zu), 2. Suche – nimmt den Eintrag mit
  // der passendsten Länge, zeitgenaue Texte vor einfachen
  let hit = meta.sec ? await lrclib("get?" + qs({ track_name: title, artist_name: meta.artist, album_name: meta.album, duration: meta.sec })) : null;
  if (!hit?.syncedLyrics && !hit?.plainLyrics && !hit?.instrumental) {
    const list = await lrclib("search?" + qs({ track_name: title, artist_name: meta.artist }));
    const fits = (Array.isArray(list) ? list : []).filter((x) => !meta.sec || Math.abs((x.duration || 0) - meta.sec) <= 4);
    fits.sort((a, b) => !!b.syncedLyrics - !!a.syncedLyrics || Math.abs(a.duration - meta.sec) - Math.abs(b.duration - meta.sec));
    hit = fits[0] || null;
  }
  if (!hit) return null;
  if (hit.instrumental) return { synced: false, lang: "", source: "lrclib", instrumental: true, lines: [] };
  const synced = parseLrc(hit.syncedLyrics || "");
  if (synced.length) return { synced: true, lang: "", source: "lrclib", lines: synced };
  const plain = (hit.plainLyrics || "").split(/\r?\n/).map((x) => x.trim());
  while (plain.length && !plain[plain.length - 1]) plain.pop();
  return plain.length ? { synced: false, lang: "", source: "lrclib", lines: plain.map((text) => ({ t: 0, text: text || "♪" })) } : null;
}
// „[01:02.34] Text“ – eine Zeile darf mehrere Zeitmarken tragen (Refrain)
function parseLrc(lrc) {
  const out = [];
  for (const row of lrc.split(/\r?\n/)) {
    const marks = [...row.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (!marks.length) continue;
    const text = row.slice(marks[marks.length - 1].index + marks[marks.length - 1][0].length).trim() || "♪";
    for (const m of marks) out.push({ t: Math.round((Number(m[1]) * 60 + Number(m[2].replace(":", "."))) * 1000), text });
  }
  return out.sort((a, b) => a.t - b.t);
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
