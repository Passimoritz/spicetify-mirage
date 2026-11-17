/* ---------------------------------------------------------------- Bilder der Klang-Detektoren */
// Zeichnet in der Location (venue.js, auch im Hintergrund-Thread), was sonic.js/sonicrt.js erkennen: je Instrument
// und Effekt ein eigenes Bild, damit man sie auseinanderhalten kann. Alles ist eine Funktion von Zeit, Fortschritt
// und Hüllkurven der Party (kickEnv, hatEnv, Schlagphase) – kein Teilchen-Speicher, keine Objekte je Bild.
// Weich statt hart: Ein- und Ausblenden über Hüllen, kein weißer Blitz. „Keine Blitze“ macht Pulse zu ruhigem Glühen,
// „Leicht“ (quality < 1) zeichnet weniger Punkte und lässt die teuren Verläufe weg. Kamera bleibt, wo sie ist.
//   Instrumente: kick → Bodenpuls · sub808 → Bodenschockwelle · hats → Funkeln an der Traverse · crash → Schimmer-
//   fächer alle vier Takte · acguitar → sechs warme Lichtsaiten · pad → Polarlicht-Band · bells → Glockensterne mit
//   Ringen · organ → Lichtpfeifen · piano (ohne Tonhöhen) → Tasten-Wellen über den Boden
//   Effekte: riser/sweep → Strahlen laufen nach oben zusammen, heller werdend (sweep: Rauschband steigt mit) ·
//   downlift → Strahlen fallen auseinander · impact → Ringwelle aus dem Cover + Staub · subdrop → schwere Bodenwellen,
//   unten wird es dunkel · orchhit → goldener Strahlenkranz · stop → Licht senkt sich, ein schmaler Spot bleibt ·
//   tapestop → Lichtbalken werden langsamer und blasser · revcym → Schimmer saugt sich ins Cover · stutter → Zeilen
//   wiederholen sich im Sechzehntel · scratch → Scan-Balken hin und her · filter → Lichtvorhang hebt/senkt sich ·
//   pump → Bodenlicht duckt sich unter der Kick · cheer → Handylichter in der Menge · siren → rot/blaue Drehlichter
//   (kein Stroboskop) · airhorn → drei Pulse aus Hörnern · zap → Laserstrich · whoosh → Lichtbogen zieht vorbei ·
//   rewind → Spirale dreht rückwärts und bremst
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hash = (i, s) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const mixW = (c, f) => [c[0] + (255 - c[0]) * f, c[1] + (255 - c[1]) * f, c[2] + (255 - c[2]) * f];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
const bell = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));

