// Prüft, ob die Selektoren des Themes im Spotify-Client noch etwas treffen. Liest nur Dateien.
//   npm run check:selectors                       installiertes Spotify (von Spicetify entpackt)
//   node tools/check-selectors.js --xpui <Ordner> --cssmap <css-map.json>
// Mit --cssmap wird ein frisch entpackter Client geprüft: Spicetifys Namensliste sagt, welche lesbaren Namen
// (main-trackList-…) es für die Zufallsnamen dieser Version gibt.
// Ende mit Code 1, wenn eine Regel oder ein Eintrag aus SEL gar nichts mehr trifft und nicht in KNOWN steht.
const fs = require("fs"), path = require("path");

const arg = (name) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1] : "";
};
const repo = path.join(__dirname, "..");
const xpui = arg("xpui") || path.join(process.env.APPDATA || "", "Spotify", "Apps", "xpui");
if (!fs.existsSync(xpui)) {
  console.log("Spotify nicht gefunden (" + xpui + "), nichts zu prüfen.");
  process.exit(0);
}

// alles, was der Client an Text mitbringt – ohne das, was Mirage selbst hineinlegt
let hay = "";
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(css|js)$/.test(f.name) && !/^(theme\.js|user\.css|colors\.css)$/.test(f.name) && !/extensions/.test(p)) hay += fs.readFileSync(p, "utf8") + "\n";
  }
})(xpui);
const cssmap = arg("cssmap");
if (cssmap) {
  const map = JSON.parse(fs.readFileSync(cssmap, "utf8"));
  let n = 0;
  for (const [hash, name] of Object.entries(map)) {
    if (!hay.includes(hash)) continue;
    hay += " " + name;
    n++;
  }
  console.log(`Namensliste: ${n} von ${Object.keys(map).length} Namen gibt es in dieser Version`);
}

// eigene Klassen von Mirage und Zustände gehören nicht zu Spotify
const OWN = /^(m|is|has|mirage|tabs)-|^mirage/i;
const dead = (token) => !OWN.test(token) && !/^\d/.test(token) && !hay.includes(token);
function tokens(selector) {
  const cls = [...selector.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((m) => m[1]);
  const att = [...selector.matchAll(/\[(?:data-testid|data-encore-id)[*^$~|]?=["']?([^"'\]]+)/g)].map((m) => m[1]);
  return [...cls, ...att];
}
const parts = (selector) => selector.split(/,(?![^()]*\))/).map((s) => s.trim()).filter(Boolean);

// Bekannt und hingenommen: trifft in aktuellen Versionen nichts, ist aber nur Zierde
const KNOWN = [".main-shelf-header a:hover h2, .main-shelf-title:hover"];

/* ---- Regeln im Stylesheet */
const css = fs.readFileSync(path.join(repo, "Mirage", "user.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
const gone = [];
let partly = 0, rules = 0;
for (const m of css.matchAll(/([^{}]+)\{/g)) {
  const sel = m[1].trim();
  if (!sel || sel.startsWith("@") || /^(from|to|\d+(\.\d+)?%)/.test(sel)) continue;
  rules++;
  const ps = parts(sel);
  const bad = ps.map((p) => tokens(p).filter(dead));
  const n = bad.filter((b) => b.length).length;
  if (!n) continue;
  if (n < ps.length) {
    partly++;
    continue;
  }
  const flat = sel.replace(/\s+/g, " ");
  if (KNOWN.includes(flat)) continue;
  const line = css.slice(0, m.index).split("\n").length + (m[1].match(/^\s*/)[0].split("\n").length - 1);
  gone.push(`user.css:${line}  ${flat.slice(0, 160)}\n      fehlt: ${[...new Set(bad.flat())].join(", ")}`);
}

/* ---- Einträge in SEL (src/selectors.js) */
const src = fs.readFileSync(path.join(repo, "src", "selectors.js"), "utf8");
const body = src.slice(src.indexOf("const SEL = {") + 12, src.indexOf("};", src.indexOf("const SEL = {")) + 1);
const SEL = new Function("return " + body)();
for (const [key, sel] of Object.entries(SEL)) {
  const ps = parts(sel);
  if (ps.every((p) => tokens(p).some(dead))) gone.push(`SEL.${key}  ${sel.slice(0, 160)}`);
}

console.log(`${rules} Regeln geprüft · ${partly} mit einzelnen veralteten Zweitnamen · ${gone.length} ohne Wirkung`);
if (gone.length) {
  console.log("\nOhne Wirkung:\n" + gone.map((g) => "  " + g).join("\n"));
  process.exit(1);
}
console.log("Alle Regeln treffen noch etwas.");
