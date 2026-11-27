import { S } from "./core.js";
import { immersiveVars } from "./hsl.js";

/* ---------------------------------------------------------------- Farbschemata */
// Aus color.ini übernommen: so lässt sich das Schema live wechseln, ohne "spicetify apply".
const SCHEMES = {"Mirage":{"text":"F5F3FF","subtext":"B9B4CC","main":"07060C","main-elevated":"12101C","highlight":"1C1929","highlight-elevated":"262236","sidebar":"0B0A12","player":"0B0A12","card":"14121E","shadow":"000000","selected-row":"E9E4FF","button":"B69CFF","button-active":"D4C6FF","button-disabled":"4A4560","tab-active":"2A2540","notification":"7C5CFF","notification-error":"FF5C7A","misc":"8A85A0"},"Obsidian":{"text":"F2F2F2","subtext":"A8A8A8","main":"050505","main-elevated":"101010","highlight":"1A1A1A","highlight-elevated":"242424","sidebar":"090909","player":"090909","card":"121212","shadow":"000000","selected-row":"FFFFFF","button":"E8E8E8","button-active":"FFFFFF","button-disabled":"444444","tab-active":"262626","notification":"707070","notification-error":"FF4D4D","misc":"7A7A7A"},"Sakura":{"text":"FFF2F6","subtext":"D9B3C1","main":"0E070B","main-elevated":"1A0E15","highlight":"26141E","highlight-elevated":"331B28","sidebar":"12090E","player":"12090E","card":"1C0F17","shadow":"000000","selected-row":"FFD6E4","button":"FF8FB8","button-active":"FFB8D2","button-disabled":"5C3A48","tab-active":"3A1F2D","notification":"E0507F","notification-error":"FF5C5C","misc":"A07C8C"},"Abyss":{"text":"EAFBFF","subtext":"9CC3CF","main":"03090C","main-elevated":"081419","highlight":"0E1E25","highlight-elevated":"152A33","sidebar":"050D11","player":"050D11","card":"0A171D","shadow":"000000","selected-row":"C9F6FF","button":"4FE3FF","button-active":"9AF0FF","button-disabled":"2C4A55","tab-active":"15303A","notification":"1AA6C2","notification-error":"FF6B6B","misc":"6E929E"},"Ember":{"text":"FFF6EE","subtext":"D6B8A0","main":"0C0705","main-elevated":"18100B","highlight":"241811","highlight-elevated":"302016","sidebar":"100A07","player":"100A07","card":"1A110C","shadow":"000000","selected-row":"FFE2C7","button":"FF9F45","button-active":"FFC48A","button-disabled":"5A4232","tab-active":"3A2516","notification":"E06A1A","notification-error":"FF4D5E","misc":"A08670"}};
// Helles Schema: dunkle Schrift auf hellem Glas (user.css passt Linien und Hintergrund an)
SCHEMES.Pearl = {"text":"1D1A2B","subtext":"5D5873","main":"F4F1FA","main-elevated":"FFFFFF","highlight":"E7E2F2","highlight-elevated":"DCD5EC","sidebar":"EEEAF6","player":"EEEAF6","card":"FFFFFF","shadow":"9A93B0","selected-row":"2A2540","button":"6B4EE6","button-active":"4F35C9","button-disabled":"C9C2DB","tab-active":"DCD5EC","notification":"7C5CFF","notification-error":"D7354F","misc":"8A85A0"};
const BUILT_IN = Object.keys(SCHEMES);
const LIGHT = new Set(["Pearl"]);
const hexRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
// Farben kommen auch von außen (Schema-Code, Sicherung, localStorage) und landen in einem Stylesheet:
// nur sechsstellige Hex-Werte, sonst ließe sich über einen geteilten Code beliebiges CSS einschleusen
const HEX = /^[0-9a-f]{6}$/i;
const isHex = (v) => typeof v === "string" && HEX.test(v);
const NEEDED = ["text", "subtext", "main", "button", "button-active", "notification"];
const validScheme = (sc) =>
  !!sc && typeof sc === "object" && !Array.isArray(sc) &&
  NEEDED.every((k) => isHex(sc[k])) &&
  Object.entries(sc).every(([k, v]) => (k === "light" ? typeof v === "boolean" : isHex(v)));
