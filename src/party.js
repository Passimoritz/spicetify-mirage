import { S, clamp, seek, lru } from "./core.js";
import { cfg } from "./config.js";
import { audio } from "./audio.js";
import { createFlashCap } from "./flashcap.js";
import { songMap, at, STEP } from "./songmap.js";
import { planSong, cue } from "./director.js";
import { KIN, baseOf } from "./styles.js";
import { LOOKS, FAMILIES, pickProfile } from "./genres.js";

/* ---------------------------------------------------------------- Party-Modus */
// Ein Lichtpult, das den Song kennt. Aus Spotifys Taktanalyse entsteht einmal pro Song eine Karte:
// Energiekurve (Viertelsekunden-Raster), Drops auf die Viertelsekunde genau, Aufbauten (die Kurve
// steigt in den nächsten Sekunden steil an), ruhige Breaks, Dur/Moll je Abschnitt und Klanghelligkeit.
// Das Genre-Profil legt die Lichtsprache fest: WO im Takt es schlägt (vier auf den Boden, 1 und 3,
// Backbeat auf 2 und 4, nur die Eins), wie lange ein Schlag nachklingt und welche Scheinwerfer es gibt.
// Blitze sind weiche Farbflächen, nie weißes Stroboskop, und kommen höchstens dreimal pro Sekunde
// (eine Schranke für alle Blitze, siehe flashcap.js). „Keine Blitze“ (cfg.noFlash) nimmt sie ganz heraus.
// „Weniger Bewegung“ im System schaltet alles Zuckende ab.
// Darüber liegt die Lichtregie (director.js): sie teilt den Song in Intro, Strophe, Refrain, Drop, Break …
// und gibt jedem Teil einen eigenen Look, Wechsel immer auf der Eins.
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
// Alle weiteren Spielarten (rund 250): je ein Verwandter von oben (styles.js), nur die Abweichungen stehen in genres.js.
// Familien, Genre-Regeln und die Wahl der Spielart (pickProfile) liegen dort auch – ohne Spotify testbar.
for (const k in KIN) PROFILES[k] = like(baseOf(k), LOOKS[k]);
const PROFILE_KEYS = Object.keys(PROFILES);

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

/* ---- Song-Karte (songmap.js) und Lichtregie (director.js) */
// Plan je Analyse und Stil: einmal berechnet, danach nur noch nachgeschlagen. Der Liedtext (für die Stimmung)
// kommt oft erst nach der Analyse – dann wird einmal neu geplant (lyr = Zähler der Textstände)
const plans = new WeakMap();
const lyr = { uri: "", lines: null, n: 0, ver: 0 };
function planFor(d, key, uri) {
  const ln = lyr.uri && lyr.uri === uri ? lyr.n : 0;
  let p = plans.get(d);
  if (!p || p.key !== key || p.ln !== ln) plans.set(d, (p = { key, ln, plan: planSong(d, key, { feat: d.feat, lyrics: ln ? lyr.lines : null }) }));
  return p.plan;
}

// ohne Analyse oder mit ausgeschalteter Lichtregie: alles neutral, wie vorher
const NEUTRAL = { i: -1, sect: -1, kind: "", I: 1, speed: 1, beams: 1, sparks: 1, grade: null, flash: 1, fx: 1, haze: 1, tf: 1, wipe: -1, wdir: 1, riser: 0, pulse: 0, dim: 0, lift: 0, wall: 0, vox: 0, swell: 0, pump: 0, boom: 0, sync: 0, scan: 0,
  mood: "", v: 0, a: 0, soft: 0.2, spread: 1, crowd: 1, fxk: "sparks", sc: -1, spot: "", spot2: "", sx: 1, rig: "" };
