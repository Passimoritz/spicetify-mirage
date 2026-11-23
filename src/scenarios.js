/* ---------------------------------------------------------------- Szenarien (Party-Modus) */
// Zwei Quellen lassen die Bühne reagieren – nicht nur das Wortbild über dem Cover (words.js):
//  1. Wörter im Liedtext: singt jemand „fire“, zünden die Flammen am Bühnenrand; „rain“ legt einen blauen
//     Schleier von oben und Tropfen-Ringe auf den Boden, „confetti“ schießt eine Konfettikanone, „northern lights“
//     zieht ein Nordlicht über den Himmel, „jump“ lässt die Menge springen, „3, 2, 1“ zählt auf den nächsten
//     Schlägen mit … Jeder Begriff (lexicon/, rund 380 Begriffe in 45 Sprachen) hat eine oder mehrere
//     Bühnen-Antworten aus einer Palette von rund 80 Bildern (FAM; gezeichnet in stagefx.js und scenefx.js).
//     Welche wirklich kommt, entscheidet die Lage: Stärke nach Energie und Teil des Songs (im Refrain und Drop
//     zuerst die großen Bilder, in Strophe und Intro die ruhigen), Spielart (Country bekommt anderes „Feuer“ als
//     Techno), Abklingzeit je Familie, dasselbe Bild nicht zweimal binnen 30 s, nie zwei gleichzeitig vom selben
//     Typ, „Keine Blitze“ macht aus dem Blitz ein ruhiges Glühen, „Leicht“ nimmt die günstige Schwester oder lässt
//     die teuren weg, ohne Publikum werden Bilder der Menge zu Bildern der Bühne. Jedes Bild hat Spielarten
//     (Farbe, Richtung, Ursprung), fest je Song gewählt und bei jeder Wiederholung eine andere.
//     Ob ein Wort im Zusammenhang überhaupt zählt (Verneinung, Redewendung, Wiederholung, Stimmung, Sicherheit,
//     Lob-Wörter wie „geil“, „sick“, „krass“), plant wordsense.js je Song; in einem ruhigen Lied wird aus Pyro
//     warmes Glühen, aus „Party“ nur Farbe. Derbe Wörter (sexy, Beleidigung, Fluch, Drogen) kommen nie als Text,
//     nur als Licht – je nach Einstellung partyExplicit.
//  2. Momente der Musik (director.js plant sie): Finale, Tonartwechsel, Stopp und Wiedereinsatz, Solo,
//     a cappella, Ruf-und-Antwort, erster Schlag, Outro – und je Höhepunkt ein Drop-Bild aus der Palette des Stils.
// Hier steht nur die Entscheidung (rein rechnend, testbar); gezeichnet wird in stagefx.js / scenefx.js.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Familien der Bühnen-Antwort. cd = Abklingzeit (s) dieser Familie · dur = Dauer (s) · lite = auch bei „Leicht“
// · la = günstige Schwester bei „Leicht“ ([Familie, Farbe?, Herkunft?]) · flash = blitzt (nur mit Blitzen an und
// durch die Blitz-Schranke) · venue = löst einen Bühneneffekt der Location aus (Pyro, CO2, Raketen, Konfetti – die
// Location entscheidet, ob er dort hingehört) · crowd = Bild der Menge; alt = was ohne Publikum an seine Stelle tritt
// · big = großes Bild (im Refrain/Drop zuerst, an ruhigen Stellen weg) · loud = nur ab dieser Energie
// · nv = Zahl der Spielarten (Farbe/Richtung/Ursprung) · beats = Dauer in Schlägen statt Sekunden
const FAM = {
  wash: { cd: 6, dur: 3.2, lite: true },
  sun: { cd: 9, dur: 3.4, lite: true },
  stars: { cd: 10, dur: 4.5, lite: true },
  gold: { cd: 9, dur: 3.2, lite: false },
  wave: { cd: 9, dur: 3.6, lite: true },
  sweep: { cd: 7, dur: 2.2, lite: true },
  shock: { cd: 5, dur: 1.4, lite: true, loud: 0.3 },
  count: { cd: 12, dur: 0, lite: true },
  chaos: { cd: 12, dur: 2.4, lite: false, loud: 0.45, big: true },
  bolt: { cd: 8, dur: 1.1, lite: true, flash: true, loud: 0.2 },
  sparks: { cd: 7, dur: 1.6, lite: false },
  pyro: { cd: 10, dur: 1, lite: false, venue: true, loud: 0.45, big: true },
  co2: { cd: 8, dur: 1.4, lite: false, venue: true, loud: 0.4 },
  rockets: { cd: 14, dur: 3, lite: false, venue: true, loud: 0.5, big: true },
  confetti: { cd: 18, dur: 4, lite: false, venue: true, loud: 0.35, big: true },
  jump: { cd: 8, dur: 0, lite: true, crowd: true, alt: "shock", loud: 0.35 },
  hands: { cd: 10, dur: 0, lite: true, crowd: true, alt: "spothunt" },
  // Farbstimmung über die ganze Bühne (Gefühle, Ruhe, Stille: dunkle Farbe dunkelt ab), langsam ein und aus
  mood: { cd: 8, dur: 6, lite: true },
  // zwei Spots wiegen sich langsam nah an der Mitte (sexy, Hüften, Körper)
  sway: { cd: 10, dur: 6, lite: true },
  // ein kurzer harter Akzent zur Mitte hin (Beleidigung) – ohne Blitz, mit „Keine Blitze“ weich
  accent: { cd: 8, dur: 0.9, lite: true },
  // langsamer Farbwechsel durch den Farbkreis (Drogen) – ruhig, ohne Flackern, nichts Verherrlichendes
  psy: { cd: 14, dur: 5, lite: true },
  // Neonbänder über der Bühne (Club, Neon, Laser, Sirenen)
  neon: { cd: 9, dur: 4, lite: true },

  /* ---- neue Bilder (scenefx.js) */
  // Feiern
  cannon: { cd: 14, dur: 3.4, lite: true, nv: 3, loud: 0.35, big: true }, // Konfettikanone aus beiden Ecken
  streamers: { cd: 12, dur: 4.5, lite: true, nv: 3, big: true }, // Luftschlangen von oben
  balloons: { cd: 14, dur: 5.5, lite: true, nv: 3 }, // Luftballons steigen auf
  fwpeony: { cd: 12, dur: 2.8, lite: false, la: ["stars"], nv: 4, loud: 0.4, big: true }, // Feuerwerk: Kugelbombe
  fwwillow: { cd: 12, dur: 3.6, lite: false, la: ["stars", [255, 210, 130]], nv: 3, loud: 0.4, big: true }, // Feuerwerk: goldene Weide
  fwring: { cd: 12, dur: 2.6, lite: true, nv: 3, loud: 0.3 }, // Feuerwerk: Ring (Spielart 2: Herz)
  // Club und Licht
  lasergrid: { cd: 10, dur: 4, lite: true, nv: 3 }, // Laser-Gitter auf dem Boden
  lasertunnel: { cd: 12, dur: 4, lite: false, la: ["neon"], nv: 3, loud: 0.4, big: true }, // Laser-Tunnel aus der Mitte
  spothunt: { cd: 10, dur: 4, lite: true, nv: 3 }, // Suchscheinwerfer jagen über die Menge
  discoball: { cd: 12, dur: 5, lite: false, la: ["stars"], nv: 3 }, // Spiegelkugel-Reflexe
  searchlight: { cd: 12, dur: 4.5, lite: true, nv: 2 }, // zwei Himmelsstrahler kreuzen sich (Premiere, Ruhm)
  follow: { cd: 9, dur: 4, lite: true, nv: 3 }, // ein Verfolger-Spot auf die Mitte
  // Geld und Glanz
  coins: { cd: 10, dur: 3.6, lite: false, la: ["stars", [255, 205, 80]], nv: 2 }, // Münzregen
  champspray: { cd: 12, dur: 2.8, lite: false, la: ["stars", [255, 235, 170]], nv: 2, loud: 0.35 }, // Champagnerdusche
  diamond: { cd: 9, dur: 3.2, lite: true, nv: 3 }, // Diamant-Funkeln (Vierstrahl-Sterne)
  tiara: { cd: 12, dur: 3.6, lite: true, nv: 2 }, // Krone aus Licht über dem Cover
  // Wetter und Natur
  thunder: { cd: 12, dur: 4, lite: false, la: ["wash", [70, 140, 255], "top"], flash: true, nv: 2, loud: 0.25 }, // Gewitter: Regenschleier, Wetterleuchten
  blizzard: { cd: 10, dur: 4.5, lite: true, nv: 2 }, // Schneesturm
  leaves: { cd: 10, dur: 5, lite: true, nv: 4 }, // fallende Blätter / Blüten
  aurora: { cd: 14, dur: 6, lite: true, nv: 3 }, // Nordlicht
  dawn: { cd: 12, dur: 5, lite: true, nv: 3 }, // Morgenrot / Abendrot vom Horizont
  rainbow: { cd: 14, dur: 5, lite: true, nv: 2 }, // Regenbogen
  haze: { cd: 10, dur: 4.5, lite: true, nv: 2 }, // Hitzeflimmern
  jungle: { cd: 12, dur: 5, lite: true, nv: 2 }, // Blätter wiegen sich am Rand
  foam: { cd: 10, dur: 4.5, lite: false, la: ["wave"], nv: 2 }, // Brandung mit Gischt
  bubbles: { cd: 10, dur: 4.5, lite: true, nv: 3 }, // Luftblasen steigen auf
  ice: { cd: 10, dur: 4, lite: true, nv: 2 }, // Eiskristalle wachsen von den Rändern
  firewall: { cd: 10, dur: 3.6, lite: false, la: ["wash", [255, 120, 40], "floor"], nv: 2, loud: 0.35, big: true }, // Feuerwand am Boden
  lava: { cd: 12, dur: 5, lite: true, nv: 2 }, // Lava-Blasen steigen träge
  fireflies: { cd: 10, dur: 5, lite: true, nv: 3 }, // Glühwürmchen
  drops: { cd: 8, dur: 3.5, lite: true, nv: 2 }, // Tropfen-Ringe auf dem Boden (Pfützen, Echo)
  // Himmel und All
  comet: { cd: 9, dur: 3, lite: true, nv: 3 }, // Sternschnuppen
  warp: { cd: 12, dur: 3.5, lite: false, la: ["stars"], nv: 2, loud: 0.35, big: true }, // Sprung durch den Hyperraum
  planet: { cd: 14, dur: 6, lite: true, nv: 4 }, // ein Planet geht auf
  launch: { cd: 14, dur: 3.5, lite: false, la: ["sweep"], nv: 2, loud: 0.35, big: true }, // Raketenstart mit Feuerschweif
  eclipse: { cd: 14, dur: 5, lite: true, nv: 2 }, // Finsternis: Korona ums Cover
  // Gefühle
  hearts: { cd: 10, dur: 4.5, lite: true, nv: 3 }, // Herzen steigen auf
  crack: { cd: 12, dur: 3, lite: true, nv: 2 }, // Riss durch die Bühne (gebrochenes Herz)
  ekg: { cd: 10, dur: 3.5, lite: true, nv: 2 }, // Herzschlag-Linie
  ghosts: { cd: 12, dur: 5, lite: true, nv: 3 }, // Nebelgestalten treiben (Spielart 1: Wolken, 2: giftgrün)
  candles: { cd: 12, dur: 5.5, lite: true, nv: 2 }, // Kerzenreihe
  rays: { cd: 10, dur: 5, lite: true, nv: 3 }, // schräge Lichtstrahlen wie durch Kirchenfenster
  // Stadt und Straße
  skyline: { cd: 12, dur: 5, lite: true, nv: 3 }, // Fenster einer Skyline gehen an
  headlights: { cd: 9, dur: 3, lite: true, nv: 2 }, // Scheinwerfer eines Autos streichen vorbei
  beacon: { cd: 12, dur: 4, lite: true, nv: 2 }, // Rundumleuchte (Polizei blau-rot, Rettung orange) – kein Blinken
  clock: { cd: 12, dur: 0, lite: true, beats: 8 }, // Ziffernblatt tickt auf den Schlägen
  // Menge (ohne Publikum: alt)
  mexwave: { cd: 12, dur: 4, lite: true, crowd: true, alt: "sweep" }, // La-Ola-Welle durch die Menge
  lighters: { cd: 14, dur: 6, lite: true, crowd: true, alt: "candles", nv: 2 }, // Feuerzeuge wiegen sich
  phones: { cd: 14, dur: 6, lite: true, crowd: true, alt: "fireflies", nv: 2 }, // Handylichter
  clappulse: { cd: 10, dur: 0, lite: true, crowd: true, alt: "drops", beats: 8 }, // Klatschen auf den Schlägen
  // Musik
  micdrop: { cd: 16, dur: 2.6, lite: true }, // Mikro fällt, Bodenring, kurz dunkler
  scratch: { cd: 10, dur: 2.5, lite: true, nv: 2 }, // Schallplatte, vor und zurück gekratzt
  guitarspark: { cd: 10, dur: 2, lite: false, la: ["wash", [255, 200, 120], "floor"], nv: 2, loud: 0.35, big: true }, // Funkenfontänen
  bassdrop: { cd: 9, dur: 1.8, lite: true, loud: 0.35, big: true }, // mehrere Druckwellen vom Boden
  // Digital und Rausch
  glitch: { cd: 10, dur: 2.5, lite: true, nv: 2 }, // VHS-Glitch: versetzte Bänder, Zeilen
  matrix: { cd: 12, dur: 4.5, lite: false, la: ["glitch"], nv: 2 }, // digitaler Regen
  spiral: { cd: 12, dur: 5, lite: true, nv: 2 }, // hypnotische Spirale (langsam, ohne Flackern)
  kaleido: { cd: 12, dur: 5, lite: false, la: ["psy"], nv: 3 }, // Kaleidoskop
  flock: { cd: 10, dur: 5, lite: true, nv: 2 }, // Vogelschwarm zieht vorbei
  // Waffen und Kampf (Rap, Rock, Metal) – stilisiert, nie blutig: Mündungsfeuer (hart nur durch die Blitz-Schranke,
  // „rapid“: Salve), Leuchtspuren mit Querschläger-Funken, ein Klingen-Hieb quer über die Bühne („heavy“: Axt, doppelt)
  muzzle: { cd: 8, dur: 1.6, lite: true, flash: true, nv: 2, loud: 0.3 },
  tracer: { cd: 8, dur: 1.4, lite: true, nv: 2, loud: 0.3 },
  slash: { cd: 8, dur: 1.1, lite: true, nv: 2 },
};
const FAMS = Object.keys(FAM);
// Bilder, die scenefx.js zeichnet (alles nach „neon“)
const SCENE_FAMS = FAMS.slice(FAMS.indexOf("neon") + 1);

