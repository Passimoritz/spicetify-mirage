import { S, failed, guard } from "./core.js";
import { t } from "./i18n.js";
import { applySettings, openSettings, welcome } from "./settings.js";
import { immersive, ICON } from "./immersive.js";
import { pageEnter } from "./pages.js";
import { onSong, onPlayPause } from "./song.js";
import { measure } from "./perf.js";
import { nowPlayingCard } from "./share.js";
import "./selectors.js";

// Zusatz-Bausteine einzeln laden: bricht einer beim Start ab, läuft der Rest weiter
guard("cards", () => import("./cards.js"));
guard("tints", () => import("./tints.js"));
guard("keys", () => import("./keys.js"));
guard("readability", () => import("./readability.js"));
guard("library", () => import("./library.js"));
guard("remote", () => import("./remote.js"));

(function addMenu() {
  if (!S.Menu?.Item) return setTimeout(addMenu, 500);
  try {
    new S.Menu.Item(t("menu"), false, openSettings, "brightness").register();
    new S.Menu.Item(t("shareNow"), false, () => nowPlayingCard(), "share").register();
  } catch {}
})();
// Immersiv-Knopf: eigener Knopf direkt links neben der Glocke („Neuigkeiten“). Spicetifys
// Topbar-Knopf verschwand, wenn Spotify die Leiste neu aufbaut – dieser hier setzt sich
// selbst wieder an seinen Platz. Ohne Glocke (ältere Spotify-Versionen) der Spicetify-Knopf.
(function addTopbar() {
  // Spotify rendert die testid der Glocke nicht immer, und ihr Name ist übersetzt: darum notfalls
  // der erste Knopf rechts oben in den Aktionsknöpfen (Glocke, dann Freunde, dann Profil)
  const BELL =
    '[data-testid="whats-new-feed-button"], .main-globalNav-contentRight .main-actionButtons button:not(.m-orb-btn):not([data-testid="user-widget-link"])';
  const btn = document.createElement("button");
  btn.className = "m-orb-btn";
  btn.type = "button";
  btn.title = t("immersive");
  btn.setAttribute("aria-label", t("immersive"));
  btn.innerHTML = `<span class="m-orb-shine" aria-hidden="true"></span>${ICON.orb}`;
  btn.addEventListener("click", () => immersive.toggle());
  // die Glocke steckt evtl. in Hüllen ohne weitere Kinder: vor die äußerste Hülle setzen
  const slot = (bell) => {
    let n = bell;
    while (n.parentElement && n.parentElement.childElementCount === 1 && n.parentElement !== document.body) n = n.parentElement;
    return n;
  };
  const place = () => {
    const bell = document.querySelector(BELL);
    if (!bell) return false;
    const s = slot(bell);
    if (btn.nextElementSibling !== s) s.before(btn);
    return true;
  };
  let fallback = null, seen = false;
  const t0 = Date.now();
  (function keep() {
    // Fenster verdeckt: niemand sieht den Knopf, also auch nicht jede Sekunde nachsehen
    if (document.hidden) return document.addEventListener("visibilitychange", keep, { once: true });
    if (place()) {
      seen = true;
      // Glocke doch noch da: Ersatzknopf wieder weg, sonst gäbe es zwei
      if (fallback) {
        try {
          fallback.deregister?.();
        } catch {}
        fallback.element?.remove();
        fallback = null;
      }
    } else if (!seen && !fallback && Date.now() - t0 > 15000 && S.Topbar?.Button) {
      try {
        fallback = new S.Topbar.Button(t("immersive"), ICON.orb, () => immersive.toggle());
        fallback.element?.classList.add("m-orb-btn");
      } catch {}
    }
    // günstig: ein querySelector pro Sekunde, umgesetzt wird nur, wenn er fehlt oder verrutscht ist
    setTimeout(keep, btn.isConnected ? 1000 : 300);
  })();
})();

S.Player.addEventListener("songchange", () => guard("song", () => onSong(true)));
S.Player.addEventListener("onplaypause", (e) => guard("playpause", () => onPlayPause(e)));

guard("settings", () => applySettings());
guard("playpause", () => onPlayPause());
guard("song", () => onSong(false));
setTimeout(() => guard("pages", () => pageEnter()), 400);
// zu langsamer Rechner: eine Leistungsstufe runter (einmal pro Start)
guard("perf", () => measure(applySettings));
guard("welcome", () => welcome());
// ist beim Start etwas ausgefallen: einmal sagen, welcher Teil – der Rest läuft
setTimeout(() => {
  if (!failed.length) return;
  try {
    S.showNotification?.(t("partFailed").replace("{p}", failed.join(", ")), true, 9000);
  } catch {}
}, 12000);
