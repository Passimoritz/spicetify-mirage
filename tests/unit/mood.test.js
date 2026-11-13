// node tests/unit/mood.test.js
// Gefühl des Songs (mood.js) und Szenen der Lichtregie (director.js) auf künstlichen Songs (songshapes.js):
// trifft die Schätzung euphorisch / melancholisch / aggressiv, sieht eine traurige Bridge im Tanzsong anders aus
// als ihr Drop, liegen alle Szenenwechsel auf einer Eins (Phrasengrenze, mindestens 8 Takte Abstand außer am
// Drop), wiederholt sich keine Szene direkt, ist derselbe Song beim Wiederholen gleich – und zwei Songs nicht?
const assert = require("assert");
const { load } = require("./load.js");
const { songMood, lineMood, lyricMoods, MOODS } = load("mood.js");
const { planSong, cue, grade, MOOD, SCENES } = load("director.js");
const { shaped } = require("./songshapes.js");

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const parts = (plan, kind) => plan.parts.filter((p) => p.kind === kind);
const mid = (x) => (x.t0 + x.t1) / 2 + 0.01;

// ---- Gefühl je Song
{
  const edm = planSong(shaped("edm"), "edm"), sad = planSong(shaped("sad"), "ballad"), metal = planSong(shaped("metal"), "metal");
  for (const p of parts(edm, "drop")) assert.equal(p.emo.name, "euphoric", "EDM-Drop euphorisch");
  assert.ok(edm.emo.song.v > 0.3, "EDM in Dur: positive Valenz");
  assert.ok(sad.emo.song.v < -0.25 && sad.emo.song.a < -0.1, `Moll-Ballade traurig und ruhig (${sad.emo.song.v.toFixed(2)}, ${sad.emo.song.a.toFixed(2)})`);
  for (const p of sad.parts) assert.ok(["sad", "melancholic"].includes(p.emo.name), `Ballade: ${p.kind} ist ${p.emo.name}`);
  assert.ok(metal.emo.song.a > 0.5 && metal.emo.song.v < 0, "Metal: aufgedreht und dunkel");
  for (const p of parts(metal, "chorus")) assert.equal(p.emo.name, "aggressive", "Metal-Refrain aggressiv");
  // jede benannte Stimmung hat einen Look
  for (const m of MOODS) assert.ok(MOOD[m], "Look für " + m);
}

// ---- Tanzsong mit trauriger Bridge: die Bridge fühlt sich anders an und sieht anders aus als der Drop
{
  const d = shaped("dancesad"), plan = planSong(d, "house");
  const sadPart = plan.parts.find((p) => p.kind === "break" || p.kind === "bridge"), drop = parts(plan, "drop")[1];
  assert.ok(sadPart && ["melancholic", "sad", "tender", "dreamy"].includes(sadPart.emo.name), "Bridge: " + sadPart?.emo.name);
  assert.ok(["euphoric", "happy", "triumphant"].includes(drop.emo.name), "Drop: " + drop.emo.name);
  assert.ok(sadPart.emo.v < drop.emo.v - 0.5, "Bridge deutlich trauriger als der Drop");
  const b = cue(plan, mid(sadPart), {}), x = cue(plan, mid(drop), {});
  assert.ok(b.speed < x.speed * 0.5, "Bridge langsamer");
  assert.ok(b.grade.sat < x.grade.sat, "Bridge weniger satt");
  assert.ok(b.grade.th >= 180 && b.grade.th <= 300 && b.grade.tk >= 0.3, `Bridge in Blau/Violett (${b.grade.th}°, ${b.grade.tk})`);
  assert.equal(b.fxk, "rain", "Bridge: Lichtregen statt Funken");
  assert.equal(x.fxk, "sparks", "Drop: Funken");
  assert.ok(b.crowd < x.crowd && b.soft > x.soft && b.haze > x.haze, "Bridge: Menge ruhiger, Schläge weicher, mehr Nebel");
  assert.ok(b.pump < x.pump, "Bridge pumpt weniger");
  assert.equal(b.flash, 0, "traurige Bridge ohne Farbflächen");
}

// ---- Metal: harte, enge Lichtstöße statt Funken, Farbwelt Rot
{
  const plan = planSong(shaped("metal"), "metal"), c = cue(plan, mid(parts(plan, "chorus")[0]), {});
  assert.equal(c.fxk, "hits");
  assert.ok(c.spread < 1 && c.soft < 0.1, "eng gebündelt, kurze Schläge");
  assert.ok(c.grade.th < 30 || c.grade.th > 330, "Rot: " + c.grade.th);
}

