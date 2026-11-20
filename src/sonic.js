/* ---------------------------------------------------------------- Klang-Detektoren: Instrumente und Soundeffekte */
// Rein rechnend, ohne Spotify, Fenster und Zeichnen – darum einzeln testbar (tests/unit/sonic.test.js) und im
// Testlabor auf echten Hörproben messbar. Zwei Quellen, ein Raster:
//  · Spotifys Analyse (Segmente: Lautheit, Helligkeit, Rauschanteil, Anschlag, Tonhöhen) → gridFromSegs(). Liegt über
//    dem ganzen Song, kennt aber keine Frequenzbänder.
//  · die 30-s-Hörprobe (tempo.js zerlegt sie ohnehin per FFT; createFrameSink() sammelt dabei Bänder, Schwerpunkt,
//    Rauschanteil, Tonklassen) → genaue Bänder, aber nur 30 s und an unbekannter Stelle im Song. Daraus wird eine
//    „Palette“ des Songs (welche Instrumente und Effekte er benutzt), die im übrigen Song nur gedämpft und nur in
//    passenden Teilen gilt (instruments.js).
// Alle Schwellen sind relativ zum Song (Median und Streuung): laute und leise Masterings, Spotify-Zahlen und eigene
// FFT-Zahlen landen so auf derselben Skala.
//
// „Nur wenn Mirage sicher ist“: jeder Detektor liefert eine Sicherheit 0..1, gezeigt wird erst ab THR[art]. Dazu die
// Seltenheits-Regel: ein Effekt, der öfter als RARE[art] Mal pro Minute „erkannt“ wird, ist kein Effekt, sondern die
// Textur des Songs – dann fällt die ganze Art für diesen Song weg (außer Sidechain-Pumpen, das ist Textur).
//
// Signal und Verlässlichkeit je Art aus der Hörprobe. Gemessen im Testlabor Runde 11: 201 Deezer-/iTunes-Hörproben mit
// begründeten Etiketten (Training 142, Hold-out 38, Blind 21; Zahlen und Etiketten in tests/unit/fixtures/sonic-eval.json,
// geprüft von tests/unit/sonic-eval.test.js). Präzision / Trefferquote über alle drei Gruppen:
//   kick       Bass-Einsätze (< 150 Hz) im Takt; in Trap die 808, im Rock die Gitarrenwand    0,98 / 0,63
//   sub808     viel Sub (< 64 Hz) mit langem Ausklang, dazu dichte Hi-Hats                    1,00 / 0,50
//   hats       dichte Einsätze > 5 kHz im Achtel-Raster (Trap: 808 + sehr dichte Höhen)       1,00 / 0,63
//   crash      Höhen > 5 kHz klingen nach einem Schlag lange rauschig                         1,00 / 0,27
//   distguitar rauschige, wenig klare Mitten ohne Hi-Hat-Raster und ohne Sub-Teppich           1,00 / 0,58
//   acguitar   Gitarre ohne Band: dunkel, unruhig, kein Schlagzeug, wenige Harmoniewechsel      1,00 / 0,61
//   piano      frei ausklingende Töne bei stillen Höhen (Klavier allein; mit Band kaum)        1,00 / 0,30
//   strings    gehaltene, klare Töne mit Bogenrauschen – kein Chor, keine Pfeifenorgel         1,00 / 0,19
//   pad, organ, bells: aus (Schwelle über 1) – die Zahlen trennen sie nicht von Streichern, Chören und Klavier
//   (Bläser, Saxofon, Chor, Flöte, Harfe, Akkordeon: nur über die Credits, instruments.js – die Klangzahlen
//    unterscheiden sie nicht zuverlässig)
// Effekte (beide Quellen, zeitlich genau; aus der Hörprobe nur als Palette):
//   riser      Helligkeit steigt 2–8 s stetig, Lautheit mit, endet an einer Grenze
//   sweep      dasselbe, aber rauschig (White-Noise-Riser)
//   downlift   nach einem Schlag fällt die Helligkeit 1–4 s stetig, rauschig
//   impact     sehr starker, breitbandiger Einsatz nach einer leiseren Sekunde, mit Nachhall
//   subdrop    Einschlag, danach dunkel und laut (tiefer Sub fällt)
//   orchhit    Einschlag mit klarem Akkord und kurzem Ende
//   stop       mitten im Song 0,25–3 s fast Stille
//   tapestop   vor der Stille fällt die Helligkeit stetig und die Lautheit sinkt (Band „bremst“)
//   revcym     0,5–2,5 s rauschiges Anschwellen, das hart abbricht (rückwärts gespieltes Becken)
//   stutter    sehr schnelle, gleiche Wiederholungen (≥ 11/s), weit dichter als der Song sonst
//   filter     Helligkeit wandert stetig über ≥ 2 s bei gleicher Lautheit (Filterfahrt)
//   pump       Lautheit pumpt im Takt (Sidechain); Hörprobe: mindestens zwei 4-s-Fenster, mit Synth-/Schlagzeug-Rauschen
//   cheer      rauschig, hell, ohne Ton und ohne Takt ≥ 1,5 s (Publikum)
//   siren      klarer Ton, dessen Höhe periodisch auf- und abfährt
//   scratch    Helligkeit springt 3–10× je Sekunde hin und her, rauschig (Vinyl-Scratch) – aus, siehe THR
//   airhorn    2–4 kurze, laute, klare Stöße auf demselben Ton
//   zap        klarer Ton fällt in < 0,15 s um mehr als eine Oktave (Laser)
//   whoosh     rauschiges An- und Abschwellen in 0,4–1,5 s ohne harten Einsatz
//   rewind     Scratch oder schneller Anstieg, direkt danach Stille

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const INST = ["kick", "sub808", "hats", "crash", "distguitar", "acguitar", "piano", "strings", "pad", "organ", "bells"];
const FX = ["riser", "sweep", "downlift", "impact", "subdrop", "orchhit", "stop", "tapestop", "revcym", "stutter", "filter", "pump", "cheer", "siren", "scratch", "airhorn", "zap", "whoosh", "rewind"];
// Schwelle der Sicherheit je Art (darunter: nichts). Schwelle über 1 = aus, weil das Testlabor Runde 11 keine sichere
// Erkennung zeigte: pad, bells, organ (keine Treffer, nur Fehlalarme) und scratch (die vier Turntablism-Stücke blieben
// stumm, „gefunden“ wurden nur Hi-Hat-Rollen in Trap und House). Effekte: auf 201 Hörproben kein Fehlalarm auf Songs, in
// denen der Effekt sicher fehlt; ob sie in einer Hörprobe vorkommen, ließ sich ohne Hören nicht belegen (Trefferquote offen)
const THR = {
  kick: 0.6, sub808: 0.65, hats: 0.6, crash: 0.65, distguitar: 0.65, acguitar: 0.7, piano: 0.65, strings: 0.65, pad: 1.1, organ: 1.1, bells: 1.1,
  riser: 0.6, sweep: 0.6, downlift: 0.65, impact: 0.6, subdrop: 0.65, orchhit: 0.7, stop: 0.6, tapestop: 0.7, revcym: 0.75, stutter: 0.65,
  filter: 0.7, pump: 0.7, cheer: 0.7, siren: 0.8, scratch: 1.1, airhorn: 0.75, zap: 0.8, whoosh: 0.7, rewind: 0.7,
};
// Wie kräftig ein Bild sein darf: knapp über der Schwelle zart (0,4), erst bei voller Sicherheit voll (1). Unter der
// Schwelle 0 – dann zeigt die Laufzeit ohnehin nichts (sonicrt.js, instfx.js)
function strength(k, c) {
  const t = THR[k] ?? 1;
  if (!(c >= t) || t > 1) return 0;
  return Math.round((0.4 + 0.6 * clamp((c - t) / Math.max(0.05, 1 - t), 0, 1)) * 100) / 100;
}
// höchstens so viele je Minute, sonst ist es Textur statt Effekt
const RARE = { riser: 4, sweep: 4, downlift: 4, impact: 5, subdrop: 3, orchhit: 4, stop: 4, tapestop: 2, revcym: 4, stutter: 4, filter: 3, cheer: 3, siren: 3, scratch: 5, airhorn: 3, zap: 4, whoosh: 5, rewind: 2 };

