/* ---------------------------------------------------------------- Instrumente am Klang (Wahlfunktion) */
// Ohne Credits weiß Mirage nicht, welche Instrumente spielen. Auf Wunsch (Einstellung „instrSound“, aus)
// rät es zwei davon aus Spotifys Analyse – nur diese zwei, weil sie dort ein eigenes, recht eindeutiges Muster
// haben; Bläser, Streicher, Saxofon … sehen in den drei Klangfarben-Werten aus wie ein Synthesizer.
//  · Klavier: viele angeschlagene Töne (2–10 Einsätze je Sekunde, die Harmonie wechselt), klar tonal, oft
//    Akkorde, kein Schlagzeug-Rauschen. Lange stehende Flächen (Streicher, Pads) haben zu wenige Einsätze,
//    Stimme und Bass allein zu wenige Akkorde. Angeschlagene Akustikgitarre sieht ähnlich aus (bekannte Verwechslung).
//  · Verzerrte Gitarre: Quint-Akkorde („Power Chords“: Grundton + Quinte, kaum andere Töne), laut und nicht
//    sauberer als der Rest des Songs.
// Gezählt wird nur, was mindestens 6 s am Stück so klingt. Ohne Spotify und Fenster – einzeln testbar
// (tests/unit/instrsound.test.js mit künstlichen Segmenten).
const STEP = 0.25;
const WIN = 6; // Sekunden: kürzer zählt nicht
const HEARD = ["piano", "guitar"];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function pct(arr, q) {
  const s = Float32Array.from(arr).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
}

// Merkmale je Segment
function features(segs) {
  const med = (key) => pct(segs.map((s) => s[key]), 0.5);
  // Abstand zum Median in Einheiten der Streuung; nie enger als 15 – sonst bläht ein gleichförmiger Song Kleinigkeiten auf
  const spread = (key) => Math.max(15, pct(segs.map((s) => s[key]), 0.75) - pct(segs.map((s) => s[key]), 0.25));
  // „laut“: nicht unter den leisesten gut 35 % des Songs – bei durchgehend verzerrten Songs ist die Gitarre der Normalfall
  const mf = med("f"), sf = spread("f"), ml = pct(segs.map((s) => s.l), 0.35);
  return segs.map((s, i) => {
    const end = segs[i + 1]?.t ?? s.t + 0.3;
    const dur = clamp(end - s.t, 0.02, 2);
    const p = s.p.length === 12 ? s.p : null;
    if (!p) return { t: s.t, dur, tonal: 0, noisy: false, strong: 0, power: false, zf: 0, loud: false, p: null };
    const mean = p.reduce((a, v) => a + v, 0) / 12;
    const tonal = clamp((1 - mean) * 1.3 - 0.15, 0, 1);
    const strong = p.filter((v) => v >= 0.5).length;
    const top = p.indexOf(Math.max(...p));
    // Grundton und Quinte (oder umgekehrt: Quarte), sonst wenig
    const power = strong <= 4 && p[top] >= 0.9 && Math.max(p[(top + 7) % 12], p[(top + 5) % 12]) >= 0.6;
    const zf = (s.f - mf) / sf;
    return { t: s.t, dur, tonal, noisy: tonal < 0.3 && zf > 0.6, strong, power, zf, loud: s.l >= ml, p };
  });
}

// Wie sehr sich die Tonhöhen von einem Segment zum nächsten ändern (0 = gleich, 1 = ganz anders)
function change(a, b) {
  if (!a || !b) return 0;
  let d = 0;
  for (let i = 0; i < 12; i++) d += Math.abs(a[i] - b[i]);
  return clamp(d / 6, 0, 1);
}

// Ein Fenster [t0, t0 + WIN): Anteile der Zeit, Einsätze je Sekunde, Harmoniewechsel
function judge(fs, from, to, t0) {
  let pianoT = 0, chordT = 0, guitarT = 0, noisyT = 0, tot = 0, n = 0, moves = 0;
  for (let i = from; i < to; i++) {
    const s = fs[i];
    const d = Math.min(s.dur, t0 + WIN - s.t);
    if (d <= 0) continue;
    tot += d;
    n++;
    if (s.noisy) noisyT += d;
    if (s.tonal >= 0.5 && s.strong >= 1 && s.strong <= 5 && s.zf < 0.4) {
      pianoT += d;
      // Akkorde (drei und mehr Tonklassen): Stimme und Bass allein bringen meist nur eine oder zwei
      if (s.strong >= 3) chordT += d;
    }
    // nicht sauberer als der Song im Mittel: Verzerrung rauscht (bei durchgehend verzerrten Songs ist das der Median)
    if (s.power && s.zf > -0.5 && s.loud) guitarT += d;
    if (i > from) moves += change(fs[i - 1].p, s.p);
  }
  if (tot < WIN * 0.8) return { piano: 0, guitar: 0 };
  const rate = n / tot, move = n > 1 ? moves / (n - 1) : 0;
  const fp = pianoT / tot, fg = guitarT / tot, fd = noisyT / tot;
  // Klavier: überwiegend klare Töne, kein Schlagzeug, angeschlagen (genug Einsätze), die Harmonie bewegt sich
  const piano = fp >= 0.7 && chordT >= pianoT * 0.25 && fd <= 0.05 && rate >= 2 && rate <= 10 && move >= 0.2 ? fp : 0;
  // Gitarre: mehr als die Hälfte der Zeit laute, rauschige Quint-Akkorde
  const guitar = fg >= 0.55 ? fg : 0;
  return { piano, guitar };
}

// segs wie in audio.js: { t, l, p[12], b, f, k }. Ergebnis: je Viertelsekunde ein Pegel 0…1 je Instrument.
function heardMoments(segs) {
  const out = { kinds: [] };
  if (!segs?.length || segs.length < 40) return out;
  const fs = features(segs);
  const n = Math.ceil((segs[segs.length - 1].t + 2) / STEP);
  const score = Object.fromEntries(HEARD.map((k) => [k, new Float32Array(n)]));
  // Fenster in Sekundenschritten; jedes gute Fenster markiert seine ganze Länge
  let from = 0;
  const last = fs[fs.length - 1].t;
  for (let t0 = fs[0].t; t0 + WIN <= last + 0.3; t0 += 1) {
    while (from < fs.length && fs[from].t + fs[from].dur <= t0) from++;
    let to = from;
    while (to < fs.length && fs[to].t < t0 + WIN) to++;
    const j = judge(fs, from, to, t0);
    for (const k of HEARD) {
      if (!j[k]) continue;
      for (let x = Math.floor(t0 / STEP); x < Math.min(n, Math.ceil((t0 + WIN) / STEP)); x++) score[k][x] = Math.max(score[k][x], j[k]);
    }
  }
  for (const k of HEARD) {
    const sc = score[k], lv = new Float32Array(n);
    let any = false;
    for (let x = 0; x < n; ) {
      if (!sc[x]) {
        x++;
        continue;
      }
      let y = x;
      while (y < n && sc[y]) y++;
      // mindestens WIN Sekunden am Stück
      if ((y - x) * STEP >= WIN) {
        any = true;
        for (let z = x; z < y; z++) lv[z] = clamp(0.45 + (sc[z] - 0.55) * 1.2, 0.45, 0.9);
      }
      x = y;
    }
    out[k] = lv;
    if (any) out.kinds.push(k);
  }
  return out;
}

export { heardMoments, HEARD, STEP as HEARD_STEP };
