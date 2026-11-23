/* ---------------------------------------------------------------- Verspielter Stil: Anzeige-Schriften */
// Eine kleine, kuratierte Auswahl (Google Fonts, geladen erst mit dem verspielten Stil – fonts.js), je Rolle eine:
//   shout  Oswald           schmal und kräftig: Rufe, Knall, Großbuchstaben
//   round  Fredoka          rund und weich: Hüpfen, Party
//   serif  Playfair Display Ballade, Glühen, Liebe
//   mono   JetBrains Mono   schneller Rap, Tippen
//   wide   Unbounded        breit und technisch: Neon, Strom, Weltraum
//   marker Permanent Marker Pinselschrift – NUR einzelne Schlüsselwörter oder kurze Rufe (≤ 3 Wörter)
// Lesbarkeit geht vor: Schrift nur, wo sie die Schrift der Zeile (Latein, Kyrillisch, Griechisch) wirklich kann –
// sonst die normale Liedtext-Schrift; lange Zeilen bekommen höchstens eine ruhige Schrift; in jedem Fenster aus fünf
// Zeilen um die aktive Zeile stehen höchstens zwei verschiedene Anzeige-Schriften.
export const PFONTS = {
  shout: { fam: "Oswald", q: "Oswald:wght@500;700", stack: '"Oswald", "Arial Narrow", "Roboto Condensed", Impact', cov: ["latin", "latinext", "cyrillic"] },
  round: { fam: "Fredoka", q: "Fredoka:wght@500;700", stack: '"Fredoka", "Nunito", "Varela Round"', cov: ["latin", "latinext"] },
  serif: { fam: "Playfair Display", q: "Playfair+Display:ital,wght@0,700;0,900;1,700", stack: '"Playfair Display", "DM Serif Display", Georgia, serif', cov: ["latin", "latinext", "cyrillic"] },
  mono: { fam: "JetBrains Mono", q: "JetBrains+Mono:wght@700;800", stack: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace', cov: ["latin", "latinext", "cyrillic", "greek"] },
  wide: { fam: "Unbounded", q: "Unbounded:wght@500;700;900", stack: '"Unbounded", "Segoe UI Black", "Arial Black"', cov: ["latin", "latinext", "cyrillic"] },
  marker: { fam: "Permanent Marker", q: "Permanent+Marker", stack: '"Permanent Marker", "Segoe Print", "Comic Sans MS", cursive', cov: ["latin"] },
};
// Adresse für Google Fonts (eine Anfrage, display=swap: bis die Schrift da ist, steht die normale da)
export const PFONTS_URL = "https://fonts.googleapis.com/css2?" + Object.values(PFONTS).map((f) => "family=" + f.q).join("&") + "&display=swap";

// Schriften einer Zeile: latin (Latin-1), latinext (übriges Latein), cyrillic, greek, other (alles andere: CJK,
// Arabisch, Hebräisch, Devanagari, Thai …)
export function scriptsOf(text) {
  const out = new Set();
  for (const ch of String(text || "")) {
    if (!/\p{L}/u.test(ch)) continue;
    if (/\p{Script=Latin}/u.test(ch)) out.add(ch.codePointAt(0) <= 0xff || ch === "œ" || ch === "Œ" ? "latin" : "latinext");
    else if (/\p{Script=Cyrillic}/u.test(ch)) out.add("cyrillic");
    else if (/\p{Script=Greek}/u.test(ch)) out.add("greek");
    else out.add("other");
  }
  return out;
}
export function covers(role, text) {
  const f = PFONTS[role];
  if (!f) return false;
  const s = scriptsOf(text);
  if (!s.size) return false;
  for (const x of s) if (!f.cov.includes(x)) return false;
  return true;
}
// „lang“: ab hier nur noch ruhige Schrift (Zeichen bzw. Wörter)
export const LONG_CHARS = 42, LONG_WORDS = 8;
const CALM_ROLES = new Set(["serif", "mono"]);

// Rolle, die zu einer Zeile passt (ohne Fenster-Regel). f: { t (Rezept), text, n, shout, cues (Set), mood, ballad, rap,
// kind } · deckFonts: Rollen dieses Songs · level
export function lineRole(f, deckFonts, level) {
  if (level === "subtle" || !deckFonts?.length) return "";
  const has = (r) => deckFonts.includes(r);
  const long = f.n > LONG_WORDS || [...String(f.text)].length > LONG_CHARS;
  const want = [];
  if (f.rap || ["type", "typer", "magnet", "jitter"].includes(f.t)) want.push("mono");
  if (f.shout || ["caps", "slam", "stamp", "zoom", "punch"].includes(f.t)) want.push("shout");
  if (["glow", "fade", "curtain", "write", "neon"].includes(f.t) || f.ballad || f.cues?.has("beat") || f.cues?.has("bloom") || f.cues?.has("sultry")) want.push("serif");
  if (["bounce", "jelly", "hop", "bubble", "stretch", "squash"].includes(f.t) || f.cues?.has("bounce")) want.push("round");
  if (f.cues?.has("jolt") || f.cues?.has("neon") || f.cues?.has("float") || f.t === "glitch") want.push("wide");
  for (const r of want) {
    if (!has(r) || !covers(r, f.text)) continue;
    if (long && (!CALM_ROLES.has(r) || f.n > 12)) continue;
    return r;
  }
  return "";
}
// Pinselschrift: ein Schlüsselwort (≤ 12 Zeichen) – oder bei „Wild“ ein kurzer Ruf aus höchstens drei Wörtern
export function markerOk(text, words) {
  return words <= 3 && [...String(text)].length <= 18 && covers("marker", text);
}

// Fenster-Regel über den ganzen Song: fonts[i] = { line: Rolle, word: Rolle } → bereinigt (gleiche Form). In jedem
// Fenster aus fünf aufeinanderfolgenden Zeilen höchstens max verschiedene Anzeige-Schriften; dazu höchstens share
// (Anteil) aller Zeilen mit Anzeige-Schrift.
export function limitFonts(fonts, { max = 2, share = 0.45 } = {}) {
  const out = fonts.map((x) => ({ line: x?.line || "", word: x?.word || "" }));
  const n = out.length;
  let used = 0;
  const budget = Math.max(1, Math.floor(n * share));
  for (let i = 0; i < n; i++) {
    const cur = out[i];
    if (!cur.line && !cur.word) continue;
    const seen = new Set();
    for (let k = Math.max(0, i - 4); k < i; k++) {
      if (out[k].line) seen.add(out[k].line);
      if (out[k].word) seen.add(out[k].word);
    }
    const fits = (r) => !r || seen.has(r) || seen.size < max;
    if (!fits(cur.line)) cur.line = "";
    if (cur.line) seen.add(cur.line);
    if (!fits(cur.word)) cur.word = "";
    if ((cur.line || cur.word) && used >= budget) cur.line = cur.word = "";
    if (cur.line || cur.word) used++;
  }
  return out;
}
// Zahl verschiedener Anzeige-Schriften in jedem Fenster aus fünf Zeilen (für den Test)
export function windowFonts(fonts, at, r = 2) {
  const s = new Set();
  for (let k = Math.max(0, at - r); k <= Math.min(fonts.length - 1, at + r); k++) {
    if (fonts[k]?.line) s.add(fonts[k].line);
    if (fonts[k]?.word) s.add(fonts[k].word);
  }
  return s.size;
}