// Farben der Schleier (wash): woher er kommt (top/floor/center) und in welcher Farbe
const C = {
  warm: [255, 120, 40], hell: [255, 40, 20], rain: [70, 140, 255], frost: [150, 215, 255], love: [255, 80, 150], dream: [170, 110, 255],
  ghost: [140, 160, 210], heaven: [255, 245, 225], moon: [200, 210, 255], gold: [255, 200, 70], night: [60, 70, 200], silver: [215, 225, 240],
  // fast schwarz: die Stimmung dunkelt die Bühne ab (Stille, „lights out“)
  dim: [4, 4, 12],
};
// Begriff → Bühnen-Antworten. [Familie, Farbe?, Herkunft?]. Farb-Wörter (tint) bekommen ihre eigene Farbe aus words.js.
// Mehr als zwei Antworten: die weiteren kommen, wenn die ersten gerade abklingen oder eben erst liefen (Abwechslung).
const STAGE = {
  fire: [["pyro"], ["wash", C.warm, "floor"], ["firewall"]], devil: [["pyro"], ["wash", C.hell, "floor"], ["firewall", [255, 50, 20]]], boom: [["shock"], ["co2"], ["bassdrop"]],
  rain: [["wash", C.rain, "top"], ["drops"]], tears: [["wash", C.rain, "top"], ["drops"]], storm: [["thunder"], ["bolt"], ["wash", C.rain, "top"]], lightning: [["bolt"], ["thunder"]],
  snow: [["wash", C.frost, "top"], ["blizzard"], ["co2"]], cold: [["wash", C.frost, "floor"], ["ice"], ["co2"]], christmas: [["wash", C.frost, "top"], ["gold"], ["candles"], ["blizzard"]],
  sun: [["sun", [255, 200, 90]], ["dawn"]], summer: [["sun", [255, 170, 60]], ["haze"], ["fireflies"]], beach: [["sun", [255, 190, 110]], ["wave"], ["foam"]], light: [["sun", [255, 240, 210]], ["rays"], ["diamond"]],
  sky: [["sun", [170, 210, 255]], ["flock"], ["ghosts", [235, 240, 255], "clouds"]], heaven: [["sun", C.heaven], ["wash", C.heaven, "top"], ["rays"]], angel: [["sun", C.heaven], ["rays"]],
  star: [["stars"], ["comet"]], night: [["stars"], ["wash", C.night, "top"], ["fireflies"]], moon: [["wash", C.moon, "top"], ["stars"], ["eclipse"]], space: [["stars"], ["sweep"], ["warp"], ["planet"]],
  dream: [["wash", C.dream, "center"], ["stars"], ["kaleido"]], magic: [["stars"], ["wash", C.dream, "center"], ["fireflies"]], ghost: [["wash", C.ghost, "floor"], ["ghosts"]],
  dark: [["wash", C.night, "floor"]], black: [["wash", C.night, "floor"]],
  heart: [["wash", C.love, "center"], ["hearts"]], love: [["wash", C.love, "center"], ["hearts"]], kiss: [["wash", C.love, "center"], ["hearts"]], rose: [["wash", [255, 40, 80], "center"], ["leaves", [255, 40, 80]]],
  flower: [["wash", [255, 150, 200], "center"], ["leaves", [255, 150, 200]]], heartbreak: [["shock"], ["wash", [255, 50, 90], "center"], ["crack"]],
  money: [["gold"], ["coins"]], gold: [["gold"], ["wash", C.gold, "top"], ["coins"]], diamond: [["gold", [190, 240, 255]], ["diamond"]], crown: [["gold"], ["sun", C.gold], ["tiara"]],
  champagne: [["gold", [255, 230, 150]], ["champspray"]], silver: [["gold", C.silver], ["diamond", C.silver]],
  ocean: [["wave"], ["foam"]], water: [["wave"], ["bubbles"]], wind: [["sweep"], ["leaves"]], fly: [["sweep"], ["flock"]], bird: [["sweep"], ["flock"]], butterfly: [["sweep"], ["flock", [255, 170, 230]]],
  rocket: [["sweep"], ["co2"], ["launch"]], smoke: [["co2"], ["ghosts", [200, 205, 215]]], electric: [["sparks"], ["glitch"]], rainbow: [["chaos"], ["rainbow"]],
  fireworks: [["rockets"], ["fwpeony"], ["fwwillow"], ["fwring"]], party: [["confetti"], ["jump"], ["cannon"], ["streamers"]], birthday: [["confetti"], ["balloons"], ["candles"]],
  dance: [["jump"], ["discoball"]], jump: [["jump"]], world: [["sweep"], ["planet"]], drive: [["sweep"], ["headlights"]], city: [["sweep"], ["skyline"]], time: [["count"], ["clock"]],
  music: [["hands"], ["lighters"]], sing: [["hands"], ["lighters"]],
  // neue Begriffe der Szenarien (lexicon/: count, bass, handsup, hype, crazy, orange, yellow, cyan)
  count: [["count"]], bass: [["shock"], ["jump"], ["bassdrop"]], handsup: [["hands"], ["jump"], ["mexwave"]], hype: [["jump"], ["hands"], ["cannon"]], crazy: [["chaos"], ["spiral"]],
  // Nachtleben
  club: [["neon"], ["sweep"], ["discoball"], ["lasergrid"]], drink: [["wash", [255, 170, 60], "center"]], shots: [["shock"], ["hands"]], beer: [["wash", [255, 190, 60], "floor"], ["bubbles", [255, 200, 90]]],
  wine: [["wash", [150, 20, 60], "center"]], turnup: [["jump"], ["sparks"], ["cannon"]], weekend: [["neon"], ["hands"], ["streamers"]], allnight: [["stars"], ["neon"], ["discoball"]],
  dj: [["sweep"], ["shock"], ["scratch"]], dancefloor: [["neon"], ["jump"], ["lasergrid"], ["discoball"]], neon: [["neon"], ["lasergrid"]], laser: [["sweep"], ["neon"], ["lasertunnel"], ["lasergrid"]], vip: [["gold"], ["neon"], ["searchlight"]],
  wild: [["chaos"], ["jump"]], bounce: [["jump"], ["bassdrop"]], crew: [["hands"], ["mexwave"]], blackout: [["mood", C.dim]],
  // Geld und Luxus: goldener Regen, Glitzer
  rich: [["gold"], ["wash", C.gold, "top"], ["coins"]], million: [["gold"], ["coins"]], luxury: [["gold", [255, 230, 180]], ["sweep"], ["diamond"]], supercar: [["sweep"], ["gold"], ["headlights"]],
  bling: [["gold", [200, 240, 255]], ["diamond"]], boss: [["gold"], ["shock"], ["tiara"]], jet: [["sweep"], ["stars"], ["comet"]], yacht: [["wave"], ["gold"], ["foam"]],
  mansion: [["gold"], ["sun", C.gold], ["skyline", C.gold]], flex: [["gold"], ["hands"], ["coins"]], payday: [["gold"], ["jump"], ["coins"]],
  // Körper und Bewegung
  body: [["sway", [255, 150, 120]]], sweat: [["wash", [255, 110, 60], "floor"], ["jump"], ["haze"]], move: [["jump"], ["sweep"]], shake: [["shock"], ["jump"]],
  hips: [["sway", [255, 100, 160]]], clap: [["hands"], ["shock"], ["clappulse"]], stomp: [["shock"], ["jump"], ["bassdrop"]], spin: [["chaos"], ["spiral"]], run: [["sweep"]],
  heartbeat: [["shock", [255, 60, 90]], ["wash", C.love, "center"], ["ekg"]], breathe: [["mood", [170, 220, 255]]], getup: [["jump"], ["hands"]],
  touch: [["wash", C.love, "center"]], sway: [["sway"]],
  // Gefühle als Farbstimmung
  anger: [["mood", [220, 20, 20]]], freedom: [["mood", [120, 210, 255]], ["sweep"], ["flock"]], lonely: [["mood", [60, 80, 170]]], longing: [["mood", [150, 110, 220]]],
  fear: [["mood", [80, 40, 120]], ["ghosts"]], hope: [["mood", [255, 220, 150]], ["sun", [255, 220, 150]], ["dawn"]], happy: [["mood", [255, 210, 80]], ["balloons"]],
  sad: [["mood", [60, 90, 160]], ["wash", C.rain, "top"]], pain: [["mood", [150, 20, 50]], ["crack", [200, 40, 70]]], peace: [["mood", [150, 230, 200]], ["lighters"]],
  pride: [["mood", [255, 180, 60]], ["sun", [255, 200, 90]], ["rainbow"]], jealous: [["mood", [60, 200, 80]]], alive: [["mood", [255, 170, 80]], ["sun", [255, 200, 120]], ["ekg"]],
  strong: [["mood", [255, 90, 40]], ["shock"]], lost: [["mood", [90, 100, 150]]], home: [["mood", [255, 180, 110]], ["candles"]], memory: [["mood", [200, 170, 140]], ["fireflies"]],
  goodbye: [["mood", [110, 120, 190]], ["lighters"]], smile: [["mood", [255, 220, 120]]], together: [["mood", [255, 160, 120]], ["hands"], ["lighters"]],
  // Orte und Zeiten
  street: [["sweep"], ["wash", [255, 150, 60], "floor"], ["skyline"]], desert: [["sun", [255, 170, 80]], ["wash", [230, 150, 70], "floor"], ["haze"]],
  midnight: [["stars"], ["wash", C.night, "top"], ["clock"]], sunrise: [["sun", [255, 170, 90]], ["dawn"]], sunset: [["sun", [255, 120, 70]], ["dawn", null, "dusk"]],
  morning: [["sun", [255, 235, 190]], ["dawn"]], forest: [["wash", [40, 160, 80], "floor"], ["jungle"], ["fireflies"]], jungle: [["wash", [30, 180, 70], "top"], ["jungle"]],
  mountain: [["sweep"], ["wash", [170, 200, 230], "top"], ["dawn"]], island: [["wave"], ["sun", [255, 200, 120]], ["foam"]], tropical: [["sun", [255, 190, 90]], ["wave", [40, 220, 200]], ["jungle"]],
  highway: [["sweep"], ["headlights"]], rooftop: [["stars"], ["sweep"], ["skyline"]], spring: [["wash", [150, 240, 150], "top"], ["leaves", [255, 180, 220]]],
  autumn: [["wash", [230, 120, 40], "top"], ["leaves", [230, 120, 40]]], fog: [["co2"], ["wash", C.silver, "floor"], ["ghosts", [210, 215, 225]]], holiday: [["sun", [255, 200, 100]], ["wave"]],
  journey: [["sweep"], ["headlights"]], train: [["sweep"], ["headlights"]], sail: [["wave"], ["foam"]],
  // Rufe: die Menge antwortet
  hey: [["hands"], ["clappulse"]], yeah: [["hands"], ["shock"]], ole: [["hands"], ["wash", C.gold, "top"], ["mexwave"]], woo: [["jump"], ["hands"]], everybody: [["hands"], ["jump"], ["mexwave"]],
  comeon: [["jump"], ["hands"]], hallelujah: [["sun", C.heaven], ["hands"], ["rays"]], onemore: [["hands"], ["confetti"], ["lighters"]],
  // Weiteres
  wolf: [["wash", C.moon, "top"], ["stars"]], beast: [["shock"], ["wash", [255, 120, 30], "floor"], ["firewall"]], dragon: [["pyro"], ["wash", C.hell, "floor"], ["firewall"]],
  war: [["shock"], ["mood", [170, 30, 20]]], blood: [["mood", [170, 0, 20]]], candle: [["wash", C.warm, "center"], ["candles"]], drums: [["shock"], ["jump"], ["bassdrop"]],
  guitar: [["sparks"], ["guitarspark"]], bells: [["stars"], ["wash", C.gold, "top"], ["rays"]], sparkle: [["gold", [255, 250, 230]], ["stars"], ["diamond"]], rise: [["sun", [255, 220, 170]], ["sweep"], ["launch"]],
  monster: [["wash", [90, 220, 90], "floor"], ["ghosts", null, "toxic"]], alien: [["wash", [90, 255, 140], "top"], ["stars"], ["planet"]], robot: [["sparks"], ["neon"], ["glitch"]], earthquake: [["shock"], ["co2"], ["bassdrop"]],
  sweet: [["wash", [255, 150, 200], "center"], ["balloons", [255, 150, 200]]], pray: [["sun", C.heaven], ["wash", C.heaven, "top"], ["rays"]], camera: [["sweep"], ["bolt"], ["follow"]], sleep: [["mood", [40, 50, 130]]],
  wakeup: [["sun", [255, 230, 180]], ["dawn"]], silence: [["mood", C.dim]], victory: [["confetti"], ["gold"], ["cannon"]], hero: [["sun", [255, 230, 170]], ["hands"], ["follow"]],
  legend: [["gold"], ["sun", C.gold], ["searchlight"]], police: [["neon", null, "police"], ["beacon"]], wedding: [["wash", C.love, "center"], ["confetti"], ["hearts"], ["fwring", null, "heart"]],
  // Derbes (nie als Text): sexy → tiefes Rot/Pink, langsames Wiegen, Spots näher · Beleidigung → kurzer Akzent zur Mitte
  // und ein „Ooh“ der Menge · Fluch als Verstärker → wie ein Ruf, Energie hoch · Drogen → psychedelischer Farbwechsel
  sexy: [["sway", [200, 20, 70]], ["mood", [255, 40, 120]]], insult: [["accent"], ["hands"]], curse: [["shock"], ["jump"]], drugs: [["psy"]],

  /* ---- neue Begriffe (lex-ext.json) */
  // Feiern
  confetti: [["cannon"], ["confetti"]], balloon: [["balloons"]], toast: [["champspray"], ["hands"]], festival: [["cannon"], ["lasergrid"], ["lighters"]],
  carnival: [["streamers"], ["cannon"]], disco: [["discoball"], ["neon"]], fame: [["searchlight"], ["follow"]], stage: [["follow"], ["spothunt"]],
  lighter: [["lighters"]], phone: [["phones"]], mexwave: [["mexwave"]], mic: [["micdrop"], ["follow"]], vinyl: [["scratch"]], rave: [["lasergrid"], ["lasertunnel"], ["neon"]],
  radio: [["glitch", [120, 200, 255]], ["ekg", [120, 200, 255]]], piano: [["follow"], ["candles"]], orchestra: [["rays"], ["follow"]], choir: [["rays"], ["candles"]],
  concert: [["spothunt"], ["lighters"], ["phones"]], crowd: [["mexwave"], ["phones"]], singalong: [["lighters"], ["hands"]],
  coins: [["coins"]], bank: [["coins"], ["gold"]], jackpot: [["coins"], ["cannon"], ["neon"]], shopping: [["coins"], ["diamond"]], gift: [["cannon"], ["streamers"]],
  royal: [["tiara"], ["gold"]], jewels: [["diamond"], ["gold", [255, 120, 160]]], treasure: [["coins"], ["diamond"]],
  // Wetter und Natur
  blizzard: [["blizzard"], ["wash", C.frost, "top"]], arctic: [["aurora"], ["ice"]], leaves: [["leaves"]], blossom: [["leaves", [255, 180, 220]], ["wash", [255, 170, 210], "top"]],
  aurora: [["aurora"]], heatwave: [["haze"], ["sun", [255, 150, 60]]], river: [["wave"], ["drops"]], surf: [["foam"], ["wave"]], flood: [["foam"], ["wash", C.rain, "floor"]],
  underwater: [["bubbles"], ["wash", [30, 90, 200], "top"]], fish: [["bubbles"], ["wave", [40, 200, 220]]], bubble: [["bubbles"]], volcano: [["lava"], ["firewall"], ["pyro"]],
  campfire: [["firewall", [255, 150, 60], "low"], ["candles"]], firefly: [["fireflies"]], drizzle: [["drops"], ["wash", C.rain, "top"]],
  planet: [["planet"], ["stars"]], comet: [["comet"]], eclipse: [["eclipse"]], astronaut: [["warp"], ["planet"], ["stars"]], wish: [["comet"], ["fireflies"]],
  destiny: [["comet"], ["stars"]], infinity: [["spiral"], ["kaleido"]],
  // Liebe und Gefühle
  valentine: [["hearts"], ["wash", C.love, "center"]], romance: [["hearts"], ["candles"]], hug: [["hearts", [255, 170, 140]], ["mood", [255, 170, 130]]], promise: [["candles"], ["hearts"]],
  shatter: [["crack"], ["shock"]], haunted: [["ghosts"], ["mood", [60, 50, 110]]], halloween: [["ghosts", null, "toxic"], ["candles", [255, 140, 30]]], mystery: [["ghosts"], ["spothunt"]],
  church: [["rays"], ["candles"]], god: [["rays"], ["sun", C.heaven]], miracle: [["rays"], ["stars"]], faith: [["rays"], ["candles"]], truth: [["follow"], ["rays"]],
  lies: [["glitch"], ["mood", [120, 60, 140]]], ambulance: [["beacon", null, "amber"]], jail: [["spothunt"], ["beacon"]], escape: [["spothunt"], ["headlights"]],
  passion: [["firewall", [255, 40, 60]], ["hearts", [255, 40, 60]]], obsession: [["spiral", [255, 60, 120]], ["mood", [180, 20, 80]]], danger: [["beacon", null, "amber"], ["mood", [200, 40, 20]]],
  rebel: [["firewall"], ["guitarspark"]], haters: [["accent"], ["crack"]], karma: [["spiral"], ["mood", [150, 90, 220]]], nostalgia: [["dawn", null, "dusk"], ["fireflies"]],
  regret: [["mood", [90, 90, 150]], ["drops"]], brave: [["follow"], ["mood", [255, 120, 50]]], anxiety: [["ekg", [255, 120, 120]], ["mood", [110, 60, 130]]], bored: [["mood", [120, 120, 140]]],
  confused: [["spiral"], ["kaleido"]], blush: [["hearts", [255, 150, 190]], ["mood", [255, 130, 170]]], grateful: [["rays"], ["candles"]], excited: [["cannon"], ["bassdrop"]],
  chill: [["aurora"], ["wave"]], insomnia: [["clock"], ["fireflies"]], hangover: [["spiral", [170, 200, 120]], ["mood", [120, 140, 90]]], soul: [["rays"], ["candles"]],
  closeeyes: [["fireflies"], ["mood", [40, 50, 120]]], letgo: [["balloons"], ["flock"]], sin: [["firewall", [255, 40, 30]], ["mood", [170, 0, 30]]],
  beautiful: [["diamond"], ["leaves", [255, 180, 220]]], velvet: [["sway", [150, 20, 90]], ["mood", [120, 20, 80]]], perfume: [["leaves", [255, 170, 220]], ["fireflies", [255, 180, 230]]],
  // Stadt, Straße, Reise
  skyline: [["skyline"]], car: [["headlights"], ["sweep"]], headlights: [["headlights"]], motorbike: [["headlights"], ["sweep"]], plane: [["comet"], ["sweep"]],
  harbor: [["searchlight"], ["foam"]], adventure: [["headlights"], ["sweep"]], summit: [["dawn"], ["launch"]], skydive: [["warp"], ["sweep"]], horizon: [["dawn"]],
  tunnel: [["lasertunnel"], ["warp"]], race: [["headlights"], ["cannon"]], ibiza: [["sun", [255, 190, 90]], ["lasergrid"], ["foam"]], ski: [["blizzard"], ["sun", [255, 240, 220]]],
  skate: [["discoball"], ["headlights"]], work: [["clock"]], coffee: [["dawn"], ["mood", [190, 140, 90]]],
  // Zeit und Feste
  newyear: [["fwpeony"], ["clock"], ["cannon"]], easter: [["leaves", [255, 220, 120]], ["balloons"]], holi: [["cannon", null, "holi"], ["kaleido"]], diwali: [["candles"], ["fwwillow"]],
  funeral: [["candles"], ["mood", [60, 60, 90]]], prom: [["discoball"], ["balloons"]], timetravel: [["warp"], ["clock"]], cake: [["candles"], ["balloons"]],
  // Digital und Rausch
  digital: [["matrix"], ["glitch"]], matrix: [["matrix"]], videogame: [["glitch"], ["lasergrid"]], screen: [["glitch"]], retro: [["glitch", null, "vhs"], ["discoball"]], future: [["lasergrid"], ["matrix"]],
  hypnotic: [["spiral"]], dizzy: [["spiral"], ["kaleido"]], mirror: [["kaleido"], ["discoball"]], illusion: [["kaleido"], ["ghosts"]], psychedelic: [["kaleido"], ["psy"]],
  spell: [["kaleido"], ["fireflies"]], masquerade: [["kaleido"], ["candles"]], fortune: [["kaleido"], ["stars"]], zodiac: [["stars"], ["comet"]], toxic: [["ghosts", null, "toxic"], ["glitch"]],
  magnetic: [["spiral"], ["sparks"]],
  // Musik
  rockstar: [["guitarspark"], ["follow"]], speakers: [["bassdrop"], ["shock"]], sax: [["follow"], ["candles"]], rhythm: [["clappulse"], ["bassdrop"]], echo: [["drops"]],
  jazz: [["follow"], ["candles"]], rap: [["micdrop"], ["follow"]], headphones: [["bassdrop"], ["ekg"]], repeat: [["scratch"], ["spiral"]], dancestyle: [["discoball"], ["follow"]],
  vibes: [["aurora"], ["discoball"]], slay: [["follow"], ["diamond"]], goat: [["tiara"], ["searchlight"]], cheer: [["clappulse"], ["cannon"]], fun: [["balloons"], ["cannon"]],
  // Tiere und Fabelwesen
  wings: [["flock"], ["rays"]], eagle: [["flock"]], owl: [["fireflies"], ["stars"]], spider: [["ghosts"], ["crack", [200, 210, 230]]], snake: [["spiral", [80, 220, 120]]],
  unicorn: [["rainbow"], ["diamond"]], phoenix: [["firewall"], ["launch"]], safari: [["dawn"], ["haze"]], bee: [["fireflies", [255, 200, 60]]], fairy: [["fireflies"], ["diamond"]],
  // Land und Westen
  cowboy: [["dawn", null, "dusk"], ["haze"]], truck: [["headlights"]], farm: [["dawn"], ["fireflies"]], pyramid: [["haze"], ["tiara"]], castle: [["tiara"], ["candles"]],
  // Wasser, Bad
  pool: [["bubbles"], ["wave", [40, 220, 220]]], shower: [["drops"], ["bubbles"]],
  // Licht
  lantern: [["candles"], ["fireflies"]], lighthouse: [["searchlight"]], sunbeam: [["rays"]], shades: [["sun", [255, 200, 120]], ["lasergrid"]],
  // Knall und Fahnen
  explode: [["bassdrop"], ["fwpeony"], ["shock"]], flare: [["firewall", [255, 50, 40]], ["guitarspark"]], flag: [["streamers"], ["mexwave"]], circus: [["spothunt"], ["balloons"], ["streamers"]],
  kite: [["streamers"], ["flock"]], doll: [["balloons", [255, 150, 200]], ["hearts", [255, 150, 200]]],
  // Essen und Trinken
  fruit: [["balloons"]], cocktail: [["wash", [255, 140, 120], "center"], ["bubbles", [255, 170, 120]]], bar: [["neon"], ["discoball"]],
  // Leute
  youth: [["cannon"], ["balloons"]], family: [["candles"], ["mood", [255, 180, 120]]], friends: [["lighters"], ["hands"]], fashion: [["follow"], ["searchlight"]],
  tattoo: [["neon"], ["glitch"]], sneakers: [["lasergrid"], ["bassdrop"]], paint: [["cannon", null, "holi"], ["kaleido"]], movie: [["searchlight"], ["follow"]],
  // Sport
  boxing: [["bassdrop"], ["follow"]], workout: [["clappulse"], ["bassdrop"]], zen: [["aurora"], ["candles"]], goal: [["cannon"], ["mexwave"]], dice: [["coins"], ["neon"]],
  crystal: [["diamond"], ["kaleido"]],
  // Lob (f-words: „geil“, „sick“, „krass“, „brutal“, „de ouf“ … – wordsense.js deutet sie nach Zusammenhang)
  praise: [["clappulse"], ["guitarspark"], ["hands"]],

  /* ---- noch mehr Begriffe (lex-ext2.json) */
  // Waffen und Gewalt (nur Licht, nie Text; partyExplicit wie bei derben Wörtern) – stilisiert, kein Blut
  gun: [["muzzle"], ["tracer"], ["mood", [140, 0, 15]]], machinegun: [["muzzle", null, "rapid"], ["tracer"]], shoot: [["muzzle"], ["tracer"]],
  blade: [["slash"], ["mood", [150, 0, 20]]], axe: [["slash", null, "heavy"], ["crack", [230, 220, 230]]], kill: [["mood", [130, 0, 15]], ["slash"]],
  death: [["mood", [30, 10, 30]], ["ghosts", [140, 140, 170]]], grenade: [["bassdrop"], ["co2"], ["shock"]], battle: [["tracer"], ["bassdrop"], ["mood", [170, 30, 20]]],
  gangster: [["beacon"], ["tracer"]], heist: [["spothunt"], ["beacon"]], reaper: [["ghosts", [120, 120, 150]], ["mood", [20, 10, 30]]],
  // Fahrzeuge, Tiere
  helicopter: [["spothunt"], ["sweep"]], bicycle: [["headlights"], ["sweep"]], vehicle: [["headlights"]],
  cat: [["fireflies", [200, 255, 150]], ["stars"]], dog: [["mood", [255, 190, 120]], ["jump"]], bear: [["mood", [180, 120, 70]], ["jungle"]], monkey: [["jungle"], ["jump"]],
  fox: [["leaves", [230, 120, 40]], ["fireflies", [255, 150, 60]]], rabbit: [["leaves", [255, 200, 220]], ["jump"]], parrot: [["jungle"], ["rainbow"]], deer: [["fireflies"], ["jungle"]],
  dinosaur: [["bassdrop"], ["jungle"]], frog: [["drops"], ["jungle"]], insect: [["fireflies"]], bull: [["firewall", [255, 40, 30]], ["bassdrop"]], swan: [["flock", [255, 255, 255]], ["drops"]],
  // Wetter
  drought: [["haze"], ["sun", [255, 150, 60]]], downpour: [["thunder"], ["drops"]], breeze: [["leaves", [180, 240, 180]], ["sweep"]], snowman: [["blizzard"], ["balloons", [230, 240, 255]]],
  darkclouds: [["ghosts", [110, 115, 140], "clouds"], ["mood", [70, 80, 110]]],
  // Körper
  eyes: [["follow"], ["mood", [200, 200, 255]]], fist: [["bassdrop"], ["hands"]], hair: [["sway"], ["sweep"]], skull: [["ghosts", [200, 200, 210]], ["candles"]],
  feet: [["clappulse"], ["jump"]], chills: [["ice"], ["ekg", [180, 220, 255]]], voice: [["follow"], ["ekg"]], muscle: [["follow"], ["bassdrop"]],
  // Gefühle
  bittersweet: [["mood", [200, 140, 170]], ["leaves", [230, 150, 120]]], guilt: [["mood", [110, 70, 90]], ["spothunt"]], calm: [["aurora"], ["mood", [150, 200, 230]]],
  despair: [["mood", [40, 40, 90]], ["drops"]], relief: [["dawn"], ["mood", [180, 230, 200]]], curious: [["fireflies"], ["spothunt"]], numb: [["mood", [100, 100, 120]], ["ice"]],
  doubt: [["mood", [120, 110, 150]], ["ghosts"]], grief: [["candles"], ["mood", [60, 60, 100]]], betrayal: [["crack"], ["mood", [150, 20, 40]]], gentle: [["fireflies"], ["mood", [255, 200, 190]]],
  melancholy: [["drops"], ["mood", [90, 110, 170]]], rage: [["firewall", [255, 30, 20]], ["mood", [220, 10, 10]]], hunger: [["mood", [255, 140, 60]]], thirst: [["haze"], ["drops"]],
  tired: [["mood", [60, 60, 110]], ["fireflies"]], healing: [["aurora"], ["rays"]], fragile: [["crack", [230, 230, 255]], ["mood", [200, 200, 230]]], loyalty: [["lighters"], ["hands"]],
  respect: [["follow"], ["hands"]], partner: [["hearts"], ["mood", [255, 150, 170]]], ex: [["crack"], ["mood", [120, 90, 140]]], grandparents: [["candles"], ["mood", [255, 200, 150]]],
  // Essen und Trinken
  fastfood: [["neon"], ["balloons"]], chocolate: [["mood", [150, 90, 50]], ["hearts", [180, 100, 60]]], tea: [["ghosts", [235, 240, 230]], ["mood", [200, 220, 150]]],
  milkshake: [["bubbles", [255, 200, 230]], ["balloons", [255, 200, 230]]], apple: [["balloons", [230, 40, 40]]], lemon: [["balloons", [255, 230, 60]], ["wash", [255, 240, 80], "top"]],
  peach: [["balloons", [255, 170, 130]], ["hearts", [255, 170, 130]]], spicy: [["firewall", [255, 60, 20]], ["haze"]], juice: [["bubbles", [255, 170, 60]]],
  soda: [["bubbles"], ["champspray", [200, 120, 60]]], energydrink: [["bassdrop"], ["guitarspark"]], cookie: [["balloons"], ["candles"]],
  // Technik
  drone: [["comet"], ["spothunt"]], battery: [["ekg", [80, 255, 120]], ["glitch"]], social: [["phones"], ["glitch"]], message: [["phones"], ["ekg"]], vr: [["lasergrid"], ["matrix"]],
  radar: [["drops", [80, 255, 150]], ["clock"]], loading: [["clock"], ["ekg"]], crypto: [["matrix"], ["coins"]], glowdark: [["neon"], ["fireflies", [120, 255, 180]]],
  // Instrumente und Musik
  synth: [["lasergrid"], ["neon"]], accordion: [["follow"], ["streamers"]], flute: [["fireflies"], ["follow"]], harp: [["rays"], ["fireflies"]], banjo: [["dawn", null, "dusk"], ["clappulse"]],
  percussion: [["clappulse"], ["bassdrop"]], autotune: [["glitch"], ["ekg"]], rhyme: [["micdrop"], ["follow"]], lovesong: [["candles"], ["hearts"]],
  // Natur
  stone: [["bassdrop"], ["crack", [200, 200, 190]]], mud: [["mood", [120, 90, 60]], ["drops", [150, 120, 90]]], grow: [["leaves", [120, 220, 120]], ["dawn"]], nature: [["jungle"], ["fireflies"]],
  ashes: [["ghosts", [150, 150, 150]], ["fireflies", [255, 140, 60]]], steam: [["ghosts", [235, 240, 245]]], fountain: [["champspray", [200, 230, 255]], ["bubbles"]],
  swamp: [["fireflies"], ["ghosts", [120, 160, 110]]], fireball: [["comet", [255, 120, 40]], ["firewall"]], firedancer: [["firewall"], ["follow"]], park: [["leaves", [120, 220, 120]], ["fireflies"]],
  // Sport, Feste, Glaube, Mythen
  martialarts: [["slash", [255, 240, 220]], ["follow"]], target: [["drops", [255, 60, 60]], ["follow"]], whistle: [["clappulse"], ["sweep"]],
  anniversary: [["candles"], ["hearts"], ["fwring", null, "heart"]], feast: [["candles"], ["streamers"]], reunion: [["lighters"], ["hearts"]], nationalday: [["fwpeony"], ["streamers"]],
  dayofthedead: [["candles", [255, 150, 40]], ["ghosts"], ["leaves", [255, 140, 30]]], pinata: [["cannon"], ["streamers"]], bachelor: [["discoball"], ["cannon"]], sleepover: [["fireflies"], ["balloons"]],
  bible: [["rays"], ["candles"]], cross: [["rays"], ["candles"]], baptism: [["drops"], ["rays"]], priest: [["candles"], ["rays"]], sacrifice: [["firewall", [255, 80, 30]], ["mood", [150, 20, 20]]],
  goddess: [["rays"], ["diamond"]], titan: [["bassdrop"], ["thunder"]], myth: [["thunder"], ["rays"]], goblin: [["fireflies", [150, 255, 120]], ["ghosts", null, "toxic"]], genie: [["kaleido"], ["fireflies"]],
  kraken: [["bubbles"], ["ghosts", [80, 140, 160]]],
  // Zahlen und Klänge
  nonstop: [["clock"], ["lasergrid"]], countup: [["clappulse"]], knock: [["clappulse"], ["bassdrop"]], buzz: [["glitch"], ["fireflies", [255, 220, 80]]], beep: [["ekg"], ["glitch"]],
  crash: [["crack"], ["bassdrop"]], whoosh: [["comet"], ["sweep"]], roar: [["bassdrop"], ["firewall"]], engine: [["headlights"], ["bassdrop"]],
  // Leute, Dinge, Orte
  stranger: [["ghosts"], ["spothunt"]], villain: [["beacon"], ["mood", [120, 0, 40]]], school: [["clock"]], makeup: [["diamond"], ["follow"]], maze: [["spiral"], ["lasergrid"]],
  chess: [["follow"], ["clock"]], cage: [["spothunt"], ["beacon"]], wall: [["crack"], ["bassdrop"]], dust: [["ghosts", [220, 200, 170]], ["fireflies", [255, 230, 190]]],
  metropolis: [["skyline"], ["headlights"]], stairs: [["rays"], ["launch"]], noon: [["sun", [255, 250, 220]], ["haze"]], umbrella: [["drops"], ["wash", C.rain, "top"]],
  cigarette: [["ghosts", [200, 200, 210]], ["fireflies", [255, 120, 40]]], armor: [["diamond", [220, 230, 240]], ["follow"]], ticket: [["streamers"], ["searchlight"]],
  broke: [["mood", [110, 110, 120]]], fairylights: [["fireflies", [255, 220, 150]], ["skyline", [255, 220, 150]]], vortex: [["spiral"], ["warp"]], portal: [["warp"], ["spiral"]],
  hunt: [["spothunt"], ["jungle"]], cooking: [["firewall", [255, 150, 60], "low"], ["ghosts", [235, 235, 235]]], book: [["follow"], ["candles"]], diary: [["candles"], ["fireflies"]],
  headache: [["ekg", [255, 120, 120]], ["spiral"]], crossroads: [["headlights"], ["searchlight"]], nowhere: [["haze"], ["stars"]], chaos: [["spiral"], ["glitch"], ["chaos"]],
  justice: [["follow"], ["beacon"]], reality: [["glitch"], ["matrix"]], defeat: [["crack"], ["mood", [90, 80, 110]]], success: [["cannon"], ["coins"]], bikini: [["sun", [255, 200, 120]], ["foam"]],
  // Bewegung
  fall: [["leaves"], ["comet"]], hide: [["spothunt"], ["mood", [40, 40, 70]]], melt: [["lava"], ["drops"]], whisper: [["fireflies"], ["mood", [150, 140, 200]]], float: [["balloons"], ["bubbles"]],
  waiting: [["clock"]], forget: [["ghosts"], ["mood", [110, 110, 140]]],
};
// Waffen und Gewalt: wie derbe Wörter von partyExplicit abhängig („Ignorieren“ → nichts, „Nur Farbe“ → dunkles Rot)
const VIOLENCE = new Set(["gun", "machinegun", "shoot", "blade", "axe", "kill", "death", "grenade", "battle", "gangster", "heist", "reaper", "war", "blood"]);
// Derbe Begriffe und was davon bei „Nur Farbe“ (partyExplicit: "soft") bleibt
const EXPLICIT = new Set(["sexy", "insult", "curse", "drugs"]);
const EX_SOFT = { sexy: [["mood", [255, 40, 120]]], insult: [["mood", [190, 20, 40]]], curse: [["mood", [255, 110, 40]]], drugs: [["mood", [150, 80, 255]]] };
// Ruhige Stelle (trauriger Song, wenig Energie): laute Antworten werden zu Glühen oder fallen weg
const SOFTEN = {
  pyro: ["wash", C.warm, "floor"], rockets: ["stars"], bolt: ["wash", [150, 170, 255], "top"], sparks: ["wash", [120, 200, 255], "top"],
  firewall: ["wash", C.warm, "floor"], thunder: ["drops"], fwpeony: ["stars"], fwwillow: ["stars"], lasertunnel: ["aurora"], warp: ["stars"],
  launch: ["comet"], guitarspark: ["wash", [255, 200, 120], "floor"], bassdrop: ["drops"],
};
const SOFT_DROP = new Set(["confetti", "jump", "co2", "chaos", "shock", "hands", "accent", "cannon", "streamers", "clappulse", "mexwave", "muzzle", "tracer"]);
// … und Party-Wörter, von denen dann wenigstens die Farbe bleibt
const PARTYISH = new Set(["party", "club", "turnup", "weekend", "dancefloor", "fireworks", "hype", "dance", "birthday", "victory", "onemore", "wild", "crazy", "confetti", "festival", "rave", "praise"]);
// Wie stark eine Antwort im jeweiligen Teil des Songs ausfällt (Intro und Outro leise, Refrain und Drop voll)
const PART_K = { intro: 0.6, verse: 0.8, pre: 0.85, chorus: 1, drop: 1, break: 0.6, bridge: 0.75, outro: 0.55, "": 0.8 };
// Teile, in denen die großen Bilder zuerst kommen
const BIG_PART = new Set(["chorus", "drop"]);
// Dasselbe Bild (Familie + Farbe) nicht zweimal binnen so vieler Sekunden – solange es eine andere Antwort gibt
const REPEAT = 30;