function pct(arr, q) {
  const s = Float32Array.from(arr).filter(Number.isFinite).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
}
// gleitender Mittelwert (Fenster 2w+1), NaN-fest
function smooth(a, w) {
  const n = a.length, out = new Float32Array(n), pre = new Float64Array(n + 1), cnt = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    const ok = Number.isFinite(a[i]);
    pre[i + 1] = pre[i] + (ok ? a[i] : 0);
    cnt[i + 1] = cnt[i] + (ok ? 1 : 0);
  }
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - w), hi = Math.min(n, i + w + 1), c = cnt[hi] - cnt[lo];
    out[i] = c ? (pre[hi] - pre[lo]) / c : NaN;
  }
  return out;
}
// Lage und Streuung (Median, Interquartilsabstand – nie enger als lo)
function scale(a, lo) {
  return { m: pct(a, 0.5), s: Math.max(lo, pct(a, 0.75) - pct(a, 0.25)) };
}
// Anteil steigender Schritte (Schritt st Bilder) zwischen a und b
function mono(arr, a, b, st, dir = 1) {
  let up = 0, n = 0;
  for (let i = a + st; i <= b; i += st) {
    const d = (arr[i] - arr[i - st]) * dir;
    if (!Number.isFinite(d)) continue;
    n++;
    if (d > 0) up++;
  }
  return n ? up / n : 0;
}
const mean = (arr, a, b) => {
  let s = 0, n = 0;
  for (let i = Math.max(0, a); i < Math.min(arr.length, b); i++) if (Number.isFinite(arr[i])) [s, n] = [s + arr[i], n + 1];
  return n ? s / n : NaN;
};
const maxOf = (arr, a, b) => {
  let m = -Infinity;
  for (let i = Math.max(0, a); i < Math.min(arr.length, b); i++) if (arr[i] > m) m = arr[i];
  return m;
};

/* ---- Raster aus Spotify-Segmenten ({ t, l, p[12], b, f, k }) */
function gridFromSegs(segs, r = 20) {
  if (!segs?.length) return null;
  const end = segs[segs.length - 1].t + 0.5, n = Math.ceil(end * r);
  const G = blank(n, r, false);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], a = Math.max(0, Math.floor(s.t * r)), e = Math.min(n, Math.max(a + 1, Math.floor((segs[i + 1]?.t ?? s.t + 0.3) * r)));
    const p = s.p?.length === 12 ? s.p : null;
    let tonal = NaN, pc = -1;
    if (p) {
      const m = p.reduce((x, v) => x + v, 0) / 12;
      tonal = clamp((1 - m) * 1.3 - 0.15, 0, 1);
      pc = p.indexOf(Math.max(...p));
    }
    // Spotifys Helligkeit/Rauschanteil haben eigene Einheiten: relativ zum Song ausgewertet (siehe oben)
    for (let x = a; x < e; x++) {
      G.loud[x] = s.l;
      G.bright[x] = s.b / 60;
      G.flat[x] = s.f / 60;
      G.tonal[x] = tonal;
      G.pc[x] = pc;
    }
    G.att[a] = Math.max(G.att[a], Math.max(0, s.k) / 60);
    G.on[a] = 1;
  }
  finishRate(G);
  return G;
}
function blank(n, r, bands) {
  const F = () => new Float32Array(n).fill(bands ? 0 : NaN);
  return {
    r, n, bands,
    loud: new Float32Array(n).fill(-60), bright: new Float32Array(n), flat: new Float32Array(n), tonal: new Float32Array(n), pc: new Int8Array(n).fill(-1),
    att: new Float32Array(n), on: new Uint8Array(n), rate: new Float32Array(n),
    // Bänder (dB) – nur aus der Hörprobe
    sub: F(), low: F(), mid: F(), air: F(), mflat: F(), lowAtt: F(), airAtt: F(), top1: F(),
  };
}
// Einsätze je Sekunde (gleitend über 0,5 s)
function finishRate(G) {
  const w = Math.max(1, Math.round(G.r * 0.25)), on = Float32Array.from(G.on);
  const sm = smooth(on, w);
  for (let i = 0; i < G.n; i++) G.rate[i] = sm[i] * G.r;
}

/* ---- Sammler für die Hörprobe: bekommt je FFT-Bild (tempo.js) die Spektren und baut ein Raster mit 4 Bildern je Zelle */
function createFrameSink(sr, N) {
  const binHz = sr / N, half = N / 2, GROUP = 4;
  const bin = (hz) => clamp(Math.round(hz / binHz), 1, half - 1);
  const B = { sub: [1, bin(64)], low: [bin(64) + 1, bin(150)], mid: [bin(400), bin(4000)], air: [bin(5000), half - 1] };
  const pcOf = new Int8Array(half).fill(-1);
  for (let k = bin(300); k <= bin(3000); k++) pcOf[k] = ((Math.round(12 * Math.log2((k * binHz) / 440)) + 69) % 12 + 12) % 12;
  const fl = [bin(100), bin(8000)];
  const frames = { E: [], sub: [], low: [], mid: [], air: [], cent: [], flat: [], mflat: [], tonal: [], top1: [], pc: [], flux: [], lflux: [], aflux: [] };
  let prevLow = 0, prevAir = 0;
  const chroma = new Float64Array(12);
  function push(re, im, flux, lowFlux) {
    let E = 0, sub = 0, low = 0, mid = 0, air = 0, cw = 0, sl = 0, sa = 0, ml = 0, ma = 0;
    chroma.fill(0);
    for (let k = 1; k < half; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      E += p;
      cw += p * k;
      if (k <= B.sub[1]) sub += p;
      else if (k <= B.low[1]) low += p;
      if (k >= B.mid[0] && k <= B.mid[1]) {
        mid += p;
        ml += Math.log(p + 1e-9);
        ma += p;
      }
      if (k >= B.air[0]) air += p;
      if (k >= fl[0] && k <= fl[1]) {
        sl += Math.log(p + 1e-9);
        sa += p;
      }
      if (pcOf[k] >= 0) chroma[pcOf[k]] += p;
    }
    const db = (v) => 10 * Math.log10(v + 1e-9);
    const nf = fl[1] - fl[0] + 1, nm = B.mid[1] - B.mid[0] + 1;
    let cs = 0, c1 = 0, c2 = 0, c3 = 0, pc = 0;
    for (let i = 0; i < 12; i++) {
      const v = chroma[i];
      cs += v;
      if (v > c1) [c3, c2, c1, pc] = [c2, c1, v, i];
      else if (v > c2) [c3, c2] = [c2, v];
      else if (v > c3) c3 = v;
    }
    const lowDb = db(low + sub), airDb = db(air);
    frames.E.push(db(E));
    frames.sub.push(db(sub));
    frames.low.push(lowDb);
    frames.mid.push(db(mid));
    frames.air.push(airDb);
    frames.cent.push(E > 0 ? Math.log2(Math.max(50, (cw / E) * binHz) / 1000) : 0);
    // fast stille Bilder (Einblenden aus digitaler Stille am Anfang vieler Hörproben): dort ist der kleine Zuschlag im
    // Logarithmus größer als die Leistung selbst, das Maß liefe gegen unendlich (Testlabor Runde 11: Mittel 0,6 statt 0,01)
    frames.flat.push(sa / nf > 1e-6 ? Math.exp(sl / nf) / (sa / nf) : 0);
    frames.mflat.push(ma / nm > 1e-6 ? Math.exp(ml / nm) / (ma / nm) : 0);
    // klar = die drei stärksten Tonklassen tragen fast alles (Akkord), Rauschen verteilt sich auf alle zwölf
    frames.tonal.push(cs > 0 ? clamp(((c1 + c2 + c3) / cs - 0.3) / 0.45, 0, 1) : 0);
    frames.top1.push(cs > 0 ? c1 / cs : 0);
    frames.pc.push(pc);
    frames.flux.push(flux);
    frames.lflux.push(Math.max(0, lowDb - prevLow));
    frames.aflux.push(Math.max(0, airDb - prevAir));
    prevLow = lowDb;
    prevAir = airDb;
  }
  // Raster bauen: je 4 Bilder eine Zelle (~21,5/s)
  function grid() {
    const nf = frames.E.length, n = Math.floor(nf / GROUP), fps = sr / (N / 4);
    const G = blank(n, fps / GROUP, true);
    // Einsätze: Spitzen des Flusses über Mittel + 1 Streuung, mind. 45 ms auseinander
    const fx = frames.flux;
    let m = 0, s = 0;
    for (const v of fx) m += v;
    m /= Math.max(1, nf);
    for (const v of fx) s += (v - m) ** 2;
    const th = m + Math.sqrt(s / Math.max(1, nf));
    let last = -99;
    const on = new Uint8Array(nf);
    for (let i = 1; i < nf - 1; i++) if (fx[i] > th && fx[i] >= fx[i - 1] && fx[i] > fx[i + 1] && i - last > fps * 0.045) [on[i], last] = [1, i];
    const avgDb = (arr, a) => 10 * Math.log10((Math.pow(10, arr[a] / 10) + Math.pow(10, arr[a + 1] / 10) + Math.pow(10, arr[a + 2] / 10) + Math.pow(10, arr[a + 3] / 10)) / 4 + 1e-9);
    for (let x = 0; x < n; x++) {
      const a = x * GROUP;
      G.loud[x] = avgDb(frames.E, a);
      G.sub[x] = avgDb(frames.sub, a);
      G.low[x] = avgDb(frames.low, a);
      G.mid[x] = avgDb(frames.mid, a);
      G.air[x] = avgDb(frames.air, a);
      let c = 0, f = 0, mf = 0, t = 0, t1 = 0, at = 0, la = 0, aa = 0, o = 0;
      const votes = new Float32Array(12);
      for (let j = a; j < a + GROUP; j++) {
        c += frames.cent[j];
        f += frames.flat[j];
        mf += frames.mflat[j];
        t += frames.tonal[j];
        t1 += frames.top1[j];
        votes[frames.pc[j]] += frames.tonal[j];
        at = Math.max(at, fx[j]);
        la = Math.max(la, frames.lflux[j]);
        aa = Math.max(aa, frames.aflux[j]);
        o += on[j];
      }
      G.bright[x] = c / GROUP;
      G.flat[x] = f / GROUP;
      G.mflat[x] = mf / GROUP;
      G.tonal[x] = t / GROUP;
      G.top1[x] = t1 / GROUP;
      G.pc[x] = votes.indexOf(Math.max(...votes));
      G.att[x] = at;
      G.lowAtt[x] = la;
      G.airAtt[x] = aa;
      G.on[x] = o ? 1 : 0;
      G.onN = G.onN || new Uint8Array(n);
      G.onN[x] = o;
    }
    // Einsatzdichte aus den Bildern selbst (feiner als das Raster): je Zelle, gleitend über 0,5 s
    const sm = smooth(Float32Array.from(on), Math.round(fps * 0.25));
    for (let x = 0; x < n; x++) G.rate[x] = mean(sm, x * GROUP, x * GROUP + GROUP) * fps;
    // Ziel-Einheit des Anschlags: wie bei Spotify relativ zum Song
    const sa = scale(G.att, 1e-6);
    for (let x = 0; x < n; x++) G.att[x] = Math.max(0, (G.att[x] - sa.m) / sa.s);
    G.frames = frames;
    G.fps = fps;
    return G;
  }
  return { push, grid };
}

