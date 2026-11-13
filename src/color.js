import { S, hueGap, loadImage, lru } from "./core.js";
import { clamp, rgb2hsl, hsl2rgb, onGround, immersiveVars } from "./hsl.js";
import { schemePalette } from "./config.js";
import { dust } from "./dust.js";
import { bridge } from "./bridge.js";

/* ---------------------------------------------------------------- Farbe */
const hex2rgb = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Drei Leitfarben: A (Akzent), B (tiefer Partner), C (helles Licht) – auf dunklem Glas gut lesbar,
// beim hellen Schema dunkler. Fast farblose Cover (Schwarz-Weiß, Weiß) bekommen das Schema.
function shape(colors) {
  const [h1, s1] = rgb2hsl(colors[0]);
  const second = colors[1] ? rgb2hsl(colors[1]) : null;
  if (s1 < 0.08 && (!second || second[1] < 0.08)) return null;
  const gray = s1 < 0.12;
  const sec = second || [(h1 + 40) % 360, s1, 0.5];
  const light = document.documentElement.classList.contains("mirage-light");
  return onGround(
    [h1, gray ? s1 : clamp(s1, 0.5, 0.95)],
    [sec[0], gray ? sec[1] : clamp(sec[1], 0.45, 0.95)],
    [(h1 + 12) % 360, gray ? s1 : clamp(s1 * 0.8, 0.35, 0.85)],
    light,
  );
}

function quantize(data) {
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    e.r += r; e.g += g; e.b += b; e.n++;
    buckets.set(key, e);
  }
  const ranked = [...buckets.values()]
    .map((e) => {
      const rgb = [e.r / e.n, e.g / e.n, e.b / e.n].map(Math.round);
      const [h, s, l] = rgb2hsl(rgb);
      const lightOk = l > 0.12 && l < 0.92 ? 1 : 0.15;
      return { rgb, h, s, score: e.n * (0.2 + s * s * 2) * lightOk };
    })
    .sort((x, y) => y.score - x.score);
  if (!ranked.length) return null;
  const first = ranked[0];
  const partner = ranked.find((c) => hueGap(c.h, first.h) > 28 && c.s > 0.15) || null;
  return shape([first.rgb, partner?.rgb]);
}

// Ein Durchgang: Farben + kleines Hintergrundbild (verkleinert = billig zu verwischen)
// was beim letzten Farbauszug passiert ist – geht mit dem Diagnosebericht mit
const colorDiag = {};
// Ergebnis pro Cover merken: Zurückspringen oder Wiederholen rechnet nichts neu
const analysed = lru(50);
async function analyse(url, uri) {
  const key = url + "|" + document.documentElement.classList.contains("mirage-light");
  if (analysed.has(key)) return analysed.get(key);
  const res = await analyseFresh(url, uri);
  if (res.colors || res.haze) analysed.set(key, res);
  return res;
}
// Das Hintergrundbild wird hier EINMAL weichgezeichnet (64 px, billig). Vorher machte das
// filter: blur(60px) auf einer bildschirmgroßen Fläche – bei jedem Bild, auf der Grafikkarte.
function softHaze(src, light) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  // Sättigung und Helligkeit gleich mit einbacken – vorher rechnete das ein CSS-Filter in jedem Bild
  x.filter = light ? "blur(5px) saturate(2) brightness(1.35)" : "blur(5px) saturate(1.5) brightness(0.66)";
  // etwas größer zeichnen, damit die weichen Ränder außerhalb liegen
  x.drawImage(src, -8, -8, 80, 80);
  return c.toDataURL("image/jpeg", 0.9);
}
async function analyseFresh(url, uri) {
  const img = await loadImage(url, true);
  Object.assign(colorDiag, { url: url.slice(0, 60), img: !!img, err: "", via: "" });
  let colors = null, haze = null;
  if (img) {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(img, 0, 0, 64, 64);
      colors = quantize(x.getImageData(0, 0, 64, 64).data);
      haze = softHaze(c, document.documentElement.classList.contains("mirage-light"));
      colorDiag.via = colors ? "canvas" : "canvas-leer";
    } catch (e) {
      colorDiag.err = String(e && e.message);
    }
  }
  if (!colors) {
    try {
      const ex = await S.colorExtractor(uri);
      const a = hex2rgb(ex.VIBRANT) || hex2rgb(ex.PROMINENT);
      const b = hex2rgb(ex.DARK_VIBRANT) || hex2rgb(ex.DESATURATED);
      if (a) colors = shape([a, b]);
      if (a) colorDiag.via = "extractor";
    } catch (e) {
      colorDiag.err += " | extractor: " + String(e && e.message);
    }
  }
  return { colors, haze };
}

const FALLBACK = [[182, 156, 255], [124, 92, 255], [230, 222, 255]];
let current = null;
// Beim Songwechsel gleiten die Leinwand-Farben über 1,4 s ins neue Cover (CSS hat eigene Übergänge)
const PAL_FADE = 1400;
let palFrom = null, palT0 = 0;
function palette() {
  const to = current || schemePalette();
  if (!palFrom) return to;
  const f = (performance.now() - palT0) / PAL_FADE;
  if (f >= 1) {
    palFrom = null;
    return to;
  }
  const e = f * f * (3 - 2 * f);
  return to.map((c, i) => c.map((v, k) => Math.round(palFrom[i][k] + (v - palFrom[i][k]) * e)));
}
function startFade() {
  palFrom = palette().map((c) => c.slice());
  palT0 = performance.now();
}

// Farben in EINEM Schritt über ein eigenes <style> setzen: eine einzige Stilberechnung
// statt vieler Zwischenstufen – das war die Ursache für das Flackern beim Songwechsel.
const varSheet = document.createElement("style");
varSheet.id = "mirage-vars";
document.head.append(varSheet);
// hell oder dunkel beim letzten Schreiben: beim Wechsel ins helle Schema fehlten sonst die Immersiv-Farben
let wroteLight = false;
function setColors(next) {
  const light = document.documentElement.classList.contains("mirage-light");
  if (current && light === wroteLight && next.every((c, i) => c.every((v, j) => Math.abs(v - current[i][j]) < 3))) return;
  startFade();
  current = next;
  wroteLight = light;
  const [a, b, c] = next.map((x) => x.join(","));
  varSheet.textContent =
    `html:root{--m-a:rgb(${a});--m-a-rgb:${a};--m-b:rgb(${b});--m-b-rgb:${b};--m-c:rgb(${c});--m-c-rgb:${c};` +
    `--spice-button:rgb(${a});--spice-rgb-button:${a};--spice-button-active:rgb(${c});--spice-rgb-button-active:${c};` +
    // helles Schema: der Immersiv-Modus bleibt dunkel und braucht helle Leitfarben (user.css, #mirage-immersive)
    (light ? immersiveVars(next) : "") +
    "}";
  dust.recolor(next);
  bridge.sendTrack();
}
function clearColors() {
  if (current) startFade();
  current = null;
  varSheet.textContent = "";
  dust.recolor(null);
}

export { rgb2hsl, hsl2rgb, hex2rgb, shape, quantize, analyse, colorDiag, FALLBACK, current, palette, setColors, clearColors };