// Spielart (genres.js: Familie) → andere Bilder für dieselbe Antwort. Country bekommt Lagerfeuer statt Laser,
// Techno Laser statt Kerzen, Klassik und Ruhiges sanftes Licht statt Knall.
const GENRE_SWAP = {
  electronic: { firewall: "lasergrid", candles: "lasertunnel", rays: "lasertunnel", leaves: "kaleido", lighters: "phones", streamers: "lasergrid", fireflies: "discoball" },
  country: { lasergrid: "headlights", lasertunnel: "dawn", glitch: "fireflies", matrix: "fireflies", discoball: "fireflies", pyro: "firewall", neon: "candles", phones: "lighters", cannon: "streamers" },
  rock: { cannon: "guitarspark", balloons: "guitarspark", discoball: "spothunt", phones: "lighters", streamers: "firewall" },
  metal: { cannon: "guitarspark", balloons: "firewall", discoball: "spothunt", phones: "lighters", hearts: "firewall", streamers: "firewall" },
  urban: { cannon: "coins", streamers: "coins", candles: "skyline", lighters: "phones" },
  classical: { pyro: "candles", lasergrid: "rays", lasertunnel: "aurora", bassdrop: "drops", glitch: "fireflies", matrix: "fireflies", cannon: "streamers", guitarspark: "diamond", firewall: "candles", discoball: "diamond" },
  calm: { pyro: "candles", lasergrid: "aurora", lasertunnel: "aurora", bassdrop: "drops", glitch: "fireflies", matrix: "fireflies", cannon: "balloons", guitarspark: "fireflies", firewall: "candles" },
  spirit: { pyro: "candles", lasergrid: "rays", lasertunnel: "rays", glitch: "rays", cannon: "streamers", firewall: "candles", discoball: "rays" },
  jazz: { lasergrid: "follow", lasertunnel: "follow", glitch: "candles", matrix: "candles", cannon: "streamers", phones: "lighters" },
  latin: { lighters: "phones", candles: "firewall", aurora: "dawn" },
  europe: { lasertunnel: "discoball", matrix: "discoball", glitch: "discoball" },
};

