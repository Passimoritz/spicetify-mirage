import { S } from "./core.js";

/* ---------------------------------------------------------------- Farbschemata */
// Aus color.ini übernommen: so lässt sich das Schema live wechseln, ohne "spicetify apply".
const SCHEMES = {"Mirage":{"text":"F5F3FF","subtext":"B9B4CC","main":"07060C","main-elevated":"12101C","highlight":"1C1929","highlight-elevated":"262236","sidebar":"0B0A12","player":"0B0A12","card":"14121E","shadow":"000000","selected-row":"E9E4FF","button":"B69CFF","button-active":"D4C6FF","button-disabled":"4A4560","tab-active":"2A2540","notification":"7C5CFF","notification-error":"FF5C7A","misc":"8A85A0"},"Obsidian":{"text":"F2F2F2","subtext":"A8A8A8","main":"050505","main-elevated":"101010","highlight":"1A1A1A","highlight-elevated":"242424","sidebar":"090909","player":"090909","card":"121212","shadow":"000000","selected-row":"FFFFFF","button":"E8E8E8","button-active":"FFFFFF","button-disabled":"444444","tab-active":"262626","notification":"3A3A3A","notification-error":"FF4D4D","misc":"7A7A7A"},"Sakura":{"text":"FFF2F6","subtext":"D9B3C1","main":"0E070B","main-elevated":"1A0E15","highlight":"26141E","highlight-elevated":"331B28","sidebar":"12090E","player":"12090E","card":"1C0F17","shadow":"000000","selected-row":"FFD6E4","button":"FF8FB8","button-active":"FFB8D2","button-disabled":"5C3A48","tab-active":"3A1F2D","notification":"E0507F","notification-error":"FF5C5C","misc":"A07C8C"},"Abyss":{"text":"EAFBFF","subtext":"9CC3CF","main":"03090C","main-elevated":"081419","highlight":"0E1E25","highlight-elevated":"152A33","sidebar":"050D11","player":"050D11","card":"0A171D","shadow":"000000","selected-row":"C9F6FF","button":"4FE3FF","button-active":"9AF0FF","button-disabled":"2C4A55","tab-active":"15303A","notification":"1AA6C2","notification-error":"FF6B6B","misc":"6E929E"},"Ember":{"text":"FFF6EE","subtext":"D6B8A0","main":"0C0705","main-elevated":"18100B","highlight":"241811","highlight-elevated":"302016","sidebar":"100A07","player":"100A07","card":"1A110C","shadow":"000000","selected-row":"FFE2C7","button":"FF9F45","button-active":"FFC48A","button-disabled":"5A4232","tab-active":"3A2516","notification":"E06A1A","notification-error":"FF4D5E","misc":"A08670"}};
// Helles Schema: dunkle Schrift auf hellem Glas (user.css passt Linien und Hintergrund an)
SCHEMES.Pearl = {"text":"1D1A2B","subtext":"5D5873","main":"F4F1FA","main-elevated":"FFFFFF","highlight":"E7E2F2","highlight-elevated":"DCD5EC","sidebar":"EEEAF6","player":"EEEAF6","card":"FFFFFF","shadow":"9A93B0","selected-row":"2A2540","button":"6B4EE6","button-active":"4F35C9","button-disabled":"C9C2DB","tab-active":"DCD5EC","notification":"7C5CFF","notification-error":"D7354F","misc":"8A85A0"};
const BUILT_IN = Object.keys(SCHEMES);
const LIGHT = new Set(["Pearl"]);
const hexRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const schemeSheet = document.createElement("style");
schemeSheet.id = "mirage-scheme";
document.head.append(schemeSheet);
// gerade sichtbares Schema – kann vom gewählten abweichen (eigenes Schema pro Playlist)
let activeScheme = "";
function applyScheme(name) {
  const sc = SCHEMES[name];
  activeScheme = sc ? name : "Mirage";
  const css = sc
    ? "html:root{" + Object.entries(sc).filter(([k]) => k !== "light").map(([k, v]) => `--spice-${k}:#${v};--spice-rgb-${k}:${hexRgb(v).join(",")};`).join("") + "}"
    : "";
  // nur schreiben, wenn sich etwas ändert – jedes Neuschreiben berechnet ganz Spotify neu
  if (schemeSheet.textContent !== css) schemeSheet.textContent = css;
  document.documentElement.dataset.mScheme = activeScheme;
  document.documentElement.classList.toggle("mirage-light", LIGHT.has(activeScheme) || !!sc?.light);
}
const schemePalette = () => {
  const sc = SCHEMES[activeScheme || cfg.scheme] || SCHEMES.Mirage;
  return [hexRgb(sc.button), hexRgb(sc.notification), hexRgb(sc["button-active"])];
};

