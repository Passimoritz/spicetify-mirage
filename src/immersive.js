import { S, root, clamp, seek, fmt, loadImage } from "./core.js";
import { scriptOf, hangul, kana, pinyinLines } from "./roman.js";
import { t } from "./i18n.js";
import { cfg, save } from "./config.js";
import { palette, rgb2hsl, hsl2rgb } from "./color.js";
import { lastHaze } from "./stage.js";
import { audio, beat } from "./audio.js";
import { dust } from "./dust.js";
import { burst } from "./burst.js";
import { getLyrics, lyricVersions, pickLyrics, translateLines, getCanvas, canvasBlocked, SOURCE_NAME, romajiFor } from "./lyrics.js";
import { LANG } from "./i18n.js";
import { nowPlayingCard, partyRecapCard } from "./share.js";
import * as ctl from "./controls.js";
import { currentItem, covers, titleOf, artistOf } from "./player.js";
import { party } from "./party.js";
import { jamMembers } from "./jam.js";
import { createVenue } from "./venue.js";
import { songPos } from "./clock.js";
import { instruments } from "./instruments.js";
import { live } from "./live.js";
import { createWordFx } from "./words.js";
import { LEX } from "./lexicon.js";
import { bridge } from "./bridge.js";
import { dj } from "./dj.js";
import { games } from "./games.js";

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
  confetti: '<svg viewBox="0 0 24 24"><path d="M4 20l5-14 9 9zm4.6-9.5L6.8 16.6l5.6-2.2zM14 3h2v3h-2zm5 3.6 1.4 1.4-2.1 2.1-1.4-1.4zM18 13h3v2h-3zM10.5 4.4l1.4-1 1.2 1.6-1.4 1z"/></svg>',
  dj: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5.5-7 3 3-1.4 1.4-3-3z"/></svg>',
  game: '<svg viewBox="0 0 24 24"><path d="M7 7h10a5 5 0 0 1 4.9 6l-.7 3.6a2.5 2.5 0 0 1-4.3 1.2L14.6 16H9.4l-2.3 1.8a2.5 2.5 0 0 1-4.3-1.2L2.1 13A5 5 0 0 1 7 7zm0 2a3 3 0 0 0-3 3.6l.8 3.6.5.3 2.5-2.5h7.4l2.5 2.5.5-.3.8-3.6A3 3 0 0 0 17 9zm1 1h2v2h2v2h-2v2H8v-2H6v-2h2zm8 0a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zm-2 3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/></svg>',
  poll: '<svg viewBox="0 0 24 24"><path d="M4 13h3v7H4zm6.5-9h3v16h-3zM17 9h3v11h-3z"/></svg>',
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
  sparkle: '<svg viewBox="0 0 24 24"><path d="M11 2l1.9 5.6L18.5 9.5l-5.6 1.9L11 17l-1.9-5.6L3.5 9.5l5.6-1.9zM18.5 14l.9 2.2 2.1.8-2.1.9-.9 2.1-.8-2.1-2.2-.9 2.2-.8z"/></svg>',
};
const MODES = [
  ["cover", "tabCover"],
  ["lyrics", "tabLyrics"],
  ["viz", "tabViz"],
  ["mix", "tabMix"],
  ["party", "tabParty"],
];
// Mix = Cover + Liedtext + Visualizer zugleich; Party = alles größer, im Takt, je nach Genre/Tempo
const LYR = new Set(["lyrics", "mix", "party"]);
const VIZ = new Set(["viz", "mix", "party"]);

