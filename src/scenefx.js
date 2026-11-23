/* ---------------------------------------------------------------- Neue Bühnenbilder der Szenarien */
// Zeichnet die Bilder aus scenarios.js, die nach „neon“ kommen (SCENE_FAMS): Konfettikanone, Luftschlangen,
// Feuerwerk, Laser-Gitter, Spiegelkugel, Münzregen, Gewitter, Nordlicht, Skyline, Handylichter, Glitch …
// stagefx.js ruft draw() je laufender Antwort auf.
// Günstig je Bild: alles ist eine Funktion des Alters und des festen Zufalls (kein Teilchen-Speicher, keine
// Objekte je Bild), Leuchtpunkte aus dem fertigen Leuchtbild der Location (glowSprite), Farben als fertige
// Zeichenketten (zwischengespeichert), Teilchenzahl nach Qualitätsstufe (Leicht ≈ ein Drittel).
// „Keine Blitze“: nichts springt; was sich schnell bewegt oder pulsiert, bleibt dann so schwach, dass keine Stelle
// des Bilds mehr als dreimal pro Sekunde kräftig hell und dunkel wird. Einzig das Wetterleuchten des Gewitters darf
// hart sein – nur mit Blitzen an und durch die gemeinsame Blitz-Schranke (höchstens 3/s).

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
// fester Zufall je Index (0..1)
const hash = (i, s) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const TAU = Math.PI * 2;

// Farben der Spielarten je Bild (cue.v wählt; eine Farbe des Begriffs geht vor)
const VC = {
  cannon: [[255, 80, 120], [80, 200, 255], [255, 210, 70]],
  streamers: [[255, 90, 170], [90, 220, 255], [255, 200, 60]],
  balloons: [[255, 70, 90], [120, 170, 255], [255, 190, 80]],
  fwpeony: [[255, 90, 90], [120, 200, 255], [255, 220, 120], [200, 120, 255]],
  fwwillow: [[255, 200, 110], [255, 170, 80], [255, 235, 170]],
  fwring: [[120, 220, 255], [255, 120, 200], [255, 80, 120]],
  lasergrid: [[60, 255, 140], [255, 60, 220], [60, 220, 255]],
  lasertunnel: [[60, 255, 120], [255, 50, 90], [80, 160, 255]],
  spothunt: [[255, 250, 235], [200, 220, 255], [255, 220, 170]],
  discoball: [[255, 255, 255], [255, 200, 240], [200, 240, 255]],
  searchlight: [[235, 240, 255], [255, 235, 200]],
  follow: [[255, 248, 230], [230, 240, 255], [255, 225, 190]],
  coins: [[255, 205, 80], [230, 235, 245]],
  champspray: [[255, 235, 160], [255, 245, 210]],
  diamond: [[200, 240, 255], [255, 255, 255], [255, 210, 240]],
  tiara: [[255, 205, 90], [220, 230, 255]],
  thunder: [[110, 150, 255], [150, 170, 230]],
  blizzard: [[230, 245, 255], [200, 225, 255]],
  leaves: [[230, 120, 40], [255, 170, 210], [220, 40, 70], [110, 200, 90]],
  aurora: [[60, 255, 160], [80, 220, 255], [190, 110, 255]],
  dawn: [[255, 140, 70], [200, 90, 200], [255, 190, 90]],
  rainbow: [[255, 255, 255], [255, 255, 255]],
  haze: [[255, 170, 90], [255, 210, 140]],
  jungle: [[20, 90, 40], [30, 70, 50]],
  foam: [[70, 170, 255], [40, 210, 220]],
  bubbles: [[150, 220, 255], [120, 255, 230], [200, 200, 255]],
  ice: [[170, 230, 255], [220, 245, 255]],
  firewall: [[255, 110, 30], [255, 60, 30]],
  lava: [[255, 90, 30], [255, 50, 60]],
  fireflies: [[220, 255, 120], [255, 220, 120], [160, 255, 200]],
  drops: [[120, 180, 255], [170, 220, 255]],
  comet: [[220, 235, 255], [255, 230, 190], [190, 210, 255]],
  warp: [[200, 220, 255], [255, 200, 240]],
  planet: [[230, 110, 70], [110, 170, 255], [240, 180, 110], [120, 220, 160]],
  launch: [[255, 160, 60], [255, 210, 120]],
  eclipse: [[255, 235, 200], [210, 220, 255]],
  hearts: [[255, 80, 140], [255, 50, 80], [255, 170, 200]],
  crack: [[255, 200, 220], [220, 230, 255]],
  ekg: [[90, 255, 150], [255, 90, 120]],
  ghosts: [[170, 185, 230], [235, 240, 255], [120, 255, 120]],
  candles: [[255, 170, 70], [255, 200, 120]],
  rays: [[255, 240, 210], [220, 230, 255], [255, 220, 170]],
  skyline: [[255, 210, 120], [180, 220, 255], [255, 160, 220]],
  headlights: [[255, 250, 225], [235, 240, 255]],
  beacon: [[255, 40, 50], [255, 150, 30]],
  clock: [[230, 235, 255]],
  mexwave: [[255, 240, 210]],
  lighters: [[255, 170, 70], [255, 200, 110]],
  phones: [[220, 235, 255], [255, 255, 255]],
  clappulse: [[255, 230, 190]],
  micdrop: [[235, 240, 255]],
  scratch: [[230, 230, 245], [255, 200, 120]],
  guitarspark: [[255, 200, 110], [255, 230, 170]],
  bassdrop: [[150, 120, 255]],
  glitch: [[0, 255, 240], [255, 0, 200]],
  matrix: [[60, 255, 120], [80, 200, 255]],
  spiral: [[200, 120, 255], [80, 220, 255]],
  kaleido: [[255, 90, 200], [90, 200, 255], [255, 210, 80]],
  flock: [[230, 235, 245], [255, 220, 200]],
};
const CONFETTI = [[255, 80, 120], [80, 200, 255], [255, 210, 70], [120, 255, 150], [200, 120, 255]];
const RAINBOW = [[255, 60, 60], [255, 150, 40], [255, 230, 60], [60, 220, 90], [60, 140, 255], [160, 80, 255]];

