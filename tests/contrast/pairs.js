// Liest aus Mirage/user.css, welche Schrift- und Flächenfarben das Theme aus den Leitfarben baut.
// Bewusst aus der echten CSS-Datei statt aus einer handgepflegten Liste: ein neuer Knopf mit dunkler Schrift
// auf einer Akzentfläche wird damit von selbst mitgeprüft.

// --- WCAG 2.x: relative Leuchtdichte und Kontrast (eigene Rechnung, unabhängig vom Theme-Code)
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function contrast(x, y) {
  const a = lum(x), b = lum(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
// halbdurchsichtige Farbe [r, g, b, a] über einen deckenden Untergrund legen
const over = (c, base) => [0, 1, 2].map((k) => c[k] * (c[3] ?? 1) + base[k] * (1 - (c[3] ?? 1)));
const hexRgb = (h) => {
  h = h.replace("#", "");
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return h.length === 8 ? [...rgb, parseInt(h.slice(6, 8), 16) / 255] : rgb;
};
// Selektorliste an den Kommas der obersten Ebene trennen (nicht innerhalb von :is(…))
function splitSelectors(sel) {
  const out = [];
  let depth = 0, from = 0;
  for (let i = 0; i < sel.length; i++) {
    if (sel[i] === "(" || sel[i] === "[") depth++;
    else if (sel[i] === ")" || sel[i] === "]") depth--;
    else if (sel[i] === "," && !depth) {
      out.push(sel.slice(from, i).trim());
      from = i + 1;
    }
  }
  out.push(sel.slice(from).trim());
  return out;
}

// --- CSS in Regeln zerlegen (ohne Kommentare; @keyframes-Stufen sind keine Elemente)
function parseRules(css) {
  const rules = [];
  const re = /([^{};]+)\{([^{}]*)\}/g;
  let m;
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  while ((m = re.exec(css))) {
    const sel = m[1].trim().replace(/\s+/g, " ");
    if (/^(@|from$|to$|[\d.]+%)/.test(sel)) continue;
    const decl = {};
    for (const part of m[2].split(";")) {
      const i = part.indexOf(":");
      if (i > 0) decl[part.slice(0, i).trim()] = part.slice(i + 1).replace(/!important/g, "").replace(/\s+/g, " ").trim();
    }
    rules.push({ sel, decl });
  }
  return rules;
}

// Mindestkontrast: 4.5 für normale Schrift, 3 für große Schrift (ab 24 px oder 18.66 px fett) und für Symbole.
// Eine Regel gilt nur dann als groß/Symbol, wenn ALLE ihre Selektoren dazugehören.
const LARGE = /h1\b|\.m-im-title\b|\.m-im-line\b|\.m-g-time\b/;
const ICON =
  /playButton|play-button|control-button|svg\b|\.m-im-like\b|\.m-im-play\b|\.m-im-shuffle\b|\.m-im-sm\b|imagePlaceholder|\.m-im-cvbtn\b/;
function kindOf(sel) {
  const parts = splitSelectors(sel);
  if (parts.every((p) => LARGE.test(p))) return "large";
  if (parts.every((p) => ICON.test(p) || LARGE.test(p))) return "icon";
  return "text";
}
const NEED = { text: 4.5, large: 3, icon: 3 };

// Flächen, bei denen die Rechnung absichtlich nichts aussagt
const SKIP = [
  // Glanzlicht der Kugel: ein kleiner weißer Reflex am Rand, das Symbol sitzt in der Mitte auf der Farbe
  /\.m-orb-btn\b/,
];

const COLOR_TOKEN = /#[0-9a-f]{3,8}\b|rgba?\((?:[^()]|\([^()]*\))*\)|var\((?:[^()]|\([^()]*\))*\)|\btransparent\b|\bwhite\b|\bblack\b/gi;
const uses = (v) => /--m-[abc]\b|--m-[abc]-rgb|--spice-(rgb-)?button/.test(v || "");

// Regeln → Paare. „html.mirage-light X { … }“ überschreibt im hellen Schema die Regel X.
function pairsFromCss(css) {
  // gleiche Selektoren zusammenführen: Farbe und Fläche stehen öfter in zwei getrennten Regeln
  const bySel = new Map();
  for (const r of parseRules(css)) bySel.set(r.sel, { ...(bySel.get(r.sel) || {}), ...r.decl });
  const rules = [...bySel].map(([sel, decl]) => ({ sel, decl }));
  const lightFix = new Map();
  for (const r of rules) {
    for (const s of splitSelectors(r.sel)) {
      // auch „html.mirage-light[data-m-page="artist"] X“ für die Regel „html[data-m-page="artist"] X“
      const m = /^html\.mirage-light(\[[^\]]+\])?\s+(.+)$/.exec(s);
      const key = m && (m[1] ? `html${m[1]} ${m[2]}` : m[2]);
      if (m) lightFix.set(key, { ...(lightFix.get(key) || {}), ...r.decl });
    }
  }
  const out = [];
  for (const r of rules) {
    if (/mirage-light/.test(r.sel) || SKIP.some((p) => p.test(r.sel))) continue;
    for (const mode of ["dark", "light"]) {
      let d = r.decl;
      if (mode === "light") for (const s of splitSelectors(r.sel)) if (lightFix.has(s)) d = { ...d, ...lightFix.get(s) };
      const fg = d.color || d.fill || "";
      const bg = d.background || d["background-color"] || d["background-image"] || "";
      if (!fg || (!uses(fg) && !uses(bg))) continue;
      // Farbverlauf ALS Schrift (background-clip: text): die Verlaufsfarben sind die Schriftfarbe
      const clip = /text/.test(d["background-clip"] || d["-webkit-background-clip"] || "") && /transparent/.test(fg);
      if (fg === "transparent" && !clip) continue;
      const opacity = /^[\d.]+$/.test(d.opacity || "") ? Number(d.opacity) : 1;
      const short = r.sel.length > 84 ? r.sel.slice(0, 81) + "…" : r.sel;
      out.push({
        mode,
        sel: r.sel,
        id: short + "  {" + (clip ? "Verlaufsschrift " + bg : fg + (bg ? " auf " + bg : "")).slice(0, 90) + "}",
        fg: clip ? bg : fg,
        bg: clip ? "" : bg,
        opacity,
        kind: kindOf(r.sel),
      });
    }
  }
  return out;
}

// Eigene Variablen (z. B. --m-ink) aus :root, html.mirage-light und html.mirage-light #mirage-immersive.
// Die Leitfarben --m-a/b/c kommen nicht von hier, sondern aus dem Farbauszug (env.pal).
// imRemap: user.css gibt dem Immersiv-Modus im hellen Schema eigene Leitfarben (darkGround in src/hsl.js).
const IM_LIGHT = "html.mirage-light #mirage-immersive";
function varsFromCss(css) {
  const out = { dark: {}, light: {}, im: {}, imRemap: false };
  for (const r of parseRules(css)) {
    for (const s of splitSelectors(r.sel)) {
      const into = s === ":root" ? [out.dark, out.light, out.im] : s === "html.mirage-light" ? [out.light, out.im] : s === IM_LIGHT ? [out.im] : [];
      for (const [k, v] of Object.entries(r.decl)) {
        if (!k.startsWith("--")) continue;
        if (/^--m-[abc](-rgb)?$/.test(k)) {
          if (s === IM_LIGHT && k === "--m-a") out.imRemap = true;
          continue;
        }
        for (const o of into) o[k] = v;
      }
    }
  }
  return out;
}

// Einen Farbausdruck mit den aktuellen Variablen auflösen → [r, g, b, a] oder null (unbekannt/durchsichtig)
function resolve(token, env) {
  token = token.trim();
  if (/^transparent$/i.test(token)) return null;
  if (/^white$/i.test(token)) return [255, 255, 255, 1];
  if (/^black$/i.test(token)) return [0, 0, 0, 1];
  if (token[0] === "#") {
    const c = hexRgb(token);
    return [c[0], c[1], c[2], c[3] ?? 1];
  }
  const v = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(token);
  if (v) {
    const m = /^--m-([abc])$/.exec(v[1]);
    if (m) return [...env.pal["abc".indexOf(m[1])], 1];
    const s = /^--spice-(?!rgb-)([\w-]+)$/.exec(v[1]);
    // --spice-button und --spice-button-active setzt setColors() auf die Leitfarben A und C
    if (s && s[1] === "button") return [...env.pal[0], 1];
    if (s && s[1] === "button-active") return [...env.pal[2], 1];
    if (s && env.scheme[s[1]]) return [...hexRgb(env.scheme[s[1]]), 1];
    if (env.vars?.[v[1]] != null && env.vars[v[1]] !== token) return resolve(env.vars[v[1]], env);
    return v[2] ? resolve(v[2], env) : null;
  }
  const f = /^rgba?\((.*)\)$/i.exec(token);
  if (f) {
    const inner = f[1]
      .replace(/var\(\s*--m-([abc])-rgb[^)]*\)/g, (_, k) => env.pal["abc".indexOf(k)].join(","))
      .replace(/var\(\s*--spice-rgb-([\w-]+)\s*\)/g, (all, k) =>
        k === "button" ? env.pal[0].join(",") : k === "button-active" ? env.pal[2].join(",") : env.scheme[k] ? hexRgb(env.scheme[k]).join(",") : all,
      );
    if (/var\(/.test(inner)) return null;
    const n = inner.split(/[\s,/]+/).filter(Boolean).map((x) => (x.endsWith("%") ? parseFloat(x) / 100 : Number(x)));
    return n.length >= 3 && n.every(Number.isFinite) ? [n[0], n[1], n[2], n[3] ?? 1] : null;
  }
  return null;
}

// Alle Farben eines Ausdrucks. Bei Verläufen kommen Zwischenstufen dazu: die Mitte zwischen zwei bunten Farben
// kann dunkler sein als beide Enden (Rot → Grün läuft durch ein dunkles Oliv).
// Mehrere Hintergrund-Ebenen (Komma auf oberster Ebene) liegen übereinander und werden nicht ineinander
// gemischt – Zwischenstufen nur innerhalb EINES Verlaufs.
function colorsOf(value, env) {
  const layers = splitSelectors(value);
  if (layers.length > 1) return layers.flatMap((l) => colorsOf(l, env));
  const tokens = (value.match(COLOR_TOKEN) || []).map((t) => resolve(t, env)).filter(Boolean);
  if (!/gradient\(/.test(value) || tokens.length < 2) return tokens;
  const out = [];
  tokens.forEach((c, i) => {
    out.push(c);
    const n = tokens[i + 1];
    if (n) for (const f of [0.25, 0.5, 0.75]) out.push(c.map((x, k) => x + (n[k] - x) * f));
  });
  return out;
}

// Deckende Untergründe, auf denen eine Regel liegen kann
function surfaces(sel, env) {
  // der Immersiv-Modus hat in JEDEM Schema seinen eigenen dunklen Grund (#mirage-immersive { background: #07060c })
  if (/#mirage-immersive/.test(sel)) return [[7, 6, 12]];
  return ["main", "card"].map((k) => hexRgb(env.scheme[k]));
}

// Schlechtester Kontrast eines Paars in einer Umgebung { pal, scheme }
function worst(pair, env) {
  // helles Schema im Immersiv-Modus: dort gelten die Leitfarben und Variablen für dunklen Grund
  if (env.im && /#mirage-immersive/.test(pair.sel)) env = env.im;
  let min = Infinity;
  for (const s of surfaces(pair.sel, env)) {
    const bgs = pair.bg ? colorsOf(pair.bg, env).map((c) => over(c, s)) : [];
    if (!bgs.length) bgs.push(s);
    for (const f of colorsOf(pair.fg, env)) {
      for (const b of bgs) {
        const ratio = contrast(over([f[0], f[1], f[2], f[3] * pair.opacity], b), b);
        if (ratio < min) min = ratio;
      }
    }
  }
  return min;
}

module.exports = { pairsFromCss, varsFromCss, worst, contrast, lum, hexRgb, NEED, parseRules };
