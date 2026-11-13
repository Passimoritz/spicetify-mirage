/* ---------------------------------------------------------------- Spielarten: Verwandtschaft */
// Läuft auch im Hintergrund-Thread der Location (venue.js, show.js) – darum nur das Nötigste und ohne Abhängigkeiten.
// Jede neuere Spielart hat einen Verwandten weiter oben oder unter den Grund-Profilen in party.js: Lichtsprache, Ort, Publikum,
// Bühneneffekte, Rig-Muster und Farbe im Party-Rückblick erben von ihm, außer es steht hier etwas anderes.
// Eintrag: "verwandter" oder [verwandter, ort, bewegung, effekte] – "" = wie der Verwandte. Effekte ersetzen die
// geerbten: c CO2, p Pyro, s Stroboskop, l Lichtermeer, b Blinder, w Laserfläche, q ruhiges Bokeh; "-" = keine.
// Die Reihenfolge zählt: ein Verwandter steht immer vor seinen Abwandlungen.
const KIN = {
  // Elektronisch
  electrohouse: ["edm", "club"], progressivehouse: "edm", futurehouse: ["house", "", "jump"], tropicalhouse: "deephouse",
  basshouse: ["techhouse", "club"], acidhouse: ["house", "warehouse"], chicagohouse: "house", frenchhouse: "house", nudisco: ["disco", "rooftop"],
  jerseyclub: ["garage", "club", "jump", "c"], minimal: "techno", detroittechno: "techno", dubtechno: ["techno", "", "", "c"],
  ebm: ["hardtechno", "", "bang", "psb"], progressivetrance: "trance", upliftingtrance: "trance", liquiddnb: "dnb", neurofunk: ["dnb", "warehouse"],
  jungle: "dnb", footwork: ["breakbeat", "club", "jump"], electro: ["breakbeat", "club"], festivaltrap: "dubstep",
  moombahton: ["reggaeton", "festival", "bounce", "cs"], gabber: ["hardstyle", "warehouse", "jump"], happyhardcore: ["gabber", "festival"],
  eurobeat: "eurodance", handsup: ["eurodance", "festival"], italodisco: "eurodance", darksynth: "synthwave",
  vaporwave: ["synthwave", "", "sway", "q"], chiptune: ["hyperpop", "neon"],
  // Hip-Hop & R&B
  gangsta: "bass", gfunk: ["bass", "rooftop", "bounce"], southern: ["trap", "", "bounce"], alternativehiphop: ["boombap", "cellar"],
  poprap: ["trap", "stadium"], ukhiphop: ["drill", "club"], grime: ["garage", "cellar", "jump", "s"], deutschrap: "trap", frenchrap: "trap",
  italianrap: "trap", spanishrap: "trap", russianrap: "trap", turkishrap: "trap", arabrap: "trap", brazilianhiphop: "trap",
  altrnb: ["rnb", "neon", "sway"], newjackswing: ["rnb", "club", "bounce", "c"], neosoul: ["soul", "jazzbar", "sway"], northernsoul: ["soul", "club"],
  funk: ["disco", "club", "bounce", "c"],
  // Rock
  classicrock: "hardrock", rocknroll: ["rock", "pub", "bounce"], glamrock: "hardrock", bluesrock: "hardrock", southernrock: ["hardrock", "desert"],
  psychrock: ["rock", "forest", "sway"], stonerrock: ["hardrock", "desert", "bang"], progrock: "rock", krautrock: ["postrock", "space", "nod"],
  surfrock: ["rock", "beach", "bounce"], garagerock: ["punk", "cellar"], grunge: ["alternative", "cellar", "bang"],
  britpop: ["indie", "festival", "jump"], shoegaze: ["indie", "space", "sway", "q"], postpunk: ["alternative", "cellar", "nod", "-"],
  folkrock: ["country", "forest"], softrock: ["ballad", "rooftop"], deutschrock: "hardrock", poppunk: ["punk", "festival", "jump"],
  hardcorepunk: ["punk", "cellar", "bang"], posthardcore: ["emo", "", "bang"],
  // Metal
  heavymetal: "metal", thrash: "metal", glammetal: "hardrock", powermetal: ["metal", "festival"], symphonicmetal: ["metal", "festival"],
  progmetal: "metal", doom: ["metal", "cellar"], deathmetal: "metal", blackmetal: ["metal", "forest"], grindcore: ["punk", "cellar", "jump"],
  groovemetal: "metal", metalcore: ["metal", "festival", "jump"], deathcore: ["metal", "cellar"], numetal: ["metal", "festival", "jump"],
  industrialmetal: ["metal", "", "", "psb"], folkmetal: ["metal", "forest", "jump"],
  // Pop
  dancepop: ["pop", "", "jump"], electropop: ["pop", "neon", "bounce"], synthpop: ["synthwave", "neon", "bounce"], teenpop: ["pop", "stadium"],
  poprock: ["indie", "stadium", "jump"], indiepop: ["indie", "", "bounce"], artpop: ["indie", "space", "sway"],
  // Asien
  kindie: ["indie", "rooftop"], krock: "rock", khiphop: "trap", krnb: "rnb", trot: "schlager", jrock: "rock", jhiphop: "trap",
  anime: ["jpop", "stadium"], vocaloid: "jpop", citypop: ["disco", "rooftop", "sway"], shibuyakei: ["indiepop", "neon"], enka: ["ballad", "hall"],
  japantrad: ["classical", "forest", "sway", "q"], cpop: "kpop", mandopop: ["pop", "stadium", "sway", "cbl"], cantopop: "mandopop",
  chinesehiphop: "trap", chinesetrad: ["japantrad", "hall"], tpop: "kpop", lukthung: "schlager", vpop: "kpop", opm: ["pop", "stadium"],
  dangdut: ["bollywood", "festival"], gamelan: "japantrad", kollywood: "bollywood", punjabi: ["bollywood", "festival", "jump"], desihiphop: "trap",
  hindustani: "classical", carnatic: "hindustani", qawwali: ["hindustani", "cathedral", "clap", "lq"],
  // Lateinamerika
  latinpop: ["latin", "stadium", "clap"], latintrap: "trap", dembow: ["reggaeton", "", "jump"], bachata: ["latin", "", "sway", "l"],
  merengue: "salsa", son: ["salsa", "jazzbar", "clap"], bolero: ["ballad", "jazzbar"], cumbia: "latin", vallenato: "cumbia",
  tango: ["flamenco", "jazzbar", "sway"], mariachi: ["country", "pub", "clap"], regionalmexican: ["mariachi", "festival"],
  banda: ["balkan", "festival", "jump"], norteno: ["country", "desert", "clap"], corridos: ["latin", "desert", "nod"], latinrock: "rock",
  andean: ["celtic", "forest"], samba: ["brazil", "", "", "c"], pagode: "samba", axe: ["samba", "festival", "jump"], forro: "brazil",
  sertanejo: ["country", "stadium", "clap"], funkcarioca: "reggaeton", mpb: ["acoustic", "beach", "sway"], bossa: ["jazz", "beach", "sway", "q"],
  // Afrika & Karibik
  afrobeat: ["afro", "club"], highlife: "afro", gqom: ["amapiano", "warehouse", "pump"], afrohouse: ["deephouse", "beach", "bounce"], bongo: "afro",
  soukous: "afro", kuduro: ["dancehall", "club", "jump", "cs"], kizomba: ["afro", "club", "sway"], desertblues: ["blues", "desert", "sway"],
  rootsreggae: "reggae", dub: ["reggae", "cellar", "nod"], rocksteady: "ska", soca: ["dancehall", "", "jump", "c"],
  calypso: ["ska", "beach", "bounce"], zouk: ["kizomba", "beach", "bounce"], kompa: "zouk",
  // Naher Osten & Nordafrika
  arabicpop: ["arabic", "stadium", "clap", "cb"], khaleeji: ["arabic", "desert"], tarab: ["arabic", "hall", "sway", "lq"],
  rai: ["arabic", "beach", "bounce"], gnawa: ["arabic", "desert", "clap"], dabke: ["arabic", "festival", "jump"],
  mahraganat: ["arabic", "club", "jump", "cs"], turkishpop: "pop", arabesk: ["arabic", "pub", "sway", "l"], anatolianrock: ["psychrock", "desert"],
  persianpop: "arabicpop", persiantrad: "tarab", mizrahi: ["arabicpop", "beach"],
  // Europa
  partyschlager: ["schlager", "skihut", "jump", "cb"], volksmusik: ["schlager", "skihut", "clap", "-"], polka: ["volksmusik", "", "jump"],
  karneval: ["schlager", "pub", "clap", "c"], deutschpop: "pop", chanson: ["acoustic", "jazzbar", "sway"], canzone: "ballad",
  europop: ["eurodance", "stadium", "clap"], discopolo: ["eurodance", "festival", "clap"], russianpop: ["eurodance", "stadium"],
  greek: ["balkan", "beach", "clap"], fado: ["ballad", "jazzbar", "sway", "lq"], turbofolk: ["balkan", "club", "jump", "cb"],
  klezmer: ["balkan", "", "clap"], nordicfolk: ["celtic", "forest", "sway", "l"],
  // Country & Folk
  classiccountry: ["country", "pub", "clap"], countrypop: ["country", "stadium", "clap", "cb"], countryrock: ["country", "stadium", "jump", "pb"],
  americana: ["country", "", "sway"], bluegrass: ["celtic", "forest", "clap"], cajun: ["bluegrass", "pub", "bounce"],
  folk: ["acoustic", "forest", "sway", "lq"], indiefolk: ["folk", "festival", "clap", "l"],
  // Jazz & Blues
  dixieland: ["jazz", "", "clap"], swing: ["jazz", "club", "bounce"], bebop: "jazz", cooljazz: "jazz", spiritualjazz: ["jazz", "space", "sway"],
  freejazz: ["jazz", "cellar"], vocaljazz: ["jazz", "", "", "lq"], latinjazz: ["jazz", "", "bounce"], gypsyjazz: ["jazz", "", "clap"],
  fusion: ["jazz", "club", "bounce", "-"], acidjazz: "funk", nujazz: ["jazz", "rooftop", "nod"], smoothjazz: ["jazz", "rooftop", "sway", "lq"],
  deltablues: ["blues", "", "sway"], chicagoblues: ["blues", "pub", "clap"],
  // Gospel & Spirituelles
  ccm: ["pop", "stadium", "clap", "cbl"], worship: ["gospel", "", "sway", "lq"], christianrock: "rock", christianhiphop: "trap",
  bhajan: ["worship", "forest", "clap"], nasheed: "worship",
  // Klassik & Filmmusik
  baroque: ["classical", "cathedral"], classicalera: "classical", romantic: "classical", opera: ["classical", "", "", "lq"],
  choral: ["classical", "cathedral", "sway"], chamber: "classical", orchestral: "classical", minimalism: ["neoclassical", "hall"],
  contemporary: "classical", gamemusic: ["cinematic", "neon"],
  // Ruhig
  downtempo: ["chill", "rooftop", "sway", "q"], triphop: ["downtempo", "cellar", "nod"], easylistening: ["jazz", "rooftop", "sway", "lq"],
  newage: ["ambient", "forest"], meditation: "ambient", sleep: "ambient",
  // Experimentell
  experimental: ["cinematic", "space", "sway"], idm: ["breakbeat", "", "nod", "-"], industrial: ["hardtechno", "", "bang", "ps"],
  noise: ["punk", "cellar", "bang"], darkambient: ["ambient", "space"],
  // Kinder, Feiertage & Gesprochenes
  halloween: ["cinematic", "forest", "bounce", "c"], kids: ["pop", "home", "clap", "-"], disney: ["musical", "stadium", "clap", "cl"],
  comedy: ["chill", "pub", "clap", "-"], spoken: ["chill", "home", "sway", "q"],
};
const baseOf = (k) => (typeof KIN[k] === "string" ? KIN[k] : KIN[k]?.[0]);
const own = (k, i) => (typeof KIN[k] === "string" ? "" : KIN[k][i] || "");
// Lücken einer Tabelle je Stil füllen (Ort, Bewegung, Rig-Muster, Farbe): eigener Wert (Spalte i), sonst der des Verwandten
function kin(map, i = 9) {
  for (const k in KIN) {
    if (k in map) continue;
    const v = own(k, i) || map[baseOf(k)];
    if (v !== undefined) map[k] = v;
  }
  return map;
}
// Effekt-Mengen (CO2, Pyro …) ergänzen: eigene Effekt-Buchstaben, sonst wie der Verwandte
function kinSet(set, f) {
  for (const k in KIN) {
    const fx = own(k, 3);
    if (fx ? fx.includes(f) : set.has(baseOf(k))) set.add(k);
  }
  return set;
}

export { KIN, baseOf, kin, kinSet };
