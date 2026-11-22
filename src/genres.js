/* ---------------------------------------------------------------- Spielarten und Genre-Erkennung */
// Reine Daten und reine Funktionen (ohne Spotify, ohne Fenster) – so laufen sie auch in den Unit-Tests.
// Die Verwandtschaft (Ort, Publikum, Effekte) steht in styles.js, die Lichtsprache der Grund-Profile in party.js.
import { GENRE_MAP } from "./genre-map.js";

// Lichtsprache der weiteren Spielarten: nur, worin sie sich von ihrem Verwandten (styles.js) unterscheiden
const LOOKS = {
  // Elektronisch
  electrohouse: { decay: 8, spot: "cross", tint: "cool", spinRate: 0.6 }, progressivehouse: { decay: 5, spot: "aurora", spinRate: 0.35, beams: 1.1 },
  futurehouse: { decay: 7, spot: "pan", tint: "cool", spinRate: 0.35, sparks: 14 }, tropicalhouse: { tint: "warm", spot: "pan", sparks: 12 },
  basshouse: { accent: [1, 0.4, 0.95, 0.5], spot: "floor", shake: 4, bottom: true },
  acidhouse: { decay: 8, spot: "scan", tint: "jungle", spinRate: 0.4 }, chicagohouse: { tint: "gold", sparks: 14 },
  frenchhouse: { tint: "pink", spinRate: 0.3 }, nudisco: { decay: 6.5, tint: "pink", sparks: 18 },
  jerseyclub: { decay: 9, accent: [1, 0.8, 1, 0.9], shake: 3, spinRate: 0.45 }, minimal: { decay: 6, beams: 0.6, spinRate: 0.2, sparks: 3 },
  detroittechno: { decay: 8, spinRate: 0.3, beams: 0.9 }, dubtechno: { decay: 4, beams: 0.6, spot: "aurora", spinRate: 0.15, pulse: 0.05 },
  ebm: { decay: 10, flashOn: "back", accent: [0.8, 1, 0.8, 1], spot: "top", spinRate: 0.3 },
  progressivetrance: { decay: 5.5, spinRate: 0.35, beams: 1 }, upliftingtrance: { beams: 1.25, sparks: 18, height: 1.6 },
  liquiddnb: { decay: 6, spot: "aurora", spinRate: 0.4, shake: 2 }, neurofunk: { decay: 12, spot: "scan", shake: 7, sparks: 6 },
  jungle: { decay: 9, tint: "jungle", accent: [1, 0.6, 0.9, 0.75], spot: "floor" }, footwork: { decay: 11, accent: [1, 0.7, 1, 0.8], spinRate: 0.55 },
  electro: { decay: 7, spot: "scan", tint: "cool" }, festivaltrap: { decay: 6, accent: [1, 0.3, 0.9, 0.45], spinRate: 0.3, sparks: 14 },
  moombahton: { decay: 6.5, spot: "pan", tint: "jungle", sparks: 14 }, gabber: { decay: 13, shake: 9, spinRate: 0.8, accent: [1, 1, 1, 1] },
  happyhardcore: { tint: "pink", shake: 4, sparks: 24 }, eurobeat: { decay: 9, spinRate: 0.65, sparks: 20 }, handsup: { beams: 1.2, spinRate: 0.55 },
  italodisco: { decay: 6, spot: "disco", tint: "pink" }, darksynth: { decay: 7, spot: "scan", tint: "hot", shake: 4 },
  vaporwave: { decay: 3, spinRate: 0.12, beams: 0.5 }, chiptune: { tint: "cool", spot: "scan", sparks: 20 },
  // Hip-Hop & R&B
  gangsta: { decay: 5, spot: "top", tint: "hot", shake: 7 }, gfunk: { decay: 4, tint: "gold", spot: "pan", accent: [1, 0.5, 0.85, 0.6], shake: 3 },
  southern: { tint: "warm", shake: 8, decay: 4 }, alternativehiphop: { tint: "cool", decay: 4 },
  poprap: { spot: "pan", tint: "pink", sway: true, sparks: 14, shake: 3 }, ukhiphop: { spot: "pan" },
  grime: { decay: 9, accent: [1, 0.5, 1, 0.6], spot: "top", tint: "cool", shake: 6, sway: false }, frenchrap: { spot: "pan" },
  italianrap: { tint: "warm" }, spanishrap: { tint: "warm", spot: "pan" }, turkishrap: { tint: "hot" }, arabrap: { tint: "gold" },
  brazilianhiphop: { tint: "jungle", spot: "pan" }, altrnb: { tint: "pink", spot: "aurora", decay: 2.8 },
  newjackswing: { decay: 6, accent: [1, 0.6, 0.9, 0.7], flashOn: "down", spot: "pan", tint: "gold", spinRate: 0.3, sparks: 14 },
  neosoul: { decay: 3.2, tint: "warm", spot: "soft", beams: 0.4 }, northernsoul: { decay: 5.5, spinRate: 0.25, sparks: 14 },
  funk: { decay: 7, accent: [0.8, 1, 0.8, 1], flashOn: "back", tint: "warm", spinRate: 0.3, shake: 2 },
  // Rock
  classicrock: { tint: "gold", shake: 6 },
  rocknroll: { decay: 8, accent: [0.7, 1, 0.7, 1], spot: "pan", tint: "gold", sway: true, shake: 3, spinRate: 0.3 },
  glamrock: { tint: "pink", sparks: 24 }, bluesrock: { decay: 6, tint: "warm", spinRate: 0.15, shake: 6 }, southernrock: { tint: "warm" },
  psychrock: { decay: 5, spot: "aurora", tint: "jungle", spinRate: 0.25, beams: 0.9, shake: 3 },
  stonerrock: { decay: 5, tint: "hot", spinRate: 0.1, shake: 9, accent: [1, 0.8, 0.9, 1] },
  progrock: { decay: 5, spot: "aurora", spinRate: 0.18, beams: 1, tint: "cool" },
  krautrock: { decay: 6, accent: [1, 0.85, 0.95, 0.85], spot: "scan", spinRate: 0.2 }, surfrock: { tint: "cool", spot: "pan", sway: true, shake: 3 },
  garagerock: { decay: 10, tint: "warm", shake: 7 }, grunge: { decay: 9, tint: "warm", shake: 9, beams: 0.7, sparks: 8 },
  britpop: { tint: "cool", spinRate: 0.25, shake: 3 }, shoegaze: { decay: 3, spot: "aurora", spinRate: 0.12, beams: 0.6, tint: "pink", shake: 0 },
  postpunk: { decay: 8, spot: "scan", tint: "cool", shake: 3, sparks: 6 }, folkrock: { decay: 6, tint: "warm", beams: 0.55 },
  softrock: { decay: 3.5, accent: [0.8, 1, 0.8, 1], spot: "pan", spinRate: 0.12, tint: "gold" }, deutschrock: { tint: "hot" },
  poppunk: { tint: "pink", shake: 6, sparks: 22 }, hardcorepunk: { decay: 14, shake: 12, spinRate: 0.3, sparks: 24 },
  posthardcore: { decay: 11, shake: 9 },
  // Metal
  heavymetal: { decay: 10, spinRate: 0.2 }, thrash: { decay: 13, shake: 13, spinRate: 0.3 }, glammetal: { tint: "pink", sparks: 24, shake: 8 },
  powermetal: { decay: 9, tint: "gold", spinRate: 0.35, beams: 1.1, sparks: 26 },
  symphonicmetal: { decay: 7, spot: "aurora", tint: "cool", spinRate: 0.2, beams: 1 }, progmetal: { decay: 9, spot: "scan", tint: "cool", shake: 8 },
  doom: { decay: 4, accent: [1, 0.4, 0.8, 0.5], flashOn: "down", spinRate: 0.06, shake: 12, sparks: 10 },
  deathmetal: { decay: 14, shake: 14, sparks: 16 }, blackmetal: { decay: 12, tint: "cool", spot: "scan", shake: 10, sparks: 10 },
  grindcore: { decay: 15, shake: 14, spinRate: 0.4 }, groovemetal: { decay: 10, accent: [1, 0.9, 0.8, 1] },
  metalcore: { decay: 12, tint: "cool", shake: 12, sparks: 20 }, deathcore: { decay: 14, shake: 15, accent: [1, 0.5, 1, 0.5] },
  numetal: { decay: 9, accent: [1, 0.6, 1, 0.7], flashOn: "down-hi", spot: "floor", shake: 10, bottom: true },
  industrialmetal: { decay: 11, flashOn: "down", accent: [1, 0.85, 1, 0.85], spot: "scan", shake: 10 },
  folkmetal: { decay: 9, tint: "jungle", spot: "pan", sway: true, spinRate: 0.3 },
  // Pop
  dancepop: { decay: 7, spot: "cross", spinRate: 0.4, sparks: 20 }, electropop: { decay: 7, spot: "scan", tint: "cool", spinRate: 0.35 },
  synthpop: { decay: 6, spot: "pan", tint: "pink", spinRate: 0.3, sparks: 12, beams: 0.9 }, teenpop: { tint: "pink", spinRate: 0.4, sparks: 24 },
  poprock: { flashOn: "back", tint: "warm", spinRate: 0.25, shake: 3 }, indiepop: { tint: "pink", spinRate: 0.22, sway: true, shake: 0 },
  artpop: { decay: 4, spot: "aurora", tint: "cool", spinRate: 0.15, beams: 0.6 },
  // Asien
  kindie: { tint: "pink" }, krock: { tint: "pink" }, khiphop: { tint: "pink", spot: "pan" }, krnb: { tint: "pink" },
  trot: { tint: "pink", spot: "pan" }, jrock: { tint: "pink", sparks: 20 }, jhiphop: { tint: "pink" }, anime: { sparks: 26, spinRate: 0.55 },
  vocaloid: { decay: 9, spinRate: 0.65, tint: "cool", sparks: 24 }, citypop: { tint: "pink", spinRate: 0.25 },
  shibuyakei: { spinRate: 0.3, sparks: 20 }, enka: { tint: "pink" }, japantrad: { decay: 3, tint: "hot", accent: [1, 0.4, 0.7, 0.4] },
  cpop: { tint: "hot" }, mandopop: { decay: 4, spot: "soft", tint: "hot", spinRate: 0.15, sparks: 12 }, cantopop: { tint: "pink" },
  chinesehiphop: { tint: "hot" }, chinesetrad: { tint: "gold" }, tpop: { tint: "gold" }, lukthung: { tint: "gold", spot: "pan" },
  vpop: { tint: "gold" }, opm: { tint: "warm", spot: "pan" }, dangdut: { tint: "warm", spot: "floor" }, gamelan: { tint: "gold" },
  kollywood: { tint: "hot" }, punjabi: { decay: 8, accent: [1, 0.6, 0.95, 0.7], tint: "hot", shake: 3, spinRate: 0.45 }, desihiphop: { tint: "gold" },
  hindustani: { decay: 2.4, tint: "gold" }, carnatic: { tint: "hot" },
  qawwali: { decay: 4, accent: [1, 0.5, 0.8, 0.7], tint: "gold", spinRate: 0.12, sparks: 10 },
  // Lateinamerika
  latinpop: { spot: "pan", sparks: 20 }, latintrap: { tint: "warm" }, dembow: { decay: 8, accent: [1, 0.6, 0.8, 1], spinRate: 0.4, shake: 4 },
  bachata: { decay: 3.5, accent: [1, 0.5, 0.7, 0.85], flashOn: "", spot: "soft", spinRate: 0.15, sparks: 10 },
  merengue: { decay: 8, accent: [1, 0.9, 1, 0.9], spinRate: 0.45 }, son: { decay: 4.5, spot: "soft", tint: "gold", spinRate: 0.2 },
  bolero: { tint: "hot" }, cumbia: { decay: 6, accent: [0.8, 1, 0.8, 1], spot: "floor", tint: "jungle", spinRate: 0.3 }, vallenato: { tint: "gold" },
  tango: { decay: 5, accent: [1, 0.6, 0.8, 0.9] }, mariachi: { tint: "hot", spot: "pan", decay: 6 }, banda: { tint: "hot", spot: "pan" },
  norteno: { tint: "warm", accent: [1, 0.7, 0.85, 0.7], spot: "pan" },
  corridos: { decay: 4, accent: [1, 0.5, 0.8, 0.6], spot: "top", tint: "hot", spinRate: 0.12, sparks: 8 }, latinrock: { tint: "warm" },
  andean: { tint: "warm" }, samba: { decay: 7, accent: [1, 0.85, 0.95, 0.85], spinRate: 0.45, sparks: 22 },
  pagode: { decay: 5, spinRate: 0.3, sparks: 14 }, axe: { tint: "gold" }, forro: { decay: 6, accent: [1, 0.6, 0.9, 0.7], tint: "warm", spot: "pan" },
  sertanejo: { tint: "gold", spot: "pan", sparks: 18 }, funkcarioca: { decay: 8, accent: [1, 0.5, 0.8, 1], tint: "jungle", shake: 5, spinRate: 0.35 },
  mpb: { tint: "jungle" }, bossa: { tint: "jungle", decay: 2.8 },
  // Afrika & Karibik
  afrobeat: { decay: 6, accent: [0.8, 1, 0.8, 1], flashOn: "back", tint: "gold", spinRate: 0.3 },
  highlife: { tint: "gold", accent: [1, 0.7, 0.85, 0.8] }, gqom: { decay: 7, accent: [1, 0.8, 0.95, 0.85], spot: "scan", tint: "hot", shake: 4 },
  afrohouse: { decay: 5, accent: [1, 0.6, 0.85, 0.8], spot: "pan", tint: "warm", spinRate: 0.22 }, bongo: { tint: "jungle" },
  soukous: { decay: 7, accent: [1, 0.8, 0.9, 0.8], spinRate: 0.4, sparks: 18 },
  kuduro: { decay: 10, accent: [1, 0.9, 1, 0.9], spinRate: 0.55, shake: 5, tint: "hot" },
  kizomba: { decay: 3, accent: [1, 0.5, 0.7, 0.8], flashOn: "", spot: "soft", tint: "pink", spinRate: 0.12 },
  desertblues: { tint: "warm", spot: "soft" }, rootsreggae: { decay: 3.5 },
  dub: { decay: 2.6, accent: [0.5, 1, 0.4, 1], spinRate: 0.08, pulse: 0.1, beams: 0.4, thick: 4 }, rocksteady: { decay: 5 },
  soca: { decay: 7, accent: [1, 0.8, 1, 0.85], spinRate: 0.45, tint: "gold", sparks: 22 }, calypso: { decay: 5, tint: "gold", spot: "pan" },
  zouk: { decay: 4.5, flashOn: "down", tint: "warm" }, kompa: { tint: "gold" },
  // Naher Osten & Nordafrika
  arabicpop: { decay: 6, accent: [1, 0.6, 0.85, 0.75], flashOn: "down", spot: "pan", spinRate: 0.3, sparks: 18 },
  khaleeji: { accent: [1, 0.5, 0.9, 0.8], spot: "floor" }, tarab: { decay: 2.2, beams: 0.3, flashOn: "", spot: "soft", spinRate: 0.08, sparks: 6 },
  rai: { decay: 6, accent: [1, 0.6, 0.8, 0.9], tint: "hot", spot: "pan", spinRate: 0.3 },
  gnawa: { decay: 4, accent: [1, 0.8, 0.9, 0.8], flashOn: "", spot: "floor", tint: "warm" },
  dabke: { decay: 8, accent: [1, 0.7, 1, 0.7], flashOn: "down", spot: "pan", spinRate: 0.35 },
  mahraganat: { decay: 9, accent: [1, 0.9, 1, 0.9], flashOn: "down", spot: "scan", tint: "hot", spinRate: 0.5, shake: 4 },
  turkishpop: { tint: "hot", spot: "pan", sparks: 18 }, arabesk: { decay: 3, flashOn: "", spot: "soft", tint: "hot", spinRate: 0.1 },
  anatolianrock: { tint: "hot" }, persianpop: { tint: "pink" }, persiantrad: { tint: "cool" }, mizrahi: { tint: "cool" },
  // Europa
  partyschlager: { decay: 8, accent: [1, 0.9, 1, 0.9], flashOn: "down", spot: "cross", spinRate: 0.45, shake: 3, sparks: 24 },
  volksmusik: { decay: 5, accent: [1, 0.6, 0.85, 0.6], flashOn: "back", spot: "pan", tint: "jungle", spinRate: 0.22 },
  polka: { decay: 8, accent: [1, 0.5, 1, 0.5], flashOn: "down", spinRate: 0.4, tint: "gold" },
  karneval: { decay: 7, accent: [1, 0.85, 1, 0.85], tint: "hot", sparks: 28 }, deutschpop: { tint: "warm", spinRate: 0.25 },
  chanson: { decay: 3, tint: "pink", spot: "top" }, canzone: { decay: 3, spot: "pan", tint: "warm", spinRate: 0.12 },
  europop: { tint: "pink", spot: "pan", sparks: 22 }, discopolo: { tint: "pink", spinRate: 0.4 },
  greek: { decay: 6, accent: [1, 0.6, 0.8, 0.7], tint: "cool", spinRate: 0.3 }, fado: { decay: 1.6, tint: "cool", spot: "soft", spinRate: 0.04 },
  turbofolk: { decay: 7, flashOn: "down", spot: "cross", tint: "pink", spinRate: 0.4, sparks: 22 },
  klezmer: { decay: 6, accent: [1, 0.7, 0.9, 0.7], tint: "gold", spinRate: 0.35 },
  nordicfolk: { decay: 3, accent: [1, 0.4, 0.7, 0.4], flashOn: "", spot: "aurora", tint: "cool", spinRate: 0.08, sparks: 6 },
  // Country & Folk
  classiccountry: { tint: "warm", decay: 5 }, countrypop: { spot: "pan", tint: "gold", sparks: 18, spinRate: 0.25 },
  countryrock: { decay: 8, shake: 5, beams: 0.7, tint: "warm" }, americana: { decay: 4.5, tint: "warm", beams: 0.35 },
  bluegrass: { decay: 7, accent: [1, 0.85, 0.9, 0.85], tint: "gold", spinRate: 0.35 }, cajun: { tint: "warm", accent: [1, 0.7, 1, 0.7] },
  folk: { decay: 3.5, tint: "warm", beams: 0.3 },
  indiefolk: { decay: 5, accent: [0.8, 1, 0.8, 1], flashOn: "back", spot: "top", spinRate: 0.15, sparks: 10 },
  // Jazz & Blues
  dixieland: { decay: 6, accent: [0.8, 1, 0.8, 1], flashOn: "back", spinRate: 0.25, sparks: 12 },
  swing: { decay: 6, accent: [0.8, 1, 0.8, 1], flashOn: "back", spot: "top", spinRate: 0.25, sparks: 14 }, bebop: { decay: 4.5, spinRate: 0.15 },
  cooljazz: { decay: 2.4, tint: "cool" }, spiritualjazz: { decay: 2.2, spot: "aurora", tint: "cool", spinRate: 0.07 },
  freejazz: { decay: 5, accent: [1, 0.8, 0.6, 0.9], spot: "scan", tint: "cool", spinRate: 0.15 },
  vocaljazz: { decay: 2.6, spot: "top", tint: "warm" }, latinjazz: { decay: 5, accent: [1, 0.6, 0.8, 0.9], tint: "warm", spinRate: 0.18 },
  gypsyjazz: { decay: 5, spinRate: 0.22 },
  fusion: { decay: 6, accent: [0.8, 1, 0.8, 1], flashOn: "back", spot: "pan", tint: "warm", spinRate: 0.25, shake: 2 },
  acidjazz: { tint: "gold", spot: "disco" }, nujazz: { decay: 5, accent: [1, 0.6, 0.85, 0.7], spot: "scan", tint: "cool", spinRate: 0.2 },
  smoothjazz: { decay: 2, spot: "soft", spinRate: 0.07 }, deltablues: { decay: 2.6, spot: "soft" },
  chicagoblues: { decay: 4.5, spinRate: 0.12, beams: 0.4 },
  // Gospel & Spirituelles
  ccm: { tint: "gold", spot: "pan", sparks: 18 },
  worship: { decay: 2.5, accent: [1, 0.4, 0.6, 0.4], flashOn: "", spot: "aurora", spinRate: 0.08, beams: 0.6 }, christianrock: { tint: "gold" },
  christianhiphop: { tint: "gold" }, bhajan: { tint: "hot", accent: [1, 0.6, 0.8, 0.6], spinRate: 0.12 }, nasheed: { accent: [1, 0.3, 0.5, 0.3] },
  // Klassik & Filmmusik
  baroque: { decay: 3, accent: [1, 0.5, 0.7, 0.5], spinRate: 0.1 }, classicalera: { decay: 2.4 },
  romantic: { decay: 1.8, beams: 0.4, spot: "aurora", spinRate: 0.06 }, opera: { decay: 2, spot: "top", beams: 0.5 },
  choral: { decay: 1.6, spot: "aurora", spinRate: 0.05 }, chamber: { decay: 2, beams: 0.2 },
  orchestral: { decay: 2.2, beams: 0.5, spot: "aurora", spinRate: 0.1, height: 1.3, pulse: 0.05 },
  minimalism: { decay: 2.8, accent: [1, 0.6, 0.8, 0.6], spot: "scan", spinRate: 0.05 },
  contemporary: { decay: 2.4, spot: "scan", tint: "cool", spinRate: 0.06, beams: 0.3 }, gamemusic: { spot: "scan", spinRate: 0.2, sparks: 14 },
  // Ruhig
  downtempo: { decay: 3, beams: 0.4, spot: "aurora", tint: "cool", spinRate: 0.1 },
  triphop: { decay: 3.5, accent: [1, 0.3, 0.9, 0.4], spot: "floor", spinRate: 0.06, bottom: true }, easylistening: { decay: 2.6, spot: "soft" },
  newage: { decay: 1.4, tint: "jungle" }, meditation: { decay: 1, spinRate: 0.03, sparks: 1 },
  sleep: { decay: 0.8, beams: 0.1, spinRate: 0.02, pulse: 0.01, sparks: 1 },
  // Experimentell
  experimental: { decay: 4, accent: [1, 0.7, 0.5, 0.9], spot: "scan", spinRate: 0.12, beams: 0.5, sparks: 6 },
  idm: { decay: 8, accent: [1, 0.6, 0.9, 0.8], spot: "scan", tint: "cool", spinRate: 0.3, shake: 2 },
  industrial: { decay: 9, flashOn: "back", accent: [0.8, 1, 0.8, 1], spot: "top", shake: 7 },
  noise: { decay: 13, spot: "scan", tint: "cool", shake: 10, sparks: 8 }, darkambient: { tint: "hot", decay: 1 },
  // Kinder, Feiertage & Gesprochenes
  halloween: { tint: "hot", spot: "scan", decay: 5, sparks: 12, flashOn: "down" },
  kids: { decay: 5, tint: "pink", spot: "pan", spinRate: 0.25, sparks: 26, flashOn: "down" }, disney: { sparks: 26 },
  comedy: { decay: 3, flashOn: "", spot: "top", tint: "warm", spinRate: 0.05, beams: 0.2, sparks: 4 },
  spoken: { decay: 1.5, beams: 0.05, flashOn: "", spot: "soft", spinRate: 0.02, pulse: 0.01, sparks: 0, height: 1 },
  // Untergenres, die der Test mit 181 echten Spotify-Genres ohne eigenes Profil fand (Breakcore landete bei Rock)
  breakcore: { decay: 13, accent: [1, 0.7, 1, 0.85], spot: "scan", shake: 8, spinRate: 0.75, sparks: 10 },
  deeptech: { decay: 6, spot: "floor", tint: "cool", spinRate: 0.25, beams: 0.8 },
  uptempo: { decay: 14, accent: [1, 1, 1, 1], spot: "cross", shake: 10, spinRate: 0.9 },
  hyphy: { decay: 8, spot: "pan", tint: "gold", shake: 6, sparks: 14 }, jerk: { decay: 9, tint: "pink", spinRate: 0.5, shake: 4, sparks: 12 },
  streetpunk: { decay: 10, spot: "top", tint: "hot", shake: 6 }, riotgrrrl: { decay: 10, spot: "cross", tint: "pink", shake: 6, sparks: 14 },
  slowcore: { decay: 2.5, beams: 0.5, spot: "soft", spinRate: 0.1, sparks: 3 },
  bhojpuri: { decay: 8, tint: "hot", spinRate: 0.45, sparks: 16 },
  cuarteto: { decay: 8, spot: "disco", tint: "warm", sparks: 16 }, mambo: { spot: "pan", tint: "gold", sparks: 14 },
  tecnobrega: { decay: 9, spot: "disco", tint: "pink", spinRate: 0.55, sparks: 18 }, champeta: { spot: "pan", tint: "jungle", sparks: 12 },
  shatta: { decay: 8, spot: "floor", tint: "hot", shake: 5 }, ragga: { decay: 7, tint: "jungle", shake: 5, bottom: true },
  juju: { decay: 4, spot: "pan", tint: "gold", spinRate: 0.25 },
  mbalax: { decay: 10, accent: [1, 0.6, 0.95, 0.7], tint: "warm", spinRate: 0.5, sparks: 14 },
  dungeonsynth: { decay: 2, beams: 0.4, spot: "aurora", tint: "cool", spinRate: 0.08, sparks: 2 },
};