// ---- Audio-Merkmale verschieben das ganze Lied, die Teile bleiben verschieden
{
  const d = shaped("edm"), base = planSong(d, "edm");
  const low = planSong(d, "edm", { feat: { valence: 0.05, energy: 0.6, dance: 0.4 } });
  assert.ok(low.emo.song.v < base.emo.song.v - 0.2, "niedrige Valenz macht den Song trauriger");
  assert.ok(low.parts[3].emo.a > low.parts[1].emo.a, "Drop bleibt aufgedrehter als der Break");
}

// ---- Liedtext: kleine Wortliste Englisch/Deutsch, Verneinung
{
  assert.ok(lineMood("I love you, dancing in the sun").v > 0.5);
  assert.ok(lineMood("so alone, all my tears are gone").v < -0.5);
  assert.ok(lineMood("Ich bin so einsam und allein").v < -0.5);
  assert.ok(lineMood("Wir tanzen zusammen in der Sonne").v > 0.5);
  assert.ok(lineMood("I'm not sad").v > 0, "Verneinung dreht um");
  assert.ok(lineMood("blood and war, we fight").a > 0.5, "Wut hebt die Erregung");
  assert.equal(lineMood("die Straße ist lang"), null, "deutscher Artikel „die“ zählt nicht");
  assert.equal(lineMood("la la la"), null);
  const d = shaped("dancesad"), plain = planSong(d, "house");
  const lines = [];
  for (let t = 50; t < 140; t += 4) lines.push({ t, text: "so alone and broken, crying tears tonight" });
  const sadText = planSong(d, "house", { lyrics: lines });
  assert.equal(lyricMoods(lines).length, lines.length);
  assert.ok(sadText.parts[3].emo.v < plain.parts[3].emo.v - 0.15, "trauriger Text im Refrain senkt dessen Valenz");
}

// ---- Szenen: auf der Eins, Phrasen, Abstand, keine Wiederholung, Wiederholbarkeit, Abwechslung
const SONGS = [["edm", "edm"], ["rock", "rock"], ["ballad", "ballad"], ["trap", "trap"], ["dnb", "dnb"], ["sad", "ballad"], ["metal", "metal"], ["dancesad", "house"]];
for (const [name, key] of SONGS) {
  const d = shaped(name), plan = planSong(d, key), bars = d.bars.map((b) => b.t), beats = d.beats.map((b) => b.t);
  const SC = plan.scenes;
  assert.ok(SC.length >= 3, `${name}: mehrere Szenen (${SC.length})`);
  assert.equal(SC[0].t0, 0);
  const barNo = (t) => bars.findIndex((b) => near(b, t, 1e-6));
  SC.slice(1).forEach((s, i) => {
    const prev = SC[i], part = plan.parts.find((p) => near(p.t0, s.t0, 1e-9));
    // auf einer Eins – ein Drop auf seinem Schlag
    if (part?.drop) assert.ok(beats.some((b) => near(b, s.t0)), `${name}: Szene am Drop ${s.t0} nicht auf dem Schlag`);
    else assert.ok(barNo(s.t0) >= 0, `${name}: Szene bei ${s.t0.toFixed(3)} nicht auf einer Eins`);
    // mindestens 8 Takte Abstand, außer am Drop
    if (part?.kind !== "drop") assert.ok(s.t0 - prev.t0 >= plan.bar * 8 - 0.06, `${name}: Szenen bei ${prev.t0.toFixed(1)} und ${s.t0.toFixed(1)} zu dicht`);
    // nie dieselbe Szene zweimal hintereinander
    assert.notEqual(s.id, prev.id, `${name}: ${s.id} zweimal hintereinander`);
    // innerhalb eines Teils: auf einer Phrasengrenze (8 oder 16 Takte nach dem Teilanfang)
    if (s.mid) {
      const host = plan.parts.find((p) => p.t0 < s.t0 && p.t1 > s.t0);
      const k = barNo(s.t0) - bars.findIndex((b) => b >= host.t0 - 0.01);
      assert.ok(k > 0 && k % 8 === 0, `${name}: Szene mitten im Teil nicht auf einer Phrase (${k} Takte)`);
    }
  });
  // Zeitverlauf: der Wechsel passiert genau dort – vorher die alte Szene, ab der Eins die neue
  for (const s of SC.slice(1)) {
    assert.equal(cue(plan, s.t0 - 0.02, {}).sc, s.sc - 1, `${name}: Szene ${s.sc} beginnt zu früh`);
    assert.equal(cue(plan, s.t0 + 0.001, {}).sc, s.sc, `${name}: Szene ${s.sc} beginnt zu spät`);
    // Übergang gleitet (sx steigt von 0 auf 1) oder sitzt hart auf dem Drop
    const c0 = cue(plan, s.t0 + 0.001, {});
    if (s.fade > 0) assert.ok(c0.sx < 0.1 && cue(plan, s.t0 + s.fade + 0.01, {}).sx === 1, `${name}: Übergang gleitet nicht`);
    assert.ok(s.fade <= plan.bar * 2 + 1e-6, `${name}: Übergang länger als zwei Takte`);
  }
  // Wiederholen = gleich
  const again = planSong(shaped(name), key);
  assert.deepEqual(again.scenes.map((s) => s.id + s.sh), SC.map((s) => s.id + s.sh), `${name}: beim Wiederholen andere Szenen`);
  // „Leicht“: nur billige Bühnenlichter, kein Überblenden zweier Lichter
  for (let t = 0; t < plan.end; t += 0.5) {
    const c = cue(plan, t, { lite: true });
    assert.ok(!c.spot || ["soft", "top", "pan", "floor", "cross", "scan"].includes(c.spot), `${name}: teures Licht ${c.spot} in „Leicht“`);
    assert.equal(c.sx, 1);
  }
  // „Keine Blitze“: auch mit Szenen keine Farbflächen und keine Lichtwand
  for (let t = 0; t < plan.end; t += 0.25) {
    const c = cue(plan, t, { noFlash: true });
    assert.equal(c.flash, 0);
    assert.equal(c.wall, 0);
  }
}