function createSceneFx(glowSprite, flashCap) {
  let vw = 0, vh = 0, S = 1;
  // Farbe je Antwort einmal bestimmen (seq), Farb-Zeichenketten einmal bauen
  const base = new Map(), strs = new Map(), flashes = new Map();
  const rgb = (c) => {
    const k = ((c[0] | 0) << 16) | ((c[1] | 0) << 8) | (c[2] | 0);
    let s = strs.get(k);
    if (!s) {
      if (strs.size > 256) strs.clear();
      strs.set(k, (s = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`));
    }
    return s;
  };
  const glow = (ctx, col, x, y, r, a) => {
    if (a <= 0.004 || r <= 0) return;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.drawImage(glowSprite(col, r > 48), x - r, y - r, r * 2, r * 2);
  };
  // gestreckter Schein (Wolke, Lichtband)
  const glowWH = (ctx, col, x, y, w, h, a) => {
    if (a <= 0.004 || w <= 0 || h <= 0) return;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.drawImage(glowSprite(col, true), x - w, y - h, w * 2, h * 2);
  };
  const fill = (ctx, col, a) => {
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = rgb(col);
  };
  const stroke = (ctx, col, a, lw) => {
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.strokeStyle = rgb(col);
    ctx.lineWidth = lw;
  };
  function colOf(c, f, pal) {
    let b = base.get(c.seq);
    if (b) return b;
    if (base.size > 32) base.delete(base.keys().next().value);
    const vc = VC[f];
    b = c.col || (vc ? vc[(c.v || 0) % vc.length] : pal[(c.seq || 0) % 3]);
    // traurige Stimmung: kühler
    if (c.cool) b = [b[0] * 0.7 + 120 * 0.3, b[1] * 0.75 + 150 * 0.25, b[2] * 0.7 + 255 * 0.3];
    base.set(c.seq, b);
    return b;
  }
  // Teilchenzahl nach Qualität
  const nOf = (n, st) => Math.max(3, Math.round(n * ((st.quality ?? 2) < 1 ? 0.35 : (st.quality ?? 2) < 2 ? 0.65 : 1)));

  /* ---- die Bilder. a = Stärke × Hülle (0..1.3), p = Fortschritt 0..1 */
  const L = {
    // Konfettikanone: zwei Salven aus den unteren Ecken (Spielart 1: aus der Mitte, „holi“: Farbwolken)
    cannon(ctx, c, a, age, st, nf) {
      if (c.from === "holi") {
        for (let i = 0; i < 7; i++) {
          const q = smooth(age / 1.2 + hash(i, 4) * 0.2), x = vw * (0.1 + 0.8 * hash(i, c.seq)), y = vh * (0.95 - 0.35 * q * hash(i, 9));
          glow(ctx, CONFETTI[i % 5], x, y, vh * (0.12 + 0.25 * q), a * 0.35 * (1 - age / (c.dur + 0.5)));
        }
        return;
      }
      const n = nOf(90, st), mid = c.v === 1, g = vh * 0.55;
      for (let k = 0; k < 5; k++) {
        fill(ctx, CONFETTI[k], a * (nf ? 0.08 : 0.85));
        for (let i = k; i < n; i += 5) {
          const side = mid ? 0 : i % 2 ? 1 : -1, ox = mid ? vw / 2 : side > 0 ? vw * 1.02 : -vw * 0.02;
          const an = mid ? -Math.PI / 2 + (hash(i, 1) - 0.5) * 0.9 : -Math.PI / 2 - side * (0.35 + hash(i, 1) * 0.55);
          const sp = vh * (0.9 + hash(i, 2) * 0.7), d = 1 - Math.exp(-age * 1.6);
          const x = ox + Math.cos(an) * sp * d / 1.6 + Math.sin(age * 2 + i) * 12 * S;
          const y = vh * 1.02 + Math.sin(an) * sp * d / 1.6 + g * Math.max(0, age - 0.4) * Math.max(0, age - 0.4) * 0.35;
          if (y > vh * 1.05) continue;
          const w = 7 * S, h = 4 * S * Math.abs(Math.sin(age * 6 + i));
          ctx.fillRect(x - w / 2, y - h / 2, w, h + 0.5);
        }
      }
    },
    // Luftschlangen: geschwungene Bänder fallen von oben
    streamers(ctx, c, a, age, st, nf) {
      const n = nOf(12, st), col = colOf(c, "streamers", st.pal);
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const cc = i % 3 === 0 ? col : CONFETTI[i % 5], x0 = vw * hash(i, c.seq + 3), sp = vh * (0.25 + hash(i, 5) * 0.2);
        const y1 = Math.min(vh * 0.75, -vh * 0.1 + sp * age * 1.4), len = vh * 0.28;
        stroke(ctx, cc, a * (nf ? 0.08 : 0.6), 3 * S);
        ctx.beginPath();
        for (let s = 0; s <= 10; s++) {
          const y = y1 - len * (s / 10), x = x0 + Math.sin(y * 0.02 + i + age * 1.5) * 22 * S;
          s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    },
    // Luftballons steigen von unten auf, mit Schnur
    balloons(ctx, c, a, age, st) {
      const n = nOf(14, st);
      for (let i = 0; i < n; i++) {
        const cc = c.col && i % 2 ? c.col : VC.balloons[(i + (c.v || 0)) % 3];
        const r = (16 + hash(i, 3) * 12) * S, x = vw * (0.05 + 0.9 * hash(i, c.seq)) + Math.sin(age * 1.2 + i) * 14 * S;
        const y = vh * (1.1 + hash(i, 7) * 0.3) - age * vh * (0.18 + hash(i, 8) * 0.08);
        if (y < -r * 2) continue;
        fill(ctx, cc, a * 0.5);
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.85, r, 0, 0, TAU);
        ctx.fill();
        glow(ctx, [255, 255, 255], x - r * 0.3, y - r * 0.35, r * 0.4, a * 0.35);
        stroke(ctx, cc, a * 0.3, 1.2 * S);
        ctx.beginPath();
        ctx.moveTo(x, y + r);
        ctx.quadraticCurveTo(x + 6 * S, y + r * 2, x, y + r * 3);
        ctx.stroke();
      }
    },
    // Feuerwerk: Kugelbomben am Himmel
    fwpeony(ctx, c, a, age, st, nf) {
      const n = nOf(36, st), col = colOf(c, "fwpeony", st.pal);
      for (let b = 0; b < 3; b++) {
        const t0 = b * 0.55, q = age - t0;
        if (q < 0 || q > 2) continue;
        const cx = vw * (0.2 + 0.6 * hash(b, c.seq)), cy = vh * (0.15 + 0.2 * hash(b, c.seq + 1)), R = vh * (0.18 + 0.08 * hash(b, 3));
        const d = R * (1 - Math.exp(-q * 3.5)), fade = Math.pow(clamp(1 - q / 2, 0, 1), 1.5), cc = b === 1 ? VC.fwpeony[((c.v || 0) + 1) % 4] : col;
        glow(ctx, cc, cx, cy, R * 0.5, a * (nf ? 0.12 : 0.3) * Math.exp(-q * 4));
        for (let i = 0; i < n; i++) {
          const an = (i / n) * TAU + hash(i, b) * 0.2;
          glow(ctx, cc, cx + Math.cos(an) * d, cy + Math.sin(an) * d + vh * 0.05 * q * q, 5 * S, a * fade * (nf ? 0.5 : 0.9));
        }
      }
    },
    // Feuerwerk: goldene Weide – Schweife hängen herab
    fwwillow(ctx, c, a, age, st, nf) {
      const n = nOf(26, st), col = colOf(c, "fwwillow", st.pal);
      for (let b = 0; b < 2; b++) {
        const q = age - b * 0.8;
        if (q < 0 || q > 3) continue;
        const cx = vw * (0.3 + 0.4 * hash(b, c.seq + 2)), cy = vh * (0.14 + 0.1 * hash(b, 5)), R = vh * 0.2, fade = Math.pow(clamp(1 - q / 3, 0, 1), 1.3);
        stroke(ctx, col, a * fade * (nf ? 0.3 : 0.55), 2 * S);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const an = (i / n) * TAU, d = R * (1 - Math.exp(-q * 2.5)), drop = vh * 0.12 * q * q;
          const x = cx + Math.cos(an) * d, y = cy + Math.sin(an) * d * 0.7 + drop;
          ctx.moveTo(x, y);
          ctx.lineTo(x - Math.cos(an) * R * 0.15, y - Math.sin(an) * R * 0.1 - drop * 0.4);
        }
        ctx.stroke();
      }
    },
    // Feuerwerk: Ring (Spielart „heart“ oder 2: Herz)
    fwring(ctx, c, a, age, st, nf) {
      const n = nOf(30, st), col = colOf(c, "fwring", st.pal), heart = c.from === "heart" || c.v === 2;
      const cx = vw * (0.3 + 0.4 * (c.ox ?? 0.5)), cy = vh * 0.24, R = vh * 0.14 * (1 - Math.exp(-age * 3)), fade = Math.pow(clamp(1 - age / c.dur, 0, 1), 1.2);
      for (let i = 0; i < n; i++) {
        const u = (i / n) * TAU;
        const x = heart ? 16 * Math.pow(Math.sin(u), 3) / 16 : Math.cos(u), y = heart ? -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) / 16 : Math.sin(u);
        glow(ctx, col, cx + x * R, cy + y * R + vh * 0.03 * age * age, 5 * S, a * fade * (nf ? 0.5 : 0.9));
      }
    },
    // Laser-Gitter auf dem Boden, läuft auf die Menge zu
    lasergrid(ctx, c, a, age, st, nf) {
      const col = colOf(c, "lasergrid", st.pal), hy = vh * 0.62, vx = vw / 2 + (c.dir || 1) * Math.sin(st.t * 0.3) * vw * 0.08;
      stroke(ctx, col, a * 0.35, 1.6 * S);
      ctx.beginPath();
      for (let i = -8; i <= 8; i++) {
        ctx.moveTo(vx, hy);
        ctx.lineTo(vw / 2 + i * vw * 0.12, vh);
      }
      const ph = (st.t * (nf ? 0.12 : 0.35)) % 1;
      for (let k = 0; k < 8; k++) {
        const z = (k + ph) / 8, y = hy + (vh - hy) * z * z;
        ctx.moveTo(0, y);
        ctx.lineTo(vw, y);
      }
      ctx.stroke();
      glowWH(ctx, col, vx, hy, vw * 0.4, vh * 0.04, a * 0.25);
    },
    // Laser-Tunnel: Strahlen aus der Mitte, langsam drehend, dazu weichende Ringe
    lasertunnel(ctx, c, a, age, st, nf) {
      const col = colOf(c, "lasertunnel", st.pal), n = 14, rot = st.t * (nf ? 0.15 : 0.3) * (c.dir || 1), R0 = st.R * 1.15, R1 = Math.hypot(vw, vh);
      stroke(ctx, col, a * (nf ? 0.22 : 0.4), 1.4 * S);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const an = rot + (i / n) * TAU;
        ctx.moveTo(st.cx + Math.cos(an) * R0, st.cy + Math.sin(an) * R0);
        ctx.lineTo(st.cx + Math.cos(an) * R1, st.cy + Math.sin(an) * R1);
      }
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const q = (age * (nf ? 0.2 : 0.45) + k / 3) % 1, r = R0 * (1 + q * 3);
        stroke(ctx, col, a * 0.25 * (1 - q) * smooth(q / 0.1), 2 * S);
        ctx.beginPath();
        ctx.ellipse(st.cx, st.cy, r, r * 0.9, 0, 0, TAU);
        ctx.stroke();
      }
    },
    // Suchscheinwerfer: drei Kegel von oben jagen über die Menge
    spothunt(ctx, c, a, age, st) {
      const col = colOf(c, "spothunt", st.pal);
      for (let i = 0; i < 3; i++) {
        const x0 = vw * (0.2 + 0.3 * i), x1 = vw * (0.5 + 0.42 * Math.sin(st.t * (0.5 + 0.13 * i) + i * 2.1 + (c.ox || 0) * 6)), y1 = vh * (0.82 + 0.06 * Math.sin(st.t * 0.7 + i));
        cone(ctx, col, x0, x1, y1, vw * 0.05, a * 0.16);
      }
    },
    // Spiegelkugel oben, Lichtpunkte ziehen im Kreis über alles
    discoball(ctx, c, a, age, st, nf) {
      const col = colOf(c, "discoball", st.pal), n = nOf(48, st), bx = vw / 2, by = vh * 0.07, rot = st.t * (nf ? 0.12 : 0.3) * (c.dir || 1);
      glow(ctx, col, bx, by, 26 * S, a * 0.6);
      glow(ctx, col, bx, by, vh * 0.12, a * 0.15);
      for (let i = 0; i < n; i++) {
        const an = rot + hash(i, 1) * TAU, rr = 0.2 + 0.8 * hash(i, 2);
        const x = vw / 2 + Math.cos(an) * vw * 0.55 * rr, y = vh * 0.5 + Math.sin(an) * vh * 0.45 * rr;
        glow(ctx, i % 4 ? col : st.pal[i % 3], x, y, (4 + hash(i, 3) * 4) * S, a * (nf ? 0.35 : 0.7));
      }
    },
    // zwei Himmelsstrahler vom Boden, kreuzen sich langsam (Premiere)
    searchlight(ctx, c, a, age, st) {
      const col = colOf(c, "searchlight", st.pal), len = vh * 1.3;
      for (let i = 0; i < 2; i++) {
        const x0 = vw * (i ? 0.78 : 0.22), an = -Math.PI / 2 + (i ? -1 : 1) * (0.1 + 0.35 * (0.5 + 0.5 * Math.sin(st.t * 0.6 + i * 1.7)));
        beam(ctx, col, x0, vh * 1.02, an, len, 0.05, a * 0.2);
      }
    },
    // Verfolger-Spot auf die Mitte
    follow(ctx, c, a, age, st) {
      const col = colOf(c, "follow", st.pal), x0 = vw * [0.5, 0.12, 0.88][(c.v || 0) % 3];
      cone(ctx, col, x0, st.cx + Math.sin(st.t * 0.8) * st.R * 0.1, st.cy + st.R * 1.3, st.R * 1.1, a * 0.2);
    },
    // Münzregen: drehende Münzen fallen
    coins(ctx, c, a, age, st, nf) {
      const col = colOf(c, "coins", st.pal), n = nOf(42, st);
      fill(ctx, col, a * (nf ? 0.45 : 0.8));
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = vw * hash(i, c.seq), y = -vh * 0.6 * hash(i, 2) + age * vh * (0.32 + hash(i, 3) * 0.15), r = (5 + hash(i, 4) * 4) * S;
        if (y < -r || y > vh * 1.02) continue;
        const w = Math.max(0.6, r * Math.abs(Math.cos(age * (3 + hash(i, 5) * 3) + i)));
        ctx.moveTo(x + w, y);
        ctx.ellipse(x, y, w, r, 0, 0, TAU);
      }
      ctx.fill();
    },
    // Champagnerdusche aus den unteren Ecken
    champspray(ctx, c, a, age, st, nf) {
      const col = colOf(c, "champspray", st.pal), n = nOf(60, st), life = 1.1;
      for (let i = 0; i < n; i++) {
        const side = c.v === 1 ? 0 : i % 2 ? 1 : -1, ox = side ? vw * (0.5 + side * 0.42) : vw / 2;
        const q = (age + hash(i, 1) * life) % life, an = -Math.PI / 2 - side * 0.5 + (hash(i, 2) - 0.5) * 0.5, sp = vh * (0.9 + hash(i, 3) * 0.5);
        if (age < q) continue;
        const x = ox + Math.cos(an) * sp * q, y = vh * 0.98 + Math.sin(an) * sp * q + vh * 0.7 * q * q;
        glow(ctx, col, x, y, (3 + hash(i, 4) * 3) * S, a * (1 - q / life) * (nf ? 0.45 : 0.8));
      }
    },
    // Diamant-Funkeln: Vierstrahl-Sterne
    diamond(ctx, c, a, age, st) {
      const col = colOf(c, "diamond", st.pal), n = nOf(22, st);
      stroke(ctx, col, a * 0.7, 1.3 * S);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const tw = Math.max(0, Math.sin(st.t * (1 + hash(i, 3) * 1.5) + hash(i, 4) * 6.3)), x = vw * hash(i, c.seq + 7), y = vh * 0.7 * hash(i, 8), r = (6 + 12 * tw) * S;
        if (tw < 0.05) continue;
        ctx.moveTo(x - r, y);
        ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r * 1.3);
        ctx.lineTo(x, y + r * 1.3);
      }
      ctx.stroke();
      for (let i = 0; i < n; i += 2) glow(ctx, col, vw * hash(i, c.seq + 7), vh * 0.7 * hash(i, 8), 6 * S, a * 0.5 * Math.max(0, Math.sin(st.t * (1 + hash(i, 3) * 1.5) + hash(i, 4) * 6.3)));
    },
    // Krone aus Licht über dem Cover, Edelsteine an den Zacken
    tiara(ctx, c, a, age, st) {
      const col = colOf(c, "tiara", st.pal), w = st.R * 1.1, y0 = st.cy - st.R * 1.15 - 8 * S * smooth(age / 0.8), h = st.R * 0.55;
      const P = [[-1, 0], [-1, -0.8], [-0.5, -0.35], [0, -1], [0.5, -0.35], [1, -0.8], [1, 0]];
      stroke(ctx, col, a * 0.75, 3 * S);
      ctx.beginPath();
      P.forEach(([x, y], i) => (i ? ctx.lineTo(st.cx + x * w, y0 + y * h) : ctx.moveTo(st.cx + x * w, y0 + y * h)));
      ctx.closePath();
      ctx.stroke();
      for (const i of [1, 3, 5]) glow(ctx, i === 3 ? [255, 80, 120] : col, st.cx + P[i][0] * w, y0 + P[i][1] * h, 10 * S, a * 0.8);
      glowWH(ctx, col, st.cx, y0 - h * 0.4, w * 1.3, h, a * 0.18);
    },
    // Gewitter: schräge Regenschleier, Wetterleuchten (hart nur mit Blitzen an und durch die Schranke)
    thunder(ctx, c, a, age, st, nf) {
      const col = colOf(c, "thunder", st.pal), n = nOf(80, st), sl = 0.25 * (c.dir || 1);
      stroke(ctx, col, a * (nf ? 0.07 : 0.22), 1.3 * S);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = vw * (hash(i, c.seq) * 1.2 - 0.1), y = ((hash(i, 2) * vh + age * vh * 1.6) % (vh * 1.1)) - vh * 0.05, l = vh * 0.07;
        ctx.moveTo(x + sl * y, y);
        ctx.lineTo(x + sl * (y + l), y + l);
      }
      ctx.stroke();
      // Wetterleuchten bei 0,5 s und 2,2 s
      for (let k = 0; k < 2; k++) {
        const d = age - (k ? 2.2 : 0.5), key = c.seq * 4 + k;
        if (d < 0) continue;
        if (!flashes.has(key)) {
          if (flashes.size > 16) flashes.delete(flashes.keys().next().value);
          flashes.set(key, !c.soft && !nf && !!st.flash && flashCap.take(st.t));
        }
        if (flashes.get(key) && d < 0.25) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgba(200,215,255,${(0.12 * a * Math.exp(-d * 14)).toFixed(3)})`;
          ctx.fillRect(0, 0, vw, vh);
        } else glowWH(ctx, [170, 190, 255], vw * (0.3 + 0.4 * hash(k, c.seq)), 0, vw * 0.5, vh * 0.35, a * 0.25 * smooth(d / 0.35) * smooth((1.4 - d) / 0.8));
      }
    },
    // Schneesturm: Flocken schräg im Wind
    blizzard(ctx, c, a, age, st, nf) {
      const col = colOf(c, "blizzard", st.pal), n = nOf(90, st), wind = (c.dir || 1) * vw * 0.25;
      for (let i = 0; i < n; i++) {
        const fall = vh * (0.25 + hash(i, 2) * 0.25), y = ((hash(i, 1) * vh * 1.1 + age * fall) % (vh * 1.1)) - vh * 0.05;
        const x = ((hash(i, c.seq) * vw * 1.4 + age * wind + Math.sin(age * 2 + i) * 10 * S) % (vw * 1.4) + vw * 1.4) % (vw * 1.4) - vw * 0.2;
        glow(ctx, col, x, y, (2 + hash(i, 3) * 3) * S, a * (nf ? 0.5 : 0.8));
      }
    },
    // fallende Blätter / Blüten, drehen sich
    leaves(ctx, c, a, age, st, nf) {
      const col = colOf(c, "leaves", st.pal), n = nOf(36, st);
      for (let k = 0; k < 3; k++) {
        const cc = k === 0 ? col : [col[0] * (0.8 + 0.1 * k), col[1] * (0.7 + 0.15 * k), col[2] * 0.85];
        fill(ctx, cc, a * (nf ? 0.45 : 0.7));
        ctx.beginPath();
        for (let i = k; i < n; i += 3) {
          const y = -vh * 0.15 + ((hash(i, 1) * vh * 0.5 + age * vh * (0.12 + hash(i, 2) * 0.08)) % (vh * 1.2));
          const x = vw * hash(i, c.seq) + Math.sin(age * (0.8 + hash(i, 3)) + i) * 40 * S, r = (6 + hash(i, 4) * 5) * S, rot = age * (1 + hash(i, 5) * 2) + i;
          ctx.moveTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r);
          ctx.ellipse(x, y, r, r * 0.45, rot, 0, TAU);
        }
        ctx.fill();
      }
    },
    // Nordlicht: drei wogende Bänder am Himmel
    aurora(ctx, c, a, age, st) {
      const col = colOf(c, "aurora", st.pal), vc = VC.aurora;
      for (let b = 0; b < 3; b++) {
        const cc = b ? vc[((c.v || 0) + b) % 3] : col, y0 = vh * (0.12 + b * 0.07);
        for (const [lw, al] of [[46, 0.08], [12, 0.18]]) {
          stroke(ctx, cc, a * al, lw * S);
          ctx.beginPath();
          for (let k = 0; k <= 20; k++) {
            const x = (k / 20) * vw, y = y0 + Math.sin(k * 0.45 + st.t * 0.35 + b * 1.3) * vh * 0.05 + Math.sin(k * 0.17 - st.t * 0.2) * vh * 0.03;
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
      }
    },
    // Morgen-/Abendrot vom Horizont, eine Sonne geht auf (dusk: sinkt)
    dawn(ctx, c, a, age, st) {
      const v = c.from === "dusk" ? 1 : c.v || 0, col = c.col || VC.dawn[v % 3], p = smooth(age / c.dur), up = v === 1 ? 1 - p * 0.6 : p;
      const g = ctx.createLinearGradient(0, vh, 0, vh * 0.35);
      g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${(0.3 * a).toFixed(3)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, vh * 0.35, vw, vh * 0.65);
      glow(ctx, [255, 220, 150], vw * (0.3 + 0.4 * (c.ox ?? 0.5)), vh * (1.05 - 0.2 * up), vh * 0.18, a * 0.45);
    },
    // Regenbogen: Bögen wachsen von links nach rechts
    rainbow(ctx, c, a, age, st) {
      const cx = vw / 2, cy = vh * 1.05, R = Math.min(vw * 0.55, vh * 0.95), end = Math.PI + Math.PI * smooth(age / 1.4);
      for (let i = 0; i < 6; i++) {
        stroke(ctx, RAINBOW[i], a * 0.2, 11 * S);
        ctx.beginPath();
        ctx.ellipse(cx, cy, R - i * 11 * S, R - i * 11 * S, 0, Math.PI, end);
        ctx.stroke();
      }
    },
    // Hitzeflimmern: warme, wogende Bänder über dem Boden
    haze(ctx, c, a, age, st) {
      const col = colOf(c, "haze", st.pal);
      glowWH(ctx, col, vw / 2, vh, vw * 0.7, vh * 0.35, a * 0.22);
      for (let b = 0; b < 6; b++) {
        stroke(ctx, col, a * 0.08, 8 * S);
        ctx.beginPath();
        const y0 = vh * (0.6 + b * 0.065);
        for (let k = 0; k <= 16; k++) {
          const x = (k / 16) * vw, y = y0 + Math.sin(k * 0.9 + st.t * 1.2 + b) * 5 * S;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    },
    // Dschungel: große Blätter wiegen sich am linken und rechten Rand (dunkel, deckend)
    jungle(ctx, c, a, age, st) {
      const col = colOf(c, "jungle", st.pal), n = nOf(10, st);
      ctx.globalCompositeOperation = "source-over";
      fill(ctx, col, a * 0.55);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1, x = side > 0 ? vw * (1.02 - hash(i, 2) * 0.08) : vw * (hash(i, 2) * 0.08 - 0.02), y = vh * (0.1 + 0.8 * hash(i, 3));
        const r = vh * (0.08 + hash(i, 4) * 0.06), rot = (side > 0 ? Math.PI : 0) + (hash(i, 5) - 0.5) + Math.sin(st.t * 0.7 + i) * 0.12;
        ctx.moveTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r);
        ctx.ellipse(x, y, r, r * 0.35, rot, 0, TAU);
      }
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      glowWH(ctx, [60, 200, 90], vw / 2, vh, vw * 0.6, vh * 0.25, a * 0.12);
    },
    // Brandung: Wellenlinien mit Gischt-Glitzer auf den Kämmen
    foam(ctx, c, a, age, st, nf) {
      const col = colOf(c, "foam", st.pal);
      for (let b = 0; b < 3; b++) {
        const y0 = vh * (0.66 + b * 0.08), amp = vh * (0.025 + b * 0.008), sp = (c.dir || 1) * (0.9 + b * 0.3);
        stroke(ctx, col, a * (0.4 - b * 0.08), (9 - b * 2) * S);
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) {
          const x = (k / 24) * vw, y = y0 + Math.sin(k * 0.5 - st.t * sp + b) * amp;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        for (let k = 0; k < nOf(14, st); k++) {
          const u = (k + 0.5) / 14, x = u * vw, y = y0 + Math.sin(u * 24 * 0.5 - st.t * sp + b) * amp;
          glow(ctx, [235, 245, 255], x, y - 4 * S, 4 * S, a * (nf ? 0.3 : 0.55) * Math.max(0, Math.sin(st.t * 1.5 + k)));
        }
      }
    },
    // Luftblasen steigen mit leichtem Wackeln
    bubbles(ctx, c, a, age, st, nf) {
      const col = colOf(c, "bubbles", st.pal), n = nOf(30, st);
      stroke(ctx, col, a * (nf ? 0.08 : 0.6), 1.5 * S);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const r = (5 + hash(i, 2) * 10) * S, y = vh * 1.05 - ((hash(i, 1) * vh * 0.4 + age * vh * (0.15 + hash(i, 3) * 0.12)) % (vh * 1.1));
        const x = vw * hash(i, c.seq) + Math.sin(age * 2.5 + i) * 8 * S;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
      ctx.stroke();
    },
    // Eiskristalle wachsen aus den Ecken
    ice(ctx, c, a, age, st, nf) {
      const col = colOf(c, "ice", st.pal), g = smooth(age / 1.5), L0 = vh * 0.3 * g;
      stroke(ctx, col, a * (nf ? 0.08 : 0.5), 1.6 * S);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const ox = k % 2 ? vw : 0, oy = k > 1 ? vh : 0, a0 = Math.atan2(vh / 2 - oy, vw / 2 - ox);
        for (let i = 0; i < 6; i++) {
          const an = a0 + (hash(i, k + c.seq) - 0.5) * 1.3, l = L0 * (0.5 + hash(i, k + 9) * 0.6);
          const ex = ox + Math.cos(an) * l, ey = oy + Math.sin(an) * l;
          ctx.moveTo(ox, oy);
          ctx.lineTo(ex, ey);
          for (const s of [0.45, 0.7]) {
            const bx = ox + Math.cos(an) * l * s, by = oy + Math.sin(an) * l * s, bl = l * 0.22;
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(an + 0.7) * bl, by + Math.sin(an + 0.7) * bl);
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(an - 0.7) * bl, by + Math.sin(an - 0.7) * bl);
          }
        }
      }
      ctx.stroke();
      for (let k = 0; k < 4; k++) glow(ctx, col, k % 2 ? vw : 0, k > 1 ? vh : 0, vh * 0.25 * g, a * 0.25);
    },
    // Feuerwand am Boden (low: kleines Lagerfeuer in der Mitte)
    firewall(ctx, c, a, age, st, nf) {
      const col = colOf(c, "firewall", st.pal), low = c.from === "low", n = nOf(low ? 9 : 22, st);
      for (let i = 0; i < n; i++) {
        const x = low ? vw * (0.42 + 0.16 * (i / n)) : vw * ((i + 0.5) / n), fl = 0.75 + 0.25 * Math.sin(st.t * (nf ? 1.6 : 3.5) + i * 1.7) * Math.sin(st.t * 2.3 + i);
        const h = vh * (low ? 0.08 : 0.14) * fl;
        glowWH(ctx, col, x, vh * 1.01 - h * 0.5, (low ? 20 : 34) * S, h, a * 0.45);
        glow(ctx, [255, 210, 120], x, vh * 1.0, 14 * S, a * 0.4);
      }
    },
    // Lava-Blasen steigen träge
    lava(ctx, c, a, age, st) {
      const col = colOf(c, "lava", st.pal), n = nOf(9, st);
      for (let i = 0; i < n; i++) {
        const y = vh * 1.1 - ((hash(i, 1) * vh + age * vh * (0.08 + hash(i, 2) * 0.05)) % (vh * 1.2));
        glow(ctx, i % 2 ? col : [255, 170, 60], vw * hash(i, c.seq) + Math.sin(st.t * 0.4 + i) * 30 * S, y, vh * (0.06 + hash(i, 3) * 0.05), a * 0.4);
      }
    },
    // Glühwürmchen: wandern langsam, glimmen auf und ab
    fireflies(ctx, c, a, age, st) {
      const col = colOf(c, "fireflies", st.pal), n = nOf(34, st);
      for (let i = 0; i < n; i++) {
        const x = vw * hash(i, c.seq) + Math.sin(st.t * (0.3 + hash(i, 2) * 0.3) + i) * 40 * S, y = vh * (0.35 + 0.6 * hash(i, 3)) + Math.cos(st.t * (0.25 + hash(i, 4) * 0.3) + i) * 30 * S;
        glow(ctx, col, x, y, (5 + hash(i, 5) * 4) * S, a * (0.25 + 0.6 * Math.max(0, Math.sin(st.t * (0.6 + hash(i, 6) * 0.6) + i * 2))));
      }
    },
    // Tropfen-Ringe auf dem Boden
    drops(ctx, c, a, age, st, nf) {
      const col = colOf(c, "drops", st.pal), n = nOf(12, st), cyc = 1.6;
      for (let i = 0; i < n; i++) {
        const q = (age / cyc + hash(i, 1)) % 1, k = Math.floor(age / cyc + hash(i, 1));
        const x = vw * hash(i + k * 13, c.seq), y = vh * (0.72 + 0.25 * hash(i + k * 13, 4)), r = (8 + q * 60) * S * (0.6 + 0.6 * (y / vh - 0.72) / 0.25 + 0.2);
        stroke(ctx, col, a * (nf ? 0.14 : 0.4) * (1 - q) * smooth(q / 0.08), 1.5 * S);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.28, 0, 0, TAU);
        ctx.stroke();
      }
    },
    // Sternschnuppen
    comet(ctx, c, a, age, st, nf) {
      const col = colOf(c, "comet", st.pal);
      for (let i = 0; i < 3; i++) {
        const q = (age - i * 0.7) / 1.1;
        if (q < 0 || q > 1) continue;
        const dir = c.dir || 1, x0 = vw * (dir > 0 ? 0.1 + 0.4 * hash(i, c.seq) : 0.9 - 0.4 * hash(i, c.seq)), y0 = vh * (0.05 + 0.2 * hash(i, 3));
        const dx = dir * vw * 0.45, dy = vh * 0.22, x = x0 + dx * q, y = y0 + dy * q, tl = 0.35;
        const f = Math.sin(Math.PI * q);
        const g = ctx.createLinearGradient(x, y, x - dx * tl, y - dy * tl);
        g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${(a * f * (nf ? 0.4 : 0.8)).toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = 1;
        ctx.strokeStyle = g;
        ctx.lineWidth = 2.5 * S;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - dx * tl, y - dy * tl);
        ctx.stroke();
        glow(ctx, col, x, y, 9 * S, a * f * 0.8);
      }
    },
    // Sprung durch den Hyperraum: Striche fliegen aus der Mitte
    warp(ctx, c, a, age, st, nf) {
      const col = colOf(c, "warp", st.pal), n = nOf(70, st), sp = nf ? 0.35 : 0.8, R1 = Math.hypot(vw, vh) * 0.6;
      stroke(ctx, col, a * (nf ? 0.3 : 0.55), 1.5 * S);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const an = hash(i, c.seq) * TAU, d = (hash(i, 2) + age * sp) % 1, r0 = st.R * 1.1 + d * d * R1, l = 10 * S + d * d * R1 * 0.25;
        ctx.moveTo(st.cx + Math.cos(an) * r0, st.cy + Math.sin(an) * r0);
        ctx.lineTo(st.cx + Math.cos(an) * (r0 + l), st.cy + Math.sin(an) * (r0 + l));
      }
      ctx.stroke();
    },
    // ein Planet geht unten auf (Spielart 2: mit Ring)
    planet(ctx, c, a, age, st) {
      const col = colOf(c, "planet", st.pal), R = vh * 0.32, x = vw * (0.2 + 0.6 * (c.ox ?? 0.5)), y = vh * 1.0 + R * (1.05 - 0.75 * smooth(age / 3));
      const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
      g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${(0.45 * a).toFixed(3)})`);
      g.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${(0.06 * a).toFixed(3)})`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.fill();
      glow(ctx, col, x, y, R * 1.3, a * 0.15);
      if (c.v === 2) {
        stroke(ctx, [255, 230, 190], a * 0.35, 4 * S);
        ctx.beginPath();
        ctx.ellipse(x, y, R * 1.6, R * 0.32, -0.2, 0, TAU);
        ctx.stroke();
      }
    },
    // Raketenstart: Kopf steigt, Feuerschweif und Rauch am Boden
    launch(ctx, c, a, age, st, nf) {
      const col = colOf(c, "launch", st.pal), x = vw * (c.v ? 0.3 : 0.7), p = smooth(age / 2.6), y = vh * (1.02 - 1.15 * p * p);
      const g = ctx.createLinearGradient(0, y, 0, vh);
      g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${(0.5 * a).toFixed(3)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(x - 5 * S, y, 10 * S, vh - y);
      glow(ctx, [255, 240, 200], x, y, 14 * S, a * 0.9);
      glow(ctx, col, x, y + 20 * S, 40 * S, a * (nf ? 0.25 : 0.45));
      for (let i = 0; i < 6; i++) glow(ctx, [200, 200, 210], x + (i - 2.5) * 30 * S * (0.5 + p), vh * 0.98, (40 + 60 * p) * S, a * 0.12 * (1 - p * 0.5));
    },
    // Finsternis: Korona und Strahlen um das Cover
    eclipse(ctx, c, a, age, st) {
      const col = colOf(c, "eclipse", st.pal), g = smooth(age / 1.5);
      glow(ctx, col, st.cx, st.cy, st.R * (1.6 + 0.3 * g), a * 0.3);
      stroke(ctx, col, a * 0.6, 3 * S);
      ctx.beginPath();
      ctx.arc(st.cx, st.cy, st.R * 1.08, 0, TAU);
      ctx.stroke();
      stroke(ctx, col, a * 0.18, 1.5 * S);
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const an = (i / 24) * TAU + st.t * 0.05, l = st.R * (0.3 + 0.5 * hash(i, 3)) * g;
        ctx.moveTo(st.cx + Math.cos(an) * st.R * 1.12, st.cy + Math.sin(an) * st.R * 1.12);
        ctx.lineTo(st.cx + Math.cos(an) * (st.R * 1.12 + l), st.cy + Math.sin(an) * (st.R * 1.12 + l));
      }
      ctx.stroke();
    },
    // Herzen steigen auf
    hearts(ctx, c, a, age, st, nf) {
      const col = colOf(c, "hearts", st.pal), n = nOf(18, st);
      fill(ctx, col, a * (nf ? 0.4 : 0.6));
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = (9 + hash(i, 2) * 12) * S, y = vh * (1.05 + hash(i, 1) * 0.3) - age * vh * (0.14 + hash(i, 3) * 0.08), x = vw * hash(i, c.seq) + Math.sin(age * 1.5 + i) * 18 * S;
        if (y < vh * 0.15) continue;
        ctx.moveTo(x, y + s * 0.35);
        ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.5, y - s * 1.05, x, y - s * 0.45);
        ctx.bezierCurveTo(x + s * 0.5, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
      }
      ctx.fill();
    },
    // Riss durch die Bühne: Zacken laufen von der Mitte nach außen
    crack(ctx, c, a, age, st, nf) {
      const col = colOf(c, "crack", st.pal), g = smooth(age / (nf ? 0.6 : 0.3)), fade = smooth((c.dur - age) / 1.2);
      stroke(ctx, col, a * 0.65 * fade, 2 * S);
      ctx.beginPath();
      for (let b = 0; b < 7; b++) {
        let an = (b / 7) * TAU + hash(b, c.seq) * 0.6, x = st.cx + Math.cos(an) * st.R * 1.05, y = st.cy + Math.sin(an) * st.R * 1.05;
        ctx.moveTo(x, y);
        const segs = Math.ceil(7 * g);
        for (let k = 0; k < segs; k++) {
          an += (hash(b * 7 + k, 3) - 0.5) * 0.7;
          const l = st.R * (0.25 + 0.2 * hash(b * 7 + k, 4));
          x += Math.cos(an) * l;
          y += Math.sin(an) * l;
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      glow(ctx, col, st.cx, st.cy, st.R * 1.5, a * 0.2 * fade * (1 - g * 0.5));
    },
    // Herzschlag-Linie läuft unten über die Bühne
    ekg(ctx, c, a, age, st) {
      const col = colOf(c, "ekg", st.pal), y0 = vh * 0.8, head = clamp(age / (c.dur - 0.8), 0, 1) * vw, beatW = vw / 5;
      const yAt = (x) => {
        const u = (x % beatW) / beatW;
        return y0 - (u > 0.42 && u < 0.46 ? (u - 0.42) * 25 : u >= 0.46 && u < 0.5 ? 1 - (u - 0.46) * 50 : u >= 0.5 && u < 0.54 ? -1 + (u - 0.5) * 25 : 0) * vh * 0.08;
      };
      for (let s = 0; s < 4; s++) {
        const x0 = Math.max(0, head - vw * 0.4 * (s + 1) / 4), x1 = head - vw * 0.4 * s / 4;
        if (x1 <= 0) continue;
        stroke(ctx, col, a * 0.7 * (1 - s / 4), 2.4 * S);
        ctx.beginPath();
        for (let x = x0; x <= x1; x += 6 * S) x === x0 ? ctx.moveTo(x, yAt(x)) : ctx.lineTo(x, yAt(x));
        ctx.stroke();
      }
      glow(ctx, col, head, yAt(head), 12 * S, a * 0.8);
    },
    // Nebelgestalten treiben (clouds: weiße Wolken oben, toxic: giftgrün)
    ghosts(ctx, c, a, age, st) {
      const v = c.from === "clouds" ? 1 : c.from === "toxic" ? 2 : c.v || 0, col = c.col || VC.ghosts[v % 3], n = nOf(6, st);
      for (let i = 0; i < n; i++) {
        const x = ((hash(i, c.seq) * vw * 1.4 + age * (c.dir || 1) * vw * (0.04 + hash(i, 2) * 0.04)) % (vw * 1.4) + vw * 1.4) % (vw * 1.4) - vw * 0.2;
        const y = v === 1 ? vh * (0.08 + 0.2 * hash(i, 3)) : vh * (0.3 + 0.55 * hash(i, 3)) + Math.sin(st.t * 0.6 + i) * 20 * S;
        glowWH(ctx, col, x, y, vh * (0.14 + hash(i, 4) * 0.08), vh * (v === 1 ? 0.06 : 0.1), a * 0.26);
      }
    },
    // Kerzenreihe am Bühnenrand, sanftes Flackern
    candles(ctx, c, a, age, st, nf) {
      const col = colOf(c, "candles", st.pal), n = nOf(11, st);
      for (let i = 0; i < n; i++) {
        const x = vw * (0.06 + 0.88 * (i / Math.max(1, n - 1))), y = vh * (0.9 + 0.04 * hash(i, 2)), fl = 0.85 + 0.15 * Math.sin(st.t * (nf ? 1.7 : 4) + i * 2) * Math.sin(st.t * 2.7 + i);
        fill(ctx, [255, 235, 210], a * 0.18);
        ctx.fillRect(x - 3 * S, y, 6 * S, 22 * S);
        glowWH(ctx, col, x, y - 6 * S, 5 * S, 10 * S * fl, a * 0.9);
        glow(ctx, col, x, y - 6 * S, 34 * S, a * 0.22 * fl);
      }
    },
    // schräge Lichtstrahlen wie durch Kirchenfenster
    rays(ctx, c, a, age, st) {
      const col = colOf(c, "rays", st.pal), dir = c.dir || 1, ox = dir > 0 ? -vw * 0.05 : vw * 1.05;
      for (let i = 0; i < 6; i++) {
        const an = Math.PI / 2 - dir * (0.45 + i * 0.1 + Math.sin(st.t * 0.15 + i) * 0.02);
        beam(ctx, col, ox + dir * i * vw * 0.04, -vh * 0.05, an, vh * 1.3, 0.035, a * 0.13);
      }
    },
    // Skyline: Fenster gehen nach und nach an
    skyline(ctx, c, a, age, st) {
      const col = colOf(c, "skyline", st.pal), nb = 14, lit = smooth(age / 2.5), maxW = nOf(260, st);
      let drawn = 0;
      fill(ctx, col, a * 0.55);
      for (let b = 0; b < nb && drawn < maxW; b++) {
        const x0 = (b / nb) * vw, w = vw / nb * 0.82, h = vh * (0.12 + 0.22 * hash(b, c.seq)), top = vh - h;
        for (let wy = top + 8 * S; wy < vh - 6 * S && drawn < maxW; wy += 14 * S) {
          for (let wx = x0 + 6 * S; wx < x0 + w - 6 * S; wx += 12 * S) {
            const hk = hash(wx * 0.37 + wy * 0.11, b);
            if (hk > 0.55 * lit) continue;
            ctx.fillRect(wx, wy, 5 * S, 7 * S);
            drawn++;
          }
        }
      }
      glowWH(ctx, col, vw / 2, vh, vw * 0.6, vh * 0.2, a * 0.1);
    },
    // Scheinwerfer eines Autos streichen vorbei, Rücklichter rot
    headlights(ctx, c, a, age, st) {
      const col = colOf(c, "headlights", st.pal), dir = c.dir || 1, p = clamp(age / c.dur, 0, 1), x = dir > 0 ? -vw * 0.3 + vw * 1.6 * p : vw * 1.3 - vw * 1.6 * p, y = vh * 0.86;
      for (const dy of [-8, 8]) beam(ctx, col, x, y + dy * S, dir > 0 ? 0.04 : Math.PI - 0.04, vw * 0.45, 0.08, a * 0.2);
      glow(ctx, col, x, y, 26 * S, a * 0.7);
      glow(ctx, [255, 40, 40], x - dir * vw * 0.12, y, 16 * S, a * 0.6);
    },
    // Rundumleuchte: zwei Lichtfinger drehen sich (Polizei blau-rot, Rettung orange) – Farben gleiten, kein Blinken
    beacon(ctx, c, a, age, st) {
      const amber = c.from === "amber" || c.v === 1, rot = st.t * 1.4;
      for (let k = 0; k < 2; k++) {
        const ox = vw * (k ? 0.85 : 0.15), col = amber ? [255, 150, 30] : k ? [40, 90, 255] : [255, 40, 50];
        for (let j = 0; j < 2; j++) beam(ctx, col, ox, vh * 0.04, rot * (k ? -1 : 1) + j * Math.PI, vh * 0.9, 0.09, a * 0.14);
        glow(ctx, col, ox, vh * 0.04, 26 * S, a * (0.45 + 0.15 * Math.sin(st.t * 2 + k * Math.PI)));
      }
    },
    // Ziffernblatt ums Cover, der Zeiger springt auf den Schlägen
    clock(ctx, c, a, age, st, nf) {
      const col = colOf(c, "clock", st.pal), R = st.R * 1.25, b = c.beat || 0.5, bt = Math.max(0, age - (c.off || 0)) / b, n = Math.floor(bt), q = bt - n;
      stroke(ctx, col, a * 0.35, 2 * S);
      ctx.beginPath();
      ctx.arc(st.cx, st.cy, R, 0, TAU);
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * TAU, l = i % 3 ? 8 : 16;
        ctx.moveTo(st.cx + Math.cos(an) * R, st.cy + Math.sin(an) * R);
        ctx.lineTo(st.cx + Math.cos(an) * (R + l * S), st.cy + Math.sin(an) * (R + l * S));
      }
      ctx.stroke();
      const an = -Math.PI / 2 + ((n + smooth(q / 0.15)) / 12) * TAU;
      stroke(ctx, col, a * 0.75, 3 * S);
      ctx.beginPath();
      ctx.moveTo(st.cx + Math.cos(an) * R * 0.9, st.cy + Math.sin(an) * R * 0.9);
      ctx.lineTo(st.cx + Math.cos(an) * (R + 22 * S), st.cy + Math.sin(an) * (R + 22 * S));
      ctx.stroke();
      if (age >= (c.off || 0)) glow(ctx, col, st.cx + Math.cos(an) * (R + 22 * S), st.cy + Math.sin(an) * (R + 22 * S), 14 * S, a * (nf ? 0.08 : 0.4) * (1 - q));
    },
    // La-Ola-Welle: ein Lichtband läuft durch die Menge, die Hände gehen mit hoch
    mexwave(ctx, c, a, age, st, nf, out) {
      const col = colOf(c, "mexwave", st.pal), p = (age / 1.8) % 1, dir = c.dir || 1, xw = dir > 0 ? -vw * 0.1 + vw * 1.2 * p : vw * 1.1 - vw * 1.2 * p, n = nOf(28, st);
      glowWH(ctx, col, xw, vh * 0.88, vw * 0.12, vh * 0.12, a * 0.3);
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / n * vw, bump = Math.exp(-Math.pow((x - xw) / (vw * 0.07), 2));
        glow(ctx, col, x, vh * (0.9 - 0.08 * bump), 6 * S, a * (0.15 + 0.6 * bump) * (nf ? 0.6 : 1));
      }
      out.hands = Math.max(out.hands, a * 0.8);
    },
    // Feuerzeuge wiegen sich in der Menge
    lighters(ctx, c, a, age, st, nf, out) {
      const col = colOf(c, "lighters", st.pal), n = nOf(30, st);
      for (let i = 0; i < n; i++) {
        const x = vw * hash(i, c.seq) + Math.sin(st.t * 1.1 + hash(i, 2) * 2) * 14 * S, y = vh * (0.8 + 0.12 * hash(i, 3));
        glowWH(ctx, col, x, y, 3.5 * S, 7 * S, a * 0.85);
        glow(ctx, col, x, y, 20 * S, a * 0.2);
      }
      out.hands = Math.max(out.hands, a * 0.5);
    },
    // Handylichter in der Menge
    phones(ctx, c, a, age, st, nf, out) {
      const col = colOf(c, "phones", st.pal), n = nOf(34, st);
      fill(ctx, col, a * 0.7);
      for (let i = 0; i < n; i++) {
        const x = vw * hash(i, c.seq) + Math.sin(st.t * 0.8 + i) * 10 * S, y = vh * (0.79 + 0.13 * hash(i, 3));
        ctx.fillRect(x - 2.5 * S, y - 4 * S, 5 * S, 8 * S);
      }
      for (let i = 0; i < n; i += 2) glow(ctx, col, vw * hash(i, c.seq) + Math.sin(st.t * 0.8 + i) * 10 * S, vh * (0.79 + 0.13 * hash(i, 3)), 22 * S, a * 0.18);
      out.hands = Math.max(out.hands, a * 0.5);
    },
    // Klatschen auf den Schlägen: ein Lichtpuls durch die Menge
    clappulse(ctx, c, a, age, st, nf, out) {
      const col = colOf(c, "clappulse", st.pal), b = c.beat || 0.5, bt = (age - (c.off || 0)) / b;
      if (bt >= 0) {
        const q = bt % 1, pulse = Math.exp(-q * 5);
        glowWH(ctx, col, vw / 2, vh * 0.9, vw * 0.55, vh * 0.1, a * (nf ? 0.07 : 0.3) * pulse + a * 0.08);
        glow(ctx, col, vw * 0.25, vh * 0.86, 30 * S, a * (nf ? 0.06 : 0.4) * pulse);
        glow(ctx, col, vw * 0.75, vh * 0.86, 30 * S, a * (nf ? 0.06 : 0.4) * pulse);
      }
      out.hands = Math.max(out.hands, a * 0.6);
    },
    // Mikro fällt, schlägt auf, ein Ring läuft über den Boden, die Bühne dunkelt kurz ab
    micdrop(ctx, c, a, age, st, nf) {
      const col = colOf(c, "micdrop", st.pal), tf = 0.6, y = vh * (0.15 + 0.73 * Math.min(1, Math.pow(age / tf, 2)));
      if (age < tf + 0.05) glow(ctx, col, vw / 2, y, 10 * S, a * 0.9);
      const d = age - tf;
      if (d > 0) {
        const q = clamp(d / 1.4, 0, 1);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(0,0,0,${(0.22 * a * smooth(d / 0.3) * smooth((1.6 - d) / 0.8)).toFixed(3)})`;
        ctx.fillRect(0, 0, vw, vh);
        ctx.globalCompositeOperation = "lighter";
        stroke(ctx, col, a * (nf ? 0.25 : 0.5) * (1 - q), 4 * S);
        ctx.beginPath();
        ctx.ellipse(vw / 2, vh * 0.88, vw * (0.02 + 0.5 * q), vh * (0.01 + 0.08 * q), 0, 0, TAU);
        ctx.stroke();
      }
    },
    // Schallplatte ums Cover, ein Glanz kratzt vor und zurück
    scratch(ctx, c, a, age, st, nf) {
      const col = colOf(c, "scratch", st.pal);
      stroke(ctx, col, a * 0.16, 1.2 * S);
      ctx.beginPath();
      for (let r = 1.1; r < 1.6; r += 0.07) {
        ctx.moveTo(st.cx + st.R * r, st.cy);
        ctx.arc(st.cx, st.cy, st.R * r, 0, TAU);
      }
      ctx.stroke();
      const an = Math.sin(age * (nf ? 2.5 : 6)) * 0.8 - Math.PI / 4;
      stroke(ctx, col, a * 0.6, 5 * S);
      ctx.beginPath();
      ctx.arc(st.cx, st.cy, st.R * 1.35, an - 0.3, an + 0.3);
      ctx.stroke();
    },
    // Funkenfontänen links und rechts der Bühne
    guitarspark(ctx, c, a, age, st, nf) {
      const col = colOf(c, "guitarspark", st.pal), n = nOf(60, st), life = 0.9;
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1, ox = vw * (0.5 + side * (c.v ? 0.18 : 0.33)), q = (age + hash(i, 1) * life) % life;
        if (age < q) continue;
        const an = -Math.PI / 2 + (hash(i, 2) - 0.5) * 0.6, sp = vh * (0.8 + hash(i, 3) * 0.6);
        const x = ox + Math.cos(an) * sp * q, y = vh * 0.98 + Math.sin(an) * sp * q + vh * 0.9 * q * q;
        glow(ctx, i % 3 ? col : [255, 255, 230], x, y, 3.5 * S, a * (1 - q / life) * (nf ? 0.45 : 0.9));
      }
    },
    // Bass-Drop: zwei/drei Druckwellen vom Boden
    bassdrop(ctx, c, a, age, st, nf) {
      const col = colOf(c, "bassdrop", st.pal);
      for (let k = 0; k < (nf ? 2 : 3); k++) {
        const p = clamp((age - k * 0.22) / 1.2, 0, 1);
        if (p <= 0 || p >= 1) continue;
        stroke(ctx, col, a * (nf ? 0.25 : 0.5) * (1 - p) * smooth(p / 0.06), (7 - k * 2) * S);
        ctx.beginPath();
        ctx.ellipse(vw / 2, vh * 0.9, vw * (0.05 + 0.65 * p), vh * (0.02 + 0.12 * p), 0, 0, TAU);
        ctx.stroke();
      }
      glowWH(ctx, col, vw / 2, vh, vw * 0.5, vh * 0.25, a * 0.25 * Math.exp(-age * 2));
    },
    // VHS-Glitch: versetzte Farbbänder, Zeilen; „vhs“: ein Spurband läuft langsam herunter
    glitch(ctx, c, a, age, st, nf) {
      const vc = VC.glitch, step = nf ? 0.6 : 0.3, k = Math.floor(st.t / step), q = (st.t / step) % 1, cross = smooth(q / 0.3);
      for (let s = 0; s < 2; s++) {
        const kk = k - 1 + s, w = s ? cross : 1 - cross;
        for (let i = 0; i < 5; i++) {
          const y = vh * hash(i, kk + c.seq), h = (6 + 18 * hash(i, kk + 3)) * S, off = (hash(i, kk + 5) - 0.5) * 40 * S;
          fill(ctx, vc[i % 2], a * (nf ? 0.06 : 0.14) * w);
          ctx.fillRect(off, y, vw, h);
        }
      }
      fill(ctx, [255, 255, 255], a * 0.035);
      for (let y = 0; y < vh; y += 6 * S) ctx.fillRect(0, y, vw, 1);
      if (c.from === "vhs") glowWH(ctx, [200, 200, 220], vw / 2, ((age * 0.12) % 1) * vh, vw * 0.7, 12 * S, a * 0.12);
    },
    // digitaler Regen
    matrix(ctx, c, a, age, st, nf) {
      const col = colOf(c, "matrix", st.pal), n = nOf(34, st);
      for (let i = 0; i < n; i++) {
        const x = vw * hash(i, c.seq), sp = vh * (0.35 + hash(i, 2) * 0.3), head = ((hash(i, 3) * vh * 1.3 + age * sp) % (vh * 1.3)) - vh * 0.1;
        for (let j = 0; j < 10; j++) {
          fill(ctx, j ? col : [220, 255, 230], a * (nf ? 0.08 : 0.7) * (1 - j / 10));
          ctx.fillRect(x, head - j * 12 * S, 4 * S, 7 * S);
        }
      }
    },
    // hypnotische Spirale: drei Arme drehen langsam
    spiral(ctx, c, a, age, st, nf) {
      const col = colOf(c, "spiral", st.pal), rot = st.t * (nf ? 0.3 : 0.5) * (c.dir || 1), R1 = Math.hypot(vw, vh) * 0.55;
      stroke(ctx, col, a * 0.28, 3 * S);
      ctx.beginPath();
      for (let arm = 0; arm < 3; arm++) {
        for (let s = 0; s <= 40; s++) {
          const u = s / 40, r = st.R * 1.1 + u * R1, an = rot + arm * (TAU / 3) + u * 5;
          s ? ctx.lineTo(st.cx + Math.cos(an) * r, st.cy + Math.sin(an) * r) : ctx.moveTo(st.cx + Math.cos(an) * r, st.cy + Math.sin(an) * r);
        }
      }
      ctx.stroke();
    },
    // Kaleidoskop: sechsfach gespiegelte Lichtflecken
    kaleido(ctx, c, a, age, st) {
      const vc = VC.kaleido, rot = st.t * 0.2;
      for (let j = 0; j < 2; j++) {
        const th = 0.3 + 0.25 * Math.sin(st.t * 0.4 + j * 2), r = st.R * (1.6 + j * 0.9 + 0.3 * Math.sin(st.t * 0.3 + j)), col = vc[((c.v || 0) + j) % 3];
        for (let k = 0; k < 6; k++) {
          for (const sg of [1, -1]) {
            const an = rot + k * (TAU / 6) + sg * th;
            glow(ctx, col, st.cx + Math.cos(an) * r, st.cy + Math.sin(an) * r, st.R * 0.35, a * 0.3);
          }
        }
      }
    },
    // Vogelschwarm zieht vorbei, Flügel schlagen
    flock(ctx, c, a, age, st) {
      const col = colOf(c, "flock", st.pal), n = nOf(16, st), dir = c.dir || 1, p = age / c.dur;
      stroke(ctx, col, a * 0.6, 2 * S);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const row = Math.abs(i - n / 2), x0 = dir > 0 ? -vw * 0.15 + vw * 1.3 * p : vw * 1.15 - vw * 1.3 * p;
        const x = x0 - dir * row * 22 * S + hash(i, 2) * 10 * S, y = vh * (0.18 + 0.1 * (c.ox ?? 0.5)) + (i - n / 2) * 9 * S + Math.sin(st.t + i) * 4 * S;
        const w = 9 * S, fl = Math.sin(st.t * 7 + i) * 5 * S;
        ctx.moveTo(x - w, y - fl);
        ctx.lineTo(x, y);
        ctx.lineTo(x + w, y - fl);
      }
      ctx.stroke();
    },
  };

  /* ---- Lichtfinger: von (ox, oy) in Richtung an, Länge len, halbe Öffnung w (rad) */
  function beam(ctx, col, ox, oy, an, len, w, a) {
    if (a < 0.005) return;
    const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(an) * len, oy + Math.sin(an) * len);
    g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a.toFixed(3)})`);
    g.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0)`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(an - w) * len, oy + Math.sin(an - w) * len);
    ctx.lineTo(ox + Math.cos(an + w) * len, oy + Math.sin(an + w) * len);
    ctx.closePath();
    ctx.fill();
  }
  /* ---- Kegel von oben (x0, 0) auf (x1, y1) mit Breite w unten, Schein am Ziel */
  function cone(ctx, col, x0, x1, y1, w, a) {
    if (a < 0.005) return;
    const g = ctx.createLinearGradient(0, 0, 0, y1);
    g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${(a * 0.2).toFixed(3)})`);
    g.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a.toFixed(3)})`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - w * 0.08, 0);
    ctx.lineTo(x0 + w * 0.08, 0);
    ctx.lineTo(x1 + w, y1);
    ctx.lineTo(x1 - w, y1);
    ctx.closePath();
    ctx.fill();
    glow(ctx, col, x1, y1, w * 1.4, a * 1.2);
  }

  // f: Familie · c: Antwort (aus scenarios.js) · age (s) · e: Hülle 0..1 · out: { jump, hands } der Menge
  function draw(ctx, f, c, age, e, st, s, out) {
    const fn = L[f];
    if (!fn) return false;
    vw = st.vw;
    vh = st.vh;
    S = s;
    const a = (c.k ?? 1) * e;
    if (a < 0.004) return true;
    ctx.globalCompositeOperation = "lighter";
    fn(ctx, c, a, age, st, !!st.noFlash, out);
    ctx.globalAlpha = 1;
    return true;
  }
  return { draw, has: (f) => !!L[f] };
}

export { createSceneFx, VC as SCENE_COLORS };
