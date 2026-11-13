// node tests/unit/lyricflow.test.js
// Ablauf der Liedtext-Suche mit erfundenen Quellen: was erscheint wann, was ersetzt was
const assert = require("assert");
const { load } = require("./load.js");
const { runLyrics } = load("lyricflow.js");

const later = (ms, v) => () => new Promise((ok) => setTimeout(() => ok(v), ms));
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
  // 3. Spotify zeitgenau, Karaoke aus: niemand sonst wird gefragt
  {
    let asked = 0;
    const r = await runLyrics({ own: later(5, synced("spotify")), online: true, karaoke: false, sources: [() => (asked++, null)], words: [() => (asked++, null)] });
    assert.equal(r.source, "spotify");
    assert.equal(asked, 0);
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
    assert.ok(seen[0][1] < 60, "erstes Ergebnis wartet nicht auf die anderen: " + seen[0][1]);
    assert.equal(r.source, "netease");
  }
  // 6. Eine hängende Quelle hält nicht auf: nach `wait` ist Schluss
  {
    const t0 = Date.now();
    const r = await runLyrics({ own: null, online: true, wait: 80, sources: [() => new Promise(() => {}), later(10, synced("kugou"))] });
    assert.equal(r.source, "kugou");
    assert.ok(Date.now() - t0 < 200, "Wartezeit begrenzt");
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
  console.log("lyricflow: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
