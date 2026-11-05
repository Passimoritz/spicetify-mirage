import { S, clamp, seek, lru } from "./core.js";
import { cfg } from "./config.js";
import { audio } from "./audio.js";

/* ---------------------------------------------------------------- Party-Modus */
// Ein Lichtpult, das den Song kennt. Aus Spotifys Taktanalyse entsteht einmal pro Song eine Karte:
// Energiekurve (Viertelsekunden-Raster), Drops auf die Viertelsekunde genau, Aufbauten (die Kurve
// steigt in den nächsten Sekunden steil an), ruhige Breaks, Dur/Moll je Abschnitt und Klanghelligkeit.
// Das Genre-Profil legt die Lichtsprache fest: WO im Takt es schlägt (vier auf den Boden, 1 und 3,
// Backbeat auf 2 und 4, nur die Eins), wie lange ein Schlag nachklingt und welche Scheinwerfer es gibt.
// Blitze sind weiche Farbflächen, nie weißes Stroboskop, und kommen höchstens dreimal pro Sekunde.
// „Weniger Bewegung“ im System schaltet alles Zuckende ab.
//
// Profilfelder: decay = Nachklingen eines Schlags (1/s), accent = Betonung je Schlag im 4er-Takt,
// flashOn = welche Schläge eine Farbfläche auslösen, spot = Scheinwerfer-Art, spinRate = Drehtempo
// der Strahlen, beams = Stärke der Lichtstrahlen, sway = Cover pendelt, shake = Wackeln in px auf betonten Schlägen.
// Visualizer: mirror/spin/height/pulse/ring/thick/halo/sparks/bottom wie bisher.
const PROFILES = {
  // vier auf den Boden, Eins am stärksten, Strahlen kreuzen sich, im Aufbau immer schneller
  rave: { decay: 7, beams: 1, accent: [1, 0.75, 0.85, 0.75], flashOn: "down", spot: "cross", spinRate: 0.5, sway: false, shake: 0,
    mirror: true, spin: true, height: 1.5, pulse: 0.09, ring: 1, thick: 2.6, halo: true, sparks: 10, bottom: false },
  // schwere 1 und 3, langer Bass-Nachhall, Licht wächst vom Boden
  bass: { decay: 3.6, beams: 0.8, accent: [1, 0.3, 0.85, 0.35], flashOn: "down-hi", spot: "floor", spinRate: 0.12, sway: true, shake: 6,
    mirror: true, spin: false, height: 1.35, pulse: 0.12, ring: 2, thick: 4.2, halo: false, sparks: 6, bottom: true },
  // Backbeat: die Snare auf 2 und 4 knallt, Licht von oben wie auf einer Bühne
  rock: { decay: 9, beams: 0.9, accent: [0.6, 1, 0.55, 1], flashOn: "back", spot: "top", spinRate: 0.2, sway: false, shake: 8,
    mirror: true, spin: false, height: 1.5, pulse: 0.08, ring: 2, thick: 3.4, halo: true, sparks: 14, bottom: false },
  // jeder Schlag federt, Farben wandern, weiche Schwenks
  pop: { decay: 6, beams: 1, accent: [1, 0.7, 0.85, 0.7], flashOn: "down", spot: "pan", spinRate: 0.3, sway: true, shake: 0,
    mirror: true, spin: true, height: 1.4, pulse: 0.07, ring: 1, thick: 2.4, halo: true, sparks: 18, bottom: false },
  // atmet mit dem Takt statt zu schlagen: nur die Eins, langes Ausklingen, sanfte Lichtbahnen
  chill: { decay: 2.2, beams: 0.35, accent: [1, 0.25, 0.45, 0.25], flashOn: "", spot: "soft", spinRate: 0.08, sway: true, shake: 0,
    mirror: true, spin: true, height: 1.1, pulse: 0.035, ring: 4, thick: 2, halo: true, sparks: 3, bottom: false },
  // Techno: hart und gerade, kühle Töne, Scanner-Lichtbahnen fahren im Takt über das Bild
  techno: { decay: 9, beams: 1, accent: [1, 0.85, 0.95, 0.85], flashOn: "down", spot: "scan", spinRate: 0.35, sway: false, shake: 0, tint: "cool",
    mirror: true, spin: false, height: 1.45, pulse: 0.07, ring: 1, thick: 2, halo: false, sparks: 4, bottom: false },
  // House: warmer Groove, eine Discokugel wirft Lichtpunkte, die auf dem Schlag aufblitzen
  house: { decay: 5.5, beams: 0.7, accent: [1, 0.6, 0.9, 0.6], flashOn: "down", spot: "disco", spinRate: 0.25, sway: true, shake: 0, tint: "warm",
    mirror: true, spin: true, height: 1.35, pulse: 0.08, ring: 2, thick: 2.6, halo: true, sparks: 12, bottom: false },
  // Trance: euphorisch, lange Aufbauten, Polarlicht-Bänder über dem Bild
  trance: { decay: 4.5, beams: 1.1, accent: [1, 0.7, 0.85, 0.7], flashOn: "down", spot: "aurora", spinRate: 0.4, sway: false, shake: 0,
    mirror: true, spin: true, height: 1.55, pulse: 0.08, ring: 1, thick: 2.2, halo: true, sparks: 14, bottom: false },
  // Drum & Bass: schnell, Kick und Snare im halben Tempo, ein Lichttunnel schießt auf jeden Treffer heraus
  dnb: { decay: 10, beams: 0.9, accent: [1, 0.5, 1, 0.5], flashOn: "down", spot: "tunnel", spinRate: 0.6, sway: false, shake: 5, tint: "cool",
    mirror: true, spin: true, height: 1.5, pulse: 0.1, ring: 1, thick: 2.4, halo: true, sparks: 10, bottom: false },
  // Metal: Snare auf 2 und 4 reißt alles auf, heißes Rot-Weiß von oben, viel Wackeln und Funken
  metal: { decay: 11, beams: 0.8, accent: [0.8, 1, 0.8, 1], flashOn: "back", spot: "top", spinRate: 0.15, sway: false, shake: 11, tint: "hot",
    mirror: true, spin: false, height: 1.6, pulse: 0.1, ring: 2, thick: 3.8, halo: false, sparks: 22, bottom: false },
  // Latin / Reggaeton: Dembow-Betonung, warme Schwenks, das Cover tanzt mit
  latin: { decay: 5, beams: 0.6, accent: [1, 0.55, 0.75, 0.9], flashOn: "down", spot: "pan", spinRate: 0.25, sway: true, shake: 0, tint: "warm",
    mirror: true, spin: true, height: 1.4, pulse: 0.09, ring: 2, thick: 2.8, halo: true, sparks: 16, bottom: false },
  // Disco/Funk: Discokugel, warmes Gold, jeder Schlag federt
  disco: { decay: 6, beams: 0.7, accent: [1, 0.8, 0.9, 0.8], flashOn: "down", spot: "disco", spinRate: 0.3, sway: true, shake: 0, tint: "gold",
    mirror: true, spin: true, height: 1.35, pulse: 0.09, ring: 1, thick: 2.6, halo: true, sparks: 16, bottom: false },
  // K-Pop/J-Pop: knallige Pink-Töne, schnelle Schwenks, viel Funkeln
  kpop: { decay: 7, beams: 1, accent: [1, 0.7, 0.9, 0.7], flashOn: "down", spot: "pan", spinRate: 0.45, sway: true, shake: 0, tint: "pink",
    mirror: true, spin: true, height: 1.45, pulse: 0.09, ring: 1, thick: 2.4, halo: true, sparks: 22, bottom: false },
  // Reggae/Dancehall: Betonung auf 2 und 4 (One Drop), warmes Grün, Licht vom Boden, wiegend
  reggae: { decay: 4, beams: 0.5, accent: [0.5, 1, 0.55, 1], flashOn: "", spot: "floor", spinRate: 0.12, sway: true, shake: 0, tint: "jungle",
    mirror: true, spin: false, height: 1.25, pulse: 0.07, ring: 2, thick: 3.2, halo: true, sparks: 8, bottom: true },
  // Klassik/Filmmusik: großes, langsames Licht in Gold, keine Blitze
  classical: { decay: 1.6, beams: 0.25, accent: [1, 0.3, 0.5, 0.3], flashOn: "", spot: "soft", spinRate: 0.06, sway: false, shake: 0, tint: "gold",
    mirror: true, spin: true, height: 1.1, pulse: 0.03, ring: 4, thick: 1.8, halo: true, sparks: 4, bottom: false },
  // Punk: schneller Backbeat, harte Spots, viel Wackeln
  punk: { decay: 12, beams: 0.8, accent: [0.7, 1, 0.7, 1], flashOn: "back", spot: "top", spinRate: 0.25, sway: false, shake: 9, tint: "hot",
    mirror: true, spin: false, height: 1.55, pulse: 0.1, ring: 1, thick: 3.4, halo: false, sparks: 20, bottom: false },
  // Hardstyle: jede Kick ein Schlag ins Gesicht – Tunnel, Rot, harte Stöße
  hardstyle: { decay: 12, beams: 1.1, accent: [1, 0.95, 1, 0.95], flashOn: "down", spot: "tunnel", spinRate: 0.7, sway: false, shake: 7, tint: "hot",
    mirror: true, spin: true, height: 1.6, pulse: 0.12, ring: 1, thick: 3, halo: true, sparks: 14, bottom: true },
  // Afrobeats/Amapiano: lockerer Groove, warme Schwenks, das Cover tanzt
  afro: { decay: 5, beams: 0.6, accent: [1, 0.6, 0.8, 0.9], flashOn: "down", spot: "pan", spinRate: 0.25, sway: true, shake: 0, tint: "warm",
    mirror: true, spin: true, height: 1.35, pulse: 0.09, ring: 2, thick: 2.8, halo: true, sparks: 14, bottom: true },
  // Jazz/Blues: warmes Clublicht, das langsam atmet
  jazz: { decay: 3, beams: 0.3, accent: [1, 0.5, 0.7, 0.5], flashOn: "", spot: "soft", spinRate: 0.1, sway: true, shake: 0, tint: "gold",
    mirror: true, spin: true, height: 1.15, pulse: 0.05, ring: 3, thick: 2.2, halo: true, sparks: 6, bottom: false },
  // Country/Folk: warme Bühnenspots von oben, Händeklatschen auf 2 und 4
  country: { decay: 6, beams: 0.4, accent: [1, 0.7, 0.85, 0.7], flashOn: "back", spot: "top", spinRate: 0.15, sway: true, shake: 0, tint: "gold",
    mirror: true, spin: false, height: 1.3, pulse: 0.06, ring: 2, thick: 2.6, halo: true, sparks: 8, bottom: false },
};
// Weitere Spielarten: jeweils eine verwandte Lichtsprache, abgewandelt, wo sich die Musik anders anfühlt
const like = (base, o) => ({ ...PROFILES[base], ...o });
Object.assign(PROFILES, {
  // Elektronisch
  edm: like("rave", { beams: 1.25, spinRate: 0.55, height: 1.6, sparks: 14 }), // Big Room: Festival-Strahlen, riesige Drops
  deephouse: like("house", { decay: 3.8, beams: 0.45, spinRate: 0.15, tint: "cool", pulse: 0.06, sparks: 8 }), // tief und weich
  techhouse: like("house", { decay: 7.5, spot: "scan", spinRate: 0.3, beams: 0.85, sparks: 8 }), // House-Groove, Techno-Scanner
  psytrance: like("trance", { decay: 8, spinRate: 0.7, tint: "jungle", accent: [1, 0.8, 0.9, 0.8], pulse: 0.09, sparks: 18 }),
  dubstep: like("bass", { decay: 5, beams: 1, accent: [1, 0.2, 1, 0.3], flashOn: "down", tint: "cool", shake: 10, spinRate: 0.2, height: 1.65, pulse: 0.13, thick: 4.6, sparks: 10 }), // halbes Tempo, schwere Wobbles
  garage: like("house", { decay: 6, accent: [1, 0.4, 0.8, 0.7], spot: "pan", tint: "cool", sparks: 10 }), // 2-Step: versetzte Schläge
  eurodance: like("rave", { tint: "pink", spinRate: 0.45, sway: true, sparks: 16 }),
  synthwave: like("trance", { decay: 4, spot: "scan", tint: "pink", spinRate: 0.2, beams: 0.8, sway: true, sparks: 6 }), // 80er-Neon
  hyperpop: like("kpop", { decay: 9, spinRate: 0.7, sparks: 28, shake: 3, pulse: 0.11 }),
  // Hip-Hop & R&B
  trap: like("bass", { decay: 3, accent: [1, 0.3, 0.6, 0.45], tint: "cool", shake: 7, pulse: 0.13, sparks: 8 }), // 808 lang, Hi-Hats funkeln
  drill: like("bass", { decay: 4.5, accent: [1, 0.45, 0.85, 0.5], spot: "top", tint: "cool", shake: 5, beams: 0.7, sway: false }),
  phonk: like("bass", { decay: 6, accent: [1, 0.6, 0.9, 0.6], spot: "scan", tint: "hot", shake: 6, spinRate: 0.3, sparks: 10 }),
  rnb: like("pop", { decay: 3.2, accent: [1, 0.35, 0.8, 0.5], flashOn: "", spot: "soft", tint: "warm", beams: 0.5, spinRate: 0.12, pulse: 0.05, sparks: 8 }),
  soul: like("country", { decay: 4, accent: [0.8, 1, 0.8, 1], tint: "gold", beams: 0.5, sparks: 10 }), // Backbeat, warmes Bühnenlicht
  // Rock
  indie: like("pop", { accent: [0.8, 1, 0.7, 1], flashOn: "back", spinRate: 0.2, beams: 0.7, shake: 2 }),
  alternative: like("rock", { decay: 8, shake: 6, beams: 0.85, tint: "cool", sparks: 12 }),
  blues: like("jazz", { decay: 3.4, accent: [0.7, 1, 0.7, 1], spot: "top", tint: "warm", sparks: 5 }),
  // Pop
  schlager: like("pop", { accent: [1, 0.85, 0.95, 0.85], flashOn: "back", tint: "gold", spinRate: 0.3, sparks: 20 }), // Klatschen auf 2 und 4
  ballad: like("chill", { decay: 1.8, beams: 0.4, spot: "top", tint: "warm", spinRate: 0.05, sparks: 4 }), // Feuerzeuge hoch
  gospel: like("country", { decay: 4, accent: [0.8, 1, 0.8, 1], tint: "gold", beams: 0.6, sparks: 14 }),
  // Latin & Welt
  reggaeton: like("latin", { decay: 5.5, accent: [1, 0.4, 0.7, 1], spot: "floor", tint: "hot", shake: 3, bottom: true, sparks: 14 }), // Dembow
  salsa: like("latin", { decay: 6, accent: [1, 0.7, 0.8, 0.9], spinRate: 0.35, sparks: 18 }),
  brazil: like("latin", { accent: [1, 0.8, 0.9, 0.8], spot: "floor", tint: "jungle", spinRate: 0.35, sparks: 16 }),
  flamenco: like("latin", { decay: 8, accent: [1, 0.6, 0.9, 0.6], flashOn: "back", spot: "top", tint: "hot", sway: false, shake: 3, sparks: 12 }),
  bollywood: like("kpop", { tint: "gold", spinRate: 0.35, sparks: 22 }),
  arabic: like("trance", { decay: 4, spot: "aurora", tint: "gold", spinRate: 0.25, sway: true, beams: 0.7, sparks: 10 }),
  // Ruhig
  ambient: like("chill", { decay: 1.2, beams: 0.15, spot: "aurora", spinRate: 0.04, pulse: 0.02, tint: "cool", sparks: 2 }),
  cinematic: like("classical", { decay: 2.4, beams: 0.7, spot: "aurora", spinRate: 0.1, tint: "cool", height: 1.3, pulse: 0.05, sparks: 8 }),
});
// zweiter Schritt: diese bauen auch auf Spielarten von oben auf (edm, schlager, ballad …)
Object.assign(PROFILES, {
  // ---- weitere Spielarten (1.17)
  melodictechno: like("techno", { decay: 6, spot: "aurora", spinRate: 0.25, beams: 0.9, tint: "cool", pulse: 0.06, sparks: 10 }), // Afterhour, weite Flächen
  hardtechno: like("techno", { decay: 12, accent: [1, 0.95, 1, 0.95], spot: "tunnel", spinRate: 0.55, shake: 6, tint: "hot", sparks: 6 }), // Schranz, Industrial
  futurebass: like("edm", { decay: 5, spot: "pan", tint: "pink", sway: true, spinRate: 0.35, sparks: 22, pulse: 0.1 }), // Kawaii-Synths, große Akkorde
  electroswing: like("disco", { decay: 7, accent: [0.8, 1, 0.8, 1], flashOn: "back", tint: "gold", spinRate: 0.3, sparks: 14 }), // Swing auf 2 und 4
  breakbeat: like("dnb", { decay: 8, accent: [1, 0.55, 0.9, 0.7], spot: "scan", spinRate: 0.4, shake: 4, sparks: 10 }),
  boombap: like("bass", { decay: 5, accent: [1, 0.5, 1, 0.5], flashOn: "back", spot: "top", tint: "gold", spinRate: 0.1, shake: 4, sparks: 6 }), // alte Schule: Kick und Snare
  dancehall: like("reggae", { decay: 5.5, accent: [1, 0.5, 0.8, 0.9], flashOn: "down", spot: "floor", tint: "hot", spinRate: 0.2, sparks: 12 }),
  cloudrap: like("trap", { decay: 2.6, beams: 0.45, spot: "aurora", tint: "pink", shake: 2, spinRate: 0.1, pulse: 0.07, sparks: 6 }), // verhallt, verträumt
  hardrock: like("rock", { decay: 9, accent: [0.7, 1, 0.65, 1], tint: "gold", shake: 9, beams: 1, sparks: 16 }), // Arena-Rock
  postrock: like("cinematic", { decay: 3.4, beams: 0.8, spot: "aurora", tint: "cool", spinRate: 0.08, height: 1.45, pulse: 0.07, sparks: 10 }), // langsamer Aufbau, riesige Wellen
  ska: like("reggae", { decay: 7, accent: [0.6, 1, 0.6, 1], flashOn: "back", spot: "pan", tint: "gold", spinRate: 0.3, sparks: 14 }), // Offbeat, Bläser
  emo: like("punk", { decay: 9, tint: "cool", shake: 6, beams: 0.75, sparks: 10 }),
  jpop: like("kpop", { tint: "pink", spinRate: 0.5, sparks: 24, pulse: 0.09 }), // Anime, City-Pop, Vocaloid
  musical: like("pop", { decay: 4.5, accent: [1, 0.6, 0.8, 0.6], flashOn: "", spot: "top", tint: "gold", beams: 0.6, spinRate: 0.15, sparks: 12 }), // Bühnenspot
  christmas: like("schlager", { decay: 4, tint: "gold", spot: "soft", spinRate: 0.15, beams: 0.5, sparks: 26, pulse: 0.05 }), // warm, funkelnd
  celtic: like("country", { decay: 6.5, accent: [1, 0.75, 0.9, 0.75], spot: "pan", tint: "jungle", spinRate: 0.3, sparks: 14 }), // Fiedel, Stampfen
  balkan: like("latin", { decay: 8, accent: [1, 0.85, 0.95, 0.85], flashOn: "down", spot: "pan", tint: "hot", spinRate: 0.45, shake: 3, sparks: 20 }), // Blaskapelle im Galopp
  amapiano: like("deephouse", { decay: 4.5, accent: [1, 0.4, 0.7, 0.8], spot: "floor", tint: "warm", spinRate: 0.18, bottom: true, sparks: 10 }), // Log-Drum
  lofi: like("chill", { decay: 2, beams: 0.2, spot: "soft", tint: "warm", spinRate: 0.05, pulse: 0.03, sparks: 3 }), // Lernmusik: kaum Bewegung
  neoclassical: like("classical", { decay: 1.8, beams: 0.35, spot: "soft", tint: "cool", spinRate: 0.05, pulse: 0.03, sparks: 4 }), // Klavier, Streicher
  acoustic: like("ballad", { decay: 2.6, beams: 0.35, spot: "top", tint: "warm", spinRate: 0.06, sparks: 6 }), // Gitarre und Stimme
});
// Für die Auswahl in den Einstellungen: nach Musikfamilie geordnet
const FAMILIES = {
  electronic: ["rave", "edm", "house", "deephouse", "techhouse", "techno", "melodictechno", "hardtechno", "trance", "psytrance", "dnb", "breakbeat", "dubstep", "futurebass", "garage", "hardstyle", "eurodance", "synthwave", "hyperpop", "electroswing"],
  urban: ["bass", "boombap", "trap", "cloudrap", "drill", "phonk", "rnb", "soul", "afro", "amapiano", "reggae", "dancehall"],
  rock: ["rock", "hardrock", "alternative", "indie", "punk", "emo", "ska", "metal", "postrock", "blues"],
  pop: ["pop", "kpop", "jpop", "disco", "schlager", "ballad", "gospel", "country", "musical", "christmas"],
  world: ["latin", "reggaeton", "salsa", "brazil", "flamenco", "bollywood", "arabic", "balkan", "celtic"],
  calm: ["chill", "lofi", "acoustic", "ambient", "jazz", "classical", "neoclassical", "cinematic"],
};
const PROFILE_KEYS = Object.keys(PROFILES);
// Genaue Spielarten zuerst – gelten für Spotify- und Apple-Genres gleichermaßen
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
  ["brazil", /samba|pagode|forr[oó]|\bax[eé]\b|baile funk|funk carioca|sertanejo|\bmpb\b|bossa|brazil|brasil/],
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
  ["bollywood", /bollywood|filmi|bhangra|desi|punjabi|indian|tamil|telugu|hindi/],
  ["balkan", /balkan|gypsy|klezmer|turbo ?folk|manele|brass band|polka|čoček|cocek/],
  ["arabic", /arab|khaleeji|\bra[iï]\b|dabke|turkish|middle east|persian|mizrahi/],
  ["celtic", /celtic|irish|scottish|shant(y|ies)|bagpipe|folk punk|gaelic/],
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
];
// Reihenfolge zählt: „dance pop“ ist eher Pop als Rave, „pop punk“ eher Rock
const GENRES = [
  ["chill", /lo-?fi|chill|ambient|acoustic|jazz|classical|piano|folk|soul|r&b|rnb|bossa|sleep|meditation|singer-songwriter|soundtrack|orchestra/],
  ["rock", /rock|metal|punk|grunge|core\b|emo|hardcore|garage/],
  ["bass", /hip ?hop|rap|trap|drill|grime|phonk|dancehall|afro|boom bap|gangsta/],
  ["rave", /edm|house|techno|trance|dubstep|drum and bass|dnb|electro|hardstyle|rave|bass music|garage house|big room|psytrance|eurodance/],
  ["pop", /pop|dance|disco|funk|latin|k-pop|schlager|indie/],
];

