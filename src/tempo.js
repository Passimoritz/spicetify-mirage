/* ---------------------------------------------------------------- Tempo aus einer Hörprobe */
// Spotify liefert für viele Songs keine Taktanalyse und keine Audio-Merkmale mehr, Deezers Tempo-Feld ist bei
// den meisten Songs 0 (Stichprobe November 2026: 17 von 25 Chart-Songs). Was es fast immer gibt: die offizielle
// 30-s-Hörprobe bei Deezer oder iTunes. Aus ihr schätzt Mirage das Tempo selbst – nur gerechnet, nie abgespielt.
// Weg: Einsatz-Kurve (spektraler Fluss, ~86 Bilder/s) → Autokorrelation → bestes Tempo mit leichter Vorliebe
// für 120 BPM (wie librosa) und Prüfung der Oktave (halbes/doppeltes Tempo) über die Obertöne der Kurve.
// Die Lage des Schlags in der Hörprobe hilft nicht weiter (wo die Probe im Song liegt, ist unbekannt) – nur das Tempo.
// Dazu ein paar Klangzahlen für die Genre-Schätzung: wie dicht die Einsätze sind, wie viel Bass, wie hell, wie laut.

const HOP = 256, N = 1024;

// kleine Radix-2-FFT (in place), nur für N = 1024
const fftTables = (() => {
  const rev = new Uint16Array(N), cos = new Float32Array(N / 2), sin = new Float32Array(N / 2), win = new Float32Array(N);
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  }
  for (let i = 0; i < N / 2; i++) [cos[i], sin[i]] = [Math.cos((2 * Math.PI * i) / N), -Math.sin((2 * Math.PI * i) / N)];
  return { rev, cos, sin, win };
})();
function fft(re, im) {
  const { rev, cos, sin } = fftTables;
  for (let i = 0; i < N; i++) {
    const j = rev[i];
    if (j > i) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let i = 0; i < N; i += size) {
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half, c = cos[k * step], s = sin[k * step];
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

// Einsatz-Kurve: positiver Zuwachs der log-Beträge je Frequenzband (Mel-ähnlich gruppiert), dazu Klangzahlen.
// pause(): optional, wird alle paar hundert Bilder abgewartet – im Browser bleibt so kein Bild hängen.
async function onsetEnvelope(pcm, sr, pause) {
  const frames = Math.max(0, Math.floor((pcm.length - N) / HOP));
  const env = new Float32Array(frames), low = new Float32Array(frames);
  // 24 Bänder, logarithmisch von 40 Hz bis 8 kHz
  const binHz = sr / N, edges = [];
  for (let b = 0; b <= 24; b++) edges.push(Math.max(1, Math.round((40 * Math.pow(200, b / 24)) / binHz)));
  const re = new Float32Array(N), im = new Float32Array(N), prev = new Float32Array(24), cur = new Float32Array(24);
  const { win } = fftTables;
  let rmsSum = 0, cent = 0, centW = 0, lowE = 0, allE = 0;
  for (let f = 0; f < frames; f++) {
    if (pause && f && f % 300 === 0) await pause();
    const o = f * HOP;
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = pcm[o + i];
      e += v * v;
      re[i] = v * win[i];
      im[i] = 0;
    }
    rmsSum += e / N;
    fft(re, im);
    let flux = 0, fluxLow = 0;
    for (let b = 0; b < 24; b++) {
      let m = 0;
      const hi = Math.min(N / 2, Math.max(edges[b + 1], edges[b] + 1));
      for (let k = edges[b]; k < hi; k++) m += re[k] * re[k] + im[k] * im[k];
      const lg = Math.log1p(1000 * Math.sqrt(m / (hi - edges[b])));
      cur[b] = lg;
      const d = lg - prev[b];
      if (d > 0) {
        flux += d;
        if (b < 6) fluxLow += d;
      }
      const fc = edges[b] * binHz;
      cent += fc * m;
      centW += m;
      allE += m;
      if (b < 6) lowE += m;
    }
    prev.set(cur);
    env[f] = flux;
    low[f] = fluxLow;
  }
  const fps = sr / HOP;
  const rms = frames ? Math.sqrt(rmsSum / frames) : 0;
  return {
    env, low, fps,
    feats: {
      // Lautheit (dBFS), Helligkeit (Schwerpunkt in Hz), Bass-Anteil der Energie
      loud: rms > 0 ? 20 * Math.log10(rms) : -60,
      centroid: centW ? cent / centW : 0,
      bass: allE ? lowE / allE : 0,
    },
  };
}

// gleitender Mittelwert abziehen, Negatives weg: nur echte Einsätze bleiben
function normalize(env, fps) {
  const n = env.length, w = Math.max(1, Math.round(fps * 0.5)), out = new Float32Array(n);
  let s = 0;
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + env[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - w), b = Math.min(n, i + w + 1);
    const v = env[i] - (pre[b] - pre[a]) / (b - a);
    out[i] = v > 0 ? v : 0;
    s += out[i];
  }
  const m = s / Math.max(1, n);
  for (let i = 0; i < n; i++) out[i] -= m;
  return out;
}
function autocorr(x, maxLag) {
  const n = x.length, ac = new Float32Array(maxLag + 1);
  for (let L = 0; L <= maxLag; L++) {
    let s = 0;
    for (let i = L; i < n; i++) s += x[i] * x[i - L];
    ac[L] = s / (n - L);
  }
  return ac;
}
// Wert der Autokorrelation an einer gebrochenen Verzögerung (linear)
const acAt = (ac, L) => {
  const i = Math.floor(L), f = L - i;
  return i + 1 < ac.length ? ac[i] * (1 - f) + ac[i + 1] * f : 0;
};

