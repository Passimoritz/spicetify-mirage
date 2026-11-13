// node tests/unit/genres.test.js
// Genre-Erkennung und Stil-Katalog: echte Spotify-Genres und Apple-Genre-Namen landen auf der genauesten Spielart,
// jede Spielart ist erreichbar, hat Signatur, Namen, Ort, Publikum und Effekte – und die Erkennung bleibt schnell.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./load.js");
const { LOOKS, FAMILIES, RULES, SPECIFIC, GENRES, APPLE, best, pickProfile } = load("genres.js");
const { KIN, baseOf, kin, kinSet } = load("styles.js");
const { STYLE } = load("director.js");
const { GENRE_TEXT } = load("i18n-genres.js");
const src = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8").replace(/\r\n/g, "\n");

// ---- Spotify-Genre (erstes Künstler-Genre) → Spielart
const SPOTIFY = [
  ["pop", "pop"], ["dance pop", "dancepop"], ["post-teen pop", "teenpop"], ["boy band", "teenpop"], ["bubblegum pop", "teenpop"],
  ["electropop", "electropop"], ["indietronica", "electropop"], ["synthpop", "synthpop"], ["new wave", "synthpop"], ["art pop", "artpop"],
  ["chamber pop", "artpop"], ["indie pop", "indiepop"], ["bedroom pop", "indiepop"], ["power pop", "poprock"], ["pop rock", "poprock"],
  ["hyperpop", "hyperpop"], ["k-pop", "kpop"], ["k-pop girl group", "kpop"], ["k-pop boy group", "kpop"], ["korean pop", "kpop"],
  ["k-indie", "kindie"], ["korean indie", "kindie"], ["k-rock", "krock"], ["k-rap", "khiphop"], ["korean r&b", "krnb"], ["trot", "trot"],
  ["korean ost", "ballad"], ["j-pop", "jpop"], ["j-idol", "jpop"], ["j-rock", "jrock"], ["visual kei", "jrock"], ["japanese hip hop", "jhiphop"],
  ["anime", "anime"], ["anisong", "anime"], ["vocaloid", "vocaloid"], ["city pop", "citypop"], ["shibuya-kei", "shibuyakei"], ["enka", "enka"],
  ["japanese traditional", "japantrad"], ["taiko", "japantrad"], ["c-pop", "cpop"], ["mandopop", "mandopop"], ["taiwan pop", "mandopop"],
  ["cantopop", "cantopop"], ["chinese hip hop", "chinesehiphop"], ["chinese traditional", "chinesetrad"], ["guzheng", "chinesetrad"],
  ["t-pop", "tpop"], ["thai pop", "tpop"], ["luk thung", "lukthung"], ["v-pop", "vpop"], ["vietnamese pop", "vpop"], ["opm", "opm"],
  ["p-pop", "opm"], ["pinoy hip hop", "bass"], ["dangdut", "dangdut"], ["indonesian pop", "dangdut"], ["gamelan", "gamelan"],
  ["bollywood", "bollywood"], ["filmi", "bollywood"], ["tamil pop", "kollywood"], ["kollywood", "kollywood"], ["punjabi pop", "punjabi"],
  ["bhangra", "punjabi"], ["desi hip hop", "desihiphop"], ["hindustani classical", "hindustani"], ["carnatic", "carnatic"],
  ["qawwali", "qawwali"], ["sufi", "qawwali"], ["ghazal", "qawwali"],
  ["edm", "edm"], ["big room", "edm"], ["electro house", "electrohouse"], ["progressive house", "progressivehouse"], ["slap house", "futurehouse"],
  ["brazilian bass", "futurehouse"], ["house", "house"], ["deep house", "deephouse"], ["tropical house", "tropicalhouse"], ["tech house", "techhouse"],
  ["bass house", "basshouse"], ["acid house", "acidhouse"], ["chicago house", "chicagohouse"], ["vocal house", "chicagohouse"],
  ["french house", "frenchhouse"], ["nu disco", "nudisco"], ["uk garage", "garage"], ["jersey club", "jerseyclub"], ["techno", "techno"],
  ["minimal techno", "minimal"], ["detroit techno", "detroittechno"], ["dub techno", "dubtechno"], ["melodic techno", "melodictechno"],
  ["hard techno", "hardtechno"], ["ebm", "ebm"], ["trance", "trance"], ["progressive trance", "progressivetrance"],
  ["uplifting trance", "upliftingtrance"], ["psytrance", "psytrance"], ["drum and bass", "dnb"], ["liquid funk", "liquiddnb"],
  ["neurofunk", "neurofunk"], ["jungle", "jungle"], ["breakbeat", "breakbeat"], ["footwork", "footwork"], ["miami bass", "electro"],
  ["dubstep", "dubstep"], ["riddim", "dubstep"], ["festival trap", "festivaltrap"], ["future bass", "futurebass"], ["melodic dubstep", "futurebass"],
  ["moombahton", "moombahton"], ["hardstyle", "hardstyle"], ["gabber", "gabber"], ["frenchcore", "gabber"], ["happy hardcore", "happyhardcore"],
  ["eurodance", "eurodance"], ["eurobeat", "eurobeat"], ["hands up", "handsup"], ["italo disco", "italodisco"], ["synthwave", "synthwave"],
  ["darksynth", "darksynth"], ["vaporwave", "vaporwave"], ["future funk", "vaporwave"], ["chiptune", "chiptune"], ["electro swing", "electroswing"],
  ["hip hop", "bass"], ["rap", "bass"], ["boom bap", "boombap"], ["east coast hip hop", "boombap"], ["gangster rap", "gangsta"],
  ["g funk", "gfunk"], ["west coast rap", "gfunk"], ["dirty south rap", "southern"], ["crunk", "southern"], ["alternative hip hop", "alternativehiphop"],
  ["underground hip hop", "alternativehiphop"], ["trap", "trap"], ["melodic rap", "poprap"], ["pop rap", "poprap"], ["cloud rap", "cloudrap"],
  ["emo rap", "cloudrap"], ["plugg", "cloudrap"], ["drill", "drill"], ["uk drill", "drill"], ["brooklyn drill", "drill"], ["phonk", "phonk"],
  ["uk hip hop", "ukhiphop"], ["afroswing", "ukhiphop"], ["grime", "grime"], ["german hip hop", "deutschrap"], ["deutschrap", "deutschrap"],
  ["french hip hop", "frenchrap"], ["rap francais", "frenchrap"], ["italian hip hop", "italianrap"], ["trap italiana", "italianrap"],
  ["spanish hip hop", "spanishrap"], ["russian hip hop", "russianrap"], ["turkish trap", "turkishrap"], ["moroccan rap", "arabrap"],
  ["brazilian hip hop", "brazilianhiphop"], ["polish trap", "trap"], ["dutch hip hop", "bass"], ["kenyan hip hop", "bass"],
  ["r&b", "rnb"], ["alternative r&b", "altrnb"], ["new jack swing", "newjackswing"], ["soul", "soul"], ["neo soul", "neosoul"],
  ["northern soul", "northernsoul"], ["motown", "northernsoul"], ["funk", "funk"], ["p funk", "funk"], ["disco", "disco"],
  ["rock", "rock"], ["classic rock", "classicrock"], ["album rock", "classicrock"], ["rockabilly", "rocknroll"], ["rock and roll", "rocknroll"],
  ["doo-wop", "rocknroll"], ["hard rock", "hardrock"], ["glam rock", "glamrock"], ["blues rock", "bluesrock"], ["southern rock", "southernrock"],
  ["psychedelic rock", "psychrock"], ["neo-psychedelia", "psychrock"], ["stoner rock", "stonerrock"], ["progressive rock", "progrock"],
  ["art rock", "progrock"], ["krautrock", "krautrock"], ["surf rock", "surfrock"], ["garage rock", "garagerock"], ["alternative rock", "alternative"],
  ["grunge", "grunge"], ["post-grunge", "grunge"], ["indie rock", "indie"], ["britpop", "britpop"], ["madchester", "britpop"],
  ["shoegaze", "shoegaze"], ["dream pop", "shoegaze"], ["post-punk", "postpunk"], ["darkwave", "postpunk"], ["gothic rock", "postpunk"],
  ["post-rock", "postrock"], ["folk rock", "folkrock"], ["soft rock", "softrock"], ["yacht rock", "softrock"], ["deutschrock", "deutschrock"],
  ["punk", "punk"], ["pop punk", "poppunk"], ["hardcore punk", "hardcorepunk"], ["hardcore", "hardcorepunk"], ["post-hardcore", "posthardcore"],
  ["screamo", "posthardcore"], ["emo", "emo"], ["midwest emo", "emo"], ["ska punk", "ska"],
  ["metal", "metal"], ["heavy metal", "heavymetal"], ["nwobhm", "heavymetal"], ["thrash metal", "thrash"], ["glam metal", "glammetal"],
  ["power metal", "powermetal"], ["symphonic metal", "symphonicmetal"], ["gothic metal", "symphonicmetal"], ["progressive metal", "progmetal"],
  ["djent", "progmetal"], ["doom metal", "doom"], ["sludge metal", "doom"], ["death metal", "deathmetal"], ["melodic death metal", "deathmetal"],
  ["black metal", "blackmetal"], ["grindcore", "grindcore"], ["groove metal", "groovemetal"], ["alternative metal", "groovemetal"],
  ["metalcore", "metalcore"], ["deathcore", "deathcore"], ["nu metal", "numetal"], ["rap metal", "numetal"], ["neue deutsche harte", "industrialmetal"],
  ["industrial metal", "industrialmetal"], ["folk metal", "folkmetal"], ["viking metal", "folkmetal"], ["greek metal", "metal"],
  ["latin pop", "latinpop"], ["reggaeton", "reggaeton"], ["urbano latino", "reggaeton"], ["latin trap", "latintrap"], ["trap argentino", "latintrap"],
  ["dembow", "dembow"], ["rkt", "dembow"], ["bachata", "bachata"], ["merengue", "merengue"], ["salsa", "salsa"], ["son cubano", "son"],
  ["nueva trova", "son"], ["bolero", "bolero"], ["cumbia", "cumbia"], ["cumbia villera", "cumbia"], ["vallenato", "vallenato"], ["tango", "tango"],
  ["mariachi", "mariachi"], ["ranchera", "mariachi"], ["regional mexican", "regionalmexican"], ["banda", "banda"], ["norteno", "norteno"],
  ["tejano", "norteno"], ["corridos tumbados", "corridos"], ["sierreno", "corridos"], ["rock en espanol", "latinrock"], ["argentine rock", "latinrock"],
  ["andean", "andean"], ["chacarera", "andean"], ["samba", "samba"], ["pagode", "pagode"], ["axe", "axe"], ["forro", "forro"], ["piseiro", "forro"],
  ["sertanejo", "sertanejo"], ["sertanejo universitario", "sertanejo"], ["funk carioca", "funkcarioca"], ["baile funk", "funkcarioca"],
  ["funk mandelao", "funkcarioca"], ["mpb", "mpb"], ["bossa nova", "bossa"], ["brazilian jazz", "bossa"],
  ["afrobeats", "afro"], ["nigerian pop", "afro"], ["afropop", "afro"], ["afrobeat", "afrobeat"], ["ethio-jazz", "afrobeat"], ["highlife", "highlife"],
  ["amapiano", "amapiano"], ["gqom", "gqom"], ["afro house", "afrohouse"], ["kwaito", "afrohouse"], ["bongo flava", "bongo"], ["soukous", "soukous"],
  ["congolese rumba", "soukous"], ["kuduro", "kuduro"], ["kizomba", "kizomba"], ["desert blues", "desertblues"], ["reggae", "reggae"],
  ["roots reggae", "rootsreggae"], ["lovers rock", "rootsreggae"], ["dub", "dub"], ["rocksteady", "rocksteady"], ["ska", "ska"], ["dancehall", "dancehall"],
  ["soca", "soca"], ["calypso", "calypso"], ["steelpan", "calypso"], ["zouk", "zouk"], ["kompa", "kompa"],
  ["arabic", "arabic"], ["arabic pop", "arabicpop"], ["lebanese pop", "arabicpop"], ["khaleeji", "khaleeji"], ["arabic classical", "tarab"],
  ["rai", "rai"], ["gnawa", "gnawa"], ["dabke", "dabke"], ["mahraganat", "mahraganat"], ["egyptian", "mahraganat"], ["turkish pop", "turkishpop"],
  ["arabesk", "arabesk"], ["turkish folk", "arabesk"], ["anatolian rock", "anatolianrock"], ["turkish rock", "anatolianrock"],
  ["persian pop", "persianpop"], ["persian traditional", "persiantrad"], ["mizrahi", "mizrahi"], ["israeli pop", "mizrahi"],
  ["schlager", "schlager"], ["discofox", "schlager"], ["partyschlager", "partyschlager"], ["apres ski", "partyschlager"], ["ballermann", "partyschlager"],
  ["volksmusik", "volksmusik"], ["volkstumliche musik", "volksmusik"], ["polka", "polka"], ["blasmusik", "volksmusik"], ["karneval", "karneval"],
  ["kolsche musik", "karneval"], ["deutschpop", "deutschpop"], ["neue deutsche welle", "deutschpop"], ["chanson", "chanson"], ["variete francaise", "chanson"],
  ["canzone d'autore", "canzone"], ["italian pop", "canzone"], ["cantautori", "canzone"], ["europop", "europop"], ["swedish pop", "europop"],
  ["eurovision", "europop"], ["disco polo", "discopolo"], ["russian pop", "russianpop"], ["russian chanson", "russianpop"], ["greek", "greek"],
  ["laiko", "greek"], ["rebetiko", "greek"], ["fado", "fado"], ["flamenco", "flamenco"], ["balkan brass", "balkan"], ["balkan", "balkan"],
  ["turbo folk", "turbofolk"], ["manele", "turbofolk"], ["chalga", "turbofolk"], ["romanian house", "house"], ["serbian", "turbofolk"],
  ["klezmer", "klezmer"], ["celtic", "celtic"], ["irish folk", "celtic"], ["nordic folk", "nordicfolk"], ["joik", "nordicfolk"],
  ["country", "country"], ["classic country", "classiccountry"], ["outlaw country", "classiccountry"], ["honky tonk", "classiccountry"],
  ["contemporary country", "countrypop"], ["country pop", "countrypop"], ["country rock", "countryrock"], ["red dirt", "countryrock"],
  ["americana", "americana"], ["alt-country", "americana"], ["bluegrass", "bluegrass"], ["old-time", "bluegrass"], ["cajun", "cajun"],
  ["zydeco", "cajun"], ["folk", "folk"], ["contemporary folk", "folk"], ["indie folk", "indiefolk"], ["stomp and holler", "indiefolk"],
  ["acoustic", "acoustic"], ["singer-songwriter", "acoustic"],
  ["jazz", "jazz"], ["dixieland", "dixieland"], ["ragtime", "dixieland"], ["swing", "swing"], ["big band", "swing"], ["bebop", "bebop"],
  ["hard bop", "bebop"], ["cool jazz", "cooljazz"], ["spiritual jazz", "spiritualjazz"], ["free jazz", "freejazz"], ["vocal jazz", "vocaljazz"],
  ["adult standards", "vocaljazz"], ["latin jazz", "latinjazz"], ["gypsy jazz", "gypsyjazz"], ["jazz fusion", "fusion"], ["jazz funk", "fusion"],
  ["acid jazz", "acidjazz"], ["nu jazz", "nujazz"], ["uk jazz", "nujazz"], ["smooth jazz", "smoothjazz"], ["quiet storm", "smoothjazz"],
  ["blues", "blues"], ["delta blues", "deltablues"], ["chicago blues", "chicagoblues"], ["electric blues", "chicagoblues"],
  ["gospel", "gospel"], ["ccm", "ccm"], ["christian pop", "ccm"], ["worship", "worship"], ["christian rock", "christianrock"],
  ["christian metal", "christianrock"], ["christian hip hop", "christianhiphop"], ["bhajan", "bhajan"], ["kirtan", "bhajan"], ["nasheed", "nasheed"],
  ["classical", "classical"], ["baroque", "baroque"], ["early music", "baroque"], ["classical era", "classicalera"], ["late romantic era", "romantic"],
  ["opera", "opera"], ["operetta", "opera"], ["choral", "choral"], ["gregorian chant", "choral"], ["chamber music", "chamber"],
  ["string quartet", "chamber"], ["orchestral", "orchestral"], ["minimalism", "minimalism"], ["contemporary classical", "contemporary"],
  ["modern classical", "neoclassical"], ["neoclassical", "neoclassical"], ["soundtrack", "cinematic"], ["epic", "cinematic"],
  ["video game music", "gamemusic"], ["musical", "musical"], ["show tunes", "musical"], ["broadway", "musical"],
  ["chill", "chill"], ["lo-fi beats", "lofi"], ["chillhop", "lofi"], ["downtempo", "downtempo"], ["chillout", "downtempo"], ["trip hop", "triphop"],
  ["easy listening", "easylistening"], ["lounge", "easylistening"], ["ambient", "ambient"], ["new age", "newage"], ["healing", "newage"],
  ["meditation", "meditation"], ["sleep", "sleep"], ["white noise", "sleep"], ["lullaby", "sleep"],
  ["experimental", "experimental"], ["idm", "idm"], ["glitch", "idm"], ["industrial", "industrial"], ["noise rock", "noise"], ["harsh noise", "noise"],
  ["dark ambient", "darkambient"], ["drone", "darkambient"],
  ["christmas", "christmas"], ["christmas pop", "christmas"], ["halloween", "halloween"], ["children's music", "kids"], ["kindermusik", "kids"],
  ["disney", "disney"], ["comedy", "comedy"], ["podcast", "spoken"], ["spoken word", "spoken"], ["hoerspiel", "spoken"], ["audiobook", "spoken"],
];
// ---- Apples primaryGenreName des Songs → Spielart
const APPLE_NAMES = [
  ["Hip-Hop/Rap", "bass"], ["R&B/Soul", "rnb"], ["K-Pop", "kpop"], ["J-Pop", "jpop"], ["Música Mexicana", "regionalmexican"],
  ["Regional Mexicano", "regionalmexican"], ["Pop Latino", "latinpop"], ["Latin Urban", "reggaeton"], ["Salsa y Tropical", "salsa"],
  ["Baladas y Boleros", "bolero"], ["Sertanejo", "sertanejo"], ["MPB", "mpb"], ["Pagode", "pagode"], ["Axé", "axe"], ["Forró", "forro"],
  ["Samba", "samba"], ["Bossa Nova", "bossa"], ["Christian & Gospel", "gospel"], ["Praise & Worship", "worship"], ["Children's Music", "kids"],
  ["Comedy", "comedy"], ["Spoken Word", "spoken"], ["Holiday", "christmas"], ["Christmas", "christmas"], ["Easy Listening", "easylistening"],
  ["Singer/Songwriter", "acoustic"], ["Alternative", "alternative"], ["Hard Rock", "hardrock"], ["Metal", "metal"], ["Punk", "punk"],
  ["Soundtrack", "cinematic"], ["Original Score", "cinematic"], ["Video Game", "gamemusic"], ["Anime", "anime"], ["Classical", "classical"],
  ["Opera", "opera"], ["Jazz", "jazz"], ["Blues", "blues"], ["Country", "country"], ["Folk", "folk"], ["Reggae", "reggae"], ["Afrobeats", "afro"],
  ["Afro House", "afrohouse"], ["Amapiano", "amapiano"], ["Arabic", "arabic"], ["Khaleeji", "khaleeji"], ["Turkish Pop", "turkishpop"],
  ["Arabesque", "arabesk"], ["Fantezi", "arabesk"], ["Bollywood", "bollywood"], ["Indian Classical", "hindustani"], ["Devotional & Spiritual", "bhajan"],
  ["Ghazals", "qawwali"], ["Tamil", "kollywood"], ["Punjabi", "punjabi"], ["Mandopop", "mandopop"], ["Cantopop", "cantopop"], ["Enka", "enka"],
  ["Kayokyoku", "enka"], ["Schlager", "schlager"], ["Volksmusik", "volksmusik"], ["German Pop", "deutschpop"], ["German Folk", "volksmusik"],
  ["Karneval", "karneval"], ["Chanson", "chanson"], ["Pop in Italiano", "canzone"], ["Cantautori", "canzone"], ["Fado", "fado"], ["Laiko", "greek"],
  ["Russian Chanson", "russianpop"], ["Polka", "polka"], ["Celtic", "celtic"], ["Klezmer", "klezmer"], ["Healing", "newage"],
  ["Meditation", "meditation"], ["Relaxation", "newage"], ["New Age", "newage"], ["Lullabies", "sleep"], ["House", "house"], ["Techno", "techno"],
  ["Trance", "trance"], ["Dubstep", "dubstep"], ["Jungle/Drum'n'bass", "dnb"], ["Downtempo", "downtempo"], ["Breakbeat", "breakbeat"],
  ["IDM/Experimental", "idm"], ["Industrial", "industrial"], ["Indie Pop", "indiepop"], ["Pop/Rock", "poprock"], ["Rock & Roll", "rocknroll"],
  ["Prog-Rock/Art Rock", "progrock"], ["Psychedelic", "psychrock"], ["Blues-Rock", "bluesrock"], ["Bebop", "bebop"], ["Big Band", "swing"],
  ["Cool Jazz", "cooljazz"], ["Smooth Jazz", "smoothjazz"], ["Fusion", "fusion"], ["Latin Jazz", "latinjazz"], ["Vocal Jazz", "vocaljazz"],
  ["Dixieland", "dixieland"], ["Delta Blues", "deltablues"], ["Chicago Blues", "chicagoblues"], ["Bluegrass", "bluegrass"], ["Americana", "americana"],
  ["Honky Tonk", "classiccountry"], ["Outlaw Country", "classiccountry"], ["Contemporary Country", "countrypop"], ["Gospel", "gospel"],
  ["Christian Rock", "christianrock"], ["Christian Rap", "christianhiphop"], ["Baroque Era", "baroque"], ["Romantic Era", "romantic"],
  ["Classical Era", "classicalera"], ["Modern Era", "contemporary"], ["Medieval Era", "baroque"], ["Renaissance", "baroque"],
  ["Chamber Music", "chamber"], ["Choral", "choral"], ["Orchestral", "orchestral"], ["Minimalism", "minimalism"], ["Impressionist", "romantic"],
  ["Art Song", "opera"], ["Avant-Garde", "experimental"], ["Disney", "disney"], ["Musicals", "musical"], ["Traditional Pop", "vocaljazz"],
  ["Adult Contemporary", "softrock"], ["Soft Rock", "softrock"], ["Teen Pop", "teenpop"], ["Britpop", "britpop"], ["Neo-Soul", "neosoul"],
  ["Funk", "funk"], ["Disco", "disco"], ["Motown", "northernsoul"], ["Doo Wop", "rocknroll"], ["Quiet Storm", "smoothjazz"], ["Soul", "soul"],
  ["Gangsta Rap", "gangsta"], ["West Coast Rap", "gfunk"], ["Dirty South", "southern"], ["Old School Rap", "boombap"], ["East Coast Rap", "boombap"],
  ["UK Hip-Hop", "ukhiphop"], ["Alternative Rap", "alternativehiphop"], ["Underground Rap", "alternativehiphop"], ["Hardcore Rap", "gangsta"],
  ["Latin Rap", "latintrap"], ["Dancehall", "dancehall"], ["Roots Reggae", "rootsreggae"], ["Dub", "dub"], ["Ska", "ska"],
  ["Lovers Rock", "rootsreggae"], ["Brazilian", "brazil"], ["Tango", "tango"], ["Flamenco", "flamenco"], ["Raï", "rai"], ["Israeli", "mizrahi"],
  ["Persian", "persianpop"], ["Indian Pop", "bollywood"], ["Thai", "tpop"], ["Dangdut", "dangdut"], ["OPM", "opm"],
  ["Original Pilipino Music", "opm"], ["J-Rock", "jrock"], ["J-Hip-Hop", "jhiphop"], ["Turkish Hip-Hop/Rap", "turkishrap"],
  ["Turkish Rock", "anatolianrock"], ["Turkish Folk", "arabesk"], ["Deutschrap", "deutschrap"], ["Rock", "rock"], ["Pop", "pop"],
  // grobe Namen: Tempo entscheidet später (Dance/Electronic → House, Techno, Trance …)
  ["Dance", "rave"], ["Electronic", "rave"], ["Indie Rock", "indie"], ["Instrumental", "chill"],
];
const pick = (genre) => pickProfile([genre], 0, -10, "", 0).key;
const pickApple = (name) => pickProfile([], 0, -10, name, 0).key;
const fails = [];
for (const [g, want] of SPOTIFY) if (pick(g) !== want) fails.push(`Spotify „${g}“: ${want} erwartet, ${pick(g)} gewählt`);
for (const [a, want] of APPLE_NAMES) if (pickApple(a) !== want) fails.push(`Apple „${a}“: ${want} erwartet, ${pickApple(a)} gewählt`);
assert.ok(!fails.length, fails.join("\n"));
assert.ok(SPOTIFY.length + APPLE_NAMES.length >= 250, "mindestens 250 echte Genre-Namen im Test");

