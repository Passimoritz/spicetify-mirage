import { createVenue } from "./venue.js";

/* ---------------------------------------------------------------- Party-Location im Hintergrund-Thread */
// Bekommt einmal das OffscreenCanvas und danach pro Bild den Zustand – zeichnet Bühnenlicht, Dekor und
// Publikum, ohne das Hauptfenster (Liedtext, Knöpfe, Spotify) aufzuhalten.
const venue = createVenue((w, h) => new OffscreenCanvas(w, h));
let canvas = null, ctx = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    canvas = m.canvas;
    ctx = canvas.getContext("2d");
  } else if (m.type === "frame" && ctx) {
    if (canvas.width !== m.st.vw || canvas.height !== m.st.vh) {
      canvas.width = m.st.vw;
      canvas.height = m.st.vh;
    }
    venue.draw(ctx, m.st);
    // für den 10-Sekunden-Clip: eine Kopie des Bildes zurück ins Hauptfenster
    if (m.grab) createImageBitmap(canvas).then((b) => self.postMessage({ type: "bitmap", b }, [b]), () => {});
  } else if (m.type === "clear" && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
};
