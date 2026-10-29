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
  import("./app.js");
})();
