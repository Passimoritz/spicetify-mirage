// Lädt die ECHTEN Farbfunktionen aus src/ in Node: esbuild bündelt src/color.js, src/config.js und
// src/readability.js, die beiden Nachbarn mit Seiteneffekten (Staub, Brücke zum Overlay) werden leer ersetzt.
// Spicetify und das DOM gibt es hier nicht – ein paar Attrappen reichen, weil die Farbrechnung reine Mathematik ist.
const esbuild = require("esbuild");
const path = require("path");
const vm = require("vm");

const SRC = path.join(__dirname, "..", "..", "src");
const ENTRY = `
export { quantize, shape, FALLBACK, rgb2hsl, hsl2rgb } from "./color.js";
export { SCHEMES, buildScheme } from "./config.js";
export * as readability from "./readability.js";
`;
// dust.js und bridge.js starten beim Laden Zeichenflächen und Netzverbindungen – für die Farben unnötig.
// selectors.js zieht alle Übersetzungen nach; readability.js braucht daraus nur den Namen des Hauptbereichs.
const stubSideEffects = {
  name: "mirage-stubs",
  setup(build) {
    build.onResolve({ filter: /\/(dust|bridge|selectors).js$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
      contents: /dust/.test(a.path)
        ? "export const dust = { recolor() {} };"
        : /bridge/.test(a.path)
          ? "export const bridge = { sendTrack() {} };"
          : 'export const SEL = { mainView: ".Root__main-view, #main-view" };',
    }));
  },
};

async function loadTheme() {
  const out = await esbuild.build({
    stdin: { contents: ENTRY, resolveDir: SRC, sourcefile: "contrast-entry.js" },
    bundle: true,
    format: "cjs",
    target: "node20",
    write: false,
    legalComments: "none",
    logLevel: "silent",
    plugins: [stubSideEffects],
  });
  // „mirage-light“ entscheidet in shape() über helle oder dunkle Leitfarben – hier umschaltbar
  const state = { light: false };
  const el = () => ({ style: {}, append() {}, classList: { contains: () => false, toggle() {}, add() {}, remove() {} }, dataset: {} });
  const root = el();
  root.classList.contains = (c) => c === "mirage-light" && state.light;
  const document = {
    documentElement: root,
    head: el(),
    body: el(),
    createElement: el,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const sandbox = {
    module: { exports: {} },
    document,
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    performance: { now: () => 0 },
    // Beobachter und Zeitgeber laufen im Test nie an
    MutationObserver: class { observe() {} },
    setTimeout() {},
    clearTimeout() {},
    requestAnimationFrame() {},
    getComputedStyle: () => ({}),
    // leeres Spicetify: kein Schema vorgegeben, wie bei einer frischen Installation
    Spicetify: {},
    console,
  };
  sandbox.window = sandbox;
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(out.outputFiles[0].text, sandbox, { filename: "mirage-color-bundle.js" });
  const api = sandbox.module.exports;
  return {
    ...api,
    // Farben eines Covers (64 × 64 RGBA) wie im Theme: quantize() → shape()
    paletteOf(pixels, light) {
      state.light = !!light;
      const p = api.quantize(pixels);
      state.light = false;
      return p ? p.map((c) => Array.from(c)) : null;
    },
  };
}

module.exports = { loadTheme };
