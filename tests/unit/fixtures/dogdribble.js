// „Dog Dribble“ (Getdown Services): fünf zeitgenaue LRCLIB-Fassungen. Vier (20150209, 20577309, 25938792,
// 25366854) beginnen bei 0:25,79, eine (34335447, Künstler „Getdown Services, Joshua Law, & Benjamin Sadler“)
// 1,75 s früher. Der Text ist ein Platzhalter mit derselben Form (Zeilen, Abstände, Wiederholungen).
const TEXT = [
  "Get down get down", "Throw the ball across the yard", "Watch him run and watch him go", "Dog dribble on the floor",
  "Get down get down", "Nobody told me it was hard", "Everybody wants to know", "Dog dribble on the floor",
  "Hey hey hey", "Round and round the garden", "Back again and back again", "Dog dribble on the floor",
];
// Zeilenabstände wie bei Sprechgesang: unregelmäßig, 2,6–4,4 s
const GAPS = [3100, 2900, 4200, 3600, 3000, 2700, 4400, 3300, 2600, 3900, 3100];
function version(id, start, { artist = "Getdown Services", jitter = 0, source = "lrclib" } = {}) {
  let t = start;
  const lines = TEXT.map((text, i) => {
    const l = { t: Math.round(t + (i % 3 === 1 ? jitter : 0)), text };
    t += GAPS[i] || 3000;
    return l;
  });
  return { source, lrcId: source === "lrclib" ? id : undefined, artist, synced: true, lang: "", lines };
}
const OK = 25790, EARLY = OK - 1750;
const versions = () => [
  version(20150209, OK),
  version(20577309, OK, { jitter: 40 }),
  version(25938792, OK, { jitter: -30 }),
  version(25366854, OK, { jitter: 20 }),
  version(34335447, EARLY, { artist: "Getdown Services, Joshua Law, & Benjamin Sadler" }),
];
module.exports = { TEXT, version, versions, OK, EARLY };