/* ---- Palette: welche Instrumente benutzt der Song? (Hörprobe, ganze 30 s) */
// feats: die Klangzahlen fürs Testlabor; conf: Sicherheit je Art (0..1). bpm: Tempo (tempo.js), 0 = unbekannt
function palette(G, bpm = 0) {
  const feats = {};
  if (!G?.bands || G.n < G.r * 8) return { conf: paletteConf(null), feats };
  const r = G.r, n = G.n, beat = bpm > 0 ? 60 / bpm : 0.5;
  const loudM = pct(G.loud, 0.5);
  const active = (x) => G.loud[x] > loudM - 15;
  // Bänder relativ zur Gesamtlautheit
  let subRel = 0, lowRel = 0, airRel = 0, midRel = 0, cnt = 0;
  for (let x = 0; x < n; x++) {
    if (!active(x)) continue;
    cnt++;
    subRel += G.sub[x] - G.loud[x];
    lowRel += G.low[x] - G.loud[x];
    airRel += G.air[x] - G.loud[x];
    midRel += G.mid[x] - G.loud[x];
  }
  cnt = Math.max(1, cnt);
  [subRel, lowRel, airRel, midRel] = [subRel / cnt, lowRel / cnt, airRel / cnt, midRel / cnt];
  // Einsätze je Band (Bild-genau): Bass-Einsätze ≥ 6 dB, Höhen-Einsätze ≥ 6 dB
  const fr = G.frames, fps = G.fps, nf = fr.E.length;
  const peaks = (arr, th, gap) => {
    const out = [];
    let last = -99;
    for (let i = 1; i < nf - 1; i++) {
      if (arr[i] >= th && arr[i] >= arr[i - 1] && arr[i] >= arr[i + 1] && i - last > gap) {
        out.push(i);
        last = i;
      }
    }
    return out;
  };
  const lowOn = peaks(fr.lflux, 6, fps * 0.12), airOn = peaks(fr.aflux, 6, fps * 0.06);
  const dur = nf / fps;
  feats.lowRate = lowOn.length / dur;
  feats.airRate = airOn.length / dur;
  // Regelmäßigkeit: Anteil der Bass-Einsätze, die auf ein Raster im Tempo (Viertel oder Achtel) fallen
  const onGrid = (ons, per) => {
    if (ons.length < 6) return 0;
    let best = 0;
    for (let ph = 0; ph < 1; ph += 0.05) {
      let hit = 0;
      for (const i of ons) {
        const q = (i / fps / per + ph) % 1;
        if (q < 0.12 || q > 0.88) hit++;
      }
      best = Math.max(best, hit / ons.length);
    }
    return best;
  };
  feats.lowGrid = onGrid(lowOn, beat / 2);
  feats.airGrid = onGrid(airOn, beat / 4);
  // Ausklang des Subs nach Bass-Einsätzen: wie lange bleibt er innerhalb 8 dB (s)
  let sus = 0, nsus = 0;
  for (const i of lowOn) {
    const p = fr.sub[i + 2] ?? fr.sub[i];
    if (p - fr.E[i] < -18) continue;
    let j = i + 2;
    while (j < nf && j - i < fps * 1.2 && fr.sub[j] > p - 8) j++;
    sus += (j - i) / fps;
    nsus++;
  }
  feats.subSus = nsus ? sus / nsus : 0;
  feats.subRel = subRel;
  feats.lowRel = lowRel;
  feats.airRel = airRel;
  feats.midRel = midRel;
  // Rauschanteil, Klarheit, Mitten-Rauschen, Einsatzdichte, Dynamik
  const act = [];
  for (let x = 0; x < n; x++) if (active(x)) act.push(x);
  const avg = (key) => act.reduce((s, x) => s + G[key][x], 0) / Math.max(1, act.length);
  feats.flat = avg("flat");
  feats.mflat = avg("mflat");
  feats.tonal = avg("tonal");
  feats.top1 = avg("top1");
  feats.bright = avg("bright");
  feats.rate = avg("rate");
  feats.dyn = pct(G.loud, 0.9) - pct(G.loud, 0.1);
  // Ausklang mittlerer Töne: nach einem Einsatz fällt die Mitte stetig (Klavier, Glocken, Zupfen) statt zu stehen
  let dec = 0, nd = 0, stand = 0;
  for (let x = 2; x < n - r; x++) {
    if (!G.on[x] || !active(x)) continue;
    const a = G.mid[x], b = G.mid[Math.min(n - 1, x + Math.round(r * 0.5))];
    // kein neuer Einsatz in der halben Sekunde danach: dann ist der Ausklang frei hörbar
    let free = true;
    for (let y = x + 2; y < x + Math.round(r * 0.5); y++) if (G.on[y] && G.att[y] > 0.8) free = false;
    if (!free) continue;
    nd++;
    if (a - b > 4) dec++;
    if (Math.abs(a - b) < 2) stand++;
  }
  feats.decay = nd ? dec / nd : 0;
  feats.stand = nd ? stand / nd : 0;
  feats.freeOn = nd / dur;
  // Gleichförmigkeit des Spektrums von Zelle zu Zelle (Orgel, Fläche: sehr ruhig)
  let jit = 0;
  for (let x = 1; x < n; x++) jit += Math.abs(G.mid[x] - G.mid[x - 1]) + Math.abs(G.air[x] - G.air[x - 1]);
  feats.jitter = jit / Math.max(1, n - 1);
  // Arpeggio: viele Einsätze, je Einsatz eine andere stärkste Tonklasse, klar
  let pcMove = 0, pcN = 0, lastPc = -1;
  for (let x = 0; x < n; x++) {
    if (!G.on[x] || G.tonal[x] < 0.45) continue;
    if (lastPc >= 0) [pcMove, pcN] = [pcMove + (G.pc[x] !== lastPc ? 1 : 0), pcN + 1];
    lastPc = G.pc[x];
  }
  feats.pcMove = pcN ? pcMove / pcN : 0;
  // Becken: nach einem Höhen-Einsatz bleiben die Höhen ≥ 0,5 s oben (innerhalb 6 dB) – je Minute
  let crash = 0;
  const airHi = pct(fr.air, 0.75);
  for (const i of airOn) {
    if (fr.air[i] < airHi) continue;
    let j = i;
    while (j < nf && j - i < fps * 2 && fr.air[j] > fr.air[i] - 6) j++;
    if (j - i > fps * 0.5) crash++;
  }
  feats.crashRate = (crash / dur) * 60;

  return { conf: paletteConf(feats), feats };
}

