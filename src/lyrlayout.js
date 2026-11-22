/* ---------------------------------------------------------------- Liedtext: was gezeigt wird, wann das Layout umschaltet */
// Früher konnte ein späteres „Instrumental“ (z. B. von NetEase) einen schon gezeigten Text verdrängen – Party sprang
// ins Layout ohne Liedtext und mit dem Wort-für-Wort-Text wieder zurück. Jetzt:
//  · „Instrumental“ oder „nichts“ ersetzt nie einen gezeigten Text
//  · das Layout (mit/ohne Liedtext) wechselt je Song höchstens einmal; spätere, bessere Ergebnisse tauschen nur
//    den Text – außer zeitgenauer Text kommt, nachdem schon auf „ohne Liedtext“ gewechselt wurde
const hasText = (l) => !!l && !l.instrumental && !!l.lines?.length;

// Soll got das gezeigte Ergebnis ersetzen? (shown === undefined: noch nichts gezeigt)
function takeLyrics(shown, got) {
  if (shown === undefined) return true;
  if (!got || got === shown) return false;
  return !(hasText(shown) && !hasText(got));
}

// Layout-Wächter je Song: next(uri, got, noLyrNow) → gewünschter Zustand „ohne Liedtext“ (true/false)
function createLayoutGate() {
  let uri = "", decided = false, back = false;
  return {
    next(u, got, now) {
      if (u !== uri) [uri, decided, back] = [u, false, false];
      const want = !hasText(got);
      // das erste Ergebnis des Songs entscheidet (der eine Wechsel – oder keiner, wenn das Layout schon passt)
      if (!decided) {
        decided = true;
        return want;
      }
      if (want === now) return now;
      // Ausnahme: zeitgenauer Text, während das Layout „ohne Liedtext“ zeigt – einmal zurück
      if (now && !want && got.synced && !back) {
        back = true;
        return false;
      }
      return now;
    },
    // neu laden (andere Fassung gewählt, Text als falsch gemeldet): der Song darf wieder einmal wechseln
    reset() {
      uri = "";
    },
  };
}

export { hasText, takeLyrics, createLayoutGate };
