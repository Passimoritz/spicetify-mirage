/* ---------------------------------------------------------------- Party-Location */
// Bühnenlicht, Dekor und Publikum des Party-Modus – ohne Zugriff auf Spotify oder das Fenster, darum läuft
// dasselbe Modul im Hintergrund-Thread (eigenes OffscreenCanvas, venue-worker.js) und, wo das nicht geht,
// im Hauptfenster. Jedes Bild bekommt seinen Zustand als „st“ (Takt, Energie, Farben, Kamera …) mitgeteilt.
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
  let disco = null, tunnel = [];
  function drawStage(ctx, pal, px, rgba, cx, cy, R, dpr, dt, st, v) {
    const t = st.t, far = Math.hypot(vw, vh) * 1.1;
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
        const bps = (st.bpm || 125) / 60;
        const al = (0.05 + hatL * 0.22 + px.drop * 0.12) * vis;
        for (let k = 0; k < 2; k++) {
          const y = ((t * bps * 0.125 + k * 0.5 + px.scene * 0.17) % 1) * vh * 1.3 - vh * 0.15;
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
        // Chill: breite, sehr weiche Lichtbahnen von oben, die langsam wandern
        const al = (0.035 + beat * 0.05) * (0.6 + px.I * 0.4);
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
    beach: { rows: [[2, 0.55, 30], [1, 0.8, 40], [0, 1.04, 50]], haze: 0.6, spot: 0.8, decor: "beach" },
  };
  // „Automatisch“: der Ort passt zum Genre
  const AUTO_VENUE = {
    techno: "warehouse", dnb: "warehouse", house: "club", bass: "club", disco: "club", jazz: "club",
    rave: "festival", trance: "festival", hardstyle: "festival", reggae: "beach", afro: "beach", latin: "beach",
    rock: "stadium", metal: "stadium", punk: "stadium", pop: "stadium", kpop: "stadium", country: "stadium",
    chill: "home", classical: "home",
    edm: "festival", deephouse: "beach", techhouse: "warehouse", psytrance: "festival", dubstep: "festival", garage: "club",
    eurodance: "club", synthwave: "club", hyperpop: "club", trap: "club", drill: "warehouse", phonk: "warehouse", rnb: "club",
    soul: "club", indie: "festival", alternative: "stadium", blues: "club", schlager: "festival", ballad: "stadium", gospel: "stadium",
    reggaeton: "club", salsa: "beach", brazil: "beach", flamenco: "club", bollywood: "stadium", arabic: "festival", ambient: "home",
    cinematic: "stadium",
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
        ctx.globalAlpha = clamp((0.15 + tw * 0.4) * (0.4 + px.energy * 0.6), 0, 1);
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
    }
  }
  let stands = null;

  /* ---------------------------------------------------------------- Bühneneffekte */
  // Nur wo sie hingehören: CO2-Fontänen bei elektronischer Musik, Pyro-Flammen bei Rock/Metal/Punk/Hardstyle,
  // Feuerwerk im letzten Refrain im Stadion und auf dem Festival, Stroboskop bei harten Drops (höchstens einmal
  // pro Schlag – also nie schneller als ~3 Blitze/s). Ausgelöst vom Drop und, in der Spitze, vom Taktanfang.
  const CO2 = new Set(["rave", "techno", "house", "trance", "dnb", "bass", "hardstyle", "kpop", "pop", "disco", "edm", "dubstep", "psytrance", "techhouse", "eurodance", "hyperpop", "trap", "reggaeton", "schlager"]);
  const PYRO = new Set(["rock", "metal", "punk", "hardstyle", "alternative", "phonk"]);
  const STROBE = new Set(["techno", "hardstyle", "rave", "dnb", "bass", "dubstep", "psytrance", "techhouse", "edm", "phonk", "hyperpop"]);
  const fx = { jets: [], flames: [], rockets: [], sparks: [], strobe: 0, beat: -1, bar: 0 };
  function drawFx(ctx, st, v, px, pal, dpr) {
    const dt = st.dt, key = px.key;
    const big = v.decor === "towers" || v.decor === "stands";
    const newBeat = px.beatIdx >= 0 && px.beatIdx !== fx.beat;
    if (newBeat) fx.beat = px.beatIdx;
    const barStart = newBeat && px.inBar === 0;
    if (barStart) fx.bar++;
    if (st.fx && !px.blackout && v.decor !== "fairy") {
      // Drop: immer. Danach und in der Spitze eines Refrains: auf jedem zweiten Taktanfang, nicht jedes Mal
      const peak = px.drop > 0.3 || (px.energy > 0.85 && px.build < 0.15) || px.finale;
      const fire = px.dropHit || (barStart && peak && fx.bar % 2 === 0 && Math.random() < 0.7);
      if (fire && CO2.has(key)) {
        const n = big ? 6 : 4;
        for (let k = 0; k < n; k++) fx.jets.push({ x: vw * (0.12 + (0.76 * k) / (n - 1)), t: 0, h: vh * (0.5 + Math.random() * 0.15) });
      }
      if (fire && PYRO.has(key)) for (const f of big ? [0.1, 0.3, 0.7, 0.9] : [0.2, 0.8]) fx.flames.push({ x: vw * f, t: 0 });
      // Feuerwerk: im letzten Refrain auf fast jedem Taktanfang ein bis zwei Raketen
      if (px.finale && big && barStart && fx.rockets.length < 4 && Math.random() < 0.85) {
        for (let k = Math.random() < 0.4 ? 2 : 1; k > 0; k--) fx.rockets.push({ x: vw * (0.15 + Math.random() * 0.7), y: vh, vy: -vh * (1.1 + Math.random() * 0.3), c: pal[Math.floor(Math.random() * 3)] });
      }
      if (st.strobe && STROBE.has(key) && px.drop > 0.5 && newBeat) fx.strobe = 1;
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
    synthwave: "nod", hyperpop: "jump", trap: "bounce", drill: "nod", phonk: "pump", rnb: "sway", soul: "clap", indie: "bounce",
    alternative: "bang", blues: "sway", schlager: "clap", ballad: "sway", gospel: "clap", reggaeton: "bounce", salsa: "bounce",
    brazil: "bounce", flamenco: "clap", bollywood: "bounce", arabic: "clap", ambient: "sway", cinematic: "sway",
  };
  const mood = { x: 0 };
  function crowdMood(px, dt, hype) {
    const target = clamp(Math.pow(px.energy, 1.3) * 0.85 + px.drop * 0.5 + px.build * 0.2 - px.low * 0.7 + (hype && px.energy > 0.45 ? 0.12 : 0), 0, 1);
    mood.x += (target - mood.x) * (1 - Math.exp(-dt * (target > mood.x ? 1.6 : 0.7)));
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
          hair: r() < 0.25 ? "bun" : r() < 0.45 ? "cap" : r() < 0.65 ? "curl" : "",
          gadget: r() < 0.16 ? "phone" : r() < 0.26 ? "lighter" : "", arm: 0,
        });
      }
    }
    return { w: vw, venue: v, people, lift: -1, liftUntil: 0, wave: -1, nextWave: 0, flashes: [] };
  }
  const bodySprites = new Map();
  function bodySprite(p, u, pal) {
    const key = `${p.row}|${p.hair}|${p.hand}|${pal[1].join()}|${pal[2].join()}|${u.toFixed(2)}`;
    let sp = bodySprites.get(key);
    if (sp) return sp;
    if (bodySprites.size > 40) bodySprites.clear();
    const S1 = 1.3 * u, w = Math.ceil(60 * S1), h = Math.ceil(100 * S1);
    const c = makeCanvas(w, h);
    c.width = w;
    c.height = h;
    const x = c.getContext("2d"), cx0 = w / 2, y = 82 * S1, hx = cx0;
    x.fillStyle = FILL[p.row];
    x.beginPath();
    // nur der Körper – den Kopf zeichnet drawCrowd extra, damit er nicken kann
    x.moveTo(cx0 - 20 * S1, y + 18 * S1);
    x.quadraticCurveTo(cx0 - 22 * S1, y - 46 * S1, hx - 5 * S1, y - 50 * S1);
    x.lineTo(hx + 5 * S1, y - 50 * S1);
    x.quadraticCurveTo(cx0 + 22 * S1, y - 46 * S1, cx0 + 20 * S1, y + 18 * S1);
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
    hxx.fill();
    if (p.hair === "cap") hxx.fillRect(ox - 2 * S1 + (p.hand < 0 ? -13 * S1 : 0), oy - 9 * S1, 15 * S1, 3 * S1);
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
    if (!crowd || crowd.w !== vw || crowd.venue !== v) crowd = makeCrowd(u, v);
    if (!crowd.people.length) return;
    const X = crowdMood(px, dt, st.hype), t = st.t;
    const style = MOVES[px.key] || "clap";
    // Schlagphase (0 = Schlag): schnelle Songs bewegen sich im halben Tempo
    const half = st.bpm > 150;
    const beatN = px.beatIdx >= 0 ? px.beatIdx : Math.floor(t * (st.bpm / 60));
    const phi = clamp(px.phase ?? 0, 0, 1);
    const cyc = half ? ((beatN & 1) + phi) / 2 : phi; // 0..1 über einen (bzw. zwei) Schläge
    const bar = Math.floor(beatN / 4), inBar = px.inBar ?? beatN & 3;
    const down = Math.exp(-phi * 6); // kurz nach dem Schlag 1, dann abklingend
    // La-Ola: in der Spitze etwa alle 20 s eine Welle über zwei Takte
    if (X > 0.65 && t > crowd.nextWave && crowd.wave < 0) [crowd.wave, crowd.nextWave] = [t, t + 20 + Math.random() * 10];
    const waveX = crowd.wave >= 0 ? ((t - crowd.wave) / ((8 * 60) / st.bpm)) * vw * 1.3 - vw * 0.15 : -1e9;
    if (crowd.wave >= 0 && waveX > vw * 1.2) crowd.wave = -1;
    // auf die Schultern: im Refrain oder beim Drop wird jemand vorne hochgehoben
    if ((st.hype || px.drop > 0.5) && X > 0.6 && t > crowd.liftUntil) {
      const front = crowd.people.filter((p) => p.row === 0 && p.x > vw * 0.15 && p.x < vw * 0.85);
      crowd.lift = front[Math.floor(Math.random() * front.length)]?.id ?? -1;
      crowd.liftUntil = t + 9;
    }
    if (t > crowd.liftUntil + 0.01 && !(st.hype || px.drop > 0.5)) crowd.lift = -1;
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
    for (const p of crowd.people) {
      if (p.row !== curRow) {
        if (curRow != null) strokeRow(curRow);
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
      const wantUp = lifted || inWave || (me > 0.55 && p.up < me + 0.1 && style !== "sway" && style !== "nod") ? 1 : p.gadget && me < 0.5 ? 0.8 : style === "clap" && me > 0.3 ? 0.75 : 0;
      p.arm += (wantUp - p.arm) * (1 - Math.exp(-dt * 5));
      const arm = arms[p.row];
      const clapOn = style === "clap" && (inBar === 1 || inBar === 3) ? down : 0;
      for (const side of [-1, 1]) {
        const sx = x + side * 15 * s1, sy = yy - 42 * s1;
        const a = side === p.hand ? p.arm : p.arm * (me > 0.6 || style === "clap" || lifted ? 1 : 0.35);
        let hxA = sx + side * 6 * s1, hyA = yy + 2 * s1;
        if (a > 0.02) {
          let ux = side * (12 + 6 * Math.sin(((beatN + phi) / 2) * Math.PI + p.ph)) * s1, uy = -50 * s1;
          if (style === "wave" || st.hype) ux = side * 16 * s1 + Math.sin(((beatN + phi) / 2) * Math.PI * 2 + p.ph) * 14 * s1;
          if (style === "clap") [ux, uy] = [side * (14 - clapOn * 12) * s1, -40 * s1];
          if ((style === "pump" || style === "jump" || style === "bang") && side === p.hand && me > 0.55) uy -= 14 * s1 * down;
          hxA += (sx + ux - hxA) * a;
          hyA += (sy + uy - hyA) * a;
        }
        const ex = (sx + hxA) / 2 + side * 7 * s1, ey = (sy + hyA) / 2 + 4 * s1 * (1 - a);
        arm.moveTo(sx, sy);
        arm.quadraticCurveTo(ex, ey, hxA, hyA);
        if (side === p.hand && p.gadget && a > 0.5 && (me < 0.55 || p.gadget === "phone")) glows.push([hxA, hyA - 6 * s1, p.gadget, s1, p.row]);
      }
      // Kamerablitze aus der Menge: in der Spitze öfter
      if (!st.paused && p.gadget === "phone" && Math.random() < dt * (0.03 + X * 0.25)) crowd.flashes.push({ x: x, y: yy - 70 * s1, a: 1, s: s1 });
    }
    if (curRow != null) strokeRow(curRow);
    ctx.globalCompositeOperation = "lighter";
    for (const [gx, gy, kind, s1, row] of glows) {
      const r = (kind === "phone" ? 16 : 13 + Math.sin(t * 13 + gx) * 2) * s1;
      ctx.globalAlpha = (kind === "phone" ? 0.85 : 0.6) * (1 - row * 0.25) * A * rowA[row];
      ctx.drawImage(glowSprite(kind === "phone" ? [170, 200, 255] : [255, 170, 70]), gx - r, gy - r, r * 2, r * 2);
    }
    crowd.flashes = crowd.flashes.filter((f) => (f.a -= dt * 7) > 0);
    for (const f of crowd.flashes) {
      const r = 34 * f.s;
      ctx.globalAlpha = f.a * A;
      ctx.drawImage(glowSprite([255, 255, 255]), f.x - r, f.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- ein Bild der Location */
  function stageCam(ctx, st) {
    const dx = st.cam.x + (st.dep.on ? st.dep.x * 34 : 0), dy = st.cam.y + (st.dep.on ? st.dep.y * 14 : 0);
    if (st.cam.s === 1 && !dx && !dy) return;
    ctx.setTransform(st.cam.s, 0, 0, st.cam.s, ((1 - st.cam.s) * vw) / 2 + dx * st.dpr, ((1 - st.cam.s) * vh) / 2 + dy * st.dpr);
  }
  function draw(ctx, st) {
    vw = st.vw;
    vh = st.vh;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, vw, vh);
    // Pause: das Publikum blendet weich aus (stillstehend tanzen sähe falsch aus) und kommt mit der Musik zurück
    crowdA += ((st.crowd && !st.paused ? 1 : 0) - crowdA) * (1 - Math.exp(-(st.dt || 0.016) * (st.paused ? 3 : 2)));
    if (!st.stage && crowdA < 0.01) return;
    const rgba = (c, al) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
    const v = VENUES[st.venue] || VENUES[AUTO_VENUE[st.px.key] || "stadium"];
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    stageCam(ctx, st);
    if (st.stage) {
      drawStage(ctx, st.pal, st.px, rgba, st.cx, st.cy, st.R, st.dpr, st.dt, st, v);
      drawDecor(ctx, v, st.px, st.pal, rgba, st.dpr, st);
    }
    drawFx(ctx, st, v, st.px, st.pal, st.dpr);
    if (crowdA > 0.01) drawCrowd(ctx, st.px, st.pal, st.dpr, rgba, st.dt, st, v, crowdA);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  return { draw, glowSprite };
}

export { createVenue };
