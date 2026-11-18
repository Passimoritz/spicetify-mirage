/* ---------------------------------------------------------------- Weitere Visualizer-Stile (1.27) */
// Zwei Stile, die drawViz() in immersive.js aufruft – mit denselben Daten wie alle anderen Stile: geglättetes
// Spektrum (vals), Schlag (b), Lichtregie (mood: Drop, Refrain-Einsatz, Energie), Bewegungsuhr (tt) und die drei
// Coverfarben (pal). „Ruhig“ zeichnet keinen Stil (drawViz kehrt vorher zurück), „Leicht“ nimmt weniger Linien,
// Punkte und Teilchen, „Keine Blitze“ (soft < 1) dämpft jedes Aufleuchten.
//   wavefield  Wellenfeld: ein ruhig fließendes Feld aus Lichtlinien, das Spektrum hebt es an, der Takt schickt Wellen
//              vom Cover aus über das Feld
//   coverdust  Cover-Partikel: das Cover zerfällt bei Drops und großen Momenten in leuchtende Teilchen und setzt sich
//              weich wieder zusammen; dazwischen ruht es
// Alles zeitbasiert (dt): gleich weich bei 30, 60 oder 144 Bildern/s.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a, c, f) => [0, 1, 2].map((k) => Math.round(a[k] + (c[k] - a[k]) * f));
const WHITE = [255, 255, 255];
// Farbe entlang der drei Coverfarben (0 … 1)
const along = (pal, f) => (f < 0.5 ? mix(pal[0], pal[1], f * 2) : mix(pal[1], pal[2], (f - 0.5) * 2));
// Spektrum an einer Stelle 0 … 1 (weich zwischen zwei Balken)
function bandAt(vals, N, u) {
  const f = clamp(u, 0, 1) * (N - 1), i = Math.floor(f), w = f - i;
  return (vals[i] || 0) + ((vals[Math.min(N - 1, i + 1)] || 0) - (vals[i] || 0)) * w;
}

/* ---- Wellenfeld */
const wf = { ripples: [], lastB: 0, band: new Float32Array(0) };
function drawWavefield(ctx, o) {
  const { vw, vh, cx, cy, R, dpr, vals, N, b, tt, dt, pal, glowK, lite, full, mood, soft } = o;
  const L = lite ? 13 : full ? 28 : 22, S = lite ? 34 : 60;
  // Mix: das Feld endet vor dem Liedtext (rechts)
  const x1 = o.mode === "mix" ? Math.min(vw, cx + R * 3.4) : vw;
  // Takt: eine Welle läuft vom Cover aus über das Feld; ein Drop schickt eine kräftige
  if (b > wf.lastB + 0.16 && b > 0.42 && wf.ripples.length < 6) wf.ripples.push({ r: R * 0.9, a: 0.45 + 0.55 * b });
  if (mood?.dropHit) wf.ripples.push({ r: R * 0.9, a: 1.5 });
  wf.lastB = b;
  const diag = Math.hypot(vw, vh), speed = vw * 0.5;
  wf.ripples = wf.ripples.filter((r) => (r.r += speed * dt) < diag && (r.a *= Math.exp(-dt * 1.4)) > 0.03);
  if (wf.band.length !== S) wf.band = new Float32Array(S);
  // tiefe Töne in der Mitte (am Cover), hohe nach außen – symmetrisch, wie ein Klangbild
  const half = Math.max(cx, x1 - cx);
  const gap = vh / L, wl = Math.max(40 * dpr, R * 0.5);
  // oben bleibt die Kopfzeile frei; die ersten Zeilen blenden ein
  const top = vh * 0.13, span = vh - top;
  const amp = gap * 1.7 * o.height, rest = gap * 0.26;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < L; i++) {
    const y0 = top + span * ((i + 0.5) / L);
    // Zeilen nahe der Cover-Höhe hören am meisten mit, oben und unten laufen sie ruhig aus
    const near = Math.exp(-(((y0 - cy) / (vh * 0.42)) ** 2));
    // unter dem Cover liegen Titel und Bedienung: dort nur ein Hauch, damit alles lesbar bleibt
    const under = y0 > cy + R * 1.25 ? clamp(1 - (y0 - cy - R * 1.25) / (vh * 0.12), 0.28, 1) : 1;
    // jede Zeile hört das Spektrum etwas versetzt (sonst stünden alle Berge genau übereinander)
    const shift = Math.sin(i * 1.37 + tt * 0.21) * half * 0.12;
    for (let s = 0; s < S; s++) wf.band[s] = bandAt(vals, N, Math.abs((s / (S - 1)) * x1 - cx + shift) / half);
    const p = new Path2D();
    let px0 = 0, py0 = 0;
    for (let s = 0; s < S; s++) {
      const x = (s / (S - 1)) * x1;
      let y = y0 + rest * (Math.sin(x * 0.006 / dpr + tt * 0.8 + i * 0.5) + 0.6 * Math.sin(x * 0.011 / dpr - tt * 0.55 + i * 0.27));
      y -= wf.band[s] * amp * (0.25 + 0.75 * near);
      for (const r of wf.ripples) {
        const d = Math.hypot(x - cx, y0 - cy) - r.r;
        if (d > -wl * 2.5 && d < wl * 2.5) y -= r.a * gap * 0.9 * Math.exp(-((d / wl) ** 2)) * Math.cos(d / wl * 2.2);
      }
      if (!s) p.moveTo(x, y);
      else p.quadraticCurveTo(px0, py0, (px0 + x) / 2, (py0 + y) / 2);
      [px0, py0] = [x, y];
    }
    p.lineTo(px0, py0);
    const c = along(pal, i / (L - 1)), hot = mix(c, WHITE, 0.25 + 0.2 * near);
    const fadeIn = Math.min(1, (i + 1) / 3);
    const al = clamp((0.08 + 0.42 * near) * under * fadeIn * Math.min(1.25, 0.75 + 0.3 * glowK), 0, 0.7);
    // zu den Rändern hin auslaufend
    const g = ctx.createLinearGradient(0, 0, x1, 0);
    g.addColorStop(0, rgba(c, 0));
    g.addColorStop(0.14, rgba(c, al));
    g.addColorStop(Math.min(0.86, clamp(cx / x1, 0.2, 0.8)), rgba(hot, al));
    g.addColorStop(0.86, rgba(c, al));
    g.addColorStop(1, rgba(c, 0));
    ctx.strokeStyle = g;
    if (o.glow && !lite && near > 0.45) {
      ctx.globalAlpha = clamp(0.16 * glowK * soft + 0.05, 0, 0.35);
      ctx.lineWidth = 7 * dpr;
      ctx.stroke(p);
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = (0.9 + 1.3 * near) * dpr;
    ctx.stroke(p);
  }
}

