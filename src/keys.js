import { S } from "./core.js";
import { immersive, MODES } from "./immersive.js";
import { tapSync } from "./clock.js";
import { t } from "./i18n.js";
import { free } from "./lock.js";
import { PLR } from "./player.js";

// Befehle von außen (Stream Deck über die Overlay-App)
window.addEventListener("mirage:cmd", (e) => {
  if (e.detail === "immersive") immersive.toggle();
  else if (e.detail === "confetti") immersive.confetti();
  else if (e.detail === "party") {
    if (!immersive.isOpen()) immersive.open();
    immersive.setMode("party", true);
  }
});

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === "KeyM") {
    e.preventDefault();
    immersive.toggle();
  } else if (immersive.isOpen()) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.target.matches?.("input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable]")) return;
    const keys = {
      Escape: () => (document.fullscreenElement ? document.exitFullscreen() : immersive.close()),
      Space: () => free() && PLR.togglePlay(),
      ArrowLeft: () => free() && immersive.seekBy(-5000),
      ArrowRight: () => free() && immersive.seekBy(5000),
      ArrowUp: () => immersive.volBy(0.05),
      ArrowDown: () => immersive.volBy(-0.05),
      KeyL: () => immersive.like(),
      KeyS: () => free() && immersive.shuffle(),
      KeyR: () => free() && immersive.repeat(),
      KeyF: () => immersive.toggleFull(),
      F11: () => immersive.toggleFull(),
      KeyQ: () => immersive.toggleQueue(),
      KeyN: () => free() && PLR.next(),
      KeyP: () => free() && PLR.back(),
      KeyE: () => immersive.toggleTiming(),
      KeyC: () => immersive.confetti(),
      // im Takt antippen: misst den Versatz zwischen Bild und Ton ein
      KeyT: () => {
        const r = tapSync();
        const msg = r.none ? t("tapNoBeat") : r.done ? t("tapDone").replace("{ms}", (r.ms > 0 ? "+" : "") + r.ms) : r.unsure ? t("tapUnsure") : t("tapCount").replace("{n}", r.n);
        try {
          S.showNotification?.(msg, false, 1800);
        } catch {}
      },
    };
    // Timing von Hand: Enter, Rücktaste und Esc gehören dann dem Editor
    if (immersive.timingKey(e.code)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key === "?") return immersive.toggleKeys();
    if (/^Digit[1-5]$/.test(e.code)) immersive.setMode(MODES[+e.code.slice(5) - 1][0], true);
    else if (keys[e.code] && !(e.code === "Space" && e.target.closest?.("button"))) {
      e.preventDefault();
      e.stopPropagation();
      keys[e.code]();
    }
  }
}, true);
