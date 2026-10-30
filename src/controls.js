import { S } from "./core.js";

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
    .map((x) => x.contextTrack || x)
    .filter((x) => x?.uri && !x.uri.startsWith("spotify:delimiter") && x.metadata?.title)
    .slice(0, max)
    .map((x) => ({
      uri: x.uri,
      title: x.metadata.title,
      artist: x.metadata.artist_name || "",
      image: (x.metadata.image_url || x.metadata.image_small_url || "").replace("spotify:image:", "https://i.scdn.co/image/"),
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
  S.Player.pause ? S.Player.pause() : S.Player.togglePlay();
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
    left = (S.Player.getDuration?.() || 0) - (S.Player.getProgress?.() || 0);
    span = 20000;
  } else return;
  if (!S.Player.isPlaying() || left > span || left <= 0) return;
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
    if (S.Player.isPlaying()) stopSleep();
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

export { shuffleState, cycleShuffle, smartSupported, upNext, devices, canConnect, transfer, setSleep, sleepState, isFading, go, albumOf, artistUriOf };