const genreCache = lru(100);
async function artistGenres(item) {
  const uri = item?.artists?.[0]?.uri || item?.metadata?.artist_uri || "";
  const id = uri.split(":")[2];
  if (!id) return [];
  if (genreCache.has(id)) return genreCache.get(id);
  const job = (async () => {
    try {
      const a = await S.CosmosAsync.get(`https://api.spotify.com/v1/artists/${id}`);
      return Array.isArray(a?.genres) ? a.genres.map((g) => String(g).toLowerCase()) : [];
    } catch {
      return [];
    }
  })();
  genreCache.set(id, job);
  return job;
}

/* ---- Genre je Song aus der iTunes-Suche */
// Spotifys Künstler-Genres kommen oft leer oder gar nicht (Anfragelimit) – dann blieb nur das Tempo und
// fast alles wurde „Pop“. Apples Suche kennt zu fast jedem Song ein Genre („Alternative“, „Dance“,
// „Hip-Hop/Rap“ …), ohne Konto. Raus gehen nur Titel und Künstler; abschaltbar („Genre online nachschlagen“).
const APPLE = [
  // R&B vor Soul: „R&B/Soul“ (The Weeknd, SZA) groovt eher wie Pop als dass es chillt
  ["pop", /r&b/],
  ["rave", /dance|electronic|electronica|house|techno|trance|dubstep|drum ?(&|and) ?bass|hardstyle|edm|club/],
  ["bass", /hip-?hop|rap|trap|urbano|reggaeton|dancehall|afro|grime|drill/],
  ["rock", /rock|alternative|metal|punk|grunge|hardcore|emo|indie(?! ?pop)/],
  ["chill", /soul|singer|songwriter|jazz|classical|ambient|soundtrack|folk|acoustic|new age|easy listening|lo-?fi|blues|country|piano|instrumental/],
  ["pop", /pop|schlager|disco|funk|latin|world|reggae/],
];
const appleCache = lru(200);
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "");
const bareTitle = (s) => String(s || "").replace(/\s+-\s+.*$/, "").replace(/\s*[([].*?[)\]]/g, "").trim();
async function appleGenre(item) {
  const uri = item?.uri || "";
  const title = bareTitle(item?.metadata?.title || item?.name);
  const artist = item?.metadata?.artist_name || item?.artists?.[0]?.name || "";
  if (!cfg.partyOnline || !uri.startsWith("spotify:track:") || !title || !artist) return "";
  if (appleCache.has(uri)) return appleCache.get(uri);
  // erst im eigenen Land suchen (deutscher Rap steht nicht unbedingt im US-Katalog), dann in den USA
  const region = (navigator.languages || [navigator.language]).map((l) => String(l).split("-")[1]).find((r) => /^[A-Z]{2}$/i.test(r || ""));
  const countries = [...new Set([region || "DE", "US"].map((c) => c.toUpperCase()))];
  const job = (async () => {
    for (const country of countries) {
      const g = await appleSearch(title, artist, country);
      if (g) return g;
    }
    return "";
  })();
  appleCache.set(uri, job);
  return job;
}
async function appleSearch(title, artist, country) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=10&country=${country}&term=${encodeURIComponent(title + " " + artist)}`, { signal: ctl.signal });
    clearTimeout(timer);
    const list = res.ok ? (await res.json())?.results || [] : [];
    const a = norm(artist), tt = norm(title);
    // nur Treffer vom selben Künstler; gleicher Titel zählt doppelt – das häufigste Genre gewinnt
    const votes = {};
    for (const r of list) {
      const ra = norm(r.artistName);
      if (!ra || !(ra.includes(a) || a.includes(ra)) || !r.primaryGenreName) continue;
      const w = norm(bareTitle(r.trackName)) === tt ? 2 : 1;
      votes[r.primaryGenreName] = (votes[r.primaryGenreName] || 0) + w;
    }
    return Object.entries(votes).sort((x, y) => y[1] - x[1])[0]?.[0] || "";
  } catch {
    return "";
  }
}

// Profil aus allen Hinweisen: Apple-Genre des Songs (3 Punkte), Spotify-Genres des Künstlers (2 für das
// erste, 1 für weitere) und der Klang selbst – Tempo und Lautheit (1). Die meisten Punkte gewinnen.
function pickProfile(genres, bpm, loud, apple = "", minor = 0) {
  const score = {}, add = (k, n) => (score[k] = (score[k] || 0) + n);
  let why = "";
  const g = apple.toLowerCase();
  const am = SPECIFIC.find(([, re]) => re.test(g)) || APPLE.find(([, re]) => re.test(g));
  if (am) {
    // „Electronic“ kann auch Ambient sein: langsam oder leise gemischt → Chill statt Rave
    const calmMix = (bpm && bpm < 95) || loud < -14;
    add(am[0] === "rave" && calmMix ? "chill" : am[0], 3);
    why = apple;
  }
  genres.slice(0, 4).forEach((x, i) => {
    const m = SPECIFIC.find(([, re]) => re.test(x)) || GENRES.find(([, re]) => re.test(x));
    if (m) {
      add(m[0], i === 0 ? 2 : 1);
      why ||= x;
    }
  });
  const energy = clamp((loud + 16) / 12, 0, 1);
  if (energy < 0.35 || (bpm && bpm < 80)) add("chill", 1);
  else if (bpm >= 118 && bpm <= 135 && energy > 0.6) add("rave", 1);
  else if (bpm >= 80 && bpm < 105) add("bass", 1);
  else if (bpm > 140 && energy > 0.7) add("rock", 1);
  const best = Object.entries(score).sort((x, y) => y[1] - x[1])[0];
  let key = best ? best[0] : "pop";
  // nur „Dance“/„Electronic“ ohne genauere Angabe: Tempo und Moll-Anteil entscheiden die Spielart
  if (key === "rave" && bpm) {
    if (bpm >= 160) key = "dnb";
    else if (bpm >= 132 && bpm <= 150) key = minor > 0.6 ? "techno" : "trance";
    else if (bpm >= 118 && bpm < 132) key = minor > 0.6 ? "techno" : "house";
  }
  return { key, why };
}
// Anteil der Song-Zeit in Moll (0..1) aus den Abschnitten der Analyse
function minorShare(d) {
  const sx = d?.sections || [];
  if (!sx.length) return 0;
  let m = 0, all = 0;
  sx.forEach((x, i) => {
    const len = (sx[i + 1]?.t ?? x.t + 20) - x.t;
    all += len;
    if (x.mode === 0) m += len;
  });
  return all ? m / all : 0;
}

/* ---- Song-Karte */
const STEP = 0.25;
const pct = (arr, p) => {
  const s = Float32Array.from(arr).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
};
const mapCache = lru(30);
function songMap(d) {
  if (mapCache.has(d)) return mapCache.get(d);
  const segs = d.segs || [];
  const end = segs.length ? segs[segs.length - 1].t + 2 : 0;
  const n = Math.max(1, Math.ceil(end / STEP));
  // lauteste Stelle je Rasterfeld, Lücken mit dem Vorgänger füllen
  const raw = new Float32Array(n).fill(-60), rb = new Float32Array(n);
  for (const s of segs) {
    const i = Math.min(n - 1, Math.floor(s.t / STEP));
    if (s.l > raw[i]) raw[i] = s.l;
    rb[i] = Math.max(rb[i], s.b || 0);
  }
  for (let i = 1; i < n; i++) {
    if (raw[i] <= -60) raw[i] = raw[i - 1];
    if (!rb[i]) rb[i] = rb[i - 1];
  }
  // über 1,5 s geglättet = gefühlte Energie, nicht jeder einzelne Schlag. Mittig geglättet (der ganze
  // Song ist ja bekannt): die Kurve steigt genau dort, wo der Song lauter wird – nicht eine Sekunde später
  const sm = (a, w) => {
    const o = new Float32Array(n), h = w >> 1;
    for (let i = 0; i < n; i++) {
      let acc = 0, c = 0;
      for (let k = Math.max(0, i - h); k <= Math.min(n - 1, i + h); k++, c++) acc += a[k];
      o[i] = acc / c;
    }
    return o;
  };
  const E = sm(raw, 6), B = sm(rb, 6);
  // auf den Song selbst bezogen: seine lautesten 5 % = 1, 0 liegt bei den leisesten 10 % – aber immer
  // mindestens 8 dB darunter (sonst wird ein fast durchgehend lauter Song zu einer flachen Null-Linie)
  const hi = pct(E, 0.95), p10 = pct(E, 0.1), lo = Math.min(p10, hi - 8);
  const bhi = pct(B, 0.95), blo = Math.min(pct(B, 0.1), bhi - 20);
  const energy = E.map((v) => clamp((v - lo) / (hi - lo), 0, 1));
  const bright = B.map((v) => clamp((v - blo) / (bhi - blo), 0, 1));
  // Drops: die Energie springt binnen 4 s deutlich nach oben und bleibt hoch – mindestens 8 s Abstand
  const drops = [];
  for (let i = 16; i < n - 4; i++) {
    let before = 1;
    for (let k = i - 16; k < i - 2; k++) before = Math.min(before, energy[k]);
    const after = (energy[i] + energy[i + 2] + energy[i + 4]) / 3;
    if (after > 0.72 && after - before > 0.38 && (!drops.length || i * STEP - drops[drops.length - 1] > 8)) {
      // den eigentlichen Sprung in der ungeglätteten Lautheit suchen, dann auf den nächsten Schlag legen
      let j = i, best = -1e9;
      for (let k = Math.max(1, i - 6); k <= Math.min(n - 1, i + 6); k++) {
        const jump = raw[k] - raw[k - 1];
        if (jump > best) [best, j] = [jump, k];
      }
      const tj = j * STEP, bi = seek(d.beats, tj, "t");
      const b0 = d.beats[bi]?.t ?? tj, b1 = d.beats[bi + 1]?.t ?? b0;
      drops.push(Math.abs(b1 - tj) < Math.abs(b0 - tj) ? b1 : b0);
      i += 32;
    }
  }
  // „dynamisch“ = der Song hat wirklich leise Stellen (Breaks gibt es nur dann)
  // --- Instrumente aus Spotifys Klangfarbe je Segment, auf den Song selbst bezogen (Rang 0..1):
  // Kick = harter Einsatz, dunkel, lauter als davor · Snare/Clap = harter Einsatz, rauschig ·
  // Hi-Hat/Becken = sehr hell und eher leise · Melodie = klare Tonhöhe (ein Ton dominiert die 12 Tonklassen)
  const rank = (vals) => {
    const sorted = Float32Array.from(vals).sort();
    return (v) => {
      let lo = 0, hi2 = sorted.length;
      while (lo < hi2) {
        const mid = (lo + hi2) >> 1;
        if (sorted[mid] < v) lo = mid + 1;
        else hi2 = mid;
      }
      return sorted.length ? lo / sorted.length : 0;
    };
  };
  const rA = rank(segs.map((x) => x.k || 0)), rF = rank(segs.map((x) => x.f || 0)), rB = rank(segs.map((x) => x.b || 0));
  const kicks = [], snares = [], hats = [];
  const tonal = new Float32Array(n), pc = new Uint8Array(n);
  segs.forEach((x, i) => {
    const rise = x.l - (segs[i - 1]?.l ?? -60), a = rA(x.k || 0), f = rF(x.f || 0), b = rB(x.b || 0);
    const loudEnough = x.l > hi - 16;
    if (loudEnough && (a > 0.72 || rise > 6) && b < 0.5) kicks.push(x.t);
    else if (loudEnough && a > 0.65 && f > 0.62 && b >= 0.4) snares.push(x.t);
    if (b > 0.82 && rise < 4 && x.l > hi - 22) hats.push(x.t);
    if (x.p.length === 12) {
      let sum = 0, mx = 0, arg = 0;
      x.p.forEach((v, k) => {
        sum += v;
        if (v > mx) [mx, arg] = [v, k];
      });
      const bin = Math.min(n - 1, Math.floor(x.t / STEP));
      const clarity = sum ? clamp(((mx / sum) * 12 - 1.6) / 2.4, 0, 1) : 0;
      if (clarity >= tonal[bin]) [tonal[bin], pc[bin]] = [clarity, arg];
    }
  });
  for (let i = 1; i < n; i++) if (!tonal[i]) [tonal[i], pc[i]] = [tonal[i - 1] * 0.9, pc[i - 1]];
  const m = { energy, bright, drops, dynamic: hi - p10 > 4 || energy.some((v) => v < 0.2), sections: d.sections || [], kicks, snares, hats, tonal, pc };
  mapCache.set(d, m);
  return m;
}
const at = (arr, sec) => {
  const f = sec / STEP, i = Math.floor(f);
  if (i < 0) return arr[0] || 0;
  if (i >= arr.length - 1) return arr[arr.length - 1] || 0;
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
};

const party = (() => {
  let uri = "", picked = "", info = { key: "pop", why: "", bpm: 0 }, token = 0;
  let lastBeat = -1, lastBar = -1, flash = 0, flashCol = 0, shake = 0, kick = 0, spin = 0;
  const inst = { k: -1, s: -1, h: -1 };
  let sway = 1, lastSec = 0, dropGlow = 0, lastFlashAt = -1e9, clock = 0, smooth = { e: 0, b: 0, k: 0, br: 0 };
  const calm = () => cfg.calm || matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function prepare(item) {
    const u = item?.uri || "";
    // Song + gewählter Stil: wer in den Einstellungen umstellt, bekommt sofort das neue Profil
    const pk = u + "|" + cfg.partyStyle + "|" + cfg.partyOnline;
    if (pk === picked) return info;
    picked = pk;
    uri = u;
    const my = ++token;
    lastBeat = lastBar = -1;
    dropGlow = 0;
    // beide Quellen gleichzeitig fragen
    const [genres, apple] = cfg.partyStyle === "auto" ? await Promise.all([artistGenres(item), appleGenre(item)]) : [[], ""];
    if (my !== token) return info;
    const bpm = audio.uri === u ? audio.data?.bpm || 0 : 0;
    const loud = audio.uri === u ? audio.data?.loud ?? -10 : -10;
    const auto = pickProfile(genres, bpm, loud, apple, audio.uri === u ? minorShare(audio.data) : 0);
    info = { key: cfg.partyStyle !== "auto" && PROFILES[cfg.partyStyle] ? cfg.partyStyle : auto.key, why: auto.why, bpm, genres, apple };
    return info;
  }
  // Taktdaten kommen oft erst nach dem Songwechsel: dann Tempo nachtragen und ggf. neu wählen
  function refine() {
    if (!audio.data || audio.uri !== uri) return;
    if (info.bpm !== audio.data.bpm) {
      info.bpm = audio.data.bpm;
      if (cfg.partyStyle === "auto") info.key = pickProfile(info.genres || [], info.bpm, audio.data.loud, info.apple || "", minorShare(audio.data)).key;
    }
  }

  // Pro Bild: der ganze Lichtzustand aus Song-Karte, Taktposition und Profil
  function step(sec, dt, playing) {
    refine();
    const P = PROFILES[info.key];
    const level = clamp(Math.round(cfg.partyLevel) || 2, 1, 5);
    const lvl = [0.6, 1, 1.45, 2, 2.7][level - 1];
    const fx = !calm();
    const d = audio.uri === uri ? audio.data : null;
    clock += dt;
    const ease = (k) => 1 - Math.exp(-dt * k);

    // --- wo im Song: Energie jetzt, gleich, Aufbau, Break, Drop, Dur/Moll, Helligkeit
    let energy = 0.55, build = 0, low = 0, bright = 0.5, minor = false, dropHit = false, scene = 0, toDrop = 99, songLen = 0, keyPc = -1, tempoNow = 0;
    let hit = false, barHit = false, inBar = 0, beatEnv = 0, conf = 0.8;
    let beatPhase = 0, beatIdx = -1;
    let kickEnv = 0, snareEnv = 0, hatEnv = 0, tone = 0, pitch = -1, snareHit = false, kickHit = false, hatHit = false;
    if (d && d.segs?.length) {
      const M = songMap(d);
      energy = at(M.energy, sec);
      bright = at(M.bright, sec);
      // Aufbau: in 1–4 s wird es deutlich lauter → Spannung schon jetzt aufbauen
      let ahead = 0;
      for (let s = 1; s <= 4; s += 0.5) ahead = Math.max(ahead, at(M.energy, sec + s));
      // (direkt nach einem Drop nicht – da steigt die Kurve nur noch nach)
      build = ahead > 0.68 ? clamp((ahead - energy - 0.12) / 0.35, 0, 1) * (1 - dropGlow) : 0;
      // Break: ruhige Stelle in einem Song, der sonst laut wird
      low = M.dynamic ? clamp((0.42 - energy) / 0.3, 0, 1) : 0;
      // jeder neue Abschnitt (Strophe, Refrain, Bridge …) ist eine neue „Szene“: andere Farbfolge, andere Drehrichtung
      scene = Math.max(seek(M.sections, sec, "t"), 0);
      // Lichtregie: wie weit ist der nächste Drop entfernt, wie lang ist der Song
      for (const tD of M.drops) {
        if (tD > sec) {
          toDrop = tD - sec;
          break;
        }
      }
      songLen = M.energy.length * STEP;
      const sx = M.sections[scene];
      minor = sx ? sx.mode === 0 : false;
      // Tonart des Abschnitts (färbt das Licht leicht ein) und Tempo-Wechsel: halbes/doppeltes Tempo oder ein
      // deutlich anderes Tempo im Abschnitt (Breakdown, Bridge) – das Publikum tanzt dann im neuen Tempo
      keyPc = sx && sx.key >= 0 ? sx.key : -1;
      if (sx?.tempo > 40 && sx.tc > 0.35 && info.bpm) {
        const r = sx.tempo / info.bpm;
        if (Math.abs(r - 0.5) < 0.06 || Math.abs(r - 2) < 0.12 || (Math.abs(r - 1) > 0.1 && Math.abs(r - 1) < 0.45)) tempoNow = sx.tempo;
      }
      // Drop genau auf seinem Schlag (vorberechnet) – nicht erst, wenn die Lautheit schon da ist
      // (nicht nach einem Sprung im Song – nur bei normalem Weiterlaufen)
      if (playing && sec >= lastSec && sec - lastSec < 0.5) for (const t of M.drops) if (t > lastSec && t <= sec + 0.02) dropHit = true;
    }
    // Instrumente: Zeit seit dem letzten Treffer je Spur → kurze Hüllkurven, die genau auf dem Klang sitzen
    if (d && d.segs?.length && playing) {
      const M = songMap(d);
      const since = (arr) => {
        let lo = 0, hi2 = arr.length;
        while (lo < hi2) {
          const mid = (lo + hi2) >> 1;
          if (arr[mid] <= sec) lo = mid + 1;
          else hi2 = mid;
        }
        return lo ? [sec - arr[lo - 1], lo - 1] : [9, -1];
      };
      const [ks, ki] = since(M.kicks), [ss, si] = since(M.snares), [hs, hi3] = since(M.hats);
      kickEnv = Math.exp(-ks * 7);
      snareEnv = Math.exp(-ss * 9);
      hatEnv = Math.exp(-hs * 16);
      kickHit = ki !== inst.k && ks < 0.12;
      snareHit = si !== inst.s && ss < 0.12;
      hatHit = hi3 !== inst.h && hs < 0.08;
      [inst.k, inst.s, inst.h] = [ki, si, hi3];
      const bin = Math.max(0, Math.min(M.tonal.length - 1, Math.floor(sec / STEP)));
      tone = M.tonal[bin];
      pitch = tone > 0.35 ? M.pc[bin] : -1;
    }
    lastSec = sec;
    // schnell hoch, langsam runter – und beim Drop sofort voll: der Moment muss sitzen
    smooth.e += (energy - smooth.e) * ease(energy > smooth.e ? 9 : 2);
    smooth.b += (build - smooth.b) * ease(build > smooth.b ? 2 : 6);
    // ein Aufbau hebt den Break auf: das Licht steigt mit, auch wenn es noch leise ist
    smooth.k += (low * (1 - build) - smooth.k) * ease(1.5);
    smooth.br += (bright - smooth.br) * ease(2);
    if (dropHit) {
      smooth.e = Math.max(smooth.e, 0.9);
      smooth.k = 0;
      smooth.b = 0;
    }

    // --- wo im Takt: Zeit seit dem letzten Schlag → Hüllkurve exakt auf dem Schlag, nicht ab Erkennung
    if (d && playing && d.beats?.length) {
      const bi = seek(d.beats, sec, "t");
      if (bi >= 0) {
        const since = sec - d.beats[bi].t;
        // Schlagphase 0..1 (0 = genau auf dem Schlag) – das Publikum bewegt sich danach, nie zu früh oder zu spät
        const per = Math.max(0.2, (d.beats[bi + 1]?.t ?? d.beats[bi].t + 60 / (info.bpm || 120)) - d.beats[bi].t);
        beatPhase = clamp(since / per, 0, 1);
        beatIdx = bi;
        const ba = d.bars?.length ? seek(d.bars, sec, "t") : -1;
        const barStart = ba >= 0 ? seek(d.beats, d.bars[ba].t + 0.05, "t") : bi - (bi % 4);
        inBar = (((bi - barStart) % 4) + 4) % 4;
        // sehr schnelle Songs zählen in halbem Tempo, sonst wird es Flackern statt Groove
        const half = info.bpm > 150;
        const strength = P.accent[half ? (inBar & 2) : inBar] ?? 0.6;
        beatEnv = strength * Math.exp(-since * P.decay * (half ? 0.6 : 1));
        conf = clamp(d.beats[bi].c + 0.3, 0, 1);
        if (bi !== lastBeat) {
          lastBeat = bi;
          hit = !half || inBar % 2 === 0;
        }
        if (ba >= 0 && ba !== lastBar) {
          lastBar = ba;
          barHit = true;
        }
      }
    }

    // --- Gesamtintensität: Energie, Drop-Nachglühen, Break dämpft; Aufbau steigert schrittweise
    if (dropHit) dropGlow = 1;
    dropGlow *= Math.exp(-dt * 0.55);
    const I = clamp(0.22 + smooth.e * 0.78 + dropGlow * 0.35 + smooth.b * 0.2 - smooth.k * 0.35, 0.08, 1.35);
    const accent = beatEnv * (0.45 + 0.55 * I);

    // --- Farbflächen: je Profil auf anderen Schlägen, nie im Break, höchstens 3 pro Sekunde
    const strong = hit && beatEnv > 0.55;
    let flashOn = false;
    if (P.flashOn === "down") flashOn = hit && inBar === 0;
    else if (P.flashOn === "back") flashOn = snareHit || (hit && (inBar === 1 || inBar === 3) && snareEnv < 0.2);
    else if (P.flashOn === "down-hi") flashOn = hit && inBar === 0 && smooth.e > 0.65;
    if (level >= 5 && P.flashOn && strong && smooth.e > 0.7) flashOn = true;
    // hohe Energie: auch die Kick färbt (gerade Genres), damit es in Refrain und Drop richtig pumpt
    if (level >= 3 && P.flashOn === "down" && kickHit && smooth.e > 0.62) flashOn = true;
    if (smooth.k > 0.5) flashOn = false;
    if (fx && cfg.partyFlash && (flashOn || dropHit) && clock - lastFlashAt > 0.34) {
      lastFlashAt = clock;
      flash = Math.min(1, (dropHit ? 1 : 0.35 + 0.5 * I) * Math.min(lvl, 1.6));
      flashCol = (flashCol + 1) % 3;
    }
    flash *= Math.exp(-dt * (P.decay * 0.8));

    if (fx && P.shake && strong) shake = P.shake * lvl * (0.35 + 0.65 * I) * conf;
    shake *= Math.exp(-dt * 14);
    // Kamera-Stoß auf betonten Schlägen, beim Drop voll
    if (fx && cfg.partyZoom && level >= 4 && strong) kick = Math.min(1, (0.3 + 0.7 * I) * beatEnv * (level - 3));
    if (fx && cfg.partyZoom && dropHit) kick = 1;
    kick *= Math.exp(-dt * 9);

    // --- Strahlen: drehen mit der Energie, im Aufbau immer schneller, springen bei Rave pro Takt
    // Drehrichtung wechselt mit jeder Szene
    spin += dt * P.spinRate * (0.3 + smooth.e) * (1 + smooth.b * 5) * (fx ? 1 : 0) * (scene % 2 ? -1 : 1);
    if (barHit && fx && info.key === "rave" && smooth.e > 0.5) spin += 0.6 + Math.random() * 0.6;
    const lasers = fx && cfg.partyLasers && level >= 4 ? (level >= 5 ? 12 : 6) : 0;
    // im Break blenden Strahlen aus, im Aufbau ziehen sie sich zusammen
    const beamVis = clamp(smooth.e * 1.25 + dropGlow - smooth.k, 0, 1.2);
    if (hit && P.sway) sway = -sway;

    const out = {
      P, key: info.key, level, lvl, fx, hit, barHit, inBar, conf,
      energy: smooth.e, build: smooth.b, low: smooth.k, bright: smooth.br, minor, I, scene,
      kickEnv, snareEnv, hatEnv, tone, pitch, kickHit, snareHit, hatHit,
      phase: beatPhase, beatIdx, keyPc, tempo: tempoNow || info.bpm || 120,
      // Lichtregie: Ruhe vor dem Sturm (tension), Blackout auf dem letzten Schlag vor dem Drop, Finale im letzten Refrain
      toDrop,
      tension: cfg.partyDirector && toDrop > 60 / (info.bpm || 120) ? clamp((4 - toDrop) / 3.5, 0, 1) : 0,
      blackout: !!cfg.partyDirector && toDrop > 0.02 && toDrop < (60 / (info.bpm || 120)) * 0.95,
      finale: !!cfg.partyDirector && songLen > 60 && sec > songLen * 0.72 && smooth.e > 0.7,
      beat: beatEnv, accent, beam: accent, drop: Math.max(dropGlow, clamp((smooth.e - 0.8) * 2.5, 0, 1)), dropHit,
      flash, flashCol, shake: fx ? shake : 0, kick: fx ? kick : 0, spin, lasers, beamVis, sway,
    };
    // Fehlersuche: localStorage „mirage:debug“ = 1 legt den Lichtzustand und die Song-Karte offen
    if (DEBUG) window.__mirageParty = { ...out, P: info.key, map: d ? songMap(d) : null, sec };
    return out;
  }
  const DEBUG = (() => {
    try {
      return localStorage.getItem("mirage:debug") === "1";
    } catch {
      return false;
    }
  })();

  return { prepare, step, get info() { return info; }, PROFILES, PROFILE_KEYS, FAMILIES };
})();

export { party, PROFILE_KEYS, FAMILIES };
