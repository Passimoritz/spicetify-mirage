import { S, seek, VERSION } from "./core.js";
import { getLyrics } from "./lyrics.js";
import { bands } from "./audio.js";
import { LANG } from "./i18n.js";
import { palette } from "./color.js";
import { currentItem, covers, titleOf, artistOf } from "./player.js";
import { domReport } from "./pages.js";
import { isFading } from "./controls.js";

/* ---------------------------------------------------------------- Brücke zur Overlay-App */
// Die Mirage-Overlay-App lauscht lokal; ohne App versucht das Theme es still alle 5 s erneut.
const bridge = (() => {
  const ADDR = "ws://127.0.0.1:47321";
  let ws = null, retry = 0, wanted = false;
  function connect() {
    wanted = true;
    if (ws && ws.readyState <= 1) return;
    try {
      ws = new WebSocket(ADDR);
    } catch {
      return schedule();
    }
    const sock = ws;
    ws.onopen = () => {
      if (ws !== sock) return;
      sendTrack();
      watchVolume(true);
    };
    ws.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      watchVolume(false);
      setTopics([]);
      schedule();
    };
    ws.onerror = () => {};
    ws.onmessage = (e) => {
      if (ws !== sock) return;
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.type !== "cmd") return;
      if (m.cmd === "toggle") S.Player.togglePlay();
      else if (m.cmd === "next") S.Player.next();
      else if (m.cmd === "prev") S.Player.back();
      else if (m.cmd === "hello") sendTrack();
      else if (m.cmd === "subscribe") setTopics(Array.isArray(m.topics) ? m.topics : []);
      else if (m.cmd === "report") {
        // Version und Lautstärke-Quellen mitschicken: so lässt sich aus dem Bericht ablesen, was läuft
        send({ type: "debug-start", hidden: document.hidden, version: VERSION, vol: {
          api: typeof S.Player.getVolume?.(), pb: typeof S.Platform?.PlaybackAPI?._volume, read: readVolume(),
        } });
        domReport();
      }
    };
  }
  function schedule() {
    clearTimeout(retry);
    if (wanted) retry = setTimeout(connect, 5000);
  }
  function close() {
    wanted = false;
    clearTimeout(retry);
    setTopics([]);
    watchVolume(false);
    try { ws?.close(); } catch {}
    ws = null;
  }

  // Lautstärke: Spotify meldet Änderungen nicht, also leise nachsehen (nur solange die App verbunden ist).
  // Während der Schlaf-Timer ausblendet, nichts senden – sonst stünde die Leiste minutenlang da.
  let volTimer = 0, lastVol = null;
  // Je nach Spotify-Version liefert getVolume() nichts – dann Spotifys PlaybackAPI, zuletzt der Regler selbst
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null);
  function readVolume() {
    let v = num(S.Player.getVolume?.());
    if (v === null) v = num(S.Platform?.PlaybackAPI?._volume);
    if (v === null) {
      const bar = document.querySelector('[data-testid="volume-bar"] [style*="--progress-bar-transform"]');
      const m = bar && /(-?[\d.]+)%/.exec(bar.style.getPropertyValue("--progress-bar-transform"));
      if (m) v = num(Number(m[1]) / 100);
    }
    return v;
  }
  function watchVolume(on) {
    clearInterval(volTimer);
    lastVol = null;
    if (!on) return;
    volTimer = setInterval(() => {
      const v = readVolume();
      if (v === null) return;
      const muted = !!S.Player.getMute?.() || v === 0;
      const key = Math.round(v * 100) + (muted ? "m" : "");
      if (lastVol !== null && key !== lastVol && !isFading()) send({ type: "volume", value: v, muted });
      lastVol = key;
    }, 250);
  }

  // Liedzeile und Pegel nur, wenn der Overlay-Stil sie braucht (Stil „Lyrics“ / „Visualizer“)
  let topics = new Set(), lyricTimer = 0, levelTimer = 0, lastLine = "";
  function setTopics(list) {
    topics = new Set(list.filter((x) => x === "lyric" || x === "level"));
    clearInterval(lyricTimer);
    clearInterval(levelTimer);
    lastLine = "";
    if (topics.has("lyric")) lyricTimer = setInterval(pushLyric, 250);
    if (topics.has("level")) levelTimer = setInterval(pushLevel, 66);
  }
  async function pushLyric() {
    const uri = currentItem()?.uri || "";
    const lyr = await getLyrics(uri);
    const lines = lyr?.synced ? lyr.lines : null;
    const i = lines ? seek(lines, S.Player.getProgress?.() || 0, "t") : -1;
    const text = i >= 0 && lines[i].text !== "♪" ? lines[i].text : "";
    const key = uri + "|" + i;
    if (key === lastLine) return;
    lastLine = key;
    send({ type: "lyric", uri, index: i, text, next: lines?.[i + 1]?.text?.replace("♪", "") || "" });
  }
  function pushLevel() {
    if (!S.Player.isPlaying()) return;
    const b = bands((S.Player.getProgress?.() || 0) / 1000);
    if (b) send({ type: "level", bands: b });
  }
  function sendTrack(changed) {
    const item = currentItem();
    if (!item || ws?.readyState !== 1) return;
    const c = covers(item);
    ws.send(
      JSON.stringify({
        type: "track",
        changed: !!changed,
        uri: item.uri,
        title: titleOf(item),
        artist: artistOf(item),
        album: item.album?.name || item.metadata?.album_title || "",
        cover: c.big || c.small,
        colors: palette().map((x) => `rgb(${x.join(",")})`),
        duration: S.Player.getDuration?.() || 0,
        progress: S.Player.getProgress?.() || 0,
        playing: !!S.Player.isPlaying(),
        lang: LANG,
      })
    );
  }
  const send = (obj) => ws?.readyState === 1 && ws.send(JSON.stringify(obj));
  return { connect, close, sendTrack, send, connected: () => ws?.readyState === 1 };
})();

export { bridge };