// nur brauchbare eigene Schemata behalten (Name höchstens 24 Zeichen wie im Baukasten)
function cleanSchemes(list) {
  const out = {};
  if (!list || typeof list !== "object" || Array.isArray(list)) return out;
  for (const [name, sc] of Object.entries(list)) if (name && name.length <= 24 && validScheme(sc)) out[name] = sc;
  return out;
}
const schemeSheet = document.createElement("style");
schemeSheet.id = "mirage-scheme";
document.head.append(schemeSheet);
// gerade sichtbares Schema – kann vom gewählten abweichen (eigenes Schema pro Playlist)
let activeScheme = "";
function applyScheme(name) {
  const sc = SCHEMES[name];
  activeScheme = sc ? name : "Mirage";
  const light = LIGHT.has(activeScheme) || !!sc?.light;
  // helles Schema ohne Coverfarben: der Immersiv-Modus bleibt dunkel und bekommt helle Leitfarben aus dem Schema
  const im = sc && light ? immersiveVars([sc.button, sc.notification, sc["button-active"]].map(hexRgb)) : "";
  const css = sc
    ? "html:root{" + Object.entries(sc).filter(([k, v]) => k !== "light" && isHex(v)).map(([k, v]) => `--spice-${k}:#${v};--spice-rgb-${k}:${hexRgb(v).join(",")};`).join("") + im + "}"
    : "";
  // nur schreiben, wenn sich etwas ändert – jedes Neuschreiben berechnet ganz Spotify neu
  if (schemeSheet.textContent !== css) schemeSheet.textContent = css;
  document.documentElement.dataset.mScheme = activeScheme;
  document.documentElement.classList.toggle("mirage-light", light);
}
const schemePalette = () => {
  const sc = SCHEMES[activeScheme || cfg.scheme] || SCHEMES.Mirage;
  return [hexRgb(sc.button), hexRgb(sc.notification), hexRgb(sc["button-active"])];
};