// Sicherheiten der Palette aus den Klangzahlen – eigene Funktion, damit das Regressions-Fixture (tests/unit/fixtures/
// sonic-eval.json: nur Zahlen, keine Hörproben) sie ohne Audio nachrechnen kann.
// Eingestellt im Testlabor Runde 11 (142 Hörproben, Etiketten mit Begründung, Präzision vor Trefferquote; Zahlen im
// CHANGELOG/Bericht). Gemessen je Art: Treffer / Fehlalarme auf Songs, in denen die Art sicher fehlt.
function paletteConf(feats) {
  const f = feats, conf = Object.fromEntries(INST.map((k) => [k, 0]));
  if (!f || !Number.isFinite(f.flat)) return conf;
  const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  const inv = (v, a, b) => 1 - ramp(v, a, b);
  // Schlagzeug-Rauschen überhaupt da (akustische Musik: Rauschanteil ≈ 0)
  const kit = ramp(f.flat, 0.012, 0.03);
  conf.kick = ramp(f.lowGrid, 0.5, 0.68) * ramp(f.lowRate, 0.5, 1) * ramp(f.lowRel, -14, -9) * kit;
  // 808: sehr viel Sub im Verhältnis zum Ganzen, langer Ausklang nach den Bass-Einsätzen, dazu Schlagzeug-Rauschen.
  // Früher nur zusammen mit einer erkannten Kick – aber die 808 klingt im Bass weiter, darum sah die Kick-Prüfung bei
  // Trap kaum Einsätze (Testlabor: 0 von 9 Trap-Songs, jetzt 6 von 9, kein Fehlalarm)
  conf.sub808 = ramp(f.subRel, -11.5, -8.5) * ramp(f.subSus, 0.42, 0.55) * ramp(f.airRate, 2.5, 3.3) * ramp(f.flat, 0.012, 0.02);
  conf.hats = ramp(f.airRate, 1.2, 1.6) * ramp(f.airGrid, 0.58, 0.66) * ramp(f.airRel, -35, -28) * kit;
  // Trap: Hi-Hat-Rollen (Triolen, 32tel) fallen nicht ins Achtel-Raster – dort reicht die 808 plus sehr dichte Höhen
  conf.hats = Math.max(conf.hats, conf.sub808 * ramp(f.airRate, 3, 4) * ramp(f.airRel, -30, -26));
  conf.crash = ramp(f.crashRate, 4, 10) * kit;
  // Verzerrte Gitarre: rauschige, wenig klare Mitten; Supersaw-Flächen (EDM) sind klarer und laufen über einem starren
  // Hi-Hat-Raster, Dubstep-Bässe bringen viel mehr Sub
  conf.distguitar = ramp(f.mflat, 0.14, 0.24) * inv(f.tonal, 0.72, 0.8) * ramp(f.midRel, -10, -7.5) * inv(f.subRel, -8, -6) * inv(f.airGrid, 0.84, 0.95) * ramp(f.bright, -1.6, -1.2) * inv(f.subSus, 0.42, 0.5);
  // In Trap trägt die 808 den Schlag, im Rock geht die Kick unter der Gitarrenwand unter – beides heißt: Schlagzeug läuft
  conf.kick = Math.max(conf.kick, conf.sub808, conf.distguitar);
  // Klavier: (a) frei ausklingende Töne bei stillen Höhen und vielen freien Einsätzen, (b) Klavier allein: ruhiges
  // Spektrum (keine Anschlag-Unruhe wie bei der Gitarre), kein Rauschen. Klavier mit Band/Stimme bleibt unerkannt
  conf.piano = Math.max(
    ramp(-f.airRel, 45, 50) * ramp(f.decay, 0.28, 0.38) * ramp(f.tonal, 0.84, 0.9) * ramp(f.freeOn, 0.45, 0.6),
    ramp(-f.airRel, 40, 45) * ramp(f.decay, 0.3, 0.4) * ramp(f.tonal, 0.8, 0.85) * inv(f.jitter, 3.4, 4.2) * inv(f.flat, 0.002, 0.006),
  );
  // Streicher – aber kein Chor (Stimmen ohne Bass-Instrumente drängen sich in die Mitten 400 Hz–4 kHz, darunter fast
  // nichts; Testlabor: 4 von 8 A-cappella-Chören waren „Streicher“) und keine Pfeifenorgel (starker Pedal-Bass unter
  // vollkommen gehaltenen Tönen)
  const choir = ramp(f.midRel, -2.2, -1.4) * ramp(-f.lowRel, 18, 24);
  const pipe = ramp(f.lowRel, -8, -6) * ramp(f.stand, 0.55, 0.65);
  conf.strings = ramp(f.tonal, 0.74, 0.8) * ramp(f.midRel, -7, -5.5) * inv(f.flat, 0.02, 0.04) * ramp(-f.airRel, 21, 26) * inv(-f.airRel, 42, 46) * inv(f.jitter, 4.5, 6) * inv(f.decay, 0.3, 0.42) * (1 - choir) * (1 - pipe) * ramp(f.mflat, 0.028, 0.04);
  // Fläche, Orgel, Glocken: die Zahlen trennen sie nicht von Streichern, Chören, Bluegrass-Banjo und Klavier
  // (Testlabor Runde 11: Fläche 0 von 4 Ambient-Stücken, 1 Fehlalarm; Glocken 0 von 3, 3 Fehlalarme; Orgel 0 von 7).
  // Die Formeln bleiben für die Fehlersuche, die Schwellen (THR) liegen über 1 – die Bilder kommen nie aus der Hörprobe.
  conf.pad = ramp(f.stand, 0.38, 0.5) * inv(f.decay, 0.15, 0.28) * ramp(f.tonal, 0.72, 0.8) * ramp(f.subRel, -16, -11);
  conf.organ = inv(f.mflat, 0.04, 0.07) * ramp(f.tonal, 0.84, 0.88) * ramp(f.top1, 0.38, 0.41) * inv(f.subRel, -17, -13) * inv(f.decay, 0.25, 0.4) * ramp(f.stand, 0.2, 0.3);
  conf.bells = ramp(f.tonal, 0.84, 0.88) * ramp(f.top1, 0.38, 0.42) * ramp(f.decay, 0.3, 0.4) * inv(f.mflat, 0.08, 0.12) * ramp(f.bright, -1.2, -0.9) * inv(-f.airRel, 46, 50);
  // Akustikgitarre: (a) hell gezupft mit vielen Höhen-Einsätzen, (b) ohne Band: kein Schlagzeug-Rauschen, dunkel,
  // Mitten zurückgenommen, unruhig (Anschläge), nicht nur gehalten (Streicher), keine Klavier-Stille in den Höhen und
  // wenige Harmoniewechsel je Anschlag (Folk schlägt denselben Akkord; Jazz-Orgel wechselt ständig)
  conf.acguitar = Math.max(
    ramp(f.tonal, 0.85, 0.9) * ramp(f.top1, 0.4, 0.45) * ramp(f.airRate, 1.5, 2) * inv(f.bright, -1.4, -1.1) * ramp(f.jitter, 4.5, 5.5) * inv(-f.airRel, 47, 50),
    inv(f.flat, 0.012, 0.02) * ramp(-f.midRel, 5, 6) * ramp(f.jitter, 3.8, 4.5) * inv(f.bright, -1, -0.8) * ramp(f.tonal, 0.72, 0.76) * inv(f.decay, 0.75, 0.9) * inv(-f.airRel, 46, 50) * inv(f.pcMove, 0.72, 0.78),
  );
  for (const k of INST) conf[k] = Math.round(clamp(conf[k] || 0, 0, 1) * 100) / 100;
  return conf;
}

