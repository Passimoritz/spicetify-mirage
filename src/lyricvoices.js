/* ---------------------------------------------------------------- Stimmen im Liedtext (Duette, Hintergrundgesang) */
// Wer singt welche Zeile, und was ist Hintergrundgesang? Ohne Fenster und ohne Netz – einzeln testbar
// (tests/unit/lyricvoices.test.js). Ergebnis an den Zeilen: who = "1" | "2" | "3" | "all" (beide/alle zusammen),
// bg = true (die ganze Zeile ist Hintergrundgesang), an Wörtern w.bg = true. Weiß Mirage nichts, bleibt alles,
// wie es war (keine Felder dazu).
//
// Quellen: TTML (AMLL) bringt ttm:agent und x-bg selbst mit (lyricparse.js). LRC und einfacher Text kennen nur
// Schreibweisen: „Name: Text“, „[Name] Text“, „(Name) Text“, Kopfzeilen wie „[Verse 2: Name]“ oder „[Name & Name]“,
// Hintergrundgesang in Klammern „(oh, oh)“ – mitten in der Zeile oder als ganze Zeile.
import { rgb2hsl, readable } from "./hsl.js";

// Abschnitts-Namen und Regieanweisungen: „(Chorus)“, „[Verse 2]“, „(x2)“ sind KEIN Hintergrundgesang und kein Sänger
const SECTION = /^(?:pre[- ]?|post[- ]?)?(?:chorus|refrain|hook|verse|strophe|bridge|intro|outro|interlude|break(?:down)?|drop|instrumental|solo|coda|part|teil|vers|ref\.?|spoken|gesprochen|repeat|wiederholung|ad[- ]?libs?|x ?\d+|\d+ ?x|×\d+|\d+×)(?=$|[\s\d:.,)\]-])/i;
const isLabel = (s) => SECTION.test(String(s || "").trim());
// „alle zusammen“
const ALL = /^(?:all|alle|both|beide|together|zusammen|everyone|everybody|tous|todos|tutti|ensemble|juntos)$/i;
// Ausrufe in Klammern sind Hintergrundgesang, keine Namen: „(Oh) …“, „(Hey) …“
const SHOUT = /^(?:o+h+|o+|a+h+|u+h+|e+h+|hey+|hei|yeah+|yea|ye+|la+|na+|da+|do+|doo+|wo+h?|whoa+|woo+|mm+|hmm+|ha+|ay+|aye|yo|ooh+|uh[- ]huh|baby|no+|yes|si|ja|nein|come on|let'?s go)$/i;
// ein Sängername: höchstens vier Wörter, fängt groß an (oder in einer Schrift ohne Großbuchstaben), keine Satzzeichen
const NAME = /^[\p{Lu}\p{Lo}][\p{L}\p{N} .'’&+-]{0,23}$/u;
const SPLIT = /\s*(?:&|\+|,|\/|\band\b|\bund\b|\bx\b|\bwith\b|\bfeat\.?|\bft\.?)\s*/i;

// Namen aus dem Inhalt eines Etiketts („Verse 2: Drake & Rihanna“ → ["drake", "rihanna"]; „Chorus“ → [])
// null = kein Etikett (dann ist es Text oder Hintergrundgesang)
function tagNames(inner) {
  let s = String(inner || "").trim();
  if (!s) return null;
  if (isLabel(s)) {
    const c = s.indexOf(":");
    if (c < 0) return [];
    s = s.slice(c + 1).trim();
    if (!s) return [];
  }
  if (ALL.test(s)) return ["*"];
  if (s.split(/\s+/).length > 5 || /[!?;"“”„]/.test(s)) return null;
  const parts = s.split(SPLIT).map((x) => x.trim()).filter(Boolean);
  const shout = (x) => x.split(/[\s,-]+/).filter(Boolean).every((w) => SHOUT.test(w));
  if (!parts.length || parts.some((x) => !NAME.test(x) || shout(x) || x.split(/\s+/).length > 3)) return null;
  return parts.map((x) => (ALL.test(x) ? "*" : x.toLowerCase()));
}

// Kopf einer Zeile: [ganzes Etikett?, Länge des Präfixes, Inhalt]
const HEAD = /^\s*(?:\[([^\]]{1,40})\]|\(([^)]{1,40})\)|([\p{Lu}\p{Lo}][\p{L}\p{N} .'’&+-]{0,30}):)\s*/u;
function headOf(text) {
  const m = HEAD.exec(text);
  if (!m) return null;
  const inner = (m[1] ?? m[2] ?? m[3]).trim();
  const rest = text.slice(m[0].length).trim();
  // „Name:“ braucht danach Text oder nichts; Klammern ohne Rest = ganze Zeile ist das Etikett
  return { inner, len: m[0].length, alone: !rest, paren: m[2] != null, colon: m[3] != null };
}

// Wörter in Klammern: von „(“ bis „)“ – nur nicht, wenn die Klammer ein Etikett ist („(x2)“, „(Chorus)“)
function bgFlags(texts) {
  const out = texts.map(() => false);
  let from = -1;
  texts.forEach((w, i) => {
    const s = String(w || "");
    if (from < 0 && /^[(（]/.test(s)) from = i;
    if (from >= 0 && /[)）][,.!?…]*$/.test(s)) {
      const inner = texts.slice(from, i + 1).join(" ").replace(/^[(（]|[)）][,.!?…]*$/g, "");
      if (!isLabel(inner)) for (let k = from; k <= i; k++) out[k] = true;
      from = -1;
    }
  });
  // nie geschlossene Klammer: bis zum Zeilenende Hintergrund (wie bisher)
  if (from >= 0 && !isLabel(texts.slice(from).join(" ").slice(1))) for (let k = from; k < texts.length; k++) out[k] = true;
  return out;
}
// Einfacher Text in Stücke: [{ text, bg }] – Klammern sind Hintergrundgesang, Etiketten bleiben normaler Text
function bgParts(text) {
  const parts = String(text || "").split(/([(（][^)）]*[)）])/).filter((p) => p);
  return parts.map((p) => ({ text: p, bg: /^[(（]/.test(p) && !isLabel(p.slice(1, -1)) }));
}
// Ganze Zeile in Klammern (und kein Etikett): Hintergrundgesang
const wholeBg = (text) => {
  const m = /^\s*[(（]([^()（）]+)[)）]\s*$/.exec(String(text || ""));
  return !!m && !isLabel(m[1]) && tagNames(m[1]) == null;
};

// Präfix aus den Wörtern einer Zeile mit Wortzeiten entfernen („Name: “ als eigene Wörter) – nur auf Wortgrenze
function dropWords(l, len) {
  let n = 0, k = 0;
  const head = l.text.slice(0, len).replace(/\s+/g, "");
  while (k < l.words.length && n < head.length) n += l.words[k++].text.replace(/\s+/g, "").length;
  if (n !== head.length) return false;
  l.words = l.words.slice(k);
  return true;
}

// lyr = { lines } (oder die Zeilen selbst). Einmal je Ergebnis (lyr.voices), gefahrlos wiederholbar.
function parseVoices(lyr) {
  const lines = Array.isArray(lyr) ? lyr : lyr?.lines;
  if (!lines?.length || (!Array.isArray(lyr) && lyr.voices)) return lyr;
  if (!Array.isArray(lyr)) lyr.voices = true;
  // Hintergrundgesang: Wörter in Klammern und ganze Zeilen in Klammern
  for (const l of lines) {
    if (l.words?.length) {
      const f = bgFlags(l.words.map((w) => w.text));
      l.words.forEach((w, i) => f[i] && (w.bg = true));
      if (l.words.every((w) => w.bg)) l.bg = true;
    } else if (wholeBg(l.text)) l.bg = true;
  }
  // Stimmen schon von der Quelle (TTML): nichts raten
  if (lines.some((l) => l.who)) return lyr;
  // 1. Namen zählen: Kopfzeilen („[Verse: Name]“, „Name:“ allein) zählen dreifach, Präfixe und Klammern einfach –
  // ein Name braucht 3 Punkte, ein Duett mindestens zwei solche Namen. Klammern zählen wenig, weil „(Baby) …“
  // auch Hintergrundgesang sein kann; eckige Klammern und Doppelpunkte schreibt niemand um gesungenen Text.
  const score = new Map(), heads = lines.map((l) => {
    const h = l.text && headOf(l.text);
    const names = h ? tagNames(h.inner) : null;
    if (!names) return null;
    const w = h.alone && !h.paren ? 3 : 1;
    for (const n of names) if (n !== "*") score.set(n, (score.get(n) || 0) + w);
    return { ...h, names };
  });
  const names = [...score].filter(([, s]) => s >= 3).map(([n]) => n);
  if (names.length < 2) return lyr;
  // 2. zuordnen: jede Zeile singt, wer zuletzt genannt wurde; ein Abschnitt ohne Namen („[Chorus]“) ist offen
  let cur = "";
  lines.forEach((l, i) => {
    const h = heads[i];
    if (h) {
      const known = h.names.filter((n) => n === "*" || names.includes(n));
      if (known.length || !h.names.length) {
        cur = !known.length ? "" : known.includes("*") || known.length > 1 ? "all" : String((names.indexOf(known[0]) % 3) + 1);
        // nur Sänger-Etiketten verschwinden aus der Zeile; „[Chorus]“ bleibt stehen, wie bisher
        // (mit Wortzeiten nur, wenn das Etikett genau auf Wortgrenzen endet – sonst bleibt der Text, nur die Farbe kommt)
        if (known.length && (!l.words?.length || h.alone || dropWords(l, h.len))) {
          l.text = l.text.slice(h.len).trim() || "♪";
          if (h.alone) delete l.words;
        }
      }
    }
    // auch Hintergrundgesang bekommt die Farbe der Stimme (bleibt aber klein und leiser)
    if (cur) l.who = cur;
  });
  return lyr;
}

/* ---- Farben der Stimmen: aus der Coverfarbe, gut unterscheidbar und lesbar */
// Grund hinter dem Liedtext: das abgedunkelte Cover. Bewusst etwas heller als das dunkelste Schwarz gerechnet,
// damit die Farbe auch auf hellen Covern lesbar bleibt (4.5 : 1).
const LYR_BG = [46, 42, 58];
const hueGap = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};
// pal = [A, B, C] als [r, g, b] → drei Stimmfarben [r, g, b]
function voiceColors(pal, bg = LYR_BG) {
  const hs = (pal || []).filter(Boolean).map((c) => rgb2hsl(c));
  const first = hs[0] || [265, 0.6, 0.6];
  const gray = first[1] < 0.18;
  const v1 = gray ? [first[0], 0.06, 0.82] : [first[0], Math.max(0.5, first[1]), 0.72];
  const pickFrom = (pool, taken, gap) => pool.find((h) => h[1] >= 0.25 && taken.every((t) => hueGap(h[0], t) >= gap));
  // Stimme 2: eine andere Farbe des Covers, wenn sie sich deutlich abhebt (80° auf dem Farbkreis: Grün und Türkis wirken sonst gleich) – sonst gegenüber auf dem Farbkreis
  const c2 = pickFrom([hs[2], hs[1]].filter(Boolean), gray ? [] : [v1[0]], 80);
  const v2 = c2 ? [c2[0], Math.max(0.5, c2[1]), 0.72] : [gray ? 205 : (v1[0] + 150) % 360, 0.62, 0.72];
  const c3 = pickFrom(hs.slice(1).filter(Boolean), [v1[0], v2[0]].filter((x, k) => k || !gray), 45);
  const v3 = c3 ? [c3[0], Math.max(0.5, c3[1]), 0.72] : [gray ? 35 : (v1[0] + 255) % 360, 0.62, 0.72];
  return [v1, v2, v3].map((c) => readable(c, bg, 0.03, 4.5));
}
// CSS-Variablen dazu (--m-v1 … --m-v3 und die -rgb-Fassungen für halbe Deckkraft)
const voiceVars = (pal) =>
  voiceColors(pal)
    .map((c, i) => `--m-v${i + 1}:rgb(${c.join(",")});--m-v${i + 1}-rgb:${c.join(",")};`)
    .join("");

export { parseVoices, bgFlags, bgParts, isLabel, tagNames, voiceColors, voiceVars };
