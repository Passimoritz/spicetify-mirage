/* ---------------------------------------------------------------- Songzeit für den Liedtext */
// Kleine Regeln, damit die angezeigte Zeile nicht zappelt. Ohne Spotify: einzeln testbar (tests/unit/songtime.test.js).

// Direkt nach einem Songwechsel meldet Spotify oft noch einen Augenblick die Position des ALTEN Songs:
// der neue Liedtext sprang dann kurz ans Ende und zurück. Solange die Meldung (bis 1,5 s nach dem Wechsel)
// noch beim alten Wert liegt, gilt der neue Song als am Anfang.
function freshPos(raw, oldRaw, sinceSwitch) {
  if (sinceSwitch < 1500 && oldRaw > 3000 && Math.abs(raw - oldRaw) < 1500) return 0;
  return raw;
}

// Aktive Zeile: letzte Zeile mit t <= pos. Kleine Rücksprünge der Uhr (Pause, Nachjustieren, die Uhr holt
// eine Abweichung ein) lassen die eben begonnene Zeile stehen; echte Sprünge (Spulen) gehen sofort durch.
function lineAt(lines, pos, prev, hold = 250) {
  let lo = 0, hi = lines.length - 1, i = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (lines[m].t <= pos) {
      i = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  if (prev >= 0 && prev < lines.length && i === prev - 1 && lines[prev].t - pos < hold) return prev;
  return i;
}

export { freshPos, lineAt };
