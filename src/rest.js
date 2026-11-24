/* ---------------------------------------------------------------- Zierde ruht */
// Die kleinen Dauer-Animationen auf Spotifys Seiten (Vinyl-Cover, schwebendes Cover rechts, Immersiv-Knopf, Lichtsaum
// der Insel, Farbstrom der laufenden Zeile) laufen sonst ohne Ende. Gemessen (tools/theme-perf.js, Leerlauf auf einer
// Playlist): jedes Hintergrundbild zieht sie durch Stil und Zeichnen, allein das Vinyl ~17 ms je Sekunde im
// Hauptthread, alle zusammen gut die Hälfte der Leerlauf-Last. Darum ruhen sie, solange niemand hinsieht:
// Spotify ist nicht das aktive Fenster (Musik läuft im Hintergrund, man arbeitet woanders) oder seit REST_IDLE_MS
// keine Eingabe. Bei der ersten Bewegung, Taste oder beim Zurückholen des Fensters laufen sie weiter, wo sie standen.
// (Minimiert oder ganz verdeckt hält perf.js mit mirage-hidden ohnehin alles an.)
const REST_IDLE_MS = 90000;

// ruht die Zierde? focused: Spotify ist das aktive Fenster; lastInput/now in ms
function resting({ focused, lastInput, now, idleMs = REST_IDLE_MS }) {
  return !focused || now - lastInput >= idleMs;
}
// wann frühestens wieder nachsehen (ms ab jetzt), solange sie nicht ruht; -1: kein Wecker nötig (ruht schon)
function nextCheck({ focused, lastInput, now, idleMs = REST_IDLE_MS }) {
  if (resting({ focused, lastInput, now, idleMs })) return -1;
  return Math.max(250, lastInput + idleMs - now);
}

// Verdrahtung: Klasse mirage-rest am <html>. Eingaben merken sich nur die Zeit (kein Umschalten je Ereignis);
// geschaltet wird nur beim Wechsel – eine Klasse am <html> lässt Chromium nur die Elemente der passenden Regeln
// neu berechnen, nicht die ganze Seite.
function startRest(root, { idleMs = REST_IDLE_MS, win = window, doc = document } = {}) {
  let lastInput = performance.now(), timer = 0, on = root.classList.contains("mirage-rest");
  const focused = () => {
    try {
      return doc.hasFocus();
    } catch {
      return true;
    }
  };
  const apply = () => {
    clearTimeout(timer);
    timer = 0;
    const st = { focused: focused(), lastInput, now: performance.now(), idleMs };
    const want = resting(st);
    if (want !== on) root.classList.toggle("mirage-rest", (on = want));
    const next = nextCheck(st);
    if (next >= 0) timer = setTimeout(apply, next);
  };
  const input = () => {
    lastInput = performance.now();
    // nur wenn sie gerade ruht, sofort wecken; sonst reicht der Wecker
    if (on) apply();
  };
  for (const ev of ["pointermove", "pointerdown", "keydown", "wheel"]) doc.addEventListener(ev, input, { passive: true, capture: true });
  win.addEventListener("focus", () => {
    lastInput = performance.now();
    apply();
  });
  win.addEventListener("blur", apply);
  apply();
  return { apply, stop: () => clearTimeout(timer) };
}

export { REST_IDLE_MS, resting, nextCheck, startRest };
