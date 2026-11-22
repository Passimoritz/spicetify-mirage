// Baut src/genre-map.js: für jeden Namen der vollständigen Genre-Liste (tools/data/genres-all.json, siehe
// tools/genres-fetch.js), den die Regeln in src/genres.js allein nicht oder nur grob treffen, die passende Spielart.
//   node tools/genres-map.js           Tabelle neu schreiben, Übersicht ausgeben (Ende mit Code 1, wenn ein Name offen bleibt)
//   node tools/genres-map.js --dump f  zusätzlich jede Zuordnung (Name → Spielart, Weg) als TSV nach f
// Reihenfolge je Name: eigene Zuordnung unten (MANUAL) → genaue Regel → genaue Regel eines Eltern-Genres (Spotify-Baum
// von Every Noise, z. B. „aarhus indie“ → „indie rock“) → grobe Familie (GENRES/APPLE) → Familie eines Eltern-Genres.
// In die Tabelle kommt nur, was zur Laufzeit ohne sie anders (oder gar nicht) herauskäme – so bleibt sie klein.
const fs = require("fs"), path = require("path");
const esbuild = require("esbuild");

const repo = path.join(__dirname, "..");
const DATA = path.join(__dirname, "data", "genres-all.json");
const OUT = path.join(repo, "src", "genre-map.js");

