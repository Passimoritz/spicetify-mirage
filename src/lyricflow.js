/* ---------------------------------------------------------------- Liedtext-Ablauf */
// In welcher Reihenfolge die Quellen gefragt werden und wann ein Ergebnis angezeigt wird. Ohne Netz und
// ohne Fenster: die Quellen kommen als Funktionen herein – darum einzeln testbar (tests/unit/lyricflow.test.js).
//
// Grundsätze: ALLE Quellen starten gleichzeitig (Spotify und die Sammlungen). Spotify hat Vorrang, wenn es
// innerhalb von `grace` ms (1,5 s) antwortet – so lange wartet die Anzeige auf Spotify. Mit `lazy` (lyrics.js)
// warten die Sammlungen kurz (`head`, 0,6 s) auf Spotify: hat Spotify einen zeitgenauen Text, fragt Mirage die
// Sammlungen gar nicht erst – die Abstimmung läuft dann EINMAL je Song in einer ruhigen Minute im Hintergrund
// (`idle`), und ihr Urteil (`verdict`, `onVerdict`) merkt sich lyrics.js eine Woche. Danach erscheint das
// erste brauchbare Ergebnis sofort; später kommt nur noch etwas, wenn es eine Stufe besser ist (Text →
// zeitgenau → Wort für Wort). Gleich gute Ergebnisse tauschen nie (das würde flackern) – außer die Abstimmung
// (lyricvote.js) zeigt, dass das Gezeigte ein Ausreißer gegen eine klare Mehrheit ist. Spätestens nach `cap` ms
// (6 s) steht das Ergebnis fest; „kein Liedtext“ dauert damit nicht mehr 14–21 s.
import { tierOf, sameLyrics, rankLyrics, baseTitle, fold, cleanCredits, instrumentalText } from "./lyricmatch.js";
import { judgeLyrics, votable } from "./lyricvote.js";
import { parseLrc } from "./lyricparse.js";

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
//   grace: so lange hat Spotify Vorrang · cap: Obergrenze für alles (`wait` gilt als alter Name dafür) ·
//   lazy: Sammlungen erst fragen, wenn Spotify keinen zeitgenauen Text hat (oder nach `head` ms noch schweigt) ·
//   verdict: gemerktes Urteil der Abstimmung (true = Spotifys Text bleibt, false = wurde ersetzt, sonst unbekannt) ·
//   idle(fn): führt die Abstimmung im Hintergrund aus (ohne: gleich danach) · onVerdict(keep, best): ihr Urteil
//   (keep = Spotifys Text bleibt; sonst ist best das neue Ergebnis, schon per emit gemeldet)
// Abstimmung im Hintergrund: die Sammlungen nacheinander; sobald das Urteil feststeht, wird nicht weiter gefragt
// (jede weitere Sammlung bringt höchstens EINE Fassung – nur die erste darf `alts` mitbringen, wie LRCLIB).
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
  // die Sammlungen (höchstens einmal) losschicken – gezeigt wird ihr Ergebnis erst nach Spotifys Vorrangzeit
  let srcP = null;
  const start = () => (srcP ||= (o.sources || []).map((src) => within(src, left(), signal)));
  // Spotifys Text wurde schon einmal überstimmt (verdict false): dann gleich alle wie früher
  const lazy = !!o.lazy && o.verdict !== false;
  if (!lazy) start();
  else {
    await until(ownP, Math.min(o.head ?? 600, grace));
    if (!(ownKnown && ownR?.synced)) start();
  }
  await until(ownP, grace - (Date.now() - t0));
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
    start();
    pend.push(ownP.then((r) => consider(r, 0)));
  }
  srcP?.forEach((p, i) => pend.push(p.then((r) => consider(r, 1 + i))));
  const all = Promise.all(pend);
  // einfacher Text zuletzt und nur, wenn bis dahin gar nichts da ist – spätestens zur Hälfte der Zeit fragen
  await until(all, left() / 2);
  for (const src of o.last || []) {
    if (best || signal?.aborted || left() <= 0) break;
    const r = await within(src, left(), signal);
    if (!best) consider(r, 90);
  }
  await until(all, left());
  if (signal?.aborted) return null;
  // Urteil über Spotifys zeitgenauen Text: gleich (die Sammlungen liefen mit) oder später im Hintergrund
  // (überstimmt = die Abstimmung hat Spotifys Zeiten verworfen; Wortzeiten zum selben Text mit Karaoke zählen nicht dagegen)
  const verdict = () => o.onVerdict?.(!diag.spotifyOverruled, best);
  if (ownR?.synced && ownPrio) {
    if (srcP) verdict();
    else if (o.verdict !== true && votable(ownR)) (o.idle || ((fn) => setTimeout(fn, 0)))(() => recheck(verdict));
  }
  return best;

  // Abstimmung im Hintergrund: eine Sammlung nach der anderen, bis keine weitere das Urteil mehr kippen kann
  async function recheck(done) {
    const list = o.sources || [];
    for (let i = 0; i < list.length; i++) {
      if (signal?.aborted) return;
      const r = await within(list[i], cap, signal);
      if (signal?.aborted) return;
      consider(r, 1 + i);
      if (diag.spotifyOverruled) break;
      // Vorsprung der Gruppe um Spotify (cluster) vor allen anderen Fassungen größer als die noch offenen Quellen
      const mine = diag.cluster, rest = diag.candidates - mine;
      if (mine - rest > list.length - 1 - i) break;
    }
    if (!signal?.aborted) done();
  }
}

