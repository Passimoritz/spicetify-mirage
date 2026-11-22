/* ---------------------------------------------------------------- Liedtext auf den Gesang legen */
// Fremde Liedtexte (LRCLIB, NetEase, Kugou) stammen oft von einer anderen Fassung oder einer anderen Quelle der
// Aufnahme: um ein paar hundert ms verschoben (längeres Intro, Stille am Anfang) oder leicht gestreckt
// (andere Abspielgeschwindigkeit, 1–2 %). Mirage vergleicht die Zeilen- und Wortanfänge mit den Ton-Einsätzen
// der Spotify-Analyse und rechnet daraus Versatz und Streckung: neue Zeit = Zeit · scale + off.
// Übernommen wird nur, was klar besser passt – im Zweifel bleibt alles, wie es ist.
// Ohne Fenster und ohne Spotify: einzeln testbar (tests/unit/lyricsync.test.js).

// Ton-Einsätze, die nach Gesang aussehen: lauter Anstieg (Anschlag), klare Tonhöhe (ein Ton ragt aus dem
// Chroma heraus) und wenig Rauschen (Flachheit niedrig – Snare, Becken und Klatschen sind rauschig)
function vocalOnsets(segs) {
  const out = [];
  if (!segs?.length) return out;
  const fs = segs.map((s) => Number(s.f) || 0), mean = fs.reduce((a, b) => a + b, 0) / fs.length;
  const sd = Math.sqrt(fs.reduce((a, b) => a + (b - mean) ** 2, 0) / fs.length) || 1;
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k], jump = s.l - (segs[k - 1]?.l ?? -60);
    if (!(s.l > -32) || !(jump > 2)) continue;
    const p = s.p?.length === 12 ? s.p : null;
    // Chroma ist auf 1 normiert: ein klarer Ton hat einen kleinen Mittelwert
    const tonal = p ? 1 - p.reduce((a, b) => a + b, 0) / 12 : 0.5;
    const noisy = (fs[k] - mean) / sd > 1;
    out.push({ t: s.t * 1000, w: (Math.min(jump, 14) / 14) * (0.3 + tonal) * (noisy ? 0.45 : 1) });
  }
  return out;
}

// Sprech- und Rufgesang (Rap, Spoken Word, Geschrei über lauten Gitarren) hat kaum Tonhöhe – vocalOnsets
// übersieht ihn, und laute, tonale Gitarren auf jedem Schlag ziehen den Abgleich dann aufs Takt-Raster.
// Darum ein zweiter Melder für das Sprachband (etwa 300–3000 Hz). Spotifys Segmente kennen keine Frequenzbänder;
// was es gibt: Lautheitssprung (l), Helligkeit (b = timbre[1]: Höhen/Becken hoch, dumpfer Bass tief), Flachheit
// (f = timbre[2]: Rauschen) und Anschlag (k = timbre[3]: Trommeln). Sprache = lauter Anstieg bei MITTLERER
// Helligkeit, etwas Rauschen erlaubt (Konsonanten), aber kein harter Trommelanschlag und kein Beckenrauschen.
// Gemessen relativ zum Song (z-Werte), weil die Spotify-Werte je Mischung anders liegen.
function speechOnsets(segs) {
  const out = [];
  if (!segs?.length) return out;
  const zOf = (key) => {
    const xs = segs.map((s) => Number(s[key]) || 0), m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1;
    return (v) => ((Number(v) || 0) - m) / sd;
  };
  const zb = zOf("b"), zf = zOf("f"), zk = zOf("k");
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k], jump = s.l - (segs[k - 1]?.l ?? -60);
    if (!(s.l > -30) || !(jump > 4)) continue;
    const b = zb(s.b), f = zf(s.f), a = zk(s.k);
    if (b < -1.2 || b > 1.3 || f > 1.6 || a > 1.3) continue;
    // schwächer als ein klarer Ton: Sprache ist nur ein Hinweis, Gesang mit Tonhöhe der sichere Fall
    out.push({ t: s.t * 1000, w: (Math.min(jump, 14) / 14) * 0.55 * (f > 0.8 ? 0.7 : 1) });
  }
  return out;
}
// beide Melder zusammen: an derselben Stelle (±25 ms) zählt der stärkere
function onsetsOf(segs) {
  const all = [...vocalOnsets(segs), ...speechOnsets(segs)].sort((a, b) => a.t - b.t), out = [];
  for (const x of all) {
    const last = out[out.length - 1];
    if (last && x.t - last.t <= 25) {
      if (x.w > last.w) out[out.length - 1] = x;
    } else out.push(x);
  }
  return out;
}

