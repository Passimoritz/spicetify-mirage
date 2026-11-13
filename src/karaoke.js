/* ---------------------------------------------------------------- Karaoke-Wertung */
// Reine Rechnungen für das Spiel „Karaoke“. Das Theme wählt die Stelle und packt die Tonhöhen der Analyse klein
// (pickPart, partData), das Handy des Singenden misst sein Mikrofon und rechnet die Wertung (frameFeat, scoreTake).
// Der Ton verlässt das Handy nie, gesendet werden nur vier Zahlen. Ohne DOM und ohne Uhr: alles hier ist mit
// künstlichen Signalen prüfbar (tests/unit/karaoke.test.js). Für das Handy baut tools/build.js daraus docs/live/karaoke.js.

// Fenster und Schritt für das Mikrofon: 2048 Abtastwerte (≈ 43 ms), alle 1024 ein neues
export const WIN = 2048, HOP = 1024;
// so viel vor der Stelle hört das Handy nur den Raum (Grundpegel), ohne dass jemand singt
export const BASE_FROM = -3500, BASE_TO = -300;
// Tonhöhen der Analyse in Schritten von 250 ms, ab 4 s vor der Stelle (deckt den Grundpegel mit ab)
export const CH_STEP = 250, CH_FROM = -4000;
// Gewicht der drei stärksten Tonklassen: der Hauptton zählt voll, die beiden nächsten fast
const CH_W = [1, 0.8, 0.6];

const sung = (l) => {
  const s = String(l?.text || "").trim();
  return s.length > 1 && s !== "♪";
};

/* ---- Theme: welche Stelle wird gesungen */
// Zusammenhängende Zeilen von min bis max Millisekunden, keine lange Pause darin. Bevorzugt: der Refrain (eine
// Zeile, die öfter vorkommt) und eine Stelle mit etwas Luft davor (dort misst das Handy den Raum ohne Gesang).
export function pickPart(lines, { pos = 0, min = 30000, max = 45000, used = new Set(), lead = 12000 } = {}) {
  const L = lines || [], seen = new Map();
  for (const l of L) if (sung(l)) seen.set(l.text.trim(), (seen.get(l.text.trim()) || 0) + 1);
  let best = null;
  for (let i0 = 0; i0 < L.length; i0++) {
    const start = L[i0].t;
    if (!sung(L[i0]) || used.has(i0) || !(start >= 8000)) continue;
    let i1 = i0, gap = false;
    while (i1 + 1 < L.length && L[i1 + 1].t < start + min) {
      if (L[i1 + 1].t - L[i1].t > 10000) gap = true;
      i1++;
    }
    const after = L[i1 + 1]?.t;
    // nach der letzten Zeile: bis zur nächsten, aber nicht durch ein langes Zwischenspiel
    const end = Math.min(after ?? L[i1].t + 4000, L[i1].t + 6000);
    const len = end - start;
    let n = 0, hit = false;
    for (let k = i0; k <= i1; k++) {
      if (sung(L[k])) n++;
      if (used.has(k)) hit = true;
    }
    if (gap || hit || n < 3 || len > max || len < min * 0.75) continue;
    const quiet = i0 === 0 || start - L[i0 - 1].t >= 3500 || !sung(L[i0 - 1]);
    const score = (seen.get(L[i0].text.trim()) > 1 ? 2 : 0) + (quiet ? 1 : 0);
    const near = Math.abs(start - (pos + lead + 3000));
    if (!best || score > best.score || (score === best.score && near < best.near)) best = { i0, i1, start, end, score, near };
  }
  return best && { i0: best.i0, i1: best.i1, start: best.start, end: best.end };
}

