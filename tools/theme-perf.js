// Leistung des ganzen Themes durchmessen (nicht nur Party, dafür gibt es tools/party-perf.js): das echte Theme
// (Mirage/theme.js + user.css) im kopflosen Electron, in einem Nachbau der Spotify-Oberfläche mit Spotifys ECHTEN
// Stylesheets (%APPDATA%\Spotify\Apps\xpui, nur gelesen – fehlen sie, ohne) und dem Test-Spotify aus tests/e2e.
// Szenarien (je eine Chromium-Timeline, ausgewertet wie in party-perf.js):
//   startup  Laden bis 8 s danach: Übersetzen/Ausführen von theme.js, lange Aufgaben, Stil/Layout
//   idle     30 s auf einer Playlist, Musik läuft, Fenster aktiv, keine Eingabe (Hintergrund, Spielzeit, Zeitgeber)
//   rest     dasselbe, aber Spotify ist nicht das aktive Fenster (Musik im Hintergrund, man arbeitet woanders)
//   scroll   lange Titelliste (200 Zeilen, wie Spotify virtualisiert) mit dem Mausrad runter und wieder hoch
//   hover    Maus über Titelzeilen und Karten (Startseite)
//   song     drei Songwechsel (Farbwechsel, Cover, Analyse)
//   nav      Seitenwechsel Startseite → Playlist → Album → Suche → Bibliothek
//   cover · lyrics · viz · mix · party · clock   je eine Immersiv-Ansicht 20 s
// Gemessen: Hauptthread ms je s (gesamt, Skript, Stil, Layout, Zeichnen), Stil-Elemente je s, Raster- und
// GPU-Zeit, Bildabstände (rAF), lange Aufgaben; dazu Speicher (JS-Heap nach GC, DOM-Knoten) am Anfang und Ende.
//   npm run perf:theme                            alles, Bericht in tests/e2e/out/theme-perf.json
//   npm run perf:theme -- --only idle,scroll      nur diese Szenarien
//   npm run perf:theme -- --check                 zusätzlich das Budget prüfen (Exit-Code 1, wenn gerissen)
//   npm run perf:theme -- --trace                 Timelines behalten (tests/e2e/out/theme-perf-<Szenario>.json, für DevTools)
//   PERF_CATS=disabled-by-default-devtools.timeline.invalidationTracking   dazu: wer Stil/Layout auslöst
//   PERF_EXTRA_CSS=pfad.css (zusätzliche Regeln nach user.css, für Versuche) PERF_BARE=1 (ohne Mirage)
//   PERF_THEME=pfad/theme.js PERF_CSS=pfad/user.css PERF_SET='{"preset":"full",...}' PERF_IM_SECS=20 PERF_IDLE_SECS=30
// Budget (--check): relativ zu einer Eichmessung im selben Lauf (fester Stil-/Layout-Durchgang in einem eigenen
// Rahmen ohne Mirage), damit ein langsamer Rechner nicht durchfällt und ein schneller keinen Rückschritt versteckt.
const { app, BrowserWindow, protocol, session, contentTracing, net } = require("electron");
const fs = require("fs"), path = require("path");

const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "tests", "e2e", "out");
const arg = (n, d) => {
  const i = process.argv.indexOf("--" + n);
  return i > 0 ? process.argv[i + 1] : d;
};
const ALL = ["startup", "idle", "rest", "scroll", "hover", "song", "nav", "cover", "lyrics", "viz", "mix", "party", "clock"];
const ONLY = (arg("only", "") || "").split(",").filter(Boolean);
const RUN = new Set(ONLY.length ? ONLY : ALL);
const CHECK = process.argv.includes("--check");
const KEEP_TRACE = process.argv.includes("--trace");
const IM_SECS = Number(process.env.PERF_IM_SECS) || 20;
const IDLE_SECS = Number(process.env.PERF_IDLE_SECS) || 30;
const W = 1600, H = 900;
const XPUI = path.join(process.env.APPDATA || "", "Spotify", "Apps", "xpui");
const HAS_XPUI = fs.existsSync(path.join(XPUI, "xpui-snapshot.css"));
const THEME = process.env.PERF_THEME || path.join(ROOT, "Mirage", "theme.js");
const CSS = process.env.PERF_CSS || path.join(ROOT, "Mirage", "user.css");
// Preset „Ausgewogen“ wie nach der Installation; autoPerf aus, damit die Stufe nicht mitten im Lauf wechselt
const SETTINGS = { preset: "balanced", presetBase: "balanced", autoPerf: false, partyOnline: false, onlineLyrics: false, remoteFix: false, libBpm: false, ...JSON.parse(process.env.PERF_SET || "{}") };