function createInstFx(glowSprite) {
  let vw = 0, vh = 0;
  const glow = (ctx, col, x, y, r, a) => {
    if (a <= 0.004 || r <= 0) return;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.drawImage(glowSprite(col.map((v) => v | 0)), x - r, y - r, r * 2, r * 2);
  };
  const line = (ctx, col, a, w, pts) => {
    if (a <= 0.004) return;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = rgba(col, a);
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  const ellipse = (ctx, col, x, y, rx, ry, a, w) => {
    if (a <= 0.004) return;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = rgba(col, a);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.stroke();
  };

  /* ---- Instrumente */
  function instruments(ctx, st, I, px, pal, S, lite, calmPulse) {
    const t = st.t, bd = 60 / (st.bpm || 120), ph = px.phase || 0, bi = Math.max(0, px.beatIdx || 0);
    const floorY = vh * 0.93;
    if (I.kick > 0.01) {
      // Bodenpuls: weicher Schein am Bühnenboden, auf der Kick
      glow(ctx, mixW(pal[0], 0.2), vw / 2, floorY, vw * 0.28, 0.22 * I.kick * calmPulse(px.kickEnv));
    }
    if (I.sub808 > 0.01) {
      // Bodenschockwelle: ein Ring läuft von der Bühnenmitte nach außen, die Zeit seit der Kick aus ihrer Hülle
      const age = px.kickEnv > 0.005 ? -Math.log(px.kickEnv) / 7 : 9, c = mixW(pal[0], 0.1);
      if (age < 0.8) {
        const f = age / 0.8;
        ellipse(ctx, c, vw / 2, floorY, vw * (0.06 + 0.55 * f), vh * (0.015 + 0.07 * f), 0.4 * I.sub808 * (1 - f) * (st.noFlash ? 0.6 : 1), (6 - 4 * f) * S);
      }
      glow(ctx, [90, 40, 160], vw / 2, vh * 1.02, vw * 0.35, 0.18 * I.sub808 * calmPulse(px.kickEnv));
    }
    if (I.hats > 0.01) {
      // Funkeln an der Traverse: kleine Punkte, die auf der Hi-Hat aufblitzen (ohne Blitze: ruhig glimmend)
      const n = lite ? 6 : 14, e = calmPulse(px.hatEnv);
      for (let i = 0; i < n; i++) {
        const x = vw * (0.08 + 0.84 * hash(i, 31)), tw = 0.4 + 0.6 * hash(i + (bi % 7), 9);
        glow(ctx, [235, 245, 255], x, vh * 0.055, (3 + 3 * tw) * S, 0.7 * I.hats * e * tw);
      }
    }
    if (I.crash > 0.01) {
      // Becken: alle vier Takte auf der Eins ein breiter Schimmerfächer oben, der langsam verglimmt
      const age = ((bi % 16) + ph) * bd;
      if (age < 1.8 && px.energy > 0.5) {
        const f = age / 1.8, c = [255, 248, 220];
        ctx.globalAlpha = 1;
        for (let k = 0; k < (lite ? 5 : 9); k++) {
          const a = Math.PI * (0.15 + 0.7 * (k / (lite ? 4 : 8))), len = vh * (0.25 + 0.3 * f);
          line(ctx, c, 0.16 * I.crash * (1 - f), 3 * S, [[vw / 2, vh * 0.02], [vw / 2 + Math.cos(a) * len * 1.6, vh * 0.02 + Math.sin(a) * len]]);
        }
        glow(ctx, c, vw / 2, vh * 0.03, vh * 0.18, 0.3 * I.crash * (1 - f));
      }
    }
    if (I.acguitar > 0.01) {
      // Akustikgitarre: sechs warme Lichtsaiten am rechten Rand, die auf dem Schlag schwingen
      const c = [255, 190, 120], sw = calmPulse(Math.max(px.beat || 0, px.snareEnv || 0));
      for (let k = 0; k < 6; k++) {
        const x = vw * (0.86 + k * 0.016), pts = [];
        for (let s = 0; s <= 10; s++) {
          const f = s / 10;
          pts.push([x + Math.sin(f * Math.PI) * Math.sin(t * (20 + k * 3)) * 6 * S * sw, vh * (0.25 + 0.5 * f)]);
        }
        line(ctx, c, (0.18 + 0.25 * sw) * I.acguitar, (1 + (5 - k) * 0.25) * S, pts);
      }
    }
    if (I.pad > 0.01 && !lite) {
      // Fläche: ein Polarlicht-Band oben, das langsam wandert
      for (let k = 0; k < 2; k++) {
        const y0 = vh * (0.12 + 0.06 * k + 0.03 * Math.sin(t * 0.25 + k * 2)), h = vh * 0.12;
        const g = ctx.createLinearGradient(0, y0 - h, 0, y0 + h), c = mixW(pal[1 + k], 0.25);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(0.5, rgba(c, 0.13 * I.pad));
        g.addColorStop(1, rgba(c, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, y0 - h, vw, h * 2);
      }
    } else if (I.pad > 0.01) glow(ctx, mixW(pal[1], 0.25), vw / 2, vh * 0.12, vw * 0.4, 0.12 * I.pad);
    if (I.bells > 0.01) {
      // Glocken: Sterne oben, auf jedem Schlag klingt einer mit einem feinen Ring
      const n = lite ? 5 : 9, c = [255, 240, 200];
      for (let i = 0; i < n; i++) glow(ctx, c, vw * (0.1 + 0.8 * hash(i, 5)), vh * (0.08 + 0.15 * hash(i, 6)), 4 * S, 0.5 * I.bells * (0.5 + 0.5 * Math.sin(t * 2 + i)));
      const i = bi % n;
      ellipse(ctx, c, vw * (0.1 + 0.8 * hash(i, 5)), vh * (0.08 + 0.15 * hash(i, 6)), (6 + 40 * ph) * S, (6 + 40 * ph) * S, 0.35 * I.bells * (1 - ph), 1.5 * S);
    }
    if (I.organ > 0.01) {
      // Orgel: Lichtpfeifen hinten in der Mitte, die atmen
      const n = lite ? 5 : 9;
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1), h = vh * (0.12 + 0.18 * (1 - Math.abs(f - 0.5) * 2)) * (0.85 + 0.15 * Math.sin(t * 0.8 + k)), x = vw * (0.35 + 0.3 * f);
        line(ctx, mixW(pal[k % 3], 0.4), 0.22 * I.organ, 7 * S, [[x, vh * 0.55], [x, vh * 0.55 - h]]);
      }
    }
    if (I.piano > 0.01 && !I.chroma) {
      // Klavier ohne Tonhöhen (nur die Hörprobe weiß, dass es spielt): Tasten-Wellen laufen über den Boden
      const x = vw * (0.15 + 0.7 * ((bi * 3) % 8) / 7), c = mixW(pal[bi % 3], 0.4);
      ellipse(ctx, c, x, floorY - vh * 0.02, vw * (0.02 + 0.1 * ph), vh * (0.006 + 0.025 * ph), 0.45 * I.piano * (1 - ph), 2 * S);
    }
  }

  /* ---- Effekte (je { k, p: Fortschritt, e: Hülle, c }) */
  function effect(ctx, st, f, px, pal, S, lite) {
    const t = st.t, p = clamp(f.p, 0, 1), e = clamp(f.e, 0, 1) * (0.75 + 0.25 * f.c), cx = st.cx ?? vw / 2, cy = st.cy ?? vh / 2, R = st.R || vh * 0.15;
    const far = Math.hypot(vw, vh), noFlash = !!st.noFlash;
    switch (f.k) {
      case "riser":
      case "sweep": {
        // Strahlen vom Boden laufen über dem Cover zusammen, je näher der Höhepunkt, desto heller und enger
        const n = lite ? 5 : 9, tx = cx, ty = -vh * 0.05, a = (0.06 + 0.24 * p * p) * e, c = mixW(pal[2], 0.35 + 0.4 * p);
        for (let k = 0; k < n; k++) {
          const x0 = vw * ((k + 0.5) / n), xm = x0 + (tx - x0) * p * 0.8;
          line(ctx, c, a, (3 + 6 * p) * S, [[x0, vh], [xm, ty]]);
        }
        if (f.k === "sweep") {
          // Rauschband steigt mit
          const y = vh * (1 - p), h = vh * 0.08;
          for (let i = 0; i < (lite ? 12 : 30); i++) glow(ctx, [230, 235, 255], hash(i, 3) * vw, y + (hash(i, 4) - 0.5) * h, (2 + 3 * hash(i + Math.floor(t * 20), 7)) * S, 0.5 * e);
        }
        break;
      }
      case "downlift": {
        const n = lite ? 4 : 7, c = mixW(pal[1], 0.3);
        for (let k = 0; k < n; k++) {
          const x0 = cx + (k - (n - 1) / 2) * vw * 0.03, x1 = cx + (k - (n - 1) / 2) * vw * (0.05 + 0.12 * p);
          line(ctx, c, 0.22 * e * (1 - p), 4 * S, [[x0, 0], [x1, vh * (0.3 + 0.7 * p)]]);
        }
        break;
      }
      case "impact": {
        // Ringwelle aus dem Cover, dahinter fällt Staub; mit Blitzen ein weicher (nie weißer) Aufschein
        const r = R + p * far * 0.6, c = mixW(pal[0], 0.5);
        ellipse(ctx, c, cx, cy, r, r, 0.5 * e * (1 - p), (10 - 7 * p) * S);
        if (!noFlash && p < 0.2) glow(ctx, mixW(pal[0], 0.3), cx, cy, R * 3, 0.25 * (1 - p / 0.2) * e);
        for (let i = 0; i < (lite ? 10 : 26); i++) glow(ctx, [210, 200, 190], hash(i, 1) * vw, vh * (0.1 + 0.5 * hash(i, 2) + 0.3 * p), (2 + 2 * hash(i, 3)) * S, 0.35 * e * (1 - p));
        break;
      }
      case "subdrop": {
        const c = [120, 60, 200];
        for (let k = 0; k < 3; k++) {
          const q = clamp(p * 1.2 - k * 0.15, 0, 1);
          ellipse(ctx, c, vw / 2, vh * 0.95, vw * (0.1 + 0.6 * q), vh * (0.02 + 0.08 * q), 0.4 * e * (1 - q), 8 * S);
        }
        // unten wird es dunkel: der Klang sinkt in den Boden
        ctx.globalCompositeOperation = "source-over";
        const g = ctx.createLinearGradient(0, vh * 0.55, 0, vh);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, `rgba(0,0,0,${(0.35 * e * bell(p)).toFixed(3)})`);
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, vh * 0.55, vw, vh * 0.45);
        ctx.globalCompositeOperation = "lighter";
        break;
      }
      case "orchhit": {
        const c = [255, 205, 110], n = lite ? 8 : 16;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + 0.2, r0 = R * 1.1, r1 = R * (1.4 + 2.2 * p);
          line(ctx, c, 0.35 * e * (1 - p), 3 * S, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]]);
        }
        glow(ctx, c, cx, cy, R * 2, 0.2 * e * (1 - p));
        break;
      }
      case "stop":
      case "tapestop": {
        if (f.k === "tapestop") {
          // Lichtbalken laufen quer und bremsen bis zum Stillstand, dabei verblassen sie
          const slow = 1 - (1 - p) ** 3, c = mixW([200, 200, 210], 0.2 * (1 - p));
          for (let k = 0; k < (lite ? 3 : 6); k++) {
            const x = ((k / 6 + slow * 0.6) % 1) * vw;
            line(ctx, c, 0.25 * e * (1 - p), 10 * S, [[x, vh * 0.3], [x, vh * 0.7]]);
          }
        }
        // das Licht senkt sich, ein schmaler Spot von oben bleibt
        const d = f.k === "stop" ? bell(p * 0.9 + 0.05) : clamp(p * 1.4, 0, 1) * (1 - clamp((p - 0.9) * 10, 0, 1));
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(0,0,0,${(0.4 * e * d).toFixed(3)})`;
        ctx.fillRect(0, 0, vw, vh);
        ctx.globalCompositeOperation = "lighter";
        line(ctx, [255, 245, 230], 0.25 * e * d, 14 * S, [[cx, 0], [cx, cy - R]]);
        break;
      }
      case "revcym": {
        // Schimmer zieht sich von den Rändern ins Cover – wie ein rückwärts gespieltes Becken
        const n = lite ? 12 : 28, c = [235, 240, 255];
        for (let i = 0; i < n; i++) {
          const a = hash(i, 8) * Math.PI * 2, r = R + (1 - p) * far * (0.3 + 0.3 * hash(i, 9));
          glow(ctx, c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, (2 + 3 * p) * S, 0.6 * e * p);
        }
        break;
      }
      case "stutter": {
        // Zeilen wiederholen sich im Sechzehntel: dieselben Streifen springen im Raster
        const q = Math.floor(t * ((st.bpm || 120) / 60) * 4), c = mixW(pal[q % 3], 0.4);
        for (let k = 0; k < (lite ? 3 : 5); k++) {
          const y = vh * (0.2 + 0.6 * hash(k, q % 4));
          ctx.globalAlpha = 1;
          ctx.fillStyle = rgba(c, (noFlash ? 0.07 : 0.12) * e);
          ctx.fillRect(0, y, vw, 5 * S);
        }
        break;
      }
      case "scratch": {
        const x = cx + Math.sin(t * Math.PI * 2 * 3.5) * vw * 0.3;
        line(ctx, mixW(pal[2], 0.5), 0.3 * e, 6 * S, [[x, vh * 0.15], [x, vh * 0.85]]);
        break;
      }
      case "filter": {
        // Lichtvorhang vom Boden, der mit der Filterfahrt steigt
        const h = vh * (0.15 + 0.55 * p), g = ctx.createLinearGradient(0, vh - h, 0, vh), c = mixW(pal[1], 0.3);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(1, rgba(c, 0.18 * e));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, vh - h, vw, h);
        break;
      }
      case "pump": {
        // Bodenlicht duckt sich unter jeder Kick und schwillt bis zur nächsten an
        glow(ctx, mixW(pal[2], 0.2), vw / 2, vh * 0.98, vw * 0.45, 0.22 * e * (1 - (px.kickEnv || 0)));
        break;
      }
      case "cheer": {
        for (let i = 0; i < (lite ? 14 : 34); i++) {
          const tw = Math.max(0, Math.sin(t * (2 + 2 * hash(i, 4)) + hash(i, 5) * 6));
          glow(ctx, [255, 255, 240], hash(i, 1) * vw, vh * (0.68 + 0.22 * hash(i, 2)), 3 * S, 0.6 * e * tw);
        }
        break;
      }
      case "siren": {
        // rot und blau drehende Lichtkegel aus den oberen Ecken – weiches Drehen, kein Stroboskop
        for (const [ox, col, dir] of [[0, [255, 50, 60], 1], [vw, [60, 110, 255], -1]]) {
          const a = Math.PI / 2 + dir * (0.6 * Math.sin(t * 3)), len = vh * 0.9;
          ctx.globalAlpha = 1;
          ctx.fillStyle = rgba(col, 0.13 * e);
          ctx.beginPath();
          ctx.moveTo(ox, 0);
          ctx.lineTo(ox + Math.cos(a - 0.12) * len, Math.sin(a - 0.12) * len);
          ctx.lineTo(ox + Math.cos(a + 0.12) * len, Math.sin(a + 0.12) * len);
          ctx.closePath();
          ctx.fill();
          glow(ctx, col, ox, 0, vh * 0.1, 0.4 * e);
        }
        break;
      }
      case "airhorn": {
        // drei Pulse aus goldenen Hörnern an den Seiten
        const pulse = Math.max(bell(p / 0.25), bell((p - 0.33) / 0.25), bell((p - 0.66) / 0.25)) * (noFlash ? 0.6 : 1);
        for (const side of [-1, 1]) {
          const ox = side < 0 ? 0 : vw, oy = vh * 0.45, c = [255, 200, 90];
          ctx.globalAlpha = 1;
          ctx.fillStyle = rgba(c, 0.18 * e * pulse);
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox - side * vw * 0.3, oy - vh * 0.12);
          ctx.lineTo(ox - side * vw * 0.3, oy + vh * 0.12);
          ctx.closePath();
          ctx.fill();
          glow(ctx, c, ox, oy, vh * 0.08, 0.5 * e * pulse);
        }
        break;
      }
      case "zap": {
        const x = vw * (0.1 + 0.8 * p), y = vh * (0.15 + 0.5 * p), c = [120, 255, 200];
        line(ctx, c, 0.6 * e * (1 - p), 2 * S, [[x - vw * 0.15, y - vh * 0.08], [x, y]]);
        glow(ctx, c, x, y, 10 * S, 0.6 * e * (1 - p));
        break;
      }
      case "whoosh": {
        const pts = [], c = mixW(pal[0], 0.5);
        for (let s = 0; s <= 12; s++) {
          const a = Math.PI * (1 - (p - 0.25 + 0.25 * (s / 12)));
          pts.push([cx + Math.cos(a) * vw * 0.45, vh * 0.75 - Math.sin(a) * vh * 0.4]);
        }
        line(ctx, c, 0.3 * e * bell(p), 5 * S, pts);
        break;
      }
      case "rewind": {
        // Spirale um das Cover dreht rückwärts und bremst ab
        const rot = -(1 - (1 - p) ** 2) * Math.PI * 6, n = lite ? 10 : 22, c = mixW(pal[1], 0.4);
        for (let i = 0; i < n; i++) {
          const a = rot + (i / n) * Math.PI * 4, r = R * (1.15 + (i / n) * 1.2);
          glow(ctx, c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4 * S, 0.55 * e * (1 - p * 0.6));
        }
        break;
      }
    }
  }

  function draw(ctx, st) {
    const I = st.inst, px = st.px;
    if (!I || !px || px.blackout) return;
    vw = st.vw;
    vh = st.vh;
    const S = st.dpr || 1, lite = (st.quality ?? 2) < 1, pal = st.pal;
    // ohne Blitze: Pulse werden ein ruhiges Glühen (halbe Tiefe)
    const calmPulse = (env) => (st.noFlash ? 0.55 + 0.25 * (env || 0) : 0.25 + 0.75 * (env || 0));
    ctx.globalCompositeOperation = "lighter";
    instruments(ctx, st, I, px, pal, S, lite, calmPulse);
    for (const f of I.sfx || []) effect(ctx, st, f, px, pal, S, lite);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";
  }
  return { draw };
}

export { createInstFx };
