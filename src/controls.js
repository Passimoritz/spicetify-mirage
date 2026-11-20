import { S } from "./core.js";
import { PLR } from "./player.js";

/* ---------------------------------------------------------------- Wiedergabe-Funktionen */
// Alles, was Spotifys eigene Leiste unten kann, auch im Immersiv-Fenster. Spotify verschiebt
// diese Schnittstellen gern zwischen Versionen – darum wird jede vorher gesucht und, wenn sie
// fehlt, still ausgelassen (der Knopf verschwindet dann).
const api = () => S.Platform?.PlayerAPI;
const playerState = () => api()?._state || S.Player?.origin?._state || {};

/* ---- Zufall: aus → Zufall → Smart Shuffle → aus (wie in Spotify) */
// Spotify schaltet die drei Modi über eine eigene Shuffle-Schnittstelle (Modus 0 = aus, 1 = an,
// 2 = Smart Shuffle), immer bezogen auf die laufende Playlist. Smart Shuffle bietet sie nur an,
// wo Spotify es erlaubt. Gesucht wird sie an ihren Methoden, nicht an ihrem Namen – der wechselt.
const MODE = { OFF: 0, ON: 1, SMART: 2 };
function shuffleApi() {
  // Spotify legt sie in seiner internen Registry ab (Schlüssel Symbol.for("ShuffleAPI")),
  // nicht direkt auf Spicetify.Platform – Spicetify reicht die Registry über _platform durch
  const reg = S._platform?.getRegistry?.() || S.Platform?.Registry;
  for (const name of ["ShuffleAPI", "ContextualShuffleAPI"]) {
    try {
      const v = reg?.resolve?.(Symbol.for(name));
      if (typeof v?.getAvailableShuffleModes === "function" && typeof v.setShuffle === "function") return v;
    } catch {}
  }
  const P = S.Platform || {};
  const known = P.ShuffleAPI || P.ContextualShuffleAPI;
  if (typeof known?.getAvailableShuffleModes === "function") return known;
  for (const v of Object.values(P)) {
    if (v && typeof v.getAvailableShuffleModes === "function" && typeof v.setShuffle === "function") return v;
  }
  return null;
}
const contextUri = () => S.Player.data?.context?.uri || S.Player.data?.context_uri || playerState().context?.uri || "";
// Spotifys eigener Knopf unten: schaltet die Modi in seiner Reihenfolge durch (letzter Rückfall)
const nativeButton = () => document.querySelector('[data-testid="control-button-shuffle"]');

let lastMode = MODE.OFF;
function shuffleState() {
  const st = playerState();
  if (st.shuffle && st.smartShuffle) lastMode = MODE.SMART;
  else if (st.shuffle !== undefined) lastMode = st.shuffle ? MODE.ON : MODE.OFF;
  else lastMode = S.Player.getShuffle?.() ? MODE.ON : MODE.OFF;
  return lastMode;
}
async function cycleShuffle() {
  const now = shuffleState();
  const sh = shuffleApi(), ctx = contextUri();
  if (sh && ctx) {
    try {
      const modes = (await sh.getAvailableShuffleModes(ctx)) || [MODE.OFF, MODE.ON];
      const next = modes[(modes.indexOf(now) + 1) % modes.length] ?? MODE.OFF;
      await sh.setShuffle(ctx, next);
      // hat Spotify den Modus wirklich gewechselt? Sonst den eigenen Knopf nehmen
      await new Promise((r) => setTimeout(r, 350));
      if (shuffleState() !== now) return;
    } catch {}
  }
  const btn = nativeButton();
  if (btn) return btn.click();
  S.Player.toggleShuffle();
}
const smartSupported = () => !!shuffleApi() || !!nativeButton();

/* ---- Als Nächstes */
function upNext(max = 12) {
  const q = S.Queue?.nextTracks || S.Platform?.PlayerAPI?._queue?._queueState?.nextUp || [];
  return q
    .map((w) => [w.contextTrack || w, w])
    .filter(([x]) => x?.uri && !x.uri.startsWith("spotify:delimiter") && x.metadata?.title)
    .slice(0, max)
    .map(([x, w]) => ({
      uri: x.uri,
      title: x.metadata.title,
      artist: x.metadata.artist_name || "",
      image: (x.metadata.image_url || x.metadata.image_small_url || "").replace("spotify:image:", "https://i.scdn.co/image/"),
      // 1.27 actions: zum Entfernen und Hinspringen (uid); „von dir eingereiht“ (provider queue)
      uid: x.uid || "",
      queued: w.provider === "queue",
    }));
}

