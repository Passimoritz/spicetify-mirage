import { root } from "./core.js";
import { cfg } from "./config.js";

/* ---------------------------------------------------------------- Schriftwahl */
// Outfit kommt schon über user.css; die anderen lädt Mirage erst, wenn man sie wählt
// (bzw. alle auf einmal, wenn die Einstellungen offen sind, damit die Knöpfe in ihrer Schrift erscheinen).
const FONTS = {
  outfit: ["Outfit", ""],
  jakarta: ["Plus Jakarta Sans", "Plus+Jakarta+Sans"],
  manrope: ["Manrope", "Manrope"],
  sora: ["Sora", "Sora"],
  lexend: ["Lexend", "Lexend"],
  nunito: ["Nunito", "Nunito"],
  system: ["", ""],
};
const STACK = '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, sans-serif';
const loaded = new Set();
function load(keys) {
  const fam = keys.map((k) => FONTS[k]?.[1]).filter((f) => f && !loaded.has(f));
  if (!fam.length) return;
  fam.forEach((f) => loaded.add(f));
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?" + fam.map((f) => `family=${f}:wght@400;500;600;700;800`).join("&") + "&display=swap";
  document.head.append(link);
}
const stackOf = (k) => (FONTS[k]?.[0] ? `"${FONTS[k][0]}", ${STACK}` : STACK);
function applyFont() {
  const k = FONTS[cfg.font] ? cfg.font : "outfit";
  load([k]);
  if (k === "outfit") root.style.removeProperty("--m-font");
  else root.style.setProperty("--m-font", stackOf(k));
}
const preloadFonts = () => load(Object.keys(FONTS));

export { FONTS, applyFont, preloadFonts, stackOf };
