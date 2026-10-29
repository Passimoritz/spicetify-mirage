import { S, root } from "./core.js";
import { t } from "./i18n.js";
import { cfg, save } from "./config.js";

/* ---------------------------------------------------------------- Leistungs-Stufen */
// Ein Preset setzt mehrere Schalter auf einmal. Wer danach einen einzelnen Schalter ändert,
// landet bei „Eigene“ – die Presets überschreiben dann nichts mehr.
const PRESETS = {
  full: { glass: true, particles: true, grain: true, beat: true, tilt: true, cascade: true, calm: false, lite: false },
  balanced: { glass: false, particles: true, grain: true, beat: true, tilt: true, cascade: true, calm: false, lite: false },
  light: { glass: false, particles: false, grain: false, beat: true, tilt: false, cascade: true, calm: false, lite: true },
  calm: { glass: false, particles: false, grain: true, beat: false, tilt: false, cascade: false, calm: true, lite: false },
};
const ORDER = ["full", "balanced", "light"];
// welche Schalter zu den Presets gehören (alles andere bleibt beim Preset-Wechsel unberührt)
const PRESET_KEYS = Object.keys(PRESETS.full);

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  Object.assign(cfg, p, { preset: name });
  save();
}
// einzelner Schalter geändert: passt die Kombination noch zu einem Preset?
function detectPreset() {
  const hit = Object.entries(PRESETS).find(([, p]) => PRESET_KEYS.every((k) => !!cfg[k] === !!p[k]));
  cfg.preset = hit ? hit[0] : "custom";
}

/* ---------------------------------------------------------------- Selbst drosseln */
// In den ersten Sekunden die Bildrate messen. Schafft der Rechner keine ~45 fps, eine Stufe
// runter und einmal Bescheid geben. Läuft pro Start höchstens einmal, nur bei sichtbarem Fenster.
let measured = false;
function measure(onDone) {
  if (measured || !cfg.autoPerf || !ORDER.includes(cfg.preset) || cfg.preset === "light") return;
  measured = true;
  let frames = 0, start = 0, hiddenSeen = false;
  const sample = (now) => {
    if (document.hidden) hiddenSeen = true;
    if (!start) start = now;
    frames++;
    if (now - start < 5000) return requestAnimationFrame(sample);
    const fps = (frames * 1000) / (now - start);
    // verdecktes Fenster verfälscht die Messung: beim nächsten Sichtbarwerden neu versuchen
    if (hiddenSeen) {
      measured = false;
      return document.addEventListener("visibilitychange", () => !document.hidden && measure(onDone), { once: true });
    }
    if (fps >= 45) return;
    const next = ORDER[ORDER.indexOf(cfg.preset) + 1];
    if (!next) return;
    applyPreset(next);
    onDone();
    try {
      S.showNotification?.(t("perfStepped").replace("{fps}", Math.round(fps)).replace("{preset}", t("preset_" + next)), false, 6000);
    } catch {}
  };
  // erst messen, wenn Spotify fertig aufgebaut ist
  setTimeout(() => requestAnimationFrame(sample), 4000);
}

/* ---------------------------------------------------------------- Verdeckt = Pause */
// Minimiert oder ganz verdeckt meldet Chromium das Fenster als „hidden“: dann stehen auch die
// CSS-Animationen des Hintergrunds (die JS-Schleifen prüfen document.hidden ohnehin).
const syncHidden = () => root.classList.toggle("mirage-hidden", document.hidden);
document.addEventListener("visibilitychange", syncHidden);
syncHidden();

export { PRESETS, PRESET_KEYS, applyPreset, detectPreset, measure };