/* ---- Effekte im Raster (beide Quellen). Rückgabe: [{ k, t, dur, c }] – nur Ereignisse über der Schwelle */
function detectFx(G, { bpm = 0, keepAll = false } = {}) {
  const ev = [];
  if (!G || G.n < G.r * 4) return ev;
  const r = G.r, n = G.n, S = (s) => Math.max(1, Math.round(s * r));
  const L = smooth(G.loud, S(0.15)), Bs = smooth(G.bright, S(0.25)), Fs = smooth(G.flat, S(0.25));
  const sb = scale(Bs, G.bands ? 0.15 : 0.1), sf = scale(Fs, G.bands ? 0.03 : 0.08);
  const loudM = pct(G.loud, 0.5), attHi = Math.max(1.5, pct(G.att, 0.97)), rateM = pct(G.rate, 0.5);
  const kitSong = G.bands ? clamp((pct(G.flat, 0.75) - 0.01) / 0.02, 0, 1) : 1;
  // Effekte aus Produktion und DJ-Pult gibt es nur in Musik mit Schlagzeug/Rauschen (kitSong, unten): im Testlabor
  // waren sonst Pausen im Streichquartett „Stopps“ und Bogenstriche „Scratches“
  const STUDIO = new Set(["riser", "sweep", "downlift", "stop", "tapestop", "revcym", "stutter", "filter", "pump", "siren", "scratch", "airhorn", "zap", "whoosh", "rewind", "subdrop"]);
  const push = (k, t0, d, c) => {
    if (STUDIO.has(k)) c *= kitSong;
    if (c > 0.01) ev.push({ k, t: Math.round((t0 / r) * 100) / 100, dur: Math.round((d / r) * 100) / 100, c: Math.round(clamp(c, 0, 1) * 100) / 100 });
  };
  const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  // Hörprobe: zusätzlich absolute Maße – Helligkeit in Oktaven, echter Rauschanteil (Schlagzeug, Rauschen). Akustische
  // Musik (Streichquartett, Klavier) hat kaum Rauschen; ohne diese Prüfung „fand“ das Testlabor dort Riser und Einschläge
  const A = !!G.bands;
  const oct = (d, a, b) => (A ? ramp(Math.abs(d), a, b) : 1);
  const noiseAbs = (a, b, lo, hi) => (A ? ramp(mean(G.flat, a, b), lo, hi) : 1);
  // Grenzen: starker Einsatz oder Lautheitssprung ≥ 4 dB in 0,3 s
  const bound = new Uint8Array(n);
  for (let x = S(0.3); x < n - 1; x++) if (G.att[x] >= attHi || L[x] - L[x - S(0.3)] >= 4) bound[x] = 1;

  // Riser / Sweep: vor einer Grenze steigt die Helligkeit über 2–8 s stetig an
  let lastEnd = -1e9;
  for (let e = S(2); e < n; e++) {
    if (!bound[e] || e - lastEnd < S(2)) continue;
    let best = null;
    for (const len of [2, 3, 4, 6, 8]) {
      const a = e - S(len), b = e - 1;
      if (a < 0) break;
      const rise = (Bs[b] - Bs[a]) / sb.s, m = mono(Bs, a, b, S(0.25)), lr = L[b] - L[a];
      const c = ramp(rise, 1.2, 2.4) * ramp(m, 0.75, 0.92) * ramp(lr, 0.5, 4) * oct(Bs[b] - Bs[a], 0.6, 1);
      // bei fast gleicher Sicherheit das kürzere Fenster (der Riser selbst, nicht der Anlauf davor)
      if (!best || c > best.c * 1.15) best = { a, len: S(len), c, noisy: A ? mean(G.flat, a, b) > 0.12 : mean(G.flat, a, b) > sf.m + sf.s * 0.6 };
    }
    if (best && best.c > 0.05) {
      push(best.noisy ? "sweep" : "riser", best.a, best.len, best.c);
      if (best.c >= 0.5) lastEnd = e;
    }
  }
  // Downlifter: nach einer Grenze fällt die Helligkeit 1–4 s stetig, rauschig, leiser werdend
  for (let s0 = 0; s0 < n - S(1); s0++) {
    if (!bound[s0]) continue;
    let best = 0, bl = 0;
    // ab 1,5 s: der Nachhall eines Einschlags allein fällt kürzer
    for (const len of [1.5, 2, 3, 4]) {
      const b = s0 + S(len);
      if (b >= n) break;
      const fall = (Bs[s0 + 1] - Bs[b]) / sb.s, m = mono(Bs, s0 + 1, b, S(0.2), -1), lf = L[s0 + 1] - L[b];
      const c = ramp(fall, 1, 2) * ramp(m, 0.7, 0.88) * ramp(lf, 1, 5) * ramp(mean(G.flat, s0, b), sf.m, sf.m + sf.s);
      if (c > best) [best, bl] = [c, S(len)];
    }
    push("downlift", s0, bl, best);
  }
  // Einschläge: sehr starker Einsatz nach einer leiseren Sekunde, danach Nachhall
  for (let x = S(1.2); x < n - S(0.6); x++) {
    if (G.att[x] < attHi || G.att[x] < G.att[x - 1] || G.att[x] < G.att[x + 1]) continue;
    const before = mean(L, x - S(1.2), x - S(0.15)), after = mean(L, x, x + S(0.3)), tail = mean(L, x + S(0.3), x + S(0.6));
    const jump = after - before;
    const broad = G.bands ? ramp(maxOf(G.low, x, x + 3) - mean(G.low, x - S(1), x - 1), 3, 9) * ramp(maxOf(G.air, x, x + 3) - mean(G.air, x - S(1), x - 1), 3, 9) : ramp(G.att[x], attHi, attHi * 1.6);
    const ring = ramp(tail - (after - 12), 0, 6);
    let c = ramp(jump, 5, 9) * broad * (0.5 + 0.5 * ring) * noiseAbs(x, x + 2, 0.06, 0.15);
    if (c <= 0.05) continue;
    // danach dunkel und laut: Sub-Drop · klarer Akkord mit kurzem Ende: Orchester-Schlag
    const dark = mean(Bs, x + S(0.3), x + S(1.2)), darkZ = (dark - sb.m) / sb.s;
    const subHeavy = G.bands ? mean(G.sub, x + S(0.2), x + S(1)) - mean(G.loud, x + S(0.2), x + S(1)) : NaN;
    const subC = G.bands ? ramp(subHeavy, -9, -4) * ramp(-darkZ, 0.3, 1.2) : ramp(-darkZ, 0.8, 1.8) * ramp(mean(L, x + S(0.3), x + S(1.2)) - loudM, -2, 3);
    const ton = mean(G.tonal, x, x + S(0.25)), short = after - tail;
    const orchC = ramp(ton, 0.55, 0.75) * ramp(short, 5, 10);
    if (subC >= 0.6) push("subdrop", x, S(1.2), c * subC);
    else if (orchC >= 0.6) push("orchhit", x, S(0.6), c * orchC);
    else push("impact", x, S(0.9), c);
    x += S(0.5);
  }
  // Stille mitten in der Musik (Stopp) – davor Bremsen (Tape-Stop), Scratch/Anstieg (Rewind)
  for (let x = S(2); x < n - S(0.5); ) {
    if (!(L[x] < loudM - 18)) {
      x++;
      continue;
    }
    let y = x;
    while (y < n && L[y] < loudM - 15) y++;
    const len = (y - x) / r;
    const pre = mean(L, x - S(2), x - S(0.6)), post = mean(L, y, y + S(1));
    if (len >= 0.25 && len <= 3 && pre > loudM - 6 && (y >= n - 1 || post > loudM - 8)) {
      // davor lief eine Band mit Schlagzeug (sonst ist es eine Pause im Lied, kein Effekt)
      const c = ramp(pre - mean(L, x, y), 15, 25) * noiseAbs(x - S(2), x - S(0.3), 0.015, 0.04);
      push("stop", x, y - x, c);
      // Tape-Stop: in 0,3–1,5 s davor stetig dunkler und leiser (nicht abrupt)
      let ts = 0;
      for (const d of [0.4, 0.8, 1.2]) {
        const a = x - S(d);
        const fall = (Bs[a] - Bs[x - 1]) / sb.s, m = mono(Bs, a, x - 1, 1, -1), lf = L[a] - L[x - 1];
        ts = Math.max(ts, ramp(fall, 1.2, 2.4) * ramp(m, 0.7, 0.9) * ramp(lf, 4, 10));
      }
      push("tapestop", x - S(1.2), S(1.2) + (y - x), ts * c);
      // Rewind: kurz davor springt die Helligkeit schnell nach oben, rauschig
      const a = x - S(1);
      const rw = ramp((maxOf(Bs, a, x) - Bs[a]) / sb.s, 1.5, 3) * ramp(mean(G.flat, a, x), sf.m + sf.s * 0.5, sf.m + sf.s * 1.5);
      push("rewind", a, S(1) + (y - x), rw * c);
    }
    x = y + 1;
  }
  // Rückwärts-Becken: 0,5–2,5 s rauschiges Anschwellen, das hart abbricht
  for (let e = S(1); e < n - S(0.2); e++) {
    const drop = L[e - 1] - mean(L, e + 1, e + S(0.2));
    if (!(G.att[e] >= attHi * 0.8 || drop >= 8)) continue;
    let best = 0, bl = 0;
    for (const len of [0.5, 1, 1.5, 2.5]) {
      const a = e - S(len);
      if (a < 0) break;
      const lr = L[e - 1] - L[a], m = mono(L, a, e - 1, 1), noisy = (A ? mean(G.flat, a, e) > 0.12 : mean(Fs, a, e) > sf.m + sf.s * 0.8) ? 1 : 0;
      const c = ramp(lr, 8, 16) * ramp(m, 0.75, 0.92) * noisy;
      if (c > best) [best, bl] = [c, S(len)];
    }
    if (best > 0.05) {
      push("revcym", e - bl, bl, best);
      e += S(1);
    }
  }
  // Stotter-Effekt: sehr schnelle Wiederholungen, viel dichter als der Song sonst
  for (let x = 0; x < n; ) {
    if (!(G.rate[x] >= 11)) {
      x++;
      continue;
    }
    let y = x;
    while (y < n && G.rate[y] >= 9) y++;
    const len = (y - x) / r;
    if (len >= 0.3 && len <= 2.5) {
      // gleiche Wiederholungen: die Helligkeit schwankt kaum
      let v = 0;
      for (let i = x + 1; i < y; i++) v += Math.abs(G.bright[i] - G.bright[i - 1]);
      const steady = 1 - ramp(v / Math.max(1, y - x - 1) / sb.s, 0.4, 1);
      push("stutter", x, y - x, ramp(rateM ? (G.rate[x] + G.rate[y - 1]) / 2 / rateM : 3, 2, 3.5) * steady * ramp(len, 0.3, 0.6));
    }
    x = y + 1;
  }
  // Filterfahrt: Helligkeit wandert ≥ 2 s stetig, Lautheit bleibt, nicht rauschig
  for (let a = 0; a + S(2) < n; a += S(0.5)) {
    let best = 0, bl = 0;
    for (const len of [2, 3, 4, 6]) {
      const b = a + S(len);
      if (b >= n) break;
      const d = (Bs[b] - Bs[a]) / sb.s, dir = d > 0 ? 1 : -1, m = mono(Bs, a, b, S(0.25), dir), lr = Math.abs(L[b] - L[a]);
      const c = ramp(Math.abs(d), 1.5, 2.5) * ramp(m, 0.8, 0.95) * (1 - ramp(lr, 2.5, 4)) * (1 - ramp(mean(Fs, a, b), sf.m + sf.s * 0.5, sf.m + sf.s)) * oct(Bs[b] - Bs[a], 0.7, 1.1);
      if (c > best) [best, bl] = [c, S(len)];
    }
    if (best > 0.05) {
      push("filter", a, bl, best);
      a += bl;
    }
  }
  // Sidechain-Pumpen: Lautheit schwingt im Takt (Autokorrelation beim Schlagabstand), mit Tiefe ≥ 4 dB
  if (A) {
    // Hörprobe: die Mitten (nicht der Bass selbst) tauchen direkt nach jedem Bass-Einsatz ab und schwellen bis zum
    // nächsten wieder an – genau das macht ein Sidechain-Kompressor mit Flächen und Akkorden
    const win = S(4);
    for (let a = 0; a + win < n; a += win) {
      let d = 0, k = 0;
      for (let x = a; x < a + win - S(0.45); x++) {
        if (!(G.lowAtt[x] >= 6)) continue;
        d += mean(G.mid, x + S(0.25), x + S(0.4)) - mean(G.mid, x + 1, x + S(0.12));
        k++;
        x += S(0.2);
      }
      const held = mean(G.loud, a, a + win) > loudM - 6 ? 1 : 0;
      // dazu Schlagzeug-/Synth-Rauschen im Fenster: der Boom-Chicka-Takt im Country (Bass auf dem Schlag, Besen
      // dazwischen) und Walzer-Begleitungen ducken die Mitten auch (Testlabor Runde 11)
      if (k >= 4) push("pump", a, win, ramp(d / k, 2, 5) * held * ramp(mean(G.flat, a, a + win), 0.03, 0.05));
    }
  } else if (bpm > 0) {
    const lag = Math.round((60 / bpm) * r), win = S(4);
    if (lag >= 3) {
      for (let a = 0; a + win + lag < n; a += win) {
        const seg = [];
        for (let x = a; x < a + win; x++) seg.push(G.loud[x] - mean(L, x - S(0.6), x + S(0.6)));
        const m0 = seg.reduce((s, v) => s + v, 0) / seg.length;
        let c0 = 0, c1 = 0, c2 = 0;
        for (let i = 0; i < seg.length; i++) {
          c0 += (seg[i] - m0) ** 2;
          if (i + lag < seg.length) c1 += (seg[i] - m0) * (seg[i + lag] - m0);
          if (i + Math.round(lag / 2) < seg.length) c2 += (seg[i] - m0) * (seg[i + Math.round(lag / 2)] - m0);
        }
        const ac = c0 > 0 ? (c1 / c0) * (seg.length / (seg.length - lag)) : 0, half = c0 > 0 ? c2 / c0 : 0;
        const depth = pct(seg, 0.9) - pct(seg, 0.1);
        // gehaltener Klang dazwischen (nicht nur einzelne Schläge in der Stille): wenig rauschig, keine Lücken
        const held = mean(G.loud, a, a + win) > loudM - 6 ? 1 : 0;
        push("pump", a, win, ramp(ac, 0.35, 0.6) * ramp(-half, 0.05, 0.3) * ramp(depth, 4, 8) * held * noiseAbs(a, a + win, 0.015, 0.04));
      }
    }
  }
  // Publikum: rauschig, hell, ohne Ton, ohne Takt, ≥ 1,5 s
  for (let a = 0; a + S(1.5) < n; a += S(0.5)) {
    const b = a + S(1.5);
    // gleichbleibend (ein Riser oder Sweep wandert, Jubel steht)
    const c = (1 - ramp(Math.abs(Bs[b] - Bs[a]) / sb.s, 0.6, 1.2)) * ramp(mean(Fs, a, b), sf.m + sf.s * 0.8, sf.m + sf.s * 1.8) * (1 - ramp(mean(G.tonal, a, b), 0.25, 0.4)) * ramp((mean(Bs, a, b) - sb.m) / sb.s, 0, 0.8) * (1 - ramp(maxOf(G.att, a, b), attHi * 0.7, attHi)) * ramp(mean(L, a, b), loudM - 14, loudM - 6);
    if (c > 0.05) {
      push("cheer", a, b - a, c);
      a += S(1.5);
    }
  }
  // Sirene: klarer Ton, Helligkeit fährt periodisch (0,3–2 s) auf und ab
  for (let a = 0; a + S(2) < n; a += S(0.5)) {
    const b = a + S(2);
    if (mean(G.tonal, a, b) < (A ? 0.8 : 0.55) || mean(G.rate, a, b) > 2.5) continue;
    let best = 0;
    for (let lag = S(0.3); lag <= S(1); lag++) {
      let c0 = 0, c1 = 0;
      const m0 = mean(G.bright, a, b);
      for (let x = a; x < b; x++) {
        c0 += (G.bright[x] - m0) ** 2;
        if (x + lag < b) c1 += (G.bright[x] - m0) * (G.bright[x + lag] - m0);
      }
      const ac = c0 > 0 ? (c1 / c0) * ((b - a) / (b - a - lag)) : 0;
      best = Math.max(best, ac);
    }
    const amp = (pct(G.bright.subarray(a, b), 0.9) - pct(G.bright.subarray(a, b), 0.1)) / sb.s;
    const c = ramp(best, 0.6, 0.85) * ramp(amp, 0.8, 1.6) * (1 - ramp(maxOf(G.att, a, b), attHi * 0.8, attHi * 1.2)) * oct(amp * sb.s, 0.5, 0.8);
    if (c > 0.05) {
      push("siren", a, b - a, c);
      a += S(2);
    }
  }
  // Scratch: Helligkeit wechselt 3–10× je Sekunde die Richtung, groß und rauschig
  for (let a = 0; a + S(0.6) < n; a += S(0.3)) {
    const b = a + S(0.6);
    let turns = 0, amp = 0;
    for (let x = a + 1; x < b - 1; x++) {
      const d1 = G.bright[x] - G.bright[x - 1], d2 = G.bright[x + 1] - G.bright[x];
      if (d1 * d2 < 0) {
        turns++;
        amp += Math.abs(d1);
      }
    }
    const tps = turns / 0.6, ampZ = turns ? amp / turns / sb.s : 0;
    const c = ramp(tps, 6, 10) * ramp(ampZ, 0.8, 1.6) * ramp(mean(G.flat, a, b), sf.m + sf.s * 0.3, sf.m + sf.s * 1.2) * (tps <= 22 ? 1 : 0) * oct(ampZ * sb.s, 0.35, 0.6) * noiseAbs(a, b, 0.05, 0.12);
    if (c > 0.05) {
      push("scratch", a, b - a, c);
      a += S(0.6);
    }
  }
  // Air-Horn: 2–4 kurze, laute, klare Stöße (0,1–0,45 s) auf demselben Ton binnen 2 s
  {
    const bursts = [];
    for (let x = 1; x < n; ) {
      if (!(L[x] > loudM + 3 && G.tonal[x] > 0.55 && L[x - 1] <= loudM + 3)) {
        x++;
        continue;
      }
      let y = x;
      while (y < n && L[y] > loudM + 1) y++;
      const len = (y - x) / r;
      if (len >= 0.1 && len <= 0.45 && (Bs[x] - sb.m) / sb.s > 0.3) bursts.push({ x, y, pc: G.pc[x + 1] ?? G.pc[x] });
      x = y + 1;
    }
    for (let i = 0; i < bursts.length; i++) {
      let j = i;
      while (j + 1 < bursts.length && bursts[j + 1].x - bursts[i].x <= S(2) && bursts[j + 1].pc === bursts[i].pc) j++;
      const cnt = j - i + 1;
      if (cnt >= 2 && cnt <= 4) {
        push("airhorn", bursts[i].x, bursts[j].y - bursts[i].x, ramp(cnt, 2, 3) * 0.95);
        i = j;
      }
    }
  }
  // Laser-Zap (nur Hörprobe, Bilder-genau): Schwerpunkt fällt in < 0,15 s um mehr als eine Oktave, klarer Ton
  if (G.frames) {
    const fr = G.frames, fps = G.fps, w = Math.round(fps * 0.15), medE = pct(fr.E, 0.5);
    for (let i = 1; i + w < fr.cent.length; i++) {
      const fall = fr.cent[i] - fr.cent[i + w];
      // hoch beginnen (> 1,4 kHz), kein Bass-Einsatz (eine Kick fällt auch schnell ab)
      if (fall < 1 || fr.cent[i] < 0.5 || fr.lflux[i] > 3 || fr.flux[i] < fr.flux[i - 1]) continue;
      let m = 0;
      for (let j = i + 1; j <= i + w; j++) if (fr.cent[j] < fr.cent[j - 1]) m++;
      const ton = (fr.tonal[i] + fr.tonal[i + (w >> 1)]) / 2;
      const c = ramp(fall, 1, 1.8) * ramp(m / w, 0.75, 0.95) * ramp(ton, 0.45, 0.7) * ramp(fr.E[i] - medE, 0, 6);
      if (c > 0.05) {
        push("zap", (i / fps) * r, Math.max(1, (w / fps) * r), c);
        i += w * 2;
      }
    }
  }
  // Whoosh: rauschiges An- und Abschwellen (0,4–1,5 s) ohne harten Einsatz
  for (let x = S(0.4); x < n - S(0.4); x++) {
    if (!(L[x] >= L[x - 1] && L[x] > L[x + 1])) continue;
    let a = x, b = x;
    while (a > 0 && L[a - 1] < L[a] && x - a < S(0.8)) a--;
    while (b < n - 1 && L[b + 1] < L[b] && b - x < S(0.8)) b++;
    const up = L[x] - L[a], down = L[x] - L[b], len = (b - a) / r;
    if (len < 0.4 || len > 1.5) continue;
    const c = ramp(Math.min(up, down), 6, 10) * ramp(mean(Fs, a, b), sf.m + sf.s * 0.8, sf.m + sf.s * 1.6) * (1 - ramp(maxOf(G.att, a, b), attHi * 0.6, attHi));
    if (c > 0.05) {
      push("whoosh", a, b - a, c);
      x = b;
    }
  }
  // keepAll: alle Kandidaten (fürs Testlabor und das Regressions-Fixture), sonst nur die sicheren
  return keepAll ? prune(ev).sort((a, b) => a.t - b.t) : fxSelect(ev, n / r);
}

