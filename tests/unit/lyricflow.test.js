// node tests/unit/lyricflow.test.js
// Ablauf der Liedtext-Suche mit erfundenen Quellen: was erscheint wann, was ersetzt was
const assert = require("assert");
const { load } = require("./load.js");
const { runLyrics } = load("lyricflow.js");
const { version, versions, OK, EARLY } = require("./fixtures/dogdribble.js");

// alle Zeiten zehnfach gestreckt: unter Last (CI, mehrere Tests parallel) reichen 20 gegen 60 ms nicht
const K = 10;
const later = (ms, v) => () => new Promise((ok) => setTimeout(() => ok(v), ms * K));
const T = ["Look at the stars", "Look how they shine for you", "And everything you do", "Yeah they were all yellow", "I came along", "I wrote a song for you"];
const plain = (src = "spotify", lines = T) => ({ source: src, synced: false, lang: "en", lines: lines.map((text) => ({ t: 0, text })) });
const synced = (src, lines = T) => ({ source: src, synced: true, lang: "", lines: lines.map((text, i) => ({ t: 1000 + i * 3000, text })) });
const worded = (src, lines = T) => ({ ...synced(src, lines), wordSynced: true, lines: synced(src, lines).lines.map((l) => ({ ...l, words: l.text.split(" ").map((w, k) => ({ t: l.t + k * 300, d: 280, text: w, sp: true })) })) });
const ES = ["Mira las estrellas", "Mira cómo brillan para ti", "Y todo lo que haces", "Sí, eran todas amarillas", "Yo llegué", "Te escribí una canción"];

