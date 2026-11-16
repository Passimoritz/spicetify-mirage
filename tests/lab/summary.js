// Zusammenfassung eines Laborlaufs (run.js) je Gruppe: Mittelwerte der Kennzahlen, Genre-Treffer, Stimmungen.
//   node tests/lab/summary.js <run.jsonl> [--by src|genre|fam] [--json out.json] [--min 10]
const fs = require("fs");
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const rows = fs.readFileSync(args[0], "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !r.error);
const by = opt("--by", "genre"), min = +opt("--min", 10);
const groupOf = (r) => {
  const pre = r.id.startsWith("hxT") ? "hxT" : r.id.startsWith("hxE") ? "hxE" : r.id.startsWith("hxP") ? "hxP" : r.id.startsWith("fma") ? "fma" : r.id.startsWith("dz") ? "deezer" : r.id.startsWith("it") ? "itunes" : r.src || "?";
  return by === "src" ? pre : by === "fam" ? pre + ":" + (r.expect?.[0] || "?") : pre + ":" + (r.genre || "?");
};
const groups = {};
for (const r of rows) (groups[groupOf(r)] ||= []).push(r);
const mean = (a, f) => {
  const v = a.map(f).filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN;
};
const share = (a, f) => mean(a, (r) => (f(r) ? 1 : 0));
const crowdOf = (r, L, k) => r.crowd?.[L]?.[k];
const summary = {};
for (const [g, a] of Object.entries(groups).sort()) {
  if (a.length < min) continue;
  const hasExp = a.filter((r) => r.expect?.length);
  const moods = {};
  for (const r of a) moods[r.mood] = (moods[r.mood] || 0) + 1;
  summary[g] = {
    n: a.length,
    beatF: mean(a, (r) => r.beatF), downF: mean(a, (r) => r.downF), vizF: mean(a, (r) => r.vizF), beatOff: mean(a, (r) => r.beatOff),
    anaBeatF: mean(a, (r) => r.analysisBeatF), anaDownF: mean(a, (r) => r.analysisDownF),
    boundF3: mean(a, (r) => r.boundF3), chorusPeak: mean(a, (r) => r.peakIn?.chorus), versePeak: mean(a, (r) => r.peakIn?.verse), introCalm: mean(a, (r) => r.calmIn?.intro),
    introPeak: mean(a, (r) => r.peakIn?.intro), flowErr: mean(a, (r) => r.flowErr), flowOk: share(a.filter((r) => Number.isFinite(r.flowErr)), (r) => r.flowErr <= 2.5),
    dropsPerMin: mean(a, (r) => (r.drops / r.dur) * 60), dropGood: mean(a, (r) => (r.dropGood + r.dropBad ? r.dropGood / (r.dropGood + r.dropBad) : NaN)), dropRecall: mean(a, (r) => r.dropRecall ?? NaN),
    flashMax: Math.max(...a.map((r) => r.flashMax1s)), flashPerMin: mean(a, (r) => r.flashPerMin),
    flashIntro: mean(a, (r) => r.flashIn?.intro), flashVerse: mean(a, (r) => r.flashIn?.verse), flashChorus: mean(a, (r) => r.flashIn?.chorus), flashBreak: mean(a, (r) => r.flashIn?.break),
    crowdCorr: mean(a, (r) => r.crowdCorr), jumpCalm: mean(a, (r) => r.jumpWhenCalm), jumpLoud: mean(a, (r) => r.jumpWhenLoud),
    crowdChorusX: mean(a, (r) => crowdOf(r, "chorus", "X")), crowdVerseX: mean(a, (r) => crowdOf(r, "verse", "X")), crowdIntroX: mean(a, (r) => crowdOf(r, "intro", "X")),
    jumpIntro: mean(a, (r) => crowdOf(r, "intro", "jump")), jumpVerse: mean(a, (r) => crowdOf(r, "verse", "jump")), jumpChorus: mean(a, (r) => crowdOf(r, "chorus", "jump")),
    famHit: hasExp.length ? share(hasExp, (r) => r.expect.includes(r.fam)) : NaN,
    famSoundHit: hasExp.length ? share(hasExp, (r) => r.expect.includes(r.famSound)) : NaN,
    guitar: mean(a, (r) => r.inst?.guitar), piano: mean(a, (r) => r.inst?.piano),
    planMs: mean(a, (r) => r.planMs), stepUs: mean(a, (r) => r.stepUs),
    moods: Object.entries(moods).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => k + " " + Math.round((v / a.length) * 100) + "%").join(", "),
  };
}
const cols = ["n", "beatF", "downF", "vizF", "beatOff", "anaBeatF", "anaDownF", "boundF3", "chorusPeak", "versePeak", "introPeak", "flowOk", "flowErr", "dropsPerMin", "dropGood", "dropRecall", "flashMax", "flashPerMin", "flashIntro", "flashVerse", "flashChorus", "flashBreak", "crowdCorr", "jumpCalm", "jumpLoud", "crowdIntroX", "crowdVerseX", "crowdChorusX", "jumpVerse", "jumpChorus", "famHit", "famSoundHit", "guitar", "piano", "planMs", "stepUs"];
const fmt = (v) => (typeof v === "number" ? (Number.isNaN(v) ? "-" : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)) : v ?? "-");
const show = (args.includes("--cols") ? opt("--cols").split(",") : cols);
console.log(["group".padEnd(28), ...show.map((c) => c.slice(0, 9).padStart(9))].join(" "));
for (const [g, s] of Object.entries(summary)) console.log([g.slice(0, 28).padEnd(28), ...show.map((c) => String(fmt(s[c])).padStart(9))].join(" "), args.includes("--moods") ? " " + s.moods : "");
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(summary, null, 1));