/* ---- Geräte (Spotify Connect) */
const connect = () => S.Platform?.ConnectAPI;
function devices() {
  const list = connect()?.state?.devices || [];
  return list.map((d) => ({ id: d.id, name: d.name, type: d.type, active: !!d.isActive || d.id === connect()?.state?.activeDevice?.id }));
}
const canConnect = () => typeof connect()?.transferPlayback === "function";
async function transfer(id) {
  try { await connect().transferPlayback(id); } catch {}
}

/* ---- Schlaf-Timer */
// In den letzten Minuten (bei „Ende des Songs“: den letzten 20 s) dreht Mirage die Lautstärke
// langsam herunter; nach dem Anhalten kommt die alte Lautstärke zurück, damit es morgen nicht still ist.
let sleepTimer = 0, sleepAt = 0, sleepEndOfTrack = false, sleepTotal = 0;
let fadeTick = 0, fadeFrom = null;
function restoreVolume() {
  if (fadeFrom == null) return;
  const v = fadeFrom;
  fadeFrom = null;
  try { S.Player.setVolume(v); } catch {}
}
function stopSleep() {
  PLR.pause();
  clearInterval(fadeTick);
  // erst nach dem Anhalten zurückdrehen, sonst springt der Ton kurz hoch
  setTimeout(restoreVolume, 900);
}
function fadeStep() {
  let left, span;
  if (sleepAt) {
    left = sleepAt - Date.now();
    span = Math.min(120000, sleepTotal * 0.3);
  } else if (sleepEndOfTrack) {
    left = (PLR.getDuration() || 0) - (PLR.getProgress() || 0);
    span = 20000;
  } else return;
  if (!PLR.isPlaying() || left > span || left <= 0) return;
  if (fadeFrom == null) fadeFrom = S.Player.getVolume?.() ?? 1;
  try { S.Player.setVolume(Math.max(0.02, fadeFrom * (left / span))); } catch {}
}
function setSleep(minutes) {
  clearTimeout(sleepTimer);
  clearInterval(fadeTick);
  restoreVolume();
  sleepAt = 0;
  sleepEndOfTrack = false;
  if (minutes === "track") {
    sleepEndOfTrack = true;
    fadeTick = setInterval(fadeStep, 500);
    return;
  }
  if (!minutes) return;
  sleepTotal = minutes * 60000;
  sleepAt = Date.now() + sleepTotal;
  fadeTick = setInterval(fadeStep, 500);
  sleepTimer = setTimeout(() => {
    sleepAt = 0;
    if (PLR.isPlaying()) stopSleep();
    else {
      clearInterval(fadeTick);
      restoreVolume();
    }
  }, sleepTotal);
}
// „Ende des Songs“: beim nächsten Songwechsel anhalten
S.Player.addEventListener?.("songchange", () => {
  if (!sleepEndOfTrack) return;
  sleepEndOfTrack = false;
  stopSleep();
});
const isFading = () => fadeFrom != null;
const sleepState = () => (sleepEndOfTrack ? "track" : sleepAt ? Math.max(1, Math.round((sleepAt - Date.now()) / 60000)) : 0);

/* ---- Zu Album / Künstler springen */
function go(uri) {
  const [, type, id] = String(uri || "").split(":");
  if (!id || !["album", "artist", "show", "episode"].includes(type)) return false;
  S.Platform?.History?.push?.(`/${type}/${id}`);
  return true;
}
const albumOf = (item) => item?.album?.uri || item?.metadata?.album_uri || "";
const artistUriOf = (item) => item?.artists?.[0]?.uri || item?.metadata?.artist_uri || "";