// Zählwörter („3 2 1“, „drei, zwei, eins“, „tres dos uno“ …): ein Countdown erst, wenn die Zeile drei Zahlen
// hintereinander abwärts zählt (sonst wäre jedes „one“ ein Countdown)
const NUMS = {
  1: "1|one|eins|ein|uno|una|un|une|um|uma|bir|één|een|en|ett|yksi|jeden|раз|один|ένα|ichi|하나|一",
  2: "2|two|zwei|dos|deux|due|dois|duas|iki|twee|to|två|kaksi|dwa|два|δύο|ni|둘|二",
  3: "3|three|drei|tres|trois|tre|três|üç|drie|tre|kolme|trzy|три|τρία|san|셋|三",
  4: "4|four|vier|cuatro|quatre|quattro|quatro|dört|fire|fyra|neljä|cztery|четыре",
  5: "5|five|fünf|cinco|cinq|cinque|beş|vijf|fem|viisi|pięć|пять",
};
const NUM = new Map();
for (const [n, s] of Object.entries(NUMS)) for (const w of s.split("|")) if (!NUM.has(w)) NUM.set(w, +n);
const TOK = /[\p{L}\p{N}]+/gu;
// true = die Zeile zählt herunter (mindestens drei Zahlen nacheinander, jede eins kleiner, bis zur Eins)
function isCountdown(text) {
  let prev = 0, run = 0;
  for (const m of String(text || "").toLocaleLowerCase().matchAll(TOK)) {
    const n = NUM.get(m[0]) || 0;
    run = n && n === prev - 1 ? run + 1 : n ? 1 : 0;
    prev = n;
    if (run >= 3 && n === 1) return true;
  }
  return false;
}