// ---- Tie-Breaker: Tempo, Lautheit und Moll nur dort, wo die Namen schweigen
assert.equal(pickProfile([], 174, -6, "Electronic", 0).key, "dnb", "Electronic mit 174 BPM → Drum & Bass");
assert.equal(pickProfile([], 126, -6, "Dance", 0.8).key, "techno", "Dance in Moll → Techno");
assert.equal(pickProfile([], 126, -6, "Dance", 0.1).key, "house", "Dance in Dur → House");
assert.equal(pickProfile([], 70, -20, "Electronic", 0).key, "chill", "leise und langsam → Chill");
assert.equal(pickProfile(["deep house"], 174, -6, "", 0).key, "deephouse", "ein genaues Genre schlägt das Tempo");
assert.equal(pickProfile(["latin trap", "trap"], 0, -10, "", 0).key, "latintrap");
assert.equal(pickProfile(["pop", "dance pop", "post-teen pop"], 0, -10, "", 0).key, "pop", "erstes Genre zählt doppelt");
assert.equal(pickProfile(["hip hop", "trap"], 0, -10, "Holiday", 0).key, "christmas", "Apples „Holiday“ schlägt die Künstler-Genres");
assert.equal(pick("christmas hip hop"), "christmas", "im selben Genre-Text gewinnt Weihnachten");
assert.equal(pick("kids hip hop"), "kids");
assert.equal(pickProfile([], 0, -10, "", 0).key, "pop", "ohne Hinweise: Pop");
// regionale Wörter: allein die Region, mit Genre-Wort das Genre
assert.equal(pick("romanian"), "turbofolk");
assert.equal(pick("romanian house"), "house");
assert.equal(pick("greek"), "greek");
assert.equal(pick("thai"), "tpop");
assert.equal(pick("thai hip hop"), "bass");

