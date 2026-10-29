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
let queued = false, full = false, lastRun = 0;
function run() {
  queued = false;
  if (root.classList.contains("mirage-im-open") || document.hidden) {
    // später nachholen, wenn wieder sichtbar
    return setTimeout(schedule, 2000);
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
    if (pending.size) schedule();
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