// fester Zufall aus einem Text (Song-Kennung) und Zahlen – gleiche Eingabe, gleiche Spielart
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const mixHash = (h, n) => {
  let x = Math.imul(h ^ (n + 0x9e3779b9), 2654435761) >>> 0;
  x ^= x >>> 15;
  return Math.imul(x, 2246822519) >>> 0;
};

/* ---- Entscheidung pro Wort: was die Bühne tut */
// ctx: { t (s), energy 0..1, kind (Teil), level 1..5, lite, calm, noFlash, flash (Bühnenblitze erlaubt),
//        beat (s je Schlag), phase (0..1 im Schlag), col (Farbe des Farb-Worts),
//        crowd (false = kein Publikum: Bilder der Menge werden Bilder der Bühne), genre (Familie aus genres.js),
//        song (Kennung: Spielarten fest je Song) }
//        Plan aus wordsense.js (optional): k (Stärke: Wiederholung kleiner, mehrere Treffer stärker), also (weitere
//        Begriffe der Zeile), soft (ruhige Stelle laut Liedtext), explicit ("on" | "soft" | "off"),
//        valence/arousal (Stimmung der Lichtregie, −1..1) }
// Gibt die angenommenen Antworten zurück (auch in active), höchstens zwei je Wort (drei, wenn eine Zeile mehrere
// Begriffe kombiniert).
// Was von einem Begriff unter den Umständen bleibt (ohne Abklingzeiten): [[Familie, Farbe?, Herkunft?], …]
function responses(c, ctx) {
  let list = STAGE[c] || (ctx.col ? [["wash", ctx.col, "top"]] : null);
  if (!list) return null;
  if (EXPLICIT.has(c) || VIOLENCE.has(c)) {
    const mode = ctx.explicit || "on";
    if (mode === "off") return null;
    if (mode === "soft") list = EX_SOFT[c] || [["mood", [140, 0, 20]]];
  }
  const e = clamp(ctx.energy ?? 0.5, 0, 1);
  // Spielart: andere Bilder für dieselbe Antwort; ohne Publikum: Bilder der Menge → Bilder der Bühne
  const sw = GENRE_SWAP[ctx.genre];
  if (sw || ctx.crowd === false) {
    list = list.map((r) => {
      let f = r[0];
      if (sw?.[f] && FAM[sw[f]]) f = sw[f];
      if (ctx.crowd === false && FAM[f]?.crowd) f = FAM[f].alt;
      return f === r[0] ? r : [f, r[1], r[2]];
    });
  }
  // ruhige Stelle: trauriger/ruhiger Song (Plan oder Stimmung der Lichtregie), oder kaum Energie – voll erst, wenn
  // die Musik richtig aufdreht
  const calmMood = (ctx.valence ?? 0) < -0.3 && (ctx.arousal ?? 0) < -0.1;
  if (e < 0.35 || ((ctx.soft || calmMood) && e < 0.75)) {
    const soft = [];
    for (const r of list) {
      if (SOFTEN[r[0]]) soft.push(SOFTEN[r[0]]);
      else if (!SOFT_DROP.has(r[0]) && !FAM[r[0]]?.venue && !FAM[r[0]]?.big) soft.push(r);
    }
    // „Party“ in einem ruhigen Lied: nur Farbe
    if (!soft.length && PARTYISH.has(c)) soft.push(["wash", null, "floor"]);
    list = soft;
  }
  list = list.filter((r, i) => list.findIndex((x) => x[0] === r[0]) === i);
  return list.length ? list : null;
}

