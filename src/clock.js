import { S, clamp } from "./core.js";
import { cfg, save } from "./config.js";
import { currentItem } from "./player.js";
import { audio } from "./audio.js";

/* ---------------------------------------------------------------- Songuhr */
// Für alles, was im Takt laufen muss (Party, Visualizer, Karaoke). Spotify meldet die Position in kleinen
// Sprüngen und mit Zittern; daraus wird eine gleichmäßig laufende Uhr, die Abweichungen sanft einholt
// und nur bei echten Sprüngen (Spulen, Songwechsel) neu ansetzt. Dazu ein Vorlauf, der die Zeit vom
// Zeichnen bis zum Bildschirm ausgleicht (ein bis zwei Bilder plus Hintergrund-Thread), und ein Versatz,
// den man per Takt-Antippen (Taste T) einmisst – global, bei geschätzten Takten je Song.
const LEAD = 40;
const c = { pos: 0, at: 0, uri: "" };
function offsetFor(uri) {
  const per = cfg.syncSongs?.[uri];
  return (Number(cfg.syncOffset) || 0) + (Number.isFinite(per) ? per : 0);
}
function songPos(now = performance.now()) {
  const raw = S.Player.getProgress?.() || 0;
  const uri = currentItem()?.uri || "";
  if (!S.Player.isPlaying()) {
    Object.assign(c, { pos: raw, at: now, uri });
    return raw + offsetFor(uri);
  }
  let p = c.pos + (now - c.at);
  const diff = raw - p;
  if (uri !== c.uri || !c.at || Math.abs(diff) > 300) p = raw;
  else p += diff * Math.min(1, ((now - c.at) / 1000) * 2);
  Object.assign(c, { pos: p, at: now, uri });
  return p + LEAD + offsetFor(uri);
}

// Takt antippen: nach 6 gleichmäßigen Taps den mittleren Abstand zum nächsten Schlag ausgleichen
const taps = [];
function tapSync(now = performance.now()) {
  const beats = audio.data?.beats;
  if (!beats?.length || audio.uri !== currentItem()?.uri) return { none: true };
  const pos = songPos(now) / 1000;
  if (taps.length && now - taps[taps.length - 1].at > 2500) taps.length = 0;
  let lo = 0, hi = beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid].t < pos) lo = mid + 1;
    else hi = mid;
  }
  const near = lo > 0 && Math.abs(beats[lo - 1].t - pos) < Math.abs(beats[lo].t - pos) ? beats[lo - 1].t : beats[lo].t;
  taps.push({ at: now, d: pos - near });
  if (taps.length < 6) return { n: taps.length };
  const ds = taps.slice(-8).map((x) => x.d).sort((a, b) => a - b);
  const spread = ds[Math.floor(ds.length * 0.75)] - ds[Math.floor(ds.length * 0.25)];
  if (spread > 0.08) return { n: taps.length, unsure: true };
  const ms = Math.round(ds[ds.length >> 1] * 1000);
  const uri = currentItem()?.uri || "";
  if (audio.data.synthetic && uri) {
    const songs = { ...(cfg.syncSongs || {}) };
    songs[uri] = clamp((songs[uri] || 0) - ms, -1500, 1500);
    const keys = Object.keys(songs);
    if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete songs[k];
    cfg.syncSongs = songs;
  } else cfg.syncOffset = clamp((Number(cfg.syncOffset) || 0) - ms, -400, 400);
  save();
  taps.length = 0;
  return { done: true, ms: -ms };
}

export { songPos, tapSync };
