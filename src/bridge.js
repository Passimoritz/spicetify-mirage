import { S, seek } from "./core.js";
import { getLyrics } from "./lyrics.js";
import { bands } from "./audio.js";
import { LANG } from "./i18n.js";
import { palette } from "./color.js";
import { currentItem, covers, titleOf, artistOf } from "./player.js";
import { domReport } from "./pages.js";

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
    ws.onopen = () => ws === sock && sendTrack();
    ws.onclose = () => {
      if (ws !== sock) return;
      ws = null;
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
        send({ type: "debug-start", hidden: document.hidden });
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
    try { ws?.close(); } catch {}
    ws = null;
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
  return { connect, close, sendTrack, send };
})();

export { bridge };