// Tempo aus der Einsatz-Kurve. hint: bekanntes Tempo (z. B. Deezer) – gewinnt, wenn die Kurve es stützt.
// Rückgabe { bpm, conf (0..1), pulse (Anteil der Kurve, der periodisch ist), alt (Oktav-Alternative) } oder null.
// opt (Testlabor): w2/w4 = Gewicht der Glieder 2 und 4 Schläge, width = Breite der Tempo-Vorliebe (Oktaven), mid = ihre Mitte
function tempoFromEnvelope(env, fps, hint = 0, opt = {}) {
  const { w2 = 0.5, w4 = 0.5, width = 0.9, mid = 120, oct = 0.8, trust = 0.5 } = opt;
  if (env.length < fps * 6) return null;
  const x = normalize(env, fps);
  const minLag = Math.floor((fps * 60) / 210), maxLag = Math.ceil((fps * 60) / 55);
  if (maxLag * 2 + 2 >= x.length) return null;
  const ac = autocorr(x, Math.min(x.length - 2, Math.ceil((fps * 60) / 70) * 4 + 2));
  if (!(ac[0] > 0)) return null;
  // Kamm: Grundschlag plus 2 und 4 Schläge (halber und ganzer 4/4-Takt) – ein echtes Tempo hat diese Obertöne.
  // Kein 3er-Glied: das stützte Triolen-Raster (Testlabor: 4/3 und 2/3 des Tempos bei Hip-Hop und Rock)
  const far = ac.length - 1;
  const comb = (L) => acAt(ac, L) + w2 * acAt(ac, Math.min(2 * L, far)) + w4 * acAt(ac, Math.min(4 * L, far));
  let best = null;
  const cand = [];
  for (let L = minLag; L <= maxLag; L += 0.25) {
    const bpm = (60 * fps) / L;
    // Vorliebe für übliche Tempi: log-normal um 120 BPM (wie librosa), breit
    const prior = Math.exp(-0.5 * (Math.log2(bpm / mid) / width) ** 2);
    const raw = comb(L);
    const score = raw * (0.35 + 0.65 * prior);
    cand.push({ L, bpm, raw, score });
    if (!best || score > best.score) best = { L, bpm, raw, score };
  }
  if (!best || best.raw <= 0) return null;
  // Spitze verfeinern (parabolisch auf dem Kamm)
  const y0 = comb(best.L - 0.25), y1 = comb(best.L), y2 = comb(best.L + 0.25);
  const den = y0 - 2 * y1 + y2;
  const L = best.L + (den < 0 ? (0.25 * 0.5 * (y0 - y2)) / den : 0);
  let bpm = (60 * fps) / L;
  // Oktave: halbes/doppeltes Tempo fast genauso gut? Dann entscheidet die Nähe zu 100–130 BPM
  // (Testlabor: Harmonix-Tempi liegen zu 80 % zwischen 75 und 150 BPM)
  const scoreAt = (b) => comb((60 * fps) / b);
  let alt = 0;
  for (const k of [2, 0.5]) {
    const b2 = bpm * k;
    if (b2 < 55 || b2 > 210) continue;
    const r = scoreAt(b2) / Math.max(1e-9, scoreAt(bpm));
    if (r > oct) alt = b2;
  }
  // bekanntes Tempo (Deezer): gilt, wenn es eine Oktave des Gefundenen ist oder die Kurve es fast so gut stützt
  if (hint > 0) {
    // Deezers Tempo in die Oktave des Gefundenen legen: liegt es dort (±4 %), gilt der genauere Deezer-Wert
    let h = hint;
    while (h > bpm * 1.41) h /= 2;
    while (h < bpm / 1.41) h *= 2;
    if (Math.abs(h / bpm - 1) < 0.04) bpm = h;
    // sonst (z. B. Triolen-Raster 4/3, 2/3): Deezer gewinnt, wenn die Kurve es fast so gut stützt
    else if (h >= 55 && h <= 210 && scoreAt(h) > scoreAt(bpm) * trust) bpm = h;
  }
  // Sicherheit: wie deutlich ragt die Spitze heraus (gegen den Mittelwert aller Kandidaten), wie periodisch ist die Kurve
  const mean = cand.reduce((s, c) => s + c.raw, 0) / cand.length;
  const pulse = Math.max(0, Math.min(1, acAt(ac, L) / ac[0]));
  const conf = Math.max(0, Math.min(1, ((best.raw - mean) / (Math.abs(mean) + ac[0] * 0.15)) * 0.5 + pulse * 0.6));
  return { bpm: Math.round(bpm * 10) / 10, conf: Math.round(conf * 100) / 100, pulse: Math.round(pulse * 100) / 100, alt: Math.round(alt * 10) / 10 };
}

