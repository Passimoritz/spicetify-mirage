/* ---------------------------------------------------------------- Obergrenze für Blitze */
// Fotosensible Epilepsie: mehr als drei Blitze pro Sekunde gelten als riskant (WCAG 2.3.1).
// Der Mindestabstand von 0,34 s lässt in jedem Fenster von einer Sekunde höchstens drei Blitze zu.
//
// So hängt es zusammen:
// - Das eine Budget liegt im Hauptthread (party.js, createFlashBudget). Jeder großflächige Blitz des Party-Modus
//   braucht seine Freigabe: die Farbfläche (party.step), die Bühne (Blinder, Lichtwand, Stroboskop, Gitarrenblitze,
//   weißer Drop – über st.flashGo), die Blitze der Bühnenbilder (Gewitter, Schüsse, Blitz – immersive.js bittet zum
//   Blitz-Zeitpunkt um Freigabe, createCueFlash) und die Wortbilder (words.js, st.takeFlash).
// - Was im selben Bild freigegeben wird, zählt als ein Blitz (es leuchtet gemeinsam auf).
// - Die Bühne (venue.js, meist im Hintergrund-Thread) hat dazu eine eigene Schranke als zweite Sicherung: sie zündet
//   nur mit Freigabe UND eigener Schranke – falls eine Freigabe doppelt ankommt oder Bilder zusammengelegt werden.
// - Ohne Hauptthread (Unit-Tests, TV-Ansicht) gilt die jeweils eigene Schranke allein.
// „Keine Blitze“ nimmt alle heraus, egal was das Budget sagt.
const FLASH_GAP = 0.34;
function createFlashCap(gap = FLASH_GAP) {
  let last = -Infinity;
  return {
    // true = dieser Blitz darf zünden (und zählt ab jetzt)
    take(t) {
      // Uhr sprang zurück (neuer Song, neuer Thread): lieber einen Blitz auslassen als einen zu viel
      if (t < last) last = t;
      if (t - last < gap) return false;
      last = t;
      return true;
    },
    free: (t) => t >= last && t - last >= gap,
  };
}

// Das Budget des Hauptthreads: eine Schranke, mehrere Frager. frame() beginnt ein Bild; take(t) gibt frei, wenn die
// Schranke es erlaubt – oder wenn dieses Bild schon eine Freigabe hat (derselbe Blitz, nicht ein weiterer).
// Bleibt frame() aus (die Party rechnet gerade nicht), verfällt die Freigabe nach 50 ms von selbst.
function createFlashBudget(cap = createFlashCap(), wall = () => performance.now()) {
  let go = false, at = -1e9;
  return {
    frame() {
      go = false;
    },
    take(t) {
      if (go && wall() - at < 50) return true;
      go = cap.take(t);
      if (go) at = wall();
      return go;
    },
  };
}

// Blitz-Zeitpunkte der Bühnenbilder (s nach Beginn der Antwort): scenefx.js/stagefx.js zeichnen danach,
// der Hauptthread bittet zu denselben Zeitpunkten um Freigabe
const FLASH_AT = {
  bolt: [0],
  thunder: [0.5, 2.2],
  muzzle: [0, 1, 2].map((i) => i * 0.38),
  rapid: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => i * 0.14),
};
const flashTimes = (c) => (c.f === "muzzle" && c.from === "rapid" ? FLASH_AT.rapid : FLASH_AT[c.f]) || null;
// So lange bittet der Hauptthread für einen Zeitpunkt um Freigabe (FLASH_ASK), so lange hält die Bühne ihn offen
// (FLASH_WAIT, etwas länger: Bilder kommen im Hintergrund-Thread versetzt oder zusammengelegt an) – danach weiches Glühen
const FLASH_ASK = 0.08, FLASH_WAIT = 0.12;

// Hauptthread: für laufende Antworten (scenarios.js), deren Blitz-Zeitpunkt gerade erreicht ist, um Freigabe bitten.
// ask(cues, t, take) → true, wenn dieses Bild eine Freigabe für die Bühne hat. Jeder Zeitpunkt wird höchstens einmal
// freigegeben; weiche Antworten (cue.soft: „Keine Blitze“ oder Blitze aus) fragen nie.
function createCueFlash() {
  const done = new Set();
  return function ask(cues, t, take) {
    let go = false;
    if (!cues) return go;
    for (const c of cues) {
      const T = c.soft ? null : flashTimes(c);
      if (!T) continue;
      for (let i = 0; i < T.length; i++) {
        const d = t - c.t0 - T[i], key = c.seq * 16 + i;
        if (d < 0 || d >= FLASH_ASK || done.has(key) || !take()) continue;
        if (done.size > 32) done.delete(done.values().next().value);
        done.add(key);
        go = true;
      }
    }
    return go;
  };
}

export { createFlashCap, createFlashBudget, createCueFlash, flashTimes, FLASH_GAP, FLASH_AT, FLASH_ASK, FLASH_WAIT };
