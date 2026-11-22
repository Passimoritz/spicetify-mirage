/* ---------------------------------------------------------------- Bilder der Klang-Detektoren */
// Zeichnet in der Location (venue.js, auch im Hintergrund-Thread), was sonic.js/sonicrt.js erkennen: je Instrument
// und Effekt ein eigenes Bild, damit man sie auseinanderhalten kann. Fast alles ist eine Funktion von Zeit, Fortschritt
// und Hüllkurven der Party (kickEnv, hatEnv, Schlagphase); gespeichert wird nur wenig (Hülle je Effektart, die
// Zeitpunkte der letzten 808-Schläge, die Richtung des Whoosh).
// Weich statt hart: jeder Effekt steigt über mindestens 80 ms an (fxenv.js), Wiederholungen blenden an ihren Kanten
// aus und ein, Rauschen gleitet statt je Bild neu zu würfeln, kein weißer Blitz. „Keine Blitze“ macht Pulse zu ruhigem
// Glühen und schnelles Hin und Her (Scratch, Sirene, Stotter, Airhorn) zu langsamem Wiegen bzw. einem weichen Puls –
// nie mehr als drei Helligkeitswechsel pro Sekunde (tests/unit/noflash.test.js).
// „Leicht“ (quality < 1) zeichnet weniger Punkte und lässt die teuren Verläufe weg; ein Wechsel der Stufe mitten im Song
// blendet über (st.qf gleitet 0..1), statt Punkte und Verläufe im selben Bild verschwinden zu lassen.
// Größen folgen der Fensterhöhe (900 px = 1), nicht nur der Pixeldichte. Kamera bleibt, wo sie ist.
//   Instrumente: kick → Bodenpuls · sub808 → Bodenschockwelle · hats → Funkeln an der Traverse · crash → Schimmer-
//   fächer alle vier Takte (ab der Eins des Viertakters) · acguitar → sechs warme Lichtsaiten · pad → Polarlicht-Band ·
//   bells → Glockensterne mit Ringen · organ → Lichtpfeifen · piano (ohne Tonhöhen) → Tasten-Wellen über den Boden
//   Effekte: riser/sweep → Strahlen laufen nach oben zusammen, heller werdend (sweep: Rauschband steigt mit) ·
//   downlift → Strahlen fallen auseinander · impact → Ringwelle aus dem Cover + Staub · subdrop → schwere Bodenwellen,
//   unten wird es dunkel · orchhit → goldener Strahlenkranz · stop → Licht senkt sich, ein schmaler Spot bleibt ·
//   tapestop → Lichtbalken werden langsamer und blasser · revcym → Schimmer saugt sich ins Cover · stutter → Zeilen
//   wiederholen sich im Sechzehntel · scratch → Scan-Balken hin und her · filter → Lichtvorhang hebt/senkt sich ·
//   pump → Bodenlicht duckt sich unter der Kick · cheer → Handylichter in der Menge · siren → rot/blaue Drehlichter
//   (kein Stroboskop) · airhorn → drei Pulse aus Hörnern · zap → Laserstrich · whoosh → Lichtbogen mit spitz
//   auslaufendem Schweif zieht vorbei (abwechselnd links/rechts) · rewind → Spirale dreht rückwärts und bremst
// Vorrang: läuft ein Drop-Bild der Regie (stagefx.js), tritt die Ringwelle des Impacts zurück; Bodenpuls, 808-Schein,
// Pumpen und der 808-Boden der Regie (show.js) teilen sich eine Helligkeit für den Bühnenboden.
import { smooth, envAR, slew, vnoise, hash } from "./fxenv.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mixW = (c, f) => [c[0] + (255 - c[0]) * f, c[1] + (255 - c[1]) * f, c[2] + (255 - c[2]) * f];
const mixC = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
const bell = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
// an einer Wiederholungskante (Lage q 0..1) aus- und wieder einblenden statt zu springen
const edge = (q) => smooth(q / 0.06) * smooth((1 - q) / 0.06);
// Helligkeit des Bühnenbodens: Bodenpuls, 808, Pumpen und der 808-Boden der Regie zusammen höchstens so viel
const FLOOR_BUDGET = 0.34;
// tiefer Grundton der 808 (wird mit der ersten Lichtfarbe gemischt, statt immer fest violett zu sein)
const DEEP = [90, 40, 160];

