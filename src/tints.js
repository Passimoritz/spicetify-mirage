import { SEL } from "./selectors.js";
import { S, root } from "./core.js";

/* ---------------------------------------------------------------- Farbflächen zähmen */
// Spotify färbt Kopfbereiche per Inline-Farbe (leere Playlist = grau). Klassennamen wechseln
// ständig, darum erkennen wir große, bildlose Farbflächen im Hauptbereich am Stil selbst.
//
// Leistung: früher wurde bei JEDER Änderung im Hauptbereich jede Fläche neu vermessen
// (offsetWidth + getComputedStyle für hunderte Elemente) – bei laufender Musik ändert Spotify
// dort ständig etwas. Jetzt: nur neue Elemente und solche, deren Inline-Stil sich ändert;
// ein voller Durchgang nur beim Seitenwechsel.

// Deckkraft einer berechneten Farbe – Spotify liefert rgb()/rgba() UND oklch(… / a)
function alphaOf(c) {
  if (!c || c === "transparent") return 0;
  const slash = /\/\s*([\d.]+)(%?)\s*\)$/.exec(c);
  if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
  const rgba = /^rgba\(([^)]+)\)$/.exec(c);
  if (rgba) return Number(rgba[1].split(",")[3]);
  return 1;
}
const CANDIDATE = "div, section, header";

