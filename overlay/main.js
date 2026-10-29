// Mirage Overlay – zeigt Songansagen des Spicetify-Themes Mirage außerhalb von Spotify.
// Spotify (theme.js) verbindet sich per WebSocket auf 127.0.0.1:47321 und meldet jeden Song.
// Läuft auf Windows, macOS und Linux; plattformabhängige Stellen sind mit WIN / MAC / LINUX markiert.
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { WebSocketServer } = require("ws");
const { make } = require("./i18n");

const WIN = process.platform === "win32";
const MAC = process.platform === "darwin";
const LINUX = process.platform === "linux";

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// LINUX: durchsichtige Fenster brauchen einen Compositor und diesen Schalter. Bleibt das Overlay
// schwarz hinterlegt, hilft der Start ohne GPU (start.sh --no-gpu oder MIRAGE_NO_GPU=1).
if (LINUX) {
  app.commandLine.appendSwitch("enable-transparent-visuals");
  if (process.env.MIRAGE_NO_GPU || process.argv.includes("--no-gpu")) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch("disable-gpu-compositing");
  }
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
  style: "island", // island | card | banner | minimal | lyrics | visualizer
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
// welche Zusatzdaten ein Stil vom Theme braucht (Protokoll: cmd "subscribe")
const STYLE_TOPICS = { lyrics: ["lyric"], visualizer: ["level"] };

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
let track = null, lastPlaying = null, lastShow = 0, lyric = null, pointerT = 0;
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
function payload(reason, sample) {
  return {
    track, cfg, reason,
    lyric: sample ? SAMPLE_LYRIC : lyric && lyric.uri === track?.uri ? lyric : null,
    text: { nowPlaying: t("nowPlaying"), paused: t("paused"), resumed: t("resumed") },
  };
}
function announce(reason, force, sample) {
  if (!overlay || !track) return;
  if (!force && (cfg.mode === "off" || inQuiet())) return;
  position();
  lastShow = Date.now();
  overlay.webContents.send("show", payload(reason, sample));
  overlay.showInactive();
  // WIN/MAC: Ebene „screen-saver“ liegt auch über Vollbild-Apps; LINUX: Fenstermanager entscheidet
  overlay.setAlwaysOnTop(true, "screen-saver");
  if (!WIN) overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  watchPointer();
}
function hideOverlay() {
  overlay?.webContents.send("hideNow");
}

