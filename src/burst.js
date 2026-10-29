import { SEL } from "./selectors.js";
import { cfg } from "./config.js";
import { palette } from "./color.js";

/* ---------------------------------------------------------------- Herz-Explosion */
function burst(x, y) {
  const box = document.createElement("div");
  box.className = "m-burst";
  box.style.left = x + "px";
  box.style.top = y + "px";
  box.append(document.createElement("b"));
  const cols = palette().map((c) => `rgb(${c.join(",")})`);
  for (let i = 0; i < 16; i++) {
    const s = document.createElement("i");
    const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 36 + Math.random() * 54;
    if (i % 3 === 0) {
      s.className = "h";
      s.textContent = "♥";
    }
    s.style.setProperty("--c", cols[i % cols.length]);
    s.style.setProperty("--tx", Math.cos(ang) * dist + "px");
    s.style.setProperty("--ty", Math.sin(ang) * dist - 10 + "px");
    s.style.setProperty("--r", Math.round((Math.random() - 0.5) * 120) + "deg");
    box.append(s);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 1100);
}
// Nur sprachunabhängige Merkmale (data-testid), damit es in jeder Spotify-Sprache greift
document.addEventListener(
  "click",
  (e) => {
    if (!cfg.burst || cfg.calm) return;
    const b = e.target.closest?.(SEL.likeButton);
    if (!b) return;
    const { clientX: x, clientY: y } = e;
    setTimeout(() => b.getAttribute("aria-checked") !== "false" && burst(x, y), 220);
  },
  true
);

export { burst };
