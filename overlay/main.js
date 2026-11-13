// Mirage Overlay – zeigt Songansagen des Spicetify-Themes Mirage außerhalb von Spotify.
// Spotify (theme.js) verbindet sich per WebSocket auf 127.0.0.1:47321 und meldet jeden Song.
// Läuft auf Windows, macOS und Linux; plattformabhängige Stellen sind mit WIN / MAC / LINUX markiert.
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, shell, dialog, Notification, net, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const { spawn, execFile } = require("child_process");
const { WebSocketServer, WebSocket } = require("ws");
const { createLights } = require("./lights.js");
const { createSecrets, SECRET } = require("./secrets.js");
const { createCast } = require("./cast.js");
const { createPartyGuard } = require("./flashcap.js");
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
  style: "island", // island | card | banner | minimal | lyrics | visualizer | strip | bubble
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
  control: true,
  // Licht im Raum (Party-Modus)
  lightBright: 100,
  // Obergrenze in Prozent: heller wird keine Lampe
  lightMax: 100,
  // von der Show ausgenommen: Hue-Lampen („7“) und -Räume („g3“), HA-Lichter, OpenRGB-Geräte (Namensteil)
  hueExclude: "", haExclude: "", orgbExclude: "",
  // Vorlauf je Gerät in ms (Lampen hängen unterschiedlich weit hinterher); Hue je Bridge: „ip=ms, ip=ms“
  latHue: "", latWled: 0, latGovee: 0, latHa: 0, latOrgb: 0, latChroma: 0,
  hueOn: false, hueIp: "", hueUser: "", hueClientKey: "", hueGroup: "0",
  wledOn: false, wledIp: "", wledLeds: 60,
  orgbOn: false,
  chromaOn: false,
  goveeOn: false, goveeIps: "",
  haOn: false, haUrl: "", haToken: "", haEntities: "",
  // Einrichtungs-Assistent schon durchlaufen (oder übersprungen)?
  setupDone: false,
};
// welche Zusatzdaten ein Stil vom Theme braucht (Protokoll: cmd "subscribe")
const STYLE_TOPICS = { lyrics: ["lyric"], visualizer: ["level"] };
// Auswahlfelder mit festen Werten: ein Import darf nur diese übernehmen, sonst zerfiele z. B. die Lage
const CHOICES = {
  mode: ["song", "always", "off"],
  style: ["island", "card", "banner", "minimal", "lyrics", "visualizer", "strip", "bubble"],
  motion: ["spring", "slide", "fade"],
  background: ["cover", "dark", "light"],
  anchor: ["top", "middle", "bottom"].flatMap((v) => ["left", "center", "right"].map((h) => `${v}-${h}`)),
};

const file = () => path.join(app.getPath("userData"), "settings.json");
// Verlauf: die letzten 50 Songs (nur Titel, Interpret, Cover, Zeitpunkt) – lokal, für Tray und Einstellungen
const histFile = () => path.join(app.getPath("userData"), "history.json");
let history = [];
function loadHistory() {
  try {
    const h = JSON.parse(fs.readFileSync(histFile(), "utf8"));
    history = Array.isArray(h) ? h.filter((x) => x && typeof x.uri === "string").slice(0, 50) : [];
  } catch {}
}
let histT = 0;
function remember(tr) {
  if (!tr?.uri?.startsWith("spotify:track:") || history[0]?.uri === tr.uri) return;
  history = [{ uri: tr.uri, title: String(tr.title || ""), artist: String(tr.artist || ""), cover: String(tr.cover || ""), at: Date.now() }, ...history.filter((x) => x.uri !== tr.uri)].slice(0, 50);
  clearTimeout(histT);
  histT = setTimeout(() => {
    try { fs.writeFileSync(histFile(), JSON.stringify(history)); } catch {}
  }, 2000);
  buildTray();
  settingsWin?.webContents.send("history", history);
}
const openUri = (uri) => /^spotify:track:[A-Za-z0-9]{22}$/.test(uri) && shell.openExternal(uri).catch(() => {});
let cfg = { ...DEFAULTS };
// Zugangsdaten liegen verschlüsselt in der Datei (secrets.js); safeStorage geht erst nach app „ready“
const secrets = createSecrets(safeStorage);
function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(file(), "utf8"));
    // Bestandsnutzer: eine Einstellungsdatei aus der Zeit vor dem Assistenten heißt „längst eingerichtet“
    if (saved && typeof saved === "object" && !("setupDone" in saved)) saved.setupDone = true;
    const opened = secrets.open(saved);
    cfg = { ...DEFAULTS, ...opened.cfg };
    // Klartext aus einer älteren Version: gleich verschlüsselt zurückschreiben, das Klartextfeld verschwindet
    if (opened.migrated) save();
  } catch {}
}
function save() {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(secrets.seal(cfg), null, 2));
  } catch {}
}

