/* ---------------------------------------------------------------- Liedtext-Ablauf */
// In welcher Reihenfolge die Quellen gefragt werden und wann ein Ergebnis angezeigt wird. Ohne Netz und
// ohne Fenster: die Quellen kommen als Funktionen herein – darum einzeln testbar (tests/unit/lyricflow.test.js).
//
// Grundsätze: ALLE Quellen starten gleichzeitig (Spotify und die Sammlungen). Spotify hat Vorrang, wenn es
// innerhalb von `grace` ms (1,5 s) antwortet – so lange wartet die Anzeige auf Spotify. Danach erscheint das
// erste brauchbare Ergebnis sofort; später kommt nur noch etwas, wenn es eine Stufe besser ist (Text →
// zeitgenau → Wort für Wort). Gleich gute Ergebnisse tauschen nie (das würde flackern) – außer die Abstimmung
// (lyricvote.js) zeigt, dass das Gezeigte ein Ausreißer gegen eine klare Mehrheit ist. Spätestens nach `cap` ms
// (6 s) steht das Ergebnis fest; „kein Liedtext“ dauert damit nicht mehr 14–21 s.
import { tierOf, sameLyrics } from "./lyricmatch.js";
import { judgeLyrics, votable } from "./lyricvote.js";

// Quelle hängt oder die Anfrage ist überholt (Song übersprungen)? Dann null statt ewig warten
function within(p, ms, signal) {
  return new Promise((ok) => {
    if (signal?.aborted) return ok(null);
    const t = setTimeout(() => ok(null), Math.max(0, ms));
    const done = (v) => {
      clearTimeout(t);
      ok(v);
    };
    signal?.addEventListener?.("abort", () => done(null), { once: true });
    Promise.resolve().then(p).then(done, () => done(null));
  });
}
// warten, bis p fertig ist oder ms um sind – nur der Zeitpunkt zählt, nicht das Ergebnis
function until(p, ms) {
  let t;
  return Promise.race([p, new Promise((ok) => (t = setTimeout(ok, Math.max(0, ms))))]).finally(() => clearTimeout(t));
}
// Kennung des Eintrags in seiner Sammlung (für die Diagnose)
const idOf = (x) => x?.lrcId ?? x?.neId ?? x?.kgId ?? null;

