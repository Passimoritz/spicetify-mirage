import { S, root, VERSION, errors } from "./core.js";
import { t } from "./i18n.js";

/* ---------------------------------------------------------------- Spotify-Selektoren */
// Alle Stellen, an denen Mirage Spotifys Oberfläche findet, an EINEM Ort. Ändert Spotify
// nach einem Update Klassennamen, wird hier nachgezogen – nicht quer durch alle Module.
// Wo möglich sprachunabhängige data-testid, alte Klassennamen als Rückfall dahinter.
const SEL = {
  mainView: ".Root__main-view, #main-view",
  grid: ".main-gridContainer-gridContainer, [data-testid='grid-container']",
  rows: "[role='grid'] [role='row']",
  card: ".main-card-card, [data-encore-id='card']",
  nowPlayingBar: ".Root__now-playing-bar, [data-testid='now-playing-bar'], footer",
  nowPlayingCover:
    ".main-nowPlayingWidget-coverArt img, [data-testid='CoverSlotCollapsed__container'] img, .main-coverSlotCollapsed-container img",
  likeButton: '[data-testid="add-button"], [data-testid="like-button"], [data-testid="heart-button"]',
  tintSkip:
    ".main-card-card, [data-encore-id='card'], [role='row'], [role='grid'], [data-testid='background-image'], .main-entityHeader-background, " +
    // eigene deckende Glasflächen (kleiner Kopf, angehefteter Spaltenkopf, Suchvorschläge) nie durchsichtig machen
    ".main-topBar-background, [data-m-stuck], [role='listbox']",
};
// ohne diese Teile sieht Mirage halb kaputt aus – dann lieber sauber auf Grundfarben zurück
const CRITICAL = ["mainView", "nowPlayingBar"];

/* ---------------------------------------------------------------- Gesundheits-Check */
// Nach dem Start einmal prüfen. Fehlt Wichtiges, schaltet Mirage in den sicheren Modus
// (nur Farben, keine Bühne über Spotify) und sagt einmal pro Spotify-Version Bescheid.
const spotifyVersion = String(S.Platform?.version || S.Config?.spotify_version || "").split(".").slice(0, 4).join(".");
const spicetifyVersion = String(S.Config?.version || "");
const health = { checked: false, missing: [], spotify: spotifyVersion, spicetify: spicetifyVersion, mirage: VERSION };

function checkHealth() {
  health.missing = Object.keys(SEL).filter((k) => !document.querySelector(SEL[k]));
  health.checked = true;
  const broken = CRITICAL.filter((k) => health.missing.includes(k));
  root.classList.toggle("mirage-safe", broken.length > 0);
  const KEY = "mirage:seenSpotify";
  let seen = "";
  try { seen = localStorage.getItem(KEY) || ""; } catch {}
  if (broken.length && seen !== spotifyVersion + ":broken") {
    try {
      S.showNotification?.(t("safeMode").replace("{v}", spotifyVersion || "?"), true, 10000);
      localStorage.setItem(KEY, spotifyVersion + ":broken");
    } catch {}
  } else if (!broken.length) {
    try { localStorage.setItem(KEY, spotifyVersion); } catch {}
  }
  return health;
}
// Spotify baut die Oberfläche nach und nach auf: erst nach ein paar Sekunden urteilen
setTimeout(checkHealth, 8000);

