/* ---------------------------------------------------------------- Canvas-Fokus (Einstellung, Standard aus) */
// Canvas-Videos sind Hochformat (9:16). Im runden bzw. quadratischen Cover und hinter dem Liedtext zeigt
// „object-fit: cover“ nur einen Ausschnitt – mittig geschnitten fällt ein Motiv oben im Bild oft heraus.
// Ist cfg.canvasFocus an, suchen wir je Video EINMAL das Motiv und richten den Ausschnitt danach aus (fester Fokus,
// kein Mitfahren): ein paar Bilder in ein winziges Vorschaubild zeichnen und je Bildpunkt bewerten –
//   Hautton (YCbCr-Bereich), Details (Helligkeitskanten), etwas Bewegung zwischen den Bildern, dazu eine sanfte
//   Vorliebe für die Mitte und das obere Drittel.
// Der gewichtete Schwerpunkt der stärksten Punkte wird zum Fokus; ist das Motiv kompakt, kommt ein leichter Zoom
// dazu. Keine Bibliothek, kein Download, nichts verlässt den Rechner: einmal je Song ein paar Millisekunden.
const W = 48, H = 85; // Seitenverhältnis 9:16
const cache = new Map(); // src → { fx, fy, zoom } (0–1 im ganzen Videobild)
const CENTER = { fx: 0.5, fy: 0.5, zoom: 1 };

let cv = null, cx = null;
function grab(video) {
  cv ||= Object.assign(document.createElement("canvas"), { width: W, height: H });
  cx ||= cv.getContext("2d", { willReadFrequently: true });
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  // auf 9:16 bringen (falls es doch anders ist: mittig einpassen wie „cover“)
  const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
  cx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return cx.getImageData(0, 0, W, H).data;
}

const lumAt = (d, p) => 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
// Bewertung je Bildpunkt aus mehreren Bildern
function score(frames) {
  const n = W * H, sc = new Float32Array(n), skin = new Float32Array(n);
  for (let f = 0; f < frames.length; f++) {
    const d = frames[f], prev = frames[f - 1];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x, p = i * 4;
        const r = d[p], g = d[p + 1], b = d[p + 2];
        const Y = lumAt(d, p);
        const cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b, cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;
        const isSkin = Y > 45 && cb > 77 && cb < 127 && cr > 135 && cr < 175 ? 1 : 0;
        // Kanten: Helligkeitsunterschied zu den Nachbarn
        const gx = Math.abs(lumAt(d, p + 4) - lumAt(d, p - 4)), gy = Math.abs(lumAt(d, p + W * 4) - lumAt(d, p - W * 4));
        const edge = Math.min(1, (gx + gy) / 90);
        const motion = prev ? Math.min(1, Math.abs(Y - lumAt(prev, p)) / 60) : 0;
        skin[i] += isSkin;
        sc[i] += isSkin * 1.6 + edge * 0.7 + motion * 0.5;
      }
    }
  }
  // Vorliebe: waagerecht zur Mitte, senkrecht zum oberen Drittel (sanft – ein klares Motiv gewinnt trotzdem)
  for (let y = 0; y < H; y++) {
    const vy = 1 - Math.min(1, Math.abs(y / H - 0.38) * 1.4) * 0.45;
    for (let x = 0; x < W; x++) sc[y * W + x] *= vy * (1 - Math.min(1, Math.abs(x / W - 0.5) * 2) * 0.35);
  }
  return { sc: blur(sc), skin: blur(skin) };
}
// 5 × 5-Kastenweichzeichner: einzelne Pixel (Rauschen, Schrift) zählen weniger als zusammenhängende Flächen
function blur(a) {
  const o = new Float32Array(a.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          s += a[yy * W + xx];
          c++;
        }
      }
      o[y * W + x] = s / c;
    }
  }
  return o;
}