// Einsätze einer Zeile in Song-Millisekunden: Silben, sonst Wörter, sonst nur der Zeilenanfang
function lineOnsets(l, next) {
  const inLine = (t) => t >= l.t - 300 && t < next;
  const syl = (l.syl || []).map((s) => Number(s.t)).filter(Number.isFinite);
  // manche Quellen zählen Silben ab Zeilenanfang statt ab Songanfang
  if (syl.length && syl[0] < l.t - 500 && syl[syl.length - 1] < next - l.t) for (let i = 0; i < syl.length; i++) syl[i] += l.t;
  if (syl.filter(inLine).length) return syl.filter(inLine);
  const words = (l.words || []).map((w) => Number(w.t)).filter((t) => Number.isFinite(t) && inLine(t));
  if (words.length) return words;
  return [l.t];
}
// Tonhöhen (12 Klassen, C = 0) der Analyse ab from in Schritten von step: je Schritt die bis zu drei stärksten
// Klassen als Hex-Ziffern, die stärkste zuerst, „-“ für keine. 45 s sind so knapp 600 Zeichen statt Tausender Zahlen.
export function chromaCode(segs, from, to, step = CH_STEP) {
  const S = (segs || []).filter((s) => s?.p?.length === 12);
  if (!S.length) return "";
  let out = "", k = 0;
  for (let t = from; t < to; t += step) {
    const at = (t + step / 2) / 1000;
    while (k + 1 < S.length && S[k + 1].t <= at) k++;
    const s = S[k];
    if (s.t > at + 0.5) {
      out += "---";
      continue;
    }
    const top = s.p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const m = top[0][0];
    let code = "";
    for (let j = 0; j < 3; j++) code += m > 0 && top[j][0] >= m * 0.3 ? top[j][1].toString(16) : "-";
    out += code;
  }
  return out;
}
// Lautheit der Analyse je Schritt (das Lauteste darin) als eine Ziffer zur Basis 36 in Schritten von 1,5 dB:
// das Handy weiß damit, wann die Lautsprecher lauter werden
export function loudCode(segs, from, to, step = CH_STEP) {
  const S = (segs || []).filter((s) => Number.isFinite(s?.l) && Number.isFinite(s?.t));
  if (!S.length) return "";
  let out = "", k = 0;
  for (let t = from; t < to; t += step) {
    const a = t / 1000, b = (t + step) / 1000;
    while (k + 1 < S.length && S[k + 1].t <= a) k++;
    let m = null;
    for (let j = k; j < S.length && S[j].t < b; j++) if (S[j + 1]?.t > a || j === S.length - 1) m = Math.max(m ?? -99, S[j].l);
    out += m == null ? "-" : Math.max(0, Math.min(35, Math.round(-m / 1.5))).toString(36);
  }
  return out;
}
// was das Handy für die Stelle braucht: Einsätze und Zeilen relativ zum Anfang der Stelle, dazu die Tonhöhen
export function partData(lines, part, segs) {
  const { i0, i1, start, end } = part, on = [], ln = [];
  for (let k = i0; k <= i1; k++) {
    const l = lines[k], next = k < i1 ? lines[k + 1].t : end;
    if (!sung(l)) continue;
    ln.push([Math.round(l.t - start), Math.round(next - start), String(l.text).trim().slice(0, 90)]);
    for (const t of lineOnsets(l, next)) on.push(Math.round(t - start));
  }
  // dicht beieinander liegende Einsätze sind für das Ohr (und das Mikrofon) einer
  on.sort((a, b) => a - b);
  const merged = on.filter((t, i) => !i || t - on[i - 1] >= 120);
  return { len: Math.round(end - start), on: merged, ln, ch: chromaCode(segs, start + CH_FROM, end, CH_STEP), lo: loudCode(segs, start + CH_FROM, end, CH_STEP), c0: CH_FROM, cs: CH_STEP };
}

