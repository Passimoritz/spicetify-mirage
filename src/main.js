// Mirage – the living layer behind the glass.
// Pulls colours from the album art, puts a cover haze + aurora + light dust behind the UI,
// pulses on the beat, adds the immersive mode (cover · lyrics · visualizer) and reports
// song changes to the Mirage Overlay app (announcements outside of Spotify).
// Source: src/*.js – bundled into Mirage/theme.js with `npm run build`.
(function boot() {
  const S = window.Spicetify;
  if (!S?.Player?.addEventListener || !S?.Platform || !S?.CosmosAsync || !document.body) {
    setTimeout(boot, 300);
    return;
  }
  if (window.__mirage) return;
  window.__mirage = true;
  // erst jetzt laden: die Module greifen beim Auswerten auf Spicetify und das DOM zu
  // danach die Notiz nach Spotify-Updates (src/updnote.js); bricht sie ab, läuft alles andere weiter
  // 1.27 perf: in einer eigenen Aufgabe (setTimeout 0) statt direkt im Anschluss an das Übersetzen der 2,8 MB:
  // Übersetzen und Starten der Module waren zusammen eine lange Aufgabe von 40–55 ms, jetzt sind es zwei kurze,
  // und Spotify kommt dazwischen zum Zeichnen und für Eingaben dran
  setTimeout(() => {
    // Start fehlgeschlagen (etwa nach einem Spotify-Update): nicht stumm halb gestylt bleiben, sondern es sagen
    const failed = (e) => {
      console.error("[Mirage]", e);
      try {
        S.showNotification?.("Mirage could not start: " + (e?.message || e), true, 10000);
      } catch {}
    };
    import("./app.js").then(() => import("./updnote.js").catch(() => {}), failed);
    // Mini-Player-Fenster (Bild im Bild) bekommt Mirages Regeln und Farben
    import("./pip.js").catch((e) => console.error("[Mirage]", e));
  }, 0);
})();
