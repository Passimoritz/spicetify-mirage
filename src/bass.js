/* ---------------------------------------------------------------- Tiefe Töne */
// Eigenes Bass-Signal für den Party-Modus, getrennt von der Kick: die Kick-Hülle (party.js kickEnv) klingt in 0,14 s
// aus und kennt nur harte, dunkle Einsätze – eine gehaltene Bass-Linie, eine lang ausklingende 808, ein Orgelpedal oder
// ein Kontrabass ohne Schlagzeug kamen im Bild nicht vor. Testlabor Runde 13 (62 Hörproben, Tiefband < 120 Hz aus dem
// dekodierten Ton als Wahrheit): die Kick-Hülle folgte dem Tiefband mit r = 0,18, in 74 % der Momente mit kräftigem Bass
// zeigte sie nichts. Mit diesem Signal: r = 0,56 aus Spotify-artigen Segmenten (13 % unsichtbar), r = 0,86 im
// Ausschnitt der Hörprobe (8 %); zeitlicher Versatz zum Tiefband −20 ms (Kick-Hülle −90 ms: sie ist schon aus, wenn der Bass noch klingt).
// Ohne Fenster und ohne Spotify – darum einzeln testbar (tests/unit/bass.test.js). Drei Quellen, ehrlich gestuft:
//  1. Spotifys Analyse: kennt keine Frequenzbänder. Am besten sagt den Bass eines Segments „laut und dunkel“ voraus
//     (Lautheit relativ zum Song plus Rang der Helligkeit timbre[1]; Anschlag und Rauschanteil helfen kaum).
//  2. Liegt die Hörprobe sicher im Song (sonic.js alignFor), gilt dort ihr gemessenes Tiefband – echte Bänder statt Schätzung.
//  3. Nur Schätzung (estimate.js) mit Hörprobe: der Takt ist geraten, also kein Zeitverlauf – nur, wie viel Bass der
//     Song hat (Hörprobe), sanft mit Energie und Schlag. Ohne Hörprobe: nichts (wir wissen es nicht).
// Ob der Song überhaupt tiefe Töne hat, sagt die Hörprobe (Anteil des Bands < 150 Hz an der Gesamtenergie): akustische
// Songs ohne Bass, Solo-Violine, A-cappella bekommen kein Bass-Licht, auch wenn ihre lautesten Stellen „dunkel“ sind.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pct = (arr, q) => {
  const s = Float32Array.from(arr).filter(Number.isFinite).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};

// 1. Bass-Stärke je Segment (0..1, relativ zum Song). Gewichte aus einer Regression über 62 Hörproben (Segmente wie
// Spotifys, aus dem Ton gerechnet): Tiefband (dB) ≈ 0,8 · Lautheit − 15,5 · Rang der Helligkeit (je Song r = 0,61)
const SPAN = 12;
const segCache = new WeakMap();
function segBass(segs) {
  if (!segs?.length) return new Float32Array(0);
  if (segCache.has(segs)) return segCache.get(segs);
  const n = segs.length, sb = Float32Array.from(segs, (s) => s.b || 0).sort();
  const rankB = (v) => {
    let a = 0, b = n;
    while (a < b) {
      const m = (a + b) >> 1;
      if (sb[m] < v) a = m + 1;
      else b = m;
    }
    return a / n;
  };
  // keine Klangfarbe in der Analyse (alle Helligkeiten gleich, z. B. fehlende timbre-Werte): dann wissen wir nichts
  if (sb[Math.floor(n * 0.9)] - sb[Math.floor(n * 0.1)] < 1e-6) {
    const none = new Float32Array(n);
    segCache.set(segs, none);
    return none;
  }
  const lhi = pct(segs.map((s) => s.l), 0.95);
  const pred = Float32Array.from(segs, (s) => 0.8 * (s.l - lhi) - 15.5 * rankB(s.b || 0));
  const top = pct(pred, 0.97);
  const out = Float32Array.from(pred, (v) => Math.round(clamp((v - (top - SPAN)) / SPAN, 0, 1) * 1000) / 1000);
  segCache.set(segs, out);
  return out;
}

