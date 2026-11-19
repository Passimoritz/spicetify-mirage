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
import { getLyrics, watchLyrics, dropStaleLyrics, lyricVersions, pickLyrics, rejectLyrics, rejectedCount, translateLines, getCanvas, canvasBlocked, SOURCE_NAME, romajiFor } from "./lyrics.js";
import { estimateSync, applySync } from "./lyricsync.js";
import { parseVoices, bgFlags, bgParts, voiceColors } from "./lyricvoices.js";
import { lineAt } from "./songtime.js";
import { LANG } from "./i18n.js";
import { nowPlayingCard, partyRecapCard, planPartySave } from "./share.js";
import * as ctl from "./controls.js";
import { currentItem, covers, titleOf, artistOf, toggleMute, PLR } from "./player.js";
import { party } from "./party.js";
import { grade as gradePal } from "./director.js";
import { jamMembers } from "./jam.js";
import { createVenue } from "./venue.js";
import { songPos } from "./clock.js";
import { instruments } from "./instruments.js";
import { live } from "./live.js";
import { createWordFx, FX as WORD_FX } from "./words.js";
import { createScenarios } from "./scenarios.js";
import { LEX } from "./lexicon.js";
import { bridge } from "./bridge.js";
import { dj } from "./dj.js";
import { UI, GAME, iconEl } from "./icons.js";
import { games, GAME_LIST, WHEEL_FIELDS, WHEELS, GUEST_COLORS, TOUR_POOL } from "./games.js";
import { free } from "./lock.js";
import { setPreset, setPerf, presetFill } from "./settings.js";
import { COST, tier } from "./perf.js";
import { createSteadyClock, createBeatClock } from "./steady.js";
// 1.27 views: weitere Visualizer-Stile, Album-Reise und Uhr-Ansicht (eigene Module)
import { drawWavefield, drawCoverDust, resetVizExtra } from "./vizextra.js";
import { createAlbumView } from "./albumview.js";
import { createClockView } from "./clockview.js";

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
  const wordFx = createWordFx(LEX, { onFire: (c, w) => (live.fx(c, w), stageWord(c)) });
  // Szenarien: die Bühne antwortet auf gesungene Wörter (scenarios.js entscheidet, stagefx.js in der Location zeichnet)
  const scen = createScenarios();
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
  function stageWord(c) {
    const px = wfxGeo?.px;
    if (!px || !cfg.partyWords) return;
    scen.word(c, {
      t: performance.now() / 1000, energy: px.energy, kind: px.kind, level: px.level, lite: lightMode(), calm: cfg.calm || reducedMotion.matches,
      noFlash: !!cfg.noFlash, flash: !!(cfg.partyFlash && px.fx), beat: 60 / (px.tempo || 120), phase: px.phase, col: WORD_FX[c]?.col,
    });
  }
  let wfxGeo = null, wfxAt = 0;
  let vals = new Float32Array(120), targets = new Float32Array(120), lastVizT = 0, tunnel3d = [], tunnelAt = 0;
  // Bewegungs- und Schlag-Uhr ohne Sprünge: Spulen, Songwechsel und Ansichtswechsel rissen sonst Kranz und
  // Scheinwerfer im selben Bild um ganze Drehungen weiter (steady.js)
  const motion = createSteadyClock(), beatsClock = createBeatClock();
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
          <button type="button" class="m-im-sm m-im-share">${ICON.share}</button>
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
          <button type="button" class="m-im-sm m-im-shuffle">${ICON.shuffle}</button>
          <button type="button" class="m-im-prev">${ICON.prev}</button>
          <button type="button" class="m-im-play">${ICON.play}</button>
          <button type="button" class="m-im-next">${ICON.next}</button>
          <button type="button" class="m-im-sm m-im-repeat">${ICON.repeat}</button>
        </div>
        <div class="m-im-extras">
          <button type="button" class="m-im-sm m-im-like">${ICON.heart}</button>
          <button type="button" class="m-im-sm m-im-addto" data-menu="playlists">${ICON.add}</button>
          <div class="m-im-vol">
            <button type="button" class="m-im-sm m-im-mute">${ICON.vol}</button>
            <input type="range" class="m-im-volume" min="0" max="100" step="1">
          </div>
          <button type="button" class="m-im-sm m-im-queue-btn" data-menu="queue">${ICON.queue}</button>
          <button type="button" class="m-im-sm m-im-dev" data-menu="devices">${ICON.devices}</button>
          <button type="button" class="m-im-sm m-im-timer" data-menu="timer">${ICON.timer}</button>
          <button type="button" class="m-im-sm m-im-full">${ICON.full}</button>
        </div>
      </div>
      <div class="m-im-lyrics"><div class="m-im-lyrics-inner"></div></div>
      <div class="m-im-lyrbar">
        <button type="button" class="m-im-trbtn" hidden aria-pressed="false">${ICON.translate}<span></span><i aria-hidden="true"></i></button>
        <button type="button" class="m-im-lyrsrc" data-menu="versions" hidden><span></span><b></b></button>
        <button type="button" class="m-im-lyrsrc m-im-lyrbad" hidden><span></span></button>
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
    for (const k of ["shuffle", "repeat", "like", "mute", "full"]) {
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
      lyrbad: el.querySelector(".m-im-lyrbad"),
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
      full: el.querySelector(".m-im-full"),
      addto: el.querySelector(".m-im-addto"),
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
    q.addto.title = t("c_addTo");
    q.addto.setAttribute("aria-label", t("c_addTo"));
    q.addto.onclick = () => showSide(side === "playlists" ? null : "playlists");
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
      changed: () => side === "games" && showSide("games"),
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
    if (!ctl.canAddTo()) q.addto.hidden = true;
    // Party: ruht die Maus, blendet die Bedienung aus und alles rückt weich zusammen
    for (const ev of ["pointermove", "pointerdown", "wheel"]) el.addEventListener(ev, wake, { passive: true });
    // Cover fertig verschoben: Visualizer neu ausmessen
    // (nicht nach Puls/Pendeln: die gleiten bei 30 Bildern/s je Bild kurz nach – das verschiebt nichts)
    q.wrap.addEventListener("transitionend", (e) => e.target === q.wrap && !/^(scale|rotate)$/.test(e.propertyName) && (vizRect.r = null));
    q.lyrsrc.querySelector("b").textContent = t("lyrPick");
    q.lyrsrc.onclick = () => showSide(side === "versions" ? null : "versions");
    q.lyrbad.querySelector("span").textContent = t("lyrWrong");
    q.lyrbad.title = t("lyrWrongHint");
    q.lyrbad.onclick = wrongLyrics;
    q.trbtn.querySelector("span").textContent = t("trToggle");
    q.trbtn.onclick = () => {
      // ein Klick schaltet die Einstellung „Liedtext übersetzen“ – gilt also auch für den nächsten Song
      cfg.translate = !cfg.translate;
      save();
      showTrBtn();
      if (cfg.translate) addTranslations(lyrToken);
      else {
        q.inner.querySelectorAll(".m-im-tr").forEach((n) => n.remove());
        relayLyrics();
      }
    };
    q.video = el.querySelector(".m-im-canvas");
    q.cvid = el.querySelector(".m-im-cvid");
    q.wishbtn = el.querySelector(".m-im-wishbtn");
    q.wishbtn.onclick = () => showSide(side === "wishes" ? null : "wishes");
    q.photobtn = el.querySelector(".m-im-photobtn");
    q.photobtn.onclick = () => showSide(side === "photos" ? null : "photos");
    q.cvbtn = el.querySelector(".m-im-cvbtn");
    q.cvbtn.onclick = async () => {
      const mode = el.dataset.mode;
      // ohne Canvas erklärt der Knopf, warum: im Spotify-Konto ausgeschaltet oder der Song hat einfach keins
      if (!canvasUrl) return S.showNotification?.(t((await canvasBlocked()) ? "canvasBlocked" : "canvasNone"), false, 6000);
      cfg.canvasIn = { ...(cfg.canvasIn || {}), [mode]: !cfg.canvasIn?.[mode] };
      save();
      applyCanvas();
    };
    q.keys = el.querySelector(".m-im-keys");
    const share = el.querySelector(".m-im-share"), help = el.querySelector(".m-im-help");
    share.title = share.ariaLabel = t("share");
    help.title = help.ariaLabel = t("keysTitle");
    share.onclick = () => nowPlayingCard();
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
    // Unterseite aus „Mehr“ (DJ, Umfrage …): ein Pfeil führt zurück ins Menü
    q.sideBack = el.querySelector(".m-im-side-back");
    q.sideBack.onclick = () => showSide("menu");
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
    q.full.onclick = toggleFull;
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
    for (const b of [q.shuffle, q.repeat, q.like, q.timerBtn]) b?.setAttribute("aria-pressed", String(b.classList.contains("is-on")));
    const rep = P.getRepeat?.() || 0;
    q.repeat.classList.toggle("is-on", rep > 0);
    q.repeat.innerHTML = rep === 2 ? ICON.repeatOne : ICON.repeat;
    const liked = !!P.getHeart?.();
    q.like.classList.toggle("is-on", liked);
    q.like.innerHTML = liked ? ICON.heartOn : ICON.heart;
    const muted = !!P.getMute?.();
    q.mute.innerHTML = muted ? ICON.mute : ICON.vol;
    q.mute.title = q.mute.ariaLabel = t(muted ? "c_unmute" : "c_mute");
    if (document.activeElement !== q.volume) q.volume.value = Math.round((muted ? 0 : P.getVolume?.() ?? 1) * 100);
    q.volume.style.setProperty("--v", q.volume.value + "%");
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
    for (const b of [q.full, q.fs]) {
      if (!b) continue;
      b.innerHTML = on ? ICON.fullOff : ICON.full;
      b.title = b.ariaLabel = t(on ? "fullOff" : "c_full");
    }
    el.classList.toggle("is-full", on);
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
          const x = c.getContext("2d");
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
  const sizeKeyNow = () => `${tier()}|${cfg.lite}|${cfg.eco}|${vizLive()}`;
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
    const [pixels, cap] = lightMode() ? [1.2e6, 1] : tier() === "full" ? [3e6, 1.5] : [2e6, 1.25];
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
  function wake() {
    kick();
    clearTimeout(idleT);
    if (el.classList.contains("is-idle")) {
      el.classList.remove("is-idle");
      vizMoveUntil = performance.now() + 1000;
    }
    if (cfg.partyIdle && el.dataset.mode === "party" && isOpen()) idleT = setTimeout(goIdle, 2600);
  }
  function goIdle() {
    // nicht, solange eine Seitenleiste oder die Tastenhilfe offen ist oder die Maus auf der Bedienung ruht
    if (!isOpen() || el.dataset.mode !== "party" || openMenu() || el.querySelector(".m-im-meta:hover, .m-im-top:hover, .m-im-lyrbar:hover")) {
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
      vizFadeUntil = VIZ.has(from) && !VIZ.has(mode) && !cfg.calm && isOpen() ? performance.now() + 550 : 0;
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
  async function updateLyrState() {
    const item = currentItem(), uri = item?.uri || "", tok = ++lyrStateToken;
    // beim selben Song nichts ausblenden: sonst flackert das Zeichen bei jeder Aktualisierung
    if (uri !== lyrStateUri) q.lyrstate.hidden = true;
    lyrStateUri = uri;
    if (!/^spotify:(track|local):/.test(uri)) return;
    const got = await getLyrics(uri).catch(() => null);
    if (tok !== lyrStateToken) return;
    const instrumental = !!got?.instrumental;
    // schon hier festlegen: sonst springt beim Wechsel in Liedtext oder Mix erst das Layout um
    setNoLyr(instrumental || !got?.lines?.length);
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
    // beim Aktivwerden legt snapWords die Wortanfänge zusätzlich auf die Ton-Einsätze der Analyse
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
    q.lyrbad.hidden = q.lyrsrc.hidden;
  }
  // „Nicht der richtige Liedtext“: das gezeigte Ergebnis für diesen Song als falsch merken und sofort das
  // nächstbeste holen (andere Quelle oder anderer Eintrag). Zurück geht es über „Fassung wählen“ → „Automatisch“.
  async function wrongLyrics() {
    const uri = lyrUri;
    if (!lyr || !uri || !cfg.onlineLyrics || !rejectLyrics(uri, lyr)) return;
    showSide(null);
    lyrUri = "";
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
      loadLyrics();
      showSide(null);
    };
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
  // Party ohne Liedtext: Titel und Bedienung rücken unter das Cover. Der Wechsel passiert erst, wenn klar ist,
  // ob es Text gibt (nicht schon beim Laden – sonst sprang alles bei jedem Songwechsel zweimal hin und her),
  // und er gleitet: Cover, Titel und Liedtext fliegen von der alten an die neue Stelle (FLIP).
  function setNoLyr(on) {
    if (!el || el.classList.contains("is-nolyr") === on) return;
    const parts = [q.wrap, q.meta, q.lyrics].filter(Boolean);
    const glide = LYR.has(el.dataset.mode) && !cfg.calm && el.isConnected;
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
        if (lyr === undefined || (got && got !== lyr)) {
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
    q.lyrsrc.hidden = q.lyrbad.hidden = true;
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
    q.inner.textContent = "";
    if (q.lyrics.classList.contains("is-unsynced")) q.lyrics.scrollTop = 0;
    // neuer Text blendet weich ein – als Web-Animation: das Neustarten einer CSS-Animation erzwang ein Layout
    lyrFade?.cancel();
    if (!matchMedia?.("(prefers-reduced-motion: reduce)").matches) lyrFade = q.inner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    showSource(got);
    setNoLyr(!got || !!got.instrumental || !got.lines?.length);
    updateLyrState();
    if (!got || got.instrumental) return;
    applyTiming(uri, got);
    // [duet 1.27] Duett-Stimmen und Hintergrundgesang (meist schon in lyrics.js erkannt; wiederholbar)
    parseVoices(got);
    voiceTint(true);
    // Stimmung der Lichtregie: eine kleine Wortliste über die Zeilen (bleibt lokal)
    party.lyrics(uri, got.synced ? got.lines : []);
    // Wort-Effekte (nur Party): Wörterbuch aufbauen und alle Zeilen durchsuchen kostet beim ersten Mal
    // ~40 ms – außerhalb von Party erst, wenn der Browser Luft hat, statt im Bild, in dem der Text erscheint
    wordPrep = () => {
      wordPrep = null;
      if (token !== lyrToken) return;
      if (cfg.partyWords && got.synced) {
        wordFx.prepare(uri, got.lines, got.lang);
        // Sprache ohne eigenes Wörterbuch: einmal die englische Übersetzung holen (nur mit Online-Suche)
        if (wordFx.needsTranslation() && cfg.onlineLyrics) translateLines(uri, got, "en").then((tr) => token === lyrToken && wordFx.addTranslated(uri, tr)).catch(() => {});
      } else wordFx.prepare(uri, [], "");
    };
    if (el.dataset.mode === "party") wordPrep();
    else if (window.requestIdleCallback) requestIdleCallback(() => wordPrep?.(), { timeout: 1500 });
    else setTimeout(() => wordPrep?.(), 300);
    const karaoke = cfg.karaoke && got.synced;
    el.classList.toggle("is-karaoke", karaoke);
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
    got.lines.forEach((l, i) => {
      const d = document.createElement("div");
      d.className = i === i0 ? "m-im-line is-active" : i < i0 ? "m-im-line is-past" : "m-im-line";
      if (i0 > -9) d.style.setProperty("--d", Math.min(Math.abs(i - Math.max(i0, 0)), 6));
      d.dataset.t = l.t;
      // [duet 1.27] Stimme (Farbe) und Hintergrundgesang als eigene, kleinere Zeile
      if (l.who) d.dataset.who = l.who;
      if (l.bg) d.classList.add("is-bgline");
      if (karaoke && l.text !== "♪") {
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
          list.push({ el: s, a: w.a, b: w.b, p: -1, text: w.text, sy: w.sy || null });
          if (w.est) list.est = true;
        });
        if (under) box.append(under);
        d.append(box);
        words[i] = list;
      } else if (l.bg) d.textContent = l.text;
      else bgSplit(d, l.text, l.who === "all");
      frag.append(d);
    });
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
    showTrBtn();
    if (cfg.translate) addTranslations(token);
    if (cfg.romanize) addRomaji(token);
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
      const l = lyr.lines[edit.i];
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
    if (token !== lyrToken || !tr || !cfg.translate) return;
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
  function showTrBtn() {
    const lang = (lyr?.lang || "").slice(0, 2).toLowerCase();
    q.trbtn.hidden = !lyr?.lines?.length || lyr.instrumental || lang === LANG;
    q.trbtn.classList.toggle("is-on", !!cfg.translate);
    q.trbtn.setAttribute("aria-pressed", String(!!cfg.translate));
    q.trbtn.title = t(cfg.translate ? "trHide" : "trShow");
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
    if (!lyr?.synced || lyr.aligned || lyr.source === "spotify" || lyr.timed || edit) return;
    const d = audio.data;
    if (!d?.segs?.length || audio.uri !== lyrUri || d.synthetic) return;
    lyr.aligned = true;
    const r = estimateSync(lyr.lines, d.segs);
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
      lyrGeo = { h: q.lyrics.clientHeight, mid: Array.from(lines, (ln) => ln.offsetTop + ln.offsetHeight / 2) };
    }
    return lyrGeo.h * 0.42 - lyrGeo.mid[i];
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
      activeEl?.classList.remove("is-hype");
      activeEl = lines[i] || null;
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
    }
    if (snap) {
      void getComputedStyle(q.inner).opacity; // nur Stil auflösen (Deckkraft braucht kein Layout)
      q.inner.style.transition = "";
    }
    pend?.after?.();
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
    if (mode === "mix" && V.style === "line") V.style = "wave";
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
    const rawQuiet = !!px && px.energy < 0.25 && px.build < 0.1 && px.toDrop > 5 && !px.drop;
    if (!rawQuiet) quietSince = 0;
    else if (!quietSince) quietSince = now;
    quietNow = rawQuiet && now - quietSince > 3000 && now - songAt > 8000;
    if (px && (ecoOn() || lightMode())) quality.level = Math.min(quality.level, 1);
    if (px) {
      const P = px.P;
      Object.assign(V, {
        mirror: P.mirror, spin: P.spin, glow: true, rings: true, ring: P.ring,
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
        if (px) {
          if (V.rings && (px.beat > 0.5 || (px.kickHit && px.energy > 0.55)) && px.low < 0.6) rings.push({ r: R, a: (0.35 + 0.6 * px.accent) * c, w: 2 + 5 * px.accent });
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

    let pal = px ? vivid(imPalette(), px.minor, px.P.tint, px.tone > 0.35 ? px.pitch : -1, px.keyPc) : imPalette();
    // Farbkorrektur je Teil (Sättigung, Temperatur, Kontrast, Farbwelt der Bridge)
    pal = gradePal(pal, (px || mood)?.grade);
    if (mood?.dropHit && V.rings) for (let k = 0; k < 2; k++) rings.push({ r: R - k * 40 * dpr, a: 0.8 - k * 0.25, w: 5 - k * 2 });
    // DJ-Übergabe (party.js): im Ausklang schon zu den Farben des nächsten Songs, danach weich in die neuen
    if (px) pal = party.mixPal(pal);
    // Sprung im Song (Spulen, Songwechsel, Taktdaten kommen an): die Lichtfarben gleiten in 0,6 s hinüber,
    // statt im selben Bild umzuspringen (Tonart, Moll, Farbkorrektur des Teils hängen an der Songzeit)
    if (px?.jump && palShown && !cfg.calm) palFade = { from: palShown, at: now };
    if (palFade) {
      const f = (now - palFade.at) / 600;
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
    const maxLen = Math.min(vw, vh) * 0.11 * V.height * (px ? Math.min(1, (R * 0.8) / (Math.min(vw, vh) * 0.11 * V.height)) : 1);
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
    if (px) drawParty(ctx, cx, cy, R, maxLen, N, pal, dpr, slow ? dt * 0.2 : dt, px, tip, ang);
    else if (V.style === "bottom") {
      // Balken am unteren Rand über die ganze Breite: abgerundete Köpfe, nach unten auslaufend
      const bw = vw / N, base = vh - 8 * dpr, w2 = bw * 0.62, rr = Math.min(w2 / 2, 4 * dpr);
      for (let gi = 0; gi < 3; gi++) {
        const g = ctx.createLinearGradient(0, base - vh * 0.32 * V.height, 0, base);
        g.addColorStop(0, rgba(mixRGB(pal[gi], WHITE, 0.25), 0.95));
        g.addColorStop(1, rgba(pal[gi], 0.35));
        ctx.fillStyle = g;
        ctx.beginPath();
        for (let i = gi; i < N; i += 3) {
          const h = 6 * dpr + vals[i] * vh * 0.32 * V.height;
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
      const life = (1400 - b * 500) / clamp(mood?.speed || 1, 0.5, 1.4), far = Math.hypot(vw, vh) * 0.62;
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
        const base = vh, hMax = vh * (0.22 + k * 0.07) * V.height, shift = tt * (8 + k * 6);
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
      const o = { vw, vh, cx, cy, R, dpr, vals, N, b, tt, dt, pal, glowK, height: V.height, glow: V.glow, lite: lightMode(), full: tier() === "full", mood, soft, mode, now };
      if (V.style === "wavefield") drawWavefield(ctx, o);
      else if (vizRect.r) {
        const img = q.wrap.querySelector("img.is-on");
        drawCoverDust(ctx, { ...o, img: img?.complete && img.naturalWidth ? img : null, size: vizRect.r.width * dpr * pulseS });
      }
      /* === end views === */
    } else if (V.style === "shatter") {
      drawShatter(ctx, cx, cy, maxLen, dt, b, dpr, tt);
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
      const op = Math.max(px.flash * 0.42, px.ambient || 0).toFixed(2);
      if (q.flash.style.opacity !== op) q.flash.style.opacity = op;
      if (px.flashCol !== lastFlashCol) {
        lastFlashCol = px.flashCol;
        const c = pal[px.flashCol];
        q.flash.style.background = `radial-gradient(70% 60% at 50% 45%, rgba(${c[0]},${c[1]},${c[2]},0.9), rgba(${c[0]},${c[1]},${c[2]},0) 72%)`;
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
  let curInst = null, pulseS = 1, lastPulse = "", lastFlashCol = -1, vizErr = null, lostSince = 0, lastKick = "", lastFill = "";
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
  function drawShatter(ctx, cx, cy, maxLen, dt, b, dpr, tt) {
    const img = q.wrap.querySelector("img.is-on");
    if (!img?.complete || !img.naturalWidth || !vizRect.r) return;
    const n = shards.n;
    if (shards.seed.length !== n * n) shards.seed = Array.from({ length: n * n }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
    // Schlag (Lautheit springt): aufbrechen, dann weich zurück
    if (b > shards.last + 0.12 && b > 0.35) shards.amt = Math.min(1, shards.amt + 0.55 + b * 0.4);
    shards.last = b;
    shards.amt *= Math.exp(-dt * 2.6);
    const size = vizRect.r.width * dpr, x0 = cx - size / 2, y0 = cy - size / 2, ts = size / n;
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
  function vivid(pal, minor, tint, pitch = -1, keyPc = -1) {
    const key = pal.map((c) => c.join(",")).join("|") + (minor ? "m" : "") + (tint || "") + pitch + "k" + keyPc;
    if (key === vividKey) return vividPal;
    vividKey = key;
    const hsl = pal.map(rgb2hsl);
    const grey = hsl.every(([, s]) => s < 0.12);
    vividPal = hsl.map(([h, s, l], i) => {
      let hue = grey ? [275, 195, 320][i] : h;
      if (TINT[tint] != null) hue = toward(hue, TINT[tint] + (i - 1) * 22, 0.45);
      // Melodie: die Tonklasse färbt das Akzentlicht (Quintenzirkel – verwandte Töne liegen nah beieinander)
      if (pitch >= 0) hue = toward(hue, ((pitch * 7) % 12) * 30, i === 2 ? 0.35 : 0.1);
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
  function drawParty(ctx, cx, cy, R, maxLen, N, pal, dpr, dt, px, tip, ang) {
    const P = px.P;
    const mixC = (a, b, f) => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f));
    const off = (px.scene * 0.37) % 1;
    const colAt = (u) => {
      const x = (((u + off) % 1) * 3) % 3, i = Math.floor(x);
      return mixC(pal[i], pal[(i + 1) % 3], x - i);
    };
    const rgba = (c, al) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
    // Bühnenlicht, Dekor und Publikum zeichnet die Location (eigenes Canvas darunter, möglichst eigener Thread)
    venueFrame({
      t: performance.now() / 1000, dt, vw, vh, dpr, pal, cx, cy, R,
      // Publikum: die ruhige Grundfarbe des Songs (Cover), nicht die Lichtfarbe dieses Bildes – die gleitet beim
      // Songwechsel über Sekunden und folgt der Melodie, und jede neue Farbe hieß: alle Körperbilder neu malen
      crowdPal: imPalette(),
      px: {
        // Bühnenlicht: das der Szene, sonst das des Genres; beim Szenenwechsel gleitet spot2 → spot über sx
        key: px.key, P: { spot: px.spot || P.spot }, spot2: px.spot2 || P.spot, sx: px.sx ?? 1, rig: px.rig || "", spread: px.spread ?? 1, crowd: px.crowd ?? 1, accent: px.accent, kickEnv: px.kickEnv, snareEnv: px.snareEnv, hatEnv: px.hatEnv,
        beat: px.beat, hit: px.hit, energy: px.energy, build: px.build, low: px.low, drop: px.drop, dropHit: px.dropHit,
        I: px.I, spin: px.spin, level: px.level, scene: px.scene, inBar: px.inBar, phase: px.phase, beatIdx: px.beatIdx,
        finale: !!px.finale, blackout: !!px.blackout,
        // Lichtregie (director.js)
        mt: px.mt, mb: px.mb, wipe: px.wipe, wdir: px.wdir, pulse: px.pulse, lift: px.lift, wall: px.wall, vox: px.vox, swell: px.swell,
        haze: px.haze, pump: px.pump, boom: px.boom, scan: px.scan, fxMul: px.fxMul,
        // Publikum (crowd.js): Teil des Songs und Spannung vor dem Drop
        kind: px.kind, tension: px.tension,
        // Momente der Musik (director.js): Finale, Tonartwechsel, Stopp, Solo, Drop-Bild …
        scn: px.scn || null,
      },
      // Antworten der Bühne auf gesungene Wörter (scenarios.js)
      cues: cfg.partyWords && !cfg.calm ? scen.frame(performance.now() / 1000) : null,
      // Bühneneffekte (CO2, Pyro, Feuerwerk) und Stroboskop – Stroboskop nur ab „Extrem“ und mit Blitzen an
      fx: cfg.partyFx && px.fx && px.level >= 2 && !lightMode(),
      rig: cfg.partyRig && px.fx && px.level >= 2 && !lightMode(),
      flash: cfg.partyFlash && px.fx && !cfg.noFlash,
      inst: curInst,
      strobe: cfg.partyStrobe && cfg.partyFlash && px.fx && px.level >= 4 && !cfg.noFlash,
      // „Keine Blitze“ für alles Übrige der Bühne (Gitarrenblitze, Handy-Blitze, weißer Drop) · Freigabe der Blitz-Schranke
      noFlash: !!cfg.noFlash, flashGo: !!px.flashGo,
      cam: { s: cam.s, x: cam.x, y: cam.y }, dep: { x: depth.x, y: depth.y, on: !!depth.key },
      quality: quality.level, hype: hypeOn, bpm: px.tempo || party.info.bpm || 120,
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
    // Bassbalken am unteren Rand – nicht, wenn dort das Publikum steht
    if (P.bottom && !cfg.partyCrowd) {
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
  let venueWorker = null, venueCtx = null, venueOn = false, venueBusy = false, venueSentAt = 0, venueDt = 0;
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
          if (e.data?.type === "done") venueBusy = false;
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
    venueOn = venueBusy = false;
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
    // Der Thread zeichnet noch? Dann dieses Bild auslassen und die Zeit fürs nächste aufheben –
    // ein Rückstau ließe Publikum und Licht hinterherhinken und ruckweise aufholen
    venueDt = Math.min(0.1, venueDt + st.dt);
    // einmalige Signale (Drop, Treffer) gehen beim Auslassen nicht verloren
    venueHold.dropHit ||= !!st.px.dropHit;
    venueHold.hit ||= !!st.px.hit;
    venueFlashGo ||= !!st.flashGo;
    if (venueWorker) {
      const now = performance.now();
      if (venueBusy && now - venueSentAt < 250) return;
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
      local().draw(venueCtx, st);
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
  const quality = { level: 2, slow: 0, fast: 0, ema: 1 / 60 };
  function tuneQuality(dt) {
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
    if (quality.level < 2) {
      px.lasers = Math.round(px.lasers / 2);
      px.lvl = Math.min(px.lvl, 1.6);
    }
    // Übergang zwischen Songs (party.js): die erste Eins des neuen Songs landet mit zwei Ringen
    if (px.land) rings.push({ r: R, a: 0.9, w: 6 }, { r: R - 40 * dpr, a: 0.7, w: 4 });
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
        depth.key = k;
        q.lyrics.style.translate = `${(-depth.x * 22).toFixed(1)}px ${(-depth.y * 12).toFixed(1)}px`;
        q.meta.style.translate = `${(-depth.x * 12).toFixed(1)}px ${(-depth.y * 7).toFixed(1)}px`;
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
        q.meta.style.translate = `${(-depth.x * 12).toFixed(1)}px ${(-depth.y * 7).toFixed(1)}px`;
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
    // 3 ms Spielraum, damit ein leicht zu früh kommendes Bild nicht ausfällt.
    const tr = tier();
    const fpsCap = ecoOn() || lightMode() || tr === "calm" || (quietNow && cfg.partyQuietFps) ? 30 : tr === "full" ? 0 : 60;
    if (fpsCap && now - lastDraw < 1000 / fpsCap - 3) return;
    const fdt = Math.min(0.1, lastDraw ? (now - lastDraw) / 1000 : 0.016);
    lastDraw = now;
    coverMotion(fdt, fpsCap);
    if (sizeKey !== sizeKeyNow()) sizeCanvas();
    // gleichmäßige Songuhr mit Vorlauf (siehe clock.js) – Party, Visualizer und Karaoke laufen danach
    const pos = songPos(now);
    const dur = PLR.getDuration() || 0;
    // scaleX statt width: kein Neu-Layout in jedem Bild
    const fillV = dur ? clamp(pos / dur, 0, 1) : 0, fill = `scaleX(${fillV.toFixed(4)})`;
    const mode = el.dataset.mode;
    // seltener zeichnen nur in der Cover-Ansicht, Feder in Ruhe, Maus seit 1,5 s still, keine Blende vom Visualizer
    const sparse = mode === "cover" && tilt.rest && now - depth.at > 1500 && !(vw && now < vizFadeUntil);
    // der Balken gleitet nur bei kleinen Schritten vorwärts – Spulen und Songwechsel springen wie bisher
    const glide = sparse && sparseFill >= 0 && fillV >= sparseFill && fillV - sparseFill < 0.01;
    if (glide !== el.classList.contains("m-sparse")) el.classList.toggle("m-sparse", glide);
    sparseFill = sparse ? fillV : -1;
    if (fill !== lastFill) q.fill.style.transform = lastFill = fill;
    if (album.shown) album.tick(pos, dur);
    if (now - lastText > 250) {
      lastText = now;
      q.pos.textContent = fmt(pos);
      q.dur.textContent = fmt(dur);
      seekLabel(pos, dur);
      syncState();
    }
    const shatterOn = VIZ.has(mode) && mode !== "party" && OWN_COVER.has(cfg.vizStyle) && !cfg.calm;
    if (el.classList.contains("is-shatter") !== shatterOn) el.classList.toggle("is-shatter", shatterOn);
    if (LYR.has(mode)) drawLyrics(pos);
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
          });
        }
      } catch (e) {
        vizReset();
        if (!vizErr) console.warn("[Mirage] Visualizer:", (vizErr = e));
      }
    }
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

  // Canvas (Spotifys kurze Video-Loops): je Ansicht ein- und ausschaltbar über den Film-Knopf oben, anfangs aus.
  // Cover, Visualizer, Mix und Party zeigen es IM Cover (rund in Mix und Party), der Liedtext dazu gedämpft
  // im Hintergrund. Gespielt wird nur, was zu sehen ist.
  const CV_MODES = new Set(["cover", "lyrics", "viz", "mix", "party"]);
  let canvasToken = 0, canvasUrl = null;
  async function setCanvas(item) {
    const token = ++canvasToken;
    canvasUrl = null;
    applyCanvas();
    const url = cfg.canvas && !cfg.calm ? await getCanvas(item?.uri) : null;
    if (token !== canvasToken) return;
    canvasUrl = url;
    applyCanvas();
  }
  function playIn(v, on) {
    if (!v) return;
    if (!on) {
      v.classList.remove("is-on");
      v.pause();
      return;
    }
    if (v.getAttribute("src") !== canvasUrl) v.src = canvasUrl;
    v.play().then(() => v.classList.add("is-on")).catch(() => v.classList.remove("is-on"));
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
    const on = can && !!cfg.canvasIn?.[mode];
    // im Party-Modus liegt der Film im Menü „Mehr“
    q.cvbtn.hidden = !show || mode === "party";
    q.cvbtn.classList.toggle("is-none", show && !canvasUrl);
    q.cvbtn.setAttribute("aria-pressed", String(on));
    q.cvbtn.title = q.cvbtn.ariaLabel = t(!canvasUrl ? "canvasNone" : on ? "canvasOff" : "canvasOn");
    el.classList.toggle("has-canvas", on);
    requestAnimationFrame(fitTop);
    playIn(q.cvid, on);
    playIn(q.video, on && mode === "lyrics");
  }
  // Tastenkürzel-Übersicht (Taste ?)
  const KEYS = [["Space", "k_play"], ["← →", "k_seek"], ["↑ ↓", "k_vol"], ["1 – " + MODES.length, "k_view"], ["L", "k_like"], ["S", "k_shuffle"], ["R", "k_repeat"], ["F", "k_full"], ["N / P", "k_next"], ["Q", "k_queue"], ["T", "k_tap"], ["E", "k_timing"], ["O", "k_perf"], ["Esc", "k_close"], ["?", "keysTitle"]];
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
      for (const [k, label] of KEYS) {
        const row = document.createElement("div");
        row.innerHTML = "<kbd></kbd><span></span>";
        row.firstChild.textContent = k;
        row.lastChild.textContent = t(label);
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
  }

  // Seitenleiste: Als Nächstes · Geräte · Schlaf-Timer
  let side = null, sideFromMenu = false, viaMenu = false;
  function showSide(kind) {
    sideFocus(kind);
    if (kind) closeMenus("side");
    const was = side;
    // Zurück-Pfeil nur für Unterseiten, die aus „Mehr“ geöffnet wurden; Neuaufbau derselben Seite behält ihn
    if (kind !== was) sideFromMenu = viaMenu && kind !== "menu";
    viaMenu = false;
    side = kind;
    // der QR-Code der Spielleitung bleibt nie offen stehen
    if (kind !== "games") q.hostOpen = false;
    q.side.hidden = !kind;
    vizMoveUntil = performance.now() + 1000;
    syncTriggers();
    if (!kind) return;
    q.side.dataset.kind = kind;
    q.sideBack.hidden = !sideFromMenu;
    q.sideBack.title = q.sideBack.ariaLabel = t("pmTitle");
    // anderer Inhalt in der offenen Leiste: kurz einblenden statt hart springen (Neuaufbau derselben Seite nicht)
    if (was && was !== kind) {
      q.sideBody.classList.remove("is-swap");
      void q.sideBody.offsetWidth;
      q.sideBody.classList.add("is-swap");
    }
    q.side.querySelector("b").textContent = t({ queue: "c_queue", devices: "c_devices", timer: "c_timer", versions: "lyrPick", playlists: "c_addTo", wishes: "wishTitle", photos: "photoTitle", screens: "toScreen", poll: "pollBtn", recap: "recapBtn", dj: "djTitle", games: "gTitle", menu: "pmTitle" }[kind]);
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
    if (kind === "poll") return pollPanel(body);
    if (kind === "recap") return recapPanel(body);
    if (kind === "queue") {
      const list = ctl.upNext();
      if (!list.length) return item(t("queueEmpty"));
      for (const x of list) item(x.title, x.artist, x.image, null);
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
    // offenes Menü nach dem Ansichtswechsel neu füllen (Party-Werkzeuge kommen oder gehen)
    if (side === "menu" && q.menuParty !== party) showSide("menu");
    el.querySelector(".m-im-share").hidden = el.querySelector(".m-im-help").hidden = party;
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
  function confetti() {
    if (!el || el.dataset.mode !== "party" || cfg.calm) return;
    moments.confetti++;
    kick();
  }

  /* ---- Spiele: auswählen, starten, beenden. Alle außer dem Glücksrad spielen die Gäste auf ihren Handys. */
  // „Mehr“ im Party-Modus: alles, was nicht dauernd gebraucht wird
  // Aussehen & Leistung ohne Umweg über die Einstellungen: dieselben Presets und Schalter (settings.js), wirkt sofort.
  // Nach jedem Klick baut sich das Menü neu auf; der Fokus bleibt dabei an derselben Stelle (sideFocus).
  function perfSection(body) {
    // „Eigene“ (einzelne Schalter geändert) steht statt des Hinweises unter der Überschrift
    sideHead(body, t("perfQuick"), t(cfg.preset === "custom" ? "presetCustom" : "perfQuickHint"));
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
    // die zwei Schalter, die man mitten in der Party am ehesten braucht: Akku/Lüfter und Blitze
    const flag = (label, sub, on, fn, icon) => {
      const b = sideBtn(body, label, sub, () => perfSet(fn), on, icon);
      b.removeAttribute("aria-current");
      b.setAttribute("aria-pressed", String(on));
      b.classList.add("m-im-perf-flag");
    };
    const eco = cfg.eco === "on";
    flag(t("ecoQuick"), t(eco ? "ecoQuickOn" : cfg.eco === "off" ? "eco_off" : "ecoQuickAuto"), eco, () => setPerf("eco", eco ? "auto" : "on"), UI.leaf);
    flag(t("noFlash"), "", !!cfg.noFlash, () => setPerf("noFlash", !cfg.noFlash), UI.flashOff);
  }
  // umstellen und alles, was die offene Ebene aus cfg liest, gleich nachziehen
  function perfSet(fn) {
    fn();
    sizeCanvas();
    applyCanvas();
    styleLyrics();
    showExtras();
    if (side === "menu") {
      const top = q.sideBody.scrollTop;
      showSide("menu");
      q.sideBody.scrollTop = top;
    }
  }
  // Taste O: Menü auf, Fokus auf das gewählte Preset (noch einmal O schließt es)
  function perfMenu() {
    if (!el || !isOpen()) return;
    if (side === "menu") return showSide(null);
    showSide("menu");
    queueMicrotask(() => (q.sideBody.querySelector('.m-im-perf [aria-pressed="true"]') || q.sideBody.querySelector(".m-im-perf button"))?.focus());
  }
  function menuPanel(body) {
    // außerhalb der Party enthält „Mehr“ nur Aussehen & Leistung (die übrigen Knöpfe stehen dort oben)
    if (el.dataset.mode !== "party") {
      // 1.27 views: Album-Reise ein/aus (Cover-Ansicht, nur wenn ein Album läuft)
      if (album.canToggle(el.dataset.mode)) sideBtn(body, album.label, album.albumName, () => { showSide(null); album.toggle(); }, false, UI.album).classList.add("m-im-albtoggle");
      return perfSection(body);
    }
    const go = (kind) => () => {
      viaMenu = true;
      showSide(kind);
    };
    const row = (label, icon, fn, nav) => sideBtn(body, label, "", fn, false, icon, nav);
    row(t("djTitle"), UI.dj, go("dj"), true);
    if (cfg.partyLive) row(t("pollBtn"), UI.poll, go("poll"), true);
    if (cfg.partyRecap && recap.songs.length >= 3) row(t("recapBtn"), UI.recap, go("recap"), true);
    if (!cfg.calm) row(t("confetti"), UI.confetti, () => { confetti(); showSide(null); });
    if (cfg.partyScreen) row(t("toScreen"), UI.screen, go("screens"), true);
    if (cfg.canvas && !cfg.calm) row(q.cvbtn.title || "Canvas", UI.film, () => { q.cvbtn.click(); showSide(null); });
    if (ctl.canAddTo()) row(t("c_addTo"), UI.add, go("playlists"), true);
    row(t("c_devices"), UI.devices, go("devices"), true);
    row(t("c_timer"), UI.timer, go("timer"), true);
    row(el.querySelector(".m-im-share").title || "Share", UI.share, () => { showSide(null); nowPlayingCard(); });
    row(el.querySelector(".m-im-help").title || "?", UI.keyboard, () => { showSide(null); toggleKeys(); });
    perfSection(body);
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
      if (q.hostOpen && !cfg.partyLive) {
        cfg.partyLive = true;
        save();
        showExtras();
      }
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
          cfg.partyLive = true;
          save();
          showExtras();
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
    kick();
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
    open, close, toggle: () => (isOpen() ? close() : open()), isOpen, refresh, setMode, playState, updateKicker, setHaze, prebake: (src) => src && bake(src),
    seekBy, volBy, toggleFull, toggleKeys, dismiss, confetti, perfMenu, toggleQueue: () => el && showSide(side === "queue" ? null : "queue"), styleLyrics: () => el && styleLyrics(), reloadLyrics: () => { lyrUri = ""; el && LYR.has(el.dataset.mode) && loadLyrics(); }, toggleTiming, timingKey, like: () => q.like?.click(), shuffle: () => q.shuffle?.click(), repeat: () => q.repeat?.click(),
    // 1.27 views: Zustand der Album-Spalte (Tests)
    albumState: () => album.state,
  };
})();

export { ICON, MODES, immersive };
