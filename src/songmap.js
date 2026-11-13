/* ---------------------------------------------------------------- Song-Karte */
// Aus Spotifys Taktanalyse (oder der Schätzung) entsteht einmal pro Song eine Karte: Energiekurve
// (Viertelsekunden-Raster), Drops auf den Schlag genau, Instrumente, Tonhöhe und gehaltene Töne.
// Ohne Fenster und ohne Spotify – darum auch in den Unit-Tests ladbar (party.js und director.js nutzen sie).
const STEP = 0.25;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// letzter Index mit arr[i][key] <= t (arr aufsteigend sortiert)
function seek(arr, at, key) {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (arr[m][key] <= at) {
      r = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
}
const pct = (arr, p) => {
  const s = Float32Array.from(arr).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
};
// je Analyse-Objekt genau einmal (die Daten ändern sich nicht, ein neuer Song bringt ein neues Objekt)
const mapCache = new WeakMap();
function songMap(d) {
  if (mapCache.has(d)) return mapCache.get(d);
  const segs = d.segs || [];
  const end = segs.length ? segs[segs.length - 1].t + 2 : 0;
  const n = Math.max(1, Math.ceil(end / STEP));
  // lauteste Stelle je Rasterfeld, Lücken mit dem Vorgänger füllen
  const raw = new Float32Array(n).fill(-60), rb = new Float32Array(n);
  for (const s of segs) {
    const i = Math.min(n - 1, Math.floor(s.t / STEP));
    if (s.l > raw[i]) raw[i] = s.l;
    rb[i] = Math.max(rb[i], s.b || 0);
  }
  for (let i = 1; i < n; i++) {
    if (raw[i] <= -60) raw[i] = raw[i - 1];
    if (!rb[i]) rb[i] = rb[i - 1];
  }
  // über 1,5 s geglättet = gefühlte Energie, nicht jeder einzelne Schlag. Mittig geglättet (der ganze
  // Song ist ja bekannt): die Kurve steigt genau dort, wo der Song lauter wird – nicht eine Sekunde später
  const sm = (a, w) => {
    const o = new Float32Array(n), h = w >> 1;
    for (let i = 0; i < n; i++) {
      let acc = 0, c = 0;
      for (let k = Math.max(0, i - h); k <= Math.min(n - 1, i + h); k++, c++) acc += a[k];
      o[i] = acc / c;
    }
    return o;
  };
  const E = sm(raw, 6), B = sm(rb, 6);
  // auf den Song selbst bezogen: seine lautesten 5 % = 1, 0 liegt bei den leisesten 10 % – aber immer
  // mindestens 8 dB darunter (sonst wird ein fast durchgehend lauter Song zu einer flachen Null-Linie)
  const hi = pct(E, 0.95), p10 = pct(E, 0.1), lo = Math.min(p10, hi - 8);
  const bhi = pct(B, 0.95), blo = Math.min(pct(B, 0.1), bhi - 20);
  const energy = E.map((v) => clamp((v - lo) / (hi - lo), 0, 1));
  const bright = B.map((v) => clamp((v - blo) / (bhi - blo), 0, 1));
  // Drops: die Energie springt binnen 4 s deutlich nach oben und bleibt hoch – mindestens 8 s Abstand
  const drops = [];
  for (let i = 16; i < n - 4; i++) {
    let before = 1;
    for (let k = i - 16; k < i - 2; k++) before = Math.min(before, energy[k]);
    const after = (energy[i] + energy[i + 2] + energy[i + 4]) / 3;
    if (after > 0.72 && after - before > 0.38 && (!drops.length || i * STEP - drops[drops.length - 1] > 8)) {
      // den eigentlichen Sprung in der ungeglätteten Lautheit suchen, dann auf den nächsten Schlag legen
      let j = i, best = -1e9;
      for (let k = Math.max(1, i - 6); k <= Math.min(n - 1, i + 6); k++) {
        const jump = raw[k] - raw[k - 1];
        if (jump > best) [best, j] = [jump, k];
      }
      // Der Sprung steckt im Rasterfeld j (dessen lautester Einsatz): liegt dort ein Schlag, ist das der Drop –
      // sonst der nächste Schlag. (Früher zählte der Abstand zum Feldanfang: dann landete der Drop oft einen Schlag zu früh.)
      const tj = j * STEP, bi = seek(d.beats, tj + STEP - 0.001, "t");
      const b0 = d.beats[bi]?.t ?? tj, b1 = d.beats[bi + 1]?.t ?? b0;
      drops.push(b0 >= tj - 0.03 ? b0 : Math.abs(b1 - tj) < Math.abs(b0 - tj) ? b1 : b0);
      i += 32;
    }
  }
  // --- Instrumente aus Spotifys Klangfarbe je Segment, auf den Song selbst bezogen (Rang 0..1):
  // Kick = harter Einsatz, dunkel, lauter als davor · Snare/Clap = harter Einsatz, rauschig ·
  // Hi-Hat/Becken = sehr hell und eher leise · Melodie = klare Tonhöhe (ein Ton dominiert die 12 Tonklassen)
  const rank = (vals) => {
    const sorted = Float32Array.from(vals).sort();
    return (v) => {
      let a = 0, b = sorted.length;
      while (a < b) {
        const mid = (a + b) >> 1;
        if (sorted[mid] < v) a = mid + 1;
        else b = mid;
      }
      return sorted.length ? a / sorted.length : 0;
    };
  };
  const rA = rank(segs.map((x) => x.k || 0)), rF = rank(segs.map((x) => x.f || 0)), rB = rank(segs.map((x) => x.b || 0));
  const kicks = [], snares = [], hats = [];
  const tonal = new Float32Array(n), pc = new Uint8Array(n);
  segs.forEach((x, i) => {
    const rise = x.l - (segs[i - 1]?.l ?? -60), a = rA(x.k || 0), f = rF(x.f || 0), b = rB(x.b || 0);
    const loudEnough = x.l > hi - 16;
    if (loudEnough && (a > 0.72 || rise > 6) && b < 0.5) kicks.push(x.t);
    else if (loudEnough && a > 0.65 && f > 0.62 && b >= 0.4) snares.push(x.t);
    if (b > 0.82 && rise < 4 && x.l > hi - 22) hats.push(x.t);
    if (x.p?.length === 12) {
      let sum = 0, mx = 0, arg = 0;
      x.p.forEach((v, k) => {
        sum += v;
        if (v > mx) [mx, arg] = [v, k];
      });
      const bin = Math.min(n - 1, Math.floor(x.t / STEP));
      const clarity = sum ? clamp(((mx / sum) * 12 - 1.6) / 2.4, 0, 1) : 0;
      if (clarity >= tonal[bin]) [tonal[bin], pc[bin]] = [clarity, arg];
    }
  });
  for (let i = 1; i < n; i++) if (!tonal[i]) [tonal[i], pc[i]] = [tonal[i - 1] * 0.9, pc[i - 1]];
  // gehaltene Töne: dieselbe Tonklasse klar hörbar über mindestens 1,25 s (lange Note am Zeilenende,
  // ein Belting im Refrain) – die Lichtregie setzt darauf einen Verfolger-Spot
  const holds = [];
  for (let i = 0, start = -1; i <= n; i++) {
    const ok = i < n && tonal[i] > 0.5;
    if (start >= 0 && (!ok || pc[i] !== pc[start])) {
      if ((i - start) * STEP >= 1.25) holds.push([start * STEP, i * STEP]);
      start = -1;
    }
    if (ok && start < 0) start = i;
  }
  // „dynamisch“ = der Song hat wirklich leise Stellen (Breaks gibt es nur dann)
  const m = { energy, bright, drops, dynamic: hi - p10 > 4 || energy.some((v) => v < 0.2), sections: d.sections || [], kicks, snares, hats, tonal, pc, holds };
  mapCache.set(d, m);
  return m;
}
// Wert der Kurve zur Sekunde sec (linear zwischen den Rasterfeldern)
const at = (arr, sec) => {
  const f = sec / STEP, i = Math.floor(f);
  if (i < 0) return arr[0] || 0;
  if (i >= arr.length - 1) return arr[arr.length - 1] || 0;
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
};

export { songMap, at, seek, STEP };
