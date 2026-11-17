// Layout-Prüfstand: Spotify-Seiten (Album, Playlist, Lieblingssongs, Suche, Künstler, Folge) mit Spotifys echten
// Stylesheets (%APPDATA%\Spotify\Apps\xpui, nur gelesen) + Mirage/user.css, versteckt und stumm.
// Misst Überlappungen (angehefteter Spaltenkopf vs. Aktionsleiste/Topbar) bei mehreren Scrollständen und Breiten.
//   npx electron tools/ui-harness/layout.js --css <user.css|none> --out <dir> [--pages album,...] [--widths 1400,900,700] [--modes dark,light]
const { app, BrowserWindow, protocol, session, net } = require("electron");
const fs = require("fs");
const path = require("path");
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
const WT = path.resolve(arg("wt", path.join(__dirname, "..", "..")));
const { build } = require(path.join(WT, "tools/ui-harness/palettes.js"));
const { make } = require(path.join(WT, "tools/ui-harness/fixtures.js"));
const XPUI = path.join(process.env.APPDATA, "Spotify", "Apps", "xpui");
const CSSARG = arg("css", path.join(WT, "Mirage", "user.css"));
const OUT = path.resolve(arg("out", "out"));
const PAGES = arg("pages", "album,playlist,liked,search,artist,episode,show").split(",");
const WIDTHS = arg("widths", "1500,1000,760").split(",").map(Number);
const MODES = arg("modes", "dark,light").split(",");
const SHOTS = arg("shots", "1") === "1";
const EXTRA = arg("extra", "");
setTimeout(() => { console.error("TIMEOUT"); app.exit(2); }, 240000);
app.commandLine.appendSwitch("mute-audio");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
protocol.registerSchemesAsPrivileged([{ scheme: "mui", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
for (const ev of ["uncaughtException", "unhandledRejection"]) process.on(ev, (e) => { console.error(e); app.exit(1); });

const SPICETIFY = /^(user|colors)\.css$|^spicetify-|^xpui-modules/;
const OTHER = /^(pip-|xpui-pip-|xpui-debug-window)/;
const spotifyCss = fs.readdirSync(XPUI).filter((f) => f.endsWith(".css") && !SPICETIFY.test(f) && !OTHER.test(f))
  .sort((a, b) => (a === "xpui-snapshot.css" ? -1 : b === "xpui-snapshot.css" ? 1 : a.localeCompare(b)));
const E = (fs.readFileSync(path.join(XPUI, "xpui-snapshot.css"), "utf8").match(/\.(e-\d+)-button-primary__inner/) || [])[1] || "e-101040";
const F = make(E);
const pages = new Map();
const TYPES = { ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".png": "image/png" };
const serve = (f) => fs.existsSync(f) ? new Response(fs.readFileSync(f), { headers: { "content-type": TYPES[path.extname(f)] || "application/octet-stream" } }) : new Response("", { status: 404 });

// --- Bausteine (Markup nach den React-Aufrufen in xpui-modules.js / 824.js / xpui-routes-*.js) ---
const ICONBTN = (label, ic) => `<button data-encore-id="buttonTertiary" aria-label="${label}" class="${E}-legacy-button ${E}-legacy-button-tertiary ${E}-overflow-wrap-anywhere ${E}-focus-border ${E}-button-tertiary--icon-only-medium ${E}-button-tertiary--icon-only encore-internal-color-text-subdued"><span aria-hidden="true" class="${E}-button__icon-wrapper"><svg data-encore-id="icon" role="img" aria-hidden="true" class="${E}-icon" viewBox="0 0 24 24" style="--encore-icon-height:var(--encore-graphic-size-decorative-larger);--encore-icon-width:var(--encore-graphic-size-decorative-larger)"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg></span></button>`;
const PLAYBTN = () => `<div class="main-playButton-PlayButton" role="div"><button data-encore-id="buttonPrimary" data-is-icon-only="true" class="${E}-focus-border ${E}-legacy-button-primary ${E}-legacy-button" aria-label="Play" data-testid="play-button"><span class="${E}-overflow-wrap-anywhere ${E}-button-primary__inner encore-bright-accent-set ${E}-button-icon-only--large"><span aria-hidden="true" class="${E}-button__icon-wrapper"><svg data-encore-id="icon" role="img" aria-hidden="true" class="${E}-icon" viewBox="0 0 24 24" style="--encore-icon-height:var(--encore-graphic-size-decorative-base);--encore-icon-width:var(--encore-graphic-size-decorative-base)"><path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606"/></svg></span></span></button></div>`;
const topBar = (title) => `
<div class="main-topBar-container" style="--top-bar-opacity:0">
 <div class="main-topBar-background" style="background-color:rgb(72,56,104);opacity:var(--top-bar-opacity)"></div>
 <div class="main-topBar-topbarContentWrapper"><div class="main-topBar-topbarContent" style="opacity:var(--top-bar-opacity);padding:0 24px">${PLAYBTN().replace("--large", "--medium")}<span class="${E}-text-title-medium" data-encore-id="text">${title}</span></div></div>
</div>`;
const entityHeader = (kind, title, std = "main-entityHeader-standardHeight") => `
<div class="main-entityHeader-container main-entityHeader-nonWrapped main-entityHeader-newEntityHeader ${std}" data-testid="entity-header" style="height:var(--optimized-entity-header-height);min-height:var(--optimized-entity-header-min-height);max-height:none">
 <div class="main-entityHeader-background main-entityHeader-gradient" style="background-color:rgb(72,56,104)"></div>
 <div class="main-entityHeader-background main-entityHeader-overlay"></div>
 <div class="main-entityHeader-imageContainer main-entityHeader-imageContainerNew" draggable="true"><div class="main-entityHeader-image" style="width:100%;height:100%;background:linear-gradient(135deg,rgb(var(--m-c-rgb)),rgb(var(--m-b-rgb)));border-radius:4px"></div></div>
 <div class="main-entityHeader-headerText">
  <span class="${E}-text-body-small-bold" data-encore-id="text">${kind}</span>
  <span class="${E}-text-title-large main-entityHeader-title" data-encore-id="text" style="font-size:6rem"><h1 class="${E}-text-title-large" data-encore-id="text" dir="auto">${title}</h1></span>
  <div class="main-entityHeader-metaData"><span class="${E}-text-body-small-bold" data-encore-id="text"><a href="#">Mirage Ensemble</a></span><span class="main-entityHeader-divider ${E}-text-body-small" data-encore-id="text">2025</span><span class="main-entityHeader-divider ${E}-text-body-small" data-encore-id="text">12 Songs, 41 Min.</span></div>
 </div>
</div>`;
const actionBar = (extra = "") => `
<div class="main-actionBarBackground-background" style="background-color:rgb(72,56,104)"></div>
<div class="main-actionBar-ActionBar contentSpacing" data-testid="action-bar">
 <div class="main-actionBar-ActionBarRow main-actionBar-ActionBarRowResponsive" data-testid="action-bar-row" style="--action-bar-row-actions-width:200px">
  ${PLAYBTN()}
  <div class="main-actionBar-ActionBarRowActions">${ICONBTN("Save to Your Library", "add")}${ICONBTN("Download", "dl")}${ICONBTN("More options for Album", "more")}</div>
  <div class="main-actionBar-ActionBarRowTrailing">${extra}<button class="${E}-legacy-button ${E}-legacy-button-tertiary" data-encore-id="buttonTertiary" style="color:var(--text-subdued)">List</button></div>
 </div>
</div>`;
const headerCell = (i, label) => `<div class="main-trackList-rowSection${i === 1 ? "Index" : i === 2 ? "Start" : i === 3 ? "Variable" : "End"}" role="columnheader" aria-colindex="${i}" aria-sort="none" tabindex="-1"><div><button class="main-trackList-column main-trackList-sortable" tabindex="-1"><span class="${E}-text-body-small standalone-ellipsis-one-line" data-encore-id="text">${label}</span></button></div></div>`;
const trackList = (n, cols = 4, top) => {
  const rows = Array.from({ length: n }, (_, i) => F.row ? "" : "").join("");
  const one = (i) => `<div role="row" aria-rowindex="${i + 2}" aria-selected="false"><div data-testid="tracklist-row" class="main-trackList-trackListRow main-trackList-trackListRowGrid" draggable="true" role="presentation" style="height:56px">
   <div class="main-trackList-rowSectionIndex" role="gridcell" aria-colindex="1"><div class="main-trackList-rowMarker"><span class="${E}-text-body-medium main-trackList-number" data-encore-id="text">${i + 1}</span></div></div>
   <div class="main-trackList-rowSectionStart" role="gridcell" aria-colindex="2"><div class="main-trackList-rowMainContent"><div class="${E}-text-body-medium main-trackList-rowTitle standalone-ellipsis-one-line" data-encore-id="text">Glass Hour ${i + 1}</div><span class="${E}-text-body-small encore-internal-color-text-subdued main-trackList-rowSubTitle standalone-ellipsis-one-line" data-encore-id="text">Mirage Ensemble</span></div></div>
   ${cols > 3 ? `<div class="main-trackList-rowSectionVariable" role="gridcell" aria-colindex="3"><span class="${E}-text-body-small">Glass Hours</span></div>` : ""}
   <div class="main-trackList-rowSectionEnd" role="gridcell" aria-colindex="${cols}"><div class="${E}-text-body-small encore-internal-color-text-subdued main-trackList-rowDuration" data-encore-id="text">3:4${i % 10}</div></div></div></div>`;
  return `<div class="main-trackList-trackListContainer"><div role="grid" aria-rowcount="${n + 1}" aria-colcount="${cols}" aria-label="Album" class="main-trackList-trackList main-trackList-indexable" tabindex="0" data-testid="track-list" style="--row-height:56px;--grid-template-columns:${cols > 3 ? "[index] var(--tracklist-index-column-width, 16px) [first] minmax(120px, var(--col1, 4fr)) [var1] minmax(120px, var(--col2, 2fr)) [last] minmax(120px, var(--col3, 1fr))" : "[index] 16px [first] 4fr [last] minmax(120px,1fr)"}">
   <div class="main-trackList-trackListHeader"${top === undefined ? ' style="top:64px"' : ` style="top:${top}px"`}><div role="row" aria-rowindex="1" class="main-trackList-trackListHeaderRow main-trackList-trackListRowGrid">${headerCell(1, "#")}${headerCell(2, "Title")}${cols > 3 ? headerCell(3, "Album") : ""}${headerCell(cols, "⏱")}</div></div>
   <div style="height:${n * 56}px;position:relative"><div role="presentation">${Array.from({ length: n }, (_, i) => one(i)).join("")}</div></div>
  </div></div>`;
};
const contentWrap = (inner) => `<div class="main-view-container__scroll-node-child"><main aria-label="x" style="display:block">${inner}</main><div class="main-view-container__mh-footer-container" style="height:200px"></div></div>`;

const PAGEDEF = {
  album: () => ({ title: "Glass Hours", body: `<section data-testid="album-page">${entityHeader("Album", "Glass Hours")}<div class="contentSpacing" style="padding:0">${actionBar()}<div class="contentSpacing">${trackList(30)}</div></div></section>` }),
  playlist: () => ({ title: "Mirage Mix", body: `<section data-testid="playlist-page" class="playlist-playlist-playlist">${entityHeader("Playlist", "Mirage Mix")}<div class="playlist-playlist-playlistContent contentSpacing" style="padding:0">${actionBar(`<div role="search" class="playlist-playlist-searchBoxContainer">${ICONBTN("Search in playlist", "s")}</div>`)}<div class="contentSpacing">${trackList(40)}</div></div></section>` }),
  liked: () => ({ title: "Liked Songs", body: `<section data-testid="playlist-page" class="playlist-playlist-playlist">${entityHeader("Playlist", "Liked Songs")}<div class="contentSpacing" style="padding:0">${actionBar()}<div class="contentSpacing">${trackList(40)}</div></div></section>` }),
  search: () => ({ title: "", noHeader: true, body: `<div class="contentSpacing"><div style="height:48px"></div><div class="search-searchResult-tracklist" style="padding-top:16px">${trackList(40, 3, 48)}</div></div>` }),
  artist: () => ({ title: "Mirage Ensemble", body: `<section data-testid="artist-page"><div class="main-entityHeader-container main-entityHeader-withBackgroundImage main-entityHeader-nonWrapped main-entityHeader-newEntityHeader main-entityHeader-fullBleedHeight" data-testid="entity-header" style="height:var(--optimized-entity-header-height);min-height:var(--optimized-entity-header-min-height);max-height:none"><div data-testid="background-image" class="main-entityHeader-background" style="background:linear-gradient(135deg,#638,#226)"></div><div class="main-entityHeader-headerText"><span class="main-entityHeader-title"><h1 data-encore-id="text">Mirage Ensemble</h1></span></div></div><div class="contentSpacing" style="padding:0">${actionBar()}<div class="contentSpacing"><h2 data-encore-id="text" class="${E}-text-title-medium">Popular</h2>${trackList(10, 3, 0)}<div style="height:1400px"></div></div></div></section>` }),
  episode: () => ({ title: "Folge 12", body: `<section data-testid="episode-page">${entityHeader("Podcast-Folge", "Folge 12: Glas")}<div class="contentSpacing" style="padding:0">${actionBar()}<div class="contentSpacing"><div style="height:1600px;padding-top:24px"><h2 class="${E}-text-title-medium">Beschreibung</h2><p>Lorem ipsum</p></div></div></div></section>` }),
  show: () => ({ title: "Show", body: `<section data-testid="show-page">${entityHeader("Podcast", "Glas-Funk")}<div class="contentSpacing" style="padding:0">${actionBar(`<button class="${E}-legacy-button ${E}-legacy-button-secondary" data-encore-id="buttonSecondary">Folgen</button>`)}<div class="contentSpacing"><div style="height:1600px"></div></div></div></section>` }),
};

const HARNESS = `html,body{margin:0;height:100%}a{color:inherit;text-decoration:none}
.Root__top-container{grid-template:"main-view" 1fr/1fr!important;padding:8px!important;height:100vh!important;box-sizing:border-box}`;
function pageHtml(def, mode, data, css) {
  const sc = data.schemes[mode];
  const p = data.palettes[mode][0];
  const links = spotifyCss.map((f) => `<link rel="stylesheet" href="/xpui/${f}">`).join("");
  return `<!doctype html><html lang="de" dir="ltr" class="encore-dark-theme encore-layout-themes mirage-vinyl mirage-glass${sc.light ? " mirage-light" : ""}" data-m-page="${def.page}" data-m-scheme="${sc.name}" style="${p.vars}">
<head><meta charset="utf-8">${links}<style id="mirage-scheme">html:root{${sc.vars}}</style><style>${HARNESS}</style></head>
<body>${css ? '<link rel="stylesheet" href="/mirage/user.css">' : ""}${EXTRA ? `<style>${fs.readFileSync(EXTRA, "utf8")}</style>` : ""}
<div id="main"><div class="Root global-nav centered-layout"><div class="Root__top-container">
<div id="main-view" class="Root__main-view"><div class="main-view-container">
${def.noHeader ? "" : topBar(def.title)}
<div class="main-view-container__scroll-node" data-overlayscrollbars-initialize=""><div data-overlayscrollbars-viewport="scrollbarHidden overflowXHidden overflowYScroll" tabindex="-1" style="overflow:hidden scroll;height:100%">
${contentWrap(def.body)}
</div></div></div></div></div></div></div>
<script>window.THEMEJS = ${JSON.stringify(arg("themejs", "after"))};
// Spotify-Verhalten nachbauen: Topbar-Deckkraft über Scroll, Spaltenkopf "stuck" per IntersectionObserver (wie D.Wx im Client)
const vp = document.querySelector('[data-overlayscrollbars-viewport]');
const tb = document.querySelector('.main-topBar-container');
// Spotify blendet den kleinen Kopf über 76 px Scrollweg ab etwa Kopfhöhe ein (dwp-top-bar: i(scrollTop, p, 76))
const ehH = (document.querySelector('[data-testid="entity-header"]') || { offsetHeight: 0 }).offsetHeight;
const bg = document.querySelector('.main-topBar-background');
vp.addEventListener('scroll', () => { const o = Math.max(0, Math.min(1, (vp.scrollTop - ehH) / 76)); if (bg) bg.style.setProperty('opacity', o.toPrecision(2)); if (tb) tb.style.setProperty('--top-bar-opacity', o); markSticky(); });
// theme.js (src/tints.js markSticky) nachgebaut
function markSticky() { if (window.THEMEJS === 'none') return; const h = document.querySelector('.main-trackList-trackListHeader'); if (!h) return; const g = h.closest('[role=grid]'); const st = h.getBoundingClientRect().top - g.getBoundingClientRect().top > 2; h.toggleAttribute('data-m-stuck', st); if (window.THEMEJS === 'after') document.querySelector('.Root__main-view').classList.toggle('m-head-stuck', st); }
const h = document.querySelector('.main-trackList-trackListHeader');
if (h) { const top = parseFloat(h.style.top) || 0; new IntersectionObserver(([e]) => h.classList.toggle('iPo4a2lbrsxW9Iedav3h', !e.isIntersecting || e.intersectionRatio < 1), { root: vp, threshold: [1], rootMargin: '-' + (top + 1) + 'px 100000px 100px 100000px' }).observe(h); }
</script></body></html>`;
}

const MEASURE = `(() => {
  const hdrBgAlpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 0; const p = m[1].split(','); return p.length > 3 ? +p[3] : 1; };
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height) }; };
  const vp = document.querySelector('[data-overlayscrollbars-viewport]');
  const hdr = r('.main-trackList-trackListHeader'), row = r('.main-trackList-trackListHeaderRow'), ab = r('[data-testid="action-bar-row"]'), abo = r('.main-actionBar-ActionBar'), tb = r('.main-topBar-container'), eh = r('[data-testid="entity-header"]'), mv = r('.Root__main-view'), ehText = r('.main-entityHeader-headerText'), meta = r('.main-entityHeader-metaData'), title = r('.main-entityHeader-title');
  const first = r('[data-testid="tracklist-row"]');
  const hEl = document.querySelector('.main-trackList-trackListHeader');
  const cs = hEl && getComputedStyle(hEl);
  // sichtbarer Teil der Aktionsleiste unter der Topbar
  const out = { scroll: vp.scrollTop, hdr, row, ab, abo, tb, eh, ehText, meta, title, first, mv,
    stuck: hEl && hEl.classList.contains('iPo4a2lbrsxW9Iedav3h'), tbOp: document.querySelector('.main-topBar-background') && +getComputedStyle(document.querySelector('.main-topBar-background')).opacity, mstuck: hEl && hEl.hasAttribute('data-m-stuck'),
    hdrBg: cs && cs.backgroundColor, hdrPos: cs && cs.position, hdrTop: cs && cs.top, hdrMargin: cs && cs.margin,
    vw: innerWidth, scrollW: vp.scrollWidth, clientW: vp.clientWidth };
  const issues = [];
  if (hdr && ab && hdr.t < ab.b - 1 && hdr.b > ab.t + 1 && ab.b > (tb ? tb.b : mv.t)) issues.push('Spaltenkopf überlappt Aktionsleiste um ' + (ab.b - hdr.t) + 'px');
  if (hdr && ab && row && row.t < ab.b - 1 && row.b > ab.t && ab.b > (tb ? tb.b : mv.t)) issues.push('Kopfzeile überlappt Aktionsleiste um ' + (ab.b - row.t) + 'px');
  if (ehText && eh && ehText.b > eh.b + 1) issues.push('Kopftext ragt ' + (ehText.b - eh.b) + 'px aus dem Kopf');
  if (ehText && abo && ehText.b > abo.t + 1 && abo.b > (tb ? tb.b : 0)) issues.push('Kopftext überlappt Aktionsleiste um ' + (ehText.b - abo.t) + 'px');
  if (first && hdr && first.t < hdr.b - 1 && first.b > hdr.b && hdr.t >= (tb ? tb.b - 1 : 0) && !out.stuck) issues.push('erste Zeile unter dem Kopf ' + (hdr.b - first.t) + 'px');
  if (vp.scrollWidth > vp.clientWidth + 1) issues.push('horizontaler Überlauf ' + (vp.scrollWidth - vp.clientWidth) + 'px');
  if (ab && mv && ab.r > mv.r - 10) issues.push('Aktionsleiste ragt rechts hinaus ' + (ab.r - mv.r) + 'px');
  if (hdr && tb && out.stuck && hdr.t < tb.b - 1) issues.push('angehefteter Kopf unter der Topbar ' + (tb.b - hdr.t) + 'px');
  if (out.stuck && out.tbOp !== null && out.tbOp < 0.97 && ab && ab.b > mv.t + 2) issues.push('Aktionsleiste scheint durch kleinen Kopf über angeheftetem Spaltenkopf (Deckkraft ' + out.tbOp + ')');
  if (out.stuck && hdrBgAlpha(out.hdrBg) < 0.9) issues.push('angehefteter Spaltenkopf durchsichtig (' + out.hdrBg + ')');
  out.issues = issues;
  return out;
})()`;

app.whenReady().then(async () => {
  const ses = session.fromPartition("mirage-layout");
  ses.protocol.handle("mui", (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname);
    if (p.startsWith("/page/")) return new Response(pages.get(p.slice(6)) || "", { headers: { "content-type": "text/html" } });
    if (p === "/mirage/user.css") return serve(CSSARG);
    if (p.startsWith("/xpui/")) return serve(path.join(XPUI, path.normalize(p.slice(6)).replace(/^(\.\.[\\/])+/, "")));
    return new Response("", { status: 404 });
  });
  ses.protocol.handle("https", (req) => {
    const u = new URL(req.url);
    if (u.host === "encore.scdn.co" && u.pathname.startsWith("/fonts/")) return serve(path.join(XPUI, "fonts", path.basename(u.pathname).replace(/-[0-9a-f]{32}(?=\.woff2?$)/, "")));
    if (u.host === "fonts.googleapis.com" || u.host === "fonts.gstatic.com") return net.fetch(req, { bypassCustomProtocolHandlers: true });
    return new Response("", { status: 404 });
  });
  const data = await build(WT);
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: 1500, height: 900, useContentSize: true, show: false, webPreferences: { offscreen: true, partition: "mirage-layout", backgroundThrottling: false } });
  win.webContents.setAudioMuted(true);
  const results = [];
  const css = CSSARG !== "none";
  for (const page of PAGES) for (const mode of MODES) {
    const def = { ...PAGEDEF[page](), page };
    const id = `${page}-${mode}`;
    pages.set(id + ".html", pageHtml(def, mode, data, css));
    for (const w of WIDTHS) {
      win.setContentSize(w, 860);
      await win.loadURL(`mui://app/page/${id}.html`);
      await win.webContents.executeJavaScript("document.fonts.ready.then(()=>1)");
      await new Promise((r) => setTimeout(r, 700));
      for (const sc of [0, 120, 200, 260, 330, 420, 700]) {
        await win.webContents.executeJavaScript(`document.querySelector('[data-overlayscrollbars-viewport]').scrollTop=${sc};document.querySelector('[data-overlayscrollbars-viewport]').dispatchEvent(new Event('scroll'))`);
        await new Promise((r) => setTimeout(r, 260));
        const m = await win.webContents.executeJavaScript(MEASURE);
        results.push({ page, mode, w, sc, ...m });
        if (m.issues.length) console.log(`${page} ${mode} w=${w} sc=${sc}(${m.scroll}): ${m.issues.join("; ")}`);
        if (SHOTS && (sc === 0 || sc === 260 || sc === 420) && mode === "dark") fs.writeFileSync(path.join(OUT, `${id}-${w}-s${sc}.png`), (await win.webContents.capturePage()).toPNG());
      }
    }
  }
  fs.writeFileSync(path.join(OUT, "layout.json"), JSON.stringify(results, null, 1));
  console.log("fertig:", results.length, "Messungen,", results.filter((r) => r.issues.length).length, "mit Befund");
  app.quit();
});