let overlay = null, settingsWin = null, setupWin = null, tray = null;
const lights = createLights(() => cfg, (s) => dlog?.(s));
// Party auf Fernsehern im Netz (Chromecast, Google TV, DLNA-Fernseher): der PC nimmt das Party-Bild auf und
// streamt es als Video; gesteuert vom Theme
const cast = createCast({ log: (s) => dlog?.(s), track: () => track });
let track = null, lastPlaying = null, lastShow = 0, lyric = null, pointerT = 0;
let t = make("en");
const clients = new Set();

// Alles, was das Overlay-Fenster bekommt, bekommt auch eine offene OBS-Browserquelle
// Zugangsdaten (Hue-Schlüssel, Home-Assistant-Token) bleiben im Hauptprozess: Overlay und OBS-Quellen
// bekommen die Einstellungen ohne sie, Einstellungsfenster und Assistent nur „gesetzt / nicht gesetzt“
const publicCfg = (c) => Object.fromEntries(Object.entries(c).filter(([k]) => !SECRET.includes(k)));
// secretsPlain: Zugangsdaten liegen im Klartext in der Datei (kein Schlüsselbund) – die Einstellungen sagen das
const settingsCfg = (c) => ({ ...c, ...Object.fromEntries(SECRET.map((k) => [k, c[k] ? "set" : ""])), secretsPlain: secrets.plain(c) });
function toOverlay(ch, data) {
  if (ch === "config") data = publicCfg(data);
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
    track, cfg: publicCfg(cfg), reason,
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
    setupWin?.webContents.send("lang", msg.lang);
  }
  const prev = track;
  track = msg;
  if (prev?.uri !== msg.uri) remember(msg);
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
// Fehlersuche: mit MIRAGE_LOG=1 landet jede Nachricht und jede Entscheidung in msg-log.txt
function dlog(text) {
  if (!process.env.MIRAGE_LOG) return;
  try { fs.appendFileSync(path.join(app.getPath("userData"), "msg-log.txt"), `${new Date().toISOString()} ${text}\n`); } catch {}
}
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
      // Party-Lichtzustand kommt 30× pro Sekunde – nicht ins Protokoll
      if (!String(raw).startsWith('{"type":"party"')) dlog(`${String(raw).length} ${String(raw).slice(0, 160)}`);
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (m.type === "track") onTrack(m);
      else if (m.type === "lyric") onLyric(m);
      else if (m.type === "level") onLevel(m);
      else if (m.type === "volume") showVolume(m);
      else if (m.type === "party") onParty(m);
      else if (m.type === "castScan") cast.scan().then((list) => ws.readyState === 1 && ws.send(JSON.stringify({ type: "cast", list })));
      else if (m.type === "castStart") cast.start(String(m.id || ""), { audio: !!m.audio }).then((r) => ws.readyState === 1 && ws.send(JSON.stringify({ type: "cast", id: m.id, result: r, list: cast.list() })));
      else if (m.type === "castStop") {
        cast.stop(String(m.id || ""));
        ws.send(JSON.stringify({ type: "cast", list: cast.list() }));
      } else if (m.type === "castMiracast") cast.miracast();
      // eine neuere Mirage Overlay will den Port: diese (ältere) Kopie macht Platz
      else if (m.type === "yield" && newer(String(m.version || ""), app.getVersion())) app.exit(0);
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
  wss.on("listening", () => (portTries = 0));
  wss.on("error", (e) => {
    if (e?.code === "EADDRINUSE") portBusy();
  });
}
// Port belegt – meist läuft noch eine andere Mirage Overlay (z. B. eine alte Kopie aus einem anderen Ordner).
// Ist sie älter, bitten wir sie zu gehen; kennt sie das nicht, einmal Bescheid geben. Alle 4 s neu versuchen.
let portTries = 0;
function portBusy() {
  portTries++;
  try {
    const c = new WebSocket(`ws://127.0.0.1:${PORT}`);
    c.on("open", () => {
      c.send(JSON.stringify({ type: "yield", version: app.getVersion() }));
      setTimeout(() => c.close(), 300);
    });
    c.on("error", () => {});
  } catch {}
  if (portTries === 3 && Notification.isSupported()) {
    const de = /^de/i.test(t.lang || app.getLocale());
    new Notification({
      title: "Mirage Overlay",
      body: de
        ? "Eine andere (alte) Mirage Overlay belegt die Verbindung zu Spotify. Bitte beende sie – z. B. im Task-Manager „electron.exe“ aus einem alten Mirage-Ordner."
        : "Another (old) Mirage Overlay holds the connection to Spotify. Please close it – e.g. 'electron.exe' from an old Mirage folder in Task Manager.",
    }).show();
  }
  setTimeout(startServer, 4000);
}
function send(msg) {
  for (const ws of clients) if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function command(cmd) {
  send({ type: "cmd", cmd });
}
const status = () => ({ connected: clients.size > 0, track });

// Abo beim Theme: nur bei Stilen mit Liedtext/Pegel und nicht, wenn das Overlay aus ist
// „party“ = Kantenlicht im Party-Modus (das Theme schickt nur, solange Party läuft und es eingeschaltet ist)
// „party“ auch, solange eine OBS-Party-Quelle offen ist
const topics = () => {
  const list = cfg.mode === "off" ? [] : [...(STYLE_TOPICS[cfg.style] || []), "party"];
  const room = cfg.hueOn || cfg.wledOn || cfg.orgbOn || cfg.chromaOn || cfg.goveeOn || cfg.haOn;
  if ((obsParty.size || room) && !list.includes("party")) list.push("party");
  return list;
};
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
  settingsWin.on("closed", () => {
    settingsWin = null;
    // ein laufendes Einmessen der Lampen endet mit dem Fenster
    if (lights.calibrating()) lights.stopAll();
  });
  if (MAC) app.focus({ steal: true });
}