/* ---------------------------------------------------------------- Einstellungen */
const KEY = "mirage:settings";
const schemeIsDynamic = !S.Config?.color_scheme || /mirage/i.test(S.Config.color_scheme);
const motionMq = matchMedia?.("(prefers-reduced-motion: reduce)") || null;
const reducedMotion = !!motionMq?.matches;
// „Ruhig“ ODER das System bittet gerade um weniger Bewegung: die Systemeinstellung gilt auch, wenn sie erst nach dem
// ersten Start eingeschaltet wurde (als Standardwert wirkt sie nur beim allerersten Laden)
const calmNow = () => !!cfg.calm || !!motionMq?.matches;
// Werte des Presets „Ruhig“ (perf.js übernimmt sie als PRESETS.calm) – hier, weil DEFAULTS sie schon braucht
const CALM_PRESET = { glass: false, particles: false, grain: true, beat: false, tilt: false, cascade: false, calm: true, lite: false };
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
  // „Ruhig“ gibt es nur als Preset (perf.js): calm gehört zu den Preset-Schaltern und folgt dem Preset.
  // Bittet das System um weniger Bewegung, startet Mirage gleich mit dem Preset „Ruhig“ (siehe unten).
  calm: false,
  // „Keine Blitze“ (lichtempfindliche Augen): kein Stroboskop, Blinder, Drop-Blitz, aufblitzender Liedtext –
  // überall, auch auf den Handys. Aus, außer das System bittet um weniger Bewegung
  noFlash: reducedMotion,
  preset: "balanced",
  // Preset vor „Ruhig“: dahin geht der Schalter „Ruhig“ unter „Sicherheit & Komfort“ zurück
  calmFrom: "balanced",
  autoPerf: true,
  lyrSize: 100,
  lyrGap: 100,
  translate: false,
  onlineLyrics: true,
  // Reparaturen nach Spotify-Updates selbst aus dem Repository laden (remote/fixes.json)
  remoteFix: true,
  karaoke: true,
  // Duette: jede Stimme in ihrer Farbe (1.27)
  lyrVoices: true,
  // Verspielter Liedtext-Stil: Betonung, gehaltene Töne, Takt, Wortbilder (lyricstyle.js) – nur auf Wunsch
  lyrPlayful: false,
  // Stärke des verspielten Stils: "subtle" (nur Größe, Stärke, Farbe, wenig Bewegung) · "playful" · "wild" (alles)
  lyrPlayLevel: "playful",
  font: "outfit",
  lyricPicks: {},
  // „Nicht der richtige Liedtext“: je Song die abgelehnten Ergebnisse (Quelle oder Quelle:Kennung)
  lyricBad: {},
  canvas: true,
  // Canvas: ein Schalter für alle Ansichten (Film-Knopf oben, „Mehr“ → Diese Ansicht); nicht in der Uhr (Party: im runden Cover)
  canvasShow: false,
  // Canvas-Ausschnitt aufs Motiv ausrichten (canvasfocus.js, Bildanalyse am Rechner) – nur auf Wunsch
  canvasFocus: false,
  // Übersetzung je Song abweichend vom Schalter für alle (uri → true/false) · Party-Stil je Künstler fest (artistUri → Stil)
  translateSongs: {},
  genreArtist: {},
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
  partyStyle: "auto",
  partyLevel: 2,
  partyFlash: true,
  partyJam: true,
  // Genre je Song über die iTunes-Suche (nur Titel + Künstler)
  partyOnline: true,
  // Party-Erweiterungen, alle einzeln abschaltbar
  partyBlend: true,
  partyHype: true,
  // Wortbilder: gesungene Begriffe bekommen ein passendes Bild (Flammen bei „fire“, Regen bei „Regen“ …)
  partyWords: true,
  // Derbe Wörter im Liedtext (sex, bitch, Scheiße …): nie als Text, nur Licht – "on" | "soft" (nur Farbe) | "off"
  partyExplicit: "on",
  // Show-Momente: Bodennebel, Drohnen-Lichtshow, Hände hoch im Refrain, Blitzlicht-Gewitter
  partyFog: true,
  partyDrones: true,
  partyHandsUp: true,
  partyFlashStorm: true,
  // Musik pausiert: ruhige Szene mit Party-Namen und QR-Code
  // DJ: passt der nächste Song gar nicht (Tonart, Tempo, Energie), einen passenderen aus der Warteschlange vorziehen
  djEnergy: false,
  // Party-Spiele: Runden, Zeiten (Sekunden), Bonus für Schnelligkeit, Größe der Karte, Felder des Glücksrads
  gameRounds: 5,
  gameAsk: 20,
  gameJoin: 120,
  gameClip: 12,
  gameDrink: false,
  gameSfx: 0.7,
  gameDur: 30,
  // Karaoke: so lang ist die gesungene Stelle mindestens (12–45 s, ohne Schalter; die Tests kürzen sie)
  gameKarLen: 30,
  gameBreak: 8,
  gameBonus: true,
  gameCard: "big",
  gameWheel: ["wh1", "wh2", "wh3", "wh4", "wh5", "wh6", "wh7", "wh8"],
  gameWheelOwn: "",
  gameLevel: "normal",
  gameDecade: 0,
  gameSource: "",
  gameSourceName: "",
  gameTeams: 0,
  gameTour: [],
  gameTourN: 4,
  partyDepth: false,
  partyShatter: true,
  partyCamera: false,
  partyCuts: false,
  romanize: false,
  partyWishes: true,
  // Regeln für Songwünsche: offene Wünsche je Gast (0 = beliebig), Sperrliste, keine „Explicit“-Songs,
  // ab so vielen Stimmen von selbst in die Warteschlange (0 = nie, nur was du annimmst)
  wishMax: 0,
  wishBlock: "",
  wishClean: false,
  wishAuto: 0,
  // Reaktionen der Gäste (Emoji vom Handy) steigen am linken und rechten Rand des Party-Bilds auf
  partyReacts: true,
  // Foto-Wand: Gäste schicken Fotos vom Handy, sichtbar erst nach deiner Freigabe; aus, bis du sie einschaltest
  partyPhotos: false,
  // Lichtwelle auf den Handys: 0 alle zugleich, 1 der Reihe nach (Platznummer 1–8), 2 in drei Farbgruppen
  partyWave: 0,
  partyCrowd: true,
  partyJamLight: true,
  partyScreen: true,
  // „Party auf anderem Bildschirm“: Ton per Spotify Connect mit auf den Fernseher schicken
  partyCastSound: false,
  partyEdge: true,
  partyRecap: true,
  // Location: auto (nach Genre), club, festival, stadium, home
  partyVenue: "auto",
  // Lichtregie, Melodie-Laser, Zeitlupe vor dem Drop, DJ-Übergänge, 30 fps in ruhigen Stellen
  partyDirector: true,
  partyMelody: true,
  partySlowmo: true,
  partyDJ: true,
  partyQuietFps: true,
  // Mix: Visualizer reagiert auf Kick, Snare, Hi-Hats
  mixInstruments: true,
  // Energiesparen: auto (im Akkubetrieb), on, off
  eco: "auto",
  // Handys im selben WLAN leuchten mit (über die Overlay-App) – bewusst aus, bis man es will
  partyLive: false,
  // Bühneneffekte (CO2, Pyro, Feuerwerk) und Stroboskop bei harten Drops
  partyFx: true,
  // Moving Heads, Blinder, Laserfläche · Instrumente aus den Credits
  partyRig: true,
  partyInstruments: true,
  // ohne Credits Klavier und verzerrte Gitarre am Klang raten (instrsound.js) – kann danebenliegen, darum aus
  instrSound: false,
  // Versatz zwischen Bild und Ton in ms (Taste T misst ihn ein); je Song für geschätzte Takte
  syncOffset: 0,
  syncSongs: {},
  // Songs, bei denen der Liedtext NICHT automatisch auf den Gesang gelegt wird (lyricsync.js, setAutoSync)
  syncNoAuto: {},
  partyStrobe: true,
  // ab Stufe „Extrem“: Lichtstrahlen und Kamera-Stöße; ruhige Maus blendet die Bedienung aus
  partyLasers: true,
  partyZoom: false,
  partyIdle: true,
  // Tempo und Tonart als Pille in Titellisten – kostet je sichtbarem Song eine Anfrage, darum aus
  libBpm: false,
  // Album-Spalte in der Cover-Ansicht (albumview.js) und Datum unter der Uhr (clockview.js): an, bis man sie ausblendet
  albumPanel: true,
  clockDate: true,
  // zuletzt benutzte Playlists im Menü „Zu Playlist hinzufügen“ (neueste zuerst, höchstens 8)
  plRecent: [],
  scheme: Object.keys(SCHEMES).find((n) => n.toLowerCase() === String(S.Config?.color_scheme || "").toLowerCase()) || "Mirage",
};
// „Bewegung reduzieren“ im System: wie bisher ruhig ab dem ersten Start – jetzt als echtes Preset „Ruhig“
if (reducedMotion) Object.assign(DEFAULTS, CALM_PRESET, { preset: "calm" });
// 1.28: „Ruhiger Modus“ war ein eigener Schalter neben dem Preset „Ruhig“. Jetzt gibt es Ruhe nur als Preset:
// wer den Schalter an hatte, behält seine übrigen Schalter und steht auf „Eigene“ mit „Ruhig“ als Grundlage
// (Bildrate wie „Ruhig“); calm ohne Preset-Grundlage gibt es danach nicht mehr. Auch für eingelesene
// Sicherungen aus älteren Versionen (settings.js: Code oder Datei laden).
function migrateCalm(c, saved) {
  if (!saved.calmPreset128 && "calm" in saved) {
    const base = c.preset === "custom" ? c.presetBase : c.preset;
    if (c.calm && base !== "calm") {
      c.calmFrom = base && base !== "custom" ? base : "balanced";
      Object.assign(c, { preset: "custom", presetBase: "calm" });
    } else if (!c.calm && base === "calm") c.calm = true;
  }
  c.calmPreset128 = true;
}
// Eingelesene Einstellungen (Code, Datei, localStorage): bekannte Schlüssel nur mit passender Art – ein Objekt
// bleibt ein Objekt, eine Liste eine Liste, ein einfacher Wert ein einfacher Wert. Sonst bricht z. B. "pinned": null
// den Einstellungsdialog bei jedem Öffnen, und das bliebe gespeichert. Unbekannte Schlüssel (Merker älterer und
// neuerer Versionen) bleiben, wie sie sind.
const kind = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "object" ? "object" : "plain");
function cleanSettings(d) {
  if (kind(d) !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(d)) {
    if (k === "__proto__" || typeof v === "function" || v === undefined) continue;
    if (k in DEFAULTS && kind(v) !== kind(DEFAULTS[k])) continue;
    out[k] = v;
  }
  if ("customSchemes" in out) out.customSchemes = cleanSchemes(out.customSchemes);
  return out;
}
let cfg = { ...DEFAULTS };
try {
  const saved = cleanSettings(JSON.parse(localStorage.getItem(KEY) || "{}")) || {};
  if ("scheme" in saved && saved.schemeCfg !== (S.Config?.color_scheme || "")) {
    delete saved.scheme;
    delete saved.dynamic;
  }
  cfg = { ...DEFAULTS, ...saved };
  // Party: Kamerafahrten, Kameraschnitte und 3D-Tiefe sind entfernt (das ständige Zoomen und Verschieben störte),
  // die Kamera-Stöße einmalig für alle aus – wer sie will, schaltet sie in den Einstellungen wieder ein
  cfg.partyCamera = cfg.partyCuts = cfg.partyDepth = false;
  if (!saved.zoomOff1155) Object.assign(cfg, { partyZoom: false, zoomOff1155: true });
  // Warteraum: 30 s waren zu kurz, einmalig für alle auf 2 Minuten
  if (!saved.join2min) Object.assign(cfg, { gameJoin: 120, join2min: true });
  // Canvas war je Ansicht (canvasIn): war es irgendwo an, bleibt es an – jetzt für alle Ansichten
  if (!("canvasShow" in saved) && saved.canvasIn) cfg.canvasShow = Object.values(saved.canvasIn).some(Boolean);
  delete cfg.canvasIn;
  migrateCalm(cfg, saved);
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
function buildScheme({ base, accent, deep, light } = {}) {
  if (![base, accent, deep, light].every(isHex)) return null;
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

export { calmNow, motionMq, SCHEMES, BUILT_IN, hexRgb, isHex, validScheme, cleanSchemes, cleanSettings, applyScheme, schemePalette, KEY, DEFAULTS, CALM_PRESET, migrateCalm, cfg, save, resetSettings, buildScheme };
