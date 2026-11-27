import { S, root, clamp, seek, fmt, loadImage } from "./core.js";
import { scriptOf, hangul, kana, pinyinLines } from "./roman.js";
import { translitLines } from "./translit.js";
import { t } from "./i18n.js";
import { cfg, save } from "./config.js";
import { palette, rgb2hsl, hsl2rgb } from "./color.js";
import { darkGround } from "./hsl.js";
import { lastHaze } from "./stage.js";
import { audio, beat } from "./audio.js";
import { dust } from "./dust.js";
import { burst } from "./burst.js";
import { getLyrics, watchLyrics, dropStaleLyrics, lyricVersions, pickLyrics, rejectLyrics, rejectedCount, translateLines, getCanvas, canvasBlocked, enableSpotifyCanvas, canvasAfterEnable, canvasFresh, SOURCE_NAME, romajiFor } from "./lyrics.js";
import { estimateSync, applySync } from "./lyricsync.js";
import { parseVoices, bgFlags, bgParts, voiceColors } from "./lyricvoices.js";
import { lineAt } from "./songtime.js";
import { takeLyrics, hasText, createLayoutGate } from "./lyrlayout.js";
import { whenIdle } from "./idlework.js";
import { LANG } from "./i18n.js";
import { nowPlayingCard, partyRecapCard, planPartySave } from "./share.js";
import * as ctl from "./controls.js";
import { currentItem, covers, titleOf, artistOf, toggleMute, PLR } from "./player.js";
import { party } from "./party.js";
import { createCueFlash } from "./flashcap.js";
import { grade as gradePal } from "./director.js";
import { jamMembers } from "./jam.js";
import { createVenue } from "./venue.js";
import { songPos } from "./clock.js";
// Liedtext-Diagnose und -Timing je Song (lyrics.js: setAutoSync, autoSyncOff, researchLyrics · clock.js: nudgeSong,
// resetSong, songOffset) – über den Namensraum, damit die Bedienung auch ohne diese Funktionen läuft (Zeilen fehlen dann)
import * as lyricsApi from "./lyrics.js";
import { focusCanvas, resetFocus } from "./canvasfocus.js";
import * as clockApi from "./clock.js";
import { instruments } from "./instruments.js";
import { live } from "./live.js";
import { createWordFx, FX as WORD_FX } from "./words.js";
import { createScenarios } from "./scenarios.js";
import { planSong, senseLine, pickLine } from "./wordsense.js";
import { LEX, NEG } from "./lexicon.js";
import { bridge } from "./bridge.js";
import { dj } from "./dj.js";
import { UI, GAME, iconEl } from "./icons.js";
import { games, GAME_LIST, WHEEL_FIELDS, WHEELS, GUEST_COLORS, TOUR_POOL } from "./games.js";
import { free } from "./lock.js";
import { setPreset, setPerf, presetFill, openSettings, ECO } from "./settings.js";
import { helpRows } from "./shortcuts.js";
import { crowdLayers } from "./stagefx.js";
import { COST, tier } from "./perf.js";
import { createSteadyClock, createBeatClock } from "./steady.js";
// 1.27 views: weitere Visualizer-Stile, Album-Reise und Uhr-Ansicht (eigene Module)
import { drawWavefield, drawCoverDust, resetVizExtra } from "./vizextra.js";
import { createAlbumView } from "./albumview.js";
import { createClockView } from "./clockview.js";
// i-playful: verspielter Liedtext-Stil (Entscheidung in lyricstyle.js, Bewegung in user.css)
import { planSteps, paintSteps, beatPhase, sungAt, leadPad, PRE_MS, notePose, noteColor } from "./lyricstyle.js";
import { meaningColors, colorRule, noteRing } from "./lyriccolor.js";
import { loadPlayfulFonts } from "./fonts.js";
import { lowpass, lowpassHue, fpsDivisor, refreshFrom } from "./fxenv.js";

// Der Immersiv-Modus ist in jedem Schema dunkel: im hellen Schema die Leitfarben für dunklen Grund
const imPalette = () => (root.classList.contains("mirage-light") ? darkGround(palette()) : palette());

/* ---------------------------------------------------------------- Immersiv-Modus */
const ICON = {
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zm3.5 7L20 5v14z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5l10.5 7L4 19z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>',
  orb: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/><path d="M8 4.2a3.8 3.8 0 0 1 3.8 3.8h-1.3A2.5 2.5 0 0 0 8 5.5z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
  translate: '<svg viewBox="0 0 24 24"><path d="M12.9 15.1 10.4 12.6l.1-.1A17.4 17.4 0 0 0 14.1 6H17V4h-7V2H8v2H1v2h11.2A15.7 15.7 0 0 1 9 11.4 15.6 15.6 0 0 1 6.7 8h-2a17.6 17.6 0 0 0 2.9 4.5l-5.1 5L4 19l5-5 3.1 3.1zM18.5 10h-2L12 22h2l1.1-3h4.8l1.1 3h2zm-2.6 7 1.6-4.3 1.6 4.3z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4V8h-2.6l-2.2 2.6-1.3-1.5L13.4 6H17zM3 6h4.6l9.8 11H17v-3l4 4-4 4v-3h-.6L6.7 8H3zm0 10h3.7l2.2-2.6 1.3 1.5L7.6 18H3z"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>',
  repeatOne: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2zm-4-2V9h-1l-2 1v1h1.5v4z"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21 10.6 19.7C5.4 15 2 12 2 8.3 2 5.3 4.3 3 7.3 3c1.7 0 3.3.8 4.7 2 1.4-1.2 3-2 4.7-2C19.7 3 22 5.3 22 8.3c0 3.7-3.4 6.7-8.6 11.4zm0-2.7c4.8-4.3 8-7.2 8-10 0-1.9-1.4-3.3-3.3-3.3-1.5 0-2.9.9-3.4 2.2h-2.6C10.2 5.9 8.8 5 7.3 5 5.4 5 4 6.4 4 8.3c0 2.8 3.2 5.7 8 10z"/></svg>',
  smart: '<svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4V8h-2.6l-2.2 2.6-1.3-1.5L13.4 6H17zM3 6h4.6l9.8 11H17v-3l4 4-4 4v-3h-.6L6.7 8H3zm0 10h3.7l2.2-2.6 1.3 1.5L7.6 18H3z"/><path d="M20 10.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/></svg>',
  queue: '<svg viewBox="0 0 24 24"><path d="M3 5h13v2H3zm0 6h13v2H3zm0 6h8v2H3zm15-3V9h2v5.3a3 3 0 1 1-2 2.7z"/></svg>',
  devices: '<svg viewBox="0 0 24 24"><path d="M4 5h12v2H6v10h4v2H4zm10 4h7v12h-7zm2 2v8h3v-8zm1.5 6.2a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><path d="M9 2h6v2H9zm3 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm-1 2h2v4.4l3 1.8-1 1.7-4-2.4z"/></svg>',
  film: '<svg viewBox="0 0 24 24"><path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v2h2V6zm12 0v2h2V6zM5 10v4h2v-4zm12 0v4h2v-4zM5 16v2h2v-2zm12 0v2h2v-2zM10 8.5v7l5.5-3.5z"/></svg>',
  wish: '<svg viewBox="0 0 24 24"><path d="M12 3v10.6a4 4 0 1 0 2 3.4V7h4V3zM4 6h6v2H4zm0 4h6v2H4zm0 4h4v2H4z"/></svg>',
  photo: '<svg viewBox="0 0 24 24"><path d="M9 4h6l1.5 2H20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3.5zm3 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>',
  confetti: '<svg viewBox="0 0 24 24"><path d="M4 20l5-14 9 9zm4.6-9.5L6.8 16.6l5.6-2.2zM14 3h2v3h-2zm5 3.6 1.4 1.4-2.1 2.1-1.4-1.4zM18 13h3v2h-3zM10.5 4.4l1.4-1 1.2 1.6-1.4 1z"/></svg>',
  dj: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5.5-7 3 3-1.4 1.4-3-3z"/></svg>',
  game: '<svg viewBox="0 0 24 24"><path d="M7 7h10a5 5 0 0 1 4.9 6l-.7 3.6a2.5 2.5 0 0 1-4.3 1.2L14.6 16H9.4l-2.3 1.8a2.5 2.5 0 0 1-4.3-1.2L2.1 13A5 5 0 0 1 7 7zm0 2a3 3 0 0 0-3 3.6l.8 3.6.5.3 2.5-2.5h7.4l2.5 2.5.5-.3.8-3.6A3 3 0 0 0 17 9zm1 1h2v2h2v2h-2v2H8v-2H6v-2h2zm8 0a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zm-2 3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/></svg>',
  poll: '<svg viewBox="0 0 24 24"><path d="M4 13h3v7H4zm6.5-9h3v16h-3zM17 9h3v11h-3z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3l4.5 4.5-1.4 1.4L13 6.8V15h-2V6.8L8.9 8.9 7.5 7.5zM5 13h2v5h10v-5h2v7H5z"/></svg>',
  heartOn: '<svg viewBox="0 0 24 24"><path d="M12 21 10.6 19.7C5.4 15 2 12 2 8.3 2 5.3 4.3 3 7.3 3c1.7 0 3.3.8 4.7 2 1.4-1.2 3-2 4.7-2C19.7 3 22 5.3 22 8.3c0 3.7-3.4 6.7-8.6 11.4z"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M5 5h5V3H3v7h2zm9-2v2h5v5h2V3zm5 16h-5v2h7v-7h-2zM5 14H3v7h7v-2H5z"/></svg>',
  fullOff: '<svg viewBox="0 0 24 24"><path d="M8 3v5H3v2h7V3zm8 0h-2v7h7V8h-5zM3 16h5v5h2v-7H3zm11 5h2v-5h5v-2h-7z"/></svg>',
  add: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm1 3v4h4v2h-4v4h-2v-4H7v-2h4V7z"/></svg>',
  recap: '<svg viewBox="0 0 24 24"><path d="M4 20V10h3v10zm6 0V4h3v16zm6 0v-7h3v7z"/></svg>',
  screen: '<svg viewBox="0 0 24 24"><path d="M2 4h14v10H2zm2 2v6h10V6zm16-2h2v14H8v-2h12zM6 16h6v2H6z"/></svg>',
  live: '<svg viewBox="0 0 24 24"><path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 3v13h10V5zm5 14.2a1 1 0 1 0 0 .01z"/></svg>',
  lyrNone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 8h10M5 12h6M5 16h9"/><path d="M4 4l16 16"/></svg>',
  lyrInstr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="M11 2l1.9 5.6L18.5 9.5l-5.6 1.9L11 17l-1.9-5.6L3.5 9.5l5.6-1.9zM18.5 14l.9 2.2 2.1.8-2.1.9-.9 2.1-.8-2.1-2.2-.9 2.2-.8z"/></svg>',
};
const MODES = [
  ["cover", "tabCover"],
  ["lyrics", "tabLyrics"],
  ["viz", "tabViz"],
  ["mix", "tabMix"],
  ["party", "tabParty"],
  // 1.27 views: ruhige Uhr für Musik im Hintergrund (Taste 6, im Umschalter als Symbol)
  ["clock", "tabClock"],
];
// Mix = Cover + Liedtext + Visualizer zugleich; Party = alles größer, im Takt, je nach Genre/Tempo
const LYR = new Set(["lyrics", "mix", "party"]);
const VIZ = new Set(["viz", "mix", "party"]);
// 1.27 views: Stile aus vizextra.js; „coverdust“ zeichnet das Cover selbst (wie „shatter“)
const EXTRA_VIZ = new Set(["wavefield", "coverdust"]);
const OWN_COVER = new Set(["shatter", "coverdust"]);

const immersive = (() => {
  let el = null, raf = 0, lastText = 0, coverToken = 0;
  let q = {};
  let lyr = null, lyrUri = "", active = -2;
  // Wortbilder: gesungene Begriffe („fire“, „Regen“, „corazón“ …) bekommen im Party-Modus ein passendes Bild
  // Ausgelöste Bilder gehen auch an den Live-Link: die TV-Ansicht zeigt dasselbe Bild
  // (nur Begriffe mit Bild gehen an die TV-Ansicht – derbe Wörter nie als Text)
  const wordFx = createWordFx(LEX, { neg: NEG, sense: { planSong, senseLine, pickLine }, onFire: (c, w, o) => (o?.img && live.fx(c, w), stageWord(c, o)) });
  // Szenarien: die Bühne antwortet auf gesungene Wörter (scenarios.js entscheidet, stagefx.js in der Location zeichnet)
  const scen = createScenarios();
  // Blitze der Bühnenbilder (Gewitter, Schüsse, Blitz) bitten zu ihrem Zeitpunkt um Freigabe aus dem Blitz-Budget
  const cueFlash = createCueFlash();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  // Fehlersuche (localStorage „mirage:debug“ = 1): eine Bühnen-Antwort von Hand auslösen, z. B. __mirageStageWord("fire")
  // … und ein Instrument oder einen Soundeffekt der Klang-Detektoren, z. B. __mirageSonic("riser"); dazu eine kleine
  // Liste, was gerade erkannt ist (nur mit diesem Schalter – keine Anzeige für alle)
  let sonicDbg = false;
  try {
    if (localStorage.getItem("mirage:debug") === "1") {
      window.__mirageStageWord = (c) => stageWord(c);
      window.__mirageSonic = (k) => instruments.force(k, (PLR.getProgress() || 0) / 1000);
      sonicDbg = true;
    }
  } catch {}
  let sonicBox = null, sonicAt = 0;
  function sonicLegend(now) {
    if (!sonicDbg || now - sonicAt < 250) return;
    sonicAt = now;
    if (!curInst) {
      if (sonicBox) sonicBox.hidden = true;
      return;
    }
    if (!sonicBox) {
      sonicBox = document.createElement("div");
      sonicBox.className = "mirage-sonic-debug";
      sonicBox.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9;font:11px/1.35 monospace;color:#fff;background:rgba(0,0,0,.55);padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre";
      el.append(sonicBox);
    }
    sonicBox.hidden = false;
    const on = Object.entries(curInst).filter(([, v]) => typeof v === "number" && v > 0.05).map(([k, v]) => `${k} ${v.toFixed(2)}`);
    const fx = (curInst.sfx || []).map((f) => `${f.k} ${f.e.toFixed(2)}`);
    const pv = instruments.debugInfo();
    const pal = pv.pv ? Object.entries(pv.pv.inst).filter(([, c]) => c > 0.3).map(([k, c]) => `${k}:${c}`).join(" ") : "–";
    const pfx = pv.pv ? Object.entries(pv.pv.fx).map(([k, c]) => `${k}:${c}`).join(" ") : "–";
    sonicBox.textContent = `Klang [${curInst.src || "–"}${pv.al ? ` · Probe @${pv.al.off}s r=${pv.al.r}` : ""}]
Instr: ${on.join(", ") || "–"}
FX: ${fx.join(", ") || "–"}
Palette: ${pal}
Probe-FX: ${pfx}`;
  }
  // o: Plan aus wordsense.js (Stärke, weitere Begriffe der Zeile, ruhige Stelle)
  function stageWord(c, o) {
    const px = wfxGeo?.px;
    if (!px || !cfg.partyWords) return;
    scen.word(c, {
      t: performance.now() / 1000, energy: px.energy, kind: px.kind, level: px.level, lite: lightMode(), calm: cfg.calm || reducedMotion.matches,
      noFlash: !!cfg.noFlash, flash: !!(cfg.partyFlash && px.fx), beat: 60 / (px.tempo || 120), phase: px.phase, col: WORD_FX[c]?.col,
      k: o?.k, also: o?.also, soft: o?.soft, valence: px.valence, arousal: px.arousal, explicit: explicitMode(),
      // Szenarien: Publikum an/aus, Spielart der Musik, Song (Spielarten der Bilder fest je Song)
      crowd: cfg.partyCrowd !== false, genre: party.info?.family || "", song: currentItem()?.uri || "",
    });
  }
  // Derbe Wörter: Einstellung „on“ / „soft“ (nur Farbe) / „off“ – hat Spotify den Filter für explizite Inhalte
  // an (Produktstatus „filter-explicit-content“), gilt „off“
  let exFilter = false, exAt = 0;
  function explicitMode() {
    if (performance.now() - exAt > 60000) {
      exAt = performance.now();
      try {
        S.Platform?.ProductStateAPI?.getValues?.()?.then?.((v) => (exFilter = v?.["filter-explicit-content"] === "1")).catch?.(() => {});
      } catch {}
    }
    return exFilter ? "off" : ["on", "soft", "off"].includes(cfg.partyExplicit) ? cfg.partyExplicit : "on";
  }
  let wfxGeo = null, wfxAt = 0;
  let vals = new Float32Array(120), targets = new Float32Array(120), lastVizT = 0, tunnel3d = [], tunnelAt = 0;
  // Bewegungs- und Schlag-Uhr ohne Sprünge: Spulen, Songwechsel und Ansichtswechsel rissen sonst Kranz und
  // Scheinwerfer im selben Bild um ganze Drehungen weiter (steady.js)
  const motion = createSteadyClock(), beatsClock = createBeatClock();
  // Melodie-Tönung: geglätteter Farbton der gespielten Tonklasse (~1 s) und wie stark sie gerade wirkt (0..1)
  const pitchSm = { h: -1, w: 0 };
  let palShown = null, palFade = null, palSm = null;
  const pit = new Float32Array(12);
  const vizRect = { n: 0, r: null };
  let rings = [], lastBeatIdx = -1, vctx = null, vw = 0, vh = 0;
  // Frist, nach der Geschlossenes oder Verlassenes freigegeben wird (Location-Thread, große Canvas, Videos);
  // verdeckt etwas länger, weil man dort oft nur kurz in ein anderes Fenster schaut
  const RELEASE_MS = 8000, HIDDEN_MS = 30000;
  /* === 1.27 views: Album-Reise (Cover-Ansicht) und Uhr-Ansicht === */
  // Ein- und Ausblenden der Album-Spalte gleitet wie ein Ansichtswechsel (FLIP), Cover und Titel rücken weich
  const album = createAlbumView({
    layout: (go, animate) => {
      if (animate && isOpen() && !stillMotion() && el.dataset.mode === "cover") morphMode(go);
      else go();
      vizRect.r = null;
    },
  });
  const clockView = createClockView();
  // Uhr steht still: keine Bildschleife (nur das Ausblenden des Visualizers bzw. der Ansichtswechsel läuft zu Ende)
  const clockStill = (now) => el?.dataset.mode === "clock" && now > vizFadeUntil && now > morphUntil + 150;
  /* === end views === */

  function build() {
    el = document.createElement("div");
    el.id = "mirage-immersive";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", t("dialog"));
    el.innerHTML = `
      <div class="m-im-bg" aria-hidden="true"><i></i><i></i><video class="m-im-canvas" muted loop playsinline preload="none"></video></div>
      <div class="m-im-flash" aria-hidden="true"></div>
      <div class="m-im-jam" hidden></div>
      <canvas class="m-im-venue" aria-hidden="true"></canvas>
      <canvas class="m-im-viz"></canvas>
      <div class="m-im-drag" aria-hidden="true"></div>
      <div class="m-im-top">
        <button class="m-im-close" type="button">${ICON.back}<span class="m-l"></span><kbd>ESC</kbd></button>
        <div class="m-im-tabs" role="tablist"><span class="m-im-ind"></span>
          ${MODES.map(([k], i) => `<button type="button" role="tab" data-mode="${k}" title="${i + 1}"></button>`).join("")}
        </div>
        <div class="m-im-actions">
          <button type="button" class="m-im-sm m-im-cvbtn" hidden aria-pressed="false">${ICON.film}</button>
          <button type="button" class="m-im-sm m-im-conf" hidden>${ICON.confetti}</button>
          <button type="button" class="m-im-sm m-im-pollbtn" data-menu="poll" hidden>${ICON.poll}</button>
          <button type="button" class="m-im-sm m-im-djbtn" data-menu="dj" hidden>${ICON.dj}</button>
          <button type="button" class="m-im-sm m-im-gamebtn" data-menu="games" hidden>${ICON.game}</button>
          <button type="button" class="m-im-sm m-im-recap" data-menu="recap" hidden>${ICON.recap}</button>
          <button type="button" class="m-im-sm m-im-screen" data-menu="screens" hidden>${ICON.screen}</button>
          <button type="button" class="m-im-sm m-im-wishbtn" data-menu="wishes" hidden>${ICON.wish}</button>
          <button type="button" class="m-im-sm m-im-photobtn" data-menu="photos" hidden>${ICON.photo}</button>
          <button type="button" class="m-im-sm m-im-live" data-menu="live" hidden>${ICON.live}</button>
          <button type="button" class="m-im-sm m-im-menubtn" data-menu="menu" hidden>${ICON.more}</button>
          <button type="button" class="m-im-sm m-im-fs">${ICON.full}</button>
          <button type="button" class="m-im-sm m-im-help" data-menu="keys">${UI.keyboard}</button>
        </div>
      </div>
      <div class="m-im-cover-wrap"><div class="m-im-cover"><img alt=""><img alt=""><video class="m-im-cvid" muted loop playsinline preload="none" aria-hidden="true"></video></div></div>
      <div class="m-im-meta">
        <div class="m-im-kicker"></div>
        <div class="m-im-smartpick" hidden>${ICON.sparkle}<span></span></div>
        <div class="m-im-titlerow">
          <div class="m-im-title"></div>
          <div class="m-im-lyrstate" hidden><button type="button" class="m-im-lyrstate-btn"></button><div class="m-im-lyrstate-pop" role="tooltip"></div></div>
        </div>
        <div class="m-im-artist"></div>
        <div class="m-im-bar" role="slider" tabindex="0"><div class="m-im-fill"></div></div>
        <div class="m-im-time"><span class="m-im-pos">0:00</span><span class="m-im-dur">0:00</span></div>
        <div class="m-im-controls">
          <button type="button" class="m-im-sm m-im-b15" hidden>${UI.back15}</button>
          <button type="button" class="m-im-sm m-im-shuffle">${ICON.shuffle}</button>
          <button type="button" class="m-im-prev">${ICON.prev}</button>
          <button type="button" class="m-im-play">${ICON.play}</button>
          <button type="button" class="m-im-next">${ICON.next}</button>
          <button type="button" class="m-im-sm m-im-repeat">${ICON.repeat}</button>
          <button type="button" class="m-im-sm m-im-f15" hidden>${UI.fwd15}</button>
        </div>
        <div class="m-im-extras">
          <button type="button" class="m-im-sm m-im-like">${ICON.heart}</button>
          <button type="button" class="m-im-sm m-im-songbtn" data-menu="song">${ICON.more}</button>
          <div class="m-im-vol">
            <button type="button" class="m-im-sm m-im-mute">${ICON.vol}</button>
            <input type="range" class="m-im-volume" min="0" max="100" step="1">
          </div>
          <button type="button" class="m-im-sm m-im-queue-btn" data-menu="queue">${ICON.queue}</button>
          <button type="button" class="m-im-sm m-im-dev" data-menu="devices">${ICON.devices}</button>
          <button type="button" class="m-im-sm m-im-timer" data-menu="timer">${ICON.timer}</button>
        </div>
      </div>
      <div class="m-im-lyrics"><div class="m-im-lyrics-inner"></div></div>
      <div class="m-im-lyrbar">
        <button type="button" class="m-im-trbtn" hidden aria-pressed="false">${ICON.translate}<span></span><i aria-hidden="true"></i></button>
        <button type="button" class="m-im-lyrsrc" data-menu="versions" hidden><span></span><b></b></button>
        <span class="m-im-nudge" role="group" hidden><button type="button" class="m-im-nudge-early"></button><button type="button" class="m-im-nudge-val"></button><button type="button" class="m-im-nudge-late"></button></span>
      </div>
      <div class="m-im-side m-im-pop" hidden><div class="m-im-side-head"><button type="button" class="m-im-side-back" hidden>${UI.back}</button><b></b><button type="button" class="m-im-sm m-im-side-x">${UI.close}</button></div><div class="m-im-side-body"></div></div>
      <div class="m-im-keys" role="dialog" hidden></div>`;
    document.body.append(el);
    el.querySelector(".m-im-close .m-l").textContent = t("back");
    el.querySelectorAll(".m-im-tabs button").forEach((b, i) => (b.textContent = t(MODES[i][1])));
    /* === 1.27 views: Uhr-Reiter als Symbol, Album-Spalte und Uhr-Ebene === */
    const ckTab = el.querySelector('.m-im-tabs button[data-mode="clock"]');
    ckTab.innerHTML = `${UI.clock}<span class="m-sr"></span>`;
    ckTab.lastChild.textContent = t("tabClock");
    ckTab.title = `${t("tabClock")} · ${MODES.length}`;
    album.attach(el);
    el.querySelector(".m-im-meta").after(album.panel);
    clockView.attach(el);
    el.querySelector(".m-im-cover-wrap").before(clockView.el);
    /* === end views === */
    el.querySelector(".m-im-bar").setAttribute("aria-label", t("seek"));
    el.querySelector(".m-im-prev").setAttribute("aria-label", t("prev"));
    el.querySelector(".m-im-play").setAttribute("aria-label", t("play"));
    el.querySelector(".m-im-next").setAttribute("aria-label", t("next"));
    for (const k of ["shuffle", "repeat", "like", "mute"]) {
      el.querySelector(".m-im-" + k).setAttribute("aria-label", t("c_" + k));
      el.querySelector(".m-im-" + k).title = t("c_" + k);
    }
    el.querySelector(".m-im-volume").setAttribute("aria-label", t("c_volume"));
    a11y();
    // Verschiebe-Streifen und Kopfzeile ans Ende der Ebene: Electron wertet die Fenster-Regionen in
    // Dokument-Reihenfolge und ohne overflow-Beschnitt aus – sonst löschten schon gesungene, unsichtbar nach
    // oben gerollte Liedzeilen den Streifen, und im Party- und Mix-Modus ließ sich das Fenster nicht verschieben
    el.append(el.querySelector(".m-im-drag"), el.querySelector(".m-im-top"));
    q = {
      cover: el.querySelector(".m-im-cover"),
      imgs: el.querySelectorAll(".m-im-cover img"),
      wrap: el.querySelector(".m-im-cover-wrap"),
      kicker: el.querySelector(".m-im-kicker"),
      title: el.querySelector(".m-im-title"),
      lyrstate: el.querySelector(".m-im-lyrstate"),
      artist: el.querySelector(".m-im-artist"),
      fill: el.querySelector(".m-im-fill"),
      pos: el.querySelector(".m-im-pos"),
      dur: el.querySelector(".m-im-dur"),
      play: el.querySelector(".m-im-play"),
      lyrics: el.querySelector(".m-im-lyrics"),
      inner: el.querySelector(".m-im-lyrics-inner"),
      lyrsrc: el.querySelector(".m-im-lyrsrc"),
      nudge: el.querySelector(".m-im-nudge"),
      trbtn: el.querySelector(".m-im-trbtn"),
      ind: el.querySelector(".m-im-ind"),
      canvas: el.querySelector(".m-im-viz"),
      venueEl: el.querySelector(".m-im-venue"),
      flash: el.querySelector(".m-im-flash"),
      jam: el.querySelector(".m-im-jam"),
      bg: el.querySelector(".m-im-bg"),
      shuffle: el.querySelector(".m-im-shuffle"),
      repeat: el.querySelector(".m-im-repeat"),
      like: el.querySelector(".m-im-like"),
      mute: el.querySelector(".m-im-mute"),
      volume: el.querySelector(".m-im-volume"),
      smart: el.querySelector(".m-im-smartpick"),
      controls: el.querySelector(".m-im-controls"),
      meta: el.querySelector(".m-im-meta"),
      recap: el.querySelector(".m-im-recap"),
      conf: el.querySelector(".m-im-conf"),
      pollbtn: el.querySelector(".m-im-pollbtn"),
      djbtn: el.querySelector(".m-im-djbtn"),
      gamebtn: el.querySelector(".m-im-gamebtn"),
      screen: el.querySelector(".m-im-screen"),
      live: el.querySelector(".m-im-live"),
      fs: el.querySelector(".m-im-fs"),
    };
    vctx = q.canvas.getContext("2d");
    q.smart.querySelector("span").textContent = t("smartPick");
    q.smart.title = t("smartPickHint");
    // Party-Rückblick und zweiter Bildschirm (Party im Vollbild auf einem anderen Monitor/Fernseher)
    q.recap.title = q.recap.ariaLabel = t("recapBtn");
    q.recap.onclick = () => showSide(side === "recap" ? null : "recap");
    q.conf.title = q.conf.ariaLabel = t("confetti");
    q.conf.onclick = () => confetti();
    q.pollbtn.title = q.pollbtn.ariaLabel = t("pollBtn");
    q.pollbtn.onclick = () => showSide(side === "poll" ? null : "poll");
    q.djbtn.title = q.djbtn.ariaLabel = t("djTitle");
    q.djbtn.onclick = () => showSide(side === "dj" ? null : "dj");
    q.gamebtn.title = q.gamebtn.ariaLabel = t("gTitle");
    q.gamebtn.onclick = () => showSide(side === "games" ? null : "games");
    q.menubtn = el.querySelector(".m-im-menubtn");
    q.menubtn.title = q.menubtn.ariaLabel = t("pmTitle");
    q.menubtn.onclick = () => showSide(side === "menu" ? null : "menu");
    games.init({
      root: () => el,
      lines: () => (lyr?.synced ? lyr.lines : null),
      pos: () => songPos(performance.now()),
      confetti,
      handsUp: () => (moments.handsUntil = performance.now() + (8 * 60000) / (party.info.bpm || 120)),
      flashStorm: () => (moments.stormUntil = performance.now() + 2600),
      bpm: () => party.info.bpm,
      venue: () => (moments.venue = ["club", "festival", "beach", "stadium", "rooftop", "forest", "neon", "space", "desert"][Math.floor(Math.random() * 9)]),
      changed: () => {
        if (side === "games") showSide("games");
        liveAfterGame();
      },
      party: () => el?.dataset.mode === "party",
    });
    q.screen.title = q.screen.ariaLabel = t("toScreen");
    q.screen.onclick = () => showSide(side === "screens" ? null : "screens");
    q.live.title = q.live.ariaLabel = t("liveBtn");
    q.live.onclick = toggleLiveCard;
    window.addEventListener("mirage:live", showExtras);
    q.fs.onclick = toggleFull;
    q.fs.hidden = !canFull();
    document.addEventListener("fullscreenchange", syncFull);
    /* === 1.27 actions: Song-Menü (Drei Punkte, Rechtsklick, Taste M) und ±15 s für Podcasts === */
    q.songbtn = el.querySelector(".m-im-songbtn");
    q.songbtn.title = q.songbtn.ariaLabel = t("smOpen");
    q.songbtn.setAttribute("aria-keyshortcuts", "M");
    q.songbtn.onclick = () => showSide(side === "song" ? null : "song");
    q.b15 = el.querySelector(".m-im-b15");
    q.f15 = el.querySelector(".m-im-f15");
    q.b15.title = q.b15.ariaLabel = t("c_back15");
    q.f15.title = q.f15.ariaLabel = t("c_fwd15");
    q.b15.onclick = () => free() && seekBy(-15000);
    q.f15.onclick = () => free() && seekBy(15000);
    // Rechtsklick irgendwo auf der Ebene (Cover, Titel, Liedtext, Bühne) öffnet das Song-Menü; nicht in Menüs,
    // Eingabefeldern und Spielen, die ihre eigenen Ziele haben
    el.addEventListener("contextmenu", (e) => {
      if (e.target.closest?.("input, textarea, [contenteditable], .m-im-pop, .m-im-keys, .m-im-game, .m-im-livecard")) return;
      e.preventDefault();
      showSide("song");
    });
    /* === end actions === */
    // Party: ruht die Maus, blendet die Bedienung aus und alles rückt weich zusammen
    for (const ev of ["pointermove", "pointerdown", "wheel"]) el.addEventListener(ev, wake, { passive: true });
    // Cover fertig verschoben: Visualizer neu ausmessen
    // (nicht nach Puls/Pendeln: die gleiten bei 30 Bildern/s je Bild kurz nach – das verschiebt nichts)
    q.wrap.addEventListener("transitionend", (e) => e.target === q.wrap && !/^(scale|rotate)$/.test(e.propertyName) && (vizRect.r = null));
    q.lyrsrc.querySelector("b").textContent = t("lyrPick");
    q.lyrsrc.onclick = () => showSide(side === "versions" ? null : "versions");
    // „Nicht der richtige Liedtext“ steht nur noch in „Fassung wählen“ (ein Ort je Aktion)
    q.trbtn.querySelector("span").textContent = t("trToggle");
    q.trbtn.onclick = toggleTranslate;
    // Liedtext früher / später (je Song, ±0,25 s) – Mitte zeigt den Versatz und setzt ihn zurück
    q.nudge.setAttribute("aria-label", t("syRow"));
    const nb = (cls, text, hint, fn) => {
      const b = q.nudge.querySelector(cls);
      b.textContent = text;
      b.title = b.ariaLabel = hint;
      b.onclick = fn;
    };
    nb(".m-im-nudge-early", "−", t("syEarlierHint"), () => nudge(250));
    nb(".m-im-nudge-late", "+", t("syLaterHint"), () => nudge(-250));
    nb(".m-im-nudge-val", "", t("syReset"), () => nudge(0));
    q.video = el.querySelector(".m-im-canvas");
    q.cvid = el.querySelector(".m-im-cvid");
    q.wishbtn = el.querySelector(".m-im-wishbtn");
    q.wishbtn.onclick = () => showSide(side === "wishes" ? null : "wishes");
    q.photobtn = el.querySelector(".m-im-photobtn");
    q.photobtn.onclick = () => showSide(side === "photos" ? null : "photos");
    q.cvbtn = el.querySelector(".m-im-cvbtn");
    q.cvbtn.onclick = toggleCanvas;
    q.keys = el.querySelector(".m-im-keys");
    // Teilen als Bild liegt im Song-Menü (und in den Einstellungen) – oben nur noch die Tastenhilfe
    const help = el.querySelector(".m-im-help");
    help.title = help.ariaLabel = t("keysTitle");
    help.onclick = () => toggleKeys();
    // nur der abgedunkelte Rand schließt, ein Klick in die Übersicht selbst nicht
    q.keys.onclick = (e) => !e.target.closest(".m-im-keys-box") && toggleKeys(false);
    el.querySelector(".m-im-close").onclick = close;
    q.shuffle.onclick = async () => { if (!free()) return; await ctl.cycleShuffle(); setTimeout(syncState, 150); };
    // Titel → Album, Künstler → Künstlerseite (Immersiv-Fenster schließt dafür)
    q.title.onclick = () => ctl.go(ctl.albumOf(currentItem())) && close();
    q.artist.onclick = () => ctl.go(ctl.artistUriOf(currentItem())) && close();
    q.side = el.querySelector(".m-im-side");
    q.sideBody = el.querySelector(".m-im-side-body");
    el.querySelector(".m-im-side-x").onclick = () => showSide(null);
    // Unterseiten (aus „Mehr“, dem Song-Menü …) liegen auf einem Stapel: der Pfeil geht eine Seite zurück
    q.sideBack = el.querySelector(".m-im-side-back");
    q.sideBack.onclick = sideBack;
    // Pfeil hoch/runter wandert durch die Zeilen des Menüs (wie in einem Menü üblich), Pos1/Ende springen ans Ende;
    // in Eingabefeldern und Stufenwahlen bleiben die Pfeile beim Feld
    q.side.addEventListener("keydown", (e) => {
      const to = { ArrowDown: 1, ArrowUp: -1, Home: -2, End: 2 }[e.key];
      if (!to || e.ctrlKey || e.altKey || e.metaKey || e.target.closest("input, textarea, .m-g-seg-row")) return;
      const list = [...q.side.querySelectorAll(".m-im-side-item:not(:disabled), .m-im-side-head button:not([hidden])")].filter((x) => !x.hidden && x.getClientRects().length);
      if (!list.length) return;
      e.preventDefault();
      e.stopPropagation();
      const i = list.indexOf(document.activeElement);
      const n = to === -2 ? 0 : to === 2 ? list.length - 1 : i < 0 ? (to > 0 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, i + to));
      list[n].focus();
    });
    // Klick oder Tippen außerhalb schließt das offene Menü. pointerdown statt click: ein Regler, den man aus dem
    // Menü hinauszieht, endet draußen, hat aber drinnen begonnen und schließt deshalb nichts.
    // Auslöser (data-menu) schalten selbst um; Fenster über der Ebene (Einstellungen) zählen nicht als „außen“.
    el.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || !openMenu()) return;
      const x = e.target;
      if (x.closest?.(".m-im-pop, .m-im-keys-box, [data-menu]")) return;
      closeMenus();
    }, true);
    const qb = el.querySelector(".m-im-queue-btn"), db = el.querySelector(".m-im-dev"), tb = el.querySelector(".m-im-timer");
    q.timerBtn = tb;
    for (const [b, k] of [[qb, "c_queue"], [db, "c_devices"], [tb, "c_timer"]]) b.title = b.ariaLabel = t(k);
    qb.onclick = () => showSide(side === "queue" ? null : "queue");
    db.onclick = () => showSide(side === "devices" ? null : "devices");
    tb.onclick = () => showSide(side === "timer" ? null : "timer");
    if (!ctl.canConnect()) db.hidden = true;
    q.repeat.onclick = () => { if (!free()) return; S.Player.toggleRepeat(); setTimeout(syncState, 120); };
    q.like.onclick = (e) => {
      const was = !!S.Player.getHeart?.();
      S.Player.toggleHeart();
      if (!was && cfg.burst && !cfg.calm) {
        const r = q.like.getBoundingClientRect();
        burst(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
      }
      setTimeout(syncState, 200);
    };
    q.mute.onclick = () => { toggleMute(); setTimeout(syncState, 120); };
    q.volume.oninput = () => S.Player.setVolume(Number(q.volume.value) / 100);
    el.querySelector(".m-im-prev").onclick = () => free() && PLR.back();
    el.querySelector(".m-im-next").onclick = () => free() && PLR.next();
    q.play.onclick = () => free() && PLR.togglePlay();
    el.querySelectorAll(".m-im-tabs button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode, true)));
    el.querySelector(".m-im-bar").onclick = (e) => {
      if (!free()) return;
      const r = e.currentTarget.getBoundingClientRect();
      PLR.seek(clamp((e.clientX - r.left) / r.width, 0, 1) * (PLR.getDuration() || 0));
    };
    // am Liedtext-Bereich (die Textfläche wird bei jedem neuen Text ausgetauscht, siehe ghostLyrics)
    q.lyrics.addEventListener("click", (e) => {
      const line = e.target.closest(".m-im-lyrics-inner:not(.m-im-lyrics-ghost) .m-im-line");
      if (line && lyr?.synced && free()) PLR.seek(Math.max(Number(line.dataset.t), 2));
    });
    el.addEventListener("pointermove", (e) => {
      if (cfg.calm) return;
      const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
      depth.tx = x;
      depth.ty = y;
      depth.at = performance.now();
      // Neigung und Glanz folgen per Feder in der Bildschleife (coverMotion) – hier nur das Ziel
      kick();
    });
    addEventListener("resize", () => {
      // geschlossen nichts neu anlegen (freigegebenes Canvas bliebe sonst groß); open() misst ohnehin neu
      if (!isOpen()) return;
      sizeCanvas();
      kick();
    });
    document.addEventListener("keydown", () => isOpen() && wake(), true);
    // Taktdaten kamen später (Wiederholung oder Schätzung): Anzeige und Party-Profil nachziehen
    document.addEventListener("mirage:audio", () => {
      if (!isOpen()) return;
      kick();
      lastBeatIdx = -1;
      if (el.dataset.mode === "party") party.prepare(currentItem()).then(updateKicker);
      else updateKicker();
      if (cfg.lyrPlayful && lyr?.synced) playfulSoon(lyrToken);
    });
  }

  /* ---- Tastatur und Vorlesen: nur Attribute und Tastengriffe, das Markup bleibt wie es ist */
  const STOPS = "button, a[href], input, select, textarea, [tabindex]";
  let lastFocus = null, keysFrom = null, sideFrom = null, said = "";
  function a11y() {
    el.setAttribute("aria-modal", "true");
    const tabs = el.querySelector(".m-im-tabs");
    tabs.setAttribute("aria-label", t("a11yViews"));
    tabs.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-keyshortcuts", String(i + 1)));
    // Reiter: Pfeiltasten wechseln die Ansicht (keys.js spult hier nicht), nur der aktive liegt in der Tab-Reihenfolge
    tabs.addEventListener("keydown", (e) => {
      const list = [...tabs.querySelectorAll("button")], i = list.indexOf(e.target);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 }[e.key];
      if (i < 0 || to == null || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();
      const b = list[(to + list.length) % list.length];
      setMode(b.dataset.mode, true);
      b.tabIndex = 0;
      b.focus();
    });
    for (const [sel, key] of [[".m-im-side-x", "k_close"], [".m-im-fs", "c_full"]]) {
      const b = el.querySelector(sel);
      b.title = t(key);
      b.setAttribute("aria-label", t(key));
    }
    el.querySelector(".m-im-bar").setAttribute("aria-valuemin", "0");
    // Titel und Künstler sind anklickbar (Album, Künstlerseite): auch per Tab und Enter
    for (const x of [el.querySelector(".m-im-title"), el.querySelector(".m-im-artist")]) {
      x.setAttribute("role", "link");
      x.tabIndex = 0;
      x.addEventListener("keydown", (e) => e.key === "Enter" && x.click());
    }
    const sideEl = el.querySelector(".m-im-side"), keysEl = el.querySelector(".m-im-keys");
    sideEl.setAttribute("role", "region");
    sideEl.querySelector("b").id = "m-im-side-title";
    sideEl.setAttribute("aria-labelledby", "m-im-side-title");
    sideEl.tabIndex = keysEl.tabIndex = -1;
    keysEl.setAttribute("aria-label", t("keysTitle"));
    // Songwechsel leise ansagen – die einzige Stelle, an der die Ebene von sich aus spricht
    const say = document.createElement("span");
    say.className = "m-sr m-im-say";
    say.setAttribute("role", "status");
    el.append(say);
    // Tab bleibt in der Ebene (sie verdeckt Spotify ganz) und läuft in sichtbarer Reihenfolge: die Kopfzeile
    // steht wegen der Fenster-Verschieberegionen am Ende des Dokuments, gehört aber an den Anfang
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Tab" || !isOpen() || e.ctrlKey || e.altKey || e.metaKey) return;
      const cur = document.activeElement;
      // ein Fenster über der Ebene (Einstellungen, Einführung) behält seine eigene Reihenfolge
      if (cur && !el.contains(cur) && cur.closest?.('[role="dialog"], .GenericModal')) return;
      // der Fokus kann auf einer Fläche ohne eigenen Tab-Halt liegen (gerade geöffnete Seitenleiste): von dort geht es weiter
      const all = [...el.querySelectorAll(STOPS)].filter((x) => x === cur || (!x.disabled && x.tabIndex >= 0 && (x.checkVisibility ? x.checkVisibility({ visibilityProperty: true }) : x.getClientRects().length > 0)));
      const top = all.filter((x) => x.closest(".m-im-top"));
      const list = [...top, ...all.filter((x) => !top.includes(x))];
      if (!list.length) return;
      e.preventDefault();
      const i = list.indexOf(cur);
      list[i < 0 ? (e.shiftKey ? list.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
    });
  }
  function announce(item) {
    const text = titleOf(item) ? t("a11yNow").replace("{t}", titleOf(item)).replace("{a}", artistOf(item)) : "";
    if (text !== said) el.querySelector(".m-im-say").textContent = said = text;
  }
  const playLabel = () => q.play.setAttribute("aria-label", t(PLR.isPlaying() ? "pause" : "play"));
  let seekText = "";
  function seekLabel(pos, dur) {
    const text = fmt(pos) + " / " + fmt(dur);
    if (text === seekText) return;
    seekText = text;
    const bar = el.querySelector(".m-im-bar");
    bar.setAttribute("aria-valuemax", String(Math.round(dur / 1000)));
    bar.setAttribute("aria-valuenow", String(Math.round(pos / 1000)));
    bar.setAttribute("aria-valuetext", text);
  }
  // Seitenleiste: beim Öffnen wandert der Fokus hinein, beim Schließen zurück zum Auslöser; baut sie sich neu
  // auf (Timer gewählt, Spiel-Einstellung geändert), bleibt er an derselben Stelle statt verloren zu gehen
  function sideFocus(kind) {
    const cur = document.activeElement, inside = q.side.contains(cur);
    if (!kind) return void (inside && sideFrom?.isConnected && sideFrom.focus());
    // Neuaufbau im Hintergrund (Warteschlange nach Songwechsel): Fokus bleibt, wo er ist
    if (kind === side && !inside) return;
    if (kind !== side && !inside) sideFrom = cur;
    const stops = () => [...q.side.querySelectorAll(STOPS)].filter((x) => x.tabIndex >= 0);
    const idx = kind === side ? stops().indexOf(cur) : -1;
    queueMicrotask(() => {
      if (side !== kind || (q.side.contains(document.activeElement) && document.activeElement !== q.side)) return;
      const s = stops()[idx];
      (s && !s.disabled ? s : q.side).focus();
    });
  }
  // Esc schließt zuerst, was obenauf liegt (Tastenhilfe, Seitenleiste) – erst dann den Immersiv-Modus
  const dismiss = () => (openMenu() ? (closeMenus(), true) : false);

  // Erst das kleine (meist schon geladene) Cover zeigen, dann scharf überblenden
  async function setCover(item) {
    const token = ++coverToken;
    const c = covers(item);
    const show = (img) => {
      if (!img || token !== coverToken) return;
      const [a, b] = q.imgs;
      const front = a.classList.contains("is-on") ? a : b;
      const back = front === a ? b : a;
      if (front.src === img.src) return;
      back.src = img.src;
      back.classList.add("is-on");
      front.classList.remove("is-on");
    };
    // beide gleichzeitig anfordern: ist das große schon da (vorgeladen), kommt es ohne Umweg
    const big = c.big && c.big !== c.small ? loadImage(c.big) : null;
    let sharp = false;
    big?.then((img) => {
      sharp = !!img;
      show(img);
    });
    if (c.small) {
      const img = await loadImage(c.small);
      if (!sharp) show(img);
    }
  }

  // Symbol/Text eines Knopfs nur bei einer Änderung neu setzen: syncState läuft alle 250 ms, und jedes innerHTML
  // tauschte das SVG aus (Stil + Layout der Knöpfe, mehrmals je Sekunde in jeder Ansicht – tools/theme-perf.js)
  const setIcon = (b, key, html) => {
    if (!b || b.dataset.icon === key) return;
    b.dataset.icon = key;
    b.innerHTML = html;
  };
  const setAttr = (b, name, v) => b && b.getAttribute(name) !== v && b.setAttribute(name, v);
  // Schalterzustände aus Spotify lesen (Zufall, Wiederholen, Like, Lautstärke)
  function syncState() {
    if (!el) return;
    const P = S.Player;
    const sh = ctl.shuffleState();
    q.shuffle.classList.toggle("is-on", sh > 0);
    q.shuffle.classList.toggle("is-smart", sh === 2);
    const shIcon = sh === 2 ? ICON.smart : ICON.shuffle;
    if (q.shuffle.dataset.icon !== String(sh)) {
      q.shuffle.innerHTML = shIcon;
      q.shuffle.dataset.icon = String(sh);
      q.shuffle.title = q.shuffle.ariaLabel = t(sh === 2 ? "c_smart" : "c_shuffle");
    }
    q.timerBtn?.classList.toggle("is-on", !!ctl.sleepState());
    // Zustand auch für Screenreader und für das CSS (aria-pressed)
    const rep = P.getRepeat?.() || 0;
    q.repeat.classList.toggle("is-on", rep > 0);
    setIcon(q.repeat, "r" + rep, rep === 2 ? ICON.repeatOne : ICON.repeat);
    const liked = !!P.getHeart?.();
    q.like.classList.toggle("is-on", liked);
    setIcon(q.like, liked ? "on" : "off", liked ? ICON.heartOn : ICON.heart);
    for (const b of [q.shuffle, q.repeat, q.like, q.timerBtn]) setAttr(b, "aria-pressed", String(!!b?.classList.contains("is-on")));
    const muted = !!P.getMute?.();
    if (q.mute.dataset.icon !== (muted ? "m" : "v")) {
      setIcon(q.mute, muted ? "m" : "v", muted ? ICON.mute : ICON.vol);
      q.mute.title = q.mute.ariaLabel = t(muted ? "c_unmute" : "c_mute");
    }
    if (document.activeElement !== q.volume) {
      const v = String(Math.round((muted ? 0 : P.getVolume?.() ?? 1) * 100));
      if (q.volume.value !== v) q.volume.value = v;
    }
    const vv = q.volume.value + "%";
    if (q.volume.style.getPropertyValue("--v") !== vv) q.volume.style.setProperty("--v", vv);
    syncFull();
  }
  // Vollbild wie Spotify selbst: das Immersiv-Fenster SELBST wird Vollbild – ohne Spotifys Kopfleiste darüber
  const canFull = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  async function toggleFull() {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else el.webkitRequestFullscreen?.();
    } catch {
      // manche Umgebungen lassen nur das ganze Dokument zu
      try {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      } catch {}
    }
    setTimeout(syncState, 300);
  }
  function syncFull() {
    if (!el) return;
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    for (const b of [q.fs]) {
      if (b.dataset.icon === (on ? "off" : "on")) continue;
      setIcon(b, on ? "off" : "on", on ? ICON.fullOff : ICON.full);
      b.title = b.ariaLabel = t(on ? "fullOff" : "c_full");
    }
    if (el.classList.contains("is-full") !== on) el.classList.toggle("is-full", on);
  }
  // Ruhender Hintergrund aus dem Cover – ersetzt das teure Live-Verwischen der ganzen Seite
  let hazeSrc = "";
  // Weichzeichnen, Sättigung und Abdunkeln einmal pro Song in ein kleines Bild backen: vorher rechnete
  // filter: blur(18px) … auf einer Fläche von 1,5 × Fenster in jedem Bild (Party verschiebt die Ebene).
  // Kodiert wird asynchron (toBlob) – toDataURL hielt beim Songwechsel den Hauptthread ~25 ms an. Die letzten
  // Ergebnisse bleiben gemerkt; song.js backt den nächsten Song schon vorab (prebake).
  const baked = new Map();
  function bake(src) {
    if (baked.has(src)) return baked.get(src);
    const job = new Promise((done) => {
      if (!src.startsWith("data:")) return done(null);
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = c.height = 256;
          // 1.27 perf: Software-Leinwand – das Bild wird gleich per toBlob ausgelesen; auf der Grafikkarte kostete
          // das beim kalten Start ~36 ms synchron (Kontext + Zurücklesen), auf der CPU ~1 ms
          const x = c.getContext("2d", { willReadFrequently: true });
          x.filter = "blur(3px) saturate(1.4) brightness(0.5)";
          x.drawImage(img, -14, -14, 284, 284);
          c.toBlob((b) => done(b ? URL.createObjectURL(b) : null), "image/jpeg", 0.92);
        } catch {
          done(null);
        }
      };
      img.onerror = () => done(null);
      img.src = src;
    });
    baked.set(src, job);
    // höchstens 4 merken (aktueller, vorheriger, nächster …); alte Bild-URLs freigeben
    while (baked.size > 4) {
      const [k, old] = baked.entries().next().value;
      baked.delete(k);
      old.then((u) => u && setTimeout(() => URL.revokeObjectURL(u), 5000));
    }
    return job;
  }
  function setHaze(src) {
    if (!el || !src || src === hazeSrc) return;
    hazeSrc = src;
    // neues Bild in die verdeckte Ebene, erst wenn es geladen ist überblenden
    const [a, b] = q.bg.querySelectorAll("i");
    const front = a.classList.contains("is-on") ? a : b.classList.contains("is-on") ? b : null;
    const back = front === a ? b : a;
    bake(src).then((url) => {
      if (hazeSrc !== src) return;
      back.classList.toggle("is-baked", !!url);
      back.style.backgroundImage = `url("${url || src}")`;
      // erst überblenden, wenn das Bild dekodiert ist – sonst blendet eine leere Ebene ein und das Bild ploppt nach
      const ready = new Image();
      ready.src = url || src;
      (ready.decode ? ready.decode() : Promise.resolve()).catch(() => {}).then(() => {
        if (hazeSrc !== src) return;
        requestAnimationFrame(() => {
          back.classList.add("is-on");
          front?.classList.remove("is-on");
        });
      });
    });
  }

  // Leicht-Preset oder Energiesparen fest an: weniger Pixel, 30 Bilder/s, weniger Details.
  // tier(): bei „Eigene“ der Rahmen des zuletzt gewählten Presets – ein Schalter macht es nie teurer
  const lightMode = () => !!cfg.lite || tier() === "light" || cfg.eco === "on";
  // Visualizer verlassen (zu Cover oder Liedtext): er zeichnet weiter, bis er ausgeblendet ist (CSS 0,5 s) –
  // sonst verschwand er schlagartig bzw. blendete als eingefrorenes Bild aus
  let vizFadeUntil = 0;
  const vizLive = () => VIZ.has(el?.dataset.mode) || performance.now() < vizFadeUntil;
  const sizeKeyNow = () => `${tier()}|${cfg.lite}|${cfg.eco}|${vizLive()}|${el?.dataset.mode === "party"}`;
  let sizeKey = "";
  function sizeCanvas() {
    if (!q.canvas) return;
    // Cover und Liedtext zeichnen nichts auf das Canvas: dort keine Pixel vorhalten (vw/vh bleiben für die Geometrie)
    if (!vizLive()) {
      sizeKey = sizeKeyNow();
      if (q.canvas.width) q.canvas.width = q.canvas.height = 0;
      return;
    }
    // höchstens ~3 Mio. Pixel: auf großen/hochauflösenden Bildschirmen wäre die volle Dichte ein
    // Vielfaches davon – jedes Bild neu zeichnen ruckelt dann. Die leuchtenden Linien bleiben trotzdem scharf genug.
    // je leichter das Preset, desto weniger Pixel: Leicht/Energiesparen ~1,2 Mio., Ausgewogen ~2 Mio.
    // „Ruhig“ wie Ausgewogen (scharf genug für langsame Bewegung)
    const [px0, cap] = lightMode() ? [1.2e6, 1] : tier() === "full" ? [3e6, 1.5] : [2e6, 1.25];
    // 1.33 Party: zwei solche Flächen (Ring/Visualizer hier, Bühne und Publikum im Thread – gleiche Größe) plus
    // Canvas-Video füllten die Grafikkarte zu ~75 %. Lichtkegel, Dunst und Leuchtpunkte sind weich – 65 % der Pixel
    // sieht man nicht, die GPU-Last sinkt spürbar (gemessen, siehe CHANGELOG 1.33)
    const pixels = el?.dataset.mode === "party" ? px0 * 0.65 : px0;
    const budget = Math.sqrt(pixels / Math.max(1, innerWidth * innerHeight));
    const dpr = Math.max(0.5, Math.min(devicePixelRatio || 1, cap, budget));
    sizeKey = sizeKeyNow();
    // gleiche Größe nicht neu setzen: das leert die Fläche und legt sie neu an (ein leeres Bild, Ruckler beim Ansichtswechsel)
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (q.canvas.width !== w) q.canvas.width = w;
    if (q.canvas.height !== h) q.canvas.height = h;
    vw = w;
    vh = h;
  }

  // Ruhemodus (Party): nach 2,6 s ohne Maus/Taste verschwinden Kopfzeile, Knöpfe und Liedtext-Leiste,
  // Cover, Liedtext und Titel rücken um die frei gewordene Höhe nach unten zur Mitte.
  let idleT = 0, vizMoveUntil = 0;
  let barT = 0;
  function wake() {
    kick();
    clearTimeout(idleT);
    if (el.dataset.mode === "party" && isOpen()) {
      el.classList.add("is-barwake");
      clearTimeout(barT);
      const off = () => (barT = setTimeout(() => (el.querySelector(".m-im-lyrbar:hover, .m-im-lyrbar:focus-within") ? off() : el.classList.remove("is-barwake")), 3000));
      off();
    }
    if (el.classList.contains("is-idle")) {
      el.classList.remove("is-idle");
      vizMoveUntil = performance.now() + 1000;
    }
    if (cfg.partyIdle && el.dataset.mode === "party" && isOpen()) idleT = setTimeout(goIdle, 2600);
  }
  function goIdle() {
    // per Tastatur auf einem Knopf: die Bedienung bleibt sichtbar, sonst löste Enter etwas Unsichtbares aus. Der
    // Wiedergabe-Knopf zählt nicht – dort liegt der Fokus nach dem Öffnen von selbst (Fernseher: soll ausblenden).
    const fe = document.activeElement;
    const keyFocus = !!fe && fe !== q.play && fe.matches?.(":focus-visible") && !!fe.closest(".m-im-meta, .m-im-top, .m-im-lyrbar");
    // nicht, solange eine Seitenleiste oder die Tastenhilfe offen ist oder die Maus auf der Bedienung ruht
    if (!isOpen() || el.dataset.mode !== "party" || openMenu() || keyFocus || el.querySelector(".m-im-meta:hover, .m-im-top:hover, .m-im-lyrbar:hover")) {
      idleT = setTimeout(goIdle, 2600);
      return;
    }
    // sichtbare Höhe (große Fenster zoomen die Knöpfe, offsetHeight zählte ungezoomt)
    el.style.setProperty("--m-idle-shift", Math.round(q.controls.getBoundingClientRect().height + 10) + "px");
    el.classList.add("is-idle");
    // der Visualizer folgt dem wandernden Cover Bild für Bild
    vizMoveUntil = performance.now() + 1000;
  }

  function placeIndicator() {
    const b = el.querySelector(`.m-im-tabs button[data-mode="${cfg.imMode}"]`);
    if (!b) return;
    // 1.27 polish: das erste Setzen springt an seinen Platz – sonst wuchs der Balken beim ersten Öffnen aus der Ecke heraus
    const first = !q.ind.style.width;
    if (first) q.ind.style.transition = "none";
    q.ind.style.width = b.offsetWidth + "px";
    q.ind.style.transform = `translateX(${b.offsetLeft}px)`;
    if (first) {
      void q.ind.offsetWidth;
      q.ind.style.transition = "";
    }
  }

  // 1.27 polish: schnell hintereinander (Tasten 1–6 gehämmert, Pfeiltasten in den Reitern gehalten): höchstens ein
  // Wechsel alle 160 ms, dazwischen gewünschte sammeln sich – der letzte gewinnt. Jeder Wechsel baut Spalten, Liedtext
  // und Leinwand um (bis 40 ms); ungebremst stauten sich die Bilder, und die Ansicht hing hinter den Tasten her.
  let modeT = 0, modeAt = -1e9, modeNext = null;
  function setMode(mode, animate) {
    if (animate && isOpen() && !stillMotion()) {
      const left = modeAt + 160 - performance.now();
      if (left > 0 || modeT) {
        modeNext = mode;
        if (!modeT) modeT = setTimeout(() => {
          modeT = 0;
          const m = modeNext;
          modeNext = null;
          if (m) setMode(m, true);
        }, Math.max(0, left));
        return;
      }
      modeAt = performance.now();
    } else if (modeT) {
      clearTimeout(modeT);
      modeT = 0;
      modeNext = null;
    }
    if (!MODES.some(([k]) => k === mode)) mode = "cover";
    const apply = () => {
      // aus Visualizer, Mix oder Party heraus: der Visualizer läuft weiter, bis er ausgeblendet ist
      const from = el.dataset.mode;
      vizFadeUntil = VIZ.has(from) && !VIZ.has(mode) && !stillMotion() && isOpen() ? performance.now() + 550 : 0;
      cfg.imMode = mode;
      save();
      el.dataset.mode = mode;
      vizRect.r = null;
      vizMoveUntil = performance.now() + 1000;
      el.querySelectorAll(".m-im-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
      el.querySelectorAll(".m-im-tabs button").forEach((b) => (b.tabIndex = b.dataset.mode === mode ? 0 : -1));
      placeIndicator();
      updateKicker();
      if (LYR.has(mode)) loadLyrics();
      if (mode === "mix") party.prepare(currentItem());
      // aufgeschobene Wort-Effekte jetzt vorbereiten (sie werden in Party gebraucht)
      if (mode === "party") wordPrep?.();
      if (mode === "party") party.prepare(currentItem()).then((info) => {
        updateKicker();
        noteRecap(currentItem(), info);
      });
      else resetParty();
      showExtras();
      applyCanvas();
      sizeCanvas();
      // 1.27 views: Album-Spalte nur in der Cover-Ansicht, Uhr nur in ihrer Ansicht
      album.sync(currentItem(), mode, false);
      clockView.show(mode === "clock");
      // aus der Uhr zurück: das Cover blendet weich ein, statt aufzuspringen
      if (from === "clock" && mode !== "clock" && !stillMotion() && isOpen()) q.wrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: "ease-out" });
      active = -2;
      // Liedtext gleich an der richtigen Stelle der neuen Spalte, statt quer hinzugleiten
      if (LYR.has(mode)) placeSoon("snap");
      wake();
    };
    if (animate && !stillMotion() && isOpen() && el.dataset.mode !== mode) morphMode(apply);
    else apply();
  }
  // Ansichtswechsel als Gleitfahrt (FLIP) statt View Transition: die lief über eingefrorene Standbilder der
  // ganzen Seite – der Visualizer stand für 0,45 s als Geisterbild still, sein Kranz saß schon am Ziel, während
  // das Cover-Standbild noch flog, und das Abfotografieren kostete beim Wechsel ein langes Bild.
  // Jetzt bleibt alles lebendig: Cover und Titelblock gleiten von der alten an die neue Stelle (der Kranz folgt
  // Bild für Bild, siehe vizMoveUntil), der Titelblock blendet dabei über, Liedtext blendet ein bzw. aus.
  let morphUntil = 0, morphAnims = [];
  function morphMode(apply) {
    const lyrWas = q.lyrics.offsetWidth > 0;
    const a = q.wrap.getBoundingClientRect(), m = q.meta.getBoundingClientRect(), l0 = lyrWas ? q.lyrics.getBoundingClientRect() : null;
    const metaGhost = ghostOf(q.meta, m);
    const lyrGhost = lyrWas ? lyricsGhostIn(el) : null;
    // 1.27 polish: wie sichtbar der Titelblock gerade ist (mitten im Einblenden): so hell startet auch sein Geist
    const mOp = getComputedStyle(q.meta).opacity;
    // neuer Wechsel mitten in einer Gleitfahrt (Tasten 1–6 schnell hintereinander): die laufende endet hier. Gemessen
    // ist schon, wo alles gerade zu sehen ist – lief sie weiter, addierte sich ihr Versatz zum neuen, und das Cover
    // sprang um Hunderte Pixel
    for (const x of morphAnims) x.cancel();
    morphAnims = [];
    apply();
    const b = q.wrap.getBoundingClientRect(), n = q.meta.getBoundingClientRect();
    const ease = "cubic-bezier(0.22, 1, 0.36, 1)", ms = 700;
    morphUntil = performance.now() + ms;
    vizMoveUntil = morphUntil + 100;
    if (a.width && b.width) {
      const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2), k = a.width / b.width;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || Math.abs(k - 1) > 0.01) morphAnims.push(q.wrap.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${k})` }, { transform: "none" }], { duration: ms, easing: ease, composite: "add" }));
    }
    if (m.width && n.width) {
      const dx = m.left + m.width / 2 - (n.left + n.width / 2), dy = m.top - n.top;
      morphAnims.push(q.meta.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: ms, easing: ease, composite: "add" }));
      // Deckkraft eigens (nicht addiert): Party dimmt den Titelblock auf 0,6
      morphAnims.push(q.meta.animate([{ opacity: 0 }, { opacity: getComputedStyle(q.meta).opacity }], { duration: ms * 0.6, delay: ms * 0.1, easing: ease, fill: "backwards" }));
      if (metaGhost) metaGhost.animate([{ transform: "none", opacity: mOp }, { transform: `translate(${-dx}px, ${-dy}px)`, opacity: 0 }], { duration: ms * 0.5, easing: ease, fill: "forwards" }).finished.then(() => metaGhost.remove(), () => metaGhost.remove());
    } else metaGhost?.remove();
    if (lyrGhost) lyrGhost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: "ease-out", fill: "forwards" }).finished.then(() => lyrGhost.remove(), () => lyrGhost.remove());
    if (!lyrWas && q.lyrics.offsetWidth) morphAnims.push(q.lyrics.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: 80, easing: ease, fill: "backwards" }));
    // 1.27 polish: Liedtext bleibt, steht aber woanders (Liedtext ↔ Mix ↔ Party): der neue blendet über den
    // ausblendenden Geist ein, statt an der neuen Stelle schlagartig dazustehen
    else if (lyrGhost && q.lyrics.offsetWidth) {
      const l1 = q.lyrics.getBoundingClientRect();
      if (Math.abs(l1.left - l0.left) > 24 || Math.abs(l1.top - l0.top) > 24 || Math.abs(l1.width - l0.width) > 24) morphAnims.push(q.lyrics.animate([{ opacity: 0 }, { opacity: getComputedStyle(q.lyrics).opacity }], { duration: 460, delay: 90, easing: ease, fill: "backwards" }));
    }
  }
  // Liedtext beim Verlassen: sichtbare Zeilen samt Randverlauf (Maske) an ihrer Stelle, über der neuen Ansicht
  function lyricsGhostIn(host) {
    const r = q.lyrics.getBoundingClientRect(), o = host.getBoundingClientRect(), ls = getComputedStyle(q.lyrics);
    if (!r.width || !r.height) return null;
    const { g, cs } = lyricsCopy();
    g.style.cssText = `left:${q.inner.offsetLeft}px;top:${q.inner.offsetTop - q.lyrics.scrollTop}px;width:${q.inner.offsetWidth}px;transform:${cs.transform}`;
    const w = document.createElement("div");
    w.className = "m-im-morph";
    w.setAttribute("aria-hidden", "true");
    w.style.cssText = `position:absolute;left:${r.left - o.left}px;top:${r.top - o.top}px;width:${r.width}px;height:${r.height}px;overflow:hidden;pointer-events:none;-webkit-mask-image:${ls.webkitMaskImage};mask-image:${ls.maskImage}`;
    w.append(g);
    host.append(w);
    return w;
  }
  // stille Kopie eines Bereichs an seiner jetzigen Stelle (für die Überblendung beim Ansichtswechsel)
  function ghostOf(node, r) {
    if (!r.width || !r.height) return null;
    const display = getComputedStyle(node).display;
    const g = node.cloneNode(true);
    g.removeAttribute("id");
    g.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
    g.classList.add("m-im-morph");
    g.setAttribute("aria-hidden", "true");
    g.inert = true;
    const o = el.getBoundingClientRect();
    g.style.cssText += `;position:absolute;margin:0;left:${r.left - o.left}px;top:${r.top - o.top}px;width:${r.width}px;height:${r.height}px;pointer-events:none;translate:none;scale:none;rotate:none;display:${display}`;
    el.append(g);
    return g;
  }

  function updateKicker() {
    if (!el) return;
    const m = el.dataset.mode;
    if (m === "party") {
      // „Party · Rave · 128 BPM“ – zeigt, welches Profil gerade greift
      const p = party.info;
      // Podcast, Werbung, DJ-Ansage: kein Genre und kein Tempo anzeigen – es ist ja keine Musik
      // (DJ-Ansage: „Party · DJ“, mit Stimme, wenn Spotify sie nennt)
      if (p.talk) return void (q.kicker.textContent = p.label || "Party");
      // „≈“: Tempo nur geschätzt (Spotify hat keine Taktanalyse, siehe estimate.js)
      // „120? BPM“: nur ein Richtwert (offline, kein Liedtext, keine Hörprobe) – ehrlich markiert, aber immer ein Tempo
      q.kicker.textContent = ["Party", t("party_" + p.key), p.bpm ? (audio.data?.synthetic ? "≈ " : "") + p.bpm + (p.src === "guess" ? "?" : "") + " BPM" : ""].filter(Boolean).join(" · ");
      return;
    }
    q.kicker.textContent = m === "viz" ? t(audio.data ? "vizBeat" : "vizAmbient") : m === "lyrics" ? t("lyrics") : m === "mix" ? t("tabMix") : t("now");
  }
  // Party-Effekte (Farbfläche, Wackeln) zurücknehmen, wenn eine andere Ansicht kommt
  let partyFx = false;
  function resetParty() {
    if (!partyFx) return;
    partyFx = false;
    q.flash.style.opacity = "0";
    q.wrap.style.translate = "";
    shakeX = shakeY = 0;
    q.canvas.style.scale = q.bg.style.scale = lastKick = "";
    q.wrap.style.rotate = lastRot = "";
    if (activeEl) activeEl.style.scale = lastBounce = "";
    activeEl?.classList.remove("is-hype");
    q.bg.style.translate = "";
    lastBgZ = "";
    q.canvas.style.transform = q.lyrics.style.translate = q.meta.style.translate = "";
    Object.assign(cam, { s: 1, x: 0, y: 0, key: "" });
    depth.key = "";
    motes = [];
    party.live = null;
    live.stop();
    venueClear();
    // Party verlassen: Location-Thread samt Bildern bald freigeben (wer gleich zurückwechselt, findet ihn noch)
    venueLater(RELEASE_MS);
    el?.querySelector(".m-im-livecard")?.remove();
  }

  // Jam: Profilbilder schweben links und rechts am Rand; du mit Akzentring, der Host mit kleinem Punkt.
  // Neu gebaut wird nur, wenn sich die Runde ändert.
  let lastJam = -1e9, jamKey = "";
  async function showJam() {
    const list = cfg.partyJam ? await jamMembers() : [];
    // wer hat den laufenden Song gewünscht? (soweit Spotify es im Song vermerkt)
    const meta = currentItem()?.metadata || {};
    const by = Object.entries(meta).filter(([k]) => /added_?by|queued_?by|contributor/i.test(k)).map(([, v]) => String(v).toLowerCase());
    for (const m of list) m.dj = by.some((v) => v && (v === String(m.id).toLowerCase() || v === String(m.name).toLowerCase() || v.includes(String(m.id).toLowerCase())));
    const key = list.map((m) => m.id + m.img + (m.dj ? "*" : "")).join("|") + cfg.partyJamLight;
    if (key === jamKey) return;
    jamKey = key;
    q.jam.textContent = "";
    q.jam.hidden = !list.length;
    // klein unten im Publikum, links und rechts der Mitte (dort stehen Titel und Knöpfe), leicht versetzt
    const SPOTS = [20, 80, 12, 88, 4, 96, 28, 72];
    const shown = list.slice(0, SPOTS.length);
    shown.forEach((m, i) => {
      const f = document.createElement("figure");
      f.className = "m-jam-p" + (m.me ? " is-me" : "") + (m.host ? " is-host" : "") + (cfg.partyJamLight && m.dj ? " is-dj" : "");
      f.style.cssText = `--i:${i};left:${SPOTS[i]}%;top:${i % 4 < 2 ? 87 : 84}%`;
      if (cfg.partyJamLight) {
        const c = (vividPal || imPalette())[i % 3];
        f.style.setProperty("--jc", `rgb(${c.join(",")})`);
        // Klasse statt [style*="--jc"] im CSS: ein Attribut-Selektor auf „style“ mit Nachfahren ließ jede Stiländerung
        // im Vollbild (Puls, Fortschritt, Karaoke – jedes Bild) alle Bilder und Spans darunter neu berechnen
        f.classList.add("has-jc");
      }
      const pic = document.createElement(m.img ? "img" : "span");
      if (m.img) {
        pic.src = m.img;
        pic.alt = "";
        pic.referrerPolicy = "no-referrer";
      } else pic.textContent = (m.name || "?").trim().charAt(0).toUpperCase();
      const cap = document.createElement("figcaption");
      cap.textContent = m.me ? t("jamYou") : m.name;
      f.append(pic, cap);
      q.jam.append(f);
    });
    if (list.length > shown.length) {
      const more = document.createElement("figure");
      more.className = "m-jam-p is-more";
      more.style.cssText = "--i:9;left:96%;top:70%";
      more.textContent = "+" + (list.length - shown.length);
      q.jam.append(more);
    }
  }

  // Jeder Ladevorgang bekommt eine Nummer; nur der neueste darf schreiben. Sonst hängen zwei
  // gleichzeitige Aufrufe für denselben Song (Ansicht wechseln + Songwechsel) beide ihre
  // Übersetzung an – die stand dann doppelt da.
  let lyrToken = 0;
  // Kein Text oder ein Instrumental: nur ein leises Zeichen neben dem Titel (in allen Ansichten),
  // die Erklärung und die nächsten Schritte erscheinen beim Drüberfahren
  let lyrStateToken = 0, lyrStateUri = "";
  // Wächter für das Layout mit/ohne Liedtext: je Song höchstens ein Wechsel (lyrlayout.js, noLyrFor)
  const lyrGate = createLayoutGate();
  async function updateLyrState() {
    const item = currentItem(), uri = item?.uri || "", tok = ++lyrStateToken;
    // beim selben Song nichts ausblenden: sonst flackert das Zeichen bei jeder Aktualisierung
    if (uri !== lyrStateUri) q.lyrstate.hidden = true;
    lyrStateUri = uri;
    if (!/^spotify:(track|local):/.test(uri)) return;
    const fin = await getLyrics(uri).catch(() => null);
    if (tok !== lyrStateToken) return;
    // es zählt, was die Liedtext-Fläche zeigt: ein spätes „Instrumental“ verdrängt keinen gezeigten Text
    const got = uri === lyrUri && lyr !== undefined && !takeLyrics(lyr, fin) ? lyr : fin;
    const instrumental = !!got?.instrumental;
    // schon hier festlegen: sonst springt beim Wechsel in Liedtext oder Mix erst das Layout um
    // (über den Wächter: je Song höchstens ein Wechsel)
    noLyrFor(uri, got);
    if (!instrumental && got?.lines?.length) return void (q.lyrstate.hidden = true);
    const label = t(instrumental ? "instrTitle" : "emptyTitle");
    const btn = q.lyrstate.querySelector("button");
    btn.innerHTML = instrumental ? ICON.lyrInstr : ICON.lyrNone;
    btn.setAttribute("aria-label", label);
    const pop = q.lyrstate.querySelector(".m-im-lyrstate-pop");
    pop.textContent = "";
    const head = document.createElement("b");
    head.textContent = label;
    const text = document.createElement("p");
    text.textContent = t(instrumental ? "instrText" : cfg.onlineLyrics ? "emptyText" : "emptyTextOff");
    const actions = document.createElement("div");
    actions.className = "m-im-lyrstate-actions";
    const action = (key, onclick, cls) => {
      const b = document.createElement("button");
      b.type = "button";
      if (cls) b.className = cls;
      b.textContent = t(key);
      b.onclick = onclick;
      actions.append(b);
    };
    action("showViz", () => setMode("viz", true), "is-viz");
    if (cfg.onlineLyrics) action("lyrPick", () => showSide("versions"));
    if (!instrumental && item) {
      const web = document.createElement("a");
      web.textContent = t("searchWeb");
      web.target = "_blank";
      web.rel = "noopener";
      web.href = "https://www.google.com/search?q=" + encodeURIComponent(`${titleOf(item)} ${artistOf(item).split(", ")[0]} lyrics`);
      actions.append(web);
    }
    pop.append(head, text, actions);
    q.lyrstate.hidden = false;
  }
  // Wortzeiten einer Zeile. Liefert Spotify Silbenzeiten, gelten die; sonst wird geschätzt:
  // die Zeile dauert bis zur nächsten (höchstens so lange, wie man sie ungefähr singt),
  // jedes Wort bekommt einen Anteil nach seiner Länge.
  let words = [];
  function wordTimes(lines, i) {
    const l = lines[i];
    const next = lines[i + 1]?.t ?? l.t + 6000;
    // echte Wortzeiten (NetEase-YRC, Enhanced LRC): genau so, wie gesungen wird
    if (l.words?.length) return l.words.map((w) => ({ text: w.text, a: w.t, b: w.t + Math.max(60, w.d), sp: w.sp, bg: w.bg }));
    const parts = l.text.split(/\s+/).filter(Boolean);
    if (l.syl?.length) {
      // Silben → Zeichenpositionen, dann je Wort Anfang der ersten und Ende der letzten Silbe
      const marks = [];
      let c = 0;
      l.syl.forEach((s, k) => {
        marks.push({ from: c, to: c + s.n, a: s.t, b: l.syl[k + 1]?.t ?? Math.min(next, s.t + 900) });
        c += s.n;
      });
      let pos = 0;
      return parts.map((w) => {
        const from = l.text.indexOf(w, pos);
        pos = from + w.length;
        const hit = marks.filter((m) => m.to > from && m.from < pos);
        // Silben mit ihrem Anteil am Wort: die Buchstaben füllen sich Silbe für Silbe, genau wie gesungen
        const len = Math.max(1, pos - from);
        const sy = hit.map((m) => ({ a: m.a, f0: clamp((m.from - from) / len, 0, 1), f1: clamp((m.to - from) / len, 0, 1) }));
        return hit.length ? { text: w, a: hit[0].a, b: hit[hit.length - 1].b, sy } : { text: w, a: l.t, b: l.t + 1 };
      });
    }
    // geschätzt: im Gesangstempo (≈ 75 ms je Zeichen) statt über die ganze Pause bis zur nächsten Zeile;
    // beim Aktivwerden (im verspielten Stil schon als vorbereitete nächste Zeile) legt snapWords die Wortanfänge
    // zusätzlich auf die Ton-Einsätze der Analyse
    const chars = parts.reduce((n, w) => n + w.length + 2, 0);
    const span = Math.max(300, Math.min(next - l.t - 150, Math.max(900, chars * 75)));
    let at = l.t;
    return parts.map((w) => {
      const d = (span * (w.length + 2)) / chars;
      const out = { text: w, a: at, b: at + d, est: true };
      at += d;
      return out;
    });
  }
  // Geschätzte Wörter auf den Gesang legen: jedes Wort wird in Silben zerlegt, und jede Silbe bekommt
  // einen eigenen Ton-Einsatz der Analyse (Segment-Anfang) – per Optimierung über die ganze Zeile, sodass
  // die Summe der Abweichungen am kleinsten ist (Reihenfolge bleibt, lieber ohne Einsatz als zu weit weg).
  // Die Buchstaben füllen sich danach Silbe für Silbe.
  const VOWELS = /[aeiouyäöüáéíóúàèìòùâêîôûãõåæøœıаеёиоуыэюяіїє]+/g;
  const CJK = /[぀-ヿ㐀-鿿가-힯]/;
  const syllables = (w) => (CJK.test(w) ? [...w].length : Math.max(1, (w.toLowerCase().match(VOWELS) || []).length));
  function snapWords(list, t0, t1) {
    list.snapped = true;
    const segs = audio.data?.segs;
    if (!segs?.length || audio.uri !== lyrUri || audio.data.synthetic) return;
    const on = [];
    for (let k = Math.max(seek(segs, t0 / 1000 - 0.3, "t"), 0); k < segs.length && segs[k].t * 1000 < t1; k++) {
      if (segs[k].l > -30) on.push({ t: segs[k].t * 1000, s: clamp(segs[k].l - (segs[k - 1]?.l ?? -60), 0, 12) });
    }
    const sy = [];
    list.forEach((w, wi) => {
      const n = syllables(w.text || "");
      for (let j = 0; j < n; j++) sy.push({ wi, j, n, e: w.a + ((w.b - w.a) * j) / n });
    });
    const S = sy.length, O = on.length;
    if (!S || O < Math.max(2, S * 0.4)) return;
    // f[k][j]: kleinste Kosten für die ersten k Silben, wenn die Einsätze bis j verbraucht sind
    const SKIP = 160, MAXD = 350, INF = 1e9;
    const f = Array.from({ length: S + 1 }, () => new Float64Array(O + 1).fill(INF));
    const how = Array.from({ length: S + 1 }, () => new Int32Array(O + 1).fill(-2));
    f[0].fill(0);
    for (let k = 0; k < S; k++) {
      for (let j = 0; j < O; j++) if (f[k][j] < f[k][j + 1]) [f[k][j + 1], how[k][j + 1]] = [f[k][j], -3];
      for (let j = 0; j <= O; j++) {
        if (f[k][j] >= INF) continue;
        if (f[k][j] + SKIP < f[k + 1][j]) [f[k + 1][j], how[k + 1][j]] = [f[k][j] + SKIP, -1];
        if (j < O) {
          const dd = Math.abs(on[j].t - sy[k].e);
          if (dd < MAXD) {
            const c = f[k][j] + dd - 6 * on[j].s;
            if (c < f[k + 1][j + 1]) [f[k + 1][j + 1], how[k + 1][j + 1]] = [c, j];
          }
        }
      }
    }
    let j = 0;
    for (let x = 1; x <= O; x++) if (f[S][x] < f[S][j]) j = x;
    for (let k = S; k > 0; ) {
      const h = how[k][j];
      if (h === -3) {
        j--;
        continue;
      }
      if (h >= 0) {
        sy[k - 1].t = on[h].t;
        j = h;
      }
      k--;
    }
    // Reihenfolge absichern, dann Wortanfang = erste Silbe, Silbenanteile für die Buchstaben
    let prev = t0 - 300;
    for (const x of sy) {
      x.t = Math.max(x.t ?? x.e, prev + 50);
      prev = x.t;
    }
    list.forEach((w, wi) => {
      const mine = sy.filter((x) => x.wi === wi);
      w.a = mine[0].t;
      w.sy = mine.map((x) => ({ a: x.t, f0: x.j / x.n, f1: (x.j + 1) / x.n }));
    });
    list.forEach((w, k) => (w.b = list[k + 1] ? Math.max(w.sy[w.sy.length - 1].a + 80, list[k + 1].a) : Math.max(w.a + 200, w.b)));
  }
  // Knopf unten rechts: woher der Text kommt, und eine andere Fassung wählen
  function showSource(got) {
    const picked = !!cfg.lyricPicks?.[lyrUri];
    // ohne Text steckt „Fassung wählen“ im Zeichen neben dem Titel
    q.lyrsrc.hidden = !cfg.onlineLyrics || !/^spotify:(track|local):/.test(lyrUri) || !got?.lines?.length;
    q.lyrsrc.querySelector("span").textContent = got ? (SOURCE_NAME[got.source] || "Spotify") + (picked ? " · " + t("lyrPicked") : "") : t("lyrNone");
    showNudge();
  }
  // „Nicht der richtige Liedtext“: das gezeigte Ergebnis für diesen Song als falsch merken und sofort das
  // nächstbeste holen (andere Quelle oder anderer Eintrag). Zurück geht es über „Fassung wählen“ → „Automatisch“.
  async function wrongLyrics() {
    const uri = lyrUri;
    if (!lyr || !uri || !cfg.onlineLyrics || !rejectLyrics(uri, lyr)) return;
    showSide(null);
    lyrUri = "";
    lyrGate.reset();
    await loadLyrics();
    if (lyrUri !== uri) return;
    const found = !!lyr?.lines?.length || !!lyr?.instrumental;
    S.showNotification?.(found ? t("lyrWrongNext").replace("{s}", SOURCE_NAME[lyr.source] || "Spotify") : t("lyrWrongNone"), false, 3500);
  }
  async function showVersions(body, item) {
    const uri = lyrUri;
    item(t("loading"));
    const list = await lyricVersions(uri);
    if (side !== "versions" || uri !== lyrUri) return;
    body.textContent = "";
    const cur = lyr?.lrcId ? String(lyr.lrcId) : "";
    const pickedId = cfg.lyricPicks?.[uri] || "", rejected = rejectedCount(uri);
    const choose = (id) => {
      pickLyrics(uri, id);
      lyrUri = "";
      lyrGate.reset();
      loadLyrics();
      showSide(null);
    };
    syncDiag(body, item);
    // „Automatisch“ nimmt auch gemeldete Fehler zurück
    item(t("lyrAuto"), rejected ? t("lyrAutoReset").replace("{n}", rejected) : t("lyrAutoHint"), null, pickedId || rejected ? () => choose("") : null, !pickedId && !rejected);
    if (lyr?.lines?.length || lyr?.instrumental) item(t("lyrWrong"), t("lyrWrongHint"), null, wrongLyrics);
    if (!list.length) return item(t("lyrNoVersions"));
    for (const v of list) {
      const kind = v.instrumental ? t("instrTitle") : v.synced ? t("lyrSynced") : t("lyrPlain");
      const sub = [v.album, v.sec ? fmt(v.sec * 1000) : "", kind].filter(Boolean).join(" · ");
      const on = String(v.id) === (pickedId || cur);
      item(`${v.title} – ${v.artist}`, sub, null, on ? null : () => choose(v.id), on);
    }
  }
  /* ---- Woher der Liedtext kommt und ob Mirage ihn verschoben hat (oben in „Fassung wählen“)
     Liest lyr.diag ({ source, id, candidates, cluster, spotifyOverruled, shifted, auto: { off, scale, conf, applied, why } }
     aus lyrics.js), sonst, was heute schon da ist (source, lrcId, neId, sync). Fehlt etwas, fehlt nur die Zeile.
     Zurücknehmen, wieder einschalten und neu suchen gehen über lyrics.js (setAutoSync, autoSyncOff, researchLyrics);
     gibt es die noch nicht, fehlen nur diese Zeilen. */
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + new Intl.NumberFormat(LANG, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
  function syncInfo(l = lyr) {
    if (!l?.lines?.length) return null;
    const d = l.diag || {};
    const source = d.source || l.source || "spotify";
    const id = d.id ?? (source === "lrclib" ? l.lrcId : /^(netease|amll)$/.test(source) ? l.neId : "");
    // Versatz in ms (wie alignLyrics); off/scale gelten nur, wenn applied
    const a = d.auto || (l.sync ? { off: l.sync.off, scale: l.sync.scale, conf: l.sync.conf, applied: true } : null);
    const off = typeof lyricsApi.autoSyncOff === "function" ? !!lyricsApi.autoSyncOff(lyrUri) : a?.why === "off";
    return { source, id, auto: a, cands: Number(d.candidates) || 0, cluster: Number(d.cluster) || 0, shifted: Number(d.shifted) || 0, overruled: !!d.spotifyOverruled, off };
  }
  const reloadLyr = () => {
    lyrUri = "";
    if (el && LYR.has(el.dataset.mode)) loadLyrics();
  };
  function syncDiag(body, item) {
    const s0 = syncInfo();
    // neu suchen: vergisst das gemerkte Ergebnis (auch „kein Liedtext“) und fragt alle Quellen noch einmal.
    // Steht auch ohne Liedtext da – gerade dann wird es gebraucht („kein Liedtext“ bleibt sonst eine Woche gemerkt).
    const research = () => {
      if (typeof lyricsApi.researchLyrics !== "function") return;
      item(t("dgSearch"), t("dgSearchHint"), null, async () => {
        const uri = currentItem()?.uri || "";
        showSide(null);
        await lyricsApi.researchLyrics(uri).catch(() => {});
        reloadLyr();
      });
    };
    if (!s0) return research();
    const info = (text, sub) => {
      item(text, sub || "", null, null);
      q.sideBody.lastElementChild.classList.add("m-im-diag");
    };
    const name = (SOURCE_NAME[s0.source] || s0.source) + (s0.id ? " #" + s0.id : "");
    const agree = s0.cands > 1 ? (s0.cluster > 1 ? t("dgCluster").replace("{c}", s0.cluster).replace("{n}", s0.cands) : t("dgCands").replace("{n}", s0.cands)) : "";
    const moved = s0.shifted ? t("dgShifted").replace("{v}", signed(s0.shifted / 1000)) : "";
    info(t("dgSource").replace("{s}", name), [agree, moved, s0.overruled ? t("dgSpotifyOver") : ""].filter(Boolean).join(" · "));
    const a = s0.auto, setAuto = lyricsApi.setAutoSync;
    const uri = lyrUri;
    const flip = (on) => {
      setAuto(uri, on);
      S.showNotification?.(t(on ? "dgRedone" : "dgUndone"), false, 3000);
      showSide(null);
      reloadLyr();
    };
    if (a?.applied && (a.off || (a.scale && a.scale !== 1))) {
      let text = t("dgAuto").replace("{v}", signed((Number(a.off) || 0) / 1000));
      if (a.conf != null) text += ", " + t("dgSure").replace("{p}", Math.round(a.conf * 100));
      if (a.scale && a.scale !== 1) text += " · " + t("dgStretch").replace("{x}", signed((a.scale - 1) * 100).replace(/,00|\.00/, ""));
      info(text);
      if (typeof setAuto === "function") item(t("dgUndo"), t("dgUndoHint"), null, () => flip(false));
    } else if (s0.off) {
      info(t("dgAutoOff"));
      if (typeof setAuto === "function") item(t("dgRedo"), t("dgRedoHint"), null, () => flip(true));
    } else info(t("dgNoAuto"));
    research();
  }

  /* ---- Liedtext früher / später je Song (clock.js: nudgeSong/resetSong/songOffset – Liedtext UND Licht/Bild) */
  const songOffset = (uri) => (typeof clockApi.songOffset === "function" ? clockApi.songOffset(uri) || 0 : 0);
  const canNudge = () => typeof clockApi.nudgeSong === "function";
  function showNudge() {
    if (!q.nudge) return;
    const can = canNudge() && !!lyr?.synced && /^spotify:(track|local):/.test(lyrUri);
    q.nudge.hidden = !can;
    if (!can) return;
    const v = songOffset(lyrUri), b = q.nudge.querySelector(".m-im-nudge-val");
    b.textContent = v ? signed(v / 1000) + " s" : "0 s";
    b.classList.toggle("is-on", !!v);
    b.disabled = !v;
  }
  function nudge(ms) {
    const uri = lyrUri || currentItem()?.uri || "";
    if (!uri || !canNudge()) return;
    const v = ms ? clockApi.nudgeSong(uri, ms) : (clockApi.resetSong(uri), 0);
    showNudge();
    // die Zeile springt sofort an die neue Stelle (die Bildschleife schaut nach der aktuellen Zeile)
    active = -2;
    kick();
    if (!ms) imToast(t("syResetDone"));
    else imToast((v ? t(v > 0 ? "syNowEarly" : "syNowLate").replace("{v}", new Intl.NumberFormat(LANG, { maximumFractionDigits: 2 }).format(Math.abs(v) / 1000)) : t("syNone")), [[t("syReset"), () => nudge(0)]], 2400);
    if (side === "menu") rebuildMenu();
  }

  // Party ohne Liedtext: Titel und Bedienung rücken unter das Cover. Der Wechsel passiert erst, wenn klar ist,
  // ob es Text gibt (nicht schon beim Laden – sonst sprang alles bei jedem Songwechsel zweimal hin und her),
  // und er gleitet: Cover, Titel und Liedtext fliegen von der alten an die neue Stelle (FLIP).
  function setNoLyr(on) {
    if (!el || el.classList.contains("is-nolyr") === on) return;
    const parts = [q.wrap, q.meta, q.lyrics].filter(Boolean);
    const glide = LYR.has(el.dataset.mode) && !stillMotion() && el.isConnected;
    const before = glide ? parts.map((p) => p.getBoundingClientRect()) : null;
    el.classList.toggle("is-nolyr", on);
    vizRect.r = null;
    if (!glide) return;
    // der Visualizer-Kranz folgt dem gleitenden Cover Bild für Bild (sonst hing er bis zu einer halben Sekunde daneben)
    vizMoveUntil = performance.now() + 850;
    parts.forEach((p, i) => {
      const a = before[i], b = p.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      p.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], { duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)", composite: "add" });
    });
  }
  // Liedtext laden: das erste brauchbare Ergebnis erscheint sofort, jedes bessere (Text → zeitgenau → Wort für
  // Wort) ersetzt es an Ort und Stelle – ohne „Lädt“, ohne Einblenden, ohne nach oben zu springen.
  // Fertig (Promise erfüllt), wenn das endgültige Ergebnis da ist.
  let lyrLoad = 0, lyrWatch = null, wordPrep = null, lyrFade = null;
  // Zeilen, die showLyrics sofort baut (ab der aktuellen), und je Häppchen danach
  const LINES_FIRST = 14, LINES_STEP = 24;
  function loadLyrics() {
    const uri = currentItem()?.uri || "";
    if (uri === lyrUri && lyr !== undefined) return Promise.resolve();
    const load = ++lyrLoad;
    // Song gewechselt: Anfragen für übersprungene Songs abbrechen
    if (uri !== lyrUri) dropStaleLyrics();
    lyrUri = uri;
    lyr = undefined;
    lyrWatch?.();
    resetLyricsView();
    return new Promise((done) => {
      lyrWatch = watchLyrics(uri, (got, fin) => {
        if (load !== lyrLoad || !el) return done();
        // gleiches Ergebnis noch einmal (endgültig = zuletzt gezeigtes): nichts neu aufbauen
        // (ein spätes „Instrumental“ oder „nichts“ verdrängt nie einen gezeigten Text – lyrlayout.js)
        if (takeLyrics(lyr, got)) {
          // beim Timing von Hand nichts unter den Fingern austauschen
          if (lyr === undefined || !edit) showLyrics(uri, got, lyr !== undefined && !!lyr);
        }
        if (fin) done();
      });
    });
  }
  // Ruhig oder „weniger Bewegung“ im System: Liedtext sofort tauschen, ohne Überblendung
  const stillMotion = () => !!cfg.calm || !!matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Überblendung statt Schnitt: der gezeigte Text bleibt als stille Kopie („Geist“) genau an seinem Platz
  // und blendet aus, während der neue darüber einblendet. Nichts verschwindet schlagartig, nichts springt.
  // Der Geist liegt UNTER dem neuen Text (im DOM davor) – so wird die Schrift mitten in der Blende nicht blass.
  // Kopie nur der gerade sichtbaren Zeilen (je an ihrer Stelle) statt aller Zeilen mit allen Wörtern: die Kopie
  // kostet so kaum Layout und Rasterung. Liest nur Maße (das Layout ist hier noch sauber), schreibt nichts.
  function lyricsCopy() {
    const cs = getComputedStyle(q.inner);
    const ty = (cs.transform && cs.transform !== "none" ? new DOMMatrixReadOnly(cs.transform).m42 : 0) - q.lyrics.scrollTop, h = q.lyrics.clientHeight;
    const g = document.createElement("div");
    g.className = "m-im-lyrics-ghost";
    g.setAttribute("aria-hidden", "true");
    g.inert = true;
    for (const ln of q.inner.children) {
      const top = ln.offsetTop;
      if (top + ln.offsetHeight + ty < -60 || top + ty > h + 60) continue;
      const c = ln.cloneNode(true);
      c.style.position = "absolute";
      c.style.left = c.style.right = "0";
      c.style.top = top + "px";
      c.style.margin = "0";
      g.append(c);
    }
    return { g, cs };
  }
  // Ohne Kopieren und ohne Messen: die bisherige Textfläche selbst wird zum Geist (sie behält ihre Lage und
  // gleitet sogar mitten in einer Gleitfahrt einfach weiter), eine frische, leere Fläche tritt an ihre Stelle.
  function ghostLyrics(ms) {
    q.lyrics.querySelectorAll(".m-im-lyrics-ghost").forEach((g) => g.remove());
    const old = q.inner;
    if (stillMotion() || !LYR.has(el.dataset.mode) || el.classList.contains("is-nolyr") || !old.querySelector(".m-im-line")) return null;
    const fresh = old.cloneNode(false);
    // einfacher Text scrollt mit: der Geist bleibt, wo er gerade zu sehen ist (der Bereich springt gleich nach oben)
    if (q.lyrics.classList.contains("is-unsynced")) old.style.top = -q.lyrics.scrollTop + "px";
    old.classList.add("m-im-lyrics-ghost");
    old.setAttribute("aria-hidden", "true");
    old.inert = true;
    old.after(fresh);
    q.inner = fresh;
    const done = () => old.remove();
    old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" }).finished.then(done, done);
    return old;
  }
  function resetLyricsView() {
    // der alte Text blendet aus, statt schlagartig zu verschwinden (der neue ist meist vorgeladen und blendet gleich ein)
    // ohne Gleitfahrt nach oben zurücksetzen – sonst rutscht der alte Text 0,8 s quer durchs Bild.
    // Mit Geist ist die Fläche neu (noch ohne Stil): dann gleitet ohnehin nichts, und es braucht kein Layout
    if (ghostLyrics(320)) q.inner.style.transform = "";
    else snapLyrics(() => (q.inner.style.transform = ""));
    // 1.27 polish: gescrollt wird nur einfacher Text – scrollTop zu setzen erzwang sonst bei jedem Songwechsel
    // mitten im Umbau ein ganzes Layout (bis 17 ms), obwohl die Fläche ohnehin oben stand
    if (q.lyrics.classList.contains("is-unsynced")) q.lyrics.scrollTop = 0;
    words = [];
    q.inner.innerHTML = '<div class="m-im-lyrics-note"></div>';
    q.inner.firstChild.textContent = t("loading");
    q.lyrics.classList.remove("is-unsynced");
    el.classList.remove("is-karaoke");
    q.lyrsrc.hidden = q.nudge.hidden = true;
    q.trbtn.hidden = true;
    // meist ist der Liedtext vorgeladen und sofort da: der Hinweis blendet erst nach 0,7 s ein, statt bei jedem
    // Songwechsel kurz aufzublitzen
    q.inner.firstChild.classList.add("is-wait");
  }
  // upgrade: ein besseres Ergebnis ersetzt das gezeigte – Position und aktuelle Zeile bleiben, kein Einblenden
  function showLyrics(uri, got, upgrade) {
    const token = ++lyrToken;
    lyr = got;
    kick();
    // Hype-Zeilen: der Refrain (Zeilen, die sich wiederholen) und Aufforderungen ans Publikum
    hype = new Set();
    const HYPE = /\b(drop|jump|hands? up|put your hands|everybody|let'?s go|come on|party|dance|scream|shout|louder|higher|alle zusammen|hände hoch|springen|los geht'?s|vamos|arriba|salta|dale|allez|levez|sautez|давай)\b/i;
    const seen = new Map(), key = (x) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    (got?.lines || []).forEach((l) => key(l.text).length > 6 && seen.set(key(l.text), (seen.get(key(l.text)) || 0) + 1));
    (got?.lines || []).forEach((l, i) => (seen.get(key(l.text)) >= 2 || HYPE.test(l.text)) && hype.add(i));
    active = -2;
    words = [];
    // ein besseres Ergebnis zum selben Song: der alte Text blendet an Ort und Stelle aus, der neue steht schon
    // an der richtigen Stelle und blendet darüber ein (Text → zeitgenau → Wort für Wort ohne Springen)
    // steht der Text gerade mitten in einer Gleitfahrt, fährt der neue von genau dort weiter (kein Sprung)
    // gemessen wird nur, wenn wirklich gerade eine Gleitfahrt läuft (sonst ist das Ziel die jetzige Lage)
    const from = upgrade && got?.synced ? (q.inner.getAnimations().length ? getComputedStyle(q.inner).transform : q.inner.style.transform) : "";
    if (upgrade) ghostLyrics(450);
    // kein Text (nichts gefunden, Instrumental): „Lädt …“ blendet erst aus, dann Layout (lyricsGone)
    if (!hasText(got)) return void lyricsGone(uri, got);
    q.inner.textContent = "";
    if (q.lyrics.classList.contains("is-unsynced")) q.lyrics.scrollTop = 0;
    // neuer Text blendet weich ein – als Web-Animation: das Neustarten einer CSS-Animation erzwang ein Layout
    lyrFade?.cancel();
    if (!matchMedia?.("(prefers-reduced-motion: reduce)").matches) lyrFade = q.inner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    showSource(got);
    noLyrFor(uri, got);
    updateLyrState();
    applyTiming(uri, got);
    // [duet 1.27] Duett-Stimmen und Hintergrundgesang (meist schon in lyrics.js erkannt; wiederholbar)
    parseVoices(got);
    voiceTint(true);
    // Stimmung der Lichtregie: eine kleine Wortliste über die Zeilen (bleibt lokal)
    party.lyrics(uri, got.synced ? got.lines : []);
    // Wort-Effekte (nur Party): Wörterbuch aufbauen und alle Zeilen durchsuchen kostet beim ersten Mal
    // ~40 ms – erst, wenn der Browser Luft hat, statt im Bild, in dem der Text erscheint (auch in Party: dort
    // spätestens nach 0,4 s; bis dahin zeigen die Zeilen einfach noch keine Wort-Effekte)
    wordPrep = () => {
      wordPrep = null;
      if (token !== lyrToken) return;
      if (cfg.partyWords && got.synced) {
        wordFx.prepare(uri, got.lines, got.lang);
        // Filter für explizite Inhalte schon jetzt nachsehen (nicht erst beim ersten derben Wort)
        explicitMode();
        // Sprache ohne eigenes Wörterbuch: einmal die englische Übersetzung holen (nur mit Online-Suche)
        if (wordFx.needsTranslation() && cfg.onlineLyrics) translateLines(uri, got, "en").then((tr) => token === lyrToken && wordFx.addTranslated(uri, tr)).catch(() => {});
      } else wordFx.prepare(uri, [], "");
    };
    whenIdle(() => wordPrep?.(), el.dataset.mode === "party" ? 400 : 1500);
    const karaoke = cfg.karaoke && got.synced;
    el.classList.toggle("is-karaoke", karaoke);
    // [playful] der verspielte Stil braucht die Wörter einzeln – auch ohne Karaoke-Füllung
    const split = karaoke || (!!cfg.lyrPlayful && got.synced);
    q.lyrics.classList.toggle("is-unsynced", !got.synced);
    const frag = document.createDocumentFragment();
    if (!got.synced) {
      const note = document.createElement("div");
      note.className = "m-im-lyrics-note is-small";
      note.textContent = t("unsynced");
      frag.append(note);
    }
    // aktuelle Zeile schon beim Bauen markieren: so hat jede Zeile ihren Endzustand ab dem ersten Stil,
    // egal wer vor dem nächsten Bild Stil oder Layout abfragt (kein Plopp der aktiven Zeile)
    const i0 = got.synced ? lineAt(got.lines, songPos(performance.now()), -2) : -9;
    const mkLine = (l, i) => {
      const d = document.createElement("div");
      // Arabisch, Hebräisch …: Schreibrichtung je Zeile aus dem Text
      d.dir = "auto";
      d.className = i === i0 ? "m-im-line is-active" : i < i0 ? "m-im-line is-past" : "m-im-line";
      if (i0 > -9) d.style.setProperty("--d", Math.min(Math.abs(i - Math.max(i0, 0)), 6));
      d.dataset.t = l.t;
      // [duet 1.27] Stimme (Farbe) und Hintergrundgesang als eigene, kleinere Zeile
      if (l.who) d.dataset.who = l.who;
      if (l.bg) d.classList.add("is-bgline");
      if (split && l.text !== "♪") {
        const box = document.createElement("span");
        box.className = "m-im-words";
        const list = [], wt = wordTimes(got.lines, i);
        // Hintergrundgesang in Klammern („(“ bis „)“, aber nicht „(x2)“) – kleiner und leiser. Steht er am Zeilenende,
        // rückt er als eigene kleine Zeile darunter (m-im-bgl). Ist die ganze Zeile Hintergrund, reicht deren Größe.
        const bgs = l.bg ? wt.map(() => false) : wt.some((w) => w.bg) ? wt.map((w) => !!w.bg) : bgFlags(wt.map((w) => w.text));
        let tail = bgs.length;
        while (tail > 0 && bgs[tail - 1]) tail--;
        const under = tail > 0 && tail < bgs.length ? document.createElement("span") : null;
        if (under) under.className = "m-im-bgl";
        wt.forEach((w, k) => {
          const s = document.createElement("span");
          s.className = bgs[k] ? "m-w is-bg" : "m-w";
          s.textContent = w.text;
          s.style.setProperty("--wi", list.length);
          const into = under && k >= tail ? under : box;
          into.append(s);
          if (w.sp !== false && k < wt.length - 1 && !(under && k === tail - 1)) into.append(" ");
          list.push({ el: s, a: w.a, b: w.b, p: -1, text: w.text, sy: w.sy || null, est: !!w.est, bg: !!bgs[k] });
          if (w.est) list.est = true;
        });
        if (under) box.append(under);
        d.append(box);
        words[i] = list;
      } else if (l.bg) d.textContent = l.text;
      else bgSplit(d, l.text, l.who === "all");
      return d;
    };
    // Zeilen in Häppchen: sofort nur bis ein Stück hinter die aktuelle Zeile (das Sichtbare), der Rest folgt in
    // Leerlaufzeiten – ein langer Wort-für-Wort-Text baute sonst alle Zeilen und Wörter im selben Bild
    // [playful] Zeilen mit einzeln gesetzten Wörtern sind im Layout teurer (Party-Messung: 24 Zeilen am Stück ~46 ms):
    // kleinere Häppchen
    const playLines = !!cfg.lyrPlayful && got.synced, stepN = playLines ? 6 : LINES_STEP;
    const first = Math.min(got.lines.length, Math.max(i0, 0) + (playLines ? 8 : LINES_FIRST));
    for (let i = 0; i < first; i++) frag.append(mkLine(got.lines[i], i));
    // mitten in einer Gleitfahrt: die (noch leere) Fläche bleibt genau dort stehen, wo sie gerade ist
    const glide = from && from !== "none";
    if (glide) snapLyrics(() => (q.inner.style.transform = from));
    q.inner.append(frag);
    // gleich an die richtige Stelle, mit der aktuellen Zeile schon hervorgehoben: der Text gleitet nicht erst
    // von oben herein, und die Zeile „ploppt“ nicht im nächsten Bild noch einmal auf
    // Erst im nächsten Bild (vor dessen Layout): so wird nur EINMAL gelayoutet statt sofort und nach den
    // folgenden Änderungen gleich noch einmal. Bis dahin wird nichts gezeichnet – die neuen Zeilen bekommen ihre
    // Klassen also trotzdem vor ihrem ersten Stil.
    if (got.synced) placeSoon(glide ? "glide" : "snap");
    else snapLyrics(() => (q.inner.style.transform = ""));
    // Übersetzung und Lautschrift erst, wenn alle Zeilen stehen (sie hängen sich an die Zeilen)
    const extras = () => {
      playfulSoon(token, true); // [playful] erst, wenn alle Zeilen stehen
      showTrBtn();
      if (cfg.translate) addTranslations(token);
      if (cfg.romanize) addRomaji(token);
    };
    const box = q.inner;
    const more = (from) => {
      if (from >= got.lines.length) return extras();
      whenIdle(() => {
        // überholt (neuer Song, besseres Ergebnis, neu geladen): nichts mehr anhängen
        if (token !== lyrToken || lyr !== got || q.inner !== box) return;
        const part = document.createDocumentFragment(), to = Math.min(got.lines.length, from + stepN);
        for (let i = from; i < to; i++) part.append(mkLine(got.lines[i], i));
        box.append(part);
        more(to);
      }, 200);
    };
    more(first);
  }
  // Kein Text (nichts gefunden, Instrumental): „Lädt …“ blendet aus, statt schlagartig zu verschwinden – erst danach
  // wird geleert und (höchstens einmal je Song, lyrlayout.js) ins Layout ohne Liedtext gewechselt. Party vergisst
  // dabei den Text des vorigen Songs (sonst plante die Lichtregie mit dessen Zeilen weiter).
  function lyricsGone(uri, got) {
    showSource(got);
    party.lyrics(uri, []);
    const finish = () => {
      // überholt: inzwischen neuer Song oder doch ein Text
      if (!el || lyr !== got || lyrUri !== uri) return;
      q.inner.textContent = "";
      noLyrFor(uri, got);
      updateLyrState();
    };
    const note = q.inner.querySelector(".m-im-lyrics-note");
    const from = note && !stillMotion() ? Number(getComputedStyle(note).opacity) : 0;
    if (!(from > 0.02)) return finish();
    note.animate([{ opacity: from }, { opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" }).finished.then(finish, finish);
  }
  // Layout mit/ohne Liedtext über den Wächter (je Song höchstens ein Wechsel, lyrlayout.js)
  function noLyrFor(uri, got) {
    if (el) setNoLyr(lyrGate.next(uri, got, el.classList.contains("is-nolyr")));
  }
  // [playful] Verspielter Stil: Klassen und Variablen einmal je Song (und noch einmal, wenn die Analyse nachkommt) –
  // im Leerlauf, weil das Wörterbuch beim ersten Mal aufgebaut wird. Danach gleitet der Text an seine neue Lage.
  let playfulKey = null, playGrade = null, playCols = "", playPre = -1, playOut = null, playSheet = null;
  // [playful] Farben aus der Bedeutung: aus den Leitfarben des Covers neu, sobald die sich ändern (je Zeilenwechsel
  // geprüft, grob gerundet – das Überblenden der Palette löst nicht bei jedem Schritt aus). Alle ≥ 4,5 : 1 (lyriccolor.js)
  function playColors() {
    if (!q.lyrics || !playGrade) return;
    const pal = imPalette();
    const key = pal.map((c) => c.map((v) => v >> 4).join(".")).join("|");
    if (key === playCols) return;
    playCols = key;
    // als eigene Stilregel (lyriccolor.colorRule): trifft nur farbige Zeilen und Wörter, nicht den ganzen Liedtext
    if (!playSheet?.isConnected) {
      playSheet = document.createElement("style");
      playSheet.id = "mirage-playful-colors";
      document.head.append(playSheet);
    }
    playSheet.textContent = colorRule(meaningColors(pal, playGrade));
    playRing = noteRing(pal);
  }
  // [playful] Im Takt, Bild für Bild aus derselben Songuhr wie die Karaoke (pos inkl. Versatz und Abgleich):
  // · ♪ in der Instrumental-Lücke wippt – Spitze genau auf jedem Schlag, ohne Knick zwischen den Schlägen, auf der Eins
  //   groß (lyricstyle.notePose) – und fließt im Takt durch die Leitfarben des Covers (noteColor, alle ≥ 4,5 : 1)
  // · ein Hook-Wort mit zweiter Schrift (--phf) wechselt sie auf der Eins jedes Takts (höchstens ein Wechsel je Takt)
  // Still bei Ruhig / Keine Blitze / weniger Bewegung (auch, wenn die Klasse am Dokument gesetzt ist)
  let playRing = null, playBar = -1;
  const playStill = () => stillMotion() || !!cfg.noFlash || document.documentElement.classList.contains("mirage-calm") || document.documentElement.classList.contains("mirage-noflash");
  function playBeat(ln, pos) {
    const d = audio.uri === lyrUri ? audio.data : null;
    const still = playStill(), lv = cfg.lyrPlayLevel;
    if (ln.classList.contains("is-p-note")) {
      // je Schlag eine Web-Animation über genau diesen Schlag (Lagen aus notePose, aus der Songuhr neu gestellt): der
      // Browser spielt sie ohne Arbeit je Bild (Bewegung auf der Grafikkarte), und jeder Schlag rastet neu ein
      const sec = pos / 1000, B = d?.beats;
      if (still || !B?.length) {
        ln.__na?.cancel();
        ln.__na = null;
        ln.__nb = -1;
        return;
      }
      let lo = 0, hi = B.length - 1, k = -1;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (B[m].t <= sec) (k = m), (lo = m + 1);
        else hi = m - 1;
      }
      if (k < 0 || k + 1 >= B.length || k === ln.__nb) return;
      ln.__nb = k;
      const t1 = B[k + 1].t, dur = (t1 - sec) * 1000;
      if (!(dur > 30 && dur < 1600)) return;
      const amp = lv === "subtle" ? 0.45 : lv === "wild" ? 1.25 : 1, N = 12, frames = [];
      for (let j = 0; j <= N; j++) {
        const at = sec + ((t1 - sec) * j) / N - (j === N ? 1e-4 : 0), P = notePose(B, d.bars, at, amp);
        if (!P) return;
        const f = { translate: `0 ${P.y.toFixed(3)}em`, rotate: P.r.toFixed(2) + "deg" };
        const c = lv !== "subtle" ? noteColor(playRing, B, d.bars, at) : null;
        if (c) f.color = `rgb(${c.join(" ")})`;
        frames.push(f);
      }
      ln.__na?.cancel();
      ln.__na = ln.animate(frames, { duration: dur, easing: "linear", fill: "forwards" });
      return;
    }
    const hw = ln.__hook === undefined ? (ln.__hook = ln.querySelector(".m-w.is-p-hook[style*='--phf']")) : ln.__hook;
    if (!hw || still || !d?.beats?.length) return;
    const sec = pos / 1000;
    let bar = -1;
    if (d.bars?.length) {
      let lo = 0, hi = d.bars.length - 1;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (d.bars[m].t <= sec) (bar = m), (lo = m + 1);
        else hi = m - 1;
      }
    } else {
      let lo = 0, hi = d.beats.length - 1, k = -1;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (d.beats[m].t <= sec) (k = m), (lo = m + 1);
        else hi = m - 1;
      }
      bar = k >= 0 ? k >> 2 : -1;
    }
    if (bar === playBar) return;
    playBar = bar;
    hw.classList.toggle("is-p-hsw", bar >= 0 && bar % 2 === 1);
  }
  // [playful] Takt: Wörter setzen mit Vorlauf ein (genau auf dem Einsatz gelandet), die nächste Zeile nimmt kurz vor
  // ihrem ersten Wort ihre Wartestellung ein. Nur Klassenwechsel beim Überschreiten der Schwellen – dieselbe Uhr wie die
  // Karaoke-Füllung (pos inkl. Versatz, je-Song-Korrektur, Tipp-Abgleich), keine Zeitgeber.
  // (Vorlauf-Zuschlag = ein Bild der gemessenen Bildschirmrate: 60 Hz ~17 ms, 144 Hz ~7 ms – lyricstyle.leadPad)
  function playMarks(ws, pos) {
    const pad = leadPad(hzNow);
    let ch = false;
    for (const w of ws || []) {
      const on = sungAt(w, pos, pad);
      if (on !== !!w.on) w.el.classList.toggle("is-sung", (w.on = on)), (ch = true);
    }
    // Schreibmarke hinter dem zuletzt gesungenen Wort (.is-pcar statt :has() im Stylesheet)
    if (ch && ws.caret) {
      let k = -1;
      for (let j = 0; j < ws.length; j++) if (ws[j].on) k = j;
      const c = k >= 0 && k < ws.length - 1 ? k : -1;
      if (c !== ws.cAt) {
        ws[ws.cAt]?.el.classList.remove("is-pcar");
        ws.cAt = c;
        if (c >= 0) ws[c].el.classList.add("is-pcar");
      }
    }
  }
  function playTick(i, pos, lines) {
    if (i >= 0) playMarks(words[i], pos);
    const j = i + 1, first = words[j]?.[0]?.a ?? lyr.lines[j]?.t;
    const want = lines[j] && first != null && pos >= first - PRE_MS ? j : -1;
    if (want !== playPre) {
      if (playPre >= 0 && playPre !== i) {
        lines[playPre]?.classList.remove("is-pnext");
        for (const w of words[playPre] || []) if (w.on) w.el.classList.remove("is-sung"), (w.on = false);
      }
      playPre = want;
      // geschätzte Wörter schon jetzt auf die Ton-Einsätze legen (sonst erst beim Aktivwerden): die vorbereitete Zeile
      // setzt ihre ersten Wörter schon ein – rückte das Legen sie danach später, sprangen sie in die Wartestellung
      // zurück und landeten ein zweites Mal (in schnellen Stellen sichtbar zu spät)
      if (want >= 0 && words[want]?.est && !words[want].snapped) snapWords(words[want], lyr.lines[want].t, lyr.lines[want + 1]?.t ?? lyr.lines[want].t + 6000);
      if (want >= 0) lines[want].classList.add("is-pnext");
    }
    if (playPre >= 0) playMarks(words[playPre], pos);
  }
  // Häppchen eines Generators in Leerlaufzeiten, je Aufruf höchstens ~6 ms (so lange der Browser Luft meldet)
  let playGen = 0;
  // perFrame (Malen): je Bild höchstens ein Häppchen – das Layout der frisch gesetzten Zeilen (Schriften, Buchstaben)
  // fällt sonst gesammelt in ein Bild (Party-Messung: 4 Zeilen auf einmal ~56 ms Layout)
  function playSlices(g, ok, done, perFrame) {
    const later = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 120 }) : setTimeout(fn, 16));
    const step = (dl) => {
      if (!ok()) return;
      const t0 = performance.now();
      let r;
      do r = g.next();
      while (!perFrame && !r.done && performance.now() - t0 < 6 && (!dl || dl.timeRemaining() > 1));
      if (r.done) done(r.value);
      else if (perFrame) requestAnimationFrame(() => later(step));
      else later(step);
    };
    if (perFrame) requestAnimationFrame(() => later(step));
    else step(null);
  }
  // Dauer der Gleitfahrt (nur am Element selbst: erbt nichts, kein Neuberechnen der Zeilen); "" = die normale 0,8 s
  function playFast(ln) {
    if (!q.inner) return;
    const d = ln?.classList.contains("is-p-fast") ? ln.style.getPropertyValue("--plt") : "";
    if (q.inner.style.transitionDuration !== d) q.inner.style.transitionDuration = d;
  }
  function playfulSoon(token, fresh, after) {
    // frisch aufgebaute Zeilen (auch derselbe Text nach dem Umschalten) brauchen ihre Klassen neu
    if (fresh) playfulKey = null;
    const run = () => {
      if (token !== lyrToken || !q.lyrics) return;
      const on = !!cfg.lyrPlayful && !!lyr?.synced && !!lyr.lines?.length;
      const level = ["subtle", "wild"].includes(cfg.lyrPlayLevel) ? cfg.lyrPlayLevel : "playful";
      q.lyrics.classList.toggle("is-playful", on);
      el.classList.toggle("is-plyr", on);
      q.lyrics.classList.toggle("is-lv-subtle", on && level === "subtle");
      q.lyrics.classList.toggle("is-lv-wild", on && level === "wild");
      playPre = -1;
      after?.();
      if (!on) return;
      // Anzeige-Schriften erst jetzt (und nie bei „Dezent“: dort keine Schriftmischung)
      if (level !== "subtle") loadPlayfulFonts();
      const d = audio.uri === lyrUri ? audio.data : null;
      // derbe Wörter wie in Party (Einstellung und Spotifys Filter); ohne Bewegung keine Wortbilder und Buchstaben
      const ex = explicitMode(), still = stillMotion() || !!cfg.noFlash;
      if (playfulKey?.lyr === lyr && playfulKey.d === d && playfulKey.ex === ex && playfulKey.still === still && playfulKey.level === level) return;
      playfulKey = { lyr, d, ex, still, level };
      // in Häppchen: erst planen, dann malen – die Zeilen um die aktive zuerst. Am Ende (im Leerlauf, wenn das
      // Layout schon steht) an die neue Lage gleiten: kein erzwungenes Layout des ganzen Texts mitten im Bild
      const gen = ++playGen, box = q.inner, ok = () => gen === playGen && token === lyrToken && q.inner === box;
      playSlices(planSteps(lyr.lines, words, d, { lexicon: LEX, neg: NEG, explicit: ex, still, level, seed: lyrUri }), ok, (plan) => {
        playGrade = plan.deck?.grade || null;
        playCols = "";
        playColors();
        playSlices(paintSteps(box.children, plan, words, active >= 0 ? active : lineAt(lyr.lines, songPos(performance.now()), -2)), ok, () => whenIdle(() => ok() && placeSoon("glide"), 300), true);
      });
    };
    if (!cfg.lyrPlayful) return run();
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 400 });
    else setTimeout(run, 120);
  }
  // [playful] „Ruhig“, „Keine Blitze“, weniger Bewegung oder die Stärke mitten im Song umgestellt: sofort neu planen und
  // malen (Buchstaben und Wortbilder weg bzw. wieder da, Vorlauf 0 bzw. wieder an) – playfulSoon tut nichts, wenn sich
  // nichts geändert hat (Schlüssel aus Liedtext, Analyse, Stufe, Stillstand)
  function playfulRestyle() {
    if (!el || !cfg.lyrPlayful || !lyr?.synced || !playfulKey) return;
    const level = ["subtle", "wild"].includes(cfg.lyrPlayLevel) ? cfg.lyrPlayLevel : "playful";
    if (playfulKey.still === (stillMotion() || !!cfg.noFlash) && playfulKey.level === level && playfulKey.ex === explicitMode()) return;
    playfulSoon(lyrToken);
  }
  reducedMotion.addEventListener?.("change", playfulRestyle);
  // [playful] Taste V und Zeile im Menü „Mehr“: den Stil live umschalten, ohne den Liedtext neu zu laden. Stehen die
  // Wörter schon einzeln (Karaoke oder Stil war an), reicht Klasse an/aus – die Klassen der Zeilen bleiben gemalt und
  // wirken nur unter .is-playful, ein zweites Einschalten ist also sofort da. Sonst wird der vorhandene Text einmal mit
  // einzelnen Wörtern neu aufgebaut (derselbe Text, kein neues Laden). → neuer Zustand
  function togglePlayful() {
    cfg.lyrPlayful = !cfg.lyrPlayful;
    save();
    if (!el || !isOpen() || !lyr?.synced || !LYR.has(el.dataset.mode)) return cfg.lyrPlayful;
    if (!cfg.lyrPlayful) {
      // ♪ und Hook-Wort stehen still, die Zeilen bekommen ihre normale Dauer zurück
      if (activeEl?.__na) (activeEl.__na.cancel(), (activeEl.__na = null), (activeEl.__nb = -1));
      activeEl?.querySelector(".is-p-hsw")?.classList.remove("is-p-hsw");
      playOut?.classList.remove("is-pout");
      playOut = null;
      if (playPre >= 0) q.inner.children[playPre]?.classList.remove("is-pnext");
      playFast(null);
    }
    if (cfg.lyrPlayful && !words.some(Boolean)) {
      showLyrics(lyrUri, lyr, true);
      return true;
    }
    // sobald die Klasse sitzt: neue Größen – Lagen neu messen und an die richtige Stelle gleiten (auch playOn usw. neu)
    playfulSoon(lyrToken, false, () => placeSoon("glide"));
    return cfg.lyrPlayful;
  }
  // Zeile ohne Karaoke: Teile in Klammern (Hintergrundgesang) als eigenes, leiseres Stück – am Zeilenende als
  // kleine Zeile darunter. Etiketten wie „(x2)“ bleiben normaler Text. all: Duett „zusammen“ – der Text steckt
  // in einem eigenen Stück, damit der Farbverlauf aus beiden Stimmen nur so breit wie der Text ist.
  function bgSplit(d, text, all) {
    const parts = bgParts(text);
    if (!parts.some((p) => p.bg) && !all) return (d.textContent = text);
    while (parts.length > 1 && !parts[parts.length - 1].text.trim()) parts.pop();
    const lastMain = parts.findLastIndex((p) => !p.bg);
    parts.forEach((p, k) => {
      const s = document.createElement("span");
      s.className = p.bg ? (k > lastMain && lastMain >= 0 && parts[lastMain].text.trim() ? "is-bg m-im-bgl" : "is-bg") : all ? "m-im-all" : "";
      s.textContent = p.bg || k < lastMain ? p.text : p.text.trimEnd();
      d.append(s);
    });
  }
  // [duet 1.27] Stimmfarben (--m-v1 … --m-v3) aus der Coverfarbe an der Liedtext-Fläche – nur bei Duetten und nur,
  // wenn sich die Farbe sichtbar ändert (beim Songwechsel blendet die Palette über: höchstens alle 0,4 s neu).
  // Die Zeilen haben einen Farbübergang, also gleitet auch das.
  let tintKey = "", tintAt = 0;
  function voiceTint(force) {
    if (!q.lyrics || !lyr?.voices || !lyr.lines?.length) return;
    const now = performance.now();
    if (!force && now - tintAt < 400) return;
    tintAt = now;
    if (lyr.duet === undefined) lyr.duet = lyr.lines.some((l) => l.who);
    if (!lyr.duet) return;
    const pal = imPalette();
    const key = pal.map((c) => c.map((v) => v >> 3).join(",")).join(";");
    if (key === tintKey) return;
    tintKey = key;
    voiceColors(pal).forEach((c, k) => {
      q.lyrics.style.setProperty(`--m-v${k + 1}`, `rgb(${c.join(",")})`);
      q.lyrics.style.setProperty(`--m-v${k + 1}-rgb`, c.join(","));
    });
  }
  // Lautschrift unter die Zeilen (Koreanisch selbst, Japanisch von NetEase oder aus Kana, Chinesisch per Wörterbuch,
  // Kyrillisch, Griechisch und Hindi aus Tabellen)
  async function addRomaji(token) {
    const got = lyr, item = currentItem();
    if (!got?.lines?.length || got.instrumental) return;
    const sc = scriptOf(got.lines);
    if (!sc) return;
    let rom = null;
    if (sc === "ko") rom = got.lines.map((l) => hangul(l.text));
    else if (sc === "zh") rom = await pinyinLines(got.lines.map((l) => l.text));
    // Kyrillisch, Griechisch, Hindi: aus Tabellen (die Sprachangabe der Quelle hilft bei Kyrillisch)
    else if (sc !== "ja") rom = translitLines(sc, got.lines.map((l) => l.text), got.lang);
    else {
      const ne = got.rom?.length ? got.rom : await romajiFor(item);
      rom = got.lines.map((l) => {
        // die Romaji-Zeile mit der nächstgelegenen Zeit (höchstens 1,5 s daneben), sonst selbst aus Kana
        let best = null;
        for (const r of ne) if (!best || Math.abs(r.t - l.t) < Math.abs(best.t - l.t)) best = r;
        return best && Math.abs(best.t - l.t) < 1500 && got.synced ? best.text : kana(l.text);
      });
    }
    if (token !== lyrToken || !rom || !cfg.romanize) return;
    const lines = q.inner.querySelectorAll(".m-im-line");
    rom.forEach((text, i) => {
      if (!text || text === "♪" || !lines[i] || lines[i].querySelector(".m-im-rom") || text === got.lines[i].text) return;
      const d = document.createElement("span");
      d.className = "m-im-rom";
      d.textContent = text;
      lines[i].insertBefore(d, lines[i].querySelector(".m-im-tr"));
    });
    relayLyrics();
  }

  /* ---- Timing von Hand: im Liedtext E drücken, dann Enter, wenn eine Zeile beginnt (gespeichert je Song) */
  const TIMING = "mirage:lyrTiming";
  const timings = () => {
    try {
      return JSON.parse(localStorage.getItem(TIMING) || "{}") || {};
    } catch {
      return {};
    }
  };
  function applyTiming(uri, got) {
    const saved = timings()[uri];
    if (!saved || got.timed || saved.n !== got.lines.length || !got.synced) return;
    got.lines.forEach((l, i) => shiftLine(l, saved.t[i] - l.t));
    got.timed = true;
  }
  // eine Zeile verschieben – ihre Wortzeiten (Karaoke) gehen mit
  function shiftLine(l, d) {
    if (!d || !Number.isFinite(d)) return;
    l.t0 ??= l.t;
    l.t += d;
    for (const w of l.words || []) w.t += d;
  }
  let edit = null;
  function toggleTiming() {
    if (!el || !lyr?.synced || !lyr.lines?.length || !LYR.has(el.dataset.mode)) return S.showNotification?.(t("timingNone"), true, 2500);
    if (edit) return finishTiming(true);
    edit = { i: Math.max(0, active + 1), undo: [] };
    el.classList.add("is-timing");
    const bar = document.createElement("div");
    bar.className = "m-im-timing";
    bar.setAttribute("role", "status");
    const txt = document.createElement("span");
    txt.textContent = t("timingHint");
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = t("timingReset");
    reset.onclick = (e) => {
      e.stopPropagation();
      resetTiming();
    };
    const done = document.createElement("button");
    done.type = "button";
    done.textContent = t("timingDone");
    done.onclick = (e) => {
      e.stopPropagation();
      finishTiming(true);
    };
    bar.append(txt, reset, done);
    el.append(bar);
    markEdit();
  }
  function markEdit() {
    q.inner.querySelectorAll(".m-im-line.is-next").forEach((x) => x.classList.remove("is-next"));
    q.inner.querySelectorAll(".m-im-line")[edit?.i]?.classList.add("is-next");
  }
  // Enter: die markierte Zeile beginnt JETZT; die Zeilen danach rücken um denselben Betrag mit
  function timingKey(code) {
    if (!edit) return false;
    if (code === "Enter" || code === "NumpadEnter") {
      const l = lyr?.lines?.[edit.i];
      if (!l) return finishTiming(true), true;
      // Enter kommt mit der Reaktionszeit (~150 ms) nach dem gehörten Einsatz
      const d = Math.round(songPos() - 150) - l.t;
      edit.undo.push({ i: edit.i, d });
      for (let k = edit.i; k < lyr.lines.length; k++) shiftLine(lyr.lines[k], d);
      const prev = lyr.lines[edit.i - 1];
      if (prev && l.t <= prev.t) shiftLine(l, prev.t + 50 - l.t);
      q.inner.querySelectorAll(".m-im-line").forEach((x, k) => (x.dataset.t = lyr.lines[k]?.t ?? x.dataset.t));
      edit.i++;
      active = -2;
      markEdit();
      return true;
    }
    if (code === "Backspace") {
      const u = edit.undo.pop();
      if (u) {
        for (let k = u.i; k < lyr.lines.length; k++) shiftLine(lyr.lines[k], -u.d);
        edit.i = u.i;
        active = -2;
        markEdit();
      }
      return true;
    }
    if (code === "Escape") return finishTiming(true), true;
    return false;
  }
  function finishTiming(keep) {
    if (!edit) return;
    const changed = edit.undo.length > 0;
    edit = null;
    el.classList.remove("is-timing");
    el.querySelector(".m-im-timing")?.remove();
    markEdit();
    if (!keep || !changed) return;
    if (!lyrUri || !lyr?.lines?.length) return;
    const all = timings();
    all[lyrUri] = { n: lyr.lines.length, t: lyr.lines.map((l) => l.t) };
    // höchstens 150 Songs merken
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 150))) delete all[k];
    try {
      localStorage.setItem(TIMING, JSON.stringify(all));
    } catch {}
    S.showNotification?.(t("timingSaved"), false, 2200);
    lyrUri = "";
    loadLyrics();
  }
  function resetTiming() {
    const all = timings();
    delete all[lyrUri];
    try {
      localStorage.setItem(TIMING, JSON.stringify(all));
    } catch {}
    for (const l of lyr?.lines || []) if (l.t0 != null) shiftLine(l, l.t0 - l.t);
    if (lyr) lyr.timed = false;
    edit && (edit.undo = []);
    finishTiming(false);
    S.showNotification?.(t("timingCleared"), false, 2200);
    lyrUri = "";
    loadLyrics();
  }
  // Übersetzung unter die Zeilen hängen; der Token verwirft Antworten zu einem älteren Song
  async function addTranslations(token) {
    const uri = lyrUri, got = lyr;
    if (!got?.lines?.length || got.instrumental) return;
    const tr = await translateLines(uri, got, LANG);
    if (token !== lyrToken || !tr || !trOn(uri)) return;
    const lines = q.inner.querySelectorAll(".m-im-line");
    tr.forEach((text, i) => {
      if (!text || !lines[i] || lines[i].querySelector(".m-im-tr") || text.toLowerCase() === got.lines[i].text.toLowerCase()) return;
      const d = document.createElement("span");
      d.className = "m-im-tr";
      d.textContent = text;
      lines[i].append(d);
    });
    relayLyrics();
  }
  // Zeilen sind höher geworden (Übersetzung, Lautschrift): sofort neu ausrichten – die aktuelle Zeile bleibt
  // genau stehen, statt erst mit den Zeilen darüber wegzuspringen und dann zurückzugleiten
  function relayLyrics() {
    const cur = lyr?.synced && active > -2 && q.inner.children[Math.max(active, 0)];
    if (!cur) return void (active = -2);
    snapLyrics(() => (q.inner.style.transform = `translateY(${q.lyrics.clientHeight * 0.42 - (cur.offsetTop + cur.offsetHeight / 2)}px)`));
  }
  // Knopf nur, wenn es etwas zu übersetzen gibt (Text da, Sprache nicht schon die eigene)
  const canTranslate = () => !!lyr?.lines?.length && !lyr.instrumental && (lyr?.lang || "").slice(0, 2).toLowerCase() !== LANG;
  function showTrBtn() {
    const on = trOn(lyrUri);
    q.trbtn.hidden = !canTranslate();
    q.trbtn.classList.toggle("is-on", on);
    q.trbtn.setAttribute("aria-pressed", String(on));
    q.trbtn.title = t(on ? "trHide" : "trShow");
    // nur für diesen Song an (für alle aus): showLyrics fragt nur den Schalter für alle – hier nachholen
    if (on && !cfg.translate && canTranslate() && !q.inner.querySelector(".m-im-tr")) addTranslations(lyrToken);
  }
  // Übersetzung: ein Schalter für alle Songs (cfg.translate), je Song abweichend (cfg.translateSongs[uri])
  const trOn = (uri) => (typeof cfg.translateSongs?.[uri] === "boolean" ? cfg.translateSongs[uri] : !!cfg.translate);
  function setTrSong(uri, v) {
    const all = { ...(cfg.translateSongs || {}) };
    delete all[uri];
    if (v !== !!cfg.translate) all[uri] = v;
    const keys = Object.keys(all);
    if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete all[k];
    cfg.translateSongs = all;
  }
  function applyTr() {
    save();
    showTrBtn();
    if (trOn(lyrUri)) addTranslations(lyrToken);
    else {
      q.inner.querySelectorAll(".m-im-tr").forEach((n) => n.remove());
      relayLyrics();
    }
    if (side === "menu") rebuildMenu();
  }
  // Ein Klick schaltet die Übersetzung für alle Songs – und sagt das; „Nur dieser Song“ nimmt es für die anderen
  // zurück. Hat dieser Song schon eine eigene Wahl, schaltet der Klick nur sie.
  function toggleTranslate() {
    const uri = lyrUri, now = trOn(uri);
    if (typeof cfg.translateSongs?.[uri] === "boolean") {
      setTrSong(uri, !now);
      applyTr();
      return imToast(t(!now ? "trSongOn" : "trSongOff"));
    }
    cfg.translate = !now;
    applyTr();
    imToast(t(!now ? "trAllOn" : "trAllOff"), [[t("trOnlySong"), () => {
      cfg.translate = now;
      setTrSong(uri, !now);
      applyTr();
      imToast(t(!now ? "trSongOn" : "trSongOff"));
    }]], 6000);
  }

  // Fortschritt eines Worts 0..1 (Anteil der gefüllten Buchstaben): mit Silbenzeiten stückweise je Silbe
  function wordProgress(w, pos) {
    const sy = w.sy;
    if (!sy?.length) return clamp((pos - w.a) / (w.b - w.a), 0, 1);
    if (pos < sy[0].a) return 0;
    let j = 0;
    while (j + 1 < sy.length && sy[j + 1].a <= pos) j++;
    const end = sy[j + 1]?.a ?? w.b;
    const f = clamp((pos - sy[j].a) / Math.max(40, end - sy[j].a), 0, 1);
    return sy[j].f0 + (sy[j].f1 - sy[j].f0) * f;
  }
  // Fremde Liedtexte (LRCLIB, NetEase, Kugou) stammen oft von einer anderen Fassung: um ein paar hundert ms
  // verschoben oder leicht gestreckt. Einmal je Ergebnis, sobald die Analyse da ist: Versatz und Streckung,
  // bei denen die Zeilen- und Wortanfänge am besten auf Gesangs-Einsätze fallen (lyricsync.js) – übernommen
  // nur bei hoher Sicherheit. Spotifys eigene Zeiten gehören zu genau dieser Aufnahme und bleiben; ein von Hand
  // gesetztes Timing (Taste E) hat immer das letzte Wort. Das Takt-Antippen (T) wirkt zusätzlich über die Songuhr.
  function alignLyrics() {
    // „Automatische Verschiebung zurücknehmen“ (Fassung wählen) gilt für diesen Song auch künftig
    if (!lyr?.synced || lyr.aligned || lyr.source === "spotify" || lyr.timed || edit) return;
    const d = audio.data;
    if (!d?.segs?.length || audio.uri !== lyrUri || d.synthetic) return;
    lyr.aligned = true;
    // je Song abschaltbar (setAutoSync in lyrics.js); Schlagabstand gegen Takt-Raster-Treffer, einige Quellen
    // (Abstimmung, lyricvote.js) brauchen keinen Abgleich. Ergebnis für die Diagnose in lyr.diag.auto
    const r = cfg.syncNoAuto?.[lyrUri] ? { apply: false, off: 0, scale: 1, conf: 0, why: "off" } : estimateSync(lyr.lines, d.segs, { beat: d.bpm > 0 ? 60000 / d.bpm : 0, agree: lyr.diag?.cluster || 0 });
    lyr.diag ||= { source: lyr.source || "", id: null, candidates: 1, cluster: 1, spotifyOverruled: false, shifted: 0, auto: null };
    lyr.diag.auto = { off: r.off, scale: r.scale, conf: Math.round(r.conf * 100) / 100, applied: !!r.apply, why: r.why };
    if (!r.apply) return;
    applySync(lyr.lines, r);
    lyr.sync = { off: r.off, scale: r.scale };
    const map = (x) => x * r.scale + r.off;
    for (const list of words) for (const w of list || []) {
      w.a = map(w.a);
      w.b = map(w.b);
      for (const s of w.sy || []) s.a = map(s.a);
    }
    q.inner.querySelectorAll(".m-im-line").forEach((x, k) => lyr.lines[k] && (x.dataset.t = lyr.lines[k].t));
  }

  // Merkzettel: Mitte jeder Zeile und Höhe des Liedtext-Fensters. Ungültig, sobald sich eine Größe ändert
  // (Schrift geladen, Übersetzung, Fenstergröße, neuer Liedtext) – das meldet ein ResizeObserver ohne Messen.
  let lyrGeo = null, lyrRO = null;
  function lyrScrollY(lines, i, fresh) {
    if (!lyrRO && typeof ResizeObserver === "function") lyrRO = new ResizeObserver(() => (lyrGeo = null));
    if (lyrRO && lyrRO.el !== q.inner) {
      lyrRO.disconnect();
      lyrRO.observe(q.inner);
      lyrRO.observe(q.lyrics);
      lyrRO.el = q.inner;
      lyrGeo = null;
    }
    if (fresh || !lyrRO || !lyrGeo || lyrGeo.mid.length !== lines.length) {
      const hh = [];
      lyrGeo = { h: q.lyrics.clientHeight, hh, mid: Array.from(lines, (ln) => (hh.push(ln.offsetHeight), ln.offsetTop + ln.offsetHeight / 2)) };
    }
    let c = lyrGeo.h * 0.42;
    // [playful] die aktive Zeile steht nie im Ausblend-Rand der Textfläche (Masken in user.css: Liedtext/Mix 16 %/80 %,
    // Party 16 %/86 %, im verspielten Stil 18 %/82 %) – mit Reserve für Vergrößerung, Kippen und große Schlüsselwörter.
    // 1.33: in der Party auch im normalen Stil (dort ist die Fläche niedrig: eine zweireihige Zeile lief sonst hinein)
    const party = el.dataset.mode === "party";
    if ((party || q.lyrics.classList.contains("is-playful")) && lyrGeo.hh[i]) {
      const half = (lyrGeo.hh[i] * (party ? 1.12 : 1.05)) / 2 + lyrGeo.hh[i] * 0.08 + 6;
      const top = lyrGeo.h * (party ? 0.18 : 0.16) + half, bot = lyrGeo.h * (party ? 0.82 : 0.8) - half;
      c = top <= bot ? Math.min(bot, Math.max(top, c)) : (top + bot) / 2;
    }
    return c - lyrGeo.mid[i];
  }

  // Liedtext im nächsten Bild ausrichten – wer zuerst zeichnet (frame oder dieser Rückruf), richtet aus.
  // how = "snap": sofort an die Stelle · "glide": von der jetzigen Stelle weitergleiten · after: danach ausführen
  let lyrSnap = null;
  function placeSoon(how, after) {
    lyrSnap = { how, after };
    requestAnimationFrame(() => lyrSnap && el && LYR.has(el.dataset.mode) && drawLyrics(songPos(performance.now())));
  }
  // Position der Textfläche ohne Gleitfahrt setzen. Nur die Fläche selbst (Stil direkt am Element): eine
  // Klasse am Container würde alle Zeilen und Wörter zweimal neu berechnen lassen.
  function snapLyrics(fn) {
    q.inner.style.transition = "none";
    fn();
    void getComputedStyle(q.inner).opacity; // nur Stil auflösen (Deckkraft braucht kein Layout)
    q.inner.style.transition = "";
  }
  // snap: frisch aufgebauter Text steht sofort an seiner Stelle, statt hinzugleiten. Die neuen Zeilen bekommen
  // ihre Klassen vor ihrem ersten Stil – sie starten also ohnehin ohne Übergang im Endzustand (kein Plopp).
  function drawLyrics(pos, snap) {
    if (!lyr?.synced) return;
    voiceTint();
    const pend = lyrSnap;
    if (pend) {
      lyrSnap = null;
      if (pend.how === "snap") snap = true;
      active = -2;
    }
    alignLyrics();
    const lines = q.inner.children;
    // kleine Rücksprünge der Uhr (Pause, Nachjustieren) lassen die eben begonnene Zeile stehen (songtime.js)
    const i = lineAt(lyr.lines, pos, active);
    if (snap) q.inner.style.transition = "none";
    if (i !== active) {
      const was = active;
      active = i;
      // Party lässt die aktive Zeile im Takt hüpfen (style.scale) – die alte Zeile wieder freigeben
      if (activeEl) activeEl.style.scale = "";
      // [playful] der alte ♪ steht wieder still, das alte Hook-Wort kehrt zu seiner Schrift zurück
      if (activeEl?.__na) (activeEl.__na.cancel(), (activeEl.__na = null), (activeEl.__nb = -1));
      activeEl?.querySelector(".is-p-hsw")?.classList.remove("is-p-hsw");
      playBar = -1;
      activeEl?.classList.remove("is-hype");
      // [playful] die alte Zeile gibt ihre gesungenen Wörter frei (kommt man zurück, landen sie wieder)
      if (playOn) for (const w of words[was] || []) if (w.on) w.el.classList.remove("is-sung"), (w.on = false);
      activeEl = lines[i] || null;
      playOn = !!activeEl && !!cfg.lyrPlayful && q.lyrics.classList.contains("is-playful");
      // [playful] die vorbereitete Zeile ist jetzt die aktive (ihre schon gesungenen Wörter bleiben gelandet)
      if (playPre === i) {
        activeEl?.classList.remove("is-pnext");
        playPre = -1;
      }
      // [playful] Abgang: die eben gesungene Zeile (direkt vor der neuen) – Klasse statt :has(+ .is-active)
      playOut?.classList.remove("is-pout");
      playOut = playOn && i > 0 && was === i - 1 ? lines[was] : null;
      playOut?.classList.add("is-pout");
      if (playOn) playColors();
      // [playful] kurze Zeile: die Gleitfahrt des Texts so lang wie ihr Farbwechsel (--plt aus lyricstyle.js)
      playFast(playOn ? activeEl : null);
      // [playful] Wippen, Schlag-Stoß und hüpfende Wortbilder im Takt: Länge und Lage des Schlags einmal je Zeile
      // (CSS-Animation, kein Rechnen im Bild)
      const bp = playOn && audio.uri === lyrUri ? beatPhase(audio.data?.beats, pos / 1000) : null;
      if (bp) activeEl.style.setProperty("--pb", bp.p + "ms"), activeEl.style.setProperty("--pbd", bp.d + "ms");
      lastBounce = "";
      hypeOn = !!activeEl && cfg.partyHype && el.dataset.mode === "party" && hype.has(i);
      activeEl?.classList.toggle("is-hype", hypeOn);
      if (i >= 0 && cfg.partyWords && el.dataset.mode === "party" && wordFx.uri === lyrUri) {
        const ln = lyr.lines[i], wt = words[i]?.length ? words[i].map((w) => ({ text: w.text, a: w.a, b: w.b })) : wordTimes(lyr.lines, i);
        wordFx.onLine(i, wt, ln.t, lyr.lines[i + 1]?.t ?? ln.t + 6000, activeEl);
      }
      // erst jetzt sind die Taktdaten sicher geladen: geschätzte Wörter auf die Ton-Einsätze legen
      if (words[i]?.est && !words[i].snapped) snapWords(words[i], lyr.lines[i].t, lyr.lines[i + 1]?.t ?? lyr.lines[i].t + 6000);
      // Lage der Zeile aus dem Merkzettel – gelesen, bevor unten Klassen wechseln. Früher erzwang das Auslesen
      // nach dem Umstellen bei jedem Zeilenwechsel (und bei jedem Spulen) 8–20 ms Stil- und Layout-Rechnung.
      const full = was < -1 || was >= lines.length;
      const cur = lines[Math.max(i, 0)], y = cur ? lyrScrollY(lines, Math.max(i, 0), full) : 0;
      // nur die Zeilen anfassen, deren Zustand sich ändert: zwischen alter und neuer Zeile ±6 (so weit reicht --d);
      // frisch aufgebauter Liedtext (active = -2): einmal alle
      const k0 = full ? 0 : Math.max(0, Math.min(was, i) - 6), k1 = full ? lines.length - 1 : Math.min(lines.length - 1, Math.max(was, i) + 6);
      for (let k = k0; k <= k1; k++) {
        const ln = lines[k];
        ln.classList.toggle("is-active", k === i);
        ln.classList.toggle("is-past", k < i);
        ln.style.setProperty("--d", Math.min(Math.abs(k - Math.max(i, 0)), 6));
      }
      if (cur) q.inner.style.transform = `translateY(${y}px)`;
      // 1.33: die Lage oben kommt aus der Höhe der Zeile, BEVOR sie aktiv wurde. In der Party (und im verspielten Stil)
      // ist die aktive Zeile größer gesetzt und bricht oft in eine Reihe mehr um – dann ragte sie in den Ausblendrand
      // (oben/unten „verschwommen“). Im nächsten Bild – das Layout ist dann frisch, Lesen kostet nichts – mit der echten
      // Höhe nachmessen und, falls nötig, nachrücken (gleitet mit). Einmal je Zeilenwechsel.
      if (cur && i >= 0 && (el.dataset.mode === "party" || q.lyrics.classList.contains("is-playful"))) {
        const want = i;
        requestAnimationFrame(() => {
          if (active !== want || !cur.isConnected) return;
          // wuchs die Zeile, hat der ResizeObserver den Merkzettel schon verworfen: frisch messen (Layout ist sauber)
          const y2 = lyrScrollY(lines, want, !lyrGeo || Math.abs(cur.offsetHeight - (lyrGeo.hh[want] || 0)) > 1);
          if (Math.abs(y2 - y) > 1) q.inner.style.transform = `translateY(${y2}px)`;
        });
      }
    }
    if (snap) {
      void getComputedStyle(q.inner).opacity; // nur Stil auflösen (Deckkraft braucht kein Layout)
      q.inner.style.transition = "";
    }
    pend?.after?.();
    // [playful] Einsätze mit Vorlauf und die vorbereitete nächste Zeile
    if (cfg.lyrPlayful && q.lyrics.classList.contains("is-playful")) {
      playTick(i, pos, lines);
      if (activeEl) playBeat(activeEl, pos);
    }
    // Karaoke: nur die Wörter der aktuellen Zeile, und nur wenn sich ihr Stand sichtbar ändert
    const ws = i >= 0 && words[i];
    if (ws) {
      for (const w of ws) {
        const p = Math.round(wordProgress(w, pos) * 100) / 100;
        if (p !== w.p) {
          w.p = p;
          w.el.style.setProperty("--p", p);
        }
      }
    }
  }

  function drawViz(pos, now) {
    if (!vw) sizeCanvas();
    // minimiert bzw. 0 px breit: nichts zu zeichnen (sonst wird dpr = 0/0 und der Verlauf wirft)
    if (!vw || !vh || !innerWidth) return;
    // Unter hoher Grafiklast (Spiel im Vordergrund, Treiber-Neustart) kann Chromium die Zeichenfläche
    // verlieren: dann bleibt der Canvas leer, ganz ohne Fehlermeldung. Kommt sie nicht binnen 1 s
    // von selbst zurück, mit einem frischen Canvas neu anfangen.
    if (vctx.isContextLost?.()) {
      if (!lostSince) lostSince = now;
      else if (now - lostSince > 1000) freshCanvas();
      return;
    }
    lostSince = 0;
    const N = cfg.vizBars;
    if (vals.length !== N || !Number.isFinite(vals[0])) {
      vals = new Float32Array(N);
      targets = new Float32Array(N);
    }
    // zeitbasiert: gleich weich bei 60, 120 oder 144 Hz
    const dt = Math.min(0.05, lastVizT ? (now - lastVizT) / 1000 : 0.016);
    lastVizT = now;
    const ctx = vctx;
    ctx.clearRect(0, 0, vw, vh);
    const dpr = vw / innerWidth;
    if (!vizRect.r || vizRect.n++ % 30 === 0 || now < vizMoveUntil) {
      // ohne Puls und Pendeln messen: sonst springt der Kranz alle 30 Bilder auf die gerade gemessene Pulsgröße
      // beim Ansichtswechsel wächst bzw. schrumpft das Cover (morphMode): dann die gezeigte Größe ohne den Puls
      const b0 = q.wrap.getBoundingClientRect(), ps = now < morphUntil ? parseFloat(q.wrap.style.scale) || 1 : 0;
      const w0 = ps ? b0.width / ps : q.wrap.offsetWidth || b0.width, h0 = ps ? b0.height / ps : q.wrap.offsetHeight || b0.height;
      const [sx = 0, sy = 0] = (q.wrap.style.translate || "").split(" ").map(parseFloat);
      const mx = b0.left + b0.width / 2 - (sx || 0), my = b0.top + b0.height / 2 - (sy || 0);
      vizRect.r = { left: mx - w0 / 2, top: my - h0 / 2, width: w0, height: h0 };
      // Unterkante der Kopfleiste (Reiter, Knöpfe): bis dorthin darf der Kranz reichen, nicht hinein
      vizRect.head = el.querySelector(".m-im-tabs")?.getBoundingClientRect().bottom || 0;
      // Kamera-Stoß zoomt den Canvas um die Cover-Mitte, nicht um die Bildschirmmitte
      const o = `${Math.round(vizRect.r.left + vizRect.r.width / 2)}px ${Math.round(vizRect.r.top + vizRect.r.height / 2)}px`;
      if (q.canvas.style.transformOrigin !== o) q.canvas.style.transformOrigin = o;
    }
    const r = vizRect.r;
    // Mitte und Größe folgen dem Cover in jedem Bild: Wackeln (translate) und Puls (scale) sind bekannt, ohne neu zu messen
    const cx = (r.left + r.width / 2 + shakeX) * dpr, cy = (r.top + r.height / 2 + shakeY) * dpr;
    const R = (r.width / 2) * pulseS * dpr + 16 * dpr;
    const sec = pos / 1000;
    const playing = PLR.isPlaying();
    let b = 0, havePitch = false, loud = 0.5;
    // Stil aus den Einstellungen; im Mix keine Linie quer durch den Liedtext, im Party-Modus das Song-Profil
    const mode = el.dataset.mode;
    const V = { style: cfg.vizStyle, mirror: cfg.vizMirror, height: cfg.vizHeight / 100, glow: cfg.vizGlow, rings: cfg.vizRings, spin: cfg.vizSpin, pulse: 0.035, ring: 1 };
    // (Party ebenso: dort stehen Liedtext und Bühne quer durchs Bild)
    if ((mode === "mix" || mode === "party") && V.style === "line") V.style = "wave";
    const px = mode === "party" ? party.step(sec, dt, playing) : null;
    wfxGeo = px ? { cx, cy, R, dpr, px } : null;
    if (!px) shakeX = shakeY = 0;
    // Mix: dieselben Instrumentenspuren wie Party, nur dezent (Puls und Kranz auf der echten Kick)
    const mixInst = mode === "mix" && cfg.mixInstruments ? party.step(sec, dt, playing) : null;
    // Visualizer-Ansichten folgen derselben Lichtregie: Farbe des Teils, Energie, Drop, langsamer im Break
    const mood = px ? null : party.mood(sec, playing);
    if (mood) V.height *= 0.86 + 0.18 * mood.I;
    if (px) partyExtras(px, now, dt, R, dpr);
    curInst = px && cfg.partyInstruments && px.fx ? instruments.at(sec, dt, px, lightMode()) : null;
    // Gitarrenblitze brauchen die Freigabe der Blitz-Schranke auch in leisen Stellen
    party.stageFlash = (curInst?.guitar || 0) > 0.3;
    if (sonicDbg) sonicLegend(now);
    // ruhig = wenig Energie, kein Aufbau, kein Drop in Sicht → mit 30 Bildern/s ist es nicht zu unterscheiden
    // erst nach 3 s Ruhe und nie in den ersten 8 s eines Songs: sonst fiel genau der Übergang (leises Intro)
    // auf 30 Bilder/s, und kurze leise Takte schalteten ständig hin und her – das wirkte wie Ruckeln
    // … und nur, solange kein Effekt läuft (Lichtwisch, Klang-Effekt, Moment der Regie): Bewegung bei 30 Bildern/s ruckelt
    const fxRun = !!px && (px.wipe >= 0 || !!curInst?.sfx?.length || (px.scn && (px.scn.dx > 0.01 || px.scn.mod > 0.01 || px.scn.back > 0.01 || px.scn.open > 0.01 || px.scn.echo > 0.01)));
    const rawQuiet = !!px && px.energy < 0.25 && px.build < 0.1 && px.toDrop > 5 && !px.drop && !fxRun;
    if (!rawQuiet) quietSince = 0;
    else if (!quietSince) quietSince = now;
    quietNow = rawQuiet && now - quietSince > 3000 && now - songAt > 8000;
    if (px && (ecoOn() || lightMode())) quality.level = Math.min(quality.level, 1);
    if (px) {
      const P = px.P;
      Object.assign(V, {
        // Visualizer-Einstellungen gelten auch hier: Schein, Ringe und Spiegeln schaltet man selbst ab; Drehen kommt
        // vom Song-Profil oder aus der Einstellung (früher überschrieb das Profil alle vier)
        mirror: cfg.vizMirror !== false && P.mirror !== false, spin: !!(P.spin || cfg.vizSpin), glow: cfg.vizGlow !== false, rings: cfg.vizRings !== false, ring: P.ring,
        // Kranz und Puls folgen der Energie des Songs: im Break klein und ruhig, im Drop voll – die Kick drückt ihn raus
        height: V.height * P.height * (0.7 + 0.35 * px.I + px.drop * 0.2 + 0.22 * px.kickEnv * px.energy),
        pulse: P.pulse * px.lvl * (0.55 + 0.6 * px.I),
      });
    }

    if (audio.data) {
      // zwischen aktuellem und nächstem Abschnitt weich überblenden statt springen
      const segs = audio.data.segs;
      const si = Math.max(seek(segs, sec, "t"), 0);
      const s0 = segs[si], s1 = segs[si + 1] || s0;
      if (s0 && s0.p.length === 12) {
        const f = clamp((sec - s0.t) / Math.max(0.01, s1.t - s0.t), 0, 1);
        const e = f * f * (3 - 2 * f);
        for (let k = 0; k < 12; k++) pit[k] = s0.p[k] + ((s1.p[k] ?? s0.p[k]) - s0.p[k]) * e;
        loud = clamp((s0.l + (s1.l - s0.l) * e + 38) / 38, 0, 1);
        havePitch = true;
      }
      // Party: der Puls folgt dem Betonungsmuster des Genres (vier auf den Boden, 1 und 3, Backbeat …)
      // Party: der Puls sitzt auf der echten Kick (aus der Klangfarbe), das Taktraster füllt Lücken
      b = px ? Math.max(px.accent * 0.75, px.kickEnv * (0.6 + 0.4 * px.I)) : mixInst ? Math.max(beat.read(sec), mixInst.kickEnv * 0.7 * (0.4 + 0.6 * mixInst.energy)) : beat.read(sec);
      if (mixInst?.kickHit && mixInst.energy > 0.5 && V.rings) rings.push({ r: R, a: 0.45 * mixInst.energy, w: 2 });
      const bi = seek(audio.data.beats, sec, "t");
      if (bi !== lastBeatIdx && bi >= 0 && playing) {
        lastBeatIdx = bi;
        const c = clamp(audio.data.beats[bi].c + 0.3, 0, 1);
        // Party: Ringe nur auf betonten Schlägen, kräftiger je mehr Energie; im Break keine
        // (solange das Drop-Bild der Regie führt, treten die Schlag-Ringe deutlich zurück – ein Bild je Moment)
        if (px) {
          const lead = 1 - 0.7 * clamp((px.scn?.dx || 0) / 0.3, 0, 1);
          if (V.rings && (px.beat > 0.5 || (px.kickHit && px.energy > 0.55)) && px.low < 0.6) rings.push({ r: R, a: (0.35 + 0.6 * px.accent) * c * lead, w: 2 + 5 * px.accent });
        } else if (V.rings && bi % V.ring === 0) rings.push({ r: R, a: 0.6 * c, w: 2 });
      }
    }

    const mirror = V.mirror;
    const span = mirror ? N / 2 : N;
    // Bewegungsuhr der Regie (Drehen, Kreisen, Ziehen) – ohne Analyse die Uhrzeit
    const tt = motion((px || mood)?.mt ?? now / 1000, now);
    // die Location bekommt dieselben Uhren (ohne Analyse: Schlagposition bzw. Uhrzeit im Tempo – wie bisher dort)
    if (px) [px.mt, px.mb] = [tt, beatsClock(px.mb ?? (px.beatIdx >= 0 ? px.beatIdx + px.phase : (now / 60000) * (px.tempo || 120)), now)];
    for (let i = 0; i < N; i++) {
      const m = mirror ? (i < span ? i : N - 1 - i) : i;
      let t;
      if (havePitch) {
        const f = (m / span) * 11;
        const lo = Math.floor(f), hi = Math.min(11, lo + 1);
        const p = pit[lo] + (pit[hi] - pit[lo]) * (f - lo);
        t = (0.12 + p * 0.88) * (0.35 + loud * 0.65) + b * 0.22;
      } else {
        // ohne Taktdaten: ruhiges, organisches Wogen
        t = 0.28 + 0.22 * Math.sin(m * 0.33 + tt * 2.1) * Math.sin(m * 0.09 - tt * 1.3) + 0.12 * Math.sin(tt * 3 + m * 0.7);
      }
      if (!Number.isFinite(t)) t = 0.2;
      targets[i] = playing ? t : t * 0.25;
    }
    // Nachbarn glätten (weiche Kurve statt Zacken), schnell hoch, langsam runter
    const k = cfg.vizSmooth;
    const rise = 1 - Math.exp(-dt * (32 - 2.6 * k));
    const fall = 1 - Math.exp(-dt * (16 - 1.3 * k));
    // Welle: breiter glätten (5 Nachbarn) – eine geschlossene Kurve durch 150 Spitzen zeigt sonst jedes kleine Zittern
    const wide = V.style === "wave";
    for (let i = 0; i < N; i++) {
      const a = (j) => targets[(i + j + N) % N];
      const t = wide ? (a(-2) + 2 * a(-1) + 3 * a(0) + 2 * a(1) + a(2)) / 9 : (a(-1) + 2 * a(0) + a(1)) / 4;
      vals[i] += (t - vals[i]) * (t > vals[i] ? rise : fall);
    }
    if (cfg.calm) return;

    // Melodie-Tönung: die Tonklasse kommt je Viertelsekunde neu – geglättet über ~1 s (auf dem Farbkreis, im HSL-Raum),
    // statt bei jedem Wechsel umzufärben; wo keine Melodie erkannt wird, klingt die Tönung langsam aus
    if (px) {
      const on = px.tone > 0.35 && px.pitch >= 0, target = on ? ((px.pitch * 7) % 12) * 30 : -1;
      if (on) pitchSm.h = pitchSm.h < 0 || px.jump ? target : lowpassHue(pitchSm.h, target, dt, 1);
      pitchSm.w = lowpass(pitchSm.w, on ? 1 : 0, dt, on ? 0.5 : 1);
    }
    let pal = px ? vivid(imPalette(), px.minor, px.P.tint, pitchSm.h >= 0 && pitchSm.w > 0.02 ? Math.round(pitchSm.h) : -1, px.keyPc, Math.round(pitchSm.w * 50) / 50) : imPalette();
    // Farbkorrektur je Teil (Sättigung, Temperatur, Kontrast, Farbwelt der Bridge)
    pal = gradePal(pal, (px || mood)?.grade);
    if (mood?.dropHit && V.rings) for (let k = 0; k < 2; k++) rings.push({ r: R - k * 40 * dpr, a: 0.8 - k * 0.25, w: 5 - k * 2 });
    // DJ-Übergabe (party.js): im Ausklang schon zu den Farben des nächsten Songs, danach weich in die neuen
    if (px) pal = party.mixPal(pal);
    // Sprung im Song (Spulen, Songwechsel, Taktdaten kommen an): die Lichtfarben gleiten in 0,6 s hinüber,
    // statt im selben Bild umzuspringen (Tonart, Moll, Farbkorrektur des Teils hängen an der Songzeit)
    // (genauere Taktdaten zum selben Song: 1,5 s – party.js sagt die Dauer in jumpDur)
    if (px?.jump && palShown && !cfg.calm) palFade = { from: palShown, at: now, ms: (px.jumpDur || 0.6) * 1000 };
    if (palFade) {
      const f = (now - palFade.at) / palFade.ms;
      if (!px || f >= 1 || f < 0) palFade = null;
      else {
        const e = f * f * (3 - 2 * f), from = palFade.from;
        pal = pal.map((c, i) => c.map((v, k) => Math.round(from[i][k] + (v - from[i][k]) * e)));
      }
    }
    // Lichtfarben gleiten immer kurz (~80 ms) zum Ziel: Melodie-Tönung, Tonart und Farbkorrektur sprangen sonst
    // von Bild zu Bild um bis zu 60 Stufen – das wirkte wie Flackern. Der Drop bleibt knackig (Blitz und Bloom
    // laufen getrennt), „Ruhig“ zeichnet ohnehin ohne Party-Licht.
    if (px && !cfg.calm) {
      if (!palSm) palSm = pal.map((c) => c.slice());
      const kk = 1 - Math.exp(-dt / 0.08);
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) palSm[i][k] += (pal[i][k] - palSm[i][k]) * kk;
      pal = palSm.map((c) => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
    } else palSm = null;
    palShown = px ? pal : null;
    const rgba = (c, al) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
    // Party: Kranz höchstens so lang wie 0,8 × Cover-Radius – sonst reicht er in Liedtext und Leiste
    let maxLen = Math.min(vw, vh) * 0.11 * V.height * (px ? Math.min(1, (R * 0.8) / (Math.min(vw, vh) * 0.11 * V.height)) : 1);
    // Visualizer und Mix: der Kranz endet 10 px unter der Kopfleiste. Vorher ragten laute Stellen in die Reiter
    // (die Länge hing nur an der Fenstergröße, nicht am Platz über dem Cover). Nie kürzer als 40 % – er bleibt ein Kranz.
    if (!px && vizRect.head) maxLen = Math.max(maxLen * 0.4, Math.min(maxLen, cy - (vizRect.head + 10) * dpr - R - 4 * dpr));
    const rot = V.spin ? tt * (px ? 0.12 : 0.06) : 0;
    // Leuchtkraft der Visualizer-Ansichten nach der Lichtregie: Energie des Teils, Anheben beim Refrain-Einsatz,
    // Anschwellen im Aufbau, ein Aufleuchten beim Drop, das weich abklingt („Keine Blitze“: nur ein Hauch davon)
    vizBloom = Math.max(vizBloom * Math.exp(-dt * 2.2), mood?.dropHit ? 1 : 0);
    const soft = cfg.noFlash ? 0.4 : 1;
    const glowK = px ? 1 : clamp(0.7 + 0.4 * (mood?.I ?? 0.75) + 0.5 * (mood?.lift || 0) * soft + 0.35 * (mood?.riser || 0) + 0.7 * vizBloom * soft + 0.35 * b * soft, 0.6, 2.2);
    // Farbkreis aus den drei Coverfarben rund ums Cover (gespiegelt, wenn die Balken gespiegelt sind)
    const wheel = () => {
      if (!ctx.createConicGradient) return rgba(pal[0], 1);
      const g = ctx.createConicGradient(-Math.PI / 2 + rot, cx, cy);
      const st = mirror ? [0, 1, 2, 1, 0] : [0, 1, 2, 0];
      st.forEach((k, i) => g.addColorStop(i / (st.length - 1), rgba(pal[k], 1)));
      return g;
    };
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R + maxLen * 1.2);
    const g0 = (0.16 + b * 0.22) * (px ? 0.9 + px.I * 0.9 + px.drop : glowK);
    // drei Stufen statt zwei: der Schein läuft weich aus, ohne sichtbare Kante
    glow.addColorStop(0, rgba(pal[0], g0));
    glow.addColorStop(0.45, rgba(pal[0], g0 * 0.4));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    // nur so groß wie der Schein reicht – außerhalb ist der Verlauf ohnehin durchsichtig
    const gr = R + maxLen * 1.2;
    ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);

    const ang = (i) => (i / N) * Math.PI * 2 - Math.PI / 2 + rot;
    const tip = (i) => R + 4 * dpr + vals[i] * maxLen;

    // Zeitlupe vor dem Drop: Funken, Ringe, Lichtteilchen und Publikum laufen eine halbe Sekunde in Zeitlupe
    // (mit Lichtregie direkt vor dem Blackout, sonst direkt vor dem Drop)
    const beatLen = 60 / (party.info.bpm || 120);
    const slowFrom = cfg.partyDirector ? beatLen : 0;
    const slow = px && cfg.partySlowmo && px.fx && px.toDrop > slowFrom && px.toDrop < slowFrom + 0.55;
    // Gewählter Stil (Einstellungen). Im Party-Modus zeichnet drawParty Bühne, Licht, Funken und Drop-Ringe und
    // ruft an der Stelle des Party-Kranzes diesen Stil auf – nur „Balken“ ist der Party-Kranz selbst.
    // Party mit Publikum: Stile am unteren Rand (Balken unten, Gebirge) bleiben flacher, die Menge bleibt sichtbar
    const floorK = px && crowdLayers({ crowd: cfg.partyCrowd, fx: px.fx }).people ? 0.6 : 1;
    // Party-Last: bei gedrosselter Qualität zeichnen Wellenfeld und Cover-Partikel die leichte Fassung
    const xLite = lightMode() || (!!px && quality.level < 1), xFull = tier() === "full" && (!px || quality.level >= 2);
    const drawStyle = () => {
      if (V.style === "bottom") {
        // Balken am unteren Rand über die ganze Breite: abgerundete Köpfe, nach unten auslaufend
        const bw = vw / N, base = vh - 8 * dpr, w2 = bw * 0.62, rr = Math.min(w2 / 2, 4 * dpr);
        for (let gi = 0; gi < 3; gi++) {
          const g = ctx.createLinearGradient(0, base - vh * 0.32 * V.height * floorK, 0, base);
          g.addColorStop(0, rgba(mixRGB(pal[gi], WHITE, 0.25), 0.95));
          g.addColorStop(1, rgba(pal[gi], 0.35));
          ctx.fillStyle = g;
          ctx.beginPath();
          for (let i = gi; i < N; i += 3) {
            const h = 6 * dpr + vals[i] * vh * 0.32 * V.height * floorK;
            if (ctx.roundRect) ctx.roundRect(i * bw + (bw - w2) / 2, base - h, w2, h, [rr, rr, 0, 0]);
            else ctx.rect(i * bw + (bw - w2) / 2, base - h, w2, h);
          }
          ctx.fill();
        }
      } else if (V.style === "line") {
        // Wellenlinie quer durch das Bild, oben und unten gespiegelt: weiche Kurve, Fläche dazwischen,
        // zu den Rändern hin auslaufend
        const mid = cy, amp = maxLen * 1.6, up = new Path2D(), dn = new Path2D();
        for (const [p, dir] of [[up, -1], [dn, 1]]) {
          let px0 = 0, py0 = mid + dir * vals[0] * amp;
          p.moveTo(px0, py0);
          for (let i = 1; i < N; i++) {
            const x = (i / (N - 1)) * vw, y = mid + dir * vals[i] * amp;
            p.quadraticCurveTo(px0, py0, (px0 + x) / 2, (py0 + y) / 2);
            [px0, py0] = [x, y];
          }
          p.lineTo(px0, py0);
        }
        const edge = (a) => {
          const g = ctx.createLinearGradient(0, 0, vw, 0);
          g.addColorStop(0, rgba(pal[0], 0));
          g.addColorStop(0.12, rgba(pal[0], a));
          g.addColorStop(0.5, rgba(pal[1], a));
          g.addColorStop(0.88, rgba(pal[2], a));
          g.addColorStop(1, rgba(pal[2], 0));
          return g;
        };
        ctx.fillStyle = edge(0.1 * glowK);
        for (const p of [up, dn]) {
          const area = new Path2D(p);
          area.lineTo(vw, mid);
          area.lineTo(0, mid);
          area.closePath();
          ctx.fill(area);
        }
        if (V.glow) {
          ctx.lineWidth = 9 * dpr;
          ctx.strokeStyle = edge(clamp(0.12 * glowK, 0, 0.4));
          ctx.stroke(up);
          ctx.stroke(dn);
        }
        ctx.lineWidth = 2.2 * dpr;
        ctx.strokeStyle = edge(0.95);
        ctx.stroke(up);
        ctx.stroke(dn);
      } else if (V.style === "particles") {
        // Lichtpunkte, die um das Cover kreisen und mit der Musik nach außen schweben – weiche Leuchtpunkte
        for (let i = 0; i < N; i++) {
          const a = ang(i) + tt * 0.15 * (i % 2 ? 1 : -1), e = tip(i) + Math.sin(tt * 2 + i) * 6 * dpr;
          const r = (5.5 + vals[i] * 11) * dpr * (1 + b * 0.25);
          ctx.globalAlpha = clamp(0.3 + vals[i] * 0.7, 0, 1);
          ctx.drawImage(vizSprite(pal[i % 3]), cx + Math.cos(a) * e - r, cy + Math.sin(a) * e - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      } else if (V.style === "tunnel") {
        // 3D-Tunnel: jeder Ring ist ein Abdruck des Spektrums von eben, der aus dem Cover auf dich zufliegt –
        // erst langsam, dann immer schneller (Perspektive), und dabei verblasst. Neue Ringe im festen Takt
        // (unabhängig von der Bildrate), als weiche Kurve.
        if (now - tunnelAt > 200) tunnelAt = now - 45;
        while (now - tunnelAt >= 45) {
          tunnelAt += 45;
          const ring = new Float32Array(48);
          for (let k = 0; k < 48; k++) ring[k] = vals[Math.floor((k / 48) * N)] || 0;
          tunnel3d.push({ at: tunnelAt, v: ring, c: tunnel3d.length % 3 });
        }
        const life = (1400 - b * 500) / clamp((mood || px)?.speed || 1, 0.5, 1.4), far = Math.hypot(vw, vh) * 0.62;
        tunnel3d = tunnel3d.filter((r) => now - r.at < life);
        for (const r of tunnel3d) {
          const z = (now - r.at) / life, d = R * 1.05 + (far - R) * z * z;
          ctx.lineWidth = (1 + z * 5) * dpr;
          ctx.strokeStyle = rgba(z < 0.15 ? mixRGB(pal[r.c], WHITE, 0.35) : pal[r.c], (0.75 * (1 - z) * (0.5 + 0.5 * Math.min(1, z * 6)) * Math.min(1.2, 0.8 + 0.25 * glowK)).toFixed(3));
          const pt = (j) => {
            const a = (j / 48) * Math.PI * 2 - Math.PI / 2 + rot, rr = d * (1 + r.v[j % 48] * 0.28 * V.height);
            return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
          };
          let [x0, y0] = pt(0), [x1, y1] = pt(1);
          ctx.beginPath();
          ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
          for (let k = 1; k <= 48; k++) {
            [x0, y0] = [x1, y1];
            [x1, y1] = pt(k + 1);
            ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
          }
          ctx.closePath();
          ctx.stroke();
        }
      } else if (V.style === "galaxy") {
        // Galaxie: drei Spiralarme aus weichen Lichtpunkten drehen sich ums Cover; die Musik schiebt sie nach außen
        for (let i = 0; i < N; i++) {
          const arm = i % 3, f = i / N, a = arm * ((Math.PI * 2) / 3) + f * Math.PI * 3 + tt * 0.18;
          const rr = R * 1.08 + f * maxLen * 2.6 + vals[i] * maxLen * 0.9;
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, r = (4.5 + vals[i] * 9 + (1 - f) * 3.5) * dpr;
          ctx.globalAlpha = clamp((0.25 + vals[i] * 0.75) * (0.6 + 0.4 * Math.sin(tt * 3 + i)), 0, 1);
          ctx.drawImage(vizSprite(pal[arm]), x - r, y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      } else if (V.style === "mountains") {
        // Gebirge: drei Bergketten aus dem Spektrum am unteren Rand, hinten blasser, ziehen langsam vorbei.
        // Zwischen den Spektrumswerten wird weich gemittelt (vorher sprang der Grat beim Weiterziehen von Wert zu Wert).
        const sm = (j) => (vals[(j + N) % N] + vals[(j + 1) % N] + vals[(j + N - 1) % N]) / 3;
        const at = (u) => {
          const f = ((u % N) + N) % N, i0 = Math.floor(f), w = f - i0, s = w * w * (3 - 2 * w);
          return sm(i0) + (sm(i0 + 1) - sm(i0)) * s;
        };
        for (let k = 2; k >= 0; k--) {
          const base = vh, hMax = vh * (0.22 + k * 0.07) * V.height * floorK, shift = tt * (8 + k * 6);
          const steps = 64, ridge = new Path2D();
          let px0 = 0, py0 = 0;
          for (let s2 = 0; s2 <= steps; s2++) {
            const x = (s2 / steps) * vw, v = at((s2 / steps) * N + shift / 12 + k * 17);
            const y = base - (0.12 + v) * hMax * (0.7 + 0.3 * Math.sin(s2 * 0.5 + k));
            if (!s2) ridge.moveTo(x, y);
            else ridge.quadraticCurveTo(px0, py0, (px0 + x) / 2, (py0 + y) / 2);
            [px0, py0] = [x, y];
          }
          ridge.lineTo(px0, py0);
          const body = new Path2D(ridge);
          body.lineTo(vw, base);
          body.lineTo(0, base);
          body.closePath();
          const g = ctx.createLinearGradient(0, base - hMax * 1.1, 0, base);
          g.addColorStop(0, rgba(pal[k], (0.5 - k * 0.12).toFixed(2)));
          g.addColorStop(1, rgba(pal[k], 0.04));
          ctx.fillStyle = g;
          ctx.fill(body);
          // heller Grat: macht die Kette klar statt verwaschen
          ctx.lineWidth = (1.6 - k * 0.3) * dpr;
          ctx.strokeStyle = rgba(mixRGB(pal[k], WHITE, 0.3), ((0.55 - k * 0.15) * Math.min(1.2, 0.8 + 0.25 * glowK)).toFixed(3));
          ctx.stroke(ridge);
        }
      } else if (V.style === "scope") {
        // Oszilloskop: ein Lichtkreis, der in Obertönen schwingt – jede Spektrumsgruppe eine eigene Welle
        const paths = [0, 1, 2].map((k) => {
          const p = new Path2D();
          for (let s2 = 0; s2 <= 180; s2++) {
            const a = (s2 / 180) * Math.PI * 2;
            let off = 0;
            for (let h = 1; h <= 5; h++) off += vals[Math.floor((h / 6) * N)] * Math.sin(a * (h * 3 + k) + tt * h * (k ? -1 : 1));
            const rr = R * 1.18 + maxLen * 0.35 + off * maxLen * 0.32;
            const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
            s2 ? p.lineTo(x, y) : p.moveTo(x, y);
          }
          p.closePath();
          return p;
        });
        for (const [w, al] of V.glow ? [[9, clamp(0.12 * glowK, 0, 0.4)], [2.4, 0.95], [0.9, 0.5]] : [[2.4, 0.95]]) {
          ctx.lineWidth = w * dpr;
          paths.forEach((p, k) => {
            ctx.strokeStyle = w < 1 ? `rgba(255,255,255,${(al * (k ? 0.5 : 1)).toFixed(3)})` : rgba(pal[k], (al * (k ? 0.65 : 1)).toFixed(3));
            ctx.stroke(p);
          });
        }
      } else if (EXTRA_VIZ.has(V.style)) {
        /* === 1.27 views: Wellenfeld und Cover-Partikel (vizextra.js) === */
        const o = { vw, vh, cx, cy, R, dpr, vals, N, b, tt, dt, pal, glowK, height: V.height, glow: V.glow, lite: xLite, full: xFull, mood: px ? { dropHit: !!px.dropHit, lift: px.lift || 0 } : mood, soft, mode, now };
        if (V.style === "wavefield") drawWavefield(ctx, o);
        else if (vizRect.r) {
          const img = q.wrap.querySelector("img.is-on");
          drawCoverDust(ctx, { ...o, img: img?.complete && img.naturalWidth ? img : null, size: vizRect.r.width * dpr * pulseS });
        }
        /* === end views === */
      } else if (V.style === "shatter") {
        // Party: nur betonte Schläge brechen auf (auf jeder Kick wäre das Cover nie zu sehen), je mehr Energie, desto weiter
        drawShatter(ctx, cx, cy, maxLen, dt, px ? px.accent * (0.5 + 0.5 * px.energy) : b, dpr, tt, !!px?.dropHit);
      } else if (V.style === "wave") {
        // geschlossene, weiche Kurve durch alle Spitzen: Fläche im Verlauf vom Cover nach außen, Rand im
        // Farbkreis der Coverfarben, feiner heller Kern
        const p = new Path2D();
        for (let i = 0; i <= N; i++) {
          const j = i % N, nx = (i + 1) % N;
          const x0 = cx + Math.cos(ang(j)) * tip(j), y0 = cy + Math.sin(ang(j)) * tip(j);
          const x1 = cx + Math.cos(ang(nx)) * tip(nx), y1 = cy + Math.sin(ang(nx)) * tip(nx);
          const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          if (i === 0) p.moveTo(mx, my);
          else p.quadraticCurveTo(x0, y0, mx, my);
        }
        p.closePath();
        const fill = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R + maxLen * 1.1);
        fill.addColorStop(0, rgba(pal[0], 0.3));
        fill.addColorStop(1, rgba(pal[1], 0.04));
        ctx.fillStyle = fill;
        ctx.fill(p);
        const ring = wheel();
        if (V.glow) {
          ctx.lineWidth = 10 * dpr;
          ctx.globalAlpha = clamp(0.14 * glowK, 0, 0.4);
          ctx.strokeStyle = ring;
          ctx.stroke(p);
        }
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 2.5 * dpr;
        ctx.strokeStyle = ring;
        ctx.stroke(p);
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 0.9 * dpr;
        ctx.strokeStyle = "#fff";
        ctx.stroke(p);
        ctx.globalAlpha = 1;
      } else {
        // Balken bzw. Punkte: EIN Pfad für alle, eingefärbt über einen Farbkreis aus den Coverfarben (weicher
        // Übergang statt bunter Einzelbalken); Breite aus dem Umfang, damit die Abstände bei jeder Balkenzahl stimmen
        const bw = clamp(((Math.PI * 2 * R) / N) * 0.5, 1.6 * dpr, 4.5 * dpr);
        const ring = wheel(), body = new Path2D(), tips = new Path2D();
        for (let i = 0; i < N; i++) {
          const c = Math.cos(ang(i)), sn = Math.sin(ang(i)), e = tip(i);
          if (V.style === "dots") {
            const r = (2.2 + vals[i] * 2.6) * dpr;
            body.moveTo(cx + c * e + r, cy + sn * e);
            body.arc(cx + c * e, cy + sn * e, r, 0, Math.PI * 2);
          } else {
            body.moveTo(cx + c * R, cy + sn * R);
            body.lineTo(cx + c * e, cy + sn * e);
            // heller Kopf auf dem äußeren Drittel – nur bei Balken, die wirklich ausschlagen
            if (vals[i] > 0.18) {
              const m = e - (e - R) * 0.3;
              tips.moveTo(cx + c * m, cy + sn * m);
              tips.lineTo(cx + c * e, cy + sn * e);
            }
          }
        }
        if (V.style === "dots") {
          if (V.glow) {
            ctx.globalAlpha = clamp(0.16 * glowK, 0, 0.45);
            ctx.lineWidth = 7 * dpr;
            ctx.strokeStyle = ring;
            ctx.stroke(body);
          }
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = ring;
          ctx.fill(body);
        } else {
          ctx.strokeStyle = ring;
          if (V.glow) {
            ctx.globalAlpha = clamp(0.15 * glowK, 0, 0.45);
            ctx.lineWidth = bw * 3.2;
            ctx.stroke(body);
          }
          // Körper: vom Cover nach außen heller werdend (Tiefe auch bei Covern mit ähnlichen Farben)
          const tube = ctx.createRadialGradient(cx, cy, R, cx, cy, R + 4 * dpr + maxLen);
          tube.addColorStop(0, rgba(pal[0], 0.45));
          tube.addColorStop(0.45, rgba(pal[1], 0.9));
          tube.addColorStop(1, rgba(mixRGB(pal[2], WHITE, 0.3), 1));
          ctx.globalAlpha = 0.95;
          ctx.lineWidth = bw;
          ctx.strokeStyle = tube;
          ctx.stroke(body);
          ctx.globalAlpha = 0.3 + 0.2 * b;
          ctx.lineWidth = bw * 0.42;
          ctx.strokeStyle = "#fff";
          ctx.stroke(tips);
        }
        ctx.globalAlpha = 1;
      }
    };
    if (px) drawParty(ctx, cx, cy, R, maxLen, N, pal, dpr, slow ? dt * 0.2 : dt, px, tip, ang, V.style === "bars" ? null : drawStyle);
    else drawStyle();

    rings = rings.filter((g) => g.a > 0.02);
    for (const g of rings) {
      g.r += 300 * dt * dpr;
      g.a *= Math.exp(-dt * 2.8);
      ctx.lineWidth = (g.w || 2) * dpr;
      ctx.strokeStyle = rgba(pal[2], g.a);
      ctx.beginPath();
      ctx.arc(cx, cy, g.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    // Puls direkt als scale (eigene Grafikebene), nur bei sichtbarer Änderung
    // Puls federt: schneller Anstieg (~35 ms), weiches Abklingen – kein hartes Springen von Bild zu Bild
    // sofort hoch (sonst hinkt der Puls hinterher), weich wieder ab
    // Anstieg in ~25 ms statt eines Sprungs von einem Bild aufs nächste (bei 30 Bildern/s gleitet CSS dazwischen)
    const want = 1 + b * V.pulse;
    pulseS += (want - pulseS) * (1 - Math.exp(-dt * (want > pulseS ? 40 : 9)));
    const pulse = pulseS.toFixed(4);
    if (pulse !== lastPulse) q.wrap.style.scale = lastPulse = pulse;
    if (px) {
      // Farbfläche: nur Deckkraft und (beim Takt) Farbe ändern – beides ohne Neu-Layout
      partyFx = true;
      // (drei Nachkommastellen: in Hundertsteln sprang die Deckkraft beim Abklingen sichtbar in Stufen)
      const op = Math.max(px.flash * 0.42, px.ambient || 0).toFixed(3);
      if (q.flash.style.opacity !== op) q.flash.style.opacity = op;
      if (px.flashCol !== lastFlashCol) {
        lastFlashCol = px.flashCol;
        const c = pal[px.flashCol];
        // nur die Farbe setzen: der Verlauf (viele Stufen) steht in user.css, die Farbe gleitet dort in 0,35 s hinüber
        q.flash.style.setProperty("--m-fc", `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`);
      }
      // Wackeln als weiche Schwingung statt Zufallssprung pro Bild (das hakte hin und her); der Kranz wackelt mit
      const ts = now / 1000;
      shakeX = px.shake > 0.3 ? Math.sin(ts * 31) * px.shake : 0;
      shakeY = px.shake > 0.3 ? Math.sin(ts * 23 + 1.3) * px.shake * 0.6 : 0;
      const sh = shakeX || shakeY ? `${shakeX.toFixed(1)}px ${shakeY.toFixed(1)}px` : "";
      if (q.wrap.style.translate !== sh) q.wrap.style.translate = sh;
      // ab „Max“: aktive Liedzeile federt auf den betonten Schlägen; Pop, Bass und Chill lassen das Cover
      // dazu pendeln (Rock wackelt stattdessen, Rave bleibt stehen und lässt das Licht arbeiten)
      const move = px.fx && cfg.partyZoom && px.level >= 3;
      const bo = move && activeEl ? (1 + px.accent * px.accent * 0.04).toFixed(3) : "";
      if (bo !== lastBounce && activeEl) activeEl.style.scale = lastBounce = bo;
      const rot = move && px.P.sway ? (px.sway * px.accent * (px.level >= 5 ? 4 : 2.5)).toFixed(2) + "deg" : "";
      if (rot !== lastRot) q.wrap.style.rotate = lastRot = rot;
      // Kamera-Stoß: Visualizer und Hintergrund zoomen kurz mit (nur scale – eigene Grafikebenen)
      const kz = px.kick > 0.02 ? (1 + px.kick * 0.04).toFixed(3) : "";
      if (kz !== lastKick) {
        lastKick = kz;
        q.canvas.style.scale = kz;
      }
      // Hintergrund: Kamera-Zoom und Kamera-Stoß zusammen (kein Pumpen mehr auf jeder Kick – das wirkte wie ein
      // ständiges Rein- und Rauszoomen)
      const bz = (cam.s * (px.kick > 0.02 ? 1 + px.kick * 0.06 : 1)).toFixed(3);
      if (bz !== lastBgZ) {
        lastBgZ = bz;
        q.bg.style.scale = bz === "1.000" ? "" : bz;
      }
    }
  }
  let shakeX = 0, shakeY = 0;
  let curInst = null, pulseS = 1, lastPulse = "", lastFlashCol = -1, vizErr = null, lostSince = 0, lastKick = "", lastFill = "", lastFillP = "";
  let playOn = false;
  let activeEl = null, lastBounce = "", lastRot = "", lastBgZ = "", vizBloom = 0;
  const WHITE = [255, 255, 255];
  const mixRGB = (a, c, f) => [0, 1, 2].map((k) => Math.round(a[k] + (c[k] - a[k]) * f));
  // weicher Leuchtpunkt je Farbe, einmal gerendert (Glockenkurve statt Kante): für Teilchen und Galaxie
  // (Farben auf 16er-Stufen gerundet: Funken aus dem Farbverlauf teilen sich so wenige Bilder)
  const vizSprites = new Map();
  function spriteOf(kind, c0, draw) {
    const c = c0.map((v) => Math.min(255, Math.round(v / 16) * 16)), key = kind + c.join(",");
    let s = vizSprites.get(key);
    if (s) return s;
    if (vizSprites.size > 96) vizSprites.clear();
    s = document.createElement("canvas");
    draw(s, c);
    vizSprites.set(key, s);
    return s;
  }
  const vizSprite = (c0) => spriteOf("d", c0, (s, c) => {
    s.width = s.height = 48;
    const x = s.getContext("2d"), g = x.createRadialGradient(24, 24, 0, 24, 24, 24);
    const hot = mixRGB(c, WHITE, 0.6);
    g.addColorStop(0, `rgba(${hot},1)`);
    g.addColorStop(0.18, `rgba(${hot},0.95)`);
    g.addColorStop(0.38, `rgba(${c},0.55)`);
    g.addColorStop(0.68, `rgba(${c},0.14)`);
    g.addColorStop(1, `rgba(${c},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, 48, 48);
  });
  // Regentropfen: dünner Lichtfaden, oben durchsichtig, unten ein heller Kopf
  const rainSprite = (c0) => spriteOf("r", c0, (s, c) => {
    s.width = 6;
    s.height = 44;
    const x = s.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 44);
    g.addColorStop(0, `rgba(${c},0)`);
    g.addColorStop(0.75, `rgba(${c},0.7)`);
    g.addColorStop(1, `rgba(${mixRGB(c, WHITE, 0.5)},1)`);
    x.fillStyle = g;
    x.beginPath();
    x.roundRect ? x.roundRect(1.5, 0, 3, 44, 1.5) : x.rect(1.5, 0, 3, 44);
    x.fill();
  });
  // Cover-Neigung zur Maus: kritisch gedämpfte Feder, zeitbasiert – kein Neustart einer CSS-Übergangskurve bei
  // jedem Mausereignis (das ruckte), gleich weich bei 30, 60 oder 144 Bildern/s. Gesetzt wird nur „rotate“
  // (eine Drehachse aus X- und Y-Neigung) und die Lage des Glanzlichts – beides ohne Neu-Layout.
  const tilt = { x: 0, y: 0, vx: 0, vy: 0, key: "", ip: "", rest: false };
  function coverMotion(dt, fpsCap) {
    // gedrosselt (30 Bilder/s): der Browser gleitet zwischen zwei Bildern linear weiter (Übergang = Bildabstand)
    // (nur unter 50 Bildern/s – bei „Ausgewogen“ mit 60 zeigt der Bildschirm ohnehin jedes Bild)
    const ip = fpsCap && fpsCap < 50 && !cfg.calm ? Math.round(1000 / fpsCap + 2) + "ms" : "0s";
    if (ip !== tilt.ip) el.style.setProperty("--m-ip", (tilt.ip = ip));
    const tx = cfg.calm ? 0 : -depth.ty * 14, ty = cfg.calm ? 0 : depth.tx * 18;
    // in kleinen Schritten rechnen: auch bei 50 ms Bildabstand stabil
    for (let left = dt; left > 1e-4; left -= 0.016) {
      const h = Math.min(0.016, left), w = 7;
      tilt.vx += (w * w * (tx - tilt.x) - 2 * w * tilt.vx) * h;
      tilt.vy += (w * w * (ty - tilt.y) - 2 * w * tilt.vy) * h;
      tilt.x += tilt.vx * h;
      tilt.y += tilt.vy * h;
    }
    // Feder steht (Ziel erreicht, keine Geschwindigkeit): dann darf die Cover-Ansicht seltener zeichnen (siehe frame)
    tilt.rest = Math.abs(tilt.vx) + Math.abs(tilt.vy) < 0.02 && Math.abs(tx - tilt.x) + Math.abs(ty - tilt.y) < 0.01;
    const ang = Math.hypot(tilt.x, tilt.y);
    const k = ang < 0.02 ? "" : `${(tilt.x / ang).toFixed(3)} ${(tilt.y / ang).toFixed(3)} 0 ${ang.toFixed(2)}deg`;
    if (k === tilt.key) return;
    tilt.key = k;
    q.cover.style.rotate = k;
    // Glanzlicht wandert gegen die Neigung (verschiebt nur eine fertige Ebene)
    q.cover.style.setProperty("--gx", (tilt.y * 2.2).toFixed(1) + "%");
    q.cover.style.setProperty("--gy", (-tilt.x * 2.8).toFixed(1) + "%");
  }
  function freshCanvas() {
    const n = q.canvas.cloneNode(false);
    q.canvas.replaceWith(n);
    q.canvas = n;
    vctx = n.getContext("2d");
    lostSince = 0;
    vizReset();
  }
  function vizReset() {
    vals = new Float32Array(0);
    rings = [];
    sparks = [];
    vizRect.r = null;
    lastVizT = 0;
    vw = 0;
    resetVizExtra();
    try {
      vctx.globalCompositeOperation = "source-over";
    } catch {}
  }

  // Party-Farben: kräftig statt der oft gedeckten Coverfarben. Graue Cover bekommen Mirage-Töne.
  // Moll macht das Licht tiefer und kühler, Dur heller – die Farben folgen der Stimmung des Abschnitts.
  let vividKey = "", vividPal = null;
  const TINT = { cool: 205, warm: 28, hot: 4, pink: 325, gold: 44, jungle: 130 };
  // Farbton ein Stück Richtung Ziel drehen (kürzester Weg auf dem Farbkreis)
  const toward = (h, target, f) => (h + ((((target - h) % 360) + 540) % 360 - 180) * f + 360) % 360;
  /* ---- Zersplittertes Cover (Visualizer-Stil „shatter“): das Cover zerfällt im Takt in Kacheln, die nach
     außen fliegen und sich wieder zusammensetzen. Gezeichnet wird das echte Coverbild Kachel für Kachel. */
  const shards = { n: 12, amt: 0, last: 0, seed: [] };
  function drawShatter(ctx, cx, cy, maxLen, dt, b, dpr, tt, drop) {
    const img = q.wrap.querySelector("img.is-on");
    if (!img?.complete || !img.naturalWidth || !vizRect.r) return;
    const n = shards.n;
    if (shards.seed.length !== n * n) shards.seed = Array.from({ length: n * n }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
    // Schlag (Lautheit springt): aufbrechen, dann weich zurück
    if (b > shards.last + 0.12 && b > 0.35) shards.amt = Math.min(1, shards.amt + 0.55 + b * 0.4);
    // Party: der Drop sprengt das Cover ganz auf
    if (drop) shards.amt = 1;
    shards.last = b;
    shards.amt *= Math.exp(-dt * 2.6);
    const size = vizRect.r.width * dpr * pulseS, x0 = cx - size / 2, y0 = cy - size / 2, ts = size / n;
    const sw = img.naturalWidth / n, sh = img.naturalHeight / n, a = shards.amt;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const [rx, ry, rr] = shards.seed[i * n + j];
        const dx = (i + 0.5) / n - 0.5, dy = (j + 0.5) / n - 0.5, dist = Math.hypot(dx, dy) + 0.15;
        const push = a * maxLen * 1.6 * dist, wob = Math.sin(tt * 2 + i * 1.3 + j) * vals[(i * n + j) % vals.length] * 3 * dpr;
        const px2 = x0 + i * ts + ts / 2 + (dx / dist) * push + rx * a * 18 * dpr + wob, py2 = y0 + j * ts + ts / 2 + (dy / dist) * push + ry * a * 18 * dpr;
        ctx.save();
        ctx.translate(px2, py2);
        ctx.rotate(rr * a * 0.9);
        ctx.globalAlpha = 1 - a * 0.25;
        ctx.drawImage(img, i * sw, j * sh, sw, sh, -ts / 2 - 0.5, -ts / 2 - 0.5, ts + 1, ts + 1);
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.globalCompositeOperation = "lighter";
  }
  // pitchHue = geglätteter Farbton der Melodie (Grad, −1 = keine), pitchW = wie stark sie wirkt (0..1)
  function vivid(pal, minor, tint, pitchHue = -1, keyPc = -1, pitchW = 1) {
    const key = pal.map((c) => c.join(",")).join("|") + (minor ? "m" : "") + (tint || "") + pitchHue + "w" + pitchW + "k" + keyPc;
    if (key === vividKey) return vividPal;
    vividKey = key;
    const hsl = pal.map(rgb2hsl);
    const grey = hsl.every(([, s]) => s < 0.12);
    vividPal = hsl.map(([h, s, l], i) => {
      let hue = grey ? [275, 195, 320][i] : h;
      if (TINT[tint] != null) hue = toward(hue, TINT[tint] + (i - 1) * 22, 0.45);
      // Melodie: die Tonklasse färbt das Akzentlicht (Quintenzirkel – verwandte Töne liegen nah beieinander)
      if (pitchHue >= 0) hue = toward(hue, pitchHue, (i === 2 ? 0.35 : 0.1) * pitchW);
      // Tonart-Farben: Dur leicht wärmer, Moll leicht kühler, dazu ein Hauch der Tonart (Quintenzirkel)
      if (keyPc >= 0) hue = toward(hue, ((keyPc * 7) % 12) * 30, 0.08);
      hue = toward(hue, minor ? 225 : 35, 0.07);
      return minor ? hsl2rgb([(hue + 345) % 360, Math.max(s, 0.66), clamp(l, 0.46, 0.6)]) : hsl2rgb([hue, Math.max(s, 0.74), clamp(l, 0.56, 0.7)]);
    });
    return vividPal;
  }

  // Party-Kranz: Balken im Farbverlauf rund ums Cover (12 Farbstufen = 12 Pfade), darüber eine feine
  // Lichtlinie und Funken, die auf betonten Schlägen vom Cover wegfliegen
  let sparks = [];
  function drawParty(ctx, cx, cy, R, maxLen, N, pal, dpr, dt, px, tip, ang, ring = null) {
    const P = px.P;
    const mixC = (a, b, f) => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f));
    const off = (px.scene * 0.37) % 1;
    const colAt = (u) => {
      const x = (((u + off) % 1) * 3) % 3, i = Math.floor(x);
      return mixC(pal[i], pal[(i + 1) % 3], x - i);
    };
    const rgba = (c, al) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
    // Bühnenlicht, Dekor und Publikum zeichnet die Location (eigenes Canvas darunter, möglichst eigener Thread)
    // (eine Zeit für Bild und Antworten: die Bühne rechnet das Alter der Antworten daraus, wie hier die Freigabe)
    const vt = performance.now() / 1000, cues = cfg.partyWords && !cfg.calm ? scen.frame(vt) : null;
    const flashOn = !!(cfg.partyFlash && px.fx && !cfg.noFlash);
    venueFrame({
      t: vt, dt, vw, vh, dpr, pal: venuePalOf(pal), cx, cy, R,
      // Publikum: die ruhige Grundfarbe des Songs (Cover), nicht die Lichtfarbe dieses Bildes – die gleitet beim
      // Songwechsel über Sekunden und folgt der Melodie, und jede neue Farbe hieß: alle Körperbilder neu malen
      crowdPal: imPalette(),
      px: {
        // Bühnenlicht: das der Szene, sonst das des Genres; beim Szenenwechsel gleitet spot2 → spot über sx
        key: px.key, P: { spot: px.spot || P.spot }, spot2: px.spot2 || P.spot, sx: px.sx ?? 1, rig: px.rig || "", spread: px.spread ?? 1, crowd: px.crowd ?? 1, accent: px.accent, kickEnv: px.kickEnv, snareEnv: px.snareEnv, hatEnv: px.hatEnv,
        bass: px.bass || 0, bassPulse: px.bassPulse || 0,
        beat: px.beat, hit: px.hit, energy: px.energy, build: px.build, low: px.low, drop: px.drop, dropHit: px.dropHit,
        I: px.I, spin: px.spin, level: px.level, scene: px.scene, inBar: px.inBar, barIdx: px.barIdx ?? -1, phase: px.phase, beatIdx: px.beatIdx,
        finale: !!px.finale, blackout: !!px.blackout,
        // Lichtregie (director.js)
        mt: px.mt, mb: px.mb, wipe: px.wipe, wdir: px.wdir, pulse: px.pulse, lift: px.lift, wall: px.wall, vox: px.vox, swell: px.swell,
        haze: px.haze, pump: px.pump, boom: px.boom, scan: px.scan, fxMul: px.fxMul,
        // Lichtprogramme des Teils, Zusammenziehen im Aufbau, Leitbild des Höhepunkts, Lichtrampe, DJ-Übergabe und Landung
        rigP: px.rigP || "", colP: px.colP || "", conv: px.conv || 0, lead: px.lead || 0, ramp: px.ramp || 0, hand: px.hand || 0, land: !!px.land,
        // Gefühl des Teils (crowd.js: Feuerzeuge und Handys in langsamen, leisen Songs)
        mood: px.mood || "",
        // Publikum (crowd.js): Teil des Songs und Spannung vor dem Drop
        kind: px.kind, tension: px.tension,
        // Momente der Musik (director.js): Finale, Tonartwechsel, Stopp, Solo, Drop-Bild …
        scn: px.scn || null,
      },
      // Antworten der Bühne auf gesungene Wörter (scenarios.js)
      cues,
      // Bühneneffekte (CO2, Pyro, Feuerwerk) und Stroboskop – Stroboskop nur ab „Extrem“ und mit Blitzen an
      fx: cfg.partyFx && px.fx && px.level >= 2 && !lightMode(),
      rig: cfg.partyRig && px.fx && px.level >= 2 && !lightMode(),
      flash: flashOn,
      inst: curInst,
      strobe: cfg.partyStrobe && cfg.partyFlash && px.fx && px.level >= 4 && !cfg.noFlash,
      // „Keine Blitze“ für alles Übrige der Bühne (Gitarrenblitze, Handy-Blitze, weißer Drop) · Freigabe der Blitz-Schranke
      // (dazu die Freigabe für Blitze der Bühnenbilder, deren Zeitpunkt in diesem Bild erreicht ist)
      noFlash: !!cfg.noFlash, flashGo: (flashOn && cueFlash(cues, vt, party.takeFlash)) || !!px.flashGo,
      cam: { s: cam.s, x: cam.x, y: cam.y }, dep: { x: depth.x, y: depth.y, on: !!depth.key },
      quality: quality.level, qf: Math.round(quality.f1 * 50) / 50, hype: hypeOn, bpm: px.tempo || party.info.bpm || 120,
      stage: px.fx && cfg.partyLasers && px.level >= 2, crowd: cfg.partyCrowd && px.fx, paused: !PLR.isPlaying(),
      venue: moments.venue || (cfg.partyVenue && cfg.partyVenue !== "auto" ? cfg.partyVenue : ""),
      fog: cfg.partyFog && px.fx && px.level >= 2 && !lightMode(),
      drones: cfg.partyDrones && px.fx && px.level >= 2 && !lightMode(),
      song: currentItem()?.uri || "",
      handsUp: moments.hands, flashStorm: cfg.noFlash ? 0 : moments.storm, confetti: moments.confetti,
      // Reaktionen der Gäste als Lichtzeichen aus der Menge (live.js sammelt, stagefx.js zeichnet)
      reacts: cfg.partyReacts ? live.reactFrame() : null,
    });
    // Lichtstrahlen (ab „Extrem“): gespiegelte Fächer aus dem Cover. Im Break blenden sie aus, im Aufbau
    // werden sie schmaler und flirren im doppelten Tempo, beim Drop gehen sie voll auf.
    if (px.lasers && px.beamVis > 0.02) {
      const n = px.lasers, far = Math.hypot(vw, vh), half = n / 2;
      // Riser der Regie (wird zum Drop hin dichter, ohne Blitze ruhig); ohne Regie wie bisher
      const riser = px.riser ? 1 + px.pulse * 0.7 : px.build ? 1 + px.build * 0.7 * (0.5 + 0.5 * Math.sin((performance.now() / 1000) * Math.PI * 4 * ((party.info.bpm || 120) / 60))) : 1;
      const al = (0.1 + px.accent * 0.4 + px.drop * 0.3) * px.beamVis * riser * (P.beams ?? 1);
      const wd = (0.012 + px.accent * 0.016 + px.drop * 0.012) * (1 - px.build * 0.5) * (px.spread ?? 1);
      for (let k = 0; k < n; k++) {
        const side = k % 2 ? -1 : 1;
        const a = side * (px.spin + Math.floor(k / 2) * ((Math.PI * 2) / half)) - Math.PI / 2;
        const c = colAt(k / n);
        const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * far * 0.7, cy + Math.sin(a) * far * 0.7);
        g.addColorStop(0, rgba(c, al));
        g.addColorStop(0.45, rgba(c, al * 0.35));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.lineTo(cx + Math.cos(a - wd) * far, cy + Math.sin(a - wd) * far);
        ctx.lineTo(cx + Math.cos(a + wd) * far, cy + Math.sin(a + wd) * far);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (cfg.partyMelody && px.fx && px.level >= 2) drawMelody(ctx, cx, cy, R, dpr, dt, px, rgba, colAt);
    // gewählter Visualizer-Stil (Galaxie, Tunnel, Welle …) statt des Party-Kranzes – mit Energie, Drop und Party-Farben
    if (ring) ring();
    else {
      const STEPS = 12;
      const w = P.thick * dpr * (0.75 + 0.4 * px.I) * (1 + px.drop * 0.3);
      for (const [lw, al] of [[w * 3.2, 0.1 + 0.1 * px.I], [w, 0.95]]) {
        ctx.lineWidth = lw;
        for (let k = 0; k < STEPS; k++) {
          ctx.beginPath();
          for (let i = Math.floor((k / STEPS) * N); i < Math.floor(((k + 1) / STEPS) * N); i++) {
            const c = Math.cos(ang(i)), sn = Math.sin(ang(i)), e = tip(i);
            ctx.moveTo(cx + c * (R + 2 * dpr), cy + sn * (R + 2 * dpr));
            ctx.lineTo(cx + c * e, cy + sn * e);
          }
          ctx.strokeStyle = rgba(colAt((k + 0.5) / STEPS), al);
          ctx.stroke();
        }
      }
      if (P.halo) {
        // weiche Linie knapp über den Spitzen – Glanz statt gefüllter Fläche, heller bei hellem Klang
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const j = i % N, nx = (i + 1) % N;
          const r0 = tip(j) + 10 * dpr, r1 = tip(nx) + 10 * dpr;
          const x0 = cx + Math.cos(ang(j)) * r0, y0 = cy + Math.sin(ang(j)) * r0;
          const x1 = cx + Math.cos(ang(nx)) * r1, y1 = cy + Math.sin(ang(nx)) * r1;
          const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          i ? ctx.quadraticCurveTo(x0, y0, mx, my) : ctx.moveTo(mx, my);
        }
        ctx.closePath();
        ctx.lineWidth = 7 * dpr;
        ctx.strokeStyle = rgba(pal[1], 0.06 + 0.08 * px.I);
        ctx.stroke();
        ctx.lineWidth = 1.4 * dpr;
        ctx.strokeStyle = `rgba(255,255,255,${(0.18 + px.bright * 0.25 + px.drop * 0.3).toFixed(2)})`;
        ctx.stroke();
      }
    }
    // Bassbalken am unteren Rand – nicht, wenn dort das Publikum steht (ohne Publikum füllen sie den Rand, stagefx.js)
    // (auch nicht, wenn der gewählte Stil selbst am unteren Rand steht: Balken unten, Gebirge)
    if (crowdLayers({ crowd: cfg.partyCrowd, bottom: P.bottom }).bassBars && !(ring && (cfg.vizStyle === "bottom" || cfg.vizStyle === "mountains"))) {
      // Bass: flache Balken am unteren Rand, in den Farben des Kranzes
      const n = 64, bw = vw / n, base = vh;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const h = (4 + vals[Math.floor((i / n) * N)] * 90 * (0.5 + px.I * 0.6) * (1 + px.drop)) * dpr;
        ctx.rect(i * bw + bw * 0.2, base - h, bw * 0.6, h);
      }
      const g = ctx.createLinearGradient(0, 0, vw, 0);
      pal.forEach((c, i) => g.addColorStop(i / 2, rgba(c, 0.45)));
      ctx.fillStyle = g;
      ctx.fill();
    }
    // Funken: auf betonten Schlägen, mehr bei hellem Klang (Becken, Synths), beim Drop ein großer Schwall
    if (sparks.length < 160 + px.level * 60) {
      let n = 0;
      if (px.hit && px.beat > 0.5 && px.low < 0.5) n = Math.round(P.sparks * px.lvl * (0.35 + px.bright * 0.9) * (0.5 + px.I * 0.5) * (px.sparkMul ?? 1));
      if (px.dropHit) n += Math.round(50 * Math.min(px.lvl, 2));
      // Hi-Hats und Becken: ein paar feine Funken genau auf dem Klang
      if (px.hatHit && px.low < 0.6) n += Math.round(1 + px.bright * 4);
      // Teilcheneffekt nach der Stimmung des Teils (director.js): fröhlich Funken, traurig/zärtlich/verträumt ein
      // langsamer Lichtregen von oben, aggressiv/angespannt kurze harte Lichtstöße aus dem Cover – nie Blitze
      if (px.fxk === "rain") {
        const k = px.hit && px.low < 0.9 ? Math.round(1 + Math.min(px.lvl, 2) * (0.4 + 0.6 * px.I)) : 0;
        for (let i = 0; i < k; i++) sparks.push({ rain: 1, x: Math.random() * vw, y: -Math.random() * vh * 0.1, v: (50 + Math.random() * 60) * dpr, life: 1, c: colAt(Math.random()) });
        n = Math.round(n * 0.25);
      } else if (px.fxk === "hits") {
        if ((px.kickHit || px.snareHit) && px.low < 0.5 && px.energy > 0.35) {
          const a0 = Math.random() * Math.PI * 2;
          for (let i = 0, k = 3 + Math.round(px.I * 2); i < k; i++) {
            const a = a0 + (i / k) * Math.PI * 2;
            sparks.push({ hit: 1, a, r: R + maxLen * 0.4, v: (900 + Math.random() * 500) * dpr, life: 1, c: colAt(a / (Math.PI * 2)) });
          }
        }
        n = Math.round(n * 0.4);
      }
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        sparks.push({ a, r: R + maxLen * 0.6, v: (160 + Math.random() * 260) * dpr * (1 + px.drop * 0.8), life: 1, c: colAt(a / (Math.PI * 2)) });
      }
    }
    // Drop: drei Ringe hintereinander
    if (px.dropHit) for (let k = 0; k < 3; k++) rings.push({ r: R - k * 46 * dpr, a: 0.95 - k * 0.2, w: 7 - k * 2 });
    // Funken im Tempo der Regie: im Break schweben sie langsam, im Drop schießen sie
    const sdt = dt * clamp(px.speed ?? 1, 0.4, 1.5);
    // Regen lebt lange (fällt langsam), Lichtstöße nur einen Augenblick
    sparks = sparks.filter((p) => (p.life -= sdt * (p.rain ? 0.3 : p.hit ? 3.2 : 1.15)) > 0 && !(p.rain && p.y > vh * 0.64));
    for (const p of sparks) {
      if (p.rain) {
        // Tropfen bleiben über dem Publikum: ab gut der halben Höhe blenden sie aus
        p.y += p.v * sdt;
        // Tropfen als Lichtfaden: oben durchsichtig, unten hell (statt eines harten Rechtecks)
        ctx.globalAlpha = clamp(0.6 * Math.min(1, p.life * 2) * clamp((vh * 0.64 - p.y) / (vh * 0.14), 0, 1), 0, 1);
        ctx.drawImage(rainSprite(p.c), p.x - 1.5 * dpr, p.y - 4 * dpr, 4.6 * dpr, 22 * dpr);
        ctx.globalAlpha = 1;
        continue;
      }
      if (p.hit) {
        p.r += p.v * sdt;
        p.v *= Math.exp(-sdt * 4);
        const c = Math.cos(p.a), sn = Math.sin(p.a), l = 34 * dpr * p.life;
        ctx.lineWidth = 2.2 * dpr;
        ctx.strokeStyle = rgba(p.c, (0.75 * p.life).toFixed(3));
        ctx.beginPath();
        ctx.moveTo(cx + c * p.r, cy + sn * p.r);
        ctx.lineTo(cx + c * (p.r + l), cy + sn * (p.r + l));
        ctx.stroke();
        continue;
      }
      p.r += p.v * sdt;
      p.v *= Math.exp(-sdt * 1.6);
      // weicher Funke mit hellem Kern (Leuchtpunkt) statt einer harten Scheibe
      const sr = (2.4 + p.life * 4.6) * dpr;
      ctx.globalAlpha = clamp(p.life * 0.95, 0, 1);
      ctx.drawImage(vizSprite(p.c), cx + Math.cos(p.a) * p.r - sr, cy + Math.sin(p.a) * p.r - sr, sr * 2, sr * 2);
    }
    ctx.globalAlpha = 1;
    drawMotes(ctx, dt, dpr, pal);
  }

  // Melodie-Laser: zwei gespiegelte, dünne Laser aus dem Cover; ihr Öffnungswinkel folgt der Tonhöhe der
  // Melodie (Quintenzirkel), mit kurzer Leuchtspur – sie „singen“ mit
  const melody = { a: 0, trail: [] };
  function drawMelody(ctx, cx, cy, R, dpr, dt, px, rgba, colAt) {
    const on = px.pitch >= 0 && px.tone > 0.35 && px.low < 0.6;
    const target = on ? (((px.pitch * 7) % 12) / 11) * 2 - 1 : melody.a * 0.98; // -1..1
    melody.a += (target - melody.a) * (1 - Math.exp(-dt * 7));
    melody.trail.unshift(melody.a);
    if (melody.trail.length > 10) melody.trail.length = 10;
    const strength = (on ? 0.25 + px.tone * 0.6 : 0.1) * (0.4 + px.energy * 0.6);
    if (strength < 0.05) return;
    const far = Math.hypot(vw, vh);
    melody.trail.forEach((a, i) => {
      const al = strength * (1 - i / 10) ** 2;
      const spread = 0.35 + (a + 1) * 0.55; // 0,35 … 1,45 rad neben der Senkrechten
      for (const side of [-1, 1]) {
        const ang = -Math.PI / 2 + side * spread;
        const c = colAt(0.15 + i * 0.03 + (side > 0 ? 0.5 : 0));
        const x0 = cx + Math.cos(ang) * R, y0 = cy + Math.sin(ang) * R, x1 = cx + Math.cos(ang) * far, y1 = cy + Math.sin(ang) * far;
        for (const [lw, f] of [[9 * dpr, 0.18], [1.6 * dpr, 1]]) {
          ctx.lineWidth = lw;
          ctx.strokeStyle = rgba(i ? c : c.map((v) => (v + 255) / 2), (al * f).toFixed(3));
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }
    });
  }

  // Lichtfarben für die Location: erst ab einer sichtbaren Änderung (6 Stufen in einem Kanal) neue. Die Farben gleiten
  // sonst fast jedes Bild ein wenig (Melodie, Tonart, Übergänge) – und jede neue Farbe hieß neue Leuchtbilder im Thread
  // (gemessen: ~17 je Sekunde, tools/party-perf.js). Leuchtende Flächen zeigen 6 Stufen nicht.
  let venuePal = null;
  function venuePalOf(pal) {
    if (venuePal && venuePal.every((c, i) => Math.abs(c[0] - pal[i][0]) < 6 && Math.abs(c[1] - pal[i][1]) < 6 && Math.abs(c[2] - pal[i][2]) < 6)) return venuePal;
    return (venuePal = pal.map((c) => [c[0], c[1], c[2]]));
  }
  /* ---- Party-Location: im Hintergrund-Thread (OffscreenCanvas), sonst hier im Fenster */
  // erst bei Bedarf gebaut und beim Freigeben verworfen: hält im Ersatzfall (ohne Thread) die Körperbilder
  let venueLocal = null;
  const local = () => (venueLocal ||= createVenue((w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }));
  const glowSprite = (c) => local().glowSprite(c);
  let venueWorker = null, venueCtx = null, venueOn = false, venueBusy = false, venueSentAt = 0, venueDt = 0, venuePaced = false, venueDoneAt = 0;
  // venueUrl: eine Blob-URL für alle Threads (neu anlegen hieße jedes Mal eine neue, nie freigegebene URL);
  // venueGiven: das Canvas gehört schon einem (beendeten) Thread und lässt sich nicht noch einmal übergeben
  let venueUrl = "", venueGiven = false, venueNoThread = false;
  const venueHold = { dropHit: false, hit: false };
  let venueFlashGo = false;
  // frisches Canvas an die Stelle des alten (das alte gehört dem Thread oder wird freigegeben)
  function venueSwap() {
    const n = q.venueEl.cloneNode(false);
    // die Kopie erbt die Größe des alten: leer anfangen, das erste Bild setzt sie
    n.width = n.height = 0;
    q.venueEl.replaceWith(n);
    q.venueEl = n;
    venueGiven = false;
  }
  function venueInit() {
    if (venueWorker || venueCtx) return;
    if (venueNoThread) return venueFallback();
    try {
      if (typeof __VENUE_WORKER__ === "string" && q.venueEl.transferControlToOffscreen && window.Worker) {
        venueUrl ||= URL.createObjectURL(new Blob([__VENUE_WORKER__], { type: "text/javascript" }));
        const w = new Worker(venueUrl);
        if (venueGiven) venueSwap();
        const off = q.venueEl.transferControlToOffscreen();
        venueGiven = true;
        w.postMessage({ type: "init", canvas: off }, [off]);
        w.onerror = () => venueFallback();
        w.onmessage = (e) => {
          if (e.data?.type === "done") {
            [venueBusy, venueDoneAt] = [false, performance.now()];
            // Messung (tools/party-perf.js): Zeichenzeit und Werte je Ebene aus dem Thread
            if (e.data.ms != null) window.__miragePerf?.venue?.(e.data);
          }
          else if (e.data?.type === "ready") [venuePaced, venueDoneAt] = [!!e.data.paced, performance.now()];
        };
        venueWorker = w;
        return;
      }
    } catch {}
    venueFallback();
  }
  // Thread nicht erlaubt oder abgestürzt: ein frisches Canvas (das alte gehört dem Thread) und hier zeichnen
  function venueFallback() {
    try {
      venueWorker?.terminate();
    } catch {}
    venueWorker = null;
    venueNoThread = true;
    venueSwap();
    venueCtx = q.venueEl.getContext("2d");
  }
  // Freigeben: Thread beenden (mit ihm gehen Körperbilder, Leuchtpunkte, Überblend-Kopie und sein Canvas),
  // im Ersatzfall Canvas auf 0 × 0 und die Location verwerfen. Das nächste Party-Bild baut alles neu auf
  // (gemessen: erstes Bild nach gut 100 ms statt nach gut 50 ms).
  let venueDrop = 0;
  function venueRelease() {
    clearTimeout(venueDrop);
    venueDrop = 0;
    if (venueWorker) {
      venueWorker.terminate();
      venueWorker = null;
      venueSwap();
    } else if (venueCtx) {
      venueCtx = null;
      q.venueEl.width = q.venueEl.height = 0;
    }
    venueLocal = null;
    venueOn = venueBusy = venuePaced = false;
    venueDt = 0;
    venueHold.dropHit = venueHold.hit = venueFlashGo = false;
  }
  function venueLater(ms) {
    clearTimeout(venueDrop);
    venueDrop = setTimeout(() => {
      // sichtbar mit stehender Party (Pause, Bildschleife ruht): das letzte Bild bleibt stehen, nicht freigeben
      if (isOpen() && el.dataset.mode === "party" && !document.hidden) return;
      venueRelease();
    }, ms);
  }
  function venueFrame(st) {
    clearTimeout(venueDrop);
    venueInit();
    venueOn = true;
    // Messung (tools/party-perf.js): nur, wenn das Messwerkzeug zuhört
    if (window.__miragePerf) st.prof = true;
    // Der Thread zeichnet noch? Dann dieses Bild auslassen und die Zeit fürs nächste aufheben –
    // ein Rückstau ließe Publikum und Licht hinterherhinken und ruckweise aufholen
    venueDt = Math.min(0.1, venueDt + st.dt);
    // einmalige Signale (Drop, Treffer) gehen beim Auslassen nicht verloren
    venueHold.dropHit ||= !!st.px.dropHit;
    venueHold.hit ||= !!st.px.hit;
    venueFlashGo ||= !!st.flashGo;
    if (venueWorker) {
      const now = performance.now();
      // Zeichnet der Thread im eigenen Bildtakt (venue-worker.js), bekommt er jeden Zustand und legt selbst zusammen;
      // ausgelassen wird nur, wenn er seit 250 ms kein Bild fertig hat (hängt) – sonst wie bisher: erst nach „fertig“
      const stuck = venuePaced ? now - venueDoneAt > 250 : venueBusy;
      if (stuck && now - venueSentAt < 250) return;
      st.dt = venueDt;
      venueDt = 0;
      Object.assign(st.px, venueHold);
      st.flashGo = venueFlashGo;
      venueHold.dropHit = venueHold.hit = venueFlashGo = false;
      venueBusy = true;
      venueSentAt = now;
      venueWorker.postMessage({ type: "frame", st });
      return;
    }
    st.dt = venueDt;
    venueDt = 0;
    venueHold.dropHit = venueHold.hit = venueFlashGo = false;
    if (venueCtx) {
      if (q.venueEl.width !== st.vw || q.venueEl.height !== st.vh) [q.venueEl.width, q.venueEl.height] = [st.vw, st.vh];
      const t0 = st.prof ? performance.now() : 0;
      local().draw(venueCtx, st);
      if (st.prof) window.__miragePerf?.venue?.({ ms: performance.now() - t0, w: st.vw, h: st.vh, local: true, stats: local().stats() });
    }
  }
  function venueClear() {
    if (!venueOn) return;
    venueOn = false;
    if (venueWorker) venueWorker.postMessage({ type: "clear" });
    else venueCtx?.clearRect(0, 0, q.venueEl.width, q.venueEl.height);
  }

  /* ---------------------------------------------------------------- Party-Erweiterungen */
  let motes = [], hype = new Set(), hypeOn = false;
  // Einstellungen für Kameraschnitte: [Zoom, Versatz x, Versatz y] (Anteil der Fenstergröße). Der Zoom geht
  // von der Bildmitte aus und schöbe das Publikum unten aus dem Bild – darum unten verankert (y ≈ −(Zoom−1)/2)
  const SHOTS = [[1, 0, 0], [1.13, 0.05, -0.065], [1.13, -0.05, -0.065], [1.22, 0, -0.13], [1.07, 0, -0.02]];
  const shot = { i: 0, s: 1, x: 0, y: 0, bars: 0, bar: -1 };
  const cam = { s: 1, x: 0, y: 0, key: "" }, depth = { x: 0, y: 0, tx: 0, ty: 0, at: 0, key: "" };
  // pro Bild, vor dem Zeichnen: Übergang, Hype, Kamera, 3D-Tiefe, Liedtext-Funken, Live-Zustand fürs Overlay
  // Läuft Party zu langsam (unter ~48 Bilder/s über 2 s), schaltet Mirage teure Details selbst herunter:
  // Stufe 1 = hintere Publikumsreihe, halbe Strahlen, weniger Funken · Stufe 0 = ohne Publikum, Kamera und Tiefe.
  // Läuft es lange flüssig, geht es wieder hoch.
  // f1/f2: gleitende Anteile „mindestens Stufe 1/2“ (0..1, ~1 s) – ein Stufenwechsel mitten im Song blendet über,
  // statt Punkte, Verläufe und Strahlen im selben Bild umzuschalten (instfx.js, stagefx.js über st.qf)
  const quality = { level: 2, slow: 0, fast: 0, ema: 1 / 60, f1: 1, f2: 1 };
  function tuneQuality(dt) {
    quality.f1 = lowpass(quality.f1, quality.level >= 1 ? 1 : 0, dt, 0.35);
    quality.f2 = lowpass(quality.f2, quality.level >= 2 ? 1 : 0, dt, 0.35);
    quality.ema += (dt - quality.ema) * 0.05;
    // erst bei deutlich unter 40 Bildern/s über 4 s eine Stufe runter, schon nach 5 s flüssig wieder hoch
    if (quality.ema > 1 / 40) {
      quality.fast = 0;
      if ((quality.slow += dt) > 4 && quality.level > 0) [quality.level, quality.slow] = [quality.level - 1, 0];
    } else if (quality.ema < 1 / 52) {
      quality.slow = 0;
      if ((quality.fast += dt) > 5 && quality.level < 2) [quality.level, quality.fast] = [quality.level + 1, 0];
    }
  }
  let lastJk = "";
  function partyExtras(px, now, dt, R, dpr) {
    tuneQuality(dt);
    // Jam-Gäste wippen mit der Kick (eine CSS-Variable, die Bewegung macht der Browser)
    if (!q.jam.hidden) {
      const jk = (px.kickEnv * (0.35 + 0.65 * px.energy) * (1 - px.low * 0.8)).toFixed(2);
      if (jk !== lastJk) q.jam.style.setProperty("--jk", (lastJk = jk));
    }
    // die echte Kick (aus der Klangfarbe) treibt Strahlen, Scheinwerfer, Kranz und Puls – je mehr Energie, desto mehr
    px.accent = Math.max(px.accent, px.kickEnv * (0.25 + 0.75 * px.energy) * (1 - px.low * 0.8));
    // Hintergrund atmet mit: Kick, Energie, Refrain und Drop heben die Farbfläche (nur Deckkraft – billig)
    // („Keine Blitze“: ohne den Kick-Anteil, die Fläche folgt dann nur der langsamen Energie)
    px.ambient = clamp(0.04 + (cfg.noFlash ? 0 : px.kickEnv * 0.2 * px.I) + px.drop * 0.16 + (hypeOn ? 0.06 : 0) + px.build * 0.08 + (px.glow || 0), 0, 0.42) * (1 - px.low * 0.7);
    // Lichtregie: vor dem Drop wird es ruhiger und gespannter, auf dem letzten Schlag davor ist es dunkel –
    // dann schlägt der Drop ein. Im letzten Refrain gibt das Licht alles.
    if (px.blackout) {
      px.I *= 0.06;
      px.accent *= 0.05;
      px.kickEnv *= 0.1;
      px.bass *= 0.1;
      px.bassPulse = 0;
      px.beamVis = 0;
      px.flash = 0;
      px.ambient = 0;
    } else if (px.tension) {
      px.I *= 1 - 0.45 * px.tension;
      px.build = Math.max(px.build, px.tension);
      px.ambient *= 1 - 0.6 * px.tension;
    }
    if (px.finale) {
      px.I = Math.min(1.35, px.I + 0.2);
      px.beamVis = Math.min(1.2, px.beamVis + 0.25);
      px.lasers = Math.round(px.lasers * 1.5);
    }
    // unter voller Qualität: halb so viele Strahlen, schwächerer Kranz – gleitend: der Kranz folgt f2 stetig, die Zahl der
    // Strahlen wechselt in der Mitte des Übergangs, während die Strahlen kurz ausgeblendet sind (kein Sprung im Fächer)
    const f2 = quality.f2;
    if (f2 < 0.5) px.lasers = Math.round(px.lasers / 2);
    if (f2 < 0.999) {
      px.lvl = Math.min(px.lvl, 1.6 + Math.max(0, px.lvl - 1.6) * f2);
      const d = Math.min(1, Math.abs(2 * f2 - 1) / 0.6);
      px.beamVis *= d * d * (3 - 2 * d);
    }
    // Übergang zwischen Songs (party.js): die erste Eins des neuen Songs landet mit zwei Ringen
    // (fällt sie mit dem Drop-Bild der Regie zusammen, führt das Drop-Bild – keine Ringe zusätzlich)
    if (px.land && !((px.scn?.dx || 0) > 0.3)) rings.push({ r: R, a: 0.9, w: 6 }, { r: R - 40 * dpr, a: 0.7, w: 4 });
    showMoments(px, now);
    // Hype-Zeile: alles eine Spur heller und stärker
    if (hypeOn) {
      px.I = Math.min(1.35, px.I + 0.15);
      px.beamVis = Math.min(1.2, px.beamVis + 0.2);
    }
    if (px.dropHit) {
      recap.drops++;
      recap.peak = { title: q.title.textContent, artist: q.artist.textContent };
    }
    // Liedtext-Funken: beim Drop zerfällt die aktive Zeile in Lichtteilchen, die in die Strahlen fliegen
    if (px.dropHit && cfg.partyShatter && px.fx && activeEl && !cfg.noFlash) {
      activeEl.classList.remove("is-burst");
      void activeEl.offsetWidth;
      activeEl.classList.add("is-burst");
      const pal3 = vividPal || imPalette();
      const words3 = activeEl.querySelectorAll(".m-w");
      for (const w of words3.length ? words3 : [activeEl]) {
        const b = w.getBoundingClientRect();
        for (let k = 0; k < Math.min(14, 3 + b.width / 14); k++) {
          const x = b.left + Math.random() * b.width, y = b.top + Math.random() * b.height;
          const [lx, ly] = toLocal(x, y);
          motes.push({ x: lx * dpr, y: ly * dpr, vx: (Math.random() - 0.5) * 420 * dpr, vy: -(120 + Math.random() * 420) * dpr, life: 1, c: pal3[k % 3] });
        }
        if (motes.length > 600) break;
      }
    }
    // Kamerafahrt: in ruhigen Stellen weit, mit der Energie näher, beim Drop ein kurzer Ruck; langsames Schweben
    // Kameraschnitte: harte Schnitte auf dem Taktanfang zwischen festen Einstellungen (weit, nah links/rechts,
    // in die Menge, von oben) – alle 8 Takte, in der Spitze alle 4; der Drop schneidet zurück auf die Totale
    if ((cfg.partyCamera || cfg.partyCuts) && px.fx && quality.level > 0) {
      const t = now / 1000;
      if (cfg.partyCuts) {
        // neuer Takt: der erste Schlag des Takts hat sich geändert (übersteht auch ein übersprungenes Bild)
        const barId = px.beatIdx - (px.inBar || 0), newBar = px.beatIdx >= 0 && barId !== shot.bar;
        if (px.beatIdx >= 0) shot.bar = barId;
        if (px.dropHit && shot.i) [shot.i, shot.bars] = [0, 0];
        else if (newBar) {
          shot.bars++;
          const hot = px.energy > 0.55 && px.low < 0.3 && !px.blackout;
          if (!hot) shot.i = 0;
          else if (shot.bars >= (px.finale || px.drop > 0.3 ? 4 : 8)) {
            let i;
            do i = 1 + Math.floor(Math.random() * (SHOTS.length - 1));
            while (i === shot.i);
            [shot.i, shot.bars] = [i, 0];
          }
        }
      } else shot.i = 0;
      // Schnitt = schneller, weicher Schwenk (~⅓ s) – ein harter Sprung ließ Publikum und Bühne ruckeln;
      // zurück zur Totalen in ruhigen Stellen = langsam
      const [ss, sx, sy] = SHOTS[shot.i];
      const k1 = 1 - Math.exp(-dt * (shot.i ? 9 : 1.5));
      shot.s += (ss - shot.s) * k1;
      shot.x += (sx - shot.x) * k1;
      shot.y += (sy - shot.y) * k1;
      const target = cfg.partyCamera ? 1 + (0.012 + 0.03 * px.energy + 0.025 * px.drop) * (1 - px.low * 0.8) : 1;
      // Grundzoom gleitet; der Ruck beim Drop ist ein kurzer, gefederter Stoß statt eines Sprungs
      cam.b = (cam.b ?? 1) + (target - (cam.b ?? 1)) * (1 - Math.exp(-dt * 1.2));
      if (px.dropHit && cfg.partyCamera) cam.kick = 0.035;
      cam.kick = (cam.kick || 0) * Math.exp(-dt * 2.5);
      cam.kv = (cam.kv || 0) + (cam.kick - (cam.kv || 0)) * (1 - Math.exp(-dt * 16));
      const ride = cfg.partyCamera ? 0.5 + px.energy : 0;
      cam.s = (cam.b + cam.kv) * shot.s;
      cam.x = Math.sin(t * 0.05) * innerWidth * 0.008 * ride + shot.x * innerWidth;
      cam.y = Math.cos(t * 0.037) * innerHeight * 0.006 * ride + shot.y * innerHeight;
      // nur die Bühne bewegt sich (Hintergrund hier, Licht und Publikum im Canvas) – Cover, Liedtext
      // und Bedienung bleiben stehen: nichts rutscht aus dem Bild, kein Spotify-Rand blitzt durch
      // auf Zehntelpixel: ganze Pixel ließen das langsame Schweben sichtbar stufen
      const k = `${cam.x.toFixed(1)}|${cam.y.toFixed(1)}`;
      if (k !== cam.key) {
        cam.key = k;
        q.bg.style.translate = `${cam.x.toFixed(1)}px ${cam.y.toFixed(1)}px`;
      }
    } else if (cam.key || cam.s !== 1) {
      // aus (z. B. die Qualitätsregelung schaltet unter Last ab): weich in die Mitte zurück, nicht springen
      const k = 1 - Math.exp(-dt * 4);
      cam.b = cam.s += (1 - cam.s) * k;
      cam.x -= cam.x * k;
      cam.y -= cam.y * k;
      cam.kick = cam.kv = 0;
      shot.i = shot.bars = 0;
      shot.s += (1 - shot.s) * k;
      shot.x -= shot.x * k;
      shot.y -= shot.y * k;
      if (Math.abs(cam.s - 1) < 0.0008 && Math.abs(cam.x) < 0.2 && Math.abs(cam.y) < 0.2) {
        Object.assign(cam, { s: 1, b: 1, kick: 0, kv: 0, x: 0, y: 0, key: "" });
        Object.assign(shot, { i: 0, s: 1, x: 0, y: 0, bars: 0 });
        q.bg.style.translate = "";
      } else {
        cam.key = "out";
        q.bg.style.translate = `${cam.x.toFixed(1)}px ${cam.y.toFixed(1)}px`;
      }
    }
    // 3D-Tiefe: Liedtext, Titel und Licht liegen auf verschiedenen Ebenen; ohne Maus schwebt die Szene leise
    if (cfg.partyDepth && px.fx && quality.level > 0) {
      const t = now / 1000, idle = now - depth.at > 2500;
      const tx = idle ? Math.sin(t * 0.21) * 0.25 : depth.tx, ty = idle ? Math.cos(t * 0.17) * 0.18 : depth.ty;
      depth.x += (tx - depth.x) * (1 - Math.exp(-dt * 3));
      depth.y += (ty - depth.y) * (1 - Math.exp(-dt * 3));
      const k = `${depth.x.toFixed(3)}|${depth.y.toFixed(3)}`;
      if (k !== depth.key) {
        // Titelblock in Hundertstel- statt Zehntelpixeln: er liegt in Party auf einer eigenen Ebene (will-change in user.css)
        // und gleitet so stufenlos, ohne neu gezeichnet zu werden (der Liedtext bleibt bei Zehnteln: er würde sonst jedes Bild neu gemalt)
        depth.key = k;
        q.lyrics.style.translate = `${(-depth.x * 22).toFixed(1)}px ${(-depth.y * 12).toFixed(1)}px`;
        q.meta.style.translate = `${(-depth.x * 12).toFixed(2)}px ${(-depth.y * 7).toFixed(2)}px`;
        // das Licht-Canvas wird NICHT gekippt (sonst schwenkt eine Bildecke ein und das Publikum fehlt dort) –
        // Bühnenlicht und Publikum verschieben sich stattdessen in der Bühnen-Kamera (stageCam)
      }
    } else if (depth.key) {
      // aus: Liedtext und Titel gleiten in die Ruhelage zurück, statt zu springen
      const k = 1 - Math.exp(-dt * 4);
      depth.x -= depth.x * k;
      depth.y -= depth.y * k;
      if (Math.abs(depth.x) < 0.004 && Math.abs(depth.y) < 0.004) {
        depth.x = depth.y = 0;
        depth.key = "";
        q.canvas.style.transform = q.lyrics.style.translate = q.meta.style.translate = "";
      } else {
        depth.key = "out";
        q.lyrics.style.translate = `${(-depth.x * 22).toFixed(1)}px ${(-depth.y * 12).toFixed(1)}px`;
        q.meta.style.translate = `${(-depth.x * 12).toFixed(2)}px ${(-depth.y * 7).toFixed(2)}px`;
      }
    }
    // fürs Overlay (Kantenlicht): der aktuelle Lichtzustand
    party.live = { at: now, a: +px.accent.toFixed(3), k: +px.kickEnv.toFixed(3), e: +px.energy.toFixed(3), d: +px.drop.toFixed(3), pal: vividPal };
    // Liedtext zum Mitsingen auf den Handys: aktuelle und nächste Zeile (nur synchroner Liedtext)
    const lineAt = (k) => (lyr?.synced && k >= 0 && lyr.lines[k]?.text !== "♪" && lyr.lines[k]?.text) || "";
    live.feed(px, vividPal || imPalette(), party.info.bpm, { ly: lineAt(active), lyn: lineAt(active + 1) });
  }
  const toLocal = (x, y) => [x, y];
  function drawMotes(ctx, dt, dpr) {
    if (!motes.length) return;
    motes = motes.filter((m) => (m.life -= dt * 0.7) > 0);
    for (const m of motes) {
      m.vx *= Math.exp(-dt * 1.2);
      m.vy = m.vy * Math.exp(-dt * 1.2) - 40 * dpr * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const r = (6 + m.life * 10) * dpr;
      ctx.globalAlpha = clamp(m.life * 1.2, 0, 1);
      ctx.drawImage(glowSprite(m.c), m.x - r, m.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  // Eco (Akku oder fest an) und ruhige Party-Stellen: höchstens 30 Bilder pro Sekunde
  let lastDraw = 0, onBattery = false, quietNow = false, quietSince = 0, songAt = 0;
  // gemessene Bildschirmrate: Abstände der letzten 60 Bildaufrufe, Rate (0 = noch unbekannt), Aufrufe seit dem letzten Bild
  const rafD = new Array(60).fill(0);
  let lastRaf = 0, rafN = 0, hzNow = 0, sinceDraw = 0;
  try {
    navigator.getBattery?.().then((b) => {
      const upd = () => (onBattery = !b.charging);
      upd();
      b.addEventListener("chargingchange", upd);
    });
  } catch {}
  const ecoOn = () => cfg.eco === "on" || (cfg.eco === "auto" && onBattery);
  // Leerlauf: Musik pausiert, kein Spiel, keine Handys am Live-Link → nach kurzem Ausklingen (Konfetti,
  // abfallende Balken) steht die Bildschleife ganz, statt ein stehendes Bild 60-mal pro Sekunde neu zu
  // zeichnen. kick() weckt sie: Maus, Taste, Play, Songwechsel, neue Daten, Fenstergröße.
  const REST = 6000;
  let restAt = 0;
  const busy = () => PLR.isPlaying() || !!games.active() || (el.dataset.mode === "party" && cfg.partyLive);
  // Ruhige Cover-Ansicht (1.27): dort bewegt sich ohne Maus nur der Fortschrittsbalken (wenige Pixel pro Sekunde)
  // und die Zeit. Statt 60 Bildern pro Sekunde reichen dann 4 – den Balken schiebt der Browser dazwischen weich
  // weiter (Übergang in user.css, .m-sparse). Maus, Taste, Play, Ansichtswechsel → kick() → sofort wieder jedes Bild.
  const SPARSE_MS = 250;
  let sparseT = 0, sparseFill = -1;
  function kick() {
    restAt = performance.now() + REST;
    clearTimeout(sparseT);
    sparseT = 0;
    if (!raf && isOpen() && !clockStill(performance.now())) raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    // Verdeckt/minimiert: nichts zeichnen. Chromium hält rAF dann meist selbst an, ein CEF, das weiter Bilder
    // anfordert, zeichnete sonst unsichtbar mit voller Rate (gemessen: Party 125 ms Hauptthread je Sekunde).
    // Handys bedient dann hiddenTick, beim Sichtbarwerden weckt der visibilitychange-Handler unten per kick().
    if (document.hidden) return void (raf = 0);
    // Uhr-Ansicht ohne Bewegung: keine Bildschleife (1.27 views)
    if (clockStill(now)) return void (raf = 0);
    if (busy()) restAt = now + REST;
    else if (now > restAt) return void (raf = 0);
    raf = requestAnimationFrame(frame);
    // Bildrate je nach Preset: Leicht/Ruhig/Energiesparen/ruhige Party-Stellen 30, Ausgewogen höchstens 60
    // (auf 120/144-Hz-Bildschirmen halbiert das die Arbeit), Voll so schnell wie der Bildschirm.
    // Die Obergrenze wird zu einem ganzzahligen Teiler der gemessenen Bildschirmrate (fxenv.js): jedes d-te Bild, also
    // immer gleich lange Abstände – „höchstens 60“ auf 144 Hz gab sonst einen Wechsel aus 2 und 3 Bildern (Ruckeln),
    // auf 75 Hz fiel jedes zweite Bild aus (~37 Bilder/s). Solange die Rate noch nicht gemessen ist: wie bisher
    // (3 ms Spielraum, damit ein leicht zu früh kommendes Bild nicht ausfällt).
    if (lastRaf && now - lastRaf < 50) {
      rafD[rafN++ % rafD.length] = now - lastRaf;
      if (rafN % rafD.length === 0) hzNow = refreshFrom(rafD) || hzNow;
    }
    lastRaf = now;
    const tr = tier();
    const fpsCap = ecoOn() || lightMode() || tr === "calm" || (quietNow && cfg.partyQuietFps) ? 30 : tr === "full" ? 0 : 60;
    const div = fpsCap && hzNow ? fpsDivisor(hzNow, fpsCap) : 1;
    if (fpsCap && hzNow) {
      // (ein ausgefallener Bildaufruf zählt über die Zeit mit: spätestens nach d − ½ Bildern wird gezeichnet)
      if (++sinceDraw < div && now - lastDraw < ((div - 0.5) * 1000) / hzNow) return;
    } else if (fpsCap && now - lastDraw < 1000 / fpsCap - 3) return;
    sinceDraw = 0;
    const fdt = Math.min(0.1, lastDraw ? (now - lastDraw) / 1000 : 0.016);
    lastDraw = now;
    coverMotion(fdt, fpsCap && hzNow ? hzNow / div : fpsCap);
    if (sizeKey !== sizeKeyNow()) sizeCanvas();
    // gleichmäßige Songuhr mit Vorlauf (siehe clock.js) – Party, Visualizer und Karaoke laufen danach
    const pos = songPos(now);
    const dur = PLR.getDuration() || 0;
    // scaleX statt width: kein Neu-Layout in jedem Bild
    // (in 1/2000-Schritten – unter einem Pixel der Leiste: in vier Nachkommastellen änderte sie sich fast jedes Bild,
    // und jede Änderung hieß eine Stil-Neuberechnung im Hauptthread, tools/party-perf.js)
    const fillV = dur ? clamp(pos / dur, 0, 1) : 0, fill = `scaleX(${(Math.round(fillV * 2000) / 2000).toFixed(4)})`;
    const mode = el.dataset.mode;
    // seltener zeichnen nur in der Cover-Ansicht, Feder in Ruhe, Maus seit 1,5 s still, keine Blende vom Visualizer
    const sparse = mode === "cover" && tilt.rest && now - depth.at > 1500 && !(vw && now < vizFadeUntil);
    // der Balken gleitet nur bei kleinen Schritten vorwärts – Spulen und Songwechsel springen wie bisher
    const glide = sparse && sparseFill >= 0 && fillV >= sparseFill && fillV - sparseFill < 0.01;
    if (glide !== el.classList.contains("m-sparse")) el.classList.toggle("m-sparse", glide);
    sparseFill = sparse ? fillV : -1;
    if (fill !== lastFill) q.fill.style.transform = lastFill = fill;
    // Schein der Leiste (eigene, nicht gestreckte Ebene in user.css) endet an der Spitze – Tausendstel genügen
    const fillP = fillV.toFixed(3);
    if (fillP !== lastFillP) q.fill.parentElement?.style.setProperty("--m-p", (lastFillP = fillP));
    if (album.shown) album.tick(pos, dur);
    if (now - lastText > 250) {
      lastText = now;
      q.pos.textContent = fmt(pos);
      q.dur.textContent = fmt(dur);
      seekLabel(pos, dur);
      syncState();
    }
    // (auch im Party-Modus: dort zeichnet der Stil das Cover im Takt der Party – Drop, betonte Schläge)
    const shatterOn = VIZ.has(mode) && OWN_COVER.has(cfg.vizStyle) && !cfg.calm;
    if (el.classList.contains("is-shatter") !== shatterOn) el.classList.toggle("is-shatter", shatterOn);
    // Messung (tools/party-perf.js): Zeit für Liedtext und Bild in diesem Aufruf
    const perf = window.__miragePerf, tp0 = perf ? performance.now() : 0;
    if (LYR.has(mode)) drawLyrics(pos);
    const tp1 = perf ? performance.now() : 0;
    if (VIZ.has(mode) || (vw && now < vizFadeUntil)) {
      // ein Fehler in einem Bild darf den Visualizer nicht dauerhaft lahmlegen: Zustand zurücksetzen,
      // das nächste Bild fängt sauber neu an
      try {
        drawViz(pos, now);
        if (mode === "party" && cfg.partyWords && !cfg.calm && wfxGeo) {
          const g = wfxGeo, dtw = Math.min(0.12, wfxAt ? (now - wfxAt) / 1000 : 0.016);
          wfxAt = now;
          wordFx.draw(vctx, {
            pos, now, dt: dtw, w: vw, h: vh, dpr: g.dpr, cx: g.cx, cy: g.cy, R: g.R, pal: vividPal || imPalette(),
            level: cfg.partyLevel ?? 2, beat: g.px.accent || 0, beatIdx: g.px.beatIdx, playing: PLR.isPlaying(), noFlash: !!cfg.noFlash,
            // Blitze der Wortbilder: aus dem Blitz-Budget des Party-Modus (party.js)
            takeFlash: party.takeFlash,
          });
        }
      } catch (e) {
        vizReset();
        if (!vizErr) console.warn("[Mirage] Visualizer:", (vizErr = e));
      }
    }
    if (perf) perf.main?.(tp1 - tp0, performance.now() - tp1, vw, vh);
    // Jam-Leute alle 3 s nachsehen (wer kommt, wer geht) – nur im Party-Modus
    if (mode === "party" && now - lastJam > 3000) {
      lastJam = now;
      showJam();
    }
    if (!VIZ.has(mode) && lastPulse) {
      q.wrap.style.scale = "";
      lastPulse = "";
    }
    if (sparse) {
      cancelAnimationFrame(raf);
      raf = 0;
      sparseT = setTimeout(() => {
        sparseT = 0;
        if (!raf && isOpen() && !document.hidden) raf = requestAnimationFrame(frame);
      }, SPARSE_MS);
    }
  }

  // Canvas (Spotifys kurze Video-Loops): EIN Schalter für alle Ansichten (Film-Knopf oben oder „Mehr“ → Diese
  // Ansicht), anfangs aus. Cover und Visualizer zeigen es IM Cover, Mix und Party im runden Cover (in der Party
  // bleibt der Ring drumherum), der Liedtext gedämpft im Hintergrund. Die Uhr hat kein Canvas (dort steht Ruhe
  // im Vordergrund). Gespielt wird nur, was zu sehen ist.
  // Einschalten in Mirage schaltet Canvas auch in Spotify ein (lyrics.js enableSpotifyCanvas) – sonst liefert
  // Spotify für jeden Song „kein Canvas“.
  const CV_MODES = new Set(["cover", "lyrics", "viz", "mix", "party"]);
  const CV_HOW = { cover: "imCvCover", viz: "imCvCover", mix: "imCvMix", party: "imCvMix", lyrics: "imCvLyrics" };
  const canvasHint = (mode) => t(CV_HOW[mode] || "imCvCover");
  // Spotify-Canvas einschalten (falls aus) und den laufenden Song neu fragen; true: ist jetzt an
  async function spotifyCanvasOn() {
    if (!(await enableSpotifyCanvas())) return false;
    imToast(t("imCvSpotifyOn"));
    await setCanvas(currentItem());
    return true;
  }
  async function toggleCanvas() {
    if (!canvasUrl) {
      // ohne Canvas: ist es in Spotify aus, gleich mit einschalten; sonst erklärt der Knopf, warum es keins gibt
      if (await spotifyCanvasOn()) {
        if (canvasUrl && !cfg.canvasShow) {
          cfg.canvasShow = true;
          save();
          applyCanvas();
        }
        if (side === "menu") rebuildMenu();
        if (canvasUrl) return;
        // Spotify ist jetzt an, nur dieser Song hat keins: der Schalter bleibt für die nächsten Songs an
        if (!cfg.canvasShow) {
          cfg.canvasShow = true;
          save();
        }
      }
      return imToast(t((await canvasBlocked()) ? "canvasBlocked" : "canvasNone"), [], 6000);
    }
    cfg.canvasShow = !cfg.canvasShow;
    save();
    applyCanvas();
    if (side === "menu") rebuildMenu();
  }
  let canvasToken = 0, canvasUrl = null, canvasAsked = null;
  async function setCanvas(item) {
    const token = ++canvasToken;
    canvasUrl = null;
    applyCanvas();
    const want = cfg.canvas && !cfg.calm;
    // AV1-Fassung: im leichten Modus die kleinere (spart Decoder und Speicher)
    const maxW = lightMode() ? 480 : 720;
    let url = want ? await getCanvas(item?.uri, maxW) : null;
    // schon länger eingeschaltet, aber Spotify hat Canvas aus: einmal je Sitzung mit einschalten
    // (alle Abrufe warten auf dasselbe Einschalten – sonst prüft ein späterer, bevor es fertig ist, und gewinnt)
    if (!url && want && cfg.canvasShow) await (canvasAsked ||= enableSpotifyCanvas());
    // gerade eingeschaltet (hier, im Menü oder in den Einstellungen): Spotify braucht einen Moment
    if (!url && want && canvasFresh()) url = await canvasAfterEnable(item?.uri, maxW);
    if (token !== canvasToken) return;
    canvasUrl = url;
    applyCanvas();
    if (side === "menu") rebuildMenu();
  }
  function playIn(v, on) {
    if (!v) return;
    if (!on) {
      v.classList.remove("is-on");
      v.pause();
      return;
    }
    if (v.getAttribute("src") !== canvasUrl) v.src = canvasUrl;
    v.play()
      .then(() => {
        v.classList.add("is-on");
        // Einstellung „Canvas aufs Motiv ausrichten“ (Standard aus): Ausschnitt einmal je Video, Zoom nur im Cover
        if (cfg.canvasFocus) focusCanvas(v, v === q.cvid);
        else resetFocus(v);
      })
      .catch(() => v.classList.remove("is-on"));
  }
  // Kopfzeile: überlappen die Knöpfe rechts die mittigen Ansichten, rücken die Ansichten nach links
  // 1.27 polish: ohne die Klasse kurz abzunehmen und neu zu messen (kostete ein Layout); geprüft wird, wo die Reiter
  // mittig stünden, und nur, wenn sie in derselben Zeile liegen (in kleinen Fenstern ordnet user.css sie selbst an)
  function fitTop() {
    if (!el) return;
    const tabs = el.querySelector(".m-im-tabs"), acts = el.querySelector(".m-im-actions")?.getBoundingClientRect();
    if (!tabs || !acts?.width) return;
    const r = tabs.getBoundingClientRect(), right = innerWidth / 2 + r.width / 2;
    const left = getComputedStyle(tabs).position === "absolute" && acts.top < r.bottom && acts.bottom > r.top && acts.left < right + 12;
    if (el.classList.contains("tabs-left") !== left) el.classList.toggle("tabs-left", left);
  }
  addEventListener("resize", () => requestAnimationFrame(fitTop));
  function applyCanvas() {
    if (!el || !q.cvbtn) return;
    // Der Knopf ist in passenden Ansichten immer da (sonst findet man die Funktion nie); ohne Canvas wird er
    // blass und sagt beim Klick, warum. So springt die Leiste auch nicht bei jedem Songwechsel.
    const mode = el.dataset.mode, show = cfg.canvas && !cfg.calm && CV_MODES.has(mode), can = show && !!canvasUrl;
    const on = can && !!cfg.canvasShow;
    // in der Uhr gibt es kein Canvas – dort auch keinen Knopf
    q.cvbtn.hidden = !show;
    q.cvbtn.classList.toggle("is-none", show && !canvasUrl);
    q.cvbtn.setAttribute("aria-pressed", String(on));
    // der Hinweis sagt, wie das Video in DIESER Ansicht erscheint (der Schalter selbst gilt für alle)
    q.cvbtn.title = q.cvbtn.ariaLabel = !canvasUrl ? t("canvasNone") : `${t(on ? "canvasOff" : "canvasOn")} · ${canvasHint(mode)}`;
    el.classList.toggle("has-canvas", on);
    requestAnimationFrame(fitTop);
    playIn(q.cvid, on);
    playIn(q.video, on && mode === "lyrics");
  }
  // Tastenkürzel-Übersicht (Taste ?): aus derselben Tabelle wie die Tastatursteuerung (shortcuts.js)
  // Es ist immer nur ein Menü offen: das neue schließt das vorherige
  let liveToken = 0;
  function closeMenus(keep) {
    if (keep !== "side" && side) showSide(null);
    if (keep !== "live") {
      liveToken++;
      closeLive();
    }
    if (keep !== "keys" && q.keys && !q.keys.hidden) toggleKeys(false);
    syncTriggers();
  }
  // welches Menü gerade offen ist (Seitenleiste, QR-Karte oder Tastenhilfe) – oder nichts
  const openMenu = () => (!el ? "" : side || (el.querySelector(".m-im-livecard:not(.is-out)") ? "live" : q.keys && !q.keys.hidden ? "keys" : ""));
  // Auslöser sagen an, ob ihr Menü offen ist (aria-expanded), und leuchten dabei wie gedrückt
  function syncTriggers() {
    if (!el) return;
    const cur = openMenu();
    for (const b of el.querySelectorAll("[data-menu]")) {
      const on = b.dataset.menu === cur;
      b.setAttribute("aria-expanded", String(on));
      b.classList.toggle("is-open", on);
    }
  }
  // Menü weich ausblenden und erst danach entfernen; der Zustand („zu“) gilt sofort
  function fadeOut(node) {
    if (!node || node.classList.contains("is-out")) return;
    node.classList.add("is-out");
    node.setAttribute("aria-hidden", "true");
    node.inert = true;
    setTimeout(() => node.remove(), 220);
  }
  function closeLive() {
    const card = el?.querySelector(".m-im-livecard:not(.is-out)");
    if (!card) return;
    const back = card.contains(document.activeElement);
    fadeOut(card);
    if (back && q.live?.isConnected && !q.live.hidden) q.live.focus();
  }
  function toggleKeys(force) {
    if (!q.keys) return;
    const show = force ?? q.keys.hidden;
    if (show) closeMenus("keys");
    if (show && !q.keys.childElementCount) {
      const box = document.createElement("div");
      box.className = "m-im-keys-box";
      const h = document.createElement("b");
      h.textContent = t("keysTitle");
      box.append(h);
      let group = "";
      for (const r of helpRows(MODES.length)) {
        // dünne Linie zwischen den Abschnitten (Wiedergabe, Ansicht, Menüs, Liedtext, Party, App)
        if (group && r.group !== group) box.append(Object.assign(document.createElement("hr"), { className: "m-im-keys-sep" }));
        group = r.group;
        const row = document.createElement("div");
        row.innerHTML = "<kbd></kbd><span></span>";
        row.firstChild.textContent = r.kbdKey ? t(r.kbdKey) : r.kbd;
        row.lastChild.textContent = t(r.label);
        box.append(row);
      }
      q.keys.append(box);
    }
    // Fokus in die Übersicht, beim Schließen zurück zum Auslöser
    const had = q.keys.contains(document.activeElement);
    if (show && q.keys.hidden) keysFrom = document.activeElement;
    q.keys.hidden = !show;
    if (show) q.keys.focus();
    else if (had && keysFrom?.isConnected) keysFrom.focus();
    syncTriggers();
  }
  function styleLyrics() {
    kick();
    el.style.setProperty("--m-lyr-size", String(cfg.lyrSize / 100));
    el.style.setProperty("--m-lyr-gap", String(cfg.lyrGap / 100));
    // [duet 1.27] „Stimmen farbig“: nur Farben – Größen und Abstände hängen nicht daran, Umschalten springt nie
    q.lyrics?.classList.toggle("is-voices", cfg.lyrVoices !== false);
    // [playful] Einstellungen geändert (applySettings → hier): Stil sofort an Ruhig/Keine Blitze/Stärke anpassen
    playfulRestyle();
  }

  // Seitenleiste: Als Nächstes · Geräte · Schlaf-Timer
  // Seiten liegen auf einem Stapel: „Mehr“ → Song-Menü → Zu Playlist hinzufügen → Zurück → Zurück. Ein Auslöser
  // (Knopf, Taste) beginnt einen neuen Stapel, eine Zeile, die weiterführt, legt ihre Seite oben drauf (push),
  // der Neuaufbau derselben Seite (Timer gewählt, Song gewechselt) lässt ihn, wie er ist.
  let side = null, stack = [];
  const SIDE_TITLE = { queue: "c_queue", devices: "c_devices", timer: "c_timer", versions: "lyrPick", playlists: "c_addTo", wishes: "wishTitle", photos: "photoTitle", screens: "toScreen", poll: "pollBtn", recap: "recapBtn", dj: "djTitle", games: "gTitle", menu: "pmTitle", genre: "imGenreTitle", perf: "perfQuick", lyricopts: "tabLyrics" };
  const sideTitle = (kind) => t(kind === "song" ? (ctl.isEpisode(currentItem()) ? "smTitleEp" : "smTitle") : SIDE_TITLE[kind] || kind);
  const pushSide = (kind) => showSide(kind, true);
  function sideBack() {
    if (stack.length < 2) return showSide(null);
    stack.pop();
    showSide(stack.pop(), true);
  }
  function showSide(kind, push) {
    sideFocus(kind);
    if (kind) closeMenus("side");
    const was = side;
    if (!kind) stack = [];
    else if (push && was) stack = [...stack.filter((k) => k !== kind), kind];
    else if (kind !== was) stack = [kind];
    side = kind;
    // der QR-Code der Spielleitung bleibt nie offen stehen
    if (kind !== "games") q.hostOpen = false;
    q.side.hidden = !kind;
    vizMoveUntil = performance.now() + 1000;
    syncTriggers();
    if (!kind) return;
    q.side.dataset.kind = kind;
    q.sideBack.hidden = stack.length < 2;
    q.sideBack.title = q.sideBack.ariaLabel = stack.length > 1 ? sideTitle(stack[stack.length - 2]) : "";
    // anderer Inhalt in der offenen Leiste: kurz einblenden statt hart springen (Neuaufbau derselben Seite nicht)
    if (was && was !== kind) {
      q.sideBody.classList.remove("is-swap");
      void q.sideBody.offsetWidth;
      q.sideBody.classList.add("is-swap");
    }
    q.side.querySelector("b").textContent = sideTitle(kind);
    const body = q.sideBody;
    body.textContent = "";
    const item = (label, sub, img, onClick, on) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "m-im-side-item" + (on ? " is-on" : "");
      if (on) b.setAttribute("aria-current", "true");
      if (img) {
        const i = document.createElement("img");
        i.src = img;
        i.alt = "";
        i.loading = "lazy";
        b.append(i);
      }
      const txt = document.createElement("span");
      const l = document.createElement("b");
      l.textContent = label;
      txt.append(l);
      if (sub) {
        const s2 = document.createElement("small");
        s2.textContent = sub;
        txt.append(s2);
      }
      b.append(txt);
      if (onClick) b.onclick = onClick;
      else b.disabled = true;
      body.append(b);
    };
    if (kind === "wishes") {
      el.querySelector(".m-im-wishtoast")?.remove();
      return wishPanel(body);
    }
    if (kind === "photos") return photoPanel(body);
    if (kind === "screens") return screensPanel(body, item);
    if (kind === "dj") return djPanel(body);
    if (kind === "games") return gamesPanel(body);
    if (kind === "menu") return menuPanel(body);
    if (kind === "song") return songPanel(body);
    if (kind === "poll") return pollPanel(body);
    if (kind === "recap") return recapPanel(body);
    if (kind === "genre") return genrePanel(body);
    if (kind === "perf") return perfSection(body);
    if (kind === "lyricopts") return lyricOptsPanel(body);
    if (kind === "queue") {
      queuePanel(body, item);
    } else if (kind === "devices") {
      const list = ctl.devices();
      if (!list.length) return item(t("devicesNone"));
      for (const d of list) item(d.name, d.active ? t("deviceActive") : d.type, null, d.active ? null : async () => { await ctl.transfer(d.id); setTimeout(() => showSide("devices"), 800); }, d.active);
    } else if (kind === "versions") {
      showVersions(body, item);
    } else if (kind === "playlists") {
      showPlaylists(body, item);
    } else if (kind === "timer") {
      const now = ctl.sleepState();
      for (const [v, label] of [[15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "60 min"], ["track", t("timerTrack")], [0, t("timerOff")]]) {
        item(label, now && (now === v || (v !== "track" && v && now !== "track" && now <= v && now > v - 15)) ? t("timerLeft").replace("{m}", now === "track" ? "♪" : now) : "", null, () => { ctl.setSleep(v); showSide("timer"); syncState(); }, now === v);
      }
    }
  }

  // Zu einer Playlist hinzufügen: Suchfeld oben, darunter die eigenen Playlists (zuletzt genutzte zuerst)
  async function showPlaylists(body, item) {
    const track = currentItem()?.uri || "";
    if (!/^spotify:(track|episode|local):/.test(track)) return item(t("plNoTrack"));
    item(t("loading"));
    const list = await ctl.playlists();
    if (side !== "playlists") return;
    body.textContent = "";
    // 1.27 actions: „Neue Playlist“ wie in Spotify – heißt wie der Song, der Song ist gleich drin
    if (ctl.canCreate() && /^spotify:(track|episode):/.test(track)) {
      const made = sideBtn(body, t("plNew"), t("plNewSub"), async () => {
        if (made.classList.contains("is-busy")) return;
        made.classList.add("is-busy");
        const uri = await ctl.newPlaylist(titleOf(currentItem()) || t("plNew"), track);
        made.classList.remove("is-busy");
        rowNote(made, uri ? t("plMade") : t("smFail"), !!uri);
        if (uri) {
          cfg.plRecent = [uri, ...(cfg.plRecent || []).filter((u) => u !== uri)].slice(0, 8);
          save();
        }
      }, false, UI.add);
      made.classList.add("m-im-plnew");
    }
    if (!list.length) return item(t("plNone"));
    const recent = cfg.plRecent || [];
    const rank = (p) => (recent.includes(p.uri) ? recent.indexOf(p.uri) : 99);
    list.sort((a, b) => rank(a) - rank(b));
    const find = document.createElement("input");
    find.type = "search";
    find.className = "m-im-side-find";
    find.placeholder = t("plFind");
    find.setAttribute("aria-label", t("plFind"));
    body.append(find);
    const rows = [];
    for (const p of list) {
      item(p.name, p.folder, p.image, null);
      const b = body.lastElementChild;
      b.disabled = false;
      b.dataset.name = (p.name + " " + p.folder).toLowerCase();
      b.onclick = async () => {
        if (b.classList.contains("is-busy")) return;
        b.classList.add("is-busy");
        const res = await ctl.addToPlaylist(p.uri, track);
        b.classList.remove("is-busy");
        const small = b.querySelector("small") || b.querySelector("span").appendChild(document.createElement("small"));
        small.replaceChildren(...(res === true ? [iconEl(UI.check, "m-ic is-inline"), t("plAdded")] : [res === "dup" ? t("plDup") : t("plFail")]));
        b.classList.toggle("is-on", res === true || res === "dup");
        if (res === true) {
          cfg.plRecent = [p.uri, ...recent.filter((u) => u !== p.uri)].slice(0, 8);
          save();
          if (cfg.burst && !cfg.calm) {
            const r = b.getBoundingClientRect();
            burst(r.left + 28, r.top + r.height / 2);
          }
        }
      };
      rows.push(b);
    }
    find.oninput = () => {
      const s = find.value.trim().toLowerCase();
      for (const r of rows) r.hidden = !!s && !r.dataset.name.includes(s);
    };
    find.focus();
  }

  /* === 1.27 actions: Song-Menü – alles, was Spotify mit dem laufenden Song anbietet, ohne den Immersiv-Modus zu verlassen === */
  // Rückmeldung direkt in der Zeile (Häkchen und kurzer Text), die Zeile bleibt, wo sie ist
  function rowNote(b, text, good) {
    const span = b.querySelector("span");
    const small = span.querySelector("small") || span.appendChild(document.createElement("small"));
    small.replaceChildren(...(good ? [iconEl(UI.check, "m-ic is-inline"), text] : [text]));
    b.classList.toggle("is-done", !!good);
  }
  // Seite verlassen (Künstler, Album, Podcast): Ebene blendet weich aus, Spotify zeigt die Seite dahinter schon
  const goTo = (uri) => ctl.go(uri) && close();
  function songPanel(body) {
    const it = currentItem(), uri = it?.uri || "";
    const track = /^spotify:track:/.test(uri), ep = /^spotify:episode:/.test(uri), local = /^spotify:local:/.test(uri);
    // Kopf: kleines Cover, Titel und Künstler – man sieht, worauf sich das Menü bezieht
    const head = document.createElement("div");
    head.className = "m-im-songhead";
    const cv = covers(it).small;
    if (cv) {
      const img = document.createElement("img");
      img.alt = "";
      img.onerror = () => img.remove();
      img.src = cv;
      head.append(img);
    }
    const txt = document.createElement("span"), b = document.createElement("b"), s2 = document.createElement("small");
    b.textContent = titleOf(it) || t("nothing");
    s2.textContent = artistOf(it);
    txt.append(b, s2);
    head.append(txt);
    body.append(head);
    if (!track && !ep && !local) return sideBtn(body, t("smNone"));
    // Trennlinie erst, wenn die nächste Gruppe wirklich eine Zeile bringt (keine doppelten Linien)
    let gap = false;
    const sep = () => (gap = true);
    const flush = () => {
      if (gap && body.querySelector(".m-im-side-item")) body.append(Object.assign(document.createElement("hr"), { className: "m-im-song-sep" }));
      gap = false;
    };
    const row = (label, sub, fn, icon, nav) => (flush(), sideBtn(body, label, sub, fn, false, icon, nav));
    // Bibliothek: Lieblingssongs, Playlist, Warteschlange, Geschmacksprofil
    if (track || ep) {
      const liked = !!S.Player.getHeart?.();
      const like = row(t(ep ? (liked ? "smUnsaveEp" : "smSaveEp") : liked ? "smUnlike" : "smLike"), "", () => {
        S.Player.toggleHeart();
        // Funkenregen wie beim Herz unten, hier an der Zeile
        if (!liked && cfg.burst && !cfg.calm) {
          const r = like.getBoundingClientRect();
          burst(r.left + 28, r.top + r.height / 2);
        }
        setTimeout(() => {
          syncState();
          if (side === "song") showSide("song");
        }, 250);
      }, UI.heart);
      like.classList.add("m-im-song-like");
      like.setAttribute("aria-pressed", String(liked));
    }
    if (ctl.canAddTo()) row(t("c_addTo"), "", () => pushSide("playlists"), UI.playlist, true).setAttribute("aria-keyshortcuts", "A");
    if (ctl.canQueueAdd()) {
      const qb = row(t("smQueue"), "", async () => rowNote(qb, (await ctl.queueAdd(uri)) ? t("smQueued") : t("smFail"), true), UI.queueAdd);
    }
    if (track && ctl.canTaste()) {
      const tb = row(t("smTaste"), t("smTasteSub"), null, UI.excl);
      tb.classList.add("m-im-song-wrap");
      ctl.tasteExcluded(uri).then((on) => {
        if (on == null || !tb.isConnected) return;
        tb.querySelector("b").textContent = t(on ? "smTasteOff" : "smTaste");
        tb.setAttribute("aria-pressed", String(on));
        tb.disabled = false;
        tb.onclick = async () => {
          if (await ctl.setTasteExcluded(uri, !on)) showSide("song");
          else rowNote(tb, t("smFail"));
        };
      });
    }
    // Weiter: Song-Radio, Künstler, Album oder Podcast
    sep();
    if (track && ctl.canRadio()) {
      const rb = row(t("smRadio"), "", async () => {
        if (rb.classList.contains("is-busy")) return;
        rb.classList.add("is-busy");
        const ok = await ctl.songRadio(uri);
        rb.classList.remove("is-busy");
        rowNote(rb, ok ? t("smRadioOn") : t("smFail"), ok);
      }, UI.radio);
    }
    for (const a of ctl.artistsOf(it).slice(0, 4)) row(t("smArtist"), a.name, () => goTo(a.uri), UI.user, true).classList.add("m-im-song-artist");
    const al = ep ? ctl.showOf(it) : ctl.albumOf(it);
    if (/^spotify:(album|show):/.test(al || "")) row(t(ep ? "smShow" : "smAlbum"), it?.album?.name || it?.metadata?.album_title || "", () => goTo(al), ep ? UI.podcast : UI.disc, true);
    // Teilen: Link und Bild
    if (track || ep) {
      sep();
      const lb = row(t(ep ? "smLinkEp" : "smLink"), "", async () => {
        const ok = await ctl.copyLink(uri);
        rowNote(lb, ok ? t("smCopied") : t("smFail"), ok);
      }, UI.link);
      row(t("smShare"), "", () => { showSide(null); nowPlayingCard(); }, UI.share).classList.add("m-im-song-share");
    }
    // Podcasts und Hörbücher: Tempo wie Spotifys Tempo-Knopf
    if (ctl.canSpeed(it)) {
      sep();
      const r = document.createElement("div");
      r.className = "m-g-cfg m-im-speed";
      const l = document.createElement("span");
      l.textContent = t("smSpeed");
      const seg = document.createElement("div");
      seg.className = "m-g-seg-row";
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", t("smSpeed"));
      const now = ctl.speedNow();
      for (const v of [0.5, 0.8, 1, 1.2, 1.5, 2, 3]) {
        const sb = document.createElement("button");
        sb.type = "button";
        sb.textContent = new Intl.NumberFormat(LANG).format(v) + "×";
        sb.setAttribute("aria-pressed", String(Math.abs(now - v) < 0.01));
        sb.onclick = async () => {
          if (await ctl.setSpeed(v)) seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === sb)));
        };
        seg.append(sb);
      }
      flush();
      r.append(l, seg);
      body.append(r);
    }
  }
  // Als Nächstes: Klick spielt den Song, das Minus nimmt ihn aus der Warteschlange; darunter „Zuletzt gespielt“
  function queuePanel(body, item) {
    const list = ctl.upNext(), skip = ctl.canSkipTo(), edit = ctl.canQueueEdit();
    if (!list.length) item(t("queueEmpty"));
    if (list.some((x) => x.queued) && ctl.canQueueClear()) {
      const cb = sideBtn(body, t("qClear"), "", async () => {
        if (await ctl.queueClear()) setTimeout(() => side === "queue" && showSide("queue"), 400);
        else rowNote(cb, t("smFail"));
      }, false, UI.close);
      cb.classList.add("m-im-qclear");
    }
    for (const x of list) {
      item(x.title, x.queued ? t("qMine") + " · " + x.artist : x.artist, x.image, skip ? async () => { if (free()) await ctl.skipTo(x); } : null);
      const b = body.lastElementChild;
      if (skip) b.title = t("qPlayHint");
      if (!edit) continue;
      // Zeile und Entfernen-Knopf nebeneinander (ein Knopf im Knopf wäre ungültig)
      const wrap = document.createElement("div");
      wrap.className = "m-im-qrow";
      b.replaceWith(wrap);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "m-im-qx";
      rm.innerHTML = UI.remove;
      rm.title = rm.ariaLabel = t("qRemove") + ": " + x.title;
      rm.onclick = async () => {
        rm.disabled = true;
        if (await ctl.queueRemove([x])) {
          wrap.classList.add("is-gone");
          setTimeout(() => side === "queue" && showSide("queue"), 260);
        } else rm.disabled = false;
      };
      wrap.append(b, rm);
    }
    const old = ctl.recent();
    if (!old.length) return;
    sideHead(body, t("qRecent"));
    for (const x of old) item(x.title, x.artist, x.image, null);
  }
  /* === end actions === */

  function refresh() {
    if (!el) return;
    kick();
    if (side === "queue") setTimeout(() => side === "queue" && showSide("queue"), 600);
    const item = currentItem();
    setCover(item);
    setCanvas(item);
    // 1.27 polish: ändert der neue Titel die Höhe des Titelblocks (eine Zeile mehr oder weniger), gleiten Kicker,
    // Leiste und Knöpfe an ihren neuen Platz, statt um eine Zeilenhöhe zu springen (FLIP, nur sichtbar offen)
    const title = titleOf(item) || t("nothing"), artist = artistOf(item);
    const glide = el.classList.contains("is-on") && !stillMotion() && (q.title.textContent !== title || q.artist.textContent !== artist);
    const kids = glide ? [...q.meta.children].filter((k) => k.offsetParent) : [];
    const tops = kids.map((k) => k.getBoundingClientRect().top);
    q.title.textContent = title;
    q.artist.textContent = artist;
    q.smart.hidden = !ctl.isSmartPick(item);
    kids.forEach((k, i) => {
      const dy = tops[i] - k.getBoundingClientRect().top;
      // verschoben wird im eigenen (gezoomten) Maß
      if (Math.abs(dy) > 1) k.animate([{ transform: `translateY(${dy / (k.currentCSSZoom || 1)}px)` }, { transform: "none" }], { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", composite: "add" });
    });
    // 1.27 views: Album-Reise und Uhr
    album.sync(item, el.dataset.mode, true);
    clockView.update(item);
    updateLyrState();
    if (side === "playlists") showSide("playlists");
    // 1.27 actions: Song-Menü zeigt den neuen Song; bei Podcasts ±15 s statt Zufall und Wiederholen (wie Spotify)
    if (side === "song") showSide("song");
    const ep = ctl.isEpisode(item);
    q.shuffle.hidden = q.repeat.hidden = ep;
    q.b15.hidden = q.f15.hidden = !ep;
    q.play.innerHTML = PLR.isPlaying() ? ICON.pause : ICON.play;
    playLabel();
    announce(item);
    lastBeatIdx = -1;
    songAt = performance.now();
    quietNow = false;
    quietSince = 0;
    moments.stormDone = false;
    moments.venue = "";
    scen.reset();
    // „Energie halten“: passt der nächste Song gar nicht, zieht Mirage einen passenderen vor
    if (item?.uri && el.dataset.mode === "party") dj.onSong(item.uri).then((m) => m && S.showNotification?.(t("djMoved").replace("{t}", m.title), false, 4000));
    updateKicker();
    // Zeiten setzen (Taste E) lief noch, als der Song wechselte: jetzt abschließen, solange Text und Adresse noch
    // die des alten Songs sind – sonst landeten dessen Zeiten beim Bestätigen unter dem neuen Song
    if (edit && (item?.uri || "") !== lyrUri) finishTiming(true);
    if (LYR.has(el.dataset.mode)) loadLyrics();
    if (el.dataset.mode === "party") {
      // Übergang (Ausklang, Treffer auf der ersten Eins, Überblendung beim Überspringen): party.js
      party.prepare(item).then((info) => {
        updateKicker();
        noteRecap(item, info);
      });
    }
    showExtras();
  }

  /* ---- Party-Rückblick: was lief, welche Genres, Tempo-Spanne, der lauteste Drop */
  const recap = { start: 0, songs: [], drops: 0, peak: null };
  function noteRecap(item, info) {
    if (!cfg.partyRecap || !item?.uri) return;
    if (!recap.start || Date.now() - recap.last > 3600e3) Object.assign(recap, { start: Date.now(), songs: [], drops: 0, peak: null, saved: null });
    recap.last = Date.now();
    if (recap.songs.some((x) => x.uri === item.uri)) return;
    recap.songs.push({ uri: item.uri, title: titleOf(item), artist: artistOf(item), key: info?.key || "pop", bpm: info?.bpm || 0, img: covers(item).big || covers(item).small });
    showExtras();
  }
  function showExtras() {
    if (!el) return;
    const party = el.dataset.mode === "party";
    // Im Party-Modus bleiben oben nur Spiele, QR-Code, Wünsche und „Mehr“; der Rest liegt im Menü.
    // „Mehr“ gibt es in jeder Ansicht: dort liegt auch Aussehen & Leistung.
    q.recap.hidden = q.conf.hidden = q.pollbtn.hidden = q.djbtn.hidden = q.screen.hidden = true;
    q.gamebtn.hidden = !party;
    q.menubtn.hidden = false;
    q.menubtn.setAttribute("aria-keyshortcuts", "O");
    // offenes Menü nach dem Ansichtswechsel neu füllen („Diese Ansicht“ und die Party-Gruppe hängen an der Ansicht)
    if (side === "menu" && q.menuMode !== el.dataset.mode) rebuildMenu();
    el.classList.toggle("is-partyui", party);
    if (!party) games.stop();
    q.live.hidden = !(party && cfg.partyLive);
    if (q.live.hidden) el.querySelector(".m-im-livecard")?.remove();
    drawWishes();
    drawPhotos();
  }
  // Songwünsche der Gäste (Live-Link): ein Knopf oben mit Zahl, die Liste in der Seitenleiste (wie die
  // Warteschlange), neue Wünsche gleiten kurz oben ein – auch wenn die Bedienung im Party-Modus ausgeblendet ist
  const seenWish = new Set();
  const openWishes = () => (el?.dataset.mode === "party" && cfg.partyLive && cfg.partyWishes ? live.wishes().filter((w) => w.st === "open") : []);
  const safeImg = (u) => (/^https:\/\/i\.scdn\.co\//.test(u || "") ? u : "");
  // Farbpunkt des Gastes vor seinem Namen: man sieht, von wem der Wunsch ist
  const whoDot = (node, w) => {
    if (!w.n || !GUEST_COLORS[w.c]) return;
    const d = document.createElement("i");
    d.className = "m-im-who";
    d.style.background = GUEST_COLORS[w.c];
    node.prepend(d);
  };
  async function takeWish(w, btn) {
    if (btn) btn.disabled = true;
    if (await live.accept(w.i)) S.showNotification?.(t("wishQueued").replace("{s}", w.t), false, 2500);
    else if (btn) btn.disabled = false;
  }
  function wishRow(w) {
    const row = document.createElement("div");
    row.className = "m-im-wishrow";
    if (safeImg(w.img)) {
      const i = new Image();
      i.alt = "";
      i.onerror = () => (i.style.visibility = "hidden");
      i.src = safeImg(w.img);
      row.append(i);
    }
    const txt = document.createElement("span");
    const ti = document.createElement("b"), sub = document.createElement("small");
    ti.textContent = w.t;
    sub.textContent = w.a + (w.n ? " · " + t("wishBy").replace("{n}", w.n) : "");
    whoDot(sub, w);
    txt.append(ti, sub);
    const votes = document.createElement("i");
    votes.className = "m-im-votes";
    votes.append(iconEl(UI.thumb, "m-ic is-inline"), String(w.v));
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "m-im-wish-ok";
    ok.textContent = t("wishQueue");
    ok.onclick = () => takeWish(w, ok);
    const no = document.createElement("button");
    no.type = "button";
    no.className = "m-im-wish-no";
    no.innerHTML = UI.close;
    no.title = no.ariaLabel = t("wishDecline");
    no.onclick = () => live.decline(w.i);
    row.append(txt, votes, ok, no);
    return row;
  }
  function wishPanel(body) {
    const list = openWishes();
    if (!list.length) {
      const e = document.createElement("p");
      e.className = "m-im-wishempty";
      e.textContent = t("wishNone");
      return body.replaceChildren(e);
    }
    body.replaceChildren(...list.map(wishRow));
  }
  function wishToast(w) {
    el.querySelector(".m-im-wishtoast")?.remove();
    const box = document.createElement("div");
    box.className = "m-im-wishtoast";
    box.setAttribute("role", "status");
    if (safeImg(w.img)) {
      const i = new Image();
      i.alt = "";
      i.onerror = () => (i.style.visibility = "hidden");
      i.src = safeImg(w.img);
      box.append(i);
    }
    const txt = document.createElement("span");
    const k = document.createElement("small"), ti = document.createElement("b");
    k.textContent = w.n ? t("wishFrom").replace("{n}", w.n) : t("wishNew");
    whoDot(k, w);
    ti.textContent = `${w.t} – ${w.a}`;
    txt.append(k, ti);
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "m-im-wish-ok";
    ok.textContent = t("wishQueue");
    ok.onclick = () => takeWish(w, ok).then(() => box.remove());
    const all = document.createElement("button");
    all.type = "button";
    all.className = "m-im-wish-all";
    all.textContent = t("wishAll");
    all.onclick = () => {
      box.remove();
      showSide("wishes");
    };
    box.append(txt, ok, all);
    el.append(box);
    setTimeout(() => box.classList.add("is-gone"), 6500);
    setTimeout(() => box.remove(), 7200);
  }
  function drawWishes() {
    if (!el || !q.wishbtn) return;
    const list = openWishes();
    q.wishbtn.hidden = !list.length;
    q.wishbtn.dataset.n = list.length > 9 ? "9+" : String(list.length);
    q.wishbtn.title = q.wishbtn.ariaLabel = t("wishTitle") + (list.length ? ` (${list.length})` : "");
    const fresh = list.find((w) => !seenWish.has(w.i));
    for (const w of list) seenWish.add(w.i);
    if (fresh && side !== "wishes") wishToast(fresh);
    requestAnimationFrame(fitTop);
    if (side === "wishes") wishPanel(q.sideBody);
  }
  window.addEventListener("mirage:wishes", () => drawWishes());
  /* ---- Foto-Wand: Fotos der Gäste warten in der Seitenleiste auf dich; freigegebene schweben einzeln am Rand ein */
  // Vorschaubilder in der Warteschlange sind unscharf, bis du mit der Maus darüber gehst: auf dem großen Bild
  // ist ein nicht freigegebenes Foto so nie zu erkennen.
  const photoQueue = [];
  let photoBusy = false, photoRight = false;
  const photoOn = () => el?.dataset.mode === "party" && cfg.partyLive && cfg.partyPhotos;
  function photoRow(x) {
    const row = document.createElement("div");
    row.className = "m-im-photorow";
    row.dataset.p = x.p;
    const i = new Image();
    i.alt = "";
    i.src = x.url;
    const txt = document.createElement("small");
    txt.textContent = t("photoBy").replace("{n}", x.n || t("photoGuest"));
    whoDot(txt, x);
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "m-im-photo-ok";
    ok.textContent = t("photoOk");
    ok.onclick = () => live.approvePhoto(x.p);
    const no = document.createElement("button");
    no.type = "button";
    no.className = "m-im-photo-no";
    no.textContent = t("photoNo");
    no.onclick = () => live.rejectPhoto(x.p);
    row.append(i, txt, ok, no);
    return row;
  }
  function photoPanel(body) {
    const list = photoOn() ? live.photos() : [], wait = list.filter((x) => x.st === "wait"), shown = list.filter((x) => x.st === "ok").reverse();
    if (!list.length) {
      const e = document.createElement("p");
      e.className = "m-im-wishempty";
      e.textContent = t("photoNone");
      return body.replaceChildren(e);
    }
    const out = [];
    const sec = (k) => {
      const h = document.createElement("div");
      h.className = "m-im-side-sec";
      h.textContent = t(k);
      out.push(h);
    };
    if (wait.length) {
      sec("photoQueue");
      out.push(...wait.map(photoRow));
    }
    if (shown.length) {
      sec("photoGallery");
      const g = document.createElement("div");
      g.className = "m-im-photogrid";
      for (const x of shown) {
        const i = new Image();
        i.alt = x.n ? t("photoBy").replace("{n}", x.n) : "";
        i.src = x.url;
        i.dataset.p = x.p;
        g.append(i);
      }
      out.push(g);
    }
    body.replaceChildren(...out);
  }
  function drawPhotos() {
    if (!el || !q.photobtn) return;
    const list = photoOn() ? live.photos() : [], n = list.filter((x) => x.st === "wait").length;
    q.photobtn.hidden = !list.length;
    q.photobtn.dataset.n = n > 9 ? "9+" : n ? String(n) : "";
    q.photobtn.title = q.photobtn.ariaLabel = t("photoTitle") + (n ? ` (${n})` : "");
    requestAnimationFrame(fitTop);
    if (side === "photos") photoPanel(q.sideBody);
    // Foto-Wand aus oder Party vorbei: nichts mehr zeigen, was schon gelöscht ist
    if (!list.length) {
      photoQueue.length = 0;
      el.querySelectorAll(".m-im-polaroid").forEach((n) => n.remove());
    }
  }
  window.addEventListener("mirage:photos", () => drawPhotos());
  // Freigegeben: ein kleines Polaroid gleitet abwechselnd links oder rechts herein, bleibt ein paar Sekunden und
  // geht wieder. Immer nur eins zugleich, die übrigen warten; nie über der Mitte.
  function nextPhoto() {
    if (photoBusy || !el || !photoQueue.length) return;
    const x = photoQueue.shift();
    if (!photoOn() || !live.photos().some((y) => y.p === x.p && y.st === "ok")) return nextPhoto();
    photoBusy = true;
    // rechts liegt die Seitenleiste, solange sie offen ist: dann links
    photoRight = !photoRight && q.side.hidden;
    const card = document.createElement("figure");
    card.className = "m-im-polaroid" + (photoRight ? " is-right" : "");
    card.dataset.p = x.p;
    const i = new Image();
    i.alt = "";
    i.src = x.url;
    card.append(i);
    if (x.n) {
      const cap = document.createElement("figcaption");
      cap.textContent = x.n;
      whoDot(cap, x);
      card.append(cap);
    }
    el.append(card);
    setTimeout(() => card.classList.add("is-gone"), 6500);
    setTimeout(() => {
      card.remove();
      photoBusy = false;
      setTimeout(nextPhoto, 600);
    }, 7300);
  }
  window.addEventListener("mirage:photoshow", (e) => {
    if (!photoOn() || photoQueue.length > 6) return;
    photoQueue.push(e.detail);
    nextPhoto();
  });
  // Live-Link: QR-Code und Link der Handy-Seite (verschlüsselt über einen Relay, siehe live.js)
  // Karte wie die Seitenleiste: Kopf mit Titel und Schließen, darunter QR-Code, Hinweis und „Link kopieren“.
  // Ein Klick in die Karte schließt sie nicht mehr (nur außerhalb, Esc oder das Kreuz).
  async function toggleLiveCard() {
    if (el.querySelector(".m-im-livecard:not(.is-out)")) return closeMenus();
    closeMenus("live");
    const token = ++liveToken;
    const info = await live.prepare().catch(() => null);
    // beim Warten aufs Relay kann schon ein anderes Menü aufgegangen sein
    if (token !== liveToken) return;
    const card = document.createElement("div");
    card.className = "m-im-livecard m-im-pop";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-labelledby", "m-im-live-title");
    const head = document.createElement("div");
    head.className = "m-im-pop-head";
    const b = document.createElement("b");
    b.id = "m-im-live-title";
    b.textContent = t("liveTitle");
    const x = document.createElement("button");
    x.type = "button";
    x.className = "m-im-sm m-im-pop-x";
    x.innerHTML = UI.close;
    x.title = x.ariaLabel = t("k_close");
    x.onclick = () => closeMenus();
    head.append(b, x);
    let focus = x;
    if (!info) {
      const p = document.createElement("p");
      p.textContent = t("liveError");
      card.append(head, p);
    } else {
      const img = new Image();
      img.alt = "";
      img.className = "m-im-qr";
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(info.qr);
      const p = document.createElement("p");
      p.textContent = t("liveHint");
      const u = document.createElement("button");
      u.type = "button";
      u.className = "m-im-btn";
      u.title = info.url;
      const label = document.createElement("span");
      label.textContent = t("liveCopy");
      u.append(iconEl(UI.copy), label);
      let reset = 0;
      u.onclick = () => {
        navigator.clipboard?.writeText(info.url).catch(() => {});
        // kurz bestätigen: Haken und „Kopiert“, dann wieder wie vorher
        u.classList.add("is-done");
        u.firstChild.innerHTML = UI.check;
        label.textContent = t("copied");
        clearTimeout(reset);
        reset = setTimeout(() => {
          u.classList.remove("is-done");
          u.firstChild.innerHTML = UI.copy;
          label.textContent = t("liveCopy");
        }, 1800);
      };
      const note = document.createElement("small");
      note.textContent = t("liveRelay");
      card.append(head, img, p, u, note);
      focus = u;
    }
    el.append(card);
    syncTriggers();
    // Fokus in die Karte, wenn sie per Tastatur geöffnet wurde (Esc und Tab setzen dort an)
    if (q.live.contains(document.activeElement) || document.activeElement === document.body) focus.focus({ preventScroll: true });
  }
  /* ---- Hinweis unten in der Mitte, auf Wunsch mit Knöpfen (Rückgängig, „Nur dieser Song“, Anlassen …).
     Spotifys eigene Meldung kann keine Knöpfe und liegt hinter der Ebene; hier ist immer nur einer zu sehen. */
  let toastT = 0;
  function imToast(text, actions = [], ms = 3200) {
    if (!el) return S.showNotification?.(text, false, ms);
    el.querySelector(".m-im-toast")?.remove();
    clearTimeout(toastT);
    const box = document.createElement("div");
    box.className = "m-im-toast";
    box.setAttribute("role", "status");
    const p = document.createElement("span");
    p.textContent = text;
    box.append(p);
    const done = () => {
      clearTimeout(toastT);
      fadeOut(box);
    };
    for (const [label, fn] of actions) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.onclick = () => {
        done();
        fn();
      };
      box.append(b);
    }
    el.append(box);
    // mit Knöpfen etwas länger (man muss lesen und zielen); die Maus darauf hält ihn offen
    const later = () => (toastT = setTimeout(() => (box.matches(":hover, :focus-within") ? later() : done()), actions.length ? Math.max(ms, 6000) : ms));
    later();
    return box;
  }

  /* ---- Show-Momente im Party-Modus: Hände hoch und Blitzlicht-Gewitter im Refrain,
     Konfetti auf Knopfdruck. Die Bühne (venue.js) zeichnet Hände, Blitze und Konfetti; hier wird entschieden, wann. */
  const moments = { hands: 0, storm: 0, confetti: 0, handsUntil: 0, stormUntil: 0, stormDone: false, hypeWas: false };
  function showMoments(px, now) {
    const bar = (4 * 60000) / (party.info.bpm || 120);
    if (hypeOn && !moments.hypeWas && px.energy > 0.45) {
      if (cfg.partyHandsUp) moments.handsUntil = now + 2 * bar;
      // Blitzlicht-Gewitter: beim ersten Refrain des Songs, wenn er richtig laut ist
      if (cfg.partyFlashStorm && !moments.stormDone && px.energy > 0.65) {
        moments.stormUntil = now + 2600;
        moments.stormDone = true;
      }
    }
    moments.hypeWas = hypeOn;
    if (px.dropHit && px.finale && cfg.partyFlashStorm) moments.stormUntil = now + 2600;
    moments.hands = clamp((moments.handsUntil - now) / 500, 0, 1);
    moments.storm = clamp((moments.stormUntil - now) / 600, 0, 1);
  }
  // byKey: Taste C – dann sagt ein kurzer Hinweis, warum nichts passiert (nur in der Party, nicht in „Ruhig“)
  function confetti(byKey) {
    if (!el || el.dataset.mode !== "party" || cfg.calm) {
      if (byKey === true && el && isOpen()) imToast(t(cfg.calm ? "hintConfettiCalm" : "hintConfetti"));
      return;
    }
    moments.confetti++;
    kick();
  }

  /* ---- Spiele: auswählen, starten, beenden. Alle außer dem Glücksrad spielen die Gäste auf ihren Handys. */
  // „Mehr“ im Party-Modus: alles, was nicht dauernd gebraucht wird
  // Aussehen & Leistung ohne Umweg über die Einstellungen: dieselben Presets und Schalter (settings.js), wirkt sofort.
  // Nach jedem Klick baut sich das Menü neu auf; der Fokus bleibt dabei an derselben Stelle (sideFocus).
  function perfSection(body) {
    // „Eigene“ (einzelne Schalter geändert) steht statt des Hinweises unter der Überschrift
    const hint = document.createElement("p");
    hint.className = "m-im-side-note";
    hint.textContent = t(cfg.preset === "custom" ? "presetCustom" : "perfQuickHint");
    body.append(hint);
    q.menuParty = el.dataset.mode === "party";
    const seg = document.createElement("div");
    seg.className = "m-g-seg-row is-wrap m-im-perf";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", t("perfQuick"));
    // wie im Dialog: Name, Leistungsbalken, kurze Zeile
    for (const k of Object.keys(COST)) {
      const b = presetFill(document.createElement("button"), k);
      b.type = "button";
      b.setAttribute("aria-pressed", String(cfg.preset === k));
      b.onclick = () => perfSet(() => setPreset(k));
      seg.append(b);
    }
    body.append(seg);
    // Energiesparen: dieselben drei Stufen mit denselben Namen wie im Dialog (ECO aus settings.js)
    const eco = document.createElement("div");
    eco.className = "m-g-cfg m-im-eco";
    const ecoL = document.createElement("span");
    ecoL.textContent = t("eco");
    const ecoSeg = document.createElement("div");
    ecoSeg.className = "m-g-seg-row";
    ecoSeg.setAttribute("role", "group");
    ecoSeg.setAttribute("aria-label", t("eco"));
    for (const k of ECO) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t("eco_" + k);
      b.setAttribute("aria-pressed", String(cfg.eco === k));
      b.onclick = () => perfSet(() => setPerf("eco", k));
      ecoSeg.append(b);
    }
    eco.append(ecoL, ecoSeg);
    body.append(eco);
    // Sicherheit & Komfort wie im Dialog: „Keine Blitze“ (Ruhig steht oben als Preset)
    sideHead(body, t("g_comfort"));
    const nf = sideBtn(body, t("noFlash"), "", () => perfSet(() => setPerf("noFlash", !cfg.noFlash)), !!cfg.noFlash, UI.flashOff);
    nf.removeAttribute("aria-current");
    nf.setAttribute("aria-pressed", String(!!cfg.noFlash));
    nf.classList.add("m-im-perf-flag");
  }
  // umstellen und alles, was die offene Ebene aus cfg liest, gleich nachziehen
  function perfSet(fn) {
    fn();
    sizeCanvas();
    applyCanvas();
    styleLyrics();
    showExtras();
    if (side === "perf" || side === "menu") {
      const top = q.sideBody.scrollTop;
      showSide(side, true);
      q.sideBody.scrollTop = top;
    }
  }
  // Taste O: Menü auf, Fokus auf das gewählte Preset (noch einmal O schließt es)
  function perfMenu() {
    if (!el || !isOpen()) return;
    if (side === "perf") return showSide(null);
    showSide("menu");
    pushSide("perf");
    queueMicrotask(() => (q.sideBody.querySelector('.m-im-perf [aria-pressed="true"]') || q.sideBody.querySelector(".m-im-perf button"))?.focus());
  }
  // Menü „Mehr“: feste Gruppen in fester Reihenfolge, in jeder Ansicht dieselben – nur „Diese Ansicht“ und
  // „Party“ hängen an der Ansicht. Dieser Song (öffnet das Song-Menü) → Diese Ansicht → Party (nur in der Party)
  // → Aussehen & Leistung → Alle Einstellungen. Jede Aktion hat genau einen Ort: Song-Aktionen im Song-Menü,
  // Ansicht und Leistung hier, Vollbild und Tastenhilfe oben.
  function rebuildMenu() {
    if (!side) return;
    const top = q.sideBody.scrollTop;
    showSide(side, true);
    q.sideBody.scrollTop = top;
  }
  const onOff = (v) => t(v ? "imOn" : "imOff");
  // Übersetzen als Linien-Symbol (wie icons.js) – ICON.translate ist gefüllt und bliebe in der Menü-Kachel leer
  const TR_LINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3.5 5.5h9M8 3.5v2M5.5 5.5c.6 3 2.6 5.8 6 7.8M10.5 5.5c-.7 3.4-3 6.3-6.5 8.3"/><path d="M12.5 20.5l4-9 4 9M14 17.3h5"/></svg>';
  function timerText() {
    const now = ctl.sleepState();
    return !now ? t("timerOff") : now === "track" ? t("timerTrack") : t("timerLeft").replace("{m}", now);
  }
  // Menü „Mehr“ (1.33 aufgeräumt): oben Schnellschalter als Kacheln (ein Klick, Zustand auf einen Blick), darunter
  // wenige Zeilen, die weiterführen. Was selten gebraucht wird, liegt eine Ebene tiefer: Liedtext-Optionen (Fassung,
  // Timing) und „Aussehen & Leistung“ (Presets, Energiesparen, Blitze). Reihenfolge fest: Kacheln → Dieser Song →
  // Party (nur in der Party) → Wiedergabe (Party, Uhr) → Aussehen & Leistung → Alle Einstellungen.
  function menuPanel(body) {
    const mode = el.dataset.mode, party = mode === "party";
    q.menuMode = mode;
    quickTiles(body, mode);
    // Dieser Song: Song-Menü (Playlist, Warteschlange, Radio, Teilen …), Liedtext-Optionen, Album-Reise
    sideHead(body, t("imThisSong"));
    sideBtn(body, t("smOpen"), titleOf(currentItem()), () => pushSide("song"), false, UI.music, true).classList.add("m-im-tosong");
    if (lyricOpts(mode).length) sideBtn(body, t("tabLyrics"), lyricOptsSub(mode), () => pushSide("lyricopts"), false, UI.mic, true).classList.add("m-im-tolyrics");
    if (album.canToggle(mode)) sideBtn(body, album.label, album.albumName, () => { showSide(null); album.toggle(); }, false, UI.album).classList.add("m-im-albtoggle");
    if (party) {
      sideHead(body, t("imParty"));
      partyRows(body);
    }
    // Party und Uhr zeigen die Knopfreihe unter dem Titel nicht: Lautstärke, Warteschlange, Geräte, Timer hier
    if (party || mode === "clock") {
      sideHead(body, t("imPlayback"));
      volRow(body);
      playChips(body);
    }
    // Aussehen & Leistung: eine Zeile, die Auswahl liegt eine Ebene tiefer (Taste O öffnet sie direkt)
    sideHead(body, t("perfQuick"));
    const pre = cfg.preset === "custom" ? t("presetCustom").split(" – ")[0] : t("preset_" + cfg.preset);
    const extra = [cfg.eco === "on" ? t("eco") : "", cfg.noFlash ? t("noFlash") : ""].filter(Boolean).join(" · ");
    sideBtn(body, pre || t("perfQuick"), extra, () => pushSide("perf"), false, UI.speed, true).classList.add("m-im-toperf");
    // Alle Einstellungen: der Mirage-Dialog über der Bühne, gleich bei der passenden Gruppe
    const all = sideBtn(body, t("imAllSettings"), "", () => {
      showSide(null);
      openSettings({ group: party ? "party" : "lyrics" });
    }, false, UI.gear);
    all.title = t("imAllSettingsSub").replace("{g}", t(party ? "g_party" : "g_immersive"));
    all.classList.add("m-im-allsettings");
  }
  // Schnellschalter: Kacheln mit Symbol, Name und Zustand; an = leuchtet in der Leitfarbe
  function quickTiles(body, mode) {
    const lyrView = LYR.has(mode), party = mode === "party";
    const grid = document.createElement("div");
    grid.className = "m-im-quick";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", t("imThisView"));
    const tile = (label, state, on, fn, icon, cls) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "m-im-tile" + (cls ? " " + cls : "");
      if (on != null) b.setAttribute("aria-pressed", String(!!on));
      b.append(iconEl(icon, "m-ic m-im-tile-ic"));
      const l = document.createElement("b");
      l.textContent = label;
      b.append(l);
      if (state) {
        const sm = document.createElement("small");
        sm.textContent = state;
        b.append(sm);
      }
      b.title = state ? label + " · " + state : label;
      b.onclick = fn;
      grid.append(b);
      return b;
    };
    // Canvas: ein Schalter für alle Ansichten; der Zustand sagt, wie es HIER erscheint (oder dass es keins gibt)
    if (cfg.canvas && !cfg.calm && CV_MODES.has(mode)) {
      const on = !!cfg.canvasShow && !!canvasUrl;
      tile(t("imCanvasRow"), canvasUrl ? (on ? canvasHint(mode) : onOff(false)) : t("imCvNone"), on, () => toggleCanvas(), UI.film, "m-im-cvrow" + (canvasUrl ? "" : " is-none"));
    }
    if (party) {
      tile(t("imCrowd"), onOff(cfg.partyCrowd), !!cfg.partyCrowd, () => {
        cfg.partyCrowd = !cfg.partyCrowd;
        save();
        kick();
        rebuildMenu();
      }, UI.user, "m-im-crowdrow");
      if (!cfg.calm) tile(t("confetti").replace(/\s*\(.*\)$/, ""), "C", null, () => { confetti(); showSide(null); }, UI.confetti, "m-im-confettirow");
    }
    // Übersetzung (Party: die Liedtext-Leiste fehlt dort) und verspielter Stil (wie Taste V)
    if (party && lyr?.lines?.length && canTranslate()) tile(t("trToggle"), trOn(lyrUri) ? t(typeof cfg.translateSongs?.[lyrUri] === "boolean" ? "trSongOnShort" : "trAllOnShort") : onOff(false), trOn(lyrUri), toggleTranslate, TR_LINE, "m-im-trrow");
    if (lyrView && lyr?.synced) tile(t("lyrPlayful"), onOff(cfg.lyrPlayful) + " · V", !!cfg.lyrPlayful, () => { togglePlayful(); rebuildMenu(); }, GAME.title, "m-im-playrow");
    // Uhr: Datum ein/aus (auch ein Klick auf die Uhrzeit)
    if (mode === "clock") tile(t("imClockDate"), onOff(cfg.clockDate !== false), cfg.clockDate !== false, () => { clockView.toggleDate(); rebuildMenu(); }, UI.clock, "m-im-ckdate");
    if (grid.children.length) body.append(grid);
  }
  // Liedtext-Optionen eine Ebene tiefer: Fassung wählen (Party: die Leiste unten fehlt dort) und früher/später
  function lyricOpts(mode) {
    const out = [], lyrView = LYR.has(mode), synced = !!lyr?.synced && /^spotify:(track|local):/.test(lyrUri);
    if (mode === "party" && lyr?.lines?.length && cfg.onlineLyrics && /^spotify:(track|local):/.test(lyrUri)) out.push("versions");
    if (lyrView && synced && canNudge()) out.push("nudge");
    return out;
  }
  function lyricOptsSub(mode) {
    const o = lyricOpts(mode), v = songOffset(lyrUri), parts = [];
    if (o.includes("versions")) parts.push(SOURCE_NAME[lyr.source] || "Spotify");
    if (o.includes("nudge")) parts.push(v ? signed(v / 1000) + " s" : t("syRow").split(" (")[0]);
    return parts.join(" · ");
  }
  function lyricOptsPanel(body) {
    const o = lyricOpts(el.dataset.mode);
    if (o.includes("versions")) sideBtn(body, t("lyrPick"), SOURCE_NAME[lyr.source] || "Spotify", () => pushSide("versions"), false, UI.music, true);
    if (o.includes("nudge")) nudgeRow(body);
    if (!o.length) sideBtn(body, t("smNone"));
  }
  // Warteschlange, Geräte, Timer: drei Knöpfe in einer Reihe statt drei Zeilen
  function playChips(body) {
    const seg = document.createElement("div");
    seg.className = "m-im-chips";
    const chip = (label, sub, icon, kind, on) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "m-im-chip" + (on ? " is-active" : "");
      b.append(iconEl(icon, "m-ic"));
      const l = document.createElement("span");
      l.textContent = label;
      b.append(l);
      b.title = sub ? label + " · " + sub : label;
      b.onclick = () => pushSide(kind);
      seg.append(b);
    };
    chip(t("k_queue"), "", UI.queue, "queue");
    if (ctl.canConnect()) chip(t("c_devices"), ctl.devices().find((d) => d.active)?.name || "", UI.devices, "devices");
    const tm = ctl.sleepState();
    chip(tm ? timerText() : t("c_timer"), tm ? t("c_timer") : "", UI.timer, "timer", !!tm);
    body.append(seg);
  }
  function nudgeRow(body) {
    const v = songOffset(lyrUri);
    const r = document.createElement("div");
    r.className = "m-g-cfg m-im-nudgerow";
    const l = document.createElement("span");
    l.textContent = t("syRow");
    const seg = document.createElement("div");
    seg.className = "m-g-seg-row";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", t("syRow"));
    for (const [text, hint, ms, dis] of [[t("syEarlier"), t("syEarlierHint"), 250], [v ? signed(v / 1000) + " s" : "0 s", t("syReset"), 0, !v], [t("syLater"), t("syLaterHint"), -250]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.title = hint;
      b.disabled = !!dis;
      if (!ms) b.setAttribute("aria-pressed", String(!!v));
      b.onclick = () => nudge(ms);
      seg.append(b);
    }
    r.append(l, seg);
    body.append(r);
  }
  function volRow(body) {
    const r = document.createElement("label");
    r.className = "m-g-cfg m-im-volrow";
    const l = document.createElement("span");
    l.textContent = t("c_volume");
    const v = document.createElement("input");
    v.type = "range";
    v.min = "0";
    v.max = "100";
    v.step = "1";
    v.className = "m-im-volume";
    v.value = q.volume.value;
    v.style.setProperty("--v", v.value + "%");
    v.setAttribute("aria-label", t("c_volume"));
    v.oninput = () => {
      S.Player.setVolume(Number(v.value) / 100);
      v.style.setProperty("--v", v.value + "%");
    };
    r.append(l, v);
    body.append(r);
  }
  // Party-Gruppe: DJ, Abstimmung, Rückblick, anderer Bildschirm, erkannter Stil (Publikum und Konfetti sind Kacheln)
  function partyRows(body) {
    const row = (label, icon, fn, nav, sub) => sideBtn(body, label, sub || "", fn, false, icon, nav);
    row(t("djTitle"), UI.dj, () => pushSide("dj"), true);
    if (cfg.partyLive) row(t("pollBtn"), UI.poll, () => pushSide("poll"), true);
    if (cfg.partyRecap && recap.songs.length >= 3) row(t("recapBtn"), UI.recap, () => pushSide("recap"), true);
    if (cfg.partyScreen) row(t("toScreen"), UI.screen, () => pushSide("screens"), true);
    genreRow(body);
  }
  /* ---- Party: erkannter Stil und „Für diesen Künstler immer …“ (cfg.genreArtist) */
  // Liest party.info ({ key, why, conf, family? }); ohne Stil (Ansage, noch nicht erkannt) fehlt die Zeile
  const familyOf = (key) => party.info?.family || Object.entries(party.FAMILIES || {}).find(([, ks]) => ks.includes(key))?.[0] || "";
  const hasKey = (k) => t(k) !== k;
  const styleName = (key) => (hasKey("party_" + key) ? t("party_" + key) : key);
  const famName = (f) => (hasKey("fam_" + f) ? t("fam_" + f) : f);
  function genreRow(body) {
    const info = party.info, key = info?.key;
    if (!key || info.talk || !party.FAMILIES) return;
    const fam = familyOf(key), art = ctl.artistUriOf(currentItem());
    const fixed = !!art && cfg.genreArtist?.[art] === key;
    const name = fam ? t("imGenreFam").replace("{g}", styleName(key)).replace("{f}", famName(fam)) : styleName(key);
    const sub = fixed ? t("imGenreFixed") : info.conf > 0 ? t("imGenreSure").replace("{p}", Math.round(info.conf <= 1 ? info.conf * 100 : info.conf)) : "";
    // eine Zeile: erkannter Stil, darunter wie sicher bzw. „immer so“ – führt zu „Für diesen Künstler immer …“
    const b = sideBtn(body, t("imGenre").replace("{g}", name), sub, art ? () => pushSide("genre") : null, false, UI.music, !!art);
    b.classList.add("m-im-genre");
    if (art) b.classList.add("m-im-genrepick");
  }
  function genrePanel(body) {
    const it = currentItem(), art = ctl.artistUriOf(it), cur = cfg.genreArtist?.[art] || "", who = artistOf(it).split(", ")[0] || "";
    if (!art) return void sideBtn(body, t("smNone"));
    const note = document.createElement("p");
    note.className = "m-im-side-note";
    note.textContent = t("imGenreNote").replace("{a}", who);
    body.append(note);
    const pick = (k) => {
      // speichert, leert den Merker je Song und plant den laufenden Song neu (party.js)
      Promise.resolve(party.setArtistGenre(art, k || "")).then(() => {
        updateKicker();
        if (side === "menu") rebuildMenu();
      });
      imToast(k ? t("imGenreSet").replace("{g}", styleName(k)).replace("{a}", who) : t("imGenreAutoSet"));
      sideBack();
    };
    sideBtn(body, t("imGenreAuto"), t("imGenreAutoSub"), () => pick(""), !cur, UI.music);
    for (const [f, keys] of Object.entries(party.FAMILIES || {})) {
      sideHead(body, famName(f));
      const seg = document.createElement("div");
      seg.className = "m-g-seg-row is-wrap m-im-genrelist";
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", famName(f));
      for (const k of keys) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = styleName(k);
        b.dataset.style = k;
        b.setAttribute("aria-pressed", String(cur === k));
        b.onclick = () => pick(k);
        seg.append(b);
      }
      body.append(seg);
    }
  }
  // Auswahl in Stufen: eine Zeile mit Knöpfen
  function gameChoice(body, label, key, choices, wrap) {
    const r = document.createElement("div");
    r.className = "m-g-cfg";
    r.dataset.key = key;
    const l = document.createElement("span");
    l.textContent = label;
    const seg = document.createElement("div");
    seg.className = "m-g-seg-row" + (wrap ? " is-wrap" : "");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", label);
    for (const [v, text] of choices) {
      const b = document.createElement("button");
      b.type = "button";
      // ON/OFF: Symbol statt Zeichen, vorgelesen als „An“/„Aus“
      if (text === ON || text === OFF) {
        b.innerHTML = text === ON ? UI.check : UI.close;
        b.setAttribute("aria-label", t(text === ON ? "a11yOn" : "a11yOff"));
        b.classList.add("is-ic");
      } else b.textContent = text;
      b.setAttribute("aria-pressed", String(cfg[key] === v));
      b.onclick = () => {
        cfg[key] = v;
        save();
        const top = q.sideBody.scrollTop;
        showSide("games");
        q.sideBody.scrollTop = top;
      };
      seg.append(b);
    }
    r.append(l, seg);
    body.append(r);
  }
  const secsOf = (list) => list.map((n) => [n, n + " s"]);
  // Platzhalter für Ein/Aus-Knöpfe (werden zu Symbolen)
  const ON = "\u0001on", OFF = "\u0001off";
  // Quelle der Quiz-Songs: die Warteschlange (Standard) oder eine Playlist aus der Bibliothek
  function sourceChoice(body) {
    const again = () => {
      const top = q.sideBody.scrollTop;
      showSide("games");
      q.sideBody.scrollTop = top;
    };
    const head = document.createElement("div");
    head.className = "m-im-side-sec";
    head.textContent = t("gSetSource");
    body.append(head);
    const now = sideBtn(body, cfg.gameSource ? cfg.gameSourceName || "Playlist" : t("gSrcQueue"), t("gSrcHint"), () => {
      q.srcOpen = !q.srcOpen;
      again();
    }, q.srcOpen, cfg.gameSource ? UI.playlist : UI.queue);
    now.setAttribute("aria-expanded", String(!!q.srcOpen));
    now.classList.add("m-g-src");
    if (!q.srcOpen) return;
    const box = document.createElement("div");
    box.className = "m-im-side-group m-g-srclist";
    body.append(box);
    const pick = (uri, name) => {
      cfg.gameSource = uri;
      cfg.gameSourceName = name;
      save();
      q.srcOpen = false;
      again();
    };
    sideBtn(box, t("gSrcQueue"), "", () => pick("", ""), !cfg.gameSource, UI.queue);
    games.sources().then((list) => {
      if (!box.isConnected) return;
      for (const p of list.slice(0, 200)) sideBtn(box, p.name, "", () => pick(p.uri, p.name), cfg.gameSource === p.uri);
    });
  }
  // Turnier: welche Spiele (in der Reihenfolge des Antippens), sonst ein Zufallsmix aus so vielen
  function tourChoice(body) {
    const head = document.createElement("div");
    head.className = "m-im-side-sec";
    head.textContent = t("gSetTour");
    const note = document.createElement("p");
    note.className = "m-im-side-note";
    note.textContent = t("gSetTourNote");
    body.append(head, note);
    const chips = document.createElement("div");
    chips.className = "m-g-seg-row is-wrap m-g-tourpick";
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", t("gSetTour"));
    for (const k of TOUR_POOL) {
      const g = GAME_LIST.find((x) => x.k === k), b = document.createElement("button");
      b.type = "button";
      b.append(iconEl(GAME[k] || UI.music, "m-ic is-inline"), t(g.label));
      b.dataset.game = k;
      b.setAttribute("aria-pressed", String((cfg.gameTour || []).includes(k)));
      b.onclick = () => {
        const list = (cfg.gameTour || []).filter((x) => x !== k);
        // höchstens sechs
        if (!(cfg.gameTour || []).includes(k) && list.length < 6) list.push(k);
        cfg.gameTour = list;
        save();
        chips.querySelectorAll("button").forEach((x, i) => x.setAttribute("aria-pressed", String(list.includes(TOUR_POOL[i]))));
      };
      chips.append(b);
    }
    body.append(chips);
    gameChoice(body, t("gSetTourN"), "gameTourN", [3, 4, 5, 6].map((n) => [n, String(n)]));
  }
  function gameSettings(body) {
    gameChoice(body, t("gSetLevel"), "gameLevel", [["easy", t("gLvEasy")], ["normal", t("gLvNormal")], ["hard", t("gLvHard")]]);
    gameChoice(body, t("gSetDecade"), "gameDecade", [[0, t("gDecAll")], ...[1980, 1990, 2000, 2010, 2020].map((d) => [d, String(d).slice(2) + t("gDecSuffix")])], true);
    sourceChoice(body);
    gameChoice(body, t("gSetTeams"), "gameTeams", [[0, OFF], [2, "2"], [3, "3"], [4, "4"]]);
    gameChoice(body, t("gSetRounds"), "gameRounds", [3, 5, 8, 10].map((n) => [n, String(n)]));
    gameChoice(body, t("gSetAsk"), "gameAsk", secsOf([10, 15, 20, 30]));
    gameChoice(body, t("gSetJoin"), "gameJoin", [[30, "30 s"], [60, "1 min"], [120, "2 min"], [180, "3 min"]]);
    gameChoice(body, t("gSetClip"), "gameClip", [[8, "8 s"], [12, "12 s"], [20, "20 s"], [0, t("gClipAll")]]);
    gameChoice(body, t("gSetDur"), "gameDur", secsOf([15, 30, 45, 60]));
    gameChoice(body, t("gSetBreak"), "gameBreak", secsOf([5, 8, 12, 20]));
    gameChoice(body, t("gSetBonus"), "gameBonus", [[true, ON], [false, OFF]]);
    gameChoice(body, t("gSetDrink"), "gameDrink", [[true, ON], [false, OFF]]);
    gameChoice(body, t("gSetSfx"), "gameSfx", [[0, OFF], [0.35, t("gSfxLow")], [0.7, t("gSfxLoud")]]);
    gameChoice(body, t("gSetCard"), "gameCard", [["big", t("gCardBig")], ["small", t("gCardSmall")]]);
    tourChoice(body);
    const head = document.createElement("div");
    head.className = "m-im-side-sec";
    head.textContent = t("gSetWheel");
    body.append(head);
    const on = new Set(cfg.gameWheel || WHEEL_FIELDS);
    const chips = document.createElement("div");
    chips.className = "m-g-seg-row is-wrap";
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", t("gSetWheel"));
    for (const k of WHEEL_FIELDS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t(k);
      b.setAttribute("aria-pressed", String(on.has(k)));
      b.onclick = () => {
        if (on.has(k)) on.delete(k);
        else on.add(k);
        cfg.gameWheel = [...on];
        save();
        b.setAttribute("aria-pressed", String(on.has(k)));
      };
      chips.append(b);
    }
    body.append(chips);
    const own = document.createElement("input");
    own.className = "m-g-own";
    own.maxLength = 200;
    own.placeholder = t("gWheelOwn");
    own.setAttribute("aria-label", t("gWheelOwn"));
    own.value = cfg.gameWheelOwn || "";
    own.onkeydown = (e) => e.stopPropagation();
    own.onchange = () => {
      cfg.gameWheelOwn = own.value;
      save();
    };
    body.append(own);
  }
  // Spielleitung am Handy: eigener QR-Code, nur auf Knopfdruck zu sehen. Wer ihn scannt, darf Spiele steuern.
  function hostPanel(body) {
    const host = sideBtn(body, t("gHost"), t("gHostHint"), async () => {
      q.hostOpen = !q.hostOpen;
      if (q.hostOpen && !cfg.partyLive) liveOn(() => (q.hostOpen = false));
      showSide("games");
    }, q.hostOpen, UI.qr);
    host.classList.add("m-g-hostbtn");
    host.setAttribute("aria-expanded", String(!!q.hostOpen));
    if (!q.hostOpen) return;
    const wrap = document.createElement("div");
    wrap.className = "m-g-hostqr";
    const note = document.createElement("p");
    note.className = "m-im-side-note";
    note.textContent = t("gHostNote");
    wrap.append(note);
    body.append(wrap);
    live.hostInfo().then((info) => {
      if (!wrap.isConnected) return;
      const img = new Image();
      img.alt = "";
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(info.qr);
      wrap.prepend(img);
    }).catch(() => {});
  }
  // Handy-Spiele und die Spielleitung brauchen den Live-Link: Mirage schaltet ihn ein – und sagt es, mit
  // „Rückgängig“. Nach dem Spiel fragt ein Hinweis, ob er anbleiben soll (er war ja nicht bewusst eingeschaltet).
  let liveAuto = false, gameWas = false;
  function liveOn(undo) {
    cfg.partyLive = true;
    save();
    showExtras();
    liveAuto = true;
    imToast(t("liveAutoOn"), [[t("imUndo"), () => {
      undo?.();
      liveOff();
    }]], 7000);
  }
  function liveOff() {
    liveAuto = false;
    cfg.partyLive = false;
    save();
    showExtras();
    if (side === "games") showSide("games");
  }
  function liveAfterGame() {
    const now = !!games.active();
    if (gameWas && !now && liveAuto && cfg.partyLive) {
      liveAuto = false;
      imToast(t("liveKeepAsk"), [[t("liveKeep"), () => {}], [t("liveOff"), () => {
        liveOff();
        imToast(t("liveOffDone"));
      }]], 12000);
    }
    gameWas = now;
  }
  let gameCfgOpen = false;
  function gamesPanel(body) {
    const cur = games.active();
    if (cur) {
      if (games.waiting()) sideBtn(body, t("gStartNow"), "", () => games.beginNow(), false, UI.play);
      if (WHEELS.has(cur)) sideBtn(body, t("gSpin"), "", () => games.spin(), false, GAME.wheel);
      else if (!games.waiting()) sideBtn(body, t("gSkip"), "", () => games.skip(), false, UI.skip);
      sideBtn(body, t("gEndNow"), "", () => {
        games.stop();
        showSide("games");
      }, false, UI.stop);
      hostPanel(body);
      return;
    }
    const note = document.createElement("p");
    note.className = "m-im-side-note";
    note.textContent = t("gHint");
    body.append(note);
    let cat = "";
    for (const { k, cat: c, label, hint } of GAME_LIST) {
      if (c !== cat) {
        cat = c;
        const h = document.createElement("div");
        h.className = "m-im-side-sec";
        h.textContent = t(c);
        body.append(h);
        if (c === "gCatDrink") {
          const warn = document.createElement("p");
          warn.className = "m-im-side-note";
          warn.textContent = t("gDrinkNote");
          body.append(warn);
        }
      }
      const g = sideBtn(body, t(label), t(hint), async () => {
        // Handy-Spiele brauchen den Live-Link
        if (!WHEELS.has(k) && !cfg.partyLive) {
          liveOn(() => games.stop());
          await live.prepare();
        }
        games.start(k);
        // die Leiste würde die Spielkarte verdecken; beenden geht über denselben Knopf oben
        showSide(null);
      }, false, GAME[k] || UI.music);
      g.dataset.game = k;
    }
    hostPanel(body);
    const set = sideBtn(body, t("gSettings"), "", () => {
      gameCfgOpen = !gameCfgOpen;
      showSide("games");
      q.sideBody.scrollTop = q.sideBody.scrollHeight;
    }, gameCfgOpen, UI.gear);
    set.classList.add("m-g-setbtn");
    set.setAttribute("aria-expanded", String(gameCfgOpen));
    if (gameCfgOpen) gameSettings(body);
  }

  /* ---- DJ: Tempo und Tonart des laufenden Songs, dazu die am besten passenden aus der Warteschlange */
  let djToken = 0;
  function djPanel(body) {
    const token = ++djToken, cur = currentItem();
    sideBtn(body, t("djEnergy"), cfg.djEnergy ? t("djEnergyOn") : t("djEnergyOff"), () => {
      cfg.djEnergy = !cfg.djEnergy;
      save();
      showSide("dj");
    }, cfg.djEnergy);
    const head = document.createElement("div");
    head.className = "m-im-side-sec";
    head.textContent = t("djNow");
    body.append(head);
    const nowRow = sideBtn(body, titleOf(cur) || "–", t("loading"));
    const sec = document.createElement("div");
    sec.className = "m-im-side-sec";
    sec.textContent = t("djNext");
    const secSub = document.createElement("small");
    secSub.textContent = t("djNextSub");
    sec.append(secSub);
    body.append(sec);
    const box = document.createElement("div");
    box.className = "m-im-side-group";
    body.append(box);
    sideBtn(box, t("loading"));
    const fmtI = (i) => (i ? `${i.cam || "?"} · ${i.bpm} BPM` : "");
    dj.suggest(cur?.uri, ({ cur: ci, list, done }) => {
      if (token !== djToken || side !== "dj") return;
      nowRow.querySelector("small").textContent = ci ? fmtI(ci) : t("djNoData");
      box.textContent = "";
      if (!list.length) return void sideBtn(box, done ? t("djNone") : t("loading"));
      for (const x of list) {
        sideBtn(box, x.title, `${fmtI(x.info)} · ${t("djFit").replace("{p}", Math.round(x.score * 100))}`, async () => {
          try {
            await S.addToQueue([{ uri: x.uri }]);
            S.showNotification?.(t("djQueued").replace("{t}", x.title), false, 3000);
          } catch {}
        });
      }
      if (!done) sideBtn(box, t("djMore"));
    });
    // Reihenfolge anwenden: die nächsten Songs zu einer Kette ordnen (Tonart, Tempo, Energiekurve), mit Rückgängig
    const osec = document.createElement("div");
    osec.className = "m-im-side-sec";
    osec.textContent = t("djOrder");
    const osub = document.createElement("small");
    osub.textContent = t("djOrderSub");
    osec.append(osub);
    const obox = document.createElement("div");
    obox.className = "m-im-side-group";
    body.append(osec, obox);
    const drawOrder = (res) => {
      if (token !== djToken || side !== "dj") return;
      obox.textContent = "";
      const go = sideBtn(obox, t("djOrderApply"), dj.canReorder() ? "" : t("djOrderNoApi"), async () => {
        go.disabled = true;
        go.querySelector("b").textContent = t("loading");
        const r = await dj.sortQueue(currentItem()?.uri);
        const msg = { done: "djOrderDone", same: "djOrderSame", few: "djOrderFew", locked: "gLocked", fail: "djOrderFail", list: "djOrderNoApi" }[r.state];
        S.showNotification?.(t(msg).replace("{n}", r.n).replace("{a}", r.from).replace("{b}", r.to), r.state === "fail", 4000);
        drawOrder(r);
      });
      if (dj.canUndo()) {
        sideBtn(obox, t("djOrderUndo"), "", async () => {
          const ok = await dj.undoSort();
          S.showNotification?.(t(ok ? "djOrderUndone" : "djOrderFail"), !ok, 3000);
          drawOrder(null);
        });
      }
      // die neue Reihenfolge, nummeriert (ohne Spotifys Verschiebe-Funktion ist das der Vorschlag zum Nachbauen)
      if (res?.order && res.state !== "fail") res.order.forEach((x, i) => sideBtn(obox, `${i + 1}. ${x.title}`, [x.artist, fmtI(x.info)].filter(Boolean).join(" · ")));
    };
    drawOrder(null);
  }

  /* ---- Abstimmung: die nächsten drei Songs zur Wahl, die Handys stimmen 45 s lang ab */
  let pollTimer = 0;
  function pollPanel(body) {
    const p = live.pollState();
    if (!cfg.partyLive) return void sideBtn(body, t("pollNeedLive"));
    if (p && Date.now() < p.end) {
      sideBtn(body, t("pollRun").replace("{s}", Math.ceil((p.end - Date.now()) / 1000)));
      p.o.forEach((o, i) => sideBtn(body, o.t, `${o.a} · ${p.v[i]} ${t("pollVotes")}`));
      return;
    }
    sideBtn(body, t("pollStart"), "", startPoll);
  }
  function startPoll() {
    const next = ctl.upNext().filter((x) => x.uri?.startsWith("spotify:track:")).slice(0, 3);
    if (next.length < 2) return S.showNotification?.(t("pollFew"), true, 4000);
    live.startPoll(next.map((x) => ({ t: x.title, a: x.artist, img: x.image, uri: x.uri })));
    clearTimeout(pollTimer);
    pollTimer = setTimeout(endPoll, 45200);
    showSide("poll");
    drawPoll();
  }
  async function endPoll() {
    const p = live.pollState();
    if (!p) return;
    const best = p.v.indexOf(Math.max(...p.v));
    const win = p.o[best];
    // Gewinner kommt in die Warteschlange (spielt damit als Nächstes) – nur wenn jemand abgestimmt hat
    if (win && Math.max(...p.v) > 0) {
      try {
        await S.addToQueue([{ uri: win.uri }]);
      } catch {}
      S.showNotification?.(t("pollWin").replace("{t}", win.t), false, 5000);
    }
    drawPoll();
    if (side === "poll") showSide("poll");
  }
  // kleine Karte unten links auf dem Party-Bild: die drei Songs mit ihren Stimmen
  function drawPoll() {
    const p = live.pollState();
    let card = el.querySelector(".m-im-pollcard");
    if (!p || Date.now() > p.end + 6000) return void card?.remove();
    if (!card) {
      card = document.createElement("div");
      card.className = "m-im-pollcard";
      el.append(card);
    }
    const total = p.v.reduce((a, b) => a + b, 0) || 1;
    card.textContent = "";
    const h = document.createElement("b");
    h.textContent = Date.now() < p.end ? t("pollRun").replace("{s}", Math.ceil((p.end - Date.now()) / 1000)) : t("pollEnd");
    card.append(h);
    p.o.forEach((o, i) => {
      const row = document.createElement("div");
      row.className = "m-im-pollrow";
      row.style.setProperty("--w", ((p.v[i] / total) * 100).toFixed(0) + "%");
      const n = document.createElement("span"), c = document.createElement("i");
      n.textContent = o.t;
      c.textContent = String(p.v[i]);
      row.append(n, c);
      card.append(row);
    });
    if (Date.now() < p.end + 6000) setTimeout(drawPoll, 1000);
  }
  window.addEventListener("mirage:poll", () => {
    drawPoll();
    if (side === "poll") showSide("poll");
  });

  // Reaktionen der Gäste: Lichtzeichen aus der Menge (live.js → Location, stagefx.js)

  /* ---- Rückblick: Bild, Party-Playlist, Gäste-Ranking */
  function recapPanel(body) {
    sideBtn(body, t("recapImage"), `${recap.songs.length} ${t("recapSongs")}`, () => partyRecapCard(recap));
    sideBtn(body, t("recapPlaylist"), "", savePartyPlaylist);
    const rank = live.ranking();
    if (rank.length) {
      const h = document.createElement("div");
      h.className = "m-im-side-sec";
      h.textContent = t("rankTitle");
      body.append(h);
      rank.forEach((g, i) => sideBtn(body, `${i + 1}. ${g.n || t("rankGuest")}`, t("rankLine").replace("{w}", g.played).replace("{v}", g.votes)));
    }
  }
  // Ein Abend = eine Playlist: recap.saved merkt sich, was schon drin ist. Ein zweiter Klick legt nie eine
  // zweite Playlist an, sondern trägt nur die Songs nach, die seitdem dazugekommen sind.
  let savingPlaylist = false;
  async function savePartyPlaylist() {
    if (savingPlaylist) return;
    const all = recap.songs.map((x) => x.uri).filter((u) => u?.startsWith("spotify:track:"));
    const done = recap.saved;
    const uris = planPartySave(all, done?.uris);
    if (!all.length) return;
    const name = done?.name || `Mirage Party · ${new Date(recap.start || Date.now()).toLocaleDateString()}`;
    if (done && !uris.length) return void S.showNotification?.(t("recapAlready").replace("{n}", name), false, 4000);
    // erst fragen: eine Playlist in der Bibliothek soll niemand aus Versehen anlegen
    if (!done && !confirm(t("recapConfirm").replace("{c}", uris.length).replace("{n}", name))) return;
    savingPlaylist = true;
    let uri = done?.uri || "", ok = false;
    const idOf = (u) => String(u).split(":").pop();
    try {
      if (!uri) uri = (await S.Platform?.RootlistAPI?.createPlaylist?.(name, { before: "start" })) || "";
      // manche Spotify-Versionen liefern ein Objekt statt der Adresse
      if (uri && typeof uri !== "string") uri = uri.uri || "";
      if (uri) {
        await S.Platform.PlaylistAPI.add(uri, uris, done ? { after: "end" } : { before: "start" });
        ok = true;
      }
    } catch {}
    // Rückfall: Web-API – in die schon angelegte Playlist, nie eine zweite
    if (!ok) {
      try {
        if (!uri) {
          const me = await S.CosmosAsync.get("https://api.spotify.com/v1/me");
          uri = (await S.CosmosAsync.post(`https://api.spotify.com/v1/users/${me.id}/playlists`, { name, public: false, description: "Mirage party recap" })).uri || "";
        }
        if (uri) {
          for (let i = 0; i < uris.length; i += 100) await S.CosmosAsync.post(`https://api.spotify.com/v1/playlists/${idOf(uri)}/tracks`, { uris: uris.slice(i, i + 100) });
          ok = true;
        }
      } catch {}
    }
    // auch eine leer gebliebene Playlist merken: der nächste Versuch füllt sie, statt eine neue anzulegen
    if (uri) recap.saved = { uri, name, uris: ok ? all : done?.uris || [] };
    savingPlaylist = false;
    const msg = !ok ? t("recapSaveFail") : done ? t("recapAdded").replace("{c}", uris.length).replace("{n}", name) : t("recapSaved").replace("{n}", name);
    S.showNotification?.(msg, !ok, 4000);
  }

  /* ---- Party auf anderem Bildschirm. Der PC rechnet die Party, der Fernseher zeigt nur das fertige Bild:
     Chromecast / Google TV / DLNA-Fernseher bekommen es als Videostream von der Overlay-App, Miracast
     (Windows, Win + K) macht den Fernseher zum zweiten Bildschirm, Kabel-Bildschirme gehen direkt.
     Ton bleibt am PC – außer „Ton mitschicken“ ist an, dann steckt er im Stream (im Takt mit dem Bild). */
  let castList = null, castBox = null;
  const sideHead = (body, text, sub) => {
    const h = document.createElement("div");
    h.className = "m-im-side-sec";
    h.textContent = text;
    if (sub) {
      const s2 = document.createElement("small");
      s2.textContent = sub;
      h.append(s2);
    }
    body.append(h);
  };
  // icon: Linien-Symbol links (icons.js); nav: Pfeil rechts – die Zeile führt zu einer weiteren Seite
  function sideBtn(parent, label, sub, onClick, on, icon, nav) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "m-im-side-item" + (on ? " is-on" : "") + (icon ? " has-ic" : "");
    if (on) b.setAttribute("aria-current", "true");
    if (icon) b.append(iconEl(icon, "m-ic m-im-side-ic"));
    const txt = document.createElement("span"), l = document.createElement("b");
    l.textContent = label;
    txt.append(l);
    if (sub) {
      const s2 = document.createElement("small");
      s2.textContent = sub;
      txt.append(s2);
    }
    b.append(txt);
    if (nav) b.append(iconEl(UI.chevron, "m-ic m-im-side-go"));
    if (onClick) b.onclick = onClick;
    else b.disabled = true;
    parent.append(b);
    return b;
  }
  function screensPanel(body) {
    // 1) Fernseher im Netz (findet und beliefert die Overlay-App)
    sideHead(body, t("scrCast"), t("scrCastSub"));
    castBox = document.createElement("div");
    castBox.className = "m-im-side-group";
    body.append(castBox);
    if (!bridge.connected()) sideBtn(castBox, t("scrNoOverlay"), t("scrNoOverlaySub"));
    else {
      if (castList) drawCast();
      else sideBtn(castBox, t("scrSearching"));
      bridge.send({ type: "castScan" });
    }
    // 2) Miracast: Windows’ eigene Funkübertragung
    if (/Windows/i.test(navigator.userAgent)) {
      sideHead(body, t("scrMira"), t("scrMiraSub"));
      sideBtn(body, t("scrMiraBtn"), bridge.connected() ? t("scrMiraBtnSub") : t("scrNoOverlay"), bridge.connected() ? () => bridge.send({ type: "castMiracast" }) : null);
    }
    // 3) Bildschirme an diesem PC (auch der Fernseher nach Miracast)
    if ("getScreenDetails" in window) {
      sideHead(body, t("scrPc"));
      sideBtn(body, t("scrPcBtn"), t("scrPcSub"), toScreen);
    }
    // 4) Ton
    sideHead(body, t("scrSound"), t("scrSoundSub"));
    sideBtn(body, t("scrSoundCast"), cfg.partyCastSound ? t("scrSoundOn") : t("scrSoundOff"), () => {
      cfg.partyCastSound = !cfg.partyCastSound;
      save();
      showSide("screens");
    }, cfg.partyCastSound);
  }
  function drawCast() {
    if (!castBox?.isConnected) return;
    castBox.textContent = "";
    const list = castList || [];
    if (!list.length) return void sideBtn(castBox, t("scrNone"), t("scrNoneSub"));
    for (const d of list) {
      const sub = d.on ? t("scrCasting") : `${d.model}${d.model ? " · " : ""}${d.kind === "dlna" ? "DLNA" : "Google Cast"}`;
      sideBtn(castBox, d.name, sub, () => (d.on ? bridge.send({ type: "castStop", id: d.id }) : castTo(d)), d.on);
    }
  }
  function castTo(d) {
    // Vollbild: dann nimmt die Overlay-App die Party in voller Größe auf (bis 1080p, 30 Bilder/s)
    if (!(document.fullscreenElement || document.webkitFullscreenElement)) toggleFull();
    S.showNotification?.(t("scrCastGo").replace("{n}", d.name), false, 3000);
    bridge.send({ type: "castStart", id: d.id, audio: !!cfg.partyCastSound });
  }
  window.addEventListener("mirage:cast", (e) => {
    const m = e.detail || {};
    if (Array.isArray(m.list)) castList = m.list;
    if (m.result) {
      const name = castList?.find((x) => x.id === m.id)?.name || "";
      const msg = m.result.ok ? t("scrCastOk") : m.result.error === "nowindow" ? t("scrNoWindow") : t("scrCastFail");
      S.showNotification?.(msg.replace("{n}", name), !m.result.ok, 5000);
    }
    if (side === "screens") drawCast();
  });
  // Party als Vollbild auf einem anderen Bildschirm (Chromium-Fensterverwaltung; fragt einmal um Erlaubnis)
  async function toScreen() {
    try {
      const d = await window.getScreenDetails();
      const other = d.screens.find((x) => x !== d.currentScreen) || d.currentScreen;
      await document.documentElement.requestFullscreen({ screen: other });
      setTimeout(syncState, 300);
    } catch {}
  }

  // Fenster verdeckt oder minimiert: Chromium hält die Bildschleife an (0 Bilder/s) – ohne das hier gingen nach
  // 2,5 s Live-Link, Handys und Songwünsche aus, obwohl die Party läuft. Ein winziger Worker gibt den Takt vor
  // (Worker-Nachrichten werden in verdeckten Fenstern nicht gedrosselt wie Timer); gezeichnet wird nichts.
  let hiddenAt = 0, ticker = null, tickUrl = "";
  const tickerNeeded = () => document.hidden && !!el && isOpen() && el.dataset.mode === "party" && cfg.partyLive;
  function hiddenTick() {
    if (!tickerNeeded()) return syncTicker();
    const now = performance.now(), dt = hiddenAt ? Math.min(1, (now - hiddenAt) / 1000) : 0.25;
    hiddenAt = now;
    const pos = songPos(now), px = party.step(pos / 1000, dt, PLR.isPlaying());
    const k = lyr?.synced ? seek(lyr.lines, pos, "t") : -1;
    const lineAt = (i) => (lyr?.synced && i >= 0 && lyr.lines[i]?.text !== "♪" && lyr.lines[i]?.text) || "";
    live.feed(px, vividPal || imPalette(), party.info.bpm, { ly: lineAt(k), lyn: lineAt(k + 1) });
  }
  // Der Taktgeber läuft nur, solange er gebraucht wird (Fenster verdeckt UND Party mit Handys). Früher tickte
  // er ab dem ersten Öffnen des Immersiv-Modus viermal pro Sekunde weiter – auch geschlossen und im Leerlauf.
  function syncTicker() {
    const need = tickerNeeded();
    if (need === !!ticker) return;
    hiddenAt = 0;
    if (!need) {
      if (ticker.terminate) ticker.terminate();
      else clearInterval(ticker);
      ticker = null;
      return;
    }
    try {
      tickUrl ||= URL.createObjectURL(new Blob(["setInterval(() => postMessage(0), 250);"], { type: "text/javascript" }));
      ticker = new Worker(tickUrl);
      ticker.onmessage = hiddenTick;
    } catch {
      ticker = setInterval(hiddenTick, 250);
    }
  }
  document.addEventListener("visibilitychange", syncTicker);

  /* ---- Ressourcen freigeben: geschlossen oder lange verdeckt */
  // Was nur die sichtbare Ebene braucht, wird nach einer Frist abgegeben: Location-Thread (Körperbilder bis
  // ~12 MB, sein Canvas), Visualizer-Canvas (bis 3 Mio. Pixel = 12 MB), die Ebene der Wortbilder und die
  // Canvas-Videos samt Decoder. Klein und fürs schnelle Wiederöffnen wichtig (Wörterbuch-Index, Taktdaten) bleibt.
  let releaseT = 0, hiddenT = 0;
  function dropCanvases() {
    venueRelease();
    q.canvas.width = q.canvas.height = 0;
    // beim nächsten Bild bzw. open() neu ausmessen
    sizeKey = "";
    wordFx.release();
  }
  function release() {
    releaseT = 0;
    if (!el || isOpen()) return;
    dropCanvases();
    // Video ohne Quelle: erst load() gibt Puffer und Decoder wirklich frei
    for (const v of [q.video, q.cvid]) {
      if (!v.getAttribute("src")) continue;
      v.classList.remove("is-on");
      v.removeAttribute("src");
      v.load();
    }
  }
  document.addEventListener("visibilitychange", () => {
    clearTimeout(hiddenT);
    if (document.hidden) {
      if (isOpen()) hiddenT = setTimeout(() => document.hidden && isOpen() && dropCanvases(), HIDDEN_MS);
    } else if (isOpen()) {
      // wieder sichtbar: ein Bild zeichnen, damit Bühne und Visualizer nicht leer stehen (auch bei Pause) –
      // und die Bildschleife neu starten, die frame() beim Verdecken angehalten hat
      kick();
    }
  });

  // Ein- und Ausblenden dauert so lange wie der Übergang in user.css (#mirage-immersive: opacity 0.6s)
  const FADE_MS = 620;
  // fadeT: Abschluss des laufenden Ein-/Ausblendens; fadingOut: Ebene blendet gerade aus (Schleife läuft noch)
  let fadeT = 0, fadingOut = false, openedUri = null, showing = false, showRaf = 0;
  function open() {
    if (!isOpen()) lastFocus = document.activeElement;
    clearTimeout(releaseT);
    clearTimeout(fadeT);
    // Wieder öffnen, während die Ebene noch ausblendet (schnelles Hin und Her): alles steht noch – nur die
    // Richtung umkehren. Kein Neuaufbau, sonst hakt die Umkehr mitten in der Blende.
    const quick = fadingOut && !!el && openedUri === (currentItem()?.uri || "");
    fadingOut = false;
    if (!quick) {
      if (!el) build();
      sizeCanvas();
      setMode(cfg.imMode, false);
      styleLyrics();
      refresh();
      setHaze(lastHaze);
      syncState();
      openedUri = currentItem()?.uri || "";
    }
    cancelAnimationFrame(showRaf);
    // 1.27 views: die Uhr läuft nur, solange die Ebene offen ist
    clockView.show(el.dataset.mode === "clock");
    if (quick) el.classList.add("is-on");
    else {
      // Erst nach dem Aufbau einblenden: Aufbau, Layout und erstes Zeichnen kosten ein langes Bild (bis 150 ms).
      // Lief die Blende schon in diesem Bild, war sie beim ersten sichtbaren Bild fast fertig – die Ebene sprang auf
      // statt einzublenden. Zwei Bilder später beginnt sie bei 0. „showing“ zählt solange schon als offen.
      showing = true;
      showRaf = requestAnimationFrame(() => {
        showRaf = requestAnimationFrame(() => {
          showRaf = 0;
          if (!showing) return;
          showing = false;
          el.classList.add("is-on");
        });
      });
    }
    // Hintergrund dahinter erst anhalten und verstecken, wenn die Ebene ganz deckt: vorher scheint die normale
    // Oberfläche durch die halb durchsichtige Ebene – verschwand die Bühne sofort, sprang ihr Hintergrund
    // im ersten Bild auf Einfarbig (Blitz beim Öffnen).
    fadeT = setTimeout(() => {
      fadeT = 0;
      if (!isOpen()) return;
      root.classList.add("mirage-im-open");
      dust.pause(true);
    }, FADE_MS + 50);
    requestAnimationFrame(placeIndicator);
    if (!quick) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    // wake statt kick: direkt in die Party geöffnet (ohne Mausbewegung) startet so auch der Wecker fürs Ausblenden
    wake();
    q.play.focus();
    // die Ebene wird erst mit dem nächsten Bild sichtbar – vorher nimmt der Knopf den Fokus nicht an
    setTimeout(() => isOpen() && !el.contains(document.activeElement) && q.play.focus(), 80);
  }
  function close() {
    if (!el || !isOpen()) return;
    // noch gar nicht eingeblendet (Taste doppelt gedrückt): Einblenden einfach abbrechen
    cancelAnimationFrame(showRaf);
    showRaf = 0;
    showing = false;
    el.classList.remove("is-on");
    // Bühne sofort zurück: sie liegt unter der ausblendenden Ebene und ist zu sehen, sobald diese durchscheint
    root.classList.remove("mirage-im-open");
    dust.pause(false);
    q.video?.pause();
    toggleKeys(false);
    clearTimeout(idleT);
    syncTicker();
    clearTimeout(releaseT);
    releaseT = setTimeout(release, RELEASE_MS);
    if (document.fullscreenElement) document.exitFullscreen?.();
    // Fokus zurück dorthin, wo er vor dem Öffnen war – sonst hängt er an einem unsichtbaren Knopf
    if (el.contains(document.activeElement)) lastFocus?.isConnected && lastFocus !== document.body ? lastFocus.focus() : document.activeElement.blur();
    // Während des Ausblendens läuft die Ebene weiter (Visualizer, Liedtext, Party) statt mitten in der Blende
    // einzufrieren; Seitenleiste und Bedienung verschwinden erst danach – vorher sprangen sie in der Blende
    // weg bzw. tauchten aus dem Leerlauf noch einmal auf. Aufgeschobene Arbeit (tints.js) kommt auch erst dann.
    fadingOut = true;
    clearTimeout(fadeT);
    fadeT = setTimeout(() => {
      fadeT = 0;
      fadingOut = false;
      if (isOpen()) return;
      showSide(null);
      el.classList.remove("is-idle");
      cancelAnimationFrame(raf);
      raf = 0;
      // 1.27 views: geschlossen tickt auch die Uhr nicht weiter
      clockView.show(false);
      document.dispatchEvent(new Event("mirage:im-close"));
    }, FADE_MS);
  }
  const isOpen = () => !!el && (showing || el.classList.contains("is-on"));
  const playState = () => el && (kick(), clockView.playing(), (q.play.innerHTML = PLR.isPlaying() ? ICON.pause : ICON.play), playLabel());
  const seekBy = (ms) => PLR.seek(clamp((PLR.getProgress() || 0) + ms, 2, PLR.getDuration() || 2));
  const volBy = (d) => { S.Player.setVolume(clamp((S.Player.getVolume?.() ?? 1) + d, 0, 1)); setTimeout(syncState, 80); };
  return {
    // von außen (Einstellungen) nur bei offener Ebene: sonst startete z. B. das Canvas-Video unsichtbar und liefe weiter
    open, close, toggle: () => (isOpen() ? close() : open()), isOpen, refresh: () => isOpen() && refresh(), setMode, playState, updateKicker, setHaze, prebake: (src) => src && bake(src),
    seekBy, volBy, toggleFull, toggleKeys, dismiss, confetti, perfMenu, toggleQueue: () => el && showSide(side === "queue" ? null : "queue"), styleLyrics: () => el && styleLyrics(), reloadLyrics: () => { lyrUri = ""; lyrGate.reset(); el && LYR.has(el.dataset.mode) && loadLyrics(); }, toggleTiming, togglePlayful, timingKey, like: () => q.like?.click(), shuffle: () => q.shuffle && !q.shuffle.hidden && q.shuffle.click(), repeat: () => q.repeat && !q.repeat.hidden && q.repeat.click(),
    // 1.27 views: Zustand der Album-Spalte (Tests)
    albumState: () => album.state,
    // 1.27 actions: Taste M (Song-Menü) und A (Zu Playlist hinzufügen); per Tastatur liegt der Fokus gleich auf der ersten Zeile
    songMenu: (kind = "song") => {
      if (!el || !isOpen()) return;
      if (side === kind) return showSide(null);
      showSide(kind);
      queueMicrotask(() => kind === "song" && q.side.querySelector(".m-im-side-item:not(:disabled)")?.focus());
    },
  };
})();

export { ICON, MODES, immersive };
