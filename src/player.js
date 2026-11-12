import { SEL } from "./selectors.js";
import { S } from "./core.js";

/* ---------------------------------------------------------------- Player-Anbindung */
function currentItem() {
  return S.Player.data?.item || S.Player.data?.track || null;
}
const toHttp = (u) => (u && u.startsWith("spotify:image:") ? "https://i.scdn.co/image/" + u.slice(14) : u || "");
// klein = sofort da (die Leiste unten nutzt es schon), groß = scharf
function covers(item) {
  const m = item?.metadata || {};
  const imgs = item?.images || [];
  const domImg = document.querySelector(SEL.nowPlayingCover)?.src;
  const big = toHttp(m.image_xlarge_url || m.image_large_url || imgs[0]?.url);
  const small = toHttp(m.image_url || m.image_small_url || imgs[imgs.length - 1]?.url) || domImg || big;
  return { small, big: big || small };
}
function titleOf(item) {
  return item?.metadata?.title || item?.name || "";
}
function artistOf(item) {
  const m = item?.metadata || {};
  if (m.artist_name) {
    const more = Object.keys(m)
      .filter((k) => /^artist_name:\d+$/.test(k))
      .map((k) => m[k]);
    return [m.artist_name, ...more].join(", ");
  }
  return (item?.artists || []).map((a) => a.name).join(", ");
}

/* ---- Lautstärke */
// Spicetify.Player.setMute und toggleMute klicken auf „.volume-bar__icon-button“. Diese Klasse gibt es in aktuellen
// Spotify-Versionen nicht mehr, der Aufruf tut dann still nichts. Darum immer über die Lautstärke selbst.
function readVolume() {
  const v = S.Player.getVolume?.() ?? S.Platform?.PlaybackAPI?._volume;
  return typeof v === "number" && v >= 0 ? v : null;
}
function writeVolume(v) {
  if (S.Player.setVolume) S.Player.setVolume(v);
  else S.Platform?.PlaybackAPI?.setVolume?.(v);
}
let unmuteTo = 0;
function toggleMute() {
  const v = readVolume();
  if (v > 0) {
    unmuteTo = v;
    writeVolume(0);
  } else writeVolume(unmuteTo || 0.5);
}

/* ---- Steuerung */
// Eine dünne eigene Schicht über Spicetifys Helfern: fehlt einer nach einem Spotify-Update oder wirft er,
// geht der Aufruf direkt an Spotifys PlayerAPI. So hängt Mirage nicht an einem einzelnen Weg.
const api = () => S.Platform?.PlayerAPI;
const state = () => api()?._state || S.Player.data || null;
function via(name, args, fallback) {
  try {
    if (typeof S.Player[name] === "function") return S.Player[name](...args);
  } catch {}
  try {
    return fallback();
  } catch {}
}
const PLR = {
  // Spicetify behandelt Kommazahlen zwischen 0 und 1 als Anteil des Songs: darum immer ganze Millisekunden
  seek: (ms) => {
    const v = Math.max(0, Math.round(Number(ms) || 0));
    return via("seek", [v], () => api()?.seekTo?.(v));
  },
  next: () => via("next", [], () => api()?.skipToNext?.()),
  back: () => via("back", [], () => api()?.skipToPrevious?.()),
  play: () => via("play", [], () => api()?.resume?.()),
  pause: () => via("pause", [], () => api()?.pause?.()),
  togglePlay: () => via("togglePlay", [], () => (PLR.isPlaying() ? api()?.pause?.() : api()?.resume?.())),
  isPlaying: () => {
    const v = via("isPlaying", [], () => undefined);
    if (typeof v === "boolean") return v;
    const st = state();
    return !!st && !(st.isPaused ?? st.is_paused);
  },
  getProgress: () => {
    const v = via("getProgress", [], () => undefined);
    if (typeof v === "number" && v >= 0) return v;
    const st = state();
    if (!st) return 0;
    const base = Number(st.positionAsOfTimestamp) || 0;
    return st.isPaused ? base : base + (Date.now() - (Number(st.timestamp) || Date.now()));
  },
  getDuration: () => {
    const v = via("getDuration", [], () => undefined);
    if (typeof v === "number" && v > 0) return v;
    const st = state();
    return Number(st?.duration ?? st?.item?.duration?.milliseconds ?? currentItem()?.metadata?.duration) || 0;
  },
};

export { currentItem, toHttp, covers, titleOf, artistOf, readVolume, writeVolume, toggleMute, PLR };
