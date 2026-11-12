/* ---------------------------------------------------------------- Liedtext-Treffer bewerten */
// Welcher Eintrag einer Liedtext-Sammlung gehört zu genau DIESER Aufnahme? Eine Live-Fassung oder ein Remix
// darf nicht den zeitgenauen Text der Studiofassung bekommen: die Zeilen liefen dem Gesang davon.
// Verglichen werden Länge (wenige Sekunden Spielraum), Fassungswörter im Titel-Zusatz, Titel und Künstler.
// Ohne Zugriff auf Spotify oder das Fenster – darum einzeln testbar (tests/unit/lyricmatch.test.js).
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "");

// Fassungswörter: hart = anderer Gesang oder andere Zeiten, weich = meist nur anders geschnitten.
// „Remastered“, „Mono“, „Album Version“, „Original Mix“ fehlen mit Absicht: das ist dieselbe Aufnahme.
const TAGS = [
  ["live", /\b(live|unplugged|in concert|konzert|mtv session|bbc session|live lounge)\b/, true],
  ["remix", /\b(remix|rmx|bootleg|mashup|mash-up|club mix|dub mix|dub|vip mix|rework|flip)\b/, true],
  ["acoustic", /\b(acoustic|akustik|stripped|piano version)\b/, true],
  ["instrumental", /\b(instrumental|karaoke|backing track|a cappella|acapella)\b/, true],
  ["speed", /\b(sped up|speed up|slowed|nightcore|daycore)\b/, true],
  ["cover", /\b(cover|tribute|originally performed)\b/, true],
  ["demo", /\b(demo|rough mix|early take|outtake)\b/, true],
  ["orchestral", /\b(orchestral|symphonic|orchestra version)\b/, true],
  ["extended", /\b(extended|long version|full length|12 inch)\b/, false],
  ["edit", /\b(radio edit|single edit|short version|edit)\b/, false],
];
const HARD = new Set(TAGS.filter((x) => x[2]).map((x) => x[0]));
// Nur der Zusatz zählt („Song - Live at Wembley“, „Song (Acoustic)“) – sonst wäre „Live and Let Die“ ein Konzert
const extras = (title) => {
  const s = String(title || "").toLowerCase();
  const out = [...s.matchAll(/[([]([^)\]]*)[)\]]/g)].map((m) => m[1]);
  const dash = s.search(/\s[-–—]\s/);
  if (dash >= 0) out.push(s.slice(dash + 3));
  return out.join(" | ");
};
function versionTags(title, album) {
  const ex = extras(title), tags = new Set();
  for (const [name, re] of TAGS) if (re.test(ex)) tags.add(name);
  // Konzertalben nennen die Titel oft ohne Zusatz
  if (/\blive (at|in|from|on|aus|im)\b|\(live\)|\bunplugged\b/i.test(String(album || ""))) tags.add("live");
  return tags;
}
// „Song - Remastered 2011“, „Song (feat. X)“, „Song (Live)“ → „Song“. Nur Zusätze, die eine Fassung oder Gäste
// nennen: „Song (Part 2)“ und „Sinfonie Nr. 5 - Allegro“ bleiben, wie sie sind
const EXTRA = /\b(remaster(ed)?|version|edit|live|mix|remix|mono|stereo|acoustic|demo|instrumental|karaoke|session|unplugged|bonus|deluxe|sped up|slowed|feat|ft|with|from|explicit|clean|(19|20)\d\d)\b/i;
const baseTitle = (title) =>
  String(title || "")
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (all, inner) => (EXTRA.test(inner) ? "" : all))
    .replace(/\s[-–—]\s(.*)$/, (all, rest) => (EXTRA.test(rest) ? "" : all))
    .trim() || String(title || "");

const TOL_SYNCED = 4, TOL_PLAIN = 12;
// meta = { title, artist, album, sec } des laufenden Songs · cand = { id, title, artist, album, sec, synced }
// Ergebnis: score (kleiner = besser, Infinity = passt nicht) und plainOnly (Text ja, Zeiten nein)
function matchScore(meta, cand) {
  let score = 0, plainOnly = false;
  const a = norm(baseTitle(meta.title)), b = norm(baseTitle(cand.title));
  if (!a || !b) return { score: Infinity, plainOnly };
  if (a !== b) {
    if (!(a.includes(b) || b.includes(a)) || Math.min(a.length, b.length) < 3) return { score: Infinity, plainOnly };
    score += 6;
  }
  const ar = norm(String(meta.artist || "").split(/,|&| feat| ft\.? | x /i)[0]), cr = norm(cand.artist);
  if (ar && cr && !(cr.includes(ar) || ar.includes(cr))) return { score: Infinity, plainOnly };
  // Fassung: jedes Wort, das nur eine Seite trägt
  const mt = versionTags(meta.title, meta.album), ct = versionTags(cand.title, cand.album);
  for (const tag of new Set([...mt, ...ct])) {
    if (mt.has(tag) === ct.has(tag)) continue;
    // Gesang gegen Instrumental (oder umgekehrt): der Text wäre schlicht falsch
    if (tag === "instrumental") return { score: Infinity, plainOnly };
    if (HARD.has(tag)) {
      plainOnly = true;
      score += 25;
    } else score += 8;
  }
  // Länge: innerhalb weniger Sekunden gilt als dieselbe Aufnahme
  const d = meta.sec && cand.sec ? Math.abs(cand.sec - meta.sec) : null;
  if (d !== null) {
    if (d > TOL_PLAIN) return { score: Infinity, plainOnly };
    if (d > TOL_SYNCED) {
      plainOnly = true;
      score += 20;
    }
    score += d * 1.5;
  } else score += 5;
  if (!cand.synced || plainOnly) score += 12;
  return { score, plainOnly };
}
// passende Einträge, bester zuerst; bad = abgelehnte Kennungen (ids als Text)
function rankLyrics(meta, cands, bad) {
  const seen = new Set(), no = new Set([...(bad || [])].map(String));
  return (cands || [])
    .filter((c) => c && !no.has(String(c.id)) && !seen.has(String(c.id)) && seen.add(String(c.id)))
    .map((c) => ({ ...c, ...matchScore(meta, c) }))
    .filter((c) => Number.isFinite(c.score))
    .sort((x, y) => x.score - y.score);
}

export { versionTags, baseTitle, matchScore, rankLyrics, TOL_SYNCED, TOL_PLAIN };
