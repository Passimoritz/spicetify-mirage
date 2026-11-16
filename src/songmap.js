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
  // Drops, wie ein Mensch sie hört: davor ein Stück deutlich ruhiger (Break, Aufbau, Pause), danach ein Plateau,
  // das hoch BLEIBT – nicht nur ein lauter Schlag. Geprüft auf jeder Eins, die stärksten zuerst, höchstens einer
  // je 12 s. (Früher reichte ein Tal von einer Sekunde: bei Songs mit wechselnder Lautheit – Strophe mit Pausen,
  // Rap – zündete dann alle 10 s ein „Drop“; im Testlabor 3,7 je Minute, nur jeder fünfte an einem Refrain.)
  const cs = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + energy[i];
  const avg = (a, b) => {
    [a, b] = [clamp(a, 0, n), clamp(b, 0, n)];
    return b > a ? (cs[b] - cs[a]) / (b - a) : 0;
  };
  const beats = d.beats || [];
  // Die Eins prüfen: Takte der Analyse liegen manchmal einen Schlag daneben (Spotify selten, Schätzungen oft).
  // Kick und Harmoniewechsel fallen auf die Eins, die Snare auf 2 und 4 – zeigt das deutlich woandershin, gilt das.
  const ones = checkBars(d, beats, kicks, snares);
  const bars = ones.map((t) => ({ t }));
  // Phrasen: neue Teile beginnen fast immer im 4-Takt-Raster (4, 8, 16 Takte). Welche Eins zählt als „1“?
  // Die Lage, an der sich Energie und Klangfarbe im Mittel am stärksten ändern. phrase.conf > 1.25 = deutlich.
  const phrase = phraseGrid(ones, avg, B, n);
  const cands = [];
  for (let o = 0; o < ones.length; o++) {
    if (phrase.conf > 1.25 && (o - phrase.off) % 4) continue;
    const tb = ones[o], i = Math.round(tb / STEP);
    if (i < 16 || i > n - 16) continue;
    const pre = avg(i - 32, i - 1), post = avg(i, i + 24);
    // Plateau: auch die schwächste Sekunde danach ist noch hoch · Tal: die ruhigste Sekunde in den 8 s davor
    let postMin = 1, dip = 1;
    for (let k = i + 2; k + 4 <= i + 24; k += 2) postMin = Math.min(postMin, avg(k, k + 4));
    for (let k = i - 32; k + 4 <= i; k += 2) dip = Math.min(dip, avg(k, k + 4));
    if (post > 0.75 && postMin > 0.55 && post - pre > 0.33 && post - dip > 0.5) cands.push({ i, s: post - pre + (post - dip) * 0.5 });
  }
  cands.sort((a, b) => b.s - a.s);
  const keep = [];
  for (const c of cands) if (keep.every((k) => Math.abs(k.i - c.i) * STEP >= 12)) keep.push(c);
  keep.sort((a, b) => a.i - b.i);
  const drops = [];
  for (const { i } of keep) {
    // den eigentlichen Sprung in der ungeglätteten Lautheit suchen, dann auf den nächsten Schlag legen
    let j = i, best = -1e9;
    for (let k = Math.max(1, i - 6); k <= Math.min(n - 1, i + 6); k++) {
      const jump = raw[k] - raw[k - 1];
      if (jump > best) [best, j] = [jump, k];
    }
    // Der Sprung steckt im Rasterfeld j (dessen lautester Einsatz): liegt dort ein Schlag, ist das der Drop –
    // sonst der nächste Schlag. (Früher zählte der Abstand zum Feldanfang: dann landete der Drop oft einen Schlag zu früh.)
    const tj = j * STEP, bi = seek(beats, tj + STEP - 0.001, "t");
    const b0 = beats[bi]?.t ?? tj, b1 = beats[bi + 1]?.t ?? b0;
    let t = b0 >= tj - 0.03 ? b0 : Math.abs(b1 - tj) < Math.abs(b0 - tj) ? b1 : b0;
    // ein Drop landet auf der Eins: liegt sie höchstens einen Drittelschlag daneben, gilt sie
    let near = null;
    for (const x of ones) if (near == null || Math.abs(x - t) < Math.abs(near - t)) near = x;
    if (near != null && Math.abs(near - t) < (b1 - b0 || 0.5) * 0.35) t = near;
    if (!drops.length || t - drops[drops.length - 1] > 8) drops.push(t);
  }
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
  const m = { energy, bright, drops, phrase, ones, bars, dynamic: hi - p10 > 4 || energy.some((v) => v < 0.2), sections: d.sections || [], kicks, snares, hats, tonal, pc, holds };
  mapCache.set(d, m);
  return m;
}
// Taktanfänge (Sekunden): die der Analyse – oder, wenn Kick, Snare und Harmoniewechsel klar eine andere Lage im
// 4er-Takt zeigen, jeder vierte Schlag ab dieser. Nur im geraden Takt (fast alle Takte 4 Schläge lang).
// Testlabor (Harmonix, Takte geschätzt): richtige Eins 48 % → 60 %; mit richtigen Takten bleibt sie in 99 % stehen.
const BAR_MARGIN = 0.4;
function checkBars(d, beats, kicks, snares) {
  const given = (d.bars || []).map((b) => b.t), nb = beats.length;
  const grid = (p) => beats.filter((_, i) => i % 4 === p).map((b) => b.t);
  if (nb < 32) return given.length >= 4 ? given : grid(0);
  // Lage der Analyse-Takte im Schlagraster (Mehrheit) und ob sie gerade sind
  const idx = given.map((t) => seek(beats, t + 0.03, "t")).filter((i) => i >= 0);
  const vote = [0, 0, 0, 0];
  let four = 0;
  idx.forEach((i, k) => {
    vote[i % 4]++;
    if (k && idx[k] - idx[k - 1] === 4) four++;
  });
  const ap = given.length >= 4 ? vote.indexOf(Math.max(...vote)) : 0;
  if (given.length >= 4 && four < (idx.length - 1) * 0.8) return given;
  // je Schlag: Kick, Snare, Harmoniewechsel (Tonklassen der Segmente kurz davor gegen kurz danach)
  const F = { k: new Float32Array(nb), s: new Float32Array(nb), c: new Float32Array(nb) };
  const segs = d.segs || [];
  let ki = 0, si = 0, gi = 0;
  for (let i = 0; i < nb; i++) {
    const t = beats[i].t;
    while (ki < kicks.length && kicks[ki] < t - 0.07) ki++;
    while (si < snares.length && snares[si] < t - 0.07) si++;
    F.k[i] = ki < kicks.length && kicks[ki] < t + 0.07 ? 1 : 0;
    F.s[i] = si < snares.length && snares[si] < t + 0.07 ? 1 : 0;
    while (gi < segs.length - 1 && segs[gi + 1].t <= t + 0.03) gi++;
    let ab = 0, aa = 0, bb = 0;
    for (let c = 0; c < 12; c++) {
      let a = 0, b = 0;
      for (let j = Math.max(0, gi - 6); j < gi; j++) a += segs[j].p?.[c] || 0;
      for (let j = gi; j < Math.min(segs.length, gi + 6); j++) b += segs[j].p?.[c] || 0;
      [ab, aa, bb] = [ab + a * b, aa + a * a, bb + b * b];
    }
    F.c[i] = aa && bb ? 1 - ab / Math.sqrt(aa * bb) : 0;
  }
  const z = (a) => {
    let m = 0, v = 0;
    for (const x of a) m += x;
    m /= a.length;
    for (const x of a) v += (x - m) ** 2;
    const sd = Math.sqrt(v / a.length) || 1;
    return (i) => (a[i] - m) / sd;
  };
  const zk = z(F.k), zs = z(F.s), zc = z(F.c);
  const sc = [0, 0, 0, 0], cnt = [0, 0, 0, 0];
  for (let i = 0; i < nb; i++) {
    sc[i % 4] += 0.5 * zk(i) + zc(i) - 0.5 * zs(i);
    cnt[i % 4]++;
  }
  const m = sc.map((v, i) => v / cnt[i]), best = m.indexOf(Math.max(...m));
  const second = Math.max(...m.filter((_, i) => i !== best));
  if (given.length >= 4 && (best === ap || m[best] - second < BAR_MARGIN)) return given;
  return grid(best);
}