// Anker: Zeilenanfänge zählen voll, Wortanfänge (wenn die Quelle welche hat) halb
function anchorsOf(lines) {
  const out = [];
  for (const l of lines || []) {
    if (!l || l.text === "♪" || !String(l.text || "").trim()) continue;
    out.push({ t: l.t, w: 1, line: true });
    for (const w of (l.words || []).slice(1)) out.push({ t: w.t, w: 0.5 });
  }
  return out.sort((a, b) => a.t - b.t);
}

// erster Einsatz mit t >= x (binäre Suche)
function from(on, x) {
  let lo = 0, hi = on.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (on[m].t < x) lo = m + 1;
    else hi = m;
  }
  return lo;
}
// Wie gut passen die Anker bei Zeit · scale + off? Je Anker der stärkste Einsatz in ±T, weich gewichtet
function scoreAt(anchors, on, off, scale, T = 70) {
  let sum = 0, wsum = 0;
  for (const a of anchors) {
    const x = a.t * scale + off;
    let best = 0;
    for (let k = from(on, x - T); k < on.length && on[k].t <= x + T; k++) {
      const d = (on[k].t - x) / T;
      best = Math.max(best, on[k].w * (1 - d * d));
    }
    sum += best * a.w;
    wsum += a.w;
  }
  return wsum ? sum / wsum : 0;
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
// bester Versatz bei fester Streckung im Bereich lo..hi (Schritt step)
function bestOff(anchors, on, scale, lo, hi, step, T) {
  let off = 0, val = -1;
  for (let o = lo; o <= hi; o += step) {
    const v = scoreAt(anchors, on, o, scale, T);
    if (v > val + 1e-9 || (Math.abs(v - val) <= 1e-9 && Math.abs(o) < Math.abs(off))) [off, val] = [o, v];
  }
  return { off, val };
}

// RANGE: so weit sucht der Abgleich normalerweise (±1 s). Bis WIDE (±2 s) nur, wenn der Gipfel dort sehr klar ist –
// weiter verschobene Texte sind fast immer eine andere Fassung, das löst die Abstimmung (lyricvote.js) besser.
const RANGE = 1000, WIDE = 2000, MAX_STRETCH = 0.03;
const pickBest = (a, b) => (b.v > a.v + 1e-9 || (Math.abs(b.v - a.v) <= 1e-9 && Math.abs(b.o) < Math.abs(a.o)) ? b : a);
// → { apply, off, scale, conf, why }. off/scale gelten nur, wenn apply true ist; why sagt, warum nicht:
//   "agreed" (mehrere Quellen einig), "few-lines", "few-onsets", "in-sync", "few-hits", "flat", "no-gain",
//   "ambiguous", "beat" (nur um ganze/halbe Schläge verschoben, ohne Verschiebung fast genauso gut), "too-far"
// opt = { beat: Schlagabstand in ms (aus der Analyse), agree: wie viele Quellen übereinstimmen, minOff }
function estimateSync(lines, segs, opt = {}) {
  const none = (why, conf = 0) => ({ apply: false, off: 0, scale: 1, conf, why });
  // Mehrere Sammlungen setzen die Zeilen unabhängig gleich: das ist sicherer als jede Schätzung am Klang
  if ((opt.agree || 0) >= 2) return none("agreed", 0);
  const on = onsetsOf(segs);
  const anchors = anchorsOf(lines), heads = anchors.filter((a) => a.line);
  if (heads.length < 8) return none("few-lines");
  if (on.length < 20) return none("few-onsets");
  // 1. Versatz ohne Streckung: Zeilenanfänge gegen Einsätze, ±2 s in 10-ms-Schritten; genommen wird der beste
  //    Gipfel in ±1 s – außerhalb nur, wenn er dort deutlich höher ist (und am Ende sehr sicher)
  const all = [];
  for (let o = -WIDE; o <= WIDE; o += 10) all.push({ o, v: scoreAt(heads, on, o, 1) });
  const base = scoreAt(heads, on, 0, 1);
  const inner = all.filter((x) => Math.abs(x.o) <= RANGE), gIn = inner.reduce(pickBest), gAll = all.reduce(pickBest);
  const wide = Math.abs(gAll.o) > RANGE && gAll.v > gIn.v * 1.3;
  const lim = wide ? WIDE : RANGE, curve = wide ? all : inner;
  const g = wide ? gAll : gIn;
  const bg = median(curve.map((x) => x.v)) || 1e-6;
  // 2. Streckung: alle Zeilen zugleich gegen ein Raster aus Streckung (±3 %, 0,05-%-Schritte) und Versatz.
  //    Einzelne Abschnitte reichen nicht: bei dichtem Gesang trifft ein versetzter Zeilenanfang fast immer
  //    irgendein Wort – erst über den ganzen Song hebt sich die richtige Kombination ab.
  let scale = 1, off = g.o;
  if (heads[heads.length - 1].t - heads[0].t > 60000) {
    let best = { v: -1 };
    for (let s = 1 - MAX_STRETCH; s <= 1 + MAX_STRETCH + 1e-9; s += 0.0005) {
      if (Math.abs(s - 1) < 0.0035) continue;
      const r = bestOff(heads, on, s, -lim, lim, 20, 90);
      if (r.val > best.v) best = { v: r.val, s, o: r.off };
    }
    if (best.v > 0) {
      // fein nachsuchen: Streckung ±0,05 %, Versatz ±40 ms
      for (let s = best.s - 0.0005; s <= best.s + 0.0005 + 1e-9; s += 0.0001) {
        const r = bestOff(heads, on, s, best.o - 40, best.o + 40, 5, 70);
        if (r.val > best.v) best = { v: r.val, s, o: r.off };
      }
      // nur nehmen, wenn die Streckung deutlich besser passt als der beste Versatz allein
      if (best.v > g.v * 1.25) [scale, off] = [best.s, best.o];
    }
  }
  // 3. fein: mit Wortanfängen (wenn vorhanden), 5-ms-Schritte um den Fund
  const fine = bestOff(anchors, on, scale, off - 40, off + 40, 5, 60);
  off = fine.off;
  const val = scoreAt(heads, on, off, scale);
  // 4. robuster Median der Restabweichungen der getroffenen Zeilen: zieht den Versatz auf die Einsatzmitte
  const res = [];
  for (const a of heads) {
    const x = a.t * scale + off;
    let hit = null;
    for (let k = from(on, x - 70); k < on.length && on[k].t <= x + 70; k++) if (on[k].w >= 0.25 && (!hit || on[k].w > hit.w)) hit = on[k];
    if (hit) res.push(hit.t - x);
  }
  const matched = res.length / heads.length;
  if (res.length >= 6) off += median(res);
  // Sicherheit: deutlicher Gipfel über dem Grundrauschen, klar besser als ohne Änderung, genug Zeilen getroffen
  // und kein gleich hoher zweiter Gipfel woanders (Takt-Raster: Zeilen auf jedem Schlag passen auch versetzt)
  const peak = val / bg, gain = base > 0 ? val / base : Infinity;
  const rival = scale === 1 ? Math.max(0, ...curve.filter((x) => Math.abs(x.o - g.o) > 150).map((x) => x.v)) / (g.v || 1e-6) : 0;
  // Streckung hat viel mehr Möglichkeiten durchprobiert (Zufallstreffer!): dafür gilt eine höhere Latte
  const stretch = scale !== 1, needPeak = stretch ? 3.4 : 3, needHits = stretch ? 0.55 : 0.4;
  const conf = Math.max(0, Math.min(1, Math.min(1, (peak - 1) / (needPeak - 1)) * Math.min(1, matched / needHits) * (1 - Math.max(0, rival - 0.8) * 5)));
  off = Math.round(off / 10) * 10;
  scale = Math.round(scale * 2000) / 2000;
  const tiny = Math.abs(off) < (opt.minOff ?? 60) && Math.abs(scale - 1) < 0.004;
  if (tiny) return none("in-sync", conf);
  if (matched < needHits) return none("few-hits", conf);
  if (peak < needPeak) return none("flat", conf);
  if (gain < 1.2) return none("no-gain", conf);
  if (rival > 0.92) return none("ambiguous", conf);
  // Takt-Raster (opt.beat = Schlagabstand): Zeilen, die nur Instrumente auf dem Schlag treffen, passen auch einen
  // Schlag früher oder später fast genauso gut. Zwei Proben, „fast genauso gut“ = 55 % des Funds:
  //   a) einen ganzen Schlag vor oder hinter dem Fund passt es auch (der Gipfel ist Teil eines Kamms)
  //   b) der Fund liegt (fast) genau ganze oder halbe Schläge daneben, und ohne diese Schläge passt es auch
  const P = Number(opt.beat) || 0;
  if (P >= 250 && scale === 1) {
    const near = (c) => bestOff(heads, on, 1, c - 40, c + 40, 10, 70).val;
    const half = P / 2, n = Math.round(off / half);
    // Kamm: strenger (80 %) – dichter Sprechgesang trifft einen Schlag später auch schon das nächste Wort
    let comb = Math.max(near(off - P), near(off + P)) / 0.8 * 0.55;
    if (n !== 0 && Math.abs(off - n * half) <= Math.max(30, P * 0.06)) {
      for (let k = 1; k <= Math.abs(n); k++) comb = Math.max(comb, near(off - Math.sign(n) * k * half));
    }
    if (comb >= val * 0.55) return none("beat", conf);
  }
  // Gipfel am Rand des Suchbereichs: der echte liegt vermutlich dahinter – nicht raten
  if (Math.abs(g.o) >= lim - 20) return none("too-far", conf);
  // weiter als RANGE nur mit sehr hoher Sicherheit
  if (Math.abs(off) > RANGE && (Math.abs(off) > WIDE || conf < 0.9 || peak < needPeak * 1.5 || matched < 0.6 || rival > 0.7)) return none("too-far", conf);
  return { apply: true, off, scale, conf, why: scale !== 1 ? "stretch" : "offset" };
}

// Zeiten eines Liedtexts umrechnen (Zeilen, Wortzeiten, Spotify-Silben)
function applySync(lines, { off = 0, scale = 1 } = {}) {
  const map = (t) => Math.round(t * scale + off);
  for (const l of lines || []) {
    l.t = map(l.t);
    for (const w of l.words || []) {
      w.t = map(w.t);
      if (w.d != null) w.d = Math.round(w.d * scale);
    }
    for (const s of l.syl || []) s.t = map(s.t);
  }
  return lines;
}

// Abgleich rückgängig machen (Zeiten zurück auf die der Quelle): umgekehrte Rechnung von applySync
function undoSync(lines, { off = 0, scale = 1 } = {}) {
  return applySync(lines, { off: -off / scale, scale: 1 / scale });
}

export { estimateSync, applySync, undoSync, vocalOnsets, speechOnsets, onsetsOf, anchorsOf, scoreAt, RANGE, WIDE };