// 2./3. Was die Hörprobe über den Bass sagt (aus dem Raster von sonic.js createFrameSink, Bänder in dB):
// share = Anteil des Bands < 150 Hz (Median über die hörbaren Stellen, dB), gate = 0..1 (−12 dB → 0, −6 dB → 1),
// lvl = Tiefband je Rasterzelle (0..255, 18 dB unter dem lauten Bass = 0), r = Zellen je Sekunde
function bassProfile(G) {
  if (!G?.bands || !(G.n >= G.r * 8)) return null;
  const lm = pct(G.loud, 0.5), rel = [], lows = [];
  for (let x = 0; x < G.n; x++) {
    if (!(G.loud[x] > lm - 15)) continue;
    rel.push(G.low[x] - G.loud[x]);
    lows.push(G.low[x]);
  }
  if (rel.length < G.r * 4) return null;
  const share = pct(rel, 0.5), hi = pct(lows, 0.95);
  const lvl = new Uint8Array(G.n);
  for (let x = 0; x < G.n; x++) lvl[x] = Math.round(255 * clamp((G.low[x] - (hi - 18)) / 18, 0, 1));
  return { share: Math.round(share * 10) / 10, gate: gateOf(share), r: G.r, n: G.n, lvl };
}
const gateOf = (share) => Math.round(clamp((share + 12) / 6, 0, 1) * 100) / 100;

// Zielwert je Bild (vor dem Glätten). d: Taktdaten (audio.js) · prof: bassProfile der Hörprobe oder null ·
// al: Lage der Hörprobe im Song ({ off, end }) oder null · energy 0..1 · since: Sekunden seit dem letzten Schlag
// Rückgabe { v, src }: src "spotify", "preview" (gemessen), "estimate" (nur Charakter) oder ""
function bassTarget(sec, d, prof, al, energy = 0.5, since = 9) {
  if (!d?.segs?.length) return { v: 0, src: "" };
  const gate = prof ? prof.gate : 0.7;
  if (d.synthetic) {
    // Takt geraten: nur der Charakter des Songs, ruhig atmend – ohne Hörprobe nichts
    if (!prof || !gate) return { v: 0, src: "" };
    return { v: gate * (0.25 + 0.55 * clamp(energy, 0, 1)) * (0.7 + 0.3 * Math.exp(-since * 4)), src: "estimate" };
  }
  const segs = d.segs, L = segBass(segs);
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (segs[m].t <= sec) lo = m;
    else hi = m - 1;
  }
  let v = sec >= segs[0].t ? L[lo] * gate : 0, src = "spotify";
  if (prof?.lvl && al && sec >= al.off && sec < al.end) {
    const x = Math.floor((sec - al.off) * prof.r);
    if (x >= 0 && x < prof.lvl.length) {
      // an den Rändern der Hörprobe 1 s weich überblenden
      const w = clamp(Math.min(sec - al.off, al.end - sec), 0, 1);
      v = v * (1 - w) + (prof.lvl[x] / 255) * gate * w;
      src = "preview";
    }
  }
  return { v, src };
}

// Glätten wie ein Pegel: schnell hoch (Einsatz sitzt), gemächlich runter (eine gehaltene Note bleibt sichtbar, eine
// 808 klingt sichtbar aus). pulse: kurzer Stoß, wenn ein neuer tiefer Ton deutlich einsetzt (Bass-Anschlag, 808, Pedal).
function createBassEnv() {
  let lv = 0, last = 0, pulse = 0;
  return {
    step(target, dt) {
      dt = clamp(dt || 0, 0, 0.25);
      const rise = target - last;
      last = target;
      if (rise > 0.25) pulse = Math.max(pulse, clamp(target, 0, 1));
      pulse *= Math.exp(-dt * 6);
      if (pulse < 0.01) pulse = 0;
      lv += (target - lv) * (1 - Math.exp(-dt / (target > lv ? 0.035 : 0.12)));
      if (lv < 0.005) lv = 0;
      return { bass: lv, pulse };
    },
    reset() {
      lv = last = pulse = 0;
    },
  };
}

export { segBass, bassProfile, bassTarget, createBassEnv, gateOf };
