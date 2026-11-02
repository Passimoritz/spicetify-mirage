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
  const m = { energy, bright, drops, dynamic: hi - p10 > 4 || energy.some((v) => v < 0.2), sections: d.sections || [] };
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
  let sway = 1, lastSec = 0, dropGlow = 0, lastFlashAt = -1e9, clock = 0, smooth = { e: 0, b: 0, k: 0, br: 0 };
  const calm = () => cfg.calm || matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function prepare(item) {
    const u = item?.uri || "";
    // Song + gewählter Stil: wer in den Einstellungen umstellt, bekommt sofort das neue Profil
    if (u + "|" + cfg.partyStyle === picked) return info;
    picked = u + "|" + cfg.partyStyle;
    uri = u;
    const my = ++token;
    lastBeat = lastBar = -1;
    dropGlow = 0;
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
    let energy = 0.55, build = 0, low = 0, bright = 0.5, minor = false, dropHit = false;
    let hit = false, barHit = false, inBar = 0, beatEnv = 0, conf = 0.8;
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
      const sx = M.sections[Math.max(seek(M.sections, sec, "t"), 0)];
      minor = sx ? sx.mode === 0 : false;
      // Drop genau auf seinem Schlag (vorberechnet) – nicht erst, wenn die Lautheit schon da ist
      // (nicht nach einem Sprung im Song – nur bei normalem Weiterlaufen)
      if (playing && sec >= lastSec && sec - lastSec < 0.5) for (const t of M.drops) if (t > lastSec && t <= sec + 0.02) dropHit = true;
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
    else if (P.flashOn === "back") flashOn = hit && (inBar === 1 || inBar === 3);
    else if (P.flashOn === "down-hi") flashOn = hit && inBar === 0 && smooth.e > 0.65;
    if (level >= 5 && P.flashOn && strong && smooth.e > 0.7) flashOn = true;
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
    spin += dt * P.spinRate * (0.3 + smooth.e) * (1 + smooth.b * 5) * (fx ? 1 : 0);
    if (barHit && fx && info.key === "rave" && smooth.e > 0.5) spin += 0.6 + Math.random() * 0.6;
    const lasers = fx && cfg.partyLasers && level >= 4 ? (level >= 5 ? 12 : 6) : 0;
    // im Break blenden Strahlen aus, im Aufbau ziehen sie sich zusammen
    const beamVis = clamp(smooth.e * 1.25 + dropGlow - smooth.k, 0, 1.2);
    if (hit && P.sway) sway = -sway;

    const out = {
      P, key: info.key, level, lvl, fx, hit, barHit, inBar, conf,
      energy: smooth.e, build: smooth.b, low: smooth.k, bright: smooth.br, minor, I,
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

  return { prepare, step, get info() { return info; }, PROFILES, PROFILE_KEYS };
})();

export { party, PROFILE_KEYS };
