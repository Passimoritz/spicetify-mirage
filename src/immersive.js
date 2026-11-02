import { S, root, clamp, seek, fmt, loadImage } from "./core.js";
import { t } from "./i18n.js";
import { cfg, save } from "./config.js";
import { palette, rgb2hsl, hsl2rgb } from "./color.js";
import { lastHaze } from "./stage.js";
import { audio, beat } from "./audio.js";
import { dust } from "./dust.js";
import { burst } from "./burst.js";
import { getLyrics, lyricVersions, pickLyrics, translateLines, getCanvas, SOURCE_NAME } from "./lyrics.js";
import { LANG } from "./i18n.js";
import { nowPlayingCard, partyRecapCard } from "./share.js";
import * as ctl from "./controls.js";
import { currentItem, covers, titleOf, artistOf } from "./player.js";
import { party } from "./party.js";
import { jamMembers } from "./jam.js";

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
  share: '<svg viewBox="0 0 24 24"><path d="M12 3l4.5 4.5-1.4 1.4L13 6.8V15h-2V6.8L8.9 8.9 7.5 7.5zM5 13h2v5h10v-5h2v7H5z"/></svg>',
  heartOn: '<svg viewBox="0 0 24 24"><path d="M12 21 10.6 19.7C5.4 15 2 12 2 8.3 2 5.3 4.3 3 7.3 3c1.7 0 3.3.8 4.7 2 1.4-1.2 3-2 4.7-2C19.7 3 22 5.3 22 8.3c0 3.7-3.4 6.7-8.6 11.4z"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M5 5h5V3H3v7h2zm9-2v2h5v5h2V3zm5 16h-5v2h7v-7h-2zM5 14H3v7h7v-2H5z"/></svg>',
  fullOff: '<svg viewBox="0 0 24 24"><path d="M8 3v5H3v2h7V3zm8 0h-2v7h7V8h-5zM3 16h5v5h2v-7H3zm11 5h2v-5h5v-2h-7z"/></svg>',
  add: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm1 3v4h4v2h-4v4h-2v-4H7v-2h4V7z"/></svg>',
  recap: '<svg viewBox="0 0 24 24"><path d="M4 20V10h3v10zm6 0V4h3v16zm6 0v-7h3v7z"/></svg>',
  screen: '<svg viewBox="0 0 24 24"><path d="M2 4h14v10H2zm2 2v6h10V6zm16-2h2v14H8v-2h12zM6 16h6v2H6z"/></svg>',
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
  let vals = new Float32Array(120), targets = new Float32Array(120), lastVizT = 0;
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
      <canvas class="m-im-viz"></canvas>
      <div class="m-im-drag" aria-hidden="true"></div>
      <div class="m-im-top">
        <button class="m-im-close" type="button">${ICON.back}<span class="m-l"></span><kbd>ESC</kbd></button>
        <div class="m-im-tabs" role="tablist"><span class="m-im-ind"></span>
          ${MODES.map(([k], i) => `<button type="button" role="tab" data-mode="${k}" title="${i + 1}"></button>`).join("")}
        </div>
        <div class="m-im-actions">
          <button type="button" class="m-im-sm m-im-recap" hidden>${ICON.recap}</button>
          <button type="button" class="m-im-sm m-im-screen" hidden>${ICON.screen}</button>
          <button type="button" class="m-im-sm m-im-share">${ICON.share}</button>
          <button type="button" class="m-im-sm m-im-fs">${ICON.full}</button>
          <button type="button" class="m-im-sm m-im-help">?</button>
        </div>
      </div>
      <div class="m-im-cover-wrap"><div class="m-im-cover"><img alt=""><img alt=""></div></div>
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
      screen: el.querySelector(".m-im-screen"),
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
    q.recap.onclick = () => partyRecapCard(recap);
    q.screen.title = q.screen.ariaLabel = t("toScreen");
    q.screen.onclick = toScreen;
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

  function sizeCanvas() {
    if (!q.canvas) return;
    // höchstens ~3 Mio. Pixel: auf großen/hochauflösenden Bildschirmen wäre die volle Dichte ein
    // Vielfaches davon – jedes Bild neu zeichnen ruckelt dann. Die leuchtenden Linien bleiben trotzdem scharf genug.
    const budget = Math.sqrt(3e6 / Math.max(1, innerWidth * innerHeight));
    const dpr = Math.max(0.6, Math.min(devicePixelRatio || 1, 1.5, budget));
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
      if (mode === "party") party.prepare(currentItem()).then((info) => {
        updateKicker();
        noteRecap(currentItem(), info);
      });
      else resetParty();
      showExtras();
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
      q.kicker.textContent = ["Party", t("party_" + p.key), p.bpm ? p.bpm + " BPM" : ""].filter(Boolean).join(" · ");
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
    const shown = list.slice(0, 10);
    shown.forEach((m, i) => {
      const left = i % 2 === 0, row = i >> 1, rows = Math.ceil(shown.length / 2);
      const f = document.createElement("figure");
      f.className = "m-jam-p" + (m.me ? " is-me" : "") + (m.host ? " is-host" : "") + (cfg.partyJamLight && m.dj ? " is-dj" : "");
      if (cfg.partyJamLight) {
        const c = (vividPal || palette())[i % 3];
        f.style.setProperty("--jc", `rgb(${c.join(",")})`);
      }
      // etwas versetzt statt in Reih und Glied: wirkt schwebend
      f.style.cssText = `--i:${i};left:${left ? 4 + (row % 2) * 3 : 89 - (row % 2) * 3}%;top:${20 + ((row + 0.5) / rows) * 56}%`;
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
      more.style.cssText = "--i:10;left:89%;top:86%";
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
        return hit.length ? { text: w, a: hit[0].a, b: hit[hit.length - 1].b } : { text: w, a: l.t, b: l.t + 1 };
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
  // Geschätzte Wortanfänge auf Ton-Einsätze legen: ein gesungenes Wort beginnt fast immer mit einer Note,
  // und Spotify kennt jeden Einsatz (Segment-Anfänge). Je Wort der nächste Einsatz in ±250 ms, der Reihe nach.
  function snapWords(list, t0, t1) {
    list.snapped = true;
    const segs = audio.data?.segs;
    if (!segs?.length || audio.uri !== lyrUri) return;
    const on = [];
    for (let k = Math.max(seek(segs, t0 / 1000 - 0.3, "t"), 0); k < segs.length && segs[k].t * 1000 < t1; k++) {
      if (segs[k].l > -30) on.push(segs[k].t * 1000);
    }
    if (on.length < Math.max(2, list.length * 0.5)) return;
    let prev = t0 - 300;
    for (const w of list) {
      let best = null, bd = 251;
      for (const o of on) {
        const dd = Math.abs(o - w.a);
        if (o > prev + 60 && dd < bd) [best, bd] = [o, dd];
      }
      if (best != null) w.a = best;
      if (w.a <= prev) w.a = prev + 60;
      prev = w.a;
    }
    // Ende eines Worts = Anfang des nächsten; das letzte behält seine Länge
    list.forEach((w, k) => (w.b = list[k + 1] ? Math.max(w.a + 60, list[k + 1].a) : Math.max(w.a + 200, w.b)));
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
    if (!got || got.instrumental) {
      q.inner.append(emptyLyrics(!!got));
      return;
    }
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
      if (karaoke && l.text !== "♪") {
        const box = document.createElement("span");
        box.className = "m-im-words";
        const list = [];
        for (const w of wordTimes(got.lines, i)) {
          const s = document.createElement("span");
          s.className = "m-w";
          s.textContent = w.text;
          s.style.setProperty("--wi", list.length);
          box.append(s);
          if (w.sp !== false) box.append(" ");
          list.push({ el: s, a: w.a, b: w.b, p: -1 });
          if (w.est) list.est = true;
        }
        d.append(box);
        words[i] = list;
      } else d.textContent = l.text;
      frag.append(d);
    });
    q.inner.append(frag);
    showTrBtn();
    if (cfg.translate) addTranslations(token);
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

  function drawLyrics(pos) {
    if (!lyr?.synced) return;
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
        const p = Math.round(clamp((pos - w.a) / (w.b - w.a), 0, 1) * 50) / 50;
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
    if (px) partyExtras(px, now, dt, R, dpr);
    if (px) {
      const P = px.P;
      Object.assign(V, {
        mirror: P.mirror, spin: P.spin, glow: true, rings: true, ring: P.ring,
        // Kranz und Puls folgen der Energie des Songs: im Break klein und ruhig, im Drop voll
        height: V.height * P.height * (0.7 + 0.35 * px.I + px.drop * 0.2),
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
      b = px ? Math.max(px.accent * 0.75, px.kickEnv * (0.6 + 0.4 * px.I)) : beat.read(sec);
      const bi = seek(audio.data.beats, sec, "t");
      if (bi !== lastBeatIdx && bi >= 0 && playing) {
        lastBeatIdx = bi;
        const c = clamp(audio.data.beats[bi].c + 0.3, 0, 1);
        // Party: Ringe nur auf betonten Schlägen, kräftiger je mehr Energie; im Break keine
        if (px) {
          if (V.rings && px.beat > 0.5 && px.low < 0.6) rings.push({ r: R, a: (0.35 + 0.6 * px.accent) * c, w: 2 + 5 * px.accent });
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

    const pal = px ? vivid(palette(), px.minor, px.P.tint, px.tone > 0.35 ? px.pitch : -1) : palette();
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

    if (px) drawParty(ctx, cx, cy, R, maxLen, N, pal, dpr, dt, px, tip, ang);
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
    const pulse = (1 + b * V.pulse).toFixed(3);
    if (pulse !== lastPulse) q.wrap.style.scale = lastPulse = pulse;
    if (px) {
      // Farbfläche: nur Deckkraft und (beim Takt) Farbe ändern – beides ohne Neu-Layout
      partyFx = true;
      const op = (px.flash * 0.42).toFixed(2);
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
      // Hintergrund: Kamera-Zoom und Kamera-Stoß zusammen
      const bz = (cam.s * (px.kick > 0.02 ? 1 + px.kick * 0.06 : 1)).toFixed(3);
      if (bz !== lastBgZ) {
        lastBgZ = bz;
        q.bg.style.scale = bz === "1.000" ? "" : bz;
      }
    }
  }
  let lastPulse = "", lastFlashCol = -1, vizErr = null, lostSince = 0, lastKick = "", lastFill = "";
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
    tunnel = [];
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
  const TINT = { cool: 205, warm: 28, hot: 4 };
  // Farbton ein Stück Richtung Ziel drehen (kürzester Weg auf dem Farbkreis)
  const toward = (h, target, f) => (h + ((((target - h) % 360) + 540) % 360 - 180) * f + 360) % 360;
  function vivid(pal, minor, tint, pitch = -1) {
    const key = pal.map((c) => c.join(",")).join("|") + (minor ? "m" : "") + (tint || "") + pitch;
    if (key === vividKey) return vividPal;
    vividKey = key;
    const hsl = pal.map(rgb2hsl);
    const grey = hsl.every(([, s]) => s < 0.12);
    vividPal = hsl.map(([h, s, l], i) => {
      let hue = grey ? [275, 195, 320][i] : h;
      if (TINT[tint] != null) hue = toward(hue, TINT[tint] + (i - 1) * 22, 0.45);
      // Melodie: die Tonklasse färbt das Akzentlicht (Quintenzirkel – verwandte Töne liegen nah beieinander)
      if (pitch >= 0) hue = toward(hue, ((pitch * 7) % 12) * 30, i === 2 ? 0.35 : 0.1);
      return minor ? hsl2rgb([(hue + 345) % 360, Math.max(s, 0.66), clamp(l, 0.46, 0.6)]) : hsl2rgb([hue, Math.max(s, 0.74), clamp(l, 0.56, 0.7)]);
    });
    return vividPal;
  }

  // Bühnenlicht: jedes Genre hat seine eigene Lichtsprache. Alles mit „lighter“ – Licht addiert sich wie echtes.
  // Leuchtpunkt-Bild je Farbe, einmal gerendert: 90 Discokugel-Punkte kosten dann nur drawImage
  const glowSprites = new Map();
  function glowSprite(c) {
    const k = c.join(",");
    if (!glowSprites.has(k)) {
      if (glowSprites.size > 24) glowSprites.clear();
      const cv = document.createElement("canvas");
      cv.width = cv.height = 48;
      const x = cv.getContext("2d");
      const g = x.createRadialGradient(24, 24, 0, 24, 24, 24);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.22, `rgba(${k},0.75)`);
      g.addColorStop(1, `rgba(${k},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 48, 48);
      glowSprites.set(k, cv);
    }
    return glowSprites.get(k);
  }
  let disco = null, tunnel = [];
  function drawStage(ctx, pal, px, rgba, cx, cy, R, dpr, dt) {
    const t = performance.now() / 1000, far = Math.hypot(vw, vh) * 1.1;
    const beat = px.accent, vis = clamp(1 - px.low * 0.8, 0.15, 1) * (px.level >= 3 ? 1 : 0.6);
    // was welches Licht treibt: Boden = Kick, Spots von oben = Snare, Glitzern/Scanner = Hi-Hats
    const kickL = Math.max(beat, px.kickEnv), snareL = Math.max(beat * 0.8, px.snareEnv), hatL = Math.max(beat * 0.6, px.hatEnv);
    const cone = (sx, sy, a, wd, c, al, reach = far) => {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, reach);
      g.addColorStop(0, rgba(c, al));
      g.addColorStop(0.5, rgba(c, al * 0.35));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - wd) * reach, sy + Math.sin(a - wd) * reach);
      ctx.lineTo(sx + Math.cos(a + wd) * reach, sy + Math.sin(a + wd) * reach);
      ctx.closePath();
      ctx.fill();
    };
    switch (px.P.spot) {
      case "cross": {
        // Rave: zwei Kegel aus den unteren Ecken kreuzen sich – im Aufbau immer schneller, beim Drop weit offen
        const sp = 0.6 + px.energy * 0.8 + px.build * 3;
        const al = (0.05 + beat * 0.2 + px.drop * 0.12) * vis;
        for (const [sx, dir, c] of [[0, 1, pal[1]], [vw, -1, pal[2]]]) {
          cone(sx, vh, -Math.PI / 2 + dir * (0.45 + 0.4 * Math.sin(t * sp * dir + px.spin * 0.3)), 0.07 + px.drop * 0.07, c, al);
        }
        break;
      }
      case "top": {
        // Rock: harte, warmweiße Bühnenspots von oben – die Snare auf 2 und 4 reißt sie auf
        const al = (0.06 + snareL * 0.3) * vis;
        const warm = (c) => [0, 1, 2].map((k) => Math.round(c[k] * 0.55 + [255, 236, 210][k] * 0.45));
        for (const [sx, dir, c] of [[vw * 0.18, 1, pal[0]], [vw * 0.82, -1, pal[2]]]) {
          cone(sx, 0, Math.PI / 2 - dir * (0.25 + 0.18 * Math.sin(t * 0.7 + dir)), 0.16, warm(c), al, vh * 1.25);
        }
        break;
      }
      case "floor": {
        // Bass: Licht quillt vom Boden hoch, schwer auf 1 und 3, mit langem Nachhall
        const al = (0.12 + kickL * 0.5 + px.drop * 0.2) * (0.5 + px.I * 0.5) * vis;
        const g = ctx.createRadialGradient(vw / 2, vh * 1.05, 0, vw / 2, vh * 1.05, vh * (0.55 + kickL * 0.25));
        g.addColorStop(0, rgba(pal[0], al));
        g.addColorStop(0.6, rgba(pal[1], al * 0.35));
        g.addColorStop(1, rgba(pal[1], 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, vh * 0.3, vw, vh * 0.7);
        break;
      }
      case "pan": {
        // Pop: weiche Schwenks, die Farben wandern alle vier Sekunden weiter
        const al = (0.05 + beat * 0.14 + px.drop * 0.1) * vis;
        for (const [sx, dir, k] of [[0, 1, 0], [vw, -1, 1]]) {
          cone(sx, vh, -Math.PI / 2 + dir * (0.55 + 0.3 * Math.sin(t * 0.45 + k * 2)), 0.12, pal[(k + Math.floor(t / 4)) % 3], al);
        }
        break;
      }
      case "scan": {
        // Techno: Scanner – waagerechte Lichtbahnen fahren im Tempo über das Bild und gleißen auf dem Schlag auf,
        // dazu ein senkrechter Scanner, der jeden Takt einmal von links nach rechts zieht
        const bps = (party.info.bpm || 125) / 60;
        const al = (0.07 + hatL * 0.45 + px.drop * 0.2) * vis;
        const line = (x0, y0, x1, y1, c, a) => {
          for (const [lw, f] of [[24 * dpr, 0.22], [2.2 * dpr, 1]]) {
            ctx.lineWidth = lw;
            ctx.strokeStyle = rgba(c, a * f);
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
          }
        };
        for (let k = 0; k < 3; k++) {
          const y = ((t * bps * 0.25 + k / 3 + px.scene * 0.17) % 1) * vh;
          line(0, y, vw, y, pal[k], al);
        }
        const x = ((t * bps) / 4) % 1;
        line(x * vw, 0, x * vw, vh, pal[2], al * (0.4 + px.energy * 0.6));
        break;
      }
      case "disco": {
        // House: Discokugel – Lichtpunkte drehen sich langsam über das Bild und blitzen auf dem Schlag auf
        disco ||= Array.from({ length: 90 }, () => ({ th: Math.random() * Math.PI * 2, ph: Math.asin(Math.random() * 2 - 1), tw: Math.random() * 6.3, s: 0.6 + Math.random() }));
        const rot = t * 0.32 + px.spin * 0.08;
        disco.forEach((d, i) => {
          const a = d.th + rot, face = Math.cos(a) * Math.cos(d.ph);
          if (face <= 0.05) return;
          const x = vw / 2 + Math.sin(a) * Math.cos(d.ph) * vw * 0.62, y = vh * 0.42 + Math.sin(d.ph) * vh * 0.62;
          const tw = 0.5 + 0.5 * Math.sin(t * 4.5 + d.tw);
          ctx.globalAlpha = clamp(face * (0.22 + Math.max(beat * 0.7, hatL) * 0.9 + px.drop * 0.3) * (0.4 + 0.6 * tw) * vis, 0, 1);
          const r = (12 + d.s * 13 + beat * 16) * dpr;
          ctx.drawImage(glowSprite(pal[i % 3]), x - r, y - r, r * 2, r * 2);
        });
        ctx.globalAlpha = 1;
        break;
      }
      case "aurora": {
        // Trance: Polarlicht – drei weiche Bänder wehen über die obere Bildhälfte; im Aufbau steigen sie auf
        for (let k = 0; k < 3; k++) {
          const base = vh * (0.14 + 0.11 * k) - px.build * vh * 0.08;
          const amp = vh * (0.05 + 0.025 * k) * (0.6 + px.I * 0.6), thick = vh * (0.08 + 0.05 * px.I);
          const al = (0.05 + px.I * 0.1 + beat * 0.08 + px.drop * 0.1) * vis;
          const wave = (i, off) => Math.sin(i * 0.45 + t * (0.45 + 0.12 * k) + k * 2 + off) * amp + Math.sin(i * 0.17 - t * 0.3) * amp * 0.6;
          ctx.beginPath();
          for (let i = 0; i <= 24; i++) i ? ctx.lineTo((i / 24) * vw, base + wave(i, 0)) : ctx.moveTo(0, base + wave(0, 0));
          for (let i = 24; i >= 0; i--) ctx.lineTo((i / 24) * vw, base + thick + wave(i, 0.6) * 0.8);
          ctx.closePath();
          const g = ctx.createLinearGradient(0, base - amp, 0, base + thick + amp);
          g.addColorStop(0, rgba(pal[k], 0));
          g.addColorStop(0.5, rgba(pal[k], al));
          g.addColorStop(1, rgba(pal[(k + 1) % 3], 0));
          ctx.fillStyle = g;
          ctx.fill();
        }
        break;
      }
      case "tunnel": {
        // Drum & Bass: auf jedem Treffer schießt ein Lichtrahmen aus dem Cover nach außen – ein Tunnel im Takt
        if (px.hit && px.beat > 0.5) tunnel.push({ s: 1, a: 0.45 + 0.55 * px.accent, c: tunnel.length % 3, r: px.spin * 0.15 });
        tunnel = tunnel.filter((f) => (f.a *= Math.exp(-dt * 1.5)) > 0.02 && f.s < 10);
        for (const f of tunnel) {
          f.s *= Math.exp(dt * 1.9);
          const h = R * f.s, c = Math.cos(f.r), sn = Math.sin(f.r);
          ctx.setTransform(c, sn, -sn, c, cx, cy);
          ctx.lineWidth = (1.5 + f.s * 0.9) * dpr;
          ctx.strokeStyle = rgba(pal[f.c], f.a * vis * 0.85);
          ctx.beginPath();
          ctx.roundRect(-h, -h, h * 2, h * 2, h * 0.18);
          ctx.stroke();
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        break;
      }
      default: {
        // Chill: breite, sehr weiche Lichtbahnen von oben, die langsam wandern
        const al = (0.035 + beat * 0.05) * (0.6 + px.I * 0.4);
        for (let k = 0; k < 3; k++) {
          cone(vw * (0.2 + 0.3 * k) + Math.sin(t * 0.12 + k * 2) * vw * 0.08, -vh * 0.1, Math.PI / 2 + Math.sin(t * 0.09 + k) * 0.12, 0.2, pal[k], al, vh * 1.3);
        }
      }
    }
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
    if (px.fx && cfg.partyLasers && px.level >= 2) {
      stageCam(ctx, dpr);
      drawStage(ctx, pal, px, rgba, cx, cy, R, dpr, dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
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
    if (P.bottom) {
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
    if (cfg.partyCrowd && px.fx && quality.level > 0) {
      stageCam(ctx, dpr);
      drawCrowd(ctx, px, pal, dpr, rgba, dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  /* ---------------------------------------------------------------- Party-Erweiterungen */
  let blend = null, motes = [], crowd = null, hype = new Set(), hypeOn = false;
  const cam = { s: 1, x: 0, y: 0, key: "" }, depth = { x: 0, y: 0, tx: 0, ty: 0, at: 0, key: "" };
  // pro Bild, vor dem Zeichnen: Übergang, Hype, Kamera, 3D-Tiefe, Liedtext-Funken, Live-Zustand fürs Overlay
  // Läuft Party zu langsam (unter ~48 Bilder/s über 2 s), schaltet Mirage teure Details selbst herunter:
  // Stufe 1 = hintere Publikumsreihe, halbe Strahlen, weniger Funken · Stufe 0 = ohne Publikum, Kamera und Tiefe.
  // Läuft es lange flüssig, geht es wieder hoch.
  const quality = { level: 2, slow: 0, fast: 0, ema: 1 / 60 };
  function tuneQuality(dt) {
    quality.ema += (dt - quality.ema) * 0.05;
    if (quality.ema > 1 / 48) {
      quality.fast = 0;
      if ((quality.slow += dt) > 2 && quality.level > 0) [quality.level, quality.slow] = [quality.level - 1, 0];
    } else if (quality.ema < 1 / 57) {
      quality.slow = 0;
      if ((quality.fast += dt) > 10 && quality.level < 2) [quality.level, quality.fast] = [quality.level + 1, 0];
    }
  }
  function partyExtras(px, now, dt, R, dpr) {
    tuneQuality(dt);
    if (quality.level < 2) {
      px.lasers = Math.round(px.lasers / 2);
      px.lvl = Math.min(px.lvl, 1.6);
    }
    // Übergang zwischen Songs: abdimmen, bis der erste Schlag des neuen Songs kommt (höchstens 4 s)
    if (blend) {
      const age = (now - blend.t0) / 1000;
      if (blend.waiting && ((px.hit && age > 0.25) || age > 4)) {
        blend.waiting = false;
        blend.glow = 1;
        rings.push({ r: R, a: 0.9, w: 6 }, { r: R - 40 * dpr, a: 0.7, w: 4 });
      }
      const dim = blend.waiting ? clamp(1 - age * 1.5, 0.3, 1) : 1;
      px.I *= dim;
      px.accent *= dim;
      px.beamVis *= dim;
      if (!blend.waiting) {
        blend.glow *= Math.exp(-dt * 2.5);
        px.flash = Math.max(px.flash, blend.glow * 0.55);
        if (blend.glow < 0.02) blend = null;
      }
    }
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
    if (cfg.partyCamera && px.fx && quality.level > 0) {
      const t = now / 1000;
      const target = 1 + (0.012 + 0.03 * px.energy + 0.025 * px.drop) * (1 - px.low * 0.8);
      cam.s += (target - cam.s) * (1 - Math.exp(-dt * 1.2));
      if (px.dropHit) cam.s += 0.03;
      cam.x = Math.sin(t * 0.05) * innerWidth * 0.008 * (0.5 + px.energy);
      cam.y = Math.cos(t * 0.037) * innerHeight * 0.006 * (0.5 + px.energy);
      // nur die Bühne bewegt sich (Hintergrund hier, Licht und Publikum im Canvas) – Cover, Liedtext
      // und Bedienung bleiben stehen: nichts rutscht aus dem Bild, kein Spotify-Rand blitzt durch
      const k = `${cam.x.toFixed(0)}|${cam.y.toFixed(0)}`;
      if (k !== cam.key) {
        cam.key = k;
        q.bg.style.translate = `${cam.x.toFixed(0)}px ${cam.y.toFixed(0)}px`;
      }
    } else if (cam.key || cam.s !== 1) {
      Object.assign(cam, { s: 1, x: 0, y: 0, key: "" });
      q.bg.style.translate = "";
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
        q.canvas.style.transform = `perspective(1600px) rotateY(${(depth.x * 7).toFixed(2)}deg) rotateX(${(-depth.y * 5).toFixed(2)}deg)`;
      }
    } else if (depth.key) {
      depth.key = "";
      q.canvas.style.transform = q.lyrics.style.translate = q.meta.style.translate = "";
    }
    // fürs Overlay (Kantenlicht): der aktuelle Lichtzustand
    party.live = { at: now, a: +px.accent.toFixed(3), k: +px.kickEnv.toFixed(3), e: +px.energy.toFixed(3), d: +px.drop.toFixed(3), pal: vividPal };
  }
  const toLocal = (x, y) => [x, y];
  // Bühnen-Kamera für Canvas-Ebenen (Scheinwerfer, Publikum): um die Bildmitte zoomen und schweben
  function stageCam(ctx, dpr) {
    if (cam.s === 1 && !cam.x && !cam.y) return;
    ctx.setTransform(cam.s, 0, 0, cam.s, ((1 - cam.s) * vw) / 2 + cam.x * dpr, ((1 - cam.s) * vh) / 2 + cam.y * dpr);
  }
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
  // Publikum: drei Reihen Silhouetten vor der Bühne. ALLES, was sie tun, hängt an EINER Stimmung, die nur
  // aus dem Song selbst kommt (Energiekurve, Aufbau, Drop, Break) und träge ist – so tobt niemand in einer
  // ruhigen Stelle, nur weil die Analyse dort einen Kick findet, und im Drop steht keiner still.
  // Stimmung → Aktion: ruhig = wiegen, Handylichter/Feuerzeuge · mittel = Kopfnicken, Klatschen auf der Snare ·
  // hoch = Arme hoch, Faust auf der Kick, Winken im Refrain · Spitze/Drop = Springen (echte Sprünge mit Schwerkraft).
  const mood = { x: 0, phase: 0 };
  function crowdMood(px, dt) {
    const target = clamp(Math.pow(px.energy, 1.3) * 0.85 + px.drop * 0.5 + px.build * 0.2 - px.low * 0.7 + (hypeOn && px.energy > 0.45 ? 0.12 : 0), 0, 1);
    // hoch etwas schneller als runter, aber nie sprunghaft (außer beim Drop)
    mood.x += (target - mood.x) * (1 - Math.exp(-dt * (target > mood.x ? 1.6 : 0.7)));
    if (px.dropHit) mood.x = Math.max(mood.x, 0.9);
    return mood.x;
  }
  function makeCrowd(u) {
    const people = [];
    // hinten klein, blass und dicht – vorne groß und fast schwarz
    for (const [row, scale, gap] of [[2, 0.62, 34], [1, 0.8, 40], [0, 1.04, 50]]) {
      for (let x = -30 * u; x < vw + 40 * u; x += gap * u * (0.8 + Math.random() * 0.45)) {
        const r = Math.random;
        people.push({
          x, row, s: scale * (0.88 + r() * 0.26), ph: r() * 6.3,
          // eigene Schwelle und Reaktionszeit: nicht alle machen dasselbe im selben Moment
          up: r(), lag: r() * 0.12, hand: r() < 0.5 ? -1 : 1,
          hair: r() < 0.25 ? "bun" : r() < 0.45 ? "cap" : r() < 0.65 ? "curl" : "",
          gadget: r() < 0.16 ? "phone" : r() < 0.26 ? "lighter" : "",
          arm: 0, armL: 0, vy: 0, y: 0, nextJump: 0,
        });
      }
    }
    return { w: vw, people };
  }
  // Körper (Kopf, Haare/Mütze, Schultern, Gegenlicht-Rand) einmal je Reihe/Frisur/Blickrichtung als Bild –
  // pro Person dann nur noch ein drawImage statt vieler Pfade
  const bodySprites = new Map();
  function bodySprite(p, u, pal) {
    const key = `${p.row}|${p.hair}|${p.hand}|${pal[1].join()}|${pal[2].join()}|${u.toFixed(2)}`;
    let sp = bodySprites.get(key);
    if (sp) return sp;
    if (bodySprites.size > 40) bodySprites.clear();
    const S1 = 1.3 * u, w = Math.ceil(60 * S1), h = Math.ceil(100 * S1);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d"), cx0 = w / 2, y = 82 * S1, hx = cx0, hy = y - 64 * S1;
    x.fillStyle = ["rgba(4,3,10,0.96)", "rgba(12,9,24,0.86)", "rgba(24,18,44,0.7)"][p.row];
    x.beginPath();
    x.ellipse(hx, hy, 9.5 * S1, 11 * S1, 0, 0, Math.PI * 2);
    if (p.hair === "curl") x.arc(hx, hy - 3 * S1, 12 * S1, 0, Math.PI * 2);
    if (p.hair === "bun") x.arc(hx + 2 * S1, hy - 13 * S1, 5 * S1, 0, Math.PI * 2);
    x.moveTo(cx0 - 20 * S1, y + 18 * S1);
    x.quadraticCurveTo(cx0 - 22 * S1, y - 46 * S1, hx - 5 * S1, y - 50 * S1);
    x.lineTo(hx + 5 * S1, y - 50 * S1);
    x.quadraticCurveTo(cx0 + 22 * S1, y - 46 * S1, cx0 + 20 * S1, y + 18 * S1);
    x.closePath();
    x.fill();
    if (p.hair === "cap") x.fillRect(hx - 2 * S1, hy - 9 * S1, 15 * S1 * p.hand, 3 * S1);
    // Gegenlicht oben an Kopf und Schulter
    const c2 = pal[p.row === 0 ? 2 : 1];
    x.lineWidth = Math.max(1, 1.6 * S1);
    x.lineCap = "round";
    x.strokeStyle = `rgba(${c2.join(",")},${0.5 - p.row * 0.12})`;
    x.beginPath();
    x.ellipse(hx, hy, 9.5 * S1, 11 * S1, 0, Math.PI * 1.1, Math.PI * 1.9);
    x.moveTo(cx0 - 19 * S1, y - 30 * S1);
    x.quadraticCurveTo(cx0 - 21 * S1, y - 46 * S1, hx - 5 * S1, y - 50 * S1);
    x.stroke();
    sp = { c, w, h, ax: cx0, ay: y, S1 };
    bodySprites.set(key, sp);
    return sp;
  }
  function drawCrowd(ctx, px, pal, dpr, rgba, dt) {
    const u = Math.max(0.75, vh / (950 * dpr)) * dpr;
    if (!crowd || crowd.w !== vw) crowd = makeCrowd(u);
    const X = crowdMood(px, dt);
    const t = performance.now() / 1000, bps = (party.info.bpm || 120) / 60;
    const calmSong = px.key === "chill" || px.minor && X < 0.3;
    // Dunst über der Menge: Bühnenlicht fällt in die Luft über den Köpfen
    const haze = ctx.createLinearGradient(0, vh, 0, vh - 260 * u);
    haze.addColorStop(0, rgba(pal[1], (0.1 + 0.18 * X).toFixed(3)));
    haze.addColorStop(1, rgba(pal[1], 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, vh - 260 * u, vw, 260 * u);
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const fill = ["rgba(4,3,10,0.96)", "rgba(12,9,24,0.86)", "rgba(24,18,44,0.7)"];
    const glows = [], arms = [new Path2D(), new Path2D(), new Path2D()];
    // Reihe für Reihe von hinten nach vorne: erst die Körper einer Reihe, dann ihre Arme
    let curRow = null;
    const strokeRow = (row) => {
      ctx.lineWidth = 6.5 * u * [1.04, 0.8, 0.62][row];
      ctx.strokeStyle = fill[row];
      ctx.stroke(arms[row]);
    };
    for (const p of crowd.people) {
      if (p.row !== curRow) {
        if (curRow != null) strokeRow(curRow);
        curRow = p.row;
      }
      const s1 = p.s * u, base = vh + 8 * u;
      const me = clamp(X + (p.up - 0.5) * 0.3, 0, 1); // die eigene Stimmung: manche sind früher dabei als andere
      // Springen: nur in der Spitze, auf dem Schlag, mit kleiner persönlicher Verzögerung – und echter Schwerkraft
      if (px.hit && me > 0.74 && px.beat > 0.5 && p.y === 0 && Math.random() < 0.55 + (me - 0.74) * 1.5) p.nextJump = t + p.lag;
      if (p.nextJump && t >= p.nextJump) {
        p.vy = -(150 + me * 140) * s1;
        p.nextJump = 0;
      }
      if (p.vy || p.y) {
        p.vy += 1400 * s1 * dt;
        p.y = Math.min(0, p.y + p.vy * dt);
        if (p.y === 0) p.vy = 0;
      }
      // Kopfnicken auf dem Schlag ab mittlerer Stimmung, sonst leises Wiegen
      const bob = me > 0.3 ? px.accent * 4 * s1 * me : 0;
      const sway = Math.sin(t * bps * Math.PI * (me > 0.3 ? 1 : 0.5) + p.ph) * (2 + (1 - me) * 3) * s1;
      const y = base + p.y + bob, hx = p.x + sway;
      // Armhaltung weich der Stimmung nachführen: 0 = unten, 1 = hoch
      const wantUp = me > 0.55 && p.up < me + 0.1 ? 1 : p.gadget && me < 0.5 ? 0.8 : 0;
      p.arm += (wantUp - p.arm) * (1 - Math.exp(-dt * 4));
      if (p.row === 2 && quality.level < 2) continue;
      const sp = bodySprite(p, u, pal), k1 = p.s / 1.3;
      ctx.drawImage(sp.c, hx - sp.ax * k1, y - sp.ay * k1, sp.w * k1, sp.h * k1);
      // Arme mit Ellbogen: Faust auf der Kick, Klatschen auf der Snare, Winken im Refrain, Handy/Feuerzeug in ruhigen Stellen
      const arm = arms[p.row];
      for (const side of [-1, 1]) {
        const sx = p.x + side * 15 * s1, sy = y - 42 * s1;
        const a = side === p.hand ? p.arm : p.arm * (me > 0.62 ? 1 : 0.35);
        let hxA = sx + side * 6 * s1, hyA = y + 2 * s1; // unten
        if (a > 0.02) {
          let ux = side * (10 + 8 * Math.sin(t * bps * Math.PI + p.ph)) * s1, uy = -48 * s1;
          if (me > 0.62 && hypeOn) ux = side * 16 * s1 + Math.sin(t * bps * Math.PI * 0.5 + p.ph) * 14 * s1; // Winken
          if (me > 0.45 && me < 0.8 && px.P.flashOn === "back") ux *= 1 - px.snareEnv * 0.9; // Klatschen über dem Kopf
          if (side === p.hand && me > 0.6) uy -= px.kickEnv * 12 * s1 * me; // Faust pumpt auf der Kick
          hxA += (sx + ux - hxA) * a;
          hyA += (sy + uy - hyA) * a;
        }
        const ex = (sx + hxA) / 2 + side * 7 * s1, ey = (sy + hyA) / 2 + 4 * s1 * (1 - a);
        arm.moveTo(sx, sy);
        arm.quadraticCurveTo(ex, ey, hxA, hyA);
        if (side === p.hand && p.gadget && a > 0.5 && (me < 0.55 || p.gadget === "phone")) glows.push([hxA, hyA - 6 * s1, p.gadget, s1, p.row]);
      }
    }
    if (curRow != null) strokeRow(curRow);
    // Handydisplays (kühl) und Feuerzeuge (warm, flackernd) – vor allem in ruhigen und mittleren Stellen
    ctx.globalCompositeOperation = "lighter";
    for (const [x, y, kind, s1, row] of glows) {
      const r = (kind === "phone" ? 16 : 13 + Math.sin(t * 13 + x) * 2) * s1;
      ctx.globalAlpha = (calmSong || kind === "phone" ? 0.85 : 0.6) * (1 - row * 0.25);
      ctx.drawImage(glowSprite(kind === "phone" ? [170, 200, 255] : [255, 170, 70]), x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const pos = S.Player.getProgress?.() || 0;
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
    if (LYR.has(mode)) drawLyrics(pos);
    if (VIZ.has(mode)) {
      // ein Fehler in einem Bild darf den Visualizer nicht dauerhaft lahmlegen: Zustand zurücksetzen,
      // das nächste Bild fängt sauber neu an
      try {
        drawViz(pos, now);
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

  let canvasToken = 0;
  async function setCanvas(item) {
    const token = ++canvasToken;
    const url = cfg.canvas && !cfg.calm ? await getCanvas(item?.uri) : null;
    if (token !== canvasToken || !q.video) return;
    if (!url) {
      q.video.classList.remove("is-on");
      q.video.pause();
      q.video.removeAttribute("src");
      return;
    }
    if (q.video.src !== url) q.video.src = url;
    q.video.play().then(() => q.video.classList.add("is-on")).catch(() => q.video.classList.remove("is-on"));
  }
  // Tastenkürzel-Übersicht (Taste ?)
  const KEYS = [["Space", "k_play"], ["← →", "k_seek"], ["↑ ↓", "k_vol"], ["1 – 5", "k_view"], ["L", "k_like"], ["S", "k_shuffle"], ["R", "k_repeat"], ["F", "k_full"], ["N / P", "k_next"], ["Q", "k_queue"], ["Esc", "k_close"], ["?", "keysTitle"]];
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
    q.side.querySelector("b").textContent = t({ queue: "c_queue", devices: "c_devices", timer: "c_timer", versions: "lyrPick", playlists: "c_addTo" }[kind]);
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
    rings = [];
    updateKicker();
    if (LYR.has(el.dataset.mode)) loadLyrics();
    if (el.dataset.mode === "party") {
      // Übergang: das Licht des alten Songs dimmt ab und springt auf dem ersten Schlag des neuen wieder an
      if (cfg.partyBlend && !cfg.calm) blend = { t0: performance.now(), waiting: true, glow: 0 };
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
    q.screen.hidden = !(party && cfg.partyScreen && "getScreenDetails" in window);
  }
  // Party als Vollbild auf einem anderen Bildschirm (Chromium-Fensterverwaltung; fragt einmal um Erlaubnis)
  async function toScreen() {
    try {
      const d = await window.getScreenDetails();
      const other = d.screens.find((x) => x !== d.currentScreen) || d.currentScreen;
      await document.documentElement.requestFullscreen({ screen: other });
      setTimeout(syncState, 300);
    } catch {}
  }

  function open() {
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
    seekBy, volBy, toggleFull, toggleKeys, toggleQueue: () => el && showSide(side === "queue" ? null : "queue"), styleLyrics: () => el && styleLyrics(), reloadLyrics: () => { lyrUri = ""; el && LYR.has(el.dataset.mode) && loadLyrics(); }, like: () => q.like?.click(), shuffle: () => q.shuffle?.click(), repeat: () => q.repeat?.click(),
  };
})();

export { ICON, MODES, immersive };