// Für die Auswahl in den Einstellungen und die Tabelle im README: nach Musikfamilie geordnet
const FAMILIES = {
  electronic: ["rave", "edm", "electrohouse", "progressivehouse", "futurehouse", "house", "deephouse", "tropicalhouse", "techhouse", "basshouse", "acidhouse", "chicagohouse", "frenchhouse", "nudisco", "garage", "jerseyclub", "techno", "minimal", "detroittechno", "dubtechno", "melodictechno", "hardtechno", "ebm", "trance", "progressivetrance", "upliftingtrance", "psytrance", "dnb", "liquiddnb", "neurofunk", "jungle", "breakbeat", "footwork", "electro", "dubstep", "festivaltrap", "futurebass", "moombahton", "hardstyle", "gabber", "happyhardcore", "eurodance", "eurobeat", "handsup", "italodisco", "synthwave", "darksynth", "vaporwave", "hyperpop", "chiptune", "electroswing", "breakcore", "deeptech", "uptempo"],
  urban: ["bass", "boombap", "gangsta", "gfunk", "southern", "alternativehiphop", "trap", "poprap", "cloudrap", "drill", "phonk", "ukhiphop", "grime", "deutschrap", "frenchrap", "italianrap", "spanishrap", "russianrap", "turkishrap", "arabrap", "brazilianhiphop", "rnb", "altrnb", "newjackswing", "soul", "neosoul", "northernsoul", "funk", "hyphy", "jerk"],
  rock: ["rock", "classicrock", "rocknroll", "hardrock", "glamrock", "bluesrock", "southernrock", "psychrock", "stonerrock", "progrock", "krautrock", "surfrock", "garagerock", "alternative", "grunge", "indie", "britpop", "shoegaze", "postpunk", "postrock", "folkrock", "softrock", "deutschrock", "punk", "poppunk", "hardcorepunk", "posthardcore", "emo", "streetpunk", "riotgrrrl", "slowcore"],
  metal: ["metal", "heavymetal", "thrash", "glammetal", "powermetal", "symphonicmetal", "progmetal", "doom", "deathmetal", "blackmetal", "grindcore", "groovemetal", "metalcore", "deathcore", "numetal", "industrialmetal", "folkmetal"],
  pop: ["pop", "dancepop", "electropop", "synthpop", "teenpop", "poprock", "indiepop", "artpop", "disco", "ballad", "musical"],
  asia: ["kpop", "kindie", "krock", "khiphop", "krnb", "trot", "jpop", "jrock", "jhiphop", "anime", "vocaloid", "citypop", "shibuyakei", "enka", "japantrad", "cpop", "mandopop", "cantopop", "chinesehiphop", "chinesetrad", "tpop", "lukthung", "vpop", "opm", "dangdut", "gamelan", "bollywood", "kollywood", "punjabi", "desihiphop", "hindustani", "carnatic", "qawwali", "bhojpuri"],
  latin: ["latin", "latinpop", "reggaeton", "latintrap", "dembow", "bachata", "merengue", "salsa", "son", "bolero", "cumbia", "vallenato", "tango", "mariachi", "regionalmexican", "banda", "norteno", "corridos", "latinrock", "andean", "brazil", "samba", "pagode", "axe", "forro", "sertanejo", "funkcarioca", "mpb", "bossa", "cuarteto", "mambo", "tecnobrega", "champeta"],
  africa: ["afro", "afrobeat", "highlife", "amapiano", "gqom", "afrohouse", "bongo", "soukous", "kuduro", "kizomba", "desertblues", "reggae", "rootsreggae", "dub", "rocksteady", "ska", "dancehall", "soca", "calypso", "zouk", "kompa", "shatta", "ragga", "juju", "mbalax"],
  mideast: ["arabic", "arabicpop", "khaleeji", "tarab", "rai", "gnawa", "dabke", "mahraganat", "turkishpop", "arabesk", "anatolianrock", "persianpop", "persiantrad", "mizrahi"],
  europe: ["schlager", "partyschlager", "volksmusik", "polka", "karneval", "deutschpop", "chanson", "canzone", "europop", "discopolo", "russianpop", "greek", "fado", "flamenco", "balkan", "turbofolk", "klezmer", "celtic", "nordicfolk"],
  country: ["country", "classiccountry", "countrypop", "countryrock", "americana", "bluegrass", "cajun", "folk", "indiefolk", "acoustic"],
  jazz: ["jazz", "dixieland", "swing", "bebop", "cooljazz", "spiritualjazz", "freejazz", "vocaljazz", "latinjazz", "gypsyjazz", "fusion", "acidjazz", "nujazz", "smoothjazz", "blues", "deltablues", "chicagoblues"],
  spirit: ["gospel", "ccm", "worship", "christianrock", "christianhiphop", "bhajan", "nasheed"],
  classical: ["classical", "baroque", "classicalera", "romantic", "opera", "choral", "chamber", "orchestral", "minimalism", "contemporary", "cinematic", "gamemusic"],
  calm: ["chill", "lofi", "downtempo", "triphop", "easylistening", "ambient", "newage", "meditation", "sleep", "neoclassical"],
  experimental: ["experimental", "idm", "industrial", "noise", "darkambient", "dungeonsynth"],
  misc: ["christmas", "halloween", "kids", "disney", "comedy", "spoken"],
};

