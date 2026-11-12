import { S, VERSION, remote } from "./core.js";
import { cfg } from "./config.js";
import { SEL } from "./selectors.js";

/* ---------------------------------------------------------------- Reparatur-Datei aus dem Netz */
// Ändert Spotify nach einem Update Namen, reicht eine kleine Datei im Repository (remote/fixes.json): Mirage lädt
// sie höchstens alle sechs Stunden und wendet passende Regeln an – neue Selektoren und reines CSS, nie Code.
const SRC = "https://raw.githubusercontent.com/Passimoritz/spicetify-mirage/main/remote/fixes.json";
const KEY = "mirage:remoteFix", EVERY = 6 * 3600e3;
const spotify = String(S.Platform?.version || S.Config?.spotify_version || "");
const baseSel = { ...SEL };
const sheet = document.createElement("style");
sheet.id = "mirage-remote";

const cmp = (a, b) => {
  const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d;
  }
  return 0;
};
// nur reine Regeln: nichts, das etwas nachlädt oder aus dem Stylesheet ausbricht
const okCss = (c) => typeof c === "string" && c.length <= 20000 && !/@import|url\s*\(|expression\s*\(|<\/|javascript:|behavior\s*:/i.test(c);
const okSel = (s) => {
  if (typeof s !== "string" || !s || s.length > 600) return false;
  try {
    document.querySelector(s);
    return true;
  } catch {
    return false;
  }
};
function matches(r) {
  if (!r || typeof r !== "object") return false;
  const sp = r.spotify;
  if (sp && sp !== "*" && !(Array.isArray(sp) ? sp : [sp]).some((p) => spotify.startsWith(String(p)))) return false;
  if (VERSION === "dev") return true;
  if (r.mirageMin && cmp(VERSION, r.mirageMin) < 0) return false;
  if (r.mirageMax && cmp(VERSION, r.mirageMax) > 0) return false;
  return true;
}
function apply(data) {
  Object.assign(SEL, baseSel);
  let css = "", n = 0;
  if (cfg.remoteFix && data && data.v === 1 && Array.isArray(data.rules)) {
    for (const r of data.rules.slice(0, 40)) {
      if (!matches(r)) continue;
      n++;
      // der neue Selektor zuerst, der eingebaute bleibt als Rückfall dahinter
      for (const [k, v] of Object.entries(r.sel || {})) if (k in baseSel && okSel(v)) SEL[k] = v + ", " + baseSel[k];
      if (okCss(r.css)) css += r.css + "\n";
    }
  }
  if (sheet.textContent !== css) sheet.textContent = css;
  if (css && !sheet.isConnected) document.head.append(sheet);
  remote.applied = n;
}
async function refreshRemote(force) {
  if (!cfg.remoteFix) return apply(null);
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {}
  if (saved?.data) {
    apply(saved.data);
    remote.at = saved.at || 0;
  }
  if (!force && saved && Date.now() - (saved.at || 0) < EVERY) return;
  try {
    const res = await fetch(SRC, { cache: "no-store", credentials: "omit" });
    if (!res.ok) return;
    const txt = await res.text();
    if (txt.length > 60000) return;
    const data = JSON.parse(txt);
    if (data?.v !== 1) return;
    remote.at = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: remote.at, data }));
    } catch {}
    apply(data);
  } catch {}
}
refreshRemote();
// Der Wecker läuft nur bei sichtbarem Fenster. Beim Sichtbarwerden wird nachgeholt, was fällig ist.
let again = 0, tried = Date.now();
const tick = () => {
  tried = Date.now();
  refreshRemote();
};
function watch() {
  clearInterval(again);
  again = 0;
  if (document.hidden) return;
  if (Date.now() - tried >= EVERY) tick();
  again = setInterval(tick, EVERY);
}
document.addEventListener("visibilitychange", watch);
watch();

export { refreshRemote };