// o = { own, sources, words, last, online, instrumental, karaoke, emit, signal, grace, cap }
//   own: () => Spotifys Text · sources: [() => Ergebnis] die Sammlungen (ein Ergebnis darf in `alts` weitere
//   zeitgenaue Fassungen mitbringen – nur für die Abstimmung, gezeigt werden sie nur über sie) ·
//   words: [(own) => Ergebnis] Quellen mit Wortzeiten für Spotifys eigenen Text · last: [() => Ergebnis] nur
//   einfacher Text, nur wenn sonst nichts kam · instrumental: der Titel sagt schon „Instrumental“ ·
//   emit(lyr, force): jedes neue, bessere Ergebnis (force: nicht besser, aber per Abstimmung ersetzt) ·
//   grace: so lange hat Spotify Vorrang · cap: Obergrenze für alles (`wait` gilt als alter Name dafür)
// Jedes gemeldete Ergebnis trägt `diag` – dasselbe Objekt für den ganzen Lauf, es wird beim Weiterlaufen ergänzt:
//   { source, id, candidates, cluster, spotifyOverruled, shifted, auto }
//   source/id = gezeigte Quelle und ihr Eintrag (lrcId/neId/kgId, sonst null) · candidates = zeitgenaue
//   Fassungen insgesamt · cluster = wie viele davon (samt der gezeigten) übereinstimmen · spotifyOverruled =
//   Spotifys eigener Text wurde von der Mehrheit überstimmt · shifted = ms, um die der gezeigte Text auf die
//   Mehrheit geschoben wurde (0 = nicht) · auto = Abgleich mit dem Gesang (füllt immersive.js, sonst null)
async function runLyrics(o) {
  const { karaoke, signal } = o;
  const cap = o.cap ?? o.wait ?? 6000, grace = Math.min(o.grace ?? 1500, cap);
  const t0 = Date.now(), left = () => cap - (Date.now() - t0);
  const top = karaoke ? 3 : 2;
  const diag = { source: "", id: null, candidates: 0, cluster: 0, spotifyOverruled: false, shifted: 0, auto: null };
  let best = null, base = null, shownKey = "", ownR = null, ownKnown = false, ownPrio = false;
  const rank = new Map(), cands = [];
  // Kandidaten für die Abstimmung, nach Rang (Spotify, dann die Quellen in ihrer Reihenfolge, je samt `alts`)
  const add = (r, at) => {
    if (!r) return;
    [r, ...(r.alts || [])].forEach((x, k) => {
      if (!x || rank.has(x)) return;
      rank.set(x, at + k / 100);
      if (votable(x)) cands.push(x);
    });
    cands.sort((a, b) => rank.get(a) - rank.get(b));
  };
  // darf r gezeigt werden? Spotify hat nur einfachen Text: ein zeitgenauer Text ersetzt ihn nur, wenn es DERSELBE
  // Text ist (sonst vielleicht eine andere Sprachfassung). Spotify zeitgenau: nur derselbe Text mit Wortzeiten.
  const fits = (r) => {
    if (!r || r === ownR || !ownR) return !!r;
    if (!ownR.synced) return !r.instrumental && sameLyrics(ownR, r, 0.4);
    return tierOf(r, karaoke) === 3 && sameLyrics(ownR, r);
  };
  const show = (x, force) => {
    const { alts, ...v } = x;
    best = { ...v, lang: (x !== ownR && ownR?.lang) || v.lang || "", diag };
    Object.assign(diag, { source: v.source || "", id: idOf(v) });
    o.emit?.(best, force);
  };
  // ein neues Ergebnis (oder null) ist da: eine bessere Stufe nehmen, dann abstimmen lassen
  const consider = (r, at) => {
    if (signal?.aborted) return;
    add(r, at);
    let next = base;
    if (r && fits(r) && tierOf(r, karaoke) > tierOf(base, karaoke)) next = r;
    if (!next) return;
    const ok = (x) => x === ownR || !ownR || ownR.synced || fits(x);
    const j = judgeLyrics(next, cands, { prio: ownPrio && next === ownR, karaoke, ok });
    Object.assign(diag, { candidates: j.candidates, cluster: j.cluster });
    const key = j.how === "shift" ? "s" + Math.round(j.off / 50) : "k";
    if (j.base === base && key === shownKey) return;
    if (j.how !== "keep") diag.spotifyOverruled ||= j.overruled;
    diag.shifted = j.how === "shift" ? j.off : 0;
    const force = j.base !== next || j.how === "shift";
    [base, shownKey] = [j.base, key];
    show(j.lyr, force);
  };

  const ownP = o.own ? within(o.own, cap, signal) : Promise.resolve(null);
  ownP.then((r) => ([ownKnown, ownR] = [true, r]));
  if (!o.online || o.instrumental) {
    const own = await ownP;
    ownPrio = !!own;
    consider(own, 0);
    // Instrumental laut Titel: kein Text zu suchen (und nichts zu verraten)
    if (o.online && !own && !signal?.aborted) consider({ lang: "", source: "title", synced: false, instrumental: true, lines: [] }, 1);
    return signal?.aborted ? null : best;
  }
  // alle Sammlungen sofort los – gezeigt wird ihr Ergebnis erst nach Spotifys Vorrangzeit
  const srcP = (o.sources || []).map((src) => within(src, cap, signal));
  await until(ownP, grace);
  if (signal?.aborted) return null;
  const pend = [];
  if (ownKnown) {
    ownPrio = !!ownR;
    consider(ownR, 0);
    // Spotify zeitgenau, aber ohne Wortzeiten (nur mit Karaoke gefragt): nur derselbe Text mit Wortzeiten zählt
    if (ownR?.synced && tierOf(ownR, karaoke) < top) {
      (o.words || []).forEach((src, i) => pend.push(within(() => src(ownR), left(), signal).then((r) => consider(r, 50 + i))));
    }
  } else {
    // Spotify zu langsam: kein Vorrang mehr, es zählt wie jede andere Quelle
    pend.push(ownP.then((r) => consider(r, 0)));
  }
  srcP.forEach((p, i) => pend.push(p.then((r) => consider(r, 1 + i))));
  const all = Promise.all(pend);
  // einfacher Text zuletzt und nur, wenn bis dahin gar nichts da ist – spätestens zur Hälfte der Zeit fragen
  await until(all, left() / 2);
  for (const src of o.last || []) {
    if (best || signal?.aborted || left() <= 0) break;
    const r = await within(src, left(), signal);
    if (!best) consider(r, 90);
  }
  await until(all, left());
  return signal?.aborted ? null : best;
}

export { runLyrics, within };
