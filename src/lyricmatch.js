/* ---------------------------------------------------------------- Liedtext-Treffer bewerten */
// Welcher Eintrag einer Liedtext-Sammlung gehört zu genau DIESER Aufnahme? Eine Live-Fassung oder ein Remix
// darf nicht den zeitgenauen Text der Studiofassung bekommen: die Zeilen liefen dem Gesang davon.
// Verglichen werden Länge (wenige Sekunden Spielraum), Fassungswörter im Titel-Zusatz, Titel und Künstler.
// Ohne Zugriff auf Spotify oder das Fenster – darum einzeln testbar (tests/unit/lyricmatch.test.js,
// tests/unit/lyrics-match.test.js).
import { cyrillic, cyrLang, greek } from "./translit.js";
import { hangul, kana } from "./roman.js";

// Vergleichsform: klein, ohne Akzente, „&“ = „and“, „Pt. 2“ = „Part 2“, nur Buchstaben und Ziffern
const fold = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/ß/g, "ss")
    .replace(/\s*[&＆+]\s*/g, " and ")
    .replace(/\bpt\.?\s*(?=\d)/g, "part ")
    .replace(/[^\p{L}\p{N}]+/gu, "");
const LATIN = /\p{Script=Latin}/u, LETTER = /\p{L}/u;
// nicht-lateinische Schrift? (dann lohnt der Vergleich über eine Umschrift)
const foreign = (s) => LETTER.test(s) && !LATIN.test(s);
// Umschrift für den Vergleich: Hangul, Kana, Kyrillisch, Griechisch – Han-Zeichen bleiben, wie sie sind
function latin(s) {
  let x = String(s || "");
  if (/[가-힣]/.test(x)) x = hangul(x);
  if (/[぀-ヿ]/.test(x) && !/\p{Script=Han}/u.test(x)) x = kana(x) || x;
  if (/\p{Script=Cyrillic}/u.test(x)) x = cyrillic(x, cyrLang(x));
  if (/\p{Script=Greek}/u.test(x)) x = greek(x);
  return x;
}
// Umschriften schreiben dieselben Laute verschieden (Yolka/Jolka/Iolka, Tchaikovsky/Chaikovsky)
const sound = (s) => fold(latin(s)).replace(/[yji]/g, "i").replace(/tch|ch/g, "c").replace(/(.)\1+/g, "$1").replace(/h/g, "");