/* ---- Handy: Merkmale je Fenster */
// Grundton nach YIN (de Cheveigné & Kawahara 2002) auf einem auf die halbe Rate gebrachten Fenster: halb so viel Arbeit,
// und 80–1000 Hz (Gesang) bleiben gut erhalten. Gibt { f: Hz oder 0, a: Aperiodizität 0..1 } zurück.
export function yin(x, sr) {
  const n = x.length >> 1, y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = 0.5 * (x[2 * i] + x[2 * i + 1]);
  const r = sr / 2, W = n >> 1, lo = Math.max(2, Math.floor(r / 1000)), hi = Math.min(W - 1, Math.ceil(r / 75));
  const d = new Float32Array(hi + 2);
  for (let tau = 1; tau <= hi + 1; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) {
      const v = y[j] - y[j + tau];
      s += v * v;
    }
    d[tau] = s;
  }
  // kumulativ normiert: d'(τ) = d(τ) · τ / Σ d
  let sum = 0;
  const dn = new Float32Array(hi + 2);
  dn[0] = 1;
  for (let tau = 1; tau <= hi + 1; tau++) {
    sum += d[tau];
    dn[tau] = sum > 0 ? (d[tau] * tau) / sum : 1;
  }
  let best = -1;
  for (let tau = lo; tau <= hi; tau++) {
    if (dn[tau] < 0.15) {
      while (tau + 1 <= hi && dn[tau + 1] < dn[tau]) tau++;
      best = tau;
      break;
    }
  }
  if (best < 0) {
    best = lo;
    for (let tau = lo + 1; tau <= hi; tau++) if (dn[tau] < dn[best]) best = tau;
  }
  const a = dn[best];
  if (a > 0.35) return { f: 0, a: Math.min(1, a) };
  // Parabel durch die drei Nachbarn: Grundton feiner als ein Abtastschritt
  const p = dn[best - 1], q = dn[best + 1], den = p - 2 * a + q;
  const shift = den > 0 ? Math.max(-0.5, Math.min(0.5, (p - q) / (2 * den))) : 0;
  return { f: r / (best + shift), a };
}
// ein Fenster → Lautstärke (RMS) und Grundton. Leises rechnet keinen Grundton: spart Rechenzeit am Handy.
export function frameFeat(frame, sr) {
  let q = 0;
  for (let i = 0; i < frame.length; i++) q += frame[i] * frame[i];
  const rms = Math.sqrt(q / frame.length);
  const p = rms > 0.002 ? yin(frame, sr) : { f: 0, a: 1 };
  return { r: rms, f: p.f };
}

