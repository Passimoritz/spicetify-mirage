import { createVenue } from "./venue.js";

/* ---------------------------------------------------------------- Party-Location im Hintergrund-Thread */
// Bekommt einmal das OffscreenCanvas und danach pro Bild den Zustand – zeichnet Bühnenlicht, Dekor und
// Publikum, ohne das Hauptfenster (Liedtext, Knöpfe, Spotify) aufzuhalten.
// Taktung: der Thread zeichnet im eigenen Bildtakt (requestAnimationFrame im Thread), immer den neuesten Zustand.
// Kommen zwei Zustände zwischen zwei Bildern an, werden sie zusammengelegt (Zeit addiert, einmalige Signale wie
// Drop/Treffer/Blitz-Freigabe bleiben erhalten) – statt dass das Hauptfenster Bilder auslässt, während der Thread
// noch zeichnet (das gab ungleichmäßige Abstände, besonders beim Szenenwechsel, dem schwersten Bild).
// Ohne requestAnimationFrame im Thread: zeichnen, sobald ein Zustand ankommt (wie bisher).
const venue = createVenue((w, h) => new OffscreenCanvas(w, h));
const paced = typeof self.requestAnimationFrame === "function";
let canvas = null, ctx = null, pending = null, queued = false;
function draw() {
  queued = false;
  const st = pending;
  pending = null;
  if (!st || !ctx) return;
  if (canvas.width !== st.vw || canvas.height !== st.vh) {
    canvas.width = st.vw;
    canvas.height = st.vh;
  }
  venue.draw(ctx, st);
  // fertig: das Hauptfenster weiß damit, dass der Thread mitkommt
  self.postMessage({ type: "done" });
}
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    canvas = m.canvas;
    ctx = canvas.getContext("2d");
    self.postMessage({ type: "ready", paced });
  } else if (m.type === "frame" && ctx) {
    const st = m.st;
    if (pending) {
      st.dt = Math.min(0.1, (st.dt || 0) + (pending.dt || 0));
      st.px.dropHit ||= !!pending.px?.dropHit;
      st.px.hit ||= !!pending.px?.hit;
      st.flashGo ||= !!pending.flashGo;
    }
    pending = st;
    if (!paced) return draw();
    if (!queued) {
      queued = true;
      self.requestAnimationFrame(draw);
    }
  } else if (m.type === "clear" && ctx) {
    pending = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
};
