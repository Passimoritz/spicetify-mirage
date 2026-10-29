import { SEL } from "./selectors.js";

/* ---------------------------------------------------------------- Lesbarkeits-Wächter */
// Spotify baut ständig neue Menüs, Dialoge und Einstellungsseiten. Statt jede einzeln im CSS
// nachzuziehen, misst Mirage dort den echten Kontrast zwischen Schrift und dem Hintergrund
// dahinter. Liegt er unter 3 : 1, bekommt das Element eine lesbare Farbe (Klasse m-readable).
// Läuft nur in Leerlaufzeit, nur auf neuen Elementen und höchstens 400 Elemente pro Durchgang.
const SCOPES = `[role="menu"], [role="listbox"], [role="dialog"], [role="tooltip"], .x-settings-container, ${SEL.mainView}`;

const parse = (c) => {
  const m = /rgba?\(([^)]+)\)/.exec(c || "");
  if (!m) return null;
  const [r, g, b, a = "1"] = m[1].split(/[\s,/]+/).filter(Boolean);
  return [Number(r), Number(g), Number(b), Number(a)];
};
const lum = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (x, y) => {
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
// Hintergrund, der tatsächlich hinter dem Text liegt: erster deckender Vorfahre
function backgroundOf(el) {
  // höchstens 10 Ebenen hoch: weiter oben liegt nur noch Spotifys Gerüst über der Bühne
  let depth = 0;
  for (let n = el; n && n !== document.documentElement && depth++ < 10; n = n.parentElement) {
    const cs = getComputedStyle(n);
    // Foto oder Verlauf dahinter: nicht sicher beurteilbar, lieber nichts anfassen
    if (cs.backgroundImage !== "none") return null;
    const bg = parse(cs.backgroundColor);
    if (bg && bg[3] >= 0.85) return bg;
  }
  return null; // durchsichtig bis oben = Mirage-Bühne dahinter, dunkel und vom Theme gesteuert
}
const hasText = (el) => {
  for (const c of el.childNodes) if (c.nodeType === 3 && c.textContent.trim()) return true;
  return false;
};

// Jedes Element wird genau EINMAL geprüft (WeakSet). Neue Elemente kommen in eine Warteschlange,
// die in Leerlauf-Häppchen abgearbeitet wird – nie mehr als ~4 ms am Stück, nie von vorn.
let checked = new WeakSet();
let queued = false;
const pending = [];
function checkOne(el) {
  checked.add(el);
  if (el.classList.contains("m-readable") || !hasText(el)) return;
  const cs = getComputedStyle(el);
  const fg = parse(cs.color);
  if (!fg || fg[3] < 0.3 || cs.visibility === "hidden") return;
  const bg = backgroundOf(el);
  if (!bg || ratio(fg, bg) >= 3) return;
  // heller Hintergrund → dunkle Schrift, dunkler → helle
  el.classList.add("m-readable", lum(bg) > 0.4 ? "m-readable-dark" : "m-readable-light");
}
function check(deadline) {
  queued = false;
  const until = performance.now() + Math.min(4, deadline?.timeRemaining?.() ?? 4);
  while (pending.length && performance.now() < until) {
    const root = pending.pop();
    if (!root.isConnected || checked.has(root) || root.closest("#mirage-immersive, #mirage-stage")) continue;
    checkOne(root);
    // Kinder hinten anhängen statt rekursiv: so lässt sich jederzeit unterbrechen
    for (let c = root.firstElementChild; c; c = c.nextElementSibling) if (!checked.has(c)) pending.push(c);
  }
  if (pending.length) schedule();
}
function schedule() {
  if (queued) return;
  queued = true;
  (window.requestIdleCallback || setTimeout)(check, { timeout: 1500 });
}
function queue(node) {
  if (node?.nodeType !== 1 || checked.has(node)) return;
  if (!node.closest(SCOPES)) {
    // ein neuer Container, in dem ein Menü/Dialog steckt
    const inner = node.querySelector?.(SCOPES);
    if (!inner) return;
    node = inner;
  }
  pending.push(node);
  schedule();
}
new MutationObserver((list) => {
  for (const m of list) for (const n of m.addedNodes) queue(n);
}).observe(document.body, { subtree: true, childList: true });
// Schemawechsel ändert alle Farben: dann einmal alles neu bewerten
function recheckAll() {
  document.querySelectorAll(".m-readable").forEach((el) => el.classList.remove("m-readable", "m-readable-dark", "m-readable-light"));
  checked = new WeakSet();
  document.querySelectorAll(SCOPES).forEach(queue);
}
setTimeout(recheckAll, 3000);

export { recheckAll };
