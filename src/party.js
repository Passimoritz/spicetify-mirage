import { S, clamp, seek, lru } from "./core.js";
import { cfg } from "./config.js";
import { audio } from "./audio.js";

/* ---------------------------------------------------------------- Party-Modus */
// Jeder Song bekommt ein Profil: aus den Genres des Künstlers (Spotify), sonst aus Tempo und
// Lautheit der Taktanalyse. Das Profil legt Visualizer-Stil, Puls, Wackeln, Ringe und Lichtblitze fest.
// Blitze sind weiche Farbflächen (keine weißen Stroboskop-Blitze) und kommen höchstens einmal pro Takt
// bzw. alle zwei Schläge – also unter drei pro Sekunde. „Weniger Bewegung“ im System schaltet sie ab.
// thick = Balkenstärke, halo = feine Lichtlinie über den Spitzen, sparks = Funken je Schlag,
// bottom = zusätzliche Bassbalken am unteren Rand
const PROFILES = {
  rave: { mirror: true, spin: true, height: 1.5, pulse: 0.09, shake: 0, flash: "bar", ring: 1, thick: 2.6, halo: true, sparks: 10, bottom: false },
  bass: { mirror: true, spin: false, height: 1.35, pulse: 0.12, shake: 6, flash: "bar", ring: 2, thick: 4.2, halo: false, sparks: 6, bottom: true },
  rock: { mirror: true, spin: false, height: 1.5, pulse: 0.08, shake: 8, flash: "beat", ring: 2, thick: 3.4, halo: true, sparks: 14, bottom: false },
  pop: { mirror: true, spin: true, height: 1.4, pulse: 0.07, shake: 0, flash: "bar", ring: 1, thick: 2.4, halo: true, sparks: 18, bottom: false },
  chill: { mirror: true, spin: true, height: 1.1, pulse: 0.035, shake: 0, flash: "", ring: 4, thick: 2, halo: true, sparks: 3, bottom: false },
};
const PROFILE_KEYS = Object.keys(PROFILES);
// Reihenfolge zählt: „dance pop“ ist eher Pop als Rave, „pop punk“ eher Rock
const GENRES = [
  ["chill", /lo-?fi|chill|ambient|acoustic|jazz|classical|piano|folk|soul|r&b|rnb|bossa|sleep|meditation|singer-songwriter|soundtrack|orchestra/],
  ["rock", /rock|metal|punk|grunge|core\b|emo|hardcore|garage/],
  ["bass", /hip ?hop|rap|trap|drill|grime|phonk|reggaeton|dancehall|afro|urbano|boom bap|gangsta/],
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

// Profil aus Genres; ohne Treffer aus Tempo + Lautheit
function pickProfile(genres, bpm, loud) {
  const text = genres.join(" | ");
  for (const [k, re] of GENRES) if (re.test(text)) return { key: k, why: genres[0] || "" };
  const energy = clamp((loud + 16) / 12, 0, 1);
  if (energy < 0.35 || (bpm && bpm < 80)) return { key: "chill", why: "" };
  if (bpm >= 118 && bpm <= 135 && energy > 0.6) return { key: "rave", why: "" };
  if (bpm >= 80 && bpm < 105) return { key: "bass", why: "" };
  if (bpm > 140 && energy > 0.7) return { key: "rock", why: "" };
  return { key: "pop", why: "" };
}

const party = (() => {
  let uri = "", picked = "", info = { key: "pop", why: "", bpm: 0 }, token = 0;
  let lastBeat = -1, lastBar = -1, flash = 0, flashCol = 0, shake = 0, drop = 0, kick = 0, beam = 0, spin = 0;
  const calm = () => cfg.calm || matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function prepare(item) {
    const u = item?.uri || "";
    // Song + gewählter Stil: wer in den Einstellungen umstellt, bekommt sofort das neue Profil
    if (u + "|" + cfg.partyStyle === picked) return info;
    picked = u + "|" + cfg.partyStyle;
    uri = u;
    const my = ++token;
    lastBeat = lastBar = -1;
    const genres = cfg.partyStyle === "auto" ? await artistGenres(item) : [];
    if (my !== token) return info;
    const bpm = audio.uri === u ? audio.data?.bpm || 0 : 0;
    const loud = audio.uri === u ? audio.data?.loud ?? -10 : -10;
    const auto = pickProfile(genres, bpm, loud);
    info = { key: cfg.partyStyle !== "auto" && PROFILES[cfg.partyStyle] ? cfg.partyStyle : auto.key, why: auto.why, bpm };
    return info;
  }
  // Taktdaten kommen oft erst nach dem Songwechsel: dann Tempo nachtragen und ggf. neu wählen
  function refine() {
    if (!audio.data || audio.uri !== uri) return;
    if (info.bpm !== audio.data.bpm) {
      info.bpm = audio.data.bpm;
      if (cfg.partyStyle === "auto" && !info.why) info.key = pickProfile([], info.bpm, audio.data.loud).key;
    }
  }

  // Pro Bild: Stärke von Schlag, Drop, Blitz und Wackeln (0..1 bzw. px), zeitbasiert abklingend
  function step(sec, dt, playing) {
    refine();
    const P = PROFILES[info.key];
    // Stufen: Leicht · Normal · Max · Extrem · Wahnsinn – ab „Extrem“ kommen Lichtstrahlen und
    // Kamera-Stöße dazu, bei „Wahnsinn“ doppelt so viele Strahlen und Blitz auf jedem Schlag
    const level = clamp(Math.round(cfg.partyLevel) || 2, 1, 5);
    const lvl = [0.6, 1, 1.45, 2, 2.7][level - 1];
    const d = audio.uri === uri ? audio.data : null;
    let hit = false, barHit = false, conf = 0.8;
    if (d && playing) {
      const bi = seek(d.beats, sec, "t");
      // sehr schnelle Songs: nur jeden zweiten Schlag (Halftime), sonst flackert es
      const every = info.bpm > 145 ? 2 : 1;
      if (bi >= 0 && bi !== lastBeat) {
        lastBeat = bi;
        if (bi % every === 0) {
          hit = true;
          conf = clamp(d.beats[bi].c + 0.3, 0, 1);
        }
      }
      const ba = d.bars?.length ? seek(d.bars, sec, "t") : Math.floor(Math.max(bi, 0) / 4);
      if (ba >= 0 && ba !== lastBar) {
        lastBar = ba;
        barHit = true;
      }
      // Drop: deutlich lauter als der Songschnitt
      const s = d.segs[Math.max(seek(d.segs, sec, "t"), 0)];
      const target = s ? clamp((s.l - d.avg - 1.5) / 5, 0, 1) : 0;
      drop += (target - drop) * (1 - Math.exp(-dt * (target > drop ? 6 : 1.2)));
    } else drop *= Math.exp(-dt * 2);
    if (!Number.isFinite(drop)) drop = 0;

    const fx = !calm();
    // Blitze bleiben unter drei pro Sekunde: „jeder Schlag“ nur bei „Wahnsinn“, schnelle Songs
    // haben oben schon Halftime (every = 2)
    const flashOn = level >= 5 && P.flash ? hit : P.flash === "beat" ? hit && lastBeat % 2 === 0 : P.flash === "bar" ? barHit : false;
    if (fx && cfg.partyFlash && flashOn) {
      flash = Math.min(1, (0.55 + drop * 0.45) * lvl);
      flashCol = (flashCol + 1) % 3;
    }
    flash *= Math.exp(-dt * 5.5);
    if (fx && P.shake && hit) shake = P.shake * lvl * (0.6 + drop * 0.6) * conf;
    shake *= Math.exp(-dt * 14);
    // Kamera-Stoß: das ganze Bild zoomt kurz auf den Schlag; Strahlen leuchten auf und springen pro Takt
    if (fx && hit && level >= 4 && cfg.partyZoom) kick = Math.min(1, (0.55 + drop * 0.6) * conf * (level - 3));
    kick *= Math.exp(-dt * 9);
    if (hit) beam = 1;
    beam *= Math.exp(-dt * 4);
    spin += dt * (0.18 + drop * 0.5) * (fx ? 1 : 0);
    if (barHit && fx) spin += 0.7 + Math.random() * 0.8;
    const lasers = fx && cfg.partyLasers && level >= 4 ? (level >= 5 ? 12 : 6) : 0;
    return { P, lvl, level, hit, barHit, conf, drop, flash, flashCol, shake: fx ? shake : 0, kick: fx ? kick : 0, beam, spin, lasers };
  }

  return { prepare, step, get info() { return info; }, PROFILES, PROFILE_KEYS };
})();

export { party, PROFILE_KEYS };