// Phrasen-Raster: Index (0..3) der Eins, mit der 4-Takt-Phrasen beginnen, und wie deutlich (Verhältnis zum Mittel)
function phraseGrid(ones, avg, B, n) {
  const nb = ones.length;
  if (nb < 12) return { off: 0, conf: 0 };
  const bin = (t) => clamp(Math.round(t / STEP), 0, n);
  const bE = [], bB = [];
  for (let k = 0; k < nb; k++) {
    const a = bin(ones[k]), b = Math.max(a + 1, bin(ones[k + 1] ?? ones[k] + (ones[k] - ones[k - 1])));
    bE.push(avg(a, b));
    let s = 0;
    for (let i = a; i < Math.min(b, n); i++) s += B[i];
    bB.push(s / Math.max(1, Math.min(b, n) - a));
  }
  const bs = Math.max(1, ...bB) - Math.min(...bB) || 1;
  const sc = [0, 0, 0, 0], cnt = [0, 0, 0, 0];
  for (let k = 2; k < nb - 2; k++) {
    const dE = Math.abs(bE[k] + bE[k + 1] - bE[k - 1] - bE[k - 2]) / 2, dB = Math.abs(bB[k] + bB[k + 1] - bB[k - 1] - bB[k - 2]) / 2 / bs;
    sc[k % 4] += dE + 0.5 * dB;
    cnt[k % 4]++;
  }
  const m = sc.map((v, i) => v / Math.max(1, cnt[i])), all = (m[0] + m[1] + m[2] + m[3]) / 4;
  const off = m.indexOf(Math.max(...m));
  return { off, conf: all ? m[off] / all : 0 };
}

// Wert der Kurve zur Sekunde sec (linear zwischen den Rasterfeldern)
const at = (arr, sec) => {
  const f = sec / STEP, i = Math.floor(f);
  if (i < 0) return arr[0] || 0;
  if (i >= arr.length - 1) return arr[arr.length - 1] || 0;
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
};

export { songMap, at, seek, STEP };