// Einrichtungs-Assistent: kleines eigenes Fenster beim ersten Start (und auf Wunsch aus dem Tray).
// Jede Wahl wirkt sofort über „set“ – „fertig“ oder Schließen merkt sich nur noch setupDone.
function openSetup() {
  if (setupWin) {
    setupWin.show();
    setupWin.focus();
    if (MAC) app.focus({ steal: true });
    return;
  }
  setupWin = new BrowserWindow({
    width: 640,
    height: 600,
    resizable: false,
    maximizable: false,
    title: "Mirage Overlay",
    backgroundColor: "#07060c",
    ...(MAC
      ? { titleBarStyle: "hiddenInset" }
      : { titleBarStyle: "hidden", titleBarOverlay: { color: "#07060c", symbolColor: "#e9e4ff", height: 40 } }),
    icon: trayIcon(64),
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  setupWin.setMenu(null);
  setupWin.loadFile("setup.html");
  // auch Wegklicken zählt als „übersprungen“ – der Assistent soll sich nicht bei jedem Start aufdrängen
  setupWin.on("closed", () => {
    setupWin = null;
    if (!cfg.setupDone) update({ setupDone: true });
  });
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
/* ------------------------------------------------------------------ Theme-Wartung */
// Nach einem Spotify-Update ist das Theme weg, bis Spicetify es wieder einspielt. Die App erkennt das (Windows),
// bietet „Theme reparieren“ an und kann eine neue Theme-Version aus dem Release holen. Beides nur auf Klick:
// Spicetify startet Spotify dabei neu.
const HOME = os.homedir();
const spicetifyBin = () => {
  const list = WIN
    ? [path.join(process.env.LOCALAPPDATA || "", "spicetify", "spicetify.exe")]
    : [path.join(HOME, ".spicetify", "spicetify"), "/usr/local/bin/spicetify", "/opt/homebrew/bin/spicetify", "/usr/bin/spicetify"];
  return list.find((f) => f && fs.existsSync(f)) || "";
};
const themeDir = () => {
  const list = WIN
    ? [path.join(process.env.APPDATA || "", "spicetify", "Themes", "Mirage")]
    : [path.join(HOME, ".config", "spicetify", "Themes", "Mirage"), path.join(HOME, ".spicetify", "Themes", "Mirage")];
  return list.find((d) => fs.existsSync(d)) || "";
};
function themeVersion() {
  try {
    // nur der Anfang der Datei: die Version steht in den ersten Zeilen, die Datei selbst ist fast 2 MB groß
    const fd = fs.openSync(path.join(themeDir(), "theme.js"), "r"), buf = Buffer.alloc(20000);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const head = buf.toString("utf8", 0, n);
    return (head.match(/VERSION = (?:true \? )?"(\d+\.\d+\.\d+)"/) || [])[1] || "";
  } catch {
    return "";
  }
}
// Windows: Spicetify entpackt Spotifys Oberfläche in den Ordner „xpui“ und entfernt das Archiv „xpui.spa“.
// Nach einem Spotify-Update liegt das Archiv wieder da – dann fehlt das Theme.
function themeMissing() {
  if (!WIN || !spicetifyBin() || !themeDir()) return false;
  const apps = path.join(process.env.APPDATA || "", "Spotify", "Apps");
  try {
    return fs.existsSync(path.join(apps, "xpui.spa"));
  } catch {
    return false;
  }
}
const runSpicetify = (args) =>
  new Promise((resolve) => {
    execFile(spicetifyBin(), args, { timeout: 180000, windowsHide: true }, (err) => resolve(!err));
  });
let themeBusy = false, themeLatest = "", themeTold = "";
const themeNote = (title, body, onClick) => {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body: body || "", icon: trayIcon(64) });
  if (onClick) n.on("click", onClick);
  n.show();
};
async function repairTheme() {
  if (themeBusy || !spicetifyBin()) return;
  themeBusy = true;
  // erst der übliche Weg nach einem Update, dann der gründliche
  const ok = (await runSpicetify(["backup", "apply"])) || (await runSpicetify(["restore", "backup", "apply"]));
  themeBusy = false;
  themeNote(t(ok ? "themeDone" : "themeFail"), ok ? "" : t("themeFailBody"));
  buildTray();
}
async function updateTheme() {
  const dir = themeDir();
  if (themeBusy || !dir || !themeLatest || !spicetifyBin()) return;
  themeBusy = true;
  let ok = false;
  try {
    const files = {};
    for (const name of ["theme.js", "user.css", "color.ini"]) {
      const res = await net.fetch(`https://raw.githubusercontent.com/${REPO}/v${themeLatest}/Mirage/${name}`);
      if (!res.ok) throw new Error(name + " " + res.status);
      files[name] = Buffer.from(await res.arrayBuffer());
    }
    // nur einspielen, wenn alles da ist und nach Mirage aussieht
    if (files["theme.js"].length < 100000 || !files["theme.js"].includes("__mirage") || files["user.css"].length < 10000) throw new Error("unexpected files");
    for (const [name, buf] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name + ".new"), buf);
      fs.renameSync(path.join(dir, name + ".new"), path.join(dir, name));
    }
    ok = (await runSpicetify(["apply"])) || (await runSpicetify(["backup", "apply"]));
  } catch {}
  themeBusy = false;
  themeNote(t(ok ? "themeDone" : "themeFail"), ok ? "" : t("themeFailBody"));
  buildTray();
}
const themeOutdated = () => {
  const have = themeVersion();
  return !!(have && themeLatest && spicetifyBin() && newer(themeLatest, have));
};
function watchTheme() {
  if (themeBusy) return;
  if (themeMissing()) {
    if (themeTold !== "missing") {
      themeTold = "missing";
      themeNote(t("themeGone"), t("themeGoneBody"), repairTheme);
      buildTray();
    }
  } else if (themeTold === "missing") {
    themeTold = "";
    buildTray();
  }
}
setTimeout(watchTheme, 20000);
setInterval(watchTheme, 5 * 60e3);

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
      { label: t("setupAgain"), click: openSetup },
      ...(themeOutdated() ? [{ label: t("themeUpdate").replace("{v}", themeLatest), enabled: !themeBusy, click: updateTheme }] : []),
      ...(spicetifyBin() ? [{ label: t(themeMissing() ? "themeRepairNow" : "themeRepair"), enabled: !themeBusy, click: repairTheme }] : []),
      ...(history.length ? [{ label: t("history"), submenu: history.slice(0, 10).map((h) => ({ label: `${h.title} – ${h.artist}`.slice(0, 70), click: () => openUri(h.uri) })) }] : []),
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

