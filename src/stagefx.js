/* ---------------------------------------------------------------- Bühnenbilder der Szenarien */
// Zeichnet, was scenarios.js entscheidet: die Antworten der Bühne auf gesungene Wörter (st.cues) und die Momente der
// Musik aus der Lichtregie (st.px.scn: Finale, Tonartwechsel, Wiedereinsatz, Solo, a cappella, Ruf und Antwort,
// erster Schlag, Drop-Bild). Läuft in der Location (venue.js), also auch im Hintergrund-Thread.
// Günstig je Bild: alles ist eine Funktion des Alters (kein Teilchen-Speicher, keine Objekte je Bild), Leuchtpunkte
// kommen aus dem fertigen Leuchtbild der Location, höchstens ein Farbverlauf je laufendem Effekt.
// Weich statt hart: jedes Bild blendet über eine Glockenkurve ein und aus; einzig der Blitz darf hart sein – und nur
// mit Blitzen an, durch die gemeinsame Blitz-Schranke (höchstens 3/s). Sonst wird er ein ruhiges Glühen.
import { DROP_LOOKS, FAMS } from "./scenarios.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
// fester Zufall je Index (0..1): dieselben Sterne in jedem Bild, ohne sie zu speichern
const hash = (i, s) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const mixW = (c, f) => [c[0] + (255 - c[0]) * f, c[1] + (255 - c[1]) * f, c[2] + (255 - c[2]) * f];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
const FI = Object.fromEntries(FAMS.map((f, i) => [f, i]));