function load(file) {
  const r = esbuild.buildSync({ entryPoints: [path.join(repo, "src", file)], bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent" });
  const mod = { exports: {} };
  new Function("module", "exports", "require", r.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
}
const { best, GENRES, APPLE, APPLE_ONLY, DEEZER_ONLY, FAMILIES } = load("genres.js");
const KEYS = new Set(Object.values(FAMILIES).flat());

// Von Hand: Namen, die weder eine Regel noch ein Eltern-Genre trifft, oder die eine Regel falsch einordnet.
// Schlüssel = Name (klein), Wert = Spielart. Zuerst die Sammelbegriffe der Läden, dann Spotify-Eigenheiten.
const MANUAL = {
  // Deezer/Apple-Sammelbegriffe (pickGenre überspringt einige davon absichtlich; hier nur, damit jeder Name ein Profil hat)
  sport: "edm", sports: "edm", "asian music": "kpop", "asiatische musik": "kpop", "deutsche musik": "deutschpop", fitness: "edm",
  "hörbücher auf deutsch": "spoken", "audiobooks in english": "spoken", "films/games": "cinematic", "filme/videospiele": "cinematic",
  "radio": "spoken", "world": "pop", "weltmusik": "pop", "international": "pop", "various": "pop", "kinder": "kids", "comedy": "comedy",
};
// Der lange Schwanz (Spotify-Eigenheiten und MusicBrainz-Traditionen), nach Spielart gruppiert. Wo nur die Gegend
// bekannt ist, die Spielart der Gegend (indonesische Traditionen → Gamelan, andine → Andean …); wirklich Unbekanntes → Pop.
const MANUAL_BY = {
  // Sammelbegriffe aus dem Spotify-Baum (Metagenres) und Nicht-Musik
  pop: "event|football|fotbollslatar|fussball|voetbal|karaoke|ringtone|tribute|tvog|kai|ripsaw|tread|skizzo|ori deck|tbm|zess|shoor|shanto|nagara naam|yakousei|hard beat|puxa|beat fino|merequetengue|regalia|beni|boedra|ninja|white voice",
  ambient: "sound|sound effects|atmosphere|animal singing|animal sounds|kankyō ongaku",
  sleep: "birdsong|ocean|rain|water|whale song|shush",
  meditation: "hypnosis|subliminal product|tone",
  spoken: "non-music|vocal resources|bible|german literature|nopixel|vintage radio show|motivation|sermon|audio documentary|prank calls|dream smp",
  edm: "remix product|marathi remix|turkce remix|viet remix|mashup|hard motivation|epa dunk|hardbass|donk|changa tuki|tribal guarachero|nortec|budots",
  gospel: "religious|ring shout|jubilee",
  klezmer: "jewish|chabad niggunim|jewish cantorial|ashkenazi cantorial music|chazzanut|nigun|zemirot",
  bhajan: "hinduist|hare krishna|abhang|stotra|ginan|baul gaan",
  nasheed: "adhan|maddahi|menzuma|zikiri",
  kids: "birthday|cancoes infantis|muzika l'yeladim|pony|sesame street",
  anime: "a3|aikatsu|ensemble stars|ghibli|gochiusa|gundam|hypnosis mic|kamen rider|king of prism|love live|macross|precure|pretty rhythm|sakura wars|starmyu|super sentai|touken ranbu|tsukiuta|uma musume|utapri|yowapeda|moe song|denpa|mad",
  vocaloid: "hololive|honeyworks|nijisanji",
  gamemusic: "final fantasy|fnaf|fnf|genshin|minecraft|russian minecraft|undertale|yakuza",
  musical: "actors|revue",
  orchestral: "anthem|marcha funebre|funeral march|wind ensemble",
  chamber: "quartetto d'archi",
  baroque: "musica antigua|ars antiqua|ars nova|jácara|tiento|ricercar|canzona|ballet de cour|contenance angloise|tragédie en musique",
  classical: "ballet|bagatelle|capriccio|character piece|divertissement|fantasia|fugue|impromptu|mazurka|nocturne|overture|polonaise|prelude|serenade|sinfonia concertante|sonata|theme and variations|toccata|étude|cantata|concert spiritual|change ringing",
  romantic: "english pastoral school|expressionism|futurism",
  contemporary: "new complexity|sonorism|stochastic music|indeterminacy|monodrama",
  minimalism: "process music",
  opera: "opéra comique|zeitoper|romantische oper|género chico|género grande|tonadilla|mélodie|lied|comédie-ballet",
  choral: "oratorio|passion setting|kontakion|sticheron|troparion|russian orthodox liturgical music|church music|villancico|lauda|seto leelo|paghjella|cantu a tenore|polifonia occitana|canto degli alpini|sutartinės|zema|close harmony",
  experimental: "eai|sampledelia|black midi|data sonification|text-sound composition|ytpmv|reductionism",
  freejazz: "conducted improvisation|modern creative",
  vocaljazz: "vocalese",
  swing: "foxtrot",
  easylistening: "parlour music|slow waltz|waltz|moogsploitation|cruise|cocktail nation",
  dixieland: "minstrelsy|coon song|cakewalk",
  blues: "work song",
  funk: "porn groove",
  polka: "march|circus|circus march|pep band|drum and bugle corps|drumline|bandinha|dobrado|krakowiak|kujawiak|oberek|liscio|schottische|chotis madrileño|fisarmonica",
  volksmusik: "narodno zabavna|narodnozabavna glasba|gstanzl",
  karneval: "guggenmusik|murga uruguaya",
  partyschlager: "drikkelek|kermis",
  schlager: "pimba",
  europop: "mgp|norges stemme",
  chanson: "kleinkunst|cuplé|nova cançó|piosenka aktorska|yé-yé|música de intervenção",
  canzone: "tammurriata|pizzica|stornello",
  celtic: "kan ha diskan|bagad|pìobaireachd|puirt à beul|sean-nós|waulking song|pipe band music|cape breton fiddling|hornpipe|tonada asturiana|muiñeira",
  bluegrass: "james bay fiddling|métis fiddling|contra",
  nordicfolk: "runo song|hambo|visa",
  folk: "australian indigenous|canadian indigenous|native american|taiwanese indigenous|tahitian|women's music|tuna estudiantil|mãºsica pitiusa|drinking song|fahrtenlied|trampská hudba|pásztordal|bocet|cantu a chiterra|euskal kantagintza berria|trikitixa|sardana|tajaraste|jota|rustic stomp",
  balkan: "csárdás|verbunkos|doina|čalgija",
  turbofolk: "magyar mulatos|mulatós|nóta",
  greek: "dimotiko|rizitika|skiladiko",
  christmas: "colindă",
  fado: "folclore portugues",
  flamenco: "pasodoble|saeta|bulería|fandango|seguidilla",
  russianpop: "avtorskaya pesnya",
  // Asien
  japantrad: "danmono|heikyoku|honkyoku|jiuta|jōruri|kouta|kumi-daiko|kumiuta|meiji shinkyoku|nagauta|noh|ondō|shinkyoku|shōmyō|sōkyoku|shima-uta|rōkyoku|beompae|changjak gugak|dangak|gagok|hyangak|jeongak|pungmul|sanjo|sinawi|ca trù|chèo|cải lương|hát tuồng|ngâm thơ|quan họ|tân cổ giao duyên|xẩm|urtiin duu|bogino duu|central asian throat singing|yukar",
  enka: "ryūkōka|mood kayō",
  newage: "nyū myūjikku|nu age",
  jrock: "group sounds|osare kei|loud kei|soft visual",
  surfrock: "eleki|wong shadow|hot rod music",
  shibuyakei: "akishibu-kei",
  chinesetrad: "baisha xiyue|chaozhou xianshi|chinese literati music|dongjing|guangdong yinyue|gufeng|haozi|jiangnan sizhu|kunqu|nanguan|quyi|shan'ge|sizhu music|taoist ritual music|yanyue|yayue|dongzu dage|uyghur muqam|red song",
  mandopop: "shidaiqu|taiwan graduation song",
  cpop: "chinese new year|manyao",
  chinesehiphop: "hanmai",
  vpop: "nhạc tiền chiến|nhạc vàng|nhạc đỏ",
  lukthung: "kantruem",
  gamelan: "khrueang sai|mahori|pinpeat|piphat|rom kbach|bantengan|cilokaq|gambang kromong|gondang|jaipongan|kacapi suling|kakawin|ketuk tilu|kliningan|kuda lumping|langgam jawa|orkes gambus|saluang klasik|talempong|talempong goyang|tanjidor|tarawangsa|tembang cianjuran|dondang sayang",
  opm: "balitaw|harana|kantan chamorrita",
  bollywood: "bangla|adhunik geet|bhavageethe|garba|jibonmukhi gaan|lavani|powada|nepali lok geet|dohori|rigsar|samri",
  kollywood: "burrakatha|gaana|mappila",
  punjabi: "dhol tasha|jhumar",
  bhojpuri: "biraha",
  hindustani: "santoor|khyal|natya sangeet|tappa|tarana",
  carnatic: "konnakol|urumi melam",
  qawwali: "kafi|sufiana kalam",
  // Naher Osten & Nordafrika
  gnawa: "ahwash|aita|izlan|malhun",
  tarab: "falak|malouf|mugham|shashmaqam|song of sana’a|song of sana'a",
  arabic: "mūsīqā lubnāniyya|raqs baladi|sa'idi|qaraami",
  arabicpop: "al jeel",
  khaleeji: "liwa|sawt|fijiri",
  rai: "staïfi|musique mariage algerien",
  arabesk: "cerkes muzikleri|rabiz|zeybek|uzun hava",
  turkishpop: "özgün müzik",
  mizrahi: "maftirim|piyyut|baqashot|muzika yehudit mekorit|muzikat dika'on",
  // Afrika & Karibik
  afro: "botswana traditional|acholitronix|famo|isicathamiya|jit|kalindula|kwela|maskanda|mbaqanga|mbube|omutibo|timbila|tchinkoumé|zinli|kalon'ny fahiny|banga|djanba|gommance|mgodro|ufie music|vude|tassu|mataali|maloya élektrik",
  highlife: "agbadza|agbekor|kete|ogene music",
  soukous: "alloukou|ambasse bey|assiko|bend-skin|kwassa kwassa|mangambeu|mbolé|salegy|tradi-moderne congolais|tradi-moderne ivoirien|tsapiky|tumbélé|ziglibithy|zoblazo",
  bongo: "beni|chakacha|genge|kadodi|kapuka|kidandali|kidumbak|mchiriku|mugithi|muziki wa dansi|ngoma|unyago",
  kizomba: "kilapanga",
  mbalax: "njuup",
  desertblues: "takamba",
  afrobeat: "tizita",
  zouk: "séga|séga tambour|traditional séga|moutya|santé engagé|kasékò|bélé|gwo ka",
  kompa: "cadence lypso|cadence rampa|méringue|rara",
  calypso: "aleke|benna|spouge|junkanoo|goombay|calipso venezolano",
  soca: "parang|tassa|palo de mayo",
  dancehall: "deejay|bubbling",
  ska: "2 tone",
  // Lateinamerika
  reggaeton: "bachatón|cubatón|romantic flow|francoton",
  funkcarioca: "batidão romântico|beat bolha|beat bruxaria|tamborzão|ritmada",
  samba: "sambalanço|jongo|batuque|lundu|maxixe|marchinha|candombe beat",
  forro: "carimbó|ciranda|embolada|toada de boi|repente|cantoria|aboio",
  sertanejo: "cururu|vanera|rasqueado cuiabano",
  mpb: "modinha|seresta|udigrudi|tropicanibalismo",
  brazil: "mangue beat|guitarrada|afoxê",
  corridos: "movimiento alterado",
  banda: "música festera",
  regionalmexican: "musica mexiquense|pirekua",
  norteno: "canto cardenche",
  andean: "baguala|carranga|chamamé|chuscada|copla cajamarquina|harawi|huaylarsh|marinera norteña|morenada|muliza|música criolla|polca criolla|tondero|vals criollo|yaraví|zamacueca|sikuri|sanjuanito|taquirari|tonada potosina|caporal|pandilla|música llanera|vals venezolano|malagueña venezolana|nuevo cancionero|payada|canto a lo poeta|música típica chilena|bambuco|chimayche|guarania",
  son: "festejo|landó|punto|guaguancó|conga|songo|pilón|tumba|tumba francesa|habanera",
  bolero: "pasillo|música cebolla|filin|canción melódica",
  cumbia: "chunchaca|bullerengue|currulao|merecumbé|tamborito|tamborera|chanchona|xuc",
  latinjazz: "onda nueva|descarga",
  // Elektronisch
  dubstep: "breakstep|drumstep|hardstep|lowend|midtempo bass|neurohop|skullstep|minatory|siren jam",
  futurebass: "colour bass|melodic bass",
  dnb: "crossbreed|halftime|techstep|autonomic",
  hardstyle: "dubstyle|hard nrg|powerstomp|psystyle|rawphoric",
  gabber: "gabba|nustyle",
  hardtechno: "free tekno|frenchtek|hard drum|lento violento|modern hardtek",
  psytrance: "full-on|hi-tech full-on|night full-on",
  downtempo: "psybient",
  synthwave: "dreamwave",
  krautrock: "berlin school",
  vaporwave: "eccojams|spamwave|vapornoise",
  chiptune: "dungeon chip|fm synthesis|bit music|bytebeat",
  dungeonsynth: "dungeon sound",
  eurodance: "hardbag|j-euro|wa euro",
  deephouse: "jersey sound",
  house: "uk jackin",
  idm: "leftfield",
  hyperpop: "sped up",
  // Hip-Hop & Rock
  alternativehiphop: "chap hop",
  hyphy: "mobb music",
  southern: "ratchet music|snap|twerk",
  classicrock: "beat music|mod|nederbeat|palingsound",
  heavymetal: "birmingham sound",
  psychrock: "houston sound|psichedelia occulta italiana|psychploitation",
  indie: "dunedin sound|donosti sound",
  postpunk: "gothic",
  hardcorepunk: "burning spirits|neocrust",
  posthardcore: "skramz",
  blackmetal: "black 'n' roll",
  deathmetal: "death 'n' roll",
  grindcore: "gorenoise",
  noise: "pigfuck|shitgaze",
  hardrock: "wrestling",
  teenpop: "brill building",
  lofi: "writing|bgm",
  chill: "hangpan",
  comedy: "comic|break-in|fiction comique",
};
// Apple (englischer Name der Genre-ID – die anderen Sprachen derselben ID folgen) und Deezer (inklusive der
// Podcast-Kategorien, die Deezer unter denselben IDs führt), dazu der Rest Spotify/MusicBrainz
const MANUAL_REST = {
  spoken: "stories|business|news & politics|culture & society|education|music & commentaries|science|spirituality & religion|tv shows & movies|lifestyle & loisirs|infos & divertissement|true crime|basketball|cours de langues|arts|histoire|voyages et lieux|philosophie|littérature|cuisine|mode & beauté|lgbtq&a|femmes inspirantes|etre parent|documentaire|relations|développement personnel|rugby|entrepreneuriat|horreur|journaux intimes et témoignages|masculinité|arts et entertainment|art performance|arts visuels|actualité du jour|actualité sportive|actualité tech|elections|ecologie|actualité culturelle|investir/finance|management|marketing|ngo|job coaching|sci fi & fantasy|thriller|paranormal|médecine|santé mentale|nutrition|sexualité|actualités|commentaires sur l'actualité|politique|gouvernement|drame|tutoriels|feelings & romance",
  pop: "sélection deezer|activities|moments|kanto|muak|pala|burmese mono|burmese stereo",
  dancepop: "party",
  chill: "moods",
  dubstep: "bass",
  kids: "family|fairy tale|rabbit song",
  klezmer: "chanukah|musique juive",
  choral: "easter|vocal music|passion|choeur",
  chanson: "france",
  christmas: "carol",
  vocaljazz: "standards",
  reggae: "caribbean|caribe",
  latin: "south america",
  folk: "north america|hawaii|australia|europe|batonebi songs|chamarrita açoriana|duma|fakaseasea|filk|għana|isa|kalattut|néo-trad|tivaner inngernerlu|uaajeerneq|unakesa|vaigat|wangga|ʻōteʻa",
  sleep: "iavnana",
  japantrad: "japan|asia|korean trad theater|aak",
  mandopop: "chinese",
  chinesetrad: "chinese flute|chinese strings",
  kpop: "korean",
  nasheed: "dini",
  arabesk: "halk|sanat",
  flamenco: "iberia",
  russianpop: "russian|musique russe",
  contemporary: "contemporary era|modern|early 20th century|late 20th century|21st century|modernism|second viennese school|dodecaphony|post-modernism|new simplicity|eclecticism|polystylism",
  acoustic: "guitar|american primitive guitar",
  musical: "shows|music theatre",
  bollywood: "marathi|gujarati|assamese|odia|rajasthani|bengali|baila|boduberu|sarala gee",
  qawwali: "urdu",
  turkishpop: "özgün",
  soukous: "kwassa|rhumba",
  opera: "stage works",
  orchestral: "tone poem",
  baroque: "air de cours|english ayre|troubadour music|trouvère music|meistergesang|prima pratica|seconda pratica|troubadour song",
  classicalera: "first viennese school",
  romantic: "romantic|early romantic|nationalism",
  zouk: "sega mauritien|swag mauritien",
  rootsreggae: "seggae mauritien",
  desertblues: "touareg",
  gnawa: "charki",
  europop: "iskelmä|musique finlandaise|nederlandstalige muziek",
  indie: "indé finlandaise",
  boombap: "east coast|old school|battle record",
  cumbia: "música colombiana|doble paso",
  calypso: "raizal|fungi",
  freejazz: "improvisation",
  afro: "balani show|dhaanto|guayla|sigidrigi",
  afrohouse: "bacardi",
  andean: "avanzada|chamarrita rioplatense",
  vaporwave: "barber beats",
  bass: "chopper",
  meditation: "chöd",
  kizomba: "coladeira",
  polka: "concertina band|waila",
  fado: "desgarrada",
  noise: "deutscher krach",
  forro: "fandango caiçara",
  gamelan: "fon leb",
  edm: "free car music",
  easylistening: "hapa haole|whistling",
  turbofolk: "izvorna bosanska muzika",
  ccm: "jesus music",
  classical: "klasik",
  latinjazz: "kréyol djaz",
  brazil: "lambada",
  fusion: "paramaribop",
  cinematic: "production music",
  soca: "cachaca",
  juju: "waka",
  greek: "éntekhno",
};
for (const [k, list] of Object.entries(MANUAL_REST)) for (const n of list.split("|")) if (n && !(n in MANUAL)) MANUAL[n] = k;
for (const [k, list] of Object.entries(MANUAL_BY)) for (const n of list.split("|")) if (!(n in MANUAL)) MANUAL[n] = k;

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const parentOf = { ...(data.spotify?.meta || {}), ...(data.spotify?.names || {}) };
const rule = (n) => best(n, true)?.[0] || "";
const broadOf = (n, src) => ((src === "apple" || src === "deezer" ? APPLE : GENRES).find(([, re]) => re.test(n)) || (src === "apple" || src === "deezer" ? GENRES : APPLE).find(([, re]) => re.test(n)) || [""])[0];
// genaue Regel des nächsten Eltern-Genres, das eine hat (höchstens 8 Stufen, gegen Schleifen)
function viaParent(n, pick) {
  for (let p = parentOf[n], i = 0; p && i < 8; p = parentOf[p], i++) {
    const k = MANUAL[p] || pick(p);
    if (k) return k;
  }
  return "";
}
// so rechnet src/genres.js genreKey() ohne Tabelle
function runtime(n, src) {
  if (src === "apple" && APPLE_ONLY[n]) return APPLE_ONLY[n];
  if (src === "deezer" && DEEZER_ONLY[n]) return DEEZER_ONLY[n];
  return rule(n) || broadOf(n, src);
}
function resolve(n, src) {
  if (MANUAL[n]) return [MANUAL[n], "manual"];
  if (src === "apple" && APPLE_ONLY[n]) return [APPLE_ONLY[n], "apple-only"];
  if (src === "deezer" && DEEZER_ONLY[n]) return [DEEZER_ONLY[n], "deezer-only"];
  let k;
  if ((k = rule(n))) return [k, "rule"];
  if ((k = viaParent(n, rule))) return [k, "parent-rule"];
  if ((k = broadOf(n, src))) return [k, "family"];
  if ((k = viaParent(n, (p) => broadOf(p, src)))) return [k, "parent-family"];
  return ["", "none"];
}

// Apple und Deezer: dieselbe Genre-ID in allen Sprachen. Was eine eigene Regel trifft, behält sie; alle anderen
// Namen der ID bekommen die Spielart des ersten Namens, der etwas trifft (zuerst Englisch) – so landen „ロック“,
// „Рок“ und „록“ wie „Rock“, ohne jede Sprache einzeln zu kennen
const STRONG = new Set(["manual", "apple-only", "deezer-only", "rule"]);
const viaId = {};
for (const src of ["apple", "deezer"]) {
  for (const group of Object.values(data[src] || {})) {
    const ns = group.map(norm).filter(Boolean);
    const first = ns.map((n) => resolve(n, src)).find(([k]) => k);
    if (first) for (const n of ns) if (!STRONG.has(resolve(n, src)[1])) viaId[src + "|" + n] = first[0];
  }
}

const names = [];
for (const n of Object.keys(data.spotify?.names || {})) names.push([norm(n), "spotify"]);
for (const n of data.mb || []) names.push([norm(n), "spotify"]);
for (const src of ["apple", "deezer"]) for (const g of Object.values(data[src] || {})) for (const n of g) names.push([norm(n), src]);

const map = {}, open = [], ways = {}, dump = [];
const seen = new Set();
for (const [n, src] of names) {
  if (!n || seen.has(src + "|" + n)) continue;
  seen.add(src + "|" + n);
  const [k, way] = viaId[src + "|" + n] ? [viaId[src + "|" + n], "same-id"] : resolve(n, src);
  ways[way] = (ways[way] || 0) + 1;
  dump.push([n, src, k, way, parentOf[n] || ""].join("\t"));
  if (!k) {
    open.push(`${n} (${src})`);
    continue;
  }
  if (!KEYS.has(k)) throw new Error(`${n}: unbekannte Spielart ${k}`);
  // ein Name aus zwei Quellen (Apple und Spotify) bekommt die genauere Zuordnung: die erste Quelle gewinnt
  if (k !== runtime(n, src) && !(n in map)) map[n] = k;
}
// kompakt: je Spielart eine Zeichenkette mit „|“ getrennt (die Tabelle steckt im Theme-Bündel)
const byKey = {};
for (const [n, k] of Object.entries(map).sort()) (byKey[k] ||= []).push(n);
for (const n of Object.keys(map)) if (n.includes("|")) throw new Error(`„|“ im Namen: ${n}`);
const body = Object.entries(byKey).sort().map(([k, list]) => `  ${k}: ${JSON.stringify(list.join("|"))},`).join("\n");
fs.writeFileSync(OUT, `/* Erzeugt von tools/genres-map.js aus tools/data/genres-all.json – nicht von Hand ändern (Zuordnungen von Hand: MANUAL dort).
   Genre-Name → Spielart für alle Namen, die die Regeln in genres.js allein nicht oder nur grob treffen. */
export const GENRE_MAP = {
${body}
};
`);
if (process.argv.includes("--dump")) fs.writeFileSync(process.argv[process.argv.indexOf("--dump") + 1], dump.join("\n") + "\n");
console.log(`${seen.size} Namen: ${Object.entries(ways).map(([w, n]) => `${w} ${n}`).join(", ")} – Tabelle ${Object.keys(map).length} Einträge, ${fs.statSync(OUT).size} Bytes`);
if (open.length) {
  console.log(`ohne Profil (${open.length}):\n  ` + open.join("\n  "));
  process.exit(1);
}
