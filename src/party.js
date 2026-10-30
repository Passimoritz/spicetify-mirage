import { S, clamp, seek, lru } from "./core.js";
import { cfg } from "./config.js";
import { audio } from "./audio.js";

/* ---------------------------------------------------------------- Party-Modus */
// Jeder Song bekommt ein Profil: aus den Genres des Künstlers (Spotify), sonst aus Tempo und
// Lautheit der Taktanalyse. Das Profil legt Visualizer-Stil, Puls, Wackeln, Ringe und Lichtblitze fest.
// Blitze sind weiche Farbflächen (keine weißen Stroboskop-Blitze) und kommen höchstens einmal pro Takt
// bzw. alle zwei Schläge – also unter drei pro Sekunde. „Weniger Bewegung“ im System schaltet sie ab.
const PROFILES = {
  rave: { style: "bars", mirror: true, spin: true, height: 1.55, pulse: 0.09, shake: 0, flash: "bar", ring: 1, glow: 1 },
  bass: { style: "bottom", mirror: false, spin: false, height: 1.8, pulse: 0.12, shake: 7, flash: "bar", ring: 2, glow: 0.8 },
  rock: { style: "wave", mirror: true, spin: false, height: 1.6, pulse: 0.08, shake: 10, flash: "beat", ring: 2, glow: 1 },
  pop: { style: "particles", mirror: true, spin: true, height: 1.45, pulse: 0.07, shake: 0, flash: "bar", ring: 1, glow: 1 },
  chill: { style: "wave", mirror: true, spin: true, height: 1.1, pulse: 0.035, shake: 0, flash: "", ring: 4, glow: 0.6 },
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
  let lastBeat = -1, lastBar = -1, flash = 0, flashCol = 0, shake = 0, drop = 0;
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
    const lvl = [0.6, 1, 1.45][clamp(cfg.partyLevel, 1, 3) - 1];
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

    const fx = !calm();
    const strong = P.flash === "beat" ? hit && lastBeat % 2 === 0 : P.flash === "bar" ? barHit : false;
    if (fx && cfg.partyFlash && strong) {
      flash = Math.min(1, 0.55 + drop * 0.45) * lvl;
      flashCol = (flashCol + 1) % 3;
    }
    flash *= Math.exp(-dt * 5.5);
    if (fx && P.shake && hit) shake = P.shake * lvl * (0.6 + drop * 0.6) * conf;
    shake *= Math.exp(-dt * 14);
    return { P, lvl, hit, barHit, conf, drop, flash, flashCol, shake: fx ? shake : 0 };
  }

  return { prepare, step, get info() { return info; }, PROFILES, PROFILE_KEYS };
})();

export { party, PROFILE_KEYS };
