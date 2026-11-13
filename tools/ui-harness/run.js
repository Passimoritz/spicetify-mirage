// Oberflächen-Prüfstand: rendert Nachbauten echter Spotify-Bausteine mit Spotifys ECHTEN Stylesheets
// (%APPDATA%\Spotify\Apps\xpui\*.css, nur gelesen) plus Mirage/user.css in einem versteckten, stummen
// Electron-Fenster und speichert je Baustein und Schema ein PNG (Zeilen = Test-Paletten, Spalten = Zustände).
//   npm run ui:shots                                   alle Bausteine → %TEMP%\mirage-ui-shots
//   npm run ui:shots -- --out <Ordner> --css <user.css> --only play-header,player-bar --modes dark --pals warm,neon --modes dark --pals warm,neon
// Kein Netz außer Google Fonts (Outfit, wie user.css es lädt); Spotifys Schriften kommen aus xpui/fonts.
const { app, BrowserWindow, protocol, session, net } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { build } = require("./palettes.js");
const { make } = require("./fixtures.js");

const REPO = path.join(__dirname, "..", "..");
const arg = (name, def) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const XPUI = arg("xpui", path.join(process.env.APPDATA || "", "Spotify", "Apps", "xpui"));
const CSS = path.resolve(arg("css", path.join(REPO, "Mirage", "user.css")));
const OUT = path.resolve(arg("out", path.join(os.tmpdir(), "mirage-ui-shots")));
const ONLY = (arg("only", "") || "").split(",").filter(Boolean);
const MODES = (arg("modes", "dark,light") || "").split(",");
const PALS = (arg("pals", "") || "").split(",").filter(Boolean);

