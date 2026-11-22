/* ---------------------------------------------------------------- Hüllen, Rauschen und Takt für die Bühnenbilder */
// Gemeinsame kleine Bausteine für show.js, instfx.js, stagefx.js und venue.js (laufen auch im Hintergrund-Thread):
// · eine Hülle für alle Effekte: nie ein harter Einsatz (mindestens 80 ms Anstieg), weiches Ausklingen
// · ruhiges, festes Rauschen statt Math.random je Bild (dasselbe Bild bei derselben Zeit, kein Flimmern)
// · glatte Kurven (Ein-/Ausgleiten) und Verläufe mit vielen Stufen (keine Ringe oder Kanten im Licht)
// · die Bildrate als ganzzahliger Teiler der Bildschirmrate (gleichmäßige Abstände statt Ruckeln)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
// weiches Gleiten hinein und hinaus (wie smooth, nur etwas runder in der Mitte)
const easeInOut = (x) => {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
// Glocke 0..1..0 über x = 0..1 mit flachen Enden (keine Kante beim Ein- und Ausblenden)
const bell = (x) => (x <= 0 || x >= 1 ? 0 : 0.5 - 0.5 * Math.cos(2 * Math.PI * x));

// Hülle eines Effekts nach seinem Alter (s): Anstieg über atk (mindestens 80 ms, weich), Halten,
// dann über rel weich aus. dur = Gesamtdauer (Infinity = bis zum Ende offen, nur der Anstieg zählt)
const ATK_MIN = 0.08;
function envAR(age, dur = Infinity, atk = ATK_MIN, rel = 0.25) {
  if (!(age >= 0)) return 0;
  const a = smooth(age / Math.max(ATK_MIN, atk));
  if (!Number.isFinite(dur)) return a;
  return a * smooth((dur - age) / Math.max(0.001, rel));
}

// Begrenzer für fremde Hüllen (0..1, z. B. aus dem Klang-Detektor): steigt höchstens in atk Sekunden von 0 auf 1,
// fällt weich mit der Zeitkonstante rel. state = { v } (je Effekt eins), gibt den geglätteten Wert zurück.
function slew(state, target, dt, atk = ATK_MIN, rel = 0.12) {
  const v = state.v || 0, d = Math.max(0, Math.min(0.1, dt || 0));
  if (target > v) state.v = Math.min(target, v + d / Math.max(ATK_MIN, atk));
  else state.v = v + (target - v) * (1 - Math.exp(-d / Math.max(0.001, rel)));
  return state.v;
}

// fester Zufall je Index (0..1)
const hash = (i, s) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
// zusammenhängendes Rauschen (0..1): gleitet zwischen festen Zufallswerten, statt je Bild neu zu würfeln
function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i, seed) + (hash(i + 1, seed) - hash(i, seed)) * u;
}

// Tiefpass in Sekunden (Zeitkonstante tau)
const lowpass = (prev, target, dt, tau) => prev + (target - prev) * (1 - Math.exp(-Math.max(0, dt) / Math.max(1e-3, tau)));
// dasselbe für Winkel in Grad (kürzester Weg über 0/360)
function lowpassHue(prev, target, dt, tau) {
  const d = ((((target - prev) % 360) + 540) % 360) - 180;
  return (((prev + d * (1 - Math.exp(-Math.max(0, dt) / Math.max(1e-3, tau)))) % 360) + 360) % 360;
}

// Farbverlauf mit vielen Stufen: profile(u) für u = 0..1 (Deckkraft relativ), n Stufen (mindestens 8) –
// statt 2–3 Stufen, zwischen denen das Auge Kanten und Ringe sieht
function addStops(g, col, a, profile, n = 9, rgba) {
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    g.addColorStop(u, rgba(col, a * profile(u)));
  }
  return g;
}
// weiche Lichtglocke quer zur Kante (für Lichtwisch und Kegel): 1 in der Mitte, 0 an den Rändern, flache Enden
const bellProfile = (u) => {
  const x = Math.abs(u - 0.5) * 2;
  return Math.pow(0.5 + 0.5 * Math.cos(Math.PI * clamp(x, 0, 1)), 1.4);
};
// Abfall nach außen (Kegel, Bodenlicht): 1 am Ursprung, flach auslaufend
const fallProfile = (u) => (1 - u) * (1 - u * u);

// Lichtwisch beim Teilwechsel: Lage (0..1 über die Bühne) und Deckkraft zu x = 0..1 – gleitet ein und aus
// statt mit fester Geschwindigkeit, blendet über die ersten und letzten 15 % weich ein und aus
function wipeAt(x) {
  const p = clamp(x, 0, 1);
  // (smoothstep: in der Mitte nur 1,5× so schnell wie gleichmäßig – ein kubisches Ein-/Ausgleiten wäre dort 3× so schnell)
  return { pos: smooth(p), alpha: smooth(p / 0.15) * smooth((1 - p) / 0.15) };
}
// Dauer des Lichtwischs: zwei Schläge, mindestens 0,8 s (ein Schlag war zu schnell – ~90 px je Bild)
const wipeDur = (beat) => Math.max(0.8, 2 * (beat || 0.5));

// Bildrate als ganzzahliger Teiler der Bildschirmrate: jedes d-te Bild zeichnen. Bevorzugt die höhere Rate, solange
// sie höchstens 25 % über der Obergrenze liegt (75 Hz bei 60 → jedes Bild statt 37,5; 144 Hz bei 60 → 72)
function fpsDivisor(hz, cap) {
  if (!cap || !(hz > 0)) return 1;
  const lo = Math.max(1, Math.floor(hz / cap));
  return hz / lo <= cap * 1.25 ? lo : lo + 1;
}
// Bildschirmrate aus den Abständen der Bildaufrufe (Median, gerundet auf übliche Raten)
const RATES = [30, 48, 50, 60, 72, 75, 85, 90, 100, 120, 144, 165, 170, 180, 200, 240, 360];
function refreshFrom(deltas) {
  const ok = deltas.filter((d) => d > 2 && d < 50).sort((a, b) => a - b);
  if (ok.length < 10) return 0;
  const hz = 1000 / ok[ok.length >> 1];
  let best = 0, err = Infinity;
  for (const r of RATES) {
    const e = Math.abs(r - hz) / r;
    if (e < err) [best, err] = [r, e];
  }
  return err < 0.06 ? best : Math.round(hz);
}

export { clamp, smooth, easeInOut, bell, envAR, slew, hash, vnoise, lowpass, lowpassHue, addStops, bellProfile, fallProfile, wipeAt, wipeDur, fpsDivisor, refreshFrom, ATK_MIN };
