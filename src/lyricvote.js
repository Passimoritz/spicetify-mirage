/* ---------------------------------------------------------------- Liedtext-Fassungen abstimmen */
// Mehrere Sammlungen (LRCLIB mit oft mehreren Einträgen je Song, NetEase, Kugou) liefern zeitgenaue Texte zum
// selben Song. Meist stimmen sie überein – manchmal liegt einer um Sekunden daneben (anderes Intro, andere
// Fassung, schlecht von Hand gesetzt). Beispiel „Dog Dribble“ (Getdown Services): vier LRCLIB-Einträge beginnen
// bei 0:25,79, einer 1,75 s früher. Darum: Fassungen nach ihren Zeilenzeiten in Gruppen teilen, die größte
// übereinstimmende Gruppe gewinnt, Ausreißer fallen weg. Ohne Netz und ohne Fenster – einzeln testbar
// (tests/unit/lyricvote.test.js).
import { fold, tierOf } from "./lyricmatch.js";

// Fassungen liegen höchstens so weit auseinander, um noch als „gleich“ zu gelten (Handarbeit schwankt ein wenig)
const TOL = 400;
// ab hier wird eine gezeigte Fremd-Fassung ersetzt; Spotifys eigene erst ab OVERRULE (und nur gegen ≥ 2 andere)
const SWITCH = 600, OVERRULE = 1000;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
// Zeilen mit Text, in Vergleichsform
const textLines = (lyr) => (lyr?.lines || []).map((l) => ({ t: Number(l.t) || 0, f: fold(l.text === "♪" ? "" : l.text) })).filter((l) => l.f.length > 1);

// Mittlerer Versatz von b gegenüber a (ms, b später = positiv) über die gleichen Zeilen. Ein Refrain kommt
// mehrmals vor: darum zählen alle Paare gleicher Zeilen, und es gewinnt der Versatz, bei dem die MEISTEN
// verschiedenen Zeilen zusammenpassen (±250 ms) – fehlende oder zusätzliche Zeilen stören so nicht.
// null = nicht vergleichbar (anderer Text, zu wenige gemeinsame Zeilen)
const NEAR = 250;
function lineOffset(a, b) {
  const A = textLines(a), B = textLines(b);
  if (A.length < 3 || B.length < 3) return null;
  const pairs = [];
  A.forEach((x, i) => {
    for (const y of B) if (y.f === x.f && Math.abs(y.t - x.t) < 60000) pairs.push({ i, d: y.t - x.t });
  });
  // je Zeile von a die Abweichung, die d0 am nächsten liegt (innerhalb NEAR)
  const near = (d0) => {
    const by = new Map();
    for (const p of pairs) if (Math.abs(p.d - d0) <= NEAR && (!by.has(p.i) || Math.abs(p.d - d0) < Math.abs(by.get(p.i) - d0))) by.set(p.i, p.d);
    return [...by.values()];
  };
  let hits = [];
  // jede Abweichung nur einmal probieren (auf 50 ms gerundet) – hält lange Songs mit vielen Refrains schnell
  for (const d0 of new Set(pairs.map((p) => Math.round(p.d / 50) * 50))) {
    const h = near(d0);
    if (h.length > hits.length) hits = h;
  }
  if (hits.length < Math.max(3, Math.min(A.length, B.length) * 0.4)) return null;
  return Math.round(median(near(median(hits))));
}

// Gruppen bilden: je Fassung zählen, wie viele andere höchstens tol entfernt liegen; die Mitte mit den meisten
// Nachbarn gewinnt (bei Gleichstand die vordere – die Liste kommt nach Rang sortiert herein)
// → { center, members: [Indizes, Rang-Reihenfolge], outliers: [Indizes], off: (i) => Versatz zur Mitte | null }
function clusterLyrics(list, tol = TOL) {
  const n = list.length, M = Array.from({ length: n }, () => new Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    M[i][i] = 0;
    for (let j = i + 1; j < n; j++) {
      const d = lineOffset(list[i], list[j]);
      M[i][j] = d;
      M[j][i] = d === null ? null : -d;
    }
  }
  let center = -1, members = [];
  for (let i = 0; i < n; i++) {
    const m = [];
    for (let j = 0; j < n; j++) if (M[i][j] !== null && Math.abs(M[i][j]) <= tol) m.push(j);
    if (m.length > members.length) [center, members] = [i, m];
  }
  return { center, members, outliers: list.map((_, i) => i).filter((i) => !members.includes(i)), off: (i) => (center < 0 ? null : M[center][i]) };
}

