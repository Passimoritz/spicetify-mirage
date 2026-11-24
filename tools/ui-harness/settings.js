// Prüfstand für den Einstellungs-Dialog: das echte Theme (Mirage/theme.js) mit dem Spotify-Nachbau der E2E-Tests,
// Spicetifys echtem Fenster-Aufbau (PopupModal aus spicetifyWrapper.js: generic-modal, isLarge) und – falls Spotify
// installiert ist – Spotifys echten Stylesheets. Öffnet den Dialog, klappt alle Gruppen auf und speichert Bilder je
// Sprache, Schema und Fenstergröße; dazu eine Messung (Überlauf, Bedienelemente außerhalb ihrer Zeile, Höhen).
//   npx electron tools/ui-harness/settings.js -- --out tests/e2e/out/settings-ui/after
//   … --langs de,en --schemes Mirage,Pearl --sizes 1280x800,820x620,2560x1440 --theme <theme.js> --css <user.css>
// Nichts geht ins Netz außer Google Fonts (Outfit, wie user.css es lädt).
const { app, BrowserWindow, session, net } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const arg = (name, def) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const OUT = path.resolve(arg("out", path.join(REPO, "tests", "e2e", "out", "settings-ui")));
const LANGS = arg("langs", "de,en").split(",");
const SCHEMES = arg("schemes", "Mirage,Pearl").split(",");
const SIZES = arg("sizes", "1280x800,820x620,2560x1440").split(",").map((s) => s.split("x").map(Number));
// nur Bilder des sichtbaren Fensters (ohne die langen Bilder aller Gruppen)
const QUICK = process.argv.includes("--quick");
const THEME = path.resolve(arg("theme", path.join(REPO, "Mirage", "theme.js")));
const CSS = path.resolve(arg("css", path.join(REPO, "Mirage", "user.css")));
const XPUI = arg("xpui", path.join(process.env.APPDATA || "", "Spotify", "Apps", "xpui"));
const SETTINGS = JSON.parse(arg("settings", "{}"));

// jedes Bild in einem frischen Fenster: das Schließen des letzten darf den Lauf nicht beenden
app.on("window-all-closed", () => {});
app.commandLine.appendSwitch("mute-audio");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
for (const ev of ["uncaughtException", "unhandledRejection"]) {
  process.on(ev, (e) => {
    console.error(e);
    app.exit(1);
  });
}

// Spicetifys PopupModal (spicetifyWrapper.js, 2.4x): derselbe Aufbau und dieselben Grundstile
const POPUP_CSS = `
generic-modal :where(.GenericModal__overlay) { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: rgba(0, 0, 0, .7); }
generic-modal :where(.spicetify-popup) { display: flex; max-height: calc(100vh - 64px); border-radius: 8px; overflow: hidden; }
generic-modal :where(.spicetify-popup-container) { display: flex; flex-direction: column; width: 524px; max-width: 100%; min-height: 0; border-radius: 8px; color: var(--spice-text, var(--text-base, #fff)); background-color: var(--spice-player, var(--background-elevated-base, #121212)); }
generic-modal .spicetify-popup-container-large { width: 664px; min-width: 0; max-width: calc(100vw - 64px); min-height: 0; max-height: calc(100vh - 64px); }
generic-modal :where(.spicetify-popup-header) { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 16px; padding: 24px; }
generic-modal :where(.spicetify-popup-title) { margin: 0; font-size: 1.5rem; font-weight: 700; line-height: 1.3; }
generic-modal :where(.spicetify-popup-closeBtn) { display: flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; margin-block-start: -8px; margin-inline-end: -8px; border: 0; border-radius: 50%; background-color: transparent; color: var(--spice-subtext, var(--text-subdued, #b3b3b3)); cursor: pointer; }
generic-modal :where(.spicetify-popup-content) { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 24px 24px; }`;
const POPUP_JS = `
Spicetify.PopupModal = {
  display({ title, content, isLarge }) {
    document.querySelector("generic-modal")?.remove();
    const m = document.createElement("generic-modal");
    const cls = isLarge ? "spicetify-popup-container spicetify-popup-container-large main-embedWidgetGenerator-container" : "spicetify-popup-container main-trackCreditsModal-container";
    m.innerHTML = '<div class="GenericModal__overlay" style="z-index: 100;"><div class="GenericModal spicetify-popup" tabindex="-1" role="dialog" aria-modal="true"><div class="' + cls + '"><div class="spicetify-popup-header main-trackCreditsModal-header"><h1 class="spicetify-popup-title main-type-alto"></h1><button aria-label="Close" class="spicetify-popup-closeBtn main-trackCreditsModal-closeBtn">×</button></div><div class="spicetify-popup-content main-trackCreditsModal-mainSection"><main class="main-trackCreditsModal-originalCredits"></main></div></div></div></div>';
    m.querySelector("h1").textContent = title;
    m.querySelector(".GenericModal").setAttribute("aria-label", title);
    m.querySelector("button").onclick = () => m.remove();
    m.querySelector("main").append(content);
    document.body.append(m);
  },
  hide() { document.querySelector("generic-modal")?.remove(); },
};`;