/* ---- Zu einer Playlist hinzufügen */
// Eigene und gemeinsame Playlists aus der Bibliothek (Ordner aufgeklappt), in die man schreiben darf
async function playlists() {
  const R = S.Platform?.RootlistAPI;
  if (typeof R?.getContents !== "function") return [];
  let root;
  try {
    root = await R.getContents();
  } catch {
    return [];
  }
  const out = [];
  const walk = (items, folder) => {
    for (const x of items || []) {
      if (x?.type === "folder") walk(x.items, x.name);
      else if (x?.type === "playlist" && x.uri && (x.canAdd ?? x.isOwnedBySelf ?? x.isCollaborative ?? true)) {
        out.push({ uri: x.uri, name: x.name || "", folder: folder || "", image: x.images?.[0]?.url || "" });
      }
    }
  };
  walk(root?.items);
  return out;
}
const canAddTo = () => typeof S.Platform?.PlaylistAPI?.add === "function" && typeof S.Platform?.RootlistAPI?.getContents === "function";
// true = hinzugefügt, "dup" = war schon drin, false = ging nicht
async function addToPlaylist(playlistUri, trackUri) {
  const P = S.Platform?.PlaylistAPI;
  try {
    const have = await P.getContents?.(playlistUri, { limit: 5000 });
    if (have?.items?.some((i) => i?.uri === trackUri)) return "dup";
  } catch {}
  try {
    await P.add(playlistUri, [trackUri], { after: "end" });
    return true;
  } catch {
    return false;
  }
}
/* === 1.27 actions: was Spotifys Song-Menü kann, für das Song-Menü im Immersiv-Modus === */
// Spotify legt manche Schnittstellen nur in seine interne Registry (wie die Shuffle-Schnittstelle oben)
function platform(name) {
  const direct = S.Platform?.[name];
  if (direct) return direct;
  try {
    return (S._platform?.getRegistry?.() || S.Platform?.Registry)?.resolve?.(Symbol.for(name)) || null;
  } catch {
    return null;
  }
}
const kindOf = (uri) => String(uri || "").split(":")[1] || "";
// Podcast-Folge oder Hörbuch-Kapitel (beide melden sich als spotify:episode:)
const isEpisode = (item) => kindOf(item?.uri) === "episode" || item?.metadata?.is_podcast === "true" || item?.metadata?.is_audiobook === "true";
// alle Künstler eines Songs mit Seite (Player.data.item.artists oder metadata.artist_uri, artist_uri:1 …)
function artistsOf(item) {
  const out = [], seen = new Set();
  const push = (uri, name) => {
    if (!/^spotify:artist:/.test(uri || "") || seen.has(uri)) return;
    seen.add(uri);
    out.push({ uri, name: name || "" });
  };
  for (const a of item?.artists || []) push(a?.uri, a?.name);
  const m = item?.metadata || {};
  push(m.artist_uri, m.artist_name);
  for (let i = 1; i < 10 && m["artist_uri:" + i]; i++) push(m["artist_uri:" + i], m["artist_name:" + i]);
  return out;
}
// Sendung einer Folge (Spotify meldet sie als show oder als „album“ der Folge)
const showOf = (item) => [item?.show?.uri, item?.metadata?.show_uri, item?.album?.uri, item?.metadata?.album_uri].find((u) => /^spotify:show:/.test(u || "")) || "";
// öffentlicher Link, wie „Link zum Song kopieren“ in Spotify
function linkOf(uri) {
  const [, type, id] = String(uri || "").split(":");
  return id && ["track", "episode", "album", "artist", "playlist", "show"].includes(type) ? `https://open.spotify.com/${type}/${id}` : "";
}
async function copyLink(uri) {
  const url = linkOf(uri);
  if (!url) return false;
  try {
    await platform("ClipboardAPI").copy(url);
    return true;
  } catch {}
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
/* ---- Warteschlange bearbeiten */
const canQueueAdd = () => typeof api()?.addToQueue === "function" || typeof S.addToQueue === "function";
async function queueAdd(uri) {
  try {
    if (typeof api()?.addToQueue === "function") await api().addToQueue([{ uri }]);
    else await S.addToQueue([{ uri }]);
    return true;
  } catch {
    return false;
  }
}
const canQueueEdit = () => typeof api()?.removeFromQueue === "function";
async function queueRemove(list) {
  try {
    await api().removeFromQueue(list.map((x) => (x.uid ? { uri: x.uri, uid: x.uid } : { uri: x.uri })));
    return true;
  } catch {
    return false;
  }
}
const canQueueClear = () => typeof api()?.clearQueue === "function";
async function queueClear() {
  try {
    await api().clearQueue();
    return true;
  } catch {
    return false;
  }
}
// zu einem Song in „Als Nächstes“ springen (wie ein Klick in Spotifys Warteschlange)
const canSkipTo = () => typeof api()?.skipTo === "function";
async function skipTo(x) {
  try {
    await api().skipTo({ uri: x.uri, uid: x.uid || "" });
    return true;
  } catch {
    return false;
  }
}
// zuletzt gespielt: was in der Warteschlange vor dem laufenden Song steht, neuester zuerst
function recent(max = 8) {
  const q = S.Queue?.prevTracks || [];
  return q
    .map((x) => x.contextTrack || x)
    .filter((x) => x?.uri && !x.uri.startsWith("spotify:delimiter") && x.metadata?.title)
    .reverse()
    .slice(0, max)
    .map((x) => ({
      uri: x.uri,
      title: x.metadata.title,
      artist: x.metadata.artist_name || "",
      image: (x.metadata.image_url || x.metadata.image_small_url || "").replace("spotify:image:", "https://i.scdn.co/image/"),
    }));
}
/* ---- Song-Radio: Spotify baut aus dem Song eine Radio-Playlist (wie „Zum Song-Radio“); Mirage spielt sie gleich ab */
const canRadio = () => typeof S.CosmosAsync?.get === "function" && (typeof S.Player.playUri === "function" || typeof api()?.play === "function");
async function songRadio(uri) {
  try {
    const r = await S.CosmosAsync.get(`https://spclient.wg.spotify.com/inspiredby-mix/v2/seed_to_playlist/${uri}?response-format=json`);
    const pl = r?.mediaItems?.[0]?.uri;
    if (!/^spotify:playlist:/.test(pl || "")) return false;
    if (typeof S.Player.playUri === "function") await S.Player.playUri(pl);
    else await api().play({ uri: pl }, {}, {});
    return true;
  } catch {
    return false;
  }
}
/* ---- „Aus deinem Geschmacksprofil ausschließen“ (Spotify 1.3: Sammlung „ignoreinrecs“ der CollectionPlatformAPI) */
function tasteApi() {
  const c = platform("CollectionPlatformAPI");
  return typeof c?.contains === "function" && typeof c.add === "function" && typeof c.remove === "function" ? c : null;
}
const canTaste = () => !!tasteApi();
async function tasteExcluded(uri) {
  try {
    return !!(await tasteApi().contains("ignoreinrecs", [uri]))?.[0];
  } catch {
    return null;
  }
}
async function setTasteExcluded(uri, on) {
  try {
    await tasteApi()[on ? "add" : "remove"]("ignoreinrecs", [uri]);
    return true;
  } catch {
    return false;
  }
}
/* ---- Neue Playlist mit diesem Song (wie in Spotify: sie heißt wie der Song und steht oben in der Bibliothek) */
const canCreate = () => typeof S.Platform?.RootlistAPI?.createPlaylist === "function" && typeof S.Platform?.PlaylistAPI?.add === "function";
async function newPlaylist(name, trackUri) {
  try {
    let uri = await S.Platform.RootlistAPI.createPlaylist(name, { before: "start" });
    // manche Spotify-Versionen liefern ein Objekt statt der Adresse (wie beim Party-Rückblick)
    if (uri && typeof uri !== "string") uri = uri.uri || "";
    if (!uri) return "";
    await S.Platform.PlaylistAPI.add(uri, [trackUri], { after: "end" });
    return uri;
  } catch {
    return "";
  }
}
/* ---- Wiedergabe-Tempo (Podcasts und Hörbücher, wie Spotifys Tempo-Knopf) */
function canSpeed(item) {
  const p = api();
  if (typeof p?.setSpeed !== "function" || !isEpisode(item)) return false;
  try {
    if (p.getCapabilities?.()?.canChangeSpeed === false) return false;
  } catch {}
  return !playerState().restrictions?.disallowSettingPlaybackSpeedReasons?.length;
}
const speedNow = () => Number(playerState().speed) || 1;
async function setSpeed(v) {
  try {
    await api().setSpeed(v);
    return true;
  } catch {
    return false;
  }
}
/* === end actions === */

// Smart Shuffle hat diesen Song eingestreut (Spotify zeigt dafür ein Funkeln) – nicht, wenn man ihn selbst eingereiht hat
const isSmartPick = (item) => item?.metadata?.provider === "enhanced_recommendation" && item?.provider !== "queue";

export { shuffleState, cycleShuffle, smartSupported, upNext, devices, canConnect, transfer, setSleep, sleepState, isFading, go, albumOf, artistUriOf, playlists, canAddTo, addToPlaylist, isSmartPick };
// 1.27 actions
export { isEpisode, artistsOf, showOf, linkOf, copyLink, canQueueAdd, queueAdd, canQueueEdit, queueRemove, canQueueClear, queueClear, canSkipTo, skipTo, recent, canRadio, songRadio, canTaste, tasteExcluded, setTasteExcluded, canCreate, newPlaylist, canSpeed, speedNow, setSpeed };
