/* ---------------------------------------------------------------- Sprünge im Song glätten */
// Spulen, Scrubben, Songwechsel und Ansichtswechsel setzen die Songzeit hart um. Alles, was rein aus der
// Songzeit berechnet wird (Bewegungsuhr der Regie, Schlag-Uhr, Look des Teils), sprang dann im selben Bild:
// Kranz und Scheinwerfer rissen um eine Drehung weiter, Licht und Farben schalteten hart um – das wirkte
// wie Ruckeln, auch wenn kein Bild verloren ging. Hier werden die Sprünge zu weichen Übergängen.
// Ohne Spotify und ohne Fenster: einzeln testbar (tests/unit/steady.test.js).

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (x) => x * x * (3 - 2 * x);
// was je Bild noch normales Weiterlaufen ist: höchstens maxRate × Zeit, dazu etwas Spiel für Zittern
const plausible = (d, dt, maxRate, slack) => Number.isFinite(d) && d >= -slack && d <= dt * maxRate + slack;

// Bewegungsuhr (Sekunden, nur Phase – nichts muss auf dem Takt liegen): läuft nur in plausiblen Schritten
// weiter. Bei einem Sprung geht es im bisherigen Tempo weiter, als wäre nichts gewesen.
// Mehrfach im selben Bild gefragt (Mix: Party-Spuren und Regie) → derselbe Wert, kein doppelter Schritt.
function createSteadyClock(maxRate = 4) {
  let raw = NaN, out = NaN, at = NaN, rate = 1;
  return (x, now) => {
    if (now === at) return out;
    const dt = Number.isFinite(at) ? clamp((now - at) / 1000, 0, 0.25) : 0;
    at = now;
    if (!Number.isFinite(x)) return Number.isFinite(out) ? out : 0;
    if (!Number.isFinite(out)) [raw, out] = [x, x];
    const d = x - raw;
    raw = x;
    if (plausible(d, dt, maxRate, 0.05)) {
      out += Math.max(0, d);
      if (dt > 0) rate += (clamp(d / dt, 0, maxRate) - rate) * Math.min(1, dt * 3);
    } else out += dt * rate;
    return out;
  };
}

// Schlag-Uhr (in Schlägen): Lichtmuster sitzen auf dem Schlag, darum bleibt sie an der Songzeit. Ein Sprung
// wird zum Versatz, der in ~1 s auf ganze Takte (snap Schläge) gleitet – danach sitzt alles wieder genau auf
// dem Schlag, ohne dass ein Muster umspringt.
function createBeatClock(snap = 4, tau = 0.3, maxRate = 8) {
  let raw = NaN, out = NaN, at = NaN, rate = 0, off = 0;
  return (x, now) => {
    if (now === at) return out;
    const dt = Number.isFinite(at) ? clamp((now - at) / 1000, 0, 0.25) : 0;
    at = now;
    if (!Number.isFinite(x)) return Number.isFinite(out) ? out : 0;
    if (!Number.isFinite(out)) [raw, out] = [x, x];
    const d = x - raw;
    raw = x;
    if (plausible(d, dt, maxRate, 0.5)) {
      if (dt > 0) rate += (clamp(d / dt, 0, maxRate) - rate) * Math.min(1, dt * 3);
    } else off = out + dt * rate - x;
    const goal = Math.round(off / snap) * snap;
    off = goal + (off - goal) * Math.exp(-dt / tau);
    if (Math.abs(off - goal) < 1e-3) off = goal;
    out = x + off;
    return out;
  };
}

// Look der Regie (cue) nach einem Sprung: vom zuletzt gezeigten Zustand in den neuen gleiten statt umschalten.
// a = gezeigter Zustand vor dem Sprung, b = neuer, e = 0..1. Das Bühnenlicht blendet über (spot2 → spot),
// Zahlen gleiten, die Farbkorrektur in denselben groben Stufen wie in der Regie (sonst jedes Bild neue Farben).
const NUM = ["I", "speed", "beams", "sparks", "fx", "haze", "soft", "spread", "crowd", "v", "a", "swell", "pump", "boom", "sync", "scan"];
const GRADE = { sat: 0.04, con: 0.04, warm: 0.05, hue: 6, th: 6, tk: 0.05, lum: 0.02, sh: 6 };
let gradeLast = null;
// ohne Farbkorrektur (null, z. B. noch keine Taktdaten) = neutral: auch dorthin wird geglitten
const PLAIN = { sat: 1, con: 1, warm: 0, hue: 0, th: 0, tk: 0, lum: 0, sh: 0 };
function glideGrade(ga, gb, e) {
  if (ga === gb || e >= 1 || (!ga && !gb)) return gb;
  [ga, gb] = [ga || { ...PLAIN, th: gb.th }, gb || { ...PLAIN, th: ga.th }];
  const g = {};
  for (const [k, s] of Object.entries(GRADE)) {
    const x = ga[k] || 0, y = gb[k] || 0;
    // Farbwelt (th) ist ein Winkel: über den kürzeren Weg
    const v = k === "th" ? (x + ((((y - x) % 360) + 540) % 360 - 180) * e + 360) % 360 : x + (y - x) * e;
    g[k] = Math.round(v / s) * s;
  }
  if (gradeLast && Object.keys(GRADE).every((k) => gradeLast[k] === g[k])) return gradeLast;
  return (gradeLast = g);
}
function glideCue(a, b, e) {
  if (!a || !b || e >= 1) return b;
  const o = { ...b };
  for (const k of NUM) if (Number.isFinite(a[k]) && Number.isFinite(b[k])) o[k] = a[k] + (b[k] - a[k]) * e;
  o.grade = glideGrade(a.grade, b.grade, e);
  // das Licht, das gerade überwiegend zu sehen war, blendet aus
  const was = (a.sx ?? 1) >= 0.5 ? a.spot : a.spot2;
  if ((was || "") !== (b.spot || "")) [o.spot2, o.sx] = [was || "", Math.min(b.sx ?? 1, e)];
  return o;
}

// Sprung erkennen: rückwärts (mehr als ein Nachjustieren der Uhr) oder deutlich weiter als die vergangene Zeit
const isJump = (sec, last, dt) => Number.isFinite(last) && (sec < last - 0.25 || sec - last > 0.5 + dt * 2);

// Überblendung nach einem Sprung: start() bei jedem Sprung (auch mitten in einer laufenden), apply() je Bild
function createJumpFade(dur = 0.6) {
  let from = null, t0 = 0, shown = null;
  return {
    start(t) {
      if (shown) [from, t0] = [shown, t];
    },
    apply(C, t) {
      let out = C;
      if (from) {
        const f = (t - t0) / dur;
        if (f >= 1 || f < 0) from = null;
        else out = glideCue(from, C, ease(clamp(f, 0, 1)));
      }
      shown = out;
      return out;
    },
    reset() {
      from = shown = null;
    },
  };
}

export { createSteadyClock, createBeatClock, glideCue, glideGrade, isJump, createJumpFade };
