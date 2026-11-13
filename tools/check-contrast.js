// Lesbarkeit bei jedem Cover: erzeugt über 2.000 künstliche Cover, schickt ihre Pixel durch den ECHTEN Farbauszug
// (src/color.js) und rechnet für jedes Farbpaar aus Mirage/user.css den WCAG-Kontrast nach.
// Aufruf: npm run check:contrast   (--strict: auch bekannte Schwächen lassen den Lauf scheitern,
//                                   --all: jedes Paar auflisten, --known: bekannte Schwächen ausführlich, --update-known: Liste der bekannten Schwächen neu schreiben)
//
// Warum Node mit esbuild und nicht ein Electron-Fenster: Der Farbauszug ist reine Rechnung auf 64 × 64 Pixeln.
// Gebündelt wird derselbe Quelltext, der auch im Theme landet – nur Spicetify und das DOM sind Attrappen.
// Ein Fenster würde zusätzlich nur das Verkleinern des Bildes durch Chromium prüfen, wäre aber langsamer
// und je nach Grafikkarte nicht auf das Bit gleich. Die Cover entstehen deshalb gleich in 64 × 64.
const fs = require("fs");
const path = require("path");
const { loadTheme } = require("../tests/contrast/load-theme.js");
const { covers } = require("../tests/contrast/covers.js");
const { pairsFromCss, varsFromCss, worst, contrast, lum, hexRgb, NEED } = require("../tests/contrast/pairs.js");

const ROOT = path.join(__dirname, "..");
const KNOWN_FILE = path.join(ROOT, "tests", "contrast", "known.json");
const args = new Set(process.argv.slice(2));
const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const fmt = (r) => r.toFixed(2) + " : 1";

// feste Paare je Schema: Schrift und Nebenschrift auf allen Flächen des Schemas
const SCHEME_PAIRS = [];
for (const fg of ["text", "subtext"]) {
  for (const bg of ["main", "main-elevated", "highlight", "highlight-elevated", "sidebar", "player", "card", "tab-active"]) {
    SCHEME_PAIRS.push({ fg, bg, kind: "text" });
  }
}