/* ---- LRCLIB: eine Anfrage je Song */
// Früher zwei gleichzeitig (genauer Treffer „get“ und Suche „search“). Die Suche liefert den genauen Treffer fast
// immer mit – er wird hier selbst herausgesucht (wie bei LRCLIB: Titel, Künstler, Album, Länge ±2 s). Nur wenn die
// Suche scheitert oder nichts Brauchbares bringt, folgt der genaue Abruf (LRCLIB sucht dabei auch außerhalb der
// eigenen Sammlung). ask(pfad) → Antwort (JSON) oder null; bad = abgelehnte LRCLIB-Einträge.
const lrcUsable = (x) => !!x && !!(x.syncedLyrics || x.plainLyrics || x.instrumental);
const lrcCand = (x) => ({ id: x.id, title: x.trackName || x.name || "", artist: x.artistName || "", album: x.albumName || "", sec: Math.round(x.duration || 0), synced: !!x.syncedLyrics, hit: x });
const lrcQuery = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
// der Eintrag, den LRCLIBs „get“ geliefert hätte (zeitgenau zuerst, dann die nächste Länge)
function lrcExact(meta, title, list) {
  const same = (a, b) => fold(a) === fold(b);
  const gap = (x) => Math.abs((x.duration || 0) - meta.sec);
  const fit = list.filter((x) => same(x.trackName || x.name, title) && same(x.artistName, meta.artist) && (!meta.album || same(x.albumName, meta.album)) && gap(x) <= 2);
  fit.sort((a, b) => !!b.syncedLyrics - !!a.syncedLyrics || gap(a) - gap(b));
  return fit[0] || null;
}
async function askLrclib(meta, ask, bad = [], signal) {
  if (!meta?.title || !meta.artist) return null;
  const title = baseTitle(meta.title) || meta.title;
  const list = await ask("search?" + lrcQuery({ track_name: title, artist_name: meta.artist }));
  if (signal?.aborted) return null;
  const found = (Array.isArray(list) ? list : []).filter(lrcUsable);
  let hit = meta.sec ? lrcExact(meta, title, found) : null;
  if (!found.length && meta.sec) {
    hit = await ask("get?" + lrcQuery({ track_name: title, artist_name: meta.artist, album_name: meta.album, duration: meta.sec }));
    if (signal?.aborted) return null;
  }
  // bewertet von lyricmatch.js: passende Länge und Fassung zuerst; ein Live-Song bekommt die Zeiten der Studiofassung nicht
  const all = rankLyrics(meta, [hit, ...found.filter((x) => x !== hit)].filter(lrcUsable).map(lrcCand), bad);
  let ranked = rankLyrics(meta, lrcUsable(hit) ? [lrcCand(hit)] : [], bad);
  // der genaue Treffer gilt, wenn er passt und brauchbare Zeiten hat – sonst die ganze Liste
  if (!ranked[0] || ranked[0].plainOnly || !(ranked[0].synced || hit?.instrumental)) ranked = all;
  for (const c of ranked) {
    const got = fromHit(c.hit, c.plainOnly, meta);
    if (!got) continue;
    // weitere zeitgenaue Fassungen zum Abstimmen (höchstens 8; runLyrics nimmt sie nicht ins Ergebnis)
    if (got.synced) {
      const alts = all.filter((x) => x.synced && !x.plainOnly && x.id !== got.lrcId).slice(0, 8).map((x) => fromHit(x.hit, false, meta)).filter((x) => x?.synced);
      if (alts.length) got.alts = alts;
    }
    return got;
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

export { runLyrics, within, askLrclib, fromHit, lrcUsable, lrcCand, lrcQuery };