/* ---- Cover-Partikel */
// Das Cover wird einmal je Bild-Wechsel auf G × G Zellen verkleinert; jede Zelle ist ein Teilchen mit Heimatplatz.
// In Ruhe zeichnet der Stil einfach das (runde) Cover. Bei einem Drop, beim Refrain-Einsatz oder einem großen
// Schlag bekommen die Teilchen einen Stoß nach außen und kehren über eine gedämpfte Feder heim (~1,5 s).
const cd = { key: "", G: 0, small: null, n: 0, hx: null, hy: null, ox: null, oy: null, vx: null, vy: null, sd: null, live: false, lastB: 0, lastLift: 0, lastAt: 0, fade: 0 };
function sampleCover(img, pal, G) {
  const key = (img?.src || "pal:" + pal.map((c) => c.join(",")).join("|")) + "|" + G;
  if (key === cd.key) return;
  cd.key = key;
  const c = cd.small || document.createElement("canvas");
  c.width = c.height = G;
  const x = c.getContext("2d");
  if (img) x.drawImage(img, 0, 0, G, G);
  else {
    // ohne ladbares Cover: eine Scheibe aus den Coverfarben
    const g = x.createRadialGradient(G * 0.35, G * 0.3, 0, G / 2, G / 2, G * 0.75);
    g.addColorStop(0, rgba(mix(pal[2], WHITE, 0.2), 1));
    g.addColorStop(0.5, rgba(pal[1], 1));
    g.addColorStop(1, rgba(pal[0], 1));
    x.fillStyle = g;
    x.fillRect(0, 0, G, G);
  }
  cd.small = c;
  if (cd.G === G) return;
  cd.G = G;
  // nur Zellen im runden Cover
  const cells = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const u = (i + 0.5) / G - 0.5, v = (j + 0.5) / G - 0.5;
    if (Math.hypot(u, v) <= 0.5 + 0.35 / G) cells.push(i, j);
  }
  const n = (cd.n = cells.length / 2);
  cd.hx = new Uint16Array(n);
  cd.hy = new Uint16Array(n);
  for (let k = 0; k < n; k++) [cd.hx[k], cd.hy[k]] = [cells[k * 2], cells[k * 2 + 1]];
  for (const f of ["ox", "oy", "vx", "vy"]) cd[f] = new Float32Array(n);
  cd.sd = Float32Array.from({ length: n }, () => Math.random());
  cd.live = false;
}
function burst(strength, size, swirl) {
  const G = cd.G;
  for (let k = 0; k < cd.n; k++) {
    const u = (cd.hx[k] + 0.5) / G - 0.5, v = (cd.hy[k] + 0.5) / G - 0.5, d = Math.hypot(u, v) + 0.04;
    const s = cd.sd[k], sp = size * strength * (2.4 + 3.2 * s) * (0.35 + d);
    const tw = swirl * (s - 0.5) * 1.4;
    cd.vx[k] += ((u / d) - (v / d) * tw) * sp;
    cd.vy[k] += ((v / d) + (u / d) * tw) * sp;
  }
  cd.live = true;
}
function drawCoverDust(ctx, o) {
  const { img, cx, cy, dpr, dt, b, mood, tt, lite, full, soft, now } = o;
  const size = o.size, G = lite ? 28 : full ? 50 : 44;
  sampleCover(img, o.pal, G);
  if (!cd.n) return;
  // große Momente: Drop (voll), Refrain-Einsatz, ohne Lichtregie ein sehr kräftiger Schlag (höchstens alle 8 s)
  const lift = mood?.lift || 0;
  const reach = o.mode === "mix" ? 0.55 : 1;
  if (mood?.dropHit) (burst(1.0 * reach, size, 1), (cd.lastAt = now));
  else if (lift > 0.5 && cd.lastLift <= 0.5 && now - cd.lastAt > 4000) (burst(0.55 * reach, size, 0.6), (cd.lastAt = now));
  else if (!mood && b > cd.lastB + 0.3 && b > 0.8 && now - cd.lastAt > 8000) (burst(0.4 * reach, size, 0.5), (cd.lastAt = now));
  cd.lastLift = lift;
  cd.lastB = b;
  const x0 = cx - size / 2, y0 = cy - size / 2, cs = size / G;
  let maxD = 0;
  if (cd.live) {
    // gedämpfte Feder (fast kritisch): weich heim ohne Nachschwingen; dazu ein leises Strömungsfeld, solange
    // ein Teilchen unterwegs ist
    const w = 2.9, z = 2 * 0.86 * w, h = Math.min(dt, 0.05), flow = size * 0.9;
    let maxV = 0;
    for (let k = 0; k < cd.n; k++) {
      const ox = cd.ox[k], oy = cd.oy[k], m = Math.min(1, (Math.abs(ox) + Math.abs(oy)) / (size * 0.3));
      const s = cd.sd[k] * 6.283;
      const ax = -w * w * ox - z * cd.vx[k] + m * flow * Math.sin(oy / size * 5 + tt * 1.1 + s);
      const ay = -w * w * oy - z * cd.vy[k] + m * flow * Math.cos(ox / size * 5 - tt * 0.9 + s);
      cd.vx[k] += ax * h;
      cd.vy[k] += ay * h;
      cd.ox[k] += cd.vx[k] * h;
      cd.oy[k] += cd.vy[k] * h;
      const d = Math.abs(cd.ox[k]) + Math.abs(cd.oy[k]), v = Math.abs(cd.vx[k]) + Math.abs(cd.vy[k]);
      if (d > maxD) maxD = d;
      if (v > maxV) maxV = v;
    }
    if (maxD < 0.3 * dpr && maxV < 3 * dpr) {
      cd.live = false;
      cd.ox.fill(0);
      cd.oy.fill(0);
      cd.vx.fill(0);
      cd.vy.fill(0);
    }
  }
  // Überblendung Bild ↔ Teilchen: kaum verschoben = fast nur das Bild (scharf), unterwegs nur die Teilchen
  const k = cd.live ? clamp(maxD / (size * 0.05), 0, 1) : 0;
  cd.fade += (k - cd.fade) * (1 - Math.exp(-dt * (k > cd.fade ? 30 : 6)));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  if (cd.fade < 0.995) {
    ctx.globalAlpha = 1 - cd.fade;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();
    if (img) ctx.drawImage(img, x0, y0, size, size);
    else ctx.drawImage(cd.small, x0, y0, size, size);
    ctx.restore();
  }
  if (cd.fade > 0.005) {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = Math.min(1, cd.fade * 1.6);
    const sm = cd.small;
    for (let n = 0; n < cd.n; n++) {
      const ox = cd.ox[n], oy = cd.oy[n], d = (Math.abs(ox) + Math.abs(oy)) / size;
      // unterwegs kleiner (funkelnd), daheim lückenlos
      const s = cs * (1.06 - Math.min(0.5, d * 0.9)) * (1 + Math.min(1, d * 3) * (cd.sd[n] - 0.4));
      ctx.drawImage(sm, cd.hx[n], cd.hy[n], 1, 1, x0 + (cd.hx[n] + 0.5) * cs + ox - s / 2, y0 + (cd.hy[n] + 0.5) * cs + oy - s / 2, s, s);
    }
    ctx.imageSmoothingEnabled = true;
  }
  ctx.restore();
  // Lichtkranz um das ruhende Cover: atmet sacht mit dem Schlag („Keine Blitze“: nur ein Hauch)
  const ringA = clamp((0.18 + 0.35 * b * soft) * (1 - cd.fade), 0, 0.5);
  if (ringA > 0.02) {
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = rgba(mix(o.pal[2], WHITE, 0.3), ringA.toFixed(3));
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 + 3 * dpr, 0, Math.PI * 2);
    ctx.stroke();
  }
}

const resetVizExtra = () => {
  wf.ripples = [];
  cd.live = false;
  cd.fade = 0;
  cd.key = "";
};

export { drawWavefield, drawCoverDust, resetVizExtra };
