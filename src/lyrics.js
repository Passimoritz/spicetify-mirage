import { S, lru } from "./core.js";
import { cfg, save } from "./config.js";
import { currentItem, titleOf, artistOf } from "./player.js";
import { createLyricStore } from "./lyricstore.js";
import { rankLyrics } from "./lyricmatch.js";

/* ---------------------------------------------------------------- Liedtext */
// Promise statt Ergebnis merken: fragen Immersiv-Modus und Overlay gleichzeitig, geht nur
// EINE Anfrage an Spotify raus
const lyricCache = lru(60);
function getLyrics(uri) {
  if (!/^spotify:(track|local):/.test(uri || "")) return Promise.resolve(null);
  // Schalter und gewählte Fassung im Schlüssel: wer umschaltet, bekommt sofort das passende Ergebnis
  const pick = cfg.onlineLyrics ? cfg.lyricPicks?.[uri] || "" : "";
  const bad = badOf(uri), key = keyOf(uri);
  if (!lyricCache.has(key)) lyricCache.set(key, keptLyrics(uri, pick, key, bad));
  return lyricCache.get(key);
}
// als falsch gemeldete Ergebnisse dieses Songs (nur mit Online-Suche: ohne sie gäbe es keinen Ersatz)
const badOf = (uri) => (cfg.onlineLyrics && cfg.lyricBad?.[uri]) || [];
// auch die Ablehnungen stehen im Schlüssel: nach „Nicht der richtige Liedtext“ zählt das alte Ergebnis nicht mehr
function keyOf(uri) {
  const pick = cfg.onlineLyrics ? cfg.lyricPicks?.[uri] || "" : "", bad = badOf(uri);
  return uri + (cfg.onlineLyrics ? "|web" : "") + (cfg.karaoke ? "|k" : "") + "|" + pick + (bad.length ? "|!" + bad.join(",") : "");
}
// Dauerhafter Speicher (IndexedDB, 500 Songs) unter demselben Schlüssel wie der Kurzzeitspeicher oben:
// ein schon geholter Liedtext steht sofort da – auch ohne Netz
const lyricStore = createLyricStore((() => {
  try {
    return window.indexedDB;
  } catch {
    return null;
  }
})());
async function keptLyrics(uri, pick, key, bad) {
  // fetchLyrics hält die Song-Daten fest, solange der Song noch läuft – darum zuerst (ohne Warten) starten lassen
  noteMeta(uri);
  const kept = await lyricStore.get(key);
  if (kept?.fresh) return kept.v;
  const got = await fetchLyrics(uri, pick, new Set(bad));
  // nur echte Ergebnisse merken: „nichts gefunden“ kann am fehlenden Netz liegen –
  // dann lieber den abgelaufenen Text von früher zeigen
  if (!got?.lines?.length && !got?.instrumental) return kept?.v || got;
  lyricStore.put(key, got);
  return got;
}
// Song-Daten je Song, damit „Fassung wählen“ später noch weiß, wonach es suchen soll
const metaCache = lru(60);
// Song-Daten jetzt festhalten – bis die Spotify-Antwort da ist, kann schon der nächste laufen
function noteMeta(uri) {
  const item = currentItem();
  const meta = item?.uri === uri ? songMeta(item) : metaCache.get(uri) || null;
  if (meta) metaCache.set(uri, meta);
  return meta;
}
// no = abgelehnte Ergebnisse („spotify“, „lrclib:123“, „netease:456“, „ovh“): die Suche geht an ihnen vorbei
async function fetchLyrics(uri, pick, no) {
  const meta = metaCache.get(uri) || noteMeta(uri);
  if (pick && !no.has("lrclib:" + pick)) {
    const hit = await lrclib("get/" + encodeURIComponent(pick));
    const got = hit && fromHit(hit);
    if (got) return got;
  }
  const own = uri.startsWith("spotify:track:") && !no.has("spotify") ? await fetchSpotify(uri) : null;
  if (own?.synced && cfg.karaoke && cfg.onlineLyrics && meta && !own.lines.some((l) => l.syl)) {
    // Karaoke braucht Wortzeiten: hat NetEase den GLEICHEN Text wortgenau, nimmt Mirage diese Fassung
    const ne = await within(fetchNetease(meta, no), 6000);
    if (ne?.wordSynced && sameLyrics(own, ne)) return { ...ne, lang: own.lang };
  }
  if (own || !cfg.onlineLyrics || !meta) return own;
  // der Reihe nach: LRCLIB → NetEase (viele zeitgenaue Texte, gerade für internationale Musik)
  // → lyrics.ovh (nur einfacher Text). Ein zeitgenauer Treffer gewinnt vor einem einfachen.
  let plain = null;
  for (const src of [fetchLrclib, fetchNetease, fetchOvh]) {
    const got = await within(src(meta, no), 7000);
    if (got?.synced || got?.instrumental) return got;
    if (got && !plain) plain = got;
  }
  return plain;
}
// Liedtext des nächsten Songs vorab holen (prefetch.js). Die Song-Daten kommen aus der Warteschlange –
// ohne Titel und Länge würde die Online-Suche ins Leere laufen und das leere Ergebnis bliebe gemerkt.
// Nur wenn der Liedtext des laufenden Songs gebraucht wurde (Immersiv, Overlay, Takt-Schätzung): sonst
// ginge für jeden Song eine Anfrage raus, die niemand ansieht.
function warmLyrics(item) {
  const m = item?.metadata || {};
  if (!item?.uri || !m.title || !(Number(m.duration) > 0)) return;
  if (!metaCache.has(currentItem()?.uri)) return;
  if (!metaCache.has(item.uri)) metaCache.set(item.uri, songMeta(item));
  getLyrics(item.uri).catch(() => {});
}
// Gleicher Text? Wörter der ersten Zeilen vergleichen und Zeilenzahl ähnlich – sonst wäre es eine andere Fassung
function sameLyrics(a, b) {
  const words = (x) => new Set(x.lines.filter((l) => l.text !== "♪").slice(0, 12).flatMap((l) => l.text.toLowerCase().split(/[^\p{L}\p{N}']+/u)).filter((w) => w.length > 1));
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return false;
  let hit = 0;
  for (const w of wa) if (wb.has(w)) hit++;
  const na = a.lines.filter((l) => l.text !== "♪").length, nb = b.lines.filter((l) => l.text !== "♪").length;
  return hit / wa.size > 0.6 && nb / na > 0.7 && nb / na < 1.45;
}
// Quelle hängt? Nach ms aufgeben statt den Liedtext ewig auf „Lädt“ zu lassen
const within = (p, ms) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);
async function fetchSpotify(uri) {
  const id = uri.split(":")[2];
  const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`;
  let body = null;
  try {
    body = await S.CosmosAsync.get(url, null, { "app-platform": "WebPlayer" });
  } catch {
    try { body = await S.CosmosAsync.get(url); } catch {}
  }
  const L = body?.lyrics;
  return L?.lines?.length
    ? {
        // SYLLABLE_SYNCED ist genauso zeitgenau, liefert aber zusätzlich Silbenzeiten (für Karaoke)
        synced: L.syncType === "LINE_SYNCED" || L.syncType === "SYLLABLE_SYNCED",
        lang: L.language || "",
        source: "spotify",
        lines: L.lines.map((l) => {
          const line = { t: Number(l.startTimeMs) || 0, text: (l.words || "").trim() || "♪" };
          const syl = (l.syllables || []).filter((x) => x && x.startTimeMs != null && Number(x.numChars) > 0);
          if (syl.length) line.syl = syl.map((x) => ({ t: Number(x.startTimeMs), n: Number(x.numChars) }));
          return line;
        }),
      }
    : null;
}

/* ---------------------------------------------------------------- Liedtext aus dem Netz */
// Hat Spotify nichts, fragt Mirage LRCLIB (freie Liedtext-Sammlung, ohne Konto). Raus gehen nur
// Titel, Künstler, Album und Länge – abschaltbar unter „Liedtext online suchen“.
function songMeta(item) {
  const m = item.metadata || {};
  const ms = Number(m.duration) || Number(item.duration?.milliseconds) || Number(S.Player.data?.duration) || 0;
  return {
    title: titleOf(item),
    artist: m.artist_name || artistOf(item).split(", ")[0] || "",
    album: m.album_title || item.album?.name || "",
    sec: Math.round(ms / 1000),
  };
}
// „Song - Remastered 2011“, „Song (feat. X)“ → „Song“: so stehen die Titel bei LRCLIB
const cleanTitle = (s) => s.replace(/\s+-\s+.*(remaster|version|edit|live|mix|mono|stereo).*$/i, "").replace(/\s*[([](feat|ft|with)\.?\s[^)\]]*[)\]]/gi, "").trim();
const LRCLIB = "https://lrclib.net/api/";
async function lrclib(path) {
  try {
    const res = await fetch(LRCLIB + path, { headers: { "Lrclib-Client": "mirage (https://github.com/Passimoritz/spicetify-mirage)" } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
// LRCLIB-Eintrag in der Form, die lyricmatch.js bewertet (Länge, Fassungswörter, Titel, Künstler)
const lrcUsable = (x) => !!x && !!(x.syncedLyrics || x.plainLyrics || x.instrumental);
const lrcCand = (x) => ({ id: x.id, title: x.trackName || x.name || "", artist: x.artistName || "", album: x.albumName || "", sec: Math.round(x.duration || 0), synced: !!x.syncedLyrics, hit: x });
const idsOf = (no, src) => [...(no || [])].filter((s) => s.startsWith(src + ":")).map((s) => s.slice(src.length + 1));
async function fetchLrclib(meta, no) {
  if (!meta.title || !meta.artist) return null;
  const qs = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  const title = cleanTitle(meta.title) || meta.title, bad = idsOf(no, "lrclib");
  // 1. genauer Treffer (LRCLIB lässt dabei ±2 s Länge zu), 2. Suche. Beides bewertet lyricmatch.js:
  // passende Länge und Fassung zuerst; ein Live-Song bekommt die Zeiten der Studiofassung nicht.
  const hit = meta.sec ? await lrclib("get?" + qs({ track_name: title, artist_name: meta.artist, album_name: meta.album, duration: meta.sec })) : null;
  let ranked = rankLyrics(meta, lrcUsable(hit) ? [lrcCand(hit)] : [], bad);
  // nur weitersuchen, wenn der genaue Treffer fehlt, abgelehnt ist oder keine brauchbaren Zeiten hat
  if (!ranked[0] || ranked[0].plainOnly || !(ranked[0].synced || hit?.instrumental)) {
    const list = await lrclib("search?" + qs({ track_name: title, artist_name: meta.artist }));
    ranked = rankLyrics(meta, [hit, ...(Array.isArray(list) ? list : [])].filter(lrcUsable).map(lrcCand), bad);
  }
  for (const c of ranked) {
    const got = fromHit(c.hit, c.plainOnly);
    if (got) return got;
  }
  return null;
}
// plainOnly: der Text passt, die Zeiten nicht (andere Fassung, andere Länge) → als einfacher Text zeigen
function fromHit(hit, plainOnly) {
  const base = { lang: "", source: "lrclib", lrcId: hit.id };
  if (hit.instrumental) return { ...base, synced: false, instrumental: true, lines: [] };
  const synced = parseLrc(hit.syncedLyrics || "");
  if (synced.length && !plainOnly) return { ...base, synced: true, lines: synced };
  if (synced.length && !hit.plainLyrics) return { ...base, synced: false, lines: synced.map((l) => ({ t: 0, text: l.text })) };
  const plain = (hit.plainLyrics || "").split(/\r?\n/).map((x) => x.trim());
  while (plain.length && !plain[plain.length - 1]) plain.pop();
  return plain.length ? { ...base, synced: false, lines: plain.map((text) => ({ t: 0, text: text || "♪" })) } : null;
}

/* ---- NetEase Cloud Music */
// Über Spotifys eigene Netzwerkschicht (CosmosAsync): music.163.com erlaubt keine Browser-Anfragen
// von fremden Seiten. Raus gehen nur Titel und Künstler.
const NE = "https://music.163.com/api/";
async function netease(path) {
  try {
    const r = await S.CosmosAsync.get(NE + path);
    return typeof r === "string" ? JSON.parse(r) : r;
  } catch {
    return null;
  }
}
// Mitwirkenden-Zeilen am Anfang („作词 : …“, „Composer: …“) sind kein Liedtext
const CREDIT = /^(作词|作曲|编曲|制作|混音|母带|和声|吉他|贝斯|鼓|录音|监制|出品|lyricist|lyrics|composer|arranger|producer|mixed|mastered)\s*[:：]/i;
const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
async function fetchNetease(meta, no) {
  if (!meta.title || !meta.artist) return null;
  const title = cleanTitle(meta.title) || meta.title;
  const res = await netease(`search/get?s=${encodeURIComponent(title + " " + meta.artist)}&type=1&limit=10`);
  const songs = res?.result?.songs || [];
  const a = norm(meta.artist), tt = norm(title);
  // passender Künstler und Titel; Länge und Fassung bewertet lyricmatch.js (NetEase-Texte sind zeitgenau:
  // was nur als einfacher Text taugte, fällt hier weg)
  const fits = songs.filter((s) => (s.artists || []).some((x) => norm(x.name).includes(a) || a.includes(norm(x.name))) && (norm(s.name).includes(tt) || tt.includes(norm(s.name))));
  const fit = rankLyrics(meta, fits.map((s) => ({ id: s.id, title: s.name, artist: meta.artist, album: s.album?.name || "", sec: Math.round((s.duration || 0) / 1000), synced: true })), idsOf(no, "netease")).find((c) => !c.plainOnly);
  if (!fit) return null;
  const lyr = (await netease(`song/lyric/v1?id=${fit.id}&cp=false&tv=0&lv=0&rv=0&kv=0&yv=0&ytv=0&yrv=0`)) || (await netease(`song/lyric?id=${fit.id}&lv=-1&kv=-1&tv=-1&rv=-1`));
  if (lyr?.nolyric || lyr?.pureMusic) return { lang: "", source: "netease", neId: fit.id, synced: false, instrumental: true, lines: [] };
  const clean = (ls) => ls.filter((l, i) => !(i < 12 && CREDIT.test(l.text)));
  const lines = clean(parseLrc(lyr?.lrc?.lyric || ""));
  // Romaji (Lautschrift) gibt es bei NetEase zu vielen japanischen Songs – für die Lautschrift-Zeile
  const rom = clean(parseLrc(lyr?.romalrc?.lyric || ""));
  // YRC = jedes Wort mit eigener Zeit; nur nehmen, wenn sie den Song wirklich abdeckt
  const yrc = clean(parseYrc(lyr?.yrc?.lyric || ""));
  if (yrc.length && yrc.length >= lines.length * 0.6) return { lang: "", source: "netease", neId: fit.id, synced: true, wordSynced: true, lines: yrc, rom };
  return lines.length ? { lang: "", source: "netease", neId: fit.id, synced: true, lines, rom } : null;
}
// nur die Romaji eines Songs (wenn der Liedtext aus einer anderen Quelle kommt), einmal je Song
const romCache = new Map();
function romajiFor(item) {
  const uri = item?.uri || "";
  if (!romCache.has(uri)) romCache.set(uri, fetchNetease(songMeta(item)).then((r) => r?.rom || [], () => []));
  return romCache.get(uri);
}
// NetEase-YRC: „[Start,Dauer](Start,Dauer,0)Wort (Start,Dauer,0)Wort …“ – Zeilen mit „{…}“ sind Mitwirkende
function parseYrc(text) {
  const out = [];
  for (const row of text.split(/\r?\n/)) {
    const head = /^\[(\d+),(\d+)\]/.exec(row);
    if (!head) continue;
    const words = [];
    for (const m of row.slice(head[0].length).matchAll(/\((\d+),(\d+),\d+\)([^(]*)/g)) {
      if (!m[3]) continue;
      words.push({ t: Number(m[1]), d: Number(m[2]), raw: m[3] });
    }
    if (!words.length) continue;
    out.push(wordLine(Number(head[1]), words));
  }
  return out.sort((a, b) => a.t - b.t);
}
// Wörter zu einer Zeile: Leerzeichen nur, wo der Text eines hat – oder zwischen zwei lateinischen Wörtern,
// die NetEase manchmal ohne Abstand liefert („how(…)to“). Chinesisch/Japanisch bleibt ohne Abstände.
function wordLine(t, words) {
  const latin = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\d]/u;
  const list = words.map((w, i) => {
    const txt = w.raw.trim();
    const next = words[i + 1]?.raw.trim() || "";
    const sp = i < words.length - 1 && (/\s$/.test(w.raw) || /^\s/.test(words[i + 1].raw) || (latin.test(txt.slice(-1)) && latin.test(next.charAt(0))));
    return { t: w.t, d: w.d, text: txt, sp };
  }).filter((w) => w.text);
  return { t, text: list.map((w) => w.text + (w.sp ? " " : "")).join("").trim() || "♪", words: list };
}

/* ---- lyrics.ovh: nur einfacher Text, aber riesige Sammlung */
async function fetchOvh(meta, no) {
  if (!meta.title || !meta.artist || no?.has("ovh")) return null;
  try {
    const title = cleanTitle(meta.title) || meta.title;
    const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(meta.artist)}/${encodeURIComponent(title)}`);
    const text = res.ok ? (await res.json())?.lyrics || "" : "";
    const plain = text.replace(/^Paroles de la chanson.*\r?\n/i, "").split(/\r?\n/).map((x) => x.trim());
    while (plain.length && !plain[0]) plain.shift();
    while (plain.length && !plain[plain.length - 1]) plain.pop();
    return plain.length > 2 ? { lang: "", source: "ovh", synced: false, lines: plain.map((t) => ({ t: 0, text: t || "♪" })) } : null;
  } catch {
    return null;
  }
}

/* ---- Fassung wählen */
// Alle LRCLIB-Treffer zum Song, passendste Länge und zeitgenaue Texte zuerst
async function lyricVersions(uri) {
  const meta = metaCache.get(uri) || (currentItem()?.uri === uri ? songMeta(currentItem()) : null);
  if (!meta?.title) return [];
  const title = cleanTitle(meta.title) || meta.title;
  const q = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  let list = await lrclib("search?" + q({ track_name: title, artist_name: meta.artist }));
  if (!Array.isArray(list) || !list.length) list = await lrclib("search?" + q({ q: `${title} ${meta.artist}` }));
  const diff = (x) => (meta.sec ? Math.abs((x.duration || 0) - meta.sec) : 0);
  // was zu dieser Aufnahme passt (Länge, Fassung), steht oben; der Rest folgt wie bisher nach Länge
  const usable = (Array.isArray(list) ? list : []).filter(lrcUsable);
  const fit = rankLyrics(meta, usable.map(lrcCand)).map((c) => c.hit);
  return [...fit, ...usable.filter((x) => !fit.includes(x)).sort((a, b) => !!b.syncedLyrics - !!a.syncedLyrics || diff(a) - diff(b))]
    .slice(0, 12)
    .map((x) => ({ id: x.id, title: x.trackName, artist: x.artistName, album: x.albumName, sec: Math.round(x.duration || 0), synced: !!x.syncedLyrics, instrumental: !!x.instrumental }));
}
// id = LRCLIB-Eintrag, leer = wieder automatisch (Spotify zuerst)
function pickLyrics(uri, id) {
  // „Automatisch“ vergisst auch die Ablehnungen; eine von Hand gewählte Fassung gilt nicht länger als falsch
  const bad = { ...(cfg.lyricBad || {}) };
  if (!id) delete bad[uri];
  else if (bad[uri]) bad[uri] = bad[uri].filter((s) => s !== "lrclib:" + id);
  cfg.lyricBad = bad;
  const picks = { ...(cfg.lyricPicks || {}) };
  delete picks[uri];
  if (id) picks[uri] = String(id);
  // nur die letzten 200 Wahlen behalten
  const keys = Object.keys(picks);
  for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete picks[k];
  cfg.lyricPicks = picks;
  save();
}
/* ---- Nicht der richtige Liedtext */
// Kennung eines Ergebnisses: Quelle, bei Sammlungen mit mehreren Einträgen je Song auch der Eintrag
const sigOf = (lyr) => (!lyr ? "" : lyr.source === "lrclib" && lyr.lrcId ? "lrclib:" + lyr.lrcId : lyr.source === "netease" && lyr.neId ? "netease:" + lyr.neId : lyr.source || "spotify");
// Das gezeigte Ergebnis für diesen Song als falsch merken; der nächste getLyrics-Aufruf sucht daran vorbei.
function rejectLyrics(uri, lyr) {
  const sig = sigOf(lyr);
  if (!uri || !sig) return false;
  // der gemerkte Text unter dem alten Schlüssel wird nicht mehr gebraucht
  lyricStore.drop(keyOf(uri));
  const all = { ...(cfg.lyricBad || {}) }, list = (all[uri] || []).filter((s) => s !== sig);
  delete all[uri];
  all[uri] = [...list, sig].slice(-12);
  // nur die letzten 200 Songs behalten
  const keys = Object.keys(all);
  for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete all[k];
  cfg.lyricBad = all;
  // war es die von Hand gewählte Fassung, gilt die Wahl nicht mehr
  if (cfg.lyricPicks?.[uri] && sig === "lrclib:" + cfg.lyricPicks[uri]) {
    const picks = { ...cfg.lyricPicks };
    delete picks[uri];
    cfg.lyricPicks = picks;
  }
  save();
  return true;
}
const rejectedCount = (uri) => (cfg.lyricBad?.[uri] || []).length;

// „[01:02.34] Text“ – eine Zeile darf mehrere Zeitmarken tragen (Refrain)
const lrcMs = (m, sec) => Math.round((Number(m) * 60 + Number(String(sec).replace(":", "."))) * 1000);
function parseLrc(lrc) {
  const out = [];
  for (const row of lrc.split(/\r?\n/)) {
    const marks = [...row.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    // Enhanced LRC: Wortzeiten in spitzen Klammern
    if (marks.length === 1 && /<\d+:\d+(?:\.\d+)?>/.test(row)) {
      const body = row.slice(marks[0].index + marks[0][0].length);
      const parts = [...body.matchAll(/<(\d+):(\d+(?:\.\d+)?)>([^<]*)/g)].map((m) => ({ t: lrcMs(m[1], m[2]), raw: m[3] }));
      const words = parts.filter((w) => w.raw.trim()).map((w, i, a) => ({ ...w, d: Math.max(80, (a[i + 1]?.t ?? w.t + 600) - w.t) }));
      if (words.length) {
        out.push(wordLine(lrcMs(marks[0][1], marks[0][2]), words));
        continue;
      }
    }
    if (!marks.length) continue;
    const text = row.slice(marks[marks.length - 1].index + marks[marks.length - 1][0].length).trim() || "♪";
    for (const m of marks) out.push({ t: Math.round((Number(m[1]) * 60 + Number(m[2].replace(":", "."))) * 1000), text });
  }
  return out.sort((a, b) => a.t - b.t);
}

/* ---------------------------------------------------------------- Übersetzung */
// Nur auf ausdrücklichen Wunsch (Einstellung „Liedtext übersetzen“, aus ab Werk): die Zeilen gehen
// dafür an Google Translate. Ein Aufruf pro Song, Ergebnis wird gemerkt.
const trCache = lru(40);
async function translateLines(uri, lyr, target) {
  if (!lyr?.lines?.length) return null;
  const lang = (lyr.lang || "").slice(0, 2).toLowerCase();
  if (lang && lang === target) return null;
  const key = uri + ":" + target;
  if (trCache.has(key)) return trCache.get(key);
  const text = lyr.lines.map((l) => (l.text === "♪" ? "" : l.text)).join("\n");
  let out = null;
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`
    );
    const data = await res.json();
    // data[2] = erkannte Quellsprache; gleich der Zielsprache → nichts anzeigen
    if (data?.[2] !== target) {
      const lines = (data?.[0] || []).map((p) => p[0]).join("").split("\n");
      out = lyr.lines.map((l, i) => (l.text === "♪" ? "" : (lines[i] || "").trim()));
    }
  } catch {}
  trCache.set(key, out);
  return out;
}

/* ---------------------------------------------------------------- Canvas-Videos */
// Die kurzen Spotify-Loops hinter manchen Songs. Spotify liefert sie über eine interne Abfrage;
// fehlt sie in einer Spotify-Version, bleibt es einfach beim Cover.
const canvasCache = lru(60);
async function getCanvas(uri) {
  if (!uri?.startsWith("spotify:track:")) return null;
  if (canvasCache.has(uri)) return canvasCache.get(uri);
  let url = null;
  try {
    const G = S.GraphQL;
    const def = G?.Definitions?.canvas;
    if (def && G.Request) {
      // Spotify hat die Variable umbenannt (uri → trackUri): beide mitschicken, dann passt es für alte und neue Versionen
      const r = await G.Request(def, { trackUri: uri, uri });
      url = r?.data?.trackUnion?.canvas?.url || null;
      if (url && !/\.mp4(\?|$)/.test(url)) url = null; // Bild-Canvas: das Cover reicht
    }
  } catch {}
  canvasCache.set(uri, url);
  return url;
}

// Hat das Spotify-Konto Canvas ausgeschaltet (Schalter „Canvas“ in der Spotify-Handy-App, gilt fürs ganze Konto),
// liefert Spotify für jeden Song „kein Canvas“. Das erkennen wir, damit der Knopf erklären kann, woran es liegt.
let canvasOff = null;
async function canvasBlocked() {
  if (canvasOff !== null) return canvasOff;
  try {
    const v = await S.Platform?.ProductStateAPI?.getValues?.();
    canvasOff = v?.["canvas-disabled"] === "1";
  } catch {
    canvasOff = false;
  }
  return canvasOff;
}

// Anzeigename der Quelle (Knopf „Fassung wählen“, Overlay)
const SOURCE_NAME = { spotify: "Spotify", lrclib: "LRCLIB", netease: "NetEase", ovh: "lyrics.ovh" };

export { getLyrics, warmLyrics, lyricVersions, pickLyrics, rejectLyrics, rejectedCount, translateLines, getCanvas, canvasBlocked, romajiFor, SOURCE_NAME };