// Genaue Spielarten. Je Genre-Text gewinnt der LÄNGSTE Treffer aller Regeln („latin trap“ schlägt „trap“,
// „deep house“ schlägt „house“), bei Gleichstand die frühere – darum stehen die neueren, genaueren Regeln vorn.
// Die dritte Zahl verschiebt den Treffer: reine Regionalwörter („greek“, „egyptian“) zählen 10 weniger, damit mit
// einem echten Genre-Wort daneben („greek metal“, „romanian house“) das Genre gewinnt.
const RULES = [
  // Elektronisch
  ["electrohouse", /electro house|complextro|fidget house|dutch house/],
  ["progressivehouse", /progressive house/],
  ["futurehouse", /future house|slap house|brazilian bass|deep bass/],
  ["tropicalhouse", /tropical house/],
  ["basshouse", /bass house|g-house|bassline house/],
  ["acidhouse", /acid house/],
  ["chicagohouse", /chicago house|classic house|jackin house|vocal house|garage house/],
  ["frenchhouse", /french house|filter house|french touch/],
  ["nudisco", /nu[- ]?disco|disco house|indie disco|space disco|cosmic disco/],
  ["jerseyclub", /jersey club|baltimore club|philly club|jersey drill/],
  ["minimal", /minimal techno|minimal house|microhouse|tech minimal|minimal\b/],
  ["detroittechno", /detroit techno/],
  ["detroittechno", /detroit/, -10],
  ["dubtechno", /dub techno|dub house/],
  ["ebm", /\bebm\b|electronic body|aggrotech|futurepop|industrial dance|electro-industrial/],
  ["progressivetrance", /progressive trance/],
  ["upliftingtrance", /uplifting trance|vocal trance|epic trance|euphoric trance/],
  ["liquiddnb", /liquid drum (?:and|&|n) bass|liquid funk|liquid dnb/],
  ["neurofunk", /neurofunk|\bneuro\b/],
  ["jungle", /ragga jungle|\bjungle\b/],
  ["footwork", /footwork|\bjuke\b/],
  ["electro", /^electro$|electro-funk|electro funk|miami bass|\bfreestyle\b/],
  ["festivaltrap", /festival trap|hybrid trap|edm trap|trap edm/],
  ["moombahton", /moombah(?:ton|core)?/],
  ["gabber", /hardcore techno|early hardcore|gabber|frenchcore/],
  ["happyhardcore", /happy hardcore|uk hardcore|happy gabber/],
  ["eurobeat", /eurobeat|para ?para/],
  ["handsup", /hands ?up/],
  ["italodisco", /italo[- ]disco|italo dance|\bitalo\b/],
  ["darksynth", /darksynth|dark synth|cyberpunk|horror synth/],
  ["vaporwave", /vaporwave|future funk|mallsoft|seapunk/],
  ["chiptune", /chiptune|chip ?music|8-?bit|bitpop|nintendocore/],
  // Hip-Hop & R&B
  ["gangsta", /gangsta|gangster rap|hardcore hip[- ]?hop|hardcore rap|horrorcore/],
  ["gfunk", /west coast (?:hip[- ]?hop|rap)|\bg[- ]?funk|chicano rap|lowrider/],
  ["gfunk", /west coast/, -10],
  ["southern", /southern hip[- ]?hop|dirty south|chopped and screwed|memphis (?:hip[- ]?hop|rap)|houston rap|atl hip[- ]?hop|crunk/],
  ["alternativehiphop", /alternative (?:hip[- ]?hop|rap)|underground (?:hip[- ]?hop|rap)|experimental hip[- ]?hop|psychedelic hip[- ]?hop|abstract hip[- ]?hop|indie hip[- ]?hop|art rap/],
  ["poprap", /melodic trap|melodic rap|pop rap|hip pop/],
  ["ukhiphop", /british hip[- ]?hop|uk hip[- ]?hop|uk rap|uk trap|road rap|afroswing/],
  ["grime", /grime/],
  ["deutschrap", /german (?:hip[- ]?hop|rap|trap|drill)|deutscher? hip[- ]?hop|deutsch ?rap/],
  ["frenchrap", /french (?:hip[- ]?hop|rap|trap|drill)|rap fran[cç]ais|rap conscient|rap marseillais|rap belge|pop urbaine/],
  ["italianrap", /italian (?:hip[- ]?hop|rap|trap|drill)|rap italiano|trap italiana/],
  ["spanishrap", /spanish (?:hip[- ]?hop|rap|trap|drill)|rap espa[nñ]ol|trap espa[nñ]ol/],
  ["russianrap", /russian (?:hip[- ]?hop|rap|trap|drill|cloud rap)|russkiy rep/],
  ["turkishrap", /turkish hip-hop\/rap|turkish (?:hip[- ]?hop|rap|trap|drill)|t[uü]rk[cç]e rap/],
  ["arabrap", /(?:arabic|arab|maghreb|moroccan|algerian|egyptian|tunisian) (?:hip[- ]?hop|rap|trap|drill)|rap (?:dz|marocain|tunisien)/],
  ["brazilianhiphop", /brazilian (?:hip[- ]?hop|rap|trap|drill)|trap brasileiro|rap brasileiro|rap nacional/],
  ["altrnb", /alternative r&b|bedroom r&b|indie r&b|dark r&b|alt r&b|trap ?soul/],
  ["newjackswing", /new jack swing|new jack/],
  ["neosoul", /neo[- ]?soul|nu soul/],
  ["northernsoul", /northern soul|classic soul|southern soul|memphis soul|chicago soul|philly soul|deep soul|motown/],
  ["funk", /funk rock|funk soul|p-?funk|\bfunk\b|go-?go\b|boogie\b/],
  // Rock
  ["classicrock", /classic rock|album rock|heartland rock|roots rock|mellow gold|dad rock/],
  ["rocknroll", /rock (?:and|&) roll|rock ?'?n'? ?roll|rockabilly|psychobilly|doo[- ]?wop|early rock/],
  ["glamrock", /glam rock|glam punk|\bglam\b/],
  ["bluesrock", /blues[- ]rock|boogie rock|jam bands?/],
  ["southernrock", /southern rock|swamp rock/],
  ["psychrock", /psychedelic rock|neo-psychedelia|psychedelia|psych rock|acid rock|space rock|psychedelic|\bpsych\b/],
  ["stonerrock", /stoner rock|desert rock|heavy psych|fuzz rock/],
  ["progrock", /progressive rock|symphonic rock|prog-rock|prog rock|art rock|neo-prog|canterbury|\bprog\b/],
  ["krautrock", /krautrock|kosmische|motorik/],
  ["surfrock", /surf rock|surf music|surf punk/],
  ["surfrock", /\bsurf\b/, -10],
  ["garagerock", /garage rock|garage punk|garage revival|proto-?punk/],
  ["grunge", /post-grunge|grunge/],
  ["britpop", /britpop|brit-?pop|madchester|uk indie|britrock|baggy/],
  ["shoegaze", /ethereal wave|dream pop|dreampop|shoegaze|nu gaze/],
  ["postpunk", /post-?punk|gothic rock|minimal wave|darkwave|coldwave|deathrock|\bgoth\b/],
  ["folkrock", /folk[- ]rock|celtic rock/],
  ["softrock", /adult contemporary|soft rock|yacht rock|\baor\b/],
  ["deutschrock", /deutsch ?rock|german rock/],
  ["poppunk", /pop[- ]punk|easycore/],
  ["hardcorepunk", /hardcore punk|straight edge|youth crew|beatdown|\bhardcore\b|\bhxc\b|d-beat/],
  ["posthardcore", /melodic hardcore|post-?hardcore|screamo|swancore/],
  // Metal
  ["heavymetal", /traditional metal|classic metal|heavy metal|nwobhm/],
  ["thrash", /crossover thrash|thrash metal|thrash/],
  ["glammetal", /glam metal|hair metal|sleaze rock|sleaze metal|pop metal/],
  ["powermetal", /power metal|speed metal|epic metal/],
  ["symphonicmetal", /symphonic metal|operatic metal|gothic metal/],
  ["progmetal", /progressive metal|technical metal|prog metal|tech metal|mathcore|djent/],
  ["doom", /funeral doom|stoner metal|drone metal|doom metal|sludge|\bdoom\b/],
  ["deathmetal", /melodic death metal|technical death|old school death|brutal death|death metal|melodeath/],
  ["blackmetal", /atmospheric black|black metal|blackgaze|\bdsbm\b/],
  ["grindcore", /powerviolence|grindcore|goregrind|noisegrind|cybergrind/],
  ["groovemetal", /alternative metal|groove metal|alt metal/],
  ["metalcore", /melodic metalcore|metalcore|trancecore/],
  ["deathcore", /deathcore|\bslam\b/],
  ["numetal", /nu[- ]?metal|rap metal|funk metal|rap rock/],
  ["industrialmetal", /neue deutsche h[aä]rte|industrial metal|industrial rock|tanzmetall|\bndh\b/],
  ["folkmetal", /medieval metal|viking metal|pagan metal|celtic metal|pirate metal|folk metal|mittelalter/],
  // Pop
  ["dancepop", /dance[- ]pop|club pop/],
  ["electropop", /electro[- ]?pop|indietronica|electroclash/],
  ["synthpop", /sophisti-pop|new romantic|synth[- ]?pop|new wave/],
  ["teenpop", /post-teen pop|bubblegum pop|teen pop|boy ?band|girl ?group|bubblegum/],
  ["poprock", /pop\/rock|pop[- ]rock|power pop/],
  ["indiepop", /indie[- ]pop|bedroom pop|jangle pop|\btwee\b/],
  ["artpop", /experimental pop|chamber pop|baroque pop|art[- ]pop|avant-pop/],
  // Asien
  ["kindie", /korean singer-songwriter|korean indie|\bk-?indie\b/],
  ["krock", /korean rock|\bk-?rock\b|\bk-band\b/],
  ["khiphop", /korean (?:hip[- ]?hop|rap|trap)|\bk-?hip[- ]?hop|\bk-?rap\b/],
  ["krnb", /korean r&b|\bk-?r&b|\bk-?rnb\b/],
  ["trot", /ppongjjak|\btrot\b/],
  ["jrock", /japanese rock|japanese metal|kawaii metal|visual kei|\bj-?rock\b|\bj-?metal\b/],
  ["jhiphop", /japanese (?:hip[- ]?hop|rap|trap)|\bj-?hip[- ]?hop|\bj-?rap\b/],
  ["anime", /anisong|\bj-?anime|anime|seiyu/],
  ["vocaloid", /virtual idol|vocaloid|utaite|vtuber/],
  ["citypop", /japanese city pop|city pop/],
  ["shibuyakei", /shibuya-?kei|picopop|shibuya/],
  ["enka", /kay[oō]kyoku|showa kayo|ryukoka|\benka\b/],
  ["japantrad", /japanese traditional|shakuhachi|shamisen|tsugaru|gagaku|min'?y[oō]|hogaku|kagura|taiko|\bkoto\b/],
  ["cpop", /c-?pop (?:boy|girl) group|chinese idol|chinese pop|\bc-?pop\b/],
  ["mandopop", /singaporean mandopop|malaysian mandopop|taiwan(?:ese)? pop|mandarin pop|chinese r&b|chinese indie|chinese ballad|mandopop/],
  ["cantopop", /hong kong pop|cantopop|hk pop/],
  ["cantopop", /cantonese/, -10],
  ["chinesehiphop", /(?:chinese|mandarin|cantonese|taiwan|hong kong) (?:hip[- ]?hop|rap|trap)|\bc-?rap\b/],
  ["chinesetrad", /chinese traditional|chinese classical|chinese instrumental|chinese folk|chinese opera|peking opera|zhongguo feng|guzheng|guofeng|guoyue|\berhu\b|\bpipa\b|\bxiqu\b/],
  ["tpop", /thai pop|thai idol|thai indie|\bt-?pop\b/],
  ["tpop", /\bthai\b/, -10],
  ["lukthung", /thai country|luk thung|luk krung|mor lam|molam|\bisan\b/],
  ["vpop", /vietnamese (?:pop|r&b|indie)|\bv-?pop\b/],
  ["vpop", /vietnamese/, -10],
  ["opm", /original pilipino|\bopm\b|\bp-?pop\b/],
  ["opm", /filipino|tagalog|bisaya|pinoy/, -10],
  ["dangdut", /indonesian pop|malaysian pop|pop indonesia|indo pop|dangdut|koplo/],
  ["dangdut", /indonesian|\bmalay\b/, -10],
  ["gamelan", /kulintang|angklung|balinese|javanese|gamelan|kecak/],
  ["kollywood", /kollywood|tollywood|mollywood|sandalwood|malayalam|kannada|telugu|tamil/],
  ["punjabi", /punjabi|bhangra|haryanvi|desi pop/],
  ["desihiphop", /(?:desi|indian|hindi|punjabi|tamil|urdu|pakistani) (?:hip[- ]?hop|rap|trap|drill)|gully rap/],
  ["hindustani", /hindustani|indian classical|shehnai|bansuri|sarangi|dhrupad|khayal|thumri|sitar|sarod|tabla|\bragas?\b/],
  ["carnatic", /nadaswaram|mridangam|carnatic|veena/],
  ["qawwali", /qawwali|ghazals?|\bsufi\b/],
  // Lateinamerika
  ["latinpop", /latin viral pop|latin dance pop|pop en espa[nñ]ol|pop espa[nñ]ol|pop (?:argentino|chileno|colombiano|peruano|mexicano|latino)|spanish pop|mexican pop|latin pop/],
  ["latintrap", /trap (?:latino|argentino|chileno|colombiano|mexicano|mexa|boricua|dominicano|venezolano|peruano)|(?:latin|argentine|chilean|colombian|mexican|puerto rican) (?:hip[- ]?hop|rap|trap)|rap latino|latin trap/],
  ["dembow", /dominican (?:dembow|urban)|cachengue|guaracha|dembow|\brkt\b/],
  ["bachata", /bachata/],
  ["merengue", /perico ripiao|mambo dominicano|merengue/],
  ["son", /son (?:cubano|jarocho|huasteco)|nueva trova|danz[oó]n|changui|guajira|timba|\btrova\b|\bson\b|cha-?cha/],
  ["son", /cubana?/, -10],
  ["bolero", /baladas y boleros|trio rom[aá]ntico|latin ballad|romantica|baladas?|bolero/],
  ["cumbia", /cumbia (?:villera|sonidera|pop)|tecnocumbia|sonidero|cumbia|chicha/],
  ["vallenato", /vallenato/],
  ["tango", /electrotango|nuevo tango|tango nuevo|milonga|tango/],
  ["mariachi", /mariachi|ranchera|ranchero|huapango|charro/],
  ["regionalmexican", /regional mexican[oa]?|m[uú]sica mexicana|musica regional|duranguense|grupero|grupera/],
  ["regionalmexican", /mexican/, -10],
  ["banda", /banda sinaloense|technobanda|quebradita|tambora|\bbanda\b/],
  ["norteno", /norte[nñ]o|tex-?mex|tejano|conjunto/],
  ["corridos", /corridos tumbados|corridos b[eé]licos|sierre[nñ]o|b[eé]licos?|corridos?|requinto/],
  ["latinrock", /alternativo (?:&|y) rock latino|rock en espa[nñ]ol|rock (?:latino|argentino|nacional|mexicano|chileno|colombiano|alternativo|espa[nñ]ol)|(?:mexican|argentine|chilean|colombian|peruvian|spanish) rock|latin alternative|latin rock/],
  ["andean", /folklore argentino|nueva canci[oó]n|musica andina|chacarera|charango|andean|huayno|ra[ií]ces|\bzamba\b|\bcueca\b|(?:chilean|peruvian|bolivian) folk/],
  ["samba", /escola de samba|samba de roda|samba-enredo|partido alto|batucada|\bsamba\b/],
  ["pagode", /pagod[aã]o|pagode/],
  ["axe", /samba-reggae|\bax[eé](?![a-z])|frevo/],
  ["forro", /pisadinha|piseiro|forr[oó]|bai[aã]o|xaxado|\bxote\b/],
  ["sertanejo", /sertanej[ao](?: universit[aá]rio)?|moda de viola|agronejo|arrocha|mod[aã]o/],
  ["funkcarioca", /funk (?:carioca|brasileiro|mandel[aã]o|paulista|ostentac[aã]o|150|mtg|rj|bh|melody|consciente)|brazilian funk|brega funk|baile funk|rasteirinha|\bmtg\b/],
  ["mpb", /m[uú]sica popular brasileira|brazilian singer-songwriter|clube da esquina|tropic[aá]lia|tropicalismo|nova mpb|\bmpb\b/],
  ["bossa", /brazilian jazz|bossa ?nova|samba-jazz|\bbossa\b/],
  // Afrika & Karibik
  ["afrobeat", /afrobeat(?!s)|ethio-?jazz|afro-?funk|afro-?jazz/],
  ["afrobeat", /ethiopian/, -10],
  ["highlife", /palm-?wine|highlife|hiplife|azonto/],
  ["gqom", /afro tech|sgubhu|gqom/],
  ["afrohouse", /south african house|afro[- ]house|afro deep|kwaito|3-?step/],
  ["bongo", /bongo flava|gengetone|singeli|\bbongo\b/],
  ["bongo", /tanzanian|swahili|ugandan|kenyan/, -10],
  ["soukous", /rumba congolaise|congolese rumba|coup[eé][- ]d[eé]cal[eé]|ndombolo|soukous|makossa|zouglou|lingala/],
  ["soukous", /congolese/, -10],
  ["kuduro", /afro-?portuguese|kuduro|tarraxo|\bbatida\b/],
  ["kizomba", /tarraxinha|ghetto zouk|urban kiz|kizomba|funan[aá]|semba|\bmorna\b/],
  ["kizomba", /cape verdean|cabo verde/, -10],
  ["desertblues", /tishoumaren|desert blues|wassoulou|assouf|tuareg|\bgriot\b|\bkora\b/],
  ["desertblues", /malian|\bmande\b/, -10],
  ["rootsreggae", /conscious reggae|roots reggae|reggae roots|lovers rock|nyabinghi|\brasta\b/],
  ["dub", /dub reggae|dubwise|steppers|uk dub|\bdub\b/],
  ["rocksteady", /early reggae|rocksteady/],
  ["soca", /groovy soca|power soca|chutney|bouyon|soca/],
  ["calypso", /steel ?band|steel ?pan|steel drum|calypso|kaiso|mento/],
  ["zouk", /zouk b[eé]ton|zouk love|antillean|biguine|gwoka|\bzouk\b/],
  ["kompa", /twoubadou|compas|kompa|konpa|\brasin\b/],
  ["kompa", /haitian/, -10],
  // Naher Osten & Nordafrika
  ["arabicpop", /(?:arab|arabic|lebanese|egyptian|iraqi|syrian|jordanian) pop|arabic (?:r&b|indie)/],
  ["khaleeji", /khaleeji|khaliji/],
  ["khaleeji", /bahraini|emirati|kuwaiti|qatari|yemeni|saudi|\bgulf\b/, -10],
  ["tarab", /andalusian classical|egyptian classical|arabic traditional|arabic classical|muwashshah|\btarab\b|\bmaqam\b|\boud\b|\bqanun\b|\btakht\b/],
  ["rai", /wahrani|\bra[iï](?![a-z])/],
  ["rai", /algerian/, -10],
  ["gnawa", /ahidous|chaabi|gnawa|gnaoua/],
  ["gnawa", /moroccan|amazigh|berber/, -10],
  ["dabke", /dabke|dabka/],
  ["dabke", /palestinian|levantine|jordanian|lebanese|syrian|iraqi|levant/, -10],
  ["mahraganat", /electro (?:chaabi|sha'?abi)|egyptian shaabi|mahraganat|mahragan|sha'?abi/],
  ["mahraganat", /egyptian/, -10],
  ["turkishpop", /t[uü]rk alternatif|turkish alternative|turkish dance|turkish pop|t[uü]rk(?:ce)? pop/],
  ["arabesk", /sanat m[uü]zi[gğ]i|halk m[uü]zi[gğ]i|turkish classical|anatolian folk|turkish folk|turkish sanat|t[uü]rk halk|arabesque|ba[gğ]lama|arabesk|fantezi|\bsaz\b|t[uü]rk[uü](?![a-z])/],
  ["arabesk", /azerbaijani|kurdish|azeri/, -10],
  ["anatolianrock", /anatolian rock|turkish psych|turkish rock|anadolu rock|t[uü]rk rock/],
  ["persianpop", /los angeles persian|iranian pop|persian pop|tehrangeles|iranian|persian|farsi/],
  ["persianpop", /afghan/, -10],
  ["persiantrad", /persian (?:classical|traditional)|iranian (?:classical|traditional)|kamancheh|dastgah|santur|setar|tombak|radif/],
  ["mizrahi", /jewish pop|yemenite|mizrahi/],
  ["mizrahi", /israeli|hebrew/, -10],
  // Europa
  ["partyschlager", /stimmungsmusik|partyschlager|party schlager|apr[eè]s[- ]?ski|oktoberfest|ballermann|mallorca|fox ?party|\bwiesn\b|\bmalle\b/],
  ["volksmusik", /alpenl[aä]ndisch|volkst[uü]mlich|heimatklang|oberkrainer|german folk|volksmusik|volkslied|blasmusik|l[aä]ndler|zither|jodel|yodel/],
  ["volksmusik", /bayerisch|bavarian|alpine|tirol/, -10],
  ["polka", /military band|marching band|blasorchester|blaskapelle|dechovka|fanfare|oompah|humppa|polka/],
  ["karneval", /carnavalskraker|levenslied|fastnacht|k[oö]lsche?|smartlap|karneval|carnaval|fasching/],
  ["deutschpop", /german singer-songwriter|neue deutsche welle|deutscher pop|deutsch ?pop|german pop|liedermacher|\bndw\b/],
  ["chanson", /vari[eé]t[eé] fran[cç]aise|french singer-songwriter|nouvelle chanson|french indie pop|vari[eé]t[eé]|french pop|chanson|musette/],
  ["canzone", /italian singer-songwriter|italian adult pop|pop in italiano|musica leggera|italian indie|italian pop|pop italiano|cantautor[ei]|neomelodic|napoletana|neapolitan|canzone|sanremo/],
  ["europop", /(?:swedish|norwegian|danish|finnish|nordic|dutch|belgian|icelandic) pop|melodifestivalen|eurovision|scandipop|euro ?pop/],
  ["discopolo", /disco[- ]polo|polish dance/],
  ["russianpop", /(?:russian|ukrainian|belarusian) (?:pop|dance|indie)|russian chanson|russian romance|blatnyak|estrada|\bbard\b/],
  ["greek", /zeibekiko|skyladiko|nisiotika|la[iï]k[oó]|rebetiko|entechno|bouzouki|sirtaki/],
  ["greek", /cretan|greek/, -10],
  ["fado", /guitarra portuguesa|\bfado\b/],
  ["fado", /portuguese/, -10],
  ["turbofolk", /novokomponovana|turbo ?folk|sevdalinka|narodna|sevdah|chalga|manele|yu-?pop/],
  ["turbofolk", /montenegrin|macedonian|bulgarian|romanian|albanian|croatian|serbian|bosnian/, -10],
  ["klezmer", /jewish (?:folk|music)|freilach|klezmer|yiddish/],
  ["nordicfolk", /(?:scandinavian|swedish|norwegian|finnish|danish|icelandic) folk|nordic folk|nyckelharpa|hardanger|kantele|joik|yoik/],
  ["nordicfolk", /viking|nordic|norse|\bsami\b/, -10],
  // Country & Folk
  ["classiccountry", /traditional country|truck-driving|nashville sound|outlaw country|classic country|country gospel|western swing|urban cowboy|honky ?tonk|bakersfield|cowboy/],
  ["classiccountry", /\bwestern\b/, -10],
  ["countrypop", /contemporary country|modern country|country pop|pop country|country dawn|country road|bro-?country/],
  ["countryrock", /southern country|texas country|country rock|outlaw rock|red dirt/],
  ["americana", /alternative country|insurgent country|gothic americana|cosmic country|alt-?country|americana/],
  ["bluegrass", /progressive bluegrass|mountain music|appalachian|string band|bluegrass|newgrass|old-?time|\bbanjo\b/],
  ["cajun", /swamp pop|louisiana|zydeco|cajun|creole/],
  ["folk", /traditional folk|contemporary folk|american folk|british folk|folk revival|protest song|anti-?folk|freak folk|psych folk|dark folk|folklore|neofolk|\bfolk\b/],
  ["indiefolk", /stomp and holler|new americana|chamber folk|indie folk|folk[- ]pop/],
  // Jazz & Blues
  ["dixieland", /new orleans (?:jazz|brass)|boogie[- ]woogie|traditional jazz|second line|brass band|dixieland|early jazz|trad jazz|hot jazz|ragtime|\bstride\b/],
  ["swing", /swing revival|neo-swing|jump blues|lindy hop|big band|\bswing\b|\bjive\b/],
  ["bebop", /straight-ahead jazz|mainstream jazz|post-?bop|hard bop|bebop|\bbop\b/],
  ["cooljazz", /west coast jazz|chamber jazz|third stream|cool jazz/],
  ["spiritualjazz", /spiritual jazz|cosmic jazz|astral jazz|modal jazz/],
  ["freejazz", /free improvisation|avant-?garde jazz|creative music|avant-jazz|free jazz/],
  ["vocaljazz", /great american songbook|adult standards|traditional pop|jazz standards?|lounge singer|vocal jazz|jazz vocal|torch song|crooner/],
  ["latinjazz", /afro-?cuban jazz|jazz latino|salsa jazz|latin jazz|bossa jazz|cubop/],
  ["gypsyjazz", /jazz manouche|gypsy jazz|manouche/],
  ["fusion", /contemporary jazz|crossover jazz|jazz fusion|jazz[- ]?funk|jazz[- ]?rock|fusion/],
  ["acidjazz", /acid jazz|jazz house|jazz dance/],
  ["nujazz", /jazz electronica|future jazz|broken beat|electro-jazz|jazztronica|london jazz|nu[- ]jazz|uk jazz/],
  ["smoothjazz", /smooth saxophone|smooth jazz|smooth soul|quiet storm/],
  ["deltablues", /hill country blues|traditional blues|piedmont blues|acoustic blues|country blues|classic blues|pre-war blues|delta blues/],
  ["chicagoblues", /contemporary blues|electric blues|chicago blues|british blues|modern blues|blues revival|texas blues|soul blues/],
  // Gospel & Spirituelles
  ["ccm", /contemporary christian|christian (?:pop|music|indie)|christian|\bccm\b/],
  ["worship", /praise (?:&|and) worship|adoraci[oó]n|adora[cç][aã]o|alabanza|lobpreis|worship|louvor|praise/],
  ["christianrock", /christian (?:alternative rock|alternative|rock|metal|metalcore|deathcore|punk|hardcore)/],
  ["christianhiphop", /christian (?:hip[- ]?hop|rap|trap|drill)|holy hip[- ]?hop|gospel rap|\bchh\b/],
  ["bhajan", /devotional|gurbani|bhajan|kirtan|bhakti|mantra|shabad|aarti/],
  ["nasheed", /anasheed|nasheed|islamic|nasyid|qasida|madih|\bquran\b|\bna'?at\b|\bhamd\b/],
  // Klassik & Filmmusik
  ["baroque", /early music|harpsichord|renaissance|baroque|medieval|consort|\blute\b/],
  ["classicalera", /viennese classic|classical period|classical era|classicism|\bgalant\b/],
  ["romantic", /late romantic|post-romantic|romantic period|romantic era|romanticism|impressionis[mt]/],
  ["opera", /operetta|operette|zarzuela|bel canto|singspiel|art song|verismo|lieder|opera|\barias?\b/],
  ["choral", /a cappella|gregorian|acapella|chorale|requiem|choral|sacred|motet|choir|chant|hymns?|\bmass\b/],
  ["chamber", /chamber orchestra|chamber ensemble|string quartet|chamber music|piano trio|\bchamber\b/],
  ["orchestral", /philharmonic|orchestral|orchestra|symphonic|symphony|concerto/],
  ["minimalism", /systems music|post-minimal|minimalism|minimalist/],
  ["contemporary", /avant-garde classical|(?:20th|21st) century classical|contemporary classical|modern composition|modern era|neue musik|serialism|new music|atonal|spectral/],
  ["gamemusic", /game soundtrack|video game|game music|nintendo|gaming|\bvgm\b/],
  // Ruhig
  ["downtempo", /caf[eé] del mar|chill house|downtempo|chill-?out|chillwave|balearic|nu-?lounge/],
  ["triphop", /bristol sound|trip[- ]?hop|illbient/],
  ["easylistening", /easy listening|space age pop|orchestral pop|beautiful music|bossa lounge|light music|mood music|elevator|exotica|lounge|muzak/],
  ["newage", /native american flute|celtic new age|environmental|relaxation|relaxing|new age|wellness|healing|nature|reiki|\bspa\b/],
  ["meditation", /singing bowls?|tibetan bowl|mindfulness|meditation|meditative|sound bath|solfeggio|binaural|chakra|\byoga\b|\bzen\b|\d+ ?hz\b/],
  ["sleep", /nature sounds|ocean sounds|white noise|brown noise|pink noise|rain sounds|wiegenlied|schlaflied|lullab(?:y|ies)|baby sleep|sleep|asmr/],
  // Experimentell
  ["experimental", /deconstructed club|musique concr[eè]te|electro-?acoustic|field recordings?|plunderphonics|sound collage|experimental|avant-?garde|tape music|sound art/],
  ["idm", /clicks (?:&|and) cuts|intelligent dance|idm\/experimental|drill and bass|braindance|microsound|glitch(?: hop)?|\bwonky\b|\bidm\b/],
  ["industrial", /martial industrial|power electronics|death industrial|post-industrial|rhythmic noise|\bindustrial\b/],
  ["noise", /harsh noise|noise rock|noise pop|japanoise|noisecore|no wave|\bnoise\b/],
  ["darkambient", /ritual ambient|drone ambient|dark ambient|doom ambient|isolationism|\bdrone\b/],
  // Kinder, Feiertage & Gesprochenes
  ["halloween", /horror (?:soundtrack|score)|halloween|spooky|scary/],
  ["kids", /canciones infantiles|musique pour enfants|children'?s music|children'?s|kinderlieder|kindermusik|kinderlied|kinderen|preschool|sing-?along|cocomelon|comptines|infantil|nursery|toddler|kinder|\bkids\b|\bbaby\b/],
  ["disney", /children'?s film|soundtrack infantil|movie musical|family film|kids movie|dreamworks|disney|pixar/],
  ["comedy", /stand-?up|spa[sß]lied|kabarett|comedic|novelty|parody|comedy|funny|humou?r/],
  ["spoken", /talk (?:radio|show)|spoken word|audio ?drama|radio drama|audiobooks?|audiolibro|storytelling|h(?:[oö]|oe)rspiel|h(?:[oö]|oe)rbuch|podcasts?|poetry|poesie|lecture|interview|readings?|\bspeech\b|\btalk\b/],
  // bestehende Stile: Genre-Namen, die vorher keine eigene Regel hatten
  ["kpop", /k-?pop (?:boy|girl) group|korean idol|korean pop/],
  ["jpop", /j-?pop (?:boy|girl) group|japanese singer-songwriter|japanese idol|japanese pop|\bj-?idol\b/],
  ["afro", /nigerian pop|ghanaian pop|afro-?fusion|afro soul|afro r&b|afrobeats|afropop|naija|\balte\b/],
  ["dnb", /jungle\/drum'n'bass|drum'?n'?bass/],
  ["balkan", /balkan brass(?: band)?|gypsy brass|balkan beat/],
  ["ballad", /korean ballad|korean ost|drama ost|power ballad|\bk-?ballad|\bk-?ost\b|\bc-?drama/],
  ["reggaeton", /latin urban/],
  ["musical", /cast recording|movie tunes/],
  ["rnb", /r&b\/soul/],
  ["ska", /ska punk|two-?tone/],
  ["boombap", /old school (?:hip[- ]?hop|rap)|east coast rap|golden age hip[- ]?hop/],
  ["gospel", /christian & gospel|contemporary gospel|traditional gospel|southern gospel|black gospel/],
  ["acoustic", /singer\/songwriter/],
  // Apple-Genres in der Sprache des Landes: Mirage fragt iTunes zuerst im eigenen Land (Testlabor: 1800 Songs aus
  // 30 Ländern – „Klassik“, „Elektronisch“, „ロック“, „流行樂“ … blieben vorher ohne Treffer und wurden Pop)
  ["classical", /klassik|klassiek|cl[aá]sica|classica|classique|crossover classique|klassische crossover|klassieke crossover|クラシック/],
  ["rave", /elektronisch|elektronik|electr[oó]nica|elettronica|[ée]lectronique|エレクトロニック|電子音樂|电子/],
  ["cinematic", /bandas? sonoras?|colonne sonore|filmmusik|bandes? originales?|サウンドトラック|原聲帶|原声/],
  ["chill", /strumentale|instrumentale?|instrumentaal|インストゥルメンタル|m[uú]sica tranquila|musique d'ambiance|entspannung/, -10],
  ["newage", /ニューエイジ|新世紀/],
  ["jrock", /ロック|オルタナティブ|ヴィジュアル系/],
  ["jpop", /ポップ|歌謡曲|j-?pop/],
  ["anime", /アニメ/],
  ["enka", /演歌/],
  ["jhiphop", /ヒップホップ/],
  ["mandopop", /華語流行|华语流行|台灣流行|流行樂|流行乐|國語流行/],
  ["chinesehiphop", /嘻哈|饒舌|说唱/],
  ["rock", /華語搖滾|獨立搖滾|民謠搖滾|搖滾|摇滚/, -2],
  ["alternative", /alternativ[ao]|alternatief/],
  ["afro", /afro[- ]?pop|m[uú]sica africana|musique africaine|afrikanisch/],
  ["afro", /\bafrican\b|\bafrica\b/, -10],
  ["afrobeat", /afro-beat/],
  ["kids", /children['’]s music|enfants|bambini|kinderen/],
  ["indiefolk", /alternative folk|folk alternativo/],
  ["edm", /fitness|workout/],
  ["classicrock", /british invasion/],
  ["vocaljazz", /^vocal$/],
  ["zouk", /antilles|antillais/],
  // FMA-Genres (freie Musik): Avantgarde, Klangcollage, Improvisation, Big Beat, Skweee
  ["experimental", /audio collage|avant-garde|unclassifiable/],
  ["freejazz", /^improv$/],
  ["breakbeat", /bigbeat/],
  ["electro", /skweee/],
  ["rai", /north african/],
  ["kids", /kid-friendly/],
  ["progrock", /^progressive$/],
  // Untergenres aus der vollständigen Genre-Liste (tools/data/genres-all.json), die vorher nichts oder nur die
  // grobe Familie trafen – Breakcore war über „core“ sogar Rock
  ["breakcore", /breakcore|raggacore|mashcore|lolicore|breakgore/],
  ["deeptech", /deep tech\b|deep minimal/],
  ["uptempo", /uptempo(?: hardcore)?|terrorcore|speedcore|extratone|splittercore/],
  ["hyphy", /bay area (?:hip[- ]?hop|rap)|\bmob music|hyphy|thizz/],
  ["jerk", /\bjerk(?:in)?\b|new jerk/],
  ["southern", /new orleans bounce|sissy bounce|\bbounce\b/, -2],
  ["electrohouse", /melbourne bounce|dutch bounce/],
  ["streetpunk", /street punk|skinhead reggae|\boi\b|\boi!/],
  ["riotgrrrl", /riot grrrl|riot girl|queercore|grrrl/],
  ["slowcore", /slowcore|sadcore|slow core/],
  ["bhojpuri", /bhojpuri|chhattisgarhi|maithili|awadhi/],
  ["cuarteto", /cuarteto|cuartetazo/],
  ["mambo", /latin boogaloo|latin soul|cha cha cha|boogaloo|bugal[uú]|pachanga|mambo/],
  ["tecnobrega", /tecno ?brega|tecnomelody|aparelhagem|\bbrega\b/],
  ["champeta", /terapia criolla|champeta/],
  ["shatta", /shatta/],
  ["ragga", /raggamuffin|ragga hip[- ]?hop|\bragga\b/],
  ["juju", /\bj[uù]j[uú]\b|\bfuji\b|\bapala\b|were music/],
  ["juju", /yoruba/, -10],
  ["mbalax", /mbalax|\bsabar\b/],
  ["mbalax", /senegal(?:ese)?|gambian/, -10],
  ["dungeonsynth", /dungeon ?synth|winter synth|comfy synth/],
  ["vaporwave", /slowed (?:and|&|\+) reverb|slowed|reverb/],
  ["hyperpop", /sigilkore|hyperflip|krushclub|tweakcore/],
  ["futurebass", /^wave$|wavecore/],
  ["indie", /hamburger schule/],
  ["progrock", /zeuhl|rock in opposition/],
  ["footwork", /ghettotech|ghetto house|booty house|juke house/],
  ["experimental", /hauntology|onkyokei|\bonkyo\b/],
  ["ambient", /\blowercase\b/],
  ["bass", /nederhop|nederrap/],
  ["salsa", /\bbomba\b|\bplena\b|j[ií]baro/],
  ["dubstep", /bass music|\buk bass\b/],
  ["electropop", /new rave|nu rave/],
  ["europop", /nederpop/],
  ["metalcore", /electronicore|synthcore/],
  ["phonk", /(?:brazilian|russian|drift|house|wave|chill|dark) phonk/],
  ["eurodance", /bubblegum dance/],
  ["folkrock", /medieval rock/],
  // reine Regionalwörter, die vorher als „genaue“ Regel galten und so „brazilian metal“, „scottish rock“ oder
  // „turkish punk“ zu Samba, Celtic und Arabisch machten
  ["brazil", /brazil(?:ian)?|brasil(?:eir[oa])?/, -10],
  ["celtic", /irish|scottish/, -10],
  ["bollywood", /indian/, -10],
  ["turkishpop", /turkish/, -10],
  ["arabic", /middle east(?:ern)?/, -10],
  // Grundwörter ohne eigene Regel: schlagen nur Regionalwörter („romanian rock“ ist Rock, „irish electronic“ elektronisch)
  ["rock", /\brock\b/, -50],
  ["rave", /\belectronic[ao]?\b/, -50],
];
// Genaue Spielarten der ersten Versionen – gelten für Spotify- und Apple-Genres gleichermaßen
const SPECIFIC = [
  // zuerst, was alles andere schlägt: Weihnachtslieder bleiben Weihnachtslieder, egal welches Genre
  ["christmas", /christmas|xmas|holiday|weihnacht|no[eë]l|navidad|natale/],
  ["futurebass", /future bass|kawaii|melodic dubstep|color bass/],
  ["electroswing", /electro ?swing/],
  ["cloudrap", /cloud rap|emo rap|plugg|\brage\b|sad rap/],
  ["amapiano", /amapiano|gqom|kwaito|3-?step/],
  ["dancehall", /dancehall|bashment|soca/],
  ["ska", /\bska\b|ska punk|rocksteady|two-?tone/],
  ["emo", /\bemo\b|pop punk|screamo|midwest emo/],
  ["jpop", /j-?pop|j-?rock|anime|city pop|vocaloid|visual kei|shibuya/],
  ["dubstep", /dubstep|riddim|brostep/],
  ["phonk", /phonk/],
  ["drill", /\bdrill\b/],
  ["reggaeton", /reggaeton|latin trap|trap latino|urbano latino|dembow|perreo/],
  ["trap", /\btrap\b/],
  ["psytrance", /psytrance|psy-trance|\bgoa\b|psychedelic trance|full ?on/],
  ["techhouse", /tech ?house/],
  ["deephouse", /deep house|melodic house|afro house|organic house|tropical house|lo-?fi house/],
  ["garage", /uk garage|\bukg\b|2-?step|speed garage|bassline|grime/],
  ["edm", /\bedm\b|big room|electro house|progressive house|future house|brazilian bass/],
  ["synthwave", /synthwave|retrowave|outrun|darkwave|vaporwave|chillwave|new wave|synth-?pop/],
  ["eurodance", /eurodance|euro ?dance|italo|euro ?house|hands ?up|eurobeat/],
  ["hyperpop", /hyperpop|digicore|glitchcore|nightcore/],
  ["ambient", /ambient|drone|new age|meditation|sleep|healing/],
  ["brazil", /\bsamba\b|pagode|forr[oó]|\bax[eé]\b|baile funk|funk carioca|sertanejo|\bmpb\b|bossa/],
  ["metal", /metal|metalcore|deathcore|djent|thrash|grindcore/],
  ["hardstyle", /hardstyle|hard dance|gabber|rawstyle|hardcore techno/],
  ["dnb", /drum ?(&|and|n'?) ?bass|\bdnb\b|jungle|liquid funk|neurofunk/],
  ["hardtechno", /hard ?techno|schranz|industrial techno|hardgroove|acid techno/],
  ["melodictechno", /melodic techno|afterhours|progressive techno|indie dance|organic techno/],
  ["breakbeat", /breakbeat|\bbreaks\b|big beat|nu skool/],
  ["techno", /techno|minimal|industrial/],
  ["trance", /trance|psytrance|uplifting/],
  ["punk", /punk|post-hardcore|\bemo\b|hardcore/],
  ["kpop", /k-?pop|j-?pop|c-?pop|idol/],
  ["afro", /afrobeat|afro ?pop|afroswing|afro ?fusion/],
  ["house", /house|garage house/],
  ["schlager", /schlager|discofox|ballermann|apr[eè]s|stimmung|volksmusik|volkst[uü]mlich|oktoberfest|deutschpop/],
  ["disco", /disco|funk|boogie/],
  ["gospel", /gospel|worship|christian|\bccm\b|choir|praise/],
  ["boombap", /boom ?bap|old school hip hop|golden age|jazz rap|east coast hip hop|conscious hip hop/],
  ["rnb", /r&b|\brnb\b|neo ?soul|new jack|contemporary r/],
  ["soul", /soul|motown/],
  ["blues", /blues/],
  ["reggae", /reggae|dancehall|\bdub\b|\bska\b/],
  ["salsa", /salsa|bachata|merengue|cumbia|tropical|vallenato|tango|mariachi|ranchera|banda|norte[nñ]o|corrido|regional mexican/],
  ["flamenco", /flamenco|rumba|spanish guitar|sevillanas/],
  ["bollywood", /bollywood|filmi|bhangra|desi|punjabi|tamil|telugu|hindi/],
  ["balkan", /balkan|gypsy|klezmer|turbo ?folk|manele|brass band|polka|čoček|cocek/],
  ["arabic", /arab|khaleeji|\bra[iï]\b|dabke|persian|mizrahi/],
  ["celtic", /celtic|irish (?:folk|trad\w*|pub song)|scottish (?:gaelic )?folk|shant(y|ies)|bagpipe|folk punk|gaelic/],
  ["musical", /musical|show ?tunes|broadway|cabaret|west end/],
  ["latin", /urbano|latin|moombah/],
  ["lofi", /lo-?fi|chillhop|jazzhop|study beats|bedroom beats/],
  ["neoclassical", /neo-?classical|modern classical|contemporary classical|minimalism|solo piano|\bpiano\b/],
  ["postrock", /post-?rock|math rock|instrumental rock/],
  ["cinematic", /soundtrack|\bscore\b|cinematic|\bepic\b|trailer|video game|film/],
  ["classical", /classical|orchestra|opera|baroque/],
  ["jazz", /jazz|swing|bebop/],
  ["hardrock", /hard rock|glam|arena rock|classic rock|heavy rock|southern rock|\baor\b/],
  ["acoustic", /acoustic|singer-songwriter|unplugged|folk pop|stomp and holler/],
  ["ballad", /ballad|soft rock/],
  ["country", /country|americana|bluegrass|folk/],
  ["indie", /indie|bedroom pop|shoegaze|dream pop/],
  ["alternative", /alternative|grunge|post-rock|post-punk|britpop|garage rock/],
  // zuletzt: Regionalwort + Grundgenre („polish trap“, „kenyan hip hop“) → das Grundgenre; zählt 6 weniger,
  // damit ein genaues Wort davor („gangsta rap“, „emo rap“) gewinnt
  ["bass", /[a-z]+ (?:hip[- ]?hop|rap)\b/, -6],
  ["trap", /[a-z]+ trap\b/, -6],
  ["drill", /[a-z]+ drill\b/, -6],
];
// Vorrang: Fest- und Sondertage, Kinder und Gesprochenes schlagen jedes Genre-Wort
const PRIORITY = { christmas: 100, halloween: 100, spoken: 100, kids: 50 };
const ALL = [...RULES, ...SPECIFIC];
// je Genre-Text einmal rechnen: es gibt nur wenige verschiedene, und jeder Song fragt bis zu fünf davon
const memo = new Map();
// Nachschlagetabelle aus der vollständigen Genre-Liste (Spotify ~6 300, MusicBrainz, Apple, Deezer): nur die Namen,
// bei denen die Regeln allein nichts oder nur die grobe Familie finden (tools/genres-map.js baut sie).
// Erst beim ersten Nachschlagen ausgepackt; ein Treffer sieht aus wie eine Regel ohne Muster: [spielart, null]
let lookup = null;
const table = () => {
  if (lookup) return lookup;
  lookup = new Map();
  for (const [k, list] of Object.entries(GENRE_MAP)) {
    const hit = [k, null];
    for (const n of list.split("|")) lookup.set(n, hit);
  }
  return lookup;
};
// ohne Akzente („forró“ → „forro“, „música“ → „musica“): MusicBrainz, Apple und Deezer schreiben sie, die Regeln meist nicht
const fold = (g) => (/[^\x20-\x7e]/.test(g) ? g.normalize("NFD").replace(/[̀-ͯ]/g, "") : g);
const rules = (g) => byRules(g) || (fold(g) !== g ? byRules(fold(g)) : null);
function best(g, rulesOnly = false) {
  if (!g) return null;
  if (rulesOnly) return rules(g);
  if (memo.has(g)) return memo.get(g);
  const hit = table().get(g) || rules(g);
  if (memo.size > 2000) memo.clear();
  memo.set(g, hit);
  return hit;
}
// der längste Treffer aller Regeln (ohne Tabelle – so rechnet auch tools/genres-map.js, was die Tabelle braucht)
function byRules(g) {
  let hit = null, top = -Infinity;
  for (const r of ALL) {
    const m = r[1].exec(g);
    if (!m) continue;
    // reine Regionalwörter (−10 und weniger) zählen nur, wenn sonst nichts passt – auch kein Grundwort (−50)
    const w = r[2] || 0;
    const n = (w <= -10 ? (w <= -50 ? -50 : -100) : w) + m[0].length + (PRIORITY[r[0]] || 0);
    if (n > top) [hit, top] = [r, n];
  }
  return hit;
}
// Reihenfolge zählt: „dance pop“ ist eher Pop als Rave, „pop punk“ eher Rock
const GENRES = [
  ["chill", /lo-?fi|chill|ambient|acoustic|jazz|classical|piano|folk|soul|r&b|rnb|bossa|sleep|meditation|singer-songwriter|soundtrack|orchestra/],
  ["rock", /rock|metal|punk|grunge|core\b|emo|hardcore|garage/],
  ["bass", /hip ?hop|rap|trap|drill|grime|phonk|dancehall|afro|boom bap|gangsta/],
  ["rave", /edm|house|techno|trance|dubstep|drum and bass|dnb|electro|hardstyle|rave|bass music|garage house|big room|psytrance|eurodance/],
  ["pop", /pop|dance|disco|funk|latin|k-pop|schlager|indie/],
];
// Apples Genre des Songs („Alternative“, „Dance“, „Hip-Hop/Rap“ …), wenn keine genaue Regel passt
const APPLE = [
  // R&B vor Soul: „R&B/Soul“ (The Weeknd, SZA) groovt eher wie Pop als dass es chillt
  ["pop", /r&b/],
  ["rave", /dance|electronic|electronica|house|techno|trance|dubstep|drum ?(&|and) ?bass|hardstyle|edm|club/],
  ["bass", /hip-?hop|rap|trap|urbano|reggaeton|dancehall|afro|grime|drill/],
  ["rock", /rock|alternative|metal|punk|grunge|hardcore|emo|indie(?! ?pop)/],
  ["chill", /soul|singer|songwriter|jazz|classical|ambient|soundtrack|folk|acoustic|new age|easy listening|lo-?fi|blues|country|piano|instrumental/],
  ["pop", /pop|schlager|disco|funk|latin|world|weltweit|mundo|monde|wereld|reggae/],
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Profil aus allen Hinweisen: Apple-Genre des Songs (3 Punkte), Deezer-Album-Genre (2, ein bloßes „Pop“ 1),
// Spotify-Genres des Künstlers (2 für das erste, 1 für weitere), Künstler-/Titelwörter („Orchestra“, „Extended Mix“: 1,5)
// und zuletzt der Klang. Die meisten Punkte gewinnen.
// Apple-Genres, die dort etwas anderes meinen als derselbe Name bei Spotify: Apples „Hardcore“ steht unter Dance
// (Gabber, Hardcore Techno), Spotifys „hardcore“ ist Punk
const APPLE_ONLY = { hardcore: "gabber" };
// Deezers Genre-Namen, die keine Regel trifft oder die dort etwas anderes heißen
// (Deezer antwortet in der Sprache des Nutzers – deutsche Namen stehen mit drin. Film-/Spielmusik, Sport, Hörbücher:
// das Genre der Sammlung, nicht des Songs – Testlabor: Pop-Hits auf Soundtrack-Alben wären sonst „Filmmusik“)
const DEEZER_ONLY = {
  "films/games": "", "filme/videospiele": "", filmmusik: "", soundtrack: "", sport: "", "hörbücher auf deutsch": "", "deutsche musik": "", "international pop": "pop",
  "rap/hip hop": "bass", "soul & funk": "soul", "singer & songwriter": "acoustic", "traditional mexicano": "regionalmexican", electro: "edm",
  "asian music": "", "asiatische musik": "", "african music": "afro", "afrikanische musik": "afro", "brazilian music": "brazil", "brasilianische musik": "brazil",
  "indian music": "bollywood", "indische musik": "bollywood", "latin music": "latin", "latin musik": "latin", "lateinamerikanische musik": "latin",
  kids: "kids", kinder: "kids", christian: "ccm", christlich: "ccm", klassik: "classical", "deutsch-rap": "deutschrap", alternative: "alternative",
};
// Künstler- und Titelwörter, die das Genre fast sicher verraten (Testlabor: ohne Spotify-Genres oft der einzige Hinweis)
const NAME_HINTS = [
  ["classical", /\b(orchestra|orchester|philharmoni|symphon|quartet|quartett|ensemble|choir|chor\b|staatskapelle|sinfonie)/, "artist"],
  ["classical", /\b(op\. ?\d|bwv|k\. ?\d{2,3}|hob\.|concerto|konzert f[üu]r|sonata|sonate|nocturne|pr[ée]lude|symphony no|sinfonie nr|adagio|allegro|andante)\b/, "title"],
  ["rave", /\b(extended mix|original mix|club mix|vip mix|dub mix)\b/, "title"],
  ["jazz", /\b(trio|quintet|quintett|big band|jazz)\b/, "artist"],
  ["christmas", /\b(christmas|xmas|weihnacht|navidad|no[eë]l|jingle bell|santa claus|let it snow)\b/, "title"],
  ["lofi", /\b(lo-?fi|chillhop)\b/, "both"],
  ["bass", /^(lil|yung|young)\b|\b(mc|21 savage)\b|\$/, "artist"],
];
// Klang ohne jeden Namen: nur wenn er eindeutig ist, sonst Pop. Früher bekam der Klang einen Punkt und gewann damit
// allein – 125 BPM und laut hieß „Rave“, 90 BPM hieß „Hip-Hop“: das Testlabor traf so nur 39 % der Familien (Pop: 46 %).
// s: Klangzahlen der Hörprobe (tempo.js: loud dBFS, centroid Hz, bass, density Einsätze/s, kick Bass-Anteil der Einsätze)
function soundGuess(bpm, loud, s) {
  // Testlabor Runde 9 (1 231 Hörproben): Regeln für „Rave“ (Bass-Einsätze, 118–135 BPM) und „Rock“ (dicht, hell)
  // lagen öfter falsch als richtig (Rave 4 von 18) – übrig bleibt nur „sehr leise und spärlich = ruhig“
  if (s && Number.isFinite(s.density)) return s.loud < -22 && s.density < 2 ? ["chill", 0.8] : ["pop", 0.5];
  // ohne Hörprobe: nur sehr leise Mischungen gelten als ruhig
  return loud < -17 || (bpm && bpm < 66) ? ["chill", 0.8] : ["pop", 0.5];
}
// Spielart → Familie („emo“ → „rock“); unbekannt: ""
const FAMILY_OF = {};
for (const [f, keys] of Object.entries(FAMILIES)) for (const k of keys) FAMILY_OF[k] = f;
const familyOf = (key) => FAMILY_OF[key] || "";
// Von Hand festgelegt (cfg.genreArtist): Künstler-URI („spotify:artist:…“) oder nur die ID → Spielart.
// Nur bekannte Spielarten zählen – ein Tippfehler oder eine später entfernte Spielart fällt auf die Erkennung zurück
function manualFor(map, artistUri) {
  if (!map || !artistUri) return "";
  const uri = String(artistUri), id = uri.split(":").pop();
  const k = map[uri] || map[id] || map["spotify:artist:" + id] || "";
  return FAMILY_OF[k] ? k : "";
}
// Ein einzelner Genre-Name einer Quelle → Spielart, nie leer: genaue Regel oder Tabelle, sonst die Familie,
// zuletzt Pop. src: "spotify" (auch MusicBrainz und Last.fm-Tags), "apple" oder "deezer"
function genreKey(name, src = "spotify") {
  const g = String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!g) return "pop";
  if (src === "apple" && APPLE_ONLY[g]) return APPLE_ONLY[g];
  if (src === "deezer" && DEEZER_ONLY[g]) return DEEZER_ONLY[g];
  const m = best(g) || (src === "spotify" ? GENRES : APPLE).find(([, re]) => re.test(g)) || (src === "spotify" ? APPLE : GENRES).find(([, re]) => re.test(g));
  return m ? m[0] : "pop";
}
function pickGenre({ genres = [], apple = "", deezer = [], artist = "", title = "", bpm = 0, loud = -10, minor = 0, sound = null, artistUri = "", manual = null } = {}) {
  // von Hand für diesen Künstler festgelegt: gewinnt immer
  const own = manualFor(manual, artistUri);
  if (own) return { key: own, why: "manual", conf: 1, family: familyOf(own) };
  const score = {}, add = (k, n) => k && (score[k] = (score[k] || 0) + n);
  let why = "";
  const g = String(apple || "").toLowerCase().trim();
  const am = (APPLE_ONLY[g] && [APPLE_ONLY[g]]) || best(g) || APPLE.find(([, re]) => re.test(g));
  // „Electronic“ kann auch Ambient sein: langsam oder leise gemischt → Chill statt Rave
  const calmMix = (bpm && bpm < 95) || loud < -14;
  const fromName = (m) => (m[0] === "rave" && calmMix ? "chill" : m[0]);
  if (am) {
    add(fromName(am), 3);
    why = apple;
  }
  // Deezer: Genres des Albums (das erste zählt, ein reines „Pop“ ist bei Deezer oft nur die Sammelschublade)
  (deezer || []).slice(0, 2).forEach((x, i) => {
    const d = String(x || "").toLowerCase().trim();
    if (!d || (d in DEEZER_ONLY && !DEEZER_ONLY[d])) return;
    const m = (DEEZER_ONLY[d] && [DEEZER_ONLY[d]]) || best(d) || APPLE.find(([, re]) => re.test(d));
    if (!m) return;
    add(fromName(m), (i === 0 ? 2 : 0.5) * (d === "pop" ? 0.5 : 1));
    why ||= x;
  });
  genres.slice(0, 4).forEach((x, i) => {
    const m = best(x) || GENRES.find(([, re]) => re.test(x));
    if (m) {
      add(m[0], i === 0 ? 2 : 1);
      why ||= x;
    }
  });
  const a = String(artist || "").toLowerCase(), t = String(title || "").toLowerCase();
  for (const [k, re, where] of NAME_HINTS) {
    if ((where !== "title" && re.test(a)) || (where !== "artist" && re.test(t))) {
      add(k, 1.5);
      why ||= k;
      break;
    }
  }
  const named = Object.values(score).reduce((n, v) => n + v, 0);
  // Klang: mit Namen nur Zünglein an der Waage (0,75), ohne Namen die vorsichtige Schätzung oben
  if (named) {
    const energy = clamp((loud + 16) / 12, 0, 1);
    if (energy < 0.35 || (bpm && bpm < 80)) add("chill", 0.75);
    else if (bpm >= 118 && bpm <= 135 && energy > 0.6) add("rave", 0.75);
    else if (bpm >= 80 && bpm < 105) add("bass", 0.75);
    else if (bpm > 140 && energy > 0.7) add("rock", 0.75);
  }
  const ranked = Object.entries(score).sort((x, y) => y[1] - x[1]);
  let key, conf;
  if (ranked.length) {
    key = ranked[0][0];
    // Sicherheit: Vorsprung vor dem Zweiten und wie viel überhaupt dafür spricht (Apple allein ≈ 0,75)
    conf = clamp((ranked[0][1] - (ranked[1]?.[1] || 0)) / 4 + Math.min(ranked[0][1], 4) / 8, 0, 1);
  } else {
    const [k, c] = soundGuess(bpm, loud, sound);
    [key, conf] = [k, k === "pop" ? 0.2 : 0.35 * c];
    why = "";
  }
  // nur „Dance“/„Electronic“ ohne genauere Angabe: Tempo und Moll-Anteil entscheiden die Spielart
  if (key === "rave" && bpm) {
    if (bpm >= 160) key = "dnb";
    else if (bpm >= 132 && bpm <= 150) key = minor > 0.6 ? "techno" : "trance";
    else if (bpm >= 118 && bpm < 132) key = minor > 0.6 ? "techno" : "house";
  }
  return { key, why, conf: Math.round(conf * 100) / 100, family: familyOf(key) };
}
// alte Form (Spotify-Genres, Tempo, Lautheit, Apple-Genre, Moll-Anteil) – für Aufrufer ohne die neuen Quellen
const pickProfile = (genres, bpm, loud, apple = "", minor = 0) => pickGenre({ genres, bpm, loud, apple, minor });

export { LOOKS, FAMILIES, RULES, SPECIFIC, GENRES, APPLE, APPLE_ONLY, DEEZER_ONLY, PRIORITY, best, pickProfile, pickGenre, soundGuess, genreKey, familyOf, manualFor };