function tame(el, minW) {
  if (el.classList.contains("m-tint") || el.offsetWidth < minW || el.offsetHeight < 40) return;
  if (el.closest(SEL.tintSkip)) return;
  // Nach der tatsächlich berechneten Farbe gehen: egal ob Spotify sie inline, per Klasse
  // oder per Variable setzt – große, deckende, bildlose Flächen werden durchsichtig.
  const cs = getComputedStyle(el);
  // echte Fotos (Künstlerbild usw.) bleiben; Spotifys Rausch-Textur über der Farbe nicht
  if (/url\(["']?https?:/.test(cs.backgroundImage)) return;
  // dunkle Schrift heißt: Fläche ist absichtlich hell (z. B. Hinweis-Banner) – nicht anfassen
  const tc = /rgba?\(([^)]+)\)/.exec(cs.color);
  if (tc) {
    const [cr, cg, cb] = tc[1].split(",").map(Number);
    if (cr * 0.3 + cg * 0.59 + cb * 0.11 < 90) return;
  }
  const alpha = alphaOf(cs.backgroundColor);
  // Spotify malt Kopf-Farbverläufe oft in ::before/::after
  for (const p of ["::before", "::after"]) {
    const ps = getComputedStyle(el, p);
    if (ps.content !== "none" && (alphaOf(ps.backgroundColor) >= 0.3 || ps.backgroundImage.includes("gradient("))) {
      el.classList.add("m-tint-pseudo");
    }
  }
  // Spotify zeichnet Kopf-Farben auch als Verlauf (z. B. rot-zu-schwarz) – auch die weg
  const gradient = cs.backgroundImage.includes("gradient(");
  if (alpha >= 0.3) el.classList.add("m-tint");
  if (gradient) el.classList.add("m-tint", "m-tint-img");
}

const pending = new Set();
let queued = false, full = false, lastRun = 0, waiting = false;
const covered = () => root.classList.contains("mirage-im-open") || document.hidden;
function run() {
  queued = false;
  if (covered()) {
    // später nachholen, wenn wieder sichtbar – per Ereignis, nicht alle 2 s nachsehen
    waiting = true;
    return;
  }
  const mv = document.querySelector(SEL.mainView);
  if (!mv) return;
  lastRun = performance.now();
  const minW = mv.clientWidth * 0.55;
  if (full) {
    full = false;
    pending.clear();
    for (const el of mv.querySelectorAll(CANDIDATE)) tame(el, minW);
    return;
  }
  const batch = [...pending];
  pending.clear();
  for (const node of batch) {
    if (!node.isConnected) continue;
    if (node.matches(CANDIDATE)) tame(node, minW);
    // nur Elemente, die groß genug sein KÖNNEN: Kinder eines schmalen Elements sind es nie
    if (node.offsetWidth >= minW) for (const el of node.querySelectorAll(CANDIDATE)) tame(el, minW);
  }
}
function schedule() {
  if (queued) return;
  queued = true;
  // höchstens alle 400 ms, und nur in Leerlaufzeit
  const wait = Math.max(0, 400 - (performance.now() - lastRun));
  setTimeout(() => (window.requestIdleCallback || setTimeout)(run, { timeout: 800 }), wait);
}
function scanAll() {
  full = true;
  schedule();
}
function resume() {
  if (!waiting || covered()) return;
  waiting = false;
  schedule();
}
document.addEventListener("visibilitychange", resume);
document.addEventListener("mirage:im-close", resume);

(function watchTints() {
  const mv = document.querySelector(SEL.mainView);
  if (!mv) return setTimeout(watchTints, 500);
  new MutationObserver((list) => {
    for (const m of list) {
      // eigene Stiländerungen (Kartenneigung, Kaskade) sind nie Farbflächen
      if (m.type === "attributes") {
        if (!m.target.closest(SEL.tintSkip)) pending.add(m.target);
      }
      else for (const n of m.addedNodes) if (n.nodeType === 1) pending.add(n);
    }
    // 1.27 perf: verdeckt (Immersiv offen, Fenster im Hintergrund) wird nichts abgearbeitet – Spotify baut aber
    // weiter um. Früher sammelte die Liste dabei über Stunden zehntausende längst entfernte Knoten (hielt sie im
    // Speicher fest) und arbeitete sie beim Zurückkommen alle auf einmal ab. Jetzt: ab 300 Einträgen
    // stattdessen einmal „alles neu ansehen“ vormerken – ein Durchgang über die aktuelle Seite reicht.
    if (pending.size > 300 && covered()) {
      pending.clear();
      full = true;
    }
    // verdeckt: keinen Zeitgeber je Änderung stellen, resume() holt es beim Sichtbarwerden nach
    if (covered()) waiting = true;
    else if (pending.size || full) schedule();
  }).observe(mv, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
  scanAll();
  // Seitenwechsel: einmal alles, und kurz danach noch einmal (Spotify färbt Köpfe verzögert)
  try {
    S.Platform.History.listen(() => {
      scanAll();
      setTimeout(scanAll, 1500);
    });
  } catch {}
})();

/* ---------------------------------------------------------------- rechte Seitenleiste markieren */
// Die Hülle der rechten Seitenleiste (ohne eigene feste Klasse) erkannte user.css früher über
// „.Root__top-container > div:has(> .LayoutResizer__inline-start)“. Gemessen (tools/theme-perf.js): dieses :has()
// ließ JEDE Textänderung irgendwo in Spotify – die Spielzeit unten jede Sekunde – den Stil bis hinauf zu <body>
// neu prüfen, danach lief ein Layout der ganzen Seite (40–65 ms je Sekunde, im Leerlauf). Jetzt setzt theme.js
// ein data-Attribut (React überschreibt className, data-m-* lässt es stehen) und beobachtet nur die direkten
// Kinder des Containers – Spotify baut die Leiste beim Ein- und Ausklappen neu.
const RSB = "data-m-rsb";
function markSidebar(top) {
  for (const d of top.children) {
    const is = d.tagName === "DIV" && !!d.querySelector(":scope > .LayoutResizer__inline-start");
    if (is !== d.hasAttribute(RSB)) d.toggleAttribute(RSB, is);
  }
}
(function watchSidebar() {
  const top = document.querySelector(".Root__top-container");
  if (!top) return setTimeout(watchSidebar, 500);
  // beobachtet werden nur zwei Ebenen ohne subtree: die Kinder des Containers (Hüllen kommen und gehen) und die
  // direkten Kinder jeder Hülle (der Griff kann nachträglich in eine bestehende Hülle kommen) – die Listen und
  // Texte darin lösen nichts aus
  const inner = new MutationObserver(() => markSidebar(top));
  const watch = () => {
    inner.disconnect();
    for (const d of top.children) inner.observe(d, { childList: true });
    markSidebar(top);
  };
  new MutationObserver(watch).observe(top, { childList: true });
  watch();
})();

/* ---------------------------------------------------------------- angehefteter Spaltenkopf */
// Spotify vergibt dem angehefteten Kopf („# Titel Album …“) neue Klassennamen, die Spicetifys
// Klassen-Liste nicht kennt – die CSS-Regel greift dann nie und die Titel laufen sichtbar durch.
// Darum am Aufbau erkennen: das sticky-Element um die erste Kopfzeile der Liste. Ein data-Attribut
// statt Klasse, weil React className bei jedem Neuzeichnen überschreibt.
let stickyEl = null, stickyQueued = false, stickySettle = 0;
function findSticky() {
  const row = document.querySelector(`:is(${SEL.mainView}) [role="grid"] [role="row"][aria-rowindex="1"]`);
  for (let e = row; e && e !== document.body; e = e.parentElement) {
    if (getComputedStyle(e).position === "sticky") return e;
  }
  return null;
}
let stuckView = null;
function markSticky() {
  stickyQueued = false;
  if (!stickyEl?.isConnected) stickyEl = findSticky();
  // Hauptbereich merkt sich „Kopf angeheftet“: dann ist der kleine Kopf darüber ganz deckend (user.css)
  const mv = stickyEl?.closest(SEL.mainView) || null;
  if (stuckView && stuckView !== mv) stuckView.classList.remove("m-head-stuck");
  stuckView = mv;
  if (!stickyEl) return;
  const grid = stickyEl.closest('[role="grid"]') || stickyEl.parentElement;
  // angeheftet = der Kopf ist gegenüber dem Anfang der Liste nach unten gewandert
  const stuck = stickyEl.getBoundingClientRect().top - grid.getBoundingClientRect().top > 2;
  if (stuck !== stickyEl.hasAttribute("data-m-stuck")) stickyEl.toggleAttribute("data-m-stuck", stuck);
  if (mv && stuck !== mv.classList.contains("m-head-stuck")) mv.classList.toggle("m-head-stuck", stuck);
}
document.addEventListener(
  "scroll",
  () => {
    // nach dem letzten Scrollen noch einmal nachmessen – beim schnellen Hochscrollen ist das letzte Bild manchmal zu früh
    clearTimeout(stickySettle);
    stickySettle = setTimeout(markSticky, 160);
    if (stickyQueued) return;
    stickyQueued = true;
    // erst NACH dem Bild messen (rAF → Aufgabe danach): im rAF selbst war das Layout nach Spotifys Umbau der Liste
    // noch offen, getBoundingClientRect erzwang es vorzeitig (beim Scrollen der größte Einzelposten des Themes)
    requestAnimationFrame(() => setTimeout(markSticky, 0));
  },
  { capture: true, passive: true },
);
// Seitenwechsel: neue Seite steht oben, ihr Kopf ist (noch) nicht angeheftet – sonst bliebe der kleine Kopf
// der alten Seite deckend über dem Titelbild der neuen
try {
  S.Platform.History.listen(() => setTimeout(() => {
    stickyEl = null;
    markSticky();
  }, 120));
} catch {}