// Schwerpunkt der stärksten 12 % und wie kompakt sie liegen → Fokus und Zoom
function focusFrom({ sc, skin }) {
  const sorted = Float32Array.from(sc).sort();
  const cut = sorted[Math.floor(sorted.length * 0.88)], max = sorted[sorted.length - 1];
  // flaches Bild (kaum Unterschiede): mittig lassen
  if (!(max > 0) || max - cut < max * 0.08) return CENTER;
  let sx = 0, sy = 0, sw = 0, skinW = 0;
  for (let i = 0; i < sc.length; i++) {
    if (sc[i] < cut) continue;
    const w = sc[i] - cut;
    sx += (i % W) * w;
    sy += Math.floor(i / W) * w;
    sw += w;
    skinW += skin[i] * w;
  }
  if (!sw) return CENTER;
  const fx = sx / sw / (W - 1), fy = sy / sw / (H - 1);
  let spread = 0;
  for (let i = 0; i < sc.length; i++) {
    if (sc[i] < cut) continue;
    const dx = (i % W) / (W - 1) - fx, dy = Math.floor(i / W) / (H - 1) - fy;
    spread += (sc[i] - cut) * Math.hypot(dx, dy * (H / W));
  }
  spread /= sw;
  // kompakt (und hautfarben): etwas näher heran; verstreut: nur verschieben
  const zoom = spread < 0.22 ? (skinW / sw > 0.25 ? 1.22 : 1.12) : spread < 0.32 ? 1.06 : 1;
  return { fx, fy, zoom };
}

// Fokus für ein laufendes Video bestimmen (4 Bilder über ~2 s verteilt); Ergebnis je Quelle gemerkt
async function measure(video) {
  const src = video.currentSrc || video.src;
  if (cache.has(src)) return cache.get(src);
  const frames = [];
  for (const ms of [120, 600, 600, 700]) {
    await new Promise((r) => setTimeout(r, ms));
    if ((video.currentSrc || video.src) !== src || video.paused) break;
    try {
      const d = grab(video);
      if (d) frames.push(Uint8ClampedArray.from(d));
    } catch {
      // fremde Quelle ohne CORS (direkte MP4): Pixel nicht lesbar – mittig lassen
      break;
    }
  }
  if (frames.length < 2) return CENTER;
  const f = focusFrom(score(frames));
  cache.set(src, f);
  if (cache.size > 30) cache.delete(cache.keys().next().value);
  return f;
}

// object-position zählt in Prozent des ÜBERSTANDS: der Fokus soll in der Mitte des sichtbaren Ausschnitts liegen.
// Sichtbar ist (bei „cover“) der Anteil a der langen Seite: pos = (f − a/2) / (1 − a). Das hängt von der Fläche ab
// (rundes Cover 1:1, Liedtext-Hintergrund 16:9) – darum je Element aus den Seitenverhältnissen gerechnet.
function applyFocus(video, f, zoomed) {
  const va = (video.videoWidth || 9) / (video.videoHeight || 16), ca = (video.clientWidth || 1) / (video.clientHeight || 1);
  const pos = (v, a) => Math.round(Math.min(1, Math.max(0, (v - a / 2) / (1 - a))) * 100);
  const tall = ca > va; // Fläche breiter als das Video: oben/unten wird abgeschnitten
  const [px, py] = tall ? [50, pos(f.fy, va / ca)] : [pos(f.fx, ca / va), 50];
  video.style.objectPosition = `${px}% ${py}%`;
  if (!zoomed) return;
  // Zoom um das Motiv: Ursprung = Lage des Motivs im sichtbaren Ausschnitt
  const a = tall ? va / ca : 1, b = tall ? 1 : ca / va;
  const oy = Math.round(((f.fy - (py / 100) * (1 - a)) / a) * 100), ox = Math.round(((f.fx - (px / 100) * (1 - b)) / b) * 100);
  video.style.transformOrigin = `${ox}% ${oy}%`;
  video.style.scale = f.zoom > 1 ? String(f.zoom) : "";
}
function resetFocus(video) {
  if (!video) return;
  delete video.dataset.focusFor;
  video.style.objectPosition = video.style.transformOrigin = video.style.scale = "";
}

// Einstieg: Video läuft (neue Quelle) → messen und den Ausschnitt weich dorthin gleiten lassen
async function focusCanvas(video, zoomed) {
  const src = video.currentSrc || video.src;
  if (video.dataset.focusFor === src) return;
  video.dataset.focusFor = src;
  if (cache.has(src)) return applyFocus(video, cache.get(src), zoomed);
  video.style.objectPosition = video.style.transformOrigin = video.style.scale = "";
  const f = await measure(video);
  // nicht messbar (pausiert, Quelle gewechselt): beim nächsten Abspielen noch einmal
  if (!cache.has(src)) delete video.dataset.focusFor;
  if ((video.currentSrc || video.src) === src && video.dataset.focusFor === src) applyFocus(video, f, zoomed);
}

export { focusCanvas, resetFocus, focusFrom, score };
