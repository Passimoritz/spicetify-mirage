import { S, root, loadImage } from "./core.js";
import { cfg, applyScheme } from "./config.js";
import { analyse, setColors, clearColors, current } from "./color.js";
import { showHaze } from "./stage.js";
import { loadAudio, beat } from "./audio.js";
import { bridge } from "./bridge.js";
import { immersive } from "./immersive.js";
import { currentItem, covers, toHttp, PLR } from "./player.js";
import { record } from "./share.js";
import { dust } from "./dust.js";
import { planPrefetch } from "./prefetch.js";
import { party } from "./party.js";

// Woher läuft gerade Musik (Playlist, Album, Radio …) und zu welchem Album gehört der Song?
const contextUri = () => S.Player.data?.context?.uri || S.Player.data?.context_uri || "";
const albumUri = (item) => item?.album?.uri || item?.metadata?.album_uri || "";

// Schema für die aktuelle Wiedergabe: eigenes pro Playlist, sonst das gewählte
function effectiveScheme() {
  return cfg.playlistSchemes?.[contextUri()] || cfg.scheme;
}

let lastUri = "", songToken = 0;
async function onSong(isChange, attempt = 0) {
  const token = ++songToken;
  const item = currentItem();
  const c = covers(item);
  // Beim Songwechsel fehlen die Bilddaten manchmal noch – kurz nachfassen
  if (!c.big && item && attempt < 8) {
    setTimeout(() => token === songToken && onSong(isChange, attempt + 1), 250);
    return;
  }
  const changed = isChange && item?.uri !== lastUri;
  lastUri = item?.uri || "";
  const scheme = effectiveScheme();
  applyScheme(scheme);
  // Playlist mit festem Schema: Coverfarben aus, außer das feste Schema IST „Mirage“
  const dynamic = cfg.playlistSchemes?.[contextUri()] ? scheme === "Mirage" : cfg.dynamic;
  loadAudio(item?.uri).then(() => immersive.updateKicker());
  planPrefetch();
  if (immersive.isOpen()) immersive.refresh();
  bridge.sendTrack(changed);
  if (!c.big) return;
  const { colors, haze } = await analyse(c.big, item?.uri);
  if (token !== songToken) return;
  showHaze(haze || c.big);
  record(item, colors || current);
  prefetchNext();
  if (!dynamic) return clearColors();
  // „Farben einfrieren“: die jetzigen bleiben, egal was läuft
  if (cfg.freeze && current) return;
  const pinned = cfg.pinned?.[albumUri(item)];
  if (pinned) setColors(pinned);
  else if (colors) setColors(colors);
  // fast farbloses Cover: lieber die Schemafarben als ein graues Spotify
  else clearColors();
}
// Nächsten Song schon vorbereiten: Cover laden, Farben und Hintergrund berechnen (alles gemerkt).
// Beim Wechsel sind Cover und Farben dann sofort da statt nach dem Download nachzurutschen.
let prefetched = "";
function prefetchNext() {
  const next = (S.Queue?.nextTracks || []).map((x) => x.contextTrack || x).find((x) => x?.uri?.startsWith("spotify:track:"));
  if (!next || next.uri === prefetched) return;
  prefetched = next.uri;
  const m = next.metadata || {};
  const big = toHttp(m.image_xlarge_url || m.image_large_url || m.image_url);
  const small = toHttp(m.image_url || m.image_small_url);
  if (!big) return;
  (window.requestIdleCallback || setTimeout)(() => {
    loadImage(big);
    if (small && small !== big) loadImage(small);
    // Farben, Hintergrund (schon gebacken) und im Party-Modus das Genre: beim Wechsel ist dann alles fertig
    // (Party: die Coverfarben gehen mit – im Ausklang gleitet das Licht schon zu ihnen, party.js)
    analyse(big, next.uri).catch(() => null).then((r) => {
      if (r?.haze) immersive.prebake?.(r.haze);
      if (immersive.isOpen() && cfg.imMode === "party") party.warm?.(next, r?.colors);
    }).catch(() => {});
  }, { timeout: 4000 });
}
// Coverfarben eines beliebigen Songs (für die DJ-Übergabe, wenn sich die Warteschlange nach dem Vorbereiten ändert)
party.colorsOf = (item) => {
  const m = item?.metadata || {}, big = toHttp(m.image_xlarge_url || m.image_large_url || m.image_url);
  return big ? analyse(big, item.uri).then((r) => r?.colors || null) : Promise.resolve(null);
};
function onPlayPause() {
  root.classList.toggle("mirage-playing", !!PLR.isPlaying());
  immersive.playState();
  dust.wake();
  beat.sync();
  planPrefetch();
  bridge.sendTrack(false);
}

export { onSong, onPlayPause, contextUri, albumUri, effectiveScheme };
