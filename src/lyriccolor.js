/* ---------------------------------------------------------------- Verspielter Stil: Farben aus der Bedeutung */
// Feuer warm orange → rot, Kälte eisblau, Geld gold, Liebe rosa, Nacht entsättigtes Violett, Natur grün, Strom/Neon
// cyan … – leicht zum Cover gemischt (Leitfarbe A) und mit der Farbstimmung des Song-Decks verschoben. Jede Farbe wird
// danach so lange aufgehellt, bis sie auf dem dunklen Liedtext-Grund mindestens 4,5 : 1 erreicht (WCAG AA für
// normale Schrift) – gegen den Grund des Immersiv-Modus UND gegen einen vom Cover aufgehellten Grund.
// Rein rechnend (kein DOM): immersive.js setzt das Ergebnis als --pc-<art> an die Textfläche, sobald sich die
// Leitfarben ändern. Getestet in tests/unit/lyricstyle.test.js über viele Cover-Paletten.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// [Farbton, Sättigung, Helligkeit] (HSL, 0 … 360 / 0 … 1), zweite Farbe = Verlauf (nur ohne Karaoke-Füllung)
export const KINDS = {
  fire: [[24, 0.95, 0.6], [4, 0.9, 0.64]],
  warm: [[36, 0.9, 0.64]],
  ice: [[196, 0.85, 0.78]],
  water: [[206, 0.8, 0.7]],
  gold: [[45, 0.95, 0.6], [32, 0.9, 0.66]],
  love: [[335, 0.85, 0.74]],
  dark: [[265, 0.3, 0.76]],
  nature: [[128, 0.55, 0.64]],
  neon: [[182, 1, 0.6], [292, 0.95, 0.74]],
  sky: [[208, 0.7, 0.8]],
  light: [[52, 0.9, 0.82]],
  rage: [[2, 0.85, 0.66]],
  dream: [[276, 0.6, 0.8]],
  // Krieg, Blut: dunkles Rot – lesbar aufgehellt wie alle (kein Splatter, nur die Farbe)
  blood: [[352, 0.82, 0.6]],
  // Klinge: Stahl, kühles Grau
  steel: [[210, 0.18, 0.8]],
  party: [[0, 0, 0]], // aus der Leitfarbe des Covers
};
// Wortbild → Farbe
export const CUE_KIND = {
  flame: "fire", heat: "warm", burst: "fire", drip: "water", wave: "water", shiver: "ice", snow: "ice",
  glint: "gold", power: "gold", star: "light", shine: "light", beat: "love", sultry: "love", bloom: "nature",
  dim: "dark", droop: "dark", crack: "dark", hush: "dream", drift: "dream", jolt: "neon", neon: "neon",
  float: "sky", shake: "rage", bounce: "party", dash: "party", spin: "party",
  // Kategorien (lyricstyle.js, CATEGORY_FX): Gewalt nur in Farbe und Bewegung, nie drastisch
  war: "blood", shatter: "blood", shot: "rage", rapid: "rage", slash: "steel", zoomby: "party", prowl: "nature", savor: "warm",
  glitchy: "neon", kick: "party",
};
// Liedtext-Grund: Immersiv-Grund (#07060c) und derselbe, vom Cover aufgehellt (Leitfarben A/B zu je 18 %)
export const LYR_BG = [7, 6, 12];
export function lyricGrounds(pal) {
  const [a, b] = pal || [];
  const out = [LYR_BG];
  if (a && b) out.push(LYR_BG.map((v, i) => v + (a[i] * 0.18 + b[i] * 0.18)));
  return out.map((c) => c.map((v) => clamp(v, 0, 255)));
}

export function rgb2hsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hsl2rgb([h, s, l]) {
  h = (((h % 360) + 360) % 360) / 360;
  if (!s) return [l, l, l].map((v) => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(clamp(v, 0, 1) * 255));
}
export const lum = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrast = (x, y) => {
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
// Farbtöne mischen (kürzester Weg auf dem Farbkreis)
const mixHue = (a, b, w) => {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * w;
};
// Eine Farbe lesbar machen: Helligkeit anheben, bis sie auf allen Gründen ≥ need erreicht
export function readable(hsl, grounds, need = 4.6) {
  let [h, s, l] = hsl;
  for (let k = 0; k < 40; k++) {
    const c = hsl2rgb([h, s, l]);
    if (grounds.every((g) => contrast(c, g) >= need)) return c;
    l = Math.min(1, l + 0.025);
    // ganz oben hilft nur noch weniger Sättigung (reines Gelb/Cyan sind schon hell, reines Blau nicht)
    if (l >= 0.97) s *= 0.85;
  }
  return [245, 243, 255];
}
// Farbkreis des ♪: die Leitfarben des Covers, kräftig und lesbar (≥ 5 : 1, damit auch die Mischung zweier Nachbarn
// über 4,5 bleibt). Graue Cover bekommen einen Hauch Farbe aus der ersten Leitfarbe
export function noteRing(pal) {
  const grounds = lyricGrounds(pal);
  const src = pal?.length ? pal : [[124, 92, 255]];
  return src.map((c) => {
    const [h, s, l] = rgb2hsl(c);
    return readable([h, Math.max(0.55, s), clamp(l, 0.6, 0.8)], grounds, 5);
  });
}
// Alle Farben einer Palette:{ fire: [r,g,b], fire2: …, … }. pal: Leitfarben [[r,g,b] ×3], grade: { hue, sat } aus
// dem Deck. Mischung zur Leitfarbe: höchstens 8 % (je bunter das Cover, desto mehr) – Feuer bleibt orange, Gold bleibt gold
export function meaningColors(pal, grade = { hue: 0, sat: 1 }) {
  const grounds = lyricGrounds(pal);
  const A = pal?.[0] ? rgb2hsl(pal[0]) : [265, 0.6, 0.7];
  const w = clamp(A[1], 0, 1) * 0.08;
  const out = {};
  for (const [kind, stops] of Object.entries(KINDS)) {
    stops.forEach((st, i) => {
      let hsl;
      if (kind === "party") hsl = [A[0] + grade.hue, clamp(Math.max(A[1], 0.55), 0, 1), 0.68];
      else hsl = [mixHue(st[0], A[0], w) + grade.hue * 0.5, clamp(st[1] * grade.sat, 0, 1), st[2]];
      out[kind + (i ? "2" : "")] = readable(hsl, grounds);
    });
  }
  return out;
}
// → CSS-Variablen für die Textfläche ("r g b" für rgb(var(--pc-x)) und rgb(var(--pc-x) / 0.34))
export function colorVars(cols) {
  const v = {};
  for (const [k, c] of Object.entries(cols)) v["--pc-" + k] = c.join(" ");
  return v;
}
// Dieselben Variablen als Stilregel nur für die Elemente, die sie lesen (Zeilen mit Farbe .is-pk, Wörter mit Farbe .is-k).
// Leistung: an der Textfläche gesetzt, ließ jeder Palettenwechsel (Songwechsel) den ganzen Liedtext neu berechnen
// (Liedtext-Messung: 2 200 Elemente, ~40 ms in einem Bild); eine geänderte Regel trifft nur die farbigen Zeilen und Wörter.
export function colorRule(cols, scope = "#mirage-immersive .m-im-lyrics") {
  const decl = Object.entries(colorVars(cols)).map(([k, v]) => `${k}: ${v};`).join(" ");
  return `${scope} .m-im-line.is-pk, ${scope} .m-w.is-k { ${decl} }`;
}
