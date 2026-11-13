// Test-Paletten für den Oberflächen-Prüfstand: vier künstliche Cover, durch den ECHTEN Farbauszug
// (src/color.js über tests/contrast/load-theme.js) geschickt – dunkel und hell getrennt, wie im Theme.
// Dazu die Schemafarben aus Mirage/color.ini (dunkel) und SCHEMES.Pearl (hell), so wie Spicetify
// bzw. applyScheme() sie als --spice-* und --spice-rgb-* setzen.
const fs = require("fs");
const path = require("path");
const { loadTheme } = require("../../tests/contrast/load-theme.js");

const N = 64;
// eigene Umrechnung, unabhängig vom geprüften Code
function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
// Cover aus drei Flächen (oben, Mitte, unten) mit weichem Übergang – ähnelt Fotos mehr als eine Vollfläche
function cover(c1, c2, c3) {
  const px = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const t = (y + x * 0.3) / (N * 1.3);
      const c = t < 0.45 ? c1 : t < 0.75 ? c2 : c3;
      const i = (y * N + x) * 4;
      px.set([...c, 255], i);
    }
  }
  return px;
}
const COVERS = {
  warm: cover(hsl(18, 0.85, 0.5), hsl(38, 0.9, 0.55), hsl(8, 0.6, 0.18)),
  cold: cover(hsl(205, 0.75, 0.45), hsl(185, 0.6, 0.55), hsl(225, 0.5, 0.15)),
  neon: cover(hsl(305, 1, 0.55), hsl(95, 1, 0.5), hsl(270, 0.8, 0.12)),
  pale: cover(hsl(30, 0.35, 0.86), hsl(350, 0.3, 0.82), hsl(40, 0.2, 0.7)),
};

function parseIni(file) {
  const out = {};
  let cur = null;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const sec = line.match(/^\[(.+)\]/);
    if (sec) out[(cur = sec[1])] = {};
    const kv = line.match(/^\s*([\w-]+)\s*=\s*([0-9a-fA-F]{6})/);
    if (cur && kv) out[cur][kv[1]] = kv[2];
  }
  return out;
}
const hexRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const spiceVars = (sc) =>
  Object.entries(sc)
    .filter(([k]) => k !== "light")
    .map(([k, v]) => `--spice-${k}:#${v};--spice-rgb-${k}:${hexRgb(v).join(",")};`)
    .join("");
// genau die Variablen, die color.js setColors() schreibt
const paletteVars = ([a, b, c]) => {
  const [A, B, C] = [a, b, c].map((x) => x.join(","));
  return (
    `--m-a:rgb(${A});--m-a-rgb:${A};--m-b:rgb(${B});--m-b-rgb:${B};--m-c:rgb(${C});--m-c-rgb:${C};` +
    `--spice-button:rgb(${A});--spice-rgb-button:${A};--spice-button-active:rgb(${C});--spice-rgb-button-active:${C};`
  );
};

async function build(repo) {
  const theme = await loadTheme();
  const ini = parseIni(path.join(repo, "Mirage", "color.ini"));
  const schemes = {
    dark: { name: "Mirage", light: false, vars: spiceVars(ini.Mirage) },
    light: { name: "Pearl", light: true, vars: spiceVars(theme.SCHEMES.Pearl || ini.Pearl) },
  };
  const palettes = {};
  for (const mode of ["dark", "light"]) {
    palettes[mode] = Object.entries(COVERS).map(([name, px]) => {
      const pal = theme.paletteOf(px, mode === "light") || theme.FALLBACK;
      return { name, pal, vars: paletteVars(pal), cover: [...px.slice(0, 3)] };
    });
  }
  return { schemes, palettes };
}

module.exports = { build };