async function main() {
  const theme = await loadTheme();
  const css = fs.readFileSync(path.join(ROOT, "Mirage", "user.css"), "utf8");
  const pairs = pairsFromCss(css);
  const vars = varsFromCss(css);
  // Umgebung einer Messung: Leitfarben, Schema, eigene Variablen; im hellen Schema dazu die des Immersiv-Modus
  const envOf = (pal, sc, mode) => ({
    pal,
    scheme: sc,
    vars: vars[mode],
    im: mode === "light" && vars.imRemap ? { pal: theme.darkGround(pal), scheme: sc, vars: vars.im } : null,
  });
  const list = covers();
  const schemes = Object.entries(theme.SCHEMES).map(([name, sc]) => ({ name, sc, light: name === "Pearl" || !!sc.light }));

  // key → { need, kind, n, fails, min, where }
  const stats = new Map();
  const note = (key, kind, ratio, where) => {
    let s = stats.get(key);
    if (!s) stats.set(key, (s = { kind, need: NEED[kind], n: 0, fails: 0, min: Infinity, where: "" }));
    s.n++;
    if (ratio < s.need) s.fails++;
    if (ratio < s.min) {
      s.min = ratio;
      s.where = where;
    }
  };

  // 1) Schemafarben ohne Cover (Coverfarben aus, graues Cover, Playlist mit festem Schema)
  for (const { name, sc, light } of schemes) {
    const mode = light ? "light" : "dark";
    for (const p of SCHEME_PAIRS) {
      note(`${mode} | Schema: ${p.fg} auf ${p.bg}`, p.kind, contrast(hexRgb(sc[p.fg]), hexRgb(sc[p.bg])), `Schema ${name}`);
    }
    const pal = [sc.button, sc.notification, sc["button-active"]].map(hexRgb);
    for (const p of pairs) {
      if (p.mode === mode) note(`${mode} | ${p.id}`, p.kind, worst(p, envOf(pal, sc, mode)), `Schema ${name} ohne Cover, Leitfarben ${pal.map(hex).join(" ")}`);
    }
  }

  // 2) jedes Cover in jedem Schema
  let gray = 0, colored = 0;
  for (const cover of list) {
    for (const light of [false, true]) {
      const pal = theme.paletteOf(cover.px, light);
      // fast farblos: das Theme nimmt dann die Schemafarben – oben schon geprüft
      if (!pal) {
        gray++;
        continue;
      }
      colored++;
      const mode = light ? "light" : "dark";
      for (const { name, sc, light: l } of schemes) {
        if (l !== light) continue;
        const env = envOf(pal, sc, mode);
        for (const p of pairs) {
          if (p.mode === mode) note(`${mode} | ${p.id}`, p.kind, worst(p, env), `Cover „${cover.name}“, Schema ${name}, Leitfarben ${pal.map(hex).join(" ")}`);
        }
      }
    }
  }

  // 3) Lesbarkeits-Wächter (src/readability.js): die gewählte Ersatzfarbe muss auf jedem Hintergrund lesbar sein
  const guard = guardCheck(theme, schemes, list);

  // --- Bericht
  const known = fs.existsSync(KNOWN_FILE) ? JSON.parse(fs.readFileSync(KNOWN_FILE, "utf8")) : {};
  const failing = [...stats].filter(([, s]) => s.fails).sort((x, y) => x[1].min - y[1].min);
  if (args.has("--update-known")) {
    const next = {};
    for (const [key, s] of failing) next[key] = { min: Number(s.min.toFixed(2)), need: s.need, fails: s.fails, note: known[key]?.note || "" };
    fs.writeFileSync(KNOWN_FILE, JSON.stringify(next, null, 2) + "\n");
    console.log(`known.json neu geschrieben: ${failing.length} Einträge`);
    return;
  }
  // bekannt = steht in known.json UND ist nicht schlechter geworden – weder der schlechteste Wert noch die Zahl
  // der betroffenen Cover (sonst versteckt ein einzelnes schwaches Schema einen Rückschritt bei allen Covern)
  const isKnown = (key, s) => !args.has("--strict") && known[key] && s.min >= known[key].min - 0.005 && s.fails <= known[key].fails;
  const fresh = failing.filter(([k, s]) => !isKnown(k, s));
  const old = failing.filter(([k, s]) => isKnown(k, s));
  // behoben, aber noch in der Liste: melden, damit die Liste nicht veraltet
  const stale = Object.keys(known).filter((k) => !failing.some(([f]) => f === k));

  console.log("Mirage · Lesbarkeit bei jedem Cover");
  console.log(`  ${list.length} Cover (${colored} Farbauszüge, ${gray} fast farblose → Schemafarben), ${schemes.length} Schemata`);
  console.log(`  ${stats.size} Farbpaare aus user.css und den Schemata, ${[...stats.values()].reduce((n, s) => n + s.n, 0)} Messungen`);
  console.log(`  Mindestkontrast: 4.5 : 1 Schrift, 3 : 1 große Schrift und Symbole\n`);
  const show = ([key, s]) => {
    console.log(`  ${fmt(s.min)}  (nötig ${s.need}, ${s.kind})  ${s.fails} von ${s.n} Fällen zu schwach`);
    console.log(`      ${key}`);
    console.log(`      schlechtester Fall: ${s.where}`);
    if (known[key]?.note) console.log(`      bekannt: ${known[key].note}`);
  };
  if (args.has("--all")) {
    console.log("Alle Paare (schlechtester Kontrast):");
    for (const [key, s] of [...stats].sort((x, y) => x[1].min - y[1].min)) console.log(`  ${fmt(s.min).padStart(10)}  ${s.fails ? "✗" : "✓"} ${key}`);
    console.log("");
  }
  if (old.length) {
    console.log(`Bekannte Schwächen (${old.length}, in tests/contrast/known.json, lassen den Lauf nicht scheitern; --known zeigt Einzelheiten):`);
    // kurz halten: eine Zeile je Paar, die Begründung steht in known.json
    if (args.has("--known")) old.forEach(show);
    else for (const [key, s] of old) console.log(`  ${fmt(s.min).padStart(9)} statt ${s.need}  ${key.length > 118 ? key.slice(0, 117) + "…" : key}`);
    console.log("");
  }
  if (stale.length) {
    console.log(`Nicht mehr zu schwach – bitte aus tests/contrast/known.json streichen (${stale.length}):`);
    stale.forEach((k) => console.log("  " + k));
    console.log("");
  }
  console.log("Lesbarkeits-Wächter (readability.js):");
  console.log(`  ${guard.n} Hintergründe, schlechtester Kontrast der gewählten Ersatzfarbe: ${fmt(guard.min)} (nötig ${guard.need}) – ${guard.where}`);
  console.log("");
  const guardBad = guard.min < guard.need;
  if (fresh.length || guardBad) {
    if (fresh.length) {
      console.log(`✗ ${fresh.length} Farbpaare sind zu schwach:`);
      fresh.forEach(show);
    }
    if (guardBad) console.log("✗ Der Lesbarkeits-Wächter wählt eine unlesbare Ersatzfarbe.");
    process.exit(1);
  }
  console.log(`✓ Alle ${stats.size - old.length} übrigen Farbpaare sind bei jedem Cover lesbar.`);
}

// Der Wächter greift nur, wenn Schrift unter 3 : 1 liegt, und setzt dann helle oder dunkle Schrift.
// Geprüft wird die echte Entscheidung (inkFor) auf Graustufen und auf allen Coverfarben, in jedem Schema.
function guardCheck(theme, schemes, list) {
  const need = 3;
  const res = { n: 0, min: Infinity, where: "", need };
  const inkFor = theme.readability.inkFor;
  if (typeof inkFor !== "function") return { ...res, min: 0, where: "readability.js exportiert inkFor nicht" };
  const bgs = [];
  for (let v = 0; v <= 255; v++) bgs.push([v, v, v]);
  for (const c of list.slice(0, 1200)) bgs.push([c.px[0], c.px[1], c.px[2]]);
  for (const { name, sc, light } of schemes) {
    for (const bg of bgs) {
      let ink = Array.from(inkFor(bg));
      // „hell“ heißt im dunklen Schema: die Schriftfarbe des Schemas (Klasse m-readable-light → --spice-text);
      // im hellen Schema setzt der Wächter die helle Farbe selbst
      if (lum(ink) > 0.5 && !light) ink = hexRgb(sc.text);
      const r = contrast(ink, bg);
      res.n++;
      if (r < res.min) {
        res.min = r;
        res.where = `Hintergrund ${hex(bg)} (Leuchtdichte ${lum(bg).toFixed(2)}), Schema ${name}, Schrift ${hex(ink)}`;
      }
    }
  }
  return res;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