// Messung im Dialog: liefert eine Liste von Mängeln (leer = sauber)
const AUDIT = `(() => {
  const box = document.querySelector(".mirage-settings"), out = [];
  if (!box) return ["kein Dialog"];
  const sc = box.closest(".spicetify-popup-content") || box;
  for (const s of [sc, box.querySelector(".m-scroll")].filter(Boolean)) if (s.scrollWidth > s.clientWidth + 1) out.push("waagrechter Überlauf: " + s.className + " " + s.scrollWidth + " > " + s.clientWidth);
  // Suchfeld bündig mit den Gruppen darunter
  const pill = box.querySelector(".m-search")?.getBoundingClientRect(), g1 = box.querySelector("details.m-group")?.getBoundingClientRect();
  if (pill && g1 && (Math.abs(pill.left - g1.left) > 2 || Math.abs(pill.right - g1.right) > 2)) out.push("Suchfeld nicht bündig: " + [pill.left, pill.right, g1.left, g1.right].map(Math.round).join("/"));
  const br = box.getBoundingClientRect();
  const vis = (e) => e.getClientRects().length && !e.closest(".m-hide, [hidden]") && getComputedStyle(e).visibility !== "hidden";
  const name = (e) => (e.dataset?.key || e.closest("[data-key]")?.dataset.key || e.closest(".m-row")?.querySelector("b")?.textContent || e.className || e.tagName).toString().slice(0, 40);
  // die Suchleiste reicht absichtlich über die Innenabstände des Fensters (volle Breite): nur sie nicht prüfen
  for (const e of box.querySelectorAll("*")) {
    if (!vis(e) || e.closest(".m-search-bar")) continue;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > br.right + 1 || r.left < br.left - 1)) out.push("ragt aus dem Dialog: " + name(e) + " " + Math.round(r.left - br.left) + ".." + Math.round(r.right - br.left) + " / " + Math.round(br.width));
  }
  for (const row of box.querySelectorAll(".m-row")) {
    if (!vis(row)) continue;
    const rr = row.getBoundingClientRect();
    for (const c of row.querySelectorAll("input, select, button, .m-seg")) {
      if (!vis(c)) continue;
      const r = c.getBoundingClientRect();
      if (r.right > rr.right + 1 || r.left < rr.left - 1 || r.bottom > rr.bottom + 1 || r.top < rr.top - 1) out.push("Bedienelement außerhalb der Zeile: " + name(c));
    }
  }
  for (const s of box.querySelectorAll(".m-seg")) {
    if (!vis(s)) continue;
    const hs = [...s.children].filter(vis).map((b) => Math.round(b.getBoundingClientRect().height));
    if (Math.max(...hs) - Math.min(...hs) > 1) out.push("Knöpfe verschieden hoch in " + name(s) + ": " + [...new Set(hs)].join("/"));
  }
  for (const t of box.querySelectorAll("b, small, summary, button, span")) {
    if (!vis(t) || getComputedStyle(t).overflow === "visible") continue;
    if (t.scrollWidth > t.clientWidth + 1 && !/ellipsis/.test(getComputedStyle(t).textOverflow)) out.push("abgeschnitten: " + name(t));
  }
  return [...new Set(out)];
})()`;

