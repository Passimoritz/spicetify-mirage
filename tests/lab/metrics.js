// Kennzahlen des Testlabors: Treffer mit Toleranz (F-Maß wie mir_eval), Grenzen, Teil-Klassen, Genre-Erwartung.

// est/ref: aufsteigende Zeiten (s). Jeder Referenzpunkt höchstens einmal getroffen (gierig, nächster zuerst).
// off = Median der vorzeichenbehafteten Abweichung der Treffer (positiv = zu spät)
function tolerantF(est, ref, tol) {
  if (!est.length || !ref.length) return { f: 0, p: 0, r: 0, off: 0 };
  let j = 0, hit = 0;
  const used = new Uint8Array(ref.length), offs = [];
  for (const t of est) {
    while (j < ref.length - 1 && ref[j + 1] <= t) j++;
    let best = -1, bd = tol + 1e-9;
    for (const k of [j - 1, j, j + 1]) {
      if (k < 0 || k >= ref.length || used[k]) continue;
      const dd = Math.abs(ref[k] - t);
      if (dd <= bd) [best, bd] = [k, dd];
    }
    if (best >= 0) {
      used[best] = 1;
      hit++;
      offs.push(t - ref[best]);
    }
  }
  const p = hit / est.length, r = hit / ref.length;
  offs.sort((a, b) => a - b);
  return { f: p + r ? (2 * p * r) / (p + r) : 0, p, r, off: offs.length ? offs[offs.length >> 1] : 0 };
}
const boundaryF = (est, ref, tol) => tolerantF([...est].sort((a, b) => a - b), [...ref].sort((a, b) => a - b), tol);

// Harmonix-Teilnamen → Klassen (intro, verse, pre, chorus, bridge, break, outro, silence)
function LABEL(l) {
  const s = String(l || "").toLowerCase().replace(/[0-9_]+$/, "");
  if (!s || s === "end") return "";
  if (/silence|fadein/.test(s)) return "silence";
  if (/^intro|opening/.test(s)) return "intro";
  if (/outro|^end|fadeout|coda/.test(s)) return "outro";
  if (/prechorus|build|preverse|transition/.test(s)) return "pre";
  if (/quietchorus/.test(s)) return "bridge";
  if (/chorus|refrain|drop|hook/.test(s)) return "chorus";
  if (/verse|rap/.test(s)) return "verse";
  if (/bridge/.test(s)) return "bridge";
  if (/break|inst|solo|gtr|riff|slow|quiet|stutter/.test(s)) return "break";
  return "verse";
}
function labelAt(segs, t) {
  let l = "";
  for (const [s, lab] of segs) {
    if (s > t) break;
    l = lab;
  }
  return l;
}

// Welche Familien (genres.js FAMILIES) zur Genre-Angabe passen. Leere Liste = keine Erwartung.
const WORLD = ["latin", "africa", "mideast", "europe", "asia"];
const RX = [
  [/metal|grindcore/, ["metal", "rock"]],
  [/hip-?hop|rap|trap|drill|grime/, ["urban"]],
  [/r&b|soul|funk|disco/, ["urban", "pop"]],
  [/k-?pop|j-?pop|anime|j-rock|mandopop|cantopop|c-pop|bollywood|indian|asian|enka|thai|chinese|korean|japanese|punjabi|qawwali/, ["asia"]],
  [/reggaeton|latin|salsa|urbano|mexican|mexicano|tropical|brazil|sertanejo|samba|mpb|bossa|ax[eé]|forr[oó]|pagode|tango|bachata|cumbia|mariachi|banda|corridos/, ["latin"]],
  [/afro|african|amapiano|highlife|reggae|dancehall|ska|soca|zouk|kizomba/, ["africa", "latin"]],
  [/arabic|turkish|persian|middle east|ra[iï]\b|greek|israeli/, ["mideast", "europe"]],
  [/schlager|volksmusik|chanson|fado|flamenco|polka|celtic|german|french pop|italian|balkan|klezmer|europe/, ["europe", "pop"]],
  [/dance|electro|house|techno|trance|dubstep|drum|hardstyle|edm|club|synthwave|phonk|hyperpop/, ["electronic"]],
  [/punk|grunge|rock|alternative|indie|emo|shoegaze|prog/, ["rock", "metal"]],
  [/country|folk|americana|bluegrass|singer|acoustic/, ["country", "calm", "europe"]],
  [/jazz|blues|swing|bebop/, ["jazz", "calm"]],
  [/classical|opera|baroque|soundtrack|score|orchestral|films|piano/, ["classical", "calm"]],
  [/ambient|new age|easy|lo-?fi|meditation|instrumental|chill/, ["calm", "classical", "electronic"]],
  [/christian|gospel|worship/, ["spirit", "pop"]],
  [/child|kids/, ["misc", "pop"]],
  [/holiday|christmas/, ["misc", "pop"]],
  [/comedy|spoken/, ["misc"]],
  [/international|world/, WORLD],
  [/experimental|noise|avant/, ["experimental", "calm", "electronic"]],
  [/pop/, ["pop", "asia", "europe", "latin"]],
];
function expectFamily(meta) {
  const g = String(meta.genreTop || meta.apple || meta.dzGenre || meta.hxGenre || "").toLowerCase();
  if (!g) return [];
  for (const [re, fams] of RX) if (re.test(g)) return fams;
  return [];
}
// Spotify-artige Künstler-Genres: FMA-Genres kleingeschrieben („Hip-Hop“ → „hip hop“), sonst keine
function spotifyStrings(meta) {
  return (meta.fmaGenres || []).map((g) => g.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
}

module.exports = { tolerantF, boundaryF, LABEL, labelAt, expectFamily, spotifyStrings };