app.commandLine.appendSwitch("mute-audio");
app.commandLine.appendSwitch("autoplay-policy", "user-gesture-required");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
protocol.registerSchemesAsPrivileged([{ scheme: "mui", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

if (!fs.existsSync(path.join(XPUI, "xpui-snapshot.css"))) {
  console.log("Spotify nicht gefunden (" + XPUI + "), nichts zu rendern.");
  process.exit(0);
}
// Spicetify legt eigene Dateien daneben (user.css, colors.css, xpui-modules, spicetify-*, helper/): nicht laden
const SPICETIFY = /^(user|colors)\.css$|^spicetify-|^xpui-modules/;
// eigene Fenster (Mini-Player, Debug-Fenster) bringen ein eigenes, nicht umgefärbtes Encore-Thema mit
const OTHER_WINDOW = /^(pip-|xpui-pip-|xpui-debug-window)/;
// Fehler beenden den Lauf, statt hinter einem unsichtbaren Fehlerfenster zu hängen
for (const ev of ["uncaughtException", "unhandledRejection"]) {
  process.on(ev, (e) => {
    console.error(e);
    app.exit(1);
  });
}
const spotifyCss = fs
  .readdirSync(XPUI)
  .filter((f) => f.endsWith(".css") && !SPICETIFY.test(f) && !OTHER_WINDOW.test(f))
  .sort((a, b) => (a === "xpui-snapshot.css" ? -1 : b === "xpui-snapshot.css" ? 1 : a.localeCompare(b)));
const encore = (fs.readFileSync(path.join(XPUI, "xpui-snapshot.css"), "utf8").match(/\.(e-\d+)-button-primary__inner/) || [])[1] || "e-101040";

const pages = new Map();
const TYPES = { ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".png": "image/png", ".html": "text/html" };
function serve(file) {
  if (!fs.existsSync(file)) return new Response("", { status: 404 });
  return new Response(fs.readFileSync(file), { headers: { "content-type": TYPES[path.extname(file)] || "application/octet-stream" } });
}

const HARNESS_CSS = `
html,body{margin:0}
/* Spotifys Grundstil für Links kommt zur Laufzeit (styled-components), nicht aus den CSS-Dateien */
a{color:inherit;text-decoration:none}
body{padding:0;min-width:1200px}
.h-row{position:relative;display:flex;flex-direction:column;gap:10px;padding:18px 22px 22px;isolation:isolate}
.h-row::before{content:"";position:absolute;inset:0;z-index:-1;background:
  radial-gradient(45% 90% at 12% 10%,rgba(var(--m-a-rgb),var(--h-haze)),transparent 70%),
  radial-gradient(40% 90% at 85% 30%,rgba(var(--m-b-rgb),var(--h-haze)),transparent 70%),
  radial-gradient(50% 80% at 50% 110%,rgba(var(--m-c-rgb),calc(var(--h-haze) * .7)),transparent 70%),var(--spice-main)}
html.mirage-light .h-row::before{opacity:.6}
.h-name{font:600 12px/1 ui-monospace,Consolas,monospace;color:var(--spice-text);opacity:.75;display:flex;gap:10px;align-items:center}
.h-name i{display:inline-block;width:14px;height:14px;border-radius:3px}
.h-panel{display:flex;flex-wrap:wrap;gap:22px 30px;align-items:flex-start;padding:18px 20px}
.h-panel.Root__main-view{position:relative;container:none;flex-direction:row;grid-area:auto;width:auto;overflow:visible}
.h-cell{display:flex;flex-direction:column;gap:10px;min-width:120px}
.h-full .h-cell{width:100%}
.h-label{font:11px/1 ui-monospace,Consolas,monospace;color:var(--spice-subtext)}
`;

function pageHtml(fx, mode, data) {
  const sc = data.schemes[mode];
  const rows = data.palettes[mode]
    .filter((p) => !PALS.length || PALS.includes(p.name))
    .map((p) => {
      const sw = p.pal.map((c) => `<i style="background:rgb(${c.join(",")})"></i>`).join("");
      const cells = fx.cells.map(([label, html]) => `<div class="h-cell"><div class="h-label">${label}</div>${html}</div>`).join("");
      const panel = fx.bare ? `<div class="h-panel">${cells}</div>` : `<div class="h-panel Root__main-view">${cells}</div>`;
      return `<section class="h-row${fx.full ? " h-full" : ""}" style="${p.vars}--h-haze:${mode === "light" ? 0.35 : 0.5}"><div class="h-name">${p.name}${sw}</div>${panel}</section>`;
    })
    .join("");
  const links = spotifyCss.map((f) => `<link rel="stylesheet" href="/xpui/${f}">`).join("");
  // Reihenfolge wie im Client: Spotify im head, Schema + Mirage im body (Spicetify hängt sie dort an)
  return `<!doctype html><html lang="de" dir="ltr" class="encore-dark-theme encore-layout-themes mirage-vinyl${sc.light ? " mirage-light" : ""}" data-m-page="playlist" data-m-scheme="${sc.name}">
<head><meta charset="utf-8">${links}<style id="mirage-scheme">html:root{${sc.vars}}</style><style>${HARNESS_CSS}</style></head>
<body><link rel="stylesheet" href="/mirage/user.css"><main class="h-root">${rows}</main></body></html>`;
}

async function shoot(win, url, file) {
  await win.loadURL(url);
  const wc = win.webContents;
  await wc.executeJavaScript("document.fonts.ready.then(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))");
  const dbg = wc.debugger;
  if (!dbg.isAttached()) dbg.attach("1.3");
  await dbg.sendCommand("DOM.enable");
  await dbg.sendCommand("CSS.enable");
  const { root } = await dbg.sendCommand("DOM.getDocument", { depth: -1 });
  const { nodeIds } = await dbg.sendCommand("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "[data-force]" });
  for (const nodeId of nodeIds) {
    const { attributes } = await dbg.sendCommand("DOM.getAttributes", { nodeId });
    const states = attributes[attributes.indexOf("data-force") + 1].split(/\s+/).filter(Boolean);
    await dbg.sendCommand("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: states });
  }
  win.setContentSize(1240, 200);
  const h = await wc.executeJavaScript("Math.ceil(document.documentElement.scrollHeight)");
  win.setContentSize(1240, Math.min(h, 6000));
  // Übergänge (bis 0,6 s) und Federn ausklingen lassen
  await new Promise((r) => setTimeout(r, 1300));
  fs.writeFileSync(file, (await wc.capturePage()).toPNG());
  // --probe "<Selektor>": Maße und einige berechnete Werte der ersten Treffer ausgeben (Fehlersuche)
  const probe = arg("probe", "");
  if (probe) {
    const js = `[...document.querySelectorAll(${JSON.stringify(probe)})].slice(0, 6).map((el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return [el.tagName, el.className.baseVal ?? el.className, Math.round(r.x), Math.round(r.y), Math.round(r.width) + "x" + Math.round(r.height),
        cs.display, cs.position, cs.backgroundImage.slice(0, 60), cs.backgroundColor, cs.color, cs.fill, cs.transform, cs.getPropertyValue("--text-base"), cs.getPropertyValue("--text-subdued")].join(" | ");
    }).join("\\n")`;
    console.log(await wc.executeJavaScript(js));
  }
}

app.whenReady().then(async () => {
  const ses = session.fromPartition("mirage-ui-harness");
  ses.protocol.handle("mui", (req) => {
    const u = new URL(req.url);
    const p = decodeURIComponent(u.pathname);
    if (p.startsWith("/page/")) return new Response(pages.get(p.slice(6)) || "", { headers: { "content-type": "text/html" } });
    if (p === "/mirage/user.css") return serve(CSS);
    if (p.startsWith("/xpui/")) return serve(path.join(XPUI, path.normalize(p.slice(6)).replace(/^(\.\.[\\/])+/, "")));
    if (p.startsWith("/fonts/")) return serve(path.join(XPUI, "fonts", path.basename(p)));
    return new Response("", { status: 404 });
  });
  // Spotifys Schriften liegen lokal (ohne Prüfsumme im Namen); außer Google Fonts geht nichts ins Netz
  ses.protocol.handle("https", (req) => {
    const u = new URL(req.url);
    if (u.host === "encore.scdn.co" && u.pathname.startsWith("/fonts/")) {
      return serve(path.join(XPUI, "fonts", path.basename(u.pathname).replace(/-[0-9a-f]{32}(?=\.woff2?$)/, "")));
    }
    if (u.host === "fonts.googleapis.com" || u.host === "fonts.gstatic.com") return net.fetch(req, { bypassCustomProtocolHandlers: true });
    return new Response("", { status: 404 });
  });

  const data = await build(REPO);
  const fixtures = make(encore).filter((f) => !ONLY.length || ONLY.includes(f.name));
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: 1240,
    height: 900,
    useContentSize: true,
    show: false,
    webPreferences: { offscreen: true, partition: "mirage-ui-harness", backgroundThrottling: false, contextIsolation: true },
  });
  win.webContents.setAudioMuted(true);
  for (const fx of fixtures) {
    for (const mode of MODES) {
      const id = `${fx.name}-${mode}`;
      pages.set(id + ".html", pageHtml(fx, mode, data));
      const file = path.join(OUT, id + ".png");
      await shoot(win, `mui://app/page/${id}.html`, file);
      console.log("geschrieben:", file);
    }
  }
  const fonts = await win.webContents.executeJavaScript("[...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))].join(', ')");
  console.log(`Encore ${encore} · ${spotifyCss.length} Spotify-Stylesheets · geladene Schriften: ${fonts || "keine (Systemschrift)"}`);
  app.quit();
});
