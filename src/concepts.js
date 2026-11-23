/* ---------------------------------------------------------------- Begriffe und Kategorien (für Bühne und Liedtext) */
// Eine saubere Schnittstelle über Wörterbuch (lexicon.js), Wortsuche (words.js) und Wortsinn (wordsense.js):
//  · CATEGORIES: feste Liste der Kategorien (Namen ändern sich nicht – andere Module bauen darauf auf)
//  · categoryOf(c): Kategorie eines Begriffs („gun“ → „violence“, „rain“ → „weather“), unbekannt → „misc“
//  · conceptOf(word, { lang, line }): welcher Begriff ist dieses Wort – im Zusammenhang seiner Zeile (Verneinung,
//    Redewendungen wie „killing it“, Lob-Wörter wie „geil“); null, wenn es keiner ist
//  · conceptsOfLine(line, { lang }): alle gedeuteten Begriffe einer Zeile [{ c, cat, at, len, raw, conf, ex }]
// ex = derb oder Gewalt: nie als Text zeigen (nur Licht, Bewegung, Farbe – je nach partyExplicit).
import { LEX, NEG } from "./lexicon.js";
import { matchAny } from "./words.js";
import { senseLine, EXPLICIT } from "./wordsense.js";

// Kategorie → Begriffe. Jede Kategorie steht für eine Art Bild (Waffen: Mündungsfeuer, Hieb; Wetter: Regen, Schnee …).
const GROUPS = {
  violence: "gun machinegun shoot blade axe kill death grenade battle gangster heist reaper war blood",
  explicit: "sexy insult curse drugs",
  praise: "praise goat slay vibes hype turnup",
  celebration: "party birthday confetti balloon toast festival carnival gift newyear easter holi diwali wedding victory cheer fun prom pinata bachelor sleepover anniversary feast reunion nationalday dayofthedead cake success fireworks onemore christmas holiday",
  nightlife: "club drink shots beer wine weekend allnight dj dancefloor neon laser vip disco rave bar cocktail ibiza hangover crazy wild",
  crowd: "handsup everybody hey yeah ole woo comeon crowd mexwave lighter phone singalong concert clap stomp getup crew friends together",
  music: "music sing bass drums guitar bells mic vinyl radio piano orchestra choir rockstar speakers sax rhythm echo jazz rap headphones repeat dancestyle synth accordion flute harp banjo percussion autotune rhyme lovesong dance jump bounce",
  money: "money gold diamond crown rich million luxury supercar bling boss jet yacht mansion flex payday coins bank jackpot shopping royal jewels treasure dice crypto broke silver champagne",
  weather: "rain storm lightning snow cold sun summer fog blizzard heatwave drizzle drought downpour breeze snowman darkclouds umbrella rainbow wind autumn spring",
  water: "ocean water river surf flood underwater fish bubble pool shower fountain swamp sail harbor beach island tropical kraken",
  fire: "fire devil dragon candle volcano campfire flare fireball firedancer ashes spicy cigarette lantern",
  sky: "sky heaven star moon night midnight sunrise sunset morning noon aurora comet eclipse sunbeam horizon wish destiny zodiac dark light",
  space: "space rocket fly rise skydive alien planet astronaut world timetravel portal vortex",
  nature: "flower rose forest jungle mountain desert leaves blossom arctic firefly nature grow stone mud dust park summit steam smoke",
  animal: "bird butterfly wolf beast monster wings eagle owl spider snake unicorn phoenix safari bee cat dog bear monkey fox rabbit parrot deer dinosaur frog insect bull swan",
  love: "heart love kiss heartbreak valentine romance hug promise partner ex blush passion obsession touch velvet perfume",
  emotion: "anger freedom lonely longing fear hope happy sad pain peace pride jealous alive strong lost home memory goodbye smile tears anxiety bored confused grateful excited chill insomnia nostalgia regret brave karma haters bittersweet guilt calm despair relief curious numb doubt grief betrayal gentle melancholy rage hunger thirst tired healing fragile loyalty respect closeeyes letgo soul beautiful danger rebel",
  body: "body sweat move shake hips spin run heartbeat breathe sway eyes fist hair skull feet chills voice muscle makeup tattoo headache",
  city: "city street rooftop skyline metropolis jail ambulance police stairs crossroads nowhere tunnel school",
  travel: "drive highway journey train car headlights motorbike plane helicopter bicycle vehicle adventure race escape ski skate engine",
  time: "time count clock nonstop countup waiting work coffee sleep wakeup silence",
  digital: "electric robot camera digital matrix videogame screen retro future social message vr radar loading battery drone glowdark",
  mystic: "dream magic ghost angel haunted halloween mystery hypnotic dizzy mirror illusion psychedelic spell masquerade fortune fairy sparkle crystal titan myth goblin genie maze chaos reality fairylights",
  faith: "pray hallelujah church god miracle faith truth sin bible cross baptism priest sacrifice goddess funeral",
  food: "sweet fruit fastfood chocolate tea milkshake apple lemon peach juice soda energydrink cookie cooking",
  sport: "boxing workout zen goal martialarts target whistle hunt chess",
  sound: "boom earthquake explode knock buzz beep crash whoosh roar",
  people: "hero legend family youth grandparents stranger villain fame stage movie fashion doll shades sneakers bikini justice defeat",
  color: "red blue green pink purple white black orange yellow cyan brown gray lime indigo magenta crimson blackout",
  misc: "lies cowboy truck farm pyramid castle circus kite flag lighthouse cage wall book diary armor ticket hide melt whisper float forget fall toxic magnetic infinity shatter paint",
};
const CATEGORIES = Object.keys(GROUPS);
const CAT = {};
for (const [cat, list] of Object.entries(GROUPS)) for (const c of list.split(" ")) CAT[c] ??= cat;
const categoryOf = (c) => CAT[c] || "misc";
// alle Begriffe einer Kategorie
const conceptsIn = (cat) => (GROUPS[cat] ? GROUPS[cat].split(" ") : []);

const langsOf = (lang) => (!lang || lang === "en" ? ["en"] : [lang, "en"]);
// alle gedeuteten Begriffe einer Zeile
function conceptsOfLine(line, { lang = "en" } = {}) {
  const text = String(line || "");
  if (!text.trim()) return [];
  const hits = matchAny(text, langsOf(lang), LEX);
  return senseLine(text, hits, { neg: NEG, main: lang }).map((x) => ({ c: x.c, cat: categoryOf(x.c), at: x.at, len: x.len, raw: x.raw, conf: x.conf, ex: EXPLICIT.has(x.c) }));
}
// ein Wort (optional in seiner Zeile): Begriff oder null
function conceptOf(word, { lang = "en", line } = {}) {
  const w = String(word || "").trim();
  if (!w) return null;
  const text = line && line.toLocaleLowerCase().includes(w.toLocaleLowerCase()) ? line : w;
  const at = text === w ? 0 : text.toLocaleLowerCase().indexOf(w.toLocaleLowerCase());
  const all = conceptsOfLine(text, { lang });
  const hit = all.find((x) => x.at <= at && x.at + x.len >= at + w.length) || all.find((x) => x.at >= at && x.at < at + w.length);
  return hit ? hit.c : null;
}

export { CATEGORIES, GROUPS, categoryOf, conceptsIn, conceptOf, conceptsOfLine };