// gleiche Art, überlappend: nur die sicherste behalten
function prune(ev) {
  const kept = [];
  for (const e of ev.slice().sort((a, b) => b.c - a.c)) if (!kept.some((o) => o.k === e.k && e.t < o.t + o.dur && o.t < e.t + e.dur)) kept.push(e);
  return kept;
}
// Aus den Kandidaten ({ k, t, dur, c }) die gezeigten Ereignisse: über der Schwelle, nicht überlappend, Pumpen erst ab
// zwei Fenstern, Seltenheits-Regel. sec: Länge des Rasters (s). Eigene Funktion, damit das Fixture sie nachrechnen kann
function fxSelect(cands, sec) {
  let ev = prune(cands.filter((e) => e.c >= THR[e.k]));
  // Pumpen ist Textur, kein Augenblick: erst ab zwei sicheren 4-s-Fenstern gilt es (ein einzelnes war im Testlabor
  // meist ein Zufall – ein Rock-Riff, ein Jazz-Walking-Bass)
  if (ev.filter((e) => e.k === "pump").length < 2) ev = ev.filter((e) => e.k !== "pump");
  // Seltenheits-Regel: zu häufig = Textur, nicht Effekt
  const mins = Math.max(0.5, sec / 60), count = {};
  for (const e of ev) count[e.k] = (count[e.k] || 0) + 1;
  return ev.filter((e) => !RARE[e.k] || count[e.k] / mins <= RARE[e.k]).sort((a, b) => a.t - b.t);
}

