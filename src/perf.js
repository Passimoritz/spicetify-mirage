import { S, root, VERSION } from "./core.js";
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
// Das Ergebnis wird je Gerät gemerkt: dieselbe Grafikkarte am selben Bildschirm muss nicht bei jedem
// Start neu vermessen werden. Neu gemessen wird nach einem Mirage-Update, nach 14 Tagen oder wenn
// sich Grafikkarte oder Bildschirm ändern (Dock, anderer Monitor).
const PERF_KEY = "mirage:perf", PERF_DAYS = 14;
function deviceKey() {
  let gpu = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    gpu = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl?.getParameter(gl.RENDERER) || "");
    // den Probe-Kontext gleich wieder freigeben
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {}
  return [gpu, `${screen.width}x${screen.height}`, devicePixelRatio || 1, navigator.hardwareConcurrency || 0].join("|");
}
function known(key) {
  try {
    const m = JSON.parse(localStorage.getItem(PERF_KEY) || "null");
    return !!m && m.key === key && m.v === VERSION && Date.now() - m.at < PERF_DAYS * 864e5;
  } catch {
    return false;
  }
}
function remember(key, fps) {
  try {
    localStorage.setItem(PERF_KEY, JSON.stringify({ key, v: VERSION, at: Date.now(), fps: Math.round(fps), preset: cfg.preset }));
  } catch {}
}
let measured = false;
function measure(onDone, wait = 4000) {
  if (measured || !cfg.autoPerf || !ORDER.includes(cfg.preset) || cfg.preset === "light") return;
  measured = true;
  const key = deviceKey();
  if (known(key)) return;
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
    const next = ORDER[ORDER.indexOf(cfg.preset) + 1];
    if (fps >= 45 || !next) return remember(key, fps);
    applyPreset(next);
    onDone();
    try {
      S.showNotification?.(t("perfStepped").replace("{fps}", Math.round(fps)).replace("{preset}", t("preset_" + next)), false, 6000);
    } catch {}
    // Reicht die neue Stufe? Früher klärte das erst der nächste Start – jetzt gleich, weil das Ergebnis
    // danach 14 Tage gilt. „Leicht“ ist die letzte Stufe und wird ohne weitere Messung gemerkt.
    if (next === "light") return remember(key, fps);
    measured = false;
    measure(onDone, 2000);
  };
  // erst messen, wenn Spotify fertig aufgebaut ist
  setTimeout(() => requestAnimationFrame(sample), wait);
}

/* ---------------------------------------------------------------- Verdeckt = Pause */
// Minimiert oder ganz verdeckt meldet Chromium das Fenster als „hidden“: dann stehen auch die
// CSS-Animationen des Hintergrunds (die JS-Schleifen prüfen document.hidden ohnehin).
const syncHidden = () => root.classList.toggle("mirage-hidden", document.hidden);
document.addEventListener("visibilitychange", syncHidden);
syncHidden();

export { PRESETS, PRESET_KEYS, applyPreset, detectPreset, measure };
