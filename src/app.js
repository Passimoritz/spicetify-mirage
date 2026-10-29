import { S, VERSION } from "./core.js";
import { SCHEMES, cfg } from "./config.js";
import { palette } from "./color.js";
import { bridge } from "./bridge.js";
import { health, diagnostics } from "./selectors.js";
import { t } from "./i18n.js";
import { applySettings, openSettings, welcome, selectScheme } from "./settings.js";
import { immersive, ICON } from "./immersive.js";
import { pageEnter } from "./pages.js";
import { onSong, onPlayPause } from "./song.js";
import { measure } from "./perf.js";
import { nowPlayingCard, weekCard, week } from "./share.js";
import "./cards.js";
import "./tints.js";
import "./keys.js";
import "./readability.js";
import "./selectors.js";

(function addMenu() {
  if (!S.Menu?.Item) return setTimeout(addMenu, 500);
  try {
    new S.Menu.Item(t("menu"), false, openSettings, "brightness").register();
    new S.Menu.Item(t("shareNow"), false, () => nowPlayingCard(), "share").register();
  } catch {}
})();
(function addTopbar() {
  if (!S.Topbar?.Button) return setTimeout(addTopbar, 500);
  try {
    new S.Topbar.Button(t("immersive"), ICON.orb, () => immersive.toggle());
  } catch {}
})();

S.Player.addEventListener("songchange", () => onSong(true));
S.Player.addEventListener("onplaypause", onPlayPause);

applySettings();
onPlayPause();
onSong(false);
setTimeout(pageEnter, 400);
// zu langsamer Rechner: eine Leistungsstufe runter (einmal pro Start)
measure(applySettings);
welcome();

// Schnittstelle für die Mirage-App (Custom App unter Spotifys Seitenleiste)
window.Mirage = {
  version: VERSION,
  schemes: () =>
    Object.entries(SCHEMES).map(([name, sc]) => ({ name, main: sc.main, a: sc.button, b: sc.notification, c: sc["button-active"], active: cfg.scheme === name })),
  setScheme: selectScheme,
  palette: () => palette(),
  week,
  overlay: () => ({ enabled: !!cfg.overlay, connected: bridge.connected() }),
  health: () => ({ ...health }),
  diagnostics,
  openSettings,
  openImmersive: () => immersive.open(),
  shareNow: () => nowPlayingCard(),
  shareWeek: () => weekCard(),
};