// Fassungswörter: hart = anderer Gesang oder andere Zeiten, weich = meist nur anders geschnitten.
// „Remastered“, „Mono“, „Album Version“, „Original Mix“ fehlen mit Absicht: das ist dieselbe Aufnahme.
const TAGS = [
  ["live", /\b(live|unplugged|in concert|konzert|mtv session|bbc session|live lounge)\b/, true],
  ["remix", /\b(remix|rmx|bootleg|mashup|mash-up|club mix|dub mix|dub|vip mix|rework|flip)\b/, true],
  ["acoustic", /\b(acoustic|akustik|stripped|piano version)\b/, true],
  ["instrumental", /\b(instrumental|inst\.?|karaoke|backing track|a ?cappella|acapella|off vocal)\b|伴奏|カラオケ/, true],
  ["speed", /\b(sped up|speed up|slowed|nightcore|daycore)\b/, true],
  ["cover", /\b(cover|tribute|originally performed)\b/, true],
  ["demo", /\b(demo|rough mix|early take|outtake)\b/, true],
  ["orchestral", /\b(orchestral|symphonic|orchestra version)\b/, true],
  ["extended", /\b(extended|long version|full length|12 inch)\b/, false],
  ["edit", /\b(radio edit|single edit|short version|edit)\b/, false],
];
const HARD = new Set(TAGS.filter((x) => x[2]).map((x) => x[0]));
// Sprachfassung („English Version“, „Japanese Ver.“, „Versión en español“): ganz anderer Text
const LANGS = "english|japanese|korean|chinese|mandarin|cantonese|spanish|español|espanol|french|français|francais|german|deutsch|deutsche|italian|italiano|portuguese|português|russian|thai|vietnamese|hindi|turkish|tagalog|indonesian";
// gleiche Sprache, verschieden geschrieben („Spanish Version“ = „Versión en español“)
const LANG_CODE = { english: "en", japanese: "ja", korean: "ko", chinese: "zh", mandarin: "zh", cantonese: "yue", spanish: "es", espanol: "es", french: "fr", francais: "fr", german: "de", deutsch: "de", deutsche: "de", italian: "it", italiano: "it", portuguese: "pt", portugues: "pt", russian: "ru", thai: "th", vietnamese: "vi", hindi: "hi", turkish: "tr", tagalog: "tl", indonesian: "id" };
const LANG_RE =new RegExp(`\\b(${LANGS})\\s*(version|ver\\.?|vers\\.?)|\\b(version|versión|versione|versão)\\s+(en\\s+|in\\s+|em\\s+)?(${LANGS})\\b`, "i");
// Nur der Zusatz zählt („Song - Live at Wembley“, „Song (Acoustic)“) – sonst wäre „Live and Let Die“ ein Konzert
const BRACKETS = /[([（【［〔]([^)\]）】］〕]*)[)\]）】］〕]/g;
const extras = (title) => {
  const s = String(title || "").toLowerCase();
  const out = [...s.matchAll(BRACKETS)].map((m) => m[1]);
  const dash = s.search(/\s[-–—]\s/);
  if (dash >= 0) out.push(s.slice(dash + 3));
  return out.join(" | ");
};
function versionTags(title, album) {
  const ex = extras(title), tags = new Set();
  for (const [name, re] of TAGS) if (re.test(ex)) tags.add(name);
  const lang = LANG_RE.exec(ex);
  if (lang) tags.add("lang:" + (LANG_CODE[fold(lang[1] || lang[5])] || fold(lang[1] || lang[5])));
  // Konzertalben nennen die Titel oft ohne Zusatz
  if (/\blive (at|in|from|on|aus|im)\b|\(live\)|\bunplugged\b/i.test(String(album || ""))) tags.add("live");
  return tags;
}
// „Song - Remastered 2011“, „Song (feat. X)“, „Song (Live)“, „Song feat. X“ → „Song“. Nur Zusätze, die eine
// Fassung, Gäste oder eine Herkunft (Film, Serie) nennen: „Song (Part 2)“ und „Sinfonie Nr. 5 - Allegro“ bleiben
const EXTRA = new RegExp(
  "\\b(remaster(ed)?|re-?recorded|version|vers\\.?|ver\\.?|edit|live|mix|remix|mono|stereo|acoustic|demo|instrumental|inst|karaoke|session|sessions|unplugged|bonus|deluxe|sped up|slowed|nightcore|feat|ft|featuring|with|from|explicit|clean|single|radio|anniversary|soundtrack|ost|theme|opening|ending|op|ed|bootleg|cover|(19|20)\\d\\d)\\b|主题曲|主題歌|插曲|挿入歌|片尾曲|片头曲|オープニング|エンディング|アニメ|ドラマ|映画|电视剧|电影",
  "i"
);
const baseTitle = (title) =>
  String(title || "")
    .replace(/\s*[([（【［〔]([^)\]）】］〕]*)[)\]）】］〕]/g, (all, inner) => (EXTRA.test(inner) ? "" : all))
    .replace(/\s[-–—]\s(.*)$/, (all, rest) => (EXTRA.test(rest) ? "" : all))
    // Gäste ohne Klammern: „Song feat. X“, „Song ft. X“ (nicht „With or Without You“: nur feat/ft/featuring)
    .replace(/\s+(feat\.?|ft\.|featuring)\s.*$/i, "")
    .trim() || String(title || "");
// ganz ohne Zusätze – für Sammlungen, die Übersetzungen in Klammern anhängen („Lemon (柠檬)“)
const bareTitle = (title) => String(title || "").replace(/\s*[([（【［〔][^)\]）】］〕]*[)\]）】］〕]/g, "").replace(/\s[-–—]\s.*$/, "").trim() || String(title || "");

// Ähnlichkeit zweier Wörter 0..1 (Tippfehler, „Thru“/„Through“ bleiben draußen: nur fast gleiche)
function similar(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}
// Titelvergleich → { pen } oder null. cross = nur über verschiedene Schriften vergleichbar (Lemon/レモン)
function titleFit(ta, tb) {
  const a = fold(baseTitle(ta)), b = fold(baseTitle(tb));
  if (a && a === b) return { pen: 0 };
  const a0 = fold(bareTitle(ta)), b0 = fold(bareTitle(tb));
  if (a0 && a0 === b0) return { pen: 2 };
  if (a && b && (foreign(ta) || foreign(tb)) && sound(baseTitle(ta)) === sound(baseTitle(tb))) return { pen: 2 };
  if (!a || !b) return null;
  // andere Nummer = anderes Stück („Part 1“/„Part 2“, „Bound“/„Bound 2“)
  const num = (x) => (x.match(/\d+/g) || []).join(",");
  if (num(a) !== num(b)) return null;
  // Teil des anderen Titels: nur, wenn er den größten Teil ausmacht („Hey“ ist nicht „Hey Jude“)
  const s = a.length < b.length ? a : b, l = a.length < b.length ? b : a;
  if (s.length >= 3 && l.includes(s) && s.length / l.length >= 0.6) return { pen: 6 };
  // fast gleich geschrieben („Nite“/„Night“); lange Titel vertragen etwas mehr Abweichung
  if (Math.min(a.length, b.length) >= 6 && similar(a, b) >= (s.length >= 12 ? 0.8 : 0.85)) return { pen: 5 };
  if (foreign(baseTitle(ta)) !== foreign(baseTitle(tb))) return { pen: 10, cross: true };
  return null;
}

