import { S, lru } from "./core.js";
import { cfg } from "./config.js";
import { titleOf } from "./player.js";
import { analyzePcm } from "./tempo.js";
import { pickDeezer, pickApple, sameArtist, sameTitle, bareTitle } from "./srcmatch.js";

/* ---------------------------------------------------------------- Öffentliche Musik-Quellen */
// Was Mirage ohne Spotify über einen Song erfährt: Deezer (Tempo – oft 0 –, Lautheit, Album-Genre, 30-s-Hörprobe)
// und iTunes (Genre des Songs, Hörprobe). Raus gehen nur Titel und Künstler, abschaltbar („Genre online nachschlagen“).
// Jede Antwort wird je Song gemerkt; Party (Genre) und Schätzung (Tempo) fragen dieselben Treffer.
//
// Deezers erweiterte Suche (artist:"…" track:"…") liefert seit 2026 nichts mehr – Mirage bekam darüber nie ein
// Tempo. Jetzt: normale Suche „Künstler Titel“ und der Treffer muss zum Künstler und Titel passen.

const within = (p, ms) => Promise.race([Promise.resolve(p).catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);
async function cosmos(url) {
  try {
    const r = await S.CosmosAsync.get(url);
    return typeof r === "string" ? JSON.parse(r) : r;
  } catch {
    return null;
  }
}
async function getJson(url, ms = 5000) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
const who = (item) => ({
  title: bareTitle(item?.metadata?.title || item?.name || titleOf(item)),
  artist: item?.metadata?.artist_name || item?.artists?.[0]?.name || "",
});

/* ---- Deezer: Treffer, Tempo, Lautheit, Album-Genres, Hörprobe */
const dzCache = lru(60);
function deezer(item) {
  const uri = item?.uri || "";
  const { title, artist } = who(item);
  if (!cfg.partyOnline || !uri || !title || !artist) return Promise.resolve(null);
  if (dzCache.has(uri)) return dzCache.get(uri);
  const job = (async () => {
    // Deezer schickt keine CORS-Kopfzeilen für die API – darum über Spotifys Proxy (wie bisher)
    const res = await within(cosmos(`https://api.deezer.com/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=8`), 5000);
    const hit = pickDeezer(res?.data, title, artist);
    if (!hit?.id) return null;
    const t = await within(cosmos(`https://api.deezer.com/track/${hit.id}`), 5000);
    const albumId = t?.album?.id || hit.album?.id;
    const alb = albumId ? await within(cosmos(`https://api.deezer.com/album/${albumId}`), 5000) : null;
    return {
      bpm: Number(t?.bpm) > 40 ? Number(t.bpm) : 0,
      gain: Number.isFinite(Number(t?.gain)) && t?.gain !== undefined ? Number(t.gain) : null,
      preview: t?.preview || hit.preview || "",
      genres: (alb?.genres?.data || []).map((g) => String(g.name || "")).filter(Boolean),
    };
  })();
  dzCache.set(uri, job);
  return job;
}

/* ---- iTunes: Genre des Songs und Hörprobe (erst im eigenen Land, dann in den USA) */
const itCache = lru(200);
function itunes(item) {
  const uri = item?.uri || "";
  const { title, artist } = who(item);
  if (!cfg.partyOnline || !uri.startsWith("spotify:track:") || !title || !artist) return Promise.resolve(null);
  if (itCache.has(uri)) return itCache.get(uri);
  const region = (navigator.languages || [navigator.language]).map((l) => String(l).split("-")[1]).find((r) => /^[A-Z]{2}$/i.test(r || ""));
  const countries = [...new Set([region || "DE", "US"].map((c) => c.toUpperCase()))];
  const job = (async () => {
    for (const country of countries) {
      const res = await getJson(`https://itunes.apple.com/search?media=music&entity=song&limit=10&country=${country}&term=${encodeURIComponent(title + " " + artist)}`);
      const list = res?.results || [];
      const genre = pickApple(list, title, artist);
      if (genre) {
        const same = list.find((r) => sameArtist(r.artistName, artist) && sameTitle(r.trackName, title) && r.previewUrl);
        return { genre, preview: same?.previewUrl || "" };
      }
    }
    return null;
  })();
  itCache.set(uri, job);
  return job;
}

/* ---- Hörprobe → Tempo und Klangzahlen (tempo.js). Nur dekodiert und gerechnet, nie abgespielt. */
const pvCache = lru(30);
function previewSound(item, hint = 0) {
  const uri = item?.uri || "";
  if (!uri || !cfg.partyOnline || typeof OfflineAudioContext !== "function") return Promise.resolve(null);
  if (pvCache.has(uri)) return pvCache.get(uri);
  const job = (async () => {
    const [dz, it] = await Promise.all([within(deezer(item), 12000), within(itunes(item), 8000)]);
    for (const url of [dz?.preview, it?.preview]) {
      if (!url || !/^https:\/\/[\w.-]+\.(dzcdn\.net|apple\.com)\//.test(url)) continue;
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 8000);
        const res = await fetch(url, { signal: ctl.signal });
        const buf = res.ok ? await res.arrayBuffer() : null;
        clearTimeout(timer);
        if (!buf || buf.byteLength < 20000) continue;
        // Offline-Kontext: dekodiert auf 22 050 Hz mono, ohne Ausgabegerät
        const ctx = new OfflineAudioContext(1, 22050, 22050);
        const audioBuf = await ctx.decodeAudioData(buf);
        const pcm = audioBuf.getChannelData(0);
        // alle 300 Bilder kurz Luft holen: die Rechnung (~80 ms) verteilt sich, kein Bild bleibt hängen
        const r = await analyzePcm(pcm, audioBuf.sampleRate, hint || dz?.bpm || 0, () => new Promise((ok) => setTimeout(ok, 0)));
        if (r.bpm) return r;
      } catch {}
    }
    return null;
  })();
  pvCache.set(uri, job);
  return job;
}

export { deezer, itunes, previewSound };
