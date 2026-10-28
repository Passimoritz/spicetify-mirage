// Mirage Overlay – zeigt Songansagen des Spicetify-Themes Mirage außerhalb von Spotify.
// Spotify (theme.js) verbindet sich per WebSocket auf 127.0.0.1:47321 und meldet jeden Song.
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const { WebSocketServer } = require("ws");
const { make } = require("./i18n");

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const PORT = 47321;
const BASE_W = 600;
const BASE_H = 240;
const DEFAULTS = {
  mode: "song", // song | always | off
  duration: 6,
  onPlayPause: false,
  quietOn: false,
  quietFrom: "22:00",
  quietTo: "07:00",
  display: "primary", // primary | cursor | <display id>
  anchor: "top-center", // top|middle|bottom - left|center|right
  offsetX: 0,
  offsetY: 24,
  style: "island", // island | card | banner | minimal
  motion: "spring", // spring | slide | fade
  scale: 100,
  opacity: 100,
  interactive: true,
  progress: true,
  showKicker: true,
  showAlbum: false,
  showTime: false,
  background: "cover", // cover | dark | light
  glow: 80,
  roundness: 100,
  autostart: false,
};

const file = () => path.join(app.getPath("userData"), "settings.json");
let cfg = { ...DEFAULTS };
function load() {
  try {
    cfg = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), "utf8")) };
  } catch {}
}
function save() {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(cfg, null, 2));
  } catch {}
}

let overlay = null, settingsWin = null, tray = null;
let track = null, lastPlaying = null;
let t = make("en");
const clients = new Set();

/* ------------------------------------------------------------------ Bildschirm + Lage */
function pickDisplay() {
  if (cfg.display === "cursor") return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  if (cfg.display !== "primary") {
    const d = screen.getAllDisplays().find((x) => String(x.id) === String(cfg.display));
    if (d) return d;
  }
  return screen.getPrimaryDisplay();
}
function position() {
  const wa = pickDisplay().workArea;
  const s = cfg.scale / 100;
  const W = Math.round(BASE_W * s), H = Math.round(BASE_H * s);
  const [v, h] = cfg.anchor.split("-");
  const x = h === "left" ? wa.x + cfg.offsetX : h === "right" ? wa.x + wa.width - W - cfg.offsetX : wa.x + (wa.width - W) / 2 + cfg.offsetX;
  const y = v === "top" ? wa.y + cfg.offsetY : v === "bottom" ? wa.y + wa.height - H - cfg.offsetY : wa.y + (wa.height - H) / 2 + cfg.offsetY;
  overlay.setBounds({ x: Math.round(x), y: Math.round(y), width: W, height: H });
}

function minutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function inQuiet() {
  if (!cfg.quietOn) return false;
  const d = new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  const a = minutes(cfg.quietFrom), b = minutes(cfg.quietTo);
  return a <= b ? now >= a && now < b : now >= a || now < b; // über Mitternacht
}

/* ------------------------------------------------------------------ Anzeigen */
function payload(reason) {
  return { track, cfg, reason, text: { nowPlaying: t("nowPlaying"), paused: t("paused"), resumed: t("resumed") } };
}
function announce(reason, force) {
  if (!overlay || !track) return;
  if (!force && (cfg.mode === "off" || inQuiet())) return;
  position();
  overlay.webContents.send("show", payload(reason));
  overlay.showInactive();
  overlay.setAlwaysOnTop(true, "screen-saver");
}
function hideOverlay() {
  overlay?.webContents.send("hideNow");
}

function onTrack(msg) {
  if (msg.lang && make(msg.lang).lang !== t.lang) {
    t = make(msg.lang);
    buildTray();
    settingsWin?.webContents.send("lang", msg.lang);
  }
  const prev = track;
  track = msg;
  const playChanged = lastPlaying !== null && lastPlaying !== msg.playing;
  lastPlaying = msg.playing;
  settingsWin?.webContents.send("status", status());
  if (cfg.mode === "always") return announce(prev?.uri === msg.uri ? "update" : "song");
  if (msg.changed || (prev && prev.uri !== msg.uri)) return announce("song");
  if (cfg.onPlayPause && playChanged) return announce(msg.playing ? "resumed" : "paused");
  overlay?.webContents.send("update", payload("update"));
}

/* ------------------------------------------------------------------ Verbindung zu Spotify */
function startServer() {
  const wss = new WebSocketServer({
    host: "127.0.0.1",
    port: PORT,
    // nur Spotify (xpui) oder lokale Programme ohne Browser-Herkunft
    verifyClient: ({ origin }) => !origin || /spotify|^file:|^app:/i.test(origin),
  });
  wss.on("connection", (ws) => {
    clients.add(ws);
    settingsWin?.webContents.send("status", status());
    ws.send(JSON.stringify({ type: "cmd", cmd: "hello" }));
    ws.on("message", (raw) => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (m.type === "track") onTrack(m);
    });
    ws.on("close", () => {
      clients.delete(ws);
      settingsWin?.webContents.send("status", status());
    });
  });
  wss.on("error", () => {});
}
function command(cmd) {
  for (const ws of clients) if (ws.readyState === 1) ws.send(JSON.stringify({ type: "cmd", cmd }));
}
const status = () => ({ connected: clients.size > 0, track });