const xpuiCss = fs.existsSync(path.join(XPUI, "xpui-snapshot.css"))
  ? fs.readdirSync(XPUI).filter((f) => f.endsWith(".css") && !/^(user|colors)\.css$|^spicetify-|^xpui-modules|^(pip-|xpui-pip-|xpui-debug-window)/.test(f))
  : [];

function page(lang, scheme) {
  const fake = fs.readFileSync(path.join(REPO, "tests", "e2e", "fake-spotify.js"), "utf8").replace('getLocale: () => "de"', `getLocale: () => ${JSON.stringify(lang)}`);
  const theme = fs.readFileSync(THEME, "utf8");
  const settings = { scheme, schemeCfg: "Mirage", ...SETTINGS };
  const links = xpuiCss.map((f) => `<link rel="stylesheet" href="/xpui/${f}">`).join("");
  return `<!doctype html><html lang="${lang}" class="encore-dark-theme encore-layout-themes"><head><meta charset="utf-8">${links}<style class="spicetify-popup-modal">${POPUP_CSS}</style></head>
<body><link rel="stylesheet" href="/user.css">
<div class="Root__main-view" id="main-view" style="position:fixed;inset:0 0 90px 280px;overflow:auto"><div style="height:260px"></div><div role="grid"></div></div>
<footer><div data-testid="volume-bar"><button data-testid="volume-bar-toggle-mute-button"></button></div></footer>
<script>${fake}<\/script><script>${POPUP_JS}<\/script>
<script>localStorage.clear();localStorage.setItem("mirage:settings", ${JSON.stringify(JSON.stringify(settings))});localStorage.setItem("mirage:welcomed", "1");localStorage.setItem("mirage:coach", "1");<\/script>
<script>${theme.replace(/<\/script>/g, "<\\/script>")}<\/script></body></html>`;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(js, wc, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await wc.executeJavaScript(js).catch(() => false)) return true;
    await wait(80);
  }
  throw new Error("Zeitüberschreitung: " + js);
}

