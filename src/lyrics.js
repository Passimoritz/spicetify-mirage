import { S, lru } from "./core.js";
import { cfg, save } from "./config.js";
import { currentItem, titleOf, artistOf } from "./player.js";
import { createLyricStore } from "./lyricstore.js";
import { rankLyrics, baseTitle, instrumentalMeta, instrumentalText, cleanCredits, tierOf } from "./lyricmatch.js";
import { runLyrics } from "./lyricflow.js";
import { parseLrc, parseYrc, parseTtml } from "./lyricparse.js";

/* ---------------------------------------------------------------- Liedtext */
// Je Song EIN Ladevorgang („Auftrag“): fragen Immersiv-Modus, Overlay und Handys gleichzeitig, geht nur eine
// Anfrage je Quelle raus. Der Auftrag meldet jedes bessere Zwischenergebnis (watchLyrics: der Text steht da,
// sobald die erste Quelle antwortet, und wird später an Ort und Stelle besser) und am Ende das Ergebnis
// (getLyrics). Ein übersprungener Song bricht seine noch laufenden Anfragen ab (dropStaleLyrics).
const jobs = new Map();
const MAX_JOBS = 60;
function jobFor(uri) {
  if (!/^spotify:(track|local):/.test(uri || "")) return null;
  // Schalter und gewählte Fassung im Schlüssel: wer umschaltet, bekommt sofort das passende Ergebnis
  const pick = cfg.onlineLyrics ? cfg.lyricPicks?.[uri] || "" : "";
  const bad = badOf(uri), key = keyOf(uri);
  let job = jobs.get(key);
  if (job) {
    // zuletzt gebraucht ans Ende (ältester fliegt zuerst raus)
    jobs.delete(key);
    jobs.set(key, job);
    return job;
  }
  job = { uri, key, cur: undefined, subs: new Set(), ctrl: new AbortController(), done: false };
  // nur Verbesserungen melden: gleich gute Ergebnisse tauschen nie (das würde flackern)
  job.emit = (v) => {
    if (job.ctrl.signal.aborted || !v || tierOf(v, cfg.karaoke) <= tierOf(job.cur, cfg.karaoke)) return;
    job.cur = v;
    for (const f of [...job.subs]) f(v, false);
  };
  job.promise = keptLyrics(uri, pick, key, bad, job).then(
    (v) => ((job.done = true), v),
    () => ((job.done = true), job.cur || null)
  );
  jobs.set(key, job);
  for (const k of jobs.keys()) {
    if (jobs.size <= MAX_JOBS) break;
    if (jobs.get(k).done) jobs.delete(k);
  }
  return job;
}
function getLyrics(uri) {
  return jobFor(uri)?.promise || Promise.resolve(null);
}
// bisher bestes Ergebnis, ohne zu warten (null, solange noch nichts da ist) – startet keine Suche
const shownLyrics = (uri) => (uri ? jobs.get(keyOf(uri))?.cur || null : null);
// cb(lyr, final): erst das schnellste brauchbare Ergebnis, dann jede Stufe besser, zuletzt (final) das Ergebnis.
// Gibt eine Abmeldung zurück.
function watchLyrics(uri, cb) {
  const job = jobFor(uri);
  if (!job) {
    queueMicrotask(() => cb(null, true));
    return () => {};
  }
  let on = true;
  const f = (v, fin) => on && cb(v, fin);
  job.subs.add(f);
  if (job.cur !== undefined) queueMicrotask(() => f(job.cur, false));
  job.promise.then((v) => {
    f(v, true);
    job.subs.delete(f);
  });
  return () => {
    on = false;
    job.subs.delete(f);
  };
}
// Schnell durchgeskippt: was weder läuft noch als Nächstes kommt, braucht keine Antwort mehr. Abgebrochene
// Aufträge werden vergessen (nichts Halbfertiges im Speicher) und beim nächsten Mal neu gestartet.
function dropStaleLyrics() {
  const next = (S.Queue?.nextTracks || []).map((x) => x.contextTrack || x).find((x) => x?.uri)?.uri;
  const keep = new Set([currentItem()?.uri, next].filter(Boolean));
  for (const [k, job] of jobs) {
    if (job.done || keep.has(job.uri)) continue;
    job.ctrl.abort();
    jobs.delete(k);
  }
}
// als falsch gemeldete Ergebnisse dieses Songs (nur mit Online-Suche: ohne sie gäbe es keinen Ersatz)
const badOf = (uri) => (cfg.onlineLyrics && cfg.lyricBad?.[uri]) || [];
// auch die Ablehnungen stehen im Schlüssel: nach „Nicht der richtige Liedtext“ zählt das alte Ergebnis nicht mehr
function keyOf(uri) {
  const pick = cfg.onlineLyrics ? cfg.lyricPicks?.[uri] || "" : "", bad = badOf(uri);
  return uri + (cfg.onlineLyrics ? "|web" : "") + (cfg.karaoke ? "|k" : "") + "|" + pick + (bad.length ? "|!" + bad.join(",") : "");
}
// Dauerhafter Speicher (IndexedDB, 500 Songs) unter demselben Schlüssel wie die Aufträge oben:
// ein schon geholter Liedtext steht sofort da – auch ohne Netz
const lyricStore = createLyricStore((() => {
  try {
    return window.indexedDB;
  } catch {
    return null;
  }
})());
// Kopie für den Speicher: die Anzeige verschiebt Zeiten später (Timing von Hand, Abgleich mit dem Gesang) –
// gespeichert wird, was die Quelle geliefert hat
const snap = (v) => {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v));
  }
};
async function keptLyrics(uri, pick, key, bad, job) {
  // fetchLyrics hält die Song-Daten fest, solange der Song noch läuft – darum zuerst (ohne Warten) starten lassen
  noteMeta(uri);
  const kept = await lyricStore.get(key);
  if (kept?.fresh) {
    job.emit(kept.v);
    return kept.v;
  }
  // abgelaufen: den alten Text gleich zeigen, im Hintergrund neu suchen – ersetzt wird er nur durch etwas Besseres
  if (kept?.v) job.emit(kept.v);
  const fresh = (await fetchLyrics(uri, pick, new Set(bad), job)) || null;
  if (job.ctrl.signal.aborted) return job.cur || null;
  // nur echte Ergebnisse merken: „nichts gefunden“ kann am fehlenden Netz liegen –
  // dann lieber den abgelaufenen Text von früher zeigen
  if (!fresh?.lines?.length && !fresh?.instrumental) return kept?.v || fresh;
  lyricStore.put(key, snap(fresh));
  // gezeigt bleibt, was schon da ist, solange das Neue nicht besser ist
  return job.cur && tierOf(job.cur, cfg.karaoke) >= tierOf(fresh, cfg.karaoke) ? job.cur : fresh;
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
// no = abgelehnte Ergebnisse („spotify“, „lrclib:123“, „netease:456“, „kugou:789“, „amll:456“, „ovh“):
// die Suche geht an ihnen vorbei
async function fetchLyrics(uri, pick, no, job) {
  const meta = metaCache.get(uri) || noteMeta(uri);
  const signal = job.ctrl.signal, emit = job.emit;
  if (pick && !no.has("lrclib:" + pick)) {
    const hit = await lrclib("get/" + encodeURIComponent(pick), signal);
    const got = hit && fromHit(hit);
    if (got) {
      emit(got);
      return got;
    }
  }
  const online = !!(cfg.onlineLyrics && meta);
  // Spotify zuerst; die Sammlungen gleichzeitig (jede höchstens 7 s) und nur, wenn Spotify etwas fehlt –
  // Ablauf und Regeln in lyricflow.js
  return runLyrics({
    own: uri.startsWith("spotify:track:") && !no.has("spotify") ? () => fetchSpotify(uri) : null,
    online,
    karaoke: !!cfg.karaoke,
    signal,
    emit,
    wait: 7000,
    instrumental: online && instrumentalMeta(meta) && !no.has("title"),
    // Karaoke braucht Wortzeiten: hat NetEase (oder die AMLL-Sammlung) den GLEICHEN Text wortgenau, nimmt Mirage diesen
    words: [() => fetchNetease(meta, no, signal)],
    sources: online ? [() => fetchLrclib(meta, no, signal), () => fetchNetease(meta, no, signal), () => fetchKugou(meta, no, signal)] : [],
    last: online ? [() => fetchOvh(meta, no, signal)] : [],
  });
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
// Hat Spotify nichts (oder nur einfachen Text), fragt Mirage freie Sammlungen ohne Konto. Raus gehen nur
// Titel, Künstler, Album und Länge – abschaltbar unter „Liedtext online suchen“.
function songMeta(item) {
  const m = item.metadata || {};
  const ms = Number(m.duration) || Number(item.duration?.milliseconds) || Number(S.Player.data?.duration) || 0;
  const all = artistOf(item).split(", ").filter(Boolean);
  return {
    title: titleOf(item),
    artist: m.artist_name || all[0] || "",
    // alle Künstler – nur zum Vergleichen (lyricmatch.js), gesucht wird mit dem ersten
    artists: all,
    album: m.album_title || item.album?.name || "",
    sec: Math.round(ms / 1000),
  };
}
// „Song - Remastered 2011“, „Song (feat. X)“ → „Song“: so stehen die Titel in den Sammlungen
const cleanTitle = (s) => baseTitle(s) || s;
const LRCLIB = "https://lrclib.net/api/";
async function lrclib(path, signal) {
  try {
    const res = await fetch(LRCLIB + path, { headers: { "Lrclib-Client": "mirage (https://github.com/Passimoritz/spicetify-mirage)" }, signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
// LRCLIB-Eintrag in der Form, die lyricmatch.js bewertet (Länge, Fassungswörter, Titel, Künstler)
const lrcUsable = (x) => !!x && !!(x.syncedLyrics || x.plainLyrics || x.instrumental);
const lrcCand = (x) => ({ id: x.id, title: x.trackName || x.name || "", artist: x.artistName || "", album: x.albumName || "", sec: Math.round(x.duration || 0), synced: !!x.syncedLyrics, hit: x });
const idsOf = (no, src) => [...(no || [])].filter((s) => s.startsWith(src + ":")).map((s) => s.slice(src.length + 1));
const qs = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
async function fetchLrclib(meta, no, signal) {
  if (!meta.title || !meta.artist) return null;
  const title = cleanTitle(meta.title), bad = idsOf(no, "lrclib");
  // 1. genauer Treffer (LRCLIB lässt dabei ±2 s Länge zu), 2. Suche. Beides bewertet lyricmatch.js:
  // passende Länge und Fassung zuerst; ein Live-Song bekommt die Zeiten der Studiofassung nicht.
  const hit = meta.sec ? await lrclib("get?" + qs({ track_name: title, artist_name: meta.artist, album_name: meta.album, duration: meta.sec }), signal) : null;
  let ranked = rankLyrics(meta, lrcUsable(hit) ? [lrcCand(hit)] : [], bad);
  // nur weitersuchen, wenn der genaue Treffer fehlt, abgelehnt ist oder keine brauchbaren Zeiten hat
  if (!ranked[0] || ranked[0].plainOnly || !(ranked[0].synced || hit?.instrumental)) {
    if (signal?.aborted) return null;
    const list = await lrclib("search?" + qs({ track_name: title, artist_name: meta.artist }), signal);
    ranked = rankLyrics(meta, [hit, ...(Array.isArray(list) ? list : [])].filter(lrcUsable).map(lrcCand), bad);
  }
  for (const c of ranked) {
    const got = fromHit(c.hit, c.plainOnly, meta);
    if (got) return got;
  }
  return null;
}
// plainOnly: der Text passt, die Zeiten nicht (andere Fassung, andere Länge) → als einfacher Text zeigen
function fromHit(hit, plainOnly, meta) {
  const base = { lang: "", source: "lrclib", lrcId: hit.id };
  const instr = { ...base, synced: false, instrumental: true, lines: [] };
  if (hit.instrumental) return instr;
  const synced = cleanCredits(parseLrc(hit.syncedLyrics || ""), meta);
  // „[Instrumental]“ statt eines Textes
  if (instrumentalText(synced)) return instr;
  if (synced.length && !plainOnly) return { ...base, synced: true, lines: synced };
  if (synced.length && !hit.plainLyrics) return { ...base, synced: false, lines: synced.map((l) => ({ t: 0, text: l.text })) };
  const plain = (hit.plainLyrics || "").split(/\r?\n/).map((x) => x.trim());
  while (plain.length && !plain[plain.length - 1]) plain.pop();
  if (instrumentalText(plain.map((text) => ({ text })))) return instr;
  return plain.length ? { ...base, synced: false, lines: plain.map((text) => ({ t: 0, text: text || "♪" })) } : null;
}

/* ---- NetEase Cloud Music (und die AMLL-Sammlung mit Wortzeiten zu NetEase-Songs) */
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
// opt.rom: nur die Lautschrift wird gebraucht (ohne AMLL)
async function fetchNetease(meta, no, signal, opt = {}) {
  if (!meta?.title || !meta.artist) return null;
  const title = cleanTitle(meta.title);
  const res = await netease(`search/get?s=${encodeURIComponent(title + " " + meta.artist)}&type=1&limit=10`);
  if (signal?.aborted) return null;
  const songs = res?.result?.songs || [];
  // Titel, Künstler, Länge und Fassung bewertet lyricmatch.js (auch über Schriften hinweg: 紅蓮華 = Gurenge).
  // NetEase-Texte sind zeitgenau: was nur als einfacher Text taugte, fällt hier weg
  const cands = songs.map((s) => ({ id: s.id, title: s.name, artist: (s.artists || []).map((x) => x.name).join(", "), album: s.album?.name || "", sec: Math.round((s.duration || 0) / 1000), synced: true }));
  const fit = rankLyrics(meta, cands, idsOf(no, "netease")).find((c) => !c.plainOnly);
  if (!fit) return null;
  // Wortgenaue AMLL-Datei (wenn es eine gibt) gleichzeitig mit dem NetEase-Text holen
  const amll = cfg.karaoke && !opt.rom && !no?.has("amll:" + fit.id) ? fetchAmll(fit.id, signal) : null;
  const lyr = (await netease(`song/lyric/v1?id=${fit.id}&cp=false&tv=0&lv=0&rv=0&kv=0&yv=0&ytv=0&yrv=0`)) || (await netease(`song/lyric?id=${fit.id}&lv=-1&kv=-1&tv=-1&rv=-1`));
  const base = { lang: "", source: "netease", neId: fit.id };
  // Romaji (Lautschrift) gibt es bei NetEase zu vielen japanischen Songs – für die Lautschrift-Zeile
  const rom = cleanCredits(parseLrc(lyr?.romalrc?.lyric || ""), meta);
  const am = amll && (await amll);
  if (am) return { ...am, rom };
  const lines = cleanCredits(parseLrc(lyr?.lrc?.lyric || ""), meta);
  if (lyr?.nolyric || lyr?.pureMusic || instrumentalText(lines)) return { ...base, synced: false, instrumental: true, lines: [] };
  // YRC = jedes Wort mit eigener Zeit; nur nehmen, wenn sie den Song wirklich abdeckt
  const yrc = cleanCredits(parseYrc(lyr?.yrc?.lyric || ""), meta);
  if (yrc.length && yrc.length >= lines.length * 0.6) return { ...base, synced: true, wordSynced: true, lines: yrc, rom };
  return lines.length ? { ...base, synced: true, lines, rom } : null;
}
// AMLL TTML DB (github.com/amll-dev/amll-ttml-db, CC0): von Hand erstellte Wort-für-Wort-Liedtexte, abgelegt
// unter der NetEase-Songnummer. Gefragt wird nur mit dieser Nummer; die meisten Songs gibt es dort nicht (404).
const AMLL = "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/ncm-lyrics/";
async function fetchAmll(neId, signal) {
  try {
    const res = await fetch(AMLL + encodeURIComponent(neId) + ".ttml", { signal });
    if (!res.ok) return null;
    const lines = parseTtml(await res.text());
    return lines.length >= 3 ? { lang: "", source: "amll", neId, synced: true, wordSynced: true, lines } : null;
  } catch {
    return null;
  }
}
// nur die Romaji eines Songs (wenn der Liedtext aus einer anderen Quelle kommt), einmal je Song
const romCache = new Map();
function romajiFor(item) {
  const uri = item?.uri || "";
  if (!romCache.has(uri)) romCache.set(uri, fetchNetease(songMeta(item), null, null, { rom: true }).then((r) => r?.rom || [], () => []));
  return romCache.get(uri);
}

/* ---- Kugou: riesige Sammlung zeitgenauer Texte, gerade für chinesische und internationale Musik */
// Öffentliche Such- und Download-Schnittstelle, die auch freie Player nutzen; ohne Konto. Über CosmosAsync
// wie NetEase (lyrics.kugou.com erlaubt keine Browser-Anfragen von fremden Seiten). Mirage holt das
// LRC-Format (zeilengenau): das wortgenaue KRC ist verschlüsselt – das entschlüsselt Mirage bewusst nicht.
// Raus gehen nur „Künstler - Titel“ und die Länge.
const KG = "https://lyrics.kugou.com/";
async function kugou(path) {
  try {
    const r = await S.CosmosAsync.get(KG + path);
    return typeof r === "string" ? JSON.parse(r) : r;
  } catch {
    return null;
  }
}
const b64text = (s) => {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
};
async function fetchKugou(meta, no, signal) {
  if (!meta.title || !meta.artist) return null;
  const title = cleanTitle(meta.title);
  const res = await kugou(`search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(meta.artist + " - " + title)}&duration=${(meta.sec || 0) * 1000}&hash=`);
  if (signal?.aborted) return null;
  const cands = (res?.candidates || []).map((c) => ({ id: String(c.id), key: c.accesskey, title: c.song || "", artist: c.singer || "", sec: Math.round((Number(c.duration) || 0) / 1000), synced: true }));
  const fit = rankLyrics(meta, cands, idsOf(no, "kugou")).find((c) => !c.plainOnly);
  if (!fit?.key) return null;
  const dl = await kugou(`download?ver=1&client=pc&id=${encodeURIComponent(fit.id)}&accesskey=${encodeURIComponent(fit.key)}&fmt=lrc&charset=utf8`);
  const lines = cleanCredits(parseLrc(dl?.content ? b64text(dl.content) : ""), meta);
  if (instrumentalText(lines)) return { lang: "", source: "kugou", kgId: fit.id, synced: false, instrumental: true, lines: [] };
  // sehr kurze Texte sind meist nur Kopfzeilen oder „Kein Text“
  return lines.length >= 4 ? { lang: "", source: "kugou", kgId: fit.id, synced: true, lines } : null;
}

/* ---- lyrics.ovh: nur einfacher Text, aber riesige Sammlung */
async function fetchOvh(meta, no, signal) {
  if (!meta.title || !meta.artist || no?.has("ovh")) return null;
  try {
    const title = cleanTitle(meta.title);
    const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(meta.artist)}/${encodeURIComponent(title)}`, { signal });
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
  const title = cleanTitle(meta.title);
  let list = await lrclib("search?" + qs({ track_name: title, artist_name: meta.artist }));
  if (!Array.isArray(list) || !list.length) list = await lrclib("search?" + qs({ q: `${title} ${meta.artist}` }));
  const diff = (x) => (meta.sec ? Math.abs((x.duration || 0) - meta.sec) : 0);
  // was zu dieser Aufnahme passt (Länge, Fassung), steht oben; der Rest folgt wie bisher nach Länge
  const usable = (Array.isArray(list) ? list : []).filter(lrcUsable);
  const fit = rankLyrics(meta, usable.map(lrcCand)).map((c) => c.hit);
  return [...fit, ...usable.filter((x) => !fit.includes(x)).sort((a, b) => !!b.syncedLyrics - !!a.syncedLyrics || diff(a) - diff(b))]
    .slice(0, 12)
    .map((x) => ({ id: x.id, title: x.trackName, artist: x.artistName, album: x.albumName, sec: Math.round(x.duration || 0), synced: !!x.syncedLyrics, instrumental: !!x.instrumental }));
}
// gemerkte Ergebnisse dieses Songs vergessen (alle Schlüssel: mit/ohne Karaoke, Wahl, Ablehnungen)
function forgetSong(uri) {
  for (const [k, job] of jobs) {
    if (job.uri !== uri) continue;
    if (!job.done) job.ctrl.abort();
    jobs.delete(k);
  }
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
  // der neue Schlüssel holt frisch; alte Aufträge (mit verschobenen Zeiten aus der Anzeige) nicht weiterreichen
  forgetSong(uri);
}
/* ---- Nicht der richtige Liedtext */
// Kennung eines Ergebnisses: Quelle, bei Sammlungen mit mehreren Einträgen je Song auch der Eintrag
function sigOf(lyr) {
  if (!lyr) return "";
  if (lyr.source === "lrclib" && lyr.lrcId) return "lrclib:" + lyr.lrcId;
  if (lyr.source === "netease" && lyr.neId) return "netease:" + lyr.neId;
  if (lyr.source === "amll" && lyr.neId) return "amll:" + lyr.neId;
  if (lyr.source === "kugou" && lyr.kgId) return "kugou:" + lyr.kgId;
  return lyr.source || "spotify";
}
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
  forgetSong(uri);
  return true;
}
const rejectedCount = (uri) => (cfg.lyricBad?.[uri] || []).length;

/* ---------------------------------------------------------------- Übersetzung */
// Nur auf ausdrücklichen Wunsch (Einstellung „Liedtext übersetzen“, aus ab Werk): die Zeilen gehen
// dafür an Google Translate. Ein Aufruf pro Song, Ergebnis wird gemerkt.
const trCache = lru(40);
async function translateLines(uri, lyr, target) {
  if (!lyr?.lines?.length) return null;
  const lang = (lyr.lang || "").slice(0, 2).toLowerCase();
  if (lang && lang === target) return null;
  // Quelle und Zeilenzahl im Schlüssel: ersetzt ein besseres Ergebnis den Text, passen die alten Zeilen nicht mehr
  const key = uri + ":" + target + ":" + (lyr.source || "") + ":" + lyr.lines.length;
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
const SOURCE_NAME = { spotify: "Spotify", lrclib: "LRCLIB", netease: "NetEase", amll: "AMLL", kugou: "Kugou", ovh: "lyrics.ovh" };

export { getLyrics, shownLyrics, watchLyrics, dropStaleLyrics, warmLyrics, lyricVersions, pickLyrics, rejectLyrics, rejectedCount, translateLines, getCanvas, canvasBlocked, romajiFor, SOURCE_NAME };
