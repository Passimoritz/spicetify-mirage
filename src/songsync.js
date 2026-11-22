/* ---------------------------------------------------------------- Versatz je Song */
// Liedtext (und Licht) eines Songs von Hand früher oder später stellen – z. B. mit ±250-ms-Knöpfen. Gespeichert
// in cfg.syncSongs[uri] (ms); die Songuhr (clock.js) rechnet ihn zur Position dazu: positiv = die Uhr läuft vor =
// Zeilen und Licht kommen FRÜHER. Dazu der Schalter „Abgleich mit dem Gesang aus“ je Song (cfg.syncNoAuto).
// Ohne Fenster: arbeitet auf einem übergebenen cfg-Objekt – einzeln testbar (tests/unit/songsync.test.js);
// clock.js und lyrics.js reichen das echte cfg herein und speichern.
const LIMIT = 5000, KEEP = 300;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Liste neu schreiben: der zuletzt geänderte Song steht hinten, über KEEP fliegen die ältesten raus
function put(map, uri, v) {
  const out = { ...(map || {}) };
  delete out[uri];
  if (v !== undefined) out[uri] = v;
  const keys = Object.keys(out);
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete out[k];
  return out;
}
// aktueller Versatz dieses Songs in ms (0 = keiner)
function songOffsetOf(cfg, uri) {
  const v = cfg?.syncSongs?.[uri];
  return Number.isFinite(v) ? v : 0;
}
// um deltaMs verschieben (auf 10 ms gerundet, höchstens ±5 s) → neuer Versatz
function nudgeSongIn(cfg, uri, deltaMs) {
  if (!uri) return 0;
  const v = Math.max(-LIMIT, Math.min(LIMIT, Math.round((songOffsetOf(cfg, uri) + num(deltaMs)) / 10) * 10));
  cfg.syncSongs = put(cfg.syncSongs, uri, v || undefined);
  return v;
}
function resetSongIn(cfg, uri) {
  if (uri && cfg?.syncSongs && uri in cfg.syncSongs) cfg.syncSongs = put(cfg.syncSongs, uri, undefined);
  return 0;
}
// Abgleich mit dem Gesang (lyricsync.js) für diesen Song an/aus
const autoSyncOffIn = (cfg, uri) => !!cfg?.syncNoAuto?.[uri];
function setAutoSyncIn(cfg, uri, on) {
  if (!uri) return;
  cfg.syncNoAuto = put(cfg.syncNoAuto, uri, on ? undefined : true);
}

export { songOffsetOf, nudgeSongIn, resetSongIn, autoSyncOffIn, setAutoSyncIn, LIMIT };