// WIN: den Run-Eintrag selbst schreiben – Electron legte ihn ohne Anführungszeichen an
// („…\mirage-overlay\Mirage Overlay.exe --hidden“). Mit dem Leerzeichen im Pfad versucht Windows dann zuerst
// „…\Mirage“ zu starten und findet die App nur manchmal; mit Anführungszeichen immer.
const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
function setAutostartWin(on) {
  const cmd = [process.execPath, ...launchArgs()].map((a) => (a.startsWith("--") ? a : `"${a}"`)).join(" ");
  const args = on ? ["add", RUN_KEY, "/v", "Mirage Overlay", "/t", "REG_SZ", "/d", cmd, "/f"] : ["delete", RUN_KEY, "/v", "Mirage Overlay", "/f"];
  execFile("reg", args, { windowsHide: true }, (e) => e && on && dlog(`autostart: ${e.message}`));
}
function setAutostart(on) {
  if (WIN) return setAutostartWin(on);
  if (MAC && !process.defaultApp) {
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
// kleines Start-Protokoll (die letzten 20 Starts): zeigt, ob die App beim Anmelden wirklich gestartet ist
function logStart() {
  const f = path.join(app.getPath("userData"), "start-log.txt");
  let lines = [];
  try { lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean); } catch {}
  lines.push(`${new Date().toISOString()} ${startedHidden() ? "login" : "manual"} ${app.getVersion()}`);
  try { fs.writeFileSync(f, lines.slice(-20).join("\n") + "\n"); } catch {}
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
  if (!cfg.volumeOsd || cfg.mode === "off" || busy) return dlog(`volume skipped osd=${cfg.volumeOsd} mode=${cfg.mode} busy=${busy}`);
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

/* ------------------------------------------------------------------ Kantenlicht (Party-Modus) */
// Vier schmale, durchsichtige Streifen an den Rändern des Bildschirms glühen im Takt des Party-Modus.
// Bewusst Streifen statt eines Fensters über allem: Spotify selbst bleibt unverdeckt. Klicks gehen durch.
const EDGE = 70;
let edges = null, edgeT = 0;
function makeEdges() {
  const b = pickDisplay().bounds;
  const rects = {
    top: { x: b.x, y: b.y, width: b.width, height: EDGE },
    bottom: { x: b.x, y: b.y + b.height - EDGE, width: b.width, height: EDGE },
    left: { x: b.x, y: b.y + EDGE, width: EDGE, height: b.height - 2 * EDGE },
    right: { x: b.x + b.width - EDGE, y: b.y + EDGE, width: EDGE, height: b.height - 2 * EDGE },
  };
  edges = Object.entries(rects).map(([side, r]) => {
    const w = new BrowserWindow({
      ...r, show: false, frame: false, transparent: true, resizable: false, movable: false, focusable: false,
      skipTaskbar: true, hasShadow: false, alwaysOnTop: true, backgroundColor: "#00000000", ...(MAC ? { type: "panel" } : {}),
      webPreferences: { preload: path.join(__dirname, "preload.js"), backgroundThrottling: false },
    });
    w.setIgnoreMouseEvents(true);
    w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    w.loadFile("edge.html", { hash: side });
    w.on("closed", () => (edges = null));
    return w;
  });
}
// Kantenlicht und OBS-Quelle bekommen den Zustand erst nach der Blitz-Schranke (höchstens 3 Blitze pro
// Sekunde, mit „Keine Blitze“ gar keine); die Lampen haben in lights.js ihre eigene
const screenGuard = createPartyGuard();
function onParty(raw) {
  if (!raw || typeof raw !== "object") return;
  lights.feed(raw);
  const m = screenGuard(raw, Date.now() / 1000);
  if (obsParty.size) obsSend("party", { a: m.a, k: m.k, e: m.e, d: m.d, pal: m.pal, nf: m.nf });
  if (m.edge === false || cfg.mode === "off" || busy || cfg.edge === false) return;
  if (!edges) makeEdges();
  for (const w of edges || []) {
    if (w.isDestroyed()) continue;
    if (!w.isVisible() && !w.webContents.isLoading()) {
      w.showInactive();
      w.setAlwaysOnTop(true, "screen-saver");
    }
    w.webContents.send("party", m);
  }
  // kommt nichts mehr (Party beendet, Spotify zu), sanft ausblenden
  clearTimeout(edgeT);
  edgeT = setTimeout(hideEdges, 1200);
}
function hideEdges() {
  clearTimeout(edgeT);
  for (const w of edges || []) {
    if (w.isDestroyed()) continue;
    w.webContents.send("partyOff");
    setTimeout(() => !w.isDestroyed() && w.hide(), 300);
  }
}

/* ------------------------------------------------------------------ Ruhig bei Vollbild */
// WIN: Windows meldet selbst, wann ein Programm im Vollbild läuft (dieselbe Abfrage, mit der es
// seine eigenen Benachrichtigungen zurückhält) – ein kleines PowerShell-Skript fragt sie alle 1,5 s ab.
// LINUX: _NET_WM_STATE des aktiven Fensters über xprop (nur X11, falls installiert).
// MAC: ohne eigenen nativen Code nicht zuverlässig abfragbar – die Option ist dort ausgeblendet.
let busy = false, busyProc = null, busyT = 0;
function setBusy(on) {
  if (on === busy) return;
  busy = on;
  dlog(`busy ${busy}`);
  if (busy) {
    hideOverlay();
    volWin?.hide();
    hideEdges();
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
     .ov            die Karte / the card            .stage.st-island / .st-card / .st-banner / .st-lyrics / .st-visualizer / .st-minimal / .st-strip / .st-bubble
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
const obsClients = new Set(), obsParty = new Set();
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
    // Party-Licht als eigene Quelle: /party (mit ?bg=0 durchsichtig)
    if (url === "/party") {
      let html = "";
      try { html = fs.readFileSync(path.join(__dirname, "party.html"), "utf8"); } catch {}
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
  wss.on("connection", (ws, req) => {
    obsClients.add(ws);
    if (/[?&]party=1/.test(req.url || "")) {
      obsParty.add(ws);
      resubscribe();
      ws.on("close", () => {
        obsParty.delete(ws);
        resubscribe();
      });
    }
    ws.send(JSON.stringify({ ch: "css", data: readCss() }));
    ws.send(JSON.stringify({ ch: "config", data: publicCfg(cfg) }));
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

/* ------------------------------------------------------------------ Steuerung (Stream Deck) */
// Kleine lokale Schnittstelle für das Stream-Deck-Plugin: Play/Pause, weiter, zurück, Like, Immersiv, Party.
// Nur auf diesem Rechner (127.0.0.1) und nur ohne Herkunft einer Webseite – Browser-Seiten senden immer
// ihre Adresse mit und kommen deshalb nicht hinein.
const CONTROL_PORT = Number(process.env.MIRAGE_CONTROL_PORT) || 47324;
const CONTROL_CMDS = new Set(["toggle", "next", "prev", "like", "immersive", "party"]);
let controlServer = null;
function startControl() {
  if (controlServer || cfg.control === false) return;
  controlServer = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({
    server: controlServer,
    path: "/control",
    maxPayload: 256,
    verifyClient: ({ origin }) => !origin || origin === "null" || origin.startsWith("file://"),
  });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "hello", track: track ? { title: track.title, artist: track.artist, playing: track.playing } : null }));
    ws.on("message", (raw) => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (CONTROL_CMDS.has(m?.cmd)) command(m.cmd);
    });
  });
  wss.on("error", () => {});
  controlServer.on("error", () => (controlServer = null));
  controlServer.listen(CONTROL_PORT, "127.0.0.1");
}
function stopControl() {
  controlServer?.close();
  controlServer = null;
}

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
    themeLatest = version;
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
  if ("control" in patch) cfg.control === false ? stopControl() : startControl();
  if (["hueOn", "wledOn", "orgbOn", "chromaOn", "hueGroup", "hueIp", "hueUser", "goveeOn", "goveeIps", "haOn", "haUrl", "haToken", "haEntities", "hueExclude", "haExclude"].some((k) => k in patch)) {
    lights.sync();
    resubscribe();
  }
  if ("autoUpdate" in patch) scheduleUpdates();
  if (cfg.mode === "off") hideOverlay();
  else if (cfg.mode === "always" && track) announce("update");
  toOverlay("config", cfg);
  if (overlay?.isVisible()) position();
  settingsWin?.webContents.send("cfg", settingsCfg(cfg));
  setupWin?.webContents.send("cfg", settingsCfg(cfg));
}

