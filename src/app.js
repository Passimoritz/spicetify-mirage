import { S } from "./core.js";
import { t } from "./i18n.js";
import { applySettings, openSettings, welcome } from "./settings.js";
import { immersive, ICON } from "./immersive.js";
import { pageEnter } from "./pages.js";
import { onSong, onPlayPause } from "./song.js";
import { measure } from "./perf.js";
import { nowPlayingCard } from "./share.js";
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
    const b = new S.Topbar.Button(t("immersive"), ICON.orb, () => immersive.toggle());
    // eigene Klasse: der Knopf bekommt in user.css die Akzentfarbe statt Spotifys Grau
    b.element?.classList.add("m-orb-btn");
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