const immersive = (() => {
  let el = null, raf = 0, lastText = 0, coverToken = 0;
  let q = {};
  let lyr = null, lyrUri = "", active = -2;
  // Wortbilder: gesungene Begriffe („fire“, „Regen“, „corazón“ …) bekommen im Party-Modus ein passendes Bild
  // Ausgelöste Bilder gehen auch an den Live-Link: die TV-Ansicht zeigt dasselbe Bild
  const wordFx = createWordFx(LEX, { onFire: (c, w) => live.fx(c, w) });
  let wfxGeo = null, wfxAt = 0;
  let vals = new Float32Array(120), targets = new Float32Array(120), lastVizT = 0, tunnel3d = [], tunnelAt = 0;
  const pit = new Float32Array(12);
  const vizRect = { n: 0, r: null };
  let rings = [], lastBeatIdx = -1, vctx = null, vw = 0, vh = 0;

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
          <button type="button" class="m-im-sm m-im-pollbtn" hidden>${ICON.poll}</button>
          <button type="button" class="m-im-sm m-im-djbtn" hidden>${ICON.dj}</button>
          <button type="button" class="m-im-sm m-im-gamebtn" hidden>${ICON.game}</button>
          <button type="button" class="m-im-sm m-im-recap" hidden>${ICON.recap}</button>
          <button type="button" class="m-im-sm m-im-screen" hidden>${ICON.screen}</button>
          <button type="button" class="m-im-sm m-im-wishbtn" hidden>${ICON.wish}</button>
          <button type="button" class="m-im-sm m-im-live" hidden>${ICON.live}</button>
          <button type="button" class="m-im-sm m-im-share">${ICON.share}</button>
          <button type="button" class="m-im-sm m-im-fs">${ICON.full}</button>
          <button type="button" class="m-im-sm m-im-help">?</button>
        </div>
      </div>
      <div class="m-im-cover-wrap"><div class="m-im-cover"><img alt=""><img alt=""><video class="m-im-cvid" muted loop playsinline preload="none" aria-hidden="true"></video></div></div>
      <div class="m-im-meta">
        <div class="m-im-kicker"></div>
        <div class="m-im-smartpick" hidden>${ICON.sparkle}<span></span></div>
        <div class="m-im-title"></div>
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
          <button type="button" class="m-im-sm m-im-addto">${ICON.add}</button>
          <div class="m-im-vol">
            <button type="button" class="m-im-sm m-im-mute">${ICON.vol}</button>
            <input type="range" class="m-im-volume" min="0" max="100" step="1">
          </div>
          <button type="button" class="m-im-sm m-im-queue-btn">${ICON.queue}</button>
          <button type="button" class="m-im-sm m-im-dev">${ICON.devices}</button>
          <button type="button" class="m-im-sm m-im-timer">${ICON.timer}</button>
          <button type="button" class="m-im-sm m-im-full">${ICON.full}</button>
        </div>
      </div>
      <div class="m-im-lyrics"><div class="m-im-lyrics-inner"></div></div>
      <div class="m-im-lyrbar">
        <button type="button" class="m-im-trbtn" hidden aria-pressed="false">${ICON.translate}<span></span><i aria-hidden="true"></i></button>
        <button type="button" class="m-im-lyrsrc" hidden><span></span><b></b></button>
      </div>
      <div class="m-im-side" hidden><div class="m-im-side-head"><b></b><button type="button" class="m-im-sm m-im-side-x">×</button></div><div class="m-im-side-body"></div></div>
      <div class="m-im-keys" role="dialog" hidden></div>`;
    document.body.append(el);
    el.querySelector(".m-im-close .m-l").textContent = t("back");
    el.querySelectorAll(".m-im-tabs button").forEach((b, i) => (b.textContent = t(MODES[i][1])));
    el.querySelector(".m-im-bar").setAttribute("aria-label", t("seek"));
    el.querySelector(".m-im-prev").setAttribute("aria-label", t("prev"));
    el.querySelector(".m-im-play").setAttribute("aria-label", t("play"));
    el.querySelector(".m-im-next").setAttribute("aria-label", t("next"));
    for (const k of ["shuffle", "repeat", "like", "mute", "full"]) {
      el.querySelector(".m-im-" + k).setAttribute("aria-label", t("c_" + k));
      el.querySelector(".m-im-" + k).title = t("c_" + k);
    }
    el.querySelector(".m-im-volume").setAttribute("aria-label", t("c_volume"));
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
      artist: el.querySelector(".m-im-artist"),
      fill: el.querySelector(".m-im-fill"),
      pos: el.querySelector(".m-im-pos"),
      dur: el.querySelector(".m-im-dur"),
      play: el.querySelector(".m-im-play"),
      lyrics: el.querySelector(".m-im-lyrics"),
      inner: el.querySelector(".m-im-lyrics-inner"),
      lyrsrc: el.querySelector(".m-im-lyrsrc"),
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
    games.init({
      root: () => el,
      lines: () => (lyr?.synced ? lyr.lines : null),
      pos: () => songPos(performance.now()),
      confetti,
      handsUp: () => (moments.handsUntil = performance.now() + (8 * 60000) / (party.info.bpm || 120)),
      flashStorm: () => (moments.stormUntil = performance.now() + 2600),
      venue: () => (moments.venue = ["club", "festival", "beach", "stadium", "rooftop", "forest", "neon", "space", "desert"][Math.floor(Math.random() * 9)]),
      changed: () => side === "games" && showSide("games"),
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
    q.wrap.addEventListener("transitionend", () => (vizRect.r = null));
    q.lyrsrc.querySelector("b").textContent = t("lyrPick");
    q.lyrsrc.onclick = () => showSide(side === "versions" ? null : "versions");
    q.trbtn.querySelector("span").textContent = t("trToggle");
    q.trbtn.onclick = () => {
      // ein Klick schaltet die Einstellung „Liedtext übersetzen“ – gilt also auch für den nächsten Song
      cfg.translate = !cfg.translate;
      save();
      showTrBtn();
      if (cfg.translate) addTranslations(lyrToken);
      else {
        q.inner.querySelectorAll(".m-im-tr").forEach((n) => n.remove());
        active = -2;
      }
    };
    q.video = el.querySelector(".m-im-canvas");
    q.cvid = el.querySelector(".m-im-cvid");
    q.wishbtn = el.querySelector(".m-im-wishbtn");
    q.wishbtn.onclick = () => showSide(side === "wishes" ? null : "wishes");
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
    q.keys.onclick = () => toggleKeys(false);
    el.querySelector(".m-im-close").onclick = close;
    q.shuffle.onclick = async () => { await ctl.cycleShuffle(); setTimeout(syncState, 150); };
    // Titel → Album, Künstler → Künstlerseite (Immersiv-Fenster schließt dafür)
    q.title.onclick = () => ctl.go(ctl.albumOf(currentItem())) && close();
    q.artist.onclick = () => ctl.go(ctl.artistUriOf(currentItem())) && close();
    q.side = el.querySelector(".m-im-side");
    q.sideBody = el.querySelector(".m-im-side-body");
    el.querySelector(".m-im-side-x").onclick = () => showSide(null);
    const qb = el.querySelector(".m-im-queue-btn"), db = el.querySelector(".m-im-dev"), tb = el.querySelector(".m-im-timer");
    q.timerBtn = tb;
    for (const [b, k] of [[qb, "c_queue"], [db, "c_devices"], [tb, "c_timer"]]) b.title = b.ariaLabel = t(k);
    qb.onclick = () => showSide(side === "queue" ? null : "queue");
    db.onclick = () => showSide(side === "devices" ? null : "devices");
    tb.onclick = () => showSide(side === "timer" ? null : "timer");
    if (!ctl.canConnect()) db.hidden = true;
    q.repeat.onclick = () => { S.Player.toggleRepeat(); setTimeout(syncState, 120); };
    q.like.onclick = (e) => {
      const was = !!S.Player.getHeart?.();
      S.Player.toggleHeart();
      if (!was && cfg.burst && !cfg.calm) {
        const r = q.like.getBoundingClientRect();
        burst(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
      }
      setTimeout(syncState, 200);
    };
    q.mute.onclick = () => { S.Player.toggleMute(); setTimeout(syncState, 120); };
    q.volume.oninput = () => S.Player.setVolume(Number(q.volume.value) / 100);
    q.full.onclick = toggleFull;
    el.querySelector(".m-im-prev").onclick = () => S.Player.back();
    el.querySelector(".m-im-next").onclick = () => S.Player.next();
    q.play.onclick = () => S.Player.togglePlay();
    el.querySelectorAll(".m-im-tabs button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode, true)));
    el.querySelector(".m-im-bar").onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      S.Player.seek(clamp((e.clientX - r.left) / r.width, 0, 1));
    };
    q.inner.addEventListener("click", (e) => {
      const line = e.target.closest(".m-im-line");
      if (line && lyr?.synced) S.Player.seek(Math.max(Number(line.dataset.t), 2));
    });
    el.addEventListener("pointermove", (e) => {
      if (cfg.calm) return;
      const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
      depth.tx = x;
      depth.ty = y;
      depth.at = performance.now();
      q.cover.style.setProperty("--iry", (x * 18).toFixed(2) + "deg");
      q.cover.style.setProperty("--irx", (-y * 14).toFixed(2) + "deg");
      q.cover.style.setProperty("--gx", (50 + x * 80).toFixed(1) + "%");
      q.cover.style.setProperty("--gy", (50 + y * 80).toFixed(1) + "%");
    });
    addEventListener("resize", sizeCanvas);
    document.addEventListener("keydown", () => isOpen() && wake(), true);
    // Taktdaten kamen später (Wiederholung oder Schätzung): Anzeige und Party-Profil nachziehen
    document.addEventListener("mirage:audio", () => {
      if (!isOpen()) return;
      lastBeatIdx = -1;
      if (el.dataset.mode === "party") party.prepare(currentItem()).then(updateKicker);
      else updateKicker();
    });
  }

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
  function setHaze(src) {
    if (!el || !src || src === hazeSrc) return;
    hazeSrc = src;
    // neues Bild in die verdeckte Ebene, erst wenn es geladen ist überblenden
    const [a, b] = q.bg.querySelectorAll("i");
    const front = a.classList.contains("is-on") ? a : b.classList.contains("is-on") ? b : null;
    const back = front === a ? b : a;
    const img = new Image();
    img.onload = img.onerror = () => {
      if (hazeSrc !== src) return;
      back.style.backgroundImage = `url("${src}")`;
      requestAnimationFrame(() => {
        back.classList.add("is-on");
        front?.classList.remove("is-on");
      });
    };
    img.src = src;
  }

  // Leicht-Preset oder Energiesparen fest an: weniger Pixel, 30 Bilder/s, weniger Details
  const lightMode = () => !!cfg.lite || cfg.preset === "light" || cfg.eco === "on";
  const sizeKeyNow = () => `${cfg.preset}|${cfg.lite}|${cfg.eco}`;
  let sizeKey = "";
  function sizeCanvas() {
    if (!q.canvas) return;
    // höchstens ~3 Mio. Pixel: auf großen/hochauflösenden Bildschirmen wäre die volle Dichte ein
    // Vielfaches davon – jedes Bild neu zeichnen ruckelt dann. Die leuchtenden Linien bleiben trotzdem scharf genug.
    // je leichter das Preset, desto weniger Pixel: Leicht/Energiesparen ~1,2 Mio., Ausgewogen ~2 Mio.
    const [pixels, cap] = lightMode() ? [1.2e6, 1] : cfg.preset === "balanced" ? [2e6, 1.25] : [3e6, 1.5];
    const budget = Math.sqrt(pixels / Math.max(1, innerWidth * innerHeight));
    const dpr = Math.max(0.5, Math.min(devicePixelRatio || 1, cap, budget));
    sizeKey = sizeKeyNow();
    vw = q.canvas.width = Math.round(innerWidth * dpr);
    vh = q.canvas.height = Math.round(innerHeight * dpr);
  }

  // Ruhemodus (Party): nach 2,6 s ohne Maus/Taste verschwinden Kopfzeile, Knöpfe und Liedtext-Leiste,
  // Cover, Liedtext und Titel rücken um die frei gewordene Höhe nach unten zur Mitte.
  let idleT = 0, vizMoveUntil = 0;
  function wake() {
    clearTimeout(idleT);
    if (el.classList.contains("is-idle")) {
      el.classList.remove("is-idle");
      vizMoveUntil = performance.now() + 1000;
    }
    if (cfg.partyIdle && el.dataset.mode === "party" && isOpen()) idleT = setTimeout(goIdle, 2600);
  }
  function goIdle() {
    // nicht, solange eine Seitenleiste oder die Tastenhilfe offen ist oder die Maus auf der Bedienung ruht
    if (!isOpen() || el.dataset.mode !== "party" || side || !q.keys.hidden || el.querySelector(".m-im-meta:hover, .m-im-top:hover, .m-im-lyrbar:hover")) {
      idleT = setTimeout(goIdle, 2600);
      return;
    }
    el.style.setProperty("--m-idle-shift", Math.round(q.controls.offsetHeight + 10) + "px");
    el.classList.add("is-idle");
    // der Visualizer folgt dem wandernden Cover Bild für Bild
    vizMoveUntil = performance.now() + 1000;
  }

  function placeIndicator() {
    const b = el.querySelector(`.m-im-tabs button[data-mode="${cfg.imMode}"]`);
    if (!b) return;
    q.ind.style.width = b.offsetWidth + "px";
    q.ind.style.transform = `translateX(${b.offsetLeft}px)`;
  }

  function setMode(mode, animate) {
    if (!MODES.some(([k]) => k === mode)) mode = "cover";
    const apply = () => {
      cfg.imMode = mode;
      save();
      el.dataset.mode = mode;
      el.querySelectorAll(".m-im-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
      placeIndicator();
      updateKicker();
      if (LYR.has(mode)) loadLyrics();
      if (mode === "mix") party.prepare(currentItem());
      if (mode === "party") party.prepare(currentItem()).then((info) => {
        updateKicker();
        noteRecap(currentItem(), info);
      });
      else resetParty();
      showExtras();
      applyCanvas();
      sizeCanvas();
      active = -2;
      wake();
    };
    if (animate && document.startViewTransition && !cfg.calm && isOpen()) {
      try {
        document.startViewTransition(apply);
      } catch {}
      // läuft die Überblendung nicht an (verdecktes Fenster, zweite Blende), trotzdem wechseln
      setTimeout(() => el.dataset.mode !== mode && apply(), 400);
    } else apply();
  }

  function updateKicker() {
    if (!el) return;
    const m = el.dataset.mode;
    if (m === "party") {
      // „Party · Rave · 128 BPM“ – zeigt, welches Profil gerade greift
      const p = party.info;
      // „≈“: Tempo nur geschätzt (Spotify hat keine Taktanalyse, siehe estimate.js)
      q.kicker.textContent = ["Party", t("party_" + p.key), p.bpm ? (audio.data?.synthetic ? "≈ " : "") + p.bpm + " BPM" : ""].filter(Boolean).join(" · ");
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
    blend = null;
    party.live = null;
    live.stop();
    venueClear();
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
        const c = (vividPal || palette())[i % 3];
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
  // Kein Text (oder ein Instrumental): statt einer nackten Zeile eine ruhige Fläche in den
  // Cover-Farben, mit dem naheliegenden nächsten Schritt
  function emptyLyrics(instrumental) {
    const item = currentItem();
    const box = document.createElement("div");
    box.className = "m-im-empty" + (instrumental ? " is-instrumental" : "");
    box.innerHTML =
      '<div class="m-im-empty-icon" aria-hidden="true">' +
      (instrumental ? "<i></i><i></i><i></i><i></i><i></i>" : '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z"/></svg>') +
      '</div><b></b><p></p><div class="m-im-empty-actions"></div>';
    box.querySelector("b").textContent = t(instrumental ? "instrTitle" : "emptyTitle");
    box.querySelector("p").textContent = t(instrumental ? "instrText" : cfg.onlineLyrics ? "emptyText" : "emptyTextOff");
    const actions = box.querySelector(".m-im-empty-actions");
    const viz = document.createElement("button");
    viz.type = "button";
    viz.className = "m-im-empty-btn is-primary";
    viz.textContent = t("showViz");
    viz.onclick = () => setMode("viz", true);
    actions.append(viz);
    if (!instrumental && item) {
      const web = document.createElement("a");
      web.className = "m-im-empty-btn";
      web.textContent = t("searchWeb");
      web.target = "_blank";
      web.rel = "noopener";
      web.href = "https://www.google.com/search?q=" + encodeURIComponent(`${titleOf(item)} ${artistOf(item).split(", ")[0]} lyrics`);
      actions.append(web);
    }
    return box;
  }
  // Wortzeiten einer Zeile. Liefert Spotify Silbenzeiten, gelten die; sonst wird geschätzt:
  // die Zeile dauert bis zur nächsten (höchstens so lange, wie man sie ungefähr singt),
  // jedes Wort bekommt einen Anteil nach seiner Länge.
  let words = [];
  function wordTimes(lines, i) {
    const l = lines[i];
    const next = lines[i + 1]?.t ?? l.t + 6000;
    // echte Wortzeiten (NetEase-YRC, Enhanced LRC): genau so, wie gesungen wird
    if (l.words?.length) return l.words.map((w) => ({ text: w.text, a: w.t, b: w.t + Math.max(60, w.d), sp: w.sp }));
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
    q.lyrsrc.hidden = !cfg.onlineLyrics || !/^spotify:(track|local):/.test(lyrUri);
    q.lyrsrc.querySelector("span").textContent = got ? (SOURCE_NAME[got.source] || "Spotify") + (picked ? " · " + t("lyrPicked") : "") : t("lyrNone");
  }
  async function showVersions(body, item) {
    const uri = lyrUri;
    item(t("loading"));
    const list = await lyricVersions(uri);
    if (side !== "versions" || uri !== lyrUri) return;
    body.textContent = "";
    const cur = lyr?.lrcId ? String(lyr.lrcId) : "";
    const pickedId = cfg.lyricPicks?.[uri] || "";
    const choose = (id) => {
      pickLyrics(uri, id);
      lyrUri = "";
      loadLyrics();
      showSide(null);
    };
    item(t("lyrAuto"), t("lyrAutoHint"), null, pickedId ? () => choose("") : null, !pickedId);
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
    const glide = el.dataset.mode === "party" && !cfg.calm && el.isConnected;
    const before = glide ? parts.map((p) => p.getBoundingClientRect()) : null;
    el.classList.toggle("is-nolyr", on);
    if (!glide) return;
    parts.forEach((p, i) => {
      const a = before[i], b = p.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      p.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], { duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)", composite: "add" });
    });
  }
  async function loadLyrics() {
    const uri = currentItem()?.uri || "";
    if (uri === lyrUri && lyr !== undefined) return;
    const token = ++lyrToken;
    lyrUri = uri;
    lyr = undefined;
    // ohne Gleitfahrt nach oben zurücksetzen – sonst rutscht der alte Text 0,8 s quer durchs Bild
    q.inner.style.transition = "none";
    q.inner.style.transform = "";
    void q.inner.offsetHeight;
    q.inner.style.transition = "";
    q.lyrics.classList.remove("is-unsynced");
    el.classList.remove("is-karaoke");
    q.lyrsrc.hidden = true;
    q.trbtn.hidden = true;
    words = [];
    q.inner.innerHTML = '<div class="m-im-lyrics-note"></div>';
    q.inner.firstChild.textContent = t("loading");
    const got = await getLyrics(uri);
    if (token !== lyrToken) return;
    lyr = got;
    // Hype-Zeilen: der Refrain (Zeilen, die sich wiederholen) und Aufforderungen ans Publikum
    hype = new Set();
    const HYPE = /\b(drop|jump|hands? up|put your hands|everybody|let'?s go|come on|party|dance|scream|shout|louder|higher|alle zusammen|hände hoch|springen|los geht'?s|vamos|arriba|salta|dale|allez|levez|sautez|давай)\b/i;
    const seen = new Map(), key = (x) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    (got?.lines || []).forEach((l) => key(l.text).length > 6 && seen.set(key(l.text), (seen.get(key(l.text)) || 0) + 1));
    (got?.lines || []).forEach((l, i) => (seen.get(key(l.text)) >= 2 || HYPE.test(l.text)) && hype.add(i));
    active = -2;
    q.inner.textContent = "";
    // neuer Text blendet weich ein (Animation neu starten)
    q.inner.classList.remove("is-in");
    void q.inner.offsetWidth;
    q.inner.classList.add("is-in");
    showSource(got);
    setNoLyr(!got || !!got.instrumental || !got.lines?.length);
    if (!got || got.instrumental) {
      q.inner.append(emptyLyrics(!!got));
      return;
    }
    applyTiming(uri, got);
    voices(got);
    if (cfg.partyWords && got.synced) {
      wordFx.prepare(uri, got.lines, got.lang);
      // Sprache ohne eigenes Wörterbuch: einmal die englische Übersetzung holen (nur mit Online-Suche)
      if (wordFx.needsTranslation() && cfg.onlineLyrics) translateLines(uri, got, "en").then((tr) => token === lyrToken && wordFx.addTranslated(uri, tr)).catch(() => {});
    } else wordFx.prepare(uri, [], "");
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
    got.lines.forEach((l, i) => {
      const d = document.createElement("div");
      d.className = "m-im-line";
      d.dataset.t = l.t;
      if (l.who) d.dataset.who = l.who;
      if (karaoke && l.text !== "♪") {
        const box = document.createElement("span");
        box.className = "m-im-words";
        const list = [];
        let bg = false;
        for (const w of wordTimes(got.lines, i)) {
          const s = document.createElement("span");
          // Hintergrundgesang in Klammern: von „(“ bis „)“ leiser und in der Zweitfarbe
          if (/^[(（]/.test(w.text)) bg = true;
          s.className = bg ? "m-w is-bg" : "m-w";
          if (/[)）][,.!?…]*$/.test(w.text)) bg = false;
          s.textContent = w.text;
          s.style.setProperty("--wi", list.length);
          box.append(s);
          if (w.sp !== false) box.append(" ");
          list.push({ el: s, a: w.a, b: w.b, p: -1, text: w.text, sy: w.sy || null });
          if (w.est) list.est = true;
        }
        d.append(box);
        words[i] = list;
      } else bgSplit(d, l.text);
      frag.append(d);
    });
    q.inner.append(frag);
    showTrBtn();
    if (cfg.translate) addTranslations(token);
    if (cfg.romanize) addRomaji(token);
  }
  // Zeile ohne Karaoke: Teile in Klammern (Hintergrundgesang) als eigenes, leiseres Stück
  function bgSplit(d, text) {
    const parts = String(text).split(/([(（][^)）]*[)）])/);
    if (parts.length < 2) return (d.textContent = text);
    for (const p of parts) {
      if (!p) continue;
      const s = document.createElement("span");
      if (/^[(（]/.test(p)) s.className = "is-bg";
      s.textContent = p;
      d.append(s);
    }
  }
  // Duette: steht vor Zeilen ein Name („Name:“ oder „[Name]“) und kommen mindestens zwei Stimmen je dreimal
  // vor, bekommt jede Stimme ihre Farbe – der Name selbst verschwindet aus der Zeile
  function voices(got) {
    if (got.voices) return;
    got.voices = true;
    const TAG = /^\s*(?:\[([^\]]{1,24})\]|\(([^)]{1,24})\)|([\p{Lu}][\p{L} .'&-]{0,22}):)\s*/u;
    const count = new Map();
    for (const l of got.lines) {
      const m = !l.words && l.text.match(TAG);
      const who = m && (m[1] || m[2] || m[3]).trim();
      if (who) count.set(who.toLowerCase(), (count.get(who.toLowerCase()) || 0) + 1);
    }
    const names = [...count].filter(([, n]) => n >= 3).map(([k]) => k);
    if (names.length < 2) return;
    let cur = "";
    for (const l of got.lines) {
      const m = !l.words && l.text.match(TAG);
      const who = m && (m[1] || m[2] || m[3]).trim().toLowerCase();
      if (who && names.includes(who)) {
        cur = String((names.indexOf(who) % 3) + 1);
        l.text = l.text.slice(m[0].length) || "♪";
      } else if (/^(all|alle|both|beide|tous|todos|tutti)$/i.test(who || "")) cur = "all";
      if (cur) l.who = cur;
    }
  }
  // Lautschrift unter die Zeilen (Koreanisch selbst, Japanisch von NetEase oder aus Kana, Chinesisch per Wörterbuch)
  async function addRomaji(token) {
    const got = lyr, item = currentItem();
    if (!got?.lines?.length || got.instrumental) return;
    const sc = scriptOf(got.lines);
    if (!sc) return;
    let rom = null;
    if (sc === "ko") rom = got.lines.map((l) => hangul(l.text));
    else if (sc === "zh") rom = await pinyinLines(got.lines.map((l) => l.text));
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
    active = -2;
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
    active = -2;
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
  // Fremde Liedtexte (LRCLIB, NetEase) stammen oft von einer anderen Fassung: um ein paar hundert ms
  // verschoben. Einmal je Song: der Versatz, bei dem die Zeilenanfänge am besten auf Gesangs-Einsätze
  // fallen – übernommen nur, wenn er klar besser passt als gar keiner.
  function alignLyrics() {
    if (!lyr?.synced || lyr.aligned || lyr.source === "spotify") return;
    const d = audio.data;
    if (!d?.segs?.length || audio.uri !== lyrUri || d.synthetic) return;
    lyr.aligned = true;
    const on = [];
    d.segs.forEach((s, k) => {
      const jump = s.l - (d.segs[k - 1]?.l ?? -60);
      if (s.l > -30 && jump > 2) on.push({ t: s.t * 1000, s: Math.min(jump, 12) });
    });
    const ts = lyr.lines.filter((l) => l.text !== "♪").map((l) => l.t);
    if (ts.length < 8 || on.length < 20) return;
    const score = (off) => {
      let sum = 0, j = 0;
      for (const t of ts) {
        const x = t + off;
        while (j < on.length && on[j].t < x - 70) j++;
        let best = 0;
        for (let k = j; k < on.length && on[k].t <= x + 70; k++) best = Math.max(best, on[k].s);
        sum += best;
      }
      return sum;
    };
    const base = score(0);
    let bestOff = 0, best = base;
    for (let off = -1500; off <= 1500; off += 20) {
      const v = score(off);
      if (v > best) [best, bestOff] = [v, off];
    }
    if (!bestOff || best < base * 1.3 || best < ts.length * 1.5) return;
    for (const l of lyr.lines) {
      l.t += bestOff;
      for (const w of l.words || []) w.t += bestOff;
      for (const s of l.syl || []) s.t += bestOff;
    }
    for (const list of words) for (const w of list || []) {
      w.a += bestOff;
      w.b += bestOff;
      for (const s of w.sy || []) s.a += bestOff;
    }
  }

  function drawLyrics(pos) {
    if (!lyr?.synced) return;
    alignLyrics();
    const lines = q.inner.children;
    const i = seek(lyr.lines, pos, "t");
    if (i !== active) {
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
      for (let k = 0; k < lines.length; k++) {
        const ln = lines[k];
        ln.classList.toggle("is-active", k === i);
        ln.classList.toggle("is-past", k < i);
        ln.style.setProperty("--d", Math.min(Math.abs(k - Math.max(i, 0)), 6));
      }
      const cur = lines[Math.max(i, 0)];
      if (cur) {
        const y = q.lyrics.clientHeight * 0.42 - (cur.offsetTop + cur.offsetHeight / 2);
        q.inner.style.transform = `translateY(${y}px)`;
      }
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
      vizRect.r = q.wrap.getBoundingClientRect();
      // Kamera-Stoß zoomt den Canvas um die Cover-Mitte, nicht um die Bildschirmmitte
      const o = `${Math.round(vizRect.r.left + vizRect.r.width / 2)}px ${Math.round(vizRect.r.top + vizRect.r.height / 2)}px`;
      if (q.canvas.style.transformOrigin !== o) q.canvas.style.transformOrigin = o;
    }
    const r = vizRect.r;
    const cx = (r.left + r.width / 2) * dpr, cy = (r.top + r.height / 2) * dpr;
    const R = (r.width / 2) * dpr + 16 * dpr;
    const sec = pos / 1000;
    const playing = S.Player.isPlaying();
    let b = 0, havePitch = false, loud = 0.5;
    // Stil aus den Einstellungen; im Mix keine Linie quer durch den Liedtext, im Party-Modus das Song-Profil
    const mode = el.dataset.mode;
    const V = { style: cfg.vizStyle, mirror: cfg.vizMirror, height: cfg.vizHeight / 100, glow: cfg.vizGlow, rings: cfg.vizRings, spin: cfg.vizSpin, pulse: 0.035, ring: 1 };
    if (mode === "mix" && V.style === "line") V.style = "wave";
    const px = mode === "party" ? party.step(sec, dt, playing) : null;
    wfxGeo = px ? { cx, cy, R, dpr, px } : null;
    // Mix: dieselben Instrumentenspuren wie Party, nur dezent (Puls und Kranz auf der echten Kick)
    const mixInst = mode === "mix" && cfg.mixInstruments ? party.step(sec, dt, playing) : null;
    if (px) partyExtras(px, now, dt, R, dpr);
    curInst = px && cfg.partyInstruments && px.fx ? instruments.at(sec, dt) : null;
    // ruhig = wenig Energie, kein Aufbau, kein Drop in Sicht → mit 30 Bildern/s ist es nicht zu unterscheiden
    quietNow = !!px && px.energy < 0.25 && px.build < 0.1 && px.toDrop > 5 && !px.drop;
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
    const tt = now / 1000;
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

    let pal = px ? vivid(palette(), px.minor, px.P.tint, px.tone > 0.35 ? px.pitch : -1, px.keyPc) : palette();
    // DJ-Übergang: bis zum ersten Schlag die alten Farben, dann über vier Schläge in die neuen
    if (px && blend?.from) {
      const f = blend.waiting ? 0 : clamp((now - blend.hitAt) / ((4 * 60000) / (party.info.bpm || 120)), 0, 1);
      if (f < 1) pal = pal.map((c, i) => c.map((v, k) => Math.round(blend.from[i][k] + (v - blend.from[i][k]) * f)));
    }
    const rgba = (c, al) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
    // Party: Kranz höchstens so lang wie 0,8 × Cover-Radius – sonst reicht er in Liedtext und Leiste
    const maxLen = Math.min(vw, vh) * 0.11 * V.height * (px ? Math.min(1, (R * 0.8) / (Math.min(vw, vh) * 0.11 * V.height)) : 1);
    const rot = V.spin ? tt * (px ? 0.12 : 0.06) : 0;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R + maxLen * 1.2);
    glow.addColorStop(0, rgba(pal[0], (0.16 + b * 0.22) * (px ? 0.9 + px.I * 0.9 + px.drop : 1)));
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
      // Balken am unteren Rand über die ganze Breite
      const bw = vw / N, base = vh - 8 * dpr;
      for (let gi = 0; gi < 3; gi++) {
        ctx.fillStyle = rgba(pal[gi], 0.85);
        ctx.beginPath();
        for (let i = gi; i < N; i += 3) {
          const h = 6 * dpr + vals[i] * vh * 0.32 * V.height;
          ctx.rect(i * bw + bw * 0.15, base - h, bw * 0.7, h);
        }
        ctx.fill();
      }
    } else if (V.style === "line") {
      // Wellenlinie quer durch das Bild, oben und unten gespiegelt
      const mid = cy;
      for (const [w, col, al] of [[10, pal[1], V.glow ? 0.14 : 0], [2.5, pal[2], 0.95]]) {
        if (!al) continue;
        ctx.lineWidth = w * dpr;
        ctx.strokeStyle = rgba(col, al);
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          for (let i = 0; i < N; i++) {
            const x = (i / (N - 1)) * vw, y = mid + dir * vals[i] * maxLen * 1.6;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
      }
    } else if (V.style === "particles") {
      // Lichtpunkte, die um das Cover kreisen und mit der Musik nach außen schweben
      for (let i = 0; i < N; i++) {
        const a = ang(i) + tt * 0.15 * (i % 2 ? 1 : -1), e = tip(i) + Math.sin(tt * 2 + i) * 6 * dpr;
        const r = (1.5 + vals[i] * 4) * dpr;
        ctx.fillStyle = rgba(pal[i % 3], 0.35 + vals[i] * 0.6);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * e, cy + Math.sin(a) * e, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (V.style === "tunnel") {
      // 3D-Tunnel: jeder Ring ist ein Abdruck des Spektrums von eben, der aus dem Cover auf dich zufliegt –
      // erst langsam, dann immer schneller (Perspektive), und dabei verblasst
      if (now - tunnelAt > 40) {
        tunnelAt = now;
        const ring = new Float32Array(48);
        for (let k = 0; k < 48; k++) ring[k] = vals[Math.floor((k / 48) * N)] || 0;
        tunnel3d.push({ at: now, v: ring, c: tunnel3d.length % 3 });
      }
      const life = 1400 - b * 500, far = Math.hypot(vw, vh) * 0.62;
      tunnel3d = tunnel3d.filter((r) => now - r.at < life);
      for (const r of tunnel3d) {
        const z = (now - r.at) / life, d = R * 1.05 + (far - R) * z * z;
        ctx.lineWidth = (1 + z * 5) * dpr;
        ctx.strokeStyle = rgba(pal[r.c], (0.75 * (1 - z) * (0.5 + 0.5 * Math.min(1, z * 6))).toFixed(3));
        ctx.beginPath();
        for (let k = 0; k <= 48; k++) {
          const j = k % 48, a = (j / 48) * Math.PI * 2 - Math.PI / 2 + rot, rr = d * (1 + r.v[j] * 0.28 * V.height);
          k ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.stroke();
      }
    } else if (V.style === "galaxy") {
      // Galaxie: drei Spiralarme aus Lichtpunkten drehen sich ums Cover; die Musik schiebt sie nach außen
      for (let i = 0; i < N; i++) {
        const arm = i % 3, f = i / N, a = arm * ((Math.PI * 2) / 3) + f * Math.PI * 3 + tt * 0.18;
        const rr = R * 1.08 + f * maxLen * 2.6 + vals[i] * maxLen * 0.9;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, r = (1.2 + vals[i] * 3.2 + (1 - f) * 1.2) * dpr;
        ctx.fillStyle = rgba(pal[arm], ((0.25 + vals[i] * 0.7) * (0.6 + 0.4 * Math.sin(tt * 3 + i))).toFixed(3));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (V.style === "mountains") {
      // Gebirge: drei Bergketten aus dem Spektrum am unteren Rand, hinten blasser, ziehen langsam vorbei
      for (let k = 2; k >= 0; k--) {
        const base = vh, hMax = vh * (0.22 + k * 0.07) * V.height, shift = tt * (8 + k * 6);
        ctx.beginPath();
        ctx.moveTo(0, base);
        const steps = 64;
        for (let s2 = 0; s2 <= steps; s2++) {
          const x = (s2 / steps) * vw, j = Math.floor(((s2 / steps) * N + shift / 12 + k * 17) % N);
          const v = (vals[j] + vals[(j + 1) % N] + vals[(j + N - 1) % N]) / 3;
          ctx.lineTo(x, base - (0.12 + v) * hMax * (0.7 + 0.3 * Math.sin(s2 * 0.5 + k)));
        }
        ctx.lineTo(vw, base);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, base - hMax * 1.1, 0, base);
        g.addColorStop(0, rgba(pal[k], (0.5 - k * 0.12).toFixed(2)));
        g.addColorStop(1, rgba(pal[k], 0.04));
        ctx.fillStyle = g;
        ctx.fill();
      }
    } else if (V.style === "scope") {
      // Oszilloskop: ein Lichtkreis, der in Obertönen schwingt – jede Spektrumsgruppe eine eigene Welle
      for (const [w, al] of V.glow ? [[9, 0.12], [2.5, 0.95]] : [[2.5, 0.95]]) {
        ctx.lineWidth = w * dpr;
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = rgba(pal[k], (al * (k ? 0.65 : 1)).toFixed(3));
          ctx.beginPath();
          for (let s2 = 0; s2 <= 180; s2++) {
            const a = (s2 / 180) * Math.PI * 2;
            let off = 0;
            for (let h = 1; h <= 5; h++) off += vals[Math.floor((h / 6) * N)] * Math.sin(a * (h * 3 + k) + tt * h * (k ? -1 : 1));
            const rr = R * 1.18 + maxLen * 0.35 + off * maxLen * 0.32;
            const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
            s2 ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
      }
    } else if (V.style === "shatter") {
      drawShatter(ctx, cx, cy, maxLen, dt, b, dpr, tt);
    } else if (V.style === "wave") {
      // geschlossene, weiche Kurve durch alle Spitzen
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const j = i % N, nx = (i + 1) % N;
        const x0 = cx + Math.cos(ang(j)) * tip(j), y0 = cy + Math.sin(ang(j)) * tip(j);
        const x1 = cx + Math.cos(ang(nx)) * tip(nx), y1 = cy + Math.sin(ang(nx)) * tip(nx);
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.quadraticCurveTo(x0, y0, mx, my);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(pal[0], 0.16);
      ctx.fill();
      if (V.glow) {
        ctx.lineWidth = 10 * dpr;
        ctx.strokeStyle = rgba(pal[1], 0.14);
        ctx.stroke();
      }
      ctx.lineWidth = 2.5 * dpr;
      ctx.strokeStyle = rgba(pal[2], 0.95);
      ctx.stroke();
    } else {
      // Balken bzw. Punkte: pro Farbe EIN Pfad statt einer Linie pro Balken
      const groups = [[], [], []];
      for (let i = 0; i < N; i++) groups[i % 3 === 0 ? 2 : i % 2 ? 0 : 1].push(i);
      const passes = V.style === "bars" && V.glow ? [[9, 0.15], [3, 0.95]] : [[3, 0.95]];
      for (const [w, al] of passes) {
        ctx.lineWidth = w * dpr;
        groups.forEach((idx, gi) => {
          ctx.beginPath();
          for (const i of idx) {
            const c = Math.cos(ang(i)), sn = Math.sin(ang(i)), e = tip(i);
            if (V.style === "dots") {
              ctx.moveTo(cx + c * e + 3 * dpr, cy + sn * e);
              ctx.arc(cx + c * e, cy + sn * e, 3 * dpr, 0, Math.PI * 2);
            } else {
              ctx.moveTo(cx + c * R, cy + sn * R);
              ctx.lineTo(cx + c * e, cy + sn * e);
            }
          }
          if (V.style === "dots") {
            ctx.fillStyle = rgba(pal[gi], al);
            ctx.fill();
          } else {
            ctx.strokeStyle = rgba(pal[gi], al);
            ctx.stroke();
          }
        });
      }
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
    const want = 1 + b * V.pulse;
    pulseS = want > pulseS ? want : pulseS + (want - pulseS) * (1 - Math.exp(-dt * 9));
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
      const sh = px.shake > 0.3 ? `${((Math.random() * 2 - 1) * px.shake).toFixed(1)}px ${((Math.random() * 2 - 1) * px.shake * 0.6).toFixed(1)}px` : "";
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
  let curInst = null, pulseS = 1, lastPulse = "", lastFlashCol = -1, vizErr = null, lostSince = 0, lastKick = "", lastFill = "";
  let activeEl = null, lastBounce = "", lastRot = "", lastBgZ = "";
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
      px: {
        key: px.key, P: { spot: P.spot }, accent: px.accent, kickEnv: px.kickEnv, snareEnv: px.snareEnv, hatEnv: px.hatEnv,
        beat: px.beat, hit: px.hit, energy: px.energy, build: px.build, low: px.low, drop: px.drop, dropHit: px.dropHit,
        I: px.I, spin: px.spin, level: px.level, scene: px.scene, inBar: px.inBar, phase: px.phase, beatIdx: px.beatIdx,
        finale: !!px.finale, blackout: !!px.blackout,
      },
      // Bühneneffekte (CO2, Pyro, Feuerwerk) und Stroboskop – Stroboskop nur ab „Extrem“ und mit Blitzen an
      fx: cfg.partyFx && px.fx && px.level >= 2 && !lightMode(),
      rig: cfg.partyRig && px.fx && px.level >= 2 && !lightMode(),
      flash: cfg.partyFlash && px.fx,
      inst: curInst,
      strobe: cfg.partyStrobe && cfg.partyFlash && px.fx && px.level >= 4,
      cam: { s: cam.s, x: cam.x, y: cam.y }, dep: { x: depth.x, y: depth.y, on: !!depth.key },
      quality: quality.level, hype: hypeOn, bpm: px.tempo || party.info.bpm || 120,
      stage: px.fx && cfg.partyLasers && px.level >= 2, crowd: cfg.partyCrowd && px.fx, paused: !S.Player.isPlaying(),
      venue: moments.venue || (cfg.partyVenue && cfg.partyVenue !== "auto" ? cfg.partyVenue : ""),
      fog: cfg.partyFog && px.fx && px.level >= 2 && !lightMode(),
      drones: cfg.partyDrones && px.fx && px.level >= 2 && !lightMode(),
      song: currentItem()?.uri || "",
      handsUp: moments.hands, flashStorm: moments.storm, confetti: moments.confetti,
    });
    // Lichtstrahlen (ab „Extrem“): gespiegelte Fächer aus dem Cover. Im Break blenden sie aus, im Aufbau
    // werden sie schmaler und flirren im doppelten Tempo, beim Drop gehen sie voll auf.
    if (px.lasers && px.beamVis > 0.02) {
      const n = px.lasers, far = Math.hypot(vw, vh), half = n / 2;
      const riser = px.build ? 1 + px.build * 0.7 * (0.5 + 0.5 * Math.sin((performance.now() / 1000) * Math.PI * 4 * ((party.info.bpm || 120) / 60))) : 1;
      const al = (0.1 + px.accent * 0.4 + px.drop * 0.3) * px.beamVis * riser * (P.beams ?? 1);
      const wd = (0.012 + px.accent * 0.016 + px.drop * 0.012) * (1 - px.build * 0.5);
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
      if (px.hit && px.beat > 0.5 && px.low < 0.5) n = Math.round(P.sparks * px.lvl * (0.35 + px.bright * 0.9) * (0.5 + px.I * 0.5));
      if (px.dropHit) n += Math.round(50 * Math.min(px.lvl, 2));
      // Hi-Hats und Becken: ein paar feine Funken genau auf dem Klang
      if (px.hatHit && px.low < 0.6) n += Math.round(1 + px.bright * 4);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        sparks.push({ a, r: R + maxLen * 0.6, v: (160 + Math.random() * 260) * dpr * (1 + px.drop * 0.8), life: 1, c: colAt(a / (Math.PI * 2)) });
      }
    }
    // Drop: drei Ringe hintereinander
    if (px.dropHit) for (let k = 0; k < 3; k++) rings.push({ r: R - k * 46 * dpr, a: 0.95 - k * 0.2, w: 7 - k * 2 });
    sparks = sparks.filter((p) => (p.life -= dt * 1.15) > 0);
    for (const p of sparks) {
      p.r += p.v * dt;
      p.v *= Math.exp(-dt * 1.6);
      ctx.fillStyle = rgba(p.c, p.life * 0.9);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(p.a) * p.r, cy + Math.sin(p.a) * p.r, (0.8 + p.life * 1.8) * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
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
  const venueLocal = createVenue((w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  });
  const glowSprite = venueLocal.glowSprite;
  let venueWorker = null, venueCtx = null, venueOn = false, venueBusy = false, venueSentAt = 0, venueDt = 0;
  const venueHold = { dropHit: false, hit: false };
  function venueInit() {
    if (venueWorker || venueCtx) return;
    try {
      if (typeof __VENUE_WORKER__ === "string" && q.venueEl.transferControlToOffscreen && window.Worker) {
        const url = URL.createObjectURL(new Blob([__VENUE_WORKER__], { type: "text/javascript" }));
        const w = new Worker(url);
        const off = q.venueEl.transferControlToOffscreen();
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
    const n = q.venueEl.cloneNode(false);
    q.venueEl.replaceWith(n);
    q.venueEl = n;
    venueCtx = n.getContext("2d");
  }
  function venueFrame(st) {
    venueInit();
    venueOn = true;
    // Der Thread zeichnet noch? Dann dieses Bild auslassen und die Zeit fürs nächste aufheben –
    // ein Rückstau ließe Publikum und Licht hinterherhinken und ruckweise aufholen
    venueDt = Math.min(0.1, venueDt + st.dt);
    // einmalige Signale (Drop, Treffer) gehen beim Auslassen nicht verloren
    venueHold.dropHit ||= !!st.px.dropHit;
    venueHold.hit ||= !!st.px.hit;
    if (venueWorker) {
      const now = performance.now();
      if (venueBusy && now - venueSentAt < 250) return;
      st.dt = venueDt;
      venueDt = 0;
      Object.assign(st.px, venueHold);
      venueHold.dropHit = venueHold.hit = false;
      venueBusy = true;
      venueSentAt = now;
      venueWorker.postMessage({ type: "frame", st });
      return;
    }
    st.dt = venueDt;
    venueDt = 0;
    venueHold.dropHit = venueHold.hit = false;
    if (venueCtx) {
      if (q.venueEl.width !== st.vw || q.venueEl.height !== st.vh) [q.venueEl.width, q.venueEl.height] = [st.vw, st.vh];
      venueLocal.draw(venueCtx, st);
    }
  }
  function venueClear() {
    if (!venueOn) return;
    venueOn = false;
    if (venueWorker) venueWorker.postMessage({ type: "clear" });
    else venueCtx?.clearRect(0, 0, q.venueEl.width, q.venueEl.height);
  }

  /* ---------------------------------------------------------------- Party-Erweiterungen */
  let blend = null, motes = [], hype = new Set(), hypeOn = false;
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
    px.ambient = clamp(0.04 + px.kickEnv * 0.2 * px.I + px.drop * 0.16 + (hypeOn ? 0.06 : 0) + px.build * 0.08, 0, 0.42) * (1 - px.low * 0.7);
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
    // Übergang zwischen Songs: abdimmen, bis der erste Schlag des neuen Songs kommt (höchstens 4 s)
    if (blend) {
      const age = (now - blend.t0) / 1000;
      if (blend.waiting && ((px.hit && age > 0.35) || age > 2.5)) {
        blend.waiting = false;
        blend.glow = 1;
        blend.hitAt = now;
        rings.push({ r: R, a: 0.9, w: 6 }, { r: R - 40 * dpr, a: 0.7, w: 4 });
      }
      const sm = clamp(age / 0.8, 0, 1), dim = blend.waiting ? 1 - 0.4 * sm * sm * (3 - 2 * sm) : 1;
      px.I *= dim;
      px.accent *= dim;
      px.beamVis *= dim;
      if (!blend.waiting) {
        blend.glow *= Math.exp(-dt * 2.5);
        px.flash = Math.max(px.flash, blend.glow * 0.4);
        if (blend.glow < 0.02 && (!blend.from || now - blend.hitAt > (4 * 60000) / (party.info.bpm || 120))) blend = null;
      }
    }
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
    if (px.dropHit && cfg.partyShatter && px.fx && activeEl) {
      activeEl.classList.remove("is-burst");
      void activeEl.offsetWidth;
      activeEl.classList.add("is-burst");
      const pal3 = vividPal || palette();
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
    live.feed(px, vividPal || palette(), party.info.bpm, { ly: lineAt(active), lyn: lineAt(active + 1) });
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
  let lastDraw = 0, onBattery = false, quietNow = false;
  try {
    navigator.getBattery?.().then((b) => {
      const upd = () => (onBattery = !b.charging);
      upd();
      b.addEventListener("chargingchange", upd);
    });
  } catch {}
  const ecoOn = () => cfg.eco === "on" || (cfg.eco === "auto" && onBattery);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    // Bildrate je nach Preset: Leicht/Energiesparen/ruhige Party-Stellen 30, Ausgewogen höchstens 60
    // (auf 120/144-Hz-Bildschirmen halbiert das die Arbeit), Voll so schnell wie der Bildschirm.
    // 3 ms Spielraum, damit ein leicht zu früh kommendes Bild nicht ausfällt.
    const fpsCap = ecoOn() || lightMode() || (quietNow && cfg.partyQuietFps) ? 30 : cfg.preset === "balanced" ? 60 : 0;
    if (fpsCap && now - lastDraw < 1000 / fpsCap - 3) return;
    lastDraw = now;
    if (sizeKey !== sizeKeyNow()) sizeCanvas();
    // gleichmäßige Songuhr mit Vorlauf (siehe clock.js) – Party, Visualizer und Karaoke laufen danach
    const pos = songPos(now);
    const dur = S.Player.getDuration?.() || 0;
    // scaleX statt width: kein Neu-Layout in jedem Bild
    const fill = `scaleX(${dur ? clamp(pos / dur, 0, 1).toFixed(4) : 0})`;
    if (fill !== lastFill) q.fill.style.transform = lastFill = fill;
    if (now - lastText > 250) {
      lastText = now;
      q.pos.textContent = fmt(pos);
      q.dur.textContent = fmt(dur);
      syncState();
    }
    const mode = el.dataset.mode;
    const shatterOn = VIZ.has(mode) && mode !== "party" && cfg.vizStyle === "shatter" && !cfg.calm;
    if (el.classList.contains("is-shatter") !== shatterOn) el.classList.toggle("is-shatter", shatterOn);
    pauseScene(mode === "party" && cfg.partyPause && !cfg.calm && !S.Player.isPlaying(), now);
    if (LYR.has(mode)) drawLyrics(pos);
    if (VIZ.has(mode)) {
      // ein Fehler in einem Bild darf den Visualizer nicht dauerhaft lahmlegen: Zustand zurücksetzen,
      // das nächste Bild fängt sauber neu an
      try {
        drawViz(pos, now);
        if (mode === "party" && cfg.partyWords && !cfg.calm && wfxGeo) {
          const g = wfxGeo, dtw = Math.min(0.12, wfxAt ? (now - wfxAt) / 1000 : 0.016);
          wfxAt = now;
          wordFx.draw(vctx, {
            pos, now, dt: dtw, w: vw, h: vh, dpr: g.dpr, cx: g.cx, cy: g.cy, R: g.R, pal: vividPal || palette(),
            level: cfg.partyLevel ?? 2, beat: g.px.accent || 0, beatIdx: g.px.beatIdx, playing: S.Player.isPlaying(),
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
  function fitTop() {
    if (!el) return;
    el.classList.remove("tabs-left");
    const tabs = el.querySelector(".m-im-tabs")?.getBoundingClientRect(), acts = el.querySelector(".m-im-actions")?.getBoundingClientRect();
    if (tabs && acts && acts.width && acts.left < tabs.right + 12) el.classList.add("tabs-left");
  }
  addEventListener("resize", () => requestAnimationFrame(fitTop));
  function applyCanvas() {
    if (!el || !q.cvbtn) return;
    // Der Knopf ist in passenden Ansichten immer da (sonst findet man die Funktion nie); ohne Canvas wird er
    // blass und sagt beim Klick, warum. So springt die Leiste auch nicht bei jedem Songwechsel.
    const mode = el.dataset.mode, show = cfg.canvas && !cfg.calm && CV_MODES.has(mode), can = show && !!canvasUrl;
    const on = can && !!cfg.canvasIn?.[mode];
    q.cvbtn.hidden = !show;
    q.cvbtn.classList.toggle("is-none", show && !canvasUrl);
    q.cvbtn.setAttribute("aria-pressed", String(on));
    q.cvbtn.title = q.cvbtn.ariaLabel = t(!canvasUrl ? "canvasNone" : on ? "canvasOff" : "canvasOn");
    el.classList.toggle("has-canvas", on);
    requestAnimationFrame(fitTop);
    playIn(q.cvid, on);
    playIn(q.video, on && mode === "lyrics");
  }
  // Tastenkürzel-Übersicht (Taste ?)
  const KEYS = [["Space", "k_play"], ["← →", "k_seek"], ["↑ ↓", "k_vol"], ["1 – 5", "k_view"], ["L", "k_like"], ["S", "k_shuffle"], ["R", "k_repeat"], ["F", "k_full"], ["N / P", "k_next"], ["Q", "k_queue"], ["T", "k_tap"], ["E", "k_timing"], ["Esc", "k_close"], ["?", "keysTitle"]];
  function toggleKeys(force) {
    if (!q.keys) return;
    const show = force ?? q.keys.hidden;
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
    q.keys.hidden = !show;
  }
  function styleLyrics() {
    el.style.setProperty("--m-lyr-size", String(cfg.lyrSize / 100));
    el.style.setProperty("--m-lyr-gap", String(cfg.lyrGap / 100));
  }

  // Seitenleiste: Als Nächstes · Geräte · Schlaf-Timer
  let side = null;
  function showSide(kind) {
    side = kind;
    q.side.hidden = !kind;
    q.side.dataset.kind = kind || "";
    if (!kind) return;
    q.side.querySelector("b").textContent = t({ queue: "c_queue", devices: "c_devices", timer: "c_timer", versions: "lyrPick", playlists: "c_addTo", wishes: "wishTitle", screens: "toScreen", poll: "pollBtn", recap: "recapBtn", dj: "djTitle", games: "gTitle" }[kind]);
    const body = q.sideBody;
    body.textContent = "";
    const item = (label, sub, img, onClick, on) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "m-im-side-item" + (on ? " is-on" : "");
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
    if (kind === "screens") return screensPanel(body, item);
    if (kind === "dj") return djPanel(body);
    if (kind === "games") return gamesPanel(body);
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
        small.textContent = res === true ? "✓ " + t("plAdded") : res === "dup" ? t("plDup") : t("plFail");
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
    if (side === "queue") setTimeout(() => side === "queue" && showSide("queue"), 600);
    const item = currentItem();
    setCover(item);
    setCanvas(item);
    q.title.textContent = titleOf(item) || t("nothing");
    q.artist.textContent = artistOf(item);
    q.smart.hidden = !ctl.isSmartPick(item);
    if (side === "playlists") showSide("playlists");
    q.play.innerHTML = S.Player.isPlaying() ? ICON.pause : ICON.play;
    lastBeatIdx = -1;
    moments.stormDone = false;
    moments.venue = "";
    // „Energie halten“: passt der nächste Song gar nicht, zieht Mirage einen passenderen vor
    if (item?.uri && el.dataset.mode === "party") dj.onSong(item.uri).then((m) => m && S.showNotification?.(t("djMoved").replace("{t}", m.title), false, 4000));
    updateKicker();
    if (LYR.has(el.dataset.mode)) loadLyrics();
    if (el.dataset.mode === "party") {
      // Übergang: das Licht des alten Songs dimmt ab und springt auf dem ersten Schlag des neuen wieder an
      if (cfg.partyBlend && !cfg.calm) blend = { t0: performance.now(), waiting: true, glow: 0, from: cfg.partyDJ && vividPal ? vividPal.map((c) => c.slice()) : null, hitAt: 0 };
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
    if (!recap.start || Date.now() - recap.last > 3600e3) Object.assign(recap, { start: Date.now(), songs: [], drops: 0, peak: null });
    recap.last = Date.now();
    if (recap.songs.some((x) => x.uri === item.uri)) return;
    recap.songs.push({ uri: item.uri, title: titleOf(item), artist: artistOf(item), key: info?.key || "pop", bpm: info?.bpm || 0, img: covers(item).big || covers(item).small });
    showExtras();
  }
  function showExtras() {
    if (!el) return;
    const party = el.dataset.mode === "party";
    q.recap.hidden = !(party && cfg.partyRecap && recap.songs.length >= 3);
    q.conf.hidden = !party || !!cfg.calm;
    q.pollbtn.hidden = !(party && cfg.partyLive);
    q.djbtn.hidden = !party;
    q.gamebtn.hidden = !party;
    if (!party) games.stop();
    q.screen.hidden = !(party && cfg.partyScreen);
    q.live.hidden = !(party && cfg.partyLive);
    if (q.live.hidden) el.querySelector(".m-im-livecard")?.remove();
    drawWishes();
  }
  // Songwünsche der Gäste (Live-Link): ein Knopf oben mit Zahl, die Liste in der Seitenleiste (wie die
  // Warteschlange), neue Wünsche gleiten kurz oben ein – auch wenn die Bedienung im Party-Modus ausgeblendet ist
  const seenWish = new Set();
  const openWishes = () => (el?.dataset.mode === "party" && cfg.partyLive && cfg.partyWishes ? live.wishes().filter((w) => w.st === "open") : []);
  const safeImg = (u) => (/^https:\/\/i\.scdn\.co\//.test(u || "") ? u : "");
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
    txt.append(ti, sub);
    const votes = document.createElement("i");
    votes.className = "m-im-votes";
    votes.textContent = "👍 " + w.v;
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "m-im-wish-ok";
    ok.textContent = t("wishQueue");
    ok.onclick = () => takeWish(w, ok);
    const no = document.createElement("button");
    no.type = "button";
    no.className = "m-im-wish-no";
    no.textContent = "✕";
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
  // Live-Link: QR-Code und Link der Handy-Seite (verschlüsselt über einen Relay, siehe live.js)
  async function toggleLiveCard() {
    const old = el.querySelector(".m-im-livecard");
    if (old) return old.remove();
    const info = await live.prepare().catch(() => null);
    const card = document.createElement("div");
    card.className = "m-im-livecard";
    const b = document.createElement("b");
    b.textContent = t("liveTitle");
    if (!info) {
      const p = document.createElement("p");
      p.textContent = t("liveError");
      card.append(b, p);
    } else {
      const img = new Image();
      img.alt = "";
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(info.qr);
      const p = document.createElement("p");
      p.textContent = t("liveHint");
      const u = document.createElement("code");
      u.textContent = t("liveCopy");
      u.title = info.url;
      u.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(info.url).catch(() => {});
      };
      const note = document.createElement("small");
      note.textContent = t("liveRelay");
      card.append(img, b, p, u, note);
    }
    card.onclick = () => card.remove();
    el.append(card);
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
  }

  /* ---- Pause: ruhige Szene mit Party-Namen und QR-Code (nach 3 s Stille, verschwindet mit der Musik) */
  let pausedAt = 0;
  function pauseScene(on, now) {
    if (!on) {
      pausedAt = 0;
      q.pause?.classList.remove("is-on");
      return;
    }
    if (!pausedAt) pausedAt = now;
    if (now - pausedAt < 3000 || q.pause?.classList.contains("is-on")) return;
    if (!q.pause) {
      q.pause = document.createElement("div");
      q.pause.className = "m-im-pause";
      el.append(q.pause);
    }
    q.pause.textContent = "";
    const b = document.createElement("b"), s2 = document.createElement("small");
    b.textContent = t("pauseTitle");
    s2.textContent = titleOf(currentItem()) || "";
    q.pause.append(b, s2);
    const inf = cfg.partyLive ? live.info() : null;
    if (inf?.qr) {
      const qr = document.createElement("div");
      qr.className = "m-im-pause-qr";
      qr.innerHTML = inf.qr; // eigenes SVG aus der QR-Bibliothek
      const hint = document.createElement("small");
      hint.textContent = t("pauseSub");
      q.pause.append(qr, hint);
    }
    q.pause.classList.add("is-on");
  }

  /* ---- Spiele: auswählen, starten, beenden. Alle außer dem Glücksrad spielen die Gäste auf ihren Handys. */
  function gamesPanel(body) {
    const cur = games.active();
    if (cur) {
      if (cur === "wheel") sideBtn(body, t("gSpin"), "", () => games.spin());
      sideBtn(body, t("gEndNow"), "", () => {
        games.stop();
        showSide("games");
      });
      return;
    }
    const note = document.createElement("p");
    note.className = "m-im-side-note";
    note.textContent = t("gHint");
    body.append(note);
    for (const k of ["quiz", "gap", "stop", "battle", "wheel"]) {
      sideBtn(body, t({ quiz: "gQuiz", gap: "gGap", stop: "gStop", battle: "gBattle", wheel: "gWheel" }[k]), t({ quiz: "gQuizHint", gap: "gGapHint", stop: "gStopHint", battle: "gBattleHint", wheel: "gWheelHint" }[k]), async () => {
        // Handy-Spiele brauchen den Live-Link
        if (k !== "wheel" && !cfg.partyLive) {
          cfg.partyLive = true;
          save();
          showExtras();
          await live.prepare();
        }
        games.start(k);
        // die Leiste würde die Spielkarte verdecken; beenden geht über denselben Knopf oben
        showSide(null);
      });
    }
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

  /* ---- Reaktionen der Gäste: Emojis steigen vom unteren Rand auf */
  window.addEventListener("mirage:react", (e) => {
    if (!el || el.dataset.mode !== "party" || el.querySelectorAll(".m-im-react").length > 24) return;
    const r = document.createElement("span");
    r.className = "m-im-react";
    r.textContent = e.detail;
    r.style.left = 8 + Math.random() * 84 + "%";
    r.style.setProperty("--dx", (Math.random() * 80 - 40).toFixed(0) + "px");
    el.append(r);
    setTimeout(() => r.remove(), 3600);
  });

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
  async function savePartyPlaylist() {
    const uris = recap.songs.map((x) => x.uri).filter((u) => u?.startsWith("spotify:track:"));
    if (!uris.length) return;
    const name = `Mirage Party · ${new Date(recap.start || Date.now()).toLocaleDateString()}`;
    let uri = "";
    try {
      uri = await S.Platform?.RootlistAPI?.createPlaylist?.(name, { before: "start" });
      if (uri) await S.Platform.PlaylistAPI.add(uri, uris, { before: "start" });
    } catch {
      uri = "";
    }
    // Rückfall: Web-API
    if (!uri) {
      try {
        const me = await S.CosmosAsync.get("https://api.spotify.com/v1/me");
        const pl = await S.CosmosAsync.post(`https://api.spotify.com/v1/users/${me.id}/playlists`, { name, public: false, description: "Mirage party recap" });
        await S.CosmosAsync.post(`https://api.spotify.com/v1/playlists/${pl.id}/tracks`, { uris });
        uri = pl.uri;
      } catch {}
    }
    S.showNotification?.(uri ? t("recapSaved").replace("{n}", name) : t("recapSaveFail"), !uri, 4000);
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
  function sideBtn(parent, label, sub, onClick, on) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "m-im-side-item" + (on ? " is-on" : "");
    const txt = document.createElement("span"), l = document.createElement("b");
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
  let hiddenAt = 0, ticker = null;
  function hiddenTick() {
    if (!document.hidden || !el || !isOpen() || el.dataset.mode !== "party" || !cfg.partyLive) return void (hiddenAt = 0);
    const now = performance.now(), dt = hiddenAt ? Math.min(1, (now - hiddenAt) / 1000) : 0.25;
    hiddenAt = now;
    const pos = songPos(now), px = party.step(pos / 1000, dt, S.Player.isPlaying());
    const k = lyr?.synced ? seek(lyr.lines, pos, "t") : -1;
    const lineAt = (i) => (lyr?.synced && i >= 0 && lyr.lines[i]?.text !== "♪" && lyr.lines[i]?.text) || "";
    live.feed(px, vividPal || palette(), party.info.bpm, { ly: lineAt(k), lyn: lineAt(k + 1) });
  }
  function startTicker() {
    if (ticker) return;
    try {
      const url = URL.createObjectURL(new Blob(["setInterval(() => postMessage(0), 250);"], { type: "text/javascript" }));
      ticker = new Worker(url);
      ticker.onmessage = hiddenTick;
    } catch {
      ticker = setInterval(hiddenTick, 250);
    }
  }

  function open() {
    startTicker();
    if (!el) build();
    sizeCanvas();
    setMode(cfg.imMode, false);
    styleLyrics();
    refresh();
    setHaze(lastHaze);
    syncState();
    el.classList.add("is-on");
    // Hintergrund dahinter ist verdeckt: anhalten spart sehr viel Leistung
    root.classList.add("mirage-im-open");
    dust.pause(true);
    requestAnimationFrame(placeIndicator);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    q.play.focus();
  }
  function close() {
    if (!el) return;
    el.classList.remove("is-on");
    root.classList.remove("mirage-im-open");
    q.video?.pause();
    toggleKeys(false);
    showSide(null);
    clearTimeout(idleT);
    el.classList.remove("is-idle");
    dust.pause(false);
    cancelAnimationFrame(raf);
    if (document.fullscreenElement) document.exitFullscreen?.();
  }
  const isOpen = () => !!el?.classList.contains("is-on");
  const playState = () => el && (q.play.innerHTML = S.Player.isPlaying() ? ICON.pause : ICON.play);
  const seekBy = (ms) => S.Player.seek(clamp((S.Player.getProgress?.() || 0) + ms, 2, S.Player.getDuration?.() || 2));
  const volBy = (d) => { S.Player.setVolume(clamp((S.Player.getVolume?.() ?? 1) + d, 0, 1)); setTimeout(syncState, 80); };
  return {
    open, close, toggle: () => (isOpen() ? close() : open()), isOpen, refresh, setMode, playState, updateKicker, setHaze,
    seekBy, volBy, toggleFull, toggleKeys, confetti, toggleQueue: () => el && showSide(side === "queue" ? null : "queue"), styleLyrics: () => el && styleLyrics(), reloadLyrics: () => { lyrUri = ""; el && LYR.has(el.dataset.mode) && loadLyrics(); }, toggleTiming, timingKey, like: () => q.like?.click(), shuffle: () => q.shuffle?.click(), repeat: () => q.repeat?.click(),
  };
})();

export { ICON, MODES, immersive };