/* ---------------------------------------------------------------- Nach Spotify-Updates */
// Nicht jede Stelle gibt es auf jeder Seite (Raster, Titellisten, Karten). Darum merkt sich Mirage je
// Spotify-Version, auf welcher Art Seite es welche Stelle gefunden hat. Nach einem Update zählt eine Stelle
// erst als verloren, wenn so eine Seite wieder besucht wurde und sie dort nach 20 Minuten Benutzung nie
// auftauchte – dann einmal Bescheid sagen, statt dass Mirage still halb kaputt aussieht.
const SEEN = "mirage:selSeen", LOOK = ["grid", "rows", "card", "nowPlayingCover", "likeButton"];
const blank = () => ({ v: "", found: {}, prev: {}, pages: [], told: "" });
let seenSel = blank();
try {
  const raw = JSON.parse(localStorage.getItem(SEEN) || "{}");
  if (raw && typeof raw.found === "object" && !Array.isArray(raw.found)) seenSel = { ...seenSel, ...raw };
} catch {}
// Spotify wurde aktualisiert (gespeicherte Version ≠ jetzige): dann früh prüfen und das Ergebnis sagen
const updated = !!(spotifyVersion && seenSel.v && seenSel.v !== spotifyVersion);
if (spotifyVersion && seenSel.v !== spotifyVersion) {
  if (seenSel.v && Object.keys(seenSel.found).length) seenSel.prev = seenSel.found;
  seenSel = { ...blank(), v: spotifyVersion, prev: seenSel.prev, told: seenSel.told };
}
health.lost = [];
const pageNow = () => root.dataset.mPage || "other";
function noteFound() {
  const pg = pageNow();
  if (!seenSel.pages.includes(pg)) seenSel.pages.push(pg);
  for (const k of LOOK) {
    if (!document.querySelector(SEL[k])) continue;
    const list = (seenSel.found[k] ||= []);
    if (!list.includes(pg)) list.push(pg);
  }
  try { localStorage.setItem(SEEN, JSON.stringify(seenSel)); } catch {}
}
let lookT = 0;
const lookSoon = () => {
  clearTimeout(lookT);
  lookT = setTimeout(noteFound, 3000);
};
setTimeout(() => {
  noteFound();
  S.Platform?.History?.listen?.(lookSoon);
}, 8000);
setTimeout(() => {
  noteFound();
  // verloren: früher gefunden, eine passende Seite wurde besucht, aber jetzt nirgends mehr gefunden
  health.lost = LOOK.filter((k) => (seenSel.prev[k] || []).some((pg) => seenSel.pages.includes(pg)) && !(seenSel.found[k] || []).length);
  if (seenSel.told === spotifyVersion || root.classList.contains("mirage-safe")) return;
  if (!health.lost.length) {
    // nach einem Update einmal Entwarnung geben – sonst still
    if (updated) {
      seenSel.told = spotifyVersion;
      try {
        localStorage.setItem(SEEN, JSON.stringify(seenSel));
        S.showNotification?.(t("updOk").replace("{v}", spotifyVersion || "?"), false, 6000);
      } catch {}
    }
    return;
  }
  seenSel.told = spotifyVersion;
  try {
    localStorage.setItem(SEEN, JSON.stringify(seenSel));
    S.showNotification?.(t("selLost").replace("{v}", spotifyVersion || "?"), true, 12000);
  } catch {}
}, (updated ? 3 : 20) * 60e3);

// Kurztext für Fehlerberichte (Feld „Diagnose“ im Issue-Formular)
const diagnostics = () =>
  [
    `Mirage ${VERSION}`,
    `Spotify ${spotifyVersion || "?"}`,
    `Spicetify ${spicetifyVersion || "?"}`,
    `missing: ${health.checked ? health.missing.join(", ") || "none" : "not checked yet"}`,
    `lost since update: ${health.lost.join(", ") || "none"}`,
    `safe mode: ${root.classList.contains("mirage-safe")}`,
    `scheme: ${root.dataset.mScheme || "?"} · page: ${root.dataset.mPage || "?"}`,
    `ua: ${navigator.userAgent.replace(/.*(Chrome\/[\d.]+).*/, "$1")}`,
    `errors: ${errors.length ? errors.slice(-5).map((e) => String(e).replace(/(file|https?):\/\/\S+/g, "…").slice(0, 160)).join(" | ") : "none"}`,
  ].join("\n");
// „Problem melden“: ein vorausgefülltes GitHub-Issue mit der Diagnose (keine persönlichen Daten darin)
const reportUrl = () =>
  "https://github.com/Passimoritz/spicetify-mirage/issues/new?" +
  new URLSearchParams({ template: "bug-after-spotify-update.yml", title: `[Bug] Spotify ${spotifyVersion || "?"} · Mirage ${VERSION}`, diagnostics: diagnostics() }).toString();

export { SEL, health, checkHealth, diagnostics, reportUrl };
