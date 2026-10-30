import { S, lru } from "./core.js";
import { cfg, save } from "./config.js";
import { currentItem, titleOf, artistOf } from "./player.js";

/* ---------------------------------------------------------------- Liedtext */
// Promise statt Ergebnis merken: fragen Immersiv-Modus und Overlay gleichzeitig, geht nur
// EINE Anfrage an Spotify raus
const lyricCache = lru(60);
function getLyrics(uri) {
  if (!/^spotify:(track|local):/.test(uri || "")) return Promise.resolve(null);
  // Schalter und gewählte Fassung im Schlüssel: wer umschaltet, bekommt sofort das passende Ergebnis
  const pick = cfg.onlineLyrics ? cfg.lyricPicks?.[uri] || "" : "";
  const key = uri + (cfg.onlineLyrics ? "|web" : "") + "|" + pick;
  if (!lyricCache.has(key)) lyricCache.set(key, fetchLyrics(uri, pick));
  return lyricCache.get(key);
}
// Song-Daten je Song, damit „Fassung wählen“ später noch weiß, wonach es suchen soll
const metaCache = lru(60);
async function fetchLyrics(uri, pick) {
  // Song-Daten jetzt festhalten – bis die Spotify-Antwort da ist, kann schon der nächste laufen
  const item = currentItem();
  const meta = item?.uri === uri ? songMeta(item) : metaCache.get(uri) || null;
  if (meta) metaCache.set(uri, meta);
  if (pick) {
    const hit = await lrclib("get/" + encodeURIComponent(pick));
    const got = hit && fromHit(hit);
    if (got) return got;
  }
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
        // SYLLABLE_SYNCED ist genauso zeitgenau, liefert aber zusätzlich Silbenzeiten (für Karaoke)
        synced: L.syncType === "LINE_SYNCED" || L.syncType === "SYLLABLE_SYNCED",
        lang: L.language || "",
        source: "spotify",
        lines: L.lines.map((l) => {
          const line = { t: Number(l.startTimeMs) || 0, text: (l.words || "").trim() || "♪" };
          const syl = (l.syllables || []).filter((x) => x && x.startTimeMs != null && Number(x.numChars) > 0);
          if (syl.length) line.syl = syl.map((x) => ({ t: Number(x.startTimeMs), n: Number(x.numChars) }));
          return line;
        }),
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
  return hit ? fromHit(hit) : null;
}
function fromHit(hit) {
  const base = { lang: "", source: "lrclib", lrcId: hit.id };
  if (hit.instrumental) return { ...base, synced: false, instrumental: true, lines: [] };
  const synced = parseLrc(hit.syncedLyrics || "");
  if (synced.length) return { ...base, synced: true, lines: synced };
  const plain = (hit.plainLyrics || "").split(/\r?\n/).map((x) => x.trim());
  while (plain.length && !plain[plain.length - 1]) plain.pop();
  return plain.length ? { ...base, synced: false, lines: plain.map((text) => ({ t: 0, text: text || "♪" })) } : null;
}

/* ---- Fassung wählen */
// Alle LRCLIB-Treffer zum Song, passendste Länge und zeitgenaue Texte zuerst
async function lyricVersions(uri) {
  const meta = metaCache.get(uri) || (currentItem()?.uri === uri ? songMeta(currentItem()) : null);
  if (!meta?.title) return [];
  const title = cleanTitle(meta.title) || meta.title;
  const q = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  let list = await lrclib("search?" + q({ track_name: title, artist_name: meta.artist }));
  if (!Array.isArray(list) || !list.length) list = await lrclib("search?" + q({ q: `${title} ${meta.artist}` }));
  const diff = (x) => (meta.sec ? Math.abs((x.duration || 0) - meta.sec) : 0);
  return (Array.isArray(list) ? list : [])
    .filter((x) => x.syncedLyrics || x.plainLyrics || x.instrumental)
    .sort((a, b) => !!b.syncedLyrics - !!a.syncedLyrics || diff(a) - diff(b))
    .slice(0, 12)
    .map((x) => ({ id: x.id, title: x.trackName, artist: x.artistName, album: x.albumName, sec: Math.round(x.duration || 0), synced: !!x.syncedLyrics, instrumental: !!x.instrumental }));
}
// id = LRCLIB-Eintrag, leer = wieder automatisch (Spotify zuerst)
function pickLyrics(uri, id) {
  const picks = { ...(cfg.lyricPicks || {}) };
  delete picks[uri];
  if (id) picks[uri] = String(id);
  // nur die letzten 200 Wahlen behalten
  const keys = Object.keys(picks);
  for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete picks[k];
  cfg.lyricPicks = picks;
  save();
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

export { getLyrics, lyricVersions, pickLyrics, translateLines, getCanvas };