/* ------------------------------------------------------------------ Einstellungen umziehen */
// Export/Import als JSON-Datei. Zugangsdaten (SECRET) verlassen den Rechner nie, setupDone gehört zu
// diesem Rechner. Beim Import zählen nur bekannte Schlüssel mit dem Typ ihres Standardwerts.
const MOVE_SKIP = [...SECRET, "setupDone"];
const movable = (k) => Object.hasOwn(DEFAULTS, k) && !MOVE_SKIP.includes(k);
function exportable() {
  return Object.fromEntries(Object.entries(cfg).filter(([k]) => movable(k)));
}
function validValue(k, v) {
  const d = DEFAULTS[k];
  if (typeof v !== typeof d) return false;
  if (typeof d === "number") return Number.isFinite(v);
  if (typeof d === "string") return v.length <= 4000 && (!CHOICES[k] || CHOICES[k].includes(v));
  return typeof d === "boolean";
}
function importable(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return Object.fromEntries(Object.entries(data).filter(([k, v]) => movable(k) && validValue(k, v)));
}
async function exportCfg(win) {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: t("moveExport"),
    defaultPath: path.join(app.getPath("documents"), "mirage-overlay-settings.json"),
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return { canceled: true };
  try {
    fs.writeFileSync(filePath, JSON.stringify({ app: "mirage-overlay", version: app.getVersion(), settings: exportable() }, null, 2));
    return { ok: true };
  } catch {
    return { error: "io" };
  }
}
async function importCfg(win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: t("moveImport"),
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePaths?.[0]) return { canceled: true };
  let data;
  try {
    // Einstellungsdateien sind wenige KB – alles Große ist sicher keine
    if (fs.statSync(filePaths[0]).size > 1024 * 1024) return { error: "invalid" };
    data = JSON.parse(fs.readFileSync(filePaths[0], "utf8"));
  } catch (e) {
    return { error: e instanceof SyntaxError ? "invalid" : "io" };
  }
  // eigenes Exportformat ({ settings: {…} }) oder eine rohe settings.json
  const patch = importable(data && typeof data.settings === "object" ? data.settings : data);
  const n = Object.keys(patch).length;
  if (!n) return { error: "invalid" };
  update(patch);
  return { ok: true, n };
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
  cfg: settingsCfg(cfg),
  status: status(),
  lang: t.lang,
  version: app.getVersion(),
  upd,
  obsUrl: obsUrl(),
  history,
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
// Die Hue-Schlüssel setzt nur der Hauptprozess selbst (Koppeln). Aus einem Fenster kommt höchstens ein neu
// eingetipptes Home-Assistant-Token – nie der Platzhalter „set“ zurück.
ipcMain.on("set", (_e, patch) => {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return;
  const p = { ...patch };
  delete p.hueUser;
  delete p.hueClientKey;
  delete p.secrets;
  delete p.secretsPlain;
  if (p.haToken === "set") delete p.haToken;
  update(p);
});
ipcMain.on("preview", preview);
ipcMain.on("openCss", openCss);
ipcMain.on("checkUpdate", () => (upd.state === "available" || upd.state === "ready" ? installUpdate() : checkUpdate(true)));
ipcMain.on("cmd", (_e, c) => command(c));
ipcMain.on("openUri", (_e, uri) => openUri(String(uri || "")));
// Hue einrichten
ipcMain.handle("hueFind", () => lights.hueFind());
ipcMain.handle("huePair", async (_e, ip) => {
  const r = await lights.huePair(String(ip || "").trim());
  if (r.user) update({ hueIp: String(ip).trim(), hueUser: r.user, hueClientKey: r.clientKey || "", hueOn: true });
  // der Schlüssel selbst geht das Fenster nichts an
  return r.user ? { ok: true } : { error: r.error };
});
ipcMain.handle("hueGroups", () => lights.hueGroups());
ipcMain.handle("hueLights", () => lights.hueLights());
// Verzögerung je Gerät: ohne Angabe nur lesen, mit { backend, ms } setzen; zurück kommen alle Werte
ipcMain.handle("lightLat", (_e, d) => {
  const patch = d && typeof d === "object" ? lights.latPatch(String(d.backend || ""), Number(d.ms)) : null;
  if (patch) update(patch);
  return lights.latAll();
});
// Einmessen starten (Gerätename) oder beenden (leer): das Fenster bekommt jeden Schlag als „calBeat“
ipcMain.handle("lightCal", (e, name) => {
  if (!name) return void lights.stopAll();
  return lights.calibrate(String(name), (bright) => !e.sender.isDestroyed() && e.sender.send("calBeat", bright));
});
ipcMain.handle("goveeScan", async () => {
  const r = await lights.goveeScan();
  if (r.list?.length) update({ goveeIps: r.list.map((d) => d.ip).join(", "), goveeOn: true });
  return r;
});
ipcMain.handle("haTest", () => lights.haTest());
// Einstellungen umziehen: der Dialog gehört zum Fenster, das gefragt hat
ipcMain.handle("exportCfg", (e) => exportCfg(BrowserWindow.fromWebContents(e.sender)));
ipcMain.handle("importCfg", (e) => importCfg(BrowserWindow.fromWebContents(e.sender)));
// Assistent fertig oder übersprungen
ipcMain.on("setupDone", () => {
  update({ setupDone: true });
  setupWin?.close();
});
ipcMain.on("hover", (_e, on) => overlay?.setIgnoreMouseEvents(!on, { forward: true }));
// ein „fertig“ kurz nach einer neuen Ansage stammt noch von der alten – ignorieren
ipcMain.on("done", () => cfg.mode !== "always" && Date.now() - lastShow > 1200 && overlay?.hide());