function createStageFx(glowSprite, flashCap) {
  let vw = 0, vh = 0;
  // Einmal-Auslöser je Antwort (seq): Blitz ja/nein, Bühneneffekt der Location gezündet ja/nein
  const bolts = new Map(), venueOk = new Map();
  const glow = (ctx, col, x, y, r, a) => {
    if (a <= 0.004 || r <= 0) return;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
  };

  /* ---- Schleier: von oben, vom Boden oder aus der Mitte */
  function wash(ctx, col, from, a, st) {
    if (a < 0.005) return;
    let g;
    if (from === "floor") {
      g = ctx.createRadialGradient(vw / 2, vh * 1.05, 0, vw / 2, vh * 1.05, vh * 0.75);
    } else if (from === "center") {
      g = ctx.createRadialGradient(st.cx, st.cy, st.R * 0.6, st.cx, st.cy, Math.max(vw, vh) * 0.62);
    } else {
      g = ctx.createLinearGradient(0, 0, 0, vh * 0.62);
    }
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(0.55, rgba(col, a * 0.32));
    g.addColorStop(1, rgba(col, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }
  /* ---- Lichtfächer von oben (Sonne, Himmel, Sunburst-Drop): ein Verlauf für alle Strahlen */
  function rays(ctx, col, a, rot, n, ox, oy, len) {
    if (a < 0.005) return;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, len);
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(0.4, rgba(col, a * 0.4));
    g.addColorStop(1, rgba(col, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const an = Math.PI * (0.08 + (0.84 * (k + 0.5)) / n) + Math.sin(rot + k) * 0.05, w = 0.035;
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(an - w) * len, oy + Math.sin(an - w) * len);
      ctx.lineTo(ox + Math.cos(an + w) * len, oy + Math.sin(an + w) * len);
    }
    ctx.fill();
  }
  /* ---- Ring (Bodenwelle, Countdown, Tunnel) */
  function ring(ctx, col, x, y, rx, ry, a, lw) {
    if (a < 0.005) return;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.lineWidth = lw * 3;
    ctx.strokeStyle = rgba(col, a * 0.22);
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.strokeStyle = rgba(col, a);
    ctx.stroke();
  }
  /* ---- Glitzer: n Punkte, fest verteilt, funkeln (Sterne) oder fallen (Gold) */
  function glitter(ctx, col, n, a, t, salt, fall, top, S) {
    for (let i = 0; i < n; i++) {
      const tw = Math.max(0, Math.sin(t * (1.5 + hash(i, salt + 3) * 2.5) + hash(i, salt + 4) * 6.3));
      const x = hash(i, salt) * vw;
      let y = hash(i, salt + 1) * vh * top;
      if (fall) y = ((y + t * vh * (0.12 + hash(i, salt + 2) * 0.1)) % (vh * 0.7)) - vh * 0.02;
      const r = (3 + hash(i, salt + 5) * 5) * S * (0.6 + 0.6 * tw) * (fall ? 1 : 1.5);
      glow(ctx, col, x, y, r, a * (0.25 + 0.75 * tw * tw));
    }
  }
  /* ---- Wellenlicht über dem Boden */
  function waves(ctx, col, a, t, S) {
    if (a < 0.005) return;
    ctx.globalAlpha = 1;
    for (let b = 0; b < 3; b++) {
      const y0 = vh * (0.6 + b * 0.07), amp = vh * (0.018 + b * 0.008);
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const x = (k / 24) * vw, y = y0 + Math.sin(k * 0.55 + t * (1.4 + b * 0.4) + b) * amp;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.lineWidth = (10 - b * 2) * S;
      ctx.strokeStyle = rgba(col, a * (0.5 - b * 0.12));
      ctx.stroke();
    }
  }
  /* ---- Lichtkegel von oben auf einen Punkt (Solo, a cappella, Schwenk) */
  function cone(ctx, col, x0, x1, y1, w, a) {
    if (a < 0.005) return;
    const g = ctx.createLinearGradient(0, 0, 0, y1);
    g.addColorStop(0, rgba(col, a * 0.15));
    g.addColorStop(1, rgba(col, a));
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - w * 0.08, 0);
    ctx.lineTo(x0 + w * 0.08, 0);
    ctx.lineTo(x1 + w, y1);
    ctx.lineTo(x1 - w, y1);
    ctx.closePath();
    ctx.fill();
    glow(ctx, col, x1, y1, w * 1.6, a * 0.8);
  }
  /* ---- Blitz: Zickzack von oben, Punkte aus dem festen Zufall der Antwort */
  function boltPath(ctx, seq, S) {
    let x = vw * (0.2 + hash(seq, 7) * 0.6), y = 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; y < vh * 0.62; k++) {
      x += (hash(seq * 31 + k, 8) - 0.5) * 100 * S;
      y += (30 + hash(seq * 31 + k, 9) * 40) * S;
      ctx.lineTo(x, y);
    }
  }

  /* ---- Drop-Bilder: je Höhepunkt eines (director.js wählt es), p = Fortschritt 0..1, a = Stärke */
  function dropLook(ctx, look, a, p, st, pal, S, soft) {
    const c0 = mixW(pal[0], 0.35), c1 = mixW(pal[1], 0.35), c2 = mixW(pal[2], 0.5);
    // ohne Blitze kein harter Einsatz: der Anfang blendet in einer Achtelsekunde ein
    const k = a * (soft ? 0.6 : 1);
    switch (look) {
      case "shock":
        ring(ctx, c2, vw / 2, vh * 0.88, vw * (0.08 + 0.62 * p), vh * (0.03 + 0.1 * p), k * 0.55, 6 * S * (1 - p * 0.6));
        glow(ctx, c0, vw / 2, vh * 0.9, vh * 0.45 * (0.5 + p), k * 0.35);
        break;
      case "sunburst":
        rays(ctx, c2, k * 0.3, p * 2, 14, vw / 2, -vh * 0.05, Math.hypot(vw, vh) * (0.5 + 0.5 * p));
        break;
      case "curtain": {
        const g = ctx.createLinearGradient(0, 0, 0, vh);
        g.addColorStop(0, rgba(c1, k * 0.32));
        g.addColorStop(0.7, rgba(c1, k * 0.08));
        g.addColorStop(1, rgba(c1, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        for (let i = 0; i < 9; i++) {
          const x = ((i / 9 + p * 0.35 * (i % 2 ? 1 : -1) + 1) % 1) * vw;
          ctx.fillRect(x - 10 * S, 0, 20 * S, vh);
        }
        break;
      }
      case "bloom":
        glow(ctx, mixW(pal[0], 0.2), st.cx, st.cy, Math.max(vw, vh) * (0.35 + 0.35 * p), k * 0.38);
        break;
      case "shatter": {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.4 * S;
        ctx.strokeStyle = rgba(c2, k * 0.6);
        ctx.beginPath();
        for (let i = 0; i < 18; i++) {
          const an = (i / 18) * Math.PI * 2 + hash(i, 2) * 0.3, r0 = st.R * (1.1 + p * 1.5), r1 = r0 + st.R * (0.4 + hash(i, 3) * 0.8) * (1 - p * 0.5);
          ctx.moveTo(st.cx + Math.cos(an) * r0, st.cy + Math.sin(an) * r0);
          ctx.lineTo(st.cx + Math.cos(an) * r1, st.cy + Math.sin(an) * r1);
        }
        ctx.stroke();
        break;
      }
      case "pillars": {
        const h = vh * (0.25 + 0.6 * smooth(p * 3)), g = ctx.createLinearGradient(0, vh, 0, vh - h);
        g.addColorStop(0, rgba(c0, k * 0.4));
        g.addColorStop(1, rgba(c0, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        for (let i = 0; i < 6; i++) ctx.fillRect(vw * (0.08 + (0.84 * i) / 5) - 16 * S, vh - h, 32 * S, h);
        break;
      }
      case "tunnel":
        for (let i = 0; i < 4; i++) {
          const q = (p + i * 0.25) % 1;
          ring(ctx, i % 2 ? c1 : c2, st.cx, st.cy, st.R * (1.15 + q * 2.6), st.R * (1.15 + q * 2.6) * 0.92, k * 0.4 * (1 - q), 3 * S);
        }
        break;
      case "halo":
        for (let i = 0; i < 14; i++) {
          const an = (i / 14) * Math.PI * 2 + p, r = st.R * (1.25 + 0.6 * p);
          glow(ctx, i % 2 ? c1 : c2, st.cx + Math.cos(an) * r, st.cy + Math.sin(an) * r, 26 * S, k * 0.55);
        }
        break;
    }
  }

  /* ---- ein Bild. hooks: Bühneneffekte der Location { pyro, co2, rockets, confetti } → true, wenn sie dort gehen.
     Gibt { jump, hands } zurück: wie sehr die Menge gerade auf ein Wort hin springen bzw. die Hände heben soll */
  const crowdOut = { jump: 0, hands: 0 };
  function draw(ctx, st, v, hooks) {
    vw = st.vw;
    vh = st.vh;
    crowdOut.jump = crowdOut.hands = 0;
    const px = st.px, scn = px.scn, cues = st.cues, S = st.dpr || 1, t = st.t, pal = st.pal;
    const lite = (st.quality ?? 2) < 1, noFlash = !!st.noFlash;
    if (!scn && !cues?.length) return crowdOut;
    ctx.globalCompositeOperation = "lighter";
    /* ---- Momente der Musik */
    if (scn) {
      if (scn.dx > 0.01 && scn.dl >= 0) dropLook(ctx, DROP_LOOKS[scn.dl], scn.dx, 1 - scn.dx, st, pal, S, noFlash);
      if (scn.back > 0.01) ring(ctx, mixW(pal[2], 0.5), vw / 2, vh * 0.88, vw * (0.1 + 0.6 * (1 - scn.back)), vh * (0.03 + 0.1 * (1 - scn.back)), scn.back * (noFlash ? 0.3 : 0.5), 5 * S);
      if (scn.open > 0.01) glow(ctx, mixW(pal[0], 0.3), vw / 2, vh * 1.02, vh * (0.55 + 0.25 * (1 - scn.open)), scn.open * 0.35);
      if (scn.mod > 0.01) {
        // Tonartwechsel: ein Lichtband steigt vom Boden zur Decke
        const y = vh * (1.05 - 1.2 * (1 - scn.mod)), g = ctx.createLinearGradient(0, y - vh * 0.12, 0, y + vh * 0.12), c = mixW(pal[2], 0.4);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(0.5, rgba(c, scn.mod * 0.3));
        g.addColorStop(1, rgba(c, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, y - vh * 0.12, vw, vh * 0.24);
      }
      if (scn.fin > 0.01) {
        // Finale: goldenes Glitzern von oben und ein warmer Schein über der Bühne
        wash(ctx, [255, 200, 110], "top", scn.fin * 0.1, st);
        glitter(ctx, [255, 220, 150], lite ? 14 : 36, scn.fin * 0.7, t, 11, true, 0.6, S);
      }
      if (scn.solo > 0.01) {
        const sw = Math.sin(t * 0.5) * vw * 0.06;
        cone(ctx, mixW(pal[1], 0.4), vw / 2 + sw * 2, vw / 2 + sw, vh * 0.8, vw * 0.07, scn.solo * 0.22);
      }
      if (scn.acap > 0.01) cone(ctx, [255, 248, 235], st.cx, st.cx, st.cy + st.R * 1.25, st.R * 0.9, scn.acap * 0.18);
      if (scn.echo > 0.01) glow(ctx, mixW(pal[1], 0.2), scn.eside > 0 ? vw * 0.06 : vw * 0.94, vh * 0.5, vh * 0.55, scn.echo * 0.3);
    }
    /* ---- Antworten auf Wörter */
    if (cues?.length) {
      for (const c of cues) {
        const age = t - c.t0;
        if (age < 0) continue;
        const f = FAMS[c.fi] ?? c.f, dur = c.dur || 2, k = c.k ?? 1;
        // Glocke: 0,4 s weich hinein, 1,2 s weich hinaus
        const e = smooth(age / 0.4) * smooth((dur - age) / 1.2);
        const col = c.col || pal[(c.seq || 0) % 3];
        switch (f) {
          case "wash": wash(ctx, col, c.from, 0.24 * k * e, st); break;
          case "sun":
            rays(ctx, col, 0.22 * k * e, t * 0.3, 11, vw / 2, -vh * 0.06, Math.hypot(vw, vh) * 0.85);
            glow(ctx, col, vw / 2, 0, vh * 0.45, 0.3 * k * e);
            break;
          case "stars": glitter(ctx, mixW(col, 0.6), lite ? 24 : 60, k * e, t, 3 + (c.seq % 5), false, 0.55, S); break;
          case "gold": glitter(ctx, c.col || [255, 205, 90], lite ? 20 : 50, k * e, age + 3, 21 + (c.seq % 5), true, 0.4, S); break;
          case "wave": waves(ctx, c.col || [70, 170, 255], k * e, t, S); break;
          case "sweep": {
            const p = smooth(age / dur), x1 = vw * (-0.1 + 1.2 * p);
            cone(ctx, mixW(col, 0.4), vw / 2, x1, vh * 0.85, vw * 0.09, 0.2 * k * smooth(age / 0.3) * smooth((dur - age) / 0.5));
            break;
          }
          case "shock": {
            const p = clamp(age / dur, 0, 1);
            ring(ctx, mixW(col, 0.5), vw / 2, vh * 0.88, vw * (0.08 + 0.62 * p), vh * (0.03 + 0.1 * p), k * (noFlash ? 0.35 : 0.55) * (1 - p) * smooth(age / 0.06), 6 * S);
            break;
          }
          case "count": {
            // drei Pulse auf den nächsten Schlägen, auf dem vierten der große
            for (let n = 0; n < 4; n++) {
              const q = (age - c.off - n * c.beat) / 0.5;
              if (q < 0 || q > 1) continue;
              const big = n === 3;
              ring(ctx, mixW(pal[n % 3], 0.5), st.cx, st.cy, st.R * (1.08 + q * (big ? 1.6 : 0.7)), st.R * (1.08 + q * (big ? 1.6 : 0.7)), k * (noFlash ? 0.35 : 0.6) * (1 - q) * smooth(q * 8), (big ? 6 : 4) * S);
              if (big) glow(ctx, mixW(pal[0], 0.4), vw / 2, vh * 0.95, vh * 0.6, k * 0.3 * (1 - q));
            }
            break;
          }
          case "chaos":
            // Farbwirbel: drei Lichtflecken kreisen in den Songfarben (gleitend, kein Flackern)
            for (let n = 0; n < 3; n++) {
              const an = t * 1.6 + (n * Math.PI * 2) / 3;
              glow(ctx, pal[n], vw / 2 + Math.cos(an) * vw * 0.3, vh * 0.45 + Math.sin(an) * vh * 0.2, vh * 0.5, 0.3 * k * e);
            }
            break;
          case "sparks":
            for (let i = 0; i < (lite ? 16 : 40); i++) {
              const ox = vw * (0.15 + 0.7 * ((i % 4) / 3)), vx = (hash(i, c.seq) - 0.5) * vw * 0.5, vy = -hash(i, c.seq + 1) * vh * 0.3;
              const x = ox + vx * age, y = vh * 0.08 + vy * age + 0.5 * vh * 0.9 * age * age;
              glow(ctx, mixW([120, 200, 255], hash(i, 5)), x, y, 7 * S, k * (1 - age / dur));
            }
            break;
          case "bolt": {
            // nur das erste Bild entscheidet, ob es blitzen darf (Schranke, Blitze an); sonst ruhiges Glühen von oben
            if (!bolts.has(c.seq)) {
              if (bolts.size > 8) bolts.delete(bolts.keys().next().value);
              bolts.set(c.seq, !c.soft && !noFlash && !!st.flash && flashCap.take(t));
            }
            const hard = bolts.get(c.seq), d = age;
            if (hard && d < 0.3) {
              ctx.globalAlpha = 1;
              ctx.fillStyle = `rgba(215,225,255,${(0.16 * k * Math.exp(-d * 12)).toFixed(3)})`;
              ctx.fillRect(0, 0, vw, vh);
            }
            const a = hard ? Math.exp(-d * 5) : 0.4 * smooth(d / 0.25) * smooth((dur - d) / 0.6);
            if (a > 0.01) {
              boltPath(ctx, c.seq, S);
              ctx.globalAlpha = 1;
              ctx.lineWidth = 9 * S;
              ctx.strokeStyle = `rgba(180,200,255,${(0.2 * a * k).toFixed(3)})`;
              ctx.stroke();
              ctx.lineWidth = 2.5 * S;
              ctx.strokeStyle = `rgba(240,245,255,${(0.85 * a * k).toFixed(3)})`;
              ctx.stroke();
            }
            wash(ctx, [150, 170, 255], "top", 0.12 * k * smooth(d / 0.3) * smooth((dur - d) / 0.6), st);
            break;
          }
          case "pyro": case "co2": case "rockets": case "confetti": {
            // die Location zündet (wenn er dort hingehört) – sonst ein Schein an seiner Stelle
            // (der Zustand bleibt hier: im Hintergrund-Thread kommt jede Antwort in jedem Bild als neue Kopie an)
            if (!venueOk.has(c.seq)) {
              if (venueOk.size > 16) venueOk.delete(venueOk.keys().next().value);
              venueOk.set(c.seq, !!hooks?.[f]?.(k));
            }
            const ok = venueOk.get(c.seq);
            if (!ok && f !== "confetti") wash(ctx, f === "pyro" ? [255, 120, 40] : [220, 230, 255], "floor", 0.2 * k * e, st);
            break;
          }
          case "jump": crowdOut.jump = Math.max(crowdOut.jump, k * e); break;
          case "hands": crowdOut.hands = Math.max(crowdOut.hands, e); break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";
    return crowdOut;
  }
  return { draw };
}


/* ---------------------------------------------------------------- Reaktionen der Gäste */
// Herz, Feuer, Applaus und Wow von den Handys (live.js sammelt sie zu Wellen): kleine Lichtzeichen in den Farben
// der Bühne steigen aus der Menge auf – je mehr Gäste tippen, desto breiter und voller die Welle, nie ein Regen.
// Sie bleiben im unteren Viertel links und rechts (Liedtext, Titel und Künstler stehen darüber bzw. in der Mitte). Dazu flackern ein paar
// Lichter in der Menge auf – mit „Keine Blitze“ glühen sie nur weich, ohne Flackern. Ohne Bühne (Ansage, ruhig)
// steigen nur wenige, langsame Zeichen auf.
// Die Zeichen sind dieselben wie auf den Handys (docs/live/index.html), als Bild je Farbe einmal gerendert.
const REACT_KINDS = ["heart", "fire", "clap", "wow"];
function reactPath(kind) {
  if (kind === "clap") {
    const p = new Path2D();
    p.ellipse(8.6, 14, 3.3, 6.2, (-24 * Math.PI) / 180, 0, Math.PI * 2);
    p.ellipse(15.4, 14, 3.3, 6.2, (24 * Math.PI) / 180, 0, Math.PI * 2);
    return p;
  }
  return new Path2D(
    kind === "heart" ? "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      : kind === "fire" ? "M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"
        : "M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z",
  );
}
// Publikum an oder aus („Publikum zeigen“, cfg.partyCrowd) – was dann am unteren Rand steht:
// mit Menge: Silhouetten, Dunst über ihnen, Handy-Lichter darin, Reaktionen steigen aus der Menge auf;
// ohne Menge: nichts davon – dafür die flachen Bassbalken (wenn das Genre sie hat) und Reaktionen, die vom
// unteren Bildrand aufsteigen. fx: die Bühne spielt gerade (keine Ansage, nicht „Ruhig“)
function crowdLayers({ crowd, fx = true, bottom = false } = {}) {
  const people = !!crowd && !!fx;
  return { people, glints: people, bassBars: !crowd && !!bottom, reactY0: people ? 0.93 : 1.01, reactSpread: people ? 0.05 : 0.02 };
}
function createReactFx(glowSprite, makeCanvas) {
  let seen = 0;
  const parts = [], glints = [], sprites = new Map(), paths = {};
  // Zeichen je Art und Farbe (auf 16er-Stufen gerastert, höchstens 24 Bilder)
  function sprite(kind, c) {
    const rgb = c.map((v) => Math.min(255, Math.round(v / 16) * 16)).join(","), k = kind + rgb;
    let cv = sprites.get(k);
    if (cv) return cv;
    if (sprites.size > 24) sprites.clear();
    cv = makeCanvas(64, 64);
    cv.width = cv.height = 64;
    const x = cv.getContext("2d");
    x.setTransform(64 / 24, 0, 0, 64 / 24, 0, 0);
    x.fillStyle = `rgb(${rgb})`;
    x.fill((paths[kind] ||= reactPath(kind)));
    if (kind === "clap") {
      // drei kurze Striche über den Händen
      x.strokeStyle = x.fillStyle;
      x.lineWidth = 1.6;
      x.lineCap = "round";
      x.beginPath();
      x.moveTo(12, 2.2);
      x.lineTo(12, 4.6);
      x.moveTo(7.4, 3.6);
      x.lineTo(8.6, 5.6);
      x.moveTo(16.6, 3.6);
      x.lineTo(15.4, 5.6);
      x.stroke();
    }
    sprites.set(k, cv);
    return cv;
  }
  function spawn(w, st, soft) {
    const vw = st.vw, vh = st.vh, dpr = st.dpr || 1;
    // ohne Publikum steigen die Zeichen vom unteren Bildrand auf, und in der (fehlenden) Menge blinkt nichts
    const lay = crowdLayers({ crowd: st.crowd !== false });
    // Größe der Welle: wächst mit der Zahl der Taps, aber nur logarithmisch (30 Taps ≈ 6, nicht 30)
    const s = clamp(1 + Math.log2(Math.max(1, w.n)), 1, 6);
    const n = Math.round(clamp(3 + 3.6 * s, 4, 24) * (soft ? 0.35 : 1) * ((st.quality ?? 2) < 1 ? 0.6 : 1));
    const total = REACT_KINDS.reduce((a, k) => a + (w.k?.[k] || 0), 0) || 1;
    // links oder rechts der Mitte (dort stehen Liedtext, Titel und Künstler), eine große Welle auf beiden Seiten
    const side = Math.random() < 0.5 ? -1 : 1, both = s >= 4, spread = vw * (0.05 + 0.025 * s);
    const scale = clamp(vh / (900 * dpr), 0.75, 1.6) * dpr;
    for (let i = 0; i < n && parts.length < 140; i++) {
      const sd = both ? (i % 2 ? 1 : -1) : side, x0 = vw * (0.5 + sd * 0.32);
      // Art nach Anteil der Taps
      let r = Math.random() * total, kind = "heart";
      for (const k of REACT_KINDS)
        if ((r -= w.k?.[k] || 0) < 0) {
          kind = k;
          break;
        }
      const dx = (Math.random() * 2 - 1) * spread;
      parts.push({
        // nie in die Mitte (Titel und Künstler), nie über den Rand
        kind, x: clamp(x0 + dx, vw * 0.03, vw * 0.97), y: vh * (lay.reactY0 + Math.random() * lay.reactSpread), vy: -vh * (0.06 + Math.random() * 0.05) * (soft ? 0.55 : 1),
        // die Welle läuft von der Mitte nach außen
        age: -(Math.abs(dx) / Math.max(1, spread)) * (0.15 + 0.06 * s), life: 2.2 + Math.random() * 0.8, ph: Math.random() * 6.3,
        r: (12 + Math.random() * 7 + s * 1.4) * scale, c: i % 3,
      });
    }
    // Lichter in der Menge flackern auf (ab einer kleinen Welle)
    if (!soft && s >= 2 && lay.glints)
      for (let i = 0; i < 2 + Math.round(s * 1.5) && glints.length < 40; i++)
        glints.push({ x: vw * (0.5 + (both ? (i % 2 ? 1 : -1) : side) * 0.32) + (Math.random() * 2 - 1) * spread * 1.2, y: vh * (0.8 + Math.random() * 0.09), age: -Math.random() * 0.3, life: 1.1 + Math.random() * 0.5, r: (26 + Math.random() * 24) * scale, c: i % 3, ph: Math.random() * 6.3 });
  }
  function draw(ctx, st) {
    const soft = !st.stage;
    for (const w of st.reacts || []) {
      if (w.id <= seen) continue;
      seen = w.id;
      if (w.age < 2) spawn(w, st, soft);
    }
    if (!parts.length && !glints.length) return;
    const dt = Math.min(0.1, st.dt || 0.016), vh = st.vh, pal = st.pal, t = st.t;
    // höchstens bis gut drei Viertel der Höhe: darüber steht der Liedtext
    const top = vh * 0.76, band = vh * 0.07;
    ctx.globalCompositeOperation = "lighter";
    for (let i = glints.length - 1; i >= 0; i--) {
      const g = glints[i];
      g.age += dt;
      if (g.age >= g.life) {
        glints.splice(i, 1);
        continue;
      }
      if (g.age < 0) continue;
      const bell = Math.sin(Math.PI * clamp(g.age / g.life, 0, 1));
      // Flackern wie Handylichter – mit „Keine Blitze“ nur ein weiches Glühen
      const a = st.noFlash ? bell * 0.18 : bell * (0.22 + 0.2 * Math.sin(t * 26 + g.ph));
      ctx.globalAlpha = clamp(a, 0, 0.45);
      ctx.drawImage(glowSprite(pal[g.c]), g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life || p.y < top) {
        parts.splice(i, 1);
        continue;
      }
      if (p.age < 0) continue;
      p.y += p.vy * dt;
      const x = p.x + Math.sin(p.age * 2.2 + p.ph) * p.r * 0.5;
      // ein, aus, und oben am Rand des unteren Viertels ganz weg
      const a = smooth(p.age / 0.3) * Math.pow(1 - p.age / p.life, 1.4) * clamp((p.y - top) / band, 0, 1);
      if (a < 0.01) continue;
      const r = p.r * (0.85 + 0.25 * smooth(p.age / 0.6));
      ctx.globalAlpha = a * 0.45;
      ctx.drawImage(glowSprite(pal[p.c]), x - r * 1.6, p.y - r * 1.6, r * 3.2, r * 3.2);
      ctx.globalAlpha = a * 0.9;
      ctx.drawImage(sprite(p.kind, mixW(pal[p.c], 0.28)), x - r / 2, p.y - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
  }
  return { draw };
}

export { createStageFx, createReactFx, crowdLayers, REACT_KINDS, FI };