/* ---------------------------------------------------------------- Einstellungen */
const KEY = "mirage:settings";
const schemeIsDynamic = !S.Config?.color_scheme || /mirage/i.test(S.Config.color_scheme);
const DEFAULTS = {
  dynamic: schemeIsDynamic,
  particles: true,
  vinyl: true,
  tilt: true,
  beat: true,
  cascade: true,
  burst: true,
  overlay: true,
  grain: true,
  glass: false,
  // folgt der Systemeinstellung „Bewegung reduzieren“, bis man selbst schaltet
  calm: !!matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  preset: "balanced",
  autoPerf: true,
  lyrSize: 100,
  lyrGap: 100,
  translate: false,
  canvas: true,
  freeze: false,
  pinned: {},
  playlistSchemes: {},
  customSchemes: {},
  blur: 28,
  bright: 100,
  imMode: "cover",
  vizStyle: "bars",
  vizBars: 120,
  vizHeight: 100,
  vizSmooth: 6,
  vizGlow: true,
  vizRings: true,
  vizMirror: true,
  vizSpin: false,
  scheme: Object.keys(SCHEMES).find((n) => n.toLowerCase() === String(S.Config?.color_scheme || "").toLowerCase()) || "Mirage",
};
let cfg = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  if ("scheme" in saved && saved.schemeCfg !== (S.Config?.color_scheme || "")) {
    delete saved.scheme;
    delete saved.dynamic;
  }
  cfg = { ...DEFAULTS, ...saved };
} catch {}
// eigene Schemata stehen gleichberechtigt neben den mitgelieferten
for (const [name, sc] of Object.entries(cfg.customSchemes || {})) if (!BUILT_IN.includes(name)) SCHEMES[name] = sc;
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {}
};
// alles auf Anfang, eigene Schemata und gemerkte Farben bleiben
function resetSettings() {
  const keep = { customSchemes: cfg.customSchemes, pinned: cfg.pinned, playlistSchemes: cfg.playlistSchemes };
  for (const k of Object.keys(cfg)) delete cfg[k];
  Object.assign(cfg, DEFAULTS, keep);
  save();
}

// Ganzes Schema (18 Farben) aus vier Grundfarben ableiten – für den Schema-Baukasten
function buildScheme({ base, accent, deep, light }) {
  const mix = (a, b, f) => hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i] - v) * f));
  const hex = (rgb) => rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  const isLight = hexRgb(base).reduce((s, v) => s + v, 0) / 3 > 140;
  const ink = isLight ? "1D1A2B" : "F5F3FF";
  return {
    text: ink, subtext: hex(mix(ink, base, 0.35)), main: base, "main-elevated": hex(mix(base, ink, 0.05)),
    highlight: hex(mix(base, ink, 0.09)), "highlight-elevated": hex(mix(base, ink, 0.14)), sidebar: hex(mix(base, ink, 0.025)),
    player: hex(mix(base, ink, 0.025)), card: hex(mix(base, ink, 0.06)), shadow: isLight ? "9A93B0" : "000000",
    "selected-row": hex(mix(light, ink, 0.3)), button: accent, "button-active": light, "button-disabled": hex(mix(base, ink, 0.25)),
    "tab-active": hex(mix(base, accent, 0.18)), notification: deep, "notification-error": "FF5C7A", misc: hex(mix(ink, base, 0.5)),
    ...(isLight ? { light: true } : {}),
  };
}

export { SCHEMES, BUILT_IN, hexRgb, applyScheme, schemePalette, KEY, DEFAULTS, cfg, save, resetSettings, buildScheme };