/* ------------------------------------------------------------------ Start */
app.on("second-instance", openSettings);
app.on("activate", openSettings); // MAC: erneutes Öffnen aus Finder/Launchpad
app.on("window-all-closed", () => {}); // im Infobereich weiterlaufen
// Beim Beenden bekommen die Lampen ihren Zustand von vor der Party zurück. Das sind Netzaufrufe: kurz
// darauf warten (höchstens 3 s), sonst ist der Prozess weg, bevor sie ankommen.
let quitReady = false;
app.on("before-quit", (e) => {
  cast.stopAll();
  if (quitReady) return;
  e.preventDefault();
  quitReady = true;
  Promise.race([lights.stopAll(), new Promise((r) => setTimeout(r, 3000))]).finally(() => app.quit());
});
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
  loadHistory();
  startControl();
  watchCss();
  watchFullscreen();
  scheduleUpdates();
  // Autostart bei jedem Start neu eintragen: nach einem Update, einer Neuinstallation oder dem Wechsel
  // von der Entwickler- zur installierten Version zeigt der Eintrag sonst noch auf den alten Pfad
  if (cfg.autostart) {
    try { setAutostart(true); } catch {}
  }
  logStart();
  screen.on("display-removed", () => overlay?.isVisible() && position());
  screen.on("display-metrics-changed", () => overlay?.isVisible() && position());
  // Beim allerersten Start der Assistent, sonst (ohne Autostart-Aufruf) gleich die Einstellungen
  if (!cfg.setupDone) openSetup();
  else if (!startedHidden()) openSettings();
});
