import { S, root } from "./core.js";
import { cfg, applyScheme } from "./config.js";
import { analyse, setColors, clearColors, current } from "./color.js";
import { showHaze } from "./stage.js";
import { loadAudio, beat } from "./audio.js";
import { bridge } from "./bridge.js";
import { immersive } from "./immersive.js";
import { currentItem, covers } from "./player.js";
import { record } from "./share.js";
import { dust } from "./dust.js";

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
  if (immersive.isOpen()) immersive.refresh();
  bridge.sendTrack(changed);
  if (!c.big) return;
  const { colors, haze } = await analyse(c.big, item?.uri);
  if (token !== songToken) return;
  showHaze(haze || c.big);
  record(item, colors || current);
  if (!dynamic) return clearColors();
  // „Farben einfrieren“: die jetzigen bleiben, egal was läuft
  if (cfg.freeze && current) return;
  const pinned = cfg.pinned?.[albumUri(item)];
  if (pinned) setColors(pinned);
  else if (colors) setColors(colors);
  // fast farbloses Cover: lieber die Schemafarben als ein graues Spotify
  else clearColors();
}
function onPlayPause() {
  root.classList.toggle("mirage-playing", !!S.Player.isPlaying());
  immersive.playState();
  dust.wake();
  beat.sync();
  bridge.sendTrack(false);
}

export { onSong, onPlayPause, contextUri, albumUri, effectiveScheme };
