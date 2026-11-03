import { S } from "./core.js";
import { immersive, MODES } from "./immersive.js";
import { tapSync } from "./clock.js";
import { t } from "./i18n.js";

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === "KeyM") {
    e.preventDefault();
    immersive.toggle();
  } else if (immersive.isOpen()) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.target.matches?.("input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable]")) return;
    const keys = {
      Escape: () => (document.fullscreenElement ? document.exitFullscreen() : immersive.close()),
      Space: () => S.Player.togglePlay(),
      ArrowLeft: () => immersive.seekBy(-5000),
      ArrowRight: () => immersive.seekBy(5000),
      ArrowUp: () => immersive.volBy(0.05),
      ArrowDown: () => immersive.volBy(-0.05),
      KeyL: () => immersive.like(),
      KeyS: () => immersive.shuffle(),
      KeyR: () => immersive.repeat(),
      KeyF: () => immersive.toggleFull(),
      F11: () => immersive.toggleFull(),
      KeyQ: () => immersive.toggleQueue(),
      KeyN: () => S.Player.next(),
      KeyP: () => S.Player.back(),
      // im Takt antippen: misst den Versatz zwischen Bild und Ton ein
      KeyT: () => {
        const r = tapSync();
        const msg = r.none ? t("tapNoBeat") : r.done ? t("tapDone").replace("{ms}", (r.ms > 0 ? "+" : "") + r.ms) : r.unsure ? t("tapUnsure") : t("tapCount").replace("{n}", r.n);
        try {
          S.showNotification?.(msg, false, 1800);
        } catch {}
      },
    };
    if (e.key === "?") return immersive.toggleKeys();
    if (/^Digit[1-5]$/.test(e.code)) immersive.setMode(MODES[+e.code.slice(5) - 1][0], true);
    else if (keys[e.code] && !(e.code === "Space" && e.target.closest?.("button"))) {
      e.preventDefault();
      e.stopPropagation();
      keys[e.code]();
    }
  }
}, true);
