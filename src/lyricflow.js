/* ---------------------------------------------------------------- Liedtext-Ablauf */
// In welcher Reihenfolge die Quellen gefragt werden und wann ein Ergebnis angezeigt wird. Ohne Netz und
// ohne Fenster: die Quellen kommen als Funktionen herein – darum einzeln testbar (tests/unit/lyricflow.test.js).
//
// Grundsätze: Spotify zuerst (eigener Text, schnell). Fehlt dort etwas (gar kein Text, nur einfacher Text,
// oder Karaoke ohne Wortzeiten), fragt Mirage die Sammlungen GLEICHZEITIG statt nacheinander – jede höchstens
// `wait` ms. Das erste brauchbare Ergebnis erscheint sofort; später kommt nur noch etwas, wenn es eine Stufe
// besser ist (Text → zeitgenau → Wort für Wort). Gleich gute Ergebnisse tauschen nie: das würde flackern.
import { tierOf, sameLyrics } from "./lyricmatch.js";

// Quelle hängt oder die Anfrage ist überholt (Song übersprungen)? Dann null statt ewig warten
function within(p, ms, signal) {
  return new Promise((ok) => {
    if (signal?.aborted) return ok(null);
    const t = setTimeout(() => ok(null), ms);
    const done = (v) => {
      clearTimeout(t);
      ok(v);
    };
    signal?.addEventListener?.("abort", () => done(null), { once: true });
    Promise.resolve().then(p).then(done, () => done(null));
  });
}

// o = { own, sources, words, last, online, instrumental, karaoke, emit, signal, wait }
//   own: () => Spotifys Text · sources: [() => Ergebnis] die Sammlungen · words: [(own) => Ergebnis] Quellen mit
//   Wortzeiten für Spotifys eigenen Text · last: [() => Ergebnis] nur einfacher Text, nur wenn sonst nichts kam
//   instrumental: der Titel sagt schon „Instrumental“ · emit(lyr): jedes neue, bessere Ergebnis
async function runLyrics(o) {
  const { karaoke, signal, wait = 6000 } = o;
  const top = karaoke ? 3 : 2;
  let best = null;
  const offer = (r) => {
    if (!r || signal?.aborted || tierOf(r, karaoke) <= tierOf(best, karaoke)) return;
    best = r;
    o.emit?.(r);
  };
  const own = o.own ? await within(o.own, wait, signal) : null;
  offer(own);
  if (!o.online || signal?.aborted || tierOf(own, karaoke) >= top) return best;
  // Spotify zeitgenau, aber ohne Wortzeiten (nur mit Karaoke gefragt): nur derselbe Text mit Wortzeiten zählt
  if (own?.synced) {
    await Promise.all((o.words || []).map((src) => within(() => src(own), wait, signal).then((r) => {
      if (r && tierOf(r, karaoke) === 3 && sameLyrics(own, r)) offer({ ...r, lang: own.lang || r.lang });
    })));
    return best;
  }
  // Instrumental laut Titel: kein Text zu suchen (und nichts zu verraten)
  if (!own && o.instrumental) {
    offer({ lang: "", source: "title", synced: false, instrumental: true, lines: [] });
    return best;
  }
  // Spotify hat nur einfachen Text: ein zeitgenauer Text ersetzt ihn nur, wenn es DERSELBE Text ist –
  // sonst ist es vielleicht eine andere Sprachfassung (Spotify kennt die laufende Aufnahme)
  const fits = (r) => !own || (!r.instrumental && sameLyrics(own, r, 0.4));
  await Promise.all((o.sources || []).map((src) => within(src, wait, signal).then((r) => {
    if (r && fits(r)) offer(own ? { ...r, lang: own.lang || r.lang } : r);
  })));
  // einfacher Text zuletzt und nur, wenn bis jetzt gar nichts da ist
  for (const src of o.last || []) {
    if (best || signal?.aborted) break;
    offer(await within(src, wait, signal));
  }
  return best;
}

export { runLyrics, within };