(async () => {
  // 1. Spotify nur einfacher Text, LRCLIB hat denselben Text zeitgenau: erst Spotify, dann zeitgenau (Sprache von Spotify)
  {
    const seen = [];
    const r = await runLyrics({ own: later(5, plain()), online: true, karaoke: false, sources: [later(20, synced("lrclib"))], emit: (v) => seen.push(v.source) });
    assert.deepEqual(seen, ["spotify", "lrclib"]);
    assert.equal(r.source, "lrclib");
    assert.equal(r.synced, true);
    assert.equal(r.lang, "en");
  }
  // 2. Spotify einfacher Text in anderer Sprache (Sprachfassung): der zeitgenaue fremde Text ersetzt ihn NICHT
  {
    const r = await runLyrics({ own: later(5, plain("spotify", ES)), online: true, sources: [later(10, synced("lrclib"))] });
    assert.equal(r.source, "spotify");
  }
  // 3. Spotify zeitgenau, Karaoke aus: die Sammlungen laufen gleichzeitig mit (für die Abstimmung), ersetzen
  //    Spotify aber nicht; nach Wortzeiten wird nicht gefragt
  {
    let asked = 0, words = 0;
    const r = await runLyrics({ own: later(5, synced("spotify")), online: true, karaoke: false, sources: [() => (asked++, synced("lrclib"))], words: [() => (words++, null)] });
    assert.equal(r.source, "spotify");
    assert.equal(asked, 1);
    assert.equal(words, 0);
    assert.equal(r.diag.candidates, 2);
    assert.equal(r.diag.cluster, 2);
    assert.equal(r.diag.spotifyOverruled, false);
  }
  // 4. Spotify zeitgenau ohne Wortzeiten, Karaoke an: NetEase-Wortzeiten zum GLEICHEN Text kommen dazu
  {
    const seen = [];
    const r = await runLyrics({ own: later(5, synced("spotify")), online: true, karaoke: true, words: [later(10, worded("netease"))], emit: (v) => seen.push(v.source) });
    assert.deepEqual(seen, ["spotify", "netease"]);
    assert.equal(r.wordSynced, true);
    const other = await runLyrics({ own: later(5, synced("spotify")), online: true, karaoke: true, words: [later(10, worded("netease", ES))] });
    assert.equal(other.source, "spotify", "anderer Text mit Wortzeiten zählt nicht");
  }
  // 5. Nichts bei Spotify: alle gleichzeitig; das schnellste zeitgenaue erscheint sofort, das langsamere gleich gute
  //    tauscht nicht (kein Flackern), Wortzeiten (Karaoke) ersetzen später
  {
    const seen = [], t0 = Date.now();
    const r = await runLyrics({
      own: later(5, null), online: true, karaoke: true,
      sources: [later(60, synced("lrclib")), later(20, synced("kugou")), later(120, worded("netease"))],
      emit: (v) => seen.push([v.source, Date.now() - t0]),
    });
    assert.deepEqual(seen.map((x) => x[0]), ["kugou", "netease"]);
    assert.ok(seen[0][1] < 60 * K, "erstes Ergebnis wartet nicht auf die anderen: " + seen[0][1]);
    assert.equal(r.source, "netease");
  }
  // 6. Eine hängende Quelle hält nicht auf: nach `wait` ist Schluss
  {
    const t0 = Date.now();
    const r = await runLyrics({ own: null, online: true, wait: 80 * K, sources: [() => new Promise(() => {}), later(10, synced("kugou"))] });
    assert.equal(r.source, "kugou");
    assert.ok(Date.now() - t0 < 200 * K, "Wartezeit begrenzt");
  }
  // 7. lyrics.ovh (nur Text) nur, wenn sonst nichts kam
  {
    let ovh = 0;
    await runLyrics({ own: null, online: true, sources: [later(5, synced("lrclib"))], last: [() => (ovh++, plain("ovh"))] });
    assert.equal(ovh, 0);
    const r = await runLyrics({ own: null, online: true, sources: [later(5, null)], last: [() => (ovh++, plain("ovh"))] });
    assert.equal(ovh, 1);
    assert.equal(r.source, "ovh");
  }
  // 8. Instrumental laut Titel: keine Anfrage an die Sammlungen
  {
    let asked = 0;
    const r = await runLyrics({ own: later(5, null), online: true, instrumental: true, sources: [() => (asked++, null)] });
    assert.equal(r.instrumental, true);
    assert.equal(asked, 0);
  }
  // 9. Instrumental einer Sammlung zählt nicht gegen Spotifys eigenen Text
  {
    const r = await runLyrics({ own: later(5, plain()), online: true, sources: [later(5, { source: "lrclib", instrumental: true, lines: [] })] });
    assert.equal(r.source, "spotify");
  }
  // 10. Online-Suche aus: nur Spotify
  {
    let asked = 0;
    const r = await runLyrics({ own: later(5, plain()), online: false, sources: [() => (asked++, synced("lrclib"))] });
    assert.equal(r.source, "spotify");
    assert.equal(asked, 0);
  }
  // 11. Abgebrochen (Song übersprungen): keine Meldungen mehr, kein lyrics.ovh
  {
    const ctrl = new AbortController(), seen = [];
    let ovh = 0;
    const p = runLyrics({ own: null, online: true, signal: ctrl.signal, sources: [later(50, synced("lrclib"))], last: [() => (ovh++, null)], emit: (v) => seen.push(v) });
    setTimeout(() => ctrl.abort(), 10);
    assert.equal(await p, null);
    assert.equal(seen.length, 0);
    assert.equal(ovh, 0);
  }
  // 12. Alle Quellen starten gleichzeitig: Spotify antwortet in der Vorrangzeit → Spotify zuerst, obwohl LRCLIB
  //     schneller war; die Sammlung wurde trotzdem sofort gefragt (nicht erst nach Spotify)
  {
    const seen = [], t0 = Date.now();
    let startedAt = -1;
    const r = await runLyrics({
      own: later(40, plain()), online: true, grace: 100 * K,
      sources: [() => ((startedAt = Date.now() - t0), later(5, synced("lrclib"))())],
      emit: (v) => seen.push([v.source, Date.now() - t0]),
    });
    assert.ok(startedAt < 20 * K, "LRCLIB gleich zu Beginn gefragt: " + startedAt);
    assert.deepEqual(seen.map((x) => x[0]), ["spotify", "lrclib"]);
    assert.ok(seen[0][1] >= 35 * K, "Spotify hatte Vorrang");
    assert.equal(r.source, "lrclib");
  }
  // 13. Spotify zu langsam (nach der Vorrangzeit): die Sammlung erscheint schon nach der Vorrangzeit, Spotifys
  //     später gleich guter Text tauscht nicht mehr
  {
    const seen = [], t0 = Date.now();
    const r = await runLyrics({
      own: later(150, synced("spotify")), online: true, grace: 30 * K,
      sources: [later(5, synced("lrclib"))],
      emit: (v) => seen.push([v.source, Date.now() - t0]),
    });
    assert.deepEqual(seen.map((x) => x[0]), ["lrclib"]);
    assert.ok(seen[0][1] < 100 * K, "nicht auf Spotify gewartet: " + seen[0][1]);
    assert.equal(r.source, "lrclib");
  }
  // 14. Obergrenze: hängende Quellen und „kein Liedtext“ – spätestens nach cap steht das Ergebnis fest,
  //     lyrics.ovh wird spätestens zur Hälfte gefragt
  {
    const t0 = Date.now();
    let ovhAt = -1;
    const r = await runLyrics({
      own: later(5, null), online: true, cap: 100 * K, grace: 10 * K,
      sources: [() => new Promise(() => {}), later(900, synced("kugou"))],
      last: [() => ((ovhAt = Date.now() - t0), null)],
    });
    const took = Date.now() - t0;
    assert.equal(r, null);
    assert.ok(took >= 95 * K && took < 160 * K, "Obergrenze: " + took);
    assert.ok(ovhAt > 0 && ovhAt < 75 * K, "lyrics.ovh zur Hälfte: " + ovhAt);
  }
  // 15. Abstimmung (Dog Dribble): Spotifys Text liegt 1,75 s früher als vier einige LRCLIB-Fassungen → die Mehrheit
  //     gewinnt, die Diagnose sagt warum
  {
    const vs = versions(), sp = version("sp", EARLY, { source: "spotify" });
    sp.lang = "en";
    const lr = { ...vs[0], alts: vs.slice(1) };
    const seen = [];
    const r = await runLyrics({ own: later(5, sp), online: true, sources: [later(10, lr)], emit: (v, force) => seen.push([v.source, !!force]) });
    assert.deepEqual(seen, [["spotify", false], ["lrclib", true]]);
    assert.equal(r.lrcId, 20150209);
    assert.equal(r.lines[0].t, OK);
    assert.equal(r.lang, "en", "Sprache von Spotify");
    assert.equal(r.alts, undefined, "weitere Fassungen nicht im Ergebnis");
    assert.deepEqual({ ...r.diag }, { source: "lrclib", id: 20150209, candidates: 6, cluster: 4, spotifyOverruled: true, shifted: 0, auto: null });
  }
  // 16. Ohne Spotify: LRCLIBs erste Wahl ist der Ausreißer, die mitgelieferten Fassungen sind sich einig →
  //     gleich die Mehrheit zeigen (kein Umweg über den Ausreißer)
  {
    const vs = versions(), seen = [];
    const lr = { ...vs[4], alts: vs.slice(0, 4) };
    const r = await runLyrics({ own: later(5, null), online: true, sources: [later(10, lr)], emit: (v) => seen.push(v.lrcId) });
    assert.deepEqual(seen, [20150209]);
    assert.equal(r.diag.cluster, 4);
    assert.equal(r.diag.candidates, 5);
    assert.equal(r.diag.spotifyOverruled, false);
  }
  // 17. Spotify knapp daneben (0,8 s) oder nur eine Quelle dagegen: Spotify bleibt
  {
    const vs = versions();
    const sp = version("sp", OK - 800, { source: "spotify" });
    const r = await runLyrics({ own: later(5, sp), online: true, sources: [later(10, { ...vs[0], alts: vs.slice(1, 4) })] });
    assert.equal(r.source, "spotify");
    const sp2 = version("sp", EARLY, { source: "spotify" });
    const r2 = await runLyrics({ own: later(5, sp2), online: true, sources: [later(10, vs[0])] });
    assert.equal(r2.source, "spotify");
    assert.equal(r2.diag.cluster, 1);
  }
  console.log("lyricflow: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