function createInstFx(glowSprite) {
  let vw = 0, vh = 0, qf = 1;
  // Hülle je Effektart (Anstieg ≥ 80 ms), Richtung des Whoosh, Zeitpunkte der letzten 808-Schläge
  const env = {}, hits = [];
  let whooshDir = -1, kPrev = 0;
  const glow = (ctx, col, x, y, r, a) => {
    if (a <= 0.004 || r <= 0) return;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.drawImage(glowSprite(col.map((v) => v | 0), r > 48), x - r, y - r, r * 2, r * 2);
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
  // Übergang Leicht ↔ Voll: Punkte jenseits der leichten Zahl (bzw. jeder zweite eines Fächers) blenden mit qf
  const nOf = (nLite, nFull) => (qf > 0.01 ? nFull : nLite);
  const qa = (i, nLite) => (i < nLite ? 1 : qf);
  const qp = (k) => (k % 2 ? qf : 1);

  /* ---- Instrumente */
  function instruments(ctx, st, I, px, pal, S, calmPulse, floor) {
    const t = st.t, bd = 60 / (st.bpm || 120), ph = px.phase || 0, bi = Math.max(0, px.beatIdx || 0);
    const floorY = vh * 0.93;
    if (floor.k > 0.004) {
      // Bodenpuls: weicher Schein am Bühnenboden, auf der Kick
      glow(ctx, mixW(pal[0], 0.2), vw / 2, floorY, vw * 0.28, floor.k * floor.s);
    }
    if (I.sub808 > 0.01) {
      // Bodenschockwelle: je Schlag ein Ring von der Bühnenmitte nach außen – ältere Ringe laufen zu Ende, statt beim
      // nächsten Schlag zu verschwinden (vorher begann der eine Ring bei jeder Kick neu)
      const c = mixW(mixC(pal[0], DEEP, 0.35), 0.1);
      for (const h of hits) {
        const f = (t - h) / 0.8;
        if (f < 0 || f >= 1) continue;
        ellipse(ctx, c, vw / 2, floorY, vw * (0.06 + 0.55 * f), vh * (0.015 + 0.07 * f), 0.4 * I.sub808 * (1 - f) * smooth(f / 0.1) * (st.noFlash ? 0.6 : 1), (6 - 4 * f) * S);
      }
      // die 808 klingt lang aus: der Schein folgt dem gehaltenen Bass, in der Lichtfarbe des Songs (tief gemischt)
      glow(ctx, mixC(pal[0], DEEP, 0.45), vw / 2, vh * 1.02, vw * 0.35, floor.b * floor.s);
    }
    if (I.hats > 0.01) {
      // Funkeln an der Traverse: kleine Punkte, die auf der Hi-Hat aufblitzen (ohne Blitze: ruhig glimmend)
      const n = nOf(6, 14), e = calmPulse(px.hatEnv);
      for (let i = 0; i < n; i++) {
        const x = vw * (0.08 + 0.84 * hash(i, 31)), tw = 0.4 + 0.6 * hash(i + (bi % 7), 9);
        glow(ctx, [235, 245, 255], x, vh * 0.055, (3 + 3 * tw) * S, 0.7 * I.hats * e * tw * qa(i, 6));
      }
    }
    if (I.crash > 0.01) {
      // Becken: alle vier Takte auf der Eins ein breiter Schimmerfächer oben, der langsam verglimmt – gezählt ab der
      // Eins des Viertakters (Song-Karte), nicht ab dem ersten Schlag des Songs
      const inPhrase = px.barIdx >= 0 ? ((px.barIdx % 4) + 4) % 4 * 4 + (px.inBar || 0) : bi % 16;
      const age = (inPhrase + ph) * bd;
      if (age < 1.8 && px.energy > 0.5) {
        const f = age / 1.8, c = [255, 248, 220], a = 0.16 * I.crash * (1 - f) * envAR(age);
        for (let k = 0; k < 9; k += qf > 0.01 ? 1 : 2) {
          const an = Math.PI * (0.15 + 0.7 * (k / 8)), len = vh * (0.25 + 0.3 * f);
          line(ctx, c, a * qp(k), 3 * S, [[vw / 2, vh * 0.02], [vw / 2 + Math.cos(an) * len * 1.6, vh * 0.02 + Math.sin(an) * len]]);
        }
        glow(ctx, c, vw / 2, vh * 0.03, vh * 0.18, 0.3 * I.crash * (1 - f) * envAR(age));
      }
    }
    if (I.acguitar > 0.01) {
      // Akustikgitarre: sechs warme Lichtsaiten am rechten Rand, die auf dem Schlag schwingen (ohne Blitze wiegen sie
      // nur langsam – eine schnell schwingende helle Saite flimmert an ihrem Platz)
      const c = [255, 190, 120], sw = calmPulse(Math.max(px.beat || 0, px.snareEnv || 0));
      for (let k = 0; k < 6; k++) {
        const x = vw * (0.86 + k * 0.016), pts = [], fr = st.noFlash ? 1.2 + k * 0.2 : 20 + k * 3;
        for (let s = 0; s <= 10; s++) {
          const f = s / 10;
          pts.push([x + Math.sin(f * Math.PI) * Math.sin(t * fr) * 6 * S * sw, vh * (0.25 + 0.5 * f)]);
        }
        line(ctx, c, (0.18 + 0.25 * sw) * I.acguitar, (1 + (5 - k) * 0.25) * S, pts);
      }
    }
    if (I.pad > 0.01) {
      // Fläche: ein Polarlicht-Band oben, das langsam wandert (Leicht: ein einfacher Schein; dazwischen überblendet)
      if (qf > 0.01) {
        for (let k = 0; k < 2; k++) {
          const y0 = vh * (0.12 + 0.06 * k + 0.03 * Math.sin(t * 0.25 + k * 2)), h = vh * 0.12;
          const g = ctx.createLinearGradient(0, y0 - h, 0, y0 + h), c = mixW(pal[1 + k], 0.25);
          for (let s = 0; s < 9; s++) g.addColorStop(s / 8, rgba(c, 0.13 * I.pad * qf * bell(s / 8) ** 1.5));
          ctx.globalAlpha = 1;
          ctx.fillStyle = g;
          ctx.fillRect(0, y0 - h, vw, h * 2);
        }
      }
      if (qf < 0.99) glow(ctx, mixW(pal[1], 0.25), vw / 2, vh * 0.12, vw * 0.4, 0.12 * I.pad * (1 - qf));
    }
    if (I.bells > 0.01) {
      // Glocken: Sterne oben, auf jedem Schlag klingt einer mit einem feinen Ring (weich angeschlagen)
      const n = nOf(5, 9), c = [255, 240, 200];
      for (let i = 0; i < n; i++) glow(ctx, c, vw * (0.1 + 0.8 * hash(i, 5)), vh * (0.08 + 0.15 * hash(i, 6)), 4 * S, 0.5 * I.bells * (0.5 + 0.5 * Math.sin(t * 2 + i)) * qa(i, 5));
      const i = bi % (qf >= 0.5 ? 9 : 5);
      ellipse(ctx, c, vw * (0.1 + 0.8 * hash(i, 5)), vh * (0.08 + 0.15 * hash(i, 6)), (6 + 40 * ph) * S, (6 + 40 * ph) * S, 0.35 * I.bells * (1 - ph) * envAR(ph * bd), 1.5 * S);
    }
    if (I.organ > 0.01) {
      // Orgel: Lichtpfeifen hinten in der Mitte, die atmen (Leicht: jede zweite)
      for (let k = 0; k < 9; k += qf > 0.01 ? 1 : 2) {
        const f = k / 8, h = vh * (0.12 + 0.18 * (1 - Math.abs(f - 0.5) * 2)) * (0.85 + 0.15 * Math.sin(t * 0.8 + k)), x = vw * (0.35 + 0.3 * f);
        line(ctx, mixW(pal[k % 3], 0.4), 0.22 * I.organ * qp(k), 7 * S, [[x, vh * 0.55], [x, vh * 0.55 - h]]);
      }
    }
    if (I.piano > 0.01 && !I.chroma) {
      // Klavier ohne Tonhöhen (nur die Hörprobe weiß, dass es spielt): Tasten-Wellen laufen über den Boden
      const x = vw * (0.15 + 0.7 * ((bi * 3) % 8) / 7), c = mixW(pal[bi % 3], 0.4);
      ellipse(ctx, c, x, floorY - vh * 0.02, vw * (0.02 + 0.1 * ph), vh * (0.006 + 0.025 * ph), 0.45 * I.piano * (1 - ph) * envAR(ph * bd), 2 * S);
    }
  }

  /* ---- Effekte (je { k, p: Fortschritt, e: Hülle, c: Sicherheit, s: Stärke 0,4–1 aus der Sicherheit – knapp sicher = zart) */
  function effect(ctx, st, f, px, pal, S) {
    const t = st.t, p = clamp(f.p, 0, 1), cx = st.cx ?? vw / 2, cy = st.cy ?? vh / 2, R = st.R || vh * 0.15;
    // gemeinsame Hülle: nie ein Einsatz im selben Bild (≥ 80 ms Anstieg), weiches Ausklingen
    const e = slew((env[f.k] ||= { v: 0 }), clamp(f.e, 0, 1), st.dt) * clamp(f.s ?? 1, 0, 1);
    const far = Math.hypot(vw, vh), noFlash = !!st.noFlash, bi = Math.max(0, px.beatIdx || 0), ph = px.phase || 0;
    if (e <= 0.004) return;
    switch (f.k) {
      case "riser":
      case "sweep": {
        // Strahlen vom Boden laufen über dem Cover zusammen, je näher der Höhepunkt, desto heller und enger
        const step = qf > 0.01 ? 1 : 2, tx = cx, ty = -vh * 0.05, a = (0.06 + 0.24 * p * p) * e, c = mixW(pal[2], 0.35 + 0.4 * p);
        for (let k = 0; k < 9; k += step) {
          const x0 = vw * ((k + 0.5) / 9), xm = x0 + (tx - x0) * p * 0.8;
          line(ctx, c, a * qp(k), (3 + 6 * p) * S, [[x0, vh], [xm, ty]]);
        }
        if (f.k === "sweep") {
          // Rauschband steigt mit – die Punkte schimmern gleitend (zusammenhängendes Rauschen statt Würfeln je 1/20 s)
          const y = vh * (1 - p), h = vh * 0.08, n = nOf(12, 30);
          for (let i = 0; i < n; i++) glow(ctx, [230, 235, 255], hash(i, 3) * vw, y + (hash(i, 4) - 0.5) * h, (2 + 3 * vnoise(t * 5 + i * 1.7, 7)) * S, 0.5 * e * qa(i, 12));
        }
        break;
      }
      case "downlift": {
        const c = mixW(pal[1], 0.3);
        for (let k = 0; k < 7; k += qf > 0.01 ? 1 : 2) {
          const x0 = cx + (k - 3) * vw * 0.03, x1 = cx + (k - 3) * vw * (0.05 + 0.12 * p);
          line(ctx, c, 0.22 * e * (1 - p) * qp(k), 4 * S, [[x0, 0], [x1, vh * (0.3 + 0.7 * p)]]);
        }
        break;
      }
      case "impact": {
        // Ringwelle aus dem Cover, dahinter fällt Staub; mit Blitzen ein weicher (nie weißer) Aufschein.
        // Läuft gerade ein Drop-Bild der Regie, führt das – die Ringwelle tritt zurück (sonst zwei Ringe übereinander)
        const lead = 1 - 0.65 * clamp((px.scn?.dx || 0) / 0.3, 0, 1);
        const r = R + p * far * 0.6, c = mixW(pal[0], 0.5);
        ellipse(ctx, c, cx, cy, r, r, 0.5 * e * (1 - p) * lead, (10 - 7 * p) * S);
        if (!noFlash && p < 0.2) glow(ctx, mixW(pal[0], 0.3), cx, cy, R * 3, 0.25 * (1 - p / 0.2) * e * lead);
        for (let i = 0, n = nOf(10, 26); i < n; i++) glow(ctx, [210, 200, 190], hash(i, 1) * vw, vh * (0.1 + 0.5 * hash(i, 2) + 0.3 * p), (2 + 2 * hash(i, 3)) * S, 0.35 * e * (1 - p) * qa(i, 10));
        break;
      }
      case "subdrop": {
        const c = mixC(pal[0], DEEP, 0.5);
        for (let k = 0; k < 3; k++) {
          const q = clamp(p * 1.2 - k * 0.15, 0, 1);
          ellipse(ctx, c, vw / 2, vh * 0.95, vw * (0.1 + 0.6 * q), vh * (0.02 + 0.08 * q), 0.4 * e * (1 - q) * smooth(q / 0.1), 8 * S);
        }
        // unten wird es dunkel: der Klang sinkt in den Boden
        ctx.globalCompositeOperation = "source-over";
        const g = ctx.createLinearGradient(0, vh * 0.55, 0, vh), d = 0.35 * e * bell(p);
        for (let s = 0; s < 9; s++) g.addColorStop(s / 8, `rgba(0,0,0,${(d * smooth(s / 8)).toFixed(4)})`);
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, vh * 0.55, vw, vh * 0.45);
        ctx.globalCompositeOperation = "lighter";
        break;
      }
      case "orchhit": {
        const c = [255, 205, 110];
        for (let k = 0; k < 16; k += qf > 0.01 ? 1 : 2) {
          const a = (k / 16) * Math.PI * 2 + 0.2, r0 = R * 1.1, r1 = R * (1.4 + 2.2 * p);
          line(ctx, c, 0.35 * e * (1 - p) * qp(k), 3 * S, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]]);
        }
        glow(ctx, c, cx, cy, R * 2, 0.2 * e * (1 - p));
        break;
      }
      case "stop":
      case "tapestop": {
        if (f.k === "tapestop") {
          // Lichtbalken laufen quer und bremsen bis zum Stillstand, dabei verblassen sie. Leicht: jeder zweite der sechs
          // (vorher lagen die drei leichten alle in der linken Hälfte); an der Bildkante blenden sie aus und ein
          const slow = 1 - (1 - p) ** 3, c = mixW([200, 200, 210], 0.2 * (1 - p));
          for (let k = 0; k < 6; k += qf > 0.01 ? 1 : 2) {
            const q = (k / 6 + slow * 0.6) % 1, x = q * vw;
            line(ctx, c, 0.25 * e * (1 - p) * edge(q) * qp(k), 10 * S, [[x, vh * 0.3], [x, vh * 0.7]]);
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
        const n = nOf(12, 28), c = [235, 240, 255];
        for (let i = 0; i < n; i++) {
          const a = hash(i, 8) * Math.PI * 2, r = R + (1 - p) * far * (0.3 + 0.3 * hash(i, 9));
          glow(ctx, c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, (2 + 3 * p) * S, 0.6 * e * p * qa(i, 12));
        }
        break;
      }
      case "stutter": {
        // Zeilen wiederholen sich im Sechzehntel des Taktrasters (nicht der Uhr): dieselben Streifen springen im Raster.
        // Ohne Blitze stehen die Streifen still und atmen einmal je Schlag weich auf (statt achtmal pro Sekunde zu springen)
        const q = noFlash ? 0 : Math.floor((bi + ph) * 4), c = mixW(pal[(noFlash ? bi : q) % 3], 0.4);
        const a = noFlash ? 0.05 + 0.03 * Math.cos(Math.PI * ph) ** 2 : 0.12;
        for (let k = 0, n = nOf(3, 5); k < n; k++) {
          const y = vh * (0.2 + 0.6 * hash(k, q % 4));
          ctx.globalAlpha = 1;
          ctx.fillStyle = rgba(c, a * e * qa(k, 3));
          ctx.fillRect(0, y, vw, 5 * S);
        }
        break;
      }
      case "scratch": {
        // Scan-Balken hin und her (3,5 Hz); ohne Blitze ein langsames Wiegen (0,4 Hz, halbe Weite)
        const x = noFlash ? cx + Math.sin(t * Math.PI * 2 * 0.4) * vw * 0.15 : cx + Math.sin(t * Math.PI * 2 * 3.5) * vw * 0.3;
        line(ctx, mixW(pal[2], 0.5), (noFlash ? 0.2 : 0.3) * e, 6 * S, [[x, vh * 0.15], [x, vh * 0.85]]);
        break;
      }
      case "filter": {
        // Lichtvorhang vom Boden, der mit der Filterfahrt steigt
        const h = vh * (0.15 + 0.55 * p), g = ctx.createLinearGradient(0, vh - h, 0, vh), c = mixW(pal[1], 0.3);
        for (let s = 0; s < 9; s++) g.addColorStop(s / 8, rgba(c, 0.18 * e * smooth(s / 8)));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, vh - h, vw, h);
        break;
      }
      case "pump": {
        // Bodenlicht duckt sich unter jeder Kick und schwillt bis zur nächsten an – pumpt schon die Rückwand der
        // Regie (House, show.js), zeichnet nur sie (vorher pumpte es doppelt)
        if ((px.pump || 0) > 0.05) break;
        glow(ctx, mixW(pal[2], 0.2), vw / 2, vh * 0.98, vw * 0.45, 0.22 * e * (1 - (px.kickEnv || 0)) * (st.floorS ?? 1));
        break;
      }
      case "cheer": {
        for (let i = 0, n = nOf(14, 34); i < n; i++) {
          const tw = Math.max(0, Math.sin(t * (2 + 2 * hash(i, 4)) + hash(i, 5) * 6));
          glow(ctx, [255, 255, 240], hash(i, 1) * vw, vh * (0.68 + 0.22 * hash(i, 2)), 3 * S, 0.6 * e * tw * qa(i, 14));
        }
        break;
      }
      case "siren": {
        // rot und blau drehende Lichtkegel aus den oberen Ecken – weiches Drehen, kein Stroboskop.
        // Ohne Blitze drehen sie nicht (ein vorbeistreichender Kegel ist an jeder Stelle ein Aufblitzen): die Ecken
        // glühen nur und atmen langsam (0,5 Hz)
        for (const [ox, col, dir] of [[0, [255, 50, 60], 1], [vw, [60, 110, 255], -1]]) {
          if (noFlash) {
            glow(ctx, col, ox, 0, vh * 0.3, 0.22 * e * (0.7 + 0.3 * Math.sin(t * Math.PI + (dir > 0 ? 0 : Math.PI))));
            continue;
          }
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
        // drei Pulse aus goldenen Hörnern an den Seiten; ohne Blitze ein einziges weiches Anschwellen
        const pulse = noFlash ? 0.6 * bell(p) : Math.max(bell(p / 0.25), bell((p - 0.33) / 0.25), bell((p - 0.66) / 0.25));
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
        // Lichtbogen zieht vorbei: ein heller Kopf mit spitz auslaufendem, verblassendem Schweif (deckt die Strecke der
        // letzten Bilder ab – wirkt wie Bewegungsunschärfe statt eines Sprungs von 60–130 px je Bild). Jeder neue
        // Whoosh zieht in die andere Richtung
        const dir = env.whoosh.dir || 1, c = mixW(pal[0], 0.5), M = 12, tail = 0.3, base = 0.3 * e * bell(p);
        const at = (q) => {
          const a = Math.PI * (dir > 0 ? 1 - q : q);
          return [cx + Math.cos(a) * vw * 0.45, vh * 0.75 - Math.sin(a) * vh * 0.4];
        };
        let prev = at(p - tail);
        for (let j = 1; j <= M; j++) {
          const w = j / M, cur = at(p - tail * (1 - w));
          line(ctx, c, base * w * w, (1 + 5 * w) * S, [prev, cur]);
          prev = cur;
        }
        glow(ctx, mixW(c, 0.3), prev[0], prev[1], 16 * S, base * 0.8);
        break;
      }
      case "rewind": {
        // Spirale um das Cover dreht rückwärts und bremst ab
        const rot = -(1 - (1 - p) ** 2) * Math.PI * 6, n = nOf(10, 22), c = mixW(pal[1], 0.4);
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
    const dpr = st.dpr || 1, S = dpr * clamp(vh / (900 * dpr), 0.75, 1.6), pal = st.pal, t = st.t;
    qf = clamp(st.qf ?? ((st.quality ?? 2) < 1 ? 0 : 1), 0, 1);
    // ohne Blitze: Pulse werden ein ruhiges Glühen (halbe Tiefe)
    const calmPulse = (e) => (st.noFlash ? 0.55 + 0.25 * (e || 0) : 0.25 + 0.75 * (e || 0));
    // 808-Schläge merken (steigende Kick-Hülle): jeder bekommt seinen eigenen Ring
    const kEnv = px.kickEnv || 0;
    if (hits.length && t < hits[hits.length - 1]) hits.length = 0;
    // (ohne Blitze nur auf 1 und 3 – zusammen mit den Tasten-Wellen am Boden sonst mehr als drei Wellen pro Sekunde)
    if (I.sub808 > 0.01 && kEnv > 0.6 && kEnv > kPrev + 0.25 && !(st.noFlash && (px.inBar ?? 0) % 2)) {
      hits.push(t);
      if (hits.length > 4) hits.shift();
    }
    kPrev = kEnv;
    // Bühnenboden: ein Licht führt – mit 808 tritt der Bodenpuls zurück; alles zusammen (mit dem 808-Boden der
    // Regie aus show.js und dem Pumpen) höchstens FLOOR_BUDGET hell
    const sub = I.sub808 > 0.01 ? 0.18 * I.sub808 * calmPulse(Math.max(kEnv, px.bass || 0)) : 0;
    const kick = I.kick > 0.01 ? 0.22 * I.kick * calmPulse(kEnv) * (sub > 0.02 ? 0.6 : 1) : 0;
    const pumpFx = (I.sfx || []).find((f) => f.k === "pump");
    const pump = pumpFx && !((px.pump || 0) > 0.05) ? 0.22 * clamp(pumpFx.e, 0, 1) * (1 - kEnv) : 0;
    const boom = 0.3 * (px.boom || 0), own = kick + sub + pump;
    const floor = { k: kick, b: sub, s: own > 0.001 && own + boom > FLOOR_BUDGET ? Math.max(0, FLOOR_BUDGET - boom) / own : 1 };
    st.floorS = floor.s;
    ctx.globalCompositeOperation = "lighter";
    instruments(ctx, st, I, px, pal, S, calmPulse, floor);
    // Hüllen von Effekten, die gerade nicht laufen, auf null (der nächste Einsatz steigt wieder weich an);
    // ein neuer Whoosh zieht in die andere Richtung
    for (const k in env) env[k].on = false;
    for (const f of I.sfx || []) {
      const s = (env[f.k] ||= { v: 0 });
      if (!s.was && f.k === "whoosh") s.dir = whooshDir = -whooshDir;
      s.on = s.was = true;
    }
    for (const k in env) if (!env[k].on) env[k].v = env[k].was = 0;
    for (const f of I.sfx || []) effect(ctx, st, f, px, pal, S);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";
  }
  return { draw };
}

export { createInstFx };
