import { SEL } from "./selectors.js";
import { cfg } from "./config.js";

/* ---------------------------------------------------------------- Karten: Licht + Neigung */
let hoverCard = null, pending = null, queued = false, wheelUntil = 0;
document.addEventListener(
  "wheel",
  () => {
    wheelUntil = performance.now() + 350;
    if (hoverCard) {
      hoverCard.style.setProperty("--rx", "0deg");
      hoverCard.style.setProperty("--ry", "0deg");
    }
  },
  { passive: true }
);
document.addEventListener(
  "pointermove",
  (e) => {
    // Touch und Scrollen per Trackpad: Karten nicht kippen (wackelt sonst unter dem Finger)
    if (e.pointerType === "touch" || performance.now() < wheelUntil) return;
    pending = e;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const ev = pending;
      const card = ev.target.closest?.(SEL.card);
      if (hoverCard && hoverCard !== card) {
        hoverCard.style.setProperty("--rx", "0deg");
        hoverCard.style.setProperty("--ry", "0deg");
      }
      hoverCard = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width;
      const py = (ev.clientY - r.top) / r.height;
      card.style.setProperty("--mx", px * 100 + "%");
      card.style.setProperty("--my", py * 100 + "%");
      if (cfg.tilt && !cfg.calm) {
        card.style.setProperty("--rx", ((0.5 - py) * 9).toFixed(2) + "deg");
        card.style.setProperty("--ry", ((px - 0.5) * 11).toFixed(2) + "deg");
      }
    });
  },
  { passive: true }
);
