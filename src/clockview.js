/* ---------------------------------------------------------------- Uhr-Ansicht (1.27) */
// Für Musik im Hintergrund: große Uhrzeit im Format der Sprache, darunter auf Wunsch das Datum, klein Song und
// Künstler, dahinter ein sacht atmendes Licht in den Coverfarben. Fast ohne Bewegung und mit sehr wenig Last:
// die Zeit wird einmal pro Minute gesetzt (Zeitgeber auf die volle Minute, keine Bildschleife), das Atmen ist eine
// reine CSS-Animation der Deckkraft (läuft im Compositor, „Ruhig“ und reduzierte Bewegung: steht still).
// Einbrenn-Schutz für OLED/Plasma: das Ziffernblatt wandert einmal pro Minute um wenige Pixel, die Kopfzeile
// blendet nach kurzer Ruhe aus. Ein Klick auf die Uhr blendet das Datum ein bzw. aus (gemerkt in cfg.clockDate).
import { cfg, save } from "./config.js";
import { t, LANG } from "./i18n.js";
import { covers, titleOf, artistOf, PLR } from "./player.js";

const locale = () => {
  const n = (navigator.languages || [navigator.language || ""]).find((l) => l && l.toLowerCase().startsWith(LANG));
  return n || LANG;
};
const DRIFT = 7, IDLE_MS = 6000;

function createClockView() {
  const el = document.createElement("div");
  el.className = "m-im-clock";
  el.innerHTML = `<div class="m-ck-glow" aria-hidden="true"></div>
    <div class="m-ck-face">
      <button type="button" class="m-ck-time"><span class="m-ck-hm"></span><span class="m-ck-ap"></span></button>
      <div class="m-ck-date"></div>
      <div class="m-ck-song"><img class="m-ck-art" alt="" aria-hidden="true"><span class="m-ck-txt"><b></b><small></small></span></div>
    </div>`;
  const q = { face: el.querySelector(".m-ck-face"), glow: el.querySelector(".m-ck-glow"), time: el.querySelector(".m-ck-time"), hm: el.querySelector(".m-ck-hm"), ap: el.querySelector(".m-ck-ap"), date: el.querySelector(".m-ck-date"), art: el.querySelector(".m-ck-art"), title: el.querySelector(".m-ck-txt b"), artist: el.querySelector(".m-ck-txt small") };
  let on = false, timer = 0, idleT = 0, host = null, fmtT = null, fmtD = null, fmtL = "", dx = 0, dy = 0, lastMin = "";
  const withDate = () => cfg.clockDate !== false;
  const toggleDate = () => {
    cfg.clockDate = !withDate();
    save();
    draw(true);
  };
  q.time.onclick = toggleDate;
  function formats() {
    const l = locale();
    if (l === fmtL) return;
    fmtL = l;
    try {
      fmtT = new Intl.DateTimeFormat(l, { hour: "numeric", minute: "2-digit" });
      fmtD = new Intl.DateTimeFormat(l, { weekday: "long", day: "numeric", month: "long" });
    } catch {
      fmtT = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
      fmtD = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
    }
  }
  // Zeit setzen (nur bei neuer Minute), Ziffernblatt ein paar Pixel weiter
  function draw(force) {
    formats();
    const now = new Date(), parts = fmtT.formatToParts(now);
    const ap = parts.find((p) => p.type === "dayPeriod")?.value || "";
    let hm = parts.filter((p) => p.type !== "dayPeriod").map((p) => p.value).join("").trim();
    hm = hm.replace(/\s+$/, "");
    const key = hm + ap + withDate();
    q.time.title = q.time.ariaLabel = t(withDate() ? "ckDateOff" : "ckDateOn");
    // sichtbarer Hinweis beim Darüberfahren (user.css: .m-ck-time::after) – sonst ahnt niemand, dass die Uhr klickbar ist
    q.time.dataset.hint = q.time.title;
    if (key === lastMin && !force) return;
    const moved = key !== lastMin && lastMin;
    lastMin = key;
    if (q.hm.textContent !== hm) q.hm.textContent = hm;
    q.ap.textContent = ap;
    q.ap.hidden = !ap;
    q.date.hidden = !withDate();
    if (withDate()) q.date.textContent = fmtD.format(now);
    el.dataset.time = hm + (ap ? " " + ap : "");
    // Einbrenn-Schutz: ein kleiner Zufallsschritt, nie weiter als DRIFT px von der Mitte
    if (moved) {
      dx = Math.max(-DRIFT, Math.min(DRIFT, dx + Math.round(Math.random() * 6 - 3)));
      dy = Math.max(-DRIFT, Math.min(DRIFT, dy + Math.round(Math.random() * 6 - 3)));
      q.face.style.translate = `${dx}px ${dy}px`;
      q.glow.style.translate = `${-dx * 2}px ${-dy * 2}px`;
    }
  }
  // ein Zeitgeber je Minute, auf die volle Minute ausgerichtet – sonst nichts
  function schedule() {
    clearTimeout(timer);
    timer = 0;
    if (!on) return;
    const ms = 60000 - (Date.now() % 60000) + 40;
    timer = setTimeout(() => {
      if (!document.hidden) draw();
      schedule();
    }, ms);
  }
  function update(item) {
    q.title.textContent = titleOf(item) || t("nothing");
    q.artist.textContent = artistOf(item);
    const src = covers(item).small || "";
    if (q.art.getAttribute("src") !== src) {
      if (src) q.art.src = src;
      else q.art.removeAttribute("src");
    }
    q.art.hidden = !src;
    playing();
  }
  const playing = () => el.classList.toggle("is-paused", !PLR.isPlaying());
  // Kopfzeile nach kurzer Ruhe aus (Einbrennen); Maus oder Taste holt sie zurück
  const awake = () => {
    if (!host) return;
    host.classList.remove("is-clockidle");
    clearTimeout(idleT);
    if (on) idleT = setTimeout(() => on && !host.querySelector(".m-im-top:hover, .m-im-side:not([hidden])") && host.classList.add("is-clockidle"), IDLE_MS);
  };
  function show(v) {
    if (v === on) return;
    on = v;
    el.setAttribute("aria-hidden", String(!on));
    el.inert = !on;
    if (on) {
      draw(true);
      schedule();
      awake();
    } else {
      clearTimeout(timer);
      clearTimeout(idleT);
      timer = idleT = 0;
      host?.classList.remove("is-clockidle");
    }
  }
  document.addEventListener("visibilitychange", () => on && !document.hidden && draw());
  return {
    el, show, update, playing, toggleDate,
    attach(h) {
      host = h;
      for (const ev of ["pointermove", "pointerdown", "keydown"]) h.addEventListener(ev, () => on && awake(), { passive: true });
      el.setAttribute("aria-hidden", "true");
      el.inert = true;
    },
    get on() { return on; },
  };
}

export { createClockView };