const party = (() => {
  let uri = "", picked = "", info = { key: "pop", why: "", bpm: 0 }, token = 0;
  let lastBeat = -1, lastBar = -1, flash = 0, flashCol = 0, shake = 0, kick = 0, spin = 0;
  const inst = { k: -1, s: -1, h: -1 };
  let sway = 1, lastSec = 0, dropGlow = 0, clock = 0, smooth = { e: 0, b: 0, k: 0, br: 0 };
  // eine Schranke für Farbfläche, Blinder, Stroboskop und Gitarrenblitze: zusammen nie mehr als 3 pro Sekunde
  const flashCap = createFlashCap(), hot = { k: false, s: false };
  // die E-Gitarre blitzt auch in leisen Stellen: immersive.js meldet, ob sie gerade spielt
  let stageFlash = false;
  const calm = () => cfg.calm || matchMedia("(prefers-reduced-motion: reduce)").matches;
  // „Leicht“: die Regie wählt weniger und billigere Effekte (kein Lichtwisch, kein Spot, keine Lichtwand)
  const lite = () => !!cfg.lite || cfg.preset === "light" || cfg.eco === "on";

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
    // Lichtregie: welcher Teil des Songs gerade läuft und wie er aussehen soll (director.js)
    const C = (d && d.segs?.length && cfg.partyDirector && cue(planFor(d, info.key, uri), sec, { noFlash: cfg.noFlash, level, lite: lite() })) || NEUTRAL;
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
      // (mit Lichtregie: ihre Teile – die wechseln genau auf der Eins)
      // (mit Szenen der Regie: deren Nummer – sie wechseln auf Phrasengrenzen, auch innerhalb eines Teils)
      scene = C.sc >= 0 ? C.sc : C.i >= 0 ? C.i : Math.max(seek(M.sections, sec, "t"), 0);
      // Lichtregie: wie weit ist der nächste Drop entfernt, wie lang ist der Song
      for (const tD of M.drops) {
        if (tD > sec) {
          toDrop = tD - sec;
          break;
        }
      }
      songLen = M.energy.length * STEP;
      // Abschnitt der Analyse (nicht die Szene – deren Nummer zählt anders)
      const sx = M.sections[Math.max(seek(M.sections, sec, "t"), 0)];
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
        // Gefühl: zärtliche und traurige Teile klingen lang und weich aus, aggressive kurz und hart
        beatEnv = strength * Math.exp(-since * P.decay * (half ? 0.6 : 1) * (1.1 - 0.5 * C.soft));
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
    // Lichtregie: Strophe ruhiger, Refrain größer, Break dunkel; der Einsatz eines Refrains hebt kurz an,
    // der letzte Schlag vor dem Drop ist dunkel (dim)
    const I = clamp((0.22 + smooth.e * 0.78 + dropGlow * 0.35 + smooth.b * 0.2 - smooth.k * 0.35) * C.I * (1 - 0.6 * C.dim) + C.lift * 0.15, 0.08, 1.35);
    let accent = beatEnv * (0.45 + 0.55 * I);
    // Stil-Signaturen: harte 808 (Trap) und Tresillo-Akzente 3-3-2 (Latin) – beides direkt auf der Musik
    const boom = C.boom * kickEnv * (0.4 + 0.6 * smooth.e) * (1 - smooth.k);
    if (boom) accent = Math.max(accent, boom * 0.9);
    if (C.sync && beatIdx >= 0) {
      const p8 = (inBar + beatPhase) * 2;
      const since = Math.min((p8 + 8) % 8, (p8 + 5) % 8, (p8 + 2) % 8);
      accent = Math.max(accent, C.sync * 0.75 * Math.exp(-since * 1.6) * (0.45 + 0.55 * I));
    }

    // --- Farbflächen: je Profil auf anderen Schlägen, nie im Break, höchstens 3 pro Sekunde
    const strong = hit && beatEnv > 0.55;
    let flashOn = false;
    if (P.flashOn === "down") flashOn = hit && inBar === 0;
    else if (P.flashOn === "back") flashOn = snareHit || (hit && (inBar === 1 || inBar === 3) && snareEnv < 0.2);
    else if (P.flashOn === "down-hi") flashOn = hit && inBar === 0 && smooth.e > 0.65;
    if (level >= 5 && P.flashOn && strong && smooth.e > 0.7) flashOn = true;
    // hohe Energie: auch die Kick färbt (gerade Genres), damit es in Refrain und Drop richtig pumpt
    if (level >= 3 && P.flashOn === "down" && kickHit && smooth.e > 0.62 && C.flash >= 0.75) flashOn = true;
    if (smooth.k > 0.5) flashOn = false;
    // die Regie erlaubt je Teil keine (Intro, Break, Outro), nur Einsen (Strophe) oder alle Farbflächen (Refrain, Drop)
    if (C.flash < 0.25 || (C.flash < 0.75 && !(hit && inBar === 0))) flashOn = false;
    let flashGo = false;
    if (fx && cfg.partyFlash && !cfg.noFlash && (flashOn || dropHit) && flashCap.take(clock)) {
      flashGo = true;
      flash = Math.min(1, (dropHit ? 1 : 0.35 + 0.5 * I) * Math.min(lvl, 1.6));
      flashCol = (flashCol + 1) % 3;
    }
    flash *= Math.exp(-dt * (P.decay * 0.8));
    // Blitze der Bühne (Blinder auf der Snare, Stroboskop auf dem Schlag, Gitarrenblitze) zünden nur in einem Bild,
    // das die Schranke freigibt. Gefragt wird nur, wo sie überhaupt möglich sind – sonst nähmen sie der Farbfläche den Platz.
    const kHot = kickEnv > 0.8, sHot = snareEnv > 0.8;
    const stageCue = (hit || (kHot && !hot.k) || (sHot && !hot.s)) && (smooth.e > 0.75 || dropGlow > 0.3 || stageFlash);
    [hot.k, hot.s] = [kHot, sHot];
    if (!flashGo && fx && !cfg.noFlash && stageCue) flashGo = flashCap.take(clock);

    if (fx && P.shake && strong) shake = P.shake * lvl * (0.35 + 0.65 * I) * conf;
    shake *= Math.exp(-dt * 14);
    // Kamera-Stoß auf betonten Schlägen, beim Drop voll
    if (fx && cfg.partyZoom && level >= 4 && strong) kick = Math.min(1, (0.3 + 0.7 * I) * beatEnv * (level - 3));
    if (fx && cfg.partyZoom && dropHit) kick = 1;
    kick *= Math.exp(-dt * 9);

    // --- Strahlen: drehen mit der Energie, im Aufbau immer schneller, springen bei Rave pro Takt
    // Drehrichtung wechselt mit jeder Szene
    // Tempo der Regie: im Break langsam, im Drop schnell; halbes/doppeltes Zeitgefühl (Trap, Drum & Bass)
    const feel = C.speed * (C.tf < 1 ? 0.6 : C.tf > 1 ? 1.5 : 1);
    spin += dt * P.spinRate * (0.3 + smooth.e) * (1 + smooth.b * 5) * feel * (fx ? 1 : 0) * (scene % 2 ? -1 : 1);
    if (barHit && fx && info.key === "rave" && smooth.e > 0.5) spin += 0.6 + Math.random() * 0.6;
    const lasers = fx && cfg.partyLasers && level >= 4 && C.beams > 0.5 ? (level >= 5 ? 12 : 6) : 0;
    // im Break blenden Strahlen aus, im Aufbau ziehen sie sich zusammen
    const beamVis = clamp((smooth.e * 1.25 + dropGlow - smooth.k) * C.beams * (1 - C.dim), 0, 1.2);
    if (hit && P.sway) sway = -sway;

    const out = {
      P, key: info.key, level, lvl, fx, hit, barHit, inBar, conf,
      energy: smooth.e, build: smooth.b, low: smooth.k, bright: smooth.br, minor, I, scene,
      kickEnv, snareEnv, hatEnv, tone, pitch, kickHit, snareHit, hatHit,
      phase: beatPhase, beatIdx, keyPc, tempo: tempoNow || info.bpm || 120,
      // Lichtregie: Ruhe vor dem Sturm (tension), Blackout auf dem letzten Schlag vor dem Drop, Finale im letzten Refrain
      toDrop,
      tension: cfg.partyDirector && toDrop > 60 / (info.bpm || 120) ? clamp((4 - toDrop) / 3.5, 0, 1) : 0,
      blackout: !!cfg.partyDirector && ((toDrop > 0.02 && toDrop < (60 / (info.bpm || 120)) * 0.95) || C.dim >= 1),
      finale: !!cfg.partyDirector && songLen > 60 && sec > songLen * 0.72 && smooth.e > 0.7,
      beat: beatEnv, accent, beam: accent, drop: Math.max(dropGlow, clamp((smooth.e - 0.8) * 2.5, 0, 1)), dropHit,
      flash, flashCol, flashGo, shake: fx ? shake : 0, kick: fx ? kick : 0, spin, lasers, beamVis, sway,
      // Lichtregie für Bühne, Location und Visualizer: Teil, Farbkorrektur, Bewegungsuhren (mt in Sekunden,
      // mb in Schlägen), Lichtwisch beim Wechsel, Riser, Einsatz, Lichtwand, Spot auf gehaltenen Tönen, Atmen,
      // Pumpen und 808 – ohne Blitze wird alles Pulsende zu ruhigem Glühen
      sect: C.sect, kind: C.kind, grade: C.grade, speed: C.speed, tf: C.tf, mt: C.mt, mb: C.mb, wipe: fx ? C.wipe : -1, wdir: C.wdir,
      riser: C.riser, pulse: fx ? C.pulse : 0, lift: C.lift, wall: fx ? C.wall : 0, vox: fx ? C.vox : 0, swell: C.swell, haze: C.haze,
      pump: fx ? C.pump : 0, boom: fx ? (cfg.noFlash ? boom * 0.35 : boom) : 0, scan: C.scan, sparkMul: C.sparks, fxMul: C.fx,
      glow: fx && C.pump ? C.pump * (cfg.noFlash ? 0.03 : 0.08) * (1 - kickEnv) * I : 0,
      // Gefühl und Szene (director.js/mood.js): Stimmung, Kegelbreite, wie viel das Publikum tanzt, Teilcheneffekt,
      // Bühnenlicht und Muster der Szene (spot2 → spot gleitet über sx)
      mood: C.mood, valence: C.v, arousal: C.a, spread: C.spread, crowd: C.crowd, fxk: C.fxk,
      spot: C.spot, spot2: C.spot2, sx: C.sx, rig: C.rig, look: C.scene || "",
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

  // Visualizer-Ansichten (ohne Party): dieselbe Regie, nur das Nötige – Teil, Farbkorrektur, Tempo, Drop
  let moodSec = 0;
  function mood(sec, playing) {
    const d = audio.data;
    if (!d?.segs?.length || !cfg.partyDirector) return null;
    const C = cue(planFor(d, audio.uri === uri ? info.key : "pop", audio.uri), sec, { noFlash: cfg.noFlash, level: 3, lite: lite() });
    if (!C) return null;
    const M = songMap(d);
    let dropHit = false;
    if (playing && sec >= moodSec && sec - moodSec < 0.5) for (const t of M.drops) if (t > moodSec && t <= sec + 0.02) dropHit = true;
    moodSec = sec;
    C.energy = at(M.energy, sec);
    C.dropHit = dropHit;
    return C;
  }

  // Liedtext des Songs (synchronisierte Zeilen, t in ms) – nur für die Stimmung, nichts geht hinaus
  function lyrics(u, lines) {
    const ls = (lines || []).filter((l) => l.text && l.text !== "♪").map((l) => ({ t: l.t / 1000, text: l.text }));
    if (u === lyr.uri && ls.length === (lyr.lines?.length || 0)) return;
    [lyr.uri, lyr.lines, lyr.n] = [u, ls, ls.length ? ++lyr.ver : 0];
  }

  return { prepare, step, mood, lyrics, get info() { return info; }, set stageFlash(v) { stageFlash = !!v; }, PROFILES, PROFILE_KEYS, FAMILIES };
})();

export { party, PROFILE_KEYS, FAMILIES };
