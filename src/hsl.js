// Reine Farbrechnung ohne DOM und ohne Nachbarn: config.js braucht sie für helle Schemata,
// color.js für die Coverfarben – ein eigenes Modul, damit sich beide nicht gegenseitig laden.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const rgb2hsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hsl2rgb = ([h, s, l]) => {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};

// relative Leuchtdichte und Kontrast nach WCAG
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (x, y) => {
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
// Helligkeit so lange verschieben, bis die Farbe auf dem Hintergrund lesbar ist (mind. 4.5 : 1, große Schrift 3 : 1)
function readable([h, s, l], bg, step, min = 4.5) {
  let rgb = hsl2rgb([h, s, l]);
  for (let i = 0; i < 12 && contrast(rgb, bg) < min; i++) rgb = hsl2rgb([h, s, (l = clamp(l + step, 0.05, 0.95))]);
  return rgb;
}

// Grund, an dem die Leitfarben gemessen werden. Dunkel: die dunkle Schrift (#0b0a12), die AUF den Leitfarben
// liegt (Play-Knopf, Chips) – etwas heller als jeder Schema-Hintergrund, so stimmt beides.
const INK = [11, 10, 18];
const PAPER = [244, 241, 250];

// Drei Leitfarben aus Farbton und Sättigung: A (Akzent), B (tiefer Partner), C (helles Licht).
// hsA/hsB/hsC = [Farbton, Sättigung]; light = helles Schema (dunklere Leitfarben).
function onGround(hsA, hsB, hsC, light) {
  const bg = light ? PAPER : INK;
  const a = readable([hsA[0], hsA[1], light ? 0.42 : 0.68], bg, light ? -0.04 : 0.04);
  // B: 3 : 1 genügt (große Schrift, Symbole). Dunkel gemessen an der hellsten Kartenfläche der dunklen
  // Schemata (Abyss, #0a171d); hell am hellen Grund – sonst verschwand weiße Schrift auf gelbem B im Play-Knopf.
  const b = light ? readable([hsB[0], hsB[1], 0.4], PAPER, -0.04, 3) : readable([hsB[0], hsB[1], 0.52], [10, 23, 29], 0.04, 3);
  const c = readable([hsC[0], hsC[1], light ? 0.3 : 0.84], bg, light ? -0.04 : 0.04);
  return [a, b, c];
}

// Leitfarben eines hellen Schemas für dunklen Grund: der Immersiv-Modus ist in jedem Schema dunkel.
// Farbton und Sättigung bleiben, nur die Helligkeit wird so gesetzt, wie shape() es im dunklen Schema täte.
const darkGround = (pal) => {
  const hs = pal.map((c) => rgb2hsl(c).slice(0, 2));
  return onGround(hs[0], hs[1], hs[2], false);
};

// dieselben Farben als Variablen --m-ia/--m-ib/--m-ic (user.css setzt sie in #mirage-immersive als --m-a/b/c ein)
const immersiveVars = (pal) =>
  darkGround(pal)
    .map((c, i) => `--m-i${"abc"[i]}:rgb(${c.join(",")});--m-i${"abc"[i]}-rgb:${c.join(",")};`)
    .join("");

export { immersiveVars, clamp, rgb2hsl, hsl2rgb, lum, contrast, readable, onGround, darkGround };