// Künstler einzeln: „A & B“, „A, B“, „A feat. B“, „A x B“, „A/B“ … – führendes „The“ zählt nicht
const SPLIT = /\s*(?:,|;|\/|、|＆|&|\+|\band\b|\bund\b|\bx\b|×|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bvs\.?)\s*/i;
// Zeichen als Buchstaben: „P!nk“ = „Pink“, „Ke$ha“ = „Kesha“, „A$AP“ = „ASAP“
const oneArtist = (s) => fold(String(s || "").replace(/^\s*the\s+/i, "").replace(/(?<=\p{L})!(?=\p{L})/gu, "i").replace(/(?<=\p{L})\$/gu, "s"));
const artistList = (s) => [String(s || ""), ...String(s || "").split(SPLIT)].map((x) => x.trim()).filter(Boolean);
// „yes“, „no“ oder „unknown“ (verschiedene Schriften, Umschrift passt nicht: 宇多田ヒカル gegen Hikaru Utada)
function artistFit(metaArtist, candArtist) {
  const A = artistList(metaArtist), B = artistList(candArtist);
  if (!A.length || !B.length) return "unknown";
  for (const x of A) {
    const fx = oneArtist(x), sx = sound(x);
    if (!fx) continue;
    for (const y of B) {
      const fy = oneArtist(y);
      if (!fy) continue;
      if (fx === fy || ((foreign(x) || foreign(y)) && sx === sound(y))) return "yes";
      // „Beyoncé“ in „Beyoncé Knowles“, nicht aber „Ye“ in „Yes“
      const s = fx.length < fy.length ? fx : fy, l = fx.length < fy.length ? fy : fx;
      if (s.length >= 4 && l.includes(s)) return "yes";
    }
  }
  return A.some((x) => foreign(x)) !== B.some((y) => foreign(y)) || A.some((x) => foreign(x) && /\p{Script=Han}/u.test(x)) ? "unknown" : "no";
}

