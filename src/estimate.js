import { S, clamp } from "./core.js";
import { cfg } from "./config.js";
import { getLyrics } from "./lyrics.js";
import { currentItem, titleOf, PLR } from "./player.js";

/* ---------------------------------------------------------------- Ersatz-Taktanalyse */
// Für viele (gerade neuere) Songs liefert Spotify keine Taktanalyse mehr. Ohne sie hätte der Visualizer
// keinen Schlag und Party kein Feeling. Dann baut Mirage eine Schätzung im selben Format:
//  1. Tempo: Spotifys Audio-Merkmale (gibt es oft noch, wenn die Analyse fehlt), sonst Deezer
//  2. Tempo/Schlag aus dem Liedtext: gesungene Zeilen und Wörter beginnen auf dem Schlag –
//     das passendste Tempo zwischen 60 und 190 BPM und die Lage der Eins ergeben das Raster
//  3. Aufbau aus dem Liedtext: Refrain (wiederholte Zeilen) lauter, Instrumental-Lücken leiser;
//     Kick auf 1 und 3, Snare auf 2 und 4, Hi-Hats auf den Achteln
// Ist die echte Analyse später doch da, ersetzt sie die Schätzung.

const within = (p, ms) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);
async function cosmos(url) {
  try {
    const r = await S.CosmosAsync.get(url);
    return typeof r === "string" ? JSON.parse(r) : r;
  } catch {
    return null;
  }
}
// Spotifys Audio-Merkmale: Tempo, Lautheit, Energie, Tonart, Dur/Moll
async function spotifyFeatures(id) {
  for (const url of [`https://spclient.wg.spotify.com/audio-attributes/v1/audio-features/${id}`, `https://api.spotify.com/v1/audio-features/${id}`]) {
    const f = await within(cosmos(url), 4000);
    if (Number(f?.tempo) > 40) return { bpm: Number(f.tempo), loud: Number(f.loudness) || -8, energy: Number(f.energy) || 0.6, key: Number.isFinite(f.key) ? f.key : -1, mode: Number.isFinite(f.mode) ? f.mode : 1 };
  }
  return null;
}
// Deezer kennt bei vielen bekannten Songs das Tempo (nur Titel und Künstler gehen raus)
async function deezerBpm(item) {
  if (!cfg.partyOnline) return null;
  const artist = item?.metadata?.artist_name || item?.artists?.[0]?.name || "";
  const title = titleOf(item).replace(/\s+-\s+.*$/, "").replace(/\s*[([].*?[)\]]/g, "");
  if (!artist || !title) return null;
  const res = await within(cosmos(`https://api.deezer.com/search?q=${encodeURIComponent(`artist:"${artist}" track:"${title}"`)}&limit=3`), 4000);
  const hit = res?.data?.[0];
  if (!hit?.id) return null;
  const t = await within(cosmos(`https://api.deezer.com/track/${hit.id}`), 4000);
  return Number(t?.bpm) > 40 ? { bpm: Number(t.bpm), loud: Number(t.gain) || -8 } : null;
}

// Wie gut liegen die Einsätze auf einem Raster mit Periode P? (Länge des mittleren Phasen-Vektors, 0..1)
function fitGrid(on, P) {
  let x = 0, y = 0;
  for (const t of on) {
    const a = ((t % P) / P) * Math.PI * 2;
    x += Math.cos(a);
    y += Math.sin(a);
  }
  const R = Math.hypot(x, y) / on.length;
  return { R, phase: ((Math.atan2(y, x) / (Math.PI * 2) + 1) % 1) * P };
}
// Tempo aus den Einsätzen: Wörter (genau) oder Zeilenanfänge (gröber, liegen auf Takt oder Halbtakt)
function tempoFromOnsets(on, hint) {
  let best = null;
  for (let bpm = 60; bpm <= 190; bpm += 0.5) {
    const P = 60 / bpm;
    const { R, phase } = fitGrid(on, P);
    // leichte Vorliebe für übliche Tempi und – falls bekannt – für das Tempo aus Spotify/Deezer
    const prior = Math.exp(-(((bpm - 118) / 45) ** 2) * 0.5) * (hint ? Math.max(0.35, Math.exp(-(((bpm - hint) / 4) ** 2))) : 1);
    const score = R * (0.6 + 0.4 * prior);
    if (!best || score > best.score) best = { bpm, phase, R, score };
  }
  return best;
}

// Nur Zeilenanfänge (keine Wortzeiten): Zeilen kommen fast immer im Abstand von 2, 4, 8 oder 16 Schlägen.
// Erst den Zeilen-Takt L finden, dann nur Tempi aus seiner Zweierpotenz-Familie erlauben (60·2ⁿ/L) – sonst
// passen auch „schiefe“ Tempi (z. B. 115 statt 92 BPM, weil 10 solcher Schläge auch auf die Zeilen fallen).
function tempoFromLines(on, hint) {
  // Teiler des Zeilen-Takts (L/2, L/3 …) passen genauso gut – darum den GRÖSSTEN Abstand nehmen, der
  // fast so gut passt wie der beste
  const fits = [];
  let top = 0;
  for (let L = 1.2; L <= 12; L += 0.005) {
    const { R } = fitGrid(on, L);
    fits.push([L, R]);
    top = Math.max(top, R);
  }
  if (!top) return null;
  const L = fits.filter(([, R]) => R >= top * 0.97).pop()[0];
  // eine Zeile dauert meist 8 Schläge (2 Takte), sonst 4 oder 16
  const family = [8, 4, 16, 2, 32].map((k) => (60 * k) / L).filter((b) => b >= 70 && b <= 170);
  if (!family.length) return null;
  // bekanntes Tempo aus Spotify/Deezer gewinnt, wenn es in die Familie passt (±4 %), sonst bei unsicherem Raster
  const near = hint && family.find((b) => Math.abs(b / hint - 1) < 0.04);
  const bpm = near || (hint && top < 0.6 ? hint : family[0]);
  const best = { R: top };
  return { bpm, R: best.R, phase: fitGrid(on, 60 / bpm).phase };
}

