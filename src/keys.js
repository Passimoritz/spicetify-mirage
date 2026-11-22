import { S } from "./core.js";
import { immersive, MODES } from "./immersive.js";
import { tapSync } from "./clock.js";
import { t } from "./i18n.js";
import { free } from "./lock.js";
import { PLR } from "./player.js";
import { shortcutFor } from "./shortcuts.js";

// Befehle von außen (Stream Deck über die Overlay-App)
window.addEventListener("mirage:cmd", (e) => {
  if (e.detail === "immersive") immersive.toggle();
  else if (e.detail === "confetti") immersive.confetti();
  else if (e.detail === "party") {
    if (!immersive.isOpen()) immersive.open();
    immersive.setMode("party", true);
  }
});

// Was jede Taste tut – welche Taste es ist, steht in shortcuts.js (dieselbe Tabelle füllt die Tastenhilfe)
const ACTIONS = {
  // Esc schließt zuerst ein offenes Menü, erst dann das Vollbild, zuletzt den Immersiv-Modus
  close: () => immersive.dismiss() || (document.fullscreenElement ? document.exitFullscreen() : immersive.close()),
  play: () => free() && PLR.togglePlay(),
  seekBack: () => free() && immersive.seekBy(-5000),
  seekFwd: () => free() && immersive.seekBy(5000),
  volUp: () => immersive.volBy(0.05),
  volDown: () => immersive.volBy(-0.05),
  like: () => immersive.like(),
  // bei Podcasts gibt es weder Zufall noch Wiederholen (die Knöpfe sind ausgeblendet): dann tun S und R nichts
  shuffle: () => free() && immersive.shuffle(),
  repeat: () => free() && immersive.repeat(),
  full: () => immersive.toggleFull(),
  queue: () => immersive.toggleQueue(),
  // 1.27 actions: Song-Menü (auch Kontextmenü-Taste und Umschalt+F10 wie überall) und „Zu Playlist hinzufügen“
  song: () => immersive.songMenu(),
  addto: () => immersive.songMenu("playlists"),
  next: () => free() && PLR.next(),
  prev: () => free() && PLR.back(),
  timing: () => immersive.toggleTiming(),
  confetti: () => immersive.confetti(true),
  // Menü „Mehr“ (darin Aussehen & Leistung), ohne die Einstellungen zu öffnen
  more: () => immersive.perfMenu(),
  // im Takt antippen: misst den Versatz zwischen Bild und Ton ein
  tap: () => {
    const r = tapSync();
    const msg = r.none ? t("tapNoBeat") : r.done ? t("tapDone").replace("{ms}", (r.ms > 0 ? "+" : "") + r.ms) : r.unsure ? t("tapUnsure") : t("tapCount").replace("{n}", r.n);
    try {
      S.showNotification?.(msg, false, 1800);
    } catch {}
  },
};

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === "KeyM") {
    e.preventDefault();
    immersive.toggle();
  } else if (immersive.isOpen()) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.target.matches?.("input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable]")) return;
    // ein Fenster über der Ebene (Mirage-Einstellungen aus „Mehr“) behält seine Tasten – Esc schließt dort den Dialog
    if (e.target.closest?.('[role="dialog"]:not(#mirage-immersive), .GenericModal')) return;
    // Timing von Hand: Enter, Rücktaste und Esc gehören dann dem Editor
    if (immersive.timingKey(e.code)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key === "?") return immersive.toggleKeys();
    // in der Reiterleiste wechseln die Pfeiltasten die Ansicht (immersive.js), statt zu spulen
    if (/^Arrow(Left|Right)$/.test(e.code) && e.target.closest?.('[role="tablist"]')) return;
    // in einem offenen Menü (Seitenleiste) gehören Pfeil hoch/runter, Pos1 und Ende der Menüführung
    if (/^(Arrow(Up|Down)|Home|End)$/.test(e.code) && e.target.closest?.(".m-im-side")) return;
    // ein Regler mit Fokus (Lautstärke) bewegt sich mit den Pfeilen selbst
    if (/^Arrow/.test(e.code) && e.target.matches?.("input[type=range]")) return;
    // 1 … 6: Cover · Liedtext · Visualizer · Mix · Party · Uhr (so viele, wie es Ansichten gibt)
    if (/^Digit[1-9]$/.test(e.code) && MODES[+e.code.slice(5) - 1]) return immersive.setMode(MODES[+e.code.slice(5) - 1][0], true);
    const sc = shortcutFor(e.code, e.shiftKey);
    if (sc && ACTIONS[sc.id] && !(e.code === "Space" && e.target.closest?.("button"))) {
      e.preventDefault();
      e.stopPropagation();
      ACTIONS[sc.id]();
    }
  }
}, true);