/* ---- Handy: Wertung */
const pct = (arr, q) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const median = (arr) => pct(arr, 0.5);
// Tonklasse (C = 0, gebrochen) eines Grundtons: oktavunabhängig
export const pitchClass = (f) => (((12 * Math.log2(f / 440) + 9) % 12) + 12) % 12;
// die bis zu drei stärksten Klassen der Analyse zur Zeit t (relativ zur Stelle)
export function chromaAt(part, t) {
  const ch = part?.ch || "", b = Math.floor((t - (part?.c0 ?? CH_FROM)) / (part?.cs || CH_STEP));
  if (b < 0 || b * 3 + 3 > ch.length) return [];
  const out = [];
  for (let j = 0; j < 3; j++) {
    const c = parseInt(ch[b * 3 + j], 16);
    if (c >= 0 && c < 12) out.push(c);
  }
  return out;
}
// Lautheit des Songs (dB) zur Zeit t: das Lauteste aus diesem und den beiden Nachbarschritten (Spitzenwerte)
export function loudAt(part, t) {
  const lo = part?.lo || "", b = Math.floor((t - (part?.c0 ?? CH_FROM)) / (part?.cs || CH_STEP));
  let best = null;
  for (let k = b - 1; k <= b + 1; k++) {
    const d = k >= 0 && k < lo.length ? parseInt(lo[k], 36) : NaN;
    if (d >= 0) best = Math.max(best ?? -99, -1.5 * d);
  }
  return best;
}
// Ähnlichkeit eines gesungenen Tons mit den Tonhöhen der Analyse: Kosinus zwischen dem Ton (auf die beiden
// nächsten Klassen verteilt, so zählt ein etwas schiefer Ton halb) und den drei stärksten Klassen, so normiert,
// dass genau der Hauptton 1 ergibt
export function toneMatch(pc, classes) {
  if (!classes.length) return null;
  const lo = Math.floor(pc) % 12, fr = pc - Math.floor(pc), hi = (lo + 1) % 12;
  const w = (c) => {
    const i = classes.indexOf(c);
    return i < 0 ? 0 : CH_W[i];
  };
  const dot = (1 - fr) * w(lo) + fr * w(hi);
  return Math.min(1, dot / Math.hypot(1 - fr, fr));
}
// Einsätze im Mikrofon: die Lautstärke springt (Energiefluss, ≥ 6 dB über die letzten Fenster) oder der Ton
// wechselt deutlich, jeweils nur über dem Raumpegel (je Fenster x.g, sonst gate) und mit Stimme gleich danach
export function detectOnsets(feats, gate) {
  const out = [], db = feats.map((x) => 20 * Math.log10(x.r + 1e-5)), over = (x) => !!x && x.r > (x.g ?? gate);
  let last = -1e9, prevPc = -1;
  for (let n = 3; n < feats.length; n++) {
    const x = feats[n];
    const loud = over(x) || over(feats[n + 1]);
    const voiced = [0, 1, 2, 3].some((k) => feats[n + k]?.f > 0 && over(feats[n + k]));
    const rise = db[n] - Math.min(db[n - 1], db[n - 2], db[n - 3]);
    let jump = false;
    if (x.f > 0 && over(x)) {
      const pc = pitchClass(x.f), d = prevPc < 0 ? 0 : Math.min(Math.abs(pc - prevPc), 12 - Math.abs(pc - prevPc));
      // ein neuer Ton, der hält (auch das nächste Fenster liegt dort): gebundener Gesang ohne Lautstärkesprung
      const nx = feats[n + 1], stays = nx?.f > 0 && Math.min(Math.abs(pitchClass(nx.f) - pc), 12 - Math.abs(pitchClass(nx.f) - pc)) < 0.6;
      jump = prevPc >= 0 && d >= 1.5 && stays;
      prevPc = pc;
    } else if (!over(x)) prevPc = -1;
    if (loud && voiced && (rise >= 6 || jump) && x.t - last >= 100) {
      out.push(x.t);
      last = x.t;
    }
  }
  return out;
}
// Die Wertung einer gesungenen Stelle. feats: [{ t (ms relativ zum Anfang der Stelle), r, f }], auch aus der Zeit
// vor der Stelle (Grundpegel). part: { len, on, ln, ch, lo, c0, cs } aus partData. Ergebnis 0–100:
// s gesamt, t Timing, p Töne (-1 = nicht messbar), d Dabei; loud: der Raum war laut, das Timing zählt mehr.
export function scoreTake(feats, part) {
  const F = (feats || []).filter((x) => Number.isFinite(x?.t) && Number.isFinite(x.r)).sort((a, b) => a.t - b.t);
  const len = part?.len || 0;
  const base = F.filter((x) => x.t >= BASE_FROM && x.t <= BASE_TO);
  // ohne Grundpegel (Mikro zu spät an): ein fester, leiser Wert statt des Raums
  const enough = base.length >= 20;
  const baseHi = enough ? pct(base.map((x) => x.r), 0.9) : 0.004;
  const gate = Math.max(0.006, baseHi * 1.4);
  // Die Lautsprecher folgen der Lautheit des Songs: wird der Refrain 5 dB lauter als die Stelle davor, hebt sich
  // der Raumpegel mit (Lautheit aus der Analyse, höchstens ±10 dB)
  const lb = enough ? base.map((x) => loudAt(part, x.t)).filter((v) => v != null) : [];
  const lRef = lb.length ? lb.reduce((a, b) => a + b, 0) / lb.length : null;
  const gateAt = (t) => {
    const l = lRef == null ? null : loudAt(part, t);
    return l == null ? gate : Math.max(0.006, baseHi * 1.4 * Math.pow(10, Math.max(-10, Math.min(10, l - lRef)) / 20));
  };
  const inPart = F.filter((x) => x.t >= -200 && x.t <= len + 300).map((x) => ({ ...x, g: gateAt(x.t) }));
  const voice = (x) => x.r > x.g && x.f > 0;
  const singer = inPart.filter((x) => voice(x) && x.t >= 0 && x.t <= len);
  // wie weit die Stimme über dem Raum liegt: 4× (12 dB) und mehr ist ein ruhiger Raum
  const q = singer.length ? median(singer.map((x) => x.r / Math.max(x.g / 1.4, 1e-4))) : 0;
  const loud = enough && (baseHi > 0.05 || (singer.length > 10 && q < 2));
  const roomShare = enough ? clamp01((4 - q) / 2.5) : 0;

  // Dabei: welcher Anteil jeder Zeile hörbar gesungen wurde (ein Viertel bis ein Drittel reicht für „ganz“)
  const step = F.length > 1 ? Math.max(5, median(F.slice(1).map((x, i) => x.t - F[i].t))) : 21;
  const lines = part?.ln || [];
  let dabei = 0;
  for (const [a, b] of lines) {
    const e = Math.min(b, a + 6000), n = singer.filter((x) => x.t >= a && x.t < e).length;
    dabei += clamp01((n * step) / Math.max(1, e - a) / 0.35);
  }
  dabei = lines.length ? dabei / lines.length : 0;

  // Timing: jeder erwartete Einsatz bekommt den nächsten gemessenen; eine feste Verzögerung (Lautsprecher, Uhr)
  // wird bis 120 ms verziehen, darüber zählt sie
  const E = part?.on || [], D = detectOnsets(inPart, gate);
  let timing = 0;
  if (E.length && D.length) {
    const near = (t) => D.reduce((b, d) => (Math.abs(d - t) < Math.abs(b - t) ? d : b), D[0]);
    const diffs = E.map((e) => near(e) - e).filter((d) => Math.abs(d) < 500);
    const off = diffs.length >= 3 ? Math.max(-120, Math.min(120, median(diffs))) : 0;
    let sum = 0;
    for (const e of E) {
      const err = Math.abs(near(e + off) - e - off);
      sum += err <= 90 ? 1 : err >= 400 ? 0 : 1 - (err - 90) / 310;
    }
    const hit = D.filter((d) => E.some((e) => Math.abs(d - e - off) < 400)).length / D.length;
    // dichte Einsätze (Silben): wer nur ständig Geräusche macht, trifft viele zufällig, das kostet etwas
    const dense = E.length / Math.max(1, len / 1000) >= 1.2;
    timing = (sum / E.length) * (dense ? 0.6 + 0.4 * hit : 0.85 + 0.15 * hit);
  }

  // Töne: Kosinus je Fenster mit der Analyse, gemittelt; der Raum trifft die Töne des Songs von selbst (er spielt
  // ihn ja), darum zählt im lauten Raum nur, was über seinen eigenen Treffer hinausgeht
  let tones = null;
  if (part?.ch) {
    const m = (list) => {
      const v = list.map((x) => toneMatch(pitchClass(x.f), chromaAt(part, x.t))).filter((x) => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const avg = singer.length >= 8 ? m(singer) : null;
    const room = m(base.filter((x) => x.f > 0)) ?? 0.22;
    const ref = 0.22 + roomShare * Math.max(0, Math.min(0.6, room) - 0.22);
    // kaum gesungen: nichts zu messen, aber auch nichts getroffen
    tones = avg == null ? 0 : clamp01((avg - ref) / (0.85 - ref));
  }

  // gesamt: im lauten Raum zählt das Timing mehr (die Töne hört das Mikro dort kaum sauber)
  const tw = tones == null ? 0 : loud ? 0.15 : 0.35, dw = loud ? 0.3 : 0.25, ww = 1 - tw - dw;
  const total = ww * timing + tw * (tones ?? 0) * Math.min(1, dabei / 0.6) + dw * dabei;
  const r = (v) => Math.round(clamp01(v) * 100);
  return { s: r(total), t: r(timing), p: tones == null ? -1 : r(tones), d: r(dabei), loud };
}
// ein ganzes Signal (Float32Array) wie das Handy in Fenster zerlegen: für Tests und zum Nachrechnen
export function featsOf(signal, sr, t0 = 0) {
  const out = [];
  for (let end = WIN; end <= signal.length; end += HOP) {
    const f = frameFeat(signal.subarray(end - WIN, end), sr);
    out.push({ t: t0 + ((end - WIN / 2) / sr) * 1000, r: f.r, f: f.f });
  }
  return out;
}