/* ---- Laufzeit: welche Effekte gerade zu sehen sind (Vorrang, höchstens n zugleich, Abklingzeiten) */
// Vorrang (höher gewinnt) und Abklingzeit (s) je Art; „flash“ = darf mit Blitzen kurz aufhellen (nur über die
// Blitz-Schranke, nie mit „Keine Blitze“)
const PRI = {
  impact: [9, 2, true], subdrop: [9, 3, false], orchhit: [8, 2, true], stop: [8, 3, false], tapestop: [8, 6, false], rewind: [8, 6, false],
  riser: [7, 4, false], sweep: [7, 4, false], revcym: [7, 3, false], downlift: [6, 4, false], airhorn: [6, 6, false], siren: [5, 8, false],
  scratch: [5, 3, false], stutter: [5, 3, false], zap: [4, 2, false], whoosh: [4, 3, false], filter: [3, 6, false], cheer: [3, 10, false], pump: [2, 0, false],
};
function createMixer() {
  const last = {};
  let seen = new Set();
  // events: [{ k, t, dur, c }] (Songzeit) · opt: { max, lite, sec }. Rückgabe: [{ k, p (0..1 Fortschritt), e (Hülle 0..1), c }]
  function at(events, sec, opt = {}) {
    const max = opt.max ?? 3, out = [];
    const live = [];
    for (const ev of events) {
      if (ev.t > sec + 0.05) break;
      if (sec > ev.t + ev.dur + 0.6) continue;
      live.push(ev);
    }
    live.sort((a, b) => (PRI[b.k]?.[0] || 0) - (PRI[a.k]?.[0] || 0) || b.c - a.c);
    const now = new Set();
    for (const ev of live) {
      if (out.length >= max) break;
      if (out.some((o) => o.k === ev.k)) continue;
      const id = ev.k + "@" + ev.t;
      const cd = PRI[ev.k]?.[1] ?? 3;
      // Abklingzeit: dieselbe Art erst wieder nach cd s (gezählt ab dem Ende der letzten) – ein schon laufendes Ereignis bleibt
      if (!seen.has(id) && last[ev.k] != null && ev.t - last[ev.k] < cd && ev.t > last[ev.k] - 0.01) continue;
      now.add(id);
      if (!seen.has(id)) last[ev.k] = ev.t + ev.dur;
      const p = clamp((sec - ev.t) / Math.max(0.05, ev.dur), 0, 1.6);
      // weich hinein (0,15 s bzw. über den ganzen Anstieg bei Risern), weich hinaus (0,6 s nach dem Ende)
      const rise = ev.k === "riser" || ev.k === "sweep" || ev.k === "revcym" ? 1 : clamp((sec - ev.t) / 0.15, 0, 1);
      const fall = clamp(1 - (sec - ev.t - ev.dur) / 0.6, 0, 1);
      // s: Stärke aus der Sicherheit (zart, wenn Mirage nur knapp sicher ist); von Hand ausgelöste (c = 1) voll
      out.push({ k: ev.k, p, e: rise * fall, c: ev.c, s: ev.forced ? 1 : Math.round(strength(ev.k, ev.c) * (ev.w ?? 1) * 100) / 100, flash: !!PRI[ev.k]?.[2] });
    }
    seen = now;
    return out;
  }
  // Sprung im Song: Abklingzeiten vergessen
  const reset = () => {
    for (const k in last) delete last[k];
    seen = new Set();
  };
  return { at, reset };
}