// ---- Katalog: keine doppelten Schlüssel, jede Spielart in genau einer Familie
const all = Object.values(FAMILIES).flat();
assert.equal(new Set(all).size, all.length, "Spielart doppelt in den Familien");
// die Grund-Profile stehen in party.js, alle weiteren in styles.js
const party = src("party.js");
const OLD = [...party.slice(party.indexOf("const PROFILES = {"), party.indexOf("// Alle weiteren Spielarten")).matchAll(/^ {2}(\w+): (?:like\(|\{ decay)/gm)].map((m) => m[1]);
assert.equal(OLD.length, 69, "69 Grund-Profile in party.js");
for (const k of OLD) assert.ok(!(k in KIN), `${k} steht doppelt (party.js und styles.js)`);
assert.deepEqual([...all].sort(), [...OLD, ...Object.keys(KIN)].sort(), "Familien = alle Profile");
assert.ok(all.length >= 250 && all.length <= 330, `${all.length} Spielarten`);
// Verwandte stehen vorher (sonst erbt die Abwandlung ins Leere)
const seen = new Set(OLD);
for (const k of Object.keys(KIN)) {
  assert.ok(seen.has(baseOf(k)), `${k}: Verwandter ${baseOf(k)} fehlt oder steht später`);
  seen.add(k);
}

// ---- jede Spielart erreichbar: eine Regel oder (für die groben) die Einstellungen
const ruleKeys = new Set([...RULES, ...SPECIFIC, ...GENRES, ...APPLE].map((r) => r[0]));
for (const k of all) assert.ok(ruleKeys.has(k) || all.includes(k), `${k} ist nicht erreichbar`);
for (const k of Object.keys(KIN)) assert.ok(ruleKeys.has(k), `${k}: keine Regel`);
const hit = new Set([...SPOTIFY, ...APPLE_NAMES].map((x) => x[1]));
const untested = Object.keys(KIN).filter((k) => !hit.has(k));
assert.ok(!untested.length, "ohne Testfall: " + untested.join(", "));
// Regeln sind fertig übersetzt (kein Bauen pro Aufruf) und ohne g-Flag (exec bliebe sonst stehen)
for (const r of [...RULES, ...SPECIFIC]) {
  assert.ok(r[1] instanceof RegExp && !r[1].global && !r[1].sticky, `${r[0]}: Regel ist kein einfacher RegExp`);
  assert.ok(!r[1].test(""), `${r[0]}: Regel passt auf leeren Text`);
}

// ---- Signatur der Lichtregie, Namen, Lichtsprache
const sig = Object.values(STYLE).flat();
assert.equal(new Set(sig).size, sig.length, "Spielart doppelt in STYLE");
for (const k of all) assert.ok(sig.includes(k), `${k}: keine Signatur in director.js`);
for (const k of sig) assert.ok(all.includes(k), `STYLE kennt ${k}, die Familien nicht`);
const i18n = src("i18n.js");
// Deutsch steht in i18n-genres.js nur, wo es anders heißt als Englisch (sonst gilt wie überall Englisch)
const named = (k, lang) => GENRE_TEXT[lang]?.["party_" + k] || (k in KIN && GENRE_TEXT.en["party_" + k]) || [...i18n.matchAll(new RegExp(`party_${k}: "([^"]+)"`, "g"))][lang === "en" ? 0 : 1]?.[1];
for (const k of all) for (const lang of ["en", "de"]) assert.ok(named(k, lang), `${k}: kein Name (${lang})`);
for (const f of Object.keys(FAMILIES)) assert.ok(GENRE_TEXT.en["fam_" + f] || i18n.includes(`fam_${f}:`), `Familie ${f}: kein Name`);
const enNames = all.map((k) => named(k, "en"));
assert.equal(new Set(enNames).size, enNames.length, "zwei Spielarten mit gleichem Namen");
const FIELDS = new Set("decay beams accent flashOn spot spinRate sway shake tint mirror spin height pulse ring thick halo sparks bottom".split(" "));
for (const [k, o] of Object.entries(LOOKS)) {
  assert.ok(k in KIN, `LOOKS kennt ${k}, styles.js nicht`);
  for (const [f, v] of Object.entries(o)) {
    assert.ok(FIELDS.has(f), `${k}: unbekanntes Feld ${f}`);
    if (f === "spot") assert.ok(["cross", "top", "floor", "pan", "scan", "disco", "aurora", "tunnel", "soft"].includes(v), `${k}: spot ${v}`);
    if (f === "tint") assert.ok(["cool", "warm", "hot", "pink", "gold", "jungle"].includes(v), `${k}: tint ${v}`);
    if (f === "flashOn") assert.ok(["", "down", "back", "down-hi"].includes(v), `${k}: flashOn ${v}`);
    if (f === "accent") assert.ok(v.length === 4 && v.every((x) => x >= 0 && x <= 1), `${k}: accent`);
  }
}

// ---- Ort, Publikum und Effekte lösen sich für jede Spielart auf (dieselben Tabellen wie venue.js/show.js)
const venue = src("venue.js"), show = src("show.js");
const table = (text, name) => Function(`return (${text.slice(text.indexOf(`const ${name} = {`) + `const ${name} = `.length, text.indexOf("\n  };", text.indexOf(`const ${name} = {`)) + 4)});`)();
const set = (text, name) => new Set(JSON.parse(text.match(new RegExp(`const ${name} = new Set\\((\\[[^\\]]*\\])\\)`))[1]));
const VEN = table(venue, "VENUES"), AUTO = kin(table(venue, "AUTO_VENUE"), 1), MOVES = kin(table(venue, "MOVES"), 2);
const moves = new Set(Object.values(table(venue, "MOVES")));
for (const k of all) {
  assert.ok(VEN[AUTO[k]], `${k}: Ort ${AUTO[k]} unbekannt`);
  assert.ok(moves.has(MOVES[k]), `${k}: Bewegung ${MOVES[k]} unbekannt`);
}
const FX = { c: set(venue, "CO2"), p: set(venue, "PYRO"), s: set(venue, "STROBE"), l: set(venue, "SEA"), b: set(show, "BLIND"), w: set(show, "SHEET"), q: set(show, "CALM") };
for (const [f, s] of Object.entries(FX)) kinSet(s, f);
for (const [k, v] of Object.entries(KIN)) if (Array.isArray(v) && v[3]) assert.ok(/^(-|[cpslbwq]+)$/.test(v[3]), `${k}: Effekte ${v[3]}`);
// ruhige Stile ohne CO2, Pyro und Stroboskop; laute Stile ohne ruhiges Bokeh
for (const k of ["spoken", "sleep", "meditation", "kids", "comedy", "choral", "opera", "tarab", "fado", "lofi", "newage"]) {
  for (const f of "cps") assert.ok(!FX[f].has(k), `${k} hat Effekt ${f}`);
}
for (const k of ["metal", "deathmetal", "hardstyle", "gabber", "edm", "hardcorepunk"]) assert.ok(!FX.q.has(k), `${k} hat ruhiges Bokeh`);
for (const k of ["deathmetal", "thrash", "numetal", "poppunk"]) assert.ok(FX.p.has(k), `${k}: Pyro fehlt`);
for (const k of ["electrohouse", "gabber", "festivaltrap", "neurofunk"]) assert.ok(FX.c.has(k), `${k}: CO2 fehlt`);
for (const k of ["worship", "bolero", "smoothjazz", "folk"]) assert.ok(FX.l.has(k), `${k}: Lichtermeer fehlt`);
assert.equal(AUTO.choral, "cathedral");
assert.equal(AUTO.opera, "hall");
assert.equal(AUTO.partyschlager, "skihut");
assert.equal(MOVES.metalcore, "jump");
assert.equal(MOVES.rootsreggae, "skank", "Abwandlung erbt die Bewegung");

// ---- schnell: tausende Abfragen in wenigen Millisekunden (und je Text nur einmal gerechnet)
const sample = [...SPOTIFY.map((x) => x[0]), ...APPLE_NAMES.map((x) => x[1].toLowerCase())];
let t0 = process.hrtime.bigint();
for (const g of sample) best(g + " x");
const cold = Number(process.hrtime.bigint() - t0) / 1e6 / sample.length;
t0 = process.hrtime.bigint();
for (let i = 0; i < 20; i++) for (const g of sample) best(g + " x");
const warm = Number(process.hrtime.bigint() - t0) / 1e6 / (sample.length * 20);
assert.ok(cold < 0.5, `erste Abfrage zu langsam: ${cold.toFixed(3)} ms`);
assert.ok(warm < 0.05, `gemerkte Abfrage zu langsam: ${warm.toFixed(4)} ms`);

console.log(`genres: ok (${all.length} Spielarten, ${SPOTIFY.length} Spotify- und ${APPLE_NAMES.length} Apple-Genres, ${cold.toFixed(3)} ms je neuer Abfrage)`);
