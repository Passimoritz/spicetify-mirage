// node tests/unit/lyricvote.test.js
// Fassungen abstimmen: Gruppen nach Zeilenzeiten, Ausreißer raus, Spotify nur von einer klaren Mehrheit überstimmt
const assert = require("assert");
const { load } = require("./load.js");
const { lineOffset, clusterLyrics, judgeLyrics, shiftLyrics } = load("lyricvote.js");
const { version, versions, OK, EARLY } = require("./fixtures/dogdribble.js");

// 1. Versatz über gleiche Zeilen (Refrain-Wiederholungen in Reihenfolge), anderer Text = nicht vergleichbar
{
  const [a, , , , e] = versions();
  assert.equal(lineOffset(a, e), EARLY - OK);
  assert.equal(lineOffset(e, a), OK - EARLY);
  const other = { synced: true, lines: a.lines.map((l, i) => ({ t: l.t, text: "ganz anderer text " + i })) };
  assert.equal(lineOffset(a, other), null);
  // fehlende Zeilen am Anfang (Kopfzeilen weggeschnitten) stören nicht
  const cut = { ...a, lines: a.lines.slice(2) };
  assert.equal(lineOffset(a, cut), 0);
}
// 2. Dog Dribble: vier einig bei 25,79 s, einer 1,75 s früher → Gruppe aus vier, Ausreißer 34335447
{
  const vs = versions();
  // der Ausreißer zuerst (falls er einmal am besten bewertet wäre): die Gruppe gewinnt trotzdem
  const list = [vs[4], ...vs.slice(0, 4)];
  const c = clusterLyrics(list);
  assert.equal(c.members.length, 4);
  assert.deepEqual(c.outliers, [0]);
  assert.equal(list[c.members[0]].lrcId, 20150209, "bester Rang in der Gruppe");
  assert.equal(c.off(0), EARLY - OK);
}
// 3. Gezeigt wird der Ausreißer → Wechsel zur Mehrheit (bester Rang in der Gruppe)
{
  const vs = versions(), shown = vs[4];
  const j = judgeLyrics(shown, [shown, ...vs.slice(0, 4)]);
  assert.equal(j.how, "switch");
  assert.equal(j.lyr.lrcId, 20150209);
  assert.equal(j.candidates, 5);
  assert.equal(j.cluster, 4);
  assert.equal(j.overruled, false);
}
// 4. Gezeigt wird eine aus der Mehrheit → bleibt (kein Flackern), cluster = 4
{
  const vs = versions();
  const j = judgeLyrics(vs[1], vs);
  assert.equal(j.how, "keep");
  assert.equal(j.lyr, vs[1]);
  assert.equal(j.cluster, 4);
}
// 5. Spotify: überstimmt nur von ≥ 2 einigen anderen und erst ab > 1 s
{
  const sp = version("x", EARLY, { source: "spotify" }), vs = versions();
  const j = judgeLyrics(sp, [sp, vs[0], vs[1]], { prio: true });
  assert.equal(j.how, "switch");
  assert.equal(j.overruled, true);
  assert.equal(j.lyr.lrcId, 20150209);
  // nur einer dagegen: Spotify bleibt
  assert.equal(judgeLyrics(sp, [sp, vs[0]], { prio: true }).how, "keep");
  // nur 0,8 s daneben: Spotify bleibt (eine Fremd-Fassung würde ab 0,6 s ersetzt)
  const sp8 = version("x", OK - 800, { source: "spotify" });
  assert.equal(judgeLyrics(sp8, [sp8, ...vs.slice(0, 4)], { prio: true }).how, "keep");
  const lr8 = version(1, OK - 800);
  assert.equal(judgeLyrics(lr8, [lr8, ...vs.slice(0, 4)]).how, "switch");
  // Spotify hat einen anderen Text (andere Sprachfassung): nicht vergleichbar, bleibt
  const fr = { ...sp, lines: sp.lines.map((l, i) => ({ t: l.t, text: "autre texte numéro " + i })) };
  assert.equal(judgeLyrics(fr, [fr, ...vs.slice(0, 4)], { prio: true }).how, "keep");
}
// 6. Gezeigt hat Wortzeiten (Karaoke), die Mehrheit nicht → nicht wechseln, sondern verschieben
{
  const vs = versions(), shown = version(9, EARLY, { source: "netease" });
  shown.wordSynced = true;
  shown.lines.forEach((l) => (l.words = [{ t: l.t, d: 200, text: "x" }, { t: l.t + 300, d: 200, text: "y" }]));
  const j = judgeLyrics(shown, [shown, ...vs.slice(0, 4)], { karaoke: true });
  assert.equal(j.how, "shift");
  assert.equal(j.off, OK - EARLY);
  assert.equal(j.lyr.lines[0].t, OK);
  assert.equal(j.lyr.lines[0].words[1].t, OK + 300);
  assert.equal(shown.lines[0].t, EARLY, "Quelle unberührt");
}
// 7. zu wenige Fassungen oder keine Mehrheit: nichts tun
{
  const vs = versions();
  assert.equal(judgeLyrics(vs[4], [vs[4], vs[0]]).how, "keep");
  // 2 gegen 2: keine Mehrheit
  const e2 = version(2, EARLY);
  assert.equal(judgeLyrics(vs[4], [vs[4], e2, vs[0], vs[1]]).how, "keep");
  assert.equal(judgeLyrics(null, vs).how, "keep");
}
// 8. shiftLyrics: Kopie, nie unter 0
{
  const v = version(1, 100);
  const s = shiftLyrics(v, -500);
  assert.equal(s.lines[0].t, 0);
  assert.equal(v.lines[0].t, 100);
}
console.log("lyricvote: ok");
