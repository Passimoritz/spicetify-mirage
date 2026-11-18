// Mini-Player (Bild-im-Bild) im Mirage-Look.
// Spotify öffnet ihn über documentPictureInPicture als eigenes Dokument und lädt dort nur
// pip-mini-player-snapshot.css – ohne user.css, colors.css und ohne Mirages Farbvariablen (sie stehen am
// <html> des Hauptfensters und vererben sich nicht in ein anderes Dokument). Beim Öffnen holt Mirage deshalb
// seine Mini-Player-Regeln (alle mit „html.m-pip“ in user.css), die Schrift und die aktuellen Farben hinüber.
// Solange das Fenster offen ist, folgen die Farben dem Cover; beim Schließen wird alles wieder abgebaut.
// Geschlossen kostet das nichts: nur ein Listener auf das „enter“-Ereignis, kein Beobachter, kein Takt.
// Bewusst ohne Import aus core.js: das Modul liest beim Laden nichts von Spicetify.

const root = document.documentElement;
// Zustände des Hauptfensters, auf die die Mini-Player-Regeln achten
const CLASSES = ["mirage-light", "mirage-glass", "mirage-calm", "mirage-playing"];
// Variablen stehen an der Wurzel: in colors.css (:root), user.css (:root, html.mirage-light),
// #mirage-scheme / #mirage-vars (html:root) und im style-Attribut (Schrift)
const ROOT_SEL = /^(:root|html(:root|\.mirage-light)?)$/;
const OWN = /^--(m|spice)-/;

// #mirage-vars und #mirage-scheme ändern ihren Inhalt (im hellen Schema kommen --m-ia … dazu): die beiden
// kleinen Blätter jedes Mal lesen, alle übrigen (colors.css, user.css) nur beim ersten Mal
const LIVE = new Set(["mirage-vars", "mirage-scheme"]);
function collect(sheet, set) {
  let rules;
  try {
    rules = sheet.cssRules;
  } catch {
    return;
  }
  for (const r of rules) {
    if (!r.style || !ROOT_SEL.test(r.selectorText || "")) continue;
    for (let i = 0; i < r.style.length; i++) if (OWN.test(r.style[i])) set.add(r.style[i]);
  }
}
let fixed = null;
function varNames() {
  if (!fixed) {
    fixed = new Set(["--m-a", "--m-b", "--m-c", "--m-a-rgb", "--m-b-rgb", "--m-c-rgb", "--m-font"]);
    for (const sheet of document.styleSheets) if (!LIVE.has(sheet.ownerNode?.id)) collect(sheet, fixed);
  }
  const set = new Set(fixed);
  for (const id of LIVE) {
    const el = document.getElementById(id);
    if (el?.sheet) collect(el.sheet, set);
  }
  return set;
}
// aktuelle Werte in EINER Regel – im Mini-Player eine einzige Stilberechnung je Farbwechsel
function varsCss() {
  const cs = getComputedStyle(root);
  let out = "";
  for (const n of varNames()) {
    const v = cs.getPropertyValue(n).trim();
    if (v) out += `${n}:${v};`;
  }
  return `html:root{${out}}`;
}

// Regeln für den Mini-Player aus user.css (die Datei ändert sich erst mit einem Neuladen: einmal sammeln)
let rulesText = null;
function pipRules() {
  if (rulesText !== null) return rulesText;
  const out = [];
  for (const sheet of document.styleSheets) {
    if (!/(^|\/)user\.css(\?|$)/.test(sheet.href || "")) continue;
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const r of rules) {
      // Stilregeln mit html.m-pip und @media-Blöcke, die solche enthalten
      const t = r.selectorText ?? (r.cssRules ? r.cssText : "");
      if (t.includes("m-pip")) out.push(r.cssText);
    }
  }
  rulesText = out.join("\n");
  return rulesText;
}

function attach(win) {
  const doc = win?.document;
  if (!doc?.head || doc.documentElement.classList.contains("m-pip")) return;
  const html = doc.documentElement;
  html.classList.add("m-pip");
  const rules = doc.createElement("style");
  rules.id = "mirage-pip";
  rules.textContent = pipRules();
  const vars = doc.createElement("style");
  vars.id = "mirage-pip-vars";
  doc.head.append(rules, vars);
  // Schriften: Outfit (wie user.css) und eine in den Einstellungen gewählte (fonts.js legt <link> an)
  const fonts = new Set(["https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"]);
  for (const l of document.querySelectorAll('link[rel="stylesheet"][href^="https://fonts.googleapis.com/"]')) fonts.add(l.href);
  for (const href of fonts) {
    const l = doc.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    doc.head.append(l);
  }

  let frame = 0;
  const sync = () => {
    frame = 0;
    const css = varsCss();
    // nur schreiben, wenn sich etwas geändert hat
    if (vars.textContent !== css) vars.textContent = css;
    for (const c of CLASSES) html.classList.toggle(c, root.classList.contains(c));
  };
  const later = () => {
    if (!frame) frame = requestAnimationFrame(sync);
  };
  sync();
  // Farben ändern sich über #mirage-vars/#mirage-scheme (Inhalt), Schema/Schrift/Zustand über <html>
  const mo = new MutationObserver(later);
  mo.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
  for (const id of ["mirage-vars", "mirage-scheme"]) {
    const el = document.getElementById(id);
    if (el) mo.observe(el, { childList: true, characterData: true, subtree: true });
  }
  win.addEventListener(
    "pagehide",
    () => {
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
    { once: true },
  );
}

const dpip = window.documentPictureInPicture;
if (dpip) {
  dpip.addEventListener("enter", (e) => attach(e.window));
  // schon offen, als Mirage geladen wurde (Neuladen bei offenem Mini-Player)
  if (dpip.window) attach(dpip.window);
}

export { attach, pipRules, varsCss };
