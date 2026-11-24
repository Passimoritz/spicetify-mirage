import { S, lru } from "./core.js";
import { cfg, save } from "./config.js";
import { currentItem, titleOf, artistOf } from "./player.js";
import { createLyricStore, voteKey } from "./lyricstore.js";
import { rankLyrics, baseTitle, instrumentalMeta, instrumentalText, cleanCredits, tierOf } from "./lyricmatch.js";
import { runLyrics, askLrclib, fromHit, lrcUsable, lrcCand, lrcQuery as qs } from "./lyricflow.js";
import { parseLrc, parseYrc, parseTtml } from "./lyricparse.js";
import { parseVoices } from "./lyricvoices.js";
import { undoSync } from "./lyricsync.js";
import { autoSyncOffIn, setAutoSyncIn } from "./songsync.js";

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
  // nur Verbesserungen melden: gleich gute Ergebnisse tauschen nie (das würde flackern) – außer die Abstimmung
  // der Fassungen ersetzt einen Ausreißer (force, lyricflow.js)
  job.emit = (v, force) => {
    if (job.ctrl.signal.aborted || !v || (!force && tierOf(v, cfg.karaoke) <= tierOf(job.cur, cfg.karaoke))) return;
    // Duett-Stimmen und Hintergrundgesang erkennen – hier, damit Immersiv, Overlay und Handys denselben Text
    // bekommen (ohne „Name:“ davor). Gefahrlos wiederholbar, ändert ohne Hinweise im Text nichts.
    job.cur = parseVoices(v);
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
    // die Abstimmung im Hintergrund (lyricflow.js) kann Spotifys Text noch ersetzen: bis dahin weiter zuhören
    (job.late || Promise.resolve()).then(() => job.subs.delete(f));
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
  // „kein Liedtext“ gemerkt (eine Woche, lyricstore.js): nicht wieder alle Quellen fragen
  if (kept?.fresh && kept.v.none) return null;
  if (kept?.fresh) {
    job.emit(kept.v);
    return kept.v;
  }
  const old = kept?.v?.none ? null : kept?.v || null;
  // abgelaufen: den alten Text gleich zeigen, im Hintergrund neu suchen – ersetzt wird er nur durch etwas Besseres
  if (old) job.emit(old);
  const net = { ok: false };
  const fresh = (await fetchLyrics(uri, pick, new Set(bad), job, net, old)) || null;
  if (job.ctrl.signal.aborted) return job.cur || null;
  // „nichts gefunden“ kann am fehlenden Netz liegen – dann lieber den abgelaufenen Text von früher zeigen.
  // Gemerkt wird es nur, wenn LRCLIB wirklich geantwortet hat (net.ok) und es keinen alten Text gibt.
  if (!fresh?.lines?.length && !fresh?.instrumental) {
    if (net.ok && !old && cfg.onlineLyrics) lyricStore.put(key, { none: true, synced: false, source: "", lines: [] });
    return old || fresh;
  }
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
// net.ok wird true, sobald LRCLIB geantwortet hat (dann heißt „nichts gefunden“ wirklich nichts)
// old: abgelaufenes Ergebnis von früher (kam es nicht von Spotify, fragt Mirage die Sammlungen gleich mit)
async function fetchLyrics(uri, pick, no, job, net = {}, old = null) {
  const meta = metaCache.get(uri) || noteMeta(uri);
  const signal = job.ctrl.signal, emit = job.emit;
  if (pick && !no.has("lrclib:" + pick)) {
    const hit = await lrclib("get/" + encodeURIComponent(pick), signal, net);
    const got = hit && fromHit(hit);
    if (got) {
      // von Hand gewählt: keine Abstimmung
      const n = got.synced ? 1 : 0;
      got.diag = { source: "lrclib", id: got.lrcId ?? null, candidates: n, cluster: n, spotifyOverruled: false, shifted: 0, auto: null, picked: true };
      emit(got);
      return got;
    }
  }
  const online = !!(cfg.onlineLyrics && meta);
  // NetEase nur einmal fragen, auch wenn es als Sammlung UND als Wortzeiten-Quelle gebraucht wird
  let ne = null;
  const neOnce = () => (ne ||= fetchNetease(meta, no, signal));
  // Spotify mit 1,5 s Vorrang, nach 6 s steht das Ergebnis fest. Die Sammlungen fragt Mirage nur, wenn Spotify
  // keinen zeitgenauen Text hat (oder nach 0,6 s noch nicht geantwortet hat); sonst stimmt es EINMAL je Song im
  // Hintergrund ab, ob Spotifys Zeiten stimmen, und merkt sich das Urteil eine Woche – Ablauf in lyricflow.js
  const own = uri.startsWith("spotify:track:") && !no.has("spotify");
  // das gemerkte Urteil kommt aus dem Speicher – parallel, Spotify wird deshalb nicht später gefragt
  const vote = own && online ? lyricStore.get(voteKey(uri)).then((v) => (v?.fresh ? !!v.v.keep : undefined)) : undefined;
  // Urteil der Abstimmung eintragen: bleibt Spotifys Text, nur das Urteil; sonst auch das neue Ergebnis
  const onVerdict = (keep, best) => {
    lyricStore.put(voteKey(uri), { vote: true, keep });
    if (!keep && best && !signal.aborted) lyricStore.put(job.key, snap(best));
  };
  let late = null;
  // im Hintergrund: nach dem Start des Songs, wenn der Rechner gerade nichts anderes tut
  const idle = (fn) => {
    job.late = new Promise((ok) => (late = ok));
    setTimeout(() => {
      const run = () => Promise.resolve().then(fn).finally(late);
      typeof requestIdleCallback === "function" ? requestIdleCallback(run, { timeout: 5000 }) : run();
    }, 2500);
  };
  return runLyrics({
    own: own ? () => fetchSpotify(uri) : null,
    online,
    karaoke: !!cfg.karaoke,
    signal,
    emit,
    grace: 1500,
    cap: 6000,
    lazy: true,
    head: old && old.source !== "spotify" ? 0 : 600,
    verdict: vote,
    idle,
    onVerdict,
    instrumental: online && instrumentalMeta(meta) && !no.has("title"),
    // Karaoke braucht Wortzeiten: hat NetEase (oder die AMLL-Sammlung) den GLEICHEN Text wortgenau, nimmt Mirage diesen
    words: [neOnce],
    sources: online ? [() => fetchLrclib(meta, no, signal, net), neOnce, () => fetchKugou(meta, no, signal)] : [],
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
// net (optional): bekommt ok = true, sobald LRCLIB überhaupt antwortet (auch mit 404 „nicht gefunden“)
async function lrclib(path, signal, net) {
  try {
    const res = await fetch(LRCLIB + path, { headers: { "Lrclib-Client": "mirage (https://github.com/Passimoritz/spicetify-mirage)" }, signal });
    if (net && (res.ok || res.status === 404)) net.ok = true;
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
const idsOf = (no, src) => [...(no || [])].filter((s) => s.startsWith(src + ":")).map((s) => s.slice(src.length + 1));
// eine Anfrage (die Suche); der genaue Abruf nur, wenn sie scheitert – lyricflow.js
const fetchLrclib = (meta, no, signal, net) => askLrclib(meta, (path) => lrclib(path, signal, net), idsOf(no, "lrclib"), signal);

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
// 1.27 perf: begrenzt (früher eine Map ohne Obergrenze – wuchs mit jedem Song mit Romaji-Bedarf)
const romCache = lru(40);
function romajiFor(item) {
  const uri = item?.uri || "";
  let job = romCache.get(uri);
  if (!job) romCache.set(uri, (job = fetchNetease(songMeta(item), null, null, { rom: true }).then((r) => r?.rom || [], () => [])));
  return job;
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
// Neu suchen (z. B. Knopf „Erneut suchen“ nach „Kein Liedtext“): das gemerkte Ergebnis – auch „kein Liedtext“ –
// unter dem aktuellen Schlüssel vergessen und frisch fragen. → Promise wie getLyrics. Die Anzeige holt sich das
// neue Ergebnis danach selbst (immersive: reloadLyrics).
async function researchLyrics(uri) {
  if (!uri) return null;
  await lyricStore.drop(keyOf(uri));
  forgetSong(uri);
  return getLyrics(uri);
}
// Abgleich mit dem Gesang (lyricsync.js) für diesen Song an/aus – gespeichert in cfg.syncNoAuto[uri].
// Aus: schon verschobene Zeiten des gezeigten Ergebnisses gehen sofort auf die der Quelle zurück
// (diag.auto.applied = false, why = "off"). An: beim nächsten Zeichnen wird neu abgeglichen. Danach die Anzeige
// neu aufbauen (immersive: reloadLyrics), damit die Wortzeiten mitkommen.
function setAutoSync(uri, on) {
  if (!uri) return;
  setAutoSyncIn(cfg, uri, on);
  save();
  for (const job of jobs.values()) {
    const v = job.uri === uri && job.cur;
    if (!v?.lines) continue;
    if (!on && v.sync) {
      undoSync(v.lines, v.sync);
      delete v.sync;
    }
    // aus: nicht wieder abgleichen; an: noch einmal abgleichen dürfen (außer es ist schon abgeglichen)
    v.aligned = !on || !!v.sync;
    if (on && v.sync) continue;
    if (v.diag) v.diag.auto = { ...(v.diag.auto || { off: 0, scale: 1, conf: 0 }), applied: false, why: on ? "pending" : "off" };
  }
}
const autoSyncOff = (uri) => autoSyncOffIn(cfg, uri);
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
// Die Abfrage nennt eine MP4-Datei in H.264 – die kann Spotifys eigenes Chromium aber NICHT abspielen (keine
// proprietären Codecs: das Video lädt ewig, ohne Fehler). Spotify selbst spielt Canvas über ein Video-Manifest mit
// mehreren Fassungen, darunter AV1 bzw. VP9. Diese Fassung holen wir: Init- und Mediensegmente (fragmentiertes MP4)
// hintereinander ergeben eine abspielbare Datei, als Blob-URL fürs <video>. Kann der Browser H.264 doch
// (andere Umgebungen, Tests), nehmen wir die Datei direkt.
const canvasCache = lru(60); // uri → { url, fileId } | null
const canvasPending = new Map();
const canvasBlobs = new Map(); // fileId → Blob-URL (nur die letzten paar: je ~1–2 MB)
const BLOBS_MAX = 4;
const h264 = () => {
  try {
    return !!document.createElement("video").canPlayType('video/mp4; codecs="avc1.4d401f"');
  } catch {
    return false;
  }
};
async function canvasMeta(uri) {
  if (canvasCache.has(uri)) return canvasCache.get(uri);
  if (canvasPending.has(uri)) return canvasPending.get(uri);
  const p = (async () => {
    let meta = null;
    try {
      const G = S.GraphQL;
      const def = G?.Definitions?.canvas;
      if (def && G.Request) {
        // Spotify hat die Variable umbenannt (uri → trackUri): beide mitschicken, dann passt es für alte und neue Versionen
        const r = await G.Request(def, { trackUri: uri, uri });
        const c = r?.data?.trackUnion?.canvas;
        // Bild-Canvas (kein Video): das Cover reicht
        if (c?.url && /\.mp4(\?|$)/.test(c.url)) meta = { url: c.url, fileId: c.fileId || "" };
      }
    } catch {}
    canvasCache.set(uri, meta);
    canvasPending.delete(uri);
    return meta;
  })();
  canvasPending.set(uri, p);
  return p;
}
async function manifest(fileId) {
  const url = `https://spclient.wg.spotify.com/manifests/v9/json/sources/${fileId}/options/supports_drm`;
  try {
    if (S.CosmosAsync?.get) return await S.CosmosAsync.get(url);
  } catch {}
  const tok = S.Platform?.AuthorizationAPI?.getState?.()?.token?.accessToken;
  if (!tok) return null;
  const r = await fetch(url, { headers: { authorization: "Bearer " + tok } });
  return r.ok ? r.json() : null;
}
// maxW: breiteste Fassung, die wir laden (Canvas sind Hochformat 9:16; 720 reicht fürs große Cover)
async function canvasFile(fileId, maxW) {
  const key = fileId + "|" + maxW;
  if (canvasBlobs.has(key)) return canvasBlobs.get(key);
  const m = await manifest(fileId);
  const c = m?.contents?.[0], base = m?.base_urls?.[0];
  if (!c || !base || !m.initialization_template || !m.segment_template) return null;
  // je nach Canvas gibt es AV1 (MP4) oder VP9 (WebM) – beides kann Spotify; bei gleicher Größe AV1 (kleiner).
  // Segmente aneinandergehängt spielen in beiden Formaten als Datei, auch in Schleife (gemessen).
  const ok = (p) => (p.file_type === "mp4" || p.file_type === "webm") && (window.MediaSource?.isTypeSupported?.(`${p.mime_type}; codecs="${p.video_codec}"`) ?? false);
  const rank = (p) => p.video_width * 10 + (/^av01/.test(p.video_codec) ? 2 : /^vp/.test(p.video_codec) ? 1 : 0);
  const usable = (c.profiles || []).filter(ok).sort((a, b) => rank(b) - rank(a));
  const p = usable.find((x) => x.video_width <= maxW) || usable[usable.length - 1];
  if (!p) return null;
  const fill = (tpl, ts) => base + tpl.replace("{{profile_id}}", p.id).replace("{{file_type}}", p.file_type).replace("{{segment_timestamp}}", ts);
  const len = c.segment_length || 4, end = (c.end_time_millis || 0) / 1000, start = (c.start_time_millis || 0) / 1000;
  const n = Math.max(1, Math.min(8, Math.ceil((end - start) / len)));
  const urls = [fill(m.initialization_template, 0)];
  for (let i = 0; i < n; i++) urls.push(fill(m.segment_template, Math.round(start + i * len)));
  const parts = await Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))));
  const blob = URL.createObjectURL(new Blob(parts, { type: p.mime_type || "video/mp4" }));
  canvasBlobs.set(key, blob);
  // älteste freigeben (das laufende Video ist immer das neueste)
  while (canvasBlobs.size > BLOBS_MAX) {
    const [k, v] = canvasBlobs.entries().next().value;
    canvasBlobs.delete(k);
    URL.revokeObjectURL(v);
  }
  return blob;
}
const filePending = new Map();
async function getCanvas(uri, maxW = 720) {
  if (!uri?.startsWith("spotify:track:")) return null;
  const meta = await canvasMeta(uri);
  if (!meta) return null;
  if (h264() || !meta.fileId) return meta.url;
  const key = meta.fileId + "|" + maxW;
  if (!filePending.has(key)) filePending.set(key, canvasFile(meta.fileId, maxW).catch(() => null).finally(() => filePending.delete(key)));
  return filePending.get(key);
}

// Canvas ist in Spotify ausgeschaltet (Spotify-Einstellungen → Anzeige → Canvas, gilt fürs ganze Konto):
// dann liefert Spotify für jeden Song „kein Canvas“. Wer es in Mirage einschaltet, will es sehen – darum schaltet
// enableSpotifyCanvas() es in Spotify mit ein (wie Spotifys eigener Schalter). Gesperrt (Kinder-/Familienkonto)
// geht das nicht; dann erklärt der Knopf, woran es liegt.
async function canvasState() {
  try {
    const v = await S.Platform?.ProductStateAPI?.getValues?.();
    return { off: v?.["canvas-disabled"] === "1", locked: v?.["lock-canvas-disabled"] === "1" };
  } catch {
    return { off: false, locked: false };
  }
}
// gesperrt: Mirage kann es nicht einschalten (der Knopf erklärt das statt „kein Canvas“)
async function canvasBlocked() {
  const s = await canvasState();
  return s.off && s.locked;
}
// Direkt nach dem Einschalten liefert Spotify noch kurz „kein Canvas“ (gemessen: die erste Abfrage gleich danach
// kommt leer zurück). Darum ein paar Mal nachfragen, ohne das leere Ergebnis zu behalten.
async function canvasAfterEnable(uri, maxW) {
  for (const ms of [500, 1500, 3000]) {
    await new Promise((r) => setTimeout(r, ms));
    canvasCache.delete(uri);
    const url = await getCanvas(uri, maxW);
    if (url) return url;
  }
  return null;
}
// true: war aus und ist jetzt an (Ergebnisse von vorher waren „kein Canvas“ und werden vergessen)
async function enableSpotifyCanvas() {
  const s = await canvasState();
  if (!s.off || s.locked) return false;
  try {
    await S.Platform.ProductStateAPI.setValues({ "canvas-disabled": "0" });
  } catch {
    return false;
  }
  canvasCache.clear();
  enabledAt = Date.now();
  return true;
}
let enabledAt = 0;
// gerade eben in Spotify eingeschaltet: „kein Canvas“ ist dann noch nicht verlässlich
const canvasFresh = () => Date.now() - enabledAt < 6000;

// Anzeigename der Quelle (Knopf „Fassung wählen“, Overlay)
const SOURCE_NAME = { spotify: "Spotify", lrclib: "LRCLIB", netease: "NetEase", amll: "AMLL", kugou: "Kugou", ovh: "lyrics.ovh" };

export { getLyrics, researchLyrics, setAutoSync, autoSyncOff, shownLyrics, watchLyrics, dropStaleLyrics, warmLyrics, lyricVersions, pickLyrics, rejectLyrics, rejectedCount, translateLines, getCanvas, canvasBlocked, enableSpotifyCanvas, canvasAfterEnable, canvasFresh, romajiFor, SOURCE_NAME };