// LINUX: setIgnoreMouseEvents kennt dort kein „forward“, das Overlay erfährt also nicht, wann die
// Maus darüber ist. Solange es sichtbar ist, wird der Mauszeiger deshalb hier abgefragt.
function watchPointer() {
  if (!LINUX || pointerT) return;
  pointerT = setInterval(() => {
    if (!overlay?.isVisible()) {
      clearInterval(pointerT);
      pointerT = 0;
      return;
    }
    const p = screen.getCursorScreenPoint(), b = overlay.getBounds();
    const inside = p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height;
    overlay.webContents.send("pointer", inside ? { x: p.x - b.x, y: p.y - b.y } : null);
  }, 120);
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
function onLyric(m) {
  lyric = { uri: String(m.uri || ""), index: Number(m.index) || 0, text: String(m.text || ""), next: String(m.next || "") };
  overlay?.webContents.send("lyric", lyric);
}
function onLevel(m) {
  if (!Array.isArray(m.bands) || !overlay?.isVisible()) return;
  overlay.webContents.send("level", m.bands.slice(0, 8).map((x) => Math.max(0, Math.min(1, Number(x) || 0))));
}

/* ------------------------------------------------------------------ Verbindung zu Spotify */
function startServer() {
  const wss = new WebSocketServer({
    host: "127.0.0.1",
    port: PORT,
    // nur Spotify (xpui) oder lokale Programme ohne Browser-Herkunft
    verifyClient: ({ origin }) => !origin || /^https:\/\/xpui\.app\.spotify\.com$/i.test(origin),
    maxPayload: 1024 * 1024,
  });
  wss.on("connection", (ws) => {
    clients.add(ws);
    settingsWin?.webContents.send("status", status());
    ws.send(JSON.stringify({ type: "cmd", cmd: "hello" }));
    ws.send(JSON.stringify({ type: "cmd", cmd: "report" }));
    // Liedtext/Pegel nur anfordern, wenn der gewählte Stil sie anzeigt
    if (topics().length) ws.send(JSON.stringify({ type: "cmd", cmd: "subscribe", topics: topics() }));
    ws.on("message", (raw) => {
      if (process.env.MIRAGE_LOG) {
        try { fs.appendFileSync(path.join(app.getPath("userData"), "msg-log.txt"), `${new Date().toISOString()} ${String(raw).length} ${String(raw).slice(0, 120)}\n`); } catch {}
      }
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (m.type === "track") onTrack(m);
      else if (m.type === "lyric") onLyric(m);
      else if (m.type === "level") onLevel(m);
      // Diagnosebericht des Themes (Seitenaufbau, Fehler) lokal ablegen
      else if (m.type === "debug") {
        try {
          fs.writeFileSync(path.join(app.getPath("userData"), `dom-report${m.phase ? "-" + m.phase : ""}.json`), JSON.stringify(m, null, 1));
        } catch {}
      }
    });
    ws.on("close", () => {
      clients.delete(ws);
      settingsWin?.webContents.send("status", status());
    });
  });
  wss.on("error", () => {});
}
function send(msg) {
  for (const ws of clients) if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function command(cmd) {
  send({ type: "cmd", cmd });
}
const status = () => ({ connected: clients.size > 0, track });

// Abo beim Theme: nur bei Stilen mit Liedtext/Pegel und nicht, wenn das Overlay aus ist
const topics = () => (cfg.mode === "off" ? [] : STYLE_TOPICS[cfg.style] || []);
let subscribed = "[]";
function resubscribe() {
  const now = JSON.stringify(topics());
  if (now === subscribed) return;
  subscribed = now;
  send({ type: "cmd", cmd: "subscribe", topics: topics() });
}

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
    // MAC: als Panel schwebt das Fenster auch über Apps im Vollbild
    ...(MAC ? { type: "panel" } : {}),
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // was vor dem Laden der Seite schon von Spotify kam, sonst ginge es verloren
  overlay.webContents.on("did-finish-load", () => {
    if (!track) return;
    if (cfg.mode === "always") announce("update");
    else overlay.webContents.send("update", payload("update"));
  });
  overlay.loadFile("overlay.html");
}

function openSettings() {
  if (settingsWin) {
    settingsWin.show();
    settingsWin.focus();
    if (MAC) app.focus({ steal: true });
    return;
  }
  settingsWin = new BrowserWindow({
    width: 860,
    height: 760,
    minWidth: 640,
    minHeight: 560,
    title: "Mirage Overlay",
    backgroundColor: "#07060c",
    // MAC: Ampelknöpfe links im Kopfbereich; WIN/LINUX: eingeblendete Fensterknöpfe rechts
    ...(MAC
      ? { titleBarStyle: "hiddenInset" }
      : { titleBarStyle: "hidden", titleBarOverlay: { color: "#07060c", symbolColor: "#e9e4ff", height: 44 } }),
    icon: trayIcon(64),
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  settingsWin.setMenu(null);
  settingsWin.loadFile("settings.html");
  settingsWin.on("closed", () => (settingsWin = null));
  if (MAC) app.focus({ steal: true });
}

/* ------------------------------------------------------------------ Tray */
// Symbol wird gezeichnet statt mitgeliefert: leuchtender Ring im Mirage-Violett
// (MAC: schwarze Vorlage, die macOS selbst hell/dunkel einfärbt)
function ringBitmap(size, mono) {
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
      buf[i] = mono ? 0 : Math.round(255 * (0.75 + 0.25 * mix)); // B
      buf[i + 1] = mono ? 0 : Math.round(120 + 90 * (1 - mix)); // G
      buf[i + 2] = mono ? 0 : Math.round(150 + 80 * mix); // R
      buf[i + 3] = Math.round(255 * Math.min(1, a * 1.2));
    }
  return buf;
}
function trayIcon(size) {
  return nativeImage.createFromBitmap(ringBitmap(size, false), { width: size, height: size });
}
function trayImage() {
  if (MAC) {
    // 16 pt Menüleistensymbol mit @2x-Variante für Retina
    const img = nativeImage.createEmpty();
    for (const scaleFactor of [1, 2]) {
      const px = 16 * scaleFactor;
      img.addRepresentation({ scaleFactor, width: px, height: px, buffer: ringBitmap(px, true) });
    }
    img.setTemplateImage(true);
    return img;
  }
  if (LINUX) {
    // AppIndicator/StatusNotifier lädt Symbole am zuverlässigsten als PNG-Datei
    const png = path.join(app.getPath("userData"), "tray.png");
    try {
      fs.mkdirSync(path.dirname(png), { recursive: true });
      fs.writeFileSync(png, trayIcon(24).toPNG());
      return png;
    } catch {
      return trayIcon(24);
    }
  }
  return trayIcon(32);
}
function buildTray() {
  if (!tray) {
    tray = new Tray(trayImage());
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

/* ------------------------------------------------------------------ Autostart */
// Aufruf, mit dem das Overlay beim Anmelden still startet (ungepackt: electron + App-Ordner)
const launchArgs = () => [...(process.defaultApp ? [path.resolve(__dirname)] : []), "--hidden"];
const LAUNCH_AGENT = path.join(os.homedir(), "Library", "LaunchAgents", "com.mirage.overlay.plist");
const DESKTOP_FILE = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "autostart", "mirage-overlay.desktop");

function setAutostart(on) {
  if (WIN || (MAC && !process.defaultApp)) {
    // MAC (gepackt): Anmeldeobjekt ohne Argumente – der stille Start wird über wasOpenedAtLogin erkannt
    return app.setLoginItemSettings({ openAtLogin: on, args: launchArgs() });
  }
  if (MAC) {
    // ungepackt würde das Anmeldeobjekt nur das nackte Electron öffnen – daher ein LaunchAgent
    const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.mirage.overlay</string>
  <key>ProgramArguments</key>
  <array>${[process.execPath, ...launchArgs()].map((a) => `<string>${xml(a)}</string>`).join("")}</array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`;
    return writeOrRemove(LAUNCH_AGENT, on && plist);
  }
  if (LINUX) {
    // XDG-Autostart: Desktop-Umgebungen starten alles aus ~/.config/autostart
    const q = (s) => `"${String(s).replace(/(["`$\\])/g, "\\$1")}"`;
    const desktop = `[Desktop Entry]
Type=Application
Name=Mirage Overlay
Comment=Song announcements for the Mirage Spicetify theme
Exec=${[process.execPath, ...launchArgs()].map(q).join(" ")}
Terminal=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
`;
    return writeOrRemove(DESKTOP_FILE, on && desktop);
  }
}
function writeOrRemove(target, content) {
  try {
    if (content) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    } else fs.rmSync(target, { force: true });
  } catch {}
}
function startedHidden() {
  if (process.argv.includes("--hidden")) return true;
  if (MAC && !process.defaultApp) {
    try { return !!app.getLoginItemSettings().wasOpenedAtLogin; } catch {}
  }
  return false;
}

/* ------------------------------------------------------------------ Einstellungen */
function update(patch) {
  cfg = { ...cfg, ...patch };
  save();
  if ("autostart" in patch) setAutostart(!!cfg.autostart);
  if ("mode" in patch) buildTray();
  if ("style" in patch || "mode" in patch) resubscribe();
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
const SAMPLE_LYRIC = { uri: "preview", index: 0, text: "Neon rivers on a glass horizon", next: "we follow lights we cannot hold" };
function preview() {
  const keep = track;
  if (!track) track = { ...SAMPLE, uri: "preview" };
  announce("song", true, !keep);
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
// ein „fertig“ kurz nach einer neuen Ansage stammt noch von der alten – ignorieren
ipcMain.on("done", () => cfg.mode !== "always" && Date.now() - lastShow > 1200 && overlay?.hide());

/* ------------------------------------------------------------------ Start */
app.on("second-instance", openSettings);
app.on("activate", openSettings); // MAC: erneutes Öffnen aus Finder/Launchpad
app.on("window-all-closed", () => {}); // im Infobereich weiterlaufen
app.whenReady().then(() => {
  if (WIN) app.setAppUserModelId("Mirage Overlay");
  if (MAC) app.dock?.hide(); // nur in der Menüleiste, kein Dock-Symbol
  load();
  subscribed = JSON.stringify(topics());
  t = make(app.getLocale());
  // LINUX: ohne kurze Pause bekommt das erste Fenster manchmal keinen durchsichtigen Hintergrund
  if (LINUX) setTimeout(createOverlay, 300);
  else createOverlay();
  buildTray();
  startServer();
  screen.on("display-removed", () => overlay?.isVisible() && position());
  screen.on("display-metrics-changed", () => overlay?.isVisible() && position());
  // Beim ersten Start (oder ohne Autostart-Aufruf) gleich die Einstellungen zeigen
  if (!startedHidden()) openSettings();
});
