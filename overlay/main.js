// Mirage Overlay – zeigt Songansagen des Spicetify-Themes Mirage außerhalb von Spotify.
// Spotify (theme.js) verbindet sich per WebSocket auf 127.0.0.1:47321 und meldet jeden Song.
// Läuft auf Windows, macOS und Linux; plattformabhängige Stellen sind mit WIN / MAC / LINUX markiert.
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, shell, dialog, Notification, net } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const { spawn } = require("child_process");
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

// MIRAGE_PORT / MIRAGE_OBS_PORT: nur zum Testen neben einer laufenden Installation
const PORT = Number(process.env.MIRAGE_PORT) || 47321;
const BASE_W = 600;
const BASE_H = 240;
// Rand rund um die Karte, damit ihr Schatten nie am Fensterrand abgeschnitten wird
// (die Schatten reichen bis ~75 px nach unten und ~45 px zur Seite). Das Fenster wird um diesen
// Rand größer und so verschoben, dass die Karte selbst genau dort bleibt, wo sie vorher war.
// Muss zu --shadow in overlay.html passen.
const SHADOW = 90;
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
  volumeOsd: true,
  fullscreenQuiet: true,
  autoUpdate: true,
  obs: false,
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

// Alles, was das Overlay-Fenster bekommt, bekommt auch eine offene OBS-Browserquelle
function toOverlay(ch, data) {
  overlay?.webContents.send(ch, data);
  obsSend(ch, data);
}

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
  const M = Math.round(SHADOW * s);
  const W = Math.round(BASE_W * s) + 2 * M, H = Math.round(BASE_H * s) + 2 * M;
  const [v, h] = cfg.anchor.split("-");
  // am Rand verankert: der Schattenrand darf über den Arbeitsbereich hinausragen, die Karte nicht
  const x = h === "left" ? wa.x + cfg.offsetX - M : h === "right" ? wa.x + wa.width - W - cfg.offsetX + M : wa.x + (wa.width - W) / 2 + cfg.offsetX;
  const y = v === "top" ? wa.y + cfg.offsetY - M : v === "bottom" ? wa.y + wa.height - H - cfg.offsetY + M : wa.y + (wa.height - H) / 2 + cfg.offsetY;
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
  if (!force && (cfg.mode === "off" || inQuiet() || busy)) return;
  position();
  lastShow = Date.now();
  toOverlay("show", payload(reason, sample));
  overlay.showInactive();
  // WIN/MAC: Ebene „screen-saver“ liegt auch über Vollbild-Apps; LINUX: Fenstermanager entscheidet
  overlay.setAlwaysOnTop(true, "screen-saver");
  if (!WIN) overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  watchPointer();
}
function hideOverlay() {
  toOverlay("hideNow");
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
  toOverlay("update", payload("update"));
}
function onLyric(m) {
  lyric = { uri: String(m.uri || ""), index: Number(m.index) || 0, text: String(m.text || ""), next: String(m.next || "") };
  toOverlay("lyric", lyric);
}
function onLevel(m) {
  if (!Array.isArray(m.bands) || (!overlay?.isVisible() && !obsClients.size)) return;
  toOverlay("level", m.bands.slice(0, 8).map((x) => Math.max(0, Math.min(1, Number(x) || 0))));
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
      else if (m.type === "volume") showVolume(m);
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
    width: BASE_W + 2 * SHADOW,
    height: BASE_H + 2 * SHADOW,
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
    overlay.webContents.send("css", readCss());
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
      ...(upd.state === "available" || upd.state === "ready" ? [{ label: t("updateInstall").replace("{v}", upd.version), click: installUpdate }, { type: "separator" }] : []),
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
Exec=${[process.env.APPIMAGE || process.execPath, ...launchArgs()].map(q).join(" ")}
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

/* ------------------------------------------------------------------ Lautstärke-Anzeige */
// Eigenes kleines Fenster unten in der Mitte, damit es nie mit einer laufenden Ansage kollidiert
const VOL_W = 300, VOL_H = 64, VOL_M = 40;
let volWin = null, volT = 0;
function showVolume(m) {
  if (!cfg.volumeOsd || cfg.mode === "off" || busy) return;
  const value = Math.max(0, Math.min(1, Number(m.value) || 0));
  if (!volWin) {
    volWin = new BrowserWindow({
      width: VOL_W + 2 * VOL_M, height: VOL_H + 2 * VOL_M, show: false, frame: false, transparent: true,
      resizable: false, movable: false, focusable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true,
      backgroundColor: "#00000000", ...(MAC ? { type: "panel" } : {}),
      webPreferences: { preload: path.join(__dirname, "preload.js") },
    });
    volWin.setIgnoreMouseEvents(true);
    volWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    volWin.loadFile("volume.html");
    volWin.on("closed", () => (volWin = null));
  }
  const wa = pickDisplay().workArea;
  const W = VOL_W + 2 * VOL_M, H = VOL_H + 2 * VOL_M;
  volWin.setBounds({ x: Math.round(wa.x + (wa.width - W) / 2), y: Math.round(wa.y + wa.height - H - 40 + VOL_M), width: W, height: H });
  const data = { value, muted: !!m.muted, colors: track?.colors || [] };
  const go = () => {
    volWin.webContents.send("vol", data);
    volWin.showInactive();
    volWin.setAlwaysOnTop(true, "screen-saver");
  };
  if (volWin.webContents.isLoading()) volWin.webContents.once("did-finish-load", go);
  else go();
  clearTimeout(volT);
  volT = setTimeout(() => volWin?.webContents.send("volHide"), 1400);
}
ipcMain.on("volDone", () => volWin?.hide());

/* ------------------------------------------------------------------ Ruhig bei Vollbild */
// WIN: Windows meldet selbst, wann ein Programm im Vollbild läuft (dieselbe Abfrage, mit der es
// seine eigenen Benachrichtigungen zurückhält) – ein kleines PowerShell-Skript fragt sie alle 1,5 s ab.
// LINUX: _NET_WM_STATE des aktiven Fensters über xprop (nur X11, falls installiert).
// MAC: ohne eigenen nativen Code nicht zuverlässig abfragbar – die Option ist dort ausgeblendet.
let busy = false, busyProc = null, busyT = 0;
function setBusy(on) {
  if (on === busy) return;
  busy = on;
  if (busy) {
    hideOverlay();
    volWin?.hide();
  } else if (cfg.mode === "always" && track) announce("update");
}
const PS_BUSY = `Add-Type -Namespace M -Name Q -MemberDefinition '[DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int s);'
while ($true) { $s = 0; [void][M.Q]::SHQueryUserNotificationState([ref]$s); [Console]::Out.WriteLine($s); [Console]::Out.Flush(); Start-Sleep -Milliseconds 1500 }`;
function watchFullscreen() {
  const want = cfg.fullscreenQuiet && cfg.mode !== "off";
  if (!want) {
    busyProc?.kill();
    busyProc = null;
    clearInterval(busyT);
    busyT = 0;
    return setBusy(false);
  }
  if (WIN && !busyProc) {
    try {
      busyProc = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", PS_BUSY], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
      let buf = "";
      busyProc.stdout.on("data", (d) => {
        buf += d;
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        const last = Number(lines.filter(Boolean).pop());
        // 2 = Vollbild-Programm, 3 = Direct3D-Vollbild (Spiele), 4 = Präsentationsmodus
        if (!Number.isNaN(last)) setBusy(last >= 2 && last <= 4);
      });
      busyProc.on("exit", () => {
        busyProc = null;
        setBusy(false);
      });
    } catch {
      busyProc = null;
    }
  } else if (LINUX && !busyT) {
    busyT = setInterval(() => {
      const xp = spawn("sh", ["-c", "id=$(xprop -root _NET_ACTIVE_WINDOW | awk '{print $NF}'); xprop -id \"$id\" _NET_WM_STATE"], { stdio: ["ignore", "pipe", "ignore"] });
      let out = "";
      xp.stdout.on("data", (d) => (out += d));
      xp.on("error", () => {});
      xp.on("close", () => setBusy(/_NET_WM_STATE_FULLSCREEN/.test(out)));
    }, 2000);
  }
}

/* ------------------------------------------------------------------ Eigenes CSS */
// custom.css im Einstellungsordner wird nach dem eingebauten Stil geladen und überschreibt ihn.
// Änderungen wirken sofort (die Datei wird jede Sekunde auf Änderungen geprüft).
const cssFile = () => path.join(app.getPath("userData"), "custom.css");
const CSS_TEMPLATE = `/* Mirage Overlay – eigener Stil / your own style
   Wird nach dem eingebauten Stil geladen. Speichern genügt, das Overlay übernimmt es sofort.
   Loaded after the built-in style. Just save – the overlay picks it up right away.

   Nützliche Selektoren / useful selectors:
     .ov            die Karte / the card            .stage.st-island / .st-card / .st-banner / .st-lyrics / .st-visualizer / .st-minimal
     #ti #ar #al    Titel, Künstler, Album          #kick   Überschrift / heading      #cv  Cover
     :root { --a; --b; --c }  Farben aus dem Cover / cover colours
*/

/* Beispiel / example:
.ov { border-radius: 8px; }
#ti { letter-spacing: 0; }
*/
`;
function readCss() {
  try {
    return fs.readFileSync(cssFile(), "utf8").slice(0, 200000);
  } catch {
    return "";
  }
}
function watchCss() {
  fs.watchFile(cssFile(), { interval: 1000 }, () => toOverlay("css", readCss()));
}
function openCss() {
  try {
    if (!fs.existsSync(cssFile())) {
      fs.mkdirSync(path.dirname(cssFile()), { recursive: true });
      fs.writeFileSync(cssFile(), CSS_TEMPLATE);
    }
  } catch {}
  shell.openPath(cssFile());
}

/* ------------------------------------------------------------------ OBS-Browserquelle */
// http://127.0.0.1:47322 liefert overlay.html mit einer kleinen Brücke statt Electron:
// dieselben Nachrichten kommen per WebSocket. Nur lokal erreichbar, nur von der eigenen Seite.
const OBS_PORT = Number(process.env.MIRAGE_OBS_PORT) || 47322;
let obsServer = null;
const obsClients = new Set();
const OBS_SHIM = `window.mirage = (() => {
  const handlers = {};
  (function connect() {
    const ws = new WebSocket("ws://" + location.host + "/feed");
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data); (handlers[m.ch] || []).forEach((f) => f(m.data)); } catch {} };
    ws.onclose = () => setTimeout(connect, 2000);
  })();
  return { on: (c, f) => (handlers[c] ||= []).push(f), send: () => {}, get: async () => ({}), platform: "obs" };
})();
document.documentElement.classList.add("obs");`;
function obsSend(ch, data) {
  if (!obsClients.size) return;
  const msg = JSON.stringify({ ch, data });
  for (const c of obsClients) if (c.readyState === 1) c.send(msg);
}
function startObs() {
  if (obsServer || !cfg.obs) return;
  obsServer = http.createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];
    if (url === "/" || url === "/index.html") {
      let html = "";
      try { html = fs.readFileSync(path.join(__dirname, "overlay.html"), "utf8"); } catch {}
      html = html.replace("<script>", '<script src="/obs.js"></script>\n<script>');
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      return res.end(html);
    }
    if (url === "/obs.js") {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      return res.end(OBS_SHIM);
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({
    server: obsServer,
    path: "/feed",
    verifyClient: ({ origin }) => !origin || origin === `http://127.0.0.1:${OBS_PORT}` || origin === `http://localhost:${OBS_PORT}`,
  });
  wss.on("connection", (ws) => {
    obsClients.add(ws);
    ws.send(JSON.stringify({ ch: "css", data: readCss() }));
    ws.send(JSON.stringify({ ch: "config", data: cfg }));
    if (track) ws.send(JSON.stringify({ ch: cfg.mode === "always" ? "show" : "update", data: payload("update") }));
    ws.on("close", () => obsClients.delete(ws));
  });
  wss.on("error", () => {});
  obsServer.on("error", () => {
    obsServer = null;
  });
  obsServer.listen(OBS_PORT, "127.0.0.1");
}
function stopObs() {
  for (const c of obsClients) c.close();
  obsClients.clear();
  obsServer?.close();
  obsServer = null;
}
const obsUrl = () => `http://127.0.0.1:${OBS_PORT}/`;

/* ------------------------------------------------------------------ Updates */
// Fragt GitHub nach der neuesten Version. WIN: Installer laden, fragen, still installieren und neu
// starten. LINUX (AppImage): Datei ersetzen, fragen, neu starten. MAC und .deb: ohne Signatur kann
// sich die App dort nicht selbst ersetzen – es öffnet sich die Download-Seite.
const REPO = "Passimoritz/spicetify-mirage";
let upd = { state: "idle" }, updT = 0, notified = "";
const newer = (a, b) => {
  const x = String(a).replace(/^v/, "").split(".").map(Number), y = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
function setUpd(patch) {
  upd = { ...upd, ...patch };
  settingsWin?.webContents.send("upd", upd);
  buildTray();
}
async function checkUpdate(manual) {
  if (upd.state === "loading" || upd.state === "ready") return;
  setUpd({ state: "checking" });
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { "user-agent": "mirage-overlay", accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(String(res.status));
    const rel = await res.json();
    const version = String(rel.tag_name || "").replace(/^v/, "");
    const want = WIN ? "Mirage-Overlay-Setup.exe" : LINUX && process.env.APPIMAGE ? "Mirage-Overlay.AppImage" : "";
    const asset = (rel.assets || []).find((a) => a.name === want);
    if (!newer(version, app.getVersion())) return setUpd({ state: "current", version: app.getVersion() });
    setUpd({ state: "available", version, page: rel.html_url, asset: asset?.browser_download_url || "" });
    if (!manual && notified !== version && Notification.isSupported()) {
      notified = version;
      const n = new Notification({ title: t("updateAvail").replace("{v}", version), body: t("updateNotifyBody"), icon: trayIcon(64) });
      n.on("click", installUpdate);
      n.show();
    }
  } catch {
    setUpd({ state: "failed" });
  }
}
async function installUpdate() {
  if (upd.state === "ready") return askRestart();
  if (upd.state !== "available") return;
  if (!upd.asset) return shell.openExternal(upd.page || `https://github.com/${REPO}/releases/latest`);
  setUpd({ state: "loading" });
  try {
    const res = await net.fetch(upd.asset);
    if (!res.ok) throw new Error(String(res.status));
    const buf = Buffer.from(await res.arrayBuffer());
    if (WIN) {
      const file = path.join(os.tmpdir(), `Mirage-Overlay-Setup-${upd.version}.exe`);
      fs.writeFileSync(file, buf);
      setUpd({ state: "ready", file });
    } else {
      const target = process.env.APPIMAGE;
      fs.writeFileSync(target + ".new", buf, { mode: 0o755 });
      setUpd({ state: "ready", file: target + ".new" });
    }
    askRestart();
  } catch {
    setUpd({ state: "available" });
    shell.openExternal(upd.page || `https://github.com/${REPO}/releases/latest`);
  }
}
async function askRestart() {
  const { response } = await dialog.showMessageBox({
    type: "info",
    title: "Mirage Overlay",
    message: t("updateReady").replace("{v}", upd.version),
    buttons: [t("restartNow"), t("later")],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return;
  if (WIN) {
    // NSIS-Installer still ausführen; --force-run startet die neue Version danach selbst
    spawn(upd.file, ["/S", "--updated", "--force-run"], { detached: true, stdio: "ignore" }).unref();
    app.quit();
  } else {
    const target = process.env.APPIMAGE;
    try {
      fs.renameSync(upd.file, target);
    } catch {
      return shell.openExternal(upd.page);
    }
    app.relaunch({ execPath: target, args: process.argv.slice(1) });
    app.exit(0);
  }
}
function scheduleUpdates() {
  clearInterval(updT);
  if (!cfg.autoUpdate || process.defaultApp) return;
  setTimeout(() => checkUpdate(false), 15000);
  updT = setInterval(() => checkUpdate(false), 6 * 3600 * 1000);
}

/* ------------------------------------------------------------------ Einstellungen */
function update(patch) {
  cfg = { ...cfg, ...patch };
  save();
  if ("autostart" in patch) setAutostart(!!cfg.autostart);
  if ("mode" in patch) buildTray();
  if ("style" in patch || "mode" in patch) resubscribe();
  if ("fullscreenQuiet" in patch || "mode" in patch) watchFullscreen();
  if ("obs" in patch) cfg.obs ? startObs() : stopObs();
  if ("autoUpdate" in patch) scheduleUpdates();
  if (cfg.mode === "off") hideOverlay();
  else if (cfg.mode === "always" && track) announce("update");
  toOverlay("config", cfg);
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
  version: app.getVersion(),
  upd,
  obsUrl: obsUrl(),
  canUpdate: WIN || (LINUX && !!process.env.APPIMAGE),
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
ipcMain.on("openCss", openCss);
ipcMain.on("checkUpdate", () => (upd.state === "available" || upd.state === "ready" ? installUpdate() : checkUpdate(true)));
ipcMain.on("cmd", (_e, c) => command(c));
ipcMain.on("hover", (_e, on) => overlay?.setIgnoreMouseEvents(!on, { forward: true }));
// ein „fertig“ kurz nach einer neuen Ansage stammt noch von der alten – ignorieren
ipcMain.on("done", () => cfg.mode !== "always" && Date.now() - lastShow > 1200 && overlay?.hide());

/* ------------------------------------------------------------------ Start */
app.on("second-instance", openSettings);
app.on("activate", openSettings); // MAC: erneutes Öffnen aus Finder/Launchpad
app.on("window-all-closed", () => {}); // im Infobereich weiterlaufen
app.on("before-quit", () => busyProc?.kill());
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
  startObs();
  watchCss();
  watchFullscreen();
  scheduleUpdates();
  screen.on("display-removed", () => overlay?.isVisible() && position());
  screen.on("display-metrics-changed", () => overlay?.isVisible() && position());
  // Beim ersten Start (oder ohne Autostart-Aufruf) gleich die Einstellungen zeigen
  if (!startedHidden()) openSettings();
});
