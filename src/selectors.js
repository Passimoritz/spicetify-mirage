import { S, root, VERSION } from "./core.js";
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
    ".main-card-card, [data-encore-id='card'], [role='row'], [role='grid'], [data-testid='background-image'], .main-entityHeader-background",
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

// Kurztext für Fehlerberichte (Feld „Diagnose“ im Issue-Formular)
const diagnostics = () =>
  [
    `Mirage ${VERSION}`,
    `Spotify ${spotifyVersion || "?"}`,
    `Spicetify ${spicetifyVersion || "?"}`,
    `missing: ${health.checked ? health.missing.join(", ") || "none" : "not checked yet"}`,
    `safe mode: ${root.classList.contains("mirage-safe")}`,
    `scheme: ${root.dataset.mScheme || "?"} · page: ${root.dataset.mPage || "?"}`,
    `ua: ${navigator.userAgent.replace(/.*(Chrome\/[\d.]+).*/, "$1")}`,
  ].join("\n");

export { SEL, health, checkHealth, diagnostics };