function createScenarios() {
  const last = new Map(), used = new Map(), nth = new Map();
  let active = [], seq = 0, lastAt = -1e9, song = null, seed = 0;
  function word(c, ctx) {
    if (ctx.calm) return [];
    let list = responses(c, ctx);
    if (!list) return [];
    const t = ctx.t;
    // Uhr sprang zurück (Spulen, neuer Song): Abklingzeiten neu beginnen
    if (t < lastAt) reset();
    // neuer Song: Spielarten neu würfeln (fest je Song)
    const sg = String(ctx.song ?? "");
    if (sg !== song) {
      song = sg;
      seed = hashStr(sg);
      nth.clear();
      used.clear();
    }
    frame(t);
    // ein Wort je 1,2 s – zwei Wörter in einer Zeile stapeln sich nicht
    if (t - lastAt < 1.2) return [];
    const e = clamp(ctx.energy ?? 0.5, 0, 1);
    const kp = clamp(ctx.k ?? 1, 0.4, 1.3);
    const k0 = clamp((0.45 + 0.55 * e) * (PART_K[ctx.kind || ""] ?? 0.8) * (0.75 + 0.08 * clamp(ctx.level ?? 3, 1, 5)) * kp, 0.2, 1.3);
    // Wiederholung: nur eine, kleinere Antwort und keine Bühneneffekte der Location
    const small = kp < 0.75;
    // mehrere Begriffe in einer Zeile: je einer ihrer Antworten kommt dazu (eine kombinierte, stärkere Antwort)
    let max = small ? 1 : 2;
    if (!small && ctx.also?.length) {
      for (const a of ctx.also) {
        const more = responses(a, { ...ctx, col: null });
        if (more) list = [...list, more.find((r) => !list.some((x) => x[0] === r[0])) || more[0]];
      }
      max = 3;
    }
    // „Leicht“: teure Bilder durch ihre günstige Schwester ersetzen (oder weglassen)
    if (ctx.lite) list = list.map((r) => (FAM[r[0]] && !FAM[r[0]].lite && FAM[r[0]].la ? [FAM[r[0]].la[0], r[1] || FAM[r[0]].la[1], FAM[r[0]].la[2] || r[2]] : r));
    // Reihenfolge: im Refrain/Drop mit Energie die großen Bilder zuerst, in Strophe und Intro die ruhigen
    const bigFirst = BIG_PART.has(ctx.kind) && e >= 0.7, calmPart = !BIG_PART.has(ctx.kind || "chorus") && e < 0.6;
    const rank = (r) => (FAM[r[0]]?.big ? (bigFirst ? -1 : calmPart ? 1 : 0) : 0);
    const keyOf = (f, col) => f + (col ? ":" + col.join(",") : "");
    // frisch zuerst: was in den letzten 30 s lief, kommt nur, wenn sonst nichts geht
    const order = list.map((r, i) => [r, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
    const out = [];
    for (const pass of [0, 1]) {
      if (pass && out.length) break;
      for (const [f, col, from] of order) {
        const F = FAM[f];
        if (!F || out.length >= max) continue;
        if (out.some((x) => x.f === f)) continue;
        const recent = t - (used.get(keyOf(f, col || ctx.col)) ?? -1e9) < REPEAT;
        if (!pass && recent) continue;
        if (small && F.venue) continue;
        if (ctx.lite && !F.lite) continue;
        if (t - (last.get(f) ?? -1e9) < F.cd) continue;
        // laute Effekte nur, wenn die Musik es trägt
        if (e < (F.loud ?? 0)) continue;
        // höchstens ein laufender Effekt je Familie, höchstens drei zugleich
        if (active.some((a) => a.f === f) || active.length >= 3) continue;
        const cue = { f, fi: FAMS.indexOf(f), t0: t, k: k0, col: col || ctx.col || null, from: from || "top", seq: ++seq, dur: F.dur };
        if (F.flash) cue.soft = !!(ctx.noFlash || !ctx.flash);
        // Spielart: fest je Song, bei jeder Wiederholung der Familie im Song die nächste
        const n = nth.get(f) || 0;
        nth.set(f, n + 1);
        const h = mixHash(seed, cue.fi);
        cue.v = F.nv ? (h + n) % F.nv : 0;
        cue.dir = (h >>> 4) & 1 ? -1 : 1;
        cue.ox = ((h >>> 8) % 1000) / 1000;
        // traurige Stimmung: kühlere, ruhigere Farben
        if ((ctx.valence ?? 0) < -0.3) cue.cool = true;
        // Countdown: die Pulse sitzen auf den nächsten Schlägen (Versatz bis zum nächsten Schlag)
        if (f === "count") {
          const b = clamp(ctx.beat || 0.5, 0.25, 1.5);
          cue.beat = b;
          cue.off = (1 - clamp(ctx.phase ?? 0, 0, 1)) * b;
          cue.dur = cue.off + b * 4 + 0.8;
        }
        // Bilder im Takt (Uhr, Klatschen): eine Anzahl Schläge lang, auf den Schlägen
        if (F.beats) {
          const b = clamp(ctx.beat || 0.5, 0.25, 1.5);
          cue.beat = b;
          cue.off = (1 - clamp(ctx.phase ?? 0, 0, 1)) * b;
          cue.dur = cue.off + b * F.beats + 0.6;
        }
        if (f === "jump" || f === "hands") cue.dur = clamp((ctx.beat || 0.5) * 8, 2, 5);
        last.set(f, t);
        used.set(keyOf(f, cue.col), t);
        active.push(cue);
        out.push(cue);
      }
    }
    if (out.length) lastAt = t;
    return out;
  }
  // laufende Antworten zum Zeitpunkt t (abgelaufene fallen heraus)
  function frame(t) {
    if (active.length) active = active.filter((a) => t - a.t0 < a.dur + 0.5 && t >= a.t0 - 0.05);
    return active;
  }
  function reset() {
    last.clear();
    used.clear();
    nth.clear();
    active = [];
    lastAt = -1e9;
  }
  return { word, frame, reset, get active() { return active; } };
}

/* ---- Drop-Bilder: je Höhepunkt eines, aus der Palette des Stils, nie zweimal hintereinander dasselbe */
const DROP_LOOKS = ["shock", "sunburst", "curtain", "bloom", "shatter", "pillars", "tunnel", "halo"];
const DROP_PAL = {
  edm: ["shock", "shatter", "pillars", "tunnel", "sunburst"], house: ["bloom", "curtain", "halo", "sunburst"], techno: ["curtain", "tunnel", "pillars", "shatter"],
  trance: ["sunburst", "halo", "tunnel", "bloom"], dnb: ["shatter", "tunnel", "shock"], dubstep: ["shock", "shatter", "pillars"], trap: ["shock", "pillars", "curtain"],
  hiphop: ["shock", "curtain", "bloom"], rock: ["pillars", "sunburst", "shock", "curtain"], metal: ["pillars", "shock", "shatter"],
  pop: ["sunburst", "bloom", "halo", "curtain", "shock"], ballad: ["halo", "bloom", "sunburst"], calm: ["halo", "bloom"], latin: ["bloom", "sunburst", "curtain", "halo"],
  reggae: ["bloom", "halo", "sunburst"], folk: ["halo", "bloom", "sunburst"], orchestral: ["sunburst", "halo", "pillars"], kids: ["bloom", "sunburst", "halo", "curtain"],
};
// rng: fester Zufall je Song · prev: zuletzt gewähltes Bild (wird nie wiederholt, wenn die Palette mehr hat)
function pickDropLook(sig, rng, prev) {
  const pal = DROP_PAL[sig] || DROP_PAL.pop;
  const cand = pal.length > 1 ? pal.filter((x) => x !== prev) : pal;
  return cand[Math.floor(rng() * cand.length) % cand.length];
}

export { createScenarios, responses, isCountdown, pickDropLook, STAGE, FAM, FAMS, SCENE_FAMS, GENRE_SWAP, REPEAT, VIOLENCE, DROP_LOOKS, DROP_PAL, PART_K, EXPLICIT };
