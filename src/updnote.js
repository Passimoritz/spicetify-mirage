import { S } from "./core.js";
import { t, LANG } from "./i18n.js";
import { CRITICAL, health, checkHealth, diagnostics, spotifyVersion, prevSpotify, handOffUpdateNote } from "./selectors.js";
import { UI } from "./icons.js";

/* ---------------------------------------------------------------- Notiz nach einem Spotify-Update */
// Startet Spotify in einer neuen Version, prüft Mirage kurz alles, worauf es sich verlässt (Spotifys Aufbau und die
// Player-Schnittstellen), und sagt es einmal in einer kleinen Glas-Notiz: „läuft wie gewohnt“ – oder was genau nicht
// mehr passt, mit Hilfe und Diagnose. Einmal je Version, nie bei der ersten Installation.
const KEY = "mirage:updSeen";
const short = (v) => String(v || "").split(".").slice(0, 3).join(".");
let last = "";
try { last = localStorage.getItem(KEY) || ""; } catch {}
// ältere Mirage-Versionen kannten nur die Selektor-Liste: deren Version zählt als „zuletzt gesehen“
if (!last) last = prevSpotify || "";
const store = () => {
  try { localStorage.setItem(KEY, spotifyVersion); } catch {}
};
const isUpdate = !!(spotifyVersion && last && last !== spotifyVersion);
if (spotifyVersion && !last) store(); // erste Installation: merken, nichts sagen
if (isUpdate) handOffUpdateNote();

const fn = (o, ...names) => names.every((n) => typeof o?.[n] === "function");
// was Mirage braucht – je Punkt ein Name für die Notiz. Nur, was es auf jeder Seite geben muss: das Cover in der
// Leiste etwa fehlt zu Recht, solange rechts die große Ansicht offen ist
const CHECKS = [
  ["layout", () => CRITICAL.every((k) => !health.missing.includes(k))],
  ["player", () => fn(S.Player, "addEventListener", "play", "pause", "next", "back", "seek", "getProgress", "getDuration")],
  ["volume", () => fn(S.Player, "getVolume", "setVolume") && typeof (S.Player.getVolume() ?? S.Platform?.PlaybackAPI?._volume) === "number"],
  ["queue", () => Array.isArray(S.Queue?.nextTracks)],
  ["pages", () => fn(S.Platform?.History, "listen")],
  ["data", () => fn(S.CosmosAsync, "get")],
  ["colors", () => fn(S, "colorExtractor")],
  ["beats", () => fn(S, "getAudioData")],
];
function selfCheck() {
  if (!health.checked) checkHealth();
  return CHECKS.filter(([, ok]) => {
    try { return !ok(); } catch { return true; }
  }).map(([k]) => k);
}

const HELP = LANG === "de"
  ? "https://github.com/Passimoritz/spicetify-mirage/blob/main/README.de.md#-hilfe-nach-einem-spotify-update"
  : "https://github.com/Passimoritz/spicetify-mirage#-help-something-looks-wrong-after-a-spotify-update";
const WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10.3 4.2 2.9 17.4A2 2 0 0 0 4.6 20.4h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17.2h.01"/></svg>';
const OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.8 2.8L16.2 9.6"/></svg>';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
function show(bad) {
  document.querySelector(".m-updnote")?.remove();
  const box = el("div", "m-updnote" + (bad.length ? " is-warn" : ""));
  box.setAttribute("role", bad.length ? "alert" : "status");
  const icon = el("i", "m-updnote-icon");
  icon.innerHTML = bad.length ? WARN : OK;
  const body = el("div", "m-updnote-body");
  body.append(el("b", "", t("updnoteTitle").replace("{v}", short(spotifyVersion))));
  body.append(el("span", "", bad.length ? t("updnoteBad").replace("{list}", bad.map((k) => t("updnote_" + k)).join(", ")) : t("updnoteOk")));
  if (bad.length) {
    const row = el("div", "m-updnote-actions");
    const help = el("button", "m-updnote-btn is-main", t("updnoteHelp"));
    help.type = "button";
    help.onclick = () => window.open(HELP, "_blank");
    const copy = el("button", "m-updnote-btn", t("diagnostics"));
    copy.type = "button";
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(diagnostics());
        copy.textContent = t("copied");
      } catch {
        S.showNotification?.(diagnostics(), false, 15000);
      }
    };
    row.append(help, copy);
    body.append(row);
  }
  const x = el("button", "m-updnote-x");
  x.type = "button";
  x.setAttribute("aria-label", t("k_close"));
  x.innerHTML = UI.close;
  // der dünne Balken unten läuft ab und blendet die Notiz dann aus; beim Überfahren oder Fokus hält er an (CSS)
  const bar = el("i", "m-updnote-time");
  // mit „important“: bei „weniger Bewegung“ kürzt user.css jede Animation auf 0,001 ms – die Notiz wäre sofort wieder
  // weg, bevor sie jemand lesen kann. Der Balken ist hier die Uhr, keine Zierde.
  bar.style.setProperty("animation-duration", (bad.length ? 25 : 8) + "s", "important");
  box.append(icon, body, x, bar);
  let gone = false;
  const hide = () => {
    if (gone) return;
    gone = true;
    document.removeEventListener("visibilitychange", vis);
    box.classList.add("is-gone");
    setTimeout(() => box.remove(), 400);
  };
  // Fenster verdeckt: niemand liest mit, also auch nicht ablaufen lassen
  const vis = () => box.classList.toggle("is-paused", document.hidden);
  document.addEventListener("visibilitychange", vis);
  vis();
  x.onclick = hide;
  bar.addEventListener("animationend", hide);
  box.addEventListener("keydown", (e) => e.key === "Escape" && hide());
  document.body.append(box);
  return box;
}

if (isUpdate) {
  // Spotify baut die Oberfläche nach und nach auf: nach der Prüfung der Selektoren (8 s) urteilen
  setTimeout(() => {
    try {
      const bad = selfCheck();
      store();
      show(bad);
    } catch {}
  }, 9000);
}