async function estimateAnalysis(uri) {
  const id = uri.split(":")[2];
  const item = currentItem()?.uri === uri ? currentItem() : null;
  const dur = Number(item?.metadata?.duration || item?.duration?.milliseconds || PLR.getDuration() || 0) / 1000 || 210;
  const [feat, lyr] = await Promise.all([spotifyFeatures(id), within(getLyrics(uri), 9000)]);
  const dz = feat ? null : await deezerBpm(item);
  const hint = feat?.bpm || dz?.bpm || 0;
  // Einsätze aus dem Liedtext: Wortanfänge, sonst Zeilenanfänge
  const lines = lyr?.synced ? lyr.lines.filter((l) => l.text && l.text !== "♪") : [];
  const words = lines.flatMap((l) => (l.words || []).map((w) => w.t / 1000));
  const on = words.length > 30 ? words : lines.map((l) => l.t / 1000);
  let bpm = hint, phase = 0, conf = 0.5;
  if (on.length >= 8 && on !== words) {
    const fit = tempoFromLines(on, hint);
    if (fit) [bpm, phase, conf] = [fit.bpm, fit.phase, clamp(fit.R * 1.2, 0.3, 0.9)];
  } else if (on.length >= 8) {
    const fit = tempoFromOnsets(on, hint);
    // nur übernehmen, wenn der Text wirklich ein Raster zeigt – sonst lieber das bekannte Tempo
    const use = hint && fit.R < 0.4 ? hint : fit.bpm;
    if (fit.R > 0.25 || !hint) [bpm, phase, conf] = [use, fitGrid(on, 60 / use).phase, clamp(fit.R * 1.4, 0.3, 0.95)];
    else phase = fitGrid(on, 60 / hint).phase;
  }
  if (!bpm) return null;
  while (bpm > 165) bpm /= 2;
  while (bpm < 70) bpm *= 2;
  const P = 60 / bpm;
  const beats = [];
  for (let t = phase; t < dur; t += P) beats.push({ t, c: conf });
  if (beats.length < 8) return null;
  // die Eins: der Schlag im 4er-Takt, auf dem die meisten Zeilen beginnen
  const votes = [0, 0, 0, 0];
  for (const l of lines) votes[Math.round((l.t / 1000 - phase) / P) & 3]++;
  const one = votes.indexOf(Math.max(...votes));
  const bars = beats.filter((_, i) => (i - one) % 4 === 0).map((b) => ({ t: b.t }));
  // Energie über die Zeit: Refrain = wiederholte Zeilen, lange Textlücken = ruhig (Intro, Break, Outro)
  const key = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const seen = new Map();
  for (const l of lines) seen.set(key(l.text), (seen.get(key(l.text)) || 0) + 1);
  const hook = lines.filter((l) => seen.get(key(l.text)) >= 2).map((l) => l.t / 1000);
  const sung = lines.map((l) => l.t / 1000);
  const near = (arr, t, r) => arr.some((x) => Math.abs(x - t) < r);
  const base = feat?.loud ?? dz?.loud ?? -8;
  const energy = feat?.energy ?? 0.65;
  const chroma = Array.from({ length: 12 }, (_, k) => {
    if (!feat || feat.key < 0) return 0.3 + 0.2 * Math.sin(k);
    // Tonart: Grundton, Terz (Dur/Moll) und Quinte klingen am meisten
    const d = (k - feat.key + 12) % 12;
    return d === 0 ? 1 : d === 7 ? 0.8 : d === (feat.mode ? 4 : 3) ? 0.7 : 0.15;
  });
  const segs = [];
  for (let i = 0; i < beats.length * 2; i++) {
    const t = phase + i * (P / 2), beatI = i >> 1, inBar = (((beatI - one) % 4) + 4) % 4, off = i & 1;
    if (t >= dur) break;
    const lyrical = near(sung, t, 6), chorus = near(hook, t, 5);
    const lvl = base - (lyrical ? 0 : sung.length ? 7 : 2) + (chorus ? 2.5 : 0) - (t < 4 || t > dur - 6 ? 6 : 0);
    // Kick auf 1 und 3 (hart, dunkel), Snare auf 2 und 4 (hart, rauschig), Hi-Hat auf den Achteln (hell)
    const kick = !off && (inBar === 0 || inBar === 2), snare = !off && (inBar === 1 || inBar === 3);
    segs.push({
      t, l: lvl + (kick ? 1.5 : snare ? 1 : -3) * energy,
      p: chroma.map((v, k) => clamp(v * (0.75 + 0.25 * Math.sin(i * 0.7 + k)), 0, 1)),
      b: off ? 95 : kick ? 25 : 60, f: snare ? 60 : off ? 35 : 10, k: kick ? 95 : snare ? 80 : 15,
    });
  }
  const avg = segs.reduce((n, s) => n + s.l, 0) / segs.length;
  return {
    beats, bars, segs, avg, bpm: Math.round(bpm), loud: base,
    sections: [{ t: 0, mode: feat?.mode ?? 1, l: base }],
    synthetic: true,
  };
}

export { estimateAnalysis, tempoFromOnsets };