// Ganze Kette auf Mono-Samples: Tempo und Klangzahlen. Für die Genre-Schätzung zusätzlich die Einsatzdichte
// (Einsätze je Sekunde – Metal, Drum & Bass hoch; Balladen, Ambient niedrig).
async function analyzePcm(pcm, sr, hint = 0, pause) {
  const { env, low, fps, feats } = await onsetEnvelope(pcm, sr, pause);
  const t = tempoFromEnvelope(env, fps, hint);
  // Einsatzdichte: Spitzen der Kurve über ihrem Mittel + 1 Standardabweichung, mindestens 70 ms auseinander
  let m = 0, s = 0, peaks = 0, last = -99;
  for (const v of env) m += v;
  m /= Math.max(1, env.length);
  for (const v of env) s += (v - m) ** 2;
  const th = m + Math.sqrt(s / Math.max(1, env.length));
  for (let i = 1; i < env.length - 1; i++) if (env[i] > th && env[i] >= env[i - 1] && env[i] > env[i + 1] && i - last > fps * 0.07) [peaks, last] = [peaks + 1, i];
  // Anteil der Bass-Einsätze am ganzen Fluss: Four-on-the-floor und 808 hoch, Gitarrenrock und Klavier niedrig
  let lowSum = 0, allSum = 0;
  for (let i = 0; i < env.length; i++) [lowSum, allSum] = [lowSum + low[i], allSum + env[i]];
  return {
    bpm: t?.bpm || 0, conf: t?.conf || 0, pulse: t?.pulse || 0, alt: t?.alt || 0,
    feats: { ...feats, density: env.length ? peaks / (env.length / fps) : 0, kick: allSum ? lowSum / allSum : 0 },
  };
}

// Tempo auf den Bereich falten, in dem Mirage zählt (Party: 70–165 BPM, darüber halbes Zählen)
function foldBpm(bpm, lo = 70, hi = 165) {
  if (!(bpm > 0)) return 0;
  while (bpm > hi) bpm /= 2;
  while (bpm < lo) bpm *= 2;
  return bpm;
}

export { onsetEnvelope, tempoFromEnvelope, analyzePcm, foldBpm };