/* ------------------------------------------------------------------ Fenster */
function createOverlay() {
  overlay = new BrowserWindow({
    width: BASE_W,
    height: BASE_H,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    webPreferences: { preload: path.join(__dirname, "preload.js"), backgroundThrottling: false },
  });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile("overlay.html");
}

function openSettings() {
  if (settingsWin) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 860,
    height: 760,
    minWidth: 640,
    minHeight: 560,
    title: "Mirage Overlay",
    backgroundColor: "#07060c",
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#07060c", symbolColor: "#e9e4ff", height: 44 },
    icon: trayIcon(64),
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  settingsWin.setMenu(null);
  settingsWin.loadFile("settings.html");
  settingsWin.on("closed", () => (settingsWin = null));
}

/* ------------------------------------------------------------------ Tray */
// Symbol wird gezeichnet statt mitgeliefert: leuchtender Ring im Mirage-Violett
function trayIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2, R = size * 0.42, w = size * 0.13;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const ring = 1 - Math.min(1, Math.abs(d - R) / w);
      const core = Math.max(0, 1 - d / (R * 0.45));
      const a = Math.max(ring, core * 0.9);
      const ang = Math.atan2(y - c, x - c);
      const mix = (Math.sin(ang) + 1) / 2;
      const i = (y * size + x) * 4;
      buf[i] = Math.round(255 * (0.75 + 0.25 * mix)); // B
      buf[i + 1] = Math.round(120 + 90 * (1 - mix)); // G
      buf[i + 2] = Math.round(150 + 80 * mix); // R
      buf[i + 3] = Math.round(255 * Math.min(1, a * 1.2));
    }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}
function buildTray() {
  if (!tray) {
    tray = new Tray(trayIcon(32));
    tray.on("double-click", openSettings);
  }
  tray.setToolTip("Mirage Overlay");
  const radio = (mode, label) => ({
    label,
    type: "radio",
    checked: cfg.mode === mode,
    click: () => update({ mode }),
  });
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t("settings"), click: openSettings },
      { label: t("test"), click: () => preview() },
      { type: "separator" },
      radio("song", t("modeSong")),
      radio("always", t("modeAlways")),
      radio("off", t("modeOff")),
      { type: "separator" },
      { label: t("quit"), click: () => app.quit() },
    ])
  );
}

/* ------------------------------------------------------------------ Einstellungen */
function update(patch) {
  cfg = { ...cfg, ...patch };
  save();
  if ("autostart" in patch)
    app.setLoginItemSettings({
      openAtLogin: !!cfg.autostart,
      args: [...(process.defaultApp ? [path.resolve(__dirname)] : []), "--hidden"],
    });
  if ("mode" in patch) buildTray();
  if (cfg.mode === "off") hideOverlay();
  else if (cfg.mode === "always" && track) announce("update");
  overlay?.webContents.send("config", cfg);
  if (overlay?.isVisible()) position();
  settingsWin?.webContents.send("cfg", cfg);
}
const SAMPLE = {
  title: "Midnight Mirage",
  artist: "Aurora Lights",
  album: "Glass Horizons",
  cover: "",
  colors: ["rgb(182,156,255)", "rgb(124,92,255)", "rgb(230,222,255)"],
  duration: 214000,
  progress: 61000,
  playing: true,
};
function preview() {
  const keep = track;
  if (!track) track = { ...SAMPLE, uri: "preview" };
  announce("song", true);
  track = keep;
}

ipcMain.handle("get", () => ({
  cfg,
  status: status(),
  lang: t.lang,
  displays: screen.getAllDisplays().map((d, i) => ({
    id: String(d.id),
    n: i + 1,
    bounds: d.bounds,
    scale: d.scaleFactor,
    primary: d.id === screen.getPrimaryDisplay().id,
    label: d.label || "",
  })),
}));
ipcMain.on("set", (_e, patch) => update(patch));
ipcMain.on("preview", preview);
ipcMain.on("cmd", (_e, c) => command(c));
ipcMain.on("hover", (_e, on) => overlay?.setIgnoreMouseEvents(!on, { forward: true }));
ipcMain.on("done", () => cfg.mode !== "always" && overlay?.hide());

/* ------------------------------------------------------------------ Start */
app.on("second-instance", openSettings);
app.on("window-all-closed", () => {}); // im Infobereich weiterlaufen
app.whenReady().then(() => {
  app.setAppUserModelId("Mirage Overlay");
  load();
  t = make(app.getLocale());
  createOverlay();
  buildTray();
  startServer();
  screen.on("display-removed", () => overlay?.isVisible() && position());
  screen.on("display-metrics-changed", () => overlay?.isVisible() && position());
  // Beim ersten Start (oder ohne Autostart-Aufruf) gleich die Einstellungen zeigen
  if (!process.argv.includes("--hidden")) openSettings();
});
