/* ------------------------------------------------------------------ Obergrenze für Blitze */
// Fotosensible Epilepsie: mehr als drei Blitze pro Sekunde gelten als riskant (WCAG 2.3.1). Das Theme hat
// dieselbe Schranke (src/flashcap.js), die Overlay-App verlässt sich aber nicht darauf: Kantenlicht, OBS-Quelle
// und Lampen bekommen den Party-Zustand erst, nachdem er hier durch ist.
// Der Mindestabstand von 0,34 s lässt in jedem Fenster von einer Sekunde höchstens drei Blitze zu.
const FLASH_GAP = 0.34;
// „Keine Blitze“: Farbwechsel der Lampen höchstens alle 0,6 s, und dann weich
const CALM_GAP = 0.6;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function createFlashCap(gap = FLASH_GAP) {
  let last = -Infinity;
  return {
    // true = dieser Blitz darf zünden (und zählt ab jetzt)
    take(t) {
      // Uhr sprang zurück: lieber einen Blitz auslassen als einen zu viel
      if (t < last) last = t;
      if (t - last < gap) return false;
      last = t;
      return true;
    },
    free: (t) => t >= last && t - last >= gap,
  };
}

/* ---- Party-Zustand ({ k, a, e, d, pal, nf }) → was gezeigt werden darf. t in Sekunden.
   Ein Blitz ist das Aufleuchten bei einem deutlichen Schlag (Kick/Akzent steigt über 0,55) oder beim Einsetzen
   eines Drops (d über 0,85). Jeder muss durch die Schranke; was nicht durchkommt, wird gedeckelt, bis der
   Schlag bzw. Drop wieder abgeklungen ist – so zündet er auch nicht verspätet.
   nf = „Keine Blitze“ (Theme-Einstellung): gar keine Schlag-Spitzen und kein Drop, Energie nur geglättet.
   Zurück kommt eine Kopie mit k, a, e, d, nf (0/1) und
     pulse: dieser Schlag/Drop darf aufleuchten
     beat:  hier darf eine Lampe die Farbe wechseln (ohne nf = pulse, mit nf höchstens alle 0,6 s) */
function createPartyGuard({ gap = FLASH_GAP, calmGap = CALM_GAP } = {}) {
  const cap = createFlashCap(gap), calm = createFlashCap(calmGap);
  let high = false, held = false, dHigh = false, dHeld = false, lastT = null, softK = 0, softE = null;
  return function guard(m, t) {
    const n = (x) => clamp(Number(x) || 0, 0, 1);
    const nf = m?.nf === 1 || m?.nf === true;
    let k = n(m?.k), a = n(m?.a), e = n(m?.e), d = n(m?.d);
    const kk = Math.max(k, a * 0.8);
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 1);
    lastT = t;
    // Flanken mit Abstand zwischen Ein und Aus, damit ein zitternder Pegel nicht als viele Schläge zählt
    const kRise = kk > 0.55 && !high, dRise = d > 0.85 && !dHigh;
    if (kk < 0.4) high = held = false;
    if (kRise) high = true;
    if (d < 0.5) dHigh = dHeld = false;
    if (dRise) dHigh = true;
    // Schlag und Drop im selben Bild sind ein Blitz, nicht zwei
    const ok = !nf && (kRise || dRise) && cap.take(t);
    if (kRise) held = !ok;
    if (dRise) dHeld = !ok;
    const beat = kRise && (nf ? calm.take(t) : ok);
    // geglättete Werte laufen immer mit, damit ein Umschalten von nf nicht springt
    softK += (Math.min(kk, 0.3) - softK) * (1 - Math.exp(-dt / 0.4));
    softE = softE === null ? e : softE + (e - softE) * (1 - Math.exp(-dt / 0.8));
    if (nf) {
      k = softK;
      a = 0;
      d = 0;
      e = softE;
    } else {
      if (held) k = Math.min(k, 0.35), a = Math.min(a, 0.35);
      if (dHeld) d = Math.min(d, 0.8);
    }
    return { ...m, k, a, e, d, nf: nf ? 1 : 0, pulse: ok, beat };
  };
}

module.exports = { createFlashCap, createPartyGuard, FLASH_GAP, CALM_GAP };