// ---- zwei Songs desselben Genres sehen verschieden aus (anderer Fingerabdruck → andere Szenenfolge)
{
  const seqs = new Set();
  for (let k = 0; k < 6; k++) {
    const d = shaped("edm");
    d.segs = d.segs.map((s, i) => (i < 64 ? { ...s, l: s.l + ((i * (k + 3)) % 7) * 0.13 } : s));
    seqs.add(planSong(d, "edm").scenes.map((s) => s.id).join(","));
  }
  assert.ok(seqs.size >= 4, `nur ${seqs.size} verschiedene Szenenfolgen aus 6 EDM-Songs`);
}

// ---- Leihen: eine melancholische House-Bridge bekommt (meist) Licht aus Ballade/Ruhig statt der Discokugel
{
  let borrowed = 0;
  for (let k = 0; k < 10; k++) {
    const d = shaped("dancesad");
    d.segs = d.segs.map((s, i) => (i < 64 ? { ...s, l: s.l + ((i * (k + 2)) % 5) * 0.11 } : s));
    const plan = planSong(d, "house"), sadPart = plan.parts.find((p) => p.kind === "break");
    const sc = plan.scenes.filter((s) => s.t0 >= sadPart.t0 - 1e-6 && s.t0 < sadPart.t1);
    for (const s of sc) {
      const def = SCENES.find((x) => x.id === s.id);
      assert.ok(def.id === "own" || def.moods.includes(sadPart.emo.name) || def.moods.includes(sadPart.emo.alt), `Bridge-Szene ${s.id} passt nicht zu ${sadPart.emo.name}`);
      if (def.from.some((f) => f === "ballad" || f === "calm")) borrowed++;
    }
  }
  assert.ok(borrowed >= 5, `Bridge leiht selten (${borrowed}/10)`);
}

// ---- Farbkorrektur mit Stimmung: Palette rückt in die Farbwelt, gemerkt bei gleicher Eingabe
{
  const pal = [[255, 80, 120], [80, 160, 255], [255, 220, 90]];
  const g = { sat: 1, con: 1, warm: 0, hue: 0, th: 222, tk: 0.5, lum: -0.06, sh: 0 };
  const out = grade(pal, g);
  assert.equal(out, grade(pal, { ...g }));
  const hue = ([r, gg, b]) => {
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dd = mx - mn;
    const h = mx === r ? (gg - b) / dd + (gg < b ? 6 : 0) : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4;
    return h * 60;
  };
  const dist = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  assert.ok(dist(hue(out[0]), 222) < dist(hue(pal[0]), 222), "Rot rückt Richtung Blau");
  assert.ok(dist(hue(out[2]), 222) < dist(hue(pal[2]), 222), "Gelb rückt Richtung Blau");
}

console.log("mood: ok");