// Zwei Raster gegeneinander verschieben (Hörprobe im Song finden): Lautheit je Viertelsekunde, normierte Korrelation.
// Rückgabe { off (s, Lage der Hörprobe im Song), r (0..1) } oder null
function alignPreview(gSong, gPrev) {
  if (!gSong || !gPrev) return null;
  // je genau 0,25 s (nach Zeit, nicht nach Zellen: das Raster der Hörprobe hat 21,5 Zellen/s – fünf Zellen sind 0,23 s,
  // früher als 0,25 s gezählt: über 30 s lief die Hörprobe so 2 s auseinander und passte schlechter, als sie ist)
  const q = (G) => {
    const out = [], k = G.r / 4;
    for (let j = 0; Math.round((j + 1) * k) <= G.n; j++) out.push(mean(G.loud, Math.round(j * k), Math.max(Math.round(j * k) + 1, Math.round((j + 1) * k))));
    return out;
  };
  const A = q(gSong), B = q(gPrev);
  if (B.length < 40 || A.length < B.length) return null;
  const mb = B.reduce((s, v) => s + v, 0) / B.length, sbv = Math.sqrt(B.reduce((s, v) => s + (v - mb) ** 2, 0)) || 1;
  let best = null;
  for (let o = 0; o + B.length <= A.length; o++) {
    let ma = 0;
    for (let i = 0; i < B.length; i++) ma += A[o + i];
    ma /= B.length;
    let num = 0, sa = 0;
    for (let i = 0; i < B.length; i++) {
      const da = A[o + i] - ma;
      num += da * (B[i] - mb);
      sa += da * da;
    }
    const c = num / (Math.sqrt(sa) * sbv || 1);
    if (!best || c > best.r) best = { off: o / 4, r: c };
  }
  if (!best || !(best.r > 0)) return null;
  // fein nachstellen: ±0,25 s in 25-ms-Schritten auf den vollen Rastern. Die Viertelsekunde allein lag bis zu 125 ms
  // daneben – zu grob für Bass und Einsätze aus der Hörprobe
  let off = best.off, top = -2;
  for (let k = -10; k <= 10; k++) {
    const o = best.off + k * 0.025, c = corrAt(gSong, gPrev, o);
    if (c > top) [top, off] = [c, o];
  }
  return { off: Math.round(off * 1000) / 1000, r: Math.round(best.r * 100) / 100 };
}
// Korrelation der Lautheit, Hörprobe um o Sekunden verschoben (Song linear zwischen seinen Zellen gelesen)
function corrAt(gS, gP, o) {
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  for (let x = 0; x < gP.n; x++) {
    const p = (o + x / gP.r) * gS.r, i = Math.floor(p), f = p - i;
    if (i < 0 || i + 1 >= gS.n) continue;
    const a = gS.loud[i] * (1 - f) + gS.loud[i + 1] * f, b = gP.loud[x];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    sa += a;
    sb += b;
    saa += a * a;
    sbb += b * b;
    sab += a * b;
    n++;
  }
  if (n < 20) return -2;
  const cov = sab - (sa * sb) / n, va = saa - (sa * sa) / n, vb = sbb - (sb * sb) / n;
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : -2;
}
// Lage der Hörprobe im Song, einmal je Song und Hörprobe (sonicrt.js und party.js/bass.js fragen beide): nur bei
// deutlich passendem Lautheitsverlauf (r ≥ 0,75), sonst null. G: Raster des Songs, falls schon gerechnet
const alMemo = new WeakMap();
function alignFor(segs, grid, G) {
  const m = alMemo.get(grid);
  if (m && m.segs === segs) return m.al;
  const a = alignPreview(G || gridFromSegs(segs), grid);
  const al = a && a.r >= 0.75 ? { ...a, end: a.off + grid.n / grid.r } : null;
  alMemo.set(grid, { segs, al });
  return al;
}
// schon gerechnet? (ohne zu rechnen – im Bild wird nie gesucht) · undefined = noch nicht
function alignedOf(segs, grid) {
  const m = grid && alMemo.get(grid);
  return m && m.segs === segs ? m.al : undefined;
}

export { INST, FX, THR, RARE, PRI, gridFromSegs, createFrameSink, palette, paletteConf, detectFx, fxSelect, strength, createMixer, alignPreview, alignFor, alignedOf };