// Zeiten eines Liedtexts verschieben – als Kopie, die Quelle bleibt unberührt
function shiftLyrics(lyr, ms) {
  const m = (t) => Math.max(0, Math.round(t + ms));
  return {
    ...lyr,
    lines: lyr.lines.map((l) => ({
      ...l,
      t: m(l.t),
      ...(l.words ? { words: l.words.map((w) => ({ ...w, t: m(w.t) })) } : {}),
      ...(l.syl ? { syl: l.syl.map((s) => ({ ...s, t: m(s.t) })) } : {}),
    })),
  };
}

// Für Abstimmungen taugt nur, was zeitgenau ist und genug Zeilen hat
const votable = (x) => !!x?.synced && !x.instrumental && (x.lines?.length || 0) >= 3;

// Soll statt `shown` etwas anderes gezeigt werden?
// shown = gezeigtes Ergebnis, cands = alle zeitgenauen Kandidaten nach Rang (shown darf dabei sein)
// opt.prio: shown ist Spotifys eigener Text (kam rechtzeitig) – wird nur von ≥ 2 einigen anderen und erst ab
// OVERRULE überstimmt · opt.ok(x): darf x gezeigt werden (z. B. gleicher Text wie Spotifys einfacher Text)
// → { lyr, base, how: "keep"|"switch"|"shift", off, candidates, cluster, overruled }
//   lyr = was gezeigt werden soll; base = der Kandidat, aus dem es stammt; off = Verschiebung bei „shift“
//   cluster = wie viele Fassungen (samt der gezeigten) mit dem Gezeigten übereinstimmen
function judgeLyrics(shown, cands, opt = {}) {
  const { prio = false, karaoke = false, ok = () => true, tol = TOL } = opt;
  const list = (cands || []).filter(votable);
  const keep = (cluster) => ({ lyr: shown, base: shown, how: "keep", off: 0, candidates: list.length, cluster, overruled: false });
  if (!votable(shown)) return keep(shown?.synced ? 1 : 0);
  if (!list.includes(shown)) list.unshift(shown);
  const agree = (x) => x === shown || ((d) => d !== null && Math.abs(d) <= tol)(lineOffset(shown, x));
  const mine = list.filter(agree).length;
  if (list.length < 3) return keep(mine);
  const c = clusterLyrics(list, tol);
  // Mehrheit: mindestens zwei einige Fassungen, mehr als die um das Gezeigte
  const others = c.members.filter((i) => list[i] !== shown);
  if (c.members.includes(list.indexOf(shown)) || others.length < 2 || c.members.length <= mine) return keep(mine);
  const d = c.off(list.indexOf(shown));
  if (d === null || Math.abs(d) <= (prio ? OVERRULE : SWITCH)) return keep(mine);
  const res = { candidates: list.length, cluster: c.members.length, overruled: !!prio };
  // bevorzugt eine Fassung aus der Gruppe (nach Rang), die mindestens so gut ist wie die gezeigte (Wortzeiten)
  const pick = others.map((i) => list[i]).find((x) => ok(x) && tierOf(x, karaoke) >= tierOf(shown, karaoke));
  if (pick) return { ...res, lyr: pick, base: pick, how: "switch", off: 0 };
  // sonst den gezeigten Text (mit seinen Wortzeiten) auf die Zeiten der Mehrheit schieben
  return { ...res, lyr: shiftLyrics(shown, -d), base: shown, how: "shift", off: -d };
}

export { lineOffset, clusterLyrics, judgeLyrics, shiftLyrics, votable, TOL, SWITCH, OVERRULE };