const TOL_SYNCED = 4, TOL_PLAIN = 12;
// lange Stücke dürfen etwas mehr abweichen (Stille am Ende, Ausblenden): 1,5 % der Länge, mindestens 4 s
const tolSynced = (sec) => Math.max(TOL_SYNCED, Math.round((sec || 0) * 0.015));
// meta = { title, artist, artists?, album, sec } des laufenden Songs · cand = { id, title, artist, album, sec, synced }
// Ergebnis: score (kleiner = besser, Infinity = passt nicht) und plainOnly (Text ja, Zeiten nein)
function matchScore(meta, cand) {
  let score = 0, plainOnly = false;
  const no = { score: Infinity, plainOnly };
  const tf = titleFit(meta.title, cand.title);
  if (!tf) return no;
  score += tf.pen;
  const af = artistFit(meta.artists?.length ? meta.artists.join(", ") : meta.artist, cand.artist);
  if (af === "no") return no;
  const d = meta.sec && cand.sec ? Math.abs(cand.sec - meta.sec) : null;
  if (af === "unknown") {
    // weder Titel noch Künstler direkt vergleichbar: zu unsicher
    if (tf.cross || d === null || d > 3) return no;
    score += 8;
  }
  // anderer Titel in anderer Schrift: nur mit sicherem Künstler und fast gleicher Länge
  if (tf.cross && (af !== "yes" || d === null || d > 2)) return no;
  // Fassung: jedes Wort, das nur eine Seite trägt
  const mt = versionTags(meta.title, meta.album), ct = versionTags(cand.title, cand.album);
  for (const tag of new Set([...mt, ...ct])) {
    if (mt.has(tag) === ct.has(tag)) continue;
    // Gesang gegen Instrumental, andere Sprachfassung: der Text wäre schlicht falsch
    if (tag === "instrumental" || tag.startsWith("lang:")) return no;
    if (HARD.has(tag)) {
      plainOnly = true;
      score += 25;
    } else score += 8;
  }
  // Länge: innerhalb weniger Sekunden gilt als dieselbe Aufnahme
  if (d !== null) {
    if (d > TOL_PLAIN) return { score: Infinity, plainOnly };
    if (d > tolSynced(meta.sec)) {
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

/* ---- Instrumental erkennen */
// Der Titel sagt es schon („Song - Instrumental“, „Off Vocal“, „伴奏“): gar nicht erst online suchen
const instrumentalMeta = (meta) => versionTags(meta?.title, "").has("instrumental");
// Platzhalter der Sammlungen statt eines Textes („纯音乐，请欣赏“ bei NetEase, „[Instrumental]“ bei anderen)
const INSTR_TEXT = /^[\s[(（【♪♫*-]*(instrumental|instrumentals?|inst\.?|no lyrics|纯音乐[,，]?\s*请(您)?欣赏|此歌曲为没有填词的纯音乐[,，]?\s*请(您)?欣赏|純音樂[,，]?\s*請欣賞|インスト|間奏|器乐)[\s\])）】♪♫*.!-]*$/i;
function instrumentalText(lines) {
  const ls = (lines || []).map((l) => String(l?.text ?? l ?? "").trim()).filter((s) => s && s !== "♪");
  return ls.length > 0 && ls.length <= 3 && ls.every((s) => INSTR_TEXT.test(s));
}

/* ---- Mitwirkende und Kopfzeilen weg */
// „作词 : …“, „Composer: …“, „Lyrics by：…“ am Anfang sind kein Liedtext, ebenso die Kopfzeile
// „Titel - Künstler“, die manche Sammlungen (Kugou) vor die erste Zeile stellen
const CREDIT = /^(作词|作詞|作曲|编曲|編曲|制作人?|製作|混音|母带|和声|吉他|贝斯|鼓|录音|監製|监制|出品|词|詞|曲|lyricist|lyrics|lyrics by|written by|composer|composed by|arranger|arranged by|producer|produced by|mixed by|mastered by|mixed|mastered)\s*[:：]/i;
function cleanCredits(lines, meta) {
  const head = fold(baseTitle(meta?.title || ""));
  return (lines || []).filter((l, i) => {
    if (i >= 12) return true;
    const s = String(l.text || "");
    if (CREDIT.test(s)) return false;
    // „Yellow - Coldplay (酷玩乐队)“ ganz am Anfang
    return !(i < 3 && head && / - /.test(s) && fold(baseTitle(s.split(" - ")[0])) === head);
  });
}

/* ---- Gleicher Text? */
// Wörter der ersten Zeilen vergleichen und Zeilenzahl ähnlich – sonst wäre es eine andere Fassung (oder
// eine andere Sprachfassung: dann teilen sich die Texte kaum Wörter)
const WORDS = /[^\p{L}\p{N}']+/u;
function lyricWords(x) {
  const ls = (x?.lines || []).filter((l) => l.text !== "♪").slice(0, 12);
  // Chinesisch/Japanisch ohne Leerzeichen: Zeichenpaare statt Wörter
  return new Set(ls.flatMap((l) => {
    const t = String(l.text || "").toLowerCase();
    if (/[\p{Script=Han}぀-ヿ]/u.test(t)) {
      const c = [...t.replace(/[\s\p{P}]+/gu, "")];
      return c.slice(1).map((ch, i) => c[i] + ch);
    }
    return t.split(WORDS);
  }).filter((w) => w.length > 1));
}
function sameLyrics(a, b, min = 0.6) {
  const wa = lyricWords(a), wb = lyricWords(b);
  if (!wa.size || !wb.size) return false;
  let hit = 0;
  for (const w of wa) if (wb.has(w)) hit++;
  const na = a.lines.filter((l) => l.text !== "♪").length, nb = b.lines.filter((l) => l.text !== "♪").length;
  return hit / wa.size > min && nb / na > 0.7 && nb / na < 1.45;
}

/* ---- Wie gut ist ein Ergebnis? */
// 0 nichts · 1 nur Text · 2 zeitgenau (oder sicher instrumental) · 3 Wort für Wort (zählt nur mit Karaoke)
function tierOf(lyr, karaoke) {
  if (!lyr) return 0;
  if (lyr.instrumental) return 2;
  if (!lyr.lines?.length) return 0;
  if (!lyr.synced) return 1;
  return karaoke && (lyr.wordSynced || lyr.lines.some((l) => l.syl?.length || l.words?.length)) ? 3 : 2;
}

export { versionTags, baseTitle, bareTitle, matchScore, rankLyrics, titleFit, artistFit, fold, instrumentalMeta, instrumentalText, cleanCredits, sameLyrics, tierOf, tolSynced, TOL_SYNCED, TOL_PLAIN };
