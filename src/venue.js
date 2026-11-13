/* ---------------------------------------------------------------- Party-Location */
// Bühnenlicht, Dekor und Publikum des Party-Modus – ohne Zugriff auf Spotify oder das Fenster, darum läuft
// dasselbe Modul im Hintergrund-Thread (eigenes OffscreenCanvas, venue-worker.js) und, wo das nicht geht,
// im Hauptfenster. Jedes Bild bekommt seinen Zustand als „st“ (Takt, Energie, Farben, Kamera …) mitgeteilt.
import { createShow } from "./show.js";
import { createFlashCap } from "./flashcap.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function createVenue(makeCanvas) {
  let vw = 0, vh = 0;
  // Bühnenlicht: jedes Genre hat seine eigene Lichtsprache. Alles mit „lighter“ – Licht addiert sich wie echtes.
  // Leuchtpunkt-Bild je Farbe, einmal gerendert: 90 Discokugel-Punkte kosten dann nur drawImage
  const glowSprites = new Map();
  function glowSprite(c) {
    const k = c.join(",");
    if (!glowSprites.has(k)) {
      if (glowSprites.size > 24) glowSprites.clear();
      const cv = makeCanvas(48, 48);
      cv.width = cv.height = 48;
      const x = cv.getContext("2d");
      const g = x.createRadialGradient(24, 24, 0, 24, 24, 24);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.22, `rgba(${k},0.75)`);
      g.addColorStop(1, `rgba(${k},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 48, 48);
      glowSprites.set(k, cv);
    }
    return glowSprites.get(k);
  }
  // Blitz-Schranke der Bühne: Stroboskop, Blinder und Gitarrenblitze zusammen höchstens drei pro Sekunde,
  // auch wenn die Freigabe aus dem Hauptthread (st.flashGo) einmal fehlt oder doppelt ankommt
  const flashCap = createFlashCap();
  const show = createShow(glowSprite, flashCap);
  let disco = null, tunnel = [];
  function drawStage(ctx, pal, px, rgba, cx, cy, R, dpr, dt, st, v) {
    // t = Bewegungsuhr der Lichtregie (im Break langsamer, im Drop schneller, ohne Sprung), sonst die Uhrzeit
    const t = px.mt ?? st.t, far = Math.hypot(vw, vh) * 1.1;
    const beat = px.accent, vis = clamp(1 - px.low * 0.8, 0.15, 1) * (px.level >= 3 ? 1 : 0.6) * (v?.spot ?? 1);
    // was welches Licht treibt: Boden = Kick, Spots von oben = Snare, Glitzern/Scanner = Hi-Hats
    const kickL = Math.max(beat, px.kickEnv), snareL = Math.max(beat * 0.8, px.snareEnv), hatL = Math.max(beat * 0.6, px.hatEnv);
    const cone = (sx, sy, a, wd, c, al, reach = far) => {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, reach);
      g.addColorStop(0, rgba(c, al));
      g.addColorStop(0.5, rgba(c, al * 0.35));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - wd) * reach, sy + Math.sin(a - wd) * reach);
      ctx.lineTo(sx + Math.cos(a + wd) * reach, sy + Math.sin(a + wd) * reach);
      ctx.closePath();
      ctx.fill();
    };
    switch (px.P.spot) {
      case "cross": {
        // Rave: zwei Kegel aus den unteren Ecken kreuzen sich – im Aufbau immer schneller, beim Drop weit offen
        const sp = 0.6 + px.energy * 0.8 + px.build * 3;
        const al = (0.05 + beat * 0.2 + px.drop * 0.12) * vis;
        for (const [sx, dir, c] of [[0, 1, pal[1]], [vw, -1, pal[2]]]) {
          cone(sx, vh, -Math.PI / 2 + dir * (0.45 + 0.4 * Math.sin(t * sp * dir + px.spin * 0.3)), 0.07 + px.drop * 0.07, c, al);
        }
        break;
      }
      case "top": {
        // Rock: harte, warmweiße Bühnenspots von oben – die Snare auf 2 und 4 reißt sie auf
        const al = (0.06 + snareL * 0.3) * vis;
        const warm = (c) => [0, 1, 2].map((k) => Math.round(c[k] * 0.55 + [255, 236, 210][k] * 0.45));
        for (const [sx, dir, c] of [[vw * 0.18, 1, pal[0]], [vw * 0.82, -1, pal[2]]]) {
          cone(sx, 0, Math.PI / 2 - dir * (0.25 + 0.18 * Math.sin(t * 0.7 + dir)), 0.16, warm(c), al, vh * 1.25);
        }
        break;
      }
      case "floor": {
        // Bass: Licht quillt vom Boden hoch, schwer auf 1 und 3, mit langem Nachhall
        const al = (0.12 + kickL * 0.5 + px.drop * 0.2) * (0.5 + px.I * 0.5) * vis;
        const g = ctx.createRadialGradient(vw / 2, vh * 1.05, 0, vw / 2, vh * 1.05, vh * (0.55 + kickL * 0.25));
        g.addColorStop(0, rgba(pal[0], al));
        g.addColorStop(0.6, rgba(pal[1], al * 0.35));
        g.addColorStop(1, rgba(pal[1], 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, vh * 0.3, vw, vh * 0.7);
        break;
      }
      case "pan": {
        // Pop: weiche Schwenks, die Farben wandern alle vier Sekunden weiter
        const al = (0.05 + beat * 0.14 + px.drop * 0.1) * vis;
        for (const [sx, dir, k] of [[0, 1, 0], [vw, -1, 1]]) {
          cone(sx, vh, -Math.PI / 2 + dir * (0.55 + 0.3 * Math.sin(t * 0.45 + k * 2)), 0.12, pal[(k + Math.floor(t / 4)) % 3], al);
        }
        break;
      }
      case "scan": {
        // Techno: weiche, breite Lichtbänder ziehen im Tempo über das Bild und leuchten auf den Hi-Hats auf –
        // bewusst keine harten Linien (die wirkten wie ein Gitter)
        // ein Durchlauf = 8 Schläge (Schlag-Uhr der Regie), bei Techno lange, hypnotische 16
        const bps = (st.bpm || 125) / 60, beats = px.mb ?? t * bps, per = px.scan ? 16 : 8;
        const al = (0.05 + hatL * 0.22 + px.drop * 0.12) * vis;
        for (let k = 0; k < 2; k++) {
          const y = ((((beats / per + k * 0.5 + px.scene * 0.17) % 1) + 1) % 1) * vh * 1.3 - vh * 0.15;
          const band = vh * (0.16 + 0.06 * px.energy);
          const g = ctx.createLinearGradient(0, y - band, 0, y + band);
          g.addColorStop(0, rgba(pal[k], 0));
          g.addColorStop(0.5, rgba(pal[k], al));
          g.addColorStop(1, rgba(pal[k], 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, y - band, vw, band * 2);
        }
        break;
      }
      case "disco": {
        // House: Discokugel – Lichtpunkte drehen sich langsam über das Bild und blitzen auf dem Schlag auf
        disco ||= Array.from({ length: 90 }, () => ({ th: Math.random() * Math.PI * 2, ph: Math.asin(Math.random() * 2 - 1), tw: Math.random() * 6.3, s: 0.6 + Math.random() }));
        const rot = t * 0.32 + px.spin * 0.08;
        disco.forEach((d, i) => {
          const a = d.th + rot, face = Math.cos(a) * Math.cos(d.ph);
          if (face <= 0.05) return;
          const x = vw / 2 + Math.sin(a) * Math.cos(d.ph) * vw * 0.62, y = vh * 0.42 + Math.sin(d.ph) * vh * 0.62;
          const tw = 0.5 + 0.5 * Math.sin(t * 4.5 + d.tw);
          ctx.globalAlpha = clamp(face * (0.22 + Math.max(beat * 0.7, hatL) * 0.9 + px.drop * 0.3) * (0.4 + 0.6 * tw) * vis, 0, 1);
          const r = (12 + d.s * 13 + beat * 16) * dpr;
          ctx.drawImage(glowSprite(pal[i % 3]), x - r, y - r, r * 2, r * 2);
        });
        ctx.globalAlpha = 1;
        break;
      }
      case "aurora": {
        // Trance: Polarlicht – drei weiche Bänder wehen über die obere Bildhälfte; im Aufbau steigen sie auf
        for (let k = 0; k < 3; k++) {
          const base = vh * (0.14 + 0.11 * k) - px.build * vh * 0.08;
          const amp = vh * (0.05 + 0.025 * k) * (0.6 + px.I * 0.6), thick = vh * (0.08 + 0.05 * px.I);
          const al = (0.05 + px.I * 0.1 + beat * 0.08 + px.drop * 0.1) * vis;
          const wave = (i, off) => Math.sin(i * 0.45 + t * (0.45 + 0.12 * k) + k * 2 + off) * amp + Math.sin(i * 0.17 - t * 0.3) * amp * 0.6;
          ctx.beginPath();
          for (let i = 0; i <= 24; i++) i ? ctx.lineTo((i / 24) * vw, base + wave(i, 0)) : ctx.moveTo(0, base + wave(0, 0));
          for (let i = 24; i >= 0; i--) ctx.lineTo((i / 24) * vw, base + thick + wave(i, 0.6) * 0.8);
          ctx.closePath();
          const g = ctx.createLinearGradient(0, base - amp, 0, base + thick + amp);
          g.addColorStop(0, rgba(pal[k], 0));
          g.addColorStop(0.5, rgba(pal[k], al));
          g.addColorStop(1, rgba(pal[(k + 1) % 3], 0));
          ctx.fillStyle = g;
          ctx.fill();
        }
        break;
      }
      case "tunnel": {
        // Drum & Bass/Hardstyle: auf jedem Treffer läuft ein weicher Lichtring aus dem Cover nach außen
        // (früher eckige Rahmen – zusammen sahen sie wie ein Gitter aus)
        if (px.hit && px.beat > 0.5) tunnel.push({ s: 1, a: 0.4 + 0.5 * px.accent, c: tunnel.length % 3 });
        tunnel = tunnel.filter((f) => (f.a *= Math.exp(-dt * 1.8)) > 0.02 && f.s < 8);
        for (const f of tunnel) {
          f.s *= Math.exp(dt * 1.7);
          const r = R * f.s, w = (10 + f.s * 6) * dpr;
          const g = ctx.createRadialGradient(cx, cy, Math.max(0, r - w), cx, cy, r + w);
          g.addColorStop(0, rgba(pal[f.c], 0));
          g.addColorStop(0.5, rgba(pal[f.c], f.a * vis * 0.5));
          g.addColorStop(1, rgba(pal[f.c], 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, r + w, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: {
        // Chill: breite, sehr weiche Lichtbahnen von oben, die langsam wandern (Balladen: sie atmen über zwei Takte)
        const al = (0.035 + beat * 0.05) * (0.6 + px.I * 0.4) * (1 + (px.swell || 0) * 0.8);
        for (let k = 0; k < 3; k++) {
          cone(vw * (0.2 + 0.3 * k) + Math.sin(t * 0.12 + k * 2) * vw * 0.08, -vh * 0.1, Math.PI / 2 + Math.sin(t * 0.09 + k) * 0.12, 0.2, pal[k], al, vh * 1.3);
        }
      }
    }
  }


  /* ---------------------------------------------------------------- Locations */
  // Wo die Party stattfindet: Größe und Dichte des Publikums, Dunst, wie weit das Licht strahlt, Dekor.
  // Reihen: [Aussehen 0 = vorne/schwarz … 2 = hinten/im Dunst, Größe, Abstand]
  const VENUES = {
    club: { rows: [[1, 0.8, 38], [0, 1.04, 48]], haze: 1.5, spot: 0.85, decor: "club" },
    festival: { rows: [[2, 0.5, 28], [2, 0.62, 34], [1, 0.8, 40], [0, 1.04, 50]], haze: 1, spot: 1.25, decor: "towers" },
    stadium: { rows: [[2, 0.4, 20], [2, 0.5, 26], [2, 0.62, 32], [1, 0.8, 40], [0, 1.04, 50]], haze: 0.75, spot: 1.1, decor: "stands" },
    home: { rows: [], haze: 0.5, spot: 0.5, decor: "fairy" },
    warehouse: { rows: [[1, 0.78, 34], [0, 1.02, 46]], haze: 1.8, spot: 0.9, decor: "warehouse" },
    beach: { rows: [[2, 0.55, 30], [1, 0.8, 40], [0, 1.04, 50]], haze: 0.6, spot: 0.8, decor: "beach", open: true },
    // „open“: unter freiem Himmel (Feuerwerk erlaubt) · „calm“: drinnen und gediegen – kein CO2, keine Flammen,
    // kein Stroboskop, kein Konfetti · „seated“: das Publikum sitzt (Konzertsaal) und wiegt sich nur
    rooftop: { rows: [[1, 0.76, 36], [0, 1.02, 48]], haze: 0.8, spot: 0.9, decor: "rooftop", open: true },
    cathedral: { rows: [[1, 0.72, 42], [0, 0.98, 54]], haze: 1.3, spot: 0.7, decor: "cathedral", calm: true },
    jazzbar: { rows: [[0, 1.08, 64]], haze: 1.7, spot: 0.55, decor: "jazzbar", calm: true },
    forest: { rows: [[2, 0.55, 30], [1, 0.8, 40], [0, 1.04, 50]], haze: 1.2, spot: 1, decor: "forest", open: true },
    hall: { rows: [[2, 0.48, 22], [1, 0.7, 28], [0, 0.94, 38]], haze: 0.6, spot: 0.7, decor: "hall", calm: true, seated: true },
    cellar: { rows: [[1, 0.8, 34], [0, 1.04, 44]], haze: 2, spot: 0.8, decor: "cellar" },
    // 1.17: Weltall, Neon-Straße, Pub, Skihütte, Wüste
    space: { rows: [[2, 0.5, 30], [1, 0.76, 40], [0, 1.02, 52]], haze: 0.5, spot: 1.1, decor: "space", open: true },
    neon: { rows: [[1, 0.78, 36], [0, 1.03, 46]], haze: 1.2, spot: 0.9, decor: "neon" },
    pub: { rows: [[1, 0.82, 40], [0, 1.06, 52]], haze: 1.4, spot: 0.6, decor: "pub", calm: true },
    skihut: { rows: [[1, 0.78, 34], [0, 1.03, 44]], haze: 0.9, spot: 0.85, decor: "skihut", open: true },
    desert: { rows: [[2, 0.52, 30], [1, 0.78, 40], [0, 1.03, 50]], haze: 0.7, spot: 1, decor: "desert", open: true },
  };
  // „Automatisch“: der Ort passt zum Genre
  const AUTO_VENUE = {
    techno: "warehouse", dnb: "warehouse", house: "club", bass: "club", disco: "club", jazz: "jazzbar",
    rave: "festival", trance: "festival", hardstyle: "festival", reggae: "beach", afro: "beach", latin: "beach",
    rock: "stadium", metal: "stadium", punk: "cellar", pop: "stadium", kpop: "stadium", country: "forest",
    chill: "home", classical: "hall",
    edm: "festival", deephouse: "beach", techhouse: "warehouse", psytrance: "forest", dubstep: "festival", garage: "rooftop",
    eurodance: "club", synthwave: "rooftop", hyperpop: "club", trap: "club", drill: "cellar", phonk: "cellar", rnb: "rooftop",
    soul: "jazzbar", indie: "festival", alternative: "stadium", blues: "jazzbar", schlager: "festival", ballad: "stadium", gospel: "cathedral",
    reggaeton: "club", salsa: "beach", brazil: "beach", flamenco: "club", bollywood: "stadium", arabic: "festival", ambient: "home",
    cinematic: "space",
    melodictechno: "space", hardtechno: "warehouse", futurebass: "neon", electroswing: "jazzbar", breakbeat: "warehouse",
    boombap: "rooftop", dancehall: "beach", cloudrap: "neon", hardrock: "stadium", postrock: "space", ska: "pub", emo: "cellar",
    jpop: "neon", musical: "hall", christmas: "skihut", celtic: "pub", balkan: "pub", amapiano: "beach", lofi: "home",
    neoclassical: "hall", acoustic: "pub",
  };
  function drawDecor(ctx, v, px, pal, rgba, dpr, st) {
    const t = st.t, beat = Math.max(px.accent, px.kickEnv * px.energy);
    if (v.decor === "club") {
      // niedrige Decke: ein warmer Lichtbalken oben, der auf dem Schlag aufglimmt
      const g = ctx.createLinearGradient(0, 0, 0, vh * 0.22);
      g.addColorStop(0, rgba(pal[0], (0.08 + beat * 0.14).toFixed(3)));
      g.addColorStop(1, rgba(pal[0], 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh * 0.22);
    } else if (v.decor === "towers") {
      // Festival: zwei Licht-Türme links und rechts, oben je ein Lampenkopf, der im Takt strahlt
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(6,4,14,0.85)";
      for (const x of [vw * 0.06, vw * 0.94]) {
        ctx.fillRect(x - 7 * dpr, vh * 0.3, 14 * dpr, vh * 0.7);
        ctx.fillRect(x - 26 * dpr, vh * 0.3, 52 * dpr, 10 * dpr);
      }
      ctx.globalCompositeOperation = "lighter";
      for (const [x, c] of [[vw * 0.06, pal[1]], [vw * 0.94, pal[2]]]) {
        const r = (60 + beat * 70) * dpr;
        ctx.globalAlpha = clamp(0.35 + beat * 0.6, 0, 1);
        ctx.drawImage(glowSprite(c), x - r, vh * 0.3 - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    } else if (v.decor === "stands") {
      // Stadion: Ränge im Hintergrund voller kleiner Lichter, oben zwei Flutlicht-Schimmer
      stands ||= Array.from({ length: 140 }, () => ({ x: Math.random(), y: 0.52 + Math.random() * 0.2, ph: Math.random() * 6.3 }));
      for (const s1 of stands) {
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + s1.ph);
        ctx.globalAlpha = clamp((0.15 + tw * 0.4) * (0.4 + px.energy * 0.6) + sea.a * 0.35 * tw, 0, 1);
        const r = 5 * dpr;
        ctx.drawImage(glowSprite(s1.ph > 3 ? [255, 245, 220] : pal[2]), s1.x * vw - r, s1.y * vh - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      for (const x of [vw * 0.1, vw * 0.9]) {
        const g = ctx.createRadialGradient(x, 0, 0, x, 0, vh * 0.6);
        g.addColorStop(0, `rgba(255,250,235,${(0.08 + beat * 0.08).toFixed(3)})`);
        g.addColorStop(1, "rgba(255,250,235,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - vh * 0.6, 0, vh * 1.2, vh * 0.6);
      }
    } else if (v.decor === "warehouse") {
      // Lagerhalle: Betonpfeiler im Dunst, dazwischen nackte Lampen, die auf der Kick schaukeln und aufglühen
      ctx.globalCompositeOperation = "source-over";
      for (const f of [0.04, 0.27, 0.73, 0.96]) {
        const g = ctx.createLinearGradient(0, 0, 0, vh);
        g.addColorStop(0, "rgba(5,4,10,0.55)");
        g.addColorStop(0.75, "rgba(5,4,10,0.3)");
        g.addColorStop(1, "rgba(5,4,10,0)");
        ctx.fillStyle = g;
        ctx.fillRect(f * vw - 11 * dpr, 0, 22 * dpr, vh);
      }
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 5; k++) {
        const swing = Math.sin(t * 1.3 + k) * 0.05 + px.kickEnv * 0.02 * (k % 2 ? 1 : -1);
        const x = vw * (0.19 + k * 0.155) + Math.sin(swing) * vh * 0.18, y = vh * (0.12 + 0.03 * (k % 2));
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.moveTo(vw * (0.19 + k * 0.155), 0);
        ctx.lineTo(x, y);
        ctx.stroke();
        const r = (22 + beat * 40) * dpr;
        ctx.globalAlpha = clamp(0.35 + beat * 0.65, 0, 1);
        ctx.drawImage(glowSprite([255, 225, 180]), x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    } else if (v.decor === "beach") {
      // Strand: Abendrot über dem Meer am Horizont, Palmen links und rechts wiegen sich im Takt
      const g = ctx.createLinearGradient(0, vh * 0.45, 0, vh * 0.75);
      g.addColorStop(0, "rgba(255,120,60,0)");
      g.addColorStop(0.7, `rgba(255,140,70,${(0.12 + beat * 0.06).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,90,90,0.04)");
      ctx.fillStyle = g;
      ctx.fillRect(0, vh * 0.45, vw, vh * 0.3);
      ctx.fillStyle = `rgba(255,200,150,${(0.05 + beat * 0.05).toFixed(3)})`;
      ctx.fillRect(0, vh * 0.72, vw, 2 * dpr);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(5,4,10,0.9)";
      for (const [bx, dir] of [[vw * 0.05, 1], [vw * 0.95, -1]]) {
        const sway = Math.sin(t * 0.8 + bx) * 0.04 + px.kickEnv * 0.015;
        const tx = bx + dir * vh * 0.12 + Math.sin(sway) * vh * 0.4, ty = vh * 0.32;
        ctx.beginPath();
        ctx.moveTo(bx - 9 * dpr, vh);
        ctx.quadraticCurveTo(bx + dir * vh * 0.05, vh * 0.6, tx, ty);
        ctx.lineTo(tx + 6 * dpr, ty + 4 * dpr);
        ctx.quadraticCurveTo(bx + dir * vh * 0.06 + 10 * dpr, vh * 0.62, bx + 9 * dpr, vh);
        ctx.fill();
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI / 2 + (k - 2.5) * 0.55 + sway * 3;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.quadraticCurveTo(tx + Math.cos(a) * vh * 0.09, ty + Math.sin(a) * vh * 0.09 - 10 * dpr, tx + Math.cos(a) * vh * 0.17, ty + Math.sin(a) * vh * 0.17 + vh * 0.05);
          ctx.lineTo(tx + Math.cos(a) * vh * 0.15, ty + Math.sin(a) * vh * 0.15 + vh * 0.055);
          ctx.quadraticCurveTo(tx + Math.cos(a) * vh * 0.08, ty + Math.sin(a) * vh * 0.08, tx, ty + 4 * dpr);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "lighter";
    } else if (v.decor === "rooftop") {
      // Dachterrasse: Skyline am Horizont mit funkelnden Fenstern, vorne ein Geländer, oben eine Lichterkette
      sky ||= Array.from({ length: 26 }, (_, i) => ({ x: i / 26, w: 0.025 + Math.random() * 0.03, h: 0.04 + Math.random() * 0.1 }));
      win ||= Array.from({ length: 90 }, () => ({ b: Math.floor(Math.random() * 26), fx: Math.random(), fy: Math.random(), ph: Math.random() * 6.3 }));
      const hz = vh * 0.8;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(6,5,14,0.6)";
      for (const b of sky) ctx.fillRect(b.x * vw, hz - b.h * vh, b.w * vw, b.h * vh + 2);
      ctx.globalCompositeOperation = "lighter";
      for (const w of win) {
        const b = sky[w.b], tw = 0.5 + 0.5 * Math.sin(t * 0.7 + w.ph);
        if (tw < 0.25) continue;
        const r = 3.2 * dpr;
        ctx.globalAlpha = clamp(tw * (0.35 + beat * 0.25), 0, 1);
        ctx.drawImage(glowSprite(w.ph > 4.6 ? pal[1] : [255, 214, 150]), (b.x + w.fx * b.w) * vw - r, hz - (0.1 + w.fy * 0.85) * b.h * vh - r, r * 2, r * 2);
      }
      for (let k = 0; k <= 18; k++) {
        const f = k / 18, y = vh * (0.06 + 0.05 * Math.sin(f * Math.PI));
        ctx.globalAlpha = clamp((0.28 + beat * 0.3) * (0.6 + 0.4 * Math.sin(t * 1.4 + k * 2.1)), 0, 1);
        const r = (8 + beat * 5) * dpr;
        ctx.drawImage(glowSprite(k % 2 ? [255, 200, 130] : pal[k % 3]), f * vw - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(5,4,10,0.75)";
      ctx.fillRect(0, vh * 0.84, vw, 3 * dpr);
      for (let x = 0; x < vw; x += 70 * dpr) ctx.fillRect(x, vh * 0.84, 2 * dpr, vh * 0.16);
      ctx.globalCompositeOperation = "lighter";
    } else if (v.decor === "cathedral") {
      // Kathedrale: spitze Bögen rahmen die Bühne, oben eine Rosette in den Songfarben, Kerzen an den Seiten
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(5,4,12,0.8)";
      for (const [x0, x1] of [[0, vw * 0.16], [vw * 0.84, vw]]) {
        const mid = (x0 + x1) / 2, iw = (x1 - x0) * 0.32;
        ctx.beginPath();
        ctx.rect(x0, 0, x1 - x0, vh);
        ctx.moveTo(mid + iw, vh);
        ctx.lineTo(mid + iw, vh * 0.36);
        ctx.quadraticCurveTo(mid + iw, vh * 0.2, mid, vh * 0.12);
        ctx.quadraticCurveTo(mid - iw, vh * 0.2, mid - iw, vh * 0.36);
        ctx.lineTo(mid - iw, vh);
        ctx.closePath();
        ctx.fill("evenodd");
      }
      // in den Bögen leuchten hohe Glasfenster in den Songfarben, auf dem Schlag etwas heller
      ctx.globalCompositeOperation = "lighter";
      for (const [x0, x1] of [[0, vw * 0.16], [vw * 0.84, vw]]) {
        const mid = (x0 + x1) / 2, iw = (x1 - x0) * 0.26, al = 0.14 + beat * 0.1 + px.energy * 0.08;
        const g = ctx.createLinearGradient(0, vh * 0.15, 0, vh * 0.7);
        g.addColorStop(0, rgba(pal[0], al.toFixed(3)));
        g.addColorStop(0.5, rgba(pal[1], (al * 0.9).toFixed(3)));
        g.addColorStop(1, rgba(pal[2], 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(mid + iw, vh * 0.7);
        ctx.lineTo(mid + iw, vh * 0.38);
        ctx.quadraticCurveTo(mid + iw, vh * 0.22, mid, vh * 0.15);
        ctx.quadraticCurveTo(mid - iw, vh * 0.22, mid - iw, vh * 0.38);
        ctx.lineTo(mid - iw, vh * 0.7);
        ctx.fill();
      }
      for (const side of [-1, 1]) for (let k = 0; k < 7; k++) {
        const x = vw / 2 + side * vw * (0.25 + k * 0.022), y = vh * (0.66 - (k % 3) * 0.018);
        const r = (7 + Math.sin(t * 9 + k * 3 + side) * 1.6) * dpr;
        ctx.globalAlpha = 0.55;
        ctx.drawImage(glowSprite([255, 190, 110]), x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    } else if (v.decor === "jazzbar") {
      // Jazz-Bar: drei Pendelleuchten werfen warmes Licht nach unten, links glimmt die Bar, viel Rauch
      for (let k = 0; k < 3; k++) {
        const x = vw * (0.22 + k * 0.28) + Math.sin(t * 0.6 + k) * vw * 0.01, y = vh * (0.16 + (k % 2) * 0.03);
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.moveTo(vw * (0.22 + k * 0.28), 0);
        ctx.lineTo(x, y);
        ctx.stroke();
        const g = ctx.createRadialGradient(x, y, 0, x, y, vh * 0.85);
        g.addColorStop(0, `rgba(255,190,120,${(0.16 + beat * 0.08).toFixed(3)})`);
        g.addColorStop(1, "rgba(255,190,120,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 8 * dpr, y);
        ctx.lineTo(x - vh * 0.22, vh);
        ctx.lineTo(x + vh * 0.22, vh);
        ctx.lineTo(x + 8 * dpr, y);
        ctx.fill();
        const r = (16 + beat * 8) * dpr;
        ctx.globalAlpha = 0.8;
        ctx.drawImage(glowSprite([255, 210, 150]), x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
      for (let k = 0; k < 9; k++) {
        const r = 4 * dpr;
        ctx.globalAlpha = clamp(0.25 + 0.2 * Math.sin(t * 1.2 + k), 0, 1);
        ctx.drawImage(glowSprite(k % 3 ? [255, 180, 90] : pal[0]), vw * (0.03 + k * 0.012) - r, vh * (0.6 - (k % 2) * 0.03) - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      for (let k = 0; k < 4; k++) {
        const x = vw * (0.5 + 0.45 * Math.sin(t * 0.05 + k * 1.7)), y = vh * (0.35 + 0.15 * Math.sin(t * 0.07 + k)), r = vh * 0.35;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(200,190,220,0.04)");
        g.addColorStop(1, "rgba(200,190,220,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    } else if (v.decor === "forest") {
      // Waldbühne: Baumsilhouetten links und rechts, Lichterketten dazwischen, Glühwürmchen auf den Hi-Hats
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(4,4,10,0.9)";
      for (const bx of [vw * 0.04, vw * 0.96, vw * 0.15, vw * 0.85]) {
        const tall = Math.abs(bx - vw / 2) > vw * 0.4, sway = Math.sin(t * 0.4 + bx) * 4 * dpr;
        const top = vh * (tall ? 0.08 : 0.3), wide = vw * (tall ? 0.085 : 0.05);
        ctx.fillRect(bx - (tall ? 7 : 5) * dpr, top, (tall ? 14 : 10) * dpr, vh);
        for (let k = 0; k < 5; k++) {
          const y0 = top + (vh - top) * 0.14 * k, w = wide * (0.45 + k * 0.16), sx = sway * (1 - k * 0.18);
          ctx.beginPath();
          ctx.moveTo(bx + sx, y0);
          ctx.lineTo(bx + w + sx * 0.5, y0 + (vh - top) * 0.22);
          ctx.lineTo(bx - w + sx * 0.5, y0 + (vh - top) * 0.22);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k <= 16; k++) {
        const f = k / 16, x = vw * (0.15 + 0.7 * f), y = vh * (0.3 + 0.08 * Math.sin(f * Math.PI));
        ctx.globalAlpha = clamp((0.25 + beat * 0.3) * (0.6 + 0.4 * Math.sin(t * 1.3 + k * 1.9)), 0, 1);
        const r = (7 + beat * 4) * dpr;
        ctx.drawImage(glowSprite(k % 3 ? [255, 205, 130] : pal[1]), x - r, y - r, r * 2, r * 2);
      }
      flies ||= Array.from({ length: 50 }, () => ({ x: Math.random(), y: 0.35 + Math.random() * 0.45, ph: Math.random() * 6.3, sp: 0.3 + Math.random() * 0.5 }));
      const hat = px.hatEnv || 0;
      for (const f of flies) {
        const x = (f.x + Math.sin(t * f.sp * 0.3 + f.ph) * 0.03) * vw, y = (f.y + Math.cos(t * f.sp * 0.4 + f.ph) * 0.03) * vh;
        ctx.globalAlpha = clamp((0.2 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.4 + f.ph))) * (0.6 + hat * 0.8), 0, 1);
        const r = 5 * dpr;
        ctx.drawImage(glowSprite([200, 255, 140]), x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    } else if (v.decor === "hall") {
      // Konzertsaal: Ränge mit warmen Lämpchen, zwei Kronleuchter oben – das Licht ist gedämpft und edel
      for (const side of [-1, 1]) for (let tier = 0; tier < 3; tier++) {
        const y = vh * (0.3 + tier * 0.15), w = vw * (0.14 - tier * 0.015), x0 = side < 0 ? 0 : vw - w;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(8,6,16,0.8)";
        ctx.fillRect(x0, y, w, vh * 0.05);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = clamp(0.32 + beat * 0.15, 0, 1);
        for (let k = 0; k < 6; k++) {
          const r = 5 * dpr;
          ctx.drawImage(glowSprite([255, 214, 160]), x0 + ((k + 0.5) / 6) * w - r, y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      }
      for (const x of [vw * 0.25, vw * 0.75]) {
        ctx.globalAlpha = clamp(0.5 + px.energy * 0.3, 0, 1);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2, r = (9 + Math.sin(t * 3 + k) * 1.5) * dpr;
          ctx.drawImage(glowSprite([255, 235, 200]), x + Math.cos(a) * 26 * dpr - r, vh * 0.12 + Math.sin(a) * 8 * dpr - r, r * 2, r * 2);
        }
        const r = (60 + beat * 30) * dpr;
        ctx.globalAlpha = clamp(0.25 + beat * 0.2, 0, 1);
        ctx.drawImage(glowSprite([255, 220, 170]), x - r, vh * 0.12 - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    } else if (v.decor === "cellar") {
      // Keller: niedriges Ziegelgewölbe, nackte Glühbirnen, die auf der Kick aufglühen, dichter Dunst
      const n = 4;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(6,4,10,0.85)";
      ctx.beginPath();
      ctx.rect(0, 0, vw, vh * 0.32);
      for (let k = 0; k < n; k++) {
        const x0 = (k / n) * vw, x1 = ((k + 1) / n) * vw;
        ctx.moveTo(x1, vh * 0.32);
        ctx.quadraticCurveTo((x0 + x1) / 2, vh * 0.02, x0, vh * 0.32);
        ctx.closePath();
      }
      ctx.fill("evenodd");
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = dpr;
      ctx.beginPath();
      for (let y = vh * 0.03; y < vh * 0.3; y += 14 * dpr) {
        ctx.moveTo(0, y);
        ctx.lineTo(vw, y);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < n; k++) {
        const x = ((k + 0.5) / n) * vw, y = vh * (0.2 + Math.sin(t * 1.1 + k) * 0.004);
        const r = (20 + px.kickEnv * 44) * dpr;
        ctx.globalAlpha = clamp(0.4 + px.kickEnv * 0.6, 0, 1);
        ctx.drawImage(glowSprite([255, 200, 140]), x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    } else if (v.decor === "fairy") {
      // Wohnzimmer: eine Lichterkette hängt oben durchs Bild und glimmt im Takt
      for (let k = 0; k <= 26; k++) {
        const f = k / 26, x = f * vw, y = vh * (0.05 + 0.07 * Math.sin(f * Math.PI));
        const tw = 0.55 + 0.45 * Math.sin(t * 1.6 + k * 1.7);
        ctx.globalAlpha = clamp((0.3 + beat * 0.35) * tw, 0, 1);
        const r = (9 + beat * 6) * dpr;
        ctx.drawImage(glowSprite(k % 3 ? [255, 200, 120] : pal[k % 3]), x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    } else if (v.decor === "space") {
      // Weltall: Sternenfeld, das langsam vorbeizieht, oben rechts ein Planet mit leuchtendem Rand,
      // auf großen Schlägen eine Sternschnuppe
      stars ||= Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random() * 0.8, z: 0.3 + Math.random() * 0.7, ph: Math.random() * 6.3 }));
      for (const s1 of stars) {
        const x = (((s1.x - t * 0.004 * s1.z) % 1) + 1) % 1, tw = 0.55 + 0.45 * Math.sin(t * (1 + s1.z) + s1.ph);
        ctx.globalAlpha = clamp(tw * s1.z * (0.45 + px.energy * 0.35 + beat * 0.2), 0, 1);
        const r = (1.6 + s1.z * 2.4) * dpr;
        ctx.drawImage(glowSprite(s1.ph > 5 ? pal[2] : [235, 240, 255]), x * vw - r, s1.y * vh - r, r * 2, r * 2);
      }
      const pr = Math.min(vw, vh) * 0.32, pxx = vw * 0.86, pyy = -pr * 0.35;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(6,6,16,0.92)";
      ctx.beginPath();
      ctx.arc(pxx, pyy, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      const rim = ctx.createRadialGradient(pxx, pyy, pr * 0.92, pxx, pyy, pr * 1.18);
      rim.addColorStop(0, rgba(pal[1], 0));
      rim.addColorStop(0.35, rgba(pal[1], (0.22 + beat * 0.18).toFixed(3)));
      rim.addColorStop(1, rgba(pal[1], 0));
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(pxx, pyy, pr * 1.18, 0, Math.PI * 2);
      ctx.fill();
      if (px.dropHit || (px.hit && px.inBar === 0 && px.energy > 0.7 && Math.random() < 0.35)) shoot = { t0: t, y: 0.08 + Math.random() * 0.3, x: 0.2 + Math.random() * 0.5 };
      if (shoot) {
        const f = (t - shoot.t0) / 0.9;
        if (f > 1) shoot = null;
        else {
          const x0 = (shoot.x + f * 0.35) * vw, y0 = (shoot.y + f * 0.18) * vh, len = 140 * dpr;
          const g = ctx.createLinearGradient(x0, y0, x0 - len, y0 - len * 0.5);
          g.addColorStop(0, `rgba(255,255,255,${(0.8 * (1 - f)).toFixed(3)})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = g;
          ctx.lineWidth = 2 * dpr;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x0 - len, y0 - len * 0.5);
          ctx.stroke();
        }
      }
    } else if (v.decor === "neon") {
      // Neon-Straße: Häuserzeilen links und rechts mit senkrechten Leuchtschildern, die im Takt flackern,
      // und ein nasser Boden, der die Farben spiegelt
      neonSigns ||= Array.from({ length: 10 }, (_, i) => ({ side: i % 2 ? 1 : -1, d: Math.floor(i / 2) / 5, h: 0.14 + Math.random() * 0.16, y: 0.18 + Math.random() * 0.3, c: i % 3, ph: Math.random() * 6.3 }));
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(5,4,12,0.88)";
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? 0 : vw * 0.8;
        ctx.fillRect(x0, vh * 0.12, vw * 0.2, vh);
      }
      ctx.globalCompositeOperation = "lighter";
      for (const n of neonSigns) {
        const x = n.side < 0 ? vw * (0.03 + n.d * 0.15) : vw * (0.97 - n.d * 0.15), y = vh * n.y, h = vh * n.h;
        const flick = Math.sin(t * 13 + n.ph) > 0.97 ? 0.3 : 1;
        const a = clamp((0.35 + beat * 0.5) * flick, 0, 1), c = pal[n.c];
        ctx.fillStyle = rgba(c, (a * 0.9).toFixed(3));
        ctx.fillRect(x - 4 * dpr, y, 8 * dpr, h);
        const r = 26 * dpr;
        ctx.globalAlpha = a * 0.55;
        for (let k = 0; k < 3; k++) ctx.drawImage(glowSprite(c), x - r, y + (h * k) / 2 - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
      const wet = ctx.createLinearGradient(0, vh * 0.86, 0, vh);
      wet.addColorStop(0, rgba(pal[0], 0));
      wet.addColorStop(1, rgba(pal[0], (0.08 + beat * 0.12).toFixed(3)));
      ctx.fillStyle = wet;
      ctx.fillRect(0, vh * 0.86, vw, vh * 0.14);
    } else if (v.decor === "pub") {
      // Pub: dunkle Holzbalken unter der Decke, warme Glühbirnen, die leicht pendeln, hinten der Tresen
      // mit glänzenden Flaschen
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(10,6,4,0.9)";
      for (let k = 0; k < 4; k++) ctx.fillRect(0, vh * (0.02 + k * 0.045), vw, 7 * dpr);
      ctx.fillRect(vw * 0.04, vh * 0.8, vw * 0.92, vh * 0.035);
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 7; k++) {
        const x = vw * (0.1 + k * 0.133), sw = Math.sin(t * 1.1 + k) * 6 * dpr, y = vh * 0.22;
        ctx.strokeStyle = "rgba(60,40,25,0.5)";
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(x, vh * 0.04);
        ctx.lineTo(x + sw, y);
        ctx.stroke();
        ctx.globalAlpha = clamp(0.45 + beat * 0.35, 0, 1);
        const r = (22 + beat * 10) * dpr;
        ctx.drawImage(glowSprite([255, 180, 95]), x + sw - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
      for (let k = 0; k < 24; k++) {
        const tw = 0.5 + 0.5 * Math.sin(t * 0.9 + k * 2.3);
        if (tw < 0.4) continue;
        ctx.globalAlpha = clamp(tw * (0.25 + beat * 0.2), 0, 1);
        const r = 4 * dpr;
        ctx.drawImage(glowSprite(k % 4 ? [255, 210, 140] : pal[k % 3]), vw * (0.08 + k * 0.036) - r, vh * 0.79 - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    } else if (v.decor === "skihut") {
      // Skihütte: verschneite Gipfel im Hintergrund, eine Lichterkette am Dachgiebel, leise fallender Schnee
      ctx.globalCompositeOperation = "source-over";
      // Berge nur am Rand und unten (das Cover und der Titel bleiben frei), Schnee als heller Saum am Grat
      const peaks = [[0, 0.62], [0.1, 0.5], [0.22, 0.66], [0.34, 0.74], [0.5, 0.78], [0.66, 0.73], [0.78, 0.64], [0.9, 0.48], [1, 0.6]];
      const ridge = new Path2D();
      ridge.moveTo(0, vh);
      for (const [x, y] of peaks) ridge.lineTo(vw * x, vh * y);
      ridge.lineTo(vw, vh);
      ridge.closePath();
      ctx.fillStyle = "rgba(14,16,30,0.8)";
      ctx.fill(ridge);
      ctx.save();
      ctx.clip(ridge);
      const snowG = ctx.createLinearGradient(0, vh * 0.48, 0, vh * 0.7);
      snowG.addColorStop(0, "rgba(225,232,255,0.22)");
      snowG.addColorStop(1, "rgba(225,232,255,0)");
      ctx.fillStyle = snowG;
      ctx.fillRect(0, vh * 0.45, vw, vh * 0.3);
      ctx.restore();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k <= 20; k++) {
        const f = k / 20, x = vw * f, y = vh * (0.04 + 0.1 * (1 - Math.abs(f - 0.5) * 2));
        ctx.globalAlpha = clamp((0.3 + beat * 0.35) * (0.6 + 0.4 * Math.sin(t * 1.5 + k * 1.3)), 0, 1);
        const r = (9 + beat * 5) * dpr;
        ctx.drawImage(glowSprite(k % 2 ? [255, 205, 130] : pal[k % 3]), x - r, y - r, r * 2, r * 2);
      }
      snow ||= Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), sp: 0.02 + Math.random() * 0.04, ph: Math.random() * 6.3 }));
      for (const f of snow) {
        const y = (f.y + t * f.sp) % 1, x = f.x + Math.sin(t * 0.6 + f.ph) * 0.01;
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(f.ph + t);
        const r = 3 * dpr;
        ctx.drawImage(glowSprite([235, 240, 255]), x * vw - r, y * vh - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    } else if (v.decor === "desert") {
      // Wüste: Dünen am Horizont, ein großer Mond, Sterne, und ein warmes Feuerglühen hinter der Menge
      stars ||= Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random() * 0.8, z: 0.3 + Math.random() * 0.7, ph: Math.random() * 6.3 }));
      for (const s1 of stars) {
        if (s1.y > 0.5) continue;
        ctx.globalAlpha = clamp((0.25 + 0.3 * Math.sin(t * 1.3 + s1.ph)) * s1.z, 0, 1);
        const r = (1.4 + s1.z * 2) * dpr;
        ctx.drawImage(glowSprite([255, 240, 220]), s1.x * vw - r, s1.y * vh - r, r * 2, r * 2);
      }
      const mr = Math.min(vw, vh) * 0.09;
      ctx.globalAlpha = clamp(0.55 + beat * 0.25, 0, 1);
      ctx.drawImage(glowSprite([255, 225, 180]), vw * 0.2 - mr * 2.4, vh * 0.2 - mr * 2.4, mr * 4.8, mr * 4.8);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(14,8,6,0.85)";
      for (const [y0, amp, ph] of [[0.76, 0.04, 0], [0.83, 0.03, 2]]) {
        ctx.beginPath();
        ctx.moveTo(0, vh);
        for (let x = 0; x <= 24; x++) ctx.lineTo((vw * x) / 24, vh * (y0 + amp * Math.sin(x * 0.55 + ph)));
        ctx.lineTo(vw, vh);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = "lighter";
      const fire = ctx.createRadialGradient(vw / 2, vh, 0, vw / 2, vh, vh * 0.45);
      fire.addColorStop(0, `rgba(255,140,60,${(0.12 + px.kickEnv * 0.1 + px.drop * 0.08).toFixed(3)})`);
      fire.addColorStop(1, "rgba(255,140,60,0)");
      ctx.fillStyle = fire;
      ctx.fillRect(0, vh * 0.55, vw, vh * 0.45);
    }
    ctx.globalCompositeOperation = "lighter";
  }
  let stands = null, sky = null, win = null, flies = null, stars = null, neonSigns = null, snow = null, shoot = null;

  /* ---------------------------------------------------------------- Bühneneffekte */
  // Nur wo sie hingehören: CO2-Fontänen bei elektronischer Musik, Pyro-Flammen bei Rock/Metal/Punk/Hardstyle,
  // Feuerwerk im letzten Refrain im Stadion und auf dem Festival, Stroboskop bei harten Drops (höchstens einmal
  // pro Schlag und nur durch die Blitz-Schranke – also auch bei 200 BPM nie mehr als 3 Blitze/s). Ausgelöst vom Drop und, in der Spitze, vom Taktanfang.
  const CO2 = new Set(["rave", "techno", "house", "trance", "dnb", "bass", "hardstyle", "kpop", "pop", "disco", "edm", "dubstep", "psytrance", "techhouse", "eurodance", "hyperpop", "trap", "reggaeton", "schlager"]);
  const PYRO = new Set(["rock", "metal", "punk", "hardstyle", "alternative", "phonk"]);
  const STROBE = new Set(["techno", "hardstyle", "rave", "dnb", "bass", "dubstep", "psytrance", "techhouse", "edm", "phonk", "hyperpop"]);
  const fx = { jets: [], flames: [], rockets: [], sparks: [], confetti: [], streamers: [], strobe: 0, beat: -1, bar: 0, barId: -1, confAt: -99 };
  const GOLD = [255, 214, 120], WHITE = [255, 255, 255];
  // Konfetti-Kanonen: zwei Fontänen von den Bühnenecken, die Schnipsel taumeln langsam herab; dazu Luftschlangen von oben
  function confetti(pal, big, few) {
    // Songfarben kräftig gesättigt und aufgehellt, dazu Gold und Weiß – sonst verschwimmen sie mit dem Licht
    const pop = (c) => { const m = Math.max(...c, 1); return c.map((v) => Math.round(clamp(((v - m * 0.45) / (m * 0.55)) * 255, 0, 255))); };
    const n = Math.round((big ? 220 : 140) * (few ? 0.5 : 1)), cols = [pop(pal[0]), pop(pal[1]), pop(pal[2]), GOLD, WHITE];
    for (let k = 0; k < n && fx.confetti.length < 420; k++) {
      const side = k % 2 ? 1 : -1;
      fx.confetti.push({
        x: vw * (side < 0 ? 0.12 : 0.88), y: vh * 0.98, vx: -side * vh * (0.12 + Math.random() * 0.45), vy: -vh * (1.25 + Math.random() * 0.6),
        r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 14, w: (9 + Math.random() * 8) * (vh / 720), h: (5 + Math.random() * 4) * (vh / 720), ph: Math.random() * 6.3, c: cols[k % cols.length], a: 1,
      });
    }
    for (let k = 0; k < (few ? 6 : 12); k++) fx.streamers.push({ x: Math.random() * vw, y: -vh * Math.random() * 0.4, vy: vh * (0.12 + Math.random() * 0.08), len: vh * (0.16 + Math.random() * 0.14), ph: Math.random() * 6.3, c: cols[k % cols.length], a: 1 });
  }
  function drawFx(ctx, st, v, px, pal, dpr) {
    const dt = st.dt, key = px.key;
    const big = v.decor === "towers" || v.decor === "stands";
    const newBeat = px.beatIdx >= 0 && px.beatIdx !== fx.beat;
    if (newBeat) fx.beat = px.beatIdx;
    // neuer Takt = der erste Schlag des Takts hat sich geändert – nicht „Schlag 1 gesehen“: bei einem
    // ruckelnden Bild kann genau der übersprungen werden, dann gingen Konfetti, Feuerwerk und Fontänen nie los
    const barId = px.beatIdx - (px.inBar || 0), barStart = newBeat && barId !== fx.barId;
    if (newBeat) fx.barId = barId;
    if (barStart) fx.bar++;
    // Konfetti im letzten Refrain: auf dem ersten Taktanfang des Finales und auf seinem Drop (höchstens alle 6 s)
    if (st.fx && !px.blackout && !v.calm && px.finale && (px.dropHit || (barStart && fx.confAt < 0)) && st.t - fx.confAt > 6) {
      fx.confAt = st.t;
      confetti(pal, big, st.quality < 1 || v.decor === "fairy");
    }
    if (!px.finale && st.t - fx.confAt > 30) fx.confAt = -99;
    // Konfetti-Kanone auf Knopfdruck (Taste C / Knopf oben) – überall außer im Wohnzimmer
    if (st.confetti && st.confetti !== fx.confManual) {
      fx.confManual = st.confetti;
      if (v.decor !== "fairy") confetti(pal, big, st.quality < 1);
    }
    if (st.fx && !px.blackout && v.decor !== "fairy" && !v.calm) {
      // Drop: immer. Danach und in der Spitze eines Refrains: auf jedem zweiten Taktanfang, nicht jedes Mal
      // (die Regie erlaubt Bühneneffekte nur im Refrain und Drop – in Strophe und Break bleibt es beim Drop selbst)
      const peak = (px.fxMul ?? 1) >= 0.75 && (px.drop > 0.3 || (px.energy > 0.85 && px.build < 0.15) || px.finale);
      const fire = px.dropHit || (barStart && peak && fx.bar % 2 === 0 && Math.random() < 0.7);
      if (fire && CO2.has(key)) {
        const n = big ? 6 : 4;
        for (let k = 0; k < n; k++) fx.jets.push({ x: vw * (0.12 + (0.76 * k) / (n - 1)), t: 0, h: vh * (0.5 + Math.random() * 0.15) });
      }
      if (fire && PYRO.has(key)) for (const f of big ? [0.1, 0.3, 0.7, 0.9] : [0.2, 0.8]) fx.flames.push({ x: vw * f, t: 0 });
      // Feuerwerk: im letzten Refrain auf fast jedem Taktanfang ein bis zwei Raketen
      if (px.finale && (big || v.open) && barStart && fx.rockets.length < 4 && Math.random() < 0.85) {
        for (let k = Math.random() < 0.4 ? 2 : 1; k > 0; k--) fx.rockets.push({ x: vw * (0.15 + Math.random() * 0.7), y: vh, vy: -vh * (1.1 + Math.random() * 0.3), c: pal[Math.floor(Math.random() * 3)] });
      }
      if (st.strobe && st.flashGo && STROBE.has(key) && px.drop > 0.5 && newBeat && flashCap.take(st.t)) fx.strobe = 1;
    }
    ctx.globalCompositeOperation = "lighter";
    // CO2: weiße Säule schießt in 0,25 s hoch und verweht dann über eine Sekunde
    fx.jets = fx.jets.filter((j) => (j.t += dt) < 1.4);
    for (const j of fx.jets) {
      const up = Math.min(1, j.t / 0.25), fade = j.t < 0.25 ? 1 : Math.max(0, 1 - (j.t - 0.25) / 1.15);
      const top = vh - j.h * up, w = (18 + j.t * 70) * dpr;
      const g = ctx.createLinearGradient(0, top, 0, vh);
      g.addColorStop(0, "rgba(220,230,255,0)");
      g.addColorStop(0.25, `rgba(220,230,255,${(0.32 * fade).toFixed(3)})`);
      g.addColorStop(1, `rgba(220,230,255,${(0.5 * fade).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(j.x - 8 * dpr, vh);
      ctx.quadraticCurveTo(j.x - w * 0.4, (top + vh) / 2, j.x - w, top);
      ctx.lineTo(j.x + w, top);
      ctx.quadraticCurveTo(j.x + w * 0.4, (top + vh) / 2, j.x + 8 * dpr, vh);
      ctx.fill();
    }
    // Pyro: flackernde Flammensäule aus warmen Leuchtpunkten, dazu Hitzeschein am Boden
    fx.flames = fx.flames.filter((f) => (f.t += dt) < 0.9);
    for (const f of fx.flames) {
      const life = 1 - f.t / 0.9, h = vh * 0.5 * Math.min(1, f.t / 0.12) * (0.7 + 0.3 * life);
      for (let k = 0; k < 9; k++) {
        const y = vh - (h * k) / 8, r = (58 - k * 4.5) * dpr * (0.8 + Math.random() * 0.4);
        ctx.globalAlpha = clamp(life * (0.9 - k * 0.07), 0, 1);
        ctx.drawImage(glowSprite(k < 3 ? [255, 210, 120] : k < 6 ? [255, 130, 40] : [220, 60, 20]), f.x - r + (Math.random() - 0.5) * 10 * dpr, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = life * 0.5;
      const r = vh * 0.3;
      ctx.drawImage(glowSprite([255, 120, 40]), f.x - r, vh - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    // Feuerwerk: Rakete steigt, platzt in Funken der Songfarben, die sinken und verglühen
    fx.rockets = fx.rockets.filter((r) => {
      r.vy += vh * 1.1 * dt;
      r.y += r.vy * dt;
      ctx.drawImage(glowSprite([255, 240, 210]), r.x - 4 * dpr, r.y - 4 * dpr, 8 * dpr, 8 * dpr);
      if (r.vy < -vh * 0.12) return true;
      for (let k = 0; k < 56; k++) {
        const a = (k / 56) * Math.PI * 2, sp = vh * (0.2 + Math.random() * 0.14);
        fx.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: 1, c: r.c });
      }
      return false;
    });
    fx.sparks = fx.sparks.filter((s) => (s.a -= dt * 0.5) > 0);
    for (const s of fx.sparks) {
      s.vy += vh * 0.25 * dt;
      s.vx *= 1 - dt * 0.8;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const r = 9 * dpr;
      ctx.globalAlpha = s.a;
      ctx.drawImage(glowSprite(s.c), s.x - r, s.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    // Konfetti: schießt hoch, bremst, taumelt dann flatternd herab (die Breite pulsiert – es dreht sich im Licht)
    fx.confetti = fx.confetti.filter((c) => c.y < vh * 1.05 && (c.a -= dt * 0.07) > 0);
    fx.streamers = fx.streamers.filter((m) => m.y - m.len < vh && (m.a -= dt * 0.08) > 0);
    if (fx.confetti.length || fx.streamers.length) {
      ctx.globalCompositeOperation = "source-over";
      for (const c of fx.confetti) {
        c.vy = c.vy < vh * 0.1 ? c.vy + vh * 1.4 * dt : vh * 0.1;
        c.vx *= 1 - dt * 1.6;
        c.ph += dt * 5;
        c.r += c.vr * dt;
        c.x += (c.vx + Math.sin(c.ph) * vh * 0.05) * dt;
        c.y += c.vy * dt;
        const flip = Math.abs(Math.cos(c.ph * 1.3)), w = c.w * (0.3 + 0.7 * flip), h = c.h;
        ctx.globalAlpha = clamp(c.a, 0, 1) * (0.55 + 0.45 * flip);
        ctx.fillStyle = `rgb(${c.c[0]},${c.c[1]},${c.c[2]})`;
        const co = Math.cos(c.r), si = Math.sin(c.r);
        ctx.setTransform(co, si, -si, co, c.x, c.y);
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Luftschlangen: geschwungene Bänder, die langsam von oben herabsinken
      ctx.lineWidth = 4 * (vh / 720);
      ctx.lineCap = "round";
      for (const m of fx.streamers) {
        m.y += m.vy * dt;
        m.ph += dt * 2;
        ctx.globalAlpha = clamp(m.a, 0, 1) * 0.85;
        ctx.strokeStyle = `rgb(${m.c[0]},${m.c[1]},${m.c[2]})`;
        ctx.beginPath();
        for (let k = 0; k <= 10; k++) {
          const f = k / 10, x = m.x + Math.sin(m.ph + f * 7) * 14 * dpr, y = m.y - f * m.len;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "lighter";
    }
    // Stroboskop: kurzer weißer Blitz, der in ~0,1 s verlischt
    if (fx.strobe > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${(fx.strobe * 0.3).toFixed(3)})`;
      ctx.fillRect(0, 0, vw, vh);
      fx.strobe *= Math.exp(-dt * 28);
    }
  }

  /* ---------------------------------------------------------------- Publikum */
  // Jede Bewegung ist an die Schlagphase gekoppelt (0 = genau auf dem Schlag): Sprünge LANDEN auf dem Schlag,
  // Nicken geht auf dem Schlag runter, Klatschen sitzt auf 2 und 4 – so kann nichts zu früh oder zu spät sein.
  // WAS sie tun, wählt eine träge Stimmung aus dem Song (Energiekurve, Aufbau, Drop, Break) und das Genre:
  // Rave/Techno springen und pumpen, Rock/Metal bangen, Pop klatscht, Latin/Afro wippen, Reggae skankt,
  // Hip-Hop nickt, ruhige Musik wiegt mit Handylicht und Feuerzeug.
  const MOVES = {
    rave: "jump", trance: "wave", hardstyle: "jump", dnb: "jump", techno: "pump", house: "bounce",
    rock: "bang", metal: "bang", punk: "jump", bass: "nod", pop: "clap", kpop: "clap", disco: "clap", country: "clap",
    latin: "bounce", afro: "bounce", reggae: "skank", chill: "sway", jazz: "sway", classical: "sway",
    edm: "jump", deephouse: "bounce", techhouse: "pump", psytrance: "jump", dubstep: "bang", garage: "bounce", eurodance: "jump",
    melodictechno: "pump", hardtechno: "pump", futurebass: "jump", electroswing: "bounce", breakbeat: "bounce", boombap: "nod",
    dancehall: "bounce", cloudrap: "sway", hardrock: "bang", postrock: "sway", ska: "skank", emo: "jump", jpop: "clap", musical: "clap",
    christmas: "sway", celtic: "clap", balkan: "jump", amapiano: "bounce", lofi: "sway", neoclassical: "sway", acoustic: "sway",
    synthwave: "nod", hyperpop: "jump", trap: "bounce", drill: "nod", phonk: "pump", rnb: "sway", soul: "clap", indie: "bounce",
    alternative: "bang", blues: "sway", schlager: "clap", ballad: "sway", gospel: "clap", reggaeton: "bounce", salsa: "bounce",
    brazil: "bounce", flamenco: "clap", bollywood: "bounce", arabic: "clap", ambient: "sway", cinematic: "sway",
  };
  const mood = { x: 0 };
  // Lichtermeer: bei Balladen und ruhigen, getragenen Songs halten im Refrain viele Handys und Feuerzeuge hoch
  // und schwenken sie gemeinsam langsam hin und her (über zwei Takte)
  const SEA = new Set(["ballad", "gospel", "soul", "rnb", "blues", "country", "cinematic", "chill", "classical", "acoustic", "christmas", "postrock", "musical"]);
  const sea = { a: 0 };
  function seaLevel(px, dt, st) {
    const on = SEA.has(px.key) && (st.bpm || 120) < 120 && px.energy > 0.32 && !px.blackout ? clamp((px.energy - 0.32) * 2.2, 0, 1) : 0;
    sea.a += (on - sea.a) * (1 - Math.exp(-dt * (on > sea.a ? 0.8 : 0.5)));
    return sea.a;
  }
  function crowdMood(px, dt, hype) {
    const target = clamp(Math.pow(px.energy, 1.3) * 0.85 + px.drop * 0.5 + px.build * 0.2 - px.low * 0.7 + (hype && px.energy > 0.45 ? 0.12 : 0), 0, 1);
    mood.x += (target - mood.x) * (1 - Math.exp(-dt * (target > mood.x ? 3 : 0.8)));
    if (px.dropHit) mood.x = Math.max(mood.x, 0.9);
    return mood.x;
  }
  // immer gleiche Zufallszahl je Person und Takt: wer in diesem Takt springt, steht fest (kein Flackern)
  const hash = (a, b) => {
    const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  let crowd = null, crowdA = 0;
  const rowA = [1, 1, 1];
  function makeCrowd(u, v) {
    const people = [];
    let id = 0;
    for (const [row, scale, gap] of v.rows) {
      for (let x = -vw * 0.15; x < vw * 1.15; x += gap * u * (0.8 + Math.random() * 0.45)) {
        const r = Math.random;
        people.push({
          id: id++, x, row, s: scale * (0.88 + r() * 0.26), ph: r() * 6.3, up: r(), hand: r() < 0.5 ? -1 : 1,
          hair: HAIR[Math.floor(r() * HAIR.length)],
          // Statur in drei Stufen (wenige Stufen = wenige vorgezeichnete Körperbilder)
          wd: [0.86, 1, 1.15][Math.floor(r() * 3)],
          gadget: r() < 0.16 ? "phone" : r() < 0.26 ? "lighter" : "", arm: 0,
        });
      }
    }
    return { w: vw, venue: v, people, lift: -1, liftUntil: 0, wave: -1, nextWave: 0, flashes: [], lastPh: -1, phOff: 0 };
  }
  // Frisuren und Kopfbedeckungen: viele verschiedene Silhouetten statt einer Reihe gleicher Köpfe
  const HAIR = ["", "", "bun", "cap", "curl", "long", "long", "afro", "pony", "beanie", "hat", "short"];
  const bodySprites = new Map();
  function bodySprite(p, u, pal) {
    const key = `${p.row}|${p.hair}|${p.hand}|${p.wd || 1}|${pal[1].join()}|${pal[2].join()}|${u.toFixed(2)}`;
    let sp = bodySprites.get(key);
    if (sp) return sp;
    // Ein Stadion braucht bis zu 3 Reihen × 10 Frisuren × 2 Hände × 3 Staturen = 180 Bilder je Palette. Eine
    // kleinere Grenze mit clear() malte sie dort in jedem Bild neu (Thread 80 ms statt wenige ms pro Bild).
    // Darum: nur die ältesten verwerfen (zuerst die der vorigen Palette), Platz für einen ganzen Satz.
    if (bodySprites.size >= 200) bodySprites.delete(bodySprites.keys().next().value);
    const S1 = 1.3 * u, w = Math.ceil(60 * S1), h = Math.ceil(100 * S1);
    const c = makeCanvas(w, h);
    c.width = w;
    c.height = h;
    const x = c.getContext("2d"), cx0 = w / 2, y = 82 * S1, hx = cx0;
    x.fillStyle = FILL[p.row];
    x.beginPath();
    // nur der Körper – den Kopf zeichnet drawCrowd extra, damit er nicken kann
    const W = p.wd || 1;
    x.moveTo(cx0 - 20 * S1 * W, y + 18 * S1);
    x.quadraticCurveTo(cx0 - 22 * S1 * W, y - 46 * S1, hx - 5 * S1, y - 50 * S1);
    x.lineTo(hx + 5 * S1, y - 50 * S1);
    x.quadraticCurveTo(cx0 + 22 * S1 * W, y - 46 * S1, cx0 + 20 * S1 * W, y + 18 * S1);
    x.closePath();
    x.fill();
    const c2 = pal[p.row === 0 ? 2 : 1];
    x.lineWidth = Math.max(1, 1.6 * S1);
    x.lineCap = "round";
    x.strokeStyle = `rgba(${c2.join(",")},${0.5 - p.row * 0.12})`;
    x.beginPath();
    x.moveTo(cx0 - 19 * S1, y - 30 * S1);
    x.quadraticCurveTo(cx0 - 21 * S1, y - 46 * S1, hx - 5 * S1, y - 50 * S1);
    x.stroke();
    // Kopf mit Frisur als eigenes kleines Bild
    const hc = makeCanvas(Math.ceil(34 * S1), Math.ceil(40 * S1));
    hc.width = Math.ceil(34 * S1);
    hc.height = Math.ceil(40 * S1);
    const hxx = hc.getContext("2d"), ox = hc.width / 2, oy = 24 * S1;
    hxx.fillStyle = FILL[p.row];
    hxx.beginPath();
    hxx.ellipse(ox, oy, 9.5 * S1, 11 * S1, 0, 0, Math.PI * 2);
    if (p.hair === "curl") hxx.arc(ox, oy - 3 * S1, 12 * S1, 0, Math.PI * 2);
    if (p.hair === "bun") hxx.arc(ox + 2 * S1, oy - 13 * S1, 5 * S1, 0, Math.PI * 2);
    if (p.hair === "afro") hxx.arc(ox, oy - 4 * S1, 14 * S1, 0, Math.PI * 2);
    if (p.hair === "pony") hxx.ellipse(ox - p.hand * 10 * S1, oy - 2 * S1, 4 * S1, 8 * S1, p.hand * 0.5, 0, Math.PI * 2);
    if (p.hair === "beanie") hxx.ellipse(ox, oy - 8 * S1, 10.5 * S1, 8 * S1, 0, Math.PI, Math.PI * 2);
    if (p.hair === "short") hxx.ellipse(ox, oy - 3 * S1, 10.2 * S1, 10 * S1, 0, Math.PI, Math.PI * 2);
    hxx.fill();
    if (p.hair === "cap") hxx.fillRect(ox - 2 * S1 + (p.hand < 0 ? -13 * S1 : 0), oy - 9 * S1, 15 * S1, 3 * S1);
    if (p.hair === "long") {
      hxx.fillRect(ox - 11 * S1, oy - 4 * S1, 4 * S1, 18 * S1);
      hxx.fillRect(ox + 7 * S1, oy - 4 * S1, 4 * S1, 18 * S1);
    }
    if (p.hair === "hat") {
      hxx.fillRect(ox - 15 * S1, oy - 10 * S1, 30 * S1, 3 * S1);
      hxx.fillRect(ox - 8 * S1, oy - 19 * S1, 16 * S1, 10 * S1);
    }
    hxx.lineWidth = Math.max(1, 1.6 * S1);
    hxx.strokeStyle = `rgba(${c2.join(",")},${0.55 - p.row * 0.12})`;
    hxx.beginPath();
    hxx.ellipse(ox, oy, 9.5 * S1, 11 * S1, 0, Math.PI * 1.1, Math.PI * 1.9);
    hxx.stroke();
    sp = { c, w, h, ax: cx0, ay: y, head: hc, hox: ox, hoy: oy, S1 };
    bodySprites.set(key, sp);
    return sp;
  }
  const FILL = ["rgba(4,3,10,0.96)", "rgba(12,9,24,0.86)", "rgba(24,18,44,0.7)"];
  function drawCrowd(ctx, px, pal, dpr, rgba, dt, st, v, A) {
    const u = Math.max(0.75, vh / (950 * dpr)) * dpr;
    // neue Fenster- oder Bildgröße (z. B. die Leistungsstufe wechselt): dieselben Leute, nur mitskaliert –
    // neu würfeln ließe das ganze Publikum mitten im Song springen. Neu nur bei einer anderen Location.
    if (crowd && crowd.venue === v && crowd.w !== vw) {
      const f = vw / crowd.w;
      for (const p of crowd.people) p.x *= f;
      crowd.w = vw;
    }
    if (!crowd || crowd.venue !== v) crowd = makeCrowd(u, v);
    if (!crowd.people.length) return;
    const X = crowdMood(px, dt, st.hype), t = st.t;
    const style = v.seated ? "sway" : MOVES[px.key] || "clap";
    const SEAa = seaLevel(px, dt, st);
    // Schlagphase (0 = Schlag): schnelle Songs bewegen sich im halben Tempo
    const half = st.bpm > 150;
    const beatN = px.beatIdx >= 0 ? px.beatIdx : Math.floor(t * (st.bpm / 60));
    // Takt-Sprung (Songwechsel, neue Analyse): den Versatz aufnehmen und über ~1 s abbauen – sonst zucken alle
    // Tänzer gleichzeitig in eine neue Haltung
    const raw = clamp(px.phase ?? 0, 0, 1);
    if (crowd.lastPh >= 0) {
      let d = raw - ((crowd.lastPh + (dt || 0) * (st.bpm / 60)) % 1);
      d -= Math.round(d);
      if (Math.abs(d) > 0.12) crowd.phOff += d;
    }
    crowd.lastPh = raw;
    crowd.phOff *= Math.exp(-(dt || 0.016) * 3);
    if (Math.abs(crowd.phOff) < 0.005) crowd.phOff = 0;
    const phi = (((raw - crowd.phOff) % 1) + 1) % 1;
    const cyc = half ? ((beatN & 1) + phi) / 2 : phi; // 0..1 über einen (bzw. zwei) Schläge
    const bar = Math.floor(beatN / 4), inBar = px.inBar ?? beatN & 3;
    const down = Math.exp(-phi * 6); // kurz nach dem Schlag 1, dann abklingend
    // La-Ola: in der Spitze etwa alle 20 s eine Welle über zwei Takte
    if (X > 0.65 && t > crowd.nextWave && crowd.wave < 0) [crowd.wave, crowd.nextWave] = [t, t + 20 + Math.random() * 10];
    const waveX = crowd.wave >= 0 ? ((t - crowd.wave) / ((8 * 60) / st.bpm)) * vw * 1.3 - vw * 0.15 : -1e9;
    if (crowd.wave >= 0 && waveX > vw * 1.2) crowd.wave = -1;
    // Dunst über der Menge
    const hz = 260 * u, haze = ctx.createLinearGradient(0, vh, 0, vh - hz);
    haze.addColorStop(0, rgba(pal[1], ((0.1 + 0.18 * X) * v.haze).toFixed(3)));
    haze.addColorStop(1, rgba(pal[1], 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, vh - hz, vw, hz);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = A;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const glows = [], arms = [new Path2D(), new Path2D(), new Path2D()];
    let curRow = null;
    // Gegenlicht: ein Streifen leuchtender Dunst hinter den Köpfen, der mit Kick und Drop aufglüht
    {
      const top = vh * 0.72, glow = (0.07 + px.kickEnv * 0.12 * (0.4 + px.energy) + px.drop * 0.1) * A;
      const g = ctx.createLinearGradient(0, top, 0, vh);
      g.addColorStop(0, rgba(pal[0], 0));
      g.addColorStop(0.55, rgba(pal[0], glow.toFixed(3)));
      g.addColorStop(1, rgba(pal[1], (glow * 0.6).toFixed(3)));
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.fillRect(0, top, vw, vh - top);
      ctx.globalCompositeOperation = "source-over";
    }
    // Qualitätsstufe: hintere Reihen blenden weich aus und ein, statt schlagartig zu verschwinden
    for (let r = 0; r < 3; r++) rowA[r] += ((r <= st.quality ? 1 : 0) - rowA[r]) * (1 - Math.exp(-dt * 2));
    const strokeRow = (row) => {
      ctx.globalAlpha = A * rowA[row];
      ctx.lineWidth = 6.5 * u * [1.04, 0.8, 0.62][row];
      ctx.strokeStyle = FILL[row];
      ctx.stroke(arms[row]);
      arms[row] = new Path2D();
    };
    // Handylichter, Feuerzeuge und Kamerablitze einer Reihe gleich nach ihr zeichnen – die Reihen davor
    // verdecken sie dann (vorher lagen alle Lichter über allen Köpfen und schienen durch die Leute vorne)
    const flushLights = (row) => {
      ctx.globalCompositeOperation = "lighter";
      for (const [gx, gy, kind, s1, r0] of glows) {
        const r = (kind === "phone" ? 16 : 13 + Math.sin(t * 13 + gx) * 2) * s1;
        ctx.globalAlpha = (kind === "phone" ? 0.85 : 0.6) * (1 - r0 * 0.25) * A * rowA[r0];
        ctx.drawImage(glowSprite(kind === "phone" ? [170, 200, 255] : [255, 170, 70]), gx - r, gy - r, r * 2, r * 2);
      }
      glows.length = 0;
      for (const f of crowd.flashes) {
        if ((f.row ?? 0) !== row) continue;
        const r = 34 * f.s;
        ctx.globalAlpha = f.a * A;
        ctx.drawImage(glowSprite([255, 255, 255]), f.x - r, f.y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    };
    for (const p of crowd.people) {
      if (p.row !== curRow) {
        if (curRow != null) {
          strokeRow(curRow);
          flushLights(curRow);
        }
        curRow = p.row;
      }
      const ra = rowA[p.row];
      if (ra < 0.02) continue;
      ctx.globalAlpha = A * ra;
      const s1 = p.s * u, me = clamp(X + (p.up - 0.5) * 0.3, 0, 1);
      // La-Ola: weicher Buckel, der durch die Reihe läuft (statt an/aus mitten im Sprung)
      const wave = waveX > -1e8 ? Math.exp(-(((p.x - waveX) / (75 * u)) ** 2)) : 0;
      const inWave = wave > 0.35;
      // --- Körper: springen / wippen / skanken – alles phasenstarr. Ob jemand springt, steht zu Beginn jedes
      // Sprungs fest – ändert sich die Stimmung mitten in der Luft, wird der Sprung trotzdem zu Ende gesprungen
      const cycN = half ? beatN >> 1 : beatN;
      if (p.cyc !== cycN) {
        p.cyc = cycN;
        p.jmp = ((style === "jump" || style === "bounce" || style === "pump") && me > 0.72 && hash(p.id, bar) < 0.45 + (me - 0.72) * 2) || (px.drop > 0.6 && me > 0.6);
      }
      let lift = wave * (14 + me * 18) * s1;
      if (p.jmp) lift = Math.max(lift, (16 + me * 22) * s1 * 4 * cyc * (1 - cyc)); // landet auf dem Schlag
      else if (style === "bounce" && me > 0.3) lift = 6 * s1 * me * Math.sin(Math.PI * phi);
      else if (style === "skank" && me > 0.25) lift = 7 * s1 * me * Math.exp(-((phi - 0.5) ** 2) * 40);
      else if (me > 0.35) lift = 2.5 * s1 * me * Math.sin(Math.PI * phi);
      const sway = Math.sin(((beatN + phi) / 2) * Math.PI + p.ph) * (2 + (1 - me) * 4) * s1;
      const base = vh + 8 * u, y = base - lift, x = p.x + sway;
      // --- Kopf: Nicken auf dem Schlag; Rock/Metal bangen kräftig
      const nodAmp = style === "bang" ? (me > 0.5 ? 9 : 4) : style === "nod" ? 6 : me > 0.3 ? 3 : 1;
      const nod = nodAmp * s1 * down * (0.4 + me * 0.6);
      const sp = bodySprite(p, u, pal), k1 = p.s / 1.3;
      // auf den Schultern: dieselbe Person sitzt eine Etage höher und reißt die Arme hoch
      const lifted = p.id === crowd.lift;
      p.sh = (p.sh || 0) + ((lifted ? 1 : 0) - (p.sh || 0)) * (1 - Math.exp(-dt * 4)); // weich hoch auf die Schultern
      const yy = y - 58 * s1 * p.sh;
      ctx.drawImage(sp.c, x - sp.ax * k1, yy - sp.ay * k1, sp.w * k1, sp.h * k1);
      // Körper bis weit unter den Bildrand verlängern: beim Springen, auf den Schultern und bei
      // Kamerafahrten schwebt sonst ein abgeschnittener Oberkörper in der Luft
      ctx.fillStyle = FILL[p.row];
      ctx.fillRect(x - 20 * s1, yy + 18 * s1 - 0.5, 40 * s1, vh * 0.6 + (base - yy));
      ctx.drawImage(sp.head, x - sp.hox * k1 + (style === "bang" ? nod * 0.3 * p.hand : 0), yy - 64 * s1 + nod - 24 * s1, sp.head.width * k1, sp.head.height * k1);
      // --- Arme: hoch mit der Stimmung, Faust auf der Kick, Klatschen auf 2 und 4, Winken, Handys
      // im Lichtermeer machen immer mehr mit – wer, steht je Person fest; im Saal bleiben die Hände unten
      const inSea = SEAa > 0.05 && hash(p.id, 7) < 0.15 + 0.65 * SEAa;
      const gadget = inSea ? p.gadget || (hash(p.id, 9) < 0.55 ? "phone" : "lighter") : p.gadget;
      // „Hands up“: im Refrain gehen (fast) alle Hände gleichzeitig hoch – beide Arme, als großes V
      const allUp = !v.seated && (st.handsUp || 0) > 0.05 && hash(p.id, 11) < 0.92;
      const wantUp = allUp ? 1 : v.seated && !inSea ? 0 : lifted || inWave || (me > 0.55 && p.up < me + 0.1 && style !== "sway" && style !== "nod") ? 1 : inSea ? 0.9 : p.gadget && me < 0.5 ? 0.8 : style === "clap" && me > 0.3 ? 0.75 : 0;
      p.arm += (wantUp - p.arm) * (1 - Math.exp(-dt * 5));
      const arm = arms[p.row];
      const clapOn = style === "clap" && (inBar === 1 || inBar === 3) ? down : 0;
      for (const side of [-1, 1]) {
        const sx = x + side * 15 * s1, sy = yy - 42 * s1;
        const a = side === p.hand || allUp ? p.arm : p.arm * (me > 0.6 || style === "clap" || lifted ? 1 : 0.35);
        let hxA = sx + side * 6 * s1, hyA = yy + 2 * s1;
        if (a > 0.02) {
          let ux = side * (12 + 6 * Math.sin(((beatN + phi) / 2) * Math.PI + p.ph)) * s1, uy = -50 * s1;
          if (style === "wave" || st.hype) ux = side * 16 * s1 + Math.sin(((beatN + phi) / 2) * Math.PI * 2 + p.ph) * 14 * s1;
          // Lichtermeer: alle schwenken im selben langsamen Bogen, leicht versetzt von links nach rechts
          if (inSea && side === p.hand) [ux, uy] = [side * 6 * s1 + Math.sin(((beatN + phi) / 8) * Math.PI * 2 - p.x / (vw * 0.9)) * 18 * s1, -56 * s1];
          if (style === "clap") [ux, uy] = [side * (14 - clapOn * 12) * s1, -40 * s1];
          if (allUp) [ux, uy] = [side * (20 + 4 * Math.sin(((beatN + phi) / 2) * Math.PI)) * s1, -54 * s1 - 6 * s1 * down];
          if ((style === "pump" || style === "jump" || style === "bang") && side === p.hand && me > 0.55) uy -= 14 * s1 * down;
          hxA += (sx + ux - hxA) * a;
          hyA += (sy + uy - hyA) * a;
        }
        const ex = (sx + hxA) / 2 + side * 7 * s1, ey = (sy + hyA) / 2 + 4 * s1 * (1 - a);
        arm.moveTo(sx, sy);
        arm.quadraticCurveTo(ex, ey, hxA, hyA);
        if (side === p.hand && gadget && a > 0.5 && (inSea || me < 0.55 || gadget === "phone")) glows.push([hxA, hyA - 6 * s1, gadget, s1, p.row]);
      }
      // Kamerablitze aus der Menge: in der Spitze öfter
      // (mit „Keine Blitze“ bleiben die Handys dunkel)
      if (st.noFlash) {
        // nichts
      } else if (!st.paused && p.gadget === "phone" && Math.random() < dt * (0.03 + X * 0.25)) crowd.flashes.push({ x: x, y: yy - 70 * s1, a: 1, s: s1, row: p.row });
      // Blitzlicht-Gewitter (großer Refrain): viele Handys blitzen gleichzeitig
      else if (!st.paused && (st.flashStorm || 0) > 0.05 && Math.random() < dt * 2.2 * st.flashStorm) crowd.flashes.push({ x: x + p.hand * 18 * s1, y: yy - 92 * s1, a: 1, s: s1 * 0.8, row: p.row });
    }
    if (curRow != null) {
      strokeRow(curRow);
      flushLights(curRow);
    }
    ctx.globalCompositeOperation = "lighter";
    if (crowd.flashes.length > 160) crowd.flashes.splice(0, crowd.flashes.length - 160);
    crowd.flashes = crowd.flashes.filter((f) => (f.a -= dt * 7) > 0);
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- Bodennebel */
  // Langsam wabernde Nebelbänke über dem Boden, hinter der Menge. Die Scheinwerfer färben sie in den
  // Songfarben, die Kick lässt sie kurz aufglühen. Im Wohnzimmer kein Nebel, in gediegenen Orten nur ein Hauch.
  const fogBanks = Array.from({ length: 9 }, (_, i) => ({ x: i / 8, sp: 0.006 + Math.random() * 0.01, r: 0.18 + Math.random() * 0.14, ph: Math.random() * 6.3, c: i % 3 }));
  function drawFog(ctx, st, v) {
    if (v.decor === "fairy") return;
    // Nebel nach der Regie: in Intro und Break dichter (das Licht steht im Dunst), im Drop klarer
    const px = st.px, t = st.t, dens = (v.calm ? 0.45 : 1) * (0.55 + 0.45 * (px.energy || 0)) * (px.haze ?? 1);
    ctx.globalCompositeOperation = "lighter";
    for (const b of fogBanks) {
      const x = (((b.x + t * b.sp) % 1.3) - 0.15) * vw, r = b.r * vw, y = vh * (0.86 + 0.03 * Math.sin(t * 0.3 + b.ph));
      ctx.globalAlpha = clamp((0.05 + 0.07 * (px.kickEnv || 0) + 0.05 * (px.drop || 0)) * dens, 0, 0.3);
      ctx.drawImage(glowSprite(st.pal[b.c]), x - r, y - r * 0.35, r * 2, r * 0.7);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- Drohnen-Lichtshow */
  // Unter freiem Himmel, einmal pro Song beim ersten großen Drop: 120 Lichtpunkte fliegen von überall
  // heran, formen ein Herz, einen Stern, einen Kreis oder eine Welle, leuchten im Takt und fliegen wieder auseinander.
  const drones = { song: "", t: -1, pts: [], shape: 0 };
  function shapePoint(kind, i, n) {
    const a = (i / n) * Math.PI * 2;
    if (kind === 0) return [(16 * Math.sin(a) ** 3) / 17, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17];
    if (kind === 1) {
      const k = Math.floor((i / n) * 10), f = (i / n) * 10 - k, r0 = k % 2 ? 0.42 : 1, r1 = k % 2 ? 1 : 0.42;
      const a0 = (k / 10) * Math.PI * 2 - Math.PI / 2, a1 = ((k + 1) / 10) * Math.PI * 2 - Math.PI / 2;
      return [Math.cos(a0) * r0 * (1 - f) + Math.cos(a1) * r1 * f, Math.sin(a0) * r0 * (1 - f) + Math.sin(a1) * r1 * f];
    }
    if (kind === 2) return [Math.cos(a), Math.sin(a)];
    return [(i / n) * 2 - 1, Math.sin((i / n) * Math.PI * 4) * 0.35];
  }
  function drawDrones(ctx, st) {
    const px = st.px, t = st.t;
    if (st.song && st.song !== drones.song && st.drones && px.dropHit && px.energy > 0.7 && !px.blackout) {
      drones.song = st.song;
      drones.t = t;
      drones.shape = Math.floor(Math.random() * 4);
      drones.pts = Array.from({ length: 120 }, (_, i) => ({ sx: Math.random(), sy: Math.random() * 0.5, i }));
    }
    if (drones.t < 0) return;
    const age = t - drones.t;
    if (age > 9) return void (drones.t = -1);
    // heranfliegen 2 s, halten 5 s, auseinander 2 s
    const f = age < 2 ? age / 2 : age < 7 ? 1 : 1 - (age - 7) / 2, e = f * f * (3 - 2 * f);
    const cx = vw / 2, cy = vh * 0.2, S = Math.min(vw, vh) * 0.12, beat = Math.max(px.kickEnv || 0, px.accent || 0);
    ctx.globalCompositeOperation = "lighter";
    for (const p of drones.pts) {
      const [qx, qy] = shapePoint(drones.shape, p.i, drones.pts.length);
      const x = p.sx * vw + (cx + qx * S - p.sx * vw) * e, y = p.sy * vh + (cy + qy * S - p.sy * vh) * e;
      const c = st.pal[p.i % 3], r = (3 + beat * 2.5) * st.dpr;
      ctx.globalAlpha = clamp((0.35 + 0.65 * e) * (0.7 + 0.3 * Math.sin(t * 6 + p.i)), 0, 1);
      ctx.drawImage(glowSprite(c.map((x2) => Math.round(x2 + (255 - x2) * 0.5))), x - r * 2, y - r * 2, r * 4, r * 4);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- ein Bild der Location */
  function stageCam(ctx, st) {
    const dx = st.cam.x + (st.dep.on ? st.dep.x * 34 : 0), dy = st.cam.y + (st.dep.on ? st.dep.y * 14 : 0);
    if (st.cam.s === 1 && !dx && !dy) return;
    ctx.setTransform(st.cam.s, 0, 0, st.cam.s, ((1 - st.cam.s) * vw) / 2 + dx * st.dpr, ((1 - st.cam.s) * vh) / 2 + dy * st.dpr);
  }
  // Überblendung zwischen Locations: das letzte Bild der alten bleibt kurz liegen und blendet aus
  let lastV = null, vSnap = null, vT = 0;
  const V_FADE = 1.3;
  function draw(ctx, st) {
    vw = st.vw;
    vh = st.vh;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    const vNext = VENUES[st.venue] || VENUES[AUTO_VENUE[st.px.key] || "stadium"];
    if (lastV && vNext !== lastV && ctx.canvas?.width && crowdA > 0.05) {
      try {
        vSnap = vSnap && vSnap.width === ctx.canvas.width && vSnap.height === ctx.canvas.height ? vSnap : makeCanvas(ctx.canvas.width, ctx.canvas.height);
        vSnap.width = ctx.canvas.width;
        vSnap.height = ctx.canvas.height;
        vSnap.getContext("2d").drawImage(ctx.canvas, 0, 0);
        vT = st.t;
      } catch {
        vT = 0;
      }
    }
    lastV = vNext;
    ctx.clearRect(0, 0, vw, vh);
    // Pause: das Publikum blendet weich aus (stillstehend tanzen sähe falsch aus) und kommt mit der Musik zurück
    crowdA += ((st.crowd && !st.paused ? 1 : 0) - crowdA) * (1 - Math.exp(-(st.dt || 0.016) * (st.paused ? 3 : 2)));
    if (!st.stage && crowdA < 0.01) return;
    const rgba = (c, al) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
    const v = vNext;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    stageCam(ctx, st);
    if (st.stage) {
      drawStage(ctx, st.pal, st.px, rgba, st.cx, st.cy, st.R, st.dpr, st.dt, st, v);
      show.drawRig(ctx, st, v, st.px, st.pal, st.dpr);
      drawDecor(ctx, v, st.px, st.pal, rgba, st.dpr, st);
    }
    if (st.inst) show.drawInst(ctx, st, st.px, st.pal, st.dpr);
    drawFx(ctx, st, v, st.px, st.pal, st.dpr);
    if (st.stage && st.fog) drawFog(ctx, st, v);
    if (st.stage && v.open) drawDrones(ctx, st);
    if (crowdA > 0.01) drawCrowd(ctx, st.px, st.pal, st.dpr, rgba, st.dt, st, v, crowdA);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (vT && vSnap) {
      const f = clamp((st.t - vT) / V_FADE, 0, 1), e = f * f * (3 - 2 * f);
      if (f >= 1) vT = 0;
      else {
        // neues Bild anteilig ausblenden, altes darunterlegen
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = `rgba(0,0,0,${(1 - e).toFixed(3)})`;
        ctx.fillRect(0, 0, vw, vh);
        ctx.globalCompositeOperation = "destination-over";
        ctx.globalAlpha = 1 - e;
        ctx.drawImage(vSnap, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  return { draw, glowSprite };
}

export { createVenue };