app.whenReady().then(async () => {
  let cur = "";
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split(/[?#]/)[0]);
    if (u === "/page") return r.writeHead(200, { "content-type": "text/html; charset=utf-8" }), r.end(cur);
    if (u === "/user.css") return r.writeHead(200, { "content-type": "text/css" }), r.end(fs.readFileSync(CSS));
    const f = u.startsWith("/xpui/") ? path.join(XPUI, path.basename(u)) : "";
    if (f && fs.existsSync(f)) return r.writeHead(200, { "content-type": "text/css" }), r.end(fs.readFileSync(f));
    r.writeHead(404);
    r.end();
  });
  await new Promise((go) => srv.listen(0, "127.0.0.1", go));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const ses = session.fromPartition("mirage-settings-harness");
  ses.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(http:\/\/127\.0\.0\.1|data:|blob:|devtools:|https:\/\/fonts\.(googleapis|gstatic)\.com)/.test(d.url) }));
  void net;
  fs.mkdirSync(OUT, { recursive: true });
  const report = {};
  for (const lang of LANGS) {
    for (const scheme of SCHEMES) {
      cur = page(lang, scheme);
      for (const [w, h] of SIZES) {
        const id = `${lang}-${scheme}-${w}x${h}`;
        const win = new BrowserWindow({ width: w, height: h, useContentSize: true, show: false, webPreferences: { offscreen: true, partition: "mirage-settings-harness", backgroundThrottling: false, contextIsolation: false } });
        win.webContents.setAudioMuted(true);
        const wc = win.webContents;
        // ein frisches Fenster bricht den ersten Ladeversuch manchmal ab (ERR_FAILED): kurz danach noch einmal
        for (let k = 0; ; k++) {
          try {
            await win.loadURL(`${base}/page?${id}-${k}`);
            break;
          } catch (e) {
            if (k > 2) throw e;
            await wait(300);
          }
        }
        await until(`typeof __menu === "object" && !!__menu.brightness`, wc);
        await wc.executeJavaScript(`document.fonts.ready.then(() => 1)`);
        await wc.executeJavaScript(`__menu.brightness(); 1`);
        await until(`!!document.querySelector(".mirage-settings .m-search")`, wc);
        await wait(900);
        const shot = async (name) => fs.writeFileSync(path.join(OUT, `${id}-${name}.png`), (await wc.capturePage()).toPNG());
        await shot("top");
        // Suche aktiv
        await wc.executeJavaScript(`(() => { const s = document.querySelector(".mirage-settings .m-search"); s.focus(); s.value = ${JSON.stringify(lang === "de" ? "blitz" : "flash")}; s.dispatchEvent(new Event("input")); return 1; })()`);
        await wait(400);
        await shot("search");
        await wc.executeJavaScript(`(() => { const s = document.querySelector(".mirage-settings .m-search"); s.value = ""; s.dispatchEvent(new Event("input")); s.blur(); return 1; })()`);
        await wait(200);
        // alle Gruppen offen, mit eingeschaltetem verspieltem Stil (Unter-Einstellung sichtbar)
        await wc.executeJavaScript(`(() => { const c = document.querySelector('.mirage-settings input[data-key="lyrPlayful"]'); if (c && !c.checked) c.click(); document.querySelectorAll(".mirage-settings details.m-group").forEach((d) => (d.open = true)); return 1; })()`);
        await wait(400);
        // mitten in der Party-Gruppe: bleibt die Suche oben stehen?
        await wc.executeJavaScript(`(() => { document.querySelector('.mirage-settings input[data-key="partyFog"]')?.closest(".m-row").scrollIntoView({ block: "center" }); return 1; })()`);
        await wait(300);
        await shot("scrolled");
        report[id] = await wc.executeJavaScript(AUDIT);
        if (!QUICK && w <= 1280) {
          // lange Bilder: das Fenster so hoch wie der ganze Dialog, in Kacheln über die Dialog-Fläche
          // der Dialog läuft in seinem eigenen Bildlauf-Bereich (.m-scroll): das Fenster um dessen versteckten Teil höher
          const full = await wc.executeJavaScript(`(() => { const c = document.querySelector(".mirage-settings .m-scroll") || document.querySelector(".spicetify-popup-content"); c.scrollTop = 0; return innerHeight + c.scrollHeight - c.clientHeight; })()`);
          win.setContentSize(w, Math.min(full + 40, 15000));
          await wait(700);
          const r = await wc.executeJavaScript(`(() => { const r = document.querySelector(".spicetify-popup-container").getBoundingClientRect(); return { x: Math.floor(r.x), y: Math.floor(r.y), w: Math.ceil(r.width), h: Math.ceil(r.height) }; })()`);
          const tile = 1400;
          for (let y = 0, n = 1; y < r.h; y += tile, n++) {
            const img = await wc.capturePage({ x: r.x, y: r.y + y, width: r.w, height: Math.min(tile, r.h - y) });
            fs.writeFileSync(path.join(OUT, `${id}-full-${n}.png`), img.toPNG());
          }
        }
        win.destroy();
        console.log(id, report[id].length ? "\n  " + report[id].join("\n  ") : "sauber");
      }
    }
  }
  fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
  srv.close();
  app.quit();
});