// Budget (--check): busy/style/layout/script als Vielfache der Eichung (ms je s geteilt durch ms des Eich-Durchgangs),
// long als feste Zahl langer Aufgaben (> 50 ms). Gemessen nach den Verbesserungen in 1.32 (Eichung ~2,3 ms, Desktop
// mit Grafikkarte): idle 58 ms/s, rest 21, cover 95, lyrics 56, clock 23, Layout im Leerlauf ~3 ms/s. Die Grenzen
// lassen gut 1,5- bis 2-fache Luft, fangen aber die Rückschritte, für die es sie gibt: ein :has() am Gerüst ließ
// jede Sekunde die ganze Seite neu layouten (Layout ~45 ms/s, eine lange Aufgabe je Sekunde), Dauer-Animationen
// im Hintergrund kosteten ruhend ~90 ms/s. Szenario scroll/hover/nav messen vor allem den Spotify-Nachbau
// (ohne Mirage: scroll ~530, hover ~115 ms/s) – dort nur grobe Grenzen gegen Ausreißer.
const BUDGET = {
  idle: { busy: 35, style: 6, layout: 5, long: 0 },
  rest: { busy: 20, style: 2, layout: 5, long: 0 },
  scroll: { script: 80 },
  hover: { busy: 220 },
  song: { busy: 100, long: 2 },
  nav: { busy: 300, long: 8 },
  cover: { busy: 70, layout: 5, long: 0 },
  lyrics: { busy: 50, layout: 5, long: 0 },
  viz: { busy: 110, layout: 5, long: 1 },
  mix: { busy: 110, layout: 5, long: 1 },
  party: { busy: 140, layout: 5, long: 1 },
  clock: { busy: 20, layout: 5, long: 1 },
};

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("mute-audio");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.commandLine.appendSwitch("js-flags", "--expose-gc");
if (process.env.PERF_SW) app.commandLine.appendSwitch("disable-gpu");
protocol.registerSchemesAsPrivileged([{ scheme: "mui", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
for (const ev of ["uncaughtException", "unhandledRejection"]) process.on(ev, (e) => { console.error(e); app.exit(2); });
// hängt ein Schritt (Seite antwortet nicht), nicht ewig weiterlaufen: ein verwaistes Fenster verfälscht sonst die
// Messungen danach
setTimeout(() => { console.log("Messung abgebrochen: Zeitüberschreitung"); app.exit(2); }, 20 * 60 * 1000).unref?.();

// PERF_DEBUG=1: jeden Schritt melden (hängt ein Lauf, sieht man wo)
const step = process.env.PERF_DEBUG ? (m) => console.log("· " + m) : () => {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (v) => Math.round(v * 100) / 100;
const q = (arr, p) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/* ---------------------------------------------------------------- Spotify-Nachbau */
const SPICETIFY = /^(user|colors)\.css$|^spicetify-|^xpui-modules/;
const OTHER = /^(pip-|xpui-pip-|xpui-debug-window)/;
const spotifyCss = HAS_XPUI
  ? fs.readdirSync(XPUI).filter((f) => f.endsWith(".css") && !SPICETIFY.test(f) && !OTHER.test(f))
    .sort((a, b) => (a === "xpui-snapshot.css" ? -1 : b === "xpui-snapshot.css" ? 1 : a.localeCompare(b)))
  : [];
const E = HAS_XPUI ? (fs.readFileSync(path.join(XPUI, "xpui-snapshot.css"), "utf8").match(/\.(e-\d+)-button-primary__inner/) || [])[1] || "e-101040" : "e-101040";
// Schemafarben wie Spicetifys colors.css (Mirage/color.ini, Abschnitt [Mirage])
function colorsCss() {
  const ini = fs.readFileSync(path.join(ROOT, "Mirage", "color.ini"), "utf8");
  const sec = ini.split(/^\[/m).find((s) => s.startsWith("Mirage]")) || "";
  const vars = [...sec.matchAll(/^\s*([\w-]+)\s*=\s*([0-9a-fA-F]{6})/gm)].map(([, k, v]) => `--spice-${k}:#${v};--spice-rgb-${k}:${[0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)).join(",")};`).join("");
  return `:root{${vars}}`;
}
// Cover vom „Bildserver“: je Bild-ID andere Farben (drei Flächen und ein Kreis, wie ein Foto mit Hauptfarbe und Akzent),
// als echtes PNG wie Spotifys JPEGs (ein SVG-Cover würde Chromium bei jeder Drehung neu zeichnen – das maß sonst
// den Nachbau statt Mirage)
const zlib = require("zlib");
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const hsl = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
};
const covers = new Map();
function coverPng(id) {
  if (covers.has(id)) return covers.get(id);
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = h % 360, b = (a + 40 + ((h >> 9) % 120)) % 360;
  const A = hsl(a, 0.75, 0.48), B = hsl(b, 0.8, 0.55), C = hsl(a, 0.5, 0.16), D = hsl((a + 180) % 360, 0.6, 0.7);
  const N = 64, raw = Buffer.alloc(N * (N * 3 + 1));
  for (let y = 0; y < N; y++) {
    raw[y * (N * 3 + 1)] = 0;
    for (let x = 0; x < N; x++) {
      const c = (x - 44) ** 2 + (y - 20) ** 2 < 100 ? D : y < 30 ? A : y < 50 ? B : C;
      raw.set(c, y * (N * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  covers.set(id, png);
  return png;
}
const IMG = (n) => `https://i.scdn.co/image/ab67616d00004851${String(n).padStart(24, "0")}`;
const icon = (d = "<circle cx='12' cy='12' r='9'/>") => `<svg data-encore-id="icon" role="img" aria-hidden="true" class="${E}-icon" viewBox="0 0 24 24" style="--encore-icon-height:var(--encore-graphic-size-decorative-base);--encore-icon-width:var(--encore-graphic-size-decorative-base)">${d}</svg>`;
const tertiary = (label, cls = "") => `<button data-encore-id="buttonTertiary" aria-label="${label}" class="${cls} ${E}-legacy-button ${E}-legacy-button-tertiary ${E}-overflow-wrap-anywhere ${E}-focus-border ${E}-button-tertiary--icon-only-medium ${E}-button-tertiary--icon-only encore-internal-color-text-subdued"><span aria-hidden="true" class="${E}-button__icon-wrapper">${icon()}</span></button>`;
const playBtn = (size = "large") => `<div class="main-playButton-PlayButton" role="div"><button data-encore-id="buttonPrimary" data-is-icon-only="true" class="${E}-focus-border ${E}-legacy-button-primary ${E}-legacy-button" aria-label="Play" data-testid="play-button"><span class="${E}-overflow-wrap-anywhere ${E}-button-primary__inner encore-bright-accent-set ${E}-button-icon-only--${size}"><span aria-hidden="true" class="${E}-button__icon-wrapper">${icon("<path d='m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606'/>")}</span></span></button></div>`;
const card = (i, title) => `<div class="Card" style="width:180px"><div data-encore-id="card" role="group" class="${E}-legacy-box ${E}-legacy-box--naked ${E}-legacy-box--interactive ${E}-card main-card-card" draggable="true">
 <div class="${E}-card__on-click"></div><div class="main-card-imageContainer" style="position:relative"><div data-encore-id="cardImage" class="${E}-card-image"><img class="main-image-image" src="${IMG(i)}" alt="" loading="lazy" style="width:100%;aspect-ratio:1;border-radius:6px"></div>
 <div class="main-card-PlayButtonContainer">${playBtn("medium")}</div></div>
 <a href="#" class="${E}-text-body-medium-bold main-card-cardTitleLink ${E}-card-title" data-encore-id="cardTitle" title="${title}">${title}</a>
 <div class="${E}-text-body-small encore-internal-color-text-subdued" data-encore-id="cardSubtitle">Playlist · Mirage</div></div></div>`;
const shelf = (title, from, n = 8) => `<section class="main-shelf-shelf Shelf" aria-label="${title}"><div class="main-shelf-header"><div class="main-shelf-topRow"><h2 class="${E}-text-title-medium main-shelf-title" data-encore-id="text"><a href="#">${title}</a></h2></div></div>
 <div class="main-gridContainer-gridContainer main-shelf-shelfGrid" data-testid="grid-container" style="--column-count:8;--min-container-width:180px;--grid-gap:24px;--column-width:180px;display:grid;grid-template-columns:repeat(8,180px);gap:24px">${Array.from({ length: n }, (_, k) => card(from + k, title + " " + (k + 1))).join("")}</div></section>`;
const row = (i, active) => `<div role="row" aria-rowindex="${i + 2}" aria-selected="false"><div data-testid="tracklist-row" class="main-trackList-trackListRow main-trackList-trackListRowGrid${active ? " main-trackList-active" : ""}" draggable="true" role="presentation">
 <div class="main-trackList-rowSectionIndex" role="gridcell" aria-colindex="1" tabindex="-1"><div class="main-trackList-rowMarker">${active ? `<img class="main-trackList-playingIcon" width="14" height="14" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'/%3E">` : `<span class="${E}-text-body-medium main-trackList-number" data-encore-id="text">${i + 1}</span>`}<button class="main-trackList-rowImagePlayButton" aria-label="Play" tabindex="-1">${icon()}</button></div></div>
 <div class="main-trackList-rowSectionStart" role="gridcell" aria-colindex="2" tabindex="-1"><img aria-hidden="false" draggable="false" loading="eager" src="${IMG(i)}" alt="" class="main-image-image main-trackList-rowImage" width="40" height="40">
  <div class="main-trackList-rowMainContent"><a draggable="false" class="${E}-text-body-medium main-trackList-rowTitle standalone-ellipsis-one-line" data-encore-id="text" dir="auto" href="#" tabindex="-1"><div class="${E}-text-body-medium" data-encore-id="text">Glass Hour ${i + 1}</div></a>
  <span class="${E}-text-body-small encore-internal-color-text-subdued main-trackList-rowSubTitle standalone-ellipsis-one-line" data-encore-id="text"><a draggable="false" dir="auto" href="#" tabindex="-1">Mirage Ensemble</a>, <a draggable="false" dir="auto" href="#" tabindex="-1">Guest ${i % 7}</a></span></div></div>
 <div class="main-trackList-rowSectionVariable" role="gridcell" aria-colindex="3" tabindex="-1"><span data-encore-id="text" class="${E}-text-body-small encore-internal-color-text-subdued"><a draggable="false" class="standalone-ellipsis-one-line" dir="auto" href="#" tabindex="-1">Glass Hours ${i % 13}</a></span></div>
 <div class="main-trackList-rowSectionVariable" role="gridcell" aria-colindex="4" tabindex="-1"><span data-encore-id="text" class="${E}-text-body-small encore-internal-color-text-subdued main-trackList-rowDateAdded">vor ${i % 9 + 1} Tagen</span></div>
 <div class="main-trackList-rowSectionEnd" role="gridcell" aria-colindex="5" tabindex="-1">${tertiary("Add to playlist", "main-trackList-rowAddToPlaylistButton")}<div class="${E}-text-body-small encore-internal-color-text-subdued main-trackList-rowDuration" data-encore-id="text">3:${String(10 + (i % 50)).padStart(2, "0")}</div>${tertiary("More options", "main-trackList-rowMoreButton")}</div>
</div></div>`;
const headCell = (i, label) => `<div class="main-trackList-rowSection${["Index", "Start", "Variable", "Variable", "End"][i - 1]}" role="columnheader" aria-colindex="${i}" aria-sort="none" tabindex="-1"><button class="main-trackList-column main-trackList-sortable" tabindex="-1"><span class="${E}-text-body-small standalone-ellipsis-one-line" data-encore-id="text">${label}</span></button></div>`;
// Titelliste wie Spotify: nur die Zeilen im Blick (plus Rand) stehen im DOM, verschoben per translateY
const trackList = (n) => `<div class="main-trackList-trackListContainer"><div role="grid" aria-rowcount="${n + 1}" aria-colcount="5" class="main-trackList-trackList main-trackList-indexable" tabindex="0" data-testid="track-list" data-rows="${n}" style="--row-height:56px;--grid-template-columns:[index] var(--tracklist-index-column-width,16px) [first] minmax(120px,var(--col1,6fr)) [var1] minmax(120px,var(--col2,4fr)) [var2] minmax(120px,var(--col3,3fr)) [last] minmax(120px,var(--col4,1fr))">
 <div class="main-trackList-trackListHeader" style="top:64px"><div role="row" aria-rowindex="1" class="main-trackList-trackListHeaderRow main-trackList-trackListRowGrid">${headCell(1, "#")}${headCell(2, "Titel")}${headCell(3, "Album")}${headCell(4, "Hinzugefügt")}${headCell(5, "⏱")}</div></div>
 <div style="height:${n * 56}px;position:relative"><div role="presentation" class="m-perf-rows" style="transform:translateY(0px)"></div></div></div></div>`;
const entityHeader = (kind, title) => `<div class="main-entityHeader-container main-entityHeader-nonWrapped main-entityHeader-newEntityHeader main-entityHeader-standardHeight" data-testid="entity-header" style="height:var(--optimized-entity-header-height);min-height:var(--optimized-entity-header-min-height)">
 <div class="main-entityHeader-background main-entityHeader-gradient" style="background-color:rgb(72,56,104)"></div><div class="main-entityHeader-background main-entityHeader-overlay"></div>
 <div class="main-entityHeader-imageContainer main-entityHeader-imageContainerNew" draggable="true"><img class="main-image-image main-entityHeader-image" src="${IMG(900)}" alt="" style="width:100%;height:100%"></div>
 <div class="main-entityHeader-headerText"><span class="${E}-text-body-small-bold" data-encore-id="text">${kind}</span><span class="${E}-text-title-large main-entityHeader-title" data-encore-id="text"><h1 class="${E}-text-title-large" data-encore-id="text" dir="auto">${title}</h1></span>
 <div class="main-entityHeader-metaData"><span class="${E}-text-body-small-bold" data-encore-id="text"><a href="#">Mirage Ensemble</a></span><span class="main-entityHeader-divider ${E}-text-body-small" data-encore-id="text">200 Songs</span></div></div></div>`;
const actionBar = () => `<div class="main-actionBarBackground-background" style="background-color:rgb(72,56,104)"></div><div class="main-actionBar-ActionBar contentSpacing" data-testid="action-bar"><div class="main-actionBar-ActionBarRow main-actionBar-ActionBarRowResponsive" data-testid="action-bar-row">${playBtn()}<div class="main-actionBar-ActionBarRowActions">${tertiary("Save")}${tertiary("Download")}${tertiary("More options")}</div></div></div>`;
const chip = (t, on) => `<button role="checkbox" aria-checked="${on}" data-encore-id="chip" class="${E}-chip ${E}-overflow-wrap-anywhere ${E}-chip--small ${E}-variant--${on ? "contrasting" : "tinted"} ${E}-variant--interactive encore-internal-color-text-base ${E}-focus-border"><span data-encore-id="text" class="${E}-text-body-small ${E}-chip__label">${t}</span></button>`;
const PAGES = {
  home: () => `<section data-testid="home-page"><div class="contentSpacing" style="padding-top:64px"><div style="display:flex;gap:8px;margin-bottom:24px">${chip("Alle", true)}${chip("Musik")}${chip("Podcasts")}</div>${["Zuletzt gehört", "Für dich", "Deine Mixe", "Neu", "Beliebt", "Entdecken"].map((t, i) => shelf(t, i * 8)).join("")}</div></section>`,
  playlist: () => `<section data-testid="playlist-page" class="playlist-playlist-playlist">${entityHeader("Playlist", "Mirage Mix")}<div class="playlist-playlist-playlistContent contentSpacing" style="padding:0">${actionBar()}<div class="contentSpacing">${trackList(200)}</div></div></section>`,
  album: () => `<section data-testid="album-page">${entityHeader("Album", "Glass Hours")}<div class="contentSpacing" style="padding:0">${actionBar()}<div class="contentSpacing">${trackList(14)}</div><div class="contentSpacing">${shelf("Mehr von Mirage Ensemble", 60, 6)}</div></div></section>`,
  search: () => `<div class="contentSpacing" style="padding-top:64px"><div style="display:flex;gap:8px;margin-bottom:24px">${chip("Alle", true)}${chip("Songs")}${chip("Künstler")}${chip("Playlists")}</div><div class="search-searchResult-tracklist">${trackList(4)}</div>${shelf("Künstler", 70)}${shelf("Alben", 80)}${shelf("Playlists", 90)}</div>`,
  collection: () => `<section data-testid="collection-page"><div class="contentSpacing" style="padding-top:64px"><div class="main-gridContainer-gridContainer" data-testid="grid-container" style="display:grid;grid-template-columns:repeat(8,180px);gap:24px">${Array.from({ length: 40 }, (_, k) => card(100 + k, "Playlist " + (k + 1))).join("")}</div></div></section>`,
};
const libItem = (i) => `<div role="row" aria-rowindex="${i + 1}" aria-selected="false"><div class="main-useDropTarget-base main-yourLibraryX-listItem" role="group" aria-labelledby="li-${i}"><div class="main-yourLibraryX-listItemGroup" role="button" tabindex="-1">
 <div class="main-yourLibraryX-listRowImageWrapper"><img class="main-image-image" src="${IMG(200 + i)}" alt="" width="48" height="48" loading="eager"></div>
 <div class="main-yourLibraryX-listRowDetails"><p class="${E}-text-body-medium main-yourLibraryX-listRowTitle" data-encore-id="text" id="li-${i}"><span>Playlist ${i + 1}</span></p><div class="${E}-text-body-small encore-internal-color-text-subdued main-yourLibraryX-listRowSubtitle" data-encore-id="text">Playlist · Mirage</div></div></div></div></div>`;
const shell = () => `<div id="main"><div class="Root global-nav centered-layout"><div class="Root__top-container Root__top-container--right-sidebar-visible" style="--left-sidebar-width:300;--panel-gap:8px">
 <div class="Root__globalNav global-nav-bar" style="grid-area:global-nav"><div class="main-globalNav-historyButtonsContainer">${tertiary("Zurück")}${tertiary("Vor")}</div>
  <div class="main-globalNav-searchSection"><div class="main-globalNav-searchContainer" style="width:420px"><form role="search"><div class="main-globalNav-searchInputContainer"><input data-testid="search-input" class="${E}-text-body-medium main-globalNav-searchInputText" placeholder="Was möchtest du hören?"></div></form></div></div>
  <div class="main-globalNav-contentRight"><div class="main-actionButtons"><button data-testid="whats-new-feed-button" aria-label="Neuigkeiten">${icon()}</button><button data-testid="user-widget-link" aria-label="Profil">P</button></div></div></div>
 <nav class="Root__nav-bar" aria-label="Main" style="grid-area:left-sidebar"><div id="Desktop_LeftSidebar_Id" class="main-yourLibraryX-library" style="height:100%;display:flex;flex-direction:column">
  <header class="main-yourLibraryX-header" style="padding:12px 16px"><div class="main-yourLibraryX-collapseButton"><button>Bibliothek</button></div></header>
  <div class="main-yourLibraryX-libraryContainer" style="flex:1;min-height:0"><div class="main-yourLibraryX-libraryRootlist" style="height:100%;overflow:auto" data-overlayscrollbars-viewport=""><div role="grid" aria-label="Your Library" class="main-rootlist-wrapper"><div role="presentation">${Array.from({ length: 40 }, (_, i) => libItem(i)).join("")}</div></div></div></div></div></nav>
 <div id="main-view" class="Root__main-view" style="grid-area:main-view"><div class="main-view-container">
  <div class="main-topBar-container" style="--top-bar-opacity:0"><div class="main-topBar-background" style="background-color:rgb(72,56,104);opacity:0"></div><div class="main-topBar-topbarContentWrapper"><div class="main-topBar-topbarContent" style="opacity:0">${playBtn("medium")}<span class="${E}-text-title-medium">Mirage Mix</span></div></div></div>
  <div class="main-view-container__scroll-node" data-overlayscrollbars-initialize=""><div data-overlayscrollbars-viewport="scrollbarHidden overflowXHidden overflowYScroll" tabindex="-1" style="overflow:hidden scroll;height:100%">
   <div class="main-view-container__scroll-node-child"><main aria-label="Spotify" style="display:block" id="m-perf-page"></main><div class="main-view-container__mh-footer-container" style="height:200px"></div></div></div></div></div></div>
 <div style="grid-area:right-sidebar;width:320px;position:relative;display:flex"><div class="LayoutResizer__resize-bar LayoutResizer__inline-start" style="position:absolute;inset:0 auto 0 0;width:4px"></div><aside aria-label="Now playing view" data-testid="now-playing-view" style="flex:1"><div class="main-nowPlayingView-section" style="padding:16px"><div class="main-nowPlayingView-coverArtContainer"><img class="main-image-image" data-testid="cover-art-image" src="${IMG(1)}" alt="" style="width:100%;aspect-ratio:1;border-radius:8px"></div>
  <div class="main-nowPlayingView-contextItemInfo"><div class="${E}-text-title-medium" data-encore-id="text">Song of Aurora</div><div class="${E}-text-body-medium encore-internal-color-text-subdued" data-encore-id="text">Aurora</div></div></div></aside></div>
 <div class="Root__now-playing-bar" style="grid-area:now-playing-bar"><footer data-testid="now-playing-bar" aria-label="Now playing bar" style="height:72px;display:flex;align-items:center;gap:16px;padding:0 16px">
  <div data-testid="now-playing-widget" class="main-nowPlayingWidget-nowPlaying" style="display:flex;align-items:center;gap:12px;width:30%"><div class="main-nowPlayingWidget-coverArt"><div data-testid="CoverSlotCollapsed__container" class="main-coverSlotCollapsed-container"><img class="main-image-image cover-art-image" src="${IMG(1)}" alt="" width="56" height="56"></div></div>
   <div class="main-nowPlayingWidget-trackInfo"><div class="${E}-text-body-small-bold" data-encore-id="text" id="m-perf-title">Song of Aurora</div><div class="${E}-text-marginal encore-internal-color-text-subdued" data-encore-id="text">Aurora</div></div></div>
  <div class="main-nowPlayingBar-center" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px"><div data-testid="player-controls" class="player-controls"><div class="player-controls__buttons" style="display:flex;gap:16px;align-items:center">${tertiary("Shuffle")}${tertiary("Zurück")}<button data-testid="control-button-playpause" data-encore-id="buttonPrimary" class="${E}-legacy-button-primary ${E}-legacy-button" aria-label="Pause"><span class="${E}-button-primary__inner encore-inverted-light-set ${E}-button-icon-only--small">${icon()}</span></button>${tertiary("Weiter")}${tertiary("Wiederholen")}</div></div>
   <div class="playback-bar" style="display:flex;align-items:center;gap:8px;width:100%;max-width:520px"><div data-testid="playback-position" class="${E}-text-body-small encore-internal-color-text-subdued playback-bar__progress-time-elapsed" data-encore-id="text">0:00</div>
    <div data-testid="playback-progressbar" class="playback-progressbar playback-progressbar-isInteractive" style="flex:1;height:12px;position:relative"><div data-testid="progress-bar" class="progress-bar" style="--progress-bar-height:4px;--progress-bar-radius:2px;--progress-bar-transform:0%;--fg-color:var(--spice-text);--bg-color:rgba(var(--spice-rgb-text),.3)"><div data-testid="progress-bar-background" class="x-progressBar-progressBarBg"><div class="x-progressBar-sliderArea"><div class="x-progressBar-fillColor"></div></div></div><div data-testid="progress-bar-handle" class="progress-bar__slider"></div></div></div>
    <div data-testid="playback-duration" class="${E}-text-body-small encore-internal-color-text-subdued main-playbackBarRemainingTime-container" data-encore-id="text">3:20</div></div></div>
  <div style="width:30%;display:flex;justify-content:flex-end"><div data-testid="volume-bar"><button data-testid="volume-bar-toggle-mute-button" aria-label="Stumm">${icon()}</button></div></div></footer></div>
</div></div></div>`;
// Verhalten von Spotify, das Mirage mitbekommt: Seitenwechsel (History), virtualisierte Liste, kleiner Kopf beim
// Scrollen, Fortschrittsbalken (Spotify setzt Zeit und Balken jede Sekunde), aktuelle Zeile
const SHELL_JS = `(() => {
  const PAGES = ${JSON.stringify(Object.fromEntries(Object.entries(PAGES).map(([k, f]) => [k, f()])))};
  const ROW = ${row.toString()}, IMG = ${IMG.toString()}, E = ${JSON.stringify(E)}, icon = ${icon.toString()}, tertiary = ${tertiary.toString()};
  const listeners = [];
  const H = Spicetify.Platform.History;
  H.listen = (f) => (listeners.push(f), () => listeners.splice(listeners.indexOf(f), 1));
  H.location = { pathname: "/playlist/x" };
  const vp = () => document.querySelector("#main-view [data-overlayscrollbars-viewport]");
  let grid = null, rowsEl = null, first = -1, last = -1, n = 0, active = 3;
  function virt() {
    if (!grid?.isConnected) return;
    const v = vp(), top = grid.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop + 40;
    const a = Math.max(0, Math.floor((v.scrollTop - top) / 56) - 8), b = Math.min(n, Math.ceil((v.scrollTop - top + v.clientHeight) / 56) + 8);
    if (a === first && b === last) return;
    // wie React mit Schlüsseln: Zeilen, die im Fenster bleiben, bleiben; am Rand kommen neue dazu oder gehen
    const keep = new Map([...rowsEl.children].map((r) => [+r.dataset.i, r]));
    const frag = [];
    for (let i = a; i < b; i++) {
      let r = keep.get(i);
      if (r) keep.delete(i);
      else {
        const t = document.createElement("template");
        t.innerHTML = ROW(i, i === active);
        r = t.content.firstElementChild;
        r.dataset.i = i;
      }
      frag.push(r);
    }
    keep.forEach((r) => r.remove());
    rowsEl.replaceChildren(...frag);
    rowsEl.style.transform = "translateY(" + a * 56 + "px)";
    first = a; last = b;
  }
  const head = () => document.querySelector("[data-testid=entity-header]");
  function onScroll() {
    const v = vp(), eh = head()?.offsetHeight || 0;
    const o = Math.max(0, Math.min(1, (v.scrollTop - eh) / 76));
    const tb = document.querySelector(".main-topBar-container"), bg = document.querySelector(".main-topBar-background"), tc = document.querySelector(".main-topBar-topbarContent");
    if (tb.style.getPropertyValue("--top-bar-opacity") !== String(o)) {
      tb.style.setProperty("--top-bar-opacity", o);
      bg.style.opacity = o;
      tc.style.opacity = o;
    }
    virt();
  }
  function go(page) {
    const main = document.getElementById("m-perf-page");
    main.innerHTML = PAGES[page];
    vp().scrollTop = 0;
    grid = main.querySelector("[data-rows]");
    rowsEl = grid?.querySelector(".m-perf-rows") || null;
    n = grid ? +grid.dataset.rows : 0;
    first = last = -1;
    virt();
    H.location = { pathname: "/" + (page === "home" ? "" : page + "/x") };
    listeners.slice().forEach((f) => { try { f(H.location); } catch (e) { console.error(e); } });
  }
  addEventListener("DOMContentLoaded", () => {
    vp().addEventListener("scroll", onScroll, { passive: true });
    go("playlist");
    // Spotify: Zeit und Balken jede Sekunde
    setInterval(() => {
      const p = Spicetify.Player.getProgress(), d = Spicetify.Player.getDuration() || 1, s = Math.floor(p / 1000);
      document.querySelector("[data-testid=playback-position]").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      document.querySelector("[data-testid=progress-bar]").style.setProperty("--progress-bar-transform", (p / d * 100).toFixed(2) + "%");
    }, 1000);
    Spicetify.Player.addEventListener("songchange", () => {
      const m = Spicetify.Player.data.item.metadata;
      document.getElementById("m-perf-title").textContent = m.title;
      const src = (m.image_url || "").replace("spotify:image:", "https://i.scdn.co/image/");
      document.querySelectorAll(".cover-art-image, [data-testid=now-playing-view] img").forEach((i) => (i.src = src));
      // die laufende Zeile in der Liste wandert mit
      active = (active + 1) % Math.max(1, n);
      if (rowsEl) { first = last = -1; rowsEl.replaceChildren(); virt(); }
    });
  });
  window.__shell = { go, virt };
})();`;
// fake-spotify.js hat einen Zeitgeber alle 8 ms (Hörprotokoll für die E2E-Tests): der würde jede Leerlaufmessung
// überdecken. Für die Messung auf 250 ms gedehnt; danach ist setInterval wieder das echte.
const SLOW_FAKE = `window.__si = window.setInterval; window.setInterval = (f, ms, ...a) => window.__si(f, ms === 8 ? 250 : ms, ...a);`;
const FAST_BACK = `window.setInterval = window.__si;`;

// Messung im Fenster: Bildabstände (rAF), lange Aufgaben
const RECORDER = `(() => {
  // rAF nur, solange Bildabstände gemessen werden: eine Dauerschleife zwänge den Hauptthread in jedes Bild (dann
  // laufen auch CSS-Animationen, die sonst allein der Compositor abspielt, je Bild durch Stil und Zeichnen)
  const R = window.__perfRec = { on: false, frames: false, raf: [], long: [], marks: [] };
  let last = 0;
  const tick = (now) => { if (!R.frames) return void (last = 0); if (last) R.raf.push(now - last); last = now; requestAnimationFrame(tick); };
  R.startFrames = () => { R.frames = true; last = 0; requestAnimationFrame(tick); };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (R.on) R.long.push(Math.round(e.duration)); }).observe({ type: "longtask" }); } catch {}
  R.mark = (name) => { R.marks.push([name, performance.now()]); console.timeStamp("perf:" + name); };
})();`;
// Eichung: fester Stil- und Layout-Durchgang (2000 Elemente, 300 Regeln) in einem eigenen Rahmen ohne Mirage-CSS
const CALIB = `(async () => {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;left:0;top:0;width:800px;height:600px;opacity:0;pointer-events:none;border:0";
  let css = "";
  for (let i = 0; i < 300; i++) css += ".c" + i + " .k" + (i % 40) + "{color:rgb(" + i % 255 + ",9,9);padding:" + (i % 5) + "px}.on .c" + i + "{margin-left:" + (i % 7) + "px}";
  let body = "";
  for (let i = 0; i < 200; i++) { body += "<div class=c" + i + ">"; for (let k = 0; k < 9; k++) body += "<span class=k" + ((i + k) % 40) + ">x" + k + "</span>"; body += "</div>"; }
  f.srcdoc = "<style>" + css + "</style><body>" + body + "</body>";
  document.body.append(f);
  await new Promise((r) => (f.onload = r));
  const d = f.contentDocument, ms = [];
  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    d.body.classList.toggle("on");
    void d.body.offsetHeight;
    let a = 0;
    for (let k = 0; k < 20000; k++) a += Math.sin(k);
    ms.push(performance.now() - t0 + a * 0);
    await new Promise((r) => setTimeout(r, 5));
  }
  f.remove();
  ms.sort((a, b) => a - b);
  return ms[ms.length >> 1];
})()`;

/* ---------------------------------------------------------------- Trace auswerten */
function readTrace(file) {
  const ev = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = Array.isArray(ev) ? ev : ev.traceEvents;
  const tname = {}, pname = {};
  for (const e of list) {
    if (e.ph !== "M") continue;
    if (e.name === "thread_name") tname[e.pid + ":" + e.tid] = e.args.name;
    if (e.name === "process_name") pname[e.pid] = e.args.name;
  }
  const marks = {};
  let mainKey = "";
  for (const e of list) {
    const m = e.name === "TimeStamp" && e.args?.data?.message;
    if (m && m.startsWith("perf:")) {
      marks[m.slice(5)] = e.ts / 1000;
      mainKey = e.pid + ":" + e.tid;
    }
  }
  const [mainPid] = mainKey.split(":");
  const t0 = marks.start, t1 = marks.end, secs = (t1 - t0) / 1000;
  const inWin = (ts) => ts >= t0 && ts <= t1;
  const sum = {}, cnt = {}, tasks = [], other = { raster: 0, compositor: 0, gpu: 0 };
  let elems = 0, scriptEval = 0, compile = 0;
  // verschachtelte RunTask-Ereignisse (ThreadControllerImpl::RunTask um RunTask) nur einmal zählen
  let mainEnd = 0;
  const mainEv = [];
  list.sort((a, b) => (a.ts || 0) - (b.ts || 0) || (b.dur || 0) - (a.dur || 0));
  for (const e of list) {
    if (e.ph !== "X" || !e.dur) continue;
    const ts = e.ts / 1000;
    if (!inWin(ts)) continue;
    const d = e.dur / 1000, k = e.pid + ":" + e.tid;
    const top = e.name === "ThreadControllerImpl::RunTask" || e.name === "RunTask";
    if (k === mainKey) {
      sum[e.name] = (sum[e.name] || 0) + d;
      cnt[e.name] = (cnt[e.name] || 0) + 1;
      if (e.name === "UpdateLayoutTree") elems += e.args?.elementCount || 0;
      if (e.name === "EvaluateScript" && /theme\.js/.test(e.args?.data?.url || "")) scriptEval += d;
      if (/^v8\.compile/.test(e.name) && /theme\.js/.test(e.args?.data?.url || e.args?.fileName || "")) compile += d;
      if (top && ts * 1000 >= mainEnd) {
        tasks.push([ts - t0, d]);
        mainEnd = e.ts + e.dur;
      }
      if (d > 2) mainEv.push([ts, d, e.name, e.args?.data?.url || e.args?.data?.functionName || e.args?.data?.type || ""]);
      continue;
    }
    if (!top) continue;
    const tn = tname[k] || "", pn = pname[e.pid] || "";
    if (String(e.pid) === mainPid) {
      if (/TileWorker|Raster/i.test(tn)) other.raster += d;
      else if (/Compositor/i.test(tn)) other.compositor += d;
    } else if (/GPU/i.test(pn) || /VizCompositor|CrGpuMain/.test(tn)) other.gpu += d;
  }
  const per = (k) => r2((sum[k] || 0) / secs);
  const busy = r2(tasks.reduce((a, [, d]) => a + d, 0) / secs);
  return {
    secs: r2(secs), mainKey,
    msPerSec: {
      busy,
      script: r2(per("FunctionCall") + per("TimerFire") + per("FireAnimationFrame") + per("EventDispatch") + per("v8.run") + per("FireIdleCallback") + per("RunMicrotasks")),
      style: per("UpdateLayoutTree"), layout: per("Layout"), paint: r2(per("Paint") + per("PrePaint") + per("Layerize") + per("Commit")),
      gc: r2(per("MinorGC") + per("MajorGC") + per("V8.GC_SCAVENGER") + per("V8.GC_MARK_COMPACTOR")),
      raster: r2(other.raster / secs), compositor: r2(other.compositor / secs), gpu: r2(other.gpu / secs),
    },
    perSec: { frames: r2(((cnt.BeginMainThreadFrame || 0) || (cnt.Paint || 0)) / secs), style: r2((cnt.UpdateLayoutTree || 0) / secs), layout: r2((cnt.Layout || 0) / secs), paint: r2((cnt.Paint || 0) / secs) },
    styleElemsPerSec: Math.round(elems / secs),
    task: { n: tasks.length, p95: r2(q(tasks.map((t) => t[1]), 0.95)), max: r2(Math.max(0, ...tasks.map((t) => t[1]))) },
    long: tasks.filter(([, d]) => d > 50).map(([at, d]) => [r2(at / 1000), r2(d)]),
    // was in den längsten Aufgaben steckte (Ereignisse über 2 ms darin)
    worst: tasks.slice().sort((a, b) => b[1] - a[1]).slice(0, 4).map(([at, d]) => ({ at: r2(at / 1000), ms: r2(d), parts: mainEv.filter(([ts]) => ts >= at + t0 && ts <= at + t0 + d).slice(0, 12).map(([, dd, n, u]) => `${n}${u ? "(" + String(u).slice(-40) + ")" : ""} ${r2(dd)}`) })),
    scriptEval: r2(scriptEval), compile: r2(compile),
  };
}

/* ---------------------------------------------------------------- Lauf */
let T, win, dbg;
const report = {};
const cats = ["devtools.timeline", "toplevel", "v8", "disabled-by-default-devtools.timeline", ...(process.env.PERF_CATS || "").split(",").filter(Boolean)];
async function traced(name, body, frames = false) {
  step("Szenario " + name);
  const file = path.join(OUT, `theme-perf-${name}.json`);
  await contentTracing.startRecording({ included_categories: cats, excluded_categories: ["*"] });
  await wait(200);
  await T(`__perfRec.raf.length = 0; __perfRec.long.length = 0; __perfRec.on = true; ${frames ? "__perfRec.startFrames();" : ""} __perfRec.mark("start"); 1`);
  await body();
  const rec = await T(`__perfRec.mark("end"); __perfRec.on = false; __perfRec.frames = false; ({ raf: __perfRec.raf, long: __perfRec.long })`);
  await wait(200);
  await contentTracing.stopRecording(file);
  const tr = readTrace(file);
  if (!KEEP_TRACE) fs.rmSync(file, { force: true });
  return { ...tr, frames: { p50: r2(q(rec.raf, 0.5)), p95: r2(q(rec.raf, 0.95)), max: r2(Math.max(0, ...rec.raf)), over25: rec.raf.filter((d) => d > 25).length, n: rec.raf.length }, longObs: rec.long };
}
const mouse = (type, x, y, extra = {}) => dbg.sendCommand("Input.dispatchMouseEvent", { type, x, y, button: "none", pointerType: "mouse", ...extra });
async function wheel(x, y, dy, steps, gap = 16) {
  for (let i = 0; i < steps; i++) {
    await mouse("mouseWheel", x, y, { deltaX: 0, deltaY: dy });
    await wait(gap);
  }
}
const memory = () => T(`(async () => { for (let i = 0; i < 3; i++) { gc(); await new Promise((r) => setTimeout(r, 50)); } return { heapMB: Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10, nodes: document.getElementsByTagName("*").length, styles: document.styleSheets.length, timers: 0 }; })()`);

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // PERF_BARE=1: ohne Mirage (nur der Spotify-Nachbau) – was kostet die Kulisse selbst?
  const BARE = !!process.env.PERF_BARE;
  const theme = BARE ? "" : fs.readFileSync(THEME, "utf8"), css = BARE ? "" : fs.readFileSync(CSS, "utf8");
  const fake = fs.readFileSync(path.join(ROOT, "tests", "e2e", "fake-spotify.js"), "utf8");
  // wie Spicetify: Spotifys Stylesheets, colors.css, user.css im Kopf; theme.js als eigene Datei (für die Zeitmessung)
  const html = `<!doctype html><html lang="de" dir="ltr" class="encore-dark-theme encore-layout-themes"><head><meta charset="utf-8">
${spotifyCss.map((f) => `<link rel="stylesheet" href="/xpui/${f}">`).join("")}
<style>${colorsCss()}</style><link rel="stylesheet" href="/mirage/user.css">
<style>${process.env.PERF_EXTRA_CSS ? fs.readFileSync(process.env.PERF_EXTRA_CSS, "utf8") : ""}</style>
<style>html,body{margin:0;height:100%;overflow:hidden}a{color:inherit;text-decoration:none}#main,.Root{height:100%}</style></head>
<body>${shell()}
<script>${SLOW_FAKE}<\/script><script>${fake}<\/script><script>${FAST_BACK}<\/script><script>${RECORDER}<\/script><script>${SHELL_JS}<\/script>
<script>localStorage.setItem("mirage:settings", ${JSON.stringify(JSON.stringify(SETTINGS))});localStorage.setItem("mirage:welcomed", "1");<\/script>
<script src="/mirage/theme.js"><\/script></body></html>`;
  const TYPES = { ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".png": "image/png", ".js": "text/javascript" };
  const serve = (f) => (fs.existsSync(f) ? new Response(fs.readFileSync(f), { headers: { "content-type": TYPES[path.extname(f)] || "application/octet-stream" } }) : new Response("", { status: 404 }));
  const ses = session.fromPartition("theme-perf-" + Date.now());
  ses.protocol.handle("mui", (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname);
    if (p === "/" || p === "/index.html") return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (p === "/mirage/user.css") return new Response(css, { headers: { "content-type": "text/css" } });
    if (p === "/mirage/theme.js") return new Response(theme, { headers: { "content-type": "text/javascript" } });
    if (p.startsWith("/xpui/")) return serve(path.join(XPUI, path.normalize(p.slice(6)).replace(/^(\.\.[\\/])+/, "")));
    return new Response("", { status: 404 });
  });
  // kein Netz: Cover vom „Bildserver“ (mit CORS, Mirage liest die Farben aus), Spotify-Schriften aus xpui/fonts,
  // Mirages Schriften von Google Fonts (wie beim Nutzer), sonst 404
  ses.protocol.handle("https", (req) => {
    const u = new URL(req.url);
    if (u.host === "i.scdn.co") return new Response(coverPng(u.pathname), { headers: { "content-type": "image/png", "access-control-allow-origin": "*" } });
    // Mirages Schriften (Outfit, JetBrains Mono) wie beim Nutzer: ohne sie sucht Chromium für jeden Text eine Ersatzschrift,
    // das kostete im Layout mehr als Mirage selbst. Einmal geladen, danach aus dem Zwischenspeicher der Sitzung
    if (u.host === "fonts.googleapis.com" || u.host === "fonts.gstatic.com") return net.fetch(req, { bypassCustomProtocolHandlers: true });
    if (u.host === "encore.scdn.co" && HAS_XPUI) return serve(path.join(XPUI, "fonts", path.basename(u.pathname).replace(/-[0-9a-f]{32}(?=\.woff2?$)/, "")));
    return new Response("", { status: 404 });
  });
  ses.protocol.handle("http", () => new Response("", { status: 404 }));
  ses.protocol.handle("wss", () => new Response("", { status: 404 }));
  win = new BrowserWindow({ width: W, height: H, useContentSize: true, show: false, webPreferences: { offscreen: true, backgroundThrottling: false, session: ses, contextIsolation: false } });
  win.webContents.setFrameRate(60);
  win.webContents.setAudioMuted(true);
  report.bare = BARE;
  const errors = [];
  win.webContents.on("console-message", (_e, level, msg) => level >= 3 && !/Failed to load resource|net::ERR/.test(msg) && errors.push(msg.slice(0, 300)));
  T = (code) => (step(code.slice(0, 70).replace(/\s+/g, " ")), win.webContents.executeJavaScript(code));
  dbg = win.webContents.debugger;
  dbg.attach("1.3");
  // das kopflose Fenster hat nie den Fokus (auch Emulation.setFocusEmulationEnabled ändert document.hasFocus() hier
  // nicht): für „Spotify ist das aktive Fenster“ meldet die Seite Fokus, für rest keinen – wie beim echten Wechsel
  // mit focus/blur-Ereignis
  const setFocus = (on) => T(`window.__focus = ${on}; document.hasFocus = () => window.__focus; dispatchEvent(new Event(${on ? '"focus"' : '"blur"'})); 1`);
  const focusOn = () => setFocus(true);
  Object.assign(report, { when: new Date().toISOString(), size: [W, H], xpui: HAS_XPUI, settings: SETTINGS, scenarios: {} });

  // Start: Timeline schon vor dem Laden an
  if (RUN.has("startup")) {
    const file = path.join(OUT, "theme-perf-startup.json");
    await contentTracing.startRecording({ included_categories: cats, excluded_categories: ["*"] });
    await wait(200);
    await win.loadURL("mui://app/index.html");
    await focusOn();
    await T(`console.timeStamp("perf:start"); 1`);
    await wait(8000);
    await T(`console.timeStamp("perf:end"); 1`);
    await contentTracing.stopRecording(file);
    // „start“ liegt nach dem Laden: für den Start zählt alles ab dem ersten Ereignis des Hauptthreads
    const ev = JSON.parse(fs.readFileSync(file, "utf8"));
    const list = Array.isArray(ev) ? ev : ev.traceEvents;
    const st = list.find((e) => e.name === "TimeStamp" && e.args?.data?.message === "perf:start");
    const first = Math.min(...list.filter((e) => e.pid === st.pid && e.tid === st.tid && e.ph === "X" && e.ts).map((e) => e.ts));
    st.ts = first;
    fs.writeFileSync(file, JSON.stringify(list));
    const tr = readTrace(file);
    if (!KEEP_TRACE) fs.rmSync(file, { force: true });
    report.scenarios.startup = tr;
  } else {
    await win.loadURL("mui://app/index.html");
    await focusOn();
    await wait(8000);
  }
  // Spotify fertig aufgebaut, Theme läuft: einschwingen lassen (Gesundheits-Check nach 8 s, erste Farben, Analyse)
  await wait(3000);
  const calib0 = await T(CALIB);
  report.memStart = await memory();

  // laufende Animationen (CSS und Web Animations) auf der Playlist: was davon nicht allein auf dem Compositor läuft,
  // kostet jedes Bild Stil + Zeichnen im Hauptthread
  report.animations = await T(`document.getAnimations().filter((a) => a.playState === "running").map((a) => {
    const t = a.effect?.target, kf = a.effect?.getKeyframes?.() || [];
    const props = [...new Set(kf.flatMap((k) => Object.keys(k).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p))))];
    return (t ? t.tagName.toLowerCase() + (t.id ? "#" + t.id : "") + "." + String(t.className?.baseVal ?? t.className).split(" ").slice(0, 2).join(".") : "?") + (a.effect?.pseudoElement || "") + " " + (a.animationName || a.id || "") + " [" + props.join(",") + "]";
  })`);
  console.log("laufende Animationen: " + report.animations.join(" · "));
  report.focus = await T(`({ focus: document.hasFocus(), rest: document.documentElement.classList.contains("mirage-rest"), outfit: document.fonts.check("14px Outfit") })`);
  console.log("Fenster aktiv: " + JSON.stringify(report.focus));
  if (RUN.has("idle")) report.scenarios.idle = await traced("idle", () => wait(IDLE_SECS * 1000));
  if (RUN.has("rest")) {
    await setFocus(false);
    await wait(500);
    const on = await T(`document.documentElement.classList.contains("mirage-rest")`);
    report.scenarios.rest = { ...(await traced("rest", () => wait(IDLE_SECS * 1000))), restClass: on };
    await focusOn();
    await wait(500);
  }
  if (RUN.has("scroll")) {
    report.scenarios.scroll = await traced("scroll", async () => {
      await wheel(900, 500, 120, 180);
      await wheel(900, 500, -120, 180);
    }, true);
  }
  if (RUN.has("hover")) {
    report.scenarios.hover = await traced("hover", async () => {
      // Titelzeilen der Playlist: langsam von oben nach unten und zurück (1 px … wie eine echte Maus, 60 Ereignisse/s)
      await T(`document.querySelector("#main-view [data-overlayscrollbars-viewport]").scrollTop = 500; 1`);
      await wait(300);
      for (let k = 0; k < 2; k++) for (let y = 150; y < 820; y += 6) { await mouse("mouseMoved", 700 + (y % 40), y); await wait(16); }
      await T(`__shell.go("home"); 1`);
      await wait(1200);
      // Karten der Startseite: quer über zwei Reihen
      for (const y of [330, 620]) for (let x = 340; x < 1250; x += 8) { await mouse("mouseMoved", x, y + ((x / 8) % 20)); await wait(16); }
      await T(`__shell.go("playlist"); 1`);
      await wait(800);
    }, true);
  }
  if (RUN.has("song")) {
    report.scenarios.song = await traced("song", async () => {
      for (let i = 0; i < 3; i++) {
        await T(`Spicetify.Player.next(); 1`);
        await wait(4000);
      }
    });
  }
  if (RUN.has("nav")) {
    report.scenarios.nav = await traced("nav", async () => {
      for (const p of ["home", "playlist", "album", "search", "collection", "playlist"]) {
        await T(`__shell.go(${JSON.stringify(p)}); 1`);
        await wait(2000);
      }
    });
  }
  const IM = ["cover", "lyrics", "viz", "mix", "party", "clock"].filter((m) => RUN.has(m));
  if (IM.length) {
    await T(`__sp.press("KeyM", { ctrlKey: true, shiftKey: true }); 1`);
    await wait(1500);
    for (const m of IM) {
      await T(`document.querySelector('#mirage-immersive .m-im-tabs [data-mode="${m}"]')?.click(); 1`);
      await wait(3000);
      const mode = await T(`document.getElementById("mirage-immersive")?.dataset.mode`);
      report.scenarios[m] = { ...(await traced(m, () => wait(IM_SECS * 1000))), mode };
    }
    await T(`__sp.press("Escape"); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })); 1`);
    await wait(1500);
  }
  report.memEnd = await memory();
  const calib1 = await T(CALIB);
  const calib = Math.min(calib0, calib1);
  report.calibMs = r2(calib);
  report.errors = errors.slice(0, 10);

  // kurzer Bericht
  console.log(`Theme-Messung ${W}×${H}, Spotify-CSS ${HAS_XPUI ? "ja" : "nein"}, Preset ${SETTINGS.preset}, Eichung ${r2(calib)} ms`);
  console.log("Szenario   gesamt  Skript  Stil  Stil/s  Elem/s   Layout  Zeichnen  Raster   GPU  Bilder/s  Bild p50/p95  >25ms  lange Aufgaben");
  for (const [k, s] of Object.entries(report.scenarios)) {
    const m = s.msPerSec;
    console.log(`${k.padEnd(9)} ${String(m.busy).padStart(7)} ${String(m.script).padStart(7)} ${String(m.style).padStart(5)} ${String(s.perSec.style).padStart(7)} ${String(s.styleElemsPerSec).padStart(7)} ${String(m.layout).padStart(8)} ${String(m.paint).padStart(9)} ${String(m.raster).padStart(7)} ${String(m.gpu).padStart(5)} ${String(s.perSec.frames).padStart(8)}   ${s.frames && s.frames.n ? `${s.frames.p50}/${s.frames.p95}`.padStart(11) : "".padStart(11)} ${String(s.frames?.over25 ?? "").padStart(6)}  ${s.long.map(([a, d]) => `${a}s:${d}`).join(" ")}`);
  }
  if (report.scenarios.startup) console.log(`Start: theme.js übersetzen ${report.scenarios.startup.compile} ms, ausführen ${report.scenarios.startup.scriptEval} ms`);
  console.log(`Speicher: Start ${JSON.stringify(report.memStart)} · Ende ${JSON.stringify(report.memEnd)}`);
  if (errors.length) console.log("Fehler im Fenster: " + errors.slice(0, 3).join(" | "));
  let bad = 0;
  if (CHECK) {
    report.budget = [];
    for (const [k, b] of Object.entries(BUDGET)) {
      const s = report.scenarios[k];
      if (!s) continue;
      const checks = [];
      for (const [key, name] of [["busy", "Hauptthread ms/s"], ["style", "Stil ms/s"], ["layout", "Layout ms/s"], ["script", "Skript ms/s"]]) {
        if (b[key] != null) checks.push([name, s.msPerSec[key], r2(b[key] * calib)]);
      }
      if (b.long != null) checks.push(["lange Aufgaben", s.long.length, b.long]);
      for (const [name, v, max] of checks) {
        const ok = v <= max;
        if (!ok) bad++;
        report.budget.push({ scenario: k, name, value: v, max, ok });
        console.log(`  ${ok ? "ok    " : "FEHLER"} ${k}: ${name} ${v} (Grenze ${max})`);
      }
    }
  }
  const file = path.join(OUT, "theme-perf.json");
  fs.writeFileSync(file, JSON.stringify(report, null, 1));
  console.log(`→ ${path.relative(ROOT, file)}`);
  dbg.detach();
  app.exit(bad ? 1 : 0);
});
